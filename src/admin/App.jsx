import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useApi } from "../shared/hooks/useApi";
import { Sidebar, MobileTabs } from "../shared/components/Nav";
import { TodayTab } from "../shared/components/TodayTab";
import { AttTab } from "../shared/components/AttTab";
import { ShiftTab } from "../shared/components/ShiftTab";
import { SimTab } from "../shared/components/SimTab";
import { Toast } from "../shared/components/UI";
import { normalizeDate, safeStr, calcWorkMinutes, calcNightMinutesSimple } from "../shared/utils";

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

// 정산: approved=true 기록만 반영
function buildSettlement({ attendance = [], employees = [], month }) {
  const empMap = new Map(employees.map((e) => [safeStr(e.employee_id), e]));
  const rowsMap = new Map();

  const doneRows = attendance.filter((a) => {
    const d = normalizeDate(a.date);
    return (
      d.startsWith(month) &&
      a.check_in &&
      a.check_out &&
      (a.approved === true || String(a.approved).toLowerCase() === "true")
    );
  });

  doneRows.forEach((a) => {
    const empId = safeStr(a.employee_id);
    const emp = empMap.get(empId) || {};
    const wage = Number(emp.hourly_wage || a.hourly_wage || 0);
    const workMin = calcWorkMinutes(a.check_in, a.check_out, a.break_min);
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

// 월간 toolbar를 숨길 탭
const TABS_WITHOUT_MONTH_BAR = new Set(["today", "sim", "shift"]);

export default function App() {
  const [tab, setTab] = useState("today");
  const [toast, setToast] = useState(null);
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
    onError: useCallback((msg) => showToast(msg || "오류가 발생했습니다.", "err"), [showToast]),
  });

  const {
    loading,
    employees = [],
    schedule = [],
    attendance = [],
    todayAttendance = [],
    monthAttendance: apiMonthAttendance,
    fetchAll,
    fetchMonth,
    fetchToday,
    approveAttendance,
    updateAttendance,
  } = api;

  const monthAttendance = apiMonthAttendance || attendance || [];

  const settlementMonth = useMemo(
    () => addMonths(currentYM(), settlementOffset),
    [settlementOffset],
  );

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

  const fetchRef = useRef({ fetchAll, fetchMonth });

  useEffect(() => {
    fetchRef.current = { fetchAll, fetchMonth };
  }, [fetchAll, fetchMonth]);

  useEffect(() => {
    if (tab === "att") {
      fetchRef.current.fetchAll(selectedMonth);
    } else if (tab === "sim") {
      fetchRef.current.fetchMonth(settlementMonth);
      setSelectedMonth(settlementMonth);
    } else if (tab === "today") {
      fetchToday();
    }
  }, [tab, fetchToday, selectedMonth, settlementMonth]);

  useEffect(() => {
    if (tab === "att") {
      fetchRef.current.fetchAll(selectedMonth);
    }
  }, [selectedMonth, tab]);

  const handleApprove = useCallback(
    (att, approved) => {
      approveAttendance(att, approved, () => fetchAll(selectedMonth));
    },
    [selectedMonth, fetchAll, approveAttendance],
  );

  const handleAutoCheckout = useCallback(
    (att) => {
      const n = new Date();
      const hh = String(n.getHours()).padStart(2, "0");
      const mm = String(n.getMinutes()).padStart(2, "0");

      updateAttendance({ ...att, check_out: `${hh}:${mm}` }, () => fetchToday());
    },
    [updateAttendance, fetchToday],
  );

  const handleRefresh = useCallback(() => {
    if (tab === "today") {
      fetchToday();
      return;
    }

    if (tab === "sim") {
      fetchMonth(settlementMonth);
      return;
    }

    if (tab === "att") {
      fetchAll(selectedMonth);
      return;
    }
  }, [tab, fetchToday, fetchMonth, fetchAll, settlementMonth, selectedMonth]);

  const renderTab = () => {
    if (tab === "today") {
      return (
        <TodayTab
          todayAttendance={todayAttendance}
          schedule={schedule}
          employees={employees}
          onApprove={handleApprove}
          onAutoCheckout={handleAutoCheckout}
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
      return <ShiftTab schedule={schedule} employees={employees} selectedMonth={selectedMonth} />;
    }

    return <AttTab attendance={monthAttendance} onApprove={handleApprove} />;
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
