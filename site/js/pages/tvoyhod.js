// «Твой ход»: контент-план постов — идеи, даты, статусы, тексты.
import { esc, todayISO, addDays, fmtLong, fmtShort, relDays, nextId, monthKey, monthLabel, DAY_SHORT, parseISO } from '../utils.js';
import { openForm, empty, pageHead, toast, segmented } from '../ui.js';

export const POST_STATUS = ['Идея', 'В работе', 'Готов', 'Опубликован'];
const PLATFORMS = ['VK', 'Telegram', 'Instagram', 'Другое'];
const ST_CLASS = { Идея: 'idea', 'В работе': 'wip', Готов: 'ready', Опубликован: 'done' };

export function postForm(ctx, p, preset = {}) {
  openForm({
    title: p ? 'Пост' : 'Новый пост',
    values: p || { status: 'Идея', platform: 'VK', time: '12:00', ...preset },
    fields: [
      { name: 'title', label: 'Тема', required: true, placeholder: 'О чём пост' },
      { name: 'date', label: 'Дата публикации', type: 'date', half: true },
      { name: 'time', label: 'Время', type: 'time', half: true },
      { name: 'status', label: 'Статус', type: 'select', options: POST_STATUS, half: true },
      { name: 'platform', label: 'Площадка', type: 'select', options: PLATFORMS, half: true },
      { name: 'text', label: 'Текст / тезисы', type: 'textarea', rows: 6 },
      { name: 'note', label: 'Заметка (фото, кого отметить)', type: 'textarea', rows: 2 },
    ],
    onSubmit(v) {
      if (p) Object.assign(p, v);
      else ctx.state.posts.push({ ...v, id: nextId(ctx.state.posts) });
      ctx.save(v.date && v.status !== 'Опубликован' ? 'Сохранено, напомню в день публикации 🔔' : 'Сохранено');
    },
    onDelete: p
      ? () => {
          ctx.state.posts = ctx.state.posts.filter((x) => x !== p);
          ctx.save('Удалено');
        }
      : null,
  });
}

function postCard(p) {
  const t = todayISO();
  const late = p.date && p.date < t && p.status !== 'Опубликован';
  return `<li class="card post st-${ST_CLASS[p.status] || 'idea'}">
    <button type="button" class="post-body" data-act="edit" data-id="${p.id}">
      <b>${esc(p.title)}</b>
      <small class="muted">${p.date ? `${fmtLong(p.date)}${p.time ? ' ' + esc(p.time) : ''} · ${relDays(p.date)}` : 'без даты'} · ${esc(p.platform || 'VK')}</small>
      ${p.text ? `<small class="post-text">${esc(p.text.slice(0, 160))}${p.text.length > 160 ? '…' : ''}</small>` : ''}
    </button>
    <div class="post-side">
      <select data-change="status" data-id="${p.id}" class="post-st st-${ST_CLASS[p.status] || 'idea'}" aria-label="Статус">${POST_STATUS.map((s) => `<option ${s === p.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
      ${late ? '<span class="badge bad">просрочен</span>' : ''}
      ${p.text ? `<button class="btn sm ghost" data-act="copy" data-id="${p.id}">Копировать текст</button>` : ''}
    </div>
  </li>`;
}

export default {
  id: 'tvoyhod',
  group: 'more',
  title: 'Твой ход',
  icon: 'megaphone',
  render(ctx, v) {
    const s = ctx.state;
    const t = todayISO();
    const view = v.view || 'plan';
    const counts = Object.fromEntries(POST_STATUS.map((x) => [x, s.posts.filter((p) => p.status === x).length]));
    // Полоса ближайших 14 дней.
    const days = [...Array(14)].map((_, i) => addDays(t, i));
    const strip = days
      .map((d) => {
        const ps = s.posts.filter((p) => p.date === d);
        return `<button type="button" class="day-pill ${d === t ? 'today' : ''} ${ps.length ? 'has' : ''}" data-act="newOn" data-d="${d}" aria-label="${fmtLong(d)}: ${ps.length} постов">
          <small>${DAY_SHORT[parseISO(d).getDay()]}</small><b>${fmtShort(d).slice(0, 2)}</b>${ps.length ? `<i>${ps.length}</i>` : '<i class="plus">+</i>'}</button>`;
      })
      .join('');

    let body;
    if (view === 'board') {
      body = `<div class="board">${POST_STATUS.map(
        (st) => `<section class="board-col"><h3>${st} <small class="muted">${counts[st]}</small></h3><ul class="cards">${s.posts
          .filter((p) => p.status === st)
          .sort((a, b) => (a.date || '9').localeCompare(b.date || '9'))
          .map(postCard)
          .join('') || '<li class="muted small">пусто</li>'}</ul></section>`
      ).join('')}</div>`;
    } else {
      const upcoming = s.posts.filter((p) => p.status !== 'Опубликован' || (p.date && p.date >= t)).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
      const past = s.posts.filter((p) => p.status === 'Опубликован' && (!p.date || p.date < t)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const byMonth = {};
      past.forEach((p) => (byMonth[p.date ? monthKey(p.date) : '—'] ||= []).push(p));
      body = `
        <section><h2 class="sec-title">В планах</h2>${upcoming.length ? `<ul class="cards">${upcoming.map(postCard).join('')}</ul>` : empty('Запланированных постов нет. Нажмите на день сверху, чтобы добавить.')}</section>
        ${Object.entries(byMonth)
          .map(([mk, ps]) => `<details class="month-block"><summary><h2 class="sec-title">${mk === '—' ? 'Без даты' : monthLabel(mk)} <small class="muted">${ps.length} опубликовано</small></h2></summary><ul class="cards">${ps.map(postCard).join('')}</ul></details>`)
          .join('')}`;
    }

    return `
      ${pageHead('Твой ход', 'Контент-план команды', '<button class="btn primary" data-act="add">+ Пост</button>')}
      <section class="stats">
        ${POST_STATUS.map((st) => `<div class="stat st-${ST_CLASS[st]}"><span>${st}</span><b>${counts[st]}</b></div>`).join('')}
      </section>
      <section class="card"><h2>Ближайшие 2 недели</h2><div class="day-strip">${strip}</div></section>
      ${segmented([['plan', 'Список'], ['board', 'Доска']], view, 'view')}
      ${body}`;
  },
  actions: {
    add: (el, ctx) => postForm(ctx),
    newOn: (el, ctx) => postForm(ctx, null, { date: el.dataset.d }),
    edit: (el, ctx) => postForm(ctx, ctx.state.posts.find((p) => p.id === Number(el.dataset.id))),
    view: (el, ctx, v) => ((v.view = el.dataset.v), ctx.rerender()),
    status(el, ctx) {
      const p = ctx.state.posts.find((x) => x.id === Number(el.dataset.id));
      p.status = el.value;
      ctx.save(p.status === 'Опубликован' ? 'Опубликован 🎉' : `Статус: ${p.status}`);
    },
    async copy(el, ctx) {
      const p = ctx.state.posts.find((x) => x.id === Number(el.dataset.id));
      try {
        await navigator.clipboard.writeText(p.text || '');
        toast('Текст скопирован');
      } catch {
        prompt('Скопируйте текст:', p.text || '');
      }
    },
  },
};
