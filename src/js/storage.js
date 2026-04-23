import { DEFAULT_STORAGE_PREFIX } from './config.js';

export function keyForMonth(year, month) {
  return `${DEFAULT_STORAGE_PREFIX}_${year}_${month}`;
}

export function emptyMonthData() {
  return { incomes: [], expenses: [] };
}

export function loadMonth(year, month) {
  try {
    const raw = localStorage.getItem(keyForMonth(year, month));
    return raw ? JSON.parse(raw) : emptyMonthData();
  } catch (error) {
    return emptyMonthData();
  }
}

export function saveMonth(year, month, data) {
  localStorage.setItem(keyForMonth(year, month), JSON.stringify(data));
}
