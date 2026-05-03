# KeeperHub Feedback — Antibody

Hi KeeperHub team — this is feedback collected while building **Antibody**, an autonomous safety layer for AI agents. Antibody routes every Worker swap proposal *and* the freeze-on-anomaly action through KeeperHub's `/api/execute/contract-call`. The Guardian agent holds the only `kh_` key; the Worker has zero on-chain authority. KH is in the normal path, not just the failure path.

So I used the API hard. What follows is grouped by the bounty's four buckets, with reproduction details.

---

## UX friction

### 1. The "Organisation" vs "User" tab is the single biggest stumbling block

When you create your first API key, the page defaults to a "User" tab whose keys are prefixed `wfb_`. These keys silently work on `GET /api/chains` and `GET /api/workflows` (read), so a new dev has every reason to think the key is fine. Then they hit `POST /api/execute/*` and get a flat `{"error":"Unauthorized"}` 401.

The cycle of "is my key wrong? did I copy it badly? is the org missing? is the wallet not provisioned? is billing broken?" took me multiple iterations and a Discord-style debug spiral before I noticed that `wfb_` ≠ `kh_`.

**Suggestions, ranked:**
- **Best:** Don't accept `wfb_` keys on read endpoints either. Return a `401 wrong_key_type` with a message like `"This endpoint requires an organisation key (kh_). The key you sent is user-scoped (wfb_) and only works on /api/workflows/{id}/webhook."` That single error message saves everyone the spiral.
- **Cheap:** On the API Keys page, add a one-liner under each tab: "User keys (`wfb_`) work only for personal webhook triggers. Use the **Organisation** tab for the REST API, MCP, or CLI."
- **Cheaper:** When the User tab is selected, show a banner: "Most developers want the Organisation tab" with a link.

### 2. Wallet-not-configured returns 401, not 422

`api/direct-execution` docs say a missing wallet returns `422` with `SPENDING_CAP_EXCEEDED`. In practice, with no wallet provisioned, every direct-execute call returns `{"error":"Unauthorized"}` 401. So you debug "is my auth wrong?" when actually your auth is fine but your org has no signing wallet.

**Suggestion:** distinguish the two cases. If the key is valid but no wallet is configured for the requested network, return a structured 422 like:
```json
{ "error": { "code": "WALLET_NOT_PROVISIONED", "message": "No wallet provisioned for network 'sepolia'. Configure one at app.keeperhub.com → Wallet Management." } }
```

### 3. Sepolia USDC is a proxy and the auto-fetched ABI breaks reads

`POST /api/execute/contract-call` with `contractAddress: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` (Circle USDC on Sepolia) and no `abi` parameter caused weird failures because the auto-fetched ABI is the proxy's (only `admin`, `upgradeTo`, `implementation`, `changeAdmin`, etc. — no `balanceOf` / `transfer` / `approve`).

This bites every USDC-on-Sepolia integration.

**Suggestions:**
- Detect EIP-1967 proxies (storage slot `0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc`) and merge implementation ABI automatically.
- Or: ship a small known-token registry that overrides Etherscan's auto-fetch for canonical contracts.
- At minimum: document this loudly. Right now you get a generic execution failure with no hint that proxy ABI is the issue.

---

## Bugs / surprises

### 4. `GET /api/chains` returns a raw array, not `{data: [...]}`

`api/chains` doc shows:
```json
{ "data": [{ "id": "chain_1", ... }] }
```

Actual response is the array directly:
```json
[{ "id": "chain_1", ... }]
```

Either is fine; please make doc and impl agree. My client had to handle both.

### 5. `GET /api/chains/{id}/abi` — `{id}` ambiguity

The chains list returns objects with both `id` (e.g. `y2kycikh0jhz1wjchzz12`) and `chainId` (e.g. `11155111`). The path `/api/chains/{chainId}/abi` is documented but the URL parameter is named `{chainId}`. I tried the internal `id` first and got `"Invalid chain ID"` 400.

**Suggestion:** make the route accept either form, or rename in docs to make it unambiguous which field goes in the URL. (The chains-list response should ideally make it explicit too — maybe rename `id` → `internalId` in API responses.)

### 6. `network` parameter accepts a fixed alias set, but the docs only show one example

The execute endpoints accept `network` as a string, with this surprisingly large valid set (I discovered it via the error message, not the docs):

```
mainnet, eth-mainnet, ethereum-mainnet, ethereum,
sepolia, eth-sepolia, sepolia-testnet,
base, base-mainnet, base-sepolia, base-testnet,
tempo-testnet, tempo, tempo-mainnet,
solana, solana-mainnet, solana-devnet, solana-testnet,
or numeric chain IDs.
```

The docs page for direct execution shows `"network": "ethereum"` and leaves the rest implicit. Guessing whether `ethereum-sepolia`, `sepolia`, or `11155111` is the right spelling for Ethereum Sepolia is fixable with a single table.

**Suggestion:** drop that exact list into the docs page. Better still, include it in the `Chains` resource (each chain object could include `acceptedAliases: ["sepolia", "eth-sepolia", ...]`).

---

## Documentation gaps

### 7. `docs.keeperhub.com` is hostile to programmatic access

`docs.keeperhub.com` is behind Cloudflare and returns 403 to most non-browser user-agents — `curl`, `wget`, programmatic doc fetchers, etc. I had to fall back to `curl -A "Mozilla/5.0 …"` plus `textutil` to actually read the pages.

This is ironic for "the execution layer for AI agents." Devs working on agent codebases routinely script doc fetches; the docs themselves can't be read without spoofing a browser UA.

**Suggestions:**
- Whitelist common dev-tooling and crawler UAs at the Cloudflare layer — they're not abusive.
- Or: ship `https://docs.keeperhub.com/llms.txt` and `llms-full.txt` (both 403 currently).
- Or: serve markdown alongside HTML at e.g. `https://docs.keeperhub.com/api/direct-execution.md`.

### 8. No quickstart for "I just want to do a one-off contract call"

The docs lead with workflows (visual builder, nodes, edges, plugins). Direct execution is the right tool for my use case (I *gate* execution, I don't schedule it), and it took some reading to realise that. A "Direct Execution Quickstart" — three curl commands, one transfer, one read, one write — would be a much faster on-ramp than "let me build a workflow first."

---

## Feature requests

### 9. Official typed SDK + OpenAPI spec

Right now everyone building against KH writes their own typed client over `fetch`. The MCP page mentions an OpenAPI at `/openapi.json` (in the agentcash flow), but it's not signposted on the API overview page. Two asks:

- Link `/openapi.json` from the API overview.
- Ship an official `@keeperhub/sdk` (Node, TS) — even just a thin wrapper over the OpenAPI spec via openapi-typescript-codegen would be enough.

### 10. Webhook on execution status

I poll `GET /api/execute/{id}/status` to detect completion. For agent applications that want to react to mined transactions (Antibody's Guardian needs to know "did the freeze land?"), a per-execution webhook callback would be much cleaner than polling.

```json
{
  "callbackUrl": "https://my-agent.dev/kh-webhook",
  "callbackSecret": "..."
}
```

passed in the execute request body. Server invokes the callback once on `completed | failed`.

### 11. Atomic multi-action execute (batched contract calls)

DEX flows are inherently multi-step (`approve` → `swap`). Today I have to do two separate `POST /api/execute/contract-call` requests with two separate signature/wallet round-trips. An endpoint like:

```
POST /api/execute/batch
[
  { "contractAddress": "...", "functionName": "approve", "functionArgs": "[...]" },
  { "contractAddress": "...", "functionName": "swap",    "functionArgs": "[...]" }
]
```

executed in order, fail-fast on revert, would let agents do real DEX flows without managing their own multi-step orchestration.

---

## What worked really well

- **Once you find the right tab and provision a wallet, direct execution Just Works.** The synchronous-ish return-value of `executionId + status` is exactly the right shape for agent code.
- **`/api/execute/check-and-execute`** is a great primitive — read-then-conditional-write atomicity is exactly what reactive agents need. I didn't end up using it (Antibody evaluates conditions off-chain), but recognising it as a first-class endpoint signals you're thinking about agent ergonomics rather than just "wrap a script."
- The MCP server existing at all, and being remotely hosted (no local stdio dance) is a huge win. Pluggable into any MCP-compatible client.
- The error messages, when they fire, are *informative* — the `Unsupported network: …` error literally lists the valid set. That's how I discovered #6 above. More of that.

---

## Reproduction & contact

- Repo: [antibody](./README.md)
- Most-used endpoints: `GET /api/chains`, `POST /api/execute/contract-call`
- Confirmed working tx (the freeze): https://sepolia.etherscan.io/tx/0x536a0ba9e87490cc44f7a2ea70fd816b478c6eeefad9804cfab81bf3d1451e10

Happy to demo Antibody for the team if useful — the Guardian agent has interesting things to say about how a paying customer would want to instrument KeeperHub-driven autonomous agents in production.

Thanks for shipping this. ✊
