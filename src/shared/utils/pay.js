// src/shared/utils/pay.js
// UTF-8 — 한글 깨짐 주의
//
// 정산 원칙: attendance + approved=true 기준만 사용
//            schedule 기반 예상 정산 사용 금지

export function toMin(t) {
  const m = String(t || "").match(/(\d+):(\d+)/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

// check_in / check_out 은 attendance 실제 필드명
export function calcWorkMinutes(checkIn, checkOut, breakMin = 0) {
  if (!checkIn || !checkOut) return 0;
  const start = toMin(checkIn);
  let   end   = toMin(checkOut);
  if (end < start) end += 24 * 60;
  return Math.max(0, end - start - Math.max(0, Number(breakMin) || 0));
}

export function calcNightMinutes(checkIn, checkOut, breakMin = 0) {
  if (!checkIn || !checkOut) return 0;
  const start = toMin(checkIn);
  let   end   = toMin(checkOut);
  if (end < start) end += 24 * 60;
  const total = end - start;
  if (total <= 0) return 0;
  const overlap = Math.max(0, Math.min(end, 30 * 60) - Math.max(start, 22 * 60));
  if (overlap <= 0) return 0;
  const breakDeduction = (Number(breakMin) || 0) * (overlap / total);
  return Math.max(0, overlap - breakDeduction);
}

export function calcNightMinutesSimple(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const start      = toMin(checkIn);
  let   end        = toMin(checkOut);
  if (end < start) end += 24 * 60;
  const nightStart = 22 * 60;
  const nightEnd   = 29 * 60; // 익일 05:00
  return Math.max(0, Math.min(end, nightEnd) - Math.max(start, nightStart));
}

// approved=true 인 attendance 기준 급여
// schedule 기반 예상 정산 사용 금지
export function calcPay(checkIn, checkOut, breakMin, hourlyWage) {
  const workMin  = calcWorkMinutes(checkIn, checkOut, breakMin);
  const nightMin = calcNightMinutes(checkIn, checkOut, breakMin);
  const wage     = Number(hourlyWage) || 0;
  return Math.round((workMin / 60) * wage + (nightMin / 60) * wage * 0.5);
}
