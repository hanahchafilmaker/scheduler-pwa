// src/shared/components/ShiftTab.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { PARTS, PART_LABEL, SHIFT_TIME } from "../constants";
import { normalizeDate } from "../utils";
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

function CellPopover({ entry, date, part, employees, onSaveCell, onClose, anchorRef, onToast }) {
  const [selectedId, setSelectedId] = useState(entry?.employee_id || "");
  const [memo, setMemo] = useState(entry?.memo || "");
  const [position, setPosition] = useState({ top: "calc(100% + 6px)", left: 0 });
  const popRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (
        popRef.current &&
        !popRef.current.contains(e.target) &&
        anchorRef?.current &&
        !anchorRef.current.contains(e.target)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, anchorRef]);

  useEffect(() => {
    const anchor = anchorRef?.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const popoverH = 320;
    const popoverW = 240;

    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const isBottom = spaceBelow < popoverH && spaceAbove > spaceBelow;
    const isRight = rect.right > viewportWidth - popoverW;

    setPosition({
      top: isBottom ? "auto" : "calc(100% + 6px)",
      bottom: isBottom ? "calc(100% + 6px)" : "auto",
      left: isRight ? "auto" : 0,
      right: isRight ? 0 : "auto",
    });
  }, [anchorRef]);

  const handleSave = () => {
    onSaveCell({ date, part, scheduleId: entry?.schedule_id || "", memo }, selectedId);
    onClose();
    if (onToast) onToast(selectedId ? "저장되었습니다" : "배정이 해제되었습니다");
  };

  const handleDelete = () => {
    if (!entry?.schedule_id) {
      onClose();
      return;
    }
    onSaveCell({ date, part, scheduleId: entry.schedule_id, memo: "" }, "");
    onClose();
    if (onToast) onToast("삭제되었습니다");
  };

  const shift = SHIFT_TIME[part] || {};
  const partLabel = PART_LABEL[part] || part;

  return (
    <div
      ref={popRef}
      className="cell-popover"
      style={{
        position: "absolute",
        zIndex: 9999,
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        boxShadow: "0 10px 28px rgba(0,0,0,0.14)",
        padding: "14px 16px",
        minWidth: 220,
        ...position,
      }}
    >
      <div style={{ marginBottom: 10 }}>
        <strong style={{ fontSize: 13 }}>{partLabel}</strong>
        <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 6 }}>
          {shift.start} ~ {shift.end}
        </span>
        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{date}</div>
      </div>

      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid #d1d5db",
          fontSize: 13,
          marginBottom: 8,
        }}
        autoFocus
      >
        <option value="">— 미배정 —</option>
        {employees
          .filter((e) => e.active !== false)
          .map((e) => (
            <option key={e.employee_id} value={e.employee_id}>
              {e.name}
            </option>
          ))}
      </select>

      <textarea
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder="메모 (선택)"
        rows={2}
        style={{
          width: "100%",
          padding: "7px 10px",
          borderRadius: 8,
          border: "1px solid #d1d5db",
          fontSize: 12,
          resize: "none",
          marginBottom: 10,
          boxSizing: "border-box",
          color: "#374151",
        }}
      />

      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          className="att-btn primary small"
          style={{ flex: 1 }}
          onClick={handleSave}
        >
          저장
        </button>
        <button type="button" className="att-btn secondary small" onClick={onClose}>
          취소
        </button>
        {entry?.schedule_id && (
          <button
            type="button"
            className="att-btn secondary small"
            style={{ color: "#dc2626" }}
            onClick={handleDelete}
          >
            삭제
          </button>
        )}
      </div>
    </div>
  );
}

function ShiftHeader({ weekDates, weekOffset, setWeekOffset }) {
  const rangeLabel = weekDates.length === 7 ? `${weekDates[0]} – ${weekDates[6]}` : "";

  return (
    <div className="shift-tab-header">
      <div className="shift-header-copy">
        <h2>스케줄 관리</h2>
        <p>셀을 클릭해 직원을 배정하거나 수정합니다</p>
      </div>
      <div className="shift-header-controls">
        <div className="week-nav modern">
          <button type="button" onClick={() => setWeekOffset(weekOffset - 1)}>
            이전 주
          </button>
          <button type="button" onClick={() => setWeekOffset(0)}>
            이번 주
          </button>
          <button type="button" onClick={() => setWeekOffset(weekOffset + 1)}>
            다음 주
          </button>
        </div>
        <div className="shift-range-pill">{rangeLabel}</div>
      </div>
    </div>
  );
}

function DesktopShiftTable(props) {
  const { weekDates, weekOffset, setWeekOffset, schedule, employees, todayDate, onSaveCell, onToast } =
    props;
  const [openCell, setOpenCell] = useState(null);
  const cellRefs = useRef({});

  return (
    <>
      <ShiftHeader weekDates={weekDates} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />

      <div className="card shift-card-table" style={{ padding: 0, overflow: "visible" }}>
        <div className="shift-wrap" style={{ overflow: "visible" }}>
          <table className="shift-table shift-grid">
            <thead>
              <tr>
                <th className="part-col">파트</th>
                {weekDates.map((d) => {
                  const meta = formatDayLabel(d);
                  return (
                    <th
                      key={d}
                      className={`date-col ${d === todayDate ? "today" : ""}`}
                      style={{ color: meta.color }}
                    >
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
                    <strong>{PART_LABEL[part]}</strong>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>
                      {SHIFT_TIME[part]?.start}~{SHIFT_TIME[part]?.end}
                    </div>
                  </td>

                  {weekDates.map((date) => {
                    const cellKey = `${date}_${part}`;
                    const entry = getEntry(schedule, date, part);
                    const isOpen = openCell === cellKey;

                    return (
                      <td
                        key={cellKey}
                        className={`shift-cell editable ${isOpen ? "active" : ""}`}
                        style={{ position: "relative" }}
                        ref={(el) => (cellRefs.current[cellKey] = { current: el })}
                        onClick={() => setOpenCell(isOpen ? null : cellKey)}
                      >
                        {entry ? (
                          <div className="shift-cell-filled">
                            <span className="cell-name">{PART_LABEL[part]}</span>
                            <span className="cell-employee-mini">{entry.name}</span>
                            {entry.memo && (
                              <span style={{ fontSize: 10, color: "#9ca3af", marginTop: 2, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {entry.memo}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="cell-empty">＋</span>
                        )}

                        {isOpen && (
                          <CellPopover
                            entry={entry}
                            date={date}
                            part={part}
                            employees={employees}
                            onSaveCell={onSaveCell}
                            onClose={() => setOpenCell(null)}
                            anchorRef={cellRefs.current[cellKey]}
                            onToast={onToast}
                          />
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

function MobileShiftCards(props) {
  const { weekDates, weekOffset, setWeekOffset, schedule, employees, todayDate, onSaveCell, onToast } =
    props;
  const [openCell, setOpenCell] = useState(null);
  const cardRefs = useRef({});

  return (
    <>
      <ShiftHeader weekDates={weekDates} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />

      <div className="shift-mobile-list">
        {weekDates.map((date) => (
          <section key={date} className={`shift-day-card ${date === todayDate ? "today" : ""}`}>
            <div className="shift-day-parts">
              {PARTS.map((part) => {
                const cellKey = `${date}_${part}`;
                const entry = getEntry(schedule, date, part);
                const isOpen = openCell === cellKey;

                return (
                  <div
                    key={cellKey}
                    ref={(el) => (cardRefs.current[cellKey] = { current: el })}
                    className={`shift-part-card editable ${isOpen ? "active" : ""}`}
                    style={{ position: "relative", overflow: "visible" }}
                    onClick={() => setOpenCell(isOpen ? null : cellKey)}
                  >
                    <div className="shift-part-top">
                      <span className="shift-part-name">{PART_LABEL[part]}</span>
                      <span className="shift-part-time">
                        {SHIFT_TIME[part]?.start} ~ {SHIFT_TIME[part]?.end}
                      </span>
                    </div>

                    <div className="shift-part-bottom">
                      {entry ? (
                        <>
                          <strong className="shift-part-employee">{entry.name}</strong>
                          {entry.memo && (
                            <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 6 }}>
                              {entry.memo}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="shift-part-empty">＋ 배정</span>
                      )}
                    </div>

                    {isOpen && (
                      <CellPopover
                        entry={entry}
                        date={date}
                        part={part}
                        employees={employees}
                        onSaveCell={onSaveCell}
                        onClose={() => setOpenCell(null)}
                        anchorRef={cardRefs.current[cellKey]}
                        onToast={onToast}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
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
  onToast,
}) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const todayDate = useMemo(() => normalizeDate(new Date()), []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const sharedProps = {
    weekDates,
    weekOffset,
    setWeekOffset,
    schedule,
    employees,
    todayDate,
    onSaveCell,
    onToast,
  };

  return (
    <div className="page">
      {isMobile ? <MobileShiftCards {...sharedProps} /> : <DesktopShiftTable {...sharedProps} />}
    </div>
  );
}