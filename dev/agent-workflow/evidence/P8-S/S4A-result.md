# S4A-result — P8-S4A (Unified Compatibility Admission)

**Base** `b33642e2…07dc` · **Final code SHA** `ac0449bc2408751df18f0ec49cdb76dd0c8bf3f9` · **Branch** `task/P8-S4A-compat-admission` · **Attempt** 1/3 · **Blockers:** none

## Implementation
New single authority `packages/runtime/compatibility/authority.ts` (`createCompatibilityAuthority`) drives the exact chain for all four entry points: read facts → live fingerprint → ensure freshness (reprobe on missing/moved row) → durable compatibility → valid ACK → one decision (admit|block|reprobe).
- `admission/gate.ts`: `enforceCompatibilityGate` builds ONE authority; **stale-OPEN trust removed**; maps admit/block/reprobe → `TeamRuntimeError(COMPATIBILITY_BLOCKED)`.
- `activation/provider.ts`: step 6 consumes the single result only (reprobe→fail-closed `COMPATIBILITY_BLOCKED_FATAL`; block→FATAL/WARNING; admit→`compatibilityStatus`). Legacy `evaluateActivationCompatibility` preflight **no longer consulted by any entry point**.
- `action-router/router.ts`: **ONE-LINE ADAPTATION (flagged)** — step-5 gate now `await`ed (async authority) + `options.now` threaded.
- `compatibility/index.ts`: exports authority + prober + triggers.

## DEC-1 (R29) testkit count (flagged)
`p4t6-session-event-scan.test.ts`: count 490→494 + enumeration comment. Frozen scanner `.mjs` byte-unchanged — established count-maintenance exception, not a forbidden-region edit.

## Tests (per-C)
`node scripts/run-tests.mjs` → **1843/1843 PASS** (1821 + 22 new). runtime 761/761. tsc runtime+testkit exit 0.
- C1 stale OPEN→reprobe+block: `p8s4a-chain.test.ts :: C1`
- C2 stale ACK→STALE: `p8s4a-chain.test.ts :: C2`
- C3 valid ACK→all four PASS, one row (fp+gen unchanged): `p8s4a-entrypoints.test.ts :: C3`
- C4 in-flight settles after drift (row stays stale): `p8s4a-entrypoints.test.ts :: C4`
- C5 next work gated (reprobed, BLOCKED_FATAL, gen2): `p8s4a-entrypoints.test.ts :: C5`
- C6 FATAL never ACK-able: `p8s4a-chain.test.ts :: C6`

## Updated existing tests (justification)
Re-probe over an EXISTING row = 3 seam writes (compat delete+put + stamp) vs 2 first probe; each probe +1 team-session generation. Arm shifts:
- `p6t1-recovery` R1–R4 +2, preCrash 1→3
- `p6t1-explicit` S1 seq; S5f/g/h/k 0→2
- `p6t2-addressing` A1/E1 0→2
- `p6t2-actions` D2 details; D3 stale→admitted, firstTables=[compat,compat,team_sessions]; E1 0→2
- `g8s1-generation-stamp` stamps [1,3,4,5], gen 5, replay 5

## No-core
`git diff BASE..HEAD -- packages/contracts packages/remote` = **empty**; `references/` = **empty**. No live E2E ran (pristine DSH checkout untouched). Edits confined to owned `packages/runtime/**` + DEC-1 count. CORE PATCH BUDGET = 0.

## KNOWN-gap (task text vs disk)
`activation/gate.ts:69-93`→`admission/gate.ts` (fn :87-130, stale-OPEN at :89); `provider.ts:623` confirmed; `probe.ts:417`≈`gateNewWork`@401.

## Limitation
Concurrent same-team admissions can double-probe in a race; verdicts idempotent (same facts→same decision), so harmless (redundant write only).
