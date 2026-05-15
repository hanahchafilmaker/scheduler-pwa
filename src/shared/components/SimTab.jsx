import { useState } from "react";
import { fmtKRW, formatTime } from "../utils";
import { PayslipModal } from "./PayslipModal";
import { PageHeader } from "./UI";

const DAY_KR = ["", "", "", "", "", "", ""];

function formatMinutesToHourLabel(min) {
  const minutes = Number(min || 0);
  if (minutes <= 0) return "0";

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  if (m === 0) return `${h}`;
  return `${h} ${m}`;
}

function DayTable({ days, basePay, extraPay }) {
  return (
    <div className="sim-days-table">
      <div className="sim-days-head sim-days-head-6">
        <span></span>
        <span> </span>
        <span> </span>
        <span> </span>
        <span></span>
        <span>  </span>
      </div>

      {days.map((d, i) => {
        const dayKr = DAY_KR[new Date(d.date).getDay()];
        const dayBasePlanned = formatMinutesToHourLabel(d.payrollBasePlannedMin || 0);
        const dayBasePay = Math.round(d.payrollBasePay || 0);
        const dayExtraPay = Math.round(d.payrollExtraPay || 0);

        return (
          <div key={i} className="sim-days-row sim-days-row-6">
            <span>
              {d.date.slice(5)} ({dayKr})
            </span>
            <span>{formatTime(d.check_in)}</span>
            <span>{formatTime(d.check_out)}</span>
            <span>{dayBasePlanned}</span>
            <span className="sim-days-pay">{fmtKRW(dayBasePay)}</span>
            <span className="sim-days-pay">{fmtKRW(dayExtraPay)}</span>
          </div>
        );
      })}

      <div className="sim-days-total sim-days-row-6">
        <span></span>
        <span />
        <span />
        <span>
          {formatMinutesToHourLabel(
            days.reduce((sum, d) => sum + Number(d.payrollBasePlannedMin || 0), 0),
          )}
        </span>
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
            {fmtKRW(e.wage)}/h  {e.workDays} 
          </span>
        </div>

        <div className="sim-emp-header-right">
          <div className="sim-emp-total">{fmtKRW(totalEmpPay)}</div>
          <span className="sim-toggle">{expanded ? "" : ""}</span>
        </div>
      </div>

      <div className="sim-bar-wrap">
        <div className="sim-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="sim-bar-label">{pct}% of  </div>

      <div className="sim-detail-grid">
        <div className="sim-detail-item">
          <span> </span>
          <strong>{formatMinutesToHourLabel((e.payrollBasePlannedHours || 0) * 60)}</strong>
        </div>

        <div className="sim-detail-item">
          <span></span>
          <strong>{fmtKRW(basePay)}</strong>
        </div>

        <div className="sim-detail-item accent">
          <span>  </span>
          <strong>+{fmtKRW(extraPay)}</strong>
        </div>

        <div className="sim-detail-item sim-detail-total">
          <span></span>
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
          
      </button>

      {expanded && <DayTable days={e.days} basePay={basePay} extraPay={extraPay} />}
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
        title=""
        description="    ,      "
        right={
          <div className="cal-month-nav">
            <button className="cal-nav-btn" onClick={() => setSettlementOffset((o) => o - 1)}>
              
            </button>
            <span className="cal-month-label">{monthRange.label}</span>
            <button className="cal-nav-btn" onClick={() => setSettlementOffset((o) => o + 1)}>
              
            </button>
          </div>
        }
      />

      <div className="sim-total-banner">
        <div className="sim-total-left">
          <span className="sim-total-month">{monthRange.label} </span>
          <span className="sim-total-desc"> : {monthRange.payDateLabel}</span>
        </div>

        <div className="sim-total-right">
          <div className="sim-total-amount">{fmtKRW(settlement.totalPayrollPay)}</div>
          <div className="sim-total-meta">
            {settlement.rows.length}  {settlement.totalWorkDays}
          </div>
        </div>
      </div>

      {settlement.rows.length === 0 ? (
        <div className="card">
          <div className="empty">{monthRange.label}    </div>
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

