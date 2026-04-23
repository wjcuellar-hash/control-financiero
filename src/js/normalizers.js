import { COLUMN_ALIASES, DATASET_TYPE_RULES, STANDARD_FIELDS } from './column-aliases.config.js';

function normalizeKey(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizedKeyMap(record = {}) {
  const mapped = {};
  Object.keys(record).forEach((key) => {
    mapped[normalizeKey(key)] = record[key];
  });
  return mapped;
}

function normalizeAliases() {
  return Object.entries(COLUMN_ALIASES).reduce((acc, [field, aliases]) => {
    acc[field] = aliases.map((alias) => normalizeKey(alias));
    return acc;
  }, {});
}

const NORMALIZED_ALIASES = normalizeAliases();

function findField(keyMap, aliases) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(keyMap, alias)) {
      return keyMap[alias];
    }
  }
  return '';
}

function mapToStandardSchema(record = {}) {
  const keyMap = normalizedKeyMap(record);
  const standardRecord = {};
  const recognizedColumns = [];

  STANDARD_FIELDS.forEach((field) => {
    const alias = NORMALIZED_ALIASES[field] || [];
    const value = findField(keyMap, alias);
    if (value !== '' && value !== null && value !== undefined) {
      standardRecord[field] = String(value).trim();
      recognizedColumns.push(field);
    }
  });

  const normalizedColumns = Object.keys(keyMap);
  const mappedAliases = new Set(
    Object.keys(NORMALIZED_ALIASES)
      .flatMap((field) => NORMALIZED_ALIASES[field])
  );

  const unmappedColumns = normalizedColumns.filter((column) => !mappedAliases.has(column));

  return {
    standardRecord,
    recognizedColumns,
    unmappedColumns
  };
}

function detectByHeaders(headers = []) {
  const normalizedHeaders = headers.map((header) => normalizeKey(header));
  const scores = Object.entries(DATASET_TYPE_RULES).reduce((acc, [type, keywords]) => {
    const normalizedKeywords = keywords.map((keyword) => normalizeKey(keyword));
    const score = normalizedKeywords.reduce((sum, keyword) => {
      const match = normalizedHeaders.some((header) => header.includes(keyword) || keyword.includes(header));
      return sum + (match ? 1 : 0);
    }, 0);
    acc[type] = score;
    return acc;
  }, {});

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (!best || best[1] === 0) return { detectedType: 'otras_fuentes', confidence: 0 };

  const [detectedType, score] = best;
  const maxSignals = DATASET_TYPE_RULES[detectedType].length;
  return { detectedType, confidence: Number((score / maxSignals).toFixed(2)) };
}

function detectByContent(sampleRecords = []) {
  const content = JSON.stringify(sampleRecords).toLowerCase();
  if (/pago|recaudo|abono/.test(content)) return 'pagos';
  if (/compromiso|promesa/.test(content)) return 'compromisos';
  if (/tipificacion|gestion|contacto/.test(content)) return 'gestiones';
  if (/departamento|ciudad|direccion/.test(content)) return 'demografico';
  if (/traslado|cedida|reasignacion/.test(content)) return 'traslados';
  if (/canal_autorizado|consentimiento|habeas/.test(content)) return 'canal_autorizado';
  if (/estrategia|campana|estrato/.test(content)) return 'estrategias';
  return 'otras_fuentes';
}

export function detectDatasetType({ fileName = '', records = [] } = {}) {
  const headers = records[0] ? Object.keys(records[0]) : [];
  const byHeaders = detectByHeaders(headers);
  const byContent = detectByContent(records.slice(0, 25));

  if (byHeaders.detectedType !== 'otras_fuentes') {
    return {
      type: byHeaders.detectedType,
      confidence: byHeaders.confidence,
      source: 'headers'
    };
  }

  if (byContent !== 'otras_fuentes') {
    return {
      type: byContent,
      confidence: 0.4,
      source: fileName ? `content:${fileName}` : 'content'
    };
  }

  return {
    type: 'otras_fuentes',
    confidence: 0,
    source: 'fallback'
  };
}

function parseAmount(value) {
  if (value === null || value === undefined || value === '') return 0;
  const amount = Number(String(value).replace(/[^0-9,.-]/g, '').replace(/\.(?=.*\.)/g, '').replace(',', '.'));
  return Number.isFinite(amount) ? amount : 0;
}

export function normalizeRecord(record, options = {}) {
  const { fallbackType = 'expense', datasetType = 'otras_fuentes' } = options;
  const keyMap = normalizedKeyMap(record);
  const { standardRecord, recognizedColumns, unmappedColumns } = mapToStandardSchema(record);

  const rawType = String(findField(keyMap, NORMALIZED_ALIASES.tipo) || fallbackType).toLowerCase();
  const inferredType = datasetType === 'pagos' ? 'incomes' : rawType.includes('ing') || rawType.includes('income') ? 'incomes' : 'expenses';

  const amountCandidate =
    standardRecord.valor_pago ||
    standardRecord.saldo_capital ||
    findField(keyMap, NORMALIZED_ALIASES.monto);

  const amount = parseAmount(amountCandidate);

  return {
    type: inferredType,
    concepto: String(
      findField(keyMap, NORMALIZED_ALIASES.concepto) ||
      standardRecord.nombre ||
      standardRecord.estrategia ||
      'Sin concepto'
    ).trim(),
    cat: String(findField(keyMap, NORMALIZED_ALIASES.categoria) || datasetType || 'Otro').trim(),
    monto: amount,
    nota: String(findField(keyMap, NORMALIZED_ALIASES.nota) || '').trim(),
    fecha: String(
      standardRecord.fecha_pago ||
      findField(keyMap, NORMALIZED_ALIASES.fecha) ||
      new Date().toLocaleDateString('es-CO')
    ).trim(),
    standard: standardRecord,
    recognizedColumns,
    unmappedColumns
  };
}

export function normalizeDataset(records = [], options = {}) {
  const detected = detectDatasetType({ fileName: options.fileName, records });
  const rows = records
    .map((record) => normalizeRecord(record, { ...options, datasetType: detected.type }))
    .filter((row) => row.monto > 0 || Object.keys(row.standard).length > 0);

  const recognizedColumns = [...new Set(rows.flatMap((row) => row.recognizedColumns))];
  const unmappedColumns = [...new Set(rows.flatMap((row) => row.unmappedColumns))];
  const identifiedRows = rows.filter((row) => row.standard.npr || row.standard.nit).length;
  const crossCoverage = rows.length ? Number(((identifiedRows / rows.length) * 100).toFixed(1)) : 0;

  return {
    rows,
    meta: {
      fileName: options.fileName || 'sin_nombre',
      detectedType: detected.type,
      detectionSource: detected.source,
      confidence: detected.confidence,
      totalRows: rows.length,
      recognizedColumns,
      unmappedColumns,
      crossCoverage
    }
  };
}
