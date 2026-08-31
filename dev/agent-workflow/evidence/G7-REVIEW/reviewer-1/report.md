# G7-REVIEW — blind gate review, reviewer 1 (G7-1)

- **Role**: independent blind gate reviewer (N=1) for gate **G7-REVIEW**, phase P7 `int/P7-advanced-semantics`
- **Target**: `298d6364d2ebcb03eff0073c352e2174b0fd433f` (integration SHA), base `673260198e2f90474678087fa7518bdd241403b8`
- **Reviewer worktree**: `.worktrees/G7-1` (detached at target SHA; HEAD verified after creation)
- **Routing**: mandated provider/model `qiyuan-self / qwen3.8-27b`; workflow leaf (no subagents, no workflows, no ralph)
- **Blinding honored**: nothing under `dev/agent-workflow/` read (worker evidence, g7-report.md, design-note.md, graph.yaml, SESSION_ROUTER_LOG.md all untouched); only writes in this file are under `evidence/G7-REVIEW/reviewer-1/`
- **Evidence index** (this directory): `chain-rerun.log` (test chain + tsc, with proof headers), `boundary-checks.log` + `boundary-checks.ps1` (zero-core / private-import / owned-boundary), `owned-boundary-diff.txt` (94-file diff → owned-glob mapping), `e2e-run.log` (harness stdout), `harness-output/` (summary.json, per-scenario JSON, logs, dump-config.txt)

## S1 — protocol docs

- `docs/ROUTER_RULES.md` (156 lines) read in full: 3 independent reviewers, four verdicts (通过 / 投机通过 / 补充内容 / 阻塞), precedence 阻塞 > 补充 > 投机通过, blocker types + fixed format, git discipline (1 task = 1 branch = 1 worktree = 1 writer).
- `docs/TEST_METHODS.md` (68 lines) read in full: test DSH source = `references/deepseek-harness-test-use` (pristine), DSH_HOME workspace-internal, test port 3180, boot chain, sandbox EPERM constraints, never touch :3080 / `D:\deepseek-harness\`.

## S2 — worktree + HEAD

- `git worktree add --detach .worktrees/G7-1 298d6364d2ebcb03eff0073c352e2174b0fd433f`; `git -C .worktrees/G7-1 rev-parse HEAD` == target. Clean status at creation; only subsequent additions in the worktree: gitignored `node_modules`, `.p7-install.log`, and this evidence directory.
- No push performed; main worktree, `master`, `int` branch, other worktrees untouched by this reviewer.

## S3 — frozen docs hash verification

All four 20260829 frozen docs (gitignored, present only as untracked files in the main worktree; read there read-only):

| Doc | SHA-256 | Expected | Match |
| --- | --- | --- | --- |
| Architecture | `030dfb8ec55bae30f35c2826c7e4e659c0e0b742d836018ce502f34017870c53` | same | ✅ |
| UI | `3ef3ab69ed2bd7879e4c15079a16c8dae456b572690246a5c1f9cbb0c8c4981e` | same | ✅ |
| Development Plan | `a05d237f8515fd6467373632849afe0c6a1ae63bc0ec298de63b9d124d881d0f` | same | ✅ |
| Task Decomposition | `2b457cc033ca1b72aa781e072e0ef7fe55bc05d2f7ea25cc03c827d257e888a3` | same | ✅ |

Gate entries read: DevPlan §20.7 (nine G7 criteria, line 2707) and TaskDoc §11.8 (T1–T7 cards, dependency graph `{T1||T3||T4||T5||T6}→T2→T7→G7`, six-step G7 method).

## S4 — test chain rerun (my own, from clean worktree)

Setup: `pnpm install --ignore-scripts` (exit 0).

- `node scripts/run-tests.mjs` → **1588 passed, 0 failed, 1588 total, 7247 ms**, exit 0.
- tsc noEmit × 5: contracts=0, domain=0, storage=0, runtime=0, testkit=0 (all exit 0).

Full output with proof headers (commands, timestamps, exit codes): `chain-rerun.log`.

## S5 — real-instance E2E (lock-serialized)

**PASS.** Run: `node packages/legacy/session-reader/e2e/run.mjs --report-dir dev/agent-workflow/evidence/G7-REVIEW/reviewer-1/harness-output --port 3180` (exit 0). Lock `references/.dsh-test-p7t7.lock` was ABSENT (no contention) at 2026-08-31T10:29:58+08:00, acquired as `G7-1`, released after the run (content verified to start with `G7-1` before deletion).

- Real DSH instance from pristine `references/deepseek-harness-test-use` @ `cd5ef8148158c3a752a658978873241fdf8e2bbc` on port 3180; harness row `p7t7-legacy-session-reader` mounted via the public `cordis.patch.yml` seam; mini-MCP on 3491.
- Preflight: test-use pristine (HEAD + empty status + empty diff); stable :3080 reachable (200); fresh DSH_HOME `references/.dsh-test-p7t7` created.
- Scenarios (from `harness-output/summary.json`, `pass: true`, `failures: []`):
  - **L1 PASS** — legacy-team view over planted fixture home (roster overlay, leader from team events, member child sessions, per-session evidence counts, read-only snapshot); 17 assertions, 0 failing.
  - **L2 PASS** — `resume`/`restore`/`mutate` actions all return typed `LEGACY_READER_MUTATION_REJECTED`; fixture tree byte-identical (read-only proof); 11 assertions, 0 failing.
  - **L3 PASS** — no roster, no team events → required degradation to native Chat/Trajectory view; 7 assertions, 0 failing.
- Postflight (harness + my own independent re-verification): ports released (3180 and 3491–3495 all free per `Get-NetTCPConnection`); test-use tree pristine (HEAD `cd5ef814…`, `git status --porcelain` empty — verified by me, not just by harness); stable :3080 still 200.
- Full harness stdout: `e2e-run.log`; artifacts: `harness-output/` (summary.json, L1/L2/L3 per-scenario JSON, logs/, dump-config.txt, run.log).

## S6 — boundary checks (own scans, from my worktree)

Details + command logs: `boundary-checks.log`, `boundary-checks.ps1`, `owned-boundary-diff.txt`.

1. **zero-core: PASS**
   - 392 `.ts` files under `packages/` scanned for `node:` builtin imports: only hit is `packages/runtime/test/p7t5-no-creation-scan.test.ts:42`, verified as a POSITIVE_SAMPLE string literal for the scanner matcher (the file imports only `vitest` + the sibling scanner); extra bare side-effect-import scan (`^\s*import\s+['"]node:`) → none.
   - No patch-package / pnpm patch / postinstall upstream mutation: lockfile unchanged vs base SHA, no `patchedDependencies` in any package.json, root package.json clean. The single `postinstall: patch-package` hit (`scripts/fixtures/zero-core/plugins/bad-plugin-a/package.json`) is verified pre-existing at base SHA via `git cat-file -e` — a NEGATIVE fixture consumed by `scripts/verify-zero-core.mjs`, not a program postinstall.
2. **private-import: PASS**
   - 121 name hits across 413 files, all doc comments / denylist literals / test-only `.mjs` harness references to upstream PUBLIC package names. Dedicated scan for real `@deepseek-ai` (or other upstream-internal) imports inside `.ts` → none.
3. **owned-boundary: PASS**
   - `git diff --name-status <base>..HEAD -- packages/` = 94 entries (A=93, M=1). Every file maps to a P7 owned glob: T1 `runtime/compatibility/**`, T2 `runtime/mutation*` + policy adapters, T3 `runtime/lifecycle*`, T4 `runtime/fork*` + persistence reconciliation, T5 `runtime/handoff*`, T6 `legacy/teammates-adapter*`, T7 `legacy/session-reader*` (incl. TEST-ONLY `e2e/`), plus the single DEC-1 exception `packages/testkit/test/p4t6-session-event-scan.test.ts`. Full mapping table: `owned-boundary-diff.txt`.

## S7 — cross-task invariant combination review (nine criteria + four invariants)

Method: source-level reading of every P7 module plus the P6 admission pipeline it plugs into, grep-verified absence proofs, and the integrated T7 suites that exercise criteria in combination over real P7 objects. All suites below were among the 1588/1588 passes in my S4 rerun.

### Per-criterion verdicts (DevPlan §20.7)

| # | Criterion | Evidence | Verdict |
| --- | --- | --- | --- |
| 1 | warning/fatal admission semantics | `runtime/compatibility/probe.ts`: `probe()` = fresh facts + evaluate w/ durable acks + gen+1 replace; `gateNewWork` blocks BLOCKED_WARNING (unacked) and BLOCKED_FATAL; `admitNewWork` records admittedGeneration/fingerprint/status in the in-flight ledger; `settleWork` NEVER reads current state (drift doesn't cancel in-flight work). Suites: p7t1-{probe-generation, cold-resume, inflight-drift}, p7t7-integrated-drift-ack. | PASS |
| 2 | ack fingerprint invalidation | `acknowledge()` binds the current mismatch+environment fingerprint pair with a single facts read; `FATAL_NOT_ACKNOWLEDGABLE` for fatal classes; `ensureFreshGeneration` re-fingerprints the environment so any post-ack environment change re-blocks via stale generation. Suite: p7t1-ack-fingerprint. | PASS |
| 3 | human override precedence | `p7t7-integrated-override-admission`: layer order blueprint < policyState < template < templateOverlay < instanceOverlay < humanOverride exercised over the REAL T2 MutationService (record kinds TEMPLATE_OVERLAY/INSTANCE_OVERLAY/HUMAN_OVERRIDE, `effectiveFromStep = requestedAtStep + 1`), and the resolved precedence is visible at the P6 admission boundary. Suites: p7t2-override-precedence + p7t2-{creation-fields, escalation, future-boundary, policy-state, provenance}. | PASS |
| 4 | lifecycle quiescence | `lifecycle/quiesce.ts`: five steps closeNewWork → interrupt → drainDescendants → waitQuiescence → releaseResidency, fail-closed, zero durable writes on fault, quiescence strictly precedes residency release (forbidden order impossible); `archive.ts` RUNNING = quiesce → SETTLE commit → ARCHIVE commit, SETTLED = 1 write, invalid states rejected before any live effect. Suites: p7t3-{descendant-drain, dispose-race, archive-running}. | PASS |
| 5 | Restore does not create/resume Agent | `lifecycle/restore.ts`: ONLY `ARCHIVED→SETTLED`, single `COMMIT_RESTORE` step, zero live-runtime contact by construction (no code path to live ports). Suites: p7t3-restore-no-agent, p7t7-integrated-lifecycle-restore. | PASS |
| 6 | Root fork exact semantics | `fork-reconciliation/reconciler.ts`: root fork is the ONLY write branch; crash-safe order (gen-1 TeamSession record carrying the SAME immutable Blueprint snapshot + parent defaultWorkspace FIRST, then team-root binding — 2 writes); idempotent re-run; crash-window roll-forward (1 write); non-empty MemberInstances = contradiction rejection. Suites: p7t4-{root-fork, crash-sidecar, repeat-reconcile}. | PASS |
| 7 | Member fork ordinary semantics | member fork stays an ordinary AgentSession, 0 writes, no team-root binding inferred (invariant 62). Suites: p7t4-{member-fork, ordinary-fork}. | PASS |
| 8 | Handoff one-shot / no live link | `handoff/service.ts`: source surface read EXACTLY ONCE → one-shot summary (§34.4) → TeamIntent → DELEGATED team creation (module owns no creation path — proven by `p7t5-no-creation-scan` rules R1–R7 over the module source); §34.3 replay/retry reuses the frozen snapshot (detached deep-frozen copy, no reread accessor); `querySourceHistoryFromTarget` ALWAYS rejects `HANDOFF_SOURCE_HISTORY_ACCESS_DENIED`; decision one-shot. Suites: p7t5-{snapshot-once, source-mutate, target-inspect, failure-before-root-create}. | PASS |
| 9 | legacy old Team cannot mutate/resume | `session-reader/types.ts` `LegacyHomePort` surface = exactly `listDir` + `readFile` (type-level read-only guarantee); only operational entry `inspectLegacyTeam`; `dispatchReaderAction` accepts only `inspect`, else `LEGACY_READER_MUTATION_REJECTED`. Suites: p7t6-teammates-adapter (one-time parse, all-or-nothing, fail-loud), p7t7-legacy-read (best-effort view + required degradation), p7t7-mutation-reject (port keys exactly listDir+readFile; rejected attempt is a NO-OP, fixture home byte-identical). E2E confirmation on the real instance: L1 (valid legacy view) + L2 (mutation rejection, byte-identical home) + L3 (required native degradation) all PASS. | PASS |

### Four cross-task invariants (combination review)

1. **Admission consumes mutation outputs.** P6 admission pipeline: step 3 computes the effective mutation envelope from T2 MutationService output (`admission/envelope.ts`, fail-closed); step 4 compatibility gate (`admission/gate.ts`, invariant 50) bridges `evaluateActivationCompatibility` and blocks `COMPATIBILITY_BLOCKED` on unacked BLOCKED_WARNING / any BLOCKED_FATAL; activation step 6 (`activation/checks.ts`) resolves via the frozen `resolveEffectivePolicy` + ack passthrough. The override-precedence chain from T2 is thus authoritative at the admission boundary — confirmed by `p7t7-integrated-override-admission` (T2 real service + admission pipeline in one process).
2. **Lifecycle quiescence closes new work first.** `quiesce.ts` step 1 is `ports.admission.closeNewWork(target)`, then interrupt → drain → quiescence → release; independently, the compatibility gate (invariant 50) blocks new work on unacked drift warnings, so the two paths converge: an unquiesced team cannot admit work either way.
3. **Fork-reconciliation and handoff contain no admission/policy/live-runtime calls.** Grep over `runtime/fork-reconciliation/` and `runtime/handoff/`: no `activate`/`resume`/`createMember`/`spawn`/`performAction`/`requestAdmission`/`admission`/`policy` tokens in executable code. The fork sidecar is inert (empty members, no runtime activity); handoff delegates creation to the injected public entry point.
4. **Session reader read-only by construction.** The port TYPE surface has no write method (only `listDir`/`readFile`), dispatch rejects every non-`inspect` action, and `p7t7-mutation-reject` proves the no-op + byte-identical-home behavior; E2E L2 proves it against the real instance (S5).

## Concerns

1. Verdict-block first line: routing hard rule 4 names the exact starting line `G7R1_VERDICT`, while brief §7's template header reads `G71_VERDICT`. Resolved in favor of the direct hard rule (`G7R1_VERDICT`); recorded here as the one intentional deviation from the template literal.
2. No other concerns: all nine criteria pass on my own disk evidence; the only environment-sensitive step (E2E) ran green on the first attempt with no lock contention.

## Verdict

**通过.** All nine G7 criteria PASS (S7), full test chain green (1588/1588, tsc 5×0, S4), all three boundary checks PASS (S6), real-instance E2E PASS with L1/L2/L3 all green and clean postflight (S5). Final block emitted as the reviewer's final message, first line `G7R1_VERDICT`, nothing after it.
