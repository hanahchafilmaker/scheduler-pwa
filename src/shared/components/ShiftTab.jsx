import { useMemo, useState } from "react";
import { PART_LABEL } from "../constants";
import { normalizeDate } from "../utils";
import { SectionTitle } from "./UI";

// ── 상수 ────────────────────────────────────────────────────────────
const SHEETS_BASE_URL =
  "https://script.google.com/macros/s/AKfycby91v4GPOF9AS9GvEK0C_6S00WnckZUJEPV_gP0wubyqvwEZC4zjQujeuJtGZ0ENCh45A/exec";

const DAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 주간: anchor 날짜 기준 월~일 7일 배열 */
function getWeekDates(anchor) {
  const d = new Date(anchor + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const nd = new Date(monday);
    nd.setDate(monday.getDate() + i);
    return `${nd.getFullYear()}-${pad2(nd.getMonth() + 1)}-${pad2(nd.getDate())}`;
  });
}

/** 월간: YYYY-MM 기준 해당 월 전체 날짜 배열 */
function getMonthDates(ym) {
  const [y, m] = ym.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  return Array.from({ length: days }, (_, i) =>
    `${y}-${pad2(m)}-${pad2(i + 1)}`
  );
}

// ── 컴포넌트 ────────────────────────────────────────────────────────
export function ShiftTab({ schedule = [], employees = [], selectedMonth }) {
  const [viewMode, setViewMode] = useState("week");
  const [anchor, setAnchor] = useState(todayStr());
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [filterPart, setFilterPart] = useState("all");

  // 표시 날짜 배열
  const displayDates = useMemo(() => {
    if (viewMode === "week") return getWeekDates(anchor);
    const ym = selectedMonth || anchor.slice(0, 7);
    return getMonthDates(ym);
  }, [viewMode, anchor, selectedMonth]);

  // 이전/다음
  const movePrev = () => {
    const d = new Date(anchor + "T00:00:00");
    if (viewMode === "week") {
      d.setDate(d.getDate() - 7);
    } else {
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
    }
    setAnchor(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
  };

  const moveNext = () => {
    const d = new Date(anchor + "T00:00:00");
    if (viewMode === "week") {
      d.setDate(d.getDate() + 7);
    } else {
      d.setDate(1);
      d.setMonth(d.getMonth() + 1);
    }
    setAnchor(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
  };

  const moveToday = () => setAnchor(todayStr());

  // 기간 라벨
  const periodLabel = useMemo(() => {
    if (viewMode === "week" && displayDates.length === 7) {
      const s = displayDates[0].slice(5).replace("-", "/");
      const e = displayDates[6].slice(5).replace("-", "/");
      return `${s} ~ ${e}`;
    }
    const ym = (selectedMonth || anchor.slice(0, 7)).split("-");
    return `${ym[0]}년 ${Number(ym[1])}월`;
  }, [viewMode, displayDates, selectedMonth, anchor]);

  // 파트 목록 (schedule에서 추출)
  const parts = useMemo(
    () => [...new Set(schedule.map((s) => s.part).filter(Boolean))].sort(),
    [schedule]
  );

  // 필터 적용된 직원 목록
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (filterEmployee !== "all" && String(emp.employee_id) !== filterEmployee)
        return false;
      if (filterPart !== "all") {
        // 해당 파트 스케줄이 있는 직원만 표시
        const hasPart = schedule.some(
          (s) => String(s.employee_id) === String(emp.employee_id) && s.part === filterPart
        );
        if (!hasPart) return false;
      }
      return true;
    });
  }, [employees, filterEmployee, filterPart, schedule]);

  // 날짜+직원 조합으로 스케줄 빠른 조회용 맵
  const scheduleMap = useMemo(() => {
    const map = new Map();
    schedule.forEach((s) => {
      const date = normalizeDate(s.date);
      const key = `${date}__${s.employee_id}`;
      if (!map.has(key)) map.set(key, []);
      // 파트 필터 적용
      if (filterPart === "all" || s.part === filterPart) {
        map.get(key).push(s);
      }
    });
    return map;
  }, [schedule, filterPart]);

  const today = todayStr();

  return (
    <div className="page">
      <div className="card">
        {/* ── 헤더 ── */}
        <div className="shift-tab-header">
          <SectionTitle>스케줄 조회</SectionTitle>
          <a
            href={SHEETS_BASE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-sheets-link"
          >
            📊 Google Sheets 열기
          </a>
        </div>

        {/* ── 컨트롤 바 ── */}
        <div className="shift-controls">
          {/* 주간 / 월간 토글 */}
          <div className="view-toggle">
            <button
              type="button"
              className={viewMode === "week" ? "toggle-btn active" : "toggle-btn"}
              onClick={() => setViewMode("week")}
            >
              주간
            </button>
            <button
              type="button"
              className={viewMode === "month" ? "toggle-btn active" : "toggle-btn"}
              onClick={() => setViewMode("month")}
            >
              월간
            </button>
          </div>

          {/* 기간 네비게이션 */}
          <div className="period-nav">
            <button type="button" className="ghost-sm" onClick={movePrev}>
              ◀
            </button>
            <strong className="period-label">{periodLabel}</strong>
            <button type="button" className="ghost-sm" onClick={moveNext}>
              ▶
            </button>
            <button type="button" className="ghost-sm" onClick={moveToday}>
              오늘
            </button>
          </div>
        </div>

        {/* ── 필터 ── */}
        <div className="shift-filters">
          <select
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
          >
            <option value="all">전체 직원</option>
            {employees.map((emp) => (
              <option key={emp.employee_id} value={String(emp.employee_id)}>
                {emp.name}
              </option>
            ))}
          </select>

          {parts.length > 0 && (
            <select
              value={filterPart}
              onChange={(e) => setFilterPart(e.target.value)}
            >
              <option value="all">전체 파트</option>
              {parts.map((p) => (
                <option key={p} value={p}>
                  {PART_LABEL[p] || p}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* ── 스케줄 그리드 (조회 전용) ── */}
        <div className="shift-grid-wrap">
          <table className="shift-grid">
            <thead>
              <tr>
                <th className="emp-col">직원</th>
                {displayDates.map((date) => {
                  const d = new Date(date + "T00:00:00");
                  const dayIdx = d.getDay();
                  const isToday = date === today;
                  const isSun = dayIdx === 0;
                  const isSat = dayIdx === 6;
                  return (
                    <th
                      key={date}
                      className={[
                        "date-col",
                        isToday ? "today" : "",
                        isSun ? "sunday" : "",
                        isSat ? "saturday" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {viewMode === "week" ? (
                        <>
                          <div className="day-name">{DAY_KO[dayIdx]}</div>
                          <div className="date-num">{d.getDate()}</div>
                        </>
                      ) : (
                        <>
                          <div className="date-num">{d.getDate()}</div>
                          <div className="day-name">{DAY_KO[dayIdx]}</div>
                        </>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td
                    colSpan={displayDates.length + 1}
                    className="empty"
                  >
                    해당 조건의 직원이 없습니다
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.employee_id}>
                    <td className="emp-col">
                      <strong>{emp.name}</strong>
                    </td>
                    {displayDates.map((date) => {
                      const key = `${date}__${emp.employee_id}`;
                      const shifts = scheduleMap.get(key) || [];
                      const isToday = date === today;
                      return (
                        /* 조회 전용 셀 — onClick 없음, pointer-events:none */
                        <td
                          key={date}
                          className={[
                            "shift-cell",
                            "readonly",
                            isToday ? "today" : "",
                            shifts.length > 0 ? "has-shift" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {shifts.map((s, i) => (
                            <div key={i} className={`shift-chip shift-chip-${s.part || "default"}`}>
                              <span className="shift-part-badge">
                                {PART_LABEL[s.part] || s.part || ""}
                              </span>
                              {(s.planned_start || s.planned_end) && (
                                <span className="shift-time">
                                  {s.planned_start}
                                  {s.planned_end ? `\u2013${s.planned_end}` : ""}
                                </span>
                              )}
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── 범례 ── */}
        {parts.length > 0 && (
          <div className="shift-legend">
            {parts.map((p) => (
              <span key={p} className={`shift-chip shift-chip-${p} legend-chip`}>
                <span className="shift-part-badge">{PART_LABEL[p] || p}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
