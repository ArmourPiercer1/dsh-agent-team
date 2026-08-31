# G8-REVIEW reviewer-5 独立盲审报告（R61）

**裁决: 通过** — G8 出口标准（DevPlan §21.5）六项全部 PASS，且全部具备来自 pristine upstream 真实宿主实例的「过线（wire）」活证据；无阻塞项，无 gate 范围内需补充的内容；残留风险均为 gate 范围外的前瞻性条目，风险记录见 §7。

- Reviewer: reviewer-5 (N=5) · Gate: G8-REVIEW · Round: R61 · Phase: P8（"Remote / projection"；G8 = "stable browser-facing contract"，DevPlan 相表 L1722-1724）
- 审查对象: integration 提交 `3fa4c1f27ed1e8903c131dadc9aafe536ed9eb86`（分支 `int/P8-remote-projection`）
- 审查 worktree: `.worktrees/G8-R5`（detached @ SHA）；证据目录: `dev/agent-workflow/evidence/G8-REVIEW/reviewer-5/`（untracked by design，原样保留）
- 运行时: qiyuan-self / qwen3.8-27b（未切换）；LEAF（未使用 subagent/workflow/ralph，全部工作在本会话内完成）；Windows + Node v24.20.0 + pwsh workspace-write（approval prompts 已禁用——一切沙箱拒绝为终局边界，不升级、不绕行）

## §0 审查方法与盲审合规

1. **盲审**: 未打开、未 grep `dev/agent-workflow/` 下任何编排产物（仅向自己的 `reviewer-5/` 证据目录写入）；未读取其他 reviewer 结论、G8-S1 证据、graph.yaml、SESSION_ROUTER_LOG。
2. **权威序**: upstream 公开契约 → `docs/plans/active/` 四份冻结文档（自主 checkout 的 untracked 区读取，只读）→ `docs/ROUTER_RULES.md` → `docs/TEST_METHODS.md` → `docs/migration/`（仅参考）。
3. **硬约束合规台账**:
   - 无 push / force-push；
   - 未修改任何 tracked 文件（本 reviewer 的全部改动限于 untracked 的 harness / 证据文件）；
   - 未触碰其他 worktrees、master、`int/P8-remote-projection` 分支、`references/deepseek-harness`（只读）、`D:\deepseek-harness\`；
   - 稳定实例 :3080 — preflight 200 / postflight 200（run.mjs 双向强制，记录于 summary.json `stable3080`；run #8: before=200, after=200）；
   - pristine test-use 树（`references/deepseek-harness-test-use`）经 lockfile `references/.dsh-test-g8.lock` 串行（marker `G8-R5 <ISO>`；finally 中仅在内容 marker 匹配时释放）；8 次运行均正常获取/释放锁，无 NOT-RUN(LOCK-TIMEOUT)；
   - 运行后 test-use 树 `git status --porcelain` 空 + diff 空（summary.json `pristine.before/after` 两侧 head `cd5ef814…`、statusEmpty、diffEmpty）。

## §1 审查对象状态

- worktree `.worktrees/G8-R5` detached @ `3fa4c1f27ed1e8903c131dadc9aafe536ed9eb86`；9-package 骨架（client / contracts / domain / legacy / remote / runtime / storage / testkit / tools），`packages/` 下 545 paths。
- 工作树 diff 基线（base→head）：packages 内 97 个文件（diff-base-head-packages.txt），非 packages 变更见 diff-base-head-nonpackages.txt（docs 等）。

## §2 公开 seam 与红线扫描（CORE PATCH BUDGET = 0）

dependency-scan（dependency-scan.log，**PASS**）：
- 43 文件（ts+mjs）、166 个 specifier；bare import 仅 `node:fs`×3、`node:path`×2、`node:url`×2、`vitest`×10、`vitest/config`×1；
- 对 upstream 私有/内部表面的命中全部归类为 TEST-SURFACE / BLOCK-COMMENT，**CODE = 0**；
- 12/12 Remote 端口均有公开契约声明；隐藏依赖 NONE；纯浏览器表面 clean（无 SessionController 镜像路径——见 §6-C1）。
- 红线结论：全部能力经外部插件 + 公开 seam 提供，无 upstream 源码 patch 路径。

## §3 构建链与运行环境

- HOST_TREE = `references/deepseek-harness-test-use`（pristine upstream 角色，head `cd5ef814…`）；CLIENT_COMMIT_HASH = `cd5ef814`。
- **build:lib**（tsc -b + tsdown）：farm lib 产物已存在于 test-use 树 → 跳过（run.mjs 的 mandatory-if-missing 逻辑确认 PRESENT）。
- **build:web**（vite）：esbuild service spawn 在 workspace-write 沙箱下 `Error: spawn EPERM`（approval prompts 禁用 → 终局边界，不升级）→ 记 `SKIPPED(EPERM-BOUNDARY)` 并继续。该跳过不影响证据有效性，四条来源依据：
  1. 实测日志中的 `spawn EPERM`（esbuild service spawn 被沙箱拒绝）；
  2. `dsh web` 在无 `apps/web/dist` 时仍可启动并服务 connection RPC 端点（host 树源码核验）；
  3. run.mjs 设计即 best-effort：EPERM → 记录 SKIPPED(EPERM-BOUNDARY) 并继续（代码注释 + summary.json `build.web` 双留痕）；
  4. 本 e2e 为 browserless（不经 SPA 路由），dist 缺失不触碰任何被测路径。
- **ts-loader**：Node v24 原生 TS type-stripping 默认开启；resolve hook 仅在 `<worktree>/packages` 内把 `.js` 重写为存在的 `.ts` 兄弟文件（`.mjs` 排除）；loader-smoke 验证 3 类 specifier（file: / 相对 / 绝对）。
- **boot 配方**：`node apps/cli/lib/bin.js web --port 3185 --no-open`（FILE-FD stdio；env `DSH_HOME` + `DSH_CLIENT_COMMIT_HASH`）；成功标记正则 `dsh web: http://127.0.0.1:(\d+)/?token=…`；DshInstance 取自 `tests/characterization/lib/instance.mjs`；fresh DSH_HOME（`references/.dsh-test-g8-r5`，reviewer 专用、每 run 全新）先以 throwaway boot 初始化 profile；插件行 `g8r5-team-remote-host` 挂载于 `DSH_HOME/profiles/web/cordis.patch.yml` 公开 patch 层，dump-config 确认 `rowMounted=true`。port 3185 为 reviewer 专用，与共享 `.dsh-test`（TEST_METHODS 约定）及 :3080 稳定实例互不冲突。

## §4 链重跑、边界与 P8 套件

- **链重跑**（chain-rerun.log L203-205）：`1773 passed, 0 failed, 1773 total, 7042 ms`，exit=0 → **PASS**。
- **tsc × 6**：6 个包 tsc -b 全部 exit 0（chain-rerun.log L206-217，`TSC_=0` ×6）。
- **边界检查**（boundary-checks.log）：diff 的 97/97 文件全部落在 owned globs，0 outside（L118）；`zero-core PASS | private-import PASS | owned-boundary PASS`（L126）。
- **P8 相关套件**（全部绿）：p8t1 8/23/8/11；p8t3 5/9/7/14/13；p8t4 23/7/11；p8t2 7/6/6/7/5；g8s1 5/10；p4t6-session-event-scan 10。
- **preflight-tree-restore 事件**（run #1）：preflight 发现 test-use 树缺少 2 个 vendored 文件（系本 reviewer 之前的外部活动所致，非本次审查操作）；按 git blob 精确恢复并做 blob-hash 同一性证明，全程留痕于 preflight-tree-restore.log。此为「不得改动 test-use 树」的唯一授权例外，且为恢复而非修改；此后所有 pre/post pristine 检查均为 clean。

## §4.5 组合分析（源码级交叉核验）

- **dispatch.ts**（remote/src/handlers/dispatch.ts）：
  - invariants 4a/4b/5（L97-131）：`toRemoteErrorResult` 的 typed pass-through（4b：`TEAM_SESSION_NOT_FOUND` 等 typed 错误码穿透 dispatch 不降级）；
  - **L164**：`const outcome = handlers[remoteCategoryOf(endpoint)](endpoint, parsed.params)` —— 无 await：**v1 dispatch 严格同步**；
  - L166-170 `buildRemoteSuccess`；L175 `return Promise.resolve(response)`。
- **push/generation.ts L66-80**：closed verdict set（首帧→apply；teamSessionId 不同→foreign；更新→apply；相同→duplicate；更旧→stale）——不存在第六种结果。
- **fold.ts L88**：`generation: source.generation` 逐字透传——projection generation 不被中间层改写。
- **端口面**：TeamDomainReadPort 单方法（types.ts L192-199）；LiveResidencyOverlayPort = snapshot()（L207-214）。
- **provenance 构造器**（response.ts L155-167 `buildRemoteSuccess`）：恰好 7 键 `{origin:'team-remote', method, endpoint, contractVersion, requestToken|null, projectionGeneration|null-if-absent, effectSequence|null-if-absent}`；dispatch.ts L168 填 projectionGeneration；team.ts L190 仅 `team.getProjection` 从 `projection.generation` 设置。
- **team.ts L141-199**：create handler 同步读 `created.path/durable/bind`（L164-175），`durable === undefined → null`，`data = {path, durable, bind}`。
- **ports.ts L78-91**：`RemoteTeamCreatePort` 返回 `{path, durable:<state>|null, bind}`（lossless JSON）。
- **root-binding**：fresh-root.ts（async 编排：步骤 4 binding put `{kind:'team-root', schemaVersion:1, sessionId}`，步骤 5 `new TeamAgentBinder({surface, teamDomain}).bindFreshRoot(sessionId)`）；cold-root.ts（body 全同步；只读 durable 观察 `wrote:false`；ordinary no-op 时 ABSENT）；write-port.ts `createTeamDomainWritePort(repositories)` —— 参数是 repositories 包，不是 domain 包装对象（run #6 缺陷根因）。
- **binder**：binder.ts L199 `bindFreshRoot(rootSessionId): TeamAgentBindResult` 同步；types.ts L318-345 TeamAgentBindResult（requested/bound/installed/noopReason?/…）。
- **projection 不变量**（contracts/src/projection/projection.ts L95-225）：不变量 13（恰好一个 leader template）；**不变量 14（L221-225）：members 必须恒含恰好一个 LeaderInstance（`inst-leader`）**——新队投影为 members.length===1（leader 行，无 childSessionId），不是 0。
- **roster.ts L146-149**：leader 行由创建 TeamSession 的 runtime 所有 → harness 的 create 入口负责物化。
- **checks.ts L437-478**：`countTeamQuota` 计所有成员（含 leader）；ACTIVE = CREATED|RUNNING。P6T2 配额（team 4/4，member 2/2）下含 leader 行时：E3 0→1≤2、E4 1→2≤2，两次 create 均合法。
- **file-seam.mjs L340-344 / L402**：kv `put` 签名 async 但 body 全同步（`state.rows.set` 在调用时执行；仅 promise 决议微任务延后）——同步组合的可行性依据。
- **效果/账本**（action-router/effects.ts）：SEND_MESSAGE 恰好提交一条 FACT_COORDINATION（L180-190，返回 `{kind:'fact-recorded', sequence}`）；member.create 每次激活经 provider 的 fact-commit 依赖提交恰好一条 durable fact（activation/provider.ts L361/L516 `ledgerSequence`）——run #8 实测 2 次 create → 账本恰好 2 条（seq 1..2），team.create 不产生账本条目。

## §5 pristine-host browserless remote e2e

### 5.1 装置

- 把宿主插件行 `g8r5-team-remote-host`（plugin.mjs，`inject: ['connection']`）挂进 pristine upstream DSH 实例（port 3185、fresh DSH_HOME）。插件 `apply()` 启动 **一个 worker 线程承载整个真实 P6-T2 世界**（FileStorageSeam → 真实 repositories → 真实 createTeamRuntime / activation provider / catalog / lifecycle / handoff / P7-T7 legacy 模块），并把 12 个 Remote 端口（22 个点分方法）全部注册为同步代理，经 16MB SAB 邮箱与宿主行通信（每调用一次性 SAB；父端 20ms 轮询 done 标志 + 确定性顶层 JSON 扫描恢复载荷；CALLOUT_MS=120000）。
- **该 worker-bridge 是仓库历史上的第一次 host wiring**：v1 Remote 契约端口是同步的（dispatch.ts:164 无 await；team.ts 同步读字段），而真实 P6-T2 世界是异步的（`TeamRuntime.performAction` 异步）——bridge 把「宿主侧同步端口调用」与「worker 侧真实异步世界」串行化：父端发送 → worker `await` 真实世界 → 以纯 JSON（lossless）回复。
- 客户端侧：走 upstream connection RPC 公开 seam 的真实 HTTP 环回（请求封套 `{type:'client-request', rpcId, method, payload}`），launch cookie 鉴权（`dsh-auth-*` Set-Cookie，HttpOnly + SameSite=Strict，302/303 铸造核验），P8T4 测试客户端（真实 push 引擎 + backoff + `PushTransportLossError` 唯一判损口径）。
- browserless 是设计使然：e2e 走的是浏览器将走的同一条线协议；客户端状态只来自远端投影帧与 raw pull（这正是 C1 的验证方式）。

### 5.2 环境发现（两项，均附 probe 证据链）

1. **跨线程 `Atomics.wait` 在本沙箱化 Windows + Node v24.20.0 构建中从不被唤醒**（值最终会传播）——probe：`sab-delivery-probe{,2,3}.mjs`。修复：poll-and-wait 循环（20ms 间隔 + 截止期）。
2. **在真实 deferred-build 的 world-worker 线程中，`Atomics.store(view, 1, n)`（Int32Array slot 1 = 长度）对父端永不可见**，而 slot 0（done 标志）与数据字节可见——probe 链：`sab-visibility-probe` / `sab-adjacent-store-probe` / `sab-v8serialize-probe` / `sab-culprit-probe` / `sab-factor-probe` / `sab-portcall-probe` + 插桩 worker-diag 运行；微观成因未定位。绕行：**len-less JSON 邮箱协议**——worker 把 `JSON.stringify(msg)` 文本写入 bytes[8..) 后只 store done=1（slot 1 恒 0）；父端以确定性顶层 JSON 扫描（自 byte 8、0x7B 起、字符串/转义感知的配平花括号状态机）恢复长度并解析，失败则重试至截止期。3 次独立验证 + 活体验证（run #8 worldHealth ok:true）。
- worker 将 unhandledRejection/uncaughtException 吞入 `worker-diag.log`（已文档化的 harness 行为，保证世界持续可服务）；**run #8 时间窗内该日志零条目**（世界运行干净）。

### 5.3 Harness 边界（mock-first，全部在 world-build.mjs 注释中逐处标注）

- 确定性 fake：child-session factory、agent-setup surface（`FakeAgentSetupSurface`，Map 实现）、session 持久化、residency overlay、summarizer；`effectiveConfig` 4-lane stand-in；`root.admission='OPEN'` + `creationBudgetConsumed=0` stand-in；MutationStore 内存（`G8r5RevocableStore`）；compatibility summary 自 durable 行活体映射；ledger category 映射 = 已文档化赋值；**生产版 `readProjectionSource` 在仓库中不存在**——由 harness 实现。
- **`teamCreate.create` 适配器 = 对真实 repositories + binder 的同步组合**（v1 端口同步性依据：dispatch.ts:164、team.ts L149-183 同步读、file-seam put body 全同步、binder 同步）。fresh 路径：kind 检查 → `putTeamSession` → `putSessionBinding` → **物化 LeaderInstance 行**（roster.ts L146-149 所有权裁定 + 不变量 14 要求；确定性 childSessionId、lifecycle CREATED）→ `bindFreshRoot`；cold 路径：`rehydrateColdRoot` + 只读 durable 观察（`wrote:false`）。每个 put 挂 `.catch(lateReject)` 诊断钩子——无 detached promise 残留（run #6 缺陷根因之一）。
- `legacy.inspect`：真实 P7-T7 `inspectLegacyTeam` 走 real-FS port（fresh home → `status='native-fallback'`，inspect.ts L419-426 的 no-legacy-metadata 分支）。

### 5.4 运行史（8 次；全部缺陷均为 harness 侧，审查对象零缺陷）

| # | 作业 | 结果 | 缺陷与修复（全部在 harness 文件内） |
|---|------|------|--------------------------------------|
| 1 | pwsh-275 | 完成 | preflight 发现 test-use 树缺 2 个 vendored 文件（此前外部活动）→ 按 git blob 精确恢复 + blob-hash 证明（preflight-tree-restore.log）；继续 |
| 2 | pwsh-276 | 完成 | build:web `spawn EPERM` → 按设计 SKIPPED(EPERM-BOUNDARY)（§3 四条依据）；继续 |
| 3 | pwsh-277 | 完成 | ts-loader 缺 `file:` URL 处理 → 修复 + loader-smoke 验证 |
| 4 | pwsh-278 | 完成 | run.mjs:367 `res.getSetCookie is not a function`（Node 24 undici：`Response.getSetCookie()` 不存在）→ `res.headers.getSetCookie()` |
| 5 | pwsh-279 | 完成 | world-health FATAL：单次 120s `Atomics.wait` 永不唤醒（环境发现 #1）→ poll-and-wait 修复 |
| 6a | pwsh-288 | EBUSY | pwsh Tee-Object 与 node `appendFileSync` 争用同一 `e2e-run.log` → 改用独立 stdout 重定向文件 |
| 6b | pwsh-289 | RUN-FAIL | E1 `durable is a non-null object`：旧适配器未 await 异步 `bindFreshTeamRoot`（bind 为 Promise；put 未落地即读回）；worker 死亡 `Cannot read properties of undefined (reading 'put')`：`bindingPorts()` 把 domain 包装对象传给 `createTeamDomainWritePort(repositories)`（应为 repositories 包）→ 首个 put 在 detached 编排 promise 内抛错 → unhandledRejection 杀 worker，级联 E3/E4/E5/EXTRA。修复：同步组合整体重写 + 正确 repositories 对象 + 全部 put 挂 `.catch`。随后 create-probe 暴露**投影不变量 14**（新队必须恰含一个 LeaderInstance）→ 适配器物化 leader 行；e2e 断言按冻结契约更正（E1 members 0→1 仅 leader 且无 childSessionId；E3 应用帧 1→2 leader+worker1）——旧「fresh members []」假设本身与不变量 14 相悖（harness bug，非契约问题）；配额数学核验通过 |
| 7 | pwsh-290 | RUN-FAIL | 两条断言：(a) E4 `page1 nextAfterSequence — expected 2, got null`：**我的断言错**——冻结契约（team.ts L193-216 + ledger-page.ts L6-7）规定游标「当且仅当尚有剩余条目」才取最后包含序列，末页为 null；活体服务器返回 null 是正确的（2 条、limit 2 → 账本读完）。修复：E4 重构为同时覆盖 IFF 两分支（limit 1 页 → 非空游标；page2 limit 50 → 空游标）并把 total 钉死为恰好 2（活体验证：2 次 create → 2 条 fact；effects.ts L180-190 send 恰好 1 条）；(b) EXTRA-1 `catalog.list has blueprints`：**我的端口适配器双重包装**——handler（catalog.ts L23-26）已加 `blueprints` 键，端口应返回裸数组。修复适配器 + 新增 catalog-probe.mjs（in-process，PASS，world build 225ms） |
| 8 | pwsh-291 | **RUN-PASS** | 无缺陷。node-exit=0 |

### 5.5 run #8 最终结果（runStamp `g8r5-1788182973950`，2026-08-31T13:29:3x–41Z）

- **e2e: RUN-PASS，8/8 场景，`failures: []`**：
  - **E1** provisioning + projection round-trip：`team.create path=fresh-root durable+bind`；provenance 精确（7 键 null-cell 形）；projection gen=1 schema=1 fields=9 members=1(leader) templates=3；provenance.projectionGeneration=1
  - **E2** transport loss → reconnect + frame parity：loss→reconnecting（transportLosses=1）→backoff→connected gen=1；session-2 全新客户端应用帧与独立 raw pull deep-equal
  - **E3** stale response rejected（G8 核心规则）：mutation gen 1→2（worker1=inst-016qynq01hdi）；重放的 gen-1 帧 verdict=stale（framesStale=1，应用态字节级不变）
  - **E4** ledger pagination stability：page(limit=1): seqs=[1] total=2；send fact seq=3；page2 first-seq>anchor total=3=T1+1；head page 重读 deep-equal
  - **E5** typed errors + provenance + zero 5xx：malformed-params(field=teamSessionId)；TEAM_SESSION_NOT_FOUND；contract-version-unsupported；TEAM_RUNTIME_CALLER_AUTHORITY_DENIED；14 请求中 0×5xx；全部 ok:true 的 provenance 完整
  - **E6** transport-level negatives：401 unauthorized；415 content-type；200 bad-request（method≠endpoint）；200 unknown-method；200 malformed-request
  - **EXTRA-1** read-surface extras：catalog.list(1 bp)；intent.probe ok；legacy.inspect status=native-fallback；compatibility.reprobe NEW_ACTIVATION ok
  - **EXTRA-2** 同 token 幂等重放：tok-g8r5-e3c 重放 → effect.replayed=true + 同一 instanceId + generation 5 不变（无新 durable 写入）
- **e2eStats**：requests=26，**http5xx=0**，expected4xx=2，**okTrueWithoutFullProvenance=[]**
- **worldHealth**：ok:true（catalog.list 返回扁平 `blueprints` 数组 + 完整 7 键 provenance，contractVersion=1，rpcId `g8r5-health`）
- **postflight**：boot port released=true；test-use 树 pristine（head cd5ef814，status/diff 双空）；:3080 = 200；lock 以 marker 匹配释放。
- 世代推进全程一致：E1 create=1 → E3 worker1=2 → E4 worker2=3、send=4 → EXTRA-1 reprobe=5 → EXTRA-2 重放=5（不变）。

### 5.6 非阻塞好奇项

world-repro 中 JSON.stringify 输出在 v8-serialize 往返后存在差异（deepEqual=false）；契约值已经 lossless-JSON 验证（create-probe 907 字节往返无损），不影响证据有效性。

## §6 G8 六项出口标准（DevPlan §21.5 L2804-2813，逐字）

**C1 "browser needs no SessionController Team mirror" → PASS**
证据：(a) dependency-scan（§2）：浏览器表面 clean，upstream 私有/内部 API 的 CODE 命中为 0，无 SessionController 镜像路径；(b) E2 活体：客户端状态完全来自远端投影帧 + 独立 raw `team.getProjection` pull——session-2 全新客户端应用帧与 raw pull deep-equal，全程无本地会话状态机制参与；(c) e2e 驱动的就是浏览器将用的同一条 connection RPC 线端点（browserless by design）。

**C2 "projection round-trip works after reconnect" → PASS**
证据：E2 活体——garbage cookie 触发 transport-loss（`PushTransportLossError`，stats.transportLosses=1）→ state=reconnecting → 按 `advance(pendingBackoffMs)` 驱动 backoff → connected，lastAppliedGeneration=1；其后全新客户端应用帧与 raw pull deepStrictEqual（帧一致性）。push 引擎为真实 P8T4 `push/generation.ts` 代码。

**C3 "stale responses ignored" → PASS**
证据：E3 活体——mutation 使 gen 1→2 后，队列中的 stale gen-1 帧被裁为 `stale`（framesStale=1），应用态字节级不变、世代不变；源码核验 closed verdict set（generation.ts L66-80：apply/foreign/newer/duplicate/stale，无第六种结果）。

**C4 "ledger pagination stable" → PASS**
证据：E4 活体——2 条账本条目上 limit-1 页 → 游标=1（非空分支：满页且尚有剩余）；send 追加第 3 条后，page2（afterSequence=anchor, limit 50）→ 条目全部严格大于锚点、游标=null（末页分支）、total=3=T1+1、含 send seq；head page 重读 deepStrictEqual（增长下的稳定性）。切片器源码：team.ts L193-216（filter `sequence > afterSequence` → slice limit → 游标 IFF）；客户端镜像规则 ledger-page.ts L6-24（含 total 非降，即追加只进不改 → 分页稳定）。

**C5 "every UI-visible action has typed error/provenance" → PASS**
证据：(a) E5 活体 typed 错误：`malformed-params {field:'teamSessionId', reason:'missing-required'}`；`TEAM_SESSION_NOT_FOUND`（invariant 4b 穿透）；`contract-version-unsupported`（version=99）；`TEAM_RUNTIME_CALLER_AUTHORITY_DENIED`；(b) E6 传输层负面：401 / 415 / 200 bad-request / 200 unknown-method / 200 malformed-request；(c) provenance：恰好 7 键构造器（response.ts L155-167）在**全部** ok:true 响应上存在——全局跟踪器 26 请求中 okTrueWithoutFullProvenance=[]、http5xx=0；E1 钉死 null-cell 形（requestToken/projectionGeneration/effectSequence 三 null）。
方法覆盖透明度：过线活体验证 = team.create、team.getProjection、team.getLedgerPage、member.create、member.send、catalog.list、intent.probe、legacy.inspect、compatibility.reprobe（+ 全部错误路径）；其余目录端点（handoff.*、lifecycle.*、override.*、policyState.*、compatibility.current/acknowledge 等）由 in-repo 套件 p8t1/p8t2/p8t3/p8t4/g8s1 以真实 handler 代码覆盖（§4，1773/1773 绿）。

**C6 "Remote contract versioned/tested" → PASS**
证据：(a) 全部 e2e 封套携带 REMOTE_CONTRACT_VERSION=1；每条响应的 provenance.contractVersion=1（含 worldHealth）；(b) 版本闸门活体：version=99 → `contract-version-unsupported`（E5c）；(c) tested：链 1773/1773 + tsc×6 exit 0 + P8 套件（p8t1 8/23/8/11；p8t3 5/9/7/14/13；p8t4 23/7/11；p8t2 7/6/6/7/5；g8s1 5/10；p4t6-session-event-scan 10）+ 本 reviewer 的 8 场景过线 e2e。

## §7 裁决与风险记录

**裁决: 通过**

依据：
1. **冻结范围**：DevPlan 相表（L1722-1724）——P8 = "Remote / projection"，G8 = "stable browser-facing contract"；§21.5 六项标准（L2804-2813）逐项具备来自 pristine upstream 真实宿主实例的过线活证据（§5/§6），且全链/tsc/套件全绿（§4）。
2. **对象零缺陷**：8 次运行中发现的每一个缺陷都定位到本 reviewer 的 harness（逐次记录根因与修复，§5.4），审查对象在全部场景中行为与冻结契约一致——包括两次活体服务器**纠正了我自己的断言**的情形（E4 游标 IFF、EXTRA-1 端口包装），服务器侧行为两次均为契约正确。
3. **无阻塞项**；gate 范围内无「证据不足、需补充」的内容。不取「投机通过」的理由：所有 gate 范围内要求都有直接证据；残留不确定性全部落在冻结相表明确划出 G8 之后的工作（host 生产 wiring / 真实世界模块），不构成 gate 范围内的「后续问题不能完全排除」。

风险记录（前瞻性、gate 范围外，供编排方按 §3.3/§6 记录）：
- **R1（主要，前瞻）**：v1 Remote 端口同步（dispatch.ts:164 无 await）而真实 P6-T2 runtime 异步——本 e2e 的 worker-bridge（宿主行 → 单 worker 线程承载真实世界）是仓库第一次 host wiring；**仓库内尚不存在生产 host wiring**。P9 需交付等价 bridge 或契约 v2 的异步端口。证据表明同步 bridge 模式端到端可行（8/8），但生产质量 wiring（崩溃恢复、真实 child-session factory、真实 agent-setup surface）未验证——按冻结相表属 G8 范围外。
- **R2（中等，前瞻）**：mock-first 世界边界（child-session factory、agent-setup surface、residency、summarizer、内存 MutationStore、effectiveConfig stand-in 等，§5.3）——P6-T2 套件已对这些模块做进程内覆盖（1773 绿）；P9 生产 wiring 应替换为真实模块并重跑本过线 e2e。
- **R3（次要）**：`teamCreate.create` harness 适配器按 roster.ts L146-149 所有权裁定物化 LeaderInstance 行（不变量 14 要求其在投影中恒存）；生产 create 入口必须同样物化——已在 world-build.mjs 注释文档化。
- **R4（信息）**：本沙箱化 Node v24.20.0 构建的两个 Atomics 跨线程环境发现（§5.2，probe 证据链在证据目录）；len-less JSON 邮箱为 harness 专用绕行，非仓库交付物。

合规重申：盲审（未读任何编排产物）、LEAF、provider/model 未切换、无 push、未改任何 tracked 文件、:3080 before/after 均 200、pristine 树两侧 clean、lockfile 协议全程遵守（marker 匹配释放）、worktree 与证据文件 untracked 且原样保留。

**裁决: 通过**（G8-REVIEW reviewer-5 · R61 —— 六项标准 6/6 PASS，过线活证据齐备；风险 R1–R4 已记录，均属 gate 范围外前瞻项）
