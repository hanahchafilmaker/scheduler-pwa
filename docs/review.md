/**
 * src/domain/attendance/selectors.js
 *
 * attendance row 배열을 상태 기반으로 필터링하는 순수 셀렉터 함수 모음.
 *
 * 규칙:
 *   - getAttendanceStatus()만 사용하고, approval_status를 직접 비교하지 않는다.
 *   - DB 접근 없음. 순수 함수.
 *   - UI 렌더링 판단 로직은 포함하지 않는다.
 */

import { getAttendanceStatus, ATTENDANCE_STATUS } from "./getAttendanceStatus";

// ─── 단일 row 상태 필터 ───────────────────────────────────────────────────────

export const isOpen     = (row) => getAttendanceStatus(row) === ATTENDANCE_STATUS.OPEN;
export const isWorking  = (row) => getAttendanceStatus(row) === ATTENDANCE_STATUS.WORKING;
export const isPending  = (row) => getAttendanceStatus(row) === ATTENDANCE_STATUS.PENDING;
export const isApproved = (row) => getAttendanceStatus(row) === ATTENDANCE_STATUS.APPROVED;
export const isRejected = (row) => getAttendanceStatus(row) === ATTENDANCE_STATUS.REJECTED;
export const isClosed   = (row) => getAttendanceStatus(row) === ATTENDANCE_STATUS.CLOSED;

/** 정산 포함 대상 (approved + auto_closed) */
export const isSettled  = (row) =>
  [ATTENDANCE_STATUS.APPROVED, ATTENDANCE_STATUS.CLOSED].includes(getAttendanceStatus(row));

// ─── 배열 셀렉터 ─────────────────────────────────────────────────────────────

/**
 * 특정 상태인 row 목록 반환
 * @param {object[]} rows
 * @param {string} status - ATTENDANCE_STATUS 값
 */
export function selectByStatus(rows, status) {
  return rows.filter((row) => getAttendanceStatus(row) === status);
}

/** 승인대기 목록 */
export const selectPending  = (rows) => selectByStatus(rows, ATTENDANCE_STATUS.PENDING);

/** 근무 중 목록 */
export const selectWorking  = (rows) => selectByStatus(rows, ATTENDANCE_STATUS.WORKING);

/** 정산 확정 목록 (approved + auto_closed) */
export const selectSettled  = (rows) => rows.filter(isSettled);

/** 거절 목록 */
export const selectRejected = (rows) => selectByStatus(rows, ATTENDANCE_STATUS.REJECTED);

/** 미출근 목록 (schedule은 있지만 attendance가 없는 경우는 별도 처리 필요) */
export const selectOpen     = (rows) => selectByStatus(rows, ATTENDANCE_STATUS.OPEN);

// ─── 복합 셀렉터 ─────────────────────────────────────────────────────────────

/**
 * 오늘 날짜 기준으로 필터링
 * @param {object[]} rows
 * @param {string} dateStr - "YYYY-MM-DD"
 */
export function selectByDate(rows, dateStr) {
  return rows.filter((row) => row.date === dateStr);
}

/**
 * 직원 ID 기준으로 필터링
 * @param {object[]} rows
 * @param {string|number} employeeId
 */
export function selectByEmployee(rows, employeeId) {
  return rows.filter((row) => String(row.employee_id) === String(employeeId));
}

/**
 * 키워드 검색 (이름, 날짜, 파트, 사유, 메모 포함)
 * @param {object[]} rows
 * @param {string} keyword
 */
export function selectByKeyword(rows, keyword) {
  if (!keyword.trim()) return rows;
  const q = keyword.trim().toLowerCase();
  return rows.filter((row) =>
    [row.name, row.employee_id, row.part, row.date, row.approval_status, row.approval_reason, row.memo]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q))
  );
}

/**
 * 승인대기 요약 (AttTab summary용)
 * @param {object[]} rows
 */
export function buildAttendanceSummary(rows) {
  return {
    total:    rows.length,
    pending:  selectPending(rows).length,
    approved: selectByStatus(rows, ATTENDANCE_STATUS.APPROVED).length,
    rejected: selectRejected(rows).length,
    working:  selectWorking(rows).length,
    settled:  selectSettled(rows).length,
  };
}