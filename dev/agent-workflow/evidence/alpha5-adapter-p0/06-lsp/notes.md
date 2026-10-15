# 06-lsp — Alpha.5 P0-5 LSP 腿（LSP-01）实验笔记

- **角色**：独立实验代理（非协调者）。日期（UTC）：2026-10-16。
- **模型名逐字回报**：系统提示 powered-by 原文 = `You are a coding agent powered by the qwen3.8-flash-next model.`（模型名 `qwen3.8-flash-next`）。
- **基线**：T @ `639ed015397290b3745d163aafe02ffee4aa3f84`（runner 前后 porcelain 均空）。S-11 路径核验 = **`packages/lsp/lsp-stdio`**（source-map 所指），公开包根三件：`@deepseek-ai/dsh-lsp`（ctx.lsp Service Definition + 注册表）、`@deepseek-ai/dsh-lsp-stdio`（stdio provider）、`@deepseek-ai/dsh-tool-lsp`（模型工具）。
- **环境**：node v24.21.0 linux x64；无模型密钥/无 Host 服务器/未触碰 :3080。导入机制同 05-ptc（resolve hook → T 内绝对 file URL；未新增 junction；T 只读）。

## TEST DOUBLE / FICTION 声明（诚实纪律）

- 语言服务器 = **虚构可审计 stdio 脚本**（runner 每次重写 `probe-scratch/fake-lang-server.mjs`）：回显 initialize/shutdown、报告自身 OS pid、计 didOpen、initialize 期做 boot 读探针、应答自定义请求 `$/p05ReadProbe`（尝试 `readFileSync(params.path)` 并把成败结构化返回+stderr 审计）。**不是真实 LSP 服务器**；"真实 LSP 服务器复用行为"记 NOT_RUN。
- **被测 provider/pool/spawn/宿主预读代码是真实 pinned 生产 lib**（`@deepseek-ai/dsh-lsp-stdio` 构建 lib，经公开 plugin 面挂载）。
- “两个 workspace（同路径字符串、不同 ACL 策略）”中的 ACL 只能是**调用方侧策略标签**：公开 seam 根本没有携带策略的通道（`LspQueryRequest` 字段仅 operation/filePath/position/workspaceRoot，`packages/lsp/lsp/src/types.ts:38-47`）——**该缺失本身是结论，不是实验取巧**。
- 敏感文件为虚构（`P05-FABRICATED-SECRET-NOT-REAL-DATA`），仅 probe-scratch 内。

## 命令与退出码

| 命令 | 退出码 |
| --- | --- |
| `timeout 120 node p05-runner.mjs`（06-lsp/ 下，2026-10-16） | **0** |
| `git -C T rev-parse HEAD` / `git -C T status --porcelain`（runner 内前后） | 0 / 0（porcelain 均空） |

幂等：可重跑；重写 `p05-result.json` 与 `probe-scratch/`（含虚构服务器脚本）。

## 判定表（文件:行均指 pinned T 树）

| Leg | 判定 | 判据要点 |
| --- | --- | --- |
| P05-LSP-0 静态判定 | **CONFIRMED-CODEPATH** | 每 provider×workspace 常驻池：`lsp-stdio/src/index.ts:220-221`（`Map<WorkspaceKey,LspInstance>`，注释 "One live instance per stable canonical workspace identity"）+ get-or-create `:331-339` + 空闲驻留注记 `:277-278` + 仅 dispose 时收池 `:364-380`；`ctx.subprocess.spawn` 启动：`:157`（`spec => ctx.subprocess.spawn(spec)`）+ `connection.ts:92-104`（argv/cwd=规范化 workspace/piped stdio）+ inject `[fs,lsp,subprocess]` `:47`；宿主预读 filePath：`index.ts:279` → `host.ts:72-120`（`fs.streamText` `:99`，**先读后 spawn**）；池键 = `fs.resolve(workspaceRoot).target.targetKey`（`index.ts:264,274` + `host.ts:38-45`）**仅路径身份**；`LspQueryRequest` 无 agent/scope/policy 字段（`lsp/src/types.ts:38-47`）；Lsp 为**每 Context 全局单注册表**（`lsp/src/index.ts:82-88,143-149`）；tool-lsp 传 `workspaceRoot=sessionCwd(exec)` 无调用者身份（`tool-lsp/src/index.ts:183-194`） |
| P05-LSP-1 全栈挂载 | **PASS** | `ctx.plugin(fs-local)+plugin(Lsp)+plugin(subprocess-local)+plugin(lsp-stdio 命名空间插件,{servers})` 公开 plugin 面可装配，无需私有导入 |
| P05-LSP-2 首查询 | **PASS** | 真 provider spawn 虚构服务器（pid=41），宿主先经 ctx.fs 预读 a.p05 再 didOpen；正控 allowed 读 OK；boot forbidden 探针见 LSP-4 |
| P05-LSP-3 同路径不同策略 → 共享常驻服务器 | **HAZARD-OBSERVED** | 两次查询（模拟两策略主体）→ **同 pid=41**、opens=2：计划 §3 P0-5 危险对（"两个 Agent 同名 Workspace 但不同 Read ACL"）在真实池化代码路径上复现；且键**不可能**含策略（无字段通道） |
| P05-LSP-4 服务器侧读探针 | **UNCONFINED-READ-OBSERVED** | 虚构服务器 initialize 期以纯 OS 权限读禁读 fixture 文件成功（ok:true, bytes:36, head=P05-FABRICATED-S…）；ctx.lsp/lsp-stdio 路径上无任何拦截/中介；`host.ts:91` 的 containment 只约束宿主预读，**不约束服务器进程** |
| P05-LSP-5 不同 workspace → 不同服务器 | **PASS（正控）** | pid 41 vs 50：池粒度 = 每规范化 workspace，证明 LSP-3 共享由键驱动 |
| P05-LSP-6 自定义方法（真实 spawn seam 上） | **SERVER-READS-ARBITRARY-PATH** | ctx.lsp 面只有 4 语义操作、无 JSON-RPC 逃逸口（`lsp/src/index.ts:9-10`；types.ts 模块头）；用包根导出的 `LspConnection` + 真实 `ctx.subprocess.spawn` 发 `$/p05ReadProbe` → 服务器读任意路径成功 ⇒ 生产 provider 一旦实现任意方法即得任意 I/O 面 |
| P05-LSP-7 策略→服务器键 最小设计 demo | **DANGEROUS-SHARING-CODEPATH-SHOWN** | `keyA === keyB`（均 = targetKey 路径串）而 policy(A)≠policy(B)；对照 `index.ts:331-339` 的 get-or-create：按此键设计必然同服务器；最小安全键方向需 (policyGeneration, executionRealm, providerId)——**今日均不可从 LspQueryRequest 导出** |
| P05-LSP-8 拆除无残留 | **PASS** | dispose 前 pid [41,50] 存活、`ctx.fiber.dispose()` 后均消失（effect disposer `index.ts:179-185` → disposeAll）；范围=虚构服务器进程 |
| P05-LSP-9 NOT_RUN 项 | **NOT_RUN** | ①真实宿主 + 每 Agent ctx.lsp：**INCONCLUSIVE**（pinned 0.2.0-rc.2 无每-Agent Lsp 组合面，服务为 Context 全局）②真实语言服务器复用行为：NOT_RUN（虚构服务器）③权限降级→服务器退出重建：**UNEXPRESSIBLE/NOT_RUN**（seam 无策略输入可降级）④`workspace/applyEdit` 拒绝仅代码路径证据（`instance.ts:247-264`），依计划明文**不构成**全程只读证明（LSP-4 反证服务器直读） |
| P05-LSP-10 CORE_SEAM_BLOCKER 素材 | **RECORDED** | §6.1 固定格式逐项填于 p05-result.json（hostSHA/publicSeam/requiredBehavior/observedBehavior/minimalReproducer=本 runner L3/4/6/7/affectedInvariant=INV-1,2,5,6,9/alternatePublicRoutesExamined=R1 不适用、R2 realm 级隔离可行但池键仍仅路径、R3 键可改而 spawn 无 per-policy 约束参数/whyToolForkHelpsOrCannotHelp=Fork 无法搬移池键与 OS 约束/proposedUpstreamGenericAPI=LspQueryRequest 作用域身份或每-realm Lsp 解析 + 池键扩展点 + spawn per-spec 约束参数（与 P0-4 共享）/affectedToolFamilies=lsp 全族/safeFallback=严格 Profile 拒绝常驻语言服务器能力，fail-closed） |

## 缺口清单（NOT_RUN/BLOCKED 精确缺项）

- 真实宿主（`tests/deepseek-harness-test-use` 构建 + 3180 族实例）+ 每 Agent `ctx.lsp` 组合：**上游不存在该组合面**（见 blocker）。
- 真实语言服务器（如 typescript-language-server）复用/降级行为：需上项 + 时间窗，另行补测。
- OS 强制读 ACL（bwrap/landlock，P0-4 产物）接入 LSP spawn：上游 spawn 规格无约束参数。

## 综合 verdict 候选

**LSP-01 = INCONCLUSIVE（需真实宿主 + 每 Agent ctx.lsp）+ CORE_SEAM_BLOCKER 素材已按 §6.1 录**（"危险共享"的代码路径与运行时行为均已在真实 provider 码 + 虚构审计服务器上证明）。P0-5 逐工具分类候选：LSP 族 = **需要上游接口**（严格 Profile 下 fail-closed 拒绝；realm 级隔离为现公开面唯一可用形态）。
