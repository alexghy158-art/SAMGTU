// «Ещё»: меню второстепенных разделов.
import { esc } from '../utils.js';
import { pageHead } from '../ui.js';
import { getSyncInfo } from '../sync.js';
import { ICONS } from '../icons.js';

const ITEMS = [
  ['stats', 'chart', 'Статистика', 'Деньги, часы, посещаемость, настроение', '#2a78d6'],
  ['tvoyhod', 'megaphone', 'Твой ход', 'Контент-план постов команды', '#eb6834'],
  ['magistr', 'plane', 'Магистратура', 'Вузы, дедлайны, документы', '#1baf7a'],
  ['watch', 'film', 'Кино', 'Что посмотреть', '#e87ba4'],
  ['data', 'gear', 'Настройки и данные', 'Синхронизация, уведомления, ссылки, бэкап', '#6b7280'],
];

export default {
  id: 'more',
  group: 'more',
  title: 'Ещё',
  icon: 'grid',
  render(ctx) {
    const sync = getSyncInfo();
    return `
      ${pageHead('Ещё')}
      ${
        !sync.enabled
          ? `<a class="card promo" href="#data"><b>☁️ Включите синхронизацию</b><small>Одни и те же данные на телефоне и компьютере + push-напоминания</small></a>`
          : ''
      }
      <ul class="menu">${ITEMS.map(
        ([id, icon, title, sub, color]) => `<li><a href="#${id}" class="menu-item">
          <span class="menu-i" style="--c:${color}">${ICONS[icon] || ''}</span>
          <span><b>${esc(title)}</b><small>${esc(sub)}</small></span><span class="chev" aria-hidden="true">›</span></a></li>`
      ).join('')}</ul>`;
  },
};
