# review-LaneE — PR6 PoC6a/PoC6b 独立审查（Lane E，≠writer）

- 审查者 = Lane E 独立 reviewer（qwen3.8-flash-next；模型/harness 分列；与 writer 非同一会话）。记录日（UTC，本机钟）：2026-10-16T17:2xZ。
- 对象 = `origin/alpha5-pr6-ptclsp` @ `76780bb654f621b261d777411edd4a65b7f8c03d`（base `db5cb5f7`；勘查件，DORMANT）。
- 复现环境 = 一次性 worktree `.worktrees/a5p6-rev-e`（审查后回收）；Host T = pristine 0.2.0-rc.2 @ `639ed01539`（porcelain 前后均空，只读）；端口 3183 / 世界 `a5p6-rev-*` 分配后**未使用**（runner 无端口、无 DSH_HOME 世界——与 writer 记录一致，实测无 318x 监听）。
- 契约基准 = INTERFACES-v1.md @ `b0d636eb` C-GW/C-PROC；分叉判据 = `alpha5-s0-pr0-pr8-implementation-plan.md` §9（PoC-6a/6b 三分支原文）。

## ① PoC6a 三态可复现性 — 复跑 EXIT=0，9/9 绿，三态逐项一致

`node p6a-runner.mjs` 复跑（同 pinned T）：**P6A-1 SUPPORT(session 粒度) / P6A-2 SUPPORT / P6A-3a SEAM-GAP / P6A-3b SUPPORT(组合) / P6A-3c SEAM-GAP(负控) / P6A-4 typed-reject / P6A-5 SUPPORT / P6A-6 SUPPORT**。侧重跑三条 SUPPORT：

- **内层归属双 member 并发零交叉**：体内重叠见证先于任何 exit（`bodies_overlapped=true`），enter 身份 `member-A/p6a-c4:ptc:1`、`member-B/p6a-c5:ptc:1` 互不漂移；两 session 日志 foreign roots=0。注入源实测=pinned `packages/core/tools/src/ptc.ts:545-553`（`subCallId=`${callId}:ptc:n` + rootCallId + agent + parent=exec.token），durable append 在 :612-618。
- **组合 seam（tools/execute around-listener + ALS + ctx.ptcRuntime 替换）并发精确关联**：4 交错并发（含同 member 双发），binding 时刻 ALS(callId) ↔ body 观测 subCallId 前缀配对 **4/4 ok** 且 member 一致；ALS 与 root dispatch 真值表一致（非循环验证=独立通道 subCallId 前缀，非返回文本）。
- **外层 guard typed-reject run=0**：B 被拒（typed reason 到模型，isError 结果），`runtime.run` 计数=1 且仅 A 的 run 到达；guard 短路实测=index.ts:1519-1530（deny → post-result，body 之前）。

**SEAM-GAP 代码面自证（非断言）**：pinned `packages/ptc-runtime/ptc-runtime/src/types.ts:73-98` `PtcRunRequest` 全字段闭集 = `{program, bindings, cwd?, timeoutMs?, sandboxPolicy?, signal?}`（`PtcRunSpec` 仅补全 cwd/timeoutMs 必填），**无任何 agent/member/callId/owner/grant 字段**；与运行时实测 spec_keys（6 键，identity=∅）及 3c 负控（同 member 两并发 spec 深相等=true）三方吻合。结论"spec 自带精确 Grant 分支不成立"有代码面支撑。

## ② PoC6b — 复跑 EXIT=0，10/10 绿 + 反例探针未翻案

`node p6b-runner.mjs` 复跑：**P6B-1 HAZARD 对照复现**（同 pid、opens=2）/ **B2b 每 realm 私有池 pid 互异**（49/58/根 40，realm 内 opens 各=1）/ **B2c dispose 只杀本 realm**（A 死、B 热 pid 不变、根存活）/ **B5b stubborn（忽略 shutdown）terminate 有界**：dispose await 1216ms 后 pid 消失（预算=shutdownTimeoutMs 1200→SIGTERM→SIGKILL；teardown 代码实测 `lsp-stdio/src/instance.ts:267-301` "awaiting process close so nothing outlives disposal"）/ B5a cancel≠terminate 重生新 pid / B5c settled 边后 `LSP_NO_PROVIDER` 形态（错误码面不分型=已披露 residual，同意）。

**反例探针（reviewer 自写 `probe-rev-e.mjs`，同 T 同 hook；4/4 AS-DOCUMENTED）**：

| 探针 | 结果 | 含义 |
| --- | --- | --- |
| CEX-1 第四 realm 不重装直接 query | `LSP_UNAVAILABLE`，pid=-1（不回退共享池） | 池隐私比文中机制描述更保守：`isolate('lsp')` 即换 root，未装 provider 的 realm **fail-closed**，不存在"忘重装=悄悄共享根池" |
| CEX-2 真·第四 realm（全重装）+ 只 dispose 它 | 新 pid 66 与 根/A/B 互异；dispose 后根/A/B 热 pid 全存活 | 注入第四 realm 不引发跨 realm 键碰撞；"dispose 只杀本 realm"在 n=3 时仍成立 |
| CEX-3 跨 realm 借池尝试（realm 只装 Lsp 不装 stdio） | `LSP_UNAVAILABLE`（typed），根池仍热 | 公开面无跨 realm 借用/池重定向通道 |
| CEX-4 query 注入 `policy/policyGeneration/trustRoot/caller` 杂散字段 | pid 不变（39/39），`Lsp` 公开面仅 `registerProvider/query` | 池键无策略输入通道实证；池键=fs `target.targetKey`（`lsp-stdio/src/index.ts:274-276` + `host.ts canonicalizeWorkspace` 纯路径解析） |

⇒"池键纯路径、无 policy/generation/trustRoot 通道 ⇒ realm=公开面最细隔离粒度"结论经受反例检查；B4 SEAM-GAP(policyGeneration 逐出) 记录为真缺项。

## ③ 结论措辞 vs S0 §9 — 不越权

- **PoC6a=中间分支成立** 与 §9 三分叉原文对齐（"只可可信固定 Realm Policy→支持该窄固定策略、one-shot 额外范围拒绝"）；A4 明确"无法证明 per-call 分支不成立"仅指组合 seam 的**关联能力**，且附三条装配纪律（同步段依赖复测、frozen bindings 须重建、ALS 缺失 fail-closed）+ "启用 Strict 仍需 D3/D5 OS 强制（NOT_RUN）"限定。无"隔离已成立/PR6 可 GO"级语句。
- **PoC6b=第一分支通过（每 Member 持久池可建），条件=每 member 一 realm、generation 逐出缺口挂账、禁共享池改名复用**——与 §9 第一分支"通过→每 Member 持久池+**有条件**启用"对齐，且逐条保留 §9 的"原生共享池绝不能改名复用冒充隔离"红线。全表三态词汇 = seam 能力面，无产品启用宣称。NOT_RUN（真实语言服务器、外层 OS 强制）如实挂账。
- 注意：§9 原文要求池键"至少含 (Member,Realm,Provider,Workspace,PolicyGeneration)"——writer 未冒充满足该设计，而是在 B4 记为上游扩展点缺项 + 以"每 member 一 realm"条件替代，处理正确。

## ④ 合规检查 — 全过

- **共用文件零命中**：`git diff --name-only db5cb5f7..76780bb6` = 10 文件，全部在 `dev/agent-workflow/evidence/alpha5/pr6/` 下；根 registry / live glue / tsconfig / barrel / scanner 零触碰。
- **token**：diff 全文 grep 无 token/secret/key 值（仅 `exec.token` 字段名）；无 :3080 启动 token 泄入。
- **:3080 只读**：审查全程仅一次状态 GET（→401，与操作前一致），无任何操作。
- **T 完整性**：两次复跑 + 探针前后 porcelain 均空、HEAD=`639ed01539` 不变。
- **端口/世界**：3183 分配未用、`a5p6-rev-*` 无世界创建（PoC 性质使然，如实记录）；`ss` 无 318x 监听。
- 复跑改写了本 worktree 的 `p6a/p6b-result.json`（时间戳/pid 漂移属预期，判定逐腿一致；committed 证据文件本身未动、未提交复跑件）。

## 发现（severity）

- **MINOR-1（措辞）**：SEAM-VERDICTS.md/README.md 写"记录日 2026-10-19"，但 committed result json `recorded_at_utc` 与 commit 时间均为 **2026-10-16**。建议改为 2026-10-16（纯文档，不影响证据）。
- **MINOR-2（引用行漂移）**：`ptc.ts:525-536` 实际在 pinned src 的 **545-553**（`611-618`/`391`/index.ts 各处逐行命中）。内容属实，建议修线号。
- **INFO-1（增强披露建议）**：CEX-1 显示未重装 realm 是 typed fail-closed（非静默回退），可在 B2 加一句强化"重装纪律"的安全叙事。
- **INFO-2**：B5c 错误码面不分型（同 `LSP_DISPOSED`）已被 writer 主动记为 residual——同意其"若 Gate 要求错误面分型则属上游小缺口候选"的定性。

## 判定

**G-d 集成会话：可**（对应 ROUTER_RULES §3.2 = 通过级：证据充分 + 可复现 + 无越权措辞）。条件：

1. 保持 DORMANT：本 branch 产物不得被集成会话接进装配/registry（集成时按 INTERFACES-v1 只由集成 owner 动共用文件）。
2. 两处 MINOR 措辞修正（记录日 / ptc.ts 行号）并入下一 commit（文档性补充）。
3. PR8 矩阵/门材料必须逐字携带三条限定：PoC6a 启用 Strict 仍以 D3/D5 OS 强制实证为前置；PoC6b"第一分支通过"仅随"每 member 一 realm + generation 逐出缺口挂账 + 禁改名复用"三条件成立；B5c 错误码面分型 residual 与 ptc-runtime 身份字段 SEAM-GAP 作为上游缺口素材入册。
4. 集成会话若引入新装配路径，须重验 A4 residual(i)（listener→body 同步段结构依赖）。

## 复现与回收

```bash
cd <worktree@76780bb6>/dev/agent-workflow/evidence/alpha5/pr6
node p6a-runner.mjs   # EXIT=0, 9 legs（本次 17:23Z）
node p6b-runner.mjs   # EXIT=0, 10 legs（本次 17:24Z）
# 反例探针 probe-rev-e.mjs 全文见本文件 git 历史外副本；机制=p6-hook+同 T，四断言见上表
```
回收：一次性 worktree `.worktrees/a5p6-rev-e`（含探针 scratch）审查后删除；df 行（回收后）见下。:3080 全程未触碰（仅 401 状态确认）。

*Appendix — 反例探针脚本（节选核心断言；完整脚本与 result json 随审查会话留档，未入库）：四 probe 分别断言 CEX-1 未重装 realm query 失败且无 pid；CEX-2 第四 realm pid ∉ {root,A,B} 且 dispose 后三池热 pid 不变；CEX-3 只装 Lsp 的 realm query=typed no-provider；CEX-4 杂散策略字段注入后 pid 不变 + Lsp 原型面 = {registerProvider, query}。*
