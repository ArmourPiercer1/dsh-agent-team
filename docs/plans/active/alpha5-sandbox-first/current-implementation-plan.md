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
