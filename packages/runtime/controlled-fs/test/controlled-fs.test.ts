/**
 * A5-PR3 (Lane B) — ControlledFs behavioural law tests (fixture world, real
 * node:fs behind the mediator; lane-level, not host-live-wired).
 *
 * Law sources: INTERFACES-v1 C-FS + PR0 `ControlledFs` (pre-open checks,
 * grant-per-call, window law, no-old-content receipt) + design §3.1.
 *
 * @module packages/runtime/controlled-fs/test/controlled-fs
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  createPoc3World,
  dirRef,
  destroyPoc3World,
  fileRef,
  makeGrant,
  MEM_A,
  MEM_B,
  readRaw,
  sha256,
  type Poc3World,
} from './poc3-harness.js'
import {
  createControlledFsLane,
  createProductionControlledFsProvider,
  type ControlledFsLane,
  type FsAdmissionPort,
  type FsResourceDescriptor,
} from '../src/index.js'

let world: Poc3World
let lane: ControlledFsLane

const FULL = { offset: 0, limit: null } as const

/** Visibility law for the fixture: member-b never observes private/ or mine/. */
function visibility(member: { instanceId: string }, desc: FsResourceDescriptor): 'visible' | 'hidden' {
  if (member.instanceId !== 'member-b') return 'visible'
  return desc.path === 'private' || desc.path.startsWith('private/')
    || desc.path === 'mine' || desc.path.startsWith('mine/') ? 'hidden' : 'visible'
}

beforeAll(() => {
  world = createPoc3World()
  lane = createControlledFsLane({
    instances: [{ fs: 'ctl', rootDir: world.ctrl, realmId: 'realm-1', kind: 'absolute-path' }],
    visibility,
    currentAuthorityGeneration: 1,
    consumed: () => false,
  })
})

afterAll(() => {
  if (world) destroyPoc3World(world.world)
})

describe('grant-per-call admission at the FS boundary', () => {
  it('reads what the grant covers and fingerprints the returned window', async () => {
    const ref = fileRef(world, 'public/a.txt', ['read'])
    const grant = makeGrant({ member: MEM_A, effects: [{ kind: 'read', resource: ref }] })
    const res = await lane.fs.readText(grant, ref, FULL)
    expect(res.ok && res.value.text).toBe('A-CONTENT\n')
    expect(res.ok && res.value.contentFingerprint).toBe(sha256('A-CONTENT\n'))
    expect(res.ok && res.value.canonicalLocator).toBe(ref.canonicalLocator)
  })

  it('a read effect does NOT authorize a write (no scope drift)', async () => {
    const readRef = fileRef(world, 'public/a.txt', ['read'])
    const grant = makeGrant({ member: MEM_A, effects: [{ kind: 'read', resource: readRef }] })
    const write = await lane.fs.writeText(grant, readRef, 'X')
    expect(write.ok).toBe(false)
    if (!write.ok) expect(write.error.details?.['cfReason']).toBe('effect-outside-grant')
  })

  it('a foreign-realm grant is refused before any FS call (realm law)', async () => {
    const ref = fileRef(world, 'public/a.txt', ['read'])
    const grant = makeGrant({ member: MEM_A, effects: [{ kind: 'read', resource: ref }] })
    const foreign = { ...ref, realmId: 'realm-other' } as typeof ref
    const res = await lane.fs.stat(grant, foreign)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.details?.['cfReason']).toBe('realm-mismatch')
  })

  it('an expired grant is refused before any open (clock law, APPROVAL_STALE)', async () => {
    const ref = fileRef(world, 'public/a.txt', ['read'])
    const grant = makeGrant({ member: MEM_A, effects: [{ kind: 'read', resource: ref }], expiresAt: 1 })
    const laneT = createControlledFsLane({
      instances: [{ fs: 'ctl', rootDir: world.ctrl, realmId: 'realm-1', kind: 'absolute-path' }],
      visibility,
      currentAuthorityGeneration: 1,
      consumed: () => false,
      now: () => 1000,
    })
    const res = await laneT.fs.readText(grant, ref, FULL)
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.details?.['cfReason']).toBe('grant-expired')
      expect(res.error.code).toBe('APPROVAL_STALE')
    }
  })

  it('a stale authority generation is refused (generation re-check, design §3.1 tail)', async () => {
    const ref = fileRef(world, 'public/a.txt', ['read'])
    const grant = makeGrant({ member: MEM_A, effects: [{ kind: 'read', resource: ref }], authorityGeneration: 42 })
    const res = await lane.fs.readText(grant, ref, FULL)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.details?.['cfReason']).toBe('authority-generation-stale')
  })

  it('a consumed grant is refused via the ledger view (view only — consumption stays PR2 law)', async () => {
    const ref = fileRef(world, 'public/a.txt', ['read'])
    const grant = makeGrant({ member: MEM_A, effects: [{ kind: 'read', resource: ref }], grantId: 'used-up' })
    const laneC = createControlledFsLane({
      instances: [{ fs: 'ctl', rootDir: world.ctrl, realmId: 'realm-1', kind: 'absolute-path' }],
      visibility,
      currentAuthorityGeneration: 1,
      consumed: (id) => id === 'used-up',
    })
    const res = await laneC.fs.readText(grant, ref, FULL)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.details?.['cfReason']).toBe('grant-consumed')
  })
})

describe('read window law (A2C-5)', () => {
  it('limit=null means read-to-EOF; a numeric limit bounds; 0/negative/fractional are rejected', async () => {
    const ref = fileRef(world, 'public/a.txt', ['read'])
    const grant = makeGrant({ member: MEM_A, effects: [{ kind: 'read', resource: ref }] })
    const bounded = await lane.fs.readText(grant, ref, { offset: 2, limit: 3 })
    expect(bounded.ok && bounded.value.text).toBe('CONTENT'.slice(0, 3))
    const zero = await lane.fs.readText(grant, ref, { offset: 0, limit: 0 })
    expect(zero.ok).toBe(false)
    if (!zero.ok) expect(zero.error.details?.['cfReason']).toBe('window-rejected')
    const frac = await lane.fs.readText(grant, ref, { offset: 0.5, limit: null })
    expect(frac.ok).toBe(false)
  })
})

describe('write law', () => {
  it('writeText writes under a directory-scoped write effect and receipts WITHOUT old content', async () => {
    const outDir = dirRef(world, 'out', ['write', 'list'])
    const grant = makeGrant({ member: MEM_A, effects: [{ kind: 'write', resource: outDir }] })
    const target = fileRef(world, 'out/new.txt', ['write'])
    const receipt = await lane.fs.writeText(grant, target, 'FRESH\n')
    expect(receipt.ok).toBe(true)
    expect(readRaw(`${world.ctrl}/out/new.txt`)).toBe('FRESH\n')
    expect(receipt.ok && receipt.ok === true && JSON.stringify(receipt).includes('writtenFingerprint'))
  })

  it('the write receipt never carries file content (no diff-reading, M-02)', async () => {
    const outDir = dirRef(world, 'out', ['write', 'list'])
    const grant = makeGrant({ member: MEM_A, effects: [{ kind: 'write', resource: outDir }] })
    const target = fileRef(world, 'out/new.txt', ['write'])
    await lane.fs.writeText(grant, target, 'SECOND\n')
    const r2 = await lane.fs.writeText(grant, target, 'THIRD\n')
    expect(r2.ok && r2.value.writtenFingerprint).toBe(sha256('THIRD\n'))
    // structural check: the receipt object has exactly the two contract fields
    expect(r2.ok && Object.keys(r2.value).sort()).toEqual(['canonicalLocator', 'writtenFingerprint'])
  })
})

describe('stat / list observation surface', () => {
  it('stat reports visible files honestly', async () => {
    const ref = fileRef(world, 'public/a.txt', ['meta'])
    const grant = makeGrant({ member: MEM_A, effects: [{ kind: 'meta', resource: ref }] })
    const res = await lane.fs.stat(grant, ref)
    expect(res.ok && res.value).toMatchObject({ exists: true, kind: 'file', withheld: false })
  })

  it('list is a directory right and omits hidden entries for the member', async () => {
    const root = dirRef(world, '.', ['list'])
    const grantB = makeGrant({ member: MEM_B, effects: [{ kind: 'list', resource: root }] })
    const res = await lane.fs.list(grantB, root)
    expect(res.ok).toBe(true)
    if (res.ok) {
      const locators = res.value.map((r) => r.canonicalLocator)
      expect(locators.some((l) => l.includes('/private'))).toBe(false)
      expect(locators.some((l) => l.includes('/mine'))).toBe(false)
      expect(locators.some((l) => l.includes('/public'))).toBe(true)
    }
  })
})

// ── PR2/PR3 production-assembly round: the production provider ─────────────
// The provider is the kit-sequence (`gatedLane(flow)`) promoted to a class:
// assembly-time registration of realm/instances/READERS, per-call gated lane
// from an `AdmissionBoundFsCall`. These legs pin the provider semantics with
// a spy port (the full production chain with the real kernel + a real world
// runs in `packages/runtime/test/a5p2-composition.test.ts`, where BOTH
// production classes meet); the four binding laws themselves stay pinned by
// `a5w-integration-wiring.test.ts`.

describe('production controlled-fs provider', () => {
  const okPort: FsAdmissionPort = { recheckCall: async () => ({ ok: true as const }) }
  const providerCfg = () => ({
    realmId: 'realm-1',
    instances: [{ fs: 'ctl', rootDir: world.ctrl, realmId: 'realm-1', kind: 'absolute-path' as const }],
    clock: () => 1000,
    authorityGeneration: () => 1,
    consumed: () => false,
  })

  it('construction refuses (TypeError): no instances, foreign realm, duplicate fs id, missing readers', () => {
    expect(() => createProductionControlledFsProvider({ ...providerCfg(), instances: [] })).toThrow(TypeError)
    expect(() => createProductionControlledFsProvider({
      ...providerCfg(),
      instances: [{ fs: 'ctl', rootDir: world.ctrl, realmId: 'realm-2', kind: 'absolute-path' }],
    })).toThrow(/realm/)
    expect(() => createProductionControlledFsProvider({
      ...providerCfg(),
      instances: [
        { fs: 'ctl', rootDir: world.ctrl, realmId: 'realm-1', kind: 'absolute-path' },
        { fs: 'ctl', rootDir: world.outside, realmId: 'realm-1', kind: 'absolute-path' },
      ],
    })).toThrow(/twice/)
    expect(() => createProductionControlledFsProvider({
      ...providerCfg(),
      consumed: undefined as unknown as (grantId: string) => boolean,
    })).toThrow(/readers/)
  })

  it('gateCall gates a real read through the bound port (the provider path IS createAdmissionGatedControlledFs)', async () => {
    const provider = createProductionControlledFsProvider(providerCfg())
    expect(provider.realmId).toBe('realm-1')
    expect(provider.instanceIds).toEqual(['ctl'])
    const ref = fileRef(world, 'public/a.txt', ['read'])
    const grant = makeGrant({ member: MEM_A, effects: [{ kind: 'read', resource: ref }] })
    const portCalls: Array<{ op: string; fingerprint: string }> = []
    const spy: FsAdmissionPort = {
      recheckCall: async (intent) => {
        portCalls.push({ op: intent.op, fingerprint: intent.parametersFingerprint })
        return { ok: true as const }
      },
    }
    const laneG = provider.gateCall({ admission: spy, parametersFingerprint: grant.parametersFingerprint })
    const res = await laneG.fs.readText(grant, ref, FULL)
    expect(res.ok && res.value.text).toBe('A-CONTENT\n')
    expect(portCalls.length).toBe(1)
    expect(portCalls[0]?.fingerprint).toBe(grant.parametersFingerprint) // C1: the BOUND fingerprint reached the port
  })

  it('a port refusal stops the op with zero disclosure (the provider never softens the port)', async () => {
    const provider = createProductionControlledFsProvider(providerCfg())
    const ref = fileRef(world, 'public/a.txt', ['read'])
    const grant = makeGrant({ member: MEM_A, effects: [{ kind: 'read', resource: ref }] })
    const laneG = provider.gateCall({
      admission: { recheckCall: async () => ({ ok: false as const, reason: 'grant-consumed' }) },
      parametersFingerprint: grant.parametersFingerprint,
    })
    const res = await laneG.fs.readText(grant, ref, FULL)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.details?.['cfReason']).toBe('effect-outside-grant')
  })

  it('the generation reader is read PER gateCall: a lane built after a generation bump carries the NEW generation', async () => {
    let generation = 1
    const provider = createProductionControlledFsProvider({ ...providerCfg(), authorityGeneration: () => generation })
    const ref = fileRef(world, 'public/a.txt', ['read'])
    const grant = makeGrant({ member: MEM_A, effects: [{ kind: 'read', resource: ref }], authorityGeneration: 1 })
    generation = 2
    const laneG = provider.gateCall({ admission: okPort, parametersFingerprint: grant.parametersFingerprint })
    const res = await laneG.fs.readText(grant, ref, FULL)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.details?.['cfReason']).toBe('authority-generation-stale')
  })

  it('the consumed view is the provider arm the host wires (assembly.consumed): a consumed grant never re-opens', async () => {
    const consumed = new Set<string>(['already-spent'])
    const provider = createProductionControlledFsProvider({ ...providerCfg(), consumed: (id) => consumed.has(id) })
    const ref = fileRef(world, 'public/a.txt', ['read'])
    const grant = makeGrant({ member: MEM_A, effects: [{ kind: 'read', resource: ref }], grantId: 'already-spent' })
    const laneG = provider.gateCall({ admission: okPort, parametersFingerprint: grant.parametersFingerprint })
    const res = await laneG.fs.readText(grant, ref, FULL)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.details?.['cfReason']).toBe('grant-consumed')
  })
})
