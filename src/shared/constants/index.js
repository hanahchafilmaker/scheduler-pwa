export const API_URL =
  "https://script.google.com/macros/s/AKfycbxuT1qpLMpdYDqAFtVPBtGq-0MwC1CHrzvyBHHCpXnNL8vAtJPFp9wR7W3U9sGKzC58bA/exec";

/* ================= 근무 타입 ================= */

export const WORK_TYPE = {
  OPEN: "open",
  MIDDLE: "middle",
  CLOSE: "close",
  EXTRA: "extra",
  OVERTIME: "overtime",
};

export const WORK_TYPE_LABEL = {
  open: "오픈",
  middle: "미들",
  close: "마감",
  extra: "대타",
  overtime: "시간외",
};

/* ================= 기존 (관리자용 유지) ================= */

export const PARTS = ["open", "middle", "close"];

export const PART_LABEL = {
  open: "오픈",
  middle: "미들",
  close: "마감",
  extra: "대타",
  대타: "대타",
};

export const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

export const SHIFT_TIME = {
  open: { start: "07:00", end: "13:00", hours: 6 },
  middle: { start: "13:00", end: "18:00", hours: 5 },
  close: { start: "18:00", end: "23:00", hours: 5 },
};

/* ================= 상태 ================= */

export const STATUS_COLOR = {
  예정: "#374151",
  근무중: "#059669",
  정상: "#2563eb",
  지각: "#dc2626",
  조퇴: "#d97706",
  연장: "#7c3aed",
  미퇴근: "#dc2626",
};

export const STATUS_BG = {
  예정: "#f9fafb",
  근무중: "#ecfdf5",
  정상: "#eff6ff",
  지각: "#fef2f2",
  조퇴: "#fffbeb",
  연장: "#f5f3ff",
  미퇴근: "#fef2f2",
};

/* ================= 네비 ================= */

export const NAV_ITEMS = [
  { id: "home", label: "홈", icon: "🏠" },
  { id: "shift", label: "근무표", icon: "📅" },
  { id: "emp", label: "직원 관리", icon: "👥" },
  { id: "att", label: "출퇴근 기록", icon: "⏱️" },
  { id: "sim", label: "급여 정산", icon: "💴" },
];

/* ================= 페이지 타이틀 ================= */

// FIX: 기존 코드에서 sub 값이 모듈 로드 시점에 고정되어
//      자정이 지나면 날짜가 갱신되지 않는 버그 수정 → 함수로 변경
export function getPageTitle(tab) {
  return {
    home: {
      title: "오늘 근무 현황",
      sub: new Date().toISOString().slice(0, 10),
    },
    shift: { title: "근무표", sub: "주간 스케줄 관리" },
    emp: { title: "직원 관리", sub: "직원 정보 및 시급 설정" },
    att: { title: "출퇴근 기록", sub: "실제 근무 기록 확인 및 수정" },
    sim: { title: "급여 정산", sub: "실제 출퇴근 기준 인건비 계산" },
  }[tab];
}

/* ================= 직원 폼 ================= */

export const EMPTY_EMP_FORM = {
  name: "",
  phone: "",
  hourly_wage: "",
  pin: "",
  active: true,
};
