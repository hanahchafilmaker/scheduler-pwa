import { payEngineV2 } from "../engine/payEngineV2";

/**
 * 💥 ViewModel Builder (SaaS Contract Layer)
 */
export function buildPayrollViewModel({
  employee,
  sessions,
  month,
}: {
  employee: any;
  sessions: any[];
  month: string;
}) {
  const payroll = payEngineV2(
    sessions,
    employee.hourlyWage
  );

  return {
    meta: {
      employeeId: employee.id,
      employeeName: employee.name,
      month,
      generatedAt: new Date().toISOString(),
    },

    employee,

    sessions: payroll.sessions,

    summary: payroll.summary,

    pay: payroll.pay,

    flags: {
      hasMissingCheckout: payroll.sessions.some(
        (s: any) => !s.end
      ),
      hasOutOfSchedule: payroll.sessions.some(
        (s: any) => s.is_out_of_schedule
      ),
      hasAnomalies: false,
    },

    breakdown: {
      daily: [],
    },
  };
}