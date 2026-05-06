import { useState, useMemo } from "react";
import { PARTS, SHIFT_TIME } from "../constants";
import { normalizeDate, safeStr } from "../utils";
import { Modal, Field } from "./UI";

const DAY_KO    = ["일", "월", "화", "수", "목", "금", "토"];
const DAY_COLOR = { 0: "#dc2626", 6: "#2563eb" };

export function ShiftTab({
  weekDates    = [],
  weekOffset   = 0,
  setWeekOffset,
  schedule     = [],
  employees    = [],
  onSaveCell,
}) {
  const [cellEdit,  setCellEdit]  = useState(null);
  const [cellEmpId, setCellEmpId] = useState("");

  // 1. 현재 시간 및 날짜 계산 로직
  const { todayStr, currentPart } = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const today = `${yyyy}-${mm}-${dd}`; // "2026-05-06"

    const hour = now.getHours();
    let part = "";
    // SHIFT_TIME 상의 시간 범위와 매칭 (이미지 기준)
    if (hour >= 7 && hour < 13) part = "open";
    else if (hour >= 13 && hour < 18) part = "middle";
    else if (hour >= 18 && hour < 23) part = "close";

    return { todayStr: today, currentPart: part };
  }, []);

  const openCell = (date, part) => {
    const existing = schedule.find(
      (s) => s.part === part && normalizeDate(s.date) === date
    );
    setCellEdit({
      date,
      part,
      scheduleId: existing?.schedule_id ?? existing?.id ?? null,
    });
    setCellEmpId(existing ? safeStr(existing.employee_id) : "");
  };

  const saveCell = () => {
    if (!cellEdit) return;
    onSaveCell(cellEdit, cellEmpId);
    setCellEdit(null);
  };

  const rangeLabel =
    weekDates.length === 7 ? `${weekDates[0]} – ${weekDates[6]}` : "";

  return (
    <div className="page">
      {/* ── 주간 네비게이션 ─────────────────────────────────────────────── */}
      <div className="shift-toolbar">
        <div className="week-nav">
          <button onClick={() => setWeekOffset(weekOffset - 1)}>‹</button>
          <button onClick={() => setWeekOffset(0)}>오늘</button>
          <button onClick={() => setWeekOffset(weekOffset + 1)}>›</button>
        </div>
        <span className="week-range">{rangeLabel}</span>
      </div>

      {/* ── 근무표 테이블 ──────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="shift-wrap">
          <table className="shift-table">
            <thead>
              <tr>
                <th className="part-col">파트</th>
                {weekDates.map((d) => {
                  const dow = new Date(d).getDay();
                  const isToday = d === todayStr; // 오늘 여부 확인
                  return (
                    <th 
                      key={d} 
                      style={{ 
                        color: DAY_COLOR[dow],
                        backgroundColor: isToday ? "#fff7ed" : "transparent" // 오늘 날짜 헤더 강조
                      }}
                    >
                      {DAY_KO[dow]}
                      <div className="date-sm" style={{ fontWeight: isToday ? "bold" : "normal" }}>
                        {d.slice(5)}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {PARTS.map((part) => (
                <tr key={part}>
                  <td 
                    className="part-label-cell"
                    style={{ backgroundColor: part === currentPart ? "#fff7ed" : "transparent" }}
                  >
                    <strong style={{ color: part === currentPart ? "#f97316" : "inherit" }}>
                      {part}
                    </strong>
                    <div className="time-hint">
                      {SHIFT_TIME[part]?.start}~{SHIFT_TIME[part]?.end}
                    </div>
                  </td>
                  {weekDates.map((date) => {
                    const entry = schedule.find(
                      (s) => s.part === part && normalizeDate(s.date) === date
                    );
                    
                    // 현재 활성화된 셀(오늘 + 현재 파트) 판별
                    const isNowActive = date === todayStr && part === currentPart;

                    return (
                      <td
                        key={date}
                        className={`shift-cell ${isNowActive ? "active-now-cell" : ""}`}
                        style={{
                          backgroundColor: isNowActive ? "#fff7ed" : (date === todayStr ? "#fafafa" : "white"),
                          border: isNowActive ? "2px solid #f97316" : "1px solid #eee",
                          position: "relative"
                        }}
                        onClick={() => openCell(date, part)}
                      >
                        {entry ? (
                          <span className="cell-name" style={{ fontWeight: isNowActive ? "800" : "400" }}>
                            {entry.name}
                          </span>
                        ) : (
                          <span className="cell-empty">+</span>
                        )}
                        {isNowActive && (
                          <div style={{
                            position: "absolute",
                            top: "2px",
                            right: "4px",
                            fontSize: "10px",
                            color: "#f97316",
                            fontWeight: "bold"
                          }}>NOW</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 셀 편집 모달 ──────────────────────────────────────────────── */}
      {cellEdit && (
        <Modal onClose={() => setCellEdit(null)}>
          <div className="modal-head">
            <strong>
              {cellEdit.date} · {cellEdit.part}
            </strong>
            <button className="close-btn" onClick={() => setCellEdit(null)}>
              ×
            </button>
          </div>

          <Field label="직원 선택">
            <select
              value={cellEmpId}
              onChange={(e) => setCellEmpId(e.target.value)}
            >
              <option value="">— 미배정 —</option>
              {employees
                .filter((e) => e.active !== false)
                .map((emp) => (
                  <option
                    key={emp.employee_id}
                    value={safeStr(emp.employee_id)}
                  >
                    {emp.name}
                  </option>
                ))}
            </select>
          </Field>

          <div className="modal-foot">
            <button className="ghost-sm" onClick={() => setCellEdit(null)}>
              취소
            </button>
            <button className="primary-sm" onClick={saveCell}>
              저장
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}