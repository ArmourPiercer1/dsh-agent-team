# ALPHA.5 SANDBOX-FIRST — TOOL ACCEPTANCE MATRIX（逐工具验收）

<!-- phase-baseline-ref: dev/engineering/current-authority.json -->
<!-- phase-identity: alpha5-sandbox-first -->

> **当前阶段：ALPHA.5 SANDBOX-FIRST**。本矩阵是**验收合同**，不是能力宣传：每行只写已经有证据
> 支持的状态。`NOT_WIRED` = 新执行面尚未绑定该工具；`PROBE-GATED` = 机制已由 P1 探针证实但工具
> 尚未端到端绑定；`DONE`/`LIVE-CONFIRMED` 需要 tested SHA **和**可解析的证据路径。
> **历史绿 ≠ 新验收**：旧矩阵的 PASS、旧 `web-family` 历史、旧 `fs-family` 证据都不能折算成本表
> 的等级。`V@B` = 该行是否已在当前 baseline 上验证（`yes` 才计 current claim）。
> 设计需求正本 = `docs/plans/memo/alpha5-sandbox-first-20261101/`（尤其 TOOL-ADOPTION-MATRIX）。

## 0. 全表前提（不因行而异）

- 每次受限调用必须满足 `EffectiveIo(member,tool,call) ⊆ MemberCeiling(member) ∩ ToolRestriction(member,tool)`；
  三轴 = read / write / network。本轮 `network=restricted` 为 **UNSUPPORTED**（没有目的地粒度）。
- 工具级 `allow all` 不是 Member 上界的提升；审批只决定“是否允许执行”，不改写硬上界。
- 不允许的降级：Provider 不可用、后端不强制、策略不可表达时**拒绝执行**，绝不退回裸执行。
- 同一 `member/tool/call/revision` 必须能追到：Alpha.4 允许/拒绝 → 编译结果 → Provider
  `consulted` → 独立效果 Oracle。缺任一环即不构成 PASS（BL-11）。
- 表内等级闭集：`DONE` / `LIVE-CONFIRMED` / `ENFORCE-PARTIAL` / `PROBE-GATED` / `WIRED` /
  `WIRED-NOT-ACCEPTED` / `BOUNDED-DEFER` / `DEFERRED` / `UNSUPPORTED` / `NOT_IMPLEMENTED` /
  `NOT_WIRED` / `NOT_IMPLEMENTED/NOT_WIRED` / `NOT_VERIFIED` / `BLOCKED-FOR-RELEASE` /
  `NEEDS_REVALIDATION`。

## 1. 主矩阵（工具 × 面）

<!-- q5:main-begin -->

| ①行ID | ② 工具 / 面 | ③ 接入模式 | ④ 编译上界 | ⑤ 最低验收 | ⑥ 验证 | ⑦ 残余风险 | ⑧ 等级 | ⑨ V@B |
|---|---|---|---|---|---|---|---|---|
| read (M-01) | 原生 read（ctx.fs，经 routed native mount） | service-mediated:fs；per-tool ToolBinding realm（#561）+ 归属探针/持续校验/失效准入（#569/#574/#576） | MemberCeiling(read) ∩ ToolRestriction(read)（compiled intersection 被消费，不重算） | 大文件中间窗口、流式、禁读真实拒绝、双 Member 不串权 | 证据=dev/agent-workflow/evidence/a5sf-s1/six-arms.log,dev/agent-workflow/evidence/a5sf-assembly/green-arms.log,dev/agent-workflow/evidence/a5sf-p0/green-assembly-c1.log,dev/agent-workflow/evidence/a5sf-deferred/green-probe.log,dev/agent-workflow/evidence/a5sf-acceptance/README.md,dev/agent-workflow/evidence/a5sf-p1-05/SERVICE-REALM-EVIDENCE.md；**机制半场（host-free，已证明）**=ARM-1/2/3 + GAP1a/1b/1c（归属=观察所得，`A5SF_BINDING_OWNER_UNRESOLVED/_AMBIGUOUS` 拒绝）+ P0-1/P0-3（失效后准入 deny，禁止字节不返回）+ A1/A5/A7（deferred 接受 + post-settle 折叠失效）；**live 半场 = 从未运行**=README §1/§3（#575 六行全部 NOT_REACHED）；证据 HEAD `bb5315cd3`、`474a8d46d`、`84e9348fc`、`cfdf87267`，合并 HEAD `d0cbef9af` | live 六行未执行（见 §1.1）；`tools/change`/`tools/pre-execute` 是 setup 硬要求（缺失即 fail-closed）；scope-key 之外的注册不受本 seam 管；准入 deny 仅 in-process（直调 `.execute` 绕过）；生产 `teamA5sfRealm` provider 仍由证据行提供（`a5sf-acceptance/README.md` §6） | ENFORCE-PARTIAL | no |
| write (M-02) | 原生 write（ctx.fs，ceiling partition） | service-mediated:fs；per-module ceiling mount（#561/#569） | MemberCeiling(write) ∩ ToolRestriction(write) | 原子替换与版本校验、禁写字节不变、写不自动获读 | 证据=dev/agent-workflow/evidence/a5sf-s1/six-arms.log,dev/agent-workflow/evidence/a5sf-assembly/green-arms.log,dev/agent-workflow/evidence/a5sf-acceptance/README.md；**机制半场（host-free，已证明）**=ARM-2（`insideWrite=ok`、`outsideWrite=denied`，两条事实属 `member/null` = ceiling realm）+ GAP1b（ceiling-only 模块的 tool 仍执行且不进 binding 车道）；**live row 4 未执行**=README §3.2；证据 HEAD `bb5315cd3`、`474a8d46d`，合并 HEAD `d0cbef9af` | live 未验收；只有 ceiling 车道的 host-free 正向+拒绝；写旧内容需读权限（edit）未测；同 realm 恶意 JS（TRUSTED_ONLY） | ENFORCE-PARTIAL | no |
| edit (M-03) | 原生 edit（ctx.fs，ceiling partition） | service-mediated:fs；per-module ceiling mount | 读旧内容与写新内容两轴 | 版本冲突、禁写、读旧内容也需读权限 | 证据=dev/agent-workflow/evidence/a5sf-fs-tools/README.md,dev/agent-workflow/evidence/a5sf-fs-tools/fs-arms.log,dev/agent-workflow/evidence/a5sf-s1/six-arms.log；**执行/拒绝半场（host-free，本 lane 实测，真 pinned `@deepseek-ai/dsh-tool-fs` 0.2.0-rc.2，经 `mountMemberA5sfRealm`→`attachA5sfNativeToolModules`）**=EDIT-1（in-lane edit 经 routed/confined ceiling 定义执行，磁盘 `ALPHA\nbeta\n`，恰一条 `member/null/<member>/editText/allow/ALLOW` 事实；pre-attach preset 对照成功且 0 事实）+ EDIT-2（out-of-lane `IO_WRITE_DENIED`，字节不变，事实 `member/null/<member>/editText/deny`）+ EDIT-3a/3b（两轴分离：write 覆盖而 read 不覆盖 ⇒ `IO_WRITE_REQUIRES_READ`；反向 ⇒ `IO_WRITE_DENIED`，均字节不变）+ EDIT-3c（读要求以目标存在为条件：新建可，既有文件不可）+ EDIT-4（`edit` 只在 ceiling partition 恰一次，binding 车道无，surface 中性）；**live 半场未运行**（`a5sf-acceptance/README.md` §1/§3.2） | 只证明 ceiling 车道的 host-free 执行+拒绝+读写轴分离+surface 中性；无 `dsh.fs/edit` binding 车道的测量；content 不是 lane 维度（EDIT-3d：guard 先按路径 allow，再由工具 unique-match 拒绝）；live 六行未执行；同 realm 恶意 JS（TRUSTED_ONLY） | ENFORCE-PARTIAL | no |
| read_image (M-04) | 原生 read_image（routed deferred registration） | service-mediated:fs + attachments（原生 `ctx.inject(['attachments'])`，见 #576） | 读上界，附件服务单独识别 | 像素与大小上界、工具展示等价；附件来源不可绑定则 UNSUPPORTED | 证据=dev/agent-workflow/evidence/a5sf-deferred/green-probe.log,dev/agent-workflow/evidence/a5sf-deferred/all-a5sf-node-suites.log,dev/agent-workflow/evidence/a5sf-assembly/README.md,dev/agent-workflow/evidence/a5sf-p0/README.md,dev/agent-workflow/evidence/a5sf-acceptance/README.md；**机制半场（host-free，条件性证明）**=A1（`mounted=true`，`definitionIdentities.read_image="routed"`）+ TA11（deferred 定义经同一 partition，`read` 仍按编译交集拒绝）+ assembly §3.2（post-settle 注册折叠入账并 invalidate）+ P0 §3（admission deny 覆盖该 managed name）；**live 未验收**=acceptance §1/§9.2；证据 HEAD `cfdf87267`、`84e9348fc`、`6d1b7a1fb` | 依赖可解析的 `attachments`（缺失时该子 fiber 良性不注册、`read_image` 不在 surface）；依赖 `DEFERRED_SETTLE_ROUNDS=20` settle bound（有 attachments 时实测 ~4.2 ms / A1 端到端 10 ms；超界即 fail-closed 拒绝）；read_image 自身执行路径未经 guard fact 测量 | BOUNDED-DEFER | no |
| str_replace_editor (M-05) | str_replace_editor（若 Host 提供） | service-mediated:fs | 读写两轴 | 原生编辑与原子写保留、逐工具拒绝 | 证据=dev/agent-workflow/evidence/a5sf-g1/G1-GATE-REPORT.md；机制级 | BL-21 库存已查明：模块存在于 pinned baseline（`@deepseek-ai/dsh-tool-str-replace-editor`，`inject=["tools","fs"]`，同步注册 `str_replace_editor`），但**不在产品 preset 里、也未进 `a5sfNativeToolModules`** → 未接入；见 `NATIVE-SOURCE-INVENTORY.md` §2/§3 | NOT_WIRED | no |
| grep (M-06 native) | 原生 grep 经 OS rg | service-mediated:subprocess 加 os-confined:leaf | 读上界；进程 argv 不可注入越界路径 | exit 0/1、无匹配、非法模式、流与取消、真实 OS 拒读 | 证据=dev/agent-workflow/evidence/a5sf-p1-07/OS-RUNNER-EVIDENCE.md,dev/agent-workflow/evidence/a5sf-fs-tools/README.md,dev/agent-workflow/evidence/a5sf-fs-tools/fs-arms.log；**可采纳性已实测（host-free，真 pinned `@deepseek-ai/dsh-tool-fs-search` 0.2.0-rc.2）**=SEARCH-1（同步注册，`inject=["tools","systemPrompt","subprocess"]`，ceiling fiber 转发 `["glob","grep"]`，定义被 shadow，surface 中性）+ SEARCH-2（in-lane 真 `rg` 执行成功，guard facts=0——该模块不触 `fs`）+ SEARCH-3（**out-of-lane 搜索执行并返回越界内容**：`readAllow` 不含被搜目录，`grep=EXECUTED`、`glob=EXECUTED`、`guardFacts=0`） | **未拒绝的原因 = 缺一个 OS 受限的 subprocess Provider**：realm 只 confine `fs`，模块经 `ctx.subprocess.spawn`（argv 向量、packaged rg）读文件，guard 不参与；P1-07 的 `os-confined:leaf` runner 尚未接入 `ctx.subprocess`（其 §3 自述）。**移动该行只需一个 arm**：把 OS 受限 subprocess Provider 挂进 binding realm 后重跑 SEARCH-3，要求 out-of-lane `grep` 被 OS/Provider 拒绝**且**有 guard fact、越界内容不出现；同一 arm 另钉 exit 0/1、no-match、bad-pattern、取消。未观察 OS 级拒绝；禁止以字符串过滤冒充 | NOT_WIRED | no |
| glob (M-07) | 原生 glob 经 rg | service-mediated:subprocess 加 os-confined:leaf | 读上界 | 目录与过滤、无结果、异常、禁读 | 证据=dev/agent-workflow/evidence/a5sf-p1-07/OS-RUNNER-EVIDENCE.md,dev/agent-workflow/evidence/a5sf-fs-tools/README.md,dev/agent-workflow/evidence/a5sf-fs-tools/fs-arms.log；**可采纳性已实测（host-free，真 pinned `@deepseek-ai/dsh-tool-fs-search` 0.2.0-rc.2）**=SEARCH-1（同一模块同步注册，`glob` 被 ceiling fiber 转发且定义 shadow，surface 中性）+ SEARCH-3（**out-of-lane `glob` 执行并列出越界目录内容**（`secret.txt`）：`readAllow` 不含被搜目录、`glob=EXECUTED`、`guardFacts=0`） | 与 M-06 同一个根因（realm 不 confine `subprocess`）。**移动该行只需一个 arm**：在 binding realm 挂 OS 受限 subprocess provider 后重跑 SEARCH-3 的 `glob` 分支——out-of-lane `glob` 必须被 OS/Provider 拒绝（不能只返回 0 结果，因为“无结果”与“不允许”无 guard fact 时不可区分），并可区分目录/过滤、异常与取消。未观察 OS 级拒绝 | NOT_WIRED | no |
| bash persistent (M-08) | 原生持久 bash 经 ctx.terminals | os-confined:leaf 加 team-shell | 读写两轴，network 拒绝 | 同 PTY 多命令、cwd、前后台、信号与超时、只写不读、旧代 PTY 拒用 | 证据=dev/agent-workflow/evidence/a5sf-p1-08/TERMINAL-LIFECYCLE-EVIDENCE.md；生命周期已测，工具级待 BL-17 | 真实 PTY 仍是测试 double；同 UID chmod 越界 | NOT_WIRED | no |
| bash transient (M-09) | 原生瞬态 bash 经 ctx.shell | os-confined:leaf | 读写两轴 | 与持久终端分别验收；danger-full-access 不越 Member ceiling | 证据=dev/agent-workflow/evidence/a5sf-p1-07/OS-RUNNER-EVIDENCE.md；OS 机制已测 | 工具尚未绑定 | NOT_WIRED | no |
| pwsh (M-10) | pwsh 持久与瞬态 | os-confined:leaf（可用平台） | 读写两轴 | 平台不支持即 ENV_BLOCK；不虚称 Linux PASS 等于 Windows | 证据=dev/agent-workflow/evidence/a5sf-g1/G1-GATE-REPORT.md；机制级 | 本机无 Windows 后端 | NOT_WIRED | no |
| run_code / PTC (M-11) | 原生 run_code 与 PTC | os-confined:leaf 加受控 Host bridge | 文件读写与 network 拒绝，IPC 受控 | 运行与嵌套调用正控；无 Host 代发旁路 | 证据=dev/agent-workflow/evidence/a5sf-g1/G1-GATE-REPORT.md；机制级 | BL-21 库存：`run_code` 不是可装载工具模块，而是 `@deepseek-ai/dsh-tools` 的 **PTC 模式保留名**（不可 register/shadow），PTC 是执行模式；无 routed-native 接入面 → 见 `NATIVE-SOURCE-INVENTORY.md` §3 | NOT_WIRED | no |
| lsp (M-12) | lsp 与 language server | os-confined:leaf 加 scoped service | 进程加代码库只读 | 生命周期、cwd、通信与退出；无法覆盖则 UNSUPPORTED | 证据=dev/agent-workflow/evidence/a5sf-g1/G1-GATE-REPORT.md；机制级 | 实际启动位置未 trace；BL-21 库存：模块存在（`@deepseek-ai/dsh-tool-lsp`）但不在产品 preset | NOT_WIRED | no |
| terminal_* (M-13) | terminal_open/send/read/signal/close/list | os-confined 已装 Terminal Backend | 读写两轴 | opening 与发送与读与 signal 与 close/list；失效不回裸 backend | 证据=dev/agent-workflow/evidence/a5sf-p1-08/TERMINAL-LIFECYCLE-EVIDENCE.md；领域层已测 | 端口为 double；BL-21 库存更正工具名：模块注册 `terminal_open/send/read/signal/close/list`（**无 `terminal_kill`**，见 `NATIVE-SOURCE-INVENTORY.md` §2） | NOT_WIRED | no |
| web_fetch (M-14) | 原生 web_fetch 经 ctx.web.fetch | service-mediated:web | network allow/deny（布尔，HTTP 前） | provider 选择、HTML 展示、network=deny 前置拒绝 | 证据=dev/agent-workflow/evidence/a5sf-g1/G1-GATE-REPORT.md；network=restricted UNSUPPORTED 已披露 | 上游 provider 内部网络不受本机 OS 限制 | NOT_WIRED | no |
| web_search (M-15) | 原生 web_search | service-mediated:web | network allow/deny（布尔） | source 与截断与 provider error 兼容、禁网 | 证据=dev/agent-workflow/evidence/a5sf-g1/G1-GATE-REPORT.md；机制级 | 不得复用旧 web-family PASS | NOT_WIRED | no |
| third-party CLI (M-16) | 未登记的本机 CLI | os-confined:leaf（通用 argv 与 stdio 与 cwd） | 读写两轴加 network 拒绝 | 换一个未命名命令仍可执行；零专用 ToolDefinition 执行体 | 证据=dev/agent-workflow/evidence/a5sf-p1-07/OS-RUNNER-EVIDENCE.md；通用 launcher 机制已测，端到端待 BL-20 | 需 BL-20 端到端 | PROBE-GATED | no |
| stdio MCP (M-17) | stdio MCP server（本机进程） | os-confined:leaf | 子进程读写 | RPC 取消、生命周期、本地 I/O 受限 | 证据=dev/agent-workflow/evidence/a5sf-g1/G1-GATE-REPORT.md；机制级 | 启动服务未 trace | NOT_WIRED | no |
| remote MCP / HTTP / SSH (M-18) | 远端执行的 provider | trusted-delegation | 本机联网入口可禁，远端效果不承诺 | 明确 TRUSTED_DELEGATION 或 UNSUPPORTED | 证据=dev/agent-workflow/evidence/a5sf-g1/G1-GATE-REPORT.md；披露项 | 远端文件与网络效果不可由本机限制 | UNSUPPORTED | no |
| state tools (M-19) | goal/todo/jobs/session 等 | Alpha.4 调用准入 | 无直接数据面 I/O 时不另设上限 | 不复刻状态机；保留原业务行为 | 证据=dev/agent-workflow/evidence/a5sf-g1/G1-GATE-REPORT.md；机制级 | 若实际读写文件需重新分类 | NOT_WIRED | no |
| present / skill / attachment (M-20) | present 与 skill 与附件读取 | service-mediated 或可信宿主代理 | 若读文件则受读上界 | 上传与读取与渲染来源能力分开；已知不受管 I/O 标 CONDITIONAL | 证据=dev/agent-workflow/evidence/a5sf-g1/G1-GATE-REPORT.md；机制级 | 可能读取用户文件，不能按无 I/O 猜测 | NOT_WIRED | no |
| unknown in-process JS (M-21) | 未知同进程第三方 JS | 无通用 Tool Host 时 UNSUPPORTED | 无 | 明确 TRUSTED_ONLY，不提供伪保证 | 证据=dev/agent-workflow/evidence/a5sf-g1/G1-GATE-REPORT.md；披露项 | node:fs 直连；hash 登记不是 sandbox | UNSUPPORTED | no |

<!-- q5:main-end -->

## 1.1 唯一的 live-half 阻塞事实（全表共用）

**六行 live 验收从未在真实 Host 上端到端执行过**——即 A/B/C 三行 `read` + `write` 不串通道 +
运行中失效后受管调用被拒且禁止字节不返回 + 终止后无失控 shadow/后台进程/未结清调用。唯一预留的
那次 boot 花在 **#575 的 NOT_REACHED 尝试**上：`dev/agent-workflow/evidence/a5sf-acceptance/README.md`
§1/§3/§7 记录 a5sf-wired Member 在 #561 的 deferred-registration 拒绝处**根本没激活**，
六行全部 `NOT_REACHED`（run record：`overall=FAIL cases=7`）。#576 修好了该机制
（`dev/agent-workflow/evidence/a5sf-deferred/README.md` §2/§4.1），但**修好之后的六行仍未重跑**，
所以 live 半场至今为零行证据。

为什么不能在本轮补跑：P2-01 的 boot 配额已在该次尝试上耗尽（`a5sf-acceptance/README.md` §7：
“P2-01's allocation is now exhausted”），而池中剩余的 6 次属于
`reserve`(2) 与 `G1.5/G1.6/G1.8 closure`(4) 两个条目
（`dev/agent-workflow/budgets/a5sf-boot-pool-20261103.json`），按池规则只能用于重跑具名失败类与
G1 边界项，**不是本 lane 可挪用的验收预算**；本 lane 也无 boot 授权。

因此本表的诚实上限是：FS 机制半场（host-free）有证据的行 = `ENFORCE-PARTIAL`/`BOUNDED-DEFER`/
`WIRED-NOT-ACCEPTED`；`DONE`/`LIVE-CONFIRMED` **不得**出现在任何一行，直到六行真跑并逐行留证。

## 2. 静态工具名附录（与主矩阵的映射）

<!-- q5:appendix-begin -->

- **read** [native] → (M-01)
- **write** [native] → (M-02)
- **edit** [native] → (M-03)
- **read_image** [native] → (M-04)
- **grep** [native] → (M-06 native)
- **glob** [native] → (M-07)
- **bash** [native, persistent] → (M-08)
- **bash** [native, transient] → (M-09)
- **pwsh** [native] → (M-10)
- **run_code** [native] → (M-11)
- **lsp** [native, conditional] → (M-12)
- **terminal_open** [native] → (M-13)
- **terminal_send** [native] → (M-13)
- **terminal_read** [native] → (M-13)
- **terminal_signal** [native] → (M-13)
- **terminal_close** [native] → (M-13)
- **terminal_list** [native] → (M-13)
- **web_fetch** [native] → (M-14)
- **web_search** [native] → (M-15)
- **goal** [native state] → (M-19)
- **todo** [native state] → (M-19)
- **jobs** [native state] → (M-19)
- **session** [native state] → (M-19)
- **ask** [native state] → (M-19)
- **present** [native, host service] → (M-20)
- **skill** [native, host service] → (M-20)
- **str_replace_editor** [native, conditional] → (M-05)
- **动态 MCP 与插件新来源** [dynamic] → 主表无行：默认 NOT_TESTED，进入 BL-21 库存后才分配行 ID

**范围声明**：本附录是**静态种子**，不是运行中 Host 的完整工具清单。真实来源清单（含动态
MCP 与插件注册、source package 与 SHA、Definition provenance）由 BL-21 从 pinned Host 导出，
动态新来源默认 `NOT_TESTED`，禁止按名称猜测 I/O 效果。BL-21..BL-26 的 source-evidenced
半场（pinned baseline 的模块→工具、注册同步/延迟、依赖与采用/退役判断）现由同目录
`NATIVE-SOURCE-INVENTORY.md` 承载；它**不是** booted Host 的导出，dynamic MCP 仍是 `NOT_TESTED`。

<!-- q5:appendix-end -->

## 3. 证据索引与门禁

| Gate | 本矩阵中的对应 |
|---|---|
| G1 | P1 机制级证据（`evidence/a5sf-p1-0{1..8}/`、`a5sf-g1/G1-GATE-REPORT.md`）；工具级：`read`/`write` = `ENFORCE-PARTIAL`、`read_image` = `BOUNDED-DEFER`、`edit` = `WIRED-NOT-ACCEPTED`（均 host-free；见 §1.1），其余仍 `NOT_WIRED` |
| G2 | BL-14 至 BL-20 代表机制正向与基本拒绝；**host-free 机制半场**已有 FS 证据（`a5sf-s1/`、`a5sf-assembly/`、`a5sf-p0/`、`a5sf-deferred/`），**live 半场**从未执行（`a5sf-acceptance/README.md`） |
| G3 | BL-22 至 BL-26 逐工具正向等价与最小权限负控（来源清单见 `NATIVE-SOURCE-INVENTORY.md`） |
| G4 | BL-27 至 BL-34 全工具与 I/O 维度矩阵 |
| G5 | BL-35 至 BL-37 对抗、故障、发布双验收 |

**本表当前结论**：G1 机制级 = 有证据；FS 工具级 = 只有 host-free 机制半场（`read`/`write`/
`read_image`/`edit`），live 半场为零行；其余工具级仍 `NOT_WIRED`；G2 至 G5 = 未完成。因此
**本表不构成 release coverage**，不得把任一 `NOT_WIRED` 或 `ENFORCE-PARTIAL` 读作能力已交付。
