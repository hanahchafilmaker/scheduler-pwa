// src/shared/components/SettleTab.jsx
//      final_pay upsert +  breakdown 

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase.js";
import {
  calcRowPayWithSeparation,
  calcMonthSummary,
  buildSettlement
} from "../domain/attendance/payroll/engine/payEngine";
import { getApprovalStatusLabel } from "../domain/attendance/labels";

/* ----------------------------------------------------------------
   
---------------------------------------------------------------- */

function pad2(n) {
  return String(n).padStart(2, "0");
}

function fmtWon(n) {
  if (n == null || isNaN(n)) return "";
  return Number(n).toLocaleString("ko-KR") + "";
}

function fmtMin(min) {
  if (!min) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} ${m > 0 ? m + "" : ""}`.trim() : `${m}`;
}

async function fetchFinalPay(yearMonth) {
  const { data, error } = await supabase
    .from("final_pay")
    .select("*")
    .eq("year_month", yearMonth)
    .order("employee_id");

  if (error) throw new Error(error.message);
  return data || [];
}

/* ----------------------------------------------------------------
   
---------------------------------------------------------------- */

export default function SettleTab({
  monthAttendance = [],
  employees = [],
  selectedMonth,
  lockMonthlyPay,
  currentManagerName = "manager",
}) {
  const [finalRows, setFinalRows] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [lockLoading, setLockLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedEmp, setExpandedEmp] = useState(null);

  //     
  const loadFinalPay = useCallback(async () => {
    setFetchLoading(true);
    setError("");
    try {
      const rows = await fetchFinalPay(selectedMonth);
      setFinalRows(rows);
    } catch (err) {
      setError(err.message || "   ");
    } finally {
      setFetchLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadFinalPay();
  }, [loadFinalPay]);

  //  
  const handleLock = useCallback(async () => {
    const pendingCount = monthAttendance.filter(
      (r) => r.approval_status === "pending",
    ).length;

    if (pendingCount > 0) {
      const go = window.confirm(
        `     ${pendingCount} .\n   ?`,
      );
      if (!go) return;
    } else {
      const go = window.confirm(
        `${selectedMonth}  ?\n    .`,
      );
      if (!go) return;
    }

    setLockLoading(true);
    setError("");
    try {
      await lockMonthlyPay({
        yearMonth: selectedMonth,
        lockedBy: currentManagerName,
        calcFn: calcRowPayWithSeparation,
      });
      await loadFinalPay();
    } catch (err) {
      setError(err.message || "  .");
    } finally {
      setLockLoading(false);
    }
  }, [
    monthAttendance,
    selectedMonth,
    lockMonthlyPay,
    currentManagerName,
    loadFinalPay,
  ]);

  //   (  )
  const preview = buildPreview(monthAttendance, employees);
  const isLocked = finalRows.length > 0;

  const [y, m] = selectedMonth.split("-");
  const monthLabel = `${y} ${Number(m)}`;

  return (
    <div className="settle-tab">
      {/*  */}
      <div className="settle-header">
        <div>
          <h2 className="settle-title">{monthLabel}  </h2>
          <p className="settle-sub">
            {isLocked
              ? `   ${finalRows[0]?.locked_by || ""}  ${formatLockedAt(finalRows[0]?.locked_at)}`
              : "    .     ."}
          </p>
        </div>
        <button
          className={`settle-lock-btn${lockLoading ? " loading" : ""}${isLocked ? " locked" : ""}`}
          onClick={handleLock}
          disabled={lockLoading || fetchLoading}
        >
          {lockLoading
            ? " "
            : isLocked
              ? " ()"
              : "   "}
        </button>
      </div>

      {error && <div className="settle-error">{error}</div>}

      {/*   */}
      {isLocked && (
        <div className="settle-locked-banner">
              final_pay   .
        </div>
      )}

      {/*  */}
      {fetchLoading ? (
        <div className="settle-spinner"> </div>
      ) : isLocked ? (
        <LockedTable
          rows={finalRows}
          employees={employees}
          expandedEmp={expandedEmp}
          setExpandedEmp={setExpandedEmp}
          monthAttendance={monthAttendance}
        />
      ) : (
        <PreviewTable rows={preview} />
      )}
    </div>
  );
}

/* ----------------------------------------------------------------
     ( )
---------------------------------------------------------------- */

function buildPreview(attRows, empRows) {
  const empMap = {};
  for (const e of empRows) empMap[e.employee_id] = e;

  const grouped = {};
  for (const r of attRows) {
    if (!r.employee_id) continue;
    if (!grouped[r.employee_id]) grouped[r.employee_id] = [];
    grouped[r.employee_id].push(r);
  }

  return Object.entries(grouped).map(([empId, rows]) => {
    const emp = empMap[empId] || {};
    const wage = emp.hourly_wage || 0;

    const settled = rows.filter(
      (r) => r.approval_status === "approved" || r.approval_status === "auto_closed",
    );
    const pending = rows.filter((r) => r.approval_status === "pending");
    const rejected = rows.filter((r) => r.approval_status === "rejected");

    let basePay = 0;
    let extraPay = 0;
    for (const r of settled) {
      const res = calcRowPayWithSeparation({ ...r, hourly_wage: wage });
      basePay += res.basePay || 0;
      extraPay += res.extraPay || 0;
    }

    return {
      employee_id: empId,
      name: emp.name || empId,
      hourly_wage: wage,
      work_days: settled.length,
      pending_count: pending.length,
      rejected_count: rejected.length,
      base_pay: Math.round(basePay),
      extra_pay: Math.round(extraPay),
      final_amount: Math.round(basePay + extraPay),
    };
  });
}

/* ----------------------------------------------------------------
    
---------------------------------------------------------------- */

function PreviewTable({ rows }) {
  if (!rows.length) {
    return <div className="settle-empty">    .</div>;
  }

  const totalAmount = rows.reduce((s, r) => s + (r.final_amount || 0), 0);

  return (
    <div className="settle-table-wrap">
      <table className="settle-table">
        <thead>
          <tr>
            <th></th>
            <th></th>
            <th></th>
            <th></th>
            <th></th>
            <th></th>
            <th> </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.employee_id}>
              <td className="settle-name">{r.name}</td>
              <td>{fmtWon(r.hourly_wage)}</td>
              <td>{r.work_days}</td>
              <td>
                {r.pending_count > 0 ? (
                  <span className="settle-badge-pending">{r.pending_count}</span>
                ) : (
                  <span className="settle-ok"></span>
                )}
              </td>
              <td>{fmtWon(r.base_pay)}</td>
              <td>{r.extra_pay > 0 ? fmtWon(r.extra_pay) : ""}</td>
              <td className="settle-amount">{fmtWon(r.final_amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6} className="settle-total-label">
               
            </td>
            <td className="settle-total-amount">{fmtWon(totalAmount)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="settle-note">
             .    .
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------
      (final_pay )
---------------------------------------------------------------- */

function LockedTable({ rows, employees, expandedEmp, setExpandedEmp, monthAttendance }) {
  const empMap = {};
  for (const e of employees) empMap[e.employee_id] = e;

  const totalAmount = rows.reduce((s, r) => s + Number(r.final_amount || 0), 0);

  return (
    <div className="settle-table-wrap">
      <table className="settle-table">
        <thead>
          <tr>
            <th></th>
            <th></th>
            <th></th>
            <th></th>
            <th></th>
            <th> </th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isExpanded = expandedEmp === r.employee_id;
            const empName = empMap[r.employee_id]?.name || r.employee_id;
            //     
            const attDetail = monthAttendance.filter(
              (a) => a.employee_id === r.employee_id,
            );

            return (
              <>
                <tr
                  key={r.employee_id}
                  className={`settle-row${isExpanded ? " expanded" : ""}`}
                >
                  <td className="settle-name">{empName}</td>
                  <td>{r.work_days}</td>
                  <td>{fmtWon(r.base_pay)}</td>
                  <td>{r.extra_pay > 0 ? fmtWon(r.extra_pay) : ""}</td>
                  <td>
                    {r.late_deduct_min > 0 ? (
                      <span className="settle-deduct">
                        -{fmtMin(r.late_deduct_min)}
                      </span>
                    ) : (
                      ""
                    )}
                  </td>
                  <td className="settle-amount">{fmtWon(r.final_amount)}</td>
                  <td>
                    <button
                      className="settle-detail-btn"
                      onClick={() =>
                        setExpandedEmp(isExpanded ? null : r.employee_id)
                      }
                    >
                      {isExpanded ? "" : ""}
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`${r.employee_id}_detail`} className="settle-detail-row">
                    <td colSpan={7}>
                      <DetailTable rows={attDetail} />
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} className="settle-total-label">
               
            </td>
            <td className="settle-total-amount" colSpan={2}>
              {fmtWon(totalAmount)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/* ----------------------------------------------------------------
      (expand )
---------------------------------------------------------------- */

function DetailTable({ rows }) {
  if (!rows.length) return <p className="settle-empty-detail"> </p>;

  return (
    <table className="settle-detail-table">
      <thead>
        <tr>
          <th></th>
          <th></th>
          <th></th>
          <th></th>
          <th></th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rows
          .slice()
          .sort((a, b) => (a.date > b.date ? 1 : -1))
          .map((r, i) => (
            <tr key={i} className={`detail-status-${r.approval_status}`}>
              <td>{r.date}</td>
              <td>{r.part}</td>
              <td>{r.paid_check_in || r.check_in || ""}</td>
              <td>{r.paid_check_out || r.check_out || ""}</td>
              <td>
                <span className={`settle-status-badge status-${r.approval_status}`}>
                  {getApprovalStatusLabel(r.approval_status)}
                </span>
              </td>
              <td className="settle-memo">{r.approval_note || r.memo || ""}</td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}

/* ----------------------------------------------------------------
   
---------------------------------------------------------------- */

function formatLockedAt(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

