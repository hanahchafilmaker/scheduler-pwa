import React, { useEffect, useMemo, useState } from "react";
import { getApprovalReasonLabel, getApprovalStatusLabel } from "../../shared/domain/attendance/labels";
import {
  calcPayrollLateDeductMinutes,
  calcPayrollEarlyLeaveDeductMinutes,
  formatLateMinutes,
  formatEarlyLeaveMinutes,
} from "../../shared/domain/attendance/payroll/engine/payEngine";

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
    middle_a: "미들A",
    middle_b: "미들B",
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

/** 출근 시간 기준 오름차순 정렬 */
function sortByCheckIn(list) {
  return [...list].sort((a, b) => {
    const ka = `${a.date || ""} ${a.check_in || ""}`;
    const kb = `${b.date || ""} ${b.check_in || ""}`;
    return ka.localeCompare(kb);
  });
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
    if (latestAtt.approval_status === "auto_closed") {
      return "미퇴근으로 자동 종료 처리되었습니다. 관리자에게 문의하세요.";
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
  if (!status) return null;
  return (
    <span className={`staff-state-badge status-${status}`}>
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
  const sortedAttendance = useMemo(() => sortByCheckIn(attendanceList), [attendanceList]);
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
  // rejected 포함 모든 상태 표시
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
      {/* ── 히어로 카드 ── */}
      <section className="staff-hero-card">
        <div className="staff-hero-top">
          <div>
            <div className="staff-hero-label">오늘 근무 상태</div>
            <h2 className="staff-hero-name">{employee?.name || "직원"}</h2>
          </div>
          <StatusBadge status={heroBadgeStatus} />
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

        {/* 파트 겹침 선택 */}
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

        {/* 스케줄 없이 출근 안내 */}
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

      {/* ── 스케줄 + 근태 기록 그리드 ── */}
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
            // 여러 파트 근무 시 전체 목록 표시
            sortedAttendance.length === 1 ? (
              <AttendanceSummary attendance={sortedAttendance[0]} />
            ) : (
              <div className="staff-info-list">
                {sortedAttendance.map((att, idx) => (
                  <AttendanceSummary
                    key={att.attendance_id || idx}
                    attendance={att}
                    label={`${idx + 1}번째 근무`}
                  />
                ))}
              </div>
            )
          ) : (
            <div className="staff-empty">오늘 기록이 아직 없습니다.</div>
          )}
        </InfoCard>
      </div>

      {/* 스케줄 외 출근 안내 */}
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

      {/* 안내 */}
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

/* ================================================================
   AttendanceSummary
   attendance 원본 기록 표시 + 지각/조기퇴근 표기
   schedule 데이터 절대 참조 금지 — planned_* 는 attendance row 안에 있는 값만 사용
================================================================ */
function AttendanceSummary({ attendance, label }) {
  if (!attendance) return null;

  // 지각/조기퇴근은 pay.js 유틸로 계산 (허용 구간 자동 적용)
  // attendance 원본은 그대로 두고 표시 목적으로만 계산
  const lateMin = calcPayrollLateDeductMinutes(attendance);
  const earlyMin = calcPayrollEarlyLeaveDeductMinutes(attendance);

  const lateLabel  = formatLateMinutes(lateMin);       // "지각 12분" | null
  const earlyLabel = formatEarlyLeaveMinutes(earlyMin); // "조기퇴근 6분" | null

  // 근무중(미퇴근)이면 조기퇴근 표기 불필요
  const isOpen = attendance.check_in && !attendance.check_out;

  return (
    <div className="staff-info-list" style={label ? { paddingTop: 8 } : {}}>
      {label && (
        <div style={{ fontSize: 12, color: "var(--color-text-tertiary, #6b7280)", marginBottom: 4 }}>
          {label}
        </div>
      )}

      {/* 상태 행: 배지 + 지각/조기퇴근 인라인 표기 */}
      <div className="staff-info-row">
        <span>상태</span>
        <strong style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <StatusBadge status={attendance.approval_status} />
          {lateLabel && (
            <span className="staff-deduct-tag late">{lateLabel}</span>
          )}
          {!isOpen && earlyLabel && (
            <span className="staff-deduct-tag early">{earlyLabel}</span>
          )}
        </strong>
      </div>

      {attendance.approval_reason && (
        <InfoRow label="사유" value={getApprovalReasonLabel(attendance.approval_reason)} />
      )}

      <InfoRow label="실제 시간" value={timeRange(attendance.check_in, attendance.check_out)} />
      <InfoRow
        label="예정 시간"
        value={timeRange(attendance.planned_start, attendance.planned_end)}
      />
      <InfoRow label="휴게" value={`${Number(attendance.break_min || 0)}분`} />

      {attendance.approval_note && (
        <div className="staff-note-box">{attendance.approval_note}</div>
      )}
    </div>
  );
}