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
      readonly routing: import('../../domain/blueprint/src/index.js').ReviewRouting
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
    authorityGeneration: async ({ rootSessionId, operationOwnerInstanceId }) =>
      generation({ teamSessionId: rootSessionId, memberInstanceId: operationOwnerInstanceId }),
    fixedLeaderOrHumanCategory: createAlpha6CategoryLookup(),
  })

  return { mode: 'alpha6', ports, officerInstanceId: officer.instanceId, routing: parsed.routing }
}

/**
 * The LIVE-VIEW variant used by a long-lived Host composition.
 *
 * The static factory above pins a member SNAPSHOT. Production creates members
 * AFTER the control service exists, so a snapshot would either be empty or
 * stale. This variant takes the durable member LOOKUP (get/list) and does NOT
 * pin an Officer:
 *
 *  - construction checks only the static policy face (v5 routing enabled, a
 *    non-empty Officer template that is not the Leader template);
 *  - every assigned-Officer evaluation re-resolves exactly ONE live RUNNING
 *    Officer through `AssignedOfficerFactsPort`, so zero/multiple/archived
 *    states refuse AT THE QUERY, never against a startup snapshot.
 *
 * No notifier swap and no root mutation happen here either.
 */
export type Alpha6LiveRootComposition =
  | { readonly mode: 'legacy'; readonly reason: 'disabled' }
  | { readonly mode: 'refused'; readonly refused: Alpha6CompositionRefusal }
  | {
      readonly mode: 'alpha6'
      readonly ports: Alpha6ControlPorts
      readonly officerTemplateId: string
      readonly routing: import('../../domain/blueprint/src/index.js').ReviewRouting
    }

export interface Alpha6LiveRootCompositionInput {
  readonly enabled: boolean
  readonly blueprintSource: string
  readonly rootSessionId: string
  readonly leaderTemplateId: string
  readonly members: {
    readonly get: (
      rootSessionId: string,
      instanceId: string,
    ) => Promise<AssignedOfficerMemberSnapshot | undefined> | AssignedOfficerMemberSnapshot | undefined
    readonly list: (
      rootSessionId: string,
    ) => Promise<readonly AssignedOfficerMemberSnapshot[]> | readonly AssignedOfficerMemberSnapshot[]
  }
  readonly control: Alpha6RootCompositionInput['control']
  readonly permissionOverlay?: Alpha6PermissionOverlayPort
}

/**
 * The PRODUCTION opt-in assembly — the ONE seam `root.ts` calls.
 *
 * `enabled` is the explicit Host/Team opt-in
 * (`TeamPluginConfig.alpha6ReviewRouting`). When it is not exactly `true`,
 * this returns `legacy` WITHOUT invoking `live`: no blueprint field is read,
 * no member row is listed, no Alpha.6 code runs, so the Alpha.5
 * `createControlService` object stays byte-identical.
 *
 * When it is `true` the live composition runs and either yields the two
 * trusted ports or a REFUSAL with NO ports. The caller MUST fail closed on a
 * refusal (throw at wiring time); an opted-in Team never falls back to the
 * Leader path.
 */
export type Alpha6RootWiring =
  | { readonly mode: 'legacy' }
  | { readonly mode: 'refused'; readonly refused: Alpha6CompositionRefusal }
  | {
      readonly mode: 'alpha6'
      readonly ports: Alpha6ControlPorts
      readonly officerTemplateId: string
      readonly routing: import('../../domain/blueprint/src/index.js').ReviewRouting
    }

/** The live input the caller's thunk supplies; the `enabled` bit is the helper's. */
export type Alpha6RootWiringLiveInput = Omit<Alpha6LiveRootCompositionInput, 'enabled'>

export function createAlpha6RootWiring(
  enabled: boolean,
  live: () => Alpha6RootWiringLiveInput,
): Alpha6RootWiring {
  if (enabled !== true) return { mode: 'legacy' }
  const composition = createAlpha6LiveRootComposition({ ...live(), enabled: true })
  if (composition.mode === 'alpha6') return composition
  if (composition.mode === 'refused') return { mode: 'refused', refused: composition.refused }
  // Unreachable: the live composition cannot answer `legacy` when enabled.
  // Throwing (never `legacy`) keeps the fail-closed direction even if a
  // future edit breaks that invariant.
  throw new Error('internal invariant broken: enabled Alpha.6 root wiring composed the legacy mode')
}

export function createAlpha6LiveRootComposition(
  input: Alpha6LiveRootCompositionInput,
): Alpha6LiveRootComposition {
  if (input.enabled !== true) return { mode: 'legacy', reason: 'disabled' }

  const parsed = parseAlpha6Routing(input.blueprintSource)
  if (parsed === null) return { mode: 'refused', refused: 'blueprint-not-v5' }

  // Reuse the ONE static decision for the policy face. The member count is not
  // a construction fact here; the facts port applies the unique-Officer law on
  // every query, so the probe list only satisfies the signature.
  const decision = decideAlpha6Composition({
    enabled: true,
    blueprintDocumentVersion: parsed.blueprint.schemaVersion,
    reviewRouting: {
      enabled: parsed.routing.enabled,
      officerTemplateId: parsed.routing.officerTemplateId,
    },
    activeMemberTemplateIds: [parsed.routing.officerTemplateId],
    leaderTemplateId: input.leaderTemplateId,
  })
  if (decision.mode !== 'alpha6') return decision

  const generation = createAlpha6AuthorityGenerationReader(input.permissionOverlay)
  const ports = createAlpha6ControlPorts({
    rootSessionId: input.rootSessionId,
    routing: parsed,
    control: {
      readControlState: async (rootSessionId) =>
        (await input.control.readControlState(rootSessionId)) as never,
    },
    members: {
      get: (rootSessionId, instanceId) =>
        rootSessionId === input.rootSessionId ? input.members.get(rootSessionId, instanceId) : undefined,
      list: (rootSessionId) =>
        rootSessionId === input.rootSessionId ? input.members.list(rootSessionId) : [],
    },
    authorityGeneration: async ({ rootSessionId, operationOwnerInstanceId }) =>
      generation({ teamSessionId: rootSessionId, memberInstanceId: operationOwnerInstanceId }),
    fixedLeaderOrHumanCategory: createAlpha6CategoryLookup(),
  })
  return { mode: 'alpha6', ports, officerTemplateId: parsed.routing.officerTemplateId, routing: parsed.routing }
}
