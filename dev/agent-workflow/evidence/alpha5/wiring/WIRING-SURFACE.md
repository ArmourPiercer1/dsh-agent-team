# Alpha.5 集成接线轮 — 接线面清单（Scope-2；writer=接线专写；branch `alpha5-int-wiring`）

基线 = origin/master @ `fc9f4a07`（含 PR1r/PR2 @ae3dcf54、PR3 fs @74d947a3、PR4 prov @2cd5185f、PR5 tools @d69bfc4b、PR6 @6ce62c25、PR7 @fc9f4a07）。
来源依据：`INTEGRATION-PLAN.md` §G-d 义务 1/2/3/4、`INTERFACES-v1.md` C-FS/C-PROC/C-ADM/C-BIND(v1.1)、`review-LaneC.md` 判定条件、`review-LaneD.md` 三接线门、Lane B README §4 接线注。
性质：**局部实现 + 接线准备**——只接编译面/门控消费面/工厂导出，不接 live 装配、不注册 live registry、不开端口。全部为 DORMANT→**WIRED-COMPILE / GATED-CONSUME**，零生产 import 变化（agent-bindings.mjs 本轮零改动）。

## 逐项：改哪个共享文件 + 为何 + 由谁门控

| # | 共享文件 | 改动 | 为何 | 门控/门 |
|---|---|---|---|---|
| 1 | `packages/runtime/tsconfig.json`（typecheck 面） | include += `controlled-fs`（src+test 全量类型覆盖）、`sandbox-provider` | 两 lane 从未进全仓 tsc（Lane F/B 复核预报的"lane 从未进 tsc"条件命中）；接线后必须由共享编译面兜类型 | 集成 owner（本 writer 独占共享 glue）；tsc 0 红门 |
| 2 | `packages/runtime/tsconfig.build.json`（emit 面） | include += `controlled-fs/src`、`sandbox-provider` | 编译产物进 dist（PR1/PR2 同格先例：tool-dispatch/tool-admission 均双 include）；`controlled-fs/src` 而非 `controlled-fs`——lane 目录含 test/，emit 面只收 src（test 归 typecheck 面与 root vitest） | `pnpm check:artifacts` drift=0（dist 随 commit 重建提交） |
| 3 | `packages/runtime/controlled-fs/src/index.ts`（lane barrel = 接线 barrel） | +`admission-binding.js` 五个导出（见 §接线切片） | README §4 接线注的正本落点；barrel 是门控消费面的唯一入口（无第二入口） | barrel 导出面由 a5w 套件逐名钉 |
| 4 | `packages/runtime/controlled-fs/src/admission-binding.ts`（新） | `FsAdmissionPort` / `AdmissionBoundFsCall` / `bindAdmissionRecheck` / `UNBOUND_ADMISSION_RECHECK` / `createAdmissionGatedControlledFs` / `ARBITRARY_TREE_PROFILE_PUBLISHED=false` | C1 三注的代码落点：①unbound=typed 拒（接线面绝不默认 NO_RECHECK）；②AdmissionRecheck 绑本调用 PR1 canonical `parametersFingerprint`（偏离/null ⇒ typed 拒且端口零查询）；③OpenAtPort 未落地前禁发布 arbitrary-tree profile（常量钉 false，wiring 面零 OpenAtPort 实现） | a5w 套件（RED-first）+ C-FS triad（denied class 经 lane recheck-refused 映射，无新造码） |
| 5 | `packages/runtime/controlled-fs/src/controlled-fs.ts` | `ControlledFsLaneConfig.subtreeContains?: SubtreeContains`（authority-envelope 冻结类型，type-only import）；`effectCovers` 注入点 | C1 ②：subtree 律接 `SubtreeContains`；未注入时 lane 窄律逐字节不变（lane 既有 37 例零扰动） | 类型门（exactOptionalPropertyTypes）+ a5w 双向断言（注入 false 拒 / 真包含放） |
| 6 | `packages/runtime/controlled-fs/README.md` | §4 接线注状态注记（哪条已落代码+测试、哪条仍未落=OpenAtPort） | 接线注与代码状态不脱节 | 文档性 |
| 7 | `vitest.config.ts`（root） | include += `packages/runtime/controlled-fs/test/**`（**a5p5-tools 不随本轮入 root**：其 `a5p5-dormant-audit` 逐字扫 packages/** 共享配置集，root 一旦点名 lane 即触发自身 DORMANT 断言——该 lane 的 root 收集与审计放行同属 PR5-装配轮，本轮它继续跑 lane 自有 runner，Lane-D 修复由 lane runner 全量验证；已在配置文件注释披露） | INTEGRATION-PLAN §2 默认裁决=扩 include 进 CI 门（仍零生产 import） | root vitest NEW=0 对照 |
| 8 | `packages/testkit/test/p4t6-session-event-scan.test.ts`（ledger，集成 owner 保留文件） | 两条记录：①**合并史纠偏（实测）**——PR3(74d947a3)+11 / PR5(d69bfc4b)+19 / PR7(fc9f4a07)+14 共 44 件 lane 文件并入时未付 tie，master 上该套件自 PR3 起即红（pristine 实测 `expected 1153 to be 1109`，`p4t6-BASE-PRISTINE-RED.log`），本轮按 merge 归属入账；②本轮自有 `SCANNED_PATHS_A5WIRING` = 2 件（admission-binding.ts + a5w 套件，`p4t6-PRE-EXTEND-RED.log` = `expected 1155 to be 1109`）。tie 链 `1109→1120→1139→1153→1155`，BY-PATH 逐径断言在场 | pay-the-tie 惯例（PR1/PR2/PR4 同格）；账本由集成 owner 清偿是其本职 | p4t6 10/10（实测 GREEN，顺带清偿一个基线已知红） |
| 8b | `packages/tools/a5p5-tools/test/a5p5-dormant-audit.test.ts` + `packages/runtime/test/a5p7-lane-hygiene.test.ts` | 各加 path-exact 的 NAMES-ONLY census 例外（p4t6 账本文件本身）+ 新 leg 钉"census 行=quoted 路径、非 import 边" | 账本入账让两 lane 的原始文本 DORMANT 扫描命中 p4t6 文件（其扫描宇宙含 testkit 测试）；例外=声明式的"名字≠引用"裁决，非删除断言 | 两套件全绿；census-form pin leg 在场 |
| 9 | `packages/runtime/test/a5p4-lane-hygiene.test.ts` | 仅头注 (3) 措辞更新（"lane 不在共享 tsconfig"已过时→已接编译面+仍自检+仍 DORMANT）；断言零改动 | 共享 tsconfig 接线后注释即失真；DORMANT 断言（无生产 importer）保持真 | 行为零变化 |
| 10 | ~~`dev/agent-workflow/evidence/alpha5/INTERFACES-v1.md`~~（正本在主检出=协调者持有，非本分支跟踪文件）→ 勘正以 **`dev/agent-workflow/evidence/alpha5/wiring/INTERFACES-v1.1-ERRATUM.md`** 便条交付 | C-BIND(v1.1) 勘正：六个事件名以 master@452a04c0 **全前缀发射名**为准（install.ts :651/:662/:673/:686/:763），混写短形作废；lane 常量/测试/文档已按此落地 | review-LaneD 接线门①根因即该行混写；契约 owner 裁决已在任务令：以 master 全前缀为准 | lane 套件（SETTLEMENT_EVENTS 闭集钉 + 全腿全名 + 越集事件走新 typed 码 `spill-settlement-event-unknown`） |
| 11 | `docs/plans/memo/alpha5-tool-io-governance/pr8-accept/acceptance-matrix.json` | 仅经 `pending_update` 字段（Lane G 条件"M 行更新仅经 pending_update"）为 fs 族行注记：OpenAtPort 前禁发布 arbitrary-tree profile Supported | INTEGRATION-PLAN §4 Lane-B C1 后半（写入 PR8 矩阵相关行） | 候选态文件、机制内更新 |

## Lane-D 三接线门状态（tools lane 源上真修，RED-first）

1. **事件名对齐（①）— 已落 GREEN**：`spill.ts` `SETTLEMENT_EVENTS` 六名全前缀（v1.1 勘正）；`backend-contract.ts` `UNREADABLE_SETTLEMENT` 同步；lane 三测试文件全名化；越集事件新 typed 码 `spill-settlement-event-unknown`（lane 自有闭集扩展，§5 零新造码）。RED 见 `a5p5-LANE-D-RED.log` 前身跑（spill 首批）与 GREEN 日志；语义边界=验名不宣称通道投递（G-g OPEN）。
2. **openSink 复用渗透（②）— 已落 GREEN**：RED=`expected true to be false`（复用 openSink 曾重写 meta `settlement:null` 并续写 payload）；修=validSpillId 后 `exists(payload)||exists(meta)` ⇒ `spill-id-in-use` typed 拒（零端口调用）；残留记录仍经 `readSpill`（授权重查）读。连带把 parity 两条共享存储复跑 leg 改为专储世界（新律下的诚实形状，见文件内注）。
3. **render outputMode 闭集（③/B3）— 已落 GREEN**：RED=两条（未抛出/`expected 'presented' to be 'backend-failed'`）；修=`renderSearchResult` 入口对 `GREP_OUTPUT_MODES` 闭集校验，越集抛导出类 `RenderClosedValueViolation`；`pipeline.ts` 捕获映射为 `backend-failed / denied / outcome-outside-closed-set`（`BackendFailure.code` 本就是开放字符串，§5 零新造码），呈现零字节。

## 不在本轮（明确不做）
- agent-bindings.mjs / live registry：零改动（provider spawn 路径保持显式调用；`createConfinedProcessProvider` 仅编译面+barrel 工厂导出）。
- `scripts/audit-a5-tool-governance-imports.mjs` 消费者集：本轮新 src 文件不 import tool-governance/tool-dispatch（端口结构本地定义、SubtreeContains 走 authority-envelope），audit 消费者集**不增项**；基线该测试红属 PR3/PR5 并入未更 allow-list 的既有红（列入回报，处置=协调者裁）。
- jobs-gateway tsconfig（Lane F 条件 2）、p4t6 F/README 979→993 陈旧数：F 不在本轮接线清单（按协调队列顺序另轮）。
- 未新增 §5 code、未新增 C-FS reason 闭集成员（unbound 拒走既有 `effect-outside-grant` + 诊断串；spill-id-in-use 属 Lane-D 自有拒绝闭集扩展）。
- G-g：接线代码零"静默通道安全/fail-closed 已证"类宣称；涉事件通道消费处仅引 PENDING-GATES **G-g OPEN**（evidence/alpha5/PENDING-GATES.md 指针桩 + #258 分支正本）。
