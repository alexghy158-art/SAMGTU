// «Учёба»: неделя, посещаемость по предметам, задания, материалы.
import { classesWithStatus, SUBJECTS, subjStyle } from '../store.js';
import { attendanceStats, classConflict } from '../logic.js';
import { esc, todayISO, addDays, mondayOf, fmtShort, fmtLong, DAY_SHORT, parseISO, timeToMin, monthKey, monthLabel, relDays, nextId } from '../utils.js';
import { openForm, segmented, empty } from '../ui.js';
import { lessonRow, setStatus } from './today.js';

const TASK_STATUS = ['Не начато', 'В процессе', 'Сдано', 'Отменено'];
const PRIO = ['Низкий', 'Средний', 'Высокий'];
const MAT_TYPES = ['Видео', 'Документ', 'Конспект', 'Презентация', 'Ссылка', 'Другое'];

function weekView(ctx, v, classes) {
  const t = todayISO();
  const mon = addDays(mondayOf(t), (v.week || 0) * 7);
  const days = [...Array(6)].map((_, i) => addDays(mon, i));
  const cols = days
    .map((d) => {
      const list = classes.filter((c) => c.date === d).sort((a, b) => timeToMin(a.start) - timeToMin(b.start));
      return `<div class="day ${d === t ? 'today' : ''}">
        <div class="day-h"><b>${DAY_SHORT[parseISO(d).getDay()]}</b> ${fmtShort(d)}</div>
        ${
          list.length
            ? list
                .map(
                  (c) => `<div class="slot st-${c.status === 'Был' ? 'ok' : c.status === 'Отменена' ? 'off' : c.status ? 'bad' : 'none'}" style="${subjStyle(c.subject)}" title="${esc(c.teacher || '')}">
              <span class="slot-t">${esc(c.start)}–${esc(c.end)}</span>
              <span class="slot-s">${esc(c.subject)}</span>
              <span class="slot-m"><span class="tag t-${esc(c.type)}">${esc(c.type)}</span>${classConflict(c, ctx.state.shifts) ? ' <span class="badge warn">смена</span>' : ''}${c.status ? ` <span class="muted">${esc(c.status)}</span>` : ''}</span>
            </div>`
                )
                .join('')
            : '<div class="slot free">Нет пар</div>'
        }
      </div>`;
    })
    .join('');
  return `
    <div class="toolbar">
      <button class="btn" data-act="week" data-d="-1" aria-label="Предыдущая неделя">←</button>
      <button class="btn" data-act="week" data-d="0">Эта неделя</button>
      <button class="btn" data-act="week" data-d="1" aria-label="Следующая неделя">→</button>
      <span class="muted">${fmtLong(mon)} — ${fmtLong(addDays(mon, 5))}</span>
    </div>
    <div class="week">${cols}</div>`;
}

function attendanceView(ctx, v, classes) {
  const t = todayISO();
  const months = [...new Set(classes.map((c) => monthKey(c.date)))];
  const month = v.month ?? monthKey(t);
  const subj = v.subj || '';
  const stf = v.stf || '';
  let list = classes.filter((c) => c.date <= t);
  if (month) list = list.filter((c) => monthKey(c.date) === month);
  if (subj) list = list.filter((c) => c.subject === subj);
  if (stf === '__empty') list = list.filter((c) => !c.status);
  else if (stf) list = list.filter((c) => c.status === stf);
  list.sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));

  const rows = SUBJECTS.map((s) => ({ s, ...attendanceStats(classes.filter((c) => c.subject === s)) }))
    .filter((r) => r.total)
    .sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101));

  // Группируем по дням.
  const byDay = [];
  for (const c of list) {
    const last = byDay[byDay.length - 1];
    if (last && last.d === c.date) last.items.push(c);
    else byDay.push({ d: c.date, items: [c] });
  }
  byDay.forEach((g) => g.items.sort((a, b) => timeToMin(a.start) - timeToMin(b.start)));

  return `
    <section class="card">
      <h2>По предметам <small class="muted">прошедшие пары</small></h2>
      <div class="subj-table">
        ${rows
          .map(
            (r) => `<button type="button" class="subj-row ${subj === r.s ? 'on' : ''}" data-act="pickSubj" data-v="${esc(r.s)}">
          <span class="subj-name"><i class="sdot" style="${subjStyle(r.s)}"></i>${esc(r.s)}</span>
          <span class="bar ${r.pct != null && r.pct < 70 ? 'low' : ''}"><i style="width:${r.pct ?? 0}%"></i></span>
          <span class="subj-num">${r.pct == null ? '—' : r.pct + '%'}</span>
          <small class="muted">${r.was}/${r.was + r.miss}${r.unmarked ? ` · ${r.unmarked} ?` : ''}</small>
        </button>`
          )
          .join('')}
      </div>
    </section>
    <div class="toolbar wrap">
      <select data-change="month" aria-label="Месяц"><option value="">Все месяцы</option>${months.map((m) => `<option value="${m}" ${m === month ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}</select>
      <select data-change="subj" aria-label="Предмет"><option value="">Все предметы</option>${SUBJECTS.map((s) => `<option ${s === subj ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
      <select data-change="stf" aria-label="Статус">${[['', 'Любой статус'], ['__empty', 'Не отмечено'], ['Был', 'Был'], ['Не был', 'Не был'], ['Ушёл', 'Ушёл'], ['Отменена', 'Отменена']]
        .map(([val, l]) => `<option value="${val}" ${val === stf ? 'selected' : ''}>${l}</option>`)
        .join('')}</select>
      <span class="muted">${list.length} пар</span>
    </div>
    ${
      byDay.length
        ? byDay
            .map(
              (g) => `<section class="card day-card"><h3>${fmtLong(g.d)} <small class="muted">${DAY_SHORT[parseISO(g.d).getDay()]} · ${relDays(g.d)}</small></h3>
        <ul class="lessons">${g.items.map((c) => lessonRow(c, ctx.state.shifts) + `<li class="reason-row"><input placeholder="Причина / комментарий" value="${esc(c.reason)}" data-change="reason" data-key="${esc(c.key)}"></li>`).join('')}</ul></section>`
            )
            .join('')
        : empty('Ничего не найдено')
    }`;
}

function taskForm(ctx, task) {
  openForm({
    title: task ? 'Задание' : 'Новое задание',
    values: task || { subject: SUBJECTS[0], status: 'Не начато', priority: 'Средний' },
    fields: [
      { name: 'what', label: 'Что сделать', required: true, placeholder: 'Лаба №3, реферат…' },
      { name: 'subject', label: 'Предмет', type: 'select', options: SUBJECTS },
      { name: 'deadline', label: 'Дедлайн', type: 'date', half: true },
      { name: 'priority', label: 'Приоритет', type: 'select', options: PRIO, half: true },
      { name: 'status', label: 'Статус', type: 'select', options: TASK_STATUS },
    ],
    onSubmit(val) {
      if (task) Object.assign(task, val);
      else ctx.state.tasks.push({ ...val, id: nextId(ctx.state.tasks) });
      ctx.save('Задание сохранено');
    },
    onDelete: task
      ? () => {
          ctx.state.tasks = ctx.state.tasks.filter((x) => x !== task);
          ctx.save('Удалено');
        }
      : null,
  });
}

function tasksView(ctx, v) {
  const showDone = !!v.showDone;
  const prioN = { Высокий: 0, Средний: 1, Низкий: 2 };
  const list = ctx.state.tasks
    .filter((x) => showDone || (x.status !== 'Сдано' && x.status !== 'Отменено'))
    .sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999') || (prioN[a.priority] ?? 1) - (prioN[b.priority] ?? 1));
  const t = todayISO();
  return `
    <div class="toolbar">
      <button class="btn primary" data-act="addTask">+ Задание</button>
      <label class="check"><input type="checkbox" data-change="showDone" ${showDone ? 'checked' : ''}> Показать сданные</label>
    </div>
    ${
      list.length
        ? `<ul class="cards">${list
            .map(
              (x) => `<li class="card task ${x.status === 'Сдано' ? 'done' : ''}">
        <div class="task-main">
          <button type="button" class="tick ${x.status === 'Сдано' ? 'on' : ''}" data-act="toggleTask" data-id="${x.id}" aria-label="Сдано">✓</button>
          <div><b>${esc(x.what)}</b><small class="muted">${esc(x.subject)}</small></div>
        </div>
        <div class="task-meta">
          ${x.deadline ? `<span class="badge ${x.deadline < t && x.status !== 'Сдано' ? 'bad' : x.deadline <= addDays(t, 3) ? 'warn' : ''}">${fmtShort(x.deadline)} · ${relDays(x.deadline)}</span>` : ''}
          <span class="tag p-${esc(x.priority)}">${esc(x.priority)}</span>
          <span class="muted">${esc(x.status)}</span>
          <button class="btn sm ghost" data-act="editTask" data-id="${x.id}">Изменить</button>
        </div>
      </li>`
            )
            .join('')}</ul>`
        : empty(showDone ? 'Заданий нет' : 'Все задания сданы 🎉')
    }`;
}

function materialForm(ctx, m, preset = {}) {
  openForm({
    title: m ? 'Материал' : 'Новый материал',
    values: m || { subject: preset.subject || SUBJECTS[0], type: 'Ссылка' },
    fields: [
      { name: 'title', label: 'Название', placeholder: 'Лекция 5, методичка…' },
      { name: 'url', label: 'Ссылка', type: 'url', placeholder: 'https://' },
      { name: 'subject', label: 'Предмет', type: 'select', options: SUBJECTS },
      { name: 'type', label: 'Тип', type: 'select', options: MAT_TYPES, half: true },
      { name: 'topic', label: 'Тема', half: true },
      { name: 'note', label: 'Заметка', type: 'textarea', rows: 2 },
    ],
    onSubmit(val) {
      if (!val.title && !val.url) {
        alert('Укажите название или ссылку');
        return false;
      }
      if (!val.title) val.title = val.url;
      if (m) Object.assign(m, val);
      else ctx.state.materials.push({ ...val, id: nextId(ctx.state.materials) });
      ctx.save('Материал сохранён');
    },
    onDelete: m
      ? () => {
          ctx.state.materials = ctx.state.materials.filter((x) => x !== m);
          ctx.save('Удалено');
        }
      : null,
  });
}

function materialsView(ctx, v) {
  const q = (v.q || '').toLowerCase();
  const list = ctx.state.materials.filter((m) => !q || [m.title, m.topic, m.note, m.subject].join(' ').toLowerCase().includes(q));
  const groups = SUBJECTS.map((s) => ({ s, items: list.filter((m) => m.subject === s) })).filter((g) => g.items.length);
  const other = list.filter((m) => !SUBJECTS.includes(m.subject));
  if (other.length) groups.push({ s: 'Другое', items: other });
  return `
    <div class="toolbar">
      <button class="btn primary" data-act="addMat">+ Материал</button>
      <input type="search" placeholder="Поиск" value="${esc(v.q || '')}" data-change="q" aria-label="Поиск по материалам">
    </div>
    ${
      groups.length
        ? groups
            .map(
              (g) => `<section class="card"><h3>${esc(g.s)}</h3><ul class="list">${g.items
                .map(
                  (m) => `<li>
            <div><b>${m.url ? `<a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.title)}</a>` : esc(m.title)}</b>
            <small class="muted">${esc(m.type)}${m.topic ? ' · ' + esc(m.topic) : ''}${m.note ? ' · ' + esc(m.note) : ''}</small></div>
            <button class="btn sm ghost" data-act="editMat" data-id="${m.id}">Изменить</button></li>`
                )
                .join('')}</ul></section>`
            )
            .join('')
        : empty('Материалов пока нет. Сохраняйте сюда ссылки на лекции, методички и видео.')
    }`;
}

export default {
  id: 'study',
  title: 'Учёба',
  icon: '✎',
  render(ctx, v) {
    const tab = v.tab || 'week';
    const classes = classesWithStatus(ctx.state);
    const body = { week: weekView, att: attendanceView, tasks: tasksView, mat: materialsView }[tab](ctx, v, classes);
    const open = ctx.state.tasks.filter((x) => x.status !== 'Сдано' && x.status !== 'Отменено').length;
    return `
      <header class="page-head"><div><p class="eyebrow">СамГТУ · осень 2026</p><h1>Учёба</h1></div></header>
      ${segmented([['week', 'Неделя'], ['att', 'Посещаемость'], ['tasks', `Задания${open ? ` · ${open}` : ''}`], ['mat', 'Материалы']], tab, 'tab')}
      ${body}`;
  },
  actions: {
    tab: (el, ctx, v) => ((v.tab = el.dataset.v), ctx.rerender()),
    week: (el, ctx, v) => ((v.week = el.dataset.d === '0' ? 0 : (v.week || 0) + Number(el.dataset.d)), ctx.rerender()),
    month: (el, ctx, v) => ((v.month = el.value), ctx.rerender()),
    subj: (el, ctx, v) => ((v.subj = el.value), ctx.rerender()),
    stf: (el, ctx, v) => ((v.stf = el.value), ctx.rerender()),
    pickSubj: (el, ctx, v) => ((v.subj = v.subj === el.dataset.v ? '' : el.dataset.v), (v.month = ''), ctx.rerender()),
    status: setStatus,
    reason(el, ctx) {
      const cur = ctx.state.attendance[el.dataset.key] || { status: '', reason: '' };
      const classes = classesWithStatus(ctx.state);
      const c = classes.find((x) => x.key === el.dataset.key);
      ctx.state.attendance[el.dataset.key] = { status: cur.status || c?.status || '', reason: el.value };
      ctx.save('Комментарий сохранён');
    },
    addTask: (el, ctx) => taskForm(ctx),
    editTask: (el, ctx) => taskForm(ctx, ctx.state.tasks.find((x) => x.id === Number(el.dataset.id))),
    toggleTask(el, ctx) {
      const x = ctx.state.tasks.find((t) => t.id === Number(el.dataset.id));
      x.status = x.status === 'Сдано' ? 'В процессе' : 'Сдано';
      ctx.save(x.status === 'Сдано' ? 'Сдано ✓' : 'Вернул в работу');
    },
    showDone: (el, ctx, v) => ((v.showDone = el.checked), ctx.rerender()),
    addMat: (el, ctx) => materialForm(ctx),
    editMat: (el, ctx) => materialForm(ctx, ctx.state.materials.find((x) => x.id === Number(el.dataset.id))),
    q: (el, ctx, v) => ((v.q = el.value), ctx.rerender()),
  },
};
