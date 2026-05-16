/**
 * Payroll Lock Engine (SaaS Safety Layer)
 *
 * 역할:
 * - 월급 정산 중복 실행 방지
 * - LOCKED 상태 검증
 * - batchPayrollService 보호
 */

export type PayrollLockStatus = "OPEN" | "LOCKED" | "PROCESSING";

export interface PayrollLock {
  id?: string;
  year_month: string;
  status: PayrollLockStatus;
  locked_at?: string | null;
  locked_by?: string | null;
  note?: string | null;
}

/**
 * 🚨 핵심 가드 함수
 * - LOCKED 상태면 즉시 throw
 */
export function assertNotLocked(lock: PayrollLock | null | undefined) {
  if (!lock) return;

  if (lock.status === "LOCKED") {
    throw new Error(
      `🚫 Payroll is locked for ${lock.year_month}`
    );
  }
}

/**
 * batch 시작 시 잠금 확인용 (읽기 전용 가드)
 */
export function assertCanStartProcessing(lock: PayrollLock | null | undefined) {
  if (!lock) return;

  if (lock.status === "LOCKED") {
    throw new Error(
      `🚫 Cannot start payroll. Already locked: ${lock.year_month}`
    );
  }

  if (lock.status === "PROCESSING") {
    throw new Error(
      `⚠️ Payroll already processing: ${lock.year_month}`
    );
  }
}

/**
 * LOCK 생성
 */
export function createLock(year_month: string, userId?: string): PayrollLock {
  return {
    year_month,
    status: "PROCESSING",
    locked_at: null,
    locked_by: userId ?? null,
    note: "batch started",
  };
}

/**
 * LOCK 완료 처리
 */
export function finalizeLock(lock: PayrollLock, userId?: string): PayrollLock {
  return {
    ...lock,
    status: "LOCKED",
    locked_at: new Date().toISOString(),
    locked_by: userId ?? lock.locked_by,
    note: "batch completed",
  };
}

/**
 * LOCK 해제 (관리자용)
 */
export function unlock(lock: PayrollLock): PayrollLock {
  return {
    ...lock,
    status: "OPEN",
    locked_at: null,
    note: "manually unlocked",
  };
}