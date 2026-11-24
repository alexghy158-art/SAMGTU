// «Данные»: бэкап, восстановление, сброс.
import { downloadBackup, parseBackup, resetState } from '../store.js';
import { esc, nextId } from '../utils.js';
import { DEFAULT_LINKS, hostOf, normalizeUrl } from '../links.js';
import { openForm } from '../ui.js';

function linkForm(ctx, l) {
  openForm({
    title: l ? 'Ссылка' : 'Новая ссылка',
    values: l || { icon: '🔗' },
    fields: [
      { name: 'title', label: 'Название', required: true, placeholder: 'Moodle' },
      { name: 'url', label: 'Адрес', required: true, placeholder: 'lms.samgtu.ru', type: 'text' },
      { name: 'icon', label: 'Значок (эмодзи)', placeholder: '🔗' },
    ],
    onSubmit(v) {
      const url = normalizeUrl(v.url);
      if (!url) {
        alert('Не похоже на адрес сайта');
        return false;
      }
      const item = { title: v.title, url, icon: [...(v.icon || '🔗')].slice(0, 2).join('') };
      if (l) Object.assign(l, item);
      else ctx.state.links.push({ ...item, id: nextId(ctx.state.links) });
      ctx.save('Ссылка сохранена');
    },
    onDelete: l
      ? () => {
          ctx.state.links = ctx.state.links.filter((x) => x !== l);
          ctx.save('Ссылка удалена');
        }
      : null,
  });
}

export default {
  id: 'data',
  title: 'Данные',
  icon: '⚙',
  render(ctx) {
    const s = ctx.state;
    const marks = Object.values(s.attendance).filter((a) => a.status).length;
    return `
      <header class="page-head"><div><p class="eyebrow">Настройки</p><h1>Данные</h1></div></header>
      <section class="card">
        <h2>Как к вам обращаться</h2>
        <div class="toolbar"><input value="${esc(s.profile.name)}" placeholder="Имя для приветствия" data-change="name" aria-label="Имя" maxlength="30"></div>
        <p class="muted small">Имя хранится только в этом браузере.</p>
      </section>

      <section class="card">
        <h2>Сервисы на главной</h2>
        <ul class="list links-edit">${s.links
          .map(
            (l, i) => `<li><span class="le-i">${esc(l.icon || '🔗')}</span><div><b>${esc(l.title)}</b><small class="muted">${esc(hostOf(l.url))}</small></div>
          <span class="row-actions">
            <button class="icon-btn" data-act="moveLink" data-i="${i}" data-d="-1" ${i ? '' : 'disabled'} aria-label="Выше">↑</button>
            <button class="icon-btn" data-act="moveLink" data-i="${i}" data-d="1" ${i < s.links.length - 1 ? '' : 'disabled'} aria-label="Ниже">↓</button>
            <button class="btn sm ghost" data-act="editLink" data-id="${l.id}">Изменить</button>
          </span></li>`
          )
          .join('')}</ul>
        <div class="toolbar wrap" style="margin-top:12px">
          <button class="btn primary" data-act="addLink">+ Ссылка</button>
          <button class="btn ghost" data-act="resetLinks">Вернуть стандартные</button>
        </div>
      </section>
      <section class="card">
        <h2>Где хранятся данные</h2>
        <p>Всё хранится <b>только в этом браузере</b> на этом устройстве. Телефон и ноутбук не синхронизируются — переносите данные через бэкап.</p>
        <p class="muted small">Сейчас: ${marks} отметок посещаемости · ${s.shifts.length} смен · ${s.tasks.length} заданий · ${s.finance.ops.length} операций · ${s.watch.length} фильмов.${s.updatedAt ? ` Последнее изменение: ${esc(new Date(s.updatedAt).toLocaleString('ru-RU'))}.` : ''}</p>
        <div class="toolbar wrap">
          <button class="btn primary" data-act="export">⬇ Скачать бэкап</button>
          <label class="btn">⬆ Загрузить бэкап<input type="file" accept="application/json,.json" data-change="import" hidden></label>
        </div>
        <p class="muted small">Подходят и бэкапы старой версии трекера (<code>tracker-backup-*.json</code>).</p>
      </section>

      <section class="card">
        <h2>Перенос со старого сайта</h2>
        <ol class="bullets">
          <li>Откройте старый трекер на том устройстве, где отмечали пары.</li>
          <li>Нажмите там «Backup» / «Экспорт» — скачается <code>tracker-backup-….json</code>.</li>
          <li>Здесь нажмите «Загрузить бэкап» и выберите этот файл.</li>
        </ol>
        <p class="muted small">Если новый трекер открыт на том же адресе, что и старый, данные подхватились автоматически при первом запуске.</p>
      </section>

      <section class="card danger-zone">
        <h2>Сброс</h2>
        <p class="muted">Удалит все отметки, смены, операции и вернёт стартовые данные. Сначала скачайте бэкап.</p>
        <button class="btn danger" data-act="reset">Сбросить всё</button>
      </section>`;
  },
  actions: {
    name(el, ctx) {
      ctx.state.profile.name = el.value.trim().slice(0, 30);
      ctx.save('Сохранено');
    },
    addLink: (el, ctx) => linkForm(ctx),
    editLink: (el, ctx) => linkForm(ctx, ctx.state.links.find((x) => x.id === Number(el.dataset.id))),
    moveLink(el, ctx) {
      const a = ctx.state.links;
      const i = Number(el.dataset.i);
      const j = i + Number(el.dataset.d);
      if (j < 0 || j >= a.length) return;
      [a[i], a[j]] = [a[j], a[i]];
      ctx.save();
    },
    resetLinks(el, ctx) {
      if (!confirm('Заменить ваши ссылки стандартным набором?')) return;
      ctx.state.links = DEFAULT_LINKS.map((x, i) => ({ ...x, id: i + 1 }));
      ctx.save('Ссылки сброшены');
    },
    export(el, ctx) {
      downloadBackup(ctx.state);
    },
    import(el, ctx) {
      const file = el.files[0];
      if (!file) return;
      file
        .text()
        .then((txt) => {
          const next = parseBackup(JSON.parse(txt));
          if (!confirm('Заменить текущие данные содержимым бэкапа?')) return;
          ctx.replaceState(next, 'Бэкап загружен');
        })
        .catch((e) => alert('Не получилось прочитать файл: ' + e.message))
        .finally(() => (el.value = ''));
    },
    reset(el, ctx) {
      if (!confirm('Точно сбросить все данные?')) return;
      if (!confirm('Последнее предупреждение: восстановить можно только из бэкапа.')) return;
      ctx.replaceState(resetState(), 'Данные сброшены');
    },
  },
};
