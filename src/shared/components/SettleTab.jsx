// src/shared/components/SettleTab.jsx
// 월 마감 정산 탭 — final_pay upsert + 직원별 breakdown 조회

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase.js";
import { calcRowPayWithSeparation } from "../utils/pay";
import { getApprovalStatusLabel } from "../domain/attendance/labels";

/* ----------------------------------------------------------------
   유틸
---------------------------------------------------------------- */

function pad2(n) {
  return String(n).padStart(2, "0");
}

function fmtWon(n) {
  if (n == null || isNaN(n)) return "–";
  return Number(n).toLocaleString("ko-KR") + "원";
}

function fmtMin(min) {
  if (!min) return "–";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}시간 ${m > 0 ? m + "분" : ""}`.trim() : `${m}분`;
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
   컴포넌트
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

  // 이미 마감된 정산 데이터 조회
  const loadFinalPay = useCallback(async () => {
    setFetchLoading(true);
    setError("");
    try {
      const rows = await fetchFinalPay(selectedMonth);
      setFinalRows(rows);
    } catch (err) {
      setError(err.message || "정산 데이터 조회 실패");
    } finally {
      setFetchLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadFinalPay();
  }, [loadFinalPay]);

  // 마감 처리
  const handleLock = useCallback(async () => {
    const pendingCount = monthAttendance.filter(
      (r) => r.approval_status === "pending",
    ).length;

    if (pendingCount > 0) {
      const go = window.confirm(
        `아직 승인 대기 중인 기록이 ${pendingCount}건 있습니다.\n미승인 기록을 제외하고 마감하시겠습니까?`,
      );
      if (!go) return;
    } else {
      const go = window.confirm(
        `${selectedMonth} 급여를 확정하시겠습니까?\n이미 마감된 데이터가 있으면 덮어씁니다.`,
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
      setError(err.message || "정산 마감에 실패했습니다.");
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

  // 미리보기 계산 (마감 전 예상)
  const preview = buildPreview(monthAttendance, employees);
  const isLocked = finalRows.length > 0;

  const [y, m] = selectedMonth.split("-");
  const monthLabel = `${y}년 ${Number(m)}월`;

  return (
    <div className="settle-tab">
      {/* 헤더 */}
      <div className="settle-header">
        <div>
          <h2 className="settle-title">{monthLabel} 급여 정산</h2>
          <p className="settle-sub">
            {isLocked
              ? `마감 완료 — ${finalRows[0]?.locked_by || ""} · ${formatLockedAt(finalRows[0]?.locked_at)}`
              : "출퇴근 기록 기준 예상 금액입니다. 마감 전까지 변동될 수 있습니다."}
          </p>
        </div>
        <button
          className={`settle-lock-btn${lockLoading ? " loading" : ""}${isLocked ? " locked" : ""}`}
          onClick={handleLock}
          disabled={lockLoading || fetchLoading}
        >
          {lockLoading
            ? "처리 중…"
            : isLocked
              ? "재마감 (덮어쓰기)"
              : "이번 달 급여 마감"}
        </button>
      </div>

      {error && <div className="settle-error">{error}</div>}

      {/* 상태 배지 */}
      {isLocked && (
        <div className="settle-locked-banner">
          ✅ 정산 완료 — final_pay에 저장된 데이터를 표시합니다.
        </div>
      )}

      {/* 테이블 */}
      {fetchLoading ? (
        <div className="settle-spinner">불러오는 중…</div>
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
   미리보기 계산 (마감 전)
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
   미리보기 테이블
---------------------------------------------------------------- */

function PreviewTable({ rows }) {
  if (!rows.length) {
    return <div className="settle-empty">이번 달 출퇴근 기록이 없습니다.</div>;
  }

  const totalAmount = rows.reduce((s, r) => s + (r.final_amount || 0), 0);

  return (
    <div className="settle-table-wrap">
      <table className="settle-table">
        <thead>
          <tr>
            <th>직원</th>
            <th>시급</th>
            <th>근무일</th>
            <th>승인대기</th>
            <th>기본급</th>
            <th>추가수당</th>
            <th>예상 합계</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.employee_id}>
              <td className="settle-name">{r.name}</td>
              <td>{fmtWon(r.hourly_wage)}</td>
              <td>{r.work_days}일</td>
              <td>
                {r.pending_count > 0 ? (
                  <span className="settle-badge-pending">{r.pending_count}건</span>
                ) : (
                  <span className="settle-ok">–</span>
                )}
              </td>
              <td>{fmtWon(r.base_pay)}</td>
              <td>{r.extra_pay > 0 ? fmtWon(r.extra_pay) : "–"}</td>
              <td className="settle-amount">{fmtWon(r.final_amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6} className="settle-total-label">
              총 인건비
            </td>
            <td className="settle-total-amount">{fmtWon(totalAmount)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="settle-note">
        ※ 승인 대기 기록은 제외된 금액입니다. 마감 전에 승인을 완료하세요.
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------
   마감 후 테이블 (final_pay 기반)
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
            <th>직원</th>
            <th>근무일</th>
            <th>기본급</th>
            <th>추가수당</th>
            <th>지각차감</th>
            <th>확정 금액</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isExpanded = expandedEmp === r.employee_id;
            const empName = empMap[r.employee_id]?.name || r.employee_id;
            // 해당 직원의 월 출퇴근 상세
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
                  <td>{r.work_days}일</td>
                  <td>{fmtWon(r.base_pay)}</td>
                  <td>{r.extra_pay > 0 ? fmtWon(r.extra_pay) : "–"}</td>
                  <td>
                    {r.late_deduct_min > 0 ? (
                      <span className="settle-deduct">
                        -{fmtMin(r.late_deduct_min)}
                      </span>
                    ) : (
                      "–"
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
                      {isExpanded ? "접기" : "상세"}
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
              총 인건비
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
   직원별 일별 상세 (expand 시)
---------------------------------------------------------------- */

function DetailTable({ rows }) {
  if (!rows.length) return <p className="settle-empty-detail">기록 없음</p>;

  return (
    <table className="settle-detail-table">
      <thead>
        <tr>
          <th>날짜</th>
          <th>파트</th>
          <th>출근</th>
          <th>퇴근</th>
          <th>상태</th>
          <th>메모</th>
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
              <td>{r.paid_check_in || r.check_in || "–"}</td>
              <td>{r.paid_check_out || r.check_out || "–"}</td>
              <td>
                <span className={`settle-status-badge status-${r.approval_status}`}>
                  {getApprovalStatusLabel(r.approval_status)}
                </span>
              </td>
              <td className="settle-memo">{r.approval_note || r.memo || "–"}</td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}

/* ----------------------------------------------------------------
   헬퍼
---------------------------------------------------------------- */

function formatLockedAt(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
