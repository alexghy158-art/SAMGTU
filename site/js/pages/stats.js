// «Статистика»: деньги, работа, учёба, настроение и привычки в графиках.
import { classesWithStatus } from '../store.js';
import { calcPay, shiftHours, attendanceStats } from '../logic.js';
import { esc, todayISO, addDays, mondayOf, monthKey, MONTHS, rub, num, fmtShort, timeToMin } from '../utils.js';
import { columns, hbars, dataTable } from '../charts.js';
import { pageHead, segmented } from '../ui.js';
import { MOODS } from './life.js';

const shortMonth = (mk) => MONTHS[Number(mk.slice(5)) - 1].slice(0, 3);
const k = (n) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.0', '')}к` : String(Math.round(n)));

function lastMonths(n) {
  const out = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

export default {
  id: 'stats',
  group: 'more',
  title: 'Статистика',
  icon: 'chart',
  render(ctx, v) {
    const s = ctx.state;
    const t = todayISO();
    const range = Number(v.range || 6);
    const months = lastMonths(range);
    const pastShifts = s.shifts.filter((x) => x.startDate && x.startDate <= t);

    // Деньги и работа по месяцам
    const earnRows = months.map((mk) => {
      const sh = pastShifts.filter((x) => monthKey(x.startDate) === mk);
      const sum = sh.reduce((a, x) => a + calcPay(x).total, 0);
      return { label: shortMonth(mk), values: [sum], tips: [`${MONTHS[Number(mk.slice(5)) - 1]}: ${rub(sum)} · ${sh.length} смен`] };
    });
    const flowRows = months.map((mk) => {
      const ops = s.finance.ops.filter((o) => o.date && monthKey(o.date) === mk);
      const inc = ops.filter((o) => o.type === 'income').reduce((a, o) => a + num(o.amount), 0);
      const exp = ops.filter((o) => o.type === 'expense').reduce((a, o) => a + num(o.amount), 0);
      return { label: shortMonth(mk), values: [inc, exp], tips: [`Доходы, ${shortMonth(mk)}: ${rub(inc)}`, `Расходы, ${shortMonth(mk)}: ${rub(exp)}`] };
    });
    const cats = {};
    const mk = monthKey(t);
    s.finance.ops.filter((o) => o.type === 'expense' && o.date && monthKey(o.date) === mk).forEach((o) => {
      const c = (o.category || 'прочее').toLowerCase();
      cats[c] = (cats[c] || 0) + num(o.amount);
    });
    const catItems = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value }));

    // Учёба и работа по неделям (последние 8 недель)
    const classes = classesWithStatus(s);
    const weeks = [...Array(8)].map((_, i) => addDays(mondayOf(t), -7 * (7 - i)));
    const attRows = weeks.map((w) => {
      const st = attendanceStats(classes.filter((c) => c.date >= w && c.date <= addDays(w, 6)));
      return { label: fmtShort(w), values: [st.pct ?? 0], tips: [`Неделя с ${fmtShort(w)}: ${st.pct == null ? 'нет отметок' : st.pct + '% (' + st.was + ' из ' + (st.was + st.miss) + ')'}`] };
    });
    const hoursRows = weeks.map((w) => {
      const end = addDays(w, 6);
      const work = pastShifts.filter((x) => x.startDate >= w && x.startDate <= end).reduce((a, x) => a + shiftHours(x), 0);
      const study = classes
        .filter((c) => c.date >= w && c.date <= end && c.date <= t && c.status !== 'Отменена' && c.status !== 'Не был')
        .reduce((a, c) => a + (timeToMin(c.end) - timeToMin(c.start)) / 60, 0);
      return { label: fmtShort(w), values: [Math.round(study * 10) / 10, Math.round(work * 10) / 10], tips: [`Учёба с ${fmtShort(w)}: ${study.toFixed(1)} ч`, `Работа с ${fmtShort(w)}: ${work.toFixed(1)} ч`] };
    });

    // Настроение и привычки за 30 дней
    const days = [...Array(30)].map((_, i) => addDays(t, i - 29));
    const moodRows = days.map((d) => {
      const m = s.diary[d]?.mood || 0;
      return { label: d.slice(8), values: [m], tips: [`${fmtShort(d)}: ${m ? MOODS[m - 1][1] + ' ' + MOODS[m - 1][2] : 'нет отметки'}`] };
    });
    const habitRows = days.map((d) => {
      const n = s.habits.length ? Math.round(((s.habitLog[d] || []).filter((id) => s.habits.some((h) => h.id === id)).length / s.habits.length) * 100) : 0;
      return { label: d.slice(8), values: [n], tips: [`${fmtShort(d)}: ${n}% привычек`] };
    });

    // Итоги для плиток
    const semStart = '2026-09-01';
    const semShifts = pastShifts.filter((x) => x.startDate >= semStart);
    const semEarn = semShifts.reduce((a, x) => a + calcPay(x).total, 0);
    const semHours = semShifts.reduce((a, x) => a + shiftHours(x), 0);
    const att = attendanceStats(classes);
    const moodDays = days.filter((d) => s.diary[d]?.mood);
    const moodAvg = moodDays.length ? moodDays.reduce((a, d) => a + s.diary[d].mood, 0) / moodDays.length : 0;

    const has = (rows) => rows.some((r) => r.values.some((x) => x));
    const card = (title, sub, chart, table = '') => `<section class="card chart-card"><h2>${esc(title)}${sub ? ` <small class="muted">${esc(sub)}</small>` : ''}</h2>${chart}${table || ''}</section>`;
    return `
      ${pageHead('Статистика', 'Как идут дела')}
      ${segmented([['3', '3 месяца'], ['6', '6 месяцев'], ['12', 'Год']], String(range), 'range')}
      <section class="stats">
        <div class="stat"><span>Заработано за семестр</span><b>${rub(semEarn)}</b><small>${semShifts.length} смен · ${semShifts.length ? rub(semEarn / semShifts.length) : '—'} в среднем</small></div>
        <div class="stat"><span>Часов на сменах</span><b>${Math.round(semHours)}</b><small>${semHours ? rub(semEarn / semHours) + '/ч' : '—'}</small></div>
        <div class="stat"><span>Посещаемость</span><b>${att.pct == null ? '—' : att.pct + '%'}</b><small>${att.was} был · ${att.miss} пропуск</small></div>
        <div class="stat"><span>Настроение, 30 дней</span><b>${moodAvg ? MOODS[Math.round(moodAvg) - 1][1] + ' ' + moodAvg.toFixed(1) : '—'}</b><small>${moodDays.length} дней с отметкой</small></div>
      </section>
      <div class="grid2">
        ${card('Заработок по месяцам', 'смены', columns({ rows: earnRows, fmt: k }), has(earnRows) && dataTable(['Месяц', 'Сумма'], earnRows.map((r) => [r.label, rub(r.values[0])])))}
        ${card('Доходы и расходы', 'по операциям', columns({ rows: flowRows, series: ['Доходы', 'Расходы'], fmt: k, empty: 'Операций пока нет — добавляйте их в «Работа → Деньги»' }), has(flowRows) && dataTable(['Месяц', 'Доходы', 'Расходы'], flowRows.map((r) => [r.label, rub(r.values[0]), rub(r.values[1])])))}
        ${card('Посещаемость по неделям', '% «был» среди отмеченных', columns({ rows: attRows, fmt: (x) => Math.round(x) + '%', max: 100 }))}
        ${card('Часы: учёба и работа', 'по неделям', columns({ rows: hoursRows, series: ['Учёба', 'Работа'], fmt: (x) => Math.round(x) + ' ч' }), has(hoursRows) && dataTable(['Неделя', 'Учёба, ч', 'Работа, ч'], hoursRows.map((r) => [r.label, r.values[0], r.values[1]])))}
        ${card('Настроение', '30 дней, 1–5', columns({ rows: moodRows, fmt: (x) => String(Math.round(x)), max: 5, height: 120, empty: 'Отмечайте настроение в «Жизнь → Дневник»' }))}
        ${card('Привычки', '% выполненных за день', columns({ rows: habitRows, fmt: (x) => Math.round(x) + '%', max: 100, height: 120, empty: 'Отмечайте привычки на главной' }))}
        ${card('Расходы по категориям', MONTHS[new Date().getMonth()], hbars(catItems, rub))}
      </div>`;
  },
  actions: {
    range: (el, ctx, v) => ((v.range = el.dataset.v), ctx.rerender()),
  },
};
