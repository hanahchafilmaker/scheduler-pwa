import { useState, useCallback, useEffect } from "react";
import { API_URL } from "../constants";
import { normalizeDate, safeStr } from "../utils";

export function useApi() {
  const [loading, setLoading]       = useState(true);
  const [employees, setEmployees]   = useState([]);
  const [schedule,  setSchedule]    = useState([]);
  const [attendance, setAttendance] = useState([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}?action=all`);
      const json = await res.json();
      setEmployees(json.employees   || []);
      setSchedule(json.schedule     || []);
      setAttendance(json.attendance || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const post = useCallback(async (body) => {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return res.json();
  }, []);

  // 즉시 로컬 반영 → 백그라운드 서버 저장 → 조용히 재검증
  const optimisticPost = useCallback(async (body, applyOptimistic) => {
    applyOptimistic();
    try {
      await post(body);
    } finally {
      fetchAll();
    }
  }, [post, fetchAll]);

  // ── Attendance ─────────────────────────────────────────────────────────────
  const approveAttendance = useCallback((attId, approved) =>
    optimisticPost(
      { action: "approve_attendance", attendance_id: attId, approved },
      () => setAttendance((prev) =>
        prev.map((a) => a.attendance_id === attId ? { ...a, approved } : a)
      )
    ), [optimisticPost]);

  const updateAttendance = useCallback((attEdit) =>
    optimisticPost(
      {
        action: "update_attendance",
        attendance_id: attEdit.attendance_id,
        check_in:  attEdit.check_in,
        check_out: attEdit.check_out,
        break_min: Number(attEdit.break_min) || 0,
      },
      () => setAttendance((prev) =>
        prev.map((a) => a.attendance_id === attEdit.attendance_id ? { ...a, ...attEdit } : a)
      )
    ), [optimisticPost]);

  // ── Employee ───────────────────────────────────────────────────────────────
  const addEmployee = useCallback((payload) => {
    const tempId = "TMP_" + Date.now();
    return optimisticPost(
      { action: "add_employee", ...payload },
      () => setEmployees((prev) => [...prev, { employee_id: tempId, ...payload, active: true }])
    );
  }, [optimisticPost]);

  const updateEmployee = useCallback((empId, payload) =>
    optimisticPost(
      { action: "update_employee", employee_id: empId, ...payload },
      () => setEmployees((prev) =>
        prev.map((e) => safeStr(e.employee_id) === safeStr(empId) ? { ...e, ...payload } : e)
      )
    ), [optimisticPost]);

  const deleteEmployee = useCallback((empId) =>
    optimisticPost(
      { action: "delete_employee", employee_id: empId },
      () => setEmployees((prev) =>
        prev.filter((e) => safeStr(e.employee_id) !== safeStr(empId))
      )
    ), [optimisticPost]);

  // ── Schedule ───────────────────────────────────────────────────────────────
  const addSchedule = useCallback((data) => {
    const tempId = "TMP_SCH_" + Date.now();
    return optimisticPost(
      { action: "add_schedule", ...data },
      () => setSchedule((prev) => {
        const idx = prev.findIndex(
          (s) => normalizeDate(s.date) === data.date && s.part === data.part
        );
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = { ...next[idx], employee_id: data.employee_id, name: data.name };
          return next;
        }
        return [...prev, { schedule_id: tempId, ...data }];
      })
    );
  }, [optimisticPost]);

  const updateSchedule = useCallback((scheduleId, data) =>
    optimisticPost(
      { action: "update_schedule", schedule_id: scheduleId, ...data },
      () => setSchedule((prev) =>
        prev.map((s) => s.schedule_id === scheduleId ? { ...s, ...data } : s)
      )
    ), [optimisticPost]);

  const deleteSchedule = useCallback((scheduleId) =>
    optimisticPost(
      { action: "delete_schedule", schedule_id: scheduleId },
      () => setSchedule((prev) => prev.filter((s) => s.schedule_id !== scheduleId))
    ), [optimisticPost]);

  return {
    loading,
    employees, setEmployees,
    schedule,  setSchedule,
    attendance, setAttendance,
    fetchAll,
    post,
    approveAttendance,
    updateAttendance,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    addSchedule,
    updateSchedule,
    deleteSchedule,
  };
}
