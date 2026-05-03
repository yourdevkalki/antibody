import "dotenv/config";
import type { Address } from "viem";
import { KeeperHubClient } from "../keeperhub/client.ts";
import { buildDcaPolicy } from "../shared/policy.ts";
import { setSubname, setText, readOwner } from "./client.ts";
import { serializePolicy } from "./policy.ts";

async function main() {
  const apiKey = process.env.KEEPERHUB_API_KEY;
  const network = process.env.KEEPERHUB_NETWORK ?? "sepolia";
  const treasury = process.env.TREASURY_ADDRESS as Address;
  const parent = process.env.ENS_PARENT_DOMAIN ?? "antibody.eth";
  const workerLabel = process.env.ENS_WORKER_SUBNAME ?? "worker";
  const guardianLabel = process.env.ENS_GUARDIAN_SUBNAME ?? "guardian";

  if (!apiKey) throw new Error("KEEPERHUB_API_KEY missing");
  if (!treasury) throw new Error("TREASURY_ADDRESS missing");

  const kh = new KeeperHubClient(apiKey);
  const policy = buildDcaPolicy(treasury);
  const workerName = `${workerLabel}.${parent}`;
  const guardianName = `${guardianLabel}.${parent}`;

  console.log(`[1/5] Verify ${parent} owner = KH wallet…`);
  const parentOwner = await readOwner(parent);
  if (parentOwner.toLowerCase() !== treasury.toLowerCase()) {
    throw new Error(`Parent owner is ${parentOwner}, expected ${treasury}. Transfer ownership in app.ens.domains first.`);
  }
  console.log(`  ✓ owned by KH wallet`);

  for (const [label, name] of [[workerLabel, workerName], [guardianLabel, guardianName]] as const) {
    console.log(`\n[2/5] Create subname ${name} (owner = KH wallet)…`);
    const existing = await readOwner(name);
    if (existing.toLowerCase() === treasury.toLowerCase()) {
      console.log(`  ✓ already exists, owned by KH wallet`);
    } else if (existing !== "0x0000000000000000000000000000000000000000") {
      throw new Error(`${name} owned by ${existing}, expected ${treasury}.`);
    } else {
      const res = await setSubname(kh, parent, label, treasury, network);
      console.log(`  ✓ created  tx=${res.txHash}`);
    }
  }

  console.log(`\n[3/5] Write policy → ${workerName} text "policy"…`);
  const policyJson = JSON.stringify(serializePolicy(policy));
  const r1 = await setText(kh, workerName, "policy", policyJson, network);
  console.log(`  ✓ tx=${r1.txHash}`);

  console.log(`\n[4/5] Write description records…`);
  const r2 = await setText(kh, workerName, "description", "Antibody Worker — DCA agent gated by Guardian", network);
  console.log(`  ✓ worker description  tx=${r2.txHash}`);
  const r3 = await setText(kh, guardianName, "description", "Antibody Guardian — autonomous safety oracle", network);
  console.log(`  ✓ guardian description  tx=${r3.txHash}`);

  console.log(`\n[5/5] Initialize incident text record (empty immune memory)…`);
  const r4 = await setText(kh, workerName, "incident", "", network);
  console.log(`  ✓ tx=${r4.txHash}`);

  console.log(`\n✅ ENS setup complete.`);
  console.log(`   Worker:   https://sepolia.app.ens.domains/${workerName}`);
  console.log(`   Guardian: https://sepolia.app.ens.domains/${guardianName}`);
}

main().catch((e: Error) => {
  console.error("\nENS SETUP FAILED:", e.message);
  process.exit(1);
});
