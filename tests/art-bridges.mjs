import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { serve } from '../tools/serve.mjs';
import { allLevels, getLevel } from '../src/content/levels.js';
import { newRun, move } from '../src/model/commands.js';
import { eulerRoute } from '../src/model/euler.js';
import { repairSolution } from '../src/model/repair.js';
import { emptySnapshot, recordCompletion, STORAGE_KEY } from '../src/storage.js';

let saved = emptySnapshot();
for (const level of allLevels.filter((l) => l.kind === 'walk')) {
  const route = eulerRoute(
    level,
    level.fixedStart,
    level.objective === 'return' ? level.fixedStart : level.fixedEnd,
  );
  let run = {
    ...newRun(level),
    startNode: route.start,
    currentNode: route.start,
    history: [route.start],
  };
  for (const id of route.edges) run = move(level, run, id).run;
  saved = recordCompletion(saved, level.id, level, run);
}
const server = await serve({ port: 0, root: 'dist' });
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {}),
  });
  // Validate the reservation against the real sprite, independently of prop placement.
  const probe = await browser.newPage({
    viewport: { width: 1200, height: 800 },
    reducedMotion: 'reduce',
  });
  await probe.goto(`${base}/?lang=en#SB01`);
  await probe.locator('#stage .traveler-bob').waitFor();
  const uncovered = await probe.evaluate(async () => {
    const { TRAVELER_SILHOUETTE } = await import('/src/render/scenery.js');
    const traveler = document.querySelector('#stage .traveler');
    const missed = [];
    for (const shape of traveler.querySelectorAll('.traveler-bob path, .traveler-bob circle')) {
      const box = shape.getBBox();
      const matrix = traveler.getCTM().inverse().multiply(shape.getCTM());
      // Sample each rendered part's extent throughout the idle bob, including feet.
      for (let x = 0; x <= 8; x++)
        for (let y = 0; y <= 8; y++) {
          const p = new DOMPoint(
            box.x + (box.width * x) / 8,
            box.y + (box.height * y) / 8,
          ).matrixTransform(matrix);
          for (const bob of [0, -2.5])
            if (
              !TRAVELER_SILHOUETTE.some(
                (r) => p.x >= r.x0 && p.x <= r.x1 && p.y + bob >= r.y0 && p.y + bob <= r.y1,
              )
            )
              missed.push({ x: p.x, y: p.y + bob });
        }
    }
    return missed;
  });
  assert.deepEqual(uncovered, [], 'Reservation must cover the rendered messenger, including feet');
  // Exercise real pointer capture on a deliberately height-limited, letterboxed SVG.
  const target = await probe.evaluate(async () => {
    const { attachPointer } = await import('/src/input/pointer.js');
    document.body.innerHTML =
      '<div id="pointer-probe"><svg viewBox="0 0 1000 600" style="width:1000px;height:120px;display:block"><path d="M200 300H800" stroke="black"/></svg></div>';
    const stage = document.querySelector('#pointer-probe');
    const edge = { id: 'test', u: 'A', v: 'B' };
    window.pointerSubmissions = [];
    attachPointer(
      stage,
      () => ({
        geo: {
          w: 1000,
          h: 600,
          nodes: {},
          curves: {
            test: {
              samples: [
                { x: 200, y: 300 },
                { x: 800, y: 300 },
              ],
            },
          },
        },
        graph: { edges: [edge] },
        canSelectNode: () => false,
        actionable: () => true,
        locked: false,
      }),
      (id) => window.pointerSubmissions.push(id),
      () => {},
      () => {},
    );
    const svg = stage.querySelector('svg');
    const matrix = svg.getScreenCTM();
    const p = new DOMPoint(500, 300).matrixTransform(matrix);
    return {
      x: p.x,
      y: p.y,
      scale: Math.hypot(matrix.a, matrix.b),
      width: svg.getBoundingClientRect().width,
    };
  });
  assert.ok(target.scale < target.width / 1000, 'Fixture must be height-limited');
  await probe.mouse.click(target.x, target.y + 20);
  assert.deepEqual(await probe.evaluate(() => window.pointerSubmissions), ['test']);
  await probe.mouse.click(target.x, target.y + 24);
  assert.deepEqual(
    await probe.evaluate(() => window.pointerSubmissions),
    ['test'],
    'Outside 22px must miss',
  );
  await probe.close();
  await mkdir('test-results/art', { recursive: true });
  for (const [width, height] of [
    [1440, 1000],
    [1366, 768],
    [844, 390],
    [390, 844],
    [320, 740],
  ]) {
    for (const lang of ['zh', 'en']) {
      const context = await browser.newContext({
        viewport: { width, height },
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
        key: STORAGE_KEY,
        value: JSON.stringify(saved),
      });
      await page.goto(`${base}/?lang=${lang}#SB01`);
      await page.locator('#stage svg').waitFor();
      const fit = await page.evaluate(() => {
        const toolbar = document.querySelector('.toolbar').getBoundingClientRect();
        return {
          width: document.documentElement.scrollWidth,
          viewport: innerWidth,
          bottom: toolbar.bottom,
          height: innerHeight,
          top: toolbar.top,
        };
      });
      assert.ok(
        fit.width <= fit.viewport && fit.bottom <= fit.height + 1 && fit.top >= 0,
        `${width}×${height} ${lang}: ${JSON.stringify(fit)}`,
      );
      // Complete through real commands, then check the result against actual rendered
      // island and label bounds rather than assumptions about the chosen screen size.
      for (const id of ['b1', 'b2', 'b3']) {
        await page.locator(`[data-bridge="${id}"]`).focus();
        await page.keyboard.press('Enter');
      }
      assert.equal(await page.locator('#complete-banner').isVisible(), true);
      const occluded = await page.evaluate(() => {
        const banner = document.querySelector('#complete-banner').getBoundingClientRect();
        return [...document.querySelectorAll('#stage .land-name, #stage .node-dot')].some((el) => {
          const box = el.getBoundingClientRect();
          return (
            box.left < banner.right &&
            box.right > banner.left &&
            box.top < banner.bottom &&
            box.bottom > banner.top
          );
        });
      });
      assert.equal(occluded, false, `${width}×${height} ${lang}: completion covers the scene`);
      await page.screenshot({
        path: `test-results/art/complete-${width}-${lang}.png`,
        fullPage: true,
      });
      if (width === 390) {
        for (const theme of ['light', 'dark']) {
          await page.goto(`${base}/?lang=${lang}&theme=${theme}#SB32`);
          assert.equal(await page.locator('#stage .bridge.ghost').count(), 4);
          const shadows = async (selector) =>
            page
              .locator(selector)
              .evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity));
          assert.ok(
            (await shadows('#stage .bridge.ghost .bridge-shadow')).every(
              (opacity) => opacity === '0',
            ),
          );
          await page.locator('#lens-button').click();
          assert.ok(
            (
              await shadows(
                '#stage .bridge-shadow, #stage .crossing-shadow, #stage .material-detail',
              )
            ).every((opacity) => opacity === '0'),
          );
          await page.screenshot({
            path: `test-results/art/night-graph-${lang}-${theme}.png`,
            fullPage: true,
          });
          await page.locator('#map-button').click();
          await page.locator('[data-action="tab:works"]').click();
          const emblems = await page
            .locator('.commission-stamp .stamp-emblem')
            .evaluateAll((els) => els.map((el) => el.innerHTML));
          assert.equal(emblems.length, 8);
          assert.equal(new Set(emblems).size, 8);
          await page.screenshot({
            path: `test-results/art/commissions-${lang}-${theme}.png`,
            fullPage: true,
          });
        }
      }
      // A long planning journal must not push the left-column controls down.
      await page.goto(`${base}/?lang=${lang}#SB32`);
      const planningFit = await page.locator('.toolbar').evaluate((el) => ({
        bottom: el.getBoundingClientRect().bottom,
        height: innerHeight,
      }));
      assert.ok(
        planningFit.bottom <= planningFit.height + 1,
        `${width}×${height} ${lang}: planning controls below viewport`,
      );
      if (width === 320) {
        await page.goto(`${base}/?lang=${lang}#EC01`);
        const proof = repairSolution(getLevel('EC01'));
        for (const id of proof.ids) await page.locator(`[data-edit="${id}"]`).click();
        await page.locator('#confirm-blueprint').click();
        for (const id of proof.route.edges) {
          await page.locator(`[data-bridge="${id}"]`).focus();
          await page.keyboard.press('Enter');
        }
        assert.equal(await page.locator('#complete-banner .commission-stamp').count(), 1);
        const contained = await page.locator('.completion-copy').evaluate((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          return range.getBoundingClientRect().right <= el.getBoundingClientRect().right + 1;
        });
        assert.equal(contained, true, `${lang}: commission caption overflows into the next action`);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
        );
        await page.screenshot({
          path: `test-results/art/commission-complete-${lang}.png`,
          fullPage: true,
        });
      }
      await context.close();
      console.log(`✓ Art: ${width}×${height} ${lang}, controls and unobscured completion`);
    }
  }
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
