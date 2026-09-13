// ===== Shared FX logic used by compare.html, money.html, visa.html, fx.html =====
let EUR_RUB = 105;
let USD_RUB = 95;
let fxChart = null;
let livingChart = null;

function fmtRub(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(2).replace(/\.00$/, '') + ' млн ₽';
  if (n >= 1000) return Math.round(n / 1000) + ' тыс ₽';
  return Math.round(n) + ' ₽';
}
function fmtRange(min, max) {
  if (Math.abs(min - max) < 1) return fmtRub(min);
  return fmtRub(min) + ' – ' + fmtRub(max);
}
function toRub(amount, cur) {
  if (cur === 'EUR') return amount * EUR_RUB;
  if (cur === 'USD') return amount * USD_RUB;
  return amount;
}
function fromRub(amountRub, cur) {
  if (cur === 'EUR') return amountRub / EUR_RUB;
  if (cur === 'USD') return amountRub / USD_RUB;
  return amountRub;
}
function runConvert() {
  const fromAmtEl = document.getElementById('convFromAmt');
  if (!fromAmtEl) return;
  const fromAmt = parseFloat(fromAmtEl.value) || 0;
  const fromCur = document.getElementById('convFromCur').value;
  const toCur = document.getElementById('convToCur').value;
  const rub = toRub(fromAmt, fromCur);
  const result = fromRub(rub, toCur);
  const out = document.getElementById('convToAmt');
  if (out) out.value = (Math.round(result * 100) / 100).toString();
  const hint = document.getElementById('convHint');
  if (hint) hint.textContent = `1 EUR = ${EUR_RUB.toFixed(2)} ₽ · 1 USD = ${USD_RUB.toFixed(2)} ₽`;
}
function setupConverter() {
  const fromAmt = document.getElementById('convFromAmt');
  const fromCur = document.getElementById('convFromCur');
  const toCur = document.getElementById('convToCur');
  const swap = document.getElementById('convSwap');
  if (!fromAmt) return;
  ['input', 'change'].forEach(ev => {
    fromAmt.addEventListener(ev, runConvert);
    fromCur.addEventListener(ev, runConvert);
    toCur.addEventListener(ev, runConvert);
  });
  if (swap) swap.addEventListener('click', () => {
    const a = fromCur.value; fromCur.value = toCur.value; toCur.value = a;
    runConvert();
  });
  runConvert();
}

function getLivingValues() {
  const mid = (a, b) => (a + b) / 2;
  return [
    mid(800, 1500) * EUR_RUB / 1000,   // Италия
    mid(850, 1200) * EUR_RUB / 1000,   // Германия
    mid(500, 900) * EUR_RUB / 1000,    // Польша
    mid(500, 900) * EUR_RUB / 1000,    // Чехия
    mid(800, 1500) * USD_RUB / 1000,   // Аргентина
    mid(600, 1000) * EUR_RUB / 1000,   // Португалия
    mid(700, 1400) * EUR_RUB / 1000,   // Испания
    mid(1000, 1600) * EUR_RUB / 1000,  // Нидерланды
    mid(1200, 2000) * USD_RUB / 1000,  // США
    mid(400, 700) * USD_RUB / 1000     // Китай
  ];
}
function initLivingChart() {
  const canvas = document.getElementById('chartLiving');
  if (!canvas || typeof Chart === 'undefined' || livingChart) return;
  livingChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Италия', 'Германия', 'Польша', 'Чехия', 'Аргентина', 'Португалия', 'Испания', 'Нидерланды', 'США', 'Китай'],
      datasets: [{ data: getLivingValues(), backgroundColor: ['#0d7c6f', '#0a5c53', '#159c8c', '#e0a72e', '#c1560e', '#1a9c6b', '#b3790f', '#5e7d78', '#2d8f7a', '#d4881f'], borderRadius: 6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#5e7d78', font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: '#5e7d78', font: { size: 11 } }, grid: { color: 'rgba(15,43,40,0.06)' }, title: { display: true, text: 'тыс. ₽ / мес', color: '#5e7d78' } }
      }
    }
  });
}
function updateChartsData() {
  if (livingChart) { livingChart.data.datasets[0].data = getLivingValues(); livingChart.update(); }
}

function updateAllRub() {
  document.querySelectorAll('.rub').forEach(el => {
    const eurMin = el.dataset.eurMin, eurMax = el.dataset.eurMax;
    const usdMin = el.dataset.usdMin, usdMax = el.dataset.usdMax;
    const note = el.dataset.note;
    let text = '—';
    if (eurMin !== undefined) text = fmtRange(parseFloat(eurMin) * EUR_RUB, parseFloat(eurMax) * EUR_RUB);
    else if (usdMin !== undefined) text = fmtRange(parseFloat(usdMin) * USD_RUB, parseFloat(usdMax) * USD_RUB);
    if (note) text += ' (' + note + ')';
    el.textContent = text;
  });
  const note = document.getElementById('moneyRateNote');
  if (note) note.textContent = `(EUR ${EUR_RUB.toFixed(2)} ₽ · USD ${USD_RUB.toFixed(2)} ₽)`;
  updateChartsData();
  runConvert();
}

async function fetchFromCBR() {
  const res = await fetch('https://www.cbr-xml-daily.ru/daily_json.js');
  if (!res.ok) throw new Error('cbr-xml-daily failed');
  const data = await res.json();
  const eur = data.Valute && data.Valute.EUR && data.Valute.EUR.Value;
  const usd = data.Valute && data.Valute.USD && data.Valute.USD.Value;
  if (!eur || !usd) throw new Error('cbr-xml-daily no data');
  return { eur, usd, source: 'ЦБ РФ' };
}
async function fetchFromOpenEr() {
  const [eurRes, usdRes] = await Promise.all([
    fetch('https://open.er-api.com/v6/latest/EUR'),
    fetch('https://open.er-api.com/v6/latest/USD')
  ]);
  if (!eurRes.ok || !usdRes.ok) throw new Error('open.er-api failed');
  const eurData = await eurRes.json();
  const usdData = await usdRes.json();
  if (eurData.result !== 'success' || usdData.result !== 'success') throw new Error('open.er-api bad payload');
  return { eur: eurData.rates.RUB, usd: usdData.rates.RUB, source: 'open.er-api.com' };
}
async function fetchFromJsdelivr() {
  const [eurRes, usdRes] = await Promise.all([
    fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json'),
    fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json')
  ]);
  if (!eurRes.ok || !usdRes.ok) throw new Error('jsdelivr failed');
  const eurData = await eurRes.json();
  const usdData = await usdRes.json();
  const eur = eurData.eur && eurData.eur.rub;
  const usd = usdData.usd && usdData.usd.rub;
  if (!eur || !usd) throw new Error('jsdelivr no RUB');
  return { eur, usd, source: 'currency-api' };
}

async function fetchRates() {
  const btn = document.getElementById('refreshRates');
  const err = document.getElementById('ratesError');
  const updated = document.getElementById('ratesUpdated');
  const sourceEl = document.getElementById('ratesSource');
  if (btn) btn.disabled = true;
  if (err) err.style.display = 'none';
  if (updated) updated.textContent = 'Обновление…';
  if (sourceEl) sourceEl.textContent = '';

  const apis = [fetchFromCBR, fetchFromOpenEr, fetchFromJsdelivr];
  let ok = false;
  for (const api of apis) {
    try {
      const data = await api();
      EUR_RUB = data.eur; USD_RUB = data.usd;
      const rateEurEl = document.getElementById('rateEur');
      const rateUsdEl = document.getElementById('rateUsd');
      if (rateEurEl) rateEurEl.textContent = EUR_RUB.toFixed(2) + ' ₽';
      if (rateUsdEl) rateUsdEl.textContent = USD_RUB.toFixed(2) + ' ₽';
      const now = new Date();
      if (updated) updated.textContent = 'Обновлено: ' + now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      if (sourceEl) sourceEl.textContent = '· ' + data.source;
      updateAllRub();
      ok = true;
      break;
    } catch (e) { console.warn('FX API failed:', e.message); }
  }
  if (!ok) {
    if (err) { err.style.display = 'block'; err.textContent = 'Не удалось загрузить курс. Показаны запасные значения: EUR≈105 ₽, USD≈95 ₽.'; }
    const rateEurEl = document.getElementById('rateEur');
    const rateUsdEl = document.getElementById('rateUsd');
    if (rateEurEl) rateEurEl.textContent = EUR_RUB.toFixed(2) + ' ₽ *';
    if (rateUsdEl) rateUsdEl.textContent = USD_RUB.toFixed(2) + ' ₽ *';
    if (updated) updated.textContent = 'Запасной курс';
    updateAllRub();
  }
  if (document.getElementById('chartFx')) loadFxHistory().catch(e => console.warn('FX history:', e));
  if (btn) btn.disabled = false;
}

async function loadFxHistory() {
  const canvas = document.getElementById('chartFx');
  if (!canvas || typeof Chart === 'undefined') return;
  const fmt2 = n => String(n).padStart(2, '0');
  const cbrPath = d => `${d.getFullYear()}/${fmt2(d.getMonth() + 1)}/${fmt2(d.getDate())}`;
  const points = [];
  for (let i = 12; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i * 7); points.push(d); }

  let labels = [], eurSeries = [], usdSeries = [];
  try {
    const results = await Promise.all(points.map(d =>
      fetch(`https://www.cbr-xml-daily.ru/archive/${cbrPath(d)}/daily_json.js`).then(r => r.ok ? r.json() : null).catch(() => null)
    ));
    const valid = results.map((data, i) => ({ data, d: points[i] })).filter(x => x.data && x.data.Valute && x.data.Valute.EUR && x.data.Valute.USD);
    if (!valid.length) throw new Error('cbr archive empty');
    labels = valid.map(x => fmt2(x.d.getDate()) + '.' + fmt2(x.d.getMonth() + 1));
    eurSeries = valid.map(x => x.data.Valute.EUR.Value);
    usdSeries = valid.map(x => x.data.Valute.USD.Value);
  } catch (e1) {
    try {
      const iso = d => d.toISOString().slice(0, 10);
      const results = await Promise.all(points.map(d => Promise.all([
        fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${iso(d)}/v1/currencies/eur.json`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${iso(d)}/v1/currencies/usd.json`).then(r => r.ok ? r.json() : null).catch(() => null)
      ])));
      const valid = results.map(([e, u], i) => ({ e, u, d: points[i] })).filter(x => x.e && x.e.eur && x.e.eur.rub && x.u && x.u.usd && x.u.usd.rub);
      if (!valid.length) throw new Error('jsdelivr history empty');
      labels = valid.map(x => fmt2(x.d.getDate()) + '.' + fmt2(x.d.getMonth() + 1));
      eurSeries = valid.map(x => x.e.eur.rub);
      usdSeries = valid.map(x => x.u.usd.rub);
    } catch (e2) {
      labels = ['сейчас']; eurSeries = [EUR_RUB]; usdSeries = [USD_RUB];
    }
  }

  const grid = { color: 'rgba(15,43,40,0.06)' };
  const tick = { color: '#5e7d78', font: { size: 10 } };
  if (fxChart) {
    fxChart.data.labels = labels;
    fxChart.data.datasets[0].data = eurSeries;
    fxChart.data.datasets[1].data = usdSeries;
    fxChart.update();
    return;
  }
  fxChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'EUR → ₽', data: eurSeries, borderColor: '#0d7c6f', backgroundColor: 'rgba(13,124,111,0.12)', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.25, fill: true },
        { label: 'USD → ₽', data: usdSeries, borderColor: '#c1560e', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.25 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: true, labels: { color: '#5e7d78', boxWidth: 12, font: { size: 11 } } } },
      scales: { x: { ticks: { ...tick, maxTicksLimit: 8, maxRotation: 0 }, grid: { display: false } }, y: { ticks: tick, grid } }
    }
  });
}

document.addEventListener('DOMContentLoaded', function () {
  setupConverter();
  initLivingChart();
  fetchRates();
  setInterval(fetchRates, 30 * 60 * 1000);
});
