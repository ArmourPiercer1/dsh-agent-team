# Alpha.5 P0 — 路线选择报告（PoC，非产品 GO）

> **状态：EXECUTED-PARTIAL / P0 NOT CLOSED。** 本报告记录 2026-10-16 授权的 P0 PoC 实验事实。
> 依据 `P0-independent-adapter-poc-implementation-guide.md`（PR#249 @`d3c9760d`）§5 算法逐工具族出 verdict。
> **fixture 级证据只收窄范围；GO 只能来自真实 pinned Host（§5 明文）。本报告不含任何 GO。**

## 0. 冻结版本与环境
| 项 | 值 |
| --- | --- |
| 实验 worktree/分支 | `.worktrees/exp-alpha5-poc-20261016` / `exp/alpha5-poc-20261016` @ `d3c9760d8f8ea2a2bfac4fd628133261b127f756`（PR249 head；OPEN；未 merge） |
| origin/master | `d455a274eee9e465df26d63f563d0cd4bbb0ec22` |
| pinned Host | 0.2.0-rc.2 @ `639ed015397290b3745d163aafe02ffee4aa3f84`（test-use 克隆自建，全程 porcelain=0） |
| 基线保护 | 主树 `master@6259cf4b`（脏 1 既有文件）与 `fix/post-alpha4-20261016@7e2a25ec` 全程未动；G1 trim 未触碰 |
| 模型 | 主代理+全部子代理 qwen3.8-flash-next（rev-D/E 及 E1/E6 有逐字自报；其余由 workflow/subagent 参数钉定） |
| 沙箱事实 | 本 harness 会话运行于宿主 bwrap 沙箱内（PID1=bwrapProfileArgs(workspace-write)，NoNewPrivs=1）→ 嵌套 OS 强制不可行（§P0-4） |

## 1. 执行面（每项=commit+日志+命令+耗时+判定）
| 实验 | 计划条款 | 结果 | 证据/复跑 | commit |
| --- | --- | --- | --- | --- |
| E1 源码锚定 S-01..S-12 | §0.1 | **12/12 CONFIRMED**（4 条位置注记） | 00-baseline/source-map.md | 74151aad |
| P0-0 双 Scope fixture+计数器 | §3 P0-0 | **4/4 PASS**（<1s） | 00-baseline/p00-runner.mjs→p00-run.log | 74151aad |
| P0-1 路由/竞态 BND | §3 P0-1,§4 BND-01..06 | **12/12 leg PASS**：own-layer 同名遮蔽即独占（BND-01）；safe-unload native=0（BND-02）；**竞态窗实存**=dispatch 期 `resolveExecution`(index.ts:1578) 晚期重解析：safe 序 native=0，**lift-mask 危险序 native=1（预期反例=设计防护证据）**；guard-after-allow 单调（BND-04）；agentless=全局 lane 不覆盖（INV-1 素材）；run_code 双面拒绝 | 01-routing/p01-runner.mjs | 74151aad |
| P0-4 OS 强制能力 | §4 PROC/NET/SRCH 依赖 | **ENV_BLOCK×4**（bwrap 嵌套拒/netns EPERM/userns 不可映射/landlock 强制不可观测）；S-10 源码 CONFIRMED | 04-process/env-capability-probe.sh（幂等） | 5406a21e |
| P0-6 阶段1 真实宿主冷启动 | §3 公共前置/P0-6 | **PASS**（boot 行+401 门+303+test-use byte-clean+token 已脱敏） | 07-integration/host-boot.log | d523a7d4 |
| P0-6 阶段2a 公开 seam 插件 | §3 P0-6 装配面 | **PASS**（Team 插件经 cordis.patch.yml file-URL 行在真实宿主进程内注册成功） | 07-integration/stage2-boot.log,02-plugin/ | 7559b652 |
| P0-2 grep/glob 竞速 | §3 P0-2,§4 SRCH-* | **INCONCLUSIVE(fixture-supports-R3)**：SRCH-03 12/12 真 rg 对照 PASS（argv 全存）、async confine→spawn 桥 PASS、A/B 结果深相等；**R2=fixture-shows-prereq-missing**（无 subprocess 服务→fiber PENDING 零注册，非 throw）；R4 NOT-ELIGIBLE；SRCH-04 spill NOT_RUN | 02-search/p02-search-runner.mjs→p02-result.json+notes.md | df5b27df |
| P0-3 Controlled FS | §3 P0-3,§4 FS-01..04 | PENDING（代理 3aac5394） | 03-fs/ | — |
| P0-5 PTC/LSP | §3 P0-5,§4 PTC/LSP-01 | **PTC**：8 腿（1-7 PASS/CITED，8 NOT_RUN）——内层 dispatch 走同一分级管线且 scoped guard 可断内层（原体 0）；桥可公开构造=无需 blocker。**LSP**：全栈公开挂载+池化实证——同路径不同策略共享常驻 pid（HAZARD-OBSERVED），服务器侧 OS 读不受限（虚构数据）；§6.1 十一字段 CORE 素材已录（素材，非宣告） | 05-ptc/+06-lsp/ 各 runner+result+notes | eaec6c55 |
| P0-6 阶段2b 宿主级 BND/Team 世界 | §3 P0-6 | **BOUNDED-DEFER**：需 mock-model team world（c1 kit 链：profiles 行+蓝图 world+mock 部署+3181 启动+会话驱动）；机制已在 kit 与阶段2a 分别实证，组合执行超出本轮预算 | 07-integration/p06-stage1-note.md | — |
| P0-7 独立 Reviewer | §2.7/§6 | PENDING（对本报告全部 commit 的 HEAD 复核，另行派发） | 08-review/ | — |

## 2. 逐工具族 verdict（§5 算法；含 PENDING 者按已证部分写 INCONCLUSIVE）
| 族 | verdict | 理由（真实值） |
| --- | --- | --- |
| read/write/edit/move（Controlled FS 面） | PENDING→暂记 INCONCLUSIVE | fixture 腿未完；S-10 已证原生读直通=必须有覆盖策略 |
| grep/glob | **INCONCLUSIVE（fixture-supports-R3；倾向 R3 候选）** | fixture 级 parity/桥全绿但 GO 需真实宿主（spill/取消/并发/隔离未覆盖）；R2 需 subprocess 服务前置；登记差异 presentationMeta 非包根可复现 |
| bash/pwsh（Confined Spawn 面） | **ENV_BLOCK（本宿主）** | P0-4：嵌套 bwrap/landlock/netns 全部不可行；**宿主/管理员动作是前置**，非 CORE_SEAM_BLOCKER 也非工具 fork 理由（guide §0 R4 明文：缺能力不是 fork 触发器） |
| run_code/PTC | **BOUNDED-DEFER（内层准入已证，外层待真实宿主）** | 保留拒绝 CONFIRMED；内层 guard 断链 PASS；外层直接 I/O NOT_RUN（无 ptc 外层进程） |
| LSP | **INCONCLUSIVE + 严格 Profile fail-closed 为安全兜底（族=Bounded Defer）** | 池键=仅路径身份、seam 无策略通道、服务器侧 I/O 不受限（真实池化代码路径+虚构服务器）；CORE 素材十一字段已录，留待上游接口讨论；fixture 不构成 LSP-01 全量 PASS |
| web/jobs/MCP | NOT RUN（本会话无网络；不在本轮已具备前置的项） | 登记为后续项 |

## 3. 关键设计证据（喂给后续实施计划）
1. **独占分发机制已在 pinned ToolRuntime 上实证**（fixture 级）：own-scope 同名注册即遮蔽继承面（BND-01）；restrict-first 装配 + 原子有序卸载在竞态窗（prepare→dispatch 重解析）下保持原体 0；**卸载顺序错误（先撤 mask）确定性复现危险时序** → 实施必须原子有序装配+调用排空证明（guide §3 P0-1 步骤 6 由本反例闭环）。
2. **单调 guard 不能被前段 allow 绕过**（L4）；`tools/execute` 环绕不可当替代 ToolDefinition 通道（S-04 源码 + L4 行为一致）。
3. **agentless 调用走全局层**（L6）：Team Adapter 覆盖不了无 agent 作用域的 dispatch → INV-1 的 binding 覆盖必须显式处理该 lane。
4. **受限读是本宿主的硬环境缺口**（P0-4）：任何"OS 级受限读"验收都必须换/配宿主，PoC 不能也不应绕过。
5. 原生 grep/glob 的真实失败路径经公开 helper 可组合复算（以 02-search 结果为准）；spill 精确身份判定=S-09（替换 Definition 会丢 spill 属预期代价）。

## 4. 诚实边界
- fixture/替身证据不写成真实宿主 PASS；每个 TEST DOUBLE 在其 notes.md 有界限声明。
- 未跑项一律 NOT RUN/ENV_BLOCK/BOUNDED-DEFER + 缺项说明；无 P0 GO；不新增 fork（A5-FORK-001 仍 CONDITIONAL/未产生）；不触碰 PR249/不改 PR 状态；G1 与各待裁项未动。
