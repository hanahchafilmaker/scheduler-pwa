import { fmtKRW, formatTime } from "../utils";

const DAY_KR = ["일", "월", "화", "수", "목", "금", "토"];

export function PayslipModal({ emp, monthRange, onClose }) {
  if (!emp) return null;

  const nightExtra = Math.round(emp.nightHours * emp.wage * 0.5);
  const basePay = Math.round(emp.hours * emp.wage);
  const weeklyHoliday = Math.round((emp.workDays / 5) * 8 * emp.wage);
  const totalPay = basePay + nightExtra + weeklyHoliday;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="payslip-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="payslip-header">
          <div>
            <div className="payslip-brand">DUNKIN' DONUTS</div>
            <div className="payslip-title">임금명세서</div>
          </div>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Meta info */}
        <div className="payslip-info-grid">
          {[
            ["사업장명", "던킨도너츠"],
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

        {/* Payment breakdown */}
        <div className="payslip-section-title">지급내역</div>
        <div className="payslip-pay-grid">
          <PayItem
            label="기본급 (월급)"
            amount={basePay}
            note={`${emp.hours.toFixed(1)}h × ${fmtKRW(emp.wage)}`}
          />
          <PayItem
            label="야간근로수당"
            amount={nightExtra}
            note={`야간 ${emp.nightHours.toFixed(1)}h × 50%`}
          />
          <PayItem label="주휴수당" amount={weeklyHoliday} note={`${emp.workDays}일 출근 기준`} />
          <PayItem label="지급합계" amount={totalPay} highlight />
        </div>

        {/* Deductions */}
        <div className="payslip-section-title">공제내역</div>
        <div className="payslip-deduct-grid">
          {["소득세", "지방소득세", "국민연금", "건강보험", "고용보험", "공제합계"].map((label) => (
            <div key={label} className="payslip-deduct-item">
              <span>{label}</span>
              <strong>-</strong>
            </div>
          ))}
        </div>

        {/* Work detail table */}
        <div className="payslip-section-title">근무 상세</div>
        <div className="payslip-table">
          <div className="payslip-row header">
            <span>날짜</span>
            <span>출근</span>
            <span>퇴근</span>
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
                  {(d.workMin / 60).toFixed(1)}h
                  {d.nightMin > 0 ? ` (야간 ${(d.nightMin / 60).toFixed(1)}h)` : ""}
                </span>
                <span>{fmtKRW(d.pay)}</span>
              </div>
            );
          })}
        </div>

        {/* Summary */}
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
            <span>{fmtKRW(totalPay)}</span>
          </div>
        </div>

        <div className="payslip-foot">
          위 금액을 {monthRange.label} 근무분 급여로 지급함을 확인합니다.
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
