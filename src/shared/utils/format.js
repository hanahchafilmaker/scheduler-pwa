export function safeStr(v) {
  return String(v || "").trim();
}

export function formatTime(t) {
  if (!t) return "--";
  const m = String(t).match(/(\d+):(\d+)/);
  return m ? `${m[1].padStart(2, "0")}:${m[2].padStart(2, "0")}` : t;
}

export function fmtKRW(n) {
  const safe = Number.isFinite(Number(n)) ? Math.round(Number(n)) : 0;
  return safe.toLocaleString("ko-KR") + "원";
}

export function formatMinutes(min) {
  const safe = Math.max(0, Number(min) || 0);
  const h = Math.floor(safe / 60);
  const m = safe % 60;

  if (h && m) return `${h}시간 ${m}분`;
  if (h) return `${h}시간`;
  return `${m}분`;
}

export function diffMinutes(start, end) {
  if (!start || !end) return 0;

  const toMin = (t) => {
    const m = String(t || "").match(/(\d+):(\d+)/);
    if (!m) return 0;
    return Number(m[1]) * 60 + Number(m[2]);
  };

  const s = toMin(start);
  let e = toMin(end);

  if (e < s) e += 24 * 60;

  return Math.max(0, e - s);
}

// FIX: GAS가 boolean 값을 true/false/string 등 혼재 반환하므로 통일된 변환 함수
//      각 파일에 중복 정의되어 있던 것을 여기로 통합
export function toBool(v) {
  if (v === true) return true;
  if (v === false) return false;
  if (v === null || v === undefined || v === "") return false;
  return String(v).toLowerCase() === "true";
}
