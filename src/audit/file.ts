import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { AuditLog, AuditEntry } from "./log.ts";

export class FileAuditLog implements AuditLog {
  readonly label: string;
  private ready: Promise<void>;

  constructor(private path: string) {
    this.label = `file:${path}`;
    this.ready = mkdir(dirname(path), { recursive: true }).then(() => undefined);
  }

  async append(entry: AuditEntry): Promise<void> {
    await this.ready;
    await appendFile(this.path, JSON.stringify(entry, replacer) + "\n");
  }
}

function replacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}
