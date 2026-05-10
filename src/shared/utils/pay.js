// src/shared/utils/pay.js
// UTF-8 — 한글 깨짐 주의
//
// 정산 원칙:
// 1) attendance 기준만 사용
// 2) schedule 기반 예상 정산 사용 금지
// 3) paid_check_in / paid_check_out 기준으로 계산
// 4) approval_status === "pending" 인 건은 미확정으로 간주
// 5) 비정상 역전 시간(end < start)은 자정 넘김으로 보지 않고 0분 처리
//    → 잘못된 paid 시간 때문에 급여/야간수당이 폭증하는 문제 방지

function toParsedMin(t) {
  const m = String(t || "").match(/(\d+):(\d+)/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function toMin(t) {
  const parsed = toParsedMin(t);
  return parsed === null ? 0 : parsed;
}

/**
 * 동일 날짜 기준 시간 차이.
 * end < start 인 경우 비정상 데이터로 보고 0 반환.
 */
export function diffMinutes(start, end) {
  if (!start || !end) return 0;

  const s = toParsedMin(start);
  const e = toParsedMin(end);

  if (s === null || e === null) return 0;
  if (e < s) return 0;

  return Math.max(0, e - s);
}

// 지급 기준 시간(paid_check_in / paid_check_out)으로 근무시간 계산
export function calcWorkMinutes(paidCheckIn, paidCheckOut, breakMin = 0) {
  if (!paidCheckIn || !paidCheckOut) return 0;

  const total = diffMinutes(paidCheckIn, paidCheckOut);
  return Math.max(0, total - Math.max(0, Number(breakMin) || 0));
}

// 실제 시간(check_in / check_out) 기준 참고용
export function calcActualWorkMinutes(checkIn, checkOut, breakMin = 0) {
  if (!checkIn || !checkOut) return 0;

  const total = diffMinutes(checkIn, checkOut);
  return Math.max(0, total - Math.max(0, Number(breakMin) || 0));
}

// 야간시간 계산: 22:00 ~ 익일 05:00
// 현재 시스템은 역전 시간을 비정상으로 보고 0 처리
export function calcNightMinutes(paidCheckIn, paidCheckOut, breakMin = 0) {
  if (!paidCheckIn || !paidCheckOut) return 0;

  const start = toParsedMin(paidCheckIn);
  const end = toParsedMin(paidCheckOut);

  if (start === null || end === null) return 0;
  if (end < start) return 0;

  const total = end - start;
  if (total <= 0) return 0;

  // 같은 날짜 내 22:00~24:00만 우선 계산
  // 실제 야간(익일 00~05시)을 지원하려면 GAS 쪽에서 정상적인 날짜 포함 구조가 필요
  const nightStart = 22 * 60;
  const nightEnd = 24 * 60;

  const overlap = Math.max(0, Math.min(end, nightEnd) - Math.max(start, nightStart));
  if (overlap <= 0) return 0;

  const breakDeduction = (Number(breakMin) || 0) * (overlap / total);
  return Math.max(0, overlap - breakDeduction);
}

export function calcNightMinutesSimple(paidCheckIn, paidCheckOut) {
  if (!paidCheckIn || !paidCheckOut) return 0;

  const start = toParsedMin(paidCheckIn);
  const end = toParsedMin(paidCheckOut);

  if (start === null || end === null) return 0;
  if (end < start) return 0;

  const nightStart = 22 * 60;
  const nightEnd = 24 * 60;

  return Math.max(0, Math.min(end, nightEnd) - Math.max(start, nightStart));
}

// 개별 row가 정산 가능한 상태인지
export function isPaySettledRow(row) {
  if (!row) return false;
  return row.approval_status !== "pending";
}

// 개별 row 급여 계산
export function calcRowPay(row, hourlyWage) {
  if (!row || !isPaySettledRow(row)) return 0;

  const wage = Number(hourlyWage ?? row.hourly_wage ?? 0) || 0;
  const workMin = calcWorkMinutes(row.paid_check_in, row.paid_check_out, row.break_min);
  const nightMin = calcNightMinutes(row.paid_check_in, row.paid_check_out, row.break_min);

  return Math.round((workMin / 60) * wage + (nightMin / 60) * wage * 0.5);
}

// 이전 코드 호환용
export function calcPay(paidCheckIn, paidCheckOut, breakMin, hourlyWage) {
  const wage = Number(hourlyWage) || 0;
  const workMin = calcWorkMinutes(paidCheckIn, paidCheckOut, breakMin);
  const nightMin = calcNightMinutes(paidCheckIn, paidCheckOut, breakMin);

  return Math.round((workMin / 60) * wage + (nightMin / 60) * wage * 0.5);
}

// 월별 합산
export function calcMonthSummary(rows = [], employeeMap = {}) {
  const settledRows = rows.filter(isPaySettledRow);

  const totalWorkMin = settledRows.reduce(
    (sum, row) => sum + calcWorkMinutes(row.paid_check_in, row.paid_check_out, row.break_min),
    0,
  );

  const totalNightMin = settledRows.reduce(
    (sum, row) => sum + calcNightMinutes(row.paid_check_in, row.paid_check_out, row.break_min),
    0,
  );

  const totalPay = settledRows.reduce((sum, row) => {
    const wage =
      Number(employeeMap?.[String(row.employee_id)]?.hourly_wage ?? row.hourly_wage ?? 0) || 0;

    return sum + calcRowPay(row, wage);
  }, 0);

  return {
    totalRows: rows.length,
    settledRows: settledRows.length,
    pendingRows: rows.filter((row) => row.approval_status === "pending").length,
    totalWorkMin,
    totalNightMin,
    totalPay,
  };
}
