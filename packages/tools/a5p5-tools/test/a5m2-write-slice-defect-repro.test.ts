/**
 * a5m2 write-slice — DEFECT REPRODUCTION (pre-fix, frozen old revision).
 *
 * This file pins the THREE reproduced defects of the FIRST revision of
 * `write-slice.ts` (pushed as `a852227c6`, frozen verbatim copy at
 * `dev/agent-workflow/evidence/alpha5/m2-write/repro/pre-fix-write-slice.ts`,
 * imported below — the copy is NEVER production code; it exists so the
 * "before-fix" claim is verbatim-runnable forever). The fix round (root
 * security ruling 07:13) closes each defect in the LIVE `write-slice.ts`;
 * the matching AFTER legs live in `a5m2-write-slice.test.ts`.
 *
 *   D1  cross member/call authorization — the first revision froze the plan
 *       as the EFFECT-SET fingerprint (content-blind) and never forwarded
 *       `call.member`: one approval for a target auto-approves ANY content,
 *       ANY callId, ANY member at that target.
 *   D2  concurrent two writes on one grant — consumption was recorded by
 *       `onWriteCommitted` AFTER success; two calls over the SAME grant race
 *       the view: both open, both write, one grant.
 *   D3  root swapped to a symlink during the PA wait — the lane binds to the
 *       CURRENT `realpath(rootDir)`; with no approved-target agreement after
 *       approval, the bytes follow the swapped root OUTSIDE the anchor while
 *       the receipt still names the anchor locator.
 *
 * Each leg ASSERTS THE DEFECTIVE BEHAVIOR (that is the reproduction): a green
 * leg here means the old artifact did the wrong thing, verbatim.
 *
 * Real FS world under tests/homes/m2w-repro-* (TEST_METHODS §7): created
 * here, destroyed in teardown, nothing kept.
 *
 * @module packages/tools/a5p5-tools/test/a5m2-write-slice-defect-repro
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  createGovernedWriteExecutor as createPreFixGovernedWriteExecutor,
  type WriteSliceOutcome,
} from '../../../../dev/agent-workflow/evidence/alpha5/m2-write/repro/pre-fix-write-slice.js'
import {
  parseOperationGrant,
  parseRequestedEffectSet,
  type OperationGrant,
} from '../../../domain/tool-governance/src/index.js'
import { createAdmissionGatedControlledFs } from '../../../runtime/controlled-fs/src/index.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = realpathSync(resolve(HERE, '..', '..', '..', '..'))

const REALM = 'realm-m2w-repro'
const FS_ID = 'ctl'
const MEMBER_A = Object.freeze({ teamSessionId: 'ts-m2w', instanceId: 'member-victim' })
const MEMBER_B = Object.freeze({ teamSessionId: 'ts-m2w', instanceId: 'member-attacker' })
const FIXED_NOW = 1_700_000_000_000

function stamp(): string {
  return `${new Date().toISOString().slice(11, 19).replace(/:/g, '')}-${createHash('sha256').update(`${String(Date.now())}:${String(Math.random())}`).digest('hex').slice(0, 6)}`
}

let worldRoot: string
let ctrlD1: string
let ctrlD2: string
let rootD3: string
let outsideD3: string

beforeAll(() => {
  worldRoot = join(REPO_ROOT, 'tests', 'homes', `m2w-repro-${stamp()}`)
  ctrlD1 = join(worldRoot, 'd1', 'controlled')
  ctrlD2 = join(worldRoot, 'd2', 'controlled')
  rootD3 = join(worldRoot, 'd3', 'controlled')
  outsideD3 = join(worldRoot, 'd3', 'outside')
  mkdirSync(join(ctrlD1, 'notes'), { recursive: true })
  mkdirSync(ctrlD2, { recursive: true })
  mkdirSync(rootD3, { recursive: true })
  mkdirSync(outsideD3, { recursive: true })
  writeFileSync(join(outsideD3, 'victim.txt'), 'ORIGINAL-OUTSIDE-DATA\n')
})

afterAll(() => {
  rmSync(worldRoot, { recursive: true, force: true }) // TEST_METHODS §7 teardown, nothing kept
})

function writeEffectRaw(locator: string): unknown[] {
  return [
    { kind: 'tool-invoke', toolName: 'write', resource: null },
    { kind: 'write', resource: { realmId: REALM, kind: 'absolute-path', canonicalLocator: locator, rights: ['write'] } },
  ]
}

function mintGrant(locator: string, member: { teamSessionId: string; instanceId: string }, callId: string, seq: string): OperationGrant {
  const effects = parseRequestedEffectSet(writeEffectRaw(locator))
  if (!effects.ok) throw new Error(`fixture effects rejected: ${JSON.stringify(effects.problems).slice(0, 300)}`)
  const parsed = parseOperationGrant({
    grantId: `repro-grant-${seq}`,
    member,
    callId,
    realmId: REALM,
    bindingId: 'binding-1',
    bindingRevision: 1,
    authorityGeneration: 1,
    parametersFingerprint: effects.value.fingerprint,
    effects: effects.value,
    singleUse: true,
    issuedAt: FIXED_NOW,
    expiresAt: null,
  })
  if (!parsed.ok) throw new Error(`fixture grant rejected: ${JSON.stringify(parsed.problems).slice(0, 300)}`)
  return parsed.value
}

interface ReproHarness {
  readonly run: (args: unknown, call: { member: unknown; callId: string }) => Promise<WriteSliceOutcome>
  readonly paCalls: unknown[]
  readonly consumed: Set<string>
}

/** The OLD harness shape verbatim (frozen): effect-set fingerprint, no identity in the PA request. */
function makeOldHarness(rootDir: string, pa: (req: { realmId: string; callId: string; parametersFingerprint: string; requestedEffects: { effects: readonly { kind: string; resource: { canonicalLocator: string } | null }[] } }) => Promise<{ kind: 'allow'; grant: OperationGrant } | { kind: 'deny'; code: string }>): ReproHarness {
  const paCalls: unknown[] = []
  const consumed = new Set<string>()
  const executor = createPreFixGovernedWriteExecutor({
    parser: { parseRequestedEffectSet },
    gatedFs: { createAdmissionGatedControlledFs },
    realmId: REALM,
    fsId: FS_ID,
    rootDir,
    clock: () => FIXED_NOW,
    authorityGeneration: 1,
    consumed: (grantId: string) => consumed.has(grantId),
    policy: { default: 'allow' },
    decide: () => ({ kind: 'allow' as const }),
    pa: async (req) => {
      paCalls.push({ keys: Object.keys(req).sort(), ...req })
      return pa(req)
    },
    recheckPort: { recheckCall: async () => ({ ok: true as const }) },
    onWriteCommitted: (grant: unknown) => {
      consumed.add((grant as OperationGrant).grantId)
    },
  })
  return {
    run: (args, call) => executor.run(args, call),
    paCalls,
    consumed,
  }
}

function outcomeKind(r: WriteSliceOutcome): string {
  return r.kind
}

describe('a5m2 PRE-FIX defect reproduction (frozen old revision a852227c6)', () => {
  it('D1 reproduces cross member/call authorization: content-blind fingerprint + member never forwarded ⇒ one approval auto-approves ANY content, ANY callId, ANY member at the target', async () => {
    // The old default harness: PA approves a plan by its fingerprint and
    // mints the matching grant. With the effect-set fingerprint this
    // "approval" cannot tell WHAT content, WHICH call or WHICH member.
    const approvedFingerprints = new Set<string>()
    let seq = 0
    const h = makeOldHarness(ctrlD1, async (req) => {
      const locator = req.requestedEffects.effects.find((e) => e.kind === 'write')?.resource?.canonicalLocator ?? ''
      // a durable approval would be presented ONCE; the fingerprint is all
      // the plane saw, so every call carrying it is answered approved:
      approvedFingerprints.add(req.parametersFingerprint)
      seq += 1
      return { kind: 'allow', grant: mintGrant(locator, MEMBER_A, 'exec-victim', `d1-${String(seq)}`) }
    })
    const r1 = await h.run({ file_path: 'notes/target.txt', content: 'APPROVED-A\n' }, { member: MEMBER_A, callId: 'exec-victim' })
    expect(outcomeKind(r1)).toBe('written')
    // The SECOND call: DIFFERENT member, DIFFERENT callId, DIFFERENT content.
    const r2 = await h.run({ file_path: 'notes/target.txt', content: 'ATTACK-B\n' }, { member: MEMBER_B, callId: 'exec-attacker' })
    expect(outcomeKind(r2)).toBe('written')
    // VERBATIM REPRODUCTION:
    // (a) the attacker's bytes replaced the approved ones — the plan
    //     fingerprint never bound the content (A2C-5 requires distinct
    //     contents ⇒ distinct fingerprints; the effect-set fp is blind):
    expect(readFileSync(join(ctrlD1, 'notes', 'target.txt'), 'utf8')).toBe('ATTACK-B\n')
    // (b) both PA walks carried the IDENTICAL fingerprint — the second plan
    //     is a DIFFERENT write answered by the first approval:
    const first = h.paCalls[0] as { parametersFingerprint: string }
    const second = h.paCalls[1] as { parametersFingerprint: string }
    expect(second.parametersFingerprint).toBe(first.parametersFingerprint)
    // (c) the PA request never carried the member (nor the binding): cross
    //     member calls are LITERALLY indistinguishable at the edge —
    //     `call.member` was accepted and never used:
    expect((h.paCalls[0] as { keys: string[] }).keys).toEqual(['callId', 'parametersFingerprint', 'realmId', 'requestedEffects'])
    // (d) one target ⇒ one approved fingerprint for TWO distinct writes:
    expect(approvedFingerprints.size).toBe(1)
  })

  it('D2 reproduces concurrent two writes on ONE grant: consumption recorded AFTER success races the view — both calls open, both write, one grant', async () => {
    // A durable approval answered once: the SAME grant object backs both
    // concurrent calls (exactly the shape the approval plane replays).
    const shared = mintGrant(join(ctrlD2, 'raced.txt'), MEMBER_A, 'exec-shared', 'd2')
    const h = makeOldHarness(ctrlD2, async () => ({ kind: 'allow', grant: shared }))
    // Deterministic race: the exec-time port parks BOTH calls inside
    // writeText (before the open) until BOTH have arrived — the first write
    // has therefore not committed (it stands parked at the port), so the
    // second deterministically sees `consumed = false` in the old law.
    let parked = 0
    let releasePark!: () => void
    const park = new Promise<void>((res) => { releasePark = res })
    const executor = createPreFixGovernedWriteExecutor({
      parser: { parseRequestedEffectSet },
      gatedFs: { createAdmissionGatedControlledFs },
      realmId: REALM,
      fsId: FS_ID,
      rootDir: ctrlD2,
      clock: () => FIXED_NOW,
      authorityGeneration: 1,
      consumed: (grantId: string) => h.consumed.has(grantId),
      policy: { default: 'allow' },
      decide: () => ({ kind: 'allow' as const }),
      pa: async () => ({ kind: 'allow', grant: shared }),
      recheckPort: {
        recheckCall: async () => {
          parked += 1
          if (parked === 2) releasePark()
          await park
          return { ok: true as const }
        },
      },
      onWriteCommitted: (grant: unknown) => {
        h.consumed.add((grant as OperationGrant).grantId)
      },
    })
    const [r1, r2] = await Promise.all([
      executor.run({ file_path: 'raced.txt', content: 'FIRST-WRITER\n' }, { member: MEMBER_A, callId: 'exec-c1' }),
      executor.run({ file_path: 'raced.txt', content: 'SECOND-WRITER\n' }, { member: MEMBER_A, callId: 'exec-c2' }),
    ])
    // VERBATIM REPRODUCTION: ONE single-use grant, TWO successful writes.
    expect(outcomeKind(r1)).toBe('written')
    expect(outcomeKind(r2)).toBe('written')
    // The first writer's bytes are silently gone — last writer wins, no
    // refusal, no staleness fact anywhere:
    expect(readFileSync(join(ctrlD2, 'raced.txt'), 'utf8')).toBe('SECOND-WRITER\n')
    // …while the consumption fact recorded AFTER success knows ONE grant:
    expect(h.consumed.size).toBe(1)
    expect(h.consumed.has(shared.grantId)).toBe(true)
  })

  it('D3 reproduces root-swapped-to-symlink during the PA wait: bytes land OUTSIDE the approved anchor, receipt still names the anchor locator', async () => {
    // The attack window: PA is awaited with a PENDING request; while it
    // waits, the governed root itself is replaced by a symlink to the
    // outside directory (which holds a victim file).
    let release!: () => void
    const gate = new Promise<void>((res) => { release = res })
    const paCalls: unknown[] = []
    const executor = createPreFixGovernedWriteExecutor({
      parser: { parseRequestedEffectSet },
      gatedFs: { createAdmissionGatedControlledFs },
      realmId: REALM,
      fsId: FS_ID,
      rootDir: rootD3,
      clock: () => FIXED_NOW,
      authorityGeneration: 1,
      consumed: () => false,
      policy: { default: 'allow' },
      decide: () => ({ kind: 'allow' as const }),
      pa: async (req) => {
        paCalls.push(req)
        await gate // the human is still deciding…
        return { kind: 'allow', grant: mintGrant(join(rootD3, 'victim.txt'), MEMBER_A, 'exec-d3', 'd3') }
      },
      recheckPort: { recheckCall: async () => ({ ok: true as const }) },
    })
    const pending = executor.run({ file_path: 'victim.txt', content: 'OUTSIDE-OVERWRITE\n' }, { member: MEMBER_A, callId: 'exec-d3' })
    // wait until the walk is parked inside PA
    for (let i = 0; i < 100 && paCalls.length === 0; i += 1) await Promise.resolve()
    expect(paCalls).toHaveLength(1)
    // …the swap: the approved root R becomes a symlink to the outside dir O.
    rmSync(rootD3, { recursive: true, force: true })
    symlinkSync(outsideD3, rootD3)
    release()
    const r = await pending
    // VERBATIM REPRODUCTION: the old face reports success…
    expect(outcomeKind(r)).toBe('written')
    // …the receipt names the ANCHOR locator…
    expect((r as { canonicalLocator: string }).canonicalLocator).toBe(join(rootD3, 'victim.txt'))
    // …but the BYTES landed in the outside directory: the victim file is
    // overwritten OUTSIDE the governed anchor.
    expect(readFileSync(join(outsideD3, 'victim.txt'), 'utf8')).toBe('OUTSIDE-OVERWRITE\n')
    // cleanup: restore a real dir so teardown stays simple
    unlinkSync(rootD3)
    mkdirSync(rootD3, { recursive: true })
  })
})
