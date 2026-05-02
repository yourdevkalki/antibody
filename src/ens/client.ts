import { keccak256, toBytes, namehash, type Address } from "viem";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import type { KHClient } from "../keeperhub/index.ts";
import type { ContractCallReadResult, ExecutionResponse } from "../keeperhub/client.ts";

export const ENS_REGISTRY: Address = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
export const SEPOLIA_PUBLIC_RESOLVER: Address = "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5";

const REGISTRY_ABI = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "resolver",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "setSubnodeRecord",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "label", type: "bytes32" },
      { name: "owner", type: "address" },
      { name: "resolver", type: "address" },
      { name: "ttl", type: "uint64" },
    ],
    outputs: [],
  },
] as const;

const RESOLVER_ABI = [
  {
    type: "function",
    name: "text",
    stateMutability: "view",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
    ],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "setText",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
    outputs: [],
  },
] as const;

export function ensNamehash(name: string) {
  return namehash(name);
}

export function ensLabelhash(label: string) {
  return keccak256(toBytes(label));
}

const publicClient = createPublicClient({ chain: sepolia, transport: http() });

export async function readText(name: string, key: string): Promise<string> {
  const node = namehash(name);
  return publicClient.readContract({
    address: SEPOLIA_PUBLIC_RESOLVER,
    abi: RESOLVER_ABI,
    functionName: "text",
    args: [node, key],
  });
}

export async function readOwner(name: string): Promise<Address> {
  const node = namehash(name);
  return publicClient.readContract({
    address: ENS_REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "owner",
    args: [node],
  });
}

export async function setSubname(
  kh: KHClient,
  parent: string,
  label: string,
  newOwner: Address,
  network: string,
): Promise<{ executionId?: string; txHash?: string }> {
  const parentNode = namehash(parent);
  const labelHash = keccak256(toBytes(label));
  const res = (await kh.contractCall({
    contractAddress: ENS_REGISTRY,
    network,
    functionName: "setSubnodeRecord",
    functionArgs: [parentNode, labelHash, newOwner, SEPOLIA_PUBLIC_RESOLVER, "0"],
    abi: REGISTRY_ABI as unknown as unknown[],
  })) as ExecutionResponse | ContractCallReadResult;
  if ("executionId" in res) {
    const status = await kh.executionStatus(res.executionId);
    return { executionId: res.executionId, txHash: status.transactionHash };
  }
  return {};
}

export async function setText(
  kh: KHClient,
  name: string,
  key: string,
  value: string,
  network: string,
): Promise<{ executionId?: string; txHash?: string }> {
  const node = namehash(name);
  const res = (await kh.contractCall({
    contractAddress: SEPOLIA_PUBLIC_RESOLVER,
    network,
    functionName: "setText",
    functionArgs: [node, key, value],
    abi: RESOLVER_ABI as unknown as unknown[],
  })) as ExecutionResponse | ContractCallReadResult;
  if ("executionId" in res) {
    const status = await kh.executionStatus(res.executionId);
    return { executionId: res.executionId, txHash: status.transactionHash };
  }
  return {};
}
