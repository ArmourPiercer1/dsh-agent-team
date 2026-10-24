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

function seat (opts: SeatOpts = {}) {
  const log: string[] = []
  const answer = (v: unknown): unknown => (typeof v === 'function' ? (v as () => unknown)() : v)
  return {
    log,
    face: {
      open: async (walk: Rec) => { log.push(`open:${String(walk.callId)}`); return answer(opts.open ?? { kind: 'approved', grant: { grantId: 'g-1' } }) },
      edge: async (walk: Rec) => { log.push(`edge:${String(walk.callId)}`); return answer(opts.edge ?? { kind: 'allow', consumedProof: { grant: { grantId: 'g-1' } } }) },
      closePlan: (callId: string) => { log.push(`close:${callId}`) },
    },
  }
}

interface BuildOpts {
  declaredMount?: boolean
  native?: unknown
  seat?: ReturnType<typeof seat>
  placement?: unknown | (() => unknown)
  identity?: string | null
}

function build (opts: BuildOpts = {}) {
  const s = opts.seat ?? seat()
  const nativeDef = 'native' in opts ? opts.native : nativePwsh()
  let placements = 0
  const identity = opts.identity === undefined ? 'ident-pwsh-1' : opts.identity
  const wiring = buildPwshGovernedWiring({
    realmId: REALM,
    providerId: 'a5p5-plane',
    memberAgentId: AGENT_ID,
    sessionHeaderId: HEADER_ID,
    readNative: (name: string) => (name === 'pwsh' ? nativeDef : undefined),
    declaredMount: opts.declaredMount ?? true,
    jobsMounted: () => true,
    placementFeed: () => {
      placements += 1
      const p = 'placement' in opts ? opts.placement : { definitionIdentity: identity, realmId: REALM }
      return typeof p === 'function' ? (p as () => unknown)() : p
    },
    identityOf: () => identity,
    pa: s.face,
  } as never)
  return { wiring, s, calls: () => placements, nativeDef }
}

const exec = (callId: string, agentId: string = AGENT_ID): Rec => ({ callId, agent: { id: agentId } })

interface WiringOk { ok: true, familyId: string, adapterRevision: number, definitions: Rec[], placementNames: string[], declared: Array<Record<string, string>>, familyRegistrations: () => unknown, drain: () => unknown }
const okW = (w: unknown): WiringOk => w as WiringOk

describe('a5m2 governed pwsh mount (bridge law)', () => {
  it('(a) config law BOTH directions at the census: declared=false lands the honest DECLARED-INACTIVE row (no def, no placement, native untouched); declared=true + captured native arms exactly one row', () => {
    const off = build({ declaredMount: false })
    expect(off.wiring.ok).toBe(true)
    expect(okW(off.wiring).definitions).toHaveLength(0)
    expect(okW(off.wiring).placementNames).toHaveLength(0)
    expect(okW(off.wiring).declared[0]?.reason).toContain('MOUNT_NOT_DECLARED')
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
    expect((regs[0] as { definitionIdentity: string }).definitionIdentity).toBe('ident-pwsh-1')
    expect((regs[0] as { entry: Record<string, unknown> }).entry).toEqual({ familyId: PWSH_FAMILY_ID, adapterRevision: 1, providerIdentity: 'a5p5-plane' })
    const moved = build({ placement: () => ({ definitionIdentity: 'floats', realmId: REALM }) })
    expect(() => okW(moved.wiring).familyRegistrations()).toThrow(/does not float|PLACEMENT_KEY_MOVED/)
  })

  it('(f) no seat, no shell: a pa face missing open/edge/closePlan refuses the MOUNT with the typed seat code (never a duck)', () => {
    const wiring = buildPwshGovernedWiring({
      realmId: REALM,
      providerId: 'a5p5-plane',
      memberAgentId: AGENT_ID,
      sessionHeaderId: HEADER_ID,
      readNative: () => nativePwsh(),
      declaredMount: true,
      placementFeed: () => ({ definitionIdentity: 'i', realmId: REALM }),
      identityOf: () => 'i',
      pa: { open: () => undefined } as never,
    } as never)
    expect(wiring.ok).toBe(false)
    expect((wiring as { code?: string }).code).toBe('PWSH_WIRE_PA_SEAT_INVALID')
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
    expect(plane).toContain('...g3Defs, ...pwshDefs, ...g2Defs]')
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
  })
})
