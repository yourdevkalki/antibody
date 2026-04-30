import { FileAuditLog } from "./file.ts";
import type { AuditLog, AuditEntry } from "./log.ts";

export type { AuditLog, AuditEntry } from "./log.ts";
export { FileAuditLog };

export function getAuditLog(): AuditLog {
  const path = process.env.AUDIT_LOG_PATH ?? "logs/audit.jsonl";
  return new FileAuditLog(path);
}
