# PR #17 合并前 bounded follow-up 工作指示（用户审查备忘）

> 记录时间：2026-09-14（PR #17 head = `a42ebf405b4e3dbb4a7607dd05cb7413684f29db`，base = `df9230de678f987f407f3bb59492863bb8dc6530`）
> 性质：**bounded follow-up** — 只处理 PR #17 审查后剩下的两个真实问题；不重新设计 alpha.2 permissions、不升级整套 DSH 依赖、不启动新的 hardening 波次。

## 0. 审查基线（PR #17 已正确完成、不得重新设计）

```text
PASS  explicit AgentSetup identity
PASS  0.1.2 legacy agentCtx.agent fallback
PASS  scopeOf(agentCtx) last-resort fallback
PASS  Coverage Gate 使用 tools.schemas(runtimeAgent)
PASS  permission cwd 使用 runtimeAgent.session.header.cwd
PASS  focused explicit-Agent tests
PASS  自定义 fs-only preset 的真实 DSH 0.1.5-rc.2 smoke
```

本轮只处理：

```text
F1  webServer internal/get shim 范围过宽
F2  standard preset + capabilities.permissions 的真实时序/可用性未验证
```

## F1 — 收窄 webServer internal/get compatibility shim

- 现状问题：PR #17 的 shim 监听**全局** `internal/get` 且只判 `prop === "webServer"` → 只要 Team row 活着，其他 unrelated plugin 的 `ctx.webServer`（未声明 inject）也可能被意外满足 → Team 加载时错误 dependency declaration 被隐藏、Team unload 后又突然失败 → 扩大 Team 的权限/DI 影响范围。
- 修复目标：把 shim 限制到**仅 Team 自己通过 `connection.rpc.handle()` 注册 `/team-remote` 时产生的那一次 `webServer` property read**。不能成为 process-wide 补 inject。
- 优先最小方案（**不得假设**，必须 probe 真实 0.1.5 host topology 验证）：若 `readerCtx === ctx`（Team registration caller context）成立 → `readerCtx !== ctx → next()` 守卫；若 traceable proxy/shadow 导致 identity 不等 → 寻找**最小、稳定且公开**的 caller identification seam。
- 禁止方案：给所有 webServer internal/get 放行 / patch Cordis / patch deepseek-harness / Symbol-fiber 私有字段 hack / 依赖不可公开的 internal object layout / 全局 monkey patch connection service。无法用公开稳定信息限定到 Team caller → **STOP 并报告为什么**。
- 必补测试：
  - **F1-T1**：真实或 fidelity 足够高的 Cordis world — Team 调用 `connection.rpc.handle('/team-remote', ...)`，connection owner 缺 webServer inject，webServer service 存在 → `/team-remote` mount 成功。
  - **F1-T2**（最关键 regression）：unrelated plugin/context 读 `ctx.webServer`（无 inject），即使 Team plugin 已加载，也必须保持原生 Cordis 行为 `cannot get property "webServer" without inject`。
  - **F1-T3**：0.1.2-era 行为不回归（可复用已有 0.1.2 probe）。

## F2 — 验证 standard preset + permissions 的真实时序

- 背景：用户 UI 实际选的是**标准模式**（preset id = `standard`）；PR #17 的 GREEN smoke 用的是自定义 `a2x-a5` fs-only preset → 只能证明 explicit-Agent fix 在受控 surface 上可工作，不能证明标准模式 + permissions 可工作。PR 自己的 follow-up backlog 已发现 standard preset 的 `subagent`（`modelSelectionSettings: true`）与 Coverage Gate 冲突。
- 本轮**只确定真实时序，不先设计解决方案**。
- 唯一要回答的问题（真实 DSH 0.1.5-rc.2，standard preset + capabilities.permissions + 不主动 deny subagent），记录三个时刻的 tool surface：
  - **A** = Permission Coverage Gate 执行时的 `tools.schemas(agent)`
  - **B** = `agents.create()` resolve / Agent publication 后的 `tools.schemas(agent)`
  - **C** = 第一次 model request 前的 `tools.schemas(agent)`
  - 重点看 `subagent` 在哪个时刻出现；`subagent` 与 `subagent_fork` **分别记录**（两者安装层级/时序可能不同）。
- Case A（`subagent` 在 Gate 前已存在）：Gate 应判 `KNOWN_SENSITIVE_UNMANAGED` → setup fail closed → 结论 = "standard preset strict-permissions 当前不可用，但无 post-gate bypass"；继续记录错误码/错误 detail/能否通过 `builtinToolDeny` 规避（若 own-layer/restrictableNames 问题导致规避失败 → 固定成 probe evidence）；只输出最小候选方案列表（Option 1 Team 专用 preset / Option 2 upstream scope-local deny / Option 3 delegation class authority owner / Option 4 Coverage Gate lifecycle/ownership contract 调整），**不实现**，等待人工裁决。
- Case B（Gate 时没有、publish 后才出现）：**P1 POST-GATE SURFACE EXPANSION** — Coverage Gate PASS → Agent publish → `agent/created` → standard preset 把 subagent 加入 Agent own layer → permission listener 对 unsupported tool pass-through → end-cap 对 unsupported tool abstain → 必须停止普通试用 strict permissions；先提交精确 evidence（触发条件/实际调用链/Gate 时 surface/publish 后 surface/为什么 listener/end-cap 拦不住/具体可执行用户场景）+ 一个最小修复建议，**停止，等人工裁决，不顺手修**。
- Probe 实现要求：优先写独立 probe / live-smoke（`tests/live-host-015rc2/` 或 `dev/agent-workflow/evidence/fix-alpha2-explicit-agent-setup-compat/standard-preset-probe/`），**不要先改 production code**；真实 0.1.5-rc.2 host + system `standard` preset + blueprint leader 声明 `capabilities.permissions` + 不用 custom fs-only preset + 不 deny subagent + 记录 A/B/C + subagent 注册实际时机 + team.create 最终结果；若 team.create 在 A 阶段就 fail，仍要保存 A surface 和 typed error；若能 publish，继续记录 B/C。
- F2 后 stop rule：Case A → 最小候选方案列表 + 等裁决；Case B → P1 标记 + 精确 evidence + 停止。

## 本轮允许修改的文件

- F1 production fix：`packages/runtime/src/plugin/host.ts`、对应 dist artifact、相关 remote-mount tests。
- F2：probe / evidence / focused test fixture。除非 Case A/B 已被人工裁决要立即修，否则**不要修改 permission coverage production logic**。

## 本轮禁止修改

```text
packages/runtime/operation-permission/permission-coverage.ts
packages/runtime/operation-permission/pre-execute-adapter.ts
packages/domain/blueprint/**
packages/storage/**
packages/contracts/**
MCP policy / Team tools / subagent upstream code / deepseek-harness source
```

禁止：升级所有 @deepseek-ai/* 依赖到 0.1.5 / 重写 preset 系统 / 新增 Team preset 产品功能 / 新增 scope-local restrict 实现 / 扩大 PERMISSION_TOOL_NAMES / 把 subagent 改成 SAFE_UNMANAGED（均需单独设计裁决）。

## 必跑测试

- **Gate A（F1 focused）**：`t12m4-remote-mount`、`rmr-remote-mount-race`、新增 internal/get isolation regression。
- **Gate B（explicit-Agent regression）**：`alpha2-explicit-agent-setup`、`a2c2-permission-coverage`、`a6a-production-wiring`、`h1a-pre-execute-endcap`。
- **Gate C**：`pnpm --filter @dsh-agent-team/runtime typecheck`、`pnpm build`、`pnpm build:composition`、`pnpm check:artifacts`（或仓库 canonical 等价命令）。
- **Gate D（real 0.1.5）**：(1) custom fs-only preset smoke → 应继续 GREEN；(2) system standard preset probe → 记录 A/B/C，不要求预设 GREEN。
- 可省略：完整 browser E2E / client UI / messaging matrix / handoff matrix / lifecycle suite / multi-MCP suite / alpha.2 security matrix / storage/domain/contracts suite；touched-package regression 没有扩张失败集则不继续扩大。

## PR 更新要求

- 不拆新 PR，直接更新 PR #17 branch（除非仓库政策明确要求新 PR）。
- 建议追加 commit：`fix(runtime): scope webServer compatibility shim to team remote mount`；F2 probe/evidence 可同 commit 或独立 evidence commit。
- PR 描述更新成真实状态：`explicit-Agent fix: GREEN on controlled fs-only permission surface` + `standard preset: probed separately, result: <CASE A / CASE B / GREEN>`（不要再笼统写 "real 0.1.5 permissions smoke GREEN"）。

## 完成定义（全部满足才结束）

- [ ] F1 shim 不再 process-wide 放行任意 `webServer` read；
- [ ] unrelated plugin/context 缺 inject 时仍保持 Cordis 原生失败；
- [ ] `/team-remote` 在真实 0.1.5 host 仍能 mount；
- [ ] explicit-Agent fix regression 全绿；
- [ ] custom fs-only permissions smoke 仍 GREEN；
- [ ] standard preset A/B/C tool-surface probe 已完成；
- [ ] `subagent` / `subagent_fork` 时序被明确；
- [ ] Case A / Case B 已被裁决；
- [ ] 没有擅自扩大权限体系设计；
- [ ] CORE PATCH BUDGET = 0。

## 最终输出格式（汇报用）

```text
F1:  webServer shim {old scope / new scope / unrelated-context negative / 0.1.5 /team-remote mount / 0.1.2 compatibility}
F2:  standard preset probe {A gate surface / B post-publish surface / C pre-model surface / subagent A,B,C / subagent_fork A,B,C / team.create result / classification: CASE A | CASE B | neither}
Tests: {focused / runtime regression / typecheck / build/artifacts / custom-preset live smoke / standard-preset live probe / new failures}
Git: {branch / commit SHA / PR #17 head}
```

## 最重要原则

目标不是"让所有 standard preset + permissions 问题一次性全部解决"，而是：(1) 修掉 PR #17 自己引入的过宽 webServer shim；(2) 把 standard preset + permissions 的真实阻滞机制和时序查清楚。一旦 F2 证明需要新的权限设计 → **STOP**，不继续自行扩展实现。
