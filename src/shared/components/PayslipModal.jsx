import { fmtKRW, formatTime } from "../utils";

const DAY_KR = ["일", "월", "화", "수", "목", "금", "토"];

function formatMinutesToHourLabel(min) {
  const minutes = Number(min || 0);
  if (minutes <= 0) return "0시간";

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
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
            ["사업장명", "던킨 송도 랜드마크시티점"],
            ["사업장 주소", "인천광역시 연수구 송도동 311 301동 100호"],
            ["임금산정기간", `${monthRange.label} 근무분`],
            ["성명", emp.name],
            ["지급일", monthRange.payDateLabel],
            ["기본 근무시간", formatMinutesToHourLabel(totalBasePlannedMin)],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>

        <div className="payslip-section-title">지급내역</div>
        <div className="payslip-pay-grid">
          <PayItem label="기본급" amount={basePay} />
          <PayItem label="추가 수당" amount={extraPay} />
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
          <div className="payslip-row header payslip-row-4">
            <span>날짜</span>
            <span>스케줄 근무시간</span>
            <span>기본급</span>
            <span>추가 수당</span>
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
            <span>기본 근무시간</span>
            <span>{formatMinutesToHourLabel(totalBasePlannedMin)}</span>
          </div>
          <div className="ps-row">
            <span>기본급</span>
            <span>{fmtKRW(basePay)}</span>
          </div>
          <div className="ps-row">
            <span>추가 수당</span>
            <span>{fmtKRW(extraPay)}</span>
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
          <div>
            던킨 송도 랜드마크시티점은 위 금액을 {monthRange.label} 근무분 급여로{" "}
            {monthRange.payDateLabel} 지급함을 확인합니다.
          </div>
          <div style={{ marginTop: 8 }}>이번 달도 근무해주셔서 감사합니다.</div>
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
