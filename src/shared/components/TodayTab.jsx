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
 * 순수 함수 — 컴포넌트 외부에서 분류 로직 전체를 처리.
 * useMemo 의존성은 이 함수 하나로 통합.
 */
function selectTodayState(scheduleList, attendanceList, employeeList) {
  const employeeMap = employeeList.reduce((acc, emp) => {
    acc[String(emp.employee_id)] = emp;
    return acc;
  }, {});

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
      // 미퇴근 상태 + 미승인 → 관리자 확인 필요
      attentionOpenList.push(row);
      continue;
    }

    if (status === ATTENDANCE_STATUS.CLOSED && row.approval_status === "pending") {
      // 퇴근 완료 + 미승인 → 승인대기 또는 연장요청
      if (EXTENSION_REASONS.has(row.approval_reason)) {
        extensionPending.push(row);
      } else {
        normalPending.push(row);
      }
    }
    // CLOSED + approved/rejected, NONE, REJECTED → 표시 불필요
  }

  // ── schedule 분류 (미출근) ───────────────────────────────
  // WORKING 상태 attendance의 schedule_id만 "출근 완료"로 간주
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

  // deps를 props 원본으로 유지 → safeArray는 useMemo 내부에서 호출
  // (외부에서 safeArray 호출 시 매 렌더마다 새 배열 → useMemo 무효화 반복)
  // JSX 렌더에서도 사용하므로 컴포넌트 스코프에 선언
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
        <StatCard title="현재 근무중" count={workingNow.length}>
          {workingNow.length === 0 ? (
            <EmptyState text="현재 정상 근무 중인 직원이 없습니다." />
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

        <StatCard title="확인필요" count={attentionOpenList.length}>
          {attentionOpenList.length === 0 ? (
            <EmptyState text="즉시 확인이 필요한 열린 기록이 없습니다." />
          ) : (
            attentionOpenList.map((row) => {
              const matchedSchedule = hasMatchingSchedule(row, scheduleList);

              return (
                <div className="today-approval-item" key={row.attendance_id}>
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

        <StatCard title="연장 요청" count={extensionPending.length}>
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
      </div>

      <div className="today-overview">
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

        <StatCard title="오늘 스케줄 요약" count={scheduleList.length}>
          {scheduleList.length === 0 ? (
            <EmptyState text="오늘 등록된 스케줄이 없습니다." />
          ) : (
            scheduleList.map((row) => {
              const matchedAttendance = findMatchingAttendance(row, attendanceList);
              const checkedIn = !!matchedAttendance;

              return (
                <PersonRow
                  key={row.schedule_id}
                  title={`${row.name || "-"} · ${getPartLabel(row.part)}`}
                  subtitle={timeRange(row.planned_start, row.planned_end)}
                  extra={
                    checkedIn
                      ? `실제 ${timeRange(matchedAttendance.check_in, matchedAttendance.check_out)}`
                      : null
                  }
                  right={
                    <span className={`today-badge ${checkedIn ? "approved" : "neutral"}`}>
                      {checkedIn ? "출근기록 있음" : "대기"}
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