import { buildWorkSessions } from "../shared/domain/attendance/payroll/engine/sessionBuilder";
import { payEngineV2 } from "../shared/domain/attendance/payroll/engine/payEngineV2";
import { buildPayrollViewModel } from "../shared/domain/attendance/payroll/settlement/buildPayrollViewModel";

/**
 * 💥 SaaS Payroll Orchestrator (Single Entry Point)
 *
 * 역할:
 * - Attendance Row → Session 변환
 * - Session → Payroll 계산
 * - ViewModel 생성 (UI / PDF / Email 공용)
 */
export function buildPayroll({
  attendance = [],
  employee,
  month,
}: {
  attendance: any[];
  employee: {
    id: string;
    name: string;
    hourlyWage: number;
    department?: string;
    role?: string;
  };
  month: string;
}) {
  // ---------------------------------------
  // 1️⃣ ROW → SESSION
  // ---------------------------------------
  const sessions = buildWorkSessions(attendance);

  // ---------------------------------------
  // 2️⃣ SESSION → PAYROLL ENGINE
  // ---------------------------------------
  const payroll = payEngineV2(
    sessions,
    employee.hourlyWage
  );

  // ---------------------------------------
  // 3️⃣ VIEWMODEL 생성
  // ---------------------------------------
  const viewModel = buildPayrollViewModel({
    employee,
    sessions: payroll.sessions,
    month,
  });

  return viewModel;
}