# PUBLISHER-CONTRACT v0.1.1-r2-CANDIDATE — 版本化不可变 authority snapshot + 独立 publisher 命令 + 单一 live pointer

状态：**候选，未冻结，未激活，不授权任何写入，未建任何真实 authority 文件/脚本**（ERRATA-20261025 E1；18 IDs 仍 0 ratified）。
定位：PR363 §7.4 固定顺序中 step 2 的工程候选，revision r2 = root 合并审查 NEEDS_TARGETED_FIX 的一次限域修订；r1 文件在上级目录保持冻结。
固定证据锚点：master `4aaaa7b2…`、PR363 `1310b95…`（§7.4 = blob 66a540b9…:141-147）、PR361 `b97ffdaf…`；inputSnapshotDigest `sha256:ed3c2cfb…319a4`（上一包内按 F0 canonical 规则独立复算逐字节一致）。物理母仓 `6259cf4b…` 为历史漂移（ERRATA E3），不作当前权威。

## r2 修订账目（相对 r1，逐条对应 root 裁决）

1. **唯一写入口 ≠ 唯一人身份**：删除 r1 §2 "owners 单一/无共享身份" 与 §4 `SNAPSHOT_FORK` 全局禁分叉。候选（draft、分支、并行作者）可自由并存；唯一被拒绝的竞争是 **live pointer 的竞争性更新**。
2. **载体定案（root 已定，本轮只记录不实施）**：pointer = standalone `dev/engineering/current-authority.json`（恰两键 `{snapshot_version, content_digest}`）；不可变快照 = `dev/engineering/authority-snapshots/`；publisher = 独立脚本，候选名按既有 kebab-case 规范 `scripts/publish-authority.mjs`；**普通 docs:sync 白名单不扩**。
3. `authored_from` 仅为父版本/来源锚（血缘可复核）；六个新值来自作者显式草件。
4. `published_utc` 被 content_digest 覆盖；删除 r1 关于未来哈希排除的推测。
5. ERRATA 恢复：info.contract 4/6 露出、fixture 3/6 表达力 = **仅观察**（ERRATA E2），是否扩展按新断言的实际需要决定；r1 §5 前置中 "fixture 先扩到 6/6" 硬门删除。
6. 撤回 r1 "回退先演练后切换" 这一自增前置；严格按 §7.4 原步骤序（演练逆迁移 = 原序第 8 步，在切换之后）；**未经演练不得宣称可逆**。
7. **预算更正（撤回 r1 CANDIDATE-NOTES 表述）**："计入现有累计预算（16 Owner-h…）" 无实测总账支持，撤回。16 Owner-h 是 **S1 可行性研究总上限**，S2 名义不得重置或续开 S1 研究，也不声称 S1 预算扩展。本报告只记本 session 实测时间/角色：候选包 02:22:58Z→02:25:44Z（角色：S2 step-2 候选作者）；修订包 02:36:02Z→本文件落盘（角色：r2 修订作者）。跨包累计总消耗未实测，不报。本轮 0 新 S1 Host。

## 1. 工程默认选择（载体已定案；整体仍待 root 复核冻结）

**版本化不可变 snapshot + 独立 publisher 命令 + 单一 live pointer。**

- 权威值（六字段，原语义逐字不变）发布为一次性写入、永不改写的版本化快照文件，落位 `dev/engineering/authority-snapshots/`，形态由 r2 schema（候选）描述；每个快照携带 `content_digest`，即 §7.4 要求切换期内所有并行 Agent 显式绑定的 "同一 authority digest"，算法直接复用 F0 canonical 规则（不另立新 digest 法）。
- live pointer 是独立、显式、唯一的记号文件 `dev/engineering/current-authority.json`，值恰为 `{snapshot_version, content_digest}`。快照发布与指针移动是两个动作：**发布不切换，切换不发布**。
- 拒绝的备选：双写长期化、以派生镜像（current-state.json）为源、docs:sync 自动决定权威（其白名单不扩）。

## 2. 唯一 source / 作者 / 发布的输入与输出（身份法已删）

| 角色 | 规则（r2） | 现成对应物（固定 ref 实证） |
|---|---|---|
| **唯一 source（值从何来）** | `baseline` 的真值唯一 source 是 git 对象现实（resolve + HEAD-ancestor，ci-pr-gate.mjs:333-336），快照只记录字符串；其余五值的 source = 作者显式草件；`authored_from` 只记录父版本/来源锚（`graph.yaml#current_contract@<40hex>` 或 `previous-snapshot:<ver>@<40hex>`）供血缘复核 | 现状六字段即 hand-maintained 值（MIGRATION-MAP old_current_contract_fields） |
| **作者（谁发布）** | `published_by` 为署名性血缘元数据，记录即可；**无唯一性、无身份法**（root 裁决 1）。唯一写入点是 pointer 文件的更新纪律：一次事务一个更新者，由承载它的事务（人审 commit / publisher 命令的指针事务）保证，而非身份登记 | 现状唯一写入者是"人改 graph.yaml 的 commit + pre-commit YAML-parse 守卫"（MACHINE-CONSUMERS write_side_summary：machine_writers=NONE） |
| **发布输入** | ① 作者显式草件（六个新值 + current_phase_statement 处置 + schema-valid 校验结果）；② 血缘锚 authored_from 指向真实 commit；③ 外部现实检核结果：baseline resolve/ancestor、三路径存在、backlog BL/BR 内容、matrix 行合同、Q6 引用行 | 检核语义全部现成：Q2/Q4/GROUP C/Q5/Q6（ci-pr-gate.mjs:325-336, 351-356, 372-406, 485-492） |
| **发布输出** | ① 新快照文件**追加**落位 authority-snapshots/（已发布版本永不改写/删除）；② registry.yaml 登记条目（沿用 EB0-1 式四状态分离）；③ 派生镜像经既有 `pnpm docs:sync --write` 重生成。**发布输出不含指针移动** | 安全写底座复用：`scripts/generated-write.mjs` `checkGeneratedTarget`（AREA+FILE 双名单、逐级 symlink 拒绝、O_NOFOLLOW、nlink==1、PARENT_NOT_REAL）。其为哪些新路径开面 = 冻结审查待决（ERRATA E1），非本契约既有权利 |
| **docs:sync 边界（不变式）** | 普通 `docs:sync --write` 仍**只写派生物**（GENERATED_ALLOW_LIST = current-state.json + INDEX.md，docs-sync.mjs:44-47；dev/agent-workflow/ 等 NORMATIVE_PREFIXES 一律 REFUSED，:48-57），**白名单不因本候选扩大**。它渲染、不决定 | 现码即如此，本候选不改动它 |

## 3. current_phase 与 phase_id：源码实测关系（禁止当同义）

实测于固定 ref，二者不是同义词，也不得在 snapshot schema 里合并：

- `phase_id`：current_contract 块内机器语法值（`^alpha\d+-[a-z0-9][a-z0-9-]*$`，ci-pr-gate.mjs:326），graph.yaml:92；值经派生镜像唯一被 doc-checks checkPlanCitationBlocks 消费（MC-04）。
- `current_phase`：graph.yaml:64 顶层散文句，**不是** current_contract 字段；被 Q3 计数（恰一处，:318）、被 Q1 校验（:340-345：禁命名 Alpha.4；从 phase_id 提取 `^alpha(\d+)` 后要求句中出现 `ALPHA\.?<N>`——**位数一致**，不是字符串相等）、被 state-freshness 腿禁写 revision/PR census（:186-195）。
- 后果：迁移必须同事务处置它（MIGRATION-MAP adjacent_live_statement）。候选 schema 将其列为**可选** `current_phase_statement`：禁式入 schema，位数一致属跨字段检查归 publisher 侧；退役/改写/保留由 step-6 切换事务裁决。

## 4. 旧/新双读诊断（部署≠双写；诊断不决定）

- 复用既有双读器 `checkLegacyMirror`（gen-current-state.mjs:321-350）：`LEGACY_MIRROR_INCOMPLETE` / `LEGACY_MIRROR_VALUE` / `LEGACY_MIRROR_SCHEMA_MISMATCH` 已存在，读 graph 与镜像，从不写权威。
- 候选新增（读两侧，写零侧）：
  - `SNAPSHOT_VS_LEGACY_VALUE`：live pointer 指向的快照六值 vs graph 块六记录值，逐字段比对；分歧 = 红（§7.4 PoC "旧/新状态矛盾必须被指明" 的形态）。
  - `POINTER_STALE_OR_INVALID`：pointer 指向不存在/不合 schema/摘要不符的版本 = 红。
  - `POINTER_CONTENTION`：同一事务窗口内对 pointer 的竞争性更新 = 唯一被拒的竞争（root 裁决 1；快照/候选层无分叉禁令）。
  - 切换后 graph 块不存在时 `checkLegacyMirror` 的**专用拒绝模式**（§7.4 原序第 7 步：派生镜像只读且不能反向决定权威）。
- **观察（非硬门，ERRATA E2 恢复原定性）**：`info.contract` 只露 4/6 值（ci-pr-gate.mjs:313）——若双读诊断建立在 info.contract 上则覆盖 4/6；doc-consistency-controls fixture 带 3/6 字段（:63-68）——其未表达负例暂不可证。是否扩展由后续断言的实际需要决定，不设强改旧文件的前置门。census-runtime.yml:129 第二 awk 读者须在切换事务同提交重接线（Map G1，事实非观察）。

## 5. 单指针切换 / 回退前置（严格 §7.4 原序，无自增门）

§7.4 原文固定顺序（blob 66a540b9…:145）：盘点消费者 → 冻结新权威 schema 与唯一写入点 → 部署双读诊断但不双写 → 逐消费者切换到版本化 authority snapshot → 真实 CI 负控（旧/新冲突、缺字段、未知 ID、伪造 C1/C2）→ **单一事务切换 current 指针** → 验证派生镜像只读不反决 → 演练逆迁移。r1 曾把第 8 步"演练逆迁移"前置到切换之前，属自增门，**撤回**。

**切换（第 6 步）进入条件 = 原序 1-5 步完成 +：**
1. 所有机器读者同一 commit 重接线：census awk → ci-pr-gate → gen-current-state → doc-checks → docs-probe（Map steps[3] 顺序；docs:probe 自声明限度不变，T0 only，docs-probe.mjs:41-45）。
2. 每个并行 Agent 显式绑定同一 `content_digest`（§7.4 末句）；绑定缺失 = 切换不得开始。
3. 切换 = 单一事务：六字段处置 + current_phase 裁决 + 每个被重接线读者 + pointer 文件更新，一个 commit。
4. §7.4 末段红线原样：任一消费者读写职责不明、双 current 主张、回退无法证明 → G2 BLOCKED，不得先切后修。

**回退前置：**
- 锚 = 迁移前记录的权威 SHA + 六字段逐字块，取自 **git**（切换 commit 的父提交），绝不取自 current-state.json（§7.4 显式禁止派生镜像反向恢复）。
- 回退须通过 §7.4 要求的 CI 负控与独立复审；文本 revert 后残留新锚点读者是真正风险面——读者与指针须同事务反向移动（Map rollback.note）。
- 演练逆迁移按原序在第 8 步；**在其通过之前，任何人不得宣称该迁移可逆**（r1 "先演练后切换" 的加严与 "回退无法证明→BLOCKED" 引用一并修正为仅按 §7.4 原文表述）。

## 6. 本契约不做的事

不写 publisher 实现、不激活 publisher、不建 current-authority.json / authority-snapshots/ 真实文件、不动 graph.yaml/registry.yaml/GENERATED_FILES/docs-sync 白名单、不新增权限法或 Gate、不 merge/push、不宣称 §7.4 step 2 已冻结、不宣称可逆——冻结以 root 对本 revision 的一次复核为准。
