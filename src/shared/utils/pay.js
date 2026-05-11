// src/shared/utils/pay.js
// UTF-8 — 한글 깨짐 주의
//
// 정산 원칙:
// 1) attendance 원본(check_in / check_out) 수정 금지
// 2) approval_status === "pending" 인 건은 미확정으로 간주
// 3) 비정상 역전 시간(end < start)은 0분 처리
//
// 임금명세서 기준:
// - 기본 근무시간 표시 = payrollBasePlannedMin (스케줄 시간 그대로)
// - 기본급 계산      = payrollBasePaidMin (지각/조퇴 차감 후)
// - 추가 수당        = 조기출근 + 마감 후 추가 + 스케줄 외 전부
// - 임금명세서에는 시간이 아닌 금액만 표시

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

export function isPaySettledRow(row) {
  if (!row) return false;
  return row.approval_status !== "pending";
}

// ─────────────────────────────────────────────
// 핵심 payroll 계산
// ─────────────────────────────────────────────

/**
 * 개별 row 급여 계산
 *
 * [스케줄 근무]
 *   payrollBasePlannedMin  = planned_start ~ planned_end  (표시용)
 *   payrollLateDeductMin   = 지각 차감 (GAS가 late_deduct_min 에 기록)
 *   payrollEarlyLeaveDeductMin = 조퇴 차감 (GAS early_leave_min)
 *   payrollBasePaidMin     = BasePlanned - LateDeduct - EarlyLeaveDeduct  (기본급 계산용)
 *   payrollExtraMin        = 조기출근 + 마감 후 추가
 *
 * [스케줄 외 (out_of_schedule) 또는 planned 없음]
 *   payrollBasePlannedMin  = 0
 *   payrollBasePaidMin     = 0  →  기본급 = 0
 *   payrollExtraMin        = 실제 근무시간 전체  →  전액 추가 수당
 *
 * 표시 규칙:
 *   임금명세서 "기본 근무시간" = payrollBasePlannedMin  (스케줄 시간 그대로)
 *   임금명세서 "기본급"        = payrollBasePay  (차감 후 계산)
 *   임금명세서 "추가 수당"     = payrollExtraPay  (금액만, 시간 미표시)
 *   임금명세서 "총 지급액"     = payrollTotalPay
 *
 * attendance 원본(check_in / check_out)은 절대 수정하지 않음.
 */
export function calcRowPayWithSeparation(row, hourlyWage) {
  if (!row || !isPaySettledRow(row)) {
    return {
      payrollBasePlannedMin: 0,
      payrollLateDeductMin: 0,
      payrollEarlyLeaveDeductMin: 0,
      payrollBasePaidMin: 0,
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
  let payrollExtraMin = 0;

  if (isOutOfSchedule || !hasPlannedRange) {
    // 스케줄 외: 기본급 0, 실제 근무시간 전체를 추가 수당으로
    payrollBasePlannedMin = 0;
    payrollBasePaidMin = 0;
    payrollExtraMin = calcActualWorkMinutes(row.check_in, row.check_out, row.break_min);
  } else {
    // 스케줄 근무
    payrollBasePlannedMin = diffMinutes(row.planned_start, row.planned_end);

    // GAS가 기록한 차감값 사용 (없으면 0)
    payrollLateDeductMin = Math.max(0, Number(row.late_deduct_min) || 0);
    payrollEarlyLeaveDeductMin = Math.max(0, Number(row.early_leave_min) || 0);

    // 기본급 계산 시간 = 스케줄 시간 - 지각 차감 - 조퇴 차감
    payrollBasePaidMin = Math.max(
      0,
      payrollBasePlannedMin - payrollLateDeductMin - payrollEarlyLeaveDeductMin,
    );

    // 추가 수당: 조기출근 + 마감 후 추가
    const earlyMin =
      toParsedMin(row.planned_start) !== null && toParsedMin(row.check_in) !== null
        ? Math.max(0, toParsedMin(row.planned_start) - toParsedMin(row.check_in))
        : 0;
    const lateMin =
      toParsedMin(row.planned_end) !== null && toParsedMin(row.check_out) !== null
        ? Math.max(0, toParsedMin(row.check_out) - toParsedMin(row.planned_end))
        : 0;

    payrollExtraMin = earlyMin + lateMin;
  }

  const payrollBasePay = Math.round((payrollBasePaidMin / 60) * wage);
  const payrollExtraPay = Math.round((payrollExtraMin / 60) * wage);
  const payrollTotalPay = payrollBasePay + payrollExtraPay;

  return {
    payrollBasePlannedMin, // 표시용: 스케줄 근무시간
    payrollLateDeductMin, // 내부용: 지각 차감
    payrollEarlyLeaveDeductMin, // 내부용: 조퇴 차감
    payrollBasePaidMin, // 내부용: 실제 기본급 계산 기준 시간
    payrollExtraMin, // 내부용: 추가 수당 계산 시간
    payrollBasePay,
    payrollExtraPay,
    payrollTotalPay,
  };
}

// ─────────────────────────────────────────────
// 하위 호환용 (구 로직)
// ─────────────────────────────────────────────

export function calcRowPay(row, hourlyWage) {
  if (!row || !isPaySettledRow(row)) return 0;
  const wage = Number(hourlyWage ?? row.hourly_wage ?? 0) || 0;
  const workMin = calcWorkMinutes(row.paid_check_in, row.paid_check_out, row.break_min);
  const nightMin = calcNightMinutes(row.paid_check_in, row.paid_check_out, row.break_min);
  return Math.round((workMin / 60) * wage + (nightMin / 60) * wage * 0.5);
}

export function calcPay(paidCheckIn, paidCheckOut, breakMin, hourlyWage) {
  const wage = Number(hourlyWage) || 0;
  const workMin = calcWorkMinutes(paidCheckIn, paidCheckOut, breakMin);
  const nightMin = calcNightMinutes(paidCheckIn, paidCheckOut, breakMin);
  return Math.round((workMin / 60) * wage + (nightMin / 60) * wage * 0.5);
}

// ─────────────────────────────────────────────
// 월별 합산
// ─────────────────────────────────────────────

export function calcMonthSummary(rows = [], employeeMap = {}) {
  const settledRows = rows.filter((row) => isPaySettledRow(row) && row?.check_in && row?.check_out);

  const getWage = (row) =>
    Number(employeeMap?.[String(row.employee_id)]?.hourly_wage ?? row.hourly_wage ?? 0) || 0;

  const totalPayrollBasePlannedMin = settledRows.reduce(
    (sum, row) => sum + calcRowPayWithSeparation(row, getWage(row)).payrollBasePlannedMin,
    0,
  );
  const totalPayrollExtraMin = settledRows.reduce(
    (sum, row) => sum + calcRowPayWithSeparation(row, getWage(row)).payrollExtraMin,
    0,
  );
  const totalPayrollBasePay = settledRows.reduce(
    (sum, row) => sum + calcRowPayWithSeparation(row, getWage(row)).payrollBasePay,
    0,
  );
  const totalPayrollExtraPay = settledRows.reduce(
    (sum, row) => sum + calcRowPayWithSeparation(row, getWage(row)).payrollExtraPay,
    0,
  );

  return {
    totalRows: rows.length,
    settledRows: settledRows.length,
    pendingRows: rows.filter((row) => row.approval_status === "pending").length,
    totalPayrollBasePlannedMin,
    totalPayrollExtraMin,
    totalPayrollBasePay,
    totalPayrollExtraPay,
    totalPayrollPay: totalPayrollBasePay + totalPayrollExtraPay,
  };
}
