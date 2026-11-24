// Плановая функция Netlify: раз в 5 минут забирает наступившие напоминания из Supabase и рассылает push.
// Переменные окружения (задаются в Netlify): SUPABASE_URL, SUPABASE_ANON_KEY, TRACKER_CRON_SECRET.
// VAPID-ключи берутся из Netlify Blobs (см. netlify/lib/vapid.mjs).
import webpush from 'web-push';
import { getVapidKeys } from '../lib/vapid.mjs';

async function rpc(name, args) {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${name}: ${res.status} ${body?.message || ''}`);
  return body;
}

export async function sendDue() {
  const env = process.env;
  for (const k of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'TRACKER_CRON_SECRET']) {
    if (!env[k]) throw new Error(`Не задана переменная окружения ${k}`);
  }
  const vapid = await getVapidKeys();
  // subject — адрес сайта (контакт для push-сервисов), env.URL задаёт сам Netlify.
  webpush.setVapidDetails(env.URL || 'https://ephemeral-torrone-aa4f59.netlify.app', vapid.publicKey, vapid.privateKey);

  const due = await rpc('tracker_cron_due', { p_secret: env.TRACKER_CRON_SECRET });
  let sent = 0;
  let failed = 0;
  let dropped = 0;
  for (const item of due) {
    const payload = JSON.stringify({ title: item.title, body: item.body || '', url: item.url || '#today', tag: item.id });
    for (const sub of item.subs || []) {
      try {
        await webpush.sendNotification(sub, payload, { TTL: 3600, urgency: 'high' });
        sent++;
      } catch (err) {
        failed++;
        // Подписка больше не действует (удалили приложение, сбросили разрешение) — убираем.
        if (err.statusCode === 404 || err.statusCode === 410) {
          await rpc('tracker_cron_drop_push', { p_secret: env.TRACKER_CRON_SECRET, p_endpoint: sub.endpoint }).catch(() => {});
          dropped++;
        } else {
          console.error('push failed', err.statusCode, err.body || err.message);
        }
      }
    }
  }
  return { due: due.length, sent, failed, dropped };
}

export default async () => {
  try {
    const r = await sendDue();
    console.log('reminders', JSON.stringify(r));
    return new Response(JSON.stringify(r), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('reminders error', e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};

export const config = { schedule: '*/5 * * * *' };
