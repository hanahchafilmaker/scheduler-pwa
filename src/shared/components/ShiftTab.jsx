import { useEffect, useMemo, useState } from "react";
import { PARTS, SHIFT_TIME } from "../constants";
import { normalizeDate, safeStr } from "../utils";
import { Modal, Field } from "./UI";
import "./ShiftTab.css";

const DAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
const DAY_COLOR = { 0: "#dc2626", 6: "#2563eb" };

function formatDayLabel(dateStr) {
  const d = new Date(dateStr);
  const day = DAY_KO[d.getDay()];
  return {
    day,
    shortDate: dateStr.slice(5),
    full: `${dateStr.slice(5)} (${day})`,
    color: DAY_COLOR[d.getDay()] || "#374151",
  };
}

function getEntry(schedule, date, part) {
  return schedule.find((s) => s.part === part && normalizeDate(s.date) === date) || null;
}

function DesktopShiftTable({ weekDates, weekOffset, setWeekOffset, schedule, openCell }) {
  const rangeLabel = weekDates.length === 7 ? `${weekDates[0]} – ${weekDates[6]}` : "";

  return (
    <>
      <div className="shift-toolbar">
        <div className="week-nav">
          <button type="button" onClick={() => setWeekOffset(weekOffset - 1)}>
            ‹
          </button>
          <button type="button" onClick={() => setWeekOffset(0)}>
            오늘
          </button>
          <button type="button" onClick={() => setWeekOffset(weekOffset + 1)}>
            ›
          </button>
        </div>
        <span className="week-range">{rangeLabel}</span>
      </div>

      <div className="card shift-card-table" style={{ padding: 0, overflow: "hidden" }}>
        <div className="shift-wrap">
          <table className="shift-table">
            <thead>
              <tr>
                <th className="part-col">파트</th>
                {weekDates.map((d) => {
                  const meta = formatDayLabel(d);
                  return (
                    <th key={d} style={{ color: meta.color }}>
                      {meta.day}
                      <div className="date-sm">{meta.shortDate}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {PARTS.map((part) => (
                <tr key={part}>
                  <td className="part-label-cell">
                    <strong>{part}</strong>
                    <div className="time-hint">
                      {SHIFT_TIME[part]?.start}~{SHIFT_TIME[part]?.end}
                    </div>
                  </td>

                  {weekDates.map((date) => {
                    const entry = getEntry(schedule, date, part);

                    return (
                      <td
                        key={`${date}_${part}`}
                        className={`shift-cell ${entry ? "filled" : "empty"}`}
                        onClick={() => openCell(date, part)}
                      >
                        {entry ? (
                          <div className="shift-cell-filled">
                            <span className="cell-name">{entry.name}</span>
                            <span className="cell-time-mini">
                              {SHIFT_TIME[part]?.start}~{SHIFT_TIME[part]?.end}
                            </span>
                          </div>
                        ) : (
                          <span className="cell-empty">+ 배정</span>
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
    </>
  );
}

function MobileShiftCards({ weekDates, weekOffset, setWeekOffset, schedule, openCell }) {
  const rangeLabel = weekDates.length === 7 ? `${weekDates[0]} – ${weekDates[6]}` : "";

  return (
    <>
      <div className="shift-toolbar shift-toolbar-mobile">
        <div className="week-nav">
          <button type="button" onClick={() => setWeekOffset(weekOffset - 1)}>
            ‹
          </button>
          <button type="button" onClick={() => setWeekOffset(0)}>
            오늘
          </button>
          <button type="button" onClick={() => setWeekOffset(weekOffset + 1)}>
            ›
          </button>
        </div>
        <span className="week-range">{rangeLabel}</span>
      </div>

      <div className="shift-mobile-list">
        {weekDates.map((date) => {
          const meta = formatDayLabel(date);

          return (
            <section key={date} className="shift-day-card">
              <div className="shift-day-header">
                <div className="shift-day-left">
                  <strong style={{ color: meta.color }}>{meta.day}</strong>
                  <span>{meta.shortDate}</span>
                </div>
                <div className="shift-day-right">{date}</div>
              </div>

              <div className="shift-day-parts">
                {PARTS.map((part) => {
                  const entry = getEntry(schedule, date, part);
                  const shift = SHIFT_TIME[part] || {};

                  return (
                    <button
                      key={`${date}_${part}`}
                      type="button"
                      className={`shift-part-card ${entry ? "filled" : "empty"}`}
                      onClick={() => openCell(date, part)}
                    >
                      <div className="shift-part-top">
                        <span className="shift-part-name">{part}</span>
                        <span className="shift-part-time">
                          {shift.start} ~ {shift.end}
                        </span>
                      </div>

                      <div className="shift-part-bottom">
                        {entry ? (
                          <strong className="shift-part-employee">{entry.name}</strong>
                        ) : (
                          <span className="shift-part-empty">+ 직원 배정</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

export function ShiftTab({
  weekDates = [],
  weekOffset = 0,
  setWeekOffset,
  schedule = [],
  employees = [],
  onSaveCell,
}) {
  const [cellEdit, setCellEdit] = useState(null);
  const [cellEmpId, setCellEmpId] = useState("");
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 768 : false,
  );

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const activeEmployees = useMemo(() => employees.filter((e) => e.active !== false), [employees]);

  const openCell = (date, part) => {
    const existing = schedule.find((s) => s.part === part && normalizeDate(s.date) === date);

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

  return (
    <div className="page">
      {isMobile ? (
        <MobileShiftCards
          weekDates={weekDates}
          weekOffset={weekOffset}
          setWeekOffset={setWeekOffset}
          schedule={schedule}
          openCell={openCell}
        />
      ) : (
        <DesktopShiftTable
          weekDates={weekDates}
          weekOffset={weekOffset}
          setWeekOffset={setWeekOffset}
          schedule={schedule}
          openCell={openCell}
        />
      )}

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
            <select value={cellEmpId} onChange={(e) => setCellEmpId(e.target.value)}>
              <option value="">— 미배정 —</option>
              {activeEmployees.map((emp) => (
                <option key={emp.employee_id} value={safeStr(emp.employee_id)}>
                  {emp.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="modal-foot">
            <button type="button" className="ghost-sm" onClick={() => setCellEdit(null)}>
              취소
            </button>
            <button type="button" className="primary-sm" onClick={saveCell}>
              저장
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
