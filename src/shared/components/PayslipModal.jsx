import "./PayslipModal.css";   // ← 이 줄 추가
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

  // 3.3% 원천징수 (소득세 3% + 지방소득세 0.3%)
  const withholdingTax = Math.round(totalPay * 0.033);
  const deductTotal = withholdingTax;
  const netPay = totalPay - deductTotal;

  const totalBasePlannedMin = (emp.days || []).reduce(
    (sum, d) => sum + Number(d.payrollBasePlannedMin || 0),
    0,
  );

  const totalLateMin = (emp.days || []).reduce(
    (sum, d) => sum + Number(d.payrollLateDeductMin || 0),
    0,
  );

  const totalEarlyMin = (emp.days || []).reduce(
    (sum, d) => sum + Number(d.payrollEarlyLeaveDeductMin || 0),
    0,
  );

  return (
    <div className="ps-overlay" onClick={onClose}>
      <div className="ps-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── 헤더 ── */}
        <div className="ps-header">
          <div className="ps-header-left">
            <span className="ps-brand">DUNKIN'</span>
            <h1 className="ps-doc-title">임금명세서</h1>
            <p className="ps-period">{monthRange.label} 근무분</p>
          </div>
          <div className="ps-header-right">
            <p className="ps-net-label">실수령액</p>
            <strong className="ps-net-amount">{fmtKRW(netPay)}</strong>
          </div>
          <button className="ps-close" onClick={onClose} aria-label="닫기">×</button>
        </div>

        {/* ── 기본 정보 밴드 ── */}
        <div className="ps-info-band">
          {[
            ["성명", emp.name],
            ["근무일수", `${(emp.days || []).length}일`],
            ["기본 근무시간", formatMinutesToHourLabel(totalBasePlannedMin)],
            ["사업장", "송도 랜드마크시티점"],
            ["임금산정기간", `${monthRange.label} 근무분`],
            ["지급일", monthRange.payDateLabel],
          ].map(([label, value]) => (
            <div key={label} className="ps-info-item">
              <span className="ps-info-label">{label}</span>
              <strong className="ps-info-value">{value}</strong>
            </div>
          ))}
        </div>

        {/* ── 지급 / 공제 2단 ── */}
        <div className="ps-pay-deduct-grid">
          <section className="ps-section">
            <h2 className="ps-section-title">지급내역</h2>
            <div className="ps-rows">
              <PayRow label="기본급" value={fmtKRW(basePay)} />
              <PayRow label="시간 외 추가수당" value={fmtKRW(extraPay)} />
              <div className="ps-divider" />
              <PayRow label="지급합계" value={fmtKRW(totalPay)} bold />
            </div>
          </section>

          <section className="ps-section">
            <h2 className="ps-section-title">공제내역</h2>
            <div className="ps-rows">
              {/* 3.3% 원천징수 */}
              <PayRow
                label="원천징수세 (3.3%)"
                value={`−${fmtKRW(withholdingTax)}`}
                danger
              />
              {totalLateMin > 0 && (
                <PayRow
                  label="지각공제"
                  value={`−${fmtKRW(Math.round((totalLateMin / 60) * (emp.wage || 0)))}`}
                  danger
                  sub={`${totalLateMin}분`}
                />
              )}
              {totalEarlyMin > 0 && (
                <PayRow
                  label="조퇴공제"
                  value={`−${fmtKRW(Math.round((totalEarlyMin / 60) * (emp.wage || 0)))}`}
                  danger
                  sub={`${totalEarlyMin}분`}
                />
              )}
              <div className="ps-divider" />
              <PayRow
                label="공제합계"
                value={`−${fmtKRW(deductTotal)}`}
                bold
                danger
              />
            </div>
          </section>
        </div>

        {/* ── 근무 상세 테이블 ── */}
        <section className="ps-section ps-section-full">
          <h2 className="ps-section-title">근무 상세</h2>
          <div className="ps-table-wrap">
            <table className="ps-table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>출근</th>
                  <th>퇴근</th>
                  <th>기본 근무시간</th>
                  <th className="align-right">기본급</th>
                  <th className="align-right">추가수당</th>
                </tr>
              </thead>
              <tbody>
                {emp.days.map((d, i) => {
                  const dayKr = DAY_KR[new Date(d.date).getDay()];
                  const dayBasePay = Math.round(d.payrollBasePay || 0);
                  const dayExtraPay = Math.round(d.payrollExtraPay || 0);
                  const isLate = Number(d.payrollLateDeductMin || 0) > 0;
                  const isEarly = Number(d.payrollEarlyLeaveDeductMin || 0) > 0;

                  return (
                    <tr key={i}>
                      <td className="ps-td-date">{d.date.slice(5)} ({dayKr})</td>
                      <td className={isLate ? "ps-td-warn" : ""}>
                        {formatTime(d.planned_start)}
                      </td>
                      <td className={isEarly ? "ps-td-warn" : ""}>
                        {formatTime(d.planned_end)}
                      </td>
                      <td>{formatMinutesToHourLabel(d.payrollBasePlannedMin || 0)}</td>
                      <td className="align-right ps-td-pos">{fmtKRW(dayBasePay)}</td>
                      <td className="align-right ps-td-extra">
                        {dayExtraPay > 0 ? `+${fmtKRW(dayExtraPay)}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="ps-tfoot-label">합계</td>
                  <td /><td />
                  <td>{formatMinutesToHourLabel(totalBasePlannedMin)}</td>
                  <td className="align-right">{fmtKRW(basePay)}</td>
                  <td className="align-right">+{fmtKRW(extraPay)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* ── 최종 수령액 요약 ── */}
        <div className="ps-summary-bar">
          <div className="ps-summary-items">
            <div className="ps-summary-item">
              <span>기본급</span>
              <strong>{fmtKRW(basePay)}</strong>
            </div>
            <span className="ps-summary-op">+</span>
            <div className="ps-summary-item">
              <span>추가수당</span>
              <strong>{fmtKRW(extraPay)}</strong>
            </div>
            <span className="ps-summary-op">−</span>
            <div className="ps-summary-item">
              <span>공제</span>
              <strong>{fmtKRW(deductTotal)}</strong>
            </div>
            <span className="ps-summary-op">=</span>
            <div className="ps-summary-item ps-summary-net">
              <span>실수령액</span>
              <strong>{fmtKRW(netPay)}</strong>
            </div>
          </div>
        </div>

        {/* ── 푸터 ── */}
        <div className="ps-foot">
          <p className="ps-foot-text">
            던킨 송도 랜드마크시티점은 위 금액을 {monthRange.label} 근무분 급여로{" "}
            {monthRange.payDateLabel} 지급함을 확인합니다. 이번 달도 근무해주셔서 감사합니다.
          </p>
          <button className="ps-print-btn" onClick={() => window.print()}>
            <PrintIcon /> 인쇄하기
          </button>
        </div>

      </div>
    </div>
  );
}

function PayRow({ label, value, bold, danger, muted, sub }) {
  return (
    <div className={`ps-pay-row${bold ? " ps-pay-row--bold" : ""}${muted ? " ps-pay-row--muted" : ""}`}>
      <span className="ps-pay-label">{label}{sub && <em className="ps-pay-sub">{sub}</em>}</span>
      <span className={`ps-pay-value${danger ? " ps-pay-value--danger" : ""}`}>{value}</span>
    </div>
  );
}

function PrintIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}