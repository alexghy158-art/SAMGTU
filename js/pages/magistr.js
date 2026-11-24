// «Магистратура»: мои вузы, каталог программ, дедлайны, документы, гайды.
import { CATALOG, GUIDES } from '../../data/catalog.js';
import { esc, todayISO, fmtLong, relDays, nextId, daysBetween } from '../utils.js';
import { openForm, openView, segmented, empty } from '../ui.js';

const STATUS = ['Интерес', 'Готовлю документы', 'Подал', 'Интервью', 'Оффер', 'Отказ'];
const DL_TYPES = ['Подача', 'Экзамен', 'Документ', 'Другое'];
const GUIDE_TITLES = { money: '💶 Деньги и стипендии', visa: '🛂 Виза', lang: '🗣 Язык', video: '🎬 Где смотреть обзоры' };

function uniForm(ctx, u, preset = {}) {
  const m = ctx.state.magistr;
  openForm({
    title: u ? u.name : 'Новый вуз',
    values: u || { status: 'Интерес', ...preset },
    fields: [
      { name: 'name', label: 'Университет', required: true },
      { name: 'program', label: 'Программа' },
      { name: 'country', label: 'Страна', half: true },
      { name: 'status', label: 'Статус', type: 'select', options: STATUS, half: true },
      { name: 'deadline', label: 'Дедлайн подачи', type: 'date', half: true },
      { name: 'url', label: 'Сайт', type: 'url', half: true, placeholder: 'https://' },
      { name: 'notes', label: 'Заметки', type: 'textarea' },
    ],
    onSubmit(v) {
      if (u) Object.assign(u, v);
      else m.unis.push({ ...v, catalogId: preset.catalogId, id: nextId(m.unis) });
      ctx.save('Сохранено');
    },
    onDelete: u
      ? () => {
          m.unis = m.unis.filter((x) => x !== u);
          ctx.save('Удалено');
        }
      : null,
  });
}

function dlForm(ctx, d) {
  const m = ctx.state.magistr;
  openForm({
    title: 'Дедлайн',
    values: d || { type: 'Подача' },
    fields: [
      { name: 'title', label: 'Что', required: true, placeholder: 'Подача в TU Delft' },
      { name: 'date', label: 'Дата', type: 'date', required: true, half: true },
      { name: 'type', label: 'Тип', type: 'select', options: DL_TYPES, half: true },
    ],
    onSubmit(v) {
      if (d) Object.assign(d, v);
      else m.deadlines.push({ ...v, id: nextId(m.deadlines) });
      ctx.save('Дедлайн сохранён');
    },
    onDelete: d
      ? () => {
          m.deadlines = m.deadlines.filter((x) => x !== d);
          ctx.save('Удалено');
        }
      : null,
  });
}

function catalogDetail(ctx, c) {
  const tracked = ctx.state.magistr.unis.some((u) => u.catalogId === c.id);
  const dlg = openView(
    `${c.flag || ''} ${c.name}`,
    `${c.img ? `<img class="hero" src="${esc(c.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
     <p class="muted">${esc(c.sub)}</p>
     <dl class="facts">${Object.entries(c.facts || {}).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
     ${(c.sections || []).map((s) => `<h4>${esc(s.h)}</h4><p>${esc(s.t)}</p>`).join('')}
     <div class="modal-actions"><span class="spacer"></span><button class="btn primary" data-track ${tracked ? 'disabled' : ''}>${tracked ? 'Уже в моём списке' : '+ В мой список'}</button></div>`
  );
  dlg.querySelector('[data-track]')?.addEventListener('click', () => {
    dlg.close();
    const country = (c.sub.split('·')[0].split(',')[1] || '').trim();
    uniForm(ctx, null, { name: c.name, country, catalogId: c.id, notes: Object.values(c.facts || {}).join('; ') });
  });
}

function myView(ctx) {
  const m = ctx.state.magistr;
  const order = Object.fromEntries(STATUS.map((s, i) => [s, i]));
  const list = [...m.unis].sort((a, b) => (order[b.status] ?? 0) - (order[a.status] ?? 0) || (a.deadline || '9').localeCompare(b.deadline || '9'));
  const counts = STATUS.map((s) => [s, m.unis.filter((u) => u.status === s).length]).filter(([, n]) => n);
  const docsDone = m.docs.filter((d) => d.done).length;
  return `
    <section class="stats">
      <div class="stat"><span>В списке</span><b>${m.unis.length}</b><small>${counts.map(([s, n]) => `${esc(s)}: ${n}`).join(' · ')}</small></div>
      <div class="stat"><span>Документы</span><b>${docsDone}/${m.docs.length}</b><div class="bar"><i style="width:${(docsDone / m.docs.length) * 100}%"></i></div></div>
      <div class="stat"><span>Язык</span><b>${esc(m.lang.current || '—')}</b><small>${esc(m.lang.exam)}${m.lang.target ? ` · цель ${esc(m.lang.target)}` : ''}</small></div>
    </section>
    <div class="toolbar"><button class="btn primary" data-act="addUni">+ Вуз</button><button class="btn" data-act="tab" data-v="cat">Открыть каталог</button></div>
    ${
      list.length
        ? `<ul class="cards">${list
            .map(
              (u) => `<li class="card uni">
          <div><b>${esc(u.name)}</b><small class="muted">${esc([u.country, u.program].filter(Boolean).join(' · '))}</small>
          ${u.notes ? `<small class="muted">${esc(u.notes)}</small>` : ''}</div>
          <div class="uni-side">
            <select data-change="uniStatus" data-id="${u.id}" class="st-sel s-${STATUS.indexOf(u.status)}" aria-label="Статус">${STATUS.map((s) => `<option ${s === u.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
            ${u.deadline ? `<span class="badge">${fmtLong(u.deadline)}</span>` : ''}
            <span class="row-actions">${u.catalogId ? `<button class="btn sm ghost" data-act="catOpen" data-id="${esc(u.catalogId)}">О вузе</button>` : ''}${u.url ? `<a class="btn sm ghost" href="${esc(u.url)}" target="_blank" rel="noopener">Сайт</a>` : ''}<button class="btn sm ghost" data-act="editUni" data-id="${u.id}">Изменить</button></span>
          </div></li>`
            )
            .join('')}</ul>`
        : empty('Список пуст — добавьте вузы из каталога')
    }`;
}

function catalogView(ctx) {
  const tracked = new Set(ctx.state.magistr.unis.map((u) => u.catalogId));
  return `
    <div class="catalog">${CATALOG.map(
      (c) => `<button type="button" class="card cat" data-act="catOpen" data-id="${esc(c.id)}">
        ${c.img ? `<img src="${esc(c.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
        <div class="cat-body"><b>${c.flag || ''} ${esc(c.name)}</b><small class="muted">${esc(c.sub)}</small>
        <small>${Object.entries(c.facts || {}).slice(0, 3).map(([k, v]) => `${esc(k)}: ${esc(v)}`).join(' · ')}</small>
        ${tracked.has(c.id) ? '<span class="badge ok">в списке</span>' : ''}</div></button>`
    ).join('')}</div>
    <section class="card">
      <h2>Сравнение</h2>
      <div class="table-wrap"><table><thead><tr><th>Вуз</th><th>Язык</th><th>Срок</th><th>Стоимость/год</th><th>Стипендии</th></tr></thead><tbody>
      ${GUIDES.compare_rows.map((r) => `<tr><td><a href="#" data-act="catOpen" data-id="${esc(r.id)}">${r.flag || ''} ${esc(r.name)}</a></td><td>${esc(r.lang)}</td><td>${esc(r.dur)}</td><td>${esc(r.cost)}</td><td>${esc(r.schol)}</td></tr>`).join('')}
      </tbody></table></div>
    </section>`;
}

function deadlinesView(ctx) {
  const m = ctx.state.magistr;
  const t = todayISO();
  const all = [
    ...m.deadlines.map((d) => ({ ...d, kind: 'dl', ref: d })),
    ...m.unis.filter((u) => u.deadline).map((u) => ({ title: `Подача: ${u.name}`, date: u.deadline, type: 'Подача', kind: 'uni', ref: u })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const fut = all.filter((d) => d.date >= t);
  const past = all.filter((d) => d.date < t);
  const row = (d) => `<li><div><b>${esc(d.title)}</b><small class="muted">${esc(d.type || '')} · ${fmtLong(d.date)}</small></div>
    <span class="badge ${d.date >= t && daysBetween(t, d.date) <= 14 ? 'warn' : ''}">${relDays(d.date)}</span>
    ${d.kind === 'dl' ? `<button class="btn sm ghost" data-act="editDl" data-id="${d.ref.id}">Изменить</button>` : ''}</li>`;
  return `
    <div class="toolbar"><button class="btn primary" data-act="addDl">+ Дедлайн</button></div>
    <section class="card"><h2>Впереди</h2>${fut.length ? `<ul class="list">${fut.map(row).join('')}</ul>` : empty('Дедлайнов нет. Даты подачи из «Моих вузов» тоже появятся здесь.')}</section>
    ${past.length ? `<section class="card"><h2>Прошли</h2><ul class="list muted">${past.map(row).join('')}</ul></section>` : ''}`;
}

function docsView(ctx) {
  const m = ctx.state.magistr;
  return `
    <div class="grid2">
      <section class="card"><h2>Документы</h2>
        <ul class="checklist">${m.docs
          .map((d) => `<li><label><input type="checkbox" data-change="doc" data-id="${esc(d.id)}" ${d.done ? 'checked' : ''}> <span>${esc(d.title)}</span></label></li>`)
          .join('')}</ul>
      </section>
      <section class="card"><h2>Язык</h2>
        <div class="fields">
          <label class="field half"><span>Экзамен</span><select data-change="lang" data-k="exam">${['IELTS', 'TOEFL', 'Duolingo', 'Cambridge', 'Другой'].map((x) => `<option ${x === m.lang.exam ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
          <label class="field half"><span>Дата экзамена</span><input type="date" value="${esc(m.lang.date)}" data-change="lang" data-k="date"></label>
          <label class="field half"><span>Сейчас</span><input value="${esc(m.lang.current)}" placeholder="B1 / 5.5" data-change="lang" data-k="current"></label>
          <label class="field half"><span>Цель</span><input value="${esc(m.lang.target)}" placeholder="6.5" data-change="lang" data-k="target"></label>
          <label class="field"><span>План подготовки</span><textarea rows="3" data-change="lang" data-k="plan">${esc(m.lang.plan)}</textarea></label>
        </div>
      </section>
    </div>
    <section class="card"><h2>Мотивационное письмо — черновик</h2>
      <div class="fields">
        <label class="field"><span>Почему эта программа</span><textarea rows="4" data-change="sop" data-k="why">${esc(m.sop.why)}</textarea></label>
        <label class="field"><span>Опыт: учёба, проекты, работа</span><textarea rows="4" data-change="sop" data-k="exp">${esc(m.sop.exp)}</textarea></label>
        <label class="field"><span>Планы после выпуска</span><textarea rows="4" data-change="sop" data-k="future">${esc(m.sop.future)}</textarea></label>
      </div>
    </section>`;
}

function guidesView() {
  return `<div class="grid2">${Object.entries(GUIDE_TITLES)
    .map(([k, title]) => `<section class="card"><h2>${title}</h2><ul class="bullets">${(GUIDES[k] || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>`)
    .join('')}</div>`;
}

export default {
  id: 'magistr',
  title: 'Магистратура',
  short: 'Вузы',
  icon: '✈',
  render(ctx, v) {
    const tab = v.tab || 'my';
    const body = { my: myView, cat: catalogView, dl: deadlinesView, docs: docsView, guides: guidesView }[tab](ctx);
    return `
      <header class="page-head"><div><p class="eyebrow">Поступление abroad</p><h1>Магистратура</h1></div></header>
      ${segmented([['my', 'Мои вузы'], ['cat', 'Каталог'], ['dl', 'Дедлайны'], ['docs', 'Документы и SOP'], ['guides', 'Гайды']], tab, 'tab')}
      ${body}`;
  },
  actions: {
    tab: (el, ctx, v) => ((v.tab = el.dataset.v), ctx.rerender()),
    addUni: (el, ctx) => uniForm(ctx),
    editUni: (el, ctx) => uniForm(ctx, ctx.state.magistr.unis.find((u) => u.id === Number(el.dataset.id))),
    uniStatus(el, ctx) {
      ctx.state.magistr.unis.find((u) => u.id === Number(el.dataset.id)).status = el.value;
      ctx.save('Статус обновлён');
    },
    catOpen: (el, ctx) => {
      const c = CATALOG.find((x) => x.id === el.dataset.id);
      if (c) catalogDetail(ctx, c);
    },
    addDl: (el, ctx) => dlForm(ctx),
    editDl: (el, ctx) => dlForm(ctx, ctx.state.magistr.deadlines.find((d) => d.id === Number(el.dataset.id))),
    doc(el, ctx) {
      ctx.state.magistr.docs.find((d) => d.id === el.dataset.id).done = el.checked;
      ctx.save();
    },
    lang(el, ctx) {
      ctx.state.magistr.lang[el.dataset.k] = el.value;
      ctx.save('Сохранено');
    },
    sop(el, ctx) {
      ctx.state.magistr.sop[el.dataset.k] = el.value;
      ctx.save('Черновик сохранён');
    },
  },
};
