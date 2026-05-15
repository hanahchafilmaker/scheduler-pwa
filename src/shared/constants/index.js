// src/shared/constants/index.js
// UTF-8 — 한글 깨짐 주의
// 실제 프로젝트 필드명 기준 — 임의 필드 추가 금지

/* ================= 근무 타입 ================= */

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
  extra: "대타",
  overtime: "시간외",
};

/* ================= 파트 ================= */

export const PARTS = ["open", "middle_A", "middle_B", "close"];

export const PART_LABEL = {
  open: "오픈",
  middle_A: "미들A",
  middle_B: "미들B",
  close: "마감",
  extra: "대타",
  대타: "대타",
};

export const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

/* ================= 시프트 기준 시간 ================= */

export const SHIFT_TIME = {
  open: { start: "07:00", end: "11:30", hours: 4.5 },
  middle_A: { start: "11:30", end: "15:30", hours: 4 },
  middle_B: { start: "15:30", end: "18:00", hours: 2.5 },
  close: { start: "18:00", end: "22:00", hours: 4 },
};

/* ================= 상태 색상 ================= */

export const STATUS_COLOR = {
  예정: "#374151",
  근무중: "#059669",
  정상: "#2563eb",
  지각: "#dc2626",
  조퇴: "#d97706",
  연장: "#7c3aed",
  퇴근누락: "#dc2626",
  대타: "#7c3aed",
};

export const STATUS_BG = {
  예정: "#f9fafb",
  근무중: "#ecfdf5",
  정상: "#eff6ff",
  지각: "#fef2f2",
  조퇴: "#fffbeb",
  연장: "#f5f3ff",
  퇴근누락: "#fef2f2",
  대타: "#f5f3ff",
};

/* ================= 네비 ================= */

export const NAV_ITEMS = [
  { id: "today", label: "오늘 현황", icon: "🏪" },
  { id: "att", label: "출퇴근 기록", icon: "⏱️" },
  { id: "shift", label: "스케줄 조회", icon: "📅" },
  { id: "sim", label: "급여 정산", icon: "💴" },
  { id: "emp", label: "직원 관리", icon: "👥" }, // ← Phase 1 추가
];

/* ================= 페이지 타이틀 ================= */

export function getPageTitle(tab) {
  return {
    today: { title: "오늘 현황", sub: "오늘 매장 운영 상황 한눈에 보기" },
    att: { title: "출퇴근 기록", sub: "실제 근무 기록 확인 및 승인" },
    shift: { title: "스케줄 조회", sub: "Google Sheets 기준 원본 스케줄 확인" },
    sim: { title: "급여 정산", sub: "실제 출퇴근 기준 인건비 계산" },
    emp: { title: "직원 관리", sub: "직원 등록, 수정, 활성화 관리" }, // ← Phase 1 추가
  }[tab];
}

/* ================= 직원 폼 기본값 ================= */

export const EMPTY_EMP_FORM = {
  name: "",
  phone: "",
  hourly_wage: "",
  pin: "",
  role: "staff", // role_enum: "admin" | "staff"
  active: true,
};

/* ================= 대타 상태 ================= */

export const SUBSTITUTE_STATUS = {
  REQUESTED: "requested",
  APPROVED: "approved",
  REJECTED: "rejected",
  FULFILLED: "fulfilled",
};

/* ================= 자동퇴근 유예 시간 (분) ================= */

export const AUTO_CHECKOUT_GRACE_MIN = 30;

/* ================= 미출근 판단 유예 시간 ================= */

export const ABSENT_GRACE_MIN = 0;
