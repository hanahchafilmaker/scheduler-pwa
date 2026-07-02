/**
 * buildSettlement.js
 * src/shared/domain/attendance/settlement/buildSettlement.js
 */

function toMin(timeStr) {
  if (!timeStr) return null;
  const m = String(timeStr).match(/(\d+):(\d+)/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function diffMin(start, end) {
  const s = toMin(start);
  const e = toMin(end);
  if (s == null || e == null) return 0;
  return Math.max(0, e - s);
}

function calcBasePlannedMin(row) {
  const planned = diffMin(row.planned_start, row.planned_end);
  const breakMin = Number(row.break_min || 0);
  return Math.max(0, planned - breakMin);
}

function calcPaidMin(row) {
  const start = row.paid_check_in || row.check_in;
  const end   = row.paid_check_out || row.check_out;
  const total = diffMin(start, end);
  const breakMin = Number(row.break_min || 0);
  return Math.max(0, total - breakMin);
}

function calcRowPay(row, hourlyWage) {
  const wage = Number(hourlyWage || 0);
  if (!wage) return { basePay: 0, extraPay: 0, basePlannedMin: 0 };

  const paidMin = calcPaidMin(row);

  // 대타 근무는 예정시간 유무와 상관없이 전액 시간외(추가) 수당으로 처리
  if (row.is_substitute) {
    const extraPay = Math.round((paidMin / 60) * wage);
    return { basePay: 0, extraPay, basePlannedMin: 0 };
  }

  // 일반 근무: 예정 스케줄(planned_start/planned_end)이 있으면 그 시간까지 기본급, 초과분만 시간외 수당.
  // 예정 스케줄이 없는 경우(스케줄 외 출근 등)는 비교 기준이 없으므로 전액 기본급 처리.
  const hasPlannedSchedule = !!(row.planned_start && row.planned_end);
  const basePlannedMin = hasPlannedSchedule ? calcBasePlannedMin(row) : paidMin;

  const baseMin        = Math.min(paidMin, basePlannedMin);
  const extraMin       = Math.max(0, paidMin - basePlannedMin);
  const basePay        = Math.round((baseMin  / 60) * wage);
  const extraPay       = Math.round((extraMin / 60) * wage);

  return { basePay, extraPay, basePlannedMin };
}

export function buildSettlement({ attendance = [], employees = [], month = "" }) {
  const empMap = {};
  for (const e of employees) {
    empMap[String(e.employee_id)] = e;
  }

  const settled = attendance.filter(
    (r) => r.approval_status === "approved" || r.approval_status === "auto_closed",
  );

  const filtered = month
    ? settled.filter((r) => String(r.date || "").startsWith(month))
    : settled;

  const grouped = {};
  for (const row of filtered) {
    const id = String(row.employee_id);
    if (!grouped[id]) grouped[id] = [];
    grouped[id].push(row);
  }

  const rows = Object.entries(grouped).map(([empId, empRows]) => {
    const emp        = empMap[empId] || {};
    const hourlyWage = Number(emp.hourly_wage || 0);

    let totalBasePay        = 0;
    let totalExtraPay       = 0;
    let totalBasePlannedMin = 0;

    const days = empRows
      .slice()
      .sort((a, b) => (a.date > b.date ? 1 : -1))
      .map((row) => {
        const { basePay, extraPay, basePlannedMin } = calcRowPay(row, hourlyWage);
        totalBasePay        += basePay;
        totalExtraPay       += extraPay;
        totalBasePlannedMin += basePlannedMin;

        return {
          date:                  row.date,
          part:                  row.part,
          planned_start:         row.planned_start || "",
          planned_end:           row.planned_end   || "",
          check_in:              row.check_in      || "",
          check_out:             row.check_out     || "",
          payrollBasePlannedMin: basePlannedMin,
          payrollBasePay:        basePay,
          payrollExtraPay:       extraPay,
        };
      });

    return {
      employee_id:             empId,
      name:                    emp.name || empId,
      wage:                    hourlyWage,
      workDays:                days.length,
      payrollBasePay:          totalBasePay,
      payrollExtraPay:         totalExtraPay,
      payrollBasePlannedHours: totalBasePlannedMin / 60,
      days,
    };
  });

  const totalPayrollPay = rows.reduce(
    (sum, r) => sum + r.payrollBasePay + r.payrollExtraPay,
    0,
  );
  const totalWorkDays = rows.reduce((sum, r) => sum + r.workDays, 0);

  return { rows, totalPayrollPay, totalWorkDays };
}