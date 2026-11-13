# CI 瓶颈：B 桶提案（等待 owner 裁决）

> **Dated**: 2026-11-13（UTC）· **状态**: 提案，未实施
> **性质**: 设计 memo（`docs/plans/memo/`）；**不改任何 workflow / gate / 分支保护**
> **证据**: `dev/agent-workflow/evidence/eng-b-proposals-20261113/`
> **前置读数**: 本 memo 的每个数字都来自 2026-11-13 16:55–17:00（UTC）的 15 个 `pr-gate` run 与
> 14 个 `ci-required` run；census 时长与 #759 的度量一致（23m11s–24m13s）。

---

## 0. 一句话

**census 就是 L2 的全部。** 同一天、同一仓库：

| run 形态 | 中位 wall | 最大 |
|---|---|---|
| ready（census 跑了） | **23m55s** | 24m53s |
| draft（census 跳过） | **2m18s** | 3m04s |

差 **10.4 倍**。所有 B 桶提案本质上都在回答同一个问题：**为什么每次 ready 都要付这 24 分钟，
以及谁有权决定不付。** 这需要 owner 裁决，因为涉及合并门语义。

## 1. 实测（本窗口）

**作业时长（中位，秒）**

| 作业 | 中位 | 最大 |
|---|---|---|
| `ci-census / census-runtime` | **1391（23m11s）** | 1453（24m13s） |
| `ci-product` | 111 | 142 |
| `pr-gate` | 110 | 141 |
| `ci-integration` | 78 | 95 |
| `ci-security` | 58 | 68 |
| `ci-fast` | 27 | 44 |

**排队（job 级 `started_at - created_at`）**

| 工作流 | P50 | P90 | 最大 |
|---|---|---|---|
| `ci-required` | 2.0s | 3.0s | 34s（`synthesize-merge-tree`） |
| `pr-gate` | 3.0s | 3.0s | 3s |

**重要更正**：#747 的 `pr-gate` 排队 8h31m 是**历史异常**（runner 短缺或事件风暴），在本窗口不可复现。
因此「`pr-gate` 去重」缺乏当前证据，不应作为优先项；真正可测的浪费是**每次 fix push 重付一整轮 L2**
（#759 实测每 PR `ci-required` 中位 2 次）。

## 2. 提案（按「收益 / 风险 / 前置」排序）

### B4 默认反转：census 只在显式请求时跑【收益最大】

- **做什么**：ready 只要求 L1 四层 + `pr-gate` + settlement；census 由 label（如 `full-ci`）或
  merge-queue 触发，而不是「非 draft 就自动跑」。
- **收益**：ready 轮 wall 24 分钟 → **约 2.3 分钟**（draft 形态实测中位 138s）。
- **风险**：合并门前不再有全量套件。census 目前覆盖 702 测试 / 9167 用例，是唯一能发现
  「跨包回归」的层；把它移出合并门等于把回归窗口交给 master。
- **前置**：分支保护（`ci-required` 的组成）、`pr-gate` 期望的 required contexts、以及
  「谁可以在 PR 上请求 full-ci」的规则。**全部属于 owner 裁决面，本 memo 不动。**
- **建议**：如果采纳，先以「label 触发 + 合并后自动跑 master 全量」过渡两周，用 master 红灯率验证。

### B5 L3：把 census 变成合并后的慢层

- **做什么**：ready 不跑 census；合并到 master 后由 `push` 触发 census（或 nightly）。
- **收益**：与 B4 相同的 10 倍；且**保留**全量验证，只是把「阻塞合并」变成「发现即回滚/修复」。
- **风险**：坏 commit 会先进入 master。缓解：master census 红灯即冻结合并（需要 owner 定义
  「master 红灯」的自动动作）；以及必须有可靠的 revert 路径。
- **前置**：一个新的 L3 工作流 + master 红灯策略。工作量大于 B4，但语义更诚实。
- **备注**：现仓库**没有 L3**；`ci-census` 只在 PR 上跑，master 合并后没有等价全量。

### B2 census 分片（如果 census 必须留在合并门）

- **做什么**：按测试文件把 census 切成 3–4 个 job 并行。
- **收益**：若线性，23 分钟 → 6–8 分钟；runner 分钟数基本不变（总工作量不变，墙钟下降）。
- **风险**：分片不均导致长尾；共享 setup（install/build）重复 3–4 次；分片规则本身要维护。
- **前置**：先做 **B1 的 profiling**——不知道 23 分钟里 setup、build、测试各占多少，分片可能切错。
- **本窗口数据不足以给出收益上界**：census job 内部无 step 级计时暴露。

### B1 census 缓存：先 profile，再谈缓存

- **现状**：`actions/cache` 在 census 里没有使用（#759 已记录）。但「缓存能省多少」取决于
  install/build 在 23 分钟里的占比，而这个占比**当前不可见**。
- **建议顺序**：先给 census 加 step 级计时（或 artifact 里记录阶段耗时），再决定缓存
  `node_modules` / pnpm store / 构建产物。直接上缓存有脏缓存导致假绿的风险。
- **前置**：改 workflow（owner 面）。

### B3 去重 / 取消过期 run

- **现状**：`cancel-in-progress: false` 导致 fix push 要等前一整轮（#755 实测 39 分钟）。
- **可测的浪费**：每 PR `ci-required` 中位 2 次；第二次通常只改一行。
- **建议**：draft 阶段的 run 允许 `cancel-in-progress: true`；ready 阶段保持串行（避免合并门抖动）。
  这只改 draft 行为，风险低于 B4。
- **前置**：workflow 的 `concurrency` 配置（owner 面）。
- **注意**：`pr-gate` 本身的排队在本窗口只有 3 秒，所以「pr-gate 去重」不是优先项；要动的是
  `ci-required` 的并发策略。

### B6 分支保护（所有 B 项的公共前置）

- **现状**：`pr-gate` / `ci-required` / `pr-settlement-gate` 是 required contexts；strict 模式要求
  head 与 master 同步，`update-branch` 会移动 head 并使 settlement 失效。
- **影响**：任何改变「哪些 check 是 required」的方案（B4/B5）都必须同步改分支保护，否则 PR 会
  卡在一个永远不跑的 check 上。
- **本 memo 不动它**；如果 owner 采纳 B4/B5，这一步是第一个动作，不是最后一个。

## 3. 推荐顺序（供裁决）

1. **B6 + B4**：默认反转 + 保护同步。收益 10 倍，风险集中在「合并门少一层」，需要 owner 明确接受。
2. **B5**：如果不接受 B4 的风险，用「合并后 census」替代，语义更诚实，工作量更大。
3. **B1 profiling**：无论选 B4 还是 B2，先让 23 分钟可拆解；这是唯一低风险、纯增量的动作。
4. **B2 分片**：只在 census 必须留在合并门时做。
5. **B3 draft 并发取消**：独立小改动，可与上面并行。

## 4. 本 memo 不做什么

- 不改 `.github/workflows/`、`dev/ci/`、分支保护、required contexts；
- 不删除任何 check、不弱化任何现有门；
- 不把「省时间」当作「可以少验证」——B4/B5 的代价都写在风险里，由 owner 权衡。
