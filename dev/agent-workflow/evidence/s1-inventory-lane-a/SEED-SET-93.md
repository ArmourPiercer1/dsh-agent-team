# S1 Lane A · SEED-SET-93（93 条历史种子定位结果）

## 结论：**LOCATED —— 条目数恰为 93 的清单 = Alpha5 M0-closure-v3 工具路由种子账**

不在 `docs/migration/`（那里是 88 数据行的复用地图），而在 **`docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/`** —— 主树里它是一个 **symlink**：

```
docs/plans/active/alpha5-tool-io-governance/m0-closure-v3
  -> /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5m2-bmcp/docs/plans/active/alpha5-tool-io-governance/m0-closure-v3
```

（`ls -la docs/plans/active/alpha5-tool-io-governance/` 实测该 symlink，mode `lrwxrwxrwx`，size 120，mtime 10-24 08:45。）
主树 `git ls-files | grep -ci m0-closure-v3` = **0**（`docs/plans/active/` 本身 gitignored）；真实归属 = 另一条线的 worktree：**`.worktrees/a5m2-bmcp`**，该 worktree 内 `git ls-files | grep -ci m0-closure-v3` = **63（tracked）**，其 HEAD = `3954d6368cd6fb533c03f20e0017126f1b5880ba`，分支 `feat/a5m2-b-mcp`（只读查询）。

## 1. 计数证据（本 lane 在具名文件上实测）

| 具名文件 | 字节 | SHA256 | 实测计数 |
|---|---:|---|---|
| `.worktrees/a5m2-bmcp/docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json` | 172,136 | `e1b8b29aae79c5bdcb0ffbada6ab97f21301d446c8b210098e92480fa5b418f8` | `counts = {records: **93**, uniqueNames: **90**, families: **27**}`；`records[]` 长度 **93**；`recordIndex` 0-92 全唯一（uniq=93）；`status=PROPOSED_NOT_FROZEN`，`revision=1.2` |
| `.worktrees/a5m2-bmcp/…/m0-closure-v3/route-records-v3c.json` | 80,539 | `55233426a022531cb5049587ffb605c5e487608cdcc08004e68509c2e535c929` | `records` 长度 **93**，`familyContracts` 17；`meta.status` = "M0-CLOSURE-CANDIDATE-v3c; NOT-FROZEN; checker-NOT-RUN; supersedes v3b" |
| `.worktrees/a5m2-bmcp/…/m0-closure-v3/M0-B-FAMILY-TARGET-CONTRACTS.md` | 54,670 | `1b06c40231c99990a105cdd7837c7725509ca2867a2900144248bcfaa607156b` | 契约本体（INDEX 的 `contractRef` 指向它的 `#B-*` 锚点） |

**内部哈希自洽（本 lane 重算并比对）**：
- INDEX `contractSha256` 声明 `1b06c402…` = 实算 `M0-B-FAMILY-TARGET-CONTRACTS.md` → **MATCH**。
- INDEX `sourceRecordsSha256` 声明 `55233426…` = 实算 `route-records-v3c.json` → **MATCH**。
- 两份 JSON 的 `name@scope` 键集**逐一相同**（本 lane 排序比对 = identical）；`90 uniqueNames` 的原因 = `interrupt_agent` / `list_agents` / `send_message` 三名各出现两次（`plane-host-impl` 与 `host-experimental-bundle-off` 两个 scope）。
- **未运行** 其校验器 `machine-v3/check.mjs`（`84d3fdcf2758a488…`；schema `0620a715f23d4233…`；`examples/` 44 个负控样例、`receipts/` 7 件）—— `meta.status` 自述 `checker-NOT-RUN`，本 lane 亦未运行，故**不声称该校验通过**。

## 2. 93 条的构成（实测分布，来自上述两份 JSON）

- **27 个 family**（`counts.families` 实测一致）：
  `B-TEAM 10 · B-UPSTREAMTEAM 9 · B-SUBAGENT 8 · B-TERMINAL 6 · B-BROWSER 6 · B-SEARCH 4 · B-FS 4 · B-SESSION 4 · B-SCHEDULE 4 · B-CONTROL 5 · B-MCP 5 · B-SESSIONQUERY 5 · B-PROCESS 3 · B-JOB 3 · B-INSPECT 2 · B-WEB 2 · B-ORCHESTRATION 2 · B-HUMAN 2 · B-IMAGE 1 · B-LSP 1 · B-SKILL 1 · B-DEPENDENCY 1 · B-PTC 1 · B-PLUGIN 1 · B-PRESENT 1 · B-DOMAIN 1 · B-ISOLATION 1`（合计 93）
- **归属 `attr` 分布**：`HOST_REALM_RESERVED 61 · LANE_I 17 · LANE_D 5 · LANE_B 3 · LANE_C 2 · SETUP_EXCLUDED 2 · LANE_A 1 · LANE_B+LANE_I 1 · DOMAIN_INTERSECTION 1`（合计 93）
- **准入波次 `acc`**：`F 33 · W1 23 · W2 37`（合计 93；`meta.tierMeaning`：F=冻结波 / W1=治理缺口首批必交 / W2=条件必交）
- **证据级**：`E1 29 · E2 64`（E2 文案 = "prior fixed source research unless document marks E1"）
- **targetStatus**：93 条**全部** = `PROPOSED_NOT_IMPLEMENTED_NOT_ACCEPTED`
- `scope` 20 种取值（`host-experimental-bundle-off 19`、`own-layer 15`、`host-preset-on 14`、`host-unmounted-optin-package 11` 为最大四项）
- `INDEX.limitations` 原文要点：**"PROPOSED, not implemented/tested/frozen"**；ACTIVATION-TCB 已被 `USER_SCOPE_CLARIFIED` 取代（2026-10-23，Sentinel `e08e9aeed9e08191bd7208454dca9323`），历史契约 hash `4e744eaedbb0f0e1…`、附件 hash `a6717f26af78dfcd…` 仅作历史引用；"No new effect kinds/Host Core patch"
- `meta.semanticSource` 引 `TOOL-CAPABILITY-MATRIX-9b2.md@c09f94b`（SHA `b7062a9d…`，"固定 83 名账口径 68 静态 + 15 Team"）→ **93（种子账）与 83（名账）是两个不同口径**，本 lane 不合并二者

## 3. 与 H0-M1 实测 27 工具名的交叉（一手互证）

- 实测 27 名（两个 run 的 `request/header`，见 `TOOL-SOURCE-DIFF.md` §0）中有 **26 名**出现在本 93 条账内（按 `name` 匹配）；**唯一不在账内的是 `s1_m1_probe`**（本轮 fixture 自注册名，账外属预期）。
- 账内 `prov` 字段给出逐名来源声明（例：`ask_user_question → HOST_PKG:dsh-tool-ask-user(index.ts:38-39)`；`workflow → HOST_PKG:dsh-tool-workflow(index.ts:328-329,:60)`；`subagent_fork → HOST_PKG:dsh-tool-subagent(fork provider)`）。
- 该账同时**独立解释**了 `TOOL-SOURCE-DIFF.md` §2 里 `interrupt_agent`/`list_agents`/`send_message` 的双包声明现象：账里就是两条记录（`plane-host-impl` ← `dsh-tool-subagent-control`；`host-experimental-bundle-off` ← `dsh-experimental-tool-agent-team`）。
- **口径警告**：账内 `prov`/`attr` 是 **PROPOSED 声明 + E1/E2 文献级证据**，不是运行时装载证明；本 lane 的 `TOOL-SOURCE-DIFF.md` 归属列**不因本账而改写**（仍为 UNKNOWN），只登记"另有声明源"。

## 4. 是否就是 root 所指"93 条历史种子"

数字精确吻合（93），语义也自洽（每条 = 一个工具名 × scope 的**历史路由种子**，含 `existingEntryPath`/`sourceEvidence`，`meta` 自称 supersedes v3b、语义底为 v2 `m0-candidates/route-records.json`）。
但**"root 说的 93 条 = 这份账"这一点本 lane 无法自证** → 该等值判断 = **待 root 确认**；本 lane 只交付"条目数恰为 93 且哈希自洽的唯一具名载体"这一实测结果。

## 5. 仍 UNKNOWN
1. 主树 symlink 的创建者与生命周期（08:45Z 建立，指向 `feat/a5m2-b-mcp` worktree）——若该 worktree 被清理，主树入口会断链（本 lane 不动任何东西）。
2. `machine-v3/check.mjs` 的实际校验结论（未运行）。
3. 93 账与 `docs/migration/` 88 数据行复用地图之间的映射关系（无语义 id 互指，本 lane 未强行对齐）。

## 6. 先前近似值的排除记录（保留，说明为何不是它们）
`docs/migration/reuse-map.md` `bf403101…` = 88 数据行 / 99 含表头表行 / 63 唯一 legacy 路径；`legacy-behavior-inventory.md` `0c29b4bd…` = 11 行为域 + 7 G 假设 + 32 表行；`gittrees-1.txt` = 48 worktree 行 + 80 分支行；`tests/homes` = 549 条目；HTU `docs/tool-catalog.md` = 30 包 / 65 名 —— 均非 93。
