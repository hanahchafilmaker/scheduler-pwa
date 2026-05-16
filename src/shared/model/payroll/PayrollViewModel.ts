export type PayrollViewModel = {
  meta: {
    employeeId: string;
    employeeName: string;
    month: string;
    generatedAt: string;
  };

  employee: {
    id: string;
    name: string;
    hourlyWage: number;
    department?: string | null;
    role?: string | null;
  };

  sessions: WorkSessionView[];

  summary: {
    totalWorkMinutes: number;

    baseMinutes: number;
    grossMinutes: number;

    lateMinutes: number;
    earlyLeaveMinutes: number;
    breakMinutes: number;

    sessionCount: number;
    inferredCheckoutCount: number;
  };

  pay: {
    basePay: number;
    extraPay: number;
    deductionPay: number;
    totalPay: number;
  };

  flags: {
    hasMissingCheckout: boolean;
    hasOutOfSchedule: boolean;
    hasAnomalies: boolean;
  };

  breakdown: {
    daily: DailyPayrollView[];
  };
};

/**
 * 💥 WorkSessionView (UI / PDF 공용)
 */
export type WorkSessionView = {
  start: string;
  end: string;

  duration: number;
  netMinutes: number;

  planned_start?: string | null;
  planned_end?: string | null;

  lateMinutes: number;
  earlyLeaveMinutes: number;
  breakMinutes: number;

  inferredCheckout: boolean;

  type: "normal" | "out_of_schedule";
};

/**
 * 💥 Daily Payroll View (PDF / 관리자 화면용)
 */
export type DailyPayrollView = {
  date: string;

  totalMinutes: number;
  baseMinutes: number;

  pay: number;

  sessionCount: number;
};