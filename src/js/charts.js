import { expenseDistribution, totalExpenses, totalIncomes } from './analytics.js';

let chartInst = null;
let chartInst2 = null;

export function renderCharts(data, fmt, fmtFull) {
  const incomes = totalIncomes(data);
  const expenses = totalExpenses(data);
  const c1 = document.getElementById('chart1');

  if (c1) {
    if (chartInst) {
      chartInst.destroy();
      chartInst = null;
    }

    chartInst = new Chart(c1, {
      type: 'bar',
      data: {
        labels: ['Ingresos', 'Gastos', 'Utilidad'],
        datasets: [{
          data: [incomes, expenses, incomes - expenses],
          backgroundColor: ['rgba(46,204,143,0.7)', 'rgba(240,96,112,0.7)', incomes - expenses >= 0 ? 'rgba(91,141,238,0.7)' : 'rgba(240,96,112,0.5)'],
          borderColor: ['#2ecc8f', '#f06070', incomes - expenses >= 0 ? '#5b8dee' : '#f06070'],
          borderWidth: 1,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7a7f9a', font: { size: 11 } } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7a7f9a', font: { size: 10 }, callback: (v) => fmt(v) } }
        }
      }
    });
  }

  const distribution = expenseDistribution(data);
  const labels = distribution.map(({ cat }) => cat);
  const values = distribution.map(({ value }) => value);
  const colors = ['#f06070', '#f5a623', '#5b8dee', '#2ecc8f', '#b07fd4', '#5ecce0', '#f0a060', '#60c0f0'];
  const c2 = document.getElementById('chart2');

  if (c2 && labels.length > 0) {
    if (chartInst2) {
      chartInst2.destroy();
      chartInst2 = null;
    }

    chartInst2 = new Chart(c2, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length), borderWidth: 0, hoverOffset: 6 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#7a7f9a', font: { size: 11 }, padding: 12, boxWidth: 10, boxHeight: 10 } },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${fmtFull(ctx.raw)}` } }
        },
        cutout: '65%'
      }
    });
  }
}
