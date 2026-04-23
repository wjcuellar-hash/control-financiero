const DAY_IN_MS = 24 * 60 * 60 * 1000;

const PRIORITY_BASES = {
  P0: 'P0',
  P1: 'P1',
  P2: 'P2',
  P3: 'P3',
  PB: 'PB'
};

function normalizeText(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parseNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(String(value).replace(/[^0-9,.-]/g, '').replace(/\.(?=.*\.)/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct;

  const match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  let year = Number(match[3]);
  if (year < 100) year += 2000;
  const dt = new Date(year, month, day);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function daysAgo(date) {
  if (!date) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - date.getTime()) / DAY_IN_MS);
}

function buildIdentity(row, index) {
  return row.standard?.npr || row.standard?.nit || `row_${index + 1}`;
}

function hasPhone(record) {
  return Boolean(record.telefono && String(record.telefono).trim());
}

function hasEmail(record) {
  return Boolean(record.email && String(record.email).trim());
}

function applyPriorityRules(record) {
  const reasons = [];
  let points = 0;

  const score = parseNumber(record.score, 0);
  const capital = parseNumber(record.saldo_capital, 0);
  const daysPastDue = parseNumber(record.dias_mora, 0);
  const bucket = normalizeText(record.bucket);
  const semaforo = normalizeText(record.semaforo);
  const bankStrategy = normalizeText(record.estrategia);
  const authorizedChannel = normalizeText(record.canal_autorizado);

  if (score > 0) {
    if (score <= 350) {
      points += 30;
      reasons.push('score crítico');
    } else if (score <= 550) {
      points += 20;
      reasons.push('score medio');
    } else {
      points += 8;
    }
  }

  if (capital >= 50000000) {
    points += 28;
    reasons.push('saldo alto');
  } else if (capital >= 15000000) {
    points += 20;
    reasons.push('saldo relevante');
  } else if (capital >= 5000000) {
    points += 12;
  }

  if (daysPastDue >= 180) {
    points += 25;
    reasons.push('mora severa');
  } else if (daysPastDue >= 90) {
    points += 16;
    reasons.push('mora alta');
  } else if (daysPastDue >= 30) {
    points += 8;
  }

  if (/castigad|judicial|prejuridic/.test(bucket)) {
    points += 18;
    reasons.push('bucket exigente');
  } else if (/b[4-9]|alto|critico/.test(bucket)) {
    points += 10;
  }

  if (semaforo.includes('rojo')) {
    points += 18;
    reasons.push('semaforo rojo');
  } else if (semaforo.includes('amarillo')) {
    points += 8;
  }

  if (record.pago_reciente) {
    points -= 18;
    reasons.push('pago reciente');
  }

  if (record.compromiso_activo) {
    points -= 12;
    reasons.push('compromiso activo');
  }

  if (authorizedChannel.includes('no contactar') || authorizedChannel.includes('ninguno')) {
    return {
      priority: PRIORITY_BASES.PB,
      score: points,
      reasons: ['sin canal autorizado']
    };
  }

  if (bankStrategy.includes('manual') || bankStrategy.includes('especial')) {
    return {
      priority: PRIORITY_BASES.PB,
      score: points,
      reasons: ['estrategia especial del banco']
    };
  }

  let priority = PRIORITY_BASES.P3;
  if (points >= 75) priority = PRIORITY_BASES.P0;
  else if (points >= 55) priority = PRIORITY_BASES.P1;
  else if (points >= 35) priority = PRIORITY_BASES.P2;

  return {
    priority,
    score: points,
    reasons
  };
}

function selectChannel(record, priority) {
  const reasons = [];
  const authorized = normalizeText(record.canal_autorizado);
  const strategy = normalizeText(record.estrategia);

  const allow = {
    marcador: authorized === '' || /telefon|llamad|marcador/.test(authorized),
    whatsapp: authorized === '' || /whats|digital/.test(authorized),
    sms: authorized === '' || /sms|texto/.test(authorized),
    email: authorized === '' || /mail|correo|email/.test(authorized),
    blaster: authorized === '' || /blaster|bot|ivr|voz/.test(authorized)
  };

  if (priority === PRIORITY_BASES.PB) {
    reasons.push('caso reservado a gestión manual');
    return { channel: 'Manual', reasons };
  }

  if (!hasPhone(record) && !hasEmail(record)) {
    reasons.push('sin datos de contacto válidos');
    return { channel: 'Manual', reasons };
  }

  if (strategy.includes('blaster') && allow.blaster && hasPhone(record)) {
    reasons.push('estrategia banco orientada a blaster');
    return { channel: 'Blaster', reasons };
  }

  if ((priority === PRIORITY_BASES.P0 || priority === PRIORITY_BASES.P1) && allow.marcador && hasPhone(record)) {
    reasons.push('prioridad alta con teléfono disponible');
    return { channel: 'Marcador', reasons };
  }

  if (record.pago_reciente && allow.whatsapp && hasPhone(record)) {
    reasons.push('continuidad digital por pago reciente');
    return { channel: 'WhatsApp', reasons };
  }

  if (record.compromiso_activo && allow.sms && hasPhone(record)) {
    reasons.push('recordatorio por compromiso activo');
    return { channel: 'SMS', reasons };
  }

  if (allow.whatsapp && hasPhone(record)) {
    reasons.push('canal digital con mayor tasa de contacto');
    return { channel: 'WhatsApp', reasons };
  }

  if (allow.email && hasEmail(record)) {
    reasons.push('email autorizado y disponible');
    return { channel: 'Email', reasons };
  }

  if (allow.sms && hasPhone(record)) {
    reasons.push('fallback a sms');
    return { channel: 'SMS', reasons };
  }

  if (allow.blaster && hasPhone(record)) {
    reasons.push('fallback automatizado de voz');
    return { channel: 'Blaster', reasons };
  }

  reasons.push('sin canal aplicable por autorización');
  return { channel: 'Manual', reasons };
}

function addRecordData(target, row, datasetType) {
  const standard = row.standard || {};
  const paymentDate = parseDate(standard.fecha_pago);
  const paymentValue = parseNumber(standard.valor_pago, 0);

  target.npr = target.npr || standard.npr || '';
  target.nit = target.nit || standard.nit || '';
  target.nombre = target.nombre || standard.nombre || row.concepto || 'Sin nombre';
  target.bucket = target.bucket || standard.bucket || '';
  target.saldo_capital = target.saldo_capital || parseNumber(standard.saldo_capital, row.monto);
  target.dias_mora = target.dias_mora || parseNumber(standard.dias_mora, 0);
  target.telefono = target.telefono || standard.telefono || '';
  target.email = target.email || standard.email || '';
  target.semaforo = target.semaforo || standard.semaforo || '';
  target.canal_autorizado = target.canal_autorizado || standard.canal_autorizado || '';
  target.estrategia = target.estrategia || standard.estrategia || '';
  target.score = target.score || parseNumber(standard.score, 0);

  if (datasetType === 'pagos' || paymentValue > 0) {
    target.valor_pago_acumulado += paymentValue;
    target.ultimo_pago = !target.ultimo_pago || (paymentDate && paymentDate > target.ultimo_pago) ? paymentDate || target.ultimo_pago : target.ultimo_pago;
  }

  if (datasetType === 'compromisos') {
    target.compromiso_activo = true;
  }

  if (/compromiso|promesa/.test(normalizeText(row.concepto)) || /compromiso|promesa/.test(normalizeText(row.nota))) {
    target.compromiso_activo = true;
  }
}

function summarizeByField(rows, field) {
  return rows.reduce((acc, row) => {
    const key = row[field] || 'Sin definir';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function buildOutputBases(records) {
  return {
    base_priorizada_general: records,
    base_marcador: records.filter((item) => item.canal_sugerido === 'Marcador'),
    base_whatsapp: records.filter((item) => item.canal_sugerido === 'WhatsApp'),
    base_sms: records.filter((item) => item.canal_sugerido === 'SMS'),
    base_email: records.filter((item) => item.canal_sugerido === 'Email'),
    base_blaster: records.filter((item) => item.canal_sugerido === 'Blaster'),
    base_manual: records.filter((item) => item.canal_sugerido === 'Manual')
  };
}

export function generateStrategyEngineResult(normalizedDatasets = []) {
  const portfolioMap = new Map();

  normalizedDatasets.forEach((dataset) => {
    dataset.rows.forEach((row, index) => {
      const identity = buildIdentity(row, index);
      if (!portfolioMap.has(identity)) {
        portfolioMap.set(identity, {
          id_registro: identity,
          npr: '',
          nit: '',
          nombre: '',
          bucket: '',
          saldo_capital: 0,
          dias_mora: 0,
          semaforo: '',
          telefono: '',
          email: '',
          canal_autorizado: '',
          estrategia: '',
          score: 0,
          valor_pago_acumulado: 0,
          ultimo_pago: null,
          compromiso_activo: false,
          pago_reciente: false
        });
      }

      addRecordData(portfolioMap.get(identity), row, dataset.meta.detectedType);
    });
  });

  const prioritizedRecords = [...portfolioMap.values()].map((record) => {
    const lastPaymentDays = daysAgo(record.ultimo_pago);
    record.pago_reciente = lastPaymentDays <= 45;

    const priorityResult = applyPriorityRules(record);
    const channelResult = selectChannel(record, priorityResult.priority);

    const justification = [...priorityResult.reasons.slice(0, 2), ...channelResult.reasons.slice(0, 1)].filter(Boolean).join('; ');

    return {
      ...record,
      ultimo_pago: record.ultimo_pago ? record.ultimo_pago.toISOString().slice(0, 10) : '',
      prioridad: priorityResult.priority,
      canal_sugerido: channelResult.channel,
      puntaje_priorizacion: priorityResult.score,
      justificacion: justification || 'priorización base por reglas generales'
    };
  });

  prioritizedRecords.sort((a, b) => {
    const order = { P0: 0, P1: 1, P2: 2, P3: 3, PB: 4 };
    return order[a.prioridad] - order[b.prioridad] || b.puntaje_priorizacion - a.puntaje_priorizacion;
  });

  const outputs = buildOutputBases(prioritizedRecords);
  const summary = {
    totalRegistros: prioritizedRecords.length,
    porPrioridad: summarizeByField(prioritizedRecords, 'prioridad'),
    porCanal: summarizeByField(prioritizedRecords, 'canal_sugerido')
  };

  return {
    generatedAt: new Date().toISOString(),
    summary,
    outputs
  };
}

export function toCsv(rows = []) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value) => {
    const raw = value === null || value === undefined ? '' : String(value);
    const safe = raw.replace(/"/g, '""');
    return /[",\n]/.test(safe) ? `"${safe}"` : safe;
  };

  const lines = [headers.join(',')];
  rows.forEach((row) => {
    lines.push(headers.map((header) => escape(row[header])).join(','));
  });

  return lines.join('\n');
}
