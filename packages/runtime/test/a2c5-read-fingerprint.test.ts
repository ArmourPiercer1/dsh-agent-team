/**
 * a2c5-read-fingerprint.test.ts — A2C-5 (alpha.2 capability-completion
 * round, plan §8) MUST-TEST: the read fingerprint omitted-limit
 * pseudo-equivalence is REMOVED.
 *
 * Pre-fix fact under attack (the §8.1 debt): the canonical read
 * projection defaulted an OMITTED `limit` to the deployment constant
 * `READ_LIMIT_DEFAULT = 2000`, so `read(file)` and `read(file, limit =
 * 2000)` minted the SAME fingerprint — a durable one-shot allow for one
 * identity silently covered the other, and the effect-identity was wrong
 * for any deployment whose live `readLimit` cap is not 2000.
 *
 * Frozen fix (plan §8.2 — conservative identity, no deployment-private
 * default read): `offset: omitted → 1` (the pinned upstream `parseReadArgs`
 * fixed one-based default — recon confirmed on
 * `tests/deepseek-harness-test-use` @ a66e470204, `read.ts`
 * `parseReadArgs`: `offset === undefined ? 1`, schema doc "Defaults to
 * 1"); `limit: omitted → null` (the caller gave nothing — the
 * projection carries the ABSENCE, never a substituted number),
 * `limit: explicit N → N`. Consequently `read(file) != read(file,
 * limit = 2000)` in fingerprint — even a deployment that happens to
 * default to 2000 only loses a CONSERVATIVE reuse, never gains an
 * authorization.
 *
 * §8.4 acceptance matrix (this file):
 *   T1  omitted vs explicit 2000 fingerprints DIFFER (RED probe — the
 *       omitted projection carries `limit: null`, exact digests pinned);
 *   T2  omitted limit deterministic (byte-identical across calls);
 *   T3  explicit same limit deterministic; explicit 2000 KEEPS its
 *       pre-A2C-5 identity (byte-exact digest, unchanged path);
 *   T4  explicit 100 vs 200 different;
 *   T5  resource / offset change still different;
 *   T6  a one-shot allow for the OMITTED identity is NOT consumable by
 *       an explicit-2000 attempt (RED probe — fail closed, no
 *       cross-identity consumption; the allow survives and authorizes
 *       its own identity exactly once);
 *   T7  the symmetric direction: a one-shot allow for the EXPLICIT-2000
 *       identity is NOT consumable by an omitted attempt (RED probe);
 *   T8  offset semantics UNCHANGED (omitted ≡ explicit 1 — the recon
 *       ruling; offset 2 still a distinct identity);
 *   T9  the static resolver + the control guard consume the new
 *       identities OPAQUELY (rule scope = tool + opaque resource key;
 *       the guard accepts the `'sha256:…'` string verbatim — zero
 *       consumer changes);
 *   T10 explicit non-positive-integer limit/offset still fail closed
 *       (the mirrored tool validation is preserved verbatim).
 *
 * RED PHASE PROTOCOL (brief §5.2): the probes T1/T6/T7 are written
 * against the PRE-FIX surface only (the public canonicalizeOperation +
 * the public control service API) and MUST fail on the base commit;
 * their failure log is the RED evidence (a2c-5/red-run.log). The
 * invariant legs (T2–T5, T8–T10) pass on both sides — they guard
 * against the fix moving an identity it must not move.
 *
 * Compatibility note (plan §8, recorded ruling): read-class fingerprints
 * change → old in-flight pending-ask rows (minted under the old rule)
 * mismatch under the new rule and fail closed naturally (no allow
 * consumption, no widening) — the accepted strictness increase.
 *
 * RUNNER CONSTRAINTS (this repo's plain-node shim — see the a2/a2c4
 * suite headers): every async scenario runs at MODULE level (top-level
 * await) and captures its results; the `it` bodies are pure
 * synchronous assertions. Shim matchers used: toBe / toEqual (+.not)
 * only.
 *
 * SELF-CLEANLINESS: this file is inside the P4-T6 whole-tree scanner's
 * scope (`packages/**`), so no legacy Team SessionEvent denylist token
 * may appear in this source — none does (expected scanner delta = +1
 * file, recorded in the task report; the aggregate pin stays the main
 * agent's single-writer file).
 *
 * @module @dsh-agent-team/runtime/test/a2c5-read-fingerprint
 */
import { describe, expect, it } from 'vitest'
import { canonicalJsonStringify } from '../../contracts/src/index.js'
import { sha256Hex } from '../../domain/blueprint/src/index.js'
import type { TemplatePermissionPolicy } from '../../domain/blueprint/src/index.js'
import {
  CONTROL_GUARD_BLOCK_REASONS,
  CONTROL_REQUEST_KINDS,
} from '../control/index.js'
import type { ControlGuardVerdict } from '../control/index.js'
import {
  canonicalizeOperation,
  isOperationPermissionError,
  resolveOperationPermission,
} from '../operation-permission/index.js'
import type {
  CanonicalOperation,
  CanonicalRules,
  PathTargetResolver,
} from '../operation-permission/index.js'
import {
  P6T4_ROOT,
  P6T4_SEEDS,
  createP6T4World,
  createP6T4Service,
  destroyP6T1World,
  leaderCaller,
  makeScope,
  memberCaller,
} from './p6t4-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)

/** The block reason of a denied guard verdict (union narrowing — the
 *  allow branch has no `reason` member). */
function blockReason(verdict: ControlGuardVerdict): string {
  if (verdict.allowed) throw new Error('expected a block verdict, got an allow verdict')
  return verdict.reason
}

// ---------------------------------------------------------------------------
// The deterministic fake resolver (plan §7.2: the module treats keys as
// OPAQUE — the fake is the verbatim path identity, case-sensitive; the
// module must never see through it).
// ---------------------------------------------------------------------------

function makeFakeResolver(): PathTargetResolver {
  return async (path: string) => ({ key: `fskey:${path}`, display: `display:${path}` })
}

const resolver = makeFakeResolver()

async function op(name: string, args: unknown): Promise<CanonicalOperation> {
  return canonicalizeOperation({ name, arguments: args, resolveTarget: resolver })
}

interface FailureCapture {
  readonly typed: boolean
  readonly reason: string | undefined
}

async function failOp(name: string, args: unknown): Promise<FailureCapture> {
  try {
    await canonicalizeOperation({ name, arguments: args, resolveTarget: resolver })
    return { typed: false, reason: undefined }
  } catch (error: unknown) {
    if (!isOperationPermissionError(error) || error.details === undefined) {
      return { typed: false, reason: undefined }
    }
    return { typed: true, reason: error.details['reason'] as string | undefined }
  }
}

// ---------------------------------------------------------------------------
// Module-level async world: every canonicalization + every durable
// one-shot scenario captured here; the `it` bodies below are pure
// synchronous assertions over the captured results.
// ---------------------------------------------------------------------------

const F = await (async () => {
  const omitted = await op('read', { file_path: './a/b' })
  const omittedAgain = await op('read', { file_path: './a/b' })
  const explicit2000 = await op('read', { file_path: './a/b', limit: 2000 })
  const explicit2000Offset1 = await op('read', { file_path: './a/b', offset: 1, limit: 2000 })
  const limit100 = await op('read', { file_path: './a/b', limit: 100 })
  const limit200 = await op('read', { file_path: './a/b', limit: 200 })
  const offset2 = await op('read', { file_path: './a/b', offset: 2 })
  const offsetExplicit1 = await op('read', { file_path: './a/b', offset: 1 })
  const otherFile = await op('read', { file_path: 'a/c' })
  return {
    omitted,
    omittedAgain,
    explicit2000,
    explicit2000Offset1,
    limit100,
    limit200,
    offset2,
    offsetExplicit1,
    otherFile,
  }
})()

/** The fake resolver's opaque key for the shared `./a/b` path. */
const KEY_A_B = 'fskey:./a/b'

/**
 * The exact digests the frozen fix (plan §8.2) prescribes for the
 * projection `{ tool, resourceKey, offset, limit }` over the fake key:
 * the OMITTED limit canonicalizes to the `limit: null` projection, the
 * EXPLICIT 2000 keeps the pre-A2C-5 `limit: 2000` projection byte-for-byte.
 */
const EXPECTED_DIGEST_OMITTED = `sha256:${sha256Hex(canonicalJsonStringify({
  tool: 'read',
  resourceKey: KEY_A_B,
  offset: 1,
  limit: null,
}))}`
const EXPECTED_DIGEST_EXPLICIT_2000 = `sha256:${sha256Hex(canonicalJsonStringify({
  tool: 'read',
  resourceKey: KEY_A_B,
  offset: 1,
  limit: 2000,
}))}`

// ---------------------------------------------------------------------------
// The durable one-shot scenarios (the real A4 control service over the
// P6-T4 world — the guard's exact-scope + exactly-once semantics are the
// production consumers of the fingerprint):
//
//   approve(identity X, correlation C)  →  attempt(identity Y, correlation C)
//
// Same logical operation (one correlation), two fingerprint identities.
// Pre-fix X === Y for omitted vs explicit-2000, so the X-allow is
// consumable by the Y-attempt (the bug); post-fix the scope keys differ
// → the Y-attempt is a `no-request` block and the X-allow survives.
// ---------------------------------------------------------------------------

interface OneShotDirection {
  /** The cross-identity attempt verdict (the RED probe). */
  readonly cross: ControlGuardVerdict
  /** The approved identity's own attempt (must pass — exactly once). */
  readonly own: ControlGuardVerdict
  /** The approved identity's SECOND attempt (must be allow-consumed). */
  readonly again: ControlGuardVerdict
}

async function oneShotDirection(
  basename: string,
  correlation: string,
  approvedFingerprint: string,
  attemptFingerprint: string,
): Promise<OneShotDirection> {
  const world = await createP6T4World(basename, ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'read-file',
      toolName: 'fs.read',
      correlation,
      operationFingerprint: approvedFingerprint,
    })
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })
    const cross = await service.guardOperation(
      makeScope({ actionName: 'read-file', toolName: 'fs.read', correlation, operationFingerprint: attemptFingerprint }),
    )
    const ownScope = makeScope({ actionName: 'read-file', toolName: 'fs.read', correlation, operationFingerprint: approvedFingerprint })
    const own = await service.guardOperation(ownScope)
    const again = await service.guardOperation(ownScope)
    return { cross, own, again }
  } finally {
    await destroyP6T1World(world)
  }
}

/** T6 — the plan §8.4 direction: omitted allow, explicit-2000 attempt. */
const DIR_A = await oneShotDirection(
  'a2c5-dirs-a',
  'corr-a2c5-dirs-a',
  F.omitted.fingerprint,
  F.explicit2000.fingerprint,
)

/** T7 — the symmetric direction: explicit-2000 allow, omitted attempt. */
const DIR_B = await oneShotDirection(
  'a2c5-dirs-b',
  'corr-a2c5-dirs-b',
  F.explicit2000.fingerprint,
  F.omitted.fingerprint,
)

// ---------------------------------------------------------------------------
// T9 — the opaque consumers: the static resolver (pure, tool + opaque
// resource key) over both new identities, tool-level `any` rule, exact
// key rule, and the no-rule default.
// ---------------------------------------------------------------------------

const POLICY_DENY: TemplatePermissionPolicy = { default: 'deny', allow: [], ask: [], deny: [] }

const RULES_ANY: CanonicalRules = {
  allow: [{ tool: 'read', resource: { kind: 'any' } }],
  ask: [],
  deny: [],
}

const RULES_EXACT: CanonicalRules = {
  allow: [{ tool: 'read', resource: { kind: 'exact', key: KEY_A_B } }],
  ask: [],
  deny: [],
}

// T10 — the mirrored tool validation preserved verbatim (fail closed).
const FAILS = await (async () => {
  return {
    limitZero: await failOp('read', { file_path: './a/b', limit: 0 }),
    limitNegative: await failOp('read', { file_path: './a/b', limit: -1 }),
    limitFloat: await failOp('read', { file_path: './a/b', limit: 2.5 }),
    limitString: await failOp('read', { file_path: './a/b', limit: '100' }),
    offsetZero: await failOp('read', { file_path: './a/b', offset: 0 }),
    offsetFloat: await failOp('read', { file_path: './a/b', offset: 2.5 }),
  }
})()

describe('a2c5 read fingerprint identity (plan §8) — RED probes', () => {
  it('T1 (RED): omitted limit is a DISTINCT identity from explicit 2000 — the projection carries `limit: null` (exact digests pinned)', () => {
    // The pre-fix fact: both calls minted the `limit: 2000` projection →
    // one fingerprint. The frozen fix: the omission is an ABSENCE in the
    // projection, never a substituted deployment constant.
    expect(F.omitted.fingerprint).not.toBe(F.explicit2000.fingerprint)
    expect(F.omitted.fingerprint).toBe(EXPECTED_DIGEST_OMITTED)
    expect(F.explicit2000.fingerprint).toBe(EXPECTED_DIGEST_EXPLICIT_2000)
    // The two digests themselves differ (null vs 2000 in the projection).
    expect(EXPECTED_DIGEST_OMITTED).not.toBe(EXPECTED_DIGEST_EXPLICIT_2000)
    // The RESOURCE identity is untouched: same file, same opaque key.
    expect(F.omitted.resource.key).toBe(F.explicit2000.resource.key)
    expect(F.omitted.resource.kind).toBe('file')
  })

  it('T2: omitted limit is deterministic (byte-identical across calls)', () => {
    expect(F.omittedAgain.fingerprint).toBe(F.omitted.fingerprint)
  })

  it('T3: explicit same limit is deterministic, and explicit 2000 KEEPS its pre-A2C-5 identity (byte-exact digest — the explicit path is untouched)', () => {
    expect(F.explicit2000Offset1.fingerprint).toBe(F.explicit2000.fingerprint)
    expect(F.explicit2000.fingerprint).toBe(EXPECTED_DIGEST_EXPLICIT_2000)
  })

  it('T4: explicit limits differ from each other (100 vs 200)', () => {
    expect(F.limit100.fingerprint).not.toBe(F.limit200.fingerprint)
  })

  it('T5: resource / offset change still changes the identity', () => {
    expect(F.otherFile.fingerprint).not.toBe(F.omitted.fingerprint)
    expect(F.offset2.fingerprint).not.toBe(F.omitted.fingerprint)
    expect(F.otherFile.resource.key).not.toBe(F.omitted.resource.key)
  })

  it('T6 (RED): a one-shot allow for the OMITTED identity is NOT consumable by the explicit-2000 attempt (fail closed — no cross-identity consumption; the allow survives and authorizes its own identity exactly once)', () => {
    // The cross-identity attempt: same logical operation (one
    // correlation), the explicit-2000 fingerprint. Pre-fix this scope
    // key equaled the approved one (the pseudo-equivalence) and the
    // attempt CONSUMED the omitted-identity allow. Post-fix it is a
    // fresh scope with no durable request: a plain no-request block,
    // zero effect, nothing consumed, nothing written.
    expect(DIR_A.cross.allowed).toBe(false)
    expect(blockReason(DIR_A.cross)).toBe(CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST)
    // The approved identity still passes (the one-shot survived the
    // cross-identity attempt — no widening, no burning).
    expect(DIR_A.own.allowed).toBe(true)
    // ...and it authorizes EXACTLY once: the second attempt on the same
    // identity finds the durable consumption.
    expect(DIR_A.again.allowed).toBe(false)
    expect(blockReason(DIR_A.again)).toBe(CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED)
  })

  it('T7 (RED): symmetric direction — a one-shot allow for the EXPLICIT-2000 identity is NOT consumable by the omitted attempt', () => {
    expect(DIR_B.cross.allowed).toBe(false)
    expect(blockReason(DIR_B.cross)).toBe(CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST)
    expect(DIR_B.own.allowed).toBe(true)
    expect(DIR_B.again.allowed).toBe(false)
    expect(blockReason(DIR_B.again)).toBe(CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED)
  })
})

describe('a2c5 read fingerprint — invariants (plan §8.2/§8.3 + recon)', () => {
  it('T8: offset semantics UNCHANGED (recon on pinned a66e470204 parseReadArgs: omitted ≡ explicit 1, the fixed one-based default; offset 2 stays distinct)', () => {
    expect(F.offsetExplicit1.fingerprint).toBe(F.omitted.fingerprint)
    expect(F.offset2.fingerprint).not.toBe(F.offsetExplicit1.fingerprint)
  })

  it('T9: the static resolver consumes the new identities OPAQUELY (rule scope = tool + opaque resource key — zero consumer changes)', () => {
    // Tool-level `any` rule: both new identities resolve identically —
    // the static scope is the resource, the fingerprint is NOT a rule
    // field (the resolver never reads it).
    expect(resolveOperationPermission(POLICY_DENY, F.omitted, RULES_ANY).decision).toBe('allow')
    expect(resolveOperationPermission(POLICY_DENY, F.explicit2000, RULES_ANY).decision).toBe('allow')
    // Exact-key rule: both identities share the SAME opaque resource
    // key → both match (the window identity does not split the static
    // resource scope).
    expect(resolveOperationPermission(POLICY_DENY, F.omitted, RULES_EXACT).decision).toBe('allow')
    expect(resolveOperationPermission(POLICY_DENY, F.explicit2000, RULES_EXACT).decision).toBe('allow')
    // No rule: the default (deny) decides for both — unchanged.
    expect(resolveOperationPermission(POLICY_DENY, F.omitted, { allow: [], ask: [], deny: [] }).decision).toBe('deny')
    expect(resolveOperationPermission(POLICY_DENY, F.explicit2000, { allow: [], ask: [], deny: [] }).decision).toBe('deny')
  })

  it('T10: explicit non-positive-integer limit/offset still fail closed (the mirrored upstream parseReadArgs validation is preserved verbatim)', () => {
    expect(FAILS.limitZero).toEqual({ typed: true, reason: 'read-limit-invalid' })
    expect(FAILS.limitNegative).toEqual({ typed: true, reason: 'read-limit-invalid' })
    expect(FAILS.limitFloat).toEqual({ typed: true, reason: 'read-limit-invalid' })
    expect(FAILS.limitString).toEqual({ typed: true, reason: 'read-limit-invalid' })
    expect(FAILS.offsetZero).toEqual({ typed: true, reason: 'read-offset-invalid' })
    expect(FAILS.offsetFloat).toEqual({ typed: true, reason: 'read-offset-invalid' })
  })
})
