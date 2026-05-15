import React, { useMemo } from "react";
import {
  getApprovalReasonLabel,
  getApprovalStatusLabel,
} from "../domain/attendance/labels";
import {
  getAttendanceStatus,
  ATTENDANCE_STATUS,
} from "../domain/attendance/getAttendanceStatus";
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
      return "";
    case "middle_a":
      return "A";
    case "middle_b":
      return "B";
    case "close":
      return "";
    case "extra":
      return "";
    case "unscheduled":
      return "";
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

function findMatchingAttendance(scheduleRow, attendanceList) {
  return (
    attendanceList.find((att) => {
      if (
        scheduleRow.schedule_id &&
        att.schedule_id &&
        String(att.schedule_id) === String(scheduleRow.schedule_id)
      ) {
        return !!att.check_in;
      }

      return (
        String(att.employee_id || "") === String(scheduleRow.employee_id || "") &&
        String(att.date || "") === String(scheduleRow.date || "") &&
        String(att.part || "") === String(scheduleRow.part || "") &&
        !!att.check_in
      );
    }) || null
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
 *         .
 * useMemo     .
 */
function selectTodayState(scheduleList, attendanceList, employeeList) {
  const employeeMap = employeeList.reduce((acc, emp) => {
    acc[String(emp.employee_id)] = emp;
    return acc;
  }, {});

  //  attendance  (status   ) 
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

    if (status === ATTENDANCE_STATUS.PENDING && !row.check_out) {
      //  +     
      attentionOpenList.push(row);
      continue;
    }

    // getAttendanceStatus : check_out  approval_status=pending  PENDING
    if (status === ATTENDANCE_STATUS.PENDING && row.check_out) {
      if (EXTENSION_REASONS.has(row.approval_reason)) {
        extensionPending.push(row);
      } else {
        normalPending.push(row);
      }
    }
    // APPROVED, REJECTED, CLOSED   
  }

  //  schedule  () 
  // WORKING  attendance schedule_id " " 
  const matchedScheduleIds = new Set(
    attendanceList
      .filter((row) => getAttendanceStatus(row) === ATTENDANCE_STATUS.WORKING)
      .map((row) => String(row.schedule_id))
      .filter(Boolean),
  );

  const lateNoShowList = scheduleList
    .filter((row) => !matchedScheduleIds.has(String(row.schedule_id)))
    .map((row) => {
      const emp = employeeMap[String(row.employee_id)] || null;
      return { ...row, employee_name: row.name || emp?.name || "-" };
    });

  return {
    workingNow,
    attentionOpenList,
    normalPending,
    extensionPending,
    lateNoShowList,
  };
}

export default function TodayTab(props) {
  const { todaySchedule = [], todayAttendance = [], employees = [], onApprove, onReject } = props;

  // deps props    safeArray useMemo  
  // ( safeArray        useMemo  )
  // JSX     
  const scheduleList = safeArray(todaySchedule);
  const attendanceList = safeArray(todayAttendance);
  const employeeList = safeArray(employees);

  const {
    workingNow,
    attentionOpenList,
    normalPending,
    extensionPending,
    lateNoShowList,
  } = useMemo(
    () => selectTodayState(scheduleList, attendanceList, employeeList),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todaySchedule, todayAttendance, employees],
  );

  return (
    <div className="today-tab">
      <div className="today-overview">
        <StatCard title=" " count={workingNow.length}>
          {workingNow.length === 0 ? (
            <EmptyState text="     ." />
          ) : (
            workingNow.map((row) => (
              <PersonRow
                key={row.attendance_id}
                title={`${row.name || "-"}  ${getPartLabel(row.part)}`}
                subtitle={` ${timeRange(row.check_in, row.check_out || "")}`}
                extra={` ${timeRange(row.paid_check_in, row.paid_check_out || "")}`}
                right={<StatusBadge status={row.approval_status} />}
              />
            ))
          )}
        </StatCard>

        <StatCard title="" count={attentionOpenList.length}>
          {attentionOpenList.length === 0 ? (
            <EmptyState text="     ." />
          ) : (
            attentionOpenList.map((row) => {
              const matchedSchedule = hasMatchingSchedule(row, scheduleList);

              return (
                <div className="today-approval-item" key={row.attendance_id}>
                  <PersonRow
                    title={`${row.name || "-"}  ${getPartLabel(row.part)}`}
                    subtitle={` ${timeRange(row.check_in, row.check_out || "")}`}
                    extra={
                      <>
                        <div> {timeRange(row.planned_start, row.planned_end)}</div>
                        <div> {timeRange(row.paid_check_in, row.paid_check_out || "")}</div>
                        {!matchedSchedule ? (
                          <div className="today-note">
                                  .
                          </div>
                        ) : null}
                        {row.approval_note ? (
                          <div className="today-note">{row.approval_note}</div>
                        ) : null}
                      </>
                    }
                    right={
                      <div className="today-inline-badges">
                        <span className="today-badge warning"></span>
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
                          
                        </button>
                      ) : null}
                      {onReject ? (
                        <button
                          type="button"
                          className="today-btn reject"
                          onClick={() => onReject(row)}
                        >
                          
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
        <StatCard title="" count={normalPending.length}>
          {normalPending.length === 0 ? (
            <EmptyState text="   ." />
          ) : (
            normalPending.map((row) => (
              <div className="today-approval-item" key={row.attendance_id}>
                <PersonRow
                  title={`${row.name || "-"}  ${getPartLabel(row.part)}`}
                  subtitle={` ${timeRange(row.planned_start, row.planned_end)}`}
                  extra={
                    <>
                      <div> {timeRange(row.check_in, row.check_out)}</div>
                      <div> {timeRange(row.paid_check_in, row.paid_check_out)}</div>
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
                        
                      </button>
                    ) : null}
                    {onReject ? (
                      <button
                        type="button"
                        className="today-btn reject"
                        onClick={() => onReject(row)}
                      >
                        
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            ))
          )}
        </StatCard>

        <StatCard title=" " count={extensionPending.length}>
          {extensionPending.length === 0 ? (
            <EmptyState text="   ." />
          ) : (
            extensionPending.map((row) => (
              <div className="today-approval-item" key={row.attendance_id}>
                <PersonRow
                  title={`${row.name || "-"}  ${getPartLabel(row.part)}`}
                  subtitle={`  ${row.planned_end || "-"}`}
                  extra={
                    <>
                      <div>   {row.paid_check_out || "-"}</div>
                      <div> {Number(row.extension_min || 0)}</div>
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
                        
                      </button>
                    ) : null}
                    {onReject ? (
                      <button
                        type="button"
                        className="today-btn reject"
                        onClick={() => onReject(row)}
                      >
                        
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
        <StatCard title="" count={lateNoShowList.length}>
          {lateNoShowList.length === 0 ? (
            <EmptyState text="   ." />
          ) : (
            lateNoShowList.map((row) => (
              <PersonRow
                key={row.schedule_id}
                title={`${row.employee_name}  ${getPartLabel(row.part)}`}
                subtitle={` ${timeRange(row.planned_start, row.planned_end)}`}
                extra={` ID ${row.schedule_id || "-"}`}
                right={<span className="today-badge neutral"></span>}
              />
            ))
          )}
        </StatCard>

        <StatCard title="  " count={scheduleList.length}>
          {scheduleList.length === 0 ? (
            <EmptyState text="   ." />
          ) : (
            scheduleList.map((row) => {
              const matchedAttendance = findMatchingAttendance(row, attendanceList);
              const checkedIn = !!matchedAttendance;

              return (
                <PersonRow
                  key={row.schedule_id}
                  title={`${row.name || "-"}  ${getPartLabel(row.part)}`}
                  subtitle={timeRange(row.planned_start, row.planned_end)}
                  extra={
                    checkedIn
                      ? ` ${timeRange(matchedAttendance.check_in, matchedAttendance.check_out)}`
                      : null
                  }
                  right={
                    <span className={`today-badge ${checkedIn ? "approved" : "neutral"}`}>
                      {checkedIn ? " " : ""}
                    </span>
                  }
                />
              );
            })
          )}
        </StatCard>
      </div>
    </div>
  );
}
