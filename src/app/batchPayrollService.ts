import { buildPayroll } from "./payrollAppService";
import { writePayrollAudit } from "../shared/domain/attendance/payroll/audit/payrollAudit";
import { assertNotLocked } from "../shared/domain/attendance/payroll/lock/payrollLock";

/**
 * 💥 전체 직원 월급 일괄 계산
 */
export function runBatchPayroll({
  employees,
  attendanceMap,
  month,
}: {
  employees: any[];
  attendanceMap: Record<string, any[]>;
  month: string;
}) {
  const results = [];

  for (const emp of employees) {
    const attendance = attendanceMap[emp.id] || [];


    const payroll = buildPayroll({
      employee: emp,
      attendance,
      month,
    });

    // 🔥 Audit 기록
    writePayrollAudit({
      id: crypto.randomUUID(),
      employeeId: emp.id,
      month,
      before: null,
      after: payroll,
      action: "GENERATE",
      createdAt: new Date().toISOString(),
    });

    results.push({
      employeeId: emp.id,
      payroll,
    });
  }

  return results;
}