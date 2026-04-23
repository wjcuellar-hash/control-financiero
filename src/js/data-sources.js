import { loadMonth, saveMonth } from './storage.js';
import { normalizeDataset } from './normalizers.js';
import { generateStrategyEngineResult } from './strategy-engine.js';

const sourceRegistry = new Map();

function logImport(meta, level = 'info') {
  const logger = console[level] || console.info;
  logger(`[Importador] archivo=${meta.fileName} tipo=${meta.detectedType} confianza=${meta.confidence}`);
  logger(`[Importador] columnas reconocidas: ${meta.recognizedColumns.join(', ') || 'ninguna'}`);
  logger(`[Importador] columnas no mapeadas: ${meta.unmappedColumns.join(', ') || 'ninguna'}`);
  logger(`[Importador] cobertura cruce IDs: ${meta.crossCoverage}%`);
}

function getRecordIdentity(record = {}) {
  return record.standard?.npr || record.standard?.nit || '';
}

function buildCrossCoverageReport(normalizedSets = []) {
  const ownerById = new Map();

  normalizedSets.forEach(({ meta, rows }) => {
    rows.forEach((row) => {
      const id = getRecordIdentity(row);
      if (!id) return;
      if (!ownerById.has(id)) ownerById.set(id, new Set());
      ownerById.get(id).add(meta.detectedType);
    });
  });

  const ids = [...ownerById.values()];
  const intersected = ids.filter((types) => types.size > 1).length;
  const total = ids.length;

  return {
    uniqueIds: total,
    crossedIds: intersected,
    coverage: total ? Number(((intersected / total) * 100).toFixed(1)) : 0
  };
}

export function registerSource(name, reader) {
  sourceRegistry.set(name, reader);
}

export function listSources() {
  return [...sourceRegistry.keys()];
}

export async function readFromSource(name, params) {
  const reader = sourceRegistry.get(name);
  if (!reader) {
    throw new Error(`Fuente no registrada: ${name}`);
  }

  try {
    const payload = await reader(params);
    return payload;
  } catch (error) {
    console.error(`[Importador] error de lectura en fuente ${name}:`, error);
    throw error;
  }
}

registerSource('localStorageMonth', async ({ year, month }) => loadMonth(year, month));

registerSource('folderWatcher', async ({ files = [] } = {}) => {
  return files.map((file) => ({
    fileName: file.fileName || file.name || 'sin_nombre',
    records: file.records || []
  }));
});

registerSource('connectedFeed', async ({ feed = [] } = {}) => {
  return feed.map((entry, index) => ({
    fileName: entry.fileName || `feed_${index + 1}`,
    records: entry.records || []
  }));
});

export function mergeExternalBase({ year, month, records, fallbackType = 'expense', fileName = 'manual_import' }) {
  const monthData = loadMonth(year, month);

  const normalizedSet = normalizeDataset(records, { fallbackType, fileName });
  logImport(normalizedSet.meta);

  normalizedSet.rows.forEach((item) => {
    const bucket = item.type === 'incomes' ? 'incomes' : 'expenses';
    monthData[bucket].push({
      concepto: item.concepto,
      cat: item.cat,
      monto: item.monto,
      nota: item.nota,
      fecha: item.fecha
    });
  });

  const strategyEngine = generateStrategyEngineResult([normalizedSet]);
  monthData.strategyEngine = strategyEngine;

  saveMonth(year, month, monthData);

  return {
    monthData,
    importLog: {
      filesRead: [normalizedSet.meta.fileName],
      datasets: [normalizedSet.meta],
      globalCrossCoverage: {
        uniqueIds: normalizedSet.meta.totalRows,
        crossedIds: 0,
        coverage: normalizedSet.meta.crossCoverage
      },
      strategySummary: strategyEngine.summary
    }
  };
}

export function mergeExternalBases({ year, month, files = [], fallbackType = 'expense' }) {
  const monthData = loadMonth(year, month);
  const datasets = [];
  const filesRead = [];
  const errors = [];

  files.forEach((file) => {
    try {
      const normalizedSet = normalizeDataset(file.records || [], {
        fallbackType,
        fileName: file.fileName || file.name || 'sin_nombre'
      });

      datasets.push(normalizedSet);
      filesRead.push(normalizedSet.meta.fileName);
      logImport(normalizedSet.meta);

      normalizedSet.rows.forEach((item) => {
        const bucket = item.type === 'incomes' ? 'incomes' : 'expenses';
        monthData[bucket].push({
          concepto: item.concepto,
          cat: item.cat,
          monto: item.monto,
          nota: item.nota,
          fecha: item.fecha
        });
      });
    } catch (error) {
      const failedName = file.fileName || file.name || 'sin_nombre';
      const errorMessage = error?.message || String(error);
      console.error(`[Importador] error de lectura archivo=${failedName}:`, error);
      errors.push({ fileName: failedName, message: errorMessage });
    }
  });

  const globalCrossCoverage = buildCrossCoverageReport(datasets);
  const strategyEngine = generateStrategyEngineResult(datasets);
  monthData.strategyEngine = strategyEngine;
  saveMonth(year, month, monthData);
  console.info(`[Importador] cobertura global de cruce: ${globalCrossCoverage.coverage}% (${globalCrossCoverage.crossedIds}/${globalCrossCoverage.uniqueIds})`);
  console.info('[Importador] resumen prioridad:', strategyEngine.summary.porPrioridad);
  console.info('[Importador] resumen canal:', strategyEngine.summary.porCanal);

  return {
    monthData,
    importLog: {
      filesRead,
      datasets: datasets.map((dataset) => dataset.meta),
      globalCrossCoverage,
      errors,
      strategySummary: strategyEngine.summary
    }
  };
}
