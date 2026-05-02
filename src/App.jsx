import { useEffect, useMemo, useState } from "react";

const API_URL =
  "https://script.google.com/macros/s/AKfycbx_PbHZoF02fNHIp-Ek4nVLO-GxUW1LxFRDEpMtFiLRRJg2_6RQ7zo0F1WuCyImp_KXnA/exec";

const PARTS = ["open", "middle", "close"];
const PART_LABEL = {
  open: "오픈",
  middle: "미들",
  close: "마감",
  extra: "대타",
  대타: "대타",
};

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

const SHIFT_TIME = {
  open: { start: "07:00", end: "13:00", hours: 6 },
  middle: { start: "13:00", end: "18:00", hours: 5 },
  close: { start: "18:00", end: "23:00", hours: 5 },
};

function getDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeDate(v) {
  if (!v) return "";
  return getDateString(new Date(v));
}

function safeStr(v) {
  return String(v || "").trim();
}

function toMin(t) {
  const m = String(t || "").match(/(\d+):(\d+)/);
  if (!m) return 0;
  return Number(m[1] || 0) * 60 + Number(m[2] || 0);
}

function formatTime(t) {
  if (!t) return "--";
  const m = String(t).match(/(\d+):(\d+)/);
  return m ? `${m[1].padStart(2, "0")}:${m[2].padStart(2, "0")}` : t;
}

function fmtKRW(n) {
  const safe = Number.isFinite(Number(n)) ? Math.round(Number(n)) : 0;
  return safe.toLocaleString("ko-KR") + "원";
}

function getWeekDates(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return getDateString(d);
  });
}

function getMonthRange(base = new Date()) {
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return {
    start: getDateString(start),
    end: getDateString(end),
    label: `${base.getFullYear()}년 ${base.getMonth() + 1}월`,
  };
}

function calcWorkMinutes(checkIn, checkOut, breakMin = 0) {
  const start = toMin(checkIn);
  let end = toMin(checkOut);

  if (!checkIn || !checkOut) return 0;
  if (end < start) end += 24 * 60;

  const raw = Math.max(0, end - start);
  const br = Math.max(0, Number(breakMin) || 0);
  return Math.max(0, raw - br);
}

function calcNightMinutes(checkIn, checkOut, breakMin = 0) {
  const start = toMin(checkIn);
  let end = toMin(checkOut);

  if (!checkIn || !checkOut) return 0;
  if (end < start) end += 24 * 60;

  const nightStart = 22 * 60;
  const nightEnd = 30 * 60;

  const overlap = Math.max(0, Math.min(end, nightEnd) - Math.max(start, nightStart));
  const total = Math.max(1, end - start);
  const br = Math.max(0, Number(breakMin) || 0);
  const adjusted = Math.max(0, overlap - br * (overlap / total));

  return adjusted;
}

export default function AdminApp() {
  const [tab, setTab] = useState("home");
  const [employees, setEmployees] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  const [weekOffset, setWeekOffset] = useState(0);

  const [empForm, setEmpForm] = useState({
    name: "",
    phone: "",
    hourly_wage: "",
    pin: "",
    active: true,
  });
  const [editingEmp, setEditingEmp] = useState(null);
  const [empSaving, setEmpSaving] = useState(false);

  const [cellEdit, setCellEdit] = useState(null);
  const [cellEmpId, setCellEmpId] = useState("");
  const [cellSaving, setCellSaving] = useState(false);

  const [attEdit, setAttEdit] = useState(null);
  const [toast, setToast] = useState(null);

  // 정산 월 선택: 기본값은 전월 (4월 근무 → 5월에 전월 정산)
  const [settlementOffset, setSettlementOffset] = useState(-1);
  const [expandedEmp, setExpandedEmp] = useState(null); // 임금명세서 펼친 직원 id
  const [payslipEmp, setPayslipEmp] = useState(null);   // 인쇄용 명세서

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const today = getDateString(new Date());
  const monthRange = useMemo(() => {
    const base = new Date();
    base.setMonth(base.getMonth() + settlementOffset);
    return getMonthRange(base);
  }, [settlementOffset]);

  useEffect(() => {
    fetchAll();
  }, []);

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=all`);
      const json = await res.json();
      setEmployees(json.employees || []);
      setSchedule(json.schedule || []);
      setAttendance(json.attendance || []);
    } finally {
      setLoading(false);
    }
  };

  const post = async (body) => {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const getEmp = (employeeId) => {
    return employees.find((e) => safeStr(e.employee_id) === safeStr(employeeId));
  };

  const saveEmployee = async () => {
    if (!empForm.name.trim()) {
      showToast("이름을 입력하세요", "err");
      return;
    }

    setEmpSaving(true);
    try {
      const payload = {
        ...empForm,
        hourly_wage: Number(empForm.hourly_wage) || 0,
      };

      if (editingEmp) {
        await post({
          action: "update_employee",
          employee_id: editingEmp.employee_id,
          ...payload,
        });
        showToast("직원 정보 수정 완료");
      } else {
        await post({
          action: "add_employee",
          ...payload,
        });
        showToast("직원 추가 완료");
      }

      setEmpForm({
        name: "",
        phone: "",
        hourly_wage: "",
        pin: "",
        active: true,
      });
      setEditingEmp(null);
      fetchAll();
    } finally {
      setEmpSaving(false);
    }
  };

  const deleteEmployee = async (emp) => {
    if (!confirm(`${emp.name}을(를) 삭제할까요?`)) return;
    await post({ action: "delete_employee", employee_id: emp.employee_id });
    showToast("삭제 완료");
    fetchAll();
  };

  const startEditEmp = (emp) => {
    setEditingEmp(emp);
    setEmpForm({
      name: emp.name || "",
      phone: emp.phone || "",
      hourly_wage: emp.hourly_wage || "",
      pin: emp.pin || "",
      active: emp.active !== false,
    });
  };

  const openCell = (date, part) => {
    const s = schedule.find((x) => x.part === part && normalizeDate(x.date) === date);
    setCellEmpId(safeStr(s?.employee_id));
    setCellEdit({ date, part, scheduleId: s?.schedule_id });
  };

  const saveCell = async () => {
    if (!cellEdit) return;

    setCellSaving(true);
    const { date, part, scheduleId } = cellEdit;
    const emp = employees.find((e) => safeStr(e.employee_id) === safeStr(cellEmpId));

    try {
      if (scheduleId) {
        if (!cellEmpId) {
          await post({ action: "delete_schedule", schedule_id: scheduleId });
        } else {
          await post({
            action: "update_schedule",
            schedule_id: scheduleId,
            employee_id: cellEmpId,
            name: emp?.name || "",
          });
        }
      } else if (cellEmpId) {
        await post({
          action: "add_schedule",
          employee_id: cellEmpId,
          name: emp?.name || "",
          date,
          part,
          planned_start: SHIFT_TIME[part].start,
          planned_end: SHIFT_TIME[part].end,
        });
      }

      showToast("저장 완료");
      setCellEdit(null);
      fetchAll();
    } catch {
      showToast("오류 발생", "err");
    } finally {
      setCellSaving(false);
    }
  };

  const generateSmartSchedule = async () => {
    const active = employees.filter((e) => e.active !== false && safeStr(e.employee_id));

    if (!active.length) {
      showToast("활성 직원이 없습니다", "err");
      return;
    }

    if (!confirm("이번 주 근무를 자동 생성하고 저장할까요?")) return;

    const weeklyHours = {};
    active.forEach((e) => {
      weeklyHours[e.employee_id] = 0;
    });

    const tasks = [];

    weekDates.forEach((date) => {
      PARTS.forEach((part) => {
        const shift = SHIFT_TIME[part];
        const emp = [...active].sort(
          (a, b) =>
            (weeklyHours[a.employee_id] || 0) - (weeklyHours[b.employee_id] || 0)
        )[0];

        weeklyHours[emp.employee_id] =
          (weeklyHours[emp.employee_id] || 0) + shift.hours;

        const existing = schedule.find(
          (s) => s.part === part && normalizeDate(s.date) === date
        );

        if (!existing) {
          tasks.push(
            post({
              action: "add_schedule",
              employee_id: emp.employee_id,
              name: emp.name,
              date,
              part,
              planned_start: shift.start,
              planned_end: shift.end,
            })
          );
        }
      });
    });

    await Promise.all(tasks);
    showToast("자동 생성 완료");
    fetchAll();
  };

  function getStatus(s, a) {
    if (!a?.check_in) return "예정";

    // 자정 넘김 보정: 계획 종료가 시작보다 작으면 +24h
    const planStart = toMin(s.planned_start);
    let planEnd = toMin(s.planned_end);
    if (planEnd < planStart) planEnd += 24 * 60;

    const realStart = toMin(a.check_in);
    let realEnd = a.check_out ? toMin(a.check_out) : null;
    if (realEnd !== null && realEnd < realStart) realEnd += 24 * 60;

    // 퇴근 안 했을 때: 계획 종료 30분 이상 지났으면 "미퇴근" 표시
    if (!a.check_out) {
      const nowM = (() => {
        const n = new Date();
        return n.getHours() * 60 + n.getMinutes();
      })();
      // 현재 시각도 자정 넘김 보정 (planStart 기준)
      let nowAdj = nowM < planStart - 60 ? nowM + 24 * 60 : nowM;
      if (nowAdj > planEnd + 30) return "미퇴근";
      return "근무중";
    }

    // 지각: 실제 출근이 계획보다 5분 초과
    if (realStart > planStart + 5) return "지각";
    // 조퇴: 실제 퇴근이 계획보다 5분 이상 이름 (단, 실제 퇴근이 계획 시작보다 늦어야 함)
    if (realEnd < planEnd - 5 && realEnd > planStart) return "조퇴";
    // 연장
    if (realEnd > planEnd + 10) return "연장";
    return "정상";
  }

  const statusColor = {
    예정: "#374151",
    근무중: "#059669",
    정상: "#2563eb",
    지각: "#dc2626",
    조퇴: "#d97706",
    연장: "#7c3aed",
    미퇴근: "#dc2626",
  };

  const statusBg = {
    예정: "#f9fafb",
    근무중: "#ecfdf5",
    정상: "#eff6ff",
    지각: "#fef2f2",
    조퇴: "#fffbeb",
    연장: "#f5f3ff",
    미퇴근: "#fef2f2",
  };

  const todayAtt = useMemo(
    () => attendance.filter((a) => normalizeDate(a.date) === today),
    [attendance, today]
  );

  // 승인 대기 중인 출근 요청
  const pendingApprovals = useMemo(
    () => todayAtt.filter((a) => a.status === "pending"),
    [todayAtt]
  );

  const approveCheckIn = async (att) => {
    await post({
      action: "update_attendance",
      attendance_id: att.attendance_id,
      check_in: att.check_in,
      check_out: att.check_out || "",
      break_min: att.break_min || 0,
      status: "approved",
    });
    showToast(`${att.name} 출근 승인 완료 ✅`);
    fetchAll();
  };

  const rejectCheckIn = async (att) => {
    if (!confirm(`${att.name}의 출근 요청을 거절할까요?`)) return;
    await post({
      action: "update_attendance",
      attendance_id: att.attendance_id,
      check_in: att.check_in,
      check_out: att.check_out || "",
      break_min: att.break_min || 0,
      status: "rejected",
    });
    showToast(`${att.name} 출근 거절됨`, "err");
    fetchAll();
  };

  const todaySched = useMemo(
    () => schedule.filter((s) => normalizeDate(s.date) === today),
    [schedule, today]
  );

  const monthlySettlement = useMemo(() => {
    const perEmp = {};
    let totalHours = 0;
    let totalPay = 0;
    let totalWorkDays = 0;

    const monthAtt = attendance.filter((a) => {
      const d = normalizeDate(a.date);
      return d >= monthRange.start && d <= monthRange.end && a.check_in && a.check_out;
    });

    monthAtt.forEach((a) => {
      const emp = getEmp(a.employee_id);
      const wage = Number(emp?.hourly_wage) || 0;

      const workMin = calcWorkMinutes(a.check_in, a.check_out, a.break_min);
      const nightMin = calcNightMinutes(a.check_in, a.check_out, a.break_min);

      const basePay = (workMin / 60) * wage;
      const nightExtraPay = (nightMin / 60) * wage * 0.5;
      const amount = basePay + nightExtraPay;

      const id = safeStr(a.employee_id) || safeStr(a.name);

      if (!perEmp[id]) {
        perEmp[id] = {
          employee_id: id,
          name: a.name || emp?.name || "-",
          wage,
          workDates: new Set(),
          minutes: 0,
          nightMinutes: 0,
          amount: 0,
          days: [],
        };
      }

      perEmp[id].workDates.add(normalizeDate(a.date));
      perEmp[id].minutes += workMin;
      perEmp[id].nightMinutes += nightMin;
      perEmp[id].amount += amount;
      perEmp[id].days.push({
        date: normalizeDate(a.date),
        check_in: a.check_in,
        check_out: a.check_out,
        break_min: a.break_min || 0,
        workMin,
        nightMin,
        pay: Math.round(basePay + nightExtraPay),
      });

      totalHours += workMin / 60;
      totalPay += amount;
    });

    const rows = Object.values(perEmp).map((r) => {
      const hours = r.minutes / 60;
      const nightHours = r.nightMinutes / 60;
      const workDays = r.workDates.size;

      totalWorkDays += workDays;

      return {
        ...r,
        workDays,
        hours,
        nightHours,
        amount: Math.round(r.amount),
        days: r.days.sort((a, b) => a.date.localeCompare(b.date)),
      };
    });

    return {
      rows,
      totalWorkDays,
      totalHours,
      totalPay: Math.round(totalPay),
    };
  }, [attendance, employees, monthRange]);

  const TABS = [
    { id: "home", label: "홈" },
    { id: "shift", label: "근무표" },
    { id: "emp", label: "직원" },
    { id: "att", label: "출퇴근" },
    { id: "sim", label: "시뮬레이터" },
  ];

  const NAV_ITEMS = [
    { id: "home", label: "홈", icon: "🏠" },
    { id: "shift", label: "근무표", icon: "📅" },
    { id: "emp", label: "직원 관리", icon: "👥" },
    { id: "att", label: "출퇴근 기록", icon: "⏱️" },
    { id: "sim", label: "급여 정산", icon: "💴" },
  ];

  const PAGE_TITLE = {
    home: { title: "오늘 근무 현황", sub: getDateString(new Date()) },
    shift: { title: "근무표", sub: "주간 스케줄 관리" },
    emp: { title: "직원 관리", sub: "직원 정보 및 시급 설정" },
    att: { title: "출퇴근 기록", sub: "실제 근무 기록 확인 및 수정" },
    sim: { title: "급여 정산", sub: "실제 출퇴근 기준 인건비 계산" },
  };

  return (
    <div className="admin-app">
      {toast && (
        <div className={`toast ${toast.type === "err" ? "toast-err" : ""}`}>
          {toast.msg}
        </div>
      )}

      {/* 사이드바 (PC) */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo">Dunkin' Donuts</div>
          <div className="brand-title">Scheduler</div>
          <div className="brand-sub">관리자 대시보드</div>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${tab === item.id ? "active" : ""}`}
              onClick={() => setTab(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="refresh-btn" onClick={fetchAll}>
            {loading ? "⟳ 로딩중..." : "↻ 새로고침"}
          </button>
        </div>
      </aside>

      {/* 모바일 탭 */}
      <div className="tabs-wrap">
        {NAV_ITEMS.map((t) => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* 메인 콘텐츠 */}
      <main className="main-content">
        <div className="page-header">
          <h1>{PAGE_TITLE[tab]?.title}</h1>
          <p>{PAGE_TITLE[tab]?.sub}</p>
        </div>

        {loading && tab !== "home" && <div className="loading">데이터 로딩 중...</div>}

      {tab === "home" && (
        <div className="page">

          {/* ── 승인 대기 배너 (상단 고정) ── */}
          {pendingApprovals.length > 0 && (
            <div className="pending-card card">
              <div className="pending-title">🔔 출근 승인 요청 {pendingApprovals.length}건</div>
              <div className="pending-list">
                {pendingApprovals.map((att) => (
                  <div key={att.attendance_id} className="pending-row">
                    <div className="pending-info">
                      <strong>{att.name}</strong>
                      <span className="pending-meta">
                        {PART_LABEL[att.part] || att.part || "파트미정"} · {formatTime(att.check_in)} 출근 요청
                      </span>
                    </div>
                    <div className="pending-actions">
                      <button className="approve-btn" onClick={() => approveCheckIn(att)}>✓ 승인</button>
                      <button className="reject-btn" onClick={() => rejectCheckIn(att)}>✕ 거절</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 파트별 예정 vs 실제 현황판 ── */}
          {PARTS.map((part) => {
            const shift = SHIFT_TIME[part];

            // 이 파트로 출근한 출석 기록 (att.part 기준)
            const partAtt = todayAtt.filter((a) => a.part === part && a.check_in);

            // 이 파트로 배정된 스케줄
            const sched = todaySched.filter((s) => s.part === part)
              .filter((s, i, arr) => arr.findIndex(x => safeStr(x.employee_id) === safeStr(s.employee_id)) === i);

            // 스케줄 있는 직원 행: att는 att.part===part 기준으로 찾음
            const schedRows = sched.map((s) => {
              const att = partAtt.find(
                (a) => safeStr(a.employee_id) === safeStr(s.employee_id)
              );
              const status = att
                ? att.status === "pending" ? "승인대기"
                : att.check_out ? getStatus(s, att)
                : getStatus(s, att)
                : "미출근";
              return { s, att, status };
            });

            // 이 파트로 출근했지만 스케줄에 없는 직원 (대타 or 자율선택)
            const extraAtt = partAtt.filter(
              (a) => !sched.some((s) => safeStr(s.employee_id) === safeStr(a.employee_id))
            );

            const hasPending =
              schedRows.some(r => r.status === "승인대기") ||
              extraAtt.some(a => a.status === "pending");

            const workingCount =
              schedRows.filter(r => r.att?.check_in && !r.att?.check_out && r.status !== "승인대기").length +
              extraAtt.filter(a => a.check_in && !a.check_out && a.status !== "pending").length;

            return (
              <div key={part} className={`dash-part-block${hasPending ? " has-pending" : ""}`}>
                <div className="dash-part-head">
                  <div className="dash-part-title">
                    <strong>{PART_LABEL[part]}</strong>
                    <span className="dash-part-time">{shift.start} – {shift.end}</span>
                  </div>
                  <div className="dash-part-counts">
                    <span className="dpc working">{workingCount}명 근무중</span>
                    <span className="dpc total">{sched.length}명 배정</span>
                  </div>
                </div>

                <div className="dash-emp-rows">
                  {schedRows.map(({ s, att, status }) => {
                    const isPendingRow = status === "승인대기";
                    const isAbsent = status === "미출근";
                    const isLate = status === "지각";
                    const isDone = !!att?.check_out;
                    return (
                      <div key={s.schedule_id} className={`dash-emp-row ${isPendingRow ? "row-pending" : isAbsent ? "row-absent" : isLate ? "row-late" : isDone ? "row-done" : "row-working"}`}>
                        <div className="dash-emp-name">{s.name}</div>
                        <div className="dash-emp-times">
                          <span className="dash-planned">{shift.start} 예정</span>
                          {att?.check_in && (
                            <span className="dash-actual">
                              {formatTime(att.check_in)}{att.check_out ? ` – ${formatTime(att.check_out)}` : " ~"}
                            </span>
                          )}
                        </div>
                        <div className="dash-emp-status">
                          {isPendingRow ? (
                            <div className="dash-approve-wrap">
                              <span className="dash-badge pending">{formatTime(att.check_in)} 요청</span>
                              <button className="dash-approve-btn" onClick={() => approveCheckIn(att)}>✓ 승인</button>
                              <button className="dash-reject-btn" onClick={() => rejectCheckIn(att)}>✕</button>
                            </div>
                          ) : (
                            <span className="dash-badge" style={{ background: statusBg[status] || "#f9fafb", color: statusColor[status] || "#374151" }}>
                              {status}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* 스케줄 외 출근 (자율선택 / 대타) */}
                  {extraAtt.map((a) => {
                    const isPendingRow = a.status === "pending";
                    return (
                      <div key={a.attendance_id} className={`dash-emp-row ${isPendingRow ? "row-pending" : "row-extra"}`}>
                        <div className="dash-emp-name">
                          {a.name}
                          {!isPendingRow && <span className="extra-tag">추가</span>}
                        </div>
                        <div className="dash-emp-times">
                          <span className="dash-actual">{formatTime(a.check_in)}{a.check_out ? ` – ${formatTime(a.check_out)}` : " ~"}</span>
                        </div>
                        <div className="dash-emp-status">
                          {isPendingRow ? (
                            <div className="dash-approve-wrap">
                              <span className="dash-badge pending">{formatTime(a.check_in)} 요청</span>
                              <button className="dash-approve-btn" onClick={() => approveCheckIn(a)}>✓ 승인</button>
                              <button className="dash-reject-btn" onClick={() => rejectCheckIn(a)}>✕</button>
                            </div>
                          ) : (
                            <span className="dash-badge" style={{ background: "#f5f3ff", color: "#7c3aed" }}>추가출근</span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {sched.length === 0 && extraAtt.length === 0 && (
                    <div className="dash-empty-part">배정된 직원 없음</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

            {tab === "shift" && (
        <div className="page">
          <div className="shift-toolbar">
            <div className="week-nav">
              <button onClick={() => setWeekOffset((w) => w - 1)}>◀</button>
              <button onClick={() => setWeekOffset(0)}>이번주</button>
              <button onClick={() => setWeekOffset((w) => w + 1)}>▶</button>
            </div>
            <div className="week-range">
              {weekDates[0]?.slice(5)} ~ {weekDates[6]?.slice(5)}
            </div>
            <button className="primary-sm" onClick={generateSmartSchedule}>
              자동 생성
            </button>
          </div>

          {cellEdit && (
            <div className="modal-overlay" onClick={() => setCellEdit(null)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-head">
                  <strong>
                    {cellEdit.date} · {PART_LABEL[cellEdit.part]}
                  </strong>
                  <button className="close-btn" onClick={() => setCellEdit(null)}>
                    ×
                  </button>
                </div>

                <label className="field-label">
                  <span>직원 배정</span>
                  <select value={cellEmpId} onChange={(e) => setCellEmpId(e.target.value)}>
                    <option value="">-- 없음 --</option>
                    {employees
                      .filter((e) => e.active !== false)
                      .map((e) => (
                        <option key={e.employee_id} value={e.employee_id}>
                          {e.name}
                        </option>
                      ))}
                  </select>
                </label>

                <div className="modal-foot">
                  <button className="ghost-sm" onClick={() => setCellEdit(null)}>
                    취소
                  </button>
                  <button className="primary-sm" onClick={saveCell} disabled={cellSaving}>
                    {cellSaving ? "저장중..." : "저장"}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="shift-wrap">
            <table className="shift-table">
              <thead>
                <tr>
                  <th className="part-col">파트</th>
                  {weekDates.map((d, i) => (
                    <th key={d}>
                      <div>{DAYS[i]}</div>
                      <div className="date-sm">{d.slice(5)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PARTS.map((part) => (
                  <tr key={part}>
                    <td className="part-label-cell">
                      <strong>{PART_LABEL[part]}</strong>
                      <div className="time-hint">
                        {SHIFT_TIME[part].start}~{SHIFT_TIME[part].end}
                      </div>
                    </td>
                    {weekDates.map((date) => {
                      const s = schedule.find(
                        (x) => x.part === part && normalizeDate(x.date) === date
                      );
                      return (
                        <td
                          key={date}
                          className="shift-cell"
                          onClick={() => openCell(date, part)}
                        >
                          {s ? (
                            <div className="cell-name">{s.name}</div>
                          ) : (
                            <div className="cell-empty">+</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "emp" && (
        <div className="page">
          <div className="card">
            <div className="section-title-inner">{editingEmp ? "직원 수정" : "직원 추가"}</div>

            <div className="form-grid">
              <label className="field-label">
                <span>이름 *</span>
                <input
                  value={empForm.name}
                  onChange={(e) => setEmpForm((f) => ({ ...f, name: e.target.value }))}
                />
              </label>

              <label className="field-label">
                <span>PIN</span>
                <input
                  value={empForm.pin}
                  onChange={(e) => setEmpForm((f) => ({ ...f, pin: e.target.value }))}
                />
              </label>

              <label className="field-label">
                <span>전화번호</span>
                <input
                  value={empForm.phone}
                  onChange={(e) => setEmpForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </label>

              <label className="field-label">
                <span>시급</span>
                <input
                  type="number"
                  value={empForm.hourly_wage}
                  onChange={(e) =>
                    setEmpForm((f) => ({ ...f, hourly_wage: e.target.value }))
                  }
                />
              </label>
            </div>

            <div className="form-foot">
              {editingEmp && (
                <button
                  className="ghost-sm"
                  onClick={() => {
                    setEditingEmp(null);
                    setEmpForm({
                      name: "",
                      phone: "",
                      hourly_wage: "",
                      pin: "",
                      active: true,
                    });
                  }}
                >
                  취소
                </button>
              )}
              <button className="primary-sm" onClick={saveEmployee} disabled={empSaving}>
                {empSaving ? "저장중..." : editingEmp ? "수정 완료" : "추가"}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="section-title-inner">직원 목록</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>PIN</th>
                  <th>전화</th>
                  <th>시급</th>
                  <th>상태</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.employee_id}>
                    <td>
                      <strong>{emp.name}</strong>
                    </td>
                    <td>
                      <code>{emp.pin || "-"}</code>
                    </td>
                    <td>{emp.phone || "-"}</td>
                    <td>{fmtKRW(Number(emp.hourly_wage) || 0)}</td>
                    <td>{emp.active !== false ? "활성" : "비활성"}</td>
                    <td>
                      <button className="icon-btn" onClick={() => startEditEmp(emp)}>
                        편집
                      </button>
                      <button className="icon-btn danger" onClick={() => deleteEmployee(emp)}>
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "att" && (
        <div className="page">
          {attEdit && (
            <div className="modal-overlay" onClick={() => setAttEdit(null)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-head">
                  <strong>출퇴근 수정 — {attEdit.name}</strong>
                  <button className="close-btn" onClick={() => setAttEdit(null)}>
                    ×
                  </button>
                </div>

                <label className="field-label">
                  <span>출근 시간</span>
                  <input
                    value={attEdit.check_in || ""}
                    onChange={(e) =>
                      setAttEdit((a) => ({ ...a, check_in: e.target.value }))
                    }
                  />
                </label>

                <label className="field-label" style={{ marginTop: 10 }}>
                  <span>퇴근 시간</span>
                  <input
                    value={attEdit.check_out || ""}
                    onChange={(e) =>
                      setAttEdit((a) => ({ ...a, check_out: e.target.value }))
                    }
                  />
                </label>

                <label className="field-label" style={{ marginTop: 10 }}>
                  <span>휴게 분</span>
                  <input
                    type="number"
                    value={attEdit.break_min || ""}
                    onChange={(e) =>
                      setAttEdit((a) => ({ ...a, break_min: e.target.value }))
                    }
                  />
                </label>

                <div className="modal-foot">
                  <button className="ghost-sm" onClick={() => setAttEdit(null)}>
                    취소
                  </button>
                  <button
                    className="primary-sm"
                    onClick={async () => {
                      await post({
                        action: "update_attendance",
                        attendance_id: attEdit.attendance_id,
                        check_in: attEdit.check_in,
                        check_out: attEdit.check_out,
                        break_min: Number(attEdit.break_min) || 0,
                      });
                      setAttEdit(null);
                      showToast("수정 완료");
                      fetchAll();
                    }}
                  >
                    저장
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="section-title-inner">출퇴근 기록</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>이름</th>
                  <th>파트</th>
                  <th>출근</th>
                  <th>퇴근</th>
                  <th>실근무</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {[...attendance].reverse().slice(0, 80).map((a) => {
                  const min = calcWorkMinutes(a.check_in, a.check_out, a.break_min);
                  return (
                    <tr key={a.attendance_id || `${a.employee_id}-${a.date}-${a.check_in}`}>
                      <td>{normalizeDate(a.date)}</td>
                      <td>
                        <strong>{a.name}</strong>
                      </td>
                      <td>{PART_LABEL[a.part] || a.part || "-"}</td>
                      <td>{formatTime(a.check_in)}</td>
                      <td>{formatTime(a.check_out)}</td>
                      <td>{(min / 60).toFixed(1)}h</td>
                      <td>
                        <button className="icon-btn" onClick={() => setAttEdit({ ...a })}>
                          편집
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {attendance.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty">
                      기록이 없습니다
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "sim" && (
        <div className="page">

          {/* ── 캘린더식 월 선택 ── */}
          <div className="cal-month-nav">
            <button className="cal-nav-btn" onClick={() => setSettlementOffset(o => o - 1)}>◀</button>
            <span className="cal-month-label">{monthRange.label}</span>
            <button className="cal-nav-btn" onClick={() => setSettlementOffset(o => o + 1)}>▶</button>
          </div>

          {/* ── 총합계 배너 ── */}
          <div className="sim-total-banner">
            <div className="sim-total-left">
              <span className="sim-total-month">{monthRange.label}</span>
              <span className="sim-total-desc">인건비 총합계</span>
            </div>
            <div className="sim-total-right">
              <div className="sim-total-amount">{fmtKRW(monthlySettlement.totalPay)}</div>
              <div className="sim-total-meta">
                {monthlySettlement.rows.length}명 &middot; {monthlySettlement.totalHours.toFixed(1)}h &middot; {monthlySettlement.totalWorkDays}일
              </div>
            </div>
          </div>

          {/* ── 직원별 카드 ── */}
          {monthlySettlement.rows.length === 0 ? (
            <div className="card"><div className="empty">{monthRange.label} 완료된 출퇴근 기록이 없습니다</div></div>
          ) : (
            <div className="sim-cards">
              {[...monthlySettlement.rows].sort((a, b) => b.amount - a.amount).map((e) => {
                const nightExtra = Math.round(e.nightHours * e.wage * 0.5);
                const pct = monthlySettlement.totalPay > 0
                  ? Math.round((e.amount / monthlySettlement.totalPay) * 100) : 0;
                const isExpanded = expandedEmp === e.employee_id;

                return (
                  <div key={e.employee_id} className="sim-emp-card">
                    {/* 헤더 */}
                    <div className="sim-emp-header" onClick={() => setExpandedEmp(isExpanded ? null : e.employee_id)} style={{cursor:"pointer"}}>
                      <div className="sim-emp-avatar">{e.name.slice(0, 1)}</div>
                      <div className="sim-emp-info">
                        <strong>{e.name}</strong>
                        <span>{fmtKRW(e.wage)}/h &middot; {e.workDays}일 출근 &middot; {e.hours.toFixed(1)}h</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div className="sim-emp-total">{fmtKRW(e.amount)}</div>
                        <span style={{color:"#9ca3af",fontSize:13}}>{isExpanded ? "▲" : "▼"}</span>
                      </div>
                    </div>

                    {/* 비율 바 */}
                    <div className="sim-bar-wrap"><div className="sim-bar-fill" style={{width:`${pct}%`}} /></div>
                    <div className="sim-bar-label">{pct}% of 총 인건비</div>

                    {/* 요약 그리드 */}
                    <div className="sim-detail-grid">
                      <div className="sim-detail-item"><span>기본급</span><strong>{fmtKRW(Math.round(e.hours * e.wage))}</strong></div>
                      <div className="sim-detail-item accent"><span>야간 추가</span><strong>+{fmtKRW(nightExtra)}</strong></div>
                      <div className="sim-detail-item"><span>야간 시간</span><strong>{e.nightHours.toFixed(1)}h</strong></div>
                      <div className="sim-detail-item" style={{background:"#111827",borderRadius:10,padding:10,display:"flex",flexDirection:"column",gap:4}}>
                        <span style={{fontSize:10,fontWeight:700,color:"#6b7280",textTransform:"uppercase"}}>합계</span>
                        <strong style={{fontSize:15,fontWeight:900,color:"#f97316"}}>{fmtKRW(e.amount)}</strong>
                      </div>
                    </div>

                    {/* 임금명세서 버튼 */}
                    <button className="payslip-btn" onClick={(ev) => { ev.stopPropagation(); setPayslipEmp(e); }}>
                      📄 임금명세서 출력
                    </button>

                    {/* 근무일 상세 (펼치기) */}
                    {isExpanded && (
                      <div className="sim-days-table">
                        <div className="sim-days-head">
                          <span>날짜</span><span>출근</span><span>퇴근</span><span>근무</span><span>야간</span><span>금액</span>
                        </div>
                        {e.days.map((d, i) => {
                          const dateObj = new Date(d.date);
                          const dayKr = ["일","월","화","수","목","금","토"][dateObj.getDay()];
                          return (
                            <div key={i} className="sim-days-row">
                              <span>{d.date.slice(5)} ({dayKr})</span>
                              <span>{formatTime(d.check_in)}</span>
                              <span>{formatTime(d.check_out)}</span>
                              <span>{(d.workMin/60).toFixed(1)}h</span>
                              <span>{d.nightMin > 0 ? (d.nightMin/60).toFixed(1)+"h" : "-"}</span>
                              <span className="sim-days-pay">{fmtKRW(d.pay)}</span>
                            </div>
                          );
                        })}
                        <div className="sim-days-total">
                          <span>합계</span><span></span><span></span>
                          <span>{e.hours.toFixed(1)}h</span>
                          <span>{e.nightHours.toFixed(1)}h</span>
                          <span className="sim-days-pay">{fmtKRW(e.amount)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── 임금명세서 모달 ── */}
          {payslipEmp && (() => {
            const nightExtra = Math.round(payslipEmp.nightHours * payslipEmp.wage * 0.5);
            const basePay = Math.round(payslipEmp.hours * payslipEmp.wage);
            // 주휴수당: 1주 소정근로시간 / 40 × 8시간 × 시급 (간소화: 근무일수/5 × 8 × 시급)
            const weeklyHolidayPay = Math.round((payslipEmp.workDays / 5) * 8 * payslipEmp.wage);
            const totalPay = basePay + nightExtra + weeklyHolidayPay;
            return (
            <div className="modal-overlay" onClick={() => setPayslipEmp(null)}>
              <div className="payslip-modal" onClick={e => e.stopPropagation()}>
                <div className="payslip-header">
                  <div>
                    <div className="payslip-brand">DUNKIN' DONUTS</div>
                    <div className="payslip-title">임금명세서</div>
                  </div>
                  <button className="close-btn" onClick={() => setPayslipEmp(null)}>×</button>
                </div>

                {/* 기본정보 */}
                <div className="payslip-info-grid">
                  <div><span>사업장명</span><strong>던킨도너츠</strong></div>
                  <div><span>임금산정기간</span><strong>{monthRange.label}</strong></div>
                  <div><span>성명</span><strong>{payslipEmp.name}</strong></div>
                  <div><span>지급일</span><strong>{monthRange.label.replace("년 ", ".").replace("월", "")} 말일</strong></div>
                </div>

                {/* 지급내역 */}
                <div className="payslip-section-title">지급내역</div>
                <div className="payslip-pay-grid">
                  <div className="payslip-pay-item">
                    <span>기본급 (월급)</span>
                    <strong>{fmtKRW(basePay)}</strong>
                    <small>{payslipEmp.hours.toFixed(1)}h × {fmtKRW(payslipEmp.wage)}</small>
                  </div>
                  <div className="payslip-pay-item">
                    <span>야간근로수당</span>
                    <strong>{fmtKRW(nightExtra)}</strong>
                    <small>야간 {payslipEmp.nightHours.toFixed(1)}h × 50%</small>
                  </div>
                  <div className="payslip-pay-item">
                    <span>주휴수당</span>
                    <strong>{fmtKRW(weeklyHolidayPay)}</strong>
                    <small>{payslipEmp.workDays}일 출근 기준</small>
                  </div>
                  <div className="payslip-pay-item highlight">
                    <span>지급합계</span>
                    <strong>{fmtKRW(totalPay)}</strong>
                  </div>
                </div>

                {/* 공제내역 */}
                <div className="payslip-section-title">공제내역</div>
                <div className="payslip-deduct-grid">
                  <div className="payslip-deduct-item"><span>소득세</span><strong>-</strong></div>
                  <div className="payslip-deduct-item"><span>지방소득세</span><strong>-</strong></div>
                  <div className="payslip-deduct-item"><span>국민연금</span><strong>-</strong></div>
                  <div className="payslip-deduct-item"><span>건강보험</span><strong>-</strong></div>
                  <div className="payslip-deduct-item"><span>고용보험</span><strong>-</strong></div>
                  <div className="payslip-deduct-item"><span>공제합계</span><strong>-</strong></div>
                </div>

                {/* 근무일 내역 */}
                <div className="payslip-section-title">근무 상세</div>
                <div className="payslip-table">
                  <div className="payslip-row header">
                    <span>날짜</span><span>출근</span><span>퇴근</span><span>근무시간</span><span>금액</span>
                  </div>
                  {payslipEmp.days.map((d, i) => {
                    const dateObj = new Date(d.date);
                    const dayKr = ["일","월","화","수","목","금","토"][dateObj.getDay()];
                    return (
                      <div key={i} className="payslip-row">
                        <span>{d.date.slice(5)} ({dayKr})</span>
                        <span>{formatTime(d.check_in)}</span>
                        <span>{formatTime(d.check_out)}</span>
                        <span>{(d.workMin/60).toFixed(1)}h{d.nightMin > 0 ? ` (야간 ${(d.nightMin/60).toFixed(1)}h)` : ""}</span>
                        <span>{fmtKRW(d.pay)}</span>
                      </div>
                    );
                  })}
                </div>

                {/* 실수령액 */}
                <div className="payslip-summary">
                  <div className="ps-row"><span>지급합계</span><span>{fmtKRW(totalPay)}</span></div>
                  <div className="ps-row"><span>공제합계</span><span>0원</span></div>
                  <div className="ps-row total"><span>실수령액</span><span>{fmtKRW(totalPay)}</span></div>
                </div>

                <div className="payslip-foot">
                  위 금액을 {monthRange.label} 근무에 대하여 지급함을 확인합니다.
                </div>
                <button className="payslip-print-btn" onClick={() => window.print()}>🖨️ 인쇄하기</button>
              </div>
            </div>
            );
          })()}
        </div>
      )}

                  </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');

        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: 'DM Sans', 'Noto Sans KR', sans-serif;
          background: #f0f2f5;
          color: #111827;
        }

        /* ── LAYOUT ── */
        .admin-app {
          display: flex;
          min-height: 100vh;
        }

        /* ── SIDEBAR ── */
        .sidebar {
          width: 220px;
          flex-shrink: 0;
          background: #111827;
          display: flex;
          flex-direction: column;
          padding: 0;
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          z-index: 100;
        }

        .sidebar-brand {
          padding: 22px 20px 18px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }

        .brand-logo {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.2em;
          color: #f97316;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .brand-title {
          font-size: 17px;
          font-weight: 800;
          color: #fff;
          line-height: 1.2;
        }

        .brand-sub {
          font-size: 11px;
          color: #6b7280;
          margin-top: 2px;
        }

        .sidebar-nav {
          flex: 1;
          padding: 12px 10px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 10px;
          border: none;
          background: transparent;
          color: #9ca3af;
          font-size: 14px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          text-align: left;
          transition: all 0.15s;
        }

        .nav-item:hover {
          background: rgba(255,255,255,0.06);
          color: #fff;
        }

        .nav-item.active {
          background: #f97316;
          color: #fff;
        }

        .nav-icon {
          font-size: 16px;
          width: 20px;
          text-align: center;
        }

        .sidebar-footer {
          padding: 16px 10px;
          border-top: 1px solid rgba(255,255,255,0.07);
        }

        .refresh-btn {
          width: 100%;
          padding: 9px 12px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.12);
          background: transparent;
          color: #9ca3af;
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.15s;
        }

        .refresh-btn:hover {
          background: rgba(255,255,255,0.06);
          color: #fff;
        }

        /* ── MAIN CONTENT ── */
        .main-content {
          margin-left: 220px;
          flex: 1;
          padding: 28px 28px 80px;
          min-height: 100vh;
        }

        .page-header {
          margin-bottom: 24px;
        }

        .page-header h1 {
          margin: 0 0 4px;
          font-size: 24px;
          font-weight: 800;
        }

        .page-header p {
          margin: 0;
          font-size: 13px;
          color: #6b7280;
        }

        .page {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        /* ── CARD ── */
        .card {
          background: #fff;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 1px 4px rgba(17,24,39,0.06), 0 4px 16px rgba(17,24,39,0.04);
        }

        /* ── METRIC GRID ── */
        .card-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 14px;
        }

        .metric-card {
          background: #fff;
          border-radius: 14px;
          padding: 18px;
          box-shadow: 0 1px 4px rgba(17,24,39,0.06);
          border: 1.5px solid #f3f4f6;
        }

        .metric-card.accent {
          background: #111827;
          color: #fff;
          border-color: #111827;
        }

        .metric-card.accent .metric-label {
          color: #9ca3af;
        }

        .metric-card.accent .metric-sub {
          color: #6b7280;
        }

        .metric-label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 8px;
        }

        .metric-card strong {
          font-size: 26px;
          font-weight: 800;
          display: block;
          line-height: 1;
        }

        .metric-sub {
          font-size: 11px;
          color: #9ca3af;
          margin-top: 4px;
          display: block;
        }

        /* ── SECTION ── */
        .section-title {
          font-size: 11px;
          font-weight: 800;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 12px;
        }

        .section-title-inner {
          font-size: 15px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 16px;
        }

        /* ── TABLE ── */
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .data-table th {
          text-align: left;
          padding: 8px 12px;
          font-size: 11px;
          font-weight: 700;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 2px solid #f3f4f6;
        }

        .data-table td {
          padding: 11px 12px;
          border-bottom: 1px solid #f9fafb;
          vertical-align: middle;
        }

        .data-table tr:last-child td {
          border-bottom: none;
        }

        .data-table tr:hover td {
          background: #fafafa;
        }

        /* ── BADGE ── */
        .badge {
          padding: 3px 9px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }

        code {
          background: #f3f4f6;
          padding: 2px 7px;
          border-radius: 5px;
          font-size: 12px;
          font-family: 'DM Mono', monospace;
        }

        /* ── BUTTONS ── */
        .icon-btn {
          margin-right: 4px;
          padding: 5px 10px;
          border-radius: 7px;
          border: 1px solid #e5e7eb;
          background: #fff;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          color: #374151;
          transition: all 0.1s;
        }

        .icon-btn:hover {
          border-color: #d1d5db;
          background: #f9fafb;
        }

        .icon-btn.danger {
          color: #dc2626;
          border-color: #fecaca;
        }

        .icon-btn.danger:hover {
          background: #fef2f2;
        }

        /* ── FORM ── */
        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
          margin-bottom: 16px;
        }

        .field-label {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .field-label span {
          font-size: 11px;
          font-weight: 700;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .field-label input,
        .field-label select {
          padding: 10px 12px;
          border: 1.5px solid #e5e7eb;
          border-radius: 10px;
          font-size: 14px;
          font-family: inherit;
          background: #fff;
          transition: border-color 0.15s;
        }

        .field-label input:focus,
        .field-label select:focus {
          outline: none;
          border-color: #f97316;
        }

        .form-foot {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .primary-sm {
          padding: 9px 20px;
          border-radius: 10px;
          background: #f97316;
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          border: none;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.15s;
        }

        .primary-sm:hover {
          background: #ea6b0a;
        }

        .ghost-sm {
          padding: 9px 18px;
          border-radius: 10px;
          background: #fff;
          color: #374151;
          font-size: 14px;
          font-weight: 600;
          border: 1.5px solid #e5e7eb;
          cursor: pointer;
          font-family: inherit;
        }

        /* ── SHIFT TABLE ── */
        .shift-toolbar {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        .week-nav {
          display: flex;
          gap: 4px;
        }

        .week-nav button {
          padding: 7px 12px;
          border-radius: 8px;
          border: 1.5px solid #e5e7eb;
          background: #fff;
          cursor: pointer;
          font-family: inherit;
          font-weight: 600;
          font-size: 13px;
        }

        .week-range {
          font-size: 13px;
          color: #6b7280;
          font-weight: 600;
          flex: 1;
        }

        .shift-wrap {
          overflow-x: auto;
        }

        .shift-table {
          width: 100%;
          min-width: 700px;
          border-collapse: collapse;
          background: #fff;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 1px 4px rgba(17,24,39,0.06);
        }

        .shift-table th {
          padding: 11px 8px;
          font-size: 12px;
          background: #f9fafb;
          border-bottom: 2px solid #f0f2f5;
          font-weight: 700;
          text-align: center;
          color: #374151;
        }

        .shift-table td {
          padding: 0;
          border: 1px solid #f3f4f6;
        }

        .part-col {
          width: 90px;
        }

        .date-sm {
          font-size: 11px;
          color: #9ca3af;
          font-weight: 500;
        }

        .part-label-cell {
          padding: 12px !important;
          text-align: center;
          background: #f9fafb;
        }

        .part-label-cell strong {
          font-size: 13px;
          display: block;
          color: #374151;
        }

        .time-hint {
          font-size: 11px;
          color: #9ca3af;
          margin-top: 2px;
        }

        .shift-cell {
          padding: 12px 8px !important;
          text-align: center;
          cursor: pointer;
          background: #fff;
          transition: background 0.1s;
        }

        .shift-cell:hover {
          background: #fff8f3;
        }

        .cell-name {
          font-size: 13px;
          font-weight: 700;
          color: #111827;
        }

        .cell-empty {
          font-size: 18px;
          color: #d1d5db;
        }

        /* ── MODAL ── */
        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(0,0,0,0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          backdrop-filter: blur(2px);
        }

        .modal {
          background: #fff;
          border-radius: 20px;
          padding: 24px;
          width: 100%;
          max-width: 380px;
          box-shadow: 0 24px 60px rgba(0,0,0,0.2);
        }

        .modal-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 18px;
        }

        .modal-head strong {
          font-size: 16px;
        }

        .close-btn {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: none;
          background: #f3f4f6;
          font-size: 18px;
          cursor: pointer;
          line-height: 1;
        }

        .modal-foot {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 20px;
        }

        /* ── TOAST ── */
        .toast {
          position: fixed;
          bottom: 28px;
          left: 50%;
          transform: translateX(-50%);
          background: #111827;
          color: #fff;
          padding: 12px 24px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 700;
          z-index: 9999;
          box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        }

        .toast.toast-err {
          background: #dc2626;
        }

        /* ── PENDING APPROVALS ── */
        .pending-card {
          border: 2px solid #fed7aa !important;
          background: #fffbeb !important;
        }

        .pending-title {
          color: #92400e !important;
          font-size: 14px !important;
          font-weight: 800 !important;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .pending-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 4px;
        }

        .pending-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: #fff;
          border: 1.5px solid #fed7aa;
          border-radius: 12px;
          gap: 12px;
        }

        .pending-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .pending-info strong {
          font-size: 15px;
          font-weight: 800;
          color: #111827;
        }

        .pending-meta {
          font-size: 12px;
          color: #6b7280;
        }

        .pending-actions {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }

        .approve-btn {
          padding: 8px 18px;
          border-radius: 10px;
          background: #059669;
          color: #fff;
          font-size: 13px;
          font-weight: 800;
          border: none;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.15s;
        }

        .approve-btn:hover { background: #047857; }

        .reject-btn {
          padding: 8px 14px;
          border-radius: 10px;
          background: #fff;
          color: #dc2626;
          font-size: 13px;
          font-weight: 800;
          border: 1.5px solid #fca5a5;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s;
        }

        .reject-btn:hover { background: #fef2f2; }

        /* ── LIVE SCHEDULE ── */
        .live-schedule {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .live-part-row {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 14px 0;
          border-bottom: 1px solid #f3f4f6;
        }

        .live-part-row:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .live-part-label {
          min-width: 80px;
          display: flex;
          flex-direction: column;
          gap: 3px;
          padding-top: 2px;
          flex-shrink: 0;
        }

        .live-part-label strong {
          font-size: 14px;
          font-weight: 800;
          color: #111827;
        }

        .live-part-label span {
          font-size: 11px;
          color: #9ca3af;
          font-weight: 600;
        }

        .live-part-slots {
          flex: 1;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .live-slot {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 10px 14px;
          border-radius: 12px;
          min-width: 110px;
          border: 1.5px solid;
        }

        .live-slot.working {
          background: #f0fdf4;
          border-color: #86efac;
        }

        .live-slot.done {
          background: #eff6ff;
          border-color: #bfdbfe;
        }

        .live-slot.scheduled {
          background: #f9fafb;
          border-color: #e5e7eb;
        }

        .live-slot.pending-slot {
          background: #fffbeb;
          border-color: #fde68a;
        }

        .live-slot-name {
          font-size: 14px;
          font-weight: 800;
          color: #111827;
        }

        .live-slot-time {
          font-size: 11px;
          color: #6b7280;
          font-weight: 600;
        }

        .live-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          width: fit-content;
        }

        .live-slot-empty {
          font-size: 13px;
          color: #d1d5db;
          padding: 8px 4px;
          font-weight: 600;
        }

        /* ── SIM / SETTLEMENT ── */
        .sim-month-bar {
          display: flex;
          gap: 8px;
          margin-bottom: 4px;
        }

        .sim-month-btn {
          padding: 9px 20px;
          border-radius: 20px;
          border: 1.5px solid #e5e7eb;
          background: #fff;
          font-size: 14px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          color: #374151;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .sim-month-btn:hover { border-color: #f97316; color: #f97316; }

        .sim-month-btn.active {
          background: #f97316;
          border-color: #f97316;
          color: #fff;
        }

        .sim-month-hint {
          font-size: 10px;
          padding: 1px 6px;
          border-radius: 10px;
          background: rgba(255,255,255,0.3);
        }

        .sim-month-btn:not(.active) .sim-month-hint {
          background: #fef3ec;
          color: #f97316;
        }

        /* 총합계 배너 */
        .sim-total-banner {
          background: linear-gradient(135deg, #111827 0%, #1f2937 100%);
          border-radius: 16px;
          padding: 22px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .sim-total-left {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .sim-total-month {
          font-size: 13px;
          font-weight: 700;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .sim-total-desc {
          font-size: 15px;
          font-weight: 800;
          color: #fff;
        }

        .sim-total-right {
          text-align: right;
        }

        .sim-total-amount {
          font-size: 28px;
          font-weight: 900;
          color: #f97316;
          line-height: 1.1;
        }

        .sim-total-meta {
          font-size: 12px;
          color: #6b7280;
          margin-top: 4px;
        }

        /* 직원 카드 */
        .sim-cards {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .sim-emp-card {
          background: #fff;
          border-radius: 16px;
          padding: 18px 20px;
          box-shadow: 0 1px 4px rgba(17,24,39,0.07);
          border: 1.5px solid #f3f4f6;
        }

        .sim-emp-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
        }

        .sim-emp-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #f97316;
          color: #fff;
          font-size: 17px;
          font-weight: 900;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .sim-emp-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .sim-emp-info strong {
          font-size: 16px;
          font-weight: 800;
          color: #111827;
        }

        .sim-emp-info span {
          font-size: 12px;
          color: #9ca3af;
          font-weight: 600;
        }

        .sim-emp-total {
          font-size: 20px;
          font-weight: 900;
          color: #111827;
          white-space: nowrap;
        }

        .sim-bar-wrap {
          height: 6px;
          background: #f3f4f6;
          border-radius: 999px;
          overflow: hidden;
          margin-bottom: 6px;
        }

        .sim-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #f97316, #fb923c);
          border-radius: 999px;
          transition: width 0.4s ease;
          min-width: 4px;
        }

        .sim-bar-label {
          font-size: 11px;
          color: #9ca3af;
          font-weight: 600;
          margin-bottom: 14px;
        }

        .sim-detail-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }

        .sim-detail-item {
          background: #f9fafb;
          border-radius: 10px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .sim-detail-item span {
          font-size: 10px;
          font-weight: 700;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .sim-detail-item strong {
          font-size: 13px;
          font-weight: 800;
          color: #111827;
        }

        .sim-detail-item.accent {
          background: #fef3ec;
        }

        .sim-detail-item.accent strong {
          color: #f97316;
        }

        @media (max-width: 600px) {
          .sim-detail-grid { grid-template-columns: repeat(2, 1fr); }
          .sim-total-amount { font-size: 22px; }
        }

        /* ══════════════════════════════
           대시보드 파트별 현황판
        ══════════════════════════════ */
        .dash-part-block {
          background: #fff;
          border-radius: 16px;
          border: 1.5px solid #e5e7eb;
          overflow: hidden;
          box-shadow: 0 1px 4px rgba(17,24,39,0.05);
        }

        .dash-part-block.has-pending {
          border-color: #fde68a;
          box-shadow: 0 0 0 3px rgba(251,191,36,0.15);
        }

        .dash-part-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 18px;
          background: #f9fafb;
          border-bottom: 1px solid #f3f4f6;
        }

        .dash-part-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .dash-part-title strong {
          font-size: 15px;
          font-weight: 800;
          color: #111827;
        }

        .dash-part-time {
          font-size: 12px;
          color: #9ca3af;
          font-weight: 600;
        }

        .dash-part-counts {
          display: flex;
          gap: 8px;
        }

        .dpc {
          font-size: 12px;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 20px;
        }

        .dpc.working { background: #d1fae5; color: #059669; }
        .dpc.total   { background: #f3f4f6; color: #6b7280; }

        .dash-emp-rows {
          display: flex;
          flex-direction: column;
        }

        .dash-emp-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 18px;
          border-bottom: 1px solid #f9fafb;
          transition: background 0.1s;
        }

        .dash-emp-row:last-child { border-bottom: none; }

        .row-pending  { background: #fffbeb; }
        .row-absent   { background: #fef2f2; }
        .row-late     { background: #fffbeb; }
        .row-done     { background: #f9fafb; opacity: 0.8; }
        .row-working  { background: #fff; }
        .row-extra    { background: #f5f3ff; }

        .dash-emp-name {
          min-width: 80px;
          font-size: 14px;
          font-weight: 800;
          color: #111827;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .extra-tag {
          font-size: 10px;
          font-weight: 700;
          background: #ede9fe;
          color: #7c3aed;
          padding: 1px 6px;
          border-radius: 20px;
        }

        .dash-emp-times {
          flex: 1;
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }

        .dash-planned {
          font-size: 12px;
          color: #9ca3af;
          font-weight: 600;
        }

        .dash-actual {
          font-size: 13px;
          color: #111827;
          font-weight: 700;
        }

        .dash-emp-status {
          flex-shrink: 0;
        }

        .dash-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
        }

        .dash-badge.pending {
          background: #fef3c7;
          color: #92400e;
        }

        .dash-approve-wrap {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .dash-approve-btn {
          padding: 5px 12px;
          border-radius: 8px;
          background: #059669;
          color: #fff;
          font-size: 12px;
          font-weight: 800;
          border: none;
          cursor: pointer;
          font-family: inherit;
        }

        .dash-approve-btn:hover { background: #047857; }

        .dash-reject-btn {
          padding: 5px 9px;
          border-radius: 8px;
          background: #fff;
          color: #dc2626;
          font-size: 12px;
          font-weight: 800;
          border: 1.5px solid #fca5a5;
          cursor: pointer;
          font-family: inherit;
        }

        .dash-empty-part {
          padding: 18px;
          text-align: center;
          color: #d1d5db;
          font-size: 13px;
        }

        /* ══════════════════════════════
           급여 정산 — 캘린더 네비
        ══════════════════════════════ */
        .cal-month-nav {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          padding: 6px 0;
        }

        .cal-nav-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 1.5px solid #e5e7eb;
          background: #fff;
          font-size: 14px;
          cursor: pointer;
          font-family: inherit;
          font-weight: 700;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .cal-nav-btn:hover { border-color: #f97316; color: #f97316; }

        .cal-month-label {
          font-size: 20px;
          font-weight: 900;
          color: #111827;
          min-width: 120px;
          text-align: center;
        }

        /* ── 근무일 상세 테이블 ── */
        .sim-days-table {
          margin-top: 14px;
          border-top: 1px solid #f3f4f6;
          padding-top: 12px;
        }

        .sim-days-head,
        .sim-days-row,
        .sim-days-total {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1.5fr;
          gap: 4px;
          padding: 7px 4px;
          font-size: 12px;
        }

        .sim-days-head {
          font-weight: 800;
          color: #9ca3af;
          text-transform: uppercase;
          font-size: 10px;
          letter-spacing: 0.05em;
          border-bottom: 1px solid #f3f4f6;
        }

        .sim-days-row {
          color: #374151;
          font-weight: 600;
          border-bottom: 1px solid #f9fafb;
        }

        .sim-days-row:last-child { border-bottom: none; }

        .sim-days-total {
          font-weight: 800;
          color: #111827;
          border-top: 2px solid #f3f4f6;
          margin-top: 4px;
        }

        .sim-days-pay { font-weight: 800; color: #f97316; }

        /* ── 임금명세서 버튼 ── */
        .payslip-btn {
          margin-top: 14px;
          width: 100%;
          padding: 10px;
          border-radius: 10px;
          border: 1.5px solid #e5e7eb;
          background: #f9fafb;
          font-size: 13px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          color: #374151;
          transition: all 0.15s;
        }

        .payslip-btn:hover { border-color: #f97316; color: #f97316; background: #fff8f3; }

        /* ── 임금명세서 모달 ── */
        .payslip-modal {
          background: #fff;
          border-radius: 20px;
          padding: 28px;
          width: 100%;
          max-width: 560px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 24px 60px rgba(0,0,0,0.25);
        }

        .payslip-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 2px solid #111827;
        }

        .payslip-brand {
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.2em;
          color: #f97316;
          margin-bottom: 4px;
        }

        .payslip-title {
          font-size: 22px;
          font-weight: 900;
          color: #111827;
        }

        .payslip-info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 18px;
          padding: 14px;
          background: #f9fafb;
          border-radius: 12px;
        }

        .payslip-info-grid div {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .payslip-info-grid span {
          font-size: 10px;
          font-weight: 700;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .payslip-info-grid strong {
          font-size: 14px;
          font-weight: 800;
          color: #111827;
        }

        .payslip-section-title {
          font-size: 11px;
          font-weight: 800;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin: 14px 0 8px;
          padding-bottom: 6px;
          border-bottom: 1px solid #f3f4f6;
        }

        /* 지급내역 그리드 */
        .payslip-pay-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-bottom: 4px;
        }

        .payslip-pay-item {
          background: #f9fafb;
          border-radius: 10px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .payslip-pay-item span {
          font-size: 10px;
          font-weight: 700;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .payslip-pay-item strong {
          font-size: 13px;
          font-weight: 800;
          color: #111827;
        }

        .payslip-pay-item small {
          font-size: 10px;
          color: #9ca3af;
        }

        .payslip-pay-item.highlight {
          background: #111827;
        }

        .payslip-pay-item.highlight span { color: #6b7280; }
        .payslip-pay-item.highlight strong { color: #f97316; font-size: 15px; }

        /* 공제내역 그리드 */
        .payslip-deduct-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 4px;
        }

        .payslip-deduct-item {
          background: #f9fafb;
          border-radius: 10px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .payslip-deduct-item span {
          font-size: 10px;
          font-weight: 700;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .payslip-deduct-item strong {
          font-size: 13px;
          font-weight: 800;
          color: #374151;
        }

        .payslip-table {
          margin-bottom: 16px;
        }

        .payslip-row {
          display: grid;
          grid-template-columns: 1.5fr 0.8fr 0.8fr 1.5fr 1.2fr;
          gap: 4px;
          padding: 8px 4px;
          font-size: 12px;
          border-bottom: 1px solid #f3f4f6;
          color: #374151;
          font-weight: 600;
        }

        .payslip-row.header {
          font-size: 10px;
          font-weight: 800;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .payslip-summary {
          background: #f9fafb;
          border-radius: 12px;
          padding: 14px 16px;
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ps-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
        }

        .ps-row.total {
          border-top: 1.5px solid #e5e7eb;
          padding-top: 8px;
          margin-top: 4px;
          font-size: 16px;
          font-weight: 900;
          color: #111827;
        }

        .ps-row.total span:last-child { color: #f97316; }

        .payslip-foot {
          font-size: 12px;
          color: #9ca3af;
          text-align: center;
          margin-bottom: 16px;
          line-height: 1.6;
        }

        .payslip-print-btn {
          width: 100%;
          padding: 13px;
          border-radius: 12px;
          background: #111827;
          color: #fff;
          font-size: 14px;
          font-weight: 800;
          font-family: inherit;
          border: none;
          cursor: pointer;
        }

        .payslip-print-btn:hover { background: #1f2937; }

        /* ================= PRINT (임금명세서 전용) ================= */
@media print {
  @page {
    size: A4 portrait;
    margin: 12mm;
  }

  html,
  body {
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    width: 100% !important;
    height: auto !important;
  }

  /* 전체 숨김 */
  body * {
    visibility: hidden !important;
  }

  /* 임금명세서만 보이기 */
  .modal-overlay,
  .modal-overlay *,
  .payslip-modal,
  .payslip-modal * {
    visibility: visible !important;
  }

  /* 불필요 UI 제거 */
  .sidebar,
  .tabs-wrap,
  .page-header,
  .toast,
  .payslip-print-btn,
  .close-btn {
    display: none !important;
  }

  /* 레이아웃 초기화 */
  .admin-app {
    display: block !important;
    min-height: auto !important;
    background: #ffffff !important;
  }

  .main-content {
    margin-left: 0 !important;
    padding: 0 !important;
    min-height: auto !important;
    background: #ffffff !important;
  }

  /* 모달을 일반 문서처럼 */
  .modal-overlay {
    position: static !important;
    inset: auto !important;
    display: block !important;
    background: transparent !important;
    padding: 0 !important;
    backdrop-filter: none !important;
  }

  /* 명세서 */
  .payslip-modal {
    position: static !important;
    width: 100% !important;
    max-width: none !important;
    max-height: none !important;
    overflow: visible !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    background: #ffffff !important;
  }

  .payslip-header {
    margin-top: 0 !important;
  }
}