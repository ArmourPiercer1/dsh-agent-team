# CONSUMERS — schema/迁移/v4 执行 consumer 现状（基线 d5de7497，全部 file:line 现场核）

C 路；取证 2026-10-19T08:2x–08:4xZ。三层版本面各自独立，**"v4" 在本仓有两个不相干所指**，先钉死：
- **Blueprint 文档 v4**（本次对账主面对）：`SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS=[3,4]`（`packages/domain/blueprint/src/schema.ts:87`，#324 单点翻档）。
- **Remote 契约 v4**（读面 wire，非执行链）：`REMOTE_CONTRACT_VERSION_V4=4`（`packages/remote/src/contracts/version.ts:69`），支持集 `[1..9]`（:198-209，serve=REMOTE_SERVED_VERSION=当前 v9，`response.ts:213`）。

## 1. schema 版本面（contracts / blueprint / remote / projection）

| 面 | 常量与值 | file:line |
|---|---|---|
| Team 契约 | `TEAM_CONTRACT_SCHEMA_VERSION=1`（P3-T1 冻结）；`LEADER_INSTANCE_RECORD_SCHEMA_VERSION`；`SUPPORTED_SCHEMA_VERSIONS` | `packages/contracts/src/schema-version.ts:27` 等；barrel 再出 `contracts/src/index.ts:48-50` |
| Projection 自有轨 | `PROJECTION_SCHEMA_VERSION(=1, P8-T1 冻结)` / `_V2` / `SUPPORTED_PROJECTION_SCHEMA_VERSIONS`（**不 restamp 包级版本**，`projection/schema.ts:5-6` 注释） | `contracts/src/projection/index.ts:18-20` |
| 错误码闭集 | `SCHEMA_VERSION_MISMATCH` / `SCHEMA_VERSION_UNSUPPORTED` | `contracts/src/errors.ts:54,56` |
| Blueprint 文档 | `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS=[3,4]`；v3=closed；v4=v3+`toolBindings` 家族 | `domain/blueprint/src/schema.ts:87`；`blueprint-v4.ts:60,65,69`（家族名+顶层闭集+**五键闭形** `owner,name,authorization,io,execution`，无第六键） |
| Remote | v1 基线冻结 + V2…V9 各钉；支持集 [1..9] | `remote/src/contracts/version.ts:32-160,198-209` |

## 2. 迁移路径与 fail-closed 形（逐面）

### 2.1 Blueprint v1/v2→v3（已完成的退役迁移，A4-PR7 线）
- 版本门：文档版本在支持集外 = parse 大声失败（`schema.ts:26-27`「`SCHEMA_VERSION_UNSUPPORTED`/`SCHEMA_VERSION_MISMATCH`」；:145 注 snapshot-ref 码归 domain parser）。
- 退役扫描器+机检：`scripts/verify-blueprint-version-clean.mjs:112-116`（DEFERRAL list=「knowingly still retired-version」路径名单，**加豁免=红**）+ `packages/testkit/test/a4p7-blueprint-version-clean.test.ts:199-247`（DEFERRALS 名册 6 行，逐行注 owner/理由：A-domain ×2「§7.3 inversion，主体即退役版本」、B-runtime ×1、C-testkit ×2（V1_ANCHOR 哈希锚「stays dirty ON PURPOSE…post-flip REFUSE」）、legacy p7t6 ×1「**legacy .md 自有版本轴，非 TeamBlueprint 文档**，awaiting the fence's dirty-class adjudication row」——**这就是 HANDOFF"p4t6 ROSTER"注记中"roster"可证的最接近实体（延期在扫描名册/裁决位，非世界运行时面；见 DEFERRALS.md）**）。
- 名册进出法则：`a4p7-blueprint-version-clean.test.ts:202-204`「A file leaves this list by being migrated … never by being added to a skip list」。

### 2.2 Blueprint v3→v4（现行，**只读报告形**，无自动重写）
- 迁移器=`migration-report.ts`（读头注即法）：`packages/domain/blueprint/src/migration-report.ts:1-24`——exit form (a)=**READ-ONLY report, no edit loop, no auto-rewrite（edit loop 随 release round 才发）**；四条律=①迁移永不扩权（envelope 字节不变，差=**`MIGRATION_PERMISSION_WIDENING` REJECTION，不是可选项**）②v3 零 tool-governance 事实⇒每个 toolBindings 条目至多 `requires-decision`，绝不静默接受/允许 ③`compat-default`+宽值无来源事实=REJECT（"default→allow/all"映射**不得存在**）④静默丢字段=loud `requires-decision`（收窄须显式人类决定）。
- 消费方：**零产线消费者**——仅 `blueprint/src/index.ts` barrel + 测试 `domain/test/a5sr4-migration-report.test.ts`/`a5sr5-migration-negative-cases.test.ts`（负例=NEG suite 驱动已发决策面）。**迁移缺的步骤=执行/接线侧本就未承诺**：S0 §11:171 把字段族承诺给 PR8；`ADR-vnext-blueprint-schema-v4.md:101-102`（§7）「文档面接受 token 属 **effect-queue 行为轮**（独立 PR、独立审查）」+ `docs/blueprint-authoring.md:168-172`「**safe-but-dark for effects**…wiring is the effect-queue round's」（引文均转引自 U1 考证件 §1.4，U1=分支 `alpha5-u1-probe` @cc58e4d2，**不在 master**，d5de7497 树内该 README 不存在）。

### 2.3 字段映射引擎（作者面→内部 ToolBinding）
- `packages/domain/vnext-field-mapping/src/index.ts:4`「**DORMANT: zero production consumers**」、:13（tables 仍 DORMANT）；引擎 `field-mapping.ts`（默认拒绝）+ `v4-authoring-map.ts`。**消费方=包内自身 barrel 与 authoring-map，别无他处**（grep 全树排除 dist/test 实证）。
- v4 家族 `toolBindings` 的全树非测试引用者仅：`domain/blueprint/{schema,types,validate,migration-report,blueprint-v4}.ts` + `vnext-field-mapping/v4-authoring-map.ts`——即**语法/哈希/报告层**，无 runtime 消费者。

## 3. v4 执行链 consumer 枚举（谁在用哪个版本）

| consumer | 用哪版 | file:line |
|---|---|---|
| 装配/放置（Team 世界真执行） | v3 文档面 + v4 文档面**家族全暗**下真执行（GLUE-8 assembled 20/20 实证，U1 §0.3） | `runtime/src/plugin/live/agent-bindings.mjs`（placement/authority 派生）；`runtime/src/plugin/blueprint-authority.ts`、`blueprint-live-catalog.ts`、`host.ts`、`s6-remote.ts`、`root.ts`（parse/resolve 消费点） |
| effect-grammar 运行时消费 | **PR0 内部词法**（非 v4 作者面）：`parseRequestedEffectSet` | `runtime/src/plugin/live/ptc-escalation-row.mjs:66`（+ :65 grant-mint 经已审 PR2 面） |
| #313 binding feed（身份面） | feed 条目 `{definitionIdentity, realmId}` 平坦两键（WeakMap 指纹，进程内内容无关）——与 v4 家族五键**除 name 外不相交**（U1 §0.2） | `runtime/tool-dispatch/install.ts`（feed 入参）+ `live/team-tool-plane.mjs:78,739,752` |
| Remote wire 消费 | 支持集 [1..9]；v4-only 方法 team.resolveControl（v1-v3 请求=envelope parse 后 method-version-unsupported） | `remote/src/contracts/version.ts:69,198`；handlers/dispatch.ts 版本路由 |
| 迁移工具消费 | migration-report=报告消费者（NEG suite）；无 runtime 消费者 | `domain/test/a5sr4,a5sr5` |

**结论（v4 执行链现状一句话）**：v4 =「字段族存在+封闭形状+拒绝式解析+进内容哈希（哈希绑定承诺已兑现，ADR :49-51）」的**文档/语法面**；runtime 生效**排期 effect-queue 行为轮**；映射引擎 DORMANT；迁移=只读报告形 fail-closed（REJECTION 不是选项、requires-decision 不静默）。缺实现=在排期、缺字段=既定封闭形——**与 PR#249/S0/PR8 承诺逐项对齐**（U1 README §① 逐行溯源，A/B/C/D 四类承诺分类），**非缺口，唯 "def#N 由家族推导"=真新语义待裁**（U1 §0.3 选项 B，撞「不新造第二套身份语言」CAND D-04 与 #313 placement-only 权威法）。

## 4. 迁移失败 fail-closed 形汇总（逐处）

1. 文档版本不支持 → `SCHEMA_VERSION_UNSUPPORTED`/`SCHEMA_VERSION_MISMATCH` parse 拒（`schema.ts:26-27`）。
2. 未知字段（含 v4 家族第六键/被删键 `shadowExecute/kind/adapterId/runnerId`）→ 按名拒（`blueprint-v4.ts:344,93-98`）。
3. 迁移扩权 → `MIGRATION_PERMISSION_WIDENING` REJECTION（`migration-report.ts` 头注律①）。
4. 无来源事实宽值/compat-default → REJECT（律③）。
5. 退役版本再现于受扫面 → verify-blueprint-version-clean 机检红 + DEFERRAL 名册等式红（SET EQUALITY 裁决成员资格，非判断调用）。
6. Remote 版本不在 [1..9] → 版本门错误（`version.ts:217-229`）；v4-only 方法旧版请求 → method-version-unsupported（envelope parse 后，details 回显 contractVersion）。
7. UNKNOWN 扫描位→「UNKNOWN gates」（a4p7 测试 :250-256：机器不得用未裁证据拒，也不得静默——按 PATH 逐位人裁入 ledger 文件）。
