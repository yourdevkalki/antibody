import "dotenv/config";
import type { Address } from "../shared/types.ts";
import { PendingQueue } from "../shared/queue.ts";
import { scenarioIntents, type ScenarioId } from "./scenarios.ts";

export interface WorkerOptions {
  treasury: Address;
  queue: PendingQueue;
}

export class Worker {
  constructor(private opts: WorkerOptions) {}

  runScenario(scenario: ScenarioId, intervalMs = 0): void {
    const intents = scenarioIntents(scenario, this.opts.treasury);
    if (intervalMs === 0) {
      for (const i of intents) this.opts.queue.propose(i);
      return;
    }
    let idx = 0;
    const tick = () => {
      if (idx >= intents.length) return;
      this.opts.queue.propose(intents[idx++]);
      setTimeout(tick, intervalMs);
    };
    tick();
  }
}
