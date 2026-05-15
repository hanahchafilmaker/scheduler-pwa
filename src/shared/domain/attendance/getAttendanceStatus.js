/**
 * src/domain/attendance/getAttendanceStatus.js
 *
 * 근태 상태 판단의 단일 진실 소스 (Single Source of Truth)
 *
 * 아키텍처 규칙:
 *   - UI에서 check_in/out 또는 approval_status를 직접 비교하지 않는다.
 *   - 모든 상태 판단은 이 함수를 통한다.
 *   - 이 함수는 DB 접근 없이 row 객체만으로 동작하는 순수 함수여야 한다.
 *
 * 상태 우선순위 (위에서 아래로):
 *   OPEN     → check_in 없음 (미출근)
 *   WORKING  → check_in 있고 check_out 없음
 *   REJECTED → check_out 있고 approval_status = rejected
 *   PENDING  → check_out 있고 approval_status = pending
 *   APPROVED → approved 또는 auto_closed
 *   CLOSED   → 그 외 check_out 있음 (명시적 상태 없음)
 */

export const ATTENDANCE_STATUS = /** @type {const} */ ({
  OPEN:     "OPEN",
  WORKING:  "WORKING",
  PENDING:  "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CLOSED:   "CLOSED",
});

/**
 * @param {object|null} row - attendance row
 * @returns {string} ATTENDANCE_STATUS 값 중 하나
 */
export function getAttendanceStatus(row) {
  if (!row) return ATTENDANCE_STATUS.OPEN;

  // 1. 출근 기록 없음
  if (!row.check_in) return ATTENDANCE_STATUS.OPEN;

  // 2. 출근은 했지만 퇴근 기록 없음 → 근무 중
  if (!row.check_out) return ATTENDANCE_STATUS.WORKING;

  // 3. 퇴근 완료 — approval_status 기반 판단
  const s = row.approval_status;

  if (s === "rejected")                          return ATTENDANCE_STATUS.REJECTED;
  if (s === "pending")                           return ATTENDANCE_STATUS.PENDING;
  if (s === "approved" || s === "auto_closed")   return ATTENDANCE_STATUS.APPROVED;

  // 4. approval_status가 없거나 알 수 없는 값 → 단순 CLOSED
  return ATTENDANCE_STATUS.CLOSED;
}

/**
 * 정산 대상 여부 (pay.js의 isPaySettledRow와 동일 기준, domain 레이어 버전)
 *
 * 포함: APPROVED, CLOSED (및 auto_closed)
 * 제외: PENDING, REJECTED, OPEN, WORKING
 */
export function isSettledStatus(status) {
  return status === ATTENDANCE_STATUS.APPROVED || status === ATTENDANCE_STATUS.CLOSED;
}

/**
 * row에서 직접 정산 대상 여부를 반환하는 편의 함수
 */
export function isRowSettled(row) {
  return isSettledStatus(getAttendanceStatus(row));
}