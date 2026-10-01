/**
 * PR4 (pre-alpha3 permission lifecycle) — the production PERMISSION PLANE
 * assembly (implementation plan "PR4: Grant/Revoke/Lifecycle", "production
 * entry wiring"; ADR §2/§3/§8; parent ruling 2026-10-05: the canonical path
 * must be REACHABLE and FUNCTIONAL from the shipped root, not dormant).
 *
 * This module owns the ASSEMBLY of the PR4 lane at the single production
 * assembly point (`./root.js`), and nothing else:
 *
 *   - {@link createMemberLifecycleReader} — the ADR §8 execution facts, read
 *     straight off the durable `member-instances` rows (the same repository
 *     the lifecycle service commits through; `undefined` for an identity with
 *     no row, which the lane treats as its OWN state, never as RUNNING);
 *   - {@link createPermissionGovernanceLane} — the PR3 governance service's
 *     `permissionLane` deps (the persistence-only PR1 overlay port + the
 *     runtime containment predicate the subtree matcher REQUIRES);
 *   - {@link createTeamPermissionLanes} — the two PR4 lanes (the write
 *     entries into `mutatePermission` + the decision read plane).
 *
 * Two asymmetries of this assembly are deliberate and both are the merged
 * design, not an implementation shortcut:
 *
 * 1. **CONTAINMENT IS THE RUNTIME'S.** A `subtree` matcher is judged ONLY by
 *    the pinned public `FileSystem.contains` over the SAME provider that
 *    canonicalized the keys (plan §9.4: never `startsWith`, never key
 *    parsing, no consumer-side path arithmetic, no cache). The host entry
 *    therefore injects `fsContainsKeys`, built over its LAZY strict
 *    `ctx.get('fs')` accessor, and this module hands that predicate to the
 *    mutation plane as the kernel's whole-matcher `subtreeContains`. A fault
 *    of that predicate is reported as the kernel's OWN typed
 *    `PERMISSION_EFFECT_CONTEXT_UNAVAILABLE` — never as a `false` verdict
 *    (an fs fault must not silently relabel a covered region as uncovered),
 *    and never swallowed (unknown coverage is never labeled expansion or
 *    tightening — the round-2 PR3 ruling). When no predicate is injected the
 *    dep is simply ABSENT, and the merged PR3 gate refuses a subtree
 *    mutation typed instead of guessing.
 *
 * 2. **THE STATIC FACTS OF THE MUTATION PLANE ARE DERIVED, NEVER INVENTED.**
 *    The kernel compares a Leader's expansion against the LOWER static
 *    layers expressed in the SAME canonical identity space as the overlay
 *    rules; turning a blueprint PATH into a canonical key is the fs
 *    provider's job (A2), not this module's. The production entry therefore
 *    builds the facts documents through {@link createPermissionAuthorityFacts}
 *    (below): ONE frozen, identity-bound build at the root's post-boot async
 *    boundary — every template rule canonicalized by the SAME A2 provider —
 *    consumed SYNCHRONOUSLY by the pure kernel, which abstains (UNKNOWN /
 *    zero envelope → typed refusal, never a stale answer) when the bound
 *    snapshot drifts. When NO caller injects a provider (test/legacy roots)
 *    the reader stays ABSENT (= UNKNOWN facts) and the regions that depend
 *    on lower facts refuse typed (`PERMISSION_EFFECT_CONTEXT_
 *    UNAVAILABLE`) — the sanctioned posture for a round whose facts are
 *    unavailable. This is the MUTATION plane's authority check ONLY: the
 *    DECISION plane (the lane below) never runs on absent facts — its static
 *    layers arrive freshly canonicalized by the pre-execute decision site
 *    itself (the A3/A5 canonicalization that produced the operation), which
 *    is why configured exact / subtree / exec decisions are reachable and
 *    functional in production.
 *
 * Purity: no `node:` builtins, no I/O, no clock. Everything durable arrives
 * through the injected ports.
 *
 * @module @dsh-agent-team/runtime/src/plugin/permission-plane
 */

import {
  parsePermissionMutationEnvelope,
  parsePermissionResourceText,
  parsePermissionStaticLayerFacts,
  permissionEffectiveAnswer,
  PermissionMutationError,
} from '../../governance/index.js'
import { classifyPermissionOperationClass } from '../../governance/permission-mutation.js'
import type {
  PermissionMutationEnvelope,
  PermissionStaticLayerFacts,
} from '../../governance/index.js'
import type { PERMISSION_MUTATION_ERROR_CODES } from '../../governance/index.js'
import type { GovernanceMutationService, GovernancePermissionLaneDeps } from '../../governance/types.js'
import { LEADER_INSTANCE_ID } from '../../../contracts/src/index.js'
import type { MemberLifecycleState } from '../../../contracts/src/index.js'
import type { TemplatePermissionPolicy } from '../../../domain/blueprint/src/index.js'
import { createPermissionDecisionLane, createPermissionLifecycleMutationLane } from '../../permission-lifecycle/index.js'
import type {
  MemberLifecycleReaderPort,
  PermissionDecisionLane,
  PermissionLifecycleMutationLane,
  PermissionLifecycleRestorePort,
} from '../../permission-lifecycle/index.js'
import type { PermissionOverlayRepositoryPort } from '../../permission-governance/port.js'

/** The durable member-instance read surface the lifecycle facts come from. */
export interface MemberInstanceRowReader {
  get(rootSessionId: string, instanceId: string): { readonly lifecycle: MemberLifecycleState } | undefined
}

/** The durable TeamSession read surface the LEADER liveness fact comes from. */
export interface TeamSessionRowReader {
  get(rootSessionId: string): unknown
}

/** The whole-matcher containment predicate over two canonical keys. */
export type CanonicalKeyContains = (parentKey: string, childKey: string) => boolean

/** The PR4 plane as the production root exposes it. */
export interface TeamPermissionPlane {
  /** The write entries (grant / revoke / restore) into the ONE authority. */
  readonly mutation: PermissionLifecycleMutationLane
  /** The execution read plane (the ADR §8 gate + the merged decision lanes). */
  readonly decisions: PermissionDecisionLane
}

/**
 * The ADR §8 lifecycle reader over the durable member rows. A read that
 * FAULTS propagates (the decision lane fails closed on a throwing port —
 * a storage fault is never laundered into "no row").
 *
 * The LEADER exception (PR4 round 3, BLOCK-4): v2 carries NO leader member
 * row — the real host boot NEVER seeds one (only fixture worlds do), and
 * the artifact identity port confirms the doctrine (`host.ts lifecycleOf`:
 * the leader position resolves to 'leader' with no row). Reading member
 * rows blindly therefore answers "unknown execution state" for every Leader
 * tool call. This reader reuses the ONE existing authority semantics for
 * leader liveness in this codebase — `control/service.ts` (leader live ⇔ the
 * durable TeamSession row exists; the member-row lifecycle check EXPLICITLY
 * excludes {@link LEADER_INSTANCE_ID}) — and nothing else: the leader answers
 * `RUNNING` exactly while its TeamSession row exists, `undefined` (no state —
 * the lane's own typed refusal) when it does not. NO lifecycle field is
 * fabricated and NO member-row semantics change: with the second argument
 * absent the reader is byte-identical to its pre-PR4 shape.
 * @param rows - the `member-instances` repository read surface.
 * @param teamSessions - the `team-sessions` read surface enabling the
 *   leader-aware branch (absent = pre-PR4 member-rows-only reader).
 */
export function createMemberLifecycleReader(
  rows: MemberInstanceRowReader,
  teamSessions?: TeamSessionRowReader,
): MemberLifecycleReaderPort {
  return {
    readLifecycle: (teamSessionId, memberInstanceId) => {
      if (teamSessions !== undefined && memberInstanceId === LEADER_INSTANCE_ID) {
        // The TeamSession row IS the leader's liveness (control/service.ts
        // authority semantics — no second source, no fabricated state).
        return teamSessions.get(teamSessionId) !== undefined ? 'RUNNING' : undefined
      }
      return rows.get(teamSessionId, memberInstanceId)?.lifecycle
    },
  }
}

/**
 * The `permissionLane` deps of {@link createGovernanceMutationService} — the
 * ONE durable write path of the permission plane (PR3). Absent `overlay`
 * there is no lane at all and `mutatePermission` refuses
 * `PERMISSION_MUTATION_NOT_CONFIGURED` (fail closed, zero write).
 * @param deps.overlay - the PR1 persistence-only port (`append`/`latest`/`history`).
 * @param deps.fsContainsKeys - the runtime containment predicate (see the
 *   module doc, asymmetry 1).
 * @param deps.staticLayers - the lower-layer facts reader; ABSENT by default
 *   (see the module doc, asymmetry 2; production injects the document built
 *   by {@link createPermissionAuthorityFacts}).
 * @param deps.permissionEnvelope - the bound §6 expansion ceiling for the
 *   Leader; forwarded VERBATIM (this module grants nothing — absent = the
 *   service's zero-authority default).
 */
export function createPermissionGovernanceLane(deps: {
  readonly overlay: PermissionOverlayRepositoryPort
  readonly fsContainsKeys?: CanonicalKeyContains
  readonly staticLayers?: GovernancePermissionLaneDeps['staticLayers']
  readonly permissionEnvelope?: GovernancePermissionLaneDeps['permissionEnvelope']
}): GovernancePermissionLaneDeps {
  const { overlay, fsContainsKeys, staticLayers, permissionEnvelope } = deps
  return {
    overlay,
    ...(staticLayers === undefined ? {} : { staticLayers }),
    ...(permissionEnvelope === undefined ? {} : { permissionEnvelope }),
    ...(fsContainsKeys === undefined
      ? {}
      : {
          subtreeContains: (root: string, child: string): boolean => {
            try {
              return fsContainsKeys(root, child)
            } catch (error: unknown) {
              // The containment authority faulted: this is UNKNOWN coverage,
              // not a negative verdict — the kernel's own typed refusal is
              // the only honest channel (zero write, never a label).
              throw new PermissionMutationError(
                'PERMISSION_EFFECT_CONTEXT_UNAVAILABLE' as (typeof PERMISSION_MUTATION_ERROR_CODES)['EFFECT_CONTEXT_UNAVAILABLE'],
                `the runtime containment predicate could not judge ${JSON.stringify(root)} vs ${JSON.stringify(child)}: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              )
            }
          },
        }),
  }
}

/**
 * The two PR4 lanes over the already-assembled authority + lifecycle path.
 * @param deps.governance - the production `GovernanceMutationService`.
 * @param deps.overlay - the same PR1 port the governance lane appends through.
 * @param deps.members - the lifecycle reader ({@link createMemberLifecycleReader}).
 * @param deps.lifecycle - the restore port (the EXISTING single lifecycle
 *   path; absent = `restore` refuses typed `…_RESTORE_UNCONFIGURED`).
 */
export function createTeamPermissionLanes(deps: {
  readonly governance: GovernanceMutationService
  readonly overlay: PermissionOverlayRepositoryPort
  readonly members: MemberLifecycleReaderPort
  readonly lifecycle?: PermissionLifecycleRestorePort
}): TeamPermissionPlane {
  const { governance, overlay, members, lifecycle } = deps
  return {
    mutation: createPermissionLifecycleMutationLane({
      governance,
      overlay,
      members,
      ...(lifecycle === undefined ? {} : { lifecycle }),
    }),
    decisions: createPermissionDecisionLane({
      overlay,
      members,
      // The carrier grammar is the KERNEL's parser (never a second one).
      decodeResource: parsePermissionResourceText,
      // The exec (fingerprint) plane is the kernel's own pure effective
      // answer — the algebra that authorized the snapshot being read.
      effectiveAnswer: (query) => permissionEffectiveAnswer(query),
    }),
  }
}

// ──────────────────────────────────────────────────────────────────────────
// PR4 round 3 (BLOCK-1) — the production authority-facts authority.
//
// The ONE place where blueprint permission POLICIES become the kernel's
// canonical facts documents. The mutation kernel compares a Leader's
// expansion against LOWER static layers expressed in the SAME opaque key
// space as the overlay rules; a blueprint carries PATHS, and only the fs
// provider (A2) may turn a path into a canonical key. This builder therefore
// runs at the root's post-boot ASYNC boundary (the same one the artifact
// authority's ledger rebuild uses), canonicalizes EVERY rule of EVERY
// template it is handed through the injected provider, and FREEZES the two
// documents the pure kernel consumes synchronously afterwards:
//
//   - `staticLayers(team, member)` — the target member's declared template
//     layer (leader position → the leader template's own layer; a template
//     with no permissions block → the DECLARED-NONE `{ layers: [] }`, which
//     is HONEST: that template declares no static lane; a member with no
//     row → `undefined` = UNKNOWN, the kernel's typed-refusal state);
//   - `permissionEnvelope(team)` — the Leader's expansion ceiling DERIVED
//     from its own bound template policy: an ALLOW-lane file rule admits a
//     grant up to `allow`, an ASK-lane file rule up to `ask`, the deny lane
//     grants nothing (tightenings need no envelope, ADR §6), and SHELL /
//     `any` rules map to NO envelope rule — the envelope grammar accepts
//     only exact/subtree (fs) and fingerprint (exec) matchers, and a
//     blueprint policy carries no fingerprint, so Leader exec-class
//     expansion has NO authority from the grammar and refuses typed
//     (`PERMISSION_ENVELOPE_EXPANSION_DENIED`) until a blueprint round
//     carries §6 exec envelopes. This is NEVER a widening: the Leader can
//     only expand inside what its own bound template allows.
//
// Fail-closed rules of the build: a canonicalization FAILURE (provider
// fault, malformed result) marks the WHOLE document UNKNOWN — a partially
// canonicalized layer is a confidently wrong authority and is never shipped.
// A document with NO permissions-bearing template performs ZERO fs calls
// (the no-permissions world gains zero new startup failures). Every sync
// read RE-VERIFIES the snapshot identity it was built against; drift makes
// the readers abstain (UNKNOWN / zero envelope) — never serve stale facts.
// ──────────────────────────────────────────────────────────────────────────

/** The snapshot identity the derived documents are bound to. */
export interface PermissionFactsIdentity {
  readonly blueprintId: string
  readonly revision: string
  readonly contentHash: string
}

/** The inputs of {@link createPermissionAuthorityFacts} (all injected). */
export interface PermissionAuthorityFactsDeps {
  /** Every template id of the bound snapshot (leader included). */
  readonly templateIds: readonly string[]
  /** The template's permission policy (`undefined` = declares none). */
  readonly policyOf: (templateId: string) => TemplatePermissionPolicy | undefined
  /** The leader position's template id (from the bound snapshot). */
  readonly leaderTemplateId: () => string
  /** The member row's template id (`undefined` = no durable row). */
  readonly memberTemplateId: (teamSessionId: string, memberInstanceId: string) => string | undefined
  /** The A2 canonicalizer (the row's fs provider; the ONLY legal key source). */
  readonly canonicalize: (path: string) => Promise<string>
  /** The CURRENT bound-snapshot identity (re-verified on every sync read). */
  readonly identity: () => PermissionFactsIdentity
}

/** The built authority: one async build, two sync kernel readers. */
export interface PermissionAuthorityFacts {
  /** The async build boundary (host: after `builtRoot.boot()`). Idempotent;
   *  a repeat REBUILDS from the current identity (a rebind re-canonicalizes). */
  refresh(): Promise<void>
  /** `true` while the last build succeeded against its bound identity. */
  readonly healthy: () => boolean
  readonly staticLayers: GovernancePermissionLaneDeps['staticLayers']
  readonly permissionEnvelope: GovernancePermissionLaneDeps['permissionEnvelope']
}

type FactsLayerRule = {
  readonly operationClass: string
  readonly matcher: { readonly kind: 'exact' | 'subtree' | 'any'; readonly resource?: string }
  readonly effect: 'allow' | 'ask' | 'deny'
}

interface BuiltDocuments {
  readonly bound: PermissionFactsIdentity
  /** templateId → its frozen canonical facts document (every declared lane). */
  readonly layersByTemplate: ReadonlyMap<string, PermissionStaticLayerFacts>
  readonly envelope: PermissionMutationEnvelope
  /** The leader template's own document (its member-facing facts too). */
  readonly leaderLayerFacts: PermissionStaticLayerFacts
}

const DECLARED_NONE: PermissionStaticLayerFacts = { layers: [] }

/**
 * Build the identity-bound authority documents (see the section header).
 * @param deps - the injected policy/identity/canonicalizer sources.
 */
export function createPermissionAuthorityFacts(deps: PermissionAuthorityFactsDeps): PermissionAuthorityFacts {
  let built: BuiltDocuments | undefined

  async function build(): Promise<void> {
    const bound = deps.identity()
    const layersByTemplate = new Map<string, PermissionStaticLayerFacts>()
    for (const templateId of deps.templateIds) {
      const policy = deps.policyOf(templateId)
      if (policy === undefined) {
        // Declares no static lane: the DECLARED-NONE document, no fs calls.
        layersByTemplate.set(templateId, DECLARED_NONE)
        continue
      }
      const rules: FactsLayerRule[] = []
      for (const lane of ['allow', 'ask', 'deny'] as const) {
        for (const rule of policy[lane]) {
          if (rule.resource.kind === 'any') {
            rules.push({ operationClass: rule.tool, matcher: { kind: 'any' }, effect: lane })
            continue
          }
          // A canonicalization fault throws → the WHOLE build fails closed
          // (never a partially canonicalized authority).
          const key = await deps.canonicalize(rule.resource.path)
          if (typeof key !== 'string' || key.length === 0) {
            throw new Error(
              `permission authority facts: the fs provider returned no canonical key for ${JSON.stringify(rule.resource.path)}`,
            )
          }
          rules.push({
            operationClass: rule.tool,
            matcher: { kind: rule.resource.kind, resource: key },
            effect: lane,
          })
        }
      }
      layersByTemplate.set(
        templateId,
        parsePermissionStaticLayerFacts({
          layers: [{ label: templateId, default: policy.default, rules }],
        }),
      )
    }
    // The Leader's expansion ceiling: its own bound ALLOW/ASK lanes, fs
    // class only (see the section header for the exec-class ruling).
    const leaderPolicy = deps.policyOf(deps.leaderTemplateId())
    const envelopeRules: {
      readonly operationClass: string
      readonly matcher: { readonly kind: 'exact' | 'subtree'; readonly resource: string }
      readonly maximumEffect: 'allow' | 'ask'
    }[] = []
    if (leaderPolicy !== undefined) {
      for (const [lane, maximumEffect] of [
        ['allow', 'allow'],
        ['ask', 'ask'],
      ] as const) {
        for (const rule of leaderPolicy[lane]) {
          if (rule.resource.kind === 'any') continue // no envelope matcher expresses `any`
          if (classifyPermissionOperationClass(rule.tool) !== 'fs') continue // exec: §6 carrier required
          const key = await deps.canonicalize(rule.resource.path)
          if (typeof key !== 'string' || key.length === 0) {
            throw new Error(
              `permission authority facts: the fs provider returned no canonical key for ${JSON.stringify(rule.resource.path)}`,
            )
          }
          envelopeRules.push({
            operationClass: rule.tool,
            matcher: { kind: rule.resource.kind, resource: key },
            maximumEffect,
          })
        }
      }
    }
    const leaderFacts = layersByTemplate.get(deps.leaderTemplateId()) ?? DECLARED_NONE
    built = parseBuiltDocuments({
      bound,
      layersByTemplate,
      envelope: parsePermissionMutationEnvelope({ rules: envelopeRules }),
      leaderLayerFacts: leaderFacts,
    })
  }

  function current(): BuiltDocuments | undefined {
    if (built === undefined) return undefined
    const now = deps.identity()
    const bound = built.bound
    if (
      now.blueprintId !== bound.blueprintId ||
      now.revision !== bound.revision ||
      now.contentHash !== bound.contentHash
    ) {
      // The bound snapshot moved under the documents: abstain, never serve
      // stale facts (the kernel's UNKNOWN / zero-envelope posture).
      return undefined
    }
    return built
  }

  return {
    async refresh() {
      await build()
    },
    healthy: () => current() !== undefined,
    staticLayers: (teamSessionId, memberInstanceId) => {
      const docs = current()
      if (docs === undefined) return undefined
      if (memberInstanceId === LEADER_INSTANCE_ID) return docs.leaderLayerFacts
      const templateId = deps.memberTemplateId(teamSessionId, memberInstanceId)
      if (templateId === undefined) return undefined // no row = UNKNOWN (never guessed)
      // A template OUTSIDE the bound snapshot has no declared facts here:
      // UNKNOWN (not DECLARED-NONE — the build never saw its lanes).
      return docs.layersByTemplate.get(templateId)
    },
    permissionEnvelope: (teamSessionId) => {
      const docs = current()
      if (docs === undefined) return { rules: [] }
      void teamSessionId
      return docs.envelope
    },
  }
}

/** Validate every derived document through the KERNEL's own parsers (a
 *  builder bug can only ever become a typed refusal downstream, never a
 *  malformed durable-adjacent document) and freeze the bundle. */
function parseBuiltDocuments(input: {
  bound: PermissionFactsIdentity
  layersByTemplate: ReadonlyMap<string, PermissionStaticLayerFacts>
  envelope: PermissionMutationEnvelope
  leaderLayerFacts: PermissionStaticLayerFacts
}): BuiltDocuments {
  const layersByTemplate = new Map<string, PermissionStaticLayerFacts>()
  for (const [templateId, facts] of input.layersByTemplate) {
    layersByTemplate.set(templateId, parsePermissionStaticLayerFacts(facts))
  }
  return {
    bound: input.bound,
    layersByTemplate,
    envelope: input.envelope,
    leaderLayerFacts: parsePermissionStaticLayerFacts(input.leaderLayerFacts),
  }
}
