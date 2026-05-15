/**
 * buildSettlement.js
 * src/shared/utils/buildSettlement.js
 *
 * App.jsx 호출 형태:
 *   buildSettlement({ attendance, employees, month })
 *
 * 반환 형태 (SimTab / PayslipModal 기준):
 * {
 *   rows: [
 *     {
 *       employee_id,
 *       name,
 *       wage,               // 시급
 *       workDays,           // 출근일수 (approved + auto_closed)
 *       payrollBasePay,     // 기본급 합계
 *       payrollExtraPay,    // 추가수당 합계
 *       payrollBasePlannedHours, // 기본 근무시간 합계(시간 단위)
 *       days: [             // 일별 상세
 *         {
 *           date,
 *           part,
 *           planned_start,
 *           planned_end,
 *           check_in,
 *           check_out,
 *           payrollBasePlannedMin,  // 스케줄 기준 기본 근무분
 *           payrollBasePay,         // 일별 기본급
 *           payrollExtraPay,        // 일별 추가수당
 *         }
 *       ]
 *     }
 *   ],
 *   totalPayrollPay,   // 전체 지급 합계
 *   totalWorkDays,     // 전체 출근일수 합계
 * }
 */

// ── 내부 유틸 ──────────────────────────────────────────────────────────────

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

/**
 * 스케줄 기준 기본 근무분 계산
 * planned_start ~ planned_end 구간에서 break_min 제외
 */
function calcBasePlannedMin(row) {
  const planned = diffMin(row.planned_start, row.planned_end);
  const breakMin = Number(row.break_min || 0);
  return Math.max(0, planned - breakMin);
}

/**
 * 지급 출퇴근(paid_check_in / paid_check_out) 기준 실지급 근무분
 */
function calcPaidMin(row) {
  const start = row.paid_check_in || row.check_in;
  const end   = row.paid_check_out || row.check_out;
  const total = diffMin(start, end);
  const breakMin = Number(row.break_min || 0);
  return Math.max(0, total - breakMin);
}

/**
 * 기본급 / 추가수당 분리 계산
 *
 * - 기본급  : min(실지급분, 스케줄기준분) × 시급
 * - 추가수당: max(0, 실지급분 - 스케줄기준분) × 시급
 */
function calcRowPay(row, hourlyWage) {
  const wage = Number(hourlyWage || 0);
  if (!wage) return { basePay: 0, extraPay: 0, basePlannedMin: 0 };

  const basePlannedMin = calcBasePlannedMin(row);
  const paidMin        = calcPaidMin(row);

  const baseMin  = Math.min(paidMin, basePlannedMin);
  const extraMin = Math.max(0, paidMin - basePlannedMin);

  const basePay  = Math.round((baseMin  / 60) * wage);
  const extraPay = Math.round((extraMin / 60) * wage);

  return { basePay, extraPay, basePlannedMin };
}

// ── 메인 함수 ──────────────────────────────────────────────────────────────

/**
 * @param {Object} params
 * @param {Array}  params.attendance  - monthAttendance 배열
 * @param {Array}  params.employees   - employees 배열
 * @param {string} params.month       - "YYYY-MM" (현재는 필터에만 사용)
 */
export function buildSettlement({ attendance = [], employees = [], month = "" }) {
  // 직원 맵
  const empMap = {};
  for (const e of employees) {
    empMap[String(e.employee_id)] = e;
  }

  // 정산 대상: approved + auto_closed 만
  const settled = attendance.filter(
    (r) => r.approval_status === "approved" || r.approval_status === "auto_closed",
  );

  // 월 필터 (month 파라미터가 있으면 적용)
  const filtered = month
    ? settled.filter((r) => String(r.date || "").startsWith(month))
    : settled;

  // 직원별 그룹핑
  const grouped = {};
  for (const row of filtered) {
    const id = String(row.employee_id);
    if (!grouped[id]) grouped[id] = [];
    grouped[id].push(row);
  }

  // 직원별 계산
  const rows = Object.entries(grouped).map(([empId, rows]) => {
    const emp        = empMap[empId] || {};
    const hourlyWage = Number(emp.hourly_wage || 0);

    let totalBasePay       = 0;
    let totalExtraPay      = 0;
    let totalBasePlannedMin = 0;

    const days = rows
      .slice()
      .sort((a, b) => (a.date > b.date ? 1 : -1))
      .map((row) => {
        const { basePay, extraPay, basePlannedMin } = calcRowPay(row, hourlyWage);
        totalBasePay        += basePay;
        totalExtraPay       += extraPay;
        totalBasePlannedMin += basePlannedMin;

        return {
          date:                row.date,
          part:                row.part,
          planned_start:       row.planned_start || "",
          planned_end:         row.planned_end   || "",
          check_in:            row.check_in      || "",
          check_out:           row.check_out     || "",
          payrollBasePlannedMin: basePlannedMin,
          payrollBasePay:      basePay,
          payrollExtraPay:     extraPay,
        };
      });

    return {
      employee_id:              empId,
      name:                     emp.name || empId,
      wage:                     hourlyWage,
      workDays:                 days.length,
      payrollBasePay:           totalBasePay,
      payrollExtraPay:          totalExtraPay,
      payrollBasePlannedHours:  totalBasePlannedMin / 60,
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