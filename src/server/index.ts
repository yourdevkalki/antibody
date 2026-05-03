import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { createRuntime } from "./runtime.ts";
import type { ScenarioId } from "../worker/scenarios.ts";

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "127.0.0.1";

const app = Fastify({ logger: { level: "warn" } });
await app.register(cors, { origin: true });
const rt = await createRuntime();

app.get("/healthz", async () => ({ ok: true }));

app.get("/state", async () => rt.snapshot());

app.get("/events", (req, reply) => {
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  const send = (entry: unknown) => reply.raw.write(`data: ${JSON.stringify(entry, bigintReplacer)}\n\n`);
  send({ kind: "snapshot", at: Date.now(), snapshot: rt.snapshot() });

  const onAudit = (entry: unknown) => send(entry);
  rt.bus.on("audit", onAudit);

  const heartbeat = setInterval(() => reply.raw.write(`: ping\n\n`), 15_000);
  req.raw.on("close", () => {
    rt.bus.off("audit", onAudit);
    clearInterval(heartbeat);
  });
});

app.post<{ Body: { scenario: ScenarioId } }>("/worker/scenario", async (req) => {
  rt.runScenario(req.body.scenario);
  return { ok: true };
});

app.post<{ Body: { message: string } }>("/worker/chat", async (req) => {
  const intent = await rt.chat(req.body.message);
  return { intentId: intent.id };
});

app.post("/reset", async () => {
  rt.reset();
  return { ok: true };
});

app.get("/balance", async () => rt.balance());

app.listen({ port: PORT, host: HOST }).then(() => {
  console.log(`antibody server: http://${HOST}:${PORT}`);
  console.log(`  GET  /healthz`);
  console.log(`  GET  /state`);
  console.log(`  GET  /events                (SSE)`);
  console.log(`  POST /worker/scenario       { scenario: "legit" | "rule1-attacker" | "rule2-dump" | "rule3-burst" }`);
  console.log(`  POST /worker/chat           { message: string }`);
  console.log(`  POST /reset                 (clear state for next demo take)`);
  console.log(`  GET  /balance               (live USDC balance of treasury)`);
  const snap = rt.snapshot();
  console.log(`  llm: ${snap.llmProvider}  kh: ${snap.khProvider}  treasury: ${snap.treasury}`);
  console.log(`  ens: ${snap.ens.policySource} (${snap.ens.workerName})`);
});

function bigintReplacer(_k: string, v: unknown): unknown {
  return typeof v === "bigint" ? v.toString() : v;
}
