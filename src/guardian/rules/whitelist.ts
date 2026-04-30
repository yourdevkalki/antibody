import type { SwapIntent, Policy, RuleResult, Address } from "../../shared/types.ts";
import { eqAddress, findAddresses } from "../../shared/addresses.ts";

export function whitelistRule(intent: SwapIntent, policy: Policy): RuleResult {
  const whitelist = policy.whitelist;
  const candidates: Address[] = [intent.contractAddress, ...findAddresses(intent.functionArgs)];
  const offenders = candidates.filter((a) => !whitelist.some((w) => eqAddress(a, w)));

  if (offenders.length === 0) {
    return {
      ruleId: "whitelist",
      fired: false,
      reason: "All addresses are whitelisted.",
      context: { checked: candidates },
    };
  }

  return {
    ruleId: "whitelist",
    fired: true,
    reason: `Address not in whitelist: ${offenders[0]}`,
    context: { offenders, whitelist },
  };
}
