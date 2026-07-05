import { useMemo } from "react";

function getOpenAttendance(list) {
  return list.find((r) => r.check_in && !r.check_out) || null;
}

function getLatestAttendance(list) {
  if (!list.length) return null;
  return [...list].sort((a, b) => {
    const ka = `${a.date || ""} ${a.check_in || ""}`;
    const kb = `${b.date || ""} ${b.check_in || ""}`;
    return kb.localeCompare(ka);
  })[0];
}

function sortByCheckIn(list) {
  return [...list].sort((a, b) => {
    const ka = `${a.date || ""} ${a.check_in || ""}`;
    const kb = `${b.date || ""} ${b.check_in || ""}`;
    return ka.localeCompare(kb);
  });
}

export function useTodayAttendance(attendanceList) {
  const openAttendance = useMemo(() => getOpenAttendance(attendanceList), [attendanceList]);
  const latestAttendance = useMemo(() => getLatestAttendance(attendanceList), [attendanceList]);
  const sortedAttendance = useMemo(() => sortByCheckIn(attendanceList), [attendanceList]);
  const hasAttendance = attendanceList.length > 0;

  return { openAttendance, latestAttendance, sortedAttendance, hasAttendance };
}