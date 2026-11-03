# CI 成本与验证分层方案

> **Dated**: 2026-11-03（UTC）· **修订**: rev 3，按第二轮外部审查（2026-11-03，对照 Codex / Vite / OpenCode / DSH 上游）重定位
> **状态**: 提案；**未修改任何 CI 配置**；阶段一待授权，阶段二–四为独立后续提案
> **性质**: 设计/选型 memo（`docs/plans/memo/`），不是当期执行计划，不改变机器权威指针
> **范围**: CI 触发策略、验证分层、本地开发入口、重复运行消除；不涉及产品代码、upstream、`AGENTS.md`、`graph.yaml`、权威快照
> **一句话**: 把「每次 push 都跑全量 census」改成「L1 每次 push 约 2 分钟；L2 在最终 head 上跑一次约 18 分钟；L3 合并后周期回归」，不降低任何最终合并提交的验收强度。

---

## 0. 定位：这不是「CI 太慢」，是「验证频率与职责没分层」

rev 1/rev 2 把问题当成「单个工作流太贵」，因此重点放在拆层与本地探针。第二轮审查指出更根本的三层问题，本版接受该判断：

| 问题 | 表现 | 本版对策 |
|---|---|---|
| **频率过高** | 每次 push 都跑九根全量 census ×2 capture；中间提交也付 18 分钟 | L1（每次 push，约 2 分钟）/ L2（最终 head，约 18 分钟）分层；用已有 `ci-defer-full` 机制 |
| **计算重复** | `ci-full` 内 census 与独立 `census-runtime` 各跑一遍；每次冷建 host | 阶段一退休重复的 `census-runtime`；host/pnpm 缓存独立立项 |
| **职责不清** | 全量回归（census）与新功能正确性（G2–G5 验收）混在一个门里 | 明确 census 只保回归；新功能正确性由计划自身的逐工具验收承担 |

**不推翻 EB3-C**：Codex 与 DSH 上游同样使用 Required 聚合器与合成合并提交；问题不在聚合器，而在「哪些检查必须进聚合器、多久跑一次」。

### 0.1 rev 3 相对 rev 2 的变更

| 项 | rev 2 | rev 3 |
|---|---|---|
| 问题模型 | 单点成本（census 被跑两遍） | 频率 / 重复 / 职责三层 |
| 首要交付 | 本地 census 探针（5–8 分钟） | **L1 内循环**（秒级到 1 分钟）；census 探针降级为 L2 前预检 |
| census 在 PR 路径 | 拆层后仍是每次 push 必跑 | 拆层 + **deferral 纪律**：中间 push 不跑，最终 head 跑一次 |
| 独立 `census-runtime` | 仅建议退休 | **阶段一明确退休**（它绕过 deferral，是重复运行的主因） |
| 变更类型选择 | 未涉及 | 记录现状：`dev/ci/eb3-impact-graph.json` + `scripts/eb3-impact.mjs` **已存在**且 fail-closed（unknown → 全量），但**目前只作注解、不驱动层选择**；是否升级为门列为阶段二 |
| `cancel-in-progress` | 按现有契约不动 | 记录为**可复审项**：现状是保守工程约束，不是正确性必要条件；本轮不改，另立提案 |
| 指标 | runner-min + TTFF + IWC | 增加 **L1/L2 各自 P50 墙钟**；runner-min 按「每 PR 总账」而非「每 push」 |

### 0.2 rev 2 已采纳的审查修正（保留，不重复论证）

`ci-census` 必须 `cancel-in-progress: false`；新层必须补齐 `merge_tree` 输入、`--assert-tree` + `EB3_EVENT`、job→`workflow_call` 输出链、`if: always()` 的 `job.status` verdict，且必须是纯 `workflow_call`（`--assert-tree` 只认 `pull_request`）；`check-artifacts-at-head` 内部就会 install+build，不能当「要不要构建」的判据；`--census-json` 只是单报告诊断性复评；等价性用四类证据而非「逐字一致」；runner-min 算术更正；Q1–Q8 按裁决。

---

## 1. 外部对照（审查者提供，未在本仓复核）与本仓现状

| 项目 | 做法 | 与本仓的差距 |
|---|---|---|
| OpenAI Codex | PR 阶段只跑快速检查与主力 Bazel 路径；完整跨平台矩阵、Release 构建放合并后 | 本仓把全量 census 放进每次 push |
| Vite | 常见 PR CI 约 5–8 分钟 | 本仓 L1 目标 1–3 分钟，L2 允许 10–20 分钟 |
| OpenCode | 常见 5–13 分钟；主动管理并发与重复运行 | 本仓 Required 禁止取消，且重复跑两份 census |
| DSH 上游 | Required 聚合器 + 分阶段 workflow（PR / Windows / master）+ pnpm store 缓存 + 更强 runner + `DSH_GATE_FAIL_FAST` | 本仓无 pnpm 缓存、无 host 缓存、无分片、无 L3 入口 |

> 这些是**外部实践引用**，不是本仓测量；本仓的所有数字见 §2。引用它们只用于说明「分层不是特例」。

**本仓已有的相关机制（实施时必须复用，不得另造）**：

1. `ci-required.yml` 的触发类型已含 `labeled` / `unlabeled`（注释写明这是 deferral 的承重条件：加标签要重跑以跳过重层，**去标签要在同一 head 上重跑完整聚合**）。
2. `dev/ci/eb3-impact-graph.json`（schema `eb3-impact-graph/1`）+ `scripts/eb3-impact.mjs` 已实现「路径 → 层/检查」的并集选择，且 **unknown → 全量**、未知层名 → 拒绝；`ci-fast.yml` 已在跑它并写 `$GITHUB_OUTPUT`，但**没有任何层据此选择**（文档注释明确说 docs:sync 从条件执行改成了无条件执行）。
3. 聚合器 `--grade-needs` 只枚举 GREEN（`result == success` 且 `outputs.verdict == PASS`），因此 `cancelled` / `skipped` 天然非绿。

---

## 2. 实测成本（不变；口径已更正）

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

census leg 实测行：

```
captured 654f/8605l, 654f/8605l vs baseline-declared 626 / 7936;
2 captures, identical identity sets — clock: --testTimeout=90000 ms
```

### 2.3 重复与波动

- 独立 `census-runtime`（run `41508157238`）：host 264s + repo 21s + census 796s ≈ **18.3 min**，每个 PR 都跑。
- 同一条在 2026-11-02 文档 PR 上 **18m31s**；同轮 `ci-full` **21m26s**（高于 10-31 的 17.1 min）→ 单点不足，需 P50/P90。

### 2.4 更正后的账单

| 分项 | 现状 runner-min/次 | 阶段一后（L2 那一次） |
|---|---|---|
| synthesize + aggregate | 0.35 | 0.35 |
| ci-fast / integration / security | 2.81 | 2.81 |
| `ci-full`（含 census） | **17.13** | — |
| `ci-product`（8 个非 census leg） | — | ≈1.4 |
| `ci-census`（host + build + 2 captures） | — | ≈18.0 |
| 独立 `census-runtime` | **18.33** | 0（退休） |
| **ci-required 体系小计** | **38.6** | **22.6** |
| legacy `pr-gate`（含一次 `--full --allow-refused census`） | ≈2.1 | ≈2.1 |
| `candidate-protection` | 0.2 | 0.2 |
| **全部 Actions** | **≈40.9** | **≈24.9** |

### 2.5 分层后的每 PR 总账（模型，需 P0 实测验证）

假设一个 PR 有 3 次中间 push + 1 次最终 head：

| 模式 | 每次 push 墙钟 | 每 PR 总墙钟 | 每 PR runner-min |
|---|---|---|---|
| 现状 | 19.4 min | ≈78 min（3×19.4 + 1×19.4） | ≈163 |
| 阶段一（L1×3 + L2×1） | L1 ≈ **1.8 min**；L2 ≈ 18.3 min | ≈**23.7 min** | ≈**36.5** |

**这是本提案最重要的数字**：墙钟降约 70%，runner-min 降约 78%。前提是 deferral 纪律被执行（§3.3）。

---

## 3. 验证分层模型（L0–L3）

### 3.1 分层

| 层 | 触发 | 内容 | 目标墙钟 | 是否 Required |
|---|---|---|---|---|
| **L0 内循环** | 本地，每次修改 | 受影响单测、`pnpm -r typecheck`、`docs:probe`、`docs:sync --check`、CI 形状静态检查 | **秒级–1 分钟** | 否 |
| **L1 PR 更新** | 每次 push（带 `ci-defer-full`） | synthesize + ci-fast + ci-integration + ci-security + ci-product | **≈2 分钟** | 是（聚合必须绿——但见 §3.3 的 L1 语义） |
| **L2 最终合并门** | 最终 head，去掉标签 | L1 全部 + ci-census（host + 安全套件 + 九根双 capture） | **≈18 分钟** | **是** |
| **L3 主分支/周期** | master push 后 / 定时 | 全量 census 复测、flake 分析、跨环境、长时测试 | 不约束开发 | 否（告警，不挡 PR） |

### 3.2 与现有 EB3-C 的映射（不新增第 4 个上下文）

- 分支保护仍是三个上下文：`pr-gate` / `ci-required` / `pr-settlement-gate`。
- `ci-required` 的 `needs` 始终包含 `ci-census`；L1 时它被 **deferral** 跳过 → **聚合红**。
- **红的含义要说清**：L1 的红不是「检查失败」，是「完整门尚未执行」——这正是 fail-closed 的设计：中间提交不可合并，最终提交必须补齐。
- L2 = 去掉标签 → `unlabeled` 触发同一 head 重跑 → census 执行 → 聚合绿 → 可合。

### 3.3 deferral 纪律（唯一需要人/Agent 遵守的约定）

1. PR 创建即加 `ci-defer-full`；
2. 中间 push 全部走 L1（约 2 分钟/次）；
3. 准备合并：先本地跑 L0 全绿 + L2 前预检（§4.3），再**去掉标签**；
4. CI 在最终 head 上跑一次完整 L2，绿后合并；
5. 合并后 L3 复测（阶段四）。

**为什么可行**：`ci-required.yml` 已把 `labeled`/`unlabeled` 列入触发类型，并有注释说明「去标签必须在同一 head 上重跑完整聚合」；`deferral.callerIf` 逐字比对，改一层即可。

**已知代价**：L1 期间 `ci-required` 是红的，外部观察者可能误判为「PR 有问题」。缓解：`ci-fast` 在标签存在时打印显式标记（如 `EB3-TIER deferred: census not run at this head`），且 PR 模板/流程说明写明。

### 3.4 census 保的是回归，不是新功能正确性

- census 回答：既有 7936 个注册项里有没有**新的失败身份**（集合比较）、有没有 collection escalation。
- 它**不**回答：新审批路由是否正确处理已 resolve 的申请、新工具在真实 Host 上是否受限。这些由计划自身的 G2–G5 逐工具验收（`TOOL-ACCEPTANCE-MATRIX`）与对应套件承担。
- 因此分层**不削弱验收**：最终 head 仍要过 census；新功能正确性本来就不由 census 证明。本提案要求文档明写这一点，避免「census 绿 = 功能对」的误读。

---

## 4. 阶段一（本提案请求授权的范围）

阶段一 = 消除重复 + 建立内循环 + 让 deferral 真正生效。**不含**影响面门禁（阶段二）、缓存/分片（阶段三）、L3（阶段四）。

### 4.1 PR-B：census 拆层 + 退休重复的独立运行

| # | 文件 | 改动 | 为什么必须 |
|---|---|---|---|
| B1 | `dev/ci/eb3-ci-manifest.json` | `ci-full` → `ci-product`（`hostFree:true`，8 个非 census leg，`cancelInProgress:false`）；新增 `ci-census`（`cancelInProgress:false`，legs=`host-security-suites`+`census`，保留 forbid）；`deferral.layer` 改 `ci-census`（标签名仍 `ci-defer-full`）；`movedSuites[].to` 改 `ci-census`；从 `knownNonRequired` 移除 `census-runtime` | 唯一声明 |
| B2 | `.github/workflows/ci-full.yml` → `ci-product.yml` | 删 host provision/build 与 census；用 `--only` 显式列 8 个非 census leg | 层文件是 grader 输入 |
| B3 | `.github/workflows/census-runtime.yml` | ① `on:` 改**纯 `workflow_call`**（删 `pull_request`/`push`/`workflow_dispatch`——`--assert-tree` 只认 `pull_request`，旧触发器无法共存，也**正是它们让 deferral 失效**）；② `workflow_call.inputs.merge_tree`；③ `--assert-tree "${{ inputs.merge_tree }}"` + `EB3_EVENT`；④ job→`workflow_call` 输出链；⑤ `if: always()` 的 `job.status` verdict；⑥ `cancel-in-progress: false` | 缺一项即 grader 红/评错树/输出丢失 |
| B4 | `.github/workflows/ci-required.yml` | caller 改名 + 新增 `ci-census` caller（`with: merge_tree`）；`needs` 与汇总 job 的 `needs` 同步；`required-deferred` needs 同步 | 漏进 needs = 该层失败而聚合仍绿 |
| B5 | `scripts/eb3-ci-required.mjs` | 头注释层名；确认 merge-tree/输出/取消三条规则对新层生效 | 文本不同步报 `CI_LAYER_SKIPPABLE` |
| B6 | `scripts/eb3-ci-negative-controls.mjs` | C9 `FULL` 路径、C12 四层循环、C21/C22 fixture 与断言 | 硬编码 `ci-full`；不改会在 `ci-integration` 层红 |
| B7 | `scripts/eb3-security-run.mjs` + `tests/checks/eb3-host-security-suites.txt` | `--layer ci-full` → `--layer ci-census` | 套件归属必须与层一致 |
| B8 | `dev/ci/eb3-impact-graph.json`、`scripts/eb3-merge-tree.mjs`、`scripts/eb3-ci-manifest.mjs`（若存在） | 按名字枚举层处同步；impact 图的 layer 名更新 | 影响面选择与汇总器可能按名字匹配 |
| B9 | 分支保护 | **不改** | 改动即风险 |
| B10 | 文档与证据 | `ci-full` 引用更新；`SESSION_ROUTER_LOG.md` 只追加；PR 模板/L1 纪律写入当期计划 | 文档是快照 |
| B11 | 验收证据 | §8.3 四类证据 + 静态负控 | 逐字一致不可执行（workflow 文件在树内） |
| B12 | 集合完整性断言 | `--only` 清单 ∪ `{census}` == `LEG_ORDER`，否则红 | 防未来新增 leg 静默漏测 |

### 4.2 PR-A1：L0 内循环（优先于 census 探针）

目标：**秒级到 1 分钟**的本地反馈，复用现有脚本，不新造引擎。

```
node scripts/ci-local.mjs [--fast] [--base origin/master]
```

组成（`--fast` 默认）：

| 步骤 | 命令 | 典型耗时 |
|---|---|---|
| 文档/契约一致性 | `scripts/docs-probe.mjs --base <ref>` | ~1s |
| 文档静态法 | `scripts/docs-sync.mjs --check` | ~0.4s |
| CI 形状 | `scripts/eb3-ci-required.mjs` | 秒级 |
| 类型检查 | `pnpm -r typecheck` | ~25–60s |
| 受影响单测 | 由 `eb3-impact.mjs --base` 的路径映射到 `packages/*/test` 的目标子集（`vitest run <files>`） | 视子集 |
| CI 自身变更时 | `scripts/eb3-ci-negative-controls.mjs`（仅在 `.github/**`、`dev/ci/**`、`scripts/eb3-*.mjs` 命中时） | 视情况 |

- 输出一行 `DSH-CI-LOCAL verdict=… steps=… wall=…s`；
- 明确标注：**不证明**合成树、**不替代** L1/L2；
- 目标墙钟在 P0 实测后写死为验收阈值（初始目标 ≤60s，超时不算失败但记入指标）。

### 4.3 PR-A2：census 预检（L2 前，不是内循环）

- 快速档：在已构建 HEAD 上 `node scripts/ci-pr-gate.mjs --full --only census --census-captures 2 --census-test-timeout 90000`；明确非合成树等价。
- 合成树档：synthesize → 新 worktree → 断言 pinned host 与 pin 一致 → **为该 worktree 准备依赖与构建**（不继承主工作区 `node_modules`/gitignored host）→ 跑同一 census 调用 → 打印 tree id。
- `--census-json` 仍只是单报告诊断性复评（不复现并集、不证明 timeout/commit）。
- 定位：**合并前预检**，不是开发内循环；5–8 分钟对这种用途可接受。

### 4.4 阶段一验收

见 §8。

---

## 5. 阶段二（独立提案）：影响面选择是否升级为门

### 5.1 现状

`dev/ci/eb3-impact-graph.json` 已经存在并 fail-closed：`unknown` → 全量；`.md` → 仅 `ci-fast`；`packages/**`、`tests/**`、`tests/paths.mjs` → 含 `census`；`.github/**`、`scripts/**`、`dev/ci/**` → 全部层。`ci-fast` 每轮都跑它并写 `$GITHUB_OUTPUT`，但**没有任何层据此选择**。

### 5.2 是否用它跳过 census？

| 方案 | 收益 | 风险 |
|---|---|---|
| 不升级（阶段一） | 简单；deferral 已解决主要成本 | 纯文档 PR 仍需一次 L2（18 分钟） |
| 升级为门（阶段二候选） | 纯文档/证据 PR 可免 census | 「跳过」必须仍可被聚合器独立复核，否则破坏 fail-closed |

若升级，最小可信设计：

1. `synthesize` 用合成树计算 `EB3_SCOPE = {selectedLayers, excludedLayers, graphDigest}` 并输出；
2. 聚合器**独立重算**影响图（不信任 caller 的自述），只对「图中确实排除」的层接受 `skipped`，且要求 `graphDigest` 与树内文件一致；
3. 负控：未知路径 → 全量；篡改图 → 拒绝；图与声明不符 → 红；
4. 未命中任何规则的路径永远回退全量。

**建议**：先用阶段一拿到 PR 类型分布（docs/evidence 占比）再决定；占比低则不必做。

---

## 6. 阶段三（独立）：缩短 L2

| 手段 | 做法 | 注意 |
|---|---|---|
| host build cache | key = pin SHA + lockfile hash + Node 版本 + 平台；命中后仍跑 pin 断言与内容校验 | 缓存是性能优化，不是正确性检查；需考虑投毒与输入可信度 |
| pnpm store cache | `actions/cache` 缓存 store；install 仍 `--frozen-lockfile` | 与 host cache 分开度量 |
| census 分片 | 按文件切 N 片，各片自带 2 captures；聚合器取并集 | leg 行必须声明分片数与片内双 capture；「2 captures 相同」变成逐片断言 |
| 更强 runner | 16 vCPU（若可用） | 成本/收益需实测 |
| fail-fast | 层内首个失败 leg 提前终止 | 必须把未跑的 leg 显式报告为 not-run，不能让 token 误报 skip |

---

## 7. 阶段四（独立）：L3 主分支/周期回归

- master push 后跑一次全量 census（不带 Required 语义），结果只告警；
- 定时（如每日）跑 flake 分析与 load family 重采样；
- 目的：接住阶段二若启用「影响面跳过」可能漏掉的回归。

---

## 8. 验收标准

### 8.1 阶段一 PR-A1（内循环）

- `ci-local --fast` 在已知绿树上退出 0；注入一个类型错误 → 非 0 且指出文件；
- 注入一个 docs:sync 违规 → 非 0；
- 实测墙钟记录进 P0 数据表（目标 ≤60s，本机 16 核）。

### 8.2 阶段一 PR-B（结构）

```bash
node scripts/eb3-ci-required.mjs            # 0 findings
node scripts/eb3-ci-negative-controls.mjs   # 全绿（含改名后的 C9/C12/C21/C22）
```

通过条件：`needs` 完整含 `ci-product` 与 `ci-census`；新层过 merge-tree/输出/取消三条规则；`--only` 清单 ∪ `{census}` == `LEG_ORDER`；`census-runtime` 不再在 `knownNonRequired`，且有静态负控证明新必需层不会同时被声明为 informational。

### 8.3 拆分等价性（四类证据）

| 检验对象 | 要求 | 方法 |
|---|---|---|
| 测试配置 | 九根、baseline、2 captures、90s、forbid 集合不变 | 机器 diff，差异仅限层名/路径 |
| 全人口实跑 | 新 `ci-census` 在已知绿树执行全部人口，无缺席/refusal/skip | leg 行比对 |
| 失败注入 | 新 red 与 collection escalation → `ci-required` 变红 | 临时提交 + 一次 hosted run |
| 拓扑负控 | 缺席/跳过/取消/输出缺失 → 聚合均非绿 | 夹具变异 |
| 声明一致 | 新必需层不在 `knownNonRequired`；退休 standalone 不触发 `CI_DECLARED_JOB_ABSENT` | 静态负控 |

### 8.4 L1/L2 纪律验收（阶段一 hosted）

1. 带 `ci-defer-full`：`ci-census` 跳过、其余绿、**聚合红**、墙钟 ≤3 分钟；
2. 去标签：同一 head 重跑、`ci-census` 执行、聚合绿、墙钟 ≤20 分钟；
3. 分支保护仍为 3 个上下文。

---

## 9. `cancel-in-progress`：记录为可复审项

- 现状：Required 工作流一律禁止取消（manifest `cancelInProgress: false`），因为 `cancelled` 既非绿也非红，且旧实现无法区分「被取代」与「被中断」。
- 审查意见：这是保守工程约束，不是正确性必要条件；GitHub 的分支保护只要求**待合并提交**的必需检查完成，取消被取代 SHA 的运行不破坏门禁。
- 本版结论：**不改**。理由：① 现行契约明文禁止，改它属于契约变更，需要独立提案与负控；② 取消若作用于当前 SHA（如标签反复切换）会留下无结论的运行，聚合虽 fail-closed，但诊断成本上升；③ 优先级低于阶段一。
- 若未来复审：需先证明聚合器对 `cancelled` 非绿（已满足：`--grade-needs` 只枚举 success+PASS），再限定并发组为 `ref + sha` 之外的形式，并加一条负控：取消当前 SHA 的运行 → 聚合必须红。

---

## 10. 风险登记

| ID | 风险 | 可能性 | 影响 | 缓解 |
|---|---|---|---|---|
| R1 | L1 的红被误读为「PR 坏了」 | 高 | 中（沟通成本） | `ci-fast` 打印 `EB3-TIER deferred`；PR 模板写明 |
| R2 | Agent 忘记去标签就请求合并 | 中 | 中 | 聚合红 → 无法合并（fail-closed）；CI 汇总行提示「census not run at this head」 |
| R3 | 去标签的 `unlabeled` 事件未触发 | 低 | 高 | 已核实 `ci-required.yml` 类型含 `labeled`/`unlabeled`；负控夹具覆盖 |
| R4 | 退休 `census-runtime` 后 master 无定期全量 | 中 | 中 | 阶段四补 L3；过渡期用 `workflow_dispatch` 手动入口 |
| R5 | 拆层中间态必红 | 高 | 低 | 一次改全（B1–B12 同一 PR） |
| R6 | 新层漏 `cancel-in-progress: false` | 中 | 中 | B3 明示 + `CI_LAYER_CANCELLABLE` |
| R7 | 新层漏 merge-tree 绑定/输入 | 中 | 高 | B3 + grader 逐条 |
| R8 | `LEG_ORDER` 新增 leg 后 product 漏更新 | 中 | 高 | B12 集合断言 |
| R9 | 探针 worktree 缺依赖/host | 高 | 中 | §4.3 显式准备；快速档只在主工作区 |
| R10 | 单报告复评被误读为重放 | 中 | 中 | §4.3 披露 |
| R11 | 缓存投毒/命中错误内容 | 低 | 高 | key 绑 pin+lockfile+平台；命中后仍校验 |
| R12 | 分片破坏「双 capture 相同」语义 | 中 | 中 | 逐片断言 + leg 行声明分片数 |
| R13 | 影响面门禁（若做）漏测 | 中 | 高 | 阶段二最小设计 + L3 兜底 |
| R14 | 把 census 绿当功能验收 | 中 | 高 | §3.4 明写；G2–G5 独立 |

---

## 11. 指标（验收与回归都用它）

1. **TTFF**：push → 第一条可定位红灯的墙钟（L1 应 ≤2 分钟）。
2. **IWC**：一次修改从本地开始验证到拿到可用结论的总时间（衡量 L0）。
3. **L1 P50/P90 墙钟**：带标签的 push。
4. **L2 P50/P90 墙钟**：去标签后的完整运行。
5. **每 PR runner-min 总账**：L1×N + L2×1。
6. **L1 期间聚合红的比例**（确认 deferral 没被滥用：如某 PR 一直带标签不合并，应告警）。

基线：P0 采集最近 5–10 个 PR 的上述指标，作为阶段一前后对照。

---

## 12. 未决问题（供裁决）

1. **是否接受「L1 聚合红」作为中间态的正式语义**（推荐接受：fail-closed 且可解释）。
2. 是否为 L1 增加机器人提示（标签缺失且 push 次数 >1 时提醒）。
3. 阶段二是否要做（取决于 docs/evidence PR 占比）。
4. 退休 `census-runtime` 后，master 的手动全量入口用 `workflow_dispatch` 还是等阶段四。
5. 缓存 key 的精确组成与失效策略。
6. `cancel-in-progress` 是否另立提案复审（建议：阶段三之后）。

---

## 附录 A：复审阅读顺序

1. `.github/workflows/ci-required.yml`（触发类型、needs、deferral、汇总）
2. `.github/workflows/ci-full.yml`（今天最贵的层）
3. `.github/workflows/census-runtime.yml`（第二份普查；`cancel-in-progress: true`；无 merge-tree 绑定）
4. `dev/ci/eb3-ci-manifest.json`（唯一声明）
5. `scripts/eb3-ci-required.mjs`（取消/绑定/输出/skippable）
6. `scripts/ci-pr-gate.mjs`（`LEG_ORDER`、`--only`、census 比较）
7. `dev/ci/eb3-impact-graph.json` + `scripts/eb3-impact.mjs`（已存在的影响面机制）

## 附录 B：证据索引

| 事实 | 出处 |
|---|---|
| 单轮 job 耗时 | run `41214261445`，job `124575440260` |
| census-runtime 耗时 | run `41508157238`；文档 PR 轮 `41515916372` |
| census leg 行 | 上述 run 的 `DSH-CI-LEG leg=census` |
| `labeled/unlabeled` 触发 | `ci-required.yml` 的 `on.pull_request.types` 注释 |
| 影响图现状 | `dev/ci/eb3-impact-graph.json` 头注释 + `ci-fast.yml` 的 impact 步骤 |
| 聚合器拒绝 cancelled | `scripts/eb3-merge-tree.mjs --grade-needs`（只枚举 success+PASS） |
| 基线人口 | `dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-u7-1-old-reds.md` |

## 附录 C：成本公式

```
L1 墙钟   ≈ T_synth + max(T_fast, T_integration, T_security, T_product) + T_aggregate
          ≈ 11 + 85 + 10 ≈ 106s ≈ 1.8 min
L2 墙钟   ≈ T_synth + T_census_layer + T_aggregate ≈ 11 + 1081 + 10 ≈ 18.3 min
每 PR     ≈ N_push × L1 + 1 × L2
```
