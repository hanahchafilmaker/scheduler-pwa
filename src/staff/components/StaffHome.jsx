import React, { useEffect, useMemo, useState } from "react";
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
    case "substitute":
    case "대타":
      return "대타";
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

function toMin(t) {
  const [h, m] = String(t || "")
    .split(":")
    .map(Number);

  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function getTodaySchedule(scheduleList, attendanceRow) {
  if (!scheduleList.length) return null;

  if (attendanceRow?.part && attendanceRow?.check_in && !attendanceRow?.check_out) {
    const matched = scheduleList.find(
      (row) => String(row.part || "") === String(attendanceRow.part || ""),
    );
    if (matched) return matched;
  }

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const withRange = scheduleList
    .map((row) => ({
      ...row,
      _start: toMin(row.planned_start),
      _end: toMin(row.planned_end),
    }))
    .filter((row) => row._start !== null && row._end !== null);

  const currentMatch = withRange.find((row) => nowMin >= row._start && nowMin < row._end);
  if (currentMatch) return currentMatch;

  const upcoming = withRange
    .filter((row) => row._start >= nowMin)
    .sort((a, b) => a._start - b._start);

  if (upcoming.length) return upcoming[0];

  return withRange.sort((a, b) => a._start - b._start)[0] || null;
}

function getPartCandidates(scheduleList) {
  if (!scheduleList.length) return [];

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  return scheduleList.filter((row) => {
    const start = toMin(row.planned_start);
    const end = toMin(row.planned_end);

    if (start === null || end === null) return false;

    const bufferedStart = start - 30;
    const bufferedEnd = end + 30;

    return nowMin >= bufferedStart && nowMin <= bufferedEnd;
  });
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

  const candidateSchedules = useMemo(() => getPartCandidates(scheduleList), [scheduleList]);

  const [selectedPart, setSelectedPart] = useState("");
  const [selectedMode, setSelectedMode] = useState("normal"); // normal | substitute

  useEffect(() => {
    if (openAttendance) return;

    if (candidateSchedules.length === 1 && selectedMode === "normal") {
      setSelectedPart(candidateSchedules[0].part || "");
      return;
    }

    if (
      candidateSchedules.length > 1 &&
      selectedMode === "normal" &&
      !candidateSchedules.some((row) => String(row.part || "") === String(selectedPart || ""))
    ) {
      setSelectedPart("");
      return;
    }

    if (candidateSchedules.length === 0 && selectedMode === "normal") {
      setSelectedPart("");
    }
  }, [candidateSchedules, selectedPart, selectedMode, openAttendance]);

  const canCheckIn = !openAttendance;
  const canCheckOut = !!openAttendance;

  const employeeName = employee?.name || displayAttendance?.name || mainSchedule?.name || "직원";

  const showSchedulePicker = candidateSchedules.length > 1 && selectedMode === "normal";
  const showSubstituteOption = !openAttendance;

  const handleCheckIn = async () => {
    if (!onCheckIn || !employee?.employee_id) return;

    if (selectedMode === "substitute") {
      await onCheckIn({
        employee_id: employee.employee_id,
        name: employee.name,
        part: "대타",
        is_substitute: true,
      });
      return;
    }

    const autoPart = candidateSchedules.length === 1 ? candidateSchedules[0].part || "" : "";
    const finalPart = selectedPart || autoPart;

    if (candidateSchedules.length > 1 && !finalPart) {
      alert("겹치는 시간대입니다. 출근할 파트를 선택해주세요.");
      return;
    }

    await onCheckIn({
      employee_id: employee.employee_id,
      name: employee.name,
      ...(finalPart ? { part: finalPart } : {}),
      is_substitute: false,
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

        {showSubstituteOption ? (
          <div className="staff-part-picker">
            <div className="staff-part-picker-label">출근 방식 선택</div>
            <div className="staff-part-picker-buttons">
              <button
                type="button"
                className={`staff-part-btn ${selectedMode === "normal" ? "active" : ""}`}
                onClick={() => setSelectedMode("normal")}
              >
                일반 출근
              </button>
              <button
                type="button"
                className={`staff-part-btn ${selectedMode === "substitute" ? "active" : ""}`}
                onClick={() => setSelectedMode("substitute")}
              >
                대타 출근
              </button>
            </div>
            <div className="staff-part-picker-help">
              스케줄과 다르게 근무하는 경우에는 대타 출근으로 요청하세요.
            </div>
          </div>
        ) : null}

        {showSchedulePicker ? (
          <div className="staff-part-picker">
            <div className="staff-part-picker-label">출근 파트 선택</div>
            <div className="staff-part-picker-buttons">
              {candidateSchedules.map((row) => {
                const active = String(selectedPart || "") === String(row.part || "");

                return (
                  <button
                    key={`${row.part}-${row.schedule_id || row.employee_id}`}
                    type="button"
                    className={`staff-part-btn ${active ? "active" : ""}`}
                    onClick={() => {
                      setSelectedMode("normal");
                      setSelectedPart(row.part || "");
                    }}
                  >
                    {getPartLabel(row.part)} · {timeRange(row.planned_start, row.planned_end)}
                  </button>
                );
              })}
            </div>
            <div className="staff-part-picker-help">
              겹치는 시간대라 출근 파트를 직접 선택해야 합니다.
            </div>
          </div>
        ) : null}

        <div className="staff-actions">
          <button
            type="button"
            className="staff-action-btn primary"
            onClick={handleCheckIn}
            disabled={!canCheckIn || checking}
          >
            {selectedMode === "substitute" ? "대타 출근" : "출근"}
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
          <li>겹치는 시간대에는 출근 파트를 직접 선택해야 합니다.</li>
          <li>대타 출근은 승인대기로 접수되며 관리자 확인 후 확정됩니다.</li>
          <li>표시된 지급 기준 시간은 실제 근무시간과 다를 수 있습니다.</li>
        </ul>
      </InfoCard>
    </div>
  );
}
