/**
 * src/shared/utils/time.js
 *
 * 시간 계산 유틸리티
 *   - formatMinutes : 분 → "N시간 M분" 문자열
 *   - diffMinutes   : 두 "HH:MM" 시간 간의 차이 (분)
 *
 * 참고: format.js 에 이미 동일 함수가 있으므로 중복 주의.
 * 이 파일은 GAS 계산 결과(lateness_minutes 등)를 표시할 때 쓰는
 * 독립 모듈 버전입니다. src/shared/utils/index.js 에서 re-export 하세요.
 *
 *   // src/shared/utils/index.js 에 추가:
 *   export * from "./time";
 */

/**
 * formatMinutes
 * @param {number|string} mins - 분 단위 숫자
 * @returns {string}  "1시간 30분" | "45분" | "0분"
 *
 * @example
 *   formatMinutes(90)  // "1시간 30분"
 *   formatMinutes(45)  // "45분"
 *   formatMinutes(60)  // "1시간"
 *   formatMinutes(0)   // "0분"
 */
export function formatMinutes(mins) {
  const safe = Math.max(0, Number(mins) || 0);
  const h    = Math.floor(safe / 60);
  const m    = safe % 60;

  if (h && m) return `${h}시간 ${m}분`;
  if (h)      return `${h}시간`;
  return `${m}분`;
}

/**
 * diffMinutes
 * 두 "HH:MM" 시간 문자열 사이의 차이를 분 단위로 반환.
 * end 가 start 보다 작으면 자정을 넘긴 것으로 처리 (최대 +24h 보정).
 *
 * @param {string} start - "HH:MM"
 * @param {string} end   - "HH:MM"
 * @returns {number} 양수 분 (0 이상)
 *
 * @example
 *   diffMinutes("09:00", "13:30")  // 270
 *   diffMinutes("23:00", "01:00")  // 120  (자정 넘김)
 *   diffMinutes("", "13:00")       // 0
 */
export function diffMinutes(start, end) {
  if (!start || !end) return 0;

  const toMin = (t) => {
    const m = String(t || "").match(/(\d+):(\d+)/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };

  const s = toMin(start);
  let   e = toMin(end);

  if (s === null || e === null) return 0;
  if (e < s) e += 24 * 60;      // 자정 넘기기 보정

  return Math.max(0, e - s);
}
