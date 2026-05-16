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
 *   npm install jspdf jszip file-saver html2canvas
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
// PDF 생성 (한 명) — html2canvas 방식으로 한글 깨짐 해결
// ─────────────────────────────────────────────────────────────────

async function createPdfBlob(emp, monthRange) {
  const grossPay = emp.payrollTotalPay;
  const tax = Math.round(grossPay * 0.033);
  const net = grossPay - tax;
  const DAY_KR = ["일", "월", "화", "수", "목", "금", "토"];

  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
    position: absolute; left: -9999px; top: 0;
    width: 794px; overflow: visible;
    pointer-events: none; z-index: -1;
  `;

  const container = document.createElement("div");
  // 외부 폰트(Noto Sans KR 등) 로드 실패 시 깨지므로 윈도우/맥 기본 한글 폰트만 사용
  container.style.cssText = `
    position: relative;
    width: 794px; background: white; padding: 40px;
    font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', 'Apple Gothic', sans-serif;
    box-sizing: border-box;
  `;

  wrapper.appendChild(container);

  container.innerHTML = `
    <div style="background:#111;color:#fff;padding:24px 32px;margin-bottom:24px">
      <div style="font-size:11px;color:#888;margin-bottom:8px">DUNKIN'</div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end">
        <div>
          <div style="font-size:22px;font-weight:500">${monthRange.label} 임금명세서</div>
          <div style="font-size:13px;color:#999;margin-top:4px">${monthRange.label} 근무분</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:12px;color:#999">실수령액</div>
          <div style="font-size:20px;font-weight:600">${fmtKRW(net)}</div>
        </div>
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#f7f7f7">
      <tr>
        <td style="padding:10px 16px;font-size:12px;color:#888">성명</td>
        <td style="padding:10px 16px;font-size:13px">${emp.name}</td>
        <td style="padding:10px 16px;font-size:12px;color:#888">근무일수</td>
        <td style="padding:10px 16px;font-size:13px">${(emp.days || []).length}일</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;font-size:12px;color:#888">사업장</td>
        <td style="padding:10px 16px;font-size:13px">송도 랜드마크시티점</td>
        <td style="padding:10px 16px;font-size:12px;color:#888">지급일</td>
        <td style="padding:10px 16px;font-size:13px">${monthRange.payDateLabel}</td>
      </tr>
    </table>

    <div style="display:flex;gap:24px;margin-bottom:24px">
      <div style="flex:1;border:1px solid #eee;padding:16px">
        <div style="font-size:11px;color:#aaa;margin-bottom:8px">지급내역</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:13px;color:#555">기본급</span>
          <span style="font-size:13px">${fmtKRW(emp.payrollBasePay)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:13px;color:#555">시간 외 추가수당</span>
          <span style="font-size:13px">${fmtKRW(emp.payrollExtraPay)}</span>
        </div>
        <div style="border-top:1px solid #eee;padding-top:8px;display:flex;justify-content:space-between">
          <span style="font-size:14px;font-weight:600">지급합계</span>
          <span style="font-size:14px;font-weight:600">${fmtKRW(emp.payrollTotalPay)}</span>
        </div>
      </div>
      <div style="flex:1;border:1px solid #eee;padding:16px">
        <div style="font-size:11px;color:#aaa;margin-bottom:8px">공제내역</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:13px;color:#d13f3f">원천징수세 (3.3%)</span>
          <span style="font-size:13px;color:#d13f3f">−${fmtKRW(tax)}</span>
        </div>
        <div style="border-top:1px solid #eee;padding-top:8px;display:flex;justify-content:space-between">
          <span style="font-size:14px;font-weight:600">공제합계</span>
          <span style="font-size:14px;font-weight:600;color:#d13f3f">−${fmtKRW(tax)}</span>
        </div>
      </div>
    </div>

    <div style="margin-bottom:8px;font-size:11px;color:#aaa">근무 상세</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="background:#f7f7f7">
          <th style="padding:8px;text-align:left;color:#aaa;font-weight:400">날짜</th>
          <th style="padding:8px;text-align:left;color:#aaa;font-weight:400">출근</th>
          <th style="padding:8px;text-align:left;color:#aaa;font-weight:400">퇴근</th>
          <th style="padding:8px;text-align:left;color:#aaa;font-weight:400">기본 근무시간</th>
          <th style="padding:8px;text-align:right;color:#aaa;font-weight:400">기본급</th>
          <th style="padding:8px;text-align:right;color:#aaa;font-weight:400">추가수당</th>
        </tr>
      </thead>
      <tbody>
        ${(emp.days || []).map((d) => {
          const dayKr = DAY_KR[new Date(d.date).getDay()];
          const baseMin = Number(d.payrollBasePlannedMin || 0);
          const h = Math.floor(baseMin / 60);
          const m2 = baseMin % 60;
          const dur = m2 === 0 ? `${h}시간` : `${h}시간 ${m2}분`;
          return `<tr style="border-bottom:1px solid #f5f5f5">
            <td style="padding:7px 8px">${d.date.slice(5)} (${dayKr})</td>
            <td style="padding:7px 8px">${d.planned_start?.slice(0, 5) || "-"}</td>
            <td style="padding:7px 8px">${d.planned_end?.slice(0, 5) || "-"}</td>
            <td style="padding:7px 8px">${dur}</td>
            <td style="padding:7px 8px;text-align:right">${fmtKRW(Math.round(d.payrollBasePay || 0))}</td>
            <td style="padding:7px 8px;text-align:right">${d.payrollExtraPay > 0 ? `+${fmtKRW(Math.round(d.payrollExtraPay))}` : "—"}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>

    <div style="background:#f7f7f7;padding:16px 20px;margin-top:16px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:13px;color:#555">
        지급합계 ${fmtKRW(emp.payrollTotalPay)} − 원천징수 ${fmtKRW(tax)} = 실수령액
      </span>
      <span style="font-size:16px;font-weight:700">${fmtKRW(net)}</span>
    </div>

    <div style="margin-top:20px;font-size:12px;color:#aaa">
      던킨 송도 랜드마크시티점은 위 금액을 ${monthRange.label} 근무분 급여로 ${monthRange.payDateLabel} 지급함을 확인합니다.
    </div>
  `;

  document.body.appendChild(wrapper);
  // wrapper 높이를 실제 콘텐츠 높이로 확보해야 html2canvas가 전체를 캡처합니다.
  wrapper.style.height = container.scrollHeight + "px";

  try {
    // 시스템 폰트 로드 완료 대기
    await document.fonts.ready;

    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      width: 794,
      height: container.scrollHeight,
      windowWidth: 794,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;

    if (imgH <= pageH) {
      doc.addImage(imgData, "JPEG", 0, 0, pageW, imgH);
    } else {
      // 페이지 넘침 처리
      let position = 0;
      doc.addImage(imgData, "JPEG", 0, position, pageW, imgH);
      while (position + imgH > pageH) {
        position -= pageH;
        doc.addPage();
        doc.addImage(imgData, "JPEG", 0, position, pageW, imgH);
      }
    }

    return doc.output("blob");
  } finally {
    document.body.removeChild(wrapper);
  }
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