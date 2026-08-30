/**
 * TeamAgentBinder public facade — the P5-T1 deliverable surface
 * (TaskDoc §11.5; DevPlan §18.1).
 *
 * Re-exports the complete P5-T1 binder module set (types, errors, defaults,
 * the read-handle projection, and the binder class). T5/T6 will bind the
 * REAL DSH public seam through this same surface; the injected
 * `TeamAgentSetupSurface` stays the only contact point to the agent
 * runtime (mock-first until then).
 *
 * @module @dsh-agent-team/runtime/agent-setup/binder
 */

export {
  AGENT_SETUP_EVENT_NAMES,
  OVERLAY_SLOT_ORDER,
} from './types.js'
export type {
  AdmissionDecision,
  AdmissionGuard,
  AgentSetupEventRecord,
  OverlaySlot,
  OverlaySlotName,
  RestoredScope,
  TeamAgentBindIdentity,
  TeamAgentBindPath,
  TeamAgentBindResult,
  TeamAgentBinderOptions,
  TeamAgentSetupSurface,
  TeamAgentStepContext,
  TeamDomainReadHandle,
} from './types.js'
export {
  TEAM_AGENT_BINDER_ERROR_CODES,
  TEAM_AGENT_BINDER_ERROR_CODE_VALUES,
  TeamAgentBinderError,
  isTeamAgentBinderError,
} from './errors.js'
export type { TeamAgentBinderErrorCode } from './errors.js'
export {
  ADMISSION_GUARD_ERROR_CODE,
  ADMISSION_OPEN_CODE,
  defaultAdmissionGuard,
  defaultOverlaySlots,
  identityOverlaySlot,
} from './defaults.js'
export { createTeamDomainReadHandle } from './read-handle.js'
export type { TeamDomainReadRepositories } from './read-handle.js'
export { TeamAgentBinder } from './binder.js'
export type { OverlayFailureOrigin } from './binder.js'
