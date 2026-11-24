// Интерфейсные помощники: уведомления и универсальная форма в модальном окне.
import { esc } from './utils.js';

let toastTimer;
export function toast(msg, kind = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = 'toast'), 2200);
}

function fieldHTML(f, v) {
  const id = 'f-' + f.name;
  const val = v ?? f.default ?? '';
  const common = `id="${id}" name="${esc(f.name)}" ${f.required ? 'required' : ''} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''}`;
  let input;
  if (f.type === 'select') {
    const opts = (f.options || []).map((o) => {
      const [ov, ol] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(ov)}" ${String(ov) === String(val) ? 'selected' : ''}>${esc(ol)}</option>`;
    });
    input = `<select ${common}>${opts.join('')}</select>`;
  } else if (f.type === 'textarea') {
    input = `<textarea ${common} rows="${f.rows || 3}">${esc(val)}</textarea>`;
  } else {
    const extra = [f.min != null && `min="${f.min}"`, f.max != null && `max="${f.max}"`, f.step && `step="${f.step}"`, f.type === 'number' && 'inputmode="decimal"']
      .filter(Boolean)
      .join(' ');
    input = `<input type="${f.type || 'text'}" ${common} value="${esc(val)}" ${extra}>`;
  }
  return `<label class="field ${f.half ? 'half' : ''}"><span>${esc(f.label)}</span>${input}</label>`;
}

/**
 * Открывает модальную форму.
 * opts: { title, fields, values, onSubmit(values) → false чтобы не закрывать, preview(values) → html, onDelete }
 */
export function openForm(opts) {
  const dlg = document.getElementById('modal');
  const values = opts.values || {};
  dlg.innerHTML = `
    <form method="dialog" class="modal-body">
      <header class="modal-head"><h3>${esc(opts.title)}</h3><button type="button" class="icon-btn" data-close aria-label="Закрыть">✕</button></header>
      <div class="fields">${opts.fields.map((f) => fieldHTML(f, values[f.name])).join('')}</div>
      ${opts.preview ? '<div class="preview" id="form-preview"></div>' : ''}
      <footer class="modal-actions">
        ${opts.onDelete ? '<button type="button" class="btn danger ghost" data-delete>Удалить</button>' : ''}
        <span class="spacer"></span>
        <button type="button" class="btn ghost" data-close>Отмена</button>
        <button type="submit" class="btn primary">${esc(opts.submitLabel || 'Сохранить')}</button>
      </footer>
    </form>`;
  const form = dlg.querySelector('form');
  const read = () => {
    const out = {};
    for (const f of opts.fields) {
      const el = form.elements[f.name];
      out[f.name] = typeof el.value === 'string' ? el.value.trim() : el.value;
    }
    return out;
  };
  const upd = () => {
    if (opts.preview) form.querySelector('#form-preview').innerHTML = opts.preview(read());
  };
  upd();
  form.addEventListener('input', upd);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (opts.onSubmit(read()) !== false) dlg.close();
  });
  form.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dlg.close()));
  form.querySelector('[data-delete]')?.addEventListener('click', () => {
    if (confirm('Точно удалить?')) {
      opts.onDelete();
      dlg.close();
    }
  });
  dlg.showModal();
  const first = form.querySelector('input:not([type=hidden]), select, textarea');
  if (first && !matchMedia('(pointer: coarse)').matches) first.focus();
}

/** Модалка с произвольным HTML (например, карточка вуза). */
export function openView(title, html) {
  const dlg = document.getElementById('modal');
  dlg.innerHTML = `<div class="modal-body wide">
    <header class="modal-head"><h3>${esc(title)}</h3><button type="button" class="icon-btn" data-close aria-label="Закрыть">✕</button></header>
    <div class="view">${html}</div></div>`;
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  dlg.showModal();
  return dlg;
}

/** Сегментированный переключатель. */
export function segmented(items, active, act) {
  return `<div class="seg" role="tablist">${items
    .map(([v, l]) => `<button type="button" class="${v === active ? 'on' : ''}" data-act="${act}" data-v="${esc(v)}">${esc(l)}</button>`)
    .join('')}</div>`;
}

export function empty(text) {
  return `<p class="empty">${esc(text)}</p>`;
}

/** Вкладки-ссылки внутри группы разделов (например, Смены | Деньги). */
export function groupTabs(items, active) {
  return `<nav class="seg seg-nav" aria-label="Подразделы">${items
    .map(([id, l]) => `<a href="#${id}" class="${id === active ? 'on' : ''}" ${id === active ? 'aria-current="page"' : ''}>${esc(l)}</a>`)
    .join('')}</nav>`;
}

/** Заголовок страницы в стиле приложения. */
export function pageHead(title, eyebrow = '', actions = '') {
  return `<header class="page-head"><div>${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}<h1>${esc(title)}</h1></div>${
    actions ? `<div class="head-actions">${actions}</div>` : ''
  }</header>`;
}
