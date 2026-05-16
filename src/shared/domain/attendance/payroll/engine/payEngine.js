import { SETTLED_RULES } from "../../rules/settledRules";
import { diffMinutes } from "../time/timeUtils";
import { calcMonthSummary } from "../summary/paySummary";

import {
  calcWorkMinutes,
  calcLateDeduct,
  calcEarlyLeaveDeduct,
  calcExtraEarly,
  calcExtraLate,
} from "../calculator/payCalculator";

/**
 * [정책 설정] 회사 정산 정책 상수화
 * - 정상 근무 시 휴게시간 차감 여부 및 승인 상태 표준화만 남기고 보정 근무 및 조기 출근 허용 정책은 제외했습니다.
 */
const PAYROLL_POLICY = Object.freeze({
  DEDUCT_BREAK_NORMAL_SHIFT: true,    // 정상 스케줄 근무 시 휴게시간 차감 여부
  APPROVED_STATUS_SET: new Set(["APPROVED", "승인"]), // 승인 상태 값의 표준화
});

/**
 * 원본 객체 오염 방지를 위한 불변(Freeze) ZERO 객체 선언
 */
const ZERO_PAYROLL = Object.freeze({
  payrollBasePlannedMin: 0,
  payrollLateDeductMin: 0,
  payrollEarlyLeaveDeductMin: 0,
  payrollBasePaidMin: 0,
  payrollExtraMin: 0,
  payrollBasePay: 0,
  payrollExtraPay: 0,
  payrollTotalPay: 0,
});

/**
 * 단일 근무 기록(Row)의 급여 및 정산 분(Minute)을 계산하는 핵심 엔진
 */
export function calcRowPayWithSeparation(row, hourlyWage) {
  // 1. 기본 검증 및 정산 대상 여부 확인
  if (!row || !SETTLED_RULES.PAY(row)) return ZERO_PAYROLL;

  // 승인 상태 값 데이터 혼용 및 스키마 흔들림 방지 (Set 활용)
  const isApproved = PAYROLL_POLICY.APPROVED_STATUS_SET.has(row.approval_status) || 
                     PAYROLL_POLICY.APPROVED_STATUS_SET.has(row.status);
  if (!isApproved) return ZERO_PAYROLL;

  // 2. 미퇴근(WORKING) 상태 데이터 정산 제외 안전장치
  if (!row.check_out || row.check_out === "-" || row.check_out.trim() === "") {
    return ZERO_PAYROLL;
  }

  const wage = Number(hourlyWage ?? row.hourly_wage ?? 0) || 0;
  
  // 스케줄 유무 및 대타 여부 확인
  const isOutOfSchedule = row.approval_reason === "out_of_schedule" || row.part === "대타";
  const hasPlan = !!row.planned_start && !!row.planned_end && row.planned_start !== "~";

  let baseMin = 0;
  let late = 0;
  let early = 0;
  let extra = 0;

  // 휴게시간 필드 정규화
  const breakMin = Number(row.break_min ?? row.breakMin ?? 0) || 0;

  // 3. 출퇴근 시간 및 정책 기반 계산 분기
  if (isOutOfSchedule || !hasPlan) {
    // ■ [대타 / 스케줄 외 근무]
    // 실제 총 근무 시간에서 휴게 시간을 항상 차감
    const totalWork = diffMinutes(row.check_in, row.check_out);
    extra = Math.max(0, totalWork - breakMin);
  } else {
    // ■ [정상 스케줄 근무]
    // baseMin은 오직 계획 시간 기준으로 먼저 계산
    baseMin = diffMinutes(row.planned_start, row.planned_end);

    // 지각 및 조퇴 공제액 계산
    late = calcLateDeduct(row.planned_start, row.check_in);
    early = calcEarlyLeaveDeduct(row.planned_end, row.check_out);

    // [수정 요청 반영] 조기 출근 5분 인정 삭제 -> 조기 출근은 항상 0분 처리 (인정하지 않음)
    const extraEarly = 0; 
    const extraLate = calcExtraLate(row.planned_end, row.check_out) || 0;
    
    extra = Math.max(0, extraEarly + extraLate);
  }

  // 4. 기본 인정 근무 분 계산 및 정상 스케줄 휴게시간 차감 로직 통합
  let basePaid = Math.max(0, baseMin - late - early);
  
  if (!isOutOfSchedule && hasPlan && PAYROLL_POLICY.DEDUCT_BREAK_NORMAL_SHIFT) {
    basePaid = Math.max(0, basePaid - breakMin);
  }

  // 5. 시급 계산 및 원 단위 반올림
  const basePay = Math.round((basePaid / 60) * wage);
  const extraPay = Math.round((extra / 60) * wage);

  return {
    payrollBasePlannedMin: baseMin,
    payrollLateDeductMin: late,
    payrollEarlyLeaveDeductMin: early,
    payrollBasePaidMin: basePaid,
    payrollExtraMin: extra,
    payrollBasePay: basePay,
    payrollExtraPay: extraPay,
    payrollTotalPay: basePay + extraPay,
  };
}

/* ==========================================
   호환성 유지를 위한 내보내기용 래퍼 함수 (Compatibility Wrappers)
   ========================================== */

export function calcPayrollLateDeductMinutes(row) {
  if (!row || !row.planned_start || !row.check_in) return 0;
  return calcLateDeduct(row.planned_start, row.check_in);
}

export function calcPayrollEarlyLeaveDeductMinutes(row) {
  if (!row || !row.planned_end || !row.check_out) return 0;
  return calcEarlyLeaveDeduct(row.planned_end, row.check_out);
}

export function formatLateMinutes(min) {
  return min > 0 ? `${min}min` : "";
}

export function formatEarlyLeaveMinutes(min) {
  return min > 0 ? `${min}min` : "";
}

/**
 * 월간 정산 데이터 묶음 빌더
 */
export function buildSettlement({
  attendance = [],
  employees = [],
  month = "",
}) {
  const employeeMap = Object.fromEntries(
    employees.map((e) => [e.id, e])
  );

  const rows = attendance.filter((r) =>
    (r.work_date || "").startsWith(month)
  );

  return {
    month,
    rows,
    summary: calcMonthSummary(rows, employeeMap),
  };
}

// 명시적 사용 및 스코프 정리를 위한 기존 기존 export 내역 유지
export { calcWorkMinutes };
export { calcMonthSummary };