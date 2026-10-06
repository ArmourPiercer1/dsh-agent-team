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
// A4-PR1 (plan Task 1 lane C, ADR A2-3 + correction X5-E2): the ONE AST→runtime
// canonicalization for BOTH v3 authority documents lives in this file, next to
// `buildEnvelope` — this is the only layer that owns a workspace to canonicalize
// against, `domain` is forbidden from manufacturing canonical keys, and a second
// mapping anywhere else is precisely what X5-E2 rules out.
import type {
  AuthorityEnvelope,
  AuthorityEnvelopeAst,
  AuthorityEnvelopeAstMatcher,
  AuthorityEnvelopeRule,
} from '../../../domain/authority-envelope/src/index.js'
// The three-way document-read outcome is the CEILING ADAPTER'S type, not this
// file's: the reader and the consumer of a read must not hold two vocabularies
// for it (see `AuthorityHardCeilingRead` below).
import type { AuthorityDocumentRead } from '../../governance/authority-ceiling.js'
import type { RuntimeAuthority } from '../../governance/runtime-authority.js'
import type { PermissionAuthorityCeilingContext } from '../../governance/types.js'
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
 *   service's zero-authority default). ROUND 5: the round-4
 *   leaderAuthorityFacts forward is REMOVED (the ceiling gate was a second
 *   policy ADR §6 does not carry).
 */
export function createPermissionGovernanceLane(deps: {
  readonly overlay: PermissionOverlayRepositoryPort
  readonly fsContainsKeys?: CanonicalKeyContains
  readonly staticLayers?: GovernancePermissionLaneDeps['staticLayers']
  readonly permissionEnvelope?: GovernancePermissionLaneDeps['permissionEnvelope']
  /** ROUND 7 (parent BLOCK-1): the target lifecycle guard awaited INSIDE the
   *  serialized mutation section (the post-await revalidation position). The
   *  production root wires the SAME shared assertion the mutation lane
   *  pre-checks — one lifecycle law, never a second gate. */
  readonly targetGuard?: GovernancePermissionLaneDeps['targetGuard']
  /** A4-PR2 lane C: the v3 authority-ceiling context reader, wired by the
   *  production root from {@link createAuthorityCeilingReader}. Absent = the
   *  deployment wired no ceiling reader, which is a WIRING fact and never the v3
   *  signal (that decision is the reader's, in this module — ADR A5-12). */
  readonly authorityCeiling?: GovernancePermissionLaneDeps['authorityCeiling']
}): GovernancePermissionLaneDeps {
  const { overlay, fsContainsKeys, staticLayers, permissionEnvelope, targetGuard, authorityCeiling } = deps
  return {
    overlay,
    ...(authorityCeiling === undefined ? {} : { authorityCeiling }),
    ...(staticLayers === undefined ? {} : { staticLayers }),
    ...(permissionEnvelope === undefined ? {} : { permissionEnvelope }),
    ...(targetGuard === undefined ? {} : { targetGuard }),
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
  /** A token identifying the CURRENT fs provider instance/epoch. ROUND 5:
   *  a DRIFT field of the revalidated binding tuple — NOT a cache epoch (no
   *  cache exists); a mid-read change discards the in-flight build. Default
   *  = a constant, honest for a single-provider host (a constant is NOT a
   *  version — which is exactly why nothing may be cached on it). */
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
  /**
   * The v3 Human User hard ceiling for one addressed member (A4-PR1, spec §3.2).
   *
   * THREE outcomes, never a document-or-undefined: on the approval plane an
   * absent document means NO NARROWING, so a read that answered `undefined` for
   * a FAULT would widen approval authority exactly when the storage layer is
   * least trustworthy. See {@link AuthorityHardCeilingRead}.
   *
   * PR1 adds the READ and nothing else: no production decision consults it, and
   * {@link PermissionAuthorityFacts.refresh} does not warm it (warming would
   * fold a brand-new document into `healthy()` semantics that every v1/v2 Team
   * still drives — that is PR2's call with a caller in front of it).
   */
  readonly teamHardEnvelope: (
    teamSessionId: string,
    memberInstanceId: string,
  ) => Promise<AuthorityHardCeilingRead>
  /**
   * The bound Blueprint's `schemaVersion` for one team session, or `undefined`
   * when the binding is UNKNOWN (no resolvable bound Blueprint). A4-PR2 added
   * this because the v3 switch MUST live in this module (ADR A5-12): the
   * governance service is forbidden from deciding v3 itself, and the only honest
   * source of the version is the SAME bound-Blueprint resolution every other
   * permission fact is read through — never a document-shape inference.
   */
  readonly blueprintSchemaVersion: (teamSessionId: string) => number | undefined
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

/**
 * Build the addressed-team, per-member authority readers (see the section
 * header for the three bindings and the fail-closed rules).
 * @param deps - the injected bound-Blueprint / member / canonicalizer sources.
 */
/**
 * THE one AST→runtime canonicalization of an authority document (plan Task 1:
 * "single AST→runtime canonicalization"; ADR A2-3, correction X5-E2).
 *
 * Both v3 documents (`permissionMutationEnvelope`, `teamHardEnvelope`) pass
 * through THIS function, which is what "one grammar, two documents" means at the
 * boundary: identical mapping, identical provider discipline, one place for a
 * reviewer to audit. The input is the DECLARED shape a hash-bound Blueprint
 * carries; the output is the canonical `{ kind, resource }` document the kernel
 * consumes, validated and frozen by `parsePermissionMutationEnvelope` — the same
 * validation the mutation envelope has always had, so v1/v2 behavior is
 * unchanged to the byte (ADR A2-4).
 *
 * THE PROVIDER DISCIPLINE, because it is the security-relevant part:
 *  - a `fingerprint` matcher travels VERBATIM with ZERO provider calls — it
 *    already IS the canonical operation identity, and passing it through a path
 *    canonicalizer would let a filesystem answer rename an exec identity;
 *  - an `exact`/`subtree` matcher is canonicalized AT THE GIVEN WORKSPACE BASIS,
 *    and a provider that answers with nothing is a THROWN error, never an empty
 *    key: an empty key would silently turn a rule into one that covers the wrong
 *    (or every) resource.
 *
 * Exported so the discipline is testable directly
 * (`a4p1-authority-envelope.test.ts` counts the provider calls); the production
 * readers below are its only callers.
 */
export async function buildAuthorityEnvelope(
  document: AuthorityEnvelopeAst,
  cwd: string,
  canonicalizer: { readonly canonicalize: (path: string, cwd: string) => Promise<string> },
): Promise<AuthorityEnvelope> {
  const rules: AuthorityEnvelopeRule[] = []
  for (const rule of document.rules) {
    const matcher: AuthorityEnvelopeAstMatcher = rule.matcher
    if (matcher.kind === 'fingerprint') {
      // Exec lane: verbatim, never canonicalized, never widened (design §5).
      rules.push({
        operationClass: rule.operationClass,
        matcher: { kind: 'fingerprint', resource: matcher.fingerprint },
        maximumEffect: rule.maximumEffect,
      })
      continue
    }
    // File lane: exact | subtree — canonicalized at the target basis.
    const key = await canonicalizer.canonicalize(matcher.path, cwd)
    if (typeof key !== 'string' || key.length === 0) {
      throw new Error(
        `permission authority envelope: the fs provider returned no canonical key for ${JSON.stringify(matcher.path)}`,
      )
    }
    rules.push({
      operationClass: rule.operationClass,
      matcher: { kind: matcher.kind, resource: key },
      maximumEffect: rule.maximumEffect,
    })
  }
  return parsePermissionMutationEnvelope({ rules })
}

/**
 * The read outcome for the v3 `teamHardEnvelope` — an ALIAS of the ceiling
 * adapter's {@link AuthorityDocumentRead}, so there is ONE name for the three
 * facts a document read can report and, more importantly, so the reader's
 * output can be handed to `grantCeiling`/`bindingDocs` WITHOUT an intermediate
 * `undefined`. That intermediate is the hole this alias closes: on the approval
 * plane absence means "narrows nothing" (ADR A1-4), and an empty bound set meets
 * to the identity, so a `declared | absent` -or-`undefined` seam would let
 * `unavailable → undefined` grant a Leader or a Human User UNLIMITED approval
 * authority on a storage fault — with every test green, because `undefined` is
 * the correct spelling of the OTHER fact (`absent`). The ceiling adapter
 * refuses on `unavailable` instead, and its type does not accept `undefined`
 * at all (review SF1 on PR1).
 *
 * The three facts:
 *  - `declared` — a document exists (possibly declaring `rules: []`, which is a
 *    legal v3 declaration, not an absence);
 *  - `absent` — the bound Blueprint does not carry the field, exactly the v1/v2
 *    case through the bridge (ADR A2-4/A2-11); NEVER synthesized from a missing
 *    read;
 *  - `unavailable` — the binding is unknown or a provider faulted: unknown, not
 *    absent. A consumer must fail closed (ADR A1-7 keeps
 *    `authority-unavailable` distinct from `authority-undetermined`).
 */
export type AuthorityHardCeilingRead = AuthorityDocumentRead

export function createPermissionAuthorityFacts(deps: PermissionAuthorityFactsDeps): PermissionAuthorityFacts {
  const providerVersion = deps.providerVersion ?? ((): string => SINGLE_PROVIDER)
  // ROUND 5 (FIX-4, parent ruling + R-A): there is NO cross-call document
  // cache. The constant default providerVersion is NOT a trustworthy epoch —
  // a cached canonical could outlive a symlink/junction re-point or a lazy
  // provider swap and authorize STALE paths while execution reads fresh.
  // Every read RE-CANONICALIZES through the CURRENT provider inside the
  // governance service's serialized outer section (fresh-per-mutation); the
  // binding tuple below is a DRIFT guard across each read's own awaits,
  // never a cache key (round 4's key also omitted templateId — a template
  // swap under an unchanged hash would have served stale; removal kills
  // that second staleness too, and the cache never evicted).
  let healthyFlag = false

  function providerVersionOf(): string {
    try {
      return providerVersion()
    } catch {
      // A provider-version fault is an unknown provider this round: surface
      // as a distinct token so the post-await revalidation DISCARDS the
      // in-flight build (drift), never a stale serve.
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
    // An absent carrier stays a typed `NO_ENVELOPE` (zero authority, ZERO fs
    // calls): the short-circuit is load-bearing, not a micro-optimization — it
    // is what keeps `a3p4-r4-authority-binding.test.ts`'s "absent carrier is a
    // legal typed absence" leg honest about provider silence.
    if (carrier === undefined || carrier.rules.length === 0) return NO_ENVELOPE
    // DELEGATED to the one canonicalization both documents share. The rule
    // mapping, the fingerprint-verbatim lane, and the empty-key refusal are
    // byte-for-byte the code this function used to contain inline.
    return buildAuthorityEnvelope(carrier, cwd, deps)
  }

  /** The v3 Human User hard ceiling, read the SAME fresh-per-decision way as
   *  the mutation envelope (no cache, drift → abstain). Three facts decide the
   *  outcome and none of them is interchangeable with another:
   *   - the field is ABSENT (`schemaVersion: 1 | 2`): a typed absence the
   *     reader reports as `absent` and never as an empty document — an empty
   *     document would be read on the expansion plane as "expand nothing", and
   *     the two planes must not be able to disagree about what absence means;
   *   - the field is present with `rules: []` (legal at v3): `declared`, with an
   *     EMPTY document — the only place a `{rules: []}` hard ceiling is allowed
   *     to come from is a document that says so;
   *   - the read itself failed or the binding drifted: `unavailable`, because on
   *     the approval plane absence widens reach and a fault must never widen it. */
  async function readHardCeiling(blueprint: TeamBlueprint, cwd: string): Promise<AuthorityHardCeilingRead> {
    const document = blueprint.teamHardEnvelope
    if (document === undefined) return { status: 'absent' }
    if (document.rules.length === 0) {
      // Legal, declared, and EMPTY — canonicalized without touching the fs
      // provider at all (there is nothing to resolve).
      return { status: 'declared', document: parsePermissionMutationEnvelope({ rules: [] }) }
    }
    return { status: 'declared', document: await buildAuthorityEnvelope(document, cwd, deps) }
  }
  /** The shared read path (round 5): build FRESH on every call — no cache —
   *  then RE-VALIDATE the binding tuple across the canonicalization await
   *  (drift → abstain; never serve a mixed-identity document). The outcome
   *  (`ok`) drives `healthy()`; faults are never cached (nothing is) and the
   *  next read simply rebuilds (bounded recovery). */
  async function readFresh<T>(
    teamSessionId: string,
    memberInstanceId: string,
    build: (blueprint: TeamBlueprint, tuple: BindingTuple) => Promise<T>,
    unknownValue: T,
  ): Promise<{ ok: boolean; value: T }> {
    const now = currentBinding(teamSessionId, memberInstanceId)
    if (now === undefined) {
      healthyFlag = false
      return { ok: false, value: unknownValue } // UNKNOWN bindings → abstain
    }
    let built: T
    try {
      built = await build(now.blueprint, now.tuple)
    } catch {
      // A canonicalization fault: UNKNOWN this round, never a partially
      // canonicalized document; the next read retries fresh.
      healthyFlag = false
      return { ok: false, value: unknownValue }
    }
    // RE-VALIDATE across the await: the bindings must be UNCHANGED or the
    // document is mixed-identity and is discarded (abstain this round; the
    // next read builds against the current bindings).
    const after = currentBinding(teamSessionId, memberInstanceId)
    if (after === undefined || !bindingsEqual(now.tuple, after.tuple)) {
      healthyFlag = false
      return { ok: false, value: unknownValue }
    }
    healthyFlag = true
    return { ok: true, value: built }
  }

  const staticLayers: GovernancePermissionLaneDeps['staticLayers'] = (teamSessionId, memberInstanceId) =>
    readFresh<PermissionStaticLayerFacts | undefined>(
      teamSessionId,
      memberInstanceId,
      (blueprint, tuple) => buildStaticFacts(blueprint, tuple.templateId as string, tuple.cwd),
      undefined,
    ).then((r) => r.value)

  const permissionEnvelope: GovernancePermissionLaneDeps['permissionEnvelope'] = (teamSessionId, memberInstanceId) =>
    readFresh<PermissionMutationEnvelope>(
      teamSessionId,
      memberInstanceId,
      (blueprint, tuple) => buildEnvelope(blueprint, tuple.cwd),
      NO_ENVELOPE,
    ).then((r) => r.value)

  // The v3 hard ceiling (A4-PR1). `readFresh`'s abstention value is
  // `unavailable` — the SAME slot that carries `NO_ENVELOPE` above, filled with
  // the opposite polarity on purpose: an abstained expansion read must mean zero
  // authority, and an abstained approval-plane read must mean nothing at all
  // except "unknown". Handing the identity out here would be the widening this
  // outcome type exists to prevent.
  const teamHardEnvelope: PermissionAuthorityFacts['teamHardEnvelope'] = (teamSessionId, memberInstanceId) =>
    readFresh<AuthorityHardCeilingRead>(
      teamSessionId,
      memberInstanceId,
      async (blueprint, tuple) => readHardCeiling(blueprint, tuple.cwd),
      { status: 'unavailable' },
    ).then((r) => r.value)

  return {
    async refresh() {
      const targets = deps.bootWarmTargets?.() ?? []
      // Best-effort warm: build each target so the FIRST grant (post-boot,
      // pre-readiness) is reachable (BLOCK-1). ROUND 5 (R-A minor): `healthy`
      // is computed from the READ RESULTS (abstention/fault included), not
      // from whether the readers THREW — a warm that abstained on a provider
      // fault must report UNHEALTHY so the host logs it LOUD (the old
      // throw-only aggregation printed healthy:true over a faulted warm).
      let allOk = targets.length > 0
      for (const target of targets) {
        const outcomes = await Promise.all([
          readFresh<PermissionStaticLayerFacts | undefined>(
            target.teamSessionId,
            target.memberInstanceId,
            (blueprint, tuple) => buildStaticFacts(blueprint, tuple.templateId as string, tuple.cwd),
            undefined,
          ),
          readFresh<PermissionMutationEnvelope>(
            target.teamSessionId,
            target.memberInstanceId,
            (blueprint, tuple) => buildEnvelope(blueprint, tuple.cwd),
            NO_ENVELOPE,
          ),
        ])
        for (const outcome of outcomes) if (!outcome.ok) allOk = false
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
    teamHardEnvelope: async (teamSessionId, memberInstanceId) =>
      teamHardEnvelope(teamSessionId, memberInstanceId),
    blueprintSchemaVersion: (teamSessionId) => deps.resolveBlueprint(teamSessionId)?.schemaVersion,
  }
}

/**
 * THE v3 AUTHORITY-CEILING READER (A4-PR2 lane C, ADR A5-12, spec §7.4.1).
 *
 * Assembles the ceiling CONTEXT the governance service evaluates for one mutation
 * target. It is a DATA assembler and nothing more: the ladder, the two planes and
 * every refusal law live in the authority-ceiling lane, and the decision whether
 * this Team is v3 lives HERE and nowhere else.
 *
 * THE VERSION SWITCH IS `schemaVersion === 3`, EXACTLY. Not "the reader was
 * wired", not "the hard ceiling declares rules", not "the envelope is non-empty":
 * a `{ rules: [] }` hard ceiling is a v3 Team that authorized NOTHING, and
 * reading its emptiness as "must be a pre-v3 Team, skip the gate" is a relaxation
 * in the forbidden direction, in the most restrictive Team in the fleet. The two
 * branches — the v1/v2 existential (return `undefined`, Alpha.3 behaviour
 * byte-identical) and the v3 branch — are both pinned in
 * `test/a4p2-dual-envelope-mutation.test.ts` (A5-12: one file, so the existential
 * leg cannot be deleted when the v3 leg starts passing).
 *
 * `undefined` from the version reader means the binding is UNKNOWN, and the
 * answer is the v1/v2 branch on purpose: an unresolved binding must not conjure a
 * v3 gate that invents authority facts it never read, and the v1/v2 path's own
 * readers already fail closed (an unknown binding yields the zero-authority
 * envelope, which refuses every Leader expansion). Choosing the OTHER branch here
 * would make a storage fault read as "this Team is v3 and its ceiling is empty",
 * i.e. an authority verdict invented from an absence.
 */
export function createAuthorityCeilingReader(deps: {
  readonly facts: Pick<PermissionAuthorityFacts, 'teamHardEnvelope' | 'permissionEnvelope' | 'blueprintSchemaVersion'>
}): (
  teamSessionId: string,
  memberInstanceId: string,
  actor: 'leader' | 'human',
) => Promise<PermissionAuthorityCeilingContext | undefined> {
  return async (teamSessionId, memberInstanceId, actor) => {
    const schemaVersion = deps.facts.blueprintSchemaVersion(teamSessionId)
    if (schemaVersion !== 3) return undefined
    // The trusted operator is a HUMAN authority position (plan:261, ADR §7): there
    // is NO production path that constructs a `human-admin`, and none appears
    // here — the highest position this factory can ever name is `human-user`.
    const initiatorAuthority: RuntimeAuthority = actor === 'leader' ? 'leader' : 'human-user'
    const hard = await deps.facts.teamHardEnvelope(teamSessionId, memberInstanceId)
    const envelope = await deps.facts.permissionEnvelope(teamSessionId, memberInstanceId)
    return {
      beneficiaryAuthority: 'member',
      initiatorAuthority,
      documents: {
        teamHardEnvelope: hard,
        // The Leader's own carrier keeps the ALPHA.3 posture: an absent carrier or
        // an UNKNOWN binding reads as `{ rules: [] }`, which on the expansion plane
        // is the ZERO-authority answer. Conflating fault-with-empty is safe in
        // THIS slot precisely because it restricts; on the hard ceiling the same
        // conflation would be a widening, so `teamHardEnvelope` keeps the three-way
        // `declared | absent | unavailable` read and the ceiling lane refuses on
        // `unavailable`.
        permissionMutationEnvelope: { status: 'declared', document: envelope },
      },
    }
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

