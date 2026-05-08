import { useEffect, useState } from "react";
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

function DesktopShiftTable({ weekDates, weekOffset, setWeekOffset, schedule }) {
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
          <table className="shift-table shift-grid">
            <thead>
              <tr>
                <th className="part-col">파트</th>
                {weekDates.map((d) => {
                  const meta = formatDayLabel(d);
                  return (
                    <th key={d} className="date-col" style={{ color: meta.color }}>
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

                    return (
                      <td key={`${date}_${part}`} className="shift-cell readonly">
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

function MobileShiftCards({ weekDates, weekOffset, setWeekOffset, schedule }) {
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
          const entries = getEntries(schedule, date);

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

export function ShiftTab({ weekDates = [], weekOffset = 0, setWeekOffset, schedule = [] }) {
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

  return (
    <div className="page">
      {isMobile ? (
        <MobileShiftCards
          weekDates={weekDates}
          weekOffset={weekOffset}
          setWeekOffset={setWeekOffset}
          schedule={schedule}
        />
      ) : (
        <DesktopShiftTable
          weekDates={weekDates}
          weekOffset={weekOffset}
          setWeekOffset={setWeekOffset}
          schedule={schedule}
        />
      )}
    </div>
  );
}
