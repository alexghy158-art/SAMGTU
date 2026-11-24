// Общие мелкие функции: даты, деньги, экранирование.

export const DAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
export const DAY_FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
export const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

const pad = (n) => String(n).padStart(2, '0');

export function isoOf(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function todayISO() {
  return isoOf(new Date());
}
export function parseISO(iso) {
  return new Date(iso + 'T12:00:00');
}
export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return isoOf(d);
}
export function mondayOf(iso) {
  const d = parseISO(iso);
  const wd = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - wd);
  return isoOf(d);
}
export function daysBetween(fromISO, toISO) {
  return Math.round((parseISO(toISO) - parseISO(fromISO)) / 86400000);
}
export function monthKey(iso) {
  return iso.slice(0, 7);
}
export function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}
export function fmtShort(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${d}.${m}`;
}
export function fmtLong(iso) {
  if (!iso) return '';
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}
export function weekday(iso) {
  return DAY_SHORT[parseISO(iso).getDay()];
}
export function timeToMin(t) {
  const [h, m] = String(t || '0:0').split(':');
  return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
}
export function nowMin() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
export function clampDay(y, m, day) {
  return Math.min(day, new Date(y, m, 0).getDate());
}

export function rub(n) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(num(n))) + ' ₽';
}

export function nextId(list) {
  return list.reduce((mx, x) => Math.max(mx, Number(x.id) || 0), 0) + 1;
}

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

export function relDays(iso) {
  const d = daysBetween(todayISO(), iso);
  if (d === 0) return 'сегодня';
  if (d === 1) return 'завтра';
  if (d === -1) return 'вчера';
  if (d > 0) return `через ${d} ${plural(d, 'день', 'дня', 'дней')}`;
  return `${-d} ${plural(-d, 'день', 'дня', 'дней')} назад`;
}

/** Стабильный цвет для предмета: один и тот же предмет — один и тот же оттенок. */
export function subjHue(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) % 360;
  return h;
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return ['Доброй ночи', 'night'];
  if (h < 12) return ['Доброе утро', 'morning'];
  if (h < 18) return ['Добрый день', 'day'];
  return ['Добрый вечер', 'evening'];
}

export function fmtDur(min) {
  min = Math.max(0, Math.round(min));
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} мин`;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}
