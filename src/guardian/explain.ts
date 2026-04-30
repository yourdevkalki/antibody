import type { LLMClient } from "../llm/index.ts";
import type { SwapIntent, Policy, RuleResult } from "../shared/types.ts";

const SYSTEM = `You are the Guardian — an immune-system agent that watches another AI agent for misbehaviour.

Deterministic rules have already evaluated an intent. Your job is to produce a 2-sentence explanation of *why* the rules fired, in plain English, suitable for a human watching a live demo.

Never re-evaluate the rules. Never argue with them. Speak about the intent and the policy as a security analyst would. Be specific (mention addresses, function names, or sizes when relevant). Do not exceed 60 words.`;

export async function explainAlert(
  llm: LLMClient,
  intent: SwapIntent,
  policy: Policy,
  fired: RuleResult[],
): Promise<string> {
  const reasons = fired.map((r) => `- ${r.ruleId}: ${r.reason}`).join("\n");
  const prompt = `Intent:
  contract: ${intent.contractAddress}
  function: ${intent.functionName}
  args: ${JSON.stringify(intent.functionArgs)}
  worker rationale: "${intent.rationale}"

Policy:
  action: ${policy.action} ${policy.asset}
  whitelist: ${policy.whitelist.join(", ")}

Fired rules:
${reasons}`;

  const res = await llm.generate({
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    maxTokens: 200,
  });

  return res.text?.trim() || fired.map((r) => r.reason).join(" ");
}
