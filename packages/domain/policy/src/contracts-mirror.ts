/**
 * Local mirror of the contracts-v1 surface consumed by the policy resolver
 * (P3-T4).
 *
 * ## Why a mirror instead of importing `@dsh-agent-team/contracts`
 *
 * The package-level typecheck (`tsc -p packages/domain/tsconfig.json`,
 * owned by the P1-T4 skeleton, not by P3-T4) compiles this package's
 * `src` and `test` trees with an explicit `rootDir` = the package
 * directory, and TS6059 forbids any non-declaration source file outside
 * that root from entering the program. In this repo phase that rules out
 * every direct import of the contracts package:
 *
 * - the bare specifier `@dsh-agent-team/contracts` resolves to
 *   `packages/contracts/dist/**`, which is not built (the canonical
 *   P3-T4 chain has no build step) and is not a declared dependency of
 *   `@dsh-agent-team/domain`;
 * - a relative source import (`../../../contracts/src/index.js`) pulls the
 *   contracts `.ts` sources into this program and violates `rootDir`.
 *
 * The mirror therefore re-declares EXACTLY the contracts-v1 surface the
 * resolver consumes — nothing more — inside the P3-T4 owned path, faithful
 * to the frozen contract (`packages/contracts/src`):
 *
 * | mirror symbol                    | contracts v1 source  | rule preserved |
 * | -------------------------------- | -------------------- | -------------- |
 * | `RootSessionId`/`TeamSessionId`, `parseRootSessionId`, `parseTeamSessionId` | `ids/session-id.ts` | `TeamSessionId = RootSessionId` (invariant 9); non-empty, ≤ 255 chars, no control characters, no whitespace |
 * | `InstanceId`, `parseInstanceId`  | `ids/instance-id.ts` | `inst-` + 1–32 lowercase alphanumerics |
 * | `MemberIdentity`, `LEADER_INSTANCE_ID`, `createMemberIdentity`, `leaderMemberIdentityOf`, `assertMemberIdentityInTeam` | `identity.ts` | composite identity key (invariant 18), deep-frozen identity, cross-scope guard |
 * | `deepFreeze`                     | `remote-safe.ts`     | lossless-JSON assertion + deep freeze |
 *
 * Two deliberate, documented differences from the contracts module:
 *
 * 1. **Brands are erased.** contracts v1 brands ids as
 *    `string & Brand<Name>` — a compile-time-only tag with NO runtime
 *    representation. The mirror uses plain `string` aliases, which keeps
 *    real contracts-v1 branded values assignable to this API (a branded
 *    string is a subtype of `string`) without importing the brand
 *    machinery.
 * 2. **Errors are the policy's own.** Boundary violations throw
 *    {@link PolicyResolutionError}: `MALFORMED_POLICY_INPUT` for malformed
 *    ids, and `IDENTITY_SCOPE_MISMATCH` for a cross-scope member identity —
 *    the latter keeps the contracts-v1 code string so the downstream
 *    vocabulary stays recognizable, while the package keeps ONE public
 *    error type.
 *
 * When the repo's build wiring makes `@dsh-agent-team/contracts`
 * resolvable (built `dist` + declared workspace dependency), this mirror
 * can be retired and the imports switched to the real package; the public
 * surface here is a strict subset of it.
 *
 * Pure module: no I/O, no DSH imports, no ambient state.
 * @module @dsh-agent-team/domain/policy/contracts-mirror
 */

import { POLICY_ERROR_CODES, PolicyResolutionError } from './errors.js'

/** A DSH session id (generic context): the opaque upstream session identity. */
export type RootSessionId = string

/**
 * The TeamSession id.
 *
 * Frozen (invariant 9): `TeamSessionId = RootSessionId` — a TeamSession is
 * identified by its root DSH session id; no separate TeamSession UUID is
 * minted (Architecture §8.2).
 */
export type TeamSessionId = RootSessionId

/**
 * The stable runtime identity of one MemberInstance, unique within its
 * TeamSession (invariant 18: the composite `(rootSessionId, instanceId)`
 * key is the member's runtime identity).
 */
export type InstanceId = string

/**
 * The composite runtime identity of one MemberInstance, including the
 * (special) LeaderInstance (invariant 18).
 */
export interface MemberIdentity {
  /** The TeamSession the member belongs to (its root session id, invariant 9). */
  readonly rootSessionId: RootSessionId
  /** The member's stable instance id, unique within that TeamSession. */
  readonly instanceId: InstanceId
}

/** Reserved instance id of the LeaderInstance of a TeamSession. */
export const LEADER_INSTANCE_ID: InstanceId = 'inst-leader'

/** Maximum structural length of any DSH session id in vNext contracts. */
export const SESSION_ID_MAX_LENGTH = 255

/** The single strict format of an instance id. */
export const INSTANCE_ID_PATTERN = /^inst-[a-z0-9]{1,32}$/

/** Structural max length: `inst-` (5) + 32 alphanumerics. */
export const INSTANCE_ID_MAX_LENGTH = 37

/** Rejects ASCII control characters and DEL (0x00–0x1F, 0x7F). */
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

/** Rejects any Unicode whitespace character. */
function hasWhitespace(value: string): boolean {
  return /\s/.test(value)
}

/** A policy boundary error for a malformed input field. */
function malformed(field: string, problem: string): PolicyResolutionError {
  return new PolicyResolutionError(
    POLICY_ERROR_CODES.MALFORMED_POLICY_INPUT,
    `malformed policy input at ${field}: ${problem}`,
    { field, problem },
  )
}

/**
 * Shared structural string rules (contracts v1 `ids/common.ts`): non-empty,
 * at most `maxLength` characters, no control characters, no whitespace.
 */
function assertStringRules(value: string, field: string, maxLength: number): void {
  if (value.length === 0) {
    throw malformed(field, 'must not be empty')
  }
  if (value.length > maxLength) {
    throw malformed(field, `exceeds max length ${maxLength} (got ${value.length})`)
  }
  if (hasControlChars(value)) {
    throw malformed(field, 'must not contain control characters')
  }
  if (hasWhitespace(value)) {
    throw malformed(field, 'must not contain whitespace')
  }
}

/**
 * Parse and validate a root session id.
 *
 * vNext boundary rule (contracts v1 `ids/session-id.ts`): the upstream DSH
 * session id is an opaque branded string minted as `session-<n>` by the
 * session store, so only structurally unusable values are rejected:
 * non-empty, ≤ 255 chars, no control characters, no whitespace.
 */
export function parseRootSessionId(raw: unknown): RootSessionId {
  if (typeof raw !== 'string') {
    throw malformed('rootSessionId', `must be a string, got ${typeof raw}`)
  }
  assertStringRules(raw, 'rootSessionId', SESSION_ID_MAX_LENGTH)
  return raw
}

/**
 * Parse and validate a TeamSession id.
 *
 * Identical rule to the root session id (invariant 9: the values ARE
 * identical); the error `field` reports the actual input path
 * (`teamSessionId`) for explainability.
 */
export function parseTeamSessionId(raw: unknown): TeamSessionId {
  if (typeof raw !== 'string') {
    throw malformed('teamSessionId', `must be a string, got ${typeof raw}`)
  }
  assertStringRules(raw, 'teamSessionId', SESSION_ID_MAX_LENGTH)
  return raw
}

/**
 * Parse and validate an instance id (contracts v1 `ids/instance-id.ts`):
 * `inst-` + 1–32 lowercase alphanumerics, plus the shared structural
 * string rules.
 */
export function parseInstanceId(raw: unknown): InstanceId {
  if (typeof raw !== 'string') {
    throw malformed('instanceId', `must be a string, got ${typeof raw}`)
  }
  assertStringRules(raw, 'instanceId', INSTANCE_ID_MAX_LENGTH)
  if (!INSTANCE_ID_PATTERN.test(raw)) {
    throw malformed(
      'instanceId',
      `must match inst-<1..32 lowercase alphanumerics>, got ${JSON.stringify(raw)}`,
    )
  }
  return raw
}

/**
 * Build a member identity from its two components.
 *
 * Both inputs must already be parsed (use the `parse*` functions first).
 * The result is deeply frozen: identities are immutable values.
 */
export function createMemberIdentity(
  rootSessionId: RootSessionId,
  instanceId: InstanceId,
): MemberIdentity {
  return deepFreeze({ rootSessionId, instanceId })
}

/**
 * Build the member identity of the (special) LeaderInstance of a
 * TeamSession, using the reserved `inst-leader` id.
 */
export function leaderMemberIdentityOf(teamSessionId: TeamSessionId): MemberIdentity {
  return createMemberIdentity(teamSessionId, LEADER_INSTANCE_ID)
}

/**
 * Assert that a member identity belongs to the given TeamSession.
 *
 * The guard against cross-TeamSession confusion (invariant 18): an
 * identity minted under root A must never be accepted in the context of
 * root B, even when the `instanceId` values collide.
 *
 * @throws {@link PolicyResolutionError} with code
 *   `IDENTITY_SCOPE_MISMATCH` when the roots differ.
 */
export function assertMemberIdentityInTeam(
  identity: MemberIdentity,
  teamSessionId: TeamSessionId,
): void {
  if (identity.rootSessionId !== teamSessionId) {
    throw new PolicyResolutionError(
      POLICY_ERROR_CODES.IDENTITY_SCOPE_MISMATCH,
      `member identity belongs to TeamSession '${identity.rootSessionId}' but was used in TeamSession '${teamSessionId}'; instanceId values are only unique within one TeamSession`,
      {
        field: 'member',
        identityRootSessionId: identity.rootSessionId,
        teamSessionId,
        instanceId: identity.instanceId,
      },
    )
  }
}

/** A record whose keys are strings and whose values are lossless-JSON. */
type LosslessRecord = { [key: string]: unknown }

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * Deep-check whether `value` is a lossless-JSON value (mirrors contracts
 * v1 `remote-safe.ts`): `null`, boolean, finite number, string, plain
 * array, or plain object (prototype `Object.prototype` or `null`) only.
 */
function isLosslessJsonValue(value: unknown): boolean {
  if (value === null) return true
  switch (typeof value) {
    case 'boolean':
    case 'string':
      return true
    case 'number':
      return Number.isFinite(value)
    case 'object': {
      if (Array.isArray(value)) return value.every((item) => isLosslessJsonValue(item))
      if (!isPlainObject(value)) return false
      return Object.entries(value).every(
        ([key, item]) => key.length > 0 && isLosslessJsonValue(item),
      )
    }
    default:
      return false
  }
}

function freezeDeep(value: unknown): void {
  if (value === null || typeof value !== 'object') return
  const items: unknown[] = Array.isArray(value) ? value : Object.values(value as LosslessRecord)
  for (const item of items) {
    freezeDeep(item)
  }
  Object.freeze(value)
}

/**
 * Deep-freeze `value` after asserting it is a lossless-JSON value.
 *
 * The resolver output is built from plain strings / arrays / booleans by
 * construction; the assertion machine-checks the "every effective value is
 * serializable and explainable" invariant at the output boundary.
 *
 * @throws {@link PolicyResolutionError} (`MALFORMED_POLICY_INPUT`) when the
 *   value is not lossless JSON — a defensive failure that cannot be
 *   triggered by the resolver's own output construction.
 */
export function deepFreeze<T>(value: T): T {
  if (!isLosslessJsonValue(value)) {
    throw new PolicyResolutionError(
      POLICY_ERROR_CODES.MALFORMED_POLICY_INPUT,
      'malformed policy input at output: resolver output is not a lossless-JSON value',
      { field: 'output', problem: 'not a lossless-JSON value' },
    )
  }
  freezeDeep(value)
  return value
}
