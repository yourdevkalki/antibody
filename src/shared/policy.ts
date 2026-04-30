import type { Policy, Address } from "./types.ts";

export const SEPOLIA_USDC: Address = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
export const SEPOLIA_WETH: Address = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
export const SEPOLIA_UNIV3_ROUTER: Address = "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E";

export function buildDcaPolicy(treasury: Address): Policy {
  return {
    action: "buy",
    asset: "WETH",
    assetAddress: SEPOLIA_WETH,
    baseAddress: SEPOLIA_USDC,
    routerAddress: SEPOLIA_UNIV3_ROUTER,
    ownerAddress: treasury,
    maxSizeWei: 10_000_000n,
    frequencyHours: 24,
    whitelist: [SEPOLIA_UNIV3_ROUTER, SEPOLIA_USDC, SEPOLIA_WETH, treasury],
  };
}
