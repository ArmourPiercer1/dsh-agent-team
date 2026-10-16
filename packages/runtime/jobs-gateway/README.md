# `runtime/jobs-gateway` + `domain/vnext-field-mapping` — Alpha.5 PR7 (Lane F), DORMANT

Web/Jobs/MCP + Domain adaptation surface per `INTERFACES-v1` §C-GW (this
lane owns the contract), §C-BIND (consumed), §C-VNEXT (consumed), §C-PROC
(fixture-developed).

## Status

- **DORMANT**: zero production consumers, no live wiring, no assembly
  registration. Pinned by `packages/runtime/test/a5p7-lane-hygiene.test.ts`.
- **Stack version**: the cancellation shapes consumed here are aligned to
  `origin/alpha5-pr1r-residual-boundaries` @ **bd6310ca** (B3(ii) fix
  `cf299383`: a Definition that moves cancels the *un-executed* call —
  abort-before-exec via the wrapper `exec.signal`, the Host's
  `ABORTED_BEFORE_DISPATCH` / `ABORTED` faces deciding started vs not).
  Verified **against that stack/fixture**, not a whole-chain claim.
- **PR4 dependency**: real stdio execution is PR4's provider; this lane
  develops against the C-PROC fixture (`probe→prepare→execute→terminate`,
  terminate ≠ cancel) — fixture development, not waiting.

## C-GW contract (owner: this lane)

| Aspect | Decision |
| --- | --- |
| Lease lifecycle | `ACTIVE → DRAINING → RELEASED / GIVEN_UP`; the ACTIVE→DRAINING **boundary is the settled edge**: new admissions refused from the first instant; a `'settled'` end crossing the boundary is refused (PR1 Gate R4) and the token stays outstanding; `'refused'` ends in any live state (we created that fact). `release()` needs a completed drain AND a self-counted zero; after `giveUp` it refuses forever. |
| Cancellation classification | Job outcome closed set `not-started / terminated-after-start / executed-despite-cancel / unresolved`, read off the plane's event faces only. `not-started` may be said ONLY from a before-dispatch face; a started Body is TERMINATED with `sideEffectPossible: true` and its own preserved value — **never re-labelled un-executed**; an abort that lost the race is EXECUTED out loud; an unreadable outcome stays UNRESOLVED. The two forms stay **distinguishable end to end** via `evidenceEvent`. |
| JobOwner | Identity **is member scope** (`rootSessionId` + `instanceId`, canonical key mirroring the frozen `contracts/identity` shape; lane-local stub by design). Bound immutably at admission; cross-scope reads refused without leaking the owner; re-admission of a live jobId under another owner is an owner-mismatch alarm. |
| Two-question split | Outcome facts (what happened) are recorded regardless of lease state; completion evidence (whether our work is done) goes through the lease boundary. An outcome recorded across the boundary explicitly does NOT launder the lease settle. |
| Web projection | Owner-scoped only; credential-shaped values are redacted **at collection** (`observeDispatchEvent` sweeps; projection sweeps again defensively). |

## C-BIND consumption (chain fixture-tested)

`tools/change` is an information channel, not a security mechanism. Each
in-flight job re-reads its own `(scope, name)` identity on a change; only
what moved (or cannot be read — unreadable = moved) is cancel-requested;
scope filtering only prevents friendly fire. Result attribution stays pinned
to the definition **validated at execution time** — a re-registration under
the same name never claims the earlier job's result, and a swallowed change
event cannot corrupt attribution. No reader ⇒ everything moves (never
"assume unchanged").

## C-VNEXT consumption

`domain/vnext-field-mapping`: default-deny field-map projector. Unmapped
source field ⇒ typed refusal naming it (no silent drop); missing declared
source ⇒ refusal (no implicit defaults); target collisions rejected at
declaration; output deep-frozen. The v3 production document is untouched.

## Integration-owner checklist (shared files this lane must NOT touch)

1. **tsconfig includes**: add `"jobs-gateway"` to
   `packages/runtime/tsconfig.json` `include` and
   `"vnext-field-mapping/src"` to `packages/domain/tsconfig.json` — until
   then the lane is vitest-covered but outside `tsc`.
2. **p4t6 scanner increment**: this lane adds exactly these 14 scannable
   files (same list asserted in `a5p7-lane-hygiene.test.ts`):
   `runtime/jobs-gateway/{types,lease-window,cancellation-boundary,web-projection,jobs-gateway,index}.ts`,
   `runtime/test/a5p7-{cproc-fixture,job-owner,lane-hygiene,lease-cancellation,mcp-rebind-chain}.ts(+.ts)`,
   `domain/vnext-field-mapping/src/{field-mapping,index}.ts`,
   `domain/test/a5p7-vnext-field-mapping.test.ts`.
   979 → **993** on a base whose scanner still reads 979 (other lanes'
   increments merge first and renumber; this lane's delta is 14).
   Zero denylist vocabulary in all of them (scanner matcher asserted).
3. **audit-a5-tool-governance-imports.mjs**: this lane imports NO
   `tool-governance` module, so no allow-list row is needed unless the
   splice swaps the `JobOwner` stub for the frozen contracts import AND
   routes through the governance lane (it should not).

## Run

```
pnpm vitest run packages/runtime/test/a5p7-*.test.ts packages/domain/test/a5p7-*.test.ts
```
