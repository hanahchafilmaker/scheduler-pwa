import { useState, useCallback, useEffect, useRef } from "react";
import { API_URL } from "../api/config";
import { normalizeDate, safeStr } from "../utils";

function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function prevYM() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function useApi({ onError } = {}) {
  const [loading, setLoading] = useState(true);

  const [employees, setEmployees] = useState([]);
  const [schedule, setSchedule] = useState([]);

  // 오늘 근태와 월 근태 분리
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [monthAttendance, setMonthAttendance] = useState([]);

  // 기존 컴포넌트 호환용 — 월 전체 데이터를 기본 attendance로 노출
  const attendance = monthAttendance;
  const setAttendance = setMonthAttendance;

  // useRef로 최신 state 참조 유지 (optimisticPost 롤백용)
  const employeesRef = useRef([]);
  const scheduleRef = useRef([]);
  const todayAttendanceRef = useRef([]);
  const monthAttendanceRef = useRef([]);

  useEffect(() => { employeesRef.current = employees; }, [employees]);
  useEffect(() => { scheduleRef.current = schedule; }, [schedule]);
  useEffect(() => { todayAttendanceRef.current = todayAttendance; }, [todayAttendance]);
  useEffect(() => { monthAttendanceRef.current = monthAttendance; }, [monthAttendance]);

  // ── 홈 탭: 오늘 attendance + 이번달&저번달 schedule 병합 ─────────────
  const fetchToday = useCallback(async () => {
    try {
      const thisMon = currentYM();
      const prevMon = prevYM();

      const [todayRes, thisRes, prevRes] = await Promise.all([
        fetch(`${API_URL}?action=admin_today&t=${Date.now()}`),
        fetch(`${API_URL}?action=all&month=${thisMon}&t=${Date.now()}`),
        fetch(`${API_URL}?action=all&month=${prevMon}&t=${Date.now()}`),
      ]);

      const todayData = await todayRes.json();
      const thisData = await thisRes.json();
      const prevData = await prevRes.json();

      if (!todayData.ok) {
        throw new Error(todayData.error || "오늘 데이터 불러오기 실패");
      }

      setEmployees(todayData.employees || []);
      setTodayAttendance(todayData.attendance || []);

      const mergedSchedule = [
        ...(prevData.schedule || []),
        ...(thisData.schedule || []),
      ];
      setSchedule(mergedSchedule);
    } catch (err) {
      console.error(err);
      onError?.("오늘 데이터를 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [onError]);

  // FIX: fetchAll과 fetchMonth가 동일한 로직을 중복 — month 파라미터로 통합
  //      fetchMonth는 하위 호환을 위해 fetchAll의 alias로 유지
  const fetchAll = useCallback(
    async (month) => {
      setLoading(true);
      const ym = month || currentYM();

      try {
        const res = await fetch(
          `${API_URL}?action=all&month=${ym}&t=${Date.now()}`
        );
        const data = await res.json();

        if (!data.ok) {
          throw new Error(data.error || "전체 데이터 불러오기 실패");
        }

        setEmployees(data.employees || []);
        setSchedule(data.schedule || []);
        setMonthAttendance(data.attendance || []);
      } catch (err) {
        console.error(err);
        onError?.(`${ym} 전체 데이터를 불러오지 못했습니다`);
      } finally {
        setLoading(false);
      }
    },
    [onError]
  );

  // fetchMonth는 fetchAll의 alias (sim 탭 등 기존 호출부 호환)
  const fetchMonth = fetchAll;

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  const post = useCallback(async (body) => {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return res.json();
  }, []);

  // optimistic: ref로 스냅샷 → 즉시 반영 → 실패 시 롤백
  // FIX: 구버전은 state를 deps에 직접 넣어 stale 클로저 문제 발생
  //      → ref 패턴으로 항상 최신 값을 참조하도록 수정
  const optimisticPost = useCallback(
    async (body, applyOptimistic, refetch) => {
      const snapshot = {
        employees: employeesRef.current,
        schedule: scheduleRef.current,
        todayAttendance: todayAttendanceRef.current,
        monthAttendance: monthAttendanceRef.current,
      };

      applyOptimistic();

      try {
        const result = await post(body);

        if (!result?.ok) {
          throw new Error(result?.error || "서버 오류");
        }
      } catch (err) {
        setEmployees(snapshot.employees);
        setSchedule(snapshot.schedule);
        setTodayAttendance(snapshot.todayAttendance);
        setMonthAttendance(snapshot.monthAttendance);

        onError?.(err.message || "저장 실패. 다시 시도해주세요.");
        return;
      }

      if (refetch) {
        refetch();
      } else {
        fetchToday();
      }
    },
    [post, fetchToday, onError]
  );

  // ── Attendance ───────────────────────────────────────────────────
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
          setMonthAttendance((prev) =>
            prev.map((a) =>
              a.attendance_id === att.attendance_id
                ? { ...a, approved, needs_approval: false }
                : a
            )
          );
          setTodayAttendance((prev) =>
            prev.map((a) =>
              a.attendance_id === att.attendance_id
                ? { ...a, approved, needs_approval: false }
                : a
            )
          );
        },
        refetch
      ),
    [optimisticPost]
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
          setMonthAttendance((prev) =>
            prev.map((a) =>
              a.attendance_id === attEdit.attendance_id
                ? { ...a, ...attEdit }
                : a
            )
          );
          setTodayAttendance((prev) =>
            prev.map((a) =>
              a.attendance_id === attEdit.attendance_id
                ? { ...a, ...attEdit }
                : a
            )
          );
        },
        refetch
      ),
    [optimisticPost]
  );

  // ── Employee ─────────────────────────────────────────────────────
  const addEmployee = useCallback(
    (payload, refetch) => {
      const tempId = "TMP_" + Date.now();
      return optimisticPost(
        { action: "add_employee", ...payload },
        () =>
          setEmployees((prev) => [
            ...prev,
            { employee_id: tempId, ...payload, active: true },
          ]),
        refetch
      );
    },
    [optimisticPost]
  );

  const updateEmployee = useCallback(
    (empId, payload, refetch) =>
      optimisticPost(
        { action: "update_employee", employee_id: empId, ...payload },
        () =>
          setEmployees((prev) =>
            prev.map((e) =>
              safeStr(e.employee_id) === safeStr(empId)
                ? { ...e, ...payload }
                : e
            )
          ),
        refetch
      ),
    [optimisticPost]
  );

  const deleteEmployee = useCallback(
    (empId, refetch) =>
      optimisticPost(
        { action: "delete_employee", employee_id: empId },
        () =>
          setEmployees((prev) =>
            prev.filter((e) => safeStr(e.employee_id) !== safeStr(empId))
          ),
        refetch
      ),
    [optimisticPost]
  );

  // ── Schedule ─────────────────────────────────────────────────────
  const addSchedule = useCallback(
    (data, refetch) => {
      const tempId = "TMP_SCH_" + Date.now();
      return optimisticPost(
        { action: "add_schedule", ...data },
        () =>
          setSchedule((prev) => {
            const idx = prev.findIndex(
              (s) => normalizeDate(s.date) === data.date && s.part === data.part
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
        refetch
      );
    },
    [optimisticPost]
  );

  const updateSchedule = useCallback(
    (scheduleId, data, refetch) =>
      optimisticPost(
        { action: "update_schedule", schedule_id: scheduleId, ...data },
        () =>
          setSchedule((prev) =>
            prev.map((s) =>
              s.schedule_id === scheduleId ? { ...s, ...data } : s
            )
          ),
        refetch
      ),
    [optimisticPost]
  );

  const deleteSchedule = useCallback(
    (scheduleId, date, refetch) =>
      optimisticPost(
        { action: "delete_schedule", schedule_id: scheduleId, date },
        () =>
          setSchedule((prev) =>
            prev.filter((s) => s.schedule_id !== scheduleId)
          ),
        refetch
      ),
    [optimisticPost]
  );

  return {
    loading,

    employees,
    setEmployees,

    schedule,
    setSchedule,

    // 기존 호환
    attendance,
    setAttendance,

    // 신규 분리 state
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
