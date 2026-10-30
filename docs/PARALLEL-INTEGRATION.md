# Parallel Family Contribution and short-transaction integration (EB4-E)

**State: `DELIVERED` for the rule documentation and the `integration-order.mjs` binding checker.**
Tool: [scripts/integration-order.mjs](../scripts/integration-order.mjs). Tests:
[tests/u7-3-devex/devex-integration.test.mjs](../tests/u7-3-devex/devex-integration.test.mjs).

This page documents the rule from the current plan (U7 bullet, EB4-E, verbatim):

> 并行的 Family Contribution 及短事务集成，分支局部 C2 不能替代合并后的 C2 — two independent
> Family worktrees wire in parallel in non-conflicting semantic regions of `agent-bindings.mjs`/
> `team-tool-plane.mjs`, each runs local real C2; the Integrator merges by short transactions into
> one candidate, re-runs C2 on the shared registration / teardown / authorization chain plus
> cross-tool security negatives; record waiting, conflict repair, CI p95, rework, and Reviewer load.

In English: **branch-local C2 cannot substitute for merged-head C2.**

## 1. Why the rule exists (mechanical, not ceremonial)

`agent-bindings.mjs` and `team-tool-plane.mjs` are shared surfaces. A C2 run on a family branch
measures the tree **without** the other family's contribution. That C2 is real evidence for that
branch, but it does not cover the merged candidate. Two things the branch-local C2 provably cannot
see:

* The other family's registration path going through the governance-center kernel alongside this
  family's (collision, `DUP_FAMILY_ID`, `NAME_COLLISION`, `STALE_GENERATION`).
* The cross-family security negatives: a permission for family A in a world that also has family B
  mounted may allow or deny differently than a world with only A.

The consequence is direct: a Reviewer who accepts a branch-local C2 as the candidate receipt is
accepting a claim about a tree that does not exist yet.

## 2. What counts as evidence, per class

The class vocabulary is the one `scripts/integration-order.mjs` computes per `u5-run-record/1`
binding (field `bindings.teamSha`):

| Class | Meaning | Usable for the candidate? |
| --- | --- | --- |
| `EXACT_MERGED_HEAD` | teamSha IS the candidate — the strongest form | Yes |
| `MERGED_ANCESTOR` | teamSha is behind the candidate (lag N commits) | No — it did not test the candidate; re-run |
| `BRANCH_LOCAL` | teamSha DESCENDS from the candidate (branch-only commits ahead) | **No — branch-local C2, the substitution EB4-E forbids** |
| `UNRELATED` | neither ancestor nor descendant | No — history diverged |
| `NO_TEAM_SHA` | no binding SHA in the record | No |
| `INCOMPLETE_RECORD` | no `overall`, zero cases, or no `finishedAt` | No — not delivery |

Records the scan refuses on size are listed under `NOT GRADED` with their byte count (see §4).

An `INCOMPLETE_RECORD` is important: a C2 run that was started but never finished has `overall:null`
and zero `cases`. That is not "C2 pending" — it is a record with no verdict. It is not delivery.

## 3. The integration order

1. Family A and Family B work in independent task worktrees; each writes to non-conflicting regions
   of the shared surfaces (ARC-A law L1 / L4 governs which regions; see
   [dev/agent-workflow/ledgers/arc-a-protected-center.json](../dev/agent-workflow/ledgers/arc-a-protected-center.json)
   for the digest-pinned protected set).
2. Each family runs real C2 on its own branch. This C2 is `BRANCH_LOCAL` relative to the future
   merged head; it proves the family's own contribution works in isolation and earns the C1 receipt.
3. The Integrator merges short transactions: one family at a time, each as a reviewable PR. The
   short-transaction candidate is the merge commit.
4. The Integrator (or a follow-up) re-runs C2 on the short-transaction candidate:
   * shared registration / teardown paths;
   * authorization chain for the combination;
   * cross-tool security negatives (a tool from family A refusing when family B is also mounted).
   This run is the candidate's `EXACT_MERGED_HEAD` C2. It is what a Reviewer accepts when they
   approve the merge.
5. Record conflict repair time, CI p95, rework rounds, and Reviewer load, per the plan. The WIP cap
   is changed by measurement, not by limiting shared-file authors.

## 4. Checking binding status

```bash
node scripts/integration-order.mjs --target origin/master
# prints one line per C2 record in dev/agent-workflow/evidence/**/
# with its class, suite, and (for MERGED_ANCESTOR) the lag

node scripts/integration-order.mjs --target origin/master --branch <family/branch> [--strict]
# --strict: exits 1 if ANY record is not EXACT_MERGED_HEAD for the target
# "unresolvable target" REFUSES exit 2 — absence is never a clean report
```

Two recorded runs, each quoted only from its own receipt (counts grow as evidence is merged, so the
command is the fact; re-run it for a current value):

| Receipt | Base | Records | MERGED_ANCESTOR | INCOMPLETE_RECORD | NO_TEAM_SHA | NOT GRADED | EXACT_MERGED_HEAD |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [eb4de-receipts.txt](../dev/agent-workflow/evidence/u7-3-20261026/eb4de-receipts.txt) | `94890f090` | 40 | 27 | 11 | 2 | 6 | 0 |
| [eb4c-receipts-r2.txt](../dev/agent-workflow/evidence/u7-3-20261026/eb4c-receipts-r2.txt) | `c5e43f1d5` (pinned) | 45 | 32 | 11 | 2 | 11 | 0 |

Both end on the same rule line, e.g. at the later base:

```text
RULE branch-local C2 cannot substitute for merged-head C2: 32 record(s) do not bind the candidate; 0 do.
```

`NOT GRADED` lists files over the 512 KiB record cap by name and byte count — skipped loudly, never
silently; none of them is a `u5-run-record`.

`BRANCH_LOCAL` is reachable on real commits, not only in the self-test: this branch's own tip is a
descendant of `origin/master`, and a record bound to it classifies as `BRANCH_LOCAL … ahead of the
candidate by N commit(s)` (the receipt records the SHAs and N of the run). A record bound to a family branch reads exactly like that against the
merged head — which is why the class exists.

The fact that 0 records are `EXACT_MERGED_HEAD` at the current master head is the correct reading:
the prior-lane C2 evidence bound earlier SHAs, which are now merged ancestors. **This is not a red
for those lanes** — their C2 ran on the candidate for THEIR merge. It becomes a red only for a PR
that claims the evidence covers THIS tree.

What it reads: the run records **committed** at the checkout's `HEAD` (`git ls-tree` + one
`git cat-file --batch`), never the disk. Untracked files and uncommitted edits do not change the
result; the `LIMIT` line names the commit the evidence was read at.

Bounds (declared): ≤ 200 **run records** graded (non-record `.json` costs one read and no budget),
≤ 4000 candidate `.json` blobs, each ≤ 512 KiB, ≤ 40 rows per class, stdout ≤ 24 KiB, no child
process beyond `git`. Measured at `f3f415aa0`: 174 tracked `.json` under the evidence root, 50 of
them `u5-run-record/1` records, so 200 is 4× headroom. **A bound hit is a refusal** (`BOUND HIT …
REFUSED`, exit 2, no class counts, no `RULE` line): a partial corpus is never printed as an audit.

PR #394 shipped a disk walk that spent a 400-file budget on every `.json` in name order and printed
the partial report with exit 0. In the main checkout at `f3f415aa0` (505 `.json` on disk, most of them
untracked) it graded 24 of the 50 committed records. The two receipts in the table above were taken
by that version; their counts are its reading, not this one's.

Most `NOT GRADED` entries are vitest census captures under
`dev/agent-workflow/evidence/a4-pr7/ci-gate/scratch/` that are **tracked at master**, although that
directory's own
[UNTRACKED-SCRATCH.md](../dev/agent-workflow/evidence/a4-pr7/ci-gate/scratch/UNTRACKED-SCRATCH.md) says
such captures are "not to be committed". At `c5e43f1d5` there are 18 of them (9 `census-*` +
9 `census-comparison-*`, 32.1 MB), added by U7-6 `d41168bd0` (6 files) and `0b6ce0213` (2), U7-4a
`f6a119736` (6), and the U7-4a merge `30ed4ec0b` (4); U7-6 `4cbf414f6` un-tracked two others that had
been swept in the same way. The count grew while this page was being written, which is the point:
nothing stops it. This branch neither adds nor removes any of them. Here they only cost a
`NOT GRADED` line; whether they stay in git is the evidence owner's (EB4-A) call, not this checker's.

**Update 2026-10-27.** The nine raw captures were un-tracked in PR #396, and "nothing stops it"
no longer holds. The census leg now writes raw captures and re-samples to the gitignored
`.artifacts/census/` and keeps only the `census-comparison-*` sidecar in `scratch/`. A
`ci-integration` leg, `scripts/eb3-evidence-guard.mjs --new-since "$CI_BASE"`, refuses a PR that
adds a raw-capture or resample name under the evidence root. It also refuses a PR that adds a
file over 1 MiB there, unless `dev/ci/evidence-large-allowlist.json` lists it with a reason.

## 4a. Shared registries a family lane must not edit (u7-w0, 2026-10-26)

Measured over the 7 merged U7 PRs, the conflicts that forced a master re-merge and a census rerun
came from append-to-a-shared-list registries, not from protected-center files. u7-w0 turned four of
them into per-lane drop-in directories that are collected by enumeration. A family lane now ADDS a
file to each one it needs and edits NO shared list:

| Registry (before) | Drop a file into | Collected by | C1 controls |
| --- | --- | --- | --- |
| `SCANNED_PATHS_<LANE>` arrays + sum/presence/tie sites in `packages/testkit/test/p4t6-session-event-scan.test.ts` | `packages/testkit/test/p4t6-bookings/<lane>.json` (`{lane, paths, expectedDelta, reason}`) | `p4t6-bookings/load-bookings.mjs` — exact total = base + Σ paths, double-booking, absent/retired paths, ties | the p4t6 suite's `ledger sensitivity` block |
| `PLACEMENTS` array in `scripts/place-dist-glue.mjs` | `scripts/dist-placements/<NNN>-<family>.json` (the prefix is the order) | `loadPlacements()` in the same script (mirror law, no duplicates, glue first) | `tests/checks/dist-placements.test.mjs` |
| node-globals `files` list in `eslint.config.mjs` | `scripts/eslint-node-globals/<NNN>-<family>.json` (patterns) | `nodeGlobalsPatterns()` in the config | `tests/checks/eslint-node-globals.test.mjs` |
| World-kind wiring in `tests/world-factory/lib/world-factory.mjs` and suite wiring in `u5-canary-runner.mjs` | `tests/world-factory/world-kinds/<NNN>-<kind>.mjs`, `tests/world-factory/suites/<NNN>-<suite>.mjs` | `lib/world-kinds.mjs`, `lib/suites.mjs` | `tests/world-factory/registries.test.mjs` |

Two shared surfaces remain, deliberately:

* `dev/agent-workflow/ledgers/arc-a-protected-center.json` (the center-override ledger). It is
  supposed to be rare, and u7-w0 left its semantics alone.
* `packages/runtime/src/plugin/live/team-tool-plane.mjs`. **No rule saying "an ordinary family PR
  must not edit the plane" is enforced, because none can be met today.** The plane has no generic
  family mount seam. Each family is imported by name, registered by its own
  `registry.register(<x>Contribution)` call, given its own `ensure<X>ApprovalEntry`, and switched by
  its own `centerKernel.families.<x>` flag (`team-tool-plane.mjs` ≈ :2045–2131, :2255–2371,
  :2528–2610 at `88107ad71`). U7-9a had to add 230 lines there. ARC-A fitness also classes the
  plane as NOT protected on purpose: `isProtectedPath('…/team-tool-plane.mjs') === false` in
  [u6-arc-a-fitness.test.ts](../packages/runtime/test/u6-arc-a-fitness.test.ts). §1 above also
  still describes families wiring "in non-conflicting semantic regions" of it. Lifting this needs a
  generic plane mount seam from the named Center-Owner product PR (w0b). Until that lands, the plane
  remains the one shared file a governed-family lane touches, and §3's short-transaction order
  applies to it.

## 4b. The per-tool acceptance ledger — "definition passes" is not "it ran" (2026-10-27)

PR #404 merged with its live C2 RUN record at `overall: FAIL` (3 PASS / 3 FAIL —
`u7f:inspect-list`, `u7f:refusal-zero-effect`, `u7f:approval-leg`) while every CI layer was green.
The green was honest about what it measured; the problem was that **nothing machine-checked the
distance between "this family's Definition is structurally right" and "the real positive effect ran
on a Host"**, so "structurally correct but not running" families accumulate behind a green tick.

`dev/agent-workflow/ledgers/u7-tool-acceptance.json` (schema `u7-tool-acceptance/1`) records that
distance per tool, and [scripts/eb3-tool-acceptance.mjs](../scripts/eb3-tool-acceptance.mjs) grades
it as a declared `ci-integration` leg. One row per model-visible tool name claimed by a family in
[packages/tools/families/manifest.json](../packages/tools/families/manifest.json) — read through the
plane's own name domain, so a configurable spelling (`cap.names.bash`) claims BOTH `team_bash` and
the `bash` native takeover the Gate 0b ledger admits — plus the named-bridge jobs trio. Four levels,
each `PROVEN | DISCLOSED | NOT_VERIFIED`:

| level | PROVEN means |
| --- | --- |
| `L1-definition` | the family's C1 suite exists, is committed, and names the tool (`evidence.suite`) |
| `L2-mounted` | a live Host mount put the tool on the placement feed (`evidence: {record, case}`) |
| `L3-refusal` | a live typed refusal ran with zero effect (`evidence: {record, case}`) |
| `L4-positive` | a live authorized call whose REAL effect was read back (`evidence: {record, case}`) |

The rules, and what each one exists to stop:

* **A family PR adds or updates its ledger rows in the same PR.** A tool a manifest family claims
  with no row is `ACCEPT_ROW_MISSING`; a row for a tool nobody claims is `ACCEPT_ROW_STALE`; a row
  naming the wrong family is `ACCEPT_ROW_FAMILY_MISMATCH`. The claim set is derived from the
  manifest every run, so a new family cannot land ungraded by forgetting to edit a list.
* **A `PROVEN` level must cite a committed `u5-run-record/1` RUN record's case at `PASS`.** A missing,
  untracked, unparseable, unfinalised (no `overall`/`finishedAt`) record, a case the record does not
  contain, and a case the record grades anything but `PASS` are all `ACCEPT_PROVEN_UNBACKED` — the
  #404 shape, where the record said FAIL and the merge went green. **No level is PROVEN on prose.**
* **A `DISCLOSED` level must carry the verbatim `reason` and the `pr`** (`ACCEPT_DISCLOSED_UNREASONED`);
  when it names a `source`, that file must contain the reason word for word
  (`ACCEPT_DISCLOSED_UNSOURCED`). A hedge with no disclosure behind it is a silent NOT_VERIFIED.

**The merge gate is that the rows are HONEST, not that they are complete.** `DISCLOSED` and
`NOT_VERIFIED` never fail the leg — the PR #404 lesson is that an unproven arm must be *sayable*, and
a gate that refuses to merge until every tool is live-proven would be met by re-labelling, which is
exactly the failure being fixed. Completeness — every `L4-positive` `PROVEN` — is the **G5 release
gate**, tracked by the summary line
`EB3-TOOL-ACCEPTANCE pass tools=N L4-proven=K L4-disclosed=D L4-unverified=U` and by
[TOOL-CAPABILITY-MATRIX-9b2](./plans/active/alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md).

The checker is negative-controlled in
[scripts/eb3-ci-negative-controls.mjs](../scripts/eb3-ci-negative-controls.mjs) (C20): a PROVEN level
citing a FAIL case, one citing a missing record, a claimed tool with no row, and a DISCLOSED level
with an empty reason are each refused on a mutated in-memory copy of the real ledger.

## 4c. Deferring `ci-full` on intermediate fix-round pushes

A fix round costs 2–4 pushes of 15–20 minutes of `ci-full` each. An intermediate fix-round push may
set the PR label `ci-defer-full`: the `ci-full` caller in `ci-required.yml` is then skipped, and a
separate non-required job `ci-required-deferred` grades the other layers. The `ci-required` job is
never skipped and still needs `ci-full`, so a deferred run is **red** on `ci-required`: **a deferred run
cannot satisfy branch protection.** The head you freeze for review MUST run with the label removed and
the full aggregate green. `CI_DEFERRAL_CONFLICT` reds a head that shows both the label and a
`ci-required` success (controls C21, C22).

## 5. What this does not answer

* Whether any C2 run PASSED its own lanes (a binding check, not a lane-verdict check).
* Whether the protected-set is drift-free on the candidate (that is the L1 scan in
  [ARC-A fitness](../packages/runtime/test/u6-arc-a-fitness.test.ts)).
* Whether the cross-family security negatives were exercised (the Integrator's obligation, not
  statically checkable from the binding alone).

## 6. Related

* [DIAGNOSIS-CALL-CHAIN.md](./DIAGNOSIS-CALL-CHAIN.md) — attributing a refusal that appeared during
  a cross-family authorization run.
* [RELEASE.md](./RELEASE.md) — the release promotion procedure that requires the candidate tuple.
* [dev/agent-workflow/ledgers/arc-a-protected-center.json](../dev/agent-workflow/ledgers/arc-a-protected-center.json)
  — the digest-pinned protected-center set that governs what a family-addition PR may not touch.

## 7. 受控三工作流 WIP 制度（用户直令，真实 UTC 2026-10-30；本节随合并即时生效）

**依据**：用户 2026-10-30 直接指令（机器迁移接管轮）批准 Alpha.5 调整为**最多三条活跃工作流**；
事实基础 = PR #495 的 XVAL 受控并行试验（其完整原始收据随该 PR 入册，语义 = **NO ACCEPTANCE
CREDIT**；其 3 次真实 Host starts 由 C1 划转 C4 机动与故障归因池，登记行 = BOOT-BUDGET C 册 C4
更正行，随该 PR 入册——预算数字唯一登记处是该册，本节散文不独立记账）。本节从属于用户直令与
既有门禁：除转写用户直令外**不覆盖、不修改任何门禁、预算或安全语义**；它是 WIP 上限与资源互斥
规则的正式化，**不**新建工程权威、总计划或调度框架；EB4-E 绑定律、§4a drop-in 注册表、settlement
法（ROUTER_RULES §8.5）、boot 预算册全部照旧适用。

**三条工作流（槽位上限 3，不是任务配额）**：

| 流 | 范围 | 备注 |
| --- | --- | --- |
| **A 产品功能** | `read_image` 正式实现与真实正向验收；UI `ask_user_question`/`present` 产品接线与负控；`web_search` Provider；其他未完成的必交工具 Family | 按源码所有权与依赖分派；多个 writer 禁同时改相同安全接口 |
| **B 真实 Host 验收** | Agent Control 剩余 L3/L4 复证；已完成 Family 的真实 C2；固定候选跨 Family 集成；权限拒绝/实际副作用/重启/取消/身份归属 | 仅当生产接口已证 + C1 预检完成后才消耗真实 Host starts |
| **C 工程与测试基线** | R-413-1 定时测试稳定性；R-G4R-1a / R-ORACLE-1 技术缺口；CI 影响面、候选来源摘要、Oracle、RUN 绑定；门禁与证据治理改进 | 目标 = 移除交付阻断；不得扩张为独立于产品开发的文档建设项目 |

**主 Agent = 唯一 Integrator**：维护 READY / RUNNING / REVIEW / INTEGRATING / BLOCKED 状态；优先派发
互不阻塞任务；调配共享接口所有权；组织审查与短事务集成；管理 boot 预算、当前候选与最终 Gate；
汇总真实进度。**等待不冻结全局**：一个工作包在等外部 CI / Reviewer / Host 时，主 Agent 继续推进
其它 READY 工作。若 harness 无法提供三个真正独立的执行体，不制造虚假并行，如实披露实际并行度。

**并行资源互斥规则**（XVAL 实测支持的边界 + 未测项取保守默认；在新环境完成实测量测前保持有效）：

1. 同一时间最多一个重型 CPU 套件。
2. 同一时间最多一次真实 Host 启动；不同 World 可在已证明安全的条件下同时驻留。
3. 重型 Vitest 与真实 Host 的**启动阶段**未经独立验证不得重叠。
4. 同一 Host 树的 build 与 test 必须互斥（防读取改写中的 dist）。
5. 不同 worktree 使用独立 Home / Workspace / 日志 / 测试产物，共享同一端口租约根。
6. 共享可写 pnpm store 的并发安装未经试验，保持串行或显式隔离。
7. 计时敏感测试保留独立运行窗口；既有真实负控与失败判据不得削弱。
8. 每次真实 Host start：预登记、候选绑定、预算计数、收据、清理，缺一不可。

**并发上限的扩张**只由新环境上的实测性能数据支持：普通 CI/单测（C1 测试层）并行度可依实测自主
调整——boot 各池额度不因本节改变，仍由 BOOT-BUDGET C 册管辖；更高风险的 Host 并发启动须先完成
独立 PoC 并取得必要授权。不为重复证明已成立的 XVAL 结论再做大规模试验。

**效率度量（每个工作包必记，用于反馈而非表演）**：1 READY→开始实现等待；2 实现→审查完成；
3 审查完成→合并；4 完整 CI 等待时长；5 无效 CI 重复次数；6 合并冲突与修复轮数；7 新增有效
L3/L4 验收格；8 每个有效 C2 结果消耗的 Host starts；9 共享接口/资源争抢/测试不稳定造成的等待或
返工。成功标准 = 真实交付墙钟时间下降与有效验收产出上升；**不得**以 PR 数量、模型轮次、测试
总数、活跃进程数或 CPU 利用率单独证明提效。
