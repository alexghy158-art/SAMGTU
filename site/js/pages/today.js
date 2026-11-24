// «Главная»: живая карточка дня, сервисы, пары, дела, настроение, привычки, смена, дедлайны.
import { classesWithStatus, persist, subjStyle } from '../store.js';
import { linkTiles } from '../links.js';
import { calcPay, classConflict, shiftHours, attendanceStats, streak, budget, STATUSES } from '../logic.js';
import { esc, todayISO, addDays, fmtLong, DAY_FULL, parseISO, nowMin, timeToMin, rub, relDays, monthKey, num, fmtShort, daysBetween, plural, greeting, fmtDur } from '../utils.js';
import { shiftForm } from './work.js';
import { opForm } from './money.js';
import { todoRow, toggleTodo, todoForm, quickTodoForm, mountQuickTodo, habitChips, toggleHabit, moodPicker, setMood } from './life.js';
import { sessionSummary } from './session.js';

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
  group: 'today',
  title: 'Главная',
  icon: 'home',
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
        .map((x) => ({ date: x.deadline, title: x.what || 'Задание', sub: x.subject, href: '#study', icon: '📝' })),
      ...s.exams
        .filter((x) => x.date && x.date >= t && !x.grade && daysBetween(t, x.date) <= 14)
        .map((x) => ({ date: x.date, title: `${x.kind}: ${x.subject}`, sub: x.time ? `в ${x.time}${x.room ? ' · ' + x.room : ''}` : 'Сессия', href: '#study', icon: '🎓' })),
      ...s.posts
        .filter((x) => x.date && x.date >= t && x.status !== 'Опубликован' && daysBetween(t, x.date) <= 3)
        .map((x) => ({ date: x.date, title: x.title, sub: `Пост «Твой ход» · ${x.status}`, href: '#tvoyhod', icon: '📣' })),
      ...s.magistr.deadlines
        .filter((x) => x.date && x.date >= t && daysBetween(t, x.date) <= 30)
        .map((x) => ({ date: x.date, title: x.title, sub: `Магистратура · ${x.type || ''}`, href: '#magistr', icon: '✈️' })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    const todoToday = s.todos
      .filter((x) => !x.done && x.due && x.due <= t)
      .sort((a, b) => (a.due + (a.time || '99')).localeCompare(b.due + (b.time || '99')));
    const todoNoDate = s.todos.filter((x) => !x.done && !x.due).length;
    const ses = sessionSummary(s.exams);
    const diaryToday = s.diary[t] || {};

    const lessonsCard = `<section class="card w-lessons">
        <div class="sec-head"><h2>📚 Пары сегодня</h2><a href="#study" class="muted small">Неделя ›</a></div>
        ${
          todays.length
            ? `<ul class="lessons">${todays.map((c) => lessonRow(c, s.shifts, { live: true })).join('')}</ul>`
            : nextDay
              ? `<p class="muted">Сегодня пар нет. Следующие — ${relDays(nextDay)}, ${fmtLong(nextDay)}:</p><ul class="lessons compact">${nextList
                  .map((c) => `<li class="lesson" style="${subjStyle(c.subject)}"><div class="l-time"><b>${esc(c.start)}</b></div><div class="l-body"><div class="l-title">${esc(c.subject)}</div><div class="l-meta"><span class="tag t-${esc(c.type)}">${esc(c.type)}</span></div></div></li>`)
                  .join('')}</ul>`
              : '<p class="muted">Пар в расписании больше нет. Добавьте расписание нового семестра в <code>data/schedule.js</code>.</p>'
        }
      </section>`;

    const todoCard = `<section class="card w-todos">
        <div class="sec-head"><h2>✅ Дела на сегодня</h2><a href="#life" class="muted small">Все дела ›</a></div>
        ${todoToday.length ? `<ul class="todos">${todoToday.slice(0, 7).map(todoRow).join('')}</ul>` : '<p class="muted">На сегодня дел нет 🎉</p>'}
        ${todoToday.length > 7 ? `<p class="muted small">и ещё ${todoToday.length - 7}…</p>` : ''}
        ${todoNoDate ? `<p class="muted small">${todoNoDate} ${plural(todoNoDate, 'дело', 'дела', 'дел')} без даты</p>` : ''}
        ${quickTodoForm('Быстро добавить дело…')}
      </section>`;

    const dayCard = `<section class="card w-day">
        <div class="sec-head"><h2>Как день?</h2><a href="#diary" class="muted small">Дневник ›</a></div>
        ${moodPicker(s, t)}
        <textarea class="note" rows="2" placeholder="Пара слов о дне…" data-input="diaryText">${esc(diaryToday.text || '')}</textarea>
        <div class="sec-head" style="margin-top:14px"><h3>Привычки</h3><a href="#habits" class="muted small">Все ›</a></div>
        ${habitChips(s)}
      </section>`;

    const shiftCard = `<section class="card w-shift">
        <div class="sec-head"><h2>💼 Смена</h2><a href="#work" class="muted small">Все смены ›</a></div>
        ${
          shift
            ? `<div class="shift-mini">
                <div><b>${shift.startDate === t ? 'Сегодня' : esc(relDays(shift.startDate))}</b>, ${fmtShort(shift.startDate)} · ${esc(shift.startTime)}–${esc(shift.endTime)} <span class="tag">${esc(shift.type)}</span></div>
                <small class="muted">${shiftHours(shift).toFixed(1).replace('.0', '')} ч${shift.guests !== '' && shift.guests != null ? ` · ${esc(shift.guests)} гостей · ${rub(calcPay(shift).total)}` : ''}</small>
                <button class="btn sm" data-act="editShift" data-id="${shift.id}">Открыть</button>
              </div>`
            : '<p class="muted">Ближайших смен нет.</p>'
        }
      </section>`;

    const soonCard = `<section class="card w-soon">
        <h2>⏰ Скоро</h2>
        ${
          soon.length
            ? `<ul class="list">${soon
                .slice(0, 8)
                .map((x) => `<li><a href="${x.href}"><b>${x.icon} ${esc(x.title)}</b><small>${esc(x.sub)}</small></a><span class="badge ${x.date <= addDays(t, 2) ? 'warn' : ''}">${esc(relDays(x.date))}</span></li>`)
                .join('')}</ul>`
            : '<p class="muted">Горящих дедлайнов нет.</p>'
        }
      </section>`;

    return `
    ${hero(s, todays, nextDay, nextList, upNext)}

    <section class="services">
      <div class="sec-head"><h2>Сервисы</h2><a href="#data" class="muted small">Настроить</a></div>
      ${linkTiles(s.links)}
    </section>

    <section class="stats">
      <div class="stat"><span>Можно потратить</span><b class="${b.leftToday < 0 ? 'neg-text' : ''}">${rub(b.leftToday)}</b><small>сегодня · до ${b.nextKind === 'аванс' ? 'аванса' : 'зарплаты'} ${b.daysLeft} дн.</small></div>
      <div class="stat"><span>Заработано в ${['январе','феврале','марте','апреле','мае','июне','июле','августе','сентябре','октябре','ноябре','декабре'][new Date().getMonth()]}</span><b>${rub(earned)}</b><small>${monthShifts.length} ${plural(monthShifts.length, 'смена', 'смены', 'смен')}${goal ? ` · цель ${rub(goal)}` : ''}</small>${
        goal ? `<div class="bar"><i style="width:${Math.min(100, (earned / goal) * 100)}%"></i></div>` : ''
      }</div>
      <div class="stat"><span>Посещаемость</span><b>${st.pct == null ? '—' : st.pct + '%'}</b><small>${str ? `🔥 ${str} ${plural(str, 'день', 'дня', 'дней')} без пропусков` : `${st.was} был · ${st.miss} пропуск`}</small></div>
      <a class="stat" href="#study"><span>Сессия</span><b>${ses.next ? `${daysBetween(t, ses.next.date)} дн.` : ses.avg ? ses.avg.toFixed(2) : '—'}</b><small>${ses.next ? `до: ${esc(ses.next.subject)}` : ses.avg ? 'средний балл' : 'добавьте экзамены'}</small></a>
    </section>

    <div class="home-grid">
      <div class="stack">${lessonsCard}${todoCard}</div>
      <div class="stack">${dayCard}${shiftCard}${soonCard}</div>
    </div>`;
  },
  mount: (root, ctx) => mountQuickTodo(root, ctx),
  actions: {
    status: setStatus,
    addShift: (el, ctx) => shiftForm(ctx),
    editShift: (el, ctx) => shiftForm(ctx, ctx.state.shifts.find((x) => x.id === Number(el.dataset.id))),
    addExpense: (el, ctx) => opForm(ctx, { type: 'expense' }),
    toggleTodo: (el, ctx) => toggleTodo(ctx, el.dataset.id),
    editTodo: (el, ctx) => todoForm(ctx, ctx.state.todos.find((x) => x.id === Number(el.dataset.id))),
    habit: (el, ctx) => toggleHabit(ctx, Number(el.dataset.id)),
    mood: (el, ctx) => setMood(ctx, el.dataset.d, Number(el.dataset.v)),
    diaryText(el, ctx) {
      clearTimeout(el._t);
      el._t = setTimeout(() => {
        const t = todayISO();
        const e = ctx.state.diary[t] || { mood: 0, text: '' };
        e.text = el.value;
        if (!e.mood && !e.text) delete ctx.state.diary[t];
        else ctx.state.diary[t] = e;
        ctx.saveQuiet();
      }, 500);
    },
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
