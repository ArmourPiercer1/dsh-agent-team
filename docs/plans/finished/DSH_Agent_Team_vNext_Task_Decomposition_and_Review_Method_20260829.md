# DSH Agent Team vNext — 任务分包与审查方法

> 日期：2026-08-29  
> **状态：已归档｜执行协议已实际执行完毕；G0–G7、G8/G8-S 相关闭环及后续 P9 终验均有日志留痕；P10 未启动。**  
> **真正执行进度：** 本协议支撑并记录了 P0–P9 主线的任务隔离、三方 Gate 审查、补充重审、阻塞裁决与推送纪律；后续专项修复沿用其规则，但未改变本协议的冻结语义。  
> **完成时间：** 2026-09-05（P9 产品合流/推送收口；后续专项执行日志延伸至 2026-09-08）  
> 文档性质：**执行规范 / Agent Orchestration Plan / Review Protocol**  
> 适用范围：`dsh-agent-team` major-version refactor  
> 上位文档：
> 1. `DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md`
> 2. `DSH_Agent_Team_vNext_Detailed_UI_Design_20260829.md`
> 3. `DSH_Agent_Team_vNext_Detailed_Development_Plan_20260829.md`
>
> 本文不重新定义产品语义。若本文与上位文档冲突，以**架构文档 → UI 文档 → 开发计划 → 本文**的顺序处理；本文只能细化“谁做、何时做、如何隔离、如何审查、何时可合并”。

---

# 0. 专项审查结论

在正式拆包前，对第三份开发计划进行了面向 Agent 执行的专项审查。结论如下。

## 0.1 新发现 1：package-level parallelism 不足以保证安全

多个任务即使修改不同 package，也可能共同依赖同一 contract：

```text
Domain DTO
TeamDomain schema
Operation Journal protocol
Remote DTO
Client store contract
Migration manifest
```

如果多个 subagent 同时“顺手”修改这些共享接口，最终会得到局部正确、整体不兼容的实现。因此本文引入：

```text
CONTRACT FREEZE
→ FAN-OUT
→ INTEGRATION REVIEW
```

以及共享写入面的 `WRITE_LOCK` 规则。

## 0.2 新发现 2：coding review 必须与实现上下文分离

worker 自测只能形成 implementation evidence，不能替代 Gate review。所有硬 Gate 都要求至少一个没有参与被审实现的 reviewer，以 frozen spec、diff、tests、运行证据重新判断。

```text
Implementer ≠ Reviewer
Reviewer ≠ Gate owner
```

同一个底层模型可以承担不同角色，但必须使用**独立 Agent/session、独立上下文和只读/审查型任务包**。

## 0.3 新发现 3：主 Agent 不能退化为“另一个编码者”

主 Agent 的核心职责是：

```text
任务图维护
依赖判定
worktree/branch 分配
共享 contract 锁管理
结果收集
review 分派
cherry-pick / integration
Gate 判定
blocker 升级
```

主 Agent默认**不承担常规 feature coding**。只允许进行：

```text
机械冲突整理
版本号/CHANGELOG/manifest 汇总
由已审查结果机械生成的 integration-only 修改
```

如果主 Agent开始承担大量实现工作，review independence 会迅速失效。

## 0.4 新发现 4：旧代码复用必须通过“摘取”而不是“搬迁”

第三份计划已冻结：旧 `feat/team-vnext-integration-20260829` 是 `LEGACY_REFERENCE`。因此所有复用任务必须写明：

```text
SOURCE = legacy reference
TARGET = fresh dsh-agent-team task worktree
METHOD = selective transplant / rewrite / behavior reference
```

禁止让 worker 把整个旧 package 复制进新仓库后再删改。

## 0.5 是否需要新的用户裁决

**不需要。**

本轮发现均属于工程执行纪律，可以在不改变已冻结架构的前提下解决。因此本文直接进入完整任务分包。

---

# 1. 总体执行模型

推荐采用：

```text
Human Owner
    │
    ▼
Main Agent / Orchestrator
    │
    ├──────────────┬──────────────┬──────────────┐
    ▼              ▼              ▼              ▼
Implementer A   Implementer B   Test/Probe C   Reviewer R
    │              │              │              │
    └──── task branches/worktrees ───────────────┘
                         │
                         ▼
                Phase Integration Branch
                         │
                         ▼
                    Gate Review
                         │
                         ▼
                        main
```

核心原则：

1. **主 Agent 管理状态，不依赖 worker 的长期记忆。**
2. **每个 task 都有完整 task packet，可以被另一个 Agent 接手。**
3. **每个 worker 只写自己的 worktree。**
4. **只有主 Agent 能写 Phase integration branch / `main`。**
5. **共享 contract 由单一 owner task 写入。**
6. **Reviewer 不直接修被审代码。**
7. **任何 Team-required upstream 修改都必须停止并报 `CORE_SEAM_BLOCKER`。**

---

# 2. 角色定义

## 2.1 Human Owner

只处理真正需要产品/架构裁决的问题：

```text
frozen spec conflict
critical public seam missing and no frozen fallback
release scope change
backward-compatibility policy change
```

普通实现细节、测试失败、局部重构不应升级给用户。

## 2.2 Main Agent / Orchestrator

必须维护：

```text
current phase
current gate
ready queue
blocked queue
write locks
task -> branch/worktree
task -> worker
task -> reviewer
approved commits
integration SHA
known blockers
```

主 Agent 的输出不是大量代码，而是**稳定的任务图和可审计的 integration state**。

## 2.3 Implementer Worker

职责：

```text
只完成一个 task packet
只修改 owned files / explicitly allowed integration files
写测试
运行自检
提交 atomic commit(s)
输出 TaskResult
```

不得：

```text
改 upstream source
改未授权 shared contract
顺手重构相邻 package
隐藏失败测试
自行降低验收条件
```

## 2.4 Characterization / Test Worker

优先承担：

```text
public seam probe
fault injection
race reproduction
black-box compatibility
zero-core compliance
performance harness
```

它与 feature implementer 可以并行工作，但测试 contract 必须先冻结。

## 2.5 Reviewer

Reviewer 的输入只应包含：

```text
frozen spec excerpts
TaskPacket
base SHA
candidate diff/commit
TaskResult
relevant test output
```

不读取 implementer 的长讨论/思考过程，避免被实现路径锚定。

Reviewer 只能给：

```text
APPROVE
REQUEST_CHANGES
BLOCK
```

不得直接在 implementation branch 修代码后“自批”。

## 2.6 Gate Reviewer / Architecture Reviewer

Gate reviewer 审查的是**整个 Phase 的组合结果**，不是单个 PR。至少覆盖：

```text
cross-task invariant
integration behavior
forbidden dependency
negative tests
failure mode
spec completeness
```

G2/G3/G4/G7/G10 推荐使用最高推理能力 reviewer。

---

# 3. Git / Worktree 执行规范

## 3.1 四类长期 checkout

```text
/workspaces/
├─ deepseek-harness-upstream/        # pristine, read/test host
├─ deepseek-harness-downstream/      # optional non-Team fork features
├─ dsh-agent-team/                   # authoritative new repo
└─ legacy-team-reference/            # frozen a3ab319..., read-mostly
```

`legacy-team-reference` 绝不作为 task branch 的 base。

## 3.2 branch 命名

推荐：

```text
task/P3-T2-blueprint
review/P3-T2-r1            # 通常无需真实分支；如需保存 review fixture 可用
int/P3-domain-policy
fix/P3-T2-r1-<short>
```

## 3.3 worktree 规则

每个 implementation task：

```text
one task
→ one branch
→ one worktree
→ one writer agent
```

禁止两个 agent 同时写一个 worktree。

示意：

```bash
git worktree add ../wt-P3-T2 -b task/P3-T2-blueprint <approved-base-sha>
```

## 3.4 task base SHA

TaskPacket 必须记录：

```text
repo
base branch
base SHA
required dependency task SHAs
contract generation/version
```

worker 不得自行 rebase 到“看起来更新”的 main。

## 3.5 integration

所有 task 先经过 review，再由主 Agent：

```text
cherry-pick -x <approved task commit(s)>
```

进入：

```text
int/Px-...
```

Phase Gate 通过后，integration branch 才进入 `main`。

这样可以保证：

```text
unreviewed commit cannot accidentally enter main
```

## 3.6 shared write locks

以下文件/区域默认是 `LOCKED_SURFACE`：

```text
packages/contracts/**
TeamDomain schema + migrations
OperationJournal protocol
Remote contract/DTO exports
package public exports
migration/provenance manifest
client root store contract
release compatibility matrix
```

只有明确的 owner task 能修改。

其他 worker 如果发现必须修改：

```text
CONTRACT_CHANGE_REQUEST
```

而不是直接编辑。

---

# 4. TaskPacket 标准

每个任务必须具有以下字段：

```yaml
task_id: Pn-Tm
title: ...
objective: ...
architecture_rationale: ...
repo: dsh-agent-team | downstream-host | legacy-reference-readonly
base_sha: ...
owned_paths: [...]
allowed_dependencies: [...]
forbidden_paths: [...]
prerequisites: [...]
locked_contracts: [...]
implementation_notes: ...
required_tests: [...]
acceptance_criteria: [...]
required_outputs: [...]
difficulty:
  reasoning: 1..5
  coding: 1..5
  testing: 1..5
recommended_agent_class: A | B | C
parallel_group: ...
blocker_policy: ...
```

## 4.1 全局 forbidden block

必须自动附加到**每个** coding/probe task：

```text
FORBIDDEN:
- modify deepseek-harness upstream source
- import unexported/private deepseek-harness source paths
- patch-package / pnpm patch against upstream
- postinstall rewrite of upstream files
- git apply / scripted edits into upstream checkout
- vendor modified copies of upstream core/api/client/subagent/preset code
- use legacy Team SessionEvent vocabulary as vNext control-plane authority

IF REQUIRED:
STOP immediately.
Emit CORE_SEAM_BLOCKER:<specific-seam> with evidence.
Do not implement a workaround by patching upstream.
```

## 4.2 TaskResult 标准

worker 必须输出：

```yaml
task_id: ...
status: SELF_VERIFIED | BLOCKED
base_sha: ...
head_sha: ...
files_changed: [...]
tests_run:
  - command: ...
    result: PASS|FAIL
behavior_proven: [...]
assumptions: [...]
deviations: [...]
contract_change_requests: [...]
blockers: [...]
followups: [...]
```

## 4.3 ReviewResult 标准

```yaml
task_id: ...
reviewer: independent-session-id
verdict: APPROVE | REQUEST_CHANGES | BLOCK
spec_checks: [...]
findings:
  critical: [...]
  major: [...]
  minor: [...]
missing_tests: [...]
forbidden_dependency_check: PASS|FAIL
reviewed_head_sha: ...
```

---

# 5. Task 状态机

```text
DEFINED
  ↓
READY
  ↓
CLAIMED
  ↓
IMPLEMENTING
  ↓
SELF_VERIFIED
  ↓
READY_FOR_REVIEW
  ├─ REQUEST_CHANGES → IMPLEMENTING
  ├─ BLOCK → BLOCKED
  └─ APPROVE
        ↓
INTEGRATION_READY
        ↓
INTEGRATED
        ↓
GATE_VERIFIED
        ↓
DONE
```

任何阶段均可进入：

```text
BLOCKED
```

但只有主 Agent 可以将其重新标记为 READY。

---

# 6. Blocker 协议

## 6.1 `CORE_SEAM_BLOCKER`

格式：

```text
CORE_SEAM_BLOCKER:<SEAM>

Observed:
Expected public behavior:
Minimal reproduction:
Public APIs tested:
Why private/source patch would be required:
Affected tasks:
Affected frozen invariant:
Possible already-approved fallback, if any:
```

主 Agent动作：

```text
1. freeze all dependent tasks
2. allow unrelated tasks to continue
3. assign independent reproduction reviewer
4. if reproduced and no frozen fallback exists → escalate to Human Owner
```

## 6.2 `CONTRACT_CHANGE_REQUEST`

用于：

```text
worker needs to change shared DTO/schema/public export
```

主 Agent必须把它交给 contract owner，不允许 worker drive-by edit。

## 6.3 `SPEC_CONFLICT`

只有当两份 frozen 文档真的产生不可同时满足的语义时使用。

## 6.4 `DEPENDENCY_BLOCKER`

例如 dependency task 尚未合入、预期 symbol 不存在。不得以复制内部实现绕开。

## 6.5 `TEST_INFRA_BLOCKER`

测试基础设施缺失不等于产品 seam 缺失。必须分开报告。

---

# 7. Review 层级

## R0 — Worker self verification

不是正式审查。只证明“worker 知道自己的实现至少通过了哪些测试”。

## R1 — Automated policy review

主 Agent自动运行：

```text
lint
typecheck
unit tests
owned-path check
private-import scan
zero-core scan
unexpected generated diff scan
```

## R2 — Independent task review

重点：

```text
TaskPacket 是否完成
是否越界修改
实现是否与 frozen semantics 相符
negative cases 是否存在
测试是否真的覆盖 acceptance criteria
```

## R3 — Integration review

任务 individually APPROVE 仍不足以合格。R3 检查：

```text
contract drift
duplicate authority
cross-package behavior
error propagation
race between independently implemented components
```

## R4 — Phase Gate review

逐条执行 G0..G10，必须引用实际 evidence。

不得写：

```text
"looks good"
"should work"
```

而必须写：

```text
criterion -> command/test/artifact -> PASS/FAIL
```

## R5 — Release audit

G10 前由未参与主要实现的 reviewer 执行，重点寻找：

```text
hidden upstream diff
fork-only dependency
private import
legacy Team control-plane residue
dormant ordinary-session behavior change
unsupported compatibility claim
```

---

# 8. 并行化判定规则

两个任务只有同时满足以下条件才允许并行写代码：

```text
1. owned path 不重叠
2. 不共同拥有 LOCKED_SURFACE
3. 输入 contract 已冻结
4. 一个任务不需要消费另一个任务的未提交行为
5. 测试 fixture 不互相重写
6. 不要求修改同一 migration/schema version
```

允许：

```text
P9 Timeline renderer || P9 Members renderer
```

禁止直接并行：

```text
Remote DTO design || client store contract design
TeamDomain schema v2 || another task editing same schema v2
```

正确方式：

```text
contract owner freezes vN
        ↓
fan-out consumers in parallel
        ↓
integration review
```

---

# 9. Agent 能力分级

不绑定具体供应商/模型名，使用三类 worker。

## Class A — Architecture / adversarial reasoning

适用：

```text
public seam characterization
policy/compatibility
TeamDomain recovery
lifecycle/fork
cross-package integration review
Gate review
```

## Class B — Reliable implementation

适用：

```text
parser/catalog
repository layer
Remote handlers
UI components
projection models
test implementation
```

## Class C — Fast mechanical worker

适用：

```text
provenance enumeration
mechanical transplant
fixture generation
lint/type cleanup
doc tables
compliance script maintenance
```

评分：

```text
R = architecture reasoning 1..5
C = coding/integration 1..5
T = testing/adversarial 1..5
```

只要 `R=5` 或任务可改变 architecture boundary，就至少使用 Class A 实现或 Class A review。

---

# 10. 全局 Phase DAG

```text
P0 Freeze/Provenance
        ↓ G0
P1 Decontaminate + Fresh Repo
        ↓ G1
P2 Public Seam Characterization
        ↓ G2
P3 Contracts / Domain / Blueprint / Policy
        ↓ G3
P4 TeamDomain / Journal / Recovery
        ↓ G4
P5 Agent Binding / Member Substrate
        ↓ G5
P6 Activation / Runtime / Coordination
        ↓ G6
P7 Advanced Semantics / Fork / Legacy
        ↓ G7
P8 Remote / Projection
        ↓ G8
P9 External Web UI
        ↓ G9
P10 Hardening / Release
        ↓ G10
      RELEASE
```

Phase 间默认串行 Gate；Phase 内尽量 fan-out。

---
# 11. 分 Phase 任务图与 Task Cards

> **Package-boundary rule**：本文的任务 ownership 是“模块/目录级 ownership”，不改变第三份开发计划冻结的 9-package 结构：`contracts / domain / storage / runtime / tools / remote / client / legacy / testkit`。例如 policy、compatibility、Blueprint 属于 `packages/domain/**`；TeamDomain 属于 `packages/storage/**`；Binder、Activation、Projection 属于 `packages/runtime/**`。除非未来另有独立架构决策，worker 不得因为任务拆分方便而新建第 10 个 production package。

> **Gate-preparation rule**：部分 task 名称包含“+ Gx”或“audit”，仅表示为 Gate 准备集成证据；它们**绝不替代正式的 `Gx-REVIEW` 独立 Gate task**。正式 Gate verdict 仍必须由未参与该 Phase 主要实现的 reviewer 给出。

## 11.1 P0 — Freeze Legacy & Provenance Audit

**Phase 内依赖图：**

```text
P0-T1 → {P0-T2 || P0-T3 || P0-T4} → G0
```

| Task | 主题 | 前置 | 并行组 | 难度 | Agent |
|---|---|---|---|---|---|
| `P0-T1` | 冻结 legacy reference | 无 | `A0` | `R2/C1/T2` | C |
| `P0-T2` | commit provenance audit | P0-T1 | `A1` | `R3/C2/T2` | B |
| `P0-T3` | file+hunk provenance audit | P0-T1 | `A1` | `R4/C2/T3` | A |
| `P0-T4` | legacy behavior/reuse inventory | P0-T1 | `A1` | `R4/C2/T3` | A |

### P0-T1 — 冻结 legacy reference

- **目标**：把当前 Team integration 精确冻结为只读历史参考，并记录 upstream/legacy SHA。
- **拥有的文件/包**：`downstream host tags/notes；legacy checkout metadata`
- **前置依赖**：无
- **允许依赖**：Git/tag/read-only policy
- **禁止项**：全局 forbidden block。 额外禁止：不得重写 legacy 历史。
- **实现要点**：建立 `legacy-agent-team-pre-vnext`；记录禁止继续 vNext development。
- **必须测试**：验证 tag 指向预期 SHA；legacy worktree clean。
- **验收标准**：tag/sha 精确；旧 branch 明确 reference-only。
- **输出物**：legacy tag；freeze note；TaskResult
- **难度**：`R2/C1/T2`；推荐 `Class C`。
- **并行关系**：`A0`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P0-T2 — commit provenance audit

- **目标**：逐 commit 分类 TEAM / GENERIC_FORK_CAPABILITY / UNRELATED / GENERATED / MIXED。
- **拥有的文件/包**：`migration/provenance manifest`
- **前置依赖**：P0-T1
- **允许依赖**：Git history only
- **禁止项**：全局 forbidden block。
- **实现要点**：先做 commit 粒度，再给 MIXED 标记，不在此任务修改代码。
- **必须测试**：manifest schema validation；随机抽样 commit 对照 diff。
- **验收标准**：所有 ahead commits 有分类与理由。
- **输出物**：machine-readable commit manifest
- **难度**：`R3/C2/T2`；推荐 `Class B`。
- **并行关系**：`A1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P0-T3 — file+hunk provenance audit

- **目标**：对所有 changed files，尤其 MIXED 文件，标注 Team hunk 与非 Team hunk。
- **拥有的文件/包**：`migration/provenance manifest file entries`
- **前置依赖**：P0-T1
- **允许依赖**：Git diff / legacy source readonly
- **禁止项**：全局 forbidden block。
- **实现要点**：覆盖 core/api/client/bundle/docs/permission/model UI；生成 disposition 建议。
- **必须测试**：manifest completeness script；changed-file set 差集必须为空。
- **验收标准**：每个 changed file 有 owner/disposition；MIXED 有 hunk note。
- **输出物**：file manifest；mixed-hunk report
- **难度**：`R4/C2/T3`；推荐 `Class A`。
- **并行关系**：`A1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P0-T4 — legacy behavior/reuse inventory

- **目标**：把旧 delegate/message/control/progress/cold resume/UI 等行为变成 reference fixture inventory，并标 MIGRATE/REWRITE/REFERENCE_ONLY。
- **拥有的文件/包**：`docs/migration；test/reference-fixtures metadata`
- **前置依赖**：P0-T1
- **允许依赖**：legacy source readonly
- **禁止项**：全局 forbidden block。
- **实现要点**：特别标出纯 UI algorithm 与错误 runtime assumption。
- **必须测试**：inventory 与 legacy tests/package list 交叉检查。
- **验收标准**：后续 task 能按 inventory 找到参考实现，但不以旧包为依赖。
- **输出物**：behavior inventory；reuse map
- **难度**：`R4/C2/T3`；推荐 `Class A`。
- **并行关系**：`A1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### G0 Gate 执行方法

主 Agent 不得因为本 Phase task 全部 `APPROVE` 就自动通过 Gate。必须另外创建一个 `G0-REVIEW` task，由独立 reviewer：

```text
1. checkout Phase integration SHA
2. 读取上位文档中对应 Gate 条目
3. 重跑关键 positive + negative tests
4. 执行 zero-core/private-import/owned-boundary 检查
5. 对 cross-task invariants 做组合审查
6. 输出 criterion -> evidence -> PASS/FAIL
```

只有所有 criterion PASS 才能由主 Agent 将 integration branch 合入 `main`。

---

## 11.2 P1 — Host Decontamination + Fresh Repo Foundation

**Phase 内依赖图：**

```text
{P1-T1 || P1-T2 || P1-T3 || P1-T4} → P1-T5 → G1
```

| Task | 主题 | 前置 | 并行组 | 难度 | Agent |
|---|---|---|---|---|---|
| `P1-T1` | 重建 upstream-clean downstream host | P0-T2,P0-T3 | `B1` | `R5/C4/T4` | A |
| `P1-T2` | 拆出 fork-only permission capability | P0-T3 | `B1` | `R4/C3/T3` | A |
| `P1-T3` | 保留 unrelated fork features | P0-T2,P0-T3 | `B1` | `R3/C3/T3` | B |
| `P1-T4` | 建立 fresh dsh-agent-team skeleton | P0-T4 | `B1` | `R3/C3/T3` | B |
| `P1-T5` | 建立 zero-core compliance + G1 smoke | P1-T1,P1-T4 | `B2` | `R4/C3/T5` | A |

### P1-T1 — 重建 upstream-clean downstream host

- **目标**：从 pinned upstream 正向重放非 Team 功能，避免从 contaminated branch 反向删。
- **拥有的文件/包**：`deepseek-harness-downstream branch/worktree`
- **前置依赖**：P0-T2,P0-T3
- **允许依赖**：upstream public source + provenance manifest
- **禁止项**：全局 forbidden block。
- **实现要点**：按 KEEP/SPLIT/UNRELATED 逐项重放；Team hunk 不进入新 host。
- **必须测试**：full host build/test；diff classification check。
- **验收标准**：active host 不含 Team-required core/api/client/bundle patch；非 Team 功能保留。
- **输出物**：clean-host SHA；replay mapping
- **难度**：`R5/C4/T4`；推荐 `Class A`。
- **并行关系**：`B1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P1-T2 — 拆出 fork-only permission capability

- **目标**：把 `packages/permission/**` 明确归为 downstream generic capability，而不是 Team mandatory substrate。
- **拥有的文件/包**：`downstream permission packages/docs`
- **前置依赖**：P0-T3
- **允许依赖**：downstream fork only
- **禁止项**：全局 forbidden block。
- **实现要点**：保持其自身可开发，但从 Team dependency graph 删除。
- **必须测试**：downstream permission tests；Team repo dependency scan。
- **验收标准**：Team 在没有 permission fork 包时仍可构建/characterize。
- **输出物**：permission split note；dependency proof
- **难度**：`R4/C3/T3`；推荐 `Class A`。
- **并行关系**：`B1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P1-T3 — 保留 unrelated fork features

- **目标**：根据 provenance 保存 model UI 等无关功能，不让它们进入 dsh-agent-team。
- **拥有的文件/包**：`downstream unrelated feature paths`
- **前置依赖**：P0-T2,P0-T3
- **允许依赖**：downstream fork only
- **禁止项**：全局 forbidden block。
- **实现要点**：逐项重放，必要时 path/hunk transplant。
- **必须测试**：对应 upstream/downstream tests。
- **验收标准**：无关功能保留；Team repo 无反向依赖。
- **输出物**：preservation report；SHA mapping
- **难度**：`R3/C3/T3`；推荐 `Class B`。
- **并行关系**：`B1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P1-T4 — 建立 fresh dsh-agent-team skeleton

- **目标**：新建 authoritative repo：workspace、build、lint、test、README、empty plugin。
- **拥有的文件/包**：`dsh-agent-team root；packages skeleton`
- **前置依赖**：P0-T4
- **允许依赖**：public npm/package APIs only
- **禁止项**：全局 forbidden block。
- **实现要点**：不得复制整个 legacy packages/team；先建立目标结构。
- **必须测试**：install/build/lint/test；empty plugin composition smoke。
- **验收标准**：独立 repo 可在 pristine host 挂载；legacy 不是依赖。
- **输出物**：repo skeleton；initial lockfile/config
- **难度**：`R3/C3/T3`；推荐 `Class B`。
- **并行关系**：`B1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P1-T5 — 建立 zero-core compliance + G1 smoke

- **目标**：实现 private import/patch mechanism/host dirty 检查，并在 pristine upstream 前后执行。
- **拥有的文件/包**：`scripts/verify-zero-core.*；integration smoke`
- **前置依赖**：P1-T1,P1-T4
- **允许依赖**：Git CLI；public plugin loader
- **禁止项**：全局 forbidden block。
- **实现要点**：host before/after `status`/`diff`; 扫 patch-package/pnpm patch/postinstall/private source imports。
- **必须测试**：故意注入违规 fixture 应被检测；pristine upstream smoke pass。
- **验收标准**：G1 所有 criterion 机器可证；host source diff=0。
- **输出物**：compliance report；smoke logs
- **难度**：`R4/C3/T5`；推荐 `Class A`。
- **并行关系**：`B2`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### G1 Gate 执行方法

主 Agent 不得因为本 Phase task 全部 `APPROVE` 就自动通过 Gate。必须另外创建一个 `G1-REVIEW` task，由独立 reviewer：

```text
1. checkout Phase integration SHA
2. 读取上位文档中对应 Gate 条目
3. 重跑关键 positive + negative tests
4. 执行 zero-core/private-import/owned-boundary 检查
5. 对 cross-task invariants 做组合审查
6. 输出 criterion -> evidence -> PASS/FAIL
```

只有所有 criterion PASS 才能由主 Agent 将 integration branch 合入 `main`。

---

## 11.3 P2 — Public Seam Characterization

**Phase 内依赖图：**

```text
P2-T1 → {P2-T2 || P2-T3 || P2-T4 || P2-T5} → P2-T6 → G2
```

| Task | 主题 | 前置 | 并行组 | 难度 | Agent |
|---|---|---|---|---|---|
| `P2-T1` | pristine characterization harness | P1-T5 | `C0` | `R4/C3/T4` | A |
| `P2-T2` | Agent create/resume/cold Root seam | P2-T1 | `C1` | `R5/C4/T5` | A |
| `P2-T3` | Preset/persona/model seams | P2-T1 | `C1` | `R5/C4/T5` | A |
| `P2-T4` | Tool/admission/skill/MCP seams | P2-T1 | `C1` | `R5/C4/T5` | A |
| `P2-T5` | Storage/fork/descendant seams | P2-T1 | `C1` | `R5/C4/T5` | A |
| `P2-T6` | Remote/client/additive UI seams + G2 audit | P2-T1,P2-T2,P2-T3,P2-T4,P2-T5 | `C2` | `R5/C4/T5` | A |

### P2-T1 — pristine characterization harness

- **目标**：建立只通过 public exports 启动 pinned upstream 的 probe/test harness。
- **拥有的文件/包**：`tests/characterization/**；CI job`
- **前置依赖**：P1-T5
- **允许依赖**：published/public DSH exports only
- **禁止项**：全局 forbidden block。
- **实现要点**：所有 seam probe 共用；不写产品 runtime。
- **必须测试**：harness self-test；private-import negative test。
- **验收标准**：能在 pristine upstream、无 fork-only packages 下运行。
- **输出物**：probe harness；host version fixture
- **难度**：`R4/C3/T4`；推荐 `Class A`。
- **并行关系**：`C0`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P2-T2 — Agent create/resume/cold Root seam

- **目标**：证明 setup ordering、fresh/cold resume、Root TeamDomain binding 在首个 Team-sensitive step 前可恢复。
- **拥有的文件/包**：`tests/characterization/agent-lifecycle/**`
- **前置依赖**：P2-T1
- **允许依赖**：public agents/session/events
- **禁止项**：全局 forbidden block。
- **实现要点**：构造 minimal Team-binding fixture，不实现正式 runtime。
- **必须测试**：fresh create；member resume；ordinary root cold resume；ordering trace。
- **验收标准**：所有关键顺序可执行证明，否则 `CORE_SEAM_BLOCKER:ROOT_COLD_BINDING` 等。
- **输出物**：ordering trace；probe tests
- **难度**：`R5/C4/T5`；推荐 `Class A`。
- **并行关系**：`C1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P2-T3 — Preset/persona/model seams

- **目标**：characterize AgentPreset composition、persona scope、complete:true detection、ModelSelection boundary。
- **拥有的文件/包**：`tests/characterization/preset-persona-model/**`
- **前置依赖**：P2-T1
- **允许依赖**：public preset/system-prompt/model APIs
- **禁止项**：全局 forbidden block。
- **实现要点**：complete:true 只验证可检测/阻断，不尝试 override。
- **必须测试**：complete=false；complete=true；model A→B future-boundary；cold resume。
- **验收标准**：支持冻结 1A persona 决策和 model semantics。
- **输出物**：seam report + tests
- **难度**：`R5/C4/T5`；推荐 `Class A`。
- **并行关系**：`C1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P2-T4 — Tool/admission/skill/MCP seams

- **目标**：分别验证 pre-step、pre-execute、tool visibility、skills、MCP 的 Agent-scope 控制能力。
- **拥有的文件/包**：`tests/characterization/capabilities/**`
- **前置依赖**：P2-T1
- **允许依赖**：public tool/skill/MCP APIs
- **禁止项**：全局 forbidden block。
- **实现要点**：skills/MCP 分开判定；不要由 tool seam 推断。
- **必须测试**：creation；cold resume；tighten；capability disappear。
- **验收标准**：每类 seam 有 PASS 或具体 blocker；禁止 private registry。
- **输出物**：capability seam matrix
- **难度**：`R5/C4/T5`；推荐 `Class A`。
- **并行关系**：`C1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P2-T5 — Storage/fork/descendant seams

- **目标**：验证 StorageDomain 外置持久化、fork lineage 可见性、generic descendant drain 能力。
- **拥有的文件/包**：`tests/characterization/storage-fork-descendants/**`
- **前置依赖**：P2-T1
- **允许依赖**：public storage/session/subagent APIs
- **禁止项**：全局 forbidden block。
- **实现要点**：只证明机制，不实现 TeamDomain。
- **必须测试**：restart persistence；root/member lineage fixture；descendant enumeration/interrupt。
- **验收标准**：G2 所需三个 seam 可证明或 blocker。
- **输出物**：probe tests；lineage evidence
- **难度**：`R5/C4/T5`；推荐 `Class A`。
- **并行关系**：`C1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P2-T6 — Remote/client/additive UI seams + G2 audit

- **目标**：验证 external Remote、dsh.client、conversation.view、New Team additive entry 等；汇总 seam manifest。
- **拥有的文件/包**：`tests/characterization/remote-client/**；seam-manifest`
- **前置依赖**：P2-T1,P2-T2,P2-T3,P2-T4,P2-T5
- **允许依赖**：public remote/client module/slot contracts
- **禁止项**：全局 forbidden block。
- **实现要点**：UI 非关键 seat 可使用已冻结 fallback；关键入口无 seam 则 blocker。
- **必须测试**：plugin discovery；view slot；sidebar/action；reconnect basic；全 seam manifest validation。
- **验收标准**：architecture-critical seams 全部 executable；G2 criterion 有证据。
- **输出物**：seam manifest；G2 report
- **难度**：`R5/C4/T5`；推荐 `Class A`。
- **并行关系**：`C2`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### G2 Gate 执行方法

主 Agent 不得因为本 Phase task 全部 `APPROVE` 就自动通过 Gate。必须另外创建一个 `G2-REVIEW` task，由独立 reviewer：

```text
1. checkout Phase integration SHA
2. 读取上位文档中对应 Gate 条目
3. 重跑关键 positive + negative tests
4. 执行 zero-core/private-import/owned-boundary 检查
5. 对 cross-task invariants 做组合审查
6. 输出 criterion -> evidence -> PASS/FAIL
```

只有所有 criterion PASS 才能由主 Agent 将 integration branch 合入 `main`。

---

## 11.4 P3 — Contracts / Domain / Blueprint / Policy

**Phase 内依赖图：**

```text
P3-T1(contract freeze) → {P3-T2 || P3-T3 || P3-T4 || P3-T5} → P3-T6 → G3
```

| Task | 主题 | 前置 | 并行组 | 难度 | Agent |
|---|---|---|---|---|---|
| `P3-T1` | 冻结 core contracts/IDs/errors | P2-T6 | `D0` | `R5/C3/T4` | A |
| `P3-T2` | Blueprint/catalog/parser | P3-T1 | `D1` | `R4/C4/T4` | B |
| `P3-T3` | Member/lifecycle pure domain | P3-T1 | `D1` | `R5/C4/T5` | A |
| `P3-T4` | Policy resolver | P3-T1 | `D1` | `R5/C4/T5` | A |
| `P3-T5` | Compatibility engine | P3-T1 | `D1` | `R5/C4/T5` | A |
| `P3-T6` | Domain integration/property review + G3 | P3-T2,P3-T3,P3-T4,P3-T5 | `D2` | `R5/C3/T5` | A |

### P3-T1 — 冻结 core contracts/IDs/errors

- **目标**：建立 TeamSessionId/InstanceId/TemplateId、DTO 基础、errors、schema version；形成共享 contract v1。
- **拥有的文件/包**：`packages/contracts/**`
- **前置依赖**：P2-T6
- **允许依赖**：无 live Agent dependency
- **禁止项**：全局 forbidden block。
- **实现要点**：这是 P3 shared write lock owner；完成后冻结 v1，其他任务不得改。
- **必须测试**：type tests；serialization tests；illegal ID/input tests。
- **验收标准**：contracts 不包含 legacy MemberId authority 或 live Agent。
- **输出物**：contracts v1；contract changelog
- **难度**：`R5/C3/T4`；推荐 `Class A`。
- **并行关系**：`D0`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P3-T2 — Blueprint/catalog/parser

- **目标**：实现 TeamBlueprint、LeaderTemplate、MemberTemplate、revision/hash、catalog source、强校验；选择性借鉴旧 parser。
- **拥有的文件/包**：`packages/domain/blueprint/**`
- **前置依赖**：P3-T1
- **允许依赖**：contracts v1；standard YAML/markdown parser
- **禁止项**：全局 forbidden block。
- **实现要点**：旧 frontmatter parser 仅参考；schema target-first。
- **必须测试**：parse/validation/hash/immutability/revision tests。
- **验收标准**：Blueprint snapshot 完整、immutable；unknown fields/version fail loud。
- **输出物**：blueprint package；fixtures
- **难度**：`R4/C4/T4`；推荐 `Class B`。
- **并行关系**：`D1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P3-T3 — Member/lifecycle pure domain

- **目标**：实现 Template→N Instance、lifecycle transition matrix、contextPolicy、workspace creation semantics。
- **拥有的文件/包**：`packages/domain/member*；lifecycle*`
- **前置依赖**：P3-T1
- **允许依赖**：contracts v1 only
- **禁止项**：全局 forbidden block。
- **实现要点**：无 Agent/Session handle；只描述 durable state。
- **必须测试**：property tests；invalid transition；fresh_per_delegation semantic tests。
- **验收标准**：同 template 可 N instances；Restore only ARCHIVED→SETTLED。
- **输出物**：domain module；transition table tests
- **难度**：`R5/C4/T5`；推荐 `Class A`。
- **并行关系**：`D1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P3-T4 — Policy resolver

- **目标**：实现 Blueprint envelope→PolicyState→template/instance/human override→external hard intersection 的纯 resolver。
- **拥有的文件/包**：`packages/domain/policy/**`
- **前置依赖**：P3-T1
- **允许依赖**：contracts v1
- **禁止项**：全局 forbidden block。
- **实现要点**：输出 provenance；leader autonomy 与 human override 分开。
- **必须测试**：precedence exhaustive matrix；deny/tightening/escalation negative tests。
- **验收标准**：无法绕 external hard；Member 自升权失败；每项 effective value 可解释。
- **输出物**：policy resolver；matrix tests
- **难度**：`R5/C4/T5`；推荐 `Class A`。
- **并行关系**：`D1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P3-T5 — Compatibility engine

- **目标**：实现 typed requirement、PASS/WARNING/FATAL、ack/environment fingerprint、complete:true FATAL。
- **拥有的文件/包**：`packages/domain/compatibility/**`
- **前置依赖**：P3-T1
- **允许依赖**：contracts v1；seam manifest as environment facts
- **禁止项**：全局 forbidden block。
- **实现要点**：Requirement 与 Policy 严格分离；unknown requirement type validation error。
- **必须测试**：warning ack；drift invalidation；complete:true；missing capability。
- **验收标准**：兼容性输出稳定 typed result，不启动 work。
- **输出物**：compat package；fixtures
- **难度**：`R5/C4/T5`；推荐 `Class A`。
- **并行关系**：`D1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P3-T6 — Domain integration/property review + G3

- **目标**：组合 Blueprint/Member/Policy/Compatibility；执行 architecture property suite。
- **拥有的文件/包**：`packages/testkit/domain；docs/contracts`
- **前置依赖**：P3-T2,P3-T3,P3-T4,P3-T5
- **允许依赖**：只读各 P3 package
- **禁止项**：全局 forbidden block。
- **实现要点**：不新增功能；发现 contract 缺口走 CONTRACT_CHANGE_REQUEST。
- **必须测试**：cross-module property tests；serialization round-trip；negative matrix。
- **验收标准**：G3 每条 criterion 有独立证据；contracts v1 freeze confirmed。
- **输出物**：G3 report；domain test bundle
- **难度**：`R5/C3/T5`；推荐 `Class A`。
- **并行关系**：`D2`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### G3 Gate 执行方法

主 Agent 不得因为本 Phase task 全部 `APPROVE` 就自动通过 Gate。必须另外创建一个 `G3-REVIEW` task，由独立 reviewer：

```text
1. checkout Phase integration SHA
2. 读取上位文档中对应 Gate 条目
3. 重跑关键 positive + negative tests
4. 执行 zero-core/private-import/owned-boundary 检查
5. 对 cross-task invariants 做组合审查
6. 输出 criterion -> evidence -> PASS/FAIL
```

只有所有 criterion PASS 才能由主 Agent 将 integration branch 合入 `main`。

---

## 11.5 P4 — TeamDomain / Journal / Recovery

**Phase 内依赖图：**

```text
P4-T1 → {P4-T2 || P4-T3} → P4-T4 → P4-T5 → P4-T6 → G4
```

| Task | 主题 | 前置 | 并行组 | 难度 | Agent |
|---|---|---|---|---|---|
| `P4-T1` | TeamDomain schema/meta repositories | P3-T6 | `E0` | `R5/C5/T5` | A |
| `P4-T2` | OperationJournal/idempotency protocol | P4-T1 | `E1` | `R5/C5/T5` | A |
| `P4-T3` | SessionBinding integrity/reconciliation | P4-T1 | `E1` | `R5/C4/T5` | A |
| `P4-T4` | Provisioning state machine | P4-T2,P4-T3 | `E2` | `R5/C5/T5` | A |
| `P4-T5` | Fault-injection/restart testkit | P4-T2,P4-T3,P4-T4 | `E3` | `R5/C4/T5` | A |
| `P4-T6` | TeamDomain independent audit + G4 | P4-T5 | `E4` | `R5/C1/T5` | A |

### P4-T1 — TeamDomain schema/meta repositories

- **目标**：建立 schema_meta、team_sessions、member_instances、session_bindings、overrides、compatibility、operations、ledger。
- **拥有的文件/包**：`packages/storage/schema/**；packages/storage/repositories/**`
- **前置依赖**：P3-T6
- **允许依赖**：public StorageDomain only
- **禁止项**：全局 forbidden block。
- **实现要点**：这是 TeamDomain schema write-lock owner；定义 version policy。
- **必须测试**：open/create/read/write；schema mismatch；record validation。
- **验收标准**：Team control-plane authority 可独立于 SessionEvent 存储。
- **输出物**：schema v1；repository tests
- **难度**：`R5/C5/T5`；推荐 `Class A`。
- **并行关系**：`E0`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P4-T2 — OperationJournal/idempotency protocol

- **目标**：实现 PREPARED→effects→ledger→COMMITTED、lastAppliedOperationId、generation CAS。
- **拥有的文件/包**：`packages/storage/operations/**`
- **前置依赖**：P4-T1
- **允许依赖**：TeamDomain repositories only
- **禁止项**：全局 forbidden block。
- **实现要点**：不假设 cross-table ACID；roll-forward first。
- **必须测试**：retry same operation；generation conflict；duplicate ledger prevention。
- **验收标准**：重复执行收敛到同一 durable result。
- **输出物**：journal engine；tests
- **难度**：`R5/C5/T5`；推荐 `Class A`。
- **并行关系**：`E1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P4-T3 — SessionBinding integrity/reconciliation

- **目标**：实现 root/member/ordinary binding、双向 integrity、orphan/missing binding diagnostics。
- **拥有的文件/包**：`packages/storage/bindings/**`
- **前置依赖**：P4-T1
- **允许依赖**：contracts/domain/repositories
- **禁止项**：全局 forbidden block。
- **实现要点**：不创建 live Agent；只处理 durable binding。
- **必须测试**：missing child；duplicate binding；wrong root；ordinary fork no binding。
- **验收标准**：binding 查询可支撑 cold hydration/fork reconciliation。
- **输出物**：binding repo/reconciler tests
- **难度**：`R5/C4/T5`；推荐 `Class A`。
- **并行关系**：`E1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P4-T4 — Provisioning state machine

- **目标**：实现 ALLOCATED→CHILD_SESSION_CREATED→CHILD_BOUND→INSTANCE_COMMITTED 的 durable protocol adapter。
- **拥有的文件/包**：`packages/storage/provisioning/**`
- **前置依赖**：P4-T2,P4-T3
- **允许依赖**：public Agent factory adapter interface（mock first）
- **禁止项**：全局 forbidden block。
- **实现要点**：先使用 fake external effect；不要在此 task 实现真正 Agent runtime。
- **必须测试**：每阶段 retry；orphan detect；one committed instance invariant。
- **验收标准**：重复 provisioning/recovery 最终收敛；不会形成两个 committed MemberInstance。
- **输出物**：provisioning coordinator + fake tests
- **难度**：`R5/C5/T5`；推荐 `Class A`。
- **并行关系**：`E2`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P4-T5 — Fault-injection/restart testkit

- **目标**：为每个 durable boundary 注入 crash，并跨 process/reopen recovery。
- **拥有的文件/包**：`packages/testkit/fault-injection*；persistence tests`
- **前置依赖**：P4-T2,P4-T3,P4-T4
- **允许依赖**：test-only filesystem/process harness
- **禁止项**：全局 forbidden block。
- **实现要点**：故障点覆盖第三份计划 matrix。
- **必须测试**：all crash points；double retry；restart；corrupt version。
- **验收标准**：最终只有 one committed instance 或 diagnosable orphan。
- **输出物**：fault matrix report；fixtures
- **难度**：`R5/C4/T5`；推荐 `Class A`。
- **并行关系**：`E3`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P4-T6 — TeamDomain independent audit + G4

- **目标**：独立审查 authority、SessionEvent 禁用、recovery convergence。
- **拥有的文件/包**：`review artifacts only；minor test-only additions if assigned`
- **前置依赖**：P4-T5
- **允许依赖**：read-only production code
- **禁止项**：全局 forbidden block。
- **实现要点**：Gate reviewer 不参与 P4-T1..T5 实现。
- **必须测试**：zero Team SessionEvent scan；fault suite；restart suite；schema mismatch。
- **验收标准**：G4 PASS；否则明确 blocking invariant。
- **输出物**：G4 report
- **难度**：`R5/C1/T5`；推荐 `Class A`。
- **并行关系**：`E4`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### G4 Gate 执行方法

主 Agent 不得因为本 Phase task 全部 `APPROVE` 就自动通过 Gate。必须另外创建一个 `G4-REVIEW` task，由独立 reviewer：

```text
1. checkout Phase integration SHA
2. 读取上位文档中对应 Gate 条目
3. 重跑关键 positive + negative tests
4. 执行 zero-core/private-import/owned-boundary 检查
5. 对 cross-task invariants 做组合审查
6. 输出 criterion -> evidence -> PASS/FAIL
```

只有所有 criterion PASS 才能由主 Agent 将 integration branch 合入 `main`。

---

## 11.6 P5 — Agent Binding / Member Lifecycle Substrate

**Phase 内依赖图：**

```text
P5-T1 → {P5-T2 || P5-T3 || P5-T4} → P5-T5 → P5-T6 → G5
```

| Task | 主题 | 前置 | 并行组 | 难度 | Agent |
|---|---|---|---|---|---|
| `P5-T1` | TeamAgentBinder core | P4-T6 | `F0` | `R5/C5/T5` | A |
| `P5-T2` | Preset/persona/context overlay | P5-T1 | `F1` | `R5/C4/T5` | A |
| `P5-T3` | ModelSelection overlay | P5-T1 | `F1` | `R4/C4/T5` | B |
| `P5-T4` | Capability/guard adapters | P5-T1 | `F1` | `R5/C5/T5` | A |
| `P5-T5` | Root fresh/cold binding | P5-T2,P5-T3,P5-T4 | `F2` | `R5/C5/T5` | A |
| `P5-T6` | Member create/resume residency + G5 | P5-T2,P5-T3,P5-T4,P5-T5 | `F3` | `R5/C5/T5` | A |

### P5-T1 — TeamAgentBinder core

- **目标**：建立 fresh/cold Root/Member 共用、幂等的 TeamAgentBinder orchestration skeleton。
- **拥有的文件/包**：`packages/runtime/agent-setup/binder/**`
- **前置依赖**：P4-T6
- **允许依赖**：public Agent setup/session events；contracts/persistence
- **禁止项**：全局 forbidden block。
- **实现要点**：binder 负责安装 overlay，不拥有 TeamDomain truth。
- **必须测试**：double bind；fresh/cold mock；ordinary agent no-op。
- **验收标准**：单一 binder 可覆盖四类 bind path。
- **输出物**：binder core；tests
- **难度**：`R5/C5/T5`；推荐 `Class A`。
- **并行关系**：`F0`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P5-T2 — Preset/persona/context overlay

- **目标**：实现 compatible preset 的 Team persona scoped identity、runtime context；complete:true 在 admission 前 FATAL。
- **拥有的文件/包**：`packages/runtime/agent-setup/persona/**；packages/runtime/agent-setup/preset/**`
- **前置依赖**：P5-T1
- **允许依赖**：public preset/system-prompt seams；compat engine
- **禁止项**：全局 forbidden block。
- **实现要点**：不得复制/解析 dsh-persona private internals。
- **必须测试**：no persona；complete=false；complete=true；cold bind。
- **验收标准**：compatible preset 保留 upstream assembly semantics；complete:true 永不启动 Team work。
- **输出物**：persona adapter；tests
- **难度**：`R5/C4/T5`；推荐 `Class A`。
- **并行关系**：`F1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P5-T3 — ModelSelection overlay

- **目标**：实现 Team model effective selection 与 future-boundary mutation adapter。
- **拥有的文件/包**：`packages/runtime/agent-setup/model/**`
- **前置依赖**：P5-T1
- **允许依赖**：public ModelSelection
- **禁止项**：全局 forbidden block。
- **实现要点**：in-flight request 不改；next request 生效。
- **必须测试**：A request running + override B + next request B；restart。
- **验收标准**：模型 mutation 与 frozen semantics 一致。
- **输出物**：model adapter tests
- **难度**：`R4/C4/T5`；推荐 `Class B`。
- **并行关系**：`F1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P5-T4 — Capability/guard adapters

- **目标**：实现 tools/permissions、skills、MCP、pre-step/pre-execute 的 resolved adapter，严格按 G2 seam 能力。
- **拥有的文件/包**：`packages/runtime/agent-setup/capability/**`
- **前置依赖**：P5-T1
- **允许依赖**：policy resolver + public seams only
- **禁止项**：全局 forbidden block。
- **实现要点**：任何未通过 G2 的 capability 不得 private workaround。
- **必须测试**：tighten；external hard；capability disappear；cold resume。
- **验收标准**：effective capability = available ∩ teamResolved ∩ externalHard。
- **输出物**：capability adapters；tests
- **难度**：`R5/C5/T5`；推荐 `Class A`。
- **并行关系**：`F1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P5-T5 — Root fresh/cold binding

- **目标**：把 TeamSession Root 与普通 DSH Root Agent 生命周期接通；支持 ordinary UI cold resume 前 hydration。
- **拥有的文件/包**：`packages/runtime/root-binding*`
- **前置依赖**：P5-T2,P5-T3,P5-T4
- **允许依赖**：TeamDomain session_binding；public agent lifecycle
- **禁止项**：全局 forbidden block。
- **实现要点**：这是 ROOT_COLD_BINDING characterization 的产品化实现。
- **必须测试**：fresh Team root；process restart cold root；admission fail closed；ordinary root。
- **验收标准**：首个 Team-sensitive step 前 scope 完整恢复。
- **输出物**：root binding integration tests
- **难度**：`R5/C5/T5`；推荐 `Class A`。
- **并行关系**：`F2`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P5-T6 — Member create/resume residency + G5

- **目标**：接通 MemberInstance durable identity、child Session、ephemeral Agent residency；SETTLED 可无 handle。
- **拥有的文件/包**：`packages/runtime/member-residency*；P5 integration tests`
- **前置依赖**：P5-T2,P5-T3,P5-T4,P5-T5
- **允许依赖**：public agents.create/resume
- **禁止项**：全局 forbidden block。
- **实现要点**：Member 不是 continuable subagent；nested generic subagents仍可用。
- **必须测试**：fresh create setup；cold resume；evict settled；re-admit；ordinary agent invariance。
- **验收标准**：G5 全部 criterion PASS。
- **输出物**：member residency module；G5 report
- **难度**：`R5/C5/T5`；推荐 `Class A`。
- **并行关系**：`F3`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### G5 Gate 执行方法

主 Agent 不得因为本 Phase task 全部 `APPROVE` 就自动通过 Gate。必须另外创建一个 `G5-REVIEW` task，由独立 reviewer：

```text
1. checkout Phase integration SHA
2. 读取上位文档中对应 Gate 条目
3. 重跑关键 positive + negative tests
4. 执行 zero-core/private-import/owned-boundary 检查
5. 对 cross-task invariants 做组合审查
6. 输出 criterion -> evidence -> PASS/FAIL
```

只有所有 criterion PASS 才能由主 Agent 将 integration branch 合入 `main`。

---

## 11.7 P6 — Activation / Runtime / Coordination

**Phase 内依赖图：**

```text
P6-T1 → P6-T2 → {P6-T3 || P6-T4 || P6-T5} → P6-T6 → G6
```

| Task | 主题 | 前置 | 并行组 | 难度 | Agent |
|---|---|---|---|---|---|
| `P6-T1` | ActivationProvider | P5-T6 | `G0` | `R5/C5/T5` | A |
| `P6-T2` | TeamRuntime admission/policy | P6-T1 | `G1` | `R5/C5/T5` | A |
| `P6-T3` | Messaging coordination | P6-T2 | `G2` | `R4/C4/T5` | B |
| `P6-T4` | Control/approval | P6-T2 | `G2` | `R5/C5/T5` | A |
| `P6-T5` | Progress/activity/interval ledger | P6-T2 | `G2` | `R4/C4/T4` | B |
| `P6-T6` | Team tools + orchestration E2E + G6 | P6-T3,P6-T4,P6-T5 | `G3` | `R5/C5/T5` | A |

### P6-T1 — ActivationProvider

- **目标**：实现所有新 MemberInstance creation 的唯一入口和完整 admission/provisioning 顺序。
- **拥有的文件/包**：`packages/runtime/activation/**`
- **前置依赖**：P5-T6
- **允许依赖**：TeamDomain provisioning + Binder + policy/compat
- **禁止项**：全局 forbidden block。
- **实现要点**：human/leader/router 均走同一 provider；allocate instanceId 在 journal protocol 内。
- **必须测试**：explicit create；delegate create；same template parallel；failure recovery。
- **验收标准**：任何新 Member 都无法绕过 Provider。
- **输出物**：activation package；tests
- **难度**：`R5/C5/T5`；推荐 `Class A`。
- **并行关系**：`G0`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P6-T2 — TeamRuntime admission/policy

- **目标**：实现 runtime action router、caller authority、quota、compatibility/admission、instanceId-first addressing。
- **拥有的文件/包**：`packages/runtime/admission*；action-router*`
- **前置依赖**：P6-T1
- **允许依赖**：policy/compat/activation
- **禁止项**：全局 forbidden block。
- **实现要点**：所有 Team tools/UI Remote 后续只调 Runtime API。
- **必须测试**：member self escalation；leader out-of-envelope；quota boundary。
- **验收标准**：TeamRuntime 是控制动作统一 authority facade。
- **输出物**：runtime API；tests
- **难度**：`R5/C5/T5`；推荐 `Class A`。
- **并行关系**：`G1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P6-T3 — Messaging coordination

- **目标**：实现 instance-addressed send/relay；TeamDomain ledger 记录 coordination，目标 Session 写 ordinary attributed input。
- **拥有的文件/包**：`packages/runtime/messaging*`
- **前置依赖**：P6-T2
- **允许依赖**：TeamDomain ledger；public Session input API
- **禁止项**：全局 forbidden block。
- **实现要点**：旧 send_team_message 仅参考 UX。
- **必须测试**：leader→member；member→leader；member→member mediated policy；restart。
- **验收标准**：消息 identity 以 instanceId 为准；不创建 Team SessionEvent。
- **输出物**：messaging module；tests
- **难度**：`R4/C4/T5`；推荐 `Class B`。
- **并行关系**：`G2`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P6-T4 — Control/approval

- **目标**：实现 durable ControlRequest/Decision 与 DSH tool pipeline last-mile guard。
- **拥有的文件/包**：`packages/runtime/control*`
- **前置依赖**：P6-T2
- **允许依赖**：policy + TeamDomain + public tool guard
- **禁止项**：全局 forbidden block。
- **实现要点**：allow decision 不得突破 external hard policy。
- **必须测试**：allow once；deny；stale request；restart；external deny。
- **验收标准**：control durable、可恢复、不可绕 tool guard。
- **输出物**：control module；tests
- **难度**：`R5/C5/T5`；推荐 `Class A`。
- **并行关系**：`G2`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P6-T5 — Progress/activity/interval ledger

- **目标**：实现 telemetry、last action、RUNNING intervals、correlation，不升级为 workflow authority。
- **拥有的文件/包**：`packages/runtime/activity*；projection seeds`
- **前置依赖**：P6-T2
- **允许依赖**：TeamDomain ledger
- **禁止项**：全局 forbidden block。
- **实现要点**：旧 task rows 仅作为 presentation reference。
- **必须测试**：progress update；multiple running intervals；restart；out-of-order guard。
- **验收标准**：Activity 可投影但不决定 lifecycle/workflow。
- **输出物**：activity module；tests
- **难度**：`R4/C4/T4`；推荐 `Class B`。
- **并行关系**：`G2`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P6-T6 — Team tools + orchestration E2E + G6

- **目标**：注册 list/create/delegate/followup/message/progress/control/lifecycle inspect 等 model-facing tools，全部委托 Runtime。
- **拥有的文件/包**：`packages/tools/**；P6 e2e`
- **前置依赖**：P6-T3,P6-T4,P6-T5
- **允许依赖**：public tool registration + TeamRuntime only
- **禁止项**：全局 forbidden block。
- **实现要点**：tool 层不得直接写 TeamDomain 或 agents.create。
- **必须测试**：same template N instances；persistent follow-up same Session；fresh delegation new instance；restart；quota race。
- **验收标准**：G6 PASS；tool bypass scan PASS。
- **输出物**：tools package；headless E2E；G6 report
- **难度**：`R5/C5/T5`；推荐 `Class A`。
- **并行关系**：`G3`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### G6 Gate 执行方法

主 Agent 不得因为本 Phase task 全部 `APPROVE` 就自动通过 Gate。必须另外创建一个 `G6-REVIEW` task，由独立 reviewer：

```text
1. checkout Phase integration SHA
2. 读取上位文档中对应 Gate 条目
3. 重跑关键 positive + negative tests
4. 执行 zero-core/private-import/owned-boundary 检查
5. 对 cross-task invariants 做组合审查
6. 输出 criterion -> evidence -> PASS/FAIL
```

只有所有 criterion PASS 才能由主 Agent 将 integration branch 合入 `main`。

---

## 11.8 P7 — Advanced Semantics / Fork / Handoff / Legacy

**Phase 内依赖图：**

```text
{P7-T1 || P7-T3 || P7-T4 || P7-T5 || P7-T6} → P7-T2(after T1) ; all → P7-T7 → G7
```

| Task | 主题 | 前置 | 并行组 | 难度 | Agent |
|---|---|---|---|---|---|
| `P7-T1` | Compatibility drift + ACK lifecycle | P6-T6 | `H1` | `R5/C4/T5` | A |
| `P7-T2` | Runtime mutation/provenance | P6-T6,P7-T1 | `H2` | `R5/C5/T5` | A |
| `P7-T3` | Archive/Restore/Dispose + descendant drain | P6-T6 | `H1` | `R5/C5/T5` | A |
| `P7-T4` | Fork reconciliation | P6-T6 | `H1` | `R5/C5/T5` | A |
| `P7-T5` | Start Team from Here | P6-T6 | `H1` | `R5/C4/T5` | A |
| `P7-T6` | Legacy teammate adapter | P3-T2 | `H1` | `R3/C4/T4` | B |
| `P7-T7` | Legacy Team Session read-only reader + G7 | P7-T1,P7-T2,P7-T3,P7-T4,P7-T5,P7-T6 | `H3` | `R5/C4/T5` | A |

### P7-T1 — Compatibility drift + ACK lifecycle

- **目标**：实现 probe generation、warning ACK fingerprint、capability drift 对 new work admission 的影响。
- **拥有的文件/包**：`packages/runtime/compatibility/**`
- **前置依赖**：P6-T6
- **允许依赖**：compat engine + TeamDomain
- **禁止项**：全局 forbidden block。
- **实现要点**：in-flight admitted work 可 settle；new work block。
- **必须测试**：environment fingerprint change；stale ACK；cold resume；in-flight drift。
- **验收标准**：drift semantics 与 frozen spec 一致。
- **输出物**：runtime compatibility tests
- **难度**：`R5/C4/T5`；推荐 `Class A`。
- **并行关系**：`H1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P7-T2 — Runtime mutation/provenance

- **目标**：实现 model/tool/permission/skill/MCP future-boundary mutation、PolicyState、Autonomy Overlay、Human Override provenance。
- **拥有的文件/包**：`packages/runtime/mutation*；policy adapters`
- **前置依赖**：P6-T6,P7-T1
- **允许依赖**：policy + binder adapters
- **禁止项**：全局 forbidden block。
- **实现要点**：workspace/context creation fields 不允许创建后非法变更。
- **必须测试**：all mutation boundaries；suppressed override；human vs leader；external hard。
- **验收标准**：Effective Configuration 每项有来源，非法 escalation 被拒。
- **输出物**：mutation module；provenance tests
- **难度**：`R5/C5/T5`；推荐 `Class A`。
- **并行关系**：`H2`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P7-T3 — Archive/Restore/Dispose + descendant drain

- **目标**：实现 close admission→interrupt→drain→release→commit；Restore 只 ARCHIVED→SETTLED。
- **拥有的文件/包**：`packages/runtime/lifecycle*`
- **前置依赖**：P6-T6
- **允许依赖**：public descendant seam + residency + TeamDomain
- **禁止项**：全局 forbidden block。
- **实现要点**：Restore 绝不 agents.resume；Dispose 保历史。
- **必须测试**：archive running；nested subagent drain；restore no agent；dispose race。
- **验收标准**：quiescence 与 durable lifecycle一致。
- **输出物**：lifecycle module；tests
- **难度**：`R5/C5/T5`；推荐 `Class A`。
- **并行关系**：`H1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P7-T4 — Fork reconciliation

- **目标**：实现 lazy root fork sidecar：same Blueprint snapshot + zero members；Member fork 保持 ordinary Session。
- **拥有的文件/包**：`packages/runtime/fork*；persistence reconciliation`
- **前置依赖**：P6-T6
- **允许依赖**：public lineage + TeamDomain binding
- **禁止项**：全局 forbidden block。
- **实现要点**：不得 patch session.fork；repeated reconciliation 幂等。
- **必须测试**：root fork；member fork；ordinary fork；crash during sidecar；repeat reconcile。
- **验收标准**：Root/Member fork exact frozen semantics。
- **输出物**：fork reconciler；tests
- **难度**：`R5/C5/T5`；推荐 `Class A`。
- **并行关系**：`H1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P7-T5 — Start Team from Here

- **目标**：实现 source canonical surface freeze→one-shot summary/handoff→new TeamIntent/Root；无 live link。
- **拥有的文件/包**：`packages/runtime/handoff*`
- **前置依赖**：P6-T6
- **允许依赖**：public session query/read surface + Team creation
- **禁止项**：全局 forbidden block。
- **实现要点**：source 后续变化不影响 handoff；target 无 history_search source 权限。
- **必须测试**：snapshot once；source mutate；target inspect；failure before root create。
- **验收标准**：handoff 是一次性上下文，不建立 cross-session memory。
- **输出物**：handoff module；tests
- **难度**：`R5/C4/T5`；推荐 `Class A`。
- **并行关系**：`H1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P7-T6 — Legacy teammate adapter

- **目标**：将 `.dsh/teammates` 仅作为 one-time Blueprint import adapter。
- **拥有的文件/包**：`packages/legacy/teammates-adapter*`
- **前置依赖**：P3-T2
- **允许依赖**：filesystem + blueprint parser
- **禁止项**：全局 forbidden block。
- **实现要点**：无 watcher、无 live runtime authority。
- **必须测试**：import valid/invalid；duplicate；source changes after snapshot。
- **验收标准**：legacy definition 可生成新 Blueprint，但不会控制既有 TeamSession。
- **输出物**：adapter + fixtures
- **难度**：`R3/C4/T4`；推荐 `Class B`。
- **并行关系**：`H1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P7-T7 — Legacy Team Session read-only reader + G7

- **目标**：best-effort inspect old Team metadata；任何 mutate/resume/restore 入口拒绝；整合高级语义 Gate。
- **拥有的文件/包**：`packages/legacy/session-reader*；P7 e2e`
- **前置依赖**：P7-T1,P7-T2,P7-T3,P7-T4,P7-T5,P7-T6
- **允许依赖**：public legacy-readable session APIs only
- **禁止项**：全局 forbidden block。
- **实现要点**：metadata 读不到时退化 native Chat/Trajectory，不是 blocker。
- **必须测试**：legacy read；mutation reject；fork/handoff/lifecycle/ACK integrated suite。
- **验收标准**：G7 全 criteria PASS。
- **输出物**：legacy reader；G7 report
- **难度**：`R5/C4/T5`；推荐 `Class A`。
- **并行关系**：`H3`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### G7 Gate 执行方法

主 Agent 不得因为本 Phase task 全部 `APPROVE` 就自动通过 Gate。必须另外创建一个 `G7-REVIEW` task，由独立 reviewer：

```text
1. checkout Phase integration SHA
2. 读取上位文档中对应 Gate 条目
3. 重跑关键 positive + negative tests
4. 执行 zero-core/private-import/owned-boundary 检查
5. 对 cross-task invariants 做组合审查
6. 输出 criterion -> evidence -> PASS/FAIL
```

只有所有 criterion PASS 才能由主 Agent 将 integration branch 合入 `main`。

---

## 11.9 P8 — Team Remote + Projection

**Phase 内依赖图：**

```text
P8-T1(contract freeze) → P8-T2 → P8-T3 → P8-T4 → P8-T5 → G8
```

| Task | 主题 | 前置 | 并行组 | 难度 | Agent |
|---|---|---|---|---|---|
| `P8-T1` | 冻结 TeamProjection DTO v1 | P7-T7 | `I0` | `R5/C3/T4` | A |
| `P8-T2` | Projection service | P8-T1 | `I1` | `R5/C5/T5` | A |
| `P8-T3` | 冻结 Remote contract + Host handlers | P8-T1,P8-T2 | `I2` | `R5/C5/T5` | A |
| `P8-T4` | Push/generation/reconnect/pagination | P8-T3 | `I3` | `R4/C4/T5` | B |
| `P8-T5` | Remote contract independent review + G8 | P8-T4 | `I4` | `R5/C1/T5` | A |

### P8-T1 — 冻结 TeamProjection DTO v1

- **目标**：定义 Root/Template/Instance/lifecycle/effective-config/activity/ledger summary/generation DTO。
- **拥有的文件/包**：`packages/contracts/src/projection/**`
- **前置依赖**：P7-T7
- **允许依赖**：contracts/domain only
- **禁止项**：全局 forbidden block。
- **实现要点**：P8 shared write lock owner；UI 之后只消费该 DTO。
- **必须测试**：serialization；generation monotonic；nullable live overlay。
- **验收标准**：DTO 不泄露 TeamDomain storage internals或 SessionController Team mirror。
- **输出物**：projection contract v1
- **难度**：`R5/C3/T4`；推荐 `Class A`。
- **并行关系**：`I0`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P8-T2 — Projection service

- **目标**：从 TeamDomain + live residency overlay 生成 whole projection；禁止扫描全部 Session logs 重建 Team truth。
- **拥有的文件/包**：`packages/runtime/projection/**`
- **前置依赖**：P8-T1
- **允许依赖**：TeamDomain read APIs + live residency read-only
- **禁止项**：全局 forbidden block。
- **实现要点**：ledger pagination单独处理；projection pure-ish fold 可单测。
- **必须测试**：cold projection；50 instances；live overlay；disposed/archived。
- **验收标准**：projection 与 durable truth 一致，复杂度不依赖完整 child logs。
- **输出物**：projection package；tests
- **难度**：`R5/C5/T5`；推荐 `Class A`。
- **并行关系**：`I1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P8-T3 — 冻结 Remote contract + Host handlers

- **目标**：定义 catalog/intent/team/member/override/policy/compat/handoff/legacy APIs 并实现 external Remote。
- **拥有的文件/包**：`packages/remote/contracts*；handlers*`
- **前置依赖**：P8-T1,P8-T2
- **允许依赖**：public Remote seam + Runtime
- **禁止项**：全局 forbidden block。
- **实现要点**：这是 Remote contract write-lock owner；typed errors/provenance。
- **必须测试**：round-trip；invalid IDs；admission errors；version mismatch。
- **验收标准**：browser 完全不需要 SessionController Team mirror。
- **输出物**：Remote v1；handler tests
- **难度**：`R5/C5/T5`；推荐 `Class A`。
- **并行关系**：`I2`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P8-T4 — Push/generation/reconnect/pagination

- **目标**：实现 versioned invalidation+pull 或 whole projection generation；client stale guard fixture；ledger paging。
- **拥有的文件/包**：`packages/remote/push*；test client`
- **前置依赖**：P8-T3
- **允许依赖**：Remote v1
- **禁止项**：全局 forbidden block。
- **实现要点**：第一版 correctness first；stale generation 必须被拒。
- **必须测试**：out-of-order frames；reconnect；duplicate invalidation；page anchor。
- **验收标准**：新 state 不被旧 response 覆盖；分页稳定。
- **输出物**：remote sync tests
- **难度**：`R4/C4/T5`；推荐 `Class B`。
- **并行关系**：`I3`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P8-T5 — Remote contract independent review + G8

- **目标**：从浏览器消费者视角验证 contract 完整性、稳定性和无 upstream mirror 依赖。
- **拥有的文件/包**：`review/e2e only`
- **前置依赖**：P8-T4
- **允许依赖**：read-only P8 code
- **禁止项**：全局 forbidden block。
- **实现要点**：Gate reviewer 不参与 Remote 实现。
- **必须测试**：pristine host browser-less remote e2e；dependency scan；reconnect suite。
- **验收标准**：G8 PASS；Remote v1 freeze。
- **输出物**：G8 report；contract checksum/version
- **难度**：`R5/C1/T5`；推荐 `Class A`。
- **并行关系**：`I4`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### G8 Gate 执行方法

主 Agent 不得因为本 Phase task 全部 `APPROVE` 就自动通过 Gate。必须另外创建一个 `G8-REVIEW` task，由独立 reviewer：

```text
1. checkout Phase integration SHA
2. 读取上位文档中对应 Gate 条目
3. 重跑关键 positive + negative tests
4. 执行 zero-core/private-import/owned-boundary 检查
5. 对 cross-task invariants 做组合审查
6. 输出 criterion -> evidence -> PASS/FAIL
```

只有所有 criterion PASS 才能由主 Agent 将 integration branch 合入 `main`。

---

## 11.10 P9 — External Web UI Migration

**Phase 内依赖图：**

```text
P9-T1(store freeze) → {P9-T2 || P9-T3 || P9-T4 || P9-T5 || P9-T6} → P9-T7 → G9
```

| Task | 主题 | 前置 | 并行组 | 难度 | Agent |
|---|---|---|---|---|---|
| `P9-T1` | External client shell/store/navigation | P8-T5 | `J0` | `R5/C5/T5` | A |
| `P9-T2` | New Team + TeamIntent + compatibility preflight | P9-T1 | `J1` | `R4/C5/T5` | B |
| `P9-T3` | Team Header + Dock + session navigation | P9-T1 | `J1` | `R4/C4/T4` | B |
| `P9-T4` | Timeline migration | P9-T1 | `J1` | `R4/C4/T5` | B |
| `P9-T5` | Members + Inspector + Override | P9-T1 | `J1` | `R5/C5/T5` | A |
| `P9-T6` | Compatibility/Lifecycle/Events/Activity/Handoff/Legacy surfaces | P9-T1 | `J1` | `R5/C5/T5` | A |
| `P9-T7` | UI integration/accessibility/responsive + G9 | P9-T2,P9-T3,P9-T4,P9-T5,P9-T6 | `J2` | `R5/C4/T5` | A |

### P9-T1 — External client shell/store/navigation

- **目标**：建立 dsh.client entry、Team Remote client、generation-aware store、conversation.view Team seat、supported navigation adapter。
- **拥有的文件/包**：`packages/client/root*；store*；navigation*`
- **前置依赖**：P8-T5
- **允许依赖**：public client module/slots + Remote v1
- **禁止项**：全局 forbidden block。
- **实现要点**：这是 client shared store write-lock owner；不得改 upstream client。
- **必须测试**：module discovery；Team/ordinary session detection；stale generation；navigation。
- **验收标准**：external client 可加载，普通 Session 无 Team Tab。
- **输出物**：client shell/store；tests
- **难度**：`R5/C5/T5`；推荐 `Class A`。
- **并行关系**：`J0`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P9-T2 — New Team + TeamIntent + compatibility preflight

- **目标**：实现独立 New Team 入口、creation panel、Blueprint/Preset/workspace选择、probe/ACK/create state。
- **拥有的文件/包**：`packages/client/new-team/**`
- **前置依赖**：P9-T1
- **允许依赖**：Remote v1；UI design spec
- **禁止项**：全局 forbidden block。
- **实现要点**：AWAITING_ACK 不创建 fake Session；complete:true FATAL 无 Continue Anyway。
- **必须测试**：draft/probe/warning ack/fatal/create/create&send/cancel。
- **验收标准**：创建前状态完全 Team-owned；真实 Root 仅 create commit 后出现。
- **输出物**：New Team UI；tests
- **难度**：`R4/C5/T5`；推荐 `Class B`。
- **并行关系**：`J1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P9-T3 — Team Header + Dock + session navigation

- **目标**：迁移 Header/Dock presentation，使用 supported slot/navigation，无 DOM query hack。
- **拥有的文件/包**：`packages/client/team-shell/**`
- **前置依赖**：P9-T1
- **允许依赖**：Remote/store/navigation
- **禁止项**：全局 forbidden block。
- **实现要点**：Dock 只做轻量状态与动作；Member click 到 native child Session。
- **必须测试**：root/member perspective；collapse；open Team；cold reconnect。
- **验收标准**：不修改 native Chat/Trajectory owner；无 selector hack。
- **输出物**：shell components；tests
- **难度**：`R4/C4/T4`；推荐 `Class B`。
- **并行关系**：`J1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P9-T4 — Timeline migration

- **目标**：选择性迁移旧 pure tick/domain/duration 算法；新层级 Template→Instance→RUNNING intervals。
- **拥有的文件/包**：`packages/client/timeline/**`
- **前置依赖**：P9-T1
- **允许依赖**：Projection DTO v1
- **禁止项**：全局 forbidden block。
- **实现要点**：禁止沿用旧 memberId=runtime identity；旧 renderer/CSS可摘取。
- **必须测试**：multi-instance same template；multiple intervals；empty；long time domain；click instance。
- **验收标准**：Timeline 语义与 UI spec一致，纯模型不依赖 old TeamView。
- **输出物**：Timeline model/renderer/tests
- **难度**：`R4/C4/T5`；推荐 `Class B`。
- **并行关系**：`J1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P9-T5 — Members + Inspector + Override

- **目标**：实现 Template→Instances tree、duplicate labels、effective config inspector、human override editor。
- **拥有的文件/包**：`packages/client/members/**；inspector/**`
- **前置依赖**：P9-T1
- **允许依赖**：Projection/Remote v1
- **禁止项**：全局 forbidden block。
- **实现要点**：默认 read-effective-first；editor 只改 Explicit Human Override。
- **必须测试**：N instances；duplicate label；reset；external hard explanation；model pending boundary。
- **验收标准**：Template/Instance identity 清晰，provenance可读。
- **输出物**：Members/Inspector UI tests
- **难度**：`R5/C5/T5`；推荐 `Class A`。
- **并行关系**：`J1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P9-T6 — Compatibility/Lifecycle/Events/Activity/Handoff/Legacy surfaces

- **目标**：实现 compatibility header/detail、PolicyState、Archive/Restore/Dispose、Events/Activity、Start Team from Here、legacy read-only banner。
- **拥有的文件/包**：`packages/client/controls/**；events/**；legacy-ui/**`
- **前置依赖**：P9-T1
- **允许依赖**：Remote v1
- **禁止项**：全局 forbidden block。
- **实现要点**：Restore action必须显示结果 SETTLED；TeamMarker 不迁移。
- **必须测试**：warning/fatal；archive running；restore no resume；dispose confirm；legacy read-only；handoff。
- **验收标准**：所有冻结高级 UI 语义都有入口且不污染 Chat。
- **输出物**：control/event surfaces；tests
- **难度**：`R5/C5/T5`；推荐 `Class A`。
- **并行关系**：`J1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P9-T7 — UI integration/accessibility/responsive + G9

- **目标**：整合 J1 并行组件，修 shared layout，只通过主 Agent integration task；做 reconnect/a11y/responsive/dormant checks。
- **拥有的文件/包**：`P9 integration-only paths；test snapshots`
- **前置依赖**：P9-T2,P9-T3,P9-T4,P9-T5,P9-T6
- **允许依赖**：approved component APIs only
- **禁止项**：全局 forbidden block。
- **实现要点**：禁止借 integration 之名重写业务 contract；contract问题回退 owner。
- **必须测试**：full browser e2e；keyboard/focus；narrow width；ordinary session regression；no upstream diff。
- **验收标准**：G9 PASS。
- **输出物**：UI e2e；G9 report
- **难度**：`R5/C4/T5`；推荐 `Class A`。
- **并行关系**：`J2`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### G9 Gate 执行方法

主 Agent 不得因为本 Phase task 全部 `APPROVE` 就自动通过 Gate。必须另外创建一个 `G9-REVIEW` task，由独立 reviewer：

```text
1. checkout Phase integration SHA
2. 读取上位文档中对应 Gate 条目
3. 重跑关键 positive + negative tests
4. 执行 zero-core/private-import/owned-boundary 检查
5. 对 cross-task invariants 做组合审查
6. 输出 criterion -> evidence -> PASS/FAIL
```

只有所有 criterion PASS 才能由主 Agent 将 integration branch 合入 `main`。

---

## 11.11 P10 — Hardening / Compatibility CI / Release

**Phase 内依赖图：**

```text
{P10-T1 || P10-T2 || P10-T3 || P10-T4} → P10-T5 → P10-T6 → G10
```

| Task | 主题 | 前置 | 并行组 | 难度 | Agent |
|---|---|---|---|---|---|
| `P10-T1` | Recovery/crash stress suite | P9-T7 | `K1` | `R5/C4/T5` | A |
| `P10-T2` | Concurrency/race suite | P9-T7 | `K1` | `R5/C4/T5` | A |
| `P10-T3` | Performance/residency characterization | P9-T7 | `K1` | `R4/C3/T4` | B |
| `P10-T4` | Dormant invariance + zero-core adversarial audit | P9-T7 | `K1` | `R5/C4/T5` | A |
| `P10-T5` | Upstream compatibility matrix CI | P10-T1,P10-T2,P10-T4 | `K2` | `R4/C4/T5` | A |
| `P10-T6` | Release docs/package/audit + G10 | P10-T1,P10-T2,P10-T3,P10-T4,P10-T5 | `K3` | `R5/C3/T5` | A |

### P10-T1 — Recovery/crash stress suite

- **目标**：扩展 process crash、journal partial、Root/Member cold resume、fork sidecar race、browser reconnect。
- **拥有的文件/包**：`packages/testkit/stress/recovery*`
- **前置依赖**：P9-T7
- **允许依赖**：released APIs only
- **禁止项**：全局 forbidden block。
- **实现要点**：尽量从黑盒调用；不为测试暴露 private production API。
- **必须测试**：repeated randomized crash points；restart loops；reconcile convergence。
- **验收标准**：无重复 instance/ledger；状态可诊断且最终收敛。
- **输出物**：stress report
- **难度**：`R5/C4/T5`；推荐 `Class A`。
- **并行关系**：`K1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P10-T2 — Concurrency/race suite

- **目标**：覆盖 parallel create、quota、model override、archive/followup、restore/followup、dispose/message、compat drift/in-flight。
- **拥有的文件/包**：`packages/testkit/stress/race*`
- **前置依赖**：P9-T7
- **允许依赖**：public Team runtime/remote APIs
- **禁止项**：全局 forbidden block。
- **实现要点**：使用 barrier/fake clock/controlled model，避免 flaky sleep。
- **必须测试**：每个 frozen race 有 deterministic test；repeat N 次。
- **验收标准**：无越权、双创建、状态回退、stale overwrite。
- **输出物**：race suite report
- **难度**：`R5/C4/T5`；推荐 `Class A`。
- **并行关系**：`K1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P10-T3 — Performance/residency characterization

- **目标**：验证 10/50 instances、100/1000+ ledger、cold projection、repeated Team Tab、settled eviction。
- **拥有的文件/包**：`packages/testkit/perf*`
- **前置依赖**：P9-T7
- **允许依赖**：public projection/runtime APIs
- **禁止项**：全局 forbidden block。
- **实现要点**：目标是排除明显 O(all Session logs)，不是追求微 benchmark。
- **必须测试**：profile operation counts/I/O；resident agent count；projection latency trend。
- **验收标准**：性能随 TeamDomain records 合理增长；无扫描完整 child history 路径。
- **输出物**：perf report；budget notes
- **难度**：`R4/C3/T4`；推荐 `Class B`。
- **并行关系**：`K1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P10-T4 — Dormant invariance + zero-core adversarial audit

- **目标**：对 mounted plugin 下 ordinary Session 的 prompt/preset/model/tools/skills/MCP/fork/subagent/Chat/Trajectory 做差分；重跑 forbidden scans。
- **拥有的文件/包**：`integration compliance tests`
- **前置依赖**：P9-T7
- **允许依赖**：pristine upstream baseline
- **禁止项**：全局 forbidden block。
- **实现要点**：baseline vs plugin-mounted 对照；host before/after diff。
- **必须测试**：behavior snapshots；private import scan；fork-only dependency negative install。
- **验收标准**：普通 Session 行为不变；upstream diff=0。
- **输出物**：invariance report；zero-core audit
- **难度**：`R5/C4/T5`；推荐 `Class A`。
- **并行关系**：`K1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P10-T5 — Upstream compatibility matrix CI

- **目标**：对 pinned supported DSH + latest supported candidate 跑 seam characterization、build、mandatory e2e；形成 version cap policy。
- **拥有的文件/包**：`CI workflows；compatibility matrix`
- **前置依赖**：P10-T1,P10-T2,P10-T4
- **允许依赖**：public packages only
- **禁止项**：全局 forbidden block。
- **实现要点**：upstream breakage→plugin adaptation/version cap/blocker；不自动 patch host。
- **必须测试**：matrix jobs；simulated incompatible version。
- **验收标准**：每个 release 有明确 supported DSH range。
- **输出物**：CI matrix；compat doc
- **难度**：`R4/C4/T5`；推荐 `Class A`。
- **并行关系**：`K2`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### P10-T6 — Release docs/package/audit + G10

- **目标**：完成 operator/migration/legacy/release notes；独立 release reviewer 执行 C1..C7 与 G10。
- **拥有的文件/包**：`docs；package metadata；release artifacts`
- **前置依赖**：P10-T1,P10-T2,P10-T3,P10-T4,P10-T5
- **允许依赖**：approved release inputs only
- **禁止项**：全局 forbidden block。
- **实现要点**：reviewer未参与主要 feature实现；失败即不发布。
- **必须测试**：clean install from fresh checkout；all gates replay；artifact integrity。
- **验收标准**：G10 PASS；independent repo/version；release candidate可发布。
- **输出物**：release audit；RC tag；G10 report
- **难度**：`R5/C3/T5`；推荐 `Class A`。
- **并行关系**：`K3`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### G10 Gate 执行方法

主 Agent 不得因为本 Phase task 全部 `APPROVE` 就自动通过 Gate。必须另外创建一个 `G10-REVIEW` task，由独立 reviewer：

```text
1. checkout Phase integration SHA
2. 读取上位文档中对应 Gate 条目
3. 重跑关键 positive + negative tests
4. 执行 zero-core/private-import/owned-boundary 检查
5. 对 cross-task invariants 做组合审查
6. 输出 criterion -> evidence -> PASS/FAIL
```

只有所有 criterion PASS 才能由主 Agent 将 integration branch 合入 `main`。

---


# 12. 主 Agent 的调度算法

推荐主 Agent 每轮只做以下循环：

```text
LOAD STATE
  ↓
RECONCILE git/task/review status
  ↓
CHECK blockers + write locks
  ↓
COMPUTE READY SET
  ↓
ASSIGN bounded task packets
  ↓
COLLECT TaskResults
  ↓
RUN R1 automation
  ↓
ASSIGN independent R2 reviews
  ↓
CHERRY-PICK approved tasks to phase integration
  ↓
RUN R3 integration tests
  ↓
IF phase complete → create R4 Gate review
  ↓
PASS → advance phase
FAIL → create focused repair tasks
```

## 12.1 READY 判定

一个 task 只有在：

```text
all prerequisites DONE/INTEGRATED
base SHA exists
required contract generation frozen
owned paths currently unlocked
no unresolved blocker affects it
```

时才进入 READY。

## 12.2 WIP limit

建议默认：

```text
3 个 implementation worker
+ 1 个 characterization/test worker
+ 1 个 reviewer
```

这是调度上限建议，不是架构约束。若任务高度独立可以提高；如果集中在同一 package/contract，应降低到 1–2。

目标不是最大并发，而是最小 integration entropy。

## 12.3 不允许“抢跑”

例如：

```text
P9 UI 不得在 P8 Remote DTO freeze 前直接根据第三份文档自造接口。
P5 Binder 不得在 P2 Root cold-binding seam 未证明时先写 private workaround。
P4 runtime 不得在 P3 domain contract未冻结时边写边发明 identity。
```

---

# 13. Review 方法细化

## 13.1 Architecture Review Checklist

Reviewer 必须回答：

```text
[ ] authority 是否仍唯一？
[ ] durable identity 与 live residency 是否混淆？
[ ] Template 与 Instance 是否混淆？
[ ] AgentPreset / ModelSelection / Team identity 是否保持正交？
[ ] 是否重新引入 Team SessionEvent authority？
[ ] 是否错误依赖 continuable subagent 作为 Member primitive？
[ ] 是否存在 upstream/private/fork-only 隐式依赖？
[ ] failure path 是否 fail-closed？
[ ] recovery 是否幂等？
[ ] ordinary Session 是否可能被影响？
```

## 13.2 Code Review Checklist

```text
[ ] diff 是否只触碰 owned paths？
[ ] public export 是否未经 owner task 改动？
[ ] error path 是否 typed/fail loud？
[ ] async cleanup/disposer 是否完整？
[ ] race-sensitive write 是否有 generation/idempotency？
[ ] 是否用 process memory 代替 durable TeamDomain truth？
[ ] tests 是否包含 negative case？
[ ] legacy code 是否只是选择性迁移？
[ ] 是否出现 querySelector/text-match/DOM hack 作为 contract？
```

## 13.3 Persistence Review Checklist

```text
[ ] crash before/after每个外部 effect 是否可恢复？
[ ] operationId 是否稳定？
[ ] retry 是否 duplicate-safe？
[ ] binding orphan 是否可诊断？
[ ] schema mismatch 是否 loud fail？
[ ] 是否错误假设跨表 transaction？
```

## 13.4 Runtime/Policy Review Checklist

```text
[ ] new work 是否统一经过 admission？
[ ] tool/Remote/UI 是否能绕过 Runtime？
[ ] External Hard Policy 是否最后取交集？
[ ] Human Override 与 leader autonomy 是否区分？
[ ] current in-flight operation 是否被 retroactive mutation？
[ ] compatibility drift 是否只阻止新的 work？
```

## 13.5 UI Review Checklist

```text
[ ] ordinary Session 是否仍是 Chat|Trajectory？
[ ] Team-bound Session 是否 additive Chat|Trajectory|Team？
[ ] New Team 是否独立于 native New Session？
[ ] TeamIntent 是否未创建 fake Session？
[ ] Timeline 是否 Template→Instance？
[ ] lifecycle 与 Agent residency 是否分开展示？
[ ] Restore 是否明确落到 SETTLED？
[ ] Member click 是否进入 native child Session？
[ ] TeamMarker 是否不存在？
[ ] stale generation 是否不会覆盖新状态？
```

---

# 14. 变更请求与返工

## 14.1 Reviewer 不修代码

`REQUEST_CHANGES` 后：

```text
reviewer writes findings
→ main agent converts findings to repair packet
→ original implementer or new worker fixes
→ new head SHA
→ reviewer re-reviews diff from previous reviewed SHA
```

这样保留审计链。

## 14.2 何时换 worker

建议换 worker：

```text
同一 critical finding 连续两轮未解决
worker 多次越界修改 locked surface
worker 试图用 upstream patch 绕 blocker
task context 已明显失控
```

## 14.3 返工不能降低标准

如果一个 test 很难写，不能把 acceptance criteria 改成“manual inspection”。必须由主 Agent显式创建：

```text
TEST_INFRA task
```

或正式修改计划并重新审查。

---

# 15. 上下文控制方法

为了降低长任务上下文膨胀，每个 worker 只拿：

```text
1. TaskPacket
2. 必要 spec 摘录
3. dependency contract/API docs
4. owned files
5. 最小 legacy reference paths（如确需）
6. exact base SHA
```

不要默认给 worker：

```text
整个 4 份长文档
整个 legacy repo 讨论历史
其它并行 task 的聊天记录
```

如果需要额外上下文，worker 必须请求一个明确 artifact/path，而不是自行扩大任务范围。

## 15.1 Context checkpoint

长任务每完成一个稳定子目标，要求 worker 写：

```text
TASK_CHECKPOINT.md / TaskResult draft
```

内容只包括事实、当前 SHA、剩余工作和 blocker。后续即使 Agent 会话上下文丢失，也可从 repo 恢复。

---

# 16. 推荐的仓库内 orchestration artifacts

可以在 `dsh-agent-team` 中保留：

```text
dev/agent-workflow/
├─ graph.yaml
├─ locks.yaml
├─ tasks/
│  ├─ P3-T1.md
│  └─ ...
├─ results/
├─ reviews/
├─ gates/
├─ blockers/
└─ evidence/
```

这些文件属于开发流程，不进入 runtime package。

`graph.yaml` 最少包含：

```yaml
current_phase: P3
integration_sha: ...
contracts:
  core: v1
locks:
  contracts: P3-T1
ready: [P3-T2, P3-T3, P3-T4, P3-T5]
blocked: []
```

这样主 Agent 不必依赖自身对几十个 subagent 会话的记忆。

---

# 17. Implementation Agent Prompt 模板

```text
You are the implementation worker for <TASK_ID>.

Authority:
- The attached TaskPacket is your complete scope.
- Frozen architecture/UI/development-plan excerpts outrank implementation convenience.

You MUST:
1. verify the exact base SHA before editing;
2. modify only owned_paths;
3. use only allowed public dependencies;
4. implement required tests;
5. run all required verification;
6. commit atomic changes;
7. return TaskResult with exact commands and SHAs.

You MUST NOT:
- modify deepseek-harness upstream source;
- use private/unexported source imports;
- edit shared contracts unless this task owns their write lock;
- copy entire legacy Team packages;
- weaken acceptance criteria.

If an essential behavior requires upstream modification:
STOP and emit CORE_SEAM_BLOCKER:<specific-seam>.
Do not patch upstream.

If a shared contract must change:
STOP the affected part and emit CONTRACT_CHANGE_REQUEST.
```

---

# 18. Reviewer Prompt 模板

```text
You are the independent reviewer for <TASK_ID>.
You did not implement this task.

Inputs:
- frozen spec excerpt
- TaskPacket
- base SHA
- candidate head SHA / diff
- TaskResult
- test evidence

Do not fix the code.
Do not infer correctness from the implementer's narrative.

Review:
1. scope/owned paths;
2. frozen architecture semantics;
3. public dependency boundary;
4. negative/failure behavior;
5. tests vs acceptance criteria;
6. zero-core/private-import rules;
7. integration risks.

Return exactly one verdict:
APPROVE | REQUEST_CHANGES | BLOCK
and a structured ReviewResult.
```

---

# 19. Gate Reviewer Prompt 模板

```text
You are the independent Gate reviewer for <GATE_ID>.
Review the Phase integration SHA, not individual task branches.

For every gate criterion:
- identify concrete evidence;
- rerun the relevant command/test where practical;
- mark PASS or FAIL;
- do not accept "covered by task review" as evidence.

Also perform adversarial checks for:
- hidden upstream diff;
- private imports;
- fork-only dependency;
- duplicate authority;
- stale legacy semantics;
- missing negative tests.

Gate passes only if every mandatory criterion is PASS.
```

---

# 20. 主 Agent 的 merge policy

## 20.1 task commit

推荐每个 task 最终形成：

```text
1 logical task = 1 squashed/clean commit
```

复杂任务可以 2–3 个原子 commit，但 ReviewResult 必须覆盖 exact range。

## 20.2 integration conflict

如果 cherry-pick 冲突：

```text
main agent may resolve only mechanical conflicts
```

若冲突涉及：

```text
behavior
contract
schema
policy precedence
public API
```

必须创建新的 `INTEGRATION-FIX` task，由 worker实现并独立 review。

## 20.3 Gate 后禁止 rewrite history

Gate report 必须绑定 exact integration SHA。通过后：

```text
no force-push/rebase of gated history
```

后续修复用新 commit。

---

# 21. 测试证据规范

每个测试结果至少记录：

```text
command
exit code
host SHA
plugin SHA
OS/runtime when relevant
artifact/log path
```

关键测试必须保存 machine-readable result，而不是只贴 console 摘要。

特别是：

```text
G1 zero-core
G2 seam characterization
G4 crash matrix
G7 fork/lifecycle
G8 reconnect/stale generation
G9 browser E2E
G10 dormant invariance/compatibility matrix
```

---

# 22. Gate ownership 推荐

| Gate | 首要 reviewer 能力 | 必须独立复核的内容 |
|---|---|---|
| G0 | Git/provenance | changed-file completeness、MIXED hunk |
| G1 | 架构边界/构建 | pristine host、Team diff=0、fresh repo |
| G2 | 最高推理/black-box | public seam ordering、fork-only independence |
| G3 | domain architecture | identity、policy precedence、compatibility |
| G4 | persistence/recovery | crash consistency、idempotency、schema |
| G5 | Agent runtime | cold bind、persona/model/capability |
| G6 | orchestration | ActivationProvider authority、N instances、restart |
| G7 | 最高推理/semantics | drift、mutation、lifecycle、fork、handoff、legacy |
| G8 | API/contract | projection authority、Remote generation/reconnect |
| G9 | UI architecture | external client only、native Session invariance |
| G10 | release/adversarial | zero-core、compat matrix、dormant invariance、recovery |

---

# 23. 关键串行链

以下链路不可为了“加快开发”而打散：

```text
G1
→ P2 seam proof
→ G2
→ P3 contract freeze
→ P4 durable authority
→ P5 Agent binding
→ P6 runtime
```

另一个必须串行的 client 链：

```text
P7 backend semantics frozen
→ P8 Projection DTO
→ P8 Remote v1
→ G8
→ P9 client store
→ UI fan-out
```

以及 release 链：

```text
P9/G9
→ P10 stress/invariance
→ compatibility CI
→ independent release audit
→ G10
```

---

# 24. 最适合并行的任务簇

高价值并行点：

```text
P0: commit provenance || file provenance || behavior inventory
P2: lifecycle || persona/model || capability || storage/fork probes
P3: Blueprint || Member lifecycle || Policy || Compatibility (contracts v1 后)
P5: persona || model || capability adapters (binder skeleton 后)
P6: messaging || control || activity (Runtime authority 后)
P7: lifecycle || fork || handoff || legacy adapter；compat/mutation单独链
P9: New Team || Shell/Dock || Timeline || Members || Controls (client store freeze 后)
P10: recovery || race || performance || dormant invariance
```

这些位置才是增加 subagent 数量最有收益的地方。

---

# 25. 不适合并行的任务簇

```text
contract design ↔ consumers before freeze
schema design ↔ journal implementation before schema freeze
ActivationProvider ↔ Team tools that assume its API before freeze
Remote DTO ↔ UI state model before v1 freeze
Gate review ↔ ongoing feature edits
release audit ↔ last-minute ungated fixes
```

---

# 26. 如何处理 `CORE_SEAM_BLOCKER`

当 worker 报 blocker 时，主 Agent 不应立即问用户。先执行：

```text
A. independent reproduction
B. inspect public docs/exports only
C. verify no already-approved fallback exists
D. classify critical vs capability-local
```

### capability-local blocker

例如某个 optional MCP narrowing seam 缺失，但 frozen spec 允许该能力 FATAL/unsupported：

```text
mark capability unsupported
continue unaffected work
```

### architecture-critical blocker

例如：

```text
ROOT_COLD_BINDING
AGENT_CREATE_SETUP
STORAGE_DOMAIN
TEAM_REMOTE
CLIENT_MODULE
NEW_TEAM_ENTRY (无 equivalent public entry)
```

如果确认缺失且没有 frozen fallback：

```text
STOP dependent DAG
→ Human Owner architecture decision
```

**永远不自动把解决方案改成 core patch。**

---

# 27. 第一个 headless milestone 的 Agent 执行定义

当 G6 完成时，主 Agent应能执行一个完整 smoke task：

```text
pristine upstream host
+ external dsh-agent-team
+ Blueprint
+ TeamDomain
+ Root bind
+ same template create Instance A/B
+ both Agent run
+ followup A resumes same Session
+ process restart
+ cold followup B
+ projection inspect
+ host git diff = 0
```

这个 milestone 比任何 UI snapshot 更重要。

---

# 28. 第二个 Web milestone 的 Agent 执行定义

G9 前 E2E：

```text
New Team
→ preflight WARNING
→ ACK
→ create Root
→ Team Tab
→ create same-template A/B
→ Timeline shows both
→ inspect A
→ model override A
→ archive A
→ restore A => SETTLED
→ followup A => resume
→ click A => native child Session Chat/Trajectory
→ Root fork => new TeamSession zero members
→ legacy Team => read-only
```

同时：

```text
ordinary Session remains unchanged
```

---

# 29. Release DoD for the Agent Workflow

不仅产品代码要完成，Agent 开发流程本身也必须满足：

```text
[ ] 每个 merged task 有 TaskPacket？
[ ] 每个 merged task 有 TaskResult？
[ ] 每个 task 有独立 R2 ReviewResult？
[ ] 每个 Phase 有 exact SHA 的 GateReport？
[ ] shared contract 修改是否都有 owner task？
[ ] 是否没有 worker 越界修改 upstream？
[ ] 是否没有 reviewer 直接修后自批？
[ ] 是否所有 blocker 都有结构化记录？
[ ] 是否 main 的每个 release commit 都可追溯到 approved task？
[ ] 是否可以从 repo artifacts 重建当前工作流状态，而不依赖聊天历史？
```

全部满足时，才说明“主 Agent 管理 + subagent 编码/审查”的方法真正具有可重复性。

---

# 30. 最终工作流摘要

```text
                 ┌──────────────────────────┐
                 │ Frozen Architecture/UI    │
                 │ Development Plan          │
                 └────────────┬─────────────┘
                              │
                              ▼
                 ┌──────────────────────────┐
                 │ Main Agent Task Graph     │
                 │ + Locks + Exact SHAs      │
                 └────────────┬─────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
          Implementer A  Implementer B  Test Worker
                │             │             │
                └────── TaskResults ────────┘
                              │
                              ▼
                     Independent R2 Review
                              │
                         APPROVE only
                              │
                              ▼
                     Phase Integration SHA
                              │
                              ▼
                     Independent Gate Review
                              │
                          PASS only
                              │
                              ▼
                             main
```

最终核心纪律可以压缩成六句话：

1. **主 Agent 管图，不做常规编码。**
2. **worker 一任务一 worktree，只写 owned paths。**
3. **共享 contract 先冻结，再 fan-out。**
4. **coding 与 review 分离，Gate 与 task review 再分一层。**
5. **任何 upstream-required workaround 都停止并报 `CORE_SEAM_BLOCKER`。**
6. **所有状态、证据与决策落到 Git/repo artifact，不依赖长会话记忆。**

---

**End of Task Decomposition & Review Method**
