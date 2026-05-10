import React, { useMemo } from "react";
import { getApprovalReasonLabel, getApprovalStatusLabel } from "../hooks/useApi";
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

export default function TodayTab(props) {
  const { todaySchedule = [], todayAttendance = [], employees = [], onApprove, onReject } = props;

  const scheduleList = safeArray(todaySchedule);
  const attendanceList = safeArray(todayAttendance);
  const employeeList = safeArray(employees);

  const employeeMap = useMemo(() => {
    return employeeList.reduce((acc, emp) => {
      acc[String(emp.employee_id)] = emp;
      return acc;
    }, {});
  }, [employeeList]);

  const workingNow = useMemo(() => {
    return attendanceList.filter((row) => row.check_in && !row.check_out);
  }, [attendanceList]);

  const pendingList = useMemo(() => {
    return attendanceList.filter((row) => row.approval_status === "pending");
  }, [attendanceList]);

  const extensionPending = useMemo(() => {
    return pendingList.filter((row) => row.approval_reason === "next_part_late_extension");
  }, [pendingList]);

  const normalPending = useMemo(() => {
    return pendingList.filter((row) => row.approval_reason !== "next_part_late_extension");
  }, [pendingList]);

  const todayScheduleIdSet = useMemo(() => {
    return new Set(attendanceList.map((row) => row.schedule_id).filter(Boolean));
  }, [attendanceList]);

  const absentList = useMemo(() => {
    return scheduleList.filter((row) => !todayScheduleIdSet.has(row.schedule_id));
  }, [scheduleList, todayScheduleIdSet]);

  const checkedInEmployeeIdSet = useMemo(() => {
    return new Set(attendanceList.map((row) => row.employee_id).filter(Boolean));
  }, [attendanceList]);

  const lateNoShowList = useMemo(() => {
    return absentList.map((row) => {
      const emp = employeeMap[String(row.employee_id)] || null;
      return {
        ...row,
        employee_name: row.name || emp?.name || "-",
      };
    });
  }, [absentList, employeeMap]);

  return (
    <div className="today-tab">
      <div className="today-overview">
        <StatCard title="현재 근무중" count={workingNow.length}>
          {workingNow.length === 0 ? (
            <EmptyState text="현재 근무 중인 직원이 없습니다." />
          ) : (
            workingNow.map((row) => (
              <PersonRow
                key={row.attendance_id}
                title={`${row.name || "-"} · ${getPartLabel(row.part)}`}
                subtitle={`실제 ${timeRange(row.check_in, row.check_out || "")}`}
                extra={`지급 ${timeRange(row.paid_check_in, row.paid_check_out || "")}`}
                right={<StatusBadge status={row.approval_status} />}
              />
            ))
          )}
        </StatCard>

        <StatCard title="승인대기" count={normalPending.length}>
          {normalPending.length === 0 ? (
            <EmptyState text="현재 승인대기 건이 없습니다." />
          ) : (
            normalPending.map((row) => (
              <div className="today-approval-item" key={row.attendance_id}>
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
      </div>

      <div className="today-overview">
        <StatCard title="다음 파트 지각 연장 요청" count={extensionPending.length}>
          {extensionPending.length === 0 ? (
            <EmptyState text="자동 연장 요청이 없습니다." />
          ) : (
            extensionPending.map((row) => (
              <div className="today-approval-item" key={row.attendance_id}>
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

        <StatCard title="미출근" count={lateNoShowList.length}>
          {lateNoShowList.length === 0 ? (
            <EmptyState text="오늘 미출근 예정자는 없습니다." />
          ) : (
            lateNoShowList.map((row) => (
              <PersonRow
                key={row.schedule_id}
                title={`${row.employee_name} · ${getPartLabel(row.part)}`}
                subtitle={`예정 ${timeRange(row.planned_start, row.planned_end)}`}
                extra={`스케줄 ID ${row.schedule_id || "-"}`}
                right={<span className="today-badge neutral">미출근</span>}
              />
            ))
          )}
        </StatCard>
      </div>

      <section className="today-card">
        <div className="today-card-header">
          <h3>오늘 스케줄 요약</h3>
          <span className="today-card-count">{scheduleList.length}</span>
        </div>
        <div className="today-card-body">
          {scheduleList.length === 0 ? (
            <EmptyState text="오늘 등록된 스케줄이 없습니다." />
          ) : (
            scheduleList.map((row) => {
              const checkedIn = checkedInEmployeeIdSet.has(String(row.employee_id));
              return (
                <PersonRow
                  key={row.schedule_id}
                  title={`${row.name || "-"} · ${getPartLabel(row.part)}`}
                  subtitle={timeRange(row.planned_start, row.planned_end)}
                  right={
                    <span className={`today-badge ${checkedIn ? "approved" : "neutral"}`}>
                      {checkedIn ? "출근기록 있음" : "대기"}
                    </span>
                  }
                />
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
