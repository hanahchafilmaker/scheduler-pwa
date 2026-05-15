// src/shared/utils/time.js
//
// 표시용 시간 계산 유틸리티
// 정책:
// - 기본은 동일 날짜 내 시간 계산
// - end < start 인 경우 자정 넘김으로 보지 않고 비정상 데이터로 간주
// - 따라서 0분 반환

export function formatMinutes(mins) {
  const safe = Math.max(0, Number(mins) || 0);
  const h = Math.floor(safe / 60);
  const m = safe % 60;

  if (h && m) return `${h}시간 ${m}분`;
  if (h) return `${h}시간`;
  return `${m}분`;
}

function toParsedMin(t) {
  const m = String(t || "").match(/(\d+):(\d+)/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function diffMinutes(start, end) {
  if (!start || !end) return 0;

  const s = toParsedMin(start);
  const e = toParsedMin(end);

  if (s === null || e === null) return 0;
  if (e < s) return 0;

  return Math.max(0, e - s);
}
