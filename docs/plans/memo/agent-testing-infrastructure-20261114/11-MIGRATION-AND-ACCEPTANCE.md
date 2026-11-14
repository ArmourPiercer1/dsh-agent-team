# 11 — 面向本地 Agent 的实施路线、验收门和回滚

[返回索引](README.md) · [安全不变量](12-INVARIANTS-AND-NEGATIVE-CONTROLS.md) · [当前差异](13-REFERENCES-AND-RECONCILIATION.md)

## 0. 交付方式与依赖

本 PR 为设计文档，不在这里改任何运行机制。后续按 M0–M6 切小型 Draft PR；每个 PR 有范围、基线 SHA、变更前后对照、显式未覆盖面、负控和回滚。保留单一实施负责人对合并门负责；并行实现可以拆 lane，但不能同时维护两个相互矛盾的测试集合同源。

建议依赖关系：`M0 → M1 → M2`；`M0 → M3 → M4`；`M1 + M2 + M4 → M5`；最终 `M6` 精简旧机制。M2/M3 可部分并行，但不得在 M1 验证前替换原始门禁。

## M0 — 已有 baseline PR 修复与真实 profiling

**范围**：#759 的 ready-helper 假通过；#761 的 numstat 行数/字节误计；#764 的检测口径纠正，不使用 kit=zero tests 的方案；#760 保持只读、避免历史元数据永久阻塞；#762 B1 profiling 先做；#763 发布独立不作为基础设施合并门；复审 #530 收集门禁是否可复用。

交付：精确修改/风险清单、实际测量命令、一个受支持的性能报表、当前可收集测试集合与未收集/豁免 audit。

Acceptance：预先故意制造未推送 PR head、错误 Git 状态、二进制证据文件、未收集 Node 测试，每种问题被各自工具看见；L2 semantics 未变。无运行时代码/Authority 修改。

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
