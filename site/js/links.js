// Быстрые ссылки на сервисы: плитки на «Сегодня», редактирование в «Данных».
import { esc } from './utils.js';

export const DEFAULT_LINKS = [
  { icon: '🎓', title: 'Личный кабинет', url: 'https://lk.samgtu.ru/' },
  { icon: '📅', title: 'Расписание', url: 'https://lk.samgtu.ru/distancelearning/distancelearning/index' },
  { icon: '📒', title: 'Электронный журнал', url: 'https://lk.samgtu.ru/distancelearning/distancelearning/gradebook' },
  { icon: '📊', title: 'Успеваемость', url: 'https://lk.samgtu.ru/learning/studentprogress/view' },
  { icon: '💻', title: 'Moodle', url: 'https://lms.samgtu.ru/' },
  { icon: '✉️', title: 'Почта СамГТУ', url: 'https://mail.samgtu.ru/' },
  { icon: '📚', title: 'Библиотека', url: 'https://elib.samgtu.ru/' },
  { icon: '🗓', title: 'Google Календарь', url: 'https://calendar.google.com/' },
  { icon: '🗂', title: 'Google Диск', url: 'https://drive.google.com/' },
  { icon: '🎬', title: 'Кинопоиск', url: 'https://www.kinopoisk.ru/' },
];

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function normalizeUrl(u) {
  u = String(u || '').trim();
  if (!u) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
  try {
    const p = new URL(u);
    return p.protocol === 'http:' || p.protocol === 'https:' ? p.href : '';
  } catch {
    return '';
  }
}

export function linkTiles(links) {
  if (!links.length) return '<p class="muted">Ссылок нет. Добавьте их в разделе «Данные».</p>';
  return `<div class="tiles">${links
    .map(
      (l) => `<a class="tile" href="${esc(l.url)}" target="_blank" rel="noopener">
        <span class="tile-i" aria-hidden="true">${esc(l.icon || '🔗')}</span>
        <span class="tile-t">${esc(l.title)}</span>
        <span class="tile-h">${esc(hostOf(l.url))}</span>
      </a>`
    )
    .join('')}</div>`;
}
