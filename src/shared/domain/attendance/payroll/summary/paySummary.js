import { filterPaySettled } from "../../rules/settledRules";
import { calcRowPayWithSeparation } from "../engine/payEngine";

// 
// MONTH SUMMARY
// 
export function calcMonthSummary(rows = [], employeeMap = {}) {
  const settledRows = filterPaySettled(rows);

  const payrollRows = settledRows.map((row) => {
    const wage =
      Number(employeeMap?.[row.employee_id]?.hourly_wage ?? row.hourly_wage ?? 0) || 0;

    return calcRowPayWithSeparation(row, wage);
  });

  const total = payrollRows.reduce(
    (acc, p) => {
      acc.base += p.payrollBasePay;
      acc.extra += p.payrollExtraPay;
      return acc;
    },
    { base: 0, extra: 0 }
  );

  return {
    totalBasePay: total.base,
    totalExtraPay: total.extra,
    totalPay: total.base + total.extra,
  };
}

