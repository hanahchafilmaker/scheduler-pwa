// src/shared/utils/timeUtils.js

function toParsedMin(t) {
  if (!t) return null;
  const m = String(t).match(/(\d+):(\d+)/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function toMin(t) {
  const parsed = toParsedMin(t);
  return parsed === null ? 0 : parsed;
}

/**
 * 당일 출퇴근 전용 분 차이 계산 (종료 시간 - 시작 시간)
 * 퇴근이 출근보다 빠르면 오류 데이터로 간주하여 0 분 반환
 */
export function diffMinutes(start, end) {
  if (!start || !end) return 0;

  const s = toParsedMin(start);
  const e = toParsedMin(end);

  if (s === null || e === null) return 0;
  if (e < s) return 0; // 당일 원칙이므로 역전되면 0분 처리 (안전장치)

  return e - s;
}