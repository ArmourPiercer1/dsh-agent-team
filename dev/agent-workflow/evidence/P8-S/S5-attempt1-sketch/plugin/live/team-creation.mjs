/**
 * team-creation.mjs — the production handoff team-creation port (P8-S5,
 * node A28's final stage).
 *
 * The {@link HandoffTeamCreationPort} the production root's handoff
 * service consumes: "start a team from here" — the staged TeamIntent
 * (opaque lossless-JSON passthrough the handoff module never
 * interprets) becomes a new TeamSession B / new Root B.
 *
 * This module is the ADAPTER that documents its own reading of the
 * opaque staged fields (the contract keeps them opaque; a production
 * entry must pick one deterministic interpretation and document it):
 *
 * - `staged.blueprintId`        — REQUIRED (a string). Resolved against
 *   the instance's own Blueprint catalog (the composition's catalog,
 *   built from `config.blueprintSource`).
 * - `staged.blueprintRevision`  — optional; absent/empty resolves the
 *   catalog's LATEST revision under the catalog order.
 * - `staged.workspace`          — optional; absent/empty falls back to
 *   `config.defaultWorkspace` (absent there too = no default workspace).
 *
 * Everything else on `staged` is ignored here (future TeamIntent fields
 * belong to a later task; ignoring unknown fields is the opaque-
 * passthrough contract, not a parse failure).
 *
 * Idempotency (the HandoffTeamCreationPort contract, Architecture
 * §18.2 stable operation identity): the new root session id is MINTED
 * DETERMINISTICALLY from the `intentToken` — a replay with the same
 * token mints the same id and short-circuits on the durable `team-root`
 * session binding (written BEFORE the external agents.create effect,
 * so a crash re-drive never creates a second root session).
 *
 * The durable fresh root itself is NEVER written by this module: it
 * goes through the production root's own `rootBinding.bindFresh`
 * (the single assembly point — this module owns no repository writes of
 * its own; the leader instance is minted by the frozen root-binding
 * service, v2 leader record, and the live layer's root-session lookup
 * resolves it through the reserved `inst-leader` instance id).
 *
 * Live world module: carries the `@deepseek-ai/*` + `node:` imports
 * that the sanctioned test chain must never resolve; loaded ONLY
 * through the dynamic `import()` in `host.ts` (never a static import
 * from any `.ts` file).
 * @module @dsh-agent-team/runtime/plugin/live/team-creation
 */

import { SessionId } from '@deepseek-ai/dsh-session'
import { parseRootSessionId } from '../../../../contracts/src/index.js'

/** The deterministic mint of the new root session id (documented above). */
function mintRootSessionId(intentToken) {
  const safe = intentToken.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 200)
  // `session-handoff-` prefix + <= 200 safe chars = <= 216 chars total:
  // satisfies the contracts structural rules (non-empty, <= 255, no
  // whitespace, no control characters) and can never collide with the
  // DSH session store's `session-<n>` mint.
  return `session-handoff-${safe}`
}

/**
 * Build the production {@link HandoffTeamCreationPort}.
 *
 * @param {object} args
 * @param {object} args.config - the TeamPluginConfig (JSON-safe core).
 * @param {object} args.catalog - the instance's Blueprint catalog
 *   (the composition's `blueprintCatalog`; `snapshotOf` supplies the
 *   typed snapshot ref).
 * @param {object} args.agents - the DSH `agents` service (create).
 * @param {object} args.sessionPersistence - the DSH `sessionPersistence`
 *   service (the invariant-46 materialization of the new root).
 * @param {function} args.getProductionRoot - late-bound thunk returning
 *   the assembled production root (bound via the live bundle's
 *   `bindRoot` before any handoff operation can run); the fresh root
 *   is bound through ITS `rootBinding.bindFresh`, and the idempotency
 *   read goes through ITS `repositories` (one source of truth).
 * @param {function} args.registerLiveAgent - `(sessionId, handle) =>
 *   void`: register the minted root agent in the live session map so
 *   the follow-up/messaging paths can find it.
 * @param {function} args.agentSetup - the shared agent setup factory
 *   (`makeAgentSetup`): one setup closure per session id.
 * @returns {object} the HandoffTeamCreationPort
 *   (`{ createFromIntent }` shape, structurally).
 */
export function buildTeamCreationPort({
  config,
  catalog,
  agents,
  sessionPersistence,
  getProductionRoot,
  registerLiveAgent,
  agentSetup,
}) {
  return {
    /**
     * Create the new team from one staged TeamIntent.
     * @param {object} intent - the HandoffTeamIntent
     *   (`{ intentToken, staged, handoff? }`).
     * @returns {Promise<{ teamSessionId: string, rootSessionId: string }>}
     *   the committed identity (invariant 9: both fields equal).
     */
    async createFromIntent(intent) {
      const intentToken = typeof intent?.intentToken === 'string' ? intent.intentToken : ''
      if (intentToken === '') {
        throw new Error('p8s5 team-creation: intent.intentToken is required (the stable operation identity)')
      }
      const staged = intent.staged !== undefined && intent.staged !== null && typeof intent.staged === 'object'
        ? intent.staged
        : {}
      const blueprintId = typeof staged.blueprintId === 'string' ? staged.blueprintId : ''
      if (blueprintId === '') {
        throw new Error('p8s5 team-creation: staged.blueprintId is required (the documented reading of the opaque staged fields)')
      }
      if (!catalog.hasBlueprint(blueprintId)) {
        throw new Error(`p8s5 team-creation: unknown blueprint id '${blueprintId}'`)
      }
      const revision = typeof staged.blueprintRevision === 'string' && staged.blueprintRevision !== ''
        ? staged.blueprintRevision
        : null
      const blueprint = revision === null
        ? catalog.resolveLatest(blueprintId)
        : catalog.resolve(blueprintId, revision)
      const workspace = typeof staged.workspace === 'string' && staged.workspace !== ''
        ? staged.workspace
        : config.defaultWorkspace

      const newRoot = mintRootSessionId(intentToken)
      const root = getProductionRoot()
      if (root === undefined) {
        throw new Error('p8s5 team-creation: the production root is not bound yet')
      }

      // Idempotency short-circuit: the durable `team-root` binding was
      // written before the external effect, so its presence IS the
      // "creation succeeded" record (a replay re-reads nothing and
      // touches no agent).
      const existingBinding = root.repositories.sessionBindings.get(newRoot)
      if (existingBinding !== undefined && String(existingBinding.kind) === 'team-root') {
        return { teamSessionId: newRoot, rootSessionId: newRoot }
      }

      // The durable fresh root — through the production root's own
      // root-binding service (the single assembly point).
      await root.rootBinding.bindFresh({
        rootSessionId: parseRootSessionId(newRoot),
        blueprint: catalog.snapshotOf(blueprintId, String(blueprint.revision)),
        ...(workspace !== undefined ? { defaultWorkspace: workspace } : {}),
        generation: 1,
      })

      // The external effect: the new Root Agent (created AFTER the
      // durable record, so a crash between the two re-drives through
      // the idempotency short-circuit, never a second root session).
      const handle = await agents.create({
        sessionId: SessionId(newRoot),
        meta: { cwd: process.env.DSH_HOME },
        setup: agentSetup(newRoot),
      })
      registerLiveAgent(newRoot, handle)
      await sessionPersistence.ensureMaterialized(handle.agent.session)
      return { teamSessionId: newRoot, rootSessionId: newRoot }
    },
  }
}
