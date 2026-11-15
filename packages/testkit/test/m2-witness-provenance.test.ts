/**
 * M7-A additions to the testkit surface, tested where the package keeps its
 * tests: the witness provenance seal, the oracle's `witnessed` mode, and the
 * wire script driver that lets a REAL host be driven by the same `agent-script/1`
 * law as the in-process adapter.
 *
 * The real-host end-to-end case lives in tests/world-factory/m7a-real-slice.test.mjs
 * (it needs a booted DSH); these cases are the host-free contract that slice
 * relies on.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { judgeContract } from '../src/contract-oracle.js'
import type { TraceEvent } from '../src/contract-oracle.js'
import {
  areSealedWitnessObservations,
  createBlindWitness,
  createFsWitness,
  isSealedWitnessObservation,
} from '../src/effect-witness.js'
import { createWireScriptDriver } from '../src/wire-script.js'

const dirs: string[] = []
function scratch(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `dsh-testkit-${label}-`))
  dirs.push(dir)
  return dir
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const refusedTrace: TraceEvent[] = [
  { event_seq: 1, event_type: 'tool/call', actor_id: 'session-x', authority_ref: null, outcome: 'DISPATCHED' },
  { event_seq: 2, event_type: 'tool/result', actor_id: 'session-x', authority_ref: null, outcome: 'DENIED' },
]

describe('witness provenance seal', () => {
  it('seals instrument rows and refuses a hand-built row in witnessed mode', async () => {
    const root = scratch('seal')
    const watched = join(root, 'watched')
    mkdirSync(watched, { recursive: true })
    const rows = await createFsWitness({ root, outside: watched }).observe()
    expect(rows.every((row) => isSealedWitnessObservation(row))).toBe(true)
    const handBuilt = [{ domain: 'filesystem' as const, observed: false, instrumented: true, evidence: [] }]

    const declared = judgeContract({
      contractId: 'provenance',
      events: refusedTrace,
      witness: handBuilt,
      blindDomains: ['process', 'network'],
      requiredEffectDomains: ['filesystem'],
      witnessProvenance: 'declared',
    })
    expect(declared.verdict).toBe('SATISFIED')

    const witnessed = judgeContract({
      contractId: 'provenance',
      events: refusedTrace,
      witness: handBuilt,
      blindDomains: ['process', 'network'],
      requiredEffectDomains: ['filesystem'],
      witnessProvenance: 'witnessed',
    })
    expect(witnessed.verdict).toBe('INSTRUMENT_ERROR')
    expect(witnessed.reasons.join(' ')).toContain('provenance seal')
  })

  it('cannot be replayed through JSON, and says so', async () => {
    const root = scratch('replay')
    const watched = join(root, 'watched')
    mkdirSync(watched, { recursive: true })
    const rows = await createFsWitness({ root, outside: watched }).observe()
    expect(areSealedWitnessObservations(rows)).toBe(true)
    expect(areSealedWitnessObservations(JSON.parse(JSON.stringify(rows)))).toBe(false)
    expect(areSealedWitnessObservations([])).toBe(false)
  })

  it('a blinded instrument can never pass, and a real effect is a violation', async () => {
    const root = scratch('verdicts')
    const watched = join(root, 'watched')
    mkdirSync(watched, { recursive: true })
    const witness = createFsWitness({ root, outside: watched })
    await witness.observe()

    writeFileSync(join(watched, 'escape.txt'), 'ESCAPE\n')
    const violated = judgeContract({
      contractId: 'effect',
      events: refusedTrace,
      witness: await witness.observe(),
      blindDomains: witness.blindDomains,
      requiredEffectDomains: ['filesystem'],
      witnessProvenance: 'witnessed',
    })
    expect(violated.verdict).toBe('VIOLATED')

    const blinded = createBlindWitness(witness, ['filesystem'])
    const inconclusive = judgeContract({
      contractId: 'effect',
      events: refusedTrace,
      witness: await blinded.observe(),
      blindDomains: blinded.blindDomains,
      requiredEffectDomains: ['filesystem'],
      witnessProvenance: 'witnessed',
    })
    expect(inconclusive.verdict).toBe('INCONCLUSIVE')
  })
})

describe('wire script driver', () => {
  const request = (toolNames: string[], text: string) => ({
    tools: toolNames.map((name) => ({ function: { name } })),
    messages: [{ role: 'user' as const, content: text }],
  })

  it('consumes one turn per agent request and answers aux requests without consuming', async () => {
    const driver = createWireScriptDriver(
      {
        schema: 'agent-script/1',
        turns: [
          {
            expect_request: { tools_include: ['write'], contains_text: 'GO' },
            respond: { kind: 'tool-call', name: 'write', args: { file_path: 'a', content: 'b' } },
          },
          { respond: { kind: 'text', text: 'DONE' } },
        ],
      },
      { callIdPrefix: 'w' },
    )
    expect(await driver.decide({ seq: 1, req: { messages: [] } })).toEqual({ kind: 'text', content: 'WIRE-AUX' })
    expect(driver.consumedTurns).toBe(0)
    const call = await driver.decide({ seq: 2, req: request(['write', 'bash'], 'GO') })
    expect(call).toMatchObject({ kind: 'tool-call', toolCalls: [{ id: 'w-0', name: 'write' }] })
    expect(await driver.decide({ seq: 3, req: request(['write'], 'GO result') })).toEqual({ kind: 'text', content: 'DONE' })
    driver.assertComplete()
    await expect(driver.decide({ seq: 4, req: request(['write'], 'again') })).rejects.toMatchObject({ code: 'SCRIPT_EXHAUSTED' })
  })

  it('refuses a request that does not match the declared expectation', async () => {
    const driver = createWireScriptDriver(
      { schema: 'agent-script/1', turns: [{ expect_request: { tools_include: ['write'] }, respond: { kind: 'text', text: 'X' } }] },
      {},
    )
    await expect(driver.decide({ seq: 1, req: request(['read'], 'p') })).rejects.toMatchObject({ code: 'SCRIPT_UNEXPECTED_REQUEST' })
  })
})
