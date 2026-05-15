// src/shared/utils/labelFormatter.js

// ─────────────────────────────────────────────
// 1. APPROVAL STATUS (결재 및 마감 상태 라벨)
// ─────────────────────────────────────────────
const APPROVAL_STATUS_LABELS = {
  approved: "승인 완료",
  pending: "승인 대기",
  rejected: "거절됨",
  auto_closed: "시스템 마감", // 수동 승인이 필요 없는 일반 정상 마감 상태
};

/**
 * 결재 상태 코드를 화면에 표시할 한국어 라벨로 변환합니다.
 */
export function getApprovalStatusLabel(status) {
  if (!status) return "-";
  // 소문자 변환을 거쳐 키 매칭의 정확도 향상
  const key = String(status).toLowerCase();
  return APPROVAL_STATUS_LABELS[key] ?? status;
}

// ─────────────────────────────────────────────
// 2. APPROVAL REASON (예외 발생 및 상신 사유 라벨)
// ─────────────────────────────────────────────
const APPROVAL_REASON_LABELS = {
  out_of_schedule: "스케줄 외 근무",
  substitute: "대체 근무",
  late: "지각 예외",
  early_leave: "조퇴 예외",
  auto_checkout: "자동 퇴근 처리", // 퇴근 미누락 등으로 인한 시스템 강제 퇴근
  
  // 앞선 payEngine 및 TodayTab에서 등장한 연장 요청 사유 추가 대응
  next_part_late_extension: "다음 파트 지각으로 인한 연장",
  next_part_no_show_extension: "다음 파트 미출근으로 인한 연장",
};

/**
 * 결재 요청 사유 코드를 화면에 표시할 한국어 라벨로 변환합니다.
 */
export function getApprovalReasonLabel(reason) {
  if (!reason) return "-";
  const key = String(reason).toLowerCase();
  return APPROVAL_REASON_LABELS[key] ?? reason;
}

// ─────────────────────────────────────────────
// 3. WORK PART (근무 시간대 / 파트 라벨)
// ─────────────────────────────────────────────
const PART_LABELS = {
  open: "오픈",
  middle_a: "미들 A",
  middle_b: "미들 B",
  close: "마감",
  extra: "추가",
  unscheduled: "비정규", // TodayTab 컴포넌트 내 조건 호환성 추가
};

/**
 * 근무 파트(시간대) 코드를 화면에 표시할 한국어 라벨로 변환합니다.
 */
export function getPartLabel(part) {
  if (!part) return "-";
  
  const key = String(part).toLowerCase();
  // 매핑 값이 존재하면 반환, 없으면 입력된 원본 데이터를 그대로 노출하여 유연성 확보
  return PART_LABELS[key] ?? part;
}