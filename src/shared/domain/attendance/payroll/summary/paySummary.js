export function calcMonthSummary(rows = [], employeeMap = {}) {
  let totalMinutes = 0;
  let totalPay = 0;

  for (const r of rows) {
    if (!r) continue;

    const wage = employeeMap[r.employee_id]?.hourlyWage || 0;

    const minutes =
      r.payrollBasePaidMin || 0;

    totalMinutes += minutes;
    totalPay += Math.round((minutes / 60) * wage);
  }

  return {
    totalMinutes,
    totalPay,
    employeeCount: Object.keys(employeeMap).length,
  };
}