/**
 * p8s7r4-bc22-idempotency.test.ts — P8-S7-R4 W5 (BC-22): the retry of a
 * failed one-shot handoff is CARRIED by the `handoff.create` idempotency
 * per `(sourceSessionId, requestToken)` — verified at the SERVICE level
 * against the REAL `createHandoffService` over the mock-first ports
 * (the P7-T5 world):
 *
 * - a fresh operation reads the source EXACTLY ONCE, summarizes ONCE,
 *   and calls the creation entry ONCE;
 * - a same-token + same-source REPLAY returns the stored final state
 *   marked `replayed: true` and re-reads NOTHING, re-summarizes NOTHING,
 *   and creates NOTHING new (no duplicate team — the idempotency
 *   contract);
 * - a `creation-failed` operation RE-DRIVES ONLY the team creation with
 *   the SAME stable intentToken (the source is not re-read, the summary
 *   is not re-run) — the BC-22 retry path;
 * - the BQ-17 service-level read (`describeOperation`) reports the
 *   operation state/provenance (known / snapshot status / state / team).
 *
 * Runner note: the plain-node shim (scripts/test-vitest-shim.mjs)
 * forbids async `it()` bodies and exposes only toBe/toEqual/
 * toBeGreaterThan/toThrow — so every scenario is driven at MODULE TOP
 * LEVEL and the `it` bodies assert synchronously over the captured
 * results (the P7-T5 pattern). Module-level `narrow` guards fail the
 * whole file on a flow-critical shape (the check() pattern).
 *
 * @module @dsh-agent-team/runtime/test/p8s7r4-bc22-idempotency
 */
import { describe, expect, it } from 'vitest'
import {
  P7T5_FIXTURE,
  createP7T5World,
} from './p7t5-helpers.js'
import { HANDOFF_ERROR_CODES } from '../handoff/errors.js'
import type { HandoffOperationState } from '../handoff/types.js'

const SRC = P7T5_FIXTURE.sourceSessionId
const TOKEN = P7T5_FIXTURE.requestToken
const TOKEN_ALT = 'tok-p8s7r4-bc22-alt'

/** One union member of the operation state, narrowed by kind. */
type StateOf<K extends HandoffOperationState['kind']> = Extract<
  HandoffOperationState,
  { readonly kind: K }
>

/**
 * Fail the whole file (module-load failure) unless `state` carries
 * `kind` — then narrow it for the flow-critical field access.
 */
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

// --- S1: the fresh operation (one read, one summary, one creation) --------------

const w1 = createP7T5World()
const s1: StateOf<'completed'> = narrow(
  await w1.service.startTeamFromHere({ sourceSessionId: SRC, requestToken: TOKEN, staged: {} }),
  'completed',
  'S1',
)

// --- S2: the same-token + same-source replay (idempotent, zero side effects) -----

const s2: StateOf<'completed'> = narrow(
  await w1.service.startTeamFromHere({ sourceSessionId: SRC, requestToken: TOKEN, staged: {} }),
  'completed',
  'S2',
)

// --- S3: the creation-failed re-drive (BC-22 retry with the same intentToken) ----

const w3 = createP7T5World()
w3.creation.failNext = true
const s3failed: StateOf<'creation-failed'> = narrow(
  await w3.service.startTeamFromHere({ sourceSessionId: SRC, requestToken: TOKEN, staged: {} }),
  'creation-failed',
  'S3 (first drive)',
)
// Snapshot the creation count BEFORE the re-drive (the shim runs every `it`
// body after ALL top-level scenarios — intermediate state is observable only
// through top-level snapshots).
const w3CallCountAfterFirstDrive = w3.creation.callCount
const s3recovered: StateOf<'completed'> = narrow(
  await w3.service.startTeamFromHere({ sourceSessionId: SRC, requestToken: TOKEN, staged: {} }),
  'completed',
  'S3 (re-drive)',
)

// --- S4: the BQ-17 service-level read surface ------------------------------------

const s4known = w1.service.describeOperation(SRC, TOKEN)
const s4unknown = w1.service.describeOperation(SRC, TOKEN_ALT)

// --- assertions ----------------------------------------------------------------------

describe('p8s7r4 W5 (BC-22) — the handoff.create idempotency per (sourceSessionId, requestToken)', () => {
  it('S1: the fresh operation reads once, summarizes once, creates once, and carries the handoff provenance', () => {
    expect(s1.kind).toBe('completed')
    expect(s1.replayed).toBe(false)
    expect(s1.team.rootSessionId).toBe(P7T5_FIXTURE.newRootSessionId)
    expect(w1.source.readCount).toBe(1)
    expect(w1.summarizer.summarizeCount).toBe(1)
    expect(w1.creation.callCount).toBe(1)
    checkIntent(w1.creation.intents, 0, `handoff-intent-${TOKEN}`, SRC)
  })

  it('S2: the same-token replay returns the stored state marked replayed — zero re-read, zero re-summary, zero duplicate creation', () => {
    expect(s2.kind).toBe('completed')
    expect(s2.replayed).toBe(true)
    expect(s2.team).toEqual(s1.team)
    expect(s2.context).toEqual(s1.context)
    // The idempotency contract: NOTHING is re-run on the replay.
    expect(w1.source.readCount).toBe(1)
    expect(w1.summarizer.summarizeCount).toBe(1)
    expect(w1.creation.callCount).toBe(1)
  })

  it('S3: a creation-failed operation re-drives ONLY the creation — same stable intentToken, no source re-read, no summary re-run', () => {
    expect(s3failed.kind).toBe('creation-failed')
    expect(s3failed.replayed).toBe(false)
    expect(s3failed.failure.code).toBe(HANDOFF_ERROR_CODES.TEAM_CREATION_FAILED)
    // After the FIRST drive only (snapshot — the re-drive adds one more):
    expect(w3CallCountAfterFirstDrive).toBe(1)

    // The BC-22 retry: re-invoke with the same token + source.
    expect(s3recovered.kind).toBe('completed')
    expect(s3recovered.replayed).toBe(false)
    expect(s3recovered.team.rootSessionId).toBe(P7T5_FIXTURE.newRootSessionId)
    // Re-driven the creation EXACTLY once more — with the SAME intentToken.
    expect(w3.creation.callCount).toBe(2)
    expect(w3.source.readCount).toBe(1)
    expect(w3.summarizer.summarizeCount).toBe(1)
    checkIntent(w3.creation.intents, 0, `handoff-intent-${TOKEN}`, SRC)
    checkIntent(w3.creation.intents, 1, `handoff-intent-${TOKEN}`, SRC)
  })

  it('S4: describeOperation reports the operation state/provenance (known: context-frozen + completed + team)', () => {
    expect(s4known.known).toBe(true)
    expect(s4known.snapshotStatus).toBe('context-frozen')
    if (s4known.state === null || s4known.team === null) {
      throw new Error('S4: the known operation has no observable state or team on the read surface')
    }
    expect(s4known.state.kind).toBe('completed')
    expect(s4known.team.rootSessionId).toBe(P7T5_FIXTURE.newRootSessionId)

    // An unknown token: the absent view (no state, no team).
    expect(s4unknown.known).toBe(false)
    expect(s4unknown.snapshotStatus).toBe('absent')
    expect(s4unknown.state).toBe(null)
    expect(s4unknown.team).toBe(null)
  })
})

/** Fail the whole file on a flow-critical invariant. */
function check(condition: boolean, label: string): void {
  if (!condition) throw new Error(`S4 scenario guard: ${label}`)
}

/**
 * Assert one recorded creation intent: the stable intentToken and the
 * with-handoff provenance (sourceSessionId + contextToken + capturedAt).
 * @throws a plain Error when the shape or a value does not match.
 */
function checkIntent(
  intents: readonly {
    intentToken: string
    handoff?: { sourceSessionId: string; contextToken: string; capturedAt: string }
  }[],
  index: number,
  expectedToken: string,
  expectedSource: string,
): void {
  const intent = intents[index]
  if (intent === undefined) throw new Error(`checkIntent: no intent recorded at index ${index}`)
  if (intent.intentToken !== expectedToken) {
    throw new Error(
      `checkIntent: expected intentToken '${expectedToken}' but got '${intent.intentToken}'`,
    )
  }
  if (intent.handoff === undefined) {
    throw new Error('checkIntent: the with-handoff intent carries no handoff provenance')
  }
  if (intent.handoff.sourceSessionId !== expectedSource) {
    throw new Error(
      `checkIntent: expected handoff.sourceSessionId '${expectedSource}' but got '${intent.handoff.sourceSessionId}'`,
    )
  }
  if (typeof intent.handoff.contextToken !== 'string' || intent.handoff.contextToken === '') {
    throw new Error('checkIntent: the handoff provenance carries no contextToken')
  }
}
