// ── Date helpers ──────────────────────────────────────────────────────────────

export function getDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function normalizeDate(v) {
  if (!v) return "";
  return getDateString(new Date(v));
}

export function getWeekDates(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return getDateString(d);
  });
}

export function getMonthRange(base = new Date()) {
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const end   = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return {
    start: getDateString(start),
    end:   getDateString(end),
    label: `${base.getFullYear()}년 ${base.getMonth() + 1}월`,
  };
}

// ── String / number helpers ───────────────────────────────────────────────────

export const safeStr = (v) => String(v || "").trim();

export function fmtKRW(n) {
  const safe = Number.isFinite(Number(n)) ? Math.round(Number(n)) : 0;
  return safe.toLocaleString("ko-KR") + "원";
}

// ── Time helpers ──────────────────────────────────────────────────────────────

export function toMin(t) {
  const m = String(t || "").match(/(\d+):(\d+)/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

export function formatTime(t) {
  if (!t) return "--";
  const m = String(t).match(/(\d+):(\d+)/);
  return m ? `${m[1].padStart(2, "0")}:${m[2].padStart(2, "0")}` : t;
}

// ── Work calculation helpers ──────────────────────────────────────────────────

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

  const nightStart = 22 * 60;
  const nightEnd   = 30 * 60;
  const overlap    = Math.max(0, Math.min(end, nightEnd) - Math.max(start, nightStart));
  const total      = Math.max(1, end - start);
  const br         = Math.max(0, Number(breakMin) || 0);
  return Math.max(0, overlap - br * (overlap / total));
}

// ── Attendance status ─────────────────────────────────────────────────────────

export function getStatus(scheduled, att) {
  if (!att?.check_in) return "예정";

  const planStart = toMin(scheduled.planned_start);
  let   planEnd   = toMin(scheduled.planned_end);
  if (planEnd < planStart) planEnd += 24 * 60;

  const realStart = toMin(att.check_in);
  let   realEnd   = att.check_out ? toMin(att.check_out) : null;
  if (realEnd !== null && realEnd < realStart) realEnd += 24 * 60;

  if (!att.check_out) {
    const n = new Date();
    let nowAdj = n.getHours() * 60 + n.getMinutes();
    if (nowAdj < planStart - 60) nowAdj += 24 * 60;
    return nowAdj > planEnd + 30 ? "미퇴근" : "근무중";
  }

  if (realStart > planStart + 5)              return "지각";
  if (realEnd < planEnd - 5 && realEnd > planStart) return "조퇴";
  if (realEnd > planEnd + 10)                 return "연장";
  return "정상";
}
