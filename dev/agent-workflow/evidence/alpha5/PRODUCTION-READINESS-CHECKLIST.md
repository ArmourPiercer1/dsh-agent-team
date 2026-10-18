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
| **PR6 LSP** | 无生产实现；kit row=`w-ptc-re/a5ptc-row.mjs`（per-member `ctx.isolate('lsp')` 重装 barrel，pid 128≠187 实测）+ `evidence/w-lsp-dr`（R-2 拟裁语义装配验证 20/20，#295 已合） | 生产成员 lsp=host 原生共享池（未 per-Member 隔离、未 Confined 中介） | **是（kit-only）** | 无 | **否**——R-1 streaming-pipe 启动方法 / R-2 策略⇒realm 销毁重建映射 两项裁决 = **用户 07:53Z 已批准，已实施并合入（#304=`77ffb187`）**（P-D3b 同步；本行旧文『**待答**：两项裁决已正式向用户提出未裁……生产接口修改冻结至答复』= 裁决-实施前时点历史口径照录保留，两分见 §5） | M-09=TRANSITIONED-PROBE-GATED；A2=**上游 SEAM-GAP**（公开面无策略输入通道）真缺；A3/A4 口径见 §5 两分 |
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
| C-07 lsp | **唯一 C 类=上游 SEAM-GAP**（策略输入通道，仅此腿）；R-1/R-2 = 用户 07:53Z 已批准并合入（#304=`77ffb187`）——旧『+用户待答』为裁决前历史口径，两分见 §5 | 否 |
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

**kit-only 清单（运行面仅 tests/kits 或 evidence kit 触达）**：PR2 kernel、PR3 C-FS、PR4 provider（含 W4 kit 全部 OS 证据）、PR5 a5p5（W5 kit + 根 vitest 源级）、PR7 jobs-gateway（tests/kits/a5-w7-*）、PTC 内层链、PTC 外层两半臂（分支级）、LSP 池（R-1/R-2 已批已合 #304=`77ffb187`）、editor/read_image 治理链（c0405/c08）、Domain mock（M-13）、registry 00/40（验收设施）。

**"用户可用=是"清单（受治理 team，装插件即生效）**：PR1 guard 链+PR1r 取消分型（条件=模板声明 `capabilities.permissions`；上限 ENFORCE-PARTIAL）、PR0 代数（经 PR1）、C-01 team_* 工具面、C-03 身份面、C-12 协作式取消+响亮告警（受限支持）、C-13 P 系列；另 host 公开 jobs/web/fs 面按 host 原样（非 Alpha.5 lane 宣称）。

**最大三个生产缺口**：
1. **效应面整体未换血**：受治理 team 的文件/进程/搜索/shell/jobs 效应仍全部经 host 原生执行——PR2 one-shot Grant、PR3 C-FS（deny-before-open）、PR4 OS 强制 provider、PR5 governed tools、PR7 owner-fence 五条线零生产 import 边（guard 只是分发层完整性，不中介 effect）。
2. **a5p5 连安装面都不在**：committed 安装面只有 `packages/runtime/dist`，a5p5 emit 不落该镜像且无 barrel/注册边——即便接受 kit 装配现状，git 安装的用户产物里根本没有 governed search/shell 代码。
3. **装配收尾全在队列**：G-d 集成确认未闭、C-10 provider glue/GLUE-3 未落、jobs kit 未切 committed dist、#290/ROWFIX/#296/outer/outerfs 未合、LSP 两裁决已批已合（R-1/R-2 = 用户 07:53Z 批准 + #304=`77ffb187`）+PTC net 半臂=内部提案在册（出路=上游词表需求，尚未向用户正式提出）、Blueprint vNext 未实施、`final_declaration` 全 null——**当前不可对外作 Alpha.5 生产就绪宣称**。

---

## 5. 更正节（2026-10-17，P-D vnext-adr 轮；append-only，上方审计正文其余不改）

- 轮次 = `alpha5-prod-vnext-adr`；writer = qwen3.8-flash-next；基 = `origin/master @ d714a941`（fetch 亲验）。**载体说明**：本文件正本原在未合分支 `alpha5-prod-checklist @ 5bea01c6`（基 a2473203），本分支按原路径携带其**字节相同**副本（上方 §0–§4 审计正文与 5bea01c6 diff=空，亲验）+ 本节更正；两分支合并时以本文件为收敛版。
- **更正对象 = LSP 口径**（主表 PR6-LSP 行、§2 C-07 行、§4 缺口三"LSP 两裁决"行的混合表述）。原文 C-07 行『**唯一 C 类=上游 SEAM-GAP**（策略输入通道）+用户待答』把两件不同层级的事统称一个上游缺口，按在册证据更正为两分：（P-D3b 注：上方所引主表 PR6-LSP 行、§2 C-07 行、§4 缺口三行的『待答/待用户』措辞已同步为『R-1/R-2 = 07:53Z 已批准并已合入 #304=`77ffb187`』，本节所引原句为历史原文照录。）

| 缺口 | 层级 | 事实源 | 状态 |
|---|---|---|---|
| **R-1 = C-PROC streaming-pipe 臂**（长驻双向管道/spawnStreaming 启动方法） | **本仓冻结接口缺**——差异全在 Team 自持 C-PROC 冻结形状侧（`RunOutput`/`SpawnReceipt` 无活进程句柄、无 stdin 流臂），**与上游无关**（host 公开面句柄已有 `stdin: Writable`） | `LSP-rulings-brief.md` §1（GAP gap2 verdict 原文『裁决项(非上游)』；PROV:99-109/:243/:292） | **用户 07:53Z 已批准，已实施并合入（#304=`77ffb187`；实施事实见 `ALPHA5-ACCEPTANCE-STATUS.md` §1「LSP 生产装配」行测量基线）**——旧口径『已正式向用户提出**待答**；冻结面零触碰』= 裁决-实施前时点历史措辞，照录保留标注。其**装配等价物已验** = W-LSP-DR **20/20**（权威绿跑 `w-lsp-dr/runs/2026-10-17T05-41-03Z/`，#295 已合：公开面 `ctx.isolate`+`realm.plugin`+`dispose()` 下策略变化→销毁重建全链 20 判据 + 连续两轮四次转换零泄漏；注：该轮验证的语义面 = 拟裁 R-2 口径，对 R-1 自身臂 README §4 明示未验证——R-1 的增量仅在 C-PROC 覆盖面扩展裁决，不阻塞公开面装配） |
| **sub-realm 全键池**（池键 ⊇ …+PolicyGeneration、代际强制逐出钩子、spawn spec per-policy 参数） | **上游公开面真缺（唯一上游缺口）**：公开面无策略输入通道、无逐出钩子；realm = 公开面可表达**最细**隔离粒度 | `pr6/SEAM-VERDICTS.md` **B4:58-60**（SEAM-GAP·上游）；`w-ptc-re/probe-gap-lsp-policy.result.json` gap1 | BLOCKED 在册（`gap-classification-ABC.md` C-07=C 类所指**仅此腿**）；处置=不派工、不 patch upstream |

- **口径规则**：①『唯一上游缺口/唯一 C 类（上游）』表述**只许**指 sub-realm 全键池（B4）；②R-1/R-2 两项（本仓冻结面用户裁决项）= **用户 07:53Z 已批准、已实施并合入（#304=`77ffb187`）**（P-D3b；旧『待答裁决』= 裁决前历史措辞），其历史上并非上游阻塞、亦不得包装成上游阻塞；③M-09 恒 PROBE-GATED 的机检预设针对**全键粒度**腿；realm 粒度装配等价（含"策略变化→旧 PID 终止重建"形状）已由 W-LSP-DR 转 LIVE 在册，主张仍须标粒度并引 `LSP-rulings-brief.md` §3 两分表述。
- 同型澄清（防再次统称）：PTC **net 半臂**（外层网络 OS 强制）= 零公开 arm、出路=**上游词表需求**（#296 在册），与上述两腿各自独立，三者不得互为"唯一"。
- **P-D3b 同步（2026-10-17，@根 14:29Z 口径同轮 = `prod/VNEXT-SCHEMA-ADR.md` P-D3；branch `alpha5-doc-correct` @19afcae7 续一笔，父会话授权）**：本文件所有『R-1/R-2 已正式向用户提出未裁（待答）/待用户』措辞（主表 PR6-LSP 行、§2 C-07 行、§4 kit-only 清单、§4 缺口三、本节 R-1 行、口径规则②）统一改为 **『用户 07:53Z 已批准，已实施并合入（#304=`77ffb187`）』**；历史转录引文照录保留标注。声称与事实同步，**零新裁决**；C-12 行等非 R-1/R-2 口径本轮不动。

— 更正节 writer = alpha5-prod-vnext-adr（qwen3.8-flash-next；只读+本文件追加；所引行号 @d714a941 树亲验）。P-D3b 同步 = alpha5-doc-correct（qwen3.8-flash-next；markdown-only，仅上列『待答/待用户』措辞+本节注记）。

---

## 6. R2 刷新 2026-10-17T23Z（append-only；上方 §0–§5 全部按历史时点照读，本节 = 现产面总账）

- 轮次 = `alpha5-checklist-r2`；writer = qwen3.8-flash-next（一次性 worktree，本文件 markdown 追加，零历史改写）；基 = `origin/master @ 382e5fb6`（fetch + `ls-remote` 双亲验同值）。
- 口径不变：**『已交付』三条件 = master SHA + 双绿 + 独立审**；CI 未跑 = 在途；`final_declaration` 32 行恒 null（机检封死）不受本轮任何条目改变。§0 表头『安装面 = dist+shim+cordis.patch.yml，1677 dist 文件』= @a2473203 历史快照；现面（@382e5fb6 亲数）= root manifest `files` 六项：`.agents/skills`(2) + `cordis.patch.yml` + `packages/client/composition-shim`(3) + `packages/runtime/dist`(**1741** committed) + `packages/runtime/root-binding`(19) + `packages/runtime/src/plugin/upstream-resolver.mjs`——严格包面（`packages/runtime/package.json` `files:["dist"]`）自足 boot 自 GLUE-6（`35bff836`）起成立，RED-A 窗口与复验见 §6.3 末项与 §6.4。

### 6.1 已交付并验证（双绿+独审；守卫合并事实 = master 可达，双绿+独审为根 23Z 口径）

| 行 | master SHA (PR) | 现产面一句 |
|---|---|---|
| **G1 deny 单点** | `28d31f2a` (#315) | lane deny/allow 比较并入**单一原生命名空间**；template-deny 现先于 backend 触发、零副作用；success-arm pin 在册（kit 红 17/17 @ fe829038 字节、绿 16/16 @ dcf71bdb 记录见 `alpha5-g1-denyfix` 证据）。 |
| **P-B-R2 feed 生产入参** | `68deccaa` (#317) | binding feed v2 入参面（`realmId`/`bindingFeed`/`definitionIdentityOf`）落 master；governed read 正控在 live host 真实可得（kit 级；生产装配行消费方 = #321，§6.2/§6.3-4）。CI 断供后重建笔。 |
| **GLUE-6 安装面自足 + render 契约** | `35bff836` (#318) | RED-A 修复：`upstream-resolver.mjs` + `root-binding/harness/seam.mjs` 经 PLACEMENTS 字节复制进 committed 安装面、入口优先 PACKAGE-FACE 候选；`PLANE_PRESENTATION_FACE.render` 改投 `ContentBlock[]`（宿主法 `core/tools/src/index.ts:217/:1839`），修前**一切** live trio 派发死在宿主组装（`content.some is not a function`）。 |
| **V4 可逆半区** | `382e5fb6` (#316) | dormant v4 授权语法（SUPPORTED 恒 `[3]`，v4 文档仍 MISMATCH 钉死）、R1 放置 typed 面、v4 authoring maps、migration report、NEG 33/33 接线；flip 脚本 = **干跑备笔 only**，未宣布任何退役。 |
| **V4 路线** | `71af4f64` (#320) | 4-stage 表（doc-only）：stage 1–3 = ADR-Gate-normal（无需用户裁决），stage 4 **只** gate 于 T-1。 |

### 6.2 在途候选（**明标未合**，一切『已交付』宣称禁用）

- **#321 GLUE-7 = `d9a16061`**（`origin/alpha5-glue7-backend` = `refs/pull/321/head`；`merge-base` 亲验 **非** master 祖先）。内容亲验（README §1 + diff）：plane 生产 backends 装配行——`team_bash`→confined Process provider（REAL Landlock，launcher 双字节门）、`team_grep`→anchored 只读 grep（W5 argv/shaping 逐字移植）、`read`→takeover placement 携 placement-feed 行入 Guard；glob 经安全复审 FAIL 后 **un-wire 回 verbatim typed-shut pin（G6 字节还原）**，factory 归档 `未入产`。三件交付 = **TOCTOU ①(c) 闭**（read/grep-file 改 fd-句柄法 + exec-time 复核；grep-dir 残留=公开面无 OpenAtPort，如实披露）、**诚实 shut**（glob 行不装弱件）、**remap 闭**（grep fd-view 呈现改写 = PATH-FIELD ONLY，内容字节逐字呈现，G1b RED-pinned）。根 22:4xZ 口径 = round4 审 **4/4 PASS**、**待最终 SHA CI**。分支内门证据 = 全树双抓红集 9==9==已发布 9、kit 24/24、TOCTOU 复跑 8/8、drift 1733/0、p4t6 10/10。**未合 + 最终 SHA CI 未跑 ⇒ 在途。**
- **#322 glob 主候选 = `04f72c1b`**（`origin/alpha5-glob-backend` = `refs/pull/322/head`；未合）。休眠件：自足 open-time 锚定律（逐分量 O_NOFOLLOW fd + exec-time `/proc/self/fd` 复核 + 全程持柄 + 结果侧逐条验证）、17-leg native-rg parity 表、NUL 输出律（单射协议论证）、单生产者呈现律、fixture 清扫立法；46/46 绿、parity/counters 两次字节一致、typecheck EXIT=0、eslint 净。**判定 = 整体未过（根 23:05Z 更正笔；本节初稿『审 = PASS 带三集成条件』措辞作废，历史不掩：初稿原文以本节替代文在册、以 commit 史可查）**：**答题通道 PASS**——竞态腿 **6600 轮零泄露**（初稿『≥5000-iter swap-race 零泄漏』仅指答题通道）；**spill 通道 = 安全 FAIL**——**verdict 前结果流出 184/5100 泄露**，该通道不在 46/46 绿套件覆盖内。**glob 合并硬门四条（在册，缺一不可，任何单门过不算过）**：①**sink 写门控改到 verdict 之后 + 攻击复测，通道覆盖 = return / stream / spill / error 全部**（单通道绿不再算绿）；②**runtime_base `'/'` READ_DIR 收窄层协同**（名单类泄漏未闭 = 禁并，见下条与 §6.3-3）；③**allowPaths 同形装配**；④**修后在实际生产入口重新独审**（休眠件自证面 ≠ 生产审）。挂载侧事实登记（与判定无关，该支 README §6）：glue7 内联 `a5g7-confined-rg-glob` 与 `a5glb-anchored-confined-rg-glob`『两行一动词不构成合并态』，单挂载裁决归胶水笔；plane 已受 `backends.glob` 入参（`register.ts:118` fallback 被 R1 腿永久钉），一行挂载 + INSTALL-ENTRY/p4t6 复跑归集成笔。
- **runtime_base 收窄 = `8f17f579`（在跑）**。定性 = **实现走样 bug 修复**、非语义扩张——考证件亲验（#321 支 `glue7/runtime-base-probe/README.md`）：provider runtime_base 的 `'/'` READ_DIR grant **无任何授权句**（architecture.md:77 = 枚举解释器/libraries/devices 集 + "Do not accidentally expose host home"；:243 把 reads-unrestricted 列为被批评 OLD 态；:257 = "environment base readability **WITHOUT** arbitrary host-home access"）。**该 SHA 本环境不可见**（`git ls-remote` 无 ref、本地无 object）——状态取根口径，落笔即如实标。
- **v4-flip 候选 = `75388116`（在写）**。**该 SHA 本环境不可见**（无 ref、无 object），状态取根口径；其前置可逆半区已落 master（§6.1），flip 属 stage-4、只 gate 于 T-1（#320 路线表）。

### 6.3 已知未闭（逐项，含『列明不修』清单）

1. **glob 生产行未接——状态 = 『shut 诚实留待完成，PR5 未闭』（根 23:05Z 定词）**：master 与 #321 tip 的 plane glob 行都 = verbatim typed-shut pin（R1/G6 腿把 RED 文本永久钉住可查）。**PR5 ≠ 完成**：glob 半壁在 #322 休眠件里，而该件 spill 通道安全 FAIL、**合并硬门四条一项未过（§6.2）**；禁用『集成轮待办』式软措辞替代硬门。
2. **search 行 ≠ 既定 rg-parity 基线**：#321 search 行 = **grep(1)**（W5 `grepArgv` `-rIn/-rl/-rc/-E` 逐字移植）；既定基线 = 计划 PR5 行（`docs/plans/memo/alpha5-tool-io-governance/alpha5-s0-pr0-pr8-implementation-plan.md` `:33`『grep/glob R3 + 原生等价层』）与测试判据 `:132`『**真实固定 rg 版行为回归**（原生 vs Team 的结构化 value/meta/错误/binary/ignore-hidden-VCS/…）』+ 公开包根 `buildGrepCommand/resolveRgPath`（实测 rg 15.0.0）。差异在册：#322 用真 rg 并自带 parity 表，**#321 的 search 行在 rg-parity 律下无表**——grep(1) 与 rg 在 ignore/hidden/VCS、binary、错误形状上不同义，未修、不合并口径。
3. **shell 行名级枚举受 runtime_base bug 影响**：confined 启动路径 verify→launcher **string-chdir 窗口** + `'/'` READ_DIR grant ⇒ 沙箱外**名单级**（names，非字节）枚举面；#321 §4b 亲测 3/10700 名字泄漏、字节零泄漏（旧双层措辞已按 OVERSTATED 收回重写）；修复 = runtime_base 收窄（在跑，§6.2）。
4. **provider feed 装配行的 live 全链**：装配行**本身已接通**——#321 内容亲验：`agent-bindings.mjs:2228/2231`（一 realm + feed map）、`:2309-2310`（Guard 得 `realmId`+`bindingFeed` = #313 入参面首个生产调用方）、`:2409`（plane 共用同一 realm 常量，pairing 不可能漂移）、`:2440`（feed 行先于 `bindOwnTools` 交递）+ `team-tool-plane.mjs:370-471`（backends 从 `planeCfg` 生产构建）；live L1 = 真文件字节上线、"int-a5b T5 refusal gone on the assembled row"、unit G7 钉 feed 行配对。**但**『live 全链』的余下三件 = #321 合入 master、installed 严格面 INSTALL-ENTRY 复跑、最终 SHA CI 双绿——均未发生 ⇒ 未闭。
5. **skills/安装说明与真实支持矩阵仍未按 R2 面刷新**（grep 亲查、逐条列、**不修**）：
   - `.agents/skills/team-leader-operations/SKILL.md:10,33` —— 『Everything below is the **production behavior** of the closed fifteen…』而全文对效应行 `team_bash`/`team_grep`/`team_glob` **零提及**（grep=0）：该『生产行为』清单停在治理面，未含 master 面 trio typed-shut 实况，更未含 #321 在途 backends 面。
   - 同文件 `:3` description = fifteen（Alpha.4 含 grant/revoke），而宿主 skill 目录在案副本摘要仍 = **thirteen** —— 已挂载副本落后仓内正本（D-2 时代登记）。
   - `.agents/skills/team-blueprint-authoring/SKILL.md:367` —— §5.2 标题『live-verified on a **0.1.5-rc.2** host, 2026-09-14』：支持矩阵时代远落后 pin 宿主 0.2.0-rc.2 @ `639ed01539`，GLUE-6/7 时代无 live 复验记录。
   - 同文件 §2/§3（v3 封闭字段集=全语法的全部教学）—— dormant v4 语法/authoring-map/migration-report 已落（`382e5fb6`）、V4 路线已立（`71af4f64`）；SUPPORTED=[3] 故教学暂仍语义正确，但未披露可逆半区与路线，v4-flip（75388116 在写）落地即过时。
   - `README.md:123-127` —— 『Fresh-machine installability (verified in the R125 gate) … Proven end-to-end』未按 R2 刷新：#311（fe829038）已在受治理 Team 安装面实测 **RED-A** boot 崩（严格包面 `ERR_MODULE_NOT_FOUND …/upstream-resolver.mjs`），『proven』于 Alpha.5 面不成立；修复 `35bff836` 后 README 既无窗口披露、也未挂严格面复验证据（int-a5b `4552fba5`：RED-A GREEN 15/15 strict）。
   - `README.md:128-132` —— 『installs and registers in ONE command … install-surface build artifacts are committed prebuilt』：该宣称**自 `35bff836` 起**才为真；bundle-form 窗口内（files 面缺两 .mjs）单命令安装 fail-closed。README 只披露 `e832d73` 的 allowBuilds 旧窗口，未披露 RED-A 窗口。
   - `docs/INSTALL.md:109-110`（§3.1）—— 『`upstream-resolver.mjs` **无需**复制：resolve 钩子走布局候选列表（dist 或 source 均可解析）』= 与 GLUE-6 根因直接冲突的旧说法（tsc 从不发射 `.mjs`、镜像布局候选静默失效 → 严格面 boot 失败即此因）。
   - `docs/INSTALL.md:427`（§6 排障）—— 仍教『临时处置 = 从源码树拷贝 `upstream-resolver.mjs` 进依赖目录』；自 `35bff836` 该文件已在 committed 安装面（PLACEMENTS 字节复制），正确处置 = 装 ≥`35bff836` 重装，旧排障行未更。
   - **真实支持矩阵**：本文件 §2/§3 的 gap/矩阵行仍 @a2473203 时点——R2 面已使 C-10（provider glue）、C-11（search/shell）、PR4-glue、PR5、W5 各行事实移动（GLUE-5/6 已在 master、#321 在途），矩阵正本刷新归下一 PR8 轮（机检 `final_declaration` 恒 null 不变）。

### 6.4 红转绿账（INSTALL-ENTRY 30 判据 × #321 面；『应翻绿』≠『已翻绿』）

- 在册账本：recorded run @ `bcb65eb8` = **26/30**，RED = T5,T6,T7,T8（判据②成员工具执行，`install-entry/runs/2026-10-17T16-59-32Z/criteria.json` 亲读）；int-a5b 合并面（G1+P-B-R2+GLUE-6，**不含** #321 backends）复跑 = **24/30**，其更正注 `5171f599` 逐字：『**correction(int-a5b): 24/30 not all-green; T5 production provider/feed+backends assembly = real delivery gap (GLUE-7 owns); fixture legs are reachability proofs only**』——fixture 腿只证可达性，不折账。
- #321（`d9a16061`）面上**预期翻绿**：**T5**（受治理 read 正控：GLUE-7 live L1 真字节上线、『int-a5b T5 refusal gone on the assembled row』）；**T6**（team_bash template-deny 先于 backend：G1 `28d31f2a` 已在 master + #321 保持 deny-before-backend；其原 RED 的 observed 由 read binding 拒原文主导 = T5 失败链污染）；**T8**（member 终行回 Leader：read 真成功 + 真拒码 + GLUE-6 render 契约三者齐备后机械通畅）。
- **T7 不在 #321 面翻绿**（如实）：原判据文本 = 『trio effect bodies typed-shut → `IO_POLICY_UNSUPPORTED`』——其**前提**被 #321 取代（shell/grep 已是真 backend；glob 仍 shut），按原文在绿硬件上仍红；需改写为『链通 + typed 结果』形，其当前等价证据仅存于 GLUE-7 kit L2–L4（非 INSTALL-ENTRY 套件复跑，不可折账）。
- 全部翻绿**待三条件**：#321 合入 + 最终 SHA CI 双绿 + INSTALL-ENTRY kit 在合并面重跑。三条件前，唯一在册有效账本仍是 26/30（@fe829038）与 24/30（@int-a5b `5171f599`）。

— R2 刷新 writer = alpha5-checklist-r2（qwen3.8-flash-next；本文件 markdown 追加、零历史改写；所引 SHA/行号本环境 git 亲验：五交付 SHA 均为 382e5fb6 可达亲验，`d9a16061`/`04f72c1b` 为非祖先亲验，`8f17f579`/`75388116` = 无 ref 无 object 已明标取根口径；ff push 凭据缺失 → 回报 parent 代推）。
— 更正笔（根 23:05Z）= 同 writer 同分支续笔：§6.2 #322 判定改为**整体未过**（答题通道 6600 竞态零泄露 PASS + **spill 通道 verdict 前流出 184/5100 = 安全 FAIL**），初稿『审 PASS 带三集成条件』作废，**glob 合并硬门四条**明列（①sink 写门控 verdict 后修复+攻击复测覆盖 return/stream/spill/error 全通道 ②runtime_base `'/'` READ_DIR 收窄层协同 ③allowPaths 同形装配 ④修后在实际生产入口重新独审）；§6.3-1 状态定词 =『shut 诚实留待完成，PR5 未闭』，软措辞禁用。判定数字与硬门条文取根 23:05Z 口径（根/审查报告未 commit 本仓，此处为转录登记）。

---

## R3 刷新（2026-10-18T05:0Z，append-only @ master `ee49c4c0`；writer = 协调者本人，根 04:34Z 派第 9 条矩阵项）

### 7.1 交付行（SHA + ancestor 亲验于 origin/master）

| 行 | 头 | 判定要点 |
| --- | --- | --- |
| runtime_base '/' READ_DIR 收窄（bug 修复） | `0e59140b`（#323） | round-5 独审 + 双 CI；stat-probe 残余披露在册 |
| R2 checklist 更正笔 | `d5f78b58`（#325） | §6.2 #322 整体未过；本文件上笔 |
| CI workflow_dispatch 触发件 | `7ab56dbf`（#326） | 事后独审 PASS（ecf68fe7 亲验 +2 行门语义零动）；**合并前独审缺失=偏差，永久在册** |
| v4 flip（schema {3,4} + formal ADR） | `ee49c4c0`（#324） | 内容审(a7a1cfd2)+最终头增量审(05361fc7)+双 CI×2；**document-face 限定**：parse/freeze/hash+14/14 live leg；lanes 不执行、dispatch 在 Tool Binding verification gate fail-closed；执行 feed=后段 |

### 7.2 在途候选（合并=逐 PR 根确认制，根 04:13Z）

- **#322 glob 行**：判面 `ee9b30d5`（round1-7 链+ecf68fe7+ba398cca 法册复核）；census 交互修复 `8681c3a0`（三 law 具名册改写=牙未换，红形实证在册；pace 礼让默认律不变）；恢复 merge-sync `b78aef3f`（04:36:45Z force-push 偏差的正向恢复，ff-pushed，四门在跑）。
- **#327 docsync-r2** `7c0e70b8`：独审 round-2 PASS；双 CI 全绿；候根放行。
- **srgp**（search rg-parity）`f0831531`+补修中：独审=补充内容（无阻塞）；必办=fixed_string/ignore_case 按名拒+目录 root-identity 臂+内核拒 summary 腿（mount-flip 前必关）。面发现入册：**confined 面无 payload exit code**（shell 行报的 exit 是 launcher 的——后续行不得再报）。
- **natexe**（native 审批后执行）`b0b49761`：takeover 配置 26/26 双世界=配置级证据；**缺口闭合宣告需**：真实安装/创建路径可达性+用户文档+无 takeover 旧配置仍拒存续+防同名冒充——补单在途（根 04:34Z）。**在此之前"native 批准后执行"仍是真实可用性缺口**，不以本行注销。
- **int-mnt r2**：基 master `ee49c4c0` 同步+全链终验在跑（f1e64a1e）。
- U1（toolBindings 运行消费者）=具名延期（S0 原文承诺 vs 后段 ADR 分列在册），**非用户待裁**。

### 7.3 矩阵（九条 docs 项，根 03:40Z 要求测量范围纠正保留）

| # | 项 | 状态 |
| - | --- | --- |
| 1-8 | leader-ops/blueprint/README/INSTALL 八项 | docsync r1 修、r2 复审 PASS（README {3,4} 按 `ee49c4c0` 合后现实+document-face 三限定；**RED-A 两面分列**：strict 包面 RED 实录 vs 根 git-dep manifest 面 GREEN，永不互串） |
| 9 | 本矩阵刷新 | 本笔交付（R3） |

### 7.4 偏差账（永久，根 04:01/04:13Z 裁定）

1. #326 合并前无独审（内容事后 PASS 保留不回滚；当时流程不合规）。
2. #322 分支 04:36:45Z force-push（1257963e→8681c3a0，丢两枚非 gated merge-sync 修复笔；正向恢复 `b78aef3f`；判面 blob 未损）。

— R3 writer = 协调者（qwen3.8-flash-next）；markdown 追加、零历史重写；红绿全部指向可复跑证据路径而非转述。

> 注记（独审 3ebfdceb 两条 MINOR 的当轮处置，append-only）：(1) 矩阵第 9 条闭合**不改变** §2/§3 正本仍 @a2473203 时点的事实——正本矩阵刷新归 PR8 轮；且 `ee49c4c0` 后 §1 的「Blueprint vNext 未实施 / SUPPORTED=[3]」行已与现产面冲突，同归 PR8 轮正本刷新，此处只作指向注、不改正文。(2) 本节内的 ecf68fe7/ba398cca/06e6bff5/852048e3/f1e64a1e 等 = 评审/worker **会话号（handle）**，非 git 对象、origin 无 ref；其根口径以本目录 COORDINATION.md 与 SESSION_ROUTER_LOG 落仓为准；凡标 SHA 者方可 git 亲验。(3) 头注时间为 wave 钟（约），committer 时刻以 git 为准。

---

## R4 刷新（2026-10-18T≈09:0Z，wave 钟；append-only @ master `15481988`；writer = docs 轮 `docs-a5r4`，qwen3.8-flash-next；committer 时刻以 git 为准）

- 基 = `origin/master @ 154819881c81`（fetch + rev-parse 亲验；其父 `1fb14c4d`、祖 `b90aad2a`/`ee49c4c0` 均可达亲验）。上方 §6=R2、§7=R3 全部按历史时点照读，本节零历史改写；R3 注记(3)（wave 钟/committer 时刻以 git 为准）沿用。

### 8.1 三轨覆盖表（要点版；基线 master@`15481988` 亲查）

| 轨 | 现势要点（本笔 git 亲验面） |
|---|---|
| **原生治理面**（宿主原生拼写在治理世界的审批后执行） | **闭合（限定式）**：#329=`1fb14c4d` 已合 master——takeover 行 + Gate 0b `verifyPlaneNames` 封闭挂载名域；原生保留名 = **53 精确注册名 + `mcp__` 前缀族穷尽表**（钉宿主 `0.2.0-rc.2@639ed01539`，漂移钉测强制重导出后方可移 pin）+ **216 格全矩阵**（54 拼写 × 4 行，可执行重放 `natexe/matrix-reserved-native.mjs`）；live kit 26/26 双时代 + GLUE-8 零回归 20/20+15/15。闭合范围限定句已入 `docs/INSTALL.md` §3.5 末（本轮①）：**闭合=限明确安装配置（cordis.patch.yml §3.2 takeover 行），不代表全工具总验收**；缺省无平面世界 A4.4 拒逐字存续 |
| **协调 15 工具**（`team_*` 协调面） | 本轮**零移动**：facade `selectTeamTools` 生产装配在位（C-01 行维持），registry 00 live-PASS 维持；R2/R3 各协调面结论不改 |
| **效应面**（read/grep/glob/bash 效应行） | **read/grep/bash 真 backend 已在 master**：committed dist 带 `live/plane-effect-backends.mjs`，git 首见 = `0e59140b`(#323)（其 squash 正文含 `feat(alpha5-glue7): production backend assembly…glob stays typed-shut` 诸笔）；**glob 供体已合**（#322=`15481988`，休眠件 `live/glob-backend.mjs` 970 行入树、零挂载边）**但 mount flip 未翻**：生产 glob 行仍 verbatim typed-shut pin；**allowPaths 同形 + internalLog 不外显两条件 = 待 int-r3 真实入口验收**（根口径；本仓无该两回执）。**search 线 rg-parity = 在制**：远端 `alpha5-srgp` tip=`69f4334e`（round-2 补修，parent `f0831531`），非 master 祖先亲验；远端已存在 `refs/heads/alpha5-srgp-pr2`=`7745dde5`（replay『onto master 15481988』，非 master 祖先亲验），未合 ⇒ 『在制』判定不变；合入前以 ls-remote 现值复核，勿钉本行数字 |

### 8.2 状态行（对照 §6.2/§7.2 在途清单的增量）

| 线 | R2/R3 口径 | R4 实况（亲验） |
|---|---|---|
| natexe | §7.2『补单在途，缺口闭合宣告需四件』 | **已合 `1fb14c4d`**（#329）：四件中 真实安装/创建路径可达性+用户文档（INSTALL §3.5）+无 takeover 旧配置仍拒存续（A4.4 verbatim，N1 零回归律钉）+防同名冒充（Gate 0b + 216 格矩阵）逐件落面；『native 批准后执行』可用性缺口由**限定式闭合**替代（限定见 §8.1 首行） |
| glob 供体 | §6.2『#322 整体未过 + 硬门四条』、§7.2 判面链在途 | **已合 `15481988`**（#322 squash；源支 tip `8747d331` ls-remote 亲验、非祖先——载体=squash）。合入判定与硬门四条的历史条文不撤销：合的是**休眠供体**，生产翻挂归 int-r3（两条件见 §8.1 效应面行） |
| search（srgp） | §7.2『f0831531+补修中，独审=补充内容』 | **仍在制（判定不变）**：远端 `alpha5-srgp`=`69f4334e`（round-2：knob drop + coverage blind spot，审查序①②③）；**远端已存在 `refs/heads/alpha5-srgp-pr2`=`7745dde5`**（replay：『replay the PR onto master 15481988 — two laws carried, every booked number re-measured』，非 master 祖先亲验）；合入前以 **ls-remote 现值复核**（本行数字为 R4 时点快照） |

### 8.3 差异登记（本轮只登记，不改 §6/§7 原文）

1. **install-entry 账本两处未对齐 + 既有引用偏差一笔**：**26/30 仅 run-2（`runs/2026-10-17T17-06-56Z`）**——criteria 30 条、26 过、RED=T5,T6,T7,T8 亲数；`expansion-manifest.head=bcb65eb8` 亲读；`@fe829038` = §6.4 末行的在册挂名口径（run-2 在档文件内无 fe829038 字段，亲查）。**run-1（`16-59-32Z`）= 中断 partial 19/23**（亲数：criteria 仅 23 条、19 过、RED=T5-T8；`world-team.partial.json` 在档；baseline/gatered/refuse 腿日志缺失 = run 中断实证；根侧『boot 崩栈』口径之崩栈**不在** run-1 在档文件，原回执候根侧）。**既有引用偏差登记：§6.4 L133 把 26/30 回执引向 run-1 目录**（其『criteria.json 亲读』注指向 `16-59-32Z`，而该 criteria 实测为 23 条/19 过）——§6.4 原文不改，此处指向注。另 §6.4 引 int-a5b 复跑 **24/30**（更正笔 `5171f599`，在 `origin/alpha5-int-a5b`，未合，未走 master 在册通道）：仓内 recorded 面与 checklist 引用面哪一面对外生效待根裁。（本条 R4 初稿曾把两 run 合写『均 26/30』= 本笔就地更正，run-2 独证 26/30、run-1 实为 19/23 partial；更正经根单 09:2xZ。）
2. **E1 判据文本漂移**：kit `install-entry/a5ie-install-kit.mjs` 硬编码 `fileCount === 1732 && a5p5Files === 44`（判据文本另含『dist mirror (1727)』『44-file a5p5, 3 glue placements』；criteria.json @bcb65eb8 在册 observed=`files=1732 a5p5=44 glue=[true,true,true]`）。本轮于 `15481988` 面**亲数**= `1747-44-3`：aux 面 = dist 1742 + package.json 1 + 两 sibling 2 + `.agents/skills` 2 = **1747**；a5p5 dist-mirror 面 = **44**；kit glue 名单仍 **3** 文件（而 `scripts/place-dist-glue.mjs` `PLACEMENTS` 实已 **6**，int-mnt@`342b266c` 面 =7）⇒ E1 在今树因硬编码字面量即 RED = **判据文本漂移**，非安装面回归。链侧口径记 **1747-46-4**：其中 46/4 两格本环境在任何可见 ref 上均不可复现（`15481988`=1747-44-3；int-mnt@`342b266c`=1748-44-3；srgp 线 `c2172549`=1748-44-3、`f0831531`/`69f4334e`=1749-44-3，均亲数），原回执候根侧材料补入后对齐；files 格 1747 两侧一致。
3. **§6.2『GLUE-7 在途』过期**：§6.2 记 #321=`d9a16061`『非 master 祖先 ⇒ 在途』——**内容事实已变**：GLUE-7 交付面（plane 生产 backends 装配 + committed dist `live/plane-effect-backends.mjs` + agent-bindings feed 行 + p4t6 booking）已随 **#323=`0e59140b`** squash 载体落 master（首见笔亲验：`.../live/plane-effect-backends.mjs | 736 ++`；正文含 glue7 诸提交与 `dist mirror same commit (6th byte-placement)`）；`d9a16061` tip 本身仍非祖先（亲验）——**载体≠分支**，在途判定当时成立、现已过期。§6.3-4 的『live 全链余三件』据此重读：#321 内容合入=已完成件，余 INSTALL-ENTRY 严格面复跑 + 最终 SHA CI 两件。

### 8.4 债账追加（永久）

1. **产物封印缺口（census workflow）**：re-grade 步读 `$RUNNER_TEMP/census-run.txt` 出 verdict，Upload 步在其**后**另行收集 `census-run.txt` + `census-transcripts/`——两步之间若再发生截断类事故，**入库 artifact ≠ 被定级转写本**（verdict 对 artifact 无哈希封印）。闭合需 workflow 改动（从已上传 artifact 定级，或上传前 hash-seal 并回验）= 需特批的工作流改动，本轮不修、只登记。
2. **351/3600 = root-register 归因数字**（glob spill 通道归因口径）：本仓无原始回执可对（R3 注记(2) 同族），原回执定位候根侧材料。
3. **『FULL stdout』注释漂移**（`.github/workflows/census-runtime.yml` 旧注释 vs `scripts/ci-pr-gate.mjs` 的有界回显实现 ECHO_LINE_LIMIT=200/ECHO_LINE_CAP=300/ECHO_BYTE_CAP=24000/`FORENSIC|MEASURED` 命中律）= **由本轮②注释笔关闭**（纯注释，机检语义零动；限额取 ci-pr-gate.mjs 该文件亲读值，非转录）。

— R4 writer = docs-a5r4（qwen3.8-flash-next；markdown 追加、零历史改写；本轮 diff = `docs/INSTALL.md` 一句 + `census-runtime.yml` 注释块 + 本节，产品码零动；p4t6 实测见回报；未 push）。
