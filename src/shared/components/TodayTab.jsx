import "./TodayTab.css";
import { useMemo } from "react";
import { AUTO_CHECKOUT_GRACE_MIN, PART_LABEL } from "../constants";
import { normalizeDate, formatTime, toBool } from "../utils";
import { SectionTitle } from "./UI";

function toMin(t) {
  const m = String(t || "").match(/(\d+):(\d+)/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function nowMin() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

function Section({ color, title, count, empty, children }) {
  return (
    <div className="today-section">
      <div className="today-section-header" style={{ borderLeftColor: color }}>
        <span className="today-section-title">{title}</span>
        <span className="today-section-count" style={{ background: color }}>
          {count}
        </span>
      </div>
      {count === 0
        ? <p className="today-empty">{empty}</p>
        : <div className="today-cards">{children}</div>
      }
    </div>
  );
}

function AttCard({ a, onApprove }) {
  const approved = toBool(a.approved);
  const isSub    = toBool(a.is_substitute);

  return (
    <div className="today-card">
      <div className="today-card-left">
        <strong className="today-name">{a.name || a.employee_id}</strong>
        <div className="today-badges">
          {isSub && <span className="today-badge today-badge-sub">대타</span>}
          {a.part === "extra" && !isSub && (
            <span className="today-badge today-badge-extra">스케줄외</span>
          )}
          {!approved && (
            <span className="today-badge today-badge-pending">미승인</span>
          )}
        </div>
      </div>
      <div className="today-card-right">
        <span className="today-time">
          {formatTime(a.check_in) || "-"}
          {" → "}
          {a.check_out ? formatTime(a.check_out) : "근무중"}
        </span>
        {!approved && onApprove && (
          <button
            type="button"
            className="approve-btn"
            onClick={() => onApprove(a, true)}
          >
            승인
          </button>
        )}
      </div>
    </div>
  );
}

function AbsentCard({ s }) {
  return (
    <div className="today-card today-card-absent">
      <div className="today-card-left">
        <strong className="today-name">{s.name || s.employee_id}</strong>
        <span className="today-badge today-badge-absent">미출근</span>
      </div>
      <div className="today-card-right">
        <span className="today-time">
          {PART_LABEL[s.part] || s.part || "-"}
          {"  "}
          {s.planned_start || ""}
          {s.planned_end ? ` ~ ${s.planned_end}` : ""}
        </span>
      </div>
    </div>
  );
}

export function TodayTab({ todayAttendance = [], schedule = [], employees = [], onApprove }) {
  const now = nowMin();

  const todayStr = useMemo(() => normalizeDate(new Date()), []);

  const todaySchedules = useMemo(
    () => schedule.filter((s) => normalizeDate(s.date) === todayStr),
    [schedule, todayStr],
  );

  const checkedInIds = useMemo(
    () => new Set(
      todayAttendance.filter((a) => a.check_in).map((a) => String(a.employee_id))
    ),
    [todayAttendance],
  );

  const working = useMemo(
    () => todayAttendance.filter((a) => a.check_in && !a.check_out),
    [todayAttendance],
  );

  const pending = useMemo(() => {
    const list = todayAttendance.filter((a) => !toBool(a.approved));
    return [...list].sort((a, b) => {
      const pri = (x) =>
        (toBool(x.is_substitute) || x.part === "extra" || !x.schedule_id) ? 0 : 1;
      return pri(a) - pri(b);
    });
  }, [todayAttendance]);

  const absent = useMemo(
    () =>
      todaySchedules.filter((s) => {
        const planned = toMin(s.planned_start);
        return planned !== null && now > planned && !checkedInIds.has(String(s.employee_id));
      }),
    [todaySchedules, checkedInIds, now],
  );

  const autoCheckout = useMemo(
    () =>
      todayAttendance.filter((a) => {
        if (!a.check_in || a.check_out) return false;
        const sched = todaySchedules.find(
          (s) => String(s.employee_id) === String(a.employee_id),
        );
        if (!sched) return false;
        const end = toMin(sched.planned_end);
        return end !== null && now > end + AUTO_CHECKOUT_GRACE_MIN;
      }),
    [todayAttendance, todaySchedules, now],
  );

  return (
    <div className="page">
      <div className="card">
        <SectionTitle>오늘 현황 — {todayStr}</SectionTitle>
        <div className="today-grid">
          <Section color="#10b981" title="🟢 현재 근무중" count={working.length} empty="현재 근무중인 직원이 없습니다">
            {working.map((a) => (
              <AttCard key={a.attendance_id || `${a.employee_id}-in`} a={a} onApprove={onApprove} />
            ))}
          </Section>
          <Section color="#f59e0b" title="🟡 승인대기" count={pending.length} empty="승인 대기 기록이 없습니다">
            {pending.map((a) => (
              <AttCard key={a.attendance_id || `${a.employee_id}-pend`} a={a} onApprove={onApprove} />
            ))}
          </Section>
          <Section color="#ef4444" title="🔴 미출근" count={absent.length} empty="미출근 직원이 없습니다">
            {absent.map((s) => (
              <AbsentCard key={s.schedule_id || `${s.employee_id}-abs`} s={s} />
            ))}
          </Section>
          <Section color="#8b5cf6" title="⏰ 자동퇴근 예정" count={autoCheckout.length} empty="자동퇴근 예정 직원이 없습니다">
            {autoCheckout.map((a) => (
              <AttCard key={a.attendance_id || `${a.employee_id}-auto`} a={a} onApprove={onApprove} />
            ))}
          </Section>
        </div>
      </div>
    </div>
  );
}