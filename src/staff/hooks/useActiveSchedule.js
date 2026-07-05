import { useMemo } from "react";

function pickDisplaySchedule(scheduleList, nowMin) {
  if (!scheduleList.length) return null;

  const withRange = scheduleList
    .map((r) => ({ ...r, _start: toMin(r.planned_start), _end: toMin(r.planned_end) }))
    .filter((r) => r._start !== null && r._end !== null);

  return (
    withRange.find((r) => nowMin >= r._start && nowMin < r._end) ||
    [...withRange].filter((r) => r._start >= nowMin).sort((a, b) => a._start - b._start)[0] ||
    [...withRange].sort((a, b) => a._start - b._start)[0] ||
    null
  );
}

function toMin(t) {
  const [h, m] = String(t || "")
    .split(":")
    .map(Number);
  return Number.isNaN(h) || Number.isNaN(m) ? null : h * 60 + m;
}

function getCandidates(scheduleList, nowMin) {
  return scheduleList.filter((r) => {
    const s = toMin(r.planned_start);
    const e = toMin(r.planned_end);
    return s !== null && e !== null && nowMin >= s - 30 && nowMin <= e + 30;
  });
}

export function useActiveSchedule(scheduleList, nowOverride) {
  const nowMin = nowOverride !== undefined ? nowOverride : new Date().getHours() * 60 + new Date().getMinutes();

  const activeSchedule = useMemo(() => pickDisplaySchedule(scheduleList, nowMin), [scheduleList, nowMin]);
  const candidates = useMemo(() => getCandidates(scheduleList, nowMin), [scheduleList, nowMin]);
  const hasSchedule = scheduleList.length > 0;

  return { activeSchedule, candidates, hasSchedule };
}