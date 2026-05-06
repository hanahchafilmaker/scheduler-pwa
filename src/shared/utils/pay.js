export function toMin(t) {
  const m = String(t || "").match(/(\d+):(\d+)/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function calcWorkMinutes(checkIn, checkOut, breakMin = 0) {
  if (!checkIn || !checkOut) return 0;

  const start = toMin(checkIn);
  let end = toMin(checkOut);

  if (end < start) end += 24 * 60;

  return Math.max(0, end - start - Math.max(0, Number(breakMin) || 0));
}

export function calcNightMinutes(checkIn, checkOut, breakMin = 0) {
  if (!checkIn || !checkOut) return 0;

  const start = toMin(checkIn);
  let end = toMin(checkOut);

  if (end < start) end += 24 * 60;

  const total = end - start;
  if (total <= 0) return 0;

  const overlap = Math.max(
    0,
    Math.min(end, 30 * 60) - Math.max(start, 22 * 60)
  );

  if (overlap <= 0) return 0;

  // break_min을 야간시간 비율만큼 비례 차감
  const breakDeduction = (Number(breakMin) || 0) * (overlap / total);

  return Math.max(0, overlap - breakDeduction);
}

// admin/App.jsx에 중복 정의되어 있던 calcNightMinutes 단순 버전 통합
// (break_min 미고려 버전 — 하위 호환용)
export function calcNightMinutesSimple(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;

  const start = toMin(checkIn);
  let end = toMin(checkOut);

  if (end < start) end += 24 * 60;

  const nightStart = 22 * 60;
  const nightEnd = 29 * 60; // 익일 05:00

  const overlapStart = Math.max(start, nightStart);
  const overlapEnd = Math.min(end, nightEnd);

  return Math.max(0, overlapEnd - overlapStart);
}

export function calcPay(checkIn, checkOut, breakMin, hourlyWage) {
  const workMin = calcWorkMinutes(checkIn, checkOut, breakMin);
  const nightMin = calcNightMinutes(checkIn, checkOut, breakMin);
  const wage = Number(hourlyWage) || 0;

  return Math.round((workMin / 60) * wage + (nightMin / 60) * wage * 0.5);
}
