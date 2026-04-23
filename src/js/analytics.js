export const totalIncomes = (data) => data.incomes.reduce((sum, item) => sum + item.monto, 0);
export const totalExpenses = (data) => data.expenses.reduce((sum, item) => sum + item.monto, 0);

export function margin(data) {
  const incomes = totalIncomes(data);
  const expenses = totalExpenses(data);
  return incomes > 0 ? ((incomes - expenses) / incomes) * 100 : 0;
}

export function expenseDistribution(data) {
  const grouped = data.expenses.reduce((acc, item) => {
    acc[item.cat] = (acc[item.cat] || 0) + item.monto;
    return acc;
  }, {});

  return Object.entries(grouped)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, value]) => ({ cat, value }));
}

export function buildStrategy(data) {
  const incomes = totalIncomes(data);
  const expenses = totalExpenses(data);
  const utility = incomes - expenses;
  const netMargin = margin(data);
  const topExpense = expenseDistribution(data)[0];

  if (incomes === 0 && expenses === 0) {
    return 'Sin movimiento: define un objetivo base y registra al menos 3 transacciones para activar recomendaciones.';
  }

  if (utility < 0) {
    return `Prioridad: recortar ${topExpense?.cat || 'gastos'} y proteger caja semanal hasta cerrar brecha de ${Math.abs(utility).toFixed(0)}.`;
  }

  if (netMargin < 15) {
    return `Margen ajustado (${netMargin.toFixed(1)}%): limita ${topExpense?.cat || 'gastos variables'} y mueve 10% de ingresos a reserva.`;
  }

  return `Estrategia expansiva: margen ${netMargin.toFixed(1)}%, mantén disciplina y destina 15% de utilidad a crecimiento.`;
}

export function buildFlashUpdate(data) {
  const incomes = totalIncomes(data);
  const expenses = totalExpenses(data);
  const utility = incomes - expenses;
  const signal = utility >= 0 ? '🟢' : '🔴';
  return `${signal} Flash: ingresos ${incomes.toFixed(0)}, gastos ${expenses.toFixed(0)}, utilidad ${utility.toFixed(0)}.`;
}
