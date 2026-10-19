// Regenerate the checked-in cover from the production renderer after an art change.
// This is deliberately separate from the static build: deployment needs no browser.
import { chromium } from 'playwright';
import { serve } from '../serve.mjs';
import { getLevel } from '../../src/content/levels.js';
import { newRun } from '../../src/model/commands.js';
import { geometry } from '../../src/render/geometry.js';
import { citySVG } from '../../src/render/city.js';

const server = await serve({ port: 0 });
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {}),
  });
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  const level = getLevel('SB24');
  const scene = citySVG(level, level, newRun(level), geometry(level), {
    lang: 'en',
    interactive: false,
  });
  await page.setContent(
    `<!doctype html><html lang="en"><head>
    <link rel="stylesheet" href="http://127.0.0.1:${server.address().port}/src/style.css">
    <style>
      body { width:1200px; height:630px; display:grid; grid-template-columns:300px 1fr; gap:24px; padding:32px; }
      .cover-copy { display:flex; flex-direction:column; justify-content:center; padding:16px; }
      .cover-mark { width:52px; height:36px; fill:none; stroke:#447e7a; stroke-width:2; margin-bottom:24px; }
      h1 { font:56px/1.05 Georgia,serif; letter-spacing:-1px; margin:0 0 26px; }
      .cover-kicker { font:11px/1.6 Arial,sans-serif; letter-spacing:2px; color:#447e7a; }
      .cover-copy p { font:16px/1.8 Arial,sans-serif; color:#596968; margin:12px 0; }
      .cover-map { align-self:stretch; display:flex; flex-direction:column; overflow:hidden; border:1px solid #b8cdd0; border-radius:16px; background:#c2dcdf; }
      .cover-label { padding:18px 22px; display:flex; justify-content:space-between; font:10px Arial,sans-serif; letter-spacing:1.6px; color:#2b4c53; }
      .cover-scene { flex:1; display:grid; place-items:center; overflow:hidden; }
      .cover-scene .city-scene { width:100%; height:auto; max-height:none; }
    </style></head><body>
    <div class="cover-copy"><svg class="cover-mark" viewBox="0 0 40 28" aria-hidden="true"><path d="M3 19h34M7 19q13-15 26 0M13.5 19v-5.5M20 19v-7.5M26.5 19v-5.5M4 25q4-2.4 8 0t8 0t8 0t8 0"/></svg>
      <h1>Seven<br>Bridges</h1><div class="cover-kicker">CROSS EVERY BRIDGE JUST ONCE.</div>
      <p>Read a city.<br>Build a new way.</p><div class="cover-kicker">A CITY, ONE JOURNEY</div>
    </div><div class="cover-map"><div class="cover-label"><span>THE CITY OF SEVEN BRIDGES</span><span>CITY ATLAS</span></div>
    <div class="cover-scene">${scene}</div><div class="cover-label"><span>EST. 1736</span><span>MADE FOR WANDERING</span></div></div>
    </body></html>`,
    { waitUntil: 'networkidle' },
  );
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'public/og.png' });
  console.log('Updated public/og.png (1200 × 630) using the current city renderer.');
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
