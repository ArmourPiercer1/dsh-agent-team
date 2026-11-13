# 冻结候选的机器状态（提案 + 只读工具）

> **Dated**: 2026-11-13（UTC）· **状态**: 提案；工具已可运行，**未改任何冻结语义**
> **性质**: 设计 memo（`docs/plans/memo/`），不是当期执行计划，不改变权威指针、候选 manifest 或 ref
> **范围**: `dev/engineering/candidates/*.json` 的可读状态推导；不涉及 C2 流程本身、不涉及 release 裁决
> **授权**: owner 2026-11-13「自行推进优化、不合并 PR」；本项属 A 桶，只读

---

## 0. 问题

`status: "FROZEN"` 只表示**身份锁定**（commit + ref + trees + content_digest）。它不表示验收通过。
但仓库里没有任何命令把「身份」与「验收」放在一起读，于是 2026-11-12/13 的追问——「冻结版上又发现 bug，
那冻结到底冻结了什么？」——只能靠人翻 manifest、翻 evidence 目录、翻 C2 记录来回答。

本轮实测（`dev/agent-workflow/evidence/eng-candidate-status-20261113/status.txt`）：

| 候选 | 身份 | 验收（实际记录） | 元数据缺陷 |
|---|---|---|---|
| `cand-a5sf-fs-search-1` | FROZEN | `RECORDED_RUN_PASS`（引用 run，无 C2 记录） | 无 |
| `cand-v0.1.6-1` | FROZEN | `C2_NOT_RUN`（记录目录尚未创建，AWAITING_C2） | 无（待 C2） |
| `cand-v0.1.6-2` | FROZEN | `C2_NOT_RUN` | `record_root` 仍指向 `-1`（陈旧路径） |
| `cand-v0.1.6-3` | FROZEN | `C2_A_AND_B`（C2-A/B 都在，eligible 均为 false） | `record_root` 仍指向 `-1`（陈旧路径） |
| `cand-v0.1.6-4` | FROZEN | `C2_A_AND_B`（同上） | `record_root` 仍指向 `-1`（陈旧路径） |
| `cand-v0.1.6-5` | FROZEN | `C2_NOT_RUN`（记录目录尚未创建） | 无（待 C2） |

- **0 个候选达到 `CANDIDATE_ELIGIBLE`**：C2-A / C2-B 的 `candidateClaimEligibility.eligible` 全部是 false。
- `-2/-3/-4` 的 `record_root` 是 `candidate-v0.1.6-1`——正是两位独立 C2 裁决者据此判 FAIL 的文字缺陷。
  工具在报告缺陷的同时，会从**按 id 推导出的目录**读取真实记录，所以 `-3/-4` 显示 `C2_A_AND_B` 而不是
  「没有验收」——「元数据指错」与「验收不存在」是两件事。
- `-2..-5` 的 `immutability.supersedes` 全为 `null`：**版本链只存在于 C2 记录的自由文本里**，没有机器可读的
  前后关系。这就是「第五个冻结版本」无法从 manifest 直接看出来龙去脉的原因。

---

## 1. 工具（已实现，只读）

`scripts/candidate-status.mjs`：

```
node scripts/candidate-status.mjs            # 人读表 + 缺陷明细
node scripts/candidate-status.mjs --json     # 机器读
node scripts/candidate-status.mjs --self-test
```

判决代数（`report()` 是纯函数，13 个 node:test 覆盖）：

| 维度 | 取值 |
|---|---|
| identity | `FROZEN`（status + content_digest） / `NOT_FROZEN` |
| acceptance | `C2_NOT_RUN` / `C2_A_ONLY` / `C2_A_AND_B` / `CANDIDATE_ELIGIBLE` / `RECORDED_RUN_PASS` |
| lineage | 上一个冻结候选；git 判定 `AFTER` / `BEFORE` / `SEPARATE_LINE` |
| defects | `RECORD_ROOT_STALE_PATH`、`RECORD_FOREIGN`、`LINEAGE_UNRECORDED`、`ANCESTRY_CHAIN_BROKEN`、`ANCESTRY_MANIFEST_DISAGREES`、`REF_MISSING`、`RECORD_ROOT_MISSING` |
| notes | `RECORD_ROOT_NOT_YET_CREATED`（AWAITING_C2 的正常待办）、`EVIDENCE_AT_DERIVED_ROOT`、`LINEAGE_FAMILY_CHANGE`、`SEPARATE_LINE` |

设计约束：

- **不写任何文件**：不修 manifest、不建 `candidate-state.json`、不动 ref。
- **单一法则**：`record_root` 的 `cand-` → `candidate-` 映射直接 import `freeze-candidate.mjs` 的
  `recordRootFor`，不复制第二份规则。
- **退出码**：0 无缺陷；1 有缺陷（缺陷本身就是输出）；2 读不到目录。

---

## 2. 提案（需要 owner 裁决，本 PR 未实施）

### P1 `immutability.supersedes` 必须由生成器写入

现状 `scripts/freeze-candidate.mjs:329` 硬编码 `supersedes: null`；而 C2 记录里用自由文本写
「supersedes cand-v0.1.6-3 (17a24e2c…)」。建议：生成器增加 `--supersedes <candidate_id>`，
当同族（`cand-v0.1.6-*`）已有候选而参数缺失时**拒绝冻结**（不是警告）。这使版本链可机器核对，
也让「同一个冻结版本又出 bug」时的前驱可以一眼定位。

### P2 冻结自检调用本工具

`freeze-candidate.mjs --check` 目前只校验自身字段。建议在写 manifest 前，用
`report()` 对「现有候选 + 新候选」跑一遍，出现 `RECORD_ROOT_STALE_PATH` / `LINEAGE_UNRECORDED`
即拒绝。旧的 `-2..-4` 不重写（不可变），缺陷作为历史保留。

### P3 是否让 CI 跑它

工具当前只读、可离线；接入 `pr-gate`/`ci-product` 属 gate 面，需 owner 裁决。
在此之前它只作为本地命令与 review 辅助。

---

## 3. 与「冻结版本」语义的关系

- **本提案不改变 D12**：候选仍在 C2 之前冻结，`FROZEN` 仍只表示身份锁定。
- 它增加的是一个**可读的状态面**：任何人在问「这个冻结版通过了吗」时，得到的是
  `FROZEN + C2_A_AND_B + eligible=false`，而不是把 `FROZEN` 误读成「已验证」。
- 缺陷数字（当前 7 条）是元数据债务，不是产品缺陷；修复它们只能靠**新 manifest commit**（不可变规则），
  不能编辑已冻结的文件。

---

## 4. 验收（本 PR）

- `node --test scripts/candidate-status.test.mjs` → 13/13；
- `node scripts/candidate-status.mjs --self-test` → 5/5；
- 真树运行结果：`evidence/eng-candidate-status-20261113/status.txt`（exit 1，7 defects）；
- 未改 `.github/`、`dev/ci/`、`scripts/eb3-*`、分支保护、Authority、候选 manifest 或 ref。
