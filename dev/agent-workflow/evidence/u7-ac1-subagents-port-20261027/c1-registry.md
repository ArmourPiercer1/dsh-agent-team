# U7 AC-1 registry C1 evidence

- Worktree proof: `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/u7-ac1`, branch `task/u7-ac1-subagents-port-20261027`, base `49cd02df5`.
- Public host path: `Context` + `@deepseek-ai/dsh-system-prompt` + `@deepseek-ai/dsh-tools` (`ToolRuntime`), then each definition via `ctx.tools.register(definition)` and `ctx.tools.execute(...)`; no validator reimplementation.
- Port/executor adaptation: family rows preserve native output faces; `send_message` and `interrupt_agent` project the public `agent_id` argument to the runtime port's `targetId`; list rows return native array/string values.
- RED (pre-fix boot-6 failure signatures): `missing required property "value.text"` for `subagent` / `subagent_fork`; list rows refused with their family errors `outside the native list_agents result schema` and `outside the native result schema` for `list_subagent_models`.
- GREEN: `u7-f-agent-control-native-output-schema-c1.test.ts` real ToolRuntime registry test registers all seven rows, executes each with a fake executor, validates rendered text; focused C1 suite result: 42 passed.
- Mutation target: restoring `definitions.map((def) => Object.freeze({ ...def, output: cap.presentationFace }))` is expected to reproduce the native-schema refusal; the source currently remains on native per-row faces and the manifest digest is synchronized.
