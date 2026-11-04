# ALPHA.5 SANDBOX-FIRST — EFFECTIVE BACKLOG（有效待办唯一入口）

<!-- phase-baseline-ref: dev/engineering/current-authority.json -->
<!-- phase-identity: alpha5-sandbox-first -->

> **当前阶段：ALPHA.5 SANDBOX-FIRST（沙箱优先执行面）**。本文件是当期唯一有效待办入口；
> 设计需求正本见 `docs/plans/memo/alpha5-sandbox-first-20261101/`（ADR / ARCHITECTURE /
> IMPLEMENTATION-PLAN / TOOL-ADOPTION-MATRIX / TRANSITION-PLAN），当前态计划见同目录
> `current-implementation-plan.md`，逐工具验收见 `TOOL-ACCEPTANCE-MATRIX.md`。
> 机器权威 = `dev/engineering/current-authority.json` 指针解析到的不可变快照；本文件只引用、
> 不复制 baseline SHA。**历史绿 ≠ 新验收**：任何旧矩阵 PASS 都不能折算成本阶段验收。

## 0. 记法与裁决

- `BL-NN` = 本阶段待办；`BR-NN` = 本阶段必须回归/复验项（回归而非新功能）。
- 状态：`DONE` / `IN-PROGRESS` / `READY` / `BLOCKED` / `DEFERRED`。
- 每个条目必须绑定：证据目录（`dev/agent-workflow/evidence/a5sf-*`）、验收 Gate、独立 Reviewer。
- 禁止：第二套授权/第二套启动器/第二套策略编译器；禁止重新引入 `RequestedEffectSet`；
  禁止把原生工具塞回 `FamilyAssembly`；禁止把旧 `web-family` 历史当作 network ceiling 证据。

- **2026-11-03 装配复杂度裁决（用户与外部审查讨论后入档，优先于本文件内既有装配策略判断）**：
  1. **P0 优先于一切装配优化**：受管 Member 的原生 shadow 失效后，必须**先拒绝该 Member 的受管工具执行准入**，再异步销毁 Fiber；「预设定义重新可见但零新事实」**不等于**安全（`NoStaleShadow ≠ NoUnconfinedExecution`，`A5-FALLBACK-01`）。执行资格只有在完整重新装配并通过核验后才恢复。
  2. **工具归属的优先输入 = 既有 `TrustedToolRegistry`**（`packages/runtime/member-io-policy/src/trust-registry.ts`：`toolName`/`packageDigest`/`dependencyDigest`/`scope`/`definitionGeneration`）。只增加一层**模块→工具归属**薄元数据（模块来源+摘要+工具集合+条件性工具），**不新建第二套权限权威**：归属只回答「`read` 由哪个原生模块提供」，不回答「`read` 能读什么」。
  3. **`observeOnly` 探针仅为显式准入的受信兼容路径**，只对已验证可安全重复装载的模块启用；不推广为任意插件的通用接口，也不要求全体原生模块满足新的「幂等/无副作用」合同（幂等 ≠ 可安全重复执行）。
  4. **不建设通用 register-only loader**；重复分 Binding 挂载（`k+1`）是 S-1 的机制成本，登记只能消掉探针那一次，不得为消除它重写原生 ToolRuntime 或改 Core。
  5. **新增工程原则（架构审查项）**：在引入任何新的装配发现、运行时追踪或注册语义之前，**必须先检查既有 `TrustedToolRegistry` / `ToolRuntime` / Provider / OS backend 是否已掌握该事实**；只有信息确实缺失时才扩展机制。审查者不仅要找所选方案的漏洞，还要问「这个方案原本是否必要」。
  6. **`read_image` 记为 P3 条件性不支持项**（延迟注册、`attachments` 依赖）；不得靠改登记名或复用 Team 自研 `read_image` 声称原生兼容。
  7. **验收顺序**：P0 准入 → `tools/change` 不可用不得静默降级为两轮检查 → 归属登记复用 → 才花最后一次 P2-01 boot，六行验收表（A/B/C 三行 + `write` 不串通道 + **运行中失效后受管调用被拒且禁止字节不返回** + 终止后无失控 shadow/后台进程/未结清调用）。覆盖不全就记 NOT_REACHED，不为绿色报告放松断言。

## 1. P1 — 基础体系与可装配后端（G1）

| ID | 工作包 | 状态 | 证据 / PR |
|---|---|---|---|
| BL-01 | P1-01 v4 复用与最小 Member 上界增量（三轴 grammar，`memberIoCeiling`） | DONE | `dev/agent-workflow/evidence/a5sf-p1-01/`、`a5sf-g1/G1-GATE-REPORT.md` |
| BL-02 | P1-02 MemberPolicy 编译器（`EffectiveIo ⊆ MemberCeiling ∩ ToolRestriction`，`all` 为交集单位元） | DONE | `evidence/a5sf-p1-02/` |
| BL-03 | P1-03 授权路径/硬链接/Provider 能力（13 方法闭集、越界/悬空链接拒绝） | DONE | `evidence/a5sf-p1-03/` |
| BL-04 | P1-04 Invocation Binder + Trust Registry（能力不可重放、lease 需调用方时钟） | DONE | `evidence/a5sf-p1-04/` |
| BL-05 | P1-05 Service Realm / Provider 绑定（隔离 `ctx.isolate('fs')`、安装回滚、代际拒绝、`installToolBindingRealm`） | DONE | `evidence/a5sf-p1-05/` |
| BL-06 | P1-06 Provider/Backend 排他替换及发布路径 | DONE | `evidence/a5sf-p1-06/` |
| BL-07 | P1-07 OS Runner / Subprocess 公共面（真实 Landlock 证据，嵌套 deny 拒绝） | DONE | `evidence/a5sf-p1-07/` |
| BL-08 | P1-08 PTY / 持久进程生命周期（撤销先于首个 await、generation 键） | DONE | `evidence/a5sf-p1-08/` |
| BL-09 | R1 审批/治理接管（Alpha.4 ControlService/Envelope/ApprovalCase 以公开 seam 接管新执行面） | DONE | PR #541；`evidence/a5sf-r1/`；只消费既有 `ControlService.guardOperation` 的耐久 allow，只可收窄不可放宽；无第二 Ledger |
| BL-10 | R2 工程基线继承（WorldFactory/Canary/oracle、四层 CI、`PR #394` 诊断工具） | DONE | PR #540；`evidence/a5sf-r2/`；唯一 launcher/ledger/oracle/诊断表，预算门移到 `run-record.mjs` 单一实现 |
| BL-11 | R3 证据链（Alpha.4 允许/拒绝 → 编译结果 → Provider consulted → 独立效果 Oracle 同调用对齐） | DONE | PR #545；`tests/world-factory/lib/a5sf-evidence.mjs` + `evidence/a5sf-r3/`；四链同调用对齐，passive（不决策），`consulted/disposition` 为 lane 声明并已披露；未知行种类 fail-closed |
| BL-12 | R4 诊断工具（approval-bypass / 失效分类报告） | DONE | PR #542；`evidence/a5sf-r4/`；`scripts/a5sf-diag.mjs` 复用 `PR #394` 分类表与 P1 `matchLocator`，不新增词汇 |
| BL-13 | R5 黄金向量转换（旧 tool-family 输出向量 → 新 Provider 对照） | DONE | PR #543；`evidence/a5sf-r5/`；12/5041 向量转成回归对照语料，MATCH 明确不构成验收 |

## 2. P2 — 每机制代表工具（G2）

| ID | 工作包 | 状态 | 入口 / 证据 |
|---|---|---|---|
| BL-14 | P2-01 原生 `read`（>10MiB 中间窗口、流式、禁读真实拒绝、双 Member 不串权） | **live G2 已取得**（大文件窗口/流式仍 PARTIAL；矩阵行按 Q7 暂记 `NEEDS_REVALIDATION`，baseline 重切后复位，证据不删） | PR #581（`a5sf-preflight`）；`evidence/a5sf-preflight/README.md` §13：真实 Host 上 8/8 PASS——row1 内读被 confined provider 服务、row2 restriction 拒绝、row3 ceiling 拒绝，读路径咨询全落 binding realm；禁读真实拒绝与 in-lane 拒绝均为实测。**未覆盖**：>10MiB 中间窗口、流式、双 Member 同时并发（同轮两 Member 未做） |
| BL-15 | P2-02 原生 `write`（原子替换/版本校验；禁写字节不变；写不自动获读） | PARTIAL（写轴 live 已证，原子/版本未验） | PR #581；row4a 在 lane 内写成功且 write fact 全在 ceiling realm；row4b 证明 guard **允许**写一个 binding lane 读不到的文件（binding restriction 只约束 read 轴），拒绝写出的是**原生 write 工具自身的 read-before-write 契约**，不是 Team lane。**已裁决（2026-11-04）**：`write` **不**蕴含 `read`——原生 `write` 的 read-before-write 契约保留，Team 代数不加 write⇒read 耦合（裁决原文 = `evidence/a5sf-preflight/README.md` §12.8.3 RULING）；只写不读/读被拒权限下的 team 行为 = BL-38。**未验**：原子替换、版本校验、禁写字节不变（本轮只验拒绝路径不改盘） |
| BL-16 | P2-03 原生 `grep`（OS `rg` 真实拒绝、exit 0/1、取消、结果裁剪） | **host-free 半场已取得（ENFORCE-PARTIAL，V@B=no）**：confined `subprocess` Provider 挂到 Member realm 的同一隔离链（`team-services/src/subprocess.ts` + `install.ts`/`mount.ts`/`a5sf-realm-row.mjs` 可选 face）；真 pinned fs-search 模块 + 真 rg + 真 Landlock 下，in-lane grep/glob 执行并各记一条 allow 事实，out-of-lane 在**任何进程存在前**以 `IO_READ_DENIED` 拒绝（`spawns=0->0`）+ 一条 deny 事实，exit 0/1/2 保真、取消终止子进程。**review round 2（修正）**：`sh -c 'cat /etc/passwd'` 不再到达内核——shell/interpreter/未知 argv 在准入层以 typed `TeamIoDenial` + 一条 deny fact 拒绝（`providerCalls=0`）；声明式 allow-list 当前仅 `rg`，且其 argv 契约是 **shipped shapes 的 allow-list**（review round 3）：`--no-config` 必须紧跟程序（在首个 `--` 之前），只接受 `--json`/`--regexp=…`/`--glob=…`/`--files`/`--sort=modified`/`--no-ignore`/`--hidden` 与 `--` 根；`-f`/`--file`/`--ignore-file`（B1）、位置化 `--no-config` + `RIPGREP_CONFIG_PATH --pre`（B2）、`--pre`/`--search-zip`/`-z`、`--follow` 及其余 flag 一律在准入层拒绝。**实测内核 allowance** = `lane ∪ /bin,/usr,/lib,/lib64,programDir ∪ /etc,/proc`：直接 `/etc`/`/usr`/`/proc`、raw provider 下 `--follow` 的 in-lane symlink、预置 in-lane hardlink 均被内核放行（`PIN-*` 臂）；准入层是 allowance 内“已声明 root”的唯一一层。**review round 3（B3）**：程序身份不再只按 basename——`argv[0]` 的 realpath 经同一个 `evaluateLocatorAccess` 落在 effective write lane 内即拒绝（可写脚本冒充 `rg` 不再执行）；shipped `rg` 在外侧仍放行。**live 半场尝试 1–2 已花、0/6 行未测得**（2026-11-04，见下）；残余：预置 hardlink 以 ALLOW fact 服务、nested symlink 只在 raw layer 2（产品 seam 拒 `--follow`）、程序身份不 hash 字节且不覆盖本 face effective write lane 之外的 Member 写集合、不检查 `spec.env`（`LD_PRELOAD` 类；可达前提 = 直接控制 argv/env 的调用方）、`toolBindingIdentity=null` 且 install spec 无字段、binding realm 无 `subprocess` face → 组合期 typed 拒绝 `SUBPROCESS_UNCONFINED_REALM`（BL-17，2026-11-04；不再列为潜在洞）、in-lane 无 mkdir/symlink/execve（hardlink 可建）、模型文本非 typed、`mode:all` 车道拒绝。**live 半场尝试 1–2（2026-11-04T15:36–16:00Z，P2-04 已花 2/3 start，0/6 行未测得）**：尝试 1（15:36–15:39Z，port 3183）失败于 **driver 缺陷**——`runBoot` 把 4 个 row 交给 `emitPatchLayer` 却未 `handOverRows` 给 World，Harness 组合的是 bare World，`/__p6t6/health` 不存在；`--plan` 当时只查**已发射文本**。已修：`handOverRows` 单一交接点、`--plan` 用同一函数对 probe 运行并写 `plan-rows.json`（emitted vs world 按**身份与顺序**逐项相等 + 健康探针 row 存在）、go-no-go **自己**评估该交接（并独立复读源码中 `handOverRows` 在 `harness.boot(` 之前）、变异负控把该行改成 `void rows` 必须让 dry-run 变红。尝试 2（15:56–16:00Z，port 3182，协调者裁决授权的重试，grant `…-b2`）**证明组合成立**：`presentRowIds=[u5-canary,u6-fs-probe-host,a5sf-search-realm,dsh-agent-team,p6t6-team-tools,preset-a5sf-search-base]`、`missingRowIds=[]`、health 200 用时 3s、锚点表面 24 工具含 `grep`/`glob`；随后 **两个真实产品发现**：**F1** 负控 **REFUTED**——不受限的 base `subprocess` 在该 World 内**无法启动打包 rg**（`grep could not start its search command (ripgrep launch failed)`，`base-spawn=2 / confined-spawn=0`）；host-free 已排除模块解析（`@vscode/ripgrep` 从 host-tree 与 pnpm 两条路径都可解析）与 linux-scope 启动（`probeLinuxScope()` 为 false：`systemd-run --user --scope` 报 `Failed to connect to user scope bus`，故走 plain `spawnSubprocess`），**根因未隔离**（候选 `validateSubprocessSpec`/`spawnSubprocess`；`SearchError.cause` 被模块吞掉、World home 已随 teardown 删除）。由于 confined class 复用同一 base spawn，**F1 独立地阻塞 BL-16 live 半场**，并使负控在修好前不可判。**F2** `team.create` 被产品权限覆盖门拒绝：`TEAM_REMOTE_TEAM_CREATE_ROOT_START_FAILED … permission coverage gate failed for instance 'inst-leader': 2 unmanaged tool(s) … glob/grep (known-sensitive-unmanaged)`——native attach 只在 **Member realm** 上把 grep/glob 变成 managed，leader 是 root session 无 realm，故被正确拒绝；driver 已改为 leader 显式 deny grep/glob（`LEADER_MANAGED_TOOL_NAMES`），**未验证**（需新 start）。账本 2 intent + 2 boot（每 run `1 = 1 − 0`）；端口已释放、home 已删、无孤儿。**尝试 3（17:04:45–17:05:05Z，port 3183，协调者授权最后一次 start，grant `…-b3`；基线含 `165059eea`）**：组合再次成立（6 rows、health 0.3s）；**F1 撤销**——`165059eea` 已把 F1 归因为本 lane 自身证据行 `original.apply(this, spec)` → 服务被当作 `spawn(undefined)` 调用，`validateSubprocessSpec` 同步抛 TypeError，被模块统一成「ripgrep launch failed」；修复为 `original.call(this, spec)` 并在重抛前记 `base-spawn-failed`（Node cause），`f1-cause.mjs` 5/5（`F1-ROW-SPAWN` 修复前 RED/修复后 GREEN）；**F2 亦 host-free 验证**（`f2-deny-unit.mjs` 4/4，对真实 `evaluatePermissionCoverage` 与 World 记录的 24 工具面，突变重纳 grep/glob 逐字复现拒绝前缀）。尝试 3 在真实 World 内观测到证据行经 base spawn **成功启动打包 `rg`**（counter：`rg --json --regexp=A5SF_SEARCH_OUTSIDE` + 0 条 `base-spawn-failed`，git spawn 亦恢复），即 F1 在**受测组合内**关闭；随后 **driver 进程组被自身启动方式杀死**（`nohup … &` 在前台调用内，调用返回时 harness 回收进程组，约 17:05:05Z，距首轮 230ms），故负控结果未读回、leader grep probe 未执行、0 行判定；boot 行真实存在，故不申报 abort，**pool 3/3 用尽**。已留痕 `attempt-3-killed.json` + `attempt-3-counter.jsonl`，home 收割后删除、端口释放、无孤儿。**最终账目**：3 intent + 3 boot + 0 abort；0/6 行判定；M-06/M-07 等级与 `V@B` 一律未动。第四条 start 需**新 ruling 条目**（driver 与 go-no-go 均拒绝；本 lane 不再申请）。**README §12「next lane must know」沉淀四条可复用规则**：门必须**执行**交接而非渲染；plan 产物按**身份与顺序**比较组合行与命名行；boot 必须**先读 composed profile 再等 health**；**给服务加仪器的 driver 必须自测仪器（含运行方式）**——F1 与尝试 3 都是自伤。**M-06/M-07 等级与 `V@B` 一律未动**（0 行测得即不改矩阵）；未测得：6 行、负控（已判 REFUTED 但因果在 F1）、binding-realm fact、预置表达 binding 限缩（`UNSUPPORTED`）、取消时序。**可复用教训**：host-free 门必须**执行**交接而非只渲染文本；boot 应在等 health 之前读 composed profile；stage 归因把「一次废掉」变成「哪个交接坏了」。**live 半场尝试 4–6（2026-11-05，owner 追加 3 start → pool 6；0/6 行判定，Member 半场首次真正跑起来）**：`go-no-go` 先对当期 master 复验 GO（handoff 身份、`planHead === HEAD`、ledger 不变式、pool/ruling 全绿），每次 start 前都有**具名变更**。**尝试 4**（18:51:35–18:55:58Z，grant `…-b4`）：leader grep probe **置于 control 之前**并首次产出 `probe-leader-grep.json`（`success=true`、`baseSpawn=1`、`base-spawn-failed=0`、`factsBeforeRealm=0`、工具结果 `Found 2 matches … A5SF_SEARCH_NEEDLE_…`）——上一轮欠的交接物补齐，F1 在受测组合内第二次关闭；`team.create_status=200 ok=true`（F2 deny 生效：`builtinToolDeny=[glob,grep,u5_canary,u6fs_probe]`）；**member-install** 以 `MEMBER_INSTALL_NO_WORKER` 中止，但当时未捕获 delegate 答复（缺口）。**尝试 5**（18:58:10–19:05:32Z，`…-b5`）：**负控 PROVEN**（`UNCONFINED_CONTROL_LEAKS`，两个 out-of-lane token 均泄露，`baseSpawns=11`、`confinedSpawns=0`、`guardFactsBeforeRealm=0`）——attempt 2 的 REFUTED 确系 F1 仪器；新增 `delegate-artifact.json` 捕获 delegate 答复，得到**具名产品答复**：`team_delegate → status=rejected, code=TEAM_RUNTIME_DURABLE_WRITE_FAILED, TeamServiceInstallError: SERVICE_MOUNT_FAILED: native tool module re-mount failed: invalid config: $.sampleOverCapGlobResults missing required value`——**根因在本 lane**：`tool-fs-search` 的 `Config` 要求 `sampleOverCapGlobResults`（无默认），而 team row 以裸字符串挂载（空 config），realm install 在任何工具被 shadow 前即被拒（故 `install-fs/install-subprocess` 均为 0）；已修为 `{ url, config: { sampleOverCapGlobResults: false } }`（false = 确定性的 mtime head）。**尝试 6**（19:07:58–19:17:21Z，`…-b6`）：instrument 再修一处——本 harness 的 follow-up 请求**不回显 assistant `tool_use`**，计数器永为 0，每轮重发同一调用并耗尽 120 s settle（两次 `rg` 相隔 121 s），改为按 `tool_result.tool_use_id` 排序（`resultIdsOf`）；结果 **Member realm 真的装起来了**：`member visible=true instanceId=inst-14xcgx11i3lu childSessionId=<set>`、delegate `status=executed effect.kind=member-activated`、`member turn dispatched=true`、`confined-spawn=3 / confined-exit=3`、**7 条 `a5sf-guard-consult/1` 事实全部落在 400 ms 内**（`realm:"member"`）：①allow in-lane ②deny `IO_READ_DENIED` ceiling-outside ③deny `IO_READ_DENIED` outside-restriction ④allow invalid 目录 ⑤allow glob 目录 ⑥deny `IO_READ_DENIED` ceiling-outside-glob ⑦**deny `IO_READ_DENIED` `lane/blocking.fifo`**。第 ⑦ 条即中止原因：FIFO 在 ceiling 内但在 **tool restriction（`lane/inside`）之外**，被准入层正确拒绝 → 无 confined spawn → 取消窗口不开（`CANCELLATION_WINDOW_NO_CONFINED_SPAWN`，等 240 s）。这是**fixture 缺陷**（窗口需要一个「被准入然后阻塞」的检索）：已把 FIFO 移到 `lane/inside/blocking.fifo`，dry-run 新增「FIFO 必须在 effective read lane 内」检查（**53 checks**）。**账目**：6 intent + 6 boot + 0 abort（每 run `1 = 1 − 0`），pool **6/6 用尽、remaining=0**，`go-no-go` 现打印 `REFUSE budget: boots=6 spent=6 remaining=0` 与 `REFUSE budget: … a further start needs a NEW ruling entry`；端口 3184 释放、`tests/homes/*` 空、无孤儿。**本轮三类仪器缺陷均已修并加检查**：probe 污染 control（按 operand 计数）、tool_use 计数失效（改 tool_result id）、模块 config 违约（补 `sampleOverCapGlobResults`）；**一行未决变更**：FIFO 归位后下一次 start 应能判定第 1/2/3/5 行（Member 链在 400 ms 内跑完 7 调用）。**M-06/M-07 等级与 `V@B` 一律未动**（0 行判定即不改矩阵）；未测得：6 行判定、取消时序（row 4）、teardown 断言（row 6）、binding-realm fact、预置表达 binding 限缩（`UNSUPPORTED`）。证据 `evidence/a5sf-search-live/README.md`。**2026-11-05 row-6 复查（判 a，产品契约缺口）**：`team_archive_member` 提交 ARCHIVED 后，`ensureLiveAgent` 冷恢复与 boot resume 循环均不读 durable `MemberInstance.lifecycle`，archived Member 的 Session 被重新拉起并执行 `glob`（200 `ok:true`，post-stop allow fact ×2，confined spawn +2）；host-free 复判、静态链、4 腿 RED 臂（现 3 failed/1 passed；35 行门草图下 4/4）与契约/裁决框架见 `evidence/a5sf-search-live/row6-diagnosis.md`。本轮 live 其余：row 2/3/5/4 过；row 1 因 rg 读 `.git` 被 Landlock 拒（环境/driver 侧，另处理）。row 6 判定保持 FAIL，待产品门修复后复测。**2026-11-05 修复（ARCHIVED-GATE，产品契约修复）**：`memberResumeRefusal`（`agent-bindings.mjs`）在两个复活接缝读取 durable `MemberInstance.lifecycle` 并拒绝 ARCHIVED/DISPOSED（typed `PERMISSION_LIFECYCLE_EXECUTION_ARCHIVED` / `_TERMINAL`）：`ensureLiveAgentOnce` 在解析 owning root 后（接缝 1）、boot resume 循环在 `seen.add(child)` 后（接缝 2，跳过物化并记 observation）；CREATED/RUNNING/SETTLED 与 leader/root 路径不变，archive 与 restore→SETTLED→follow-up→cold-resume 流程保持可用。RED 臂 3 failed/1 passed → GREEN 4/4；双接缝变异控制各自单独移除均按预期 RED（M1: ARCHIVED+DISPOSED；M2: RESTART）。archived row-6 样本复判：归档字节仍 REFUTED（历史），同一刺激经修复后接缝产生 422 + 无 resume/无 tool 执行，`judgeRow6` 翻为 PROVEN（5 个 clause 因拒绝而翻转）；行名从 `...teardown...` 改为 `...archive-boundary...`（stopInstant 是 archive 边界，非 world.teardown()），clause 未改。成本：稳态 tool call 0 次 durable 读；每次冷恢复 gate 仅 +1 次内存快照 list（总计 4 次）；boot gate 0 次额外读。受保护 glue 源 sha256 由 `df9b46af…` 变为 `6d256096d98c8afdd1935e68c57f7571c647ae63362a652d7198e5f91ddb94e8`（最小 diff：共享 helper + 两个 gate 调用点 + 注释），理由是冻结 Architecture §41.6/§30.2/§29.4 禁止当前行为。证据 `evidence/a5sf-archived-gate/README.md`。 |；**rg 祖先发现（2026-11-05，`#593`）**：confined `rg` 在 git worktree 内会向上读取搜索根之外的 `.git`，lane 正确拒绝后 `rg` 视为致命错误并以 exit 2 结束（实测 stderr `…/.git: Permission denied (os error 13)`）。修在**调用**而非沙箱：仅当声明目录根的发现走行会越出 effective read lane 时，在 `--no-config` 之后、首个 `--` 之前加入 `--no-ignore-parent --no-ignore-vcs`（`laneSafeSearchArgv`）；披露搭同一条 allow fact 的 additive `annotations`，仍是一 fact 一进程。**该 lane 形态下 `.gitignore`/`.git/info/exclude` 对这次 grep 关闭**（被忽略文件会被搜到），`.git` 永不被读取、允许面未加宽。证据 `dev/agent-workflow/evidence/a5sf-rg-ancestors/` |
| BL-17 | P2-04 原生持久 `bash`（同 PTY 多命令、只写不读、`chmod`/新建文件负控、禁网、旧代 PTY 拒用） | READY | `a5sf-bash.mjs` |
| BL-18 | P2-05 原生 `web_fetch`（本地 mock provider、network=deny 前置拒绝、普通 DSH fetch 不受影响） | READY | `a5sf-web.mjs` |
| BL-19 | P2-06 原生 `run_code/PTC`（Node 子进程 + 受控 Host bridge，无代发旁路） | READY | `a5sf-ptc.mjs` |
| BL-20 | P2-07 全新第三方 CLI（通用 launcher，零专用 ToolDefinition 执行体） | READY | `a5sf-new-cli.mjs` |
| BL-39 | **后端加固任务（backend hardening，owner-owned；P1-07 代码，不在 BL-16 lane 范围）——收窄共享 launcher 的 `runtime_base`**：BL-16 实测 `runtime_base` 给 `/etc` 与 `/proc` READ_FILE/READ_DIR，使直接 `/etc/passwd`、`/proc/self/status` 读取成功；BL-16 只披露、不修改。**审查者给定的范围（必须逐项落表，不得只写“最小 POSIX 集”）**：(1) 枚举该 launcher 路径上真正**不可避免**的 runtime 依赖（loader/exec、locale/tz、NSS/证书、`/proc/self/*` 等，逐项给出为什么不可避免）；(2) 对每一项判断能否收窄到**具体文件或目录**（而不是整个 `/etc`、整个 `/proc`），并给出 Landlock 规则形状与实测；(3) 区分哪些例外属于**可信 host**（launcher 自身、exec/loader 基础）、哪些不应授予**不可信子进程**，逐项给出裁决理由与负控。**在本次审计落地前，OS profile 不是全局读白名单**：矩阵与证据不得把 `lane ∪ … ∪ /etc,/proc` 表述为“全局只读白名单”或“内核把子进程限制在 lane 内”。 | READY（owner-owned；backend hardening） | BL-16 `evidence/a5sf-bl16-grep/README.md` §6.3(1)；`landlock-prelauncher.py` `build_ruleset` `runtime_base` 分支；矩阵 M-06/M-07 残余 + 全局白名单免责声明 |
| BL-40 | **BL-17（shell/PTY）依赖 BL-16 review round 2 的 shell-class 准入规则**：`sh`/PTY 的 reads 不能由 argv 静态归属，故 BL-16 的通用 `subprocess` face 按设计拒绝 shell 类；BL-17 必须实现独立的、带 fact 的归属路径（如声明的命令行/命令列表），**不得**通过放宽 BL-16 的 allow-list 或依赖内核 `/etc`+`/proc` allowance 来“接通”。 | DONE（依赖已由 BL-16 记录；BL-17 实施前置） | BL-16 `evidence/a5sf-bl16-grep/README.md` §3/§6.4；`subprocess.ts` `programAttributionRefusal` |
| BL-41 | **standing design rule（2026-11-04，BL-16 外部架构审查；BL-17 前置）**：静态 argv 校验只是**固定原生工具适配器的纵深防御**（当前仅 `rg`），**不得**成为 CLI 类工具的架构。Bash / Python / LSP / MCP 的 confinement 必须来自其**实际消费边界上的 OS confinement**（Landlock / 进程 / 网络 profile），argv 检查只能作为额外一层，**绝不能是唯一的权限依据**。**BL-17 必须遵守本规则，不得克隆 `rg` 的 allow-list。** | RULE（standing） | BL-16 `evidence/a5sf-bl16-grep/README.md` §3/§6.4；BL-40；外部 Alpha.5 架构审查（2026-11-04） |

> **外部独立审查裁决（2026-11-03，用户转达；本裁决优先于下述各段的历史判断）**：
> 1. **撤回「BL-22 唯一归宿 = Core Patch」**。#555 的 `CORE_SEAM_BLOCKER` 结论**过强**：它正确证明了「路线 A（`presets.mount(agentCtx)` 改变已装载工具作用域）不可行」，但错误地推广成「原生工具受限必须改 Core」。**路线 C**——在受限 scope 下**重新装载原生工具模块本身**（`iso = agentCtx.isolate('fs'); iso.provide('fs', confined); await iso.plugin(await import(TOOLFS_URL))`）——已在旧 A5-XENV PoC（`dev/agent-workflow/evidence/a5x-envpoc-20261031T170133/A5-XENV-VERDICT.md`，本仓库历史提交 `18e3823e3`）（`tests/kits/a5x-envpoc/a5x-probe2.mjs` @ `18e3823e3`）于**真实 Host** 上验证：原生 `read/write` 的模型调用命中重挂载的定义、经过受限 provider、越界被拒、未改 Core。**BL-22 改为：优先复用该已验证的公开接缝；只有在重挂载在当前构建确证不可行时，才审查小规模基础设施插件 Fork（用户已预批准），仍不得直接触碰 Core。**
> 2. **两轴约束必须都落地**：当前 F1 消费 `realm.installation.members[0].ctx`，只落 **MemberCeiling** 一轴；产品合同是 `EffectiveIo(m,t) ⊆ MemberCeiling(m) ∩ ToolRestriction(m,t)`。P1 已生成更窄的 binding realm，下一步让**实际调用消费对应 ToolBinding 的约束**，不新造权限系统。
> 3. **「未配置 realm」≠「受管但配置缺失」**：现装配以 `a5sfEvidencePath` + provider 二者存在为开关，缺一即回 Base。这是测试期可接受的 feature flag，**生产语义必须区分**：非受管/明确旧模式→原路径；受管且安装成功→受限 provider；**受管但策略/Provider/安装缺失→拒绝受管执行，不得回退 Base**。证据文件路径不得成为是否启用安全强制的唯一开关。
> 4. **F1-8 的源码片段匹配只是回归哨兵**，不得升级为「架构层禁止 try/catch」的长期规则；真正的测试应是「在真实装配入口注入畸形 realm，整个受管 setup 失败且无模型可调用工具以无约束方式暴露」。
> 5. **boot 排序调整**：① 1 次 boot 完成 F1 实体验证（Team Tool Plane 拒绝并记录 consulted；原生 read 仍走 Base——这是**旁路基线记录**，不是验收成功）；② 优先复核 BL-22 路线 C；③ 原生工具 × ToolBinding 实际绑定；④ 之后才做 P2-01/02/03 的 C2 验收。**当前 3 次 F1 预算只用 1 次**，其余转入路线 C 与绑定验收。
> 6. **风险趋势**：若连续多轮只完善 Team 自有工具面而原生工具仍走 Base，会重新形成两套执行体系 —— 这正是 Sandbox-First 要避免的。**下一轮的首要工作是把原生工具接入真实产品执行路径。**
>
> **P2 统一前置 — 2026-11-05 审查修复轮（PR #590；B1–B8，本条不新增条目）**：外部审查在**机制层**复现一个
> 阻断缺陷（B1）：`projectToolIoRestriction` 把合法 v4 `{mode:'all', deny:[…]}` 塌缩为
> `'no-additional-narrowing'`，deny 被丢弃、realm 服务被拒路径（实测 `readText(secret)` 成功）。已修
> （只有 deny 为空的 all lane 才是恒等元）并在投影层 + realm 层各加回归臂（矩阵 §0 已同步）。同轮按协调
> 裁决落地：**B2** 行内 `config.blueprintSource`（同队）对声明天花板做逐轴 narrowing 对账，越界以新增
> `REALM_DECLARATION_EXCEEDS_BLUEPRINT` 拒绝（§9 的 embedded-vs-derived 决定**仍未定**，但现在只关乎
> 重复书写，不再是加宽通道）；**B3** `authorization` 按 shipped 枚举校验、`deny` 拒绝而非挂载（文档化选择）；
> **B4** `toolRestrictions` 走 shipped v4 `toolBindings` 校验（缺陷按路径点名）；**B5** `teamId`/
> `blueprintRevision`/`instanceGeneration` 记录为 declared-not-bound；**B6** 陈旧注释/README 措辞修正；
> **B7** 产品套件入列 CI（workflow + eb3-ci-manifest 腿，`eb3-ci-required` pass）；**B8** contentHash/revision
> 覆盖 bindings。证据 = `dev/agent-workflow/evidence/a5sf-product-assembly/README.md` §10（含 RED 日志与逐项门）。
>
> **P2 统一前置 — 2026-11-05 状态（缺口 a 的产品半场已补；本条不新增条目）**：外部审查指出的「新系统基本建在
> acceptance profile 里，产品装配尚未消费它」已按**产品可见声明**处理：Team 行 config 新增 `a5sfMemberPolicies`
> （`packages/runtime/team-services/src/product-assembly.ts`；声明即受管、未声明模板走原路径），挂载仍走**同一个**
> `mountMemberA5sfRealm` → `mountA5sfRealm` → `installMemberIoProviders`/`installToolBindingRealm`，编译仍走
> **同一个** `compileMemberPolicy`/`compileEffectiveIo`（无第二套评审、无 forked policy）。因此：
> - （1）**已闭合（产品侧）**：glue 早已接线，缺的是产品可声明的 provider；现在声明面本身就是产品调用者，且
>   `a5sfEvidencePath` 不再是唯一开关（有声明时它只是可选 sink）。证据=`dev/agent-workflow/evidence/a5sf-product-assembly/README.md`
>   （PA1 声明即挂载 / PA2 受管-非受管判别对 / PA3 交集双向 / PA5 证据路径回归）。
> - （2）**已闭合**：`tsconfig.build.json` 增加 `team-services/src/product-assembly.ts`（其 `member-io-policy/src/compile.ts`
>   等依赖由 tsc 传递发射）；无需新增 `scripts/dist-placements` 条目（新增文件是 `.ts`，由 tsc 直接发射）。
> - （3）**已闭合**：`packages/runtime/dist` 在同一 commit 重新生成并提交（含传递产物 `member-io-policy/src/*` 与
>   `domain/vnext-field-mapping/*`），过 `check-artifacts-committed` 与 `check-artifacts-at-head`。
> - （4）**仍开放**：真实 Host 运行 = `live` 半场（boot 池仍 0，本轮**未 boot、未启动、未碰 :3080**）；另有**产品 config
>   不可表达**的残差，按要求**拒绝而非假装支持**——confined `subprocess`/search face（需组合提供 P1-07
>   `ConfinedProcessProvider` + launcher pin；声明 `executionBoundary=confined-subprocess` 在**组合期**以
>   `SUBPROCESS_UNCONFINED_REALM` 拒绝）、网络轴收窄（realm 无 web face → `NETWORK_UNCONFINED_REALM`）。
>   **本仓库无任何 shipped composition/preset 声明 `a5sfMemberPolicies`**，故 preset-only World 仍无受限面
>   （`evidence/a5sf-search-live/README.md` §4 F2 结论不变）。
>
> **P2 统一前置（2026-11-03 实测；PR #548 后状态更新）**：缺口（b）「guard 咨询不可观测」已作为**机制**闭合（`onGuardConsult` 观察者 + `a5sf-guard-consult/1` 事实 + 跨进程 JSONL 传输 + `mountA5sfRealm` 单一挂载入口，子进程pid 证明真实跨进程）；缺口（a）**部分闭合**：入口存在且被真实调用者（R2 harness）使用，但产品行仍未接线。剩余工作已实测为**多于一个调用点**：（1）`packages/runtime/src/plugin/live/agent-bindings.mjs` 成员装配回调接线；（2）emit 入列（`packages/runtime/tsconfig.build.json` 目前 **不含** `team-services/src` 与 `member-io-policy/src`）+ `scripts/dist-placements` 布局；（3）重新生成并**提交** `packages/runtime/dist`（该树受 `check-artifacts-committed` 新鲜度门约束）；（4）真实 Host 运行 + 用户 boot 预算裁决（池仍 0）。
>
> 原缺口描述（2026-11-03 首测）：所有 P2 纵切的真实 Host 半场都被同一对缺口卡住 ——（a）`installMemberIoProviders`/`installToolBindingRealm` **没有生产调用者**，a5sf realm 在已启动 Host 中是惰性的；（b）`installToolBindingRealm` 内部构造 guard 闭包且不返回，`consulted` 不可观测。零点向上游补丁的最小 seam（~10–15 行：`import type { FsGuard}` + `wrapGuard` + 输入 + 保默认接线）+ 生产挂载 + 跨进程传输三者齐备前，任何 P2 live 断言的“经 Provider 读取/guard 已咨询”都只是 driver 自述。boot 预算池仍为 0，live 运行需用户新裁。

## 3. P3 — 原生工具逐项接入（G3）

| ID | 工作包 | 状态 | 备注 |
|---|---|---|---|
| BL-21 | P3-00 原生来源清单与分类（真实 `ToolRuntime`/Preset/动态 MCP 导出，动态来源默认 NOT_TESTED） | BLOCKED（需真实 Host boot） | 输出 `tests/kits/a5sf-native-inventory/` + `evidence/a5sf-p3/inventory/` |
| BL-22 | P3-01 FS 工具组（`read`/`write`/`edit`/`read_image`/`str_replace_editor`） | BLOCKED（依赖 BL-21） | 不新增 `fs-family` executor |
| BL-23 | P3-02 搜索与进程组（`grep`/`glob`/瞬态与持久 shell/`run_code`/`terminal_*`/`lsp`） | BLOCKED（依赖 BL-21） | 分别验收瞬态与持久 |
| BL-24 | P3-03 Web 与外部提供者（`web_fetch`/`web_search`/stdio MCP/remote MCP） | BLOCKED（依赖 BL-18/BL-21） | remote = TRUSTED_DELEGATION 或 UNSUPPORTED |
| BL-25 | P3-04 无直接数据面 I/O 的工具与未知工具（`goal`/`todo`/`jobs`/`present`/`ask`/`skill`/`session`） | BLOCKED（依赖 BL-21） | 逐工具列明实施/不实施理由 |
| BL-26 | P3-05 旧工具 Family 分阶段接管/退役（freeze → parity → switch → delete，不删证据） | BLOCKED（依赖 BL-22..BL-25） | 唯一 Integrator 变更 `team-tool-plane.mjs` 等 |

## 4. P4 — 全原生工具 × I/O 维度验收（G4）

| ID | 工作包 | 状态 |
|---|---|---|
| BL-27 | P4-01 FS 授权矩阵（读写分离/目录/新建/覆盖/rename/chmod/跨 Member） | BLOCKED（依赖 G3） |
| BL-28 | P4-02 路径与硬链接矩阵（授权硬链接、软链出界、前缀/rename/相对路径） | BLOCKED（依赖 G3） |
| BL-29 | P4-03 Network deny/allow（Web 前置 + OS TCP/UDP/IPv4/IPv6/DNS/代理/重定向；无 netns 不伪称） | BLOCKED（依赖 G3） |
| BL-30 | P4-04 一次性审批与撤权（并发仅一次扩权、持久 Bash 排空、取消 ≠ 确认终止） | BLOCKED（依赖 BL-09/BL-11） |
| BL-31 | P4-05 绑定/运行时更新（HMR/源摘要/同名替换/Realm/重启/cold resume，无未受控 fallback） | BLOCKED（依赖 G3） |
| BL-32 | P4-06 Host 兼容（非 Team read/bash/web 不受影响、`spillStore` 回归） | BLOCKED（依赖 G3） |
| BL-33 | P4-05A 双平面同调用一致性与实际消费（Alpha.4 → Provider consulted → 独立 oracle 全对齐） | BLOCKED（依赖 BL-11） |
| BL-34 | P4-07 性能与运行资源（p50/p95/p99、RSS、CPU、启动次数；无自定阈值假保证） | BLOCKED（依赖 G3） |

## 5. P5 — 对抗、故障与发布验收（G5）

| ID | 工作包 | 状态 |
|---|---|---|
| BL-35 | P5-01 对抗性 I/O（TOCTOU、软链出界、`/proc/self/fd`、继承 FD、PATH 替换、孤儿进程、代理/UDS/host bridge） | BLOCKED（依赖 G4） |
| BL-36 | P5-02 生命周期/故障恢复/上游升级演习（撤销/重启代际、崩溃、双装、无 Landlock/bwrap、僵尸清理） | BLOCKED（依赖 G4） |
| BL-37 | P5-03 发布前产品/工程双验收（RUN-MANIFEST、GATE-REPORT、独立权威迁移 PR、用户最终裁决） | BLOCKED（依赖 G5.1/G5.2） |
| BL-38 | P5-04 **只写不读 / 读被拒权限下的 Team 行为**（owner-owned 后续，**不在本阶段实施**）：一个 Member 被编译成有写 lane、无读 lane（或读被拒）时的 team 语义——写入是否可被指令盲投、是否需要在策略层耦合读写两轴、以及在 native `write` 之外（`edit`、shell、其他写面）的对应行为 | DEFERRED（owner-owned） |

## 6. 回归义务（BR）

| ID | 内容 | 状态 |
|---|---|---|
| BR-01 | 每个 PR 必跑：`pnpm -r typecheck`、`pnpm -r build`、`pnpm check:artifacts`、受影响 Alpha.4/5 套件 | IN-PROGRESS（持续） |
| BR-02 | `tests/deepseek-harness-test-use` 保持 pristine `639ed01539`；非 Team 路径等价 | IN-PROGRESS（持续） |
| BR-03 | 旧 Alpha.4 权限/审批/Jobs 语义不退化（只追加证据，不改历史） | IN-PROGRESS（持续） |
