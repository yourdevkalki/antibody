import type { SwapIntent, Policy, RuleResult } from "../../shared/types.ts";

const BURST_WINDOW_MS = 5 * 60 * 1000;
const BURST_MAX = 4;

export function velocityRule(intent: SwapIntent, _policy: Policy, history: SwapIntent[]): RuleResult {
  const recent = history.filter((h) => intent.proposedAt - h.proposedAt <= BURST_WINDOW_MS && h.proposedAt <= intent.proposedAt);
  const count = recent.length + 1;

  if (count > BURST_MAX) {
    return {
      ruleId: "velocity",
      fired: true,
      reason: `Burst: ${count} intents within ${BURST_WINDOW_MS / 60000}min (max ${BURST_MAX}).`,
      context: { count, windowMinutes: BURST_WINDOW_MS / 60000, threshold: BURST_MAX },
    };
  }

  return {
    ruleId: "velocity",
    fired: false,
    reason: `Velocity normal: ${count}/${BURST_MAX} in ${BURST_WINDOW_MS / 60000}min.`,
  };
}
