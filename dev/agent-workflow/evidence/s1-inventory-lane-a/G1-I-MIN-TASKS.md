# G1-I-MIN-TASKS — 闭合 G1-I 的最小任务集（≤5，S1 Lane A · T_start `2026-10-25T00:00:33Z`）

每项 = **一行动作 + 一行它能定什么**。差集行号 D1…D8 见同目录 `F0-SOURCE-SET.md` §2。
本轮已把"固定输入内可判定"的差集全部判完（§C），因此**本工具来源子项**收敛到 **4 项**（必须项 2）。**此收敛范围仅限"工具来源"**；G1-I 整体还含 F0 签发、冻结/资产、差集账、回收计划的可审性（root 窄裁决，见文末 §R）。

## A. 必须做（2 项）

| # | 动作（一行） | 它能定什么（一行） |
|---|---|---|
| **T1** | root 裁**口径标签方案**（F0 = 跨 source/profile/mode/platform 的**并集 + 条件标签**；**不得任选一个 preset×mode 当作全工具范围**） | 关掉 **D6** 的正确方式不是缩表：`base/cordis.patch.yml:496-500` 把 mode 留成部署选择、backlog(44)/plan(40) 内无名单、四 preset 名集实测 **2/31/31/33** ⇒ 裁的是"每行如何标 preset/mode/platform/条件"，**`standard × native` 只作 M1/M2 观测比较切片**；`cordis`/PTC 折叠/条件插件/动态 MCP/Team 15 名全部具名保留，不因切片而消失。 |
| **T2** | **已关闭（主侧一次定点 grep，0 Host）**——只补引用 | `modelSelectionPolicy` 在 HTU 仅见 `packages/subagent/tool-subagent/src/index.ts:360-362,492` 与 `…/model-selection-state.ts:31,40`（zod `stateSchema`），**四个 preset YAML 内零声明** ⇒ `list_subagent_models` 为**配置门控**（本组 profile 未置值 ⇒ 不注册；条件注册点实测 `index.ts:362`，定义 `list-models.ts:86-88`）⇒ **D3 残子降级为"配置可推"，无需 Host**。 |

## B. F0 可如实带 unknown 收口（2 项，点名挂账，不隐藏）

| # | 保持 UNKNOWN 的具体问题 | 为什么可以不阻塞 F0 | 将来由什么关掉 |
|---|---|---|---|
| **U1** | **逐名装载者归属**：27 名中除 `s1_m1_probe` 外的 26 名，究竟由哪个包在运行时 `register()`（`packages/core/tools/src/index.ts:1063`）；`interrupt_agent`/`list_agents`/`send_message` 被**两个包**同时声明（矩阵 A-5 vs A-9；种子账两条记录 `plane-host-impl` / `host-experimental-bundle-off`）⇒ 归属不可判 | 归属只决定"谁来治理"，不改变名账存在性；F0 引**声明级**归属（矩阵 + 种子账 `prov`）并标 UNKNOWN 即为诚实收口 | **owner + 下游验证点**：W 轴一手证据 `tools/change`（`:208`）/ scoped `get(name, scope)`（`:1230`）。**F0 内以 UNKNOWN 保留 ≠ 禁止取证**（root 撤回原"禁入 F0"表述，见 §R） |
| **U2** | **mode / 平台 / 伪名三类条件语义**：① `ptc` 下 wire 只暴露 `run_code`（`index.ts:1023-1026`，`:1352` 拒绝其它直调）⇒ 该 mode 下其它名的"可见性"不可静态断言；② 种子账 4 条伪名 `surface:mcp_stdio` / `surface:mcp_http_dynamic` / `surface:domain_family` / `surface:neg4_preset_selfregister` 的语义；③ win32 变体名集（`standard.patch.yml:22/25` `!!js process.platform…`） | 三者都是**口径/条件语义**而非"漏采的名"；写成具名条件项即可完成名账 | ① 随 T1 的 mode 裁定自动收口；② 归 m0-closure-v3 账 owner（其 `meta` 自述 `checker-NOT-RUN`，`machine-v3/check.mjs` `84d3fdcf…` 未运行）；③ 属 Windows 对等面（本仓既有口径：未证明） |

## C. 本轮已判完、禁止再投工时的差集（避免重复烧 F0 时间盒）

| 差集 | 已闭合于 | 结论 |
|---|---|---|
| D1 `subagent_fork` | `standard.patch.yml:101 toolName: subagent_fork` | 包内变体名（**不需 Host**）；`s1_m1_probe` = fixture 自注册（`m1-run.mjs:236-238` 自述 "ONE plain plugin row … No preset, no Team row"） |
| D3 主体 `ralph` | `base/cordis.patch.yml:447-449 disabled: true`（opt-in 写法 `:444-446`） | 默认关闭 ⇒ 玩具 27 名不含它属预期 |
| D2 覆盖一致性 | 种子账 86 真名 / 矩阵 83 唯一名 vs 实测 27 名 | 26 名**全部**在两账内，唯一外量 = `s1_m1_probe` |
| D4 账本口径 | 逐名实测 | **93 记录 ≠ 93 名**：93 − 4 `surface:*` 伪名 − 3 双记名 = **86 真名**；两账口径差 = 3 别名（`team_bash`/`team_glob`/`team_grep`，只在矩阵主表不在附录） |
| D5 Team 15 名 | `git show 4aaaa7b2:packages/tools/src/tools.ts` 字面 `name: 'team_*'` **13**（首 `:498`）+ 工厂动态命名 **2**（`:1371-1377` `verb==='grant' ? 'team_grant_permission' : 'team_revoke_permission'`）= **15** | 与矩阵 A-10 逐项对齐；⚠ **盘点口径陷阱**：只 grep `name: 'team_` 会得 13（少 2），任何机检若复用此口径会直接产出错账 |
| D7 `plugin_manager` | `standard:145` 行在 + `:146 disabled: true`（`base:16-18` 同） | 与实测 27 名不含它**一致**，不是缺口 |

## D. 结论（一句）
**本工具来源子项**可带具名 UNKNOWN 收口：T1 是**口径标签方案裁决**（不是选切片），T2 已用定点证据关闭。**原"G1-I 只差 T1+T2"与"U1/U2 结构上不可能在零 Host 关掉"两句撤回**（root 窄裁决，见 §R）：本两份报告只审工具来源；UNKNOWN 以 **owner + 下游验证点**入账，且不禁止后续取证。


## §R root 窄裁决（登记真实修改时间 `2026-10-25T00:11:59Z`）
- **范围**：仅本 lane 两份库存报告的文字更正；未动架构 / PR363 三文档 / 其它 lane 文件，未新增文档套系。
- **要点**：① F0 = 跨 source/profile/mode/platform 的**并集 + 条件标签**，禁止用任一 preset×mode 缩减全工具范围，`standard×native` 仅观测比较切片；② **93 records 含 4 条 `surface:*` 义务全部保留**（90 唯一 name / 86 非 surface 名 / 3 双记名同留）；③ T2 **已由定点证据关闭**，只补引用，不需 Host；④ 撤回"G1-I 只差 T1+T2"与"U1/U2 结构上不可能/禁入 F0"两处越界表述——G1-I 还含 F0 签发、冻结/资产、差集账、回收计划可审性，UNKNOWN 可带 **owner + 下游验证点**入账且不等于禁止取证。