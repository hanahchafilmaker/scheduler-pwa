import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase.js";

/* ================================================================
   필드명 매핑 (GAS → Supabase)
   - attendance.id          ← attendance_id
   - schedules.id           ← schedule_id
   - *.work_date            ← date
   - attendance.approved    ← approval_status (null=pending, true=approved, false=rejected)
================================================================ */

// ----------------------------------------------------------------
// normalize helpers
// ----------------------------------------------------------------

function normalizeDateOnly(value) {
  return String(value || "").slice(0, 10);
}

function normalizeEmployee(row) {
  return {
    employee_id: row?.id || "",
    name: row?.name || "",
    pin: row?.pin || "",
    phone: row?.phone || "",
    hourly_wage: Number(row?.hourly_wage || 0),
    active: row?.active !== false,
    role: row?.role || "staff",
  };
}

function normalizeSchedule(row) {
  return {
    schedule_id: row?.id || "",
    name: row?.name || "",
    employee_id: row?.employee_id || "",
    date: normalizeDateOnly(row?.work_date),
    part: row?.part || "",
    planned_start: row?.planned_start || "",
    planned_end: row?.planned_end || "",
    memo: row?.memo || "",
  };
}

function approvedToStatus(approved) {
  if (approved === true) return "approved";
  if (approved === false) return "rejected";
  // string이 직접 넘어오는 경우 그대로 통과 (향후 varchar 마이그레이션 대비)
  if (typeof approved === "string") return approved;
  return "pending";
}

function statusToApproved(status) {
  if (status === "approved") return true;
  if (status === "rejected") return false;
  return null;
}

function normalizeAttendance(row) {
  return {
    attendance_id: row?.id || "",
    schedule_id: row?.schedule_id || "",
    employee_id: row?.employee_id || "",
    date: normalizeDateOnly(row?.work_date),
    name: row?.name || "",
    part: row?.part || "",

    planned_start: row?.planned_start || "",
    planned_end: row?.planned_end || "",

    check_in: row?.check_in || "",
    check_out: row?.check_out || "",

    paid_check_in: row?.paid_check_in || row?.check_in || "",
    paid_check_out: row?.paid_check_out || row?.check_out || "",

    approval_status: approvedToStatus(row?.approved),
    approval_reason: row?.approval_reason || "",
    approval_note: row?.approval_note || "",
    requested_at: row?.requested_at || "",
    approved_at: row?.approved_at || "",
    approved_by: row?.approved_by || "",

    early_arrival_paid_min: 0,
    late_min: Number(row?.late_min || 0),
    late_deduct_min: Number(row?.late_deduct_min || 0),
    early_leave_min: Number(row?.early_leave_min || 0),
    extra_work_min: Number(row?.extra_work_min || 0),
    extension_min: 0,
    break_min: Number(row?.break_min || 0),

    is_substitute: !!row?.is_substitute,
    auto_checkout: !!row?.auto_checkout,

    memo: row?.memo || "",

    // ── 추가 필드 ──────────────────────────────────────
    // 파트 기준 근무시간 (planned_start ~ planned_end 기준 분)
    scheduled_work_min: (function () {
      const s = row?.planned_start;
      const e = row?.planned_end;
      if (!s || !e) return 0;
      const [sh, sm] = s.split(":").map(Number);
      const [eh, em] = e.split(":").map(Number);
      if ([sh, sm, eh, em].some(isNaN)) return 0;
      return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
    })(),

    // 대타일 때 원래 배정된 파트 (없으면 빈 문자열)
    original_part: row?.original_part || "",

    // 대타 원래 담당자 이름 (없으면 빈 문자열)
    substitute_for: row?.substitute_for || "",

    // 실제 지각 표시 분 (grace 5분 제외 후, 음수 방지)
    late_display_min: Math.max(0, Number(row?.late_min || 0) - 5),
  };
}

function normalizeTemplateRow(row) {
  return {
    day: row?.day || "",
    part: row?.part || "",
    employee_id: row?.employee_id || "",
    name: row?.name || "",
    planned_start: row?.planned_start || "",
    planned_end: row?.planned_end || "",
  };
}

// ----------------------------------------------------------------
// 날짜 헬퍼
// ----------------------------------------------------------------

function getTodayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getCurrentMonthStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthRange(month) {
  const [y, m] = month.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const nextMonth = new Date(y, m, 1);
  const end = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;
  return { start, end };
}

function filterRowsByMonth(rows, month) {
  return rows.filter((row) => String(row?.date || "").slice(0, 7) === month);
}

// ----------------------------------------------------------------
// 에러 / 공통 헬퍼
// ----------------------------------------------------------------

function assertNoError(error, label) {
  if (error) throw new Error(`[${label}] ${error.message || "쿼리 실패"}`);
}

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function nowDateTimeString() {
  return new Date().toISOString();
}

// ----------------------------------------------------------------
// 출퇴근 계산
// ----------------------------------------------------------------

const RULES = {
  EARLY_ARRIVAL_MAX_PAY_MIN: 10,
  LATE_GRACE_MIN: 5,
  EARLY_LEAVE_ALLOW_MIN: 5,
  MAX_EXTENSION_MIN: 60,
};

function timeToMin(t) {
  const m = String(t || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function minToTime(mins) {
  const m = ((Number(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function evaluateCheckIn(actualCheckIn, plannedStart) {
  const result = {
    paidCheckIn: actualCheckIn || "",
    approved: null, // 🔧 기본값: 스케줄 없으면 pending (자동 승인 금지)
    approval_note: "",
    late_min: 0,
    late_deduct_min: 0,
    requested_at: null,
  };

  // plannedStart 없음 = 스케줄 외 출근 → pending 유지하고 반환
  if (!plannedStart || !actualCheckIn) {
    result.approval_note = plannedStart ? "" : "스케줄 없음 / 관리자 승인 필요";
    result.requested_at = actualCheckIn ? nowDateTimeString() : null;
    return result;
  }

  const planMin = timeToMin(plannedStart);
  const actualMin = timeToMin(actualCheckIn);
  if (planMin === null || actualMin === null) return result;

  if (actualMin < planMin) {
    const earlyMin = Math.min(RULES.EARLY_ARRIVAL_MAX_PAY_MIN, planMin - actualMin);
    result.paidCheckIn = minToTime(planMin - earlyMin);
    result.approved = true; // 정상 조기 출근 → 승인
    return result;
  }

  const lateMin = actualMin - planMin;
  result.late_min = lateMin;

  if (lateMin <= RULES.LATE_GRACE_MIN) {
    result.paidCheckIn = plannedStart;
    result.approved = true; // 유예 범위 내 지각 → 정상 승인
    return result;
  }

  result.late_deduct_min = lateMin;
  result.paidCheckIn = actualCheckIn;
  result.approved = null;
  result.approval_note = `지각 ${lateMin}분 / ${lateMin}분 차감 / 관리자 승인 필요`;
  result.requested_at = nowDateTimeString();
  return result;
}

function evaluateCheckOut(plannedEnd, actualCheckOut) {
  const result = {
    paidCheckOut: actualCheckOut || "",
    extra_work_min: 0,
    early_leave_min: 0,
    approved: true,
    approval_note: "",
    requested_at: null,
  };

  if (!plannedEnd || !actualCheckOut) return result;

  const planMin = timeToMin(plannedEnd);
  const outMin = timeToMin(actualCheckOut);
  if (planMin === null || outMin === null) return result;

  if (outMin < planMin - RULES.EARLY_LEAVE_ALLOW_MIN) {
    result.early_leave_min = planMin - outMin;
    result.paidCheckOut = actualCheckOut;
    result.approved = null;
    result.approval_note = `조기퇴근 ${result.early_leave_min}분 / 승인 필요`;
    result.requested_at = nowDateTimeString();
    return result;
  }

  if (outMin <= planMin) {
    result.paidCheckOut = actualCheckOut;
    return result;
  }

  const extraMin = Math.min(outMin - planMin, RULES.MAX_EXTENSION_MIN);
  result.extra_work_min = extraMin;
  result.paidCheckOut = minToTime(planMin + extraMin);
  result.approved = null;
  result.approval_note = `추가근무 ${outMin - planMin}분 / 관리자 승인 필요`;
  result.requested_at = nowDateTimeString();
  return result;
}

// ----------------------------------------------------------------
// 읽기 API
// ----------------------------------------------------------------

async function fetchAll(month) {
  const { start, end } = monthRange(month);

  const [empRes, tmplRes, schRes, attRes] = await Promise.all([
    supabase.from("employees").select("*").order("name"),
    supabase.from("template_schedule").select("*").order("id"),
    supabase
      .from("schedules")
      .select("*")
      .gte("work_date", start)
      .lt("work_date", end)
      .order("work_date")
      .order("planned_start"),
    supabase
      .from("attendance")
      .select("*")
      .gte("work_date", start)
      .lt("work_date", end)
      .order("work_date")
      .order("check_in"),
  ]);

  assertNoError(empRes.error, "employees");
  assertNoError(tmplRes.error, "template_schedule");
  assertNoError(schRes.error, "schedules");
  assertNoError(attRes.error, "attendance");

  return {
    employees: (empRes.data || []).map(normalizeEmployee),
    template_schedule: (tmplRes.data || []).map(normalizeTemplateRow),
    schedule: (schRes.data || []).map(normalizeSchedule),
    attendance: (attRes.data || []).map(normalizeAttendance),
  };
}

async function fetchAdminToday() {
  const dateStr = getTodayStr();

  const [empRes, schRes, attRes] = await Promise.all([
    supabase.from("employees").select("*").order("name"),
    supabase.from("schedules").select("*").eq("work_date", dateStr).order("planned_start"),
    supabase.from("attendance").select("*").eq("work_date", dateStr).order("check_in"),
  ]);

  assertNoError(empRes.error, "employees");
  assertNoError(schRes.error, "schedules");
  assertNoError(attRes.error, "attendance");

  return {
    employees: (empRes.data || []).map(normalizeEmployee),
    schedule: (schRes.data || []).map(normalizeSchedule),
    attendance: (attRes.data || []).map(normalizeAttendance),
  };
}

async function fetchStaffToday(employeeId) {
  const dateStr = getTodayStr();

  const [schRes, attRes] = await Promise.all([
    supabase
      .from("schedules")
      .select("*")
      .eq("work_date", dateStr)
      .eq("employee_id", employeeId)
      .order("planned_start"),
    supabase
      .from("attendance")
      .select("*")
      .eq("work_date", dateStr)
      .eq("employee_id", employeeId)
      .order("check_in"),
  ]);

  assertNoError(schRes.error, "schedules");
  assertNoError(attRes.error, "attendance");

  return {
    schedule: (schRes.data || []).map(normalizeSchedule),
    attendance: (attRes.data || []).map(normalizeAttendance),
  };
}

async function fetchStaffMonth(employeeId, month) {
  const { start, end } = monthRange(month);

  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .eq("employee_id", employeeId)
    .gte("work_date", start)
    .lt("work_date", end)
    .order("work_date")
    .order("check_in");

  assertNoError(error, "attendance");

  return { attendance: (data || []).map(normalizeAttendance) };
}

async function fetchPendingAttendance(month) {
  const { start, end } = monthRange(month);

  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .gte("work_date", start)
    .lt("work_date", end)
    .is("approved", null)
    .order("work_date")
    .order("check_in");

  assertNoError(error, "attendance");

  return { attendance: (data || []).map(normalizeAttendance) };
}

// ----------------------------------------------------------------
// 출퇴근 API
// ----------------------------------------------------------------

async function doCheckIn(body) {
  const dateStr = body.date || getTodayStr();
  const employeeId = String(body.employee_id || "").trim();
  const employeeName = String(body.name || "").trim();
  const selectedPart = String(body.part || "").trim();
  const checkInTime = body.check_in || new Date().toTimeString().slice(0, 5);
  const isSubstitute = !!body.is_substitute;

  const { data: open, error: openError } = await supabase
    .from("attendance")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("work_date", dateStr)
    .is("check_out", null)
    .maybeSingle();

  assertNoError(openError, "check_in open attendance");

  if (open) {
    throw new Error("이미 출근 상태입니다. 먼저 퇴근 처리하세요.");
  }

  const { data: schedules, error: schedulesError } = await supabase
    .from("schedules")
    .select("*")
    .eq("work_date", dateStr)
    .eq("employee_id", employeeId);

  assertNoError(schedulesError, "check_in schedules");

  const matched = selectedPart
    ? (schedules || []).find((s) => s.part === selectedPart) || null
    : null;

  const plannedStart = matched?.planned_start || "";
  const plannedEnd = matched?.planned_end || "";
  const isOutOfSchedule = !matched && !isSubstitute;
  const checkInEval = evaluateCheckIn(checkInTime, plannedStart);

  const approvalReason = isOutOfSchedule
    ? "out_of_schedule"
    : isSubstitute
      ? "substitute"
      : checkInEval.late_min > RULES.LATE_GRACE_MIN
        ? "late"
        : "";

  // 🔧 승인 기본값 결정:
  //   - 스케줄 외 출근 → null (pending)
  //   - 대타 → null (pending, 관리자 확인 필요)
  //   - 정상/지각은 evaluateCheckIn 결과 사용 (정상=true, 지각=null)
  const approvedValue =
    isOutOfSchedule || isSubstitute ? null : checkInEval.approved;

  const row = {
    id: generateId("ATT"),
    schedule_id: matched?.id || null,
    employee_id: employeeId,
    work_date: dateStr,
    name: employeeName || matched?.name || "",
    part: matched?.part || (isSubstitute ? "대타" : selectedPart || "extra"),
    planned_start: plannedStart || null,
    planned_end: plannedEnd || null,
    check_in: checkInTime,
    check_out: null,
    paid_check_in: checkInEval.paidCheckIn || null,
    paid_check_out: null,
    approved: approvedValue,
    approval_reason: approvalReason,
    approval_note: isOutOfSchedule
      ? "스케줄 외 출근 / 관리자 승인 필요"
      : isSubstitute
        ? "대타 출근 / 관리자 승인 필요"
        : checkInEval.approval_note,
    requested_at:
      approvedValue === null ? nowDateTimeString() : null,
    approved_at: null,
    approved_by: null,
    late_min: checkInEval.late_min,
    late_deduct_min: checkInEval.late_deduct_min,
    early_leave_min: 0,
    extra_work_min: 0,
    break_min: Number(body.break_min) || 0,
    is_substitute: isSubstitute,
    auto_checkout: false,
    memo: body.memo || "",
  };

  const { data: inserted, error: insertError } = await supabase
    .from("attendance")
    .insert([row])
    .select()
    .single();

  assertNoError(insertError, "check_in insert");

  return { ok: true, row: normalizeAttendance(inserted || row) };
}

async function doCheckOut(body) {
  const dateStr = body.date || getTodayStr();
  const employeeId = String(body.employee_id || "").trim();
  const checkOutTime = body.check_out || new Date().toTimeString().slice(0, 5);

  let query = supabase
    .from("attendance")
    .select("*")
    .eq("work_date", dateStr)
    .is("check_out", null);

  if (body.attendance_id) {
    query = query.eq("id", body.attendance_id);
  } else {
    query = query.eq("employee_id", employeeId);
  }

  const { data: rows, error: findError } = await query.order("check_in");
  assertNoError(findError, "check_out find");

  const row = rows?.[rows.length - 1];
  if (!row) throw new Error("출근 기록 없음");

  const evalResult = evaluateCheckOut(row.planned_end, checkOutTime);

  // 🔧 checkout 시 approved 결정 규칙:
  //   - 이미 pending(null)인 경우: pending 유지 (체크아웃 평가 결과와 무관하게 관리자가 한 번에 승인)
  //     단, 체크아웃 평가에서 추가 이슈가 있으면 approval_note에 append
  //   - 이미 approved(true)인 경우: 체크아웃 평가 결과 적용 (조기퇴근/연장 → pending)
  //   - 이미 rejected(false)인 경우: 그대로 유지
  let newApproved = row.approved;
  if (row.approved === true) {
    // 정상 승인 상태였는데 체크아웃에서 이슈 발생 → pending으로 변경
    newApproved = evalResult.approved;
  }
  // row.approved === null (pending) → null 유지
  // row.approved === false (rejected) → false 유지

  const updates = {
    check_out: checkOutTime,
    paid_check_out: evalResult.paidCheckOut || null,
    extra_work_min: evalResult.extra_work_min,
    early_leave_min: evalResult.early_leave_min,
    auto_checkout: !!body.auto_checkout,
    approved: newApproved,
    approval_note: [row.approval_note, evalResult.approval_note].filter(Boolean).join(" / "),
    requested_at: row.requested_at || evalResult.requested_at || null,
  };

  const { data, error: updateError } = await supabase
    .from("attendance")
    .update(updates)
    .eq("id", row.id)
    .select()
    .single();

  assertNoError(updateError, "check_out update");

  return { ok: true, row: normalizeAttendance(data || { ...row, ...updates }) };
}

async function doApproveAttendance(body) {
  const { attendance_id, approved, approved_by = null, approval_note } = body;

  // 기존 레코드 조회 → approval_note 미전달 시 기존 값 보존
  const { data: existing, error: fetchError } = await supabase
    .from("attendance")
    .select("approval_note")
    .eq("id", attendance_id)
    .single();

  assertNoError(fetchError, "approve_attendance fetch");

  const updates = {
    approved: approved === true ? true : false,
    approved_by: approved_by || null,
    approved_at: nowDateTimeString(),
    approval_note: approval_note !== undefined ? approval_note : (existing?.approval_note || ""),
  };

  const { data, error } = await supabase
    .from("attendance")
    .update(updates)
    .eq("id", attendance_id)
    .select()
    .single();

  assertNoError(error, "approve_attendance");

  return { ok: true, row: normalizeAttendance(data) };
}

async function doUpdateAttendance(body) {
  const { attendance_id, ...fields } = body;

  const updates = {};
  // check_in / check_out 은 원본 로그 — 절대 수정 불가
  // paid_check_in / paid_check_out 만 수정 허용
  const mutableFields = [
    "planned_start",
    "planned_end",
    "paid_check_in",
    "paid_check_out",
    "approval_note",
    "requested_at",
    "approved_at",
    "approved_by",
    "late_min",
    "late_deduct_min",
    "early_leave_min",
    "extra_work_min",
    "break_min",
    "is_substitute",
    "auto_checkout",
    "memo",
  ];

  mutableFields.forEach((key) => {
    if (fields[key] !== undefined) updates[key] = fields[key];
  });

  if (fields.approval_status !== undefined) {
    updates.approved = statusToApproved(fields.approval_status);
  }

  const { data, error } = await supabase
    .from("attendance")
    .update(updates)
    .eq("id", attendance_id)
    .select()
    .single();

  assertNoError(error, "update_attendance");

  return { ok: true, row: normalizeAttendance(data) };
}

// ----------------------------------------------------------------
// 스케줄 API
// ----------------------------------------------------------------

async function doAddSchedule(body) {
  const payload = {
    id: body.schedule_id || generateId("SCH"),
    employee_id: body.employee_id || "",
    name: body.name || "",
    work_date: body.date || getTodayStr(),
    part: body.part || "",
    planned_start: body.planned_start || "",
    planned_end: body.planned_end || "",
    memo: body.memo || "",
  };

  const { data, error } = await supabase
    .from("schedules")
    .upsert(payload, { onConflict: "employee_id,work_date,part" })
    .select()
    .single();

  assertNoError(error, "add_schedule");

  return { ok: true, row: normalizeSchedule(data) };
}

async function doUpdateSchedule(body) {
  const updates = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.employee_id !== undefined) updates.employee_id = body.employee_id;
  if (body.date !== undefined) updates.work_date = body.date;
  if (body.part !== undefined) updates.part = body.part;
  if (body.planned_start !== undefined) updates.planned_start = body.planned_start;
  if (body.planned_end !== undefined) updates.planned_end = body.planned_end;
  if (body.memo !== undefined) updates.memo = body.memo;

  const { data, error } = await supabase
    .from("schedules")
    .update(updates)
    .eq("id", body.schedule_id)
    .select()
    .single();

  assertNoError(error, "update_schedule");

  return { ok: true, row: normalizeSchedule(data) };
}

async function doDeleteSchedule(body) {
  const { error } = await supabase.from("schedules").delete().eq("id", body.schedule_id);
  assertNoError(error, "delete_schedule");
  return { ok: true };
}

// ----------------------------------------------------------------
// 직원 API
// ----------------------------------------------------------------

async function doAddEmployee(body) {
  const row = {
    id: body.employee_id || generateId("EMP"),
    name: body.name || "",
    pin: body.pin || "",
    phone: body.phone || "",
    hourly_wage: Number(body.hourly_wage) || 0,
    role: body.role || "staff",
    active: body.active !== false,
  };

  const { data, error } = await supabase.from("employees").insert([row]).select().single();
  assertNoError(error, "add_employee");

  return { ok: true, row: normalizeEmployee(data) };
}

async function doUpdateEmployee(body) {
  const updates = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.pin !== undefined) updates.pin = body.pin;
  if (body.phone !== undefined) updates.phone = body.phone;
  if (body.hourly_wage !== undefined) updates.hourly_wage = Number(body.hourly_wage);
  if (body.role !== undefined) updates.role = body.role;
  if (body.active !== undefined) updates.active = body.active !== false;

  const { data, error } = await supabase
    .from("employees")
    .update(updates)
    .eq("id", body.employee_id)
    .select()
    .single();

  assertNoError(error, "update_employee");

  return { ok: true, row: normalizeEmployee(data) };
}

async function doDeleteEmployee(body) {
  const { error } = await supabase.from("employees").delete().eq("id", body.employee_id);
  assertNoError(error, "delete_employee");
  return { ok: true };
}

// ----------------------------------------------------------------
// 정산 마감 API
// ----------------------------------------------------------------

/**
 * 특정 월의 직원별 급여를 final_pay에 저장(upsert)한다.
 * @param {string} yearMonth  - "YYYY-MM"
 * @param {Array}  attRows    - normalizeAttendance된 해당 월 전체 행
 * @param {Array}  empRows    - normalizeEmployee된 전체 직원 행
 * @param {string} lockedBy   - 마감 처리자 이름
 * @param {Function} calcFn   - calcRowPayWithSeparation (pay.js)
 * @returns {{ ok: boolean, count: number, rows: Array }}
 */
async function doLockMonthlyPay({ yearMonth, attRows, empRows, lockedBy, calcFn }) {
  // 직원별로 그룹화
  const grouped = {};
  for (const row of attRows) {
    if (!row.employee_id) continue;
    if (!grouped[row.employee_id]) grouped[row.employee_id] = [];
    grouped[row.employee_id].push(row);
  }

  const empMap = {};
  for (const e of empRows) {
    empMap[e.employee_id] = e;
  }

  const toUpsert = Object.entries(grouped).map(([empId, rows]) => {
    const emp = empMap[empId] || {};
    const hourlyWage = emp.hourly_wage || 0;

    // approved 또는 auto_closed 행만 정산 대상
    const settled = rows.filter(
      (r) => r.approval_status === "approved" || r.approval_status === "auto_closed",
    );

    let basePay = 0;
    let extraPay = 0;
    let workDays = 0;
    let totalLateDeductMin = 0;
    let totalExtraMin = 0;
    let totalPlannedMin = 0;

    for (const r of settled) {
      const result = calcFn({ ...r, hourly_wage: hourlyWage });
      basePay += result.basePay || 0;
      extraPay += result.extraPay || 0;
      workDays += 1;
      totalLateDeductMin += r.late_deduct_min || 0;
      totalExtraMin += r.extra_work_min || 0;
      totalPlannedMin += r.scheduled_work_min || 0;
    }

    return {
      employee_id: empId,
      year_month: yearMonth,
      base_pay: Math.round(basePay),
      extra_pay: Math.round(extraPay),
      final_amount: Math.round(basePay + extraPay),
      work_days: workDays,
      base_planned_min: totalPlannedMin,
      late_deduct_min: totalLateDeductMin,
      extra_min: totalExtraMin,
      calc_snapshot: settled,
      locked_at: new Date().toISOString(),
      locked_by: lockedBy || "manager",
      status: "locked",
    };
  });

  if (!toUpsert.length) return { ok: true, count: 0, rows: [] };

  const { data, error } = await supabase
    .from("final_pay")
    .upsert(toUpsert, { onConflict: "employee_id,year_month" })
    .select();

  assertNoError(error, "lock_monthly_pay");

  return { ok: true, count: toUpsert.length, rows: data || [] };
}

// ----------------------------------------------------------------
// 템플릿 API
// ----------------------------------------------------------------

async function doSaveTemplate(rows) {
  await supabase.from("template_schedule").delete().neq("id", 0);

  if (!rows.length) return { ok: true, count: 0 };

  const values = rows.map((r) => ({
    day: r.day || "",
    part: r.part || "",
    employee_id: r.employee_id || "",
    name: r.name || "",
    planned_start: r.planned_start || "",
    planned_end: r.planned_end || "",
  }));

  const { error } = await supabase.from("template_schedule").insert(values);
  assertNoError(error, "save_template");

  return { ok: true, count: values.length };
}

async function doApplyTemplate(startDateStr) {
  const monday = new Date(startDateStr);
  if (isNaN(monday.getTime())) throw new Error("Invalid startDate");

  const { data: templateRows, error: tmplError } = await supabase
    .from("template_schedule")
    .select("*");

  assertNoError(tmplError, "template_schedule fetch");

  if (!templateRows?.length) {
    throw new Error("template_schedule이 비어 있습니다.");
  }

  const DAY_OFFSET = { 월: 0, 화: 1, 수: 2, 목: 3, 금: 4, 토: 5, 일: 6 };

  const toInsert = templateRows
    .map((t) => {
      const offset = DAY_OFFSET[t.day];
      if (offset === undefined) return null;

      const d = new Date(monday);
      d.setDate(monday.getDate() + offset);
      const dateStr = d.toISOString().slice(0, 10);

      return {
        id: generateId("SCH"),
        employee_id: t.employee_id,
        name: t.name || "",
        work_date: dateStr,
        part: t.part,
        planned_start: t.planned_start,
        planned_end: t.planned_end,
        memo: "",
      };
    })
    .filter(Boolean);

  const { error } = await supabase
    .from("schedules")
    .upsert(toInsert, { onConflict: "employee_id,work_date,part" });

  assertNoError(error, "apply_template upsert");

  return { ok: true, count: toInsert.length };
}

// ----------------------------------------------------------------
// 공개 유틸 — re-export (단일 소스: domain 레이어)
// ----------------------------------------------------------------
//
// ⚠️  아래 함수/상수들은 domain 레이어로 이동 완료.
//     기존 import를 깨뜨리지 않기 위해 re-export 유지.
//     새 코드에서는 반드시 아래 경로에서 직접 import할 것.
//
//     getAttendanceStatus, ATTENDANCE_STATUS
//       → "../domain/attendance/getAttendanceStatus"
//
//     getApprovalStatusLabel, getApprovalReasonLabel, getPartLabel
//       → "../domain/attendance/labels"
//
//     isPendingAttendance, isApprovedAttendance, isRejectedAttendance
//       → "../domain/attendance/selectors"  (isPending, isApproved, isRejected)
//
//     diffMinutes, getPaidWorkMinutes, getActualWorkMinutes
//       → "../utils/pay"  (diffMinutes, calcWorkMinutes)
//

export {
  ATTENDANCE_STATUS,
  getAttendanceStatus,
} from "../domain/attendance/getAttendanceStatus";

export {
  getApprovalStatusLabel,
  getApprovalReasonLabel,
  getPartLabel,
} from "../domain/attendance/labels";

export {
  isPending   as isPendingAttendance,
  isApproved  as isApprovedAttendance,
  isRejected  as isRejectedAttendance,
  isWorking   as isWorkingNow,
} from "../domain/attendance/selectors";

export {
  diffMinutes,
  calcWorkMinutes     as getPaidWorkMinutes,
  calcActualWorkMinutes as getActualWorkMinutes,
} from "../utils/pay";

/**
 * @deprecated pay.js의 calcWorkMinutes 사용
 * row.scheduled_work_min은 normalizeAttendance에서 계산된 캐시값.
 * 직접 계산이 필요하면 calcWorkMinutes(row.planned_start, row.planned_end, 0) 사용.
 */
export function getScheduledWorkMinutes(row) {
  return Number(row?.scheduled_work_min || 0);
}

// ----------------------------------------------------------------
// useApi hook
// ----------------------------------------------------------------

export default function useApi(options = {}) {
  const { month = getCurrentMonthStr(), employeeId = "", autoLoad = true } = options;

  const [loading, setLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [error, setError] = useState("");

  const [employees, setEmployees] = useState([]);
  const [templateSchedule, setTemplateSchedule] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [monthAttendance, setMonthAttendance] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [todaySchedule, setTodaySchedule] = useState([]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAll(month);
      setEmployees(data.employees);
      setTemplateSchedule(data.template_schedule);
      setSchedule(filterRowsByMonth(data.schedule, month));
      setMonthAttendance(filterRowsByMonth(data.attendance, month));
    } catch (err) {
      setError(err.message || "데이터를 불러오지 못했습니다.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [month]);

const refreshAdminToday = useCallback(async () => {
  setTodayLoading(true);
  setError("");

  try {
    const data = await fetchAdminToday();

    // ─────────────────────────────────────────────
    // 자동 퇴근 처리
    // 파트 종료 + 10분 지나도 퇴근 안 누르면
    // check_out = planned_end 로 강제 저장
    // ─────────────────────────────────────────────
    const now = new Date();

    for (const row of data.attendance || []) {
      if (!row.check_in || row.check_out || !row.planned_end) continue;

      const [hh, mm] = String(row.planned_end).split(":").map(Number);
      if (isNaN(hh) || isNaN(mm)) continue;

      const deadline = new Date();
      deadline.setHours(hh, mm + 10, 0, 0); // 종료 +10분

      if (now > deadline) {
        await doUpdateAttendance({
          attendance_id: row.attendance_id,
          check_out: row.planned_end,          // 기록은 종료시간으로 보정
          paid_check_out: row.planned_end,
          auto_checkout: true,
          approval_note: [
            row.approval_note,
            "자동퇴근(10분 초과 / 종료시간 보정)"
          ].filter(Boolean).join(" / "),
        });
      }
    }

    // 자동퇴근 후 재조회
    const refreshed = await fetchAdminToday();

    setTodaySchedule(refreshed.schedule);
    setTodayAttendance(refreshed.attendance);

    if (refreshed.employees) {
      setEmployees(refreshed.employees);
    }
  } catch (err) {
    setError(err.message || "오늘 데이터를 불러오지 못했습니다.");
    throw err;
  } finally {
    setTodayLoading(false);
  }
}, []);

  const refreshStaffToday = useCallback(async () => {
    if (!employeeId) return;
    setTodayLoading(true);
    setError("");
    try {
      const data = await fetchStaffToday(employeeId);
      setTodaySchedule(data.schedule);
      setTodayAttendance(data.attendance);
    } catch (err) {
      setError(err.message || "직원 오늘 데이터를 불러오지 못했습니다.");
      throw err;
    } finally {
      setTodayLoading(false);
    }
  }, [employeeId]);

  const refreshStaffMonth = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchStaffMonth(employeeId, month);
      setMonthAttendance(filterRowsByMonth(data.attendance, month));
    } catch (err) {
      setError(err.message || "직원 월 데이터를 불러오지 못했습니다.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [employeeId, month]);

  const refreshPendingAttendance = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchPendingAttendance(month);
      return data.attendance;
    } catch (err) {
      setError(err.message || "승인대기 데이터를 불러오지 못했습니다.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [month]);

  const checkIn = useCallback(
    async (payload) => {
      const data = await doCheckIn(payload);
      await refreshAll();
      await (payload?.employee_id || employeeId ? refreshStaffToday() : refreshAdminToday()).catch(
        () => {},
      );
      return data;
    },
    [employeeId, refreshAll, refreshAdminToday, refreshStaffToday],
  );

  const checkOut = useCallback(
    async (payload) => {
      const data = await doCheckOut(payload);
      await refreshAll();
      await (payload?.employee_id || employeeId ? refreshStaffToday() : refreshAdminToday()).catch(
        () => {},
      );
      return data;
    },
    [employeeId, refreshAll, refreshAdminToday, refreshStaffToday],
  );

  const approveAttendance = useCallback(
    async (payload) => {
      const data = await doApproveAttendance(payload);
      await refreshAll();
      await refreshAdminToday().catch(() => {});
      return data;
    },
    [refreshAll, refreshAdminToday],
  );

  const updateAttendance = useCallback(
    async (payload) => {
      const data = await doUpdateAttendance(payload);
      await refreshAll();
      await refreshAdminToday().catch(() => {});
      return data;
    },
    [refreshAll, refreshAdminToday],
  );

  const addSchedule = useCallback(
    async (payload) => {
      const data = await doAddSchedule(payload);
      await refreshAll();
      await refreshAdminToday().catch(() => {});
      return data;
    },
    [refreshAll, refreshAdminToday],
  );

  const updateSchedule = useCallback(
    async (payload) => {
      const data = await doUpdateSchedule(payload);
      await refreshAll();
      await refreshAdminToday().catch(() => {});
      return data;
    },
    [refreshAll, refreshAdminToday],
  );

  const deleteSchedule = useCallback(
    async (payload) => {
      const data = await doDeleteSchedule(payload);
      await refreshAll();
      await refreshAdminToday().catch(() => {});
      return data;
    },
    [refreshAll, refreshAdminToday],
  );

  const addEmployee = useCallback(
    async (payload) => {
      const data = await doAddEmployee(payload);
      await refreshAll();
      return data;
    },
    [refreshAll],
  );

  const updateEmployee = useCallback(
    async (payload) => {
      const data = await doUpdateEmployee(payload);
      await refreshAll();
      return data;
    },
    [refreshAll],
  );

  const deleteEmployee = useCallback(
    async (payload) => {
      const data = await doDeleteEmployee(payload);
      await refreshAll();
      return data;
    },
    [refreshAll],
  );

  const saveTemplate = useCallback(
    async (rows) => {
      const data = await doSaveTemplate(rows);
      await refreshAll();
      return data;
    },
    [refreshAll],
  );

  const applyTemplate = useCallback(
    async (startDate) => {
      const data = await doApplyTemplate(startDate);
      await refreshAll();
      await refreshAdminToday().catch(() => {});
      return data;
    },
    [refreshAll, refreshAdminToday],
  );

  const lockMonthlyPay = useCallback(
    async ({ yearMonth, lockedBy, calcFn }) => {
      setLoading(true);
      setError("");
      try {
        const result = await doLockMonthlyPay({
          yearMonth,
          attRows: monthAttendance,
          empRows: employees,
          lockedBy,
          calcFn,
        });
        return result;
      } catch (err) {
        setError(err.message || "정산 마감에 실패했습니다.");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [monthAttendance, employees],
  );

  const runPolicySweep = useCallback(async () => {
    await refreshAll();
    await refreshAdminToday().catch(() => {});
    return { ok: true };
  }, [refreshAll, refreshAdminToday]);

  const clearCache = useCallback(async () => {
    return { ok: true };
  }, []);

  useEffect(() => {
    if (!autoLoad) return;
    refreshAll();
  }, [autoLoad, refreshAll]);

  const todayStr = getTodayStr();

  const todayScheduleFromMonth = useMemo(
    () =>
      schedule.filter(
        (row) => row.date === todayStr && (!employeeId || row.employee_id === employeeId),
      ),
    [schedule, todayStr, employeeId],
  );

  const todayAttendanceFromMonth = useMemo(
    () =>
      monthAttendance.filter(
        (row) => row.date === todayStr && (!employeeId || row.employee_id === employeeId),
      ),
    [monthAttendance, todayStr, employeeId],
  );

  const mergedTodaySchedule = todaySchedule.length ? todaySchedule : todayScheduleFromMonth;
  const mergedTodayAttendance = todayAttendance.length ? todayAttendance : todayAttendanceFromMonth;

  const pendingAttendance = useMemo(
    () => monthAttendance.filter((row) => row.approval_status === "pending"),
    [monthAttendance],
  );

  const workingNow = useMemo(
    () => mergedTodayAttendance.filter((row) => row.check_in && !row.check_out),
    [mergedTodayAttendance],
  );

  const pendingToday = useMemo(
    () => mergedTodayAttendance.filter((row) => row.approval_status === "pending"),
    [mergedTodayAttendance],
  );

  const extensionPending = useMemo(() => [], []);
  const lateCheckoutPending = useMemo(() => [], []);

  const todayScheduleIdSet = useMemo(
    () => new Set(mergedTodayAttendance.map((row) => row.schedule_id).filter(Boolean)),
    [mergedTodayAttendance],
  );

  const absentToday = useMemo(
    () => mergedTodaySchedule.filter((row) => !todayScheduleIdSet.has(row.schedule_id)),
    [mergedTodaySchedule, todayScheduleIdSet],
  );

  return {
    loading,
    todayLoading,
    error,

    employees,
    templateSchedule,
    schedule,
    monthAttendance,
    todaySchedule: mergedTodaySchedule,
    todayAttendance: mergedTodayAttendance,

    pendingAttendance,
    pendingToday,
    workingNow,
    extensionPending,
    lateCheckoutPending,
    absentToday,

    refreshAll,
    refreshAdminToday,
    refreshStaffToday,
    refreshStaffMonth,
    refreshPendingAttendance,

    checkIn,
    checkOut,
    approveAttendance,
    updateAttendance,

    addSchedule,
    updateSchedule,
    deleteSchedule,

    addEmployee,
    updateEmployee,
    deleteEmployee,

    saveTemplate,
    applyTemplate,

    lockMonthlyPay,

    runPolicySweep,
    clearCache,
  };
}