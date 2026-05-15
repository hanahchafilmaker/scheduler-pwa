// src/shared/rules/statusMachine.js

export const ATTENDANCE_STATUS = /** @type {const} */ ({
  OPEN:     "OPEN",     // 출근 전 / 기록 없음
  WORKING:  "WORKING",  // 실제 출근 완료 후 현재 근무 중
  PENDING:  "PENDING",  // 관리자 확인 및 승인 대기 중 (출퇴근 예외 발생 등)
  APPROVED: "APPROVED", // 관리자 최종 승인 완료
  REJECTED: "REJECTED", // 관리자 거절됨
  CLOSED:   "CLOSED",   // 정상 퇴근 완료되어 수동 승인이 필요 없는 일반 마감 상태
});

/**
 * 단일 출퇴근 기록(Row)의 데이터 상태를 분석하여 현재의 정확한 근무 상태를 반환합니다.
 */
export function getAttendanceStatus(row) {
  // 1. 기록이 없거나 실제 출근 시간이 없으면 무조건 OPEN (출근 전)
  if (!row || !row.check_in) {
    return ATTENDANCE_STATUS.OPEN;
  }

  // 2. 실제 출근은 했으나 아직 퇴근 기록이 없는 경우 (실시간 상태)
  if (!row.check_out) {
    // [보완 및 점검]: 실시간 근무 중인 상태를 최우선으로 볼 것인가, 
    // 혹은 퇴근 전 발생한 결재(예: 출근 예외 승인 등)를 우선할 것인가에 대한 처리.
    // 당일 출퇴근 원칙에서는 아직 근무 중이라면 WORKING으로 보는 것이 대시보드 혼선을 줄입니다.
    if (row.approval_status === "pending") {
      return ATTENDANCE_STATUS.PENDING;
    }
    return ATTENDANCE_STATUS.WORKING;
  }

  // 3. 실제 출근과 퇴근이 모두 완료된 이후의 상태 판단 (종료 상태)
  const s = row.approval_status;

  if (s === "rejected") {
    return ATTENDANCE_STATUS.REJECTED;
  }
  if (s === "pending") {
    return ATTENDANCE_STATUS.PENDING;
  }
  if (s === "approved" || s === "auto_closed") {
    return ATTENDANCE_STATUS.APPROVED;
  }

  // 4. 출퇴근 기록이 모두 존재하고, 특별한 승인 절차(대기/거절/결재완료)가 없는 일반적인 정상 퇴근 기록
  return ATTENDANCE_STATUS.CLOSED;
}

/**
 * 상태 값 자체가 최종 마감(확정) 상태인지 여부를 판별합니다.
 * APPROVED(승인 완료)와 CLOSED(일반 마감) 모두 더 이상 수정이 필요 없는 완료 상태입니다.
 */
export function isSettledStatus(status) {
  return (
    status === ATTENDANCE_STATUS.APPROVED || 
    status === ATTENDANCE_STATUS.CLOSED
  );
}

/**
 * 근무 기록 객체(Row)를 받아 해당 기록이 완전히 마감/확정되었는지 여부를 판별합니다.
 */
export function isRowSettled(row) {
  return isSettledStatus(getAttendanceStatus(row));
}