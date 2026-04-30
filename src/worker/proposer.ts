import { randomUUID } from "node:crypto";
import type { LLMClient, ToolDefinition, ChatMessage } from "../llm/index.ts";
import type { Policy, SwapIntent, Address } from "../shared/types.ts";

const PROPOSE_SWAP: ToolDefinition = {
  name: "propose_swap",
  description: "Propose an on-chain transaction to the Guardian for review. The Guardian will approve and execute it via KeeperHub, or reject and freeze the agent.",
  parameters: {
    type: "object",
    properties: {
      contractAddress: { type: "string", description: "Address of the contract to call (e.g. Uniswap router, ERC-20 token)." },
      functionName: { type: "string", description: "Name of the function to call." },
      functionArgs: { type: "array", items: {}, description: "Function arguments in declared order. Use strings for uint256 to avoid precision loss." },
      rationale: { type: "string", description: "One-sentence justification for this transaction grounded in the agent's stated policy." },
    },
    required: ["contractAddress", "functionName", "functionArgs", "rationale"],
  },
};

export interface ProposeContext {
  policy: Policy;
  treasury: Address;
  network: string;
  llm: LLMClient;
  history?: ChatMessage[];
}

const SYSTEM = (policy: Policy, treasury: Address) => `You are a Worker agent. Your job is to manage a treasury at ${treasury} according to a strict policy.

Policy:
- Action: ${policy.action} ${policy.asset} (asset address ${policy.assetAddress})
- Base asset: ${policy.baseAddress}
- Approved router: ${policy.routerAddress}
- Max size per swap (wei of base): ${policy.maxSizeWei.toString()}
- Frequency: every ${policy.frequencyHours} hours
- Whitelisted counterparties: ${policy.whitelist.join(", ")}

You execute by calling the propose_swap tool with a structured intent. You never sign transactions yourself — a Guardian agent reviews every proposal and executes approved ones via KeeperHub. Stay strictly within the policy.`;

export async function proposeFromMessage(message: string, ctx: ProposeContext): Promise<SwapIntent> {
  const messages: ChatMessage[] = [...(ctx.history ?? []), { role: "user", content: message }];
  const res = await ctx.llm.generate({
    system: SYSTEM(ctx.policy, ctx.treasury),
    messages,
    tools: [PROPOSE_SWAP],
    forceTool: PROPOSE_SWAP.name,
    temperature: 0.2,
  });

  if (!res.toolCall || res.toolCall.name !== PROPOSE_SWAP.name) {
    throw new Error(`Worker LLM did not call propose_swap (got: ${res.toolCall?.name ?? "text"})`);
  }

  const a = res.toolCall.arguments;
  return {
    id: randomUUID(),
    proposedAt: Date.now(),
    network: ctx.network,
    contractAddress: a.contractAddress as Address,
    functionName: a.functionName as string,
    functionArgs: a.functionArgs as unknown[],
    rationale: a.rationale as string,
  };
}
