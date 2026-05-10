import { useState } from "react";
import { fmtKRW, formatTime } from "../utils";
import { PayslipModal } from "./PayslipModal";
import { PageHeader } from "./UI";

const DAY_KR = ["일", "월", "화", "수", "목", "금", "토"];

function DayTable({ days, hours, nightHours, amount }) {
  return (
    <div className="sim-days-table">
      <div className="sim-days-head sim-days-head-7">
        <span>날짜</span>
        <span>실제 출근</span>
        <span>실제 퇴근</span>
        <span>지급 기준</span>
        <span>근무</span>
        <span>야간</span>
        <span>금액</span>
      </div>

      {days.map((d, i) => {
        const dayKr = DAY_KR[new Date(d.date).getDay()];
        return (
          <div key={i} className="sim-days-row sim-days-row-7">
            <span>
              {d.date.slice(5)} ({dayKr})
            </span>
            <span>{formatTime(d.check_in)}</span>
            <span>{formatTime(d.check_out)}</span>
            <span>
              {formatTime(d.paid_check_in)} ~ {formatTime(d.paid_check_out)}
            </span>
            <span>{(d.workMin / 60).toFixed(1)}h</span>
            <span>{d.nightMin > 0 ? `${(d.nightMin / 60).toFixed(1)}h` : "-"}</span>
            <span className="sim-days-pay">{fmtKRW(d.pay)}</span>
          </div>
        );
      })}

      <div className="sim-days-total sim-days-row-7">
        <span>합계</span>
        <span />
        <span />
        <span />
        <span>{hours.toFixed(1)}h</span>
        <span>{nightHours.toFixed(1)}h</span>
        <span className="sim-days-pay">{fmtKRW(amount)}</span>
      </div>
    </div>
  );
}

function EmpCard({ e, totalPay, expanded, onToggle, onPayslip }) {
  const nightExtra = Math.round(e.nightHours * e.wage * 0.5);
  const pct = totalPay > 0 ? Math.round((e.amount / totalPay) * 100) : 0;

  return (
    <div className="sim-emp-card">
      <div className="sim-emp-header" onClick={onToggle} style={{ cursor: "pointer" }}>
        <div className="sim-emp-avatar">{e.name.slice(0, 1)}</div>

        <div className="sim-emp-info">
          <strong>{e.name}</strong>
          <span>
            {fmtKRW(e.wage)}/h · {e.workDays}일 출근 · {e.hours.toFixed(1)}h
          </span>
        </div>

        <div className="sim-emp-header-right">
          <div className="sim-emp-total">{fmtKRW(e.amount)}</div>
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
          <strong>{fmtKRW(Math.max(0, e.amount - nightExtra))}</strong>
        </div>

        <div className="sim-detail-item accent">
          <span>야간 추가</span>
          <strong>+{fmtKRW(nightExtra)}</strong>
        </div>

        <div className="sim-detail-item">
          <span>야간 시간</span>
          <strong>{e.nightHours.toFixed(1)}h</strong>
        </div>

        <div className="sim-detail-item sim-detail-total">
          <span>합계</span>
          <strong>{fmtKRW(e.amount)}</strong>
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
        <DayTable days={e.days} hours={e.hours} nightHours={e.nightHours} amount={e.amount} />
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
        description="확정된 지급 기준 시간으로 급여를 계산합니다"
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
          <div className="sim-total-amount">{fmtKRW(settlement.totalPay)}</div>
          <div className="sim-total-meta">
            {settlement.rows.length}명 · {settlement.totalHours.toFixed(1)}h ·{" "}
            {settlement.totalWorkDays}일
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
            .sort((a, b) => b.amount - a.amount)
            .map((e) => (
              <EmpCard
                key={e.employee_id}
                e={e}
                totalPay={settlement.totalPay}
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
