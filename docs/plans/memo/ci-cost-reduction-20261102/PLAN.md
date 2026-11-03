# CI 成本与验证分层方案

> **Dated**: 2026-11-03（UTC）· **修订**: rev 4，按第三轮外部审查（2026-11-03，对 `69bd7e0a0`）做定点收口
> **状态**: 提案；**未修改任何 CI 配置**；阶段一待授权，阶段二–四为独立后续提案
> **性质**: 设计/选型 memo（`docs/plans/memo/`），不是当期执行计划，不改变机器权威指针
> **范围**: CI 触发策略、验证分层、本地开发入口、重复运行消除；不涉及产品代码、upstream、`AGENTS.md`、`graph.yaml`、权威快照
> **一句话**: 把「每次 push 都跑全量 census」改成「草稿期每次 push 走 L1；标记 ready 时在最终 head 上跑一次 L2；合并后 L3 周期回归」，不降低任何最终合并提交的验收强度。

---

## 0. 定位与授权状态

### 0.1 问题模型（沿用 rev 3，审查确认）

| 问题 | 表现 | 对策 |
|---|---|---|
| **频率过高** | 每次 push 都跑九根全量 census ×2 capture | L1（草稿期，约 2 分钟）/ L2（ready，约 18 分钟）分层 |
| **计算重复** | `ci-full` 与独立 `census-runtime` 各跑一遍；每次冷建 host | 阶段一退休 `census-runtime`；host/pnpm 缓存列阶段三 |
| **职责不清** | 全量回归与新功能正确性混在一个门里 | 明确 census 只保回归；新功能由 G2–G5 逐工具验收承担 |

EB3-C 聚合器本身不是缺陷（Codex、DSH 上游同样使用 Required 聚合器 + 合成合并提交）；问题在「哪些检查必须进聚合器、多久跑一次」。

### 0.2 rev 4 相对 rev 3 的变更（逐条对应第三轮审查）

| 审查项 | 变更 |
|---|---|
| **P0-1 新建 PR 可能先跑一次完整 L2** | §3.3 改为 **草稿优先（draft-first）**：`draft == true` 即走 L1；`ready_for_review` 走 L2；`converted_to_draft` 回 L1；标签保留为显式附加开关。`pull_request.types` 增加 `ready_for_review`、`converted_to_draft`；manifest `deferral.callerIf` 与负控同步。**直接以 ready 创建 PR 仍会先跑一次 L2**——这一点明确披露，不再假装标签能兜住首次运行 |
| **P0-2 L0 选不到测试文件** | §4.2 给出保守、可执行的选测规则（改测试→跑该测试；改包源码→跑同包测试；其余→`undetermined`），并加**受影响测试失败注入**负控 |
| **P1-1 `ci-census` 缺 host-security 与 transcript leg** | §4.1 B1/B3：新层 legs 明确为 `host-security-suites`、`census`、`gate-transcript-regrade`；workflow 必须实际新增 `eb3-security-run` 步骤（`census-runtime.yml` 今天没有它），并保留 transcript re-grade |
| **P1-2 `workflow_dispatch` 过渡方案冲突** | 删除「过渡期用手动入口」；阶段一明确**不提供** master 手动 census；阶段四单独设计 |
| **L1 Required 语义文字矛盾** | §3.5 用状态表写死：L1 时 `ci-required` **必须非绿**、`ci-required-deferred` 绿、不可合并；L2 时两者均绿 |
| **并发组只保留一个等待任务** | §9 记录 GitHub 事实（每组 ≤1 running + 1 pending，新 pending 替换旧 pending），并把「中间 push → ready → 最终完整检查」的连续事件测试写入 §8.4 |
| **合并还依赖 settlement** | §8.4 覆盖 settlement 流；B13 给 `pr-gate` 增加 `ready_for_review`/`labeled`/`unlabeled` 触发，使门禁在层级切换后重评 |
| **收益模型** | §2.5 重算：按**实际 workflow run** 计，包含首次运行、标签/草稿切换的额外 run 与 settlement；标注为理想序列模型 |

### 0.3 本轮审查给出的授权建议（据此执行）

| 部分 | 建议 |
|---|---|
| 整体 L0–L3 架构 | 通过，不再重新设计 |
| PR-A1 本地内循环 | 可开始实施；补齐选测规则与负控 |
| PR-B census 拆层 | 条件批准；先修订首次触发策略与接线遗漏 |
| PR-A2 本地 census 预检 | 阶段一后半段，不阻塞核心路径 |
| 阶段二影响面门禁 | 继续延期，等使用数据 |
| 阶段三缓存/分片/runner | 继续延期 |
| 阶段四 L3 | 独立推进 |

**实施边界（审查明确要求）**：不得为解决这些问题自行扩展成新的通用调度框架、依赖分析引擎或 CI 状态机；优先使用既有 GitHub Actions 机制与现有脚本。

### 0.4 rev 2/rev 3 已落实项（保留，不重复论证）

`ci-census` 必须 `cancel-in-progress: false`；新层必须补齐 `merge_tree` 输入、`--assert-tree` + `EB3_EVENT`、job→`workflow_call` 输出链、`if: always()` 的 `job.status` verdict，且必须是纯 `workflow_call`；`check-artifacts-at-head` 内部就会 install+build，不能当「要不要构建」的判据；`--census-json` 只是单报告诊断性复评；等价性用四类证据；runner-min 算术已更正；Q1–Q8 已按裁决。

---

## 1. 外部对照与本仓现状

### 1.1 外部实践（审查者提供，未在本仓复核）

| 项目 | 做法 |
|---|---|
| OpenAI Codex | PR 阶段只跑快速检查与主力 Bazel 路径；完整跨平台矩阵、Release 构建放合并后 |
| Vite | 常见 PR CI 约 5–8 分钟 |
| OpenCode | 常见 5–13 分钟；主动管理并发与重复运行 |
| DSH 上游 | Required 聚合器 + 分阶段 workflow（PR / Windows / master）+ pnpm store 缓存 + 更强 runner + `DSH_GATE_FAIL_FAST` |

引用它们只说明「分层不是特例」。本仓数字见 §2。

### 1.2 本仓已有机制（实施必须复用）

1. `ci-required.yml` 的触发类型已含 `labeled` / `unlabeled`（注释写明这是 deferral 的承重条件）。
2. `dev/ci/eb3-impact-graph.json` + `scripts/eb3-impact.mjs`：路径 → **层/检查类别**的并集选择，unknown → 全量，未知层名 → 拒绝；`ci-fast` 每轮运行并写 `$GITHUB_OUTPUT`，但**没有任何层据此选择**（advisory-only）。
3. 聚合器 `--grade-needs` 只枚举 GREEN（`success` + `verdict=PASS`），`cancelled`/`skipped` 天然非绿。
4. `census-runtime.yml` 已有 census 与 **transcript re-grade**，但**没有** host-security 步骤；`ci-full.yml` 有 host-security 并有 `gate-transcript-regrade` leg。
5. `pr-gate.yml` 触发为 `pull_request`（默认类型）+ `push` + `workflow_dispatch`，**不含** `labeled`/`unlabeled`/`ready_for_review`——所以层级切换后 `pr-gate`（含 settlement）不会自动重评。

---

## 2. 实测成本与修订后的账单

### 2.1 单轮 Required（run `41214261445`，2026-10-31）

| 构件 | 实测 |
|---|---|
| synthesize | 11s |
| **ci-full** | **1028s（17.1 min）** |
| ci-fast / ci-integration / ci-security | 77s / 51s / 41s |
| aggregate | 10s |
| **墙钟** | **19.4 min** |

### 2.2 ci-full 内部（job `124575440260`）

| 步骤 | 耗时 | 占比 |
|---|---|---|
| Build pristine host | **245s** | 24% |
| Build this repo | 19s | 2% |
| Gate `--full` | 742s | 72% |
| └ **census（2 captures）** | **676s** | **66%** |
| └ typecheck / lint / artifacts-at-head | 25.2 / 22.1 / 17.4s | 6% |
| 其余 leg | <2s | 0% |

### 2.3 重复与波动

- 独立 `census-runtime`（run `41508157238`）：host 264s + repo 21s + census 796s ≈ **18.3 min**，每个 PR 都跑。
- 文档 PR 轮（2026-11-02）：`census-runtime` **18m31s**、`ci-full` **21m26s** → 单点不足，需 P50/P90。

### 2.4 账单（每次完整运行）

| 分项 | 现状 runner-min | 阶段一后（L2 那一次） |
|---|---|---|
| synthesize + aggregate | 0.35 | 0.35 |
| ci-fast / integration / security | 2.81 | 2.81 |
| `ci-full`（含 census） | **17.13** | — |
| `ci-product`（8 个非 census leg） | — | ≈1.4 |
| `ci-census`（host + build + 2 captures） | — | ≈18.0 |
| 独立 `census-runtime` | **18.33** | 0（退休） |
| **ci-required 体系小计** | **38.6** | **22.6** |
| legacy `pr-gate` | ≈2.1 | ≈2.1 |
| `candidate-protection` | 0.2 | 0.2 |
| **全部 Actions** | **≈40.9** | **≈24.9** |

### 2.5 每 PR 模型（按实际 workflow run 计；P0 用真实 run 数校正）

假设：3 次草稿期 push + 1 次 ready。

| 模式 | 每次 push 墙钟 | 每 PR 总墙钟 | 每 PR runner-min |
|---|---|---|---|
| 现状（4 次完整） | 19.4 min | ≈77.6 min | ≈163.6 |
| 阶段一（3×L1 + 1×L2） | L1 ≈ **2.1 min**（`ci-required` 1.8 与 `pr-gate` 2.0 并行取大）；L2 ≈ **18.5 min** | ≈**24.8 min** | ≈**45.9** |

**必须计入、rev 3 未单列的**：
- 以非草稿创建 PR → 首次即 L2（+18.5 min 墙钟、+24.9 runner-min）；本模型假设按 §3.3 以草稿创建。
- 使用标签路径时，`labeled`/`unlabeled` 各自触发一次完整 `ci-required` 运行（+1.8 min / +4.6 runner-min 各一次）。
- settlement 评论不触发 `pr-gate`（其触发类型不含评论事件），最终 head 的 settlement 需在 B13 之后由 `ready_for_review` 重评，或显式 rerun。

结论：**≈78 → ≈25 分钟墙钟、≈164 → ≈46 runner-min** 是理想序列模型，不是保证值；P0 按真实 run 统计。

---

## 3. 分层模型

### 3.1 分层

| 层 | 触发 | 内容 | 目标墙钟 | Required 语义 |
|---|---|---|---|---|
| **L0 内循环** | 本地，每次修改 | 受影响测试、`pnpm -r typecheck`、`docs:probe`、`docs:sync --check`、CI 形状检查 | 秒级–1 分钟 | 否 |
| **L1 PR 草稿期** | 每次 push（PR 为 draft） | synthesize + ci-fast + ci-integration + ci-security + ci-product | ≈2 分钟 | `ci-required` **必须非绿**；`ci-required-deferred` 绿；不可合并 |
| **L2 合并门** | 标记 ready（或去掉标签） | L1 全部 + `ci-census`（host + 安全套件 + 九根双 capture + transcript） | ≈18 分钟 | 两者均绿；满足其他必需检查后可合并 |
| **L3 主分支/周期** | master push 后 / 定时 | 全量 census 复测、flake 分析、跨环境 | 不约束开发 | 否（告警） |

### 3.2 与 EB3-C 的映射

- 分支保护仍是三个上下文：`pr-gate` / `ci-required` / `pr-settlement-gate`。
- `ci-required.needs` 始终包含 `ci-census`；草稿期它被 deferral 跳过 → 聚合红（fail-closed）。
- 去掉 deferral 条件（转 ready / 去标签）→ 同一 head 重跑 → census 执行 → 聚合绿。

### 3.3 触发约定：草稿优先（draft-first）

**deferral 条件**（manifest `deferral.callerIf`，逐字比对，必须与 workflow 完全一致）：

```yaml
if: ${{ github.event.pull_request.draft || contains(github.event.pull_request.labels.*.name, 'ci-defer-full') }}
```

理由与取舍：

| 创建方式 | 首次运行 | 说明 |
|---|---|---|
| **Draft PR**（推荐） | **L1** | 从创建即省 census；`ready_for_review` 时跑 L2 |
| 直接 Ready | **L2** | 无法避免；明确披露，不假装标签能兜住首次运行 |
| Ready + 事后加标签 | 首次 L2，加标签再触发一次 L1 | 两次运行都计费；这正是 rev 3 的漏洞 |

**触发类型**（`ci-required.yml`）：

```yaml
types: [opened, synchronize, reopened, labeled, unlabeled, ready_for_review, converted_to_draft]
```

- `ready_for_review`：草稿 → ready，跑 L2；
- `converted_to_draft`：ready → 草稿，回 L1（若需继续迭代）；
- `labeled`/`unlabeled`：保留标签作为显式附加开关（例如 ready PR 临时降级）。

**纪律**：PR 以草稿创建 → 中间 push 全走 L1 → 完成后点 “Ready for review” → L2 一次 → 合并。

### 3.4 事件序列（验收必须覆盖）

| # | 事件 | 期望 |
|---|---|---|
| 1 | 打开 Draft PR | `ci-required` 跑 L1，红（deferred）；`ci-required-deferred` 绿 |
| 2 | push ×N（仍 draft） | 每次 L1；墙钟 ≤3 分钟 |
| 3 | 标记 Ready | 同一 head 重跑，`ci-census` 执行，聚合绿 |
| 4 | 写 dated settlement 评论 | `pr-gate` 重评（依赖 B13 的新触发类型） |
| 5 | 合并前 | 三个必需上下文对**最新 SHA** 均为 valid |
| 6 | 合并后 | L3 全量 census（阶段四） |

### 3.5 Required 语义（写死，避免误读）

| 状态 | L1 | L2 |
|---|---|---|
| `ci-required-deferred` | 通过时绿 | 不适用（不跳过） |
| `ci-required` | **必须非绿** | **必须绿** |
| `pr-gate` | 绿（若 settlement 缺失则红） | 绿 |
| 能否合并 | **否** | 满足其他必需检查后**可以** |

### 3.6 census 保的是回归，不是新功能正确性

- census 回答：既有 7936 个注册项里有没有**新的失败身份**、有没有 collection escalation。
- 它**不**回答：新审批路由是否正确、新工具在真实 Host 上是否受限——这些是 G2–G5 逐工具验收与对应套件。
- 因此分层不削弱验收；但要防止「census 绿 = 功能对」的误读。

---

## 4. 阶段一（本提案请求授权的范围）

### 4.1 PR-B：census 拆层 + 退休重复运行

| # | 文件 | 改动 | 为什么必须 |
|---|---|---|---|
| B1 | `dev/ci/eb3-ci-manifest.json` | `ci-full` → `ci-product`（`hostFree:true`，8 个非 census leg，`cancelInProgress:false`）；新增 `ci-census`：`cancelInProgress:false`、`hostFree:false`、legs = **`host-security-suites`、`census`、`gate-transcript-regrade`**、保留 forbid；`deferral.layer` 改 `ci-census`、`deferral.callerIf` 改为 §3.3 条件（标签名仍 `ci-defer-full`）；`movedSuites[].to` 改 `ci-census`；`knownNonRequired` 移除 `census-runtime` 条目 | 唯一声明；legs 必须保留 transcript 的机器强制验证 |
| B2 | `.github/workflows/ci-full.yml` → `ci-product.yml` | 删 host provision/build 与 census；用 `--only` 显式列 8 个非 census leg | 层文件是 grader 输入 |
| B3 | `.github/workflows/census-runtime.yml` | ① `on:` 改**纯 `workflow_call`**（删 `pull_request`/`push`/`workflow_dispatch`——`--assert-tree` 只认 `pull_request`，且旧触发器让 deferral 失效）；② `workflow_call.inputs.merge_tree`；③ `--assert-tree "${{ inputs.merge_tree }}"` + `EB3_EVENT`；④ job→`workflow_call` 输出链；⑤ `if: always()` 的 `job.status` verdict；⑥ `cancel-in-progress: false`；⑦ **新增 host-security 步骤**（`node scripts/eb3-security-run.mjs --layer ci-census --list-file tests/checks/eb3-host-security-suites.txt …`，此前该文件没有此步骤）；⑧ 保留 transcript re-grade | 缺一项即 grader 红或行为丢失 |
| B4 | `.github/workflows/ci-required.yml` | caller 改名 + 新增 `ci-census` caller（`with: merge_tree`）；`types` 增 `ready_for_review`、`converted_to_draft`；caller `if` 改为 §3.3；`needs` 与汇总 job 同步；`required-deferred` needs 同步 | 漏进 needs = 该层失败而聚合仍绿 |
| B5 | `scripts/eb3-ci-required.mjs` | 头注释层名；`CI_DEFERRAL_CONFLICT` 对新的 `callerIf` 形式逐字比对 | 文本不同步即红 |
| B6 | `scripts/eb3-ci-negative-controls.mjs` | C9 `FULL` 路径、C12 循环、C21/C22 fixture；新增草稿/ready 两个 deferral 变体 | 硬编码 `ci-full` 与旧 `callerIf` |
| B7 | `scripts/eb3-security-run.mjs` + `tests/checks/eb3-host-security-suites.txt` | `--layer ci-full` → `--layer ci-census` | 套件归属必须与层一致 |
| B8 | `dev/ci/eb3-impact-graph.json`、相关脚本 | 按名字枚举层处同步 | 影响面与汇总器可能按名字匹配 |
| B9 | 分支保护 | **不改** | 改动即风险 |
| B10 | 文档与证据 | `ci-full` 引用更新；L1/L2 纪律写入当期计划；`SESSION_ROUTER_LOG.md` 只追加 | 文档是快照 |
| B11 | 验收证据 | §8.3 四类证据 + 静态负控 | 逐字一致不可执行 |
| B12 | 集合完整性断言 | `--only` 清单 ∪ `{census}` == `LEG_ORDER`，否则红 | 防未来新增 leg 静默漏测 |
| **B13** | `.github/workflows/pr-gate.yml` | `pull_request.types` 增 `ready_for_review`、`labeled`、`unlabeled` | 否则层级切换后 `pr-gate`/settlement 不重评，最终 head 拿不到有效 verdict |

### 4.2 PR-A1：L0 内循环（含选测规则）

```
node scripts/ci-local.mjs [--fast] [--base origin/master]
```

固定步骤：`docs:probe` → `docs:sync --check` → `eb3-ci-required.mjs` → `pnpm -r typecheck`；CI 自身文件变更时追加 `eb3-ci-negative-controls.mjs`。

**选测规则（首版，保守，不做依赖图）**：

| 变更 | 选择 | 说明 |
|---|---|---|
| 改了测试文件 `packages/<pkg>/test/**`、`tests/**/*.test.*` | 直接运行这些文件 | 精确 |
| 改了 `packages/<pkg>/src/**` | 运行 `packages/<pkg>/test/**` 全部 | 同包保守，不解析 import 图 |
| 改了根级共享面（`package.json`、`pnpm-lock.yaml`、`tsconfig*`、`scripts/`、`tests/paths.mjs`） | **`undetermined`** | 不猜，交给 L1/L2 |
| 无法归属的路径 | **`undetermined`** | 同上 |
| 无变更 | 只跑固定步骤 | — |

**退出码**：`0` = 选中并全部通过；`1` = 有选中测试失败/检查失败；`2` = **测试覆盖未确定**（固定步骤仍已跑完）。

输出一行：

```
DSH-CI-LOCAL verdict=pass|fail|undetermined selected=… files=… wall=…s coverage=…
```

**硬性要求**：`undetermined` 绝不打印「受影响测试全部通过」；目标墙钟实测后写死（初始 ≤60s，超时不算失败但记入指标）。

### 4.3 PR-A2：census 预检（L2 前，不是内循环）

- 快速档：已构建 HEAD 上 `--full --only census --census-captures 2 --census-test-timeout 90000`；明确非合成树等价。
- 合成树档：synthesize → 新 worktree → 断言 pin 一致 → **为该 worktree 准备依赖与构建** → 同一 census 调用 → 打印 tree id。
- `--census-json` 仍只是单报告诊断性复评。

### 4.4 阶段一范围外

影响面门禁（阶段二）、缓存/分片/runner/fail-fast 与 `pr-gate` 去重（阶段三）、L3 与 master 手动入口（阶段四）。

---

## 5. 阶段二（暂缓，等数据）

现状：`eb3-impact-graph.json` 只映射到「层/检查类别」，**不是测试文件依赖图**，且当前不驱动层选择。若升级为门，最小可信设计：`synthesize` 用合成树计算 `EB3_SCOPE`（含 graphDigest），聚合器**独立重算**，只对图中确实排除的层接受 `skipped`；负控：未知路径 → 全量、篡改图 → 拒绝。

**暂缓条件**：先用阶段一数据看 docs/evidence PR 占比；占比低则不做。

---

## 6. 阶段三（独立）：缩短 L2 与去重

| 手段 | 做法 | 注意 |
|---|---|---|
| host build cache | key = pin SHA + lockfile hash + Node 版本 + 平台；命中后仍跑 pin 断言与内容校验 | 缓存是性能优化，不是正确性检查 |
| pnpm store cache | `actions/cache`；install 仍 `--frozen-lockfile` | 与 host cache 分开度量 |
| census 分片 | 按文件切 N 片，各片自带 2 captures，聚合器取并集 | leg 行声明分片数；「2 captures 相同」变逐片断言 |
| 更强 runner | 16 vCPU（若可用） | 成本/收益实测 |
| fail-fast | 层内首个失败 leg 提前终止 | 未跑的 leg 必须显式 not-run，不能误报 skip |
| `pr-gate` 去重 | 它仍在做 install + build + `--full --allow-refused census` | 与 `ci-required` 重叠，值得单独立项 |

---

## 7. 阶段四（独立）：L3 与 master 入口

- master push 后跑一次全量 census（不带 Required 语义），结果告警；
- 定时 flake 分析与 load family 重采样；
- **master 手动/定时 census 入口单独设计**（阶段一明确不提供；`--assert-tree` 只服务 PR 事件，不能靠改新必需要层兼容 master）。

---

## 8. 验收标准

### 8.1 阶段一 PR-A1

- 已知绿树：`ci-local --fast` 退出 0；
- 注入类型错误 → 退出 1 且指出文件；
- 注入 docs:sync 违规 → 退出 1；
- **注入受影响包内的测试失败 → 退出 1，且运行了该测试文件**（证明 L0 真跑测试，而不只是 typecheck/docs）；
- 修改根级共享文件 → 退出 2 且输出 `coverage=undetermined`；
- 实测墙钟记入 P0 数据表。

### 8.2 阶段一 PR-B（结构）

```bash
node scripts/eb3-ci-required.mjs            # 0 findings
node scripts/eb3-ci-negative-controls.mjs   # 全绿（含草稿/ready 两个 deferral 变体）
```

通过条件：`needs` 完整含 `ci-product` 与 `ci-census`；新层过 merge-tree/输出/取消三条规则；legs 含 `host-security-suites`、`census`、`gate-transcript-regrade` 且 workflow 实际执行；`--only` 清单 ∪ `{census}` == `LEG_ORDER`；`census-runtime` 不在 `knownNonRequired`，并有静态负控。

### 8.3 拆分等价性（四类证据）

| 检验对象 | 要求 |
|---|---|
| 测试配置 | 九根、baseline、2 captures、90s、forbid 集合不变（机器 diff，差异仅限层名/路径） |
| 全人口实跑 | 新 `ci-census` 在已知绿树执行全部人口，无缺席/refusal/skip |
| 失败注入 | 新 red 与 collection escalation → `ci-required` 变红 |
| 拓扑负控 | 缺席/跳过/取消/输出缺失 → 聚合均非绿；新必需层不在 `knownNonRequired` |

### 8.4 端到端事件序列（hosted，阶段一必须）

按 §3.4 的 6 步实跑一次：

1. Draft 创建 → L1 红、deferred 绿、墙钟 ≤3 分钟；
2. 中间 push → 仍 L1；
3. **Ready** → 同一 head 重跑，`ci-census` 执行，聚合绿、墙钟 ≤20 分钟；
4. settlement 评论 → `pr-gate` 重评并转绿（B13）；
5. 三个必需上下文对最新 SHA 均 valid；
6. 记录实际 run 数与 P50/P90，校正 §2.5。

---

## 9. `cancel-in-progress` 与并发组（记录，不在本轮重构）

- Required 工作流一律禁止取消；`cancelled` 既非绿也非红。聚合器只枚举 `success`+`PASS`，因此取消天然 fail-closed。
- **并发组事实**：GitHub 同一 group 至多保留一个 running + 一个 pending；新的 pending 会替换旧的 pending（即使 `cancel-in-progress: false`）。因此快速连续 push 时，中间某次运行可能根本不执行——最终 head 的运行仍会执行，合并门不受影响，但「每次 push 都有独立结论」不成立。
- 结论：本轮不改。若未来复审：先证明聚合器对 `cancelled` 非绿（已满足），再限定并发组形式，并加负控「取消当前 SHA 的运行 → 聚合必须红」。

---

## 10. 风险登记

| ID | 风险 | 可能性 | 影响 | 缓解 |
|---|---|---|---|---|
| R1 | L1 的红被误读为「PR 坏了」 | 高 | 中 | `ci-fast` 打印 `EB3-TIER deferred`；PR 模板写明 |
| R2 | 以非草稿创建 PR → 首次 L2 | 中 | 中 | 流程要求草稿创建；§2.5 已计入成本 |
| R3 | 忘记转 ready → 永远 L1 | 中 | 中 | 聚合红 → 无法合并；汇总行提示 |
| R4 | 阶段一无 master 手动 census | 中 | 低 | 明确披露；阶段四补 |
| R5 | 拆层中间态必红 | 高 | 低 | 一次改全（B1–B13 同一 PR） |
| R6 | 新层漏 `cancel-in-progress: false` | 中 | 中 | B3 + `CI_LAYER_CANCELLABLE` |
| R7 | 新层漏 merge-tree 绑定/输入 | 中 | 高 | B3 + grader |
| R8 | `LEG_ORDER` 新增 leg 后 product 漏更新 | 中 | 高 | B12 断言 |
| R9 | 探针 worktree 缺依赖/host | 高 | 中 | §4.3 显式准备；快速档只在主工作区 |
| R10 | 单报告复评误读为重放 | 中 | 中 | §4.3 披露 |
| R11 | `ci-census` 丢 host-security/transcript | 中 | 高 | B1/B3 明确 legs + 步骤 |
| R12 | 选测规则漏掉受影响测试 | 中 | 中 | `undetermined` 保守回退 + 负控 |
| R13 | 连续 push 的 pending 被替换 | 中 | 低 | §9 披露；最终 head 仍执行 |
| R14 | settlement 不随 ready 重评 | 中 | 高 | B13 触发类型 + §8.4 覆盖 |
| R15 | 缓存投毒/命中错误内容 | 低 | 高 | key 绑 pin+lockfile+平台；命中后校验 |
| R16 | 分片破坏「双 capture 相同」 | 中 | 中 | 逐片断言 + leg 行声明 |
| R17 | 把 census 绿当功能验收 | 中 | 高 | §3.6 明写；G2–G5 独立 |
| R18 | 范围蔓延成新调度/依赖引擎 | 中 | 中 | §0.3 实施边界；Review 把关 |

---

## 11. 指标

1. **TTFF**：push → 第一条可定位红灯（L1 应 ≤2 分钟）。
2. **IWC**：一次修改从本地验证到可用结论的总时间（衡量 L0）。
3. **L1 / L2 P50、P90 墙钟**。
4. **每 PR 实际 workflow run 数**（而非 push 数）与 runner-min 总账。
5. **L1 停留时长分布**（识别「一直不转 ready」的滥用）。

基线：P0 采集最近 5–10 个 PR 的上述指标。

---

## 12. 未决问题

1. 是否接受草稿优先约定（推荐接受；替代方案是接受首次 L2）。
2. 阶段二是否要做（取决于 docs/evidence PR 占比）。
3. `pr-gate` 与 `ci-required` 的最终职责边界（阶段三）。
4. 缓存 key 的精确组成与失效策略。
5. `cancel-in-progress` 是否另立提案（建议阶段三之后）。

---

## 附录 A：复审阅读顺序

1. `.github/workflows/ci-required.yml`（触发类型、needs、deferral、汇总）
2. `.github/workflows/ci-full.yml`（host-security、census、transcript legs）
3. `.github/workflows/census-runtime.yml`（第二份普查；缺 host-security；`cancel-in-progress: true`）
4. `.github/workflows/pr-gate.yml`（触发类型；settlement 如何被重评）
5. `dev/ci/eb3-ci-manifest.json`（层、legs、deferral 逐字条件）
6. `scripts/eb3-ci-required.mjs`（取消/绑定/输出/skippable）
7. `scripts/ci-pr-gate.mjs`（`LEG_ORDER`、`--only`、census 比较）
8. `dev/ci/eb3-impact-graph.json` + `scripts/eb3-impact.mjs`（只到层/检查，不到测试文件）

## 附录 B：证据索引

| 事实 | 出处 |
|---|---|
| 单轮 job 耗时 | run `41214261445`，job `124575440260` |
| census-runtime 耗时 | run `41508157238`；文档 PR 轮 `41515916372` |
| `labeled/unlabeled` 已在触发类型 | `ci-required.yml` 的 `on.pull_request.types` 注释 |
| `census-runtime.yml` 无 host-security | 该文件步骤清单 |
| `ci-full` 有 `gate-transcript-regrade` leg | `dev/ci/eb3-ci-manifest.json` |
| `pr-gate` 触发不含 label/ready | `pr-gate.yml` 的 `on:` |
| 影响图只到层/检查 | `scripts/eb3-impact.mjs` 的 `selectImpact` 返回值 |
| 聚合器拒绝 cancelled | `scripts/eb3-merge-tree.mjs --grade-needs` |
| 基线人口 | `dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-u7-1-old-reds.md` |

## 附录 C：成本公式

```
L1 墙钟 ≈ max(T_ci_required_L1, T_pr_gate) ≈ max(1.8, 2.0) ≈ 2.1 min
         T_ci_required_L1 ≈ T_synth + max(T_fast, T_integration, T_security, T_product) + T_aggregate
                         ≈ 11 + 85 + 10 ≈ 106s
L2 墙钟 ≈ max(T_synth + T_census_layer + T_aggregate, T_pr_gate) ≈ 18.5 min
每 PR   ≈ N_push × L1 + L2 (+ 首次非草稿的额外 L2)
```
