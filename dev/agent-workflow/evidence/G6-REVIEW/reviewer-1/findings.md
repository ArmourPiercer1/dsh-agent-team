# G6-REVIEW — reviewer 1 findings

Reviewer: 1 (independent blind review; no main-agent or peer-reviewer input used)
Worktree: `D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\G6-R1` (branch `g6-review-r1`)
Delta under review: `11b0584473c78e6d1aed179f3a06b5fb7fa0db2d..54950fb60f60d2318cc2e10af800e37c50f87192`
(179 files: 104 `dev/agent-workflow` evidence, 60 `packages/runtime`, 14 `packages/tools`,
1 `packages/testkit` — DEC-1 standing exception)

## Verification chain (self-executed, this worktree)
1. Canonical chain: `pnpm install --ignore-scripts` (exit 0) → full `node scripts/run-tests.mjs`
   **1214 passed / 0 failed / 1214 total** (exit 0) → `tsc -p` for contracts, domain, storage, runtime, testkit
   **all exit 0** (see `step1-run-tests-full.log`, `step1-run-tests-targeted.log`; targeted rerun 560/560).
2. Zero-core: `references/deepseek-harness-test-use` HEAD `cd5ef8148158c3a752a658978873241fdf8e2bbc` with empty
   `git status --porcelain` (checked before the canonical chain AND after the E2E rerun — pristine on both sides);
   import scan of all 74 delta `.ts/.mts/.mjs/.cjs/.js` files (474 specifiers,
   `zero-core-import-scan.mjs` + `step2-zero-core-import-scan.txt`): every specifier is intra-repo
   (`packages/*`, the established relative-import convention, 143 pre-existing matches repo-wide) or vitest /
   `node:*` / the fixture `'x'` — except exactly 3 public `@deepseek-ai/dsh-*` ROOT imports, each verified against
   the pristine upstream root export surface (`SessionId` ← dsh-session root `export * from './types'`;
   `installModelSelection` ← dsh-agent root `export * from './model-selection'`; `ToolCallId`, `createUserMessage`
   ← dsh-llm root `brand.ts`/`message.ts` re-exports). No `./src/*` subpath or internal-path imports of upstream
   anywhere in the delta. No patch-package / pnpm patch / postinstall / vendored-upstream machinery in the delta
   (doc mentions only). No `package.json` / lockfile / `scripts/` / `docs/` changes in the delta.
3. Owned boundary: every delta package file maps to a P6 owned path (TaskDoc §11.7): `runtime/activation/**`
   (T1); `runtime/admission/**` + `runtime/action-router/**` (T2); `runtime/messaging/**` (T3);
   `runtime/control/**` (T4); `runtime/activity/**` + `runtime/test/p6t*` (T5); `tools/**` (T6, incl.
   `tools/src/index.ts` which is MODIFIED, 40+/13−, the P1-T4 skeleton entrypoint becoming the P6-T6 surface —
   inside `packages/tools/**`). The single testkit change is the DEC-1 standing exception and is compliant:
   `git diff` of `packages/testkit/test/p4t6-session-event-scan.test.ts` shows ONLY count maintenance —
   it-title `258 files scanned` → `330 files scanned`, the enumeration comment extended file-for-file with the
   six P6 task groups (13+15+9+11+12+12 = 72 new files; 258+72 = 330, arithmetically consistent with the actual
   delta), and the two assertions `toBe(258)` → `toBe(330)`. The scanner itself
   (`packages/testkit/fault-injection/session-event-scan.mjs`) is NOT in the diff (byte-identical), and the three
   places (title / comment / assertions) are mutually consistent at 330.
4. E2E rerun WITH lockfile serialization: lock `references/.dsh-test-p6t6.lock` was ABSENT (no concurrent
   reviewer) → acquired (reviewer=1, timestamped) → run → released on all paths. Preflight :3080=200 + all
   harness ports free; post-run ports released, :3080=200, junction farm removed, test-use pristine. Result:
   **pass=true, failures=[], 7/7 scenarios (E1 14 + E2 3 + E3 6 + E4 5 + E5a 11 + E5b 13 + E6 6 + E7 2 = 60 live
   assertions, 0 failing)** — `step4-e2e-postchecks.txt` + `harness-output/summary.json`.
5. Cross-task invariant combination review (a)–(f): all hold — `step5-invariant-review.md`.
6. Seven criteria: 7/7 PASS — `step6-criteria-table.md`.

## Findings

### F1 — LOW (informational, recorded scoping decision) — SD-GUARD no-request deviation
- Location: `packages/tools/src/guard.ts` (SD-GUARD, lines 1-30) + `packages/tools/src/tools.ts`
  `executeGuarded` (251-281); live-verified `harness-output/summary.json` E5b assertion "a fresh token with no
  request row proceeds (no-request deviation)".
- Description: a guarded work operation with NO durable control request for the exact scope PROCEEDS (the
  control plane has no pending gate for it). This is wider than the P6-T4 fake pipeline's blanket block.
- Assessment: explicitly recorded scoping decision (SD-GUARD header: the tool layer hosts the whole team
  surface; the leader's ordinary autonomy path must stay open), pinned by the live E5b assertion and the p6t6-guard
  suite, and backstopped by the runtime facade which still enforces caller identity, role closure, mutation
  envelope, instance addressing and quota on the proceed path. Not a bypass of ActivationProvider/TeamRuntime —
  the proceed path terminates in `performAction`. Residual risk (acceptance note only): "no request = no gate"
  is a deliberate widening of the approval surface vs. the single-operation P6-T4 model; if a future phase wants
  blanket approval for an action class, it must add durable control requests, not loosen the guard.

### F2 — LOW (informational, documented durability ruling) — at-least-once session-input delivery
- Location: `packages/runtime/messaging/coordinator.ts` header (R2/R3, lines 24-75) and `deliverOne` (318-459).
- Description: a crash between the attributed-input write and the confirmation-fact commit can leave the input
  DELIVERED but unconfirmed; restart recovery then re-delivers, so the target Session can receive the relayed
  message TWICE (duplicates are detectable through the correlation `{requestToken, factSequence}` carried in the
  attribution).
- Assessment: explicitly documented ruling (R3: exactly-once on the TeamLedger, at-least-once on session input);
  the TeamDomain fact itself is exactly-once and the live E5b "no pending delivery was skipped at recovery"
  confirms the recovery accounting. This is an accepted durability trade-off of the public Session input API
  (which has no transactional seam — consistent with CORE PATCH BUDGET = 0), not a defect.

No HIGH or MED findings. No protocol violations observed.

## Verdict: 通过 (PASS)
7/7 criteria PASS with self-re-verified evidence (full 1214/1214 test chain, tsc ×5 clean, zero-core PASS,
private-import PASS, owned-boundary PASS incl. compliant DEC-1 count maintenance, E2E 7/7 scenarios with lock
serialization and pristine/freed post-checks, invariants (a)–(f) hold in combination). The two LOW notes are
recorded scoping decisions / documented durability rulings, not defects.
