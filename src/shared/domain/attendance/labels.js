const APPROVAL_STATUS_LABELS = {
  approved: "",
  pending: "",
  rejected: "",
  auto_closed: "",
};

export function getApprovalStatusLabel(status) {
  return APPROVAL_STATUS_LABELS[String(status || "")] ?? status ?? "-";
}

const APPROVAL_REASON_LABELS = {
  out_of_schedule: "",
  substitute: "",
  late: "",
  early_leave: "",
  auto_checkout: "",
};

export function getApprovalReasonLabel(reason) {
  return APPROVAL_REASON_LABELS[String(reason || "")] ?? reason ?? "-";
}

const PART_LABELS = {
  open: "",
  middle_a: "A",
  middle_b: "B",
  close: "",
  extra: "",
};

export function getPartLabel(part) {
  return PART_LABELS[String(part || "").toLowerCase()] ?? part ?? "-";
}
