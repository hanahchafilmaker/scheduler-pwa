import { useEffect, useMemo, useState } from "react";
import { PARTS, SHIFT_TIME } from "../constants";
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

/* ── 공통 헤더 ── */
function ShiftHeader({ weekDates, weekOffset, setWeekOffset }) {
  const rangeLabel = weekDates.length === 7 ? `${weekDates[0]} – ${weekDates[6]}` : "";

  return (
    <div className="shift-tab-header">
      <div className="shift-header-copy">
        <h2>스케줄 조회</h2>
        <p>이번 주 근무 배정을 한눈에 확인합니다</p>
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

/* ── 데스크탑 테이블 ── */
function DesktopShiftTable({ weekDates, weekOffset, setWeekOffset, schedule, todayDate }) {
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
                    <strong>{part}</strong>
                  </td>

                  {weekDates.map((date) => {
                    const entry = getEntry(schedule, date, part);
                    const isToday = date === todayDate;

                    return (
                      <td
                        key={`${date}_${part}`}
                        className={`shift-cell readonly ${isToday ? "today" : ""}`}
                      >
                        {entry ? (
                          <div className="shift-cell-filled">
                            <span className="cell-name">{part}</span>
                            <span className="cell-employee-mini">{entry.name}</span>
                          </div>
                        ) : (
                          <span className="cell-empty">-</span>
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

/* ── 모바일 카드 ── */
function MobileShiftCards({ weekDates, weekOffset, setWeekOffset, schedule, todayDate }) {
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
                  const entry = entries.find((e) => e.part === part);
                  const shift = SHIFT_TIME[part] || {};

                  return (
                    <div
                      key={`${date}_${part}`}
                      className={`shift-part-card readonly ${entry ? "filled" : "empty"}`}
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
                          <span className="shift-part-empty">미배정</span>
                        )}
                      </div>
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

/* ── 메인 export ── */
export function ShiftTab({ weekDates = [], weekOffset = 0, setWeekOffset, schedule = [] }) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 768 : false,
  );

  const todayDate = useMemo(() => normalizeDate(new Date()), []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="page">
      {isMobile ? (
        <MobileShiftCards
          weekDates={weekDates}
          weekOffset={weekOffset}
          setWeekOffset={setWeekOffset}
          schedule={schedule}
          todayDate={todayDate}
        />
      ) : (
        <DesktopShiftTable
          weekDates={weekDates}
          weekOffset={weekOffset}
          setWeekOffset={setWeekOffset}
          schedule={schedule}
          todayDate={todayDate}
        />
      )}
    </div>
  );
}
