# TOOL-CAPABILITY-MATRIX — 逐工具能力矩阵（对 current_contract.baseline 复验轮首批实填）

<!-- phase-baseline-ref: dev/agent-workflow/graph.yaml#current_contract — 基线以此字段为准；本文件禁"当前 baseline"SHA 副本（tested SHA 不受限） -->

## 头部约定（CI Q5-Q7 校验对象）

- 列序固定 ①-⑧ + `V@B`。`V@B=yes` = 该行宣称**已在 baseline 上验证**（claimed-current-verified 显式标记，行尾 `V@B` 列）；`V@B=no` = 历史 tested SHA 结论 + 适用性判断，**不宣称 baseline 复验**。
- ⑥ 格式：`类型 @testedSHA；证据=<路径或 external/untracked:披露>；适用性=dep-drift(→baseline)=<N/3 装配面文件>`。dep-drift 实测=`git diff --name-only <testedSHA> <baseline> -- packages/runtime/src/plugin/live/{agent-bindings,team-tool-plane,plane-effect-backends}.mjs` 命中数（本轮已逐行实测，非估算）。
- ⑧ 封闭枚举：`DONE | LIVE-CONFIRMED | ENFORCE-PARTIAL | PROBE-GATED | WIRED | WIRED-NOT-ACCEPTED | BOUNDED-DEFER | DEFERRED | UNSUPPORTED | NOT_IMPLEMENTED/NOT_WIRED | NOT_VERIFIED | BLOCKED-FOR-RELEASE | NEEDS_REVALIDATION`。LIVE-CONFIRMED 必写明 scope（真实 ToolRuntime / 真实 Host / 真服务器，哪个）。
- source drift（CI Q7）：baseline→HEAD 在产品 src/dist/装配面、package.json+lock、tests/paths.mjs 上的增/删/rename；有 drift 且存在 `V@B=yes` 行 ⇒ 该行 NEEDS_REVALIDATION，否则红；比较失败/对象缺失=FAIL（禁空 diff 放行）；纯 docs 提交=过。
- 本首批全部 `V@B=no`（本轮零 Host/零测试，无一行宣称 baseline 复验）。

## 矩阵（26 行；行集为预计非裁 scope）

| ①行ID | ②合入SHA | ③baseline生产注册入口+开关/default | ④真实IO | ⑤审批链 | ⑥验证 | ⑦已知缺陷 | ⑧级别 | V@B |
|---|---|---|---|---|---|---|---|---|
| read (M-01) | #317 feed；#353=`1739b262f` | plane `PLANE_SUPPORTED_NATIVE_TAKEOVERS.read=['read']`（team-tool-plane.mjs @9b2 亲读）；受治理 feed 含 read | 行窗口+native shape+bounded same-FD ring（#353 题注） | guard 绑定+ControlService ask/allow 链在产（ab :2335-2352 区亲读） | 真实Host+Unit @1739b262f；证据=PR#353 commit 正文+`evidence/alpha5/`（README 索引待补）；适用性=dep-drift=**0/3**（#354 仅动 confined-rg 后端，装配三件零漂移） | 拒绝路径与 UI 维度未证 | LIVE-CONFIRMED(scope=@1739b262f 真实Host行窗口正控；baseline 未复跑) | no |
| write (M-02) | PR3 `74d947a3`（ControlledFs，编译面） | **无 write takeover 行**（takeover 表无 write，同名词条 PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED 拒） | 继承面=host 原生 write；治理写面未装填 | 走原生 guard 继承（非受治理 plane 行） | 历史 fixture/host @0e0b605a(h6 HD-deny)；适用性=dep-drift=3/3 | 治理写 row 未生产装配；"抑制 diff 但写成功"变体未测 | NOT_IMPLEMENTED/NOT_WIRED（外层 guard 有继承绑定，plane 写臂无实现） | no |
| edit (M-03) | 同上（PR3 编译面） | 无 edit takeover 行 | 继承面原生 edit | 同上 | 历史 @0e0b605a(h6 H-D EDIT 每批准恰一次)；适用性=3/3 | read-before-edit 语义在册；并发/冷恢复未测 | NOT_IMPLEMENTED/NOT_WIRED | no |
| str_replace_editor (M-04) | — | 无注册 | 子命令级映射仅设计条款（S0 M-04） | 未装填 | Unit 无；证据=S0 原文；适用性=n/a | 全谱未测 | NOT_IMPLEMENTED | no |
| read_image (M-05) | — | 无注册 | 未开腿 | 未装填 | 无 PoC（S0 明文）；适用性=n/a | 全链未测 | NOT_VERIFIED | no |
| grep (M-06 native) | #330=`1a7c3c1cb`；#354=`baseline 自身` | confined-rg 后端在 runtime（#354 题注）；team plane grep native 同名**不支持**（takeover grep=[]） | rg 15.0.0 真进程（r5 booked 腿在册） | host 层；team ask 车道另计 | fixture+真rg @1a7c3c1cb；证据=`evidence/alpha5/srgp/`；适用性=dep-drift=3/3（#354 即 baseline，取消协作腿 self） | walker 缺席时 stderr 非空代理判据洞在册 | LIVE-CONFIRMED(scope=@1a7c3c1cb 真实 rg 子进程，fixture 级为主；baseline 未复跑) | no |
| team_grep (M-06 alias) | #330 家族；plane names 映射 | plane `names.grep` 别名挂载（verifyPlaneNames 封闭面亲读：grep/glob/bash+read） | 同 grep 族 | ask/allow lane 经 ControlService | 生产注册实证=team-tool-plane.mjs 封闭名表+feed；适用性=3/3 | 行级复验未做 | **WIRED**（生产注册实证；非验收等级） | no |
| glob (M-06 native) | #333 翻转；#337 判据线；#354 | 同 confined rg/glob 后端 | glob 结果面 | host 层 | 历史轮 @#333/#337 系；适用性=3/3 | 关断键候门（BL-10）；判据线收口 needs-revalidation（BL-11） | NEEDS_REVALIDATION | no |
| team_glob (M-06 alias) | 同 team_grep 族 | plane `names.glob` 别名挂载 | 同 glob 族 | 同 | 生产注册实证同上；适用性=3/3 | 行级复验未做 | **WIRED** | no |
| bash (M-07 native) | #329=`1fb14c4d`(前台 takeover)；#340=`5885e46e`(取消)；#336=`fee982d2`(exit 码) | takeover `bash=['bash']`（亲读）；planeCfg 门=permissionPolicy+config.teamToolPlane | 本宿主 bash body 现态=宿主自身 fail-closed（S0 原文 `no sandbox backend is usable`）；takeover 臂在册 | durable 审批→执行=接管形已交付（#329）；ask 账本完整 | 真实Host @1fb14c4d/#340；证据=`evidence/alpha5/natexe/`、`abort-cause/`；适用性=dep-drift=3/3 | **后台 producer 未合**（BL-17，工作区 WIP）；取消=#340 语义仅 shell 臂 | LIVE-CONFIRMED(scope=@1fb14c4d 真实Host前台接管链+@5885e46e 取消；baseline 未复跑) | no |
| **team_bash (M-07 alias)** | 同 bash 族 | plane `names.bash` 别名挂载（default-ask 组合=本次 R2 具体组合） | ask 车道 | **穿透=R2** | 诊断 @工作区（未入基线）；证据=`external/untracked:dev/agent-workflow/evidence/alpha5/a9b2-approval-diag/`（w2/w5/DIAG-REPORT/R2-RECEIPT；审核来源=独立诊断轮+两独审 R2 裁决）；适用性=诊断即对 baseline 线跑 | **RELEASE BLOCKER**：team_bash default-ask 在真实 ToolRuntime+Guard 隔离组合下 request=0/body 哨兵=1；effect 为合成哨兵、非整 Host 线上复现，不扩大断言 | **BLOCKED-FOR-RELEASE** | no |
| pwsh (M-07) | — | 无具体接管证据 | 未证明 | — | 无；适用性=n/a | Windows 对等未证明（S0 显式 OS Unsupported） | UNSUPPORTED | no |
| job_list (M-11) | #349=`efb5bb55`；#300=`a53ca348`(gateway) | **固定拼写挂载** `jobs=['job_output','job_list','job_kill']`；开关 `jobsEnabled` **缺省 off**（`jobsEnabledRaw===true` 才开，非布尔 typed 拒——亲读 :689-697） | host JobRegistry 公开面 | Team owner fence 叠加 caller fence（B-ACT-1-PR C2 注释亲读） | 真实Host @efb5bb55（C3 24/24 on REAL host）；证据=`evidence/alpha5/jobs-isolation/`；适用性=dep-drift=2/3（agent-bindings 零漂移） | owner-scoped 历史 NOT_RUN；缺省 off=未默认发布 | LIVE-CONFIRMED(scope=@efb5bb55 C3 真Host 24/24；baseline 未复跑) | no |
| job_output (M-11) | 同上 | 同上 | 同上 | 同上 | 同上；适用性=2/3 | 同上 | LIVE-CONFIRMED(同 scope) | no |
| job_kill (M-11) | 同上 | 同上 | kill requested≠terminated 语义保持 | 同上 | 同上；适用性=2/3 | 同上 + terminated 确认不确定在册 | LIVE-CONFIRMED(同 scope) | no |
| web_search (M-10) | PR7 `fc9f4a07`（DORMANT 题注） | 无生产 provider 装配 | 搜索目标≠结果 URL 两层对象 | — | 无真实 provider 验证；适用性=n/a | 真实外网无授权=ENV_BLOCK（S0 原文） | NOT_VERIFIED | no |
| web_fetch (M-10) | 同上 | 同上 | 回环名单拒于 fetch 调用点前（fixture 10/10） | — | fixture @alpha5-adapter-p0/09-web；适用性=n/a | `WEB_BLOCKED_URL…non-public IP` fail-closed 原文；真实端点未测 | NOT_VERIFIED | no |
| run_code outer (M-08) | #290 轮在册 | PTC escalation 审批装配在产（ab :2571-2690 亲读；非 Team 装面零注册+逐字委托 ask） | 整行默认姿态 typed 拒（workspace-write fail-closed） | ask 走 durable ladder+one-shot grant（五负控钉 a5ptc-escalation-row.test.ts） | 行级=TRANSITIONED-LIVE 撤回→**PROBE-GATED**（acceptance-matrix M-08 notes 原文）；适用性=3/3 | 外层 per-call Grant 注入公开 seam 缺失=精确局部阻塞原文；census launcher 报告=CONFIG-DECLARED 非 OS 实测 | PROBE-GATED | no |
| run_code nested (M-08) | 同上 | 同上 | 内层 per-call 载荷执行边=Lane C 受限 provider/真 Landlock launcher | 同上 | W-PTC-C2 组合链真跑 22/22；适用性=3/3 | CONPOSED-LIVE 收窄=仅内层边 LIVE-observed，**不构成外层防护证据** | ENFORCE-PARTIAL(scope=@W-PTC-C2 内层边) | no |
| lsp (M-09) | #304=`77ffb187`；#306=`93cd7b09` | P-LSP 生产面=assembly→spawnStreaming→launcher --confined-exec-stream | 真 clangd 18.1.3 最小交互（历史轮） | — | 真服务器 @93cd7b09（30/30×2，2026-10-17）；证据=`evidence/alpha5/prod-lsp/`；适用性=3/3，**属历史测试非 baseline 重测**；tsserver=另一 stdio server 不计第二验证 | Strict Profile/UI/族 GO 均未达 | LIVE-CONFIRMED(scope=@93cd7b09 真实 clangd 最小交互，历史轮；族=BOUNDED-DEFER 姿态未翻) | no |
| MCP stdio (M-12) | #351 系（mcp-binding） | **真 facet mount 在产**（ab :2733-2832 亲读：mcpMountAllowed/filterMcpServers/reconcile 快照）；guard 对 `mcp__` 名绑 **UNVERIFIED**（:2335-2352 亲读） | 子进程 tools/call 面 | Binding 外名一律 deny（S0 M-12） | 历史 P0-1 8/8 fixture；适用性=3/3；**不得写全 dormant** | 外部效果治理完整性=PR7 deferred | WIRED-NOT-ACCEPTED | no |
| MCP HTTP 动态域 (M-12) | 同上 | 同上 claim scope（root 裁定 2026-10-20 原文：装面无可达动态观察面） | 未证 | — | 无 | 动态面持续重校验未证 | NOT_VERIFIED | no |
| Domain (M-13) | — | 无实现 | — | — | 无 PoC（S0 明示 NOT_RUN） | fail-closed 条款仅设计 | NOT_VERIFIED | no |
| team_* (M-14) | PR1 `db5cb5f7` 等 | own-layer 覆盖枚举在治理范围（builtinToolDeny 仅作用继承面，own-layer typed 拒在册） | 内部状态面 | h6 公开审批面全驱动+一次性消费（历史 host） | 历史 @0e0b605a；适用性=3/3 | 全 team 工具矩阵/冷恢复未测 | ENFORCE-PARTIAL(scope=@0e0b605a 真实Host审批链历史轮) | no |
| todo_write (M-14) | PR1 覆盖枚举 | **plane 保留名在册**（亲读 :405）→ 治理范围内非排除项 | 状态写面 | 静态 allow 清单+清单外默认 deny | 装配行级未证 | 装面腿未复验 | NOT_VERIFIED（治理归属=在册事实） | no |
| Preset/Team 自注册覆盖 (NEG-4) | bind-diag `248aff73` 系 | preset-realm 注册不达全局 tools.schemas() 面（bind-diag verdict 亲读摘录） | — | 未验证继承在 ABSTAIN 层（**从来不是 VERIFIED**，bind-diag 原文） | 三世界 17/17×3 @bind-diag；适用性=3/3 | 无任何世界展示过 preset-realm VERIFIED 继承 | WIRED-NOT-ACCEPTED | no |

## 注记

1. grep/glob r1 观察=同词表机制**提示**，不占 blocker 行；R2 只占 team_bash 行（口径照抄，见该行）。
2. "历史 LIVE-CONFIRMED 不算 baseline 复验"：本表全部 V@B=no；复验轮（人工/矩阵轮触发）后逐行翻 V@B=yes 并记 tested SHA=baseline。
3. dep-drift 为**适用性提示非真伪**：3/3=装配三件自 tested SHA 后均有改动（历史结论需重判），0/3=零改动（结论直接适用但仍未在 baseline 复跑）。
