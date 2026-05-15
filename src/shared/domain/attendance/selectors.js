/**
 * src/domain/attendance/selectors.js
 *
 * attendance row 데이터를 상태 및 조건별로 안전하게 분류하고 추출하는 셀렉터 모음입니다.
 * 
 * 특징:
 *   - getAttendanceStatus()를 기반으로 approval_status와 출퇴근 기록을 종합 분석합니다.
 *   - 실제 급여 계산용 정산 대상은 payEngine.js / settledRules.js의 isPaySettledRow()를 사용하고,
 *     여기서의 isSettled / selectSettled는 UI 마감 및 배지 표시 상태를 다룹니다.
 */

// 이전 단계에서 확립한 상태 머신 모듈로 인포트 경로 통합
import { getAttendanceStatus, ATTENDANCE_STATUS } from "./statusMachine";

// ─────────────────────────────────────────────
// 1. 단일 행(Row) 상태 판별 셀렉터
// ─────────────────────────────────────────────

export const isOpen     = (row) => getAttendanceStatus(row) === ATTENDANCE_STATUS.OPEN;
export const isWorking  = (row) => getAttendanceStatus(row) === ATTENDANCE_STATUS.WORKING;
export const isPending  = (row) => getAttendanceStatus(row) === ATTENDANCE_STATUS.PENDING;
export const isApproved = (row) => getAttendanceStatus(row) === ATTENDANCE_STATUS.APPROVED;
export const isRejected = (row) => getAttendanceStatus(row) === ATTENDANCE_STATUS.REJECTED;
export const isClosed   = (row) => getAttendanceStatus(row) === ATTENDANCE_STATUS.CLOSED;

/**
 * UI 마감 상태 여부 판별 (승인 완료 또는 일반 마감)
 */
export const isSettled  = (row) => {
  const status = getAttendanceStatus(row);
  return status === ATTENDANCE_STATUS.APPROVED || status === ATTENDANCE_STATUS.CLOSED;
};

// ─────────────────────────────────────────────
// 2. 배열 필터링 및 그룹 분류 셀렉터
// ─────────────────────────────────────────────

/**
 * 특정 상태 코드를 기준으로 로우 필터링
 */
export function selectByStatus(rows, status) {
  return Array.isArray(rows) ? rows.filter((row) => getAttendanceStatus(row) === status) : [];
}

/** 승인 대기중 (확인 필요) */
export const selectPending  = (rows) => selectByStatus(rows, ATTENDANCE_STATUS.PENDING);

/** 현재 근무 중 */
export const selectWorking  = (rows) => selectByStatus(rows, ATTENDANCE_STATUS.WORKING);

/** UI상 마감/확정 완료 리스트 */
export const selectSettled  = (rows) => Array.isArray(rows) ? rows.filter(isSettled) : [];

/** 거절됨 */
export const selectRejected = (rows) => selectByStatus(rows, ATTENDANCE_STATUS.REJECTED);

/** 출근 전 오픈 상태 */
export const selectOpen     = (rows) => selectByStatus(rows, ATTENDANCE_STATUS.OPEN);

// ─────────────────────────────────────────────
// 3. 조건 기반 검색 및 특정 대상 분류 셀렉터
// ─────────────────────────────────────────────

/**
 * 지정된 날짜("YYYY-MM-DD")에 해당하는 기록 필터링
 */
export function selectByDate(rows, dateStr) {
  if (!Array.isArray(rows)) return [];
  // 데이터 구조에 따라 row.date 혹은 row.work_date 유연성 확보
  return rows.filter((row) => (row.date || row.work_date) === dateStr);
}

/**
 * 특정 직원 ID 기준 기록 필터링
 */
export function selectByEmployee(rows, employeeId) {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => String(row.employee_id) === String(employeeId));
}

/**
 * 대시보드 통합 키워드 검색 (이름, 파트, 날짜, 메모, 사유 등)
 */
export function selectByKeyword(rows, keyword) {
  if (!Array.isArray(rows)) return [];
  if (!keyword || !keyword.trim()) return rows;
  
  const q = keyword.trim().toLowerCase();
  return rows.filter((row) =>
    [
      row.name, 
      row.employee_id, 
      row.part, 
      row.date, 
      row.work_date,
      row.approval_status, 
      row.approval_reason, 
      row.memo
    ]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q))
  );
}

// ─────────────────────────────────────────────
// 4. 대시보드 요약 정보 빌더 (핵심 최적화 🚀)
// ─────────────────────────────────────────────

/**
 * 출퇴근 현황 Tab 상단 요약 카운트 보드 빌더
 * 단일 패스(Reduce 1회) 순회 방식으로 기존 코드 대비 속도를 최적화했습니다.
 */
export function buildAttendanceSummary(rows) {
  if (!Array.isArray(rows)) {
    return { total: 0, pending: 0, approved: 0, rejected: 0, working: 0, settled: 0 };
  }

  const counts = rows.reduce(
    (acc, row) => {
      const status = getAttendanceStatus(row);

      if (status === ATTENDANCE_STATUS.PENDING) acc.pending++;
      else if (status === ATTENDANCE_STATUS.APPROVED) acc.approved++;
      else if (status === ATTENDANCE_STATUS.REJECTED) acc.rejected++;
      else if (status === ATTENDANCE_STATUS.WORKING) acc.working++;

      // UI 확정 상태(APPROVED + CLOSED) 누적 카운트
      if (status === ATTENDANCE_STATUS.APPROVED || status === ATTENDANCE_STATUS.CLOSED) {
        acc.settled++;
      }

      return acc;
    },
    { pending: 0, approved: 0, rejected: 0, working: 0, settled: 0 }
  );

  return {
    total: rows.length,
    ...counts,
  };
}