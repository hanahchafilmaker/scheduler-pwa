export function getDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// FIX: "YYYY-MM-DD" 문자열을 new Date()로 파싱하면 UTC 기준으로 처리되어
//      KST(+9) 환경에서 하루 밀리는 버그 수정 → 문자열 직접 파싱
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

export function getStatus(scheduled, att) {
  if (!att?.check_in) return "예정";

  const planStart = toMin(scheduled.planned_start);
  let planEnd = toMin(scheduled.planned_end);
  if (planEnd < planStart) planEnd += 24 * 60;

  const realStart = toMin(att.check_in);
  let realEnd = att.check_out ? toMin(att.check_out) : null;
  if (realEnd !== null && realEnd < realStart) realEnd += 24 * 60;

  if (!att.check_out) {
    const n = new Date();
    let nowAdj = n.getHours() * 60 + n.getMinutes();
    if (nowAdj < planStart - 60) nowAdj += 24 * 60;
    return nowAdj > planEnd + 30 ? "미퇴근" : "근무중";
  }

  if (realStart > planStart + 1) return "지각";
  if (realEnd < planEnd - 1 && realEnd > planStart) return "조퇴";
  if (realEnd > planEnd + 1) return "연장";
  return "정상";
}
