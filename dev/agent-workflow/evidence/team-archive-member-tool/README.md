# team-archive-member-tool — Leader 生命周期工具补全轮（2026-09-21）

用户指令：「请你补充这个工具，完成测试，随后提交PR并解决合并冲突，等待我的审查」。
起因 = 前两轮问答（member 生命周期 5 态确认 + 「插件是否向 leader 暴露将 member 状态切换为
archived 的工具？」→ 否：leader 模型面 = 封闭 12 工具，archive 仅存在于 remote 端点
`member.archive`（UI/人类通道）+ runtime 动作 `archive-member`）。

## 1. 范围

- 新工具 `team_archive_member`（第 13 个封闭 team 工具，注册于目录末尾 — 前 12 个注册序不变，
  `teamTools` 选择索引不受影响）。
- 工具层 LEADER-ONLY（C1 leader-gate 先例）：非 leader caller → `TEAM_TOOL_ARCHIVE_NOT_LEADER`
  （guard consult 与任何 effect 之前）。
- 工具体 = `executeGuarded`（SD-GUARD 末端守卫，correlation = requestToken，
  actionName = `archive-member`，toolName = `team_archive_member`）+ `performRuntimeAction`
  facade `archive-member`（→ action-router → 生命周期 FSM → commit port →
  `member-lifecycle-changed` fact）。
- 不改冻结 action registry（不加 roles — 会破坏人类 UI 通道）；client/UI 不动
  （`member.archive` 保持人类通道；本轮不做 restore/dispose 工具）。

## 2. 文件

| 类别 | 文件 |
| --- | --- |
| 源 | `packages/tools/src/tools.ts`（archiveMemberSpec + 注册 + 头表）、`packages/tools/src/tokens.ts`（TEAM_TOOL_ARCHIVE_NOT_LEADER）、`packages/runtime/src/plugin/root.ts`（注释） |
| 新测试 | `packages/tools/test/archive-member-tool.test.ts`（A1–A9，module-level await + 同步 it） |
| pin 更新 | p4t6 727→728（+1 scannable，DEC-1 先例）、p6t6-bypass-scan（EXPECTED_TOOL_NAMES 13）、p8s5a（toolsCount 13）、d1/t4a/tcm-d4/t12a（13 工具词表）、c1-list-pending-control（toHaveLength 13）、multi-mcp-wiring + mcp-blueprint-initial-grant（注释） |
| 文档 | `.agents/skills/team-leader-operations/SKILL.md`（thirteen + 表行 + 语义段）；`team-blueprint-authoring` 未改（无封闭工具清单） |
| 卫生 | `.gitignore`（`tests/dsh-homes/` — 用户指令 DSH_HOME 落点，永不提交） |
| dist | `packages/runtime/dist/...` 10 文件（root.js 注释 + tokens/tools 新代码 + .d.ts/.map；client bundle 零变更）— 源与 dist 同提交 |

## 3. 测试矩阵（A1–A9，9/9 绿）

| 场景 | 断言 |
| --- | --- |
| A1 catalog | 13 个工具；`team_archive_member` = 第 13（末尾）；参数封闭（3 必填、additionalProperties:false） |
| A2 guard pending | leader-approval 门（exact scope，correlation=token）未决 → `blocked/request-pending`，零 commit，目标仍 SETTLED |
| A3 decision-deny | 同 token 重试 → `blocked/decision-deny` |
| A4 allow | 首执行 `executed` + `lifecycle-changed` SETTLED→ARCHIVED + durable ARCHIVED + fake commit port 恰好 1 次 ARCHIVE（真 repository CAS）；同 token 重试再 blocked（一次性 allow 已消费 ∧ archived 目标不再 guard-live — liveness 判定最终，实测 target-stale 先于 consumption 判定）— 无第二次 commit |
| A5 RUNNING 目标 | `rejected/LIFECYCLE_TRANSITION_REJECTED`（P6-T2 默认布线无 RUNNING→ARCHIVED 边；生产行 = P7-T3 quiesce settle-then-archive，Architecture §30），零 commit，仍 RUNNING |
| A6 已 ARCHIVED 目标 | `blocked/target-stale`（guard live 集 = CREATED/RUNNING/SETTLED），runtime 未被调用 |
| A7 member caller | 归档他人 + 归档自己均 `rejected/TEAM_TOOL_ARCHIVE_NOT_LEADER`，零副作用 |
| A8 DISPOSED 目标 | `blocked/target-stale`，零 commit |
| A9 缺 targetInstanceId | `rejected/TEAM_TOOL_BAD_ARGUMENTS` |

## 4. 环境（用户指令：用工作区内源码 + DSH_HOME 落 tests/dsh-homes）

- worktree `node_modules` 原为空；pnpm store 在工作区外（`~/.local/share/pnpm/store/v11`，
  workspace-write 不可达；升级权限被用户拒绝）→ 以**绝对符号链接把主工作区 4 个
  node_modules（root / packages/client / packages/domain / packages/runtime）镜像进
  worktree**（全部工作区内；仓库源码全相对 import，唯一 name-based import 文件为静态
  扫描的负例测试 → 镜像安全；零网络、零 store 访问）。
- live-bridge 的 DSH 测试源码本就解析自 REPO_ROOT（主工作区）
  `tests/deepseek-harness-test-use` @ `fb2c4b9e69`（pristine，工作区内）。
- `tests/dsh-homes/` 已建（gitignored），测试轮 `DSH_HOME=<worktree>/tests/dsh-homes`。
- 本轮纯 in-process 单元测试：无 real-host 运行、无 live DSH 实例、:3080/:3180 zero-touch。

## 5. 门禁实数

| 门禁 | 结果 |
| --- | --- |
| typecheck（9 包） | 全绿 |
| `pnpm build` + `build:composition` + `check:artifacts` | **OK 1132**（dist 漂移 10 文件同提交入库） |
| 全量 `pnpm test` | **20 failed \| 3730 passed (3750)**（`full-suite/post.log`）— 失败集与基线（mcp-initial-grant `rebase-pr24-post.log` 20 failed \| 3721 passed (3741)）**逐项 diff 为空**；3730 = 3721 + 本轮 9 新增全绿 |
| p4t6 | **@728 10/10** |
| `pnpm lint`（改动文件） | 零发现；仓内 48 errors/2 warnings 全部 pre-existing（multi-mcp-wiring:463 为 base 未改动行，git show HEAD 实证） |
| zero-core | test-use porcelain 空 @ `fb2c4b9e69`；references 冻结锚点未移动；:3080/:3180 zero-touch |

## 6. 基线失败集（20 项，预存，非本轮引入）

10 个文件：t1-capability-schema(9) / p7t6-teammates-adapter(1) / t2-blueprint-hash(1) /
p6t3-restart(2) / p6t3-mediation(5) / p6t6-actions(1, messaging worker→leader) /
d3-member-identity-context(1) + 3 个 file-level env class（t12a-b2-child-identity /
t12a-glue-handoff-ports / p8s3b-result-effects — worktree 环境缺 live-host 依赖类）。

## 7. 审查修复轮（2026-09-21，PR #25 补充审查）

用户审查三个 finding（不重设计、不扩范围）：

| Finding | 关闭方式 |
| --- | --- |
| 1. selective Blueprint 下的工具暴露语义 | **F1.1** `.agents/skills/team-blueprint-authoring/SKILL.md` 新增 §5.4（lifecycle tool：`teamTools` 只管模型面 exposure；Leader effective envelope 还必须允许 `archive-member` token；二者缺一不可；已创建 Team 用 frozen Blueprint snapshot；插件升级不自动注入新工具到既有 selective Team；旧设计要获得该 surface = 新 blueprint revision + 新 TeamSession 绑定；禁止绕过 frozen snapshot / runtime 动态 patch）。**F1.2** `t4a-capability-wiring.test.ts`：CAPABILITY_BLUEPRINT 的 Leader allow 增 `team_archive_member`（create/resume 两相位断言同步）+ 新 it「lifecycle tool surfaced ONLY because its template allow list names it」（catalog 含之 ∧ Leader surface 含之 ∧ member A surface 不含 ∧ member B surface 不含 — 无隐式自动授权）。 |
| 2. Tool → production P7-T3 RUNNING archive 组合测试 | **F2** `archive-member-tool.test.ts` 新增 B1/B2（同一文件，module-level await，复用 p7t3-helpers 的 P7-T3 假件族 + P7-T3CommitFake 真 repository CAS — 不重造第二套 lifecycle 实现；`createP6T2Runtime` 测试 helper 增可选 `lifecyclePorts` 透传 = 生产 root 的 P8-S3 R7/CR-9 接线）：**B1** 真实 `team_archive_member.execute(...)` 对 RUNNING 驻留成员 → `executed` + `lifecycle-changed` effect（from RUNNING → to ARCHIVED）+ durable ARCHIVED（activityVersion +2）+ commit port 恰好两次 CAS（#1 RUNNING→SETTLE→SETTLED，#2 SETTLED→ARCHIVE→ARCHIVED，expectedActivityVersion 链式）+ clock 顺序 = 五步 quiesce（admission.close / activity.interrupt / descendants.drain / residency.drop）先于两个 commit + 驻留句柄释放；**B2**（optional 项已做）interrupt 步注入故障 → `rejected/LIFECYCLE_LIVE_EFFECT_FAILED` + 零 durable commit + 仍 RUNNING + residency 未释放（clock 停在 admission.close + activity.interrupt）。A5（P6-T2 默认布线 FSM 拒绝）保留未删。 |
| 3. Leader skill 措辞 | **F3** `.agents/skills/team-leader-operations/SKILL.md`：archive 条目改为准确 quiesce 语义（SETTLED: quiesce → one durable ARCHIVE commit，"direct" 仅指无中间 SETTLE transition；RUNNING: quiesce → durable SETTLE → durable ARCHIVE，两次 durable commit）；"Like every work operation on a well-formed instance" → "Like other guarded instance-targeted mutations"（`archive-member` 属 LIFECYCLE 类，非 WORK）。 |

### 7.1 门禁实数（审查修复轮）

| 门禁 | 结果 |
| --- | --- |
| focused | archive-member-tool **11/11**（A1–A9 + B1 + B2）+ t4a **28/28**（+1 新 it） |
| typecheck（9 包） | 全绿 |
| `pnpm build` + `build:composition` + `check:artifacts` | **OK 1132**（本轮仅测试文件 + 文档改动 → dist 零漂移，无需重建入库） |
| p4t6 | **@728 10/10**（未新建 scanner-visible 文件 → pin 不变，按实跑确认） |
| `pnpm lint`（改动文件） | 零发现（仓内 48 errors/2 warnings 仍全部 pre-existing） |
| 全量 `pnpm test` | **20 failed \| 3733 passed (3753)**（`full-suite/review-round2-post.log`）— 失败集与 PR #25 round-1 基线（`full-suite/post.log`，20 \| 3730 (3750)）**逐项 diff 为空**；3733 = 3730 + 本轮 3 新增全绿（B1/B2 + t4a 新 it） |
| zero-core | 未触 upstream/test-use/references；:3080/:3180 zero-touch（纯 in-process） |

### 7.2 范围纪律

无 lifecycle FSM / action registry / Remote / UI / DSH upstream / TeamDomain schema /
stop-priority / wake-up 改动；无新大型 real-host kit；无 Blueprint 自动迁移；
无 team_restore_member / team_dispose_member。生产 lifecycle 代码零改动
（测试真实发现 = 无 bug：生产 P7-T3 行经 tool 面闭环全绿）。

