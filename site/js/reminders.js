// Список напоминаний на ближайшие дни — уходит в облако, оттуда push присылает плановая функция Netlify.
import { classesWithStatus } from './store.js';
import { todayISO, addDays } from './utils.js';

const HORIZON_DAYS = 14;

function at(date, time, minusMin = 0) {
  const d = new Date(`${date}T${time || '09:00'}:00`);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() - minusMin * 60000);
}

export function buildReminders(s) {
  const now = Date.now();
  const until = now + HORIZON_DAYS * 86400000;
  const st = s.settings || {};
  const out = [];
  const add = (id, when, title, body, url) => {
    if (!when) return;
    const t = when.getTime();
    if (t < now - 60000 || t > until) return;
    const iso = when.toISOString();
    out.push({ id: `${id}:${iso}`, at: iso, title, body: body || '', url: url || '#today' });
  };

  if (st.remindTodos !== false) {
    for (const t of s.todos) {
      if (t.done || !t.due || !t.time || t.remind === false) continue;
      add(`todo:${t.id}`, at(t.due, t.time), `✅ ${t.title}`, t.note || 'Пора сделать', '#life');
    }
  }

  if (st.remindClasses) {
    const lead = Number(st.classLead) || 10;
    const end = addDays(todayISO(), 7);
    for (const c of classesWithStatus(s)) {
      if (c.date < todayISO() || c.date > end || c.status === 'Отменена') continue;
      add(`class:${c.key}`, at(c.date, c.start, lead), `📚 ${c.subject}`, `${c.type} в ${c.start}${c.teacher ? ' · ' + c.teacher : ''}`, '#today');
    }
  }

  if (st.remindShifts !== false) {
    const lead = Number(st.shiftLead) || 60;
    for (const x of s.shifts) {
      if (!x.startDate) continue;
      add(`shift:${x.id}`, at(x.startDate, x.startTime, lead), `💼 Смена ${x.type || ''}`.trim(), `Начало в ${x.startTime}`, '#work');
    }
  }

  if (st.remindExams !== false) {
    for (const e of s.exams) {
      if (!e.date || e.grade) continue;
      add(`exam:${e.id}`, at(addDays(e.date, -1), '19:00'), `🎓 Завтра ${String(e.kind || 'экзамен').toLowerCase()}`, `${e.subject}${e.time ? ' в ' + e.time : ''}${e.room ? ' · ' + e.room : ''}`, '#study');
    }
  }

  if (st.remindPosts !== false) {
    for (const p of s.posts) {
      if (!p.date || p.status === 'Опубликован') continue;
      add(`post:${p.id}`, at(p.date, p.time || '12:00'), `📣 Пост «Твой ход»`, p.title, '#tvoyhod');
    }
  }

  out.sort((a, b) => a.at.localeCompare(b.at));
  return out.slice(0, 500);
}
