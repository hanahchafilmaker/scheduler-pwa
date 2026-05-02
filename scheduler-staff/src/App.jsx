import { useEffect, useMemo, useState } from "react";

const API_URL =
  "https://script.google.com/macros/s/AKfycbx_PbHZoF02fNHIp-Ek4nVLO-GxUW1LxFRDEpMtFiLRRJg2_6RQ7zo0F1WuCyImp_KXnA/exec";

const PART_LABEL = {
  open: "오픈",
  middle: "미들",
  close: "마감",
  extra: "대타",
  대타: "대타",
};

const SHIFT_TIME = {
  open: { start: "07:00", end: "13:00" },
  middle: { start: "13:00", end: "18:00" },
  close: { start: "18:00", end: "23:00" },
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
  return Number(m[1]) * 60 + Number(m[2]);
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
  if (!checkIn || !checkOut) return 0;
  const start = toMin(checkIn);
  let end = toMin(checkOut);
  if (end < start) end += 24 * 60;
  return Math.max(0, end - start - Math.max(0, Number(breakMin) || 0));
}

function calcNightMinutes(checkIn, checkOut, breakMin = 0) {
  if (!checkIn || !checkOut) return 0;
  const start = toMin(checkIn);
  let end = toMin(checkOut);
  if (end < start) end += 24 * 60;
  const overlap = Math.max(0, Math.min(end, 30 * 60) - Math.max(start, 22 * 60));
  const total = Math.max(1, end - start);
  return Math.max(0, overlap - (Number(breakMin) || 0) * (overlap / total));
}

function calcPay(checkIn, checkOut, breakMin, hourlyWage) {
  const workMin = calcWorkMinutes(checkIn, checkOut, breakMin);
  const nightMin = calcNightMinutes(checkIn, checkOut, breakMin);
  const wage = Number(hourlyWage) || 0;
  return Math.round((workMin / 60) * wage + (nightMin / 60) * wage * 0.5);
}

// ── 현재 시각 HH:MM ──
function nowTime() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

// ── 요일 ──
const DAY_KR = ["일", "월", "화", "수", "목", "금", "토"];

export default function StaffApp() {
  const [screen, setScreen] = useState("pin"); // pin | home
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [employee, setEmployee] = useState(null);

  const [allData, setAllData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false); // kept for compatibility
  const [toast, setToast] = useState(null);

  const [tab, setTab] = useState("today"); // today | history
  const [historyOffset, setHistoryOffset] = useState(0); // 0=이번달, -1=지난달
  const [selectedPart, setSelectedPart] = useState(""); // 직원이 선택한 파트

  const [clock, setClock] = useState(nowTime());

  // 시계 tick
  useEffect(() => {
    const t = setInterval(() => setClock(nowTime()), 10000);
    return () => clearInterval(t);
  }, []);

  // 초기 데이터 로드
  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=all`);
      const json = await res.json();
      setAllData(json);
    } finally {
      setLoading(false);
    }
  };

  const post = async (body) => {
    const res = await fetch(API_URL, { method: "POST", body: JSON.stringify(body) });
    return res.json();
  };

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  // ── PIN 확인 ──
  const submitPin = () => {
    if (!allData) { setPinError("데이터 로딩 중입니다"); return; }
    const emp = allData.employees?.find(
      (e) => safeStr(e.pin) === pin && e.active !== false
    );
    if (!emp) {
      setPinError("PIN이 올바르지 않습니다");
      setPin("");
      return;
    }
    setEmployee(emp);
    setScreen("home");
    setPinError("");
    setPin("");
  };

  const handlePinKey = (k) => {
    if (k === "del") { setPin((p) => p.slice(0, -1)); return; }
    if (k === "ok") { submitPin(); return; }
    if (pin.length >= 6) return;
    setPin((p) => p + k);
  };

  // ── 오늘 데이터 ──
  const today = getDateString(new Date());

  const todaySchedule = useMemo(() => {
    if (!allData || !employee) return null;
    const s = allData.schedule?.find(
      (s) => normalizeDate(s.date) === today &&
             safeStr(s.employee_id) === safeStr(employee.employee_id)
    ) || null;
    // 스케줄 있으면 해당 파트로 기본 선택
    if (s?.part && !selectedPart) setSelectedPart(s.part);
    return s;
  }, [allData, employee, today]);

  const todayAttendance = useMemo(() => {
    if (!allData || !employee) return null;
    return allData.attendance?.find(
      (a) => normalizeDate(a.date) === today &&
             safeStr(a.employee_id) === safeStr(employee.employee_id)
    ) || null;
  }, [allData, employee, today]);

  // 상태 설계:
  // approved=false + check_in있음 + check_out없음 → 승인대기
  // approved=true  + check_in있음 + check_out없음 → 근무중
  // approved=true  + check_in있음 + check_out있음 → 퇴근완료
  // approved=false + check_out있음                → 비정상
  const att = todayAttendance;
  const isPending   = !!att?.check_in && !att?.check_out && String(att?.approved) !== "true";
  const isWorking   = !!att?.check_in && !att?.check_out && String(att?.approved) === "true";
  const isCheckedOut = !!att?.check_out && String(att?.approved) === "true";
  const isAbnormal  = !!att?.check_out && String(att?.approved) !== "true";
  const isCheckedIn = isWorking || isCheckedOut; // 승인된 상태만 출근 처리됨

  // ── 출근 ──
  const checkIn = async () => {
    if (isCheckedIn) return;
    if (!selectedPart) {
      showToast("파트를 먼저 선택해주세요", "err");
      return;
    }
    const checkInTime = nowTime();
    const tempId = "TMP_" + Date.now();

    // Optimistic update: 즉시 로컬 반영
    const newRecord = {
      attendance_id: tempId,
      employee_id: employee.employee_id,
      name: employee.name,
      date: today,
      part: selectedPart,
      check_in: checkInTime,
      check_out: "",
      break_min: 0,
      approved: false,
    };
    setAllData((prev) => ({
      ...prev,
      attendance: [...(prev?.attendance || []), newRecord],
    }));
    showToast("출근 요청 완료! 관리자 승인을 기다려주세요 ⏳");

    // 백그라운드 서버 저장 후 실제 ID로 교체
    post({
      action: "check_in",
      employee_id: employee.employee_id,
      name: employee.name,
      date: today,
      part: selectedPart,
      check_in: checkInTime,
    }).then(() => fetchAll()).catch(() => {
      showToast("서버 저장 실패, 다시 시도해주세요", "err");
      setAllData((prev) => ({
        ...prev,
        attendance: prev.attendance.filter((a) => a.attendance_id !== tempId),
      }));
    });
  };

  // ── 퇴근 ──
  const checkOut = async () => {
    if (!isWorking) return;
    const checkOutTime = nowTime();
    const attId = todayAttendance.attendance_id;

    // Optimistic update: 즉시 로컬 반영
    setAllData((prev) => ({
      ...prev,
      attendance: prev.attendance.map((a) =>
        a.attendance_id === attId ? { ...a, check_out: checkOutTime } : a
      ),
    }));
    showToast("퇴근 완료! 수고했어요 🎉");
    setTimeout(() => {
      setScreen("pin");
      setEmployee(null);
      setTab("today");
    }, 2500);

    // 백그라운드 서버 저장
    post({
      action: "check_out",
      attendance_id: attId,
      check_out: checkOutTime,
    }).then(() => fetchAll()).catch(() => {
      showToast("퇴근 저장 실패, 관리자에게 문의하세요", "err");
    });
  };

  // ── 근무 기록 (월별) ──
  const historyMonth = useMemo(() => {
    const base = new Date();
    base.setMonth(base.getMonth() + historyOffset);
    return getMonthRange(base);
  }, [historyOffset]);

  const myHistory = useMemo(() => {
    if (!allData || !employee) return [];
    return allData.attendance
      ?.filter((a) => {
        const d = normalizeDate(a.date);
        return (
          safeStr(a.employee_id) === safeStr(employee.employee_id) &&
          d >= historyMonth.start &&
          d <= historyMonth.end &&
          a.check_in && a.check_out &&
          String(a.approved) === "true"  // 승인된 기록만 표시
        );
      })
      .sort((a, b) => normalizeDate(b.date).localeCompare(normalizeDate(a.date))) || [];
  }, [allData, employee, historyMonth]);

  const myHistoryTotals = useMemo(() => {
    const wage = Number(employee?.hourly_wage) || 0;
    let totalMin = 0;
    let totalPay = 0;
    myHistory.forEach((a) => {
      const min = calcWorkMinutes(a.check_in, a.check_out, a.break_min);
      const pay = calcPay(a.check_in, a.check_out, a.break_min, wage);
      totalMin += min;
      totalPay += pay;
    });
    return { totalMin, totalPay };
  }, [myHistory, employee]);

  // ── 오늘 근무 상태 텍스트 ──
  const statusInfo = useMemo(() => {
    if (isAbnormal)  return { label: "확인 필요", color: "#dc2626", bg: "#fee2e2" };
    if (isPending)   return { label: "승인 대기", color: "#d97706", bg: "#fffbeb" };
    if (!isCheckedIn) return { label: "출근 전",  color: "#6b7280", bg: "#f3f4f6" };
    if (isWorking)   return { label: "근무 중",   color: "#059669", bg: "#d1fae5" };
    return { label: "퇴근 완료", color: "#2563eb", bg: "#dbeafe" };
  }, [isAbnormal, isPending, isCheckedIn, isWorking]);

  // ── 오늘 예상 급여 ──
  const todayPay = useMemo(() => {
    if (!todayAttendance?.check_in || !todayAttendance?.check_out) return null;
    return calcPay(
      todayAttendance.check_in,
      todayAttendance.check_out,
      todayAttendance.break_min,
      employee?.hourly_wage
    );
  }, [todayAttendance, employee]);

  // ─────────────────────────────
  // PIN 화면
  // ─────────────────────────────
  if (screen === "pin") {
    return (
      <div className="s-root">
        <div className="pin-screen">
          <div className="pin-inner">
            <div className="pin-brand">DUNKIN'</div>
            <div className="pin-title">출퇴근 관리</div>
            <div className="pin-sub">PIN을 입력하세요</div>

            <div className="pin-display">
              {pin.length === 0
                ? <span className="pin-placeholder">• • • • • •</span>
                : Array.from({ length: pin.length }).map((_, i) => (
                    <span key={i} className="pin-dot">●</span>
                  ))
              }
            </div>

            {pinError && <div className="pin-error">{pinError}</div>}

            <div className="pinpad">
              {["1","2","3","4","5","6","7","8","9","del","0","ok"].map((k) => (
                <button
                  key={k}
                  className={`pin-key${k === "ok" ? " pin-ok" : ""}${k === "del" ? " pin-del" : ""}`}
                  onClick={() => handlePinKey(k)}
                >
                  {k === "del" ? "⌫" : k === "ok" ? "확인" : k}
                </button>
              ))}
            </div>

            {loading && <div className="pin-loading">서버 연결 중...</div>}
          </div>
        </div>
        <Styles />
      </div>
    );
  }

  // ─────────────────────────────
  // 홈 화면
  // ─────────────────────────────
  const todayLabel = (() => {
    const d = new Date();
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_KR[d.getDay()]})`;
  })();

  return (
    <div className="s-root">
      {toast && (
        <div className={`s-toast${toast.type === "err" ? " s-toast-err" : ""}`}>
          {toast.msg}
        </div>
      )}

      {/* 헤더 */}
      <header className="s-header">
        <div className="s-header-left">
          <div className="s-brand">DUNKIN'</div>
          <div className="s-emp-name">{employee.name}</div>
          <div className="s-today-label">{todayLabel}</div>
        </div>
        <div className="s-header-right">
          <div className="s-clock">{clock}</div>
          <div className="s-status-badge" style={{ background: statusInfo.bg, color: statusInfo.color }}>
            {statusInfo.label}
          </div>
          <button className="s-logout" onClick={() => { setScreen("pin"); setEmployee(null); setTab("today"); }}>
            로그아웃
          </button>
        </div>
      </header>

      {/* 탭 */}
      <div className="s-tabs">
        <button className={`s-tab${tab === "today" ? " active" : ""}`} onClick={() => setTab("today")}>
          오늘 근무
        </button>
        <button className={`s-tab${tab === "history" ? " active" : ""}`} onClick={() => setTab("history")}>
          근무 기록
        </button>
      </div>

      {/* ── 오늘 탭 ── */}
      {tab === "today" && (
        <div className="s-page">

          {/* 오늘 스케줄 카드 */}
          <div className="s-schedule-card">
            <div className="s-schedule-label">오늘 배정 근무</div>
            {todaySchedule ? (
              <div className="s-schedule-info">
                <span className="s-part-badge">{PART_LABEL[todaySchedule.part] || todaySchedule.part}</span>
                <span className="s-schedule-time">
                  {SHIFT_TIME[todaySchedule.part]?.start || todaySchedule.planned_start}
                  &nbsp;–&nbsp;
                  {SHIFT_TIME[todaySchedule.part]?.end || todaySchedule.planned_end}
                </span>
              </div>
            ) : (
              <div className="s-no-schedule">오늘 배정된 근무가 없습니다</div>
            )}
          </div>

          {/* 출근/퇴근 버튼 */}
          <div className="s-action-area">
            {isAbnormal && (
              <div className="s-pending-banner" style={{ background: "#1c0505", borderColor: "#991b1b" }}>
                <div className="s-pending-icon">⚠️</div>
                <div className="s-pending-text">
                  <strong style={{ color: "#f87171" }}>확인 필요</strong>
                  <span style={{ color: "#b91c1c" }}>관리자에게 문의해 주세요</span>
                </div>
              </div>
            )}
            {/* 파트 선택 — 출근 전에만 표시 */}
            {!isCheckedIn && !isPending && !isAbnormal && (
              <div className="s-part-select-wrap">
                <div className="s-part-select-label">📋 파트 선택 {todaySchedule ? "(배정됨)" : "(자율 선택)"}</div>
                <div className="s-part-btns">
                  {["open","middle","close"].map((p) => (
                    <button
                      key={p}
                      className={`s-part-btn${selectedPart === p ? " active" : ""}`}
                      onClick={() => setSelectedPart(p)}
                    >
                      <span className="s-part-btn-name">{PART_LABEL[p]}</span>
                      <span className="s-part-btn-time">
                        {SHIFT_TIME[p].start}–{SHIFT_TIME[p].end}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!isCheckedIn && !isPending && !isAbnormal && (
              <button
                className="s-checkin-btn"
                onClick={checkIn}
              >
                <span className="s-btn-icon">▶</span>
                <span>출근하기</span>
              </button>
            )}
            {isPending && (
              <div className="s-pending-banner">
                <div className="s-pending-icon">⏳</div>
                <div className="s-pending-text">
                  <strong>승인 대기 중</strong>
                  <span>관리자가 출근을 승인하면 근무가 시작됩니다</span>
                </div>
                <div className="s-pending-time">{formatTime(todayAttendance.check_in)} 요청</div>
              </div>
            )}
            {isWorking && (
              <button
                className="s-checkout-btn"
                onClick={checkOut}
              >
                <span className="s-btn-icon">■</span>
                <span>퇴근하기</span>
              </button>
            )}
            {isCheckedOut && (
              <div className="s-done-banner">
                ✅ 오늘 근무 완료
              </div>
            )}
          </div>

          {/* 오늘 출퇴근 기록 */}
          {isCheckedIn && (
            <div className="s-card">
              <div className="s-card-title">오늘 기록</div>
              <div className="s-time-row">
                <div className="s-time-item">
                  <span className="s-time-label">출근</span>
                  <strong className="s-time-val">{formatTime(todayAttendance.check_in)}</strong>
                </div>
                <div className="s-time-sep">→</div>
                <div className="s-time-item">
                  <span className="s-time-label">퇴근</span>
                  <strong className="s-time-val" style={{ color: isCheckedOut ? "#111827" : "#9ca3af" }}>
                    {isCheckedOut ? formatTime(todayAttendance.check_out) : "--"}
                  </strong>
                </div>
                {isCheckedOut && (
                  <>
                    <div className="s-time-sep">=</div>
                    <div className="s-time-item">
                      <span className="s-time-label">근무 시간</span>
                      <strong className="s-time-val">
                        {(calcWorkMinutes(todayAttendance.check_in, todayAttendance.check_out, todayAttendance.break_min) / 60).toFixed(1)}h
                      </strong>
                    </div>
                  </>
                )}
              </div>
              {todayPay !== null && (
                <div className="s-pay-row">
                  <span>오늘 예상 급여</span>
                  <strong>{fmtKRW(todayPay)}</strong>
                </div>
              )}
            </div>
          )}

          {/* 이번달 누적 요약 */}
          <div className="s-card">
            <div className="s-card-title">이번달 누적</div>
            <div className="s-summary-grid">
              <div className="s-summary-item">
                <span>근무 일수</span>
                <strong>
                  {allData?.attendance?.filter(
                    (a) => safeStr(a.employee_id) === safeStr(employee.employee_id) &&
                           normalizeDate(a.date) >= getMonthRange().start &&
                           normalizeDate(a.date) <= getMonthRange().end &&
                           a.check_in && a.check_out &&
                           String(a.approved) === "true"
                  ).length || 0}일
                </strong>
              </div>
              <div className="s-summary-item">
                <span>시급</span>
                <strong>{fmtKRW(employee.hourly_wage)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 기록 탭 ── */}
      {tab === "history" && (
        <div className="s-page">
          {/* 월 선택 */}
          <div className="s-month-nav">
            <button
              className={`s-month-chip${historyOffset === -1 ? " active" : ""}`}
              onClick={() => setHistoryOffset(-1)}
            >
              지난달
            </button>
            <button
              className={`s-month-chip${historyOffset === 0 ? " active" : ""}`}
              onClick={() => setHistoryOffset(0)}
            >
              이번달
            </button>
          </div>

          {/* 월 합계 */}
          <div className="s-month-summary">
            <div className="s-month-title">{historyMonth.label} 근무 내역</div>
            <div className="s-month-totals">
              <div className="s-total-item">
                <span>총 근무일</span>
                <strong>{myHistory.length}일</strong>
              </div>
              <div className="s-total-item">
                <span>총 근무시간</span>
                <strong>{(myHistoryTotals.totalMin / 60).toFixed(1)}h</strong>
              </div>
              <div className="s-total-item accent">
                <span>예상 급여</span>
                <strong>{fmtKRW(myHistoryTotals.totalPay)}</strong>
              </div>
            </div>
          </div>

          {/* 기록 리스트 */}
          <div className="s-history-list">
            {myHistory.length === 0 ? (
              <div className="s-empty">{historyMonth.label} 근무 기록이 없습니다</div>
            ) : (
              myHistory.map((a) => {
                const min = calcWorkMinutes(a.check_in, a.check_out, a.break_min);
                const pay = calcPay(a.check_in, a.check_out, a.break_min, employee.hourly_wage);
                const d = new Date(normalizeDate(a.date));
                return (
                  <div className="s-history-row" key={a.attendance_id || `${a.date}-${a.check_in}`}>
                    <div className="s-hist-left">
                      <div className="s-hist-date">
                        {(d.getMonth() + 1)}/{d.getDate()}
                        <span className="s-hist-day">({DAY_KR[d.getDay()]})</span>
                      </div>
                      <div className="s-hist-part">{PART_LABEL[a.part] || a.part || "-"}</div>
                    </div>
                    <div className="s-hist-mid">
                      <div className="s-hist-times">
                        {formatTime(a.check_in)} – {formatTime(a.check_out)}
                      </div>
                      <div className="s-hist-hours">{(min / 60).toFixed(1)}시간</div>
                    </div>
                    <div className="s-hist-pay">{fmtKRW(pay)}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <Styles />
    </div>
  );
}

function Styles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');

      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      body {
        font-family: 'Nunito', 'Noto Sans KR', sans-serif;
        background: #0f1117;
        color: #111827;
        -webkit-font-smoothing: antialiased;
      }

      button { border: none; cursor: pointer; font-family: inherit; }

      /* ── ROOT ── */
      .s-root {
        min-height: 100vh;
        background: #0f1117;
      }

      /* ════════════════════════
         PIN 화면
      ════════════════════════ */
      .pin-screen {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #0f1117;
        padding: 24px;
      }

      .pin-inner {
        width: 100%;
        max-width: 340px;
        text-align: center;
      }

      .pin-brand {
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 0.25em;
        color: #f97316;
        margin-bottom: 8px;
      }

      .pin-title {
        font-size: 30px;
        font-weight: 900;
        color: #fff;
        margin-bottom: 6px;
      }

      .pin-sub {
        font-size: 14px;
        color: #6b7280;
        margin-bottom: 28px;
      }

      .pin-display {
        background: #1a1d27;
        border: 1.5px solid #2a2d3a;
        border-radius: 20px;
        padding: 20px 24px;
        min-height: 72px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        margin-bottom: 10px;
      }

      .pin-placeholder {
        font-size: 22px;
        color: #374151;
        letter-spacing: 0.3em;
      }

      .pin-dot {
        font-size: 20px;
        color: #f97316;
        animation: pop 0.12s ease;
      }

      @keyframes pop {
        0% { transform: scale(0.5); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
      }

      .pin-error {
        font-size: 13px;
        color: #f87171;
        font-weight: 700;
        margin-bottom: 12px;
        animation: shake 0.3s ease;
      }

      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-8px); }
        75% { transform: translateX(8px); }
      }

      .pinpad {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
        margin-top: 16px;
      }

      .pin-key {
        padding: 20px 0;
        border-radius: 16px;
        background: #1a1d27;
        border: 1.5px solid #2a2d3a;
        color: #e5e7eb;
        font-size: 22px;
        font-weight: 800;
        transition: all 0.1s;
      }

      .pin-key:active {
        background: #252838;
        transform: scale(0.95);
      }

      .pin-ok {
        background: #f97316 !important;
        border-color: #f97316 !important;
        color: #fff !important;
        font-size: 15px !important;
      }

      .pin-ok:active { background: #ea6b0a !important; }

      .pin-del {
        background: #1f2129 !important;
        color: #9ca3af !important;
        font-size: 18px !important;
      }

      .pin-loading {
        margin-top: 16px;
        font-size: 12px;
        color: #4b5563;
      }

      /* ════════════════════════
         홈 화면
      ════════════════════════ */
      .s-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 20px 20px 0;
      }

      .s-brand {
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.2em;
        color: #f97316;
        margin-bottom: 2px;
      }

      .s-emp-name {
        font-size: 22px;
        font-weight: 900;
        color: #fff;
        line-height: 1.2;
      }

      .s-today-label {
        font-size: 12px;
        color: #6b7280;
        margin-top: 2px;
      }

      .s-header-right {
        text-align: right;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 6px;
      }

      .s-clock {
        font-size: 28px;
        font-weight: 900;
        color: #fff;
        letter-spacing: -0.02em;
        font-variant-numeric: tabular-nums;
      }

      .s-status-badge {
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 800;
      }

      .s-logout {
        background: transparent;
        color: #4b5563;
        font-size: 12px;
        padding: 0;
        text-decoration: underline;
      }

      /* ── 탭 ── */
      .s-tabs {
        display: flex;
        gap: 0;
        padding: 16px 20px 0;
        border-bottom: 1px solid #1f2330;
        margin-top: 16px;
      }

      .s-tab {
        padding: 10px 20px;
        background: transparent;
        color: #4b5563;
        font-size: 14px;
        font-weight: 700;
        border-bottom: 2px solid transparent;
        transition: all 0.15s;
      }

      .s-tab.active {
        color: #f97316;
        border-bottom-color: #f97316;
      }

      /* ── 페이지 ── */
      .s-page {
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      /* ── 스케줄 카드 ── */
      .s-schedule-card {
        background: #1a1d27;
        border: 1.5px solid #2a2d3a;
        border-radius: 18px;
        padding: 16px 18px;
      }

      .s-schedule-label {
        font-size: 11px;
        font-weight: 800;
        color: #4b5563;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        margin-bottom: 10px;
      }

      .s-schedule-info {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .s-part-badge {
        padding: 5px 14px;
        border-radius: 20px;
        background: #f97316;
        color: #fff;
        font-size: 14px;
        font-weight: 800;
      }

      .s-schedule-time {
        font-size: 20px;
        font-weight: 800;
        color: #fff;
        letter-spacing: 0.02em;
      }

      .s-no-schedule {
        font-size: 14px;
        color: #4b5563;
      }

      /* ── 파트 선택 ── */
      .s-part-select-wrap {
        background: #1a1d27;
        border: 1.5px solid #2a2d3a;
        border-radius: 18px;
        padding: 16px 18px;
      }

      .s-part-select-label {
        font-size: 11px;
        font-weight: 800;
        color: #4b5563;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        margin-bottom: 12px;
      }

      .s-part-btns {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
      }

      .s-part-btn {
        padding: 14px 8px;
        border-radius: 14px;
        background: #0f1117;
        border: 1.5px solid #2a2d3a;
        color: #9ca3af;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        transition: all 0.15s;
      }

      .s-part-btn.active {
        background: #f97316;
        border-color: #f97316;
        color: #fff;
      }

      .s-part-btn-name {
        font-size: 16px;
        font-weight: 900;
      }

      .s-part-btn-time {
        font-size: 11px;
        font-weight: 600;
        opacity: 0.8;
      }

      /* ── 출근/퇴근 버튼 ── */
      .s-action-area {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .s-checkin-btn,
      .s-checkout-btn {
        width: 100%;
        padding: 22px;
        border-radius: 20px;
        font-size: 20px;
        font-weight: 900;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 14px;
        transition: all 0.15s;
      }

      .s-checkin-btn {
        background: #f97316;
        color: #fff;
      }

      .s-checkin-btn:active { background: #ea6b0a; transform: scale(0.98); }
      .s-checkin-btn:disabled { opacity: 0.5; }

      .s-checkout-btn {
        background: #1f2330;
        border: 2px solid #374151;
        color: #e5e7eb;
      }

      .s-checkout-btn:active { transform: scale(0.98); }
      .s-checkout-btn:disabled { opacity: 0.5; }

      .s-btn-icon {
        font-size: 18px;
      }

      .s-done-banner {
        width: 100%;
        padding: 20px;
        border-radius: 20px;
        background: #052e16;
        border: 1.5px solid #166534;
        color: #4ade80;
        font-size: 18px;
        font-weight: 800;
        text-align: center;
      }

      .s-pending-banner {
        width: 100%;
        padding: 20px;
        border-radius: 20px;
        background: #1c1505;
        border: 1.5px solid #854d0e;
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .s-pending-icon {
        font-size: 28px;
        flex-shrink: 0;
        animation: pulse 1.5s ease-in-out infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }

      .s-pending-text {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .s-pending-text strong {
        font-size: 16px;
        font-weight: 900;
        color: #fbbf24;
      }

      .s-pending-text span {
        font-size: 12px;
        color: #92400e;
        font-weight: 600;
      }

      .s-pending-time {
        font-size: 12px;
        color: #78350f;
        font-weight: 700;
        white-space: nowrap;
      }

      /* ── 기록 카드 ── */
      .s-card {
        background: #1a1d27;
        border: 1.5px solid #2a2d3a;
        border-radius: 18px;
        padding: 16px 18px;
      }

      .s-card-title {
        font-size: 11px;
        font-weight: 800;
        color: #4b5563;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        margin-bottom: 14px;
      }

      .s-time-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 12px;
        flex-wrap: wrap;
      }

      .s-time-item {
        flex: 1;
        min-width: 70px;
      }

      .s-time-label {
        display: block;
        font-size: 11px;
        color: #6b7280;
        margin-bottom: 4px;
      }

      .s-time-val {
        font-size: 20px;
        font-weight: 900;
        color: #fff;
        display: block;
      }

      .s-time-sep {
        color: #374151;
        font-size: 18px;
        font-weight: 700;
        flex-shrink: 0;
      }

      .s-pay-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 12px;
        background: #0f1117;
        border-radius: 12px;
        border: 1px solid #1f2330;
      }

      .s-pay-row span {
        font-size: 13px;
        color: #6b7280;
      }

      .s-pay-row strong {
        font-size: 18px;
        font-weight: 900;
        color: #f97316;
      }

      /* ── 이번달 요약 ── */
      .s-summary-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
      }

      .s-summary-item {
        padding: 12px;
        background: #0f1117;
        border-radius: 12px;
        border: 1px solid #1f2330;
      }

      .s-summary-item span {
        display: block;
        font-size: 11px;
        color: #6b7280;
        margin-bottom: 6px;
      }

      .s-summary-item strong {
        font-size: 18px;
        font-weight: 900;
        color: #fff;
      }

      /* ════════════════════════
         기록 탭
      ════════════════════════ */
      .s-month-nav {
        display: flex;
        gap: 8px;
      }

      .s-month-chip {
        padding: 8px 18px;
        border-radius: 20px;
        background: #1a1d27;
        border: 1.5px solid #2a2d3a;
        color: #6b7280;
        font-size: 14px;
        font-weight: 700;
        transition: all 0.15s;
      }

      .s-month-chip.active {
        background: #f97316;
        border-color: #f97316;
        color: #fff;
      }

      .s-month-summary {
        background: #1a1d27;
        border: 1.5px solid #2a2d3a;
        border-radius: 18px;
        padding: 16px 18px;
      }

      .s-month-title {
        font-size: 15px;
        font-weight: 800;
        color: #fff;
        margin-bottom: 14px;
      }

      .s-month-totals {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
      }

      .s-total-item {
        padding: 12px 10px;
        background: #0f1117;
        border-radius: 12px;
        border: 1px solid #1f2330;
        text-align: center;
      }

      .s-total-item span {
        display: block;
        font-size: 10px;
        color: #6b7280;
        margin-bottom: 6px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .s-total-item strong {
        font-size: 16px;
        font-weight: 900;
        color: #fff;
      }

      .s-total-item.accent strong {
        color: #f97316;
      }

      /* ── 기록 리스트 ── */
      .s-history-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .s-history-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        background: #1a1d27;
        border: 1.5px solid #2a2d3a;
        border-radius: 14px;
      }

      .s-hist-left {
        min-width: 54px;
      }

      .s-hist-date {
        font-size: 15px;
        font-weight: 900;
        color: #fff;
      }

      .s-hist-day {
        font-size: 11px;
        color: #6b7280;
        margin-left: 2px;
      }

      .s-hist-part {
        margin-top: 2px;
        font-size: 11px;
        font-weight: 700;
        color: #f97316;
      }

      .s-hist-mid {
        flex: 1;
      }

      .s-hist-times {
        font-size: 13px;
        font-weight: 700;
        color: #9ca3af;
      }

      .s-hist-hours {
        margin-top: 2px;
        font-size: 12px;
        color: #4b5563;
      }

      .s-hist-pay {
        font-size: 15px;
        font-weight: 900;
        color: #fff;
        text-align: right;
        white-space: nowrap;
      }

      /* ── TOAST ── */
      .s-toast {
        position: fixed;
        bottom: 28px;
        left: 50%;
        transform: translateX(-50%);
        background: #f97316;
        color: #fff;
        padding: 14px 24px;
        border-radius: 14px;
        font-size: 14px;
        font-weight: 800;
        z-index: 9999;
        white-space: nowrap;
        box-shadow: 0 8px 24px rgba(249, 115, 22, 0.4);
        animation: slideUp 0.25s ease;
      }

      .s-toast-err { background: #dc2626 !important; box-shadow: 0 8px 24px rgba(220,38,38,0.4) !important; }

      @keyframes slideUp {
        from { transform: translateX(-50%) translateY(16px); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
      }

      /* ── EMPTY ── */
      .s-empty {
        text-align: center;
        padding: 32px;
        color: #4b5563;
        font-size: 14px;
        background: #1a1d27;
        border-radius: 14px;
        border: 1.5px solid #2a2d3a;
      }
    `}</style>
  );
}