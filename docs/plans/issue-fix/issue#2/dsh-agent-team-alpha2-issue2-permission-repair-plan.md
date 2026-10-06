# dsh-agent-team — Alpha.2 Issue #2 权限模块修复计划
## `builtinToolDeny` 真实 preset 限制闭环 + 三线并行集成

> **适用仓库**：`ArmourPiercer1/dsh-agent-team`
>
> **Issue**：#2 — `builtinToolDeny cannot restrict preset-provided tools in Team-created agents and may poison create-or-open restart state`
>
> **本计划只负责 Issue #2 的权限侧修复。**
>
> Issue #2 是一组耦合故障：
>
> 1. **A — 权限/能力侧**：`builtinToolDeny: [pwsh]` 在 Team-created Agent 上无法稳定证明能限制 preset 提供的工具；
> 2. **B — host/Blueprint 生命周期侧**：任意 setup failure 可留下 `TeamSession=yes / root Session artifact=no` 的 partial-create 状态，后续 `create-or-open` 错走 `resume` 并永久失败；
> 3. **C — Remote/Blueprint 交互侧**：runtime boot failure 会让 `/team-remote` 根本未挂载，使真实 bootstrap failure 在 GUI 上伪装成 HTTP 405。
>
> 本计划只实现 **A**，并定义与 **B/C 的 Blueprint repair 分支之间的组合验收契约**。
>
> **Issue #2 不能由本权限 PR 单独关闭。**
>
> ---
>
> ## 基线
>
> 共同开发基线：
>
> ```text
> dsh-agent-team:
>   6a2f3e1e906479ce8d0b07f9bcc6fef4e737f925
>
> deepseek-harness:
>   stable @ a66e4702047846cdaa10c66c9d3df3951f5ea70d
>   0.1.2-rc.1
> ```
>
> 并行开发文档：
>
> ```text
> dsh-agent-team-alpha2-hardening-followup-repair-plan.md
> dsh-agent-team-alpha2-blueprint-loading-parallel-repair-plan.md
> diagnostic-report-20260911-builtin-deny.md
> GitHub Issue #2
> ```
>
> **CORE PATCH BUDGET = 0**
>
> 不修改 `deepseek-harness` 产品代码，除非新的真实 seam 证据证明 upstream contract 本身损坏；当前诊断的 upstream-only 控制实验已证明正常，因此默认 ownership 为 **PLUGIN**。
>
> ---
>
> # 0. 执行摘要
>
> 本轮权限修复只有一个产品目标：
>
> > 对共享 preset 提供的 built-in tools，实现真正的 **per-teammate subtractive capability restriction**。
>
> 最终必须可以稳定表达并执行：
>
> ```yaml
> expert:
>   capabilities:
>     builtinToolDeny: []
>
> researcher:
>   capabilities:
>     builtinToolDeny:
>       - pwsh
> ```
>
> 期望：
>
> ```text
> expert
>   -> pwsh visible
>   -> pwsh callable
>
> researcher
>   -> pwsh absent from model-facing tool surface
>   -> direct dispatch cannot execute pwsh
>   -> sibling expert unaffected
> ```
>
> 本轮同时必须证明：
>
> ```text
> builtinToolDeny
>   > parameter-level permissions
> ```
>
> 即：
>
> ```text
> tool 已被 capability layer 隐藏
> -> alpha.2 permissions.allow / ask 不得把它重新授权
> -> zero ControlRequest
> -> zero authorization marker
> -> zero tool effect
> ```
>
> ---
>
> # 1. 当前已知事实
>
> ## 1.1 Upstream contract 已有正向证据
>
> 诊断报告已用真实 rc.1 seam 验证：
>
> ```text
> AgentPresets.mount()
> + standing preset scope
> + bindScopeParent()
> + tools.restrict({deny:['pwsh']})
> ```
>
> 在 upstream-only world 中成立。
>
> 已观察：
>
> ```text
> composedPreset == requestedPreset
> parent(agent) == standingPresetScope
> pwsh ∈ visibleToolsBeforeRestrict
> pwsh ∈ restrictableNames
> restrict([pwsh]) succeeds
> pwsh ∉ visibleToolsAfterRestrict
> sibling unaffected
> ```
>
> 因此：
>
> ```text
> 不得预设 deepseek-harness tools.restrict() 有 bug
> 不得修改 upstream scope topology
> ```
>
> ---
>
> ## 1.2 旧事故的 production artifact 不可 pin
>
> 原 alpha.1 生产故障来自：
>
> ```text
> installed artifact
> != fee2660 committed dist
> != 7570073 committed dist
> != e877478/37f3ca4 committed dist
> ```
>
> 因此当前 alpha.2 修复的第一步必须是：
>
> > **先在 6a2f3e1e + fresh build artifact 上重现，再决定是否修改产品代码。**
>
> 如果当前 source + rebuilt dist 已经不再复现：
>
> ```text
> 不允许为了“看起来应该修点代码”而发明新的产品改动。
> ```
>
> 此时本权限 PR 只需要：
>
> 1. 补真实 seam regression；
> 2. 补 build/install artifact pin 证据；
> 3. 证明当前 alpha.2 已经满足产品契约；
> 4. 将 Issue #2-A 定性为旧 artifact drift + coverage gap；
> 5. 不改变 production semantics。
>
> ---
>
> ## 1.3 当前测试存在真实 coverage hole
>
> 现有 alpha.1/alpha.2 capability wiring 验收大量使用：
>
> ```text
> createAgentPresetsDouble()
> recording double
> ctx.toolRestrictions
> ```
>
> 它证明：
>
> ```text
> glue 调用了 restrict
> ```
>
> 但不能证明：
>
> ```text
> real AgentPresets
> + real dsh-scope
> + real ToolRuntime
> + Team-created member
> ```
>
> 下 `restrict()` 真正成功。
>
> 本轮必须增加 real-seam Team integration test。
>
> ---
>
> # 2. 与另外两条并行开发线的关系
>
> 当前存在三条并行线：
>
> ```text
> A. fix/alpha2-hardening-followup
> B. fix/alpha2-issue2-permission
> C. fix/alpha2-blueprint-loading
> ```
>
> 三条线全部从：
>
> ```text
> 6a2f3e1e906479ce8d0b07f9bcc6fef4e737f925
> ```
>
> 分叉。
>
> 开发中：
>
> ```text
> NO cross cherry-pick
> NO repeatedly merge master
> NO use another feature branch as development base
> ```
>
> ---
>
> # 3. 固定合入顺序
>
> ## 3.1 顺序
>
> ```text
> parallel development
>        ↓
> PR-HARDENING ready
> PR-ISSUE2-PERMISSION ready
> PR-BLUEPRINT ready except final integration
>        ↓
> merge PR-HARDENING
>        ↓
> rebase PR-ISSUE2-PERMISSION onto new master
>        ↓
> replay hardening + Issue2 gates
>        ↓
> merge PR-ISSUE2-PERMISSION
>        ↓
> rebase PR-BLUEPRINT onto new master
>        ↓
> preserve all three ownership hunks
>        ↓
> regenerate artifacts / recompute pins
>        ↓
> three-line combined gates
>        ↓
> merge PR-BLUEPRINT
> ```
>
> ---
>
> ## 3.2 为什么 Issue #2 permission 放在第二个
>
> Hardening follow-up 修：
>
> ```text
> H4 exact-rule fresh canonicalization
> H5 Bash full effect fingerprint/workdir authority
> ```
>
> 它是 alpha.2 permission/security baseline 的窄安全 closure，应先成为不可回退基线。
>
> Issue #2 permission 修：
>
> ```text
> preset composition
> builtinToolDeny
> capability-level hiding
> ```
>
> 它应在 H4/H5 后重放，确保 capability fix 不破坏 parameter permission。
>
> Blueprint repair 最后合入，因为它会同时改：
>
> ```text
> Blueprint authority
> host/root lifecycle
> agent-bindings Blueprint resolution
> remote readiness
> client refresh
> ```
>
> 并已被指定为最终组合态 integration gate。
>
> ---
>
> # 4. 文件 Ownership Fence
>
> ## 4.1 Hardening follow-up 独占
>
> Issue #2 permission PR **禁止修改**：
>
> ```text
> packages/runtime/operation-permission/**
>
> packages/runtime/test/a2*
> packages/runtime/test/a3*
> packages/runtime/test/a4*
> packages/runtime/test/a5*
> packages/runtime/test/h1a*
> ```
>
> Issue #2 只能运行这些测试，不改变其行为。
>
> ---
>
> ## 4.2 Blueprint repair 独占
>
> Issue #2 permission PR **禁止修改**：
>
> ```text
> packages/domain/blueprint/**        # 除非仅为测试 fixture import，不改 schema/validation
> packages/storage/schema/**
> packages/storage/repositories/blueprint-registry.ts
> packages/runtime/src/plugin/blueprint-*.ts
> packages/runtime/src/plugin/root.ts
> packages/runtime/src/plugin/host.ts
> packages/runtime/src/plugin/s6-remote.ts
> packages/runtime/src/plugin/types.ts
> packages/client/src/ui/TeamCreationPanel.tsx
> ```
>
> 特别禁止本分支自行修：
>
> ```text
> TeamSession=yes / rootSessionArtifact=no
> create-or-open recovery
> /team-remote mount-before-boot
> Blueprint registry/freeze
> catalog readiness
> UI refresh
> ```
>
> 这些属于 Blueprint/host lifecycle 分支。
>
> ---
>
> ## 4.3 Issue #2 permission 独占
>
> 本 PR 主要 ownership：
>
> ```text
> packages/tools/src/builtin-deny.ts
> packages/tools/test/<issue2-builtin-deny-focused>.test.ts
>
> packages/runtime/test/<issue2-real-preset-restriction>.test.ts
> packages/runtime/test/<issue2-capability-permission-precedence>.test.ts
>
> dev/agent-workflow/evidence/alpha2-issue2-permission/**
> ```
>
> 根据 B2 结果，必要时允许修改：
>
> ```text
> packages/runtime/src/plugin/live/agent-bindings.mjs
> ```
>
> 但只允许修改 **preset composition / builtinToolDeny hunk**。
>
> ---
>
> # 5. `agent-bindings.mjs` 三方函数级 ownership
>
> 这是三个 PR 最重要的冲突防线。
>
> 同一文件中严格分成三块：
>
> ## 5.1 Blueprint PR
>
> 只改：
>
> ```text
> getBoundBlueprint / resolveBoundBlueprint
> locateTemplate()
> staticCapabilitiesOf() 的 Blueprint source
> per-Team bound snapshot lookup
> ```
>
> ---
>
> ## 5.2 Hardening follow-up PR
>
> 只改：
>
> ```text
> fsBackend / resolveTarget
> permissionPolicy install block
> Bash effective workdir authority seam
> installParameterPermissionListener(...) parameters
> ```
>
> ---
>
> ## 5.3 Issue #2 permission PR
>
> 只改：
>
> ```text
> agentPresets.composedPreset(...)
> agentPresets.mount(...)
> preset mount/skip decision
> applyBuiltInToolDeny(...)
> builtin restriction lifecycle / diagnostics
> ```
>
> 禁止本 PR：
>
> ```text
> 重排整个 AgentSetup
> 全文件格式化
> 改 Blueprint resolution
> 改 permission listener implementation
> ```
>
> 即使 Git 自动 merge 无冲突，也必须人工确认三块都保留。
>
> ---
>
> # 6. 权限层级契约
>
> alpha.2 组合态必须冻结为：
>
> ```text
> preset/base tool supply
>        ↓
> builtinToolDeny capability subtraction
>        ↓
> Team tool scoped registration
>        ↓
> parameter permission listener + monotonic end-cap
>        ↓
> dispatch
> ```
>
> 逻辑上：
>
> ```text
> capability absence
>    >
> operation authorization
> ```
>
> 因此：
>
> ```text
> builtinToolDeny:[read]
> + permissions.allow read:any
>
> => read 不存在
> => direct execution rejected as unavailable/unknown
> => no ControlRequest
> => permissions.allow cannot resurrect it
> ```
>
> ---
>
> # 7. Blueprint 交互契约
>
> 本权限 PR 不修改 Blueprint 管理系统，但必须冻结以下 integration contract。
>
> ## 7.1 `builtinToolDeny` 是 Template capability
>
> 来源必须是：
>
> ```text
> owning TeamSession
>   ↓
> frozen Blueprint snapshot
>   ↓
> bound template
>   ↓
> capabilities.builtinToolDeny
> ```
>
> Blueprint repair 完成后，不得重新使用：
>
> ```text
> host row-global config.blueprintSource
> ```
>
> 作为 dynamic Team 的 capability authority。
>
> ---
>
> ## 7.2 authoring/save 不负责 host-specific tool existence
>
> Blueprint format inspector 不应因为：
>
> ```yaml
> builtinToolDeny:
>   - pwsh
> ```
>
> 在非 Windows 或某个当前 preset 不含 pwsh 时，直接把文件判为格式非法。
>
> 理由：
>
> ```text
> builtin tool availability
> =
> runtime composition fact
> ```
>
> 而不是：
>
> ```text
> static YAML identity fact
> ```
>
> 因此：
>
> ```text
> draft/save format check
> != runtime capability compatibility proof
> ```
>
> runtime setup 若请求 deny 一个无法执行 restriction 的 tool：
>
> ```text
> MUST fail closed
> ```
>
> 不能静默过滤。
>
> ---
>
> ## 7.3 frozen revision
>
> Blueprint repair 后：
>
> ```text
> existing Team cold resume
> ```
>
> 必须从 frozen registry source 恢复同一：
>
> ```text
> builtinToolDeny
> permissions
> teamTools
> skills
> mcp
> ```
>
> 修改 mutable source 不得改变已 frozen Team 的 restriction。
>
> ---
>
> # 8. I2-P0 — Baseline / Reproduction Gate
>
> **这一阶段必须先做；未完成前不修改产品代码。**
>
> ## 8.1 branch
>
> 建议：
>
> ```text
> fix/alpha2-issue2-permission
> ```
>
> base：
>
> ```text
> 6a2f3e1e906479ce8d0b07f9bcc6fef4e737f925
> ```
>
> ---
>
> ## 8.2 build pin
>
> 从该 branch source：
>
> ```text
> clean build
> committed artifact check
> install to isolated test profile
> ```
>
> 记录：
>
> ```text
> source HEAD
> package version
> runtime dist sha256
> installed dist sha256
> ```
>
> 硬条件：
>
> ```text
> installed dist hash == just-built artifact hash
> ```
>
> 否则停止测试。
>
> ---
>
> ## 8.3 B2 real Team reproduction
>
> 禁止 recording double。
>
> 使用：
>
> ```text
> real Cordis Context
> real AgentRegistry/AgentLoop
> real AgentPresets
> real ToolRuntime
> real dsh-scope
> real Team create/member setup path
> ```
>
> 最小 world：
>
> ```text
> 1 leader
> 1 expert
> 1 researcher
> no MCP unless required by host profile
> ```
>
> Blueprint：
>
> ```yaml
> expert:
>   capabilities:
>     builtinToolDeny: []
>
> researcher:
>   capabilities:
>     builtinToolDeny:
>       - pwsh
> ```
>
> shared preset：
>
> ```text
> standard
> ```
>
> Windows：
>
> ```text
> shipped standard tool-pwsh active
> ```
>
> ---
>
> ## 8.4 Phase-C evidence
>
> 在：
>
> ```text
> preset mount/skip decision 后
> builtin deny 前
> ```
>
> 采集：
>
> ```json
> {
>   "sessionId": "...",
>   "instanceId": "...",
>   "templateId": "researcher",
>   "bindPath": "fresh-member",
>   "requestedPresetId": "standard",
>   "composedPreset": "standard",
>   "visibleToolsBeforeRestrict": ["...", "pwsh"],
>   "denyRequested": ["pwsh"]
> }
> ```
>
> 若 diagnostic test 能安全读取 scope internals，再补：
>
> ```text
> agentScope
> parentScope
> standingScope
> parentEqualsStanding
> restrictableNames
> ```
>
> 这些 scope internals 只用于 test/evidence，不为此新增 production API。
>
> ---
>
> # 9. I2-P0 裁决树
>
> ## Case GREEN — 当前 alpha.2 rebuilt source 不复现
>
> 如果：
>
> ```text
> expert pwsh visible
> researcher pwsh hidden
> direct researcher pwsh rejected
> sibling unaffected
> ```
>
> 则结论：
>
> ```text
> 原 production 故障 = old/uncommitted artifact drift
> + missing real-seam regression
> ```
>
> 此时：
>
> ```text
> DO NOT modify production restriction semantics.
> ```
>
> 本 PR 只做：
>
> 1. 将 B2 real-seam regression 永久加入 repo；
> 2. 将 artifact hash/pin 检查加入 live verification/evidence；
> 3. 加 capability-vs-permission precedence tests；
> 4. 重跑 hardening after rebase；
> 5. 生成 closure report。
>
> ---
>
> ## Case RED-D1 — mount/composition 未生效
>
> 若：
>
> ```text
> composedPreset == undefined
> ```
>
> 或真实 member 没有加入预期 preset：
>
> 只修：
>
> ```text
> Team AgentSetup -> public AgentPresets.mount
> ```
>
> 的 plugin integration。
>
> 不改 upstream。
>
> ---
>
> ## Case RED-D2 — agent ancestry/rebind 失配
>
> 若：
>
> ```text
> composedPreset != undefined
> 但 Team-created member 的实际 scope ancestry 与 upstream control 不同
> ```
>
> 必须找到：
>
> ```text
> 哪一步在 mount 后 rebind / replace / recompose scope
> ```
>
> 然后在插件 ownership 内修复。
>
> 修复原则：
>
> ```text
> one effective preset composition
> before builtin deny
> ```
>
> 不引入 per-member preset selector。
>
> ---
>
> ## Case RED-D3 — 实际 preset 不含目标 tool
>
> 若：
>
> ```text
> standard 未实际提供 pwsh
> ```
>
> 则不是 restriction implementation bug。
>
> 必须先解释：
>
> ```text
> preset resolution
> platform gate
> preset generation
> user shadowing
> ```
>
> 禁止为了让测试过而静默忽略 deny。
>
> ---
>
> ## Case RED-D4 — visible 但 restrictable 异常
>
> 如果 Team shape 下：
>
> ```text
> pwsh visible
> ```
>
> 但真实：
>
> ```text
> tools.restrict({deny:['pwsh']})
> ```
>
> 仍拒绝，
>
> 且 upstream-only control 同 checkout 继续 PASS：
>
> 先证明：
>
> ```text
> Team plugin 传给 schemas/dispatch/restrict 的 agent scope identity 是否一致
> ```
>
> 默认仍优先修 plugin composition。
>
> 只有证据证明：
>
> ```text
> same exact scope chain
> same exact public calls
> upstream contract differs only because Team agent shape
> ```
>
> 才允许产生：
>
> ```text
> CORE_SEAM_BLOCKER
> ```
>
> 并单独向用户报告。
>
> 不得直接 patch `deepseek-harness`。
>
> ---
>
> # 10. I2-P1 — 永久 real-seam Regression
>
> 无论 P0 最终 GREEN 还是 RED，本阶段都必须实施。
>
> ## 10.1 测试必须穿过 Team glue
>
> 新测试必须真正经过：
>
> ```text
> createAgentBindings()
> Agent setup
> AgentPresets.mount()
> ToolRuntime
> applyBuiltInToolDeny()
> ```
>
> 不能只直接单测：
>
> ```text
> applyBuiltInToolDeny(fakeCtx)
> ```
>
> ---
>
> ## 10.2 Cross-platform fixture leg
>
> 为避免 CI 必须是 Windows，可增加 fixture preset：
>
> ```text
> preset contributes "fixture-shell"
> ```
>
> 两个 Team member：
>
> ```text
> expert deny=[]
> researcher deny=[fixture-shell]
> ```
>
> 断言：
>
> ```text
> expert sees fixture-shell
> researcher does not
> ```
>
> 并验证 direct dispatch。
>
> ---
>
> ## 10.3 Windows live leg
>
> 真实 Windows host 必须使用：
>
> ```text
> standard preset
> real pwsh
> ```
>
> 断言：
>
> ```text
> expert:
>   pwsh visible
>   safe command executes
>
> researcher:
>   pwsh absent
>   direct pwsh dispatch fails
> ```
>
> 建议 safe command：
>
> ```powershell
> Write-Output ISSUE2-EXPERT-OK
> ```
>
> 不使用有副作用命令。
>
> ---
>
> # 11. I2-P2 — builtin deny Adapter 契约
>
> 当前正确语义必须保留：
>
> ```text
> [] -> zero restrict call
> duplicates -> deduplicate preserving order
> restrict returns exact disposer
> disposer idempotent
> ```
>
> 新增/固定：
>
> ```text
> restriction cannot be applied
> -> setup fail closed
> ```
>
> 禁止：
>
> ```text
> configured deny ∩ currently restrictable names
> -> silently continue
> ```
>
> ---
>
> ## 11.1 可选 typed diagnostic
>
> 若 P0 仍 RED，建议把 raw upstream error 包装为一个稳定插件错误：
>
> ```text
> builtin-tool-restriction-unavailable
> ```
>
> details 至少：
>
> ```text
> sessionId
> instanceId
> templateId
> bindPath
> requestedPresetId
> composedPreset
> deniedNames
> cause
> ```
>
> 注意：
>
> ```text
> typed diagnostic != fallback
> ```
>
> 仍必须 fail closed。
>
> 如果当前 source 已 GREEN，仅因旧 artifact drift 导致事故：
>
> ```text
> typed error 为 SHOULD，不是 MUST
> ```
>
> 不为了“有代码变更”强行加入。
>
> ---
>
> # 12. I2-P3 — already-joined / mount decision 契约
>
> 当前 alpha.2 有：
>
> ```text
> composedPreset(agentCtx) != undefined
> -> skip second mount
> ```
>
> 本轮必须专门测试。
>
> ## 12.1 Root already joined
>
> 场景：
>
> ```text
> host root session 已由 web/session composition 加入 standard
> Team row adopts root
> ```
>
> 期望：
>
> ```text
> skip second mount
> builtinToolDeny still applies to inherited preset tools
> ```
>
> ---
>
> ## 12.2 Member unjoined
>
> 普通 Team-created member：
>
> ```text
> composedPreset initially undefined
> -> Team setup mount memberPresetId/default
> -> deny applies
> ```
>
> ---
>
> ## 12.3 Member already joined
>
> 若真实运行中存在该形状：
>
> ```text
> composedPreset already set
> ```
>
> 必须证明：
>
> ```text
> the joined composition is exactly the tool surface being restricted
> ```
>
> 若 requested `memberPresetId` 与 composed preset 不一致：
>
> 本轮不要偷偷 `recompose`。
>
> 先形成 deviation：
>
> ```text
> expected preset
> actual preset
> owning service
> blank/nonblank status
> ```
>
> 因为：
>
> ```text
> preset selection policy
> ```
>
> 不是 `builtinToolDeny` 本身。
>
> ---
>
> # 13. I2-P4 — 与 alpha.2 Parameter Permission 的优先级
>
> 必须新增集成测试。
>
> ## P4-A — hidden read + static allow
>
> Template：
>
> ```yaml
> builtinToolDeny:
>   - read
>
> permissions:
>   default: deny
>   allow:
>     - tool: read
>       resource:
>         kind: any
> ```
>
> 结果：
>
> ```text
> read absent from tool surface
> direct dispatch rejected before successful execution
> zero ControlRequest
> zero ControlDecision
> zero ControlConsumption
> zero authorization marker
> ```
>
> ---
>
> ## P4-B — hidden write + ask
>
> ```yaml
> builtinToolDeny:
>   - write
>
> permissions:
>   default: deny
>   ask:
>     - tool: write
>       resource:
>         kind: any
> ```
>
> 结果：
>
> ```text
> write absent
> no ask request
> no file effect
> ```
>
> ---
>
> ## P4-C — visible read
>
> ```text
> builtinToolDeny does not include read
> permissions allow read
> ```
>
> alpha.2 normal pipeline必须保持：
>
> ```text
> canonicalize
> -> resolve allow
> -> mark authorized
> -> monotonic end-cap admits
> -> body executes once
> ```
>
> ---
>
> ## P4-D — visible ask
>
> alpha.2 ask/allow-once 行为不变：
>
> ```text
> request
> -> decision allow
> -> exact guardOperation consumption
> -> authorization marker
> -> body once
> ```
>
> ---
>
> # 14. I2-P5 — Lifecycle
>
> 至少覆盖：
>
> ```text
> fresh root
> fresh member
> cold root
> cold member
> dispose
> ```
>
> 对每个 selective template：
>
> ```text
> preset composition first
> builtin restriction active
> permission surface afterwards
> ```
>
> cold resume：
>
> ```text
> restriction rebuilt
> no stale disposer/state
> same frozen Blueprint capability
> ```
>
> dispose：
>
> ```text
> restriction disposer exactly once
> permission listener/guard disposers all drain
> sibling unaffected
> ```
>
> ---
>
> # 15. I2-P6 — Artifact / install Hygiene
>
> 由于原故障环境中：
>
> ```text
> installed artifact != any committed dist
> ```
>
> 本轮必须把 live verification 的 artifact identity 作为 Gate。
>
> 每次 real-host smoke 前：
>
> ```text
> build source
> check committed/generated artifacts
> install exact built package
> hash installed key files
> compare to build output
> ```
>
> 至少 pin：
>
> ```text
> packages/runtime/dist/.../agent-bindings.mjs
> packages/tools/dist/.../builtin-deny.js
> package.json version
> Git HEAD
> ```
>
> 不需要开发新的 package manager。
>
> 只要求测试 evidence 不再出现“跑的是哪个 artifact 不知道”的状态。
>
> ---
>
> # 16. I2-P7 — 与 hardening follow-up 的 rebase integration
>
> Hardening PR merge 后：
>
> ```text
> git fetch
> git rebase origin/master
> ```
>
> 预期最重要冲突：
>
> ```text
> packages/runtime/src/plugin/live/agent-bindings.mjs
> generated runtime dist
> testkit pin
> ```
>
> ---
>
> ## 16.1 agent-bindings 三方人工检查
>
> 必须同时保留：
>
> ### hardening
>
> ```text
> exact rules fresh per-decision canonicalization
> Bash complete effect fingerprint/workdir authority
> H1 monotonic end-cap
> listener+guard lifecycle
> ```
>
> ### Issue #2
>
> ```text
> verified preset mount/skip semantics
> builtinToolDeny real restriction
> fail-closed behavior
> ```
>
> 此时 Blueprint branch 尚未 merge，因此不要提前拷贝 BP-F 实现。
>
> ---
>
> ## 16.2 hardening replay
>
> rebase 后必须重跑：
>
> ```text
> a2 canonical operation
> a3 permission resolver
> a4 exact control scope
> a5 pre-execute
> a6 production wiring
> h1a end-cap adversarial
> h3 hostile seam
> H4 exact-rule retarget tests
> H5 Bash effect fingerprint tests
> ```
>
> 目标：
>
> ```text
> Issue2 capability fix
> MUST NOT change
> permission verdict/fingerprint/end-cap semantics
> ```
>
> ---
>
> # 17. I2-P8 — Issue2 Permission Live Smoke
>
> 在 merge 前做一次真实 Host smoke。
>
> world：
>
> ```text
> Leader
> Expert
> Researcher
> ```
>
> Blueprint：
>
> ```text
> Expert:
>   deny []
>
> Researcher:
>   deny [pwsh]
> ```
>
> 必须记录：
>
> ```text
> composed preset
> visible tool names
> expert safe pwsh execution
> researcher direct pwsh rejection
> sibling isolation
> fresh
> cold resume
> ```
>
> 再加入一个 parameter-permission 组合 leg：
>
> ```text
> Researcher deny [write]
> permissions ask write:any
> ```
>
> 验证：
>
> ```text
> write hidden
> zero approval request
> ```
>
> ---
>
> # 18. Issue #2 Permission PR 的提交拆分
>
> 推荐：
>
> ## I2-A — characterization / current-source B2
>
> 只：
>
> ```text
> artifact pin
> real seam reproduction
> Phase C evidence
> RED/GREEN verdict
> ```
>
> 不改产品。
>
> ---
>
> ## I2-B — permanent real-seam regression
>
> 加：
>
> ```text
> Team-created agent + real AgentPresets + real ToolRuntime
> ```
>
> 的测试。
>
> 如果当前 source 本来 GREEN：
>
> ```text
> 这是主要产品仓库变更。
> ```
>
> ---
>
> ## I2-C — minimal product fix（CONDITIONAL）
>
> **只有 I2-A 在 rebuilt current source 上真实 RED 才存在这个 commit。**
>
> 只修证据选中的：
>
> ```text
> D1 / D2 / D4 plugin-side failure
> ```
>
> 不扩大。
>
> ---
>
> ## I2-D — capability × parameter-permission precedence
>
> 加：
>
> ```text
> hidden tool cannot be reauthorized
> zero Control plane side effect
> ```
>
> ---
>
> ## I2-E — hardening rebase + live closure
>
> Hardening merged 后：
>
> ```text
> rebase
> conflict resolution
> hardening replay
> live smoke
> cold resume
> artifact pin
> closure report
> ```
>
> ---
>
> # 19. Blueprint branch handoff
>
> Issue2 permission PR merge 后，Blueprint PR 必须：
>
> ```text
> rebase origin/master
> ```
>
> Blueprint final integration 不仅要保留原计划的：
>
> ```text
> H4/H5
> H1/H3
> ```
>
> 还必须保留本 PR 的：
>
> ```text
> Issue2 preset/builtin restriction hunk
> real-seam regression
> capability > parameter-permission precedence
> ```
>
> ---
>
> # 20. Blueprint PR 需要新增的组合态 Gate
>
> 本权限计划不修改 Blueprint PR 产品代码，但要求最终 Blueprint integration 增加以下验收。
>
> ## BPI2-1 — dual Team builtin deny authority
>
> ```text
> Team A -> frozen Blueprint A
>   expert deny=[]
>
> Team B -> frozen Blueprint B
>   researcher deny=[pwsh]
> ```
>
> 验证：
>
> ```text
> Team A pwsh visible
> Team B pwsh hidden
> no cross-Team authority
> cold resume unchanged
> ```
>
> ---
>
> ## BPI2-2 — mutable source cannot mutate frozen restriction
>
> ```text
> Team B created under rev 1 deny=[pwsh]
> rev 1 frozen
>
> user edits source file illegally / replaces mutable disk text
> ```
>
> 现有 Team B：
>
> ```text
> still deny=[pwsh]
> ```
>
> 来自 registry frozen source。
>
> ---
>
> ## BPI2-3 — setup failure no longer degrades to 405
>
> 这是 Blueprint BP8 的 responsibility。
>
> 强制一个 runtime setup failure：
>
> ```text
> catalog.list
> -> still Remote 200
> ```
>
> 不再是 route-missing 405。
>
> ---
>
> ## BPI2-4 — partial-create recovery
>
> Issue #2-B 必须在 Blueprint/host lifecycle 分支闭合。
>
> 最小场景：
>
> ```text
> Team identity committed
> root Session artifact absent
> ```
>
> `create-or-open` 必须：
>
> ```text
> recover incomplete create
> ```
>
> 或返回：
>
> ```text
> actionable typed terminal error
> ```
>
> 但不得：
>
> ```text
> silently choose resume forever
> ```
>
> **strict explicit resume 仍 fail closed。**
>
> ---
>
> # 21. Issue #2 关闭条件
>
> 权限 PR merge 后：
>
> ```text
> Issue #2-A may be marked fixed/pending integration
> ```
>
> 但 **Issue #2 不得关闭**。
>
> 只有 Blueprint PR 合入后同时满足：
>
> ```text
> A. real builtin deny works
> B. partial-create restart safe
> C. boot failure no longer appears as missing-route 405
> ```
>
> 才关闭 Issue #2。
>
> ---
>
> # 22. 回归门禁
>
> ## 22.1 Permission / capability focused
>
> 必跑：
>
> ```text
> builtin-deny unit
> Team real-seam builtin deny
> sibling isolation
> already-joined root
> fresh member
> cold member
> capability > operation permission
> dispose
> ```
>
> ---
>
> ## 22.2 Alpha.1 regressions
>
> ```text
> teamTools per template
> skills per template
> MCP per template
> legacy Blueprint
> builtin deny empty
> ```
>
> ---
>
> ## 22.3 Alpha.2 regressions
>
> ```text
> a1 permission schema
> a2 canonical operation
> a3 permission resolver
> a4 control exact scope
> a5 pre-execute
> a6 production wiring
> h1a monotonic end-cap
> h3 hostile
> H4 exact-rule fresh identity
> H5 Bash effect
> ```
>
> ---
>
> ## 22.4 Full gates
>
> ```text
> runtime full suite
> domain full suite
> testkit
> typecheck
> build
> build:composition
> check-artifacts-committed
> references/deepseek-harness-test-use porcelain clean
> ```
>
> 要求：
>
> ```text
> NO new deterministic regression
> CORE PATCH BUDGET = 0
> ```
>
> ---
>
> # 23. Generated Artifacts / p4t6 / Bookkeeping
>
> ## 23.1 dist
>
> 三个 branch 都可能产生：
>
> ```text
> packages/runtime/dist/**
> packages/tools/dist/**
> ```
>
> 原则：
>
> ```text
> NEVER semantically merge generated dist.
> ```
>
> 在每次 rebase 后：
>
> ```text
> regenerate from merged source
> check artifacts
> commit regenerated truth
> ```
>
> ---
>
> ## 23.2 p4t6
>
> 如果本 PR 增加新 scannable test/source：
>
> ```text
> local branch temporary pin update allowed
> ```
>
> hardening merge 后本 PR rebase：
>
> ```text
> rerun scanner
> use scanner truth
> ```
>
> Blueprint PR 最终 rebase 后：
>
> ```text
> rerun scanner again
> final truth belongs to merged tree
> ```
>
> 禁止手算。
>
> ---
>
> ## 23.3 graph/router logs
>
> 并行开发期间：
>
> ```text
> dev/agent-workflow/graph.yaml
> SESSION_ROUTER_LOG.md
> ```
>
> 不作为 feature commit 热点。
>
> Issue2 权限 PR 可以保存自己的：
>
> ```text
> evidence/alpha2-issue2-permission/**
> ```
>
> 最终共享 bookkeeping 尽量延后到 Blueprint final integration 或独立 closure commit。
>
> ---
>
> # 24. Evidence 要求
>
> 建议：
>
> ```text
> dev/agent-workflow/evidence/alpha2-issue2-permission/
>   p0-reproduction/
>     environment.md
>     artifact-hashes.txt
>     upstream-control.txt
>     team-phase-c.json
>     verdict.md
>
>   p1-real-seam/
>     focused-console.txt
>     fixture-topology.json
>
>   p4-precedence/
>     matrix.md
>     control-ledger-deltas.json
>
>   p7-post-hardening/
>     rebase-notes.md
>     hardening-replay.txt
>
>   p8-live/
>     fresh.json
>     cold.json
>     installed-artifact-hashes.txt
>
>   closure-report.md
> ```
>
> ---
>
> # 25. Closure Report 模板
>
> ```markdown
> # Alpha.2 Issue #2 Permission Closure
>
> ## 1. Baseline
> - common base:
> - final branch tip:
> - hardening merged base:
> - upstream DSH pin:
>
> ## 2. Current-source reproduction
> - rebuilt artifact hash:
> - installed artifact hash:
> - B2 result: RED/GREEN
>
> ## 3. Root cause
> - artifact drift / D1 / D2 / D4:
> - exact evidence:
>
> ## 4. Production change
> - none / exact files:
> - why minimal:
>
> ## 5. Real-seam regression
> - fixture:
> - Windows pwsh:
> - sibling:
>
> ## 6. Capability precedence
> - hidden tool + allow:
> - hidden tool + ask:
> - control ledger delta:
>
> ## 7. Lifecycle
> - fresh root:
> - fresh member:
> - cold root:
> - cold member:
> - dispose:
>
> ## 8. Hardening replay
> - H1/H3:
> - H4:
> - H5:
> - A2/A3/A4/A5/A6:
>
> ## 9. Artifact identity
> - build:
> - install:
> - hashes:
>
> ## 10. Gates
> - runtime:
> - domain:
> - testkit:
> - typecheck:
> - build:
> - artifacts:
> - core patch:
>
> ## 11. Blueprint handoff
> - BPI2-1:
> - BPI2-2:
> - BPI2-3:
> - BPI2-4:
>
> ## 12. Issue verdict
> - Issue #2-A fixed:
> - Issue #2 whole issue closable now: NO
> - pending Blueprint lifecycle integration:
> ```
>
> ---
>
> # 26. Definition of Done — 本权限 PR
>
> 只有全部满足才能 merge：
>
> - [ ] 测试 artifact 与当前 source HEAD 可精确对应
> - [ ] 在 6a2f rebuilt alpha.2 上完成 B2 current-source reproduction
> - [ ] Team-created Agent real-seam test 不再使用 recording double
> - [ ] Expert `deny=[]` 时 preset tool 可见
> - [ ] Researcher `deny=[fixture-shell]` 时 tool 从 schema/dispatch 消失
> - [ ] Windows live standard `pwsh` 正向验证完成
> - [ ] direct denied-tool invocation 不执行
> - [ ] sibling Agent 不受 restriction 影响
> - [ ] unknown/unrestrictable configured deny 不被静默过滤
> - [ ] capability-level deny 不可被 alpha.2 `allow` 重新授权
> - [ ] capability-level deny 不触发 alpha.2 `ask` ControlRequest
> - [ ] permissions absent 的 alpha.1 path 不回归
> - [ ] fresh/cold/dispose 生命周期通过
> - [ ] 如 current source GREEN：无 speculative production fix
> - [ ] 如 current source RED：根因已由真实 Phase-C evidence 选定，修复仅限该层
> - [ ] hardening follow-up merge 后已 rebase
> - [ ] H1/H3/H4/H5 + A2/A3/A4/A5/A6 replay GREEN
> - [ ] generated artifacts 由 post-rebase source 重新生成
> - [ ] p4t6 pin 来自 scanner 真值
> - [ ] full suite 无新增 deterministic regression
> - [ ] `CORE PATCH BUDGET = 0`
> - [ ] 未修改 Blueprint/host lifecycle ownership 文件
> - [ ] 未加入 alpha.3 dynamic grants / alpha.4 hard governance
> - [ ] closure report 明确：Issue #2 whole issue 尚待 Blueprint integration
>
> ---
>
> # 27. 本轮明确不做
>
> ```text
> per-member preset selector
> dynamic built-in tool grants
> built-in allowlist redesign
> parameter policy for pwsh commands
> shell AST parsing
> durable grants
> grant_instance
> teamHardDeny
> Human hard override
> Permission Administration UI
> Blueprint schema redesign
> Blueprint registry implementation
> create-or-open partial-create recovery
> Remote readiness implementation
> DSH core patch
> ```
>
> ---
>
> # 28. 给本地 Agent 的直接执行顺序
>
> ```text
> 1. 从 6a2f3e1e 创建 fix/alpha2-issue2-permission worktree；
> 2. 记录 source/build/install artifact identity；
> 3. 在当前 alpha.2 rebuilt artifact 上做真实 B2 reproduction；
> 4. 保存 Phase-C evidence；
> 5. 若 GREEN：
>      不修改 restriction production semantics；
>      直接进入 permanent real-seam regression；
>    若 RED：
>      按 D1/D2/D3/D4 裁决唯一失败层；
>      写 RED test；
>      做最小 plugin-side fix；
> 6. 固化 cross-platform real preset/tool regression；
> 7. 固化 Windows standard/pwsh live probe；
> 8. 加 capability > parameter-permission precedence tests；
> 9. 跑 fresh/cold/dispose；
> 10. 开发期间不 cherry-pick hardening/Blueprint；
> 11. 等 hardening follow-up PR merge；
> 12. rebase 本分支到新 master；
> 13. 人工检查 agent-bindings 中：
>       H4/H5/H1 permission hunk
>       Issue2 preset/builtin-deny hunk
>     均完整；
> 14. 从 merged source 重建 dist；
> 15. scanner 重算 p4t6；
> 16. 重跑 hardening replay；
> 17. 跑 Issue2 live fresh + cold；
> 18. full parity/typecheck/build/artifact/core-patch gates；
> 19. 输出 closure-report；
> 20. merge Issue2 permission PR；
> 21. 通知 Blueprint branch rebase；
> 22. Blueprint final integration 必须执行 BPI2-1..BPI2-4；
> 23. 三个问题 A/B/C 全闭合后再关闭 GitHub Issue #2。
> ```
>
> ---
>
> # 29. Stop Rules
>
> 以下情况**不触发重新规划**：
>
> ```text
> test fixture 需要调整
> artifact pin 数变化
> Windows live kit 需要更新
> generated dist 冲突
> current alpha.2 已经 GREEN
> ```
>
> 直接按本计划对应分支处理。
>
> 只有以下情况停止并向用户报告：
>
> ```text
> 1. B2 证明 deepseek-harness public AgentPresets/tools contract 本身在同一 scope 下异常；
> 2. 修复必须 patch DSH core/private registry；
> 3. 需要改变 Blueprint frozen authority 才能修 restriction；
> 4. 需要改变 alpha.2 operation-permission precedence/end-cap；
> 5. 无法在 fail-closed 前提下表达 per-teammate builtin restriction。
> ```
>
> 不允许用：
>
> ```text
> “先过滤 unknown deny”
> “先给每个 member 一个不同 preset”
> “先把权限改成 guard-only”
> ```
>
> 作为绕过。
>
> ---
>
> # 30. 最终目标
>
> 本权限 PR 完成时，必须能够用一句话描述其能力：
>
> > **同一个 shared superset preset 可以被多个 teammate 共同使用，而每个 teammate 的 frozen Blueprint Template 可以独立、真实地减去指定 built-in tools；该 capability subtraction 在真实 ToolRuntime、fresh/cold lifecycle 和 alpha.2 parameter-permission/end-cap 组合下都不可被绕过。**
>
> Blueprint/host PR 随后负责保证：
>
> > **这份 template authority 能被可靠创建、冻结、恢复、诊断，并且 setup failure 不会再次把 Team 留在永久不可启动的 partial-create 状态。**
