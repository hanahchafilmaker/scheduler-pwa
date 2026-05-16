import { diffMinutes } from "../time/timeUtils";

/**
 * 실제 총 근무 시간(분)
 */
export function calcWorkMinutes(checkIn, checkOut, breakMin = 0) {
  const total = diffMinutes(checkIn, checkOut);
  return Math.max(0, total - (Number(breakMin) || 0));
}

/**
 * 지각 공제 (5분 유예)
 */
export function calcLateDeduct(plannedStart, actualIn) {
  const diff = diffMinutes(plannedStart, actualIn);
  return diff <= 5 ? 0 : diff;
}

/**
 * 조퇴 공제 (5분 유예)
 */
export function calcEarlyLeaveDeduct(plannedEnd, actualOut) {
  const diff = diffMinutes(actualOut, plannedEnd);
  return diff <= 5 ? 0 : diff;
}

/**
 * 조기 출근 인정 (최대 10분)
 */
export function calcExtraEarly(plannedStart, actualIn) {
  const diff = diffMinutes(actualIn, plannedStart);
  return Math.min(diff, 10);
}

/**
 * 연장 퇴근 인정
 */
export function calcExtraLate(plannedEnd, actualOut) {
  return diffMinutes(plannedEnd, actualOut);
}