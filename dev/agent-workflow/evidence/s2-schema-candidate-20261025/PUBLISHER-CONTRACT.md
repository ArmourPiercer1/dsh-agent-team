# PUBLISHER-CONTRACT v0.1-CANDIDATE — 版本化不可变 authority snapshot + 显式唯一 publisher / 当前指针

状态：**候选，未冻结，未激活，不授权任何写入**（ERRATA-20261025 E1：本轮不预授权 GENERATED_FILES 扩展或任何权威写入面扩大；18 IDs 仍 0 ratified）。
定位：PR363 §7.4 固定顺序中 step 2（"冻结新权威 schema 与唯一写入点"）的**工程候选**，供 root 一次合并审查裁决；本文不声明任何 Gate。
固定证据锚点：master `4aaaa7b2af87f80a0fae62d9c8d9cf03d5a6fd84`、PR363 `1310b959595b211e5da7a5f727dadf522f79d60b`（§7.4 = blob 66a540b9…:141-147）、PR361 `b97ffdafdceeb73d58a06fe5fb6563820d063d28`；inputSnapshotDigest `sha256:ed3c2cfb50e444622c36a0bc6f508aeb9e8e6202ce65cb569b16f838b92319a4`（本轮按 F0 canonical 规则独立复算，4285B、零 0x0A，逐字节一致）。物理母仓 HEAD `6259cf4b…` 是历史漂移（ERRATA E3），不作当前权威。

## 1. 工程默认选择（待 root 裁决，非既成事实）

**版本化不可变 snapshot + 显式唯一 publisher / 单一当前指针。**

- 权威值（六个字段，原语义逐字不变）发布为一次性写入、永不改写的版本化文件，形态由 `AUTHORITY-SNAPSHOT.schema.json`（候选）描述；每个 snapshot 携带 `content_digest`，即 §7.4 要求切换期内所有并行 Agent 显式绑定的 "同一 authority digest"，算法直接复用 F0 canonical 规则（不另立新 digest 法）。
- 当前指针是**另一个独立、显式、唯一**的记号（候选形态：registry.yaml 一个 `current_authority_snapshot:` 标量，或等价的单行指针文件，二者选一，冻结审查时定），值恰为一个 `snapshot_version`。指针改动与 snapshot 发布是两个动作：**发布不切换，切换不发布**。
- 拒绝的备选：双写过渡态长期化、以派生镜像（current-state.json）为源、docs:sync 自动决定权威。

## 2. 唯一 source / 唯一作者 / 发布的输入与输出

| 角色 | 唯一性规则 | 现成对应物（固定 ref 实证） |
|---|---|---|
| **唯一 source（值从何来）** | 每个 snapshot 的 `authored_from` 必须是单一指针：`graph.yaml#current_contract@<40hex>` 或 `previous-snapshot:<ver>@<40hex>`；`baseline` 字段的真值**不在文件里**，唯一 source 是 git 对象现实（resolve + HEAD-ancestor，ci-pr-gate.mjs:333-336），snapshot 只记录字符串 | 现状六字段即 hand-maintained 值（MIGRATION-MAP old_current_contract_fields）；baseline 语义 = git reality |
| **唯一作者（谁发布）** | 每时刻一个注册 publisher 身份，登记于 registry.yaml（kind: migration 条目，owners 单一）；无匿名/共享批量身份；同一 `asYYYYMMDDrN` 链上线性无分叉（`supersedes` 强制） | 现状唯一写入者是"人改 graph.yaml 的 commit + pre-commit YAML-parse 守卫"（MACHINE-CONSUMERS write_side_summary：machine_writers=NONE）；发布者是这套人类纪律的显式命名版 |
| **发布输入** | ① schema-valid 的 snapshot 草件（含 authored_from 指向真实 commit）；② 作者对六个值与 current_phase_statement 处置的显式决定记录；③ 外部现实检核结果：baseline 可解析且为 HEAD-ancestor、三个路径目标存在、backlog BL/BR 内容、matrix 行合同、Q6 引用行 | 检核语义全部现成：Q2/Q4/GROUP C/Q5/Q6（ci-pr-gate.mjs:325-336, 351-356, 372-406, 485-492） |
| **发布输出** | ① 新 snapshot 文件**追加**落位（既有版本永不改写、不删除）；② registry.yaml 登记条目（decision/implementation 状态分离，沿用 EB0-1 式四状态）；③ 派生镜像经既有 `pnpm docs:sync --write` 重生成。发布输出**不含**当前指针 | 安全写底座复用：`scripts/generated-write.mjs` `checkGeneratedTarget`（AREA+FILE 双名单、逐级 symlink 拒绝、O_NOFOLLOW、nlink==1、PARENT_NOT_REAL 拒绝）——复用其**校验与落盘机制**；`GENERATED_FILES` 是否增列 snapshot 路径是 step-2 冻结审查的**待决事项**（ERRATA E1），不是本契约的既有权利 |
| **docs:sync 的边界（不变式）** | 普通 `docs:sync --write` 仍**只写派生物**（GENERATED_ALLOW_LIST = current-state.json + INDEX.md，docs-sync.mjs:44-47；`NORMATIVE_PREFIXES` 含 dev/agent-workflow/ 一律 REFUSED，:48-57）。它渲染、不决定：任何"把 check 跑绿"的路径不得等于切换权威 | 现码即如此，本候选不改动它 |

## 3. current_phase 与 phase_id：源码实测关系（禁止当同义）

实测于固定 ref，二者不是同义词，也不得在 snapshot schema 里合并：

- `phase_id`：current_contract 块内机器语法值（`^alpha\d+-[a-z0-9][a-z0-9-]*$`，ci-pr-gate.mjs:326），graph.yaml:92；值经派生镜像唯一被 doc-checks checkPlanCitationBlocks 消费（MC-04）。
- `current_phase`：graph.yaml:64 顶层散文句，**不是** current_contract 字段；被 Q3 计数（恰一处，:318）、被 Q1 校验（:340-345：禁命名 Alpha.4；从 phase_id 提取 `^alpha(\d+)` 后要求句中出现 `ALPHA\.?<N>`——**位数一致**，不是字符串相等）、被 state-freshness 腿禁写 revision/PR census（:186-195）。
- 后果：迁移必须同事务处置它（MIGRATION-MAP adjacent_live_statement），否则块与检查它的语句自相矛盾。候选 schema 将其列为**可选** `current_phase_statement`，位数一致属跨字段检查→归 publisher 侧执行（schema `x-current-phase-bans`），退役/改写还是保留由 step-6 切换事务裁决。

## 4. 旧/新双读诊断（部署≠双写；step 3 预演清单）

先部署、不双写；诊断只报告分歧，**任何诊断不得成为第二个决定者**（MIGRATION-MAP no_double_read_note）。

- 复用既有双读器 `checkLegacyMirror`（gen-current-state.mjs:321-350）：`LEGACY_MIRROR_INCOMPLETE` / `LEGACY_MIRROR_VALUE` / `LEGACY_MIRROR_SCHEMA_MISMATCH` 三态已存在，读 graph 与镜像、从不写权威。
- 新增的候选诊断（读两侧，写零侧）：
  - `SNAPSHOT_VS_LEGACY_VALUE`：当前指针指向的 snapshot 六个值 vs graph 块六个记录值，逐字段比对；分歧 = 红（这就是 §7.4 PoC 的"旧/新状态矛盾"必须被指明的形态）。
  - `SNAPSHOT_ORPHAN_POINTER`：指针指向不存在/不合 schema 的版本 = 红。
  - `SNAPSHOT_FORK`：同一 supersedes 出现两个孩子 = 红（双 publisher 症状）。
  - 切换后 `checkLegacyMirror` 读不到 graph 块时的**专用拒绝模式**（step 7：派生镜像只读且不能反向决定权威；MIGRATION-MAP steps[6]）。
- 已具名缺口（进诊断设计输入，均非本轮修复对象）：
  - `info.contract` 只露 4/6 值（ci-pr-gate.mjs:313）→ 建立在 info.contract 上的双读会覆盖 4/6 却显示绿（Map G2，ERRATA E2 定性为 observation）。
  - doc-consistency-controls 内联 fixture 只带 3/6 字段（:63-68）→ 扩负控前 backlog/matrix/baseline_collected 的负例不可表达（Map G3，同上）。
  - census-runtime.yml:129 的第二套 awk 语法只查非空+祖先（Map G1），双读期须并行断言同一语义。

## 5. 单指针切换 / 回退前置（step 6 的进入条件，逐条可核）

**切换前置（全部满足才允许动指针）：**
1. §7.4 前置步已完成：Map 已交付（s2-authority-map-20261025 + ERRATA）；schema 与唯一写入点经 root 审查**冻结**；双读诊断已部署且双写为零；负控（旧/新冲突、缺字段、未知 ID、伪造 C1/C2）在真实 CI 绿，fixture 先扩到 6/6。
2. 所有机器读者同一 commit 重接线：census awk → ci-pr-gate → gen-current-state → doc-checks → docs-probe（Map steps[3] 顺序），docs:probe 自声明限度不变（T0 only，docs-probe.mjs:41-45）。
3. 每个并行 Agent 显式绑定同一 `content_digest`（§7.4 末句）；绑定缺失 = 切换不得开始。
4. 回退先演练后切换（steps[7]/§7.4"演练逆迁移"）。
5. 切换 = 单一事务：六字段处置 + current_phase 裁决 + 每个被重接线的读者 + 指针移动，一个 commit。

**回退前置：**
- 锚 = 迁移前记录的权威 SHA + 六字段逐字块，取自 **git**（切换 commit 的父提交），绝不取自 current-state.json（§7.4 显式禁止派生镜像反向恢复）。
- 回退同样过全部负控与独立复审；文本 revert 后残留的新锚点读者是真正风险面——读者必须与指针同事务反向移动（Map rollback.note）。
- 双 current 主张、任一消费者职责不明、回退不可证明 → G2 BLOCKED（§7.4 末段），不得先切后修。

## 6. 本契约不做的事

不写 publisher 实现、不激活 publisher、不动 graph.yaml/registry.yaml/GENERATED_FILES、不新增权限法或 Gate、不批准任何测试文件、不 merge/push、不宣称 §7.4 step 2 已冻结——冻结以 root 合并审查后的一次决定为准。
