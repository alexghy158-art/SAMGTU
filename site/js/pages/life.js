// «Жизнь»: дела с напоминаниями, привычки и цели, дневник настроения.
import { esc, todayISO, addDays, fmtShort, fmtLong, relDays, nextId, num, parseISO, DAY_SHORT, MONTHS, monthKey, plural, mondayOf } from '../utils.js';
import { openForm, empty, groupTabs, pageHead, toast } from '../ui.js';

export const LIFE_TABS = [
  ['life', 'Дела'],
  ['habits', 'Привычки'],
  ['diary', 'Дневник'],
];
export const LISTS = ['Личное', 'Учёба', 'Работа', 'Твой ход', 'Покупки'];
export const MOODS = [
  [1, '😞', 'Плохо'],
  [2, '😕', 'Так себе'],
  [3, '😐', 'Нормально'],
  [4, '🙂', 'Хорошо'],
  [5, '😄', 'Отлично'],
];

// ---------------- Дела ----------------

export function todoForm(ctx, t, preset = {}) {
  openForm({
    title: t ? 'Дело' : 'Новое дело',
    values: t || { list: 'Личное', remind: 'yes', ...preset },
    fields: [
      { name: 'title', label: 'Что сделать', required: true },
      { name: 'due', label: 'Дата', type: 'date', half: true },
      { name: 'time', label: 'Время', type: 'time', half: true },
      { name: 'list', label: 'Список', type: 'select', options: LISTS, half: true },
      { name: 'remind', label: 'Напомнить', type: 'select', options: [['yes', 'Да, в это время'], ['no', 'Нет']], half: true },
      { name: 'note', label: 'Заметка', type: 'textarea', rows: 2 },
    ],
    onSubmit(v) {
      const data = { ...v, remind: v.remind !== 'no' };
      if (t) Object.assign(t, data);
      else ctx.state.todos.push({ ...data, id: nextId(ctx.state.todos), done: false, createdAt: new Date().toISOString() });
      ctx.save(data.remind && data.due && data.time ? 'Сохранено, напомню 🔔' : 'Сохранено');
    },
    onDelete: t
      ? () => {
          ctx.state.todos = ctx.state.todos.filter((x) => x !== t);
          ctx.save('Удалено');
        }
      : null,
  });
}

export function toggleTodo(ctx, id) {
  const t = ctx.state.todos.find((x) => x.id === Number(id));
  if (!t) return;
  t.done = !t.done;
  t.doneAt = t.done ? new Date().toISOString() : null;
  ctx.save(t.done ? 'Готово ✓' : 'Вернул в список');
}

export function todoRow(t) {
  const today = todayISO();
  const overdue = !t.done && t.due && t.due < today;
  const when = t.due ? `${t.due === today ? 'сегодня' : t.due === addDays(today, 1) ? 'завтра' : fmtShort(t.due)}${t.time ? ' ' + t.time : ''}` : '';
  return `<li class="todo ${t.done ? 'done' : ''}">
    <button type="button" class="tick ${t.done ? 'on' : ''}" data-act="toggleTodo" data-id="${t.id}" aria-label="${t.done ? 'Вернуть' : 'Готово'}">✓</button>
    <button type="button" class="todo-body" data-act="editTodo" data-id="${t.id}">
      <span class="todo-t">${esc(t.title)}</span>
      <span class="todo-m">${when ? `<span class="${overdue ? 'neg-text' : ''}">${esc(when)}</span>` : ''}${t.remind && t.time && t.due && !t.done ? ' 🔔' : ''}<span class="tag">${esc(t.list || 'Личное')}</span></span>
    </button>
  </li>`;
}

export function quickTodoForm(placeholder = 'Новое дело… (Enter)') {
  return `<form class="quick-todo" data-quick-todo>
    <input name="title" placeholder="${esc(placeholder)}" autocomplete="off" aria-label="Новое дело" maxlength="200">
    <select name="when" aria-label="Когда"><option value="today">Сегодня</option><option value="tomorrow">Завтра</option><option value="">Без даты</option></select>
    <button class="btn primary" type="submit">Добавить</button>
  </form>`;
}

export function mountQuickTodo(root, ctx, list = 'Личное') {
  root.querySelectorAll('[data-quick-todo]').forEach((form) =>
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = form.elements.title.value.trim();
      if (!title) return;
      const w = form.elements.when.value;
      const due = w === 'today' ? todayISO() : w === 'tomorrow' ? addDays(todayISO(), 1) : '';
      ctx.state.todos.push({ id: nextId(ctx.state.todos), title, due, time: '', list, remind: true, done: false, note: '', createdAt: new Date().toISOString() });
      ctx.save('Добавлено');
      setTimeout(() => document.querySelector('[data-quick-todo] input')?.focus(), 0);
    })
  );
}

export const todos = {
  id: 'life',
  group: 'life',
  title: 'Жизнь',
  icon: 'life',
  render(ctx, v) {
    const s = ctx.state;
    const t = todayISO();
    const list = v.list || '';
    const items = s.todos.filter((x) => !list || (x.list || 'Личное') === list);
    const open = items.filter((x) => !x.done).sort((a, b) => ((a.due || '9') + (a.time || '')).localeCompare((b.due || '9') + (b.time || '')));
    const groups = [
      ['Просрочено', open.filter((x) => x.due && x.due < t)],
      ['Сегодня', open.filter((x) => x.due === t)],
      ['Завтра', open.filter((x) => x.due === addDays(t, 1))],
      ['Позже', open.filter((x) => x.due && x.due > addDays(t, 1))],
      ['Без даты', open.filter((x) => !x.due)],
    ].filter(([, a]) => a.length);
    const done = items.filter((x) => x.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || '')).slice(0, 15);
    const counts = Object.fromEntries(LISTS.map((l) => [l, s.todos.filter((x) => !x.done && (x.list || 'Личное') === l).length]));
    return `
      ${pageHead('Жизнь', 'Дела, привычки, дневник', '<button class="btn primary" data-act="addTodo">+ Дело</button>')}
      ${groupTabs(LIFE_TABS, 'life')}
      <section class="card">${quickTodoForm()}</section>
      <div class="chips filter-chips">
        <button class="chip ${!list ? 'on' : ''}" data-act="list" data-v="">Все · ${s.todos.filter((x) => !x.done).length}</button>
        ${LISTS.map((l) => `<button class="chip ${list === l ? 'on' : ''}" data-act="list" data-v="${esc(l)}">${esc(l)}${counts[l] ? ' · ' + counts[l] : ''}</button>`).join('')}
      </div>
      ${
        groups.length
          ? groups.map(([g, a]) => `<section class="card"><h2>${g} <small class="muted">${a.length}</small></h2><ul class="todos">${a.map(todoRow).join('')}</ul></section>`).join('')
          : `<section class="card">${empty('Все дела сделаны 🎉 Добавьте новое сверху.')}</section>`
      }
      ${done.length ? `<details class="card done-block"><summary><h2>Выполнено <small class="muted">${done.length}</small></h2></summary><ul class="todos">${done.map(todoRow).join('')}</ul></details>` : ''}
      <p class="muted small">🔔 Напоминание придёт push-уведомлением, если у дела есть дата и время, а в «Данных» включены уведомления.</p>`;
  },
  mount: (root, ctx, v) => mountQuickTodo(root, ctx, v.list || 'Личное'),
  actions: {
    addTodo: (el, ctx, v) => todoForm(ctx, null, { list: v.list || 'Личное', due: todayISO() }),
    editTodo: (el, ctx) => todoForm(ctx, ctx.state.todos.find((x) => x.id === Number(el.dataset.id))),
    toggleTodo: (el, ctx) => toggleTodo(ctx, el.dataset.id),
    list: (el, ctx, v) => ((v.list = el.dataset.v), ctx.rerender()),
  },
};

// ---------------- Привычки и цели ----------------

export function habitDone(s, id, date = todayISO()) {
  return (s.habitLog[date] || []).includes(id);
}

export function toggleHabit(ctx, id, date = todayISO()) {
  const s = ctx.state;
  const arr = new Set(s.habitLog[date] || []);
  if (arr.has(id)) arr.delete(id);
  else arr.add(id);
  if (arr.size) s.habitLog[date] = [...arr];
  else delete s.habitLog[date];
  ctx.save(arr.has(id) ? 'Отмечено 💪' : 'Отметка снята');
}

export function habitStreak(s, id) {
  let n = 0;
  let d = todayISO();
  if (!habitDone(s, id, d)) d = addDays(d, -1); // сегодня ещё можно успеть
  while (habitDone(s, id, d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

function habitForm(ctx, h) {
  openForm({
    title: h ? 'Привычка' : 'Новая привычка',
    values: h || { icon: '⭐' },
    fields: [
      { name: 'title', label: 'Название', required: true, placeholder: 'Отжимания, медитация…' },
      { name: 'icon', label: 'Значок (эмодзи)', placeholder: '⭐' },
    ],
    onSubmit(v) {
      v.icon = [...(v.icon || '⭐')].slice(0, 2).join('');
      if (h) Object.assign(h, v);
      else ctx.state.habits.push({ ...v, id: nextId(ctx.state.habits) });
      ctx.save('Сохранено');
    },
    onDelete: h
      ? () => {
          ctx.state.habits = ctx.state.habits.filter((x) => x !== h);
          ctx.save('Удалено');
        }
      : null,
  });
}

function goalForm(ctx, g) {
  openForm({
    title: g ? 'Цель' : 'Новая цель',
    values: g || { current: 0, unit: '' },
    fields: [
      { name: 'title', label: 'Цель', required: true, placeholder: 'Накопить на ноутбук, прочитать 10 книг…' },
      { name: 'target', label: 'Сколько нужно', type: 'number', min: 0, step: 'any', required: true, half: true },
      { name: 'current', label: 'Уже есть', type: 'number', min: 0, step: 'any', half: true },
      { name: 'unit', label: 'Единица', placeholder: '₽, книг, км', half: true },
      { name: 'deadline', label: 'К какому сроку', type: 'date', half: true },
    ],
    onSubmit(v) {
      v.target = num(v.target);
      v.current = num(v.current);
      if (!(v.target > 0)) {
        alert('Укажите, сколько нужно');
        return false;
      }
      if (g) Object.assign(g, v);
      else ctx.state.goals.push({ ...v, id: nextId(ctx.state.goals) });
      ctx.save('Цель сохранена');
    },
    onDelete: g
      ? () => {
          ctx.state.goals = ctx.state.goals.filter((x) => x !== g);
          ctx.save('Удалено');
        }
      : null,
  });
}

export function habitChips(s) {
  if (!s.habits.length) return '<p class="muted">Привычек нет. Добавьте в разделе «Жизнь → Привычки».</p>';
  return `<div class="habit-chips">${s.habits
    .map((h) => {
      const on = habitDone(s, h.id);
      return `<button type="button" class="habit-chip ${on ? 'on' : ''}" data-act="habit" data-id="${h.id}" aria-pressed="${on}"><span>${esc(h.icon || '⭐')}</span>${esc(h.title)}</button>`;
    })
    .join('')}</div>`;
}

export const habits = {
  id: 'habits',
  group: 'life',
  title: 'Привычки',
  icon: 'life',
  render(ctx) {
    const s = ctx.state;
    const t = todayISO();
    const days = [...Array(7)].map((_, i) => addDays(t, i - 6));
    const doneToday = s.habits.filter((h) => habitDone(s, h.id)).length;
    // Тепловая карта: 12 недель, доля выполненных привычек за день.
    const start = addDays(mondayOf(t), -77);
    const cells = [];
    for (let d = start; d <= t; d = addDays(d, 1)) {
      const k = s.habits.length ? (s.habitLog[d] || []).filter((id) => s.habits.some((h) => h.id === id)).length / s.habits.length : 0;
      cells.push(`<i class="hm l${Math.ceil(k * 4)}" tabindex="0" data-tip="${fmtShort(d)}: ${Math.round(k * 100)}%"></i>`);
    }
    return `
      ${pageHead('Жизнь', 'Дела, привычки, дневник', '<button class="btn primary" data-act="addHabit">+ Привычка</button>')}
      ${groupTabs(LIFE_TABS, 'habits')}
      <section class="card">
        <h2>Сегодня <small class="muted">${doneToday} из ${s.habits.length}</small></h2>
        ${habitChips(s)}
      </section>
      <section class="card">
        <h2>Неделя</h2>
        ${
          s.habits.length
            ? `<div class="table-wrap"><table class="habit-table"><thead><tr><th></th>${days.map((d) => `<th class="${d === t ? 'today' : ''}">${DAY_SHORT[parseISO(d).getDay()]}<br><small>${fmtShort(d).slice(0, 2)}</small></th>`).join('')}<th>Серия</th></tr></thead><tbody>
          ${s.habits
            .map(
              (h) => `<tr><td><button class="link-btn" data-act="editHabit" data-id="${h.id}">${esc(h.icon || '⭐')} ${esc(h.title)}</button></td>${days
                .map((d) => `<td><button class="hcell ${habitDone(s, h.id, d) ? 'on' : ''}" data-act="habitDay" data-id="${h.id}" data-d="${d}" aria-label="${esc(h.title)} ${fmtShort(d)}"></button></td>`)
                .join('')}<td><b>${habitStreak(s, h.id)}</b> 🔥</td></tr>`
            )
            .join('')}</tbody></table></div>`
            : empty('Добавьте первую привычку')
        }
      </section>
      <section class="card">
        <h2>12 недель</h2>
        <div class="heatmap">${cells.join('')}</div>
        <div class="legend small muted">меньше <i class="hm l0"></i><i class="hm l1"></i><i class="hm l2"></i><i class="hm l3"></i><i class="hm l4"></i> больше</div>
      </section>
      <section class="card">
        <div class="sec-head"><h2>Цели</h2><button class="btn sm" data-act="addGoal">+ Цель</button></div>
        ${
          s.goals.length
            ? `<ul class="goals">${s.goals
                .map((g) => {
                  const p = Math.min(100, (num(g.current) / Math.max(num(g.target), 1e-9)) * 100);
                  return `<li>
              <div class="goal-top"><button class="link-btn" data-act="editGoal" data-id="${g.id}"><b>${esc(g.title)}</b></button><span class="muted">${esc(num(g.current).toLocaleString('ru-RU'))} / ${esc(num(g.target).toLocaleString('ru-RU'))} ${esc(g.unit || '')}</span></div>
              <div class="bar ${p >= 100 ? 'full' : ''}"><i style="width:${p}%"></i></div>
              <div class="goal-bot"><small class="muted">${p >= 100 ? 'Достигнута 🎉' : Math.round(p) + '%'}${g.deadline ? ' · до ' + fmtLong(g.deadline) + ` (${relDays(g.deadline)})` : ''}</small>
              <span class="row-actions"><button class="btn sm" data-act="goalStep" data-id="${g.id}" data-d="-1" aria-label="Уменьшить">−</button><button class="btn sm" data-act="goalStep" data-id="${g.id}" data-d="1" aria-label="Увеличить">+</button></span></div>
            </li>`;
                })
                .join('')}</ul>`
            : '<p class="muted">Поставьте цель: накопить сумму, прочитать книги, пробежать километры.</p>'
        }
      </section>`;
  },
  actions: {
    habit: (el, ctx) => toggleHabit(ctx, Number(el.dataset.id)),
    habitDay: (el, ctx) => toggleHabit(ctx, Number(el.dataset.id), el.dataset.d),
    addHabit: (el, ctx) => habitForm(ctx),
    editHabit: (el, ctx) => habitForm(ctx, ctx.state.habits.find((h) => h.id === Number(el.dataset.id))),
    addGoal: (el, ctx) => goalForm(ctx),
    editGoal: (el, ctx) => goalForm(ctx, ctx.state.goals.find((g) => g.id === Number(el.dataset.id))),
    goalStep(el, ctx) {
      const g = ctx.state.goals.find((x) => x.id === Number(el.dataset.id));
      const step = Number(prompt(`Сколько ${el.dataset.d === '1' ? 'добавить' : 'убрать'}${g.unit ? ', ' + g.unit : ''}?`, '1'));
      if (!step) return;
      g.current = Math.max(0, num(g.current) + step * Number(el.dataset.d));
      ctx.save(num(g.current) >= num(g.target) ? 'Цель достигнута! 🎉' : 'Прогресс обновлён');
    },
  },
};

// ---------------- Дневник ----------------

export function moodPicker(s, date = todayISO()) {
  const cur = s.diary[date]?.mood || 0;
  return `<div class="moods" role="radiogroup" aria-label="Настроение">${MOODS.map(
    ([v, e, l]) => `<button type="button" class="mood ${cur === v ? 'on' : ''}" data-act="mood" data-v="${v}" data-d="${date}" role="radio" aria-checked="${cur === v}" title="${l}"><span>${e}</span><small>${l}</small></button>`
  ).join('')}</div>`;
}

export function setMood(ctx, date, v) {
  const d = ctx.state.diary[date] || { mood: 0, text: '' };
  d.mood = d.mood === v ? 0 : v;
  if (!d.mood && !d.text) delete ctx.state.diary[date];
  else ctx.state.diary[date] = d;
  ctx.save(d.mood ? MOODS[d.mood - 1][2] : 'Снято');
}

export const diary = {
  id: 'diary',
  group: 'life',
  title: 'Дневник',
  icon: 'life',
  render(ctx, v) {
    const s = ctx.state;
    const date = v.date || todayISO();
    const entry = s.diary[date] || { mood: 0, text: '' };
    const mk = v.month || monthKey(todayISO());
    const [y, m] = mk.split('-').map(Number);
    const first = `${mk}-01`;
    const lead = (parseISO(first).getDay() + 6) % 7;
    const dim = new Date(y, m, 0).getDate();
    const cells = [...Array(lead)].map(() => '<span></span>');
    for (let i = 1; i <= dim; i++) {
      const d = `${mk}-${String(i).padStart(2, '0')}`;
      const e = s.diary[d];
      cells.push(
        `<button type="button" class="cal-d ${d === date ? 'sel' : ''} ${d === todayISO() ? 'today' : ''} ${e?.mood ? 'm' + e.mood : ''}" data-act="pick" data-d="${d}" ${d > todayISO() ? 'disabled' : ''} aria-label="${fmtLong(d)}${e?.mood ? ', ' + MOODS[e.mood - 1][2] : ''}"><span>${i}</span>${e?.mood ? `<em>${MOODS[e.mood - 1][1]}</em>` : e?.text ? '<em>·</em>' : ''}</button>`
      );
    }
    const moodsMonth = Object.entries(s.diary).filter(([d, e]) => d.startsWith(mk) && e.mood);
    const avg = moodsMonth.length ? moodsMonth.reduce((a, [, e]) => a + e.mood, 0) / moodsMonth.length : 0;
    const recent = Object.entries(s.diary)
      .filter(([, e]) => e.text)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 8);
    const prev = monthKey(addDays(first, -1));
    const next = monthKey(addDays(first, 32));
    return `
      ${pageHead('Жизнь', 'Дела, привычки, дневник')}
      ${groupTabs(LIFE_TABS, 'diary')}
      <div class="grid2">
        <section class="card">
          <h2>${date === todayISO() ? 'Сегодня' : fmtLong(date)} <small class="muted">${relDays(date)}</small></h2>
          ${moodPicker(s, date)}
          <textarea class="note diary-text" rows="6" placeholder="Что было хорошего? Что беспокоит? Что понял за день?" data-input="text" data-d="${date}">${esc(entry.text || '')}</textarea>
          <p class="muted small">Сохраняется автоматически.</p>
        </section>
        <section class="card">
          <div class="sec-head"><h2>${MONTHS[m - 1]} ${y}</h2>
            <span class="row-actions"><button class="icon-btn" data-act="month" data-v="${prev}" aria-label="Предыдущий месяц">←</button><button class="icon-btn" data-act="month" data-v="${next}" ${next > monthKey(todayISO()) ? 'disabled' : ''} aria-label="Следующий месяц">→</button></span></div>
          <div class="cal"><b>Пн</b><b>Вт</b><b>Ср</b><b>Чт</b><b>Пт</b><b>Сб</b><b>Вс</b>${cells.join('')}</div>
          <p class="muted small">${moodsMonth.length ? `Среднее настроение: ${MOODS[Math.round(avg) - 1][1]} ${avg.toFixed(1)} · ${moodsMonth.length} ${plural(moodsMonth.length, 'день', 'дня', 'дней')} с отметкой` : 'В этом месяце отметок нет'}</p>
        </section>
      </div>
      ${
        recent.length
          ? `<section class="card"><h2>Последние записи</h2><ul class="list diary-list">${recent
              .map(([d, e]) => `<li><button class="link-btn" data-act="pick" data-d="${d}"><b>${e.mood ? MOODS[e.mood - 1][1] + ' ' : ''}${fmtLong(d)}</b><small class="muted">${esc(e.text.slice(0, 140))}${e.text.length > 140 ? '…' : ''}</small></button></li>`)
              .join('')}</ul></section>`
          : ''
      }`;
  },
  actions: {
    mood: (el, ctx) => setMood(ctx, el.dataset.d, Number(el.dataset.v)),
    pick: (el, ctx, v) => ((v.date = el.dataset.d), (v.month = monthKey(el.dataset.d)), ctx.rerender(), window.scrollTo({ top: 0, behavior: 'smooth' })),
    month: (el, ctx, v) => ((v.month = el.dataset.v), ctx.rerender()),
    text(el, ctx) {
      clearTimeout(el._t);
      el._t = setTimeout(() => {
        const d = el.dataset.d;
        const e = ctx.state.diary[d] || { mood: 0, text: '' };
        e.text = el.value;
        if (!e.mood && !e.text) delete ctx.state.diary[d];
        else ctx.state.diary[d] = e;
        ctx.saveQuiet();
      }, 500);
    },
  },
};

export { toast };
