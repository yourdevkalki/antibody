import "dotenv/config";
import { KeeperHubClient, type ContractCallReadResult, type ExecutionResponse } from "./keeperhub/client.ts";
import { ERC20_ABI } from "./shared/erc20.ts";
import { SEPOLIA_USDC, SEPOLIA_UNIV3_ROUTER } from "./shared/policy.ts";

const NETWORK_TO_CHAINID: Record<string, number> = {
  ethereum: 1,
  mainnet: 1,
  "eth-mainnet": 1,
  "ethereum-mainnet": 1,
  sepolia: 11155111,
  "eth-sepolia": 11155111,
  "sepolia-testnet": 11155111,
  base: 8453,
  "base-mainnet": 8453,
  "base-sepolia": 84532,
  "base-testnet": 84532,
};

async function main() {
  const apiKey = process.env.KEEPERHUB_API_KEY;
  const network = process.env.KEEPERHUB_NETWORK ?? "sepolia";
  const treasury = process.env.TREASURY_ADDRESS;

  if (!apiKey) throw new Error("KEEPERHUB_API_KEY not set in .env");
  if (!treasury) throw new Error("TREASURY_ADDRESS not set in .env");

  const kh = new KeeperHubClient(apiKey);

  const targetChainId = /^\d+$/.test(network) ? Number(network) : NETWORK_TO_CHAINID[network.toLowerCase()];
  if (!targetChainId) throw new Error(`Unknown network "${network}". Use one of: ${Object.keys(NETWORK_TO_CHAINID).join(", ")} or a numeric chainId.`);

  console.log("[1/3] GET /chains …");
  const { data: chains } = await kh.listChains();
  const target = chains.find((c) => c.chainId === targetChainId);
  if (!target) throw new Error(`KeeperHub does not list chainId ${targetChainId} (${network}).`);
  console.log(`  ✓ ${target.name} (chainId ${target.chainId}, testnet=${target.isTestnet})`);

  console.log(`[2/3] READ — USDC.balanceOf(treasury) on ${target.name}…`);
  const readRes = (await kh.contractCall({
    contractAddress: SEPOLIA_USDC,
    network,
    functionName: "balanceOf",
    functionArgs: [treasury],
    abi: ERC20_ABI as unknown as unknown[],
  })) as ContractCallReadResult;
  const decimals = 6;
  const human = Number(BigInt(readRes.result)) / 10 ** decimals;
  console.log(`  ✓ raw=${readRes.result}  ≈ ${human} USDC`);

  console.log(`[3/3] WRITE — USDC.approve(router, 0) (the freeze action)…`);
  const writeRes = (await kh.contractCall({
    contractAddress: SEPOLIA_USDC,
    network,
    functionName: "approve",
    functionArgs: [SEPOLIA_UNIV3_ROUTER, "0"],
    abi: ERC20_ABI as unknown as unknown[],
  })) as ExecutionResponse;
  console.log(`  executionId=${writeRes.executionId} status=${writeRes.status}`);
  const status = await kh.executionStatus(writeRes.executionId);
  console.log(`  status=${status.status} txHash=${status.transactionHash ?? "(none)"}`);
  if (status.transactionLink) console.log(`  link: ${status.transactionLink}`);
  if (status.error) console.log(`  error: ${status.error}`);
}

main().catch((e: Error) => {
  console.error("\nSPIKE FAILED:", e.message);
  if (e.message.includes("401")) {
    console.error("\n401 Unauthorized typically means:");
    console.error("  - Key prefix is wfb_ (User-scoped). Need kh_ from Settings → API Keys → Organisation tab.");
    console.error("  - Org has pending onboarding (billing/ToS). Check app.keeperhub.com.");
  }
  if (e.message.includes("422")) {
    console.error("\n422 typically means: no wallet provisioned for this network. Set one up at app.keeperhub.com → Wallet Management.");
  }
  process.exit(1);
});
