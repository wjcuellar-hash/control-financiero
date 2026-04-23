const VALID_EXTENSIONS = new Set(['csv', 'xlsx', 'xls', 'txt']);

function getExtension(fileName = '') {
  const parts = String(fileName).toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() : '';
}

function isValidFile(fileName = '') {
  return VALID_EXTENSIONS.has(getExtension(fileName));
}

function normalizeValue(value = '') {
  return String(value ?? '').trim();
}

function parseDelimitedText(content = '') {
  const rows = String(content)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => line.trim());

  if (!rows.length) return [];

  const firstLine = rows[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ';' : ',';

  const parseLine = (line) => {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];

      if (char === '"') {
        const nextChar = line[index + 1];
        if (inQuotes && nextChar === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current);
    return values.map((value) => normalizeValue(value));
  };

  const headers = parseLine(rows[0]);

  return rows.slice(1).map((line) => {
    const values = parseLine(line);
    return headers.reduce((record, header, idx) => {
      if (!header) return record;
      record[header] = values[idx] || '';
      return record;
    }, {});
  });
}

function ensureSheetJs() {
  if (window.XLSX) return Promise.resolve(window.XLSX);

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    script.async = true;
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error('No fue posible cargar parser de Excel (XLSX).'));
    document.head.appendChild(script);
  });
}

async function parseExcelFile(file) {
  const XLSX = await ensureSheetJs();
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return [];
  return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: '' });
}

async function parseFile(file) {
  const extension = getExtension(file.name);

  if (extension === 'csv' || extension === 'txt') {
    const text = await file.text();
    return parseDelimitedText(text);
  }

  if (extension === 'xlsx' || extension === 'xls') {
    return parseExcelFile(file);
  }

  return [];
}

export async function readFolderFiles({ onLog = () => {} } = {}) {
  if (!window.showDirectoryPicker) {
    throw new Error('Tu navegador no soporta File System Access API. Usa Chrome, Edge o Arc actualizado.');
  }

  const dirHandle = await window.showDirectoryPicker();
  const detected = [];

  // eslint-disable-next-line no-restricted-syntax
  for await (const entry of dirHandle.values()) {
    if (entry.kind !== 'file') continue;

    const extension = getExtension(entry.name);
    const valid = isValidFile(entry.name);
    detected.push({
      name: entry.name,
      extension,
      valid,
      handle: entry
    });
  }

  onLog(`Archivos detectados en carpeta: ${detected.length}`);

  const validFiles = detected.filter((entry) => entry.valid);
  const invalidFiles = detected.filter((entry) => !entry.valid);

  if (invalidFiles.length) {
    onLog(`Archivos ignorados por extensión: ${invalidFiles.map((file) => file.name).join(', ')}`, 'warn');
  }

  const files = [];

  for (const entry of validFiles) {
    try {
      onLog(`Leyendo archivo: ${entry.name}`);
      const file = await entry.handle.getFile();
      const records = await parseFile(file);
      files.push({ fileName: file.name, records });
      onLog(`Archivo leído: ${entry.name} (${records.length} filas)`);
    } catch (error) {
      onLog(`Error leyendo ${entry.name}: ${error.message}`, 'error');
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return {
    detected,
    files
  };
}
