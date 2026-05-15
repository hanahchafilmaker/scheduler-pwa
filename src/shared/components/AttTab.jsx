import React, { useMemo, useState } from "react";

import {
  calcRowPayWithSeparation,
  calcWorkMinutes,
  diffMinutes,
} from "../utils/pay";
import {
  getApprovalStatusLabel,
  getApprovalReasonLabel,
  getPartLabel,
} from "../domain/attendance/labels";
import {
  selectPending,
  selectRejected,
  selectSettled,
  isPending,
} from "../domain/attendance/selectors";
import ApprovalModal from "./ApprovalModal";
import EditModal from "./EditModal";
import "./AttTab.css";

/* ----------------------------------------------------------------
   내부 유틸
---------------------------------------------------------------- */

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function timeRange(start, end) {
  return `${start || "-"} ~ ${end || "-"}`;
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

/* ----------------------------------------------------------------
   서브 컴포넌트
---------------------------------------------------------------- */

function StatusBadge({ status }) {
  return (
    <span className={`att-badge status-${status || "default"}`}>
      {getApprovalStatusLabel(status)}
    </span>
  );
}

function ReasonBadge({ reason }) {
  if (!reason) return "-";
  return (
    <span className={`att-badge reason-${reason}`}>
      {getApprovalReasonLabel(reason)}
    </span>
  );
}

function SummaryCard({ title, value, sub }) {
  return (
    <div className="att-summary-card">
      <div className="att-summary-title">{title}</div>
      <div className="att-summary-value">{value}</div>
      {sub ? <div className="att-summary-sub">{sub}</div> : null}
    </div>
  );
}

/* ----------------------------------------------------------------
   메인 컴포넌트
---------------------------------------------------------------- */

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

  /* ── 필터 ── */
  const filteredRows = useMemo(() => {
    return attendanceList.filter((row) => {
      const matchStatus =
        statusFilter === "all" || row.approval_status === statusFilter;
      const matchReason =
        reasonFilter === "all" || row.approval_reason === reasonFilter;
      const matchKeyword = matchesSearch(row, search);
      return matchStatus && matchReason && matchKeyword;
    });
  }, [attendanceList, statusFilter, reasonFilter, search]);

  /* ── 요약 ── */
  const summary = useMemo(() => {
    const pending = selectPending(attendanceList);
    const rejected = selectRejected(attendanceList);
    const settled = selectSettled(attendanceList);

    const totalPaidMinutes = settled.reduce(
      (acc, row) =>
        acc +
        calcWorkMinutes(
          row.paid_check_in,
          row.paid_check_out,
          row.break_min
        ),
      0
    );

    const totalActualMinutes = attendanceList.reduce(
      (acc, row) =>
        acc +
        Math.max(
          0,
          diffMinutes(row.check_in, row.check_out) -
            Number(row.break_min || 0)
        ),
      0
    );

    const totalLaborCost = settled.reduce((sum, row) => {
      const res = calcRowPayWithSeparation(row);
      return sum + (res.payrollTotalPay || 0);
    }, 0);

    const now = new Date();
    const lastDay = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    ).getDate();
    const todayDate = now.getDate();
    const avgPerDay = todayDate > 0 ? totalLaborCost / todayDate : 0;

    return {
      total: attendanceList.length,
      pending: pending.length,
      approved: settled.length,
      rejected: rejected.length,
      totalPaidMinutes,
      totalActualMinutes,
      todayLaborCost: totalLaborCost,
      estimatedMonthLaborCost: avgPerDay * lastDay,
    };
  }, [attendanceList]);

  /* ── 핸들러 ── */
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
    setEditRow(null);
  };

  /* ── 렌더 ── */
  return (
    <div className="att-tab">
      <div className="att-topbar">
        <div>
          <h2 className="att-title">출퇴근 / 정산</h2>
          <p className="att-subtitle">
            {selectedMonth || "-"} · 실제시간과 지급시간 분리
          </p>
        </div>
      </div>

      <div className="att-summary-grid">
        <SummaryCard title="전체 기록" value={summary.total} />
        <SummaryCard title="승인대기" value={summary.pending} />
        <SummaryCard
          title="지급 근무시간"
          value={formatMinutes(summary.totalPaidMinutes)}
        />
        <SummaryCard
          title="실제 근무시간"
          value={formatMinutes(summary.totalActualMinutes)}
        />
        <SummaryCard
          title="월 누적 인건비"
          value={`${Math.round(
            summary.todayLaborCost
          ).toLocaleString()}원`}
        />
        <SummaryCard
          title="월 예상 인건비"
          value={`${Math.round(
            summary.estimatedMonthLaborCost
          ).toLocaleString()}원`}
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
                <th>실제시간</th>
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
                  <td colSpan={12} className="att-empty-cell">
                    조건에 맞는 근태 기록이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const canApprove = isPending(row);
                  const isAutoClosed =
                    row.approval_status === "auto_closed";
                  const isSettled =
                    row.approval_status === "approved" ||
                    isAutoClosed;

                  const payResult = isSettled
                    ? calcRowPayWithSeparation(row)
                    : null;

                  const payDisplay = payResult
                    ? `${Math.round(
                        payResult.payrollTotalPay || 0
                      ).toLocaleString()}원`
                    : isPending(row)
                    ? "미확정"
                    : "-";

                  return (
                    <tr key={row.attendance_id}>
                      <td>{row.name || "-"}</td>
                      <td>{row.date || "-"}</td>
                      <td>{getPartLabel(row.part)}</td>
                      <td>
                        {timeRange(
                          row.planned_start,
                          row.planned_end
                        )}
                      </td>
                      <td>
                        {timeRange(row.check_in, row.check_out)}
                      </td>
                      <td>
                        {timeRange(
                          row.paid_check_in,
                          row.paid_check_out
                        )}
                      </td>
                      <td>
                        <StatusBadge status={row.approval_status} />
                      </td>
                      <td>
                        <ReasonBadge reason={row.approval_reason} />
                      </td>
                      <td>{Number(row.break_min || 0)}분</td>
                      <td>{payDisplay}</td>
                      <td>
                        {row.memo || row.approval_note || "-"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          {canApprove && (
                            <button
                              className="att-btn primary small"
                              onClick={() => setSelectedRow(row)}
                            >
                              승인
                            </button>
                          )}
                          <button
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