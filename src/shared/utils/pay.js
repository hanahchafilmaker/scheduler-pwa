// src/shared/utils/pay.js
// UTF-8 — 한글 깨짐 주의
//
// 최종 정산 원칙
// 1) attendance 원본(check_in/check_out, planned_start/planned_end)은 수정하지 않음
// 2) 기본 근무시간 표시는 스케줄 시간(planned_start ~ planned_end)
// 3) 지각 / 조기퇴근은 기본급에서 차감 — 단 각각 5분 허용 구간 적용
// 4) 조기출근(최대 10분 인정) / 마감 후 추가근무 / 스케줄 외 출근은 추가 수당으로 처리
// 5) approval_status === "pending"  인 건은 미확정으로 간주 → 정산 제외
// 6) approval_status === "rejected" 인 건은 기록은 유지하되  정산 제외
// 7) approval_status === "auto_closed" 인 건은 확정 건으로 간주 → 정산 포함
// 8) 임금명세서에는 추가 수당 "시간"은 굳이 표시하지 않고 금액만 표시 가능

// ---------------------------------------------------------------------------
// 내부 헬퍼
// ---------------------------------------------------------------------------

/**
 * "HH:MM" 또는 ISO 문자열 → 분(minute) 정수 반환
 * 파싱 불가면 null
 */
function toParsedMin(t) {
  const m = String(t || "").match(/(\d+):(\d+)/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// ---------------------------------------------------------------------------
// 기본 유틸
// ---------------------------------------------------------------------------

export function toMin(t) {
  const parsed = toParsedMin(t);
  return parsed === null ? 0 : parsed;
}

/**
 * 두 시간 문자열의 차이(분)
 * end < start 이면 0 반환 (역전 시간 = 비정상 데이터)
 */
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

// ---------------------------------------------------------------------------
// 야간수당 계산 (구 로직 호환용)
// ---------------------------------------------------------------------------

/** 야간(22:00~24:00) 구간 중 실제 근무한 시간(분), 휴게 비례 차감 */
export function calcNightMinutes(paidCheckIn, paidCheckOut, breakMin = 0) {
  if (!paidCheckIn || !paidCheckOut) return 0;
  const start = toParsedMin(paidCheckIn);
  const end   = toParsedMin(paidCheckOut);
  if (start === null || end === null) return 0;
  if (end < start) return 0;
  const total = end - start;
  if (total <= 0) return 0;
  const nightStart = 22 * 60;
  const nightEnd   = 24 * 60;
  const overlap = Math.max(0, Math.min(end, nightEnd) - Math.max(start, nightStart));
  if (overlap <= 0) return 0;
  const breakDeduction = (Number(breakMin) || 0) * (overlap / total);
  return Math.max(0, overlap - breakDeduction);
}

/** 야간 구간 단순 overlap — 휴게 미차감 버전 (구 로직 호환용) */
export function calcNightMinutesSimple(paidCheckIn, paidCheckOut) {
  if (!paidCheckIn || !paidCheckOut) return 0;
  const start = toParsedMin(paidCheckIn);
  const end   = toParsedMin(paidCheckOut);
  if (start === null || end === null) return 0;
  if (end < start) return 0;
  const nightStart = 22 * 60;
  const nightEnd   = 24 * 60;
  return Math.max(0, Math.min(end, nightEnd) - Math.max(start, nightStart));
}

// ---------------------------------------------------------------------------
// 정산 대상 여부
// ---------------------------------------------------------------------------

/**
 * 해당 row 가 급여 정산 대상인지 판단
 *
 * 포함: approved, auto_closed (및 그 외 명시되지 않은 상태)
 * 제외: pending  → 미확정
 *       rejected → 기록은 남기되 정산 불포함
 */
export function isPaySettledRow(row) {
  if (!row) return false;
  const s = row.approval_status;
  return s !== "pending" && s !== "rejected";
}

// ---------------------------------------------------------------------------
// 표시용 포맷 헬퍼
// ---------------------------------------------------------------------------

/**
 * 지각 분을 "지각 N분" 문자열로 반환
 * 지각이 없으면 null 반환 (렌더링 측에서 조건부 표시)
 */
export function formatLateMinutes(min) {
  const n = Math.max(0, Number(min) || 0);
  if (n <= 0) return null;
  return `지각 ${n}분`;
}

/**
 * 조기퇴근 분을 "조기퇴근 N분" 문자열로 반환
 * 없으면 null
 */
export function formatEarlyLeaveMinutes(min) {
  const n = Math.max(0, Number(min) || 0);
  if (n <= 0) return null;
  return `조기퇴근 ${n}분`;
}

// ---------------------------------------------------------------------------
// payroll 단위 계산 함수
// ---------------------------------------------------------------------------

/** 스케줄 기본 근무시간 (표시용) */
export function calcPayrollBasePlannedMinutes(plannedStart, plannedEnd) {
  return diffMinutes(plannedStart, plannedEnd);
}

/**
 * 지각 차감 시간
 *
 * 규칙: 5분 이하 지각은 허용(0 반환), 6분 이상이면 전체 지각분 차감
 * 예)  4분 지각 → 0   /   6분 지각 → 6   /  12분 지각 → 12
 */
export function calcPayrollLateDeductMinutes(plannedStart, actualCheckIn) {
  if (!plannedStart || !actualCheckIn) return 0;
  const planned = toParsedMin(plannedStart);
  const actual  = toParsedMin(actualCheckIn);
  if (planned === null || actual === null) return 0;
  const diff = Math.max(0, actual - planned);
  // 5분 이하 허용, 6분부터 전체 차감
  return diff <= 5 ? 0 : diff;
}

/**
 * 조기퇴근 차감 시간
 *
 * 규칙: 5분 이하 조기퇴근은 허용(0 반환), 6분 이상이면 전체 이른 시간 차감
 * 예)  4분 일찍 → 0   /   6분 일찍 → 6   /  15분 일찍 → 15
 */
export function calcPayrollEarlyLeaveDeductMinutes(plannedEnd, actualCheckOut) {
  if (!plannedEnd || !actualCheckOut) return 0;
  const planned = toParsedMin(plannedEnd);
  const actual  = toParsedMin(actualCheckOut);
  if (planned === null || actual === null) return 0;
  const diff = Math.max(0, planned - actual);
  // 5분 이하 허용, 6분부터 전체 차감
  return diff <= 5 ? 0 : diff;
}

/**
 * 조기출근 추가 시간 (추가 수당 대상)
 *
 * 규칙: 최대 10분까지만 인정
 * 예)  5분 일찍 → 5   /   10분 일찍 → 10   /  20분 일찍 → 10
 */
export function calcPayrollExtraEarlyMinutes(plannedStart, actualCheckIn) {
  if (!plannedStart || !actualCheckIn) return 0;
  const planned = toParsedMin(plannedStart);
  const actual  = toParsedMin(actualCheckIn);
  if (planned === null || actual === null) return 0;
  const diff = Math.max(0, planned - actual);
  // 10분 상한
  return Math.min(diff, 10);
}

/**
 * 마감 후 추가 시간 (추가 수당 대상)
 * 관리자 승인이 있는 경우에만 isPaySettledRow 통과 → 여기선 순수 시간 계산만
 */
export function calcPayrollExtraLateMinutes(plannedEnd, actualCheckOut) {
  if (!plannedEnd || !actualCheckOut) return 0;
  const planned = toParsedMin(plannedEnd);
  const actual  = toParsedMin(actualCheckOut);
  if (planned === null || actual === null) return 0;
  return Math.max(0, actual - planned);
}

// ---------------------------------------------------------------------------
// 개별 row 급여 계산 (메인)
// ---------------------------------------------------------------------------

/**
 * calcRowPayWithSeparation
 *
 * 반환값:
 *   payrollBasePlannedMin    스케줄 기준 총 시간
 *   payrollLateDeductMin     지각 차감 시간 (허용 구간 적용 후)
 *   payrollEarlyLeaveDeductMin 조기퇴근 차감 시간 (허용 구간 적용 후)
 *   payrollBasePaidMin       실제 기본급 계산 대상 시간
 *   payrollExtraEarlyMin     조기출근 추가 시간 (10분 상한)
 *   payrollExtraLateMin      마감 후 추가 시간
 *   payrollExtraMin          추가 수당 총 시간
 *   payrollBasePay           기본급 (원)
 *   payrollExtraPay          추가 수당 (원)
 *   payrollTotalPay          합계 (원)
 *
 * 케이스:
 *   A. 스케줄 근무: planned_start/end 있음
 *      기본급 = 스케줄 시간 - 지각 차감 - 조기퇴근 차감
 *      추가   = 조기출근(≤10분) + 마감 후 추가
 *
 *   B. 스케줄 외 출근(out_of_schedule) 또는 planned 없음:
 *      기본급 = 0
 *      추가   = 실제 근무 전체 시간
 *
 *   C. pending / rejected:
 *      전체 0 반환
 */
export function calcRowPayWithSeparation(row, hourlyWage) {
  const ZERO = {
    payrollBasePlannedMin:      0,
    payrollLateDeductMin:       0,
    payrollEarlyLeaveDeductMin: 0,
    payrollBasePaidMin:         0,
    payrollExtraEarlyMin:       0,
    payrollExtraLateMin:        0,
    payrollExtraMin:            0,
    payrollBasePay:             0,
    payrollExtraPay:            0,
    payrollTotalPay:            0,
  };

  if (!row || !isPaySettledRow(row)) return ZERO;

  const wage             = Number(hourlyWage ?? row.hourly_wage ?? 0) || 0;
  const isOutOfSchedule  = row.approval_reason === "out_of_schedule";
  const hasPlannedRange  = !!row.planned_start && !!row.planned_end;

  let payrollBasePlannedMin      = 0;
  let payrollLateDeductMin       = 0;
  let payrollEarlyLeaveDeductMin = 0;
  let payrollBasePaidMin         = 0;
  let payrollExtraEarlyMin       = 0;
  let payrollExtraLateMin        = 0;
  let payrollExtraMin            = 0;

  if (isOutOfSchedule || !hasPlannedRange) {
    // 케이스 B: 스케줄 외 출근
    payrollExtraMin = calcActualWorkMinutes(row.check_in, row.check_out, row.break_min);
  } else {
    // 케이스 A: 정규 스케줄 근무
    payrollBasePlannedMin      = calcPayrollBasePlannedMinutes(row.planned_start, row.planned_end);
    payrollLateDeductMin       = calcPayrollLateDeductMinutes(row.planned_start, row.check_in);
    payrollEarlyLeaveDeductMin = calcPayrollEarlyLeaveDeductMinutes(row.planned_end, row.check_out);
    payrollBasePaidMin         = Math.max(
      0,
      payrollBasePlannedMin - payrollLateDeductMin - payrollEarlyLeaveDeductMin,
    );
    payrollExtraEarlyMin = calcPayrollExtraEarlyMinutes(row.planned_start, row.check_in);
    payrollExtraLateMin  = calcPayrollExtraLateMinutes(row.planned_end, row.check_out);
    payrollExtraMin      = payrollExtraEarlyMin + payrollExtraLateMin;
  }

  // 안전 검증: 역전 시간 또는 비정상 장시간 → 0 처리
  if (payrollBasePaidMin < 0 || payrollExtraMin < 0) {
    return { ...ZERO, _anomaly: true };
  }

  const payrollBasePay  = Math.round((payrollBasePaidMin / 60) * wage);
  const payrollExtraPay = Math.round((payrollExtraMin    / 60) * wage);
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

// ---------------------------------------------------------------------------
// 구 로직 호환용
// ---------------------------------------------------------------------------

export function calcRowPay(row, hourlyWage) {
  if (!row || !isPaySettledRow(row)) return 0;
  const wage    = Number(hourlyWage ?? row.hourly_wage ?? 0) || 0;
  const workMin = calcWorkMinutes(row.paid_check_in, row.paid_check_out, row.break_min);
  const nightMin = calcNightMinutes(row.paid_check_in, row.paid_check_out, row.break_min);
  return Math.round((workMin / 60) * wage + (nightMin / 60) * wage * 0.5);
}

export function calcPay(paidCheckIn, paidCheckOut, breakMin, hourlyWage) {
  const wage    = Number(hourlyWage) || 0;
  const workMin = calcWorkMinutes(paidCheckIn, paidCheckOut, breakMin);
  const nightMin = calcNightMinutes(paidCheckIn, paidCheckOut, breakMin);
  return Math.round((workMin / 60) * wage + (nightMin / 60) * wage * 0.5);
}

// ---------------------------------------------------------------------------
// 월별 합산
// ---------------------------------------------------------------------------

/**
 * calcMonthSummary
 *
 * rows: attendance row 배열 (전체 — pending/rejected 포함)
 * employeeMap: { [employee_id]: { hourly_wage, ... } }
 *
 * 반환값:
 *   totalRows                  전체 row 수
 *   settledRows                정산 확정 row 수
 *   pendingRows                승인대기 row 수
 *   rejectedRows               거절 row 수
 *   totalPayrollBasePlannedMin 스케줄 기준 총 시간(분)
 *   totalPayrollLateDeductMin  지각 차감 총 시간(분)
 *   totalPayrollEarlyLeaveDeductMin 조기퇴근 차감 총 시간(분)
 *   totalPayrollBasePaidMin    기본급 계산 총 시간(분)
 *   totalPayrollExtraMin       추가 수당 총 시간(분)
 *   totalPayrollBasePay        기본급 합계(원)
 *   totalPayrollExtraPay       추가 수당 합계(원)
 *   totalPayrollPay            전체 합계(원)
 */
export function calcMonthSummary(rows = [], employeeMap = {}) {
  const settledRows  = rows.filter((row) => isPaySettledRow(row) && row?.check_in && row?.check_out);
  const pendingRows  = rows.filter((row) => row.approval_status === "pending");
  const rejectedRows = rows.filter((row) => row.approval_status === "rejected");

  const payrollRows = settledRows.map((row) => {
    const wage =
      Number(employeeMap?.[String(row.employee_id)]?.hourly_wage ?? row.hourly_wage ?? 0) || 0;
    return {
      row,
      payroll: calcRowPayWithSeparation(row, wage),
    };
  });

  const totals = payrollRows.reduce(
    (acc, { payroll }) => {
      acc.totalPayrollBasePlannedMin      += payroll.payrollBasePlannedMin;
      acc.totalPayrollLateDeductMin       += payroll.payrollLateDeductMin;
      acc.totalPayrollEarlyLeaveDeductMin += payroll.payrollEarlyLeaveDeductMin;
      acc.totalPayrollBasePaidMin         += payroll.payrollBasePaidMin;
      acc.totalPayrollExtraMin            += payroll.payrollExtraMin;
      acc.totalPayrollBasePay             += payroll.payrollBasePay;
      acc.totalPayrollExtraPay            += payroll.payrollExtraPay;
      return acc;
    },
    {
      totalPayrollBasePlannedMin:      0,
      totalPayrollLateDeductMin:       0,
      totalPayrollEarlyLeaveDeductMin: 0,
      totalPayrollBasePaidMin:         0,
      totalPayrollExtraMin:            0,
      totalPayrollBasePay:             0,
      totalPayrollExtraPay:            0,
    },
  );

  return {
    totalRows:    rows.length,
    settledRows:  settledRows.length,
    pendingRows:  pendingRows.length,
    rejectedRows: rejectedRows.length,
    ...totals,
    totalPayrollPay: totals.totalPayrollBasePay + totals.totalPayrollExtraPay,
  };
}