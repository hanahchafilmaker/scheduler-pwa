import React, { useMemo, useState } from "react";

import {
  calcRowPayWithSeparation,
  calcMonthSummary,
  calcWorkMinutes,
} from "../domain/attendance/payroll/engine/payEngine";

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
    
---------------------------------------------------------------- */

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function timeRange(start, end) {
  return `${start || "-"} ~ ${end || "-"}`;
}

function formatMinutes(mins) {
  const n = Number(mins || 0);
  if (!n) return "0";
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h && m) return `${h} ${m}`;
  if (h) return `${h}`;
  return `${m}`;
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

  /*    */
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

  /*    */
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

  /*    */
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

  /*    */
  return (
    <div className="att-tab">
      <div className="att-topbar">
        <div>
          <h2 className="att-title"> / </h2>
          <p className="att-subtitle">
            {selectedMonth || "-"}    
          </p>
        </div>
      </div>

      <div className="att-summary-grid">
        <SummaryCard title=" " value={summary.total} />
        <SummaryCard title="" value={summary.pending} />
        <SummaryCard
          title=" "
          value={formatMinutes(summary.totalPaidMinutes)}
        />
        <SummaryCard
          title=" "
          value={formatMinutes(summary.totalActualMinutes)}
        />
        <SummaryCard
          title="  "
          value={`${Math.round(
            summary.todayLaborCost
          ).toLocaleString()}`}
        />
        <SummaryCard
          title="  "
          value={`${Math.round(
            summary.estimatedMonthLaborCost
          ).toLocaleString()}`}
        />
      </div>

      <section className="att-panel">
        <div className="att-filter-row">
          <input
            className="att-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder=", ,  "
          />

          <select
            className="att-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all"> </option>
            <option value="approved"></option>
            <option value="pending"></option>
            <option value="rejected"></option>
            <option value="auto_closed"></option>
          </select>

          <select
            className="att-select"
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value)}
          >
            <option value="all"> </option>
            <option value="out_of_schedule">  </option>
            <option value="substitute"></option>
            <option value="late"></option>
          </select>
        </div>

        <div className="att-table-wrap">
          <table className="att-table">
            <thead>
              <tr>
                <th></th>
                <th></th>
                <th></th>
                <th></th>
                <th></th>
                <th></th>
                <th></th>
                <th></th>
                <th></th>
                <th></th>
                <th></th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="att-empty-cell">
                        .
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
                      ).toLocaleString()}`
                    : isPending(row)
                    ? ""
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
                      <td>{Number(row.break_min || 0)}</td>
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
                              
                            </button>
                          )}
                          <button
                            className="att-btn secondary small"
                            onClick={() => setEditRow(row)}
                          >
                            
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

