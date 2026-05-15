// src/shared/utils/date.js

export function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function toISODate(value) {
  const d = toDate(value);
  if (!d) return null;
  return d.toISOString().split("T")[0];
}

export function getToday() {
  return new Date().toISOString().split("T")[0];
}

export function addDays(date, days) {
  const d = toDate(date);
  if (!d) return null;

  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

export function diffDays(start, end) {
  const s = toDate(start);
  const e = toDate(end);
  if (!s || !e) return 0;

  const diff = e.getTime() - s.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function isValidDate(value) {
  return toDate(value) !== null;
}
