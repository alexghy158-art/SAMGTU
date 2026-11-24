// Публичный VAPID-ключ для подписки браузера на push.
import { getVapidKeys } from '../lib/vapid.mjs';

export default async () => {
  try {
    const { publicKey } = await getVapidKeys();
    return Response.json({ publicKey }, { headers: { 'Cache-Control': 'public, max-age=3600' } });
  } catch (e) {
    console.error('push-key error', e.message);
    return Response.json({ error: 'unavailable' }, { status: 500 });
  }
};

export const config = { path: '/api/push-key' };
