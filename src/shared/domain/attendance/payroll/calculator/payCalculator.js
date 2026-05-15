// src/shared/utils/payCalculator.js
import { diffMinutes } from "../time/timeUtils";

/**
 * 1. 실제 총 근무 시간(분) 계산
 * @param {string} checkIn - 실제 출근 시간 (HH:mm)
 * @param {string} checkOut - 실제 퇴근 시간 (HH:mm)
 * @param {number|string} breakMin - 공제할 휴게 시간 (분)
 */
export function calcWorkMinutes(checkIn, checkOut, breakMin = 0) {
  // 실제 퇴근 시간 - 실제 출근 시간
  const total = diffMinutes(checkIn, checkOut);
  return Math.max(0, total - (Number(breakMin) || 0));
}

/**
 * 2. 지각 공제 분 계산 (5분 유예 정책)
 * @param {string} plannedStart - 예정 출근 시간 (HH:mm)
 * @param {string} actualIn - 실제 출근 시간 (HH:mm)
 * @returns {number} 5분 이하는 0분 공제, 6분 이상은 지각 분 전체 공제
 */
export function calcLateDeduct(plannedStart, actualIn) {
  // 실제 출근이 예정보다 늦은 경우만 분(Minute)이 나옴 (실제출근 - 예정출근)
  // 실제 출근이 더 빨랐다면 e < s가 되어 유틸 단에서 0이 반환됨
  const diff = diffMinutes(plannedStart, actualIn);
  return diff <= 5 ? 0 : diff;
}

/**
 * 3. 조퇴 공제 분 계산 (5분 유예 정책)
 * @param {string} plannedEnd - 예정 퇴근 시간 (HH:mm)
 * @param {string} actualOut - 실제 퇴근 시간 (HH:mm)
 * @returns {number} 5분 이하는 0분 공제, 6분 이상은 조퇴 분 전체 공제
 */
export function calcEarlyLeaveDeduct(plannedEnd, actualOut) {
  // 실제 퇴근이 예정보다 일찍 일어난 경우만 분이 나옴 (예정퇴근 - 실제퇴근)
  // 정시 퇴근 혹은 연장 퇴근했다면 e < s가 되어 유틸 단에서 0이 반환됨
  const diff = diffMinutes(actualOut, plannedEnd);
  return diff <= 5 ? 0 : diff;
}

/**
 * 4. 조기 출근 인정 시간 계산 (최대 10분 한도 제한)
 * @param {string} plannedStart - 예정 출근 시간 (HH:mm)
 * @param {string} actualIn - 실제 출근 시간 (HH:mm)
 */
export function calcExtraEarly(plannedStart, actualIn) {
  // 예정 시간보다 일찍 출근한 경우만 분이 나옴 (예정출근 - 실제출근)
  const diff = diffMinutes(actualIn, plannedStart);
  return Math.min(diff, 10);
}

/**
 * 5. 연장 퇴근 시간 계산
 * @param {string} plannedEnd - 예정 퇴근 시간 (HH:mm)
 * @param {string} actualOut - 실제 퇴근 시간 (HH:mm)
 */
export function calcExtraLate(plannedEnd, actualOut) {
  // 예정 시간보다 늦게 퇴근한 경우만 분이 나옴 (실제퇴근 - 예정퇴근)
  return diffMinutes(plannedEnd, actualOut);
}