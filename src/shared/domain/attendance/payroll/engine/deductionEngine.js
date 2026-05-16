import { diffMinutes } from "../time/timeUtils";

/**
 * 지각 공제
 */
export function calcLateDeduct(plannedStart, checkIn) {
  if (!plannedStart || !checkIn) return 0;

  const late = diffMinutes(plannedStart, checkIn);
  return late > 0 ? late : 0;
}

/**
 * 조퇴 공제
 */
export function calcEarlyLeaveDeduct(plannedEnd, checkOut) {
  if (!plannedEnd || !checkOut) return 0;

  const early = diffMinutes(checkOut, plannedEnd);
  return early > 0 ? early : 0;
}

/**
 * 추가 연장 근무 (퇴근 이후)
 */
export function calcExtraLate(plannedEnd, checkOut) {
  if (!plannedEnd || !checkOut) return 0;

  const extra = diffMinutes(plannedEnd, checkOut);
  return extra > 0 ? extra : 0;
}