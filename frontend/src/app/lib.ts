"use client";

import { useEffect, useRef, useState } from "react";

export const API_BASE = process.env.NEXT_PUBLIC_ANTIBODY_API ?? "http://127.0.0.1:3001";

export type ScenarioId = "legit" | "rule1-attacker" | "rule2-dump" | "rule3-burst";

export type RuleId = "whitelist" | "policy" | "velocity";

export interface RuleResult {
  ruleId: RuleId;
  fired: boolean;
  reason: string;
  context?: Record<string, unknown>;
}

export interface SwapIntent {
  id: string;
  proposedAt: number;
  network: string;
  contractAddress: string;
  functionName: string;
  functionArgs: unknown[];
  rationale: string;
}

export type IntentStatus = "pending" | "approved" | "rejected" | "executed" | "failed";

export interface IntentDecision {
  intentId: string;
  status: IntentStatus;
  rules: RuleResult[];
  decidedAt: number;
  executionId?: string;
  txHash?: string;
}

export interface Snapshot {
  frozen: boolean;
  treasury: string;
  policy: { action: string; asset: string; whitelist: string[]; maxSizeWei: string };
  pendingCount: number;
  llmProvider: string;
  khProvider: string;
  ens: {
    enabled: boolean;
    parent: string;
    workerName: string;
    guardianName: string;
    policySource: "ens" | "fallback";
  };
}

export type AuditEntry =
  | { kind: "snapshot"; at: number; snapshot: Snapshot }
  | { kind: "worker_chat"; at: number; role: "user" | "assistant"; content: string }
  | { kind: "intent_proposed"; at: number; intent: SwapIntent }
  | { kind: "intent_decided"; at: number; decision: IntentDecision }
  | { kind: "guardian_explanation"; at: number; intentId: string; text: string }
  | { kind: "frozen"; at: number; intentId: string; freezeTxHash?: string }
  | { kind: "policy_loaded"; at: number; source: string }
  | { kind: "reset"; at: number };

export async function postScenario(scenario: ScenarioId): Promise<void> {
  await fetch(`${API_BASE}/worker/scenario`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario }),
  });
}

export async function postChat(message: string): Promise<{ intentId: string }> {
  const res = await fetch(`${API_BASE}/worker/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(`chat failed: ${res.status}`);
  return res.json();
}

export async function postReset(): Promise<void> {
  await fetch(`${API_BASE}/reset`, { method: "POST" });
}

export interface Balance {
  raw: string;
  formatted: string;
  decimals: number;
  symbol: string;
}

export async function fetchBalance(): Promise<Balance> {
  const res = await fetch(`${API_BASE}/balance`);
  return res.json();
}

export function useBalance(intervalMs = 5000): Balance | null {
  const [balance, setBalance] = useState<Balance | null>(null);
  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const b = await fetchBalance();
        if (active) setBalance(b);
      } catch {}
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [intervalMs]);
  return balance;
}

export function useEvents(): { entries: AuditEntry[]; snapshot: Snapshot | null; connected: boolean } {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const ev = new EventSource(`${API_BASE}/events`);
    sourceRef.current = ev;
    ev.onopen = () => setConnected(true);
    ev.onerror = () => setConnected(false);
    ev.onmessage = (e) => {
      try {
        const entry = JSON.parse(e.data) as AuditEntry;
        if (entry.kind === "snapshot") setSnapshot(entry.snapshot);
        if (entry.kind === "reset") {
          setEntries([]);
          return;
        }
        setEntries((prev) => [...prev, entry]);
      } catch {}
    };
    return () => {
      ev.close();
      sourceRef.current = null;
    };
  }, []);

  return { entries, snapshot, connected };
}

export function shorten(addr: string, head = 6, tail = 4): string {
  if (!addr || addr.length < head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function explorerLink(txHash: string | undefined): string | null {
  if (!txHash) return null;
  return `https://sepolia.etherscan.io/tx/${txHash}`;
}

export function ensLink(name: string): string {
  return `https://sepolia.app.ens.domains/${name}`;
}
