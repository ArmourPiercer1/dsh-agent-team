# P7-T7 Brief — Legacy Team Session read-only reader + G7 (task/P7-T7-legacy-session-reader)

> Kickoff round R48. Single worker, dispatched via workflow, provider `qiyuan-self`, model `qwen3.8-27b`.
> This brief is authoritative for the worker. The worker does NOT see main-agent conversation context.

## §0 MANDATORY FIRST STEP (prompt-injection rule, no exceptions)

Before touching anything, read in your worktree:

1. `docs/ROUTER_RULES.md` — unattended execution protocol, blocker types/formats, git discipline.
2. `docs/TEST_METHODS.md` — test-infrastructure constraints; **§2/§5 are the sanctioned real-instance boot chain (this task DOES use it — it is the only P7 task with real-instance E2E)**.

Do not claim familiarity; read both. Any conflict: frozen docs > ROUTER_RULES > TEST_METHODS > this brief.

## §1 Task card (TaskDoc §11.8, L1670–1683, verbatim)

### P7-T7 — Legacy Team Session read-only reader + G7

- **目标**：best-effort inspect old Team metadata；任何 mutate/resume/restore 入口拒绝；整合高级语义 Gate。
- **拥有的文件/包**：`packages/legacy/session-reader*；P7 e2e`
- **前置依赖**：P7-T1,P7-T2,P7-T3,P7-T4,P7-T5,P7-T6
- **允许依赖**：public legacy-readable session APIs only
- **禁止项**：全局 forbidden block。
- **实现要点**：metadata 读不到时退化 native Chat/Trajectory，不是 blocker。
- **必须测试**：legacy read；mutation reject；fork/handoff/lifecycle/ACK integrated suite。
- **验收标准**：G7 全 criteria PASS。
- **输出物**：legacy reader；G7 report
- **难度**：`R5/C4/T5`；推荐 `Class A`。
- **并行关系**：`H3`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

## §2 G7 criteria (DevPlan 20.7, verbatim — your G7 report must cover ALL nine)

```text
✓ warning/fatal admission semantics
✓ ack fingerprint invalidation
✓ human override precedence
✓ lifecycle quiescence
✓ Restore does not create/resume Agent
✓ Root fork exact semantics
✓ Member fork ordinary semantics
✓ handoff one-shot/no-live-link
✓ legacy old Team cannot mutate/resume
```

## §3 Frozen-document anchors (read-only; verify hashes)

- Architecture — sha256 `030dfb8ec55bae30f35c2826c7e4e659c0e0b742d836018ce502f34017870c53`
- UI Design — sha256 `3ef3ab69ed2bd7879e4c15079a16c8dae456b572690246a5c1f9cbb0c8c4981e`
- Development Plan — sha256 `a05d237f8515fd6467373632849afe0c6a1ae63bc0ec298de63b9d124d881d0f`
- Task Decomposition — sha256 `2b457cc033ca1b72aa781e072e0ef7fe55bc05d2f7ea25cc03c827d257e888a3`

Supporting references (read as needed): `docs/migration/` (legacy inventory / reuse map), `references/deepseek-harness/` (frozen legacy fork, HEAD lock — READ-ONLY evidence of the old Team on-disk formats), `packages/legacy/teammates-adapter*` + its 12 `.md` fixtures (P7-T6, the legacy format reference), `packages/legacy/test/p7t6-*` (test convention in this package).

## §4 Work environment & single-writer rule

- Repo: `D:\AgentDev\dsh-plugins\dsh-agent-team` (main worktree is on `master` — do NOT work there for code).
- Create your worktree exactly:

  ```
  git -C D:\AgentDev\dsh-plugins\dsh-agent-team worktree add .worktrees/P7-T7 -b task/P7-T7-legacy-session-reader c53f1b008d59b803f51d2c107ffffb7846a8bb9c
  ```

- Base `c53f1b0` is the `int/P7-advanced-semantics` tip (P7 wave-1 + P7-T2 already integrated: compatibility, mutation, lifecycle, fork-reconciliation, handoff, legacy teammates-adapter).
- You are the ONLY writer on this branch/worktree. Never touch: other worktrees, `int/P7-advanced-semantics`, `master`, any other branch, `references/deepseek-harness` (frozen legacy fork — read-only evidence), the stable deployment `D:\deepseek-harness\`, the :3080 instance.
- **NO push. NO force-push. Ever.**

## §5 Owned paths (write only here + §8 exception)

- `packages/legacy/session-reader/**` — new read-only reader module (primary deliverable). Follow the package pattern: own `index.ts`, `types.ts`, `errors.ts`, pure logic + injected ports. Includes a TEST-ONLY e2e harness subdir `packages/legacy/session-reader/e2e/` (see §7) — make clear in file headers that it is test-only, not a product surface.
- `packages/legacy/test/p7t7-*.test.ts` — new test suites (discovery is `packages/<pkg>/test/*.test.ts` only; helpers may share the `p7t7-` prefix there).
- DEC-1 formal exception: `packages/testkit/test/p4t6-session-event-scan.test.ts` (count maintenance only, see §8).

**Read-only dependencies you may import but NOT modify:** all P7 runtime modules (`packages/runtime/{compatibility,mutation,lifecycle,fork-reconciliation,handoff,policy-adapter.ts}`), `packages/domain/**`, `packages/contracts/**`, `packages/storage/**`, `packages/legacy/teammates-adapter*` (format reference), and the P6-T6 e2e harness `packages/tools/harness/{run.mjs,plugin.mjs}` (TEMPLATE — copy-and-adapt, do not modify the original).

Any required write outside the owned paths → do NOT write; report `BLOCKER:OUT_OF_OWNED_PATH:<path>:<reason>` and stop.

## §6 Type/test discipline (zero-core + toolchain)

- CORE PATCH BUDGET = 0: no upstream source changes, no private/internal DSH APIs, no patch-package.
- **No `node:` builtin imports in any `.ts` file** (TS2591). Node builtins allowed only in `.mjs`/`.cjs` harness scripts (your e2e/ dir is such a case).
- NodeNext + `verbatimModuleSyntax`: relative imports in `.ts` MUST use explicit `.js` extensions.
- Erasable TypeScript only: no `enum`, no namespaces, no parameter properties.
- Test matchers ONLY: `toBe`, `toEqual`, `toBeGreaterThan`, `toThrow` (and `.not` variants).
- Sanctioned chain ONLY:
  1. `pnpm install --ignore-scripts` (worktree root)
  2. `node scripts/run-tests.mjs [pkg]` (no arg = all 9 packages)
  3. tsc per package with SEPARATE arguments (one-string form fails TS5023): `node node_modules/typescript/bin/tsc -p packages/<pkg>/tsconfig.json` for each of `contracts`, `domain`, `storage`, `runtime`, `testkit` (five packages with source; `legacy` has no tsconfig typecheck leg in the chain).
- NEVER: `pnpm run`, `pnpm exec`, vitest CLI, tsx, esbuild, vite.
- Typecheck note: new sources under `packages/legacy/` are typechecked transitively only if imported by a test under `packages/legacy/test/` (the legacy tsconfig includes its own `src`/`test` — verify `packages/legacy/tsconfig.json` in your worktree and make sure every new source file is inside the include or imported by a test).

## §7 Deliverable A — reader module + in-process suites (REQUIRED, bulk of the work)

1. **Reader** (`packages/legacy/session-reader/`): best-effort inspector of OLD Team metadata (the legacy on-disk formats — study `references/deepseek-harness` (frozen, read-only) + `docs/migration/` + the P7-T6 fixtures for the exact shapes). Read-only by construction: **no mutate/resume/restore entry exists**; any attempt to route a mutation through the reader surface must be rejected with a typed error. When metadata is unreadable/absent, **degrade to native Chat/Trajectory data** (the card's 实现要点) — this degradation path is REQUIRED behavior and REQUIRED to be tested; it is not a blocker.
2. **In-process test suites** (`packages/legacy/test/p7t7-*.test.ts`, fakes/in-memory, deterministic, no boot):
   - `p7t7-legacy-read*` — legacy read: valid old Team metadata inspected; missing/corrupt metadata degrades to native Chat/Trajectory; read is side-effect-free.
   - `p7t7-mutation-reject*` — mutation reject: every mutate/resume/restore-style attempt against a legacy old Team is rejected (typed errors), including the reader having no such entry at all.
   - `p7t7-integrated-*` — **the card's "fork/handoff/lifecycle/ACK integrated suite"**: compose the P7 runtime modules (compatibility + mutation + lifecycle + fork-reconciliation + handoff) against fakes in multi-module scenarios asserting cross-module invariants, e.g.: capability drift warning blocks new work while in-flight admitted work settles (ACK fingerprint invalidation on environment change); human override precedence reflected in the effective configuration consumed by admission; archive → drain → quiesce → commit with Restore = ARCHIVED→SETTLED only (no Agent resume/create); Root fork = same Blueprint snapshot + zero members while Member fork stays an ordinary Session; handoff snapshot is one-shot and the target holds no live link to the source. Cover at least the nine §2 criteria with at least one dedicated scenario each where the criterion is cross-module.
3. These suites are the PRIMARY evidence for the §2 criteria; the G7 gate will rerun them from the integration SHA.

## §8 Deliverable B — G7 real-instance e2e (REQUIRED, modeled on P6-T6; strict fallback)

This is the only P7 task with real-instance E2E. You OWN the real-instance E2E and the lockfile protocol.

- **Template (copy-and-adapt, do NOT modify the originals)**: `packages/tools/harness/run.mjs` + `packages/tools/harness/plugin.mjs` (P6-T6). Also read `dev/agent-workflow/briefs/P6-T6-brief.md` and `dev/agent-workflow/evidence/P6-T6/g6-report.md` + `run-log.txt` (exact per-leg command sequence precedent) and `dev/agent-workflow/evidence/P5-T6/run-log.txt`.
- **Location**: `packages/legacy/session-reader/e2e/` (your `run.mjs` + `plugin.mjs`, adapted). The harness plugin is TEST-ONLY: it registers a small surface (mini-MCP tool(s) / directives) that exercises the reader against the booted instance's DSH_HOME; the driver talks through that registered surface only.
- **Mechanics (all proven in P6-T6 — follow TEST_METHODS §2/§5 exactly)**:
  - hostTree (pristine upstream DSH source) = `references/deepseek-harness-test-use`; must stay pristine — verify `git -C references/deepseek-harness-test-use rev-parse HEAD` = `cd5ef8148158c3a752a658978873241fdf8e2bbc` and `git status --porcelain` EMPTY before AND after the e2e.
  - DSH_HOME = `references/.dsh-test-p7t7` (task-specific, FRESH per run: rm + mkdir, never reuse another task's).
  - Boot: `node apps/cli/lib/bin.js web --port 3180 --no-open` with env `DSH_HOME` + `DSH_CLIENT_COMMIT_HASH=cd5ef8148158c3a752a658978873241fdf8e2bbc`; **FILE-FD stdio spawn** (the sandbox forbids named pipes: never capture child output with default `stdio: 'pipe'` — use the file-FD scheme from the P6-T6 run.mjs); row-mount seam `DSH_HOME/profiles/web/cordis.patch.yml` (same pattern as P6-T6).
  - Ports: boot 3180 (second boot 3181 only if the scenario needs restart); mini-MCP fixed 3491–3495.
  - **Serialization/lockfile**: `references/.dsh-test-p7t7.lock` — before any boot: if the lock exists and is fresh (<10 min) sleep 20 s and retry (≤45×); if stale (≥10 min) remove it; write `<pid-or-id> + timestamp` on acquire; delete in a `finally`. Harness runs are strictly serial (shared DSH_HOME + fixed ports — never parallel).
- **Scenario (minimum, G7 criterion 9 end-to-end)**: plant a real legacy old-Team fixture (old on-disk metadata under the fresh DSH_HOME) into the booted instance's home; then via the registered surface: (a) legacy metadata inspect succeeds (best-effort read with correct fields); (b) any mutate/resume/restore attempt against that legacy Team is rejected; (c) absent-metadata case degrades to native Chat/Trajectory (not a blocker, per 实现要点).
- **Evidence**: `summary.json` + per-scenario JSON + boot logs + git status/head proof for test-use, all under `dev/agent-workflow/evidence/P7-T7/harness-output/`.
- **Strict fallback (pre-authorized, must be used exactly)**: if the real-instance leg cannot be completed for environmental/sandbox reasons (NOT for design or code reasons) after a dedicated, documented effort (≥1 full harness run attempt with boot logs captured), deliver Deliverable A complete + G7 report (Deliverable C) with in-process evidence for all nine criteria, mark criterion 9's e2e leg as `E2E-PENDING-ENV` in the report, and end your final message with `BLOCKER:E2E_ENV:<one-line detail>`. Main agent adjudicates (attempt-2 dispatch or gate note). Do NOT silently skip the leg and report PASS.

## §9 Deliverable C — G7 report (REQUIRED)

`dev/agent-workflow/evidence/P7-T7/g7-report.md` — one section per §2 criterion (nine total), each with: **criterion → evidence (test files + scenario names + e2e scenario where applicable) → PASS/FAIL**. Every criterion must be PASS for the task to be complete; if any is FAIL, fix within your attempts or report the blocker. The G7-REVIEW gate (3 fresh independent reviewers, later round) will rerun key positive+negative tests from the integration SHA and re-derive criterion→evidence PASS/FAIL itself — do not assume your report is trusted; assume it is re-derived from disk.

## §10 Verification chain (serial, INSIDE your worktree — R46 lesson)

All legs run with the worktree as current directory (Set-Location). EVERY log starts with proof lines: `git rev-parse --show-toplevel` and `git rev-parse HEAD`.

1. **Baseline (attempt 1, at base c53f1b0 before any code)**: install → full `node scripts/run-tests.mjs` → tsc ×5. Expect **1510/1510 tests, 0 failures**, all tsc exit 0. Log → `dev/agent-workflow/evidence/P7-T7/attempt1-baseline.log`. If baseline ≠ 1510/1510: STOP, report `BLOCKER:BASELINE_DRIFT:<actual totals>`.
2. **Post-implementation (same attempt, same worktree)**: same chain. Expect **1510 + N** passing, 0 failures; tsc ×5 exit 0. Log → `dev/agent-workflow/evidence/P7-T7/attempt1-post.log`.
3. **Import-face scan**: grep your new `.ts` files for `node:` imports → expect zero. Record in evidence.
4. **p4t6**: apply the §11 update, then `node scripts/run-tests.mjs testkit` to confirm the p4t6 suite passes with the new count; append output (or note) to the post log.
5. **Real-instance e2e** (§8) AFTER the chain is green. E2E logs + harness-output land in evidence/P7-T7/. test-use pristine check before AND after (§8).
6. **Health**: :3080 must be 200 before and after your whole task (the stable instance is sacrosanct); ports 3180/3181 must be free before boot and released after (kill your instance in a finally).

## §11 p4t6 coverage-count maintenance (DEC-1, ratified R29)

The scanner `packages/testkit/fault-injection/session-event-scan.mjs` counts `.ts`/`.mts`/`.mjs` under `packages/<pkg>/` (byte-identical across all branches — do NOT modify it). At base `c53f1b0` the committed count is **394**.

After implementation let `N` = number of newly added countable files (every new `.ts`/`.mts`/`.mjs` under `packages/` — reader sources + tests + e2e `.mjs` scripts all count). Update `packages/testkit/test/p4t6-session-event-scan.test.ts`:
- it-title: substitute the count; you may append one factual clause naming what legacy carries now (same style as the existing "runtime carries the P7-T2 mutation files" / "legacy carries the P7-T6 adapter" clauses), e.g. `... <394+N> files scanned, legacy carries the P7-T7 session reader, ...` — keep all existing clauses.
- `filesScanned).toBe(394+N)` and `files.length).toBe(394+N)`
- `withSource.length).toBe(9)` stays; the legacy-file-count assertion becomes `4 + (new countable files you add under packages/legacy/)` — count them precisely.
- append a `P7-T7` enumeration comment block (same style as the P7-T1..T6 blocks).

## §12 Deliverables & commits

Evidence (new dir `dev/agent-workflow/evidence/P7-T7/`): `design-note.md` (reader port surface, legacy format decisions, degradation path, e2e harness adaptation notes, deviations); `attempt1-baseline.log`, `attempt1-post.log` (§10 proof headers); `zero-core-log.md` (import-face + matcher + erasable-TS self-check); `attempt-ledger.md` (`P7-T7: attempt 1/3 — <outcome>`); `g7-report.md` (§9); `harness-output/` (§8) if the e2e ran; `run-log.txt` (per-leg exact command sequence, P5-T6/P6-T6 format) if the e2e ran.

Commits on `task/P7-T7-legacy-session-reader` (max 3):
1. Code + tests + p4t6 — message `P7-T7: legacy Team Session read-only reader + G7 e2e (best-effort inspect, mutate/resume/restore rejected, integrated suite)`.
2. G7 report + design note + chain logs — message `P7-T7 evidence: g7-report, design note, chain logs, zero-core, ledger`.
3. (only if e2e ran) harness-output — message `P7-T7 evidence: real-instance e2e harness-output`.

Do not push. Do not modify any file outside owned paths + evidence dir.

## §13 Final report (exact format, in your last message)

```
P7T7_REPORT
branch: task/P7-T7-legacy-session-reader
commits: <sha-1> <sha-2> [ <sha-3> ]   (git rev-parse values)
files: <owned paths added, one per line>
tests: baseline 1510/1510 -> post <1510+N>/<1510+N> (failures 0)
tsc: contracts=0 domain=0 storage=0 runtime=0 testkit=0
p4t6: 394 -> <394+N> (N=<n>; new countable files: <list>)
e2e: <PASS scenarios=... | E2E-PENDING-ENV> (test-use pristine before+after: yes/no)
g7-criteria: 9/9 PASS | <k>/9 PASS (failing: <list>)
zero-core: pass
deviations: <none | explicit list>
[blocker line if any, verbatim]
```

## §14 Failure & blocker protocol

- ≤3 total attempts (worker attempts only). A failed attempt = full redo from a clean tree on the same branch (amend/reset locally, never push).
- Blocker types: `BASELINE_DRIFT`, `OUT_OF_OWNED_PATH:<path>:<reason>`, `E2E_ENV:<detail>` (only via the §8 strict fallback), `CORE_SEAM_BLOCKER:<seam>` (if a required capability needs a non-public upstream seam — STOP, do not work around), `FROZEN_CONFLICT:<doc>:<detail>` (if card/frozen docs conflict and the frozen-docs reading is ambiguous).
- On any blocker: commit everything committable (code + evidence + report), report the blocker verbatim in the final message, and stop. Main agent handles the next step.
- Never delete or modify files outside owned paths; never touch other worktrees; never push; never touch the stable instance.