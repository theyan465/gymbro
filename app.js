'use strict';

// ---------- storage ----------
const KEY = 'gymbro.v1';
const DEFAULTS = {
  foods: [], meals: [], goals: { kcal: 2200, p: 150, f: 70, c: 250 }, goalsRest: { kcal: 2000, p: 150, f: 65, c: 200 },
  trainDays: [1, 3, 5], dayType: {}, templates: [],
  wgoal: { mode: 'hold', rate: 0.5 }, schedule: {}, coachNutrition: null, coachTraining: null, coachTpl: { nutrition: [], training: [] }, coachApplied: [],
  rest: { on: true, sec: 90, sound: true }, plates: { bar: 20, list: [25, 20, 15, 10, 5, 2.5, 1.25] }, exMuscle: {},
  reminders: { on: false, vit: true, train: { on: true, time: '18:00' }, food: { on: true, time: '20:30' }, weigh: { on: false, day: 1, time: '08:00' } }, vitamins: [], vitLog: {}, workouts: [], body: [], updatedAt: 0,
};
const fresh = () => structuredClone(DEFAULTS);
// search matches the stored (Russian) name and the name as shown in the current language
const nameHas = (name, q) => { name = name.toLowerCase(); return name.includes(q) || tx(name).toLowerCase().includes(q); };
let S;
try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { S = fresh(); }
function migrateBody() {
  for (const r of S.body || []) {
    for (const [old, l, rr] of [['arm', 'armL', 'armR'], ['thigh', 'thighL', 'thighR']]) {
      if (r[old] !== undefined) { if (r[l] === undefined) r[l] = r[old]; if (r[rr] === undefined) r[rr] = r[old]; delete r[old]; }
    }
  }
}
migrateBody();
function save() { S.updatedAt = Date.now(); localStorage.setItem(KEY, JSON.stringify(S)); schedulePush(); }
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();

// ---------- helpers ----------
const $ = (s, r = document) => r.querySelector(s);
// tapping a filled field selects its content, so typing replaces the old value (not for notes/chat: textareas, dates, passwords)
document.addEventListener('focusin', e => {
  const el = e.target;
  if (!el || el.tagName !== 'INPUT' || el.readOnly || el.disabled || !/^(text|number|search|tel|)$/.test(el.type || '') || !el.value) return;
  const sel = () => { try { el.setSelectionRange(0, el.value.length); } catch { try { el.select(); } catch { /* ignore */ } } };
  sel(); setTimeout(sel, 30);
});
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };
const r1 = n => Math.round(n * 10) / 10;
const dkey = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
const today = () => dkey(new Date());
const shiftDay = (k, n) => { const d = new Date(k + 'T12:00:00'); d.setDate(d.getDate() + n); return dkey(d); };
const fmtDay = k => k === today() ? 'Сегодня' : new Date(k + 'T12:00:00').toLocaleDateString(LOC, { weekday: 'short', day: 'numeric', month: 'short' });
const dayLabel = k => { const t = today(); return k === t ? 'Сегодня' : k === shiftDay(t, -1) ? 'Вчера' : k === shiftDay(t, 1) ? 'Завтра' : new Date(k + 'T12:00:00').toLocaleDateString(LOC, { weekday: 'short', day: 'numeric', month: 'short' }); };
const longDay = k => new Date(k + 'T12:00:00').toLocaleDateString(LOC, { weekday: 'long', day: 'numeric', month: 'long' });
const e1rm = (w, r) => r <= 0 ? 0 : r === 1 ? w : w * (1 + r / 30); // Epley


// ---------- icons ----------
const ICONS = {
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>',
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
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  disc: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
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

// ---------- feedback: toast, button check, new-item highlight ----------
let toastT = null, lastAdded = null;
function toast(msg) {
  const t = $('#toast'); if (!t) return;
  clearTimeout(toastT); t.classList.remove('show'); void t.offsetWidth;
  t.innerHTML = `<span class="tk"><svg viewBox="0 0 24 24"><path d="M6.5 12.5l3.6 3.6L17.5 8.5"/></svg></span><span>${esc(msg)}</span>`;
  t.classList.add('show'); toastT = setTimeout(() => t.classList.remove('show'), 1700);
}
// turns the button into a check mark, then runs `then` (and shows a toast)
function okBtn(btn, then, msg, restore) {
  if (!btn || btn.dataset.busy) return then && then();
  btn.dataset.busy = '1'; const orig = btn.innerHTML; btn.style.minWidth = btn.offsetWidth + 'px';
  btn.classList.add('success'); btn.innerHTML = ic('check');
  setTimeout(() => {
    if (restore) { btn.classList.remove('success'); btn.innerHTML = orig; btn.style.minWidth = ''; delete btn.dataset.busy; }
    then && then(); if (msg) toast(msg);
  }, 420);
}
const isNew = id => lastAdded === id ? 'new' : '';
function renderNew(id) { lastAdded = id; render(); lastAdded = null; }

// ---------- chart ----------
function chart(canvas, series, opts = {}) {
  const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const g = canvas.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, W, H);
  const pts = series.filter(p => isFinite(p.y)), ex = (opts.extra || []).filter(p => isFinite(p.y));
  if (pts.length < 1) { g.fillStyle = '#8b95a3'; g.font = '14px sans-serif'; g.textAlign = 'center'; g.fillText(tx('Нет данных'), W / 2, H / 2); return; }
  const L = 38, R = 8, T = 10, B = 20;
  let ys = pts.map(p => p.y).concat(ex.map(p => p.y)), lo = Math.min(...ys), hi = Math.max(...ys);
  if (opts.zero) { lo = 0; if (hi <= 0) hi = 1; }
  if (hi === lo) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * 0.1; if (!opts.zero) { lo -= pad; } hi += pad;
  const xs = pts.map(p => p.x).concat(ex.map(p => p.x)), x0 = Math.min(...xs), x1 = Math.max(...xs) || 1;
  const X = x => L + (x1 === x0 ? (W - L - R) / 2 : (x - x0) / (x1 - x0) * (W - L - R));
  const Y = y => T + (1 - (y - lo) / (hi - lo)) * (H - T - B);
  g.strokeStyle = '#2a313b'; g.fillStyle = '#8b95a3'; g.font = '11px sans-serif'; g.textAlign = 'right';
  for (let i = 0; i <= 3; i++) { const v = lo + (hi - lo) * i / 3, y = Y(v); g.beginPath(); g.moveTo(L, y); g.lineTo(W - R, y); g.stroke(); g.fillText(Math.round(v * 10) / 10, L - 4, y + 4); }
  g.textAlign = 'center';
  const fx = x => new Date(x).toLocaleDateString(LOC, { day: 'numeric', month: 'short' });
  g.fillText(fx(x0), L + 14, H - 5); if (x1 !== x0) g.fillText(fx(x1), W - R - 14, H - 5);
  const col = opts.color || '#4ade80';
  if (opts.bars) {
    const bw = Math.max(3, Math.min(24, (W - L - R) / pts.length * 0.7));
    g.fillStyle = col; pts.forEach(p => { const y = Y(p.y); g.fillRect(X(p.x) - bw / 2, y, bw, Y(lo) - y); });
    if (opts.line != null) { g.strokeStyle = '#fbbf24'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(L, Y(opts.line)); g.lineTo(W - R, Y(opts.line)); g.stroke(); g.setLineDash([]); }
  } else {
    if (!opts.dotsOnly) { g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(X(p.x), Y(p.y)) : g.moveTo(X(p.x), Y(p.y))); g.stroke(); }
    g.fillStyle = col; g.globalAlpha = opts.dotsOnly ? 0.55 : 1; pts.forEach(p => { g.beginPath(); g.arc(X(p.x), Y(p.y), opts.dotsOnly ? 3.5 : 3, 0, 7); g.fill(); }); g.globalAlpha = 1;
    if (ex.length > 1) { g.strokeStyle = opts.extraColor || '#34d399'; g.lineWidth = 3; g.lineJoin = 'round'; g.beginPath(); ex.forEach((p, i) => i ? g.lineTo(X(p.x), Y(p.y)) : g.moveTo(X(p.x), Y(p.y))); g.stroke(); }
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
  const d = day, tdy = today(), h = habits(d), di = dayInfo(d), t = sumMeals(d), all = streak('all'), isToday = d === tdy, future = d > tdy;
  const wk = []; for (let i = 6; i >= 0; i--) wk.push(shiftDay(tdy, -i));
  const app = Object.values(h).filter(v => v !== null), doneN = app.filter(Boolean).length;
  const dayW = S.workouts.find(w => w.date === d), exs = dayW ? dayW.exercises.filter(e => e.sets.length) : [];
  const vol = exs.reduce((a, e) => a + e.sets.reduce((x, y) => x + y.w * y.r, 0), 0), setsN = exs.reduce((a, e) => a + e.sets.length, 0);
  const due = S.vitamins.filter(v => vitDue(v, d)), vdone = due.filter(v => vitTaken(v, d)).length;
  const wts = S.body.filter(b => b.weight && b.date <= d).sort((a, b) => b.date.localeCompare(a.date)), w0 = wts[0], w1 = wts[1];
  const dayWeight = S.body.find(b => b.date === d && b.weight);
  const when = isToday ? 'сегодня' : 'в этот день';
  const hab = (icon, name, state, kind, target) => `<div class="hab ${state}" data-go="${target}">${ic(icon)}<span>${name}</span><em>${state === 'done' ? ic('check') : state === 'na' ? '—' : ic('circle')}</em><i>${ic('flame')}${streak(kind)}</i></div>`;
  const st = v => v === null ? 'na' : v ? 'done' : 'todo';
  $('#view').innerHTML = `
    <div class="card hero3">
      <div class="flamebig ${all ? '' : 'off'}">${ic('flame')}</div>
      <div class="main"><div class="big">${all}<small> ${plural(all, ['день', 'дня', 'дней'])} подряд</small></div>
        <div class="dim">${longDay(d)} · выполнено ${doneN} из ${app.length}</div></div>
    </div>
    ${typeof coachHomeCard === 'function' ? coachHomeCard() : ''}
    <div class="habs">${hab('utensils', 'Питание', st(h.nutr), 'nutr', 'food')}${hab('dumbbell', 'Тренировка', st(h.train), 'train', 'train')}${hab('pill', 'Витамины', st(h.vit), 'vit', 'vit')}</div>
    <div class="card week"><h2>Последние 7 дней</h2><div class="wk">${wk.map(k => `<div class="wd1 ${k === tdy ? 'tdy' : ''} ${k === d ? 'sel' : ''}" data-dk="${k}"><small>${WD[wday(k)]}</small><div class="dayc" style="--p:${Math.round(dayFrac(k) * 100)}"><span>${+k.slice(8)}</span></div></div>`).join('')}</div></div>
    <div class="link" data-go="food">${ringCard(t, goalFor(d))}</div>
    <div class="card"><h2><span>Тренировка</span><span class="tag ${di.train ? 'train' : 'rest'}">${ic(di.train ? 'bolt' : 'moon')}${di.train ? 'Тренировочный день' : 'День отдыха'}</span></h2>
      ${exs.length ? `<div class="sub" style="margin-bottom:10px">${exs.length} упр. · ${setsN} подходов · объём ${Math.round(vol)} кг</div><button class="btn ghost" data-go="train">Открыть тренировку</button>`
        : di.train ? `<div class="sub" style="margin-bottom:10px">${future ? 'По плану в этот день тренировка' : isToday ? 'По плану сегодня тренировка' : 'В этот день тренировка не записана'}</div><button class="btn" data-go="train">${ic('plus')}${isToday || future ? 'Начать' : 'Записать'}</button>` : `<div class="sub">${isToday ? 'Сегодня отдых — восстанавливайтесь. Если потренируетесь, день станет тренировочным.' : 'День отдыха.'}</div>`}</div>
    <div class="card"><h2><span>Витамины</span><span class="tag">${vdone} / ${due.length}</span></h2>
      ${due.map(v => `<div class="vit ${vitTaken(v, d) ? 'on' : ''} ${lastVit === v.id ? 'pop' : ''}" data-hvit="${v.id}"><span class="chk">${ic('check')}</span><div class="main"><b>${esc(v.name)}</b><div class="sub">${[v.time, v.dose, v.when].filter(Boolean).map(esc).join(' · ') || '&nbsp;'}</div></div></div>`).join('') || `<div class="sub">На ${isToday ? 'сегодня' : 'этот день'} ничего не запланировано</div>`}</div>
    <div class="card"><h2>Вес</h2><div class="wrow"><div>${w0 ? `<div class="big">${w0.weight}<small> кг</small></div><div class="dim">${dayWeight ? (w1 ? (w0.weight - w1.weight > 0 ? '+' : '') + r1(w0.weight - w1.weight) + ' кг с ' + fmtDay(w1.date) : 'замер ' + when) : 'последний замер: ' + fmtDay(w0.date)}</div>` : '<div class="dim">Пока нет замеров</div>'}</div><button class="btn ghost" id="hw">${ic('plus')}Записать</button></div></div>`;
  if (typeof coachBindHome === 'function') coachBindHome();
  document.querySelectorAll('[data-go]').forEach(e => e.onclick = () => goTab(e.dataset.go, d));
  document.querySelectorAll('[data-dk]').forEach(e => e.onclick = () => { day = e.dataset.dk; animate = true; render(); });
  document.querySelectorAll('[data-hvit]').forEach(r => r.onclick = () => toggleVit(r.dataset.hvit, d));
  $('#hw').onclick = () => bodySheet(d);
}


// ---------- calendar ----------
const dayDots = k => ({
  food: S.meals.some(m => m.date === k),
  train: S.workouts.some(w => w.date === k && w.exercises.some(e => e.sets.length)),
  vit: (S.vitLog[k] || []).length > 0,
  body: S.body.some(b => b.date === k),
});
function calendarSheet(ym) {
  const draw = ym => {
    const [Y, M] = ym.split('-').map(Number), lead = (new Date(Y, M - 1, 1).getDay() + 6) % 7, n = new Date(Y, M, 0).getDate(), tdy = today();
    const title = new Date(Y, M - 1, 1).toLocaleDateString(LOC, { month: 'long', year: 'numeric' });
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<i class="calblank"></i>');
    for (let i = 1; i <= n; i++) {
      const k = `${Y}-${String(M).padStart(2, '0')}-${String(i).padStart(2, '0')}`, dd = dayDots(k), has = dd.food || dd.train || dd.vit || dd.body;
      const frac = has ? Math.round(dayFrac(k) * 100) : 0;
      cells.push(`<button class="cal ${has ? 'has' : 'empty'} ${k === tdy ? 'tdy' : ''} ${k === day ? 'sel' : ''} ${k > tdy ? 'fut' : ''}" data-k="${k}"><span class="cn" style="--p:${frac}">${i}</span><span class="cd">${dd.food ? '<b class="d1"></b>' : ''}${dd.train ? '<b class="d2"></b>' : ''}${dd.vit ? '<b class="d3"></b>' : ''}${dd.body ? '<b class="d4"></b>' : ''}</span></button>`);
    }
    $('#calbody').innerHTML = `<div class="calhead"><button class="btn sm ghost icon" data-cm="-1" aria-label="Предыдущий месяц">${ic('left')}</button><b>${title[0].toUpperCase() + title.slice(1).replace(/\s*г\.$/, '')}</b><button class="btn sm ghost icon" data-cm="1" aria-label="Следующий месяц">${ic('right')}</button></div>
      <div class="calgrid calwd">${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(x => `<small>${x}</small>`).join('')}</div>
      <div class="calgrid">${cells.join('')}</div>
      <div class="legend" style="margin-top:14px"><span><b class="d1"></b>еда</span><span><b class="d2"></b>тренировка</span><span><b class="d3"></b>витамины</span><span><b class="d4"></b>замер</span></div>
      <div class="dim small" style="margin-top:8px">Дни без записей показаны пустыми. Кольцо — доля выполненного за день.</div>`;
    document.querySelectorAll('[data-cm]').forEach(b => b.onclick = () => { const dt = new Date(Y, M - 1 + +b.dataset.cm, 1); draw(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`); });
    document.querySelectorAll('.cal').forEach(b => b.onclick = () => { day = b.dataset.k; closeSheet(); animate = true; render(); });
  };
  sheet(`<h2 class="sh">Календарь</h2><div id="calbody"></div>
    <div class="btns" style="margin-top:12px"><button class="btn ghost" id="caltoday">К сегодняшнему дню</button></div>`, () => {
    $('#caltoday').onclick = () => { day = today(); closeSheet(); animate = true; render(); };
    draw(ym);
  });
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

const MT = [['b', 'Завтрак'], ['l', 'Обед'], ['d', 'Ужин'], ['s', 'Перекус']];
const autoType = () => { const h = new Date().getHours(); return h < 11 ? 'b' : h < 16 ? 'l' : h < 21 ? 'd' : 's'; };
let addType = null, foodChoose = null;
const chooseFood = f => foodChoose ? foodChoose(f) : addMealSheet(f);
// which meal groups are folded (remembered on this device)
const foldSet = () => { try { return new Set(JSON.parse(localStorage.getItem('gymbro.fold') || '[]')); } catch { return new Set(); } };
const folded = k => foldSet().has(k);
function viewFood() {
  const t = sumMeals(day), g = goalFor(day), meals = S.meals.filter(m => m.date === day), dt = dayInfo(day);
  const mealRow = m => `<div class="row pick ${isNew(m.id)}" data-editmeal="${m.id}"><div class="main">${esc(m.name)}${m.byCoach ? '<span class="tag train">тренер</span>' : ''}<div class="sub">${m.g} г · Б${r1(m.p)} Ж${r1(m.f)} У${r1(m.c)}</div></div><b>${Math.round(m.kcal)}</b><button class="btn del" data-delmeal="${m.id}">${ic('x')}</button></div>`;
  const groups = [...MT.map(([k, n]) => [k, n, meals.filter(m => m.type === k)]), ['', 'Без категории', meals.filter(m => !m.type)]].filter(([k, , l]) => k || l.length);
  $('#view').innerHTML = `
    <div class="toprow"><button class="daytype ${dt.train ? 'train' : 'rest'}" id="dt">${ic(dt.train ? 'bolt' : 'moon')}<span>${dt.train ? 'Тренировочный день' : 'День отдыха'}</span><small>${dt.src}</small></button>${streakChip('nutr')}</div>
    ${ringCard(t, g)}
    <div class="${day !== today() && meals.length ? 'actions2 eq' : ''}" style="${day !== today() && meals.length ? '' : 'margin-bottom:12px'}"><button class="btn ghost ${day !== today() && meals.length ? '' : 'full'}" id="copy" style="margin:0">${ic('copy')}Копировать из другого дня</button>${day !== today() && meals.length ? `<button class="btn" id="copytoday">${ic('copy')}Этот день → сегодня</button>` : ''}</div>
    ${typeof coachFoodCard === 'function' ? coachFoodCard() : ''}
    <div class="card"><h2>Приёмы пищи</h2>
      ${groups.map(([k, n, list]) => `<div class="mgroup ${folded(k) ? 'folded' : ''}"><div class="mgh" data-tog="${k}" role="button" aria-expanded="${!folded(k)}"><i class="chv">${ic('right')}</i><b>${n}</b><span>${list.length ? Math.round(list.reduce((a, m) => a + m.kcal, 0)) + ' ккал' : ''}${folded(k) && list.length ? ' · ' + list.length : ''}</span>${k ? `<button class="btn sm ghost addto" data-addto="${k}" aria-label="Добавить в ${n}">${ic('plus')}Добавить</button>` : ''}</div>${list.length ? `<div class="mgm">Б${r1(list.reduce((a, m) => a + m.p, 0))} Ж${r1(list.reduce((a, m) => a + m.f, 0))} У${r1(list.reduce((a, m) => a + m.c, 0))}</div>` : ''}<div class="mgbody">${list.map(mealRow).join('') || '<div class="sub dim" style="padding:2px 0 8px">Пусто</div>'}</div></div>`).join('')}
    </div>`;
  $('#dt').onclick = () => {
    const want = !dt.train;
    if (want === autoTrain(day)) delete S.dayType[day]; else S.dayType[day] = want;
    save(); render();
  };
  document.querySelectorAll('[data-addto]').forEach(b => b.onclick = e => { e.stopPropagation(); addType = b.dataset.addto; pickFood(); });
  document.querySelectorAll('[data-tog]').forEach(h => h.onclick = () => {
    const k = h.dataset.tog, g = h.parentElement, on = g.classList.toggle('folded'); h.setAttribute('aria-expanded', String(!on));
    const set = foldSet(); if (on) set.add(k); else set.delete(k); try { localStorage.setItem('gymbro.fold', JSON.stringify([...set])); } catch { /* ignore */ }
    const cnt = S.meals.filter(m => m.date === day && (m.type || '') === k).length, sp = h.querySelector('span'); sp.textContent = sp.textContent.replace(/ · \d+$/, '') + (on && cnt ? ' · ' + cnt : '');
  });
  $('#copy').onclick = () => copyMealsSheet();
  if ($('#copytoday')) $('#copytoday').onclick = () => copyMealsSheet({ target: today(), src: day });
  document.querySelectorAll('[data-delmeal]').forEach(b => b.onclick = e => { e.stopPropagation(); S.meals = S.meals.filter(m => m.id !== b.dataset.delmeal); save(); render(); });
  document.querySelectorAll('[data-editmeal]').forEach(r => r.onclick = () => editMealSheet(S.meals.find(m => m.id === r.dataset.editmeal)));
}

// edit an already logged meal: name, meal, grams (macros follow the grams until edited by hand), macros
function editMealSheet(m) {
  if (!m) return;
  let type = m.type || '', touched = false;
  const base = m.g > 0 ? { kcal: m.kcal / m.g, p: m.p / m.g, f: m.f / m.g, c: m.c / m.g } : null;
  sheet(`<h2 class="sh">Изменить запись</h2>
    <label style="margin-top:0">Название</label><input id="en" value="${esc(m.name)}" maxlength="120" autocomplete="off">
    <label>Приём пищи</label><div class="chips">${[...MT, ['', 'Без категории']].map(([k, n]) => `<button class="chip ${k === type ? 'on' : ''}" data-et="${k}">${n}</button>`).join('')}</div>
    <label>Граммы</label><input id="eg" inputmode="decimal" value="${m.g}">
    <div class="grid2"><div><label>Ккал</label><input id="ek" inputmode="decimal" value="${Math.round(m.kcal)}"></div><div><label>Белки, г</label><input id="ep" inputmode="decimal" value="${r1(m.p)}"></div>
    <div><label>Жиры, г</label><input id="ef" inputmode="decimal" value="${r1(m.f)}"></div><div><label>Углеводы, г</label><input id="ec" inputmode="decimal" value="${r1(m.c)}"></div></div>
    <div class="btns" style="margin-top:14px"><button class="btn" id="eok">Сохранить</button><button class="btn ghost danger" id="edel">Удалить запись</button></div>`, p => {
    p.querySelectorAll('[data-et]').forEach(b => b.onclick = () => { type = b.dataset.et; p.querySelectorAll('[data-et]').forEach(x => x.classList.toggle('on', x === b)); });
    ['#ek', '#ep', '#ef', '#ec'].forEach(id => { $(id).oninput = () => { touched = true; }; });
    $('#eg').oninput = () => {
      const g = num($('#eg').value); if (!base || touched || !(g > 0)) return;
      $('#ek').value = Math.round(base.kcal * g); $('#ep').value = r1(base.p * g); $('#ef').value = r1(base.f * g); $('#ec').value = r1(base.c * g);
    };
    $('#eok').onclick = () => {
      const name = $('#en').value.trim(); if (!name) return $('#en').focus();
      Object.assign(m, { name, type, g: num($('#eg').value), kcal: num($('#ek').value), p: num($('#ep').value), f: num($('#ef').value), c: num($('#ec').value) });
      save(); okBtn($('#eok'), () => { closeSheet(); render(); }, 'Сохранено');
    };
    $('#edel').onclick = () => { S.meals = S.meals.filter(x => x.id !== m.id); save(); closeSheet(); render(); };
  });
}

// copy meals between days (also: copy a past day into today)
function copyMealsSheet(opts = {}) {
  let target = opts.target || day, src = opts.src || shiftDay(target, -1), picked = new Set();
  const sheetHtml = () => `<h2 class="sh">Копировать приёмы пищи</h2>
    ${day !== today() ? `<label style="margin-top:0">Куда</label><div class="chips" id="ctarget"><button class="chip ${target === day ? 'on' : ''}" data-t="${day}">В ${esc(dayLabel(day).toLowerCase())}</button><button class="chip ${target === today() ? 'on' : ''}" data-t="${today()}">В сегодня</button></div>` : ''}
    <label ${day !== today() ? '' : 'style="margin-top:0"'}>Откуда (дата)</label><input type="date" id="csrc" value="${src}">
    <div class="chips" style="margin-top:8px"><button class="chip" data-q="${shiftDay(target, -1)}">Вчера</button>${day !== target ? `<button class="chip" data-q="${day}">Просматриваемый день</button>` : ''}<button class="chip" data-q="${shiftDay(target, -7)}">Неделю назад</button></div>
    <div id="clist" style="margin-top:10px"></div>
    <button class="btn full" id="cgo" style="margin-top:10px">Скопировать</button>`;
  const drawList = () => {
    const list = S.meals.filter(m => m.date === src), box = $('#clist'); if (!box) return;
    if (!list.length) { box.innerHTML = `<div class="empty">${src === target ? 'Это тот же день.' : 'В выбранный день записей нет.'}</div>`; picked = new Set(); }
    else {
      if (![...picked].some(id => list.find(m => m.id === id)) && !box.dataset.touched) picked = new Set(list.map(m => m.id));
      box.innerHTML = `<label class="chkrow all"><input type="checkbox" id="call" ${picked.size === list.length ? 'checked' : ''}><i></i><span>Выбрать всё · ${list.length}</span></label>` + [...MT, ['', 'Без категории']].map(([k, n]) => { const l = list.filter(m => (m.type || '') === k); return l.length ? `<div class="sub dim" style="margin:8px 0 2px">${n}</div>` + l.map(m => `<label class="chkrow"><input type="checkbox" data-m="${m.id}" ${picked.has(m.id) ? 'checked' : ''}><i></i><span>${esc(m.name)}<small>${m.g} г · ${Math.round(m.kcal)} ккал</small></span></label>`).join('') : ''; }).join('');
      $('#call').onchange = e => { box.dataset.touched = '1'; picked = e.target.checked ? new Set(list.map(m => m.id)) : new Set(); drawList(); };
      box.querySelectorAll('[data-m]').forEach(c => c.onchange = () => { box.dataset.touched = '1'; c.checked ? picked.add(c.dataset.m) : picked.delete(c.dataset.m); $('#cgo').textContent = `Скопировать (${picked.size})`; $('#call').checked = picked.size === list.length; });
    }
    $('#cgo').textContent = `Скопировать (${picked.size}) → ${dayLabel(target).toLowerCase()}`; $('#cgo').disabled = !picked.size || src === target;
  };
  const wire = p => {
    p.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { target = b.dataset.t; sheet(sheetHtml(), wire); });
    p.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { src = b.dataset.q; sheet(sheetHtml(), wire); });
    $('#csrc').onchange = e => { if (e.target.value) { src = e.target.value; $('#clist').dataset.touched = ''; picked = new Set(); drawList(); } };
    $('#cgo').onclick = () => {
      const list = S.meals.filter(m => m.date === src && picked.has(m.id)); if (!list.length) return;
      list.forEach(m => S.meals.push({ ...m, id: uid(), date: target })); save();
      okBtn($('#cgo'), () => { closeSheet(); day = target; animate = true; render(); }, `Скопировано: ${list.length}`);
    };
    drawList();
  };
  sheet(sheetHtml(), wire);
}

function pickFood(opts = {}) {
  foodChoose = opts.onPick || null;
  const cloud = !!(sb && user), mt = !opts.onPick && addType && MT.find(x => x[0] === addType);
  let pt = 'mine', shared = [], shT = null, shSeq = 0;
  const sub = f => `${f.kcal} ккал · Б${f.p} Ж${f.f} У${f.c} /100г${f.serving ? ' · порция ' + f.serving + ' г' : ''}`;
  const row = f => `<div class="row" data-id="${f.id}"><div class="main">${esc(f.name)}${f.dish ? '<span class="tag dishtag">блюдо</span>' : ''}<div class="sub">${sub(f)}</div></div><button class="btn sm ghost">Выбрать</button></div>`;
  const srow = f => { const mine = !!findMine(f); return `<div class="row" data-sid="${f.id}"><div class="main">${esc(f.name)}${f.dish ? '<span class="tag dishtag">блюдо</span>' : ''}<div class="sub">${sub(f)}</div></div>${mine ? `<span class="tag train">${ic('check')}В моих</span>` : `<button class="btn sm ghost" data-sadd="${f.id}">${ic('plus')}В мои</button>`}</div>`; };
  const draw = q => {
    q = q.trim().toLowerCase();
    let html;
    if (!q) {
      const recent = S.foods.filter(f => f.lastAt).sort((a, b) => b.lastAt - a.lastAt).slice(0, 6), ids = new Set(recent.map(f => f.id));
      const rest = S.foods.filter(f => !ids.has(f.id)).sort((a, b) => (b.used || 0) - (a.used || 0)).slice(0, 30);
      html = (recent.length ? `<div class="dim small" style="margin:4px 0 0">Недавние</div>${recent.map(row).join('')}` : '') + (rest.length ? `<div class="dim small" style="margin:8px 0 0">${recent.length ? 'Остальные' : 'Мои продукты'}</div>${rest.map(row).join('')}` : '');
    } else html = S.foods.filter(f => nameHas(f.name, q)).sort((a, b) => (b.used || 0) - (a.used || 0)).slice(0, 30).map(row).join('');
    $('#flist').innerHTML = html || `<div class="empty">${S.foods.length ? 'Ничего не найдено в моих продуктах.' : 'В моих продуктах пока пусто.'}${cloud ? ' Загляните в «Общая база» или создайте новый.' : ''}</div>`;
    document.querySelectorAll('#flist [data-id]').forEach(r => r.onclick = () => chooseFood(S.foods.find(f => f.id === r.dataset.id)));
  };
  const drawShared = () => {
    const box = $('#flist'); if (!box) return;
    box.innerHTML = shared.length ? shared.map(srow).join('') : '<div class="empty">В общей базе ничего не найдено.</div>';
    box.querySelectorAll('[data-sid]').forEach(r => r.onclick = e => {
      const x = shared.find(y => y.id === r.dataset.sid); if (!x) return;
      if (e.target.closest('[data-sadd]')) { adoptShared(x); toast('Добавлено в мои продукты'); drawShared(); return; }
      chooseFood(adoptShared(x));
    });
  };
  const loadShared = q => {
    clearTimeout(shT); const seq = ++shSeq; q = q.trim().replace(/[%_,()]/g, ' ');
    $('#flist').innerHTML = '<div class="empty">Загрузка…</div>';
    shT = setTimeout(async () => {
      let qb = sb.from('shared_foods').select('*'); qb = q.length >= 2 ? qb.ilike('name', '%' + q + '%') : qb.order('created_at', { ascending: false });
      const { data } = await qb.limit(40); if (seq !== shSeq || pt !== 'shared') return;
      shared = (data || []).map(cleanShared); drawShared();
    }, q ? 300 : 0);
  };
  const go = () => { const q = $('#q').value; document.querySelectorAll('#ptabs [data-pt]').forEach(b => b.classList.toggle('on', b.dataset.pt === pt)); pt === 'mine' ? draw(q) : loadShared(q); };
  sheet(`<h2 class="sh">${opts.onPick ? 'Выберите продукт' : mt ? 'Добавить · ' + mt[1] : 'Продукт'}</h2>
    <div class="pacts">${opts.onPick ? '' : `<button class="btn ghost" id="pscan">${ic('scan')}Штрихкод</button><button class="btn ghost" id="pocr">${ic('file')}Этикетка</button>`}<button class="btn" id="newf">${ic('plus')}Новый продукт</button>${opts.onPick ? '' : `<button class="btn ghost" id="dish">${ic('utensils')}Блюдо</button><button class="btn ghost" id="quick">Быстро: только ккал</button>`}</div>
    ${cloud ? `<div class="seg" id="ptabs" style="margin-top:10px"><button data-pt="mine" class="on">Мои продукты</button><button data-pt="shared">Общая база</button></div>` : ''}
    <input id="q" placeholder="Поиск..." autocomplete="off" style="margin-top:10px"><div id="flist" style="margin:8px 0"></div>`, () => {
    draw(''); $('#q').oninput = e => { pt === 'mine' ? draw(e.target.value) : loadShared(e.target.value); };
    document.querySelectorAll('#ptabs [data-pt]').forEach(b => b.onclick = () => { if (pt !== b.dataset.pt) { pt = b.dataset.pt; go(); } });
    $('#newf').onclick = () => foodForm(opts.onPick ? { onSave: opts.onPick } : {});
    if ($('#quick')) $('#quick').onclick = () => foodForm({ name: 'Быстрая запись', quick: true });
    if ($('#dish')) $('#dish').onclick = () => dishEditor({ name: '', items: [], cooked: '' });
    if ($('#pscan')) $('#pscan').onclick = () => scanBarcode();
    if ($('#pocr')) $('#pocr').onclick = () => ocrLabel();
  });
}

// ---------- dishes (recipes): several products with grams, saved as one food ----------
const dishTotals = d => {
  const t = d.items.reduce((a, i) => { const k = i.g / 100; a.kcal += i.kcal * k; a.p += i.p * k; a.f += i.f * k; a.c += i.c * k; a.sum += i.g; return a; }, { kcal: 0, p: 0, f: 0, c: 0, sum: 0 });
  t.w = num(d.cooked) > 0 ? num(d.cooked) : t.sum; return t;
};
function askGrams(food, cb) {
  sheet(`<h2 class="sh">${esc(food.name)}</h2><label style="margin-top:0">Сколько грамм?</label><input id="ag" inputmode="decimal" value="100" autocomplete="off">
    <div class="btns" style="margin-top:12px"><button class="btn" id="agok">Добавить</button></div>`, () => {
    $('#ag').focus(); $('#ag').select();
    $('#agok').onclick = () => { const g = num($('#ag').value); if (g > 0) cb(g); };
    $('#ag').onkeydown = e => { if (e.key === 'Enter') $('#agok').click(); };
  });
}
function dishEditor(draft) {
  const one = !!draft.oneOff;
  sheet(`<h2 class="sh">${one ? 'Состав на этот раз' : draft.id ? 'Блюдо' : 'Новое блюдо'}</h2>
    ${one ? `<div class="dim small">Измените граммы или добавьте продукты. Сохранённое блюдо останется прежним.</div>` : `<label style="margin-top:0">Название</label><input id="dn" value="${esc(draft.name)}" placeholder="Например: Борщ, Омлет с сыром">`}
    <label>Продукты и количество</label>
    <div id="ditems">${draft.items.map((it, i) => `<div class="drow"><div class="main"><b>${esc(it.n)}</b><div class="sub" data-sub="${i}"></div></div><input class="dg" inputmode="decimal" data-g="${i}" value="${it.g}"><span class="dim">г</span><button class="btn del" data-rm="${i}" aria-label="Убрать">${ic('x')}</button></div>`).join('') || '<div class="empty">Добавьте продукты из вашей базы</div>'}</div>
    <button class="btn ghost" id="dadd" style="margin-top:6px">${ic('plus')}Продукт</button>
    <label>Вес готового блюда, г <small class="dim">— если при готовке вес меняется</small></label><input id="dcook" inputmode="decimal" value="${draft.cooked || ''}" placeholder="по умолчанию сумма продуктов">
    <div class="dsum" id="dsum"></div>
    ${!one && !draft.id && sb && user ? `<label style="display:flex;gap:8px;align-items:center;color:var(--txt);font-size:14px"><input type="checkbox" id="dshare" style="width:auto"> Добавить в общую базу</label>` : ''}
    <div class="btns" style="margin-top:14px"><button class="btn" id="dsave">${one ? 'Добавить в дневник' : draft.id ? 'Сохранить блюдо' : 'Сохранить блюдо'}</button></div>`, p => {
    const sync = () => { if ($('#dn')) draft.name = $('#dn').value; draft.cooked = $('#dcook').value; };
    const upd = () => {
      sync(); const t = dishTotals(draft);
      draft.items.forEach((it, i) => { const el = p.querySelector(`[data-sub="${i}"]`); if (el) el.textContent = `${Math.round(it.kcal * it.g / 100)} ккал`; });
      $('#dsum').innerHTML = draft.items.length ? `<div><b>${Math.round(t.w)} г</b> · ${Math.round(t.kcal)} ккал · Б${r1(t.p)} Ж${r1(t.f)} У${r1(t.c)}</div><div class="dim small">На 100 г: ${Math.round(t.kcal * 100 / t.w)} ккал · Б${r1(t.p * 100 / t.w)} Ж${r1(t.f * 100 / t.w)} У${r1(t.c * 100 / t.w)}</div>` : '';
    };
    p.querySelectorAll('.dg').forEach(i => i.oninput = () => { draft.items[+i.dataset.g].g = num(i.value); upd(); });
    $('#dcook').oninput = upd;
    p.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { sync(); draft.items.splice(+b.dataset.rm, 1); dishEditor(draft); });
    $('#dadd').onclick = () => { sync(); pickFood({ onPick: f => askGrams(f, g => { draft.items.push({ n: f.name, g, kcal: f.kcal, p: f.p, f: f.f, c: f.c }); foodChoose = null; dishEditor(draft); }) }); };
    $('#dsave').onclick = () => {
      sync(); const t = dishTotals(draft);
      if (!draft.items.length || t.w <= 0) return alert('Добавьте хотя бы один продукт');
      if (one) {
        const mid = uid(); S.meals.push({ id: mid, date: day, name: draft.name, g: Math.round(t.w), kcal: t.kcal, p: t.p, f: t.f, c: t.c, type: draft.oneOff.type });
        save(); return okBtn($('#dsave'), () => { closeSheet(); renderNew(mid); }, 'Добавлено: ' + draft.name);
      }
      if (!draft.name.trim()) return $('#dn').focus();
      const vals = { name: draft.name.trim(), kcal: Math.round(t.kcal * 100 / t.w), p: r1(t.p * 100 / t.w), f: r1(t.f * 100 / t.w), c: r1(t.c * 100 / t.w), dish: { items: draft.items.map(i => ({ ...i })), cooked: num(draft.cooked) || 0 } };
      let food = draft.id && S.foods.find(x => x.id === draft.id);
      if (food) Object.assign(food, vals); else { food = { id: uid(), barcode: '', ...vals }; S.foods.push(food); if ($('#dshare') && $('#dshare').checked) shareFood(food); }
      save(); okBtn($('#dsave'), () => { if (draft.id) { closeSheet(); render(); } else addMealSheet(food); }, 'Блюдо сохранено');
    };
    upd();
  });
}
const dishDraft = food => ({ id: food.id, name: food.name, items: food.dish.items.map(i => ({ ...i })), cooked: food.dish.cooked || '' });

function foodForm(pre) {
  let mode = pre.mode || '100';
  const v = k => pre[k] ?? '', edit = !!pre.isEdit;
  sheet(`<h2 class="sh">${pre.quick ? 'Быстрая запись' : edit ? 'Изменить продукт' : 'Новый продукт'}</h2>
    ${pre.note ? `<div class="sub dim" style="margin-bottom:4px">${esc(pre.note)}</div>` : ''}
    <label>Название</label><input id="fn" value="${esc(pre.name || '')}" placeholder="Например: Йогурт Danone">
    ${pre.quick ? '' : `<label>Значения указаны</label><div class="seg" id="fbas"><button type="button" data-bas="100" class="${mode === '100' ? 'on' : ''}">На 100 г</button><button type="button" data-bas="serv" class="${mode === 'serv' ? 'on' : ''}">На порцию</button></div>
    <label id="fsvl">Размер порции, г</label><input id="fsv" inputmode="decimal" value="${v('serving')}" placeholder="необязательно">`}
    <div class="grid2"><div><label>Ккал</label><input id="fk" inputmode="decimal" value="${v('kcal')}"></div><div><label>Белки, г</label><input id="fp" inputmode="decimal" value="${v('p')}"></div>
    <div><label>Жиры, г</label><input id="ff" inputmode="decimal" value="${v('f')}"></div><div><label>Углеводы, г</label><input id="fc" inputmode="decimal" value="${v('c')}"></div></div>
    <div id="fchk" class="sub dim" style="margin-top:6px"></div>
    ${pre.quick ? '' : `<label>Штрихкод</label><div class="bcrow"><input id="fbc" inputmode="numeric" value="${esc(pre.barcode || '')}" placeholder="необязательно"><button class="btn ghost sm" id="fscan">${ic('scan')}Скан</button></div>
    <button class="btn ghost sm" id="flabel" style="margin-top:8px">${ic('file')}Заполнить по фото этикетки</button>`}
    ${sb && user && !pre.quick && !edit ? `<label style="display:flex;gap:8px;align-items:center;color:var(--txt);font-size:14px"><input type="checkbox" id="fshare" style="width:auto" ${pre.barcode ? 'checked' : ''}> Добавить в общую базу</label>` : ''}
    ${pre.raw ? `<details class="raw"><summary>Распознанный текст</summary><pre>${esc(pre.raw)}</pre></details>` : ''}
    <div class="btns" style="margin-top:14px"><button class="btn" id="ok">${edit ? 'Сохранить' : 'Сохранить и выбрать'}</button><button class="btn ghost" id="cancel">Отмена</button></div>`, () => {
    $('#cancel').onclick = closeSheet;
    const sv = () => $('#fsv') ? num($('#fsv').value) : 0;
    const cur = () => ({ ...pre, note: undefined, mode, serving: $('#fsv') ? $('#fsv').value : pre.serving, name: $('#fn').value, kcal: $('#fk').value, p: $('#fp').value, f: $('#ff').value, c: $('#fc').value, barcode: $('#fbc') ? $('#fbc').value.trim() : pre.barcode });
    const check = () => {
      const k = num($('#fk').value), p = num($('#fp').value), f = num($('#ff').value), c = num($('#fc').value), calc = Math.round(4 * p + 4 * c + 9 * f), el = $('#fchk');
      if (!(p || f || c)) { el.textContent = ''; return; }
      const bad = k > 0 && Math.abs(calc - k) > Math.max(25, k * 0.2);
      el.className = 'sub ' + (bad ? 'warn' : 'dim');
      el.textContent = `По БЖУ: ≈ ${calc} ккал` + (bad ? ' — не сходится с введёнными, проверьте цифры' : '') + (!k ? ' (ккал подставятся сами)' : '');
    };
    ['#fk', '#fp', '#ff', '#fc'].forEach(id => { $(id).oninput = check; }); check();
    // switching the basis keeps the numbers equivalent when the serving size is known
    document.querySelectorAll('#fbas [data-bas]').forEach(b => b.onclick = () => {
      const to = b.dataset.bas; if (to === mode) return;
      const g = sv(), k = g > 0 ? (to === 'serv' ? g / 100 : 100 / g) : 0;
      if (k) [['#fk', 0], ['#fp', 1], ['#ff', 1], ['#fc', 1]].forEach(([id, d]) => { const x = $(id).value; if (x !== '') { const y = num(x) * k; $(id).value = d ? r1(y) : Math.round(y); } });
      mode = to; document.querySelectorAll('#fbas [data-bas]').forEach(x => x.classList.toggle('on', x === b)); check();
    });
    if ($('#fscan')) $('#fscan').onclick = () => { const snap = cur(); scanBarcode(code => foodForm({ ...snap, barcode: code })); };
    if ($('#flabel')) $('#flabel').onclick = () => ocrLabel(cur());
    $('#ok').onclick = () => {
      const name = $('#fn').value.trim(); if (!name) { $('#fn').focus(); return; }
      let p = num($('#fp').value), f = num($('#ff').value), c = num($('#fc').value), k = num($('#fk').value) || Math.round(4 * p + 4 * c + 9 * f);
      const g = sv();
      if (!pre.quick && mode === 'serv') {
        if (!(g > 0)) { toast('Укажите размер порции'); $('#fsv').focus(); return; }
        const m = 100 / g; k = Math.round(k * m); p = r1(p * m); f = r1(f * m); c = r1(c * m);
      }
      const vals = { name, kcal: k, p, f, c, barcode: $('#fbc') ? $('#fbc').value.trim() : (pre.barcode || '') };
      if (g > 0) vals.serving = g;
      if (edit) {
        const food = S.foods.find(x => x.id === pre.id); if (!food) return closeSheet();
        Object.assign(food, vals); if (!(g > 0)) delete food.serving; save();
        return okBtn($('#ok'), () => { closeSheet(); render(); }, 'Продукт сохранён');
      }
      const food = { id: uid(), ...vals }; S.foods.push(food); save();
      if ($('#fshare') && $('#fshare').checked) shareFood(food);
      okBtn($('#ok'), () => pre.onSave ? pre.onSave(food) : addMealSheet(food), 'Продукт сохранён');
    };
  });
}

function addMealSheet(food) {
  const dish = food.dish, total = dish ? Math.round(dishTotals(dish.items ? { items: dish.items, cooked: dish.cooked } : dish).w) : 0;
  let type = addType || autoType();
  const serv = food.serving > 0 ? food.serving : 0;
  sheet(`<h2 class="sh">${esc(food.name)}${dish ? '<span class="tag dishtag">блюдо</span>' : ''}</h2><div class="dim">${food.kcal} ккал · Б${food.p} Ж${food.f} У${food.c} /100г</div>
    <label>Приём пищи</label><div class="chips">${MT.map(([k, n]) => `<button class="chip ${k === type ? 'on' : ''}" data-mt="${k}">${n}</button>`).join('')}</div>
    ${serv ? `<label>Порции <small class="dim">1 порция = ${serv} г</small></label><div class="chips">${[0.5, 1, 1.5, 2, 3].map(n => `<button class="chip" data-sv="${n}">${n}</button>`).join('')}</div>` : ''}
    <label>Порция, г</label><input id="g" inputmode="decimal" value="${food.lastG || serv || 100}">
    ${dish ? `<div class="chips" style="margin-top:8px">${[['Всё', 1], ['1/2', 1 / 2], ['1/3', 1 / 3], ['1/4', 1 / 4], ['1/6', 1 / 6]].map(([n, f]) => `<button class="chip" data-fr="${f}">${n}</button>`).join('')}</div><div class="sub dim" style="margin-top:6px">Всего в блюде: ${total} г</div>
    <button class="btn ghost sm" id="oneoff" style="margin-top:8px">${ic('edit')}Изменить состав на этот раз</button> <button class="btn ghost sm" id="editdish" style="margin-top:8px">${ic('list')}Изменить блюдо</button>` : ''}
    <div id="calc" class="dim" style="margin:10px 0"></div>
    <div class="btns"><button class="btn" id="ok">Добавить</button></div>`, p => {
    const upd = () => { const x = per(food, num($('#g').value)); $('#calc').textContent = `${Math.round(x.kcal)} ккал · Б${r1(x.p)} Ж${r1(x.f)} У${r1(x.c)}`; };
    upd(); $('#g').oninput = upd;
    p.querySelectorAll('[data-mt]').forEach(b => b.onclick = () => { type = b.dataset.mt; p.querySelectorAll('[data-mt]').forEach(x => x.classList.toggle('on', x === b)); });
    p.querySelectorAll('[data-fr]').forEach(b => b.onclick = () => { $('#g').value = Math.round(total * +b.dataset.fr); upd(); });
    const marks = () => p.querySelectorAll('[data-sv]').forEach(x => x.classList.toggle('on', Math.abs(num($('#g').value) - serv * +x.dataset.sv) < 0.05));
    p.querySelectorAll('[data-sv]').forEach(b => b.onclick = () => { $('#g').value = r1(serv * +b.dataset.sv); upd(); marks(); });
    if (serv) { $('#g').addEventListener('input', marks); marks(); }
    if ($('#oneoff')) $('#oneoff').onclick = () => dishEditor({ ...dishDraft(food), id: undefined, oneOff: { type } });
    if ($('#editdish')) $('#editdish').onclick = () => dishEditor(dishDraft(food));
    $('#ok').onclick = () => {
      const g = num($('#g').value); if (g <= 0) return;
      const mid = uid(); S.meals.push({ id: mid, date: day, name: food.name, g, type, ...per(food, g) });
      food.used = (food.used || 0) + 1; food.lastG = g; food.lastAt = Date.now(); addType = null; save();
      okBtn($('#ok'), () => { closeSheet(); renderNew(mid); }, 'Добавлено: ' + food.name);
    };
  });
}

// two big buttons: take a photo now, or pick one from the gallery
const photoPicker = id => `<div class="pick2"><button type="button" class="pickbtn" data-pick="${id}c">${ic('camera')}<b>Камера</b><small>Снять сейчас</small></button><button type="button" class="pickbtn" data-pick="${id}g">${ic('image')}<b>Фото</b><small>Из галереи</small></button></div>
  <input type="file" id="${id}c" accept="image/*" capture="environment" hidden><input type="file" id="${id}g" accept="image/*" hidden>`;
function bindPicker(id, fn) {
  ['c', 'g'].forEach(k => {
    $('#' + id + k).onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) fn(f); };
    document.querySelector(`[data-pick="${id}${k}"]`).onclick = () => $('#' + id + k).click();
  });
}

// barcode
let scanner = null;
function stopScanner() {
  if (!scanner) return;
  const s = scanner; scanner = null;
  try { Promise.resolve(s.stop()).then(() => s.clear()).catch(() => {}); } catch { /* scanner was not running */ }
}
const bcFormats = () => { const F = window.Html5QrcodeSupportedFormats; return F ? [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.ITF, F.QR_CODE] : undefined; };
// ZBar (WebAssembly) reads 1D barcodes in any orientation, which the old JS decoder often missed
async function ensureZbar() {
  if (window.zbarWasm) return true;
  try { await loadScript('vendor/zbar.js'); } catch { return false; }
  return !!window.zbarWasm;
}
const BAR_TYPES = /EAN|UPC|CODE128|CODE39|I25|ISBN/;
async function zbarFind(canvas) {
  const res = await window.zbarWasm.scanImageData(canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height));
  for (const r of res) { if (BAR_TYPES.test(r.typeName)) { const t = r.decode(); if (t) return t; } }
  return null;
}
// decode a barcode from a still photo (works well on iPhone: native autofocus and full resolution)
async function decodeBarcodeFile(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  if (bmp && await ensureZbar()) {
    for (const max of [2200, 1400, 900, 3000]) {
      const sc = Math.min(max / Math.max(bmp.width, bmp.height), max === 3000 ? 1.5 : 1), c = document.createElement('canvas');
      c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      try { const r = await zbarFind(c); if (r) return r; } catch { /* try next size */ }
    }
  }
  if (typeof Html5Qrcode === 'undefined' || !$('#rtmp')) return null;
  const h = new Html5Qrcode('rtmp', { formatsToSupport: bcFormats(), verbose: false });
  try {
    for (const max of [1600, 1000, 2400]) {
      let f = file;
      if (bmp) {
        const sc = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
        c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
        f = new File([await new Promise(r => c.toBlob(r, 'image/png'))], 'b.png', { type: 'image/png' });
      }
      try { const r = await h.scanFile(f, false); if (r) return r; } catch { /* try next size */ }
    }
  } finally { try { h.clear(); } catch { /* ignore */ } }
  return null;
}
// live camera scanner: our own <video> + ZBar on full frames
async function startLive(box, onCode) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('камера не поддерживается');
  if (!await ensureZbar()) throw new Error('не загрузился модуль распознавания');
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 }, advanced: [{ focusMode: 'continuous' }] }, audio: false });
  const video = document.createElement('video'); video.setAttribute('playsinline', ''); video.muted = true; video.autoplay = true; video.srcObject = stream;
  box.insertBefore(video, box.firstChild); await video.play().catch(() => {});
  let stopped = false, timer = null, last = '';
  const cv = document.createElement('canvas');
  const loop = async () => {
    if (stopped) return;
    try {
      if (video.readyState >= 2 && video.videoWidth) {
        const sc = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
        cv.width = Math.round(video.videoWidth * sc); cv.height = Math.round(video.videoHeight * sc);
        cv.getContext('2d', { willReadFrequently: true }).drawImage(video, 0, 0, cv.width, cv.height);
        const code = await zbarFind(cv);
        if (code && !stopped && (/^\d{8,14}$/.test(code) || code === last)) { stopped = true; return onCode(code); }
        last = code || '';
      }
    } catch { /* keep scanning */ }
    if (!stopped) timer = setTimeout(loop, 110);
  };
  loop();
  return { stop() { stopped = true; clearTimeout(timer); stream.getTracks().forEach(t => t.stop()); video.srcObject = null; video.remove(); }, clear() {} };
}
function scanBarcode(cb) {
  const onCode = typeof cb === 'function' ? cb : lookupBarcode;
  const handle = code => { stopScanner(); onCode(code); };
  sheet(`<h2 class="sh">Сканер штрихкода</h2><div id="reader" class="scanwrap"><div class="scanframe"><i></i></div></div><div id="rtmp" hidden></div>
    <div id="msg" class="dim small" style="margin:10px 0">Поместите штрихкод в рамку и держите телефон в 20–30 см от упаковки. Код читается в любом положении.</div>
    <div class="dim small" style="margin-top:10px">Не читается? Снимите штрихкод на фото:</div>${photoPicker('bp')}
    <button class="btn ghost full" id="manual" style="margin:0">Ввести номер вручную</button>`, () => {
    $('#manual').onclick = () => { const c = prompt('Штрихкод (цифры)'); if (c && c.trim()) handle(c.trim()); };
    bindPicker('bp', async f => {
      stopScanner(); $('#msg').textContent = 'Распознаю штрихкод…';
      const code = await decodeBarcodeFile(f).catch(() => null);
      if (code) return handle(code);
      $('#msg').innerHTML = 'Не нашёл штрихкод на фото. Снимите ближе и ровно, чтобы он занимал не меньше трети кадра. <button class="btn ghost sm" id="again">Включить камеру снова</button>';
      $('#again').onclick = () => scanBarcode(onCode);
    });
    const hint = setTimeout(() => { const m = $('#msg'); if (m && scanner) { m.innerHTML = 'Не читается? <b>Отодвиньте телефон на 20–30 см</b> (ближе камера не фокусируется) и держите ровно. Или нажмите «Камера» ниже: обычная камера iPhone фокусируется точнее.'; $('#sheet .pick2').classList.add('pulse'); } }, 7000);
    startLive($('#reader'), handle).then(sc => { if ($('#reader')) scanner = sc; else sc.stop(); })
      .catch(err => { clearTimeout(hint); $('#msg').textContent = 'Камера недоступна (' + (err && err.message || err) + '). Разрешите доступ к камере в настройках Safari или снимите штрихкод на фото.'; });
  });
}
async function lookupBarcode(code) {
  const known = S.foods.find(f => f.barcode === code);
  if (known) return addMealSheet(known);
  sheet(`<div class="empty">Ищу ${esc(code)}…</div>`);
  if (sb && user) {
    const { data } = await sb.from('shared_foods').select('*').eq('barcode', code).maybeSingle();
    if (data) return addMealSheet(adoptShared(cleanShared(data)));
  }
  let found = null;
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,nutriments`);
    const j = await r.json();
    if (j.status === 1) {
      const n = j.product.nutriments || {};
      const kcal = n['energy-kcal_100g'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : 0);
      found = { name: [j.product.product_name, j.product.brands].filter(Boolean).join(' — '), kcal: Math.round(kcal), p: r1(n.proteins_100g || 0), f: r1(n.fat_100g || 0), c: r1(n.carbohydrates_100g || 0), barcode: code };
    }
  } catch { /* offline or not found */ }
  if (found && (found.kcal || found.p || found.f || found.c)) return foodForm(found);
  const pre = { name: found ? found.name : '', barcode: code };
  sheet(`<h2 class="sh">${found ? 'Нет данных о КБЖУ' : 'Товар не найден'}</h2>
    <div class="dim">${found ? `Нашёл «${esc(found.name)}», но без КБЖУ.` : `Штрихкода ${esc(code)} нет в базах или нет сети.`} Сфотографируйте таблицу пищевой ценности на упаковке, потом введёте название, и продукт сохранится вместе со штрихкодом.</div>
    <div class="btns" style="margin-top:14px"><button class="btn" id="lab">${ic('file')}Сфотографировать этикетку</button><button class="btn ghost" id="m">Ввести вручную</button></div>`, () => {
    $('#lab').onclick = () => ocrLabel(pre); $('#m').onclick = () => foodForm(pre);
  });
}

const RU_STATUS = { 'loading tesseract core': 'Загружаю модуль', 'initializing tesseract': 'Запускаю', 'loading language traineddata': 'Загружаю язык', 'initializing api': 'Подготовка', 'recognizing text': 'Читаю текст' };
// OCR of a nutrition label (Tesseract.js "best" models, loaded on demand; needs internet on first use, then cached)
const TESS_LANG_PATH = 'https://tessdata.projectnaptha.com/4.0.0_best';
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}
// grayscale + contrast stretch + adaptive threshold: helps with crumpled, shiny or unevenly lit packaging
async function prepLabel(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const long = Math.max(bmp.width, bmp.height), sc = long > 2400 ? 2400 / long : long < 1400 ? Math.min(2, 1400 / long) : 1;
  const w = Math.round(bmp.width * sc), h = Math.round(bmp.height * sc), n = w * h;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, gray = new Uint8ClampedArray(n), hist = new Uint32Array(256);
  for (let i = 0, j = 0; j < n; i += 4, j++) { const v = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0; gray[j] = v; hist[v]++; }
  let lo = 0, hi = 255, acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > n * 0.01) { lo = v; break; } }
  acc = 0; for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > n * 0.01) { hi = v; break; } }
  const span = Math.max(1, hi - lo);
  for (let j = 0; j < n; j++) gray[j] = Math.max(0, Math.min(255, (gray[j] - lo) * 255 / span));
  const integ = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += gray[y * w + x]; integ[(y + 1) * (w + 1) + x + 1] = integ[y * (w + 1) + x + 1] + row; } }
  const r = Math.max(8, Math.round(Math.min(w, h) / 30)), bin = new Uint8ClampedArray(n);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1), area = (x1 - x0) * (y1 - y0);
      const sum = integ[y1 * (w + 1) + x1] - integ[y0 * (w + 1) + x1] - integ[y1 * (w + 1) + x0] + integ[y0 * (w + 1) + x0];
      bin[y * w + x] = gray[y * w + x] * area < sum * 0.88 ? 0 : 255;
    }
  }
  const toCanvas = arr => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'), id = x.createImageData(w, h); for (let j = 0, i = 0; j < n; j++, i += 4) { id.data[i] = id.data[i + 1] = id.data[i + 2] = arr[j]; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); return cv; };
  return { gray: toCanvas(gray), bin: toCanvas(bin) };
}
// fix typical OCR confusions inside number-like tokens (O→0, l/I/|→1, S→5, B→8)
const fixNum = t => (/\d/.test(t) && /^[\dOoОоlI|SB.,<>]+$/.test(t)) ? t.replace(/[OoОо]/g, '0').replace(/[lI|]/g, '1').replace(/S/g, '5').replace(/B/g, '8') : t;
function parseLabel(text) {
  const lines = text.split(/\n+/).map(l => l.trim().split(/\s+/).map(fixNum).join(' ').toLowerCase().replace(/(\d)\s*,\s*(\d)/g, '$1.$2')).filter(Boolean);
  const SKIP_FAT = /насыщ|saturat|gesätt|mono|поли|trans|транс|davon|из них|of which|в т\.?\s?ч|ненасыщ/;
  const SKIP_CARB = /сахар|sugar|zucker|azúcar|sucres|цукр|davon|из них|of which|в т\.?\s?ч|клетчат|волокн|fibre|fiber|ballast|polyol|полиол/;
  // returns { v, int } — int = the decimal separator may have been lost by OCR ("71" instead of "7,1")
  const first = (kw, skip) => {
    for (const l of lines) {
      const m = kw.exec(l); if (!m || (skip && skip.test(l))) continue;
      const nm = /(\d+(?:\.\d+)?)(?!\d*\s*%)/.exec(l.slice(m.index + m[0].length)); if (!nm) continue;
      const v = parseFloat(nm[1]), int = !nm[1].includes('.');
      if (v <= 100 || (int && v <= 1000)) return { v, int };
    }
    return null;
  };
  const all = lines.join('\n'); let kcal = 0;
  const km = all.match(/(\d+(?:\.\d+)?)\s*(?:kcal|ккал|ккa|kcai|kca1)/) || all.match(/(?:kcal|ккал|calories?|energi\S*|energie|energía)\D{0,6}(\d+(?:\.\d+)?)/);
  if (km && parseFloat(km[1]) <= 950) kcal = parseFloat(km[1]);
  else { const kj = all.match(/(\d+(?:\.\d+)?)\s*(?:kj|кдж|k[jJ])/); if (kj) kcal = Math.round(parseFloat(kj[1]) / 4.184); }
  const sm = all.match(/(?:serving size|serv\.? size|размер порции|порция|porcja|wielko\S*\s+porcji|portionsgr\S*|portion|ración|ración)\D{0,25}?(\d+(?:\.\d+)?)\s*(?:g|gr|gram\S*|г|грам\S*)\b/);
  return {
    serving: sm ? parseFloat(sm[1]) : 0, per100: /(?:per|на|pro|par|por|na)\s*100\s*(?:g|г|ml|мл)|\b100\s*(?:g|г)\b/.test(all),
    kcal: Math.round(kcal),
    p: first(/белк\S*|protein\S*|eiwei\S*|prot[ée]ines?|prote[ií]nas?|białk\S*|білк\S*/),
    f: first(/жир\S*|fat\b|fett\b|lipides|grasas?|tłuszcz\S*/, SKIP_FAT),
    c: first(/углевод\S*|carbohydrate\S*|carbs?\b|kohlenhydrate|glucides|hidratos|węglowodany|вуглевод\S*/, SKIP_CARB),
  };
}
// combine several OCR passes; when a macro looks like it lost its decimal point, pick the reading that best matches the calories
function mergeLabels(list) {
  const kcal = list.map(x => x.kcal).find(Boolean) || 0, pick = k => { const c = list.map(x => x[k]).filter(Boolean); return c.find(o => !o.int) || c[0] || null; };
  const raw = { p: pick('p'), f: pick('f'), c: pick('c') };
  const cand = o => { if (!o) return [0]; const a = []; if (o.v <= 100) a.push(o.v); if (o.int && o.v >= 10 && o.v / 10 <= 100) a.push(r1(o.v / 10)); return a.length ? a : [0]; };
  let best = null;
  for (const p of cand(raw.p)) for (const f of cand(raw.f)) for (const c of cand(raw.c)) {
    const moved = (raw.p && p !== raw.p.v) + (raw.f && f !== raw.f.v) + (raw.c && c !== raw.c.v);
    const score = (kcal ? Math.abs(4 * p + 4 * c + 9 * f - kcal) : 0) + moved * 3;
    if (!best || score < best.score) best = { p, f, c, score };
  }
  const out = { kcal, p: best.p, f: best.f, c: best.c, serving: list.map(x => x.serving).find(Boolean) || 0, per100: list.some(x => x.per100) };
  if (!out.kcal && (out.p || out.f || out.c)) out.kcal = Math.round(4 * out.p + 4 * out.c + 9 * out.f);
  return out;
}
function ocrLabel(pre = {}) {
  const lang0 = localStorage.getItem('gymbro.ocrLang') || 'rus+eng';
  const langs = [['rus+eng', 'Русский + English'], ['eng', 'English'], ['eng+deu', 'English + Deutsch'], ['eng+fra', 'English + Français'], ['eng+spa', 'English + Español'], ['eng+pol', 'English + Polski'], ['eng+ukr', 'English + Українська'], ['eng+tur', 'English + Türkçe'], ['eng+ita', 'English + Italiano']];
  sheet(`<h2 class="sh">Этикетка КБЖУ</h2>
    <div class="dim small">Таблица пищевой ценности («на 100 г» или «на порцию») должна занимать почти весь кадр: крупно, ровно, без бликов.</div>
    ${photoPicker('op')}
    <label>Язык этикетки</label><select id="lang">${langs.map(([v, n]) => `<option value="${v}" ${v === lang0 ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <div id="prog" hidden style="margin-top:14px"><div class="bar"><i id="pbar" style="width:4%"></i></div></div>
    <div id="msg" class="dim small" style="margin:10px 0 2px"></div>
    <div class="dim small" style="margin-top:6px">Распознавание идёт на телефоне. При первом запуске нужен интернет (до ~30 МБ языковых данных, дальше они сохраняются).</div>`, () => {
    let busy = false;
    bindPicker('op', async f => {
      if (busy) return; busy = true; $('#sheet .panel').classList.add('busy'); $('#prog').hidden = false;
      const setP = v => { $('#pbar').style.width = Math.max(4, Math.min(100, v)) + '%'; };
      const msg = $('#msg'), lang = $('#lang').value; localStorage.setItem('gymbro.ocrLang', lang);
      msg.textContent = 'Готовлю изображение…'; setP(6);
      try {
        const prep = await prepLabel(f);
        if (typeof Tesseract === 'undefined') { msg.textContent = 'Загружаю распознавание…'; setP(12); await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'); }
        const worker = await Tesseract.createWorker(lang, 1, { langPath: TESS_LANG_PATH, logger: m => { if (m.status) { msg.textContent = (RU_STATUS[m.status] || m.status) + ' ' + Math.round((m.progress || 0) * 100) + '%'; setP(15 + (m.progress || 0) * 80); } } });
        const texts = [];
        try {
          await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' }); texts.push((await worker.recognize(prep.bin)).data.text);
          await worker.setParameters({ tessedit_pageseg_mode: '11' }); texts.push((await worker.recognize(prep.gray)).data.text);
        } finally { await worker.terminate(); }
        const res = mergeLabels(texts.map(parseLabel));
        const keep = {}; ['kcal', 'p', 'f', 'c'].forEach(k => { keep[k] = res[k] || pre[k] || ''; });
        foodForm({ ...pre, ...keep, serving: res.serving || pre.serving || '', mode: res.serving && !res.per100 ? 'serv' : (pre.mode || '100'), name: pre.name || '', note: 'Проверьте цифры: распознавание может путать 1 и 7, точки и запятые.', raw: texts.join('\n———\n') });
      } catch (err) { msg.textContent = 'Не удалось распознать: ' + (err && err.message || err); busy = false; $('#sheet .panel').classList.remove('busy'); $('#prog').hidden = true; }
    });
  });
}


// ---------- rest timer ----------
let restEnd = 0, restTick = null, restDoneT = null, audioCtx = null;
function unlockAudio() { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch { /* no audio */ } }
function beep() {
  if (S.rest.sound && audioCtx) {
    try { [0, 0.24, 0.48].forEach((t, i) => { const o = audioCtx.createOscillator(), g = audioCtx.createGain(), at = audioCtx.currentTime + t; o.type = 'sine'; o.frequency.value = i === 2 ? 1175 : 880; g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.5, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.2); o.connect(g); g.connect(audioCtx.destination); o.start(at); o.stop(at + 0.22); }); } catch { /* ignore */ }
  }
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}
// f holds the Russian forms (1 / 2-4 / 5+); the picked form is translated later, so en/pl only need the right index
const plural = (n, f) => {
  const a = Math.abs(n) % 100, b = a % 10, few = !(a > 10 && a < 20) && b > 1 && b < 5;
  if (LANG === 'en') return f[Math.abs(n) === 1 ? 0 : 1];
  if (LANG === 'pl') return f[Math.abs(n) === 1 ? 0 : few ? 1 : 2];
  return a > 10 && a < 20 ? f[2] : few ? f[1] : b === 1 ? f[0] : f[2];
};
const fmtSec = n => Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0');
function startRest(sec) {
  if (!S.rest.on) return;
  unlockAudio(); clearTimeout(restDoneT); restEnd = Date.now() + sec * 1000; restTotal = sec;
  const el = $('#rest'); el.hidden = false; el.classList.remove('done'); drawRest(); clearInterval(restTick); restTick = setInterval(drawRest, 250);
}
let restTotal = 0;
function stopRest() { clearInterval(restTick); restTick = null; clearTimeout(restDoneT); const el = $('#rest'); if (el) el.hidden = true; }
function drawRest() {
  const el = $('#rest'); if (!el) return;
  const left = Math.max(0, Math.ceil((restEnd - Date.now()) / 1000));
  if (left <= 0 && !el.classList.contains('done')) {
    clearInterval(restTick); restTick = null; el.classList.add('done'); beep();
    el.innerHTML = `<span class="rt">${ic('check')}Отдых закончен</span><button data-r="x" aria-label="Закрыть">${ic('x')}</button>`; bindRest();
    restDoneT = setTimeout(stopRest, 6000); return;
  }
  if (el.classList.contains('done')) return;
  if (!el.querySelector('.rbar')) {
    el.innerHTML = `<span class="rt"></span><div class="rbar"><i></i></div><button data-r="-15">−15</button><button data-r="15">+15</button><button data-r="x" aria-label="Пропустить">${ic('x')}</button>`; bindRest();
  }
  el.querySelector('.rt').innerHTML = ic('timer') + fmtSec(left);
  el.querySelector('.rbar i').style.width = (100 - Math.min(100, left / Math.max(1, restTotal) * 100)) + '%';
}
function bindRest() {
  document.querySelectorAll('#rest [data-r]').forEach(b => b.onclick = () => {
    if (b.dataset.r === 'x') return stopRest();
    restEnd += +b.dataset.r * 1000; restTotal = Math.max(restTotal, Math.ceil((restEnd - Date.now()) / 1000)); drawRest();
  });
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && restTick) drawRest(); });

// ---------- plate calculator ----------
const PLATE_COL = { 25: '#ef4444', 20: '#3b82f6', 15: '#eab308', 10: '#22c55e', 5: '#e5e7eb', 2.5: '#4b5563', 1.25: '#9ca3af', 0.5: '#6b7280' };
function platesFor(total) {
  const { bar, list } = S.plates, side = (total - bar) / 2;
  if (!(total > 0)) return { empty: true };
  if (side < 0) return { error: `Это меньше веса грифа (${bar} кг)` };
  let rest = Math.round(side * 1000) / 1000; const out = [];
  for (const p of [...list].sort((a, b) => b - a)) { let n = 0; while (rest + 1e-9 >= p) { rest = Math.round((rest - p) * 1000) / 1000; n++; } if (n) out.push([p, n]); }
  return { out, left: rest, side };
}
function plateSheet(initial, onApply) {
  sheet(`<h2 class="sh">Калькулятор блинов</h2>
    <div class="dim small">Покажет, какие блины (диски) надеть на каждую сторону штанги для нужного веса. Гриф ${S.plates.bar} кг, набор блинов меняется в «Аккаунт» → «Тренировки».</div>
    <label>Нужный общий вес, кг</label><input id="pw" inputmode="decimal" value="${initial || ''}" placeholder="Например: 100">
    <div id="pres" style="margin-top:12px"></div>
    ${onApply ? `<button class="btn full" id="papply" style="margin-top:10px" hidden>Подставить в подход</button>` : ''}`, () => {
    const draw = () => {
      const total = num($('#pw').value), r = platesFor(total), box = $('#pres'); if ($('#papply')) $('#papply').hidden = !(r.out && !r.left);
      if (r.empty) { box.innerHTML = ''; return; }
      if (r.error) { box.innerHTML = `<div class="sub warn">${r.error}</div>`; return; }
      const stack = r.out.flatMap(([p, n]) => Array(n).fill(p));
      box.innerHTML = `<div class="barbell"><span class="sleeve"></span>${stack.map(p => `<i class="plate" style="--c:${PLATE_COL[p] || '#9ca3af'};height:${34 + p * 2.6}px;width:${10 + Math.min(p, 25) * 0.5}px"></i>`).join('')}<span class="tip"></span></div>
        <div class="sub dim" style="margin:8px 0 4px">На каждую сторону:</div>
        <div class="chips" style="flex-wrap:wrap">${r.out.map(([p, n]) => `<span class="pl ok" style="background:${PLATE_COL[p] || '#9ca3af'};color:${p === 5 || p === 15 ? '#111' : '#fff'}">${p} кг × ${n}</span>`).join('') || '<span class="dim">Только гриф</span>'}</div>
        ${r.left ? `<div class="sub warn" style="margin-top:8px">Точно набрать не получится: остаётся ${r.left} кг на сторону. Ближайший вес — ${Math.round((total - 2 * r.left) * 100) / 100} кг.</div>` : `<div class="sub dim" style="margin-top:8px">Итого: гриф ${S.plates.bar} + 2 × ${r.side} = ${total} кг</div>`}`;
    };
    $('#pw').oninput = draw; draw();
    if ($('#papply')) $('#papply').onclick = () => { onApply(num($('#pw').value)); closeSheet(); };
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

// exercises marked as finished are shown compact; tap to open them again (and edit sets)
const openEx = new Set();
function editSetSheet(w, i, j) {
  const e = w.exercises[i], st = e && e.sets[j]; if (!st) return;
  sheet(`<h2 class="sh">Подход ${j + 1} · ${esc(e.name)}</h2><div class="grid2"><div><label style="margin-top:0">Вес, кг</label><input id="sw" inputmode="decimal" value="${st.w}"></div><div><label style="margin-top:0">Повт.</label><input id="sr" inputmode="numeric" value="${st.r}"></div></div>
    <div class="btns" style="margin-top:14px"><button class="btn" id="sok">Сохранить</button><button class="btn ghost danger" id="sdel">Удалить</button></div>`, () => {
    $('#sok').onclick = () => { const r = Math.round(num($('#sr').value)); if (r <= 0) return $('#sr').focus(); st.w = num($('#sw').value); st.r = r; save(); okBtn($('#sok'), () => { closeSheet(); render(); }, 'Сохранено'); };
    $('#sdel').onclick = () => { e.sets.splice(j, 1); save(); closeSheet(); render(); };
  });
}
function viewTrain() {
  const w = getWorkout(false), exs = w ? w.exercises : [];
  const vol = exs.reduce((a, e) => a + e.sets.reduce((s, x) => s + x.w * x.r, 0), 0);
  $('#view').innerHTML = `
    ${streakChip('train', 'тренировок подряд по плану')}
    ${typeof coachTrainCard === 'function' ? coachTrainCard(day) : ''}
    <div class="card"><div class="grid2"><div><div class="dim">Объём</div><div class="big">${Math.round(vol)} <small class="dim" style="font-size:14px">кг</small></div></div>
    <div><div class="dim">Упражнений / подходов</div><div class="big">${exs.length} / ${exs.reduce((a, e) => a + e.sets.length, 0)}</div></div></div></div>
    <div class="actions2"><button class="btn" id="addEx">${ic('plus')}Упражнение</button><button class="btn ghost" id="tpls">${ic('list')}Шаблоны</button></div>
    ${!exs.length && S.templates.length ? `<div class="card"><h2>Начать из шаблона</h2><div class="chips">${S.templates.map(t => `<button class="chip" data-usetpl="${t.id}">${esc(t.name)}</button>`).join('')}</div></div>` : ''}
    ${exs.map((e, i) => {
      const hist = exHistory(e.name, day)[0], prev = bestE1(e.name, day);
      const best = Math.max(0, ...e.sets.map(s => e1rm(s.w, s.r)));
      const nxt = (e.plan && e.plan[e.sets.length]) || e.sets[e.sets.length - 1] || (hist && hist.ex.sets[0]) || { w: '', r: '' };
      const open = !e.done || openEx.has(day + ':' + i), cur = !e.done && exs.findIndex(x => !x.done) === i && exs.some(x => x.done), evol = Math.round(e.sets.reduce((a, s) => a + s.w * s.r, 0));
      if (!open) return `<div class="card exdone ${isNew('ex' + i)}" data-reopen="${i}" role="button"><h2><span class="exok">${ic('check')}${esc(e.name)}${best > prev && prev > 0 ? '<span class="pr">PR</span>' : ''}</span><small>${e.sets.length} ${plural(e.sets.length, ['подход', 'подхода', 'подходов'])} · ${evol} кг</small></h2></div>`;
      return `<div class="card ${cur ? 'excur' : ''} ${isNew('ex' + i)}"><h2><span>${esc(e.name)}${best > prev && prev > 0 ? '<span class="pr">PR</span>' : ''}${e.done ? '<span class="tag train">Завершено</span>' : ''}</span><span class="exbtns">${e.done ? `<button class="btn sm ghost" data-fold="${i}">Свернуть</button>` : `<button class="btn sm ghost" data-finish="${i}">${ic('check')}Завершить</button>`}<button class="btn del" data-delex="${i}">${ic('x')}</button></span></h2>
        ${e.plan && e.plan.length ? `<div class="plan"><span class="dim">План:</span>${e.plan.map((x, j) => `<span class="pl ${j < e.sets.length ? 'ok' : ''}">${x.w}×${x.r}</span>`).join('')}</div>` : ''}
        ${hist ? `<div class="sub dim" style="margin-bottom:6px">Прошлый раз (${fmtDay(hist.date)}): ${hist.ex.sets.map(s => s.w + '×' + s.r).join(', ')}</div>` : ''}
        ${e.sets.map((s, j) => `<div class="row pick ${isNew(i + '.' + j)}" data-editset="${i}.${j}"><div class="main"><b>${j + 1}.</b> ${s.w} кг × ${s.r}</div><span class="dim">1ПМ ≈ ${Math.round(e1rm(s.w, s.r))}</span><button class="btn del" data-delset="${i}.${j}">${ic('x')}</button></div>`).join('')}
        <div class="grid4" style="grid-template-columns:1fr 1fr auto auto;margin-top:8px"><input inputmode="decimal" placeholder="Вес" data-w="${i}" value="${nxt.w}"><input inputmode="numeric" placeholder="Повт." data-r="${i}" value="${nxt.r}"><button class="btn ghost icon" data-plate="${i}" aria-label="Калькулятор блинов">${ic('disc')}</button><button class="btn" data-addset="${i}">+</button></div>
        <div class="sub dim" style="margin-top:6px">Объём: ${Math.round(e.sets.reduce((a, s) => a + s.w * s.r, 0))} кг</div></div>`;
    }).join('') || '<div class="empty">В этот день тренировок нет</div>'}
    ${exs.length ? `<button class="btn ghost full" id="savetpl">${ic('bookmark')}Сохранить как шаблон</button>` : ''}`;
  $('#addEx').onclick = () => addExercise();
  $('#tpls').onclick = tplList;
  if ($('#savetpl')) $('#savetpl').onclick = saveAsTemplate;
  document.querySelectorAll('[data-usetpl]').forEach(b => b.onclick = () => applyTemplate(b.dataset.usetpl));
  document.querySelectorAll('[data-plan-start]').forEach(b => b.onclick = () => applyTemplate(b.dataset.planStart));
  document.querySelectorAll('[data-addset]').forEach(b => b.onclick = () => {
    const i = +b.dataset.addset, wv = num($(`[data-w="${i}"]`).value), rv = Math.round(num($(`[data-r="${i}"]`).value));
    if (rv <= 0) return; unlockAudio(); w.exercises[i].sets.push({ w: wv, r: rv }); save(); startRest(S.rest.sec);
    const key = i + '.' + (w.exercises[i].sets.length - 1); okBtn(b, () => renderNew(key));
  });
  document.querySelectorAll('[data-plate]').forEach(b => b.onclick = () => {
    const i = +b.dataset.plate, inp = $(`[data-w="${i}"]`);
    plateSheet(inp.value, v => { inp.value = v; });
  });
  document.querySelectorAll('[data-delset]').forEach(b => b.onclick = e => { e.stopPropagation(); const [i, j] = b.dataset.delset.split('.').map(Number); w.exercises[i].sets.splice(j, 1); save(); render(); });
  document.querySelectorAll('[data-editset]').forEach(r => r.onclick = () => { const [i, j] = r.dataset.editset.split('.').map(Number); editSetSheet(w, i, j); });
  document.querySelectorAll('[data-finish]').forEach(b => b.onclick = () => {
    const i = +b.dataset.finish, e = w.exercises[i]; if (!e.sets.length) return toast('Добавьте хотя бы один подход');
    e.done = true; openEx.delete(day + ':' + i); save(); stopRest(); toast('Упражнение завершено'); render();
    const c = document.querySelector('.excur'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  document.querySelectorAll('[data-fold]').forEach(b => b.onclick = () => { openEx.delete(day + ':' + b.dataset.fold); render(); });
  document.querySelectorAll('[data-reopen]').forEach(c => c.onclick = () => { openEx.add(day + ':' + c.dataset.reopen); render(); });
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
function addExercise(cb) {
  const all = allExNames();
  const add = name => {
    name = name.trim(); if (!name) return; shareExercise(name);
    if (typeof cb === 'function') return cb(name);
    const wk = getWorkout(true); wk.exercises.push({ name, sets: [] }); save(); closeSheet(); renderNew('ex' + (wk.exercises.length - 1)); toast('Упражнение добавлено');
  };
  sheet(`<h2 class="sh">Упражнение</h2><input id="n" placeholder="Поиск или новое название" autocomplete="off" autocapitalize="sentences"><div id="exl" style="margin:8px 0"></div>
    <div class="btns"><button class="btn ghost" id="cancel">Закрыть</button></div>`, () => {
    const draw = raw => {
      const q = raw.trim().toLowerCase();
      const list = all.filter(n => nameHas(n, q)).slice(0, 40);
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


// ---------- workout templates ----------
const planText = plan => (plan || []).map(x => `${x.w}×${x.r}`).join(', ');
function parsePlan(text) {
  return text.split(/[,;\n]+/).map(t => /(\d+(?:[.,]\d+)?)\s*[x×хХ*]\s*(\d+)/i.exec(t)).filter(Boolean).map(m => ({ w: num(m[1]), r: parseInt(m[2], 10) })).filter(x => x.r > 0);
}
function applyTemplate(id) {
  const t = S.templates.find(x => x.id === id); if (!t) return;
  const w = getWorkout(true);
  t.exercises.forEach(e => w.exercises.push({ name: e.name, sets: [], plan: e.plan.map(x => ({ ...x })) }));
  save(); closeSheet(); render(); toast('Шаблон применён');
}
function tplList() {
  sheet(`<h2 class="sh">Шаблоны тренировок</h2>
    ${S.templates.length ? S.templates.map(t => `<div class="row"><div class="main"><b>${esc(t.name)}</b><div class="sub">${t.exercises.length} упр. · ${esc(t.exercises.map(e => e.name).join(', ')).slice(0, 70)}</div></div><button class="btn sm" data-use="${t.id}">Применить</button><button class="btn del" data-edit="${t.id}" aria-label="Изменить">${ic('edit')}</button></div>`).join('') : '<div class="empty">Пока нет шаблонов. Создайте новый или сохраните сегодняшнюю тренировку как шаблон.</div>'}
    <div class="btns" style="margin-top:12px"><button class="btn ghost" id="newtpl">${ic('plus')}Новый шаблон</button></div>`, p => {
    p.querySelectorAll('[data-use]').forEach(b => b.onclick = () => applyTemplate(b.dataset.use));
    p.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { const t = S.templates.find(x => x.id === b.dataset.edit); tplEditor({ id: t.id, name: t.name, exercises: t.exercises.map(e => ({ name: e.name, plan: e.plan.map(x => ({ ...x })) })) }); });
    $('#newtpl').onclick = () => tplEditor({ name: '', exercises: [] });
  });
}
function tplEditor(draft) {
  sheet(`<h2 class="sh">${draft.id ? 'Шаблон' : 'Новый шаблон'}</h2>
    <label>Название</label><input id="tn" value="${esc(draft.name)}" placeholder="Например: Грудь + трицепс">
    ${draft.exercises.map((e, i) => `<div class="tex"><div class="th"><b>${esc(e.name)}</b><button class="btn del" data-rm="${i}" aria-label="Убрать">${ic('x')}</button></div>
      <input data-plan="${i}" value="${esc(planText(e.plan))}" placeholder="вес×повторы: 80×8, 80×8, 80×6"></div>`).join('') || '<div class="empty">Добавьте упражнения</div>'}
    <button class="btn ghost" id="tadd" style="margin-top:8px">${ic('plus')}Упражнение</button>
    <div class="btns" style="margin-top:14px"><button class="btn" id="tsave">Сохранить</button>${draft.id ? '<button class="btn ghost danger" id="tdel">Удалить шаблон</button>' : ''}<button class="btn ghost" id="tback">К списку</button></div>`, p => {
    const sync = () => { draft.name = $('#tn').value; p.querySelectorAll('[data-plan]').forEach(i => { draft.exercises[+i.dataset.plan].plan = parsePlan(i.value); }); };
    p.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { sync(); draft.exercises.splice(+b.dataset.rm, 1); tplEditor(draft); });
    $('#tadd').onclick = () => { sync(); addExercise(name => { draft.exercises.push({ name, plan: [] }); tplEditor(draft); }); };
    $('#tback').onclick = tplList;
    $('#tsave').onclick = () => {
      sync(); const name = draft.name.trim();
      if (!name) return $('#tn').focus();
      if (!draft.exercises.length) return alert('Добавьте хотя бы одно упражнение');
      if (draft.id) Object.assign(S.templates.find(x => x.id === draft.id), { name, exercises: draft.exercises }); else S.templates.push({ id: uid(), name, exercises: draft.exercises });
      save(); okBtn($('#tsave'), () => { tplList(); render(); }, 'Шаблон сохранён');
    };
    if (draft.id) $('#tdel').onclick = () => { if (!confirm('Удалить шаблон?')) return; S.templates = S.templates.filter(x => x.id !== draft.id); save(); tplList(); render(); };
  });
}
function saveAsTemplate() {
  const w = getWorkout(false); if (!w || !w.exercises.length) return;
  sheet(`<h2 class="sh">Сохранить как шаблон</h2><div class="dim small">Упражнения и подходы (вес × повторы) этой тренировки станут планом шаблона.</div>
    <label>Название</label><input id="tn" placeholder="Например: Грудь + трицепс" autocomplete="off">
    <div class="btns" style="margin-top:14px"><button class="btn" id="tsave">Сохранить</button></div>`, () => {
    $('#tsave').onclick = () => {
      const name = $('#tn').value.trim(); if (!name) return $('#tn').focus();
      const exercises = w.exercises.map(e => ({ name: e.name, plan: (e.sets.length ? e.sets : e.plan || []).map(x => ({ w: x.w, r: x.r })) }));
      const ex = S.templates.find(t => t.name.toLowerCase() === name.toLowerCase());
      if (ex) { if (!confirm('Шаблон с таким названием уже есть. Обновить его?')) return; ex.exercises = exercises; } else S.templates.push({ id: uid(), name, exercises });
      save(); okBtn($('#tsave'), () => { closeSheet(); render(); }, 'Шаблон сохранён');
    };
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
      <span class="chk">${ic('check')}</span><div class="main"><b>${esc(v.name)}</b><div class="sub">${[v.time, v.dose, v.when].filter(Boolean).map(esc).join(' · ') || '&nbsp;'}</div></div>
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
      <div class="heat hd">${days.map(k => `<small class="${k === today() ? 'tdy' : ''}" translate="no">${tx(WD[wday(k)])[0]}</small>`).join('')}</div>
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
    <label>Напоминание (необязательно)</label><input type="time" id="vtm" value="${esc(v ? v.time || '' : '')}">
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
      const data = { name, dose: $('#vd').value.trim(), when: $('#vw').value.trim(), days: ds, time: $('#vtm').value };
      if (v) Object.assign(v, data); else S.vitamins.push({ id: uid(), created: today(), ...data });
      save(); okBtn($('#ok'), () => { closeSheet(); render(); }, 'Витамин сохранён');
    };
    if (v) $('#del').onclick = () => { if (!confirm('Удалить витамин и его историю?')) return; S.vitamins = S.vitamins.filter(x => x.id !== v.id); Object.keys(S.vitLog).forEach(k => { S.vitLog[k] = S.vitLog[k].filter(i => i !== v.id); if (!S.vitLog[k].length) delete S.vitLog[k]; }); save(); closeSheet(); render(); };
  });
}


// ---------- weight trend and adaptive calorie target ----------
const weightPts = () => S.body.filter(b => b.weight > 0).map(b => ({ date: b.date, t: ts(b.date), w: b.weight })).sort((a, b) => a.t - b.t);
function weightTrend() {
  const out = []; let tr = null, prev = 0;
  for (const p of weightPts()) { if (tr === null) tr = p.w; else tr += (1 - Math.exp(-((p.t - prev) / 864e5) / 6)) * (p.w - tr); prev = p.t; out.push({ x: p.t, y: Math.round(tr * 100) / 100, date: p.date }); }
  return out;
}
function adaptive() {
  const end = shiftDay(today(), -1), start = shiftDay(end, -27), logged = [];
  for (let k = start; k <= end; k = shiftDay(k, 1)) { const kc = sumMeals(k).kcal; if (kc >= 800) logged.push(kc); }
  const tr = weightTrend().filter(p => p.date >= shiftDay(start, -3)), span = tr.length > 1 ? (tr[tr.length - 1].x - tr[0].x) / 864e5 : 0;
  if (logged.length < 10 || tr.length < 4 || span < 10) return { ready: false, logged: logged.length, weights: tr.length, span: Math.round(span) };
  const n = tr.length, mx = tr.reduce((a, p) => a + p.x, 0) / n, my = tr.reduce((a, p) => a + p.y, 0) / n;
  let sxy = 0, sxx = 0; tr.forEach(p => { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; });
  const slope = sxx ? sxy / sxx * 864e5 : 0, avg = logged.reduce((a, b) => a + b, 0) / logged.length, tdee = avg - slope * 7700;
  const sign = S.wgoal.mode === 'lose' ? -1 : S.wgoal.mode === 'gain' ? 1 : 0;
  return { ready: true, avg, slopeWeek: slope * 7, tdee, target: Math.max(1200, Math.min(5000, tdee + sign * S.wgoal.rate * 7700 / 7)), logged: logged.length };
}
function adaptCard() {
  const A = adaptive(), W = S.wgoal, nT = S.trainDays.length, cur = (S.goals.kcal * nT + S.goalsRest.kcal * (7 - nT)) / 7;
  const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(r1(v));
  return `<div class="card"><h2>Адаптивная норма</h2>
    <div class="chips" style="flex-wrap:wrap">${[['lose', 'Сбросить вес'], ['hold', 'Держать вес'], ['gain', 'Набрать вес']].map(([k, n]) => `<button class="chip ${W.mode === k ? 'on' : ''}" data-wm="${k}">${n}</button>`).join('')}</div>
    ${W.mode !== 'hold' ? `<div class="chips" style="flex-wrap:wrap">${[0.25, 0.5, 0.75, 1].map(r => `<button class="chip ${W.rate === r ? 'on' : ''}" data-wr="${r}">${r} кг/нед</button>`).join('')}</div>` : ''}
    ${A.ready ? `<div class="adapt"><div><small>Ваш реальный расход</small><b>≈ ${Math.round(A.tdee)}</b> ккал/день</div><div><small>Рекомендуемая норма</small><b class="acc">${Math.round(A.target)}</b> ккал/день</div></div>
      <div class="sub dim">Вы едите в среднем ${Math.round(A.avg)} ккал (${A.logged} дней с записями из 28), вес меняется на ${sgn(A.slopeWeek)} кг в неделю. Сейчас ваша норма в среднем ${Math.round(cur)} ккал.</div>
      <button class="btn full" id="adapply" style="margin-top:10px">Применить: ${Math.round(A.target - cur) >= 0 ? '+' : '−'}${Math.abs(Math.round(A.target - cur))} ккал к норме</button>`
      : `<div class="sub dim" style="margin-top:6px">Нужно больше данных. Записано дней с едой: <b>${A.logged}</b> из 10 · замеров веса: <b>${A.weights}</b> из 4 за <b>${A.span}</b> из 10 дней. Взвешивайтесь и записывайте всю еду, примерно через 2 недели появится оценка.</div>`}
    <div class="dim small" style="margin-top:8px">Оценка расходов считается как «сколько вы едите» минус «сколько запасов тела вы теряете или набираете». Она точна, только если записана вся еда.</div></div>`;
}
function bindAdapt() {
  document.querySelectorAll('[data-wm]').forEach(b => b.onclick = () => { S.wgoal.mode = b.dataset.wm; save(); render(); });
  document.querySelectorAll('[data-wr]').forEach(b => b.onclick = () => { S.wgoal.rate = +b.dataset.wr; save(); render(); });
  if ($('#adapply')) $('#adapply').onclick = () => {
    const A = adaptive(), nT = S.trainDays.length, cur = (S.goals.kcal * nT + S.goalsRest.kcal * (7 - nT)) / 7, delta = Math.round(A.target - cur);
    if (!confirm(`Изменить норму на ${delta >= 0 ? '+' : '−'}${Math.abs(delta)} ккал?\nТренировочный день: ${S.goals.kcal} → ${S.goals.kcal + delta}\nДень отдыха: ${S.goalsRest.kcal} → ${S.goalsRest.kcal + delta}\nУглеводы подстроятся.`)) return;
    for (const g of [S.goals, S.goalsRest]) { g.kcal += delta; g.c = Math.max(0, g.c + Math.round(delta / 4)); }
    save(); okBtn($('#adapply'), () => render(), 'Норма обновлена');
  };
}

// ---------- progress photos (Supabase Storage, private bucket) ----------
const PHOTO_BUCKET = 'progress-photos', urlCache = {};
async function compressImage(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }), sc = Math.min(1, 1280 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
  c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('не удалось сжать фото')), 'image/jpeg', 0.82));
}
async function photoUrls(paths) {
  const need = paths.filter(p => !urlCache[p] || urlCache[p].exp < Date.now());
  if (need.length && sb && user) {
    const { data } = await sb.storage.from(PHOTO_BUCKET).createSignedUrls(need, 3600);
    (data || []).forEach(x => { if (x.signedUrl) urlCache[x.path] = { url: x.signedUrl, exp: Date.now() + 3300e3 }; });
  }
  return paths.map(p => (urlCache[p] && urlCache[p].url) || '');
}
const allPhotos = () => S.body.flatMap(r => (r.photos || []).map(path => ({ path, date: r.date }))).sort((a, b) => b.date.localeCompare(a.date));
async function hydratePhotos() {
  const els = [...document.querySelectorAll('[data-ph]')], urls = await photoUrls([...new Set(els.map(e => e.dataset.ph))]), map = {};
  [...new Set(els.map(e => e.dataset.ph))].forEach((p, i) => { map[p] = urls[i]; });
  els.forEach(e => { if (map[e.dataset.ph]) e.style.backgroundImage = `url("${map[e.dataset.ph]}")`; });
}
function weightOn(date) { const r = S.body.find(b => b.date === date && b.weight); return r ? r.weight : null; }
async function photoView(path, other) {
  const all = allPhotos(), a = all.find(x => x.path === path); if (!a) return;
  const b = other ? all.find(x => x.path === other) : null, [ua, ub] = await photoUrls([a.path, b ? b.path : a.path]);
  const wa = weightOn(a.date), wb = b ? weightOn(b.date) : null;
  const cap = (x, w) => `<div class="pcap"><b>${fmtDay(x.date)}</b>${w ? ` · ${w} кг` : ''}</div>`;
  let diff = '';
  if (b && wa && wb && a.date !== b.date) { const [o, n] = a.date < b.date ? [[a, wa], [b, wb]] : [[b, wb], [a, wa]], d = r1(n[1] - o[1]), days = Math.round((ts(n[0].date) - ts(o[0].date)) / 864e5); diff = `<div class="sub dim" style="text-align:center">Вес: ${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d)} кг за ${days} ${plural(days, ['день', 'дня', 'дней'])}</div>`; }
  sheet(`<h2 class="sh">${b ? 'Сравнение' : 'Фото'}</h2>
    <div class="${b ? 'cmp' : 'one'}"><figure><img src="${ua}" alt="">${cap(a, wa)}</figure>${b ? `<figure><img src="${ub}" alt="">${cap(b, wb)}</figure>` : ''}</div>${diff}
    <label>${b ? 'Сравнить с другой датой' : 'Сравнить с…'}</label><div class="chips" style="flex-wrap:wrap">${all.filter(x => x.path !== a.path).map(x => `<button class="chip ${b && x.path === b.path ? 'on' : ''}" data-cmp="${x.path}">${esc(fmtDay(x.date))}</button>`).join('') || '<span class="dim small">Нужно хотя бы два фото</span>'}</div>
    <div class="btns" style="margin-top:14px">${b ? `<button class="btn ghost" id="pone">Одно фото</button>` : ''}<button class="btn ghost danger" id="pdel">Удалить это фото</button></div>`, p => {
    p.querySelectorAll('[data-cmp]').forEach(c => c.onclick = () => photoView(a.path, c.dataset.cmp));
    if ($('#pone')) $('#pone').onclick = () => photoView(a.path);
    $('#pdel').onclick = async () => {
      if (!confirm('Удалить это фото?')) return;
      try { await sb.storage.from(PHOTO_BUCKET).remove([a.path]); } catch { /* record is removed anyway */ }
      const r = S.body.find(x => (x.photos || []).includes(a.path)); r.photos = r.photos.filter(x => x !== a.path); if (!r.photos.length) delete r.photos;
      if (!MEAS.some(([k]) => r[k]) && !r.photos) S.body = S.body.filter(x => x !== r);
      save(); closeSheet(); render();
    };
  });
}

// ---------- body ----------
const MEAS = [['weight', 'Вес, кг'], ['waist', 'Талия'], ['chest', 'Грудь'], ['hips', 'Бёдра'], ['armL', 'Бицепс левый'], ['armR', 'Бицепс правый'], ['thighL', 'Бедро левое'], ['thighR', 'Бедро правое']];
let statView = 'charts';
const seg = () => `<div class="seg"><button class="${statView === 'charts' ? 'on' : ''}" data-sv="charts">Графики</button><button class="${statView === 'muscle' ? 'on' : ''}" data-sv="muscle">Мышцы</button><button class="${statView === 'body' ? 'on' : ''}" data-sv="body">Замеры</button></div>`;
const bindSeg = () => document.querySelectorAll('[data-sv]').forEach(b => b.onclick = () => { statView = b.dataset.sv; animate = true; render(); });
function bodySheet(date) {
  const last = [...S.body].sort((a, b) => b.date.localeCompare(a.date))[0] || {}, d = typeof date === 'string' ? date : today(), canPhoto = !!(sb && user), cur = S.body.find(x => x.date === d) || {};
  let pend = [];
  sheet(`<h2 class="sh">Замер · ${fmtDay(d)}</h2><div class="grid2">${MEAS.map(([k, n]) => `<div><label>${n}${k === 'weight' ? '' : ', см'}</label><input inputmode="decimal" data-m="${k}" value="${cur[k] || ''}" placeholder="${last[k] || ''}"></div>`).join('')}</div>
    <label>Фото прогресса <small class="dim">— необязательно</small></label>
    ${canPhoto ? `${photoPicker('pp')}<div id="pthumbs" class="thumbs"></div>` : '<div class="dim small">Фото доступны после входа в аккаунт.</div>'}
    <div class="btns" style="margin-top:14px"><button class="btn" id="ok">Сохранить</button></div>`, p => {
    const drawThumbs = () => {
      $('#pthumbs').innerHTML = pend.map((x, i) => `<div class="th" style="background-image:url(${x.url})"><button data-rmp="${i}" aria-label="Убрать">${ic('x')}</button></div>`).join('');
      p.querySelectorAll('[data-rmp]').forEach(b => b.onclick = () => { URL.revokeObjectURL(pend[+b.dataset.rmp].url); pend.splice(+b.dataset.rmp, 1); drawThumbs(); });
    };
    if (canPhoto) bindPicker('pp', async f => { try { const blob = await compressImage(f); pend.push({ blob, url: URL.createObjectURL(blob) }); drawThumbs(); } catch (e) { toast('Не удалось обработать фото'); } });
    $('#ok').onclick = async () => {
      const rec = { id: uid(), date: d }; let any = false;
      document.querySelectorAll('[data-m]').forEach(i => { const v = num(i.value); if (v > 0) { rec[i.dataset.m] = v; any = true; } });
      if (!any && !pend.length) return;
      const paths = [];
      if (pend.length) {
        $('#ok').textContent = 'Загружаю фото…';
        for (const x of pend) {
          const path = `${user.id}/${d}-${uid()}.jpg`, { error } = await sb.storage.from(PHOTO_BUCKET).upload(path, x.blob, { contentType: 'image/jpeg' });
          if (error) { alert('Фото не загрузилось: ' + error.message + '\nПроверьте, что в Supabase создано хранилище progress-photos (SQL из supabase-photos.sql).'); break; }
          paths.push(path);
        }
        $('#ok').textContent = 'Сохранить';
        if (!any && !paths.length) return;
      }
      const ex = S.body.find(b => b.date === d);
      if (ex) { const keep = ex.photos || []; Object.assign(ex, rec, { id: ex.id }); if (keep.length || paths.length) ex.photos = [...keep, ...paths]; }
      else { if (paths.length) rec.photos = paths; S.body.push(rec); }
      save(); okBtn($('#ok'), () => { closeSheet(); render(); }, paths.length ? 'Замер и фото сохранены' : 'Замер сохранён');
    };
  });
}
function viewBody() {
  const rows = [...S.body].sort((a, b) => b.date.localeCompare(a.date)), photos = allPhotos();
  const meas = r => MEAS.filter(([k]) => r[k]).map(([k, n]) => (k === 'weight' ? '' : n + ' ') + r[k] + (k === 'weight' ? ' кг' : ' см')).join(' · ');
  $('#view').innerHTML = seg() + `<button class="btn full" id="addB">${ic('plus')}Замер и фото</button>
    ${photos.length ? `<div class="card"><h2>Фото прогресса <button class="btn sm ghost" id="pcmp">${ic('copy')}Сравнить</button></h2><div class="strip">${photos.map(x => `<button class="ph" data-ph="${x.path}"><span>${esc(fmtDay(x.date))}</span></button>`).join('')}</div></div>` : ''}
    <div class="card"><h2>История</h2>${rows.length ? rows.map(r => `<div class="row pick" data-editb="${r.date}"><div class="main"><b>${fmtDay(r.date)}</b><div class="sub">${meas(r) || 'Только фото'}</div>${r.photos && r.photos.length ? `<div class="thumbs sm">${r.photos.map(p => `<button class="th" data-ph="${p}"></button>`).join('')}</div>` : ''}</div><button class="btn del" data-delb="${r.id}">${ic('x')}</button></div>`).join('') : '<div class="empty">Нет замеров</div>'}</div>`;
  bindSeg(); $('#addB').onclick = () => bodySheet();
  document.querySelectorAll('[data-editb]').forEach(r => r.onclick = e => { if (!e.target.closest('[data-delb],[data-ph]')) bodySheet(r.dataset.editb); });
  document.querySelectorAll('[data-ph]').forEach(e => e.onclick = () => photoView(e.dataset.ph));
  if ($('#pcmp')) $('#pcmp').onclick = () => { if (photos.length < 2) return toast('Нужно хотя бы два фото'); photoView(photos[0].path, photos[photos.length - 1].path); };
  document.querySelectorAll('[data-delb]').forEach(b => b.onclick = () => {
    const r = S.body.find(x => x.id === b.dataset.delb); if (!confirm('Удалить запись' + (r.photos ? ' вместе с фото' : '') + '?')) return;
    if (r.photos && sb && user) sb.storage.from(PHOTO_BUCKET).remove(r.photos).catch(() => {});
    S.body = S.body.filter(x => x.id !== r.id); save(); render();
  });
  hydratePhotos();
}

// ---------- muscle groups: weekly volume ----------
const MUSCLES = [['chest', 'Грудь'], ['back', 'Спина'], ['legs', 'Ноги'], ['glutes', 'Ягодицы'], ['shoulders', 'Плечи'], ['biceps', 'Бицепс'], ['triceps', 'Трицепс'], ['abs', 'Пресс'], ['calves', 'Икры'], ['cardio', 'Кардио'], ['other', 'Другое']];
const MUSCLE_RX = [
  ['glutes', /ягодичн|hip thrust|хип-?траст/i], ['calves', /носк|икр/i],
  ['abs', /скручив|планка|пресс|подъ[её]м ног в вис|ролик|велосипед|русские/i],
  ['cardio', /бег|ходьб|велотренаж|гребн|эллипс|скакалк|плаван|б[её]рпи|кардио/i],
  ['biceps', /бицепс|молотк|сгибани[яе] рук/i],
  ['triceps', /трицепс|французск|узким хватом|на брусьях|кикбэк|разгибани[яе] руки/i],
  ['shoulders', /жим стоя|жим гантелей сидя|махи|арнольд|к подбородку|тяга к лицу|обратные разведения|подъ[её]м гантелей перед|шраги|жим над головой/i],
  ['legs', /присед|жим ногами|выпад|разгибани[яе] ног|сгибани[яе] ног|румынск|шаги на|хак|болгарск|фронтальн|ног в тренажёре/i],
  ['chest', /жим лёжа|жим лежа|жим гантелей|на наклонной скамье|разводк|кроссовер|пуловер|сведение рук|отжимания|бабочка/i],
  ['back', /тяга|подтягив|гиперэкстенз|становая|пулдаун/i],
];
const muscleOf = name => S.exMuscle[name] || (MUSCLE_RX.find(([, rx]) => rx.test(name)) || ['other'])[0];
const weekStart = k => shiftDay(k, -((wday(k) + 6) % 7));
function weekStats(start) {
  const out = {}; MUSCLES.forEach(([m]) => { out[m] = { sets: 0, vol: 0 }; });
  const end = shiftDay(start, 6);
  S.workouts.filter(w => w.date >= start && w.date <= end).forEach(w => w.exercises.forEach(e => {
    const m = muscleOf(e.name), real = e.sets.filter(x => x.r > 0);
    out[m].sets += real.length; out[m].vol += real.reduce((a, x) => a + x.w * x.r, 0);
  }));
  return out;
}
let muscleSel = { week: weekStart(today()), metric: 'sets' };
function viewMuscle() {
  const metric = muscleSel.metric, ws = muscleSel.week, cur = weekStats(ws), prev = weekStats(shiftDay(ws, -7)), isNow = ws === weekStart(today());
  const weeks = []; for (let i = 7; i >= 0; i--) weeks.push(shiftDay(ws, -7 * i));
  const hist = weeks.map(weekStats), val = (o, m) => Math.round(o[m][metric]);
  const label = n => metric === 'sets' ? plural(n, ['подход', 'подхода', 'подходов']) : 'кг';
  const tot = o => MUSCLES.reduce((a, [m]) => a + o[m][metric], 0), tc = Math.round(tot(cur)), tp = Math.round(tot(prev));
  const delta = (c, p) => { if (!p && !c) return ''; if (!p) return '<span class="dl up">новое</span>'; const d = Math.round((c - p) / p * 100); return `<span class="dl ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '+' : ''}${d}%</span>`; };
  const rows = MUSCLES.filter(([m]) => cur[m][metric] || prev[m][metric]).map(([m, n]) => {
    const series = hist.map(o => o[m][metric]), mx = Math.max(1, ...series);
    return `<div class="mrow"><div class="mh"><b>${n}</b><span>${val(cur, m)} ${label(val(cur, m))} ${delta(cur[m][metric], prev[m][metric])}</span></div>
      <div class="mbars">${series.map((v, i) => `<i class="${i === series.length - 1 ? 'cur' : ''}" style="height:${Math.max(4, v / mx * 100)}%" title="${Math.round(v)}"></i>`).join('')}</div></div>`;
  }).join('');
  const unk = [...new Set(S.workouts.flatMap(w => w.exercises.map(e => e.name)))].filter(n => muscleOf(n) === 'other');
  const wl = `${new Date(ws + 'T12:00:00').toLocaleDateString(LOC, { day: 'numeric', month: 'short' })} – ${new Date(shiftDay(ws, 6) + 'T12:00:00').toLocaleDateString(LOC, { day: 'numeric', month: 'short' })}`;
  $('#view').innerHTML = seg() + `
    <div class="card"><div class="calhead"><button class="btn sm ghost icon" data-mw="-1" aria-label="Прошлая неделя">${ic('left')}</button><b>${isNow ? 'Эта неделя' : wl}</b><button class="btn sm ghost icon" data-mw="1" aria-label="Следующая неделя">${ic('right')}</button></div>
      <div class="dim small" style="text-align:center;margin-top:-4px">${isNow ? wl : ''}</div>
      <div class="chips" style="justify-content:center;margin-top:10px"><button class="chip ${metric === 'sets' ? 'on' : ''}" data-mm="sets">Подходы</button><button class="chip ${metric === 'vol' ? 'on' : ''}" data-mm="vol">Объём, кг</button></div>
      <div class="mtotal"><div><div class="big">${tc}<small> ${label(tc)}</small></div><div class="dim small">всего за неделю</div></div><div class="mdelta">${delta(tc, tp) || '<span class="dim small">нет данных за прошлую неделю</span>'}<div class="dim small">к прошлой неделе (${tp})</div></div></div></div>
    <div class="card"><h2>По группам мышц <small>8 недель, справа — выбранная</small></h2>${rows || '<div class="empty">На этой неделе тренировок нет</div>'}</div>
    <button class="btn ghost full" id="mgroups">${ic('list')}Группы упражнений${unk.length ? ` · без группы: ${unk.length}` : ''}</button>
    <div class="dim small">Каждое упражнение засчитывается в одну основную группу. «Подходы» — это рабочие подходы, «Объём» — вес × повторы.</div>`;
  bindSeg();
  document.querySelectorAll('[data-mw]').forEach(b => b.onclick = () => { muscleSel.week = shiftDay(muscleSel.week, 7 * +b.dataset.mw); render(); });
  document.querySelectorAll('[data-mm]').forEach(b => b.onclick = () => { muscleSel.metric = b.dataset.mm; render(); });
  $('#mgroups').onclick = muscleGroupsSheet;
}
function muscleGroupsSheet() {
  const names = allExNames().filter(n => S.workouts.some(w => w.exercises.some(e => e.name === n)) || S.exMuscle[n]);
  const list = names.sort((a, b) => (muscleOf(a) === 'other' ? 0 : 1) - (muscleOf(b) === 'other' ? 0 : 1) || a.localeCompare(b));
  sheet(`<h2 class="sh">Группы упражнений</h2><div class="dim small">Выберите, к какой группе мышц относится упражнение. Здесь только те, что вы уже делали.</div>
    ${list.map(n => `<div class="exg"><b>${esc(n)}</b><div class="chips" style="flex-wrap:wrap">${MUSCLES.map(([m, t]) => `<button class="chip ${muscleOf(n) === m ? 'on' : ''}" data-ex="${esc(n)}" data-m="${m}">${t}</button>`).join('')}</div></div>`).join('') || '<div class="empty">Пока нет упражнений</div>'}`, p => {
    p.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => { S.exMuscle[b.dataset.ex] = b.dataset.m; save(); p.querySelectorAll(`[data-ex="${CSS.escape(b.dataset.ex)}"]`).forEach(x => x.classList.toggle('on', x.dataset.m === b.dataset.m)); toast('Сохранено'); });
  });
}

// ---------- stats ----------
function viewStats() {
  if (statView === 'body') return viewBody();
  if (statView === 'muscle') return viewMuscle();
  const names = exNames(); if (!statSel.ex || !names.includes(statSel.ex)) statSel.ex = names[0] || null;
  $('#view').innerHTML = seg() + adaptCard() + `
    <div class="card"><h2>Вес и замеры</h2><div class="chips">${MEAS.map(([k, n]) => `<button class="chip ${statSel.m === k ? 'on' : ''}" data-m="${k}">${n.replace(', кг', '')}</button>`).join('')}</div><canvas class="chart" id="c1"></canvas><div id="wtr" class="sub dim"></div></div>
    <div class="card"><h2>Калории за 14 дней <small>цель сегодня ${goalFor(today()).kcal}</small></h2><canvas class="chart" id="c2"></canvas></div>
    <div class="card"><h2>Упражнение</h2>${names.length ? `<div class="chips">${names.map(n => `<button class="chip ${statSel.ex === n ? 'on' : ''}" data-e="${esc(n)}">${esc(n)}</button>`).join('')}</div>
      <div class="dim" style="margin:4px 0">Расчётный 1ПМ (лучший подход за день), кг</div><canvas class="chart" id="c3"></canvas>
      <div class="dim" style="margin:4px 0">Объём за тренировку, кг</div><canvas class="chart" id="c4"></canvas><div id="prs" class="sub dim"></div>` : '<div class="empty">Нет данных по тренировкам</div>'}</div>`;
  bindSeg(); bindAdapt();
  document.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { statSel.m = b.dataset.m; render(); });
  document.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { statSel.ex = b.dataset.e; render(); });
  const isW = statSel.m === 'weight', trd = isW ? weightTrend() : [];
  chart($('#c1'), S.body.filter(b => b[statSel.m]).map(b => ({ x: ts(b.date), y: b[statSel.m] })).sort((a, b) => a.x - b.x), isW ? { color: '#60a5fa', dotsOnly: true, extra: trd, extraColor: '#34d399' } : { color: '#60a5fa' });
  if (isW && trd.length) {
    const now = trd[trd.length - 1], wk = [...trd].reverse().find(p => p.x <= now.x - 6.5 * 864e5), d7 = wk ? r1(now.y - wk.y) : null;
    $('#wtr').innerHTML = `<span style="color:var(--acc)">●</span> тренд ${r1(now.y)} кг${d7 !== null ? ` · ${d7 > 0 ? '+' : d7 < 0 ? '−' : ''}${Math.abs(d7)} кг за неделю` : ''} · точки — ваши взвешивания`;
  }
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
function langSheet() {
  const opts = [['auto', 'Auto · ' + LANG_NAMES[detectLang()], 'System language / Мова системи']].concat(Object.entries(LANG_NAMES).map(([k, n]) => [k, n, '']));
  sheet(`<h2 class="sh">Язык / Language</h2>${opts.map(([k, n, d]) => `<button class="mi ${LANG_PREF === k ? 'on' : ''}" data-lang="${k}" translate="no"><span class="tx"><b>${esc(n)}</b>${d ? `<small>${esc(d)}</small>` : ''}</span>${LANG_PREF === k ? ic('check', 'chev') : ''}</button>`).join('')}`, p => {
    p.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { if (b.dataset.lang !== LANG_PREF) setLang(b.dataset.lang); else closeSheet(); });
  });
}
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
        ${typeof coachMenu === 'function' ? coachMenu() : ''}
        ${mi('m-train', 'dumbbell', 'Тренировки', `Отдых ${S.rest.on ? S.rest.sec + ' сек' : 'выкл.'} · гриф ${S.plates.bar} кг`)}
        ${mi('m-notify', 'bell', 'Уведомления', S.reminders.on ? 'Включены' : 'Выключены')}
        ${mi('m-lang', 'globe', 'Язык / Language', LANG_PREF === 'auto' ? 'Auto · ' + LANG_NAMES[LANG] : LANG_NAMES[LANG])}
        ${mi('m-data', 'db', 'Данные и копия', cloud ? 'Синхронизация, экспорт, импорт' : 'Экспорт и импорт')}
        ${isAdmin ? mi('m-admin', 'crown', 'Администратор', 'Общая база, код доступа') : ''}
      </div>
      ${cloud ? `<div class="card menu">${mi('logout', 'logout', 'Выйти', 'Данные останутся в облаке', 'danger')}</div>` : ''}`;
    if ($('#m-lang')) $('#m-lang').onclick = langSheet;
    [['goals', 'm-goals'], ['days', 'm-days'], ['foods', 'm-foods'], ['mycoach', 'm-mycoach'], ['coach', 'm-coach'], ['train', 'm-train'], ['notify', 'm-notify'], ['data', 'm-data'], ['admin', 'm-admin']].forEach(([k, id]) => { if ($('#' + id)) $('#' + id).onclick = () => { moreSub = k; if (typeof coachEnter === 'function') coachEnter(k); nav(); }; });
  } else if (moreSub === 'goals') {
    $('#view').innerHTML = back + `<div class="card"><h2><span class="hic">${ic('bolt')}Тренировочный день</span></h2>${goalFields('g', S.goals)}</div>
      <div class="card"><h2><span class="hic">${ic('moon')}День отдыха</span></h2>${goalFields('r', S.goalsRest)}</div><button class="btn full" id="sg">Сохранить</button>`;
    $('#sg').onclick = () => {
      const rd = p => ({ kcal: num($(`#${p}k`).value), p: num($(`#${p}p`).value), f: num($(`#${p}f`).value), c: num($(`#${p}c`).value) });
      S.goals = rd('g'); S.goalsRest = rd('r'); save(); okBtn($('#sg'), null, 'Цели сохранены', true);
    };
  } else if (moreSub === 'days') {
    $('#view').innerHTML = back + `<div class="card"><h2>Тренировочные дни недели</h2><div id="tdays">${wdChips(S.trainDays)}</div>
      <div class="dim small" style="margin-top:10px">День также считается тренировочным, если в нём записана тренировка. Тип дня можно переключить вручную на вкладке «Питание».</div></div><button class="btn full" id="sg">Сохранить</button>`;
    bindChips($('#tdays'));
    $('#sg').onclick = () => { S.trainDays = pickedDays($('#tdays')); save(); okBtn($('#sg'), null, 'Дни сохранены', true); };
  } else if (moreSub === 'foods') {
    $('#view').innerHTML = back + `<div class="card"><h2>Мои продукты (${S.foods.length})</h2>${S.foods.slice().sort((a, b) => a.name.localeCompare(b.name)).map(f => `<div class="row"><div class="main">${esc(f.name)}${f.dish ? '<span class="tag dishtag">блюдо</span>' : ''}<div class="sub">${f.kcal} ккал · Б${f.p} Ж${f.f} У${f.c} /100г</div></div>${sb && user ? `<button class="btn del" data-sharefood="${f.id}" aria-label="В общую базу">${ic('db')}</button>` : ''}<button class="btn del" data-editfood="${f.id}" aria-label="Изменить">${ic('edit')}</button><button class="btn del" data-delfood="${f.id}">${ic('x')}</button></div>`).join('') || '<div class="empty">Пусто</div>'}</div>`;
    document.querySelectorAll('[data-editfood]').forEach(b => b.onclick = () => { const f = S.foods.find(x => x.id === b.dataset.editfood); f.dish ? dishEditor(dishDraft(f)) : foodForm({ ...f, isEdit: true, mode: '100' }); });
    document.querySelectorAll('[data-sharefood]').forEach(b => b.onclick = async () => { const ok = await shareFood(S.foods.find(f => f.id === b.dataset.sharefood)); toast(ok ? 'Добавлено в общую базу' : 'Не удалось: нет доступа к общей базе'); });
    document.querySelectorAll('[data-delfood]').forEach(b => b.onclick = () => { S.foods = S.foods.filter(f => f.id !== b.dataset.delfood); save(); render(); });
  } else if ((moreSub === 'mycoach' || moreSub === 'coach') && typeof coachView === 'function') {
    coachView(moreSub); return;
  } else if (moreSub === 'train') {
    const secs = [45, 60, 90, 120, 180, 240], allPlates = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];
    $('#view').innerHTML = back + `<div class="card"><h2>Таймер отдыха</h2>
      <label class="sw"><input type="checkbox" id="rton" ${S.rest.on ? 'checked' : ''}><i></i><span>Запускать после каждого подхода</span></label>
      <div class="chips" style="flex-wrap:wrap;margin-top:8px">${secs.map(v => `<button class="chip ${S.rest.sec === v ? 'on' : ''}" data-sec="${v}">${fmtSec(v)}</button>`).join('')}</div>
      <label class="sw" style="margin-top:6px"><input type="checkbox" id="rtsnd" ${S.rest.sound ? 'checked' : ''}><i></i><span>Звук и вибрация в конце</span></label>
      <div class="dim small" style="margin-top:8px">Таймер идёт, пока приложение открыто на экране. Если свернуть его, iPhone приостанавливает звук; при возвращении покажет, что отдых закончился.</div></div>
      <div class="card"><h2>Калькулятор блинов</h2><label style="margin-top:0">Вес грифа, кг</label><input id="pbar" inputmode="decimal" value="${S.plates.bar}">
      <label>Какие блины есть в зале</label><div class="chips" style="flex-wrap:wrap">${allPlates.map(v => `<button class="chip ${S.plates.list.includes(v) ? 'on' : ''}" data-pl="${v}">${v} кг</button>`).join('')}</div></div>`;
    $('#rton').onchange = e => { S.rest.on = e.target.checked; save(); };
    $('#rtsnd').onchange = e => { S.rest.sound = e.target.checked; save(); };
    document.querySelectorAll('[data-sec]').forEach(b => b.onclick = () => { S.rest.sec = +b.dataset.sec; save(); document.querySelectorAll('[data-sec]').forEach(x => x.classList.toggle('on', x === b)); });
    $('#pbar').onchange = e => { S.plates.bar = num(e.target.value) || 20; save(); };
    document.querySelectorAll('[data-pl]').forEach(b => b.onclick = () => { const v = +b.dataset.pl, on = !S.plates.list.includes(v); if (!on && S.plates.list.length <= 1) return; S.plates.list = on ? [...S.plates.list, v] : S.plates.list.filter(x => x !== v); save(); b.classList.toggle('on', on); });
  } else if (moreSub === 'notify') {
    $('#view').innerHTML = back + '<div id="npanel"><div class="empty">Проверяю…</div></div>';
    drawNotify();
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
      try { const d = JSON.parse(await e.target.files[0].text()); if (!confirm('Заменить текущие данные импортированными?')) return; S = Object.assign(fresh(), d); migrateBody(); save(); render(); }
      catch { alert('Неверный файл'); }
    };
  } else if (moreSub === 'admin') {
    $('#view').innerHTML = back + `<div class="card menu"><h2>Администратор</h2>${mi('admBase', 'db', 'Общая база', 'Продукты и упражнения всех пользователей')}${mi('admUsers', 'user', 'Пользователи', 'Все зарегистрированные аккаунты')}${mi('admCode', 'key', 'Код доступа', 'Нужен новым пользователям при регистрации')}</div>`;
  }
  if ($('#back')) $('#back').onclick = () => { moreSub = null; nav(); };
  bindAccount();
}


// ---------- push notifications ----------
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const urlB64 = s => { const b = atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); };
const swReady = () => Promise.race([navigator.serviceWorker.ready, new Promise((_, rej) => setTimeout(() => rej(new Error('Service worker не готов, перезапустите приложение')), 4000))]);
async function pushSub() { if (!pushSupported()) return null; return (await swReady()).pushManager.getSubscription(); }
async function savePushSub(sub) {
  const j = sub.toJSON();
  const { error } = await sb.from('push_subscriptions').upsert({ user_id: user.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }, { onConflict: 'endpoint' });
  return error;
}
async function enablePush() {
  if (!pushSupported() || !CFG.vapidPublicKey) throw new Error('Уведомления недоступны в этом режиме');
  const perm = await Notification.requestPermission(); // must be the first await: iOS needs a user gesture
  if (perm !== 'granted') throw new Error('Разрешение не выдано');
  const reg = await swReady();
  const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(CFG.vapidPublicKey) });
  const err = await savePushSub(sub); if (err) throw new Error(err.message);
  S.reminders.on = true; save();
}
async function disablePush(keepSetting) {
  try { const sub = await pushSub(); if (sub) { if (sb && user) await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); } } catch { /* nothing to remove */ }
  if (!keepSetting) { S.reminders.on = false; save(); }
}
// keeps this device registered (and its time zone current) after login or app start
async function syncPush() {
  try { if (!sb || !user || !pushSupported() || Notification.permission !== 'granted' || !S.reminders.on) return; const sub = await pushSub(); if (sub) await savePushSub(sub); } catch { /* ignore */ }
}
async function drawNotify() {
  const box = $('#npanel'); if (!box) return;
  const R = S.reminders;
  if (!(CFG.url && user)) { box.innerHTML = '<div class="card"><div class="dim">Для уведомлений нужен вход в аккаунт.</div></div>'; return; }
  if (!pushSupported()) { box.innerHTML = `<div class="card"><h2>Установите приложение</h2><div class="dim small">Уведомления работают на iPhone с iOS 16.4 и новее, только если приложение добавлено на экран «Домой»: Safari → «Поделиться» → «На экран Домой». Откройте приложение с иконки и вернитесь сюда.</div></div>`; return; }
  let sub = null; try { sub = await pushSub(); } catch (e) { box.innerHTML = `<div class="card"><div class="sub warn">${esc(e.message)}</div></div>`; return; }
  if (!$('#npanel')) return;
  const perm = Notification.permission;
  if (!(perm === 'granted' && sub && R.on)) {
    box.innerHTML = `<div class="card"><h2>Напоминания</h2><div class="dim small" style="margin-bottom:12px">Витамины, тренировка, питание и взвешивание в нужное время. Время настраивается после включения.</div>
      ${perm === 'denied' ? '<div class="sub warn">Уведомления запрещены. Разрешите их: Настройки iPhone → Уведомления → GymBro.</div>' : `<button class="btn full" id="npush">${ic('bell')}Включить уведомления</button>`}<div id="nerr" class="sub warn"></div></div>`;
    if ($('#npush')) $('#npush').onclick = async () => { try { await enablePush(); toast('Уведомления включены'); drawNotify(); } catch (e) { $('#nerr').textContent = e.message || String(e); } };
    return;
  }
  const sw = (id, on, text) => `<label class="sw"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><i></i><span>${text}</span></label>`;
  box.innerHTML = `
    <div class="card"><h2>Витамины</h2>${sw('nvit', R.vit !== false, 'Напоминать о витаминах')}<div class="dim small" style="margin-top:6px">Время задаётся у каждого витамина: Витамины → карандаш → «Напоминание». Если вы уже отметили витамин, напоминания не будет.</div></div>
    <div class="card"><h2>Тренировка</h2>${sw('ntr', R.train.on, 'В тренировочные дни, если тренировка не записана')}<div class="trow"><input type="time" id="ntrt" value="${esc(R.train.time)}"></div></div>
    <div class="card"><h2>Питание</h2>${sw('nfo', R.food.on, 'Если за день нет записей о еде')}<div class="trow"><input type="time" id="nfot" value="${esc(R.food.time)}"></div></div>
    <div class="card"><h2>Взвешивание</h2>${sw('nwe', R.weigh.on, 'Раз в неделю, если вес не записан')}
      <div class="trow"><select id="nwed">${WD_ORDER.map(d => `<option value="${d}" ${R.weigh.day === d ? 'selected' : ''}>${['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'][d]}</option>`).join('')}</select><input type="time" id="nwet" value="${esc(R.weigh.time)}"></div></div>
    <div class="card"><div class="btns"><button class="btn ghost" id="ntest">${ic('bell')}Тестовое уведомление</button><button class="btn ghost danger" id="noff">Выключить</button></div><div id="nmsg" class="sub dim" style="margin-top:8px"></div></div>`;
  const bind = (id, fn) => { $('#' + id).onchange = e => { fn(e.target); save(); }; };
  bind('nvit', t => { R.vit = t.checked; }); bind('ntr', t => { R.train.on = t.checked; }); bind('ntrt', t => { R.train.time = t.value; });
  bind('nfo', t => { R.food.on = t.checked; }); bind('nfot', t => { R.food.time = t.value; });
  bind('nwe', t => { R.weigh.on = t.checked; }); bind('nwed', t => { R.weigh.day = +t.value; }); bind('nwet', t => { R.weigh.time = t.value; });
  $('#noff').onclick = async () => { await disablePush(false); toast('Уведомления выключены'); drawNotify(); };
  $('#ntest').onclick = async () => {
    const m = $('#nmsg'); m.className = 'sub dim'; m.textContent = 'Отправляю…';
    try {
      await push();
      const { data, error } = await sb.functions.invoke('send-reminders', { body: { test: true } });
      if (error) throw error;
      if (!data || !data.devices) { m.className = 'sub warn'; m.textContent = 'Нет зарегистрированных устройств. Выключите и включите уведомления.'; return; }
      m.textContent = 'Отправлено. Если уведомление не пришло за минуту, проверьте разрешения в настройках iPhone.';
    } catch (e) { m.className = 'sub warn'; m.textContent = 'Не удалось: ' + (e && e.message || e) + '. Проверьте, что функция send-reminders создана в Supabase.'; }
  };
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
  setStatus('Синхронизировано в ' + new Date().toLocaleTimeString(LOC, { hour: '2-digit', minute: '2-digit' }));
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
  S = Object.assign(fresh(), remote); migrateBody();
  localStorage.setItem(KEY, JSON.stringify(S)); setSync({ uid: user.id, at: S.updatedAt });
  setStatus('Загружено из облака'); render();
}
async function cloudInit() {
  try {
    if (!CFG.url || !CFG.anonKey || !window.supabase) return;
    sb = window.supabase.createClient(CFG.url, CFG.anonKey);
    try { const { data } = await sb.auth.getSession(); user = data.session ? data.session.user : null; } catch { return; }
    sb.auth.onAuthStateChange((_e, sess) => { user = sess ? sess.user : null; });
    if (user) { await pull(); loadSharedEx(); checkAdmin(); syncPush(); if (typeof coachInit === 'function') coachInit(); }
  } finally { authReady = true; render(); }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && user) pull(); });

let authMode = 'in', authDraft = { em: '', pw: '' };
function viewAuth() {
  const up = authMode === 'up';
  $('#top').innerHTML = '<h1>GymBro</h1>';
  $('#view').innerHTML = `<div class="authhead"><img src="icons/icon-192.png" alt="" width="72" height="72"><div><b>GymBro</b><div class="dim small">Питание, тренировки, витамины и прогресс</div></div></div>
    <div class="seg"><button class="${up ? '' : 'on'}" data-am="in">Вход</button><button class="${up ? 'on' : ''}" data-am="up">Регистрация</button></div>
    <div class="card"><label style="margin-top:0">Email</label><input id="em" type="email" autocomplete="email" autocapitalize="none" value="${esc(authDraft.em)}">
      <label>Пароль${up ? ' (от 6 символов)' : ''}</label><input id="pw" type="password" autocomplete="${up ? 'new-password' : 'current-password'}" value="${esc(authDraft.pw)}">
      ${up ? '<label>Код доступа</label><input id="ic" autocapitalize="none" autocomplete="off"><div class="dim small" style="margin-top:6px">Код выдаёт администратор приложения.</div>' : ''}
      <div id="autherr" class="sub warn" style="margin-top:8px"></div>
      <button class="btn full" id="${up ? 'signup' : 'login'}" style="margin:12px 0 0">${up ? 'Создать аккаунт' : 'Войти'}</button></div>
    <div class="dim small" style="text-align:center">Все данные хранятся в вашем аккаунте и доступны на любом устройстве.</div>
    <div class="langrow" translate="no">${Object.entries(LANG_NAMES).map(([k, n]) => `<button class="${LANG === k ? 'on' : ''}" data-lang="${k}">${esc(n)}</button>`).join('')}</div>`;
  document.querySelectorAll('.langrow [data-lang]').forEach(b => b.onclick = () => { if (b.dataset.lang !== LANG) setLang(b.dataset.lang); });
  document.querySelectorAll('[data-am]').forEach(b => b.onclick = () => {
    authDraft = { em: $('#em').value, pw: $('#pw').value }; authMode = b.dataset.am; animate = true; render();
  });
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
    if (!data.session) { authMode = 'in'; return err('Проверьте почту и подтвердите email, затем войдите.'); }
    authDraft = { em: '', pw: '' }; authMode = 'in';
    user = data.session.user; await pull(); loadSharedEx(); checkAdmin(); syncPush(); if (typeof coachInit === 'function') coachInit(); render();
  };
  if ($('#login')) $('#login').onclick = () => auth('in');
  if ($('#signup')) $('#signup').onclick = () => auth('up');
  if ($('#admBase')) $('#admBase').onclick = adminBase;
  if ($('#admCode')) $('#admCode').onclick = adminCode;
  if ($('#admUsers')) $('#admUsers').onclick = adminUsers;
  if ($('#syncnow')) $('#syncnow').onclick = async () => { await push(); await pull(); };
  if ($('#logout')) $('#logout').onclick = async () => {
    if (!confirm('Выйти? Данные останутся в облаке, с устройства они удалятся.')) return;
    await push(); await disablePush(true); await sb.auth.signOut(); user = null; isAdmin = false; if (typeof coachReset === 'function') coachReset();
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
// everything coming from the shared database is written by other users: clamp and trim it before it enters the diary
function cleanShared(r) {
  const n = (v, max) => { const x = parseFloat(v); return isFinite(x) ? Math.max(0, Math.min(max, x)) : 0; }, t = (v, k) => String(v == null ? '' : v).slice(0, k);
  const o = { id: t(r.id, 60), name: t(r.name, 160), kcal: n(r.kcal, 950), p: n(r.p, 100), f: n(r.f, 100), c: n(r.c, 100), barcode: t(r.barcode, 32), by: r.created_by || '' };
  if (n(r.serving, 5000) > 0) o.serving = n(r.serving, 5000);
  if (r.dish && typeof r.dish === 'object' && Array.isArray(r.dish.items)) o.dish = { cooked: n(r.dish.cooked, 99999), items: r.dish.items.slice(0, 40).map(i => ({ n: t(i && i.n, 160), g: n(i && i.g, 99999), kcal: n(i && i.kcal, 950), p: n(i && i.p, 100), f: n(i && i.f, 100), c: n(i && i.c, 100) })) };
  return o;
}
async function shareFood(f) {
  if (!sb || !user) return false;
  const row = { name_key: f.name.trim().toLowerCase(), name: f.name.trim(), kcal: f.kcal, p: f.p, f: f.f, c: f.c, barcode: f.barcode || null };
  const extra = {}; if (f.serving > 0) extra.serving = f.serving; if (f.dish) extra.dish = f.dish;
  let { error } = await sb.from('shared_foods').upsert({ ...row, ...extra }, { onConflict: 'name_key', ignoreDuplicates: true });
  if (error && Object.keys(extra).length) ({ error } = await sb.from('shared_foods').upsert(row, { onConflict: 'name_key', ignoreDuplicates: true }));   // serving/dish columns not created yet
  return !error;
}
const findMine = r => S.foods.find(x => (r.barcode && x.barcode === r.barcode) || x.name.toLowerCase() === r.name.toLowerCase());
function adoptShared(r) {
  let f = findMine(r);
  if (!f) { f = { id: uid(), name: r.name, kcal: +r.kcal, p: +r.p, f: +r.f, c: +r.c, barcode: r.barcode || '' }; if (r.serving > 0) f.serving = r.serving; if (r.dish) f.dish = r.dish; S.foods.push(f); save(); }
  return f;
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
      okBtn($('#ok'), closeSheet, 'Код доступа сохранён');
    };
  });
}
async function adminUsers() {
  sheet('<div class="empty">Загрузка…</div>');
  const { data, error } = await sb.rpc('admin_users');
  if (error) { return sheet(`<h2 class="sh">Пользователи</h2><div class="sub warn">${esc(/does not exist|schema cache/i.test(error.message) ? 'Нужно выполнить обновлённый supabase-admin.sql в Supabase.' : error.message)}</div>`); }
  const list = (data || []).map(u => ({ ...u, email: String(u.email || ''), meals: +u.meals || 0, workouts: +u.workouts || 0 }));
  const draw = q => {
    q = q.trim().toLowerCase(); const rows = list.filter(u => u.email.toLowerCase().includes(q));
    $('#ulist').innerHTML = rows.map(u => `<div class="row"><div class="main"><b translate="no">${esc(u.email)}</b>${u.is_admin ? '<span class="tag train">админ</span>' : ''}<div class="sub">${typeof ago === 'function' ? 'вход: ' + ago(u.last_sign_in_at) : ''} · в базе с ${new Date(u.created_at).toLocaleDateString(LOC, { day: 'numeric', month: 'short', year: 'numeric' })}</div><div class="sub">записей еды: ${u.meals} · тренировок: ${u.workouts}${u.data_updated ? ' · данные: ' + ago(u.data_updated) : ''}</div></div></div>`).join('') || '<div class="empty">—</div>';
  };
  sheet(`<h2 class="sh">Пользователи (${list.length})</h2><input id="uq" placeholder="Поиск по email" autocomplete="off" autocapitalize="none"><div id="ulist" style="margin-top:8px"></div>`, () => { draw(''); $('#uq').oninput = e => draw(e.target.value); });
}
async function adminBase() {
  sheet('<div class="empty">Загрузка…</div>');
  const [fx, ex] = await Promise.all([
    sb.from('shared_foods').select('id,name,kcal,p,f,c').order('name').limit(500),
    sb.from('shared_exercises').select('id,name').order('name').limit(500)]);
  const foods = fx.data || [], exs = ex.data || [];
  const draw = q => {
    q = q.trim().toLowerCase();
    const fl = foods.filter(f => nameHas(f.name, q)), el = exs.filter(e => nameHas(e.name, q));
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
  const withDay = ['home', 'food', 'train', 'vit'].includes(tab), other = withDay && day !== today();
  $('#top').classList.toggle('other', other);
  $('#top').innerHTML = `<div class="tl"><h1>${TITLES[tab]}</h1>${other ? `<button class="back2today" id="bt">${ic('left')}К сегодня</button>` : ''}</div>` + (withDay ? `<div class="nav"><button class="btn sm ghost icon" id="pd" aria-label="Назад">${ic('left')}</button><button class="btn sm ghost ${other ? 'other' : ''}" id="td">${ic('calendar')}${dayLabel(day)}</button><button class="btn sm ghost icon" id="nd" aria-label="Вперёд">${ic('right')}</button></div>` : '');
  if (withDay) {
    $('#pd').onclick = () => { day = shiftDay(day, -1); animate = true; render(); };
    $('#nd').onclick = () => { day = shiftDay(day, 1); animate = true; render(); };
    $('#td').onclick = () => calendarSheet(day.slice(0, 7));
    if ($('#bt')) $('#bt').onclick = () => { day = today(); animate = true; render(); };
  }
  $('#view').classList.toggle('anim', animate); animate = false;
  ({ home: viewHome, food: viewFood, train: viewTrain, vit: viewVit, body: viewBody, stats: viewStats, more: viewMore })[tab]();
  if (other) $('#view').insertAdjacentHTML('afterbegin', `<div class="ribbon">${ic('calendar')}<span>Это не сегодня: <b>${longDay(day)}</b> · ${day > today() ? 'будущий день' : 'прошедший день'}</span></div>`);
}
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => { tab = b.dataset.tab; if (tab === 'more') moreSub = null; if (tab === 'home') day = today(); animate = true; window.scrollTo(0, 0); render(); });
const qTab = new URLSearchParams(location.search).get('tab'); if (qTab && TITLES[qTab]) tab = qTab;
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'goto' && TITLES[e.data.tab]) { tab = e.data.tab; day = today(); animate = true; render(); } });
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
