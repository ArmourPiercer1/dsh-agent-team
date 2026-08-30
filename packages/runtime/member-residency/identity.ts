/**
 * The DERIVED stable member identity — the spec → identity derivation of
 * the member create/resume residency (P5-T6; DevPlan §18.5; TaskDoc §11.5
 * P5-T6 card).
 *
 * The {@link MemberCreateSpec} is the canonical identity input of ONE
 * member slot of the Team (the coordinator's provisioning request,
 * DevPlan §18.1). The derivation is DETERMINISTIC and PURE: a re-drive of
 * the same spec ALWAYS reconstructs the same
 * `(instanceId, childSessionId)` (Architecture §18.2 stable identity —
 * the I1c replay-convergence property), and a different spec derives a
 * different identity (a different logical creation; the coordinator
 * guarantees spec uniqueness within a team, so no collision is possible
 * inside one TeamSession's member space).
 *
 * Identity layout:
 *
 * - `instanceId` = `'inst-' + token(specString, 12)` — satisfies the
 *   contracts v1 `INSTANCE_ID_PATTERN` (`^inst-[a-z0-9]{1,32}$`);
 * - `childSessionId` = `'session-child-' + token(specString, 16)` — an
 *   opaque session id (<= 255 chars, no control chars / whitespace) that
 *   the fresh path durably binds to the instance (invariant 23) and that
 *   is NEVER re-pointed (invariant 24).
 *
 * where `specString` is the canonical concatenation
 * `[rootSessionId, templateId, label, groupId ?? '', workspace ?? '']`
 * joined by the NUL character (`\u0000`). The join is UNAMBIGUOUS
 * because every field has been validated control-char-free (the label /
 * groupId / workspace rules) or whitespace- + control-char-free (the
 * session-id rules) BEFORE concatenation — no field can contain the
 * separator.
 *
 * The token algorithm (`memberResidencyToken`) is a BYTE-IDENTICAL
 * mirror of `packages/storage/provisioning/identity.ts#deterministicToken`
 * (iterated FNV-1a 32-bit over the input, rendered in base36): pure,
 * dependency-free (no `node:` builtin, no `crypto`), stable across
 * processes and restarts, and collision-safe for the identity space of
 * one TeamSession. The runtime package keeps the P5-T5 discipline of a
 * TYPE-ONLY dependency on the storage package in production code, so
 * this module carries its own copy of the algorithm; the p5t6 unit tests
 * cross-verify the mirror against the storage original (value imports
 * from storage are permitted in test files) so the two can never
 * diverge silently.
 *
 * This module emits NO identity from labels or template ids alone
 * (invariant 19): the spec as a WHOLE is the input, and the derived ids
 * are the only runtime identities.
 *
 * Pure module: no I/O, no host imports, no `node:` builtins.
 *
 * @module @dsh-agent-team/runtime/member-residency/identity
 */

import { MEMBER_RESIDENCY_ERROR_CODES, MemberResidencyError } from './errors.js'
import type { DerivedMemberIdentity, MemberCreateSpec, MemberIdentityInput } from './types.js'

/** The base36 alphabet (exactly the `[a-z0-9]` charset the id patterns allow). */
const BASE36 = '0123456789abcdefghijklmnopqrstuvwxyz'

/** The FNV-1a 32-bit prime (mirror of the storage original). */
const FNV_PRIME = 0x01000193
/** The FNV-1a 32-bit offset basis (mirror of the storage original). */
const FNV_OFFSET = 0x811c9dc5

/** The contracts v1 instance id pattern (mirror, for the derived-id self-check). */
const INSTANCE_ID_PATTERN = /^inst-[a-z0-9]{1,32}$/

/** The contracts v1 template id pattern (mirror of `TEMPLATE_ID_PATTERN`). */
const TEMPLATE_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/

/** Structural max length of a DSH session id (mirror of `SESSION_ID_MAX_LENGTH`). */
const SESSION_ID_MAX_LENGTH = 255
/** Structural max length of a human-facing label / opaque groupId (mirror of the contracts DTO rules). */
const LABEL_MAX_LENGTH = 128
/** Structural max length of a workspace path field (mirror of the contracts DTO rules). */
const WORKSPACE_PATH_MAX_LENGTH = 1024

/**
 * One 32-bit FNV-1a pass over `s`, seeded with `seed ^ FNV_OFFSET`,
 * returned as an unsigned 32-bit integer (mirror of the storage original).
 */
function fnv1a32(s: string, seed: number): number {
  let h = (seed ^ FNV_OFFSET) >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i) & 0xff
    h = Math.imul(h, FNV_PRIME) >>> 0
  }
  return h >>> 0
}

/**
 * Encode an unsigned 32-bit integer as exactly `width` base36 characters
 * (zero-padded on the left, most-significant digit first) — mirror of the
 * storage original.
 */
function base36Encode32(value: number, width: number): string {
  let out = ''
  let n = value >>> 0
  for (let k = 0; k < width; k++) {
    out = BASE36.charAt(n % 36) + out
    n = Math.floor(n / 36)
  }
  return out
}

/**
 * A deterministic `[a-z0-9]` token of `s`: the
 * concatenation of several FNV-1a passes (different seeds) rendered in
 * base36, truncated to `length`.
 *
 * BYTE-IDENTICAL MIRROR of
 * `packages/storage/provisioning/identity.ts#deterministicToken` (kept
 * local because production runtime code carries only a type-only
 * dependency on storage; the p5t6 unit tests cross-verify both
 * implementations). Pure and stable; NOT cryptographic (identity
 * disambiguation only, within one TeamSession's member space).
 *
 * @param s - the string to tokenize.
 * @param length - the token length (must be >= 1 and <= 56 for this scheme).
 * @returns the base36 token of exactly `length` characters.
 */
export function memberResidencyToken(s: string, length: number): string {
  if (length < 1 || length > 56) {
    throw new RangeError(`memberResidencyToken: length must be in [1,56], got ${length}`)
  }
  let out = ''
  // 7 passes x 7 base36 chars = 49 chars available; up to 56 needs 8 passes.
  const passes = Math.ceil(length / 7)
  for (let seed = 0; seed < passes && out.length < length; seed++) {
    out += base36Encode32(fnv1a32(s, seed), 7)
  }
  return out.slice(0, length)
}

/**
 * Assert a session-id-like value: non-empty string, <= 255 chars, no
 * ASCII control characters (0x00-0x1F, 0x7F), no whitespace (mirror of
 * the contracts v1 session-id boundary rules).
 * @param field - the field name, used in the error.
 * @param value - the raw value.
 */
function assertSessionIdLike(field: string, value: unknown): void {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > SESSION_ID_MAX_LENGTH
  ) {
    throw new MemberResidencyError(
      MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_INVALID_INPUT,
      `member spec field '${field}' must be a non-empty string of at most ${SESSION_ID_MAX_LENGTH} chars (got ${JSON.stringify(value)})`,
      { field, length: typeof value === 'string' ? value.length : undefined },
    )
  }
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code < 0x20 || code === 0x7f) {
      throw new MemberResidencyError(
        MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_INVALID_INPUT,
        `member spec field '${field}' must not contain control characters`,
        { field },
      )
    }
  }
  if (/\s/.test(value)) {
    throw new MemberResidencyError(
      MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_INVALID_INPUT,
      `member spec field '${field}' must not contain whitespace`,
      { field },
    )
  }
}

/**
 * Assert a label-like value (label / groupId): non-empty string,
 * <= 128 chars, no ASCII control characters (mirror of the contracts v1
 * `parseLabelLikeField` rules).
 * @param field - the field name, used in the error.
 * @param value - the raw value.
 */
function assertLabelLike(field: string, value: unknown): void {
  if (typeof value !== 'string' || value.length === 0 || value.length > LABEL_MAX_LENGTH) {
    throw new MemberResidencyError(
      MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_INVALID_INPUT,
      `member spec field '${field}' must be a non-empty string of at most ${LABEL_MAX_LENGTH} chars (got ${JSON.stringify(value)})`,
      { field, length: typeof value === 'string' ? value.length : undefined },
    )
  }
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code < 0x20 || code === 0x7f) {
      throw new MemberResidencyError(
        MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_INVALID_INPUT,
        `member spec field '${field}' must not contain control characters`,
        { field },
      )
    }
  }
}

/**
 * Assert a workspace value: non-empty string, <= 1024 chars, no ASCII
 * control characters (mirror of the contracts v1 `parseWorkspaceField`
 * rules). Workspace paths never define Team identity (invariant 27).
 * @param field - the field name, used in the error.
 * @param value - the raw value.
 */
function assertWorkspace(field: string, value: unknown): void {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > WORKSPACE_PATH_MAX_LENGTH
  ) {
    throw new MemberResidencyError(
      MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_INVALID_INPUT,
      `member spec field '${field}' must be a non-empty string of at most ${WORKSPACE_PATH_MAX_LENGTH} chars (got ${JSON.stringify(value)})`,
      { field, length: typeof value === 'string' ? value.length : undefined },
    )
  }
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code < 0x20 || code === 0x7f) {
      throw new MemberResidencyError(
        MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_INVALID_INPUT,
        `member spec field '${field}' must not contain control characters`,
        { field },
      )
    }
  }
}

/**
 * Validate a member creation spec fail-closed (NO effect on any failure:
 * every check runs before any durable write or binder step).
 *
 * Rules (mirrors of the contracts v1 boundary rules; the repository
 * re-validates the DTOs at put time — this validation is the EARLY,
 * effect-free gate of the module):
 *
 * - `spec` must be a plain object;
 * - `rootSessionId` — session-id rules (non-empty, <= 255, no control
 *   chars, no whitespace);
 * - `templateId` — the contracts v1 template-id pattern;
 * - `label` — label rules (non-empty, <= 128, no control chars);
 * - `groupId` (optional) — label rules when present;
 * - `workspace` (optional) — workspace rules (non-empty, <= 1024, no
 *   control chars) when present.
 *
 * @param spec - the member creation spec.
 * @throws {@link MemberResidencyError} (`MEMBER_RESIDENCY_INVALID_INPUT`)
 *   with the offending `field` in `details`.
 */
export function validateMemberCreateSpec(spec: MemberCreateSpec): void {
  if (typeof spec !== 'object' || spec === null || Array.isArray(spec)) {
    throw new MemberResidencyError(
      MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_INVALID_INPUT,
      'member spec must be a plain object',
      { field: 'spec' },
    )
  }
  assertSessionIdLike('rootSessionId', spec.rootSessionId)
  if (typeof spec.templateId !== 'string' || !TEMPLATE_ID_PATTERN.test(spec.templateId)) {
    throw new MemberResidencyError(
      MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_INVALID_INPUT,
      `member spec field 'templateId' must match ${TEMPLATE_ID_PATTERN} (got ${JSON.stringify(spec.templateId)})`,
      { field: 'templateId' },
    )
  }
  assertLabelLike('label', spec.label)
  if (spec.groupId !== undefined) {
    assertLabelLike('groupId', spec.groupId)
  }
  if (spec.workspace !== undefined) {
    assertWorkspace('workspace', spec.workspace)
  }
}

/**
 * The canonical spec string — the single input of the identity tokens.
 *
 * `[rootSessionId, templateId, label, groupId ?? '', workspace ?? '']`
 * joined by `\u0000`. Unambiguous: no field contains the separator
 * (control-char-free by validation). Absent optional fields contribute
 * the empty string, so `{...spec, groupId: undefined}` and `{...spec}`
 * derive the SAME identity (absence is not a distinct value).
 *
 * @param spec - the member creation spec (validated first).
 * @returns the canonical spec string.
 */
export function canonicalMemberSpecString(spec: MemberCreateSpec): string {
  validateMemberCreateSpec(spec)
  return [
    spec.rootSessionId,
    spec.templateId,
    spec.label,
    spec.groupId ?? '',
    spec.workspace ?? '',
  ].join('\u0000')
}

/**
 * Validate a composite member identity (cold resume / evict input)
 * fail-closed (NO effect on any failure):
 *
 * - `input` must be a plain object;
 * - `rootSessionId` — session-id rules (non-empty, <= 255, no control
 *   chars, no whitespace);
 * - `instanceId` — the contracts v1 instance-id pattern.
 *
 * @param input - the composite member identity.
 * @throws {@link MemberResidencyError} (`MEMBER_RESIDENCY_INVALID_INPUT`)
 *   with the offending `field` in `details`.
 */
export function validateMemberIdentityInput(input: MemberIdentityInput): void {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new MemberResidencyError(
      MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_INVALID_INPUT,
      'member identity must be a plain object',
      { field: 'input' },
    )
  }
  assertSessionIdLike('rootSessionId', input.rootSessionId)
  if (typeof input.instanceId !== 'string' || !INSTANCE_ID_PATTERN.test(input.instanceId)) {
    throw new MemberResidencyError(
      MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_INVALID_INPUT,
      `member identity field 'instanceId' must match ${INSTANCE_ID_PATTERN} (got ${JSON.stringify(input.instanceId)})`,
      { field: 'instanceId' },
    )
  }
}

/**
 * Derive the stable member identity from its creation spec
 * (see the module docs for the layout and determinism guarantees).
 *
 * @param spec - the member creation spec.
 * @returns the derived `{ instanceId, childSessionId }`.
 * @throws {@link MemberResidencyError} (`MEMBER_RESIDENCY_INVALID_INPUT`)
 *   when the spec is structurally invalid.
 */
export function deriveMemberIdentity(spec: MemberCreateSpec): DerivedMemberIdentity {
  validateMemberCreateSpec(spec)
  const specString = canonicalMemberSpecString(spec)
  const instanceId = `inst-${memberResidencyToken(specString, 12)}`
  const childSessionId = `session-child-${memberResidencyToken(specString, 16)}`
  // Defense in depth: the token alphabet is `[a-z0-9]` by construction; assert the derived ids against the contracts patterns
  // so any future drift in the mirror fails here, not at the repository.
  if (!INSTANCE_ID_PATTERN.test(instanceId)) {
    throw new MemberResidencyError(
      MEMBER_RESIDENCY_ERROR_CODES.MEMBER_RESIDENCY_INVALID_INPUT,
      `derived instanceId '${instanceId}' violates the contracts instance-id pattern`,
      { field: 'instanceId' },
    )
  }
  assertSessionIdLike('childSessionId', childSessionId)
  return { instanceId, childSessionId }
}
