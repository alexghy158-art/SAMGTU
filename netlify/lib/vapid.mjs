// VAPID-ключи для push: создаются один раз и хранятся в Netlify Blobs.
// Приватный ключ никогда не покидает Netlify — ни в репозиторий, ни в браузер.
import { getStore } from '@netlify/blobs';
import webpush from 'web-push';

const KEY = 'vapid';

export async function getVapidKeys() {
  // strong: только что записанное значение сразу видно при чтении (по умолчанию — eventual).
  const store = getStore({ name: 'push', consistency: 'strong' });
  const existing = await store.get(KEY, { type: 'json' });
  if (existing?.publicKey && existing?.privateKey) return existing;

  const fresh = webpush.generateVAPIDKeys();
  // onlyIfNew: если два вызова пришли одновременно, запишется только первый.
  const res = await store.setJSON(KEY, fresh, { onlyIfNew: true });
  if (res?.modified) return fresh;
  const winner = await store.get(KEY, { type: 'json' });
  if (!winner?.publicKey) throw new Error('Не удалось получить VAPID-ключи из Netlify Blobs');
  return winner;
}
