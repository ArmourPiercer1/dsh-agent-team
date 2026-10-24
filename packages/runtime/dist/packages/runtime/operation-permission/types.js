/**
 * A2 (alpha.2, plan §7) — the operation-permission vocabulary: the closed
 * permission-tool names, the canonical operation output, and the injected
 * path-resolution seam.
 *
 * This module is the CORE SECURITY BOUNDARY of alpha.2 (plan §7): it turns
 * one concrete tool call (name + parsed arguments) into a
 * {@link CanonicalOperation} — a stable resource identity (`resource.key`,
 * opaque, from the injected resolver) plus an exact operation-impact
 * identity (`fingerprint`). The static resolver (A3) matches policy rules
 * against `resource.key`; the durable control plane (A4) scopes exact
 * allows to the `fingerprint`; the pre-execute adapter (A5) fails closed
 * on canonicalization errors.
 *
 * @module @dsh-agent-team/runtime/operation-permission/types
 */
/** Every {@link PermissionTool} value, for membership checks. */
export const PERMISSION_TOOL_VALUES = [
    'read',
    'read_image',
    'write',
    'edit',
    'lsp',
    'bash',
    'pwsh',
    'schedule_list',
    'schedule_delete',
    'session_search',
    'session_event_search',
    'session_trace',
    'session_event_trace',
    'session_event_read',
    'create_goal',
    'get_goal',
    'update_goal',
    'todo_write',
    'terminal_open',
    'terminal_send',
    'terminal_read',
    'terminal_signal',
    'terminal_close',
    'terminal_list',
    'run_code',
    'plugin_manager',
    'grep',
    'glob',
    'team_grep',
    'team_glob',
    'job_output',
    'job_list',
    'job_kill',
    'stagehand_act',
    'stagehand_extract',
    'stagehand_navigate',
    'stagehand_observe',
    'stagehand_screenshot',
    'stagehand_tabs',
    'list_mcp_resource_templates',
    'list_mcp_resources',
    'read_mcp_resource',
    'web_search',
    'web_fetch',
    'team_list_members',
    'team_list_templates',
    'team_inspect_config',
    'team_create_member',
    'team_delegate',
    'team_follow_up',
    'team_collect',
    'team_send_message',
    'team_report_progress',
    'team_archive_member',
    'cordis_inspect_list',
    'cordis_inspect_query',
    'team_list_pending_control',
    'team_request_control',
    'team_resolve_control',
    'team_grant_permission',
    'team_revoke_permission',
    'str_replace_editor',
    'interrupt_agent',
    'list_agents',
    'send_message',
    'subagent',
    'subagent_fork',
    'subagent_codex',
    'subagent_claude_code',
    'list_subagent_models',
];
/** Every {@link FilePermissionTool} value, for membership checks. */
export const FILE_PERMISSION_TOOL_VALUES = [
    'read',
    'read_image',
    'write',
    'edit',
    'lsp',
];
/**
 * Every {@link ToolLevelPermissionTool} value (the closed shell class —
 * A2C-1). The single source of the shell-class membership checks:
 * classification, the inert-exact-rule skip, and the end-cap supported-
 * tool set all derive from this list, so the class cannot drift.
 */
export const SHELL_PERMISSION_TOOL_VALUES = [
    'bash',
    'pwsh',
];
/**
 * Every {@link InvocationOnlyPermissionTool} value. The single source of
 * invocation-only class membership in the runtime: the admission
 * projection's narrowing (deny/`any` law, exact/subtree refusal) reads
 * THIS list — never a copied literal.
 */
export const INVOCATION_ONLY_PERMISSION_TOOL_VALUES = [
    'schedule_list',
    'schedule_delete',
    'session_search',
    'session_event_search',
    'session_trace',
    'session_event_trace',
    'session_event_read',
    'create_goal',
    'get_goal',
    'update_goal',
    'todo_write',
    'terminal_open',
    'terminal_send',
    'terminal_read',
    'terminal_signal',
    'terminal_close',
    'terminal_list',
    'run_code',
    'plugin_manager',
    'grep',
    'glob',
    'team_grep',
    'team_glob',
    'job_output',
    'job_list',
    'job_kill',
    'stagehand_act',
    'stagehand_extract',
    'stagehand_navigate',
    'stagehand_observe',
    'stagehand_screenshot',
    'stagehand_tabs',
    'list_mcp_resource_templates',
    'list_mcp_resources',
    'read_mcp_resource',
    'web_search',
    'web_fetch',
    'team_list_members',
    'team_list_templates',
    'team_inspect_config',
    'team_create_member',
    'team_delegate',
    'team_follow_up',
    'team_collect',
    'team_send_message',
    'team_report_progress',
    'team_archive_member',
    'cordis_inspect_list',
    'cordis_inspect_query',
    'team_list_pending_control',
    'team_request_control',
    'team_resolve_control',
    'team_grant_permission',
    'team_revoke_permission',
    'str_replace_editor',
    'interrupt_agent',
    'list_agents',
    'send_message',
    'subagent',
    'subagent_fork',
    'subagent_codex',
    'subagent_claude_code',
    'list_subagent_models',
];
//# sourceMappingURL=types.js.map