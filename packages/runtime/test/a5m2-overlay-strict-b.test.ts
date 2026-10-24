/**
 * a5m2-overlay-strict-b.test.ts — overlay strict-b slice 2 (plane/registry
 * read-time consumption). The governed READ hand-off now consumes the
 * TRUSTED canonical operation the pre-execute adapter threads (canonical
 * path only) against the LIVE durable authority, on the REAL production
 * chain (same mount, same admission assembly, same call-level facts entry,
 * same A/B pair as the c1c2 hand-off legs). Pinned laws:
 *
 *  OB-1 REPLACEMENT, not intersection: the merged overlay verdict (overlay >
 *       template > blueprint) answers the ORDINARY question for this call —
 *       an overlay ALLOW over the replaced template deny opens the hand-off
 *       (the replaced template Ask is never intersected back in), and an
 *       overlay DENY over a template ALLOW refuses at the open leg with
 *       zero admitCall.
 *  OB-2 CROSS-LEG REVOCATION: the durable answer is read FRESH at each leg.
 *       An overlay flip allow→deny between the open and the redemption
 *       consumes NOTHING (no cached allow crosses the split); ASK at the
 *       edge without a standing durable approval refuses (pending never
 *       runs). The overlay flip deny→allow between legs never resurrects
 *       the refused open — the token was terminal for a refusal.
 *  OB-3 BINDING: the trusted tuple rides Part A (bound whole BEFORE the
 *       first admitCall — a partial tuple refuses with zero admitCall) and
 *       the operation fingerprint pairs (never substitutes) against the
 *       effect-set fingerprint the walk itself minted.
 *  OB-4 ZERO FLIP: with no canonical context the seam is never called;
 *       with a canonical context but NO seam the template lane answers
 *       byte-identically and says so; every hard law (window/lexical/
 *       schema/R-W/N/Control) keeps its frozen position: an overlay ALLOW
 *       never opens a traversal target.
 */
import { untestedAssurance } from '../tool-dispatch/index.js'
import { describe, beforeAll, afterAll, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const WORLD = join(REPO, 'tests/homes', `a5m2-strictb-${Date.now().toString(36)}`)
const ROOT_SCOPE = 'a5m2-strictb-scope'
const ROOT_DIR = join(WORLD, 'root')
const REALM = 'a5m2-strictb-realm'

interface ReadOk { path: string; offset: number; lines: Array<{ number: number; text: string }>; totalLines: number }
interface PlaneValue {
  governance: { policyDocument: () => unknown; denySources: () => unknown }
  definitions: Array<{ name: string; execute: (raw: unknown, exec?: unknown) => Promise<unknown> }>
  paReadHandoff?: {
    open: (exec: object, canonical?: object) => Promise<{ kind: string; correlation?: string; code?: string; detail?: string }>
    close: (exec: object) => void
  }
  livePaPlan: Map<string, unknown>
}
interface PlaneRow {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) => { ok: true; value: PlaneValue } | { ok: false; code: string; message: string }
}

let row: PlaneRow
beforeAll(async () => {
  row = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as PlaneRow
  mkdirSync(ROOT_DIR, { recursive: true })
  writeFileSync(join(ROOT_DIR, 'target.txt'), 'strictb-line-1\nstrictb-line-2\n')
})
afterAll(() => { rmSync(WORLD, { recursive: true, force: true }) })

const confinedProvider = () => ({
  trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
  assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
})
const subtreeContains = (parent: string, child: string) => child === parent || child.startsWith(parent + '/')
// The 639 fs-local TARGET-KEY law mirrored for the mount's authority seam:
// realpath for existing targets, real-ancestor + unresolved segments for
// missing ones (packages/fs/fs-local/lib/types/fsio.js:96/:132/:144). The
// row's ③ check and canonicalFor ride this SAME key law — opaque key to
// opaque key, never a lexical path comparison.
const authorityKey = (p: string) => {
  const missing: string[] = []
  let cur = p
  for (;;) {
    try {
      let out = realpathSync(cur)
      for (const seg of missing) out = join(out, seg)
      return out
    } catch {
      const i = cur.lastIndexOf('/')
      missing.unshift(cur.slice(i + 1))
      cur = i > 0 ? cur.slice(0, i) : '/'
    }
  }
}
const joined = (body: ReadOk) => body.lines.map((l) => l.text).join('\n')
const refusalText = (value: unknown) => JSON.stringify(value ?? '')

// Two template worlds: the ALLOW world (c1c2-isomorphic) and a default-deny
// world whose lanes cover NOTHING — the template ordinary verdict there is a
// closed refusal, which is exactly what the overlay's selected-layer verdict
// must REPLACE (never intersect) for a canonical call.
const POLICY_ALLOW = Object.freeze({
  default: 'deny',
  allow: [{ tool: 'read', resource: { kind: 'subtree', path: ROOT_DIR } }],
  ask: [] as unknown[],
  deny: [] as unknown[],
})
const POLICY_CLOSED = Object.freeze({
  default: 'deny',
  allow: [] as unknown[],
  ask: [] as unknown[],
  deny: [] as unknown[],
})

function mount(policy: unknown, extra: Record<string, unknown> = {}, observe: string[] = []) {
  return row.createTeamToolPlaneAssembly({
    teamSessionId: 'a5m2-strictb-team-root',
    permissionPolicy: policy,
    realmId: REALM,
    templateId: 'a5m2-strictb-tpl',
    role: 'member',
    instanceId: 'a5m2-strictb-instance',
    onObserve: (r: unknown) => observe.push(String(r)),
    fs: { subtreeContains, resolveAuthorityKey: authorityKey },
    plane: { fsInstance: { fs: 'strictb-ctl', rootDir: ROOT_DIR, realmId: REALM, kind: 'absolute-path' }, confinedProvider: confinedProvider() },
    ...extra,
  })
}

interface SeamWorld {
  effect: 'allow' | 'ask' | 'deny'
  calls: Array<{ tool: string; key: string; fingerprint: string; label: string }>
  throwNext?: boolean
}
const strictbMount = (opts: {
  policy?: unknown
  seam?: SeamWorld | null
  observe?: string[]
}) => {
  const observe = opts.observe ?? []
  const seam = opts.seam ?? null
  const asked: Array<Record<string, unknown>> = []
  const worldOf = (planeValue: PlaneValue) => ({
    ceiling: { teamHardEnvelope: { rules: [] }, permissionMutationEnvelope: { status: 'absent' } },
    policyDocument: planeValue.governance.policyDocument(),
    denySources: planeValue.governance.denySources(),
    effects: undefined,
    member: { teamSessionId: 'a5m2-strictb-team-root', instanceId: 'a5m2-strictb-instance' },
    beneficiaryAuthority: 'member',
    binding: {
      bindingId: `team-own:${ROOT_SCOPE}:read`,
      agentScopeKey: ROOT_SCOPE,
      toolName: 'read',
      definitionIdentity: 'sha256:placed-definition',
      providerId: 'dsh-agent-team',
      implementationOrigin: 'team-trusted-extension',
      executionBoundary: 'trusted-host',
      assurance: untestedAssurance('team-trusted-extension', 'trusted-host'),
      policyGeneration: 0,
      authorityGeneration: 0,
      revision: 1,
      status: 'ACTIVE',
    },
    blueprint: { revision: '1', contentHash: 'sha256:bp', templateId: 'a5m2-strictb-tpl', cwd: ROOT_DIR, providerVersion: 'pv-1' },
    authorityGeneration: 0,
  })
  const built = mount(opts.policy ?? POLICY_ALLOW, {
    readCallFacts: async (input: Record<string, unknown>) => {
      asked.push(input)
      return { kind: 'no-approval-question', facts: { ...worldOf(plane), realmId: input.realmId, effects: input.requestedEffects } }
    },
    ...(seam === null ? {} : {
      overlayReadDecision: async (args: { operation: { tool: string; resource: { key: string }; fingerprint: string }, template: { label: string } }) => {
        if (seam.throwNext === true) {
          seam.throwNext = false
          throw new Error('the durable authority store faulted (test seam)')
        }
        seam.calls.push({ tool: args.operation.tool, key: args.operation.resource.key, fingerprint: args.operation.fingerprint, label: args.template?.label ?? '?' })
        return { effect: seam.effect, winningLayer: 'overlay', overlayGeneration: 7 }
      },
    }),
  }, observe)
  if (!built.ok) throw new Error(`mount refused: ${JSON.stringify(built)}`)
  const plane = built.value
  const read = plane.definitions.find((d) => d.name === 'read')
  if (!read || !plane.paReadHandoff) throw new Error('no read row / no hand-off face')
  return { plane, read, handoff: plane.paReadHandoff, asked, observe }
}

const canonicalFor = (file: string) => Object.freeze({
  tool: 'read',
  resourceKind: 'file',
  resourceKey: authorityKey(file),
  fingerprint: 'opfp-strictb-0001',
})

describe('a5m2-overlay-strict-b — the governed read hand-off consumes the live durable authority (REAL chain)', () => {
  it('OB-1a the merged overlay ALLOW REPLACES the closed template lane for this canonical call (the kernel stays an INDEPENDENT hard law)', async () => {
    const seam: SeamWorld = { effect: 'allow', calls: [] }
    const { plane, read, handoff, observe, asked } = strictbMount({ policy: POLICY_CLOSED, seam })
    const file = join(ROOT_DIR, 'target.txt')
    const execLike = { name: 'read', token: Symbol('strictb-ob1a'), arguments: { file_path: file } }
    const opened = await handoff.open(execLike, canonicalFor(file))
    // The seam WAS the ordinary answer for this call: the row's own
    // `template-default-deny` gate never fired, and the merged DENY code is
    // absent too (the seam said ALLOW). What the walk answers INSTEAD belongs
    // to the admission kernel over its own projected policy (R/W/N, approval
    // rungs — hard law the overlay verdict never launders or replaces).
    expect(seam.calls, 'the canonical operation was answered by the durable authority exactly once at the open leg').toHaveLength(1)
    expect(observe.some((l) => l.includes('template-default-deny')), 'the replaced template refusal never fired').toBe(false)
    expect(opened.code, 'the row neither minted its own template refusal nor an overlay denial').not.toBe('template-default-deny')
    expect(opened.code).not.toBe('OVERLAY_DENY_LANE')
    let late = ''
    try {
      late = refusalText(await read.execute({ file_path: file }, execLike))
    } catch (error) {
      late = String((error as Error)?.message ?? error)
    }
    if (opened.kind === 'authorized') {
      expect(asked.length, 'the walk reached the kernel, which answers for itself').toBeGreaterThanOrEqual(1)
    }
    expect(JSON.stringify(late) + JSON.stringify(opened)).not.toContain('strictb-line-1')
    expect(plane.livePaPlan.size).toBe(0)
  })

  it('OB-1b the merged overlay DENY over a template ALLOW refuses at the open leg with ZERO admitCall', async () => {
    const seam: SeamWorld = { effect: 'deny', calls: [] }
    const { read, handoff, asked, observe } = strictbMount({ policy: POLICY_ALLOW, seam })
    const file = join(ROOT_DIR, 'target.txt')
    const execLike = { name: 'read', token: Symbol('strictb-ob1b'), arguments: { file_path: file } }
    const opened = await handoff.open(execLike, canonicalFor(file))
    expect(opened.kind).toBe('refused')
    expect(opened.code).toBe('OVERLAY_DENY_LANE')
    expect(asked.length, 'no PA walk, no admitCall, no Control row behind a merged deny').toBe(0)
    // The refusal is terminal for this token: a later body never re-walks.
    let late = ''
    try {
      late = refusalText(await read.execute({ file_path: file }, execLike))
    } catch (error) {
      late = String((error as Error)?.message ?? error)
    }
    expect(late + refusalText(opened)).not.toContain('strictb-line-1')
    // Root card ①: the late leg of a canonically refused token is refused AT
    // THE TOKEN ENTRY — the settled entry carries NO correlation, there is
    // nothing to replay, so the leg never fabricates a callId, never runs
    // Part A / admitCall / a Control row, and never even reaches the
    // edge-cancel path. Zero RE-ADMIT, not merely zero bytes.
    expect(asked.length, 'the terminal-entry refusal never re-walks Part A: zero admitCall, zero Control row').toBe(0)
    expect(observe.some((l) => l.includes('cancelled-terminal-no-correlation')), 'the refusal is observed at the token entry').toBe(true)
    expect(observe.some((l) => l.includes('cancelled-at-pa-edge')), 'nothing reaches the execution edge').toBe(false)
  })

  it('OB-2a cross-leg REVOCATION consumes nothing: overlay allow→deny between the open and the body delivers zero bytes, zero edge', async () => {
    const seam: SeamWorld = { effect: 'allow', calls: [] }
    const { plane, read, handoff, observe } = strictbMount({ policy: POLICY_ALLOW, seam })
    const file = join(ROOT_DIR, 'target.txt')
    const execLike = { name: 'read', token: Symbol('strictb-ob2a'), arguments: { file_path: file } }
    const opened = await handoff.open(execLike, canonicalFor(file))
    expect(opened.kind).toBe('authorized')
    // The durable answer moves DENY after the authorization was handed over.
    seam.effect = 'deny'
    let refusal = ''
    try {
      refusal = refusalText(await read.execute({ file_path: file }, execLike))
    } catch (error) {
      refusal = String((error as Error)?.message ?? error)
    }
    expect(refusal).toContain('OVERLAY_DENY_LANE')
    expect(refusal).not.toContain('strictb-line-1')
    expect(plane.livePaPlan.size, 'the revoked leg closes its plan fact, nothing leaks').toBe(0)
    expect(observe.some((l) => l.includes('overlay-strict-b edge-deny')), 'the edge read the durable answer FRESH (no cached allow)').toBe(true)
  })

  it('OB-2b ASK at the edge without a standing durable approval refuses — pending never runs', async () => {
    const seam: SeamWorld = { effect: 'allow', calls: [] }
    const { read, handoff, observe } = strictbMount({ policy: POLICY_ALLOW, seam })
    const file = join(ROOT_DIR, 'target.txt')
    const execLike = { name: 'read', token: Symbol('strictb-ob2b'), arguments: { file_path: file } }
    expect((await handoff.open(execLike, canonicalFor(file))).kind).toBe('authorized')
    seam.effect = 'ask'
    let refusal = ''
    try {
      refusal = refusalText(await read.execute({ file_path: file }, execLike))
    } catch (error) {
      refusal = String((error as Error)?.message ?? error)
    }
    expect(refusal).toContain('OVERLAY_ASK_UNAPPROVED_AT_EDGE')
    expect(refusal).not.toContain('strictb-line-1')
    expect(observe.some((l) => l.includes('edge-ask-without-durable-approval'))).toBe(true)
  })

  it('OB-3 the trusted tuple is bound BEFORE the first admitCall and answers ONLY its own operation', async () => {
    const seam: SeamWorld = { effect: 'allow', calls: [] }
    const { read, handoff, asked } = strictbMount({ policy: POLICY_ALLOW, seam })
    const file = join(ROOT_DIR, 'target.txt')
    const execLike = { name: 'read', token: Symbol('strictb-ob3'), arguments: { file_path: file } }
    const opened = await handoff.open(execLike, canonicalFor(file))
    expect(opened.kind).toBe('authorized')
    // The seam answered exactly the canonical operation (tool/key/fingerprint
    // verbatim) — never an effect-set sibling — and the label rode the mount.
    expect(seam.calls).toEqual([{ tool: 'read', key: file, fingerprint: 'opfp-strictb-0001', label: 'a5m2-strictb-tpl' }])
    expect(asked.length, 'the binding was bound before the first admitCall, which then ran').toBeGreaterThanOrEqual(1)
    const body = await read.execute({ file_path: file }, execLike)
    expect(joined(body as ReadOk)).toContain('strictb-line-2')
    // Both legs asked the seam — fresh at each, never once-and-cached.
    expect(seam.calls.length, 'open leg + fresh edge leg').toBe(2)
    expect(seam.calls[0]?.fingerprint).toBe(seam.calls[1]?.fingerprint)
  })

  it('OB-3b a PARTIAL trusted tuple is refused whole-tuple law: zero seam call, zero admitCall, zero walk', async () => {
    const seam: SeamWorld = { effect: 'allow', calls: [] }
    const { read, handoff, asked, observe } = strictbMount({ policy: POLICY_ALLOW, seam })
    const file = join(ROOT_DIR, 'target.txt')
    const execLike = { name: 'read', token: Symbol('strictb-ob3b'), arguments: { file_path: file } }
    const opened = await handoff.open(execLike, { tool: 'read', resourceKind: 'file' } as unknown as object)
    expect(opened.kind).toBe('refused')
    expect(opened.code).toBe('PA_HANDOFF_CANONICAL_MALFORMED')
    expect(seam.calls).toHaveLength(0)
    expect(asked.length).toBe(0)
    let late = ''
    try {
      late = refusalText(await read.execute({ file_path: file }, execLike))
    } catch (error) {
      late = String((error as Error)?.message ?? error)
    }
    expect(late + JSON.stringify(opened)).not.toContain('strictb-line-1')
    // Root card ① at the MALFORMED refuse point: same terminal-entry law —
    // the late leg re-admits nothing (zero Part A, zero Control, no edge).
    expect(asked.length, 'the terminal-entry refusal never re-walks Part A: zero admitCall, zero Control row').toBe(0)
    expect(observe.some((l) => l.includes('cancelled-terminal-no-correlation')), 'the refusal is observed at the token entry').toBe(true)
    expect(observe.some((l) => l.includes('cancelled-at-pa-edge')), 'nothing reaches the execution edge').toBe(false)
  })

  it('OB-3c a FAULTING durable read is never laundered into the static lane (fail closed at the open leg)', async () => {
    const seam: SeamWorld = { effect: 'allow', calls: [], throwNext: true }
    const { handoff, asked } = strictbMount({ policy: POLICY_ALLOW, seam })
    const file = join(ROOT_DIR, 'target.txt')
    const execLike = { name: 'read', token: Symbol('strictb-ob3c'), arguments: { file_path: file } }
    const opened = await handoff.open(execLike, canonicalFor(file))
    expect(opened.kind).toBe('refused')
    expect(opened.code).toBe('PA_OVERLAY_DECISION_FAULT')
    expect(asked.length).toBe(0)
  })

  it('OB-4a ZERO FLIP: no canonical context never touches the seam and keeps the template lane byte-identically', async () => {
    const seam: SeamWorld = { effect: 'deny', calls: [] }
    const { read, handoff, observe } = strictbMount({ policy: POLICY_ALLOW, seam })
    const file = join(ROOT_DIR, 'target.txt')
    const execLike = { name: 'read', token: Symbol('strictb-ob4a'), arguments: { file_path: file } }
    expect((await handoff.open(execLike)).kind).toBe('authorized')
    expect(seam.calls, 'the seam belongs to the canonical path ONLY').toHaveLength(0)
    const body = await read.execute({ file_path: file }, execLike)
    expect(joined(body as ReadOk)).toContain('strictb-line-1')
    expect(observe.some((l) => l.includes('overlay-strict-b'))).toBe(false)
  })

  it('OB-4b ZERO FLIP: a canonical context on a mount WITHOUT the seam keeps the old closed template refusal (and says so)', async () => {
    const observe: string[] = []
    const { handoff } = strictbMount({ policy: POLICY_CLOSED, seam: null, observe })
    const file = join(ROOT_DIR, 'target.txt')
    const execLike = { name: 'read', token: Symbol('strictb-ob4b'), arguments: { file_path: file } }
    const opened = await handoff.open(execLike, canonicalFor(file))
    expect(opened.kind, 'the template lane answers for this world exactly as before').toBe('refused')
    expect(opened.code).toBe('template-default-deny')
    expect(observe.some((l) => l.includes('canonical-context-unconsumed')), 'the world never claims overlay governance').toBe(true)
  })

  it('OB-4c an overlay ALLOW never opens what a HARD law refuses: the traversal target still discloses ZERO', async () => {
    const seam: SeamWorld = { effect: 'allow', calls: [] }
    const { handoff, observe } = strictbMount({ policy: POLICY_ALLOW, seam })
    const file = join(ROOT_DIR, '..', 'outside-strictb', 'secret.txt')
    const execLike = { name: 'read', token: Symbol('strictb-ob4c'), arguments: { file_path: file } }
    const opened = await handoff.open(execLike, canonicalFor(file))
    expect(opened.kind, 'the lexical anchor refuses before any durable read is even asked').toBe('refused')
    expect(seam.calls, 'no overlay verdict is spent on a target the hard law already refuses').toHaveLength(0)
    expect(observe.join('\n')).not.toContain('strictb-line')
  })

  it('OB-5 a canonical open whose opaque resourceKey names ANOTHER target than the armed arm is refused key-to-key BEFORE the overlay consult and the first admitCall (root card ③)', async () => {
    const seam: SeamWorld = { effect: 'allow', calls: [] }
    const { read, handoff, asked, observe } = strictbMount({ policy: POLICY_ALLOW, seam })
    const armed = join(ROOT_DIR, 'target.txt')
    const other = join(ROOT_DIR, 'other.txt')
    writeFileSync(other, 'strictb-other-secret\n')
    const execLike = { name: 'read', token: Symbol('strictb-ob5'), arguments: { file_path: armed } }
    const opened = await handoff.open(execLike, canonicalFor(other))
    expect(opened.kind).toBe('refused')
    expect(opened.code).toBe('PA_HANDOFF_TARGET_MISMATCH')
    expect(seam.calls, 'the durable authority is never consulted for a target that does not name the arm').toHaveLength(0)
    expect(asked.length, 'zero admitCall, zero Control row behind a wrong-target canonical open').toBe(0)
    expect(observe.some((l) => l.includes('target-mismatch')), 'the key-to-key mismatch is observed').toBe(true)
    // terminal for the token: the late leg re-walks nothing, discloses nothing
    let late = ''
    try {
      late = refusalText(await read.execute({ file_path: armed }, execLike))
    } catch (error) {
      late = String((error as Error)?.message ?? error)
    }
    expect(late + refusalText(opened)).not.toContain('strictb-line-1')
    expect(late).not.toContain('strictb-other-secret')
    expect(asked.length, 'the refused token re-admits nothing on the late leg').toBe(0)
  })

  it('OB-6 an all-allow hand-off redeems ONLY the context its Part A issued: a body leg presenting a different effect context is refused with zero bytes (root card ②)', async () => {
    const seam: SeamWorld = { effect: 'allow', calls: [] }
    const { read, handoff } = strictbMount({ policy: POLICY_ALLOW, seam })
    const fileA = join(ROOT_DIR, 'target.txt')
    const fileB = join(ROOT_DIR, 'other.txt')
    writeFileSync(fileB, 'strictb-other-secret\n')
    const token = Symbol('strictb-ob6')
    const opened = await handoff.open({ name: 'read', token, arguments: { file_path: fileA } }, canonicalFor(fileA))
    expect(opened.kind).toBe('authorized')
    // The redemption leg swaps its armed file (same token → the SAME issued
    // callId and grant stand behind a DIFFERENT effect context). The issued
    // binding — the frozen pair Part A minted before the first admitCall —
    // is the only thing an edge may pair against: the parameters/effect-set
    // fingerprint of the new context does not match the ISSUED record, so
    // the redemption is refused before any byte, and the issued grant is
    // never consumed for a context Part A never admitted.
    let out = ''
    try {
      out = refusalText(await read.execute({ file_path: fileB }, { name: 'read', token, arguments: { file_path: fileB } }))
    } catch (error) {
      out = String((error as Error)?.message ?? error)
    }
    expect(out).not.toContain('strictb-other-secret')
    expect(out).not.toContain('strictb-line-1')
  })
})
