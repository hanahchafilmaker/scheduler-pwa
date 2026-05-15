export function buildCheckInRow({
  employee,
  schedule,
  checkInTime,
  isSubstitute = false,
  isOutOfSchedule = false,
  evaluation,
}) {
  const now = new Date().toISOString();

  const baseApproved = evaluation?.approved ?? false;

  return {
    id: `ATT_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    employee_id: employee.id,
    work_date: new Date().toISOString().split("T")[0],

    name: employee.name,
    part: employee.part,

    planned_start: schedule?.planned_start ?? null,
    planned_end: schedule?.planned_end ?? null,

    check_in: checkInTime,
    check_out: null,

    paid_check_in: checkInTime,
    paid_check_out: null,

    // 🔥 핵심 수정: 자동 승인 금지
    approved: isOutOfSchedule ? false : baseApproved,

    approval_note: null,
    requested_at: isOutOfSchedule ? now : null,
    approved_at: null,
    approved_by: null,

    late_min: 0,
    late_deduct_min: 0,
    early_leave_min: 0,
    extra_work_min: 0,
    break_min: 0,

    is_substitute: isSubstitute,
    auto_checkout: false,

    memo: null,
    created_at: now,
    approval_reason: null,
  };
}