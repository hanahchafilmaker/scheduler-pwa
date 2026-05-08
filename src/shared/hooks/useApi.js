// src/shared/hooks/useApi.js

import { useState, useCallback, useEffect, useRef } from "react";
import { API_URL } from "../api/config";
import { normalizeDate, safeStr } from "../utils";

function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function useApi({ onError } = {}) {
  const [loading, setLoading] = useState(true);

  const [employees, setEmployees] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [monthAttendance, setMonthAttendance] = useState([]);

  const attendance = monthAttendance;
  const setAttendance = setMonthAttendance;

  const employeesRef = useRef([]);
  const scheduleRef = useRef([]);
  const todayAttRef = useRef([]);
  const monthAttRef = useRef([]);

  useEffect(() => {
    employeesRef.current = employees;
  }, [employees]);

  useEffect(() => {
    scheduleRef.current = schedule;
  }, [schedule]);

  useEffect(() => {
    todayAttRef.current = todayAttendance;
  }, [todayAttendance]);

  useEffect(() => {
    monthAttRef.current = monthAttendance;
  }, [monthAttendance]);

  const fetchToday = useCallback(async () => {
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}?action=admin_today&t=${Date.now()}`);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || "오늘 데이터 로딩 실패");
      }

      setEmployees(data.employees || []);
      setTodayAttendance(data.attendance || []);
      setSchedule(data.schedule || []);
    } catch (err) {
      console.error(err);
      onError?.("오늘 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [onError]);

  const fetchAll = useCallback(
    async (month) => {
      setLoading(true);
      const ym = month || currentYM();

      try {
        const res = await fetch(`${API_URL}?action=all&month=${ym}&t=${Date.now()}`);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        if (!data.ok) {
          throw new Error(data.error || "월 데이터를 불러오지 못했습니다.");
        }

        setEmployees(data.employees || []);
        setSchedule(data.schedule || []);
        setMonthAttendance(data.attendance || []);
      } catch (err) {
        console.error(err);
        onError?.(`${ym} 데이터를 불러오지 못했습니다.`);
      } finally {
        setLoading(false);
      }
    },
    [onError],
  );

  const fetchMonth = fetchAll;

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  const post = useCallback(async (body) => {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return res.json();
  }, []);

  const optimisticPost = useCallback(
    async (body, applyOptimistic, refetch) => {
      const snap = {
        employees: employeesRef.current,
        schedule: scheduleRef.current,
        todayAtt: todayAttRef.current,
        monthAtt: monthAttRef.current,
      };

      applyOptimistic();

      try {
        const result = await post(body);

        if (!result?.ok) {
          throw new Error(result?.error || "서버 오류");
        }
      } catch (err) {
        setEmployees(snap.employees);
        setSchedule(snap.schedule);
        setTodayAttendance(snap.todayAtt);
        setMonthAttendance(snap.monthAtt);

        onError?.(err.message || "처리 실패. 다시 시도해주세요.");
        return;
      }

      if (refetch) {
        await refetch();
      }
    },
    [post, onError],
  );

  const approveAttendance = useCallback(
    (att, approved, refetch) =>
      optimisticPost(
        {
          action: "approve_attendance",
          attendance_id: att.attendance_id,
          approved,
          date: att.date,
        },
        () => {
          setTodayAttendance((prev) =>
            prev.map((a) =>
              a.attendance_id === att.attendance_id ? { ...a, approved, needs_approval: false } : a,
            ),
          );

          setMonthAttendance((prev) =>
            prev.map((a) =>
              a.attendance_id === att.attendance_id ? { ...a, approved, needs_approval: false } : a,
            ),
          );
        },
        refetch,
      ),
    [optimisticPost],
  );

  const updateAttendance = useCallback(
    (attEdit, refetch) =>
      optimisticPost(
        {
          action: "update_attendance",
          attendance_id: attEdit.attendance_id,
          date: attEdit.date,
          check_in: attEdit.check_in,
          check_out: attEdit.check_out,
          break_min: Number(attEdit.break_min) || 0,
          memo: attEdit.memo,
        },
        () => {
          setTodayAttendance((prev) =>
            prev.map((a) => (a.attendance_id === attEdit.attendance_id ? { ...a, ...attEdit } : a)),
          );

          setMonthAttendance((prev) =>
            prev.map((a) => (a.attendance_id === attEdit.attendance_id ? { ...a, ...attEdit } : a)),
          );
        },
        refetch,
      ),
    [optimisticPost],
  );

  const addEmployee = useCallback(
    (payload, refetch) => {
      const tempId = "TMP_" + Date.now();

      return optimisticPost(
        { action: "add_employee", ...payload },
        () => setEmployees((prev) => [...prev, { employee_id: tempId, ...payload, active: true }]),
        refetch,
      );
    },
    [optimisticPost],
  );

  const updateEmployee = useCallback(
    (empId, payload, refetch) =>
      optimisticPost(
        { action: "update_employee", employee_id: empId, ...payload },
        () =>
          setEmployees((prev) =>
            prev.map((e) => (safeStr(e.employee_id) === safeStr(empId) ? { ...e, ...payload } : e)),
          ),
        refetch,
      ),
    [optimisticPost],
  );

  const deleteEmployee = useCallback(
    (empId, refetch) =>
      optimisticPost(
        { action: "delete_employee", employee_id: empId },
        () => setEmployees((prev) => prev.filter((e) => safeStr(e.employee_id) !== safeStr(empId))),
        refetch,
      ),
    [optimisticPost],
  );

  const addSchedule = useCallback(
    (data, refetch) => {
      const tempId = "TMP_SCH_" + Date.now();

      return optimisticPost(
        { action: "add_schedule", ...data },
        () =>
          setSchedule((prev) => {
            const idx = prev.findIndex(
              (s) => normalizeDate(s.date) === data.date && s.part === data.part,
            );

            if (idx !== -1) {
              const next = [...prev];
              next[idx] = {
                ...next[idx],
                employee_id: data.employee_id,
                name: data.name,
                planned_start: data.planned_start,
                planned_end: data.planned_end,
              };
              return next;
            }

            return [...prev, { schedule_id: tempId, ...data }];
          }),
        refetch,
      );
    },
    [optimisticPost],
  );

  const updateSchedule = useCallback(
    (scheduleId, data, refetch) =>
      optimisticPost(
        { action: "update_schedule", schedule_id: scheduleId, ...data },
        () =>
          setSchedule((prev) =>
            prev.map((s) => (s.schedule_id === scheduleId ? { ...s, ...data } : s)),
          ),
        refetch,
      ),
    [optimisticPost],
  );

  const deleteSchedule = useCallback(
    (scheduleId, date, refetch) =>
      optimisticPost(
        { action: "delete_schedule", schedule_id: scheduleId, date },
        () => setSchedule((prev) => prev.filter((s) => s.schedule_id !== scheduleId)),
        refetch,
      ),
    [optimisticPost],
  );

  return {
    loading,

    employees,
    setEmployees,

    schedule,
    setSchedule,

    attendance,
    setAttendance,

    todayAttendance,
    setTodayAttendance,

    monthAttendance,
    setMonthAttendance,

    fetchToday,
    fetchAll,
    fetchMonth,

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
