// 
// TIME PARSER
// 
function toParsedMin(t) {
  const m = String(t || "").match(/(\d+):(\d+)/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function toMin(t) {
  const parsed = toParsedMin(t);
  return parsed === null ? 0 : parsed;
}

// 
// DIFFERENCE
// 
export function diffMinutes(start, end) {
  if (!start || !end) return 0;

  const s = toParsedMin(start);
  const e = toParsedMin(end);

  if (s === null || e === null) return 0;
  if (e < s) return 0;

  return e - s;
}
