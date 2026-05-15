// src/shared/constants/index.js
/* ================= WORK TYPE ================= */
export const WORK_TYPE = {
  OPEN: "open",
  MIDDLE_A: "middle_A",
  MIDDLE_B: "middle_B",
  CLOSE: "close",
  EXTRA: "extra",
  OVERTIME: "overtime",
};
export const WORK_TYPE_LABEL = {
  open: "오픈",
  middle_A: "미들A",
  middle_B: "미들B",
  close: "마감",
  extra: "추가",
  overtime: "야근",
};
/* ================= PART ================= */
export const PARTS = ["open", "middle_A", "middle_B", "close"];
export const PART_LABEL = {
  open: "오픈",
  middle_A: "미들A",
  middle_B: "미들B",
  close: "마감",
  extra: "추가",
  대타: "대타",
};
export const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
/* ================= SHIFT TIME ================= */
export const SHIFT_TIME = {
  open: { start: "07:00", end: "11:30", hours: 4.5 },
  middle_A: { start: "11:30", end: "15:30", hours: 4 },
  middle_B: { start: "15:30", end: "18:00", hours: 2.5 },
  close: { start: "18:00", end: "22:00", hours: 4 },
};
/* ================= STATUS COLORS ================= */
export const STATUS_COLOR = {
  정상: "#374151",
  근무중: "#059669",
  결근: "#2563eb",
  지각: "#dc2626",
  조퇴: "#d97706",
  야근: "#7c3aed",
  무단조퇴: "#dc2626",
  대타: "#7c3aed",
};
export const STATUS_BG = {
  정상: "#f9fafb",
  근무중: "#ecfdf5",
  결근: "#eff6ff",
  지각: "#fef2f2",
  조퇴: "#fffbeb",
  야근: "#f5f3ff",
  무단조퇴: "#fef2f2",
  대타: "#f5f3ff",
};
/* ================= NAV ================= */
export const NAV_ITEMS = [
  { id: "today", label: "오늘 현황", icon: "📋" },
  { id: "att", label: "근태 기록", icon: "📊" },
  { id: "shift", label: "스케줄 관리", icon: "📅" },
  { id: "sim", label: "급여 계산", icon: "💰" },
  { id: "settle", label: "월 마감", icon: "✅" },
  { id: "emp", label: "직원 관리", icon: "👥" },
];
/* ================= PAGE TITLE ================= */
export function getPageTitle(tab) {
  return {
    today: { title: "오늘 현황", sub: "오늘 근무 현황 및 출퇴근 관리" },
    att: { title: "근태 기록", sub: "실제 근무 기록 확인 및 승인" },
    shift: { title: "스케줄 관리", sub: "주간 스케줄 확인" },
    sim: { title: "급여 계산", sub: "실제 근태 기록 기반 급여 계산" },
    settle: { title: "월 마감", sub: "월별 급여 정산 및 final_pay 저장" },
    emp: { title: "직원 관리", sub: "직원 등록, 수정, 활성화 관리" },
  }[tab];
}
/* ================= EMP ================= */
export const EMPTY_EMP_FORM = {
  name: "",
  phone: "",
  hourly_wage: "",
  pin: "",
  role: "staff",
  active: true,
};
/* ================= SUBSTITUTE STATUS ================= */
export const SUBSTITUTE_STATUS = {
  REQUESTED: "requested",
  APPROVED: "approved",
  REJECTED: "rejected",
  FULFILLED: "fulfilled",
};
/* ================= CONFIG ================= */
export const AUTO_CHECKOUT_GRACE_MIN = 30;
export const ABSENT_GRACE_MIN = 0;