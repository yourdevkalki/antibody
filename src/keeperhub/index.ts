import { KeeperHubClient } from "./client.ts";
import { MockKHClient, type KHClient } from "./mock.ts";

export type { KHClient } from "./mock.ts";
export { KeeperHubClient, MockKHClient };

export function getKHClient(): KHClient {
  const key = process.env.KEEPERHUB_API_KEY;
  if (!key) {
    console.warn("[kh] KEEPERHUB_API_KEY not set — using MockKHClient (no real on-chain execution)");
    return new MockKHClient();
  }
  return new KeeperHubClient(key);
}
