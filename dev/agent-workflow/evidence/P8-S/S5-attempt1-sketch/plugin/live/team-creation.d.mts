/**
 * team-creation.d.mts — the type surface of `team-creation.mjs` (the
 * live world module; loaded only through the dynamic `import()` in
 * `host.ts`).
 */

import type { BlueprintCatalog } from '../../../domain/blueprint/src/index.js'
import type {
  HandoffTeamIntent,
  TeamCreationOutcome,
} from '../../../handoff/index.js'
import type { TeamPluginConfig, TeamProductionRoot } from '../../types.js'
import type { TeamLiveSessionHandle } from '../../types.js'

/** The production handoff team-creation port (structural
 *  `HandoffTeamCreationPort`). */
export interface TeamCreationPort {
  readonly createFromIntent: (intent: HandoffTeamIntent) => Promise<TeamCreationOutcome>
}

/**
 * Build the production handoff team-creation port. See the `.mjs`
 * header for the documented reading of the opaque `staged` fields and
 * the idempotency contract (deterministic root mint from the
 * `intentToken`; the durable `team-root` binding precedes the external
 * agent effect).
 */
export declare function buildTeamCreationPort(args: {
  readonly config: TeamPluginConfig
  readonly catalog: BlueprintCatalog
  readonly agents: unknown
  readonly sessionPersistence: unknown
  readonly getProductionRoot: () => TeamProductionRoot | undefined
  readonly registerLiveAgent: (sessionId: string, handle: TeamLiveSessionHandle) => void
  readonly agentSetup: (sessionId: string) => (agentCtx: unknown) => Promise<void>
}): TeamCreationPort
