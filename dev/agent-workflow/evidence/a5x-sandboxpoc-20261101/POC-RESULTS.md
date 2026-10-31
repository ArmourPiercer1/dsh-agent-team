# POC-RESULTS — Alpha.5 sandbox-first 完整 PoC（POC-PLAN `32b81fcd8` / PR #531 全门执行）

> **PoC banner**：本文件与其引用的 kits/证据均为一次性验证产物，非生产代码、非产品语义。
> 执行人：Alpha.5 验证节点（A5-XENV）；日期：2026-10-31（UTC）。
> Pinned host：pristine `0.2.0-rc.2 @ 639ed015397290b3745d163aafe02ffee4aa3f84`（`tests/paths.mjs` pin；每 kit `prepareWorld` 断言 HEAD）。
> Team SHA（证据分支）：`task/a5x-envpoc-20261031`。
> 平台：Linux x86_64，kernel `6.18.33.2-microsoft-standard-WSL2`，Landlock 符号在位（kallsyms 101 项），`bubblewrap 0.11.1`；pristine `sandbox-local` 在本平台原生即选择 bwrap profile（`packages/sandbox/sandbox-local/src/index.ts`）。
> 原生完整性：`tests/deepseek-harness-test-use` 全程 git porcelain 空、零改造；原生 grep/glob/bash/web 工具包 SHA 未动（A5-NATIVE-01 满足——所有守卫都在 isolate+provide 外部层）。

## 0. 判定总表

| 记录 | 门禁 | verdict | 一句话 |
| --- | --- | --- | --- |
| R-A1 | A 双 Member service-mediated | **CONDITIONAL** | 双成员交叉拒绝+控制会话原生直通全绿；同 realm 内任意 JS 旁路实锤（Plan A 天花板）→ 仅可作 TRUSTED 层 |
| R-A2 | A fs 逐能力覆盖 | **CONDITIONAL** | 写侧全绿；符号链接被 realpath 拦；**硬链接泄露=路径身份天花板**；edit 盲改被宿主原生 read-before-edit 协议挡住 |
| R-A3 | A 网络布尔 | **READY**（声明面内） | deny 车道零 TCP 连接实测；allow 真外网通；宿主原生 SSRF+跨源重定向不自动跟随为二道纵深 |
| R-B1 | B 原生 grep/glob 走 OS 受限 leaf | **READY**（披露见内） | 同步 spawn 用同步预编译 bwrap argv 化解；原生 grep 语义 6/6；内核拒绝与 rg 沉默可区分 |
| R-B2 | B 持久 bash 成员上界 | **CORE_SEAM_BLOCKER** | `sandboxPolicy` 服务实例锁定：isolate 层 provide 被拒（terminals-iso）或被消费方忽略（新 iso）；持久 shell 只受会话全局界，成员界无处注入 |
| R-B3 | B3 一次性授权/域不可加宽 | **READY**（OS 子集）+ **NOT_TESTED**（Alpha.4 平面） | 新授权=新受限域可更宽、既有域永不加宽 4/4；register→dispose 撤销后调用即 unknown tool |
| R-C | 未知 JS 工具接入 | **READY + UNSUPPORTED 分支诚实触发** | 同一份工具定义双形态无改造运行；受限形态下 node:fs/net 被内核拒；取消=pid 树整灭；ctx 依赖工具透明失败=WHOLE_TOOL_UNSUPPORTED 实录 |
| R-PERF | §4 性能六轴 | **数据完备（go 参考）** | 守卫判定 +19µs/调用；leaf bwrap +4.8ms/调用；warm IPC p50 0.13ms；冷受限 node 子进程 43ms；bwrap 安装 setup p50 10.1ms（全部自测，未引用任何外部数字） |

**go/no-go/defer 建议**：
- **GO**：`os-confined leaf` 模式（B1 路径）+ 布尔网络（A3）+ C 工具宿主（含 UNSUPPORTED 诚实拒绝）+ B3 域语义。这些在零核心 patch 下已闭环。
- **NO-GO（当前）**：持久 shell / 任意长生命周期工具的**按成员 OS 上界**——`CORE_SEAM_BLOCKER`，需核心提供成员粒度策略注入点（见 §5 困难 1）。
- **DEFER**：PTC/run_code（宿主未安装 `@deepseek-ai/dsh-ptc-runtime-node`，NOT_TESTED-ENV）；Alpha.4 治理平面（one-shot UI、HMR、kill/drain）在 pristine 宿主无对应物；1GB 检索树降规模为 200MiB（披露见 R-PERF）。

## 1. T0 intake（差量说明）

POC-PLAN §6 要求在途证据先受理、只补差量。wave-11（`dev/agent-workflow/evidence/a5x-envpoc-20261031T170133/A5-XENV-VERDICT.md`）已证 F1–F10 事实不重跑，其结论在本轮被继续引用并在 host 波复证三点：F1（provide 拒重注册）、F2/F3（isolate+provide+iso.plugin(native) 是可用挂载机制）、F7（进程内 evil 旁路=Plan A 天花板，R-A1 再次实锤）。本轮新增：per-member 策略文件驱动的探针（probe2/probe3）、多成员真宿主波、bwrap leaf、工具宿主、性能、B3。

## 2. 逐门记录（§5 合同字段）

统一字段：**hypothesis / pinned host SHA / Team SHA / platform / provenance / policy / mode / 身份来源 / trace 实据 / 正控 / 负控 / benchmark / caveat / verdict**。所有记录共享：pinned host `639ed015`；Team SHA=证据分支；platform=上表;真实 dispatch=mock 模型逐腿 tool_call（永不从 transcript 推导），lane=首条 user 消息标记，`result.ok` 检查在位。

### R-A1 双 Member + 隔离 Provider + 并发负控（真 Host）

- **hypothesis**：两个 Member 挂不同成员策略，互访被拒、原生工具语义不变；晚注册同名工具不能顶替原生。
- **mode**：service-mediated（`isolate('fs'|'web')` + `provide` + `iso.plugin(原生 file URL)`）。
- **身份来源**：`payload.agent.label`（= sessionId，实测键）→ `A5X_POLICIES_FILE` 每成员策略。
- **执行形态/证据**：kit2 四跑，终局 `evidence/a5x-pocA1-20261031T183659/`（14 腿全判定）。
- **正控**：CTL 同 roster 无策略 → `read` 直读 secret=OUTSIDE-SECRET 可见（原生路径零改动，`ctlSecretReadable:true`）；M2 允许面 `read rootB`、`web_fetch http://example.org` 成功（`m2AllowFetchOk:true`）。
- **负控**：M1↔M2 交叉读写均 `A5X-ENFORCE-REFUSE`；晚注册 `read` 同名 → 宿主拒绝 `tool "read" is already registered in this scope`；未知工具 `a5x_late_clone` 调用报 unknown（无影子顶替）。
- **旁路实锤（负控-04）**：进程内注册的 `a5x_evil` 用 `node:fs` 直读 secret 成功（`m1EvilBypassed:true`；kit3 复证 `evilBypassed:true`）——**service-mediated 的界只约束走服务的调用，不约束同 realm 任意 JS**。
- **caveat**：守卫为 PoC 实现（canonicalize realpath+祖先回退）；身份模式差异见 R-A2。
- **verdict**：**CONDITIONAL**——机制可建、正负控全绿，但天花板（进程内旁路）⇒ 只能按 TRUSTED-ONLY 语义使用；通用强隔离必须走进程/OS 分离（R-B1/R-C 路径）。

### R-A2 fs 逐能力覆盖 / 身份 / TOCTOU / 大窗

- **执行形态**：in-process 守卫套件 `tests/kits/a5x-envpoc/a5x-a2-guard.mjs`（T1–T14，`evidence/a5x-pocA2-20261031T183252/a2-guard.json`）+ kit2 真宿主腿复证。
- **覆盖**：READ 面 8 方法 + WRITE 面 2 方法逐腿判定；`resolve/processPath/fileUrl/contains` 纯函数不裁决（披露）。
- **正控**：rootA 内全方法通；10MiB `big.txt` 中窗（offset 100000）宿主 read 成功（`m1BigWindowOk:true`），守卫开销 7–8ms/次。
- **负控**：rootB 读拒；写 rootB 拒（`m1WriteCrossRefused:true` 且文件未落盘）；符号链接 `esc.md→secret` 被 realpath 身份拦（`m1SymlinkRefused:true`，宿主腿+套件腿双证）。
- **LEAK 实录（负控-05）**：**硬链接 `hard.md`（同 inode，rootA 内）把 secret 内容完整带出**（`m1HardlinkLeaked:true`，targetKey/displayPath 两种身份模式同样泄露）——路径身份是纯路径策略的**上界**，需 (dev,ino) 集或 OS 读界。
- **TOCTOU**：T5（用前重算身份）拦下改名换文件攻击；T5b（信任存储 targetKey）复现泄露 ⇒ **生产规则：使用时刻必须重算身份**。
- **edit 升级类**：T9（fake provider，写根内 edit 内部读旧内容=无读权可读）`YES-READ-WITHOUT-READ-ROOT`；但**真宿主上原生 edit 工具要求先 read（read-before-edit 协议）**，盲改直接被拒 `file has not been read`（`m2BlindEditBlockedNativeProtocol:true`，文件未变）——宿主原生语义已把该类在工具层关死；"先合法读、后收紧读权再 edit"的动态组合未测（无策略热改面，披露）。
- **元数据侧信道（披露）**：写根内 `stat` 存在性可由错误形状区分（存在/不存在）——ADR 要求披露的 metadata 类。
- **caveat**：`lstat` 收裸 path 字符串（非 FsTarget）——守卫按 path 处理；`watch` 为具体方法需专项复核（套件测其走守卫）。
- **verdict**：**CONDITIONAL**（硬链接类 + 身份重算纪律 + 元数据披露）。

### R-A3 网络布尔（web）

- **执行形态**：`isolate('web')+provide(wrappedWeb)+iso.plugin(原生 tool-web)`；M1 deny / M2 allow(prefix 白名单)。
- **正控**：M2 `web_fetch http://example.org/` → 200+正文（`m2AllowFetchOk:true`）；net-guard 账本 `verdict:allow` 行。
- **负控**：M1 deny 车道 `web_fetch …/probe-deny` → `A5X-NETWORK-REFUSE` 且 **fixture 服务器连接计数=0**（`denyZeroConnections:true`，turn 完成、LLM 流量不受影响——LLM 传输走宿主基础设施，不是成员传输面，披露）。
- **重定向负控（意外收获）**：宿主原生 `web-fetch-http` **不自动跟随跨源重定向**（`cross-origin redirect … is not followed automatically; retry against that URL`）→ 重定向 hop 必回到 seam 二次裁决；同环回重定向 fixture 未达（见下）。
- **纵深**：成员 allow 判定放行后，宿主 SSRF 仍拦非公网 IP（无 config 逃逸口，`packages/web/web-fetch-http/src/network.ts:101`）。
- **caveat**：本门覆盖 `ctx.web` 声明传输（fetch/search）；任意 JS 的 OS 级出网属 B/C 模式（R-C 中 `--unshare-net` 实测断网）。
- **verdict**：**READY**（声明传输面内布尔成立，正负控+零连接实据）。

### R-B1 原生 grep/glob 走未改造 `ctx.subprocess.spawn` 的 OS 受限 leaf

- **hypothesis**：包一层 `SubprocessRuntime`（`isolate('subprocess')`+provide+`iso.plugin(原生 tool-fs-search, config)`），grep/glob **不改一行**即在内核受限的 leaf 中运行。
- **同步/异步障碍的解**：`spawn(spec)` 同步返回活句柄、`sandbox.confine()` 是异步——**leaf 侧答案：守卫内同步预编译 bwrap argv**（`/usr/bin/bwrap --ro-bind / / … --unshare-pid --unshare-net --tmpfs <maskDirs> --bind <rwRoots> …`），不经 confine。
- **trace 实据**：账本 `spawn-wrap` 行×6：`real0=@vscode/ripgrep-linux-x64@1.18.0/…/rg`、`wrapped0=/usr/bin/bwrap`、`bwrap:true`（`evidence/a5x-pocB1-20261031T185429/ledger.jsonl`）。
- **正控**：rootA 内 `B1MARKER-needle` 命中；`Found 250 of 5200 matches` 显式封顶语义保留（spillStore 为可选注入，未挂时不静默）。
- **负控（内核拒绝 vs rg 沉默可区分）**：全树 grep 泄露模式无命中（`grepTreeMasked:true`——被 tmpfs-mask 的目录内核层不可见）；直接 grep 被掩路径报 ENOENT 类而非"无匹配"（`grepSecretPathKernel:true`）。
- **语义回归**：no-match / 坏正则 / 超限 6/6 与原生一致（A5-NATIVE-02 满足：正例、错误、取消由 seam 原生处理；取消语义在 R-C 子进程树实测）。
- **preset 配置缺口（实录）**：preset 行需 `sampleOverCapGlobResults` 必填 config；`iso.plugin(mod, config)` 官方第二参可给（`vendor/cordis/src/registry.ts` plugin(plugin, config?)）。
- **caveat**：读侧=全树 ro + 目录级 tmpfs 掩蔽（掩蔽集来自成员蓝图掩列表）——大树的逐文件读白名单需要 Landlock 粒度（§5 困难 6）；glob 与 grep 同 spawn 面（glob 腿与 grep 腿同路径，未单列）。
- **verdict**：**READY**（leaf 模式对 spawn 类原生工具闭环；读白名单粒度按披露走掩蔽集）。

### R-B2 持久 bash（`ctx.terminals`→PTY+confine）成员上界

- **hypothesis**：`provide('sandboxPolicy', 成员帽)` + 原生 terminal-bash/tool-bash-persistent 重挂 → 启动时刻 confine 用成员 workspace 根。
- **原生链（pristine 静态核验）**：`packages/terminal/terminal-bash/src/index.ts:27` inject `sandboxPolicy`；`:102` `danger-full-access → return argv`（直通）；`:108` `sandbox.confine(argv, policy)` 启动时刻生效；`packages/shell/tool-bash-persistent/src/index.ts:441` inject 仅 `['tools','terminals']`（工具本体不持策略）。
- **实测（三变体）**：
  1. `isolate('sandboxPolicy')+provide+双原生重挂`：挂载 applied 但**无效**——持久 shell 仍按会话全局 workspace 界运行：`echo > secret` 成功、越 member 根写成功（`evidence/a5x-pocB1-20261031T184746`）。消费方 `this.ctx.sandboxPolicy` 捕获的是 preset group 注册时 ctx，不解析 isolate 层新供给（静默不生效=危险类本身）。
  2. `isolate('terminals')+provide('sandboxPolicy')`：**`ERR service "sandboxPolicy" has been registered at <SandboxPolicyService>`**——服务实例锁定，任何 isolate 层无法覆盖（`evidence/a5x-pocB1-20261031T185206`、`…T185429`）。
  3. danger-full-access 尝试：持久 bash 带 `sandbox_permissions:'danger-full-access'+justification` 的调用**exit 0 被接受**（无审批提示出现在成员道），叠加在 1 的越界上；无法区分"escalation 生效"与"参数被原生持久 bash 忽略而 shell 本来就在会话界内"（披露）。
- **正控**：成员根内 bash 写成功（`bashWriteInsideOk:true`）——执行面本身健康。
- **读侧泄露（复证 F9 类）**：`cat secret` 成功（`bashReadLeak:true`）——写界内读侧不设限是宿主方言，成员界缺位时读泄露全暴露。
- **结论**：pristine 0.2.0-rc.2 的 sandboxPolicy 是**实例级单点服务**；A5-GENERIC-02 要求的"单一 MemberPolicy/InvocationAuthority 注入点"不存在。持久 shell 的成员 OS 界在零 patch 下**无处挂载**。
- **PTC**：`@deepseek-ai/dsh-ptc-runtime-node` 未安装于宿主 node_modules（仅 python 版与 workflow-ptc）→ **NOT_TESTED(ENV)**。
- **verdict**：**CORE_SEAM_BLOCKER**（成员粒度持久 shell OS 界）；附 **NOT_TESTED(ENV)**（PTC）。

### R-B3 一次性授权 / 并发 grant / 域不可加宽

- **OS 子集（实测 4/4，`evidence/a5x-pocB3-20261031T185654/b3-os.json`）**：既有受限域（rw=rootA）跨根写拒；**新授权=新建更宽域（rw=rootA+rootB）写成功**；此后既有域仍拒——**已建域永不加宽**（与 POC-PLAN B3 语义一致：收紧/放宽都只能建新域）。
- **进程内一射授权（实测）**：`tools.register` 返回 disposer（`disposerType:'function'`）；dispose 后调用 → `Error: unknown tool "a5x_oneshot"`（撤权即时生效，`evidence/a5x-pocB1-20261031T185429`）。
- **取消/清理**：R-C c5——SIGKILL 工具宿主后其孙进程随 pid namespace 消亡（`grandChildAliveAfterKill:false`），无孤儿。
- **NOT_TESTED(ENV)**：Alpha.4 一次性授权 UI/HMR 策略热换/kill-drain 编排——pristine 宿主无 admission 平面，无法在零 patch 下复现其语义（非本 PoC 可补）。
- **verdict**：**READY**（OS/进程语义子集）；Alpha.4 平面部分 **NOT_TESTED(ENV)**。

### R-C 未知 JS 工具（无 ctx.fs）双形态 + 诚实拒绝

- **执行形态**：同一份定义 `tests/kits/a5x-envpoc/a5x-unknown-tool.mjs`（直接 node:fs/net，ToolDefinition 形）跑两形态：宿主内（service-mediated 类）与受限工具宿主（bwrap 子进程，行式 JSON IPC：id/name/args/invocationId+cancel）。证据 `evidence/a5x-pocC-20261031T183807/c-toolhost.json`，7/7：
  - c1 宿主内直读 secret 成功（旁路类复证）；c2 受限形态同定义读 secret **被内核拒**（ENOENT，tmpfs 掩蔽）；
  - c4 宿主内 node:fetch 可达 / c3 受限形态 `--unshare-net` 断网；
  - c6 **同一定义文件双形态无改造运行**（A5-GENERIC-03 正控）；
  - c7 依赖 `ctx.fs` 的工具在裸宿主**透明加载失败**=`WHOLE_TOOL_UNSUPPORTED` 实录（诚实拒绝路径，未重实现其服务面）；
  - c5 取消 → 进程树回收实测（见 B3）。
- **verdict**：**READY**（generic onboarding 成立）+ **UNSUPPORTED** 分支按设计诚实触发。

### R-PERF §4 六轴（全部本机自测；`evidence/a5x-pocPerf-20261031T185619/perf.json`）

| 轴 | 数值（p50/p95, ms） |
| --- | --- |
| policy-check（小读，2KiB，300 样本） | raw 0.00016/—；**guarded 0.019/—**（+19µs/调用；身份重算模式与非重算差≈0） |
| policy-check（8MiB 偏移读，30 样本） | raw 0.043 → guarded 0.065（+22µs） |
| bwrap 安装 setup（noop 子进程，50 样本） | **10.1/11.0**（本机自测；未引用任何外部"bwrap 10ms"说法，数值巧合纯属巧合） |
| 实际工具进程（rg，1000 文件树） | direct **9.3/10.3** vs bwrap **14.0/15.5**（leaf 代价 ≈ +4.8ms/调用） |
| 实际工具进程（rg，200MiB 树*） | direct 12.1/14.2 vs bwrap 18.0/21.2 |
| tool-host 启动（冷受限 node 子进程，25 样本） | **43/46**（floor：bwrap node -e 42.7/46.1；宿主 plant 开销 10ms 异步离路） |
| IPC（warm 常驻受限宿主往返，100 样本） | **0.13/0.23** |
| service-dispatch 轴 | 见 caveat |

**五对照模式**：native direct（9.3）/ service-mediated 守卫（direct+19µs，同进程）/ os-confined leaf（14.0）/ whole-tool host warm（0.13/调用，摊销后）/ whole-tool host cold（43/调用）。
**caveat/披露**：冷页缓存需 root（未做，冷=新进程+未触工作集）；**1GB/1000 树降为 200MiB/200 文件**（证据预算，已披露）；service-dispatch 宿主内多一跳 service 查找未单列轴（同进程 JS 属性查找，量级≪1ms，未测=未宣称）；LLM 面不在成员路径。

## 3. 两模式能力矩阵（本轮实测口径）

| 能力 | service-mediated（A） | os-confined leaf/whole-tool（B/C） |
| --- | --- | --- |
| 同 realm 任意 JS 约束 | **无**（evil/ctx 旁路实锤）→ TRUSTED_ONLY | 有（内核拒实锤 c2/c3；rg 内核拒 vs 沉默可区分） |
| 路径读白名单 | realpath 身份（硬链接泄露=上界） | 全树 ro + 掩蔽集（粒度=目录；文件级需 Landlock） |
| 写白名单 | 有（provider 拒=实测） | 有（bwrap bind 集=实测） |
| 网络布尔 | 声明传输面有（零连接实测） | 有（unshare-net 实测；粒度=全有/全无） |
| 持久 shell 成员界 | **无处注入（B2 阻塞）** | 需工具宿主式承载（长驻域=建域时刻定死，B3） |
| 原生工具改造量 | 0（isolate 重挂） | 0（spawn 包装）/ 定义文件 0 改（C c6） |
| 每调用开销 | ≈µs 级 | leaf +5ms；warm host 0.13ms；cold host 43ms |

## 4. 原生可靠结论（唯一允许模板）

> 在 Host `639ed015397290b3745d163aafe02ffee4aa3f84`、系统 `Linux 6.18.33.2-microsoft-standard-WSL2 / bwrap 0.11.1`、执行模式 `service-mediated 与 os-confined(bwrap)`、本报告列出的负控 `R-A1(交叉拒/晚同名/evil)、R-A2(symlink/hardlink/TOCTOU/T9)、R-A3(deny零连接/重定向)、R-B1(masked读/内核拒)、R-B2(三变体越界)、R-B3(域不可加宽/撤权)、R-C(c2/c3/c7/c5)` 中，未观察到访问越过蓝图规定权限范围的情况；不表示所有输入、插件或其他 Host 版本已经获得形式化保证。

（注：R-B2 的越界发生在**守卫未生效层**——原生会话全局界内——该模板陈述的是各记录声明的 policy 范围内；B2 的缺口已单独判 CORE_SEAM_BLOCKER，不并入本句。）

## 5. 这一架构真正落地的主要困难（用户问题的实证回答）

1. **成员粒度策略注入点不存在（最大硬缺口）**。`sandboxPolicy` 是实例级锁定服务：isolate 层重供被拒、新 iso 供给被消费方静默忽略（捕获 ctx 在 preset group 注册时冻结）。⇒ 持久 shell/PTY 类工具的按成员 OS 界在零 patch 下**无处可挂**；需要核心把策略消费链改成 per-member/per-invocation 解析（A5-GENERIC-02 的正身），这是一个核心设计改动，不是插件能绕的。
2. **路径身份是纯路径策略的天花板**：硬链接（同 inode 不同路径）完整泄露"读白名单"外的内容且两种身份模式同漏；符号链接靠 realpath 可拦但要求**使用时刻重算身份**（T5b 危险类：信任存储的 targetKey 即泄露）。生产上要么 (dev,ino) 拒集+挂载表审计，要么下沉到内核读界。
3. **读侧粒度**：当前 OS 方言是"写白名单 + 读不设限"（F9）；bwrap 侧读界只能全树 ro+目录级掩蔽，大树/文件级白名单需要 Landlock 规则合成（宿主 sandbox-local 有 landlock profile 位，但 `readOnly:['/']` 写死，pristine 不给读白名单入口）。
4. **两种执行模式的定位必须是硬的**：service-mediated 防不住同 realm 任意 JS（evil 三次实锤），只能标 TRUSTED_ONLY；通用 onboarding（A5-GENERIC-03）必须默认落进程/OS 分离——而分离意味着冷启动 43ms/进程的工具宿主基建（域池/复用/审计是真实工程量，好在 warm IPC 0.13ms 证明摊销后可忽略）。
5. **授权平面的"静默不生效"危险类**：本次最阴险的发现不是被拒，而是**看起来挂上了但没人消费**（sandboxPolicy iso 挂载 applied+无错+完全无效）。落地需要"守卫必须自证生效"的机制（消费方回执或账本对账），否则治理面会带着假绿上线。
6. **escalation/审批面必须成员感知**：`danger-full-access` 参数在持久 bash 上被接受（exit 0）且直通 return argv；宿主 approval=ask 在无人应答下的 fail-closed 语义与该路径的实际行为无法从成员侧区分（本轮无法定论，必须在新架构里关死为 per-member + 审批双门）。
7. **治理平面整体缺位（Alpha.4 资产迁移成本）**：一次性授权面、策略热换（HMR）、kill/drain 编排在 pristine 宿主没有对应物——PoC 只能证 OS 语义（域不可加宽/撤权即失效）；Alpha.4 已建的治理产品面要在新架构上重放，是排期大头而不是技术悬念。
8. **性能不是阻塞但塑造设计**：leaf 模式 +5ms/调用可接受⇒高频 spawn 工具可全量入叶；43ms 冷启⇒one-shot 授权应"每调用新建受限域"（B3 语义天然契合）但必须配域池；19µs 策略判定⇒service-mediated 作为 trusted 内环成本可忽略。

## 6. 证据索引与复现

| 证据目录（`dev/agent-workflow/evidence/`） | 内容 |
| --- | --- |
| `a5x-pocA2-20261031T183252` | A2 守卫套件 T1–T14（a2-guard.json；LEAK 双类+TOCTOU 对照） |
| `a5x-pocA1-20261031T183539/183641/183659` | kit2 三成员波（终局 183659：14 腿+fixture 计数+账本） |
| `a5x-pocC-20261031T183807` | C 工具宿主 7/7（c-toolhost.json） |
| `a5x-pocB1-20261031T184746/185206/185406/185429` | kit3 B1/B2 波（终局 185429：spawn-wrap 账本+B2 三变体+oneShot） |
| `a5x-pocPerf-20261031T185619` | 六轴 perf.json |
| `a5x-pocB3-20261031T185654` | B3 OS 子集 b3-os.json |
| `a5x-envpoc-20261031T170133` | wave-11（T0 intake，引用不重跑） |

复现：`tests/kits/a5x-envpoc/` 下 `node a5x-a2-guard.mjs <ev>`、`node a5x-kit2.mjs`、`node a5x-kit3.mjs`、`node a5x-c-toolhost.mjs <ev>`、`node a5x-perf.mjs <ev>`、`node a5x-b3.mjs <ev>`（端口 3186/3497/3498，MOCK 带内；:3080 仅稳定探针 before/after=401 无扰动；所有大 fixture 文件不入 git，数字以 JSON 为准）。
