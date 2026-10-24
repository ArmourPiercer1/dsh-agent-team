/**
 * a5m2-pwsh-mount.test.ts — the governed PWSH MOUNT (CENTER pwsh card
 * continuation, root 2026-10-25). Linux world: the mount legs are STRUCTURE/
 * GOVERNANCE over the bridge's own law (injected native def + injected PA
 * seat are the transport seams; the declared/capture/classify/seat gates are
 * the module's own law); the REAL-environment shape (native pwsh absent —
 * the pinned-639 loader gates the tool disabled-unless-win32) rides its own
 * honest DECLARED-INACTIVE leg; win32 real foreground/background PowerShell
 * acceptance stays ENV-NOT-AVAILABLE (skip ≠ pass, recorded, zero fake
 * greens). Tier 接线未测.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildPwshGovernedWiring, A5_PWSH_MOUNT_NAME } from '../src/plugin/live/governed-families/pwsh-wiring.mjs'
import { PWSH_FAMILY_ID } from '../src/plugin/live/governed-families/pwsh-arm.mjs'

const AGENT_ID = 'member-1'
const HEADER_ID = 'session-header-1'
const REALM = 'realm-1'

type Rec = Record<string, unknown>

function nativePwsh (over: Rec = {}) {
  return {
    name: 'pwsh',
    description: 'Run a PowerShell command (captured native wording).',
    parameters: { command: { type: 'string', required: true }, description: { type: 'string', required: true }, timeoutMs: { type: 'number' }, workdir: { type: 'string' }, run_in_background: { type: 'boolean' } },
    output: { schema: {}, render: 'text' },
    execute: async (..._args: unknown[]) => ({ content: [{ text: 'native-ran' }] }),
    ...over,
  }
}

interface SeatOpts {
  open?: unknown | (() => unknown)
  edge?: unknown | (() => unknown)
}

// THE REAL PLANE SEAT SHAPE (root P1 2026-10-25): paAdmit is a FUNCTION
// carrying open / edge / closePlan (team-tool-plane:2057/2522, handed at
// :4936 as `pa: paAdmit`) — the harness seat is that shape, never a plain
// object pose (the plain-object pose is now its own NEGATIVE control leg).
function seat (opts: SeatOpts = {}) {
  const log: string[] = []
  const answer = (v: unknown): unknown => (typeof v === 'function' ? (v as () => unknown)() : v)
  const paAdmit = Object.assign(
    function paAdmitBody (_walk: unknown): never { throw new Error('the pwsh row walks open/edge; the body funnel is reached only by the native chain') },
    {
      open: async (walk: Rec) => { log.push(`open:${String(walk.callId)}`); return answer(opts.open ?? { kind: 'approved', grant: { grantId: 'g-1' } }) },
      edge: async (walk: Rec) => { log.push(`edge:${String(walk.callId)}`); return answer(opts.edge ?? { kind: 'allow', consumedProof: { grant: { grantId: 'g-1' } } }) },
      closePlan: (callId: string) => { log.push(`close:${callId}`) },
    },
  )
  const walks: Rec[] = []
  const origOpen = paAdmit.open
  paAdmit.open = async (walk: Rec) => { walks.push(walk); return origOpen(walk) }
  return {
    log,
    walks,
    face: paAdmit,
  }
}

interface BuildOpts {
  declaredMount?: boolean
  native?: unknown
  seat?: ReturnType<typeof seat>
  placement?: unknown | (() => unknown)
}

// THE IDENTITY SEAM AS THE PLANE ACTUALLY IS: definitionIdentityOf is a
// WeakMap algebra — an identity per def OBJECT, ISSUED/MEMOIZED, the native
// def and the mount's wrapper def carrying DISTINCT identities (root final
// card item 2: no constant self-attestation). The placement feed answers the
// identity of the definition ACTUALLY PLACED (the wiring's definitions
// entry), exactly as the plane's placedByName law.
function build (opts: BuildOpts = {}) {
  const s = opts.seat ?? seat()
  const nativeDef = 'native' in opts ? opts.native : nativePwsh()
  const ids = new WeakMap<object, string>()
  let seq = 0
  const identityOf = (def: unknown): string | null => {
    if (def === null || typeof def !== 'object') return null
    if (!ids.has(def)) ids.set(def, `ident-${String(++seq)}`)
    return ids.get(def) as string
  }
  const wiringRef: { current?: WiringOk } = {}
  const wiring = buildPwshGovernedWiring({
    realmId: REALM,
    providerId: 'a5p5-plane',
    memberAgentId: AGENT_ID,
    sessionHeaderId: HEADER_ID,
    readNative: (name: string) => (name === 'pwsh' ? nativeDef : undefined),
    declaredMount: opts.declaredMount ?? true,
    jobsMounted: () => true,
    placementFeed: () => {
      if ('placement' in opts) {
        const p = opts.placement
        return typeof p === 'function' ? (p as () => unknown)() : p
      }
      const placed = (wiringRef.current?.definitions ?? [])[0]
      return placed === undefined ? undefined : Object.freeze({ definitionIdentity: identityOf(placed) as string, realmId: REALM })
    },
    identityOf,
    pa: s.face,
  } as never)
  wiringRef.current = wiring as unknown as WiringOk
  return { wiring, s, nativeDef, identityOf }
}

// A build variant whose placement feed answers a CHOSEN identity — the
// (h) leg uses it to feed the NATIVE def's identity where the mount bound
// the WRAPPER's (a real drift scenario the plane can hit on replacement).
function buildWithFeed (s: ReturnType<typeof seat>, feed: (ids: { native: string, wrapper: () => string | null }) => unknown) {
  const nativeDef = nativePwsh()
  const ids = new WeakMap<object, string>()
  let seq = 0
  const identityOf = (def: unknown): string | null => {
    if (def === null || typeof def !== 'object') return null
    if (!ids.has(def)) ids.set(def, `ident-${String(++seq)}`)
    return ids.get(def) as string
  }
  const wiringRef: { current?: WiringOk } = {}
  const wiring = buildPwshGovernedWiring({
    realmId: REALM,
    providerId: 'a5p5-plane',
    memberAgentId: AGENT_ID,
    sessionHeaderId: HEADER_ID,
    readNative: (name: string) => (name === 'pwsh' ? nativeDef : undefined),
    declaredMount: true,
    jobsMounted: () => true,
    placementFeed: () => feed({
      native: identityOf(nativeDef) as string,
      wrapper: () => {
        const placed = (wiringRef.current?.definitions ?? [])[0]
        return placed === undefined ? null : identityOf(placed)
      },
    }),
    identityOf,
    pa: s.face,
  } as never)
  wiringRef.current = wiring as unknown as WiringOk
  return { wiring, s, nativeDef, identityOf }
}

const exec = (callId: string, agentId: string = AGENT_ID): Rec => ({ callId, agent: { id: agentId } })

interface WiringOk { ok: true, familyId: string, adapterRevision: number, definitions: Rec[], placementNames: string[], declared: Array<Record<string, string>>, familyRegistrations: () => unknown, drain: () => unknown, boundIdentity?: string | null }
const okW = (w: unknown): WiringOk => w as WiringOk

describe('a5m2 governed pwsh mount (bridge law)', () => {
  it('(a) config law BOTH directions at the census: declared=false lands the honest DECLARED-INACTIVE row (no def, no placement, native untouched); declared=true + captured native arms exactly one row', () => {
    const off = build({ declaredMount: false })
    expect(off.wiring.ok).toBe(true)
    expect(okW(off.wiring).definitions).toHaveLength(0)
    expect(okW(off.wiring).placementNames).toHaveLength(0)
    expect(okW(off.wiring).declared[0]?.reason).toContain('MOUNT_NOT_DECLARED')
    // UNIFIED FACE (root final card item 1): the mount writer ALWAYS calls
    // familyRegistrations() (agent-bindings:6353 law) — the inactive census
    // answers the SAME face shape: a function answering the empty list, so
    // declared=false mounts complete with zero registrations instead of
    // dying at "familyRegistrations is not a function".
    expect(typeof okW(off.wiring).familyRegistrations).toBe('function')
    expect(okW(off.wiring).familyRegistrations()).toEqual([])
    const on = build()
    expect(on.wiring.ok).toBe(true)
    expect(okW(on.wiring).definitions).toHaveLength(1)
    expect(okW(on.wiring).placementNames).toEqual([A5_PWSH_MOUNT_NAME])
  })

  it('(b) THE REAL Linux census (native pwsh absent @639 = disabled-unless-win32): DECLARED-INACTIVE with the typed ENV reason, zero defs — and the win32 real fg/bg acceptance leg is recorded ENV-NOT-AVAILABLE here (skip ≠ pass; no fake arm, no fake green)', () => {
    const linux = build({ native: undefined })
    expect(linux.wiring.ok).toBe(true)
    expect(okW(linux.wiring).definitions).toHaveLength(0)
    expect(okW(linux.wiring).declared[0]?.reason).toContain('PWSH_NATIVE_UNCAPTURED_ENV')
    const marked = okW(linux.wiring).definitions.length === 0 ? 'ENV-NOT-AVAILABLE' : 'UNEXPECTED-ARM'
    expect(marked).toBe('ENV-NOT-AVAILABLE')
  })

  it('(c) the placed row is the SAME-NAME SAME-MEANING takeover: the captured native def verbatim with execute replaced; sameAgent scope exact (foreign agent refuses with ZERO PA entry); placement drift refuses; classify refusal is pure pre-edge', async () => {
    const { wiring, s, nativeDef } = build()
    const def = okW(wiring).definitions[0] as Rec
    expect(def.name).toBe('pwsh')
    expect(def.description).toBe((nativeDef as Rec).description)
    expect(def.parameters).toBe((nativeDef as Rec).parameters)
    expect(def.execute).not.toBe((nativeDef as Rec).execute)
    // foreign agent: refuse, no PA entry at all
    await expect((def.execute as (...a: unknown[]) => Promise<unknown>)({ command: 'x', description: 'd' }, exec('c-foreign', 'other-agent'))).rejects.toThrow(/scoped to member/)
    expect(s.log).toHaveLength(0)
    // placement drift (moved identity): refuse, no PA entry
    const moved = build({ placement: { definitionIdentity: 'other-ident', realmId: REALM } })
    const movedDef = okW(moved.wiring).definitions[0] as Rec
    await expect((movedDef.execute as (...a: unknown[]) => Promise<unknown>)({ command: 'x', description: 'd' }, exec('c-drift'))).rejects.toThrow(/placement/)
    expect(moved.s.log).toHaveLength(0)
    // classify refusal (unknown key) — PA never entered
    await expect((def.execute as (...a: unknown[]) => Promise<unknown>)({ command: 'x', description: 'd', evil: 1 }, exec('c-keys'))).rejects.toThrow(/PWSH_INPUT_KEYS_UNKNOWN/)
    expect(s.log).toHaveLength(0)
  })

  it('(d) THE SAME PA SEAT, the sibling law verbatim: open-cancel/deny/no-grant/edge-cancel/edge-deny/no-witness all refuse with ZERO body entry and exactly one closePlan; the good consumed witness runs the CAPTURED NATIVE BODY once, VERBATIM (保留原生)', async () => {
    let bodyCalls = 0
    const native = nativePwsh({ execute: async () => { bodyCalls += 1; return { content: [{ text: 'REAL-POWERSHELL-ANSWER' }] } } })
    const badCases: Array<[SeatOpts, RegExp]> = [
      [{ open: { cancelled: true } }, /ADMISSION_CANCELLED/],
      [{ open: { kind: 'deny', code: 'GRANT_STALE' } }, /GRANT_STALE/],
      [{ open: { kind: 'pending' } }, /APPROVAL_NOT_LANDED/],
      [{ edge: { cancelled: true } }, /EDGE_CANCELLED/],
      [{ edge: { kind: 'deny', code: 'POLICY_DENY' } }, /POLICY_DENY/],
      [{ edge: { kind: 'allow' } }, /CONSUME_PROOF_MISSING/],
    ]
    for (const [opts, pattern] of badCases) {
      const h = build({ native, seat: seat(opts) })
      const def = okW(h.wiring).definitions[0] as Rec
      const before = bodyCalls
      await expect((def.execute as (...a: unknown[]) => Promise<unknown>)({ command: 'Get-Date', description: 'show time' }, exec(`c-${String(pattern)}`))).rejects.toThrow(pattern)
      expect(bodyCalls).toBe(before)
      expect(h.s.log.filter((l) => String(l).startsWith('close:'))).toHaveLength(1)
    }
    const good = build({ native })
    const def = okW(good.wiring).definitions[0] as Rec
    const args = { command: 'Get-Process', description: 'list processes' }
    const ran = await (def.execute as (...a: unknown[]) => Promise<unknown>)(args, exec('c-good'))
    expect(ran).toEqual({ content: [{ text: 'REAL-POWERSHELL-ANSWER' }] }) // verbatim, never re-shaped
    expect(bodyCalls).toBe(1)
    expect(good.s.log).toContain('open:c-good')
    expect(good.s.log).toContain('edge:c-good')
    expect(good.s.log).toContain('close:c-good')
  })

  it('(e) registration keys ride the FRESH placementFeed law: silent feed THROWS (ABSENT), moved identity THROWS (MOVED), stable answers the family entry bytes (never a guessed key, never a silent skip)', () => {
    const silent = build({ placement: undefined })
    expect(() => okW(silent.wiring).familyRegistrations()).toThrow(/no definition identity|PLACEMENT_KEY_ABSENT/)
    const good = build()
    expect(() => okW(good.wiring).familyRegistrations()).not.toThrow()
    const regs = okW(good.wiring).familyRegistrations() as Array<Record<string, unknown>>
    expect((regs[0] as { definitionIdentity: string }).definitionIdentity).toBe(okW(good.wiring).boundIdentity)
    expect((regs[0] as { entry: Record<string, unknown> }).entry).toEqual({ familyId: PWSH_FAMILY_ID, adapterRevision: 1, providerIdentity: 'a5p5-plane' })
    const moved = build({ placement: () => ({ definitionIdentity: 'floats', realmId: REALM }) })
    expect(() => okW(moved.wiring).familyRegistrations()).toThrow(/does not float|PLACEMENT_KEY_MOVED/)
  })

  it('(f) THE REAL SEAT SHAPE (root P1): the production paAdmit is a CALLABLE FUNCTION carrying open/edge/closePlan — the mount ARMS on that shape end-to-end, while BOTH fakes refuse with the typed seat code: a plain methods object (no longer accepted) and a duck missing methods', () => {
    // POSITIVE: the callable shape arms (this is the SAME shape plane:4936
    // hands as `pa: paAdmit`; every leg above already rode it — here the
    // explicit pin that the arm is the REAL seat, not a widened check).
    const armed = build()
    expect(armed.wiring.ok).toBe(true)
    expect(okW(armed.wiring).definitions).toHaveLength(1)
    // NEGATIVE 1: the plain methods-object pose (the pre-fix accepted fake)
    // is now refused — the seat check accepts callable+three methods ONLY.
    const plainPose = buildPwshGovernedWiring({
      realmId: REALM, providerId: 'a5p5-plane', memberAgentId: AGENT_ID, sessionHeaderId: HEADER_ID,
      readNative: () => nativePwsh(), declaredMount: true,
      placementFeed: () => ({ definitionIdentity: 'i', realmId: REALM }), identityOf: () => 'i',
      pa: { open: () => undefined, edge: () => undefined, closePlan: () => undefined } as never,
    } as never)
    expect(plainPose.ok).toBe(false)
    expect((plainPose as { code?: string }).code).toBe('PWSH_WIRE_PA_SEAT_INVALID')
    // NEGATIVE 2: a duck (callable missing the methods) refuses too.
    const wiring = buildPwshGovernedWiring({
      realmId: REALM,
      providerId: 'a5p5-plane',
      memberAgentId: AGENT_ID,
      sessionHeaderId: HEADER_ID,
      readNative: () => nativePwsh(),
      declaredMount: true,
      placementFeed: () => ({ definitionIdentity: 'i', realmId: REALM }),
      identityOf: () => 'i',
      pa: Object.assign(function paAdmitBody () { /* duck: no methods */ }) as never,
      // (the duck seat stands in place of the default — assert below)
    } as never)
    expect(wiring.ok).toBe(false)
    expect((wiring as { code?: string }).code).toBe('PWSH_WIRE_PA_SEAT_INVALID')
  })

  it('(h) THE TWO BINDINGS KEPT APART (root final card item 2): placement identity binds the PLACED WRAPPER def (distinct from the native def identity — no constant self-attestation); the native execute reference is its OWN binding, swapped under the same placement = typed drift with zero PA entry', async () => {
    const h = build()
    const def = okW(h.wiring).definitions[0] as Rec
    // distinctness: the wrapper identity bound at placement is NOT the
    // native def's identity (a constant seam would answer one for both).
    expect(okW(h.wiring).boundIdentity).toBe(h.identityOf(def))
    expect(okW(h.wiring).boundIdentity).not.toBe(h.identityOf(h.nativeDef))
    // the NATIVE's identity as the placement answer is DRIFT (proves the
    // binding really is the placed def, not "some identity" — the feed is
    // re-pointed at the NATIVE identity, a real replacement scenario):
    const driftSeat = seat()
    const drift = buildWithFeed(driftSeat, (placedIds) => Object.freeze({ definitionIdentity: placedIds.native, realmId: REALM }))
    const driftDef = okW(drift.wiring).definitions[0] as Rec
    await expect((driftDef.execute as (...a: unknown[]) => Promise<unknown>)({ command: 'x', description: 'd' }, exec('c-drift-native')))
      .rejects.toThrow(/PLACED-DEF identity/)
    expect(driftSeat.log).toHaveLength(0)
    // the OTHER binding: same placement, swapped native body -> typed drift,
    // zero PA entry (the two legs are checked against their own sources).
    const swap = build()
    const swapDef = okW(swap.wiring).definitions[0] as Rec
    ;(swap.nativeDef as Rec).execute = async () => 'SWAPPED'
    await expect((swapDef.execute as (...a: unknown[]) => Promise<unknown>)({ command: 'x', description: 'd' }, exec('c-swap')))
      .rejects.toThrow(/NATIVE_EXECUTE_DRIFT|DIFFERENT execute/)
    expect(swap.s.log).toHaveLength(0)
  })

  it('(i) THE CANONICAL REQUESTED EFFECT SET (root final card item 3): the walk carries the parseRequestedEffectSet { effects, fingerprint } RECORD (the real kernel destructures requestedEffects.effects — a bare array starves it)', async () => {
    const h = build()
    const def = okW(h.wiring).definitions[0] as Rec
    await (def.execute as (...a: unknown[]) => Promise<unknown>)({ command: 'Get-Date', description: 'show time' }, exec('c-canonical'))
    expect(h.s.walks).toHaveLength(1)
    const re = h.s.walks[0]?.requestedEffects as Record<string, unknown>
    expect(Array.isArray(re)).toBe(false) // NOT a bare array — the record shape
    expect(Array.isArray(re.effects)).toBe(true)
    expect(re.effects).toEqual([{ kind: 'tool-invoke', toolName: 'pwsh', resource: null }])
    expect(typeof re.fingerprint).toBe('string')
    expect((re.fingerprint as string).length).toBeGreaterThan(0)
  })

  it('(j) NATIVE-LEGAL ESCALATION FLOW PRESERVED, NOTHING WIDENED (root final card item 4): the captured native enum + pairing law is the ONLY escalation surface; a native-legal pair dispatches verbatim to the native body (whose host chain keeps the ORIGINAL approval semantics), enum/pairing violations refuse BEFORE any PA entry, and a native WITHOUT the keys keeps them closed', async () => {
    const escParams = { command: { type: 'string', required: true }, description: { type: 'string', required: true }, sandbox_permissions: { type: 'string', enum: ['workspace-write', 'danger-full-access'] }, justification: { type: 'string' } }
    let bodyArgs: unknown
    let escCalls = 0
    const escNative = nativePwsh({
      parameters: escParams,
      execute: async (...a: unknown[]) => { bodyArgs = a[0]; escCalls += 1; return { content: [{ text: 'escalated' }] } },
    })
    const h = build({ native: escNative })
    const def = okW(h.wiring).definitions[0] as Rec
    const ran = await (def.execute as (...a: unknown[]) => Promise<unknown>)(
      { command: 'git status', description: 'show status', sandbox_permissions: 'workspace-write', justification: 'needs write access for the fix' },
      exec('c-esc'),
    )
    expect(ran).toEqual({ content: [{ text: 'escalated' }] })
    expect((bodyArgs as Rec).sandbox_permissions).toBe('workspace-write') // rides the native VERBATIM
    expect(h.s.walks).toHaveLength(1) // ONE walk; escalation is not a second authority
    // OUT-OF-ENUM: refused pre-edge (the governed row grants nothing).
    await expect((def.execute as (...a: unknown[]) => Promise<unknown>)(
      { command: 'x', description: 'd', sandbox_permissions: 'anything-goes', justification: 'j' }, exec('c-enum')),
    ).rejects.toThrow(/PWSH_INPUT_SANDBOX_MODE_UNSUPPORTED/)
    // PAIRING LAW: sandbox without justification refuses (native description law).
    await expect((def.execute as (...a: unknown[]) => Promise<unknown>)(
      { command: 'x', description: 'd', sandbox_permissions: 'workspace-write' }, exec('c-pair')),
    ).rejects.toThrow(/PWSH_INPUT_JUSTIFICATION_MISSING/)
    expect(h.s.walks).toHaveLength(1) // BOTH refusals: zero further PA entries
    expect(escCalls).toBe(1)
    // NOTHING WIDENED: a native WITHOUT the escalation surface keeps the keys closed.
    const plain = build()
    const plainDef = okW(plain.wiring).definitions[0] as Rec
    await expect((plainDef.execute as (...a: unknown[]) => Promise<unknown>)(
      { command: 'x', description: 'd', sandbox_permissions: 'workspace-write', justification: 'j' }, exec('c-plain')),
    ).rejects.toThrow(/PWSH_INPUT_KEYS_UNKNOWN/)
    expect(plain.s.log).toHaveLength(0)
  })

  it('(g) SOURCE LAW (readFileSync precedent): the plane ledger carries the pwsh takeover row and the CLOSED backends.pwsh gate; the placement census resolves ONLY through the wiring\'s own placement list; the family face + drain ride the mount; the bindings side carries the capture-arm law, the union row and the fresh registration loop', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const read = (...parts: string[]) => readFileSync(join(here, '..', 'src', 'plugin', 'live', ...parts), 'utf8')
    const plane = read('team-tool-plane.mjs')
    expect(plane).toContain("import { buildPwshGovernedWiring, A5_PWSH_MOUNT_NAME } from './governed-families/pwsh-wiring.mjs'")
    expect(plane).toContain("pwsh: Object.freeze(['pwsh'])")
    expect(plane).toContain("const pwshInjectRaw = input.backends?.pwsh")
    expect(plane).toContain('PWSH_ARM_INJECT_INVALID')
    expect(plane).toContain('PWSH_ARM_REFUSED')
    expect(plane).toContain('if (pwshWiring !== null && pwshWiring.placementNames.includes(spelling)) return spelling')
    expect(plane).toContain('...g3Defs, ...lspDefs, ...pwshDefs, ...g2Defs]') // CENTER census-sync: LSP mount (d5ecdb219) inserted lspDefs at its lane slot between g3 and pwsh; the pwsh row itself is byte-present, only the neighbor list moved
    expect(plane).toContain('if (pwshWiring !== null) pwshWiring.drain()')
    const bindings = read('agent-bindings.mjs')
    expect(bindings).toContain("const pwshCfg = planeCfg.pwsh")
    expect(bindings).toContain('alpha5-pwsh-mount-refused')
    expect(bindings).toContain('...(a5PwshInject === null ? {} : { pwsh: a5PwshInject })')
    expect(bindings).toContain('a5PwshInject === null && a5G3RunCodeGuardInject')
    expect(bindings).toContain('a5m2-pwsh: family REGISTERED')
    // the win32 truth is stated where the code claims it (no invented executor):
    const wiring = read('governed-families', 'pwsh-wiring.mjs')
    expect(wiring).toContain('GOVERNED_TAKEOVER_HOST_BODY')
    expect(wiring).toContain('ENV-NOT-AVAILABLE')
    expect(wiring).toContain('consumedProof')
    expect(wiring).toContain('tool-invoke')
    // the four final-card laws are spelled where they execute:
    expect(wiring).toContain('familyRegistrations: () => Object.freeze([])')
    expect(wiring).toContain('parseRequestedEffectSet')
    expect(wiring).toContain('NATIVE_EXECUTE_DRIFT')
    expect(wiring).toContain('PLACED-WRAPPER')
    const arm = read('governed-families', 'pwsh-arm.mjs')
    expect(arm).toContain('pwsh-sandbox') // OS isolation exists ONLY via the chosen confine
    expect(arm).toContain('is NOT isolation') // danger-full-access caliber
    expect(arm).toContain('timeout/output/spill')
    expect(arm).toContain('self-attest')
  })
})
