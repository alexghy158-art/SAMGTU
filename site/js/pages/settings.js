// «Данные»: бэкап, восстановление, сброс.
import { downloadBackup, parseBackup, resetState } from '../store.js';
import { esc, nextId } from '../utils.js';
import { DEFAULT_LINKS, hostOf, normalizeUrl } from '../links.js';
import { openForm, pageHead, toast } from '../ui.js';
import { getSyncInfo, enableSync, disableSync, newCode, joinLink, pull, pushState, enablePush, disablePush, testPush, pushSupported } from '../sync.js';

function syncCard() {
  const i = getSyncInfo();
  const st = { off: 'выключена', idle: 'ожидание', syncing: 'синхронизация…', ok: 'всё сохранено', error: 'ошибка', offline: 'нет интернета' }[i.status] || i.status;
  if (!i.enabled) {
    return `<section class="card sync-card">
      <h2>☁️ Синхронизация</h2>
      <p>Одни и те же данные на телефоне и компьютере. Работает по <b>секретному коду</b>: создайте его здесь, а на другом устройстве откройте ссылку с кодом или вставьте код вручную.</p>
      <div class="toolbar wrap">
        <button class="btn primary" data-act="syncNew">Включить на этом устройстве</button>
      </div>
      <form class="toolbar wrap" data-join>
        <input name="code" placeholder="Код с другого устройства" autocomplete="off" aria-label="Код синхронизации" style="flex:1;min-width:200px">
        <button class="btn" type="submit">Подключиться</button>
      </form>
      <p class="muted small">Внимание: при подключении к существующему коду данные этого устройства заменятся данными из облака.</p>
    </section>`;
  }
  return `<section class="card sync-card on">
    <h2>☁️ Синхронизация <span class="badge ${i.status === 'error' ? 'bad' : i.status === 'ok' ? 'ok' : ''}">${esc(st)}</span></h2>
    ${i.error ? `<p class="neg-text small">${esc(i.error)}</p>` : ''}
    <p class="muted small">${i.lastSync ? 'Последняя синхронизация: ' + esc(new Date(i.lastSync).toLocaleString('ru-RU')) : 'Ещё не синхронизировано'}</p>
    <p><b>Подключить другое устройство:</b> отправьте себе эту ссылку (например, в «Избранное» Telegram) и откройте её там.</p>
    <div class="code-box"><code>${esc(joinLink(i.code))}</code></div>
    <div class="toolbar wrap">
      <button class="btn primary" data-act="shareLink">Поделиться ссылкой</button>
      <button class="btn" data-act="copyLink">Скопировать</button>
      <button class="btn" data-act="syncNow">Синхронизировать сейчас</button>
      <button class="btn ghost danger" data-act="syncOff">Отключить на этом устройстве</button>
    </div>
    <p class="muted small">Ссылка = пароль: у кого она есть, тот видит и меняет ваши данные. Не публикуйте её.</p>
  </section>`;
}

function notifyCard(s) {
  const st = s.settings;
  const sel = (name, opts, val) => `<select data-change="setting" data-k="${name}">${opts.map(([v, l]) => `<option value="${v}" ${String(v) === String(val) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const chk = (name, label) => `<label class="check"><input type="checkbox" data-change="settingBool" data-k="${name}" ${st[name] !== false && st[name] ? 'checked' : ''}> ${label}</label>`;
  return `<section class="card">
    <h2>🔔 Уведомления</h2>
    <div id="push-box"><p class="muted">Проверяю…</p></div>
    <div class="notify-opts">
      ${chk('remindTodos', 'Дела — в назначенное время')}
      <div class="row">${chk('remindClasses', 'Пары — за')} ${sel('classLead', [[5, '5 мин'], [10, '10 мин'], [15, '15 мин'], [30, '30 мин']], st.classLead)}</div>
      <div class="row">${chk('remindShifts', 'Смены — за')} ${sel('shiftLead', [[30, '30 мин'], [60, '1 час'], [120, '2 часа'], [180, '3 часа']], st.shiftLead)}</div>
      ${chk('remindExams', 'Зачёты и экзамены — накануне в 19:00')}
      ${chk('remindPosts', 'Посты «Твой ход» — в день публикации')}
    </div>
    <p class="muted small">Уведомления приходят через облако, поэтому нужна включённая синхронизация. На iPhone сначала добавьте сайт на экран «Домой» (Поделиться → На экран «Домой») и откройте оттуда. Точность — до 5 минут.</p>
  </section>`;
}

async function fillPushBox() {
  const box = document.getElementById('push-box');
  if (!box) return;
  const state = await pushState().catch(() => 'unsupported');
  const msg = {
    unsupported: '<p class="muted">Этот браузер не поддерживает push. На iPhone откройте трекер с экрана «Домой».</p>',
    denied: '<p class="neg-text">Уведомления запрещены в настройках браузера — разрешите их для этого сайта.</p>',
    off: '<button class="btn primary" data-act="pushOn">Включить уведомления на этом устройстве</button>',
    on: '<p><span class="badge ok">включены</span> на этом устройстве</p><div class="toolbar wrap"><button class="btn" data-act="pushTest">Прислать тестовое через минуту</button><button class="btn ghost" data-act="pushOff">Выключить</button></div>',
  }[state];
  box.innerHTML = msg;
}

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
  group: 'more',
  title: 'Настройки',
  icon: 'gear',
  render(ctx) {
    const s = ctx.state;
    const marks = Object.values(s.attendance).filter((a) => a.status).length;
    return `
      ${pageHead('Настройки', 'Данные и синхронизация')}
      ${syncCard()}
      ${notifyCard(s)}
      <section class="card">
        <h2>Как к вам обращаться</h2>
        <div class="toolbar"><input value="${esc(s.profile.name)}" placeholder="Имя для приветствия" data-change="name" aria-label="Имя" maxlength="30"></div>
        <p class="muted small">Имя хранится в ваших данных и не попадает в публичный код сайта.</p>
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
        <h2>Бэкап</h2>
        <p>Данные хранятся в браузере${getSyncInfo().enabled ? ' и в облаке' : ''}. Файл бэкапа — запасной вариант на всякий случай.</p>
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
  mount(root, ctx) {
    fillPushBox();
    root.querySelector('[data-join]')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const raw = e.target.elements.code.value.trim();
      const code = decodeURIComponent((raw.match(/join=([^&\s]+)/) || [, raw])[1]);
      if (code.length < 20) return alert('Код слишком короткий — скопируйте его целиком.');
      if (!confirm('Данные на этом устройстве заменятся данными из облака. Продолжить?')) return;
      try {
        await enableSync(code);
        toast('Синхронизация включена ☁️');
      } catch (err) {
        alert(err.message);
      }
      ctx.rerender();
    });
  },
  actions: {
    async syncNew(el, ctx) {
      el.disabled = true;
      try {
        await enableSync(newCode(), { fresh: true });
        toast('Синхронизация включена ☁️');
      } catch (err) {
        alert('Не получилось: ' + err.message);
      }
      ctx.rerender();
    },
    async syncNow(el, ctx) {
      await pull();
      ctx.rerender();
    },
    syncOff(el, ctx) {
      if (!confirm('Отключить синхронизацию на этом устройстве? Данные останутся здесь и в облаке; чтобы снова подключиться, понадобится ссылка с кодом.')) return;
      disableSync();
      ctx.rerender();
    },
    async copyLink() {
      try {
        await navigator.clipboard.writeText(joinLink());
        toast('Ссылка скопирована');
      } catch {
        prompt('Скопируйте ссылку:', joinLink());
      }
    },
    async shareLink() {
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Трекер — подключить устройство', url: joinLink() });
        } catch {}
      } else prompt('Скопируйте ссылку:', joinLink());
    },
    async pushOn(el) {
      el.disabled = true;
      try {
        await enablePush();
        toast('Уведомления включены 🔔');
      } catch (err) {
        alert(err.message);
      }
      fillPushBox();
    },
    async pushOff() {
      await disablePush();
      toast('Уведомления выключены');
      fillPushBox();
    },
    async pushTest() {
      try {
        await testPush();
        toast('Тестовое уведомление придёт в течение ~5 минут');
      } catch (err) {
        alert(err.message);
      }
    },
    setting(el, ctx) {
      ctx.state.settings[el.dataset.k] = Number(el.value);
      ctx.save('Сохранено');
    },
    settingBool(el, ctx) {
      ctx.state.settings[el.dataset.k] = el.checked;
      ctx.save(el.checked ? 'Включено' : 'Выключено');
    },
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
