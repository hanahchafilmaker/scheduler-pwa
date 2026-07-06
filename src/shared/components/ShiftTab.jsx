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

function getEntries(schedule, date, part) {
  return schedule.filter((s) => s.part === part && normalizeDate(s.date) === date);
}

/* ----------------------------------------------------------------
   CellPopover (근무 셀 클릭 시 나타나는 배정 팝오버)
---------------------------------------------------------------- */
function CellPopover({ entries, date, part, employees, schedule, onSaveCell, onClose, anchorRef, onToast }) {
  const activeEmployees = employees.filter(e => e.active !== false);

  const initialNames = entries
    .map(e => {
      const emp = employees.find(emp => emp.employee_id === e.employee_id);
      return emp ? emp.name : null;
    })
    .filter(Boolean)
    .join(", ");

  const [nameInput, setNameInput] = useState(initialNames);
  const [memo, setMemo] = useState(entries.length > 0 ? entries[0].memo || "" : "");
  const [consecutiveByEmployee, setConsecutiveByEmployee] = useState({});
  const otherParts = PARTS.filter((p) => p !== part);
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
    const popoverW = 260;

    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const isBottom = spaceBelow < popoverH && spaceAbove > spaceBelow;
    const isRight = rect.right > viewportWidth - popoverW;

    setPosition({
      top: isBottom ? "auto" : "calc(100% + 6px)",
      bottom: isBottom ? "calc(100% + 6px)" : "auto",
      left: isRight ? "auto" : 0,
      right: isRight ? "0" : "auto",
    });
  }, [anchorRef]);

  const parsedSelection = useMemo(() => {
    const tokens = nameInput
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);

    const matchedIds = [];
    const unmatched = [];

    for (const token of tokens) {
      const emp = activeEmployees.find(
        e => e.name.trim().toLowerCase() === token.toLowerCase()
      );
      if (emp) {
        matchedIds.push(emp.employee_id);
      } else {
        unmatched.push(token);
      }
    }

    return {
      matchedIds: Array.from(new Set(matchedIds)),
      unmatched,
    };
  }, [nameInput, activeEmployees]);

  const selectedIds = parsedSelection.matchedIds;

  const toggleConsecutive = (empId, partId, checked) => {
    setConsecutiveByEmployee(prev => {
      const current = prev[empId] || [];
      const next = checked ? [...current, partId] : current.filter(p => p !== partId);
      return { ...prev, [empId]: next };
    });
  };

  const handleSave = async () => {
    if (parsedSelection.unmatched.length > 0) {
      if (onToast) {
        onToast(`일치하는 직원을 찾을 수 없습니다: ${parsedSelection.unmatched.join(", ")}`);
      }
      return;
    }

    await onSaveCell({ date, part, memo }, selectedIds);
    onClose();

    const anyConsecutive = Object.values(consecutiveByEmployee).some(list => list.length > 0);
    if (!anyConsecutive) {
      if (onToast) {
        if (selectedIds.length === 0) {
          onToast("배정이 해제되었습니다");
        } else if (selectedIds.length === 1) {
          onToast("저장되었습니다");
        } else {
          onToast(`${selectedIds.length}명 배정 완료`);
        }
      }
      return;
    }

    const affectedParts = new Set();
    for (const empId of selectedIds) {
      const parts = consecutiveByEmployee[empId] || [];
      for (const p of parts) affectedParts.add(p);
    }

    for (const p of Array.from(affectedParts)) {
      const existingForPart = getEntries(schedule, date, p)
        .map(s => s.employee_id)
        .filter(Boolean);
      const toAdd = selectedIds.filter(
        empId => (consecutiveByEmployee[empId] || []).includes(p)
      );
      const merged = Array.from(new Set([...existingForPart, ...toAdd]));
      await onSaveCell({ date, part: p, memo: "" }, merged);
    }

    if (onToast) {
      const extraCount = Array.from(affectedParts).length;
      const baseMsg = selectedIds.length === 0 ? "배정이 해제되었습니다"
        : selectedIds.length === 1 ? "저장되었습니다"
        : `${selectedIds.length}명 배정 완료`;
      if (extraCount > 0) {
        onToast(`${baseMsg} (연속근무 ${extraCount}개 파트 추가)`);
      } else {
        onToast(baseMsg);
      }
    }
  };

  const handleDelete = () => {
    onSaveCell({ date, part, memo: "" }, []);
    onClose();
    if (onToast) onToast("삭제되었습니다");
  };

  const shift = SHIFT_TIME[part] || {};
  const partLabel = PART_LABEL[part] || part;
  const datalistId = `emp-names-${date}-${part}`;

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
        minWidth: 260,
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

      <div style={{ marginBottom: 10 }}>
        <strong style={{ fontSize: 13, display: "block", marginBottom: 4 }}>
          직원 (쉼표로 구분, 여러 명 입력 가능)
        </strong>
        <input
          list={datalistId}
          type="text"
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          placeholder="예: 홍길동, 김철수"
          autoFocus
          style={{
            width: "100%",
            padding: "7px 10px",
            borderRadius: 8,
            border: `1px solid ${parsedSelection.unmatched.length > 0 ? "#dc2626" : "#d1d5db"}`,
            fontSize: 13,
            boxSizing: "border-box",
            color: "#374151",
          }}
        />
        <datalist id={datalistId}>
          {activeEmployees.map(e => (
            <option key={e.employee_id} value={e.name} />
          ))}
        </datalist>
        {parsedSelection.unmatched.length > 0 && (
          <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>
            일치하는 직원 없음: {parsedSelection.unmatched.join(", ")}
          </div>
        )}
        {selectedIds.length > 0 && parsedSelection.unmatched.length === 0 && (
          <div style={{ fontSize: 11, color: "#16a34a", marginTop: 4 }}>
            {selectedIds.length}명 인식됨
          </div>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <strong style={{ fontSize: 13, display: "block", marginBottom: 4 }}>
            연속근무 (각 직원에 대해 추가 파트 선택)
          </strong>
          {selectedIds.map(empId => {
            const emp = employees.find(e => e.employee_id === empId);
            const empName = emp ? emp.name : empId;
            const selectedParts = consecutiveByEmployee[empId] || [];
            return (
              <div key={empId} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                  <strong style={{ fontSize: 12, marginRight: 8 }}>{empName}:</strong>
                  {otherParts.map(p => (
                    <label key={p} style={{ display: "inline-flex", alignItems: "center", marginRight: 12 }}>
                      <input
                        type="checkbox"
                        checked={selectedParts.includes(p)}
                        onChange={e => toggleConsecutive(empId, p, e.target.checked)}
                        style={{ marginRight: 4 }}
                      />
                      <span>{PART_LABEL[p]}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <textarea
        value={memo}
        onChange={e => setMemo(e.target.value)}
        placeholder="메모 (선택)"
        rows={2}
        style={{
          width: "100%",
          padding: "7px 10px",
          borderRadius: 8,
          border: "1px solid #d1d5db",
          fontSize: 12,
          resize: "none",
          boxSizing: "border-box",
          color: "#374151",
          marginBottom: 8,
        }}
      />

      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" className="att-btn primary small" style={{ flex: 1 }} onClick={handleSave}>
          저장
        </button>
        <button type="button" className="att-btn secondary small" onClick={onClose}>
          취소
        </button>
        {entries.length > 0 && (
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

/* ----------------------------------------------------------------
   ShiftHeader (상단 주간 네비게이션 헤더)
---------------------------------------------------------------- */
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

/* ----------------------------------------------------------------
   DesktopShiftTable (PC용 시간표형 테이블)
---------------------------------------------------------------- */
function DesktopShiftTable(props) {
  const { weekDates, weekOffset, setWeekOffset, schedule, employees, todayDate, onSaveCell, onToast } = props;
  const [openCell, setOpenCell] = useState(null);
  const cellRefs = useRef({});

  const currentPart = useMemo(() => {
    const now = new Date();
    const hhmm = now.getHours() * 60 + now.getMinutes();
    return PARTS.find(p => {
      const [sh, sm] = SHIFT_TIME[p].start.split(":").map(Number);
      const [eh, em] = SHIFT_TIME[p].end.split(":").map(Number);
      return hhmm >= sh * 60 + sm && hhmm < eh * 60 + em;
    }) ?? null;
  }, []);

  return (
    <>
      <ShiftHeader weekDates={weekDates} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />

      <div className="shift-card-table" style={{ padding: 0, overflow: "visible" }}>
        <div className="shift-wrap" style={{ overflow: "visible" }}>
          <table className="shift-table shift-grid">
            <thead>
              <tr>
                <th className="part-col">파트</th>
                {weekDates.map(d => {
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
              {PARTS.map(part => (
                <tr key={part} className={currentPart === part ? "current-part" : ""}>
                  <td className="part-label-cell">
                    <strong>{PART_LABEL[part]}</strong>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>
                      {SHIFT_TIME[part]?.start}~{SHIFT_TIME[part]?.end}
                    </div>
                  </td>

                  {weekDates.map(date => {
                    const cellKey = `${date}_${part}`;
                    const entries = getEntries(schedule, date, part);
                    const isOpen = openCell === cellKey;
                    const isCurrentCell = currentPart === part && date === todayDate;

                    return (
                      <td
                        key={cellKey}
                        className={[
                          "shift-cell editable",
                          isOpen ? "active" : "",
                          isCurrentCell ? "current-part-cell" : "",
                        ].filter(Boolean).join(" ")}
                        style={{ position: "relative" }}
                        ref={el => (cellRefs.current[cellKey] = { current: el })}
                        onClick={() => setOpenCell(isOpen ? null : cellKey)}
                      >
                        {entries.length > 0 ? (
                          <div className="shift-cell-filled">
                            <span className="cell-name">{PART_LABEL[part]}</span>
                            <span className="cell-employee-mini">
                              {entries
                                .map(e => {
                                  const emp = employees.find(emp => emp.employee_id === e.employee_id);
                                  return emp ? emp.name : e.employee_id || "";
                                })
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                            {entries[0]?.memo && (
                              <span style={{ fontSize: 10, color: "#9ca3af", marginTop: 2, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {entries[0].memo}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="cell-empty">＋</span>
                        )}

                        {isOpen && (
                          <CellPopover
                            entries={entries}
                            date={date}
                            part={part}
                            employees={employees}
                            schedule={schedule}
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

/* ----------------------------------------------------------------
   MobileShiftCards (모바일용 일자별 카드 리스트)
---------------------------------------------------------------- */
function MobileShiftCards(props) {
  const { weekDates, weekOffset, setWeekOffset, schedule, employees, todayDate, onSaveCell, onToast } = props;
  const [openCell, setOpenCell] = useState(null);
  const cardRefs = useRef({});

  const currentPart = useMemo(() => {
    const now = new Date();
    const hhmm = now.getHours() * 60 + now.getMinutes();
    return PARTS.find(p => {
      const [sh, sm] = SHIFT_TIME[p].start.split(":").map(Number);
      const [eh, em] = SHIFT_TIME[p].end.split(":").map(Number);
      return hhmm >= sh * 60 + sm && hhmm < eh * 60 + em;
    }) ?? null;
  }, []);

  return (
    <>
      <ShiftHeader weekDates={weekDates} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />

      <div className="shift-mobile-list">
        {weekDates.map(date => {
          const meta = formatDayLabel(date);
          return (
            <section key={date} className={`shift-day-card ${date === todayDate ? "today" : ""}`}>
              <div className="shift-mobile-day-title" style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6", fontWeight: "bold", fontSize: 14, color: meta.color }}>
                {meta.full} {date === todayDate && <span style={{ fontSize: 11, background: "#eff6ff", color: "#2563eb", padding: "2px 6px", borderRadius: 4, marginLeft: 6 }}>오늘</span>}
              </div>

              <div className="shift-day-parts">
                {PARTS.map(part => {
                  const cellKey = `${date}_${part}`;
                  const entries = getEntries(schedule, date, part);
                  const isOpen = openCell === cellKey;

                  return (
                    <div
                      key={cellKey}
                      ref={el => (cardRefs.current[cellKey] = { current: el })}
                      className={[
                        "shift-part-card editable",
                        isOpen ? "active" : "",
                        currentPart === part && date === todayDate ? "current-part" : "",
                      ].filter(Boolean).join(" ")}
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
                        {entries.length > 0 ? (
                          <>
                            <strong className="shift-part-employee">
                              {entries
                                .map(e => {
                                  const emp = employees.find(emp => emp.employee_id === e.employee_id);
                                  return emp ? emp.name : e.employee_id || "";
                                })
                                .filter(Boolean)
                                .join(", ")}
                            </strong>
                            {entries[0]?.memo && (
                              <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 6 }}>
                                {entries[0].memo}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="shift-part-empty">＋ 배정</span>
                        )}
                      </div>

                      {isOpen && (
                        <CellPopover
                          entries={entries}
                          date={date}
                          part={part}
                          employees={employees}
                          schedule={schedule}
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
          );
        })}
      </div>
    </>
  );
}

/* ----------------------------------------------------------------
   ShiftTabMain (메인 탭 엔트리 포인트 컴포넌트)
---------------------------------------------------------------- */
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