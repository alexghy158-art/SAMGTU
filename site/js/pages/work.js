// «Работа»: смены, расчёт оплаты, цель на месяц.
import { classesWithStatus } from '../store.js';
import { calcPay, shiftHours, shiftConflicts, PAY } from '../logic.js';
import { esc, todayISO, addDays, fmtShort, weekday, monthKey, monthLabel, rub, num, nextId, relDays, plural } from '../utils.js';
import { openForm, empty, groupTabs } from '../ui.js';

const TYPES = ['ПОЛЕВАЯ', 'МСК', 'Другая'];

export function shiftForm(ctx, shift, preset = {}) {
  const t = todayISO();
  openForm({
    title: shift ? 'Смена' : 'Новая смена',
    values: shift || { startDate: t, startTime: '14:00', endDate: addDays(t, 1), endTime: '03:00', type: 'ПОЛЕВАЯ', ...preset },
    fields: [
      { name: 'startDate', label: 'Начало', type: 'date', required: true, half: true },
      { name: 'startTime', label: 'Время', type: 'time', half: true },
      { name: 'endDate', label: 'Конец', type: 'date', required: true, half: true },
      { name: 'endTime', label: 'Время', type: 'time', half: true },
      { name: 'type', label: 'Точка', type: 'select', options: TYPES },
      { name: 'guests', label: `Гости (×${PAY.guest} ₽)`, type: 'number', min: 0, half: true },
      { name: 'hookah', label: `Кальяны, ₽ (×${PAY.hookah * 100}%)`, type: 'number', min: 0, half: true },
      { name: 'vr', label: `VR, ₽ (×${PAY.vr * 100}%)`, type: 'number', min: 0, half: true },
      { name: 'simracing', label: `Симрейсинг, ₽ (×${PAY.sim * 100}%)`, type: 'number', min: 0, half: true },
      { name: 'reviews', label: `Отзывы (×${PAY.review} ₽)`, type: 'number', min: 0, half: true },
    ],
    preview(v) {
      const p = calcPay(v);
      const h = shiftHours(v);
      return `<b>${rub(p.total)}</b> <span class="muted">· ${h ? h.toFixed(1).replace('.0', '') + ' ч' : ''}${h ? ' · ' + rub(p.total / h) + '/ч' : ''}</span>
        <div class="muted small">база ${rub(p.base)} + гости ${rub(p.guests)} + кальяны ${rub(p.hookah)} + VR ${rub(p.vr)} + отзывы ${rub(p.reviews)} + симрейс ${rub(p.sim)}</div>`;
    },
    onSubmit(v) {
      if (v.endDate < v.startDate) {
        alert('Конец смены раньше начала');
        return false;
      }
      if (shift) Object.assign(shift, v);
      else ctx.state.shifts.push({ ...v, id: nextId(ctx.state.shifts) });
      ctx.save('Смена сохранена');
    },
    onDelete: shift
      ? () => {
          ctx.state.shifts = ctx.state.shifts.filter((x) => x !== shift);
          ctx.save('Смена удалена');
        }
      : null,
  });
}

export default {
  id: 'work',
  group: 'work',
  title: 'Работа',
  icon: 'work',
  render(ctx, v) {
    const s = ctx.state;
    const t = todayISO();
    const months = [...new Set([monthKey(t), ...s.shifts.filter((x) => x.startDate).map((x) => monthKey(x.startDate))])].sort().reverse();
    const mk = v.month || monthKey(t);
    const list = s.shifts.filter((x) => x.startDate && monthKey(x.startDate) === mk).sort((a, b) => (b.startDate + b.startTime).localeCompare(a.startDate + a.startTime));
    const classes = classesWithStatus(s);

    const past = list.filter((x) => x.startDate <= t);
    const planned = list.length - past.length;
    const totals = past.reduce(
      (a, x) => {
        const p = calcPay(x);
        a.pay += p.total;
        a.hours += shiftHours(x);
        a.guests += num(x.guests);
        a.hookah += num(x.hookah);
        a.reviews += num(x.reviews);
        a.conf += shiftConflicts(x, classes).length;
        return a;
      },
      { pay: 0, hours: 0, guests: 0, hookah: 0, reviews: 0, conf: 0 }
    );
    const goal = num(s.salaryGoals[mk]);

    return `
      <header class="page-head">
        <div><p class="eyebrow">Смены</p><h1>Работа</h1></div>
        <div class="head-actions"><button class="btn primary" data-act="add">+ Смена</button></div>
      </header>
      ${groupTabs([['work', 'Смены'], ['money', 'Деньги']], 'work')}

      <div class="toolbar wrap">
        <select data-change="month" aria-label="Месяц">${months.map((m) => `<option value="${m}" ${m === mk ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}</select>
        <span class="muted">Быстро:</span>
        <button class="btn sm" data-act="quick" data-type="ПОЛЕВАЯ" data-s="14:00" data-e="03:00">Полевая 14–03</button>
        <button class="btn sm" data-act="quick" data-type="МСК" data-s="14:00" data-e="02:00">МСК 14–02</button>
      </div>

      <section class="stats">
        <div class="stat"><span>Заработано</span><b>${rub(totals.pay)}</b><small>${past.length} ${plural(past.length, 'смена', 'смены', 'смен')}${planned ? ` (+${planned} впереди)` : ''} · ${Math.round(totals.hours)} ч${totals.hours ? ` · ${rub(totals.pay / totals.hours)}/ч` : ''}</small>
          ${goal ? `<div class="bar"><i style="width:${Math.min(100, (totals.pay / goal) * 100)}%"></i></div>` : ''}</div>
        <div class="stat"><span>Цель на месяц</span>
          <div class="inline-input"><input type="number" min="0" step="1000" inputmode="numeric" value="${goal || ''}" placeholder="например, 60000" data-change="goal" aria-label="Цель на месяц"> ₽</div>
          <small>${goal ? (totals.pay >= goal ? 'Цель выполнена 🎉' : `осталось ${rub(goal - totals.pay)}`) : 'задайте сумму'}</small></div>
        <div class="stat"><span>Гости · кальяны</span><b>${totals.guests}</b><small>кальянов на ${rub(totals.hookah)} · отзывов ${totals.reviews}</small></div>
        <div class="stat ${totals.conf ? 'warn' : ''}"><span>Пары на сменах</span><b>${totals.conf}</b><small>${totals.conf ? `${plural(totals.conf, 'пара пропущена', 'пары пропущено', 'пар пропущено')} из-за смен` : 'пересечений нет'}</small></div>
      </section>

      ${
        list.length
          ? `<ul class="cards">${list
              .map((x) => {
                const p = calcPay(x);
                const conf = shiftConflicts(x, classes);
                const filled = x.guests !== '' && x.guests != null;
                const future = x.startDate > t;
                return `<li class="card shift ${future ? 'future' : ''}">
              <div class="shift-date"><b>${fmtShort(x.startDate)}</b><span>${weekday(x.startDate)}</span></div>
              <div class="shift-body">
                <div><span class="tag">${esc(x.type)}</span> ${esc(x.startTime)}–${esc(x.endTime)} <span class="muted">· ${shiftHours(x).toFixed(1).replace('.0', '')} ч${future ? ' · ' + relDays(x.startDate) : ''}</span></div>
                <small class="muted">${
                  filled
                    ? `${num(x.guests)} гостей · кальяны ${rub(x.hookah)}${num(x.vr) ? ` · VR ${rub(x.vr)}` : ''}${num(x.simracing) ? ` · сим ${rub(x.simracing)}` : ''}${num(x.reviews) ? ` · отзывов ${num(x.reviews)}` : ''}`
                    : future ? 'запланирована' : 'итоги не внесены'
                }${conf.length ? ` · <span class="warn-text">${future ? `пересекается с ${conf.length} ${plural(conf.length, 'парой', 'парами', 'парами')}` : `${conf.length} ${plural(conf.length, 'пара пропущена', 'пары пропущены', 'пар пропущено')}`}</span>` : ''}</small>
              </div>
              <div class="shift-pay"><b>${future ? '<span class="muted">от</span> ' : ''}${rub(p.total)}</b><button class="btn sm ghost" data-act="edit" data-id="${x.id}">${filled || future ? 'Изменить' : 'Внести итоги'}</button></div>
            </li>`;
              })
              .join('')}</ul>`
          : empty('В этом месяце смен нет')
      }
      <p class="muted small">Оплата: ${PAY.base} ₽ база + ${PAY.guest} ₽ за гостя + ${PAY.hookah * 100}% с кальянов + ${PAY.vr * 100}% с VR + ${PAY.sim * 100}% с симрейсинга + ${PAY.review} ₽ за отзыв. Ставки — в <code>js/logic.js</code>.</p>`;
  },
  actions: {
    month: (el, ctx, v) => ((v.month = el.value), ctx.rerender()),
    add: (el, ctx) => shiftForm(ctx),
    edit: (el, ctx) => shiftForm(ctx, ctx.state.shifts.find((x) => x.id === Number(el.dataset.id))),
    quick(el, ctx) {
      const t = todayISO();
      const { s, e, type } = el.dataset;
      shiftForm(ctx, null, { type, startDate: t, startTime: s, endTime: e, endDate: e < s ? addDays(t, 1) : t });
    },
    goal(el, ctx, v) {
      const mk = v.month || monthKey(todayISO());
      const n = num(el.value);
      if (n) ctx.state.salaryGoals[mk] = n;
      else delete ctx.state.salaryGoals[mk];
      ctx.save('Цель сохранена');
    },
  },
};
