/**
 * Alpha.6 — the ROOT-side assembly of the trusted review facts plane.
 *
 * One pure factory joins the pieces the Host already owns:
 *  - the bound Blueprint SOURCE parsed ONCE (v5 only; a v4/invalid document is
 *    `refused`, never a silent legacy fallback);
 *  - the fail-closed composition decision (exactly one live Officer);
 *  - the durable reader + member rows;
 *  - the durable permission-overlay generation for the RESOLVED reviewer;
 *  - the closed control-kind category classifier.
 *
 * It returns the two ControlService ports and NOTHING else: no notifier swap,
 * no wake delivery, no root mutation. A caller that wants Alpha.6 must pass the
 * result into `createControlService` explicitly; an absent/refused result keeps
 * the Alpha.5 path byte-identical.
 *
 * @module packages/runtime/alpha6/root-composition
 */
import {
  createAlpha6ControlPorts,
  createAlpha6CategoryLookup,
  type Alpha6ControlPorts,
  type AssignedOfficerMemberSnapshot,
} from './assigned-officer-facts.js'
import { createAlpha6AuthorityGenerationReader, type Alpha6PermissionOverlayPort } from './authority-generation.js'
import { decideAlpha6Composition, parseAlpha6Routing, type Alpha6CompositionRefusal } from './composition.js'

export interface Alpha6RootCompositionInput {
  /** The explicit Host/Team opt-in. False keeps Alpha.5 byte-identical. */
  readonly enabled: boolean
  /** The SAME bound source handed to the router/wiring; parsed once here. */
  readonly blueprintSource: string
  readonly rootSessionId: string
  readonly leaderTemplateId: string
  /** The durable member view of THIS team (never a model claim). */
  readonly members: readonly AssignedOfficerMemberSnapshot[]
  /** The non-locking durable control reader (ControlService.readControlState). */
  readonly control: {
    readonly readControlState: (rootSessionId: string) => Promise<{
      readonly requests: readonly unknown[]
      readonly transfers: readonly unknown[]
    }>
  }
  readonly permissionOverlay?: Alpha6PermissionOverlayPort
}

export type Alpha6RootComposition =
  | { readonly mode: 'legacy'; readonly reason: 'disabled' }
  | { readonly mode: 'refused'; readonly refused: Alpha6CompositionRefusal }
  | {
      readonly mode: 'alpha6'
      readonly ports: Alpha6ControlPorts
      readonly officerInstanceId: string
    }

/**
 * Assemble the trusted ports. Any missing fact refuses; this function NEVER
 * invents an Officer, a generation, a category or a routing.
 */
export function createAlpha6RootComposition(input: Alpha6RootCompositionInput): Alpha6RootComposition {
  if (input.enabled !== true) return { mode: 'legacy', reason: 'disabled' }

  const parsed = parseAlpha6Routing(input.blueprintSource)
  if (parsed === null) return { mode: 'refused', refused: 'blueprint-not-v5' }

  const decision = decideAlpha6Composition({
    enabled: true,
    blueprintDocumentVersion: parsed.blueprint.schemaVersion,
    reviewRouting: {
      enabled: parsed.routing.enabled,
      officerTemplateId: parsed.routing.officerTemplateId,
    },
    activeMemberTemplateIds: input.members
      .filter((member) => member.lifecycle === 'RUNNING')
      .map((member) => member.templateId),
    leaderTemplateId: input.leaderTemplateId,
  })
  if (decision.mode !== 'alpha6') return decision

  const officer = input.members.find(
    (member) => member.lifecycle === 'RUNNING' && member.templateId === decision.officerTemplateId,
  )
  if (officer === undefined) return { mode: 'refused', refused: 'officer-instance-count' }

  const byId = new Map(input.members.map((member) => [member.instanceId, member]))
  const generation = createAlpha6AuthorityGenerationReader(input.permissionOverlay)

  const ports = createAlpha6ControlPorts({
    rootSessionId: input.rootSessionId,
    routing: parsed,
    control: {
      readControlState: async (rootSessionId) =>
        (await input.control.readControlState(rootSessionId)) as never,
    },
    members: {
      get: (rootSessionId, instanceId) => {
        if (rootSessionId !== input.rootSessionId) return undefined
        return byId.get(instanceId)
      },
      list: (rootSessionId) =>
        rootSessionId === input.rootSessionId ? [...byId.values()] : [],
    },
    authorityGeneration: async ({ rootSessionId, reviewerInstanceId }) =>
      generation({ teamSessionId: rootSessionId, memberInstanceId: reviewerInstanceId }),
    fixedLeaderOrHumanCategory: createAlpha6CategoryLookup(),
  })

  return { mode: 'alpha6', ports, officerInstanceId: officer.instanceId }
}
