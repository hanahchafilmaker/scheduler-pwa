// src/shared/utils/payEngine.js
import { SETTLED_RULES } from "../../rules/settledRules";
import { diffMinutes } from "../time/timeUtils";
import { calcMonthSummary } from '../summary/paySummary';
import {
  calcLateDeduct,
  calcEarlyLeaveDeduct,
  calcExtraEarly,
  calcExtraLate,
} from "./payCalculator";

/**
 * 단일 근무 기록(Row) 단위를 기반으로 기본급, 공제분, 연장수당을 정밀 분리 정산합니다.
 * 
 * @param {Object} row - 출퇴근 기록 객체
 * @param {number|string} hourlyWage - 적용할 시급
 */
export function calcRowPayWithSeparation(row, hourlyWage) {
  const ZERO = {
    payrollBasePlannedMin: 0,
    payrollLateDeductMin: 0,
    payrollEarlyLeaveDeductMin: 0,
    payrollBasePaidMin: 0,
    payrollExtraMin: 0,
    payrollBasePay: 0,
    payrollExtraPay: 0,
    payrollTotalPay: 0,
  };

  // 정산 대상이 아니거나 데이터가 불완전하면 0원으로 즉시 반환 방어
  if (!row || !SETTLED_RULES.PAY(row)) return ZERO;

  const wage = Number(hourlyWage ?? row.hourly_wage ?? 0) || 0;
  const isOutOfSchedule = row.approval_reason === "out_of_schedule";
  const hasPlan = !!row.planned_start && !!row.planned_end;

  let baseMin = 0;
  let late = 0;
  let early = 0;
  let extra = 0;

  // 케이스 A: 스케줄 외 추가 근무이거나 정규 시간 계획이 없는 경우
  if (isOutOfSchedule || !hasPlan) {
    // 당일 출퇴근 원칙 하에 계획에 없던 근무이므로 '실제 일한 총 시간' 전체를 연장근무(Extra) 처리
    extra = diffMinutes(row.check_in, row.check_out);
  } 
  // 케이스 B: 일반적인 정규 스케줄 내 근무인 경우
  else {
    // 당일 예정되었던 스케줄 기본 시간 (예정퇴근 - 예정출근)
    baseMin = diffMinutes(row.planned_start, row.planned_end);

    // 공제 및 가산 시간 산출
    late = calcLateDeduct(row.planned_start, row.check_in);
    early = calcEarlyLeaveDeduct(row.planned_end, row.check_out);

    extra =
      calcExtraEarly(row.planned_start, row.check_in) +
      calcExtraLate(row.planned_end, row.check_out);
  }

  // 실제 기본급으로 인정받을 분 (기본 스케줄 분 - 지각분 - 조퇴분)
  const basePaid = Math.max(0, baseMin - late - early);

  // 시급 연산 및 원 단위 반올림 처리
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

/* ────────────────────────────────────────────────────────────────
   하위 호환 및 가독성 포맷팅을 위한 래퍼(Wrapper) 헬퍼 함수들
──────────────────────────────────────────────────────────────── */

export function calcPayrollLateDeductMinutes(row) { 
  return calcLateDeduct(row.planned_start, row.check_in); 
}

export function calcPayrollEarlyLeaveDeductMinutes(row) { 
  return calcEarlyLeaveDeduct(row.planned_end, row.check_out); 
}

export function formatLateMinutes(min) { 
  return min > 0 ? `${min}min` : ''; 
}

export function formatEarlyLeaveMinutes(min) { 
  return min > 0 ? `${min}min` : ''; 
}

/**
 * 특정 월 전체 정산 판판을 빌드하여 반환합니다.
 */
export function buildSettlement({ attendance = [], employees = [], month = '' }) { 
  const employeeMap = Object.fromEntries(employees.map(e => [e.id, e])); 
  
  // 조회 대상 월에 일치하는 데이터 필터링
  const rows = attendance.filter(r => (r.work_date || '').startsWith(month)); 
  
  return { 
    month, 
    rows, 
    summary: calcMonthSummary(rows, employeeMap) 
  }; 
}

// 명시적인 Re-export 정리
export { calcWorkMinutes } from './payCalculator';
export { calcMonthSummary };