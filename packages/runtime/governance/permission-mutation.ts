/**
 * Alpha.3 PR3 — the PERMISSION MUTATION kernel: the unified PermissionMutation
 * model, the canonical §6 MutationEnvelope model, the resource-matcher grammar,
 * and the pure planning step that turns (current authority snapshot, one
 * mutation) into (next FULL snapshot | no-change | typed refusal).
 *
 * This module is the PURE HALF of the permission path of the ONE governance
 * mutation authority — `GovernanceMutationService.mutatePermission`
 * (`./service.ts`) runs authenticate → validate → serialize/CAS → commit →
 * provenance around these pure functions. There is NO second mutation
 * authority and NO second durable write path (ADR §1; coordinator D1: the
 * existing class is EXTENDED, never forked).
 *
 * ---------------------------------------------------------------------------
 * D2 — the two envelope concepts, kept ONE per concept (coordinator ruling)
 * ---------------------------------------------------------------------------
 *
 * The pre-existing `MutationEnvelope` in
 * `packages/domain/blueprint/src/types.ts:270` (`{ allow, deny }` op-token
 * sets) is the OPERATION-TOKEN CAPABILITY concept: a set-intersection over
 * mutation operation tokens (`packages/runtime/admission/envelope.ts:100-131`
 * — teamEnvelope ∩ template entry, further narrowed by the instance
 * autonomy-overlay) feeding the exec-token dual gate. It is NOT the ADR §6
 * per-rule envelope and this PR does not touch it — no rename, no mass
 * migration, no read of it from this module.
 *
 * Alpha.3 gets ONE canonical permission-change envelope model — this module's
 * {@link PermissionMutationEnvelope} — shaped exactly per design §4:
 *
 *     PermissionEnvelopeRule { operationClass, matcher, maximumEffect }
 *
 * ("Avoid operation-specific nested schemas", design §4). There is at most one
 * documented boundary between the two concepts and this implementation needs
 * ZERO of them: the permission plane never consults the token-capability
 * envelope, and the capability plane never consults this envelope. One
 * concept, one source of truth, no transformation.
 *
 * ---------------------------------------------------------------------------
 * The carrier grammar (PR2 left it here explicitly)
 * ---------------------------------------------------------------------------
 *
 * PR1's overlay row carries each rule's resource as an OPAQUE string (storage
 * `schema/permission-overlay.ts` — parseState: "Exact / subtree /
 * exec-fingerprint MATCHING is PR3 (design §4/§5) — the overlay row only
 * carries the string"), and PR2's assembler documented the same: "the overlay
 * rule CARRIER's resource grammar (exact / subtree / exec fingerprint, design
 * §4/§5) is PR3's `GovernanceMutationService`"
 * (`effective-policy/permission-assembler.ts:96-101`). This module owns that
 * grammar:
 *
 *     exact:<canonicalKey>        filesystem class, one canonical identity
 *     subtree:<canonicalRootKey>  filesystem class, a rooted subtree
 *     fingerprint:<canonicalFp>   exec class, ONE canonical operation impact
 *
 * - the prefix is taken at the FIRST colon, so a key that itself contains
 *   colons (or even a leading `exact:`) round-trips losslessly;
 * - canonical identities stay OPAQUE (the A2 contract,
 *   `operation-permission/types.ts` CanonicalResource.key: "never parsed,
 *   never compared for case") — this module only compares and renders them;
 * - EXEC is EXACT-canonical-fingerprint ONLY (design §5: "Filesystem/resource:
 *   exact, subtree. Exec: exact canonical fingerprint only. No: subtree; any"
 *   — and Final Acceptance 7: "Exec permissions remain exact"). A
 *   shell-class operation (`bash` / `pwsh`, the closed shell class of
 *   `operation-permission/types.ts:82-101`) pairs ONLY with `fingerprint`;
 *   a file-class operation (`read`/`read_image`/`write`/`edit`/`lsp`,
 *   `operation-permission/types.ts:56-68`) pairs ONLY with `exact`/`subtree`.
 *   Mispairings are a typed refusal, never a silently inert rule.
 *
 * `any` does not exist in this grammar: neither class gets a wildcard matcher
 * (design §5 forbids it for exec; for the filesystem it would out-author the
 * §6 "limits: 1. resource matcher; 2. maximum effect" ceiling idea, and the
 * A2 static schema keeps its own `any` rules — a DIFFERENT concept on a
 * different plane, untouched here).
 *
 * ---------------------------------------------------------------------------
 * The §6/§7 semantics this kernel computes
 * ---------------------------------------------------------------------------
 *
 * - the ladder: `deny < ask < allow` on the expansion axis (ADR §6);
 * - EXPANSION = a pair's effect rank goes UP. The PRIOR effect is the pair's
 *   rule in the current authority snapshot; ABSENCE counts as `deny`
 *   (fail-closed: a fresh grant is the widest expansion, which is what makes
 *   the ADR §6 envelope actually bound grants — and it needs no live
 *   lower-layer read, which is impossible here because the static layers match
 *   OPERATIONS through the live canonicalization seam, not rule text);
 * - TIGHTENING = rank goes DOWN → needs NO expansion authority (ADR §6,
 *   pinned by test in both directions per coordinator D1);
 * - coverage: an envelope rule covers a mutation rule iff the operationClass
 *   token is EQUAL (no wildcards) AND `matcherCovers` holds AND the new effect
 *   is at or below `maximumEffect`. Matcher coverage: fingerprint covers only
 *   the IDENTICAL fingerprint (exact only, design §5); exact covers only the
 *   identical exact; a subtree root covers an exact/subtree identity strictly
 *   below it — and "below" is the INJECTED containment predicate (the
 *   canonical keys are opaque: the same reason the frozen Alpha.2 matcher
 *   refuses `startsWith`, `operation-permission/permission-resolver.ts:64-70`).
 *   With no predicate injected, subtree coverage FAILS CLOSED
 *   ({@link CoverageVerdict.undeterminable});
 * - Human mutation may exceed the envelope and records Human provenance
 *   (ADR §7) — the actor decides WHETHER the envelope applies, never anything
 *   else: provenance stays audit data (ADR §2; ADR §7 "does NOT create
 *   permanent resolver priority" is structural because generations, not
 *   actors, select the authority — PR2's assembler reads the highest
 *   generation and never interprets `actor`).
 *
 * Pure module: no I/O, no `node:` builtins, no storage import (the PR1
 * vocabulary is type-only, the PR2 discipline), no clock (the service stamps
 * the timestamp through its injected `now`).
 *
 * @module @dsh-agent-team/runtime/governance/permission-mutation
 */

import { deepFreeze, toRemoteSafeDetail } from '../../contracts/src/index.js'
// LEAF import on purpose (the PR2 load-order lesson,
// test/a3p2-effective-policy-lane-import.test.ts): the operation-permission
// BARREL reaches the canonicalizer and back into the admission surface; its
// types module imports NOTHING. The governance lane is imported by
// src/plugin/root.ts, so only the leaf edge is safe here.
import {
  FILE_PERMISSION_TOOL_VALUES,
  SHELL_PERMISSION_TOOL_VALUES,
} from '../operation-permission/types.js'
import type { PermissionOverlayEffect } from '../permission-governance/types.js'
import type { PermissionOverlayRule, PermissionOverlaySnapshot } from '../permission-governance/types.js'

// ---------------------------------------------------------------------------
// The closed error surface (fail closed: refusals are typed, never silent)
// ---------------------------------------------------------------------------

/** The closed error-code vocabulary of the permission-mutation kernel. */
export const PERMISSION_MUTATION_ERROR_CODES = Object.freeze({
  /** The mutation input is malformed (identity, kind, rule grammar). */
  MALFORMED_MUTATION: 'PERMISSION_MUTATION_MALFORMED',
  /** The envelope document is malformed (shape, class/matcher mispair). */
  MALFORMED_ENVELOPE: 'PERMISSION_ENVELOPE_MALFORMED',
  /** The authority kind may not act on the permission lane (member/others). */
  UNAUTHORIZED_ACTOR: 'PERMISSION_MUTATION_UNAUTHORIZED_ACTOR',
  /** A Leader expansion no envelope rule covers (ADR §6) — zero write. */
  EXPANSION_OUTSIDE_ENVELOPE: 'PERMISSION_ENVELOPE_EXPANSION_DENIED',
  /** The expectedGeneration CAS moved (plan PR3 "CAS conflict") — zero write. */
  GENERATION_CONFLICT: 'PERMISSION_OVERLAY_GENERATION_CONFLICT',
  /** The lane dependencies were not injected — the capability stays dormant. */
  NOT_CONFIGURED: 'PERMISSION_MUTATION_NOT_CONFIGURED',
} as const)

/** One kernel error code. */
export type PermissionMutationErrorCode =
  (typeof PERMISSION_MUTATION_ERROR_CODES)[keyof typeof PERMISSION_MUTATION_ERROR_CODES]

/** Every kernel error code value, for membership checks. */
export const PERMISSION_MUTATION_ERROR_CODE_VALUES: readonly string[] = Object.freeze(
  Object.values(PERMISSION_MUTATION_ERROR_CODES),
)

/** A typed permission-mutation refusal. Branch on `code` + `details.problem`,
 *  never on the message text. A refusal performs NO write. */
export class PermissionMutationError extends Error {
  /** The closed error code. */
  readonly code: PermissionMutationErrorCode
  /** Lossless context (never a live caller object). */
  readonly details: Readonly<Record<string, unknown>>

  constructor(code: PermissionMutationErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'PermissionMutationError'
    this.code = code
    this.details = deepFreeze({ ...details })
  }
}

/** Is `error` a {@link PermissionMutationError}? */
export function isPermissionMutationError(error: unknown): error is PermissionMutationError {
  return error instanceof PermissionMutationError
}

function refuse(
  code: PermissionMutationErrorCode,
  problem: string,
  message: string,
  details: Record<string, unknown> = {},
): never {
  throw new PermissionMutationError(code, `${message} (problem: ${problem})`, {
    problem,
    ...(toRemoteSafeDetail(details) as Record<string, unknown>),
  })
}

// ---------------------------------------------------------------------------
// The §6 ladder and the direction classification (pinned in both directions)
// ---------------------------------------------------------------------------

/**
 * The expansion ladder (ADR §6): on the expansion axis `deny < ask < allow`.
 * An effect change is an EXPANSION iff the rank goes UP, a TIGHTENING iff it
 * goes DOWN, IDENTITY otherwise.
 */
export const PERMISSION_EFFECT_PRECEDENCE = Object.freeze({
  deny: 0,
  ask: 1,
  allow: 2,
} as const satisfies Record<PermissionOverlayEffect, number>)

/** One §6 direction. */
export type PermissionEffectDirection = 'expansion' | 'tightening' | 'identity'

/** Classify one effect change on the §6 ladder. */
export function permissionEffectDirection(
  from: PermissionOverlayEffect,
  to: PermissionOverlayEffect,
): PermissionEffectDirection {
  const a = PERMISSION_EFFECT_PRECEDENCE[from]
  const b = PERMISSION_EFFECT_PRECEDENCE[to]
  if (b > a) return 'expansion'
  if (b < a) return 'tightening'
  return 'identity'
}

// ---------------------------------------------------------------------------
// Operation classes (the A2 closed vocabulary, taken from the LEAF)
// ---------------------------------------------------------------------------

/** The closed operation classes of this grammar (design §4 `operationClass`). */
export type PermissionOperationClass = 'fs' | 'exec'

/**
 * Classify one operation-class token against the closed A2 vocabulary
 * (`operation-permission/types.ts`: the five file tools + the shell class).
 * `unknown` tokens are REJECTED by the validators — a rule naming a tool the
 * permission plane does not know is malformed here (fail-closed), not a
 * silently inert row (contrast: the frozen A2 matcher is total over ANY
 * rule text it is handed; this grammar is the AUTHORITY's write-time gate,
 * where a typo'd operation class must be refused, not stored).
 */
export function classifyPermissionOperationClass(token: string): PermissionOperationClass | 'unknown' {
  if ((SHELL_PERMISSION_TOOL_VALUES as readonly string[]).includes(token)) return 'exec'
  if ((FILE_PERMISSION_TOOL_VALUES as readonly string[]).includes(token)) return 'fs'
  return 'unknown'
}

// ---------------------------------------------------------------------------
// The resource matcher (design §4/§5) and the carrier grammar
// ---------------------------------------------------------------------------

/** The closed matcher kinds (design §5; `any` deliberately absent). */
export const PERMISSION_RESOURCE_MATCHER_KINDS = ['exact', 'subtree', 'fingerprint'] as const

/** One canonical resource matcher over OPAQUE canonical identities. */
export type PermissionResourceMatcher =
  | { readonly kind: 'exact'; readonly resource: string }
  | { readonly kind: 'subtree'; readonly resource: string }
  | { readonly kind: 'fingerprint'; readonly resource: string }

/** The prefix that renders one matcher kind into the carrier text. */
const MATCHER_PREFIX: Readonly<Record<PermissionResourceMatcher['kind'], string>> = Object.freeze({
  exact: 'exact:',
  subtree: 'subtree:',
  fingerprint: 'fingerprint:',
})

/** The carrier identity bound: the PR1 row accepts resources up to 1024
 *  characters (storage schema parseWorkspaceField); a rendered matcher must
 *  fit BEFORE the durable gate is ever reached, so the refusal is typed. */
const MAX_CARRIER_RESOURCE_LENGTH = 1024

/** Render one matcher into the deterministic carrier text of the overlay row
 *  (prefix at the FIRST colon; round-trips through
 *  {@link parsePermissionResourceText}). */
export function renderPermissionResourceText(matcher: PermissionResourceMatcher): string {
  return `${MATCHER_PREFIX[matcher.kind]}${matcher.resource}`
}

/** Parse carrier text back into a matcher (structure only — the class pairing
 *  is checked where the operationClass is known). `undefined` when the text
 *  carries no valid prefix (a foreign grammar string). */
export function parsePermissionResourceText(
  text: string,
): PermissionResourceMatcher | undefined {
  for (const kind of PERMISSION_RESOURCE_MATCHER_KINDS) {
    const prefix = MATCHER_PREFIX[kind]
    if (text.startsWith(prefix)) {
      return { kind, resource: text.slice(prefix.length) }
    }
  }
  return undefined
}

/** Validate + copy one matcher against the operation-class pairing rules
 *  (design §5). Throws MALFORMED_MUTATION / MALFORMED_ENVELOPE by context. */
function validateMatcher(
  raw: unknown,
  operationClass: string,
  opClass: PermissionOperationClass,
  code: PermissionMutationErrorCode,
  where: Record<string, unknown>,
): PermissionResourceMatcher {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    refuse(code, 'matcher-not-a-record', 'a permission resource matcher must be a record { kind, resource }', where)
  }
  const record = raw as Record<string, unknown>
  const kind = record['kind']
  const resource = record['resource']
  if (typeof resource !== 'string' || resource.length === 0) {
    refuse(code, 'matcher-resource-empty', 'a permission resource matcher must carry a non-empty canonical identity', where)
  }
  if (kind !== 'exact' && kind !== 'subtree' && kind !== 'fingerprint') {
    // This is also where `any` dies (design §5: exec "No: subtree; any" — and
    // the fs class has no wildcard either, see the module header).
    refuse(
      code,
      'matcher-kind-outside-closed-set',
      `a permission resource matcher kind must be exact | subtree | fingerprint, got ${JSON.stringify(kind)}`,
      where,
    )
  }
  const matcherKind = kind as PermissionResourceMatcher['kind']
  if (opClass === 'exec' && matcherKind !== 'fingerprint') {
    refuse(
      code,
      'exec-matcher-must-be-fingerprint',
      `operation class ${JSON.stringify(operationClass)} is shell-class: its matcher is EXACT canonical fingerprint ONLY (design §5: no subtree, no any)`,
      { ...where, operationClass, matcherKind },
    )
  }
  if (opClass === 'fs' && matcherKind === 'fingerprint') {
    refuse(
      code,
      'fs-matcher-must-not-be-fingerprint',
      `operation class ${JSON.stringify(operationClass)} is filesystem-class: its matcher is exact | subtree (design §5)`,
      { ...where, operationClass, matcherKind },
    )
  }
  const matcher: PermissionResourceMatcher = { kind: matcherKind, resource }
  const rendered = renderPermissionResourceText(matcher)
  if (rendered.length > MAX_CARRIER_RESOURCE_LENGTH) {
    refuse(
      code,
      'matcher-resource-over-bound',
      `the rendered overlay resource exceeds the ${String(MAX_CARRIER_RESOURCE_LENGTH)}-char carrier bound`,
      { ...where, length: rendered.length },
    )
  }
  for (let i = 0; i < resource.length; i += 1) {
    const c = resource.charCodeAt(i)
    if (c < 0x20 || c === 0x7f) {
      refuse(code, 'matcher-resource-control-char', 'a canonical identity must not contain control characters', where)
    }
  }
  return deepFreeze({ ...matcher }) as PermissionResourceMatcher
}

// ---------------------------------------------------------------------------
// The unified PermissionMutation model (design §3.4 / ADR §5)
// ---------------------------------------------------------------------------

/**
 * The unified mutation kinds (design §3.4: "Do not create separate systems:
 * grant_instance / update_permission / revoke_permission — they should ALL
 * become PermissionMutation → new PermissionOverlaySnapshot"). ONE shape
 * ({@link PermissionMutationRule} for every kind); the kind is the only
 * difference, and what the kind means is fixed:
 *
 * - `grant_instance` / `update_permission` UPSERT the addressed pairs to the
 *   carried effect (a pair that does not exist yet is created — the unified
 *   pair-set semantics; PR4 layers lifecycle semantics such as no-inheritance
 *   on top of this plumbing, it does not fork it);
 * - `revoke_permission` REMOVES the addressed pairs (the carried effect is
 *   the effect being taken back; removal of a standing rule can only reduce
 *   permissiveness, so it never needs expansion authority).
 */
export const PERMISSION_MUTATION_KINDS = ['grant_instance', 'update_permission', 'revoke_permission'] as const

/** One unified mutation kind. */
export type PermissionMutationKind = (typeof PERMISSION_MUTATION_KINDS)[number]

/** One addressed rule of a mutation (ONE shape for all three kinds). */
export interface PermissionMutationRule {
  /** The closed operation-class token (design §4 operationClass). */
  readonly operationClass: string
  /** The canonical resource matcher (design §4 matcher, design §5 class split). */
  readonly matcher: PermissionResourceMatcher
  /** The effect this mutation carries for the pair (grant/update: the new
   *  effect; revoke: the effect standing at the pair being taken back — a
   *  revoke whose carried effect does not match the durable one is a stale
   *  view and refuses, exactly like the CAS). */
  readonly effect: PermissionOverlayEffect
}

/** The caller-supplied (structural, unvalidated) mutation input. */
export interface PermissionMutationInput {
  readonly kind: PermissionMutationKind
  readonly mutationId: string
  readonly teamSessionId: string
  readonly memberInstanceId: string
  readonly reason: string
  readonly rules: readonly PermissionMutationRule[]
  readonly expectedGeneration?: number
}

/** The validated, frozen mutation. */
export type PermissionMutation = Readonly<PermissionMutationInput>

/** Validate + freeze one mutation input (the structural half of the write
 *  gate; authority and envelope are decided by the service around it). */
export function parsePermissionMutation(raw: PermissionMutationInput): PermissionMutation {
  const where = { field: 'permissionMutation' }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    refuse(PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION, 'mutation-not-a-record', 'a PermissionMutation must be a record', where)
  }
  const kind = raw.kind
  if (!(PERMISSION_MUTATION_KINDS as readonly string[]).includes(String(kind))) {
    refuse(
      PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION,
      'kind-outside-closed-set',
      `a PermissionMutation kind must be one of ${PERMISSION_MUTATION_KINDS.join(', ')} (design §3.4), got ${JSON.stringify(kind)}`,
      { field: 'kind' },
    )
  }
  if (typeof raw.mutationId !== 'string' || raw.mutationId.length === 0 || raw.mutationId.length > 128) {
    refuse(
      PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION,
      'mutation-id-invalid',
      'mutationId must be a non-empty string of at most 128 characters (the ADR §2 provenance identity)',
      { field: 'mutationId' },
    )
  }
  for (const i of raw.mutationId) {
    const c = i.charCodeAt(0)
    if (c < 0x20 || c === 0x7f) {
      refuse(PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION, 'mutation-id-control-char', 'mutationId must not contain control characters', { field: 'mutationId' })
    }
  }
  if (typeof raw.reason !== 'string' || raw.reason.length > 512) {
    refuse(
      PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION,
      'reason-over-bound',
      'reason must be a string of at most 512 characters (the PR1 provenance bound, PERMISSION_OVERLAY_MAX_REASON_LENGTH)',
      { field: 'reason' },
    )
  }
  if (!Array.isArray(raw.rules) || raw.rules.length === 0) {
    refuse(
      PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION,
      'rules-non-empty-array',
      'a PermissionMutation addresses at least one (operationClass, matcher) pair',
      { field: 'rules' },
    )
  }
  const rules: PermissionMutationRule[] = []
  const seen = new Set<string>()
  for (const [index, entry] of raw.rules.entries()) {
    const ruleWhere = { field: `rules[${String(index)}]` }
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      refuse(PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION, 'rule-not-a-record', 'an addressed mutation rule must be a record', ruleWhere)
    }
    const operationClass = entry.operationClass
    if (typeof operationClass !== 'string' || operationClass.length === 0 || operationClass.length > 128) {
      refuse(
        PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION,
        'operation-class-invalid',
        'operationClass must be a non-empty token of at most 128 characters (the PR1 operation-token grammar)',
        ruleWhere,
      )
    }
    const opClass = classifyPermissionOperationClass(operationClass)
    if (opClass === 'unknown') {
      refuse(
        PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION,
        'operation-class-unknown',
        `operation class ${JSON.stringify(operationClass)} is outside the closed permission vocabulary (the A2 file tools + the shell class) — a typo'd class is refused at the authority, never stored inert`,
        { ...ruleWhere, operationClass },
      )
    }
    const effect = entry.effect
    if (effect !== 'allow' && effect !== 'ask' && effect !== 'deny') {
      refuse(
        PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION,
        'effect-outside-closed-set',
        `a mutation effect must be allow | ask | deny, got ${JSON.stringify(effect)}`,
        { ...ruleWhere, effect },
      )
    }
    const matcher = validateMatcher(
      entry.matcher,
      operationClass,
      opClass,
      PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION,
      ruleWhere,
    )
    const pairKey = `${operationClass}\u0000${renderPermissionResourceText(matcher)}`
    if (seen.has(pairKey)) {
      refuse(
        PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION,
        'duplicate-addressed-pair',
        'a mutation addresses each (operationClass, resource) pair at most once',
        { ...ruleWhere, operationClass },
      )
    }
    seen.add(pairKey)
    rules.push(deepFreeze({ operationClass, matcher, effect }) as PermissionMutationRule)
  }
  if (raw.expectedGeneration !== undefined) {
    const g = raw.expectedGeneration
    if (!Number.isSafeInteger(g) || g < 0) {
      refuse(
        PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION,
        'expected-generation-invalid',
        'expectedGeneration must be a safe integer >= 0 (0 = "no snapshot exists yet")',
        { field: 'expectedGeneration' },
      )
    }
  }
  return deepFreeze({
    kind,
    mutationId: raw.mutationId,
    teamSessionId: raw.teamSessionId,
    memberInstanceId: raw.memberInstanceId,
    reason: raw.reason,
    rules,
    ...(raw.expectedGeneration !== undefined ? { expectedGeneration: raw.expectedGeneration } : {}),
  }) as PermissionMutation
}

// ---------------------------------------------------------------------------
// The §6 envelope (the ONE canonical permission-change envelope model)
// ---------------------------------------------------------------------------

/** One envelope rule (design §4 recommended conceptual form, verbatim shape). */
export interface PermissionEnvelopeRule {
  readonly operationClass: string
  readonly matcher: PermissionResourceMatcher
  readonly maximumEffect: PermissionOverlayEffect
}

/** The envelope document: the Leader's expansion authority for one team. */
export interface PermissionMutationEnvelope {
  readonly rules: readonly PermissionEnvelopeRule[]
}

/** Validate + freeze one envelope document. An empty `rules` list is VALID
 *  and means exactly one thing: NO expansion authority (every Leader
 *  expansion refuses; tightenings are unaffected) — fail-closed default. */
export function parsePermissionMutationEnvelope(raw: unknown): PermissionMutationEnvelope {
  const code = PERMISSION_MUTATION_ERROR_CODES.MALFORMED_ENVELOPE
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    refuse(code, 'envelope-not-a-record', 'a PermissionMutationEnvelope must be a record { rules }', { field: 'envelope' })
  }
  const value = raw as { rules?: unknown }
  if (!Array.isArray(value.rules)) {
    refuse(code, 'rules-not-an-array', 'a PermissionMutationEnvelope must carry a rules array (possibly empty)', { field: 'envelope.rules' })
  }
  const rules: PermissionEnvelopeRule[] = []
  const seen = new Set<string>()
  for (const [index, entry] of value.rules.entries()) {
    const ruleWhere = { field: `envelope.rules[${String(index)}]` }
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      refuse(code, 'rule-not-a-record', 'an envelope rule must be a record', ruleWhere)
    }
    const operationClass = (entry as { operationClass?: unknown }).operationClass
    if (typeof operationClass !== 'string' || operationClass.length === 0 || operationClass.length > 128) {
      refuse(code, 'operation-class-invalid', 'an envelope rule must name a non-empty operationClass token', ruleWhere)
    }
    const opClass = classifyPermissionOperationClass(operationClass)
    if (opClass === 'unknown') {
      refuse(
        code,
        'operation-class-unknown',
        `envelope operation class ${JSON.stringify(operationClass)} is outside the closed permission vocabulary — an envelope rule the permission plane cannot speak about is refused, never silently inert`,
        { ...ruleWhere, operationClass },
      )
    }
    const maximumEffect = (entry as { maximumEffect?: unknown }).maximumEffect
    if (maximumEffect !== 'allow' && maximumEffect !== 'ask' && maximumEffect !== 'deny') {
      refuse(code, 'maximum-effect-outside-closed-set', 'maximumEffect must be allow | ask | deny', { ...ruleWhere, maximumEffect })
    }
    const matcher = validateMatcher(
      (entry as { matcher?: unknown }).matcher,
      operationClass,
      opClass,
      code,
      ruleWhere,
    )
    const pairKey = `${operationClass}\u0000${renderPermissionResourceText(matcher)}`
    if (seen.has(pairKey)) {
      refuse(code, 'duplicate-envelope-pair', 'an envelope carries each (operationClass, resource) pair at most once (its most permissive entry is what coverage would use — duplicates are a document defect)', ruleWhere)
    }
    seen.add(pairKey)
    rules.push(deepFreeze({ operationClass, matcher, maximumEffect }) as PermissionEnvelopeRule)
  }
  return deepFreeze({ rules }) as PermissionMutationEnvelope
}

// ---------------------------------------------------------------------------
// Coverage (matcher algebra) — the containment verdict is INJECTED
// ---------------------------------------------------------------------------

/** The containment predicate over two canonical identities of the SAME
 *  backend namespace. Production injects the pinned public containment seam
 *  (the A2C-7 precedent: the frozen matcher itself never `startsWith` —
 *  `operation-permission/permission-resolver.ts` A2C-7 paragraph); tests
 *  inject a deterministic algebra. Absent → subtree coverage fails closed. */
export type SubtreeContains = (root: string, child: string) => boolean

/** The outcome of one coverage question (the refusal detail stays explainable). */
export interface CoverageVerdict {
  readonly covers: boolean
  /** True when a subtree envelope matcher needed a containment verdict that
   *  no injected predicate could give (fail-closed refusal, never a guess). */
  readonly undeterminable: boolean
}

/**
 * Does an envelope matcher cover a mutation matcher?
 *
 * - `fingerprint` covers ONLY the identical fingerprint — exec is exact-only
 *   in BOTH documents (design §5), so a fingerprint envelope rule can never
 *   widen (no subtree, no `any`, no prefix reading of an opaque `sha256:`);
 * - `exact` covers ONLY the identical exact (one canonical identity, one
 *   authority identity — the A2C-1 lesson: a bash authority never gates a
 *   pwsh operation; here: file A never stands in for file B);
 * - `subtree` covers exact/subtree identities the injected containment
 *   predicate places under its root (identity counts as contained: a root
 *   covers itself); cross-class coverage never holds.
 */
export function matcherCovers(
  envelope: PermissionResourceMatcher,
  target: PermissionResourceMatcher,
  subtreeContains?: SubtreeContains,
): CoverageVerdict {
  if (envelope.kind === 'fingerprint' || target.kind === 'fingerprint') {
    const covers = envelope.kind === 'fingerprint' && target.kind === 'fingerprint' && envelope.resource === target.resource
    return { covers, undeterminable: false }
  }
  if (envelope.kind === 'exact') {
    return { covers: target.kind === 'exact' && envelope.resource === target.resource, undeterminable: false }
  }
  // envelope.kind === 'subtree'
  if (subtreeContains === undefined) {
    return { covers: false, undeterminable: true }
  }
  if (envelope.resource === target.resource) return { covers: true, undeterminable: false }
  return { covers: subtreeContains(envelope.resource, target.resource), undeterminable: false }
}

/** The envelope answer to one expansion step (ADR §6: the covering rule
 *  names BOTH the matcher and the maximum-effect ceiling). */
export function envelopeAuthorizesExpansion(
  envelope: PermissionMutationEnvelope,
  operationClass: string,
  matcher: PermissionResourceMatcher,
  toEffect: PermissionOverlayEffect,
  subtreeContains?: SubtreeContains,
): { readonly authorized: boolean; readonly undeterminable: boolean } {
  let undeterminable = false
  for (const rule of envelope.rules) {
    if (rule.operationClass !== operationClass) continue
    if (PERMISSION_EFFECT_PRECEDENCE[toEffect] > PERMISSION_EFFECT_PRECEDENCE[rule.maximumEffect]) continue
    const verdict = matcherCovers(rule.matcher, matcher, subtreeContains)
    if (verdict.covers) return { authorized: true, undeterminable: false }
    if (verdict.undeterminable) undeterminable = true
  }
  return { authorized: false, undeterminable }
}

// ---------------------------------------------------------------------------
// The pure planning step: (authority snapshot, mutation) -> next snapshot
// ---------------------------------------------------------------------------

/** One expansion a Leader mutation attempts (the service checks each against
 *  the envelope; Human mutations skip the check by ADR §7). */
export interface RequiredExpansion {
  readonly operationClass: string
  readonly resource: string
  readonly from: PermissionOverlayEffect
  readonly to: PermissionOverlayEffect
  readonly matcher: PermissionResourceMatcher
}

/** The plan of one mutation against the current authority snapshot. */
export type PermissionMutationPlan =
  | {
      readonly changed: true
      /** The FULL next rule set (a snapshot, never a delta — ADR §2). */
      readonly rules: readonly PermissionOverlayRule[]
      readonly expansions: readonly RequiredExpansion[]
    }
  | { readonly changed: false; readonly reason: 'no-change' }

/** The pair key inside a rule set: the operation-class token + the rendered
 *  carrier text (the PR1 duplicate-rule-pair identity, schema parseState). */
function pairKey(operation: string, resource: string): string {
  return `${operation}\u0000${resource}`
}

/**
 * Plan one mutation against the current authority snapshot (pure): produce
 * the FULL next rule set and the expansions it performs, or the typed
 * no-change. The absence baseline is `deny` (fail-closed, module header).
 *
 * A revoke carrying an effect that does NOT match the durable effect at the
 * addressed pair is a STALE VIEW and refuses with MALFORMED_MUTATION's
 * sibling — no: it refuses GENERATION_CONFLICT-shaped staleness through the
 * CAS by design (the expectedGeneration guard is the honest staleness
 * signal); the carried-effect mismatch itself refuses as
 * MALFORMED_MUTATION/problem `revoke-effect-mismatch`, still ZERO write.
 */
export function planPermissionMutation(
  latest: PermissionOverlaySnapshot | undefined,
  mutation: PermissionMutation,
): PermissionMutationPlan {
  const base = new Map<string, PermissionOverlayRule>()
  if (latest !== undefined) {
    for (const rule of latest.state.rules) base.set(pairKey(rule.operation, rule.resource), rule)
  }
  const expansions: RequiredExpansion[] = []
  let changed = false
  if (mutation.kind === 'revoke_permission') {
    for (const rule of mutation.rules) {
      const resource = renderPermissionResourceText(rule.matcher)
      const key = pairKey(rule.operationClass, resource)
      const standing = base.get(key)
      if (standing === undefined) continue // revoking what never existed: contributes nothing
      if (standing.effect !== rule.effect) {
        refuse(
          PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION,
          'revoke-effect-mismatch',
          `the revoke carries effect ${JSON.stringify(rule.effect)} but the durable pair stands at ${JSON.stringify(standing.effect)} — read the current generation and address what actually stands (zero write)`,
          { operationClass: rule.operationClass, resource, carried: rule.effect, durable: standing.effect },
        )
      }
      base.delete(key)
      changed = true
    }
  } else {
    for (const rule of mutation.rules) {
      const resource = renderPermissionResourceText(rule.matcher)
      const key = pairKey(rule.operationClass, resource)
      const standing = base.get(key)
      const from: PermissionOverlayEffect = standing === undefined ? 'deny' : standing.effect
      if (permissionEffectDirection(from, rule.effect) === 'expansion') {
        expansions.push({
          operationClass: rule.operationClass,
          resource,
          from,
          to: rule.effect,
          matcher: rule.matcher,
        })
      }
      if (standing !== undefined && standing.effect === rule.effect) continue // identity at the pair
      base.set(key, deepFreeze({ operation: rule.operationClass, resource, effect: rule.effect }) as PermissionOverlayRule)
      changed = true
    }
  }
  if (!changed) return { changed: false, reason: 'no-change' }
  if (base.size > MAX_RULES_BOUND) {
    refuse(
      PERMISSION_MUTATION_ERROR_CODES.MALFORMED_MUTATION,
      'resulting-rule-set-over-bound',
      `the resulting snapshot would carry ${String(base.size)} rules; the structural bound is ${String(MAX_RULES_BOUND)}`,
      { bound: MAX_RULES_BOUND, resulting: base.size },
    )
  }
  // Deterministic order (declaration order of the prior snapshot, then the
  // upserted new pairs): the full-snapshot bytes are a pure function of the
  // chain, so a byte-identical replay stays idempotent at the PR1 store.
  const rules = [...base.values()]
  return { changed: true, rules, expansions }
}

/** The PR1 structural rule-set bound (storage
 *  schema/permission-overlay.ts PERMISSION_OVERLAY_MAX_RULES). Imported as a
 *  VALUE it would join the storage runtime graph (a TYPE-only lane is the PR2
 *  discipline), so the bound is mirrored here and PINNED equal by the PR3
 *  spec — drift makes the pin red, which is the point. */
const MAX_RULES_BOUND = 256
