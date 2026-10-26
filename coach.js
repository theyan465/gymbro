'use strict';
// Coach / client feature. Loaded after app.js and shares its global scope (S, sb, user, sheet, toast, ...).
// The server side lives in supabase-coach.sql: everything a coach can see goes through SECURITY DEFINER functions
// that return only the sections the client shared while the link is active.

const CO = { profile: null, my: null, clients: null, unread: 0, ok: null, err: '', invites: [], cid: null, tab: 'overview', day: today(), exSel: null, chat: null, poll: null, chatPoll: null, plans: {}, myPlans: null };
const coachOn = () => !!(typeof sb !== 'undefined' && sb && user);
async function rpc(name, args) { const { data, error } = await sb.rpc(name, args || {}); if (error) throw error; return data; }
const coachErr = e => { const m = (e && e.message) || String(e); return /function .* does not exist|could not find the function|schema cache|relation .* does not exist/i.test(m) ? 'Функции тренера ещё не настроены в Supabase (нужно выполнить supabase-coach.sql).' : m; };
const ago = iso => { if (!iso) return 'нет данных'; const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); if (m < 2) return 'только что'; if (m < 60) return m + ' мин назад'; const h = Math.round(m / 60); if (h < 24) return h + ' ч назад'; const d = Math.round(h / 24); return d + ' ' + plural(d, ['день', 'дня', 'дней']) + ' назад'; };
const withS = (D, fn) => { const keep = S; S = Object.assign(fresh(), D || {}); try { return fn(); } finally { S = keep; } };
const coachName = () => (CO.profile && CO.profile.display_name) || (user && user.email ? user.email.split('@')[0] : '');


// ---------- sanitizing untrusted input (a plan comes from the coach, client data from the client) ----------
const n0 = v => { const x = parseFloat(v); return isFinite(x) ? Math.max(0, Math.min(99999, x)) : 0; };
const s0 = (v, n) => String(v == null ? '' : v).slice(0, n);
function planClean(p) {
  const P = p.payload || {}, o = {}, g = x => x && typeof x === 'object' ? { kcal: n0(x.kcal), p: n0(x.p), f: n0(x.f), c: n0(x.c) } : null;
  if (p.kind === 'nutrition') {
    o.goals = g(P.goals); o.goalsRest = g(P.goalsRest); o.trainDays = Array.isArray(P.trainDays) ? P.trainDays.map(Number).filter(d => d >= 0 && d <= 6) : null;
    o.meals = (Array.isArray(P.meals) ? P.meals : []).slice(0, 12).map(m => ({ type: ['b', 'l', 'd', 's'].includes(m && m.type) ? m.type : 's', text: s0(m && m.text, 600), items: (Array.isArray(m && m.items) ? m.items : []).slice(0, 30).map(it => ({ n: s0(it && it.n, 80), g: n0(it && it.g), kcal: n0(it && it.kcal), p: n0(it && it.p), f: n0(it && it.f), c: n0(it && it.c) })) }));
  } else {
    o.templates = (Array.isArray(P.templates) ? P.templates : []).slice(0, 14).map(t => ({ id: s0(t && t.id || uid(), 40), name: s0(t && t.name, 80), exercises: (Array.isArray(t && t.exercises) ? t.exercises : []).slice(0, 30).map(e => ({ name: s0(e && e.name, 80), plan: (Array.isArray(e && e.plan) ? e.plan : []).slice(0, 20).map(x => ({ w: n0(x && x.w), r: Math.round(n0(x && x.r)) })).filter(x => x.r > 0) })) }));
    o.schedule = {}; Object.entries(P.schedule && typeof P.schedule === 'object' ? P.schedule : {}).forEach(([wd, id]) => { if (+wd >= 0 && +wd <= 6) o.schedule[wd] = s0(id, 40); });
  }
  o.notes = s0(P.notes, 4000); return { ...p, payload: o, title: s0(p.title, 120), note: s0(p.note, 4000) };
}
function cleanClient(D) {
  D = D && typeof D === 'object' ? D : {}; const arr = x => Array.isArray(x) ? x : [], dt = v => /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '2000-01-01', goal = x => x && typeof x === 'object' ? { kcal: n0(x.kcal), p: n0(x.p), f: n0(x.f), c: n0(x.c) } : { kcal: 0, p: 0, f: 0, c: 0 };
  return {
    meals: arr(D.meals).map(m => ({ id: s0(m.id, 40), date: dt(m.date), name: s0(m.name, 120), g: n0(m.g), kcal: n0(m.kcal), p: n0(m.p), f: n0(m.f), c: n0(m.c), type: ['b', 'l', 'd', 's'].includes(m.type) ? m.type : '' })),
    goals: goal(D.goals), goalsRest: goal(D.goalsRest), trainDays: arr(D.trainDays).map(Number).filter(d => d >= 0 && d <= 6),
    dayType: Object.fromEntries(Object.entries(D.dayType && typeof D.dayType === 'object' ? D.dayType : {}).map(([k, v]) => [dt(k), !!v])),
    workouts: arr(D.workouts).map(w => ({ id: s0(w.id, 40), date: dt(w.date), exercises: arr(w.exercises).map(e => ({ name: s0(e.name, 80), sets: arr(e.sets).map(x => ({ w: n0(x.w), r: Math.round(n0(x.r)) })) })) })),
    exMuscle: {}, templates: [],
    body: arr(D.body).map(b => { const o = { id: s0(b.id, 40), date: dt(b.date) }; MEAS.forEach(([k]) => { if (b[k] > 0) o[k] = n0(b[k]); }); if (arr(b.photos).length) o.photos = arr(b.photos).map(x => s0(x, 200)).slice(0, 12); return o; }),
    vitamins: arr(D.vitamins).map(v => ({ id: s0(v.id, 40), name: s0(v.name, 80), dose: s0(v.dose, 80), when: s0(v.when, 80), time: s0(v.time, 5), days: arr(v.days).map(Number).filter(d => d >= 0 && d <= 6), created: dt(v.created) })),
    vitLog: Object.fromEntries(Object.entries(D.vitLog && typeof D.vitLog === 'object' ? D.vitLog : {}).map(([k, v]) => [dt(k), arr(v).map(x => s0(x, 40))])),
  };
}

// ---------- start-up, polling, badge ----------
async function coachInit() {
  if (!coachOn()) return;
  try {
    let { data: p, error } = await sb.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    if (!p) { p = { user_id: user.id, email: user.email, display_name: (user.email || '').split('@')[0], is_coach: false }; await sb.from('profiles').insert(p); }
    CO.profile = p; await coachRefresh(); CO.ok = true;
  } catch (e) { CO.ok = false; CO.err = coachErr(e); }
  clearInterval(CO.poll); CO.poll = setInterval(() => { if (!document.hidden && coachOn()) coachRefresh().catch(() => {}); }, 45000);
  coachBadge();
}
function coachReset() { clearInterval(CO.poll); clearInterval(CO.chatPoll); Object.assign(CO, { profile: null, my: null, clients: null, unread: 0, ok: null, cid: null, chat: null, myPlans: null, plans: {}, invites: [] }); coachBadge(); }
async function coachRefresh() {
  CO.my = await rpc('my_coach'); if (CO.my) await entriesApply().catch(() => {}); CO.unread = (await rpc('unread_count')) || 0;
  if (CO.profile && CO.profile.is_coach) CO.clients = await rpc('coach_clients', { p_days: 60 });
  coachBadge();
  const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (!typing && !CO.chat && ($('#sheet').hidden) && (tab === 'home' || (tab === 'more' && ['mycoach', 'coach'].includes(moreSub)))) render();
}
function coachBadge() {
  const b = document.querySelector('#tabs [data-tab=more]'); if (!b) return;
  let el = b.querySelector('.bdg'); if (!el) { el = document.createElement('em'); el.className = 'bdg'; b.appendChild(el); }
  const n = (CO.unread || 0) + (CO.my ? CO.my.new_plans || 0 : 0); el.textContent = n > 9 ? '9+' : n; el.hidden = !n;
}

// ---------- hooks used by app.js ----------
function coachMenu() {
  if (!coachOn()) return '';
  const my = CO.my, att = (CO.clients || []).filter(c => clientStats(c).level).length;
  let h = mi('m-mycoach', 'user', 'Мой тренер', my ? esc(my.coach_name) + (my.unread ? ` · сообщений: ${my.unread}` : '') + (my.new_plans ? ` · новых планов: ${my.new_plans}` : '') : 'Подключить тренера по коду');
  if (CO.profile && CO.profile.is_coach) h += mi('m-coach', 'award', 'Мои подопечные', `${(CO.clients || []).length} чел.` + (att ? ` · внимание: ${att}` : '') + (CO.unread && !my ? ` · сообщений: ${CO.unread}` : ''));
  return h;
}
function coachHomeCard() {
  if (!coachOn() || CO.ok === false) return '';
  let h = '';
  if (CO.my) {
    const m = CO.my, note = m.new_plans ? 'Есть новый план' : m.unread ? `Новых сообщений: ${m.unread}` : 'Всё спокойно, можно написать вопрос';
    h += `<div class="card coachcard" data-gocoach="mycoach"><div class="cc-ic">${ic('user')}</div><div class="main"><b>Тренер: ${esc(m.coach_name)}</b><div class="sub">${note}</div></div>${m.unread || m.new_plans ? `<span class="nbadge">${m.unread + m.new_plans}</span>` : ic('right', 'chev')}</div>`;
  }
  if (CO.profile && CO.profile.is_coach && CO.clients && CO.clients.length) {
    const st = CO.clients.map(c => [c, clientStats(c)]).filter(([, s]) => s.level).sort((a, b) => b[1].level - a[1].level), n = CO.clients.reduce((a, c) => a + (c.unread || 0), 0);
    h += `<div class="card coachcard" data-gocoach="coach"><div class="cc-ic">${ic('award')}</div><div class="main"><b>Подопечные: ${CO.clients.length}</b><div class="sub">${st.length ? st.slice(0, 2).map(([c, s]) => esc(c.name) + ' — ' + esc(s.alerts[0])).join('; ') : 'У всех порядок'}</div></div>${n || st.length ? `<span class="nbadge ${st.length ? 'warn' : ''}">${n || st.length}</span>` : ic('right', 'chev')}</div>`;
  }
  return h;
}
function coachBindHome() { document.querySelectorAll('[data-gocoach]').forEach(e => e.onclick = () => { CO.cid = null; CO.chat = null; tab = 'more'; moreSub = e.dataset.gocoach; animate = true; window.scrollTo(0, 0); render(); }); }
// one meal of a coach's plan: products with grams and macros (if chosen from the base) and the free text
const mealHas = m => !!(m && (m.text || (m.items || []).length));
function mealView(m) {
  const it = m.items || [], t = it.reduce((a, i) => { const k = i.g / 100; return { kcal: a.kcal + i.kcal * k, p: a.p + i.p * k, f: a.f + i.f * k, c: a.c + i.c * k }; }, { kcal: 0, p: 0, f: 0, c: 0 });
  return `<div class="cmeal"><b>${(MT.find(x => x[0] === m.type) || ['', 'Приём'])[1]}</b><span>${it.map(i => `<div class="mit"><span translate="no">${esc(i.n)}</span><em>${Math.round(i.g)} г · ${Math.round(i.kcal * i.g / 100)} ккал</em></div>`).join('')}${it.length ? `<div class="mtt"><b>${Math.round(t.kcal)}</b> ккал · Ж${r1(t.f)} У${r1(t.c)} Б${r1(t.p)}</div>` : ''}${m.text ? `<div class="mtx"><span translate="no">${esc(m.text)}</span></div>` : ''}</span></div>`;
}
function coachFoodCard() {
  const c = S.coachNutrition; if (!c) return '';
  const meals = (c.meals || []).filter(mealHas);
  return `<div class="card"><h2><span class="hic">${ic('award')}План питания</span><small><span translate="no">${esc(c.title)}</span></small></h2>
    ${meals.map(mealView).join('')}
    ${c.tips ? `<div class="sub dim" style="margin-top:8px;white-space:pre-wrap"><span translate="no">${esc(c.tips)}</span></div>` : ''}${c.note ? `<div class="sub dim" style="margin-top:8px;white-space:pre-wrap"><span translate="no">${esc(c.note)}</span></div>` : ''}</div>`;
}
function coachTrainCard(d) {
  const tid = S.schedule && S.schedule[wday(d)], t = tid && S.templates.find(x => x.id === tid);
  if (!t || (getWorkout(false) || { exercises: [] }).exercises.length) return '';
  return `<div class="card"><h2><span class="hic">${ic('award')}По плану тренера</span><small>${esc((S.coachTraining || {}).title || '')}</small></h2>
    <div class="main"><b>${esc(t.name)}</b><div class="sub">${t.exercises.map(e => esc(e.name)).join(', ')}</div></div><button class="btn full" data-plan-start="${t.id}" style="margin-top:10px">${ic('plus')}Начать тренировку</button>
    ${(S.coachTraining && (S.coachTraining.tips || S.coachTraining.note)) ? `<div class="sub dim" style="margin-top:8px;white-space:pre-wrap"><span translate="no">${esc(S.coachTraining.tips || S.coachTraining.note)}</span></div>` : ''}</div>`;
}

// ---------- chat ----------
async function chatOpen(linkId, role, refDate) {
  CO.chat = { link: linkId, role, ref: refDate || null, msgs: [], plans: {} };
  clearInterval(CO.chatPoll); CO.chatPoll = setInterval(() => { if (!document.hidden && CO.chat) chatLoad(true); }, 12000);
}
function chatClose() { clearInterval(CO.chatPoll); CO.chat = null; }
async function chatLoad(silent) {
  const c = CO.chat; if (!c) return;
  try {
    const { data, error } = await sb.from('coach_messages').select('*').eq('link_id', c.link).order('created_at', { ascending: true }).limit(300);
    if (error) throw error;
    data.forEach(m => { if (m.ref_date) m.ref_date = String(m.ref_date).slice(0, 10); });
    const grew = data.length !== c.msgs.length; c.msgs = data; if ($('#chatlist')) drawChat(grew);
    if (data.some(m => m.sender_id !== user.id && !m.read_at)) { await rpc('mark_read', { p_link: c.link }); coachRefresh().catch(() => {}); }
  } catch (e) { if (!silent) toast(coachErr(e)); }
}
function drawChat(scroll) {
  const c = CO.chat, box = $('#chatlist'); if (!c || !box) return;
  const near = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  let lastDay = '';
  box.innerHTML = c.msgs.map(m => {
    const mine = m.sender_id === user.id, d = (m.created_at || '').slice(0, 10), head = d !== lastDay ? `<div class="cday">${esc(dayLabel(dkey(m.created_at)))}</div>` : ''; lastDay = d;
    const time = new Date(m.created_at).toLocaleTimeString(LOC, { hour: '2-digit', minute: '2-digit' });
    return head + `<div class="msg ${mine ? 'me' : 'them'}"><div class="mb">${m.ref_date ? `<button class="mref" data-ref="${m.ref_date}">${ic('calendar')}${esc(dayLabel(m.ref_date))}</button>` : ''}<span translate="no">${esc(tsys(m.body))}</span>${m.plan_id ? `<button class="mplan" data-mplan="${m.plan_id}">${ic('list')}Открыть план</button>` : ''}<small>${time}${mine && m.read_at ? ' · прочитано' : ''}</small></div></div>`;
  }).join('') || '<div class="empty">Сообщений пока нет. Напишите первым.</div>';
  if (scroll || near) box.scrollTop = box.scrollHeight;
  box.querySelectorAll('[data-ref]').forEach(b => b.onclick = () => { if (c.role === 'client') { day = b.dataset.ref; chatClose(); tab = 'home'; animate = true; render(); } else { CO.day = b.dataset.ref; CO.tab = 'nutrition'; coachRender(); } });
  box.querySelectorAll('[data-mplan]').forEach(b => b.onclick = () => planOpen(b.dataset.mplan));
}
function chatHtml() {
  const c = CO.chat;
  return `<div class="chat"><div id="chatlist" class="chatlist"><div class="empty">Загружаю…</div></div>
    ${c.ref ? `<div class="chatref">${ic('calendar')}<span>Комментарий к дню: <b>${esc(dayLabel(c.ref))}</b></span><button id="chatnoref" aria-label="Убрать">${ic('x')}</button></div>` : ''}
    <div class="chatin"><textarea id="chatinp" rows="1" maxlength="2000" placeholder="Сообщение…"></textarea><button class="btn" id="chatsend" aria-label="Отправить">${ic('right')}</button></div></div>`;
}
function chatBind() {
  const inp = $('#chatinp'), c = CO.chat;
  inp.oninput = () => { inp.style.height = 'auto'; inp.style.height = Math.min(120, inp.scrollHeight) + 'px'; };
  if ($('#chatnoref')) $('#chatnoref').onclick = () => { c.ref = null; $('.chatref').remove(); };
  $('#chatsend').onclick = async () => {
    const body = inp.value.trim(); if (!body) return;
    $('#chatsend').disabled = true;
    try { await rpc('send_message', { p_link: c.link, p_body: body, p_ref_date: c.ref || null }); inp.value = ''; inp.style.height = 'auto'; c.ref = null; if ($('.chatref')) $('.chatref').remove(); await chatLoad(true); drawChat(true); }
    catch (e) { toast(coachErr(e)); }
    $('#chatsend').disabled = false;
  };
  chatLoad().then(() => drawChat(true));
}

// ---------- plans (client side: view, accept, decline) ----------
async function planFetch(id) {
  if (CO.plans[id]) return CO.plans[id];
  const { data, error } = await sb.from('coach_plans').select('*').eq('id', id).maybeSingle();
  if (error || !data) throw error || new Error('план не найден'); CO.plans[id] = planClean(data); return CO.plans[id];
}
const wdNames = arr => WD_ORDER.filter(d => (arr || []).includes(d)).map(d => WD[d]).join(' ') || '—';
function planBody(p) {
  const P = p.payload || {};
  if (p.kind === 'nutrition') {
    const row = (t, g) => g ? `<div class="prow"><b>${t}</b><span>${g.kcal} ккал · Ж ${g.f} · У ${g.c} · Б ${g.p}</span></div>` : '';
    return row('Тренировочный день', P.goals) + row('День отдыха', P.goalsRest) + (P.trainDays ? `<div class="prow"><b>Тренировочные дни</b><span>${wdNames(P.trainDays)}</span></div>` : '') +
      ((P.meals || []).filter(mealHas).length ? `<div class="sub dim" style="margin:10px 0 2px">Меню и рекомендации</div>${P.meals.filter(mealHas).map(mealView).join('')}` : '') +
      (P.notes ? `<div class="sub dim" style="margin-top:10px;white-space:pre-wrap"><span translate="no">${esc(P.notes)}</span></div>` : '');
  }
  return (P.templates || []).map(t => { const days = Object.entries(P.schedule || {}).filter(([, id]) => id === t.id).map(([wd]) => +wd); return `<div class="pday"><div class="ph2"><b translate="no">${esc(t.name)}</b><span>${wdNames(days)}</span></div>${t.exercises.map(e => `<div class="pex"><span>${esc(e.name)}</span><em>${esc(planText(e.plan)) || '—'}</em></div>`).join('')}</div>`; }).join('') + (P.notes ? `<div class="sub dim" style="margin-top:10px;white-space:pre-wrap"><span translate="no">${esc(P.notes)}</span></div>` : '');
}
async function planOpen(id) {
  let p; try { p = await planFetch(id); } catch (e) { return toast(coachErr(e)); }
  const mine = p.client_id === user.id, st = { sent: 'Ожидает ответа', applied: 'Принят', declined: 'Отклонён' }[p.status];
  sheet(`<h2 class="sh">${p.kind === 'nutrition' ? 'План питания' : 'План тренировок'}</h2><div class="pheader"><b><span translate="no">${esc(p.title)}</span></b><span class="tag ${p.status === 'applied' ? 'train' : ''}">${st}</span></div>
    <div class="dim small">${new Date(p.created_at).toLocaleDateString(LOC, { day: 'numeric', month: 'long' })}</div>
    ${p.note ? `<div class="pnote"><span translate="no">${esc(p.note)}</span></div>` : ''}<div class="pbody">${planBody(p)}</div>
    ${mine && p.status === 'sent' ? `<div class="sub dim" style="margin-top:10px">${p.kind === 'nutrition' ? 'При принятии обновятся ваши нормы КБЖУ.' : 'При принятии шаблоны плана появятся в «Тренировки → Шаблоны», а расписание — в подсказках по дням.'}</div>
    <div class="btns" style="margin-top:14px"><button class="btn" id="pacc">Принять и применить</button><button class="btn ghost danger" id="pdec">Отклонить</button></div>` : ''}`, () => {
    if ($('#pacc')) $('#pacc').onclick = async () => {
      try { await rpc('respond_plan', { p_plan: p.id, p_status: 'applied' }); planApply(p); p.status = 'applied'; okBtn($('#pacc'), () => { closeSheet(); coachRefresh().catch(() => {}); render(); }, 'План применён'); }
      catch (e) { toast(coachErr(e)); }
    };
    if ($('#pdec')) $('#pdec').onclick = async () => { try { await rpc('respond_plan', { p_plan: p.id, p_status: 'declined' }); p.status = 'declined'; closeSheet(); toast('План отклонён'); coachRefresh().catch(() => {}); } catch (e) { toast(coachErr(e)); } };
  });
}
function planApply(p) {
  const P = p.payload || {};
  if (p.kind === 'nutrition') {
    if (P.goals) S.goals = { ...S.goals, ...P.goals }; if (P.goalsRest) S.goalsRest = { ...S.goalsRest, ...P.goalsRest }; if (Array.isArray(P.trainDays)) S.trainDays = P.trainDays;
    S.coachNutrition = { planId: p.id, title: p.title, note: p.note || '', tips: P.notes || '', meals: P.meals || [] };
  } else {
    S.templates = S.templates.filter(t => !t.coach); const idMap = {};
    (P.templates || []).forEach(t => { const id = uid(); idMap[t.id] = id; S.templates.push({ id, name: t.name, exercises: (t.exercises || []).map(e => ({ name: e.name, plan: e.plan || [] })), coach: true }); });
    S.schedule = {}; Object.entries(P.schedule || {}).forEach(([wd, tid]) => { if (idMap[tid]) S.schedule[wd] = idMap[tid]; });
    S.coachTraining = { planId: p.id, title: p.title, note: p.note || '', tips: P.notes || '' };
  }
  save();
}

// ---------- routing ----------
function coachView(sub) {
  if (sub === 'mycoach') { if (CO.chat && CO.chat.role === 'client') coachChatPage(); else coachMyView(); return true; }
  if (sub === 'coach') { CO.cid ? coachClientView() : coachListView(); return true; }
  return false;
}
const cback = (id, label) => `<button class="back" id="${id}">${ic('left')}${label}</button>`;
function coachRender() { animate = false; render(); }
function coachEnter(k) { CO.cid = null; chatClose(); }
function toAccount() { chatClose(); CO.cid = null; moreSub = null; animate = true; window.scrollTo(0, 0); render(); }
function lockedNote() { return CO.ok === false ? `<div class="card"><div class="sub warn">${esc(CO.err)}</div></div>` : ''; }

// ---------- client: "My coach" ----------
const SHARES = [['nutrition', 'Питание', 'дневник еды и ваши нормы КБЖУ'], ['training', 'Тренировки', 'выполненные тренировки и шаблоны'], ['body', 'Замеры тела', 'вес и обхваты'], ['photos', 'Фото прогресса', 'только вместе с замерами'], ['vitamins', 'Витамины', 'расписание и отметки']];
async function plansForMe() {
  if (!CO.my) return [];
  const { data } = await sb.from('coach_plans').select('*').eq('link_id', CO.my.link_id).order('created_at', { ascending: false }).limit(30);
  CO.myPlans = (data || []).map(planClean); CO.myPlans.forEach(p => { CO.plans[p.id] = p; }); return CO.myPlans;
}
function coachMyView() {
  const my = CO.my, pr = CO.profile || {}, st = { sent: 'Новый', applied: 'Принят', declined: 'Отклонён' };
  const profileCard = `<div class="card"><h2>Профиль</h2><label style="margin-top:0">Ваше имя (его видит тренер)</label><input id="pname" value="${esc(pr.display_name || '')}" maxlength="60" autocomplete="off">
    <label class="sw" style="margin-top:10px"><input type="checkbox" id="pcoach" ${pr.is_coach ? 'checked' : ''}><i></i><span>Я тренер: хочу вести подопечных</span></label></div>`;
  $('#view').innerHTML = cback('cback', 'Аккаунт') + lockedNote() + (!my ? `<div class="card"><h2>Мой тренер</h2><div class="dim small" style="margin-bottom:12px">Тренер видит только то, что вы разрешите, и присылает вам планы питания и тренировок. Отключить его можно в любой момент. Код подключения вам даёт тренер.</div>
      <button class="btn full" id="connect">${ic('plus')}Подключить тренера по коду</button></div>`
    : `<div class="card"><h2>Мой тренер</h2><div class="coachhead"><div class="avatar sm">${esc(my.coach_name[0].toUpperCase())}</div><div class="main"><b>${esc(my.coach_name)}</b><div class="sub">с ${new Date(my.since).toLocaleDateString(LOC, { day: 'numeric', month: 'long' })}</div></div></div>
      <button class="btn full" id="gochat" style="margin-top:12px">${ic('right')}Чат с тренером${my.unread ? `<span class="nbadge inl">${my.unread}</span>` : ''}</button></div>
      <div class="card"><h2>Планы от тренера</h2><div id="myplans"><div class="empty">Загружаю…</div></div></div>
      <div class="card"><h2>Что видит тренер</h2>${SHARES.map(([k, n, d]) => `<label class="sw"><input type="checkbox" data-sh="${k}" ${my.share[k] ? 'checked' : ''} ${k === 'photos' && !my.share.body ? 'disabled' : ''}><i></i><span>${n}<small>${d}</small></span></label>`).join('')}</div>
      <div class="card"><h2>Запись тренером</h2><label class="sw"><input type="checkbox" id="wacc" ${my.share.write ? 'checked' : ''}><i></i><span>Тренер может записывать за меня<small>для очных тренировок: он добавит тренировку, еду или замеры в ваш дневник. Такие записи помечены, отключить можно в любой момент</small></span></label></div>
      <button class="btn ghost danger full" id="endlink">Отключить тренера</button>`) + profileCard;
  $('#cback').onclick = toAccount;
  $('#pname').onchange = async e => { const v = e.target.value.trim().slice(0, 60); const { error } = await sb.from('profiles').update({ display_name: v, updated_at: new Date().toISOString() }).eq('user_id', user.id); if (error) return toast(coachErr(error)); CO.profile.display_name = v; toast('Имя сохранено'); };
  $('#pcoach').onchange = async e => { const { error } = await sb.from('profiles').update({ is_coach: e.target.checked }).eq('user_id', user.id); if (error) { e.target.checked = !e.target.checked; return toast(coachErr(error)); } CO.profile.is_coach = e.target.checked; await coachRefresh().catch(() => {}); toast(e.target.checked ? 'Режим тренера включён: раздел «Мои подопечные» в Аккаунте' : 'Режим тренера выключен'); };
  if ($('#connect')) $('#connect').onclick = connectSheet;
  if (my) {
    $('#gochat').onclick = async () => { await chatOpen(my.link_id, 'client'); coachRender(); };
    document.querySelectorAll('[data-sh]').forEach(c => c.onchange = async () => {
      const sh = { ...my.share }; document.querySelectorAll('[data-sh]').forEach(x => { sh[x.dataset.sh] = x.checked; }); if (!sh.body) sh.photos = false;
      try { await rpc('update_shares', { p_link: my.link_id, p_nutrition: sh.nutrition, p_training: sh.training, p_body: sh.body, p_vitamins: sh.vitamins, p_photos: sh.photos }); my.share = sh; toast('Доступ обновлён'); coachRender(); } catch (e) { toast(coachErr(e)); }
    });
    $('#wacc').onchange = async e => { try { await rpc('set_write_access', { p_link: my.link_id, p_allow: e.target.checked }); my.share.write = e.target.checked; toast(e.target.checked ? 'Тренер может записывать за вас' : 'Запись тренером отключена'); } catch (err) { e.target.checked = !e.target.checked; toast(coachErr(err)); } };
    $('#endlink').onclick = async () => { if (!confirm('Отключить тренера? Он перестанет видеть ваши данные. Планы, которые вы уже применили, останутся.')) return; try { await rpc('end_link', { p_link: my.link_id }); await coachRefresh(); toast('Тренер отключён'); } catch (e) { toast(coachErr(e)); } };
    plansForMe().then(list => {
      const box = $('#myplans'); if (!box) return;
      box.innerHTML = list.map(p => `<div class="row pick" data-plan="${p.id}"><div class="main"><b><span translate="no">${esc(p.title)}</span></b><div class="sub">${p.kind === 'nutrition' ? 'План питания' : 'План тренировок'} · ${new Date(p.created_at).toLocaleDateString(LOC, { day: 'numeric', month: 'short' })}</div></div><span class="tag ${p.status === 'sent' ? 'train' : ''}">${st[p.status]}</span></div>`).join('') || '<div class="sub dim">Тренер пока ничего не присылал.</div>';
      box.querySelectorAll('[data-plan]').forEach(r => r.onclick = () => planOpen(r.dataset.plan));
    }).catch(e => { if ($('#myplans')) $('#myplans').innerHTML = `<div class="sub warn">${esc(coachErr(e))}</div>`; });
  }
}
function coachChatPage() {
  const my = CO.my; if (!my) { chatClose(); return coachMyView(); }
  $('#view').innerHTML = cback('cback', 'Мой тренер') + `<div class="chathead"><div class="avatar sm">${esc(my.coach_name[0].toUpperCase())}</div><b>${esc(my.coach_name)}</b></div>` + chatHtml();
  $('#cback').onclick = () => { chatClose(); coachRender(); coachRefresh().catch(() => {}); };
  chatBind();
}
function connectSheet() {
  sheet(`<h2 class="sh">Подключить тренера</h2><div class="dim small">Введите код, который прислал тренер.</div>
    <label>Код приглашения</label><div class="bcrow"><input id="icode" autocomplete="off" autocapitalize="characters" placeholder="XXXXX-XXXXX" style="text-transform:uppercase;letter-spacing:2px;font-weight:600"><button class="btn ghost sm" id="ipaste" type="button">${ic('copy')}Вставить</button></div>
    <div id="cerr" class="sub warn" style="margin-top:6px"></div><div id="cstep"></div>
    <div class="btns" style="margin-top:12px"><button class="btn" id="cnext">Проверить код</button></div>`, () => {
    const fill = t => { const c = findCode(t); if (c) { $('#icode').value = c; $('#cerr').textContent = ''; } return !!c; };
    $('#ipaste').onclick = async () => {
      let t = ''; try { t = await navigator.clipboard.readText(); } catch { t = prompt('Вставьте код или текст приглашения:') || ''; }
      if (fill(t)) $('#cnext').click(); else toast('В буфере нет кода приглашения');
    };
    $('#icode').addEventListener('input', () => { if ($('#icode').value.length > 11) fill($('#icode').value); });   // a whole invitation text pasted by hand
    $('#cnext').onclick = async () => {
      const code = $('#icode').value.trim(); if (!code) return;
      $('#cerr').textContent = '';
      try {
        const r = await rpc('peek_invite', { p_code: code });
        if (!r || !r.valid) return ($('#cerr').textContent = 'Код не найден или просрочен. Попросите тренера создать новый.');
        const sh = { nutrition: true, training: true, body: true, vitamins: true, photos: false };
        $('#cstep').innerHTML = `<div class="pheader" style="margin-top:12px"><b>Тренер: ${esc(r.coach_name)}</b></div><div class="dim small">Что тренер сможет видеть. Это можно изменить позже.</div>
          ${SHARES.map(([k, n, d]) => `<label class="sw"><input type="checkbox" data-c="${k}" ${sh[k] ? 'checked' : ''}><i></i><span>${n}<small>${d}</small></span></label>`).join('')}`;
        $('#cnext').textContent = 'Подключить'; $('#icode').readOnly = true;
        $('#cnext').onclick = async () => {
          const v = {}; document.querySelectorAll('[data-c]').forEach(x => { v[x.dataset.c] = x.checked; });
          try { await rpc('redeem_invite', { p_code: code, p_nutrition: v.nutrition, p_training: v.training, p_body: v.body, p_vitamins: v.vitamins, p_photos: v.photos && v.body }); okBtn($('#cnext'), async () => { closeSheet(); await coachRefresh(); }, 'Тренер подключён'); }
          catch (e) { $('#cerr').textContent = /already have a coach/.test(e.message) ? 'У вас уже есть тренер. Сначала отключите его.' : coachErr(e); }
        };
      } catch (e) { $('#cerr').textContent = coachErr(e); }
    };
  });
}

// ---------- coach: client statistics ----------
function clientStats(c) {
  if (c._st && c._st.at === c.updated_at + '|' + today()) return c._st;
  const sh = c.share || {}, D = cleanClient(c.data), t = today();
  const st = withS(D, () => {
    const r = { alerts: [], level: 0, week: [], foodDays: 0, kcalAvg: 0, goalAvg: 0, trainCount: 0, volume: 0, wNow: null, wDelta: null, vitPct: null };
    const days7 = []; for (let i = 6; i >= 0; i--) days7.push(shiftDay(t, -i));
    const frac = k => { const h = habits(k), parts = []; if (sh.nutrition) parts.push(h.nutr); if (sh.training && h.train !== null) parts.push(h.train); if (sh.vitamins && h.vit !== null) parts.push(h.vit); return parts.length ? parts.filter(Boolean).length / parts.length : null; };
    r.week = days7.map(k => ({ k, f: frac(k) }));
    const fed = days7.filter(k => sumMeals(k).kcal > 0);
    r.foodDays = fed.length; r.kcalAvg = fed.length ? fed.reduce((a, k) => a + sumMeals(k).kcal, 0) / fed.length : 0; r.goalAvg = fed.length ? fed.reduce((a, k) => a + goalFor(k).kcal, 0) / fed.length : 0;
    r.protAvg = fed.length ? fed.reduce((a, k) => a + sumMeals(k).p, 0) / fed.length : 0;
    const wk = D.workouts.filter(w => w.date >= days7[0] && w.exercises.some(e => e.sets.length));
    r.trainCount = wk.length; r.volume = wk.reduce((a, w) => a + w.exercises.reduce((b, e) => b + e.sets.reduce((x, y) => x + y.w * y.r, 0), 0), 0);
    const tr = weightTrend(); if (tr.length) { const now = tr[tr.length - 1], old = [...tr].reverse().find(p => p.x <= now.x - 6.5 * 864e5); r.wNow = now.y; r.wDelta = old ? r1(now.y - old.y) : null; r.wLast = now.date; }
    if (sh.vitamins) { let due = 0, taken = 0; days7.forEach(k => S.vitamins.forEach(v => { if (vitDue(v, k) && k < t) { due++; if (vitTaken(v, k)) taken++; } })); r.vitPct = due ? Math.round(taken / due * 100) : null; }
    const add = (lvl, txt) => { r.alerts.push(txt); r.level = Math.max(r.level, lvl); };
    if (sh.nutrition) { let n = 0; for (let i = 1; i <= 7; i++) { if (sumMeals(shiftDay(t, -i)).kcal > 0) break; n++; } if (n >= 2) add(n >= 3 ? 2 : 1, `нет записей о еде ${n} ${plural(n, ['день', 'дня', 'дней'])}`); }
    if (sh.training) { for (let i = 1; i <= 3; i++) { const k = shiftDay(t, -i); if (S.trainDays.includes(wday(k)) && S.dayType[k] !== false && !D.workouts.some(w => w.date === k && w.exercises.some(e => e.sets.length))) { add(1, `пропущена тренировка (${dayLabel(k)})`); break; } } }
    if (sh.vitamins) { const y = shiftDay(t, -1), due = S.vitamins.filter(v => vitDue(v, y)); if (due.length && !due.every(v => vitTaken(v, y))) add(1, 'вчера не отмечены витамины'); }
    if (sh.body && r.wLast && Math.round((ts(t) - ts(r.wLast)) / 864e5) >= 14) add(1, 'нет взвешиваний 14+ дней');
    return r;
  });
  const idle = c.updated_at ? Math.floor((Date.now() - new Date(c.updated_at).getTime()) / 864e5) : null;
  if (idle !== null && idle >= 3) { st.alerts.unshift(`не заходил(а) ${idle} ${plural(idle, ['день', 'дня', 'дней'])}`); st.level = 2; }
  st.at = c.updated_at + '|' + today(); c._st = st; return st;
}

// ---------- coach: client list ----------
function coachListView() {
  const list = (CO.clients || []).slice().sort((a, b) => clientStats(b).level - clientStats(a).level || a.name.localeCompare(b.name));
  $('#view').innerHTML = cback('cback', 'Аккаунт') + lockedNote() + `<button class="btn full" id="invite">${ic('plus')}Пригласить подопечного</button>
    ${list.map(c => { const s = clientStats(c), sh = c.share; return `<div class="card ccard" data-cid="${c.client_id}"><div class="ctop"><div class="avatar sm l${s.level}">${esc(c.name[0].toUpperCase())}</div><div class="main"><b>${esc(c.name)}</b><div class="sub">активность: ${ago(c.updated_at)}</div></div>${c.unread ? `<span class="nbadge">${c.unread}</span>` : ic('right', 'chev')}</div>
      <div class="cdots">${s.week.map(w => `<i class="cdot ${w.f === null ? 'na' : w.f >= 1 ? 'ok' : w.f > 0 ? 'mid' : 'zero'}" title="${esc(dayLabel(w.k))}"></i>`).join('')}</div>
      <div class="kpis">${sh.nutrition ? `<span>Еда <b>${s.foodDays}/7</b>${s.foodDays ? ` · ${Math.round(s.kcalAvg)} ккал` : ''}</span>` : ''}${sh.training ? `<span>Тренировки <b>${s.trainCount}</b></span>` : ''}${sh.body && s.wNow ? `<span>Вес <b>${s.wNow}</b>${s.wDelta !== null ? ` (${s.wDelta > 0 ? '+' : s.wDelta < 0 ? '−' : ''}${Math.abs(s.wDelta)})` : ''}</span>` : ''}${sh.vitamins && s.vitPct !== null ? `<span>Витамины <b>${s.vitPct}%</b></span>` : ''}</div>
      ${s.alerts.length ? `<div class="alerts">${s.alerts.slice(0, 3).map(a => `<span class="alertchip l${s.level}">${esc(a)}</span>`).join('')}</div>` : ''}</div>`; }).join('') || '<div class="card"><div class="empty">Подопечных пока нет. Создайте приглашение и отправьте код.</div></div>'}
    <div class="card"><h2>Мои шаблоны</h2><div class="dim small" style="margin-bottom:8px">Готовые планы питания и тренировок: отправляйте подопечным в пару касаний.</div>
      ${[['nutrition', 'Питание', 'utensils'], ['training', 'Тренировки', 'dumbbell']].flatMap(([k, n, i]) => ctplList(k).map(t => `<div class="row pick" data-etpl="${k}:${t.id}"><div class="main"><b>${esc(t.name)}</b><div class="sub">${n} · ${esc(ctplInfo(k, t.draft))}</div></div><button class="btn del" data-dtpl="${k}:${t.id}" aria-label="Удалить">${ic('x')}</button></div>`)).join('')}
      <div class="btns" style="margin-top:8px"><button class="btn ghost" id="tpln">${ic('plus')}Шаблон питания</button><button class="btn ghost" id="tplt">${ic('plus')}Шаблон тренировок</button></div></div>
    <div class="card"><h2>Активные приглашения</h2><div id="invlist"><div class="sub dim">Загружаю…</div></div></div>`;
  $('#cback').onclick = toAccount;
  $('#invite').onclick = inviteSheet;
  $('#tpln').onclick = () => planEditor('nutrition', null); $('#tplt').onclick = () => planEditor('training', null);
  document.querySelectorAll('[data-etpl]').forEach(r => r.onclick = e => { if (e.target.closest('[data-dtpl]')) return; const [k, id] = r.dataset.etpl.split(':'), t = ctplList(k).find(x => x.id === id); if (t) planEditor(k, null, { ...ctplDraft(k, t), title: t.name, _tpl: t.id }); });
  document.querySelectorAll('[data-dtpl]').forEach(b => b.onclick = () => { if (!confirm('Удалить шаблон?')) return; const [k, id] = b.dataset.dtpl.split(':'); S.coachTpl[k] = ctplList(k).filter(x => x.id !== id); save(); coachRender(); });
  document.querySelectorAll('[data-cid]').forEach(e => e.onclick = () => coachOpenClient(e.dataset.cid));
  sb.from('coach_invites').select('*').is('used_by', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).then(({ data }) => {
    const box = $('#invlist'); if (!box) return; CO.invites = data || [];
    box.innerHTML = CO.invites.map(i => `<div class="row"><div class="main"><b class="mono">${esc(i.code.slice(0, 5) + '-' + i.code.slice(5))}</b><div class="sub">действует до ${new Date(i.expires_at).toLocaleDateString(LOC, { day: 'numeric', month: 'short' })}</div></div><button class="btn del" data-cpinv="${esc(i.code)}" aria-label="Скопировать">${ic('copy')}</button><button class="btn del" data-delinv="${esc(i.code)}" aria-label="Удалить">${ic('x')}</button></div>`).join('') || '<div class="sub dim">Нет активных приглашений.</div>';
    box.querySelectorAll('[data-cpinv]').forEach(b => b.onclick = () => copyText(inviteText(b.dataset.cpinv)));
    box.querySelectorAll('[data-delinv]').forEach(b => b.onclick = async () => { await sb.from('coach_invites').delete().eq('code', b.dataset.delinv); coachRender(); });
  });
}
const prettyCode = code => code.slice(0, 5) + '-' + code.slice(5);
const inviteText = code => `Присоединяйтесь ко мне в GymBro. Откройте ${location.origin + location.pathname.replace(/index\.html$/, '')}, затем «Аккаунт» → «Мой тренер» и введите код: ${prettyCode(code)}`;
async function copyText(text) { try { await navigator.clipboard.writeText(text); toast('Скопировано'); } catch { prompt('Скопируйте текст:', text); } }
// the code may arrive inside the whole invitation text: pull it out
const findCode = t => { const m = /\b([A-Z0-9]{5})-?([A-Z0-9]{5})\b/i.exec(String(t || '').toUpperCase().replace(/[^A-Z0-9\-\s]/g, ' ')); return m ? m[1] + '-' + m[2] : ''; };
async function inviteSheet() {
  let code; try { code = await rpc('create_invite'); } catch (e) { return toast(coachErr(e)); }
  const pretty = prettyCode(code), text = inviteText(code);
  sheet(`<h2 class="sh">Приглашение</h2><div class="dim small">Отправьте код подопечному. Он действует 7 дней и работает один раз.</div>
    <div class="bigcode">${esc(pretty)}</div>
    <div class="btns"><button class="btn" id="icopy">${ic('copy')}Скопировать</button>${navigator.share ? `<button class="btn ghost" id="ishare">${ic('right')}Отправить</button>` : ''}</div>
    <div class="dim small" style="margin-top:12px">После ввода кода подопечный сам выберет, что вам показывать: питание, тренировки, замеры, фото или витамины.</div>`, () => {
    $('#icopy').onclick = () => copyText(text);
    if ($('#ishare')) $('#ishare').onclick = () => navigator.share({ text }).catch(() => {});
  });
  coachRender();
}
async function coachOpenClient(cid) {
  CO.cid = cid; CO.tab = 'overview'; CO.day = today(); CO.exSel = null; CO.chat = null;
  $('#view').innerHTML = cback('cback', 'Подопечные') + '<div class="empty">Загружаю данные…</div>'; $('#cback').onclick = () => { CO.cid = null; coachRender(); };
  try {
    const r = await rpc('coach_clients', { p_days: 365, p_client: cid });
    if (r && r[0]) { const i = (CO.clients || []).findIndex(x => x.client_id === cid); if (i >= 0) CO.clients[i] = r[0]; else (CO.clients = CO.clients || []).push(r[0]); }
  } catch (e) { toast(coachErr(e)); }
  coachRender();
}

// ---------- coach: client detail ----------
const kpi = (t, v, sub) => `<div class="kpi"><small>${t}</small><b>${v}</b><span>${sub || ''}</span></div>`;
function coachClientView() {
  const c = (CO.clients || []).find(x => x.client_id === CO.cid); if (!c) { CO.cid = null; return coachListView(); }
  const sh = c.share, s = clientStats(c), D = cleanClient(c.data), t = today();
  const tabs = [['overview', 'Обзор'], ['nutrition', 'Питание'], ['training', 'Тренировки'], ['body', 'Тело'], ['plans', 'Планы'], ['rec', 'Запись'], ['chat', 'Чат']];
  const lock = what => `<div class="card"><div class="empty">${ic('lock')}<div style="margin-top:6px">Подопечный не открыл доступ к разделу «${what}».</div></div></div>`;
  let body = '', after = () => {};
  if (CO.tab === 'overview') {
    body = (s.alerts.length ? `<div class="card"><h2>Требует внимания</h2>${s.alerts.map(a => `<div class="alertrow l${s.level}">${ic('bolt')}<span>${esc(a)}</span></div>`).join('')}</div>` : `<div class="card okcard">${ic('check')}Всё в порядке: серьёзных отклонений нет</div>`) +
      `<div class="card"><h2>Последние 7 дней</h2><div class="wk">${s.week.map(w => `<div class="wd1 ${w.k === t ? 'tdy' : ''}" data-cday="${w.k}"><small>${WD[wday(w.k)]}</small><div class="dayc" style="--p:${w.f === null ? 0 : Math.round(w.f * 100)}"><span>${+w.k.slice(8)}</span></div></div>`).join('')}</div><div class="dim small" style="margin-top:8px">Кольцо — доля выполненного за день (питание, тренировка, витамины — то, что открыто).</div></div>
      <div class="kpigrid">${sh.nutrition ? kpi('Питание', `${s.foodDays}/7 дн.`, s.foodDays ? `${Math.round(s.kcalAvg)} из ${Math.round(s.goalAvg)} ккал, белок ${Math.round(s.protAvg)} г` : 'записей нет') : ''}${sh.training ? kpi('Тренировки', `${s.trainCount}`, s.trainCount ? `объём ${Math.round(s.volume)} кг` : 'за 7 дней нет') : ''}${sh.body ? kpi('Вес', s.wNow ? `${s.wNow} кг` : '—', s.wDelta !== null ? `${s.wDelta > 0 ? '+' : s.wDelta < 0 ? '−' : ''}${Math.abs(s.wDelta)} кг за неделю` : 'мало данных') : ''}${sh.vitamins ? kpi('Витамины', s.vitPct === null ? '—' : s.vitPct + '%', 'принято за неделю') : ''}</div>
      <div class="btns" style="margin-bottom:12px"><button class="btn" id="qmsg">${ic('right')}Написать</button><button class="btn ghost" id="qpn">${ic('utensils')}План питания</button><button class="btn ghost" id="qpt">${ic('dumbbell')}План тренировок</button></div>
      <button class="btn ghost danger full" id="cend">Завершить сотрудничество</button>`;
    after = () => {
      document.querySelectorAll('[data-cday]').forEach(e => e.onclick = () => { CO.day = e.dataset.cday; CO.tab = sh.nutrition ? 'nutrition' : 'overview'; coachRender(); });
      $('#qmsg').onclick = () => coachTab('chat'); $('#qpn').onclick = () => planEditor('nutrition', c); $('#qpt').onclick = () => planEditor('training', c);
      $('#cend').onclick = async () => { if (!confirm(`Завершить сотрудничество с «${c.name}»? Вы перестанете видеть его данные.`)) return; try { await rpc('end_link', { p_link: c.link_id }); CO.cid = null; await coachRefresh(); toast('Сотрудничество завершено'); } catch (e) { toast(coachErr(e)); } };
    };
  } else if (CO.tab === 'nutrition') {
    if (!sh.nutrition) body = lock('Питание'); else {
      const d = CO.day, R = withS(D, () => {
        const days = []; for (let i = 6; i >= 0; i--) { const k = shiftDay(d, -i); days.push({ k, t: sumMeals(k), g: goalFor(k) }); }
        const meals = S.meals.filter(m => m.date === d), info = dayInfo(d);
        return { ring: ringCard(sumMeals(d), goalFor(d)), days, meals, info, g: goalFor(d), series: Array.from({ length: 14 }, (_, i) => { const k = shiftDay(t, -13 + i); return { x: ts(k), y: sumMeals(k).kcal }; }) };
      });
      body = `<div class="dnav"><button class="btn sm ghost icon" data-dd="-1">${ic('left')}</button><b>${esc(dayLabel(d))}${d !== t ? '' : ''}</b><button class="btn sm ghost icon" data-dd="1">${ic('right')}</button></div>
        <div class="sub dim" style="margin:-4px 0 10px;text-align:center">${R.info.train ? 'Тренировочный день' : 'День отдыха'} · цель ${Math.round(R.g.kcal)} ккал · Ж${Math.round(R.g.f)} У${Math.round(R.g.c)} Б${Math.round(R.g.p)}</div>
        ${R.ring}
        <div class="card"><h2>Приёмы пищи</h2>${[...MT, ['', 'Без категории']].map(([k, n]) => { const l = R.meals.filter(m => (m.type || '') === k); return l.length ? `<div class="mgroup"><div class="mgh"><b>${n}</b><span>${Math.round(l.reduce((a, m) => a + m.kcal, 0))} ккал</span></div>${l.map(m => `<div class="row"><div class="main">${esc(m.name)}<div class="sub">${Math.round(m.g)} г · Ж${r1(m.f)} У${r1(m.c)} Б${r1(m.p)}</div></div><b>${Math.round(m.kcal)}</b></div>`).join('')}</div>` : ''; }).join('') || '<div class="empty">В этот день записей нет</div>'}
          <button class="btn ghost full" id="cmt" style="margin-top:10px">${ic('right')}Комментарий к этому дню</button></div>
        <div class="card"><h2>Неделя до ${esc(dayLabel(d).toLowerCase())}</h2>${R.days.map(x => { const p = x.g.kcal ? Math.min(130, x.t.kcal / x.g.kcal * 100) : 0; return `<div class="wrow2" data-cday="${x.k}"><span>${WD[wday(x.k)]} ${+x.k.slice(8)}</span><div class="bar"><i style="width:${Math.min(100, p)}%;${p > 105 ? 'background:var(--bad)' : ''}"></i></div><em>${Math.round(x.t.kcal)}</em></div>`; }).join('')}</div>
        <div class="card"><h2>Калории за 14 дней</h2><canvas class="chart" id="cchart"></canvas></div>`;
      after = () => {
        document.querySelectorAll('[data-dd]').forEach(b => b.onclick = () => { CO.day = shiftDay(CO.day, +b.dataset.dd); coachRender(); });
        document.querySelectorAll('[data-cday]').forEach(e => e.onclick = () => { CO.day = e.dataset.cday; coachRender(); });
        $('#cmt').onclick = async () => { await chatOpen(c.link_id, 'coach', CO.day); CO.tab = 'chat'; coachRender(); };
        chart($('#cchart'), R.series, { bars: true, zero: true, line: R.g.kcal });
      };
    }
  } else if (CO.tab === 'training') {
    if (!sh.training) body = lock('Тренировки'); else {
      const R = withS(D, () => {
        const ws = weekStart(t), cur = weekStats(ws), prev = weekStats(shiftDay(ws, -7)), names = [...new Set(D.workouts.flatMap(w => w.exercises.filter(e => e.sets.length).map(e => e.name)))];
        if (!CO.exSel || !names.includes(CO.exSel)) CO.exSel = names[0] || null;
        const pts = []; D.workouts.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(w => w.exercises.filter(e => e.name === CO.exSel && e.sets.length).forEach(e => pts.push({ x: ts(w.date), y: r1(Math.max(...e.sets.map(x => e1rm(x.w, x.r)))) })));
        return { cur, prev, names, pts, list: D.workouts.filter(w => w.exercises.some(e => e.sets.length)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14) };
      });
      body = `<div class="card"><h2>Подходы по группам мышц <small>эта неделя к прошлой</small></h2>${MUSCLES.filter(([m]) => R.cur[m].sets || R.prev[m].sets).map(([m, n]) => { const a = R.cur[m].sets, b = R.prev[m].sets, d = a - b; return `<div class="wrow2"><span style="min-width:84px">${n}</span><div class="bar"><i style="width:${Math.min(100, a / Math.max(a, b, 1) * 100)}%"></i></div><em>${a} <small class="dl ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '+' : ''}${d}</small></em></div>`; }).join('') || '<div class="empty">На этой неделе тренировок нет</div>'}</div>
        ${R.names.length ? `<div class="card"><h2>Прогресс в упражнении <small>расчётный 1ПМ, кг</small></h2><div class="chips">${R.names.map(n => `<button class="chip ${CO.exSel === n ? 'on' : ''}" data-cex="${esc(n)}">${esc(n)}</button>`).join('')}</div><canvas class="chart" id="cex"></canvas></div>` : ''}
        <div class="card"><h2>Последние тренировки</h2>${R.list.map(w => `<div class="cwk"><div class="cwh"><b>${esc(dayLabel(w.date))}</b><span>${Math.round(w.exercises.reduce((a, e) => a + e.sets.reduce((x, y) => x + y.w * y.r, 0), 0))} кг</span></div>${w.exercises.filter(e => e.sets.length).map(e => `<div class="pex"><span>${esc(e.name)}</span><em>${e.sets.map(x => x.w + '×' + x.r).join(', ')}</em></div>`).join('')}</div>`).join('') || '<div class="empty">Тренировок нет</div>'}</div>`;
      after = () => {
        document.querySelectorAll('[data-cex]').forEach(b => b.onclick = () => { CO.exSel = b.dataset.cex; coachRender(); });
        if ($('#cex')) chart($('#cex'), R.pts, { color: '#4ade80' });
      };
    }
  } else if (CO.tab === 'body') {
    if (!sh.body) body = lock('Замеры тела'); else {
      const R = withS(D, () => ({ trend: weightTrend(), raw: D.body.filter(b => b.weight).map(b => ({ x: ts(b.date), y: b.weight })).sort((a, b) => a.x - b.x), rows: D.body.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10) }));
      const photos = D.body.flatMap(b => (b.photos || []).filter(p => p.startsWith(c.client_id + '/')).map(path => ({ path, date: b.date }))).sort((a, b) => b.date.localeCompare(a.date));
      body = `<div class="card"><h2>Вес</h2><canvas class="chart" id="cw"></canvas><div class="sub dim">${R.trend.length ? `<span style="color:var(--acc)">●</span> тренд ${r1(R.trend[R.trend.length - 1].y)} кг · точки — взвешивания` : 'Нет замеров веса'}</div></div>
        ${sh.photos && photos.length ? `<div class="card"><h2>Фото прогресса <button class="btn sm ghost" id="cph2">${ic('copy')}Сравнить</button></h2><div class="strip">${photos.map(x => `<button class="ph" data-cph="${esc(x.path)}"><span>${esc(dayLabel(x.date))}</span></button>`).join('')}</div></div>` : sh.photos ? '' : `<div class="card"><div class="sub dim">Фото подопечный не открыл.</div></div>`}
        <div class="card"><h2>Замеры</h2>${R.rows.map(r => `<div class="row"><div class="main"><b>${esc(dayLabel(r.date))}</b><div class="sub">${MEAS.filter(([k]) => r[k]).map(([k, n]) => (k === 'weight' ? '' : n + ' ') + r[k] + (k === 'weight' ? ' кг' : ' см')).join(' · ') || 'Только фото'}</div></div></div>`).join('') || '<div class="empty">Нет замеров</div>'}</div>`;
      after = () => {
        chart($('#cw'), R.raw, { color: '#60a5fa', dotsOnly: true, extra: R.trend, extraColor: '#34d399' });
        if (photos.length) {
          photoUrls(photos.map(p => p.path)).then(urls => { document.querySelectorAll('[data-cph]').forEach(e => { const i = photos.findIndex(p => p.path === e.dataset.cph); if (urls[i]) e.style.backgroundImage = `url("${urls[i]}")`; }); });
          document.querySelectorAll('[data-cph]').forEach(e => e.onclick = () => coachPhotoSheet(photos, e.dataset.cph, null, D));
          if ($('#cph2')) $('#cph2').onclick = () => photos.length > 1 ? coachPhotoSheet(photos, photos[0].path, photos[photos.length - 1].path, D) : toast('Нужно хотя бы два фото');
        }
      };
    }
  } else if (CO.tab === 'plans') {
    const qt = [['nutrition', 'utensils'], ['training', 'dumbbell']].flatMap(([k, i]) => ctplList(k).map(t => `<button class="chip" data-qt="${k}:${t.id}">${ic(i)}${esc(t.name)}</button>`));
    body = `<div class="btns" style="margin-bottom:12px"><button class="btn" id="npn">${ic('utensils')}План питания</button><button class="btn" id="npt">${ic('dumbbell')}План тренировок</button></div>
      <div class="card"><h2>Быстро из шаблона</h2>${qt.length ? `<div class="chips" style="flex-wrap:wrap">${qt.join('')}</div><div class="sub dim" style="margin-top:8px">Откроется редактор с готовым содержимым: поправьте и отправьте.</div>` : '<div class="sub dim">Шаблонов ещё нет. Создайте их в «Мои подопечные» или сохраните план кнопкой «В шаблон».</div>'}</div><div class="card"><h2>Отправленные планы</h2><div id="planlist"><div class="sub dim">Загружаю…</div></div></div>`;
    after = () => {
      $('#npn').onclick = () => planEditor('nutrition', c); $('#npt').onclick = () => planEditor('training', c);
      document.querySelectorAll('[data-qt]').forEach(b => b.onclick = () => { const [k, id] = b.dataset.qt.split(':'), t = ctplList(k).find(x => x.id === id); if (t) planEditor(k, c, ctplDraft(k, t)); });
      sb.from('coach_plans').select('*').eq('link_id', c.link_id).order('created_at', { ascending: false }).limit(40).then(({ data, error }) => {
        const box = $('#planlist'); if (!box) return; if (error) { box.innerHTML = `<div class="sub warn">${esc(coachErr(error))}</div>`; return; }
        const list = (data || []).map(planClean); list.forEach(p => { CO.plans[p.id] = p; }); const st = { sent: 'Ожидает', applied: 'Принят', declined: 'Отклонён' };
        box.innerHTML = list.map(p => `<div class="row pick" data-plan="${p.id}"><div class="main"><b><span translate="no">${esc(p.title)}</span></b><div class="sub">${p.kind === 'nutrition' ? 'Питание' : 'Тренировки'} · ${new Date(p.created_at).toLocaleDateString(LOC, { day: 'numeric', month: 'short' })}</div></div><span class="tag ${p.status === 'applied' ? 'train' : p.status === 'declined' ? 'rest' : ''}">${st[p.status]}</span></div>`).join('') || '<div class="sub dim">Вы ещё не отправляли планов.</div>';
        box.querySelectorAll('[data-plan]').forEach(r => r.onclick = () => planOpen(r.dataset.plan));
      });
    };
  } else if (CO.tab === 'rec') {
    body = recBody(c); after = () => recBind(c);
  } else {
    body = chatHtml();
    after = () => chatBind();
  }
  $('#view').innerHTML = cback('cback', 'Подопечные') + `<div class="card chead"><div class="avatar sm l${s.level}">${esc(c.name[0].toUpperCase())}</div><div class="main"><b>${esc(c.name)}</b><div class="sub">${esc(c.email || '')} · активность ${ago(c.updated_at)}</div></div></div>
    <div class="chips ctabs">${tabs.map(([k, n]) => `<button class="chip ${CO.tab === k ? 'on' : ''}" data-ct="${k}">${n}${k === 'chat' && c.unread ? `<span class="nbadge inl">${c.unread}</span>` : ''}</button>`).join('')}</div>` + body;
  $('#cback').onclick = () => { chatClose(); CO.cid = null; coachRender(); coachRefresh().catch(() => {}); };
  document.querySelectorAll('[data-ct]').forEach(b => b.onclick = () => coachTab(b.dataset.ct));
  after();
}
async function coachTab(k) {
  const c = (CO.clients || []).find(x => x.client_id === CO.cid); if (!c) return;
  if (k === 'chat') { if (!CO.chat || CO.chat.link !== c.link_id) await chatOpen(c.link_id, 'coach'); } else chatClose();
  CO.tab = k; coachRender();
}
function coachPhotoSheet(photos, a, b, D) {
  const A = photos.find(p => p.path === a), B = b ? photos.find(p => p.path === b) : null; if (!A) return;
  photoUrls([A.path, (B || A).path]).then(([ua, ub]) => {
    const w = d => { const r = D.body.find(x => x.date === d && x.weight); return r ? ` · ${r.weight} кг` : ''; };
    sheet(`<h2 class="sh">${B ? 'Сравнение' : 'Фото'}</h2><div class="${B ? 'cmp' : 'one'}"><figure><img src="${esc(ua)}" alt=""><div class="pcap"><b>${esc(dayLabel(A.date))}</b>${w(A.date)}</div></figure>${B ? `<figure><img src="${esc(ub)}" alt=""><div class="pcap"><b>${esc(dayLabel(B.date))}</b>${w(B.date)}</div></figure>` : ''}</div>
      <label>${B ? 'Сравнить с другой датой' : 'Сравнить с…'}</label><div class="chips" style="flex-wrap:wrap">${photos.filter(p => p.path !== A.path).map(p => `<button class="chip ${B && p.path === B.path ? 'on' : ''}" data-cmpc="${esc(p.path)}">${esc(dayLabel(p.date))}</button>`).join('')}</div>`, pn => {
      pn.querySelectorAll('[data-cmpc]').forEach(x => x.onclick = () => coachPhotoSheet(photos, A.path, x.dataset.cmpc, D));
    });
  });
}

// ---------- coach: plan editors ----------
function planEditor(kind, c, draft) { return kind === 'nutrition' ? nutritionEditor(c, draft) : trainingEditor(c, draft); }
async function sendPlan(c, kind, title, payload, btn) {
  try {
    await rpc('send_plan', { p_link: c.link_id, p_kind: kind, p_title: title, p_note: '', p_payload: payload });
    okBtn(btn, () => { closeSheet(); coachRender(); coachRefresh().catch(() => {}); }, 'План отправлен подопечному');
  } catch (e) { toast(coachErr(e)); }
}
function nutritionEditor(c, draft) {
  if (draft) draft.meals = (draft.meals || []).map(m => ({ ...m, text: String(m.text || '').replace(/<\/?span[^>]*>/g, ''), items: Array.isArray(m.items) ? m.items : [] }));   // clean up texts saved by an earlier display bug
  if (!draft) {
    const D = c && c.share.nutrition ? cleanClient(c.data) : null, gt = D && D.goals.kcal ? D.goals : { kcal: 2400, p: 150, f: 70, c: 270 }, gr = D && D.goalsRest.kcal ? D.goalsRest : { kcal: 2100, p: 150, f: 65, c: 210 };
    draft = { title: '', goals: { ...gt }, goalsRest: { ...gr }, trainDays: D && D.trainDays.length ? D.trainDays.slice() : [1, 3, 5], meals: [], notes: '' };
  }
  const fields = (id, g) => `<div class="grid2 col1"><div><label>Ккал</label><input inputmode="numeric" data-${id}="kcal" value="${g.kcal}"></div><div><label>Жиры, г</label><input inputmode="numeric" data-${id}="f" value="${g.f}"></div>
    <div><label>Углеводы, г</label><input inputmode="numeric" data-${id}="c" value="${g.c}"></div><div><label>Белки, г</label><input inputmode="numeric" data-${id}="p" value="${g.p}"></div></div><div class="sub dim" data-calc="${id}" style="margin-top:6px"></div>`;
  if (!c && !draft._tpl) draft._tpl = 'new';
  sheet(`<h2 class="sh">${c ? 'План питания · ' + esc(c.name) : 'Шаблон питания'}</h2>
    <label style="margin-top:0">${c ? 'Название плана' : 'Название шаблона'}</label><input id="pt" value="${esc(draft.title)}" placeholder="Например: Сушка, 4 недели" maxlength="120">
    <div class="pgroup"><div class="ph3">${ic('bolt')}Тренировочный день</div>${fields('g', draft.goals)}<button class="btn ghost sm" data-fit="g" style="margin-top:8px">Подогнать углеводы под ккал</button></div>
    <div class="pgroup"><div class="ph3">${ic('moon')}День отдыха</div>${fields('r', draft.goalsRest)}<button class="btn ghost sm" data-fit="r" style="margin-top:8px">Подогнать углеводы под ккал</button></div>
    <label>Тренировочные дни недели</label><div id="ptd">${wdChips(draft.trainDays)}</div>
    <label>Меню по приёмам пищи <small class="dim">— необязательно</small></label><div class="sub dim" style="margin:-2px 0 6px">Можно указать только КБЖУ. Продукты по приёмам пищи — по желанию.</div><div id="pmeals">${draft.meals.map((m, i) => `<div class="mealbox" data-mb="${i}"><div class="mbh"><select data-mt2="${i}">${MT.map(([k, n]) => `<option value="${k}" ${m.type === k ? 'selected' : ''}>${n}</option>`).join('')}</select><button class="btn del" data-mdel="${i}" aria-label="Убрать">${ic('x')}</button></div>
      ${m.items.map((it, j) => `<div class="drow"><div class="main"><b>${esc(it.n)}</b><div class="sub" data-isub="${i}.${j}"></div></div><input class="dg" inputmode="decimal" data-ig="${i}.${j}" value="${it.g}"><span class="dim">г</span><button class="btn del" data-idel="${i}.${j}" aria-label="Убрать">${ic('x')}</button></div>`).join('')}
      <button class="btn ghost sm" data-iadd="${i}" style="margin-top:6px">${ic('plus')}Продукт из базы</button><div class="dsum" data-mtot="${i}"></div>
      <textarea data-mx="${i}" rows="2" placeholder="Комментарий или продукты текстом (необязательно)">${esc(m.text)}</textarea></div>`).join('')}</div>
    <div class="dsum" id="menutot"></div>
    <button class="btn ghost sm" id="madd" style="margin-top:6px">${ic('plus')}Приём пищи</button>
    <label>Заметки и рекомендации</label><textarea id="pn" rows="3" maxlength="3000" placeholder="Вода, сон, замены продуктов, как взвешиваться…">${esc(draft.notes)}</textarea>
    ${tplButtons(c)}`, p => {
    bindChips($('#ptd'));
    const read = id => { const o = {}; ['kcal', 'p', 'f', 'c'].forEach(k => { o[k] = Math.round(num(p.querySelector(`[data-${id}="${k}"]`).value)); }); return o; };
    const sync = () => { draft.title = $('#pt').value; draft.goals = read('g'); draft.goalsRest = read('r'); draft.trainDays = pickedDays($('#ptd')); draft.notes = $('#pn').value; draft.meals = [...p.querySelectorAll('[data-mx]')].map((x, i) => ({ type: p.querySelector(`[data-mt2="${i}"]`).value, text: x.value, items: (draft.meals[i] ? draft.meals[i].items : []).map((it, j) => ({ ...it, g: num((p.querySelector(`[data-ig="${i}.${j}"]`) || {}).value) || it.g })) })); };
    const macros = it => `${Math.round(it.kcal * it.g / 100)} ккал · Ж${r1(it.f * it.g / 100)} У${r1(it.c * it.g / 100)} Б${r1(it.p * it.g / 100)}`;
    const tot = items => items.reduce((a, it) => { const k = it.g / 100; return { kcal: a.kcal + it.kcal * k, p: a.p + it.p * k, f: a.f + it.f * k, c: a.c + it.c * k }; }, { kcal: 0, p: 0, f: 0, c: 0 });
    const line = t => `<b>${Math.round(t.kcal)}</b> ккал · Ж${r1(t.f)} У${r1(t.c)} Б${r1(t.p)}`;
    const upd = () => {
      sync(); let all = { kcal: 0, p: 0, f: 0, c: 0 };
      draft.meals.forEach((m, i) => { m.items.forEach((it, j) => { const el = p.querySelector(`[data-isub="${i}.${j}"]`); if (el) el.textContent = macros(it); }); const t = tot(m.items), el = p.querySelector(`[data-mtot="${i}"]`); if (el) el.innerHTML = m.items.length ? line(t) : ''; ['kcal', 'p', 'f', 'c'].forEach(k => { all[k] += t[k]; }); });
      const has = draft.meals.some(m => m.items.length), g = read('g');
      $('#menutot').innerHTML = has ? `<div>Меню даёт: ${line(all)}</div><div class="dim small">Цель тренировочного дня: ${g.kcal} ккал · Ж${g.f} У${g.c} Б${g.p}</div><button class="btn ghost sm" id="mfill" style="margin-top:6px">Подставить в цели тренировочного дня</button>` : '';
      if ($('#mfill')) $('#mfill').onclick = () => { const set = (k, v) => { p.querySelector(`[data-g="${k}"]`).value = Math.round(v); }; set('kcal', all.kcal); set('f', all.f); set('c', all.c); set('p', all.p); calc(); upd(); };
    };
    const calc = () => ['g', 'r'].forEach(id => { const g = read(id), k = 4 * g.p + 4 * g.c + 9 * g.f, el = p.querySelector(`[data-calc="${id}"]`); el.textContent = `Б·Ж·У дают ≈ ${k} ккал`; el.className = 'sub ' + (g.kcal && Math.abs(k - g.kcal) > Math.max(40, g.kcal * 0.08) ? 'warn' : 'dim'); });
    p.querySelectorAll('input[data-g], input[data-r]').forEach(i => { i.oninput = calc; }); calc();
    p.querySelectorAll('[data-fit]').forEach(b => b.onclick = () => { const id = b.dataset.fit, g = read(id); p.querySelector(`[data-${id}="c"]`).value = Math.max(0, Math.round((g.kcal - 4 * g.p - 9 * g.f) / 4)); calc(); });
    tplBind('nutrition', c, draft, sync);
    p.querySelectorAll('[data-ig]').forEach(i => { i.oninput = upd; }); p.querySelectorAll('[data-mx], [data-mt2]').forEach(i => { i.onchange = sync; });
    p.querySelectorAll('[data-iadd]').forEach(b => b.onclick = () => { sync(); const i = +b.dataset.iadd; pickFood({ onPick: f => askGrams(f, g => { draft.meals[i].items.push({ n: s0(f.name, 80), g, kcal: f.kcal, p: f.p, f: f.f, c: f.c }); foodChoose = null; nutritionEditor(c, draft); }) }); });
    p.querySelectorAll('[data-idel]').forEach(b => b.onclick = () => { sync(); const [i, j] = b.dataset.idel.split('.').map(Number); draft.meals[i].items.splice(j, 1); nutritionEditor(c, draft); });
    $('#madd').onclick = () => { sync(); draft.meals.push({ type: autoType(), text: '', items: [] }); nutritionEditor(c, draft); };
    upd();
    p.querySelectorAll('[data-mdel]').forEach(b => b.onclick = () => { sync(); draft.meals.splice(+b.dataset.mdel, 1); nutritionEditor(c, draft); });
    if ($('#psend')) $('#psend').onclick = () => {
      sync(); if (!draft.title.trim()) return $('#pt').focus(); if (!draft.goals.kcal || !draft.goalsRest.kcal) return toast('Укажите калории для обоих типов дней');
      sendPlan(c, 'nutrition', draft.title.trim(), { goals: draft.goals, goalsRest: draft.goalsRest, trainDays: draft.trainDays, meals: draft.meals.filter(m => m.text.trim() || m.items.length).map(m => ({ type: m.type, text: m.text.trim(), items: m.items.map(it => ({ n: it.n, g: Math.round(it.g * 10) / 10, kcal: it.kcal, p: it.p, f: it.f, c: it.c })) })), notes: draft.notes.trim() }, $('#psend'));
    };
  });
}
function trainingEditor(c, draft) {
  if (!draft) draft = { title: '', notes: '', days: [{ id: uid(), name: tx('День') + ' 1', wd: [1], exercises: [] }] };
  if (!c && !draft._tpl) draft._tpl = 'new';
  sheet(`<h2 class="sh">${c ? 'План тренировок · ' + esc(c.name) : 'Шаблон тренировок'}</h2>
    <label style="margin-top:0">${c ? 'Название плана' : 'Название шаблона'}</label><input id="pt" value="${esc(draft.title)}" placeholder="Например: Масса, 3 дня в неделю" maxlength="120">
    ${draft.days.map((d, i) => `<div class="pgroup" data-day="${i}"><div class="dayhead"><input data-dn="${i}" value="${esc(d.name)}" maxlength="80" aria-label="Название дня"><button class="btn del" data-ddel="${i}" aria-label="Удалить день">${ic('x')}</button></div>
      <div class="dim small" style="margin:6px 0 4px">Дни недели</div><div data-dwd="${i}">${wdChips(d.wd)}</div>
      ${d.exercises.map((e, j) => `<div class="pexrow"><div class="pexn"><b>${esc(e.name)}</b><button class="btn del" data-edel="${i}.${j}" aria-label="Убрать">${ic('x')}</button></div><input data-ep="${i}.${j}" value="${esc(e.plan)}" placeholder="вес×повторы: 80x8, 80x8, 80x6"></div>`).join('')}
      <button class="btn ghost sm" data-eadd="${i}" style="margin-top:8px">${ic('plus')}Упражнение</button></div>`).join('')}
    <div class="btns" style="margin-top:10px"><button class="btn ghost" id="dadd">${ic('plus')}День</button>${S.templates.filter(t => !t.coach).length ? `<button class="btn ghost" id="dtpl">${ic('list')}Из моих шаблонов</button>` : ''}</div>
    <label>Заметки и рекомендации</label><textarea id="pn" rows="3" maxlength="3000" placeholder="Разминка, отдых между подходами, техника, прогрессия весов…">${esc(draft.notes)}</textarea>
    ${tplButtons(c)}`, p => {
    p.querySelectorAll('[data-dwd]').forEach(el => bindChips(el));
    const sync = () => {
      draft.title = $('#pt').value; draft.notes = $('#pn').value;
      draft.days.forEach((d, i) => { d.name = p.querySelector(`[data-dn="${i}"]`).value; d.wd = pickedDays(p.querySelector(`[data-dwd="${i}"]`)); d.exercises.forEach((e, j) => { e.plan = p.querySelector(`[data-ep="${i}.${j}"]`).value; }); });
    };
    const again = () => trainingEditor(c, draft);
    tplBind('training', c, draft, sync);
    $('#dadd').onclick = () => { sync(); draft.days.push({ id: uid(), name: tx('День') + ' ' + (draft.days.length + 1), wd: [], exercises: [] }); again(); };
    p.querySelectorAll('[data-ddel]').forEach(b => b.onclick = () => { sync(); draft.days.splice(+b.dataset.ddel, 1); again(); });
    p.querySelectorAll('[data-edel]').forEach(b => b.onclick = () => { sync(); const [i, j] = b.dataset.edel.split('.').map(Number); draft.days[i].exercises.splice(j, 1); again(); });
    p.querySelectorAll('[data-eadd]').forEach(b => b.onclick = () => { sync(); const i = +b.dataset.eadd; addExercise(name => { draft.days[i].exercises.push({ name, plan: '' }); again(); }); });
    if ($('#dtpl')) $('#dtpl').onclick = () => {
      sync(); const tp = S.templates.filter(t => !t.coach);
      sheet(`<h2 class="sh">Мои шаблоны</h2><div class="dim small">Выберите шаблон: он добавится как новый день плана.</div>${tp.map(t => `<div class="row pick" data-tp="${t.id}"><div class="main"><b>${esc(t.name)}</b><div class="sub">${t.exercises.length} упр.</div></div><span class="btn sm ghost">${ic('plus')}</span></div>`).join('')}`, pn => {
        pn.querySelectorAll('[data-tp]').forEach(r => r.onclick = () => { const t = tp.find(x => x.id === r.dataset.tp); draft.days.push({ id: uid(), name: t.name, wd: [], exercises: t.exercises.map(e => ({ name: e.name, plan: planText(e.plan) })) }); again(); });
      });
    };
    if ($('#psend')) $('#psend').onclick = () => {
      sync(); if (!draft.title.trim()) return $('#pt').focus();
      const days = draft.days.filter(d => d.exercises.length); if (!days.length) return toast('Добавьте хотя бы одно упражнение');
      const schedule = {}; days.forEach(d => d.wd.forEach(w => { schedule[w] = d.id; }));
      sendPlan(c, 'training', draft.title.trim(), { templates: days.map(d => ({ id: d.id, name: d.name.trim() || 'День', exercises: d.exercises.map(e => ({ name: e.name, plan: parsePlan(e.plan) })) })), schedule, notes: draft.notes.trim() }, $('#psend'));
    };
  });
}


// ---------- coach: templates (stored in the coach's own account data, synced with it) ----------
const ctplList = kind => (S.coachTpl && S.coachTpl[kind]) || [];
function ctplInfo(kind, d) {
  if (kind === 'nutrition') return `${Math.round((d.goals || {}).kcal || 0)} ккал · приёмов пищи: ${(d.meals || []).length}`;
  const days = d.days || []; return `${days.length} ${plural(days.length, ['день', 'дня', 'дней'])} · ${days.reduce((a, x) => a + x.exercises.length, 0)} упр.`;
}
function ctplSave(kind, name, draft, id) {
  S.coachTpl = S.coachTpl || { nutrition: [], training: [] }; const L = S.coachTpl[kind] = S.coachTpl[kind] || [], d = structuredClone(draft); delete d._tpl;
  const rec = { id: id || uid(), name: s0(name, 80), draft: d, at: Date.now() }, i = L.findIndex(x => x.id === rec.id);
  if (i >= 0) L[i] = rec; else L.unshift(rec); save(); return rec;
}
function ctplDraft(kind, t) {
  const d = structuredClone(t.draft); delete d._tpl; if (!d.title) d.title = t.name;
  if (kind === 'training') (d.days || []).forEach(x => { x.id = uid(); });
  return d;
}
const tplButtons = c => c
  ? `<div class="btns" style="margin-top:14px"><button class="btn" id="psend">${ic('right')}Отправить подопечному</button></div><div class="btns" style="margin-top:8px"><button class="btn ghost" id="tfrom">${ic('list')}Из шаблона</button><button class="btn ghost" id="tsave">${ic('plus')}В шаблон</button></div>`
  : `<div class="btns" style="margin-top:14px"><button class="btn" id="psave">${ic('check')}Сохранить шаблон</button></div>`;
function tplBind(kind, c, draft, sync) {
  if ($('#tfrom')) $('#tfrom').onclick = () => { sync(); ctplPick(kind, c, draft); };
  if ($('#tsave')) $('#tsave').onclick = () => { sync(); sheet(`<h2 class="sh">Сохранить как шаблон</h2><label style="margin-top:0">Название шаблона</label><input id="tn" value="${esc(draft.title)}" maxlength="80" autocomplete="off"><div class="btns" style="margin-top:12px"><button class="btn" id="tok">Сохранить</button></div>`, () => {
    $('#tok').onclick = () => { const n = $('#tn').value.trim(); if (!n) return $('#tn').focus(); ctplSave(kind, n, draft); okBtn($('#tok'), () => planEditor(kind, c, draft), 'Шаблон сохранён'); };
  }); };
  if ($('#psave')) $('#psave').onclick = () => {
    sync(); if (!draft.title.trim()) return $('#pt').focus();
    ctplSave(kind, draft.title.trim(), draft, draft._tpl && draft._tpl !== 'new' ? draft._tpl : null); okBtn($('#psave'), () => { closeSheet(); coachRender(); }, 'Шаблон сохранён');
  };
}
function ctplPick(kind, c, draft) {
  const L = ctplList(kind);
  sheet(`<h2 class="sh">${kind === 'nutrition' ? 'Шаблоны питания' : 'Шаблоны тренировок'}</h2>${L.map(t => `<div class="row pick" data-tp="${t.id}"><div class="main"><b>${esc(t.name)}</b><div class="sub">${esc(ctplInfo(kind, t.draft))}</div></div><button class="btn del" data-tpdel="${t.id}" aria-label="Удалить">${ic('x')}</button></div>`).join('') || '<div class="empty">Шаблонов пока нет. Сохраните план кнопкой «В шаблон».</div>'}
    ${kind === 'training' && L.length ? '<div class="dim small" style="margin-top:8px">Дни шаблона добавятся к плану.</div>' : ''}`, pn => {
    pn.querySelectorAll('[data-tp]').forEach(r => r.onclick = e => {
      if (e.target.closest('[data-tpdel]')) return; const t = L.find(x => x.id === r.dataset.tp), d = ctplDraft(kind, t);
      if (kind === 'training') { draft.days = draft.days.filter(x => x.exercises.length).concat(d.days); if (!draft.title.trim()) draft.title = d.title; if (!draft.notes.trim()) draft.notes = d.notes || ''; planEditor(kind, c, draft); }
      else planEditor(kind, c, { ...d, title: draft.title.trim() || d.title });
    });
    pn.querySelectorAll('[data-tpdel]').forEach(b => b.onclick = () => { if (!confirm('Удалить шаблон?')) return; S.coachTpl[kind] = L.filter(x => x.id !== b.dataset.tpdel); save(); ctplPick(kind, c, draft); });
  });
}

// ---------- coach records for the client (offline sessions) ----------
const okDay = k => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k) && k >= shiftDay(today(), -400) && k <= shiftDay(today(), 1);
function entryApply(e) {
  const d = e && e.data && typeof e.data === 'object' ? e.data : {}, k = okDay(d.date) ? d.date : today();
  if (e.kind === 'meal') {
    S.meals.push({ id: uid(), date: k, name: s0(d.name, 120) || 'Приём пищи', g: n0(d.g), kcal: n0(d.kcal), p: n0(d.p), f: n0(d.f), c: n0(d.c), type: ['b', 'l', 'd', 's'].includes(d.type) ? d.type : '', byCoach: true }); return true;
  }
  if (e.kind === 'workout') {
    const exs = (Array.isArray(d.exercises) ? d.exercises : []).slice(0, 30).map(x => ({ name: s0(x && x.name, 80).trim(), sets: (Array.isArray(x && x.sets) ? x.sets : []).slice(0, 30).map(y => ({ w: n0(y && y.w), r: Math.round(n0(y && y.r)) })).filter(y => y.r > 0), byCoach: true })).filter(x => x.name && x.sets.length);
    if (!exs.length) return false; let w = S.workouts.find(x => x.date === k); if (!w) { w = { id: uid(), date: k, exercises: [] }; S.workouts.push(w); }
    w.exercises.push(...exs); return true;
  }
  if (e.kind === 'body') {
    const rec = {}; MEAS.forEach(([m]) => { const v = n0(d[m]); if (v > 0) rec[m] = Math.min(v, 999); }); if (!Object.keys(rec).length) return false;
    const ex = S.body.find(b => b.date === k); if (ex) Object.assign(ex, rec); else S.body.push({ id: uid(), date: k, ...rec }); return true;
  }
  return false;
}
async function entriesApply() {
  const list = await rpc('pending_entries'); if (!Array.isArray(list) || !list.length) return;
  S.coachApplied = S.coachApplied || []; let n = 0;
  list.forEach(e => { if (S.coachApplied.includes(e.id)) return; if (entryApply(e)) { n++; S.coachApplied.push(e.id); } });
  S.coachApplied = S.coachApplied.slice(-300); if (n) save();
  await rpc('ack_entries', { p_ids: list.map(e => e.id) });
  if (n) { toast(`Тренер записал в дневник: ${n}`); if ($('#sheet').hidden) render(); }
}
async function recSend(c, entries, btn) {
  try { await rpc('coach_add_entries', { p_link: c.link_id, p_entries: entries }); okBtn(btn, () => { closeSheet(); coachRefresh().catch(() => {}); coachRender(); }, 'Записано в дневник подопечного'); }
  catch (e) { toast(/not allowed/.test(e.message) ? 'Подопечный не разрешил запись' : coachErr(e)); }
}
function recBody(c) {
  if (!c.share.write) return `<div class="card"><div class="empty">${ic('lock')}<div style="margin-top:6px">Запись за подопечного выключена. Попросите его включить «Тренер может записывать за меня» в разделе «Аккаунт → Мой тренер».</div></div></div>`;
  return `<div class="card"><h2>Записать за подопечного</h2><div class="dim small" style="margin-bottom:10px">Для очных тренировок без телефона у подопечного. Записи появятся в его дневнике при следующем открытии приложения и будут помечены.${c.pending ? ` Ещё не применено: ${c.pending}.` : ''}</div>
    <div class="btns"><button class="btn" id="rwk">${ic('dumbbell')}Тренировка</button><button class="btn" id="rml">${ic('utensils')}Приём пищи</button><button class="btn" id="rbd">${ic('ruler')}Замеры</button></div></div>
    <div class="card"><h2>Недавние записи</h2><div id="reclist"><div class="sub dim">Загружаю…</div></div></div>`;
}
function recBind(c) {
  if (!c.share.write) return;
  $('#rwk').onclick = () => recWorkout(c); $('#rml').onclick = () => recMeal(c); $('#rbd').onclick = () => recBody2(c);
  sb.from('coach_entries').select('*').eq('link_id', c.link_id).order('created_at', { ascending: false }).limit(15).then(({ data }) => {
    const box = $('#reclist'); if (!box) return; const nm = { workout: 'Тренировка', meal: 'Приём пищи', body: 'Замеры' };
    box.innerHTML = (data || []).map(e => { const p = e.payload || {}; return `<div class="row"><div class="main"><b>${nm[e.kind] || ''}</b><div class="sub">${esc(e.kind === 'meal' ? s0(p.name, 60) : e.kind === 'workout' ? (Array.isArray(p.exercises) ? p.exercises.length : 0) + ' упр.' : '')} ${esc(okDay(p.date) ? dayLabel(p.date) : '')}</div></div><span class="tag ${e.applied_at ? 'train' : ''}">${e.applied_at ? 'в дневнике' : 'ждёт'}</span></div>`; }).join('') || '<div class="sub dim">Пока ничего не записано.</div>';
  });
}
const recDate = id => `<label>Дата</label><input type="date" id="${id}" value="${CO.day || today()}" max="${shiftDay(today(), 1)}">`;
function recWorkout(c, draft) {
  draft = draft || { date: CO.day || today(), exercises: [] };
  sheet(`<h2 class="sh">Тренировка · ${esc(c.name)}</h2>${recDate('rdt')}
    ${draft.exercises.map((e, j) => `<div class="pexrow"><div class="pexn"><b>${esc(e.name)}</b><button class="btn del" data-rdel="${j}" aria-label="Убрать">${ic('x')}</button></div><input data-rp="${j}" value="${esc(e.plan)}" placeholder="вес×повторы: 80x8, 80x8, 80x6"></div>`).join('')}
    <div class="btns" style="margin-top:8px"><button class="btn ghost" id="radd">${ic('plus')}Упражнение</button>${S.templates.filter(t => !t.coach).length ? `<button class="btn ghost" id="rtpl">${ic('list')}Из шаблона</button>` : ''}</div>
    <div class="btns" style="margin-top:14px"><button class="btn" id="rok">${ic('right')}Записать</button></div>`, p => {
    const sync = () => { draft.date = $('#rdt').value || draft.date; draft.exercises.forEach((e, j) => { e.plan = p.querySelector(`[data-rp="${j}"]`).value; }); };
    $('#radd').onclick = () => { sync(); addExercise(name => { draft.exercises.push({ name, plan: '' }); recWorkout(c, draft); }); };
    p.querySelectorAll('[data-rdel]').forEach(b => b.onclick = () => { sync(); draft.exercises.splice(+b.dataset.rdel, 1); recWorkout(c, draft); });
    if ($('#rtpl')) $('#rtpl').onclick = () => { sync(); const tp = S.templates.filter(t => !t.coach); sheet(`<h2 class="sh">Мои шаблоны</h2>${tp.map(t => `<div class="row pick" data-tp="${t.id}"><div class="main"><b>${esc(t.name)}</b><div class="sub">${t.exercises.length} упр.</div></div><span class="btn sm ghost">${ic('plus')}</span></div>`).join('')}`, pn => {
      pn.querySelectorAll('[data-tp]').forEach(r => r.onclick = () => { tp.find(x => x.id === r.dataset.tp).exercises.forEach(e => draft.exercises.push({ name: e.name, plan: planText(e.plan) })); recWorkout(c, draft); });
    }); };
    $('#rok').onclick = () => {
      sync(); const exercises = draft.exercises.map(e => ({ name: e.name, sets: parsePlan(e.plan) })).filter(e => e.sets.length);
      if (!exercises.length) return toast('Добавьте упражнение и подходы, например 80x8, 80x8');
      recSend(c, [{ kind: 'workout', data: { date: draft.date, exercises } }], $('#rok'));
    };
  });
}
function recMeal(c) {
  sheet(`<h2 class="sh">Приём пищи · ${esc(c.name)}</h2>${recDate('rdt')}
    <label>Приём</label><select id="rty">${MT.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select>
    <label>Название</label><input id="rnm" maxlength="120" placeholder="Например: гречка с курицей" autocomplete="off">
    <div class="grid2 col1"><div><label>Граммы</label><input inputmode="decimal" id="rg"></div><div><label>Ккал</label><input inputmode="decimal" id="rk"></div><div><label>Жиры, г</label><input inputmode="decimal" id="rf"></div><div><label>Углеводы, г</label><input inputmode="decimal" id="rcc"></div><div><label>Белки, г</label><input inputmode="decimal" id="rpp"></div></div>
    <div class="btns" style="margin-top:14px"><button class="btn" id="rok">${ic('right')}Записать</button></div>`, () => {
    $('#rok').onclick = () => {
      const name = $('#rnm').value.trim(), kcal = num($('#rk').value); if (!name || !(kcal > 0)) return toast('Укажите название и калории');
      recSend(c, [{ kind: 'meal', data: { date: $('#rdt').value || today(), type: $('#rty').value, name, g: num($('#rg').value), kcal, p: num($('#rpp').value), f: num($('#rf').value), c: num($('#rcc').value) } }], $('#rok'));
    };
  });
}
function recBody2(c) {
  sheet(`<h2 class="sh">Замеры · ${esc(c.name)}</h2>${recDate('rdt')}<div class="grid2">${MEAS.map(([k, n]) => `<div><label>${n}</label><input inputmode="decimal" data-rm="${k}"></div>`).join('')}</div>
    <div class="btns" style="margin-top:14px"><button class="btn" id="rok">${ic('right')}Записать</button></div>`, () => {
    $('#rok').onclick = () => {
      const data = { date: $('#rdt').value || today() }; let any = false; document.querySelectorAll('[data-rm]').forEach(i => { const v = num(i.value); if (v > 0) { data[i.dataset.rm] = v; any = true; } });
      if (!any) return toast('Заполните хотя бы одно значение'); recSend(c, [{ kind: 'body', data }], $('#rok'));
    };
  });
}
