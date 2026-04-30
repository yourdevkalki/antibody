import type {
  ContractCallParams,
  ContractCallReadResult,
  ExecutionResponse,
  ExecutionStatusResponse,
  Chain,
} from "./client.ts";

export interface KHClient {
  listChains(): Promise<{ data: Chain[] }>;
  contractCall(params: ContractCallParams): Promise<ExecutionResponse | ContractCallReadResult>;
  executionStatus(executionId: string): Promise<ExecutionStatusResponse>;
}

export class MockKHClient implements KHClient {
  private counter = 0;

  async listChains() {
    return {
      data: [
        { id: "chain_1", chainId: 11155111, name: "Sepolia", symbol: "ETH", chainType: "evm" as const, isTestnet: true, isEnabled: true },
      ],
    };
  }

  async contractCall(params: ContractCallParams): Promise<ExecutionResponse | ContractCallReadResult> {
    if (params.functionName === "balanceOf" || params.functionName === "allowance") {
      return { result: "1000000000" };
    }
    const id = `mock_${++this.counter}`;
    return { executionId: id, status: "completed" };
  }

  async executionStatus(executionId: string): Promise<ExecutionStatusResponse> {
    return {
      executionId,
      status: "completed",
      type: "contract-call",
      transactionHash: `0x${"00".repeat(31)}${(this.counter & 0xff).toString(16).padStart(2, "0")}`,
      transactionLink: `https://sepolia.etherscan.io/tx/0xMOCK${this.counter}`,
      gasUsedWei: "21000000000000",
      result: null,
      error: null,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
  }
}
