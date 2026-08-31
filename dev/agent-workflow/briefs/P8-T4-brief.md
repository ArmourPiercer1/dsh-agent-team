# P8-T4 Worker Brief — Push/Generation/Reconnect/Pagination (Round R56)

> Base: `c957f1ae18495d2f29948ca19532890cb5724754` (= int/P8-remote-projection tip, post P8-T3; chain 1713/1713 + tsc x6 (contracts/domain/storage/runtime/testkit/remote) verified at this SHA; p4t6 = 469 / withSource 9 / legacy 21).
> Card: TaskDoc §11.9 P8-T4. Class B. Worker attempts allowed: 3 (this dispatch is attempt 1).
> You are the only writer on your branch/worktree.

## §0 MANDATORY FIRST STEP

Read in your worktree, complete: `docs/ROUTER_RULES.md` and `docs/TEST_METHODS.md`. Then verify the frozen docs (§2 hashes) and read the gate-relevant sections (DevPlan §21.3/§21.4/§21.5). Do not skip on familiarity.

## §1 Task card (TaskDoc §11.9, verbatim)

P8-T4 — Push/generation/reconnect/pagination
- 目标：实现 versioned invalidation+pull 或 whole projection generation；client stale guard fixture；ledger paging。
- 拥有的文件/包：`packages/remote/push*；test client`
- 前置依赖：P8-T3
- 允许依赖：Remote v1
- 禁止项：全局 forbidden block。
- 实现要点：第一版 correctness first；stale generation 必须被拒。
- 必须测试：out-of-order frames；reconnect；duplicate invalidation；page anchor。
- 验收标准：新 state 不被旧 response 覆盖；分页稳定。
- 输出物：remote sync tests
- 难度：`R4/C4/T5`；推荐 `Class B`。
- 并行关系：`I3`。只有在其前置 contract/base 已冻结时才能进入 READY。
- 审查重点：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

## §2 Frozen documents (verify sha256 before relying on them)

- Architecture `030dfb8ec55bae30f35c2826c7e4e659c0e0b742d836018ce502f34017870c53` — `docs/plans/active/DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md`
- UI `3ef3ab69ed2bd7879e4c15079a16c8dae456b572690246a5c1f9cbb0c8c4981e` — `docs/plans/active/DSH_Agent_Team_vNext_Detailed_UI_Design_20260829.md`
- DevPlan `a05d237f8515fd6467373632849afe0c6a1ae63bc0ec298de63b9d124d881d0f` — `docs/plans/active/DSH_Agent_Team_vNext_Detailed_Development_Plan_20260829.md`
- TaskDoc `2b457cc033ca1b72aa781e072e0ef7fe55bc05d2f7ea25cc03c827d257e888a3` — `docs/plans/active/DSH_Agent_Team_vNext_Task_Decomposition_and_Review_Method_20260829.md`

DevPlan §21.4 Push/update model (verbatim, governing this task):
推荐：`whole Team projection generation` or `versioned invalidation + pull`。第一版优先 correctness，不追求复杂 delta protocol。Client 必须拒绝：`stale generation overwrites newer state`。

## §3 Read-only context (DO NOT MODIFY — read before designing)

- P8-T3 Remote contract v1 (FROZEN, NOT owned by you): `packages/remote/src/contracts/**` + `packages/remote/src/handlers/**` + `packages/remote/src/index.ts`. Facts you must build on: 23-method closed catalog (catalog 2 / intent 1 / team 3 / member 6 / override 3 / policyState 2 / compatibility 3 / handoff 2 / legacy 1); `REMOTE_CONTRACT_VERSION = 1` + `SUPPORTED_REMOTE_CONTRACT_VERSIONS = [1]`; per-method closed param schemas (`params.ts`); closed typed error registry (`errors.ts`); provenance on every success value (origin team-remote + method/endpoint/contractVersion/requestToken); the projection value is the P8-T1 `TeamProjectionDto` which carries `generation`; dispatcher invariants (unknown method rejected before envelope; per-method param parse; typed error results only; dispatcher promise never rejects). Read the full P8-T3 design note: `dev/agent-workflow/evidence/P8-T3/design-note.md` (method catalog table §3, provenance design §5, seam registration shape §6, deviations §2).
- P8-T2 projection service (FROZEN for you): `packages/runtime/projection/**` — pure fold over durable TeamDomain state + nullable liveActivity overlay; **ledger pagination is a separate read path in `ledger.ts`** (your page-anchor tests run against its contract).
- P2-T6 seam evidence (read-only): `dev/agent-workflow/evidence/P2-T6/seam-report.md` — "Seam: remote RPC (authenticated client-request channel)" (TEAM_REMOTE): the wire is REQUEST/RESPONSE ONLY — client→host `POST /<channel>/<endpoint>` body `{"type":"client-request","rpcId","method","payload"}`, rows register public handlers via the `connection` service (`rpc.handle`), responses are `server-response` envelopes (`result:{ok:true,value}` / `result:{ok:false,error:{code,message}}`); negatives: no cookie 401, wrong content-type 415, method≠endpoint 200 bad-request, handler typed error 200 ok:false, **handler throw → 500**. "Seam: reconnect basic (loss → backoff → reconnect)": backoff formula, state machine, and sink isolation as characterized there — your test-client reconnect state machine must be ALIGNED with that characterization. Working probe: `tests/characterization/probes/remote-client/index.mjs`.

## §4 Identity / environment / owned paths

- Branch: `task/P8-T4-remote-push`; worktree: `.worktrees/P8-T4`; base: `c957f1ae18495d2f29948ca19532890cb5724754`.
- Create from the main repo root: `git worktree add .worktrees/P8-T4 -b task/P8-T4-remote-push c957f1ae18495d2f29948ca19532890cb5724754`, then run `pnpm install --ignore-scripts` INSIDE your worktree (sanctioned; log to your evidence dir as `install.log`). All subsequent commands run with your worktree as the working directory.
- Owned paths (writes allowed ONLY here):
  - `packages/remote/src/push/**` (any depth — push engine: generation/change tracking, frame model, pull surface)
  - `packages/remote/test/**` (NEW files only, `p8t4-*` prefix — includes the test-client fixture)
  - `packages/remote/src/index.ts` (ADDITIVE export block only — no removal/renaming of existing exports)
  - `packages/testkit/test/p4t6-session-event-scan.test.ts` (DEC-1: count/title/enumeration comment only — see §6)
  - `dev/agent-workflow/evidence/P8-T4/**` (your evidence, inside YOUR worktree)
- Any write outside these paths → STOP: `BLOCKER:OWNED_PATH:<path>`.
- In particular: the P8-T3 frozen files (`packages/remote/src/contracts/**`, `packages/remote/src/handlers/**`) and everything under `packages/runtime/**` are READ-ONLY for you.

## §5 Baseline & sanctioned chain (all in YOUR worktree)

- Baseline (must match BEFORE you write code): full chain → 1713/1713; tsc x6 → exit 0; p4t6 count 469.
- Commands (sanctioned chain — NEVER `pnpm run`/`pnpm exec`, vitest CLI, tsx, esbuild, vite):
  1. `node scripts/run-tests.mjs` (no args = all 9 packages; discovers only `packages/<pkg>/test/*.test.ts`)
  2. `node node_modules/typescript/bin/tsc -p packages/<pkg>/tsconfig.json` for contracts, domain, storage, runtime, testkit, remote — one package per invocation, separate args (the single-string form breaks with TS5023).
- Log everything with proof headers (`git rev-parse --show-toplevel` + `git rev-parse HEAD` + `git status --porcelain`) to your evidence dir: `attempt1-baseline.log` before changes, `attempt1-post.log` after.
- R55 lesson (recorded from P8-T3 audit): the post-chain proof header must reflect the tree state the chain ACTUALLY ran against. If you run the post-chain before committing, say so explicitly in the log (e.g. `ran-on: uncommitted working tree (status below)`) and re-verify against the committed HEAD as your final step — the main agent re-runs the chain on the committed HEAD regardless.
- After your changes the full chain must be green: 1713 + (your new tests), 0 failures.

## §6 p4t6 coverage count (DEC-1 standing exception)

- The scanner counts `.ts`/`.mts`/`.mjs` under `packages/<pkg>/`; your new files raise the count.
- Update `packages/testkit/test/p4t6-session-event-scan.test.ts`: the it-title tail, `filesScanned` and `files.length` assertions (469 + N where N = your new countable files), and append a P8-T4 block to the enumeration comment. `withSource` stays 9; the legacy filter stays 21 (you add no legacy files).
- If the measured count differs from your arithmetic, trust the scanner run and record the discrepancy in design-note.

## §7 Design requirements (implement all)

Push engine (`packages/remote/src/push/**`):
- **D-1 (push model choice — DevPlan §21.4)**: implement EITHER whole projection generation pull OR versioned invalidation + pull. First version = correctness first (no complex delta protocol). Record the choice + justification in the design note.
- A client-trackable generation sequence: the projection `generation` (already in the P8-T1 `TeamProjectionDto`) is the natural version. Your engine must expose a deterministic pull surface: given the client's last known generation, the server can tell the client whether it is stale and what the current truth is.
- **D-2 (wire surface constraint)**: the P8-T3 contract files are FROZEN and NOT owned by you, and the seam is request/response only (no server→client push channel exists). Your implementation is expected to work entirely over the FROZEN RPC surface (existing catalog methods + the existing dispatcher/register shape; "push" = server-side versioned state + client pull). The design note must show the exact binding shape (how the pull surface attaches to the seam registration without touching frozen files). If you conclude a new catalog method is unavoidable, do NOT guess → `BLOCKER:SPEC:<card-line>:<question>` (main agent adjudicates against the frozen docs).

Test-client fixture (`packages/remote/test/`, `p8t4-test-client*`):
- A deterministic in-process client simulation: NO browser, NO network — an injectable fake transport speaking the seam envelopes (`client-request` in, `server-response` out). It must maintain `lastAppliedGeneration` and:
  - apply a projection frame only when its generation is STRICTLY newer than the applied state (stale guard — stale frames are rejected/dropped, never overwrite newer state);
  - be IDEMPOTENT under duplicate frames (same generation applied twice → no state change, no double effect);
  - implement a reconnect state machine ALIGNED with the P2-T6 "reconnect basic" characterization (loss → backoff → reconnect; backoff formula as characterized; sink isolation — a throwing sink must not break the loop);
  - anchor ledger pages via `team.getLedgerPage` (stable page anchor while the ledger grows).
- The fixture must stay transport-agnostic and dependency-light so the G8 pristine-host e2e (P8-T5) can reuse it.

Required tests (card, minimum) + negatives:
- **out-of-order frames**: frames arriving out of generation order (e.g. N+2 after N, then N+1) → no newer state is lost or overwritten; a stale N against current N+2 is rejected.
- **reconnect**: simulated connection loss mid-stream → backoff → reconnect → state converges to current truth; no stale frame applied after reconnect.
- **duplicate invalidation**: the same generation/invalidation applied twice → idempotent, no state change, no double effect.
- **page anchor**: a ledger page fetched with an anchor stays stable (same anchor → same page semantics) while the ledger grows, per the P8-T2 ledger read-path contract.
- **acceptance (must hold, tested)**: 新 state 不被旧 response 覆盖 (newer state is never overwritten by an older response); 分页稳定 (pagination stable).
- **negative (minimum)**: the test client never applies a frame without a generation check; nothing in your code throws across the wire boundary (typed error results only — P8-T3 dispatcher invariant); no SessionController Team mirror and no session-log-derived Team truth anywhere in your new code (assert by a scan test over your owned files, P8-T3 `p8t3-negative-scan` pattern).

Test conventions (repo-wide): tests under `packages/remote/test/` (prefix `p8t4-*`); matchers ONLY toBe/toEqual/toBeGreaterThan/toThrow (+.not); NodeNext + verbatimModuleSyntax (`.js` extensions on relative imports); erasable TS only; NO `node:` builtin imports in `.ts` (a `.mjs` scanner-style file with a `.d.mts` companion is allowed — the P8-T3 pattern).

## §8 Zero-core / red lines

- No `node:` builtin imports in any `.ts` under `packages/`; no patch-package / pnpm patch / postinstall mutation of upstream; no imports from `references/deepseek-harness-test-use` (upstream) or any upstream private/internal API; no legacy Team SessionEvent vocabulary as vNext authority; no copying legacy `packages/team` sources.
- The P8-T3 frozen contract stays byte-identical: at the end, `git diff c957f1ae18495d2f29948ca19532890cb5724754 HEAD -- packages/remote/src/contracts/ packages/remote/src/handlers/` must be EMPTY (prove it in your post log).
- Everything stays behind the PUBLIC seam (P2-T6 TEAM_REMOTE): anything requiring an upstream source patch → STOP → `CORE_SEAM_BLOCKER:<seam>`.
- No SessionController Team mirror; no session-log-derived Team truth.

## §9 Commits & evidence (on YOUR branch)

1. Design note: `dev/agent-workflow/evidence/P8-T4/design-note.md` — D-1 choice + justification; D-2 surface decision + binding shape; push engine architecture (frame model, generation semantics, pull surface); test-client fixture design (state machine table, backoff parameters + their source in the P2-T6 characterization); page-anchor contract vs the P8-T2 ledger read path; deviations (if any) with justification; acceptance-criteria verification plan.
2. Code commit — all src + test files: `P8-T4: push engine + test client + sync tests (packages/remote)`.
3. Evidence commit — design-note + attempt logs + install.log: `P8-T4: evidence (design-note, attempt1 logs)`.
Keep code and evidence as separate commits (main agent cherry-picks per commit with -x).

## §10 Final report (fixed format — your LAST message)

P8T4_REPORT
verdict: DONE | BLOCKER
base: c957f1ae18495d2f29948ca19532890cb5724754
branch: task/P8-T4-remote-push @ <head-sha>
files: <count; list of owned-path files>
chain: <passed>/<total> (failures <n>) | tsc: contracts=<x> domain=<x> storage=<x> runtime=<x> testkit=<x> remote=<x>
p4t6: 469 -> <469+N>
push-model: <whole projection generation | versioned invalidation+pull> (justification: <one line>)
surface: <frozen surface only | other: <what + why>>
new-tests: <n> (out-of-order <a>, reconnect <b>, duplicate-invalidation <c>, page-anchor <d>, stale-guard <e>, negative <f>)
acceptance: <one line — 新 state 不被旧 response 覆盖; 分页稳定>
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
