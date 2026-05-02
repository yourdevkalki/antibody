import type { Address, Policy } from "../shared/types.ts";

export interface SerializedPolicy {
  action: "buy" | "sell";
  asset: string;
  assetAddress: Address;
  baseAddress: Address;
  routerAddress: Address;
  ownerAddress: Address;
  maxSizeWei: string;
  frequencyHours: number;
  whitelist: Address[];
}

export function serializePolicy(p: Policy): SerializedPolicy {
  return {
    action: p.action,
    asset: p.asset,
    assetAddress: p.assetAddress,
    baseAddress: p.baseAddress,
    routerAddress: p.routerAddress,
    ownerAddress: p.ownerAddress,
    maxSizeWei: p.maxSizeWei.toString(),
    frequencyHours: p.frequencyHours,
    whitelist: p.whitelist,
  };
}

export function deserializePolicy(s: SerializedPolicy): Policy {
  return {
    action: s.action,
    asset: s.asset,
    assetAddress: s.assetAddress,
    baseAddress: s.baseAddress,
    routerAddress: s.routerAddress,
    ownerAddress: s.ownerAddress,
    maxSizeWei: BigInt(s.maxSizeWei),
    frequencyHours: s.frequencyHours,
    whitelist: s.whitelist,
  };
}
