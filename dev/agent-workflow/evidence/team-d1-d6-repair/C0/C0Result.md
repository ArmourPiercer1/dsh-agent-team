# C0 — member setup / base-tool public seam characterization

## C0Result

- `public_composition_seam: yes`
- `exact_seam: `
  1. Upstream `AgentSetup` is the public create/resume composition callback. `CreateAgentOptions.setup` and `ResumeAgentOptions.setup` explicitly receive the unpublished scoped `agentCtx`; registrations made there are present before publication (`references/deepseek-harness-test-use/packages/core/agent/src/index.ts:56-62,108-125,140-148`).
  2. Ordinary DSH composition is exposed by `ApiSessionAgentController.composeAgent(presetId)`, whose returned setup installs model selection and calls `presets.mount(agentCtx, resolvedId)` (`references/deepseek-harness-test-use/packages/api/session-controller/src/agent.ts:374-387`). The same callback is passed to both create and resume (`:422-432`, `:476-485`).
  3. The preset service has a public `mount(agentCtx, id?)` entry that binds the agent scope to the standing preset composition (`references/deepseek-harness-test-use/packages/preset/agent-presets/src/index.ts:401-426`). It also exposes `composeFrom(agentCtx, parentCtx)` to join the exact standing composition already used by a parent (`:430-464`).
  4. Team child creation already supplies a public AgentSetup callback to `agents.create`/`agents.resume`, but the callback is Team-owned `agentSetup(...)` (`packages/runtime/src/plugin/live/agent-bindings.mjs:881-936`). Current `agentSetup` registers Team tools and persona, but does not invoke an ordinary setup or `agentPresets.mount` (`:543-590`).

- `minimal_change_files:`
  - `packages/runtime/src/plugin/live/agent-bindings.mjs` — compose the child callback with the public preset setup before Team-specific registration; the composition must be used for both fresh create and cold resume paths (`:909-915`, `:927-934`).
  - The Team host wiring/configuration that constructs `createAgentBindings` — provide the selected preset id (or a parent scoped context if using `composeFrom`) and the public `agentPresets` service. This file was not read because it is outside the C0 context pack; identify it in T1 rather than widening C0.

- `expected_member_tools: file/read and shell/exec tools supplied by the selected ordinary preset, plus the existing Team tools registered by `agentSetup` (`packages/runtime/src/plugin/live/agent-bindings.mjs:560-568`). Exact names depend on the mounted preset composition and must be verified by a real member tool-table/turn regression in T1.
- `blocker: none for the seam characterization. The public seam exists; current Team wiring does not compose it.`
- `recommendation: implement`

## Decision and limits

The strongest inheritance API is `agentPresets.composeFrom(childCtx, parentCtx)`, because it joins the parent's already-mounted standing generation and does not re-read the preset (`index.ts:430-439`). C0 did not find a public parent-context value exposed to `agentSetup`; therefore T1 must either pass an owning parent context through a Team-owned adapter or use the public `mount(childCtx, selectedPresetId)` with an explicitly resolved, durable preset id. It must not copy upstream preset internals or assume session-global tool registration. `agentCtx.tools.register()` is scoped to the individual Agent, so the current Team registration loop cannot produce ordinary file/shell tools by itself (`agent-bindings.mjs:560-568`; D1 diagnostic, `docs/local-issues/team-member-missing-base-tools.md:23-31`).

## Minimal reproduction / verification recipe for T1

1. Create a normal Agent using `composeAgent(selectedPreset).setup`; record its scoped tool names.
2. Create a Team member through `childFactory.createChildSession`; record its scoped tool names before any prompt.
3. Compose the member through the chosen public seam, retain Team registration, and assert the member tool table contains the preset's file/read and shell/exec capability plus Team tools.
4. Run a real member turn that reads a known file and executes a shell command; repeat for fresh-create and cold-resume. A model-generated answer without successful tool-call traces is not evidence.

No product code or upstream source was modified by C0. No runtime test was run because this task is evidence-only and the allowed context pack contains no dedicated test harness; T1 owns the real setup/tool regression.
