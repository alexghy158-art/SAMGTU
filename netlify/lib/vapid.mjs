// VAPID-ключи для push: создаются один раз и хранятся в Netlify Blobs.
// Приватный ключ никогда не покидает Netlify — ни в репозиторий, ни в браузер.
import { getStore } from '@netlify/blobs';
import webpush from 'web-push';

const KEY = 'vapid';

export async function getVapidKeys() {
  const store = getStore('push');
  let keys = await store.get(KEY, { type: 'json' });
  if (keys?.publicKey && keys?.privateKey) return keys;
  const fresh = webpush.generateVAPIDKeys();
  // onlyIfNew: если два вызова пришли одновременно, победит первый, остальные перечитают.
  await store.setJSON(KEY, fresh, { onlyIfNew: true });
  keys = await store.get(KEY, { type: 'json' });
  return keys;
}
