import { SETTLED_RULES } from "../../rules/settledRules";
import { diffMinutes } from "../time/timeUtils";
import { calcMonthSummary } from "../summary/paySummary";

import {
  calcWorkMinutes,
  calcLateDeduct,
  calcEarlyLeaveDeduct,
  calcExtraEarly,
  calcExtraLate,
} from "../calculator/payCalculator";

export function calcRowPayWithSeparation(row, hourlyWage) {
  const ZERO = {
    payrollBasePlannedMin: 0,
    payrollLateDeductMin: 0,
    payrollEarlyLeaveDeductMin: 0,
    payrollBasePaidMin: 0,
    payrollExtraMin: 0,
    payrollBasePay: 0,
    payrollExtraPay: 0,
    payrollTotalPay: 0,
  };

  if (!row || !SETTLED_RULES.PAY(row)) return ZERO;

  const wage = Number(hourlyWage ?? row.hourly_wage ?? 0) || 0;
  const isOutOfSchedule = row.approval_reason === "out_of_schedule";
  const hasPlan = !!row.planned_start && !!row.planned_end;

  let baseMin = 0;
  let late = 0;
  let early = 0;
  let extra = 0;

  if (isOutOfSchedule || !hasPlan) {
    extra = diffMinutes(row.check_in, row.check_out);
  } else {
    baseMin = diffMinutes(row.planned_start, row.planned_end);

    late = calcLateDeduct(row.planned_start, row.check_in);
    early = calcEarlyLeaveDeduct(row.planned_end, row.check_out);

    extra =
      calcExtraEarly(row.planned_start, row.check_in) +
      calcExtraLate(row.planned_end, row.check_out);
  }

  const basePaid = Math.max(0, baseMin - late - early);

  const basePay = Math.round((basePaid / 60) * wage);
  const extraPay = Math.round((extra / 60) * wage);

  return {
    payrollBasePlannedMin: baseMin,
    payrollLateDeductMin: late,
    payrollEarlyLeaveDeductMin: early,
    payrollBasePaidMin: basePaid,
    payrollExtraMin: extra,
    payrollBasePay: basePay,
    payrollExtraPay: extraPay,
    payrollTotalPay: basePay + extraPay,
  };
}

/* compatibility wrappers */

export function calcPayrollLateDeductMinutes(row) {
  return calcLateDeduct(row.planned_start, row.check_in);
}

export function calcPayrollEarlyLeaveDeductMinutes(row) {
  return calcEarlyLeaveDeduct(row.planned_end, row.check_out);
}

export function formatLateMinutes(min) {
  return min > 0 ? `${min}min` : "";
}

export function formatEarlyLeaveMinutes(min) {
  return min > 0 ? `${min}min` : "";
}

export function buildSettlement({
  attendance = [],
  employees = [],
  month = "",
}) {
  const employeeMap = Object.fromEntries(
    employees.map((e) => [e.id, e])
  );

  const rows = attendance.filter((r) =>
    (r.work_date || "").startsWith(month)
  );

  return {
    month,
    rows,
    summary: calcMonthSummary(rows, employeeMap),
  };
}

export { calcWorkMinutes };
export { calcMonthSummary };