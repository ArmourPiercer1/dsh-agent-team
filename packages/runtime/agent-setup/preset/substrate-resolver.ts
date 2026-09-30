/**
 * pre-alpha3 PR-C — the RuntimeSubstrateResolver (plan §C.2): the SINGLE
 * authority for what the runtime WILL mount + the observed persona kind of
 * EACH mounted preset (the root's AND the member's).
 *
 * The historical four fact sources (plan §C.1) each fed a different consumer
 * and disagreed:
 *
 * 1. the UI-selected preset id (a persona env fact the UI asserts — it never
 *    enters creation or the mount);
 * 2. the static row `environmentFacts` (boot-world compatibility input);
 * 3. the `config.rootPresetId` / `config.memberPresetId` ACTUAL mount
 *    (absent → the deployment default id);
 * 4. the hardcoded persona substrate (`{ presetId: 'dsh-agent-team',
 *    personaKind: 'standard' }` — never observed from any preset).
 *
 * In the shipped state all four coincidentally agree on `standard`, which is
 * why the disagreement is latent. The moment a complete preset (e.g. the
 * web bundle's `minimal`) is actually mounted, (4) still evaluates
 * `standard` at bind time → a FALSE OPEN of the §13.5 complete-persona
 * conflict.
 *
 * The resolver collapses the four into ONE plan: the actual mount authority
 * (`config.rootPresetId` / `config.memberPresetId`, absent → the deployment
 * default id) plus the OBSERVED persona kind of the mounted ROOT preset AND
 * the mounted MEMBER preset (the review fix F5 — the config allows
 * `rootPresetId != memberPresetId`, and the member preset's actual persona is
 * observed too, not inherited from the root: a template whose requirement
 * names the member persona is checked against the MEMBER observation, R8).
 * The bind-time persona slot still uses the ROOT observation (Architecture
 * §13.1: members inherit the root's bind substrate); the MEMBER observation
 * exists for the requirement authority (the template/instance boundary).
 * Every consumer (preflight, the compatibility engine, the bind-time
 * persona, the UI projection) reads the SAME plan — "preflight /
 * compatibility must consume the same plan" (plan §C.2).
 *
 * Pure module: no I/O, no live Agent, no `node:` builtins. The mount
 * authority + the persona-kind observation are injected ports; the resolver
 * is a frozen data assembly. The kind probe is ASYNC (the real production
 * observer reads the DSH public preset seam — `compositionInventory()` +
 * `readDocument()` — which are remote reads, the review fix F14); when the
 * root and the member share one preset id the probe runs exactly ONCE and
 * both plan entries carry the same observation.
 * @module @dsh-agent-team/runtime/agent-setup/preset/substrate-resolver
 */

import { deepFreeze, teamContractError } from '../../../contracts/src/index.js'
import { type ObservedPersonaKind } from './types.js'

/**
 * The source of a persona-kind observation (provenance, plan §C.2).
 * Provenance only — never a fingerprint input.
 */
export const PERSONA_OBSERVATION_SOURCES = {
  /** The DSH effective composition (the plugin-inventory live rows). */
  effectiveComposition: 'effective-composition',
  /** The static preset composition text (the readDocument + parser fallback). */
  compositionText: 'composition-text',
  /** No source was available (the observation is `unresolved`). */
  none: 'none',
} as const

/** One of the closed persona-observation sources. */
export type PersonaObservationSource = (typeof PERSONA_OBSERVATION_SOURCES)[keyof typeof PERSONA_OBSERVATION_SOURCES]

/** The provenance of one observed persona kind. */
export interface PersonaKindObservation {
  /** The resolved observed kind (the four-state, including `unresolved`). */
  readonly kind: ObservedPersonaKind
  /** The seam that produced the observation. */
  readonly source: PersonaObservationSource
  /** Optional structured diagnostic (e.g. the failure that left it `unresolved`). */
  readonly reason?: string
}

/**
 * One plan entry: the actual preset id the role WILL mount + the OBSERVED
 * persona kind of that preset (the review fix F5 — per-role observations,
 * not a single root-only kind).
 */
export interface RuntimeSubstratePlanEntry {
  /** The actual preset id this role mounts (the mount authority, plan §C.1). */
  readonly presetId: string
  /** The observed persona kind of the mounted preset (four-state, §C.3). */
  readonly persona: PersonaKindObservation
}

/**
 * The ONE runtime substrate plan (plan §C.2, review fix F5): the actual
 * mount authority of BOTH roles + the observed persona kind of EACH mounted
 * preset.
 *
 * - `root` — the root preset (`config.rootPresetId ?? deployment default`)
 *   and its observed persona. The bind-time persona slot (Architecture
 *   §13.1: members inherit the root's bind substrate) reads THIS entry;
 * - `member` — the member preset (`config.memberPresetId ?? deployment
 *   default ?? root`) and ITS OWN observed persona. The requirement
 *   authority (the template/instance boundary) checks member-template
 *   persona requirements against THIS entry (R8: `root=standard /
 *   member=minimal` — the member requirement uses the member's actual
 *   observation, not the root's).
 *
 * When both roles mount the same preset id the plan carries one observation
 * for both (the probe runs once).
 */
export interface RuntimeSubstratePlan {
  readonly root: RuntimeSubstratePlanEntry
  readonly member: RuntimeSubstratePlanEntry
}

/** The injected inputs of the resolver (the mount authority + the kind probe). */
export interface ResolveRuntimeSubstrateArgs {
  /** `config.rootPresetId` (absent = the deployment default). */
  readonly rootPresetId: string | undefined
  /** `config.memberPresetId` (absent = the deployment default). */
  readonly memberPresetId: string | undefined
  /** The deployment default preset id (the upstream registry `defaultId`). */
  readonly deploymentDefaultPresetId: string | undefined
  /**
   * Observe the persona kind of one mounted preset. A TYPED host/probe
   * failure resolves to `unresolved` (never a kind guess, never a throw —
   * the plan §C.3 fail-closed observation). ASYNC: the production observer
   * reads the DSH public preset seam (remote reads, review fix F14).
   */
  readonly observePersonaKind: (presetId: string) => PersonaKindObservation | Promise<PersonaKindObservation>
}

/**
 * Resolve the ONE runtime substrate plan (plan §C.2, review fix F5): the
 * actual preset ids of BOTH roles + the observed persona kind of EACH.
 *
 * The probe is memoized per preset id: when the root and the member share
 * one preset id the seam is read exactly once and both plan entries carry
 * the same observation.
 *
 * @param args - the injected mount authority + the persona-kind probe.
 * @returns the frozen plan (per-role preset ids + per-role persona observations).
 * @throws `MALFORMED_DTO` when there is NO root preset authority (the config
 *   id is absent and no deployment default was provided).
 */
export async function resolveRuntimeSubstrate(args: ResolveRuntimeSubstrateArgs): Promise<RuntimeSubstratePlan> {
  if (args.rootPresetId === undefined && args.deploymentDefaultPresetId === undefined) {
    throw teamContractError(
      'MALFORMED_DTO',
      'no root preset authority (config.rootPresetId absent and no deployment default)',
      { field: 'rootPresetId', problem: 'no root preset authority' },
    )
  }
  const rootPresetId = (args.rootPresetId ?? args.deploymentDefaultPresetId) as string
  // Members inherit the root preset unless a distinct member id is configured
  // (Architecture §13.1: no per-member selector — the member id is the config
  // override, defaulting to the root's deployment default, then the root id).
  const memberPresetId = args.memberPresetId ?? args.deploymentDefaultPresetId ?? rootPresetId
  // Memoize per preset id: one shared id (the common case) probes exactly
  // once. The IN-FLIGHT promise is cached (not the resolved observation) so
  // concurrent observes of the same id share one probe — the root and the
  // member resolve in parallel below.
  const probeCache = new Map<string, Promise<PersonaKindObservation>>()
  function observe(presetId: string): Promise<PersonaKindObservation> {
    let probe = probeCache.get(presetId)
    if (probe === undefined) {
      probe = Promise.resolve(args.observePersonaKind(presetId))
      probeCache.set(presetId, probe)
    }
    return probe
  }
  const [rootObservation, memberObservation] = await Promise.all([observe(rootPresetId), observe(memberPresetId)])
  const rootPersona = embedObservation(rootObservation)
  const plan: RuntimeSubstratePlan = {
    root: {
      presetId: rootPresetId,
      persona: rootPersona,
    },
    member: {
      presetId: memberPresetId,
      // The SAME id probes once: both entries carry the identical observation
      // (the same frozen object, not a copy).
      persona: rootPresetId === memberPresetId ? rootPersona : embedObservation(memberObservation),
    },
  }
  return deepFreeze(plan)
}

/**
 * Embed one observation into the plan (the frozen copy). Omit `reason`
 * entirely when it is undefined — a present-but-undefined field is not
 * lossless JSON, and the frozen plan must round-trip.
 */
function embedObservation(observation: PersonaKindObservation): PersonaKindObservation {
  return deepFreeze({
    kind: observation.kind,
    source: observation.source,
    ...(observation.reason !== undefined ? { reason: observation.reason } : {}),
  })
}
