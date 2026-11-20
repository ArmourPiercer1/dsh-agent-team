/**
 * @dsh-agent-team/tools — the model-facing team tool surface (P6-T6).
 *
 * Responsibility (TaskDoc §11 package boundary): the closed set of
 * model-facing team tools (list / create / delegate / follow-up / message /
 * progress / control / lifecycle-inspect) — EVERY tool delegates to the
 * TeamRuntime public surface (the facade plus the sanctioned satellites:
 * the control plane's last-mile guard, the messaging coordinator, the
 * activity ledger). The package holds no team state, performs no durable
 * write of its own, and registers through the host's public tool
 * registration only (the P2-T4 characterized seam).
 *
 * The static bypass-scan test (test/p6t6-bypass-scan.test.ts) proves the
 * three boundary rules over this package's sources: no direct durable-
 * domain access, no agent creation of its own, no legacy Team SessionEvent
 * vocabulary.
 *
 * @module @dsh-agent-team/tools
 */

export const PACKAGE_ID = 'tools'

export {
  TEAM_TOOL_BAD_ARGUMENTS,
  TEAM_TOOL_CALLER_UNRESOLVED,
  TEAM_TOOL_REQUEST_TOKEN_MAX_LENGTH,
  TeamToolArgsError,
  isTeamToolArgsError,
  optionalStringField,
  readStringField,
  requireStringField,
  validateRequestToken,
} from './tokens.js'

export { consultGuard } from './guard.js'
export type { GuardConsultDecision } from './guard.js'

export { createTeamTools } from './tools.js'
export type { TeamToolSet } from './tools.js'

export { selectTeamTools } from './tool-selector.js'

export { applyBuiltInToolDeny } from './builtin-deny.js'
export type { ToolRestrictionDisposer } from './builtin-deny.js'

// UTE-1 — additive, UNUSED BY ANY SHIPPED ASSEMBLY (see the module header):
// the native FS binding product module. `git grep` over the product entries
// finds no importer; the export exists so a reviewed composition can consume it
// without a second copy. It has no imports and therefore adds no dependency.
export {
  FS_BINDING_REFUSAL,
  NATIVE_FS_BINDING_FACT_SCHEMA,
  NATIVE_FS_BINDING_MODULE_ID,
  NativeFsBindingError,
  createNativeFsBindingScope,
  laneAdmits,
  mountNativeFsBinding,
  normalizeLaneRoots,
} from './native-fs-binding.js'
export type {
  AbortSignalLike,
  CreateNativeFsBindingScopeInput,
  FsBindingLane,
  FsBindingRefusal,
  FsBindingStatus,
  FsErrorConstructor,
  FsErrorLike,
  MountNativeFsBindingInput,
  NativeFileSystemConstructor,
  NativeFileSystemSurface,
  NativeFsBinding,
  NativeFsBindingContext,
  NativeFsBindingDisposal,
  NativeFsBindingFact,
  NativeFsBindingHost,
  NativeFsBindingScope,
  NativeFsToolModule,
} from './native-fs-binding.js'

export type {
  ResolvedTeamToolCaller,
  TeamPermissionExecIntent,
  TeamToolDefinition,
  TeamToolExecContext,
  TeamToolParameterSchema,
  TeamToolsOptions,
  TeamToolsResult,
} from './types.js'
