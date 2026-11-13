# eng-baseline-20261113 — 工程基线度量（只读）

> **Dated**: 2026-11-13（UTC）
> **性质**: 只读度量证据；不改变任何 gate、workflow、分支保护或权威指针
> **用途**: 为 `docs/plans/memo/engineering-baseline-optimization-20261113/PLAN.md` §1 与 `docs/DEV-PR-WORKFLOW.md` 提供可复现的数字
> **采集者**: 主 Agent；数据源 = GitHub Actions / PR API（`gh`），采集时间 2026-11-13T16:1xZ

---

## 1. 结论（三条）

1. **分层机制本身可用**：L1 实测 1m49s（run `41594329690`），L2 实测 19m34s（run `41594604836`，census 19m06s）——与设计目标（≈2 min / ≈18.5 min）一致。
2. **默认路径绕过了它**：最近 12 个合并 PR **12/12 创建即 ready**，无一次 `ready_for_review` / `convert_to_draft` 事件；`ci-required` 运行次数中位数 **2**（1–3 次），每次都是完整 L2。
3. **单次 L2 变慢且会排队**：census 从 19m06s（11-03）涨到 **24m13s**（11-13，#755）；并发组串行使一次 push 的实际延迟可达 **39 分钟**（#755 最后一轮）；`pr-gate` 出现 **8h31m** 排队（#747）。

---

## 2. 墙钟分布（最近 30 个已合并 PR）

数据：`raw/prs.json`（`gh pr list --state merged -L 30 --json number,createdAt,mergedAt,headRefName`），
派生：`raw/rows.tsv`（`<PR>\t<branch>\t<created→merged 分钟>`）。

| 统计量 | 值 |
|---|---|
| 样本 | 30 |
| 中位数 | **90.5 分钟** |
| P75 | 225 分钟 |
| 最短 | 22 分钟（#742，纯文档，仍跑了 L2） |
| 最长 | 1088 分钟（#727，跨夜） |

> 说明：`created→merged` 含人工/agent 评审等待，不等于纯 CI 时间；但它界定了「一个 PR 的墙钟下限」，
> 而 CI 是其中唯一不可并行压缩的资源。

复现：

```bash
gh pr list --state merged -L 30 --json number,createdAt,mergedAt,headRefName
```

---

## 3. `ci-required` 运行次数（最近 12 个 PR）

数据：`raw/runs.tsv`，格式 `<PR>\t<墙钟分钟>\t<次数>\t<按时间倒序的 conclusion>`。

| PR | 墙钟(min) | ci-required 次数 | conclusions |
|---|---|---|---|
| 755 | 96 | 3 | success, cancelled, failure |
| 754 | 72 | 3 | success, failure, failure |
| 753 | 27 | 1 | success |
| 752 | 24 | 1 | success |
| 751 | 114 | 3 | success, failure, failure |
| 750 | 80 | 3 | success, failure, success |
| 749 | 77 | 2 | success, success |
| 748 | 61 | 2 | success, success |
| 747 | 514 | 1 | success |
| 746 | 27 | 1 | success |
| 745 | 85 | 3 | success, failure, failure |
| 744 | 57 | 2 | success, success |

中位数 = **2 次**。每次都是 L2（census 真跑），因为 PR 创建即 ready。

复现：

```bash
gh run list --branch <headRefName> --limit 30 --json name,conclusion \
  -q '[.[]|select(.name=="ci-required")|.conclusion]|join(",")'
```

---

## 4. Draft 转换事件（最近 12 个 PR）

数据：`raw/draft-events.tsv`，格式 `<PR>\t<ready_for_review + convert_to_draft 事件数>`。

结果：**12/12 均为 0**。即：没有任何一个 PR 经历过「ready 之前先 draft」的路径，
`ci-census` 的 deferral 从未在这些 PR 上生效过。

复现：

```bash
gh api "repos/ArmourPiercer1/dsh-agent-team/issues/<n>/timeline?per_page=100" \
  --jq '[.[]|select(.event=="ready_for_review" or .event=="convert_to_draft")]|length'
```

---

## 5. 单次 run 的时间戳（关键样本）

### L1（draft，2026-11-03）

run `41594329690`：

```
synthesize-merge-tree  07:08:28 .. 07:08:42
ci-fast                07:08:45 .. 07:09:09
ci-integration         07:08:45 .. 07:09:58
ci-security            07:08:45 .. 07:09:28
ci-product             07:08:45 .. 07:10:06
ci-census              skipped
ci-required-deferred   07:10:08 .. 07:10:16   success
ci-required            07:10:08 .. 07:10:17   failure   ← fail-closed，设计如此
```

墙钟：**1 分 49 秒**。

### L2（ready，2026-11-03）

run `41594604836`：

```
synthesize-merge-tree  07:10:57 .. 07:11:10
ci-fast                07:11:13 .. 07:11:39
ci-integration         07:11:13 .. 07:12:04
ci-security            07:11:13 .. 07:12:00
ci-product             07:11:13 .. 07:12:59
ci-census              07:11:14 .. 07:30:20   (19m06s)
ci-required            07:30:23 .. 07:30:31   success
```

墙钟：**19 分 34 秒**。

### 现状（2026-11-13）

- #755 最终 head：`ci-census` job **24m13s**；`ci-required` run 13:46:10→14:25:03 = **39m**（含等待前一轮 L2）。
- #751：三轮 `ci-required` = 24m16s / 21m28s / 24m34s，`created→merged` 114 分钟。
- #747：`pr-gate` 22:47:49→07:19:13 = **8h31m**（排队），同期 `ci-required` 仅 20m36s。

复现：

```bash
gh api repos/ArmourPiercer1/dsh-agent-team/actions/runs/<run_id>/jobs \
  --jq '.jobs[] | "\(.name) \(.started_at)..\(.completed_at)"'
```

---

## 6. 静态事实（本仓配置）

| 事实 | 证据 |
|---|---|
| 所有 workflow 无 `actions/cache` | `grep -rn "actions/cache" .github/workflows/` 返回空 |
| 影响面图只打印、不被任何层消费 | `.github/workflows/ci-fast.yml` 只调用 `eb3-impact.mjs --github-output`，无 `steps.*.outputs` 消费方 |
| `ci-census` 由「非 draft 且无 `ci-defer-full`」触发 | `.github/workflows/ci-required.yml` deferral 条件 |
| 并发组 `cancel-in-progress: false` | `.github/workflows/ci-required.yml` |

---

## 7. 局限（必须披露）

- 墙钟含评审/人工等待，**不是纯 CI 时间**；本文只把它作为「PR 下限」使用。
- 未采集 runner 排队时间（GitHub 不直接给出）；用 run `created_at → job started_at` 差值近似，仅对 #755/#747 做了单点观察。
- 未统计 runner-min 成本（需要 Actions 账单 API 或逐 job 求和），本证据只回答「墙钟为什么是小时级」。
- 12 个 PR 的 sample 是最近连续样本，不是随机抽样。

---

## 8. 文件清单

| 文件 | 内容 |
|---|---|
| `raw/prs.json` | 最近 30 个已合并 PR 的 number/createdAt/mergedAt/headRefName |
| `raw/rows.tsv` | 派生的 `<PR>\t<branch>\t<分钟>` |
| `raw/runs.tsv` | 12 个 PR 的 ci-required 次数与 conclusion |
| `raw/draft-events.tsv` | 12 个 PR 的 draft 转换事件数 |

---

## 9. 现场负控：`pr-ready-check` 对 #759 的判定（2026-11-13T16:3xZ）

`scripts/pr-ready-check.mjs`（本程序 A2 的机器半边）对当时的 #759 实跑：

```
pr-ready-check: PR #759 head=dd41a09283fcc72b298c3ddd9b48ab12829629a0 state=blocked draft=true
  layers: fast=success integration=success security=success product=success
  deferred=success census=skipped settlement=missing
  refuse reasons: MARKER_PRESENT_TITLE, SETTLEMENT_MISSING, WORKTREE_DIRTY
DSH-PR-READY verdict=REFUSED pr=759 reasons=MARKER_PRESENT_TITLE,SETTLEMENT_MISSING,WORKTREE_DIRTY
```

这同时是两条证据：

1. **正向**：L1 的形态与设计一致（四层绿、`deferred=success`、`census=skipped`），说明分层在工作；
2. **负向**：检查器拒绝了一个「还在评审、没写 settlement、标题带 marker」的 draft——它不会把
   「L1 绿」误判成「可以 ready」。只有在 C1–C7 全部满足后才会输出 `READY`。

披露：首次实跑时 GitHub API 返回一次裸 `EOF`，脚本以 exit 2（`ERROR FETCH_FAILED`）失败——
**不是通过**。已加一次重试（750ms），重试后仍失败则保持 exit 2。该行为未改变判定代数。

### 现场判定的复现

```bash
node scripts/pr-ready-check.mjs --pr 759          # 对任何 draft PR
node scripts/pr-ready-check.mjs --self-test       # 无网络，6 个内建用例
node --test scripts/pr-ready-check.test.mjs       # 13 个单元测试
```
