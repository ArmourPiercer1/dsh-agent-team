# M0-PLANB-ASSEMBLY — 单件可裁决交付（根工作单收敛版）

状态：ROOT-ADJUDICATION-INPUT（供裁决）；PROPOSED_NOT_FROZEN；**M0 不可冻结，freezeEligible=false 不变**。本件=文档装配+工程排期，零产品/Host/发布动作；全部证据=静态源码核对/附件原件静态核对，零"实测"声称。P3 有限 44 例机器件已由根接纳：不改规则、不加测试、不重跑。

## 0. 固定输入（hash 锚，全部只读引用）
| 输入 | 值 |
|---|---|
| 矩阵 @c09f94b | `TOOL-CAPABILITY-MATRIX-9b2.md` `b7062a9d7fb0d0366e5ceb19b99068ab869cf2355437f3c23a6877ce325aba0f`（本 worktree 落盘重算实证，HEAD=c09f94bf） |
| Team baseline | `9b2ee57bc5afd30e89855e09d1769d2e5ec83912` |
| Host pin | `639ed015397290b3745d163aafe02ffee4aa3f84` |
| P1 机器正本 v3c | `route-records-v3c.json` `55233426a022531cb5049587ffb605c5e487608cdcc08004e68509c2e535c929`（字节不改） |
| M0-A 合同 v1.1 | `M0-A-LIFECYCLE-CONTRACT-v1.1.md` 17,609 B `208ba98cf0b9ddca91cb34d403f479b6994cf283f4fed04b75e1f40f3cdfb61c` |
| M0-B 合同 v1.2（USER_SCOPE_CLARIFIED 版） | `M0-B-FAMILY-TARGET-CONTRACTS.md` 54670 B `1b06c40231c99990a105cdd7837c7725509ca2867a2900144248bcfaa607156b`（PR357 审阅修复版：§5.3 installer 义务撤回历史，L217/219）；历史版 53,923 B `4e744eaedbb0f0e1f0532cdc5f9e3d53a996734d13606b3167145e6eebbfd0ee`（附件原件）与 54,304 B `909bbb9ddffa0b9a06bfe398ba5358e71c86c4bd4a1137a3866c417be7f154f1`（PR357 初版）保留引用 |
| M0-B 索引（USER_SCOPE_CLARIFIED 版） | `M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json` 172136 B `e1b8b29aae79c5bdcb0ffbada6ab97f21301d446c8b210098e92480fa5b418f8`（header contractSha256 互指修复版 md）；93 records/90 唯一名/27 family；sourceRecordsSha256=`55233426…`；历史版 171,307 B `a6717f26af78dfcdb6880790f2d586674920b2073b33fc56ea6a1a94b1ea6269`（附件原件）与 172,136 B `5d895a22181001f0e07664d12b8f28ee7885899703584a383524a77310b9dcbb`（PR357 初版）保留引用 |
| P3 机器件（已接纳） | `machine-v3/`（check.mjs `84d3fdcf2758a488b94489c058092b9641ee1a2ab85ed36d49464e0f50f416f4`，run4–7 回执 44/44 rc=0） |
| 装配历史（保留不删） | `ASSEMBLY-INCOMPLETE-M0-B-INDEX-PREFIX-until-record31.json` 59,072 B `81e3b62ec786aa072b53f9e434d1c72edbdc244742785c75b168fe0ca57b899f`（其字节=权威附件前 59,072 B，逐字相同，实证 records 0–31 无损） |

## 1. P1 映射变更清单（引用权迁移；不重新设计、不造新分类）
**总则**：旧 P1 草稿保留于盘（`CLOSURE-ROUTES.md` + `route-records-v3c.json` 字节不动），顶部加 SUPERSEDED 指针行；family/owner/acceptance 三引用的权威由本两件承担；v3c 的 cur 轴（现状事实）、六条纠偏、Q5 映射义务、ceiling 条款继续作为**证据输入**，不当目标、不删除。

1. **行身份不变**：index 93 records 与 v3c 93 行 `(name,scope)` 键集 1:1 全等（本次一次性只读集合差分 both-∅；非 P3 checker 操作，未动 expected）。record 身份锚仍=v3c（index header sourceRecordsSha256 直指）。
2. **family 轴（新权威）**：27 个封闭 `B-*`（B-FS/IMAGE/SEARCH/PROCESS/TERMINAL/JOB/LSP/WEB/SKILL/DEPENDENCY/SESSION/SCHEDULE/SESSIONQUERY/SUBAGENT/ORCHESTRATION/HUMAN/PRESENT/PLUGIN/INSPECT/MCP/BROWSER/PTC/UPSTREAMTEAM/TEAM/CONTROL/DOMAIN/ISOLATION）取代 v3c `targetGovernedRoute` 十值枚举作为归属引用；历史枚举不删。
3. **owner 轴（新权威）**：`implementationOwnerRole` 六角色封闭集 CENTER(1)/FS-PROC(23)/SERVICE(38)/CONNECTOR(14)/CONTROL(15)/PLUGIN(2)=93；`sharedSeamOwnerRole≡CENTER`、`authorizationSeamOwnerRole≡AUTH`（全 93 行恒定）。旧 P4 切片 writer 人排语义并入 §3 工作包。
4. **装载轴（新权威，双射可验）**：`mountCondition` 四值封闭集与 v3c `req` 逐行对应：**REQ 49→always 49；REQ-COND 39→declared_mount 39；REQ-COND-win32 1→win32_and_declared_mount 1；N-A-TOOL(surface) 4→surface_invariant 4**；`onMountObligation≡FULL_GOVERNANCE`。无一 required 被清零。
5. **acceptance 轴（新权威）**：`acceptance{C1,C2,C3=BASE.*+family.*+§5 finite adapter seam,recordPositiveObligation,recordEffectDeltaFromInventory,requiredNegative,executionEvidence:"NOT_RUN"}` 取代旧逐行 acc/gap 账作验收引用；v3c `acc(F/W1/W2)` 分布（F33/W1 23/W2 37）与 index `legacyAcceptanceWaveNotCondition` 分布**完全一致**——同标签、语义降级为历史波次且字段名自证"NotCondition"。
6. **旧 accept-pending/GAP 不当目标**：v3c `openDeliverable`/`routeFormPending`(Q5 形式定夺)/ceiling 条款留账本原文；index 目标列一律 `PROPOSED_NOT_IMPLEMENTED_NOT_ACCEPTED`，不携带旧未决为义务。record 52 plugin_manager 未决已收敛为 `scopeClarification: USER_SCOPE_CLARIFIED`（用户产品边界，见 §4）；包内技术待裁清零，Q5 形式定夺维持非阻塞既有项。
7. **evidenceLevel 双值**：E1 行 29=§5 定点重读集（recordIndex 12–17,21,52,58–63,74–88；与 supplementalContractRef 行集一致），其余 64 行 E2_prior_fixed_source_research；E2 行实现时按合同 §5 对应行定点重读升级（计入 M2 工作量，非新调研线）。
8. **P3 关系**：候选键集输入仍=93 行 (name#scope)，与已接纳 44 例 expected 键集恒等 → **引用更新无需任何 checker 动作**。
9. **指针先行后 hash 登记**：CLOSURE-ROUTES.md `bc797fc6…`→加指针后新 hash 见 §6；P4-OWNER-SCHEDULE.md `2f25cd48…`→同。两件正文一字未动。

## 2. family 责任/适配点表（27 行；行数/owner/mount/wave 逐值取自权威索引，适配点取合同 §5 原文锚，不改写语义）
| family | 行 | owner | mount | wave | 适配点（合同锚） |
|---|---|---|---|---|---|
| B-FS | 4 | FS-PROC | always,declared_mount | F,W2 | §5 通用四段 seam；read/write/edit/str_replace_editor 真实语义+零残留 |
| B-IMAGE | 1 | FS-PROC | always | W1 | 读取尺寸/格式边界；不改写 |
| B-SEARCH | 4 | FS-PROC | always | F,W2 | Q5 形式定夺留 v3c（不阻塞本引用）；alias confined-rg 同公共词汇（PR5 原生等价层）；纯 deny 不成立 FUNCTIONAL |
| B-PROCESS | 3 | FS-PROC | always,win32_and_declared_mount | F,W1 | bash/pwsh 平台行≠同实现（root ruling 06:43Z）；R2 判据=GATES §2.7 |
| B-TERMINAL | 6 | FS-PROC | declared_mount | W2 | **§5.1 per-open private one-shot PTY backend**；并发开不交换 plan/grant；pre-backend 失败仅摘己注册 |
| B-JOB | 3 | FS-PROC | always | F | 后台作业=治理对象非豁免；kill/output 相关取消 |
| B-LSP | 1 | FS-PROC | always | F | **§5.2 assembly 两阶段 real-ready 注入 + hardDimensions 透传**；清理未确认→UNKNOWN 登记，不称零残留 |
| B-WEB | 2 | CONNECTOR | always | F,W1 | provider 决策=产品实现条件非 scope；措辞按 S2（不断言 host 无 provider） |
| B-SKILL | 1 | SERVICE | always | W1 | 双 gate 保留；prompt-injection 面按合同措辞 |
| B-DEPENDENCY | 1 | PLUGIN | declared_mount | W2 | 装配静态面；与 PLUGIN 同 owner 不同文件 |
| B-SESSION | 4 | SERVICE | always | F,W1 | goal 三件保留 direct-human 恢复要求；todo 装配静态 |
| B-SCHEDULE | 4 | SERVICE | declared_mount | W2 | 实验 bundle-off 装载即必交；timer 重排=持久 effect |
| B-SESSIONQUERY | 5 | SERVICE | declared_mount | W2 | 五查询只读治理；30s deadline/cancel 入 C1 |
| B-SUBAGENT | 8 | SERVICE | always,declared_mount | W1,W2 | 外 provider（codex/claude_code）envelope 不可强制则 blocked 两分支均在责任面内；trio 同名按 (name,scope) 分列 |
| B-ORCHESTRATION | 2 | SERVICE | always,declared_mount | W1,W2 | graph/loop 持久状态写=effect；child 各自行受治理 |
| B-HUMAN | 2 | SERVICE | always | W1 | 人交互等待可取消；不伪造回答 |
| B-PRESENT | 1 | SERVICE | always | W1 | 暴露引用不复制；受众=获批范围 |
| B-PLUGIN | 1 | PLUGIN | always | W1 | 治理 plugin_manager 管理调用（安装/启禁/移除），复用现有 manager+必要 adapter 接线（USER_SCOPE_CLARIFIED，§4）；8 action 逐分支；保留 Host 脚本/版本豁免审批；具体安装逐次授权；不称初始化沙箱/自动可信 |
| B-INSPECT | 2 | SERVICE | always | W1 | 闭集只读 query；client 往返正确终止；未授权节点不泄漏 |
| B-MCP | 5 | CONNECTOR | declared_mount,surface_invariant | F,W1 | opaque URI≠FS path；incarnation 绑定；**surface 行实例 assurance 安装时收集、逐实例**；dynamic reconcile 失效钩子归 CENTER |
| B-BROWSER | 6 | CONNECTOR | declared_mount | W2 | **§5.5 governed-native-provider.ts 镜像 native.ts 且替换 pre-effect resource hook**；launch/attach 首效入获批范围；cancel 不误杀用户进程；attach 具名实例 |
| B-PTC | 1 | FS-PROC | always | F | assembly 静态；`net-process-visibility-GAP-332-unproven` 缺口登记不豁免 |
| B-UPSTREAMTEAM | 9 | SERVICE | declared_mount | W2 | 实验 bundle-off→declared_mount 受治理映射；与 own-layer trio 名同实异 |
| B-TEAM | 10 | CONTROL | always | F | **§5.4 15 工具 own-layer 复用，业务 service 零重写**；纯 target 分类/manifest 适配 |
| B-CONTROL | 5 | CONTROL | always | F | §5.4 既有 controlService/permission port；与 A 门互不双消费 |
| B-DOMAIN | 1 | CONNECTOR | surface_invariant | F | 非模型面工具名（83 矩阵不适用）；ADR L72 域侧自决 + L75 条目6 交集语义；S-1 已按自决关闭，无 CORE_SEAM 反例 |
| B-ISOLATION | 1 | CENTER | surface_invariant | F | preset-realm 永不到达 global tools.schemas()；ABSTAIN≠VERIFIED |

## 3. P4 工程排期（**执行基准=§3.6 管理执行预算**；§3.1–3.5 的 agent-hours 数字=**REJECTED-UNVALIDATED 作者草算**，非工程结论，不校准、不再估、不作可行性依据；每共享路径唯一 owner）
### 3.0 公共路径基座（具体路径，全部实存或 A/B 合同建议路径）
- 族码落位**建议**：index `implementationPathProposed` 27 路径仅为引用基准；**不强制 27 文件、不预设 seam/registry/zero-residual 等必建模块**——拆并以复用与最小拆分为准（根定点纠正 2026-10-22），实现期由对应 owner 定，共享文件唯一 owner 纪律不变。
- 既有装配面（owner **根统一裁定 2026-10-22**）：`agent-bindings.mjs`（装配桥 :2771-2799、mcp reconcile :2733-2832）+ `team-tool-plane.mjs`（takeover :460-474、drift-pin :397）+ `guard.ts`(:553-612)/`builtin-deny.ts`(:31-50)/`permission-coverage.ts`(:146-218) → **CENTER**；`plane-effect-backends.mjs`(:264-277) → **FS-PROC**；Control 共享 service（controlService/permission port，§5.4）→ **AUTH**；`sandbox-provider/lsp-assembly.ts` → FS-PROC；插件面复用现有 manager，仅必要 adapter 接线（USER_SCOPE_CLARIFIED）→ PLUGIN；`browser-use/governed-native-provider.ts`（新建）→ CONNECTOR。
- dist：`packages/*/dist` 提交型工件，守门 `scripts/check-artifacts-committed.mjs`（root `check:artifacts`，rc=0 先例 @1392）。构建=`pnpm -r run build`。
- vitest：root `pnpm test`=`vitest run`；每包 `vitest.config.ts`（例 `packages/testkit/vitest.config.ts`）。testkit：`packages/testkit/{src,test,domain,fault-injection}`。
- pin/环境：`tests/paths.mjs` 为基线 pin 唯一来源（消费不硬编码）；DSH_HOME=`tests/homes/<world>`；端口 3180 族；CI=`.github/workflows/{pr-gate,candidate-protection,census-runtime,characterization}.yml`。
- 纪律不变：Core 预算=0（公开 seam 不足=具名 blocker，非 patch）；单 writer/包；三片串行→本表改为多包并行但**共享文件 owner 唯一 + 其余排队**。

### 3.1 工作包（owner=工程角色，按根 2026-10-22 统一口径；估时限域=REJECTED-UNVALIDATED 作者草算，仅列责任面）
| WP | owner | 内容（责任/适配面） | 草算(ah，未生效) |
|---|---|---|---|
| WP-C | CENTER | 装配桥 + takeover 表/drift-pin + **guard/builtin-deny/permission-coverage 闭世界与掩蔽次序（根裁定归 CENTER）** + 各族注册位（拆以最小复用为准）+ dynamic-mcp invalidate 钩子 | 120–180 |
| WP-A | AUTH | reviewPayload.targetManifest 扩展（PA Effect 复用，S(op,target,right) 仅语义记法）+ invocation correlation + replay/stale/drift/跨owner 负控 + **Control 共享 service（controlService/permission port）与 A 门互不双消费** | 60–90 |
| WP-F | FS-PROC | fs/image/search/process/job/terminal/lsp/ptc 适配（pty per-open §5.1、lsp 两阶段 §5.2）+ **plane-effect-backends.mjs（根裁定归 FS-PROC）** | 200–290 |
| WP-S | SERVICE | session/schedule/sessionquery/subagent/orchestration/human/present/skill/inspect/upstreamteam 适配（外 provider 强制不可=blocked 分支） | 190–280 |
| WP-N | CONNECTOR | web/mcp（含 surface 安装时逐实例 assurance）/browser（governed-native-provider）/domain | 155–240 |
| WP-T | CONTROL | team10+control5 纯 target 分类/manifest 适配（§5.4 复用，业务零重写；共享 service 文件归 AUTH 窗口） | 70–110 |
| WP-P | PLUGIN | plugin 8-action 管理面治理接线（复用现有 manager+必要 adapter，USER_SCOPE_CLARIFIED）+ dependency | 60–90；技术未决已清零（§4） |
| WP-Q | TEST | record 验收卡（BASE+family+record delta+requiredNegative+ENV_BLOCK 登记）+ vitest 集成 + CI 挂接 + M3 汇总复验 | 230–345 |
| WP-M0R | 本 writer | M0 统一可裁决包文档面（§3.6 之 M0 项） | 4–8 |

### 3.2 阶段与依赖（阶段语义按 PR355 口径；本小节涉及的 ah 数字一律 REJECTED-UNVALIDATED）
- **M0 终态（按 PR355）**：M0=**合同/责任/判据闭 + 具名阻断登记**，即可裁决收口；**不以 M3 全收为冻结前提**（原"M0 冻结须以 M3 全收为据"句删除）。原 ACTIVATION-TCB 已按用户产品边界 USER_SCOPE_CLARIFIED 收敛（§4），无该项待裁；具名阻断登记机制保留备用；后续阶段按定接口推进，**不冒称最终全完成**。收口件=§3.6 之 M0 统一可裁决包（本件+两件原件+指针）。
- **M1 = 三参考纵切（read / bash / unsupported-fail-closed，GATES §2.3 B6 语义原文沿用）**：链 = 装配桥/内核拆件（CENTER，按最小复用）→ guard/builtin-deny 闭世界与决策钩子（CENTER，根裁定）→ read 支 + bash 前台（FS-PROC）+ TEST 三卡 run receipt（真实 ToolRuntime，V@B 复验+R2 反证）。**R2=team_bash 判据属产品码变更，须根另批产品窗口**；M1 开工门（解冻指令+任务卡+3180 边界+R2 路线立项）原文不改。
- **M2 = 全部 required，含条件工具启用**：93 行全覆盖 = always 49 + declared_mount 39 + win32_and_declared_mount 1（pwsh）+ surface_invariant 4（安装不变量+逐实例 assurance）。record 52 按 USER_SCOPE_CLARIFIED 口径计入（治理管理调用；不称初始化沙箱/全部插件自动可信）。
- **M3 = 整体验收（固定 SHA）**：93 行 C1/C2/C3 汇总、`executionEvidence` NOT_RUN→run-receipt 替换、policy drift/并发/冷恢复负控、ENV_BLOCK 复清单；验收对象=固定 SHA 包，"上呈"由根裁。
- **窗口机制**：不再使用自估 ah 排程；执行节奏唯一按 §3.6 管理执行预算与 6h 吞吐核对。

### 3.3 环境与执行条件（原"估时成立条件"；估时框架已隔离，本节作为执行假设保留）
①每包单 writer 且共享文件 owner 唯一纪律生效；②Host pin 639ed015 窗口内不漂移（漂移=按矩阵流程重钉，另计）；③C2 所需环境（win32/pwsh、browser、clangd/tsserver、真实 HTTP MCP endpoint）可由测试世界提供，不足=ENV_BLOCK 登记≠通过且不算估时违约；④E2 行定点重读按 §5 锚点即读即用；⑤审阅轮响应时间不计入墙钟。

### 3.4 最新目标锚定（**本节旧稿=WITHDRAWN 历史留档，不作有效计划**。根定点纠正 2026-10-22：本节曾把用户目标改写为"M0 收口+M1 前置"口径并下"截止不可行/二选一"结论——**均未经根/用户批准，现予撤回作废**。有效目标唯一=**全工具 Alpha5 于北京时间 2026-10-25 24:00 前（26 日前），窗口 ≈70h**；**延期/缩范围须用户裁决，本 writer 与估算均不代裁**。以下文字仅存历史；估算依据披露见 §3.5——已按根令隔离为 REJECTED-UNVALIDATED，不得据以宣布截止不可行或改范围。）
- 目标：**Alpha5 于北京时间 2026-10-25 24:00 前（26 日前），窗口 ≈70h**（自本轮 2026-10-23 02:45 北京起算实际墙钟 ≈69h，为纯墙钟，未扣审阅/产品窗口等待；聚焦工时现实 ≈50–60 ah）。
- **真实结论（不倒填）**：全量 1090–1630 ah 与该窗口**数量级不兼容**；即便 M1 参考链闭环（85–130 ah，且其内核单项 120–180 ah）也超窗。70h 内现实可完成 = **M0 余项（4–8 ah）+「M1 前置冻结包」**：seam 内核 API 冻结桩 + M1 三验收卡草拟 + 任务卡 + 3180 边界确认 ≈ **12–18 ah**；合计 ≈ **16–26 ah**，余量仅供审阅往返与 ACTIVATION-TCB 裁决等待，**不得被引用为"届时 M1 已可跑"**。
- 缺口如实登记：10/25 24:00 时点 M1 可跑闭环缺口 ≥15–60 ah（含审阅/产品窗口则更大）；Alpha5 全量（M2+M3）缺口 ≈ **1000 ah 级**。→ 【**撤回（根定点纠正）**：由此导出的"目标日与范围二选一/按 M0+M1 前置口径定义"未经根/用户批准，作废；目标不因本 writer 估算而改】
- 本锚不修改 §3.1–3.3 任何估算数字；任何"压时以就日期"的操作视为倒填违令。

### 3.5 估算依据披露（根定点要求；本节全部数字=REJECTED-UNVALIDATED 草算存档）
- **ah 实际定义**：单 writer 聚焦工程工时，串行累计，不含审阅往返与产品窗口等待；非墙钟、非人头日历。唯一实测锚=旧 P4 三切片 receipts（5–8/14–22/4–6 ah，run 主导型）；本件八包数字与该锚**不同形态**（含设计/适配/负控），未做二次校准。
- **预算逐项来源**：行数 × 复杂度判值的外推——行数分布来自权威索引（owner 1/23/38/14/15/2，family 表 §2，逐值有据）；但每行单价为**手工判值**（如 terminal 行≈12–17 ah、team own-layer 行≈7 ah），无参数模型、无同类交付回归数据。
- **已有代码是否当从零重写**：**部分计入、口径不一致**——CONTROL 70–110 按 §5.4 own-layer 复用（薄适配）假设；但 host-body 24 行（GOVERNED_TAKEOVER_HOST_BODY）与 alias 同公共词汇行的既有 body 复用折扣**未逐项抵扣**，FS-PROC/SERVICE 单价未区分"包壳现有实现"与"新写"。即：并非全部按从零，但复用折扣不可追溯→偏差不可控。
- **依赖并行算式**：关键路径 = CENTER(120–180)→AUTH(60–90)→max(FS-PROC,SERVICE)(190–290)→TEST-M3(80–120) 的**串行和**（min 实算 450，写 460 为取整；max=680）；"×1.1" 装配等待系数=手设常数。二者均非实测并行度数据。
- **隔离处置（根 2026-10-22 令，覆盖前一版"待校准"表述）**：上述千 ah 级数字**混口径且无差量依据，整体隔离为 REJECTED-UNVALIDATED 作者草算**，非工程结论；**不再做校准、不再花小时重估**；唯一执行节奏=§3.6 管理执行预算+每 6h 吞吐核对。未校准状态下：不得宣布截止不可行、不得改目标范围、不得反向压时。

### 3.6 管理执行预算（根 2026-10-22 定；**预算≠保证≠实测估时**；日期算术自查：北京 10/23 04:00→24:00×2 日均分，缓冲 10/25 18:00–24:00=6h ✓）
| 北京时点（截止） | 目标 | 性质 |
|---|---|---|
| 10/23 04:00 | **M0 统一可裁决包**（本件+两件原件+指针+P1 映射变更清单，单包上呈） | 管理预算 |
| 10/23 16:00 | **M1 三参考纵切目标**（read / bash / unsupported-fail-closed） | 管理预算 |
| 10/25 00:00 | **M2 全工具持续集成目标**（93 行 required 含条件启用，全行计入；record 52 按 USER_SCOPE_CLARIFIED） | 管理预算 |
| 10/25 18:00 | **M3 固定 SHA 验收目标** | 管理预算 |
| 10/25 18:00–24:00 | 余 **6h 缺陷修正/确认缓冲**（至用户目标 10/25 24:00） | 缓冲 |
- 核对机制：**每 6h 以实际吞吐核偏差**；预计越目标即报**具体关键路径**（哪个 owner/文件/依赖卡点）；**不自动顺延、不缩 scope**——延期或缩范围唯一合法来源=用户裁决。
- 插件边界（原 TCB 项）已澄清：USER_SCOPE_CLARIFIED 后无该等待；原『若窗口内无裁决』条款失效删除；执行口径=§4。

## 4. 插件管理边界 = USER_SCOPE_CLARIFIED（原 ACTIVATION-TCB 未决项，已由用户产品边界定案，2026-10-23）
- 用户原文（Sentinel_e08e9aeed9e08191bd7208454dca9323）：『DSH Agent能通过 plugin manager 自行安装插件吗？使用的是什么工具？要想约束各种初始化代码是不可能的。我们只要能够让 Agent 安装插件的行为受到管控即可。』
- 有效口径：Alpha5 治理 plugin_manager 安装/启禁/移除等管理调用，**不做获准插件初始化代码的通用沙箱**；保留 Team tool/action/target 授权、参数绑定/单次/撤销；保留 Host 既有脚本/版本豁免审批；**Host full-access 不得跳过 Team 准入**；不扩调用权限、不批准具体安装（具体安装逐次走 Team 授权）。
- 撤除项：为初始化代码通用 IO 隔离而新增受控 installer/activation 引擎的要求（含 B 合同 §5.3 原"新增执行器"要求）；复用现有 manager，仅必要 adapter 接线。download/配置等效果按既有要求如实声明；不称"初始化沙箱"、不称全部插件自动可信。
- 历史引用：原 OPEN 叙述（Sentinel_5606c190ded88191a4d9bd9990fda52e）保留于两件历史版（附件 hash `4e744eae…`/`a6717f26…`，§0/§6 登记）；根已核固定 Host 的 8 action 与 approveEscalation，不再新增研究/审查轮。
- 未决状态：**包内技术待裁清零**；Q5 形式定夺=非阻塞既有项（留 v3c 账本）；具名阻断登记机制保留备用（未来新实例适用）。

## 5. 实施风险（执行主要不确定性）
- **R1 共享文件串行点（按根统一 owner）**：装配桥/takeover/guard/builtin-deny/permission-coverage 集中 **CENTER**；Control 共享 service 归 **AUTH**；plane-effect-backends 归 **FS-PROC**。全族注册排队过 CENTER 窗。缓解：定接口先行、各适配文件独立可先写。
- **R2 Core 预算=0**：real-ready 注入、per-open PTY、mcp reconcile 必须全部可由公开 seam 完成；若实现期证伪 → 该行转具名 blocker（按 CORE_SEAM_BLOCKER 流程），不回填 patch 路线。
- **R3 ENV_BLOCK**：win32/pwsh、browser 二进制、clangd/tsserver、真实 HTTP MCP endpoint；ENV_BLOCK=登记 ≠ 通过，对应行 `executionEvidence` 保持 NOT_RUN 并注明缺口。
- **R4 E2→实现期升级**：64 行 E2 须在实现时按 §5 锚点定点重读（实现期步骤，不构成新调研线）。
- **R5 外 provider envelope**：codex/claude_code 不可强制即 blocked（两分支均在责任面；blocked≠静默放行）。
- **R6 executionEvidence 全量翻转**：M3 93 行 run-receipt 为 TEST 串行瓶颈，墙钟上限主因。
- **R7 条件启用无先例**：declared_mount 39 行的启用链（注册/声明挂载→必交）在新排期是最大新面，M1 参考链只覆盖 always 形。

## 6. hash 历史（指针前置前后对照）
| 文件 | 前置前 | 前置后 |
|---|---|---|
| CLOSURE-ROUTES.md | `bc797fc6513fce054272763f90ac47b16bc85f101e37a63a3bae0bd018498bff` | `e36dbebdd06928c929514d9e72058b1b39ed87dec384ded3c97c43aa0b69fa0e`（正文未动，仅顶部指针行） |
| P4-OWNER-SCHEDULE.md | `2f25cd4875fa9d8d584f8ff25eb126a30f780f48232fa4a5620b6e5aa6fddddd` | `e1c35610e8fa136840abb9fefb223bd46a22c62c17529e4ae8691243d9c7a8f5`（同上） |
| M0-B 合同原件 | 53,923 B `4e744eae…`（附件历史版）→ 54,304 B `909bbb9ddffa0b9a06bfe398ba5358e71c86c4bd4a1137a3866c417be7f154f1`（PR357 初版） | 54670 B `1b06c40231c99990a105cdd7837c7725509ca2867a2900144248bcfaa607156b`（PR357 审阅修复版）
| M0-B 索引原件 | 171,307 B `a6717f26…`（附件历史版）→ 172,136 B `5d895a22181001f0e07664d12b8f28ee7885899703584a383524a77310b9dcbb`（PR357 初版） | 172136 B `e1b8b29aae79c5bdcb0ffbada6ab97f21301d446c8b210098e92480fa5b418f8`（同上；header 互指修复版）

## 7. 传输通道纪律（2026-10-22 用户硬限制，本 writer 即刻生效）
禁止"大文档粘对话→模型重建落盘"。文件入仓唯一通道=原文件上传（附件）或获授权 GitHub；落盘一律 `cp` 直通+bytes/SHA256 核对；组织/指导/审查仅短指令在会话内进行；不因此增加任何发布/push 权限。既有实例处置：`M0-B-…INDEX.json`=附件直通（`a6717f26…` 已核）；`ASSEMBLY-INCOMPLETE-…` 前缀与本次转写教训留档，不再发生。
