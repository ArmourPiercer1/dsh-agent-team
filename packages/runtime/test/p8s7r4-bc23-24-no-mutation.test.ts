/**
 * p8s7r4-bc23-24-no-mutation.test.ts — P8-S7-R4 W6 (BC-23 / BC-24):
 * the handoff FAILURE DECISIONS (Architecture §34.4 triad) are
 * CLIENT-SIDE decisions with NO backend mutation — verified three ways:
 *
 * 1. CANCEL (BC-23): resolving an `awaiting-decision` operation with
 *    `cancel` produces a `canceled` state and ZERO creation effects —
 *    the mock-first creation port (the module's ONLY team-adjacent
 *    effect channel) is never called; the replay of a canceled
 *    operation is idempotent and still creates nothing. A decision on
 *    an unknown / already-finalized operation fails closed with the
 *    closed code.
 * 2. CONTINUE-WITHOUT-HANDOFF (BC-24): the team is created through the
 *    STANDARD creation entry WITHOUT the handoff context — the staged
 *    TeamIntent carries NO `handoff` provenance field (the §7.2
 *    optional provenance is absent), so no handoff provenance enters
 *    the durable world on this path.
 * 3. THE CLOSED CATALOG (the code-level proof that no backend method
 *    can drive a decision): the Remote contract v1 catalog is CLOSED at
 *    9 categories / 23 methods and the `handoff` category exposes
 *    EXACTLY `handoff.prepare` (read-only) + `handoff.create` (the
 *    start entry) — there is NO remote decision method; the decision
 *    triad is resolvable only in-process (the client), and the S6
 *    handoff port surface carries no decision channel (the decisions
 *    stay client-side in v1).
 *
 * Plus the RETRY leg of the triad: the one-shot summarization re-runs
 * from the FROZEN snapshot (summarize count +1, the source is NOT
 * re-read) and the recovered operation carries the handoff provenance.
 *
 * Runner note: the plain-node shim (scripts/test-vitest-shim.mjs)
 * forbids async `it()` bodies and exposes only toBe/toEqual/
 * toBeGreaterThan/toThrow — so every scenario is driven at MODULE TOP
 * LEVEL and the `it` bodies assert synchronously over the captured
 * results (the P7-T5 pattern).
 *
 * @module @dsh-agent-team/runtime/test/p8s7r4-bc23-24-no-mutation
 */
import { describe, expect, it } from 'vitest'
import {
  P7T5_FIXTURE,
  createP7T5World,
  assertHandoffCode,
} from './p7t5-helpers.js'
import { HANDOFF_ERROR_CODES } from '../handoff/errors.js'
import { HANDOFF_DECISION_OPTIONS } from '../handoff/types.js'
import type { HandoffOperationState } from '../handoff/types.js'
import {
  REMOTE_CATEGORIES,
  REMOTE_METHOD_NAMES,
  REMOTE_METHODS_BY_CATEGORY,
} from '../../remote/src/contracts/catalog.js'

const SRC = P7T5_FIXTURE.sourceSessionId
const TOKEN = P7T5_FIXTURE.requestToken
const TOKEN_ALT = 'tok-p8s7r4-bc24-alt'

/** One union member of the operation state, narrowed by kind. */
type StateOf<K extends HandoffOperationState['kind']> = Extract<
  HandoffOperationState,
  { readonly kind: K }
>

/** Fail the whole file (module-load failure) unless `state` carries `kind`. */
function narrow<K extends HandoffOperationState['kind']>(
  state: HandoffOperationState,
  kind: K,
  label: string,
): StateOf<K> {
  if (state.kind !== kind) {
    throw new Error(`${label}: expected state kind '${kind}' but got '${state.kind}'`)
  }
  return state as StateOf<K>
}

/** Catch one async rejection (null when it resolved). */
async function captureError(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn()
    return null
  } catch (err) {
    return err
  }
}

// --- S1: CANCEL (BC-23) — zero backend mutation ---------------------------------

const w1 = createP7T5World()
w1.summarizer.failNext = true
const s1awaiting: StateOf<'awaiting-decision'> = narrow(
  await w1.service.startTeamFromHere({ sourceSessionId: SRC, requestToken: TOKEN, staged: {} }),
  'awaiting-decision',
  'S1 (start)',
)
const s1canceled: StateOf<'canceled'> = narrow(
  await w1.service.resolveHandoffDecision(
    { sourceSessionId: SRC, requestToken: TOKEN },
    HANDOFF_DECISION_OPTIONS.CANCEL,
  ),
  'canceled',
  'S1 (cancel)',
)
const s1replay: StateOf<'canceled'> = narrow(
  await w1.service.startTeamFromHere({ sourceSessionId: SRC, requestToken: TOKEN, staged: {} }),
  'canceled',
  'S1 (replay)',
)
const s1redecision = await captureError(() =>
  w1.service.resolveHandoffDecision(
    { sourceSessionId: SRC, requestToken: TOKEN },
    HANDOFF_DECISION_OPTIONS.RETRY,
  ),
)
const s1unknown = await captureError(() =>
  w1.service.resolveHandoffDecision(
    { sourceSessionId: SRC, requestToken: TOKEN_ALT },
    HANDOFF_DECISION_OPTIONS.CANCEL,
  ),
)

// --- S2: CONTINUE-WITHOUT-HANDOFF (BC-24) — no handoff provenance attached -------

const w2 = createP7T5World()
w2.summarizer.failNext = true
const s2awaiting: StateOf<'awaiting-decision'> = narrow(
  await w2.service.startTeamFromHere({ sourceSessionId: SRC, requestToken: TOKEN, staged: {} }),
  'awaiting-decision',
  'S2 (start)',
)
// Snapshot BEFORE the decision (the shim runs every `it` body after ALL
// top-level scenarios — intermediate state needs top-level snapshots).
const w2CallCountAfterStart = w2.creation.callCount
const s2continued: StateOf<'completed-without-handoff'> = narrow(
  await w2.service.resolveHandoffDecision(
    { sourceSessionId: SRC, requestToken: TOKEN },
    HANDOFF_DECISION_OPTIONS.CONTINUE_WITHOUT_HANDOFF,
  ),
  'completed-without-handoff',
  'S2 (continue)',
)

// --- S3: RETRY — the summarization re-runs from the frozen snapshot -------------

const w3 = createP7T5World()
w3.summarizer.failNext = true
const s3awaiting: StateOf<'awaiting-decision'> = narrow(
  await w3.service.startTeamFromHere({ sourceSessionId: SRC, requestToken: TOKEN, staged: {} }),
  'awaiting-decision',
  'S3 (start)',
)
// Snapshot BEFORE the RETRY decision (the shim runs every `it` body after
// ALL top-level scenarios — intermediate state needs top-level snapshots).
const w3SummarizeCountAfterStart = w3.summarizer.summarizeCount
const w3CallCountAfterStart = w3.creation.callCount
const s3retried: StateOf<'completed'> = narrow(
  await w3.service.resolveHandoffDecision(
    { sourceSessionId: SRC, requestToken: TOKEN },
    HANDOFF_DECISION_OPTIONS.RETRY,
  ),
  'completed',
  'S3 (retry)',
)

// --- assertions ----------------------------------------------------------------------

describe('p8s7r4 W6 (BC-23/BC-24) — the failure decisions are client-side with no backend mutation', () => {
  it('S1: cancel produces a canceled state with ZERO creation effects (the creation port is never called)', () => {
    expect(s1awaiting.kind).toBe('awaiting-decision')
    expect(s1awaiting.failure.code).toBe(HANDOFF_ERROR_CODES.SUMMARIZATION_FAILED)
    expect(s1awaiting.options).toEqual([
      HANDOFF_DECISION_OPTIONS.RETRY,
      HANDOFF_DECISION_OPTIONS.CONTINUE_WITHOUT_HANDOFF,
      HANDOFF_DECISION_OPTIONS.CANCEL,
    ])
    // The failure surfaced the triad WITHOUT creating anything.
    expect(w1.creation.callCount).toBe(0)

    expect(s1canceled.kind).toBe('canceled')
    expect(s1canceled.replayed).toBe(false)
    // BC-23: the cancel decision mutates NO backend state — the module's
    // only team-adjacent effect channel was never called.
    expect(w1.creation.callCount).toBe(0)
    expect(w1.source.readCount).toBe(1)

    // The replay of a canceled operation is idempotent and still creates nothing.
    expect(s1replay.kind).toBe('canceled')
    expect(s1replay.replayed).toBe(true)
    expect(w1.creation.callCount).toBe(0)

    // A second decision on the finalized operation fails closed (one-shot).
    assertHandoffCode(s1redecision, HANDOFF_ERROR_CODES.OPERATION_ALREADY_FINALIZED)
    // A decision on an unknown operation fails closed.
    assertHandoffCode(s1unknown, HANDOFF_ERROR_CODES.OPERATION_UNKNOWN)
  })

  it('S2: continue-without-handoff creates the team WITHOUT the handoff provenance (no handoff field on the staged intent)', () => {
    expect(s2awaiting.kind).toBe('awaiting-decision')
    // Snapshot taken before the decision: the start never created anything.
    expect(w2CallCountAfterStart).toBe(0)

    expect(s2continued.kind).toBe('completed-without-handoff')
    expect(s2continued.replayed).toBe(false)
    expect(s2continued.team.rootSessionId).toBe(P7T5_FIXTURE.newRootSessionId)
    // Exactly one creation call — the STANDARD creation entry.
    expect(w2.creation.callCount).toBe(1)
    expect(w2.source.readCount).toBe(1)

    // BC-24: the staged TeamIntent carries NO handoff provenance field —
    // the optional §7.2 provenance is ABSENT on this path, so no handoff
    // provenance enters the durable world.
    check(w2.creation.intents.length === 1, 'S2: expected exactly one staged intent')
    const intent = w2.creation.intents[0]
    if (intent === undefined) throw new Error('S2: the staged intent is missing')
    expect(intent.handoff === undefined).toBe(true)
    expect(intent.intentToken).toBe(`handoff-intent-${TOKEN}`)
  })

  it('S3: retry re-runs the one-shot summarization from the FROZEN snapshot (no source re-read) and recovers the handoff', () => {
    expect(s3awaiting.kind).toBe('awaiting-decision')
    // Snapshot taken before the RETRY: the start's single summarization
    // attempt failed and nothing was created.
    expect(w3SummarizeCountAfterStart).toBe(1)
    expect(w3CallCountAfterStart).toBe(0)

    expect(s3retried.kind).toBe('completed')
    expect(s3retried.replayed).toBe(false)
    // The summarization re-ran ONCE (from the frozen snapshot); the
    // source was read EXACTLY ONCE in total; one creation.
    expect(w3.summarizer.summarizeCount).toBe(2)
    expect(w3.source.readCount).toBe(1)
    expect(w3.creation.callCount).toBe(1)
    // The recovered operation carries the handoff provenance.
    check(w3.creation.intents.length === 1, 'S3: expected exactly one staged intent')
    const intent = w3.creation.intents[0]
    if (intent === undefined) throw new Error('S3: the staged intent is missing')
    expect(intent.handoff !== undefined).toBe(true)
    if (intent.handoff !== undefined) {
      expect(intent.handoff.sourceSessionId).toBe(SRC)
    }
  })

  it('S4: the closed catalog carries no decision method — the handoff category is exactly prepare + create (v1-CLOSED 9/23)', () => {
    // The handoff category: EXACTLY the two v1 methods (read-only prepare
    // + the create entry that starts the operation). No decision method.
    expect(REMOTE_METHODS_BY_CATEGORY[REMOTE_CATEGORIES.HANDOFF]).toEqual([
      'handoff.create',
      'handoff.prepare',
    ])
    // The catalog stays CLOSED at 9 categories / 23 methods.
    expect(REMOTE_METHOD_NAMES.length).toBe(23)
    expect(Object.keys(REMOTE_METHODS_BY_CATEGORY).sort()).toEqual([
      'catalog',
      'compatibility',
      'handoff',
      'intent',
      'legacy',
      'member',
      'override',
      'policyState',
      'team',
    ])
    // NO method of the whole closed catalog can drive a decision:
    expect(REMOTE_METHOD_NAMES.some((name) => name.includes('decision'))).toBe(false)
    expect(REMOTE_METHOD_NAMES.some((name) => name.includes('resolve'))).toBe(false)
  })
})

/** Fail the whole file on a flow-critical invariant. */
function check(condition: boolean, label: string): void {
  if (!condition) throw new Error(`scenario guard: ${label}`)
}
