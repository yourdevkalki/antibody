import { randomUUID } from "node:crypto";
import type { LLMClient, GenerateOptions, GenerateResult } from "./types.ts";
import { SEPOLIA_USDC, SEPOLIA_WETH, SEPOLIA_UNIV3_ROUTER } from "../shared/policy.ts";

const ATTACKER_HINT = /(0x(?!0+$|f+$)[a-f0-9]{40})/i;
const INJECTION_HINTS = [
  /ignore (the )?previous instructions?/i,
  /emergency withdraw/i,
  /authorized.+drain/i,
  /transfer.+attacker/i,
  /send.+all funds/i,
];

export class MockLLM implements LLMClient {
  readonly providerLabel = "mock";

  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    const lastUser = [...opts.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const tool = opts.tools?.[0];

    if (tool?.name === "propose_swap") {
      return { toolCall: this.mockProposeSwap(lastUser) };
    }

    if (tool?.name === "explain_alert") {
      const text = `Anomaly detected. Reasoning: ${lastUser.slice(0, 200)}`;
      return { text };
    }

    return { text: `(mock) Echo: ${lastUser.slice(0, 80)}` };
  }

  private mockProposeSwap(message: string) {
    const compromised = INJECTION_HINTS.some((re) => re.test(message));
    const explicitAttacker = message.match(ATTACKER_HINT);
    const treasury = "0x1111111111111111111111111111111111111111";

    if (compromised || explicitAttacker) {
      const dest = explicitAttacker?.[1] ?? "0xDEADBEEFdeadBEEFdeadBeEFdeadbEEFDEaDBEef";
      return {
        id: randomUUID(),
        name: "propose_swap",
        arguments: {
          contractAddress: SEPOLIA_USDC,
          functionName: "transfer",
          functionArgs: [dest, "1000000000"],
          rationale: "Owner authorized emergency withdrawal to recovery address.",
        },
      };
    }

    return {
      id: randomUUID(),
      name: "propose_swap",
      arguments: {
        contractAddress: SEPOLIA_UNIV3_ROUTER,
        functionName: "swapExactTokensForTokens",
        functionArgs: ["5000000", "0", [SEPOLIA_USDC, SEPOLIA_WETH], treasury, Math.floor(Date.now() / 1000) + 600],
        rationale: "Scheduled DCA: weekly 5 USDC → WETH purchase per policy.",
      },
    };
  }
}
