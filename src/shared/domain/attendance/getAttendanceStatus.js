
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


  if (!row.check_in) return ATTENDANCE_STATUS.OPEN;


  if (!row.check_out) {
    if (row.approval_status === "pending") return ATTENDANCE_STATUS.PENDING;
    return ATTENDANCE_STATUS.WORKING;
  }


  const s = row.approval_status;

  if (s === "rejected")                        return ATTENDANCE_STATUS.REJECTED;
  if (s === "pending")                         return ATTENDANCE_STATUS.PENDING;
  if (s === "approved" || s === "auto_closed") return ATTENDANCE_STATUS.APPROVED;


  return ATTENDANCE_STATUS.CLOSED;
}


export function isSettledStatus(status) {
  return status === ATTENDANCE_STATUS.APPROVED || status === ATTENDANCE_STATUS.CLOSED;
}

export function isRowSettled(row) {
  return isSettledStatus(getAttendanceStatus(row));
}

