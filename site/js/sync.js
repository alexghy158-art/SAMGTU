// Облачная синхронизация по коду. Локальная копия всегда главная для работы офлайн;
// облако — общий «сейф», ревизии защищают от затирания чужих изменений.
import { SUPABASE_URL, SUPABASE_ANON_KEY, PUSH_KEY_URL } from './config.js';
import { normalize, persistQuiet } from './store.js';
import { buildReminders } from './reminders.js';

const META_KEY = 'samgtu_sync';
const listeners = new Set();
let meta = readMeta();
let ctxRef = null;
let pushTimer = null;
let busy = false;
let status = meta.code ? 'idle' : 'off'; // off | idle | syncing | ok | error | offline
let lastError = '';

function readMeta() {
  try {
    return { code: '', rev: 0, dirty: false, lastSync: null, remHash: '', ...JSON.parse(localStorage.getItem(META_KEY) || '{}') };
  } catch {
    return { code: '', rev: 0, dirty: false, lastSync: null, remHash: '' };
  }
}
function writeMeta() {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {}
}
function setStatus(s, err = '') {
  status = s;
  lastError = err;
  listeners.forEach((fn) => fn(getSyncInfo()));
}

export function onSyncChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function getSyncInfo() {
  return { enabled: !!meta.code, code: meta.code, status, lastSync: meta.lastSync, dirty: meta.dirty, error: lastError };
}

async function rpc(name, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message || `Ошибка сервера ${res.status}`);
  return body;
}

export function newCode() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function joinLink(code = meta.code) {
  return `${location.origin}${location.pathname}#join=${encodeURIComponent(code)}`;
}

function applyRemote(remote) {
  const s = normalize(remote.data);
  meta.rev = remote.rev;
  meta.dirty = false;
  meta.lastSync = new Date().toISOString();
  writeMeta();
  persistQuiet(s);
  ctxRef.state = s;
  ctxRef.rerender();
}

async function resolveConflict(remote) {
  const when = remote.updated_at ? new Date(remote.updated_at).toLocaleString('ru-RU') : '';
  const takeRemote = confirm(
    `На другом устройстве есть изменения${when ? ` от ${when}` : ''}, которых здесь нет.\n\n` +
      'ОК — загрузить их (несинхронизированные правки на этом устройстве пропадут).\n' +
      'Отмена — оставить данные этого устройства и перезаписать облако.'
  );
  if (takeRemote) {
    applyRemote(remote);
    return;
  }
  meta.rev = remote.rev; // перезапишем поверх актуальной ревизии
  meta.dirty = true;
  writeMeta();
  await pushNow();
}

/** Забрать изменения из облака. */
export async function pull() {
  if (!meta.code || busy) return;
  if (!navigator.onLine) return setStatus('offline');
  busy = true;
  setStatus('syncing');
  try {
    const r = await rpc('tracker_pull', { p_code: meta.code });
    busy = false;
    if (!r.exists) {
      meta.rev = 0;
      meta.dirty = true;
      writeMeta();
      return pushNow();
    }
    if (r.rev > meta.rev) {
      if (meta.dirty) await resolveConflict(r);
      else applyRemote(r);
    } else if (meta.dirty) {
      return pushNow();
    }
    meta.lastSync = new Date().toISOString();
    writeMeta();
    setStatus('ok');
    syncReminders();
  } catch (e) {
    busy = false;
    setStatus(navigator.onLine ? 'error' : 'offline', e.message);
  }
}

/** Отправить локальные изменения. */
export async function pushNow() {
  clearTimeout(pushTimer);
  if (!meta.code || busy) return;
  if (!navigator.onLine) return setStatus('offline');
  busy = true;
  setStatus('syncing');
  try {
    const r = await rpc('tracker_push', { p_code: meta.code, p_data: ctxRef.state, p_base_rev: meta.rev });
    busy = false;
    if (r.ok) {
      meta.rev = r.rev;
      meta.dirty = false;
      meta.lastSync = new Date().toISOString();
      writeMeta();
      setStatus('ok');
      syncReminders();
    } else if (r.conflict) {
      await resolveConflict(r);
    }
  } catch (e) {
    busy = false;
    setStatus(navigator.onLine ? 'error' : 'offline', e.message);
  }
}

function schedulePush() {
  if (!meta.code) return;
  meta.dirty = true;
  writeMeta();
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushNow, 1500);
}

/** Включить синхронизацию: новый код (первое устройство) или существующий (второе). */
export async function enableSync(code, { fresh = false } = {}) {
  meta = { code, rev: 0, dirty: fresh, lastSync: null, remHash: '' };
  writeMeta();
  if (fresh) {
    await pushNow();
    return;
  }
  setStatus('syncing');
  const r = await rpc('tracker_pull', { p_code: code });
  if (!r.exists) {
    meta.code = '';
    writeMeta();
    setStatus('off');
    throw new Error('Такого кода нет в облаке. Проверьте, что скопировали его целиком.');
  }
  applyRemote(r);
  setStatus('ok');
  syncReminders();
}

export function disableSync() {
  meta = { code: '', rev: 0, dirty: false, lastSync: null, remHash: '' };
  writeMeta();
  setStatus('off');
}

// ---------- Напоминания и push ----------

async function syncReminders(force = false) {
  if (!meta.code) return;
  const items = buildReminders(ctxRef.state);
  const hash = JSON.stringify(items);
  if (!force && hash === meta.remHash) return;
  try {
    await rpc('tracker_set_reminders', { p_code: meta.code, p_items: items });
    meta.remHash = hash;
    writeMeta();
  } catch {}
}

function b64ToBytes(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function pushState() {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  return sub ? 'on' : 'off';
}

export async function enablePush() {
  if (!meta.code) throw new Error('Сначала включите синхронизацию — напоминания приходят через облако.');
  if (!pushSupported()) throw new Error('Этот браузер не умеет push. На iPhone сначала добавьте сайт на экран «Домой» и откройте его оттуда.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Уведомления запрещены в настройках браузера.');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const r = await fetch(PUSH_KEY_URL).catch(() => null);
    const key = r && r.ok ? (await r.json()).publicKey : null;
    if (!key) throw new Error('Сервер уведомлений недоступен. Попробуйте позже.');
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
  }
  await rpc('tracker_add_push', { p_code: meta.code, p_sub: sub.toJSON() });
  await syncReminders(true);
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (!sub) return;
  if (meta.code) await rpc('tracker_remove_push', { p_code: meta.code, p_endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}

export async function testPush() {
  if (!meta.code) throw new Error('Синхронизация выключена');
  const at = new Date(Date.now() + 60 * 1000).toISOString();
  const items = [...buildReminders(ctxRef.state), { id: 'test:' + at, at, title: 'Тестовое напоминание', body: 'Если вы это видите — уведомления работают 🎉', url: '#today' }];
  await rpc('tracker_set_reminders', { p_code: meta.code, p_items: items });
  meta.remHash = '';
  writeMeta();
}

/** Подключить синхронизацию к приложению. */
export function initSync(ctx, setHook) {
  ctxRef = ctx;
  setHook(() => schedulePush());
  if (meta.code) pull();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') pull();
    else if (meta.dirty) pushNow();
  });
  window.addEventListener('online', () => pull());
  window.addEventListener('offline', () => setStatus('offline'));
  // Раз в час обновляем окно напоминаний (пары на ближайшие дни).
  setInterval(() => syncReminders(), 60 * 60 * 1000);
}
