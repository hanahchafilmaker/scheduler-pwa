import { diffMinutes } from "../time/timeUtils";

/**
 * 실제 총 근무 시간(분)
 */
export function calcWorkMinutes(checkIn, checkOut, breakMin = 0) {
  const total = diffMinutes(checkIn, checkOut);
  return Math.max(0, total - (Number(breakMin) || 0));
}

/**
 * 지각 공제 (유예 없음 — 1분이라도 늦으면 전체 공제)
 */
export function calcLateDeduct(plannedStart, actualIn) {
  const diff = diffMinutes(plannedStart, actualIn);
  return diff <= 0 ? 0 : diff;
}

/**
 * 조퇴 공제 (유예 없음 — 1분이라도 일찍 나가면 전체 공제)
 */
export function calcEarlyLeaveDeduct(plannedEnd, actualOut) {
  const diff = diffMinutes(actualOut, plannedEnd);
  return diff <= 0 ? 0 : diff;
}

/**
 * 조기 출근 인정 없음 (항상 0)
 */
export function calcExtraEarly(plannedStart, actualIn) {
  return 0;
}

/**
 * 연장 퇴근 인정
 */
export function calcExtraLate(plannedEnd, actualOut) {
  return diffMinutes(plannedEnd, actualOut);
}