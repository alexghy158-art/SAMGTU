// Точка входа: роутинг по #хэшу, сохранение, делегирование событий.
import { load, persist } from './store.js';
import { toast } from './ui.js';
import today from './pages/today.js';
import study from './pages/study.js';
import work from './pages/work.js';
import money from './pages/money.js';
import magistr from './pages/magistr.js';
import watch from './pages/watch.js';
import settings from './pages/settings.js';

const PAGES = [today, study, work, money, magistr, watch, settings];
const byId = Object.fromEntries(PAGES.map((p) => [p.id, p]));

const { state: initial, migrated } = load();

const ctx = {
  state: initial,
  // Состояние интерфейса (вкладки, фильтры) — не сохраняется в бэкап.
  view: {},
  save(msg) {
    const ok = persist(ctx.state);
    if (!ok) toast('Не удалось сохранить: память браузера переполнена или недоступна', 'err');
    else if (msg) toast(msg);
    ctx.rerender();
  },
  replaceState(s, msg) {
    ctx.state = s;
    ctx.save(msg);
  },
  rerender: () => render(),
  go(id) {
    location.hash = id;
  },
};

function current() {
  const id = location.hash.replace('#', '').split('/')[0];
  return byId[id] || today;
}

function renderNav(active) {
  const html = PAGES.filter((p) => !p.hidden)
    .map((p) => `<a href="#${p.id}" class="${p === active ? 'on' : ''}" ${p === active ? 'aria-current="page"' : ''}><span class="ni">${p.icon}</span><span class="nl">${p.title}</span><span class="ns">${p.short || p.title}</span></a>`)
    .join('');
  document.getElementById('nav').innerHTML = html;
}

function render() {
  const page = current();
  ctx.view[page.id] ||= {};
  renderNav(page);
  document.title = `${page.title} · Трекер`;
  const root = document.getElementById('main');
  const scroll = window.scrollY;
  root.innerHTML = page.render(ctx, ctx.view[page.id]);
  page.mount?.(root, ctx, ctx.view[page.id]);
  if (render.lastPage === page.id) window.scrollTo(0, scroll);
  else window.scrollTo(0, 0);
  render.lastPage = page.id;
}

function dispatch(kind, ev) {
  const attr = kind === 'click' ? 'act' : kind;
  const el = ev.target.closest(`[data-${attr}]`);
  if (!el || !document.getElementById('main').contains(el)) return;
  const page = current();
  const fn = page.actions?.[el.dataset[attr]];
  if (!fn) return;
  if (kind === 'click' && el.tagName === 'A' && !el.getAttribute('href')?.startsWith('http')) ev.preventDefault();
  fn(el, ctx, ctx.view[page.id], ev);
}

document.addEventListener('click', (e) => dispatch('click', e));
document.addEventListener('change', (e) => dispatch('change', e));
document.addEventListener('input', (e) => dispatch('input', e));
window.addEventListener('hashchange', render);

// Закрытие модалки кликом по фону.
document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target.id === 'modal') e.target.close();
});

// Обновляем «сейчас идёт пара» раз в минуту, если окно не занято формой.
setInterval(() => {
  if (current() === today && !document.getElementById('modal').open && !document.activeElement?.matches('input, textarea, select')) render();
}, 60000);

render();
if (migrated) {
  persist(ctx.state);
  toast('Данные из старой версии трекера перенесены');
}
