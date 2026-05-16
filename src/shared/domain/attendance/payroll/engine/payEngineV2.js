// src/shared/domain/attendance/payroll/engine/payEngineV2.js

import { diffMinutes } from "../time/timeUtils";

import {
  calcLateDeduct,
  calcEarlyLeaveDeduct,
  calcExtraLate,
} from "./deductionEngine";

/**
 * 5분 단위 정산 헬퍼 함수
 * @param {number} minutes - 원본 분(min)
 * @param {'floor'|'ceil'|'round'} mode - 절사 방식
 */
function roundTo5Minutes(minutes, mode = 'floor') {
  if (mode === 'ceil') return Math.ceil(minutes / 5) * 5;
  if (mode === 'round') return Math.round(minutes / 5) * 5;
  return Math.floor(minutes / 5) * 5; // 기본값: 버림
}

/**
 * 단일 세션 기반 급여 계산 엔진 (3대 급여 정책 반영 버전)
 * @param {Object} session - 출근부 행 데이터 (row)
 * @param {number} [hourlyWage] - 기본 시급
 * @param {Object} [policy] - 급여 정책 객체
 * @param {boolean} [policy.enableExtraPay=true] - 1. 수당 토글 (true: 수당 계산, false: 수당 0원)
 * @param {boolean} [policy.use5MinRule=true] - 2. 5분 기준 절사 여부
 * @param {'planned'|'actual'} [policy.calculationMode='planned'] - 3. 'planned'(인정시간/스케줄 기준) vs 'actual'(실근무 기준)
 */
export function calcSessionPay(session, hourlyWage, policy = {}) {
  // 기본 정책 값 셋팅
  const {
    enableExtraPay = true,
    use5MinRule = true,
    calculationMode = 'planned' 
  } = policy;

  if (!session || !session.check_in || !session.check_out) {
    return {
      workMin: 0,
      baseMin: 0,
      late: 0,
      early: 0,
      extra: 0,
      basePay: 0,
      extraPay: 0,
      totalPay: 0,
    };
  }

  const wage = Number(hourlyWage || session.hourly_wage || 0);
  const breakMin = Number(session.break_min || 0);

  const isOutOfSchedule =
    session.approval_reason === "out_of_schedule" ||
    session.part === "대타";

  // 실제 출퇴근 시간으로 계산한 총 실근무 분
  let workMin = diffMinutes(session.check_in, session.check_out);
  if (use5MinRule) {
    workMin = roundTo5Minutes(workMin, 'floor'); // 실근무는 기본 버림 처리
  }

  let baseMin = 0;
  let late = 0;
  let early = 0;
  let extra = 0;

  // 스케줄 외 근무이거나, 계획된 시간이 없거나, 정책이 '실근무 기준(actual)'인 경우
  if (isOutOfSchedule || !session.planned_start || !session.planned_end || calculationMode === 'actual') {
    // [정책 3] 실근무 시간 로직 적용
    baseMin = workMin;
    late = 0;
    early = 0;
    extra = 0;
  } else {
    // [정책 3] 인정 시간(스케줄) 기준 로직 적용
    baseMin = diffMinutes(session.planned_start, session.planned_end);

    // 공제 엔진을 통해 각 항목 계산
    let rawLate = calcLateDeduct(session.planned_start, session.check_in);
    let rawEarly = calcEarlyLeaveDeduct(session.planned_end, session.check_out);
    let rawExtra = calcExtraLate(session.planned_end, session.check_out);

    // [정책 2] 5분 기준 보정 적용
    if (use5MinRule) {
      late = rawLate > 0 ? roundTo5Minutes(rawLate, 'ceil') : 0;        // 지각은 근로자에게 불리하므로 올림 피드백이 일반적
      early = rawEarly > 0 ? roundTo5Minutes(rawEarly, 'ceil') : 0;    // 조퇴도 5분 단위 올림 차감
      extra = rawExtra > 0 ? roundTo5Minutes(rawExtra, 'floor') : 0;   // 추가 근무는 5분 단위 꽉 채운 것만 인정 (버림)
    } else {
      late = rawLate;
      early = rawEarly;
      extra = rawExtra;
    }
  }

  // 기본 인정 분 계산 (기본시간 - 지각 - 조퇴 - 휴게시간)
  let basePaid = Math.max(0, baseMin - late - early - breakMin);

  // 급여 산출
  const basePay = Math.round((basePaid / 60) * wage);
  
  // [정책 1] 수당 토글 적용
  const extraPay = enableExtraPay ? Math.round((extra / 60) * wage) : 0;

  return {
    workMin,
    baseMin,
    late,
    early,
    extra,
    basePaid,
    basePay,
    extraPay,
    totalPay: basePay + extraPay,
  };
}

/**
 * 테이블 행(Row) 데이터 기반 급여 계산 wrapper 함수
 * SettleTab.jsx와 호환성을 유지합니다.
 */
export function calcRowPayWithSeparation(row, customWage) {
  // 컴포넌트 렌더링 시 기본 정책 환경을 주입하여 계산합니다.
  // 필요 시 이 부분 설정을 토글 제어 컴포넌트의 state와 연결하시면 됩니다.
  const defaultPolicy = {
    enableExtraPay: true,  // 수당 토글 (true/false)
    use5MinRule: true,     // 5분 기준 절사 (true/false)
    calculationMode: 'planned' // 로직 선택 ('planned': 인정시간 기준, 'actual': 실근무 기준)
  };

  return calcSessionPay(row, customWage, defaultPolicy);
}