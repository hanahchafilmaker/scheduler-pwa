export type PayrollAuditLog = {
  id: string;
  employeeId: string;
  month: string;

  before: any;
  after: any;

  action: "GENERATE" | "RECALCULATE" | "LOCK";

  createdAt: string;
  createdBy?: string;
};

/**
 * 💥 단순 in-memory (SaaS는 DB로 교체)
 */
const auditStore: PayrollAuditLog[] = [];

export function writePayrollAudit(log: PayrollAuditLog) {
  auditStore.push(log);
}

export function getPayrollAudit(employeeId: string) {
  return auditStore.filter((l) => l.employeeId === employeeId);
}