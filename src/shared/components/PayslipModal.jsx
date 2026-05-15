import { fmtKRW, formatTime } from "../utils";

const DAY_KR = ["", "", "", "", "", "", ""];

function formatMinutesToHourLabel(min) {
  const minutes = Number(min || 0);
  if (minutes <= 0) return "0";

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  if (m === 0) return `${h}`;
  return `${h} ${m}`;
}

export function PayslipModal({ emp, monthRange, onClose }) {
  if (!emp) return null;

  const basePay = Math.round(emp.payrollBasePay || 0);
  const extraPay = Math.round(emp.payrollExtraPay || 0);
  const totalPay = basePay + extraPay;
  const deductTotal = 0;
  const netPay = totalPay - deductTotal;

  const totalBasePlannedMin = (emp.days || []).reduce(
    (sum, d) => sum + Number(d.payrollBasePlannedMin || 0),
    0,
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="payslip-modal" onClick={(e) => e.stopPropagation()}>
        <div className="payslip-header">
          <div>
            <div className="payslip-brand">DUNKIN</div>
            <div className="payslip-title"></div>
          </div>

          <button className="close-btn" onClick={onClose}>
            
          </button>
        </div>

        <div className="payslip-net-banner">
          <span className="payslip-net-label"></span>
          <strong className="payslip-net-amount">{fmtKRW(netPay)}</strong>
        </div>

        <div className="payslip-info-grid">
          {[
            ["", "  "],
            [" ", "   311 301 100"],
            ["", `${monthRange.label} `],
            ["", emp.name],
            ["", monthRange.payDateLabel],
            [" ", formatMinutesToHourLabel(totalBasePlannedMin)],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>

        <div className="payslip-section-title"></div>
        <div className="payslip-pay-grid">
          <PayItem label="" amount={basePay} />
          <PayItem label=" " amount={extraPay} />
          <PayItem label="" amount={totalPay} highlight />
        </div>

        <div className="payslip-section-title"></div>
        <div className="payslip-deduct-grid">
          <div className="payslip-deduct-item total">
            <span></span>
            <strong>0</strong>
          </div>
        </div>

        <div className="payslip-section-title"> </div>
        <div className="payslip-table">
          <div className="payslip-row header payslip-row-4">
            <span></span>
            <span> </span>
            <span></span>
            <span> </span>
          </div>

          {emp.days.map((d, i) => {
            const dayKr = DAY_KR[new Date(d.date).getDay()];
            const dayBasePay = Math.round(d.payrollBasePay || 0);
            const dayExtraPay = Math.round(d.payrollExtraPay || 0);

            return (
              <div key={i} className="payslip-row payslip-row-4">
                <span>
                  {d.date.slice(5)} ({dayKr})
                </span>
                <span>
                  {formatTime(d.planned_start)} ~ {formatTime(d.planned_end)}
                </span>
                <span>{fmtKRW(dayBasePay)}</span>
                <span>{fmtKRW(dayExtraPay)}</span>
              </div>
            );
          })}
        </div>

        <div className="payslip-summary">
          <div className="ps-row">
            <span> </span>
            <span>{formatMinutesToHourLabel(totalBasePlannedMin)}</span>
          </div>
          <div className="ps-row">
            <span></span>
            <span>{fmtKRW(basePay)}</span>
          </div>
          <div className="ps-row">
            <span> </span>
            <span>{fmtKRW(extraPay)}</span>
          </div>
          <div className="ps-row">
            <span></span>
            <span>0</span>
          </div>
          <div className="ps-row total">
            <span></span>
            <span>{fmtKRW(netPay)}</span>
          </div>
        </div>

        <div className="payslip-foot">
          <div>
                 {monthRange.label}  {" "}
            {monthRange.payDateLabel}  .
          </div>

          <div style={{ marginTop: 8 }}>   .</div>
        </div>

        <button className="payslip-print-btn" onClick={() => window.print()}>
           
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
