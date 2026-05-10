import { useEffect, useMemo, useState } from "react";
import useApi from "../shared/hooks/useApi";
import PinScreen from "./components/PinScreen";
import StaffHome from "./components/StaffHome";
import "./staff.css";

function Toast({ message }) {
  if (!message) return null;
  return <div className="staff-toast">{message}</div>;
}

export default function StaffApp() {
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [inputPin, setInputPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [toast, setToast] = useState("");

  const employeeId = currentEmployee?.employee_id || "";

  const {
    employees,
    todaySchedule,
    todayAttendance,
    loading,
    todayLoading,
    error,
    refreshAll,
    refreshStaffToday,
    checkIn,
    checkOut,
  } = useApi({
    employeeId,
  });

  useEffect(() => {
    refreshAll().catch(() => {});
  }, [refreshAll]);

  useEffect(() => {
    if (!employeeId) return;
    refreshStaffToday().catch(() => {});
  }, [employeeId, refreshStaffToday]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const mergedError = pinError || error || "";

  const currentEmployeeFull = useMemo(() => {
    if (!employeeId) return null;
    return (
      employees.find((emp) => String(emp.employee_id) === String(employeeId)) || currentEmployee
    );
  }, [employees, employeeId, currentEmployee]);

  const handleLogin = () => {
    setPinError("");

    const normalizedPin = String(inputPin || "").trim();

    if (!normalizedPin) {
      setPinError("PIN을 입력해주세요.");
      return;
    }

    if (!Array.isArray(employees) || employees.length === 0) {
      setPinError("직원 데이터를 아직 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    const found = employees.find(
      (emp) => String(emp.pin || "").trim() === normalizedPin && emp.active !== false,
    );

    if (!found) {
      setPinError("PIN이 올바르지 않습니다.");
      setInputPin("");
      return;
    }

    setCurrentEmployee(found);
    setInputPin("");
    setToast(`${found.name}님 반가워요`);
  };

  const handleLogout = () => {
    setCurrentEmployee(null);
    setInputPin("");
    setPinError("");
    setToast("로그아웃되었습니다");
  };

  const handleCheckIn = async (payload) => {
    try {
      setPinError("");

      await checkIn({
        employee_id: currentEmployeeFull?.employee_id,
        name: currentEmployeeFull?.name,
        part: payload?.part || "",
      });

      // 출근 요청이 정상 접수되면
      // 승인 완료 / 승인 대기 여부와 관계없이 바로 로그아웃
      handleLogout();
    } catch (err) {
      setPinError(err.message || "출근 처리에 실패했습니다.");
    }
  };

  const handleCheckOut = async (payload) => {
    try {
      setPinError("");

      await checkOut({
        employee_id: currentEmployeeFull?.employee_id,
        attendance_id: payload?.attendance_id,
        date: payload?.date,
      });

      setToast("퇴근 처리되었습니다");
    } catch (err) {
      setPinError(err.message || "퇴근 처리에 실패했습니다.");
    }
  };

  if (!currentEmployeeFull) {
    return (
      <div className="staff-root">
        <PinScreen
          inputPin={inputPin}
          setInputPin={setInputPin}
          pinError={mergedError}
          loading={loading}
          onLogin={handleLogin}
        />
        <Toast message={toast} />
      </div>
    );
  }

  return (
    <div className="staff-root">
      <header className="staff-header">
        <div>
          <div className="staff-brand">SHIFT</div>
          <h1>{currentEmployeeFull.name}님</h1>
          <p>
            {todayLoading || loading
              ? "데이터를 불러오는 중입니다."
              : "오늘 근무 상태를 확인하세요."}
          </p>
        </div>

        <button type="button" className="logout-btn" onClick={handleLogout}>
          로그아웃
        </button>
      </header>

      <main className="staff-page">
        {mergedError ? <div className="staff-error">{mergedError}</div> : null}

        <StaffHome
          employee={currentEmployeeFull}
          todaySchedule={Array.isArray(todaySchedule) ? todaySchedule : []}
          todayAttendance={Array.isArray(todayAttendance) ? todayAttendance : []}
          onCheckIn={handleCheckIn}
          onCheckOut={handleCheckOut}
          checking={loading || todayLoading}
        />
      </main>

      <Toast message={toast} />
    </div>
  );
}
