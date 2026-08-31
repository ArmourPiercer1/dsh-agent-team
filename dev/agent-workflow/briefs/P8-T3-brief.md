# P8-T3 Worker Brief — Freeze Remote Contract v1 + Host Handlers (Round R54)

> Base: `67c3d4e2d0533a8c0be5f2c6f854424813ec9f71` (= int/P8-remote-projection tip, post P8-T2; chain 1669/1669 + tsc x5 verified at this SHA; p4t6 = 440 / withSource 9 / legacy 21).
> Card: TaskDoc §11.9 P8-T3. Class A. Worker attempts allowed: 3 (this dispatch is attempt 1).
> You are the only writer on your branch/worktree.

## §0 MANDATORY FIRST STEP

Read in your worktree, complete: `docs/ROUTER_RULES.md` and `docs/TEST_METHODS.md`. Then verify the frozen docs (§2 hashes) and read the gate-relevant sections. Do not skip on familiarity.

## §1 Task card (TaskDoc §11.9, verbatim)

P8-T3 — 冻结 Remote contract + Host handlers
- 目标：定义 catalog/intent/team/member/override/policy/compat/handoff/legacy APIs 并实现 external Remote。
- 拥有的文件/包：`packages/remote/contracts*；handlers*`
- 前置依赖：P8-T1（projection DTO v1，`packages/contracts/src/projection/**`，只读）, P8-T2（projection service，`packages/runtime/projection/**`，只读）
- 允许依赖：public Remote seam + Runtime
- 禁止项：全局 forbidden block（见 §8）
- 实现要点：这是 Remote contract write-lock owner；typed errors/provenance。
- 必须测试：round-trip；invalid IDs；admission errors；version mismatch。
- 验收标准：browser 完全不需要 SessionController Team mirror。
- 输出物：Remote v1；handler tests
- 难度：R5/C5/T5；推荐 Class A。
- 并行关系：I2（P8 第三任务，本波无并行任务）。
- 审查重点：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

## §2 Frozen documents (verify sha256 before relying on them)

- Architecture `030dfb8ec55bae30f35c2826c7e4e659c0e0b742d836018ce502f34017870c53`
- UI `3ef3ab69ed2bd7879e4c15079a16c8dae456b572690246a5c1f9cbb0c8c4981e`
- Development Plan `a05d237f8515fd6467373632849afe0c6a1ae63bc0ec298de63b9d124d881d0f`
- Task Decomposition `2b457cc033ca1b72aa781e072e0ef7fe55bc05d2f7ea25cc03c827d257e888a3`

Design constraints to honor:
- DevPlan §21.3 (read in full) — the API category set, AT MINIMUM: `catalog.list/get`, `intent.probe`, `team.create`, `team.getProjection`, `team.getLedgerPage`, `member.create`, `member.send/followup`, `member.archive/restore/dispose`, `override.get/set/reset`, `policyState.get/set`, `compatibility.get/ack/reprobe`, `handoff.prepare/create`, `legacy.inspect`. API NAMING may be adjusted, but the SEPARATION is fixed — your contract must organize handlers into exactly these categories.
- DevPlan §21.1/§21.4 — this Remote is what the future UI consumes INSTEAD of the SessionController Team mirror; correctness first; every UI-visible action must end in a typed error or a typed value with provenance (G8 criterion 5).
- The frozen upstream seam is `TEAM_REMOTE` (characterized green in P2-T6; READ the evidence before designing):
  - `dev/agent-workflow/evidence/P2-T6/seam-report.md` (seam mechanism + full negative contract)
  - `tests/characterization/probes/remote-client/index.mjs` (working probe: how a row registers public handlers and how the wire round-trips)
  - Mechanism (summary): client→host RPC travels `POST /<channel>/<endpoint>` with body `{"type":"client-request","rpcId","method","payload"}`; rows register public handlers via the `connection` service (`rpc.handle`); responses are `server-response` envelopes (`result:{ok:true,value}` / `result:{ok:false,error:{code,message}}`). Handler-returned error → 200 `result.ok:false` with the typed code; handler throw → 500 (so handlers must NOT throw — they must return typed error results).

## §3 Identity & environment

- Repo: `D:\AgentDev\dsh-plugins\dsh-agent-team`. The main worktree (on master) is NOT yours — never write there.
- Base SHA: `67c3d4e2d0533a8c0be5f2c6f854424813ec9f71` (verify it resolves and equals `int/P8-remote-projection` before branching).
- Create branch + worktree:
  `git -C D:\AgentDev\dsh-plugins\dsh-agent-team worktree add -b task/P8-T3-remote-contract .worktrees/P8-T3 67c3d4e2d0533a8c0be5f2c6f854424813ec9f71`
- In your worktree: `pnpm install --ignore-scripts` (log to your evidence dir).
- Your only writes: your worktree (incl. node_modules via install) + your evidence dir `dev/agent-workflow/evidence/P8-T3/`.
- NO push. NO force-push. Never touch other worktrees, `master`, the `int/*` branches, `references/deepseek-harness` (read-only), the stable deployment `D:\deepseek-harness\`, or the :3080 instance.

## §4 Owned paths (write lock)

- Under `packages/remote/`, your write surface is everything matching the card glob: `packages/remote/contracts*` and `packages/remote/handlers*` at any depth (convention: `packages/remote/src/contracts/**` + `packages/remote/src/handlers/**`).
- Inspect FIRST: `packages/remote` (skeleton index + package conventions), `packages/contracts/src/projection` (frozen DTO you serve), `packages/runtime` (the P7/P8 read+mutation APIs you back the handlers with: compatibility probe/ack, mutation service, lifecycle, fork, handoff, projection service), `packages/legacy/session-reader` (legacy.inspect backing), and the P2-T6 seam evidence in §2.
- Additive index/export changes in `packages/remote/src/index.ts` are allowed (keep minimal; replace the skeleton PACKAGE_ID placeholder exports as the convention dictates).
- DEC-1 standing exception: `packages/testkit/test/p4t6-session-event-scan.test.ts` (coverage-count maintenance, §6).
- Any write outside these paths → STOP: `BLOCKER:OWNED_PATH:<path>`.

## §5 Baseline & sanctioned chain (all in YOUR worktree)

- Baseline (must match BEFORE you write code): full chain → 1669/1669; tsc x5 → exit 0; p4t6 count 440.
- Commands (sanctioned chain — NEVER `pnpm run`/`pnpm exec`, vitest CLI, tsx, esbuild, vite):
  1. `node scripts/run-tests.mjs` (no args = all 9 packages; discovers only `packages/<pkg>/test/*.test.ts`)
  2. `node node_modules/typescript/bin/tsc -p packages/<pkg>/tsconfig.json` for contracts, domain, storage, runtime, testkit — one package per invocation, separate args (the single-string form breaks with TS5023).
- Log everything with proof headers (`git rev-parse --show-toplevel` + `git rev-parse HEAD`) to your evidence dir: `attempt1-baseline.log` before changes, `attempt1-post.log` after.
- After your changes the full chain must be green: 1669 + (your new tests), 0 failures.

## §6 p4t6 coverage count (DEC-1 standing exception)

- The scanner counts `.ts`/`.mts`/`.mjs` under `packages/<pkg>/`; your new `.ts` files raise the count.
- Update `packages/testkit/test/p4t6-session-event-scan.test.ts`: the it-title tail, `filesScanned` and `files.length` assertions (440 + N where N = your new countable files), and append a P8-T3 block to the enumeration comment. `withSource` stays 9; the legacy filter stays 21 (you add no legacy files).
- If the measured count differs from your arithmetic, trust the scanner run and record the discrepancy in design-note.

## §7 Design requirements (implement all)

Contract layer (`packages/remote/src/contracts/**`):
- A VERSIONED Remote contract v1: a single contract version constant + supported-versions set + validation (mirroring the P8-T1 schema-version pattern), and a CLOSED method catalog organized into the §2 categories (exact method names are yours to choose; the category separation is fixed).
- Per method: typed input schema + typed output schema (reuse the P8-T1 DTO types — `team.getProjection` returns the `TeamProjectionDto`; `team.getLedgerPage` returns a ledger page; etc.), and a CLOSED typed error-code registry.
- Provenance: every successful response value carries provenance sufficient for the client to detect staleness/origin (e.g., projection generation, source step where the underlying action has one, request echo). Error results carry typed code + message (no raw exceptions on the wire).

Handler layer (`packages/remote/src/handlers/**`):
- One handler per catalog method, backed by the P7/P8 Runtime APIs (compatibility probe/ack, mutation service, lifecycle, fork, handoff, P8-T2 projection service, legacy session reader) — NEVER by SessionController Team mirror and NEVER by session-log scanning.
- Handlers MUST NOT throw: every failure path returns a typed `result.ok:false` error result per the seam contract (§2 mechanism).
- A seam-shaped registration function (e.g. `registerRemoteHandlers(connection, deps)`) that binds the catalog to the public seam exactly as the P2-T6 probe demonstrates (`connection` service `rpc.handle`); the function must be pure with respect to the seam (deps injected; no node: imports; no global state).

Required tests (card) + negative tests:
- round-trip: a representative method per category — request payload in → envelope out → value deserializes to the typed DTO/schema with provenance intact.
- invalid IDs: malformed TeamSessionId/InstanceId/TemplateId inputs → typed error (reuse P3 contract ID validation where present).
- admission errors: an action that the P7 compatibility semantics block (e.g., new member work while a drift warning is unacked / fatal) → the typed ADMISSION error surfaces at the remote boundary with provenance (this is the override/compatibility semantics visible through the Remote).
- version mismatch: a request carrying an unsupported/unknown contract version → typed version-mismatch error (not a handler throw).
Negative (minimum):
- no SessionController Team mirror dependency: the handler layer's dependency surface contains no mirror source (assert by construction + a scan test over your owned files).
- no session-log scanning for Team truth (same red line as P8-T2).

Test conventions (repo-wide): tests under `packages/remote/test/` (prefix `p8t3-*`); matchers ONLY toBe/toEqual/toBeGreaterThan/toThrow (+.not); NodeNext + verbatimModuleSyntax (`.js` extensions on relative imports); erasable TS only; NO `node:` builtin imports in `.ts`.

## §8 Zero-core / red lines

- No `node:` builtin imports in any `.ts` under `packages/`; no patch-package / pnpm patch / postinstall mutation of upstream; no imports from `references/deepseek-harness-test-use` (upstream) or any upstream private/internal API; no legacy Team SessionEvent vocabulary as vNext authority; no copying legacy `packages/team` sources.
- The Remote must be served through the PUBLIC seam only (`connection`/`rpc.handle` as characterized in P2-T6) — anything requiring an upstream source patch → STOP → `CORE_SEAM_BLOCKER:<seam>`.
- No SessionController Team mirror; no session-log-derived Team truth.

## §9 Commits & evidence (on YOUR branch)

1. Design note: `dev/agent-workflow/evidence/P8-T3/design-note.md` — method catalog table (category → method name → input/output types → error codes → backing Runtime API), provenance design, versioning design, seam registration shape (with the P2-T6 probe as reference), deviations (if any) with justification, acceptance-criteria verification plan.
2. Code commit — all src + test files: `P8-T3: remote contract v1 + handlers (packages/remote)`.
3. Evidence commit — design-note + attempt logs: `P8-T3: evidence (design-note, attempt1 logs)`.
Keep code and evidence as separate commits (main agent cherry-picks per commit with -x).

## §10 Final report (fixed format — your LAST message)

P8T3_REPORT
verdict: DONE | BLOCKER
base: 67c3d4e2d0533a8c0be5f2c6f854424813ec9f71
branch: task/P8-T3-remote-contract @ <head-sha>
files: <count; list of owned-path files>
chain: <passed>/<total> (failures <n>) | tsc: contracts=<x> domain=<x> storage=<x> runtime=<x> testkit=<x>
p4t6: 440 -> <440+N>
methods: <total catalog methods; per-category counts>
new-tests: <n> (round-trip <a>, invalid-ids <b>, admission <c>, version <d>, negative <e>)
acceptance: <one line — no SessionController mirror, typed errors + provenance everywhere>
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
