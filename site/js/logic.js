// Бизнес-логика: зарплата за смену, пересечения смен с парами, дневной бюджет.
import { num, todayISO, addDays, daysBetween, clampDay, isoOf, timeToMin } from './utils.js';

// Ставка за смену (как в старом трекере).
export const PAY = { base: 2000, guest: 3, hookah: 0.15, vr: 0.7, review: 250, sim: 0.3 };

export function calcPay(s) {
  const parts = {
    base: PAY.base,
    guests: num(s.guests) * PAY.guest,
    hookah: num(s.hookah) * PAY.hookah,
    vr: num(s.vr) * PAY.vr,
    reviews: num(s.reviews) * PAY.review,
    sim: num(s.simracing) * PAY.sim,
  };
  parts.total = Object.values(parts).reduce((a, b) => a + b, 0);
  return parts;
}

function dt(date, time) {
  if (!date) return null;
  const d = new Date(date + 'T00:00:00');
  const m = timeToMin(time);
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
}

export function shiftRange(s) {
  const a = dt(s.startDate, s.startTime);
  let b = dt(s.endDate || s.startDate, s.endTime);
  if (!a || !b) return null;
  if (b <= a) b = new Date(b.getTime() + 86400000);
  return [a, b];
}

export function shiftHours(s) {
  const r = shiftRange(s);
  return r ? (r[1] - r[0]) / 3600000 : 0;
}

export function shiftConflicts(shift, classes) {
  const r = shiftRange(shift);
  if (!r) return [];
  return classes.filter((c) => {
    if (c.date < shift.startDate || c.date > (shift.endDate || shift.startDate)) return false;
    const cs = dt(c.date, c.start);
    const ce = dt(c.date, c.end);
    return r[0] < ce && r[1] > cs;
  });
}

export function classConflict(cls, shifts) {
  const cs = dt(cls.date, cls.start);
  const ce = dt(cls.date, cls.end);
  return shifts.find((s) => {
    const r = shiftRange(s);
    return r && r[0] < ce && r[1] > cs;
  });
}

// --- Посещаемость ---
export const STATUSES = ['Был', 'Не был', 'Ушёл', 'Отменена'];

export function attendanceStats(classes) {
  const t = todayISO();
  const past = classes.filter((c) => c.date <= t && c.status !== 'Отменена');
  const was = past.filter((c) => c.status === 'Был').length;
  const miss = past.filter((c) => c.status === 'Не был' || c.status === 'Ушёл').length;
  const marked = was + miss;
  const unmarked = past.filter((c) => !c.status).length;
  return { total: past.length, was, miss, unmarked, pct: marked ? Math.round((was / marked) * 100) : null };
}

export function streak(classes) {
  const byDate = {};
  for (const c of classes) {
    if (!c.status || c.status === 'Отменена') continue;
    const b = (byDate[c.date] ||= { was: 0, miss: 0 });
    if (c.status === 'Был') b.was++;
    else b.miss++;
  }
  let n = 0;
  let d = addDays(todayISO(), -1);
  for (let i = 0; i < 90; i++, d = addDays(d, -1)) {
    const b = byDate[d];
    if (!b) continue;
    if (b.miss) break;
    n++;
  }
  return n;
}

// --- Деньги ---
export const WALLETS = [
  ['card', 'Карты'],
  ['cash', 'Наличные'],
  ['change', 'Размен'],
  ['coins', 'Мелочь'],
];
export const walletName = (k) => (WALLETS.find((w) => w[0] === k) || [k, k])[1];

export function walletTotal(f) {
  return WALLETS.reduce((s, [k]) => s + num(f.wallets[k]), 0);
}
/** Мелочь лежит дома и в дневной лимит не входит. */
export function spendable(f) {
  return num(f.wallets.card) + num(f.wallets.cash) + num(f.wallets.change);
}

function nextDateForDay(day) {
  const now = new Date();
  const today = todayISO();
  let y = now.getFullYear();
  let m = now.getMonth() + 1;
  let d = isoOf(new Date(y, m - 1, clampDay(y, m, day)));
  if (d < today) {
    m++;
    if (m > 12) { m = 1; y++; }
    d = isoOf(new Date(y, m - 1, clampDay(y, m, day)));
  }
  return d;
}

export function budget(f) {
  const today = todayISO();
  const nextAdv = nextDateForDay(Number(f.advanceDay) || 25);
  const nextSal = nextDateForDay(Number(f.salaryDay) || 10);
  const advFirst = nextAdv <= nextSal;
  const nextPay = advFirst ? nextAdv : nextSal;
  const nextKind = advFirst ? 'аванс' : 'зарплата';
  const daysLeft = Math.max(1, daysBetween(today, nextPay));

  // Тратим из того, что лежит на картах/наличке/размене прямо сейчас.
  const pool = spendable(f);
  const daily = Math.floor(pool / daysLeft);

  const todaySpent = f.ops
    .filter((o) => o.type === 'expense' && o.date === today && o.wallet !== 'coins')
    .reduce((s, o) => s + num(o.amount), 0);
  // Лимит на сегодня считаем от остатка на начало дня.
  const dailyToday = Math.floor((pool + todaySpent) / daysLeft);
  return { nextPay, nextKind, daysLeft, pool, daily, todaySpent, leftToday: dailyToday - todaySpent, dailyToday, nextAdv, nextSal };
}
