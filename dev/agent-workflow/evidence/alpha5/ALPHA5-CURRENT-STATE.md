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
| **LSP（根点名；#341-② 口径修正）** | 生产面 `createLspRealmAssembly→spawnStreaming→launcher --confined-exec-stream`（Landlock 复用 perm/lease/terminate） | **P-LSP #304=`77ffb187`**（R-1/R-2 已批）；**REAL-LSP #306=`93cd7b09`**=30/30×2（runs/2026-10-17T10-48-19-580Z+10-50-20-653Z）**按原报告分载两服务器，不得混称**：**clangd 18.1.3（`/usr/bin/clangd`）=唯一真 LSP 正例**——①真 `initialize`→`serverInfo{name:"clangd",version:"18.1.3…"}`+**31 能力键**（含 executeCommandProvider.commands=clangd.applyFix/applyTweak）②真语义请求返回真结果（`textDocument/definition`→目标文件行列真偏移；`documentSymbol`→真符号表）③`shutdown`(result:null)+`exit`→**进程自退 code=0**→`/proc/<pid>` 消失→lease=**terminated**④`policyChange`→新 pid+**新实例真握手**+答旧代不可答请求；加分腿=strict 代 clangd 自身 `Cannot open file '…/hidden.h': Permission denied` verbatim（`clangd-diagnostics-strict-vs-open.json` 双套原文）。**tsserver 6.0.3=非 LSP 正例**（原报告原文："**no LSP mode**: `grep -c '\"--lsp\"' lib/_tsserver.js`=0"，其活面=**Microsoft 官方 TS stdio JSON face**）：仅承载 **⑤cross-member 第二服务器腿**=confined 存活、独立 pid、自身面真结果（`definition`→main.ts line 1 offsets 17–30；`completionInfo`→**1042 真条目**）；**①③ LSP 协议判据不适用**。原报告自披露保持：**LSP 协议判据=单实现（clangd）背书**；hover 10s 未答/completion 慢=原文留档不计入；CI receipts `prod-lsp/ci-304/` | 试用 profile 未挂 lsp（preset 不挂；缺项=profile 层） | 「真实语言服务器最小交互未做」行=**已闭（#306，边界如上）**；Strict LSP 维持拒=pr6/SEAM-VERDICTS.md:59/:85 现行 |
| **native 审批后执行（根点名；#341-④ 精确化，全表=REWORK §④）** | 法则链=BIND-DIAG 钉线（拒⇒unattributed⇒∉全局 schemas）；feed 仅 plane 四行（`agent-bindings.mjs:2460-2461`）；闭码 producer=`grant.ts:84/:134`，**runtime/src 消费者=0**=grant 消费无产品落点 | 装配级 verbatim 两处=**已合证据**：BIND-DIAG #296=`d714a941`（bash 3 形状 6 腿矩阵；根裁归因 (i) 装配完成度、公开路径=host-plane 行）+pb-binding-feed RED（read 名，#317 后翻绿）；#334 只关 plane ask 梯 | **r6b M9 新事实（runs/2026-10-18T20-37-08Z）**：RC 形状 native bash 派发=`request-control` 被 TeamRuntime 包络门**派发前 fail-closed**（verbatim 在 REWORK §④c），**够不到执行面也到不了 binding 拒文**——与 M8 零 BINDING_UNVERIFIED 自洽；三形状矩阵成文 | 剩余三项成文（全局面形状/消费落点/feed 覆盖），归 native adapter/placement 线；**同名接管形=可达**（bash@bash/read@read 恰两对 supported，`verifyPlaneNames:269-290`），试用文档须写清 |
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
| **#337** | **方向已根准（R1+rc-first，20:12Z）实施进行中**（#341-① 刷新，非"候裁"）；**stdout 完整性门已落 `203cac85f00dcadc71df98405f87eca01a477b06`**（"#337 round-8——批准窄范围：stderr 判定零动，cap 250ms，未收口 fail-closed 到既有 walk-too-large"；**local commit 未入 master 头**=现场 merge-base 实证）；E3≠承诺候选=根 20:31Z 钉 | COORDINATION 工作树尾 19:5xZ/20:3xZ（主检出未提交尾=非入仓源，如实）；commit=现场 cat-file |
| **glob 独立关断键** | **已裁实施中**：`a5-globoff-key`@`11c246f2`（缺省不变/显式 false 走既有 typed-shut/names 改名不可恢复/无绕过/read-search-bash 零扩/RED-first+独审+CI；planeCfg 区 owner）；**新候选形=master+关断键（待绿门独审）**；E3 降格路线作废 | COORDINATION 20:31Z 裁决轮（同上源注记）；`.worktrees/a5-globoff` 在场 |
| **C-16（钉名表缺口）** | **已裁修复中**：`a5-pindir`@`68e8d70f`（钉名清单+双向漂移机检 owner；**subagent_fork 不得因 catalog 无即删、须保留/退役理由**）；两单共享文件分区互零触 | 同上 |
| G-d | **OPEN（未开始）** | PG:17 |
| G-e | **仍待用户裁（#341-③ 按最新源核实：非我方恢复）**——唯一权威源 `dev/agent-workflow/PENDING-GATES.md:18`（现 master 头行）=「原 G1/G3/G7/YAML 待裁项 | 未裁 | 不默认旧提案」；COORDINATION 01:4xZ「待用户：G-e 待裁」至今无新裁决条目（工作树尾现场 grep 实证） | PG:18 + 两账 grep 尾部 |
| scoped visibility | =NO on public assembly face（GLUE-4 #302=`79f82441`）；**3 选项裁决单已呈=待用户**（同 G-e 口径：待用户，非我方恢复） | #302 + 裁决单在册 |
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
| a5ie-r5 | **真跑进行中（#341-① 刷新，非"备而不跑"）**：分支 `a5ie-r5`@`1c490667`（merge 含 5885e46e）；`E/a5ie-r5/runs/2026-10-18T20-29-14Z/`（本审计员 21:0xZ 现场观察实况：三世界安装全绿、baseline/installed 双实例在跑〔其 baseline 用 **3184**、mock 用 **3491**——与本审计轮端口互斥见下〕、glob `anchored-glob ran legs=6 files=2`、shell `exit=not-observed cancelled=false` 腿在走、`cancel-leg.json`/`b2-exit-cross.json` 已产）；**终态以 r5 执行方回报为准** | `.worktrees/a5ie-r5/dev/agent-workflow/evidence/alpha5/a5ie-r5/runs/2026-10-18T20-29-14Z/` |
| **release-candidate-r1（本轮）** | r1 FATAL=kit 正则（产品零红）；r2=发现 `team_delegate` 实例形 label 必填；r3 26/2（两红=kit 判据转义工件，SUPERSEDED-BY-regex-fix 保原文）；r4 FATAL=fail-closed 拦到 `5885e46e` 漂移（设计行为）；**r5=28/0 GREEN @`5885e46e`**；r6 FATAL=与 a5ie-r5 真跑**端口相撞**（EADDRINUSE 3491；r5 在用 3184+3491——并发共存事实，具名清理已执行）；**r6b 换 3185/3186/3492 重跑+M9 native-bash 见证腿**（#341-④） | `E/release-candidate-r1/runs/` 各 stamp |
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
