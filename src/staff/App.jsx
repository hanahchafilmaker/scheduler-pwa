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
      setPinError("PIN .");
      return;
    }

    if (!Array.isArray(employees) || employees.length === 0) {
      setPinError("    .    .");
      return;
    }

    const found = employees.find(
      (emp) => String(emp.pin || "").trim() === normalizedPin && emp.active !== false,
    );

    if (!found) {
      setPinError("PIN  .");
      setInputPin("");
      return;
    }

    setCurrentEmployee(found);
    setInputPin("");
    setToast(`${found.name} `);
  };

  const handleLogout = () => {
    setCurrentEmployee(null);
    setInputPin("");
    setPinError("");
    setToast("");
  };

  const handleCheckIn = async (payload) => {
    try {
      setPinError("");

      await checkIn({
        employee_id: payload?.employee_id || currentEmployeeFull?.employee_id,
        name: payload?.name || currentEmployeeFull?.name || "",
        part: payload?.part || "unscheduled",
        is_substitute: Boolean(payload?.is_substitute),
        approval_required: Boolean(payload?.approval_required),
        check_in: payload?.check_in || "",
        break_min: Number(payload?.break_min || 0),
        date: payload?.date || "",
      });

      handleLogout();
    } catch (err) {
      setPinError(err?.message || "  .");
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

      setToast(" ");
    } catch (err) {
      setPinError(err?.message || "  .");
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
          <h1>{currentEmployeeFull.name}</h1>
          <p>
            {todayLoading || loading
              ? "  ."
              : "   ."}
          </p>
        </div>

        <button type="button" className="logout-btn" onClick={handleLogout}>
          
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

