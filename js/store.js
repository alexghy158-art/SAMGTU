// Хранилище: состояние в localStorage, миграция со старой версии, бэкап.
import { CLASSES } from '../data/schedule.js';
import { SEED_SHIFTS, SEED_WATCH, SEED_UNIS } from '../data/seed.js';
import { CATALOG } from '../data/catalog.js';
import { todayISO } from './utils.js';

const KEY = 'samgtu_v6';
const OLD_KEYS = ['tracker_ucheba_rabota_v5', 'tracker_ucheba_rabota_v4', 'tracker_ucheba_rabota_v3', 'tracker_ucheba_rabota_v2', 'tracker_ucheba_rabota_v1'];

export const DEFAULT_DOCS = [
  ['passport', 'Загранпаспорт'],
  ['diploma', 'Диплом / справка об обучении'],
  ['transcript', 'Транскрипт'],
  ['cv', 'CV'],
  ['sop', 'Motivation letter / SOP'],
  ['rec1', 'Рекомендация 1'],
  ['rec2', 'Рекомендация 2'],
  ['lang', 'Сертификат языка'],
  ['finance', 'Финансовые документы'],
].map(([id, title]) => ({ id, title, done: false }));

export const classKey = (c) => `${c.date}|${c.start}|${c.subject}`;

function withIds(list) {
  return list.map((x, i) => ({ ...x, id: i + 1 }));
}

function fresh() {
  return {
    version: 6,
    attendance: {},
    shifts: withIds(SEED_SHIFTS),
    tasks: [],
    materials: [],
    notes: {},
    salaryGoals: {},
    finance: { wallets: { card: 0, cash: 0, change: 0, coins: 0 }, ops: [], advanceDay: 25, salaryDay: 10 },
    magistr: {
      unis: fixUnis(withIds(SEED_UNIS)),
      deadlines: [],
      lang: { exam: 'IELTS', target: '', current: '', date: '', plan: '' },
      sop: { why: '', exp: '', future: '' },
      docs: DEFAULT_DOCS.map((d) => ({ ...d })),
    },
    watch: withIds(SEED_WATCH),
    updatedAt: null,
  };
}


// Старый формат (tracker_ucheba_rabota_v1..v5) → новый.
function fromOld(o) {
  const s = fresh();
  for (const c of o.classes || []) {
    if (c.status || c.reason) s.attendance[classKey(c)] = { status: c.status || '', reason: c.reason || '' };
  }
  if (Array.isArray(o.shifts)) s.shifts = withIds(o.shifts);
  if (Array.isArray(o.tasks)) s.tasks = withIds(o.tasks);
  if (Array.isArray(o.materials)) s.materials = withIds(o.materials);
  if (o.meta?.notes) s.notes = o.meta.notes;
  if (o.meta?.salaryGoals) s.salaryGoals = o.meta.salaryGoals;
  if (o.finance) {
    const f = o.finance;
    s.finance = {
      wallets: { ...s.finance.wallets, ...(f.wallets || {}) },
      ops: Array.isArray(f.ops) ? f.ops : [],
      advanceDay: f.advanceDay || 25,
      salaryDay: f.salaryDay || 10,
    };
  }
  if (o.magistr) {
    const m = o.magistr;
    s.magistr = {
      unis: Array.isArray(m.unis) ? m.unis : s.magistr.unis,
      deadlines: Array.isArray(m.deadlines) ? m.deadlines : [],
      lang: { ...s.magistr.lang, ...(m.lang || {}) },
      sop: { ...s.magistr.sop, ...(m.sop || {}) },
      docs: Array.isArray(m.docs) && m.docs.length ? m.docs : s.magistr.docs,
    };
  }
  if (o.watch?.items) s.watch = o.watch.items;
  return normalize(s);
}

// Программа из каталога, если поле пустое или осталось мусорное значение из старой версии.
function fixUnis(unis) {
  return unis.map((u) => {
    if (u.program && !u.program.startsWith('🏛')) return u;
    const c = CATALOG.find((x) => x.id === u.catalogId);
    return { ...u, program: c ? c.sub.split('·').pop().trim() : '' };
  });
}

function normalize(s) {
  const base = fresh();
  const out = { ...base, ...s };
  out.finance = { ...base.finance, ...(s.finance || {}), wallets: { ...base.finance.wallets, ...(s.finance?.wallets || {}) } };
  out.magistr = { ...base.magistr, ...(s.magistr || {}) };
  out.magistr.unis = fixUnis(Array.isArray(out.magistr.unis) ? out.magistr.unis : base.magistr.unis);
  for (const k of ['shifts', 'tasks', 'materials', 'watch']) if (!Array.isArray(out[k])) out[k] = base[k];
  for (const k of ['attendance', 'notes', 'salaryGoals']) if (!out[k] || typeof out[k] !== 'object') out[k] = {};
  out.version = 6;
  return out;
}

/** Принимает и новый бэкап, и старый (tracker-backup-*.json). */
export function parseBackup(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('Файл не похож на бэкап');
  if (obj.version === 6) return normalize(obj);
  if (Array.isArray(obj.classes) || obj.finance || obj.magistr) return fromOld(obj);
  throw new Error('Неизвестный формат бэкапа');
}

function read(k) {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function load() {
  const cur = read(KEY);
  if (cur) return { state: normalize(cur), migrated: false };
  for (const k of OLD_KEYS) {
    const old = read(k);
    if (old) return { state: fromOld(old), migrated: true };
  }
  return { state: fresh(), migrated: false };
}

let saveFailed = false;
export function persist(state) {
  state.updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    saveFailed = false;
    return true;
  } catch {
    saveFailed = true;
    return false;
  }
}
export const lastSaveFailed = () => saveFailed;

export function resetState() {
  return fresh();
}

export function downloadBackup(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `samgtu-backup-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Пары из расписания с наложенными отметками пользователя. */
export function classesWithStatus(state) {
  return CLASSES.map((c, i) => {
    const key = classKey(c);
    const a = state.attendance[key];
    return { ...c, idx: i, key, status: a ? a.status : c.status || '', reason: a ? a.reason : c.reason || '' };
  });
}

export const SUBJECTS = [...new Set(CLASSES.map((c) => c.subject))].sort((a, b) => a.localeCompare(b, 'ru'));
