/**
 * A2 (alpha.2, plan §7) — the operation-permission canonicalization
 * module: the core security boundary of alpha.2.
 *
 * Public surface:
 * - {@link canonicalizeOperation} — one concrete tool call (name +
 *   parsed arguments) → {@link CanonicalOperation} (opaque resource
 *   identity + exact fingerprint);
 * - {@link classifyPermissionTool} / {@link isPermissionToolName} — the
 *   closed three-way tool classification the A5 adapter uses BEFORE
 *   touching the parameter resolver (plan §7.5);
 * - the closed vocabulary (permission tools, failure reasons, error
 *   codes) and the typed fail-closed error
 *   ({@link OperationPermissionError},
 *   `OPERATION_CANONICALIZATION_FAILED`);
 * - the fixed normalization constants
 *   ({@link READ_OFFSET_DEFAULT}, {@link READ_LIMIT_DEFAULT} — the
 *   documented effective-`read`-window decision;
 *   {@link LSP_OPERATION_VALUES} — the closed lsp operation enum;
 *   {@link BASH_TOOL_RESOURCE_KEY} — the bash tool-level resource);
 * - {@link resolveOperationPermission} — the A3 static resolver
 *   (plan §8): (A1 policy, A2 CanonicalOperation, A5
 *   CanonicalRules) → {@link PermissionDecision} (decision +
 *   provenance) — pure, synchronous, zero I/O.
 *
 * What this module IS (and deliberately is NOT):
 *
 * - It IS pure + seam-injected: no `node:` imports, no upstream
 *   `@deepseek-ai/*` imports, no `process.cwd()` — the
 *   {@link PathTargetResolver} (the A5 adapter's wrapper over the
 *   upstream public `ctx.fs.resolve` seam, plan §7.2) owns ALL path
 *   semantics (Windows separators/case/`..`/symlinks included —
 *   plan §7.6);
 * - it IS fail-closed: every canonicalization failure throws the typed
 *   error and must map to a `deny` — never a pass-through (plan §7.5);
 * - it IS also the static resolver (A3, plan §8):
 *   {@link resolveOperationPermission} matches A5-canonicalized policy
 *   rules against `resource.key` — pure, synchronous, zero I/O;
 * - it is NOT the control scope (A4: exact allows over the
 *   `fingerprint`) and NOT the pre-execute listener (A5: the
 *   agent-scoped `tools/pre-execute` enforcement).
 *
 * @module @dsh-agent-team/runtime/operation-permission
 */

export {
  OPERATION_PERMISSION_ERROR_CODES,
  OPERATION_PERMISSION_ERROR_CODE_VALUES,
  CANONICALIZATION_FAILURE_REASONS,
  OperationPermissionError,
  isOperationPermissionError,
  canonicalizationFailed,
  toCanonicalizationDetail,
} from './errors.js'
export type {
  OperationPermissionErrorCode,
  CanonicalizationFailureReason,
} from './errors.js'

export {
  PERMISSION_TOOL_VALUES,
  FILE_PERMISSION_TOOL_VALUES,
} from './types.js'
export type {
  PermissionTool,
  FilePermissionTool,
  ToolLevelPermissionTool,
  CanonicalResource,
  CanonicalOperation,
  PathTargetResolver,
  PermissionToolClass,
} from './types.js'

export {
  READ_OFFSET_DEFAULT,
  READ_LIMIT_DEFAULT,
  LSP_OPERATION_VALUES,
  BASH_TOOL_RESOURCE_KEY,
  classifyPermissionTool,
  isPermissionToolName,
  canonicalizeOperation,
} from './canonical-operation.js'
export type { CanonicalizeOperationInput } from './canonical-operation.js'

export {
  resolveOperationPermission,
} from './permission-resolver.js'
export type {
  CanonicalRule,
  CanonicalRules,
  PermissionDecision,
  PermissionLane,
  PermissionProvenance,
} from './permission-resolver.js'
