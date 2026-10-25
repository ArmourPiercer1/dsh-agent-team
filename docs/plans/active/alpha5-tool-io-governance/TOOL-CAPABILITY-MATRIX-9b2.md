# TOOL-CAPABILITY-MATRIX — 逐工具能力矩阵（对 current_contract.baseline 复验轮首批实填）

<!-- phase-baseline-ref: dev/engineering/current-authority.json — 基线以该指针解析到的快照为准；本文件禁"当前 baseline"SHA 副本（tested SHA 不受限） -->
<!-- phase-identity: alpha5-tool-io-governance -->


## 头部约定（CI Q5-Q7 校验对象）

- 列序固定 ①-⑧ + `V@B`。`V@B=yes` = 该行宣称**已在 baseline 上验证**（claimed-current-verified 显式标记，行尾 `V@B` 列）；`V@B=no` = 历史 tested SHA 结论 + 适用性判断，**不宣称 baseline 复验**。
- ⑥ 格式：`类型 @testedSHA；证据=<仓内路径 或 external:/parent-confirmed 披露>；适用性=dep-diff(<该行真实依赖路径，逐行列出>)=<N/M> | NOT_VERIFIED(未比对)`。**适用性按每行自身依赖路径判定，禁止全表统一文件集外推**；未做比对=适用性 `NOT_VERIFIED`，不重跑不猜测。
- ⑧ 封闭枚举：`DONE | LIVE-CONFIRMED | ENFORCE-PARTIAL | PROBE-GATED | WIRED | WIRED-NOT-ACCEPTED | BOUNDED-DEFER | DEFERRED | UNSUPPORTED | NOT_IMPLEMENTED | NOT_WIRED | NOT_IMPLEMENTED/NOT_WIRED | NOT_VERIFIED | BLOCKED-FOR-RELEASE | NEEDS_REVALIDATION`（NOT_IMPLEMENTED=无实现，NOT_WIRED=有实现未接线，二者分立；复合行可用斜杠合写）。LIVE-CONFIRMED 必写明 scope（真实 ToolRuntime / 真实 Host / 真服务器，哪个）；"真实 Host" 结论须区分 **完整 Host / 生产 JobRegistry / ToolRuntime** 组合层次，未亲读原始 receipt 者标注并不得升格。
- 证据标记规则（CI Q5 实装口径）：⑧∈{DONE, LIVE-CONFIRMED, ENFORCE-PARTIAL, BLOCKED-FOR-RELEASE} 或 `V@B=yes` 的行，⑥ 必含 tested SHA（7-40hex）或 `external:`/`external/untracked:` 披露；其余行 ⑥ 非空即可。PROBE-GATED 行以 probe/receipt 路径为准。
- source drift（CI Q7）：baseline→HEAD 在产品 src/dist/装配面、package.json+lock、tests/paths.mjs 上的增/删/rename；有 drift 且存在 `V@B=yes` 行 ⇒ 该行 NEEDS_REVALIDATION，否则红；比较失败/对象缺失=FAIL（禁空 diff 放行）；纯 docs 提交=过。
- 本首批全部 `V@B=no`（本轮零 Host/零测试，无一行宣称 baseline 复验）。

## 矩阵（**v0 draft**；26 行=初始工具/族清单，**非全 dispatch 穷尽**；**覆盖盘点未闭合，不能作为 M0 冻结输入**；提交本身不解锁 M0；行集为预计非裁 scope；穷尽性静态目录逐名见**附录 A**（68 静态名+Team15 口径），覆盖盘点仍未闭合）

<!-- q5:main-begin -->
| ①行ID | ②合入SHA | ③baseline生产注册入口+开关/default | ④真实IO | ⑤审批链 | ⑥验证 | ⑦已知缺陷 | ⑧级别 | V@B |
|---|---|---|---|---|---|---|---|---|
| read (M-01) | #317 feed；②合入=#353 `1739b262fa0975300ad0d3e291ba72f966af828f`（②列=合入对象 1739；run 归属=dad3，见⑥） | plane `PLANE_SUPPORTED_NATIVE_TAKEOVERS.read=['read']`（team-tool-plane.mjs @9b2 亲读）；受治理 feed 含 read | 行窗口+native shape+bounded same-FD ring（#353 题注） | ask/allow 车道装配在产；行级审批正控未复验（注：ab :2335-2352=MCP native 信任排除区，非 read 审批证据，此处不引用） | ⑥实测指 **dad3**：tested 源码=@dad3d42073dea45d3c3eb35b7ae54da39284f8de（READ-slice fix"two consumers re-wired to the READ-slice face (root-directed)"），tree=`72dcb09103f27da8cb959df0c7b741af20d9b5db`，载体 tar 包 sha256=`9c9270dac562f8cf4fbf3ad0159c00f6a2ee37b753495be8474256c19390a7fe`（3,389,587B）；run 时刻=**2026-10-22 00:12:22–00:13:02 UTC**（safe-out 1,706B sha256=`4306c5c20ec273d273ccedc16c6a55070816a672e9b3371ef8085fd01f0b43d3`；member read 窗 2..11/25+footer+instance 匹配；rc=0、stop 四真、mock CLOSED）；证据=external/untracked:dev/agent-workflow/evidence/alpha5/COORDINATION.md L1136（49:Z_FS 条"dad3 pack 来源核+tar actual members 实检通过"；append-only 正本，当前未入 git=例外通道）。**时间序归属**：merge 1739b262fa0975300ad0d3e291ba72f966af828f @00:17:39Z **晚于 run**，归属由时间序自证。**tree-equivalence（另列，不并入归属句）**：`1739b262f^{tree}`=`72dcb09103f27da8cb959df0c7b741af20d9b5db`=`dad3d42073dea45d3c3eb35b7ae54da39284f8de^{tree}`＝**parent-confirmed**（不作本轮作者亲核声称）；适用性=dep-diff(plane 三件 read 装配面={agent-bindings,team-tool-plane,plane-effect-backends}.mjs)=**0/3**（实测） | 拒绝路径与 UI 维度未证 | LIVE-CONFIRMED(scope=@dad3d42073dea45d3c3eb35b7ae54da39284f8de 真实Host行窗口正控——⑥⑧实测对象=dad3；baseline 未复跑) | no |
| write (M-02) | PR3 `74d947a3`（ControlledFs，编译面） | **无 plane write takeover 行**（takeover 表无 write，同名词条 PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED 拒） | 继承面=host 原生 write；治理写面未装填 | 走原生 guard 继承（非受治理 plane 行） | 历史 fixture/host @0e0b605a（h6 HD-deny=审批链面，非写面正控）；证据=`evidence/alpha5/live/`；适用性=NOT_VERIFIED(治理写面无实现，行依赖集未成形) | 治理写 row 未生产装配；"抑制 diff 但写成功"变体未测 | NOT_IMPLEMENTED/NOT_WIRED（外层 guard 有继承绑定，plane 写臂无实现） | no |
| edit (M-03) | 同上（PR3 编译面） | 无 plane edit takeover 行 | 继承面原生 edit | 同上 | 历史 @0e0b605a（h6 H-D EDIT 每批准恰一次=审批链面）；证据=`evidence/alpha5/live/`；适用性=NOT_VERIFIED(同 write 行) | read-before-edit 语义在册；并发/冷恢复未测 | NOT_IMPLEMENTED/NOT_WIRED | no |
| str_replace_editor (M-04) | — | plane 无注册（Host 本体注册状态未亲读，**不等于 Host 未注册**） | 子命令级映射仅设计条款（S0 M-04） | 未装填 | 无 tested SHA；证据=S0 设计原文；适用性=NOT_VERIFIED(无测试) | 全谱未测 | NOT_IMPLEMENTED（治理面臂无实现；Host 层未亲读） | no |
| read_image (M-05) | — | plane 无专门挂载（Host 原生注册状态未亲读，≠Host 没注册） | 未开腿 | 未装填 | 无 PoC（S0 明文）；适用性=NOT_VERIFIED(无测试) | 全链未测 | NOT_VERIFIED | no |
| grep (M-06 native) | #354=`baseline 自身`（confined-rg 后端） | **native 同名接管=无**（takeover `grep=[]`，亲读）；confined-rg 后端属 plane/alias 链路 | 真 rg 15.0.0 进程证据=alias 后端链路效果，**不占 native 行** | host 直通；team ask 车道另计 | native 行级效果证明未做（效果测量归 team_grep 行）；适用性=NOT_VERIFIED(native 行无可归属 tested 测量) | walker 缺席时 stderr 非空代理判据洞在册（后端侧） | NOT_VERIFIED | no |
| team_grep (M-06 alias) | #330=`1a7c3c1cb`；#354 | plane `names.grep` 别名挂载（verifyPlaneNames 封闭面 @9b2 亲读） | 后端=confined-rg 真进程（r5 booked 腿在册） | 静态同类覆盖风险；本行审批闭环 NOT_VERIFIED；R2 仅 team_bash 已实际复现，不能外推本行复现 | 生产注册实证=team-tool-plane.mjs 封闭名表（@9b2 亲读）；后端效果=真实 rg 子进程 @1a7c3c1cb（fixture 级为主，历史轮）；证据=`evidence/alpha5/srgp/`；适用性=**局部装配差异** dep-diff(plane 三件)@1a7c3c1cb=3/3（实测）；**完整依赖适用性=NOT_VERIFIED**（仅比对装配三件，后端 rg 链路完整依赖集未界定） | 行级复验未做 | WIRED（生产注册实证+后端历史效果测量；行级未验收） | no |
| glob (M-06 native) | #333 翻转；#343=`d5de7497` supersedes #337 | **native 同名接管=无**（takeover `glob=[]`）；独立关断键在码 @#342 `46e48218`（亲读 team-tool-plane.mjs :662-681：缺省=默认开，显式 false=typed 关闭面） | rg/glob 后端效果属 alias/后端链路 | host 直通 | native 行级效果证明未做；关断键 unit @46e48218（RED-first 在册）；适用性=NOT_VERIFIED(native 行无可归属 tested 测量) | 判据线已由 #343 取代（BL-11 superseded）；运行复验另列 BL-19 | NOT_VERIFIED | no |
| team_glob (M-06 alias) | 同 team_grep 族 | plane `names.glob` 别名挂载（@9b2 亲读）；关断键同上在码 | 同 glob 后端族 | 静态同类覆盖风险；本行审批闭环 NOT_VERIFIED；R2 仅 team_bash 已实际复现，不能外推本行复现 | 生产注册实证（@9b2 亲读）；后端效果行级未测；适用性=**局部装配差异** dep-diff(plane 三件)@baseline 注册面=3/3（对 #330 系 tested 点）；**完整依赖适用性=NOT_VERIFIED** | 行级复验未做 | WIRED（生产注册实证） | no |
| bash (M-07 native) | #329=`1fb14c4d`(前台 takeover)；#340=`5885e46e`(取消)；#336=`fee982d2`(exit 码) | takeover `bash=['bash']`（亲读）；planeCfg 门=permissionPolicy+config.teamToolPlane | host bash 本体现态未亲读（S0 原文 `no sandbox backend is usable`=设计期文本，**不作 9b2 现态**） | durable 审批→执行=接管形已交付（#329）；ask 账本完整 | 真实Host 前台接管链 @1fb14c4d；证据=`evidence/alpha5/natexe/`；取消/exit 码臂=@5885e46e/`fee982d2` **仓内 unit/编译面证据**（`abort-cause/`、`b2-exit-code/`）；#340 不采"真 Host 通过"声称（与 real-install 验收轮 @c44f51e4 C1 RED 冲突，独立记录不混前台正控）；适用性=**局部装配差异** dep-diff(plane 三件)@1fb14c4d=3/3（实测）；**完整依赖适用性=NOT_VERIFIED**（host bash 本体未亲读） | **后台 producer 未合**（BL-17，工作区 WIP）；取消语义仅 shell 臂 | LIVE-CONFIRMED(scope=@1fb14c4d 真实Host前台接管链，历史轮；baseline 未复跑) | no |
| **team_bash (M-07 alias)** | 同 bash 族 | plane `names.bash` 别名挂载（default-ask 组合=本次 R2 具体组合） | ask 车道 | **穿透=R2** | 诊断 @工作区（未入基线）；证据=`external/untracked:dev/agent-workflow/evidence/alpha5/a9b2-approval-diag/`（w2/w5/DIAG-REPORT/R2-RECEIPT；审核来源=独立诊断轮+两独审 R2 裁决）；适用性=诊断即对 baseline 同树环境所跑；正式适用性复核待原件入册（BL-18） | **RELEASE BLOCKER**：team_bash default-ask 在真实 ToolRuntime+Guard 隔离组合下 request=0/body 哨兵=1；effect 为合成哨兵、非整 Host 线上复现，不扩大断言 | **BLOCKED-FOR-RELEASE** | no |
| pwsh (M-07) | — | 无具体接管证据 | 未证明 | — | 无 tested SHA；适用性=NOT_VERIFIED(未测) | Windows/provider 对等未证明；S0 条款"OS 支持范围外 unsupported"=设计文本非 9b2 实测，不扩大为全 provider 断言 | NOT_VERIFIED | no |
| job_list (M-11) | #349=`efb5bb55`；#300=`a53ca348`(gateway) | **固定拼写挂载** `jobs=['job_output','job_list','job_kill']`；开关 `jobsEnabled` **缺省 off**（`jobsEnabledRaw===true` 才开，非布尔 typed 拒——亲读 :687-697） | host JobRegistry 公开面 | Team owner fence 叠加 caller fence（B-ACT-1-PR C2 注释亲读） | 真实Host C3 24/24 @efb5bb55；层次=台账所记 Host+JobRegistry+ToolRuntime 组合（证据=`evidence/alpha5/jobs-isolation/` 台账本 writer 亲读；线上原始 receipt 未逐张亲读→不升格"整生产装配复现"）；适用性=**局部装配差异** dep-diff(plane 三件)@efb5bb55=2/3（实测，agent-bindings 零漂移）；**完整依赖适用性=NOT_VERIFIED**（生产 JobRegistry 本体未比对） | 分时点：owner-scoped 历史轮 NOT_RUN（原时点在册）；后续 fence 证据另时点入账（不互相覆盖）；缺省 off=未默认发布 | LIVE-CONFIRMED(scope=@efb5bb55 C3 真Host台账 24/24，历史轮；baseline 未复跑) | no |
| job_output (M-11) | #349=`efb5bb55` | 固定拼写挂载同上（亲读 :687-697） | host JobRegistry 输出面 | owner fence 叠加同上 | 真实Host C3 @efb5bb55（层次同 job_list 行；证据=`evidence/alpha5/jobs-isolation/`）；适用性=**局部装配差异** dep-diff(plane 三件)@efb5bb55=2/3（实测）；**完整依赖适用性=NOT_VERIFIED** | 同上分时点记法 | LIVE-CONFIRMED(scope=@efb5bb55 C3 台账，同 job_list 层次) | no |
| job_kill (M-11) | #349=`efb5bb55` | 同上 | kill requested≠terminated 语义保持 | 同上 | 真实Host C3 @efb5bb55（证据=`evidence/alpha5/jobs-isolation/`）；适用性=**局部装配差异** dep-diff(plane 三件)@efb5bb55=2/3（实测）；**完整依赖适用性=NOT_VERIFIED** | terminated 确认不确定在册；分时点记法同 job_list | LIVE-CONFIRMED(scope=@efb5bb55 C3 台账，同 job_list 层次) | no |
| web_search (M-10) | PR7 `fc9f4a07`（DORMANT 题注） | 无生产 provider 装配 | 搜索目标≠结果 URL 两层对象 | — | 无真实 provider 验证；适用性=NOT_VERIFIED(无测试) | 真实外网无授权=ENV_BLOCK（S0 原文） | NOT_VERIFIED | no |
| web_fetch (M-10) | 同上 | 同上 | 回环名单拒于 fetch 调用点前（fixture 10/10） | — | fixture @PR7（`evidence/alpha5/pr7/`，fixture 级）；适用性=NOT_VERIFIED(行依赖集未成形) | `WEB_BLOCKED_URL…non-public IP` fail-closed 原文；真实端点未测 | NOT_VERIFIED | no |
| run_code outer (M-08) | #334=`b6d7c48a9`（fs 半臂生产行，已合 ancestor，题注亲读）；#290 轮在册；#332=`0fa2cd76`（net-arm 上游词表缺口**登记**非本仓待办） | PTC escalation 装配在产（ab :2571-2690 亲读）；**fs 审批桥已实现合入**（#334，非未知项——旧 #290 probe 记录不覆盖之）；net/process-visibility=局部缺口（#332） | fs 半臂效果=durable ladder+one-shot grant（S1-S6 scoped）；net/process-visibility=局部缺口（#332 登记）；**整体效果保证未验** | ask 走 durable ladder+one-shot grant（五负控钉 a5ptc-escalation-row.test.ts） | fs 半臂=@b6d7c48a9（S1-S6 scoped zero-widen；证据=`evidence/alpha5/ptc-fs-impl/`、`evidence/alpha5/w-ptc-outerfs/`）；外层整行=TRANSITIONED-LIVE 撤回→**PROBE-GATED**（acceptance-matrix M-08 notes 原文）；适用性=dep-diff(plane 三件+ptc-escalation-row.mjs)@b6d7c48a9=3/4（实测） | net/process-visibility 局部缺口（#332 登记，非本仓待办）；census launcher 报告=CONFIG-DECLARED 非 OS 实测；**整体效果保证未验** | PROBE-GATED | no |
| run_code nested (M-08) | 同上（W-PTC-C2 轮） | 同上 | 内层 per-call 载荷执行边=W-PTC-C2 组合链所测边（LIVE-observed 仅限所测边；**不以 Lane C 宣称"全部内层 Landlock"**） | 同 outer | 真实Host @8eb93ddd（branch alpha5-ptc-chain 基，W-PTC-C2 组合链 22/22）；证据=`evidence/alpha5/w-ptc-c2/`；适用性=dep-diff(plane 三件+ptc-escalation-row.mjs)@8eb93ddd=4/4（实测，历史结论需重判） | CONPOSED-LIVE 收窄=仅内层边 LIVE-observed，**不构成外层防护证据** | ENFORCE-PARTIAL(scope=@8eb93ddd 内层边) | no |
| lsp (M-09) | #304=`77ffb187`；#306=`93cd7b09`（**merge 点非 tested SHA**） | P-LSP 生产面=assembly→spawnStreaming→launcher --confined-exec-stream | 真 clangd 18.1.3 + tsserver 6.0.3 最小交互 | — | 真服务器 tested 基线（现行）=master@`77ffb187` 经 `b5c06f09` 并入（其上含 #307 `eb56f805`）、本支 head `1d0d03d0` 合并后复测 30/30×2 EXIT=0；历史基线=原 30/30×2 @`7962022e`（#304 分支 alpha5-prod-lsp）；证据=`evidence/alpha5/wiring/real-lsp/`（README+runs；**非 prod-lsp fixture**）；适用性=NOT_VERIFIED（README 的逐字节 SAME 记录**仅限旧 `7962022e`→`1d0d03d0` 两历史测面之间**，**不是到 9b2**；**至 baseline 适用性未核**；不重跑） | Strict Profile/UI/族 GO 均未达；realm 粒度限定（per member×策略代际） | LIVE-CONFIRMED(scope=@1d0d03d0 合并面真 clangd/tsserver 最小交互，历史轮；族级 GO 不宣称；baseline 未复跑) | no |
| MCP stdio (M-12) | #351 系（mcp-binding） | **真 facet mount 在产**（ab :2733-2832 亲读：mcpMountAllowed/filterMcpServers/reconcile 快照）；guard 对 `mcp__` 名绑定完整性=**UNVERIFIED**（ab :2335-2352 亲读=MCP native 信任排除条款区） | 子进程 tools/call 面 | Binding 外名一律 deny（S0 M-12） | 历史 P0-1 fixture 8/8（fixture 级）；**stdio 子进程 confined 未证**（:1756-1768=streamable-http→loopback /mcp 路径证据，**不能证明 stdio**；具体 server/tool 名同样缺运行时 inventory 快照）；适用性=NOT_VERIFIED(tested 点未锚定) | 外部效果治理完整性=PR7 deferred | WIRED-NOT-ACCEPTED | no |
| MCP HTTP 动态域 (M-12) | 同上 | mount/reconcile 生产实现在册（ab :2733-2832 亲读）。枚举规则链=@9b2：配置输入 `mcp-supply.ts:33-50`（`mcpServers` 优先/否则 `mcpServer`/否则 `[]`）→ template allow 且 durable facet allowed（agent-bindings:2730-2755）→ agent scope schemas 按 `mcp__${serverName}__*` 筛（:1486-1505）→ 集合 `bindMcpTools`（:2827-2839）→ reconcile 快照闭环。**具体 server/tool 名需运行时 inventory 快照——当前缺失，不猜**；动态 server 增补→guard bind 生效性=UNVERIFIED；旧"装面无可达动态观察面"条款为记录时点，**不盖现行 reconcile/bind 代码实证**，亦不被反推为已证 | 未证 | — | 无行级 tested SHA；适用性=NOT_VERIFIED(未测) | 动态面持续重校验未证 | NOT_VERIFIED | no |
| Domain (M-13) | — | 无实现；HPC/RPC/研究状态/设备=**设计语义族，非已证注册名**（现 factory/注册未见此类固定名）；具体外部 domain 须配置/registry 补，**不造 hpc_\* 类名**；**尚未枚举缺口**=domain 工具面未定义，无逐名输入 | — | — | 无 PoC（S0 明示 NOT_RUN）；适用性=NOT_VERIFIED(无测试) | fail-closed 条款仅设计 | NOT_VERIFIED | no |
| team_* (M-14) | PR1 `db5cb5f7` 等 | own-layer 覆盖枚举在治理范围（builtinToolDeny 仅作用继承面，own-layer typed 拒在册）。**静态展开表**（矩阵审提供+@9b2 复核）：`createTeamTools` 闭集 **15 个**=tools.ts:1524-1544，入口映射 team_list_members(:498), team_list_templates(:520), team_inspect_config(:542), team_create_member(:572), team_delegate(:614), team_follow_up(:710), team_collect(:772), team_send_message(:817), team_report_progress(:856), team_request_control(:960), team_resolve_control(:1017), team_list_pending_control(:1119), team_archive_member(:1197), team_grant_permission/team_revoke_permission(:1370-1375)；9b2 接点：root.ts:3845-3874 `createTeamTools` → `teamToolsRef.current` 接 **15 固定名**；注册=agent-bindings:2436-2457（teamToolsRef 存在才循环；selective 按 capabilities.teamTools allow 名单/deny 零个；legacy 全 catalog；tool-selector.ts:30-51）。**注记**：仅定义/静态生产路线实证，**不是** 15 工具审批/功能已全验；**覆盖盘点未闭合，不能作为 M0 冻结输入**；**尚未枚举缺口**=运行时动态注入名与宿主内建面未逐名成行 | 内部状态面 | h6 公开审批面全驱动+一次性消费（历史 host） | 历史 @0e0b605a（真实Host审批链轮，证据=`evidence/alpha5/live/`）；适用性=dep-diff(plane 三件)@0e0b605a=3/3（实测，历史结论需重判） | 全 team 工具矩阵/冷恢复未测 | ENFORCE-PARTIAL(scope=@0e0b605a 真实Host审批链历史轮) | no |
| todo_write (M-14) | PR1 覆盖枚举 | **plane 保留名在册**（:405）=plane 保留名登记→治理范围内非排除项；Host 继承来源**静态注册已核**（独审直核，pin639）：`packages/todo/tool-todo/src/index.ts:135-136` 注册 `todo_write`；`:197` 无 owning agent session→拒；`docs/tool-catalog.md:44` 要求 ctx.tools+owning session、`allowParallelInProgress` 必填无默认；`base/cordis.patch.yml:430-435` 装载 tool-todo；`web-app/cordis.patch.yml:552-553` 关的是 host 面（迁 preset），**不是产品无 todo** | 状态写面 | 静态 allow 清单+清单外默认 deny | 装配行级未证；**逐工具审批/功能仍未验**；适用性=NOT_VERIFIED(无 tested SHA) | 装面腿未复验 | NOT_VERIFIED（治理归属=在册事实） | no |
| Preset/Team 自注册覆盖 (NEG-4) | bind-diag `248aff73` 系 | preset-realm 注册不达全局 tools.schemas() 面（bind-diag verdict 亲读摘录） | — | 未验证继承在 ABSTAIN 层（**从来不是 VERIFIED**，bind-diag 原文） | 三世界 17/17×3 @248aff73；证据=`evidence/alpha5/`（bind-diag 台账）；适用性=dep-diff(plane 三件)@248aff73=3/3（实测） | 无任何世界展示过 preset-realm VERIFIED 继承 | WIRED-NOT-ACCEPTED | no |
<!-- q5:main-end -->

## 附录 A — 穷尽性静态目录（v0；逐名一行；登记缺口非覆盖宣称）

**来源（钉死）**：`pin639` 官方 `docs/tool-catalog.md:18-47`；`scripts/gen-tool-catalog.ts:205-680` 对应每包 source。**65 unique=官方 catalog 条目数，非当前实例**。
**别名与 preset 事实**：`pin639 web-app/presets/standard.patch.yml:90-116` 声明 subagent、subagent_fork、subagent_codex(**disabled:true**)、subagent_claude_code(**disabled:true**)（ptc 同号；cordis :89-115）→ catalog 65 unique + 3 别名 = **68 静态名**，再加本 repo Team 15（M-14 展开表）；同名分实现/条件保留，**不强称 83 独立名**。`standard:133-136`=todo allowParallelInProgress；FS `:20-41`/bash 平台条件。`web-app/cordis.patch.yml:430-558`=关 host 面迁 preset，**非不可达**；**minimal preset 的 persistent bash/pwsh 不能继承 one-shot 测量**。
**分档**=default / opt-in / disabled（可配置开启）。**未来任意 toolName/动态 MCP=未采**（缺口句保留，不假全覆盖）。
**逐名纪律**：字段可引用主表族行共享事实，但合入/可达/IO/Host 正负/缺陷/等级**逐名明确**；证据缺在 → **UNKNOWN**；**不由目录推"已控制"或"未实现"**。**边界与完整性说明（CI Q5/Q5a 实装口径）**：主矩阵区（锚 `q5:main-begin/end`）按 9 列行契约校验；附录区（锚 `q5:appendix-begin/end`）执行最小契约=静态工具名唯一（同名+分档侧标组合唯一，同名分实现合法）、非空、引用主矩阵稳定 ID 者必须存在。**共享字段引用保证每名状态归属；静态目录完整性靠固定 pin 的目录审计；动态实例枚举未采=缺口保留**——本节不构成 Host 全集证明。

<!-- q5:appendix-begin -->
### A-1 FS
- **read** [default] — 逐名适用：主表 read(M-01) 行全部事实（②合入=#353 `1739b262f…`；⑥run 归属=dad3；行级审批正控未复验）；无另证。
- **read_image** [default] — 逐名适用：主表 read_image(M-05) 行事实；无另证。
- **write** [default] — 逐名适用：主表 write(M-02) 行事实（写面正控未复验）；无另证。
- **edit** [default] — 逐名适用：主表 edit(M-03) 行事实；无另证。
- **str_replace_editor** [独立包；装载条件待核（**default 未证**，web preset 未见声明）] — 逐名适用：主表 str_replace_editor(M-04) 行事实；无另证。
- **grep** [default] — 逐名适用：主表 grep(M-06native) 行事实（native 行级效果 NOT_VERIFIED）；无另证。
- **glob** [default] — 逐名适用：主表 glob(M-06native) 行事实（关断键 unit @46e48218）；无另证。

### A-2 shell / terminal / jobs
- **bash** [default，平台条件（FS :20-41 同系约束）] — 逐名适用：主表 bash(M-07native) 行事实；persistent 形态**不能继承 one-shot 测量**（minimal preset 口径）；无另证。
- **pwsh** [default，平台条件；one-shot 与 persistent 同名] — 逐名适用：主表 pwsh(M-07) 行事实（NOT_VERIFIED）；persistent 同上不可继承；无另证。
- **terminal_open** [opt-in] — 逐名：合入/可达/IO/Host 正负/缺陷/等级=**UNKNOWN**（主表无行；本条=缺口登记）。
- **terminal_close** [opt-in] — 逐名：**UNKNOWN**（同上，缺口登记）。
- **terminal_list** [opt-in] — 逐名：**UNKNOWN**（同上）。
- **terminal_read** [opt-in] — 逐名：**UNKNOWN**（同上）。
- **terminal_send** [opt-in] — 逐名：**UNKNOWN**（同上）。
- **terminal_signal** [opt-in] — 逐名：**UNKNOWN**（同上）。
- **job_output** [**Team plane opt-in**（jobsEnabled absent=FALSE @9b2 亲读；=team 面挂载开关，**非上游 jobs 关闭**）] — 逐名适用：主表 job_output(M-11) 行事实（@efb5bb55 台账；完整依赖适用性=NOT_VERIFIED）；无另证。
- **job_list** [同上 Team plane opt-in] — 逐名适用：主表 job_list(M-11) 行事实；无另证。
- **job_kill** [同上 Team plane opt-in] — 逐名适用：主表 job_kill(M-11) 行事实；无另证。

### A-3 lsp / web / skill / todo
- **lsp** [分档未核] — 逐名适用：主表 lsp(M-09) 行事实（SAME 仅两历史测面；至 baseline 未核）；无另证。
- **web_fetch** [分档未核] — 逐名适用：主表 web_fetch(M-10) 行事实（fixture 级；行依赖系未成形 NOT_VERIFIED）；无另证。
- **web_search** [分档未核] — 逐名适用：主表 web_search(M-10) 行事实；无另证。
- **skill** [分档未核] — 逐名：合入/可达/IO/Host 正负/缺陷/等级=**UNKNOWN**（主表无行；缺口登记；不由目录推已控制/未实现）。
- **load_workspace_dependencies** [分档未核] — 逐名：**UNKNOWN**（同上）。
- **todo_write** [default（standard:133-136 allowParallelInProgress）] — 逐名适用：主表 todo_write(M-14) 行事实（静态注册已核 pin639；**逐工具审批/功能仍未验**）；无另证。

### A-4 goal / schedule / session
- **create_goal** [分档未核] — 逐名：**UNKNOWN**（主表无行；缺口登记）。
- **get_goal** [分档未核] — 逐名：**UNKNOWN**。
- **update_goal** [分档未核] — 逐名：**UNKNOWN**。
- **schedule_create** [分档未核；live root scope] — 逐名：**UNKNOWN**。
- **schedule_delete** [分档未核；live root scope] — 逐名：**UNKNOWN**。
- **schedule_list** [分档未核；live root scope] — 逐名：**UNKNOWN**。
- **schedule_update** [分档未核；live root scope] — 逐名：**UNKNOWN**。
- **session_search** [opt-in] — 逐名：**UNKNOWN**。
- **session_trace** [opt-in] — 逐名：**UNKNOWN**。
- **session_event_read** [opt-in] — 逐名：**UNKNOWN**。
- **session_event_search** [opt-in] — 逐名：**UNKNOWN**。
- **session_event_trace** [opt-in] — 逐名：**UNKNOWN**。

### A-5 subagent / 编排
- **subagent** [别名口径见附录头（fork 计数；codex/claude_code disabled:true）] — 逐名：**UNKNOWN**（主表无行）。
- **subagent_fork** [default（3 别名之一，见附录头 preset 事实）] — 逐名：**UNKNOWN**（主表无行；缺口登记）。
- **subagent_codex** [**disabled:true**（standard.patch.yml:90-116 声明固定）] — 逐名：**UNKNOWN**（主表无行；开启条件=preset 改配置）。
- **subagent_claude_code** [**disabled:true**（同上声明）] — 逐名：**UNKNOWN**（主表无行；开启条件=preset 改配置）。
- **list_subagent_models** [分档未核] — 逐名：**UNKNOWN**。
- **interrupt_agent** [subagent 族侧] — 逐名：**UNKNOWN**；与 A-9 同名=**分实现保留**，本条只指 subagent 族侧。
- **list_agents** [subagent 族侧] — 逐名：**UNKNOWN**；同名分实现见 A-9。
- **send_message** [subagent 族侧] — 逐名：**UNKNOWN**；同名分实现见 A-9。
- **workflow** [分档未核] — 逐名：**UNKNOWN**。
- **ralph** [默认 disabled] — 逐名：**UNKNOWN**。
- **ask_user_question** [分档未核] — 逐名：**UNKNOWN**。
- **exit_plan_mode** [分档未核] — 逐名：**UNKNOWN**。
- **present** [分档未核] — 逐名：**UNKNOWN**。

### A-6 plugin / cordis / mcp-resource
- **plugin_manager** [默认 disabled/creator 条件] — 逐名：**UNKNOWN**。
- **cordis_inspect_list** [creator] — 逐名：**UNKNOWN**。
- **cordis_inspect_query** [creator] — 逐名：**UNKNOWN**。
- **list_mcp_resource_templates** [分档未核] — 逐名：**UNKNOWN**；**非动态 `mcp__` tools**（区别于 M-12 动态域，勿混算）。
- **list_mcp_resources** [分档未核] — 逐名：**UNKNOWN**；同上非动态 `mcp__`。
- **read_mcp_resource** [分档未核] — 逐名：**UNKNOWN**；同上非动态 `mcp__`。

### A-7 stagehand（experimental）
- **stagehand_act** [experimental] — 逐名：**UNKNOWN**（主表无行）。
- **stagehand_extract** [experimental] — 逐名：**UNKNOWN**。
- **stagehand_navigate** [experimental] — 逐名：**UNKNOWN**。
- **stagehand_observe** [experimental] — 逐名：**UNKNOWN**。
- **stagehand_screenshot** [experimental] — 逐名：**UNKNOWN**。
- **stagehand_tabs** [experimental] — 逐名：**UNKNOWN**。

### A-8 run_code
- **run_code** [default；mode ptc/both 仍治理] — 逐名适用：主表 run_code outer/nested(M-08) 两行**分面**事实（outer=fs 半臂+局部缺口+整体效果保证未验；nested=w-ptc fs）；mode 矩阵无另证。

### A-9 上游 experimental team 九名（默认 disabled / exact live team member）
- **interrupt_agent** [上游 team 族侧] — 逐名：**UNKNOWN**；与本附录 A-5 subagent 族侧同名分实现保留（Team15 为 team_* 命名，与本名无关）。
- **list_agents** [上游 team 族侧] — 逐名：**UNKNOWN**；同名分实现保留。
- **send_message** [上游 team 族侧] — 逐名：**UNKNOWN**；同名分实现保留。
- **spawn_teammate** [上游 team 族侧] — 逐名：**UNKNOWN**；本 repo Team15 无此名。
- **team_task_create** [上游 team 族侧] — 逐名：**UNKNOWN**。
- **team_task_get** [上游 team 族侧] — 逐名：**UNKNOWN**。
- **team_task_list** [上游 team 族侧] — 逐名：**UNKNOWN**。
- **team_task_update** [上游 team 族侧] — 逐名：**UNKNOWN**。
- **wait_agent** [上游 team 族侧] — 逐名：**UNKNOWN**。

### A-10 本 repo Team15 十五名（M-14 静态展开，逐名成行）
- **team_list_members** [入口条件=capabilities.teamTools allow 名单（注册路线见 M-14）] — 逐名适用：主表 team_* (M-14) 行**静态路线**事实（15 名展开表+9b2 接点）；**逐名审批/功能=NOT_VERIFIED**。
- **team_list_templates** [入口条件=capabilities.teamTools allow 名单（注册路线见 M-14）] — 逐名适用：主表 team_* (M-14) 行**静态路线**事实（15 名展开表+9b2 接点）；**逐名审批/功能=NOT_VERIFIED**。
- **team_inspect_config** [入口条件=capabilities.teamTools allow 名单（注册路线见 M-14）] — 逐名适用：主表 team_* (M-14) 行**静态路线**事实（15 名展开表+9b2 接点）；**逐名审批/功能=NOT_VERIFIED**。
- **team_create_member** [入口条件=capabilities.teamTools allow 名单（注册路线见 M-14）] — 逐名适用：主表 team_* (M-14) 行**静态路线**事实（15 名展开表+9b2 接点）；**逐名审批/功能=NOT_VERIFIED**。
- **team_delegate** [入口条件=capabilities.teamTools allow 名单（注册路线见 M-14）] — 逐名适用：主表 team_* (M-14) 行**静态路线**事实（15 名展开表+9b2 接点）；**逐名审批/功能=NOT_VERIFIED**。
- **team_follow_up** [入口条件=capabilities.teamTools allow 名单（注册路线见 M-14）] — 逐名适用：主表 team_* (M-14) 行**静态路线**事实（15 名展开表+9b2 接点）；**逐名审批/功能=NOT_VERIFIED**。
- **team_collect** [入口条件=capabilities.teamTools allow 名单（注册路线见 M-14）] — 逐名适用：主表 team_* (M-14) 行**静态路线**事实（15 名展开表+9b2 接点）；**逐名审批/功能=NOT_VERIFIED**。
- **team_send_message** [入口条件=capabilities.teamTools allow 名单（注册路线见 M-14）] — 逐名适用：主表 team_* (M-14) 行**静态路线**事实（15 名展开表+9b2 接点）；**逐名审批/功能=NOT_VERIFIED**。
- **team_report_progress** [入口条件=capabilities.teamTools allow 名单（注册路线见 M-14）] — 逐名适用：主表 team_* (M-14) 行**静态路线**事实（15 名展开表+9b2 接点）；**逐名审批/功能=NOT_VERIFIED**。
- **team_request_control** [入口条件=capabilities.teamTools allow 名单（注册路线见 M-14）] — 逐名适用：主表 team_* (M-14) 行**静态路线**事实（15 名展开表+9b2 接点）；**逐名审批/功能=NOT_VERIFIED**。
- **team_resolve_control** [入口条件=capabilities.teamTools allow 名单（注册路线见 M-14）] — 逐名适用：主表 team_* (M-14) 行**静态路线**事实（15 名展开表+9b2 接点）；**逐名审批/功能=NOT_VERIFIED**。
- **team_list_pending_control** [入口条件=capabilities.teamTools allow 名单（注册路线见 M-14）] — 逐名适用：主表 team_* (M-14) 行**静态路线**事实（15 名展开表+9b2 接点）；**逐名审批/功能=NOT_VERIFIED**。
- **team_archive_member** [入口条件=capabilities.teamTools allow 名单（注册路线见 M-14）] — 逐名适用：主表 team_* (M-14) 行**静态路线**事实（15 名展开表+9b2 接点）；**逐名审批/功能=NOT_VERIFIED**。
- **team_grant_permission** [入口条件=capabilities.teamTools allow 名单（注册路线见 M-14）] — 逐名适用：主表 team_* (M-14) 行**静态路线**事实（15 名展开表+9b2 接点）；**逐名审批/功能=NOT_VERIFIED**。
- **team_revoke_permission** [入口条件=capabilities.teamTools allow 名单（注册路线见 M-14）] — 逐名适用：主表 team_* (M-14) 行**静态路线**事实（15 名展开表+9b2 接点）；**逐名审批/功能=NOT_VERIFIED**。

**附录尾注**：本附录=**静态目录登记**（68 静态名口径 + Team15 + 同名分实现）；逐名行共 **86 行**=68 目录行（含 3 同名双列）+3 别名显名行+15 Team15 行——**行数≠独立名数**（不强称 83/98 独立名），不构成覆盖闭合；"未来任意 toolName/动态 MCP=未采"与"运行时 inventory 快照缺失"两句继续有效。

## 注记

1. grep/glob r1 观察=同词表机制**提示**，不占 blocker 行；R2 只占 team_bash 行（口径照抄，见该行）。
2. "历史 LIVE-CONFIRMED 不算 baseline 复验"：本表全部 V@B=no；复验轮（人工/矩阵轮触发）后逐行翻 V@B=yes 并记 tested SHA=baseline。
3. 适用性=**每行自身依赖路径**对 tested SHA→baseline 的 git diff 实测（本轮各 N/M 均为 `git diff --name-only` 现算，文件集随行而列于 ⑥ 内）；未比对行=NOT_VERIFIED；**禁止全表统一文件集外推**，禁止以适用性暗示真伪（适用性只说明历史结论离基线多远）。
4. tested SHA≠merge SHA：merge 点（如 `93cd7b09`）只在 ② 列作合入事实；⑥ 的 tested SHA 以台账实测基线为准（lsp 行=`7962022e`/`1d0d03d0`，见 ACCEPTANCE-STATUS LSP 行原文）。
<!-- q5:appendix-end -->
