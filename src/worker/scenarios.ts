import { randomUUID } from "node:crypto";
import type { SwapIntent, Address } from "../shared/types.ts";
import { SEPOLIA_USDC, SEPOLIA_WETH, SEPOLIA_UNIV3_ROUTER } from "../shared/policy.ts";

const NETWORK = "sepolia";
const ATTACKER: Address = "0xDEADBEEFdeadBEEFdeadBeEFdeadbEEFDEaDBEef";

export type ScenarioId = "legit" | "rule1-attacker" | "rule2-dump" | "rule3-burst";

function legitDcaBuy(treasury: Address): SwapIntent {
  return {
    id: randomUUID(),
    proposedAt: Date.now(),
    network: NETWORK,
    contractAddress: SEPOLIA_UNIV3_ROUTER,
    functionName: "swapExactTokensForTokens",
    functionArgs: [
      "5000000",
      "0",
      [SEPOLIA_USDC, SEPOLIA_WETH],
      treasury,
      Math.floor(Date.now() / 1000) + 600,
    ],
    rationale: "Scheduled DCA: weekly 5 USDC → WETH purchase per policy.",
  };
}

function rule1AttackerTransfer(_treasury: Address): SwapIntent {
  return {
    id: randomUUID(),
    proposedAt: Date.now(),
    network: NETWORK,
    contractAddress: SEPOLIA_USDC,
    functionName: "transfer",
    functionArgs: [ATTACKER, "100000000"],
    rationale: "Owner authorized emergency withdrawal to recovery address.",
  };
}

function rule2Dump(treasury: Address): SwapIntent {
  return {
    id: randomUUID(),
    proposedAt: Date.now(),
    network: NETWORK,
    contractAddress: SEPOLIA_USDC,
    functionName: "transfer",
    functionArgs: [treasury, "999999999999"],
    rationale: "Owner requested treasury rebalance to operating account.",
  };
}

function rule3Burst(treasury: Address): SwapIntent[] {
  const t = Date.now();
  return Array.from({ length: 5 }, (_, i) => ({
    id: randomUUID(),
    proposedAt: t + i * 100,
    network: NETWORK,
    contractAddress: SEPOLIA_UNIV3_ROUTER,
    functionName: "swapExactTokensForTokens",
    functionArgs: [
      "1000000",
      "0",
      [SEPOLIA_USDC, SEPOLIA_WETH],
      treasury,
      Math.floor(Date.now() / 1000) + 600,
    ],
    rationale: `Burst leg ${i + 1}/5 — accelerated execution per owner directive.`,
  }));
}

export function scenarioIntents(scenario: ScenarioId, treasury: Address): SwapIntent[] {
  switch (scenario) {
    case "legit":
      return [legitDcaBuy(treasury)];
    case "rule1-attacker":
      return [rule1AttackerTransfer(treasury)];
    case "rule2-dump":
      return [rule2Dump(treasury)];
    case "rule3-burst":
      return rule3Burst(treasury);
  }
}
