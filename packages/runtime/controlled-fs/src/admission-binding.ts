/**
 * A5 integration wiring (Scope-2) — the PR2-admission GATED consumption face
 * of the ControlledFs lane. Landing point of the G-d Lane-B C1 wiring notes
 * (INTEGRATION-PLAN §4; Lane B README §4; INTERFACES-v1 C-FS + C-ADM).
 *
 * THE WIRING LAWS (each pinned, RED-first, by
 * `packages/runtime/test/a5w-integration-wiring.test.ts`):
 *
 *  1. UNBOUND = TYPED REFUSAL. This face NEVER inherits the lane's pre-freeze
 *     `NO_RECHECK` default (that deviation is lane-internal history, README
 *     §2.1). A gated lane constructed without a PR2 admission binding answers
 *     every operation with the typed C-FS `denied` refusal carrying
 *     `admission-unbound`, on the frozen §5 code the lane's own
 *     recheck-refused mapping uses — no new §5 code, no second authorization
 *     fact, no silence.
 *
 *  2. FINGERPRINT BINDING (C1). `bindAdmissionRecheck` pins the PR1 canonical
 *     `parametersFingerprint` of THIS call — the same one the Guard saw
 *     pre-call (the PR1 fingerprint law re-attached at the exec-time seam).
 *     The recheck presents the BOUND fingerprint to the port; an intent whose
 *     presented fingerprint diverges from the bound one (or is null) is
 *     refused with `fingerprint-divergence` BEFORE the port is consulted: a
 *     re-resolved definition can never exec under another call's fingerprint.
 *
 *  3. SUBTREE LAW (C1). When the wiring consumer injects the
 *     authority-envelope `SubtreeContains`, directory-effect coverage runs
 *     through it (the planes' own containment, not a lane guess). Absent the
 *     injection the lane keeps its deliberately narrower identity+prefix rule
 *     — wiring a consumer changes nothing for consumers that do not wire.
 *
 *  4. NO ARBITRARY-TREE PUBLICATION (C1). Until an `OpenAtPort` (openat2
 *     RESOLVE_BENEATH / RESOLVE_IN_ROOT on a trusted dir FD) lands, the
 *     fully-untrusted mutable-tree profile stays unpublished as Supported —
 *     the lane's node fallback carries a documented residual window (README
 *     §2.3). `ARBITRARY_TREE_PROFILE_PUBLISHED` is pinned false, this module
 *     exports no OpenAtPort implementation, and PR8 matrix rows update only
 *     via their pending_update channel.
 *
 * Boundary (G-g): this module makes NO claim about silent-subscription
 * channels; that exclusion gate remains G-g OPEN (PENDING-GATES). Nothing
 * here is a whole-chain verification claim — fixture-level only, per the
 * INTERFACES integration rule.
 *
 * @module packages/runtime/controlled-fs/src/admission-binding
 */

import type { SubtreeContains } from '../../../domain/authority-envelope/src/index.js'

import { createControlledFsLane, type ControlledFsLane, type ControlledFsLaneConfig } from './controlled-fs.js'
import type { AdmissionRecheck } from './open-at-exec.js'

/**
 * The read-only PR2-admission port this face consumes. The consumer adapter
 * maps it onto the frozen admission kernel (e.g. `AdmissionKernel`'s
 * execution-edge validation); this module never re-implements admission and
 * never mints, consumes or widens anything — it re-ASKS and obeys.
 */
export interface FsAdmissionPort {
  /** Re-ask admission for the exact call about to effect, under the fingerprint the binding pinned. */
  readonly recheckCall: (intent: {
    readonly op: string
    readonly canonicalLocator: string
    readonly parametersFingerprint: string
  }) => Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: string }>
}

/** One call's admission binding: the port plus the PR1 canonical fingerprint of THIS call. */
export interface AdmissionBoundFsCall {
  readonly admission: FsAdmissionPort
  /**
   * C1: the canonical `parametersFingerprint` the Guard saw PRE-CALL for this
   * exact invocation. The exec-time recheck presents this value — never a
   * value re-derived from the re-resolved definition or the presented grant.
   */
  readonly parametersFingerprint: string
}

/** The wiring config: the lane config minus its pre-freeze recheck default. */
export interface AdmissionGatedControlledFsConfig extends Omit<ControlledFsLaneConfig, 'recheck'> {
  /** Absent ⇒ every operation is a typed `admission-unbound` refusal (law 1). */
  readonly admission?: AdmissionBoundFsCall
  /** C1 subtree law injection; absent keeps the narrow lane rule (law 3). */
  readonly subtreeContains?: SubtreeContains
}

/**
 * The refusal side of law 1: an unbound gated lane's exec-time recheck. It
 * refuses, by name, so the ledger line and the typed error both say WHY (no
 * silence — the C-FS triad's `denied` class rides the lane's own mapping).
 */
export const UNBOUND_ADMISSION_RECHECK: AdmissionRecheck = Object.freeze({
  recheck: async () => ({ ok: false as const, reason: 'admission-unbound' }),
})

/**
 * Bind the exec-time recheck to one call's admission (law 2). The returned
 * recheck: (a) refuses `fingerprint-divergence` when the presented
 * fingerprint is not the bound one — before consulting the port; (b) presents
 * the BOUND fingerprint verbatim when consulting it.
 */
export function bindAdmissionRecheck(bound: AdmissionBoundFsCall): AdmissionRecheck {
  const pinned = bound.parametersFingerprint
  if (typeof pinned !== 'string' || pinned.length === 0) {
    throw new TypeError('admission-binding: the bound parametersFingerprint must be a non-empty string (law 2)')
  }
  return Object.freeze({
    recheck: async (intent: {
      readonly op: string
      readonly canonicalLocator: string
      readonly parametersFingerprint: string | null
    }) => {
      if (intent.parametersFingerprint === null || intent.parametersFingerprint !== pinned) {
        return { ok: false as const, reason: 'fingerprint-divergence' }
      }
      return bound.admission.recheckCall({
        op: intent.op,
        canonicalLocator: intent.canonicalLocator,
        parametersFingerprint: pinned,
      })
    },
  })
}

/**
 * The gated lane factory — the ONLY sanctioned wiring entry. Unbound means
 * refused, never `NO_RECHECK`-passed (law 1); bound means the C1 fingerprint
 * law is enforced at the seam (law 2); `subtreeContains` injection routes the
 * subtree decision through the planes (law 3).
 */
export function createAdmissionGatedControlledFs(config: AdmissionGatedControlledFsConfig): ControlledFsLane {
  const { admission, subtreeContains, ...laneConfig } = config
  const recheck = admission === undefined ? UNBOUND_ADMISSION_RECHECK : bindAdmissionRecheck(admission)
  return createControlledFsLane({
    ...laneConfig,
    recheck,
    ...(subtreeContains === undefined ? {} : { subtreeContains }),
  })
}

/**
 * Law 4 pin: the arbitrary mutable-tree profile is NOT published as Supported
 * while `OpenAtPort` (the openat2 native helper) is unlanded. Flipping this
 * requires the native helper AND the PR8 matrix publication round — neither
 * is a code convenience in this wiring slice.
 */
export const ARBITRARY_TREE_PROFILE_PUBLISHED = false

// ═══════════════════════════════════════════════════════════════════════════
// THE PRODUCTION PROVIDER (PR2/PR3 production-assembly round, P-A writer)
// ═══════════════════════════════════════════════════════════════════════════
//
// What the accepted C-04/05 + C-08 evidence kits demonstrated by hand —
// `gatedLane(flow)` assembling a fresh gated lane per admitted call from the
// fixture's realm/instance/clock/generation/consumed constants — promoted to
// a production provider: the per-call constants become READER ARMS the host
// wires once at assembly (the same readers the admission assembly runs on:
// `authorityGeneration`, the wall clock, the grant-consumption view). Every
// law above this marker stands byte-unchanged: this provider only ever goes
// through `createAdmissionGatedControlledFs` (the only sanctioned entry — it
// cannot bypass law 1, it cannot bypass law 2, it carries no lane guess
// around law 3, and it publishes nothing around law 4). The host-side
// contract lives at `dev/agent-workflow/evidence/alpha5/prod/pa-CONTRACT.md`.

/** Construction arms of {@link createProductionControlledFsProvider}. */
export interface ProductionControlledFsProviderConfig {
  /** The ONE Realm the provider's instances belong to (every gated lane is
   *  realm-checked by the lane itself; the provider refuses construction on
   *  an instance naming another realm instead of publishing a lane that
   *  would refuse at first use). */
  readonly realmId: string
  /** The host-registered instance roots (the lane's `ControlledFsInstance`
   *  shape — derived from the lane config type, never a second spelling). */
  readonly instances: ControlledFsLaneConfig['instances']
  /** The host wall clock (the lane gates its own reads for finiteness). */
  readonly clock: () => number
  /** The SAME generation reader the admission assembly/Guard publish with;
   *  read PER `gateCall` (a lane carries one call's generation, law of the
   *  frozen `ControlledFsLaneConfig`). */
  readonly authorityGeneration: () => number
  /** The grant-consumption view — wire `assembly.consumed` (the one-shot
   *  law's read side; there is no second ledger). */
  readonly consumed: NonNullable<ControlledFsLaneConfig['consumed']>
  /** C1 subtree law injection (law 3 — same reader the admission assembly
   *  projects through, so the two faces never disagree on containment). */
  readonly subtreeContains?: SubtreeContains
  /** The observation policy seam (withheld-is-not-absent). */
  readonly visibility?: NonNullable<ControlledFsLaneConfig['visibility']>
}

export interface ProductionControlledFsProvider {
  readonly realmId: string
  /** The registered instance ids (assembly-time self-check for the host). */
  readonly instanceIds: readonly string[]
  /**
   * THE per-call seam: one admitted call hands its `AdmissionBoundFsCall`
   * (the PR2 `createFsAdmissionPort` + the grant's canonical fingerprint)
   * and gets the gated lane for exactly that call. One gated C-FS operation
   * consumes the one-shot grant (the lane's revalidate+recheck law) — the
   * next controlled operation is the next admitted call.
   */
  readonly gateCall: (bound: AdmissionBoundFsCall) => ControlledFsLane
}

/**
 * The C-FS production provider class: assembly-time registration + per-call
 * gated-lane construction. Construction violations are `TypeError`s (the
 * same constructor-invariant style as `bindAdmissionRecheck`: a provider
 * built on a foreign realm or an empty root set can only mislead, so it is
 * never built).
 */
export function createProductionControlledFsProvider(
  config: ProductionControlledFsProviderConfig,
): ProductionControlledFsProvider {
  if (typeof config.realmId !== 'string' || config.realmId.length === 0) {
    throw new TypeError('production controlled-fs provider: realmId must be a non-empty string')
  }
  if (typeof config.clock !== 'function' || typeof config.authorityGeneration !== 'function' || typeof config.consumed !== 'function') {
    throw new TypeError('production controlled-fs provider: clock, authorityGeneration and consumed are required readers (the lane owns no clock, no generation, no ledger)')
  }
  const instances = config.instances
  if (!Array.isArray(instances) || instances.length === 0) {
    throw new TypeError('production controlled-fs provider: at least one ControlledFsInstance must be registered (a provider with no roots gates nothing)')
  }
  const seenFs = new Set<string>()
  for (const instance of instances) {
    if (typeof instance.fs !== 'string' || instance.fs.length === 0) {
      throw new TypeError('production controlled-fs provider: every instance needs a non-empty fs id')
    }
    if (seenFs.has(instance.fs)) {
      throw new TypeError(`production controlled-fs provider: instance fs id "${instance.fs}" is registered twice (one root per id — a duplicate registration is an ambiguous root, not a wider one)`)
    }
    seenFs.add(instance.fs)
    if (typeof instance.rootDir !== 'string' || instance.rootDir.length === 0) {
      throw new TypeError(`production controlled-fs provider: instance "${instance.fs}" needs a non-empty rootDir`)
    }
    if (instance.realmId !== config.realmId) {
      throw new TypeError(`production controlled-fs provider: instance "${instance.fs}" names realm "${instance.realmId}" but the provider is built for realm "${config.realmId}" (Realms never confuse each other)`)
    }
  }
  return Object.freeze({
    realmId: config.realmId,
    instanceIds: Object.freeze([...seenFs]),
    gateCall: (bound: AdmissionBoundFsCall): ControlledFsLane => createAdmissionGatedControlledFs({
      instances,
      now: config.clock,
      currentAuthorityGeneration: config.authorityGeneration(),
      consumed: config.consumed,
      ...(config.visibility === undefined ? {} : { visibility: config.visibility }),
      ...(config.subtreeContains === undefined ? {} : { subtreeContains: config.subtreeContains }),
      admission: bound,
    }),
  })
}
