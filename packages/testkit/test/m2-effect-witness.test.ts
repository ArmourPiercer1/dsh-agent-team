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
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { judgeContract } from '../src/index.js'
import { createBlindWitness, createFsWitness } from '../src/index.js'

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

    expect(filesystem).toEqual({ domain: 'filesystem', observed: false, instrumented: true, evidence: [] })
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
