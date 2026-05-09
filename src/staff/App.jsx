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
  const [todayLoading, setTodayLoading] = useState(false); // ✅ 추가
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

        // localStorage 캐시 확인 (10분 유효)
        const cached = localStorage.getItem("staff_employees_cache");
        if (cached) {
          try {
            const { data, ts } = JSON.parse(cached);
            if (Date.now() - ts < 10 * 60 * 1000 && Array.isArray(data) && data.length > 0) {
              if (mounted) {
                setEmployees(data);
                setLoading(false);
              }
              return;
            }
          } catch {}
        }

        const data = await fetchStaffEmployees();

        if (!mounted) return;

        setEmployees(Array.isArray(data) ? data : []);

        if (!Array.isArray(data) || data.length === 0) {
          setPinError("직원 데이터를 불러오지 못했습니다. 시트 employees를 확인해주세요.");
        } else {
          // 성공 시 캐시 저장
          localStorage.setItem("staff_employees_cache", JSON.stringify({ data, ts: Date.now() }));
        }
      } catch (err) {
        console.error("직원 데이터 fetch 실패:", err);

        // 실패 시 캐시라도 사용
        const cached = localStorage.getItem("staff_employees_cache");
        if (cached && mounted) {
          try {
            const { data } = JSON.parse(cached);
            if (Array.isArray(data) && data.length > 0) {
              setEmployees(data);
              return;
            }
          } catch {}
        }

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

      setTodayLoading(true); // ✅ 로딩 시작
      try {
        const data = await fetchStaffToday(empId);

        setTodayData({
          schedule: Array.isArray(data?.schedule) ? data.schedule : [],
          attendance: Array.isArray(data?.attendance) ? data.attendance : [],
        });
      } catch (err) {
        console.error("오늘 데이터 fetch 실패:", err);
        showToast("오늘 데이터를 불러오지 못했습니다.");
      } finally {
        setTodayLoading(false); // ✅ 로딩 끝
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
        console.error("이달 기록 fetch 실패:", err);
        showToast("이달 기록을 불러오지 못했습니다.");
      }
    },
    [showToast],
  );

  // ✅ 로그인 시 오늘 데이터 + 이달 기록을 병렬로 fetch
  const loadTodayAndMonth = useCallback(
    async (empId) => {
      if (!empId) return;
      await Promise.all([loadToday(empId), loadMonth(empId)]);
    },
    [loadToday, loadMonth],
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

    // ✅ 홈 화면 즉시 표시 후 오늘 데이터 + 이달 기록 병렬 로딩
    loadTodayAndMonth(found.employee_id);
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

    const myTodayAttendances = todayData.attendance
      .filter(
        (a) =>
          normalizeDate(a.date) === today &&
          safeStr(a.employee_id) === safeStr(employee.employee_id),
      )
      .sort((a, b) => {
        const ta = String(a.check_in || "00:00");
        const tb = String(b.check_in || "00:00");
        return tb.localeCompare(ta);
      });

    const active = myTodayAttendances.find((a) => a.check_in && !a.check_out);

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

  const isWorking = hasOpenAttendance && !isRejected;

  const isDone = !!todayAttendance?.check_in && !!todayAttendance?.check_out && isApproved;

  // ✅ 출근: 낙관적 업데이트 적용
  const handleCheckIn = async () => {
    if (!employee) return;

    if (!workType) {
      showToast("근무 타입을 선택해주세요");
      return;
    }

    const checkInTime = nowTime();

    // 즉시 화면 업데이트
    const tempAttendance = {
      attendance_id: "TEMP_" + Date.now(),
      employee_id: employee.employee_id,
      date: today,
      part: workType,
      check_in: checkInTime,
      check_out: null,
      approved: false,
    };
    setTodayData((prev) => ({
      ...prev,
      attendance: [...prev.attendance, tempAttendance],
    }));

    setActionLoading(true);
    try {
      await checkInStaff({
        employee,
        workType,
        date: today,
        checkIn: checkInTime,
      });
      showToast("출근 완료");
      // 백그라운드에서 오늘 + 이달 기록 병렬 갱신
      await Promise.all([loadToday(employee.employee_id), loadMonth(employee.employee_id)]);
    } catch (err) {
      // 실패하면 롤백
      setTodayData((prev) => ({
        ...prev,
        attendance: prev.attendance.filter((a) => a.attendance_id !== tempAttendance.attendance_id),
      }));
      console.error("출근 실패:", err);
      showToast(err?.message || "출근 처리 실패");
    } finally {
      setActionLoading(false);
    }
  };

  // ✅ 퇴근: 낙관적 업데이트 적용
  const handleCheckOut = async () => {
    if (!employee) return;

    if (!todayAttendance?.attendance_id) {
      showToast("출근 기록이 없습니다");
      return;
    }

    const checkOutTime = nowTime();

    // 즉시 화면 업데이트
    setTodayData((prev) => ({
      ...prev,
      attendance: prev.attendance.map((a) =>
        a.attendance_id === todayAttendance.attendance_id ? { ...a, check_out: checkOutTime } : a,
      ),
    }));

    setActionLoading(true);
    try {
      await checkOutStaff({
        attendanceId: todayAttendance.attendance_id,
        checkOut: checkOutTime,
      });
      showToast("퇴근 완료");
      // 백그라운드에서 오늘 + 이달 기록 병렬 갱신
      await Promise.all([loadToday(employee.employee_id), loadMonth(employee.employee_id)]);
    } catch (err) {
      // 실패하면 롤백
      setTodayData((prev) => ({
        ...prev,
        attendance: prev.attendance.map((a) =>
          a.attendance_id === todayAttendance.attendance_id ? { ...a, check_out: null } : a,
        ),
      }));
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
      overtime: approvedRecords.filter((r) => r.status === "초과").length,
    };
  }, [records]);

  // 로그인 시 이미 월별 기록을 선 fetch하므로 대부분 즉시 표시됨
  const handleViewRecords = useCallback(() => {
    if (records.length === 0 && employee) {
      loadMonth(employee.employee_id);
    }
  }, [records.length, employee, loadMonth]);

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
      todayLoading={todayLoading}
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
      onViewRecords={handleViewRecords}
    />
  );
}
