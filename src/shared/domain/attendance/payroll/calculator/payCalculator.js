import { diffMinutes } from "./timeUtils";

// 
// WORK MINUTES
// 
export function calcWorkMinutes(checkIn, checkOut, breakMin = 0) {
  const total = diffMinutes(checkIn, checkOut);
  return Math.max(0, total - (Number(breakMin) || 0));
}

// 
// LATE / EARLY RULE
// 
export function calcLateDeduct(plannedStart, actualIn) {
  const diff = diffMinutes(plannedStart, actualIn);
  return diff <= 5 ? 0 : diff;
}

export function calcEarlyLeaveDeduct(plannedEnd, actualOut) {
  const diff = diffMinutes(actualOut, plannedEnd);
  return diff <= 5 ? 0 : diff;
}

// 
// EXTRA TIME
// 
export function calcExtraEarly(plannedStart, actualIn) {
  const diff = diffMinutes(plannedStart, actualIn);
  return Math.min(diff, 10);
}

export function calcExtraLate(plannedEnd, actualOut) {
  return diffMinutes(plannedEnd, actualOut);
}
