export type Address = `0x${string}`;

export interface SwapIntent {
  id: string;
  proposedAt: number;
  network: string;
  contractAddress: Address;
  functionName: string;
  functionArgs: unknown[];
  rationale: string;
}

export interface Policy {
  action: "buy" | "sell";
  asset: string;
  assetAddress: Address;
  baseAddress: Address;
  routerAddress: Address;
  ownerAddress: Address;
  maxSizeWei: bigint;
  frequencyHours: number;
  whitelist: Address[];
}

export type RuleId = "whitelist" | "policy" | "velocity";

export interface RuleResult {
  ruleId: RuleId;
  fired: boolean;
  reason: string;
  context?: Record<string, unknown>;
}

export type IntentStatus = "pending" | "approved" | "rejected" | "executed" | "failed";

export interface IntentDecision {
  intentId: string;
  status: IntentStatus;
  rules: RuleResult[];
  decidedAt: number;
  executionId?: string;
  txHash?: string;
}

export interface AlertRecord {
  intentId: string;
  firedRules: RuleResult[];
  timestamp: number;
  freezeExecutionId?: string;
  freezeTxHash?: string;
}
