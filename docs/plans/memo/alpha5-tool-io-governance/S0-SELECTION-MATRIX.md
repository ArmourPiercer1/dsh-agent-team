# S0 — 统一选型矩阵（Alpha.5 Tool I/O Governance · 唯一权威选型矩阵）

> **总状态：P0 NOT CLOSED；本矩阵是实施选型权威，不是产品 GO。**
>
> **状态：** S0 交付（文档性阶段；按 [S0+PR0–PR8 实施计划 §2](./alpha5-s0-pr0-pr8-implementation-plan.md) 构造）。
> **日期：** 2026-10-16。
> **基线：** 本文件所在分支基线 `origin/master = b6c99de2fa5c9b5bd8ba0cdfa698a2fbc0d510f0`；PoC 证据快照 = PR #249 线 `exp/alpha5-poc-20261016`（终态取证 HEAD `a2e741a02c4f0126f0aa6615c02c51877f7f3dba`）；DSH 宿主固定基线 `0.2.0-rc.2 @ 639ed015397290b3745d163aafe02ffee4aa3f84`（全程 porcelain=0，多轮独立实测）。
> **语义权威：** [接管分类与执行控制设计](./post-poc-technical-design.md)（§0/§2/§3）；裁决权威 = [Alpha.5 ADR §8](./ADR-alpha5-tool-io-governance.md) + [Architecture V2 §14](./architecture.md)；Fork 债务 = [tool-fork-debt](./tool-fork-debt.md)。原始证据 = [P0-SELECTION-REPORT](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/P0-SELECTION-REPORT.md)、[negative-cases](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/negative-cases.md)、[EXECUTION-LOG](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/EXECUTION-LOG.md)。
> **用途边界：** 本矩阵把"技术候选"与"产品支持"分离（计划 §2）。每族结论只能回答"首选/备选/不可用/PoC 分叉/owner/验收证据/未测项/默认处理"；`INCONCLUSIVE`、单一 PASS 或 fixture PASS 不等于 GO（设计 §8）。任何 PR 的真实 Host 门、独立 Reviewer 门、Baseline-diff 门照常执行，不因本矩阵减免。

---

## 1. Supersession 表（旧记录 → 最新事实；旧记录只引用、不篡改）

规则（计划 §2）：`decision.md` 与 `env-capability-matrix.md` 的原始记录**原文保留**；下表登记每条过期项的最新事实与修正依据。**证据权威不是"最近一次 test PASS 即产品可用"**（设计 §0）：后续有明确反例或修正的记录优先于旧判定。

| # | 旧记录（原文位置，只引用） | 旧结论 | 最新事实（本矩阵采用） | 根因 / 修正依据 | 证据 |
|---|---|---|---|---|---|
| SUP-01 | decision.md §2 bash/pwsh 行；P0-4 首轮判定 | "Landlock 受限读 = ENV_BLOCK（接口应答、观察不到强制）；嵌套 bwrap/landlock/netns 全部实测不可行" | **Landlock ABI v4 文件读写域 = OS_ENFORCED**（子进程自锁路线，不依赖 userns/bwrap）；bwrap/netns/uid_map 三行**维持各自 ENV_BLOCK** | 根因=探针常量 bug：`READ = 3` 实为 `EXECUTE|WRITE_FILE`，`READ_FILE|READ_DIR = 0xC` 从未进 handled_access_fs ⇒ 读根本不被中介，"secret 仍可整读"是该配置错的必然产物；修正后负控 `EACCES`+零规则鉴别器+fork/exec 继承腿，ext4/tmpfs 双 fs `OVERALL rc=0 ENFORCE-WORKS` | [corrections-addendum](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/04-process/corrections-addendum.md)、[landlock-diagnosis.md §1–§2](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/04-process/landlock-diagnosis.md)（da67ed8e）、[10-landlock-lanes](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/10-landlock-lanes/notes.md)（56a2091d） |
| SUP-02 | env-capability-matrix.md §B B0 | "`/sys/kernel/security/landlock` 不存在 = 环境异常候选" | **撤销该信号意义**：mainline Landlock 不在 securityfs 建目，缺失是正常形态，与强制在场无关（相关信号 = `/sys/kernel/security/lsm` 含 landlock） | landlock-diagnosis §3.5 | 同上 |
| SUP-03 | env-capability-matrix.md §B B1 复核行 | "零拦截…未从内部定论根因" | 根因已定 = 上述探针配置错（handled_access 不全），**环境无异常** | diag/run-bugrepro.log 对照：同常量逐字复跑复现 NEG-FAIL，handled=0x7FFF 后 EACCES | 同上 |
| SUP-04 | env-capability-matrix.md §结论 1 | "本环境内不存在可用的第二层 OS 强制" | **不成立（部分撤销）**：进程自锁 Landlock 是本环境实测可用的第二层强制（读写面收缩） | 同上 | 同上 |
| SUP-05 | env-capability-matrix.md §结论 2 | "受限读需宿主级动作" | **部分撤销**：受限读可由 adapter 在子进程 exec 前自锁达成；仅 bwrap 嵌套与 uid 映射降权仍需宿主级动作 | landlock-diagnosis §2/§5 | 同上 |
| SUP-06 | P0-SELECTION-REPORT §0 早期定性候选 | "嵌套**结构性不可能**" | **撤回，不作为结论**。实测为**分层拦截点**：①非 user 类 ns 在 `unshare()` 调用层即 EPERM（本进程 CapBnd=0，无 CAP_SYS_ADMIN 可达路径）；②`uid_map` 写入被内核直接 EPERM（两处相同）；③bwrap rc=1 `No permissions to create new namespace`（维持）。`apparmor_restrict_unprivileged_userns=1` 为在场旋钮，沙箱内 profile 集不可读，**不确证其为唯一因，不外推** | landlock-diagnosis §4 实测表 | [landlock-diagnosis.md §4](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/04-process/landlock-diagnosis.md) |
| SUP-07 | decision.md §2 web/jobs/MCP 行 | "**NOT RUN**（本轮无网络授权）" | 09 路回环/mock 三 runner **30/30 PASS**（web 10 + jobs 12 + mcp 8，幂等×3）→ 三族各判 **INCONCLUSIVE（方向性）×3，无 GO**；真实外网/owner 隔离/远端保证仍无产品 GO | 拒绝发生在 fetch 调用点之前（零 socket/零 DNS/tripwire=0）；回环结果**不扩张**产品保证（PoC-7a） | [09 notes](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/09-web-jobs-mcp/notes.md)、p09-{web,jobs,mcp}-result.json（43c8e8c8） |
| SUP-08 | 旧工具面假设（含本计划起草时的 `job_start` 疑虑） | 原生 Job 可能含启动类模型工具 | pinned 0.2.0-rc.2 模型面**仅** `job_output`/`job_list`/`job_kill`（src/index.ts:311/352/372 grep 证实）+ producer seam；**无 job_start**，不杜撰；owner-scoped 腿 NOT_RUN（缺 dsh-agent，生产 fail-loud 原文已录） | 09 路 grep 亲验+fail-loud 原文 | 同上（jobs 表行） |
| SUP-09 | 旧 Coverage 假设（设计 §0 表 "Setup 时检查完成即可"） | Setup Coverage Gate 检查完成 = 分发面已治理 | **发现反证：H6 `dynRan=true`** —— 同 Scope 后注册的未知工具**体确实执行**（`hc-dyn-observation.dynCallResult='H6_DYN_RAN'`）；本 PoC 运行时 Guard 对 unmanaged 名**弃权**。必须增加**持续 closed-world 最终 Guard**（PR1）；PR1 验收预期把该行为改为 typed deny（KIT 断言更新但保留 PoC 原始记录） | `tools.restrict` 不限制当前 Own Layer 新注册（设计 §4.1）；fail-closed 线现在 setup Coverage Gate（UNKNOWN_UNMANAGED FATAL），须实施期钉死 | [stage2b notes](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/07-integration/03-stage2b/notes.md)（续-7/h6 attempt3 披露 1）、h6-result.json H-C observation |
| SUP-10 | 早期假设 "realpath 防别名足够"（设计 §0 表） | realpath 判定可封对象身份 | **NEG-11 实证硬链接绕过**：realpath(别名)=别名∈allowed（POSIX 硬链接无正本）。realpath+`(dev,ino)` 拒绝集=**编译期快照**，仅封登记时已存在对象；未闭合边界=①登记后新建指向被禁 inode 的硬链接（新写入对象不在集内）②unlink+重建 ③检查与 open 之间 TOCTOU/替换竞态。`openat2` 候选不自动构成任意别名/动态 Deny 的完整证明（设计 §3.1） | decision.md §3.4 收紧注记 | NEG-11 行、[03-fs notes 发现 2](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/03-fs/notes.md) |
| SUP-11 | 早期假设（设计 §0 表 Scoped Adapter 行） | 同名注册"可能"遭晚期重解析原体回落（未证实） | 竞态窗**实存**：dispatch 期 `resolveExecution`（pinned index.ts:1578）晚期重解析。safe 序（先卸 Adapter、mask 保留）native=0；**lift-mask 危险序确定性 native=1**（NEG-1）→ 装配/卸载必须单一有序单元+在飞排空证明（D-1） | NEG-1 hazard/对照组各 7 连跑稳定（R1 复跑） | [p01-result.json](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/01-routing/p01-result.json)、negative-cases NEG-1 |
| SUP-12 | 早期假设（设计 §0 表 grep/glob 行）；A5-FORK-001 潜在候选 | 原生工具体可能必须 Fork（R4） | **R3（包根 7 helper + async confine 桥）已有真 rg 12/12 对照（fixture）+ 真宿主 H-B multiset 4==4**；R2 仅**缺 subprocess 服务前置**（fiber PENDING 零注册，非 throw，非根本不可行）；**R4 = NOT-ELIGIBLE，暂无 Fork 资格** | fiber PENDING ≠ 原生工具不可能接入（计划 §13） | [02-search notes](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/02-search/notes.md)、h6-result.json H-B |
| SUP-13 | 早期推论 "Landlock 成立即能 network deny"（设计 §0 表） | OS 文件域强制 ⇒ 网络/元数据一并封禁 | **错误**。Landlock ABI4 ≠ 任意网络通信全隔离（IPv4/IPv6/UDP/Unix Socket/FD 继承各自独立），亦不保证完整 `stat`/目录元数据隐私；`network:deny`、metadata 严格 Profile 须**独立证明**（PoC-4b/PoC-4a），否则 `IO_POLICY_UNSUPPORTED` | lanes 实测 `listdir(~/.ssh)` 仍 OK（READ_DIR 合并 search+enumerate，设计行为） | [10-landlock-lanes notes](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/10-landlock-lanes/notes.md) errno 节、设计 §3.3/§5 |
| SUP-14 | 早期结论 "无法注册 `run_code` 即不可治理"（设计 §0 表） | 保留传输 = 治理死角 | 保留传输不可覆盖（register/restrict 双侧 typed throw，REG1 对基线**逐字节**等）；治理路线 = **保留 DSH 传输** + 外层 `dsh-ptc-runtime-node`（EXISTS-PUBLIC，真实 OS 进程）+ 内层 `tools.*` 复入同一 ToolRuntime 分级管线、guard 单调拒绝→原体 0；**每调用真实策略注入仍需 PoC-6a 专项验证** | 内层问题无需 CORE_SEAM_BLOCKER（桥可公开构造） | [05-ptc notes](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/05-ptc/notes.md)、ptc-outer-result.json（2b61441a）、h6-result.json HC3 |
| SUP-15 | 早期假设（设计 §0 表 LSP 行）"原生语言服务器只读" | lsp 只读、workspace containment 足够 | **HAZARD-OBSERVED**：池键=仅路径身份（`LspQueryRequest` 无 agent/policy 字段），同 Workspace 不同策略**复用同一常驻 PID**（opens=2）；服务器侧自定义方法以自身 OS 权限读被禁文件成功（虚构数据）；host.ts:91 containment 只护宿主预读。§6.1 十一字段 CORE 素材已录（**素材，非宣告**）；严格 Profile fail-closed 为安全兜底 | 结构性不可表达（今日池键不可能含策略），realm 级隔离为现公开面唯一可用形态 | [06-lsp notes](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/06-lsp/notes.md)、NEG-9/NEG-10 |
| SUP-16 | EXECUTION-LOG 续-6 定性候选（stage2b run4 OOM） | exit 134 → 疑似内核 OOM killer | **exit134 = kit 进程 V8 堆耗尽**（2GB heap 存语料，node abort）；**exit134 单独不能断言内核 OOM killer**，机制层级以 notes 的 V8 堆证据为准；观察到的是测试进程自身失败、无已发现的持续影响、内核层未验证（dmesg EPERM）。根因=oracle 以 `role==='tool'` 计数恒 0 → 重放 1747 次（驱动者是 ORACLE 非模型），已修 oracle+storm fuse>300 | 块形勘定：本代模型请求为 Anthropic 风格 tool_use/tool_result，无 role='tool' | [stage2b notes run 22-32-37](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/07-integration/03-stage2b/notes.md)、wire-capture.json |
| SUP-17 | P0-SELECTION-REPORT §1 P0-0 行（aaf327a8 前） | P0-0 = 4/4 | **5/5**（补 preset 父子拓扑腿后回填；R1-F2 记为低报方向 staleness，已处置） | 报告回填 | [p07-review-R1 §3-F2 / R2 §1#12](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/08-review/p07-review-R2.md) |
| SUP-18 | EXECUTION-LOG P0-5 行（原文）与 R2 前置引文 | "LSP 10 腿"；fiber.ts 注释 "147-156" | **11 腿**（P05-LSP-0..10）；PENDING 语义注释精确在 **140-146**（147-156=enum 本体）。两处已在台账修正，原文按 R2 报告留档 | R2 §4-N2/N3（均低报/一线之偏方向，非夸大） | [p07-review-R2 §4](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/08-review/p07-review-R2.md) |

**不可上升为已完成产品的事实（设计 §0 原文语义）：** P0 总状态 `EXECUTED-PARTIAL / P0 NOT CLOSED`；真实 Host Stage2b 10/10、H6 18/18 与独立 Reviewer PASS 是*特定测试集*的完成，不是所有工具族安全合格。

---

## 2. 逐工具族选型矩阵

层级标注：**fixture** = 进程内 cordis/ToolRuntime 测试定义级；**OS** = fixture 子进程级 OS 中介（errno 原文，规则由测试代码编译）；**host** = 真实 pinned 宿主（:3185 隔离 world、mock-model Team world）级。owner PR 依赖序 = S0→PR0→PR1→PR2→(PR3∥PR4)→PR5→PR8，PR6∥PR7（计划 §1）。证据路径省略前缀 `EV/` = `dev/agent-workflow/evidence/alpha5-adapter-p0/`。

| # | 工具族（八类归属，设计 §3） | 首选路线（R1 + 实现选择） | 备选路线 | 不可用 / 禁用路径 | PoC 分叉结果（设计 §7 D 项） | owner PR | 验收证据（文件 → 判定 → 层级） | 未测项 | 默认处理 |
|---|---|---|---|---|---|---|---|---|---|
| M-01 | `read`（A 可信 FS API） | **R1 + PR3 `ControlledFs`**：per-call Grant 绑定真实 open/stat，检查先于 open（"非输出过滤"操作性定义） | R2（固定策略 Agent FS 服务重装）仅当每调用差异/异步/Grant-Result Identity 隔离可证（设计 §3.1 选型） | 原生 fs-sandbox 读直通（S-10/NEG-3）；仅 realpath（NEG-11）；结果过滤代替 OS/中介拒绝；未适配旁路并存（NEG-12） | D2 部分闭合：快照内对象+别名闭环；动态别名/TOCTOU 未闭合→窄 Profile 或 `IO_POLICY_UNSUPPORTED` | PR0/1/2/3 | [EV/03-fs/p03-result.json](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/03-fs/p03-result.json)（11/11，strace open=0，fixture；R2 delta 复核 VERIFIED）+ [h6-result.json](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/07-integration/03-stage2b/h6-result.json) H-A（PASS：账本 2 OPEN/2 DENY、wireContentHits=0，host）+ [REG1 §2a](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/08-review/p07-review-REG1.md)（分层字段亲验） | rename/symlink 重定向竞态、watch、`~/` Realm Home、流式读、权限世代变更后重校验 | PR1 覆盖不变式未闭合前**拒绝**（`TEAM_TOOL_UNGOVERNED`）；不能保证的 Profile 启动前 `IO_POLICY_UNSUPPORTED` |
| M-02 | `write`（A） | 同 M-01（写面）；`write` 覆盖返回 before/diff 需 Read 或严格无旧内容输出（设计 §3.1） | 同 M-01 | write-only 借 Diff 偷读旧内容；无检查 raw path write | D2 同 M-01；"抑制 diff 但写成功"变体未测 | PR0/1/2/3 | EV/03-fs/p03-result.json FS-02.refusal（typed `READ_REQUIRED_FOR_EDIT`、strace 旧内容 0 open、sha/mtime 不变，fixture→R2 复核 VERIFIED）+ h6 HD-deny（typed 拒 + bytesUnchanged，host） | 原子替换/rename 两端身份、temp 文件序列 | 仅 write 权限的覆盖：严格无旧内容输出，否则 typed 拒绝 |
| M-03 | `edit`（A） | 同 M-01；**隐含 read-before-edit 观测前置为宿主真实语义**（原文 `file has not been read — read the file, then retry`，stage2b attempt2），策略不得绕过亦不得借此回传旧内容 | 同 M-01 | edit 以 write-only Grant 执行；旧内容经错误消息泄漏 | D2 同 M-01 | PR0/1/2/3 | h6 H-D EDIT 车道：**每批准恰好执行一次**（`EDIT_APPLIED_2` 的 old-text 只存在于批准 #1 执行之后），host；REG1 §2b 账本 1:1:1 亲验 | 并发双 Member 同目标 edit、冷恢复 | 同 M-02 |
| M-04 | `str_replace_editor`（A，按子命令） | 子命令级 I/O 映射（view=read/list/stat；create/insert/str_replace=create/write+必要时 read old；设计 §3.1 表） | 同 M-01 | 把整个 editor 当纯写工具；读写取自不同可变作用域 | D2 子命令全谱未测 | PR0/1/2/3 | 子命令映射目前仅设计条款（P0 未跑 editor 全谱） | view/insert/delete 全谱、undo 历史 I/O | **子命令不可精确映射者默认拒绝**（typed） |
| M-05 | `read_image`（A） | 同 M-01 + 附件/渲染存储保持授权身份（设计 §3.1） | 同 M-01 | 附件落未授权渲染路径；以缩略图绕过 read 授权 | 未开腿 | PR0/1/2/3 | 无 PoC 证据（03-fs 未测清单明文含 read_image） | 全链 | `NOT_VERIFIED` → strict Profile 拒绝至 PR3 验收 |
| M-06 | `grep` / `glob`（B 外部搜索进程） | **R1 + R3**：包根公开 7 helper（`parseGrepArgs/buildGrepCommand/parseGrepMatches/parseGlobArgs/buildGlobCommand/resolveRgPath/toWorkdirRelative`）+ Team async `execute` 先 Admission/confine 再经公开同步 `ctx.subprocess.spawn` 起真 rg；自管 bounded output/presentationMeta/Spill | **R2**（`ctx.isolate('subprocess')`+Provider+原生 `applyGrepTool/applyGlobTool` 重装）保留为 fallback；须验服务真 READY（fiber PENDING≠成功注册） | **R4 NOT-ELIGIBLE（无 Fork 资格）**；同步 spawn 内 `await confine`（NEG-7）；未授权子树靠结果过滤；`searchRg` 不存在（体=`runRipgrep`） | **D4 → 倾向 R3**：fixture parity 全绿 + host H-B 等价；R2 = 前置缺失（fiber PENDING 零注册，非证伪）；PoC-5 仅在 R3 不满足功能契约时启动 | PR5（依赖 PR3+PR4 接口冻结） | [EV/02-search/p02-result.json](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/02-search/p02-result.json)（SRCH-03 12/12 真 rg 15.0.0，argv 全存；R2 复核 digest 逐字节重放 VERIFIED，fixture）+ [spill-result.json](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/02-search/spill-result.json)（SRCH-04 4/4，fixture）+ h6 H-B（PASS/PASS/PASS/PASS：package-root、multiset 4==4、deny-before-spawn，host）+ REG1 重跑 | presentationMeta 等价（S-09 Δ）、host 级取消/并发/超时、Spill 归属复核、`tools/post-execute` 定义身份 | strict Profile 在 PR5 host 级验收前拒绝；未授权目标 deny-before-spawn |
| M-07 | `bash` / `pwsh`（C 通用 Shell） | **R1 + Team ShellAdapter（PR5）+ `ConfinedProcessProvider`（PR4）**：受信 pre-exec launcher **子进程入口自锁**（姿势 P1，或 P2 fork-not-exec 交接）后 exec 不可信命令；保留 native argv/env/cwd/job/timeout/Signal/stream 语义 | fork-but-not-exec 规则句柄交接（L1FD 实测可行）作受控优化 | **禁 Host 主进程 `landlock_restrict_self`**；禁 sandbox-unavailable→裸进程回退；禁以"Landlock READ_FILE 已拦截"推导 network/metadata 全绿；禁命令文本网页级正则预测副作用；禁追溯旧 FD 假设 | **D3 逐维**：文件读写面 OS_ENFORCED（L1/L1FD/L2/L3/L4 全绿）；TOCTOU_A 非 CLOEXEC 旧 FD 按设计存活→适配=非交付 fd 强制 O_CLOEXEC；metadata/network 维度**未达**→严格组合缺一维即 fail-closed；本宿主 host bash body 现态 = 宿主自身 fail-closed（`no sandbox backend is usable` 原文）→ 本环境该族现态 **UNSUPPORTED（环境）**；pwsh/Windows 对等 = 未证明，**显式 OS Unsupported** | PR4（provider）+ PR5（adapter） | [lanes-result.json](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/10-landlock-lanes/lanes-result.json) + [notes 判定表](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/10-landlock-lanes/notes.md)（L1 13/13、L2 7/7 注入负控全 EACCES、L3 8/8 交集棘轮、TOCTOU 2/2+2/2，**OS 层**）+ h6 HD-ask（ask 车道账本完整+consumed，bash body env-block 如实披露，host） | bwrap/netns/uid_map（维持 ENV_BLOCK）、FD 继承全矩阵、network 全通道（PoC-4b）、PTY/后台 Managed Range/Terminate 全语义（PoC-4c）、不可信 env/HOME/代理注入 | `SANDBOX_UNAVAILABLE` → typed **启动前拒绝**，零裸进程路径 |
| M-08 | `run_code`（PTC，D 保留复合 Transport） | **保留 DSH 传输（不能 R1 同名）** + 外层可信 PTC Runtime/Policy Gate（`dsh-ptc-runtime-node` EXISTS-PUBLIC）绑定本次 Grant/Team Policy/真实 OS Provider + 内层每次 R1/Admission/单调 Guard | 公共接缝不足但 Team 独立可运行 PTC Runtime 可用 → 受信进程 Service 替代 | 同名 register/restrict（typed throw，REG1 逐字节对合）；模型 `code`/env 自称 Grant；以"内层 guard 通过"替代外层防护；工具级 Fork 绕过 Core 传输限制 | **D5 半程**：内层 guard 断链 PASS（原体 0+durable isError，fixture）；PTC-08 外层真实进程 PASS（外层 pid/内层 pid 均真实，fixture）；**per-call 精确策略注入 = PoC-6a 未执行** | PR6 | [EV/05-ptc/p05-result.json](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/05-ptc/p05-result.json)（8 腿：7 绿+1 NOT_RUN→续轮 PASS，fixture）+ [ptc-outer-result.json](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/05-ptc/ptc-outer-result.json)（guard 拒内层=原体 0、正控=原体 1、`exec.parent=true`）+ h6 HC3（host typed 拒绝原文）+ REG1 §3 逐字节 | 并发 Member 不同 one-shot、外层直接 fs/net OS 级拒绝负控、父取消/子调用排空 drain | **Strict `run_code` 禁用**直至 PoC-6a 通过（或明示窄固定策略）；两案皆不成→禁用+记录 precise seam |
| M-09 | `lsp`（E 持久服务进程） | **严格 Profile 默认暂停原生共享池（fail-closed）**；启用路线 = PoC-6b 通过后 per-Member/Policy/Realm 池（公开 `ctx.isolate('lsp')`/`('subprocess')`+独立 `LspRegistry/stdio Provider`，池键 ⊇ Member+Realm+Provider+Workspace+PolicyGeneration），Host 预读走 ControlledFs、服务器走 Confined Spawn | Team Own LSP 协议客户端（仅公开协议接口）+独立 Instance Pool；R2 小 PoC | 原生 Workspace-only 池改名复用冒充隔离；`workspace/applyEdit` 拒绝当只读证明（LSP-4 反证）；因危险共享自动 Fork Core | **D6 失败面已证**：共享池跨策略复用同 PID+服务器任意读（HAZARD，fixture+虚构服务器）；隔离可行性未证（真实 per-agent ctx.lsp 组合面上游不存在）→ 族=**Bounded Defer** | PR6 | [EV/06-lsp/p05-result.json](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/06-lsp/p05-result.json)（11 腿：L3 HAZARD / L4 UNCONFINED-READ / L7 keyA===keyB / L10 §6.1 素材，fixture+FICTIONAL 声明在案） | 真实宿主 per-Agent 装配、真实语言服务器行为、策略变更→旧 PID 终止重建 | **Strict deny（UNSUPPORTED/BOUNDED-DEFER）**；§6.1 素材移交，S0 **不批准上游方案**（§5 差异登记 D-1） |
| M-10 | `web_fetch` / `web_search`（F 可信外部服务） | **R1 + 受信 Web Provider Gateway**：目的地过滤由 Provider 在首次请求、每跳 redirect、DNS/IP 变化、代理/本地地址/SSRF 上按其**真实能力**执行；`web_search` 通信目标 ≠ 搜索结果 URL（两层对象） | 经验证的 destination-bound 子集单独发布 | 以回环/ mock 结果扩张产品保证；把 mock server 强制当第三方远端保证；无 arbitrary URL path 保证时造假；参数合法即视为网络已授权 | **D7 部分**：回环 10/10——名单外目标在 **fetch 调用点前**拒绝（invoker+0/intercepted+2/access-log+0/tripwire 尝试 0）、重定向/超限/超时闭环、卸载零泄漏 → **INCONCLUSIVE(方向性)**；真实外网 = 无外联授权（申请项，缺权限标 `ENV_BLOCK`） | PR7 | [EV/09-web-jobs-mcp/p09-web-result.json](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/09-web-jobs-mcp/p09-web-result.json) + [notes 判定表](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/09-web-jobs-mcp/notes.md)（fixture 回环；生产 provider fail-closed 原文 `WEB_BLOCKED_URL…non-public IP`） | 真实外网端点、真实 search provider、spill/取消在 web 体、代理语义×Team 策略交互 | 无经验证 Provider 时：`allow`  lane 依底层部署发布、`restricted/deny` 超能力组合**直接拒绝** |
| M-11 | `job_output` / `job_list` / `job_kill`（F） | R1 或受信 **Job Gateway**：Job Owner + 创建时 Grant/ExecutionLease + 可信 Session 身份；`kill requested ≠ terminated` 不确定性保持 | PoC-7b 证明 dsh-agent owner carrier 可贯穿 → 直接复用原生 jobs 服务 | 跨 Member 查询/控制他人 Job；因输出是文本绕过所有权；把停止请求当效果撤销 | **D7 部分**：生产 LocalJobRegistry 直调 12/12（fixture）；**owner-scoped NOT_RUN**（缺 dsh-agent，fail-loud 原文已录，不伪测） | PR7 | [p09-jobs-result.json](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/09-web-jobs-mcp/p09-jobs-result.json)（fixture） | owner fence/隔离、重启恢复、completion wakeup、真实 producer 子进程 | 不能证明 owner 映射前**不授予跨 Member 能力**（typed 拒绝） |
| M-12 | MCP stdio / MCP HTTP（G 扩展协议） | 动态注册/撤回/重注册/同名遮蔽**全量进 closed-world Guard**；stdio=PR4 Confined Spawn（真本地子进程）；HTTP=可信远端 Provider（Team 本地只能准入+可信绑定） | — | 未治理动态 MCP 工具；mock 强制升级为远端保证；本地沙箱冒充管得到远端 | MCP 注入路径 = P0-1 结论一致（8/8，fixture）：同名遮蔽下**子进程侧 tools/call +0**、dispose→注销+全部 spawn 代际回收；另录 supervisor 静默换代观察（上游/装配面问题，不深挖） | PR7（stdio 依赖 PR4） | [p09-mcp-result.json](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/09-web-jobs-mcp/p09-mcp-result.json)（fixture） | 真实第三方 server、streamable-http、mcp-resources、reconnect 窗口、热替换/撤销/认证身份隔离 | Binding 之外的 MCP 名一律 Guard **deny**；`mcp__<server>__<raw>` 动态面持续重校验 |
| M-13 | Domain 工具（HPC/RPC/研究状态/设备，G） | **受信 Domain Gateway 在 effect commit 处最终裁决**（CAS 版本、Principal 可信生成、业务拒绝、网络重试不明状态）；`TeamPermit ∧ DomainPermit` | — | Team 审批覆盖 Domain Gate；Shell 普通进程持真实设备绕行凭据；COW/rollback 假象 | 无 P0 实验腿（结构判定+设计 §3.6 条款）→ **NOT_RUN（明示）** | PR7（veto 全链 PR8） | 无 PoC 证据——本行依据 = 设计 §1.6/§3.6 条款引用（不是实测） | Domain mock 联锁（CAS 状态/模拟设备，PR7 测试要求）、veto=0 side effects 证明 | 未确定 Domain reference **fail-closed**；Domain deny 不可被任何一方覆盖 |
| M-14 | `team_*` / `todo_write`（H Team/会话内部） | 已知安全归属+复用 Alpha.4 授权（含明确静态允许的普通状态操作）；覆盖枚举仍入 `T_governed` | — | 当作免治理豁免面绕过 INV-1 覆盖枚举 | host 实证装配/审批面：stage2b I2–I5（denyList 语义：`builtinToolDeny` 仅作用**继承面**，`team_*` 为 own-layer → restrict typed 原文拒）+ h6 H-D（公开审批面全驱动 4 请求→leader 通知→resolve→**一次性消费**，edit executes-once） | PR1（覆盖枚举）/PR8 | [stage2b summary（run-22-44-01）](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/07-integration/03-stage2b/run-2026-10-15T22-44-01) + h6-result.json H-D + REG1 §2b（每请求恰一 consumed、factType 1:1:1 无 standing-grant，host） | 全 team 工具矩阵、冷恢复、A/B 平面语义细节（Alpha.4 已有） | 静态 allow 清单 + 清单外默认 deny（**不是一概 allow**） |

**全族共同前置（不属于任何单行可豁免）：** PR0 契约（`ToolBinding`/`ResourceRef`/`RequestedEffectSet`/`OperationGrant`/`ExecutionLease`，PR0 接口冻结点）；PR1 closed-world Guard + 有序装配（NEG-1/2/12 负控）+ agentless lane 显式处置；PR2 Operation Admission + Grant 单次消耗。**严禁跳过 PR1 在未治理 Tool Surface 上开发 FS/Process 并宣称安全**（计划 §1）。

### 2.1 反例（NEG-1..12）→ 矩阵行映射自检表

| NEG | 内容 | 映射行 | 归属 PR |
|---|---|---|---|
| NEG-1 | lift-mask-under-race（原体 1 次） | 全部 R1 行（M-01…M-14 装配基座；重点 M-06/M-14 双证面） | PR1 |
| NEG-2 | agentless lane 走全局层 | 全族共同前置 + M-01/M-06（binding 覆盖枚举） | PR1 |
| NEG-3 | 原生读直通（fs-sandbox 只覆写 write/edit） | M-01/M-02/M-03/M-05 | PR3/PR4 |
| NEG-4 | 未绑定 Scope 触达 Preset 名 fail-closed | M-14 + 全族（装配拓扑腿） | PR1 |
| NEG-5 | run_code 保留名双侧 throw | M-08 | PR6 |
| NEG-6 | guard 单调、前段 allow 不可 force-allow | 全族共同前置（M-01…M-14） | PR1 |
| NEG-7 | 同步面 Promise 泄露（argv[0]="[object Promise]"） | M-06 | PR5 |
| NEG-8 | R2 前置缺失 = fiber PENDING 静默零注册 | M-06（R2 备选）+ PR1 服务显式校验（缺服务必须 throw） | PR1/PR5 |
| NEG-9 | LSP 池键=仅路径身份 | M-09 | PR6 |
| NEG-10 | LSP 服务器侧任意读 | M-09 | PR6 |
| NEG-11 | 硬链接别名绕过 realpath | M-01/M-02/M-03/M-04 | PR3 |
| NEG-12 | 未适配旁路（T_dispatchable ⊋ T_governed 缺口立即可用） | M-01 + 全族共同前置 | PR1/PR3 |

---

## 3. 二义词规范化表（计划 §2；语义唯一来源 = 设计 §2/§2.1/§1.4）

| 术语 | 冻结语义（引设计原文） | 禁止的旧用法 |
|---|---|---|
| **R1 = Scope Binding** | "对继承工具先 `tools.restrict({deny:[name]})`，在 Agent Own Scope 注册稳定同名 Dispatcher/Definition"；**所有普通可注册工具的基础装配**，不与 R2/R3 互斥 | 把 R1 当"工具体实现选择"或与 R2/R3 并列的替代方案 |
| **R2 = 工具实现选择**（原生体隔离重装） | "通过公开 `ctx.isolate(service)` + 受信 Service Provider，在正确 Scope 重装原生工具插件"；Service 缺失 PENDING 是**前置漏检，非根本不可行** | 把 fiber PENDING 当"原生工具不可能接入"或 Fork 触发器 |
| **R3 = 工具实现选择**（公开辅助 API 重组） | "Team Own `ToolDefinition`，调用上游包**根导出**的解析/渲染/构造函数，Team 自己处理危险 I/O"；不导入私有 `src/*` | 深路径/私有符号导入 |
| **R4 = Fork（有界工具级 Fork）** | "独立注册下游工具级改造代码；仅复制必需工具代码、保留溯源/许可/升级监测"；仅当 R1+R2+R3 均以最小复现证明不满足**必要**保证；产生具名 `A5-FORK-<family>` 债务 | "更方便就 Fork"；用 R4 修复 Core late-dispatch 或远端能力不足（计划 §1/§4） |
| **executionBoundary（三值）** | 设计 §2.1 原文三值：**trusted Host / confined subprocess / delegated remote**；与 `implementationOrigin`（DSH native / Team trusted extension / standalone runner / remote Provider）、`assurance` 为**三条独立维度** | 把旧 `native/custom/shadow-run` 当互斥"安全等级"三元组（设计 §2.1 明文禁止）；shadow-run 不是 COW/rollback（architecture §10.3/设计 §1.5） |
| **Assurance** | 设计 §1.4 原文："**Assurance 从有效 Policy 推导所需执行能力**，不是可放宽权限的第二组开关。Provider 必须完整兑现其声称支持的维度"；§2.1 逐维记录 `enforced \| author-trusted \| partial \| unsupported \| untested` | 把 Assurance 当第二套授权开关或按 backend 文件存在（如仅 `bwrap` 存在）自动升格（设计 §5 反缓存条款） |

---

## 4. 性能测量方法冻结（S0 冻结"怎么测"，不设通过阈值）

**冻结依据（计划 §2 原句）：** "冻结性能测量方法（延迟 p50/p95，内存/CPU/进程数，按小/大用例），不是根据猜测设置一刀切阈值。" **本节只冻结方法与可复现环境，不预设任何数值门槛**；预算/发布判断由 PR8 以实际测值作出（计划 §12）。

**可复现环境（冻结）：** pinned 宿主 `0.2.0-rc.2 @ 639ed01539…` 的 pristine test-use 克隆（porcelain=0 前后实测）；Linux 6.8.0-142-generic；DSH_HOME=`tests/homes/<world>`、端口 3180 族（真实 Host 场景按 stage2b 模式 :3185 隔离 world）；rg 固定 `@vscode/ripgrep-linux-x64` 15.0.0（`resolveRgPath()` 路径断言）；每次测量记录宿主 HEAD、node 版本、内核版本与负载旁证。**对照组 = 锁定上游 native**（同一基线上的未适配原生路径），同宿主同世界 A/B 交替 ≥50 次取分位。

**用例矩阵（冻结）：**

| 场景 | 小用例 | 大用例 |
|---|---|---|
| `read`/`write` | ≤4 KiB 单文件 | ≥64 MiB 单文件（含覆盖写 diff 路径） |
| `rg`（grep/glob） | fixture-tree ~25 文件 | 仓库级树 ≥10⁴ 文件 + >250 命中触发 Spill |
| `bash` | 冷启动（exec→exit） | 后台任务（job 生命周期 + kill） |
| PTC 外层 | 单调用 run_code | 内层多次 `tools.*` 分发 |
| LSP | 冷实例首查 | 同策略热复用（若 Profile 启用） |
| Web/Job Gateway | 单请求 | 重定向链 / 长 Job 轮询 |

**指标（冻结）：** 延迟 **p50/p95**（每次操作独立计时，非总时长）；**内存 RSS 峰值**、**CPU 时间**、**OS 进程数增量**（含进程树）、**Spill IO 字节**。全部落 PR-local 证据 `dev/agent-workflow/evidence/alpha5/<stage>/<commit>/`（计划 §12）。

**处理规则（冻结）：** 回退归类为**优化债务或发布阻断**（设计 §6），须排队记录并复测；**性能不佳不构成降低隔离强度的理由**（计划 §8 验收），**不得以移除权限防护作调优手段**（计划 §12 原文）。

---

## 5. 差异登记（S0 明示不裁决/不变更项）

| # | 差异项 | S0 处置 | 依据 |
|---|---|---|---|
| D-1 | LSP 上游接口方案（§6.1 十一字段素材） | **S0 不批准 LSP 上游方案**——素材按 §6.1 固定格式移交，是否提案/向谁提案由后续轮决定；同时 M-09 维持严格 fail-closed | 计划 §2 原句（"遗留差异：S0 不批准 LSP 上游方案，也不将 `strict read metadata` 修改为 content-only。"）+ 06-lsp L10（"素材，非宣告"） |
| D-2 | `strict read metadata` 语义 | **不修改为 content-only**：`read:restricted` 契约仍含元数据（设计 §3.3"本设计沿用既定契约"）；Landlock 对 `stat/list` 不保证 ≠ 把契约降级，只能对该 Profile 判 `IO_POLICY_UNSUPPORTED` 或附加可信隔离视图（PoC-4a） | 同上计划 §2 原句 |
| D-3 | `presentationMeta` 非包根可复现 | R3 渲染层自绘或接受 UI 卡退化，差异清单并入 PR5 验收（登记差异，非 API 提议） | [02-search notes §2 SRCH-01](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/02-search/notes.md) |
| D-4 | Spill 精确对象身份（S-09） | 替换 ToolDefinition 会因对象同一性丢原生 spill = **预期代价**；Adapter 自管 spill/大输出语义并显式声明，Spill 产物读取有授权与归属 | decision.md §3.5 + spill-result.json（Δ0+footer/他 scope Δ1/dispose 恢复） |
| D-5 | Tool Fork | **A5-FORK-001 = CONDITIONAL / 未产生**；当前无任何族取得 Fork 资格（grep/glob 明文 NOT-ELIGIBLE） | [tool-fork-debt](./tool-fork-debt.md) Ledger + P0-SELECTION-REPORT §4 |
| D-6 | 环境维持项 | bwrap 嵌套 / netns / uid_map 映射维持各自实测 ENV_BLOCK（不因 landlock 修正而改判）；网络外联 = 申请项 | [corrections-addendum](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/04-process/corrections-addendum.md) 维持行 |
| D-7 | L3 预期误差实记 | lanes L3 预期 "EPERM" 未复现：扩权 syscall 全放行而能力面恒 EACCES = **域交集语义**；按实测措辞 | lanes notes errno 节 |

---

## 6. S0 自检清单（不运行生产代码）

| 自检项 | 结果 | 凭据 |
|---|---|---|
| 12 个 NEG 全部有矩阵映射行 | ✅ §2.1 表 12/12 | negative-cases.md NEG-1..12 ↔ M-01…M-14 |
| stage2b **10/10** | ✅ 基线 `run-2026-10-15T22-44-01` VERDICT PASS + REG-01 原样重跑 10/10 零翻转 | stage2b notes、[REG1 §1](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/08-review/p07-review-REG1.md) |
| h6 **18/18**（KIT_EXIT=0） | ✅ 基线 `run-h6-2026-10-15T23-15-50`（attempt3）+ REG-01 重跑 18/18 | [h6-result.json](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/07-integration/03-stage2b/h6-result.json)、REG1 §2 |
| 双 Reviewer SHA 对合 | ✅ **R1 PASS @ `c46ffb76e33c8ce097a84963c72a60d88a9d263e`**；**R2 PASS（delta）@ `9e422ff5b37a219f4ce87e5175165ce66d357400`**（起点 `afc5e039`，会话中 HEAD 漂移已如实记录，delta=c46ffb76..9e422ff5 共 8 提交）；**REG-01 PASS @ 固定 SHA `79d6aea72313619d1e167f647133cdb3c114384c`** | 08-review 三报告文首字段；三 SHA 均已在仓库 `git cat-file` 解析 |
| Supersession 只引用不篡改 | ✅ §1 全部行引用原文位置，历史日志未改动 | 本文件 §1 |
| 交叉链接可达 | ✅ 见 PR 正文自查（全部相对链接逐一验证存在） | — |
| 不宣称 GO | ✅ 全文无族级 GO；总状态 = P0 NOT CLOSED | 文首固定声明 |

**遗留缺口（P0 不关闭的构成项，逐字对 P0-SELECTION-REPORT §6）：** ①LSP per-member 隔离（结构性，上游接口项）②真实外网 web 行为（第三方外联申请项）③浏览器维度 ④宿主级补强（FS-01..04/SRCH 反例集在 stage2b world 重跑，属 REG 系列而非 P0 缺口）。**GO 仍未产生，任何族不得写成 GO。**

---

## 7. 文档索引

- 计划：[alpha5-s0-pr0-pr8-implementation-plan.md](./alpha5-s0-pr0-pr8-implementation-plan.md)（§2 = 本阶段定义）
- 设计：[post-poc-technical-design.md](./post-poc-technical-design.md)（§0 权威顺序、§2 四路线、§2.1 三维度、§3 八类、§5 Assurance 边界、§7 D1–D7）
- 裁决：[ADR-alpha5-tool-io-governance.md](./ADR-alpha5-tool-io-governance.md) §8 · 架构：[architecture.md](./architecture.md) §14
- Fork 债务：[tool-fork-debt.md](./tool-fork-debt.md)
- 证据：[P0-SELECTION-REPORT.md](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/P0-SELECTION-REPORT.md) · [decision.md](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/decision.md) · [negative-cases.md](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/negative-cases.md) · [EXECUTION-LOG.md](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/EXECUTION-LOG.md) · [04-process/](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/04-process/corrections-addendum.md) · [10-landlock-lanes](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/10-landlock-lanes/notes.md) · [09-web-jobs-mcp](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/09-web-jobs-mcp/notes.md) · [03-stage2b](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/07-integration/03-stage2b/notes.md) · [08-review](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/08-review/p07-review-R1.md)
- Alpha.4 治理规范（授权平面复用）：[alpha4-permission-governance-spec.md](../../active/alpha4-permission-governance/alpha4-permission-governance-spec.md)
