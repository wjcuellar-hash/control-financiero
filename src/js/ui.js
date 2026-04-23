import { EXPENSE_CATS, INCOME_CATS, MONTHS } from './config.js';
import { buildFlashUpdate, buildStrategy, expenseDistribution, margin, totalExpenses, totalIncomes } from './analytics.js';
import { loadMonth, saveMonth } from './storage.js';
import { renderCharts } from './charts.js';

let curYear = new Date().getFullYear();
let curMonth = new Date().getMonth();
let activeTab = 'resumen';

const fmt = (v) => {
  if (Math.abs(v) >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(0)}K`;
  return `$${Math.round(v).toLocaleString('es-CO')}`;
};

const fmtFull = (v) => `$${Math.round(v).toLocaleString('es-CO')}`;

function getData() {
  return loadMonth(curYear, curMonth);
}

function setData(data) {
  saveMonth(curYear, curMonth, data);
}

function renderResumen() {
  const data = getData();
  const incomes = totalIncomes(data);
  const expenses = totalExpenses(data);
  const utility = incomes - expenses;
  const netMargin = margin(data);
  const distribution = expenseDistribution(data).slice(0, 5);

  const mClass = utility >= 0 ? 'green' : 'red';
  const mBadge = utility >= 0 ? 'badge-green' : 'badge-red';
  const marginBadge = netMargin >= 30 ? 'badge-green' : netMargin >= 10 ? 'badge-amber' : 'badge-red';
  const marginLabel = netMargin >= 30 ? 'Saludable' : netMargin >= 10 ? 'Moderado' : 'Riesgo';

  let alertHTML = '';
  if (incomes === 0 && expenses === 0) alertHTML = '<div class="alert alert-amber">Sin registros este mes. Ve a Ingresos o Gastos para agregar.</div>';
  else if (utility < 0) alertHTML = `<div class="alert alert-red">Los gastos superan los ingresos en ${fmtFull(Math.abs(utility))}.</div>`;
  else if (netMargin < 15) alertHTML = `<div class="alert alert-amber">Margen bajo (${netMargin.toFixed(1)}%). Revisa los gastos variables.</div>`;
  else alertHTML = `<div class="alert alert-green">Margen ${netMargin.toFixed(1)}% — finanzas estables este mes.</div>`;

  const bars = distribution
    .map(({ cat, value }) => {
      const percent = incomes > 0 ? (value / incomes) * 100 : 0;
      const color = percent > 30 ? '#f06070' : percent > 15 ? '#f5a623' : '#2ecc8f';
      return `<div class="prog-item">
      <div class="prog-head"><span class="prog-label">${cat}</span><span class="prog-val">${fmt(value)} · ${percent.toFixed(1)}%</span></div>
      <div class="prog-track"><div class="prog-fill" style="width:${Math.min(percent, 100)}%;background:${color}"></div></div>
    </div>`;
    })
    .join('');

  document.getElementById('content').innerHTML = `
    <div class="metrics-row">
      <div class="metric-card">
        <div class="metric-label">Ingresos</div>
        <div class="metric-value green">${fmt(incomes)}</div>
        <span class="metric-badge badge-green">${data.incomes.length} registros</span>
      </div>
      <div class="metric-card">
        <div class="metric-label">Gastos</div>
        <div class="metric-value red">${fmt(expenses)}</div>
        <span class="metric-badge badge-red">${data.expenses.length} registros</span>
      </div>
      <div class="metric-card">
        <div class="metric-label">Utilidad neta</div>
        <div class="metric-value ${mClass}">${fmt(utility)}</div>
        <span class="metric-badge ${mBadge}">${utility >= 0 ? 'Ganancia' : 'Pérdida'}</span>
      </div>
      <div class="metric-card">
        <div class="metric-label">Margen neto</div>
        <div class="metric-value blue">${netMargin.toFixed(1)}%</div>
        <span class="metric-badge ${marginBadge}">${marginLabel}</span>
      </div>
    </div>
    ${alertHTML}
    <div class="chart-card">
      <div class="chart-title">Estrategia automática</div>
      <div style="font-size:13px;line-height:1.5;color:var(--text);">${buildStrategy(data)}</div>
      <div style="font-size:12px;margin-top:8px;color:var(--muted);">${buildFlashUpdate(data)}</div>
    </div>
    ${distribution.length ? `
    <div class="section-head"><span class="section-title">Distribución de gastos</span></div>
    <div class="chart-card"><div class="progress-list">${bars}</div></div>
    ` : ''}
  `;
}

function renderIngresos() {
  const data = getData();
  const incomes = totalIncomes(data);
  const list = data.incomes
    .slice()
    .reverse()
    .map((item, reverseIndex) => {
      const itemIndex = data.incomes.length - 1 - reverseIndex;
      const pct = incomes > 0 ? ((item.monto / incomes) * 100).toFixed(1) : '0';
      return `<div class="item-card">
      <button class="item-del" onclick="delItem('incomes',${itemIndex})">×</button>
      <div class="item-top">
        <div class="item-left">
          <div class="item-concepto">${item.concepto}</div>
          <div class="item-meta">${item.cat} · ${pct}% del total</div>
        </div>
        <div class="item-right">
          <div class="item-monto green">${fmtFull(item.monto)}</div>
        </div>
      </div>
      ${item.nota ? `<div class="item-note">📝 ${item.nota}</div>` : ''}
    </div>`;
    })
    .join('');

  document.getElementById('content').innerHTML = `
    <div class="add-form">
      <div class="type-toggle" style="display:block;margin-bottom:0;">
        <div style="font-size:13px;font-weight:700;color:var(--green);margin-bottom:12px;">+ Nuevo ingreso</div>
      </div>
      <div class="form-row">
        <div class="form-field"><label>Concepto</label><input id="i-con" placeholder="Ej: Venta producto X" autocomplete="off"/></div>
      </div>
      <div class="form-row">
        <div class="form-field"><label>Categoría</label><select id="i-cat">${INCOME_CATS.map((c) => `<option>${c}</option>`).join('')}</select></div>
        <div class="form-field"><label>Monto ($)</label><input id="i-mon" type="number" inputmode="numeric" placeholder="0" min="0"/></div>
      </div>
      <div class="form-row"><div class="form-field"><label>Nota (opcional)</label><textarea id="i-not" placeholder="Agrega detalles, cliente, referencia..."></textarea></div></div>
      <div class="form-row"><div class="form-field"><button class="btn-add income" onclick="addItem('incomes')">Guardar ingreso</button></div></div>
    </div>
    <div class="section-head"><span class="section-title">Registros — ${MONTHS[curMonth]}</span><span style="font-size:12px;color:var(--green);font-family:var(--mono);font-weight:600;">${fmtFull(incomes)}</span></div>
    ${data.incomes.length ? `<div class="items-list">${list}</div>` : '<div class="empty"><div class="empty-icon">💰</div>Sin ingresos registrados este mes.</div>'}
  `;
}

function renderGastos() {
  const data = getData();
  const expenses = totalExpenses(data);
  const list = data.expenses
    .slice()
    .reverse()
    .map((item, reverseIndex) => {
      const itemIndex = data.expenses.length - 1 - reverseIndex;
      const incomes = totalIncomes(data);
      const pct = incomes > 0 ? ((item.monto / incomes) * 100).toFixed(1) : '—';
      const impact = incomes > 0 ? (item.monto / incomes) * 100 : 0;
      const badge = impact > 30 ? 'badge-red' : impact > 15 ? 'badge-amber' : 'badge-green';
      const label = impact > 30 ? 'Alto' : impact > 15 ? 'Medio' : 'Bajo';
      return `<div class="item-card">
      <button class="item-del" onclick="delItem('expenses',${itemIndex})">×</button>
      <div class="item-top">
        <div class="item-left">
          <div class="item-concepto">${item.concepto}</div>
          <div class="item-meta">${item.cat} · <span class="metric-badge ${badge}" style="font-size:9px;padding:1px 6px;">${label}</span></div>
        </div>
        <div class="item-right">
          <div class="item-monto red">${fmtFull(item.monto)}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:2px;">${pct}% ingresos</div>
        </div>
      </div>
      ${item.nota ? `<div class="item-note">📝 ${item.nota}</div>` : ''}
    </div>`;
    })
    .join('');

  document.getElementById('content').innerHTML = `
    <div class="add-form">
      <div style="font-size:13px;font-weight:700;color:var(--red);margin-bottom:12px;">+ Nuevo gasto</div>
      <div class="form-row"><div class="form-field"><label>Concepto</label><input id="e-con" placeholder="Ej: Arriendo oficina" autocomplete="off"/></div></div>
      <div class="form-row">
        <div class="form-field"><label>Categoría</label><select id="e-cat">${EXPENSE_CATS.map((c) => `<option>${c}</option>`).join('')}</select></div>
        <div class="form-field"><label>Monto ($)</label><input id="e-mon" type="number" inputmode="numeric" placeholder="0" min="0"/></div>
      </div>
      <div class="form-row"><div class="form-field"><label>Nota (opcional)</label><textarea id="e-not" placeholder="Proveedor, factura, observación..."></textarea></div></div>
      <div class="form-row"><div class="form-field"><button class="btn-add expense" onclick="addItem('expenses')">Guardar gasto</button></div></div>
    </div>
    <div class="section-head"><span class="section-title">Registros — ${MONTHS[curMonth]}</span><span style="font-size:12px;color:var(--red);font-family:var(--mono);font-weight:600;">${fmtFull(expenses)}</span></div>
    ${data.expenses.length ? `<div class="items-list">${list}</div>` : '<div class="empty"><div class="empty-icon">📋</div>Sin gastos registrados este mes.</div>'}
  `;
}

function renderGraficas() {
  const data = getData();
  document.getElementById('content').innerHTML = `
    <div class="chart-card">
      <div class="chart-title">Ingresos vs Gastos</div>
      <div class="chart-legend">
        <div class="legend-item"><div class="legend-dot" style="background:#2ecc8f"></div>Ingresos</div>
        <div class="legend-item"><div class="legend-dot" style="background:#f06070"></div>Gastos</div>
        <div class="legend-item"><div class="legend-dot" style="background:#5b8dee"></div>Utilidad</div>
      </div>
      <div class="chart-wrap" style="height:220px;"><canvas id="chart1"></canvas></div>
    </div>
    <div class="chart-card"><div class="chart-title">Distribución de gastos por categoría</div><div class="chart-wrap" style="height:220px;"><canvas id="chart2"></canvas></div></div>
  `;

  renderCharts(data, fmt, fmtFull);
}

function renderAnual() {
  let rows = '';
  let sumI = 0;
  let sumE = 0;

  MONTHS.forEach((monthName, monthIndex) => {
    const data = loadMonth(curYear, monthIndex);
    const incomes = totalIncomes(data);
    const expenses = totalExpenses(data);
    const utility = incomes - expenses;
    const mg = incomes > 0 ? (utility / incomes) * 100 : 0;
    sumI += incomes;
    sumE += expenses;

    const active = monthIndex === curMonth ? 'style="background:rgba(46,204,143,0.06)"' : '';
    rows += `<tr ${active}><td>${monthName.substring(0, 3)}</td><td class="td-g">${fmt(incomes)}</td><td class="td-r">${fmt(expenses)}</td><td class="${utility >= 0 ? 'td-g' : 'td-r'}">${fmt(utility)}</td><td class="td-m">${incomes > 0 ? mg.toFixed(0) + '%' : '—'}</td></tr>`;
  });

  const sumUtility = sumI - sumE;
  const sumMg = sumI > 0 ? (sumUtility / sumI) * 100 : 0;

  document.getElementById('content').innerHTML = `
    <div class="section-head"><span class="section-title">Resumen ${curYear}</span></div>
    <div class="metrics-row">
      <div class="metric-card"><div class="metric-label">Total ingresos</div><div class="metric-value green">${fmt(sumI)}</div></div>
      <div class="metric-card"><div class="metric-label">Total gastos</div><div class="metric-value red">${fmt(sumE)}</div></div>
      <div class="metric-card"><div class="metric-label">Utilidad anual</div><div class="metric-value ${sumUtility >= 0 ? 'green' : 'red'}">${fmt(sumUtility)}</div></div>
      <div class="metric-card"><div class="metric-label">Margen promedio</div><div class="metric-value blue">${sumMg.toFixed(1)}%</div></div>
    </div>
    <div class="chart-card" style="overflow-x:auto;"><table class="year-table"><thead><tr><th>Mes</th><th>Ingresos</th><th>Gastos</th><th>Utilidad</th><th>Margen</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div style="font-size:11px;color:var(--muted);text-align:center;margin-top:8px;">Mes actual resaltado en verde · Toca un mes en el selector para ver detalle</div>
  `;
}

const renderByTab = {
  resumen: renderResumen,
  ingresos: renderIngresos,
  gastos: renderGastos,
  graficas: renderGraficas,
  anual: renderAnual
};

export function render() {
  document.getElementById('month-label').textContent = `${MONTHS[curMonth]} ${curYear}`;
  const renderer = renderByTab[activeTab];
  if (renderer) renderer();
}

export function changeMonth(direction) {
  curMonth += direction;
  if (curMonth > 11) {
    curMonth = 0;
    curYear += 1;
  }
  if (curMonth < 0) {
    curMonth = 11;
    curYear -= 1;
  }
  render();
}

export function showTab(tab, element) {
  activeTab = tab;
  document.querySelectorAll('.nav-tab').forEach((t) => t.classList.remove('active'));
  if (element) element.classList.add('active');
  render();
}

export function addItem(type) {
  const isIncome = type === 'incomes';
  const concept = document.getElementById(isIncome ? 'i-con' : 'e-con').value.trim();
  const cat = document.getElementById(isIncome ? 'i-cat' : 'e-cat').value;
  const amount = parseFloat(document.getElementById(isIncome ? 'i-mon' : 'e-mon').value);
  const note = document.getElementById(isIncome ? 'i-not' : 'e-not').value.trim();

  if (!concept) return alert('Agrega un concepto.');
  if (Number.isNaN(amount) || amount <= 0) return alert('Agrega un monto válido.');

  const data = getData();
  data[type].push({ concepto: concept, cat, monto: amount, nota: note, fecha: new Date().toLocaleDateString('es-CO') });
  setData(data);
  render();
}

export function delItem(type, index) {
  if (!confirm('¿Eliminar este registro?')) return;
  const data = getData();
  data[type].splice(index, 1);
  setData(data);
  render();
}

export function getCurrentPeriod() {
  return { year: curYear, month: curMonth, activeTab };
}
