# LSP 裁决简报 — C-PROC streaming-pipe 臂 与 policy→realm 映射（decision brief，只整理不实现）

- 轮次 = `alpha5-lsp-rulings`；writer = qwen3.8-flash-next（liveness 首报）；基 = `origin/master @ 8eb93ddd`（fetch 亲验）。纪律 = 只读 + 本文件新增；**零代码/矩阵/gates 行改动**；零端口、零 world、`:3080` 未触碰。
- 议题来源 = 根 04:57Z（"如确实改变冻结接口→整理最小裁决说明"）；事实源 = `w-ptc-re/README.md` M-09 三态行 + 其探针 `probe-gap-lsp-policy.result.json`（gap1/gap2）+ `pr6/SEAM-VERDICTS.md` B1–B5。
- 记：GAP = `w-ptc-re/probe-gap-lsp-policy.result.json`；SV = `pr6/SEAM-VERDICTS.md`；RD = `w-ptc-re/README.md`；ROW = `w-ptc-re/a5ptc-row.mjs`；PROV = `packages/runtime/sandbox-provider/provider.ts`。
- **状态同步（P-D3b，2026-10-17，@根 14:29Z 口径同轮 = `prod/VNEXT-SCHEMA-ADR.md` P-D3；父会话授权，markdown-only）**：**R-1/R-2 = 用户 07:53Z 已批准，已实施并合入（#304=`77ffb187`**，见证 = `ALPHA5-ACCEPTANCE-STATUS.md` §1「LSP 生产装配」行测量基线『master@77ffb187（#304 R-1/R-2 已合）』）。本简报 = 提案时点历史原文：§0 问句式、§1/§2『裁开/若坚持…』与 §3『裁决前允许表述』均为提案原文照录保留，不代表现行状态；其他文件旧把本议题写作『已正式向用户提出未裁（待答）』者，属裁决前历史口径（已在 `PRODUCTION-READINESS-CHECKLIST.md` P-D3b 更正）。

## 0. 裁决问题（各一句）

- **R-1**：冻结 C-PROC 的 confined provider 形状是否开**长驻双向管道臂**（stdin Writable）——裁开 = Team 自持冻结面需增补；裁不开 = M-09 A3（服务器 OS 读受 C-PROC 中介）在 C-PROC 形状下永久让位。
- **R-2**：M-09 A2/A4 的"策略变更→旧 PID 终止重建 / 跨策略零复用"主张按 **Team 自持 realm 粒度**收口，还是坚持 **realm 以下策略粒度**（池键含 policyGeneration）——前者纯装配可闭合（非上游），后者触上游 SEAM-GAP。

## 1. R-1 C-PROC streaming-pipe 臂（M-09 A3）

- 改动面（实测非推断）：冻结形状 `execute()/spawn()` one-shot 同返 `{receipt, output, lease}`（PROV:243/:292）；`RunOutput` = 已结束运行的三个 string 字段（PROV:99-103）；`SpawnReceipt` = `{lease, processIdentity:string}`（PROV:106-109）——**无活进程句柄、无 stdin 流臂**；`SpawnRequest.declaredFds`（PROV:74）只是 fd 声明指纹，不带流。LSP 协议需长驻双向管道（GAP:59 `lsp_connection_requires_pipes=true`），而 host 公开面句柄已有 `stdin: Writable`（GAP:57）⇒ 差异全在 Team 冻结形状侧，与上游无关。
- 候选设计（一句，不动既有 RunOutput 语义）：provider **平行新增** `spawnStreaming(request) → StreamingSpawnReceipt`（新 receipt 变体携 `stdin: Writable` + stdout/stderr 读流，复用同一 `ProviderLease`/terminate 语义），`spawn()`/`RunOutput`/lease 词汇原样不动 = 纯附加。
- 不动的后果（一句）：M-09 A3 无法在 C-PROC 形状下纯装配真跑——LSP 服务器进程只能走 host 公开 `ctx.subprocess.spawn`（公开面、可 per-realm 重装，GAP:63 装配可及），但**不经 C-PROC confined**，"服务器 OS 读受中介"宣称须永久排除 C-PROC 覆盖面。
- 标注：**改冻结接口 = 是**（SpawnReceipt 语义面；唯一零触碰形态 = 上述纯附加方法）/ **CORE_SEAM_BLOCKER 级 = 否**（GAP gap2 verdict 原文"裁决项(非上游)"；host 侧公开面已在）/ Team 先行不升格 = A3 receipt 维持 NOT-EXECUTED 在册（RD:23）+ 装配继续用公开 spawn 但显式披露"非 C-PROC 中介"residual + 本简报仅存设计不触 provider.ts。

## 2. R-2 policy→realm 映射（M-09 A2/A4）

- realm 粒度 Team 自持 = **可行**（此口径下**非上游问题**）。依据行：池隐私来源 = per-realm provider 实例、"池键仍是纯路径"（SV:52）；公开面装配 = `agent.ctx.isolate('lsp')`（ROW:328）+ `realm.plugin(Lsp/lspStdio/toolLsp)`（ROW:335-336/:353），LIVE 实证两 member 同 workspace pids 128/187 互异、热复用/仅杀自身/兄弟不受扰（RD:21）；"策略变更→旧 PID 终止重建"可按 (member×策略代际)→realm 构造：旧 realm `fiber.dispose()` → SIGTERM/SIGKILL 且 pid 消失有界（ROW:150 处置路径；SV:63 dispose await 到进程关闭，instance.ts:267-301 "nothing outlives disposal"）→ 新代际新 realm 新 pid。
- residual 必披露：host 池键仍纯路径、`LspQueryRequest` 无 caller/policy 字段（SV B1:47-48，lsp/src/types.ts:38-47）⇒ **同 realm 内两策略标签仍共享 pid**（SV:58 HAZARD 形状）⇒ "一 realm 一 (member×策略代际)" 是 Team 侧装配纪律（执行面 = 装配约定 + probe 复跑，非 OS 强制）；**严禁把共享池改名复用冒充策略隔离**（SV:60 原文）。
- 若坚持 realm 以下粒度：上游改动面 = `LspQueryRequest`/stdio `Config` 策略输入 + 池键扩展 + generation 逐出钩子，公开面三者全无（GAP:40-42；GAP:48 verdict；SV:60 "realm 是公开面可表达的最细隔离粒度，全键设计要求上游扩展点"）。
- 标注：**改冻结接口 = 否**（realm 口径纯装配 + 主张措辞；上游全键口径改的是上游公开面）/ **CORE_SEAM_BLOCKER 级 = 分叉**：realm 口径**非**；policyGeneration 全键口径**是**（CORE PATCH BUDGET=0 ⇒ 阻塞非待办）/ Team 先行不升格 = A2/A4 按 realm 粒度装配复跑、receipt 字段如实写"realm 粒度达成；policy 粒度 NOT-EXECUTED"（A4 已在此形态，RD:24），全键扩展只登记不启动。

## 3. 裁决前允许表述（各一句）

- R-1：C-PROC confined 覆盖面 = one-shot confined spawn；LSP 服务器进程不在其内；相关宣称裁决前按"未覆盖"读，选项与后果见 §1。〔P-D3b：R-1/R-2 已批已合（用户 07:53Z 批准 + #304=`77ffb187`）；本行 = 裁决前时点历史口径照录。〕
- R-2：仅许两分表述"realm 粒度隔离为实（SV B2 / RD:21 LIVE），policy 粒度逐出未宣称"；任何主张行须标粒度并同引本简报。

---
writer = qwen3.8-flash-next（只读 + 本文件新增；引用行号全部在 `origin/master @ 8eb93ddd` 树亲验；RD:21-24 所引 runs 证据在 `w-ptc-re/runs/` 在册）。
