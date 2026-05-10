// src/shared/utils/pay.js
// UTF-8 — 한글 깨짐 주의
//
// 정산 원칙:
// 1) attendance 원본(check_in/check_out, planned_start/planned_end)은 수정하지 않음
// 2) payroll 계산은 파생값으로만 처리
// 3) 기본 근무시간 = planned_start ~ planned_end
// 4) 추가 수당 = 조기출근 + 마감 후 추가시간
// 5) approval_status === "pending" 인 건은 미확정으로 간주
// 6) 비정상 역전 시간(end < start)은 자정 넘김으로 보지 않고 0분 처리

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
// 구 로직 호환용
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

// 구 로직 호환용 야간 계산
export function calcNightMinutes(paidCheckIn, paidCheckOut, breakMin = 0) {
  if (!paidCheckIn || !paidCheckOut) return 0;

  const start = toParsedMin(paidCheckIn);
  const end = toParsedMin(paidCheckOut);

  if (start === null || end === null) return 0;
  if (end < start) return 0;

  const total = end - start;
  if (total <= 0) return 0;

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

/* ================= 신규: 기본 근무시간 기준 임금 계산 ================= */

/**
 * 기본 근무시간 (분): planned_start ~ planned_end
 */
export function calcPayrollBaseMinutes(plannedStart, plannedEnd) {
  return diffMinutes(plannedStart, plannedEnd);
}

/**
 * 추가 조기출근 시간 (분)
 */
export function calcPayrollExtraEarlyMinutes(plannedStart, actualCheckIn) {
  if (!plannedStart || !actualCheckIn) return 0;

  const planned = toParsedMin(plannedStart);
  const actual = toParsedMin(actualCheckIn);

  if (planned === null || actual === null) return 0;
  return Math.max(0, planned - actual);
}

/**
 * 추가 마감시간 (분)
 */
export function calcPayrollExtraLateMinutes(plannedEnd, actualCheckOut) {
  if (!plannedEnd || !actualCheckOut) return 0;

  const planned = toParsedMin(plannedEnd);
  const actual = toParsedMin(actualCheckOut);

  if (planned === null || actual === null) return 0;
  return Math.max(0, actual - planned);
}

/**
 * 추가시간 총합 (분)
 */
export function calcPayrollExtraMinutes(plannedStart, plannedEnd, actualCheckIn, actualCheckOut) {
  const earlyMin = calcPayrollExtraEarlyMinutes(plannedStart, actualCheckIn);
  const lateMin = calcPayrollExtraLateMinutes(plannedEnd, actualCheckOut);
  return earlyMin + lateMin;
}

/**
 * 개별 row 급여 계산 (파트 기본시간 기준)
 */
export function calcRowPayWithSeparation(row, hourlyWage) {
  if (!row || !isPaySettledRow(row)) {
    return {
      payrollBaseMin: 0,
      payrollExtraEarlyMin: 0,
      payrollExtraLateMin: 0,
      payrollExtraMin: 0,
      payrollBasePay: 0,
      payrollExtraPay: 0,
      payrollTotalPay: 0,
    };
  }

  const wage = Number(hourlyWage ?? row.hourly_wage ?? 0) || 0;

  const payrollBaseMin = calcPayrollBaseMinutes(row.planned_start, row.planned_end);
  const payrollExtraEarlyMin = calcPayrollExtraEarlyMinutes(row.planned_start, row.check_in);
  const payrollExtraLateMin = calcPayrollExtraLateMinutes(row.planned_end, row.check_out);
  const payrollExtraMin = payrollExtraEarlyMin + payrollExtraLateMin;

  const payrollBasePay = Math.round((payrollBaseMin / 60) * wage);
  const payrollExtraPay = Math.round((payrollExtraMin / 60) * wage);
  const payrollTotalPay = payrollBasePay + payrollExtraPay;

  return {
    payrollBaseMin,
    payrollExtraEarlyMin,
    payrollExtraLateMin,
    payrollExtraMin,
    payrollBasePay,
    payrollExtraPay,
    payrollTotalPay,
  };
}

// 구 로직 호환용
export function calcRowPay(row, hourlyWage) {
  if (!row || !isPaySettledRow(row)) return 0;

  const wage = Number(hourlyWage ?? row.hourly_wage ?? 0) || 0;
  const workMin = calcWorkMinutes(row.paid_check_in, row.paid_check_out, row.break_min);
  const nightMin = calcNightMinutes(row.paid_check_in, row.paid_check_out, row.break_min);

  return Math.round((workMin / 60) * wage + (nightMin / 60) * wage * 0.5);
}

// 구 로직 호환용
export function calcPay(paidCheckIn, paidCheckOut, breakMin, hourlyWage) {
  const wage = Number(hourlyWage) || 0;
  const workMin = calcWorkMinutes(paidCheckIn, paidCheckOut, breakMin);
  const nightMin = calcNightMinutes(paidCheckIn, paidCheckOut, breakMin);

  return Math.round((workMin / 60) * wage + (nightMin / 60) * wage * 0.5);
}

// 월별 합산 — 새 payroll 기준
export function calcMonthSummary(rows = [], employeeMap = {}) {
  const settledRows = rows.filter(
    (row) =>
      isPaySettledRow(row) &&
      row?.planned_start &&
      row?.planned_end &&
      row?.check_in &&
      row?.check_out,
  );

  const totalPayrollBaseMin = settledRows.reduce((sum, row) => {
    return sum + calcPayrollBaseMinutes(row.planned_start, row.planned_end);
  }, 0);

  const totalPayrollExtraMin = settledRows.reduce((sum, row) => {
    return (
      sum + calcPayrollExtraMinutes(row.planned_start, row.planned_end, row.check_in, row.check_out)
    );
  }, 0);

  const totalPayrollBasePay = settledRows.reduce((sum, row) => {
    const wage =
      Number(employeeMap?.[String(row.employee_id)]?.hourly_wage ?? row.hourly_wage ?? 0) || 0;

    const payroll = calcRowPayWithSeparation(row, wage);
    return sum + payroll.payrollBasePay;
  }, 0);

  const totalPayrollExtraPay = settledRows.reduce((sum, row) => {
    const wage =
      Number(employeeMap?.[String(row.employee_id)]?.hourly_wage ?? row.hourly_wage ?? 0) || 0;

    const payroll = calcRowPayWithSeparation(row, wage);
    return sum + payroll.payrollExtraPay;
  }, 0);

  return {
    totalRows: rows.length,
    settledRows: settledRows.length,
    pendingRows: rows.filter((row) => row.approval_status === "pending").length,
    totalPayrollBaseMin,
    totalPayrollExtraMin,
    totalPayrollBasePay,
    totalPayrollExtraPay,
    totalPayrollPay: totalPayrollBasePay + totalPayrollExtraPay,
  };
}
