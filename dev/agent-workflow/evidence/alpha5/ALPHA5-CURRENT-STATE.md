# ALPHA.5 台账当前态（ALPHA5-CURRENT-STATE）— 协调台账的当前态投影

- **整合规则**：`dev/agent-workflow/evidence/alpha5/COORDINATION.md` 保持只追加、原文不动（历史正本）；**本文件是它的当前态投影**——每行=当前状态+最新权威 SHA（`rev-parse`/`log` 现场查得，禁抄旧文档），失效行标 **SUPERSEDED** 并指回原文位置。writer=release-candidate-r1 审计员（qwen3.8-flash，只读+本文件新增）；根 20:2xZ ⑥ 单。
- **基线（现场）**：`git ls-remote origin refs/heads/master` = **`5885e46ec2bcbfa7bfa58882d835801ec8b79e1f`**（= #340 shell cancel leg，2026-10-19 04:14+08 合）。宿主 pin（`tests/paths.mjs`）=`639ed015397290b3745d163aafe02ffee4aa3f84`（0.2.0-rc.2）。

## A. master / 安装面

| 项 | 当前态 | 权威 SHA/收据 | SUPERSEDED |
| --- | --- | --- | --- |
| master 头 | #340 已合 | `5885e46ec2bcbfa7bfa58882d835801ec8b79e1f` | b6d7c48a(#334)、2d1fa21c、9116c4a6、b35b9ea7、fee982d2（链见 `release-candidate-r1/ROLLBACK-AND-TRIAL.md`） |
| 安装面计数 | **1773**（`files:` 1771+pack 2），`b6d7c48a→5885e46e` **added 0/removed 0/changed 12**（`plane-effect-backends.mjs`+a5p5-tools backend-contract/pipeline/register 族 dist 镜像） | 本文件 §A 现场 ls-tree 复算 + `release-candidate-r1/runs/` I3 族 | 1772 口径止于 `2d1fa21c`（ALPHA5-ACCEPTANCE-STATUS/CHECKLIST 内 1677/1772 数字=旧基线快照） |
| 装面三零 rootSha | @b6d7c48a = `9e421d239f6b99a6…`（missing/extra/sha=0）；@5885e46e = rc r5 腿重数（本目录 runs/） | `release-candidate-r1/runs/2026-10-18T20-03-25Z/install-manifest.json`（@b6d7c48a） | 1772 轮 rootSha `18f35295bb8c…`(tag r4-b2)/`9936ffad1825…`(r3) = 各自 SHA 的事实，非现值 |
| 部署输入 launcher | `1264ea584e3438d6d831c0c8426f5663579f638556af9376d3a6e3617e9736e3`，26992 B，**#340 未动**；abi-available/4 | `git show 5885e46e:…prelauncher.py \| sha256sum`（本会话） | `b9280090…`=pre-#338 时代回退点专用 |

## B. 治理挂载面（最新代码层 = master 现场行号；三层口径详见 `release-candidate-r1/REWORK-2026-10-18.md`）

| 线 | 当前态（代码层） | 已合证据层（现场 SHA） | 装面 profile 层 | SUPERSEDED |
| --- | --- | --- | --- | --- |
| plane 生产装配 | `team-tool-plane.mjs:76-77`（import 生产 admission/C-FS）`:447 createProductionAdmissionAssembly` `:472 createProductionControlledFsProvider`；placement feed=`agent-bindings.mjs:2460-2461` | **P-A #303=`0027c925`**（PR2/3 生产条目 197/197+installed-smoke 12/12）；**GLUE-5 #308=`bcb65eb8`**（production entry assembly replayed） | rows=[team_grep,team_glob,team_bash,read]（本轮 instance.log） | PRODUCTION-READINESS-CHECKLIST 之「PR2/PR3/PR5 零生产 import 边（DORMANT）」=@a2473203 **快照口径**，其文件头已自注基线；现行=本行 |
| PR1 guard | per-agent 装填 `agent-bindings.mjs:2261`+拒发 :2491 | `db5cb5f7`/#255；G-7 五件套 live 18/18=`0e0b605a` | M8 零装配意外 | — |
| **jobs（根点名）** | gateway 生产注入在码：`jobs-gateway-assembly.mjs:124 admitTeamJob`；`agent-bindings.mjs:443`（import）`:2474`（per-team-root 装配调用）；typed 拒 `alpha5-jobs-gateway-assembly-refused` :2484 | **P-C #300=`a53ca348`**（PR7 gateway production injection：GatewayIdentitySource admit-first gate+injected lease/definition+pin-optional reader，W7 kit on committed dist）；GLUE-1 #280=`933f2f5d`（tsconfig）；#278=`f0f5cda7`（live wiring 隔离三件） | 本轮试用 profile **未驱动 job_* 腿**（缺项=profile 层）；gateway 装配在 I5 装面 dump-config 组合内（jobs 行 `@deepseek-ai/dsh-jobs-local` 在场） | **bind-diag/README.md:96「gateway LANE remains DORMANT」= pre-#300 口径 → SUPERSEDED**（兑现表其余行 FULFILLED/BOUNDED-DEFER 判定仍现行）。整体缺项：跨 Member owner 正支（重启载体）+ job 级 cancel（≠#340 shell 行取消）=BOUNDED-DEFER 在册 |
| **LSP（根点名）** | 生产面 `createLspRealmAssembly→spawnStreaming→launcher --confined-exec-stream`（Landlock 复用 perm/lease/terminate） | **P-LSP #304=`77ffb187`**（R-1/R-2 已批：spawnStreaming on confined provider+realm policy-destroy/rebuild）；**REAL-LSP #306=`93cd7b09`**：**真实 clangd 18.1.3 + 官方 tsserver 6.0.3**，30/30×2（runs/2026-10-17T10-48-19-580Z+10-50-20-653Z，真 initialize/definition/documentSymbol/shutdown→pid OS-gone→lease terminated/策略换 pid 换+握手）；CI receipts `prod-lsp/ci-304/` | 试用 profile 未挂 lsp（preset 不挂；缺项=profile 层） | 「真实语言服务器最小交互未做」行=**已闭（#306）**；Strict LSP 维持拒=pr6/SEAM-VERDICTS.md:59/:85 现行 |
| **native 审批后执行（根点名）** | 现状时证据：placement feed 仅 plane 四行（`agent-bindings.mjs:2460` 实测 rows=[team_grep,team_glob,team_bash,read]）——**native bash 行不在 feed 覆盖内**；#334 PTC 行治理的是 plane ask→escalation→grant 梯；native bash durable 审批消费后落点仍无产品通路（`TOOL_BINDING_UNVERIFIED` 闭码=domain/tool-governance/src/errors.ts:25） | **#334=`b6d7c48a`**（PTC fs 半臂生产行：b3e99a14/c33940d4/5a4a25e7 三语义=真 durable oracle+冷启不可路由+一次性 grant；live 19/19=`E/ptc-fs-impl/runs/live-2026-10-18T15-01-38`） | 装面 census-boot pinned 行在场（I5/M7）；native 审批腿未驱动（profile 缺项） | 03:0xZ「缺口」表述**未被 #334 关闭也未被夸大**：#334 关掉 plane 世界 ask 梯，**剩余=placement feed 对 native bash 行的覆盖**（现状时行号=上）——归 native adapter/placement 线在册 |
| PTC | fs 半臂生产行（`:2412` 门构造式注册+census CONFIG-DECLARED）；net 半臂=真局部阻塞 | #334=`b6d7c48a`；登记 #332=`0fa2cd76`；W-PTC-OUTERFS #301=`23002259`=QUALIFIED L1 demo（非治理交付） | M7 census 见证 | 「PTC 无生产实现文件」=CHECKLIST 旧快照口径 |
| shell 取消/cancelled | **shell 臂已合**：host `ToolExecutionInput.signal` 上线；仅 user/parent→`cancelled:true`；优先律 exited>timedOut>aborted | **#340=`5885e46e`（现 master）** | r5 腿：无取消路径下渲染 `cancelled:false` 逐字在场（M6 语义已随码更新）；**取消腿本身装面驱动=a5ie-r5 范围**（profile 缺项） | 「cancelled 恒 false 不可达=无害现状」+「#340 整合中未合」两行 → **SUPERSEDED**（原文保留于 NOT-ACCEPTED §A-1/2） |
| shell 出口码 | exitPassthrough shell 臂 `plane-effect-backends.mjs`（#336 起） | #336=`fee982d2`；装面翻形 tag r4-b2=`b071b4f5`（未入仓在册） | M3/M5 exit=0/1 真码+落盘 | 「exit 渲染恒 0」=旧象 |
| glob | live（#333 翻转）；**洞在册**：rc 缺席时 stderr 非空=walker-error 代理判据；**#337 未合、A/B 候裁** | #333=`104b4991`；五控 50/50=`a5ie-r3`（@104b4991 基线） | I5/B/M7 在场；五控未在装面重跑（a5ie-r5 范围） | — |
| search | confined rg 行 | **#330=`1a7c3c1cb1e8ae59c43cb1fa00d4c19a8f6172e1`**（rg-parity）+`E/srgp/` | wire team_grep 在场；腿未重跑 | — |
| read | governed 行（feed rows 含 read） | #317=`E/pb-binding-feed/`；A1/A2/P1=`a5ie-r2b` | I 族+placement 见证 | — |
| blueprint v4 | 文档面 SUPPORTED=[3,4]；执行面 fail-closed（Tool Binding 验证门）+M-3=GRAMMAR-not-ACCEPTANCE | **#324=`ee49c4c0`**（flip）+`E/v4-flip/``E/schema-rev/`+ADR-vnext | 装面 v3 正控（B2/B3）；v4 负控未跑（r5） | — |
| scoped visibility | =NO on public assembly face（seam gap+3 选项裁决单**已呈待裁**） | GLUE-4 #302=`79f82441` | — | — |

## C. Gate/裁决当前态

| 项 | 当前态 | 出处 |
| --- | --- | --- |
| G-a 取消语义 | 裁决+落文 closed；行面字面刷新仍挂 **#274** | PG:14 |
| **#340** | **MERGED=`5885e46e`**（根放行后；含 X6 re-scope 注） | 现场 ls-remote+log；SUPERSEDES COORDINATION 19:4xZ「整合中」行 |
| **#337** | 未合；A/B 路**候根裁**（现头勿合） | COORDINATION 16:1xZ/16:2xZ |
| G-d | **OPEN（未开始）** | PG:17 |
| G-e | 未裁 | ALPHA5-ACCEPTANCE-STATUS |
| T-1 | **仅「v3 退役窗口」待用户裁**（双 v3/v4 并行试用期本身可运行=非必决项，根 20:2xZ 口径） | COORDINATION 08:1xZ P-D2/A-4 |
| D-1 | DEFERRED 有主（恢复三条件之一公开才解） | PG:24 |
| C12 静默保证类 | UNSUPPORTED（当前版本）已裁（A1） | `C12-decision-brief.md` |
| U1 执行面延期 **与** v4 执行面延期 | **同一延期路线的两面**（effect-queue 轮；safe-but-dark） | ADR-alpha5:101-102+authoring:168-172+GLUE-8 停针一致（02:5xZ） |
| net 半臂 | 上游词表需求登记在册（非本仓待办） | #332=`0fa2cd76`；10:4xZ |
| census 上传强化 | 待根批准独立小 PR；CI 本体零动=根裁 | 06:2xZ/06:3xZ |

## D. 验收线当前态

| 线 | 状态 | 收据 |
| --- | --- | --- |
| a5ie-r2b | 已入册（#335=`b35b9ea7`）；43/43+2 booked @0fa2cd76 基线 | `E/a5ie-r2b/runs/2026-10-18T12-14-43Z/` |
| a5ie-r3 | 在 master；50/50 @104b4991 基线（含 glob 五控） | `E/a5ie-r3/` |
| a5ie-r4-b2 | **tag `a5ie-r4-b2-evidence`=`b071b4f5` 未入仓**（重放小 PR 候） | COORDINATION 15:0xZ |
| a5ie-r5 | **备而不跑**；#340 合后全量装面复跑=现最优先验收位 | 派单 `58a7367a` |
| **release-candidate-r1（本轮）** | r1 FATAL=kit 正则（产品零红）；r2=发现 `team_delegate` 实例形 label 必填（SKILL 行文差）；r3 26/2（两红=kit 判据转义工件，红原文保留）；**r4 FATAL=fail-closed 拦到 master 漂移 `5885e46e`（设计行为）**；r5 真跑 @`5885e46e`=本目录 runs/（正则已修=④ 单） | `E/release-candidate-r1/runs/` 各 stamp |
| PTC live | 19/19 KIT_EXIT=0 | `E/ptc-fs-impl/runs/live-2026-10-18T15-01-38/` |

## E. 工具词表漂移（新发现入册；逐名三层表=`REWORK-2026-10-18.md` §⑤）

| 项 | 事实（现场） |
| --- | --- |
| 宿主 rc.2 权威词表 | `packages/core/tools/src/definitions.ts` **在 @639ed01539 不存在**；`TOOL_TYPES` 全树 grep=0；权威替代=**保证测试** `packages/core/tools/tests/gen-tool-catalog.spec.ts`（boot 全部 shipped tool 包 harvest 模型面 schema：70 条 entry/**65 唯一名**）+`packages/*/tool-*` 包枚举 |
| 钉名 vs 目录 | `PLANE_RESERVED_NATIVE`（`team-tool-plane.mjs:240-262`，drift 钉 :235-238 对 639ed01539）：**13 名未钉**={run_code, plugin_manager, schedule_create/delete/list/update, workflow, stagehand_act/extract/navigate/observe/screenshot/tabs}+反向漂移 {subagent_fork 已钉但 rc.2 catalog 无此名}。**含义**：plane 行 mount 名撞这 13 个宿主在册工具**不会被 `verifyPlaneNames` 拒**（:280 只查钉名表）——放行面而非拦截面，建议入钉名单独小件（未擅改） |
| 旧代词表 | 「TOOL_TYPES=19 + terminal_create/session_create/… + browser」= 宿主 **pre-rc.2 代**词表（@639ed01539 全树 0 命中；'browser' 仅作为平台字符串出现在测试）；旧代仓（references/deepseek-harness）**本环境不存在**，无法现场对表——不代释，请根给旧代 SHA |
| SKILL 行文差 | `team_delegate` 实例形也必填 `label`（schema 级），SKILL 行文「(create form)」易误读=docs 精确化小件（NOT-ACCEPTED §C-15；wire 原文 r2 runs/） |

## F. 环境/CI

| 项 | 状态 |
| --- | --- |
| PR 事件丢失 | 环境侧未闭；冻结证据包=`.ci-outage-evidence/CI-OUTAGE-20261018.md`（**本地未入 git**，如实）；主动通道=workflow_dispatch #326=`4573dde7`；合并门不得以本地实跑替代=根钉在册 |
| test-use 窗口 | pin=639ed01539；porcelain 0 全程（本轮 H1/C2）；窗口审计=`E/TESTUSE-WINDOW-AUDIT.md`（#294=`355d58b1`） |
