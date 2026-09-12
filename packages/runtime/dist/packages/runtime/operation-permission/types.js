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
//# sourceMappingURL=types.js.map