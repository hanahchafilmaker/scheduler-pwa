/**
 * src/domain/attendance/getAttendanceStatus.js
 *
 * ⚠️  "settled" 판단의 단일 소스는 pay.js의 isPaySettledRow() 입니다.
 *     isSettledStatus / isRowSettled 는 UI 상태 표시용으로만 사용하고,
 *     급여 계산 포함 여부는 반드시 isPaySettledRow()를 사용하세요.
 *
 * 상태 우선순위 (위에서 아래로):
 *   OPEN     → check_in 없음 (미출근)
 *   WORKING  → check_in 있고 check_out 없음 (단, approval_status=pending 제외)
 *   PENDING  → approval_status = pending (check_out 여부 무관)
 *   REJECTED → check_out 있고 approval_status = rejected
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

export function getAttendanceStatus(row) {
  if (!row) return ATTENDANCE_STATUS.OPEN;

  // 1. 출근 기록 없음
  if (!row.check_in) return ATTENDANCE_STATUS.OPEN;

  // 2. 퇴근 기록 없음 — 단, approval_status가 pending이면 승인 필요 상태
  if (!row.check_out) {
    if (row.approval_status === "pending") return ATTENDANCE_STATUS.PENDING;
    return ATTENDANCE_STATUS.WORKING;
  }

  // 3. 퇴근 완료 — approval_status 기반 판단
  const s = row.approval_status;

  if (s === "rejected")                        return ATTENDANCE_STATUS.REJECTED;
  if (s === "pending")                         return ATTENDANCE_STATUS.PENDING;
  if (s === "approved" || s === "auto_closed") return ATTENDANCE_STATUS.APPROVED;

  // 4. approval_status가 없거나 알 수 없는 값
  return ATTENDANCE_STATUS.CLOSED;
}

/**
 * UI 표시용 settled 판단 (APPROVED + CLOSED)
 *
 * 급여 계산 포함 여부는 pay.js의 isPaySettledRow()를 사용할 것.
 * 이 함수는 UI에서 "처리 완료" 배지 표시 등에만 사용.
 */
export function isSettledStatus(status) {
  return status === ATTENDANCE_STATUS.APPROVED || status === ATTENDANCE_STATUS.CLOSED;
}

export function isRowSettled(row) {
  return isSettledStatus(getAttendanceStatus(row));
}