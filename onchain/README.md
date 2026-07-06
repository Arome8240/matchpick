# MatchPick On-Chain

Prize pool escrow + payout contracts for MatchPick, deployed to Celo. This is deliberately the
*minimal* on-chain surface: picks, fixtures, scoring, streaks, and leaderboards all stay off-chain
in the MatchPick backend. The chain's only job is holding sponsor-funded cUSD and paying out the
addresses the backend tells it to, bounded by what was actually funded.

## Why this scope

Putting full pick/scoring logic on-chain would mean an on-chain transaction per pick (8 per
matchday per player, times however many players), on-chain fixture/result oracles, and rules that
are expensive to iterate on. Instead:

1. Users pick and the app scores matchdays exactly as it does today (see `../sim/engine.ts`).
2. A backend service holding `SETTLER_ROLE` computes final winners/amounts off-chain and submits
   one `settleMatchday` transaction per matchday.
3. The contract never re-derives or checks who *should* have won — it trusts the settler's input,
   bounded only by the funds actually deposited for that matchday.

**This means `SETTLER_ROLE` is a trusted, centralized component.** It cannot drain arbitrary
funds (it can only move already-deposited, unsettled matchday/treasury balances, once, to
addresses it names), but a compromised settler key can misdirect a matchday's payouts. Treat that
key like you'd treat a hot wallet with weekly-pool-sized funds moving through it — see
[Operational recommendations](#operational-recommendations).

## Contract

`contracts/MatchPickVault.sol` — UUPS-upgradeable, `AccessControl`-gated, pausable.

| Function | Caller | What it does |
|---|---|---|
| `fundMatchday(id, amount)` | anyone | Deposits cUSD into a matchday's pool (the sponsor). |
| `fundTreasury(amount)` | anyone | Deposits cUSD into the general treasury (referral bonuses etc). |
| `settleMatchday(id, winners[], amounts[])` | `SETTLER_ROLE` | One-shot payout of a matchday's pool. Reverts if it exceeds what was funded, or if already settled. |
| `payReferralBonus(to, amount)` | `SETTLER_ROLE` | Pays a referral bonus out of the treasury balance. |
| `reclaimExpiredMatchday(id, to)` | `DEFAULT_ADMIN_ROLE` | Recovers an unsettled matchday's funds after `RECLAIM_DELAY` (30 days) — covers a permanently broken settler. |
| `emergencyWithdraw(token, to, amount)` | `DEFAULT_ADMIN_ROLE`, only while paused | Escape hatch for stuck/mistaken token transfers. |
| `pause()` / `unpause()` | `DEFAULT_ADMIN_ROLE` | Halts funding/settlement/referral payouts. |

Roles are standard OpenZeppelin `AccessControl`: `DEFAULT_ADMIN_ROLE` can grant/revoke
`SETTLER_ROLE` via `grantRole`/`revokeRole`, and authorizes upgrades.

### Reentrancy guard

`contracts-upgradeable` v5.1+ dropped the persistent-storage `ReentrancyGuardUpgradeable` in
favor of a transient-storage (EIP-1153) variant. Rather than assume Celo's execution client
supports `TSTORE`/`TLOAD`, `MatchPickVault` inlines the classic locked-slot guard (same pattern OZ
shipped for years). It's proven by an actual reentrancy attack in
`test/MatchPickVault.test.ts` (`MaliciousReentrantToken`), not just assumed — see that test for
why the attack path is constructed the way it is (naively reentering `settleMatchday` gets masked
by access control / already-settled checks instead of the guard, so the test reenters the
unrestricted `fundMatchday` instead, isolating the guard as the only thing that could block it).

## Setup

```bash
cd onchain
pnpm install --ignore-workspace   # standalone project; not part of the app's pnpm workspace
cp .env.example .env
# fill in PRIVATE_KEY, ADMIN_ADDRESS, SETTLER_ADDRESS, CELOSCAN_API_KEY
```

`--ignore-workspace` matters here: the repo root has a `pnpm-workspace.yaml` for the Next.js app,
and this project intentionally isn't a member of it (different toolchain, own lockfile).

## Commands

```bash
pnpm compile                    # compile contracts
pnpm test                       # 35 tests: happy paths, every revert branch, upgrade, reentrancy
pnpm coverage                   # istanbul coverage report

pnpm deploy:alfajores           # deploy proxy to Celo testnet
pnpm deploy:celo                # deploy proxy to Celo mainnet
PROXY_ADDRESS=0x... NEW_CONTRACT=MatchPickVaultV2 pnpm upgrade:alfajores
pnpm verify:alfajores <implementation_address>
```

`scripts/deploy.ts` deploys a `MockERC20` automatically when no `CUSD_ADDRESS_*` env var is set
for the target network (i.e. on the local Hardhat network) so you can exercise the full flow
without touching a real token.

### cUSD addresses

```
Alfajores (testnet): 0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1
Celo (mainnet):       0x765DE816845861e75A25fCA122bb6898B8B1282
```

**Verify these against <https://docs.celo.org/token-addresses> before any mainnet deployment** —
don't trust a value baked into a template.

## Operational recommendations

- **`DEFAULT_ADMIN_ROLE` → a multisig** (e.g. Gnosis Safe on Celo), not a single EOA. This role
  can upgrade the contract and reclaim/emergency-withdraw funds — it should never be a single key.
- **`SETTLER_ROLE` → a dedicated backend signing key**, separate from the admin, holding no
  meaningful native-token balance beyond gas. Rotate it via `grantRole`/`revokeRole` from the
  admin multisig if it's ever suspected compromised, and `pause()` immediately if so.
- **Fund matchdays close to when they're needed**, not far in advance in large batches — limits
  exposure if a settler key is compromised mid-season.
- **Monitor `MatchdaySettled` events** off-chain and cross-check the emitted totals against what
  your backend intended to pay out, as a sanity/anomaly check independent of the settler itself.

## Known limitations / audit checklist

This is written to a solid baseline (custom errors, checks-effects-interactions, `AccessControl`,
`Pausable`, a proven reentrancy guard, 100% line/branch-meaningful test coverage, storage gap for
upgrades) but has **not** been professionally audited. Before mainnet funds beyond
trivial/testing amounts flow through it, get a third-party review focused on:

1. The centralization trust model above — is `SETTLER_ROLE` an acceptable risk for your launch
   size, or do you want e.g. a threshold signature / multi-settler quorum before mainnet scale-up?
2. UUPS upgrade governance — right now a single admin multisig can upgrade the implementation
   instantly. Consider a timelock in front of `_authorizeUpgrade` once real funds are at stake.
3. `RECLAIM_DELAY` (30 days) — confirm this window is right for your operational reality before
   relying on it.
4. Whether `MAX_WINNERS_PER_SETTLEMENT` (500) leaves enough gas headroom on Celo for your actual
   worst-case matchday winner count, with margin.
