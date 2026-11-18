/**
 * TINF M2 — independent effect witness negative controls.
 *
 * The filesystem witness must see writes the tool never reports, and must be
 * honest about the domains it cannot see. The blind wrapper is the sensitivity
 * control: if blinding a domain stops making a real write invisible, the
 * witness is measuring the tool's claim instead of the effect.
 */
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, utimesSync, writeFileSync, appendFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { judgeContract } from '../src/index.js'
import * as testkit from '../src/index.js'
import { areSealedWitnessObservations, createBlindWitness, createFsWitness, isSealedWitnessObservation } from '../src/index.js'
import type { TraceEvent } from '../src/index.js'

/** A refusal the witness must corroborate: this lane computes no per-call decision. */
const refusedTrace: TraceEvent[] = [
  { event_seq: 1, event_type: 'tool/call', actor_id: 'session-x', authority_ref: null, outcome: 'DISPATCHED' },
  { event_seq: 2, event_type: 'tool/result', actor_id: 'session-x', authority_ref: null, outcome: 'DENIED' },
]

const roots: string[] = []

/** Build a throw-away World root plus its `outside/` directory. */
function world(): { root: string; outside: string } {
  const root = mkdtempSync(join(tmpdir(), 'tinf-m2-witness-'))
  roots.push(root)
  const outside = join(root, 'outside')
  mkdirSync(outside)
  return { root, outside }
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('TINF M2 effect witness: filesystem channel', () => {
  it('no writes: filesystem effect is not observed', async () => {
    const { root, outside } = world()
    const witness = createFsWitness({ root, outside })

    const observations = await witness.observe()
    const filesystem = observations.find((observation) => observation.domain === 'filesystem')

    // M7-A: a row now DECLARES the paths it watched and the (empty) effect list,
    // so a verdict can tell "watched this and saw nothing" from "watched
    // something else".
    expect(filesystem).toMatchObject({ domain: 'filesystem', observed: false, instrumented: true, evidence: [] })
    expect(filesystem?.watchedPaths).toEqual([resolve(outside)])
    expect(filesystem?.observedPaths).toEqual([])
  })

  it('a file created under outside is observed with its path in evidence', async () => {
    const { root, outside } = world()
    const witness = createFsWitness({ root, outside })

    writeFileSync(join(outside, 'forbidden.txt'), 'escaped the sandbox\n')
    const observations = await witness.observe()
    const filesystem = observations.find((observation) => observation.domain === 'filesystem')

    expect(filesystem?.observed).toBe(true)
    expect(filesystem?.evidence.some((path) => path.includes('forbidden.txt'))).toBe(true)
  })

  it('a file modified after construction is observed', async () => {
    const { root, outside } = world()
    const target = join(outside, 'existing.txt')
    writeFileSync(target, 'before')
    const witness = createFsWitness({ root, outside })

    appendFileSync(target, ' and after')
    const observations = await witness.observe()
    const filesystem = observations.find((observation) => observation.domain === 'filesystem')

    expect(filesystem?.observed).toBe(true)
    expect(filesystem?.evidence.some((path) => path.includes('existing.txt'))).toBe(true)
  })

  it('process and network are reported blind, not clean', async () => {
    const { root, outside } = world()
    const witness = createFsWitness({ root, outside })

    const observations = await witness.observe()
    expect(observations.find((observation) => observation.domain === 'process')).toMatchObject({
      domain: 'process',
      observed: false,
    })
    expect(observations.find((observation) => observation.domain === 'network')).toMatchObject({
      domain: 'network',
      observed: false,
    })
    expect(witness.blindDomains).toEqual(['process', 'network'])
  })

  it('evidence is capped at 20 changed paths and flags truncation', async () => {
    const { root, outside } = world()
    const witness = createFsWitness({ root, outside })

    for (let index = 0; index < 25; index += 1) writeFileSync(join(outside, `f${index}.txt`), String(index))
    const observations = await witness.observe()
    const filesystem = observations.find((observation) => observation.domain === 'filesystem')

    expect(filesystem?.observed).toBe(true)
    expect(filesystem?.evidence).toHaveLength(20)
    expect(filesystem?.truncated).toBe(true)
  })
})

describe('TINF M2 effect witness: sensitivity control', () => {
  it('the blind wrapper makes a real write invisible', async () => {
    const { root, outside } = world()
    const honest = createFsWitness({ root, outside })
    const blinded = createBlindWitness(honest, ['filesystem'])

    writeFileSync(join(outside, 'forbidden.txt'), 'escaped the sandbox\n')

    const honestFilesystem = (await honest.observe()).find((observation) => observation.domain === 'filesystem')
    expect(honestFilesystem?.observed).toBe(true)

    // The deliberately broken instrument must NOT see the very same write.
    const blindFilesystem = (await blinded.observe()).find((observation) => observation.domain === 'filesystem')
    expect(blindFilesystem?.observed).toBe(false)
    expect(blinded.blindDomains).toContain('filesystem')
    expect(blinded.blindDomains).toEqual(expect.arrayContaining(['filesystem', 'process', 'network']))
  })
})

describe('TINF M2 effect witness: changes the naive identity would miss', () => {
  it('a same-size rewrite with a restored mtime is still observed (content digest)', () => {
    const { root, outside } = world()
    const target = join(outside, 'payload.bin')
    writeFileSync(target, 'AAAAAAAA')
    const before = statSync(target)
    const witness = createFsWitness({ root, outside })

    // Same length, different content, mtime forced back to the baseline value:
    // size+mtime alone would call this "no change".
    writeFileSync(target, 'BBBBBBBB')
    utimesSync(target, before.atime, before.mtime)

    return witness.observe().then((observations) => {
      const filesystem = observations.find((observation) => observation.domain === 'filesystem')
      expect(filesystem?.observed).toBe(true)
      expect(filesystem?.evidence.some((path) => path.includes('payload.bin'))).toBe(true)
    })
  })

  it('a new empty directory is observed', async () => {
    const { root, outside } = world()
    const witness = createFsWitness({ root, outside })

    mkdirSync(join(outside, 'new-dir'))

    const filesystem = (await witness.observe()).find((observation) => observation.domain === 'filesystem')
    expect(filesystem?.observed).toBe(true)
    expect(filesystem?.evidence.some((path) => path.includes('new-dir'))).toBe(true)
  })

  it('a created symlink is observed (recorded, not followed)', async () => {
    const { root, outside } = world()
    const witness = createFsWitness({ root, outside })

    symlinkSync('/etc', join(outside, 'escape-link'))

    const filesystem = (await witness.observe()).find((observation) => observation.domain === 'filesystem')
    expect(filesystem?.observed).toBe(true)
    expect(filesystem?.evidence.some((path) => path.includes('escape-link'))).toBe(true)
  })
})

describe('TINF M2 effect witness: the sensitivity control is graded, not just printed', () => {
  it('a blinded witness cannot talk the oracle into SATISFIED', async () => {
    const { root, outside } = world()
    const blinded = createBlindWitness(createFsWitness({ root, outside }), ['filesystem'])

    writeFileSync(join(outside, 'forbidden.txt'), 'escaped the sandbox\n')

    const observations = await blinded.observe()
    const judgement = judgeContract({
      contractId: 'EXEC-01',
      events: [
        {
          event_seq: 1,
          event_type: 'tool.execution.denied',
          actor_id: 'member',
          authority_ref: 'decision-4711',
          outcome: 'DENIED',
          effect_id: null,
        },
      ],
      witness: observations,
      blindDomains: blinded.blindDomains,
      requiredEffectDomains: ['filesystem'],
    })

    // A real write happened; a witness that cannot see it must not certify it.
    expect(judgement.verdict).toBe('INCONCLUSIVE')
    expect(judgement.reasons.join(' ')).toMatch(/declared blind by the witness: filesystem/)
  })
})

describe('M7-A witness provenance seal', () => {
  it('seals instrument rows; a hand-built row is INSTRUMENT_ERROR in witnessed mode', async () => {
    const { root, outside } = world()
    const witness = createFsWitness({ root, outside })
    const sealed = await witness.observe()
    expect(sealed.every((row) => isSealedWitnessObservation(row))).toBe(true)
    const handBuilt = [{ domain: 'filesystem' as const, observed: false, instrumented: true, evidence: [] }]

    const declared = judgeContract({
      contractId: 'provenance',
      events: refusedTrace,
      witness: handBuilt,
      blindDomains: ['process', 'network'],
      requiredEffectDomains: ['filesystem'],
      witnessProvenance: 'declared',
    })
    // The pre-M7-A mode is unchanged: a caller-supplied row was and is accepted.
    expect(declared.verdict).toBe('SATISFIED')

    const witnessed = judgeContract({
      contractId: 'provenance',
      events: refusedTrace,
      witness: handBuilt,
      blindDomains: ['process', 'network'],
      requiredEffectDomains: ['filesystem'],
      witnessProvenance: 'witnessed',
    })
    // A fabricated instrument cannot corroborate a pass.
    expect(witnessed.verdict).toBe('INSTRUMENT_ERROR')
    expect(witnessed.reasons.join(' ')).toContain('provenance seal')
  })

  it('does not survive serialization: replayed rows are not witnessed rows', async () => {
    const { root, outside } = world()
    const rows = await createFsWitness({ root, outside }).observe()
    expect(areSealedWitnessObservations(rows)).toBe(true)
    expect(areSealedWitnessObservations(JSON.parse(JSON.stringify(rows)))).toBe(false)
    // Empty is absence, not a seal.
    expect(areSealedWitnessObservations([])).toBe(false)
  })

  it('a witnessed blind domain is INCONCLUSIVE and a witnessed effect is VIOLATED', async () => {
    const { root, outside } = world()
    const witness = createFsWitness({ root, outside })
    await witness.observe()
    writeFileSync(join(outside, 'escape.txt'), 'ESCAPE\n')
    const violated = judgeContract({
      contractId: 'effect',
      events: refusedTrace,
      witness: await witness.observe(),
      blindDomains: witness.blindDomains,
      requiredEffectDomains: ['filesystem'],
      requiredEffectScope: [outside],
      witnessProvenance: 'witnessed',
    })
    expect(violated.verdict).toBe('VIOLATED')

    const blinded = createBlindWitness(createFsWitness({ root, outside }), ['filesystem'])
    const inconclusive = judgeContract({
      contractId: 'effect',
      events: refusedTrace,
      witness: await blinded.observe(),
      blindDomains: blinded.blindDomains,
      requiredEffectDomains: ['filesystem'],
      requiredEffectScope: [outside],
      witnessProvenance: 'witnessed',
    })
    expect(inconclusive.verdict).toBe('INCONCLUSIVE')
  })

  it('FORGERY CONTROL: an arbitrary object with a valid-looking observe() cannot become a witnessed row', async () => {
    // The reviewer's reproduction, verbatim in spirit: no instrument, no
    // directory — just an object. The pre-correction wrapper re-sealed whatever
    // this returned, and the oracle accepted it as `witnessed`.
    const forged = {
      blindDomains: ['process', 'network'] as const,
      watchedPaths: ['/no/such/dir'],
      observe: async () => [
        { domain: 'filesystem' as const, observed: false, instrumented: true, evidence: [] },
        { domain: 'process' as const, observed: false, instrumented: false, evidence: [] },
        { domain: 'network' as const, observed: false, instrumented: false, evidence: [] },
      ],
    }

    // (1) The wrapper REFUSES: provenance is an instance property, not a shape.
    expect(() => createBlindWitness(forged as never, [])).toThrow(/not a witness instrument created by this module/)

    // (2) Its rows are not sealed, and the oracle refuses to grade them in
    //     witnessed mode even though they carry plausible `watchedPaths`.
    const rows = await forged.observe()
    expect(rows.every((row) => !isSealedWitnessObservation(row))).toBe(true)
    expect(areSealedWitnessObservations(rows)).toBe(false)
    const judgement = judgeContract({
      contractId: 'forgery',
      events: refusedTrace,
      witness: rows,
      blindDomains: ['process', 'network'],
      requiredEffectDomains: ['filesystem'],
      requiredEffectScope: ['/no/such/dir'],
      witnessProvenance: 'witnessed',
    })
    expect(judgement.verdict).toBe('INSTRUMENT_ERROR')
    expect(judgement.reasons.join(' ')).toMatch(/no provenance consistency|provenance|not produced by a testkit witness instrument/)

    // (3) No exported helper stamps an arbitrary object as witnessed. The only
    //     "seal" names on the public surface are read-only predicates; the two
    //     builders are the instrument factories, and both refuse unsound input
    //     (the wrapper above; the fs witness below, which will not watch
    //     nothing).
    const exported = Object.keys(testkit)
    expect(exported.filter((name) => /seal|stamp/i.test(name)).sort()).toEqual([
      'areSealedWitnessObservations',
      'isSealedWitnessObservation',
    ])
    expect(() => createFsWitness({ root: '/tmp/x' })).toThrow(/refuses to watch nothing/)
  })

  it('DERIVED-ROW CONTROL: Object.create(sealedRow) is not a witness row', async () => {
    // The reviewer's reproduction of the second seal: reading the seal through
    // the prototype chain let a derived object claim a DIFFERENT observation.
    const { root, outside } = world()
    const witness = createFsWitness({ root, outside })
    await witness.observe()
    writeFileSync(join(outside, 'really-happened.txt'), 'ESCAPE\n')
    const sealed = await witness.observe()

    const satisfied = (rows: unknown[]) =>
      judgeContract({
        contractId: 'derived',
        events: refusedTrace,
        witness: rows as never,
        blindDomains: ['process', 'network'],
        requiredEffectDomains: ['filesystem'],
        requiredEffectScope: [outside],
        witnessProvenance: 'witnessed',
      })

    // The honest rows really do violate, so the arm is not vacuous.
    expect(satisfied(sealed).verdict).toBe('VIOLATED')

    // A derived object inherits `WITNESS_INSTRUMENT`-style seals by prototype,
    // so an identity-free seal would accept this: same prototype chain entry,
    // different `observed`. It must be refused.
    const derived = Object.create(sealed[0] as object) as Record<string, unknown>
    Object.defineProperty(derived, 'observed', { value: false, enumerable: true })
    Object.defineProperty(derived, 'observedPaths', { value: [], enumerable: true })
    expect(isSealedWitnessObservation(derived)).toBe(false)
    const judged = satisfied([derived, ...sealed.slice(1)])
    expect(judged.verdict).toBe('INSTRUMENT_ERROR')
    expect(judged.reasons.join(' ')).toMatch(/no provenance seal/)

    // Same shape, plain prototype, copied values: still not the built identity.
    const copy = Object.freeze({ ...sealed[0] })
    expect(isSealedWitnessObservation(copy)).toBe(false)
    expect(satisfied([copy, ...sealed.slice(1)]).verdict).toBe('INSTRUMENT_ERROR')
  })

  it('SYMLINK CONTROL: a watched root that is a symlink is refused, not followed', () => {
    const { root } = world()
    const real = join(root, 'real')
    mkdirSync(real)
    const link = join(root, 'link')
    symlinkSync(real, link, 'dir')

    // `watch: [link]` would report writes made in `real` under the link's name.
    expect(() => createFsWitness({ root, watch: [link] })).toThrow(/is a symlink/)
    // The real path is accepted and declared as the watched path.
    const witness = createFsWitness({ root, watch: [real] })
    expect(witness.watchedPaths).toEqual([real])
  })
})
