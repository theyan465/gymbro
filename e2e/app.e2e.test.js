'use strict';
// End-to-end tests of the GymBro PWA in a real (headless) Chromium, offline/local mode (no Supabase).
// Run: npm install && npx playwright install chromium && npm run test:e2e
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { chromium, serve, open, ROOT } = require('./helpers');

let srv, url, browser;
before(async () => { ({ srv, url } = await serve()); browser = await chromium.launch(); });
after(async () => { await browser.close(); srv.close(); });

// run a test body with a fresh page, always closing the context and asserting no JS errors
const withPage = (opts, fn) => async () => {
  const page = await open(browser, url, opts);
  try { await fn(page); assert.deepEqual(page.errs, [], 'no page errors'); } finally { await page.context().close(); }
};
const state = (page, expr) => page.evaluate(expr);
const FOOD = (o = {}) => ({ id: 'f1', name: 'Овсянка', kcal: 350, p: 12, f: 6, c: 60, ...o });

test('boots: six tabs, no errors', withPage({}, async page => {
  assert.equal(await page.locator('#tabs button').count(), 6);
  await page.click('[data-tab=food]'); await page.waitForSelector('#view');
  await page.click('[data-tab=train]');
  assert.ok((await page.locator('#view').innerText()).length > 0);
}));

test('quick entry adds a meal with kcal from macros', withPage({}, async page => {
  await page.evaluate(() => quickEntry());
  await page.fill('#qn', 'Ужин в кафе'); await page.fill('#qk', '500'); await page.fill('#qf', '20'); await page.fill('#qc', '50'); await page.fill('#qp', '30');
  await page.click('#qok'); await page.waitForTimeout(900);
  const m = await state(page, 'S.meals.map(m => [m.name, m.kcal])');
  assert.deepEqual(m, [['Ужин в кафе', 500]]);
}));

test('new product via form is saved (local mode has no "share" checkbox)', withPage({}, async page => {
  await page.evaluate(() => pickFood());
  await page.click('#newf');
  assert.equal(await page.locator('#fshare').count(), 0);
  await page.fill('#fn', 'Йогурт'); await page.fill('#fk', '60'); await page.fill('#ff', '2'); await page.fill('#fc', '8'); await page.fill('#fp', '4');
  await page.click('#ok'); await page.waitForTimeout(900);
  assert.deepEqual(await state(page, 'S.foods.map(f => [f.name, f.kcal, f.p])'), [['Йогурт', 60, 4]]);
}));

test('picker: Products / Dishes tabs separate foods from dishes, search hint jumps to dishes', withPage({
  state: { foods: [FOOD(), { id: 'd1', name: 'Омлет', kcal: 150, p: 10, f: 10, c: 2, dish: { items: [{ n: 'Яйцо', g: 100, kcal: 150, p: 10, f: 10, c: 2 }], cooked: 0 } }] },
}, async page => {
  await page.evaluate(() => pickFood());
  let list = await page.locator('#flist').innerText();
  assert.match(list, /Овсянка/); assert.doesNotMatch(list, /Омлет/);
  assert.match(await page.locator('#ptabs').innerText(), /Продукты · 1[\s\S]*Блюда · 1/);
  await page.click('#ptabs [data-t=d]');
  list = await page.locator('#flist').innerText();
  assert.match(list, /Омлет/); assert.doesNotMatch(list, /Овсянка/);
  assert.equal(await page.locator('#dnew').count(), 1);
  await page.click('#ptabs [data-t=p]'); await page.fill('#q', 'омл');
  await page.click('#todish');                                  // "found in dishes" hint
  assert.match(await page.locator('#flist').innerText(), /Омлет/);
  assert.equal(await page.locator('#pscan').count(), 1);        // barcode + label live under the search
  assert.equal(await page.locator('#pocr').count(), 1);
}));

test('dish builder: add a product with grams, totals per 100 g, save as dish', withPage({ state: { foods: [FOOD({ id: 'a', name: 'Яйцо', kcal: 150, p: 12, f: 10, c: 1 })] } }, async page => {
  await page.evaluate(() => dishEditor({ name: '', items: [], cooked: '' }));
  assert.equal(await page.locator('#dshare').count(), 0);        // offline: no share box
  await page.fill('#dn', 'Омлет');
  await page.click('#dadd');
  assert.equal(await page.locator('#pscan').count(), 1);        // scanner is available when building a dish
  await page.click('#flist [data-id=a]'); await page.fill('#ag', '200'); await page.click('#agok');
  await page.click('#dsave'); await page.waitForTimeout(900);
  const d = await state(page, 'S.foods.find(f => f.dish)');
  assert.equal(d.name, 'Омлет'); assert.equal(d.kcal, 150); assert.equal(d.dish.items[0].g, 200);
}));

test('renaming a product from the picker renames its logged entries', withPage({
  state: { foods: [FOOD({ id: 'a' })], meals: [{ id: 'm1', date: new Date().toISOString().slice(0, 10), name: 'Овсянка', fid: 'a', g: 50, kcal: 175, p: 6, f: 3, c: 30, type: 'breakfast' }] },
}, async page => {
  await page.evaluate(() => { day = S.meals[0].date; pickFood(); });
  await page.click('#flist [data-editfood=a]');
  await page.fill('#fn', 'Овсянка Геркулес'); await page.click('#ok'); await page.waitForTimeout(900);
  assert.deepEqual(await state(page, '[S.foods[0].name, S.meals[0].name]'), ['Овсянка Геркулес', 'Овсянка Геркулес']);
}));

for (const width of [340, 390, 700, 900]) {
  test(`template editor layout at ${width}px: name uses the width, ✕ on the right`, withPage({ width, state: { templates: [{ id: 't1', name: 'фулл', exercises: [{ name: 'Тяга верхнего блока', plan: [{ w: 60, r: 10 }] }, { name: 'Жим лёжа', plan: [] }] }] } }, async page => {
    await page.evaluate(() => tplEditor({ id: 't1', name: 'фулл', exercises: JSON.parse(JSON.stringify(S.templates[0].exercises)) }));
    const row = await page.locator('.tex').first().boundingBox(), name = await page.locator('.tex .texh b').first().boundingBox(), x = await page.locator('.tex .texh .btn').first().boundingBox();
    assert.ok(name.width > row.width * 0.5, `exercise name is wide (${name.width} of ${row.width})`);
    assert.ok(x.x > name.x, 'delete button is to the right of the name');
    assert.ok(x.x + x.width <= row.x + row.width + 1, 'delete button inside the card');
    const inp = await page.locator('.tex input[data-plan]').first().boundingBox();
    assert.ok(inp.width > row.width * 0.8, 'plan input is full width');
  }));
}

test('template: superset toggle + video link are stored and shown', withPage({ state: { templates: [{ id: 't1', name: 'A', exercises: [{ name: 'Жим лёжа', plan: [] }, { name: 'Разводка', plan: [] }] }] } }, async page => {
  await page.evaluate(() => tplEditor({ id: 't1', name: 'A', exercises: JSON.parse(JSON.stringify(S.templates[0].exercises)) }));
  assert.equal(await page.locator('[data-tss]').count(), 1);     // only from the 2nd exercise on
  await page.click('[data-tss="1"]');
  assert.match(await page.locator('[data-tss="1"]').innerText(), /Суперсет с предыдущим/);
  await page.click('[data-tlink="0"]');
  await page.fill('#vl', 'это не ссылка'); await page.click('#vok');
  assert.match(await page.locator('#verr').innerText(), /не похоже на ссылку/);
  await page.fill('#vl', 'https://youtube.com/watch?v=abc'); await page.click('#vok'); await page.waitForTimeout(600);
  assert.equal(await state(page, 'S.exLinks["Жим лёжа"]'), 'https://youtube.com/watch?v=abc');
  assert.match(await page.locator('[data-tlink="0"]').innerText(), /Видео ✓/);
  await page.fill('#tn', 'A'); await page.click('#tsave'); await page.waitForTimeout(600);
  assert.equal(await state(page, 'S.templates[0].exercises[1].withPrev'), true);
}));

test('javascript: and data: video links are rejected', withPage({}, async page => {
  const r = await page.evaluate(() => [cleanUrl('javascript:alert(1)'), cleanUrl('data:text/html,hi'), cleanUrl('https://youtu.be/x'), cleanUrl('example.com/v')]);
  assert.equal(r[0], ''); assert.equal(r[1], ''); assert.equal(r[2], 'https://youtu.be/x'); assert.match(r[3], /^https:\/\/example\.com/);
}));

for (const lang of ['en', 'uk', 'pl']) {
  test(`localization ${lang}: picker and food tab have no Russian left`, withPage({ lang, state: { foods: [FOOD({ name: 'Oats' })] } }, async page => {
    await page.click('[data-tab=food]'); await page.waitForTimeout(300);
    await page.evaluate(() => pickFood()); await page.waitForTimeout(300);
    await page.click('#ptabs [data-t=d]'); await page.waitForTimeout(200);
    for (const sel of ['#tabs', '#view', '#sheet']) {
      const t = await page.locator(sel).innerText();
      const ru = lang === 'uk' ? /[ыэёъ]/i : /[А-Яа-яЁё]/;             // Ukrainian shares Cyrillic; look for Russian-only letters
      assert.doesNotMatch(t, ru, `${sel} still contains Russian: ${t.slice(0, 120)}`);
    }
  }));
}

test('PWA: service worker caches every listed asset and the version is bumped format', async () => {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  assert.match(sw, /const CACHE = 'gymbro-v\d+'/);
  const assets = JSON.parse(/const ASSETS = (\[[^\]]*\])/.exec(sw)[1].replace(/'/g, '"'));
  for (const a of assets) if (a !== './') assert.ok(fs.existsSync(path.join(ROOT, a)), `missing asset ${a}`);
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const m of html.matchAll(/(?:src|href)="([^":]+\.(?:js|css|png|json))"/g)) assert.ok(fs.existsSync(path.join(ROOT, m[1])), `index.html references missing ${m[1]}`);
});
