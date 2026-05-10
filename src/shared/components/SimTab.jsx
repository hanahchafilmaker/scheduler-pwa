import { useState } from "react";
import { fmtKRW, formatTime } from "../utils";
import { PayslipModal } from "./PayslipModal";
import { PageHeader } from "./UI";

const DAY_KR = ["일", "월", "화", "수", "목", "금", "토"];

function DayTable({ days, basePay, extraPay, totalPay }) {
  return (
    <div className="sim-days-table">
      <div className="sim-days-head sim-days-head-5">
        <span>날짜</span>
        <span>실제 출근</span>
        <span>실제 퇴근</span>
        <span>기본급</span>
        <span>추가 수당</span>
      </div>

      {days.map((d, i) => {
        const dayKr = DAY_KR[new Date(d.date).getDay()];
        const dayBasePay =
          Math.round(
            (d.payrollBaseMin / 60) *
              (basePay / days.reduce((s, day) => s + day.payrollBaseMin, 0)) *
              100,
          ) / 100 || 0;
        const dayExtraPay = d.payrollExtraPay || 0;
        return (
          <div key={i} className="sim-days-row sim-days-row-5">
            <span>
              {d.date.slice(5)} ({dayKr})
            </span>
            <span>{formatTime(d.check_in)}</span>
            <span>{formatTime(d.check_out)}</span>
            <span className="sim-days-pay">{fmtKRW(dayBasePay)}</span>
            <span className="sim-days-pay">{fmtKRW(dayExtraPay)}</span>
          </div>
        );
      })}

      <div className="sim-days-total sim-days-row-5">
        <span>합계</span>
        <span />
        <span />
        <span className="sim-days-pay">{fmtKRW(basePay)}</span>
        <span className="sim-days-pay">{fmtKRW(extraPay)}</span>
      </div>
    </div>
  );
}

function EmpCard({ e, totalPay, expanded, onToggle, onPayslip }) {
  const basePay = Math.round(e.payrollBasePay || 0);
  const extraPay = Math.round(e.payrollExtraPay || 0);
  const totalEmpPay = basePay + extraPay;
  const pct = totalPay > 0 ? Math.round((totalEmpPay / totalPay) * 100) : 0;

  return (
    <div className="sim-emp-card">
      <div className="sim-emp-header" onClick={onToggle} style={{ cursor: "pointer" }}>
        <div className="sim-emp-avatar">{e.name.slice(0, 1)}</div>

        <div className="sim-emp-info">
          <strong>{e.name}</strong>
          <span>
            {fmtKRW(e.wage)}/h · {e.workDays}일 출근
          </span>
        </div>

        <div className="sim-emp-header-right">
          <div className="sim-emp-total">{fmtKRW(totalEmpPay)}</div>
          <span className="sim-toggle">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      <div className="sim-bar-wrap">
        <div className="sim-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="sim-bar-label">{pct}% of 총 인건비</div>

      <div className="sim-detail-grid">
        <div className="sim-detail-item">
          <span>기본급</span>
          <strong>{fmtKRW(basePay)}</strong>
        </div>

        <div className="sim-detail-item accent">
          <span>추가 수당</span>
          <strong>+{fmtKRW(extraPay)}</strong>
        </div>

        <div className="sim-detail-item sim-detail-total">
          <span>합계</span>
          <strong>{fmtKRW(totalEmpPay)}</strong>
        </div>
      </div>

      <button
        className="payslip-btn"
        onClick={(ev) => {
          ev.stopPropagation();
          onPayslip();
        }}
      >
        📄 임금명세서 출력
      </button>

      {expanded && (
        <DayTable days={e.days} basePay={basePay} extraPay={extraPay} totalPay={totalEmpPay} />
      )}
    </div>
  );
}

export function SimTab({ settlement, monthRange, settlementOffset, setSettlementOffset }) {
  const [expandedEmp, setExpandedEmp] = useState(null);
  const [payslipEmp, setPayslipEmp] = useState(null);

  const toggleExpand = (id) => setExpandedEmp((prev) => (prev === id ? null : id));

  return (
    <div className="page">
      <PageHeader
        title="정산"
        description="파트 기본시간 기준으로 급여를 계산합니다 (추가 수당은 별도)"
        right={
          <div className="cal-month-nav">
            <button className="cal-nav-btn" onClick={() => setSettlementOffset((o) => o - 1)}>
              ◀
            </button>
            <span className="cal-month-label">{monthRange.label}</span>
            <button className="cal-nav-btn" onClick={() => setSettlementOffset((o) => o + 1)}>
              ▶
            </button>
          </div>
        }
      />

      <div className="sim-total-banner">
        <div className="sim-total-left">
          <span className="sim-total-month">{monthRange.label} 근무분</span>
          <span className="sim-total-desc">지급 예정일: {monthRange.payDateLabel}</span>
        </div>

        <div className="sim-total-right">
          <div className="sim-total-amount">{fmtKRW(settlement.totalPayrollPay)}</div>
          <div className="sim-total-meta">
            {settlement.rows.length}명 · {settlement.totalWorkDays}일
          </div>
        </div>
      </div>

      {settlement.rows.length === 0 ? (
        <div className="card">
          <div className="empty">{monthRange.label} 확정된 출퇴근 기록이 없습니다</div>
        </div>
      ) : (
        <div className="sim-cards">
          {[...settlement.rows]
            .sort(
              (a, b) =>
                b.payrollBasePay + b.payrollExtraPay - (a.payrollBasePay + a.payrollExtraPay),
            )
            .map((e) => (
              <EmpCard
                key={e.employee_id}
                e={e}
                totalPay={settlement.totalPayrollPay}
                expanded={expandedEmp === e.employee_id}
                onToggle={() => toggleExpand(e.employee_id)}
                onPayslip={() => setPayslipEmp(e)}
              />
            ))}
        </div>
      )}

      <PayslipModal emp={payslipEmp} monthRange={monthRange} onClose={() => setPayslipEmp(null)} />
    </div>
  );
}
