/**
 * src/domain/attendance/labels.js
 *
 * UI 표시용 레이블 변환 함수.
 *
 * 현재 useApi에 혼재된 getApprovalStatusLabel / getApprovalReasonLabel / getPartLabel을
 * domain 레이어로 이동. 순수 함수이므로 DB 접근 없음.
 *
 * 사용:
 *   import { getApprovalStatusLabel, getApprovalReasonLabel, getPartLabel } from "../domain/attendance/labels";
 */

// ─── Approval Status ──────────────────────────────────────────────────────────

const APPROVAL_STATUS_LABELS = {
  approved:    "승인",
  pending:     "승인대기",
  rejected:    "거절",
  auto_closed: "자동종료",
};

/**
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function getApprovalStatusLabel(status) {
  return APPROVAL_STATUS_LABELS[String(status || "")] ?? status ?? "-";
}

// ─── Approval Reason ──────────────────────────────────────────────────────────

const APPROVAL_REASON_LABELS = {
  out_of_schedule: "스케줄 외",
  substitute:      "대타",
  late:            "지각",
  early_leave:     "조기퇴근",
  auto_checkout:   "자동퇴근",
};

/**
 * @param {string|null|undefined} reason
 * @returns {string}
 */
export function getApprovalReasonLabel(reason) {
  return APPROVAL_REASON_LABELS[String(reason || "")] ?? reason ?? "-";
}

// ─── Part ─────────────────────────────────────────────────────────────────────

const PART_LABELS = {
  open:     "오픈",
  middle_a: "미들A",
  middle_b: "미들B",
  close:    "마감",
  extra:    "추가",
};

/**
 * @param {string|null|undefined} part
 * @returns {string}
 */
export function getPartLabel(part) {
  return PART_LABELS[String(part || "").toLowerCase()] ?? part ?? "-";
}