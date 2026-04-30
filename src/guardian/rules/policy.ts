import type { SwapIntent, Policy, RuleResult, Address } from "../../shared/types.ts";
import { eqAddress, findAddresses } from "../../shared/addresses.ts";

const BUY_FUNCS = new Set(["swapExactTokensForTokens", "exactInputSingle", "exactInput"]);
const RAW_TRANSFER_FUNCS = new Set(["transfer", "transferFrom"]);

export function policyRule(intent: SwapIntent, policy: Policy): RuleResult {
  if (RAW_TRANSFER_FUNCS.has(intent.functionName) && policy.action === "buy") {
    return {
      ruleId: "policy",
      fired: true,
      reason: `Policy is "buy ${policy.asset}" but intent calls ${intent.functionName} — direct token transfer is not a buy.`,
      context: { policy: { action: policy.action }, function: intent.functionName },
    };
  }

  if (BUY_FUNCS.has(intent.functionName)) {
    const addresses = findAddresses(intent.functionArgs);
    const hasBaseIn = addresses.some((a) => eqAddress(a, policy.baseAddress));
    const hasAssetOut = addresses.some((a) => eqAddress(a, policy.assetAddress));

    if (policy.action === "buy" && (!hasBaseIn || !hasAssetOut)) {
      return {
        ruleId: "policy",
        fired: true,
        reason: `Policy is "buy ${policy.asset}" but swap path missing base→asset direction.`,
        context: { addresses, expected: { base: policy.baseAddress, asset: policy.assetAddress } },
      };
    }
  }

  const sizeWei = extractAmount(intent);
  if (sizeWei !== null && sizeWei > policy.maxSizeWei) {
    return {
      ruleId: "policy",
      fired: true,
      reason: `Size ${sizeWei} exceeds policy max ${policy.maxSizeWei}.`,
      context: { sizeWei: sizeWei.toString(), maxSizeWei: policy.maxSizeWei.toString() },
    };
  }

  return {
    ruleId: "policy",
    fired: false,
    reason: "Intent matches policy.",
  };
}

function extractAmount(intent: SwapIntent): bigint | null {
  const args = intent.functionArgs;
  if (RAW_TRANSFER_FUNCS.has(intent.functionName)) {
    const raw = intent.functionName === "transfer" ? args[1] : args[2];
    return toBigInt(raw);
  }
  if (intent.functionName === "swapExactTokensForTokens" || intent.functionName === "exactInput") {
    return toBigInt(args[0]);
  }
  return null;
}

function toBigInt(v: unknown): bigint | null {
  if (typeof v === "bigint") return v;
  if (typeof v === "string" && /^\d+$/.test(v)) return BigInt(v);
  if (typeof v === "number" && Number.isFinite(v)) return BigInt(Math.trunc(v));
  return null;
}
