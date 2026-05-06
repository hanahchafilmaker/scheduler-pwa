import { useMemo } from "react";
import { PART_LABEL, SHIFT_TIME, STATUS_BG, STATUS_COLOR } from "../constants";
import { normalizeDate, formatTime, calcWorkMinutes, toBool } from "../utils";
import { SectionTitle } from "./UI";

function toMin(t) {
  const m = String(t || "").match(/(\d+):(\d+)/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function getPlannedTime(part) {
  return SHIFT_TIME[part] || null;
}

function isToday(date) {
  return normalizeDate(date) === normalizeDate(new Date());
}

function getAutoStatus(a) {
  if (!a.check_in) return "미출근";

  if (a.check_in && !a.check_out) {
    if (!isToday(a.date)) return "퇴근누락";
    return "근무중";
  }

  if (toBool(a.is_substitute) || !a.schedule_id || a.part === "extra") {
    return "대타";
  }

  const shift = getPlannedTime(a.part);
  if (!shift) return a.status || "정상";

  const planStart = toMin(shift.start);
  let planEnd = toMin(shift.end);
  const realStart = toMin(a.check_in);
  let realEnd = toMin(a.check_out);

  if (
    planStart === null ||
    planEnd === null ||
    realStart === null ||
    realEnd === null
  ) {
    return a.status || "정상";
  }

  if (planEnd < planStart) planEnd += 24 * 60;
  if (realEnd < realStart) realEnd += 24 * 60;

  if (realStart > planStart + 1) return "지각";
  if (realEnd < planEnd - 1 && realEnd > planStart) return "조퇴";
  if (realEnd > planEnd + 1) return "연장";

  return "정상";
}

function getDiffText(a, status) {
  if (status === "퇴근누락") return "퇴근 미입력";
  if (status === "대타") return "스케줄 외 출근";

  const shift = getPlannedTime(a.part);
  if (!shift || !a.check_in) return "-";

  const planStart = toMin(shift.start);
  let planEnd = toMin(shift.end);
  const realStart = toMin(a.check_in);
  let realEnd = toMin(a.check_out);

  if (planStart === null || planEnd === null || realStart === null) {
    return "-";
  }

  if (!a.check_out || realEnd === null) {
    if (realStart > planStart + 1) return `+${realStart - planStart}분 지각`;
    return "-";
  }

  if (planEnd < planStart) planEnd += 24 * 60;
  if (realEnd < realStart) realEnd += 24 * 60;

  if (status === "지각") return `+${realStart - planStart}분 지각`;
  if (status === "조퇴") return `${planEnd - realEnd}분 조퇴`;
  if (status === "연장") return `+${realEnd - planEnd}분 연장`;

  return "-";
}

function needsManualApproval(a, status) {
  if (toBool(a.approved)) return false;

  return (
    status === "대타" ||
    status === "지각" ||
    status === "조퇴" ||
    status === "연장" ||
    status === "퇴근누락" ||
    toBool(a.needs_approval) ||
    toBool(a.is_substitute) ||
    !a.schedule_id ||
    a.part === "extra"
  );
}

export function AttTab({ attendance = [], onApprove }) {
  const displayList = useMemo(
    () => [...attendance].reverse().slice(0, 100),
    [attendance]
  );

  return (
    <div className="page">
      <div className="card">
        <SectionTitle>출퇴근 기록</SectionTitle>

        <table className="data-table">
          <thead>
            <tr>
              <th>날짜</th>
              <th>이름</th>
              <th>파트</th>
              <th>출근</th>
              <th>퇴근</th>
              <th>실근무</th>
              <th>상태</th>
              <th>차이</th>
              <th>승인</th>
              <th>비고</th>
            </tr>
          </thead>

          <tbody>
            {displayList.map((a) => {
              const min = calcWorkMinutes(
                a.check_in,
                a.check_out,
                a.break_min
              );

              const status = getAutoStatus(a);
              const diffText = getDiffText(a, status);
              const approved = toBool(a.approved);
              const needApproval = needsManualApproval(a, status);

              return (
                <tr
                  key={
                    a.attendance_id ||
                    `${a.employee_id}-${a.date}-${a.check_in}`
                  }
                >
                  <td>{normalizeDate(a.date)}</td>

                  <td>
                    <strong>{a.name}</strong>
                  </td>

                  <td>{PART_LABEL[a.part] || a.part || "-"}</td>
                  <td>{formatTime(a.check_in)}</td>
                  <td>{formatTime(a.check_out)}</td>
                  <td>{(min / 60).toFixed(1)}h</td>

                  <td>
                    <span
                      className="dash-badge"
                      style={{
                        background: STATUS_BG[status] || "#f9fafb",
                        color: STATUS_COLOR[status] || "#374151",
                      }}
                    >
                      {status}
                    </span>
                  </td>

                  <td>{diffText}</td>

                  <td>
                    {approved ? (
                      <span>승인완료</span>
                    ) : needApproval ? (
                      <button
                        type="button"
                        className="approve-btn"
                        onClick={() => onApprove(a, true)}
                      >
                        승인
                      </button>
                    ) : (
                      <span>-</span>
                    )}
                  </td>

                  <td>{a.memo || "-"}</td>
                </tr>
              );
            })}

            {attendance.length === 0 && (
              <tr>
                <td colSpan={10} className="empty">
                  기록이 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}