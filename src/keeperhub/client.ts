const BASE_URL = "https://app.keeperhub.com/api";

export type ExecutionStatus = "pending" | "running" | "completed" | "failed";

export interface ExecutionResponse {
  executionId: string;
  status: ExecutionStatus;
}

export interface ExecutionStatusResponse {
  executionId: string;
  status: ExecutionStatus;
  type: "transfer" | "contract-call";
  transactionHash?: string;
  transactionLink?: string;
  gasUsedWei?: string;
  result?: unknown;
  error?: string | null;
  createdAt: string;
  completedAt?: string;
}

export interface Chain {
  id: string;
  chainId: number;
  name: string;
  symbol: string;
  chainType: "evm" | "solana";
  isTestnet: boolean;
  isEnabled: boolean;
}

export interface ContractCallReadResult {
  result: string;
}

export interface ContractCallParams {
  contractAddress: string;
  network: string;
  functionName: string;
  functionArgs?: unknown[];
  abi?: unknown[];
  value?: string;
  gasLimitMultiplier?: string;
}

export class KeeperHubClient {
  constructor(private apiKey: string) {
    if (!apiKey?.startsWith("kh_")) {
      throw new Error('KEEPERHUB_API_KEY missing or wrong prefix (must start with "kh_")');
    }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`KeeperHub ${res.status} ${path}: ${text}`);
    }
    return text ? (JSON.parse(text) as T) : (undefined as T);
  }

  listChains(): Promise<{ data: Chain[] }> {
    return this.request("/chains");
  }

  contractCall(params: ContractCallParams): Promise<ExecutionResponse | ContractCallReadResult> {
    return this.request("/execute/contract-call", {
      method: "POST",
      body: JSON.stringify({
        ...params,
        functionArgs: params.functionArgs ? JSON.stringify(params.functionArgs) : undefined,
        abi: params.abi ? JSON.stringify(params.abi) : undefined,
      }),
    });
  }

  executionStatus(executionId: string): Promise<ExecutionStatusResponse> {
    return this.request(`/execute/${executionId}/status`);
  }
}
