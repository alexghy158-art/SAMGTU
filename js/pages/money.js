// «Деньги»: кошельки, дневной лимит до выплаты, операции, категории.
import { WALLETS, walletName, walletTotal, spendable, budget } from '../logic.js';
import { esc, todayISO, fmtShort, fmtLong, monthKey, monthLabel, rub, num, nextId } from '../utils.js';
import { openForm, segmented, empty } from '../ui.js';

const QUICK_CATS = ['еда', 'транспорт', 'кафе', 'сигареты', 'связь', 'учёба', 'одежда', 'прочее'];

function applyOp(f, op, sign) {
  const k = op.wallet in f.wallets ? op.wallet : 'card';
  const d = (op.type === 'income' ? 1 : -1) * num(op.amount) * sign;
  f.wallets[k] = Math.round((num(f.wallets[k]) + d) * 100) / 100;
}

export function opForm(ctx, preset = {}, op = null) {
  const f = ctx.state.finance;
  openForm({
    title: op ? 'Операция' : preset.type === 'income' ? 'Доход' : 'Расход',
    values: op || { type: 'expense', date: todayISO(), wallet: 'card', ...preset },
    fields: [
      { name: 'type', label: 'Тип', type: 'select', options: [['expense', 'Расход'], ['income', 'Доход']], half: true },
      { name: 'amount', label: 'Сумма, ₽', type: 'number', min: 0, step: 'any', required: true, half: true },
      { name: 'wallet', label: 'Кошелёк', type: 'select', options: WALLETS, half: true },
      { name: 'date', label: 'Дата', type: 'date', half: true },
      { name: 'category', label: 'Категория', placeholder: 'еда, транспорт, аванс, зарплата…' },
      { name: 'note', label: 'Комментарий' },
    ],
    onSubmit(v) {
      if (!(num(v.amount) > 0)) {
        alert('Укажите сумму');
        return false;
      }
      v.amount = num(v.amount);
      v.category = v.category || (v.type === 'income' ? 'доход' : 'прочее');
      if (op) {
        applyOp(f, op, -1);
        Object.assign(op, v);
        applyOp(f, op, 1);
      } else {
        const n = { ...v, id: nextId(f.ops) };
        f.ops.push(n);
        applyOp(f, n, 1);
      }
      ctx.save(v.type === 'income' ? 'Доход учтён' : 'Расход учтён');
    },
    onDelete: op
      ? () => {
          applyOp(f, op, -1);
          f.ops = f.ops.filter((x) => x !== op);
          ctx.save('Операция удалена, баланс скорректирован');
        }
      : null,
  });
}

export default {
  id: 'money',
  title: 'Деньги',
  icon: '₽',
  render(ctx, v) {
    const f = ctx.state.finance;
    const t = todayISO();
    const b = budget(f);
    const months = [...new Set([monthKey(t), ...f.ops.map((o) => monthKey(o.date || t))])].sort().reverse();
    const mk = v.month || monthKey(t);
    const filter = v.filter || 'all';
    const ops = f.ops
      .filter((o) => monthKey(o.date || t) === mk && (filter === 'all' || o.type === filter))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id - a.id);
    const monthOps = f.ops.filter((o) => monthKey(o.date || t) === mk);
    const inc = monthOps.filter((o) => o.type === 'income').reduce((s, o) => s + num(o.amount), 0);
    const exp = monthOps.filter((o) => o.type === 'expense').reduce((s, o) => s + num(o.amount), 0);
    const cats = {};
    monthOps.filter((o) => o.type === 'expense').forEach((o) => {
      const c = (o.category || 'прочее').toLowerCase();
      cats[c] = (cats[c] || 0) + num(o.amount);
    });
    const catList = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    const maxCat = catList[0]?.[1] || 1;

    return `
      <header class="page-head">
        <div><p class="eyebrow">Финансы</p><h1>Деньги</h1></div>
        <div class="head-actions">
          <button class="btn" data-act="add" data-type="income">+ Доход</button>
          <button class="btn primary" data-act="add" data-type="expense">− Расход</button>
        </div>
      </header>

      <div class="grid2">
        <section class="card">
          <h2>Кошельки <small class="muted">всего ${rub(walletTotal(f))}</small></h2>
          <div class="wallets">
            ${WALLETS.map(
              ([k, l]) => `<label class="wallet"><span>${l}${k === 'coins' ? ' <small class="muted">(не в лимите)</small>' : ''}</span>
              <span class="inline-input"><input type="number" step="any" min="0" inputmode="decimal" value="${num(f.wallets[k])}" data-change="wallet" data-k="${k}"> ₽</span></label>`
            ).join('')}
          </div>
          <p class="muted small">Можно поправить остаток вручную. Операции меняют его автоматически.</p>
        </section>

        <section class="card budget ${b.leftToday < 0 ? 'neg' : ''}">
          <h2>Лимит на сегодня</h2>
          <div class="big">${rub(b.leftToday)}</div>
          <p class="muted">Потрачено сегодня ${rub(b.todaySpent)} из ${rub(b.dailyToday)}.</p>
          <p>Свободно ${rub(spendable(f))} на ${b.daysLeft} дн. до ${b.nextKind === 'аванс' ? 'аванса' : 'зарплаты'} (${fmtLong(b.nextPay)}) → <b>${rub(b.daily)}/день</b> с завтрашнего дня.</p>
          <div class="toolbar">
            <label class="mini">Аванс <input type="number" min="1" max="28" value="${f.advanceDay}" data-change="payday" data-k="advanceDay"> числа</label>
            <label class="mini">Зарплата <input type="number" min="1" max="28" value="${f.salaryDay}" data-change="payday" data-k="salaryDay"> числа</label>
          </div>
        </section>
      </div>

      <section class="card">
        <h2>Быстрый расход</h2>
        <form class="quick" data-quick>
          <input type="number" min="1" step="any" inputmode="decimal" placeholder="Сумма" name="amount" required aria-label="Сумма">
          <select name="wallet" aria-label="Кошелёк">${WALLETS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
          <div class="chips">${QUICK_CATS.map((c) => `<button type="submit" class="chip" name="cat" value="${c}">${c}</button>`).join('')}</div>
        </form>
      </section>

      <div class="toolbar wrap">
        <select data-change="month" aria-label="Месяц">${months.map((m) => `<option value="${m}" ${m === mk ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}</select>
        ${segmented([['all', 'Все'], ['expense', 'Расходы'], ['income', 'Доходы']], filter, 'filter')}
      </div>

      <section class="stats three">
        <div class="stat"><span>Доходы</span><b class="pos">${rub(inc)}</b></div>
        <div class="stat"><span>Расходы</span><b>${rub(exp)}</b></div>
        <div class="stat"><span>Итог</span><b class="${inc - exp < 0 ? 'neg-text' : 'pos'}">${rub(inc - exp)}</b></div>
      </section>

      <div class="grid2">
        <section class="card">
          <h2>Операции</h2>
          ${
            ops.length
              ? `<ul class="list ops">${ops
                  .map(
                    (o) => `<li><button type="button" class="op" data-act="edit" data-id="${o.id}">
                <span><b>${esc(o.category)}</b><small class="muted">${fmtShort(o.date)} · ${esc(walletName(o.wallet))}${o.note ? ' · ' + esc(o.note) : ''}</small></span>
                <span class="${o.type === 'income' ? 'pos' : ''}">${o.type === 'income' ? '+' : '−'}${rub(o.amount)}</span></button></li>`
                  )
                  .join('')}</ul>`
              : empty('Операций нет')
          }
        </section>
        <section class="card">
          <h2>Расходы по категориям</h2>
          ${
            catList.length
              ? `<ul class="cats">${catList
                  .map(([c, a]) => `<li><span>${esc(c)}</span><span class="bar"><i style="width:${(a / maxCat) * 100}%"></i></span><b>${rub(a)}</b></li>`)
                  .join('')}</ul>`
              : empty('Расходов в этом месяце нет')
          }
        </section>
      </div>`;
  },
  mount(root, ctx) {
    const form = root.querySelector('[data-quick]');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const amount = num(form.elements.amount.value);
      if (!(amount > 0)) return;
      const f = ctx.state.finance;
      const op = { id: nextId(f.ops), type: 'expense', amount, wallet: form.elements.wallet.value, date: todayISO(), category: e.submitter?.value || 'прочее', note: '' };
      f.ops.push(op);
      applyOp(f, op, 1);
      ctx.save(`−${rub(amount)} · ${op.category}`);
    });
  },
  actions: {
    add: (el, ctx) => opForm(ctx, { type: el.dataset.type }),
    edit: (el, ctx) => opForm(ctx, {}, ctx.state.finance.ops.find((o) => o.id === Number(el.dataset.id))),
    month: (el, ctx, v) => ((v.month = el.value), ctx.rerender()),
    filter: (el, ctx, v) => ((v.filter = el.dataset.v), ctx.rerender()),
    wallet(el, ctx) {
      ctx.state.finance.wallets[el.dataset.k] = Math.max(0, num(el.value));
      ctx.save('Остаток обновлён');
    },
    payday(el, ctx) {
      ctx.state.finance[el.dataset.k] = Math.min(28, Math.max(1, parseInt(el.value, 10) || 1));
      ctx.save('Дата выплаты сохранена');
    },
  },
};
