import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import useApi from "../shared/hooks/useApi";
import { Sidebar, MobileTabs } from "../shared/components/Nav";
import TodayTab from "../shared/components/TodayTab";
import AttTab from "../shared/components/AttTab";
import { ShiftTab } from "../shared/components/ShiftTab";
import { SimTab } from "../shared/components/SimTab";
import EmployeeTab from "../shared/components/EmployeeTab";
import { Toast } from "../shared/components/UI";
import { buildSettlement } from "../shared/utils/pay";
import { safeStr } from "../shared/utils";
import { SHIFT_TIME } from "../shared/constants";
import SettleTab from "../shared/components/SettleTab";
import { PayrollAdminPanel } from "../shared/components/PayrollAdminPanel";

// 1. 실제 파일 위치인 src/shared/components/ 경로를 정확히 반영한 상대 경로 수정
import AdminPinScreen from "../shared/components/Admin_PinScreen.jsx";
import QCTab from "../shared/components/QCTab"; 

function pad2(n) {
  return String(n).padStart(2, "0");
}

function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function addMonths(ym, offset) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function monthLabel(ym) {
  const [y, m] = ym.split("-");
  return `${y}년 ${Number(m)}월`;
}

function getWeekDates(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const mondayDiff = day === 0 ? -6 : 1 - day;

  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayDiff + offset * 7);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  });
}

const TABS_WITHOUT_MONTH_BAR = new Set(["today", "sim", "shift", "emp", "qc"]);

export default function App() {
  // 인증된 관리자 상태 관리 (sessionStorage로 브라우저 탭 닫기 전까지 로그인 유지)
  const [adminUser, setAdminUser] = useState(() => {
    const saved = sessionStorage.getItem("admin_session");
    return saved ? JSON.parse(saved) : null;
  });

  const [tab, setTab] = useState("today");
  const [toast, setToast] = useState(null);
  const [settlementOffset, setSettlementOffset] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(currentYM());
  const [weekOffset, setWeekOffset] = useState(0);

  const toastTimerRef = useRef(null);
  // 자동 로그아웃 타이머를 가리킬 Ref 추가
  const logoutTimerRef = useRef(null); 

  const showToast = useCallback((msg, type = "ok") => {
    setToast({ msg, type });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  // 로그아웃 처리 핸들러
  const handleLogout = useCallback(() => {
    setAdminUser(null);
    sessionStorage.removeItem("admin_session");
    if (logoutTimerRef.current) window.clearTimeout(logoutTimerRef.current);
    showToast("보안을 위해 자동 로그아웃되었습니다.", "err");
  }, [showToast]);

  // 인증 성공 콜백 핸들러 (role이 admin인 계정만 최종 승인)
  const handleLoginSuccess = (adminData) => {
    if (adminData?.role === "admin") {
      setAdminUser(adminData);
      sessionStorage.setItem("admin_session", JSON.stringify(adminData));
      showToast(`${adminData.name} 관리자님, 환영합니다!`, "ok");
    } else {
      showToast("관리자 권한이 없는 계정입니다.", "err");
    }
  };

  // 10분 이상 아무런 입력이나 움직임이 없을 때 작동하는 자동 로그아웃 타이머
  useEffect(() => {
    if (!adminUser) return;

    const resetTimer = () => {
      if (logoutTimerRef.current) window.clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = window.setTimeout(() => {
        handleLogout();
      }, 10 * 60 * 1000); 
    };

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, resetTimer));
    
    resetTimer();

    return () => {
      events.forEach((event) => window.removeEventListener(event, resetTimer));
      if (logoutTimerRef.current) window.clearTimeout(logoutTimerRef.current);
    };
  }, [adminUser, handleLogout]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const {
    loading,
    error,
    employees = [],
    schedule = [],
    monthAttendance = [],
    todayAttendance = [],
    todaySchedule = [],
    refreshAll,
    refreshAdminToday,
    approveAttendance,
    lockMonthlyPay,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    updateAttendance,
  } = useApi({
    month: selectedMonth,
  });

  
  useEffect(() => {
    if (error) showToast(error, "err");
  }, [error, showToast]);

  const settlementMonth = useMemo(
    () => addMonths(currentYM(), settlementOffset),
    [settlementOffset],
  );

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  const monthRange = useMemo(() => {
    const payrollMonth = addMonths(settlementMonth, 1);
    const [py, pm] = payrollMonth.split("-");
    return {
      month: settlementMonth,
      label: monthLabel(settlementMonth),
      workMonth: settlementMonth,
      payrollMonth,
      payDateLabel: `${py}.${pm}.10`,
    };
  }, [settlementMonth]);

  const settlement = useMemo(
    () =>
      buildSettlement({
        attendance: monthAttendance,
        employees,
        month: settlementMonth,
      }),
    [monthAttendance, employees, settlementMonth],
  );

  useEffect(() => {
    if (!adminUser) return;

    if (tab === "today") {
      refreshAdminToday().catch(() => {});
      return;
    }

    if (tab === "att") {
      refreshAll().catch(() => {});
      return;
    }

    if (tab === "sim") {
      if (selectedMonth !== settlementMonth) {
        setSelectedMonth(settlementMonth);
      }
      refreshAll().catch(() => {});
      return;
    }

    if (tab === "shift") {
      refreshAll().catch(() => {});
      return;
    }

    if (tab === "emp") {
      refreshAll().catch(() => {});
      return;
    }

    if (tab === "settle") {
      refreshAll().catch(() => {});
    }
  }, [tab, refreshAdminToday, refreshAll, settlementMonth, selectedMonth, adminUser]);

  useEffect(() => {
    if (!adminUser) return;
    
    if (tab === "att" || tab === "settle") {
      refreshAll().catch(() => {});
    }
  }, [selectedMonth, tab, refreshAll, adminUser]);

  const handleApprove = useCallback(
    async (row) => {
      await approveAttendance({
        attendance_id: row.attendance_id,
        approved: true,
        approved_by: adminUser?.name || "manager", 
        approval_note: "",
        date: row.date,
      });
      showToast("승인되었습니다");
    },
    [approveAttendance, showToast, adminUser],
  );

  const handleReject = useCallback(
    async (row) => {
      await approveAttendance({
        attendance_id: row.attendance_id,
        approved: false,
        approved_by: adminUser?.name || "manager",
        approval_note: "",
        date: row.date,
      });
      showToast("거절 처리되었습니다");
    },
    [approveAttendance, showToast, adminUser],
  );

  const handleRefresh = useCallback(() => {
    if (tab === "today") {
      refreshAdminToday();
      return;
    }
    refreshAll();
  }, [tab, refreshAdminToday, refreshAll]);

  const handleSaveCell = useCallback(
    async (cellEdit, employeeIds) => {
      // employeeIds is array of strings (may be empty)
      const shift = SHIFT_TIME[cellEdit.part] || {};

      const refetch = () => refreshAll();

      // If no employee IDs selected, delete all schedule entries for this cell (date, part)
      if (employeeIds.length === 0) {
        // Find all existing schedules for this date/part
        const existing = schedule.filter(
          s => s.date === cellEdit.date && s.part === cellEdit.part
        );
        // Delete each
        for (const sched of existing) {
          await deleteSchedule({
            schedule_id: sched.schedule_id,
            date: sched.date,
          }).catch(() => {}); // ignore individual errors
        }
        await refetch();
        return;
      }

      // 선택 해제된 기존 배정 삭제 (전체 삭제가 아닌 부분 변경 시)
      const toRemove = schedule.filter(
        (s) =>
          s.date === cellEdit.date &&
          s.part === cellEdit.part &&
          !employeeIds.some((id) => safeStr(id) === safeStr(s.employee_id))
      );
      for (const sched of toRemove) {
        await deleteSchedule({
          schedule_id: sched.schedule_id,
          date: sched.date,
        }).catch(() => {});
      }

      // For each employee ID, upsert schedule
      for (const empId of employeeIds) {
        const emp = employees.find((e) => safeStr(e.employee_id) === safeStr(empId));
        // Find existing schedule for this employee/date/part
        const existing = schedule.find(
          s =>
            s.date === cellEdit.date &&
            s.part === cellEdit.part &&
            safeStr(s.employee_id) === safeStr(empId)
        );

        const payload = {
          date: cellEdit.date,
          part: cellEdit.part,
          employee_id: empId,
          name: emp?.name || "",
          planned_start: shift.start || "",
          planned_end: shift.end || "",
          memo: cellEdit.memo || "",
        };

        if (existing) {
          // Update existing schedule
          await updateSchedule({
            schedule_id: existing.schedule_id,
            ...payload,
          })
            .then(refetch)
            .catch(() => {});
        } else {
          // Add new schedule
          await addSchedule(payload)
            .then(refetch)
            .catch(() => {});
        }
      }

      await refetch();
    },
    [employees, refreshAll, addSchedule, updateSchedule, deleteSchedule, schedule],
  );

  const renderTab = () => {
    if (tab === "today") {
      return (
        <TodayTab
          todaySchedule={todaySchedule}
          todayAttendance={todayAttendance}
          employees={employees}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      );
    }

    if (tab === "sim") {
      return (
        <SimTab
          settlement={settlement}
          monthRange={monthRange}
          settlementOffset={settlementOffset}
          setSettlementOffset={setSettlementOffset}
        />
      );
    }

    if (tab === "shift") {
      return (
        <ShiftTab
          weekDates={weekDates}
          weekOffset={weekOffset}
          setWeekOffset={setWeekOffset}
          schedule={schedule}
          employees={employees}
          onSaveCell={handleSaveCell}
          onToast={showToast}
        />
      );
    }

    if (tab === "emp") {
      return (
        <EmployeeTab
          employees={employees}
          addEmployee={addEmployee}
          updateEmployee={updateEmployee}
          deleteEmployee={deleteEmployee}
        />
      );
    }

    if (tab === "qc") {
      return (
        <QCTab
          monthAttendance={monthAttendance}
          approveAttendance={approveAttendance}
          selectedMonth={selectedMonth}
          currentManagerName={adminUser?.name || "manager"}
        />
      );
    }

    if (tab === "settle") {
      return (
        <SettleTab
          monthAttendance={monthAttendance}
          employees={employees}
          selectedMonth={selectedMonth}
          lockMonthlyPay={lockMonthlyPay}
          currentManagerName={adminUser?.name || "manager"}
        />
      );
    }

    return (
      <AttTab
        monthAttendance={monthAttendance}
        approveAttendance={approveAttendance}
        updateAttendance={updateAttendance}
        selectedMonth={selectedMonth}
        currentManagerName={adminUser?.name || "manager"}
      />
    );
  };

  // 관리자 인증 세션이 없을 경우 PIN 화면 반환
  if (!adminUser) {
    return <AdminPinScreen onSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="admin-app">
      <Sidebar tab={tab} setTab={setTab} loading={loading} onRefresh={handleRefresh} />

      <main className="main-content">
        <MobileTabs tab={tab} setTab={setTab} />

        {!TABS_WITHOUT_MONTH_BAR.has(tab) && (
          <div className="month-toolbar">
            <button
              type="button"
              className="ghost-sm"
              onClick={() => setSelectedMonth(addMonths(selectedMonth, -1))}
            >
              ◀
            </button>

            <strong>{monthLabel(selectedMonth)}</strong>

            <button
              type="button"
              className="ghost-sm"
              onClick={() => setSelectedMonth(currentYM())}
            >
              이번 달
            </button>

            <button
              type="button"
              className="ghost-sm"
              onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
            >
              ▶
            </button>
          </div>
        )}

        {renderTab()}
      </main>

      <Toast toast={toast} />
    </div>
  );
}