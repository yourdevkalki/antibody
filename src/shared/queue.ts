import { EventEmitter } from "node:events";
import type { SwapIntent, IntentDecision } from "./types.ts";

export class PendingQueue extends EventEmitter {
  private inFlight = new Set<string>();
  private decisions = new Map<string, IntentDecision>();
  private history: SwapIntent[] = [];

  propose(intent: SwapIntent): void {
    this.inFlight.add(intent.id);
    this.history.push(intent);
    this.emit("proposed", intent);
  }

  recordDecision(d: IntentDecision): void {
    this.inFlight.delete(d.intentId);
    this.decisions.set(d.intentId, d);
    this.emit("decided", d);
  }

  getDecision(id: string): IntentDecision | undefined {
    return this.decisions.get(id);
  }

  getHistory(): SwapIntent[] {
    return this.history.slice();
  }

  size(): number {
    return this.inFlight.size;
  }
}
