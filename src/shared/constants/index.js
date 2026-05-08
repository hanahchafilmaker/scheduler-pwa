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

/* ================= 관리자용 ================= */

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
  open: { start: "07:00", end: "11:00", hours: 4 },
  middle: { start: "11:30", end: "18:00", hours: 6.5 },
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

// 변경 후
export const NAV_ITEMS = [
  { id: "att", label: "출퇴근 기록", icon: "⏱️" },
  { id: "shift", label: "스케줄 조회", icon: "📅" },
  { id: "sim", label: "급여 정산", icon: "💴" },
];

/* ================= 페이지 타이틀 ================= */

export function getPageTitle(tab) {
  return {
    home: { title: "오늘 근무 현황", sub: new Date().toISOString().slice(0, 10) },
    shift: { title: "스케줄 조회", sub: "Google Sheets 기준 원본 스케줄 확인" },
    emp: { title: "직원 관리", sub: "직원 정보 및 시급 설정" },
    att: { title: "출퇴근 기록", sub: "실제 근무 기록 확인 및 수정" },
    sim: { title: "급여 정산", sub: "실제 출퇴근 기준 인건비 계산" },
  }[tab];
}

/* ================= 직원 폼 기본값 ================= */

export const EMPTY_EMP_FORM = {
  name: "",
  phone: "",
  hourly_wage: "",
  pin: "",
  active: true,
};
