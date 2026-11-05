# ALPHA.5 SANDBOX-FIRST — 当前实施计划（current）

<!-- phase-baseline-ref: dev/engineering/current-authority.json -->
<!-- phase-identity: alpha5-sandbox-first -->

> **当前阶段：ALPHA.5 SANDBOX-FIRST（沙箱优先执行面）** —— 把“Member × Tool 两轴上界”编译成
> Service 与 OS 两条真实执行路径上的硬约束，原生工具原样接入、不重写业务执行体。
> 本文件是**当前态**；设计需求正本（ADR / ARCHITECTURE / IMPLEMENTATION-PLAN /
> TOOL-ADOPTION-MATRIX / TRANSITION-PLAN）在 `docs/plans/memo/alpha5-sandbox-first-20261101/`。
> 有效待办唯一入口 = 同目录 `ALPHA5-SANDBOX-BACKLOG.md`；逐工具验收 =
> 同目录 `TOOL-ACCEPTANCE-MATRIX.md`。机器权威 = `dev/engineering/current-authority.json`
> 指针解析到的不可变快照；本文件只引用、不复制 baseline SHA。

## 0. 核心不变量（不可协商）

1. `EffectiveIo(member, tool, call) ⊆ MemberCeiling(member) ∩ ToolRestriction(member, tool)`；
   轴 = `read` / `write` / `network`。`network=restricted` 本轮 **UNSUPPORTED**（无目的地粒度）。
2. 审批只决定“是否允许执行”，**不改写硬上界**；批准后仍可能被 I/O 上界拒绝，且必须给出正确诊断。
3. 策略不可表达、Provider 能力缺失、后端不强制 → **拒绝执行**（`ENFORCEMENT_UNAVAILABLE` 等），
   绝不退回裸执行或静默降权。
4. 不出现第二套授权/第二套启动器/第二套策略编译器；Alpha.4 的 ControlService / Authority
   Envelope / ApprovalCase 仍是唯一审批与治理内核（R1 接管，不复制）。
5. 原生工具代码保持原样（CORE PATCH BUDGET = 0）：通过公开 seam 提供 provider，不 patch upstream，
   不把原生工具塞回 `FamilyAssembly`，不重新引入 `RequestedEffectSet`。
6. 历史绿 ≠ 新验收：旧矩阵 PASS、旧 `fs-family`/`web-family`/`process-family` 结果只作回归输入
   （C 类资产），不得折算为本阶段任何一行的等级。

## 1. 当前状态（诚实快照）

| 层 | 状态 | 证据 |
|---|---|---|
| P1 策略编译器 / 路径规则 / Invocation Binder / Trust Registry | 已实现并有测试（140/140 a5sf 套件） | `dev/agent-workflow/evidence/a5sf-p1-0{2,3,4}/`、`a5sf-g1/G1-GATE-REPORT.md` |
| P1 Service Realm / Provider 绑定（隔离 `ctx.isolate('fs')`、安装回滚、代际拒绝、`installToolBindingRealm`） | 已实现并有测试 | `evidence/a5sf-p1-05/` |
| P1 Provider/Backend 排他替换与发布路径 | 已实现并有测试 | `evidence/a5sf-p1-06/` |
| P1 OS Runner / Subprocess 公共面 | 机制级实测：本机 Landlock v7 上 `content-read`/`write` enforced，真实受限子进程被拒读；嵌套 deny 拒绝；network/dir-metadata/alias UNSUPPORTED | `evidence/a5sf-p1-07/OS-RUNNER-EVIDENCE.md` |
| P1 PTY / 持久进程生命周期 | 领域层实现并有测试；真实 PTY 端口仍是 double（P2-04 换真） | `evidence/a5sf-p1-08/TERMINAL-LIFECYCLE-EVIDENCE.md` |
| 工具级端到端（原生 `read`/`write`/`grep`/`bash`/`web_fetch`/…） | **部分接线**：`read`/`write` 有 live 实测但按 Q7 记 `NEEDS_REVALIDATION`；`edit`/`grep`/`glob` = `ENFORCE-PARTIAL`；`read_image` = `BOUNDED-DEFER`；其余仍 `NOT_WIRED`（少数机制 `PROBE-GATED`） | `TOOL-ACCEPTANCE-MATRIX.md` |
| 审批/治理接管（R1）、证据链（R3）、发布验收 | R1/R3 已 DONE（BL-09 / BL-11；BL-12 / BL-13 亦 DONE）；发布验收未开始（BL-37） | 本文件 §3 |

**环境事实（必须随结果一起读）**：本机为 WSL2 内核 `6.18.33.2-microsoft-standard-WSL2`，
Landlock ABI v7。PoC 早期记录的 WSL2 `EBADF` `ENV_BLOCK` **在本内核不复现**；但任何“其他内核
同样可用”的说法都必须重新实测，P1 的 OS 证据只覆盖本机这一内核。

## 2. 阶段路线（G1 → G5）

| 阶段 | 目标 | Gate | 主要交付 |
|---|---|---|---|
| P1 | 基础体系与可装配后端 | **G1（已达成，含残余披露）** | 两轴编译器、Service Realm、OS Runner、PTY 生命周期、能力闭集 |
| P2 | 每种执行路径选一个代表工具，真实原生正向 + 基础拒绝 | G2 | 每机制至少一允许一拒绝；真实 Host/Provider consulted；独立效果 Oracle |
| P3 | 原生工具逐项接入（先清单，再批量） | G3 | 原生行为不退化；每工具最小拒绝；旧 Family 分阶段退役 |
| P4 | 全原生工具 × 读写/网络/生命周期矩阵 | G4 | 逐格 PASS 或类型化例外；一次性审批/撤权/持久进程可核验 |
| P5 | 对抗构造、故障恢复、上游升级演习、发布双验收 | G5 | 无已知可复现越界；升级路径 bounded；RUN-MANIFEST + GATE-REPORT |

**P1 的 G1 判定**（`evidence/a5sf-g1/G1-GATE-REPORT.md`）：G1.1–G1.4 PASS；G1.7 PASS（scoped：
本机 Landlock 读写；network/dir-metadata/alias 拒绝）；G1.5/G1.6/G1.8 **CONDITIONAL**，条件为
真实 Host 的 `dsh-tool-fs` 二进制、`dump-config` boot、真实 PTY 端口。任何后续 PR 不得把
CONDITIONAL 改写成 PASS，除非补齐具名条件。

## 3. 立即执行顺序（ready 队列）

1. **BL-09 / BL-10（R1 + R2）已 DONE**（PR #541 / #540），BL-11 / BL-12 / BL-13 亦已 DONE：
   Alpha.4 审批/治理与工程基线已接管，P2 每条验收的前置证据链已就位，不再占用 ready 队列。
2. **BL-14..BL-20（P2 代表机制）**：BL-14 / BL-15 的 live 半场已取得，但实测树与当前 baseline
   不等价（矩阵 `NEEDS_REVALIDATION` / `V@B=no`，需在新树上重跑）；BL-16 的 live 六行 PASS 也因
   `#598`/`#599`/`#600` 移动产品面而退回 `V@B=no`；BL-17..BL-20 仍 READY。按“RED 实测 → 最小接线
   → C1 正向+拒绝 → C2 真实 Host Oracle → 独立 Review → commit”交付；每条一个可集成的最小纵切，
   不做“五个大模块再接线”。
3. **BL-21（P3-00 库存）**：source-evidenced 半场已完成（`NATIVE-SOURCE-INVENTORY.md`）；runtime
   枚举半场仍需真实 Host boot；在 boot 预算内完成来源导出，动态来源默认 `NOT_TESTED`。
4. 任何 P3 批量的入口 = 对应 P2 机制 G2 通过；未通过的家族**不得**用“自研等价工具”解锁。

## 4. 交付与审查纪律

- 1 任务 = 1 分支 = 1 worktree = 1 writer；共享接线文件（`index.ts`、`tsconfig*.json`、
  装配入口）只由协调者/指定 Integrator 变更。
- 每个 PR 必跑：`pnpm -r typecheck`、`pnpm -r build`、`pnpm check:artifacts`、受影响套件；
  `pr-gate` 全绿（`census` 在缺少 pristine host 的 runner 上按其文档化 refusal 处理）。
- Reviewer 不得用开发者的 C1 报告替代真实效果验证；审查必须独立复跑探针/负控。
- 同类失败不得无限重试：同一失败类最多 3 次尝试，随后记录 `refused`/`ENV_BLOCK` 并给出证据。
- 只有 candidate SHA + 测试目标 + 独立 oracle 三者固定后，才启动真实 Host 测试。

## 5. 退出标准与 Stop-Rules

- 完成 P2–P5 的 Gate 与矩阵逐格证据，且**发布 GO 由用户最终裁决**；机器权威切换是独立 PR
  （`publish` → `switch`，带回滚），本计划不自动切换。
- **Stop-Rule**：出现需要 patch upstream 的路径即 `CORE_SEAM_BLOCKER`（阻塞，不是待办）；
  出现无法表达的上界（如 network 目的地粒度）即如实 `UNSUPPORTED`，不得近似成 PASS；
  证据不可复现时按 `NEEDS_REVALIDATION` 处理并把 `V@B` 置 `no`。

## 6. 资产回收（R1–R5）

旧 Alpha.5 执行架构大部分退役，但审批治理、工程基线、测试框架、文档/CI 流水线有高复用价值。
分类与逐条来源见 `docs/plans/memo/alpha5-sandbox-first-20261101/TRANSITION-PLAN.md` §6 与
`dev/agent-workflow/evidence/a5sf-reclaim/ASSET-RECLAMATION-REGISTRY.md`：

| ID | 回收对象 | 方式 | 落点 |
|---|---|---|---|
| R1 | Alpha.4 `ControlService` / Authority Envelope / ApprovalCase | A 类原样复用 + 公开 seam 接管 | BL-09 |
| R2 | WorldFactory / Canary / oracle、四层 CI、`PR #394` 诊断 | A 类原样复用 | BL-10 |
| R3 | 允许/拒绝 → 编译 → Provider consulted → 效果 Oracle 证据链 | B 类适配接口 | BL-11 |
| R4 | approval-bypass / 失效分类诊断工具 | A 类原样复用 | BL-12 |
| R5 | 旧 tool-family 输出向量 → 黄金向量 | C 类只承继测试与证据 | BL-13 |

**禁止**：把回收当作新验收；用回收削弱新不变量；以“复用”为名恢复旧 `FamilyAssembly` 执行体。

## 7. Integration Track 与 Candidate Track（2026-11-06 owner 指令）

开发分两条轨道，**不是两个分支策略偏好**，而是 Q7 的代价结构决定的：Q7 比较 `baseline` 快照与
**HEAD 的产品面**，所以“被测过的树”与“会合入的树”一旦不同，所有 `V@B=yes` 立刻失效。把这条
事实写进流程，比在每次失效后重新解释它便宜。

| | **Integration Track（集成轨）** | **Candidate Track（候选轨）** |
|---|---|---|
| 载体 | `master`（连续） | 冻结 head（`task/a5sf-candidate-<date>` 的某个 commit） |
| 接收什么 | 文档、证据、测试基础设施；产品改动按正常 PR 逐一合入 | **不再接收产品改动**；只做 C2 验收 |
| 什么时候花 boot | 不花（boot 只在候选轨/指定 live 任务上花） | 一次冻结、一次（或少数几次）批量 Host 验收 |
| 谁是 owner | Integration Owner | Integration Owner 启动，Acceptance-Reviewer 判 |
| 退出条件 | 每个 PR 全门绿 | 候选被接受（合入 `master`）或放弃（证据保留、判定作废） |

### 7.1 分支、冻结与合并规则

1. **集成 PR**：一任务一分支一 worktree 一 writer，合入 `master`；共享装配文件（`index.ts`、
   `tsconfig*.json`、产品入口、Authority、Member 生命周期）**只有 Integration Owner** 可变。
2. **冻结**：从**当时的集成 head** 切候选分支，冻结到某个 commit；对该 commit
   `publish-authority` 一份**新快照**（`baseline` = 该候选 head）。快照是**不可变的**，发布不等于
   移动指针。
3. **指针**：`dev/engineering/current-authority.json` 只由 Integration Owner 通过
   `scripts/switch-authority.mjs` 移动，且只在 **a) 接受候选**（此时候选 head 已成为 `master` 的
   祖先）或 **b) 放弃候选并把指针切回集成 head** 这两个时刻移动。候选运行期间，运行记录携带
   **发布快照的 digest + 实际观察到的指针**两份事实（`bindings.candidateSnapshot` /
   `bindings.authorityObserved`），不靠“事后 re-stamp”把观察改写成想要的样子。
4. **冻结期间不放行任何产品改动**：`packages/**`、`scripts/**`、`tests/paths.mjs`、
   `package.json`、`pnpm-lock.yaml`（Q7 的 drift 集）在冻结窗口内不动。文档/证据/测试基础设施
   可以在 `master` 上继续集成（它们不在 drift 集内），但**不得与候选的产品面产生语义差**。
5. **候选内的“修复”= 重新冻结，不是原地改树**：影响该候选安全性/正确性的修复只能作为
   **受控变更**进入——切新候选 head、发布新快照、把旧 run 记为 `superseded`，保留其证据与判定。
   对已冻结树做 `commit --amend` / rebase / 追加产品提交都是禁止的（那会让“被测过”与“证据指向”
   脱钩）。
6. **“旧候选通过了它的测试” ≠ “master 的最新通过了”**。候选的 C2 证据只证明**它自己的树**；
   `master` 产品面一动，该证据的 current claim 立刻是 `NEEDS_REVALIDATION`，无论候选当时多绿。
   这条不因候选是“最终候选”而放宽。

### 7.2 Q7 的代价如何降低（不改变 Q7）

Q7 本身**不得放松**：它是“当前验证必须关于会合入的树”这一安全不变量的机器表达。可改的只有
**触发次数**：

- 每次冻结窗口内发生一次产品合并 ⇒ 一次 drift ⇒ 该候选的 live 断言全部作废 ⇒ 一次重验 boot。
- 因此 **Q7 成本 = 冻结窗口内的产品合并次数 × 需要 live 的行数**，而不是“Q7 太严”。
- 唯一合法的降本手段是**冻结期间少改产品**：把产品改动集中在冻结之前（集成轨），把冻结窗口压到
  只跑验收的长度。**不是**改 gate、不是改 baseline 指向、不是“先合并再补证据”。
- 实测：`#606`（28 条产品路径）使 candidate-1 的四行在同一小时内由 `V@B=yes` 退回 `no`；
  此前 `#598`/`#599`/`#600` 已让 BL-16 的六行同样退回。这两次都是**合并时机**的成本，不是
  Q7 的缺陷。

### 7.3 当前观测到的轨道冲突（必须由 owner 裁决，不由本计划自行处置）

当前指针解析到的快照把 `baseline` 指向候选 `1484fa4ee…`（candidate-1 的冻结树），但 `master`
此后又合入了 `#606`/`#607`。后果是 `ci-pr-gate --only state-freshness` 在 `master` 上报
`Q4: baseline … is neither HEAD nor an ancestor of HEAD`——**这不是本次重组引入的红**，而是
“指针指着候选、集成轨继续合并”这一组合的直接结果。按 §7.1 的规则它属于非法状态，但**修它要移动
Authority 指针**，那是 owner 的决定，不是本计划的执行项；处置选项写在 §9 的问题清单里。

## 8. 下一批可执行任务（2026-11-06）

规则：**每个共享文件只有一个 owner**；一个任务 = 一个最小纵切；`C1` = host-free 验收，
`C2` = live 验收；`boot` = 是否需要 Host 启动（当前剩 3 次：BL-17 live、BL-18 live、一次重试）。
**产品文件（`packages/**`）的任何一行改动都必须由 Capability Implementer 以独立 PR 提交**；
本表只是分配，不是开工授权。

| # | 任务 | Face | 依赖 | 唯一 owner 文件（共享文件仅此一处） | 最小纵切 | C1 验收 | C2 验收 | boot |
|---|---|---|---|---|---|---|---|---|
| T-01 | **PREFLIGHT-BUNDLE**：两个 live driver 在花 start 之前写出 `preflight-bundle.json` 并以 `scripts/a5sf-preflight.mjs` 的 PASS 为开工条件 | cross | 本 PR 的 preflight + 负控 | `tests/world-factory/lib/a5sf-acceptance-preflight.mjs`（共享契约）；每个 driver 在自己的证据目录内改**仅一个** `run-boot.mjs` | driver `--plan` 生成 bundle → preflight PASS/FAIL → 不 PASS 不 boot | 别名 fixture 红 / 干净 bundle 绿（已具备，D1–D15） | — | 否 |
| T-02 | **RECUT-BASELINE**：把集成 head 重切为 authority baseline，消掉 §7.3 的 Q4 红 | cross | owner 对 §9-Q1 的裁决；`#607` 之后不再有产品合并 | `dev/engineering/current-authority.json`（指针；快照由 publisher 写） | publish 新快照（baseline = 集成 head）→ switch → 回读 | `state-freshness` 绿；F0 digest 校验通过 | — | 否 |
| T-03 | **BL-17-LIVE**：持久 bash 的 live 半场（同 PTY 多命令、只写不读、`chmod` 缺口、禁网、旧代 PTY 拒用） | Shell-PTY | T-01（bundle 预检）；BL-17 host-free 半场已绿；allocation #2 由 owner 解冻 | `dev/agent-workflow/evidence/a5sf-bash/run-boot.mjs`（新） | 单次 boot 跑 §8 八步，逐步落盘 | 21 臂保持绿（回归，不是新验收） | §8 step 1–8 逐条带 exit code | **是**（1） |
| T-04 | **BL-18-WEBFACE**：让受管 Member 的 `web_fetch` 真的解析到 confined `web` face（现无 row config key / service / constructor） | Web | 先合入一条**绿**的转发改动；`#608` 视为未完成，不得在其上继续 | `packages/runtime/src/plugin/live/a5sf-realm-row.mjs` | 行配置转发 `{ effective, provider.fetch, provider.search }` → realm 挂载 → 无 face 时组合期仍 typed 拒绝 | host-free 臂：转发后 `faces.web` 为真、无 face 时 `A5SF_NETWORK_UNCONFINED_REALM` 仍拒 | BL-18 §8 step 1–8（`strace` 零 connect/DNS） | **是**（1，合并后） |
| T-05 | **FS-SEARCH-REVALIDATE**：在**新集成 head** 上重跑 FS/Search C2（M-01/M-02/M-06/M-07） | FS Provider + Subprocess | T-01、T-02；候选必须从新基线切 | `dev/agent-workflow/evidence/a5sf-candidate1/run-boot.mjs`（既有文件，唯一 writer） | 冻结候选 → 预检 PASS → 单次 boot → 11/11 | 预检 PASS + judged fixtures 不变 | 11/11（含 productTreeProof） | **是**（1） |
| T-06 | **BL-19-PTC-C1**：`run_code`/PTC 的 C1 判定（它是执行模式不是可装载模块） | External execution | BL-21 源清单已 DONE；无产品依赖 | `docs/plans/active/alpha5-sandbox-first/NATIVE-SOURCE-INVENTORY.md` | 写出“无 routed-native 接入面”的具名判定与最小负控设计 | 一个 host-free 测试把该判定钉住（不接受即红） | — | 否 |
| T-07 | **EXT-FACE-DESIGN**：为 LSP / MCP 面**先设计**最小正/负测试（在首个产品实现之前） | External execution | T-06 | `tests/world-factory/a5sf-external-face.test.mjs`（新） | 每面一正一负的**契约测试**（不实现产品） | 测试在无产品接线时以 `NOT_WIRED` 判定 fail-closed | — | 否 |
| T-08 | **NONDATA-AUDIT**：M-19/M-20/M-21 是否真的无数据面 I/O；有则重新归面 | Non-data-plane | 无 | `docs/plans/active/alpha5-sandbox-first/TOOL-ACCEPTANCE-MATRIX.md` §1.1 | 逐行判定 + 证据路径；不改等级 | 一个 host-free 检查：任何“读写文件”的工具名不得留在本面 | — | 否 |
| T-09 | **ADAPTER-DEDUP（提案，未排期）**：收敛 `subprocess.ts` 对上游 `OutputCollector` / `childEnv` 的重复实现 | Subprocess | owner 批准（触碰产品） | `packages/runtime/team-services/src/subprocess.ts`（唯一） | 用上游公开 seam 替代本地 collector/env，或明确声明“不替代”并写理由 | 现有 313/313 臂保持绿 | 现有 live 行不变 | 否 |

**未列入本表的东西**：`#608` 的续写（未完成、红 CI，按 directive 不基于它构建）；任何改变
`rg` allow-list 的“通用化”改动（BL-41 明确它不是通用安全模型）；任何 Q7/CI/Authority 的放宽。
