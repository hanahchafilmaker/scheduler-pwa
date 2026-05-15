// src/shared/utils/format.js

export function formatCurrency(value) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("ko-KR").format(num);
}

export function formatDate(date) {
  if (!date) return "-";

  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";

  return d.toISOString().split("T")[0];
}

export function formatDateTime(date) {
  if (!date) return "-";

  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";

  return d.toISOString().replace("T", " ").substring(0, 16);
}

export function formatTime(time) {
  if (!time) return "-";
  return String(time).slice(0, 5);
}

export function formatNumber(value) {
  const num = Number(value || 0);
  return num.toLocaleString();
}
export const fmtKRW = formatCurrency;

export function safeStr(v) { return v == null ? '' : String(v); }

