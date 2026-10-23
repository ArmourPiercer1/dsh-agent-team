/**
 * a5m2-write-slice — M2-WRITE-01 C1 (FIX ROUND 1, root security ruling
 * 07:13): the governed WRITE face's controls run against REAL parts —
 * no stub fingerprint, no stub consumption, no stub policy:
 *
 *   REAL CENTER CONSUMPTION — every PA walk rides the REAL
 *   `createProductionAdmissionAssembly` (real derivation → real kernel →
 *   real one-shot grant ledger). The ONE consumption point is the gated
 *   lane's exec-time recheck through `createFsAdmissionPort` (the kernel's
 *   one-shot `consumeForExecution`); `consumedCount()` from the REAL ledger
 *   is the assertion instrument. `onWriteCommitted` only RECORDS facts.
 *   REAL PLAN FREEZE — the canonical fingerprint comes from the pinned
 *   `canonicalizeOperation` (M1-verified: the write projection binds the
 *   CONTENT digest; A2C-5: distinct contents ⇒ distinct fingerprints).
 *   LAWFUL POLICY GRAMMAR — every assembly is built with `default: ask |
 *   deny` plus explicit rules. A default-allow stub is REJECTED by the
 *   blueprint grammar itself ("no silent privilege expansion") and is
 *   banned by the ruling.
 *
 * The three reproduced defects (reproduced VERBATIM against the frozen old
 * revision in `a5m2-write-slice-defect-repro.test.ts`) each get an AFTER
 * leg here: ① cross member/call ⇒ `admission-identity-mismatch:*`
 * (N12/N13) ② concurrent same-grant two writes ⇒ single-flight + kernel
 * one-shot (N7/N14) ③ root swapped during the PA wait ⇒ ANCHOR-DRIFT
 * (N20/N21).
 *
 * The six C1 leg classes the ruling requires: content-change (P2/N13),
 * cross member-call (P4/N12), concurrent token-or-grant (N7/N14),
 * cancel-during-wait (N8), real center consumption (P1 + the ledger counts
 * on every refusal leg), root AND ancestor drift (N20/N21).
 *
 * Real FS world under tests/homes/m2w-fix-* (TEST_METHODS §7): created
 * here, destroyed in teardown, nothing kept.
 *
 * @module packages/tools/a5p5-tools/test/a5m2-write-slice
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  createGovernedWriteExecutor,
  lexicalWriteAnchor,
  mapLaneError,
  parseWriteSliceArgs,
  type GovernedWriteCall,
  type SliceCanonicalize,
  type SliceGatedWriteResult,
  type SlicePaRequest,
  type SlicePaVerdict,
  type SlicePolicyView,
  type WriteSliceOutcome,
} from '../src/write-slice.js'
import {
  parseRequestedEffectSet,
  type AdmissionRequest,
  type OperationGrant,
  type RequestedEffectSet,
} from '../../../domain/tool-governance/src/index.js'
import type { TemplatePermissionPolicy } from '../../../domain/blueprint/src/types.js'
import { createAdmissionGatedControlledFs } from '../../../runtime/controlled-fs/src/index.js'
import { createGrantLedger, createProductionAdmissionAssembly } from '../../../runtime/tool-admission/index.js'
import { canonicalizeOperation } from '../../../runtime/operation-permission/canonical-operation.js'
import { binding, MEMBER } from '../../../runtime/test/a5p2-fixtures.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = realpathSync(resolve(HERE, '..', '..', '..', '..'))

const REALM = 'realm-m2w-fix'
const FS_ID = 'ctl'
const FIXED_NOW = 1_700_000_000_000
const MEMBER_B = Object.freeze({ teamSessionId: MEMBER.teamSessionId, instanceId: 'member-b' })

// The REAL binding fact (the M1 installed-seam product; the definition and
// provider identities ride along — the slice binds them at the identity
// seam and the kernel re-checks them at consumption).
const BIND = binding({ toolName: 'write', definitionIdentity: 'def:write', providerId: 'team-adapter' })
const BIND_FACTS = Object.freeze({
  bindingId: BIND.bindingId,
  revision: BIND.revision,
  definitionIdentity: BIND.definitionIdentity,
  providerId: BIND.providerId,
})

// Lawful grammar ONLY: default ask | deny + explicit rules. The blueprint
// grammar rejects default-allow ("no silent privilege expansion") — there
// is no allow-stub to fall back to. The file class projects only exact /
// subtree resource rules (a whole-tool 'any' allow over a file tool keeps
// ONLY the tool-invoke arm — resource effects fall to no-authority ⇒ Ask,
// "TIGHTER than declared, disclosed never silent"); so every governed
// target rides its OWN exact rule, like every passing kernel test before.
const DENY_EVERYTHING: TemplatePermissionPolicy = { default: 'deny', allow: [], ask: [], deny: [] }
const ASK_EVERYTHING: TemplatePermissionPolicy = { default: 'ask', allow: [], ask: [], deny: [] }
const SLICE_POLICY: SlicePolicyView = { default: 'deny', allow: [{ tool: 'write', resource: { kind: 'any' } }] }

function allowWrite(...paths: string[]): TemplatePermissionPolicy {
  return {
    default: 'deny',
    allow: paths.map((path) => ({ tool: 'write', resource: { kind: 'exact', path } })),
    ask: [],
    deny: [],
  }
}

function sha(text: string): string {
  return `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`
}

let worldRoot: string

beforeAll(() => {
  const iso = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  worldRoot = join(REPO_ROOT, 'tests', 'homes', `m2w-fix-${iso}-${createHash('sha256').update(`${String(Date.now())}:${String(Math.random())}`).digest('hex').slice(0, 6)}`)
  mkdirSync(worldRoot, { recursive: true })
})

afterAll(() => {
  rmSync(worldRoot, { recursive: true, force: true }) // TEST_METHODS §7 teardown, nothing kept
})

/** One isolated world: `root` (the governed anchor) + `outside` (the secret). */
function mkWorld(name: string, opts: { nested?: boolean } = {}): { root: string; outside: string } {
  const base = join(worldRoot, name)
  const root = opts.nested ? join(base, 'base', 'controlled') : join(base, 'controlled')
  const outside = join(base, 'outside')
  mkdirSync(root, { recursive: true })
  mkdirSync(join(root, 'notes'), { recursive: true })
  mkdirSync(join(root, 'vault'), { recursive: true })
  mkdirSync(outside, { recursive: true })
  writeFileSync(join(root, 'old.txt'), 'OLD-SECRET-CONTENT\n')
  writeFileSync(join(outside, 'secret.txt'), 'OUTSIDE-SECRET\n')
  symlinkSync(join('..', 'outside', 'secret.txt'), join(root, 'link.txt'))
  if (realpathSync(root) !== root) throw new Error(`fixture anchor not canonical: ${root}`)
  return { root, outside }
}

function writeEffectRaw(locator: string): unknown[] {
  return [
    { kind: 'tool-invoke', toolName: 'write', resource: null },
    { kind: 'write', resource: { realmId: REALM, kind: 'absolute-path', canonicalLocator: locator, rights: ['write'] } },
  ]
}

function parseEffects(locator: string): RequestedEffectSet {
  const effects = parseRequestedEffectSet(writeEffectRaw(locator))
  if (!effects.ok) throw new Error(`fixture effects rejected: ${JSON.stringify(effects.problems).slice(0, 300)}`)
  return effects.value
}

interface ApprovedPair {
  readonly grant: OperationGrant
  readonly request: AdmissionRequest
}

interface FixHarness {
  readonly run: (args: unknown, over?: Partial<GovernedWriteCall>) => Promise<WriteSliceOutcome>
  readonly paCalls: SlicePaRequest[]
  readonly observeLines: string[]
  readonly committedFacts: unknown[]
  readonly consumedCount: () => number
  readonly lastPair: () => ApprovedPair
  readonly admitReal: (member: { teamSessionId: string; instanceId: string }, callId: string, locator: string, parametersFingerprint: string, effects: RequestedEffectSet) => Promise<ApprovedPair>
}

/**
 * The real-parts harness: REAL assembly (admission + one-shot ledger +
 * exec-time port), REAL canonicalizer, REAL gated C-FS lane.
 */
function makeHarness(world: { root: string }, opts: {
  readonly permissionPolicy?: TemplatePermissionPolicy
  /** explicit exact-rule allow targets for this leg (fail-closed when absent) */
  readonly allowPaths?: string[]
  readonly slicePolicy?: SlicePolicyView
  readonly scriptPa?: (req: SlicePaRequest) => SlicePaVerdict | Promise<SlicePaVerdict>
  /** When set, the REAL pa is parked on this gate (the wait window). */
  readonly gatePa?: Promise<void>
  readonly visibility?: (member: unknown, desc: { fs: string; path: string }) => 'visible' | 'hidden'
  /** false ⇒ NO exec-time port is bound (the honest default REFUSES). */
  readonly bindPort?: boolean
} = {}): FixHarness {
  const ledger = createGrantLedger()
  const built = createProductionAdmissionAssembly({
    permissionPolicy: opts.permissionPolicy ?? allowWrite(...(opts.allowPaths ?? [])),
    realmId: REALM,
    templateId: 'tpl-m2w-fix',
    definitionOwnerAuthority: 'human-user',
    role: 'member',
    clock: () => FIXED_NOW,
    authorityGeneration: () => 1,
    beneficiaryAuthority: 'member',
    ledger,
  })
  if (!built.ok) throw new Error(`REAL assembly refused the fixture policy (verbatim): ${JSON.stringify(built.error).slice(0, 400)}`)
  const assembly = built.value

  const paCalls: SlicePaRequest[] = []
  const observeLines: string[] = []
  const committedFacts: unknown[] = []
  let lastPair: ApprovedPair | null = null

  const admitReal = async (member: { teamSessionId: string; instanceId: string }, callId: string, locator: string, parametersFingerprint: string, effects: RequestedEffectSet): Promise<ApprovedPair> => {
    const request: AdmissionRequest = {
      binding: BIND,
      member,
      callId,
      realmId: REALM,
      parametersFingerprint,
      requestedEffects: effects,
    }
    const admitted = await assembly.admitCall(request)
    if (!admitted.ok) throw new Error(`admitCall refused (verbatim): ${JSON.stringify(admitted.error).slice(0, 300)}`)
    const decision = admitted.value
    if (decision.kind !== 'admitted') {
      throw new Error(`admitCall did not admit (verbatim): ${JSON.stringify(decision).slice(0, 300)}`)
    }
    const pair: ApprovedPair = { grant: decision.grant, request }
    lastPair = pair
    return pair
  }

  const realPa = async (req: SlicePaRequest): Promise<SlicePaVerdict> => {
    const request: AdmissionRequest = {
      binding: BIND,
      member: req.member,
      callId: req.callId,
      realmId: req.realmId,
      parametersFingerprint: req.parametersFingerprint,
      requestedEffects: req.requestedEffects as unknown as RequestedEffectSet,
    }
    const admitted = await assembly.admitCall(request)
    if (!admitted.ok) return { kind: 'deny', code: String(admitted.error.code), detail: admitted.error.message }
    const decision = admitted.value
    if (decision.kind === 'denied') return { kind: 'deny', code: decision.error.code, detail: decision.error.message }
    if (decision.kind === 'requires-approval') {
      // honest: no durable Control request is mounted in C1 — pending NEVER
      // runs here, and pending is never an allow.
      return { kind: 'deny', code: 'APPROVAL_REQUEST_UNAVAILABLE', detail: decision.reason }
    }
    // THE OPEN HALF: grant + the exact request it was minted for. Nothing
    // is consumed here (the ruling's sole consumption point is the lane).
    lastPair = { grant: decision.grant, request }
    return { kind: 'approved', grant: decision.grant, request }
  }

  const pa = async (req: SlicePaRequest): Promise<SlicePaVerdict> => {
    paCalls.push(req)
    if (opts.gatePa !== undefined) await opts.gatePa
    if (opts.scriptPa !== undefined) return opts.scriptPa(req)
    return realPa(req)
  }

  // THE REALITY ARMS — the M1 fact objects the ruling demands reusing:
  const canonicalize = canonicalizeOperation as unknown as SliceCanonicalize
  const resolveTarget = async (p: string): Promise<{ key: string; display: string }> => {
    const lex = lexicalWriteAnchor(world.root, p)
    if (!lex.ok) throw new Error(`target outside the governed root: ${lex.code}`)
    if (existsSync(lex.path)) {
      const real = realpathSync(lex.path)
      if (real !== world.root && !real.startsWith(`${world.root}/`)) throw new Error(`resolved identity escapes the governed root: ${real}`)
      return { key: real, display: lex.path }
    }
    return { key: `create:${lex.path}`, display: lex.path }
  }
  // THE DRIFT LAW (the read side's ANCHOR-DRIFT discipline, fixture-graded
  // with the same primitives: the root identity check covers the root AND
  // every ancestor; the approved-target agreement refuses aliases).
  // Production wires the read row's own resolver behind this same seam.
  const checkDrift = async (approvedLexical: string): Promise<{ ok: true } | { ok: false; code: string; detail: string }> => {
    let rootReal: string
    try {
      rootReal = realpathSync(world.root)
    } catch {
      return { ok: false, code: 'ANCHOR-DRIFT', detail: 'the governed root vanished between approval and execution' }
    }
    if (rootReal !== world.root) {
      return { ok: false, code: 'ANCHOR-DRIFT', detail: `the governed root (or an ancestor) no longer resolves in place: ${rootReal}` }
    }
    if (existsSync(approvedLexical)) {
      const real = realpathSync(approvedLexical)
      if (real !== approvedLexical) {
        return { ok: false, code: 'ANCHOR-DRIFT', detail: `the approved target now resolves through an alias: ${real}` }
      }
    }
    return { ok: true }
  }

  let tokenSeq = 0
  const executor = createGovernedWriteExecutor({
    parser: { parseRequestedEffectSet },
    canonicalize,
    resolveTarget,
    checkDrift,
    gatedFs: { createAdmissionGatedControlledFs },
    ...(opts.bindPort === false
      ? {}
      : { makePort: (request: unknown, grant: unknown) => assembly.createFsAdmissionPort(request as AdmissionRequest, grant as OperationGrant) }),
    realmId: REALM,
    fsId: FS_ID,
    rootDir: world.root,
    clock: () => FIXED_NOW,
    authorityGeneration: 1,
    consumed: assembly.consumed,
    policy: opts.slicePolicy ?? SLICE_POLICY,
    decide: () => ({ kind: 'allow' as const }),
    pa,
    ...(opts.visibility === undefined ? {} : { visibility: opts.visibility }),
    observe: (line: string) => { observeLines.push(line) },
    onWriteCommitted: (fact) => {
      // RECORDS ONLY — nothing here authorizes, consumes, or is consulted.
      committedFacts.push(fact)
    },
  })

  return {
    run: (args, over) => {
      tokenSeq += 1
      const call: GovernedWriteCall = {
        execToken: over?.execToken ?? { id: `token-${String(tokenSeq)}` },
        member: over?.member ?? MEMBER,
        callId: over?.callId ?? `exec-${String(tokenSeq)}`,
        binding: over?.binding ?? BIND_FACTS,
        ...(over?.correlation === undefined ? {} : { correlation: over.correlation }),
        ...(over?.signal === undefined ? {} : { signal: over.signal }),
      }
      return executor.run(args, call)
    },
    paCalls,
    observeLines,
    committedFacts,
    consumedCount: () => ledger.consumedCount(),
    lastPair: () => {
      if (lastPair === null) throw new Error('no approved pair captured')
      return lastPair
    },
    admitReal,
  }
}

function expectWritten(r: WriteSliceOutcome): { canonicalLocator: string; writtenFingerprint: string; laneLedger: readonly unknown[] } {
  if (r.kind !== 'written') throw new Error(`expected a written outcome, got: ${JSON.stringify(r).slice(0, 500)}`)
  return r
}

function expectRefused(r: WriteSliceOutcome): { refusalClass: string; code: string; text: string; cfClass?: string; cfReason?: string; sideEffectPossible?: boolean } {
  if (r.kind !== 'refused') throw new Error(`expected a typed refusal, got: ${JSON.stringify(r).slice(0, 500)}`)
  return r
}

function expectCancelled(r: WriteSliceOutcome): { kind: 'cancelled' } {
  if (r.kind !== 'cancelled') throw new Error(`expected a cancelled outcome, got: ${JSON.stringify(r).slice(0, 500)}`)
  return r
}

async function parkUntil(predicate: () => boolean, note: string): Promise<void> {
  for (let i = 0; i < 500; i += 1) {
    if (predicate()) return
    await new Promise((res) => { setTimeout(res, 1) })
  }
  throw new Error(`never reached state: ${note}`)
}

function deferred(): { promise: Promise<void>; release: () => void } {
  let release!: () => void
  const promise = new Promise<void>((res) => { release = res })
  return { promise, release }
}

// ---------------------------------------------------------------------------
// Pure units (host value law + lexical law + the undetermined honesty law)
// ---------------------------------------------------------------------------

describe('a5m2 write-slice pure law', () => {
  it('mirrors the host value law: blank file_path refused, empty content legitimate', () => {
    expect(parseWriteSliceArgs({ file_path: '   ', content: 'x' })).toMatchObject({ ok: false, code: 'write-args-file-path-blank' })
    expect(parseWriteSliceArgs({ file_path: 'a.txt', content: 7 })).toMatchObject({ ok: false, code: 'write-args-content-not-string' })
    expect(parseWriteSliceArgs({ file_path: 'a.txt', content: '' })).toEqual({ ok: true, filePath: 'a.txt', content: '' })
  })
  it('lexical anchor accepts in-root spellings and refuses lexical escapes with zero fs access', () => {
    const root = '/w/controlled'
    expect(lexicalWriteAnchor(root, 'notes/x.txt')).toEqual({ ok: true, path: '/w/controlled/notes/x.txt' })
    expect(lexicalWriteAnchor(root, '/w/controlled/notes/x.txt')).toEqual({ ok: true, path: '/w/controlled/notes/x.txt' })
    expect(lexicalWriteAnchor(root, '../outside/x.txt')).toMatchObject({ ok: false, code: 'locator-rejected' })
    expect(lexicalWriteAnchor(root, '/etc/passwd')).toMatchObject({ ok: false, code: 'locator-rejected' })
  })
  it('an undetermined lane error KEEPS sideEffectPossible (unstated = conservative true; a stated false is mirrored)', () => {
    const mk = (details: Record<string, string | boolean>): Extract<SliceGatedWriteResult, { ok: false }> => ({
      ok: false,
      error: { code: 'EXECUTION_TERMINATION_UNCONFIRMED', message: 'write side effect unconfirmed', details },
    })
    expect(mapLaneError(mk({ cfClass: 'undetermined', cfReason: 'write-side-effect-unconfirmed' })).sideEffectPossible).toBe(true)
    expect(mapLaneError(mk({ cfClass: 'undetermined', sideEffectUnknown: true })).sideEffectPossible).toBe(true)
    expect(mapLaneError(mk({ cfClass: 'undetermined', sideEffectUnknown: false })).sideEffectPossible).toBe(false)
    expect(mapLaneError(mk({ cfClass: 'denied', cfReason: 'effect-outside-grant' })).sideEffectPossible).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// P — positive controls over the REAL center (real kernel, real one-shot
// ledger, real canonicalizer, real gated lane)
// ---------------------------------------------------------------------------

describe('a5m2 write-slice C1 positive (REAL center consumption)', () => {
  it('P1 REAL center consumption: write lands, the REAL ledger consumed EXACTLY ONCE, onWriteCommitted only recorded the fact', async () => {
    const w = mkWorld('p1')
    const h = makeHarness(w, { allowPaths: [join(w.root, 'notes', 'hello.txt')] })
    const r = expectWritten(await h.run({ file_path: 'notes/hello.txt', content: 'GOVERNED-BYTES\n' }, { callId: 'exec-p1' }))
    const target = join(w.root, 'notes', 'hello.txt')
    expect(r.canonicalLocator).toBe(target)
    expect(r.writtenFingerprint).toBe(sha('GOVERNED-BYTES\n'))
    expect(readFileSync(target, 'utf8')).toBe('GOVERNED-BYTES\n')
    // THE REAL LEDGER: exactly one grant consumed, by the lane's exec-time
    // port — the ONE consumption point (the PA open half consumed nothing).
    expect(h.consumedCount()).toBe(1)
    expect(h.committedFacts).toHaveLength(1)
    const fact = h.committedFacts[0] as { callId: string; canonicalLocator: string; writtenFingerprint: string; member: { instanceId: string } }
    expect(fact.callId).toBe('exec-p1')
    expect(fact.canonicalLocator).toBe(target)
    expect(fact.writtenFingerprint).toBe(sha('GOVERNED-BYTES\n'))
    expect(fact.member.instanceId).toBe(MEMBER.instanceId)
    // the PA OPEN request carried the FULL identity (the five bindings):
    expect(h.paCalls).toHaveLength(1)
    expect(Object.keys(h.paCalls[0] as unknown as Record<string, unknown>).sort()).toEqual(['binding', 'callId', 'correlation', 'member', 'parametersFingerprint', 'realmId', 'requestedEffects'])
    // receipt law (D-C2-1): locator + fingerprint + ledger ONLY — no
    // before/after echo, no old content anywhere in the outcome:
    expect(Object.keys(r).sort()).toEqual(['canonicalLocator', 'kind', 'laneLedger', 'writtenFingerprint'])
    expect(JSON.stringify(r)).not.toContain('OLD-SECRET-CONTENT')
    expect(h.observeLines.some((l) => l.startsWith('governed-write committed'))).toBe(true)
  })

  it('P2 content-change: distinct contents mint DISTINCT plan fingerprints and each write spends its OWN grant (A2C-5 through the real canonicalizer)', async () => {
    const w = mkWorld('p2')
    const h = makeHarness(w, { allowPaths: [join(w.root, 'notes', 'ch.txt')] })
    const r1 = expectWritten(await h.run({ file_path: 'notes/ch.txt', content: 'VERSION-A\n' }, { callId: 'exec-p2a' }))
    const r2 = expectWritten(await h.run({ file_path: 'notes/ch.txt', content: 'VERSION-B\n' }, { callId: 'exec-p2b' }))
    expect(h.paCalls).toHaveLength(2)
    // the frozen plan fingerprints DIFFER for distinct contents — a
    // content swap under a frozen approval is a DIFFERENT plan:
    expect(h.paCalls[0]?.parametersFingerprint).not.toBe(h.paCalls[1]?.parametersFingerprint)
    expect(r1.writtenFingerprint).toBe(sha('VERSION-A\n'))
    expect(r2.writtenFingerprint).toBe(sha('VERSION-B\n'))
    expect(readFileSync(join(w.root, 'notes', 'ch.txt'), 'utf8')).toBe('VERSION-B\n')
    // TWO plans ⇒ TWO grants, EACH consumed exactly once (real ledger):
    expect(h.consumedCount()).toBe(2)
  })

  it('P3 empty content is legitimate: it writes an empty file through the governed face', async () => {
    const w = mkWorld('p3')
    const h = makeHarness(w, { allowPaths: [join(w.root, 'notes', 'empty.txt')] })
    const r = expectWritten(await h.run({ file_path: 'notes/empty.txt', content: '' }, { callId: 'exec-p3' }))
    expect(r.writtenFingerprint).toBe(sha(''))
    expect(readFileSync(join(w.root, 'notes', 'empty.txt'), 'utf8')).toBe('')
    expect(h.consumedCount()).toBe(1)
  })

  it('P4 cross-member POSITIVE control: member B answers with member B grant (the binding is load-bearing, not a blanket deny)', async () => {
    const w = mkWorld('p4')
    const h = makeHarness(w, { allowPaths: [join(w.root, 'notes', 'b.txt')] })
    expectWritten(await h.run({ file_path: 'notes/b.txt', content: 'FROM-B\n' }, { callId: 'exec-p4', member: MEMBER_B }))
    const fact = h.committedFacts[0] as { member: { instanceId: string } }
    expect(fact.member.instanceId).toBe('member-b')
    // the REAL kernel received member B in the request (which the old
    // revision never forwarded at all) and spent B grant:
    expect(h.paCalls[0]?.member.instanceId).toBe('member-b')
    expect(h.consumedCount()).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// N — negative controls
// ---------------------------------------------------------------------------

describe('a5m2 write-slice C1 negative', () => {
  it('N1-N3 schema lane: blank path / non-string content / escalation fields are refused with zero PA walk', async () => {
    const w = mkWorld('n1')
    const h = makeHarness(w)
    expect(expectRefused(await h.run({ file_path: '   ', content: 'x' }, { callId: 'exec-n1' })).code).toBe('write-args-file-path-blank')
    expect(expectRefused(await h.run({ file_path: 'a.txt', content: 7 }, { callId: 'exec-n2' })).code).toBe('write-args-content-not-string')
    expect(expectRefused(await h.run({ file_path: 'a.txt', content: 'x', sandbox_permissions: 'danger-full-access' }, { callId: 'exec-n3' })).code).toBe('write-escalation-ungoverned')
    expect(h.paCalls).toHaveLength(0)
    expect(h.consumedCount()).toBe(0)
  })

  it('N4-N5 lexical escape and absolute-outside are refused BEFORE admission; the outside secret never appears', async () => {
    const w = mkWorld('n4')
    const h = makeHarness(w)
    const esc = expectRefused(await h.run({ file_path: '../outside/x.txt', content: 'x' }, { callId: 'exec-n4' }))
    const abs = expectRefused(await h.run({ file_path: join(w.outside, 'x.txt'), content: 'x' }, { callId: 'exec-n5' }))
    expect(esc.code).toBe('locator-rejected')
    expect(abs.code).toBe('locator-rejected')
    expect(h.paCalls).toHaveLength(0)
    expect(`${JSON.stringify(esc)}${JSON.stringify(abs)}`).not.toContain('OUTSIDE-SECRET')
  })

  it('N6 identity law: a call without the REAL exec token or without the member/binding facts is refused BEFORE anything (zero PA, zero consumption)', async () => {
    const w = mkWorld('n6')
    const h = makeHarness(w)
    const strToken = expectRefused(await h.run({ file_path: 'notes/n6.txt', content: 'x' }, { callId: 'exec-n6a', execToken: 'string-is-not-identity' }))
    expect(strToken.refusalClass).toBe('schema')
    expect(strToken.code).toBe('identity-token-missing')
    const noMember = expectRefused(await h.run({ file_path: 'notes/n6.txt', content: 'x' }, { callId: 'exec-n6b', member: { teamSessionId: '', instanceId: 'x' } }))
    expect(noMember.code).toBe('identity-member-malformed')
    const badBinding = expectRefused(await h.run({ file_path: 'notes/n6.txt', content: 'x' }, { callId: 'exec-n6c', binding: { bindingId: '', revision: 1, definitionIdentity: 'd', providerId: 'p' } }))
    expect(badBinding.code).toBe('identity-binding-malformed')
    expect(h.paCalls).toHaveLength(0)
    expect(h.consumedCount()).toBe(0)
    expect(existsSync(join(w.root, 'notes', 'n6.txt'))).toBe(false)
  })

  it('N7 concurrent SAME exec token: single-flight — the in-flight replay is refused, the settled replay is refused, ONE write ever (defect 2, identity half, fixed)', async () => {
    const w = mkWorld('n7')
    const gate = deferred()
    const h = makeHarness(w, { gatePa: gate.promise, allowPaths: [join(w.root, 'notes', 'n7.txt')] })
    const sharedToken = { id: 'n7-token' }
    const first = h.run({ file_path: 'notes/n7.txt', content: 'SINGLE\n' }, { callId: 'exec-n7', execToken: sharedToken })
    await parkUntil(() => h.paCalls.length === 1, 'the first call parked inside the PA edge')
    const replay = expectRefused(await h.run({ file_path: 'notes/n7.txt', content: 'REPLAY\n' }, { callId: 'exec-n7', execToken: sharedToken }))
    expect(replay.refusalClass).toBe('admission')
    expect(replay.code).toBe('exec-token-replay')
    expect(replay.text).toContain('in-flight')
    gate.release()
    expectWritten(await first)
    // settled: the SAME identity is NEVER re-armed — a write never re-runs:
    const settled = expectRefused(await h.run({ file_path: 'notes/n7.txt', content: 'AGAIN\n' }, { callId: 'exec-n7', execToken: sharedToken }))
    expect(settled.code).toBe('exec-token-replay')
    expect(settled.text).toContain('never re-armed')
    expect(h.paCalls).toHaveLength(1)
    expect(readFileSync(join(w.root, 'notes', 'n7.txt'), 'utf8')).toBe('SINGLE\n')
    expect(h.consumedCount()).toBe(1)
  })

  it('N8 cancellation is NOT a write and NOT a refusal: pre-aborted answers cancelled with zero PA walk; an abort landing DURING the PA wait answers cancelled with zero bytes; allow+cancelled never walks the allow branch', async () => {
    const w = mkWorld('n8')
    const pre = makeHarness(w)
    expectCancelled(await pre.run({ file_path: 'notes/n8a.txt', content: 'x' }, { callId: 'exec-n8a', signal: { aborted: true } }))
    expect(pre.paCalls).toHaveLength(0)
    expect(pre.consumedCount()).toBe(0)
    // abort DURING the wait:
    const gate = deferred()
    const signal = { aborted: false }
    const mid = makeHarness(w, { gatePa: gate.promise, allowPaths: [join(w.root, 'notes', 'n8b.txt')] })
    const pending = mid.run({ file_path: 'notes/n8b.txt', content: 'x' }, { callId: 'exec-n8b', signal })
    await parkUntil(() => mid.paCalls.length === 1, 'the walk parked inside the PA edge')
    signal.aborted = true
    gate.release()
    expectCancelled(await pending)
    expect(existsSync(join(w.root, 'notes', 'n8b.txt'))).toBe(false)
    expect(mid.consumedCount()).toBe(0)
    // the kernel verdict shape `{ allow, cancelled }` is a fact, never an allow:
    const scripted = makeHarness(w, { scriptPa: () => ({ kind: 'allow', cancelled: true }) })
    expectCancelled(await scripted.run({ file_path: 'notes/n8c.txt', content: 'x' }, { callId: 'exec-n8c' }))
    expect(existsSync(join(w.root, 'notes', 'n8c.txt'))).toBe(false)
    expect(scripted.consumedCount()).toBe(0)
  })

  it('N9 PENDING is a denial with its own code, never a synchronous allow (the card honesty law)', async () => {
    const w = mkWorld('n9')
    const h = makeHarness(w, { scriptPa: () => ({ kind: 'pending', detail: 'a human has not answered yet' }) })
    const r = expectRefused(await h.run({ file_path: 'notes/n9.txt', content: 'x' }, { callId: 'exec-n9' }))
    expect(r.refusalClass).toBe('admission')
    expect(r.code).toBe('PA_PENDING_NOT_ALLOW')
    expect(existsSync(join(w.root, 'notes', 'n9.txt'))).toBe(false)
    expect(h.consumedCount()).toBe(0)
  })

  it('N10 default-deny: with policy default DENY and no rule covering the write, NOTHING reaches the center', async () => {
    const w = mkWorld('n10')
    const h = makeHarness(w, { slicePolicy: { default: 'deny' } })
    const r = expectRefused(await h.run({ file_path: 'notes/n10.txt', content: 'x' }, { callId: 'exec-n10' }))
    expect(r.code).toBe('template-default-deny')
    expect(h.paCalls).toHaveLength(0)
    expect(existsSync(join(w.root, 'notes', 'n10.txt'))).toBe(false)
  })

  it('N11 REAL admission deny: the deny-default policy answers through the REAL kernel (typed, zero write, zero consumption)', async () => {
    const w = mkWorld('n11')
    const h = makeHarness(w, { permissionPolicy: DENY_EVERYTHING })
    const r = expectRefused(await h.run({ file_path: 'notes/n11.txt', content: 'x' }, { callId: 'exec-n11' }))
    expect(r.refusalClass).toBe('admission')
    expect(h.paCalls).toHaveLength(1)
    expect(h.observeLines.some((l) => l.startsWith('governed-write pa-denied'))).toBe(true)
    expect(existsSync(join(w.root, 'notes', 'n11.txt'))).toBe(false)
    expect(h.consumedCount()).toBe(0)
  })

  it('N11b the REAL ask lane without a durable Control request refuses APPROVAL_REQUEST_UNAVAILABLE (pending never runs, never allows)', async () => {
    const w = mkWorld('n11b')
    const h = makeHarness(w, { permissionPolicy: ASK_EVERYTHING })
    const r = expectRefused(await h.run({ file_path: 'notes/n11b.txt', content: 'x' }, { callId: 'exec-n11b' }))
    expect(r.code).toBe('APPROVAL_REQUEST_UNAVAILABLE')
    expect(existsSync(join(w.root, 'notes', 'n11b.txt'))).toBe(false)
    expect(h.consumedCount()).toBe(0)
  })

  it('N12 AFTER-fix of defect 1: a grant approved for member A / call X is refused for member B / call Y (admission-identity-mismatch, zero write, zero consumption)', async () => {
    const w = mkWorld('n12')
    // the victim approval rides the REAL center once:
    const victim = makeHarness(w, { allowPaths: [join(w.root, 'notes', 'shared.txt')] })
    expectWritten(await victim.run({ file_path: 'notes/shared.txt', content: 'VICTIM-BYTES\n' }, { callId: 'exec-victim' }))
    const pair = victim.lastPair()
    // member B redeems A approved pair at the SAME target with the SAME
    // bytes (the plan itself matches — ONLY the identity differs):
    const attacker = makeHarness(w, { scriptPa: () => ({ kind: 'approved', grant: pair.grant, request: pair.request }) })
    const crossMember = expectRefused(await attacker.run({ file_path: 'notes/shared.txt', content: 'VICTIM-BYTES\n' }, { callId: 'exec-attacker', member: MEMBER_B }))
    expect(crossMember.refusalClass).toBe('admission')
    expect(crossMember.code).toBe('admission-identity-mismatch:member')
    // a different CALL redeems the same pair (same member, same plan):
    const crossCall = expectRefused(await attacker.run({ file_path: 'notes/shared.txt', content: 'VICTIM-BYTES\n' }, { callId: 'exec-another-call' }))
    expect(crossCall.code).toBe('admission-identity-mismatch:call')
    expect(readFileSync(join(w.root, 'notes', 'shared.txt'), 'utf8')).toBe('VICTIM-BYTES\n')
    expect(attacker.consumedCount()).toBe(0)
  })

  it('N13 AFTER-fix of defect 1 (content half): a content swap under a frozen approval dies at the plan fingerprint (A2C-5), never reaches the lane', async () => {
    const w = mkWorld('n13')
    const victim = makeHarness(w, { allowPaths: [join(w.root, 'notes', 'swap.txt')] })
    expectWritten(await victim.run({ file_path: 'notes/swap.txt', content: 'APPROVED-A\n' }, { callId: 'exec-swap-a' }))
    const pair = victim.lastPair()
    const swap = makeHarness(w, { scriptPa: () => ({ kind: 'approved', grant: pair.grant, request: pair.request }) })
    // the SAME call identity presenting DIFFERENT content: member and call
    // match, so the ONLY fact that can arbitrate is the plan fingerprint:
    const r = expectRefused(await swap.run({ file_path: 'notes/swap.txt', content: 'ATTACK-B\n' }, { callId: 'exec-swap-a' }))
    expect(r.code).toBe('admission-identity-mismatch:fingerprint')
    expect(readFileSync(join(w.root, 'notes', 'swap.txt'), 'utf8')).toBe('APPROVED-A\n')
    expect(swap.consumedCount()).toBe(0)
  })

  it('N14 AFTER-fix of defect 2 (grant half): THREE concurrent calls over ONE grant — exactly ONE writes, the losers answer APPROVAL_STALE grant-consumed from the REAL one-shot kernel', async () => {
    const w = mkWorld('n14')
    const gate = deferred()
    const h = makeHarness(w, {
      gatePa: gate.promise,
      allowPaths: [join(w.root, 'raced.txt')],
      scriptPa: (() => {
        // ONE real approval is minted (real kernel, real ledger); ALL three
        // racing calls are answered with the SAME approved pair — the shape
        // a durable approval replays. The promise cache single-flights the
        // admission itself (the kernel refuses any grantId re-issue).
        let pairPromise: Promise<ApprovedPair> | null = null
        return async (req: SlicePaRequest): Promise<SlicePaVerdict> => {
          if (pairPromise === null) {
            pairPromise = h.admitReal(MEMBER, req.callId, join(w.root, 'raced.txt'), req.parametersFingerprint, req.requestedEffects as unknown as RequestedEffectSet)
          }
          const pair = await pairPromise
          return { kind: 'approved', grant: pair.grant, request: pair.request }
        }
      })(),
    })
    const mk = () => h.run({ file_path: 'raced.txt', content: 'RACED\n' }, { callId: 'exec-race' })
    const race = Promise.all([mk(), mk(), mk()])
    await parkUntil(() => h.paCalls.length === 3, 'three calls parked inside the PA edge')
    gate.release()
    const outcomes = await race
    const written = outcomes.filter((o) => o.kind === 'written')
    const refused = outcomes.filter((o) => o.kind === 'refused') as Array<{ code: string; cfReason?: string }>
    expect(written).toHaveLength(1)
    expect(refused).toHaveLength(2)
    for (const loser of refused) {
      expect(loser.code).toBe('APPROVAL_STALE')
      expect(loser.cfReason).toBe('grant-consumed')
    }
    expect(readFileSync(join(w.root, 'raced.txt'), 'utf8')).toBe('RACED\n')
    // center accounting (real ledger, one grant): consumed EXACTLY once.
    expect(h.consumedCount()).toBe(1)
  })

  it('N15 a grant that does not cover the target refuses at the fs edge (typed denied, zero write, zero leak)', async () => {
    const w = mkWorld('n15')
    const h = makeHarness(w, {
      allowPaths: [join(w.root, 'notes', 'n15.txt'), join(w.root, 'notes', 'elsewhere.txt')],
      // the REQUEST the slice sees is honest (its own fp + effects); only
      // the GRANT was admitted over a DIFFERENT locator:
      scriptPa: async (req) => {
        const wrongEffects = parseEffects(join(w.root, 'notes', 'elsewhere.txt'))
        const wrong = await h.admitReal(MEMBER, req.callId, join(w.root, 'notes', 'elsewhere.txt'), req.parametersFingerprint, wrongEffects)
        return {
          kind: 'approved',
          grant: wrong.grant,
          request: { ...wrong.request, parametersFingerprint: req.parametersFingerprint, requestedEffects: req.requestedEffects as unknown as RequestedEffectSet },
        }
      },
    })
    const r = expectRefused(await h.run({ file_path: 'notes/n15.txt', content: 'x' }, { callId: 'exec-n15' }))
    expect(r.refusalClass).toBe('fs')
    expect(r.code).toBe('TOOL_BINDING_UNVERIFIED')
    expect(r.cfClass).toBe('denied')
    expect(r.cfReason).toBe('effect-outside-grant')
    expect(existsSync(join(w.root, 'notes', 'n15.txt'))).toBe(false)
    expect(JSON.stringify(r)).not.toContain('OLD-SECRET-CONTENT')
    expect(h.consumedCount()).toBe(0)
  })

  it('N16 a symlink target now dies EARLIER (the plan freeze resolves real identity; the lane alias law stays as the second net); the alias target keeps its bytes', async () => {
    const w = mkWorld('n16')
    const h = makeHarness(w)
    const r = expectRefused(await h.run({ file_path: 'link.txt', content: 'THROUGH\n' }, { callId: 'exec-n16' }))
    expect(r.refusalClass).toBe('schema')
    expect(r.code).toBe('canonicalization-failed')
    expect(h.paCalls).toHaveLength(0)
    expect(readFileSync(join(w.outside, 'secret.txt'), 'utf8')).toBe('OUTSIDE-SECRET\n')
    expect(r.text).not.toContain('OUTSIDE-SECRET')
    expect(h.consumedCount()).toBe(0)
  })

  it('N17 hidden-write is a TYPED loud refusal with a diagnostic (never silent); no object appears', async () => {
    const w = mkWorld('n17')
    const h = makeHarness(w, {
      allowPaths: [join(w.root, 'vault', 'lease.txt')],
      visibility: (_member, desc) => (desc.path === 'vault/lease.txt' ? 'hidden' : 'visible'),
    })
    const r = expectRefused(await h.run({ file_path: 'vault/lease.txt', content: 'x' }, { callId: 'exec-n17' }))
    expect(r.refusalClass).toBe('fs')
    expect(r.cfClass).toBe('hidden')
    expect(r.cfReason).toBe('hidden-write')
    expect(r.text).toContain('WITHHELD')
    expect(existsSync(join(w.root, 'vault', 'lease.txt'))).toBe(false)
  })

  it('N18 an unbound exec-time port REFUSES before the open (the honest default; zero bytes, zero consumption)', async () => {
    const w = mkWorld('n18')
    const h = makeHarness(w, {
      allowPaths: [join(w.root, 'notes', 'n18.txt')],
      bindPort: false, // NO port bound: the honest default refuses (recheck-port-unbound)
      scriptPa: async (req) => {
        const pair = await h.admitReal(MEMBER, req.callId, join(w.root, 'notes', 'n18.txt'), req.parametersFingerprint, req.requestedEffects as unknown as RequestedEffectSet)
        return { kind: 'approved', grant: pair.grant, request: pair.request }
      },
    })
    const r = expectRefused(await h.run({ file_path: 'notes/n18.txt', content: 'x' }, { callId: 'exec-n18' }))
    expect(r.refusalClass).toBe('fs')
    expect(r.text).toContain('recheck refused')
    expect(existsSync(join(w.root, 'notes', 'n18.txt'))).toBe(false)
    expect(h.consumedCount()).toBe(0)
  })

  it('N19 a grant whose fingerprint diverges from the BOUND plan never reaches the port (lane fingerprint binding)', async () => {
    const w = mkWorld('n19')
    const h = makeHarness(w, {
      allowPaths: [join(w.root, 'notes', 'n19.txt')],
      // admitted under a DIFFERENT fingerprint than the plan the slice
      // freezes; the REQUEST rides the true plan fp (the identity seam
      // passes) — the LANE catches the grant divergence:
      scriptPa: async (req) => {
        const effects = parseEffects(join(w.root, 'notes', 'n19.txt'))
        const diverged = await h.admitReal(MEMBER, req.callId, join(w.root, 'notes', 'n19.txt'), `sha256:${'3'.repeat(64)}`, effects)
        return {
          kind: 'approved',
          grant: diverged.grant,
          request: { ...diverged.request, parametersFingerprint: req.parametersFingerprint, requestedEffects: req.requestedEffects as unknown as RequestedEffectSet },
        }
      },
    })
    const r = expectRefused(await h.run({ file_path: 'notes/n19.txt', content: 'x' }, { callId: 'exec-n19' }))
    expect(r.refusalClass).toBe('fs')
    expect(r.code).toBe('TOOL_BINDING_UNVERIFIED')
    expect(r.text).toContain('fingerprint-divergence')
    expect(existsSync(join(w.root, 'notes', 'n19.txt'))).toBe(false)
    expect(h.consumedCount()).toBe(0)
  })

  it('N20 AFTER-fix of defect 3: root swapped to a symlink DURING the real PA wait ⇒ ANCHOR-DRIFT, zero bytes outside (victim intact, nothing consumed)', async () => {
    const w = mkWorld('n20')
    writeFileSync(join(w.outside, 'victim.txt'), 'ORIGINAL-OUTSIDE-DATA\n')
    const gate = deferred()
    const h = makeHarness(w, { gatePa: gate.promise, allowPaths: [join(w.root, 'victim.txt')] })
    const pending = h.run({ file_path: 'victim.txt', content: 'OUTSIDE-OVERWRITE\n' }, { callId: 'exec-n20' })
    await parkUntil(() => h.paCalls.length === 1, 'the walk parked inside the REAL PA edge')
    // the attack (identical to repro D3): swap the governed root for a
    // symlink to the outside dir WHILE the approval is still pending.
    rmSync(w.root, { recursive: true, force: true })
    symlinkSync(w.outside, w.root)
    gate.release()
    const r = expectRefused(await pending)
    expect(r.refusalClass).toBe('admission')
    expect(r.code).toBe('ANCHOR-DRIFT')
    // the outside victim file is UNTOUCHED (repro D3 wrote through):
    expect(readFileSync(join(w.outside, 'victim.txt'), 'utf8')).toBe('ORIGINAL-OUTSIDE-DATA\n')
    expect(h.consumedCount()).toBe(0)
    expect(h.observeLines.some((l) => l.startsWith('governed-write drift-refused'))).toBe(true)
    // restore a real dir so teardown stays simple
    rmSync(w.root, { recursive: true, force: true })
    mkdirSync(join(w.root, 'notes'), { recursive: true })
  })

  it('N21 AFTER-fix of defect 3 (ancestor half): the root ANCESTOR swapped during the wait is the same ANCHOR-DRIFT refusal', async () => {
    const w = mkWorld('n21', { nested: true }) // root = <base>/base/controlled
    const base = join(worldRoot, 'n21', 'base')
    const base2 = join(worldRoot, 'n21', 'base-real')
    const gate = deferred()
    const h = makeHarness(w, { gatePa: gate.promise, allowPaths: [join(w.root, 'notes', 'anc.txt')] })
    const pending = h.run({ file_path: 'notes/anc.txt', content: 'x\n' }, { callId: 'exec-n21' })
    await parkUntil(() => h.paCalls.length === 1, 'the walk parked inside the REAL PA edge')
    // the attack: the ROOT'S ANCESTOR is moved and replaced by a symlink
    // while the approval is pending — the same drift law must answer:
    renameSync(base, base2)
    symlinkSync(base2, base)
    gate.release()
    const r = expectRefused(await pending)
    expect(r.code).toBe('ANCHOR-DRIFT')
    expect(existsSync(join(base2, 'controlled', 'notes', 'anc.txt'))).toBe(false)
    expect(h.consumedCount()).toBe(0)
    // restore
    rmSync(base, { recursive: true, force: true })
    renameSync(base2, base)
  })
})
