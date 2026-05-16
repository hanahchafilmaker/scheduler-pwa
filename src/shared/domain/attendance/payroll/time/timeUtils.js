// src/shared/domain/attendance/payroll/time/timeUtils.js

/**
 * 두 시간의 차이를 분(Minutes) 단위로 계산합니다.
 * @param {Date|string} timeA - 시작 시간 또는 날짜 객체/ISO 문자열
 * @param {Date|string} timeB - 종료 시간 또는 날짜 객체/ISO 문자열
 * @returns {number} 두 시간의 차이 (분 단위 정수, 음수 없음)
 */
export function diffMinutes(timeA, timeB) {
  if (!timeA || !timeB) return 0;

  // 1. "09:00" 같은 HH:mm 형식의 문자열인 경우 처리
  if (typeof timeA === 'string' && timeA.includes(':') && !timeA.includes('-') && !timeA.includes('T')) {
    const [h1, m1] = timeA.split(':').map(Number);
    const [h2, m2] = timeB.split(':').map(Number);
    
    const totalMin1 = h1 * 60 + m1;
    const totalMin2 = h2 * 60 + m2;
    
    return Math.abs(totalMin1 - totalMin2);
  }

  // 2. 일반 Date 객체 또는 ISO 날짜 문자열인 경우 처리
  const dateA = new Date(timeA);
  const dateB = new Date(timeB);

  if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
    console.warn("diffMinutes: 유효하지 않은 날짜 형식입니다.", { timeA, timeB });
    return 0;
  }

  const diffInMs = Math.abs(dateA - dateB);
  return Math.floor(diffInMs / (1000 * 60));
}

/**
 * 분 단위를 시간과 분으로 분리합니다. (예: 135분 -> { hours: 2, minutes: 15 })
 * @param {number} totalMinutes 
 * @returns {{hours: number, minutes: number}}
 */
export function convertMinutesToHoursAndMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { hours, minutes };
}