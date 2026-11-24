// «Данные»: бэкап, восстановление, сброс.
import { downloadBackup, parseBackup, resetState } from '../store.js';
import { esc } from '../utils.js';

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
