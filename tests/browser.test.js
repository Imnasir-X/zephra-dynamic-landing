/*!
 * tests/browser.test.js - runs the in-browser DOM suite shipped in demo.html
 * (demo-console.js) inside headless Chromium and fails if any check fails.
 *
 *   npx playwright install chromium   # once
 *   npm run test:browser
 *
 * Set CHROMIUM_PATH to use an already-installed Chromium binary.
 */
'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

let server, base, browser;

before(async () => {
  server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.normalize(path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
});

after(async () => {
  if (browser) await browser.close();
  if (server) server.close();
});

async function openPage(url) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Third-party web fonts are cosmetic; keep the suite hermetic.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  await page.goto(base + url, { waitUntil: 'load' });
  return { page, errors };
}

test('in-browser DOM suite in demo.html passes', async () => {
  const { page, errors } = await openPage('/demo.html');
  const summary = await page.waitForSelector('.t-sum', { timeout: 10000 }).then((el) => el.textContent());
  const failed = await page.$$eval('.t-row.fail', (rows) => rows.map((r) => r.textContent));
  assert.deepEqual(failed, [], 'failing in-browser checks: ' + failed.join(' | '));
  const m = /^(\d+)\/(\d+) PASSING$/.exec(summary.trim());
  assert.ok(m && m[1] === m[2] && Number(m[2]) > 0, 'unexpected summary: ' + summary);
  assert.deepEqual(errors, []);
  await page.close();
});

test('index.html personalizes from the URL and stays fail-open', async () => {
  const cases = [
    ['/index.html', 'RFID Solutions for Your Business'],
    ['/index.html?source=google&keyword=rfid-tool-tracking', 'Track Every Tool With RFID'],
    ['/index.html?keyword=random-value', 'RFID Solutions for Your Business'],
  ];
  for (const [url, headline] of cases) {
    const { page, errors } = await openPage(url);
    const h1 = await page.textContent('[data-dl="headline"]');
    assert.equal(h1.trim(), headline, url);
    assert.deepEqual(errors, [], url);
    await page.close();
  }
});

test('index.html has no horizontal overflow on a 390px phone viewport', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  assert.ok(sw <= cw, 'page scrolls horizontally: ' + sw + ' > ' + cw);
  await page.close();
});
