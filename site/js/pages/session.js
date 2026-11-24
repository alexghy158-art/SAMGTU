// Сессия: зачёты/экзамены/курсовые, оценки, средний балл, прогноз стипендии.
import { SUBJECTS, subjStyle } from '../store.js';
import { esc, todayISO, fmtLong, relDays, nextId, daysBetween, plural } from '../utils.js';
import { openForm, empty } from '../ui.js';

export const KINDS = ['Экзамен', 'Зачёт', 'Дифзачёт', 'Курсовая'];
export const GRADES = ['', '5', '4', '3', '2', 'зачёт', 'незачёт'];

export function examForm(ctx, e) {
  openForm({
    title: e ? e.subject : 'Зачёт / экзамен',
    values: e || { subject: SUBJECTS[0], kind: 'Экзамен', grade: '' },
    fields: [
      { name: 'subject', label: 'Предмет', type: 'select', options: SUBJECTS },
      { name: 'kind', label: 'Форма контроля', type: 'select', options: KINDS, half: true },
      { name: 'grade', label: 'Оценка', type: 'select', options: GRADES.map((g) => [g, g || '— пока нет']), half: true },
      { name: 'date', label: 'Дата', type: 'date', half: true },
      { name: 'time', label: 'Время', type: 'time', half: true },
      { name: 'room', label: 'Аудитория', half: true, placeholder: '8-412' },
      { name: 'teacher', label: 'Преподаватель', half: true },
      { name: 'note', label: 'Заметка', type: 'textarea', rows: 2, placeholder: 'Билеты, что повторить, допуск…' },
    ],
    onSubmit(v) {
      if (e) Object.assign(e, v);
      else ctx.state.exams.push({ ...v, id: nextId(ctx.state.exams) });
      ctx.save('Сохранено');
    },
    onDelete: e
      ? () => {
          ctx.state.exams = ctx.state.exams.filter((x) => x !== e);
          ctx.save('Удалено');
        }
      : null,
  });
}

export function sessionSummary(exams) {
  const nums = exams.map((e) => Number(e.grade)).filter((n) => n >= 2 && n <= 5);
  const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  const graded = exams.filter((e) => e.grade);
  const bad = graded.some((e) => e.grade === '3' || e.grade === '2' || e.grade === 'незачёт');
  const allFive = nums.length > 0 && nums.every((n) => n === 5) && !graded.some((e) => e.grade === 'незачёт');
  let stip;
  if (!graded.length) stip = ['muted', 'Оценок пока нет'];
  else if (bad) stip = ['bad', 'Есть тройка или незачёт — стипендии, скорее всего, не будет'];
  else if (allFive) stip = ['ok', 'Только пятёрки — шанс на повышенную стипендию'];
  else stip = ['ok', 'Без троек — стипендия сохраняется'];
  const t = todayISO();
  const upcoming = exams.filter((e) => e.date && e.date >= t && !e.grade).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  return { avg, graded: graded.length, total: exams.length, stip, next: upcoming[0], upcoming };
}

export function sessionView(ctx) {
  const s = ctx.state;
  const sum = sessionSummary(s.exams);
  const t = todayISO();
  const list = [...s.exams].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.subject.localeCompare(b.subject, 'ru'));
  const missing = SUBJECTS.filter((x) => !s.exams.some((e) => e.subject === x));
  return `
    <section class="stats three">
      <div class="stat"><span>До сессии</span><b>${sum.next ? (sum.next.date === t ? 'сегодня' : `${daysBetween(t, sum.next.date)} ${plural(daysBetween(t, sum.next.date), 'день', 'дня', 'дней')}`) : '—'}</b><small>${sum.next ? `${esc(sum.next.kind)}: ${esc(sum.next.subject)}` : 'добавьте даты'}</small></div>
      <div class="stat"><span>Средний балл</span><b>${sum.avg ? sum.avg.toFixed(2) : '—'}</b><small>${sum.graded} из ${sum.total} с оценкой</small></div>
      <div class="stat ${sum.stip[0] === 'bad' ? 'neg' : ''}"><span>Стипендия</span><b>${sum.stip[0] === 'ok' ? '✓' : sum.stip[0] === 'bad' ? '✕' : '—'}</b><small>${esc(sum.stip[1])}</small></div>
    </section>
    <div class="toolbar wrap">
      <button class="btn primary" data-act="addExam">+ Зачёт / экзамен</button>
      ${missing.length ? `<button class="btn" data-act="fillExams">Добавить все предметы (${missing.length})</button>` : ''}
    </div>
    ${
      list.length
        ? `<ul class="cards">${list
            .map(
              (e) => `<li class="card exam" style="${subjStyle(e.subject)}">
          <div class="exam-main"><i class="sdot"></i><div><b>${esc(e.subject)}</b>
            <small class="muted">${esc(e.kind)}${e.date ? ` · ${fmtLong(e.date)}${e.time ? ' ' + esc(e.time) : ''} · ${relDays(e.date)}` : ' · дата не указана'}${e.room ? ' · ' + esc(e.room) : ''}</small>
            ${e.note ? `<small class="muted">${esc(e.note)}</small>` : ''}</div></div>
          <div class="exam-side">
            <select data-change="grade" data-id="${e.id}" class="grade-sel g-${esc(e.grade || 'none')}" aria-label="Оценка">${GRADES.map((g) => `<option value="${g}" ${g === (e.grade || '') ? 'selected' : ''}>${g || 'оценка'}</option>`).join('')}</select>
            <button class="btn sm ghost" data-act="editExam" data-id="${e.id}">Изменить</button>
          </div></li>`
            )
            .join('')}</ul>`
        : empty('Сессия пока пустая. Нажмите «Добавить все предметы», затем проставьте форму контроля и даты.')
    }
    <p class="muted small">Прогноз стипендии упрощённый: без троек и незачётов — обычная, только пятёрки — шанс на повышенную. Точные правила — в положении СамГТУ.</p>`;
}

export const sessionActions = {
  addExam: (el, ctx) => examForm(ctx),
  editExam: (el, ctx) => examForm(ctx, ctx.state.exams.find((e) => e.id === Number(el.dataset.id))),
  grade(el, ctx) {
    const e = ctx.state.exams.find((x) => x.id === Number(el.dataset.id));
    e.grade = el.value;
    ctx.save(e.grade === '5' ? 'Отлично! 🎉' : 'Оценка сохранена');
  },
  fillExams(el, ctx) {
    const s = ctx.state;
    for (const subj of SUBJECTS) {
      if (s.exams.some((e) => e.subject === subj)) continue;
      s.exams.push({ id: nextId(s.exams), subject: subj, kind: 'Зачёт', date: '', time: '', room: '', grade: '', note: '' });
    }
    ctx.save('Предметы добавлены — проставьте форму контроля и даты');
  },
};
