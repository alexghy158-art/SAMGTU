// Точка входа: роутинг по #хэшу, навигация, сохранение, синхронизация, делегирование событий.
import { load, persist, setPersistHook } from './store.js';
import { toast, openView } from './ui.js';
import { ICONS } from './icons.js';
import { initSync, enableSync, getSyncInfo, onSyncChange } from './sync.js';
import today from './pages/today.js';
import study from './pages/study.js';
import work, { shiftForm } from './pages/work.js';
import money, { opForm } from './pages/money.js';
import { todos, habits, diary, todoForm } from './pages/life.js';
import more from './pages/more.js';
import stats from './pages/stats.js';
import tvoyhod, { postForm } from './pages/tvoyhod.js';
import magistr from './pages/magistr.js';
import watch from './pages/watch.js';
import settings from './pages/settings.js';
import { examForm } from './pages/session.js';
import { todayISO } from './utils.js';

const PAGES = [today, study, work, money, todos, habits, diary, more, stats, tvoyhod, magistr, watch, settings];
const byId = Object.fromEntries(PAGES.map((p) => [p.id, p]));

// Нижние вкладки (телефон) и основной блок бокового меню (компьютер).
const MAIN = [
  ['today', 'today', 'Главная', 'home'],
  ['study', 'study', 'Учёба', 'study'],
  ['work', 'work', 'Работа', 'work'],
  ['life', 'life', 'Жизнь', 'life'],
  ['more', 'more', 'Ещё', 'grid'],
];
// Второстепенные разделы — в боковом меню на компьютере.
const SECONDARY = [
  ['stats', 'Статистика', 'chart'],
  ['tvoyhod', 'Твой ход', 'megaphone'],
  ['magistr', 'Магистратура', 'plane'],
  ['watch', 'Кино', 'film'],
  ['data', 'Настройки', 'gear'],
];

const { state: initial, migrated } = load();

const ctx = {
  state: initial,
  // Состояние интерфейса (вкладки, фильтры) — не сохраняется и не синхронизируется.
  view: {},
  save(msg) {
    const ok = persist(ctx.state);
    if (!ok) toast('Не удалось сохранить: память браузера переполнена или недоступна', 'err');
    else if (msg) toast(msg);
    ctx.rerender();
  },
  /** Сохранить без перерисовки (для полей, которые пользователь ещё печатает). */
  saveQuiet() {
    persist(ctx.state);
  },
  replaceState(s, msg) {
    ctx.state = s;
    ctx.save(msg);
  },
  rerender: () => render(),
};

function current() {
  const id = location.hash.replace('#', '').split(/[/=]/)[0];
  return byId[id] || today;
}

function syncDot() {
  const i = getSyncInfo();
  if (!i.enabled) return `<a href="#data" class="sync-dot off">${ICONS.cloud}<span>Синхронизация выключена</span></a>`;
  const label = { ok: 'Синхронизировано', syncing: 'Синхронизация…', error: 'Ошибка синхронизации', offline: 'Офлайн — сохраню позже', idle: 'Облако' }[i.status] || 'Облако';
  return `<a href="#data" class="sync-dot ${i.status}">${ICONS.cloud}<span>${label}</span></a>`;
}

function renderNav(active) {
  const group = active.group || active.id;
  const main = MAIN.map(
    ([id, g, title, icon]) =>
      `<a href="#${id}" class="tab ${g === 'more' ? 'only-mobile' : ''} ${group === g ? 'on' : ''}" ${group === g ? 'aria-current="page"' : ''}><span class="ni">${ICONS[icon]}</span><span class="nl">${title}</span></a>`
  ).join('');
  const sec = SECONDARY.map(
    ([id, title, icon]) => `<a href="#${id}" class="sub ${active.id === id ? 'on' : ''}" ${active.id === id ? 'aria-current="page"' : ''}><span class="ni">${ICONS[icon]}</span><span class="nl">${title}</span></a>`
  ).join('');
  document.getElementById('nav').innerHTML = `${main}<div class="nav-sep"></div>${sec}`;
  document.getElementById('sync-slot').innerHTML = syncDot();
}

function render() {
  const page = current();
  ctx.view[page.id] ||= {};
  renderNav(page);
  document.title = `${page.title} · Трекер`;
  const root = document.getElementById('main');
  const scroll = window.scrollY;
  document.body.classList.toggle('no-anim', render.lastPage === page.id);
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
window.addEventListener('hashchange', () => {
  if (handleJoin()) return;
  render();
});

// Закрытие модалки кликом по фону.
document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target.id === 'modal') e.target.close();
});

// ---------- Кнопка «+» ----------
const QUICK = [
  ['todo', '✅', 'Дело', () => todoForm(ctx, null, { due: todayISO() })],
  ['expense', '💸', 'Расход', () => opForm(ctx, { type: 'expense' })],
  ['income', '💰', 'Доход', () => opForm(ctx, { type: 'income' })],
  ['shift', '💼', 'Смена', () => shiftForm(ctx)],
  ['diary', '📔', 'Дневник', () => (location.hash = 'diary')],
  ['post', '📣', 'Пост', () => postForm(ctx)],
  ['exam', '🎓', 'Экзамен', () => examForm(ctx)],
];
document.getElementById('fab').addEventListener('click', () => {
  const dlg = openView(
    'Добавить',
    `<div class="quick-grid">${QUICK.map(([id, e, l]) => `<button type="button" class="quick-btn" data-quick="${id}"><span>${e}</span>${l}</button>`).join('')}</div>`
  );
  dlg.querySelectorAll('[data-quick]').forEach((b) =>
    b.addEventListener('click', () => {
      dlg.close();
      QUICK.find((q) => q[0] === b.dataset.quick)[3]();
    })
  );
});

// ---------- Подключение по ссылке #join=КОД ----------
function handleJoin() {
  const m = location.hash.match(/^#join=([^&]+)/);
  if (!m) return false;
  const code = decodeURIComponent(m[1]);
  history.replaceState(null, '', location.pathname + '#data');
  const sync = getSyncInfo();
  if (sync.enabled && sync.code === code) {
    toast('Это устройство уже подключено');
    render();
    return true;
  }
  if (confirm('Подключить это устройство к облаку?\n\nДанные на этом устройстве заменятся данными из облака.')) {
    enableSync(code)
      .then(() => toast('Готово! Данные загружены из облака ☁️'))
      .catch((e) => alert(e.message))
      .finally(render);
  } else render();
  return true;
}

// Обновляем «сейчас идёт пара» раз в минуту, если пользователь ничего не вводит.
setInterval(() => {
  if (current() === today && !document.getElementById('modal').open && !document.activeElement?.matches('input, textarea, select')) render();
}, 60000);

onSyncChange(() => {
  const slot = document.getElementById('sync-slot');
  if (slot) slot.innerHTML = syncDot();
});
initSync(ctx, setPersistHook);

if (!handleJoin()) render();
if (migrated) {
  persist(ctx.state);
  toast('Данные из старой версии трекера перенесены');
}

// Офлайн-режим, push и установка на главный экран телефона.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
