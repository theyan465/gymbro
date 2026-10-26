'use strict';
// Localization. Russian is the source language of every string in the app; for uk / en / pl the DOM is translated
// phrase by phrase (see i18n-data.js) right after it is rendered, so the views keep emitting Russian text.
// Loaded before app.js. Exposes: LANG, LANG_PREF, LOC, LANG_NAMES, setLang(), tx() and tsys().
(() => {
  const SUP = ['ru', 'uk', 'en', 'pl'], LOCALES = { ru: 'ru-RU', uk: 'uk-UA', en: 'en-GB', pl: 'pl-PL' }, NAMES = { ru: 'Русский', uk: 'Українська', en: 'English', pl: 'Polski' };
  const detect = () => {
    for (const l of (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'])) {
      const b = String(l).toLowerCase().split('-')[0];
      if (SUP.includes(b)) return b;
      if (b === 'be' || b === 'kk') return 'ru';
    }
    return 'en';
  };
  let pref = 'auto'; try { pref = localStorage.getItem('gymbro.lang') || 'auto'; } catch { /* private mode */ }
  const LANG = SUP.includes(pref) ? pref : detect();
  window.detectLang = detect; window.LANG = LANG; window.LANG_PREF = SUP.includes(pref) ? pref : 'auto'; window.LOC = LOCALES[LANG]; window.LANG_NAMES = NAMES;
  window.setLang = l => { try { if (l === 'auto') localStorage.removeItem('gymbro.lang'); else localStorage.setItem('gymbro.lang', l); } catch { /* ignore */ } location.reload(); };
  document.documentElement.lang = LANG;

  const col = { uk: 1, en: 2, pl: 3 }[LANG], CYR = /[А-Яа-яЁё]/, isCyr = c => (c >= 0x410 && c <= 0x44f) || c === 0x401 || c === 0x451;
  const isLetter = c => isCyr(c) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 0x406 || c === 0x456 || c === 0x407 || c === 0x457 || c === 0x404 || c === 0x454 || c === 0x490 || c === 0x491 || (c >= 0xc0 && c <= 0x17f);
  const lcFirst = s => s.charAt(0).toLowerCase() + s.slice(1);

  // phrase index: first Cyrillic word of a phrase -> candidates (longest first)
  const IDX = new Map();
  if (LANG !== 'ru' && window.I18N) {
    const have = new Set(I18N.d.map(r => r[0])), add = (k, v) => { const m = /[А-Яа-яЁё]+/.exec(k); if (!m) return; let a = IDX.get(m[0]); if (!a) IDX.set(m[0], a = []); a.push({ k, off: m.index, v }); };
    for (const r of I18N.d) {
      const k = r[0], v = r[col]; add(k, v);
      const lk = lcFirst(k);   // "Сегодня" also matches "сегодня" (day labels are lower-cased in places)
      if (lk !== k && k.length > 3 && !have.has(lk) && k.slice(1) === k.slice(1).toLowerCase()) add(lk, lcFirst(v));
    }
    IDX.forEach(a => a.sort((x, y) => y.k.length - x.k.length));
  }

  const cache = new Map();
  function tx(s) {
    if (LANG === 'ru' || !s || typeof s !== 'string' || !CYR.test(s)) return s;
    const hit = cache.get(s); if (hit !== undefined) return hit;
    const n = s.length; let out = '', last = 0, i = 0;
    while (i < n) {
      const c = s.charCodeAt(i);
      if (isCyr(c) && (i === 0 || !isLetter(s.charCodeAt(i - 1)))) {
        let j = i; while (j < n && isCyr(s.charCodeAt(j))) j++;
        const cands = IDX.get(s.slice(i, j));
        let found = null, st = 0, end = 0;
        if (cands) for (const k of cands) {
          st = i - k.off; if (st < last || !s.startsWith(k.k, st)) continue;
          end = st + k.k.length;
          if (isLetter(k.k.charCodeAt(0)) && st > 0 && isLetter(s.charCodeAt(st - 1))) continue;
          if (isLetter(k.k.charCodeAt(k.k.length - 1)) && end < n && isLetter(s.charCodeAt(end))) continue;
          found = k; break;
        }
        if (found) { out += s.slice(last, st) + found.v; last = end; i = end; continue; }
        i = j; continue;
      }
      i++;
    }
    out += s.slice(last);
    if (cache.size > 4000) cache.clear();
    cache.set(s, out); return out;
  }
  window.tx = tx;

  // service messages written into the chat by the database (Russian) -> the reader's language
  const SYS = [
    [/^Подключился к вам как подопечный\.$/, ['Підключився до вас як підопічний.', 'Connected to you as a client.', 'Połączył się z Tobą jako podopieczny.']],
    [/^Тренер завершил сотрудничество\.$/, ['Тренер завершив співпрацю.', 'The coach ended the collaboration.', 'Trener zakończył współpracę.']],
    [/^Подопечный завершил сотрудничество\.$/, ['Підопічний завершив співпрацю.', 'The client ended the collaboration.', 'Podopieczny zakończył współpracę.']],
    [/^Тренер записал за вас: (\d+) шт\.$/, ['Тренер записав за вас: $1 шт.', 'Your coach logged $1 item(s) for you.', 'Trener zapisał za Ciebie: $1 szt.']],
    [/^Новый план питания: ([\s\S]*)$/, ['Новий план харчування: $1', 'New meal plan: $1', 'Nowy plan żywieniowy: $1']],
    [/^Новый план тренировок: ([\s\S]*)$/, ['Новий план тренувань: $1', 'New training plan: $1', 'Nowy plan treningowy: $1']],
    [/^Принял план «([\s\S]*)»$/, ['План «$1» прийнято', 'Plan “$1” accepted', 'Plan «$1» przyjęty']],
    [/^Отклонил план «([\s\S]*)»$/, ['План «$1» відхилено', 'Plan “$1” declined', 'Plan «$1» odrzucony']],
  ];
  window.tsys = body => {
    if (LANG === 'ru' || typeof body !== 'string') return body;
    for (const [re, to] of SYS) if (re.test(body)) return body.replace(re, to[col - 1]);
    return body;
  };

  // ---------- DOM ----------
  if (LANG === 'ru') return;
  const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'], SKIP = /^(SCRIPT|STYLE|TEXTAREA)$/;
  const blocked = el => !!(el && el.closest && el.closest('[translate=no],script,style,textarea'));
  // nodes/attributes we already wrote: their (translated) content must never be run through the Russian dictionary again
  const doneT = new WeakMap(), doneA = new WeakMap();
  function text(t) {
    const s = t.data; if (!CYR.test(s) || doneT.get(t) === s) return;
    if (blocked(t.parentElement)) return;
    const o = tx(s); if (o !== s) t.data = o;
    doneT.set(t, t.data);
  }
  function attrs(el) {
    let m = doneA.get(el);
    for (const a of ATTRS) {
      const v = el.getAttribute(a); if (!v || !CYR.test(v) || (m && m[a] === v)) continue;
      const o = tx(v); if (o !== v) el.setAttribute(a, o);
      if (!m) doneA.set(el, m = {}); m[a] = o;
    }
  }
  function walk(root) {
    if (root.nodeType === 3) return text(root);
    if (root.nodeType !== 1 || blocked(root)) return;
    attrs(root);
    const w = document.createTreeWalker(root, 1 | 4, { acceptNode: n => n.nodeType === 1 && (n.getAttribute('translate') === 'no' || SKIP.test(n.tagName)) ? 2 : 1 });
    let n; while ((n = w.nextNode())) { if (n.nodeType === 3) text(n); else attrs(n); }
  }
  const obs = new MutationObserver(recs => {
    for (const r of recs) {
      if (r.type === 'childList') r.addedNodes.forEach(walk);
      else if (r.type === 'characterData') text(r.target);
      else if (r.type === 'attributes') attrs(r.target);
    }
  });
  const start = () => { walk(document.body); document.title = tx(document.title); obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS }); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);

  // native dialogs
  for (const f of ['alert', 'confirm', 'prompt']) { const o = window[f].bind(window); window[f] = (m, ...a) => o(tx(String(m)), ...a); }
})();
