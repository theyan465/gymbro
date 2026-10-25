// Supabase Edge Function: sends Web Push reminders for GymBro.
// Called every 5 minutes by pg_cron (header x-cron-secret), or by a signed-in user with {"test": true}.
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided).

const enc = new TextEncoder();
const b64u = (buf: any) => {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = ''; for (const b of u) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64u = (s: string) => {
  s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
};
const concat = (...a: Uint8Array[]) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}

// RFC 8291 (aes128gcm) payload encryption
export async function encryptPayload(sub: { p256dh: string; auth: string }, payload: Uint8Array) {
  const ua = unb64u(sub.p256dh), authSecret = unb64u(sub.auth);
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const ikm = await hkdf(authSecret, ecdh, concat(enc.encode('WebPush: info\0'), ua, asPub), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(payload, new Uint8Array([2]))));
  return concat(salt, new Uint8Array([0, 0, 0x10, 0]), new Uint8Array([asPub.length]), asPub, ct);
}

// RFC 8292 VAPID authorization header
export async function vapidHeader(endpoint: string, pub: string, priv: string, subject: string) {
  const header = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const p = unb64u(pub);
  const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: b64u(p.slice(1, 33)), y: b64u(p.slice(33, 65)), d: priv, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`)));
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${pub}`;
}

async function sendPush(sub: any, message: any, env: any) {
  const body = await encryptPayload(sub, enc.encode(JSON.stringify(message)));
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(sub.endpoint, env.pub, env.priv, env.subject),
      'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '3600', Urgency: 'normal',
    },
    body,
  });
  return res.status;
}

// ---- schedule logic (pure, unit-tested) ----
const WD: any = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export function localParts(now: Date, tz: string) {
  let parts: any[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(now);
  } catch { return localParts(now, 'UTC'); }
  const g = (t: string) => parts.find((p) => p.type === t).value;
  return { date: `${g('year')}-${g('month')}-${g('day')}`, minutes: +g('hour') * 60 + +g('minute'), wd: WD[g('weekday')] };
}
const toMin = (t: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : -1; };
const inWindow = (t: string, now: number) => { const s = toMin(t); return s >= 0 && now >= s && now < s + 15; };

export function dueReminders(d: any, local: { date: string; minutes: number; wd: number }) {
  const R = d.reminders || {}; if (!R.on) return [];
  const out: any[] = [], now = local.minutes;
  const taken = (d.vitLog || {})[local.date] || [];
  if (R.vit !== false) {
    for (const v of d.vitamins || []) {
      if (v.time && inWindow(v.time, now) && (v.created || '') <= local.date && (v.days || []).includes(local.wd) && !taken.includes(v.id)) {
        out.push({ key: 'vit:' + v.id, group: 'vit', label: v.name + (v.dose ? ' · ' + v.dose : '') });
      }
    }
  }
  const hasWorkout = (d.workouts || []).some((w: any) => w.date === local.date && (w.exercises || []).some((e: any) => (e.sets || []).length));
  const trainDay = d.dayType && d.dayType[local.date] !== undefined ? d.dayType[local.date] : (d.trainDays || []).includes(local.wd);
  if (R.train && R.train.on && trainDay && !hasWorkout && inWindow(R.train.time, now)) out.push({ key: 'train', title: 'Тренировка', body: 'Сегодня тренировочный день. Пора размяться!', tab: 'train' });
  if (R.food && R.food.on && !(d.meals || []).some((m: any) => m.date === local.date) && inWindow(R.food.time, now)) out.push({ key: 'food', title: 'Питание', body: 'Сегодня ещё нет ни одной записи о еде', tab: 'food' });
  if (R.weigh && R.weigh.on && local.wd === R.weigh.day && !(d.body || []).some((b: any) => b.date === local.date && b.weight) && inWindow(R.weigh.time, now)) out.push({ key: 'weigh', title: 'Взвешивание', body: 'Запишите вес за эту неделю', tab: 'home' });
  return out;
}
export function toMessages(items: any[]) {
  const vit = items.filter((i) => i.group === 'vit'), rest = items.filter((i) => !i.group);
  const msgs = rest.map((i) => ({ title: i.title, body: i.body, tab: i.tab, tag: i.key }));
  if (vit.length) msgs.unshift({ title: 'Витамины', body: 'Пора принять: ' + vit.map((i) => i.label).join(', '), tab: 'vit', tag: 'vit' });
  return msgs;
}

// ---- handler ----
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const { createClient } = await import('npm:@supabase/supabase-js@2');
  const E = (k: string) => Deno.env.get(k) || '';
  const admin = createClient(E('SUPABASE_URL'), E('SUPABASE_SERVICE_ROLE_KEY'));
  const env = { pub: E('VAPID_PUBLIC_KEY'), priv: E('VAPID_PRIVATE_KEY'), subject: E('VAPID_SUBJECT') || 'mailto:admin@example.com' };
  if (!env.pub || !env.priv) return json({ error: 'VAPID keys are not configured' }, 500);
  const body = await req.json().catch(() => ({}));

  const deliver = async (sub: any, msg: any) => {
    try {
      const st = await sendPush(sub, msg, env);
      if (st === 404 || st === 410) await admin.from('push_subscriptions').delete().eq('id', sub.id);
      return st;
    } catch (e) { return String(e); }
  };

  const cron = req.headers.get('x-cron-secret');
  if (cron) {
    if (cron !== E('CRON_SECRET')) return json({ error: 'forbidden' }, 403);
    const { data: subs } = await admin.from('push_subscriptions').select('*');
    const byUser: any = {}; for (const s of subs || []) (byUser[s.user_id] ||= []).push(s);
    const ids = Object.keys(byUser); let sent = 0;
    if (ids.length) {
      const { data: rows } = await admin.from('user_data').select('user_id,data').in('user_id', ids);
      const now = new Date();
      for (const row of rows || []) {
        const userSubs = byUser[row.user_id], local = localParts(now, userSubs[0].tz || 'UTC');
        const fresh: any[] = [];
        for (const item of dueReminders(row.data || {}, local)) {
          const { data: ins } = await admin.from('push_log').upsert({ user_id: row.user_id, key: item.key, day: local.date }, { onConflict: 'user_id,key,day', ignoreDuplicates: true }).select();
          if (ins && ins.length) fresh.push(item);
        }
        for (const msg of toMessages(fresh)) for (const s of userSubs) { await deliver(s, msg); sent++; }
      }
    }
    await admin.from('push_log').delete().lt('day', new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10));
    return json({ ok: true, users: ids.length, sent });
  }

  // test mode: a signed-in user sends a notification to their own devices
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer /i, '');
  const { data: u } = await admin.auth.getUser(jwt);
  if (!u || !u.user || !body.test) return json({ error: 'unauthorized' }, 401);
  const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', u.user.id);
  const results: any[] = [];
  for (const s of subs || []) results.push(await deliver(s, { title: 'GymBro', body: 'Уведомления работают', tab: 'home', tag: 'test' }));
  return json({ ok: true, devices: (subs || []).length, results });
}

// @ts-ignore: Deno is only defined on the Supabase runtime
if (typeof Deno !== 'undefined') Deno.serve(handler);
