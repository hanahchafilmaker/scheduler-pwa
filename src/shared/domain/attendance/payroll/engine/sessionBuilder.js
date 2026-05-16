import { diffMinutes } from "../time/timeUtils";

/**
 * Attendance Row → WorkSession 변환
 *
 * 포함 기능:
 * - 연속 근무 자동 연결
 * - check_out 없으면 다음 check_in으로 종료
 * - 대타/스케줄 없음 처리
 * - 빈 데이터 방어
 * - 동일 직원 + 동일 날짜만 연결
 * - immutable 설계
 */
export function buildWorkSessions(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  // 1. 안전 복사 + 정렬
  const sorted = [...rows]
    .filter((r) => r && r.check_in)
    .sort((a, b) => {
      const ta = new Date(a.check_in || 0).getTime();
      const tb = new Date(b.check_in || 0).getTime();
      return ta - tb;
    });

  const sessions = [];

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];

    // 2. 기본 안전장치
    if (!cur?.check_in) continue;

    const curDate = (cur.work_date || "").slice(0, 10);
    const nextDate = (next?.work_date || "").slice(0, 10);

    const sameEmployee = next && cur.employee_id === next.employee_id;
    const sameDay = next && curDate === nextDate;

    // 3. check_out 결정 로직 (핵심)
    let end = null;

    if (cur.check_out && cur.check_out.trim() !== "") {
      // 정상 퇴근 존재
      end = cur.check_out;
    } else if (sameEmployee && sameDay && next?.check_in) {
      // 🔥 연속 근무 → 다음 check_in으로 자동 종료
      end = next.check_in;
    }

    // 4. duration 계산 (안전 처리)
    const duration =
      end && cur.check_in
        ? Math.max(
            0,
            diffMinutes(cur.check_in, end)
          )
        : 0;

    // 5. 대타 / 스케줄 외 근무 판단
    const isOutOfSchedule =
      cur.approval_reason === "out_of_schedule" ||
      cur.part === "대타" ||
      !cur.planned_start ||
      !cur.planned_end;

    // 5-1. 연속 근무 여부 + 다음 세션의 스케줄 정보 수집
    //      같은 직원 + 같은 날 + 다음 row에 스케줄이 있으면 연속 근무로 판단
    const isContinuous = sameEmployee && sameDay && !!next?.check_in;
    const nextPlannedStart = isContinuous ? (next?.planned_start || null) : null;
    const nextPlannedEnd   = isContinuous ? (next?.planned_end   || null) : null;

    // 6. session 생성
    sessions.push({
      employee_id: cur.employee_id,
      work_date: cur.work_date,

      start: cur.check_in,
      end,

      duration,

      planned_start: cur.planned_start || null,
      planned_end: cur.planned_end || null,

      break_min: Number(cur.break_min || 0),

      // 상태 플래그
      inferred_checkout: !cur.check_out && !!end,
      is_out_of_schedule: isOutOfSchedule,
      is_continuous: isContinuous,

      // 연속 근무 시 다음 파트의 스케줄 정보
      // → payEngine에서 "스케줄 내 연장"인지 판단하는 데 사용
      next_planned_start: nextPlannedStart,
      next_planned_end: nextPlannedEnd,

      // 디버깅용 (운영에서 매우 중요)
      raw_index: i,
    });
  }

  return sessions;
}