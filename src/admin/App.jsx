import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import useApi from "../shared/hooks/useApi";
import { Sidebar, MobileTabs } from "../shared/components/Nav";
import TodayTab from "../shared/components/TodayTab";
import AttTab from "../shared/components/AttTab";
import { ShiftTab } from "../shared/components/ShiftTab";
import { SimTab } from "../shared/components/SimTab";
import { Toast } from "../shared/components/UI";
import {
  calcMonthSummary,
  calcNightMinutesSimple,
  calcRowPay,
  calcWorkMinutes,
} from "../shared/utils/pay";
import { safeStr } from "../shared/utils";
import { SHIFT_TIME } from "../shared/constants";

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

// 새 정산 기준:
// - approval_status === "pending" 제외
// - paid_check_in / paid_check_out 기준
function buildSettlement({ attendance = [], employees = [], month }) {
  const empMap = new Map(employees.map((e) => [safeStr(e.employee_id), e]));
  const rowsMap = new Map();

  const doneRows = attendance.filter((a) => {
    const d = String(a.date || "");
    return (
      d.startsWith(month) && a.paid_check_in && a.paid_check_out && a.approval_status !== "pending"
    );
  });

  doneRows.forEach((a) => {
    const empId = safeStr(a.employee_id);
    const emp = empMap.get(empId) || {};
    const wage = Number(emp.hourly_wage || a.hourly_wage || 0);

    const workMin = calcWorkMinutes(a.paid_check_in, a.paid_check_out, a.break_min);
    const nightMin = calcNightMinutesSimple(a.paid_check_in, a.paid_check_out);
    const pay = calcRowPay(a, wage);

    if (!rowsMap.has(empId)) {
      rowsMap.set(empId, {
        employee_id: empId,
        name: a.name || emp.name || "-",
        wage,
        hours: 0,
        nightHours: 0,
        amount: 0,
        workDays: 0,
        days: [],
      });
    }

    const row = rowsMap.get(empId);
    row.hours += workMin / 60;
    row.nightHours += nightMin / 60;
    row.amount += pay;
    row.workDays += 1;
    row.days.push({
      date: a.date,
      check_in: a.check_in,
      check_out: a.check_out,
      paid_check_in: a.paid_check_in,
      paid_check_out: a.paid_check_out,
      workMin,
      nightMin,
      pay,
      approval_status: a.approval_status,
      approval_reason: a.approval_reason,
    });
  });

  const rows = [...rowsMap.values()].map((r) => ({
    ...r,
    days: r.days.sort((a, b) => String(a.date).localeCompare(String(b.date))),
  }));

  const summary = calcMonthSummary(doneRows, Object.fromEntries(empMap));

  return {
    rows,
    totalPay: rows.reduce((sum, r) => sum + r.amount, 0),
    totalHours: rows.reduce((sum, r) => sum + r.hours, 0),
    totalWorkDays: rows.reduce((sum, r) => sum + r.workDays, 0),
    summary,
  };
}

const TABS_WITHOUT_MONTH_BAR = new Set(["today", "sim", "shift"]);

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
    addSchedule,
    updateSchedule,
    deleteSchedule,
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
    }
  }, [tab, refreshAdminToday, refreshAll, settlementMonth, selectedMonth]);

  useEffect(() => {
    if (tab === "att") {
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
        />
      );
    }

    return (
      <AttTab
        monthAttendance={monthAttendance}
        approveAttendance={approveAttendance}
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
