import { mergeExternalBase, mergeExternalBases, listSources, readFromSource } from './data-sources.js';
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
    const result = mergeExternalBase({
      year,
      month,
      records,
      fileName: options.fileName || 'manual_import',
      fallbackType: options.fallbackType || 'expense'
    });
    render();
    return result.importLog;
  },
  importBases(files, options = {}) {
    const { year, month } = getCurrentPeriod();
    const result = mergeExternalBases({
      year,
      month,
      files,
      fallbackType: options.fallbackType || 'expense'
    });
    render();
    return result.importLog;
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
