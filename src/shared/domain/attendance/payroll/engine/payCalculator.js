// payCalculator.js

function toMin(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h + m)) return null;
  return h * 60 + m;
}

//   (  ~  )
export function calcLateDeduct(plannedStart, checkIn) {
  const p = toMin(plannedStart);
  const c = toMin(checkIn);
  if (p == null || c == null) return 0;
  return Math.max(0, c - p);
}

//    (  ~  )
export function calcEarlyLeaveDeduct(plannedEnd, checkOut) {
  const p = toMin(plannedEnd);
  const c = toMin(checkOut);
  if (p == null || c == null) return 0;
  return Math.max(0, p - c);
}

//    (   )
export function calcExtraEarly(plannedStart, checkIn) {
  const p = toMin(plannedStart);
  const c = toMin(checkIn);
  if (p == null || c == null) return 0;
  return Math.max(0, p - c);
}

//   (   )
export function calcExtraLate(plannedEnd, checkOut) {
  const p = toMin(plannedEnd);
  const c = toMin(checkOut);
  if (p == null || c == null) return 0;
  return Math.max(0, c - p);
}


export function calcWorkMinutes(checkIn, checkOut, breakMin = 0) { const t = toMin(checkOut) - toMin(checkIn); return Math.max(0, t - (Number(breakMin) || 0)); }
