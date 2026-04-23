import { COLUMN_ALIASES } from './config.js';

function normalizedKeyMap(record = {}) {
  const mapped = {};
  Object.keys(record).forEach((key) => {
    mapped[key.toLowerCase().trim()] = record[key];
  });
  return mapped;
}

function findField(map, aliases) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(map, alias)) {
      return map[alias];
    }
  }
  return '';
}

export function normalizeRecord(record, fallbackType = 'expense') {
  const keyMap = normalizedKeyMap(record);
  const rawType = String(findField(keyMap, COLUMN_ALIASES.tipo) || fallbackType).toLowerCase();
  const type = rawType.includes('ing') || rawType.includes('income') ? 'incomes' : 'expenses';

  const rawAmount = findField(keyMap, COLUMN_ALIASES.monto);
  const amount = Number(String(rawAmount).replace(/[,$\s]/g, '').replace(',', '.'));

  return {
    type,
    concepto: String(findField(keyMap, COLUMN_ALIASES.concepto) || 'Sin concepto').trim(),
    cat: String(findField(keyMap, COLUMN_ALIASES.categoria) || 'Otro').trim(),
    monto: Number.isFinite(amount) ? amount : 0,
    nota: String(findField(keyMap, COLUMN_ALIASES.nota) || '').trim(),
    fecha: String(findField(keyMap, COLUMN_ALIASES.fecha) || new Date().toLocaleDateString('es-CO')).trim()
  };
}

export function normalizeDataset(records = [], fallbackType = 'expense') {
  return records
    .map((record) => normalizeRecord(record, fallbackType))
    .filter((row) => row.monto > 0);
}
