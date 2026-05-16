/**
 * PayrollAdminPanel.jsx
 *
 * 관리자 급여 정산 패널
 *
 * Props:
 *   employees    – [{ id, name, email, wage, hourly_wage, ... }]
 *   attendance   – [{ employee_id, date, ... payroll 필드들 }]
 *   activeMonth  – "2026-05" 형태 문자열
 *
 * 의존 라이브러리 (설치 필요):
 *   npm install jspdf jszip file-saver
 *
 * 의존 내부 모듈:
 *   ../utils                                        → fmtKRW
 *   ../shared/domain/attendance/settlement/buildSettlement
 *                                                   → buildSettlement({ attendance, employees, month })
 *                                                     반환: { rows, totalPayrollPay, totalWorkDays }
 *   ./PayslipModal                                  → PayslipModal
 *
 * Supabase Edge Function:
 *   supabase/functions/send-payroll-mails/index.ts
 */

import { useState, useMemo, useCallback } from "react";
import jsPDF from "jspdf";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { fmtKRW } from "../utils";
import { buildSettlement } from "../domain/attendance/settlement/buildSettlement";
import { PayslipModal } from "./PayslipModal";
import "./PayrollAdminPanel.css";

// ─────────────────────────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ─────────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────────

/** "2026-05" → { label: "2026년 5월", payDateLabel: "2026년 6월 10일" } */
function buildMonthRange(activeMonth) {
  if (!activeMonth) return { label: "", payDateLabel: "" };
  const [y, m] = activeMonth.split("-").map(Number);
  const payMonth = m === 12 ? 1 : m + 1;
  const payYear  = m === 12 ? y + 1 : y;
  return {
    label:        `${y}년 ${m}월`,
    payDateLabel: `${payYear}년 ${payMonth}월 10일`,
  };
}

/**
 * buildSettlement({ attendance, employees, month }) 의 실제 반환 구조:
 *   {
 *     rows: [{
 *       employee_id, name, wage, workDays,
 *       payrollBasePay, payrollExtraPay, payrollBasePlannedHours,
 *       days: [{ date, part, planned_start, planned_end, check_in, check_out,
 *               payrollBasePlannedMin, payrollBasePay, payrollExtraPay }]
 *     }],
 *     totalPayrollPay,
 *     totalWorkDays,
 *   }
 *
 * 이 헬퍼는 위 rows 배열을 employees props의 email 등 UI 전용 필드와 병합합니다.
 */
function buildSettledEmps(employees, attendance, activeMonth) {
  // buildSettlement 는 approved / auto_closed 행만 내부에서 필터링합니다.
  const { rows = [] } = buildSettlement({
    attendance: attendance || [],
    employees:  (employees || []).map((e) => ({
      // buildSettlement 는 employee_id 키를 기대합니다.
      employee_id:  e.id ?? e.employee_id,
      name:         e.name,
      hourly_wage:  e.hourly_wage ?? e.wage ?? 0,
    })),
    month: activeMonth || "",
  });

  // rows 에 없는 직원(해당 월 근무 없음)도 리스트에 표시하기 위해
  // employees 전체를 기준으로 병합합니다.
  return (employees || []).map((emp) => {
    const empId = String(emp.id ?? emp.employee_id);
    const row   = rows.find((r) => String(r.employee_id) === empId);

    if (row) {
      return {
        ...emp,                          // email 등 UI 전용 필드 유지
        name:            row.name || emp.name,
        wage:            row.wage,
        days:            row.days || [],
        payrollBasePay:  Math.round(row.payrollBasePay),
        payrollExtraPay: Math.round(row.payrollExtraPay),
        payrollTotalPay: Math.round(row.payrollBasePay + row.payrollExtraPay),
      };
    }

    // 해당 월 정산 행 없음 (미출근 or 미승인 전체)
    return {
      ...emp,
      days:            [],
      payrollBasePay:  0,
      payrollExtraPay: 0,
      payrollTotalPay: 0,
    };
  });
}

// ─────────────────────────────────────────────────────────────────
// PDF 생성 (한 명)
// ─────────────────────────────────────────────────────────────────

async function createPdfBlob(emp, monthRange) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  let y = 0;

  // ── 헤더 배경
  doc.setFillColor(17, 17, 17);
  doc.rect(0, 0, W, 44, "F");

  // ── DUNKIN' 브랜드
  doc.setFontSize(7);
  doc.setTextColor(136, 136, 136);
  doc.text("DUNKIN'", 20, 10);

  // ── 임금명세서 타이틀
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("임금명세서", 20, 22);

  // ── 기간
  doc.setFontSize(9);
  doc.setTextColor(153, 153, 153);
  doc.text(`${monthRange.label} 근무분`, 20, 30);

  // ── 실수령액 (우측) — 3.3% 차감 후
  const grossPay   = emp.payrollTotalPay;
  const taxPreview = Math.round(grossPay * 0.033);
  const netPreview = grossPay - taxPreview;
  doc.setFontSize(8);
  doc.setTextColor(136, 136, 136);
  doc.text("실수령액", W - 20, 18, { align: "right" });
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(fmtKRW(netPreview), W - 20, 28, { align: "right" });

  y = 52;

  // ── 기본정보 밴드
  doc.setFillColor(247, 247, 247);
  doc.rect(0, 44, W, 26, "F");
  doc.setDrawColor(235, 235, 235);
  doc.line(0, 70, W, 70);

  const infoItems = [
    ["성명", emp.name],
    ["근무일수", `${(emp.days || []).length}일`],
    ["사업장", "송도 랜드마크시티점"],
    ["지급일", monthRange.payDateLabel],
  ];

  infoItems.forEach(([label, value], i) => {
    const x = 20 + (i % 2) * 85;
    const iy = 53 + Math.floor(i / 2) * 9;
    doc.setFontSize(7);
    doc.setTextColor(136, 136, 136);
    doc.text(label, x, iy);
    doc.setFontSize(8.5);
    doc.setTextColor(17, 17, 17);
    doc.text(String(value), x + 22, iy);
  });

  y = 78;

  // ── 지급/공제 2단
  const col = (W - 40) / 2;

  // 지급
  doc.setFontSize(7);
  doc.setTextColor(170, 170, 170);
  doc.text("지급내역", 20, y);
  y += 7;

  [
    ["기본급", emp.payrollBasePay],
    ["시간 외 추가수당", emp.payrollExtraPay],
  ].forEach(([label, val]) => {
    doc.setFontSize(9);
    doc.setTextColor(85, 85, 85);
    doc.text(label, 20, y);
    doc.setTextColor(17, 17, 17);
    doc.text(fmtKRW(val), 20 + col - 5, y, { align: "right" });
    y += 7;
  });

  doc.setDrawColor(235, 235, 235);
  doc.line(20, y, 20 + col - 5, y);
  y += 4;
  doc.setFontSize(9.5);
  doc.setTextColor(17, 17, 17);
  doc.text("지급합계", 20, y);
  doc.setFont(undefined, "bold");
  doc.text(fmtKRW(emp.payrollTotalPay), 20 + col - 5, y, { align: "right" });
  doc.setFont(undefined, "normal");

  // 공제 (우측 컬럼)
  const withholdingTax = Math.round(emp.payrollTotalPay * 0.033);
  const netPay = emp.payrollTotalPay - withholdingTax;
  const cx = 20 + col + 10;
  let cy = 78;
  doc.setFontSize(7);
  doc.setTextColor(170, 170, 170);
  doc.text("공제내역", cx, cy);
  cy += 7;
  doc.setFontSize(9);
  doc.setTextColor(209, 63, 63);
  doc.text("원천징수세 (3.3%)", cx, cy);
  doc.text(`−${fmtKRW(withholdingTax)}`, cx + col - 5, cy, { align: "right" });
  cy += 7;
  doc.setDrawColor(235, 235, 235);
  doc.line(cx, cy, cx + col - 5, cy);
  cy += 4;
  doc.setFontSize(9.5);
  doc.setTextColor(17, 17, 17);
  doc.text("공제합계", cx, cy);
  doc.setTextColor(209, 63, 63);
  doc.text(`−${fmtKRW(withholdingTax)}`, cx + col - 5, cy, { align: "right" });
  doc.setTextColor(17, 17, 17);

  y += 16;

  // ── 구분선
  doc.setDrawColor(235, 235, 235);
  doc.line(0, y, W, y);
  y += 8;

  // ── 근무 상세 테이블
  doc.setFontSize(7);
  doc.setTextColor(170, 170, 170);
  doc.text("근무 상세", 20, y);
  y += 6;

  const headers = ["날짜", "출근", "퇴근", "기본 근무시간", "기본급", "추가수당"];
  const colWidths = [28, 22, 22, 38, 34, 26];
  let cx2 = 20;

  doc.setFontSize(7);
  doc.setTextColor(170, 170, 170);
  headers.forEach((h, i) => {
    doc.text(h, cx2, y, { align: i >= 4 ? "right" : "left" });
    cx2 += colWidths[i];
  });
  y += 2;
  doc.setDrawColor(235, 235, 235);
  doc.line(20, y, W - 20, y);
  y += 5;

  const DAY_KR = ["일", "월", "화", "수", "목", "금", "토"];

  (emp.days || []).forEach((d) => {
    if (y > 270) { doc.addPage(); y = 20; }
    const dayKr = DAY_KR[new Date(d.date).getDay()];
    const baseMin = Number(d.payrollBasePlannedMin || 0);
    const h = Math.floor(baseMin / 60);
    const m2 = baseMin % 60;
    const durationLabel = m2 === 0 ? `${h}시간` : `${h}시간 ${m2}분`;

    const cells = [
      `${d.date.slice(5)} (${dayKr})`,
      d.planned_start ? d.planned_start.slice(0, 5) : "-",
      d.planned_end   ? d.planned_end.slice(0, 5)   : "-",
      durationLabel,
      fmtKRW(Math.round(d.payrollBasePay  || 0)),
      d.payrollExtraPay > 0 ? `+${fmtKRW(Math.round(d.payrollExtraPay))}` : "—",
    ];

    cx2 = 20;
    doc.setFontSize(8);
    cells.forEach((cell, i) => {
      doc.setTextColor(i >= 4 ? 17 : 85, i >= 4 ? 17 : 85, i >= 4 ? 17 : 85);
      doc.text(cell, i >= 4 ? cx2 + colWidths[i] : cx2, y, { align: i >= 4 ? "right" : "left" });
      cx2 += colWidths[i];
    });

    doc.setDrawColor(245, 245, 245);
    doc.line(20, y + 2, W - 20, y + 2);
    y += 7;
  });

  y += 4;

  // ── 최종 수령액
  doc.setFillColor(247, 247, 247);
  doc.rect(0, y - 2, W, 18, "F");
  doc.setFontSize(8.5);
  doc.setTextColor(85, 85, 85);
  doc.text(`지급합계 ${fmtKRW(emp.payrollTotalPay)}  −  원천징수 ${fmtKRW(withholdingTax)}  =  실수령액`, 20, y + 6);
  doc.setFontSize(11);
  doc.setTextColor(17, 17, 17);
  doc.setFont(undefined, "bold");
  doc.text(fmtKRW(netPay), W - 20, y + 6, { align: "right" });
  doc.setFont(undefined, "normal");

  y += 22;

  // ── 푸터 텍스트
  doc.setFontSize(8);
  doc.setTextColor(170, 170, 170);
  const footerText = `던킨 송도 랜드마크시티점은 위 금액을 ${monthRange.label} 근무분 급여로 ${monthRange.payDateLabel} 지급함을 확인합니다.`;
  doc.text(footerText, 20, y, { maxWidth: W - 40 });

  return doc.output("blob");
}

/** Blob → base64 문자열 */
async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ─────────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────────────────

export function PayrollAdminPanel({ employees = [], attendance = [], activeMonth = "" }) {
  const monthRange = useMemo(() => buildMonthRange(activeMonth), [activeMonth]);

  // 직원별 정산 데이터 (메모이즈)
  const settledEmps = useMemo(
    () => buildSettledEmps(employees, attendance, activeMonth),
    [employees, attendance, activeMonth]
  );

  // 상태
  const [preview,      setPreview]      = useState(null);   // PayslipModal에 넘길 emp
  const [loadingAll,   setLoadingAll]   = useState(false);
  const [loadingZip,   setLoadingZip]   = useState(false);
  const [loadingMail,  setLoadingMail]  = useState(false);
  const [mailResults,  setMailResults]  = useState(null);   // { success, results }
  const [rowLoading,   setRowLoading]   = useState({});     // { [empId]: 'pdf'|'mail'|null }
  const [toast,        setToast]        = useState(null);   // string

  // ── 토스트
  const showToast = useCallback((msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── 개별 row 로딩 세터
  const setRowState = useCallback((id, state) => {
    setRowLoading((prev) => ({ ...prev, [id]: state }));
  }, []);

  // ── 이메일 유효 여부
  const hasEmail = (emp) => Boolean(emp.email && emp.email.includes("@"));

  // ─────────────────────
  // 액션: 직원 1명 PDF 다운로드
  // ─────────────────────
  const handleSinglePdf = useCallback(async (emp) => {
    setRowState(emp.id, "pdf");
    try {
      const blob = await createPdfBlob(emp, monthRange);
      saveAs(blob, `payroll_${emp.name}_${activeMonth}.pdf`);
      showToast(`${emp.name} PDF 저장 완료`);
    } catch (e) {
      console.error(e);
      showToast(`${emp.name} PDF 생성 실패`, true);
    } finally {
      setRowState(emp.id, null);
    }
  }, [monthRange, activeMonth, showToast, setRowState]);

  // ─────────────────────
  // 액션: 전체 PDF 미리보기용 (최초 직원 팝업 — 실제로는 ZIP 활용)
  // 전체 ZIP 다운로드
  // ─────────────────────
  const handleAllPdf = useCallback(async () => {
    setLoadingAll(true);
    try {
      const zip = new JSZip();
      for (const emp of settledEmps) {
        const blob = await createPdfBlob(emp, monthRange);
        zip.file(`payroll_${emp.name}_${activeMonth}.pdf`, blob);
      }
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `payroll_all_${activeMonth}.zip`);
      showToast("전체 PDF ZIP 저장 완료");
    } catch (e) {
      console.error(e);
      showToast("전체 PDF 생성 실패", true);
    } finally {
      setLoadingAll(false);
    }
  }, [settledEmps, monthRange, activeMonth, showToast]);

  // ─────────────────────
  // 액션: ZIP 다운로드 (전체와 동일, 별도 버튼)
  // ─────────────────────
  const handleZip = useCallback(async () => {
    setLoadingZip(true);
    try {
      const zip = new JSZip();
      for (const emp of settledEmps) {
        const blob = await createPdfBlob(emp, monthRange);
        zip.file(`payroll_${emp.name}_${activeMonth}.pdf`, blob);
      }
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `payroll_${activeMonth}.zip`);
      showToast("ZIP 다운로드 완료");
    } catch (e) {
      showToast("ZIP 생성 실패", true);
    } finally {
      setLoadingZip(false);
    }
  }, [settledEmps, monthRange, activeMonth, showToast]);

  // ─────────────────────
  // 액션: 전체 메일 발송
  // ─────────────────────
  const handleSendAll = useCallback(async () => {
    const validEmps = settledEmps.filter(hasEmail);
    if (validEmps.length === 0) {
      showToast("이메일 등록된 직원이 없습니다", true);
      return;
    }

    setLoadingMail(true);
    setMailResults(null);

    try {
      const payload = [];
      for (const emp of validEmps) {
        const blob      = await createPdfBlob(emp, monthRange);
        const pdfBase64 = await blobToBase64(blob);
        payload.push({
          employee_id: emp.id,
          name:        emp.name,
          email:       emp.email,
          month:       activeMonth,
          pdfBase64,
        });
      }

      const res  = await fetch(
        `${SUPABASE_URL}/functions/v1/send-payroll-mails`,
        {
          method: "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ employees: payload }),
        }
      );

      const data = await res.json();
      setMailResults(data);

      const failed = (data.results || []).filter((r) => !r.ok).length;
      if (failed > 0) {
        showToast(`${payload.length - failed}건 성공 / ${failed}건 실패`, true);
      } else {
        showToast(`${payload.length}명 메일 발송 완료 ✓`);
      }
    } catch (e) {
      console.error(e);
      showToast("메일 발송 중 오류 발생", true);
    } finally {
      setLoadingMail(false);
    }
  }, [settledEmps, monthRange, activeMonth, showToast]);

  // ─────────────────────
  // 액션: 직원 1명 메일 발송
  // ─────────────────────
  const handleSingleMail = useCallback(async (emp) => {
    if (!hasEmail(emp)) {
      showToast(`${emp.name}: 이메일 없음`, true);
      return;
    }
    setRowState(emp.id, "mail");
    try {
      const blob      = await createPdfBlob(emp, monthRange);
      const pdfBase64 = await blobToBase64(blob);

      const res  = await fetch(
        `${SUPABASE_URL}/functions/v1/send-payroll-mails`,
        {
          method: "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            employees: [{
              employee_id: emp.id,
              name:        emp.name,
              email:       emp.email,
              month:       activeMonth,
              pdfBase64,
            }],
          }),
        }
      );

      const data = await res.json();
      const ok   = data.results?.[0]?.ok;
      showToast(ok ? `${emp.name} 메일 발송 완료 ✓` : `${emp.name} 메일 발송 실패`, !ok);
    } catch (e) {
      showToast(`${emp.name} 메일 발송 오류`, true);
    } finally {
      setRowState(emp.id, null);
    }
  }, [monthRange, activeMonth, showToast, setRowState]);

  // ─────────────────────────────────────────────────────────────────
  // 집계
  // ─────────────────────────────────────────────────────────────────
  const totalPayroll  = settledEmps.reduce((s, e) => s + e.payrollTotalPay, 0);
  const emailCount    = settledEmps.filter(hasEmail).length;
  const noEmailCount  = settledEmps.length - emailCount;

  // ─────────────────────────────────────────────────────────────────
  // 렌더
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="pap-root">

      {/* ── 토스트 */}
      {toast && (
        <div className={`pap-toast${toast.isError ? " pap-toast--error" : ""}`}>
          {toast.msg}
        </div>
      )}

      {/* ── 헤더 */}
      <div className="pap-header">
        <div className="pap-header-left">
          <span className="pap-brand">DUNKIN'</span>
          <h1 className="pap-title">급여 정산</h1>
          <p className="pap-subtitle">{monthRange.label} 근무분 · 지급일 {monthRange.payDateLabel}</p>
        </div>
        <div className="pap-header-stats">
          <StatChip label="대상 직원" value={`${settledEmps.length}명`} />
          <StatChip label="총 인건비" value={fmtKRW(totalPayroll)} accent />
          <StatChip label="이메일 발송 가능" value={`${emailCount}명`} />
          {noEmailCount > 0 && <StatChip label="이메일 누락" value={`${noEmailCount}명`} warn />}
        </div>
      </div>

      {/* ── 상단 관리자 액션 */}
      <div className="pap-action-bar">
        <div className="pap-action-group">
          <button
            className="pap-btn pap-btn--primary"
            onClick={handleAllPdf}
            disabled={loadingAll || settledEmps.length === 0}
          >
            {loadingAll ? <Spinner /> : <IconPdf />}
            전체 PDF 생성
          </button>

          <button
            className="pap-btn pap-btn--secondary"
            onClick={handleZip}
            disabled={loadingZip || settledEmps.length === 0}
          >
            {loadingZip ? <Spinner /> : <IconZip />}
            ZIP 다운로드
          </button>

          <button
            className="pap-btn pap-btn--mail"
            onClick={handleSendAll}
            disabled={loadingMail || emailCount === 0}
          >
            {loadingMail ? <Spinner /> : <IconMail />}
            전체 메일 발송
            {emailCount > 0 && !loadingMail && (
              <span className="pap-btn-badge">{emailCount}</span>
            )}
          </button>
        </div>

        {noEmailCount > 0 && (
          <p className="pap-warn-note">
            <IconWarn /> {noEmailCount}명 이메일 미등록 — 직원 관리 탭에서 추가하세요
          </p>
        )}
      </div>

      {/* ── 메일 결과 패널 */}
      {mailResults && (
        <MailResultPanel results={mailResults.results || []} onClose={() => setMailResults(null)} />
      )}

      {/* ── 직원별 리스트 */}
      <div className="pap-list">
        {settledEmps.length === 0 ? (
          <div className="pap-empty">
            <p>{activeMonth ? "해당 월 데이터 없음" : "정산 월을 선택하세요"}</p>
          </div>
        ) : (
          settledEmps.map((emp) => {
            const canEmail = hasEmail(emp);
            const rloading = rowLoading[emp.id];
            return (
              <div key={emp.id} className={`pap-row${!canEmail ? " pap-row--no-email" : ""}`}>
                {/* 직원 정보 */}
                <div className="pap-row-info">
                  <div className="pap-row-avatar">{(emp.name || "?")[0]}</div>
                  <div className="pap-row-meta">
                    <strong className="pap-row-name">{emp.name}</strong>
                    {canEmail ? (
                      <span className="pap-row-email">{emp.email}</span>
                    ) : (
                      <span className="pap-row-email pap-row-email--missing">
                        <IconWarn size={11} /> 이메일 없음
                      </span>
                    )}
                  </div>
                </div>

                {/* 급여 요약 */}
                <div className="pap-row-pay">
                  <div className="pap-row-pay-item">
                    <span>기본급</span>
                    <strong>{fmtKRW(emp.payrollBasePay)}</strong>
                  </div>
                  <span className="pap-row-pay-op">+</span>
                  <div className="pap-row-pay-item">
                    <span>추가수당</span>
                    <strong className="pap-row-pay-extra">
                      {emp.payrollExtraPay > 0 ? `+${fmtKRW(emp.payrollExtraPay)}` : "—"}
                    </strong>
                  </div>
                  <span className="pap-row-pay-op">=</span>
                  <div className="pap-row-pay-item pap-row-pay-total">
                    <span>합계</span>
                    <strong>{fmtKRW(emp.payrollTotalPay)}</strong>
                  </div>
                </div>

                {/* 근무일 뱃지 */}
                <div className="pap-row-days">
                  <span>{(emp.days || []).length}일 근무</span>
                </div>

                {/* 액션 버튼 */}
                <div className="pap-row-actions">
                  <button
                    className="pap-icon-btn"
                    title="명세서 미리보기"
                    onClick={() => setPreview(emp)}
                  >
                    <IconEye />
                  </button>

                  <button
                    className="pap-icon-btn"
                    title="PDF 저장"
                    onClick={() => handleSinglePdf(emp)}
                    disabled={rloading === "pdf"}
                  >
                    {rloading === "pdf" ? <Spinner small /> : <IconPdf />}
                  </button>

                  <button
                    className={`pap-icon-btn${!canEmail ? " pap-icon-btn--disabled" : ""}`}
                    title={canEmail ? "메일 발송" : "이메일 없음"}
                    onClick={() => handleSingleMail(emp)}
                    disabled={!canEmail || rloading === "mail"}
                  >
                    {rloading === "mail" ? <Spinner small /> : <IconMail />}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── PayslipModal 미리보기 */}
      {preview && (
        <PayslipModal
          emp={preview}
          monthRange={monthRange}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// 서브 컴포넌트
// ─────────────────────────────────────────────────────────────────

function StatChip({ label, value, accent, warn }) {
  return (
    <div className={`pap-stat-chip${accent ? " pap-stat-chip--accent" : ""}${warn ? " pap-stat-chip--warn" : ""}`}>
      <span className="pap-stat-label">{label}</span>
      <strong className="pap-stat-value">{value}</strong>
    </div>
  );
}

function MailResultPanel({ results, onClose }) {
  const ok   = results.filter((r) => r.ok);
  const fail = results.filter((r) => !r.ok);

  return (
    <div className="pap-mail-result">
      <div className="pap-mail-result-header">
        <span>메일 발송 결과 — 성공 {ok.length}건 / 실패 {fail.length}건</span>
        <button className="pap-mail-result-close" onClick={onClose}>×</button>
      </div>
      <div className="pap-mail-result-rows">
        {results.map((r, i) => (
          <div key={i} className={`pap-mail-result-row${r.ok ? "" : " pap-mail-result-row--fail"}`}>
            <span>{r.ok ? "✓" : "✗"}</span>
            <span>{r.email || r.employee_id}</span>
            {!r.ok && r.reason && <span className="pap-mail-result-reason">{r.reason}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// 아이콘
// ─────────────────────────────────────────────────────────────────

function IconPdf() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}

function IconZip() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}

function IconMail() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}

function IconEye() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function IconWarn({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}

function Spinner({ small }) {
  return <span className={`pap-spinner${small ? " pap-spinner--sm" : ""}`} aria-label="로딩 중" />;
}