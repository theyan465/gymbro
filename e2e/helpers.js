'use strict';
// Shared helpers for the e2e suite: static server for the repo root + a Playwright page in offline (no Supabase) mode.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

function serve() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok({ srv, url: `http://127.0.0.1:${srv.address().port}/` })));
}

// opts: { lang: 'ru'|'uk'|'en'|'pl', width, height, state }  (state = object stored as gymbro.v1)
async function open(browser, url, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: opts.width || 390, height: opts.height || 844 }, serviceWorkers: 'block', locale: 'ru-RU' });
  const page = await ctx.newPage(); page.errs = [];
  page.on('pageerror', e => page.errs.push(e.message));
  page.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && page.errs.push(m.text()));
  await page.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.GYMBRO_CONFIG={}' })); // no cloud: pure local mode
  await page.addInitScript(([lang, state]) => {
    try { localStorage.setItem('gymbro.lang', lang); if (state) localStorage.setItem('gymbro.v1', JSON.stringify(state)); } catch { /* ignore */ }
  }, [opts.lang || 'ru', opts.state || null]);
  await page.goto(url); await page.waitForSelector('#tabs button');
  return page;
}
module.exports = { chromium, serve, open, ROOT };
