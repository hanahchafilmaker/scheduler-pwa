// src/shared/utils/format.js
// UTF-8 — 한글 깨짐 주의

export function safeStr(v) {
  return String(v || "").trim();
}

// "HH:MM" 또는 ISO 시간 → "HH:MM" 표시
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
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  };

  const s = toMin(start);
  const e = toMin(end);

  if (s === null || e === null) return 0;
  if (e < s) return 0;

  return Math.max(0, e - s);
}

// GAS 는 boolean 을 "true"/"false" 문자열로 내려주기도 함 → 통일
export function toBool(v) {
  if (v === true) return true;
  if (v === false) return false;
  if (v === null || v === undefined || v === "") return false;
  return String(v).toLowerCase() === "true";
}