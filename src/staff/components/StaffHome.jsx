import React, { useEffect, useMemo, useState } from "react";
import { getApprovalReasonLabel, getApprovalStatusLabel } from "../../shared/hooks/useApi";

/* ================================================================
   순수 유틸
================================================================ */
function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function timeRange(start, end) {
  return `${start || "-"} ~ ${end || "-"}`;
}

function toMin(t) {
  const [h, m] = String(t || "")
    .split(":")
    .map(Number);
  return Number.isNaN(h) || Number.isNaN(m) ? null : h * 60 + m;
}

function getPartLabel(part) {
  const map = {
    open: "오픈",
    middle: "미들",
    close: "마감",
    extra: "추가",
    unscheduled: "비정규",
    대타: "대타",
  };
  return map[String(part || "").toLowerCase()] ?? part ?? "-";
}

/* ================================================================
   schedule 전용 계산 — attendance 데이터 절대 참조 금지
================================================================ */

/** 지금 시각 기준 가장 적합한 스케줄 1개 (없으면 null) */
function pickDisplaySchedule(scheduleList) {
  if (!scheduleList.length) return null;

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  const withRange = scheduleList
    .map((r) => ({ ...r, _start: toMin(r.planned_start), _end: toMin(r.planned_end) }))
    .filter((r) => r._start !== null && r._end !== null);

  return (
    withRange.find((r) => nowMin >= r._start && nowMin < r._end) ||
    [...withRange].filter((r) => r._start >= nowMin).sort((a, b) => a._start - b._start)[0] ||
    [...withRange].sort((a, b) => a._start - b._start)[0] ||
    null
  );
}

/** 현재 출근 가능한 파트 후보 (±30분 버퍼) */
function getCandidates(scheduleList) {
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  return scheduleList.filter((r) => {
    const s = toMin(r.planned_start);
    const e = toMin(r.planned_end);
    return s !== null && e !== null && nowMin >= s - 30 && nowMin <= e + 30;
  });
}

/* ================================================================
   attendance 전용 계산 — schedule 데이터 절대 참조 금지
================================================================ */

/** 현재 열린(미퇴근) attendance */
function getOpenAttendance(list) {
  return list.find((r) => r.check_in && !r.check_out) || null;
}

/** 오늘 가장 최근 attendance */
function getLatestAttendance(list) {
  if (!list.length) return null;
  return [...list].sort((a, b) => {
    const ka = `${a.date || ""} ${a.check_in || ""}`;
    const kb = `${b.date || ""} ${b.check_in || ""}`;
    return kb.localeCompare(ka);
  })[0];
}

/* ================================================================
   상태 메시지 — schedule/attendance 각자 상태에서 조합
================================================================ */
function buildHeroMessage({ hasSchedule, openAtt, latestAtt }) {
  if (openAtt) {
    if (openAtt.approval_status === "pending") {
      return `${getApprovalReasonLabel(openAtt.approval_reason)} 상태입니다. 관리자 확인 후 확정됩니다.`;
    }
    return "현재 근무 중입니다.";
  }

  if (latestAtt?.check_out) {
    if (latestAtt.approval_status === "pending") {
      return `${getApprovalReasonLabel(latestAtt.approval_reason)} 상태입니다. 관리자 확인 후 확정됩니다.`;
    }
    if (latestAtt.approval_status === "rejected") {
      return "관리자 확인 결과 조정된 기록이 있습니다.";
    }
    return "오늘 근무가 종료되었습니다.";
  }

  if (hasSchedule) return "스케줄이 등록되어 있습니다. 출근 버튼을 눌러 시작하세요.";
  return "오늘 등록된 스케줄이 없습니다. 출근 버튼으로 기록할 수 있습니다.";
}

/* ================================================================
   서브 컴포넌트
================================================================ */
function StatusBadge({ status }) {
  return (
    <span className={`staff-state-badge status-${status || "default"}`}>
      {getApprovalStatusLabel(status)}
    </span>
  );
}

function InfoCard({ title, children }) {
  return (
    <section className="staff-card">
      <div className="staff-card-header">
        <h3>{title}</h3>
      </div>
      <div className="staff-card-body">{children}</div>
    </section>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="staff-info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

/* ================================================================
   메인
================================================================ */
export default function StaffHome({
  employee = null,
  todaySchedule = [],
  todayAttendance = [],
  onCheckIn,
  onCheckOut,
  checking = false,
}) {
  const scheduleList = safeArray(todaySchedule);
  const attendanceList = safeArray(todayAttendance);

  // ── schedule 파생 (attendance 참조 없음) ───────────────────────
  const displaySchedule = useMemo(() => pickDisplaySchedule(scheduleList), [scheduleList]);
  const candidates = useMemo(() => getCandidates(scheduleList), [scheduleList]);
  const hasSchedule = scheduleList.length > 0;

  // ── attendance 파생 (schedule 참조 없음) ───────────────────────
  const openAttendance = useMemo(() => getOpenAttendance(attendanceList), [attendanceList]);
  const latestAttendance = useMemo(() => getLatestAttendance(attendanceList), [attendanceList]);
  const hasAttendance = attendanceList.length > 0;

  // ── 출퇴근 가능 여부 (schedule 없어도 체크인 항상 가능) ─────────
  const canCheckIn = !openAttendance && !checking;
  const canCheckOut = !!openAttendance && !checking;

  // ── 파트 선택 state ────────────────────────────────────────────
  const [selectedPart, setSelectedPart] = useState("");

  useEffect(() => {
    if (candidates.length === 1) {
      setSelectedPart(candidates[0].part || "");
      return;
    }
    if (candidates.length === 0) {
      setSelectedPart("");
      return;
    }
    if (!candidates.some((r) => r.part === selectedPart)) setSelectedPart("");
  }, [candidates, selectedPart]);

  // ── 히어로 배지: attendance 상태가 있을 때만 표시 ─────────────
  const heroBadgeStatus =
    openAttendance?.approval_status || latestAttendance?.approval_status || null;

  const heroMessage = buildHeroMessage({
    hasSchedule,
    openAtt: openAttendance,
    latestAtt: latestAttendance,
  });

  // ── 체크인 ─────────────────────────────────────────────────────
  const handleCheckIn = async () => {
    if (!onCheckIn || !employee?.employee_id) return;

    if (candidates.length > 1 && !selectedPart) {
      alert("겹치는 시간대입니다. 출근할 파트를 선택해주세요.");
      return;
    }

    const finalPart = selectedPart || (candidates.length === 1 ? candidates[0].part : "");
    const noSchedule = !hasSchedule || !finalPart;

    await onCheckIn({
      employee_id: employee.employee_id,
      name: employee.name,
      part: noSchedule ? "unscheduled" : finalPart,
      is_substitute: noSchedule,
      approval_required: noSchedule,
    });
  };

  // ── 체크아웃 ────────────────────────────────────────────────────
  const handleCheckOut = async () => {
    if (!onCheckOut || !employee?.employee_id || !openAttendance) return;
    await onCheckOut({
      employee_id: employee.employee_id,
      attendance_id: openAttendance.attendance_id,
      date: openAttendance.date,
    });
  };

  return (
    <div className="staff-home">
      <section className="staff-hero-card">
        <div className="staff-hero-top">
          <div>
            <div className="staff-hero-label">오늘 근무 상태</div>
            <h2 className="staff-hero-name">{employee?.name || "직원"}</h2>
          </div>
          {heroBadgeStatus && <StatusBadge status={heroBadgeStatus} />}
        </div>

        <p className="staff-hero-message">{heroMessage}</p>

        <div className="staff-hero-meta">
          <div className="staff-meta-item">
            <span className="staff-meta-label">오늘 파트</span>
            <strong>
              {hasSchedule ? getPartLabel(displaySchedule?.part) : "오늘 스케줄 없음"}
            </strong>
          </div>
          <div className="staff-meta-item">
            <span className="staff-meta-label">예정 시간</span>
            <strong>
              {hasSchedule
                ? timeRange(displaySchedule?.planned_start, displaySchedule?.planned_end)
                : "-"}
            </strong>
          </div>
        </div>

        {candidates.length > 1 && canCheckIn && (
          <div className="staff-part-picker">
            <div className="staff-part-picker-label">출근 파트 선택</div>
            <div className="staff-part-picker-buttons">
              {candidates.map((r) => (
                <button
                  key={`${r.part}-${r.schedule_id || r.employee_id}`}
                  type="button"
                  className={`staff-part-btn ${selectedPart === r.part ? "active" : ""}`}
                  onClick={() => setSelectedPart(r.part || "")}
                >
                  {getPartLabel(r.part)} · {timeRange(r.planned_start, r.planned_end)}
                </button>
              ))}
            </div>
            <div className="staff-part-picker-help">
              겹치는 시간대라 파트를 직접 선택해야 합니다.
            </div>
          </div>
        )}

        {!hasSchedule && canCheckIn && (
          <div className="staff-note-box" style={{ marginTop: 14 }}>
            오늘 스케줄이 없는 상태로 출근하면 <strong>승인대기</strong>로 기록됩니다. 관리자 확인
            후 확정됩니다.
          </div>
        )}

        <div className="staff-actions">
          <button
            type="button"
            className="staff-action-btn primary"
            onClick={handleCheckIn}
            disabled={!canCheckIn}
          >
            출근
          </button>
          <button
            type="button"
            className="staff-action-btn secondary"
            onClick={handleCheckOut}
            disabled={!canCheckOut}
          >
            퇴근
          </button>
        </div>
      </section>

      <div className="staff-home-grid">
        <InfoCard title="오늘 스케줄">
          {hasSchedule ? (
            <div className="staff-info-list">
              <InfoRow label="파트" value={getPartLabel(displaySchedule?.part)} />
              <InfoRow
                label="예정 시간"
                value={timeRange(displaySchedule?.planned_start, displaySchedule?.planned_end)}
              />
              {scheduleList.length > 1 && (
                <InfoRow label="총 파트 수" value={`${scheduleList.length}개`} />
              )}
            </div>
          ) : (
            <div className="staff-empty">오늘 등록된 스케줄이 없습니다.</div>
          )}
        </InfoCard>

        <InfoCard title="오늘 근태 기록">
          {hasAttendance ? (
            <AttendanceSummary attendance={openAttendance || latestAttendance} />
          ) : (
            <div className="staff-empty">오늘 기록이 아직 없습니다.</div>
          )}
        </InfoCard>
      </div>

      {!hasSchedule && hasAttendance && (
        <section className="staff-card">
          <div className="staff-card-body">
            <div className="notice">
              오늘 스케줄 외 출근 기록이 있습니다.
              <br />
              관리자 승인 후 근태가 확정됩니다.
            </div>
          </div>
        </section>
      )}

      <InfoCard title="안내">
        <ul className="staff-guide-list">
          <li>하루에 여러 번 출근할 수 있습니다. 퇴근 후 다시 출근도 가능합니다.</li>
          <li>근무 중일 때만 퇴근 버튼이 활성화됩니다.</li>
          <li>지각, 조기퇴근, 추가근무는 관리자 확인 후 최종 확정됩니다.</li>
          <li>스케줄 없이 출근하면 승인대기 상태로 기록됩니다.</li>
          <li>겹치는 시간대에는 출근 파트를 직접 선택해야 합니다.</li>
          <li>표시된 지급 기준 시간은 실제 근무시간과 다를 수 있습니다.</li>
        </ul>
      </InfoCard>
    </div>
  );
}

/* ── attendance 요약 (schedule 참조 없음) ─────────────────────── */
function AttendanceSummary({ attendance }) {
  if (!attendance) return null;

  return (
    <div className="staff-info-list">
      <InfoRow label="상태" value={getApprovalStatusLabel(attendance.approval_status)} />
      {attendance.approval_reason && (
        <InfoRow label="사유" value={getApprovalReasonLabel(attendance.approval_reason)} />
      )}
      <InfoRow label="실제 시간" value={timeRange(attendance.check_in, attendance.check_out)} />
      <InfoRow
        label="예정 시간"
        value={timeRange(attendance.planned_start, attendance.planned_end)}
      />
      <InfoRow label="휴게" value={`${Number(attendance.break_min || 0)}분`} />
      {attendance.approval_note && <div className="staff-note-box">{attendance.approval_note}</div>}
    </div>
  );
}
