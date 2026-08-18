// Quick Playwright diagnostic for the workspace map page.
// Captures: page errors, console errors, network failures, and
// whether the MapLibre canvas + tiles actually rendered.

const { chromium } = require('/usr/local/lib/node_modules/playwright');

// The system-installed Playwright looks for the browser in
// /workspace/.home/.cache/ms-playwright/, but the actual binary
// is at /root/.cache/ms-playwright/chromium-1223/chrome-linux/.
// Easiest fix: use executablePath to point to the real binary.
const EXEC = '/root/.cache/ms-playwright/chromium-1223/chrome-linux/chrome';

const TARGET = process.env.TARGET_URL || 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const tileRequests = [];

  page.on('console', (msg) => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', (err) => {
    pageErrors.push({ name: err.name, message: err.message, stack: err.stack });
  });
  page.on('requestfailed', (req) => {
    failedRequests.push({ url: req.url(), method: req.method(), failure: req.failure()?.errorText });
  });
  page.on('response', (resp) => {
    const url = resp.url();
    if (url.includes('tile.openstreetmap.org')) {
      tileRequests.push({ url, status: resp.status() });
    }
  });

  // Sign in via Clerk's hosted form is hard from headless. We'll
  // hit a public page first to confirm the server is up, then
  // hit the map page and see what we get (likely redirected to
  // /sign-in).
  console.log('--- Loading public root ---');
  const rootResp = await page.goto(TARGET + '/', { waitUntil: 'networkidle', timeout: 30000 });
  console.log('Root HTTP:', rootResp.status());
  console.log('Final URL:', page.url());

  // Try the map page directly — even if we get redirected to
  // /sign-in, we'll see what the unauth render looks like
  console.log('\n--- Loading /w/udgok/map ---');
  const mapResp = await page.goto(TARGET + '/w/udgok/map', { waitUntil: 'networkidle', timeout: 30000 });
  console.log('Map page HTTP:', mapResp?.status());
  console.log('Final URL after map page:', page.url());

  // Give the dynamic import + map a chance to fail
  await page.waitForTimeout(3000);

  // Look for the MapContainer's div — it has class .maplibregl-map
  // after the map initializes. Without init, the div is just our
  // raw container.
  const mapDivInfo = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('div'));
    // Find the div with width/height between 400-800px
    const candidates = els.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 400 && r.height > 400 && r.width < 2000;
    });
    return candidates.slice(0, 5).map((el) => ({
      className: el.className,
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height,
      childCount: el.children.length,
      hasCanvas: !!el.querySelector('canvas'),
      hasMaplibreRoot: !!el.querySelector('.maplibregl-map'),
    }));
  });

  // Take a screenshot of just the map area
  await page.screenshot({ path: '/workspace/map-diagnose.png', fullPage: true });

  console.log('\n=== Console messages ===');
  for (const m of consoleMessages) console.log(`[${m.type}] ${m.text}`);

  console.log('\n=== Page errors ===');
  for (const e of pageErrors) console.log(`[${e.name}] ${e.message}\n${e.stack || ''}`);

  console.log('\n=== Failed requests ===');
  for (const r of failedRequests) console.log(`${r.method} ${r.url} → ${r.failure}`);

  console.log('\n=== Tile requests (OSM) ===');
  for (const t of tileRequests) console.log(`${t.status} ${t.url}`);

  console.log('\n=== Map div candidates ===');
  for (const d of mapDivInfo) console.log(JSON.stringify(d));

  await browser.close();
})().catch((e) => {
  console.error('DIAGNOSE FAILED:', e);
  process.exit(1);
});
