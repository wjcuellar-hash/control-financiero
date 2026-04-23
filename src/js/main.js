import { mergeExternalBase, listSources, readFromSource } from './data-sources.js';
import { changeMonth, showTab, addItem, delItem, getCurrentPeriod, render } from './ui.js';

window.changeMonth = changeMonth;
window.showTab = showTab;
window.addItem = addItem;
window.delItem = delItem;

window.ControlFinanciero = {
  listSources,
  async read(sourceName, params = {}) {
    return readFromSource(sourceName, params);
  },
  importBase(records, options = {}) {
    const { year, month } = getCurrentPeriod();
    mergeExternalBase({
      year,
      month,
      records,
      fallbackType: options.fallbackType || 'expense'
    });
    render();
  },
  refreshFlash() {
    render();
  }
};

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.target.tagName === 'INPUT') {
    const { activeTab } = getCurrentPeriod();
    if (activeTab === 'ingresos') addItem('incomes');
    if (activeTab === 'gastos') addItem('expenses');
  }
});

render();
