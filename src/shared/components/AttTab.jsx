import React, { useMemo, useState } from "react";
import {
  diffMinutes,
  getApprovalReasonLabel,
  getApprovalStatusLabel,
  getPaidWorkMinutes,
  getScheduledWorkMinutes,
} from "../hooks/useApi";
import "./AttTab.css";

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
    default:
      return part || "-";
  }
}

function formatMinutes(mins) {
  const n = Number(mins || 0);
  if (!n) return "0분";
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h && m) return `${h}시간 ${m}분`;
  if (h) return `${h}시간`;
  return `${m}분`;
}

function matchesSearch(row, keyword) {
  if (!keyword.trim()) return true;
  const q = keyword.trim().toLowerCase();

  return [
    row.name,
    row.employee_id,
    row.part,
    row.date,
    row.approval_status,
    row.approval_reason,
    row.memo,
  ]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(q));
}

export default function AttTab(props) {

  const {
    monthAttendance = [],
    approveAttendance,
    updateAttendance,
    selectedMonth = "",
    currentManagerName = "manager",
  } = props;

  const [statusFilter, setStatusFilter] = useState("all");
  const [reasonFilter, setReasonFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);
  const [editRow, setEditRow] = useState(null);

  const attendanceList = safeArray(monthAttendance);

  const filteredRows = useMemo(() => {
    return attendanceList.filter((row) => {
      const matchStatus = statusFilter === "all" ? true : row.approval_status === statusFilter;
      const matchReason = reasonFilter === "all" ? true : row.approval_reason === reasonFilter;
      const matchKeyword = matchesSearch(row, search);
      return matchStatus && matchReason && matchKeyword;
    });
  }, [attendanceList, reasonFilter, search, statusFilter]);

  const summary = useMemo(() => {
    const pending = attendanceList.filter((r) => r.approval_status === "pending");
    const approved = attendanceList.filter((r) => r.approval_status === "approved");
    const rejected = attendanceList.filter((r) => r.approval_status === "rejected");

    const totalPaidMinutes = attendanceList
      .filter((r) => r.approval_status !== "pending")
      .reduce((acc, row) => acc + getPaidWorkMinutes(row), 0);

    const totalActualMinutes = attendanceList.reduce(
      (acc, row) =>
        acc + Math.max(0, diffMinutes(row.check_in, row.check_out) - Number(row.break_min || 0)),
      0,
    );

    // 시급
    const todayLaborCost = attendanceList.reduce
    ((sum, row) => {
    const wage = Number(row.hourly_wage || 0);
    const workMin = getPaidWorkMinutes(row);
    return sum + (wage * workMin / 60);
    }, 0);

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const todayDate = now.getDate();
    const remainingDays = lastDay - todayDate + 1;
    const estimatedMonthLaborCost = todayLaborCost * remainingDays;

    return {
      total: attendanceList.length,
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      totalPaidMinutes,
      totalActualMinutes,
      todayLaborCost,
      estimatedMonthLaborCost,
    };
  }, [attendanceList]);

  const handleApprove = async (row, note) => {
    if (!approveAttendance) return;

    await approveAttendance({
      attendance_id: row.attendance_id,
      approved: true,
      approved_by: currentManagerName,
      approval_note: note || "",
      date: row.date,
    });

    setSelectedRow(null);
  };

  const handleReject = async (row, note) => {
    if (!approveAttendance) return;

    await approveAttendance({
      attendance_id: row.attendance_id,
      approved: false,
      approved_by: currentManagerName,
      approval_note: note || "",
      date: row.date,
    });

    setSelectedRow(null);
  };

  const handleEdit = async (payload) => {
    if (!updateAttendance) return;
    await updateAttendance(payload);
  };

  return (
    <div className="att-tab">
      <div className="att-topbar">
        <div>
          <h2 className="att-title">출퇴근 / 정산</h2>
          <p className="att-subtitle">
            {selectedMonth || "-"} · 실제시간과 지급시간을 분리해서 확인
          </p>
        </div>
      </div>

      <div className="att-summary-grid">
        <SummaryCard title="전체 기록" value={summary.total} sub="월 전체 attendance" />
        <SummaryCard title="승인대기" value={summary.pending} sub="관리자 확인 필요" />
        <SummaryCard
          title="지급 근무시간"
          value={formatMinutes(summary.totalPaidMinutes)}
          sub="pending 제외"
        />
        <SummaryCard
          title="실제 근무시간"
          value={formatMinutes(summary.totalActualMinutes)}
          sub="check 기준"
        />
        <SummaryCard
          title="오늘 인건비"
          value={`${Math.round(summary.todayLaborCost).toLocaleString()}원`}
          sub="지급시간 기준"
        />
        <SummaryCard
          title="월 예상 인건비"
          value={`${Math.round(summary.estimatedMonthLaborCost).toLocaleString()}원`}
          sub="오늘 평균 × 남은 일수"
        />
      </div>

      <section className="att-panel">
        <div className="att-filter-row">
          <input
            className="att-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름, 날짜, 사유 검색"
          />

          <select
            className="att-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">전체 상태</option>
            <option value="approved">승인</option>
            <option value="pending">승인대기</option>
            <option value="rejected">거절</option>
            <option value="auto_closed">자동종료</option>
          </select>

          <select
            className="att-select"
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value)}
          >
            <option value="all">전체 사유</option>
            <option value="out_of_schedule">스케줄 외 출근</option>
            <option value="substitute">대타</option>
            <option value="late">지각</option>
          </select>
        </div>

        <div className="att-table-wrap">
          <table className="att-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>날짜</th>
                <th>파트</th>
                <th>예정시간</th>
                <th>파트기준</th>
                <th>실제시간</th>
                <th>지각</th>
                <th>지급시간</th>
                <th>상태</th>
                <th>사유</th>
                <th>휴게</th>
                <th>실지급</th>
                <th>메모</th>
                <th>처리</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="att-empty-cell">
                    조건에 맞는 근태 기록이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const canApprove = row.approval_status === "pending";

                  return (
                    <tr key={row.attendance_id}>
                      <td>{row.name || "-"}</td>
                      <td>{row.date || "-"}</td>
                      <td>{getPartLabel(row.part)}</td>
                      <td>{timeRange(row.planned_start, row.planned_end)}</td>
                      <td>{formatMinutes(getScheduledWorkMinutes(row))}</td>
                      <td>{timeRange(row.check_in, row.check_out)}</td>
                      <td>{row.late_display_min > 0 ? `${row.late_display_min}분` : "-"}</td>
                      <td>{timeRange(row.paid_check_in, row.paid_check_out)}</td>
                      <td><StatusBadge status={row.approval_status} /></td>
                      <td>{row.approval_reason ? <ReasonBadge reason={row.approval_reason} /> : "-"}</td>
                      <td>{Number(row.break_min || 0)}분</td>
                      <td>{formatMinutes(getPaidWorkMinutes(row))}</td>
                      <td>{row.memo || row.approval_note || "-"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          {canApprove && (
                            <button
                              type="button"
                              className="att-btn primary small"
                              onClick={() => setSelectedRow(row)}
                            >
                              승인
                            </button>
                          )}
                          <button
                            type="button"
                            className="att-btn secondary small"
                            onClick={() => setEditRow(row)}
                          >
                            수정
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ApprovalModal
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
        onApprove={handleApprove}
        onReject={handleReject}
      />

      <EditModal
        row={editRow}
        onClose={() => setEditRow(null)}
        onSave={handleEdit}
      />
    </div>
  );
}