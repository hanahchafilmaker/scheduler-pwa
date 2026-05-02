import { useMemo, useState } from "react";
import { PARTS, SHIFT_TIME, PAGE_TITLE } from "./constants";
import { getDateString, getWeekDates, getMonthRange, normalizeDate, safeStr } from "./utils";
import { useApi } from "./hooks/useApi";
import { useToast } from "./hooks/useToast";
import { useMonthlySettlement } from "./hooks/useMonthlySettlement";
import { Sidebar, MobileTabs } from "./components/Nav";
import { Toast } from "./components/UI";
import { HomeTab } from "./components/HomeTab";
import { ShiftTab } from "./components/ShiftTab";
import { EmpTab } from "./components/EmpTab";
import { AttTab } from "./components/AttTab";
import { SimTab } from "./components/SimTab";
import "./styles.css";

export default function App() {
  const [tab,              setTab]              = useState("home");
  const [weekOffset,       setWeekOffset]       = useState(0);
  const [settlementOffset, setSettlementOffset] = useState(-1);

  const {
    loading, fetchAll, post,
    employees, schedule, attendance,
    approveAttendance, updateAttendance,
    addEmployee, updateEmployee, deleteEmployee,
    addSchedule, updateSchedule, deleteSchedule,
  } = useApi();

  const { toast, showToast } = useToast();

  const weekDates  = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const today      = getDateString(new Date());

  const monthRange = useMemo(() => {
    const base = new Date();
    base.setMonth(base.getMonth() + settlementOffset);
    return getMonthRange(base);
  }, [settlementOffset]);

  const settlement = useMonthlySettlement(attendance, employees, monthRange);

  const getEmp = (id) =>
    employees.find((e) => safeStr(e.employee_id) === safeStr(id));

  // -- Employee actions
  const handleSaveEmployee = (form, editingEmp) => {
    const payload = { ...form, hourly_wage: Number(form.hourly_wage) || 0 };
    if (editingEmp) {
      updateEmployee(editingEmp.employee_id, payload);
      showToast("직원 정보 수정 완료");
    } else {
      addEmployee(payload);
      showToast("직원 추가 완료");
    }
  };

  const handleDeleteEmployee = (emp) => {
    if (!confirm(`${emp.name}을(를) 삭제할까요?`)) return;
    deleteEmployee(emp.employee_id);
    showToast("삭제 완료");
  };

  // -- Schedule actions
  const handleSaveCell = (cellEdit, cellEmpId) => {
    const { date, part, scheduleId } = cellEdit;
    const emp = getEmp(cellEmpId);

    if (scheduleId) {
      if (!cellEmpId) {
        deleteSchedule(scheduleId);
      } else {
        updateSchedule(scheduleId, { employee_id: cellEmpId, name: emp?.name || "" });
      }
    } else if (cellEmpId) {
      const shift = SHIFT_TIME[part];
      addSchedule({ employee_id: cellEmpId, name: emp?.name || "", date, part, planned_start: shift.start, planned_end: shift.end });
    }
    showToast("저장 완료");
  };

  const handleAutoGenerate = async () => {
    const active = employees.filter((e) => e.active !== false && safeStr(e.employee_id));
    if (!active.length) { showToast("활성 직원이 없습니다", "err"); return; }
    if (!confirm("이번 주 근무를 자동 생성하고 저장할까요?")) return;

    const weeklyHours = Object.fromEntries(active.map((e) => [e.employee_id, 0]));
    const tasks = [];

    weekDates.forEach((date) => {
      PARTS.forEach((part) => {
        const shift = SHIFT_TIME[part];
        const emp = [...active].sort(
          (a, b) => (weeklyHours[a.employee_id] || 0) - (weeklyHours[b.employee_id] || 0)
        )[0];
        weeklyHours[emp.employee_id] = (weeklyHours[emp.employee_id] || 0) + shift.hours;
        const existing = schedule.find((s) => s.part === part && normalizeDate(s.date) === date);
        if (!existing) {
          tasks.push(post({ action: "add_schedule", employee_id: emp.employee_id, name: emp.name, date, part, planned_start: shift.start, planned_end: shift.end }));
        }
      });
    });

    showToast("자동 생성 완료");
    Promise.all(tasks).then(fetchAll);
  };

  // -- Attendance actions
  const handleApprove = (att) => {
    approveAttendance(att.attendance_id, true);
    showToast(`${att.name} 출근 승인 완료 ✅`);
  };

  const handleReject = (att) => {
    if (!confirm(`${att.name}의 출근 요청을 거절할까요?`)) return;
    approveAttendance(att.attendance_id, false);
    showToast(`${att.name} 출근 거절됨`, "err");
  };

  const handleSaveAtt = (attEdit) => {
    updateAttendance(attEdit);
    showToast("수정 완료");
  };

  return (
    <div className="admin-app">
      <Toast toast={toast} />
      <Sidebar tab={tab} setTab={setTab} loading={loading} onRefresh={fetchAll} />
      <MobileTabs tab={tab} setTab={setTab} />
      <main className="main-content">
        <div className="page-header">
          <h1>{PAGE_TITLE[tab]?.title}</h1>
          <p>{PAGE_TITLE[tab]?.sub}</p>
        </div>
        {loading && tab !== "home" && <div className="loading">데이터 로딩 중...</div>}
        {tab === "home"  && <HomeTab attendance={attendance} schedule={schedule} today={today} onApprove={handleApprove} onReject={handleReject} />}
        {tab === "shift" && <ShiftTab weekDates={weekDates} weekOffset={weekOffset} setWeekOffset={setWeekOffset} schedule={schedule} employees={employees} onSaveCell={handleSaveCell} onAutoGenerate={handleAutoGenerate} />}
        {tab === "emp"   && <EmpTab employees={employees} onSave={handleSaveEmployee} onDelete={handleDeleteEmployee} />}
        {tab === "att"   && <AttTab attendance={attendance} onSave={handleSaveAtt} />}
        {tab === "sim"   && <SimTab settlement={settlement} monthRange={monthRange} settlementOffset={settlementOffset} setSettlementOffset={setSettlementOffset} />}
      </main>
    </div>
  );
}
