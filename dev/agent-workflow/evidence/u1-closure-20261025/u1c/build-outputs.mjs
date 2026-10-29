// U1-C output builder. READ-ONLY over sources; writes only into this evidence dir.
// Every claimed file:line is re-verified against the actual source text at build time.
import fs from 'node:fs'
import path from 'node:path'

const REPO = '/srv/workspace/dsh-plugins/dsh-agent-team'
const HOST = path.join(REPO, 'tests/deepseek-harness-test-use')
const TEAM = path.join(REPO, '.worktrees/u1-audit-master')
const SEED = path.join(REPO, 'dev/agent-workflow/evidence/s1-m0-closure-v3-seeds')
const OUT = path.join(REPO, 'dev/agent-workflow/evidence/u1-closure-20261025/u1c')

const problems = []
function assertAt(root, rel, line, token, label) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8')
  const lines = text.split('\n')
  const w = lines.slice(Math.max(0, line - 3), line + 2).join('\n')
  if (!w.includes(token)) problems.push(`ASSERT FAIL ${label}: ${rel}:${line} missing token ${JSON.stringify(token)}`)
}

// ---------- 1. host static tools (curated from scan; every line re-asserted) ----------
const H = (name, pkg, rel, line, token, gating, authority) => ({ name, package: pkg, file: rel, line, gating, authority, _token: token })
const hostTools = [
  H('plugin_manager', '@deepseek-ai/dsh-plugin-manager (tools entry)', 'packages/boot/plugin-manager/src/tools.ts', 19, "defineTool", 'mounted: bundle/base/cordis.patch.yml:16-17 (@deepseek-ai/dsh-plugin-manager/tools)', 'host-catalog'),
  H('run_code', '@deepseek-ai/dsh-tools (PTC transport)', 'packages/core/tools/src/ptc.ts', 335, 'defineTool', 'lazy ToolRuntime registration in PTC mode: packages/core/tools/src/index.ts:945 (createRunCodeTool); name const ptc.ts:30', 'host-catalog'),
  H('present', '@deepseek-ai/dsh-tool-present', 'packages/deliverables/tool-present/src/index.ts', 38, 'defineTool', 'mounted per web preset: presets/standard.patch.yml:142-143, presets/cordis.patch.yml:150-151', 'host-catalog'),
  H('spawn_teammate', '@deepseek-ai/dsh-experimental-tool-agent-team', 'packages/experimental/tool-agent-team/src/index.ts', 175, 'defineTool', 'opt-in experimental plugin; agent-scoped install (install() index.ts:164); NOT mounted in any shipped bundle (only test overlay apps/cli/tests/profiles/headless/team-snapshot.patch.yml:49-50)', 'host-catalog'),
  H('send_message', '@deepseek-ai/dsh-experimental-tool-agent-team', 'packages/experimental/tool-agent-team/src/index.ts', 215, 'defineTool', 'same opt-in experimental mount as spawn_teammate; collides by design with the default tool-subagent-control route when both mounted', 'host-catalog'),
  H('list_agents', '@deepseek-ai/dsh-experimental-tool-agent-team', 'packages/experimental/tool-agent-team/src/index.ts', 232, 'defineTool', 'same opt-in experimental mount as spawn_teammate', 'host-catalog'),
  H('wait_agent', '@deepseek-ai/dsh-experimental-tool-agent-team', 'packages/experimental/tool-agent-team/src/index.ts', 242, 'defineTool', 'same opt-in experimental mount as spawn_teammate; exclusive to this plugin (no other host registration)', 'host-catalog'),
  H('interrupt_agent', '@deepseek-ai/dsh-experimental-tool-agent-team', 'packages/experimental/tool-agent-team/src/index.ts', 277, 'defineTool', 'same opt-in experimental mount as spawn_teammate', 'host-catalog'),
  H('team_task_create', '@deepseek-ai/dsh-experimental-tool-agent-team', 'packages/experimental/tool-agent-team/src/index.ts', 289, 'defineTool', 'same opt-in experimental mount as spawn_teammate', 'host-catalog'),
  H('team_task_list', '@deepseek-ai/dsh-experimental-tool-agent-team', 'packages/experimental/tool-agent-team/src/index.ts', 313, 'defineTool', 'same opt-in experimental mount as spawn_teammate', 'host-catalog'),
  H('team_task_get', '@deepseek-ai/dsh-experimental-tool-agent-team', 'packages/experimental/tool-agent-team/src/index.ts', 345, 'defineTool', 'same opt-in experimental mount as spawn_teammate', 'host-catalog'),
  H('team_task_update', '@deepseek-ai/dsh-experimental-tool-agent-team', 'packages/experimental/tool-agent-team/src/index.ts', 360, 'defineTool', 'same opt-in experimental mount as spawn_teammate', 'host-catalog'),
  H('cordis_inspect_list', '@deepseek-ai/dsh-tool-cordis', 'packages/extensions/tool-cordis/src/index.ts', 22, 'defineTool', 'mounted in cordis preset only: presets/cordis.patch.yml:141-142 (host provider row: web-app/cordis.patch.yml:156-157)', 'host-catalog'),
  H('cordis_inspect_query', '@deepseek-ai/dsh-tool-cordis', 'packages/extensions/tool-cordis/src/index.ts', 41, 'defineTool', 'mounted in cordis preset only: presets/cordis.patch.yml:141-142', 'host-catalog'),
  H('read', '@deepseek-ai/dsh-tool-fs', 'packages/fs/tool-fs/src/read.ts', 77, 'defineTool', 'mounted: bundle/base/cordis.patch.yml:281-282', 'host-catalog'),
  H('write', '@deepseek-ai/dsh-tool-fs', 'packages/fs/tool-fs/src/write.ts', 72, 'defineTool', 'mounted: bundle/base/cordis.patch.yml:281-282', 'host-catalog'),
  H('edit', '@deepseek-ai/dsh-tool-fs', 'packages/fs/tool-fs/src/edit.ts', 84, 'defineTool', 'mounted: bundle/base/cordis.patch.yml:281-282', 'host-catalog'),
  H('read_image', '@deepseek-ai/dsh-tool-fs', 'packages/fs/tool-fs/src/read-image.ts', 209, 'defineTool', 'mounted: bundle/base/cordis.patch.yml:281-282; additionally only with ctx.attachments (docs/tool-catalog.md note)', 'host-catalog'),
  H('glob', '@deepseek-ai/dsh-tool-fs-search', 'packages/fs/tool-fs-search/src/glob.ts', 306, 'defineTool', 'mounted: bundle/base/cordis.patch.yml:284-285', 'host-catalog'),
  H('grep', '@deepseek-ai/dsh-tool-fs-search', 'packages/fs/tool-fs-search/src/grep.ts', 284, 'defineTool', 'mounted: bundle/base/cordis.patch.yml:284-285', 'host-catalog'),
  H('str_replace_editor', '@deepseek-ai/dsh-tool-str-replace-editor', 'packages/fs/tool-str-replace-editor/src/index.ts', 429, 'defineTool', 'NOT mounted in any shipped bundle/preset — opt-in package (grep: no dsh-tool-str-replace-editor row in packages/bundle)', 'host-catalog'),
  H('get_goal', '@deepseek-ai/dsh-tool-goal', 'packages/goal/tool-goal/src/index.ts', 195, 'defineTool', 'mounted: bundle/base/cordis.patch.yml:437-438', 'host-catalog'),
  H('create_goal', '@deepseek-ai/dsh-tool-goal', 'packages/goal/tool-goal/src/index.ts', 207, 'defineTool', 'mounted: bundle/base/cordis.patch.yml:437-438', 'host-catalog'),
  H('update_goal', '@deepseek-ai/dsh-tool-goal', 'packages/goal/tool-goal/src/index.ts', 234, 'defineTool', 'mounted: bundle/base/cordis.patch.yml:437-438', 'host-catalog'),
  H('ask_user_question', '@deepseek-ai/dsh-tool-ask-user', 'packages/interaction/tool-ask-user/src/index.ts', 38, 'defineTool', 'mounted per preset (standard:131-132, ptc:133-134, cordis:130-131); default config mode legacy (index.ts:24)', 'host-catalog'),
  H('ask_user_question', '@deepseek-ai/dsh-tool-ask-user (timed variant)', 'packages/interaction/tool-ask-user/src/timed.ts', 106, 'defineTool', 'same name; registered only with config mode: timed (index.ts:34-35)', 'host-catalog'),
  H('job_output', '@deepseek-ai/dsh-tool-jobs', 'packages/jobs/tool-jobs/src/index.ts', 310, 'defineTool', 'mounted: bundle/base/cordis.patch.yml:275-276', 'host-catalog'),
  H('job_list', '@deepseek-ai/dsh-tool-jobs', 'packages/jobs/tool-jobs/src/index.ts', 351, 'defineTool', 'mounted: bundle/base/cordis.patch.yml:275-276', 'host-catalog'),
  H('job_kill', '@deepseek-ai/dsh-tool-jobs', 'packages/jobs/tool-jobs/src/index.ts', 371, 'defineTool', 'mounted: bundle/base/cordis.patch.yml:275-276', 'host-catalog'),
  H('lsp', '@deepseek-ai/dsh-tool-lsp', 'packages/lsp/tool-lsp/src/index.ts', 109, 'defineTool', 'NOT mounted in any shipped bundle/preset — opt-in; runtime additionally requires a registered ctx.lsp provider (docs/tool-catalog.md note)', 'host-catalog'),
  H('list_mcp_resources', '@deepseek-ai/dsh-mcp-resources', 'packages/mcp/mcp-resources/src/tools.ts', 33, 'defineTool', 'mounted: bundle/base/cordis.patch.yml:492-493', 'host-catalog'),
  H('list_mcp_resource_templates', '@deepseek-ai/dsh-mcp-resources', 'packages/mcp/mcp-resources/src/tools.ts', 42, 'defineTool', 'mounted: bundle/base/cordis.patch.yml:492-493', 'host-catalog'),
  H('read_mcp_resource', '@deepseek-ai/dsh-mcp-resources', 'packages/mcp/mcp-resources/src/tools.ts', 51, 'defineTool', 'mounted: bundle/base/cordis.patch.yml:492-493', 'host-catalog'),
  H('exit_plan_mode', '@deepseek-ai/dsh-plan-mode', 'packages/plan/plan-mode/src/index.ts', 278, 'defineTool', 'mounted: bundle/base/cordis.patch.yml:322-323; execute refuses outside plan mode (docs/tool-catalog.md); name const index.ts:67', 'host-catalog'),
  H('schedule_create', '@deepseek-ai/dsh-schedule', 'packages/schedule/schedule/src/tools.ts', 416, 'defineTool', 'NOT mounted as tool row in shipped bundles (dsh-schedule type-only import apps/desktop-host/src/quit-inspection.ts:5); registered while Schedule service is loaded (docs/tool-catalog.md)', 'host-catalog'),
  H('schedule_list', '@deepseek-ai/dsh-schedule', 'packages/schedule/schedule/src/tools.ts', 451, 'defineTool', 'same gating as schedule_create', 'host-catalog'),
  H('schedule_delete', '@deepseek-ai/dsh-schedule', 'packages/schedule/schedule/src/tools.ts', 469, 'defineTool', 'same gating as schedule_create', 'host-catalog'),
  H('schedule_update', '@deepseek-ai/dsh-schedule', 'packages/schedule/schedule/src/tools.ts', 492, 'defineTool', 'same gating as schedule_create', 'host-catalog'),
  H('session_search', '@deepseek-ai/dsh-tool-session-query', 'packages/session-query/tool-session-query/src/index.ts', 65, 'defineTool', 'opt-in package: no dsh-tool-session-query row in packages/bundle; backend session-query-sqlite mounted base:149-150 (docs/tool-catalog.md: "The package is opt-in")', 'host-catalog'),
  H('session_event_search', '@deepseek-ai/dsh-tool-session-query', 'packages/session-query/tool-session-query/src/index.ts', 75, 'defineTool', 'same gating as session_search', 'host-catalog'),
  H('session_trace', '@deepseek-ai/dsh-tool-session-query', 'packages/session-query/tool-session-query/src/index.ts', 85, 'defineTool', 'same gating as session_search', 'host-catalog'),
  H('session_event_trace', '@deepseek-ai/dsh-tool-session-query', 'packages/session-query/tool-session-query/src/index.ts', 95, 'defineTool', 'same gating as session_search', 'host-catalog'),
  H('session_event_read', '@deepseek-ai/dsh-tool-session-query', 'packages/session-query/tool-session-query/src/index.ts', 108, 'defineTool', 'same gating as session_search', 'host-catalog'),
  H('bash', '@deepseek-ai/dsh-tool-bash', 'packages/shell/tool-bash/src/index.ts', 373, 'defineTool', 'mounted: bundle/base/cordis.patch.yml:267-268; jobs-registry presence selects variant (index.ts:542-552)', 'host-catalog'),
  H('bash', '@deepseek-ai/dsh-tool-bash-persistent', 'packages/shell/tool-bash-persistent/src/index.ts', 413, 'defineTool', 'same name; mounted only in minimal/sdk-minimal: presets/minimal.patch.yml:30-31, bundle/sdk-minimal/cordis.patch.yml:126-127', 'host-catalog-alias'),
  H('pwsh', '@deepseek-ai/dsh-tool-pwsh', 'packages/shell/tool-pwsh/src/index.ts', 383, 'defineTool', 'mounted: bundle/base/cordis.patch.yml:271-272', 'host-catalog'),
  H('pwsh', '@deepseek-ai/dsh-tool-pwsh-persistent', 'packages/shell/tool-pwsh-persistent/src/index.ts', 426, 'defineTool', 'same name; mounted only in minimal/sdk-minimal: presets/minimal.patch.yml:49-50, bundle/sdk-minimal/cordis.patch.yml:140-141', 'host-catalog-alias'),
  H('skill', '@deepseek-ai/dsh-tool-skill', 'packages/skill/tool-skill/src/index.ts', 81, 'defineTool', 'mounted: bundle/base/cordis.patch.yml:304-305', 'host-catalog'),
  H('load_workspace_dependencies', '@deepseek-ai/dsh-tool-workspace-dependencies', 'packages/skill/tool-workspace-dependencies/src/index.ts', 249, 'defineTool', 'mounted only in sdk-app bundle: bundle/sdk-app/cordis.patch.yml:30-31', 'host-catalog'),
  H('send_message', '@deepseek-ai/dsh-tool-subagent-control', 'packages/subagent/tool-subagent-control/src/index.ts', 28, 'defineTool', 'mounted: bundle/base/cordis.patch.yml:364-365 (the one global follow-up route)', 'host-catalog'),
  H('interrupt_agent', '@deepseek-ai/dsh-tool-subagent-control', 'packages/subagent/tool-subagent-control/src/index.ts', 74, 'defineTool', 'mounted: bundle/base/cordis.patch.yml:364-365', 'host-catalog'),
  H('list_agents', '@deepseek-ai/dsh-tool-subagent-control', 'packages/subagent/tool-subagent-control/src/list-agents.ts', 86, 'defineTool', 'mounted: bundle/base/cordis.patch.yml:367-368 (separate row)', 'host-catalog'),
  H('subagent', '@deepseek-ai/dsh-tool-subagent', 'packages/subagent/tool-subagent/src/index.ts', 379, 'defineTool', 'name from config toolName (index.ts:323; zod default index.ts:108); mounted base:370-374 toolName: subagent; registers only when its subagent provider route is live (index.ts:592)', 'host-catalog'),
  H('subagent_fork', '@deepseek-ai/dsh-tool-subagent (fork route)', 'packages/subagent/tool-subagent/src/index.ts', 379, 'defineTool', 'same factory; second bundle-composed instance base:383-387 toolName: subagent_fork (enabled)', 'host-catalog-shippedNames'),
  H('subagent_codex', '@deepseek-ai/dsh-tool-subagent (codex route)', 'packages/subagent/tool-subagent/src/index.ts', 379, 'defineTool', 'same factory; route instances standard.patch.yml:103-110 (disabled: true @105), ptc.patch.yml:103-108, cordis.patch.yml:104-107 — shipped default DISABLED', 'host-source-route (not in generated catalog harvest)'),
  H('subagent_claude_code', '@deepseek-ai/dsh-tool-subagent (claude-code route)', 'packages/subagent/tool-subagent/src/index.ts', 379, 'defineTool', 'same factory; route instances standard.patch.yml:111-117 (disabled: true @113), ptc/cordis same-block — shipped default DISABLED', 'host-source-route (not in generated catalog harvest)'),
  H('list_subagent_models', '@deepseek-ai/dsh-tool-subagent', 'packages/subagent/tool-subagent/src/list-models.ts', 87, 'defineTool', 'registered only when a model-selection policy is configured (index.ts:362); web-app mounts model-selection-settings: web-app/cordis.patch.yml:66-67', 'host-catalog'),
  H('terminal_open', '@deepseek-ai/dsh-tool-terminal', 'packages/terminal/tool-terminal/src/index.ts', 163, 'defineTool', 'opt-in package: no dsh-tool-terminal row in packages/bundle (docs/tool-catalog.md: "The six terminal tools are opt-in")', 'host-catalog'),
  H('terminal_send', '@deepseek-ai/dsh-tool-terminal', 'packages/terminal/tool-terminal/src/index.ts', 198, 'defineTool', 'same as terminal_open', 'host-catalog'),
  H('terminal_read', '@deepseek-ai/dsh-tool-terminal', 'packages/terminal/tool-terminal/src/index.ts', 301, 'defineTool', 'same as terminal_open', 'host-catalog'),
  H('terminal_signal', '@deepseek-ai/dsh-tool-terminal', 'packages/terminal/tool-terminal/src/index.ts', 334, 'defineTool', 'same as terminal_open', 'host-catalog'),
  H('terminal_close', '@deepseek-ai/dsh-tool-terminal', 'packages/terminal/tool-terminal/src/index.ts', 359, 'defineTool', 'same as terminal_open', 'host-catalog'),
  H('terminal_list', '@deepseek-ai/dsh-tool-terminal', 'packages/terminal/tool-terminal/src/index.ts', 390, 'defineTool', 'same as terminal_open', 'host-catalog'),
  H('todo_write', '@deepseek-ai/dsh-tool-todo', 'packages/todo/tool-todo/src/index.ts', 135, 'defineTool', 'mounted: bundle/base/cordis.patch.yml:430-431', 'host-catalog'),
  H('web_fetch', '@deepseek-ai/dsh-tool-web', 'packages/web/tool-web/src/fetch.ts', 456, 'defineTool', 'mounted: bundle/base/cordis.patch.yml:486-487', 'host-catalog'),
  H('web_search', '@deepseek-ai/dsh-tool-web', 'packages/web/tool-web/src/search.ts', 325, 'defineTool', 'mounted: bundle/base/cordis.patch.yml:486-487', 'host-catalog'),
  H('ralph', '@deepseek-ai/dsh-tool-ralph', 'packages/workflow/tool-ralph/src/index.ts', 410, 'defineTool', 'mounted but disabled: true by default: bundle/base/cordis.patch.yml:447-449; overlay restores (comment base:441-446)', 'host-catalog'),
  H('workflow', '@deepseek-ai/dsh-tool-workflow', 'packages/workflow/tool-workflow/src/index.ts', 328, 'defineTool', 'name from config toolName (zod default workflow at index.ts:60); mounted base:398-399', 'host-catalog'),
  H('stagehand_navigate', '@deepseek-ai/dsh-experimental-browser-use-stagehand-native', 'packages/experimental/browser-use-stagehand-native/src/index.ts', 179, 'createMcpToolDefinition', 'opt-in experimental: no row in packages/bundle; name built as `stagehand_${method}` at index.ts:178 over the fixed BrowserMethod set', 'host-catalog'),
  H('stagehand_tabs', '@deepseek-ai/dsh-experimental-browser-use-stagehand-native', 'packages/experimental/browser-use-stagehand-native/src/index.ts', 179, 'createMcpToolDefinition', 'same as stagehand_navigate', 'host-catalog'),
  H('stagehand_screenshot', '@deepseek-ai/dsh-experimental-browser-use-stagehand-native', 'packages/experimental/browser-use-stagehand-native/src/index.ts', 179, 'createMcpToolDefinition', 'same as stagehand_navigate', 'host-catalog'),
  H('stagehand_act', '@deepseek-ai/dsh-experimental-browser-use-stagehand-native', 'packages/experimental/browser-use-stagehand-native/src/index.ts', 179, 'createMcpToolDefinition', 'same as stagehand_navigate', 'host-catalog'),
  H('stagehand_observe', '@deepseek-ai/dsh-experimental-browser-use-stagehand-native', 'packages/experimental/browser-use-stagehand-native/src/index.ts', 179, 'createMcpToolDefinition', 'same as stagehand_navigate', 'host-catalog'),
  H('stagehand_extract', '@deepseek-ai/dsh-experimental-browser-use-stagehand-native', 'packages/experimental/browser-use-stagehand-native/src/index.ts', 179, 'createMcpToolDefinition', 'same as stagehand_navigate', 'host-catalog'),
  H('structured_output', '@deepseek-ai/dsh-subagent-in-process-driver (internal)', 'packages/subagent/subagent-in-process-driver/src/structured.ts', 74, 'childCtx.tools.register', 'internal child-session tool for structured-output capture (name const STRUCTURED_OUTPUT_TOOL structured.ts:19); only in child contexts with a structured schema; NOT in docs/tool-catalog.md (not shipped model-facing surface)', 'host-source-only (internal)'),
]
for (const t of hostTools) assertAt(HOST, t.file, t.line, t._token, t.name)
// the 178/179 stagehand lines and structured/mcp ones need token-specific checks
assertAt(HOST, 'packages/experimental/browser-use-stagehand-native/src/index.ts', 179, 'createMcpToolDefinition', 'stagehand')
assertAt(HOST, 'packages/experimental/browser-use-stagehand-native/src/index.ts', 178, 'stagehand_${method}', 'stagehand-name-build')
assertAt(HOST, 'packages/subagent/subagent-in-process-driver/src/structured.ts', 74, 'childCtx.tools.register', 'structured_output')
assertAt(HOST, 'packages/subagent/subagent-in-process-driver/src/structured.ts', 19, "STRUCTURED_OUTPUT_TOOL = 'structured_output'", 'structured-const')
assertAt(HOST, 'packages/core/tools/src/index.ts', 945, 'createRunCodeTool', 'run_code-runtime')
assertAt(HOST, 'packages/core/tools/src/ptc.ts', 30, "RUN_CODE_NAME = 'run_code'", 'run_code-const')
assertAt(HOST, 'packages/plan/plan-mode/src/index.ts', 67, "EXIT_PLAN_MODE = 'exit_plan_mode'", 'exit-const')
assertAt(HOST, 'packages/subagent/tool-subagent/src/index.ts', 323, "config.toolName ?? 'subagent'", 'subagent-toolname')
assertAt(HOST, 'packages/subagent/tool-subagent/src/index.ts', 108, "toolName: z.string().default('subagent')", 'subagent-default')
assertAt(HOST, 'packages/subagent/tool-subagent/src/index.ts', 362, 'registerListSubagentModels', 'list-subagent-models-gate')
assertAt(HOST, 'packages/workflow/tool-workflow/src/index.ts', 60, "toolName: z.string().default('workflow')", 'workflow-default')
assertAt(HOST, 'packages/bundle/base/cordis.patch.yml', 447, 'dsh-tool-ralph', 'ralph-mount')
assertAt(HOST, 'packages/bundle/base/cordis.patch.yml', 449, 'disabled: true', 'ralph-disabled')
assertAt(HOST, 'packages/bundle/web-app/presets/standard.patch.yml', 105, 'disabled: true', 'codex-disabled')
assertAt(HOST, 'packages/bundle/web-app/presets/standard.patch.yml', 113, 'disabled: true', 'claude-disabled')
assertAt(HOST, 'packages/bundle/base/cordis.patch.yml', 374, 'toolName: subagent', 'subagent-mount')
assertAt(HOST, 'packages/bundle/base/cordis.patch.yml', 387, 'toolName: subagent_fork', 'fork-mount')

const hostDynamicSources = [
  { class: 'mcp__<server>__<tool>', rule: 'publicToolName = `mcp__${serverName}__${rawName}` (normalized/hashed on overflow)', package: '@deepseek-ai/dsh-mcp-client', file: 'packages/mcp/mcp-client/src/tools.ts', line: 81, register: 'packages/mcp/mcp-client/src/tools.ts:150 (syncTools per connected server)', note: 'per-MCP-server dynamic generation — recorded as dynamic source class, individual names NOT enumerated' },
  { class: 'cua_driver_native__<tool>', rule: '`cua_driver_native__${tool.name}` from driver tool list', package: '@deepseek-ai/dsh-experimental-computer-use-cua-driver-native', file: 'packages/experimental/computer-use-cua-driver-native/src/index.ts', line: 97, register: 'packages/experimental/computer-use-cua-driver-native/src/index.ts:117', note: 'experimental driver-list dynamic; not mounted in shipped bundles' },
  { class: 'client-plugin dynamic tools (any name via harness.defineTool)', rule: 'assertDynamicTool gate; registration passthrough', package: '@deepseek-ai/dsh-cordis-host-runner', file: 'packages/extensions/cordis-host-runner/src/guard.ts', line: 495, register: 'packages/extensions/cordis-host-runner/src/guard.ts:628', note: 'client plugins register model tools at runtime (e.g. browser_*); enumeration at build time is impossible' },
]
assertAt(HOST, 'packages/mcp/mcp-client/src/tools.ts', 81, 'publicToolName', 'mcp-rule')
assertAt(HOST, 'packages/mcp/mcp-client/src/tools.ts', 150, 'ctx.tools.register(definition)', 'mcp-register')
assertAt(HOST, 'packages/experimental/computer-use-cua-driver-native/src/index.ts', 97, 'cua_driver_native__', 'cua-rule')
assertAt(HOST, 'packages/extensions/cordis-host-runner/src/guard.ts', 628, 'ctx.tools.register(tool)', 'client-runner-register')

// ---------- 2. team tools ----------
const teamToolsTs = fs.readFileSync(path.join(TEAM, 'packages/tools/src/tools.ts'), 'utf8').split('\n')
const teamTools = []
teamToolsTs.forEach((l, i) => {
  const m = l.match(/^\s*name: '(team_[a-z_]+)',/)
  if (m) teamTools.push({ name: m[1], file: 'packages/tools/src/tools.ts', line: i + 1, kind: 'leader-team-tool (ToolSpec via createTeamTools, tools.ts:1524; consumed packages/runtime/src/plugin/root.ts:3919)' })
})
teamTools.forEach((l, i) => assertAt(TEAM, 'packages/tools/src/tools.ts', l.line, `'${l.name}'`, l.name))
assertAt(TEAM, 'packages/tools/src/tools.ts', 1373, "verb === 'grant' ? 'team_grant_permission' : 'team_revoke_permission'", 'grant-revoke-name-select')
assertAt(TEAM, 'packages/tools/src/tools.ts', 1524, 'export function createTeamTools', 'createTeamTools')
assertAt(TEAM, 'packages/tools/src/tools.ts', 1539, "permissionSpec('grant')", 'grant-spec-call')
assertAt(TEAM, 'packages/tools/src/tools.ts', 1540, "permissionSpec('revoke')", 'revoke-spec-call')
assertAt(TEAM, 'packages/runtime/src/plugin/root.ts', 3919, 'createTeamTools({', 'root-consume')
teamTools.push({ name: 'team_grant_permission', file: 'packages/tools/src/tools.ts', line: 1373, kind: 'leader-team-tool (name selected in permissionSpec(verb), tools.ts:1373; spec called at tools.ts:1539 inside createTeamTools tools.ts:1524)' })
teamTools.push({ name: 'team_revoke_permission', file: 'packages/tools/src/tools.ts', line: 1373, kind: 'leader-team-tool (name selected in permissionSpec(verb), tools.ts:1373; spec called at tools.ts:1540 inside createTeamTools tools.ts:1524)' })
const planeNames = { file: 'packages/runtime/src/plugin/live/team-tool-plane.mjs', line: 84 }
for (const n of ['team_grep', 'team_glob', 'team_bash']) {
  assertAt(TEAM, planeNames.file, planeNames.line, `'${n}'`, n)
  teamTools.push({ name: n, file: planeNames.file, line: planeNames.line, kind: 'plane-takeover-name (DEFAULT_PLANE_NAMES replaces native grep/glob/bash spellings for governed plane tools)' })
}
assertAt(TEAM, 'packages/tools/a5p5-tools/src/register.ts', 275, "names.grep ?? 'grep'", 'a5p5-grep')
assertAt(TEAM, 'packages/tools/a5p5-tools/src/register.ts', 281, "names.glob ?? 'glob'", 'a5p5-glob')
assertAt(TEAM, 'packages/tools/a5p5-tools/src/register.ts', 287, "names.bash ?? 'bash'", 'a5p5-bash')
for (const n of ['grep', 'glob', 'bash']) teamTools.push({ name: n, file: 'packages/tools/a5p5-tools/src/register.ts', line: n === 'grep' ? 275 : n === 'glob' ? 281 : 287, kind: 'DORMANT-lane-tool (a5p5 lane registers native spelling or plane-name override; NOT wired: index.ts:12-13 "DORMANT: nothing registers"; A5P5_TOOL_NAMES a5p5-tools/src/types.ts:44)' })
assertAt(TEAM, 'packages/tools/a5p5-tools/src/types.ts', 44, "A5P5_TOOL_NAMES = ['grep', 'glob', 'bash']", 'a5p5-names')
assertAt(TEAM, 'packages/tools/a5p5-tools/src/index.ts', 13, 'DORMANT', 'a5p5-dormant')
assertAt(TEAM, 'packages/runtime/src/plugin/live/agent-bindings.mjs', 1567, '`mcp__${serverName}__`', 'mcp-bind-prefix')
assertAt(TEAM, 'packages/runtime/src/plugin/live/agent-bindings.mjs', 723, "GUARD_NATIVE_TRUST_EXCLUDED_MCP_PREFIX = 'mcp__'", 'mcp-trust-exclude')
const teamDynamicSources = [
  { class: 'mcp__<server>__<tool>', rule: 'team-side MCP binding name rule: prefix `mcp__${serverName}__` (bindMcpTools); the mcp__ family NEVER inherits dsh-native guard trust', files: ['packages/runtime/src/plugin/live/agent-bindings.mjs:1567 (prefix build)', 'packages/runtime/src/plugin/live/agent-bindings.mjs:723 (trust exclusion)', 'packages/runtime/src/plugin/live/team-tool-plane.mjs:464 (PLANE_RESERVED_NATIVE_PREFIXES = ["mcp__"])'], note: 'dynamic source class; individual MCP names NOT enumerated' },
]

// ---------- 3. reserved table vs host ----------
// NB: team-tool-plane.mjs cannot be import()'ed directly (it imports TS lane .js
// specifiers that only exist post-build); parse the frozen array textually instead.
const planeSrc = fs.readFileSync(path.join(TEAM, 'packages/runtime/src/plugin/live/team-tool-plane.mjs'), 'utf8')
const arrMatch = planeSrc.match(/export const PLANE_RESERVED_NATIVE = Object\.freeze\(\[([\s\S]*?)\n\]\)/)
if (!arrMatch) { console.error('PLANE_RESERVED_NATIVE array not found'); process.exit(1) }
const arrNoComments = arrMatch[1].split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
const reserved = [...arrNoComments.matchAll(/'([^']+)'/g)].map(m => m[1])
const pinMatch = planeSrc.match(/export const PLANE_RESERVED_NATIVE_HOST_PIN = '([^']+)'/)
const reservedPin = pinMatch[1]
assertAt(TEAM, 'packages/runtime/src/plugin/live/team-tool-plane.mjs', 402, "PLANE_RESERVED_NATIVE_HOST_PIN = '0.2.0-rc.2@639ed01539'", 'reserved-pin')
assertAt(TEAM, 'packages/runtime/src/plugin/live/team-tool-plane.mjs', 403, 'PLANE_RESERVED_NATIVE = Object.freeze', 'reserved-table')
assertAt(TEAM, 'packages/runtime/src/plugin/live/team-tool-plane.mjs', 464, "PLANE_RESERVED_NATIVE_PREFIXES = Object.freeze(['mcp__'])", 'reserved-prefixes')

const hostStaticNames = [...new Set(hostTools.map(t => t.name))]
const reservedSet = new Set(reserved)
const missingFromReserved = hostStaticNames.filter(n => !reservedSet.has(n))
const reservedNotInHostStatic = reserved.filter(n => !new Set(hostStaticNames).has(n))

// host catalog (generated artifact at the pinned tree)
const md = fs.readFileSync(path.join(HOST, 'docs/tool-catalog.md'), 'utf8')
const catNames = new Set()
for (const r of md.split('\n').filter(l => l.startsWith('| `@deepseek'))) {
  const cols = r.split('|').map(s => s.trim())
  for (const m of (cols[2].match(/`[^`]+`/g) || [])) catNames.add(m.replace(/`/g, ''))
  for (const m of ((cols[5] || '').match(/`[^`]+`/g) || [])) if (m.replace(/`/g, '') !== '-') catNames.add(m.replace(/`/g, ''))
}
const catalogVsReserved = { catalog_missing_from_reserved: [...catNames].filter(n => !reservedSet.has(n)).sort(), reserved_extra_vs_catalog: reserved.filter(n => !catNames.has(n)) }

// ---------- 4. seed diff ----------
const seed = JSON.parse(fs.readFileSync(path.join(SEED, 'route-records-v3c.json'), 'utf8')).records
const seedNames = [...new Set(seed.map(r => r.name))]
const nameCount = {}
for (const r of seed) nameCount[r.name] = (nameCount[r.name] || 0) + 1
const hostNameSet = new Set(hostStaticNames)
const teamNameSet = new Set(teamTools.filter(t => !t.kind.includes('DORMANT')).map(t => t.name))
const teamDormantSet = new Set(teamTools.filter(t => t.kind.includes('DORMANT')).map(t => t.name))
const seedSet = new Set(seedNames)

const diff = {}
for (const n of seedNames) {
  const entry = { records: nameCount[n] }
  if (n.startsWith('surface:')) {
    entry.status = 'OBLIGATION_NOT_A_TOOL_NAME'
    entry.mapping = ({
      'surface:mcp_stdio': 'dynamic source class host mcp__<server>__<tool> (mcp-client syncTools) — recorded as dynamic, not enumerated',
      'surface:mcp_http_dynamic': 'dynamic source class host mcp__<server>__<tool> (mcp-client syncTools) — recorded as dynamic, not enumerated',
      'surface:domain_family': 'no current source tool name; family obligation — ABSENT as a name',
      'surface:neg4_preset_selfregister': 'dynamic source class host client-plugin registration (cordis-host-runner guard.ts:628) — recorded as dynamic, not enumerated',
    })[n]
    if (n === 'surface:domain_family') entry.status = 'ABSENT'
  } else if (hostNameSet.has(n) && teamNameSet.has(n)) entry.status = 'PRESENT_HOST_AND_TEAM'
  else if (hostNameSet.has(n)) entry.status = 'PRESENT_HOST'
  else if (teamNameSet.has(n)) entry.status = 'PRESENT_TEAM'
  else entry.status = 'ABSENT'
  entry.in_host_static_source = hostNameSet.has(n)
  entry.in_host_generated_catalog = catNames.has(n)
  entry.in_team_declaration = teamNameSet.has(n)
  entry.in_team_reserved_table = reservedSet.has(n)
  if (teamDormantSet.has(n) && !entry.in_team_declaration) entry.team_note = 'also name-matched by DORMANT a5p5 lane (not shipped)'
  diff[n] = entry
}
const newNames = []
for (const n of hostStaticNames) if (!seedSet.has(n)) newNames.push({ name: n, source: 'host', classification: 'UNKNOWN/NOT_VERIFIED — never authorized', sites: hostTools.filter(t => t.name === n).map(t => `${t.file}:${t.line}`) })
for (const t of teamTools) if (!t.kind.includes('DORMANT') && !seedSet.has(t.name)) newNames.push({ name: t.name, source: 'team', classification: 'UNKNOWN/NOT_VERIFIED — never authorized', sites: [`${t.file}:${t.line}`] })

const out = {
  meta: {
    generatedBy: 'U1-C (EB0-3) build-outputs.mjs',
    hostPin: 'tests/deepseek-harness-test-use @ 639ed015397290b3745d163aafe02ffee4aa3f84 (git describe: dsh-v0.2.0-rc.2)',
    teamPin: '.worktrees/u1-audit-master @ 4aaaa7b2af87f80a0fae62d9c8d9cf03d5a6fd84 (read-only)',
    seedPin: 'dev/agent-workflow/evidence/s1-m0-closure-v3-seeds/route-records-v3c.json',
    seedVerifiedCounts: { records: seed.length, uniqueNames: seedNames.length, surfaceObligations: seedNames.filter(n => n.startsWith('surface:')).length, uniqueNonSurface: seedNames.filter(n => !n.startsWith('surface:')).length, doubleRecordedNames: Object.entries(nameCount).filter(([, v]) => v > 1) },
    statusLegend: { PRESENT_HOST: 'name has a registration source in host 0.2.0-rc.2@639ed015 source tree', PRESENT_TEAM: 'name declared in team master@4aaaa7b2 (tools.ts plane-owned set or DEFAULT_PLANE_NAMES)', PRESENT_HOST_AND_TEAM: 'declared on both sides', ABSENT: 'not found as a tool name in any current source', RENAMED: 'fuzzy candidate — none asserted; every seed non-surface name resolved exactly' },
  },
  names: diff,
  newNames: { note: 'current-source names not in the seed — classified UNKNOWN/NOT_VERIFIED, never authorized', entries: newNames },
  dynamicSourceClasses: { host: hostDynamicSources, team: teamDynamicSources, note: 'MCP and other runtime-generated tool families are recorded as classes; individual dynamic names are NOT enumerated (seed surfaces surface:mcp_stdio / surface:mcp_http_dynamic / surface:neg4_preset_selfregister map here)' },
  reservedNameTableVsHost: {
    table: 'PLANE_RESERVED_NATIVE @ packages/runtime/src/plugin/live/team-tool-plane.mjs:403 (team@4aaaa7b2)',
    pinnedHost: reservedPin,
    prefixRule: 'PLANE_RESERVED_NATIVE_PREFIXES=["mcp__"] team-tool-plane.mjs:464',
    tableSize: reserved.length,
    hostStaticSourceSize: hostStaticNames.length,
    hostGeneratedCatalogSize: catNames.size,
    missing_from_reserved_vs_host_static_source: missingFromReserved,
    reserved_extra_vs_host_static_source: reservedNotInHostStatic,
    vs_host_generated_catalog: catalogVsReserved,
    notes: [
      'host static set includes structured_output (internal child tool) and subagent_codex/subagent_claude_code (source routes, default-disabled); the generated catalog docs/tool-catalog.md is the host authority the team drift test consumes.',
      'structured_output is absent from PLANE_RESERVED_NATIVE — but it is child-internal and not part of the catalog harvest; flagged for reviewer judgement, NOT asserted as drift.',
    ],
  },
}

fs.writeFileSync(path.join(OUT, 'host-tools.json'), JSON.stringify({ pin: out.meta.hostPin, note: 'every file:line re-verified at build time; authority column distinguishes generated-catalog names from source-route/internal names', tools: hostTools.map(({ _token, ...t }) => t), dynamicSourceClasses: hostDynamicSources }, null, 2))
fs.writeFileSync(path.join(OUT, 'team-tools.json'), JSON.stringify({ pin: out.meta.teamPin, note: 'createTeamTools set + DEFAULT_PLANE_NAMES + DORMANT a5p5 lane + MCP binding rule; lines re-verified', tools: teamTools, dynamicSourceClasses: teamDynamicSources }, null, 2))
fs.writeFileSync(path.join(OUT, 'seed-diff.json'), JSON.stringify(out, null, 2))

const counts = {
  seedRecords: seed.length,
  seedUniqueNames: seedNames.length,
  seedSurfaceObligations: seedNames.filter(n => n.startsWith('surface:')).length,
  seedUniqueNonSurface: seedNames.filter(n => !n.startsWith('surface:')).length,
  hostRegistrationSites: hostTools.length,
  hostStaticUniqueNames: hostStaticNames.length,
  hostCatalogNames: catNames.size,
  teamDeclaredNames: teamNameSet.size,
  diffCounts: {
    PRESENT_HOST: Object.values(diff).filter(d => d.status === 'PRESENT_HOST').length,
    PRESENT_TEAM: Object.values(diff).filter(d => d.status === 'PRESENT_TEAM').length,
    PRESENT_HOST_AND_TEAM: Object.values(diff).filter(d => d.status === 'PRESENT_HOST_AND_TEAM').length,
    ABSENT: Object.values(diff).filter(d => d.status === 'ABSENT').length,
    OBLIGATION: Object.values(diff).filter(d => d.status === 'OBLIGATION_NOT_A_TOOL_NAME').length,
    RENAMED: 0,
  },
  newNames: newNames.length,
  reservedTable: { size: reserved.length, missingVsHostStatic: missingFromReserved, extraVsHostStatic: reservedNotInHostStatic, extraVsCatalog: catalogVsReserved.reserved_extra_vs_catalog },
  assertionProblems: problems,
}
fs.writeFileSync(path.join(OUT, 'agg-counts.json'), JSON.stringify(counts, null, 2))
console.log(JSON.stringify(counts, null, 2))
if (problems.length) { console.error('PROBLEMS:'); problems.forEach(p => console.error(p)); process.exitCode = 1 }
