import { loadMonth, saveMonth } from './storage.js';
import { normalizeDataset } from './normalizers.js';

const sourceRegistry = new Map();

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
  return reader(params);
}

registerSource('localStorageMonth', async ({ year, month }) => loadMonth(year, month));

export function mergeExternalBase({ year, month, records, fallbackType = 'expense' }) {
  const monthData = loadMonth(year, month);
  const normalized = normalizeDataset(records, fallbackType);

  normalized.forEach((item) => {
    const bucket = item.type === 'incomes' ? 'incomes' : 'expenses';
    monthData[bucket].push({
      concepto: item.concepto,
      cat: item.cat,
      monto: item.monto,
      nota: item.nota,
      fecha: item.fecha
    });
  });

  saveMonth(year, month, monthData);
  return monthData;
}
