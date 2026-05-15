/**
 * src/domain/attendance/selectors.js
 *
 * attendance row ??? ? ???? ?? ? .
 *
 * :
 *   - getAttendanceStatus()???, approval_status? ?? ???
 *   - DB ? ?. ? ?.
 *   - UI ??? ? ??? ???
 *
 * ?    ? ????pay.js??isPaySettledRow() ????
 *     isSettled / selectSettled ??UI ???? ? ????????
 */

import { getAttendanceStatus, ATTENDANCE_STATUS } from "./getAttendanceStatus";

// ??? ? row ? ? ???????????????????????????????????????????????????????

export const isOpen     = (row) => getAttendanceStatus(row) === ATTENDANCE_STATUS.OPEN;
export const isWorking  = (row) => getAttendanceStatus(row) === ATTENDANCE_STATUS.WORKING;
export const isPending  = (row) => getAttendanceStatus(row) === ATTENDANCE_STATUS.PENDING;
export const isApproved = (row) => getAttendanceStatus(row) === ATTENDANCE_STATUS.APPROVED;
export const isRejected = (row) => getAttendanceStatus(row) === ATTENDANCE_STATUS.REJECTED;
export const isClosed   = (row) => getAttendanceStatus(row) === ATTENDANCE_STATUS.CLOSED;

/**
 * UI ???? ? ? (approved + auto_closed + ? CLOSED)
 *
 * ?    ? ??? ??.
 *      ? ?? ??pay.js??isPaySettledRow() ?
 *     ?????UI? "?" ? ?? ????
 */
export const isSettled  = (row) =>
  [ATTENDANCE_STATUS.APPROVED, ATTENDANCE_STATUS.CLOSED].includes(getAttendanceStatus(row));

// ???  ?? ?????????????????????????????????????????????????????????????

/**
 * ? ???row  
 * @param {object[]} rows
 * @param {string} status - ATTENDANCE_STATUS ?
 */
export function selectByStatus(rows, status) {
  return rows.filter((row) => getAttendanceStatus(row) === status);
}

/** ??? */
export const selectPending  = (rows) => selectByStatus(rows, ATTENDANCE_STATUS.PENDING);

/**  ? */
export const selectWorking  = (rows) => selectByStatus(rows, ATTENDANCE_STATUS.WORKING);

/** UI ???? ?  (approved + auto_closed + CLOSED) */
export const selectSettled  = (rows) => rows.filter(isSettled);

/**   */
export const selectRejected = (rows) => selectByStatus(rows, ATTENDANCE_STATUS.REJECTED);

/** ? (schedule? ???attendance ? ??  ?) */
export const selectOpen     = (rows) => selectByStatus(rows, ATTENDANCE_STATUS.OPEN);

// ???  ?? ?????????????????????????????????????????????????????????????

/**
 * ? ? ?? ??
 * @param {object[]} rows
 * @param {string} dateStr - "YYYY-MM-DD"
 */
export function selectByDate(rows, dateStr) {
  return rows.filter((row) => row.date === dateStr);
}

/**
 *  ID ?? ??
 * @param {object[]} rows
 * @param {string|number} employeeId
 */
export function selectByEmployee(rows, employeeId) {
  return rows.filter((row) => String(row.employee_id) === String(employeeId));
}

/**
 * ?????(?, ?, ?, ?,  ?)
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
 * ???? (AttTab summary??
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

