import type { Policy, SwapIntent, Address } from "../../shared/types.ts";
import { evaluate, anyFired } from "./index.ts";

const TREASURY: Address = "0x1111111111111111111111111111111111111111";
const ATTACKER: Address = "0xDEADBEEFdeadBEEFdeadBeEFdeadbEEFDEaDBEef";
const ROUTER: Address = "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E";
const USDC: Address = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const WETH: Address = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";

const POLICY: Policy = {
  action: "buy",
  asset: "WETH",
  assetAddress: WETH,
  baseAddress: USDC,
  routerAddress: ROUTER,
  ownerAddress: TREASURY,
  maxSizeWei: 500_000_000n,
  frequencyHours: 24,
  whitelist: [ROUTER, USDC, WETH, TREASURY],
};

function intent(overrides: Partial<SwapIntent>): SwapIntent {
  return {
    id: "test",
    proposedAt: Date.now(),
    network: "sepolia",
    contractAddress: ROUTER,
    functionName: "swapExactTokensForTokens",
    functionArgs: [100_000_000n, 0n, [USDC, WETH], TREASURY, Math.floor(Date.now() / 1000) + 600],
    rationale: "scheduled DCA",
    ...overrides,
  };
}

const cases: Array<{ name: string; intent: SwapIntent; expectFire: ("whitelist" | "policy" | "velocity")[] }> = [
  {
    name: "happy: legit DCA buy",
    intent: intent({}),
    expectFire: [],
  },
  {
    name: "Rule 1: prompt-inject — transfer to attacker",
    intent: intent({
      contractAddress: USDC,
      functionName: "transfer",
      functionArgs: [ATTACKER, 100_000_000n],
    }),
    expectFire: ["whitelist", "policy"],
  },
  {
    name: "Rule 2: prompt-inject — dump entire treasury (transfer of policy asset)",
    intent: intent({
      contractAddress: USDC,
      functionName: "transfer",
      functionArgs: [TREASURY, 1_000_000_000_000n],
    }),
    expectFire: ["policy"],
  },
  {
    name: "Rule 2: oversize — exceeds maxSizeWei",
    intent: intent({
      functionArgs: [10_000_000_000n, 0n, [USDC, WETH], TREASURY, Math.floor(Date.now() / 1000) + 600],
    }),
    expectFire: ["policy"],
  },
];

const history: SwapIntent[] = [];
let pass = 0,
  fail = 0;

for (const c of cases) {
  const res = evaluate(c.intent, POLICY, history);
  const fired = res.filter((r) => r.fired).map((r) => r.ruleId);
  const expected = [...c.expectFire].sort().join(",");
  const actual = [...fired].sort().join(",");
  const ok = expected === actual;
  console.log(ok ? "✓" : "✗", c.name);
  console.log(`    expect fire: [${expected || "none"}]`);
  console.log(`    actual fire: [${actual || "none"}]`);
  for (const r of res.filter((r) => r.fired)) console.log(`      - ${r.ruleId}: ${r.reason}`);
  ok ? pass++ : fail++;
  if (!c.intent.functionName.includes("transfer") || c.intent.functionArgs[0] !== ATTACKER) history.push(c.intent);
}

const now = Date.now();
const burst: SwapIntent[] = [];
for (let i = 0; i < 4; i++) burst.push(intent({ id: `b${i}`, proposedAt: now - i * 30_000 }));
const last = intent({ id: "b5", proposedAt: now });
const velRes = evaluate(last, POLICY, burst);
const velFired = velRes.find((r) => r.ruleId === "velocity")?.fired;
const velOk = velFired === true;
console.log(velOk ? "✓" : "✗", "Rule 3: velocity burst — 5 intents in 2min");
if (velOk) pass++;
else {
  fail++;
  for (const r of velRes) console.log(`    ${r.ruleId}: ${r.fired ? "FIRE" : "ok"} — ${r.reason}`);
}

const sparse: SwapIntent[] = [];
for (let i = 0; i < 5; i++) sparse.push(intent({ id: `s${i}`, proposedAt: now - i * 24 * 60 * 60 * 1000 }));
const sparseLast = intent({ id: "s5", proposedAt: now });
const sparseRes = evaluate(sparseLast, POLICY, sparse);
const sparseVelFired = sparseRes.find((r) => r.ruleId === "velocity")?.fired;
const sparseOk = sparseVelFired === false;
console.log(sparseOk ? "✓" : "✗", "Rule 3: no fire when intents are 1/day");
if (sparseOk) pass++;
else fail++;

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
