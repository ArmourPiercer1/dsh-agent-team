# Alpha.5 收口清单（PRODUCTION-READINESS-CHECKLIST）— 逐原计划项 × 生产装配实况

- 基线 = `origin/master @ a2473203`（亲 fetch；工作分支 `alpha5-prod-checklist`）。writer=收口清单审计 reviewer（qwen3.8-flash-next，只读+本文件新增）。
- 方法 = **全部亲查，不信 README 宣称**：`git ls-files` 消费面 grep（`packages/*/src` 的 `.ts`+`.mjs` 双向）、`packages/*/tsconfig.build.json` include、根 `vitest.config.ts` include、安装面 = 根 manifest `files` 白名单（`packages/runtime/dist` + `packages/client/composition-shim` + `cordis.patch.yml`，1677 个 committed dist 文件）、默认装配 = `cordis.patch.yml` 行 → `host.ts:747` 派生 glue `./live/agent-bindings.mjs`（committed dist 副本亲验含 guard 引用）、各 lane barrel 导出、`scripts/audit-a5-tool-governance-imports.mjs` allow-list。
- **一句话总判**：Alpha.5 十条 PR 线中，**只有 PR1（closed-world Guard + Scoped Dispatcher）在默认装配里被生产触达**；PR2/PR3/PR4/PR7 已进编译面+安装面但**零生产 import 边（DORMANT）**；PR5(a5p5) 进了 root build include+root vitest 但**不在安装面**；PR6(PTC/LSP) 无生产实现文件；一切"治理工具链 LIVE"（M-04/M-05/M-13）均为 **kit/evidence 级装配**，产品包内无对应实现或装配行。
- 口径：本表"生产实现文件"= 计划内该线的实现代码所在（DORMANT 也如实给 file:行）；"kit-only"= 运行时触达者仅 tests/kits 或 evidence kit 脚本；矩阵行 `TRANSITIONED-LIVE` = 行级 kit 判据闭环，**不是**生产可用宣称（`final_declaration` 32 行恒 null，机检封死）。

## 1. 主表（原计划项逐条）

| 项 | 生产实现文件（file:行） | 实际调用入口（谁在运行时触达它） | 仅 tests/kits? | root 构建/默认装配包含 | 用户能否在受治理 team 使用 | 测试与剩余真实阻塞（一行） |
|---|---|---|---|---|---|---|
| **PR0 契约代数** | `packages/domain/tool-governance/src/{binding,effects,grant,lease,planes,assurance,interfaces}.ts` | 生产侧仅经 PR1 间接触达：`tool-dispatch/install.ts:53` import binding/errors | 否（经 PR1 边） | build：transitive 入 runtime dist mirror（committed）；vitest：a5p0 层审计测 | 是（仅作为 guard 的代数底座，无独立行为面） | a5p0/a5p1 测绿；零直接行为可宣称（计划 §3 = 零生产行为变化即验收）|
| **PR1 Guard 链** | `packages/runtime/tool-dispatch/install.ts:270`（installScopedToolGuard）+ `index.ts` | **生产**：`plugin/host.ts:747` glue → `plugin/live/agent-bindings.mjs:433`（import）→ `:2261`（per-agent 装填，`permissionPolicy !== undefined` 即模板声明 `capabilities.permissions`）→ 装填失败拒发 Agent（`:2491` `alpha5-tool-dispatcher-not-published`）；committed dist 副本含同一引用 | **否（生产装配）** | build：`runtime/tsconfig.build.json:32`；dist mirror 20 文件 committed（安装面内）；vitest：`packages/runtime/test/a5p1*/a5p1r*`（根收集） | **是**（条件=blueprint 模板声明 permissions；ENFORCE-PARTIAL 上限在册） | kit `tests/kits/a5-pr1-guard-dispatch` 21/21 + registry 00 live-PASS；残余=G-d 集成确认未闭 + 三缺项（无 OS 强制面/trusted 输入 fixture-grade/取消协作式）|
| **PR1r 残余边界** | 并入 `tool-dispatch/install.ts`（取消分型 `:608-635` ABORTED_BEFORE_DISPATCH/ABORTED、drain/lease 计数） | 同 PR1（同一 guard 句柄） | 否 | 同 PR1 | 是（同 PR1 条件） | a5p1r-* 测根收集；D-1（NO-ABORT-AFTER-BODY-START）DEFERRED 有主（PG:26）|
| **PR2 Admission kernel** | `packages/runtime/tool-admission/{index.ts,approval-case.ts,grant-mint.ts,clock.ts}` | **零生产消费者**；运行时触达=①根 vitest `runtime/test/a5p2-*`（fixture 级）②kit 经 committed dist 深路径 import（`wiring/w5/a5w5-fixtures.mjs:39`、c0405 同型）| **是（运行面 kit-only）** | build：`tsconfig.build.json:31` + dist 24 文件 committed（安装面内有码但**无 import 边**）；vitest 收集：是 | **否**——受治理 team 的审批走 Alpha.4 平面（permission-governance 生产在位）；PR2 的 one-shot ExecutionGrant/多 Effect 单 ASK **不在生产链**（guard 以 Generation 0 运行，`agent-bindings.mjs:2265-2269` 注记） | 测试侧活体已证（live s1s2）；阻塞=生产 glue 未接线（guard 代际输入未喂入）+ G-d |
| **PR3 C-FS** | `packages/runtime/controlled-fs/src/{controlled-fs.ts,admission-binding.ts:130 createAdmissionGatedControlledFs,:146 ARBITRARY_TREE_PROFILE_PUBLISHED=false,open-at-exec.ts}` | **零生产消费者**；kit 经 dist `runtime/controlled-fs/src/index.js`（W5/c0405/c08 rows）+ 根 vitest `controlled-fs/test/**`（`vitest.config.ts:26`）+ live 轮测试 plugin row | **是（运行面 kit-only）** | build：`tsconfig.build.json:33` + dist 24 文件；vitest：独立 include 行；安装面：码在、边无 | **否**——受治理 team 的文件读写仍是 host 原生工具 + 主机沙箱 + Alpha.4 权限道；C-FS 中介（deny-before-open）不在生产 | OpenAtPort 未落 ⇒ arbitrary-tree Profile 恒禁发布；PoC3 A/B/B2/C/D/E 全 PASS=fixture/子进程级；阻塞=生产 fs-seam 装配 + G-d |
| **PR4 provider（dist）** | `packages/runtime/sandbox-provider/{provider.ts:131 createConfinedProcessProvider,realm-evidence.ts:45 HARD_PROFILE_ENABLED=false,phases,fd-inheritance,network,probe-abi}.ts`；barrel `index.ts:20-26` | **零生产消费者**；运行时触达=根 vitest `a5p4-*` + **evidence kit** `evidence/alpha5/w4/a5w4-provider-row.mjs:241`（IF-1 plugin row，真 Landlock spawn 22/22 ENFORCE-CONFIRMED(subprocess)） | **是（运行面 kit-only）** | build：`tsconfig.build.json:34` + dist 32 文件（安装面内，无 import 边） | **否**——成员 bash 仍走 host 原生 dsh-tool-bash；provider spawn 路径生产零调用 | 正/负控齐（域内 EACCES 实拒、预启动 typed 拒、内核撤销对照）；阻塞=C-10 生产 glue + ENFORCE-PARTIAL + network/metadata 恒 `IO_POLICY_UNSUPPORTED` 启动前拒 |
| **PR4 生产 glue（C-10）** | 计划落点 `plugin/live/agent-bindings.mjs`（provider 侧）| **不存在**：`grep sandbox-provider packages/*/src(*.ts,*.mjs)`=0；audit allow-list 仅放行 tool-dispatch 一行（`scripts/audit-a5-tool-governance-imports.mjs:70`） | —（该面引用=0） | 无面可计 | **否** | GLUE 队列在册（C-10+C-06 生产胶水=GLUE-2/3 的后续笔，trusted-OS 锚定拆出待 PoC；GLUE-2 已落=仅 C-11+C-01）|
| **PR5 tools（a5p5）** | `packages/tools/a5p5-tools/src/{index.ts:18-21,args,pipeline,spill,render,backend-*}.ts` | **零生产消费者**（`src/index.ts` 不知该 lane，无 barrel 边）；运行时触达=①根 vitest `vitest.config.ts:27`（GLUE-2 同轮入根）②W5 evidence kit row（`wiring/w5/a5w5-assembly-row.mjs`，经 kit-local `build-lane-esm.mjs` 编译，非 committed dist）③registry 40 | **是（运行面 kit-only）** | build：`packages/tools/tsconfig.build.json:17`（emit→`packages/tools/dist`，**该 dist 不提交**）；vitest：入根=是；**安装面：否**（安装白名单仅 runtime dist+client shim，`git ls-files | grep a5p5*.js`=0）| **否**——受治理 team 的 grep/glob/bash 是 host 原生工具；Team governed search/shell 工具生产不注册 | W5 gated 34/34 + parity 字节等值 + ungated RED 对照；阻塞=安装面（committed emit 或改装配）+ 生产注册边 + registry 40 常跑 |
| **PR6 PTC（内层链）** | 无生产实现文件（`packages/` 内零 run_code/PTC 治理模块）；kit row=`evidence/alpha5/w-ptc-re/a5ptc-row.mjs` | kit：presentAs('ptc')+scoped defineTool+guard 真跑（A1 内层复入同管线逐次 Guard、A4 同名双侧 throw，#282 已合入证据）；生产 run_code=host 内置原样 | **是（kit-only）** | 无生产编译面 | **否（治理面）**——成员若被装配 run_code，执行的是 host 原生 PTC，未经 Team Grant/中介；Strict Profile 未启用（PoC-6a 分支二） | M-08=TRANSITIONED-PROBE-GATED；缺=外层 OS 强制负控并入 + 外层两半臂（下行）+ #290/#rowfix 队列未合 |
| **PR6 PTC 外层两半臂** | 无生产实现；分支 `alpha5-ptc-outer`@06c3b502（审 PASS，**未合**）、`alpha5-ptc-outerfs`@9c72769f（本地 worktree，**无 origin ref**） | 三态=**分支③ PROBE-GATED + 精确局部阻塞**：外层 fs 半臂=公开 seam 无法 per-call Grant 注入 bootstrap（SEAM-RECHECK：存在装配途径 F3×F4×F5 在册）；**net 半臂=零公开 arm、无任何 OS 覆盖**（维持局部阻塞，出路=上游词表需求，非 core patch） | **是（分支证据级）** | 无 | **否** | #296（SEAM-RECHECK+Jobs 兑现表）/#290 待合队列；COMPOSED-LIVE 收窄=仅内层执行边 |
| **PR6 LSP** | 无生产实现；kit row=`w-ptc-re/a5ptc-row.mjs`（per-member `ctx.isolate('lsp')` 重装 barrel，pid 128≠187 实测）+ `evidence/w-lsp-dr`（R-2 拟裁语义装配验证 20/20，#295 已合） | 生产成员 lsp=host 原生共享池（未 per-Member 隔离、未 Confined 中介） | **是（kit-only）** | 无 | **否**——**待答**：两项裁决已正式向用户提出未裁（R-1 streaming-pipe 启动方法 / R-2 策略⇒realm 销毁重建映射），生产接口修改冻结至答复 | M-09=TRANSITIONED-PROBE-GATED；A2=**上游 SEAM-GAP**（公开面无策略输入通道）真缺；A3/A4 等裁决 |
| **PR7 jobs-gateway** | `packages/runtime/jobs-gateway/{index.ts:33 createJobsGateway,jobs-gateway.ts,lease-window.ts,cancellation-boundary.ts,web-projection.ts}` | **零生产消费者**；运行时触达=①根 vitest `runtime/test/a5p7-*`②kit `tests/kits/a5-w7-jobs-wiring`（row 经 profile-patch 缝挂到生产 row 旁，身份读回自 durable MemberInstance；**注意**仍用 kit-local `tsconfig.lane.json` 编译，切 committed dist 是该 lane 后续笔） | **是（运行面 kit-only）** | build：`tsconfig.build.json:22`（GLUE-1 #280 已落）；dist 24 文件 committed（安装面内有码无边）；vitest：是 | **否（gateway 本体）**——**DORMANT 精确层**=「import/装配层」：源码+编译面+安装面全在，独缺生产 import 边与 live row；用户的 jobs 能力（job_output/job_list/job_kill、run_in_background）由 **host 公开 jobs 面**兑现（W7M/W7M-2：FUFILLED 层），gateway 的 owner-fence/lease 未在生产生效 | 隔离三件真钉 PASS + veto 零注册；残余=gateway 生产装配 + `job_start` absent-anchor 如实（pinned host 本无此面，非缺件）|
| **W5 search/shell 装配** | 装配 row=`evidence/alpha5/wiring/w5/a5w5-assembly-row.mjs`（gated 模式注册 governed 工具面；judgement 全来自 committed dist 的 tool-dispatch/tool-admission/controlled-fs + kit-build a5p5） | 仅 kit runner `run-w5-live.mjs`（端口/世界即删）；生产行零引用 | **是（kit-only 装配）** | 不入 root build/vitest（row 本身）；被装配的 lane 见 PR2/3/5 行 | **否** | gated 34/34 GREEN + ungated RED 对照在册；阻塞=把该行形态搬进生产 glue + a5p5 安装面 |
| **editor/read_image Team Definition 面** | 装配 row=`evidence/alpha5/wiring/c0405/a5c45-editor-image-row.mjs`（row-owned Team Definition 公开 seam 材料化→guard bind→one-shot grant→gated C-FS 真跑；undo 逐字节复原、delete/undo_all typed IO_POLICY_UNSUPPORTED）；**packages/ 内零实现**（str_replace_editor/read_image 非 dist 命中仅 contracts 封闭词表） | 仅 kit `run-a5c45-live.mjs` + registry/probe M-04/M-05 | **是（kit-only）** | 无生产编译面 | **否**——生产成员 editor/read_image=host 原生 builtin（定义在公开 seam 不可读=W-E2 实测差距保持在册）；Team-owned 治理链仅 kit | M-04/M-05 **TRANSITIONED-LIVE**（kit 判据闭环 37/37 gated + 25/37 仅红 Team 门控腿）；余项=host-native 定义 pin 面 + 生产 compile-plane |
| **PR8 矩阵+runner+registry** | 设施=`evidence/alpha5/pr8/{runner/lib.mjs,probes/probe-M-0*.mjs,matrix-machine.json}`；registry=`docs/plans/memo/alpha5-tool-io-governance/pr8-accept/e2e-skeleton/suites/registry.mjs` | registry `00-guard-dispatch`(:31)/`40-search-shell`(:67) run≠null → 懒加载 `tests/kits/alpha5-pr8-e2e/kit.mjs`（**registry 00/40 已 kit 化且 live-PASS**，#287）；10/20/30/50/60/70/90 仍 `run:null` | 设施本身=tests/evidence 工具（设计如此） | 不入生产装配（设计如此） | N/A（验收设施非用户面） | runner 27/0/0（LIVE=3 PG=2）；**Blueprint vNext(schemaVersion 4) 未实施**：`domain/blueprint/src/schema.ts:75 SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS=[3]`——PR8 的 schema 半壁是真实未做项 |
| **PR8 Blueprint vNext** | 未实施（仅 v3 封闭集在产） | 无 v4 解析路径 | — | v3 面在生产（blueprintSource 即 v3） | **否**（vNext 字段 toolBindings/IO Policies 不存在） | 计划 §11 待正式 Schema ADR；属计划内后续而非缺陷 |

## 2. gap-classify C-01..C-13（分类正本在未合分支 `alpha5-gap-classify`@9a7a0552：A=11〔含 4 无差距边界行〕/B=1〔C-12〕/C=1〔C-07〕；master 在册=差距表本体）

| 差距行 | 一句话实况（@a2473203 亲查） | 用户侧 |
|---|---|---|
| C-01 team_* 词表 | facade `packages/tools/src/tools.ts` **在生产装配**（agent-bindings `:362` selectTeamTools）；差距仅 registry 00 腿（已 run≠null） | 是 |
| C-02 SessionEvent | 零词表+p4t6 机检封禁（无差距） | N/A |
| C-03 三分身份 | contracts/runtime 生产在位（无差距） | 是 |
| C-04 editor | 见主表 editor 行（kit LIVE，生产 0） | 否 |
| C-05 read_image | 同上（kit LIVE，生产=contracts 名字 only） | 否 |
| C-06 run_code | PR6 行（无生产治理实现） | 否 |
| C-07 lsp | **唯一 C 类=上游 SEAM-GAP**（策略输入通道）+用户待答 | 否 |
| C-08 Domain/M-13 | mock 联锁三腿 kit 闭合（M-13 kit-LIVE）；gateway DORMANT；Domain 生产 compile-plane 不变 | 否（Domain 工具面）|
| C-09 job_start absent | pinned host 本无此面，absent 机检行（非缺件） | N/A |
| C-10 provider 生产 glue | **引用=0，GLUE 队列在册**（主表 PR4-glue 行） | 否 |
| C-11 search/shell | a5p5 入根 build include+root vitest（GLUE-2 同轮）但不在安装面、无生产边 | 否 |
| C-12 取消/静默 | 生产=协作式取消+响亮告警（guard dispatch 分型 + control 通知）；静默永不投递配置=UNSUPPORTED（L1 PoC 证 proven 不外推）；分类 B=三口径待用户裁 | 条件（受限支持上限 ENFORCE-PARTIAL） |
| C-13 P 系列 UI/投影 | 生产在位，与 Alpha.5 正交（无新差距） | 是 |

## 3. PR8 矩阵转态行（machine matrix @a2473203，status_now 亲读）

| 行 | status_now | 转态载体 | 生产可用性 |
|---|---|---|---|
| M-04 str_replace_editor | **TRANSITIONED-LIVE** | c0405 kit（#288，37/37） | 否（kit 判据级） |
| M-05 read_image | **TRANSITIONED-LIVE** | c0405+c08 双 kit union（#288/#285） | 否（kit 判据级） |
| M-13 Domain | **TRANSITIONED-LIVE** | W-E2+W7M kit（#283/#284） | 否（gateway DORMANT；jobs 能力经 host 公开面另兑） |
| M-08 run_code(PTC) | **TRANSITIONED-PROBE-GATED** | W8 轮+W-PTC-RE；#290/ROWFIX 未合 | 否 |
| M-09 lsp | **TRANSITIONED-PROBE-GATED** | A2=上游 SEAM-GAP 恒 PG 直至策略通道 | 否 |
| （其余 M-01..03/06/07/10..12/14） | 无转态（partial/candidate/not-run 原态；M-06/M-11/SUP-08 无构建运行时=NOT_RUN fail-closed） | — | — |
| SUP-01..18 | supersession-in-force（登记行） | — | — |

`final_declaration` 32 行恒 null（缺项评估见 ALPHA5-ACCEPTANCE-STATUS.md §3，F1-F8 无一全满足；本轮装配事实不改变该判定——生产装配仍仅 PR1 一条边）。

## 4. 三清单收束

**kit-only 清单（运行面仅 tests/kits 或 evidence kit 触达）**：PR2 kernel、PR3 C-FS、PR4 provider（含 W4 kit 全部 OS 证据）、PR5 a5p5（W5 kit + 根 vitest 源级）、PR7 jobs-gateway（tests/kits/a5-w7-*）、PTC 内层链、PTC 外层两半臂（分支级）、LSP 池（待答）、editor/read_image 治理链（c0405/c08）、Domain mock（M-13）、registry 00/40（验收设施）。

**"用户可用=是"清单（受治理 team，装插件即生效）**：PR1 guard 链+PR1r 取消分型（条件=模板声明 `capabilities.permissions`；上限 ENFORCE-PARTIAL）、PR0 代数（经 PR1）、C-01 team_* 工具面、C-03 身份面、C-12 协作式取消+响亮告警（受限支持）、C-13 P 系列；另 host 公开 jobs/web/fs 面按 host 原样（非 Alpha.5 lane 宣称）。

**最大三个生产缺口**：
1. **效应面整体未换血**：受治理 team 的文件/进程/搜索/shell/jobs 效应仍全部经 host 原生执行——PR2 one-shot Grant、PR3 C-FS（deny-before-open）、PR4 OS 强制 provider、PR5 governed tools、PR7 owner-fence 五条线零生产 import 边（guard 只是分发层完整性，不中介 effect）。
2. **a5p5 连安装面都不在**：committed 安装面只有 `packages/runtime/dist`，a5p5 emit 不落该镜像且无 barrel/注册边——即便接受 kit 装配现状，git 安装的用户产物里根本没有 governed search/shell 代码。
3. **装配收尾全在队列**：G-d 集成确认未闭、C-10 provider glue/GLUE-3 未落、jobs kit 未切 committed dist、#290/ROWFIX/#296/outer/outerfs 未合、LSP 两裁决+PTC net 半臂待用户/上游、Blueprint vNext 未实施、`final_declaration` 全 null——**当前不可对外作 Alpha.5 生产就绪宣称**。

---

## 5. 更正节（2026-10-17，P-D vnext-adr 轮；append-only，上方审计正文其余不改）

- 轮次 = `alpha5-prod-vnext-adr`；writer = qwen3.8-flash-next；基 = `origin/master @ d714a941`（fetch 亲验）。**载体说明**：本文件正本原在未合分支 `alpha5-prod-checklist @ 5bea01c6`（基 a2473203），本分支按原路径携带其**字节相同**副本（上方 §0–§4 审计正文与 5bea01c6 diff=空，亲验）+ 本节更正；两分支合并时以本文件为收敛版。
- **更正对象 = LSP 口径**（主表 PR6-LSP 行、§2 C-07 行、§4 缺口三"LSP 两裁决"行的混合表述）。原文 C-07 行『**唯一 C 类=上游 SEAM-GAP**（策略输入通道）+用户待答』把两件不同层级的事统称一个上游缺口，按在册证据更正为两分：

| 缺口 | 层级 | 事实源 | 状态 |
|---|---|---|---|
| **R-1 = C-PROC streaming-pipe 臂**（长驻双向管道/spawnStreaming 启动方法） | **本仓冻结接口缺**——差异全在 Team 自持 C-PROC 冻结形状侧（`RunOutput`/`SpawnReceipt` 无活进程句柄、无 stdin 流臂），**与上游无关**（host 公开面句柄已有 `stdin: Writable`） | `LSP-rulings-brief.md` §1（GAP gap2 verdict 原文『裁决项(非上游)』；PROV:99-109/:243/:292） | 已正式向用户提出**待答**；冻结面零触碰。其**装配等价物已验** = W-LSP-DR **20/20**（权威绿跑 `w-lsp-dr/runs/2026-10-17T05-41-03Z/`，#295 已合：公开面 `ctx.isolate`+`realm.plugin`+`dispose()` 下策略变化→销毁重建全链 20 判据 + 连续两轮四次转换零泄漏；注：该轮验证的语义面 = 拟裁 R-2 口径，对 R-1 自身臂 README §4 明示未验证——R-1 的增量仅在 C-PROC 覆盖面扩展裁决，不阻塞公开面装配） |
| **sub-realm 全键池**（池键 ⊇ …+PolicyGeneration、代际强制逐出钩子、spawn spec per-policy 参数） | **上游公开面真缺（唯一上游缺口）**：公开面无策略输入通道、无逐出钩子；realm = 公开面可表达**最细**隔离粒度 | `pr6/SEAM-VERDICTS.md` **B4:58-60**（SEAM-GAP·上游）；`w-ptc-re/probe-gap-lsp-policy.result.json` gap1 | BLOCKED 在册（`gap-classification-ABC.md` C-07=C 类所指**仅此腿**）；处置=不派工、不 patch upstream |

- **口径规则**：①『唯一上游缺口/唯一 C 类（上游）』表述**只许**指 sub-realm 全键池（B4）；②R-1/R-2 两项待答裁决 = 本仓冻结面用户裁决项，不得包装成上游阻塞；③M-09 恒 PROBE-GATED 的机检预设针对**全键粒度**腿；realm 粒度装配等价（含"策略变化→旧 PID 终止重建"形状）已由 W-LSP-DR 转 LIVE 在册，主张仍须标粒度并引 `LSP-rulings-brief.md` §3 两分表述。
- 同型澄清（防再次统称）：PTC **net 半臂**（外层网络 OS 强制）= 零公开 arm、出路=**上游词表需求**（#296 在册），与上述两腿各自独立，三者不得互为"唯一"。

— 更正节 writer = alpha5-prod-vnext-adr（qwen3.8-flash-next；只读+本文件追加；所引行号 @d714a941 树亲验）。
