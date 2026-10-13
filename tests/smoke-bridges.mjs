import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { serve } from '../tools/serve.mjs';
import { allLevels, getLevel } from '../src/content/levels.js';
import { newRun, move } from '../src/model/commands.js';
import { eulerRoute } from '../src/model/euler.js';
import { repairSolution, applyEdits } from '../src/model/repair.js';
import { emptySnapshot, STORAGE_KEY, recordCompletion } from '../src/storage.js';
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  ({ chromium } = await import(
    `${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/playwright/index.mjs`
  ));
}
const server = await serve({ port: 0, root: 'dist' }),
  port = server.address().port,
  base = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox'],
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : {}),
});
await mkdir('test-results', { recursive: true });
const errors = [],
  results = [];
async function scenario(title, fn) {
  await fn();
  results.push(title);
  console.log(`✓ ${title}`);
}
function unlockSnapshot() {
  let s = emptySnapshot();
  for (const l of allLevels.filter((l) => l.kind === 'walk')) {
    const route = eulerRoute(l, l.fixedStart, l.objective === 'return' ? l.fixedStart : l.fixedEnd);
    let r = {
      ...newRun(l),
      startNode: route.start,
      currentNode: route.start,
      history: [route.start],
    };
    for (const id of route.edges) r = move(l, r, id).run;
    s = recordCompletion(s, l.id, l, r);
  }
  return s;
}
async function pageFor({
  mobile = false,
  unlocked = false,
  storageFails = false,
  normalMotion = false,
} = {}) {
  const context = await browser.newContext(
    mobile
      ? {
          viewport: { width: 390, height: 844 },
          isMobile: true,
          hasTouch: true,
          deviceScaleFactor: 1,
          reducedMotion: 'reduce',
        }
      : {
          viewport: { width: 1440, height: 1000 },
          reducedMotion: normalMotion ? 'no-preference' : 'reduce',
        },
  );
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  if (unlocked)
    await page.addInitScript(
      ({ value, key }) => localStorage.getItem(key) || localStorage.setItem(key, value),
      { value: JSON.stringify(unlockSnapshot()), key: STORAGE_KEY },
    );
  if (storageFails)
    await page.addInitScript(() => {
      Storage.prototype.setItem = function () {
        throw new DOMException('Blocked', 'QuotaExceededError');
      };
    });
  return { context, page };
}
async function keyBridge(page, id) {
  await page.locator(`[data-bridge="${id}"]`).focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(15);
}
async function scenePoint(page, id, t = 0.5) {
  return page.evaluate(
    async ({ id, t }) => {
      const { geometry } = await import('/src/render/geometry.js');
      const { getLevel } = await import('/src/content/levels.js');
      const l = getLevel(document.getElementById('level-number').textContent);
      const g = geometry(l, matchMedia('(max-width:700px)').matches),
        p = g.curves[id].point(t),
        s = document.querySelector('#stage svg'),
        q = new DOMPoint(p.x, p.y).matrixTransform(s.getScreenCTM());
      return { x: q.x, y: q.y };
    },
    { id, t },
  );
}
async function assertTextContrast(page, pairs) {
  const readings = await page.evaluate((checks) => {
    const luminance = (color) => {
      const rgb = color
        .match(/[0-9.]+/g)
        .slice(0, 3)
        .map((part) => Number(part) / 255)
        .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    return checks.map(([foreground, background]) => {
      const ink = getComputedStyle(document.querySelector(foreground)).color;
      const paper = getComputedStyle(document.querySelector(background)).backgroundColor;
      const a = luminance(ink);
      const b = luminance(paper);
      return {
        foreground,
        background,
        ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      };
    });
  }, pairs);
  for (const { foreground, background, ratio } of readings)
    assert.ok(ratio >= 4.5, `${foreground} on ${background}: ${ratio.toFixed(2)}:1`);
}
try {
  const { page, context } = await pageFor();
  await page.goto(`${base}/?lang=en`);
  await page.waitForSelector('[data-bridge]');
  await scenario('Dialog has an accessible name', async () => {
    await page.locator('#settings-button').click();
    const title = await page.locator('#dialog-title').textContent();
    assert.equal(await page.getByRole('dialog', { name: title }).isVisible(), true);
    await page.locator('#dialog-close').click();
  });
  await scenario(
    'Desktop first harbour, click route, undo, reload and completed postcard',
    async () => {
      await page.screenshot({ path: 'test-results/desktop-first-harbour.png', fullPage: true });
      const bridgeLabel = (id) => page.locator(`[data-bridge="${id}"]`).getAttribute('aria-label');
      assert.equal(await bridgeLabel('b1'), 'Bridge b1 to B · North quay, available');
      assert.equal(
        await bridgeLabel('b2'),
        'Bridge b2: B · North quay ↔ C · South quay, not used',
      );
      const p = await scenePoint(page, 'b1');
      await page.mouse.click(p.x, p.y);
      assert.equal(await page.locator('#progress-number').textContent(), '1 / 3');
      await page.locator('#undo-button').click();
      assert.equal(await page.locator('#progress-number').textContent(), '0 / 3');
      await keyBridge(page, 'b1');
      await page.reload();
      assert.equal(await page.locator('#progress-number').textContent(), '1 / 3');
      await keyBridge(page, 'b2');
      await keyBridge(page, 'b3');
      assert.equal(await page.locator('#complete-banner').isVisible(), true);
      assert.equal(await bridgeLabel('b1'), 'Bridge b1: A · Lighthouse ↔ B · North quay, used');
      const completeMessage = await page.locator('#message').textContent();
      await keyBridge(page, 'b1');
      assert.equal(await page.locator('#message').textContent(), completeMessage);
      assert.equal(await page.locator('#complete-banner').isVisible(), true);
      await page.locator('#postcard-button').click();
      const downloadPromise = page.waitForEvent('download');
      await page.locator('[data-action="download"]').click();
      const download = await downloadPromise;
      assert.ok(download.suggestedFilename().endsWith('.png'));
      await download.saveAs('test-results/postcard.png');
      await page.locator('#dialog-close').click();
    },
  );
  await scenario('Postcard share uses the current route option on the first click', async () => {
    await page.evaluate(() => {
      window.__shares = [];
      navigator.canShare = () => true;
      navigator.share = async ({ files }) => {
        window.__shares.push({ active: navigator.userActivation.isActive, size: files[0].size });
      };
    });
    await page.locator('#postcard-button').click();
    const share = page.locator('[data-action="share"]');
    await share.click();
    await page.locator('#include-route').check();
    await share.click();
    const shares = await page.evaluate(() => window.__shares);
    assert.equal(shares.length, 2);
    assert.ok(shares.every((s) => s.active));
    assert.notEqual(shares[0].size, shares[1].size);
    assert.equal(await page.locator('#export-status').textContent(), '');
    await page.locator('#dialog-close').click();
  });
  await scenario('Both themes meet text contrast for map, route and completion UI', async () => {
    for (const theme of ['light', 'dark']) {
      await page.locator('#settings-button').click();
      await page.locator('#theme-select').selectOption(theme);
      await page.locator('#dialog-close').click();
      await assertTextContrast(page, [
        ['.map-topline', '.map-panel'],
        ['.map-bottomline', '.map-panel'],
        ['#route-history', 'body'],
        ['#complete-banner small', '#complete-banner'],
        ['#next-level', '#next-level'],
      ]);
      await page.locator('#map-button').click();
      await assertTextContrast(page, [
        ['.level-card small', '.level-card'],
        ['.level-card strong', '.level-card'],
      ]);
      await page.locator('[data-action="tab:collection"]').click();
      await assertTextContrast(page, [['.stamp', 'dialog']]);
      await page.locator('#dialog-close').click();
    }
    await page.locator('#settings-button').click();
    await page.locator('#theme-select').selectOption('light');
    await page.locator('#dialog-close').click();
  });
  await scenario(
    'Lens preserves the entire logical route and setting preference beats URL',
    async () => {
      const before = await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).runs.SB01,
        STORAGE_KEY,
      );
      await page.locator('#lens-button').click();
      await page.waitForTimeout(20);
      const after = await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).runs.SB01,
        STORAGE_KEY,
      );
      assert.deepEqual(after.walkedEdgeIds, before.walkedEdgeIds);
      await page.locator('#settings-button').click();
      await page.selectOption('#lang-select', 'zh');
      await page.locator('#dialog-close').click();
      await page.goto(`${base}/?lang=en`);
      assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
    },
  );
  await scenario(
    'Replay previews are read-only; rewinding preserves the completed seal',
    async () => {
      await page.locator('#replay-button').click();
      await page.locator('#replay-slider').fill('1');
      await page.locator('#replay-slider').dispatchEvent('input');
      assert.equal(await page.locator('#progress-number').textContent(), '3 / 3');
      await page.locator('[data-action="rewind"]').click();
      assert.equal(await page.locator('#progress-number').textContent(), '1 / 3');
      const saved = await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)),
        STORAGE_KEY,
      );
      assert.ok(saved.completions.SB01.independent);
    },
  );
  await context.close();
  const unlocked = await pageFor({ unlocked: true });
  const p = unlocked.page;
  await p.goto(`${base}/?lang=en#SB24`);
  await p.waitForSelector('[data-bridge]');
  await scenario(
    'Historical discovery has a separate explanation and stamp, never a fake seven-bridge win',
    async () => {
      await p.locator('#begin-discovery').click();
      assert.equal(await p.locator('#counts-button').getAttribute('aria-pressed'), 'false');
      await p.reload();
      assert.equal(await p.locator('#counts-button').getAttribute('aria-pressed'), 'false');
      const discoveryMessage = await p.locator('#message').textContent();
      await keyBridge(p, 'AB1');
      assert.equal(await p.locator('#message').textContent(), discoveryMessage);
      for (const node of ['A', 'B', 'C', 'D']) {
        const island = p.locator(`[data-node="${node}"]`);
        assert.equal(await island.getAttribute('aria-pressed'), 'false');
        await island.focus();
        await p.keyboard.press('Enter');
        assert.equal(await p.locator(`[data-node="${node}"]`).getAttribute('aria-pressed'), 'true');
      }
      await p.screenshot({ path: 'test-results/historical-discovery.png', fullPage: true });
      await p.locator('#explain-discovery').click();
      await p.locator('[data-action="understand"]').click();
      assert.equal(await p.locator('#complete-banner').isVisible(), true);
      const snapshot = await p.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)),
        STORAGE_KEY,
      );
      assert.ok(snapshot.discoveries.SB24.independent);
      assert.equal(snapshot.completions.SB24, undefined);
    },
  );
  await scenario('Nine-bridge construction and protected bridges', async () => {
    await p.goto(`${base}/?lang=en#SB26`);
    await keyBridge(p, 'b1');
    assert.equal(
      await p.locator('#message').textContent(),
      'This bridge is not part of these works.',
    );
    assert.equal(await p.locator('[data-node]').first().getAttribute('role'), 'img');
    await p.goto(`${base}/?lang=en#SB32`);
    await keyBridge(p, 'AB1');
    assert.equal(await p.locator('#message').textContent(), 'This bridge is protected.');
    await p.locator('[data-edit="BC1"]').click();
    await p.locator('[data-edit="AD2"]').click();
    await p.screenshot({ path: 'test-results/night-blueprint.png', fullPage: true });
    await p.locator('#confirm-blueprint').click();
    assert.equal(await p.locator('#progress-number').textContent(), '0 / 9');
    // Focus rests on the crossed bridge; arrows must still reach every choice from B.
    await keyBridge(p, 'AB1');
    const focusedBridge = () =>
      p.evaluate(() => document.activeElement?.closest('[data-bridge]')?.dataset.bridge);
    await p.keyboard.press('ArrowLeft');
    assert.equal(await focusedBridge(), 'BC1');
    await p.keyboard.press('ArrowRight');
    assert.equal(await focusedBridge(), 'AB2');
    for (const id of ['AB2', 'AC1', 'BC1', 'BD', 'CD', 'AC2', 'AD', 'AD2']) await keyBridge(p, id);
    assert.equal(await p.locator('#complete-banner').isVisible(), true);
    assert.match(await p.locator('#complete-banner').textContent(), /Minimal works seal/);
    await p.screenshot({ path: 'test-results/nine-bridges-complete.png', fullPage: true });
  });
  await scenario(
    'Every playable level accepts its independently verified route through keyboard commands',
    async () => {
      for (const l of allLevels.filter((l) => l.kind !== 'discovery')) {
        await p.goto(`${base}/?lang=en&check=${l.id}#${l.id}`);
        await p.waitForSelector('[data-bridge]');
        let route;
        if (l.kind === 'repair') {
          const proof = repairSolution(l);
          if (!(await p.locator('#confirm-blueprint').count())) {
            await p.locator('#edit-blueprint').click();
            await p.locator('[data-action="edit"]').click();
          }
          for (const edit of l.candidateEdits) {
            const button = p.locator(`[data-edit="${edit.id}"]`);
            if (
              (await button.count()) &&
              ((await button.getAttribute('aria-pressed')) === 'true') !==
                proof.ids.includes(edit.id)
            )
              await button.click();
          }
          await p.locator('#confirm-blueprint').click();
          route = proof.route;
        } else {
          await p.locator('#restart-button').click();
          route = eulerRoute(l, l.fixedStart, l.objective === 'return' ? l.fixedStart : l.fixedEnd);
        }
        if (!l.fixedStart) {
          await p.locator(`[data-node="${route.start}"]`).focus();
          await p.keyboard.press('Enter');
        }
        for (const id of route.edges) await keyBridge(p, id);
        assert.equal(await p.locator('#complete-banner').isVisible(), true, l.id);
      }
    },
  );
  await scenario(
    'Daily assistance survives restart and its frozen identity survives reload',
    async () => {
      await p.goto(`${base}/?lang=en#daily/2026-10-12/walk`);
      await p.locator('#hint-button').click();
      await p.locator('#restart-button').click();
      const identity = p.url().split('#')[1];
      await p.reload();
      assert.equal(p.url().split('#')[1], identity);
      const saved = await p.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
      assert.equal(saved.runs['daily:2026-10-12:1:walk'].assistance, true);
    },
  );
  await scenario(
    'Disconnected engineering drafts stay in planning; commission completion returns to works',
    async () => {
      await p.goto(`${base}/?lang=en#EC07`);
      if (!(await p.locator('#confirm-blueprint').count())) {
        await p.locator('#edit-blueprint').click();
        await p.locator('[data-action="edit"]').click();
      }
      for (const edit of getLevel('EC07').candidateEdits) {
        const button = p.locator(`[data-edit="${edit.id}"]`);
        if ((await button.getAttribute('aria-pressed')) === 'true') await button.click();
      }
      await p.locator('#confirm-blueprint').click();
      assert.equal(await p.locator('#confirm-blueprint').isVisible(), true);
      await p.locator('[data-edit="CD"]').click();
      await p.locator('#confirm-blueprint').click();
      await p.locator('[data-node="C"]').focus();
      await p.keyboard.press('Enter');
      const proof = repairSolution(getLevel('EC07'));
      for (const id of proof.route.edges) await keyBridge(p, id);
      assert.equal(await p.locator('#complete-banner').isVisible(), true);
      await p.locator('#next-level').click();
      assert.match(await p.locator('[data-action="tab:works"]').getAttribute('class'), /primary/);
      assert.ok(p.url().endsWith('#EC07'));
      await p.locator('#dialog-close').click();
    },
  );
  await scenario(
    'Required endpoints have consistent objective copy in both map and journal',
    async () => {
      await p.goto(`${base}/?lang=en#SB23`);
      for (const id of ['objective', 'stage-note']) {
        const text = await p.locator(`#${id}`).textContent();
        assert.match(text, /required endpoints/);
        assert.doesNotMatch(text, /finish anywhere/);
      }
    },
  );
  await scenario('Free-start circuit hints never claim an odd island exists', async () => {
    await p.goto(`${base}/?lang=en#SB10`);
    await p.locator('#restart-button').click();
    await p.locator('#hint-button').click();
    assert.equal(await p.locator('#message').textContent(), 'Choose an island to start.');
    await p.goto(`${base}/?lang=en#SB04`);
    await p.locator('#restart-button').click();
    await p.locator('#hint-button').click();
    assert.equal(
      await p.locator('#message').textContent(),
      'Try starting at an island with an unpaired end.',
    );
  });
  await unlocked.context.close();
  const mobile = await pageFor({ mobile: true });
  await mobile.page.goto(`${base}/?lang=zh`);
  await mobile.page.waitForSelector('[data-bridge]');
  await scenario(
    'Mobile sparse drag commits once, release keeps progress, rotation preserves graph',
    async () => {
      await mobile.page.screenshot({
        path: 'test-results/mobile-first-harbour.png',
        fullPage: true,
      });
      const a = await scenePoint(mobile.page, 'b1', 0),
        b = await scenePoint(mobile.page, 'b1', 1);
      await mobile.page.mouse.move(a.x, a.y);
      await mobile.page.mouse.down();
      await mobile.page.mouse.move(b.x, b.y, { steps: 1 });
      await mobile.page.mouse.up();
      assert.equal(await mobile.page.locator('#progress-number').textContent(), '1 / 3');
      await mobile.page.setViewportSize({ width: 844, height: 390 });
      await mobile.page.waitForTimeout(30);
      assert.equal(await mobile.page.locator('#progress-number').textContent(), '1 / 3');
      assert.equal(
        await mobile.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await mobile.page.screenshot({ path: 'test-results/mobile-landscape.png', fullPage: true });
    },
  );
  await scenario(
    'Touch can choose a free starting island and all four discovery endpoints',
    async () => {
      await mobile.page.setViewportSize({ width: 390, height: 844 });
      await mobile.page.goto(`${base}/?lang=zh#EC07`);
      await mobile.page.locator('[data-edit="CD"]').tap();
      await mobile.page.locator('#confirm-blueprint').tap();
      await mobile.page.locator('[data-node="C"] .node-dot').tap();
      const before = await mobile.page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).runs.EC07,
        STORAGE_KEY,
      );
      assert.equal(before.startNode, 'C');
      const historyTouch = await pageFor({ mobile: true, unlocked: true });
      await historyTouch.page.goto(`${base}/?lang=zh#SB24`);
      await historyTouch.page.locator('#begin-discovery').tap();
      for (const node of ['A', 'B', 'C', 'D'])
        await historyTouch.page.locator(`[data-node="${node}"] .node-dot`).tap();
      const selected = await historyTouch.page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).runs.SB24.discoveryNodes,
        STORAGE_KEY,
      );
      assert.deepEqual(selected, ['A', 'B', 'C', 'D']);
      await historyTouch.context.close();
    },
  );
  await mobile.context.close();
  const failure = await pageFor({ storageFails: true });
  await failure.page.goto(base);
  await scenario('Persistence failure is visible while play remains usable', async () => {
    assert.equal(await failure.page.locator('#save-warning').isVisible(), true);
    await keyBridge(failure.page, 'b1');
    assert.equal(await failure.page.locator('#progress-number').textContent(), '1 / 3');
    assert.equal(await failure.page.locator('#save-warning').isVisible(), true);
  });
  await failure.context.close();
  const motionCase = await pageFor({ normalMotion: true });
  const motionPage = motionCase.page;
  await motionPage.addInitScript(() => {
    window.rafRequests = 0;
    const raf = requestAnimationFrame;
    window.requestAnimationFrame = (callback) => {
      window.rafRequests++;
      return raf(callback);
    };
  });
  await motionPage.goto(`${base}/?lang=en`);
  await scenario(
    'Animation has one buffered intent; undo and background cancel pending moves',
    async () => {
      await keyBridge(motionPage, 'b1');
      await keyBridge(motionPage, 'b2');
      await keyBridge(motionPage, 'b3');
      await motionPage.waitForTimeout(800);
      assert.equal(await motionPage.locator('#progress-number').textContent(), '1 / 3');
      await motionPage.locator('#undo-button').click();
      await keyBridge(motionPage, 'b1');
      await keyBridge(motionPage, 'b2');
      await motionPage.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await motionPage.waitForTimeout(400);
      await motionPage.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: false });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      assert.equal(await motionPage.locator('#progress-number').textContent(), '1 / 3');
      await motionPage.locator('#lens-button').click();
      await motionPage.locator('#undo-button').click();
      await motionPage.waitForTimeout(500);
      assert.equal(await motionPage.locator('.morphing').count(), 0);
      assert.equal(await motionPage.locator('#progress-number').textContent(), '0 / 3');
      const idle = await motionPage.evaluate(() => window.rafRequests);
      await motionPage.waitForTimeout(150);
      assert.equal(await motionPage.evaluate(() => window.rafRequests), idle);
      // Opening a dialog mid-walk cancels the animation without leaving the messenger mid-bridge.
      await keyBridge(motionPage, 'b1');
      await motionPage.locator('#settings-button').click();
      await motionPage.locator('#dialog-close').click();
      const [placed, expected] = await motionPage.evaluate(async () => {
        const { geometry } = await import('/src/render/geometry.js');
        const { getLevel } = await import('/src/content/levels.js');
        const b = geometry(getLevel('SB01'), matchMedia('(max-width:700px)').matches).nodes.B;
        return [
          document.querySelector('.traveler').getAttribute('transform'),
          `translate(${b.x},${b.y})`,
        ];
      });
      assert.equal(placed, expected);
    },
  );
  await scenario(
    'Selecting a different level during a morph cannot retain the input lock',
    async () => {
      await motionPage.locator('#lens-button').click();
      await motionPage.evaluate(() => (location.hash = 'SB02'));
      await motionPage.waitForTimeout(50);
      assert.equal(await motionPage.locator('.morphing').count(), 0);
      await keyBridge(motionPage, 'b2');
      assert.equal(await motionPage.locator('#progress-number').textContent(), '1 / 7');
    },
  );
  await motionCase.context.close();
  const performanceCase = await pageFor({ unlocked: true });
  const perfPage = performanceCase.page;
  await perfPage.goto(`${base}/?lang=en#SB22`);
  await scenario(
    'Largest campaign and engineering maps fit 320px; model budget under CPU throttling',
    async () => {
      await perfPage.setViewportSize({ width: 320, height: 740 });
      assert.equal(
        await perfPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await perfPage.screenshot({
        path: 'test-results/mobile-320-complex-map.png',
        fullPage: true,
      });
      await perfPage.goto(`${base}/?lang=zh#SB32`);
      await perfPage.screenshot({
        path: 'test-results/mobile-320-engineering.png',
        fullPage: true,
      });
      const cdp = await performanceCase.context.newCDPSession(perfPage);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
      const metrics = await perfPage.evaluate(async () => {
        const { allLevels } = await import('/src/content/levels.js');
        const { newRun, move } = await import('/src/model/commands.js');
        const { eulerRoute } = await import('/src/model/euler.js');
        const { applyEdits, repairSolution } = await import('/src/model/repair.js');
        const times = [];
        for (let repeat = 0; repeat < 60; repeat++)
          for (const l of allLevels.filter((l) => l.kind !== 'discovery')) {
            const proof = l.kind === 'repair' ? repairSolution(l) : null,
              graph = proof ? applyEdits(l, proof.ids).graph : l,
              route =
                proof?.route ??
                eulerRoute(l, l.fixedStart, l.objective === 'return' ? l.fixedStart : l.fixedEnd);
            let run = {
              ...newRun(l),
              phase: 'walking',
              startNode: route.start,
              currentNode: route.start,
              history: [route.start],
            };
            for (const id of route.edges) {
              const begin = performance.now();
              run = move(graph, run, id).run;
              times.push(performance.now() - begin);
            }
          }
        times.sort((a, b) => a - b);
        return {
          samples: times.length,
          p95: times[Math.floor(times.length * 0.95)],
          max: times.at(-1),
          mean: times.reduce((a, b) => a + b, 0) / times.length,
          cpuThrottle: 6,
        };
      });
      assert.ok(metrics.p95 < 8, JSON.stringify(metrics));
      await writeFile('test-results/model-performance.json', JSON.stringify(metrics, null, 2));
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    },
  );
  await performanceCase.context.close();
  const invalidSave = await pageFor();
  await invalidSave.page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: STORAGE_KEY,
    value: JSON.stringify({ ...emptySnapshot(), lastLevel: 1 }),
  });
  await invalidSave.page.goto(base);
  await scenario('Malformed lastLevel cannot prevent startup', async () => {
    assert.equal(await invalidSave.page.locator('#level-number').textContent(), 'SB01');
    assert.equal(await invalidSave.page.locator('#progress-number').textContent(), '0 / 3');
  });
  await invalidSave.context.close();
  const corruptSave = await pageFor();
  await corruptSave.page.addInitScript((key) => localStorage.setItem(key, '{}'), STORAGE_KEY);
  await corruptSave.page.goto(base);
  await scenario('Malformed saved data can recover through normal gameplay', async () => {
    await keyBridge(corruptSave.page, 'b1');
    assert.equal(await corruptSave.page.locator('#progress-number').textContent(), '1 / 3');
    const saved = await corruptSave.page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      STORAGE_KEY,
    );
    assert.equal(saved.version, 1);
    assert.deepEqual(saved.runs.SB01.walkedEdgeIds, ['b1']);
    assert.equal(await corruptSave.page.locator('#save-warning').isVisible(), false);
  });
  await corruptSave.context.close();
  const invalidKey = await pageFor();
  const invalidValue = JSON.stringify({
    ...emptySnapshot(),
    lastLevel: 'daily:2026-10-12:1:constructor',
  });
  await invalidKey.page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: STORAGE_KEY,
    value: invalidValue,
  });
  await invalidKey.page.goto(base);
  await scenario('Malformed daily key cannot crash startup', async () => {
    assert.equal(await invalidKey.page.locator('#level-number').textContent(), 'SB01');
  });
  await invalidKey.context.close();
  const locked = await pageFor();
  const lockedValue = JSON.stringify({ ...emptySnapshot(), lastLevel: 'SB10' });
  await locked.page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: STORAGE_KEY,
    value: lockedValue,
  });
  await locked.page.goto(`${base}/#SB10`);
  await scenario('Locked saved campaign level cannot bypass progression', async () => {
    assert.equal(await locked.page.locator('#level-number').textContent(), 'SB01');
  });
  await locked.context.close();
  const dailyResume = await pageFor();
  const dailyValue = JSON.stringify({
    ...emptySnapshot(),
    lastLevel: 'daily:2026-10-17:1:repair',
  });
  await dailyResume.page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: STORAGE_KEY,
    value: dailyValue,
  });
  await dailyResume.page.goto(base);
  await scenario('Valid weekend work resumes without campaign progression', async () => {
    assert.equal(await dailyResume.page.locator('#level-number').textContent(), '2026-10-17');
    assert.ok(dailyResume.page.url().endsWith('#daily/2026-10-17/repair'));
  });
  await dailyResume.context.close();
  assert.deepEqual(errors, []);
  await writeFile(
    'test-results/browser-summary.json',
    JSON.stringify({ passed: results, pageErrors: errors }, null, 2),
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
