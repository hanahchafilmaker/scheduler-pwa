import { filterPaySettled } from "../../rules/settledRules";
import { calcRowPayWithSeparation } from "../engine/payEngine";

/**
 * 특정 월의 전체 출퇴근 기록을 기반으로 급여 총계를 산출합니다.
 * 
 * @param {Array} rows - 출퇴근 기록 배열
 * @param {Object} employeeMap - 직원 ID를 Key로 가지는 직원 정보 매핑 객체
 * @returns {Object} 월간 기본급, 연장수당, 총합계 금액
 */
export function calcMonthSummary(rows = [], employeeMap = {}) {
  // 1. 정산 대상 행들만 필터링
  const settledRows = filterPaySettled(rows);

  // 2. 단일 루프(reduce)로 메모리 절약 및 성능 최적화 진행
  const total = settledRows.reduce(
    (acc, row) => {
      if (!row) return acc;

      // 우선순위: employeeMap의 시급 -> row 자체 시급 -> 0원 예외 처리
      const wage = Number(
        employeeMap?.[row.employee_id]?.hourly_wage ?? row.hourly_wage ?? 0
      ) || 0;

      // 단일 행의 정산 금액 분리 계산 실행
      const payResult = calcRowPayWithSeparation(row, wage);

      // 누적 합산 (예외값 방어를 위한 '|| 0' 추가)
      acc.base += payResult.payrollBasePay || 0;
      acc.extra += payResult.payrollExtraPay || 0;

      return acc;
    },
    { base: 0, extra: 0 } // 초기 수당 객체
  );

  // 3. 최종 금액 구조화하여 반환
  return {
    totalBasePay: total.base,
    totalExtraPay: total.extra,
    totalPay: total.base + total.extra,
  };
}