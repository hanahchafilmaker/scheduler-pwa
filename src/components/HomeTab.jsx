import { useMemo } from "react";
import { PARTS, PART_LABEL, SHIFT_TIME, STATUS_BG, STATUS_COLOR } from "../constants";
import { normalizeDate, safeStr, formatTime, getStatus } from "../utils";

// ── Approval banner ───────────────────────────────────────────────────────────
function ApprovalBanner({ approvals, onApprove, onReject }) {
  if (!approvals.length) return null;
  return (
    <div className="pending-card card">
      <div className="pending-title">🔔 출근 승인 요청 {approvals.length}건</div>
      <div className="pending-list">
        {approvals.map((att) => (
          <div key={att.attendance_id} className="pending-row">
            <div className="pending-info">
              <strong>{att.name}</strong>
              <span className="pending-meta">
                {PART_LABEL[att.part] || att.part || "파트미정"} ·{" "}
                {formatTime(att.check_in)} 출근 요청
              </span>
            </div>
            <div className="pending-actions">
              <button className="approve-btn" onClick={() => onApprove(att)}>✓ 승인</button>
              <button className="reject-btn"  onClick={() => onReject(att)}>✕ 거절</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Per-employee row inside a part block ──────────────────────────────────────
function EmployeeRow({ s, att, status, shift, onApprove, onReject }) {
  const isPending = status === "승인대기";
  const isAbsent  = status === "미출근";
  const isLate    = status === "지각";
  const isDone    = !!att?.check_out;

  const rowClass = isPending ? "row-pending"
    : isAbsent ? "row-absent"
    : isLate   ? "row-late"
    : isDone   ? "row-done"
    : "row-working";

  return (
    <div className={`dash-emp-row ${rowClass}`}>
      <div className="dash-emp-name">{s.name}</div>
      <div className="dash-emp-times">
        <span className="dash-planned">{shift.start} 예정</span>
        {att?.check_in && (
          <span className="dash-actual">
            {formatTime(att.check_in)}
            {att.check_out ? ` – ${formatTime(att.check_out)}` : " ~"}
          </span>
        )}
      </div>
      <div className="dash-emp-status">
        {isPending ? (
          <div className="dash-approve-wrap">
            <span className="dash-badge pending">{formatTime(att.check_in)} 요청</span>
            <button className="dash-approve-btn" onClick={() => onApprove(att)}>✓ 승인</button>
            <button className="dash-reject-btn"  onClick={() => onReject(att)}>✕</button>
          </div>
        ) : (
          <span
            className="dash-badge"
            style={{
              background: STATUS_BG[status]    || "#f9fafb",
              color:      STATUS_COLOR[status] || "#374151",
            }}
          >
            {status}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Extra attendance row (not on schedule) ────────────────────────────────────
function ExtraRow({ a, onApprove, onReject }) {
  const isPending = a.check_in && !a.check_out && String(a.approved) !== "true";
  return (
    <div className={`dash-emp-row ${isPending ? "row-pending" : "row-extra"}`}>
      <div className="dash-emp-name">
        {a.name}
        {!isPending && <span className="extra-tag">추가</span>}
      </div>
      <div className="dash-emp-times">
        <span className="dash-actual">
          {formatTime(a.check_in)}
          {a.check_out ? ` – ${formatTime(a.check_out)}` : " ~"}
        </span>
      </div>
      <div className="dash-emp-status">
        {isPending ? (
          <div className="dash-approve-wrap">
            <span className="dash-badge pending">{formatTime(a.check_in)} 요청</span>
            <button className="dash-approve-btn" onClick={() => onApprove(a)}>✓ 승인</button>
            <button className="dash-reject-btn"  onClick={() => onReject(a)}>✕</button>
          </div>
        ) : (
          <span className="dash-badge" style={{ background: "#f5f3ff", color: "#7c3aed" }}>
            추가출근
          </span>
        )}
      </div>
    </div>
  );
}

// ── Part block ────────────────────────────────────────────────────────────────
function PartBlock({ part, todayAtt, todaySched, onApprove, onReject }) {
  const shift = SHIFT_TIME[part];

  const partAtt = todayAtt.filter((a) => a.part === part && a.check_in);

  const sched = todaySched
    .filter((s) => s.part === part)
    .filter((s, i, arr) =>
      arr.findIndex((x) => safeStr(x.employee_id) === safeStr(s.employee_id)) === i
    );

  const schedRows = sched.map((s) => {
    const att = partAtt.find((a) => safeStr(a.employee_id) === safeStr(s.employee_id));
    const status = !att
      ? "미출근"
      : (att.check_in && !att.check_out && String(att.approved) !== "true")
      ? "승인대기"
      : getStatus(s, att);
    return { s, att, status };
  });

  const extraAtt = partAtt.filter(
    (a) => !sched.some((s) => safeStr(s.employee_id) === safeStr(a.employee_id))
  );

  const isPendingAtt = (a) => a.check_in && !a.check_out && String(a.approved) !== "true";

  const hasPending =
    schedRows.some((r) => r.status === "승인대기") ||
    extraAtt.some((a) => isPendingAtt(a));

  const workingCount =
    schedRows.filter((r) => r.att?.check_in && !r.att?.check_out && r.status !== "승인대기").length +
    extraAtt.filter((a) => a.check_in && !a.check_out && !isPendingAtt(a)).length;

  return (
    <div className={`dash-part-block${hasPending ? " has-pending" : ""}`}>
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
        {schedRows.map(({ s, att, status }) => (
          <EmployeeRow
            key={s.schedule_id}
            s={s} att={att} status={status} shift={shift}
            onApprove={onApprove} onReject={onReject}
          />
        ))}
        {extraAtt.map((a) => (
          <ExtraRow key={a.attendance_id} a={a} onApprove={onApprove} onReject={onReject} />
        ))}
        {sched.length === 0 && extraAtt.length === 0 && (
          <div className="dash-empty-part">배정된 직원 없음</div>
        )}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function HomeTab({ attendance, schedule, today, onApprove, onReject }) {
  const todayAtt   = useMemo(() => attendance.filter((a) => normalizeDate(a.date) === today), [attendance, today]);
  const todaySched = useMemo(() => schedule.filter((s)   => normalizeDate(s.date) === today), [schedule, today]);
  const pending    = useMemo(() => todayAtt.filter((a)   => a.check_in && !a.check_out && String(a.approved) !== "true"), [todayAtt]);

  return (
    <div className="page">
      <ApprovalBanner approvals={pending} onApprove={onApprove} onReject={onReject} />
      {PARTS.map((part) => (
        <PartBlock
          key={part} part={part}
          todayAtt={todayAtt} todaySched={todaySched}
          onApprove={onApprove} onReject={onReject}
        />
      ))}
    </div>
  );
}