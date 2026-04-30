import "dotenv/config";
import type { Address } from "../shared/types.ts";
import type { Policy, SwapIntent, IntentDecision } from "../shared/types.ts";
import { PendingQueue } from "../shared/queue.ts";
import { evaluate, anyFired } from "./rules/index.ts";
import { type KHClient } from "../keeperhub/index.ts";
import { SEPOLIA_USDC } from "../shared/policy.ts";
import type { LLMClient } from "../llm/index.ts";
import { explainAlert } from "./explain.ts";

export interface GuardianOptions {
  policy: Policy;
  queue: PendingQueue;
  kh: KHClient;
  llm?: LLMClient;
  onExplanation?: (intentId: string, explanation: string) => void;
}

export class Guardian {
  private frozen = false;

  constructor(private opts: GuardianOptions) {
    opts.queue.on("proposed", (i: SwapIntent) => this.onProposed(i));
  }

  isFrozen(): boolean {
    return this.frozen;
  }

  private async onProposed(intent: SwapIntent): Promise<void> {
    if (this.frozen) {
      this.opts.queue.recordDecision({
        intentId: intent.id,
        status: "rejected",
        rules: [{ ruleId: "whitelist", fired: true, reason: "Worker is frozen — no new intents accepted." }],
        decidedAt: Date.now(),
      });
      return;
    }

    const history = this.opts.queue.getHistory().filter((h) => h.id !== intent.id);
    const results = evaluate(intent, this.opts.policy, history);

    if (!anyFired(results)) {
      const decision = await this.execute(intent, results);
      this.opts.queue.recordDecision(decision);
      return;
    }

    const freeze = await this.freeze(intent);
    this.frozen = true;
    const decision: IntentDecision = {
      intentId: intent.id,
      status: "rejected",
      rules: results,
      decidedAt: Date.now(),
      executionId: freeze.executionId,
      txHash: freeze.txHash,
    };
    this.opts.queue.recordDecision(decision);

    if (this.opts.llm && this.opts.onExplanation) {
      const fired = results.filter((r) => r.fired);
      explainAlert(this.opts.llm, intent, this.opts.policy, fired)
        .then((explanation) => this.opts.onExplanation?.(intent.id, explanation))
        .catch(() => {});
    }
  }

  private async execute(intent: SwapIntent, rules: ReturnType<typeof evaluate>): Promise<IntentDecision> {
    try {
      const res = await this.opts.kh.contractCall({
        contractAddress: intent.contractAddress,
        network: intent.network,
        functionName: intent.functionName,
        functionArgs: intent.functionArgs,
      });
      if ("executionId" in res) {
        const status = await this.opts.kh.executionStatus(res.executionId);
        return {
          intentId: intent.id,
          status: status.status === "completed" ? "executed" : "failed",
          rules,
          decidedAt: Date.now(),
          executionId: res.executionId,
          txHash: status.transactionHash,
        };
      }
      return { intentId: intent.id, status: "executed", rules, decidedAt: Date.now() };
    } catch (e) {
      return {
        intentId: intent.id,
        status: "failed",
        rules,
        decidedAt: Date.now(),
      };
    }
  }

  private async freeze(_triggering: SwapIntent): Promise<{ executionId?: string; txHash?: string }> {
    const res = await this.opts.kh.contractCall({
      contractAddress: SEPOLIA_USDC,
      network: "sepolia",
      functionName: "approve",
      functionArgs: [this.opts.policy.routerAddress, "0"],
    });
    if ("executionId" in res) {
      const status = await this.opts.kh.executionStatus(res.executionId);
      return { executionId: res.executionId, txHash: status.transactionHash };
    }
    return {};
  }
}
