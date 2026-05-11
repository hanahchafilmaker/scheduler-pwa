// src/shared/utils/pay.js
// UTF-8 — 한글 깨짐 주의
//
// 최종 정산 원칙
// 1) attendance 원본(check_in/check_out, planned_start/planned_end)은 수정하지 않음
// 2) 기본 근무시간 표시는 스케줄 시간(planned_start ~ planned_end)
// 3) 지각 / 조기퇴근은 기본급에서 차감
// 4) 조기출근 / 마감 후 추가근무 / 스케줄 외 출근은 추가 수당으로 처리
// 5) approval_status === "pending" 인 건은 미확정으로 간주
// 6) 임금명세서에는 추가 수당 "시간"은 굳이 표시하지 않고 금액만 표시 가능

function toParsedMin(t) {
  const m = String(t || "").match(/(\d+):(\d+)/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function toMin(t) {
  const parsed = toParsedMin(t);
  return parsed === null ? 0 : parsed;
}

export function diffMinutes(start, end) {
  if (!start || !end) return 0;

  const s = toParsedMin(start);
  const e = toParsedMin(end);

  if (s === null || e === null) return 0;
  if (e < s) return 0;

  return Math.max(0, e - s);
}

export function calcWorkMinutes(paidCheckIn, paidCheckOut, breakMin = 0) {
  if (!paidCheckIn || !paidCheckOut) return 0;
  const total = diffMinutes(paidCheckIn, paidCheckOut);
  return Math.max(0, total - Math.max(0, Number(breakMin) || 0));
}

export function calcActualWorkMinutes(checkIn, checkOut, breakMin = 0) {
  if (!checkIn || !checkOut) return 0;
  const total = diffMinutes(checkIn, checkOut);
  return Math.max(0, total - Math.max(0, Number(breakMin) || 0));
}

// 구 로직 호환용
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

// 구 로직 호환용
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

export function isPaySettledRow(row) {
  if (!row) return false;
  return row.approval_status !== "pending";
}

/* =========================
   새 payroll 계산
========================= */

/**
 * 스케줄 기본 근무시간 (표시용)
 */
export function calcPayrollBasePlannedMinutes(plannedStart, plannedEnd) {
  return diffMinutes(plannedStart, plannedEnd);
}

/**
 * 지각 차감 시간
 * planned_start 보다 늦게 출근한 경우
 */
export function calcPayrollLateDeductMinutes(plannedStart, actualCheckIn) {
  if (!plannedStart || !actualCheckIn) return 0;

  const planned = toParsedMin(plannedStart);
  const actual = toParsedMin(actualCheckIn);

  if (planned === null || actual === null) return 0;
  return Math.max(0, actual - planned);
}

/**
 * 조기퇴근 차감 시간
 * planned_end 보다 일찍 퇴근한 경우
 */
export function calcPayrollEarlyLeaveDeductMinutes(plannedEnd, actualCheckOut) {
  if (!plannedEnd || !actualCheckOut) return 0;

  const planned = toParsedMin(plannedEnd);
  const actual = toParsedMin(actualCheckOut);

  if (planned === null || actual === null) return 0;
  return Math.max(0, planned - actual);
}

/**
 * 조기출근 추가 시간
 */
export function calcPayrollExtraEarlyMinutes(plannedStart, actualCheckIn) {
  if (!plannedStart || !actualCheckIn) return 0;

  const planned = toParsedMin(plannedStart);
  const actual = toParsedMin(actualCheckIn);

  if (planned === null || actual === null) return 0;
  return Math.max(0, planned - actual);
}

/**
 * 마감 후 추가 시간
 */
export function calcPayrollExtraLateMinutes(plannedEnd, actualCheckOut) {
  if (!plannedEnd || !actualCheckOut) return 0;

  const planned = toParsedMin(plannedEnd);
  const actual = toParsedMin(actualCheckOut);

  if (planned === null || actual === null) return 0;
  return Math.max(0, actual - planned);
}

/**
 * 개별 row 급여 계산
 *
 * - 스케줄 근무: 기본급 = 스케줄 시간 - 지각/조기퇴근 차감
 * - 추가 수당 = 조기출근 + 마감 후 추가
 * - 스케줄 외 출근: 기본급 0, 실제 근무시간 전체를 추가 수당
 */
export function calcRowPayWithSeparation(row, hourlyWage) {
  if (!row || !isPaySettledRow(row)) {
    return {
      payrollBasePlannedMin: 0,
      payrollLateDeductMin: 0,
      payrollEarlyLeaveDeductMin: 0,
      payrollBasePaidMin: 0,
      payrollExtraEarlyMin: 0,
      payrollExtraLateMin: 0,
      payrollExtraMin: 0,
      payrollBasePay: 0,
      payrollExtraPay: 0,
      payrollTotalPay: 0,
    };
  }

  const wage = Number(hourlyWage ?? row.hourly_wage ?? 0) || 0;
  const isOutOfSchedule = row.approval_reason === "out_of_schedule";
  const hasPlannedRange = !!row.planned_start && !!row.planned_end;

  let payrollBasePlannedMin = 0;
  let payrollLateDeductMin = 0;
  let payrollEarlyLeaveDeductMin = 0;
  let payrollBasePaidMin = 0;
  let payrollExtraEarlyMin = 0;
  let payrollExtraLateMin = 0;
  let payrollExtraMin = 0;

  if (isOutOfSchedule || !hasPlannedRange) {
    payrollBasePlannedMin = 0;
    payrollBasePaidMin = 0;
    payrollExtraMin = calcActualWorkMinutes(row.check_in, row.check_out, row.break_min);
  } else {
    payrollBasePlannedMin = calcPayrollBasePlannedMinutes(row.planned_start, row.planned_end);

    payrollLateDeductMin = calcPayrollLateDeductMinutes(row.planned_start, row.check_in);
    payrollEarlyLeaveDeductMin = calcPayrollEarlyLeaveDeductMinutes(row.planned_end, row.check_out);

    payrollBasePaidMin = Math.max(
      0,
      payrollBasePlannedMin - payrollLateDeductMin - payrollEarlyLeaveDeductMin,
    );

    payrollExtraEarlyMin = calcPayrollExtraEarlyMinutes(row.planned_start, row.check_in);
    payrollExtraLateMin = calcPayrollExtraLateMinutes(row.planned_end, row.check_out);
    payrollExtraMin = payrollExtraEarlyMin + payrollExtraLateMin;
  }

  const payrollBasePay = Math.round((payrollBasePaidMin / 60) * wage);
  const payrollExtraPay = Math.round((payrollExtraMin / 60) * wage);
  const payrollTotalPay = payrollBasePay + payrollExtraPay;

  return {
    payrollBasePlannedMin,
    payrollLateDeductMin,
    payrollEarlyLeaveDeductMin,
    payrollBasePaidMin,
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

// 월별 합산 — 최적화: row당 payroll 계산 1회만
export function calcMonthSummary(rows = [], employeeMap = {}) {
  const settledRows = rows.filter((row) => isPaySettledRow(row) && row?.check_in && row?.check_out);

  const payrollRows = settledRows.map((row) => {
    const wage =
      Number(employeeMap?.[String(row.employee_id)]?.hourly_wage ?? row.hourly_wage ?? 0) || 0;

    return {
      row,
      payroll: calcRowPayWithSeparation(row, wage),
    };
  });

  const totals = payrollRows.reduce(
    (acc, item) => {
      const payroll = item.payroll;

      acc.totalPayrollBasePlannedMin += payroll.payrollBasePlannedMin;
      acc.totalPayrollLateDeductMin += payroll.payrollLateDeductMin;
      acc.totalPayrollEarlyLeaveDeductMin += payroll.payrollEarlyLeaveDeductMin;
      acc.totalPayrollBasePaidMin += payroll.payrollBasePaidMin;
      acc.totalPayrollExtraMin += payroll.payrollExtraMin;
      acc.totalPayrollBasePay += payroll.payrollBasePay;
      acc.totalPayrollExtraPay += payroll.payrollExtraPay;
      return acc;
    },
    {
      totalPayrollBasePlannedMin: 0,
      totalPayrollLateDeductMin: 0,
      totalPayrollEarlyLeaveDeductMin: 0,
      totalPayrollBasePaidMin: 0,
      totalPayrollExtraMin: 0,
      totalPayrollBasePay: 0,
      totalPayrollExtraPay: 0,
    },
  );

  return {
    totalRows: rows.length,
    settledRows: settledRows.length,
    pendingRows: rows.filter((row) => row.approval_status === "pending").length,
    ...totals,
    totalPayrollPay: totals.totalPayrollBasePay + totals.totalPayrollExtraPay,
  };
}
