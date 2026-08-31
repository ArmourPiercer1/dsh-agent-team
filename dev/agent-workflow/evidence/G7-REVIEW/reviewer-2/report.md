# G7-REVIEW R49 — Blind Review Report N=2 (reviewer-2)

- **Gate / round**: G7-REVIEW, R49
- **Reviewer**: N=2, blind (no read access to `dev/agent-workflow/` except writing my own evidence dir in my own worktree)
- **Subject**: P7 `int/P7-advanced-semantics` @ HEAD `298d6364d2ebcb03eff0073c352e2174b0fd433f` (11 commits, all P7-T1..T7 + evidence)
- **Boundary base**: `673260198e2f90474678087fa7518bdd241403b8` (verified commit, ancestor of HEAD)
- **Worktree**: `.worktrees/G7-2` (detached @ HEAD; all my writes confined to it + the shared lockfile protocol)
- **Date**: 2026-08-31 +08:00

## Section results (S0–S7)

| Section | Result |
| --- | --- |
| S0 environment / worktree / docs | OK — worktree detached @ subject HEAD; 4 frozen docs hash-verified (Architecture `030dfb8e…`, UI `3ef3ab69…`, DevPlan `a05d237f…`, TaskDoc `2b457cc0…`) |
| S1 gate subject identification | OK — 11 commits in BASE..HEAD, all P7 task/evidence commits; subject = P7-advanced-semantics |
| S2 module source review (T1–T7) | COMPLETE — every owned source file read in full, per-criterion findings below |
| S3 test review (spot + matrix) | COMPLETE — 6 key test files' assertion matrices + highest-value bodies verified (positive+negative present for every criterion) |
| S4 chain / zero-core / private-import / owned-boundary | PASS — `chain-rerun.log`, `boundary-checks.log` (regenerated, supersedes the draft whose [3] scan window had a pathspec fault — incident documented in that log) |
| S5 e2e (P7-T7 real instance) | **PASS** — this session's own run, details below |
| S6 cross-task invariants | Verified in source — see table below |
| S7 report + verdict | This file; verdict 通过 |

## Chain (independent rerun in my worktree)

- `pnpm install --ignore-scripts`: exit 0 ("Lockfile is up to date")
- vitest full chain: **1588 passed / 0 failed / 6589 ms** (RESULT: PASS) — `chain-rerun.log`
- All P7 suites green (T1×4, T2×6, T3×4, T4×5, T5×5, T6×1, T7×6) + p4t6 scan — `p7-suites.txt`
- tsc no-op guard ×5 (real inputs): contracts exit 0 (177 .ts), domain exit 0 (254), storage exit 0 (228), runtime exit 0 (457), testkit exit 0 (301)

## Boundary checks (`boundary-checks.log`, regenerated)

| Check | Result |
| --- | --- |
| owned-boundary (BASE..HEAD, packages/) | **PASS — 94/94 classified**: T1 11, T2 13, T3 13, T4 11, T5 12, T6 16, T7 17, DEC-1 exception 1; all `A` (added) except the single DEC-1 `M` (p4t6 scan count maintenance). Every file inside a TaskDoc §11.8 owned glob. |
| zero-core: `node:` imports in `packages/**/*.ts` | **PASS** — 0 hits. (.mjs/.cjs excluded by the brief; e2e harness uses no `node:` specifiers either — informational note [2b].) |
| zero-core: patch-package / pnpm patch / postinstall | **PASS** — only 2 hits, both deliberately-bad fixtures under `scripts/fixtures/zero-core/` (not workspace members; consumed by the scanner's own tests); no `pnpm.patchedDependencies`; lockfile unchanged in BASE..HEAD. |
| lockfile / package.json drift | **PASS** — `git diff BASE..HEAD -- pnpm-lock.yaml` and all package.json files: no changes. |
| private-import (upstream/frozen-fork references in packages) | **PASS** — 46 hits, all in comments/JSDoc/scanner lists; no import statement references upstream internals or the frozen fork. |
| external bare imports | **PASS** — exactly two specifiers repo-wide: `vitest` (tests only) and `yaml` (pre-existing P3/P4-era dep, present in BASE lockfile, not a P7 addition). |
| deep relative imports (3+ `../`) | **PASS** — all targets resolve inside `packages/` (intra-repo cross-package); 0 host/upstream-directed. |

## S5 — e2e (my own run, P7-T7 real instance)

- Lock protocol: acquired `references/.dsh-test-p7t7.lock` (absent → acquired, wrote `G7-2 2026-08-31T10:42:47+08:00`), released after run (content verified mine before deletion).
- Command (from my worktree root): `node packages/legacy/session-reader/e2e/run.mjs --report-dir dev/agent-workflow/evidence/G7-REVIEW/reviewer-2/harness-output --port 3181` → exit 0.
- Preflight: test-use tree pristine (HEAD `cd5ef8148158c3a752a658978873241fdf8e2bbc`); stable `:3080` GET-probe 200; fresh DSH_HOME `references/.dsh-test-p7t7`; row `p7t7-legacy-session-reader` mounted via the public patch seam (`dump-config` rowMounted=true); instance booted on 3181 (boot marker captured); mini-MCP on 3491.
- Scenarios (summary.json + per-scenario JSON in my evidence dir):
  - **L1 PASS** — 17 assertions: MCP handshake 200, tool OK, view `legacy-team`, leader from team events, exactly 2 planted members, workspace overlay wins per id, per-session evidence counts, **home fixture snapshot identical after inspect (read-only)**.
  - **L2 PASS** — 11 assertions: `resume`/`restore`/`mutate` each → typed `LEGACY_READER_MUTATION_REJECTED` with action echoed in details; view type unchanged; **home fixture snapshot byte-identical after all rejected actions**.
  - **L3 PASS** — 7 assertions: no roster / no team events → native Chat/Trajectory fallback (required behavior).
- Postflight: ports released (boot+mcp); test-use tree pristine; stable `:3080` still 200.
- **My independent post-run verification**: `git -C references/deepseek-harness-test-use rev-parse HEAD` = `cd5ef8148158c3a752a658978873241fdf8e2bbc`; `git status --porcelain` = empty.
- Note: build chain was skipped (farm lib artifacts already present) — total wall time ~5 s; the instance genuinely booted (marker line, dump-config, live MCP handshake, 35 real tool-call assertions).

## The nine G7 criteria — evidence

| # | Criterion | Verdict | Evidence (module → key semantics → tests → e2e) |
| --- | --- | --- | --- |
| 1 | warning/fatal admission semantics | **PASS** | `runtime/compatibility/probe.ts`: `gateNewWork` → `NEW_WORK_BLOCKED` (with `blockingRequirementIds`) for BLOCKED_WARNING/BLOCKED_FATAL; optional requirement → ack-able WARNING, required → FATAL; `ensureFreshGeneration` fail-closed (stale → re-probe; facts absent → `NEW_WORK_BLOCKED`); generation starts at 1; observer faults never fail a probe. → `p7t1-ack-fingerprint` (blocks NEW work while unacked, with the blocking facts), `p7t1-cold-resume`, `p7t1-probe-generation`, `p7t1-inflight-drift`. |
| 2 | ack fingerprint invalidation | **PASS** | `probe.ts acknowledge()`: ONE facts read reused for both classifications; FATAL → `COMPATIBILITY_FATAL_NOT_ACKNOWLEDGABLE`; PASS/no-mismatch → `COMPATIBILITY_ACK_TARGET_NOT_WARNING`; ack binds `target.mismatchFingerprint` + `result.environmentFingerprint` (never a global flag); state replace appends the ack. New environment fingerprint ⇒ old ack classified STALE ⇒ re-block. → `p7t1-ack-fingerprint` L234–247 (re-derives BLOCKED_WARNING on new fingerprint, old ack STALE, blocks again), L353 (PASS-ack rejected), L357/L361 (unknown id rejected, nothing stored), L409 (domain `MALFORMED_DTO` surfaced, never a CompatibilityError). |
| 3 | human override precedence | **PASS** | `runtime/mutation/policy-adapter.ts`: pure assembly of the frozen P3-T4 resolver input (resolution itself never re-implemented); per-capability instance-scoped human override beats team-scoped (frozen selection rule); `humanOverride` is NOT envelope-bounded (invariant 34) but IS external-hard-bounded (invariant 35); `requestMutation` applies `checkExternalHard` for EVERY origin (capability missing / hard deny / outside hard allow-list). → `p7t2-override-precedence`: precedence steps 1–5 (instance>template, human>instance, per-member alpha/beta split, human GRANTs a Team-deny cell), negatives: capabilityMissing denies even a human override, hard deny denies for everyone, allow-list sharing no items removes ALL; `p7t2-escalation` (UNAUTHORIZED_TRANSITION for member policy-state switch), `p7t2-future-boundary`, `p7t2-creation-fields` (contextPolicy always immutable; workspace only pre-first-RUNNING), `p7t2-provenance` (ledger + EffectiveConfiguration contributions/suppressed fully explained). |
| 4 | lifecycle quiescence | **PASS** | `runtime/lifecycle/quiesce.ts`: five live steps in the frozen order close-admission → interrupt → drain-descendants → wait-quiescence → release-residency; any fault → `LIVE_EFFECT_FAILED` (details.step); malformed report or `quiescent≠true` → NOT_QUIESCENT before release-residency; **no durable write can precede completed quiescence** (§30.1, structural). `archive.ts`: RUNNING ⇒ settle-then-archive (frozen FSM has no RUNNING→ARCHIVED edge), SETTLED ⇒ direct; crash-window retry re-plans from durable SETTLED. `index.ts`: all ops wrapped in `withTeamLock` per rootSessionId. → `p7t3-archive-running`, `p7t3-descendant-drain`, `p7t3-dispose-race` (concurrent double-dispose commits exactly once; loser re-reads durable state → ILLEGAL_STATE). |
| 5 | Restore does not create/resume Agent | **PASS** | `lifecycle/restore.ts`: prologue → RESTORE dry-run (legal from ARCHIVED only) → single commit; `RestoreMemberResult.steps` is **always exactly `[commit-restore]`**; zero live-port code paths (the restore path never consults admission/activity/descendants/residency); restored member SETTLED — new work reaches RUNNING only via normal admission. → `p7t3-restore-no-agent` R2 (G7 negative): every live call counter = 0 (admission/activity/descendants/residency resume+create, interrupt, drain, drop), pre-existing residency left intact, exactly 1 commit; R3 illegal-source matrix (CREATED/RUNNING/SETTLED/DISPOSED → ILLEGAL_STATE, zero effects); R5 double restore; R6 commit fault stays ARCHIVED, retry OK. |
| 6 | Root fork exact semantics | **PASS** | `runtime/fork-reconciliation/reconciler.ts`: read-only recognition by parent binding kind; team-root parent requires its TeamSession record; child with `memberCount>0` → FORK_STATE_CONFLICT (§35.1 EMPTY); child team-root binding → record must exist + generation 1 + `sameSnapshot` (blueprintId+revision+contentHash, invariant 10), else already-reconciled/corruption-conflict; binding-less child record → crash-window roll-forward (1 write); clean → fresh sidecar record-FIRST (gen 1, parent snapshot, parent defaultWorkspace when present, injected-clock createdAt) then binding (2 writes, crash-safe order); rejected put propagates unwrapped, no second write after first fails; `session.fork` itself never patched. → `p7t4-root-fork` R1–R12: new TeamSession = child id (invariant 9), same immutable snapshot (invariant 10), defaultWorkspace inheritance, EMPTY MemberInstances (parent members NOT copied), exactly 2 writes in record-before-binding order, 2-write no-defaultWorkspace variant, and all malformed/conflict rejections (bad ids, parent===child, missing records, ordinary/team-root rows on the child, different snapshot, non-gen-1 record); `p7t4-crash-sidecar`, `p7t4-repeat-reconcile`. |
| 7 | Member fork ordinary semantics | **PASS** | `reconciler.ts`: team-member parent → member fork: **no binding ever inferred for the child** (invariant 62), child must be row-less else FORK_STATE_CONFLICT, 0 writes; unbound/ordinary parent → ordinary fork, 0 writes, row-less child enforced (no re-pointing, invariant 24; no adoption of an existing member-child row). → `p7t4-member-fork` (plain member fork 0 writes; creates NOTHING; does not adopt child as MemberInstance; M2/M3/M4 rejections), `p7t4-ordinary-fork` (O1/O2 unbound+ordinary 0 writes; O3/O4 row conflicts; O5 invalid input). |
| 8 | handoff one-shot / no live link | **PASS** | `runtime/handoff/service.ts` (+ types/errors): source surface port called **exactly once** per operation (fresh pipeline only; same-token replay returns stored state `replayed:true` without re-reading; `retry` re-summarizes from the FROZEN snapshot); snapshot = `deepFreeze(JSON.parse(canonicalJsonStringify(raw)))` — detached, frozen, pure lossless-JSON (no functions/handles); `querySourceHistoryFromTarget` **ALWAYS** throws `SOURCE_HISTORY_ACCESS_DENIED` (token grants nothing; the port is never touched on that path); summarizer is an injected `HandoffSummarizerPort` — never the Leader/Member model (§34.4, port injection is the enforceable boundary); summarizer failure → `awaiting-decision` carrying the explicit Retry / Continue-without-handoff / Cancel triad (never silent pretend-success; NO team created); creation failure → `creation-failed` with the frozen context kept, idempotent re-drive on the same stable `intentToken` (§18.2); failures before the creation entry leave ZERO creation effects (record deleted); team-creation outcome checked for invariant 9 (teamSessionId = rootSessionId); module owns no creation path — proven by the committed static scan `p7t5-no-creation-scan.mjs` (runs in every chain). → `p7t5-snapshot-once` S1 (readCount=1, summarizeCount=1, creationCalls=1; context/surface/summary deep-frozen, mutation attempts throw; whole context `isRemoteSafe`; replay returns the SAME context and re-reads nothing; fresh token = fresh operation) + S2 (non lossless-JSON surface → SOURCE_SURFACE_UNAVAILABLE before summary/creation, NO operation trace); `p7t5-source-mutate`, `p7t5-target-inspect`, `p7t5-failure-before-root-create`, `p7t5-no-creation-scan`. |
| 9 | legacy old Team cannot mutate/resume | **PASS** | `legacy/session-reader`: read-only BY CONSTRUCTION — the home port interface exposes only `listDir` + `readFile` (no write method exists); the reader serves one public tool; every mutation verb is typed-rejected. → `p7t7-mutation-reject` (11/11 verbs → `LEGACY_READER_MUTATION_REJECTED`; exact case-sensitive action matching; rejected attempts make ZERO port calls on a fresh port battery; home tree byte-identical before/after; port object exposes exactly listDir+readFile), `p7t7-legacy-read` (28 tests, read-only views), `p7t7-integrated-*` (4 suites wiring reader against the P7 stack), and the real-instance e2e **L1/L2/L3 PASS this session** (L2: resume/restore/mutate all rejected with typed code, fixture tree byte-identical; L1: read-only legacy-team view, snapshot identical after inspect; L3: native fallback). T6 `teammates-adapter` (one-time import) also verified: never reads/writes pre-existing team state; all-or-nothing; leader/dedup/warning semantics as specified; unmapped fields → inert `legacy.*` metadata. |

## Cross-task invariant analysis (S6)

- **admission ↔ mutation**: the compatibility prober consumes the same injected environment facts the mutation service's `checkExternalHard` evaluates for EVERY origin (human/leader/member); a capability denied by external hard facts cannot be admitted as a probe requirement nor granted via mutation; `EffectiveConfiguration` is fully explained (frozen resolver + ledger contributions + deduplicated suppression records), so admitted work and effective policy are mutually traceable.
- **lifecycle ↔ admission**: `close-admission` is the FIRST quiescence step, so no new work can enter while a member is quiescing; while the compatibility gate is BLOCKED_WARNING/BLOCKED_FATAL, `gateNewWork` rejects; restore lands at SETTLED with zero live contact, so re-admission is only via the normal admission pipeline.
- **fork ↔ policy/admission**: fork reconciliation writes only the sidecar rows (record + binding) in crash-safe order; it never touches policy state, overlays, or admission state; member copies are never created (EMPTY root team; member fork creates nothing).
- **handoff ↔ creation**: team creation is fully delegated to the injected public entry (static scan proves no in-module creation path); the handoff context is pure frozen data, so no creation path can reach back into the source session.
- **session-reader ↔ everything**: the legacy reader's port interface has no write method; e2e proves byte-identity of the home tree across every attempt; the T6 import adapter is the only sanctioned legacy→vNext transition and is one-shot by construction.

No cross-task seam was found where one task's assumption is broken by another task's behavior.

## Recorded design decisions (non-blocking)

1. **T2 leader envelope with zero registered members** — the leader envelope is the intersection over all registered members; with zero members the intersection is vacuous and the envelope check is skipped (documented in `mutation/service.ts`). Consequence: a leader of a memberless team is not envelope-bounded, but external hard bounds still apply for every origin. Matches the card's frozen wording; recorded, not a violation.
2. **T6 ported leniency** — unknown `contextPolicy` values are dropped with a warning (legacy behavior preserved); empty persona is HARDENED to an error under vNext (documented in the adapter).
3. **T5 in-memory operation registry** — process-lifetime only; TeamDomain remains the sole durable boundary (Architecture §42 invariant 41). A process restart loses the operation (its team, if created, is durable via the creation entry).
4. **e2e harness** — per-run fresh DSH_HOME (`references/.dsh-test-p7t7`), mini-MCP band 3491–3495 (first free), fixtures planted AFTER boot; serialized across reviewers by the lockfile protocol (followed this session).

## Concerns

- No blocking concerns.
- Minor/observation: e2e wall time is short (~5 s) because the build chain was skipped on pre-existing farm artifacts; the boot is nonetheless real (marker line, dump-config row mount, live MCP handshake, 35 tool-call assertions).
- The worker's own evidence under `dev/agent-workflow/evidence/P7-T7/` was NOT read (blinding); every finding above rests on my own source reads, my own chain rerun, and my own e2e run.

## Blinding note

One incident, fully documented in the regenerated `boundary-checks.log`: an earlier draft's faulty `git grep` pathspec let a few lines of `dev/agent-workflow/SESSION_ROUTER_LOG.md` (G6-era, a DIFFERENT gate) leak into a scan window. That file was NEVER opened and nothing from it is cited anywhere in this review. The regenerated log removes the leak.

## Verdict

All nine G7 criteria verified in source and by tests; chain 1588/1588; tsc ×5 exit 0; zero-core / private-import / owned-boundary (94/94) PASS; e2e L1/L2/L3 PASS with independent pristine verification. → **通过**
