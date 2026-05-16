export const SETTLED_RULES = {
  PAY: (row) => {
    if (!row) return false;
    if (!row.check_in) return false;
    if (!row.work_date) return false;
    return true;
  },

  IS_APPROVED: (row) => {
    return (
      row?.approval_status === "APPROVED" ||
      row?.status === "APPROVED" ||
      row?.approval_status === "승인"
    );
  },
};