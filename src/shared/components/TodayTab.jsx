// src/shared/components/TodayTab.jsx
// UTF-8 — 한글 깨짐 주의
//
// 실제 필드명 기준 (useApi.js / GAS 응답 확인):
//   attendance : attendance_id, employee_id, name, date,
//                check_in, check_out, part, approved (bool/string),
//                is_substitute (bool/string), schedule_id,
//                needs_approval (bool/string), break_min, memo
//   schedule   : schedule_id, employee_id, name, date,
//                part, planned_start, planned_end
//
// 절대 규칙:
//   - TodayTab 내부 fetch 금지 — 모든 데이터는 props 수신
//   - todayAttendance / schedule(전체) 을 props 로 받음
//   - monthAttendance 사용 금지
//   - schedule 과 attendance 필드 혼용 금지
//   - optimistic overwrite 금지 (승인은 onApprove 콜백으로 위임)

import "./TodayTab.css";
import { useMemo } from "react";
import { AUTO_CHECKOUT_GRACE_MIN, PART_LABEL } from "../constants";
import { normalizeDate, formatTime, toBool } from "../utils";
import { SectionTitle } from "./UI";

// ── 내부 헬퍼 ────────────────────────────────────────────────────────────────

/** "HH:MM" → 분(number) | null */
function toMin(t) {
  const m = String(t || "").match(/(\d+):(\d+)/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 현재 시각 → 분(number) */
function nowMin() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

/** 두 시각 사이 경과 문자열 ("N시간 M분" | "M분") */
function elapsedLabel(checkIn) {
  if (!checkIn) return "";
  const inMin = toMin(checkIn);
  if (inMin === null) return "";
  const diff = nowMin() - inMin;
  if (diff < 0) return "";
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h > 0) return `${h}시간 ${m}분 경과`;
  return `${m}분 경과`;
}

// ── 섹션 래퍼 ────────────────────────────────────────────────────────────────
function Section({ color, title, count, empty, children }) {
  return (
    <div className="today-section">
      <div className="today-section-header" style={{ borderLeftColor: color }}>
        <span className="today-section-title">{title}</span>
        <span className="today-section-count" style={{ background: color }}>
          {count}
        </span>
      </div>
      {count === 0 ? (
        <p className="today-empty">{empty}</p>
      ) : (
        <div className="today-cards">{children}</div>
      )}
    </div>
  );
}

// ── 근무중 / 승인대기 / 자동퇴근 예정 카드 ─────────────────────────────────
//   attendance row 기반
function AttCard({ a, schedule, onApprove, showElapsed = false }) {
  // GAS는 boolean을 문자열 "true"/"false"로 내려주기도 함 → toBool 사용
  const approved = toBool(a.approved);
  const isSub = toBool(a.is_substitute);
  // schedule_id 없거나 part === "extra" → 스케줄 외 출근
  const isExtra = !a.schedule_id || a.part === "extra";

  // 지각 판단
  const isLate = (() => {
    if (!a.check_in || !a.planned_start) return false;
    const [ph, pm] = String(a.planned_start).split(":").map(Number);
    const [ch, cm] = String(a.check_in).split(":").map(Number);
    const planned = ph * 60 + pm;
    const checkin = ch * 60 + cm;
    return checkin - planned > 5;
  })();

  return (
    <div className="today-card">
      <div className="today-card-left">
        {/* name: GAS가 attendance에 직접 포함해 내려줌 */}
        <strong className="today-name">{a.name || a.employee_id}</strong>

        <div className="today-badges">
          {isSub && <span className="today-badge today-badge-sub">대타</span>}
          {isExtra && !isSub && <span className="today-badge today-badge-extra">스케줄외</span>}
          {isLate && <span className="today-badge today-badge-late">지각</span>}
          {!approved && <span className="today-badge today-badge-pending">미승인</span>}
        </div>

        {/* 파트 */}
        {a.part && (
          <span className="today-time" style={{ marginLeft: 2 }}>
            {PART_LABEL[a.part] || a.part}
          </span>
        )}
      </div>

      <div className="today-card-right">
        {/* 예정 시간과 실제 시간 */}
        <div className="time-block">
          {schedule && (
            <div className="planned-time">
              예정 {schedule.planned_start || "--:--"} ~ {schedule.planned_end || "--:--"}
            </div>
          )}
          <div className="actual-time">
            실제 {formatTime(a.check_in) || "--:--"}
            {a.check_out ? ` ~ ${formatTime(a.check_out)}` : " 출근"}
          </div>
        </div>

        {showElapsed && !a.check_out && (
          <span className="today-time" style={{ color: "#059669" }}>
            {elapsedLabel(a.check_in)}
          </span>
        )}

        {/* 승인 / 반려 버튼 — approved !== true 인 경우만 */}
        {!approved && onApprove && (
          <div className="approve-actions">
            <button type="button" className="approve-btn" onClick={() => onApprove(a, true)}>
              승인
            </button>
            <button type="button" className="reject-btn" onClick={() => onApprove(a, false)}>
              반려
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 미출근 카드 ──────────────────────────────────────────────────────────────
//   schedule row 기반 — attendance 필드 절대 혼용 금지
function AbsentCard({ s, isScheduled }) {
  const isLateNoShow = (() => {
    if (!s.planned_start) return false;

    const now = new Date();
    const [hh, mm] = s.planned_start.split(":").map(Number);

    const planned = hh * 60 + mm;
    const current = now.getHours() * 60 + now.getMinutes();

    return current - planned > 15;
  })();

  return (
    <div
      className={`today-card${isScheduled ? "" : " today-card-absent"}${isLateNoShow ? " warning" : ""}`}
    >
      <div className="today-card-left">
        {/* schedule.name 이 없으면 employee_id 표시 */}
        <strong className="today-name">{s.name || s.employee_id}</strong>
        <span
          className="today-badge"
          style={
            isScheduled
              ? { background: "#e5e7eb", color: "#6b7280" }
              : { background: "#fee2e2", color: "#991b1b" }
          }
        >
          {isScheduled ? "출근 예정" : "미출근"}
        </span>
      </div>
      <div className="today-card-right">
        <span className="today-time">
          {PART_LABEL[s.part] || s.part || "-"}
          {"  "}
          {/* schedule 필드: planned_start / planned_end */}
          {s.planned_start || ""}
          {s.planned_end ? ` ~ ${s.planned_end}` : ""}
        </span>
      </div>
    </div>
  );
}

// ── 자동퇴근 예정 카드 (강조 스타일) ─────────────────────────────────────────
function AutoCard({ a, schedule, onApprove, onAutoCheckout }) {
  const approved = toBool(a.approved);
  const isSub = toBool(a.is_substitute);

  return (
    <div className="today-card" style={{ borderColor: "#c4b5fd", background: "#faf5ff" }}>
      <div className="today-card-left">
        <strong className="today-name">{a.name || a.employee_id}</strong>
        <div className="today-badges">
          {isSub && <span className="today-badge today-badge-sub">대타</span>}
          <span className="today-badge" style={{ background: "#ede9fe", color: "#6d28d9" }}>
            자동퇴근 예정
          </span>
          {!approved && <span className="today-badge today-badge-pending">미승인</span>}
        </div>
        <span className="today-time">{elapsedLabel(a.check_in)}</span>
      </div>
      <div className="today-card-right">
        <div className="time-block">
          {schedule && (
            <div className="planned-time">
              예정 {schedule.planned_start || "--:--"} ~ {schedule.planned_end || "--:--"}
            </div>
          )}
          <div className="actual-time">{formatTime(a.check_in)} → 근무중</div>
        </div>
        {!approved && onApprove && (
          <div className="approve-actions">
            <button type="button" className="approve-btn" onClick={() => onApprove(a, true)}>
              승인
            </button>
            <button type="button" className="reject-btn" onClick={() => onApprove(a, false)}>
              반려
            </button>
          </div>
        )}
        {onAutoCheckout && (
          <button type="button" className="auto-checkout-btn" onClick={() => onAutoCheckout(a)}>
            자동퇴근
          </button>
        )}
      </div>
    </div>
  );
}

// ── 메인 TodayTab ─────────────────────────────────────────────────────────────
/**
 * props
 *   todayAttendance  {array}    오늘 attendance 배열 (GAS admin_today 응답)
 *                               → monthAttendance 절대 사용 금지
 *   schedule         {array}    전체 schedule 배열 (이번달+저번달 병합)
 *                               → useApi 의 schedule state
 *   employees        {array}    직원 배열 (필요 시 보조용; name은 attendance에 포함)
 *   onApprove        {function} (att, true) → approveAttendance 콜백
 */
export function TodayTab({
  todayAttendance = [],
  schedule = [],
  employees = [],
  onApprove,
  onAutoCheckout,
}) {
  const now = nowMin();
  const todayStr = useMemo(() => normalizeDate(new Date()), []);

  // ── 오늘 스케줄만 필터 (schedule 배열에서)
  const todaySchedules = useMemo(
    () => schedule.filter((s) => normalizeDate(s.date) === todayStr),
    [schedule, todayStr],
  );

  // ── 오늘 check_in 있는 employee_id Set (미출근 판단용)
  const checkedInIds = useMemo(
    () => new Set(todayAttendance.filter((a) => a.check_in).map((a) => String(a.employee_id))),
    [todayAttendance],
  );

  // ── Summary 계산
  const summary = useMemo(() => {
    const scheduleEmployeeIds = new Set(todaySchedules.map((s) => String(s.employee_id)));

    const workingAttendances = todayAttendance.filter((a) => a.check_in && !a.check_out);

    const absentSchedules = todaySchedules.filter((s) => !checkedInIds.has(String(s.employee_id)));

    const substituteCount = todayAttendance.filter(
      (a) => toBool(a.is_substitute) || String(a.part).toLowerCase() === "extra",
    ).length;

    const lateCount = todayAttendance.filter((a) => {
      if (!a.check_in || !a.planned_start) return false;

      const [ph, pm] = String(a.planned_start).split(":").map(Number);
      const [ch, cm] = String(a.check_in).split(":").map(Number);

      const planned = ph * 60 + pm;
      const checkin = ch * 60 + cm;

      return checkin - planned > 5;
    }).length;

    return {
      total: scheduleEmployeeIds.size,
      working: workingAttendances.length,
      absent: absentSchedules.length,
      substitute: substituteCount,
      late: lateCount,
    };
  }, [todaySchedules, checkedInIds, todayAttendance]);

  // ── 1. 현재 근무중: check_in O, check_out X
  const working = useMemo(
    () => todayAttendance.filter((a) => a.check_in && !a.check_out),
    [todayAttendance],
  );

  // ── 2. 승인대기: approved !== true
  //    대타·스케줄외 우선 정렬
  const pending = useMemo(() => {
    const list = todayAttendance.filter((a) => !toBool(a.approved));
    return [...list].sort((a, b) => {
      const priority = (x) =>
        toBool(x.is_substitute) || x.part === "extra" || !x.schedule_id ? 0 : 1;
      return priority(a) - priority(b);
    });
  }, [todayAttendance]);

  // ── 3. 미출근 / 예정
  //    오늘 스케줄 기준 — 출근 안 한 사람
  //    planned_start 지나면 "미출근", 아직이면 "출근 예정"
  const absentList = useMemo(() => {
    return todaySchedules
      .filter((s) => !checkedInIds.has(String(s.employee_id)))
      .map((s) => {
        const planned = toMin(s.planned_start); // schedule 필드
        const isScheduled = planned === null || now <= planned;
        return { s, isScheduled };
      });
  }, [todaySchedules, checkedInIds, now]);

  // ── 4. 자동퇴근 예정
  //    check_in O, check_out X, planned_end + AUTO_CHECKOUT_GRACE_MIN 초과
  const autoCheckout = useMemo(() => {
    return todayAttendance.filter((a) => {
      if (!a.check_in || a.check_out) return false;
      const sched = todaySchedules.find((s) => String(s.employee_id) === String(a.employee_id));
      if (!sched) return false;
      const end = toMin(sched.planned_end); // schedule 필드
      return end !== null && now > end + AUTO_CHECKOUT_GRACE_MIN;
    });
  }, [todayAttendance, todaySchedules, now]);

  return (
    <div className="page">
      <div className="card">
        <SectionTitle>오늘 현황 — {todayStr}</SectionTitle>

        {/* Summary Bar */}
        <div className="today-summary-bar">
          <div className="summary-item">
            <span className="summary-label">전체</span>
            <strong>{summary.total}명</strong>
          </div>

          <div className="summary-item">
            <span className="summary-label">근무중</span>
            <strong>{summary.working}명</strong>
          </div>

          <div className="summary-item">
            <span className="summary-label">미출근</span>
            <strong>{summary.absent}명</strong>
          </div>

          <div className="summary-item subtle">
            <span>대타 {summary.substitute}건</span>
            <span>지각 {summary.late}건</span>
          </div>
        </div>

        <div className="today-grid">
          {/* 1. 현재 근무중 */}
          <Section
            color="#10b981"
            title="🟢 현재 근무중"
            count={working.length}
            empty="현재 근무중인 직원이 없습니다"
          >
            {working.map((a) => {
              const sched = todaySchedules.find(
                (s) => String(s.employee_id) === String(a.employee_id),
              );
              return (
                <AttCard
                  key={a.attendance_id || `${a.employee_id}-in`}
                  a={a}
                  schedule={sched}
                  onApprove={onApprove}
                  showElapsed
                />
              );
            })}
          </Section>

          {/* 2. 승인대기 */}
          <Section
            color="#f59e0b"
            title="🟡 승인대기"
            count={pending.length}
            empty="승인 대기 기록이 없습니다"
          >
            {pending.map((a) => {
              const sched = todaySchedules.find(
                (s) => String(s.employee_id) === String(a.employee_id),
              );
              return (
                <AttCard
                  key={a.attendance_id || `${a.employee_id}-pend`}
                  a={a}
                  schedule={sched}
                  onApprove={onApprove}
                />
              );
            })}
          </Section>

          {/* 3. 미출근 / 예정 */}
          <Section
            color="#ef4444"
            title="🔴 미출근 / 예정"
            count={absentList.length}
            empty="미출근 직원이 없습니다"
          >
            {absentList.map(({ s, isScheduled }) => (
              <AbsentCard
                key={s.schedule_id || `${s.employee_id}-abs`}
                s={s}
                isScheduled={isScheduled}
              />
            ))}
          </Section>

          {/* 4. 자동퇴근 예정 */}
          <Section
            color="#8b5cf6"
            title="⏰ 자동퇴근 예정"
            count={autoCheckout.length}
            empty="자동퇴근 예정 직원이 없습니다"
          >
            {autoCheckout.map((a) => {
              const sched = todaySchedules.find(
                (s) => String(s.employee_id) === String(a.employee_id),
              );
              return (
                <AutoCard
                  key={a.attendance_id || `${a.employee_id}-auto`}
                  a={a}
                  schedule={sched}
                  onApprove={onApprove}
                  onAutoCheckout={onAutoCheckout}
                />
              );
            })}
          </Section>
        </div>
      </div>
    </div>
  );
}
