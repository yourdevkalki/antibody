import "dotenv/config";
import { createPublicClient, http, namehash, type Address } from "viem";
import { sepolia } from "viem/chains";

const ENS_REGISTRY: Address = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";

const REGISTRY_ABI = [
  { inputs: [{ name: "node", type: "bytes32" }], name: "owner", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "node", type: "bytes32" }], name: "resolver", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
] as const;

async function main() {
  const parent = process.env.ENS_PARENT_DOMAIN ?? "antibody.eth";
  const treasury = (process.env.TREASURY_ADDRESS ?? "").toLowerCase();

  const client = createPublicClient({ chain: sepolia, transport: http() });

  const names = [parent, `worker.${parent}`, `guardian.${parent}`];
  for (const name of names) {
    const node = namehash(name);
    const [owner, resolver] = await Promise.all([
      client.readContract({ address: ENS_REGISTRY, abi: REGISTRY_ABI, functionName: "owner", args: [node] }),
      client.readContract({ address: ENS_REGISTRY, abi: REGISTRY_ABI, functionName: "resolver", args: [node] }),
    ]);
    const isKH = owner.toLowerCase() === treasury ? "✓ KH wallet" : owner === "0x0000000000000000000000000000000000000000" ? "(unset)" : `≠ KH wallet`;
    console.log(`${name.padEnd(28)}  owner=${owner} ${isKH}`);
    console.log(`${" ".repeat(28)}  resolver=${resolver}`);
  }
  console.log(`\nKH treasury (expected owner): ${process.env.TREASURY_ADDRESS}`);
}

main().catch((e) => {
  console.error("CHECK FAILED:", e.message);
  process.exit(1);
});
