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

const TABS_WITHOUT_MONTH_BAR = new Set(["today", "sim", "shift", "emp"]);

export default function App() {
  const [tab, setTab] = useState("today");
  const [toast, setToast] = useState(null);
  const [settlementOffset, setSettlementOffset] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(currentYM());
  const [weekOffset, setWeekOffset] = useState(0);

  const toastTimerRef = useRef(null);

  const showToast = useCallback((msg, type = "ok") => {
    setToast({ msg, type });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

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
  } = useApi({
    month: selectedMonth,
  });

  // ✅ FIX: AttTab에서 쓰는 updateAttendance alias 생성
  const updateAttendance = approveAttendance;

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
  }, [tab, refreshAdminToday, refreshAll, settlementMonth, selectedMonth]);

  useEffect(() => {
    if (tab === "att" || tab === "settle") {
      refreshAll().catch(() => {});
    }
  }, [selectedMonth, tab, refreshAll]);

  const handleApprove = useCallback(
    async (row) => {
      await approveAttendance({
        attendance_id: row.attendance_id,
        approved: true,
        approved_by: "manager",
        approval_note: "",
        date: row.date,
      });
      showToast("승인되었습니다");
    },
    [approveAttendance, showToast],
  );

  const handleReject = useCallback(
    async (row) => {
      await approveAttendance({
        attendance_id: row.attendance_id,
        approved: false,
        approved_by: "manager",
        approval_note: "",
        date: row.date,
      });
      showToast("거절 처리되었습니다");
    },
    [approveAttendance, showToast],
  );

  const handleRefresh = useCallback(() => {
    if (tab === "today") {
      refreshAdminToday();
      return;
    }
    refreshAll();
  }, [tab, refreshAdminToday, refreshAll]);

  const handleSaveCell = useCallback(
    (cellEdit, employeeId) => {
      const emp = employees.find((e) => safeStr(e.employee_id) === safeStr(employeeId));
      const shift = SHIFT_TIME[cellEdit.part] || {};

      const payload = {
        date: cellEdit.date,
        part: cellEdit.part,
        employee_id: employeeId || "",
        name: emp?.name || "",
        planned_start: shift.start || "",
        planned_end: shift.end || "",
        memo: cellEdit.memo || "",
      };

      const refetch = () => refreshAll();

      if (cellEdit.scheduleId) {
        if (!employeeId) {
          deleteSchedule({
            schedule_id: cellEdit.scheduleId,
            date: cellEdit.date,
          })
            .then(refetch)
            .catch(() => {});
          return;
        }

        updateSchedule({
          schedule_id: cellEdit.scheduleId,
          ...payload,
        })
          .then(refetch)
          .catch(() => {});
        return;
      }

      if (!employeeId) return;

      addSchedule(payload)
        .then(refetch)
        .catch(() => {});
    },
    [employees, refreshAll, addSchedule, updateSchedule, deleteSchedule],
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

    if (tab === "settle") {
      return (
        <SettleTab
          monthAttendance={monthAttendance}
          employees={employees}
          selectedMonth={selectedMonth}
          lockMonthlyPay={lockMonthlyPay}
          currentManagerName="manager"
        />
      );
    }

    return (
      <AttTab
        monthAttendance={monthAttendance}
        approveAttendance={approveAttendance}
        updateAttendance={updateAttendance}
        selectedMonth={selectedMonth}
        currentManagerName="manager"
      />
    );
  };

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