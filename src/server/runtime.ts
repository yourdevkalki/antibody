import "dotenv/config";
import { EventEmitter } from "node:events";
import type { Address, IntentDecision, Policy, SwapIntent } from "../shared/types.ts";
import { PendingQueue } from "../shared/queue.ts";
import { buildDcaPolicy } from "../shared/policy.ts";
import { Worker } from "../worker/index.ts";
import { Guardian } from "../guardian/index.ts";
import { getKHClient, type KHClient } from "../keeperhub/index.ts";
import { getLLMClient, type LLMClient } from "../llm/index.ts";
import { proposeFromMessage } from "../worker/proposer.ts";
import { getAuditLog, type AuditLog, type AuditEntry } from "../audit/index.ts";
import type { ScenarioId } from "../worker/scenarios.ts";

export interface Runtime {
  bus: EventEmitter;
  policy: Policy;
  treasury: Address;
  queue: PendingQueue;
  kh: KHClient;
  llm: LLMClient;
  guardian: Guardian;
  worker: Worker;
  audit: AuditLog;
  state: { frozen: boolean; explanations: Map<string, string> };
  runScenario(s: ScenarioId): void;
  chat(message: string): Promise<SwapIntent>;
  snapshot(): RuntimeSnapshot;
}

export interface RuntimeSnapshot {
  frozen: boolean;
  treasury: Address;
  policy: { action: string; asset: string; whitelist: string[]; maxSizeWei: string };
  pendingCount: number;
  llmProvider: string;
  khProvider: string;
}

export function createRuntime(): Runtime {
  const treasury = (process.env.TREASURY_ADDRESS as Address) ?? "0x1111111111111111111111111111111111111111";
  const policy = buildDcaPolicy(treasury);
  const queue = new PendingQueue();
  const kh = getKHClient();
  const llm = getLLMClient();
  const audit = getAuditLog();
  const bus = new EventEmitter();

  const state: Runtime["state"] = { frozen: false, explanations: new Map() };

  const guardian = new Guardian({
    policy,
    queue,
    kh,
    llm,
    onExplanation: async (intentId, text) => {
      state.explanations.set(intentId, text);
      const entry: AuditEntry = { kind: "guardian_explanation", at: Date.now(), intentId, text };
      await audit.append(entry);
      bus.emit("audit", entry);
    },
  });

  const worker = new Worker({ treasury, queue });

  queue.on("proposed", async (intent: SwapIntent) => {
    const entry: AuditEntry = { kind: "intent_proposed", at: Date.now(), intent };
    await audit.append(entry);
    bus.emit("audit", entry);
  });

  queue.on("decided", async (decision: IntentDecision) => {
    const entry: AuditEntry = { kind: "intent_decided", at: Date.now(), decision };
    await audit.append(entry);
    bus.emit("audit", entry);
    if (decision.status === "rejected" && !state.frozen) {
      state.frozen = true;
      const f: AuditEntry = { kind: "frozen", at: Date.now(), intentId: decision.intentId, freezeTxHash: decision.txHash };
      await audit.append(f);
      bus.emit("audit", f);
    }
  });

  audit.append({ kind: "policy_loaded", at: Date.now(), source: "shared/policy.ts", policy }).then(() => {});

  const rt: Runtime = {
    bus,
    policy,
    treasury,
    queue,
    kh,
    llm,
    guardian,
    worker,
    audit,
    state,
    runScenario(s) {
      worker.runScenario(s);
    },
    async chat(message) {
      const userEntry: AuditEntry = { kind: "worker_chat", at: Date.now(), role: "user", content: message };
      await audit.append(userEntry);
      bus.emit("audit", userEntry);

      const intent = await proposeFromMessage(message, { policy, treasury, network: "sepolia", llm });
      const assistantEntry: AuditEntry = {
        kind: "worker_chat",
        at: Date.now(),
        role: "assistant",
        content: `propose_swap → ${intent.functionName}(${(intent.functionArgs[0] ?? "").toString().slice(0, 24)}…) — ${intent.rationale}`,
      };
      await audit.append(assistantEntry);
      bus.emit("audit", assistantEntry);
      queue.propose(intent);
      return intent;
    },
    snapshot() {
      return {
        frozen: state.frozen,
        treasury,
        policy: {
          action: policy.action,
          asset: policy.asset,
          whitelist: policy.whitelist,
          maxSizeWei: policy.maxSizeWei.toString(),
        },
        pendingCount: queue.size(),
        llmProvider: llm.providerLabel,
        khProvider: kh.constructor.name,
      };
    },
  };

  return rt;
}
