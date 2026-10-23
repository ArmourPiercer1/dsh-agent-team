/**
 * a5m2-write-slice — M2-WRITE-01 C1: the governed WRITE face's positive and
 * negative controls at FIXTURE level (the INTERFACES integration rule: the
 * claim is "verified against the fixture", never "the whole chain"; the plane
 * write-takeover row does not exist yet — the C2 proposal carries it, and the
 * Host leg belongs to the single Host owner, serially).
 *
 * Positive controls (C1 "governed write lands on an allowed path, result
 * assertable"):
 *   P1 create      — bytes land, receipt carries locator + fingerprint, the
 *                    gated lane's ledger shows open-issued + fd-closed, and
 *                    the exec-time port saw exactly the BOUND fingerprint.
 *   P2 empty-write — empty `content` is legitimate (host write.ts:20-26).
 *   P3 overwrite   — NEW bytes on disk; the OLD content appears NOWHERE in
 *                    the outcome (the M-02 receipt law; the pinned host
 *                    tool echoes `before`/`after` at write.ts:80-105 — this
 *                    governed face states the diff-suppressed variant
 *                    instead of faking the native echo).
 *
 * Negative controls (typed refusal + zero leak + zero write):
 *   N1-N3 schema lane — blank path / non-string content / escalation fields
 *                       (the host sandbox pair has no governed lane here).
 *   N4-N5 escape      — lexical `..` and absolute-outside are refused BEFORE
 *                       admission: ZERO PA walk, zero fs access, the outside
 *                       secret never appears in the refusal text.
 *   N6-N9 admission   — lane deny / default-deny / PA deny / PA PENDING
 *                       (pending is a denial with its own code, never an
 *                       allow — the card's honesty law).
 *   N10-N15 fs edge   — effect outside the grant, one-shot consumption,
 *                       symlink alias, hidden-write (never silent), the
 *                       exec-time port refusing, and a grant whose
 *                       fingerprint diverges from the bound one (the port is
 *                       never consulted for it).
 *
 * Real FS world under tests/homes/m2w-* (TEST_METHODS §7): created here,
 * destroyed in teardown, nothing kept.
 *
 * @module packages/tools/a5p5-tools/test/a5m2-write-slice
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  createGovernedWriteExecutor,
  lexicalWriteAnchor,
  parseWriteSliceArgs,
  type SlicePaVerdict,
  type SlicePolicyView,
  type WriteSliceOutcome,
} from '../src/write-slice.js'
import {
  parseOperationGrant,
  parseRequestedEffectSet,
  type OperationGrant,
} from '../../../domain/tool-governance/src/index.js'
import { createAdmissionGatedControlledFs } from '../../../runtime/controlled-fs/src/index.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = realpathSync(resolve(HERE, '..', '..', '..', '..'))

const REALM = 'realm-m2w'
const FS_ID = 'ctl'
const MEM = Object.freeze({ teamSessionId: 'ts-m2w', instanceId: 'member-write' })
const FIXED_NOW = 1_700_000_000_000

function sha(text: string): string {
  return `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`
}

function stamp(): string {
  const iso = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  return `${iso}Z-${createHash('sha256').update(`${Date.now()}:${Math.random()}`).digest('hex').slice(0, 6)}`
}

interface World {
  readonly world: string
  readonly ctrl: string
  readonly outside: string
}

let world: World

beforeAll(() => {
  const root = join(REPO_ROOT, 'tests', 'homes', `m2w-${stamp()}`)
  const ctrl = join(root, 'controlled')
  mkdirSync(join(ctrl, 'notes'), { recursive: true })
  mkdirSync(join(ctrl, 'vault'), { recursive: true })
  mkdirSync(join(root, 'outside'), { recursive: true })
  writeFileSync(join(ctrl, 'old.txt'), 'OLD-SECRET-CONTENT\n')
  writeFileSync(join(root, 'outside', 'secret.txt'), 'OUTSIDE-SECRET\n')
  symlinkSync(join('..', 'outside', 'secret.txt'), join(ctrl, 'link.txt'))
  if (realpathSync(ctrl) !== ctrl) throw new Error(`fixture anchor not canonical: ${ctrl}`)
  world = { world: root, ctrl, outside: join(root, 'outside') }
})

afterAll(() => {
  rmSync(world.world, { recursive: true, force: true }) // TEST_METHODS §7 teardown, nothing kept
})

// ---------------------------------------------------------------------------
// Fixture-grade PA / grant / port builders (built through the frozen parsers —
// invalid fixture data cannot enter a test by construction).
// ---------------------------------------------------------------------------

let grantSeq = 0

function writeEffectRaw(locator: string, rights: readonly string[] = ['write']): unknown[] {
  // the SAME closed grammar the slice canonicalizes (tool-invoke + write):
  // the canonical fingerprint of a fixture grant is only comparable to the
  // slice's bound fingerprint when both walk carry the identical effect pair.
  return [
    { kind: 'tool-invoke', toolName: 'write', resource: null },
    { kind: 'write', resource: { realmId: REALM, kind: 'absolute-path', canonicalLocator: locator, rights } },
  ]
}

function mintGrant(effectsRaw: unknown[], parametersFingerprint?: string): OperationGrant {
  grantSeq += 1
  const effects = parseRequestedEffectSet(effectsRaw)
  if (!effects.ok) throw new Error(`fixture effects rejected: ${JSON.stringify(effects.problems).slice(0, 300)}`)
  const parsed = parseOperationGrant({
    grantId: `m2w-grant-${String(grantSeq)}`,
    member: MEM,
    callId: `m2w-call-${String(grantSeq)}`,
    realmId: REALM,
    bindingId: 'binding-1',
    bindingRevision: 1,
    authorityGeneration: 1,
    parametersFingerprint: parametersFingerprint ?? effects.value.fingerprint,
    effects: effects.value,
    singleUse: true,
    issuedAt: FIXED_NOW,
    expiresAt: null,
  })
  if (!parsed.ok) throw new Error(`fixture grant rejected: ${JSON.stringify(parsed.problems).slice(0, 300)}`)
  return parsed.value
}

interface PortCall {
  readonly op: string
  readonly canonicalLocator: string
  readonly parametersFingerprint: string
}

interface SliceHarness {
  readonly run: (args: unknown, callId: string) => Promise<WriteSliceOutcome>
  readonly paCalls: unknown[]
  readonly portCalls: PortCall[]
  readonly observeLines: string[]
  readonly consumed: Set<string>
}

function makeHarness(opts: {
  readonly paScript?: readonly SlicePaVerdict[]
  readonly decide?: () => { kind: 'allow' } | { kind: 'deny'; code: string }
  readonly policy?: SlicePolicyView
  readonly portVerdict?: { ok: true } | { ok: false; reason: string }
  readonly visibility?: (member: unknown, desc: { fs: string; path: string }) => 'visible' | 'hidden'
} = {}): SliceHarness {
  const paCalls: unknown[] = []
  const portCalls: PortCall[] = []
  const observeLines: string[] = []
  const consumed = new Set<string>()
  const script = [...(opts.paScript ?? [])]
  const executor = createGovernedWriteExecutor({
    // The frozen parser face and the admission-GATED C-FS factory, injected
    // (the slice itself imports neither — see the write-slice header).
    parser: { parseRequestedEffectSet },
    gatedFs: { createAdmissionGatedControlledFs },
    realmId: REALM,
    fsId: FS_ID,
    rootDir: world.ctrl,
    clock: () => FIXED_NOW,
    authorityGeneration: 1,
    consumed: (grantId: string) => consumed.has(grantId),
    policy: opts.policy ?? { default: 'allow' },
    decide: opts.decide ?? (() => ({ kind: 'allow' as const })),
    pa: async (req) => {
      paCalls.push(req)
      if (script.length > 0) return script.shift() as SlicePaVerdict
      // default: allow with a fresh grant covering EXACTLY the requested
      // write resource (fixture-grade stand-in for the PA mint+consume edge).
      const writeEffect = req.requestedEffects.effects.find((e) => e.kind === 'write')
      const locator = writeEffect?.resource?.canonicalLocator ?? ''
      return { kind: 'allow', grant: mintGrant(writeEffectRaw(locator)) }
    },
    recheckPort: {
      recheckCall: async (intent) => {
        portCalls.push(intent)
        return opts.portVerdict ?? { ok: true as const }
      },
    },
    ...(opts.visibility === undefined ? {} : { visibility: opts.visibility }),
    observe: (line: string) => { observeLines.push(line) },
    // the assembly's landing edge for the one-shot fact (fixture-graded: the
    // durable PR2 ledger is not assembled here — disclosed in the spec header).
    onWriteCommitted: (grant: unknown) => {
      const id = (grant as OperationGrant).grantId
      consumed.add(id)
    },
  })
  return {
    run: (args, callId) => executor.run(args, { member: MEM, callId }),
    paCalls,
    portCalls,
    observeLines,
    consumed,
  }
}

function expectWritten(r: WriteSliceOutcome): { canonicalLocator: string; writtenFingerprint: string; laneLedger: readonly unknown[] } {
  if (r.kind !== 'written') throw new Error(`expected a written outcome, got: ${JSON.stringify(r).slice(0, 400)}`)
  return r
}

function expectRefused(r: WriteSliceOutcome): { refusalClass: string; code: string; text: string; cfClass?: string; cfReason?: string } {
  if (r.kind !== 'refused') throw new Error(`expected a typed refusal, got: ${JSON.stringify(r).slice(0, 400)}`)
  return r
}

// ---------------------------------------------------------------------------
// Pure units (host value law + lexical law)
// ---------------------------------------------------------------------------

describe('a5m2 write-slice pure law', () => {
  it('mirrors the host value law: blank file_path refused, empty content legitimate', () => {
    expect(parseWriteSliceArgs({ file_path: '   ', content: 'x' })).toMatchObject({ ok: false, code: 'write-args-file-path-blank' })
    expect(parseWriteSliceArgs({ file_path: 'a.txt', content: 7 })).toMatchObject({ ok: false, code: 'write-args-content-not-string' })
    expect(parseWriteSliceArgs({ file_path: 'a.txt', content: '' })).toEqual({ ok: true, filePath: 'a.txt', content: '' })
  })
  it('lexical anchor accepts in-root spellings and refuses lexical escapes with zero fs access', () => {
    expect(lexicalWriteAnchor(world.ctrl, 'notes/x.txt')).toEqual({ ok: true, path: join(world.ctrl, 'notes/x.txt') })
    expect(lexicalWriteAnchor(world.ctrl, join(world.ctrl, 'notes/x.txt'))).toEqual({ ok: true, path: join(world.ctrl, 'notes/x.txt') })
    expect(lexicalWriteAnchor(world.ctrl, '../outside/x.txt')).toMatchObject({ ok: false, code: 'locator-rejected' })
    expect(lexicalWriteAnchor(world.ctrl, '/etc/passwd')).toMatchObject({ ok: false, code: 'locator-rejected' })
  })
})

// ---------------------------------------------------------------------------
// P — positive controls
// ---------------------------------------------------------------------------

describe('a5m2 write-slice C1 positive', () => {
  it('P1 creates through the governed face: bytes land, receipt + ledger + bound fingerprint', async () => {
    const h = makeHarness()
    const r = expectWritten(await h.run({ file_path: 'notes/hello.txt', content: 'GOVERNED-BYTES\n' }, 'exec-p1'))
    const target = join(world.ctrl, 'notes', 'hello.txt')
    expect(r.canonicalLocator).toBe(target)
    expect(r.writtenFingerprint).toBe(sha('GOVERNED-BYTES\n'))
    expect(readFileSync(target, 'utf8')).toBe('GOVERNED-BYTES\n')
    // one PA walk, asked with the canonical fingerprint; the exec-time port
    // was consulted EXACTLY once and with the BOUND fingerprint.
    expect(h.paCalls).toHaveLength(1)
    expect(h.portCalls).toHaveLength(1)
    expect(h.portCalls[0]?.op).toBe('writeText')
    expect(h.portCalls[0]?.canonicalLocator).toBe(target)
    const asked = h.paCalls[0] as { parametersFingerprint: string }
    expect(h.portCalls[0]?.parametersFingerprint).toBe(asked.parametersFingerprint)
    // the lane ledger tells the truth about the one open (checks-before-open,
    // no standing fd).
    const stages = (r.laneLedger as { op: string; stage: string }[]).map((e) => `${e.op}:${e.stage}`)
    expect(stages).toContain('writeText:open-issued')
    expect(stages).toContain('writeText:fd-closed')
    expect(stages.some((s) => s.startsWith('writeText:refused'))).toBe(false)
  })

  it('P2 empty content writes an empty file (host value law)', async () => {
    const h = makeHarness()
    const r = expectWritten(await h.run({ file_path: 'notes/empty.txt', content: '' }, 'exec-p2'))
    expect(r.writtenFingerprint).toBe(sha(''))
    expect(readFileSync(join(world.ctrl, 'notes', 'empty.txt'), 'utf8')).toBe('')
  })

  it('P3 overwrite: new bytes land and the OLD content never comes back (M-02; the diff-suppressed variant is the STATED face)', async () => {
    const h = makeHarness()
    const r = expectWritten(await h.run({ file_path: 'old.txt', content: 'FRESH-BYTES\n' }, 'exec-p3'))
    expect(readFileSync(join(world.ctrl, 'old.txt'), 'utf8')).toBe('FRESH-BYTES\n')
    expect(r.writtenFingerprint).toBe(sha('FRESH-BYTES\n'))
    // zero echo: the old bytes appear NOWHERE in the outcome (the pinned host
    // tool would carry `before`; this governed face carries NO before field).
    expect(JSON.stringify(r)).not.toContain('OLD-SECRET-CONTENT')
    expect('before' in r).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// N — negative controls (typed refusal, zero write, zero leak)
// ---------------------------------------------------------------------------

describe('a5m2 write-slice C1 negative', () => {
  it('N1 blank file_path refuses before admission with zero PA walk', async () => {
    const h = makeHarness()
    const r = expectRefused(await h.run({ file_path: '  ', content: 'x' }, 'exec-n1'))
    expect(r.refusalClass).toBe('schema')
    expect(r.code).toBe('write-args-file-path-blank')
    expect(h.paCalls).toHaveLength(0)
  })

  it('N2 non-string content refuses schema-typed', async () => {
    const h = makeHarness()
    const r = expectRefused(await h.run({ file_path: 'notes/n2.txt', content: 7 }, 'exec-n2'))
    expect(r.refusalClass).toBe('schema')
    expect(r.code).toBe('write-args-content-not-string')
    expect(existsSync(join(world.ctrl, 'notes', 'n2.txt'))).toBe(false)
  })

  it('N3 the host escalation pair has no governed lane: refused, never silently dropped', async () => {
    const h = makeHarness()
    const r = expectRefused(await h.run(
      { file_path: 'notes/n3.txt', content: 'x', sandbox_permissions: 'workspace-write', justification: 'escape hatch' },
      'exec-n3',
    ))
    expect(r.refusalClass).toBe('schema')
    expect(r.code).toBe('write-escalation-ungoverned')
    expect(h.paCalls).toHaveLength(0)
    expect(existsSync(join(world.ctrl, 'notes', 'n3.txt'))).toBe(false)
  })

  it('N4 lexical escape refused BEFORE admission: zero PA walk, the outside secret never leaks', async () => {
    const h = makeHarness()
    const r = expectRefused(await h.run({ file_path: '../outside/evil.txt', content: 'EVIL\n' }, 'exec-n4'))
    expect(r.refusalClass).toBe('schema')
    expect(r.code).toBe('locator-rejected')
    expect(h.paCalls).toHaveLength(0)
    expect(h.portCalls).toHaveLength(0)
    expect(existsSync(join(world.outside, 'evil.txt'))).toBe(false)
    expect(r.text).not.toContain('OUTSIDE-SECRET')
  })

  it('N5 absolute-outside refused; the outside file keeps its exact bytes', async () => {
    const h = makeHarness()
    const secret = join(world.outside, 'secret.txt')
    const r = expectRefused(await h.run({ file_path: secret, content: 'OVERRIDE\n' }, 'exec-n5'))
    expect(r.code).toBe('locator-rejected')
    expect(h.paCalls).toHaveLength(0)
    expect(readFileSync(secret, 'utf8')).toBe('OUTSIDE-SECRET\n')
    expect(r.text).not.toContain('OUTSIDE-SECRET')
  })

  it('N6 template-lane deny refuses at admission, file absent', async () => {
    const h = makeHarness({ decide: () => ({ kind: 'deny', code: 'template-lane-deny' }) })
    const r = expectRefused(await h.run({ file_path: 'notes/n6.txt', content: 'x' }, 'exec-n6'))
    expect(r.refusalClass).toBe('admission')
    expect(r.code).toBe('template-lane-deny')
    expect(existsSync(join(world.ctrl, 'notes', 'n6.txt'))).toBe(false)
  })

  it('N7 deny-default without a covering rule refuses; the same call WITH an exact allow rule writes', async () => {
    const denied = makeHarness({ policy: { default: 'deny' } })
    const r = expectRefused(await denied.run({ file_path: 'notes/n7.txt', content: 'x' }, 'exec-n7'))
    expect(r.code).toBe('template-default-deny')
    expect(existsSync(join(world.ctrl, 'notes', 'n7.txt'))).toBe(false)
    const allowed = makeHarness({
      policy: {
        default: 'deny',
        allow: [{ tool: 'write', resource: { kind: 'exact', path: join(world.ctrl, 'notes', 'n7.txt') } }],
      },
    })
    expectWritten(await allowed.run({ file_path: 'notes/n7.txt', content: 'RULED\n' }, 'exec-n7b'))
    expect(readFileSync(join(world.ctrl, 'notes', 'n7.txt'), 'utf8')).toBe('RULED\n')
  })

  it('N8 PA deny refuses with the PA code verbatim, file absent', async () => {
    const h = makeHarness({ paScript: [{ kind: 'deny', code: 'ASK_DENIED', detail: 'the approver said no' }] })
    const r = expectRefused(await h.run({ file_path: 'notes/n8.txt', content: 'x' }, 'exec-n8'))
    expect(r.refusalClass).toBe('admission')
    expect(r.code).toBe('ASK_DENIED')
    expect(existsSync(join(world.ctrl, 'notes', 'n8.txt'))).toBe(false)
  })

  it('N9 PA PENDING is a denial with its own code — NEVER an allow — file absent', async () => {
    const h = makeHarness({ paScript: [{ kind: 'pending', detail: 'awaiting durable control' }] })
    const r = expectRefused(await h.run({ file_path: 'notes/n9.txt', content: 'x' }, 'exec-n9'))
    expect(r.refusalClass).toBe('admission')
    expect(r.code).toBe('PA_PENDING_NOT_ALLOW')
    expect(existsSync(join(world.ctrl, 'notes', 'n9.txt'))).toBe(false)
  })

  it('N10 a grant that does not cover the target refuses at the fs edge (typed denied, zero write, zero leak)', async () => {
    const wrongGrant = mintGrant(writeEffectRaw(join(world.ctrl, 'notes', 'somewhere-else.txt')))
    const h = makeHarness({ paScript: [{ kind: 'allow', grant: wrongGrant }] })
    const r = expectRefused(await h.run({ file_path: 'notes/n10.txt', content: 'x' }, 'exec-n10'))
    expect(r.refusalClass).toBe('fs')
    expect(r.code).toBe('TOOL_BINDING_UNVERIFIED')
    expect(r.cfClass).toBe('denied')
    expect(r.cfReason).toBe('effect-outside-grant')
    expect(existsSync(join(world.ctrl, 'notes', 'n10.txt'))).toBe(false)
    expect(JSON.stringify(r)).not.toContain('OLD-SECRET-CONTENT')
  })

  it('N11 one-shot: the SECOND call over the same grant is refused grant-consumed (APPROVAL_STALE)', async () => {
    const oneGrant = mintGrant(writeEffectRaw(join(world.ctrl, 'notes', 'one-shot.txt')))
    const h = makeHarness({ paScript: [{ kind: 'allow', grant: oneGrant }, { kind: 'allow', grant: oneGrant }] })
    expectWritten(await h.run({ file_path: 'notes/one-shot.txt', content: 'FIRST\n' }, 'exec-n11a'))
    expect(readFileSync(join(world.ctrl, 'notes', 'one-shot.txt'), 'utf8')).toBe('FIRST\n')
    const second = expectRefused(await h.run({ file_path: 'notes/one-shot.txt', content: 'SECOND\n' }, 'exec-n11b'))
    expect(second.refusalClass).toBe('fs')
    expect(second.code).toBe('APPROVAL_STALE')
    expect(second.cfReason).toBe('grant-consumed')
    // the refusal changed nothing: the file still carries exactly the FIRST bytes.
    expect(readFileSync(join(world.ctrl, 'notes', 'one-shot.txt'), 'utf8')).toBe('FIRST\n')
  })

  it('N12 symlink alias refuses before any open; the alias TARGET keeps its bytes', async () => {
    const h = makeHarness()
    const r = expectRefused(await h.run({ file_path: 'link.txt', content: 'THROUGH\n' }, 'exec-n12'))
    expect(r.refusalClass).toBe('fs')
    expect(r.code).toBe('TOOL_BINDING_UNVERIFIED')
    expect(r.cfClass).toBe('denied')
    expect(r.cfReason).toBe('symlink-alias')
    expect(readFileSync(join(world.outside, 'secret.txt'), 'utf8')).toBe('OUTSIDE-SECRET\n')
    expect(r.text).not.toContain('OUTSIDE-SECRET')
  })

  it('N13 hidden-write is a TYPED loud refusal with a diagnostic (never silent); no object appears', async () => {
    const h = makeHarness({
      visibility: (_member, desc) => (desc.path === 'vault/lease.txt' ? 'hidden' : 'visible'),
    })
    const r = expectRefused(await h.run({ file_path: 'vault/lease.txt', content: 'x' }, 'exec-n13'))
    expect(r.refusalClass).toBe('fs')
    expect(r.cfClass).toBe('hidden')
    expect(r.cfReason).toBe('hidden-write')
    expect(r.text).toContain('WITHHELD')
    expect(existsSync(join(world.ctrl, 'vault', 'lease.txt'))).toBe(false)
  })

  it('N14 the exec-time port refusing is a typed refusal BEFORE the open; zero bytes', async () => {
    const h = makeHarness({ portVerdict: { ok: false, reason: 'fixture-port-denies' } })
    const r = expectRefused(await h.run({ file_path: 'notes/n14.txt', content: 'x' }, 'exec-n14'))
    expect(r.refusalClass).toBe('fs')
    expect(r.cfReason).toBe('effect-outside-grant')
    expect(r.text).toContain('recheck refused')
    expect(h.portCalls).toHaveLength(1)
    expect(existsSync(join(world.ctrl, 'notes', 'n14.txt'))).toBe(false)
  })

  it('N15 a grant whose fingerprint diverges from the BOUND one never reaches the port (fingerprint binding, law 2)', async () => {
    const diverged = mintGrant(writeEffectRaw(join(world.ctrl, 'notes', 'n15.txt')), sha('this-is-not-the-bound-request'))
    const h = makeHarness({ paScript: [{ kind: 'allow', grant: diverged }] })
    const r = expectRefused(await h.run({ file_path: 'notes/n15.txt', content: 'x' }, 'exec-n15'))
    expect(r.refusalClass).toBe('fs')
    expect(r.code).toBe('TOOL_BINDING_UNVERIFIED')
    expect(r.text).toContain('fingerprint-divergence')
    expect(h.portCalls).toHaveLength(0)
    expect(existsSync(join(world.ctrl, 'notes', 'n15.txt'))).toBe(false)
  })
})
