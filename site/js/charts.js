// Простые графики на HTML: столбцы и горизонтальные полосы.
// Палитра: серия 1 — синий, серия 2 — оранжевый (проверенная пара для дальтоников).
// Подсказка по наведению/касанию (tabindex → :focus), значение подписано только у последнего столбца.
import { esc } from './utils.js';

/**
 * Вертикальные столбцы, одна или две серии.
 * rows: [{ label, values: [n, n?], tips: ['…', '…'] }], series: ['Название 1', 'Название 2']
 */
export function columns({ rows, series = [], fmt = (v) => String(v), height = 160, max = null, empty = 'Нет данных' }) {
  if (!rows.length || rows.every((r) => r.values.every((v) => !v))) return `<p class="muted">${esc(empty)}</p>`;
  const top = max ?? Math.max(...rows.flatMap((r) => r.values), 1);
  const n = rows[0].values.length;
  const legend =
    n > 1
      ? `<div class="legend">${series.map((s, i) => `<span><i class="sw s${i + 1}"></i>${esc(s)}</span>`).join('')}</div>`
      : '';
  const grid = [1, 0.5].map((f) => `<div class="gl" style="bottom:${f * 100}%"><span>${esc(fmt(top * f))}</span></div>`).join('');
  const cols = rows
    .map((r, ri) => {
      const bars = r.values
        .map((v, i) => {
          const h = Math.max(0, (v / top) * 100);
          const tip = r.tips?.[i] ?? `${r.label}: ${fmt(v)}`;
          return `<span class="bar-v s${i + 1}" style="height:${h}%" tabindex="0" data-tip="${esc(tip)}" aria-label="${esc(tip)}"></span>`;
        })
        .join('');
      const last = ri === rows.length - 1 && n === 1;
      return `<div class="col">${last && r.values[0] ? `<em class="col-val">${esc(fmt(r.values[0]))}</em>` : ''}<div class="col-bars">${bars}</div><span class="col-l">${esc(r.label)}</span></div>`;
    })
    .join('');
  return `${legend}<div class="chart" style="--ch:${height}px"><div class="grid-l">${grid}</div><div class="cols">${cols}</div></div>`;
}

/** Горизонтальные полосы (категории по убыванию). */
export function hbars(items, fmt = (v) => String(v)) {
  if (!items.length) return '<p class="muted">Нет данных</p>';
  const top = Math.max(...items.map((x) => x.value), 1);
  return `<ul class="hbars">${items
    .map(
      (x) => `<li tabindex="0" data-tip="${esc(x.label)}: ${esc(fmt(x.value))}"><span class="hb-l">${esc(x.label)}</span><span class="hb-t"><i style="width:${(x.value / top) * 100}%"></i></span><b>${esc(fmt(x.value))}</b></li>`
    )
    .join('')}</ul>`;
}

/** Табличное представление для доступности. */
export function dataTable(head, rows) {
  return `<details class="dt"><summary>Таблица</summary><div class="table-wrap"><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
    .join('')}</tbody></table></div></details>`;
}
