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

## 7. Candidate track：独立冻结候选与两轨验证（2026-11-06 owner 裁决机制化）

> 本节把 owner 的两条裁决落成**可执行的机制**，不新增语义权威：Q7 的严格性、`V@B` 的
> 含义、Authority 指针的六字段契约全部不变。候选轨道只是给「在候选树上验过」这一事实
> 一个**自己的**记录位置；它永远不能拿来把 master 行标成 current。

### 7.1 候选 ref 的命名与冻结

- 命名：`candidate/<lane>-<n>`。本期第一个 = `candidate/a5sf-fs-search-1`，指向
  **被 FS/Search live run 实测的那棵树** `25e106b4573cac0ab624c7e0bc5ca7d36dba3730`
  （= 冻结产品提交 `1484fa4ee` + 仅证据/fixture 拆分；产品面逐字节相等的证明在 run record
  `bindings.productTreeProof`，本清单不转述结论、只登记可复核的 tree/blob SHA）。
- 每个候选在 `dev/engineering/candidates/<candidate-id>.json` 有一份**不可变**清单
  （`cand-a5sf-fs-search-1.json`）：`candidate_id` / `candidate_ref` / `candidate_commit` /
  产品 SHA + 产品面 tree/blob（`packages`、`scripts`、`tests/paths.mjs`、`package.json`、
  `pnpm-lock.yaml`、glue）/ 判官 blob / Authority 快照 `{snapshot_version, content_digest,
  baseline}` / 依赖（host baseline `0.2.0-rc.2` @ `639ed01539…`、lockfile、package.json）/
  证据 run record / ancestry 记录。清单带 F0 规范字节摘要（与 snapshot 同约定），
  并在文件内给出重算命令。
- 冻结语义：ref 一旦指向 `candidate_commit` 即不再前进。master 继续开发，但**没有任何新
  提交会自动进入**某个冻结候选；候选与 master 之间只有显式动作（重跑 + 新候选版本，或
  真实 merge）。

### 7.2 一次修复 = 一个新的候选版本

- **禁止**在既有 candidate identity 下改产品代码：不得 amend / reset / rebase / force-push
  `candidate/*`，不得让同一 `candidate_id` 的 ref 悄悄移动。违反即等于伪造成立证据。
- 修复产生**新** `candidate_id`（`cand-<lane>-<n+1>`）与**新** ref / 新 sha，清单里
  `supersedes` 指向前一版；旧 ref、旧清单、旧 run record **原样保留**，不删、不改写。
- 重新验收范围 = 修复 **diff 实际触及的产品面**：`git diff --name-only <old-sha> <new-sha>
  -- packages scripts tests/paths.mjs package.json pnpm-lock.yaml` 决定哪些行必须重跑；
  未触及的行可以引用保留证据，但行内必须写新候选版本 + 新 sha，并注明
  `reacceptance: preserved`。**不得**把旧树的 PASS 直接搬成新树的 PASS。

### 7.3 ancestry 规则（发布前与合回时）

- **发布任何 snapshot 之前**必须实测 baseline 的 Git ancestry，而不是相信清单文字：
  `git merge-base --is-ancestor <snapshot-baseline> <candidate-ref-or-HEAD>`，exit 0 才算
  「baseline 是真实祖先」；非 0 一律拒绝发布。机器复核 = `state-freshness` 的 Q4
  （baseline 必须解析成 commit 且是 HEAD 或 HEAD 祖先）。
- 任何把候选 SHA 带回 master 的操作必须保留**真实 merge ancestry**：merge commit 或
  `git merge --no-ff`。**禁止 squash / rebase / cherry-pick 冒充**：它们让候选 SHA 从
  master 不可达，而清单仍宣称产品 SHA，等于用历史形状撒谎。本仓库先例
  `0e72e0291`（`fix(authority): make the pinned baseline an ancestor of master (true merge,
  not squash)`）就是这条规则的成因。

### 7.4 候选 PASS ≠ master PASS（一句话，不可改写）

**候选 ref 上的一行 PASS（或 `V@B=yes`）只证明该行在候选树上成立；它不是、也永远不能被
提升为「最新 master PASS」。** 任何 gate、报告、PR 文案都不得把候选结论写成 master 的
current claim；master 的 current claim 只能来自 master 树上按 Q7 成立的证据。

### 7.5 两轨兼容方案（最小增量；由 owner 裁决「先给方案 + 负控，不放宽 Q7」）

**问题**：`V@B` 的含义是「在 Authority 唯一 baseline 命名的树上验过」，所以候选树上的
验证与 master 树上的验证无法在同一张矩阵里共存。

**方案（不动 `V@B`、不动 Q7、不动 Authority 语义）**：矩阵行 ⑥ 列可携带一个**可选的**
候选域 claim：

```
verifiedFor: <candidate-id>@<40-hex sha>
```

- `V@B` 仍是唯一 master 域声明；`verifiedFor` 只描述「该行在哪个候选版本上验过」。
- **合法组合**：`V@B=no` + `verifiedFor`（候选域 claim）与既有 `V@B=yes`（master 域 claim）
  可以同时存在于同一文件的不同行。
- **`V@B=yes` + `verifiedFor` = named RED**：同一行同时声称「在 Authority baseline current」
  与「只在候选 X 上 current」是矛盾声明；候选 claim 永远不满足 master claim。这条拒绝
  与 drift 无关，是本方案的负控核心。
- 读取该 claim 的 gate leg：**`state-freshness`**（唯一读 Q1–Q7 的 leg）。解析点在
  `scripts/ci-pr-gate.mjs` 的 `checkContractValues` Q5 行循环：抽取 `verifiedFor`，
  候选行**不进入** `claimedRows`（master 域），并新增独立的 `candidateClaims` 集合。
- 新增 provider（只在 `state-freshness` leg 接线，不新增 leg、不改 drift 法则）：
  `candidateRefProvider(candidateId, sha)` → `{ tip, drift }`，实现 = `git rev-parse
  refs/heads/candidate/<id>`（回退 `refs/remotes/origin/candidate/<id>`）+ `git diff
  --name-only <sha> <tip> -- <产品面>`。provider 缺失 / git 失败 = FAIL（未知永不当空）。
- **候选前进时什么变红**（三条，全部 named）：
  1. `Q7_CANDIDATE_REF_MOVED`：ref tip ≠ 行内 sha。修复必须开新候选版本；旧版本行在重跑或
     显式 `reacceptance: preserved`（附 diff 触及面）之前保持红。
  2. `Q7_CANDIDATE_MANIFEST_MISMATCH`：`dev/engineering/candidates/<id>.json` 的
     `candidate_commit`/产品 tree/blob 与 `git rev-parse <tip>:<path>` 不再逐项相等——
     同一 id 下的产品漂移，直接拒绝。
  3. `Q7_CANDIDATE_UNVERIFIABLE`：有候选 claim 却没有 provider / ref 不存在 / 清单缺失。
- **master 侧不变**：候选行不进入 `claimedRows`，所以既不会替 master 消掉 Q7 的
  `product surface moved since baseline` 红，也不会因为 master 前进而把候选行判红。
- **负控（已实现，未改 gate 语义）**：`tests/s2-authority/candidate-track-negative-control.test.mjs`。
  今日行为：`V@B=yes` + 候选注释 + master 产品漂移 → `Q7` 红（N1）；去掉注释同样红
  （N1-control，证明红不是注释语法造成的）；`V@B=no` + 候选注释 + master 漂移 → 绿
  （N2，两轨共存）；干净 master 行 + 无漂移 → 绿（N3，控制非空转）。**它会在一种回归下
  变红**：未来 parser 一旦把带候选注释的行从 master 的 Q7 集合里排除、却没有补上
  `V@B=yes`+`verifiedFor` 的 named 拒绝，N1 的 Q7 finding 消失，测试即失败。
  parser 落地时该测试必须收紧为断言上述 named 拒绝（漂移无关），而不是删除。
- **为什么这不是放宽**：`verifiedFor` 是**新增**的、范围更窄的声明；它不改变任何既有
  行的判级、不改变 `V@B` 的 yes/no 语义、不给任何行增加 master 可信度。Q7 的 master
  分支字节不变。

### 7.6 Authority 指针的决定：**不移动**，留在 integration baseline

- 决定：`dev/engineering/current-authority.json` 保持 `as20261105r2`（baseline
  `1484fa4ee…`），**不**改成候选 `25e106b…`。候选身份由 7.1 清单 + 7.5 行级 claim 承载。
- 实测依据（本机，2026-11-06 轮）：
  - 指针按现状：`state-freshness` pass，`claimed 0, drift 28`。
  - 假想指针移到 `25e106b`、矩阵仍全 `V@B=no`：`drift 28, claimed 0` → **仍然 pass，
    但 `V@B=yes` 没有可断言的对象**（指针移动是空转的）。
  - 假想指针移到 `25e106b` 且候选行写 `V@B=yes`：`drift 28, claimed 4` → **Q7 红**
    （外加 `NEEDS_REVALIDATION` 与 `V@B=yes` 的矛盾红）。也就是说：指针移动要么什么
    都不说，要么一说就红，因为候选树不是 master 的树。
- 因此「移动指针」不是表达候选验证的正确工具；行级 `verifiedFor` 才是。这也避免把
  单例六字段 baseline 变成随 lane 漂移的第二权威。

## 8. 两条轨道的组织学补充（集成轨/候选轨在本计划里怎么落地）

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

### 8.1 分支、冻结与合并规则

1. **集成 PR**：一任务一分支一 worktree 一 writer，合入 `master`；共享装配文件（`index.ts`、
   `tsconfig*.json`、产品入口、Authority、Member 生命周期）**只有 Integration Owner** 可变。
2. **冻结**：从**当时的集成 head** 切候选分支、冻结到某个 commit，并写下 §7.1 的**候选清单**
   （`dev/engineering/candidates/<id>.json`，不可变）。**冻结不发布以候选 head 为 `baseline` 的新快照**——
   §7.6 已裁定指针留在 integration baseline；候选身份由清单 + 行级 `verifiedFor` 承载。
3. **指针**：`dev/engineering/current-authority.json` 只由 Integration Owner 通过
   `scripts/switch-authority.mjs` 移动。**按 §7.6，候选不移动指针**（指针移动对候选而言要么什么都不说、
   要么一说就红）；指针只为「集成 baseline 本身重切」而移动。候选运行期间，运行记录仍必须携带
   **它以为在观察的快照 digest + 实际观察到的指针**两份事实（`bindings.candidateSnapshot` /
   `bindings.authorityObserved`），不靠“事后 re-stamp”把观察改写成想要的样子。
4. **冻结期间不放行任何产品改动**：`packages/**`、`scripts/**`、`tests/paths.mjs`、
   `package.json`、`pnpm-lock.yaml`（Q7 的 drift 集）在冻结窗口内不动。文档/证据/测试基础设施
   可以在 `master` 上继续集成（它们不在 drift 集内），但**不得与候选的产品面产生语义差**。
5. **候选内的“修复”= 重新冻结，不是原地改树**（规范细节见 §7.2 / §7.3）：影响该候选安全性/正确性的修复只能作为
   **受控变更**进入——切新候选 head、发布新快照、把旧 run 记为 `superseded`，保留其证据与判定。
   对已冻结树做 `commit --amend` / rebase / 追加产品提交都是禁止的（那会让“被测过”与“证据指向”
   脱钩）。
6. **“旧候选通过了它的测试” ≠ “master 的最新通过了”**（§7.4 是这一条的正本）。候选的 C2 证据只证明**它自己的树**；
   `master` 产品面一动，该证据的 current claim 立刻是 `NEEDS_REVALIDATION`，无论候选当时多绿。
   这条不因候选是“最终候选”而放宽。

### 8.2 Q7 的代价如何降低（不改变 Q7）

Q7 本身**不得放松**：它是“当前验证必须关于会合入的树”这一安全不变量的机器表达。可改的只有
**触发次数**：

- 每次冻结窗口内发生一次产品合并 ⇒ 一次 drift ⇒ 该候选的 live 断言全部作废 ⇒ 一次重验 boot。
- 因此 **Q7 成本 = 冻结窗口内的产品合并次数 × 需要 live 的行数**，而不是“Q7 太严”。
- 唯一合法的降本手段是**冻结期间少改产品**：把产品改动集中在冻结之前（集成轨），把冻结窗口压到
  只跑验收的长度。**不是**改 gate、不是改 baseline 指向、不是“先合并再补证据”。
- 实测：`#606`（28 条产品路径）使 candidate-1 的四行在同一小时内由 `V@B=yes` 退回 `no`；
  此前 `#598`/`#599`/`#600` 已让 BL-16 的六行同样退回。这两次都是**合并时机**的成本，不是
  Q7 的缺陷。
### 8.3 当前状态（`#609` 与 `#611` 之后，2026-11-06）

本节替换第一轮写的「当前观测到的轨道冲突」——那条冲突**已经修好**，继续留着就是一条过期断言：

- `#609` 用**真 merge**（非 squash）把候选 `1484fa4ee` 并入 master 历史，
  `git merge-base --is-ancestor` 为真，`state-freshness` 的 `Q4` 转绿，派生视图
  `baseline_is_ancestor_of_head` 回到 `true`。**指针与快照没有移动过**：指针仍指 `as20261105r2`，
  只是它命名的 baseline 现在是真实祖先。
- `#611` 已合入：候选 ref `candidate/a5sf-fs-search-1` + 不可变清单
  `dev/engineering/candidates/cand-a5sf-fs-search-1.json` 落地，机制细节见上面的 §7。
  **尚未落地的是 §7.5 的 gate 侧读取**（`verifiedFor` 的解析点、`candidateRefProvider`）——
  `scripts/ci-pr-gate.mjs` 未被本计划改动，所以 `verifiedFor` 现在只是行内声明，还没有机器复核。
  这是 #611 的后续项，不是本计划可以顺手做的（改 gate 属 CI 面）。
- 因此：**两条轨道的划分仍然成立，但"集成轨被候选指针卡住"这个症状已消失**。剩余的真实成本
  只有 §8.2 那一条（冻结窗口内的产品合并次数），以及 `verifiedFor` 尚无 gate 复核这一条待办。


## 9. 下一批可执行任务（2026-11-06）

规则：**每个共享文件只有一个 owner**；一个任务 = 一个最小纵切；`C1` = host-free 验收，
`C2` = live 验收；`boot` = 是否需要 Host 启动（当前剩 3 次：BL-17 live、BL-18 live、一次重试）。
**产品文件（`packages/**`）的任何一行改动都必须由 Capability Implementer 以独立 PR 提交**；
本表只是分配，不是开工授权。

| # | 任务 | Face | 依赖 | 唯一 owner 文件（共享文件仅此一处） | 最小纵切 | C1 验收 | C2 验收 | boot |
|---|---|---|---|---|---|---|---|---|
| T-01 | **PREFLIGHT-BUNDLE**：两个 live driver 在花 start 之前写出 `preflight-bundle.json` 并以 `scripts/a5sf-preflight.mjs` 的 PASS 为开工条件 | cross | 本 PR 的 preflight + 负控 | `tests/world-factory/lib/a5sf-acceptance-preflight.mjs`（共享契约）；每个 driver 在自己的证据目录内改**仅一个** `run-boot.mjs` | driver `--plan` 生成 bundle → preflight PASS/FAIL → 不 PASS 不 boot | 别名 fixture 红 / 干净 bundle 绿（已具备，D1–D15） | — | 否 |
| T-02 | **~~RECUT-BASELINE~~ — DROPPED（2026-11-06）**：原打算把集成 head 重切为 authority baseline 以消掉 Q4 红。**两处前提都已消失**：(a) `#609` 用真 merge 修好 ancestry，`Q4` 已绿；(b) `#611` §7.6 裁定指针**不移动**。保留此行只为记录「它曾被排期、为什么不再做」，**不得**据它去切 baseline | cross | —（已失效） | 无（不改指针、不发布快照） | — | — | — | 否 |
| T-03 | **BL-17-LIVE**：持久 bash 的 live 半场（同 PTY 多命令、只写不读、`chmod` 缺口、禁网、旧代 PTY 拒用） | Shell-PTY | T-01（bundle 预检）；BL-17 host-free 半场已绿；allocation #2 由 owner 解冻 | `dev/agent-workflow/evidence/a5sf-bash/run-boot.mjs`（新） | 单次 boot 跑 §8 八步，逐步落盘 | 21 臂保持绿（回归，不是新验收） | §8 step 1–8 逐条带 exit code | **是**（1） |
| T-04 | **BL-18-WEBFACE**：让受管 Member 的 `web_fetch` 真的解析到 confined `web` face（现无 row config key / service / constructor） | Web | 先合入一条**绿**的转发改动；`#608` 视为未完成，不得在其上继续 | `packages/runtime/src/plugin/live/a5sf-realm-row.mjs` | 行配置转发 `{ effective, provider.fetch, provider.search }` → realm 挂载 → 无 face 时组合期仍 typed 拒绝 | host-free 臂：转发后 `faces.web` 为真、无 face 时 `A5SF_NETWORK_UNCONFINED_REALM` 仍拒 | BL-18 §8 step 1–8（`strace` 零 connect/DNS） | **是**（1，合并后） |
| T-05 | **FS-SEARCH-REVALIDATE**：在**新集成 head** 上重跑 FS/Search C2（M-01/M-02/M-06/M-07） | FS Provider + Subprocess | T-01、T-02；候选必须从新基线切 | `dev/agent-workflow/evidence/a5sf-candidate1/run-boot.mjs`（既有文件，唯一 writer） | 冻结候选 → 预检 PASS → 单次 boot → 11/11 | 预检 PASS + judged fixtures 不变 | 11/11（含 productTreeProof） | **是**（1） |
| T-06 | **BL-19-PTC-C1**：`run_code`/PTC 的 C1 判定（它是执行模式不是可装载模块） | External execution | BL-21 源清单已 DONE；无产品依赖 | `docs/plans/active/alpha5-sandbox-first/NATIVE-SOURCE-INVENTORY.md` | 写出“无 routed-native 接入面”的具名判定与最小负控设计 | 一个 host-free 测试把该判定钉住（不接受即红） | — | 否 |
| T-07 | **EXT-FACE-DESIGN**：为 LSP / MCP 面**先设计**最小正/负测试（在首个产品实现之前） | External execution | T-06 | `tests/world-factory/a5sf-external-face.test.mjs`（新） | 每面一正一负的**契约测试**（不实现产品） | 测试在无产品接线时以 `NOT_WIRED` 判定 fail-closed | — | 否 |
| T-08 | **NONDATA-AUDIT**：M-19/M-20/M-21 是否真的无数据面 I/O；有则重新归面 | Non-data-plane | 无 | `docs/plans/active/alpha5-sandbox-first/TOOL-ACCEPTANCE-MATRIX.md` §1.1 | 逐行判定 + 证据路径；不改等级 | 一个 host-free 检查：任何“读写文件”的工具名不得留在本面 | — | 否 |
| T-09 | **ADAPTER-DEDUP（提案，未排期）**：收敛 `subprocess.ts` 对上游 `OutputCollector` / `childEnv` 的重复实现 | Subprocess | owner 批准（触碰产品） | `packages/runtime/team-services/src/subprocess.ts`（唯一） | 用上游公开 seam 替代本地 collector/env，或明确声明“不替代”并写理由 | 现有 313/313 臂保持绿 | 现有 live 行不变 | 否 |

**未列入本表的东西**：`#608` 的续写（`#608` 本身已合入且 CI 绿；它的续写——把 web face 纳入默认
产品 preset——未完成，且第 4 步起仍需 live）；任何改变
`rg` allow-list 的“通用化”改动（BL-41 明确它不是通用安全模型）；任何 Q7/CI/Authority 的放宽。
