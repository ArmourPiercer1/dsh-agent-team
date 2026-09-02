/**
 * p8s7r4-handoff-surface.test.ts — P8-S7-R4 W1 (A28, coverage row M11):
 * the two PURE halves of the handoff production ports
 * (`../src/plugin/handoff-surface.js`), the parts that un-fail-close the
 * two handoff production ports in the production root:
 *
 * - `readCanonicalSourceSurface` — the EXACTLY-ONE canonical surface
 *   freeze through the injected DSH public `sessionQuery` service (the
 *   public session-read authority; Architecture §34.2 stage 1). Proven
 *   here: `readSurface` is called EXACTLY ONCE per freeze; the title is
 *   best-effort (a per-session rejection degrades to `null` and never
 *   fails the handoff); only model-visible text crosses (text blocks
 *   joined with a newline, unknown blocks and `tool/result` events
 *   skipped); the result is lossless JSON with the capture bound in
 *   `metadata.capturedThroughSeq`.
 * - `summarizeSourceSurface` — the one-shot NON-MODEL deterministic
 *   digest (stage 2): a pure function of the frozen surface (same input
 *   → byte-identical output; no I/O, no clock read, no model call). The
 *   title preference (surface title → first user request (60-char bound)
 *   → `Handoff from session <id>`) and the bounded bullets (160-char
 *   single-char ellipsis) are asserted verbatim.
 *
 * Runner note: the plain-node shim (scripts/test-vitest-shim.mjs)
 * forbids async `it()` bodies and exposes only toBe/toEqual/
 * toBeGreaterThan/toThrow — so every scenario is driven at MODULE TOP
 * LEVEL and the `it` bodies assert synchronously over the captured
 * results (the P6-T2 / P8-S3 / P7-T5 pattern).
 *
 * @module @dsh-agent-team/runtime/test/p8s7r4-handoff-surface
 */
import { describe, expect, it } from 'vitest'
import {
  readCanonicalSourceSurface,
  summarizeSourceSurface,
} from '../src/plugin/handoff-surface.js'
import type {
  HandoffSurfaceSnapshotView,
  HandoffTitleObservationResultView,
  SessionQueryPort,
} from '../src/plugin/handoff-surface.js'
import type { SourceCanonicalSurface } from '../handoff/types.js'

/** The fixture source session (an ordinary DSH session id). */
const SRC = 'session-p8s7r4-sfsrc'
/** The fixture session creation instant (epoch ms). */
const CREATED_AT = 1725000000000
/** The fixture creation instant as the canonical surface ISO stamp. */
const CREATED_AT_ISO = new Date(CREATED_AT).toISOString()

/**
 * The fixture canonical-surface observation: two model-visible messages
 * (a two-block user message with one unknown block, a tool result, and a
 * one-block assistant message) and the capture bound.
 */
const SNAPSHOT_VIEW: HandoffSurfaceSnapshotView = {
  session: { id: SRC, createdAt: CREATED_AT },
  capturedThroughSeq: 7,
  events: [
    {
      seq: 1,
      type: 'user/message',
      time: CREATED_AT + 1000,
      data: {
        content: [
          { type: 'text', text: 'do the thing' },
          { type: 'text', text: 'and more' },
          { type: 'image', text: 'never model-visible' },
        ],
      },
    },
    { seq: 2, type: 'tool/result', time: CREATED_AT + 2000, data: { output: 'skipped' } },
    {
      seq: 3,
      type: 'assistant/message',
      time: CREATED_AT + 3000,
      data: { message: { content: [{ type: 'text', text: 'all done' }] } },
    },
  ],
}

// --- S1: the EXACTLY-ONE freeze with a fulfilled title ------------------------

const s1 = { readSurfaceCount: 0, readTitleCount: 0 }
const s1Query: SessionQueryPort = {
  readSurface: async (id: string) => {
    s1.readSurfaceCount += 1
    if (id !== SRC) throw new Error(`readSurface called with '${id}'`)
    return SNAPSHOT_VIEW
  },
  readTitleSnapshots: async (ids: readonly string[]) => {
    s1.readTitleCount += 1
    return ids.map(
      (sid) =>
        ({ status: 'fulfilled', value: { title: { title: 'Froze title' } } }) as HandoffTitleObservationResultView,
    )
  },
}
const s1Surface: SourceCanonicalSurface = await readCanonicalSourceSurface(s1Query, SRC)

// --- S2: a rejected title degrades to null (the handoff never fails) ---------

const s2 = { readSurfaceCount: 0 }
const s2Query: SessionQueryPort = {
  readSurface: async () => {
    s2.readSurfaceCount += 1
    return SNAPSHOT_VIEW
  },
  readTitleSnapshots: async () => [
    { status: 'rejected', reason: new Error('title observation failed') },
  ],
}
const s2Surface: SourceCanonicalSurface = await readCanonicalSourceSurface(s2Query, SRC)

// --- S3: a surface-read failure propagates (the service maps it) -------------

const s3Cause = new Error('source session not found')
const s3Query: SessionQueryPort = {
  readSurface: async () => {
    throw s3Cause
  },
  readTitleSnapshots: async () => [],
}
let s3Error: unknown = null
try {
  await readCanonicalSourceSurface(s3Query, SRC)
} catch (err) {
  s3Error = err
}

// --- S4: the digest is a pure deterministic function of the frozen surface ---

const s4a = summarizeSourceSurface(s1Surface)
const s4b = summarizeSourceSurface(s1Surface)

// --- S5: title preference #2 — the first user request (60-char bound) --------

const s5LongUser = 'x'.repeat(200)
const s5Surface: SourceCanonicalSurface = {
  sessionId: SRC,
  title: null,
  createdAt: CREATED_AT_ISO,
  messages: [
    { role: 'user', text: s5LongUser },
    { role: 'assistant', text: 'ok' },
  ],
  metadata: {},
}
const s5Summary = summarizeSourceSurface(s5Surface)

// --- S6: title preference #3 — no user message (the session id fallback) -----

const s6Surface: SourceCanonicalSurface = {
  sessionId: SRC,
  title: null,
  createdAt: CREATED_AT_ISO,
  messages: [{ role: 'assistant', text: 'only assistant' }],
  metadata: {},
}
const s6Summary = summarizeSourceSurface(s6Surface)

// --- S7: the empty surface (no model-visible messages at capture time) -------

const s7Surface: SourceCanonicalSurface = {
  sessionId: SRC,
  title: null,
  createdAt: CREATED_AT_ISO,
  messages: [],
  metadata: {},
}
const s7Summary = summarizeSourceSurface(s7Surface)

// --- assertions ----------------------------------------------------------------

describe('p8s7r4 A28 — the pure handoff port halves (readCanonicalSourceSurface / summarizeSourceSurface)', () => {
  it('S1: the freeze reads the source surface EXACTLY ONCE and maps only model-visible text', () => {
    expect(s1.readSurfaceCount).toBe(1)
    expect(s1.readTitleCount).toBe(1)
    expect(s1Surface.sessionId).toBe(SRC)
    expect(s1Surface.title).toBe('Froze title')
    expect(s1Surface.createdAt).toBe(CREATED_AT_ISO)
    expect(s1Surface.messages).toEqual([
      { role: 'user', text: 'do the thing\nand more' },
      { role: 'assistant', text: 'all done' },
    ])
    expect(s1Surface.metadata).toEqual({ capturedThroughSeq: 7 })
  })

  it('S2: a per-session title rejection degrades to a null title (the freeze still reads exactly once)', () => {
    expect(s2.readSurfaceCount).toBe(1)
    expect(s2Surface.title).toBe(null)
    expect(s2Surface.messages).toEqual([
      { role: 'user', text: 'do the thing\nand more' },
      { role: 'assistant', text: 'all done' },
    ])
  })

  it('S3: a surface-read failure propagates unchanged (the service maps it to HANDOFF_SOURCE_SURFACE_UNAVAILABLE)', () => {
    expect(s3Error).toBe(s3Cause)
  })

  it('S4: the digest is deterministic and pure — the same frozen surface yields the identical summary', () => {
    expect(s4b).toEqual(s4a)
    expect(s4a).toEqual({
      title: 'Froze title',
      bullets: [
        `Captured 2 message(s) — 1 user, 1 assistant — at ${CREATED_AT_ISO} through log seq 7.`,
        'First request: "do the thing\nand more"',
        'Last response: "all done"',
      ],
    })
  })

  it('S5: without a title the digest title is the first user request, 60-char bounded (single-char ellipsis)', () => {
    expect(s5Summary.title).toBe(`${'x'.repeat(59)}…`)
    expect(s5Summary.bullets[0]).toBe(
      `Captured 2 message(s) — 1 user, 1 assistant — at ${CREATED_AT_ISO}.`,
    )
    expect(s5Summary.bullets[1]).toBe(`First request: "${'x'.repeat(159)}…"`)
    expect(s5Summary.bullets[2]).toBe('Last response: "ok"')
  })

  it('S6: with no user message the digest title falls back to the session id line', () => {
    expect(s6Summary.title).toBe(`Handoff from session ${SRC}`)
    expect(s6Summary.bullets).toEqual([
      `Captured 1 message(s) — 0 user, 1 assistant — at ${CREATED_AT_ISO}.`,
      'Last response: "only assistant"',
    ])
  })

  it('S7: the empty surface yields the no-messages digest line', () => {
    expect(s7Summary.title).toBe(`Handoff from session ${SRC}`)
    expect(s7Summary.bullets).toEqual([
      `Captured 0 message(s) — 0 user, 0 assistant — at ${CREATED_AT_ISO}.`,
      'The source session carries no model-visible messages at capture time.',
    ])
  })
})
