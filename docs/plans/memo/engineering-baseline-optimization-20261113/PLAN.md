# 工程基线优化 — 程序、边界与待裁决项

> **Dated**: 2026-11-13（UTC）· **状态**: owner 已授权 agent 自行推进（2026-11-13 会话指令）；**只开 draft PR，不合并**；B 桶在 owner 裁决前不落地
> **性质**: 设计/选型 memo（`docs/plans/memo/`），不是当期执行计划，不改变机器权威指针，不改变任何 gate
> **范围**: 开发工作流（Draft-first）、CI 成本度量、冻结元数据、证据体积；不涉及产品语义、upstream、`graph.yaml`、Authority 快照、候选冻结
> **一句话**: 先把「每个 PR 为什么按小时算」变成可复现的数字，再把不碰 gate 的改进（流程、度量、元数据、体积）做成可审查的 draft PR；碰 gate 的四项只写成提案，等 owner 裁决。

---

## 0. 授权与边界

### 0.1 授权来源

- 2026-11-13 owner 指令：**「自行推进优化，但暂不合并 PR，待我回来之后审查后再合并」**。
- 由此获得的权限：创建任务分支、推送、开 **draft** PR；在 A 桶范围内提交代码与文档。
- 未获得的权限：合并任何 PR；放宽或绕过任何 Required 检查；修改 `.github/workflows/`、`dev/ci/`、`scripts/eb3-*`、分支保护；移动 `current-authority.json`；冻结/解冻候选；删除既有证据。

### 0.2 硬边界（本程序全程遵守）

| 禁止 | 原因 |
|---|---|
| 合并 PR / admin merge / 改分支保护 | owner 保留合并权 |
| 改 `.github/workflows/`、`dev/ci/`、`scripts/eb3-*` | 属 gate 面，需 owner 裁决 |
| 移动 Authority 指针、改 `current-authority.json` | 冻结契约，改动需重新发布快照 |
| 冻结新候选 / 改已有候选 manifest 的语义字段 | 候选不可变；语义变更 = 新候选 |
| 删除或压缩已入库证据 | 证据只追加；体积问题用预算与归档解决，不靠删 |
| 在未 review 的情况下把 draft 转 ready | 转 ready 即触发 24 分钟 L2，且等于替 owner 做合并前判定 |

### 0.3 每个 PR 的交付形态

- 分支 `task/<topic>-<date>`，worktree `.worktrees/<topic>`，一个 PR 一个主题。
- 标题前缀 `[BASELINE]`，正文首行 `DO-NOT-MERGE — awaiting owner review`。
- 以 **draft** 创建；L1 绿即停；不转 ready。owner 回来后逐项审查，再决定是否转 ready 跑 L2 合并。
- 每个 PR 附：变更理由、证据路径、回滚方式、对 gate 的影响（预期为「无」）。

---

## 1. 基线事实（2026-11-13 实测）

证据：`dev/agent-workflow/evidence/eng-baseline-20261113/`（原始 JSON/TSV 在 `raw/`）。

| 事实 | 数字 | 来源 |
|---|---|---|
| L1（草稿轮）实测 | **1 分 49 秒** | run `41594329690`（2026-11-03） |
| L2（ready 轮）实测 | **19 分 34 秒**（census 19 分 06 秒） | run `41594604836`（2026-11-03） |
| census 现状 | **24 分 13 秒**（job），用例 702 文件 / 9167 条 | #755 最终 run（2026-11-13） |
| 最近 30 个合并 PR 的 `created→merged` | 中位数 **90.5 分钟**；P75 225；最短 22；最长 1088 | `raw/prs.json` |
| 12 个最近 PR 的 `ci-required` 运行次数 | 中位数 **2 次**（1–3 次） | `raw/runs.tsv` |
| 12 个最近 PR 中创建即 ready 的比例 | **12/12**（无一次 `ready_for_review`/`convert_to_draft` 事件） | `raw/draft-events.tsv` |
| `pr-gate` 排队极端值 | 8 小时 31 分（#747） | #747 run 时间戳 |
| 单次 push 的 L2 实际延迟（含并发等待） | 最长 39 分钟（#755 最后一轮 13:46→14:25） | #755 run 列表 |
| 缓存 | 所有 workflow **无** `actions/cache` | `.github/workflows/*.yml` |
| 影响面选层 | `eb3-impact.mjs` 只打印，无层消费 | `ci-fast.yml` |
| 冻结候选churn | 5 个候选 / 68 小时（11-10→11-13） | 候选 manifest 时间戳 |

**结论**：分层机制本身可用（L1 1m49s / L2 19m34s），但默认路径 100% 走 ready，且单次 L2 比设计慢 30%。每 PR 的 CI 时间 ≈（1–3）×24 分钟 + `pr-gate` + 队列。机制不是没生效，是被默认路径绕过。

---

## 2. 目标与指标（owner 回来后按此验收）

| ID | 指标 | 现状 | 目标 | 由谁改 |
|---|---|---|---|---|
| M1 | L1 墙钟 P50（draft push → 结论） | 1m49s–2m30s | ≤ 3 分钟 | 已达标，保持 |
| M2 | 每 PR `ci-required` 运行次数 P50 | 2 | **1** | A2（流程）+ B4 |
| M3 | PR `created→merged` P50 | 90.5 分钟 | ≤ 40 分钟 | A2 + B1/B3 |
| M4 | `pr-gate` 排队 P90 | 未测（极端 8.5h） | ≤ 5 分钟 | B3 |
| M5 | 每 PR 新增证据体积 | 未设限（窗口内 544k 行） | ≤ 2 MB / PR | A4 |
| M6 | 冻结 → C2 完成 | 5 候选 / 68 小时 | ≤ 1 个工作日 | A3 |
| M7 | 候选元数据陈旧项 | 4/5 个 manifest 的 `record_root` 曾指向不存在路径 | 0 | A3 |

**指标只统计机器可查的事实**（run id、时间戳、字节数），不使用「感觉快了」。

---

## 3. 工作分桶

### 3.1 A 桶 — agent 可自行推进（draft PR，待审）

| ID | 内容 | 产出 | 风险 | 状态 |
|---|---|---|---|---|
| **A1** | 基线度量：把上面的事实固化为可重跑的证据 + 后续 `scripts/pr-ci-metrics.mjs` | 本目录 + `raw/` | 无（只读） | 本 PR 完成证据；脚本下一 PR |
| **A2** | Draft-first 操作页：把 §0.1 的流程写成可执行页面（创建 draft、转 ready 条件、ready 后返工、判读表） | `docs/DEV-PR-WORKFLOW.md` | 无（文档） | 本 PR |
| **A3** | 冻结元数据机器状态：`candidate-state.json`（`IDENTITY_LOCKED` / `C2_PENDING` / `C2_PASS` / `REFUSED` / `SUPERSEDED`）+ 生成器由参数推导 `supersedes`/`status`，verifier 交叉校验 | 提案 + schema + 生成器改动 + 测试 | 中：触碰冻结工具，但不改已有 manifest | 待做（独立 PR） |
| **A4** | 证据体积预算：`eb3-evidence-guard` 增加 per-PR 预算与归档路径（不删旧证据） | 提案 + 只读度量脚本 | 中：可能红现有 PR | 待做（独立 PR） |
| **A5** | 文档 claim 登记：把「PASS/已验证」类句子绑定 run id / 证据路径，堵住 `doc-checks` 被当 gate 的空洞（审计 D 已发现一例空转 PASS） | 提案 + 检查脚本 | 中：会红历史文档 | 待做（独立 PR） |
| **A6** | L0 覆盖率统计：只测量 `ci-local` 的 `coverage=undetermined` 比例与耗时，不改选测规则 | 度量脚本 + 报告 | 无 | 待做 |

### 3.2 B 桶 — 需 owner 裁决，本程序只写提案

| ID | 内容 | 预期收益 | 风险 | 需要的裁决 |
|---|---|---|---|---|
| **B1** | census 缓存：provisioned host + pnpm store，key 绑 host pin + lockfile + 平台 | 每次 L2 省 4–6 分钟（host 245s + install） | 缓存投毒/命中错误内容 | 允许改 workflow 与缓存策略 |
| **B2** | census 分片 / 只跑受影响 root | L2 从 24 分钟降到 8–12 分钟 | 漏测（影响面图误判） | 接受「非全量 census」作为合并门 |
| **B3** | `pr-gate` 去重或退役：8 legs 已在 `ci-product` 跑过，`pr-gate` 只留 settlement | 每 PR 省 2 分钟 + 消除 8.5h 排队风险 | 三个 Required 上下文变化 | 允许改分支保护/required contexts |
| **B4** | 默认反转：census 只在显式 label（如 `full-ci`）时跑，而不是「非 draft」 | 任何 fix push 不再自动付 24 分钟 | 忘记加 label → 合并门少一层 | 接受「默认快、显式慢」 |
| **B5** | L3：master push 后周期全量 census | 合并后仍有回归网 | 成本从 PR 转到 master | 接受 master 侧成本 |
| **B6** | 分支保护调整（strict 的 update-branch 语义、required 集合） | 减少无谓重跑 | 直接影响合并安全 | owner 直接裁决 |

**B 桶在本程序中的交付物 = 一节设计 + 影响面 + 回滚，不写代码。**

---

## 4. 交付节奏

1. 每个 A 项：分支 → 实现 → 本地 L0（`pnpm ci:local`，允许 exit 2）→ 证据 → commit → push → **draft** PR。
2. PR 之间不互相阻塞；A3/A4/A5 各自独立，便于 owner 逐项接受或拒绝。
3. owner 回来后：逐项 review → 接受者转 ready（每 PR 一次 L2）→ 合并；拒绝者关 PR，分支保留。
4. 若 owner 在 review 中要求改：按 `docs/DEV-PR-WORKFLOW.md` §6 转回 draft，改完重新走 L1，**不重跑 L2 直到最终 head**。

---

## 5. 不做清单（本程序明确不做）

- 不合并、不转 ready、不请求 owner 以外的人合并。
- 不为了让 CI 变绿而删测试、放宽断言、加 `--no-tests`、跳过 census。
- 不改产品代码语义、不改 `packages/**`（本程序只碰 docs/scripts/evidence）。
- 不清理 `.worktrees`（208 个）与 `packages/**/dist`（2,085 个已提交文件）——这两项作为 B 桶提案另议。
- 不在 master 上直接提交。

---

## 6. 需要 owner 裁决的三个决定（可后置，不阻塞 A 桶）

1. **B4 默认反转**：是否接受「census 由显式 label 触发」，把快路径变成默认？这是单点收益最大的一项（每 PR 省 24–48 分钟）。
2. **B2 非全量 census**：合并门是否接受「受影响 root 的 census + master 后全量」？这决定 L2 能否从 24 分钟降到 10 分钟以内。
3. **证据体积上限**：M5 的 2 MB/PR 是否合适？现窗口内 54 个 PR 有 544k 行证据，若不设限，仓库与 CI 会被证据拖慢。

以上三项不改变 A 桶的推进；owner 回来后一句话即可裁决。
