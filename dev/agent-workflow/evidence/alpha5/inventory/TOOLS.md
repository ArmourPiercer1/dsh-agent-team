# TOOLS.md — Alpha.5 逐工具对账清单（R 路）

- 写者/时刻 = 同 `MECHANISMS.md`（R 路，2026-10-19 ≈07:5xZ；**rev2=根 07:30Z 校准令四条已落**；**rev3=收口小笔：宿主树改走主检出 `tests/deepseek-harness-test-use`@639ed01539 亲核——str_replace_editor 注册源+opt-in 零 preset 行坐实、fs/shell 族注册行落地、同族 opt-in 包复核无漏行**）；基线 = `d5de7497`（现场 `git log -1` 亲验）。
- **枚举源=真实注册面，非文档**：
  ① 原生全集 = `packages/runtime/src/plugin/live/team-tool-plane.mjs:258-324 PLANE_RESERVED_NATIVE`（**现场重数=68 名** + `mcp__` 前缀族穷尽 `:324`）——该表钉宿主 `0.2.0-rc.2@639ed01539`（`PLANE_RESERVED_NATIVE_HOST_PIN :257`），由双向漂移机检对宿主权威目录 harvest（宿主保证测试 `packages/core/tools/tests/gen-tool-catalog.spec.ts`：boot 全部 shipped tool 包=70 entry/65 唯一名）强制同步，且每名须真实注册来源（猜名=RED，a5-pindir 律）；
  ② Team 协调面 = `packages/tools/src/tools.ts` 13 名逐行（:498-1197）；
  ③ Plane 效应行 = `team-tool-plane.mjs:83 DEFAULT_PLANE_NAMES`（grep→`team_grep`，glob→`team_glob`，bash→`team_bash`）+ takeover 表 `:321-325`（**仅 bash@bash、read@read 两对 supported；grep/glob takeover=空**）。
- **证据分层律（根 07:30Z 校准令③）**：凡 `证据@090b87b5:` 前缀=固定试用证据头 `090b87b57e06da3854ddd9a36646ed8700fa4eef`（branch a5-candidate-pkg）内卷，**在分支不在 master 不等于未发生**；机制面/glob 终装/C1 修复面等不得回退为未知/未测。
- 铁律：钉名只拦截 **plane 冒名挂载**（`verifyPlaneNames:327`），不构成对该工具本身的 allow/ask/deny 覆盖。**三分类律（根 07:30Z 校准令④——"钉≠治理"的另一半=钉也≠全禁）**：未纳管原生名行为分三层=① strict `capabilities.permissions` 面：UNKNOWN_UNMANAGED **setup 响亮拒**（typed `alpha2-permission-coverage-unmanaged-tools`，`glue:2678-2695`：coverage 门 throw、无自动隐藏、无逃逸口，**该形下根本跑不起来**）；② plane CLAIM 面：钉拒于装配（`verifyPlaneNames`）；③ 非 strict 普通挂载面：宿主原样执行（设计内 SAFE_UNMANAGED 域）。**禁泛称"全部可执行绕过"，也禁按钉表计治理覆盖**——绝大多数原生行落在「只有模块（钉）/未测（治理车道）」，这是实况不是美化。
- 列缩写：注册处 / 配置面（团队蓝图怎么控它）/ 治理面（deny·ask 车道是否可执行触达）/ 生产接线 / 正验收 / 负验收 / 未测面 / 阻塞·延期。`glue`=`agent-bindings.mjs`；`E/`=`dev/agent-workflow/evidence/`。

## A. 13 team_*（Leader 协调面，封闭词表）

共同行（逐名不再重复）——**注册处**=`packages/tools/src/tools.ts`（行见列），经 `selectTeamTools`（`packages/tools/src/tool-selector.ts`）按模板 `tools` capability allow/deny 过滤后在 `glue:2391+` per-agent 注册（agent 私有 scope，不受 restrict 掩码）；**配置面**=Blueprint `capabilities.tools`（deny→零工具；allow 名单=catalog 序去重）；**治理面**=实例寻址操作执行前 `consultGuard`（`tools.ts:343`）逐次消费 durable 控制（`packages/tools/src/guard.ts`），非实例名走 runtime 寻址活拒；**生产接线=是**（C-01 行；registry 00 live-PASS）；**共同正验收**=`E/alpha5/release-candidate-r1/runs/` r5 全链 28/0（create→create-member→委派→collect）；**共同负验收**=guard 六拒形 fail-closed 零副作用 + `ACTION_ADDRESSING_REJECTED`（G6 E2）。

| 工具 | 注册处(file:line) | 专属证据 / 未测面 / 阻塞 |
|---|---|---|
| team_list_members | tools.ts:498 | 未测面=大 roster 分页/陈旧实例视图无专测；无阻塞 |
| team_list_templates | tools.ts:520 | 正=v3/v4 目录在 B2/B3 见证；未测=v4 模板目录腿（执行面延期 M25 关联） |
| team_inspect_config | tools.ts:542 | 正=effective-config-view 投影在产（P 系列）；未测=治理代际字段暴露面 |
| team_create_member | tools.ts:572 | 正=r5 真建员 runs；负=配额拒（root.ts:3324 消费链，装面端到端未专测）；label 必填行文差在册 |
| team_delegate | tools.ts:614 | 正=r5 委派→执行→回报；**r2 事实=实例形 `label` 必填**（SKILL 行文差=NOT-ACCEPTED §C-15，docs 小件未闭）；未测=sync/async 双臂全矩阵 |
| team_follow_up | tools.ts:710 | 正=唤醒链（steer/followup 语义 glue:4571-4675）；未测=高频 followup 竞态腿无套件 |
| team_collect | tools.ts:772 | 正=r5 collect 带回终态；负=未寻达拒形在册；未测=大输出 spill 形经 team 面（a5p5 spill 面未装，M35 关联） |
| team_send_message | tools.ts:817 | 正=liveness 修复轮（`869e0dcb` busy-steer 恢复）；法册=`docs/plans/finished/team_send_message_liveness_fix_guide.md`；未测=跨代际 drain 竞态重跑 |
| team_report_progress | tools.ts:856 | 正=投影链（P 系列在产）；未测=progress 语义治理（无 ask 层，lane 不可寻址=已裁边界②B-7） |
| team_request_control | tools.ts:960 | 正=durable 请求落账+guard 拦停（M02/M04）；负=**RC 形状包络拒 verbatim**（REWORK §④(c)：`request-control … outside the caller's mutation envelope`）；未测=非 RC 形状的 ask 梯全类 |
| team_resolve_control | tools.ts:1017 | 正=resolve→allow-consumed 恰好一次（guard 头法律+G6 轮测）；未测=decision-deny 后续跑装面腿（换蓝图即测） |
| team_list_pending_control | tools.ts:1119 | 正=控制面读回在产；未测=pending 集与 guard 一致性负控（双读窗口） |
| team_archive_member | tools.ts:1197 | 正=归档+drain（toolDisposers 有序卸装，`glue:2355-2372`）；未测=归档时活 job/子代理残留矩阵（关联 M26 BOUNDED-DEFER job cancel） |

## B. Plane 效应行（Team 治理真效应面）

| 工具（行名） | 注册处 | 配置面 | 治理面 | 生产接线 | 正验收 | 负验收 | 未测面 | 阻塞/延期 |
|---|---|---|---|---|---|---|---|---|
| team_bash（别名）/ **bash@bash（接管）** | `DEFAULT_PLANE_NAMES:83`；takeover `:322`；backends 装配 `team-tool-plane.mjs:552` 区（`#321` 内容经 `#323=0e59140b` squash 载体入 master） | 蓝图 permissions/lane + takeover 配置（INSTALL §3.2/§3.5） | lane deny/ask 可执行（G1 单点）；durable ask→执行闭环 | **是** | 真 Landlock：r5 `bash · exit=0` 落盘 + `exit=1` 内核 Permission denied verbatim（runs `2026-10-18T20-36-13Z`/`20-37-08Z`）；审批→执行 `#329=1fb14c4d` runs=`E/natexe/`；exitPassthrough `#336` | deny 先于 backend 零副作用（`#315`）；越界写=EACCES 实拒（域证 `E/pr4/` 正负控齐） | durable ask 梯腿本蓝图未触发；取消=**C1 修复面四条件引用制已入账**（证据@090b87b5，见 C 表 bash 行；a5ie-r5 早期 RED 原文保留 `c44f51e4`），"端到端已通"仍为禁止表述（wire 死亡形=CORE_SEAM_BLOCKER#1） | 名单级枚举曾漏 3/10700→`#323` 收窄修（stat-probe 残余披露在册）；`cancelled:true` 上 wire=**CORE_SEAM_BLOCKER**（M07） |
| team_grep（别名；grep 不可同名） | `DEFAULT_PLANE_NAMES:83`；takeover grep=[]（`:323` 必别名）；`live/search-backend.mjs` | 同上 | 同上 | **是** | rg-parity `#330=1a7c3c1c`+`E/srgp/`；装面 r5 RG 真 rg15.0.0 答题 | 车道拒形同 B 行共性 | grep 正反控装面重跑未做（profile 缺项）；binary/ignore/VCS 全表=parity 表在册未逐格重跑 | 无（完成律常量=设计） |
| team_glob（别名；glob 不可同名） | `live/glob-backend.mjs`（970 行休眠供体 `#322` 合入→`#333=104b4991` 翻转挂载）；关断键 `planeCfg.globEnabled` `#342` | 同上+关断键 | 同上 | **是** | 五控 50/50（`E/a5ie-r3`）；r5 `anchored-glob legs=6 files=2`；rc-first+trusted exit-record `#343=`HEAD；**glob 终装=证据@090b87b5:`glob-off-install/runs/2026-10-18T23-39-12Z/` 32/32+4 booked+18 shape-N/A（⑤ 缺省公开形正控判定期，KIT_EXIT=0，kit 快照 `kit-as-run.mjs`+全程转录在卷）+试用终装 LEG B typed 关断（`candidate-package/runs/trial-final/` 24/24）** | symlink-alias 拒/walker-error typed 拒（`:1076-1091` 现场）；undeterminable=拒判；关断形 off 世界 walker plan=0（同场正控证灵敏） | 收口后五控装面重跑待做 | 关断键已随 `#342` 入头；**18 shape-N/A=⑤ 轮 off/rename 形腿在无该形世界的 shape 不适用记账（booked，非绿非红），非缺口** |
| read（**read@read 接管行**） | feed 行 `glue:2327-2329`（placement feed=plane 四行 rows=[team_grep,team_glob,team_bash,read]，§B 现场 instance.log）；C-FS `createProductionControlledFsProvider`（`:77`） | 同上 | C-FS deny-before-open 中介 | **是** | governed read 真字节 live=`E/a5ie-r2b`（A1/A2/P1）+`#317=68deccaa` | TOCTOU：fd-句柄法+exec-time 复核（GLUE-7 ①(c) 闭）；binding 拒历史 verbatim（pb-binding-feed RED→翻绿） | 装面正反控腿本轮未重跑（换 prompt 即测） | **write 行治理未挂**（REWORK 行 6）；OpenAtPort 未落⇒arbitrary-tree 恒禁 |

## C. 原生工具全集（68 名 + `mcp__` 前缀族，现场枚举）

共性——**注册处**=宿主 shipped 包 @`639ed01539`（每名真实注册来源在钉表注释具名：registry/tools.ts/toolName-config/boot 包；fs/shell 族已按**主检出宿主树** `tests/deepseek-harness-test-use` 亲核（worktree 内该树 gitignored 不在）：read/write/edit/read_image=`packages/fs/tool-fs/src/{read,write,edit,read-image}.ts:78/73/85/210`，glob/grep=`packages/fs/tool-fs-search/src/{glob,grep}.ts:307/285`，bash=`packages/shell/tool-bash/src/index.ts:374`）；**配置面**=宿主 preset/profile（team 蓝图不可达，除 takeover 两对）；**治理面=三分类（§C 头律，逐行不再重复）**：strict 面 setup 响亮拒（不可跑）/ plane CLAIM 钉拒装配 / 非 strict 普通挂载宿主原样；Team allow/ask/deny 车道不可执行触达；四形状行为=REWORK §④(b)（preset 全拒 dispatch 形 / host-plane 原生执行形 / RC 形=request-control 包络前 fail-closed / pr1shape 拒形）；**durable grant 消费通路 runtime consumer=0**（`grant.ts:84,134` 闭码无消费者，现场 grep）⇒ 除标注外本组主标签从严=**未测（治理车道腿）**，三层行为本身已实测非未知。**同族 opt-in 复核（主检出亲 grep `packages/bundle/**/*.yml`）**：shipped 但**缺省 preset 零挂载行**的 tool 包=`tool-str-replace-editor`（示例仅在 `snapshots/sdk/persistent-tools/cordis.yml:6-7`）、`tool-lsp`、`tool-terminal`、`tool-session-query`、`tool-agent-team`(experimental)；条件挂载=`tool-workspace-dependencies`（仅 sdk-app）、persistent bash/pwsh（仅 minimal/sdk-minimal 形）；缺省已挂=present（`presets/{cordis,ptc,standard}.patch.yml`）、ask-user（`presets/cordis.patch.yml:130`）。C 表 lsp/terminal_*/present 行注记与此一致，**无漏行需另立**。

| 原生名 | 生产接线（=host 原生） | 治理覆盖实况 | 正/负验收 | 未测面/阻塞·延期 | 标签 |
|---|---|---|---|---|---|
| bash | 是（host dsh-tool-bash） | **接管对 supported**（takeover 时=治理行，见 B 行） | `#329` runs；**C1 修复面=证据@090b87b5:`a5c1fix-b/runs/2026-10-18T23-05-55Z/`（四条件引用制：①②③ F3b v3 带外监视+④真 wire verbatim；字节级 SAME_BYTES 链入冻结面）** | 无 takeover 配置世界 A4.4 拒存续 verbatim；wire 死亡形红不销案（#1 渲染层限制） | 有真实验收（接管形+C1 修复面）/未测（未接管形状腿） |
| read | 是 | **接管对 supported** | `E/a5ie-r2b` | 同上 B 行 | 有真实验收（接管形） |
| grep | 是 | **takeover=空，仅别名覆盖**（team_grep）；原生名本身未纳管 | parity 表在 team_grep 侧 | 原生 grep 名在治理世界的车道触达=无 | 未测 |
| glob | 是 | 同上（team_glob；关断键 `#342`） | 五控 50/50 在 team_glob 侧 | 同上 | 未测 |
| write | 是 | **无任何治理行**（write 行未挂，REWORK 行 6） | 无 Team 面正/负 | write 治理=计划内未装（C-FS 写半壁） | 只有模块（C-FS 本体）/未测（write 效应） |
| edit | 是（**亲核宿主树@639ed01539**：`packages/fs/tool-fs/src/edit.ts:85` `name:'edit'`） | 无；定义在公开 seam 不可读（W-E2 差距在册） | 仅 c0405 kit 治理链（Team Definition 材料化，undo 逐字节复原；delete/undo_all typed `IO_POLICY_UNSUPPORTED`） | 生产注册边无（kit-only，矩阵 M-04 TRANSITIONED-LIVE=判据级） | 只有模块 |
| str_replace_editor | **opt-in 独立包** `@deepseek-ai/dsh-tool-str-replace-editor`（根 07:30Z 令②：与 edit **两行两注册源**，不得并成同一注册形）。**亲核**（宿主树=主检出 `tests/deepseek-harness-test-use` @`639ed01539`；worktree 内该树 gitignored 不在，来源限定注此）：注册名=`packages/fs/tool-str-replace-editor/src/index.ts:430`（`name: 'str_replace_editor'`），包导出名=`:502`；发行=workspace 依赖 `apps/cli/package.json:84`；**preset 挂载面=零行**：`packages/bundle/**` 全部 cordis/patch yml 亲 grep 无该包行（示例形仅在 `snapshots/sdk/persistent-tools/cordis.yml:6-7`）——"preset 不含、须显式装行"由亲核坐实；**且宿主官方文档自证**（`packages/bundle/base/README.md:52`+`README.zh.md:52`（陈述行；启用条目形两文各 `:54-60`，主检出亲验）：「The `str_replace_editor` tool remains available as an explicit opt-in」+给出 `id: tool-str-replace-editor` 显式启用条目形）⇒ **opt-in 定性=宿主文档+零 preset 挂载+注册面三重亲核** | 无（定义在公开 seam 不可读，同 edit）；挂载与否由宿主 profile 显式行决定，team 蓝图不可达 | 同 edit 行（kit 治理链为 Team Definition 形，非该包本体） | 同 edit | 只有模块（钉+opt-in 面；注册源已亲核） |
| read_image | 是 | 同上（M-05 kit-LIVE 判据级） | c0405+c08 双 kit | 生产面=host 原生未纳管 | 只有模块 |
| pwsh | 是 | shell-class 规则在权限面声明（fingerprint 形，permission-plane `:1137` 注记）；无 plane 行 | 无装面腿 | Windows 宿主维度本机不可测 | 未测 |
| lsp | 是（host 共享池） | Team 侧 realm 装配在码（`#304`），试用 profile 未挂 | REAL-LSP `#306` 30/30×2（kit/CI receipts `E/prod-lsp/ci-304/`） | 装面挂 lsp 腿未驱动（preset 即测）；原生 lsp 名车道=不可触达 | 有真实验收（realm 形）/未测（装面）；sub-realm 全键池=上游阻塞（M29） |
| present | 是 | 钉 only | 无 | 车道触达无 | 只有模块（钉）→未测 |
| skill / load_workspace_dependencies | 是（宿主 skill 面） | skills 注入面见 M11（Team 提供方注册） | boot/mount 级 | 技能调用端到端未测 | 生产已接线（注入）/未测（调用） |
| todo_write | 是 | **SAFE_UNMANAGED=既定设计**（根 07:30Z 令①：低风险面，**设计内非漏纳管**）；钉 only（反冒名） | 三分类律 §C：strict setup 拒 / CLAIM 钉拒 / 非 strict 宿主原样=**设计内** | 无（无需治理验收，设计如此） | 设计内 SAFE_UNMANAGED（非"未纳管"） |
| ask_user_question | 是 | 钉 only；TM-7 债务行在册（未分类→UNKNOWN_UNMANAGED 史，`docs/plans/memo/post-alpha4-debt-register.md:31`） | 无 | 成员会话内的 ask 语义与 durable 审批关系未定义/未测 | 未测 |
| web_search / web_fetch | 是（host 公开面） | 钉 only；PR7 可信 Provider=延期（M31） | host 原样非 Team 宣称 | 治理世界内 web 效应审批链=无 | 未测 |
| create_goal / get_goal / update_goal | 是 | 钉 only | 无 | 同上 | 未测 |
| exit_plan_mode | 是 | 钉 only（`team-tool-plane.mjs:271`） | 无 | plan 车道治理无机制在场（见 M09 plan-guard 行） | 未测 |
| job_kill / job_list / job_output | 是（host 公开 jobs 面） | host 面原样兑现（W7M FULFILLED 层）；Team gateway lease 另在（M26） | gateway kit W7 committed-dist 绿；veto=0 | job_* 装面正反控未驱动；job 级 cancel=BOUNDED-DEFER | 生产已接线（host 面）/未测（team lane） |
| subagent / subagent_fork | 是（tool-subagent toolName 路由；fork=shipped-default-ENABLED，钉表注释逐文件具名） | drain 链生产在码（`glue:4952-4972` drainContinuableDescendants/listDescendants，absent→拒）；模型面车道钉 only | 静默/drain 单测+`#278` 隔离三件真钉 | 成员跑子代理的车道端到端=无 | 生产已接线（drain）/未测（车道） |
| subagent_codex / subagent_claude_code | shipped 默认 **disabled** | **预防保留钉**（根 21:15Z 裁：disabled≠允许冒名；翻转漂移测试 a5-pindir-subagent-flip） | 翻转双向注入拒 | 启用后行为=未测（本机未启用） | 只有模块（预防钉） |
| list_subagent_models / list_agents / send_message / interrupt_agent | 是 | 钉 only | 无 | 同上 | 未测 |
| terminal_open/close/list/read/send/signal | 是 | 钉 only | 无 | 终端类 shell-class 治理未实例化 | 未测 |
| session_event_read/search/trace、session_search/trace | 是 | 钉 only | 无 | 同上 | 未测 |
| list_mcp_resources / list_mcp_resource_templates / read_mcp_resource | 是 | 钉 only + `mcp__` 前缀穷尽；MCP 供给校验面在（`mcp-supply.ts:33,70`） | 无 Team 治理执行链 | MCP 工具经治理链执行=无行（M30） | 只有模块 |
| run_code（PTC 传输） | 是（registry 自带 reserved transport） | **fs 半臂生产行**（`glue:2412` 区门构造式注册+一次性 Grant 梯） | `#334` live 19/19；strict run_code=窄固定策略 | net 半臂=上游阻塞（M33）；模型侧提示词未接 | 有真实验收（fs 半臂）/上游阻塞（net） |
| plugin_manager | 是 | 钉 only | 无 | 同上 | 未测 |
| schedule_create/delete/list/update | 是 | 钉 only | 无 | 同上 | 未测 |
| workflow | 是（tool-workflow toolName 默认） | 钉 only | 无 | 同上 | 未测 |
| stagehand_act/extract/navigate/observe/screenshot/tabs（browser 面） | 是（experimental browser-use 包） | 钉 only；browser 维度=宿主依赖延期（试用环境无浏览器腿） | 无 | 真实浏览器治理=未做（browser 行延期在册） | 已明确延期/未测 |
| spawn_teammate / wait_agent / team_task_create/get/list/update | 是（宿主 legacy/兼容路由名） | 钉 only；**与 vNext team_* 词表无关**（红线：不得当 vNext 词汇） | 无 | 无治理意图声明=防冒名钉 | 只有模块（钉） |
| cordis_inspect_list / cordis_inspect_query | 是 | 钉 only | 无 | 同上 | 未测 |
| ralph | 是 | 钉 only | 无 | 同上 | 未测 |
| `mcp__*`（前缀族穷尽） | 动态（MCP 贡献） | 前缀钉拒 plane 冒名；供给校验在 | 无 | 动态工具的代际/策略矩阵=无 | 未测 |

## D. 汇总（禁美化声明）

- **真治理效应覆盖（生产+验收）的工具 = 4 行面**：team_bash/bash@bash、team_grep、team_glob、read@read；外加 PTC run_code 的 fs 半臂审批梯。
- 13 team_* = 生产装配+协调面验收，但**每个工具的纵深负控未成矩阵**（A 表逐行未测面）。
- 其余 ~60 原生名按**三分类律**分层陈述（根 07:30Z 令④，禁泛称"全可执行绕过"）：① strict `capabilities.permissions` 蓝图下=UNKNOWN_UNMANAGED **setup 响亮拒**（typed，跑不起来）；② plane CLAIM=钉拒于装配；③ 非 strict 普通挂载=宿主原样执行（设计域，含 todo_write 等 SAFE_UNMANAGED 既定设计）。Team 审批→放行原生行=0 消费者通路；「治理覆盖 68/68」与"全部可跑绕过"两个口径**都不成立**。
- 枚举完整性自证：钉表 68 名 + 前缀族 = 宿主权威 harvest（65 唯一名 + toolName 路由名 subagent_fork/codex/claude_code + 注释具名的 registry/boot/config 路由名）经双向漂移机检强制；若宿主换 pin，漂移测试先 RED 逼重导出——本表数与机检同源，无文档抄写。
