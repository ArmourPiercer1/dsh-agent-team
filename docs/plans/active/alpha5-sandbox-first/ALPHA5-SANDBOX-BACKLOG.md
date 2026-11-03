# ALPHA.5 SANDBOX-FIRST — EFFECTIVE BACKLOG（有效待办唯一入口）

<!-- phase-baseline-ref: dev/engineering/current-authority.json -->
<!-- phase-identity: alpha5-sandbox-first -->

> **当前阶段：ALPHA.5 SANDBOX-FIRST（沙箱优先执行面）**。本文件是当期唯一有效待办入口；
> 设计需求正本见 `docs/plans/memo/alpha5-sandbox-first-20261101/`（ADR / ARCHITECTURE /
> IMPLEMENTATION-PLAN / TOOL-ADOPTION-MATRIX / TRANSITION-PLAN），当前态计划见同目录
> `current-implementation-plan.md`，逐工具验收见 `TOOL-ACCEPTANCE-MATRIX.md`。
> 机器权威 = `dev/engineering/current-authority.json` 指针解析到的不可变快照；本文件只引用、
> 不复制 baseline SHA。**历史绿 ≠ 新验收**：任何旧矩阵 PASS 都不能折算成本阶段验收。

## 0. 记法与裁决

- `BL-NN` = 本阶段待办；`BR-NN` = 本阶段必须回归/复验项（回归而非新功能）。
- 状态：`DONE` / `IN-PROGRESS` / `READY` / `BLOCKED` / `DEFERRED`。
- 每个条目必须绑定：证据目录（`dev/agent-workflow/evidence/a5sf-*`）、验收 Gate、独立 Reviewer。
- 禁止：第二套授权/第二套启动器/第二套策略编译器；禁止重新引入 `RequestedEffectSet`；
  禁止把原生工具塞回 `FamilyAssembly`；禁止把旧 `web-family` 历史当作 network ceiling 证据。

## 1. P1 — 基础体系与可装配后端（G1）

| ID | 工作包 | 状态 | 证据 / PR |
|---|---|---|---|
| BL-01 | P1-01 v4 复用与最小 Member 上界增量（三轴 grammar，`memberIoCeiling`） | DONE | `dev/agent-workflow/evidence/a5sf-p1-01/`、`a5sf-g1/G1-GATE-REPORT.md` |
| BL-02 | P1-02 MemberPolicy 编译器（`EffectiveIo ⊆ MemberCeiling ∩ ToolRestriction`，`all` 为交集单位元） | DONE | `evidence/a5sf-p1-02/` |
| BL-03 | P1-03 授权路径/硬链接/Provider 能力（13 方法闭集、越界/悬空链接拒绝） | DONE | `evidence/a5sf-p1-03/` |
| BL-04 | P1-04 Invocation Binder + Trust Registry（能力不可重放、lease 需调用方时钟） | DONE | `evidence/a5sf-p1-04/` |
| BL-05 | P1-05 Service Realm / Provider 绑定（隔离 `ctx.isolate('fs')`、安装回滚、代际拒绝、`installToolBindingRealm`） | DONE | `evidence/a5sf-p1-05/` |
| BL-06 | P1-06 Provider/Backend 排他替换及发布路径 | DONE | `evidence/a5sf-p1-06/` |
| BL-07 | P1-07 OS Runner / Subprocess 公共面（真实 Landlock 证据，嵌套 deny 拒绝） | DONE | `evidence/a5sf-p1-07/` |
| BL-08 | P1-08 PTY / 持久进程生命周期（撤销先于首个 await、generation 键） | DONE | `evidence/a5sf-p1-08/` |
| BL-09 | R1 审批/治理接管（Alpha.4 ControlService/Envelope/ApprovalCase 以公开 seam 接管新执行面） | DONE | PR #541；`evidence/a5sf-r1/`；只消费既有 `ControlService.guardOperation` 的耐久 allow，只可收窄不可放宽；无第二 Ledger |
| BL-10 | R2 工程基线继承（WorldFactory/Canary/oracle、四层 CI、`PR #394` 诊断工具） | DONE | PR #540；`evidence/a5sf-r2/`；唯一 launcher/ledger/oracle/诊断表，预算门移到 `run-record.mjs` 单一实现 |
| BL-11 | R3 证据链（Alpha.4 允许/拒绝 → 编译结果 → Provider consulted → 独立效果 Oracle 同调用对齐） | DONE | PR #545；`tests/world-factory/lib/a5sf-evidence.mjs` + `evidence/a5sf-r3/`；四链同调用对齐，passive（不决策），`consulted/disposition` 为 lane 声明并已披露；未知行种类 fail-closed |
| BL-12 | R4 诊断工具（approval-bypass / 失效分类报告） | DONE | PR #542；`evidence/a5sf-r4/`；`scripts/a5sf-diag.mjs` 复用 `PR #394` 分类表与 P1 `matchLocator`，不新增词汇 |
| BL-13 | R5 黄金向量转换（旧 tool-family 输出向量 → 新 Provider 对照） | DONE | PR #543；`evidence/a5sf-r5/`；12/5041 向量转成回归对照语料，MATCH 明确不构成验收 |

## 2. P2 — 每机制代表工具（G2）

| ID | 工作包 | 状态 | 入口 / 证据 |
|---|---|---|---|
| BL-14 | P2-01 原生 `read`（>10MiB 中间窗口、流式、禁读真实拒绝、双 Member 不串权） | PARTIAL（gate + dry harness；G2 未取得） | PR #546；`tests/world-factory/suites/150-a5sf-read.mjs` + `evidence/a5sf-p2-read/`；预算预登记门 + 真实 compiler/guard/chain/diag 的 host-free dry；**live 未跑**：`installToolBindingRealm` 无生产挂载点、guard 咨询不可观测（`install.ts:293`），需 seam + mount + 跨进程传输 + 用户 boot 预算裁决 |
| BL-15 | P2-02 原生 `write`（原子替换/版本校验；禁写字节不变；写不自动获读） | READY | 同上 |
| BL-16 | P2-03 原生 `grep`（OS `rg` 真实拒绝、exit 0/1、取消、结果裁剪） | READY | `a5sf-grep.mjs` |
| BL-17 | P2-04 原生持久 `bash`（同 PTY 多命令、只写不读、`chmod`/新建文件负控、禁网、旧代 PTY 拒用） | READY | `a5sf-bash.mjs` |
| BL-18 | P2-05 原生 `web_fetch`（本地 mock provider、network=deny 前置拒绝、普通 DSH fetch 不受影响） | READY | `a5sf-web.mjs` |
| BL-19 | P2-06 原生 `run_code/PTC`（Node 子进程 + 受控 Host bridge，无代发旁路） | READY | `a5sf-ptc.mjs` |
| BL-20 | P2-07 全新第三方 CLI（通用 launcher，零专用 ToolDefinition 执行体） | READY | `a5sf-new-cli.mjs` |

> **P2 统一前置（2026-11-03 实测；PR #548 后状态更新）**：缺口（b）「guard 咨询不可观测」已作为**机制**闭合（`onGuardConsult` 观察者 + `a5sf-guard-consult/1` 事实 + 跨进程 JSONL 传输 + `mountA5sfRealm` 单一挂载入口，子进程pid 证明真实跨进程）；缺口（a）**部分闭合**：入口存在且被真实调用者（R2 harness）使用，但产品行仍未接线。剩余工作已实测为**多于一个调用点**：（1）`packages/runtime/src/plugin/live/agent-bindings.mjs` 成员装配回调接线；（2）emit 入列（`packages/runtime/tsconfig.build.json` 目前 **不含** `team-services/src` 与 `member-io-policy/src`）+ `scripts/dist-placements` 布局；（3）重新生成并**提交** `packages/runtime/dist`（该树受 `check-artifacts-committed` 新鲜度门约束）；（4）真实 Host 运行 + 用户 boot 预算裁决（池仍 0）。
>
> 原缺口描述（2026-11-03 首测）：所有 P2 纵切的真实 Host 半场都被同一对缺口卡住 ——（a）`installMemberIoProviders`/`installToolBindingRealm` **没有生产调用者**，a5sf realm 在已启动 Host 中是惰性的；（b）`installToolBindingRealm` 内部构造 guard 闭包且不返回，`consulted` 不可观测。零点向上游补丁的最小 seam（~10–15 行：`import type { FsGuard}` + `wrapGuard` + 输入 + 保默认接线）+ 生产挂载 + 跨进程传输三者齐备前，任何 P2 live 断言的“经 Provider 读取/guard 已咨询”都只是 driver 自述。boot 预算池仍为 0，live 运行需用户新裁。

## 3. P3 — 原生工具逐项接入（G3）

| ID | 工作包 | 状态 | 备注 |
|---|---|---|---|
| BL-21 | P3-00 原生来源清单与分类（真实 `ToolRuntime`/Preset/动态 MCP 导出，动态来源默认 NOT_TESTED） | BLOCKED（需真实 Host boot） | 输出 `tests/kits/a5sf-native-inventory/` + `evidence/a5sf-p3/inventory/` |
| BL-22 | P3-01 FS 工具组（`read`/`write`/`edit`/`read_image`/`str_replace_editor`） | BLOCKED（依赖 BL-21） | 不新增 `fs-family` executor |
| BL-23 | P3-02 搜索与进程组（`grep`/`glob`/瞬态与持久 shell/`run_code`/`terminal_*`/`lsp`） | BLOCKED（依赖 BL-21） | 分别验收瞬态与持久 |
| BL-24 | P3-03 Web 与外部提供者（`web_fetch`/`web_search`/stdio MCP/remote MCP） | BLOCKED（依赖 BL-18/BL-21） | remote = TRUSTED_DELEGATION 或 UNSUPPORTED |
| BL-25 | P3-04 无直接数据面 I/O 的工具与未知工具（`goal`/`todo`/`jobs`/`present`/`ask`/`skill`/`session`） | BLOCKED（依赖 BL-21） | 逐工具列明实施/不实施理由 |
| BL-26 | P3-05 旧工具 Family 分阶段接管/退役（freeze → parity → switch → delete，不删证据） | BLOCKED（依赖 BL-22..BL-25） | 唯一 Integrator 变更 `team-tool-plane.mjs` 等 |

## 4. P4 — 全原生工具 × I/O 维度验收（G4）

| ID | 工作包 | 状态 |
|---|---|---|
| BL-27 | P4-01 FS 授权矩阵（读写分离/目录/新建/覆盖/rename/chmod/跨 Member） | BLOCKED（依赖 G3） |
| BL-28 | P4-02 路径与硬链接矩阵（授权硬链接、软链出界、前缀/rename/相对路径） | BLOCKED（依赖 G3） |
| BL-29 | P4-03 Network deny/allow（Web 前置 + OS TCP/UDP/IPv4/IPv6/DNS/代理/重定向；无 netns 不伪称） | BLOCKED（依赖 G3） |
| BL-30 | P4-04 一次性审批与撤权（并发仅一次扩权、持久 Bash 排空、取消 ≠ 确认终止） | BLOCKED（依赖 BL-09/BL-11） |
| BL-31 | P4-05 绑定/运行时更新（HMR/源摘要/同名替换/Realm/重启/cold resume，无未受控 fallback） | BLOCKED（依赖 G3） |
| BL-32 | P4-06 Host 兼容（非 Team read/bash/web 不受影响、`spillStore` 回归） | BLOCKED（依赖 G3） |
| BL-33 | P4-05A 双平面同调用一致性与实际消费（Alpha.4 → Provider consulted → 独立 oracle 全对齐） | BLOCKED（依赖 BL-11） |
| BL-34 | P4-07 性能与运行资源（p50/p95/p99、RSS、CPU、启动次数；无自定阈值假保证） | BLOCKED（依赖 G3） |

## 5. P5 — 对抗、故障与发布验收（G5）

| ID | 工作包 | 状态 |
|---|---|---|
| BL-35 | P5-01 对抗性 I/O（TOCTOU、软链出界、`/proc/self/fd`、继承 FD、PATH 替换、孤儿进程、代理/UDS/host bridge） | BLOCKED（依赖 G4） |
| BL-36 | P5-02 生命周期/故障恢复/上游升级演习（撤销/重启代际、崩溃、双装、无 Landlock/bwrap、僵尸清理） | BLOCKED（依赖 G4） |
| BL-37 | P5-03 发布前产品/工程双验收（RUN-MANIFEST、GATE-REPORT、独立权威迁移 PR、用户最终裁决） | BLOCKED（依赖 G5.1/G5.2） |

## 6. 回归义务（BR）

| ID | 内容 | 状态 |
|---|---|---|
| BR-01 | 每个 PR 必跑：`pnpm -r typecheck`、`pnpm -r build`、`pnpm check:artifacts`、受影响 Alpha.4/5 套件 | IN-PROGRESS（持续） |
| BR-02 | `tests/deepseek-harness-test-use` 保持 pristine `639ed01539`；非 Team 路径等价 | IN-PROGRESS（持续） |
| BR-03 | 旧 Alpha.4 权限/审批/Jobs 语义不退化（只追加证据，不改历史） | IN-PROGRESS（持续） |
