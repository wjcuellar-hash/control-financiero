import { mergeExternalBase, mergeExternalBases, listSources, readFromSource } from './data-sources.js';
import {
  changeMonth,
  showTab,
  addItem,
  delItem,
  getCurrentPeriod,
  render,
  appendImportLog,
  clearImportLogs,
  setImportState
} from './ui.js';
import { readFolderFiles } from './folder-importer.js';

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

let importInProgress = false;

async function importFromFolder() {
  if (importInProgress) return;
  importInProgress = true;
  setImportState({ busy: true, lastSummary: '' });
  clearImportLogs();
  appendImportLog('Iniciando selección de carpeta…');

  try {
    const { year, month } = getCurrentPeriod();
    const { files, detected } = await readFolderFiles({
      onLog: appendImportLog
    });

    if (!detected.length) {
      appendImportLog('No se detectaron archivos en la carpeta.', 'warn');
      setImportState({ busy: false, lastSummary: 'No se encontraron archivos en la carpeta seleccionada.' });
      return;
    }

    if (!files.length) {
      appendImportLog('No se pudo leer ningún archivo válido.', 'warn');
      setImportState({ busy: false, lastSummary: 'Se detectaron archivos, pero no hubo archivos válidos para importar.' });
      return;
    }

    appendImportLog(`Procesando ${files.length} archivo(s) con normalización automática…`);
    const result = mergeExternalBases({
      year,
      month,
      files,
      fallbackType: 'expense'
    });

    result.importLog.datasets.forEach((dataset) => {
      appendImportLog(
        `Tipo detectado: ${dataset.fileName} → ${dataset.detectedType} (confianza ${dataset.confidence})`
      );
    });
    result.importLog.errors.forEach((entry) => {
      appendImportLog(`Error normalizando ${entry.fileName}: ${entry.message}`, 'error');
    });

    setImportState({
      busy: false,
      lastSummary: `Importación completada: ${result.importLog.filesRead.length} archivo(s), cobertura global ${result.importLog.globalCrossCoverage.coverage}%.`
    });
    appendImportLog('Importación finalizada correctamente.');
    render();
  } catch (error) {
    appendImportLog(`Error en importación de carpeta: ${error.message}`, 'error');
    setImportState({ busy: false, lastSummary: 'La importación falló. Revisa el log para más detalle.' });
  } finally {
    importInProgress = false;
    setImportState({ busy: false });
  }
}

document.addEventListener('click', (event) => {
  if (event.target && event.target.id === 'select-folder-btn') {
    importFromFolder();
  }
});

render();
