// «Сегодня»: пары, смена, бюджет, ближайшие дедлайны, заметка дня.
import { classesWithStatus, persist, subjStyle } from '../store.js';
import { linkTiles } from '../links.js';
import { calcPay, classConflict, shiftHours, attendanceStats, streak, budget, STATUSES } from '../logic.js';
import { esc, todayISO, addDays, fmtLong, DAY_FULL, parseISO, nowMin, timeToMin, rub, relDays, monthKey, num, fmtShort, daysBetween, plural, greeting, fmtDur } from '../utils.js';
import { shiftForm } from './work.js';
import { opForm } from './money.js';

export function lessonRow(c, shifts, { live = false } = {}) {
  const now = nowMin();
  const isNow = live && timeToMin(c.start) <= now && now < timeToMin(c.end);
  const conflict = classConflict(c, shifts);
  const st = STATUSES.map(
    (s) => `<button type="button" class="chip st-${s === 'Был' ? 'ok' : s === 'Отменена' ? 'off' : 'bad'} ${c.status === s ? 'on' : ''}" data-act="status" data-key="${esc(c.key)}" data-v="${esc(s)}">${esc(s)}</button>`
  ).join('');
  return `<li class="lesson ${isNow ? 'now' : ''} ${c.status === 'Отменена' ? 'cancelled' : ''}" style="${subjStyle(c.subject)}">
    <div class="l-time"><b>${esc(c.start)}</b><span>${esc(c.end)}</span></div>
    <div class="l-body">
      <div class="l-title">${esc(c.subject)}</div>
      <div class="l-meta"><span class="tag t-${esc(c.type)}">${esc(c.type)}</span>${c.teacher ? ` ${esc(c.teacher)}` : ''}${isNow ? ' <span class="badge live">идёт</span>' : ''}${
        conflict ? ' <span class="badge warn">смена</span>' : ''
      }</div>
      ${c.reason ? `<div class="l-reason">${esc(c.reason)}</div>` : ''}
      <div class="chips">${st}</div>
    </div>
  </li>`;
}

export function setStatus(el, ctx) {
  const key = el.dataset.key;
  const v = el.dataset.v;
  const cur = classesWithStatus(ctx.state).find((c) => c.key === key) || { status: '', reason: '' };
  const status = cur.status === v ? '' : v;
  ctx.state.attendance[key] = { status, reason: cur.reason || '' };
  ctx.save(status ? `Отмечено: ${status}` : 'Отметка снята');
}

function hero(s, todays, nextDay, nextList, upNext) {
  const [hello, part] = greeting();
  const name = (s.profile?.name || '').trim();
  const now = nowMin();
  const live = todays.filter((c) => c.status !== 'Отменена');
  const cur = live.find((c) => timeToMin(c.start) <= now && now < timeToMin(c.end));
  const next = live.find((c) => timeToMin(c.start) > now);
  const done = live.filter((c) => timeToMin(c.end) <= now).length;

  let label;
  let title;
  let sub;
  let pct = null;
  if (cur) {
    const a = timeToMin(cur.start);
    const b = timeToMin(cur.end);
    label = 'Сейчас идёт';
    title = cur.subject;
    sub = `${cur.type} · до конца ${fmtDur(b - now)}${next ? ` · дальше ${next.subject} в ${next.start}` : ' · последняя на сегодня'}`;
    pct = ((now - a) / (b - a)) * 100;
  } else if (next) {
    label = `Через ${fmtDur(timeToMin(next.start) - now)}`;
    title = next.subject;
    sub = `${next.type} · ${next.start}–${next.end}${next.teacher ? ' · ' + next.teacher : ''}`;
  } else if (live.length) {
    label = 'На сегодня всё';
    title = 'Пары закончились 🎉';
    sub = upNext ? `Дальше ${relDays(upNext.date)} в ${upNext.start} · ${upNext.subject}` : 'Можно отдыхать';
  } else {
    label = 'Свободный день';
    title = nextList.length ? `Следующая пара ${relDays(nextDay)}` : 'Пар нет';
    sub = nextList.length ? `${nextList[0].start} · ${nextList[0].subject}` : 'Семестр в расписании закончился';
  }
  const dots = live
    .map((c) => {
      const st = timeToMin(c.end) <= now ? 'past' : c === cur ? 'cur' : '';
      return `<i class="${st}" style="${subjStyle(c.subject)}" title="${esc(c.start)} ${esc(c.subject)}"></i>`;
    })
    .join('');
  const d = parseISO(todayISO());
  return `<section class="hero hero-${part}">
    <div class="hero-top">
      <div>
        <p class="hero-hello">${hello}${name ? ', ' + esc(name) : ''}</p>
        <p class="hero-date">${DAY_FULL[d.getDay()]}, ${fmtLong(todayISO())}</p>
      </div>
      <div class="hero-actions">
        <button class="hbtn" data-act="addExpense" aria-label="Добавить расход">− ₽</button>
        <button class="hbtn" data-act="addShift" aria-label="Добавить смену">+ Смена</button>
      </div>
    </div>
    <div class="hero-now">
      <span class="hero-label">${esc(label)}</span>
      <b class="hero-title">${esc(title)}</b>
      <span class="hero-sub">${esc(sub)}</span>
      ${pct != null ? `<span class="hero-bar"><i style="width:${pct.toFixed(1)}%"></i></span>` : ''}
    </div>
    ${live.length ? `<div class="hero-day"><span class="dots">${dots}</span><small>${done} из ${live.length} ${plural(live.length, 'пары', 'пар', 'пар')} позади</small></div>` : ''}
  </section>`;
}

export default {
  id: 'today',
  title: 'Сегодня',
  icon: '◎',
  render(ctx) {
    const s = ctx.state;
    const t = todayISO();
    const classes = classesWithStatus(s);
    const todays = classes.filter((c) => c.date === t).sort((a, b) => timeToMin(a.start) - timeToMin(b.start));
    let nextDay = null;
    if (!todays.length) {
      const fut = classes.filter((c) => c.date > t).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
      if (fut.length) nextDay = fut[0].date;
    }
    const upNext = classes
      .filter((c) => c.date > t && c.status !== 'Отменена')
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0];
    const nextList = nextDay ? classes.filter((c) => c.date === nextDay).sort((a, b) => timeToMin(a.start) - timeToMin(b.start)) : [];

    // Смены: текущая/сегодняшняя или ближайшая.
    const upcoming = s.shifts
      .filter((x) => (x.endDate || x.startDate) >= t)
      .sort((a, b) => (a.startDate + a.startTime).localeCompare(b.startDate + b.startTime));
    const shift = upcoming[0];

    const mk = monthKey(t);
    const monthShifts = s.shifts.filter((x) => x.startDate && monthKey(x.startDate) === mk && x.startDate <= t);
    const earned = monthShifts.reduce((a, x) => a + calcPay(x).total, 0);
    const goal = num(s.salaryGoals[mk]);

    const b = budget(s.finance);
    const st = attendanceStats(classes);
    const str = streak(classes);

    const soon = [
      ...s.tasks
        .filter((x) => x.deadline && x.status !== 'Сдано' && x.status !== 'Отменено' && daysBetween(t, x.deadline) <= 7)
        .map((x) => ({ date: x.deadline, title: x.what || 'Задание', sub: x.subject, href: '#study' })),
      ...s.magistr.deadlines
        .filter((x) => x.date && x.date >= t && daysBetween(t, x.date) <= 30)
        .map((x) => ({ date: x.date, title: x.title, sub: `Магистратура · ${x.type || ''}`, href: '#magistr' })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    return `
    ${hero(s, todays, nextDay, nextList, upNext)}

    <section class="services">
      <div class="sec-head"><h2>Сервисы</h2><a href="#data" class="muted small">Настроить</a></div>
      ${linkTiles(s.links)}
    </section>

    <section class="stats">
      <div class="stat"><span>Посещаемость</span><b>${st.pct == null ? '—' : st.pct + '%'}</b><small>${st.was} был · ${st.miss} пропуск${st.unmarked ? ` · ${st.unmarked} без отметки` : ''}</small></div>
      <div class="stat"><span>Серия без пропусков</span><b>${str}</b><small>${str ? 'учебных дней подряд' : 'отмечайте пары'}</small></div>
      <div class="stat"><span>Заработано в месяце</span><b>${rub(earned)}</b><small>${monthShifts.length} ${plural(monthShifts.length, 'смена', 'смены', 'смен')}${goal ? ` · цель ${rub(goal)}` : ''}</small>${
        goal ? `<div class="bar"><i style="width:${Math.min(100, (earned / goal) * 100)}%"></i></div>` : ''
      }</div>
      <div class="stat ${b.leftToday < 0 ? 'neg' : ''}"><span>Можно потратить сегодня</span><b>${rub(b.leftToday)}</b><small>до ${b.nextKind === 'аванс' ? 'аванса' : 'зарплаты'} ${b.daysLeft} дн. · ${rub(b.dailyToday)}/день</small></div>
    </section>

    <div class="grid2">
      <section class="card">
        <h2>Пары сегодня</h2>
        ${
          todays.length
            ? `<ul class="lessons">${todays.map((c) => lessonRow(c, s.shifts, { live: true })).join('')}</ul>`
            : nextDay
              ? `<p class="muted">Сегодня пар нет. Следующие — ${relDays(nextDay)}, ${fmtLong(nextDay)}:</p><ul class="lessons compact">${nextList
                  .map((c) => `<li class="lesson" style="${subjStyle(c.subject)}"><div class="l-time"><b>${esc(c.start)}</b></div><div class="l-body"><div class="l-title">${esc(c.subject)}</div><div class="l-meta"><span class="tag t-${esc(c.type)}">${esc(c.type)}</span></div></div></li>`)
                  .join('')}</ul>`
              : '<p class="muted">Пар в расписании больше нет. Добавьте расписание нового семестра в <code>data/schedule.js</code>.</p>'
        }
      </section>

      <div class="stack">
        <section class="card">
          <h2>Смена</h2>
          ${
            shift
              ? `<div class="shift-mini">
                  <div><b>${shift.startDate === t ? 'Сегодня' : esc(relDays(shift.startDate))}</b>, ${fmtShort(shift.startDate)} · ${esc(shift.startTime)}–${esc(shift.endTime)} <span class="tag">${esc(shift.type)}</span></div>
                  <small class="muted">${shiftHours(shift).toFixed(1).replace('.0', '')} ч${shift.guests !== '' && shift.guests != null ? ` · ${esc(shift.guests)} гостей · ${rub(calcPay(shift).total)}` : ''}</small>
                  <button class="btn sm" data-act="editShift" data-id="${shift.id}">Открыть</button>
                </div>`
              : '<p class="muted">Ближайших смен нет.</p>'
          }
        </section>

        <section class="card">
          <h2>Скоро</h2>
          ${
            soon.length
              ? `<ul class="list">${soon
                  .map((x) => `<li><a href="${x.href}"><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></a><span class="badge ${x.date <= addDays(t, 2) ? 'warn' : ''}">${esc(relDays(x.date))}</span></li>`)
                  .join('')}</ul>`
              : '<p class="muted">Горящих дедлайнов нет.</p>'
          }
        </section>

        <section class="card">
          <h2>Заметка дня</h2>
          <textarea class="note" rows="3" placeholder="Что важно сегодня…" data-input="note">${esc(s.notes[t] || '')}</textarea>
        </section>
      </div>
    </div>`;
  },
  actions: {
    status: setStatus,
    addShift: (el, ctx) => shiftForm(ctx),
    editShift: (el, ctx) => shiftForm(ctx, ctx.state.shifts.find((x) => x.id === Number(el.dataset.id))),
    addExpense: (el, ctx) => opForm(ctx, { type: 'expense' }),
    note(el, ctx) {
      clearTimeout(el._t);
      el._t = setTimeout(() => {
        const t = todayISO();
        if (el.value) ctx.state.notes[t] = el.value;
        else delete ctx.state.notes[t];
        persist(ctx.state);
      }, 400);
    },
  },
};
