# P8-T1 Worker Brief — Freeze TeamProjection DTO v1 (Round R50)

> Base: `959e36358ee7244ff8c7e1e0b8396e70dfef4562` (= int/P8-remote-projection tip = post-G7 master tip; chain 1588/1588 + tsc x5 verified at this SHA; p4t6 = 411 / withSource 9 / legacy 21).
> Card: TaskDoc §11.9 P8-T1. Class A. Worker attempts allowed: 3 (this dispatch is attempt 1).
> You are the only writer on your branch/worktree.

## §0 MANDATORY FIRST STEP

Read in your worktree, complete: `docs/ROUTER_RULES.md` and `docs/TEST_METHODS.md`. Then verify the frozen docs (§2 hashes) and read the gate-relevant sections. Do not skip on familiarity.

## §1 Task card (TaskDoc §11.9, verbatim)

P8-T1 — 冻结 TeamProjection DTO v1
- 目标：定义 Root/Template/Instance/lifecycle/effective-config/activity/ledger summary/generation DTO。
- 拥有的文件/包：`packages/contracts/src/projection/**`
- 前置依赖：P7-T7（已完成 —— base 含全部 P7 代码）
- 允许依赖：contracts/domain only
- 禁止项：全局 forbidden block（见 §8）
- 实现要点：P8 shared write lock owner；UI 之后只消费该 DTO。
- 必须测试：serialization；generation monotonic；nullable live overlay。
- 验收标准：DTO 不泄露 TeamDomain storage internals 或 SessionController Team mirror。
- 输出物：projection contract v1
- 难度：R5/C3/T4；推荐 Class A。
- 并行关系：I0（P8 第一任务，本波无并行任务）。
- 审查重点：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

## §2 Frozen documents (verify sha256 before relying on them)

- Architecture `030dfb8ec55bae30f35c2826c7e4e659c0e0b742d836018ce502f34017870c53`
- UI `3ef3ab69ed2bd7879e4c15079a16c8dae456b572690246a5c1f9cbb0c8c4981e`
- Development Plan `a05d237f8515fd6467373632849afe0c6a1ae63bc0ec298de63b9d124d881d0f`
- Task Decomposition `2b457cc033ca1b72aa781e072e0ef7fe55bc05d2f7ea25cc03c827d257e888a3`

Design constraints to honor (read DevPlan §21 in full):
- §21.2 Projection source = `TeamDomain + optional current live residency/activity overlay`. You must NOT scan `Root + all child Session logs` to rebuild Team control truth. The DTO must encode this boundary: durable fields come from TeamDomain; live fields come from the overlay and are nullable when no live instance exists.
- §21.4 First version correctness first: whole Team projection generation or versioned invalidation + pull; the client must be able to reject stale-generation overwrites of newer state. Your DTO carries the identity/generation fields that make that possible (monotonic generation, stable IDs).
- §21.3 lists the downstream Remote API categories this DTO must serve (catalog / intent / team / member / override / policy / compatibility / handoff / legacy). Shape the DTO so Root/Template/Instance/lifecycle/effective-config/activity/ledger-summary/generation cover all of them without a second ad-hoc DTO.
- Object model (Architecture doc): TeamBlueprint → TeamSession + TeamDomain → MemberInstance. The DTO mirrors this hierarchy and the frozen lifecycle states — read the Architecture doc for the authoritative state set; do not invent states.

## §3 Identity & environment

- Repo: `D:\AgentDev\dsh-plugins\dsh-agent-team`. The main worktree (on master) is NOT yours — never write there.
- Base SHA: `959e36358ee7244ff8c7e1e0b8396e70dfef4562` (verify it resolves and equals `master` before branching).
- Create branch + worktree:
  `git -C D:\AgentDev\dsh-plugins\dsh-agent-team worktree add -b task/P8-T1-projection-dto .worktrees/P8-T1 959e36358ee7244ff8c7e1e0b8396e70dfef4562`
- In your worktree: `pnpm install --ignore-scripts` (log to your evidence dir).
- Your only writes: your worktree (incl. node_modules via install) + your evidence dir `dev/agent-workflow/evidence/P8-T1/`.
- NO push. NO force-push. Never touch other worktrees, `master`, the `int/*` branches, `references/deepseek-harness` (read-only), the stable deployment `D:\deepseek-harness\`, or the :3080 instance.

## §4 Owned paths (write lock)

- `packages/contracts/src/projection/**` — your exclusive write surface (new directory).
- Inspect `packages/contracts` FIRST (index/exports, existing submodules, naming + versioning conventions) and follow them; additive index/export changes are allowed only if the package convention requires them — keep them minimal.
- DEC-1 standing exception: `packages/testkit/test/p4t6-session-event-scan.test.ts` (coverage-count maintenance, §6).
- Any write outside these paths → STOP: `BLOCKER:OWNED_PATH:<path>`.

## §5 Baseline & sanctioned chain (all in YOUR worktree)

- Baseline (must match BEFORE you write code): full chain → 1588/1588; tsc x5 → exit 0; p4t6 count 411.
- Commands (sanctioned chain — NEVER `pnpm run`/`pnpm exec`, vitest CLI, tsx, esbuild, vite):
  1. `node scripts/run-tests.mjs` (no args = all 9 packages; discovers only `packages/<pkg>/test/*.test.ts`)
  2. `node node_modules/typescript/bin/tsc -p packages/<pkg>/tsconfig.json` for contracts, domain, storage, runtime, testkit — one package per invocation, separate args (the single-string form breaks with TS5023).
- Log everything with proof headers (`git rev-parse --show-toplevel` + `git rev-parse HEAD`) to your evidence dir: `attempt1-baseline.log` before changes, `attempt1-post.log` after.
- After your changes the full chain must be green: 1588 + (your new tests), 0 failures.

## §6 p4t6 coverage count (DEC-1 standing exception)

- The scanner counts `.ts`/`.mts`/`.mjs` under `packages/<pkg>/`; your new `.ts` files raise the count.
- Update `packages/testkit/test/p4t6-session-event-scan.test.ts`: the it-title tail, `filesScanned` and `files.length` assertions (411 + N where N = your new countable files), and append a P8-T1 block to the enumeration comment. `withSource` stays 9; the legacy filter stays 21 (you add no legacy files).
- If the measured count differs from your arithmetic, trust the scanner run and record the discrepancy in design-note.

## §7 Required tests (card) + negative tests

Positive (card-mandated minimum):
- serialization: DTO round-trip through JSON is lossless for all fields (unknown-field behavior documented).
- generation monotonic: generation increases monotonically; the DTO exposes exactly the fields a client stale-guard needs (stale generation detectable + rejectable).
- nullable live overlay: projection built with a live overlay present AND absent (null overlay) — durable fields byte-identical in both; live fields null when absent.

Negative (minimum):
- the DTO surface contains no storage-internals shape and no SessionController Team mirror field (verify by explicit field-boundary assertions / a scan test, matching repo patterns).
- malformed inputs (bad IDs, non-monotonic generation construction attempts) are rejected or typed where the DTO surface allows it.

Test conventions (repo-wide): tests under `packages/contracts/test/` (check the existing layout first); matchers ONLY toBe/toEqual/toBeGreaterThan/toThrow (+.not); NodeNext + verbatimModuleSyntax (`.js` extensions on relative imports); erasable TS only; NO `node:` builtin imports in `.ts`.

## §8 Zero-core / red lines

- No `node:` builtin imports in any `.ts` under `packages/`; no patch-package / pnpm patch / postinstall mutation of upstream; no imports from `references/deepseek-harness-test-use` (upstream) or any upstream private/internal API; no legacy Team SessionEvent vocabulary as vNext authority; no copying legacy `packages/team` sources.
- Any path that would require an upstream source patch → STOP → `CORE_SEAM_BLOCKER:<seam>`.

## §9 Commits & evidence (on YOUR branch, two separate commits)

1. Design note: `dev/agent-workflow/evidence/P8-T1/design-note.md` — DTO shape rationale, mapping of the nine DTO areas to card + DevPlan §21, deviations (if any) with justification, acceptance-criteria verification plan.
2. Code commit — all src + test files: `P8-T1: projection DTO v1 (contracts/src/projection)`.
3. Evidence commit — design-note + attempt logs: `P8-T1: evidence (design-note, attempt1 logs)`.
Keep code and evidence as separate commits (main agent cherry-picks per commit with -x).

## §10 Final report (fixed format — your LAST message)

P8T1_REPORT
verdict: DONE | BLOCKER
base: 959e36358ee7244ff8c7e1e0b8396e70dfef4562
branch: task/P8-T1-projection-dto @ <head-sha>
files: <count; list of owned-path files>
chain: <passed>/<total> (failures <n>) | tsc: contracts=<x> domain=<x> storage=<x> runtime=<x> testkit=<x>
p4t6: 411 -> <411+N>
new-tests: <n> (serialization <a>, generation <b>, overlay <c>, negative <d>)
acceptance: <one line — non-leakage verification>
zero-core: PASS|FAIL
concerns: <none | list>
blocker: <none | BLOCKER:TYPE:detail>

## §11 Attempts & blockers

- This is attempt 1 of 3. Technical failure → fix in the same worktree/branch, re-run the chain, continue. Never create a replacement branch.
- Environment blocker (install/chain cannot run): record exactly what failed → `BLOCKER:ENV:<detail>`.
- Spec ambiguity that blocks the design: do not guess silently → `BLOCKER:SPEC:<card-line>:<question>` (main agent adjudicates against the frozen docs).

## §12 Hygiene

- Leave your worktree clean (git status: committed code/evidence only, no stray untracked files).
- No leftover processes or ports. Verify `:3080` returns 200 before and after your work; `D:\deepseek-harness\` must remain untouched.
