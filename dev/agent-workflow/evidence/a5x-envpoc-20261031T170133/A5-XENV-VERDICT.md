# A5-XENV 判决 — 不修改原生工具的前提下，Member 全部原生工具能否共享受限执行环境

> **PoC 横幅**：本文是 PoC 判决（branch `task/a5x-envpoc-20261031`，pristine 运行时
> 0.2.0-rc.2 @ `639ed01539`，全部证据 = `dev/agent-workflow/evidence/a5x-envpoc-20261031T170133/`
> 及同前缀早期波次目录），**不构成生产验收标准**。宿主 :3080 与真实 `~/.dsh` 全程未受影响
> （前后探测均 401）。CORE PATCH BUDGET 使用量 = 0。
>
> 裁决依据（用户 2026-10-31 直接指令）：验证外部评审的关键问题——
> “能否在不修改原生工具、不修改 DSH Core 的前提下，让一个 Member 的全部原生工具共享正确的受限执行环境”，
> 并确定 Plan A（公开 seam：isolate + wrapped provider + 原生模块重载）天花板与 Plan B（进程外宿主）是否必要。
> **弱形态管辖集**（用户同日裁决）：只管直接读/写/网络能力工具（read/write/edit 类、bash 类、LSP 等）
> **加上间接读工具（present 类）**；job_list/goal/task 类不管。网络控制与沙箱控制同理，都是边界控制。

---

## 0. 判决（一句话）

**可以（在弱形态管辖集内）**：用 `agentCtx.isolate(<service>) + iso.provide(wrapped provider) + iso.plugin(原生模块本体)`
三段公开 API，就能让一个 Agent 的全部**经服务的**原生工具在**真实 dispatch 路径**上共享每成员策略的受限执行环境——
原生工具一行不改、Core 零补丁、无重实现（A5-NATIVE-01/02/BOUNDARY-01/FALLBACK-01 四条全守住）。
**天花板**：工具 body 内直接 node:fs/直连 syscall（PoC 的 `a5x_evil`）provider 层不可拦截——
实测绕过成功。该洞有名字、有测法、有两条封闭路（注册权门禁 或 Plan B 进程边界），**不是静默洞**。
**Plan B 必要性判定：为“不可要求经服务的 body”（第三方/任意 JS 工具）而必要，但 fs/web 治理集不需要它**；
最小 spike 已证进程边界 + 通用 IPC 连读侧都能封（见 §4）。

---

## 1. 测量方法（全部公开面）

- 宿主 = pristine test-use 构建，`DSH_HOME=tests/homes/<stamp>`，端口 3186；探针经
  `profiles/web/cordis.patch.yml` 的 `insert` 行以文件 URL 挂载（公开 profile-patch seam）。
- 会话 = 公开 `POST /api/session/create`（`agentPreset:'a5x-tools'`，preset roster 经 patch 层声明：
  persona + `@deepseek-ai/dsh-tool-fs` + persistent-shell 组 + `@deepseek-ai/dsh-tool-web`）。
- **判定透镜 = 真实模型 dispatch**：in-process mock model（`packages/tools/harness/mock-deepseek.mjs`）
  脚本化 6 个工具调用步（a5p1 教训：步骤计数在脚本侧，绝不从 transcript 反推）。
  结果文本逐步快照 + 宿主外文件存在性双重取证。
- 波次 7→11 收敛：wave-7 抓到 provide 语义事实；wave-8 抓到 iso-reapply 接管 dispatch 的事实
  （守卫参数形状 bug 在 wave-9/10 修尽：`FsTarget.displayPath`、`relative()`+`isAbsolute` 包含判定）；
  **wave-11 = 全绿定稿**（`summary.json` + `turn-evidence.json` + `ledger.jsonl`）。

## 2. 核心实测事实（波次账目）

| # | 事实 | 证据 |
|---|------|------|
| F1 | `ctx.provide(name, x)` **拒绝覆盖**已注册服务：`ERR service "fs" has been registered at <SandboxedFileSystem>`（web 同型）→ provide-swap 变体死亡 | ledger `plant`，wave-7/8/11 复现 |
| F2 | `agentCtx.isolate(name)` 可用；`iso.provide` 合法（own-label 是 cordis 文档化机制） | wave-1 `isolateSupported:true` + wave-11 `isoReapply:applied` |
| F3 | **`iso.plugin(原生 tool-fs 模块本体)` 后，模型 dispatch 命中的是 isolate 层重声明的原生定义**：4 条 fs 调用全部穿过我们的 provider 守卫（`fs-guard` 账目行），错误由**原生 body 抛出**（A5-BOUNDARY-01 成立） | wave-8 首证 + wave-11 定稿 |
| F4 | **范围内零退化**：`read(inside.md)`→`INSIDE-OK`、`write(wroot/note.txt)`→落盘 TRUE——同一批**未改一字**的原生工具 | wave-11 `readInsideOk:true`, `writeInScopeWritten:true` |
| F5 | **越界受控**：`read(secret)` 与 `write(escaped.txt)` 均被原生 body 以 `A5X-ENFORCE-REFUSE` 拒绝；secret 全程完好、escaped.txt 从未出现 | wave-11 `readSecretRefused:true`, `writeEscapeRefused/Happened:true/false`, `secretIntactAtEnd:true` |
| F6 | web 同理：`isolate('web') + tool-web 重载` → `web_fetch(example.com)` 在**任何网络动作之前**被拒（`A5X-NETWORK-REFUSE`），`webFetchAttempted:false` | wave-11 verdicts + `net-guard` 行 |
| F7 | **Plan A 天花板**：注册进 agent scope 的 `a5x_evil`（body 直接 `readFileSync(SECRET)`，不经任何 DSH 服务）可被 dispatch 且**读到 secret**（`evilBypassed:true`）。注册本身被接受（输出契约齐备），运行期 provider 层无法拦 body 内直连 syscall | wave-11 verdicts |
| F8 | agent scope 直接重载原生模块被宿主自身规则拒绝：`prompt section "tool:read" is already registered in this scope`——preset realm 跑在 agent scope 上；isolate 层是唯一无冲突重声明位 | wave-8/11 `agentReapply` |
| F9 | `sandbox.confine()`（bwrap/Landlock 方言）**写侧执法**：workspace-write + 单 workspaceRoot 下越界写 `Read-only file system` exit 2、secret 完好；**读侧无 scoping**：confine 下 `cat SECRET` exit 0 成功（方言硬编码 `readOnly:['/']`） | ledger `confine`，三波复现 |
| F10 | preset roster 经 patch 层声明 + `agentPreset` 参数在普通 session 上成立；`tools.get()` 从 row/agent ctx 看**不是** preset 工具的可见性透镜（多次 wait 全 false 而 dispatch 可执行）——治理与验收都必须以 dispatch 为准 | wave-4/5 vs wave-7-11 |

## 3. Plan A 判决

**可行域（弱形态管辖集逐类映射）**：

- **read/write/edit 类**：F3-F5 直接覆盖（实测）。守卫读 `resolve→FsTarget.displayPath` 链；
  PoC 守卫为示范实现（canonicalize 最深存在祖先 + fail-closed），生产守卫需另测 symlink/TOCTOU 细目。
- **间接读工具（present 类）**：其 body 同样经 `ctx.fs` 服务取文件内容——同 isolate 内随 fs provider 换装自动纳入。
  **诚实披露：present/read_image 未逐一实测**；“经服务的工具自动覆盖”是 F3 的直接推论，逐工具矩阵仍须按 S0 流程补测。
- **web 类**：F6 覆盖（egress 白名单接缝在 fetch/search 之前裁决；宿主自带 SSRF 私网守卫叠加共存）。
- **bash 类**：正常启动路径已被 `terminal-bash → sandbox.confine` 覆盖（F9 写侧）；**读侧是宿主方言的洞**（F9 读腿），
  与治理层无关，属沙箱方言缺口（§5 fork 候选）。
- **job/goal/task 类**：按裁决不管辖。
- **前提条件（全部公开面，已实测存在）**：per-member 组装点 `agent/created → payload.agent.ctx`；
  `isolate/provide/plugin/register` 语义；注册时序在首回合之前。

**天花板（有名字的洞）**：F7。任何运行在宿主进程内、body 直连 syscall 的工具定义，provider 层不可见。
治理选择：(a) **注册权门禁**——只有 Team 装配方能为 member scope 注册工具，第三方代码不获得
`tools.register` 能力（PoC 中注册来自我们的受信 row，洞是我们自己造的，生产不开放这个入口即可）；
(b) **Plan B 进程边界**——当必须运行“不可要求经服务”的 body 时唯一正解。两者都满足 A5-FALLBACK-01：
洞是显式的、可测的，不产生静默旁路。

## 4. Plan B 判决（最小 spike，`planb-spike.json`）

- 通用 line-JSON IPC（name/args/result 传输，无业务语义，A5-NATIVE-02 允许）往返可行：
  2 调用批量往返 plain 子进程 **38ms** / confined 子进程 **41ms**（bwrap 冷启动含在内，个位 ms 级净传输）。
- **同一把绕过钥匙在 OS 边界前失效**：plain 子进程 `readFileSync(SECRET)` 成功（复现 F7），
  同一调用在 `bwrap --ro-bind / / --tmpfs <secretDir>` 子进程内**失败**（`evilReadDeniedUnderOsBoundary:true`），
  范围内读经 IPC 仍成功（`inScopeStillWorks:true`）。
- 结论：**Plan B 是 F7 类 body 的必要封闭**，且读侧封闭需要挂载级方案（bwrap tmpfs/掩码）或
  Landlock read-whitelist——**宿主现方言两者皆无**（F9 读腿），直接用 `confine()` 不闭合读侧。
- 不现在做全量 Plan B 的理由：fs/web/bash 治理集由 Plan A + confine 全覆盖；全量 B（真 ToolRuntime
  进子进程 + signal/流式/output 契约过 IPC）是大工程，触发条件 = 出现必须运行、且无法要求经服务的第三方 body。

## 5. 有限 fork 候选（ADR:77 许可位）

按不变量，fork 只允许在**环境/能力层**，不得触碰 body 业务逻辑：
1. **沙箱方言读白名单**（`dsh-sandbox` 契约 ~240 LOC + `dsh-sandbox-local` ~641 LOC）：
   `SandboxExecutionPolicy` 增 `readRoots[]/writeRoots[]`、去 `readOnly:['/']` 硬编码、封
   `mode:'danger-full-access'` 的成员侧切换。≈1.1k LOC 自有维护面，换 spawn 类**读侧**执法。
2. 反面对照：**fork/复制 tool bodies**（tool-fs 1519 + tool-fs-search 1551 + tool-bash 812 + tool-bash-persistent 484 +
   tool-web 1006 + … ≈15k+ LOC 且每宿主版本漂移）= 黑洞，被 A5-NATIVE-01 与本次 Plan A 实测双重否决。

## 6. 缺口清单（PoC 不外推，后续义务）

- `present`/`read_image`/LSP 类逐一 dispatch 实测（推论待证）。
- readRoots/writeRoots 的**每成员注入通路**（Team blueprint capabilities → `agent/created` 处理器的策略装载）与
  sessionId→member 绑定校验。
- `restrict()` API（宿主公开的原生工具掩码，本次未用）与 isolate 重声明的组合语义。
- 守卫的 symlink/TOCTOU/流式（streamText 半开流）细目；`fs/write-intent`/`fs/edit-intent` 公开 hook 是否比
  wrapped provider 更正统（本次未选它，因 provider 换装已被 dispatch 证实）。
- Plan B spike 只证边界性质；IPC 承载 output 契约/取消/流式 = 全量设计另案。

## 7. 复现与可逆性

```
# 全量 PoC（≈90s）：
cd .worktrees/a5xenv-20261031/tests/kits/a5x-envpoc && node a5x-kit.mjs
# Plan B spike：
node a5x-planb-spike.mjs <evid>/rootA <evid>/secret/outside.md <evid>/planb-spike.json
```
证据目录（本目录）+ `tests/homes/a5x-envpoc-*`（gitignored）+ worktree 分支即全部副作用；
删除即完全可逆。宿主 :3080 前后 401 恒等，pristine test-use porcelain 空。
