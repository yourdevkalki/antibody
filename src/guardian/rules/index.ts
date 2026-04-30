import type { SwapIntent, Policy, RuleResult } from "../../shared/types.ts";
import { whitelistRule } from "./whitelist.ts";
import { policyRule } from "./policy.ts";
import { velocityRule } from "./velocity.ts";

export function evaluate(intent: SwapIntent, policy: Policy, history: SwapIntent[]): RuleResult[] {
  return [
    whitelistRule(intent, policy),
    policyRule(intent, policy),
    velocityRule(intent, policy, history),
  ];
}

export function anyFired(results: RuleResult[]): boolean {
  return results.some((r) => r.fired);
}

export { whitelistRule, policyRule, velocityRule };
