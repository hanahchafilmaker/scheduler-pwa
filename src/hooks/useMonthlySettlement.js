import { useMemo } from "react";
import { normalizeDate, calcWorkMinutes, calcNightMinutes, safeStr } from "../utils";

export function useMonthlySettlement(attendance, employees, monthRange) {
  return useMemo(() => {
    const perEmp = {};
    let totalHours    = 0;
    let totalPay      = 0;
    let totalWorkDays = 0;

    const getEmp = (id) =>
      employees.find((e) => safeStr(e.employee_id) === safeStr(id));

    const monthAtt = attendance.filter((a) => {
      const d = normalizeDate(a.date);
      return d >= monthRange.start && d <= monthRange.end && a.check_in && a.check_out;
    });

    monthAtt.forEach((a) => {
      const emp  = getEmp(a.employee_id);
      const wage = Number(emp?.hourly_wage) || 0;

      const workMin  = calcWorkMinutes(a.check_in, a.check_out, a.break_min);
      const nightMin = calcNightMinutes(a.check_in, a.check_out, a.break_min);
      const basePay  = (workMin  / 60) * wage;
      const nightExtra = (nightMin / 60) * wage * 0.5;
      const amount   = basePay + nightExtra;

      const id = safeStr(a.employee_id) || safeStr(a.name);

      if (!perEmp[id]) {
        perEmp[id] = {
          employee_id:  id,
          name:         a.name || emp?.name || "-",
          wage,
          workDates:    new Set(),
          minutes:      0,
          nightMinutes: 0,
          amount:       0,
          days:         [],
        };
      }

      perEmp[id].workDates.add(normalizeDate(a.date));
      perEmp[id].minutes      += workMin;
      perEmp[id].nightMinutes += nightMin;
      perEmp[id].amount       += amount;
      perEmp[id].days.push({
        date:      normalizeDate(a.date),
        check_in:  a.check_in,
        check_out: a.check_out,
        break_min: a.break_min || 0,
        workMin,
        nightMin,
        pay: Math.round(basePay + nightExtra),
      });

      totalHours += workMin / 60;
      totalPay   += amount;
    });

    const rows = Object.values(perEmp).map((r) => {
      const hours    = r.minutes / 60;
      const nightHours = r.nightMinutes / 60;
      const workDays = r.workDates.size;
      totalWorkDays += workDays;

      return {
        ...r,
        workDays,
        hours,
        nightHours,
        amount: Math.round(r.amount),
        days: r.days.sort((a, b) => a.date.localeCompare(b.date)),
      };
    });

    return {
      rows,
      totalWorkDays,
      totalHours,
      totalPay: Math.round(totalPay),
    };
  }, [attendance, employees, monthRange]);
}
