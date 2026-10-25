'use strict';

// ---------- storage ----------
const KEY = 'gymbro.v1';
const DEFAULTS = {
  foods: [], meals: [], goals: { kcal: 2200, p: 150, f: 70, c: 250 }, goalsRest: { kcal: 2000, p: 150, f: 65, c: 200 },
  trainDays: [1, 3, 5], dayType: {}, vitamins: [], vitLog: {}, workouts: [], body: [], updatedAt: 0,
};
const fresh = () => structuredClone(DEFAULTS);
let S;
try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { S = fresh(); }
function save() { S.updatedAt = Date.now(); localStorage.setItem(KEY, JSON.stringify(S)); schedulePush(); }
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


// ---------- icons ----------
const ICONS = {
  utensils: '<path d="M3 2v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3zm0 0v7"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  pill: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z"/><path d="m8.5 8.5 7 7"/>',
  ruler: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0z"/><path d="m14.5 12.5 2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2"/>',
  trend: '<path d="M22 7 13.5 15.5l-5-5L2 17"/><path d="M16 7h6v6"/>',
  sliders: '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M8 7v10M12 7v10M17 7v10"/>',
  file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  crown: '<path d="m2 8 4 4 6-8 6 8 4-4-2 12H4z"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5"/>',
};
const ic = (n, c = '') => `<svg class="ic ${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
document.querySelectorAll('[data-ic]').forEach(e => { e.innerHTML = ic(e.dataset.ic); });

let tab = 'home', day = today(), statSel = { ex: null, m: 'weight' }, animate = true, lastToday = today(), lastVit = null;

// ---------- sheet ----------
function sheet(html, mount) {
  const el = $('#sheet'), p = $('.panel', el);
  p.innerHTML = `<div class="sheet-bar"><button class="sheet-x" aria-label="Закрыть">${ic('x')}</button></div>` + html; el.hidden = false;
  $('.sheet-x', p).onclick = closeSheet;
  mount && mount(p);
  return p;
}
function closeSheet() { $('#sheet').hidden = true; $('#sheet .panel').innerHTML = ''; stopScanner(); }
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


// ---------- habits, streaks, dashboard ----------
function habits(k) {
  const hasW = S.workouts.some(w => w.date === k && w.exercises.some(e => e.sets.length)), due = S.vitamins.filter(v => vitDue(v, k));
  return { nutr: S.meals.some(m => m.date === k), train: dayInfo(k).train ? hasW : null, vit: due.length ? due.every(v => vitTaken(v, k)) : null };
}
function streak(kind) {
  let k = today(), n = 0;
  for (let i = 0; i < 400; i++, k = shiftDay(k, -1)) {
    const h = habits(k), app = (kind === 'all' ? Object.values(h) : [h[kind]]).filter(v => v !== null);
    if (!app.length) continue;
    if (app.every(Boolean)) n++; else if (k !== today()) break;
  }
  return n;
}
function dayFrac(k) { const a = Object.values(habits(k)).filter(v => v !== null); return a.length ? a.filter(Boolean).length / a.length : 0; }
const streakChip = (kind, label) => { const n = streak(kind); return `<div class="sk ${n ? '' : 'off'} ${label ? 'wide' : ''}">${ic('flame')}<b>${n}</b>${label ? `<small>${label}</small>` : ''}</div>`; };
function ringCard(t, g) {
  const pct = (v, goal) => Math.min(100, goal ? v / goal * 100 : 0);
  const C = 2 * Math.PI * 52, over = t.kcal > g.kcal, off = C * (1 - pct(t.kcal, g.kcal) / 100);
  const mac = (n, v, goal, c) => `<div class="mac"><div class="mh"><span>${n}</span><b>${Math.round(v)}<small> / ${goal} г</small></b></div><div class="bar"><i style="width:${pct(v, goal)}%;background:var(--${c})"></i></div></div>`;
  return `<div class="card hero">
      <div class="ringwrap"><svg class="ring" viewBox="0 0 120 120"><defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34d399"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs>
        <circle class="ring-bg" cx="60" cy="60" r="52"/><circle class="ring-fg ${over ? 'over' : ''}" cx="60" cy="60" r="52" style="--len:${C};stroke-dasharray:${C};stroke-dashoffset:${off}"/></svg>
        <div class="ringtxt"><b>${Math.round(t.kcal)}</b><small>из ${g.kcal} ккал</small></div></div>
      <div class="macs">${mac('Белки', t.p, g.p, 'p')}${mac('Жиры', t.f, g.f, 'f')}${mac('Углеводы', t.c, g.c, 'c')}
        <div class="left">${over ? 'Превышено на ' + Math.round(t.kcal - g.kcal) : 'Осталось ' + Math.round(g.kcal - t.kcal)} ккал</div></div>
    </div>`;
}
const goTab = (t, d) => { tab = t; if (d) day = d; animate = true; window.scrollTo(0, 0); render(); };

function viewHome() {
  const t0 = today(), h = habits(t0), di = dayInfo(t0), t = sumMeals(t0), all = streak('all');
  const wk = []; for (let i = 6; i >= 0; i--) wk.push(shiftDay(t0, -i));
  const app = Object.values(h).filter(v => v !== null), doneN = app.filter(Boolean).length;
  const todayW = S.workouts.find(w => w.date === t0), exs = todayW ? todayW.exercises.filter(e => e.sets.length) : [];
  const vol = exs.reduce((a, e) => a + e.sets.reduce((x, y) => x + y.w * y.r, 0), 0), setsN = exs.reduce((a, e) => a + e.sets.length, 0);
  const due = S.vitamins.filter(v => vitDue(v, t0)), vdone = due.filter(v => vitTaken(v, t0)).length;
  const wts = S.body.filter(b => b.weight).sort((a, b) => b.date.localeCompare(a.date)), w0 = wts[0], w1 = wts[1];
  const hab = (icon, name, state, kind) => `<div class="hab ${state}">${ic(icon)}<span>${name}</span><em>${state === 'done' ? ic('check') : state === 'na' ? '—' : ic('circle')}</em><i>${ic('flame')}${streak(kind)}</i></div>`;
  const st = v => v === null ? 'na' : v ? 'done' : 'todo';
  $('#view').innerHTML = `
    <div class="card hero3">
      <div class="flamebig ${all ? '' : 'off'}">${ic('flame')}</div>
      <div class="main"><div class="big">${all}<small> ${all === 1 ? 'день' : all >= 2 && all <= 4 ? 'дня' : 'дней'} подряд</small></div>
        <div class="dim">${new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })} · выполнено ${doneN} из ${app.length}</div></div>
    </div>
    <div class="habs">${hab('utensils', 'Питание', st(h.nutr), 'nutr')}${hab('dumbbell', 'Тренировка', st(h.train), 'train')}${hab('pill', 'Витамины', st(h.vit), 'vit')}</div>
    <div class="card week"><h2>Последние 7 дней</h2><div class="wk">${wk.map(k => `<div class="wd1 ${k === t0 ? 'tdy' : ''}"><small>${WD[wday(k)]}</small><div class="dayc" style="--p:${Math.round(dayFrac(k) * 100)}"><span>${+k.slice(8)}</span></div></div>`).join('')}</div></div>
    <div class="link" data-go="food">${ringCard(t, goalFor(t0))}</div>
    <div class="card"><h2><span>Тренировка</span><span class="tag ${di.train ? 'train' : 'rest'}">${ic(di.train ? 'bolt' : 'moon')}${di.train ? 'Тренировочный день' : 'День отдыха'}</span></h2>
      ${exs.length ? `<div class="sub" style="margin-bottom:10px">${exs.length} упр. · ${setsN} подходов · объём ${Math.round(vol)} кг</div><button class="btn ghost" data-go="train">Открыть тренировку</button>`
        : di.train ? `<div class="sub" style="margin-bottom:10px">По плану сегодня тренировка</div><button class="btn" data-go="train">${ic('plus')}Начать</button>` : '<div class="sub">Сегодня отдых — восстанавливайтесь. Если потренируетесь, день станет тренировочным.</div>'}</div>
    <div class="card"><h2><span>Витамины</span><span class="tag">${vdone} / ${due.length}</span></h2>
      ${due.map(v => `<div class="vit ${vitTaken(v, t0) ? 'on' : ''} ${lastVit === v.id ? 'pop' : ''}" data-hvit="${v.id}"><span class="chk">${ic('check')}</span><div class="main"><b>${esc(v.name)}</b><div class="sub">${[v.dose, v.when].filter(Boolean).map(esc).join(' · ') || '&nbsp;'}</div></div></div>`).join('') || '<div class="sub">На сегодня ничего не запланировано</div>'}</div>
    <div class="card"><h2>Вес</h2><div class="wrow"><div>${w0 ? `<div class="big">${w0.weight}<small> кг</small></div><div class="dim">${w1 ? (w0.weight - w1.weight > 0 ? '+' : '') + r1(w0.weight - w1.weight) + ' кг с ' + fmtDay(w1.date) : fmtDay(w0.date)}</div>` : '<div class="dim">Пока нет замеров</div>'}</div><button class="btn ghost" id="hw">${ic('plus')}Записать</button></div></div>`;
  document.querySelectorAll('[data-go]').forEach(e => e.onclick = () => goTab(e.dataset.go, today()));
  document.querySelectorAll('[data-hvit]').forEach(r => r.onclick = () => toggleVit(r.dataset.hvit, t0));
  $('#hw').onclick = bodySheet;
}

// ---------- nutrition ----------
const sumMeals = k => S.meals.filter(m => m.date === k).reduce((a, m) => (a.kcal += m.kcal, a.p += m.p, a.f += m.f, a.c += m.c, a), { kcal: 0, p: 0, f: 0, c: 0 });
const wday = k => new Date(k + 'T12:00:00').getDay();
const autoTrain = k => S.workouts.some(w => w.date === k && w.exercises.some(e => e.sets.length)) || S.trainDays.includes(wday(k));
function dayInfo(k) {
  if (S.dayType[k] !== undefined) return { train: S.dayType[k], src: 'вручную' };
  if (S.workouts.some(w => w.date === k && w.exercises.some(e => e.sets.length))) return { train: true, src: 'есть тренировка' };
  return { train: S.trainDays.includes(wday(k)), src: 'по расписанию' };
}
const goalFor = k => dayInfo(k).train ? S.goals : S.goalsRest;
const per = (food, g) => ({ kcal: food.kcal * g / 100, p: food.p * g / 100, f: food.f * g / 100, c: food.c * g / 100 });

function viewFood() {
  const t = sumMeals(day), g = goalFor(day), meals = S.meals.filter(m => m.date === day), dt = dayInfo(day);
  $('#view').innerHTML = `
    <div class="toprow"><button class="daytype ${dt.train ? 'train' : 'rest'}" id="dt">${ic(dt.train ? 'bolt' : 'moon')}<span>${dt.train ? 'Тренировочный день' : 'День отдыха'}</span><small>${dt.src}</small></button>${streakChip('nutr')}</div>
    ${ringCard(t, g)}
    <div class="actions">
      <button class="btn" id="addFood">${ic('plus')}Добавить</button>
      <button class="btn ghost" id="scan">${ic('scan')}Штрихкод</button>
      <button class="btn ghost" id="ocr">${ic('file')}Этикетка</button>
    </div>
    <div class="card"><h2>Приёмы пищи</h2>
      ${meals.length ? meals.map(m => `<div class="row"><div class="main">${esc(m.name)}<div class="sub">${m.g} г · Б${r1(m.p)} Ж${r1(m.f)} У${r1(m.c)}</div></div><b>${Math.round(m.kcal)}</b><button class="btn del" data-delmeal="${m.id}">${ic('x')}</button></div>`).join('') : '<div class="empty">Пока пусто</div>'}
    </div>`;
  $('#dt').onclick = () => {
    const want = !dt.train;
    if (want === autoTrain(day)) delete S.dayType[day]; else S.dayType[day] = want;
    save(); render();
  };
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
  sheet(`<h2 style="margin-top:0">Продукт</h2><input id="q" placeholder="Поиск..." autocomplete="off"><div id="flist" style="margin:8px 0"></div><div id="slist"></div>
    <div class="btns" style="margin-top:8px"><button class="btn" id="newf">+ Новый продукт</button><button class="btn ghost" id="quick">Быстро: только ккал</button><button class="btn ghost" id="cancel">Закрыть</button></div>`, () => {
    draw(''); $('#q').oninput = e => { draw(e.target.value); searchShared(e.target.value); };
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
    ${sb && user && !pre.quick ? `<label style="display:flex;gap:8px;align-items:center;color:var(--txt);font-size:14px"><input type="checkbox" id="fshare" style="width:auto" ${pre.barcode ? 'checked' : ''}> Добавить в общую базу</label>` : ''}
    <div class="btns" style="margin-top:12px"><button class="btn" id="ok">Сохранить и выбрать</button><button class="btn ghost" id="cancel">Отмена</button></div>`, () => {
    $('#cancel').onclick = closeSheet;
    $('#ok').onclick = () => {
      const name = $('#fn').value.trim(); if (!name) return;
      const food = { id: uid(), name, kcal: num($('#fk').value), p: num($('#fp').value), f: num($('#ff').value), c: num($('#fc').value), barcode: pre.barcode || '' };
      S.foods.push(food); save();
      if ($('#fshare') && $('#fshare').checked) shareFood(food);
      addMealSheet(food);
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
function stopScanner() {
  if (!scanner) return;
  const s = scanner; scanner = null;
  try { Promise.resolve(s.stop()).then(() => s.clear()).catch(() => {}); } catch { /* scanner was not running */ }
}
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
  sheet(`<div class="empty">Ищу ${esc(code)}…</div>`);
  if (sb && user) {
    const { data } = await sb.from('shared_foods').select('*').eq('barcode', code).maybeSingle();
    if (data) return addMealSheet(adoptShared(data));
  }
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,nutriments`);
    const j = await r.json();
    if (j.status !== 1) throw new Error('not found');
    const n = j.product.nutriments || {};
    const kcal = n['energy-kcal_100g'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : 0);
    const name = [j.product.product_name, j.product.brands].filter(Boolean).join(' — ') || code;
    foodForm({ name, kcal: Math.round(kcal), p: r1(n.proteins_100g || 0), f: r1(n.fat_100g || 0), c: r1(n.carbohydrates_100g || 0), barcode: code });
  } catch {
    sheet(`<div class="empty">Товар ${esc(code)} не найден или нет сети.</div><div class="btns"><button class="btn" id="m">Ввести вручную</button><button class="btn ghost" id="cancel">Закрыть</button></div>`, () => {
      $('#m').onclick = () => foodForm({ barcode: code }); $('#cancel').onclick = closeSheet;
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
    ${streakChip('train', 'тренировок подряд по плану')}
    <div class="card"><div class="grid2"><div><div class="dim">Объём</div><div class="big">${Math.round(vol)} <small class="dim" style="font-size:14px">кг</small></div></div>
    <div><div class="dim">Упражнений / подходов</div><div class="big">${exs.length} / ${exs.reduce((a, e) => a + e.sets.length, 0)}</div></div></div></div>
    <button class="btn full" id="addEx">${ic('plus')}Упражнение</button>
    ${exs.map((e, i) => {
      const hist = exHistory(e.name, day)[0], prev = bestE1(e.name, day);
      const best = Math.max(0, ...e.sets.map(s => e1rm(s.w, s.r)));
      return `<div class="card"><h2><span>${esc(e.name)}${best > prev && prev > 0 ? '<span class="pr">PR</span>' : ''}</span><button class="btn del" data-delex="${i}">${ic('x')}</button></h2>
        ${hist ? `<div class="sub dim" style="margin-bottom:6px">Прошлый раз (${fmtDay(hist.date)}): ${hist.ex.sets.map(s => s.w + '×' + s.r).join(', ')}</div>` : ''}
        ${e.sets.map((s, j) => `<div class="row"><div class="main"><b>${j + 1}.</b> ${s.w} кг × ${s.r}</div><span class="dim">1ПМ ≈ ${Math.round(e1rm(s.w, s.r))}</span><button class="btn del" data-delset="${i}.${j}">${ic('x')}</button></div>`).join('')}
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
const BASE_EX = ['Жим лёжа', 'Жим лёжа на наклонной скамье', 'Жим гантелей лёжа', 'Жим гантелей на наклонной скамье', 'Разводка гантелей', 'Отжимания', 'Отжимания на брусьях',
  'Присед со штангой', 'Фронтальный присед', 'Жим ногами', 'Выпады', 'Болгарские сплит-приседы', 'Разгибания ног', 'Сгибания ног', 'Румынская тяга', 'Ягодичный мостик', 'Подъём на носки',
  'Становая тяга', 'Тяга штанги в наклоне', 'Тяга гантели одной рукой', 'Тяга верхнего блока', 'Тяга нижнего блока', 'Подтягивания', 'Гиперэкстензия',
  'Жим стоя', 'Жим гантелей сидя', 'Махи гантелей в стороны', 'Махи в наклоне', 'Тяга к подбородку', 'Шраги',
  'Подъём штанги на бицепс', 'Подъём гантелей на бицепс', 'Молотки', 'Французский жим', 'Разгибания на трицепс на блоке', 'Скручивания', 'Подъём ног в висе', 'Планка'];
const allExNames = () => {
  const use = {}; S.workouts.forEach(w => w.exercises.forEach(e => { use[e.name] = (use[e.name] || 0) + 1; }));
  const mine = Object.keys(use).sort((a, b) => use[b] - use[a]);
  const rest = [...new Set([...sharedEx, ...BASE_EX])].filter(n => !use[n]).sort((a, b) => a.localeCompare(b));
  return [...mine, ...rest];
};
const exNames = () => [...new Set(S.workouts.flatMap(w => w.exercises.map(e => e.name)))].sort();
function addExercise() {
  const all = allExNames();
  const add = name => { name = name.trim(); if (!name) return; getWorkout(true).exercises.push({ name, sets: [] }); save(); shareExercise(name); closeSheet(); render(); };
  sheet(`<h2 class="sh">Упражнение</h2><input id="n" placeholder="Поиск или новое название" autocomplete="off" autocapitalize="sentences"><div id="exl" style="margin:8px 0"></div>
    <div class="btns"><button class="btn ghost" id="cancel">Закрыть</button></div>`, () => {
    const draw = raw => {
      const q = raw.trim().toLowerCase();
      const list = all.filter(n => n.toLowerCase().includes(q)).slice(0, 40);
      const exact = all.some(n => n.toLowerCase() === q);
      $('#exl').innerHTML = (q && !exact ? `<div class="row pick" data-new="1"><div class="main">Создать «${esc(raw.trim())}»</div><span class="btn sm">${ic('plus')}</span></div>` : '') +
        list.map(n => `<div class="row pick" data-n="${esc(n)}"><div class="main">${esc(n)}</div><span class="btn sm ghost">${ic('plus')}</span></div>`).join('') +
        (!list.length && !q ? '<div class="empty">Начните вводить название</div>' : '');
      document.querySelectorAll('#exl [data-n]').forEach(r => r.onclick = () => add(r.dataset.n));
      document.querySelectorAll('#exl [data-new]').forEach(r => r.onclick = () => add(raw));
    };
    draw(''); $('#n').oninput = e => draw(e.target.value);
    $('#n').onkeydown = e => { if (e.key === 'Enter') add($('#n').value); };
    $('#cancel').onclick = closeSheet;
  });
}

// ---------- vitamins ----------
const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'], WD_ORDER = [1, 2, 3, 4, 5, 6, 0];
const vitDue = (v, k) => v.created <= k && v.days.includes(wday(k));
const vitTaken = (v, k) => (S.vitLog[k] || []).includes(v.id);
function toggleVit(id, k = day) {
  const a = S.vitLog[k] || (S.vitLog[k] = []), i = a.indexOf(id);
  i >= 0 ? a.splice(i, 1) : a.push(id);
  if (!a.length) delete S.vitLog[k];
  lastVit = id; save(); render(); lastVit = null;
}
function vitStreak() {
  let k = today(), n = 0;
  for (let i = 0; i < 400; i++, k = shiftDay(k, -1)) {
    const due = S.vitamins.filter(v => vitDue(v, k)); if (!due.length) continue;
    if (due.every(v => vitTaken(v, k))) n++; else if (k !== today()) break;
  }
  return n;
}
const wdChips = sel => `<div class="wd">${WD_ORDER.map(d => `<button type="button" class="wdb ${sel.includes(d) ? 'on' : ''}" data-d="${d}">${WD[d]}</button>`).join('')}</div>`;
const pickedDays = root => [...root.querySelectorAll('.wdb.on')].map(b => +b.dataset.d);
function bindChips(root) { root.querySelectorAll('.wdb').forEach(b => b.onclick = () => b.classList.toggle('on')); }

function viewVit() {
  const due = S.vitamins.filter(v => vitDue(v, day)), other = S.vitamins.filter(v => !vitDue(v, day));
  const done = due.filter(v => vitTaken(v, day)).length, st = vitStreak();
  const row = (v, isDue) => `<div class="vit ${vitTaken(v, day) ? 'on' : ''} ${isDue ? '' : 'off'} ${lastVit === v.id ? 'pop' : ''}" data-vit="${v.id}">
      <span class="chk">${ic('check')}</span><div class="main"><b>${esc(v.name)}</b><div class="sub">${[v.dose, v.when].filter(Boolean).map(esc).join(' · ') || '&nbsp;'}</div></div>
      <button class="btn del" data-editvit="${v.id}" aria-label="Изменить">${ic('edit')}</button></div>`;
  // history: last 14 days
  const days = []; for (let i = 13; i >= 0; i--) days.push(shiftDay(today(), -i));
  const cell = (v, k) => {
    const taken = vitTaken(v, k), d = vitDue(v, k);
    const cls = taken ? 'ok' : d ? (k === today() ? 'pend' : 'miss') : 'none';
    return `<i class="cell ${cls} ${k === day ? 'sel' : ''}" data-day="${k}"></i>`;
  };
  const pct30 = v => { let d = 0, t = 0, k = today(); for (let i = 0; i < 30; i++, k = shiftDay(k, -1)) { if (vitDue(v, k) && k <= today() && !(k === today() && !vitTaken(v, k))) { d++; if (vitTaken(v, k)) t++; } } return d ? Math.round(t / d * 100) : null; };
  const hist = S.vitamins.length ? `<div class="card"><h2>История · 14 дней</h2>
      <div class="heat hd">${days.map(k => `<small class="${k === today() ? 'tdy' : ''}">${WD[wday(k)][0]}</small>`).join('')}</div>
      ${S.vitamins.map(v => { const p = pct30(v); return `<div class="hrow"><div class="hname"><span>${esc(v.name)}</span><small>${p === null ? '' : p + '% за 30 дн.'}</small></div><div class="heat">${days.map(k => cell(v, k)).join('')}</div></div>`; }).join('')}
      <div class="legend"><span><i class="cell ok"></i>принято</span><span><i class="cell miss"></i>пропущено</span><span><i class="cell none"></i>не по расписанию</span></div></div>` : '';
  $('#view').innerHTML = `
    <div class="card hero2"><div><div class="big">${done}<small> / ${due.length}</small></div><div class="dim">${due.length ? (done === due.length ? 'Всё принято' : 'принято за ' + (day === today() ? 'сегодня' : fmtDay(day))) : 'на этот день ничего не запланировано'}</div></div>
      <div class="streak">${ic('flame')}<b>${st}</b><small>дн. подряд</small></div>
      <div class="bar wide"><i style="width:${due.length ? done / due.length * 100 : 0}%"></i></div></div>
    <button class="btn full" id="addVit">${ic('plus')}Добавить витамин</button>
    <div class="card"><h2>По расписанию</h2>${due.map(v => row(v, true)).join('') || '<div class="empty">Нет витаминов на этот день</div>'}</div>
    ${other.length ? `<div class="card"><h2>Не по расписанию</h2>${other.map(v => row(v, false)).join('')}</div>` : ''}
    ${hist}`;
  $('#addVit').onclick = () => vitForm(null);
  document.querySelectorAll('[data-vit]').forEach(r => r.onclick = () => toggleVit(r.dataset.vit));
  document.querySelectorAll('[data-editvit]').forEach(b => b.onclick = e => { e.stopPropagation(); vitForm(S.vitamins.find(v => v.id === b.dataset.editvit)); });
  document.querySelectorAll('.cell[data-day]').forEach(c => c.onclick = () => { day = c.dataset.day; render(); window.scrollTo(0, 0); });
}
function vitForm(v) {
  const days = v ? v.days : [0, 1, 2, 3, 4, 5, 6];
  sheet(`<h2 class="sh">${v ? 'Витамин' : 'Новый витамин'}</h2>
    <label>Название</label><input id="vn" value="${esc(v ? v.name : '')}" placeholder="Например: Витамин D3">
    <label>Дозировка</label><input id="vd" value="${esc(v ? v.dose : '')}" placeholder="1 таблетка, 2000 МЕ…">
    <label>Когда принимать</label><input id="vw" value="${esc(v ? v.when : '')}" placeholder="Утром, с едой…">
    <div class="chips" style="margin-top:6px">${['Утром', 'Днём', 'Вечером', 'С едой', 'Перед сном'].map(w => `<button class="chip" data-w="${w}">${w}</button>`).join('')}</div>
    <label>Дни недели</label>${wdChips(days)}
    <div class="chips" style="margin-top:8px"><button class="chip" data-set="all">Каждый день</button><button class="chip" data-set="work">Будни</button><button class="chip" data-set="end">Выходные</button></div>
    <div class="btns" style="margin-top:14px"><button class="btn" id="ok">Сохранить</button>${v ? `<button class="btn ghost danger" id="del">Удалить</button>` : ''}<button class="btn ghost" id="cancel">Отмена</button></div>`, p => {
    bindChips(p);
    p.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { $('#vw').value = b.dataset.w; });
    p.querySelectorAll('[data-set]').forEach(b => b.onclick = () => {
      const set = { all: [0, 1, 2, 3, 4, 5, 6], work: [1, 2, 3, 4, 5], end: [0, 6] }[b.dataset.set];
      p.querySelectorAll('.wdb').forEach(x => x.classList.toggle('on', set.includes(+x.dataset.d)));
    });
    $('#cancel').onclick = closeSheet;
    $('#ok').onclick = () => {
      const name = $('#vn').value.trim(), ds = pickedDays(p); if (!name) return; if (!ds.length) return alert('Выберите хотя бы один день');
      const data = { name, dose: $('#vd').value.trim(), when: $('#vw').value.trim(), days: ds };
      if (v) Object.assign(v, data); else S.vitamins.push({ id: uid(), created: today(), ...data });
      save(); closeSheet(); render();
    };
    if (v) $('#del').onclick = () => { if (!confirm('Удалить витамин и его историю?')) return; S.vitamins = S.vitamins.filter(x => x.id !== v.id); Object.keys(S.vitLog).forEach(k => { S.vitLog[k] = S.vitLog[k].filter(i => i !== v.id); if (!S.vitLog[k].length) delete S.vitLog[k]; }); save(); closeSheet(); render(); };
  });
}

// ---------- body ----------
const MEAS = [['weight', 'Вес, кг'], ['waist', 'Талия'], ['chest', 'Грудь'], ['hips', 'Бёдра'], ['arm', 'Бицепс'], ['thigh', 'Бедро']];
let statView = 'charts';
const seg = () => `<div class="seg"><button class="${statView === 'charts' ? 'on' : ''}" data-sv="charts">Графики</button><button class="${statView === 'body' ? 'on' : ''}" data-sv="body">Замеры</button></div>`;
const bindSeg = () => document.querySelectorAll('[data-sv]').forEach(b => b.onclick = () => { statView = b.dataset.sv; animate = true; render(); });
function bodySheet() {
  const last = [...S.body].sort((a, b) => b.date.localeCompare(a.date))[0] || {}, d = today();
  sheet(`<h2 class="sh">Замер · ${fmtDay(d)}</h2><div class="grid2">${MEAS.map(([k, n]) => `<div><label>${n}${k === 'weight' ? '' : ', см'}</label><input inputmode="decimal" data-m="${k}" placeholder="${last[k] || ''}"></div>`).join('')}</div>
    <div class="btns" style="margin-top:14px"><button class="btn" id="ok">Сохранить</button><button class="btn ghost" id="cancel">Отмена</button></div>`, () => {
    $('#cancel').onclick = closeSheet;
    $('#ok').onclick = () => {
      const rec = { id: uid(), date: d }; let any = false;
      document.querySelectorAll('[data-m]').forEach(i => { const v = num(i.value); if (v > 0) { rec[i.dataset.m] = v; any = true; } });
      if (!any) return;
      const ex = S.body.find(b => b.date === d); if (ex) Object.assign(ex, rec, { id: ex.id }); else S.body.push(rec);
      save(); closeSheet(); render();
    };
  });
}
function viewBody() {
  const rows = [...S.body].sort((a, b) => b.date.localeCompare(a.date));
  $('#view').innerHTML = seg() + `<button class="btn full" id="addB">${ic('plus')}Замер</button>
    <div class="card"><h2>История</h2>${rows.length ? rows.map(r => `<div class="row"><div class="main"><b>${fmtDay(r.date)}</b><div class="sub">${MEAS.filter(([k]) => r[k]).map(([k, n]) => (k === 'weight' ? '' : n + ' ') + r[k] + (k === 'weight' ? ' кг' : ' см')).join(' · ')}</div></div><button class="btn del" data-delb="${r.id}">${ic('x')}</button></div>`).join('') : '<div class="empty">Нет замеров</div>'}</div>`;
  bindSeg(); $('#addB').onclick = bodySheet;
  document.querySelectorAll('[data-delb]').forEach(b => b.onclick = () => { S.body = S.body.filter(x => x.id !== b.dataset.delb); save(); render(); });
}

// ---------- stats ----------
function viewStats() {
  if (statView === 'body') return viewBody();
  const names = exNames(); if (!statSel.ex || !names.includes(statSel.ex)) statSel.ex = names[0] || null;
  $('#view').innerHTML = seg() + `
    <div class="card"><h2>Вес и замеры</h2><div class="chips">${MEAS.map(([k, n]) => `<button class="chip ${statSel.m === k ? 'on' : ''}" data-m="${k}">${n.replace(', кг', '')}</button>`).join('')}</div><canvas class="chart" id="c1"></canvas></div>
    <div class="card"><h2>Калории за 14 дней <small>цель сегодня ${goalFor(today()).kcal}</small></h2><canvas class="chart" id="c2"></canvas></div>
    <div class="card"><h2>Упражнение</h2>${names.length ? `<div class="chips">${names.map(n => `<button class="chip ${statSel.ex === n ? 'on' : ''}" data-e="${esc(n)}">${esc(n)}</button>`).join('')}</div>
      <div class="dim" style="margin:4px 0">Расчётный 1ПМ (лучший подход за день), кг</div><canvas class="chart" id="c3"></canvas>
      <div class="dim" style="margin:4px 0">Объём за тренировку, кг</div><canvas class="chart" id="c4"></canvas><div id="prs" class="sub dim"></div>` : '<div class="empty">Нет данных по тренировкам</div>'}</div>`;
  bindSeg();
  document.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { statSel.m = b.dataset.m; render(); });
  document.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { statSel.ex = b.dataset.e; render(); });
  chart($('#c1'), S.body.filter(b => b[statSel.m]).map(b => ({ x: ts(b.date), y: b[statSel.m] })).sort((a, b) => a.x - b.x), { color: '#60a5fa' });
  const days = []; for (let i = 13; i >= 0; i--) { const k = shiftDay(today(), -i); days.push({ x: ts(k), y: sumMeals(k).kcal }); }
  chart($('#c2'), days, { bars: true, zero: true, line: goalFor(today()).kcal });
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

// ---------- account & settings ----------
let moreSub = null;
const dayNames = () => WD_ORDER.filter(d => S.trainDays.includes(d)).map(d => WD[d]).join(' ') || 'не выбраны';
const mi = (id, icon, title, sub, cls = '') => `<button class="mi ${cls}" id="${id}"><span class="bd">${ic(icon)}</span><span class="tx"><b>${title}</b><small>${sub}</small></span>${ic('right', 'chev')}</button>`;
function viewMore() {
  const cloud = !!(CFG.url && user);
  const back = `<button class="back" id="back">${ic('left')}Аккаунт</button>`;
  const nav = () => { animate = true; window.scrollTo(0, 0); render(); };
  const flash = (el, text) => { const t = el.textContent; el.textContent = text; setTimeout(() => { el.textContent = t; }, 1200); };
  const goalFields = (p, v) => `<div class="grid2"><div><label>Ккал</label><input inputmode="numeric" id="${p}k" value="${v.kcal}"></div><div><label>Белки, г</label><input inputmode="numeric" id="${p}p" value="${v.p}"></div>
    <div><label>Жиры, г</label><input inputmode="numeric" id="${p}f" value="${v.f}"></div><div><label>Углеводы, г</label><input inputmode="numeric" id="${p}c" value="${v.c}"></div></div>`;

  if (!moreSub) {
    $('#view').innerHTML = `<div class="card profile"><div class="avatar">${esc((cloud ? user.email : 'G')[0].toUpperCase())}</div>
      <div class="main"><b>${cloud ? esc(user.email) : 'Локальный режим'}</b><div class="sub">${cloud ? (isAdmin ? 'Администратор' : 'Синхронизация включена') : 'Данные только на этом устройстве'}</div></div></div>
      <div class="card menu"><h2>Настройки</h2>
        ${mi('m-goals', 'bolt', 'Цели питания', `${S.goals.kcal} / ${S.goalsRest.kcal} ккал (тренировка / отдых)`)}
        ${mi('m-days', 'calendar', 'Тренировочные дни', dayNames())}
        ${mi('m-foods', 'utensils', 'Мои продукты', S.foods.length + ' шт.')}
        ${mi('m-data', 'db', 'Данные и копия', cloud ? 'Синхронизация, экспорт, импорт' : 'Экспорт и импорт')}
        ${isAdmin ? mi('m-admin', 'crown', 'Администратор', 'Общая база, код доступа') : ''}
      </div>
      ${cloud ? `<div class="card menu">${mi('logout', 'logout', 'Выйти', 'Данные останутся в облаке', 'danger')}</div>` : ''}`;
    [['goals', 'm-goals'], ['days', 'm-days'], ['foods', 'm-foods'], ['data', 'm-data'], ['admin', 'm-admin']].forEach(([k, id]) => { if ($('#' + id)) $('#' + id).onclick = () => { moreSub = k; nav(); }; });
  } else if (moreSub === 'goals') {
    $('#view').innerHTML = back + `<div class="card"><h2><span class="hic">${ic('bolt')}Тренировочный день</span></h2>${goalFields('g', S.goals)}</div>
      <div class="card"><h2><span class="hic">${ic('moon')}День отдыха</span></h2>${goalFields('r', S.goalsRest)}</div><button class="btn full" id="sg">Сохранить</button>`;
    $('#sg').onclick = () => {
      const rd = p => ({ kcal: num($(`#${p}k`).value), p: num($(`#${p}p`).value), f: num($(`#${p}f`).value), c: num($(`#${p}c`).value) });
      S.goals = rd('g'); S.goalsRest = rd('r'); save(); flash($('#sg'), 'Сохранено');
    };
  } else if (moreSub === 'days') {
    $('#view').innerHTML = back + `<div class="card"><h2>Тренировочные дни недели</h2><div id="tdays">${wdChips(S.trainDays)}</div>
      <div class="dim small" style="margin-top:10px">День также считается тренировочным, если в нём записана тренировка. Тип дня можно переключить вручную на вкладке «Питание».</div></div><button class="btn full" id="sg">Сохранить</button>`;
    bindChips($('#tdays'));
    $('#sg').onclick = () => { S.trainDays = pickedDays($('#tdays')); save(); flash($('#sg'), 'Сохранено'); };
  } else if (moreSub === 'foods') {
    $('#view').innerHTML = back + `<div class="card"><h2>Мои продукты (${S.foods.length})</h2>${S.foods.slice().sort((a, b) => a.name.localeCompare(b.name)).map(f => `<div class="row"><div class="main">${esc(f.name)}<div class="sub">${f.kcal} ккал · Б${f.p} Ж${f.f} У${f.c} /100г</div></div><button class="btn del" data-delfood="${f.id}">${ic('x')}</button></div>`).join('') || '<div class="empty">Пусто</div>'}</div>`;
    document.querySelectorAll('[data-delfood]').forEach(b => b.onclick = () => { S.foods = S.foods.filter(f => f.id !== b.dataset.delfood); save(); render(); });
  } else if (moreSub === 'data') {
    $('#view').innerHTML = back + (cloud ? `<div class="card"><h2>Синхронизация</h2><div class="sub dim" id="syncst" style="margin-bottom:10px">${esc(syncState)}</div><button class="btn ghost" id="syncnow">${ic('refresh')}Синхронизировать</button></div>` : '') +
      `<div class="card"><h2>Резервная копия</h2><div class="dim small" style="margin-bottom:10px">${cloud ? 'Данные хранятся в вашем аккаунте. Экспорт — дополнительная копия на всякий случай.' : 'Данные хранятся только в этом браузере. Делайте экспорт время от времени.'}</div>
      <div class="btns"><button class="btn ghost" id="exp">Экспорт JSON</button><button class="btn ghost" id="imp">Импорт</button></div><input type="file" id="impf" accept="application/json" hidden></div>`;
    $('#exp').onclick = () => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' }));
      a.download = 'gymbro-' + today() + '.json'; a.click();
    };
    $('#imp').onclick = () => $('#impf').click();
    $('#impf').onchange = async e => {
      try { const d = JSON.parse(await e.target.files[0].text()); if (!confirm('Заменить текущие данные импортированными?')) return; S = Object.assign(fresh(), d); save(); render(); }
      catch { alert('Неверный файл'); }
    };
  } else if (moreSub === 'admin') {
    $('#view').innerHTML = back + `<div class="card menu"><h2>Администратор</h2>${mi('admBase', 'db', 'Общая база', 'Продукты и упражнения всех пользователей')}${mi('admCode', 'key', 'Код доступа', 'Нужен новым пользователям при регистрации')}</div>`;
  }
  if ($('#back')) $('#back').onclick = () => { moreSub = null; nav(); };
  bindAccount();
}

// ---------- cloud sync (Supabase, optional) ----------
const CFG = window.GYMBRO_CONFIG || {};
const SYNC_KEY = 'gymbro.sync';
let sb = null, user = null, syncState = '', pushTimer = null, authReady = false, isAdmin = false;
const getSync = () => { try { return JSON.parse(localStorage.getItem(SYNC_KEY)) || {}; } catch { return {}; } };
const setSync = o => localStorage.setItem(SYNC_KEY, JSON.stringify(o));
const isEmptyState = () => !S.foods.length && !S.meals.length && !S.workouts.length && !S.body.length;
function setStatus(t) { syncState = t; const el = $('#syncst'); if (el) el.textContent = t; }
function schedulePush() { if (!sb || !user) return; clearTimeout(pushTimer); pushTimer = setTimeout(push, 1500); setStatus('Есть несохранённые изменения…'); }
async function push() {
  if (!sb || !user) return;
  clearTimeout(pushTimer);
  const at = S.updatedAt;
  const { error } = await sb.from('user_data').upsert({ user_id: user.id, data: S, updated_at: new Date().toISOString() });
  if (error) return setStatus('Ошибка синхронизации: ' + error.message);
  setSync({ uid: user.id, at });
  setStatus('Синхронизировано в ' + new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
}
async function pull() {
  if (!sb || !user) return;
  setStatus('Синхронизация…');
  const { data: row, error } = await sb.from('user_data').select('data').eq('user_id', user.id).maybeSingle();
  if (error) return setStatus('Ошибка синхронизации: ' + error.message);
  const remote = row && row.data;
  if (!remote) return push();
  const sy = getSync(), same = sy.uid === user.id;
  const localDirty = same ? S.updatedAt > (sy.at || 0) : !isEmptyState();
  const remoteNewer = (remote.updatedAt || 0) > (same ? sy.at || 0 : 0);
  if (!remoteNewer) return localDirty ? push() : setStatus('Синхронизировано');
  if (localDirty && !confirm('На устройстве и в облаке разные данные.\nОК — взять данные из облака (локальные заменятся).\nОтмена — загрузить данные этого устройства в облако.')) return push();
  S = Object.assign(fresh(), remote);
  localStorage.setItem(KEY, JSON.stringify(S)); setSync({ uid: user.id, at: S.updatedAt });
  setStatus('Загружено из облака'); render();
}
async function cloudInit() {
  try {
    if (!CFG.url || !CFG.anonKey || !window.supabase) return;
    sb = window.supabase.createClient(CFG.url, CFG.anonKey);
    try { const { data } = await sb.auth.getSession(); user = data.session ? data.session.user : null; } catch { return; }
    sb.auth.onAuthStateChange((_e, sess) => { user = sess ? sess.user : null; });
    if (user) { await pull(); loadSharedEx(); checkAdmin(); }
  } finally { authReady = true; render(); }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && user) pull(); });

function viewAuth() {
  $('#top').innerHTML = '<h1>GymBro</h1>';
  $('#view').innerHTML = `<div class="card"><h2>Вход</h2><div class="dim" style="margin-bottom:6px">Все данные хранятся в вашем аккаунте и доступны на любом устройстве.</div>
    <label>Email</label><input id="em" type="email" autocomplete="email" autocapitalize="none"><label>Пароль (от 6 символов)</label><input id="pw" type="password" autocomplete="current-password">
    <label>Код доступа (только для регистрации)</label><input id="ic" autocapitalize="none" autocomplete="off">
    <div id="autherr" class="sub" style="color:var(--bad);margin-top:6px"></div>
    <div class="btns" style="margin-top:8px"><button class="btn" id="login">Войти</button><button class="btn ghost" id="signup">Регистрация</button></div></div>`;
  bindAccount();
}
function bindAccount() {
  const err = t => { const e = $('#autherr'); if (e) e.textContent = t; };
  const auth = async mode => {
    const email = $('#em').value.trim(), password = $('#pw').value, code = $('#ic') ? $('#ic').value.trim() : '';
    if (!email || password.length < 6) return err('Введите email и пароль от 6 символов');
    if (mode === 'up' && !code) return err('Для регистрации нужен код доступа');
    err('…');
    const { data, error } = mode === 'up' ? await sb.auth.signUp({ email, password, options: { data: { invite_code: code } } }) : await sb.auth.signInWithPassword({ email, password });
    if (error) return err(mode === 'up' && /database error|unexpected/i.test(error.message) ? 'Неверный код доступа' : error.message);
    if (!data.session) return err('Проверьте почту и подтвердите email, затем нажмите «Войти».');
    user = data.session.user; await pull(); loadSharedEx(); checkAdmin(); render();
  };
  if ($('#login')) { $('#login').onclick = () => auth('in'); $('#signup').onclick = () => auth('up'); }
  if ($('#admBase')) $('#admBase').onclick = adminBase;
  if ($('#admCode')) $('#admCode').onclick = adminCode;
  if ($('#syncnow')) $('#syncnow').onclick = async () => { await push(); await pull(); };
  if ($('#logout')) $('#logout').onclick = async () => {
    if (!confirm('Выйти? Данные останутся в облаке, с устройства они удалятся.')) return;
    await push(); await sb.auth.signOut(); user = null; isAdmin = false;
    S = fresh(); moreSub = null; localStorage.removeItem(KEY); localStorage.removeItem(SYNC_KEY); syncState = ''; render();
  };
}


// ---------- shared database (foods & exercises) ----------
let sharedEx = [];
try { sharedEx = JSON.parse(localStorage.getItem('gymbro.sharedEx') || '[]'); } catch {}
async function loadSharedEx() {
  if (!sb || !user) return;
  const { data } = await sb.from('shared_exercises').select('name').order('name').limit(1000);
  if (data) { sharedEx = data.map(r => r.name); localStorage.setItem('gymbro.sharedEx', JSON.stringify(sharedEx)); }
}
async function shareExercise(name) {
  if (!sb || !user) return;
  const key = name.trim().toLowerCase();
  if (sharedEx.some(n => n.toLowerCase() === key)) return;
  sharedEx.push(name);
  await sb.from('shared_exercises').upsert({ name_key: key, name: name.trim() }, { onConflict: 'name_key', ignoreDuplicates: true });
}
async function shareFood(f) {
  if (!sb || !user) return;
  await sb.from('shared_foods').upsert({ name_key: f.name.trim().toLowerCase(), name: f.name.trim(), kcal: f.kcal, p: f.p, f: f.f, c: f.c, barcode: f.barcode || null }, { onConflict: 'name_key', ignoreDuplicates: true });
}
function adoptShared(r) {
  let f = S.foods.find(x => (r.barcode && x.barcode === r.barcode) || x.name.toLowerCase() === r.name.toLowerCase());
  if (!f) { f = { id: uid(), name: r.name, kcal: +r.kcal, p: +r.p, f: +r.f, c: +r.c, barcode: r.barcode || '' }; S.foods.push(f); save(); }
  return f;
}
let shT = null;
function searchShared(q) {
  clearTimeout(shT);
  const box = $('#slist'); if (!box) return;
  q = q.trim().replace(/[%_,()]/g, ' ');
  if (!sb || !user || q.length < 2) { box.innerHTML = ''; return; }
  shT = setTimeout(async () => {
    const { data } = await sb.from('shared_foods').select('*').ilike('name', '%' + q + '%').limit(15);
    const b = $('#slist'); if (!b) return;
    b.innerHTML = data && data.length ? '<div class="dim" style="margin:8px 0 2px">Общая база</div>' + data.map(f => `<div class="row" data-sid="${f.id}"><div class="main">${esc(f.name)}<div class="sub">${f.kcal} ккал · Б${f.p} Ж${f.f} У${f.c} /100г</div></div><button class="btn sm ghost">Выбрать</button></div>`).join('') : '';
    b.querySelectorAll('[data-sid]').forEach(r => r.onclick = () => addMealSheet(adoptShared(data.find(x => x.id === r.dataset.sid))));
  }, 300);
}


// ---------- admin ----------
async function checkAdmin() {
  if (!sb || !user) return;
  const { data } = await sb.rpc('is_admin');
  isAdmin = data === true;
  if (isAdmin && tab === 'more') render();
}
async function adminCode() {
  const { data } = await sb.from('app_config').select('value').eq('key', 'invite_code').maybeSingle();
  sheet(`<h2 style="margin-top:0">Код доступа</h2><div class="dim">Нужен новым пользователям при регистрации. Текущий код:</div>
    <input id="nc" value="${esc(data ? data.value : '')}" autocapitalize="none" autocomplete="off" style="margin:8px 0">
    <div class="btns"><button class="btn" id="ok">Сохранить</button><button class="btn ghost" id="cancel">Закрыть</button></div>`, () => {
    $('#cancel').onclick = closeSheet;
    $('#ok').onclick = async () => {
      const v = $('#nc').value.trim(); if (v.length < 4) return alert('Минимум 4 символа');
      const { error } = await sb.from('app_config').upsert({ key: 'invite_code', value: v });
      if (error) return alert(error.message);
      closeSheet();
    };
  });
}
async function adminBase() {
  sheet('<div class="empty">Загрузка…</div>');
  const [fx, ex] = await Promise.all([
    sb.from('shared_foods').select('id,name,kcal,p,f,c').order('name').limit(500),
    sb.from('shared_exercises').select('id,name').order('name').limit(500)]);
  const foods = fx.data || [], exs = ex.data || [];
  const draw = q => {
    q = q.trim().toLowerCase();
    const fl = foods.filter(f => f.name.toLowerCase().includes(q)), el = exs.filter(e => e.name.toLowerCase().includes(q));
    $('#alist').innerHTML = `<div class="dim" style="margin:6px 0 2px">Продукты (${fl.length})</div>` +
      (fl.map(f => `<div class="row"><div class="main">${esc(f.name)}<div class="sub">${f.kcal} ккал · Б${f.p} Ж${f.f} У${f.c}</div></div><button class="btn del" data-df="${f.id}">${ic('x')}</button></div>`).join('') || '<div class="empty">—</div>') +
      `<div class="dim" style="margin:10px 0 2px">Упражнения (${el.length})</div>` +
      (el.map(e => `<div class="row"><div class="main">${esc(e.name)}</div><button class="btn del" data-de="${e.id}">${ic('x')}</button></div>`).join('') || '<div class="empty">—</div>');
    const del = (table, list, id) => async () => {
      if (!confirm('Удалить из общей базы?')) return;
      const { error } = await sb.from(table).delete().eq('id', id);
      if (error) return alert(error.message);
      list.splice(list.findIndex(x => x.id === id), 1); if (table === 'shared_exercises') loadSharedEx(); draw($('#aq').value);
    };
    document.querySelectorAll('[data-df]').forEach(b => b.onclick = del('shared_foods', foods, b.dataset.df));
    document.querySelectorAll('[data-de]').forEach(b => b.onclick = del('shared_exercises', exs, b.dataset.de));
  };
  sheet(`<h2 style="margin-top:0">Общая база</h2><input id="aq" placeholder="Поиск…" autocomplete="off"><div id="alist"></div><div class="btns" style="margin-top:10px"><button class="btn ghost" id="cancel">Закрыть</button></div>`, () => {
    $('#cancel').onclick = closeSheet; $('#aq').oninput = e => draw(e.target.value); draw('');
  });
}

// ---------- shell ----------
const TITLES = { home: 'Сегодня', food: 'Питание', train: 'Тренировки', vit: 'Витамины', body: 'Тело', stats: 'Прогресс', more: 'Аккаунт' };
function render() {
  const loading = !!(CFG.url && !authReady), gate = !!(CFG.url && sb && !user);
  document.body.classList.toggle('gate', loading || gate);
  if (loading) { $('#top').innerHTML = '<h1>GymBro</h1>'; $('#view').innerHTML = '<div class="empty">Загрузка…</div>'; return; }
  if (gate) return viewAuth();
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const withDay = ['food', 'train', 'vit'].includes(tab);
  $('#top').innerHTML = `<h1>${TITLES[tab]}</h1>` + (withDay ? `<div class="nav"><button class="btn sm ghost icon" id="pd" aria-label="Назад">${ic('left')}</button><button class="btn sm ghost" id="td">${fmtDay(day)}</button><button class="btn sm ghost icon" id="nd" aria-label="Вперёд">${ic('right')}</button></div>` : '');
  if (withDay) {
    $('#pd').onclick = () => { day = shiftDay(day, -1); animate = true; render(); };
    $('#nd').onclick = () => { day = shiftDay(day, 1); animate = true; render(); };
    $('#td').onclick = () => { day = today(); animate = true; render(); };
  }
  $('#view').classList.toggle('anim', animate); animate = false;
  ({ home: viewHome, food: viewFood, train: viewTrain, vit: viewVit, body: viewBody, stats: viewStats, more: viewMore })[tab]();
}
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => { tab = b.dataset.tab; if (tab === 'more') moreSub = null; animate = true; window.scrollTo(0, 0); render(); });
// new day: checkmarks reset automatically because history is keyed by date
function checkRollover() {
  const t = today(); if (t === lastToday) return;
  if (day === lastToday) day = t;
  lastToday = t; animate = true; render();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkRollover(); });
setInterval(checkRollover, 30000);
render();
cloudInit();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
