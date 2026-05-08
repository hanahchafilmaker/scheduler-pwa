// src/shared/hooks/useApi.js
// UTF-8 — 한글 깨짐 주의
//
// 실제 GAS API 구조 기반:
//   GET  ?action=admin_today        → { ok, employees, attendance(오늘) }
//   GET  ?action=all&month=YYYY-MM  → { ok, employees, schedule, attendance }
//   POST { action, ... }            → { ok, error? }
//
// GAS approve payload:
//   { action: "approve_attendance", attendance_id, approved, date }
//
// 상태 분리 원칙:
//   todayAttendance  ← admin_today.attendance  (TodayTab 전용)
//   monthAttendance  ← all.attendance           (AttTab / SimTab 전용)
//   schedule         ← all.schedule (이번달+저번달 병합, TodayTab도 사용 가능)
//
// TodayTab 내부 fetch 금지 — 이 hook 에서 데이터 공급

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

  const [employees,        setEmployees]        = useState([]);
  const [schedule,         setSchedule]         = useState([]);   // 이번달+저번달 병합
  const [todayAttendance,  setTodayAttendance]  = useState([]);   // 오늘 전용
  const [monthAttendance,  setMonthAttendance]  = useState([]);   // 이번달 전용

  // 기존 컴포넌트 호환 (AttTab이 attendance prop을 받는 경우)
  const attendance    = monthAttendance;
  const setAttendance = setMonthAttendance;

  // stale closure 방지용 ref
  const employeesRef       = useRef([]);
  const scheduleRef        = useRef([]);
  const todayAttRef        = useRef([]);
  const monthAttRef        = useRef([]);

  useEffect(() => { employeesRef.current      = employees;       }, [employees]);
  useEffect(() => { scheduleRef.current       = schedule;        }, [schedule]);
  useEffect(() => { todayAttRef.current       = todayAttendance; }, [todayAttendance]);
  useEffect(() => { monthAttRef.current       = monthAttendance; }, [monthAttendance]);

  // ── fetch: 오늘 탭용 ─────────────────────────────────────────────────────
  // todayAttendance + schedule(이번달&저번달) 로드
  // TodayTab은 이 데이터를 props로 받는다 — 내부 fetch 없음
  const fetchToday = useCallback(async () => {
    setLoading(true);
    try {
      const thisMon = currentYM();
      const prevMon = prevYM();

      const [todayRes, thisRes, prevRes] = await Promise.all([
        fetch(`${API_URL}?action=admin_today&t=${Date.now()}`),
        fetch(`${API_URL}?action=all&month=${thisMon}&t=${Date.now()}`),
        fetch(`${API_URL}?action=all&month=${prevMon}&t=${Date.now()}`),
      ]);

      const todayData = await todayRes.json();
      const thisData  = await thisRes.json();
      const prevData  = await prevRes.json();

      if (!todayData.ok) throw new Error(todayData.error || "오늘 데이터 불러오기 실패");

      setEmployees(todayData.employees || []);
      // 오늘 attendance — todayAttendance 에만 저장 (monthAttendance 절대 덮어쓰기 금지)
      setTodayAttendance(todayData.attendance || []);

      // schedule 은 이번달+저번달 병합 — TodayTab 의 todaySchedules 필터링에 사용
      setSchedule([
        ...(prevData.schedule || []),
        ...(thisData.schedule || []),
      ]);
    } catch (err) {
      console.error(err);
      onError?.("오늘 데이터를 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [onError]);

  // ── fetch: 월 전체 (AttTab / SimTab 전용) ────────────────────────────────
  const fetchAll = useCallback(async (month) => {
    setLoading(true);
    const ym = month || currentYM();
    try {
      const res  = await fetch(`${API_URL}?action=all&month=${ym}&t=${Date.now()}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "전체 데이터 불러오기 실패");

      setEmployees(data.employees || []);
      setSchedule(data.schedule  || []);
      // monthAttendance 에만 저장 — todayAttendance 절대 덮어쓰기 금지
      setMonthAttendance(data.attendance || []);
    } catch (err) {
      console.error(err);
      onError?.(`${ym} 데이터를 불러오지 못했습니다`);
    } finally {
      setLoading(false);
    }
  }, [onError]);

  const fetchMonth = fetchAll; // alias

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  // ── POST 기본 ────────────────────────────────────────────────────────────
  const post = useCallback(async (body) => {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return res.json();
  }, []);

  // ── optimisticPost: 낙관적 업데이트 + 실패 시 롤백 ──────────────────────
  // TodayTab overwrite 금지 원칙 준수:
  //   → applyOptimistic 에서 today/month 각각만 건드림
  //   → 서버 응답 성공 후 refetch 로 정확한 서버 상태 반영
  const optimisticPost = useCallback(
    async (body, applyOptimistic, refetch) => {
      const snap = {
        employees:      employeesRef.current,
        schedule:       scheduleRef.current,
        todayAtt:       todayAttRef.current,
        monthAtt:       monthAttRef.current,
      };

      applyOptimistic();

      try {
        const result = await post(body);
        if (!result?.ok) throw new Error(result?.error || "서버 오류");
      } catch (err) {
        // 롤백
        setEmployees(snap.employees);
        setSchedule(snap.schedule);
        setTodayAttendance(snap.todayAtt);
        setMonthAttendance(snap.monthAtt);
        onError?.(err.message || "저장 실패. 다시 시도해주세요.");
        return;
      }

      refetch ? refetch() : fetchToday();
    },
    [post, fetchToday, onError],
  );

  // ── Attendance 승인 ──────────────────────────────────────────────────────
  // GAS payload: { action, attendance_id, approved, date }
  // 시그니처: onApprove(att, true)  ← TodayTab / AttTab 공통 패턴
  const approveAttendance = useCallback(
    (att, approved, refetch) =>
      optimisticPost(
        {
          action:        "approve_attendance",
          attendance_id: att.attendance_id,   // 실제 필드명
          approved,
          date:          att.date,            // 실제 필드명
        },
        () => {
          // todayAttendance 낙관적 반영
          setTodayAttendance((prev) =>
            prev.map((a) =>
              a.attendance_id === att.attendance_id
                ? { ...a, approved, needs_approval: false }
                : a
            )
          );
          // monthAttendance 낙관적 반영 (AttTab 용)
          setMonthAttendance((prev) =>
            prev.map((a) =>
              a.attendance_id === att.attendance_id
                ? { ...a, approved, needs_approval: false }
                : a
            )
          );
        },
        refetch,
      ),
    [optimisticPost],
  );

  // ── Attendance 수정 ──────────────────────────────────────────────────────
  const updateAttendance = useCallback(
    (attEdit, refetch) =>
      optimisticPost(
        {
          action:        "update_attendance",
          attendance_id: attEdit.attendance_id,
          date:          attEdit.date,
          check_in:      attEdit.check_in,
          check_out:     attEdit.check_out,
          break_min:     Number(attEdit.break_min) || 0,
          memo:          attEdit.memo,
        },
        () => {
          setTodayAttendance((prev) =>
            prev.map((a) => a.attendance_id === attEdit.attendance_id ? { ...a, ...attEdit } : a)
          );
          setMonthAttendance((prev) =>
            prev.map((a) => a.attendance_id === attEdit.attendance_id ? { ...a, ...attEdit } : a)
          );
        },
        refetch,
      ),
    [optimisticPost],
  );

  // ── Employee CRUD ─────────────────────────────────────────────────────────
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
            prev.map((e) =>
              safeStr(e.employee_id) === safeStr(empId) ? { ...e, ...payload } : e
            )
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

  // ── Schedule CRUD ─────────────────────────────────────────────────────────
  // schedule 필드: schedule_id, employee_id, name, date, part, planned_start, planned_end
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
                employee_id:   data.employee_id,
                name:          data.name,
                planned_start: data.planned_start,  // schedule 필드
                planned_end:   data.planned_end,    // schedule 필드
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
            prev.map((s) => s.schedule_id === scheduleId ? { ...s, ...data } : s)
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

    employees,    setEmployees,
    schedule,     setSchedule,

    // 기존 컴포넌트 호환 (attendance = monthAttendance)
    attendance,   setAttendance,

    // 분리 state (신규)
    todayAttendance,  setTodayAttendance,
    monthAttendance,  setMonthAttendance,

    fetchToday,
    fetchAll,
    fetchMonth,   // alias of fetchAll

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
