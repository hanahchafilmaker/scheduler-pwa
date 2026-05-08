import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDateString, normalizeDate, safeStr, calcWorkMinutes, toBool } from "@shared/utils";
import {
  fetchStaffEmployees,
  fetchStaffToday,
  fetchStaffMonth,
  checkInStaff,
  checkOutStaff,
} from "@shared/api";

import PinScreen from "./components/PinScreen";
import StaffHome from "./components/StaffHome";
import "./staff.css";

function nowTime() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

function getMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function StaffApp() {
  const [employees, setEmployees] = useState([]);
  const [employee, setEmployee] = useState(null);
  const [inputPin, setInputPin] = useState("");
  const [pinError, setPinError] = useState("");

  const [workType, setWorkType] = useState(null);
  const [todayData, setTodayData] = useState({ schedule: [], attendance: [] });
  const [records, setRecords] = useState([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState("");

  const toastTimerRef = useRef(null);
  const today = getDateString(new Date());

  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), 2200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadEmployees() {
      try {
        setLoading(true);
        setPinError("");

        const data = await fetchStaffEmployees();

        if (!mounted) return;

        setEmployees(Array.isArray(data) ? data : []);

        if (!Array.isArray(data) || data.length === 0) {
          setPinError("직원 데이터가 비어 있습니다. 시트 employees를 확인해주세요.");
        }
      } catch (err) {
        console.error("직원 데이터 fetch 실패:", err);

        if (!mounted) return;

        setEmployees([]);
        setPinError("직원 데이터를 불러오지 못했습니다.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadEmployees();

    return () => {
      mounted = false;
    };
  }, []);

  const loadToday = useCallback(
    async (empId) => {
      if (!empId) return;

      try {
        const data = await fetchStaffToday(empId);

        setTodayData({
          schedule: Array.isArray(data?.schedule) ? data.schedule : [],
          attendance: Array.isArray(data?.attendance) ? data.attendance : [],
        });
      } catch (err) {
        console.error("오늘 데이터 fetch 실패:", err);
        showToast("오늘 데이터를 불러오지 못했습니다.");
      }
    },
    [showToast],
  );

  const loadMonth = useCallback(
    async (empId) => {
      if (!empId) return;

      try {
        const data = await fetchStaffMonth(empId, getMonthKey());
        setRecords(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("이번 달 기록 fetch 실패:", err);
        showToast("이번 달 기록을 불러오지 못했습니다.");
      }
    },
    [showToast],
  );

  const handleLogin = async () => {
    const pin = String(inputPin || "").trim();

    if (!pin) {
      setPinError("PIN을 입력해주세요");
      return;
    }

    if (loading) {
      setPinError("직원 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요");
      return;
    }

    if (!Array.isArray(employees) || employees.length === 0) {
      setPinError("직원 데이터를 불러오지 못했습니다. 새로고침 해주세요");
      return;
    }

    const found = employees.find((e) => {
      const empPin = String(e.pin ?? "").trim();
      const active = e.active !== false && String(e.active).toLowerCase() !== "false";

      return empPin === pin && active;
    });

    if (!found) {
      setPinError("PIN이 올바르지 않습니다");
      setInputPin("");
      return;
    }

    setEmployee(found);
    setPinError("");
    setInputPin("");
    setWorkType(null);

    await loadToday(found.employee_id);
    await loadMonth(found.employee_id);
  };

  const handleLogout = useCallback(() => {
    setEmployee(null);
    setWorkType(null);
    setTodayData({ schedule: [], attendance: [] });
    setRecords([]);
    setPinError("");
    setInputPin("");
  }, []);

  const todayAttendance = useMemo(() => {
    if (!employee) return null;

    // 오늘 날짜 + 해당 직원의 attendance 전체 목록
    // 1일 1레코드가 아닌 "1회 출근 = 1 attendance row" 구조 대응
    const myTodayAttendances = todayData.attendance
      .filter(
        (a) =>
          normalizeDate(a.date) === today &&
          safeStr(a.employee_id) === safeStr(employee.employee_id),
      )
      .sort((a, b) => {
        // check_in 내림차순 — 가장 최근 출근이 앞으로
        const ta = String(a.check_in || "00:00");
        const tb = String(b.check_in || "00:00");
        return tb.localeCompare(ta);
      });

    // 우선순위 1: 현재 진행중인 attendance (check_in O, check_out X)
    const active = myTodayAttendances.find((a) => a.check_in && !a.check_out);

    // 우선순위 2: 없으면 가장 최근 attendance
    return active || myTodayAttendances[0] || null;
  }, [todayData, employee, today]);

  const todaySchedule = useMemo(() => {
    if (!employee) return null;

    return (
      todayData.schedule.find(
        (s) =>
          normalizeDate(s.date) === today &&
          safeStr(s.employee_id) === safeStr(employee.employee_id),
      ) || null
    );
  }, [todayData, employee, today]);

  useEffect(() => {
    if (todaySchedule?.part && !workType) {
      setWorkType(todaySchedule.part);
    }
  }, [todaySchedule, workType]);

  const hasOpenAttendance = !!todayAttendance?.check_in && !todayAttendance?.check_out;

  const isApproved =
    todayAttendance?.approved === true ||
    String(todayAttendance?.approved).toLowerCase() === "true";

  const isRejected =
    hasOpenAttendance &&
    (todayAttendance?.approved === false ||
      String(todayAttendance?.approved).toLowerCase() === "false");

  const isPending = hasOpenAttendance && !isApproved && !isRejected;

  // 승인 여부와 관계없이 출근 기록이 열려있으면 근무중
  // 단, 반려된 경우는 제외
  const isWorking = hasOpenAttendance && !isRejected;

  const isDone = !!todayAttendance?.check_in && !!todayAttendance?.check_out && isApproved;

  const handleCheckIn = async () => {
    if (!employee) return;

    if (!workType) {
      showToast("근무 타입을 선택해주세요");
      return;
    }

    setActionLoading(true);

    try {
      await checkInStaff({
        employee,
        workType,
        date: today,
        checkIn: nowTime(),
      });

      showToast("출근 요청 완료");
      await loadToday(employee.employee_id);
    } catch (err) {
      console.error("출근 실패:", err);
      showToast(err?.message || "출근 처리 실패");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!employee) return;

    if (!todayAttendance?.attendance_id) {
      showToast("출근 기록이 없습니다");
      return;
    }

    setActionLoading(true);

    try {
      await checkOutStaff({
        attendanceId: todayAttendance.attendance_id,
        checkOut: nowTime(),
      });

      showToast("퇴근 완료");
      await loadToday(employee.employee_id);
    } catch (err) {
      console.error("퇴근 실패:", err);
      showToast(err?.message || "퇴근 처리 실패");
    } finally {
      setActionLoading(false);
    }
  };

  const stats = useMemo(() => {
    const approvedRecords = records.filter((r) => r.check_in && r.check_out && toBool(r.approved));

    return {
      totalMin: approvedRecords.reduce(
        (sum, r) => sum + calcWorkMinutes(r.check_in, r.check_out, r.break_min),
        0,
      ),
      late: approvedRecords.filter((r) => r.status === "지각").length,
      early: approvedRecords.filter((r) => r.status === "조퇴").length,
      overtime: approvedRecords.filter((r) => r.status === "연장").length,
    };
  }, [records]);

  if (!employee) {
    return (
      <PinScreen
        inputPin={inputPin}
        setInputPin={setInputPin}
        pinError={pinError}
        loading={loading}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <StaffHome
      employee={employee}
      toast={toast}
      todaySchedule={todaySchedule}
      todayAttendance={todayAttendance}
      workType={workType}
      setWorkType={setWorkType}
      isPending={isPending}
      isWorking={isWorking}
      isDone={isDone}
      isRejected={isRejected}
      actionLoading={actionLoading}
      records={records}
      stats={stats}
      onCheckIn={handleCheckIn}
      onCheckOut={handleCheckOut}
      onLogout={handleLogout}
    />
  );
}
