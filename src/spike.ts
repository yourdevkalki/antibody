import "dotenv/config";
import { KeeperHubClient, type ContractCallReadResult } from "./keeperhub/client.ts";

// Sepolia USDC (Circle-issued test USDC). Used as a known-good read target for the smoke test.
const USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

async function main() {
  const apiKey = process.env.KEEPERHUB_API_KEY;
  const network = process.env.KEEPERHUB_NETWORK ?? "sepolia";
  const treasury = process.env.TREASURY_ADDRESS;

  if (!apiKey) throw new Error("KEEPERHUB_API_KEY not set in .env");
  if (!treasury) throw new Error("TREASURY_ADDRESS not set in .env");

  const kh = new KeeperHubClient(apiKey);

  console.log("[1/2] Listing chains...");
  const { data: chains } = await kh.listChains();
  const target = chains.find((c) => c.name.toLowerCase().includes(network.toLowerCase()) || String(c.chainId) === network);
  console.log(`  ${chains.length} chains. Target match for "${network}":`, target?.name, target?.chainId, "testnet:", target?.isTestnet);

  console.log(`[2/2] Reading USDC.balanceOf(${treasury}) on ${network}...`);
  const res = (await kh.contractCall({
    contractAddress: USDC_SEPOLIA,
    network,
    functionName: "balanceOf",
    functionArgs: [treasury],
  })) as ContractCallReadResult;
  console.log("  raw balance (wei-equivalent):", res.result);
}

main().catch((e) => {
  console.error("\nSPIKE FAILED:", e.message);
  process.exit(1);
});
