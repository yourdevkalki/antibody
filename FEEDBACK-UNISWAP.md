# Uniswap Feedback — Antibody

Hi Uniswap team — short, honest feedback from building [Antibody](./README.md), an autonomous safety layer for AI agents that uses Uniswap as the Worker's day-job DEX and the policy-whitelisted counterparty.

My Uniswap touch is intentionally surface-level (the project's depth lives in the safety/execution layer), so this is shorter than my KeeperHub feedback. Still, four real frictions came up — flagging them in case they're useful.

---

## 1. V2 vs V3 function names trip up new devs every time

When I told my LLM-driven Worker "propose a Uniswap swap," it confidently emitted `swapExactTokensForTokens(...)`. The Worker's policy whitelisted the **V3** SwapRouter02 address (the canonical Sepolia router everyone recommends), but V3's interface is `exactInputSingle` / `exactInput`. The call reverted.

This is a textbook trap: `swapExactTokensForTokens` is the function name *everyone has heard of* (V2), and the address you can find in tutorials is *V3* (because V3 is what Uniswap recommends). Combine those and your contract call reverts at runtime with a generic "execution failed" — no hint that the issue is interface-version mismatch.

**Suggestions:**
- A shim contract on the V3 SwapRouter02 that translates `swapExactTokensForTokens(amountIn, amountOutMin, path[2], to, deadline)` into the equivalent `exactInputSingle` call, with a deprecation event. Saves every dev a chunk of debug time.
- Or: make the V3 SwapRouter02 docs page open with a giant "🚫 V3 does NOT have swapExactTokensForTokens. Here's what to call instead." V3 docs *do* explain this, but only after you've already burned time.
- Or: a tiny `@uniswap/router-detect` library that takes a router address and returns its supported function set, so dev tools can reject calls early.

## 2. Sepolia USDC/WETH liquidity is too thin for honest testnet demos

I needed real swap settlement for a clean demo card. The Sepolia V3 USDC/WETH pool has enough liquidity to *exist* but not enough to handle a 5 USDC swap reliably — quotes vary wildly, slippage tolerance from official routing tools rejects, and on bad days the pool reverts entirely.

So I worked around by having the Worker only propose `USDC.approve(router, X)` (the canonical step-1 of any swap) and call that "the DCA action." It produces a real, successful Sepolia tx, but it's not actually swapping.

**Suggestions:**
- A Uniswap-maintained Sepolia "demo pool" with deep USDC/WETH liquidity, refilled on a schedule. Even if it's slightly artificial, it'd let testnet demos *actually demonstrate Uniswap*.
- Or: a documented recommendation for which testnet (Sepolia? Base Sepolia? Unichain Sepolia?) has the most reliable demo liquidity. Right now the choice is implicit.
- Or: a "fake quote, real settle" mode that returns a successful swap from a Uniswap-operated faucet pool, just for dev traffic.

## 3. Sepolia USDC's proxy ABI breaks generic token-on-Uniswap integrations

This isn't strictly a Uniswap issue, but it bites every Uniswap-on-Sepolia integration: Sepolia USDC at `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` is a proxy. Block-explorer ABI fetch returns the proxy's admin/upgradeTo functions, *not* the implementation's ERC-20 functions. So a tool that auto-fetches ABI to call `approve` or `balanceOf` will fail with "function not found."

I worked around by hardcoding the standard ERC-20 ABI in my client. Most teams will hit this and not know why.

**Suggestion:** the Uniswap interface's "select token" UX could include a "this token is a proxy — here's its implementation address" warning. Or the Uniswap V3 / V4 docs' "tokens you'll commonly interact with on testnets" page could call this out specifically for USDC.

## 4. The agent / autonomous-execution story isn't well-served yet

Antibody routes every approved swap through KeeperHub's `/api/execute/contract-call`. That works because Uniswap V3's SwapRouter02 ABI is small and stable. But for a future Antibody-V4 I'd want to support arbitrary V4 hooks, custom pool managers, etc. — and the V4 docs lean toward "developers building DEX UIs" rather than "agents executing autonomous swaps."

**Suggestion:** a doc page (or the V4 SDK README) titled something like *"Calling Uniswap V4 from an agent / scheduled job."* It would cover:
- Which contract addresses are stable across hook deployments.
- How to construct a typed swap intent suitable for being passed through a third-party execution layer (KeeperHub, Defender, etc.).
- Slippage / deadline patterns for unattended execution (no human in the loop to approve a stale quote).
- Agent-friendly error codes — "your quote expired, retry with a fresh one" should be distinguishable from "the pool reverted, abort."

This dovetails with the broader "AI agent on-chain" wave. Uniswap is the single most-cited DEX in agent demos; making it easy to call from an autonomous executor is a small docs investment with a long tail.

---

## What worked really well

- **The V3 router address is genuinely stable and well-known.** Even with the function-name confusion above, *finding* the right contract was easy. Half the testnets I considered for Antibody had no canonical router at all.
- **`approve` semantics are clean and revocable.** Antibody's freeze action — `USDC.approve(router, 0)` — relies on Uniswap accepting a zero allowance to gate further pulls. It does, cleanly. The architectural pitch ("the agent's authority is exactly its approval, and the immune system can revoke it autonomously") wouldn't work without this.
- **The whole `swap → approve → revoke` pattern composes naturally with execution layers like KeeperHub.** I'm using Uniswap as a *primitive* in a larger safety architecture, and Uniswap's design didn't get in the way.

---

## Reproduction & contact

- Repo: [antibody](./README.md)
- Sample tx (the freeze action revoking router approval): [0x536a0ba9…1451e10](https://sepolia.etherscan.io/tx/0x536a0ba9e87490cc44f7a2ea70fd816b478c6eeefad9804cfab81bf3d1451e10)
- Network: Ethereum Sepolia
- Most-used router: Uniswap V3 SwapRouter02

Thanks for shipping software that's possible to build on top of. 🦄
