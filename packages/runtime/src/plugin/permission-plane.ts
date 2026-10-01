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
 * 2. **THE STATIC FACTS AND THE §6 ENVELOPE OF THE MUTATION PLANE READ THE
 *    ADDRESSED TEAM'S OWN BOUND BLUEPRINT, ANCHORED AT THE TARGET'S
 *    WORKSPACE.** The kernel compares a Leader's expansion against the LOWER
 *    static layers and the §6 envelope, all expressed in the SAME canonical
 *    identity space as the overlay rules; turning a blueprint PATH into a
 *    canonical key is the fs provider's job (A2), not this module's. The
 *    production entry therefore builds them through
 *    {@link createPermissionAuthorityFacts} (below): every document is read
 *    through `resolveBlueprint(teamSessionId)` (the SAME three-case bound-
 *    Blueprint authority the team identity binds to — a bound ref NEVER falls
 *    back to the row anchor), the file paths canonicalized against the TARGET
 *    member's effective workspace (its runtime cwd), and the §6 envelope taken
 *    from the bound Blueprint's EXPLICIT `permissionMutationEnvelope` carrier
 *    (never a derivation of the leader's static lanes). The kernel awaits
 *    these readers, which re-validate team/member/binding/cwd/provider across
 *    their await and abstain on drift (UNKNOWN / zero envelope → typed
 *    refusal, never a stale answer). When NO caller injects a provider (test/
 *    legacy roots) the reader stays ABSENT (= UNKNOWN facts) and the regions
 *    that depend on lower facts refuse typed (`PERMISSION_EFFECT_CONTEXT_
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
import type {
  PermissionMutationEnvelope,
  PermissionStaticLayerFacts,
} from '../../governance/index.js'
import type { PERMISSION_MUTATION_ERROR_CODES } from '../../governance/index.js'
import type { GovernanceMutationService, GovernancePermissionLaneDeps } from '../../governance/types.js'
import { LEADER_INSTANCE_ID } from '../../../contracts/src/index.js'
import type { MemberLifecycleState } from '../../../contracts/src/index.js'
import type { TeamBlueprint, TemplatePermissionPolicy } from '../../../domain/blueprint/src/index.js'
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
 * @param deps.leaderAuthorityFacts - the acting leader's OWN static facts
 *   (the authority ceiling X1 requires on every risen cell; forwarded
 *   VERBATIM — absent = the pre-round-4 envelope-only judgement).
 */
export function createPermissionGovernanceLane(deps: {
  readonly overlay: PermissionOverlayRepositoryPort
  readonly fsContainsKeys?: CanonicalKeyContains
  readonly staticLayers?: GovernancePermissionLaneDeps['staticLayers']
  readonly permissionEnvelope?: GovernancePermissionLaneDeps['permissionEnvelope']
  readonly leaderAuthorityFacts?: GovernancePermissionLaneDeps['leaderAuthorityFacts']
}): GovernancePermissionLaneDeps {
  const { overlay, fsContainsKeys, staticLayers, permissionEnvelope, leaderAuthorityFacts } = deps
  return {
    overlay,
    ...(staticLayers === undefined ? {} : { staticLayers }),
    ...(permissionEnvelope === undefined ? {} : { permissionEnvelope }),
    ...(leaderAuthorityFacts === undefined ? {} : { leaderAuthorityFacts }),
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
// PR4 round 4 — the production AUTHORITY-FACTS authority (addressed-team
// bound, per-target-member canonicalization, explicit §6 carrier).
//
// The mutation kernel compares a Leader's EXPANSION against the LOWER static
// layers and the §6 expansion ceiling, all expressed in the SAME opaque key
// space as the overlay rules it authorizes. A blueprint carries PATHS, and
// only the fs provider (A2) may turn a path into a canonical key — so this
// builder is the ONE place that crosses from blueprint paths to canonical
// keys, and it does so under THREE bindings the pure kernel cannot see:
//
//   (1) ADDRESSED-TEAM BINDING. Every document is read through
//       `resolveBlueprint(teamSessionId)` — the SAME production bound-Blueprint
//       authority the team-root/member identity binds to (the three-case
//       resolver: a bound ref NEVER falls back to the row anchor). The prior
//       build parsed the ROW ANCHOR once and served every team a row-wide
//       constant — two teams minted from the same blueprint/template (identical
//       template ids) made team B's member evaluated under team A's authority
//       (round-3 BLOCK-2, external review). Now team B's grant is authorized
//       against team B's OWN bound Blueprint, envelope and static layers alike.
//
//   (2) TARGET-MEMBER CANONICALIZATION BASIS. The blueprint path is resolved
//       against the TARGET MEMBER'S ACTUAL effective workspace (the durable
//       `member.workspace ?? team default`, which IS the Agent's runtime cwd —
//       `agent-bindings.mjs memberCwd`) through the row's real provider, NEVER
//       the acting row/anchor cwd. The decision plane canonicalizes the
//       operation and the member's own template rules at `session.header.cwd`,
//       so the static facts and the §6 envelope MUST be canonicalized at that
//       SAME basis or a relative rule silently resolves against a different
//       root and the effective comparison is confidently wrong (round-3
//       BLOCK-3: a mis-anchored DENY key missed the grant point, an
//       envelope-free expansion "no-rise"d through, and the committed overlay
//       flipped the member's live DENY to ALLOW). Both the static layer and the
//       ENVELOPE for a decision share the target member's canonical space, so
//       the envelope matcher vs the rising cell compare in one key space.
//
//   (3) EXPLICIT §6 CARRIER — never a derivation. The Leader's expansion
//       ceiling comes ONLY from the bound Blueprint's `permissionMutationEnvelope`
//       config carrier ({operationClass, matcher, maximumEffect}; file →
//       exact/subtree PATH canonicalized at the target member's basis; exec →
//       exact canonical fingerprint carried VERBATIM). The prior build DERIVED
//       the envelope by COPYING the Leader's static ALLOW/ASK lanes and
//       dropping the same-layer DENY/ASK exceptions (an existential-union fold
//       that over-granted: `allow subtree /work` + `deny exact /work/secret`
//       derived to a plain `allow /work`, laundering a worker grant of
//       /work/secret past the leader's own denial). That derivation is REMOVED.
//       Absence of the carrier is a LEGAL typed absence = NO expansion
//       authority (never a read failure, never a hard-fail of unrelated
//       decisions); tightening needs no envelope (ADR §6); a legitimately
//       configured file/exec rule reaches allow through the real production
//       path, and over-ceiling or unconfigured stays refused typed.
//
// Fail-closed rules of the build:
//   - A canonicalization FAULT (provider throw, empty key) makes the WHOLE
//     document UNKNOWN for that (team, member) — never a partially canonicalized
//     authority is shipped, and never is the failure cached: the next read
//     RETRIES (bounded recovery for a transient boot fs fault, GAP3), while a
//     fault on one (team, member) leaves every other reader serving its own
//     correct current facts.
//   - Every reader re-reads the CURRENT binding facts (bound-Blueprint identity,
//     member cwd, provider version) and, ACROSS the canonicalization await,
//     re-validates them; drift discards the half-trusted document (UNKNOWN /
//     zero envelope), never serves a stale one and never mixes identity.
//   - A document with NO permissions-bearing template and NO carrier performs
//     ZERO fs calls (the no-permissions world gains zero new startup failures).
// ──────────────────────────────────────────────────────────────────────────

/** The snapshot identity the derived documents are bound to. */
export interface PermissionFactsIdentity {
  readonly blueprintId: string
  readonly revision: string
  readonly contentHash: string
}

/** One warmed (team, member) target for {@link PermissionAuthorityFacts.refresh}. */
export interface PermissionFactsWarmTarget {
  readonly teamSessionId: string
  readonly memberInstanceId: string
}

/** The inputs of {@link createPermissionAuthorityFacts} (all injected). */
export interface PermissionAuthorityFactsDeps {
  /** The ADDRESSED team's real bound Blueprint (the SAME three-case authority
   *  the team identity binds to; `undefined` = unresolvable → UNKNOWN). */
  readonly resolveBlueprint: (teamSessionId: string) => TeamBlueprint | undefined
  /** The member row's template id (`undefined` = no durable row → UNKNOWN). */
  readonly memberTemplateId: (teamSessionId: string, memberInstanceId: string) => string | undefined
  /** The target member's EFFECTIVE workspace = its actual runtime cwd (the
   *  canonicalization anchor; `undefined` = UNKNOWN). The leader position is
   *  the team's default workspace. NEVER the acting row/anchor cwd. */
  readonly memberWorkspace: (teamSessionId: string, memberInstanceId: string) => string | undefined
  /** The A2 canonicalizer (the row's fs provider — the ONLY legal key
   *  source), anchored at the caller-supplied cwd. */
  readonly canonicalize: (path: string, cwd: string) => Promise<string>
  /** A token identifying the CURRENT fs provider instance/epoch (identity
   *  across which a cached document stays valid; default = a constant so a
   *  single-provider host is unaffected). A change invalidates every cache. */
  readonly providerVersion?: () => string
  /** The boot warm targets (leader + existing members of the boot team). */
  readonly bootWarmTargets?: () => readonly PermissionFactsWarmTarget[]
}

/** The built authority: a warm build + two kernel readers (async-capable). */
export interface PermissionAuthorityFacts {
  /** The async warm boundary (host: after `builtRoot.boot()`, before
   *  readiness). Best-effort: builds the boot warm targets; a fault marks the
   *  authority unhealthy and the readers RETRY lazily on the next read (never
   *  a cached failure). Idempotent; a repeat rebuilds from CURRENT bindings. */
  refresh(): Promise<void>
  /** `true` while the last warm/read against the current bindings succeeded. */
  readonly healthy: () => boolean
  /** EXACT (non-optional) signatures: the builder ALWAYS wires these —
   *  the LANE deps may omit them (legacy), the production surface may not. */
  readonly staticLayers: (
    teamSessionId: string,
    memberInstanceId: string,
  ) => Promise<PermissionStaticLayerFacts | undefined>
  readonly permissionEnvelope: (
    teamSessionId: string,
    memberInstanceId: string,
  ) => Promise<PermissionMutationEnvelope>
  /** The acting leader's OWN static facts for one addressed (team, target
   *  member) — the authority-ceiling facts the service folds into every
   *  risen cell (X1). Same revalidation + recovery discipline as the others. */
  readonly leaderAuthorityFacts: (
    teamSessionId: string,
    targetMemberInstanceId: string,
  ) => Promise<PermissionStaticLayerFacts | undefined>
}

const DECLARED_NONE: PermissionStaticLayerFacts = { layers: [] }
/** The zero-authority envelope document (absent carrier / UNKNOWN). */
const NO_ENVELOPE: PermissionMutationEnvelope = { rules: [] }
/** The provider version when the host supplies none (single-provider host). */
const SINGLE_PROVIDER = 'single'

type FactsLayerRule = {
  readonly operationClass: string
  readonly matcher: { readonly kind: 'exact' | 'subtree' | 'any'; readonly resource?: string }
  readonly effect: 'allow' | 'ask' | 'deny'
}

/** The binding tuple a cached document is valid against. Every component is
 *  re-read fresh on each read and re-validated after the canonicalization
 *  await; a change in ANY of them means the cached document is stale. */
interface BindingTuple {
  readonly blueprintId: string
  readonly revision: string
  readonly contentHash: string
  readonly templateId: string | undefined
  readonly cwd: string
  readonly providerVersion: string
}

function bindingsEqual(a: BindingTuple, b: BindingTuple): boolean {
  return (
    a.blueprintId === b.blueprintId &&
    a.revision === b.revision &&
    a.contentHash === b.contentHash &&
    a.templateId === b.templateId &&
    a.cwd === b.cwd &&
    a.providerVersion === b.providerVersion
  )
}

function bindingKey(kind: string, team: string, member: string, t: BindingTuple): string {
  return `${kind}\u0000${team}\u0000${member}\u0000${t.contentHash}\u0000${t.cwd}\u0000${t.providerVersion}`
}

/**
 * Build the addressed-team, per-member authority readers (see the section
 * header for the three bindings and the fail-closed rules).
 * @param deps - the injected bound-Blueprint / member / canonicalizer sources.
 */
export function createPermissionAuthorityFacts(deps: PermissionAuthorityFactsDeps): PermissionAuthorityFacts {
  const providerVersion = deps.providerVersion ?? ((): string => SINGLE_PROVIDER)
  /** Cached documents keyed by (kind, team, member, binding); a fault is
   *  NEVER stored here (the next read retries → bounded recovery). */
  const cache = new Map<string, PermissionStaticLayerFacts | PermissionMutationEnvelope>()
  let healthyFlag = false

  function providerVersionOf(): string {
    try {
      return providerVersion()
    } catch {
      // A provider-version fault is an unknown provider → no cached doc is
      // trustworthy this round; surface as a distinct token (forces a rebuild
      // and, if it persists, an UNKNOWN read rather than a stale serve).
      return 'provider-version-fault'
    }
  }

  /** Read the CURRENT binding tuple for one (team, member), or `undefined`
   *  when any binding is UNKNOWN (unresolvable bound Blueprint, no member
   *  row, no workspace). Never guesses. */
  function currentBinding(
    teamSessionId: string,
    memberInstanceId: string,
  ): { tuple: BindingTuple; blueprint: TeamBlueprint } | undefined {
    const blueprint = deps.resolveBlueprint(teamSessionId)
    if (blueprint === undefined) return undefined
    const isLeader = memberInstanceId === LEADER_INSTANCE_ID
    const templateId = isLeader
      ? (blueprint.leader.templateId as string)
      : deps.memberTemplateId(teamSessionId, memberInstanceId)
    if (!isLeader && templateId === undefined) return undefined // no durable row → UNKNOWN
    const cwd = deps.memberWorkspace(teamSessionId, memberInstanceId)
    if (typeof cwd !== 'string' || cwd.length === 0) return undefined
    return {
      blueprint,
      tuple: {
        blueprintId: String(blueprint.blueprintId),
        revision: String(blueprint.revision),
        contentHash: String(blueprint.contentHash),
        templateId,
        cwd,
        providerVersion: providerVersionOf(),
      },
    }
  }

  /** Canonicalize the target member's template policy into the kernel's
   *  static-facts document AT THE MEMBER'S WORKSPACE. A fault throws (the
   *  caller abstains + retries next read); a no-permissions template is the
   *  DECLARED-NONE document with ZERO fs calls. */
  async function buildStaticFacts(blueprint: TeamBlueprint, templateId: string, cwd: string): Promise<PermissionStaticLayerFacts> {
    const policy = policyOfTemplate(blueprint, templateId)
    if (policy === undefined) return DECLARED_NONE
    const rules: FactsLayerRule[] = []
    for (const lane of ['allow', 'ask', 'deny'] as const) {
      for (const rule of policy[lane]) {
        if (rule.resource.kind === 'any') {
          rules.push({ operationClass: rule.tool, matcher: { kind: 'any' }, effect: lane })
          continue
        }
        const key = await deps.canonicalize(rule.resource.path, cwd)
        if (typeof key !== 'string' || key.length === 0) {
          throw new Error(
            `permission authority facts: the fs provider returned no canonical key for ${JSON.stringify(rule.resource.path)}`,
          )
        }
        rules.push({ operationClass: rule.tool, matcher: { kind: rule.resource.kind, resource: key }, effect: lane })
      }
    }
    return parsePermissionStaticLayerFacts({
      layers: [{ label: templateId, default: policy.default, rules }],
    })
  }

  /** Build the §6 envelope from the bound Blueprint's EXPLICIT config carrier
   *  (never a static derivation — see the section header). File matchers are
   *  canonicalized AT THE TARGET MEMBER'S WORKSPACE (the envelope-path basis:
   *  the envelope must compare in the same key space as the rising cells the
   *  kernel partitions from the member's overlay + static facts); exec
   *  fingerprints are carried VERBATIM (exact identity). Absent carrier →
   *  zero-authority (a legal typed absence, zero fs calls). */
  async function buildEnvelope(blueprint: TeamBlueprint, cwd: string): Promise<PermissionMutationEnvelope> {
    const carrier = blueprint.permissionMutationEnvelope
    if (carrier === undefined || carrier.rules.length === 0) return NO_ENVELOPE
    const rules: {
      readonly operationClass: string
      readonly matcher: { readonly kind: 'exact' | 'subtree' | 'fingerprint'; readonly resource: string }
      readonly maximumEffect: 'allow' | 'ask' | 'deny'
    }[] = []
    for (const rule of carrier.rules) {
      if (rule.matcher.kind === 'fingerprint') {
        // Exec lane: the canonical fingerprint IS the identity — verbatim,
        // never canonicalized, never widened (design §5).
        rules.push({
          operationClass: rule.operationClass,
          matcher: { kind: 'fingerprint', resource: rule.matcher.fingerprint },
          maximumEffect: rule.maximumEffect,
        })
        continue
      }
      // File lane: exact | subtree — canonicalized at the target basis.
      const key = await deps.canonicalize(rule.matcher.path, cwd)
      if (typeof key !== 'string' || key.length === 0) {
        throw new Error(
          `permission authority envelope: the fs provider returned no canonical key for ${JSON.stringify(rule.matcher.path)}`,
        )
      }
      rules.push({
        operationClass: rule.operationClass,
        matcher: { kind: rule.matcher.kind, resource: key },
        maximumEffect: rule.maximumEffect,
      })
    }
    return parsePermissionMutationEnvelope({ rules })
  }

  /** The shared read path: build-or-cache, then RE-VALIDATE the binding tuple
   *  across the canonicalization await (drift → abstain, discard, retry next
   *  read; never serve a half-trusted / stale document). Bounded to two build
   *  attempts, then a typed abstention. */
  async function readCached<T>(
    kind: 'static' | 'env' | 'leader',
    teamSessionId: string,
    memberInstanceId: string,
    build: (blueprint: TeamBlueprint, tuple: BindingTuple) => Promise<T>,
    unknownValue: T,
  ): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const now = currentBinding(teamSessionId, memberInstanceId)
      if (now === undefined) {
        healthyFlag = false
        return unknownValue // UNKNOWN bindings → abstain (never a guess)
      }
      const key = bindingKey(kind, teamSessionId, memberInstanceId, now.tuple)
      const cached = cache.get(key)
      if (cached !== undefined) {
        healthyFlag = true
        return cached as T
      }
      let built: T
      try {
        built = await build(now.blueprint, now.tuple)
      } catch {
        // A canonicalization fault: NO cache (next read retries = bounded
        // recovery), UNKNOWN this round, never a partially canonicalized doc.
        healthyFlag = false
        return unknownValue
      }
      // RE-VALIDATE across the await: the bindings must be UNCHANGED or the
      // document is mixed-identity and is discarded (abstain this round, the
      // next read rebuilds against the current bindings).
      const after = currentBinding(teamSessionId, memberInstanceId)
      if (after === undefined || !bindingsEqual(now.tuple, after.tuple)) {
        healthyFlag = false
        return unknownValue
      }
      cache.set(key, built as unknown as PermissionStaticLayerFacts | PermissionMutationEnvelope)
      healthyFlag = true
      return built
    }
    healthyFlag = false
    return unknownValue
  }

  const staticLayers: GovernancePermissionLaneDeps['staticLayers'] = (teamSessionId, memberInstanceId) =>
    readCached<PermissionStaticLayerFacts | undefined>(
      'static',
      teamSessionId,
      memberInstanceId,
      (blueprint, tuple) => buildStaticFacts(blueprint, tuple.templateId as string, tuple.cwd),
      undefined,
    )

  const permissionEnvelope: GovernancePermissionLaneDeps['permissionEnvelope'] = (teamSessionId, memberInstanceId) =>
    readCached<PermissionMutationEnvelope>(
      'env',
      teamSessionId,
      memberInstanceId,
      (blueprint, tuple) => buildEnvelope(blueprint, tuple.cwd),
      NO_ENVELOPE,
    )

  // The acting leader's OWN static facts (X1 authority ceiling), evaluated
  // against the TARGET member's effective-workspace basis (the SAME space
  // the rising cells and the envelope occupy — the leader template's relative
  // rules resolve identically to how they are judged at execution, so a
  // `deny exact <path>` exception lands on the exact key it must subtract).
  // The target's binding tuple (freshness + UNKNOWN) governs the read; the
  // policy CONTENT is the leader template's.
  const leaderAuthorityFacts: GovernancePermissionLaneDeps['leaderAuthorityFacts'] = (
    teamSessionId,
    targetMemberInstanceId,
  ) =>
    readCached<PermissionStaticLayerFacts | undefined>(
      'leader',
      teamSessionId,
      targetMemberInstanceId,
      (blueprint, tuple) => buildStaticFacts(blueprint, String(blueprint.leader.templateId), tuple.cwd),
      undefined,
    )

  return {
    async refresh() {
      const targets = deps.bootWarmTargets?.() ?? []
      // Best-effort warm: build each target so the FIRST grant (post-boot,
      // pre-readiness) is reachable (BLOCK-1); an individual fault just leaves
      // that target to retry lazily, but flips `healthy` (the loud host log
      // reports it) — never a hard boot failure on a transient fs fault.
      let allOk = true
      for (const target of targets) {
        try {
          await staticLayers(target.teamSessionId, target.memberInstanceId)
          await permissionEnvelope(target.teamSessionId, target.memberInstanceId)
        } catch {
          allOk = false
        }
      }
      healthyFlag = allOk
    },
    healthy: () => healthyFlag,
    // Async-normalizing wrappers: the internal readers forward the deps'
    // `T | Promise<T>` shape (sync test fakes stay legal); the PRODUCTION
    // surface is exactly-Promise (the PermissionAuthorityFacts contract).
    staticLayers: async (teamSessionId, memberInstanceId) =>
      staticLayers(teamSessionId, memberInstanceId),
    permissionEnvelope: async (teamSessionId, memberInstanceId) =>
      permissionEnvelope(teamSessionId, memberInstanceId),
    leaderAuthorityFacts: async (teamSessionId, targetMemberInstanceId) =>
      leaderAuthorityFacts(teamSessionId, targetMemberInstanceId),
  }
}

/** The permission policy of one template of the bound Blueprint (the leader
 *  position included); `undefined` when the template declares none or its id
 *  is not present in the bound snapshot (UNKNOWN upstream). */
function policyOfTemplate(blueprint: TeamBlueprint, templateId: string): TemplatePermissionPolicy | undefined {
  const templates: Array<{ templateId: unknown; capabilities?: { permissions?: TemplatePermissionPolicy } }> = [
    blueprint.leader,
    ...blueprint.members,
  ]
  const found = templates.find((template) => (template.templateId as string) === templateId)
  return found?.capabilities?.permissions
}

