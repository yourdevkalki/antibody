import type { SwapIntent, IntentDecision, Policy } from "../shared/types.ts";

export type AuditEntry =
  | { kind: "worker_chat"; at: number; role: "user" | "assistant"; content: string }
  | { kind: "intent_proposed"; at: number; intent: SwapIntent }
  | { kind: "intent_decided"; at: number; decision: IntentDecision }
  | { kind: "guardian_explanation"; at: number; intentId: string; text: string }
  | { kind: "frozen"; at: number; intentId: string; freezeTxHash?: string }
  | { kind: "policy_loaded"; at: number; source: string; policy: Policy };

export interface AuditLog {
  append(entry: AuditEntry): Promise<void>;
  readonly label: string;
}
