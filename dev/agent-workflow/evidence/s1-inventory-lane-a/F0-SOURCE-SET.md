# F0-SOURCE-SET — 工具名清单的源集与最小差集（S1 Lane A · T_start `2026-10-25T00:00:33Z`，20 min box）

读法声明：只用令中固定输入 + 其内定点 grep；全部行号/计数为本 lane 一手实测。零 Host、零端口、零安装、零构建、零全盘扫描、零 `.worktrees/**`、零 `.tar.zst`、零凭据、零 git 写；`tests/deepseek-harness-test-use` 全程只读。

## §0 三条口径事实（先接受，否则"工具名全集"无定义）

1. **名字面是三条互不等价的轴**：
 - **轴 P｜profile 行声明**（OBSERVED 行 + SOURCE_DECLARED 名映射）：`packages/bundle/base/cordis.patch.yml`（**94** 插件行，tool 类包行 **22**）与 `packages/bundle/web-app/presets/{minimal,standard,ptc,cordis}.patch.yml`（插件行 **7/30/31/31**，`toolName:` 行 4/4/4/4）⇒ 名集 **2 / 31 / 31 / 33**。
 - **轴 W｜装载后 wire 可见**（OBSERVED）：`packages/core/tools/src/index.ts`（1985 行）—— `register()` **:1063**；按 scope 解析 `get(name, scope?)` **:1230**；执行边 `resolveExecution(name, scope, nested)` **:1247**；视图 `{visible, knownNames, restrictableNames}` **:1218**（字段 **:716/:718**）；事件 `tools/pre-execute` **:153** / `tools/execute` **:164** / `tools/change` **:208**。
 - **轴 G｜治理名账**（SOURCE_DECLARED）：固定 master 矩阵附录 **86 行 / 83 唯一名**；93 条种子账 **93 记录 / 90 唯一 name / 86 真名**。
2. **W 轴按 presentation mode 折叠**（OBSERVED，@`index.ts`）：`wireSchemas()` **:1008-1029** → `native` 用 `knownNames=[...view.knownNames]`（**:1013**）；`ptc` **只留 `run_code`**（**:1023-1026**）；其它模式追加 `run_code`（**:1028**）；模式判定 `modeFor()` **:922**，ptc 下非 `run_code` 直调被拒 **:1352**。⇒ **名单必须写成「profile × mode」二元组**；单张全表在机制上不存在。
3. **默认口径不在 bundle 里**：`packages/bundle/base/cordis.patch.yml:496-500`（注释原文"Presentation mode is a deployment choice; omitting it here keeps the schema default (native)"；行 `- id: tools` / `name: '@deepseek-ai/dsh-tools'` = **:498-500**），且固定 master 的 `ALPHA5-EFFECTIVE-BACKLOG.md`(44 行) / `current-execution-plan.md`(40 行) 内**无任何 preset×mode 名单**（实测）。

## §1 源集表

| # | 源（读取方式） | pin / 完整性自证 | 能证 | 不能证 | 标签 |
|---|---|---|---|---|---|
| S1 | 93 条种子账 `dev/agent-workflow/evidence/s1-m0-closure-v3-seeds/`（`node` JSON 解析） | 本 lane 重算聚合 = **`81102fae614b16521c30717c3122fce6791c66f3c04b901e7e9bb61ab207c657`**（与父侧声明逐字符一致）；`route-records-v3c.json` `55233426a022531c…` records **93**、`familyContracts` 17；INDEX `e1b8b29aae79c5bd…` `counts={93,90,27}`、`status=PROPOSED_NOT_FROZEN` | 93 条 **PROPOSED** 逐名治理账（attr / 波次 / E1-E2 / family / `prov` 声明）；4 条 `surface:*` 伪名行；3 个双记名 | 实现、注册、装载、验收（93/93 `targetStatus=PROPOSED_NOT_IMPLEMENTED_NOT_ACCEPTED`；`meta` 自述 checker-NOT-RUN） | **SOURCE_DECLARED** |
| S2 | 固定 master 矩阵 `git show 4aaaa7b2:docs/plans/active/alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md`（171 行） | `git cat-file -t 4aaaa7b2`=`commit`；主矩阵 26 行且文首自述"**覆盖盘点未闭合，不能作为 M0 冻结输入**"、全行 `V@B=no`；附录 `- **name**` 行 **86**、唯一 **83**（3 名双列 = `interrupt_agent`/`list_agents`/`send_message`，见 A-5 与 A-9）；尾注自述"68 静态名 + Team15 + 同名分实现" | 治理层逐名账与其**自认 UNKNOWN**（A-9 九名逐名 `UNKNOWN`）；别名/接管事实（`team_bash (M-07 alias)` L31、`team_grep` L27、`team_glob` L29） | 运行时名集；其自身声明不可作 M0 冻结输入 | **SOURCE_DECLARED** |
| S3 | 固定 master `…/ALPHA5-EFFECTIVE-BACKLOG.md`(44) + `…/current-execution-plan.md`(40) | `git show 4aaaa7b2:…` 行数实测 | 当前指令面（BL-01 `team_bash` default-ask 穿透 = **OPEN — RELEASE BLOCKER**；BL-10/BL-11 关闭带 SHA） | **不含 preset×mode 名表** → 对名集为**非源** | **SOURCE_DECLARED**（名集面 EXCLUDED，理由：无名单） |
| S4 | HTU 注册表源码 `tests/deepseek-harness-test-use/packages/core/tools/src/index.ts` | `git -C tests/deepseek-harness-test-use rev-parse HEAD` = **`639ed015397290b3745d163aafe02ffee4aa3f84`** | 名字的装载/折叠机制（§0 全部行号）：`register()` 是名字唯一入口；scope 遮蔽语义 **:1221-1231** | 本文件**不含任何具体工具名清单**（仅 `RUN_CODE_NAME` 常量） | **OBSERVED** |
| S5 | HTU profile/bundle 侧：`base/cordis.patch.yml` + `web-app/cordis.patch.yml` + `web-app/presets/*.patch.yml`（targeted grep 定位） | 同上 pin | 每个 profile 声明哪些工具包/名、**禁用行与条件行**：`standard.patch.yml:94/101/108/116` = `subagent`/`subagent_fork`/`subagent_codex`/`subagent_claude_code`，其中 **:105、:113 `disabled: true`**；`plugin_manager` 行 **:145 且 :146 `disabled: true`**；平台条件 **:22/:25** `!!js process.platform…`；`base:447-449 tool-ralph … disabled: true`（**:444-446** 给出 opt-in 写法）；`base:367-368 tool-subagent-list-agents`（无条件）；`ptc.patch.yml:147 mode: ptc` | 装载后的真实可见性（需 W 轴）；Team 侧插件不在本 bundle（实测 grep `experimental` = **0 命中**） | **OBSERVED**（行）+ **SOURCE_DECLARED**（名，经 S6） |
| S6 | HTU 生成目录 `docs/tool-catalog.md`（`a273d415…`）Tool Package Map → **30 包 / 65 名** | 同 pin | 名↔包**声明映射**（P→名的唯一桥）；逐名小节（如 `### list_subagent_models` **:2016**） | 生成文档：不证明某 profile 装载了它 | **SOURCE_DECLARED** |
| S7 | HTU **包内条件注册源码**（本轮为闭合差集而定点读）：`packages/subagent/tool-subagent/src/list-models.ts:82-88` 与 `…/index.ts:362` | 同 pin | `list_subagent_models` 的注册是**条件式**：`if (modelSelectionPolicy !== undefined) registerListSubagentModels(runtimeCtx, modelSelectionPolicy)`（**:362**） | 该 policy 在哪个配置面被置值（= 一行待采，见 tasks T2） | **OBSERVED** |
| S8 | 固定 master 产品面 `git show 4aaaa7b2:packages/tools/src/tools.ts` | `git grep … 4aaaa7b2 -- packages` | Team 工具名在册：字面注册 **13** 个 `name: 'team_*'`（首 **:498 `team_list_members`**）+ **2** 个由工厂动态命名 **:1371-1377** `const toolName = verb === 'grant' ? 'team_grant_permission' : 'team_revoke_permission'` ⇒ 合计 **15**，与 S2 的 A-10「Team15」**逐项对齐** | 这些名是否出现在某 profile 的 wire 面（Team 面在 HTU bundle 外，见 S5 末格） | **OBSERVED** |
| S9 | 本 lane 前轮一手观测 = 玩具 world 的 27 名（两次 run 转写第 14 行 `request/header`） | 转写 SHA `46b7a21c…` / `7a9808f3…`；fixture 自述 `m1-run.mjs:236-238` "**ONE plain plugin row via the public profile-patch seam … No preset, no Team row, no PR360 assembly**" | 该 world 的 W 轴实测名集（含 `s1_m1_probe`） | 产品全量（令禁）；也不证明任何产品 preset 行 | **OBSERVED（范围受限）** |
| S10 | `docs/migration/*`（5 个 legacy 名，前轮实测与 27 名交集 0） | 前轮 SHA `0c29b4bd…`/`bf403101…` | legacy 词汇 | 与本轴无交集 | **EXCLUDED**（不同词表，交集 0） |
| S11 | `.worktrees/**`、`tests/homes/**`、`.tar.zst`、`.credentials.yaml` | 令中禁令 | — | — | **EXCLUDED**（本轮零访问） |

## §2 最小差集表（**范围仅"工具来源"子项**；本表的"判完/只剩 N 点"均不适用于 G1-I 整体）

| 行 | 差集 / 变体（一手实测） | 依据 | 标签 | 关掉它需要什么 |
|---|---|---|---|---|
| D1 | `M27 \ CAT65 = {s1_m1_probe, subagent_fork}` | S9 vs S6；`subagent_fork` 不在 Map 表内（仅散文 + 被禁行）；`standard.patch.yml:101 toolName: subagent_fork` | `subagent_fork`=**SOURCE_DECLARED**（已归位为包内变体名）；`s1_m1_probe`=**OBSERVED**（fixture 自注册） | 已闭合，无需采集 |
| D2 | `M27 \ SEED86 = {s1_m1_probe}`；`M27 \ APP83 = {s1_m1_probe}`（26 个观测名全部被两账覆盖） | S1（93 记录 − 4 `surface:*` − 3 双记 = **86 真名**）；S2（83 唯一名） | **SOURCE_DECLARED** 一致（仍非装载证明） | 已闭合；F0 只需在文本写"账内一致 / 装载归属 UNKNOWN" |
| **D3** | `STD31 \ M27` 去掉 disabled 行后残差 2 名 → **本轮全部有源解释**：`ralph` = `base:447-449 disabled: true`（opt-in 写法在 `:444-446`）；`list_subagent_models` = 条件注册 `…/tool-subagent/src/index.ts:362` | S5、S7 | **OBSERVED（残差解释成立）**；残留子问题 = `modelSelectionPolicy` 由哪个配置面置值 = **UNKNOWN** | 一次定点读（tasks **T2**，一行） |
| D4 | 账本口径差：`SEED86 \ APP83 = {team_bash, team_glob, team_grep}` + 4 条 `surface:*` 伪名；`APP83 \ CAT65 = 18`（`subagent_fork`/`subagent_codex`/`subagent_claude_code` + 15 `team_*`）；`CAT65 \ SEED86 = ∅` | S1/S2/S6 逐名实测；`surface:*` = `mcp_stdio`/`mcp_http_dynamic`/`domain_family`/`neg4_preset_selfregister`（`scope=surface`） | **SOURCE_DECLARED**（口径不同，非事实冲突） | 已闭合：F0 文本必须写"**93 记录 ≠ 93 名；真名 86**"，并把 3 别名 + 4 伪名列为账内非名条目 |
| **D5** | Team 面 15 名 vs HTU bundle：`grep experimental packages/bundle` = **0** ⇒ 15 名不经 host bundle 声明；但在产品面在册（S8：13 字面 + 2 动态 = 15） | S5 末格 + S8 `4aaaa7b2:packages/tools/src/tools.ts:498…:1135, :1371-1377` | **OBSERVED**（两侧都实测） | 已闭合；F0 应写"Team 名属**产品装配面**，不在 host profile 轴"；⚠ 口径陷阱：只 grep `name: 'team_` 会得 **13**（少 2），必须计上工厂动态命名行 |
| **D6** | **"产品默认交付口径"无权威名表**：4 个 preset 名集不同（2/31/31/33），`base` 把 mode 留成部署选择，backlog/plan 内无名单 | S3、S5、§0-3 | **UNKNOWN（F0 可如实带过）** | root 一句裁「默认口径 = 哪个 preset × 哪个 mode」（tasks **T1**）——无它则所有差集缺基线 |
| D7 | profile 侧显式关而 catalog 仍登记：`plugin_manager`（`standard:145` 行 + `:146 disabled: true`；`base:16-18` 亦 `disabled: true`） | S5 vs S6 | **OBSERVED + SOURCE_DECLARED** 并存（非矛盾） | 已闭合 |
| D8 | 双包同名：`interrupt_agent`/`list_agents`/`send_message` 在 A-5（subagent-control）与 A-9（上游 experimental team）各记一行；账内也是两条记录（scope `plane-host-impl` / `host-experimental-bundle-off`） | S2（86 行 / 83 唯一名的差即这 3 名）；S1 | **SOURCE_DECLARED**；装载归属仍 **UNKNOWN** | 需 W 轴（Host 轮），F0 不带 |

### 差集小结
- **本表内未闭合的只剩 2 点**（T1 是口径裁决、T2 是定点 grep）——**仅指"工具来源"子项，不构成"G1-I 只差这两点"的全局断言**（该全局断言已由 root 撤回，见文末 §R）。
- D1/D2/D4/D5/D7 已在固定输入内**判完**；D8（双包同名归属）在 F0 内以 **UNKNOWN + owner + 下游验证点**保留 —— 这**不是**"结构上不可能/禁取证"，只是本轮未取（见文末 §R）。
- ⇒ 玩具 27 名与产品 profile 之间**不存在无法解释的残差**（每个差值都落到一行源）。

## §3 本包明确不作的主张
1. 不把 27 名当产品全量；不把 catalog 65 名当装载事实；不把 93 账 / 83 账当实现证据。
2. 不对任何名字下"host 内建 / 插件 / Team 提供"的归属结论（装载者归属 = UNKNOWN，除非有 S4 意义的行级装载证据；本轮零个）。
3. 未运行 `machine-v3/check.mjs`（`84d3fdcf…`）；未复核 `.tar.zst`；未动 `.worktrees/**`、`tests/homes/**`、凭据；host 树全程只读、零写入。
4. 未做 win32 侧变体展开（`:22/:25` 平台条件只登记事实，未推名集）。


## §R root 窄裁决更正（登记真实修改时间 `2026-10-25T00:11:59Z`；root 审两原文后裁，主 Qwen 代录，仅改本文件与本 lane `G1-I-MIN-TASKS.md`）
1. **F0 的口径不是"任选一个 preset × mode"**。F0 = **跨 source / profile / mode / platform 的并集账**，每行带**条件标签**（preset、mode、platform、disabled/条件注册、动态来源）。`minimal`/`standard`/`ptc`/`cordis` 的名集差异（2/31/31/33）与 `native`/`ptc` 折叠（`:1011-1013` / `:1022-1028`）都是**账内条件行**，不是"选一个当全集"的理由；**`standard × native` 只是 M1/M2 的观测比较切片，不是产品唯一交付范围**；`cordis` preset、PTC 折叠、条件插件（`ralph`、`plugin_manager`、`bash`/`pwsh` 平台条件）、**动态 MCP 来源**、**Team 15 名**（13 字面 + 2 工厂动态 `:1373`）全部**具名保留**。
2. **93 条历史 records 全部保留为义务**，含 4 条 `surface:*`（`surface:mcp_stdio` / `surface:mcp_http_dynamic` / `surface:domain_family` / `surface:neg4_preset_selfregister`）——**它们是条件/面级义务行，不是可删的"无价值伪名"**；同时保留 **90 唯一 name / 86 非 surface 名** 及 `interrupt_agent`/`list_agents`/`send_message` 的**重复来源**记录（D8）。计数表述固定为："**93 records（含 4 条 surface 义务）/ 90 唯一 name / 86 非 surface 名 / 3 双记名**"。
3. **T2 已由定点证据关闭，仅补引用，不需 Host**：`modelSelectionPolicy` 在 HTU 仅见于 `packages/subagent/tool-subagent/src/index.ts:360-362,492` 与 `…/model-selection-state.ts:31,40`（zod `stateSchema`），**四个 preset YAML 内零声明** ⇒ `list_subagent_models` 属**配置门控**（本组 profile 未置值 ⇒ 不注册），与实测 27 名自洽 ⇒ D3 残子降级为"**配置可推**"。
4. **撤回本包的越界断言**：(a) "闭合 G1-I 只剩 T1+T2"——本两份报告**只审了工具来源子项**，G1-I 还含 **F0 签发**（UNSIGNED）、**冻结资产/保全**、**差集账**、**回收计划**的可审性；(b) "U1/U2 结构上不可能在零 Host 关掉 / 禁入 F0"——**禁令撤回**：F0 内允许 **UNKNOWN + owner + 下游验证点**收口，且这**不等于禁止取证**，后续轮次仍可采证。