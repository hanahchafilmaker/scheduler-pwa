// src/shared/constants/index.js
// UTF-8 clean version

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
  open: "",
  middle_A: "A",
  middle_B: "B",
  close: "",
  extra: "",
  overtime: "",
};

/* ================= PART ================= */

export const PARTS = ["open", "middle_A", "middle_B", "close"];

export const PART_LABEL = {
  open: "",
  middle_A: "A",
  middle_B: "B",
  close: "",
  extra: "",
};

export const DAYS = ["", "", "", "", "", "", ""];

/* ================= SHIFT TIME ================= */

export const SHIFT_TIME = {
  open: { start: "07:00", end: "11:30", hours: 4.5 },
  middle_A: { start: "11:30", end: "15:30", hours: 4 },
  middle_B: { start: "15:30", end: "18:00", hours: 2.5 },
  close: { start: "18:00", end: "22:00", hours: 4 },
};

/* ================= STATUS COLORS ================= */

export const STATUS_COLOR = {
  normal: "#374151",
  work: "#059669",
  absent: "#dc2626",
  late: "#dc2626",
  early_leave: "#d97706",
  overtime: "#7c3aed",
};

export const STATUS_BG = {
  normal: "#f9fafb",
  work: "#ecfdf5",
  absent: "#fef2f2",
  late: "#fef2f2",
  early_leave: "#fffbeb",
  overtime: "#f5f3ff",
};

/* ================= NAV ================= */

export const NAV_ITEMS = [
  { id: "today", label: " ", icon: "" },
  { id: "att", label: " ", icon: "" },
  { id: "shift", label: " ", icon: "" },
  { id: "sim", label: " ", icon: "" },
  { id: "settle", label: " ", icon: "" },
  { id: "emp", label: " ", icon: "" },
];

/* ================= PAGE TITLE ================= */

export function getPageTitle(tab) {
  return {
    today: { title: " ", sub: "  " },
    att: { title: " ", sub: "  " },
    shift: { title: " ", sub: "  " },
    sim: { title: " ", sub: "  " },
    settle: { title: " ", sub: "  " },
    emp: { title: " ", sub: "   " },
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

/* ================= SUBSTITUTE ================= */

export const SUBSTITUTE_STATUS = {
  REQUESTED: "requested",
  APPROVED: "approved",
  REJECTED: "rejected",
  FULFILLED: "fulfilled",
};

/* ================= CONFIG ================= */

export const AUTO_CHECKOUT_GRACE_MIN = 30;
export const ABSENT_GRACE_MIN = 0;
