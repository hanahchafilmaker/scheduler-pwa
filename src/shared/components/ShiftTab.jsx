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

function getEntries(schedule, date) {
  return schedule.filter((s) => normalizeDate(s.date) === date);
}

function getEntry(schedule, date, part) {
  return schedule.find((s) => s.part === part && normalizeDate(s.date) === date) || null;
}

/* ════════════════════════════════════════════
   셀 편집 팝오버
   - 직원 선택 드롭다운 + 저장/취소/삭제
   ════════════════════════════════════════════ */
function CellPopover({ entry, date, part, employees, onSaveCell, onClose, anchorRef }) {
  const [selectedId, setSelectedId] = useState(entry?.employee_id || "");
  const popRef = useRef(null);

  // 바깥 클릭 닫기
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

  const handleSave = () => {
    onSaveCell({ date, part, scheduleId: entry?.schedule_id || "" }, selectedId);
    onClose();
  };

  const handleDelete = () => {
    if (!entry?.schedule_id) {
      onClose();
      return;
    }
    onSaveCell(
      { date, part, scheduleId: entry.schedule_id },
      "", // employeeId 없으면 delete
    );
    onClose();
  };

  const shift = SHIFT_TIME[part] || {};
  const partLabel = PART_LABEL[part] || part;

  return (
    <div
      ref={popRef}
      className="cell-popover"
      style={{
        position: "absolute",
        zIndex: 200,
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        boxShadow: "0 8px 24px rgba(0,0,0,0.13)",
        padding: "14px 16px",
        minWidth: 220,
        top: "calc(100% + 6px)",
        left: 0,
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
          padding: "7px 10px",
          borderRadius: 6,
          border: "1px solid #d1d5db",
          fontSize: 13,
          marginBottom: 10,
          cursor: "pointer",
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

/* ════════════════════════════════════════════
   공통 헤더
   ════════════════════════════════════════════ */
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

/* ════════════════════════════════════════════
   데스크탑 테이블
   ════════════════════════════════════════════ */
function DesktopShiftTable({
  weekDates,
  weekOffset,
  setWeekOffset,
  schedule,
  employees,
  todayDate,
  onSaveCell,
}) {
  // { key: "date_part" } → true
  const [openCell, setOpenCell] = useState(null);
  const cellRefs = useRef({});

  const toggleCell = (key) => setOpenCell((prev) => (prev === key ? null : key));

  return (
    <>
      <ShiftHeader weekDates={weekDates} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />

      <div className="card shift-card-table" style={{ padding: 0, overflow: "hidden" }}>
        <div className="shift-wrap">
          <table className="shift-table shift-grid">
            <thead>
              <tr>
                <th className="part-col">파트</th>
                {weekDates.map((d) => {
                  const meta = formatDayLabel(d);
                  const isToday = d === todayDate;
                  return (
                    <th
                      key={d}
                      className={`date-col ${isToday ? "today" : ""}`}
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
                    <strong>{PART_LABEL[part] || part}</strong>
                    <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400, marginTop: 2 }}>
                      {SHIFT_TIME[part] ? `${SHIFT_TIME[part].start}~${SHIFT_TIME[part].end}` : ""}
                    </div>
                  </td>

                  {weekDates.map((date) => {
                    const cellKey = `${date}_${part}`;
                    const entry = getEntry(schedule, date, part);
                    const isToday = date === todayDate;
                    const isOpen = openCell === cellKey;

                    if (!cellRefs.current[cellKey]) {
                      cellRefs.current[cellKey] = { current: null };
                    }

                    return (
                      <td
                        key={cellKey}
                        className={`shift-cell editable ${isToday ? "today" : ""} ${isOpen ? "active" : ""}`}
                        style={{ position: "relative", cursor: "pointer" }}
                        ref={(el) => {
                          cellRefs.current[cellKey] = { current: el };
                        }}
                        onClick={() => toggleCell(cellKey)}
                      >
                        {entry ? (
                          <div className="shift-cell-filled">
                            <span className="cell-name">{PART_LABEL[part] || part}</span>
                            <span className="cell-employee-mini">{entry.name}</span>
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

/* ════════════════════════════════════════════
   모바일 카드
   ════════════════════════════════════════════ */
function MobileShiftCards({
  weekDates,
  weekOffset,
  setWeekOffset,
  schedule,
  employees,
  todayDate,
  onSaveCell,
}) {
  const [openCell, setOpenCell] = useState(null);
  const cardRefs = useRef({});

  const toggleCell = (key) => setOpenCell((prev) => (prev === key ? null : key));

  return (
    <>
      <ShiftHeader weekDates={weekDates} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />

      <div className="shift-mobile-list">
        {weekDates.map((date) => {
          const meta = formatDayLabel(date);
          const entries = getEntries(schedule, date);
          const isToday = date === todayDate;

          return (
            <section key={date} className={`shift-day-card ${isToday ? "today" : ""}`}>
              <div className="shift-day-header">
                <div className="shift-day-left">
                  <strong style={{ color: meta.color }}>{meta.day}</strong>
                  <span>{meta.shortDate}</span>
                  {isToday ? <em className="today-badge">오늘</em> : null}
                </div>
                <div className="shift-day-right">{date}</div>
              </div>

              <div className="shift-day-parts">
                {PARTS.map((part) => {
                  const cellKey = `${date}_${part}`;
                  const entry = entries.find((e) => e.part === part);
                  const shift = SHIFT_TIME[part] || {};
                  const isOpen = openCell === cellKey;

                  if (!cardRefs.current[cellKey]) {
                    cardRefs.current[cellKey] = { current: null };
                  }

                  return (
                    <div
                      key={cellKey}
                      ref={(el) => {
                        cardRefs.current[cellKey] = { current: el };
                      }}
                      className={`shift-part-card editable ${entry ? "filled" : "empty"} ${isOpen ? "active" : ""}`}
                      style={{ position: "relative", cursor: "pointer" }}
                      onClick={() => toggleCell(cellKey)}
                    >
                      <div className="shift-part-top">
                        <span className="shift-part-name">{PART_LABEL[part] || part}</span>
                        <span className="shift-part-time">
                          {shift.start} ~ {shift.end}
                        </span>
                      </div>

                      <div className="shift-part-bottom">
                        {entry ? (
                          <strong className="shift-part-employee">{entry.name}</strong>
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
                        />
                      )}
                    </div>
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

/* ════════════════════════════════════════════
   메인 export — props 시그니처 유지
   employees / onSaveCell 추가 수신
   ════════════════════════════════════════════ */
export function ShiftTab({
  weekDates = [],
  weekOffset = 0,
  setWeekOffset,
  schedule = [],
  employees = [], // App.jsx에서 이미 전달 중
  onSaveCell, // App.jsx에서 이미 전달 중
}) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 768 : false,
  );

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
  };

  return (
    <div className="page">
      {isMobile ? <MobileShiftCards {...sharedProps} /> : <DesktopShiftTable {...sharedProps} />}
    </div>
  );
}
