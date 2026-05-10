import { useCallback, useEffect, useMemo, useState } from "react";

const GAS_URL =
  "https://script.google.com/macros/s/AKfycby1Mcb8NS4adpRxO_btO8e5vFhBy97fAozZOanxHGQdQD75FgFTAmblCGgZhvyn0bRk6A/exec";

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error(`JSON 파싱 실패: ${text.slice(0, 300)}`);
  }

  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error || `요청 실패 (${res.status})`);
  }

  return data;
}

async function getAction(action, params = {}) {
  const query = new URLSearchParams({
    action,
    ...params,
  }).toString();

  return fetchJson(`${GAS_URL}?${query}`);
}

async function postAction(payload) {
  return fetchJson(GAS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  });
}

function normalizeEmployee(row) {
  return {
    employee_id: row?.employee_id || "",
    name: row?.name || "",
    pin: row?.pin || "",
    phone: row?.phone || "",
    hourly_wage: Number(row?.hourly_wage || 0),
    active: row?.active !== false,
  };
}

function normalizeSchedule(row) {
  return {
    schedule_id: row?.schedule_id || "",
    name: row?.name || "",
    employee_id: row?.employee_id || "",
    date: row?.date || "",
    part: row?.part || "",
    planned_start: row?.planned_start || "",
    planned_end: row?.planned_end || "",
  };
}

function normalizeAttendance(row) {
  return {
    attendance_id: row?.attendance_id || "",
    schedule_id: row?.schedule_id || "",
    employee_id: row?.employee_id || "",
    date: row?.date || "",
    name: row?.name || "",
    part: row?.part || "",

    planned_start: row?.planned_start || "",
    planned_end: row?.planned_end || "",

    check_in: row?.check_in || "",
    check_out: row?.check_out || "",

    paid_check_in: row?.paid_check_in || row?.check_in || "",
    paid_check_out: row?.paid_check_out || row?.check_out || "",

    approval_status: row?.approval_status || "approved",
    approval_reason: row?.approval_reason || "",
    approval_note: row?.approval_note || "",
    requested_at: row?.requested_at || "",
    approved_at: row?.approved_at || "",
    approved_by: row?.approved_by || "",

    early_arrival_paid_min: Number(row?.early_arrival_paid_min || 0),
    late_min: Number(row?.late_min || 0),
    late_deduct_min: Number(row?.late_deduct_min || 0),
    extra_work_min: Number(row?.extra_work_min || 0),
    extension_min: Number(row?.extension_min || 0),
    break_min: Number(row?.break_min || 0),

    is_substitute: !!row?.is_substitute,
    auto_checkout: !!row?.auto_checkout,

    memo: row?.memo || "",
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

export function getApprovalReasonLabel(reason) {
  switch (reason) {
    case "late_check_in":
      return "지각 승인 요청";
    case "early_leave":
      return "조기 퇴근 요청";
    case "late_checkout":
      return "추가근무 승인 요청";
    case "next_part_late_extension":
      return "다음 파트 지각 연장 요청";
    case "out_of_schedule":
      return "스케줄 외 출근";
    default:
      return "확인 필요";
  }
}

export function getApprovalStatusLabel(status) {
  switch (status) {
    case "approved":
      return "승인";
    case "pending":
      return "승인대기";
    case "rejected":
      return "거절";
    case "auto_closed":
      return "자동종료";
    default:
      return "-";
  }
}

export function diffMinutes(start, end) {
  if (!start || !end) return 0;

  const [sh, sm] = String(start).split(":").map(Number);
  const [eh, em] = String(end).split(":").map(Number);

  if (Number.isNaN(sh) || Number.isNaN(sm) || Number.isNaN(eh) || Number.isNaN(em)) {
    return 0;
  }

  return eh * 60 + em - (sh * 60 + sm);
}

export function getPaidWorkMinutes(row) {
  const mins = diffMinutes(row?.paid_check_in, row?.paid_check_out) - Number(row?.break_min || 0);

  return Math.max(0, mins);
}

export function getActualWorkMinutes(row) {
  const mins = diffMinutes(row?.check_in, row?.check_out) - Number(row?.break_min || 0);

  return Math.max(0, mins);
}

export function isPendingAttendance(row) {
  return row?.approval_status === "pending";
}

export function isApprovedAttendance(row) {
  return row?.approval_status === "approved";
}

export function isRejectedAttendance(row) {
  return row?.approval_status === "rejected";
}

export function isWorkingNow(row) {
  return !!row?.check_in && !row?.check_out;
}

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
      const data = await getAction("all", { month });

      setEmployees((data?.employees || []).map(normalizeEmployee));
      setTemplateSchedule((data?.template_schedule || []).map(normalizeTemplateRow));
      setSchedule((data?.schedule || []).map(normalizeSchedule));
      setMonthAttendance((data?.attendance || []).map(normalizeAttendance));
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
      const data = await getAction("admin_today");

      setTodaySchedule((data?.schedule || []).map(normalizeSchedule));
      setTodayAttendance((data?.attendance || []).map(normalizeAttendance));

      if (data?.employees) {
        setEmployees((data.employees || []).map(normalizeEmployee));
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
      const data = await getAction("staff_today", { employee_id: employeeId });

      setTodaySchedule((data?.schedule || []).map(normalizeSchedule));
      setTodayAttendance((data?.attendance || []).map(normalizeAttendance));
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
      const data = await getAction("staff_month", {
        employee_id: employeeId,
        month,
      });

      setMonthAttendance((data?.attendance || []).map(normalizeAttendance));
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
      const data = await getAction("pending_attendance", { month });
      return (data?.attendance || []).map(normalizeAttendance);
    } catch (err) {
      setError(err.message || "승인대기 데이터를 불러오지 못했습니다.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [month]);

  const checkIn = useCallback(
    async (payload) => {
      const data = await postAction({
        action: "check_in",
        ...payload,
      });

      await refreshAll();

      if (payload?.employee_id || employeeId) {
        await refreshStaffToday().catch(() => {});
      } else {
        await refreshAdminToday().catch(() => {});
      }

      return data;
    },
    [employeeId, refreshAll, refreshAdminToday, refreshStaffToday],
  );

  const checkOut = useCallback(
    async (payload) => {
      const data = await postAction({
        action: "check_out",
        ...payload,
      });

      await refreshAll();

      if (payload?.employee_id || employeeId) {
        await refreshStaffToday().catch(() => {});
      } else {
        await refreshAdminToday().catch(() => {});
      }

      return data;
    },
    [employeeId, refreshAll, refreshAdminToday, refreshStaffToday],
  );

  const approveAttendance = useCallback(
    async ({ attendance_id, approved, approved_by = "manager", approval_note = "", date }) => {
      const data = await postAction({
        action: "approve_attendance",
        attendance_id,
        approved,
        approved_by,
        approval_note,
        date,
      });

      await refreshAll();
      await refreshAdminToday().catch(() => {});
      return data;
    },
    [refreshAll, refreshAdminToday],
  );

  const updateAttendance = useCallback(
    async (payload) => {
      const data = await postAction({
        action: "update_attendance",
        ...payload,
      });

      await refreshAll();
      await refreshAdminToday().catch(() => {});
      return data;
    },
    [refreshAll, refreshAdminToday],
  );

  const addSchedule = useCallback(
    async (payload) => {
      const data = await postAction({
        action: "add_schedule",
        ...payload,
      });

      await refreshAll();
      await refreshAdminToday().catch(() => {});
      return data;
    },
    [refreshAll, refreshAdminToday],
  );

  const updateSchedule = useCallback(
    async (payload) => {
      const data = await postAction({
        action: "update_schedule",
        ...payload,
      });

      await refreshAll();
      await refreshAdminToday().catch(() => {});
      return data;
    },
    [refreshAll, refreshAdminToday],
  );

  const deleteSchedule = useCallback(
    async (payload) => {
      const data = await postAction({
        action: "delete_schedule",
        ...payload,
      });

      await refreshAll();
      await refreshAdminToday().catch(() => {});
      return data;
    },
    [refreshAll, refreshAdminToday],
  );

  const addEmployee = useCallback(
    async (payload) => {
      const data = await postAction({
        action: "add_employee",
        ...payload,
      });

      await refreshAll();
      return data;
    },
    [refreshAll],
  );

  const updateEmployee = useCallback(
    async (payload) => {
      const data = await postAction({
        action: "update_employee",
        ...payload,
      });

      await refreshAll();
      return data;
    },
    [refreshAll],
  );

  const deleteEmployee = useCallback(
    async (payload) => {
      const data = await postAction({
        action: "delete_employee",
        ...payload,
      });

      await refreshAll();
      return data;
    },
    [refreshAll],
  );

  const saveTemplate = useCallback(
    async (rows) => {
      const data = await postAction({
        action: "save_template",
        rows,
      });

      await refreshAll();
      return data;
    },
    [refreshAll],
  );

  const applyTemplate = useCallback(
    async (startDate) => {
      const data = await postAction({
        action: "apply_template",
        startDate,
      });

      await refreshAll();
      await refreshAdminToday().catch(() => {});
      return data;
    },
    [refreshAll, refreshAdminToday],
  );

  const runPolicySweep = useCallback(async () => {
    const data = await postAction({
      action: "run_policy_sweep",
      month,
    });

    await refreshAll();
    await refreshAdminToday().catch(() => {});
    return data;
  }, [month, refreshAll, refreshAdminToday]);

  const clearCache = useCallback(async () => {
    return postAction({ action: "clear_cache" });
  }, []);

  useEffect(() => {
    if (!autoLoad) return;
    refreshAll();
  }, [autoLoad, refreshAll]);

  const todayStr = getTodayStr();

  const todayScheduleFromMonth = useMemo(
    () => schedule.filter((row) => row.date === todayStr),
    [schedule, todayStr],
  );

  const todayAttendanceFromMonth = useMemo(
    () => monthAttendance.filter((row) => row.date === todayStr),
    [monthAttendance, todayStr],
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

  const extensionPending = useMemo(
    () => mergedTodayAttendance.filter((row) => row.approval_reason === "next_part_late_extension"),
    [mergedTodayAttendance],
  );

  const lateCheckoutPending = useMemo(
    () => mergedTodayAttendance.filter((row) => row.approval_reason === "late_checkout"),
    [mergedTodayAttendance],
  );

  const todayScheduleIdSet = useMemo(
    () => new Set(mergedTodayAttendance.map((row) => row.schedule_id).filter(Boolean)),
    [mergedTodayAttendance],
  );

  const absentToday = useMemo(
    () => mergedTodaySchedule.filter((row) => !todayScheduleIdSet.has(row.schedule_id)),
    [mergedTodaySchedule, todayScheduleIdSet],
  );

  return {
    GAS_URL,

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

    runPolicySweep,
    clearCache,
  };
}
