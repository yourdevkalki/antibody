import "dotenv/config";
import { EventEmitter } from "node:events";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import type { Address, IntentDecision, Policy, SwapIntent } from "../shared/types.ts";
import { PendingQueue } from "../shared/queue.ts";
import { buildDcaPolicy, SEPOLIA_USDC } from "../shared/policy.ts";
import { ERC20_ABI } from "../shared/erc20.ts";
import { Worker } from "../worker/index.ts";
import { Guardian } from "../guardian/index.ts";
import { getKHClient, type KHClient } from "../keeperhub/index.ts";
import { getLLMClient, type LLMClient } from "../llm/index.ts";
import { proposeFromMessage } from "../worker/proposer.ts";
import { getAuditLog, type AuditLog, type AuditEntry } from "../audit/index.ts";
import type { ScenarioId } from "../worker/scenarios.ts";
import { readText, setText } from "../ens/client.ts";
import { deserializePolicy, type SerializedPolicy } from "../ens/policy.ts";

const sepoliaClient = createPublicClient({ chain: sepolia, transport: http() });

export interface BalanceSnapshot {
  raw: string;
  formatted: string;
  decimals: number;
  symbol: string;
}

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
  state: { frozen: boolean; explanations: Map<string, string>; ens: EnsContext };
  runScenario(s: ScenarioId): void;
  chat(message: string): Promise<SwapIntent>;
  snapshot(): RuntimeSnapshot;
  reset(): void;
  balance(): Promise<BalanceSnapshot>;
}

export interface EnsContext {
  enabled: boolean;
  parent: string;
  workerName: string;
  guardianName: string;
  policySource: "ens" | "fallback";
}

export interface RuntimeSnapshot {
  frozen: boolean;
  treasury: Address;
  policy: { action: string; asset: string; whitelist: string[]; maxSizeWei: string };
  pendingCount: number;
  llmProvider: string;
  khProvider: string;
  ens: EnsContext;
}

export async function createRuntime(): Promise<Runtime> {
  const treasury = (process.env.TREASURY_ADDRESS as Address) ?? "0x1111111111111111111111111111111111111111";
  const network = process.env.KEEPERHUB_NETWORK ?? "sepolia";
  const queue = new PendingQueue();
  const kh = getKHClient();
  const llm = getLLMClient();
  const audit = getAuditLog();
  const bus = new EventEmitter();

  const ensParent = process.env.ENS_PARENT_DOMAIN ?? "antibody.eth";
  const ensWorker = `${process.env.ENS_WORKER_SUBNAME ?? "worker"}.${ensParent}`;
  const ensGuardian = `${process.env.ENS_GUARDIAN_SUBNAME ?? "guardian"}.${ensParent}`;

  let policy: Policy;
  let policySource: "ens" | "fallback";
  try {
    const raw = await readText(ensWorker, "policy");
    if (!raw) throw new Error(`empty policy text record on ${ensWorker}`);
    policy = deserializePolicy(JSON.parse(raw) as SerializedPolicy);
    policySource = "ens";
    console.log(`[ens] policy loaded from ${ensWorker} (whitelist size ${policy.whitelist.length})`);
  } catch (e) {
    policy = buildDcaPolicy(treasury);
    policySource = "fallback";
    console.warn(`[ens] failed to load policy from ${ensWorker}: ${(e as Error).message}; using local fixture`);
  }

  const ensCtx: EnsContext = {
    enabled: policySource === "ens",
    parent: ensParent,
    workerName: ensWorker,
    guardianName: ensGuardian,
    policySource,
  };

  const state: Runtime["state"] = { frozen: false, explanations: new Map(), ens: ensCtx };

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
      if (ensCtx.enabled) writeIncidentToEns(decision, ensCtx, kh, network, audit, bus);
    }
  });

  audit.append({ kind: "policy_loaded", at: Date.now(), source: ensCtx.enabled ? `ens:${ensWorker}` : "shared/policy.ts", policy }).then(() => {});

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
        ens: ensCtx,
      };
    },
    reset() {
      queue.clear();
      guardian.reset();
      state.frozen = false;
      state.explanations.clear();
      bus.emit("audit", { kind: "reset", at: Date.now() });
    },
    async balance() {
      const raw = await sepoliaClient.readContract({
        address: SEPOLIA_USDC,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [treasury],
      });
      const decimals = 6;
      const value = Number(raw) / 10 ** decimals;
      return {
        raw: raw.toString(),
        formatted: value.toFixed(2),
        decimals,
        symbol: "USDC",
      };
    },
  };

  return rt;
}

function writeIncidentToEns(
  decision: IntentDecision,
  ens: EnsContext,
  kh: KHClient,
  network: string,
  audit: AuditLog,
  bus: EventEmitter,
): void {
  const fired = decision.rules.filter((r) => r.fired).map((r) => r.ruleId);
  const incident = {
    intentId: decision.intentId,
    at: decision.decidedAt,
    rules: fired,
    freezeTxHash: decision.txHash,
  };
  setText(kh, ens.workerName, "incident", JSON.stringify(incident), network)
    .then(async (res) => {
      const entry: AuditEntry = {
        kind: "guardian_explanation",
        at: Date.now(),
        intentId: decision.intentId,
        text: `Immune memory written to ${ens.workerName} (tx ${res.txHash ?? "pending"}).`,
      };
      await audit.append(entry);
      bus.emit("audit", entry);
    })
    .catch((e) => console.warn(`[ens] incident write failed: ${(e as Error).message}`));
}
