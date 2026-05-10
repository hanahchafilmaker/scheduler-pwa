import React, { useMemo } from "react";
import { getApprovalReasonLabel, getApprovalStatusLabel } from "../../shared/hooks/useApi";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function timeRange(start, end) {
  const s = start || "-";
  const e = end || "-";
  return `${s} ~ ${e}`;
}

function getPartLabel(part) {
  switch (String(part || "").toLowerCase()) {
    case "open":
      return "오픈";
    case "middle":
      return "미들";
    case "close":
      return "마감";
    case "extra":
      return "추가";
    default:
      return part || "-";
  }
}

function getOpenAttendance(attendanceList) {
  return attendanceList.find((row) => row.check_in && !row.check_out) || null;
}

function getLatestAttendance(attendanceList) {
  if (!attendanceList.length) return null;
  return [...attendanceList].sort((a, b) => {
    const aa = `${a.date || ""} ${a.check_in || ""}`;
    const bb = `${b.date || ""} ${b.check_in || ""}`;
    return bb.localeCompare(aa);
  })[0];
}

function getTodaySchedule(scheduleList, attendanceRow) {
  if (!scheduleList.length) return null;

  if (attendanceRow?.part) {
    const matched = scheduleList.find(
      (row) => String(row.part || "") === String(attendanceRow.part || ""),
    );
    if (matched) return matched;
  }

  return [...scheduleList].sort((a, b) => {
    const aa = (a.planned_start || "").replace(":", "");
    const bb = (b.planned_start || "").replace(":", "");
    return aa.localeCompare(bb);
  })[0];
}

function getStaffAttendanceMessage(row) {
  if (!row) return "오늘 근태 기록이 없습니다.";

  if (row.approval_status === "pending") {
    return `${getApprovalReasonLabel(row.approval_reason)} 상태입니다. 관리자 확인 후 확정됩니다.`;
  }

  if (row.approval_status === "rejected") {
    return "관리자 확인 결과 조정된 기록이 있습니다.";
  }

  if (row.check_in && !row.check_out) {
    return "현재 근무 중입니다.";
  }

  if (row.check_in && row.check_out) {
    return "오늘 근무가 종료되었습니다.";
  }

  return "근태 상태를 확인해주세요.";
}

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

export default function StaffHome(props) {
  const {
    employee = null,
    todaySchedule = [],
    todayAttendance = [],
    onCheckIn,
    onCheckOut,
    checking = false,
  } = props;

  const scheduleList = safeArray(todaySchedule);
  const attendanceList = safeArray(todayAttendance);

  const openAttendance = useMemo(() => getOpenAttendance(attendanceList), [attendanceList]);
  const latestAttendance = useMemo(() => getLatestAttendance(attendanceList), [attendanceList]);
  const displayAttendance = openAttendance || latestAttendance || null;

  const mainSchedule = useMemo(
    () => getTodaySchedule(scheduleList, displayAttendance),
    [scheduleList, displayAttendance],
  );

  const canCheckIn = !openAttendance;
  const canCheckOut = !!openAttendance;

  const employeeName = employee?.name || displayAttendance?.name || mainSchedule?.name || "직원";

  const handleCheckIn = async () => {
    if (!onCheckIn || !employee?.employee_id) return;

    await onCheckIn({
      employee_id: employee.employee_id,
      name: employee.name,
      part: mainSchedule?.part || "",
    });
  };

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
            <h2 className="staff-hero-name">{employeeName}</h2>
          </div>

          <StatusBadge status={displayAttendance?.approval_status || "approved"} />
        </div>

        <p className="staff-hero-message">{getStaffAttendanceMessage(displayAttendance)}</p>

        <div className="staff-hero-meta">
          <div className="staff-meta-item">
            <span className="staff-meta-label">오늘 파트</span>
            <strong>{getPartLabel(mainSchedule?.part || displayAttendance?.part || "-")}</strong>
          </div>

          <div className="staff-meta-item">
            <span className="staff-meta-label">예정시간</span>
            <strong>
              {timeRange(
                mainSchedule?.planned_start || displayAttendance?.planned_start,
                mainSchedule?.planned_end || displayAttendance?.planned_end,
              )}
            </strong>
          </div>
        </div>

        <div className="staff-actions">
          <button
            type="button"
            className="staff-action-btn primary"
            onClick={handleCheckIn}
            disabled={!canCheckIn || checking}
          >
            출근
          </button>

          <button
            type="button"
            className="staff-action-btn secondary"
            onClick={handleCheckOut}
            disabled={!canCheckOut || checking}
          >
            퇴근
          </button>
        </div>
      </section>

      <div className="staff-home-grid">
        <InfoCard title="오늘 스케줄">
          {mainSchedule ? (
            <div className="staff-info-list">
              <div className="staff-info-row">
                <span>파트</span>
                <strong>{getPartLabel(mainSchedule.part)}</strong>
              </div>
              <div className="staff-info-row">
                <span>예정 시간</span>
                <strong>{timeRange(mainSchedule.planned_start, mainSchedule.planned_end)}</strong>
              </div>
              <div className="staff-info-row">
                <span>직원 ID</span>
                <strong>{mainSchedule.employee_id || "-"}</strong>
              </div>
            </div>
          ) : (
            <div className="staff-empty">오늘 등록된 스케줄이 없습니다.</div>
          )}
        </InfoCard>

        <InfoCard title="오늘 근태 기록">
          {displayAttendance ? (
            <div className="staff-info-list">
              <div className="staff-info-row">
                <span>상태</span>
                <strong>{getApprovalStatusLabel(displayAttendance.approval_status)}</strong>
              </div>

              {displayAttendance.approval_reason ? (
                <div className="staff-info-row">
                  <span>사유</span>
                  <strong>{getApprovalReasonLabel(displayAttendance.approval_reason)}</strong>
                </div>
              ) : null}

              <div className="staff-info-row">
                <span>실제 시간</span>
                <strong>
                  {timeRange(displayAttendance.check_in, displayAttendance.check_out)}
                </strong>
              </div>

              <div className="staff-info-row">
                <span>지급 기준</span>
                <strong>
                  {timeRange(displayAttendance.paid_check_in, displayAttendance.paid_check_out)}
                </strong>
              </div>

              <div className="staff-info-row">
                <span>휴게시간</span>
                <strong>{Number(displayAttendance.break_min || 0)}분</strong>
              </div>

              {displayAttendance.approval_note ? (
                <div className="staff-note-box">{displayAttendance.approval_note}</div>
              ) : null}
            </div>
          ) : (
            <div className="staff-empty">오늘 기록이 아직 없습니다.</div>
          )}
        </InfoCard>
      </div>

      <InfoCard title="안내">
        <ul className="staff-guide-list">
          <li>하루에 여러 번 출근할 수 있습니다. 퇴근 후 다시 출근도 가능합니다.</li>
          <li>근무 중일 때만 퇴근 버튼이 활성화됩니다.</li>
          <li>지각, 조기퇴근, 추가근무는 관리자 확인 후 최종 확정됩니다.</li>
          <li>표시된 지급 기준 시간은 실제 근무시간과 다를 수 있습니다.</li>
        </ul>
      </InfoCard>
    </div>
  );
}
