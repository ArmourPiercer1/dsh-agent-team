# DEV-PR-WORKFLOW — Draft-first 开发工作流（操作页）

> **Dated**: 2026-11-13（UTC）· **状态**: owner 2026-11-13 指令「调整开发工作流」的操作化页面；**提案，待 owner 审查后生效**
> **上位规则**: `docs/ROUTER_RULES.md` §8.5.10（三层语义 / 修复循环留在草稿态 / 状态切换纪律）与本页一致；冲突时以 ROUTER_RULES 为准
> **依据**: `docs/plans/memo/engineering-baseline-optimization-20261113/PLAN.md` §1 实测——L1 1m49s，L2 19m34s（现 24m13s），最近 12 个 PR 中 12 个创建即 ready、`ci-required` 中位数 2 次
> **性质**: 操作页，不是新 gate；不改变任何 workflow、分支保护或 Required 上下文

---

## 0. 一句话

所有 PR **以 draft 创建**；draft 期间每次 push 只付 L1（约 2 分钟）；只有「head 冻结 + 评审 PASS + settlement 覆盖当前 head」才转 ready，让 L2（census，约 24 分钟）**只跑一次**；ready 之后要改，先转回 draft。

---

## 1. 状态机

```
DRAFT --(C1–C7 全部满足)--> READY --(L2 绿 + 三上下文同一 head)--> MERGED
  ^                             |
  +------(需要任何改动)----------+
```

- **DRAFT**：`ci-census=skipped`，`ci-required=failure`（fail-closed，设计如此），`ci-required-deferred=success` 才是 L1 判据。
- **READY**：census 真跑；每一轮 ready 都是 ~24 分钟。
- 状态切换一次只做一个，等本轮 run 落定再做下一个。GitHub 同一并发组只保留 1 running + 1 pending，新的 pending 会顶替旧的。

---

## 2. 开 PR（第一次 push 之前）

### 2.1 本地闸

```bash
pnpm ci:local --base origin/master
```

- exit `0`：选中检查全过，可推。
- exit `2`：测试爆炸半径未定（根级共享文件/未知路径）。**可以推**，但必须在 PR body 的「Known coverage gaps」写明；禁止用 `--no-tests` 把它变成 0。
- exit `1`：修，不要推。

### 2.2 建 draft

```bash
gh pr create --draft --base master \
  --title "DO-NOT-MERGE [<lane>] <what changed>" \
  --body-file <pr-body.md>
```

- **必须 `--draft`**；禁止先开 ready 再转 draft。
- 评审期标题带 `DO-NOT-MERGE` 前缀：`pr-settlement-gate` 会据此给出 `BLOCKED-BY-MARKER`——那是「正在评审」的机器陈述，不是故障。**转 ready 前必须删掉这个前缀**，否则 settlement 永远无法通过（§4.3）。
- PR body 必填：变更摘要 / 证据路径 / L0 结果（含 exit code）/ 已知未覆盖面 / 回滚方式 / 对 gate 的影响（预期「无」）。

---

## 3. DRAFT 期间（L1）

每次 push 后只等 L1，不要等 census：

| 检查 | 期望 | 说明 |
|---|---|---|
| `ci-census` | **skipped** | draft 的 deferral 条件 |
| `ci-required` | **failure** | fail-closed，L1 的定义 |
| `ci-required-deferred` | **success** | L1 的真正判据 |
| `ci-fast` / `ci-integration` / `ci-security` / `ci-product` | **success** | 真红必须修 |
| `pr-gate` | 红（缺 settlement / 带 marker） | 评审期预期 |
| `candidate-protection` | success | 路径触发 |

命令：

```bash
gh pr checks <n>                      # 逐项状态与耗时
gh pr view <n> --json isDraft,mergeStateStatus,headRefOid
```

**禁止**因为 `ci-required` 红就转 ready。「把它弄绿」不是诊断手段。

---

## 4. 转 READY 的条件（C1–C7 全满足，缺一不可）

### C1 变更完成
没有未推送提交，没有「等 CI 绿再补」的 TODO；PR body 与实现一致。

### C2 与 master 同步
```bash
git merge-base --is-ancestor origin/master HEAD   # 必须为真
```
若 BEHIND（strict 保护要求），在 **draft 态**执行：
```bash
gh api -X PUT repos/{owner}/{repo}/pulls/<n>/update-branch \
  -f expected_head_sha=<40-hex>
```
等这次 run 落定；update 会移动 head，任何旧 settlement 立即失效。

### C3 L1 绿
当前 head 上 `ci-fast` / `ci-integration` / `ci-security` / `ci-product` 全 success，`ci-required-deferred` success。

### C4 评审完成
独立 reviewer 给出 PASS；所有 findings 逐条关闭并附证据（不是「下个 PR 修」）。review 子代理不得是实现者。

### C5 文档/证据
受影响的 register / matrix / ledger / release notes 已更新；`docs-probe` + `docs:sync --check` 绿（`ci-fast` 已覆盖）。

### C6 settlement 已写，且覆盖当前 head
- **先删标题里的 `DO-NOT-MERGE` 前缀**（否则 settlement gate 永远 marker-red）。
- 评论首行必须是闭集措辞，例如：
  ```
  **[dated settlement, 2026-11-13T16:20Z — <一句话结论>]**
  ```
- 正文必须包含**当前 head 的 40-hex**、证据路径、跑过的 run id、未覆盖面。
- 评论本身不触发 workflow；**必须在 ready 之前写**，ready 触发的 run 会在同一 head 上读到它。
- 任何 push 都会移动 head → 旧 settlement 自动失效 → 重写。

### C7 head 冻结
从这一刻起不再 push。

然后：

```bash
gh pr ready <n>
```

让 L2 在**同一个 head** 上跑，且只跑一次。

---

## 5. READY 之后

```bash
gh pr checks <n>
gh pr view <n> --json mergeStateStatus,headRefOid
gh pr merge <n> --squash --match-head-commit <40-hex>
```

合并前同时满足：

- `mergeStateStatus = CLEAN`（非 BEHIND、非 DIRTY）；
- `pr-gate` / `ci-required` / `pr-settlement-gate` 三个 Required 上下文对**同一 head** 均为 success；
- settlement 评论覆盖的 40-hex == 当前 head；
- L2 的 census verdict = PASS，且没有 collection escalation。

禁止：L2 运行期间 push；admin merge；`--no-tests`；放宽断言；为了让聚合变绿而删检查。

---

## 6. READY 之后发现要改

1. 立即转回 draft：`gh pr ready --undo <n>`（不要用 `ci-defer-full` 代替）。
2. 改 → push → 等 L1。
3. 重新写 settlement（head 已变，旧的失效）。
4. 再 `gh pr ready <n>`，只跑一次新的 L2。

**不要**在 ready 态连续 push：每次都是一次完整 L2，而且会与上一轮抢并发组，实际延迟是「旧 L2 剩余 + 新 L2」。

---

## 7. 判读表

| 现象 | 含义 | 动作 |
|---|---|---|
| draft 下 `ci-required=failure`、`deferred=success` | 正常 L1 | 继续迭代 |
| `ci-census=skipped` 且聚合红 | 正常 L1 | 不要转 ready |
| `ci-fast/integration/security/product` 红 | L1 真红 | 修；看 job 日志 |
| `pr-gate` 红，原因是缺 settlement | 评审期预期 | 准备 C6 |
| `pr-gate` 红，`BLOCKED-BY-MARKER` | 标题还有 `DO-NOT-MERGE` | 删前缀后重评 |
| `pr-gate` 红，settlement 已覆盖 head | 时点/竞态 | rerun `pr-gate`，不要重写注释 |
| ready 后 census 红 | 回归 | 转 draft → 修 → L1 → 新 settlement → ready |
| 新 push 后旧 run `cancelled` | 并发顶替 | 只认最终 head 的新 run |
| `mergeStateStatus=BEHIND` | strict 保护 | draft 态 update-branch，重写 settlement |
| `pr-gate` 排队数小时 | runner 饥饿（#747 实测 8h31m） | 上报，不要连续 push 加重排队 |

---

## 8. 时间纪律与上报

- 单 PR 墙钟 > 2 小时，或同一 head census 连续 2 次红，或同一 PR L2 连续 3 次红：停止盲试，按 `ROUTER_RULES` §5 上报（失败原因、已排除假设、下一条需要的新事实）。
- 不要用「再开一个 ready PR」绕过等待；不要用连续 push「撞绿」。
- 报告里写清：head sha、L2 次数、每次 census 墙钟与结论、最终合并 run id。

---

## 9. 反模式（每条都对应一次实测浪费）

| 反模式 | 代价 |
|---|---|
| `gh pr create` 不带 `--draft`（「反正最后都要跑」） | 首次即 L2，+24 分钟 |
| 「L1 红了，先 ready 看看」 | 立刻 +24 分钟，且掩盖真红 |
| ready 后 push 一个 typo | 再 +24 分钟，旧 settlement 作废 |
| 先 ready 再补 settlement | `pr-gate` 红 → 必须 rerun，+2 分钟起 |
| 连续 push 三次不等待 | 中间的 pending 被顶替，结论丢失 |
| 最终 head 上加 `ci-defer-full` 忘了去掉 | census 没跑，不能合并 |
| 用 `--admin` 或放宽断言换绿 | 违反红线；合并后回归由 master 承担 |

---

## 10. 合并前自检

- [ ] PR 从创建起就是 draft，从未 ready 后 push
- [ ] 当前 head 与 master 同步（非 BEHIND）
- [ ] L1 四层绿，`ci-required-deferred` 绿
- [ ] 独立评审 PASS，findings 全关闭
- [ ] 文档/证据已更新
- [ ] 标题无 `DO-NOT-MERGE` 前缀
- [ ] settlement 覆盖当前 40-hex，且在 ready 之前写入
- [ ] ready 之后没有新 commit
- [ ] 三个 Required 上下文对同一 head 绿
- [ ] `gh pr merge --squash --match-head-commit <同一 40-hex>`

---

## 11. 这套流程自己的指标

| 指标 | 目标 | 采集 |
|---|---|---|
| L1 墙钟 P50 | ≤ 3 分钟 | `gh pr checks` / run 时间戳 |
| 每 PR `ci-required` 次数 P50 | 1 | `gh run list --branch` |
| PR `created→merged` P50 | ≤ 40 分钟 | `gh pr list --json` |
| ready 后 push 次数 | 0 | 同上 |

度量脚本见后续 PR（`[BASELINE] pr-ci-metrics`）；本页数字基线见 `dev/agent-workflow/evidence/eng-baseline-20261113/`。
