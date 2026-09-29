/**
 * pre-alpha3 PR-C — the RuntimeSubstrateResolver (plan §C.2): the SINGLE
 * authority for what the runtime WILL mount + the observed persona kind.
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
 * default id) plus the OBSERVED persona kind of the mounted ROOT preset
 * (members inherit the root preset + kind, Architecture §13.1). Every
 * consumer (preflight, the compatibility engine, the bind-time persona, the
 * UI projection) reads the SAME plan — "preflight / compatibility must
 * consume the same plan" (plan §C.2).
 *
 * Pure module: no I/O, no live Agent, no `node:` builtins. The mount
 * authority + the persona-kind observation are injected ports; the resolver
 * is a frozen data assembly.
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
 * The ONE runtime substrate plan (plan §C.2): the actual mount authority +
 * the observed persona kind of the mounted ROOT preset.
 */
export interface RuntimeSubstratePlan {
  /** The actual root preset id (`config.rootPresetId ?? deployment default`). */
  readonly rootPresetId: string
  /** The actual member preset id (`config.memberPresetId ?? deployment default ?? root`). */
  readonly memberPresetId: string
  /** The observed persona kind of the mounted ROOT preset (members inherit it). */
  readonly personaKind: ObservedPersonaKind
  /** The observation provenance (source + optional reason). */
  readonly personaObservation: { readonly source: PersonaObservationSource; readonly reason?: string }
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
   * the plan §C.3 fail-closed observation).
   */
  readonly observePersonaKind: (presetId: string) => PersonaKindObservation
}

/**
 * Resolve the ONE runtime substrate plan (plan §C.2).
 * @param args - the injected mount authority + the persona-kind probe.
 * @returns the frozen plan (the actual preset ids + the observed ROOT kind).
 * @throws `MALFORMED_DTO` when there is NO root preset authority (the config
 *   id is absent and no deployment default was provided).
 */
export function resolveRuntimeSubstrate(args: ResolveRuntimeSubstrateArgs): RuntimeSubstratePlan {
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
  const observation = args.observePersonaKind(rootPresetId)
  const plan: RuntimeSubstratePlan = {
    rootPresetId,
    memberPresetId,
    personaKind: observation.kind,
    // Omit `reason` entirely when it is undefined (a present-but-undefined
    // field is not lossless JSON — the frozen plan must round-trip).
    personaObservation: {
      source: observation.source,
      ...(observation.reason !== undefined ? { reason: observation.reason } : {}),
    },
  }
  return deepFreeze(plan)
}
