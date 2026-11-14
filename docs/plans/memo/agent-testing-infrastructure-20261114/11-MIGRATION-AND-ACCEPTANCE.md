# 11 — 面向本地 Agent 的实施路线、验收门和回滚

[返回索引](README.md) · [安全不变量](12-INVARIANTS-AND-NEGATIVE-CONTROLS.md) · [当前差异](13-REFERENCES-AND-RECONCILIATION.md)

## 0. 交付方式与依赖

本 PR 为设计文档，不在这里改任何运行机制。后续按 M0–M6 推进，每个 milestone 一个 Draft PR（milestone 内的多个 item 各自独立 commit、可独立回滚，不拆成互相阻塞的 PR）；每个 PR 有范围、基线 SHA、变更前后对照、显式未覆盖面、负控和回滚。保留单一实施负责人对合并门负责；并行实现可以拆 lane，但不能同时维护两个相互矛盾的测试集合同源。

建议依赖关系：`M0 → M1 → M2`；`M0 → M3 → M4`；`M1 + M2 + M4 → M5`；最终 `M6` 精简旧机制。M2/M3 可部分并行，但不得在 M1 验证前替换原始门禁。

## M0 — 已有 baseline PR 修复与真实 profiling

**范围（一个 Draft PR，内含 5 个可独立回滚的 item；不是 5 个 PR）**：把 #759/#761/#764/#762-B1 的缺陷修正在 master 上重写落地，并对 #530 的收集门禁做复用复审。#760 保持只读（不落地、不作合并门）、#763 保持发布独立（不进基础设施合并门）。

| # | item | 目标文件 / 符号 | 交付 | 负控（故意制造 → 期望） |
| --- | --- | --- | --- | --- |
| 1 | ready-helper 五处假通过 | `scripts/pr-ready-check.mjs`：`evaluate()` 的 R3/R4/R7/R8、`newestCheck()`、`gather()`（分页） | 五个 refusal 码 + `--self-test`（11 cases） | 未推送 head→`BRANCH_NOT_PUSHED`；陈旧本地 HEAD→`LOCAL_HEAD_NOT_PR_HEAD`；merge state unknown→`STATE_UNKNOWN`；pending 新 attempt→`LAYER_*_IN_PROGRESS`；>100 comments 仍能找到 settlement |
| 2 | 证据预算行数当字节 | `scripts/evidence-budget.mjs`：M0 新增 `bytesAtCommit()` / `parseBatchCheckOrdered()`（#761 现有实现只解析 `--numstat` 行数） | 用 object DB 真实字节（二进制按真实大小计）、窗口字面等于 last-N first-parent | 二进制证据文件不再记 0；窗口 30 时 `with_evidence` 必须 < 30 |
| 3 | 未定覆盖率口径 | `scripts/coverage-audit.mjs`：M0 新增 `reasonOf()`（#764 只有单一比率，没有原因分桶） | 原因直方图（kit-runner / uncatalogued-script / root-scratch / other），**不**把 kit 归为 evidence-only，**不**改 exit 2 | 改动中的 `tests/kits/**` 仍为 undetermined 且 reason=kit-runner（不是 determined/0 tests） |
| 4 | 未收集测试集合 | 新 `scripts/test-collection-audit.mjs`；复用 #530 的"tracked suite 必须 collected-or-exempt"判定形状，不落地其 gate | collected / uncollected / exempt 清单 + `--strict` | `git add -N tests/checks/x.test.mjs` 后立即出现在 UNCOLLECTED |
| 5 | step 级 profiling | 新 `scripts/census-profile.mjs`（读 Actions jobs API） | 单一受支持报表：N 个成功 census job 的 step 中位数/占比（md/txt，见 §0 证据配额） | 缺 `started_at`/全 skipped 的 run 必须拒绝或忽略，不得算作 0 秒 |

**#530 复用复审结论**：#530 仍为 OPEN（未合并），其 `scripts/eb3-node-test-collection.mjs` + manifest 例外表是"再写一份手工名单"的实现，且其 38 文件基线已过时（当前 103 个 tracked `*.test.mjs`）。M0 只复用其判定（tracked suite 必须被收集或有 reason+review 的豁免），以只读审计形式落地；M1 用自动发现替换。

**Acceptance**：上表 5 个负控全部按期望变红；`--self-test` 全绿；L2 semantics 未变（三个 Required contexts、fail-closed、census 组成、deferral 均未触碰）；无运行时代码 / Authority / workflow 语义修改（若把 M0 测试文件接入 `ci-integration`，只增加一个 leg，manifest 与 workflow 同步且 `eb3-ci-required.mjs` 形状自检通过）。

**证据配额**：`dev/agent-workflow/evidence` 的已提交 `.json` 当前 5995 个，`scripts/integration-order.mjs` 的 `BOUNDS.maxCandidates = 6000`，只剩 5 个名额。M0 及其后的证据一律用 `.md`/`.txt`/`.tsv`，多份 JSON 合并进单个文件；超过配额会让 integration-order 审计直接拒绝。

## M1 — Test Catalog 与 Runner Dispatch（shadow）

**范围**：原生 Vitest list + node:test 文件发现、少量 kit registry、Contract Registry 初版、Canonical Catalog digest、运行计划与现有 CI 显式文件名单差集审计。不得立即删除既有手工列表。

Acceptance：
- 新增 node:test 文件自动进入可收集集合；
- 删除关键合同的唯一测试、重复 ID、异常 exclude、未知 driver 必须拒绝；
- 对既有测试集进行双向对照，记录已排除的特殊 test 和复核理由；
- #530 的既有审计能力有清晰复用或替换方案；没有持久双重权威。

Rollback：关闭新 Catalog 调用，让原 workflow 接管；不影响 branch protection。

## M2 — Scripted Model + Contract Oracle（先 E0/E1 后 E2）

**范围**：预定模型调用与完全消费断言、事件关联 ID、独立 FS/PTY/network effect witness、参考小状态机、fault barriers。先验证 AUTH/EXEC/REVIEW/LIFE/RECOVERY/ISOLATION 中风险最高场景。

Acceptance：
- 在 E0/E1 可重复通过的测试上注入“绕过授权”“审批身份混淆”“Stop 后调度”等语义变异，结果稳定 FAIL；
- E2 真实 DSH 下负控能看到实际副作用或其缺失；观察器缺失时 INCONCLUSIVE；
- 真实宿主对 Scripted Model 的额外/缺失调用会触发错误；没有使用真实 LLM 或用户数据；
- Linux OS 边界不能通过纯 JS Mock 冒称已受验证。

Rollback：新 Oracle 仅作为补充，保留原始 E2 suites。

## M3 — 计时/Host 缓存/Build Artifact

**范围**：profile 现有 census 的 setup/build/test/collect，给固定 Host build 做可信缓存，Product 构建产物在同一 merge tree 下复用，确保 no-cache clean build 仍有效。

Acceptance：
- 以同一代码/Host 做至少一组 cold/warm 基准（次数由工程实测确定）；
- cache miss、错误 SHA、过期 lock/build flags、artifact 损坏时不假绿；
- 保留 `check-artifacts-committed`、真实运行 E2 与独立 World；
- 若 wall improvement 不明显或缓存显著增加风险，可回退并记录“不采用”结论。

Rollback：关闭缓存或 artifact 复用，原本可直接重跑完整 census。

## M4 — Census 并行化（shadow）

**范围**：生成完整计划、明确不可拆任务组、可配置 shard 划分、每 shard 独立 World、精确多重集聚合，接入 GitHub Actions matrix 的影子验证。

Acceptance：
- 旧完整 census 与新 shadow 在同一 Host+merge tree 上的任务集合一致；
- 注入 shard 丢失、重复任务、Host 错误、缺第二 capture、错误结果 SHA、坏 artifact 必须 FAIL/INCOMPLETE；
- 默认 full census 不移出合并前，不删除现有 Required check；
- 对 1/2/4 分片做实测，选择最小总成本且可靠的方案。

Rollback：保留单 shard / 旧 census runner，一条开关可恢复旧流程。

## M5 — 正式切换新内部编排

**范围**：在现有 `ci-required` / `ci-census` 下运行新编排，替换内部重复配置与测试枚举；保留现有合成 merge tree 与 settlement 语义。

Acceptance：
- 真实 GitHub Hosted Runner 上完整 L2 PASS（不能只靠本地 self-test）；
- 同一 head 的全部 mandatory 验证都有结果，必需的失败/缺失必须阻断合并；
- 对照旧门禁负控覆盖无降级，缓存污染/条件跳过不能假绿；
- 现有三个 Required contexts 未改，未触碰 Candidate Authority；
- 若失败，通过独立 revert 恢复 M4 之前已证明可用的执行机制。

## M6 — 旧规则收敛退役、L3 与质量看板

**范围**：在新执行编排稳定后删除被正式取代的手工测试文件列表/重复 Parser 与 verdict 分支；保留必要兼容/历史审计信息。建立长期真实模型、升级兼容、压力、长时状态回归 L3，**不替代 L2**。

Acceptance：
- 明确每个旧脚本/manifest 字段的 owner、替代机制、删除 commit；
- CI 新旧测试集合对照清单归零（或有批准的永久兼容例外）；
- 形成可持续监控指标：L1/L2 P50/P90、测试未收集数、UNKNOWN 率、flaky 率、真实安全缺陷检出与负控 mutation kill rate；
- 用真实 PR 数据证明维护流程更简单，不只是增加了新的表。

## 7. 本地 Agent 每个实施 PR 的统一交付模板

~~~text
Scope / decisions:
  implemented TINF IDs:
  current master/head:
  changed product/test/gate authority: yes|no
Verification:
  selected tests and exact runner:
  negative controls (mutation and expected red):
  hosted CI run IDs and the complete plan digest:
  remaining UNKNOWN/INCONCLUSIVE:
Cost:
  cold/warm wall, runner minutes, cache hits:
Migration:
  replaced legacy modules/list entries:
  rollback command and trigger:
No claims:
  release/C2/host versions not evaluated:
~~~

## 8. STOP 条件

当出现因测试系统变更导致的假绿、稳定实例被触及、测试副作用越界、Candidate/Authority 意外变更、同一 head 不同身份的 PASS 拼接或 Required context 被错误跳过时，停止实施并披露，不得通过修改断言或降低层级继续合并。
