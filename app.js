
const KEY = 'personal_hub_v1';
const DEFAULT_DOCS = [
  { id: 'passport', title: 'Загранпаспорт (срок > 1.5 года)', done: false },
  { id: 'diploma', title: 'Диплом / справка об обучении', done: false },
  { id: 'transcript', title: 'Транскрипт / приложение к диплому', done: false },
  { id: 'translation', title: 'Нотариальный перевод документов', done: false },
  { id: 'cv', title: 'CV (Europass / 1–2 стр.)', done: false },
  { id: 'sop', title: 'Motivation letter / SOP', done: false },
  { id: 'rec1', title: 'Рекомендательное письмо 1', done: false },
  { id: 'rec2', title: 'Рекомендательное письмо 2', done: false },
  { id: 'lang', title: 'Сертификат языка (IELTS/TOEFL)', done: false },
  { id: 'photo', title: 'Фото на документы', done: false },
  { id: 'portfolio', title: 'Портфолио / GitHub / проекты', done: false },
  { id: 'finance', title: 'Финансовые гарантии / выписка', done: false },
];

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    study: { gpa: '', program: '', strong: '', weak: '' },
    lang: { exam: 'IELTS', target: '', current: '', date: '', plan: '' },
    sop: { why: '', exp: '', future: '' },
    budget: { have: '', need: '' },
    unis: [],
    work: [],
    deadlines: [],
    docs: DEFAULT_DOCS.map(d => ({ ...d })),
    nextUniId: 1,
    nextWorkId: 1,
    nextDlId: 1,
  };
}
let state = load();
function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
function toast(m) {
  const el = document.getElementById('toast');
  el.textContent = m; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2000);
}

// nav
document.querySelectorAll('#nav button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b === btn));
    ['home','study','work','magistr','docs','timeline'].forEach(p => {
      document.getElementById('page-' + p).classList.toggle('hidden', p !== btn.dataset.page);
    });
    render();
  });
});

function badge(status) {
  const map = {
    'Интерес': 'plan', 'Готовлю документы': 'wait', 'Подал': 'plan',
    'Интервью': 'wait', 'Оффер': 'ok', 'Отказ': 'no'
  };
  return `<span class="badge ${map[status]||'plan'}">${status}</span>`;
}

function daysUntil(iso) {
  if (!iso) return null;
  const d = Math.ceil((new Date(iso + 'T12:00:00') - new Date()) / 86400000);
  return d;
}

function renderHome() {
  const docsDone = state.docs.filter(d => d.done).length;
  const docsTotal = state.docs.length;
  const unis = state.unis.length;
  const offers = state.unis.filter(u => u.status === 'Оффер').length;
  const upcoming = [...state.deadlines, ...state.unis.filter(u => u.deadline).map(u => ({ title: u.name + ' · ' + u.program, date: u.deadline, type: 'Подача' }))]
    .filter(x => x.date && daysUntil(x.date) !== null)
    .sort((a,b) => a.date.localeCompare(b.date));
  const next = upcoming[0];

  document.getElementById('home-stats').innerHTML = `
    <div class="stat"><div class="l">Документы</div><div class="v b">${docsDone}/${docsTotal}</div>
      <div class="progress"><i style="width:${Math.round(docsDone/docsTotal*100)}%"></i></div></div>
    <div class="stat"><div class="l">Программ</div><div class="v">${unis}</div></div>
    <div class="stat"><div class="l">Офферы</div><div class="v g">${offers}</div></div>
    <div class="stat"><div class="l">Язык цель</div><div class="v o">${state.lang.target || '—'}</div></div>
  `;

  document.getElementById('home-magistr').innerHTML = state.unis.length
    ? state.unis.slice(0,4).map(u => `<div class="list-item"><h3>${u.name}</h3><div class="muted">${u.program || ''} · ${u.country || ''}</div>${badge(u.status)}</div>`).join('')
    : '<p class="muted">Добавь первую программу во вкладке «Магистратура»</p>';

  document.getElementById('home-study').innerHTML = `
    <p><b>GPA:</b> ${state.study.gpa || 'не указан'}</p>
    <p class="muted">${state.study.program || 'Программа не указана'}</p>
    <p class="muted" style="margin-top:6px">${state.lang.exam}: сейчас ${state.lang.current || '—'} → цель ${state.lang.target || '—'}</p>
  `;

  document.getElementById('home-deadlines').innerHTML = upcoming.length
    ? upcoming.slice(0,6).map(d => {
        const left = daysUntil(d.date);
        const cls = left < 14 ? 'r' : left < 45 ? 'o' : 'b';
        return `<div class="list-item"><h3>${d.title}</h3><div class="muted">${d.date} · ${d.type || ''} · <span class="v ${cls}" style="font-weight:800">через ${left} дн.</span></div></div>`;
      }).join('')
    : '<p class="muted">Дедлайнов пока нет — добавь на вкладке «Таймлайн»</p>';
}

function saveStudyProfile() {
  state.study = {
    gpa: document.getElementById('gpa').value,
    program: document.getElementById('program').value,
    strong: document.getElementById('strong-subjects').value,
    weak: document.getElementById('weak-subjects').value,
  };
  save(); toast('Профиль учёбы сохранён'); render();
}
function fillStudy() {
  document.getElementById('gpa').value = state.study.gpa || '';
  document.getElementById('program').value = state.study.program || '';
  document.getElementById('strong-subjects').value = state.study.strong || '';
  document.getElementById('weak-subjects').value = state.study.weak || '';
}

function saveLang() {
  state.lang = {
    exam: document.getElementById('lang-exam').value,
    target: document.getElementById('lang-target').value,
    current: document.getElementById('lang-current').value,
    date: document.getElementById('lang-date').value,
    plan: document.getElementById('lang-plan').value,
  };
  save(); toast('Язык сохранён'); render();
}
function fillLang() {
  document.getElementById('lang-exam').value = state.lang.exam || 'IELTS';
  document.getElementById('lang-target').value = state.lang.target || '';
  document.getElementById('lang-current').value = state.lang.current || '';
  document.getElementById('lang-date').value = state.lang.date || '';
  document.getElementById('lang-plan').value = state.lang.plan || '';
}

function saveSOP() {
  state.sop = {
    why: document.getElementById('sop-why').value,
    exp: document.getElementById('sop-exp').value,
    future: document.getElementById('sop-future').value,
  };
  save(); toast('SOP сохранён');
}
function fillSOP() {
  document.getElementById('sop-why').value = state.sop.why || '';
  document.getElementById('sop-exp').value = state.sop.exp || '';
  document.getElementById('sop-future').value = state.sop.future || '';
}

function renderDocs() {
  document.getElementById('docs-list').innerHTML = state.docs.map(d => `
    <div class="check">
      <input type="checkbox" ${d.done?'checked':''} onchange="toggleDoc('${d.id}', this.checked)">
      <div><b>${d.title}</b></div>
    </div>`).join('');
}
function toggleDoc(id, done) {
  const d = state.docs.find(x => x.id === id);
  if (d) { d.done = done; save(); render(); }
}
function resetDocs() {
  if (!confirm('Сбросить чеклист?')) return;
  state.docs = DEFAULT_DOCS.map(d => ({ ...d }));
  save(); render();
}

function renderUnis() {
  const f = document.getElementById('uni-filter').value;
  let list = state.unis.slice().sort((a,b) => (a.deadline||'9999').localeCompare(b.deadline||'9999'));
  if (f) list = list.filter(u => u.status === f);
  document.getElementById('mag-stats').innerHTML = `
    <div class="stat"><div class="l">Всего</div><div class="v">${state.unis.length}</div></div>
    <div class="stat"><div class="l">В работе</div><div class="v o">${state.unis.filter(u=>u.status==='Готовлю документы'||u.status==='Подал').length}</div></div>
    <div class="stat"><div class="l">Офферы</div><div class="v g">${state.unis.filter(u=>u.status==='Оффер').length}</div></div>
  `;
  document.getElementById('uni-list').innerHTML = list.length ? list.map(u => {
    const left = daysUntil(u.deadline);
    return `<div class="list-item">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
        <div>
          <h3>${u.name}</h3>
          <div class="muted">${u.program || ''} · ${u.country || ''}</div>
          <div style="margin-top:6px">${badge(u.status)}
            ${u.deadline ? `<span class="muted"> · дедлайн ${u.deadline}${left!==null?` (${left} дн.)`:''}</span>` : ''}
          </div>
          ${u.url ? `<div style="margin-top:4px"><a class="link" href="${u.url}" target="_blank" rel="noopener">Страница программы</a></div>` : ''}
          ${u.notes ? `<div class="muted" style="margin-top:4px">${u.notes}</div>` : ''}
        </div>
        <div>
          <button class="btn sec sm" onclick="editUni(${u.id})">✎</button>
          <button class="btn danger sm" onclick="delUni(${u.id})">×</button>
        </div>
      </div>
    </div>`;
  }).join('') : '<p class="muted">Пока пусто. Добавь 3–7 программ — так проще выбрать и успеть дедлайны.</p>';
}
document.getElementById('uni-filter').addEventListener('change', renderUnis);

function openUniModal(u) {
  document.getElementById('uni-modal').classList.add('open');
  document.getElementById('uni-modal-title').textContent = u ? 'Редактировать' : 'Новая программа';
  document.getElementById('uni-id').value = u ? u.id : '';
  document.getElementById('uni-name').value = u ? u.name : '';
  document.getElementById('uni-program').value = u ? u.program : '';
  document.getElementById('uni-country').value = u ? u.country : '';
  document.getElementById('uni-deadline').value = u ? u.deadline : '';
  document.getElementById('uni-status').value = u ? u.status : 'Интерес';
  document.getElementById('uni-url').value = u ? u.url : '';
  document.getElementById('uni-notes').value = u ? u.notes : '';
}
function closeUniModal() { document.getElementById('uni-modal').classList.remove('open'); }
function saveUni() {
  const idRaw = document.getElementById('uni-id').value;
  const data = {
    name: document.getElementById('uni-name').value.trim(),
    program: document.getElementById('uni-program').value.trim(),
    country: document.getElementById('uni-country').value.trim(),
    deadline: document.getElementById('uni-deadline').value,
    status: document.getElementById('uni-status').value,
    url: document.getElementById('uni-url').value.trim(),
    notes: document.getElementById('uni-notes').value.trim(),
  };
  if (!data.name) return alert('Укажи университет');
  if (!idRaw) {
    data.id = state.nextUniId++;
    state.unis.push(data);
  } else {
    const id = +idRaw;
    const i = state.unis.findIndex(x => x.id === id);
    if (i >= 0) state.unis[i] = { ...data, id };
  }
  save(); closeUniModal(); render(); toast('Сохранено');
}
function editUni(id) { openUniModal(state.unis.find(x => x.id === id)); }
function delUni(id) {
  if (!confirm('Удалить программу?')) return;
  state.unis = state.unis.filter(x => x.id !== id);
  save(); render();
}

function renderWork() {
  document.getElementById('work-list').innerHTML = state.work.length ? state.work.map(w => `
    <div class="list-item">
      <div style="display:flex;justify-content:space-between;gap:8px">
        <div>
          <h3>${w.title}</h3>
          <div class="muted">${w.from || ''} — ${w.to || 'н.в.'}</div>
          <div class="muted" style="margin-top:4px">${w.desc || ''}</div>
        </div>
        <div>
          <button class="btn sec sm" onclick="editWork(${w.id})">✎</button>
          <button class="btn danger sm" onclick="delWork(${w.id})">×</button>
        </div>
      </div>
    </div>`).join('') : '<p class="muted">Добавь работу и проекты — пригодится в CV и SOP</p>';
}
function openWorkModal(w) {
  document.getElementById('work-modal').classList.add('open');
  document.getElementById('work-id').value = w ? w.id : '';
  document.getElementById('work-title').value = w ? w.title : '';
  document.getElementById('work-from').value = w ? w.from : '';
  document.getElementById('work-to').value = w ? w.to : '';
  document.getElementById('work-desc').value = w ? w.desc : '';
}
function closeWorkModal() { document.getElementById('work-modal').classList.remove('open'); }
function saveWork() {
  const idRaw = document.getElementById('work-id').value;
  const data = {
    title: document.getElementById('work-title').value.trim(),
    from: document.getElementById('work-from').value,
    to: document.getElementById('work-to').value,
    desc: document.getElementById('work-desc').value.trim(),
  };
  if (!data.title) return alert('Укажи место/роль');
  if (!idRaw) { data.id = state.nextWorkId++; state.work.push(data); }
  else {
    const id = +idRaw;
    const i = state.work.findIndex(x => x.id === id);
    if (i >= 0) state.work[i] = { ...data, id };
  }
  save(); closeWorkModal(); render(); toast('Сохранено');
}
function editWork(id) { openWorkModal(state.work.find(x => x.id === id)); }
function delWork(id) {
  if (!confirm('Удалить?')) return;
  state.work = state.work.filter(x => x.id !== id);
  save(); render();
}

function renderDeadlines() {
  const list = state.deadlines.slice().sort((a,b) => (a.date||'').localeCompare(b.date||''));
  document.getElementById('deadline-list').innerHTML = list.length ? list.map(d => {
    const left = daysUntil(d.date);
    return `<div class="list-item">
      <div style="display:flex;justify-content:space-between;gap:8px">
        <div>
          <h3>${d.title}</h3>
          <div class="muted">${d.date} · ${d.type || ''}${left!==null?` · через ${left} дн.`:''}</div>
          ${d.note?`<div class="muted">${d.note}</div>`:''}
        </div>
        <button class="btn danger sm" onclick="delDeadline(${d.id})">×</button>
      </div>
    </div>`;
  }).join('') : '<p class="muted">Добавь дедлайны подач и экзамена</p>';
}
function openDeadlineModal() {
  document.getElementById('deadline-modal').classList.add('open');
  document.getElementById('dl-id').value = '';
  document.getElementById('dl-title').value = '';
  document.getElementById('dl-date').value = '';
  document.getElementById('dl-type').value = 'Подача';
  document.getElementById('dl-note').value = '';
}
function closeDeadlineModal() { document.getElementById('deadline-modal').classList.remove('open'); }
function saveDeadline() {
  const data = {
    id: state.nextDlId++,
    title: document.getElementById('dl-title').value.trim(),
    date: document.getElementById('dl-date').value,
    type: document.getElementById('dl-type').value,
    note: document.getElementById('dl-note').value.trim(),
  };
  if (!data.title || !data.date) return alert('Название и дата обязательны');
  state.deadlines.push(data);
  save(); closeDeadlineModal(); render(); toast('Добавлено');
}
function delDeadline(id) {
  state.deadlines = state.deadlines.filter(x => x.id !== id);
  save(); render();
}

function saveBudget() {
  state.budget = {
    have: document.getElementById('budget-have').value,
    need: document.getElementById('budget-need').value,
  };
  save(); render(); toast('Бюджет сохранён');
}
function fillBudget() {
  document.getElementById('budget-have').value = state.budget.have || '';
  document.getElementById('budget-need').value = state.budget.need || '';
  const have = +state.budget.have || 0;
  const need = +state.budget.need || 0;
  const pct = need > 0 ? Math.min(100, Math.round(have/need*100)) : 0;
  document.getElementById('budget-bar').innerHTML = need
    ? `<div style="font-weight:800;margin-top:8px">${have.toLocaleString('ru-RU')} ₽ из ${need.toLocaleString('ru-RU')} ₽ · ${pct}%</div>
       <div class="progress"><i style="width:${pct}%"></i></div>`
    : '<p class="muted">Укажи цель накоплений</p>';
}

function exportAll() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'hub-backup.json';
  a.click();
}
function importAll(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      state = JSON.parse(r.result);
      save(); render(); toast('Backup загружен');
    } catch (err) { alert('Неверный файл'); }
  };
  r.readAsText(f);
}

function render() {
  fillStudy(); fillLang(); fillSOP(); fillBudget();
  renderHome(); renderUnis(); renderWork(); renderDocs(); renderDeadlines();
}
render();
