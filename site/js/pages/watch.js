// «Кино»: что посмотреть, что смотрю, оценки.
import { esc, nextId } from '../utils.js';
import { openForm, segmented, empty } from '../ui.js';

const STATUS = ['Хочу', 'Смотрю', 'Посмотрел', 'Бросил'];
const TYPES = ['Фильм', 'Сериал', 'Аниме'];

function itemForm(ctx, it) {
  openForm({
    title: it ? it.title : 'Добавить',
    values: it || { type: 'Фильм', status: 'Хочу', rating: 0 },
    fields: [
      { name: 'title', label: 'Название', required: true },
      { name: 'year', label: 'Год', half: true, placeholder: '2019' },
      { name: 'type', label: 'Тип', type: 'select', options: TYPES, half: true },
      { name: 'status', label: 'Статус', type: 'select', options: STATUS, half: true },
      { name: 'rating', label: 'Оценка 0–10', type: 'number', min: 0, max: 10, step: 1, half: true },
      { name: 'notes', label: 'Заметка', type: 'textarea', rows: 2, placeholder: 'Где смотреть, впечатление…' },
    ],
    onSubmit(v) {
      v.rating = Math.max(0, Math.min(10, parseInt(v.rating, 10) || 0));
      if (it) Object.assign(it, v);
      else ctx.state.watch.push({ ...v, id: nextId(ctx.state.watch) });
      ctx.save('Сохранено');
    },
    onDelete: it
      ? () => {
          ctx.state.watch = ctx.state.watch.filter((x) => x !== it);
          ctx.save('Удалено');
        }
      : null,
  });
}

export default {
  id: 'watch',
  group: 'more',
  title: 'Кино',
  icon: 'film',
  render(ctx, v) {
    const st = v.st || 'Хочу';
    const ty = v.ty || 'all';
    const q = (v.q || '').toLowerCase();
    const all = ctx.state.watch;
    const list = all
      .filter((x) => (st === 'all' || x.status === st) && (ty === 'all' || x.type === ty) && (!q || x.title.toLowerCase().includes(q)))
      .sort((a, b) => (b.rating || 0) - (a.rating || 0) || a.title.localeCompare(b.title, 'ru'));
    const cnt = (s) => all.filter((x) => x.status === s).length;
    return `
      <header class="page-head">
        <div><p class="eyebrow">Фильмы и сериалы</p><h1>Кино</h1></div>
        <div class="head-actions"><button class="btn" data-act="random">🎲 Что посмотреть?</button><button class="btn primary" data-act="add">+ Добавить</button></div>
      </header>
      ${segmented([...STATUS.map((s) => [s, `${s} · ${cnt(s)}`]), ['all', 'Все']], st, 'st')}
      <div class="toolbar wrap">
        ${segmented([['all', 'Всё'], ...TYPES.map((t) => [t, t])], ty, 'ty')}
        <input type="search" placeholder="Поиск" value="${esc(v.q || '')}" data-change="q" aria-label="Поиск">
      </div>
      ${
        list.length
          ? `<ul class="cards watch">${list
              .map(
                (x) => `<li class="card">
          <div class="w-main"><b>${esc(x.title)}</b><small class="muted">${esc(x.type)}${x.year ? ' · ' + esc(x.year) : ''}${x.notes ? ' · ' + esc(x.notes) : ''}</small></div>
          <div class="w-side">
            ${x.rating ? `<span class="rating">★ ${x.rating}</span>` : ''}
            <select data-change="status" data-id="${x.id}" aria-label="Статус">${STATUS.map((s) => `<option ${s === x.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
            <a class="btn sm ghost" href="https://www.kinopoisk.ru/index.php?kp_query=${encodeURIComponent(x.title + (x.year ? ' ' + x.year : ''))}" target="_blank" rel="noopener">Кинопоиск</a>
            <button class="btn sm ghost" data-act="edit" data-id="${x.id}">Изменить</button>
          </div></li>`
              )
              .join('')}</ul>`
          : empty('Пусто')
      }`;
  },
  actions: {
    st: (el, ctx, v) => ((v.st = el.dataset.v), ctx.rerender()),
    ty: (el, ctx, v) => ((v.ty = el.dataset.v), ctx.rerender()),
    q: (el, ctx, v) => ((v.q = el.value), ctx.rerender()),
    add: (el, ctx) => itemForm(ctx),
    edit: (el, ctx) => itemForm(ctx, ctx.state.watch.find((x) => x.id === Number(el.dataset.id))),
    status(el, ctx) {
      const it = ctx.state.watch.find((x) => x.id === Number(el.dataset.id));
      it.status = el.value;
      ctx.save(`«${it.title}» → ${el.value}`);
      if (el.value === 'Посмотрел' && !it.rating) itemForm(ctx, it);
    },
    random(el, ctx) {
      const pool = ctx.state.watch.filter((x) => x.status === 'Хочу');
      if (!pool.length) return alert('Список «Хочу» пуст');
      const it = pool[Math.floor(Math.random() * pool.length)];
      if (confirm(`Сегодня смотрим: «${it.title}»${it.year ? ` (${it.year})` : ''}?\n\nОК — отметить «Смотрю»`)) {
        it.status = 'Смотрю';
        ctx.save('Приятного просмотра!');
      }
    },
  },
};
