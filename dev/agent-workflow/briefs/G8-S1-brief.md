# G8-S1 — Gate supplement 1 (for G8-REVIEW) — worker brief

Status: GATE SUPPLEMENT (ROUTER_RULES §4 substantive, G8 budget 1/3) · Class A · base int/P8 @ `93d2a96e3ded6a92820f78ee9de94eac9ea6fffb`

## §0 Mandatory first reads (prompt-injection rule)

Before touching anything, read in this order:
1. `docs/ROUTER_RULES.md` — unattended execution protocol (≤3 executions/task, blocker formats, git discipline, gate rules).
2. `docs/TEST_METHODS.md` — test infra constraints (test DSH = `references/deepseek-harness-test-use` pristine @ `cd5ef8148158c3a752a658978873241fdf8e2bbc`; the stable instance :3080 / `D:\deepseek-harness\` is absolutely untouched).
3. This brief, completely.

You may read the frozen docs, the code, and your own evidence dir. You must NOT read anything else under `dev/agent-workflow/` (other workers' evidence, briefs, log, graph).

## §1 Identity and environment

- Task: G8-S1 (gate supplement for G8-REVIEW). Branch `task/G8-S1-gate-supplement`, worktree `.worktrees/G8-S1`.
- Create: `git worktree add .worktrees/G8-S1 -b task/G8-S1-gate-supplement 93d2a96e3ded6a92820f78ee9de94eac9ea6fffb` (run from the main worktree root `D:\AgentDev\dsh-plugins\dsh-agent-team`).
- Verify: `git rev-parse HEAD` in the new worktree = base SHA; worktree clean; you are the only writer.
- All code/test/file work inside the worktree; `pnpm install --ignore-scripts` once at its root.
- Do NOT push; do NOT touch master/int branches; do NOT touch other worktrees; do NOT touch `D:\deepseek-harness\` or :3080; do NOT touch anything under `references/` (including the test-use tree).

## §2 Purpose

The G8 gate (DevPlan §21.5, six criteria) round-1 did not reach unanimous 通过. An independent blind reviewer found three cross-task composition gaps (none P8-internal; none breaks frozen-contract behavior at the seam). The main agent's compatibility check against the frozen docs (ROUTER_RULES §3.3.4) adjudicated exactly two code scopes for you:

- **S1-A**: implement the production write path that advances `team_sessions.generation` whenever durable TeamDomain state visible to the P8-T2 projection changes.
- **S1-B**: align the P8-T4 effect-sequence vocabulary with the real P6-T2 `RuntimeActionEffect` closed union.

Out of scope (documented decisions, NOT implemented by you): the production host-side `/team-remote` binding row and the sync-dispatcher→async-runtime admission bridge (documented P9/P10 binding obligation).

## §3 Frozen authority facts (pointers — read the sources yourself)

- Architecture B: TeamSessionRecord persists `version/generation`. (`docs/plans/active/DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md`, object model section)
- DevPlan §21.4: push model = whole Team projection generation (v1 correctness first); the client MUST reject "stale generation overwrites newer state". (`DSH_Agent_Team_vNext_Detailed_Development_Plan_20260829.md` §21.4)
- TaskDoc §11.9: P8-T1 card — DTO includes generation; 必须测试 "generation monotonic". P8-T4 card — "stale generation 必须被拒". (`DSH_Agent_Team_vNext_Task_Decomposition_and_Review_Method_20260829.md`)
- P8-T1 frozen client guard `decideFrameVerdict`: same teamSessionId + strictly-newer generation → apply; equal → duplicate (rejected, state untouched); older → stale (rejected); different id → foreign; provenance.generation ≠ projection.generation → inconsistent (rejected before the guard).
- P8-T2 read port: carries `source.generation` verbatim from the durable TeamDomain (`packages/runtime/projection/fold.ts:88`, `types.ts:75` — locate exactly in-tree).
- Current production `team_sessions` writers: creation paths only — `root-binding/write-port.ts` (`putTeamSession`) and `fork-reconciliation/adapter.ts` (`put`). Action-router effects write only memberInstances + the ledger (`commitFact` → `repositories.ledger.put` / `allocateSequence`).
- P6-T2 `RuntimeActionEffect` closed union: `fact-recorded.sequence` / `work-admitted.sequence` / `lifecycle-changed.sequence` / `member-activated.ledgerSequence?` (+ optional `admissionCode`).
- P8-T4: `admissionEffectSequence` in `packages/remote/src/handlers/member.ts:39-52` reads `effect.factSequence ?? effect.deliveredSequence` (stale vocabulary); `packages/remote/src/handlers/ports.ts:340-347` documents the same stale vocabulary.

## §4 S1-A decision frame (stamp-advance write path)

Correctness requirements (ALL mandatory):

1. **Monotonic**: `team_sessions.generation` starts at 1 (seed — already frozen behavior) and is strictly incremented by +1 on every durable change of TeamDomain state visible to the P8-T2 projection. It never decreases and never moves backward.
2. **Commit atomicity**: the stamp increment must be durable in the SAME commit/transaction as the state change it covers. A crash must never leave "new state durable + old stamp durable" — that combination surfaces as an equal-stamp re-pull → verdict `duplicate` → a reconnected client keeps the stale body forever. Use existing storage primitives. If no existing primitive can make the state write + stamp increment atomic, do NOT invent a new table or a two-phase workaround: stop and raise `BLOCKER:SPEC` naming the exact primitive gap.
3. **Idempotent replay**: retrying an already-committed operation (same operationId, operation-journal idempotency) must NOT re-advance the stamp.
4. **Writer enumeration (required evidence)**: enumerate in the design note EVERY production writer that mutates any table visible to the P8-T2 projection (the P8-T1 DTO field list — root/template/instance/lifecycle/effective-config/activity/ledger-summary — is the ground truth of what is visible; include policy/override state, compatibility state, ledger, member instances, templates, team-session record), and prove each such commit advances the stamp exactly once. If a projection-visible writer cannot advance the stamp within an existing durable commit, raise `BLOCKER:SPEC`.
5. **Frozen surfaces untouched**: `packages/contracts/src` is NOT modified (the generation field already exists — verify; if it is genuinely missing, raise `BLOCKER:SPEC` instead of adding it). The P8-T1 DTO, the P8-T2 read port, the P8-T1 client guard, and the Remote contract v1 surface (catalog/params/errors/version) are NOT modified.

Implementation: place the advance at the TeamDomain commit point(s) that cover the enumerated writers. The action-router commit path is the obvious candidate — verify it covers all of them; override/compatibility/activity writers may commit through different paths; decide from the code and document it.

## §5 S1-B decision frame (effect-sequence vocabulary)

- `admissionEffectSequence` (and any other P8-T4 handler reading effect vocabulary) must read the REAL P6-T2 union. Determine from the P6-T2 contract which sequence field is canonical per effect kind; expected canonical mapping is `fact-recorded.sequence` → `work-admitted.sequence` → `lifecycle-changed.sequence` → `member-activated.ledgerSequence` — verify against the P6-T2 contract and the action-router effects, and document the final rule in the design note.
- Update the stale doc comment at `ports.ts:340-347` to describe the real vocabulary.
- The wire field `provenance.effectSequence` stays nullable; the schema is unchanged. Document which effect kinds can legitimately produce null.
- Do NOT change the Remote contract v1 catalog, params schemas, or error vocabulary.

## §6 Owned paths (finalize the list in the design note; the main agent verifies the actual diff)

Permitted:
- S1-A: the TeamDomain commit point(s) + team-session write path (likely under `packages/runtime/src/**` and/or `packages/domain/src/**`; `packages/storage/src/**` only if a new storage operation is required — justify in the design note) + their tests.
- S1-B: `packages/remote/src/handlers/member.ts`, `packages/remote/src/handlers/ports.ts` (+ other handler files only if they read effect vocabulary) + `packages/remote/test/**`.
- New/extended tests under `packages/*/test/**`.
- If you add ANY file under `packages/remote/src`: maintain the `p8t3-negative.test.ts` layout pin in DEC-1 style (extend the expected list in scanner sorted order + update count/title/comments; NEVER touch scanner logic or the denylist).

Forbidden: `packages/contracts/src/**` (frozen surface), upstream, `references/**`, any package outside the permitted list, anything under `dev/agent-workflow/` (except your own new evidence dir), `docs/**` (frozen/protocol).

Frozen-region invariant: the diff of your commits vs base `93d2a96` must touch ONLY permitted paths.

## §7 Mandated tests

- S1-A positive: fresh team (seed stamp 1) → N sequential mutations (e.g. `member.create` via the real runtime action path) → stamp strictly 1,2,3,…,N+1 → a NEW client (reconnect semantics) re-pulls → verdict `apply` (NOT `duplicate`) → applied body equals the latest durable state.
- S1-A negative: idempotent operation replay does not double-advance; stamp never decreases; seed stamp = 1; non-state writes do not advance.
- S1-B positive: a composed mutation through the real effect kinds yields non-null `provenance.effectSequence` equal to the real ledger/fact sequence.
- S1-B negative: the Remote contract v1 negative scan still passes (no schema/catalog/vocabulary drift).
- p4t6 pin: run `packages/testkit/test/p4t6-session-event-scan.test.ts`; if the scanned file count changes (new `.ts`/`.mts`/`.mjs` under `packages/`), maintain the cumulative count in DEC-1 style (it-title tail / assertions / enumeration comment tail); the scanner `.mjs` stays byte-identical; denylist marker counts (withSource/legacy) must not increase (your new files add no legacy markers).
- Full chain: `node scripts/run-tests.mjs` (all 9 packages) → 0 failures (record the new total); tsc with SEPARATE args: `node node_modules/typescript/bin/tsc -p packages/<pkg>/tsconfig.json` ×6 (contracts/domain/storage/runtime/testkit/remote), all exit 0. NEVER `pnpm run/exec`, never the vitest CLI/tsx/esbuild.
- Matchers only toBe/toEqual/toBeGreaterThan/toThrow(+.not); no `node:` builtin imports in `.ts` files; NodeNext + verbatimModuleSyntax (`.js` extensions); erasable TS only.

## §8 Evidence hygiene (mandatory — audit lesson from prior rounds)

- All evidence under the worktree `dev/agent-workflow/evidence/G8-S1/`: a design note (sections: S1-A writer enumeration + commit-point choice + crash-window argument; S1-B canonical vocabulary rule table; finalized owned-path list; test map) and an attempt log (chain + tsc per attempt).
- Every chain/tsc run in the logs must carry a proof header: pwsh-cwd, `git rev-parse --show-toplevel`, `git rev-parse HEAD`, plus an explicit `ran-on:` note — bare `node` commands use the shell's cwd, so ALWAYS run with the working directory explicitly set to THIS worktree and verify the log shows this worktree's toplevel (a wrong-cwd run is an invalid audit).
- Chain runs happen on the COMMITTED clean tree (commit code → run chain → commit evidence). If a Windows file-handle race flake hits an unrelated testkit scratch dir (ENOTEMPTY in `.tmp-fault`-style paths), clean the untracked leftover, retry once, and record it in the log — do not modify testkit logic.

## §9 Blockers (fixed format — stop and report, do not guess, do not expand scope)

- `BLOCKER:SPEC:<detail>` — conflict with frozen docs/contracts, or a storage-primitive gap that prevents commit-atomic stamp advance (§4.2), or a projection-visible writer you cannot cover (§4.4).
- `BLOCKER:DEPENDENCY:<detail>` — a required frozen surface is missing from the tree.

## §10 Git discipline

Commit the code first (one logical commit for S1-A and one for S1-B, or a single combined commit if the design note justifies the coupling), then one evidence commit. Never push, never amend the base, never touch files outside your worktree.

## §11 Final report (fixed format — your LAST message)

```
G8S1_RESULT
status: DONE | BLOCKER
head: <full SHA>
commits: <code SHA(s)> / <evidence SHA>
chain: <N passed>/<N total> (failures 0) | tsc: contracts=0 domain=0 storage=0 runtime=0 testkit=0 remote=0
s1a: commit-point <path> | writers-enumerated: <count> | new-tests: <count>
s1b: files <list> | canonical-rule: <one line>
p4t6: <count before> -> <count after> (pin maintained: yes/no)
frozen-region-diff-vs-base: ONLY-owned | VIOLATION:<paths>
concerns: <none | list>
blocker: <none | fixed-format>
```
