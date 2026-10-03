/**
 * rc2-kit-wire-shape.test.ts — unit verification of the rc2 kit's request
 * decoder (`tests/kits/rc2-real-host-smoke/wire-shape.mjs`) against fixtures,
 * BEFORE any real-host kit run uses it.
 *
 * WHY THIS FILE EXISTS. Two failures of this round came from reading a model
 * request with the wrong generation's assumptions:
 *
 *   1. run 4 counted `role: 'tool'` messages, which the 0.2.0-rc.2 content-part
 *      wire never produces, so every chain step saw "0 tool results" forever and
 *      the scripted `decide` re-issued step 1 ~1 800 times;
 *   2. `toolResultText` JSON-stringified a 0.2 result's `content` ARRAY, so the
 *      inner JSON's quotes came back escaped (`\"targetInstanceId\"`), the field
 *      regex missed, and a bare-id fallback returned an UNMATCHED capture group
 *      (`undefined`) which the caller's `id === null` test happily forwarded into
 *      `team_delegate`.
 *
 * The decoder therefore (a) recognizes exactly two generations plus explicit
 * mixed/unknown verdicts, (b) attributes PURPOSE from a closed marker list —
 * toollessness proves nothing, because the compaction dispatch replays `tools`
 * too — and (c) FAILS LOUDLY on anything else instead of returning an empty
 * list or a sentinel. This file pins all of that on fixtures: three envelopes
 * captured live from the pinned 0.2.0-rc.2 runtime through the mock harness's
 * desensitized fixture export, two reconstructions labelled as such (0.1.x
 * classic, and the compaction dispatch built from the 0.2 summarizer source),
 * four synthetic negative shapes, and the five-case instance-id parity set.
 *
 * RUNNER CONSTRAINTS: every `it` body is synchronous (fixtures are read at load
 * time); shim-safe matchers only (toBe / toEqual / toBeTruthy / toBeFalsy /
 * toBeGreaterThan / toThrow, each with `.not`).
 *
 * @module @dsh-agent-team/testkit/test/rc2-kit-wire-shape
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  PURPOSE_AGENT,
  PURPOSE_COMPACTION,
  PURPOSE_TITLE,
  PURPOSE_UNKNOWN,
  WireShapeError,
  assertPurpose,
  assertWireShape,
  classifyPurpose,
  classifyRequest,
  extractInstanceId,
  flattenContent,
  isChainTurn,
  isErrorResult,
  isTitleDispatch,
  systemText,
  toolResultEntries,
  toolResultText,
  userText,
  WIRE_CLASSIC,
  WIRE_MIXED,
  WIRE_PARTS,
  WIRE_UNKNOWN,
} from '../../../tests/kits/rc2-real-host-smoke/wire-shape.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIXTURES = resolve(HERE, '../../../tests/kits/rc2-real-host-smoke/fixtures')
const load = (rel: string): { request: Record<string, unknown>; result?: Record<string, unknown>; payload?: Record<string, unknown> } =>
  JSON.parse(readFileSync(join(FIXTURES, rel), 'utf8'))

const CAPTURED_DIR = 'captured-0.2.0-rc.2'
const captured = (name: string) => {
  const file = load(`${CAPTURED_DIR}/${name}`)
  return file.request
}

// ---------------------------------------------------------------------------
// A — the captured 0.2.0-rc.2 generation.
// ---------------------------------------------------------------------------

describe('rc2 wire decoder — A the captured 0.2.0-rc.2 envelopes', () => {
  const withResult = captured('model-request-0.2.0-rc.2-agent-with-result-0003.json')

  it('A1 reads the parts wire: shape=parts, one tool result, an agent turn', () => {
    const c = classifyRequest(withResult)
    expect(c.shape).toBe(WIRE_PARTS)
    // The measured 0.2 result encoding: a `tool_result` PART inside a `user`
    // message, never a `role:'tool'` message.
    expect(c.unknownRoles).toEqual([])
    expect(c.unknownPartTypes).toEqual([])
    expect(c.toolResults.length).toBeGreaterThan(0)
    const firstResult = c.toolResults[0]
    if (firstResult === undefined) throw new Error('captured envelope carries no tool result')
    expect(firstResult.via).toBe(WIRE_PARTS)
    expect(c.agentTurn).toBe(true)
    expect(isChainTurn(withResult)).toBe(true)
    expect(classifyPurpose(withResult).purpose).toBe(PURPOSE_AGENT)
    // The 0.2 instruction lives in the top-level `system` key…
    expect(systemText(withResult).length).toBeGreaterThan(0)
    // …and the persona must NOT be reachable as conversation content.
    expect(userText(withResult)).not.toBe(systemText(withResult))
  })

  it('A2 a result payload survives as text and can be searched for fields', () => {
    const entries = toolResultEntries(withResult, { label: 'captured agent turn' })
    expect(entries.length).toBeGreaterThan(0)
    const first = entries[0]
    if (first === undefined) throw new Error('no decoded tool result')
    expect(typeof first.text).toBe('string')
    // A text part's text is never re-encoded, so a JSON payload keeps its quotes.
    expect(first.text.includes('\\"')).toBe(false)
  })

  it('A3 the first turn (no results yet) is still an agent turn', () => {
    const firstTurn = captured('model-request-0.2.0-rc.2-agent-first-turn-0001.json')
    const c = classifyRequest(firstTurn)
    expect(c.agentTurn).toBe(true)
    expect(c.toolResults.length).toBe(0)
    expect(classifyPurpose(firstTurn).purpose).toBe(PURPOSE_AGENT)
  })

  it('A4 the title dispatch is auxiliary and never advances the chain', () => {
    const title = captured('model-request-0.2.0-rc.2-auxiliary-title-0002.json')
    expect(classifyRequest(title).agentTurn).toBe(false)
    expect(classifyPurpose(title).purpose).toBe(PURPOSE_TITLE)
    expect(isTitleDispatch(title)).toBe(true)
    expect(isChainTurn(title)).toBe(false)
    // It carries no tool surface, so asking it for a tool result is an error.
    let threw = false
    try {
      assertWireShape(title, { label: 'title', expectToolResult: true })
    } catch (err) {
      threw = err instanceof WireShapeError
    }
    expect(threw).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// B — the 0.1.x classic generation and cross-generation equivalence.
// ---------------------------------------------------------------------------

describe('rc2 wire decoder — B the 0.1.x classic generation', () => {
  const classic = load('reconstructed/model-request-0.1.x-classic-agent-with-result.json').request

  it('B1 reads role:"tool" messages and the leading system message', () => {
    const c = classifyRequest(classic)
    expect(c.shape).toBe(WIRE_CLASSIC)
    expect(c.toolResults.length).toBe(1)
    const via = c.toolResults[0]?.via
    expect(via).toBe(WIRE_CLASSIC)
    expect(c.agentTurn).toBe(true)
    expect(classifyPurpose(classic).purpose).toBe(PURPOSE_AGENT)
    expect(systemText(classic).includes('RC2_B_PERSONA')).toBe(true)
    expect(userText(classic).includes('RC2_SMOKE_B_LEADER_TASK')).toBe(true)
  })

  it('B2 both generations yield the SAME tool-result count and text', () => {
    const parts = load('instance-id/0.2.0-rc.2-parts-create-result.json').result
    const classicResult = load('instance-id/0.1.x-classic-create-result.json').result
    const payload = load('instance-id/0.1.x-classic-create-result.json').payload
    if (payload === undefined || parts === undefined || classicResult === undefined) {
      throw new Error('parity fixtures must carry request/result/payload')
    }
    const expected = JSON.stringify(payload)
    expect(toolResultText(classicResult)).toBe(expected)
    // The whole point of flattenContent: the parts form decodes to the SAME
    // string the classic form carries, so one set of field patterns works.
    expect(toolResultText(parts)).toBe(expected)
  })
})

// ---------------------------------------------------------------------------
// C — purpose: compaction keeps `tools`, so toollessness proves nothing.
// ---------------------------------------------------------------------------

describe('rc2 wire decoder — C the compaction dispatch', () => {
  const compaction = load('reconstructed/model-request-0.2.0-rc.2-compaction-with-tools.json').request

  it('C1 MEASURED: a compaction request carries the tool surface AND replays results', () => {
    const c = classifyRequest(compaction)
    // This is the measurement that invalidates "toolless ⇒ auxiliary":
    expect(c.agentTurn).toBe(true)
    expect(c.toolResults.length).toBe(1)
    // …so a marker/count chain predicate would happily match it:
    expect(userText(compaction).includes('RC2_SMOKE_B_LEADER_TASK')).toBe(true)
  })

  it('C2 purpose is still compaction, and it may not advance the scripted chain', () => {
    expect(classifyPurpose(compaction).purpose).toBe(PURPOSE_COMPACTION)
    expect(isChainTurn(compaction)).toBe(false)
    expect(isTitleDispatch(compaction)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// D — unrecognized shapes and purposes fail loudly.
// ---------------------------------------------------------------------------

describe('rc2 wire decoder — D unexpected shapes fail instead of degrading', () => {
  it('D1 an unknown role is WIRE_UNKNOWN and assertWireShape throws', () => {
    const body = load('unexpected/model-request-unknown-role.json').request
    const c = classifyRequest(body)
    expect(c.shape).toBe(WIRE_UNKNOWN)
    expect(c.unknownRoles).toEqual(['observer'])
    let err: unknown = null
    try {
      assertWireShape(body, { label: 'unknown role' })
    } catch (e) {
      err = e
    }
    expect(err instanceof WireShapeError).toBe(true)
    const info = (err as { info?: Record<string, unknown> }).info ?? {}
    expect(JSON.stringify(info)).toContain('observer')
  })

  it('D2 an unknown content-part type is reported, never ignored', () => {
    const body = load('unexpected/model-request-unknown-part-type.json').request
    expect(classifyRequest(body).unknownPartTypes).toEqual(['user:telepathy'])
    let threw = false
    try {
      toolResultEntries(body, { label: 'unknown part' })
    } catch (e) {
      threw = e instanceof WireShapeError
    }
    expect(threw).toBe(true)
  })

  it('D3 both encodings in one request is MIXED and asserts fail', () => {
    const body = load('unexpected/model-request-mixed-encodings.json').request
    const c = classifyRequest(body)
    expect(c.shape).toBe(WIRE_MIXED)
    let threw = false
    try {
      assertWireShape(body, { label: 'mixed' })
    } catch (e) {
      threw = e instanceof WireShapeError
    }
    expect(threw).toBe(true)
  })

  it('D4 a toolless request with no known purpose is UNKNOWN and refuses a neutral reply', () => {
    const body = load('unexpected/model-request-toolless-no-purpose.json').request
    expect(classifyPurpose(body).purpose).toBe(PURPOSE_UNKNOWN)
    let err: unknown = null
    try {
      assertPurpose(body, { label: 'toolless' })
    } catch (e) {
      err = e
    }
    expect(err instanceof WireShapeError).toBe(true)
    expect(String((err as Error).message)).toContain('purpose')
  })

  it('D5 a malformed input (null / non-object) is unknown, not empty-but-fine', () => {
    expect(classifyRequest(null).shape).toBe(WIRE_UNKNOWN)
    expect(classifyRequest({ messages: 'not-an-array' }).shape).toBe(WIRE_UNKNOWN)
  })
})

// ---------------------------------------------------------------------------
// E — the instance-id extractor: parity plus fail-loud negatives.
// ---------------------------------------------------------------------------

describe('rc2 wire decoder — E instance id extraction is generation-identical and strict', () => {
  const ID = 'inst-rc2smoke-b1'

  it('E1 the same payload yields the same id in both encodings', () => {
    const classic = load('instance-id/0.1.x-classic-create-result.json').result
    const parts = load('instance-id/0.2.0-rc.2-parts-create-result.json').result
    if (classic === undefined || parts === undefined) throw new Error('parity fixtures incomplete')
    expect(extractInstanceId(classic, { label: 'classic' })).toBe(ID)
    expect(extractInstanceId(parts, { label: 'parts' })).toBe(ID)
  })

  it('E2 an ERROR result never yields an id, even though it contains one', () => {
    const errResult = load('instance-id/error-result.json').result
    if (errResult === undefined) throw new Error('negative fixture incomplete')
    expect(isErrorResult(errResult)).toBe(true)
    let threw = false
    try {
      extractInstanceId(errResult, { label: 'error result' })
    } catch (e) {
      threw = e instanceof WireShapeError
    }
    expect(threw).toBe(true)
  })

  it('E3 empty and id-less results throw — they never return null / undefined / ""', () => {
    for (const rel of ['instance-id/empty-result.json', 'instance-id/no-id-result.json']) {
      const result = load(rel).result
      if (result === undefined) throw new Error(`negative fixture incomplete: ${rel}`)
      let threw = false
      let value: unknown = 'sentinel'
      try {
        value = extractInstanceId(result, { label: rel })
      } catch (e) {
        threw = e instanceof WireShapeError
      }
      expect(threw).toBe(true)
      expect(value).toBe('sentinel')
    }
    // And the degenerate inputs, directly:
    for (const bad of [null, undefined, '', {}, { content: [] }, { content: [{ type: 'text', text: '' }] }]) {
      let threw = false
      try {
        extractInstanceId(bad, { label: 'degenerate' })
      } catch (e) {
        threw = e instanceof WireShapeError
      }
      expect(threw).toBe(true)
    }
  })

  it('E4 flattenContent unwraps text parts verbatim and serializes the rest once', () => {
    expect(flattenContent('plain')).toBe('plain')
    expect(flattenContent([{ type: 'text', text: '{"a":1}' }])).toBe('{"a":1}')
    expect(flattenContent(['a', { type: 'image', source: { x: 1 } }])).toContain('"image"')
    expect(flattenContent(null)).toBe('')
    expect(flattenContent([{ type: 'text', text: 'x' }, { type: 'text', text: 'y' }])).toBe('x\ny')
  })
})
