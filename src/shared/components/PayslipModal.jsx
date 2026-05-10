import { fmtKRW, formatTime } from "../utils";

const DAY_KR = ["일", "월", "화", "수", "목", "금", "토"];

export function PayslipModal({ emp, monthRange, onClose }) {
  if (!emp) return null;

  const nightExtra = Math.round(emp.nightHours * emp.wage * 0.5);
  const totalPay = Math.round(emp.amount || 0);
  const basePay = Math.max(0, totalPay - nightExtra);
  const deductTotal = 0;
  const netPay = totalPay - deductTotal;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="payslip-modal" onClick={(e) => e.stopPropagation()}>
        <div className="payslip-header">
          <div>
            <div className="payslip-brand">SHIFT</div>
            <div className="payslip-title">임금명세서</div>
          </div>

          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="payslip-net-banner">
          <span className="payslip-net-label">실수령액</span>
          <strong className="payslip-net-amount">{fmtKRW(netPay)}</strong>
        </div>

        <div className="payslip-info-grid">
          {[
            ["사업장명", "SHIFT"],
            ["임금산정기간", `${monthRange.label} 근무분`],
            ["성명", emp.name],
            ["지급일", monthRange.payDateLabel],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>

        <div className="payslip-section-title">지급내역</div>
        <div className="payslip-pay-grid">
          <PayItem
            label="기본급"
            amount={basePay}
            note={`${emp.hours.toFixed(1)}h × ${fmtKRW(emp.wage)}`}
          />
          <PayItem
            label="야간근로수당"
            amount={nightExtra}
            note={`야간 ${emp.nightHours.toFixed(1)}h × 50%`}
          />
          <PayItem label="지급합계" amount={totalPay} highlight />
        </div>

        <div className="payslip-section-title">공제내역</div>
        <div className="payslip-deduct-grid">
          <div className="payslip-deduct-item total">
            <span>공제합계</span>
            <strong>0원</strong>
          </div>
        </div>

        <div className="payslip-section-title">근무 상세</div>
        <div className="payslip-table">
          <div className="payslip-row header">
            <span>날짜</span>
            <span>실제 출근</span>
            <span>실제 퇴근</span>
            <span>지급 기준</span>
            <span>근무시간</span>
            <span>금액</span>
          </div>

          {emp.days.map((d, i) => {
            const dayKr = DAY_KR[new Date(d.date).getDay()];
            return (
              <div key={i} className="payslip-row">
                <span>
                  {d.date.slice(5)} ({dayKr})
                </span>
                <span>{formatTime(d.check_in)}</span>
                <span>{formatTime(d.check_out)}</span>
                <span>
                  {formatTime(d.paid_check_in)} ~ {formatTime(d.paid_check_out)}
                </span>
                <span>
                  {(d.workMin / 60).toFixed(1)}h
                  {d.nightMin > 0 ? ` (야간 ${(d.nightMin / 60).toFixed(1)}h)` : ""}
                </span>
                <span>{fmtKRW(d.pay)}</span>
              </div>
            );
          })}
        </div>

        <div className="payslip-summary">
          <div className="ps-row">
            <span>지급합계</span>
            <span>{fmtKRW(totalPay)}</span>
          </div>
          <div className="ps-row">
            <span>공제합계</span>
            <span>0원</span>
          </div>
          <div className="ps-row total">
            <span>실수령액</span>
            <span>{fmtKRW(netPay)}</span>
          </div>
        </div>

        <div className="payslip-foot">
          위 금액을 {monthRange.label} 근무분 급여로 {monthRange.payDateLabel} 지급함을 확인합니다.
        </div>

        <button className="payslip-print-btn" onClick={() => window.print()}>
          🖨️ 인쇄하기
        </button>
      </div>
    </div>
  );
}

function PayItem({ label, amount, note, highlight }) {
  return (
    <div className={`payslip-pay-item${highlight ? " highlight" : ""}`}>
      <span>{label}</span>
      <strong>{fmtKRW(amount)}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}
