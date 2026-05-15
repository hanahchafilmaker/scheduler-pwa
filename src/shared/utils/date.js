// src/shared/utils/date.js
// UTF-8 — 한글 깨짐 주의

export function getDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// FIX: "YYYY-MM-DD" 를 new Date()로 파싱하면 UTC 기준 → KST 환경에서 하루 밀림
//      문자열이면 그대로 반환, Date/ISO 면 로컬 기준으로 변환
export function normalizeDate(v) {
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return String(v);
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return getDateString(d);
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
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  const ym = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}`;

  return {
    start: getDateString(start),
    end: getDateString(end),
    label: `${base.getFullYear()}년 ${base.getMonth() + 1}월`,
    ym,
  };
}

export const DAY_KR = ["일", "월", "화", "수", "목", "금", "토"];

function toMin(t) {
  const m = String(t || "").match(/(\d+):(\d+)/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

// schedule row 기반 상태 계산
// attendance 필드: check_in, check_out
// schedule  필드: planned_start, planned_end
export function getStatus(scheduled, att) {
  if (!att?.check_in) return "예정";

  const planStart = toMin(scheduled.planned_start);
  const planEnd = toMin(scheduled.planned_end);

  if (planEnd < planStart) return "확인필요";

  const realStart = toMin(att.check_in);
  const realEnd = att.check_out ? toMin(att.check_out) : null;

  if (realEnd !== null && realEnd < realStart) return "확인필요";

  if (!att.check_out) {
    const n = new Date();
    const nowAdj = n.getHours() * 60 + n.getMinutes();
    return nowAdj > planEnd + 30 ? "미퇴근" : "근무중";
  }

  if (realStart > planStart + 1) return "지각";
  if (realEnd < planEnd - 1 && realEnd > planStart) return "조퇴";
  if (realEnd > planEnd + 1) return "연장";
  return "정상";
}