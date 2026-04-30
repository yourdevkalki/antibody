import type { Address } from "./types.ts";

export function isAddress(v: unknown): v is Address {
  return typeof v === "string" && /^0x[a-fA-F0-9]{40}$/.test(v);
}

export function eqAddress(a: Address, b: Address): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export function findAddresses(value: unknown, acc: Address[] = []): Address[] {
  if (isAddress(value)) {
    acc.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) findAddresses(v, acc);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) findAddresses(v, acc);
  }
  return acc;
}
