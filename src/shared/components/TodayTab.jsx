import React, { useMemo } from "react";
import {
  getApprovalReasonLabel,
  getApprovalStatusLabel,
  getAttendanceStatus,
  ATTENDANCE_STATUS,
} from "../hooks/useApi";
import "./TodayTab.css";

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
    case "middle_a":
      return "미들A";
    case "middle_b":
      return "미들B";
    case "close":
      return "마감";
    case "extra":
      return "추가";
    case "unscheduled":
      return "비정규";
    default:
      return part || "-";
  }
}

function StatCard({ title, count, children }) {
  return (
    <section className="today-card">
      <div className="today-card-header">
        <h3>{title}</h3>
        <span className="today-card-count">{count}</span>
      </div>
      <div className="today-card-body">{children}</div>
    </section>
  );
}

function EmptyState({ text }) {
  return <div className="today-empty">{text}</div>;
}

function StatusBadge({ status }) {
  return (
    <span className={`today-badge status-${status || "default"}`}>
      {getApprovalStatusLabel(status)}
    </span>
  );
}

function ReasonBadge({ reason }) {
  return (
    <span className={`today-badge reason-${reason || "default"}`}>
      {getApprovalReasonLabel(reason)}
    </span>
  );
}

function PersonRow({ title, subtitle, right, extra }) {
  return (
    <div className="today-row">
      <div className="today-row-main">
        <div className="today-row-title">{title}</div>
        {subtitle ? <div className="today-row-subtitle">{subtitle}</div> : null}
        {extra ? <div className="today-row-extra">{extra}</div> : null}
      </div>
      {right ? <div className="today-row-right">{right}</div> : null}
    </div>
  );
}

function hasMatchingSchedule(attendanceRow, scheduleList) {
  return scheduleList.some((scheduleRow) => {
    if (
      attendanceRow.schedule_id &&
      scheduleRow.schedule_id &&
      String(attendanceRow.schedule_id) === String(scheduleRow.schedule_id)
    ) {
      return true;
    }

    return (
      String(scheduleRow.employee_id || "") === String(attendanceRow.employee_id || "") &&
      String(scheduleRow.date || "") === String(attendanceRow.date || "") &&
      String(scheduleRow.part || "") === String(attendanceRow.part || "")
    );
  });
}

const EXTENSION_REASONS = new Set([
  "next_part_late_extension",
  "next_part_no_show_extension",
]);

/**
 * selectTodayState
 * 순수 함수 — 컴포넌트 외부에서 분류 로직 전체를 처리.
 */
function selectTodayState(scheduleList, attendanceList, employeeList) {
  // ── attendance 분류 (status 기준 단일 패스) ─────────────
  const workingNow = [];
  const attentionOpenList = [];
  const normalPending = [];
  const extensionPending = [];

  for (const row of attendanceList) {
    const status = getAttendanceStatus(row);

    if (status === ATTENDANCE_STATUS.WORKING) {
      workingNow.push(row);
      continue;
    }

    if (status === ATTENDANCE_STATUS.PENDING) {
      attentionOpenList.push(row);
      continue;
    }

    if (status === ATTENDANCE_STATUS.CLOSED && row.approval_status === "pending") {
      if (EXTENSION_REASONS.has(row.approval_reason)) {
        extensionPending.push(row);
      } else {
        normalPending.push(row);
      }
    }
  }

  return {
    workingNow,
    attentionOpenList,
    normalPending,
    extensionPending,
  };
}

export default function TodayTab(props) {
  const { todaySchedule, todayAttendance, employees, onApprove, onReject } = props;

  // 컴포넌트 최상단에서 safeArray를 감싸 useMemo 내부 및 렌더링 스코프에서 동일 참조 유지
  const scheduleList = useMemo(() => safeArray(todaySchedule), [todaySchedule]);
  const attendanceList = useMemo(() => safeArray(todayAttendance), [todayAttendance]);
  const employeeList = useMemo(() => safeArray(employees), [employees]);

  // 외부 순수 함수 호출 및 올바른 의존성 배열 매핑 (eslint 경고 없음)
  const {
    workingNow,
    attentionOpenList,
    normalPending,
    extensionPending,
  } = useMemo(
    () => selectTodayState(scheduleList, attendanceList, employeeList),
    [scheduleList, attendanceList, employeeList]
  );

  return (
    <div className="today-tab">
      <div className="today-overview">
        <StatCard title="현재 근무중" count={workingNow.length}>
          {workingNow.length === 0 ? (
            <EmptyState text="현재 정상 근무 중인 직원이 없습니다." />
          ) : (
            workingNow.map((row, idx) => (
              <PersonRow
                key={row.attendance_id || `working-${idx}`}
                title={`${row.name || "-"} · ${getPartLabel(row.part)}`}
                subtitle={`실제 ${timeRange(row.check_in, row.check_out || "")}`}
                extra={`지급 ${timeRange(row.paid_check_in, row.paid_check_out || "")}`}
                right={<StatusBadge status={row.approval_status} />}
              />
            ))
          )}
        </StatCard>

        <StatCard title="확인필요" count={attentionOpenList.length}>
          {attentionOpenList.length === 0 ? (
            <EmptyState text="즉시 확인이 필요한 열린 기록이 없습니다." />
          ) : (
            attentionOpenList.map((row, idx) => {
              const matchedSchedule = hasMatchingSchedule(row, scheduleList);

              return (
                <div className="today-approval-item" key={row.attendance_id || `attention-${idx}`}>
                  <PersonRow
                    title={`${row.name || "-"} · ${getPartLabel(row.part)}`}
                    subtitle={`실제 ${timeRange(row.check_in, row.check_out || "")}`}
                    extra={
                      <>
                        <div>예정 {timeRange(row.planned_start, row.planned_end)}</div>
                        <div>지급 {timeRange(row.paid_check_in, row.paid_check_out || "")}</div>
                        {!matchedSchedule ? (
                          <div className="today-note">
                            오늘 스케줄과 매칭되지 않는 열린 근무 기록입니다.
                          </div>
                        ) : null}
                        {row.approval_note ? (
                          <div className="today-note">{row.approval_note}</div>
                        ) : null}
                      </>
                    }
                    right={
                      <div className="today-inline-badges">
                        <span className="today-badge warning">확인필요</span>
                        {row.approval_reason ? <ReasonBadge reason={row.approval_reason} /> : null}
                      </div>
                    }
                  />

                  {(onApprove || onReject) && (
                    <div className="today-actions">
                      {onApprove ? (
                        <button
                          type="button"
                          className="today-btn approve"
                          onClick={() => onApprove(row)}
                        >
                          승인
                        </button>
                      ) : null}
                      {onReject ? (
                        <button
                          type="button"
                          className="today-btn reject"
                          onClick={() => onReject(row)}
                        >
                          거절
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </StatCard>
      </div>

      <div className="today-overview">
        <StatCard title="승인대기" count={normalPending.length}>
          {normalPending.length === 0 ? (
            <EmptyState text="현재 승인대기 건이 없습니다." />
          ) : (
            normalPending.map((row, idx) => (
              <div className="today-approval-item" key={row.attendance_id || `pending-${idx}`}>
                <PersonRow
                  title={`${row.name || "-"} · ${getPartLabel(row.part)}`}
                  subtitle={`예정 ${timeRange(row.planned_start, row.planned_end)}`}
                  extra={
                    <>
                      <div>실제 {timeRange(row.check_in, row.check_out)}</div>
                      <div>지급 {timeRange(row.paid_check_in, row.paid_check_out)}</div>
                      {row.approval_note ? (
                        <div className="today-note">{row.approval_note}</div>
                      ) : null}
                    </>
                  }
                  right={<ReasonBadge reason={row.approval_reason} />}
                />

                {(onApprove || onReject) && (
                  <div className="today-actions">
                    {onApprove ? (
                      <button
                        type="button"
                        className="today-btn approve"
                        onClick={() => onApprove(row)}
                      >
                        승인
                      </button>
                    ) : null}
                    {onReject ? (
                      <button
                        type="button"
                        className="today-btn reject"
                        onClick={() => onReject(row)}
                      >
                        거절
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            ))
          )}
        </StatCard>

        <StatCard title="연장 요청" count={extensionPending.length}>
          {extensionPending.length === 0 ? (
            <EmptyState text="자동 연장 요청이 없습니다." />
          ) : (
            extensionPending.map((row, idx) => (
              <div className="today-approval-item" key={row.attendance_id || `extension-${idx}`}>
                <PersonRow
                  title={`${row.name || "-"} · ${getPartLabel(row.part)}`}
                  subtitle={`원래 퇴근 ${row.planned_end || "-"}`}
                  extra={
                    <>
                      <div>요청 지급 퇴근 {row.paid_check_out || "-"}</div>
                      <div>연장 {Number(row.extension_min || 0)}분</div>
                      {row.approval_note ? (
                        <div className="today-note">{row.approval_note}</div>
                      ) : null}
                    </>
                  }
                  right={<ReasonBadge reason={row.approval_reason} />}
                />

                {(onApprove || onReject) && (
                  <div className="today-actions">
                    {onApprove ? (
                      <button
                        type="button"
                        className="today-btn approve"
                        onClick={() => onApprove(row)}
                      >
                        승인
                      </button>
                    ) : null}
                    {onReject ? (
                      <button
                        type="button"
                        className="today-btn reject"
                        onClick={() => onReject(row)}
                      >
                        거절
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            ))
          )}
        </StatCard>
      </div>
    </div>
  );
}