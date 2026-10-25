'use strict';

// ---------- storage ----------
const KEY = 'gymbro.v1';
const DEFAULTS = { foods: [], meals: [], goals: { kcal: 2200, p: 150, f: 70, c: 250 }, workouts: [], body: [] };
let S;
try { S = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { S = structuredClone(DEFAULTS); }
const save = () => localStorage.setItem(KEY, JSON.stringify(S));
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();

// ---------- helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };
const r1 = n => Math.round(n * 10) / 10;
const dkey = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
const today = () => dkey(new Date());
const shiftDay = (k, n) => { const d = new Date(k + 'T12:00:00'); d.setDate(d.getDate() + n); return dkey(d); };
const fmtDay = k => k === today() ? 'Сегодня' : new Date(k + 'T12:00:00').toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
const e1rm = (w, r) => r <= 0 ? 0 : r === 1 ? w : w * (1 + r / 30); // Epley

let tab = 'food', day = today(), statSel = { ex: null, m: 'weight' };

// ---------- sheet ----------
function sheet(html, mount) {
  const el = $('#sheet'), p = $('.panel', el);
  p.innerHTML = html; el.hidden = false;
  mount && mount(p);
  return p;
}
function closeSheet() { stopScanner(); $('#sheet').hidden = true; $('#sheet .panel').innerHTML = ''; }
$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet(); });

// ---------- chart ----------
function chart(canvas, series, opts = {}) {
  const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const g = canvas.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, W, H);
  const pts = series.filter(p => isFinite(p.y));
  if (pts.length < 1) { g.fillStyle = '#8b95a3'; g.font = '14px sans-serif'; g.textAlign = 'center'; g.fillText('Нет данных', W / 2, H / 2); return; }
  const L = 38, R = 8, T = 10, B = 20;
  let ys = pts.map(p => p.y), lo = Math.min(...ys), hi = Math.max(...ys);
  if (opts.zero) lo = 0;
  if (hi === lo) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * 0.1; if (!opts.zero) { lo -= pad; } hi += pad;
  const xs = pts.map(p => p.x), x0 = Math.min(...xs), x1 = Math.max(...xs) || 1;
  const X = x => L + (x1 === x0 ? (W - L - R) / 2 : (x - x0) / (x1 - x0) * (W - L - R));
  const Y = y => T + (1 - (y - lo) / (hi - lo)) * (H - T - B);
  g.strokeStyle = '#2a313b'; g.fillStyle = '#8b95a3'; g.font = '11px sans-serif'; g.textAlign = 'right';
  for (let i = 0; i <= 3; i++) { const v = lo + (hi - lo) * i / 3, y = Y(v); g.beginPath(); g.moveTo(L, y); g.lineTo(W - R, y); g.stroke(); g.fillText(Math.round(v * 10) / 10, L - 4, y + 4); }
  g.textAlign = 'center';
  const fx = x => new Date(x).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  g.fillText(fx(x0), L + 14, H - 5); if (x1 !== x0) g.fillText(fx(x1), W - R - 14, H - 5);
  const col = opts.color || '#4ade80';
  if (opts.bars) {
    const bw = Math.max(3, Math.min(24, (W - L - R) / pts.length * 0.7));
    g.fillStyle = col; pts.forEach(p => { const y = Y(p.y); g.fillRect(X(p.x) - bw / 2, y, bw, Y(lo) - y); });
    if (opts.line != null) { g.strokeStyle = '#fbbf24'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(L, Y(opts.line)); g.lineTo(W - R, Y(opts.line)); g.stroke(); g.setLineDash([]); }
  } else {
    g.strokeStyle = col; g.lineWidth = 2; g.beginPath();
    pts.forEach((p, i) => i ? g.lineTo(X(p.x), Y(p.y)) : g.moveTo(X(p.x), Y(p.y))); g.stroke();
    g.fillStyle = col; pts.forEach(p => { g.beginPath(); g.arc(X(p.x), Y(p.y), 3, 0, 7); g.fill(); });
  }
}
const ts = k => new Date(k + 'T12:00:00').getTime();

// ---------- nutrition ----------
const sumMeals = k => S.meals.filter(m => m.date === k).reduce((a, m) => (a.kcal += m.kcal, a.p += m.p, a.f += m.f, a.c += m.c, a), { kcal: 0, p: 0, f: 0, c: 0 });
const per = (food, g) => ({ kcal: food.kcal * g / 100, p: food.p * g / 100, f: food.f * g / 100, c: food.c * g / 100 });

function viewFood() {
  const t = sumMeals(day), g = S.goals, meals = S.meals.filter(m => m.date === day);
  const pct = (v, goal) => Math.min(100, goal ? v / goal * 100 : 0);
  const mac = (n, v, goal, c) => `<div class="macro"><b style="color:var(--${c})">${Math.round(v)}<small>/${goal}</small></b><small>${n}</small><div class="bar"><i style="width:${pct(v, goal)}%;background:var(--${c})"></i></div></div>`;
  $('#view').innerHTML = `
    <div class="card">
      <div class="big">${Math.round(t.kcal)} <small class="dim" style="font-size:15px">/ ${g.kcal} ккал</small></div>
      <div class="bar"><i style="width:${pct(t.kcal, g.kcal)}%"></i></div>
      <div class="dim" style="margin:6px 0 10px">Осталось: ${Math.round(g.kcal - t.kcal)} ккал</div>
      <div class="grid4" style="grid-template-columns:repeat(3,1fr)">${mac('Белки', t.p, g.p, 'p')}${mac('Жиры', t.f, g.f, 'f')}${mac('Углеводы', t.c, g.c, 'c')}</div>
    </div>
    <div class="btns" style="margin-bottom:12px">
      <button class="btn" id="addFood">+ Добавить</button>
      <button class="btn ghost" id="scan">📷 Штрихкод</button>
      <button class="btn ghost" id="ocr">📄 Этикетка</button>
    </div>
    <div class="card"><h2>Приёмы пищи</h2>
      ${meals.length ? meals.map(m => `<div class="row"><div class="main">${esc(m.name)}<div class="sub">${m.g} г · Б${r1(m.p)} Ж${r1(m.f)} У${r1(m.c)}</div></div><b>${Math.round(m.kcal)}</b><button class="btn del" data-delmeal="${m.id}">✕</button></div>`).join('') : '<div class="empty">Пока пусто</div>'}
    </div>`;
  $('#addFood').onclick = pickFood;
  $('#scan').onclick = scanBarcode;
  $('#ocr').onclick = ocrLabel;
  document.querySelectorAll('[data-delmeal]').forEach(b => b.onclick = () => { S.meals = S.meals.filter(m => m.id !== b.dataset.delmeal); save(); render(); });
}

function pickFood() {
  const draw = q => {
    const list = S.foods.filter(f => f.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => (b.used || 0) - (a.used || 0)).slice(0, 30);
    $('#flist').innerHTML = list.length ? list.map(f => `<div class="row" data-id="${f.id}"><div class="main">${esc(f.name)}<div class="sub">${f.kcal} ккал · Б${f.p} Ж${f.f} У${f.c} /100г</div></div><button class="btn sm ghost">Выбрать</button></div>`).join('') : '<div class="empty">Нет продуктов. Создайте новый или отсканируйте.</div>';
    document.querySelectorAll('#flist [data-id]').forEach(r => r.onclick = () => addMealSheet(S.foods.find(f => f.id === r.dataset.id)));
  };
  sheet(`<h2 style="margin-top:0">Продукт</h2><input id="q" placeholder="Поиск..." autocomplete="off"><div id="flist" style="margin:8px 0"></div>
    <div class="btns"><button class="btn" id="newf">+ Новый продукт</button><button class="btn ghost" id="quick">Быстро: только ккал</button><button class="btn ghost" id="cancel">Закрыть</button></div>`, () => {
    draw(''); $('#q').oninput = e => draw(e.target.value);
    $('#newf').onclick = () => foodForm({});
    $('#quick').onclick = () => foodForm({ name: 'Быстрая запись', quick: true });
    $('#cancel').onclick = closeSheet;
  });
}

function foodForm(pre) {
  const v = k => pre[k] ?? '';
  sheet(`<h2 style="margin-top:0">${pre.quick ? 'Быстрая запись' : 'Новый продукт'} <small class="dim">(на 100 г)</small></h2>
    <label>Название</label><input id="fn" value="${esc(pre.name || '')}">
    <div class="grid2"><div><label>Ккал</label><input id="fk" inputmode="decimal" value="${v('kcal')}"></div><div><label>Белки, г</label><input id="fp" inputmode="decimal" value="${v('p')}"></div>
    <div><label>Жиры, г</label><input id="ff" inputmode="decimal" value="${v('f')}"></div><div><label>Углеводы, г</label><input id="fc" inputmode="decimal" value="${v('c')}"></div></div>
    <div class="btns" style="margin-top:12px"><button class="btn" id="ok">Сохранить и выбрать</button><button class="btn ghost" id="cancel">Отмена</button></div>`, () => {
    $('#cancel').onclick = closeSheet;
    $('#ok').onclick = () => {
      const name = $('#fn').value.trim(); if (!name) return;
      const food = { id: uid(), name, kcal: num($('#fk').value), p: num($('#fp').value), f: num($('#ff').value), c: num($('#fc').value), barcode: pre.barcode || '' };
      S.foods.push(food); save(); addMealSheet(food);
    };
  });
}

function addMealSheet(food) {
  sheet(`<h2 style="margin-top:0">${esc(food.name)}</h2><div class="dim">${food.kcal} ккал · Б${food.p} Ж${food.f} У${food.c} /100г</div>
    <label>Порция, г</label><input id="g" inputmode="decimal" value="${food.lastG || 100}"><div id="calc" class="dim" style="margin:8px 0"></div>
    <div class="btns"><button class="btn" id="ok">Добавить</button><button class="btn ghost" id="cancel">Отмена</button></div>`, () => {
    const upd = () => { const x = per(food, num($('#g').value)); $('#calc').textContent = `${Math.round(x.kcal)} ккал · Б${r1(x.p)} Ж${r1(x.f)} У${r1(x.c)}`; };
    upd(); $('#g').oninput = upd; $('#cancel').onclick = closeSheet;
    $('#ok').onclick = () => {
      const g = num($('#g').value); if (g <= 0) return;
      S.meals.push({ id: uid(), date: day, name: food.name, g, ...per(food, g) });
      food.used = (food.used || 0) + 1; food.lastG = g; save(); closeSheet(); render();
    };
  });
}

// barcode
let scanner = null;
function stopScanner() { if (scanner) { const s = scanner; scanner = null; s.stop().then(() => s.clear()).catch(() => {}); } }
function scanBarcode() {
  sheet(`<h2 style="margin-top:0">Сканер штрихкода</h2><div id="reader"></div><div id="msg" class="dim" style="margin:8px 0">Наведите камеру на штрихкод…</div>
    <div class="btns"><button class="btn ghost" id="manual">Ввести номер</button><button class="btn ghost" id="cancel">Закрыть</button></div>`, () => {
    $('#cancel').onclick = closeSheet;
    $('#manual').onclick = () => { const c = prompt('Штрихкод (цифры)'); if (c) { stopScanner(); lookupBarcode(c.trim()); } };
    if (typeof Html5Qrcode === 'undefined') { $('#msg').textContent = 'Сканер не загрузился'; return; }
    scanner = new Html5Qrcode('reader');
    let done = false;
    scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 260, height: 140 } }, code => {
      if (done) return; done = true; stopScanner(); lookupBarcode(code);
    }).catch(err => { $('#msg').textContent = 'Нет доступа к камере: ' + err; });
  });
}
async function lookupBarcode(code) {
  const known = S.foods.find(f => f.barcode === code);
  if (known) return addMealSheet(known);
  sheet(`<div class="empty">Ищу ${esc(code)} в Open Food Facts…</div>`);
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,nutriments`);
    const j = await r.json();
    if (j.status !== 1) throw new Error('not found');
    const n = j.product.nutriments || {};
    const kcal = n['energy-kcal_100g'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : 0);
    const name = [j.product.product_name, j.product.brands].filter(Boolean).join(' — ') || code;
    foodForm({ name, kcal: Math.round(kcal), p: r1(n.proteins_100g || 0), f: r1(n.fat_100g || 0), c: r1(n.carbohydrates_100g || 0), barcode: code });
  } catch {
    sheet(`<div class="empty">Товар ${esc(code)} не найден или нет сети.</div><div class="btns"><button class="btn" id="m">Ввести вручную</button><button class="btn ghost" id="c">Закрыть</button></div>`, () => {
      $('#m').onclick = () => foodForm({ barcode: code }); $('#c').onclick = closeSheet;
    });
  }
}

// OCR of nutrition label (Tesseract.js, loaded on demand; needs internet on first use)
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}
function parseLabel(text) {
  const t = text.toLowerCase().replace(/,/g, '.').replace(/[|]/g, '1');
  const grab = (words, max = 2000) => {
    for (const w of words) {
      const re = new RegExp('(?:' + w + ')[^0-9\\n]{0,25}(\\d+(?:\\.\\d+)?)\\s*(?:g|г|гр|kcal|ккал|kj|кдж)?', 'g');
      const m = re.exec(t); if (m && parseFloat(m[1]) <= max) return parseFloat(m[1]);
    }
    return 0;
  };
  let kcal = 0;
  const km = t.match(/(\d+(?:\.\d+)?)\s*(?:kcal|ккал|cal)/);
  if (km) kcal = parseFloat(km[1]);
  else { const kj = t.match(/(\d+(?:\.\d+)?)\s*(?:kj|кдж)/); if (kj) kcal = Math.round(parseFloat(kj[1]) / 4.184); }
  return {
    kcal: Math.round(kcal),
    p: grab(['белк\\w*', 'protein\\w*', 'eiwei\\w*', 'prot[ée]ines?', 'prote[ií]nas?', 'białk\\w*'], 100),
    f: grab(['жир\\w*', 'fat', 'fett', 'lipides', 'grasas?', 'tłuszcz\\w*'], 100),
    c: grab(['углевод\\w*', 'carbohydrate\\w*', 'carbs?', 'kohlenhydrate', 'glucides', 'hidratos', 'węglowodany'], 100),
  };
}
function ocrLabel() {
  sheet(`<h2 style="margin-top:0">Фото этикетки КБЖУ</h2>
    <div class="dim">Сфотографируйте таблицу «на 100 г». Распознавание на устройстве; при первом запуске нужен интернет (~10 МБ языковых данных).</div>
    <label>Языки</label><select id="lang"><option value="rus+eng">Русский + English</option><option value="eng">English</option><option value="eng+deu">English + Deutsch</option><option value="eng+fra">English + Français</option><option value="eng+spa">English + Español</option><option value="eng+pol">English + Polski</option><option value="eng+ukr">English + Українська</option></select>
    <input id="file" type="file" accept="image/*" capture="environment" style="margin-top:10px"><div id="msg" class="dim" style="margin:8px 0"></div>
    <div class="btns"><button class="btn ghost" id="cancel">Закрыть</button></div>`, () => {
    $('#cancel').onclick = closeSheet;
    $('#file').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      const msg = $('#msg'); msg.textContent = 'Загружаю модель…';
      try {
        if (typeof Tesseract === 'undefined') await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');
        const { data } = await Tesseract.recognize(f, $('#lang').value, { logger: m => { if (m.status) msg.textContent = m.status + ' ' + Math.round((m.progress || 0) * 100) + '%'; } });
        const p = parseLabel(data.text);
        foodForm({ name: '', ...p });
        const note = document.createElement('div'); note.className = 'dim'; note.style.margin = '8px 0';
        note.textContent = 'Проверьте значения — распознавание может ошибаться.'; $('#sheet .panel h2').after(note);
      } catch (err) { msg.textContent = 'Не удалось распознать: ' + (err && err.message || err); }
    };
  });
}

// ---------- workouts ----------
function exHistory(name, before) {
  return S.workouts.filter(w => w.date < before).sort((a, b) => b.date.localeCompare(a.date))
    .map(w => ({ date: w.date, ex: w.exercises.find(e => e.name === name) })).filter(x => x.ex && x.ex.sets.length);
}
function bestE1(name, before) {
  let b = 0;
  S.workouts.filter(w => !before || w.date < before).forEach(w => w.exercises.filter(e => e.name === name).forEach(e => e.sets.forEach(s => { b = Math.max(b, e1rm(s.w, s.r)); })));
  return b;
}
function getWorkout(create) {
  let w = S.workouts.find(x => x.date === day);
  if (!w && create) { w = { id: uid(), date: day, exercises: [] }; S.workouts.push(w); }
  return w;
}

function viewTrain() {
  const w = getWorkout(false), exs = w ? w.exercises : [];
  const vol = exs.reduce((a, e) => a + e.sets.reduce((s, x) => s + x.w * x.r, 0), 0);
  $('#view').innerHTML = `
    <div class="card"><div class="grid2"><div><div class="dim">Объём</div><div class="big">${Math.round(vol)} <small class="dim" style="font-size:14px">кг</small></div></div>
    <div><div class="dim">Упражнений / подходов</div><div class="big">${exs.length} / ${exs.reduce((a, e) => a + e.sets.length, 0)}</div></div></div></div>
    <button class="btn" id="addEx" style="margin-bottom:12px">+ Упражнение</button>
    ${exs.map((e, i) => {
      const hist = exHistory(e.name, day)[0], prev = bestE1(e.name, day);
      const best = Math.max(0, ...e.sets.map(s => e1rm(s.w, s.r)));
      return `<div class="card"><h2><span>${esc(e.name)}${best > prev && prev > 0 ? '<span class="pr">PR</span>' : ''}</span><button class="btn del" data-delex="${i}">✕</button></h2>
        ${hist ? `<div class="sub dim" style="margin-bottom:6px">Прошлый раз (${fmtDay(hist.date)}): ${hist.ex.sets.map(s => s.w + '×' + s.r).join(', ')}</div>` : ''}
        ${e.sets.map((s, j) => `<div class="row"><div class="main"><b>${j + 1}.</b> ${s.w} кг × ${s.r}</div><span class="dim">1ПМ ≈ ${Math.round(e1rm(s.w, s.r))}</span><button class="btn del" data-delset="${i}.${j}">✕</button></div>`).join('')}
        <div class="grid4" style="grid-template-columns:1fr 1fr auto;margin-top:8px"><input inputmode="decimal" placeholder="Вес" data-w="${i}" value="${e.sets.length ? e.sets[e.sets.length - 1].w : (hist ? hist.ex.sets[0].w : '')}"><input inputmode="numeric" placeholder="Повт." data-r="${i}" value="${e.sets.length ? e.sets[e.sets.length - 1].r : (hist ? hist.ex.sets[0].r : '')}"><button class="btn" data-addset="${i}">+</button></div>
        <div class="sub dim" style="margin-top:6px">Объём: ${Math.round(e.sets.reduce((a, s) => a + s.w * s.r, 0))} кг</div></div>`;
    }).join('') || '<div class="empty">В этот день тренировок нет</div>'}`;
  $('#addEx').onclick = addExercise;
  document.querySelectorAll('[data-addset]').forEach(b => b.onclick = () => {
    const i = +b.dataset.addset, wv = num($(`[data-w="${i}"]`).value), rv = Math.round(num($(`[data-r="${i}"]`).value));
    if (rv <= 0) return; w.exercises[i].sets.push({ w: wv, r: rv }); save(); render();
  });
  document.querySelectorAll('[data-delset]').forEach(b => b.onclick = () => { const [i, j] = b.dataset.delset.split('.').map(Number); w.exercises[i].sets.splice(j, 1); save(); render(); });
  document.querySelectorAll('[data-delex]').forEach(b => b.onclick = () => { if (confirm('Удалить упражнение?')) { w.exercises.splice(+b.dataset.delex, 1); save(); render(); } });
}
const exNames = () => [...new Set(S.workouts.flatMap(w => w.exercises.map(e => e.name)))].sort();
function addExercise() {
  sheet(`<h2 style="margin-top:0">Упражнение</h2><input id="n" list="exl" placeholder="Например: Жим лёжа" autocomplete="off"><datalist id="exl">${exNames().map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <div class="chips" style="margin-top:10px">${['Жим лёжа', 'Присед', 'Становая тяга', 'Жим стоя', 'Подтягивания', 'Тяга штанги в наклоне'].map(n => `<button class="chip" data-n="${n}">${n}</button>`).join('')}</div>
    <div class="btns" style="margin-top:12px"><button class="btn" id="ok">Добавить</button><button class="btn ghost" id="cancel">Отмена</button></div>`, () => {
    const add = name => { name = name.trim(); if (!name) return; getWorkout(true).exercises.push({ name, sets: [] }); save(); closeSheet(); render(); };
    $('#ok').onclick = () => add($('#n').value); $('#cancel').onclick = closeSheet;
    document.querySelectorAll('.chip[data-n]').forEach(c => c.onclick = () => add(c.dataset.n));
  });
}

// ---------- body ----------
const MEAS = [['weight', 'Вес, кг'], ['waist', 'Талия'], ['chest', 'Грудь'], ['hips', 'Бёдра'], ['arm', 'Бицепс'], ['thigh', 'Бедро']];
function viewBody() {
  const rows = [...S.body].sort((a, b) => b.date.localeCompare(a.date));
  $('#view').innerHTML = `<button class="btn" id="addB" style="margin-bottom:12px">+ Замер</button>
    <div class="card"><h2>История</h2>${rows.length ? rows.map(r => `<div class="row"><div class="main"><b>${fmtDay(r.date)}</b><div class="sub">${MEAS.filter(([k]) => r[k]).map(([k, n]) => (k === 'weight' ? '' : n + ' ') + r[k] + (k === 'weight' ? ' кг' : ' см')).join(' · ')}</div></div><button class="btn del" data-delb="${r.id}">✕</button></div>`).join('') : '<div class="empty">Нет замеров</div>'}</div>`;
  $('#addB').onclick = () => {
    const last = rows[0] || {};
    sheet(`<h2 style="margin-top:0">Замер на ${fmtDay(day)}</h2><div class="grid2">${MEAS.map(([k, n]) => `<div><label>${n}${k === 'weight' ? '' : ', см'}</label><input inputmode="decimal" data-m="${k}" placeholder="${last[k] || ''}"></div>`).join('')}</div>
      <div class="btns" style="margin-top:12px"><button class="btn" id="ok">Сохранить</button><button class="btn ghost" id="cancel">Отмена</button></div>`, () => {
      $('#cancel').onclick = closeSheet;
      $('#ok').onclick = () => {
        const rec = { id: uid(), date: day }; let any = false;
        document.querySelectorAll('[data-m]').forEach(i => { const v = num(i.value); if (v > 0) { rec[i.dataset.m] = v; any = true; } });
        if (!any) return;
        const ex = S.body.find(b => b.date === day); if (ex) Object.assign(ex, rec, { id: ex.id }); else S.body.push(rec);
        save(); closeSheet(); render();
      };
    });
  };
  document.querySelectorAll('[data-delb]').forEach(b => b.onclick = () => { S.body = S.body.filter(x => x.id !== b.dataset.delb); save(); render(); });
}

// ---------- stats ----------
function viewStats() {
  const names = exNames(); if (!statSel.ex || !names.includes(statSel.ex)) statSel.ex = names[0] || null;
  $('#view').innerHTML = `
    <div class="card"><h2>Вес и замеры</h2><div class="chips">${MEAS.map(([k, n]) => `<button class="chip ${statSel.m === k ? 'on' : ''}" data-m="${k}">${n.replace(', кг', '')}</button>`).join('')}</div><canvas class="chart" id="c1"></canvas></div>
    <div class="card"><h2>Калории за 14 дней <small>цель ${S.goals.kcal}</small></h2><canvas class="chart" id="c2"></canvas></div>
    <div class="card"><h2>Упражнение</h2>${names.length ? `<div class="chips">${names.map(n => `<button class="chip ${statSel.ex === n ? 'on' : ''}" data-e="${esc(n)}">${esc(n)}</button>`).join('')}</div>
      <div class="dim" style="margin:4px 0">Расчётный 1ПМ (лучший подход за день), кг</div><canvas class="chart" id="c3"></canvas>
      <div class="dim" style="margin:4px 0">Объём за тренировку, кг</div><canvas class="chart" id="c4"></canvas><div id="prs" class="sub dim"></div>` : '<div class="empty">Нет данных по тренировкам</div>'}</div>`;
  document.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { statSel.m = b.dataset.m; render(); });
  document.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { statSel.ex = b.dataset.e; render(); });
  chart($('#c1'), S.body.filter(b => b[statSel.m]).map(b => ({ x: ts(b.date), y: b[statSel.m] })).sort((a, b) => a.x - b.x), { color: '#60a5fa' });
  const days = []; for (let i = 13; i >= 0; i--) { const k = shiftDay(today(), -i); days.push({ x: ts(k), y: sumMeals(k).kcal }); }
  chart($('#c2'), days, { bars: true, zero: true, line: S.goals.kcal });
  if (statSel.ex) {
    const pts = [], vols = [];
    S.workouts.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(w => w.exercises.filter(e => e.name === statSel.ex && e.sets.length).forEach(e => {
      pts.push({ x: ts(w.date), y: r1(Math.max(...e.sets.map(s => e1rm(s.w, s.r)))) });
      vols.push({ x: ts(w.date), y: Math.round(e.sets.reduce((a, s) => a + s.w * s.r, 0)) });
    }));
    chart($('#c3'), pts, { color: '#4ade80' }); chart($('#c4'), vols, { bars: true, zero: true, color: '#fbbf24' });
    let heavy = { w: 0, r: 0 }; S.workouts.forEach(w => w.exercises.filter(e => e.name === statSel.ex).forEach(e => e.sets.forEach(s => { if (s.w > heavy.w || (s.w === heavy.w && s.r > heavy.r)) heavy = s; })));
    $('#prs').textContent = `Рекорд 1ПМ ≈ ${Math.round(bestE1(statSel.ex))} кг · Макс. вес: ${heavy.w} кг × ${heavy.r}`;
  }
}

// ---------- more ----------
function viewMore() {
  const g = S.goals;
  $('#view').innerHTML = `<div class="card"><h2>Цели на день</h2><div class="grid2">
    <div><label>Ккал</label><input inputmode="numeric" id="gk" value="${g.kcal}"></div><div><label>Белки, г</label><input inputmode="numeric" id="gp" value="${g.p}"></div>
    <div><label>Жиры, г</label><input inputmode="numeric" id="gf" value="${g.f}"></div><div><label>Углеводы, г</label><input inputmode="numeric" id="gc" value="${g.c}"></div></div>
    <button class="btn" id="sg" style="margin-top:10px">Сохранить</button></div>
    <div class="card"><h2>Мои продукты (${S.foods.length})</h2>${S.foods.slice().sort((a, b) => a.name.localeCompare(b.name)).map(f => `<div class="row"><div class="main">${esc(f.name)}<div class="sub">${f.kcal} ккал · Б${f.p} Ж${f.f} У${f.c}</div></div><button class="btn del" data-delfood="${f.id}">✕</button></div>`).join('') || '<div class="empty">Пусто</div>'}</div>
    <div class="card"><h2>Резервная копия</h2><div class="dim" style="margin-bottom:8px">Данные хранятся только в этом браузере. Делайте экспорт время от времени.</div>
    <div class="btns"><button class="btn ghost" id="exp">Экспорт JSON</button><button class="btn ghost" id="imp">Импорт</button></div><input type="file" id="impf" accept="application/json" hidden></div>`;
  $('#sg').onclick = () => { S.goals = { kcal: num($('#gk').value), p: num($('#gp').value), f: num($('#gf').value), c: num($('#gc').value) }; save(); alert('Сохранено'); };
  document.querySelectorAll('[data-delfood]').forEach(b => b.onclick = () => { S.foods = S.foods.filter(f => f.id !== b.dataset.delfood); save(); render(); });
  $('#exp').onclick = () => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' }));
    a.download = 'gymbro-' + today() + '.json'; a.click();
  };
  $('#imp').onclick = () => $('#impf').click();
  $('#impf').onchange = async e => {
    try { const d = JSON.parse(await e.target.files[0].text()); if (!confirm('Заменить текущие данные импортированными?')) return; S = Object.assign({}, DEFAULTS, d); save(); render(); }
    catch { alert('Неверный файл'); }
  };
}

// ---------- shell ----------
const TITLES = { food: 'Питание', train: 'Тренировки', body: 'Тело', stats: 'Прогресс', more: 'Настройки' };
function render() {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const withDay = ['food', 'train', 'body'].includes(tab);
  $('#top').innerHTML = `<h1>${TITLES[tab]}</h1>` + (withDay ? `<div class="nav"><button class="btn sm ghost" id="pd">‹</button><button class="btn sm ghost" id="td">${fmtDay(day)}</button><button class="btn sm ghost" id="nd">›</button></div>` : '');
  if (withDay) {
    $('#pd').onclick = () => { day = shiftDay(day, -1); render(); };
    $('#nd').onclick = () => { day = shiftDay(day, 1); render(); };
    $('#td').onclick = () => { day = today(); render(); };
  }
  ({ food: viewFood, train: viewTrain, body: viewBody, stats: viewStats, more: viewMore })[tab]();
}
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => { tab = b.dataset.tab; window.scrollTo(0, 0); render(); });
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
