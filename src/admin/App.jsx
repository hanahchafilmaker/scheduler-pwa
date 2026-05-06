import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useApi } from "../shared/hooks/useApi";

import { Sidebar, MobileTabs } from "../shared/components/Nav";
import { HomeTab } from "../shared/components/HomeTab";
import { ShiftTab } from "../shared/components/ShiftTab";
import { EmpTab } from "../shared/components/EmpTab";
import { AttTab } from "../shared/components/AttTab";
import { SimTab } from "../shared/components/SimTab";
import { Toast } from "../shared/components/UI";

import { SHIFT_TIME } from "../shared/constants";
// FIX: admin/App.jsx에 중복 정의되어 있던 toMin, calcNightMinutes를
//      shared/utils에서 import하도록 변경
import { normalizeDate, safeStr, calcWorkMinutes, calcNightMinutesSimple } from "../shared/utils";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
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

function buildSettlement({ attendance = [], employees = [], month }) {
  const empMap = new Map(
    employees.map((e) => [safeStr(e.employee_id), e])
  );

  const rowsMap = new Map();

  const doneRows = attendance.filter((a) => {
    const d = normalizeDate(a.date);
    return (
      d.startsWith(month) &&
      a.check_in &&
      a.check_out &&
      // FIX: toBool 방식으로 통일 (GAS가 true/false/boolean 혼재 반환)
      (a.approved === true || String(a.approved).toLowerCase() === "true")
    );
  });

  doneRows.forEach((a) => {
    const empId = safeStr(a.employee_id);
    const emp = empMap.get(empId) || {};

    const wage = Number(emp.hourly_wage || a.hourly_wage || 0);
    const workMin = calcWorkMinutes(a.check_in, a.check_out, a.break_min);
    // FIX: 중복 정의 제거 → shared/utils의 calcNightMinutesSimple 사용
    const nightMin = calcNightMinutesSimple(a.check_in, a.check_out);

    const basePay = Math.round((workMin / 60) * wage);
    const nightPay = Math.round((nightMin / 60) * wage * 0.5);
    const pay = basePay + nightPay;

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
      date: normalizeDate(a.date),
      check_in: a.check_in,
      check_out: a.check_out,
      workMin,
      nightMin,
      pay,
    });
  });

  const rows = [...rowsMap.values()].map((r) => ({
    ...r,
    days: r.days.sort((a, b) => a.date.localeCompare(b.date)),
  }));

  return {
    rows,
    totalPay: rows.reduce((sum, r) => sum + r.amount, 0),
    totalHours: rows.reduce((sum, r) => sum + r.hours, 0),
    totalWorkDays: rows.reduce((sum, r) => sum + r.workDays, 0),
  };
}

export default function App() {
  const [tab, setTab] = useState("home");
  const [toast, setToast] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [settlementOffset, setSettlementOffset] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(currentYM());

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

  const api = useApi({
    onError: useCallback(
      (msg) => showToast(msg || "오류가 발생했습니다", "err"),
      [showToast]
    ),
  });

  const {
    loading,
    employees = [],
    schedule = [],
    attendance = [],
    monthAttendance: apiMonthAttendance,
    todayAttendance: apiTodayAttendance,
    fetchToday,
    fetchAll,
    fetchMonth,
    approveAttendance,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    addSchedule,
    updateSchedule,
    deleteSchedule,
  } = api;

  const monthAttendance = apiMonthAttendance || attendance || [];
  const todayAttendance = apiTodayAttendance || attendance || [];

  const today = todayStr();
  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  const settlementMonth = useMemo(
    () => addMonths(currentYM(), settlementOffset),
    [settlementOffset]
  );

  const monthRange = useMemo(
    () => ({ month: settlementMonth, label: monthLabel(settlementMonth) }),
    [settlementMonth]
  );

  const settlement = useMemo(
    () =>
      buildSettlement({
        attendance: monthAttendance,
        employees,
        month: settlementMonth,
      }),
    [monthAttendance, employees, settlementMonth]
  );

  const fetchRef = useRef({ fetchToday, fetchAll, fetchMonth });
  useEffect(() => {
    fetchRef.current = { fetchToday, fetchAll, fetchMonth };
  });

  useEffect(() => {
    const { fetchToday, fetchAll, fetchMonth } = fetchRef.current;

    if (tab === "home") {
      fetchToday();
      return;
    }
    if (tab === "sim") {
      fetchMonth(settlementMonth);
      setSelectedMonth(settlementMonth);
      return;
    }
    fetchAll(selectedMonth);
  }, [tab, selectedMonth, settlementMonth]);

  const handleRefresh = useCallback(() => {
    const { fetchToday, fetchAll, fetchMonth } = fetchRef.current;
    if (tab === "home") { fetchToday(); return; }
    if (tab === "sim") { fetchMonth(settlementMonth); return; }
    fetchAll(selectedMonth);
  }, [tab, selectedMonth, settlementMonth]);

  const handleApprove = useCallback(
    (att, approved) => {
      const refetch = tab === "home" ? fetchToday : () => fetchAll(selectedMonth);
      return approveAttendance(att, approved, refetch);
    },
    [tab, selectedMonth, fetchToday, fetchAll, approveAttendance]
  );

  const handleSaveEmployee = useCallback(
    async (form, editingEmp) => {
      const refetch = () => fetchAll(selectedMonth);
      if (editingEmp?.employee_id) {
        await updateEmployee(editingEmp.employee_id, form, refetch);
        showToast("직원 정보가 수정되었습니다");
        return;
      }
      await addEmployee(form, refetch);
      showToast("직원이 추가되었습니다");
    },
    [selectedMonth, fetchAll, addEmployee, updateEmployee, showToast]
  );

  const handleDeleteEmployee = useCallback(
    async (emp) => {
      const ok = window.confirm(`${emp.name} 직원을 삭제할까요?`);
      if (!ok) return;
      await deleteEmployee(emp.employee_id, () => fetchAll(selectedMonth));
      showToast("직원이 삭제되었습니다");
    },
    [selectedMonth, fetchAll, deleteEmployee, showToast]
  );

  const handleSaveScheduleCell = useCallback(
    async (cellEdit, employeeId) => {
      const emp = employees.find(
        (e) => safeStr(e.employee_id) === safeStr(employeeId)
      );
      const shift = SHIFT_TIME[cellEdit.part] || {};
      const payload = {
        date: cellEdit.date,
        part: cellEdit.part,
        employee_id: employeeId || "",
        name: emp?.name || "",
        planned_start: shift.start || "",
        planned_end: shift.end || "",
      };
      const refetch = () => fetchAll(selectedMonth);

      if (cellEdit.scheduleId) {
        if (!employeeId) {
          await deleteSchedule(cellEdit.scheduleId, cellEdit.date, refetch);
          showToast("근무 배정이 삭제되었습니다");
          return;
        }
        await updateSchedule(cellEdit.scheduleId, payload, refetch);
        showToast("근무표가 수정되었습니다");
        return;
      }
      if (!employeeId) return;
      await addSchedule(payload, refetch);
      showToast("근무가 배정되었습니다");
    },
    [employees, selectedMonth, fetchAll, addSchedule, updateSchedule, deleteSchedule, showToast]
  );

  const renderTab = () => {
    if (tab === "home") {
      return (
        <HomeTab
          attendance={todayAttendance}
          schedule={schedule}
          today={today}
          onApprove={(att) => handleApprove(att, true)}
          onReject={(att) => handleApprove(att, false)}
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
          onSaveCell={handleSaveScheduleCell}
        />
      );
    }
    if (tab === "emp") {
      return (
        <EmpTab
          employees={employees}
          onSave={handleSaveEmployee}
          onDelete={handleDeleteEmployee}
        />
      );
    }
    if (tab === "att") {
      return (
        <AttTab
          attendance={monthAttendance}
          onApprove={handleApprove}
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
    return (
      <HomeTab
        attendance={todayAttendance}
        schedule={schedule}
        today={today}
        onApprove={(att) => handleApprove(att, true)}
        onReject={(att) => handleApprove(att, false)}
      />
    );
  };

  return (
    <div className="admin-app">
      <Sidebar
        tab={tab}
        setTab={setTab}
        loading={loading}
        onRefresh={handleRefresh}
      />

      <main className="main-content">
        <MobileTabs tab={tab} setTab={setTab} />

        {tab !== "home" && tab !== "sim" && (
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
