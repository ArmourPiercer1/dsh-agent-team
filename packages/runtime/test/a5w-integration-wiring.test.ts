/**
 * a5w-integration-wiring — the G-d wiring slice for the ControlledFs lane
 * (integration session Scope-2; RED-first spec for `admission-binding.ts`).
 *
 * Pins the three C1 wiring notes (INTEGRATION-PLAN §4 / Lane B README §4) as
 * executable law, plus the compile-surface state and the G-g wording boundary:
 *
 *  1. GATED CONSUMPTION — the wiring factory NEVER defaults to the lane's
 *     pre-freeze `NO_RECHECK`: an unbound gated lane answers every operation
 *     with a typed C-FS `denied` refusal carrying `admission-unbound`, on the
 *     frozen §5 code (`TOOL_BINDING_UNVERIFIED`, PR0's own effect-outside-
 *     grant precedent) — no new code, no silence.
 *  2. FINGERPRINT BINDING — `bindAdmissionRecheck` presents the bound PR1
 *     canonical `parametersFingerprint` of THIS call to the admission port;
 *     a presented grant whose fingerprint diverges (or is null) is refused
 *     BEFORE the port is consulted (a re-resolved definition must never exec
 *     under another call's fingerprint).
 *  3. SUBTREE LAW — when the wiring consumer injects the authority-envelope
 *     `SubtreeContains`, the directory-effect decision runs through it; the
 *     lane's narrower identity+prefix rule survives untouched for consumers
 *     that do not wire the planes together.
 *  4. NO ARBITRARY-TREE PUBLICATION before `OpenAtPort` lands: the flag is
 *     pinned false and the wiring module carries no OpenAtPort
 *     implementation (Lane B README §2.3/§4.4; PR8 matrix updates ride the
 *     pending_update channel only).
 *  5. G-g boundary — wiring files carry NO silent-channel safety/closure
 *     claim; anything that mentions G-g cites it as OPEN (PENDING-GATES).
 *
 * Claims stay fixture-level (INTERFACES integration rule): this suite verifies
 * the wiring surface against fixtures — it is NOT a whole-chain claim.
 *
 * @module packages/runtime/test/a5w-integration-wiring
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ARBITRARY_TREE_PROFILE_PUBLISHED,
  bindAdmissionRecheck,
  createAdmissionGatedControlledFs,
  UNBOUND_ADMISSION_RECHECK,
  type ControlledFsLane,
  type FsAdmissionPort,
} from '../controlled-fs/src/index.js'
import { makeGrant, fileRef, dirRef, MEM_A, REALM, type Poc3World } from '../controlled-fs/test/poc3-harness.js'
import type { SubtreeContains } from '../../domain/authority-envelope/src/index.js'
import type { OperationGrant } from '../../domain/tool-governance/src/index.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const RUNTIME = resolve(HERE, '..')
const REPO_ROOT = resolve(RUNTIME, '..', '..')

// ---------------------------------------------------------------------------
// Fixture world under tests/homes/a5w-* (TEST_METHODS §7: destroyed in
// teardown; the a5p3 harness names its own worlds, this round owns a5w-*).
// ---------------------------------------------------------------------------

function stamp(): string {
  const iso = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  return `${iso}Z-${createHash('sha256').update(`${Date.now()}:${Math.random()}`).digest('hex').slice(0, 6)}`
}

function createWiringWorld(): Poc3World {
  const world = join(REPO_ROOT, 'tests', 'homes', `a5w-${stamp()}`)
  const ctrl = join(world, 'controlled')
  mkdirSync(join(ctrl, 'public', 'nested'), { recursive: true })
  mkdirSync(join(world, 'outside'), { recursive: true })
  mkdirSync(join(world, 'outside2'), { recursive: true })
  writeFileSync(join(ctrl, 'public', 'a.txt'), 'A-CONTENT\n') // SYNTHETIC
  return { world, ctrl, outside: join(world, 'outside'), outside2: join(world, 'outside2') }
}

let world: Poc3World

beforeAll(() => {
  world = createWiringWorld()
})

afterAll(() => {
  rmSync(world.world, { recursive: true, force: true }) // §7 teardown, nothing kept
})

const FULL = { offset: 0, limit: null } as const

const instances = () => [{ fs: 'ctl', rootDir: world.ctrl, realmId: REALM, kind: 'absolute-path' as const }]

function readGrantFor(rel: string): { grant: OperationGrant; ref: ReturnType<typeof fileRef> } {
  const ref = fileRef(world, rel, ['read'])
  return { grant: makeGrant({ member: MEM_A, effects: [{ kind: 'read', resource: ref }] }), ref }
}

interface PortCall {
  readonly op: string
  readonly canonicalLocator: string
  readonly parametersFingerprint: string
}

function spyPort(verdict: { readonly ok: true } | { readonly ok: false; readonly reason: string }): {
  readonly port: FsAdmissionPort
  readonly calls: PortCall[]
} {
  const calls: PortCall[] = []
  return {
    calls,
    port: {
      recheckCall: async (intent: PortCall) => {
        calls.push(intent)
        return verdict
      },
    },
  }
}

// ---------------------------------------------------------------------------
// Compile surface (shared tsconfigs are NOW the wiring gate — G-d duty 2)
// ---------------------------------------------------------------------------

describe('a5w compile surface', () => {
  it('the runtime typecheck tsconfig includes controlled-fs and sandbox-provider', () => {
    const raw = readFileSync(join(RUNTIME, 'tsconfig.json'), 'utf8')
    expect(raw).toContain('"controlled-fs"')
    expect(raw).toContain('"sandbox-provider"')
  })

  it('the runtime build tsconfig emits controlled-fs/src and sandbox-provider', () => {
    const raw = readFileSync(join(RUNTIME, 'tsconfig.build.json'), 'utf8')
    expect(raw).toContain('"controlled-fs/src"')
    expect(raw).toContain('"sandbox-provider"')
  })

  it('the provider factory is exported for EXPLICIT calls but wired into no live glue', async () => {
    const { createConfinedProcessProvider } = await import('../sandbox-provider/index.js')
    expect(typeof createConfinedProcessProvider).toBe('function')
    // DORMANT stays: nothing under runtime/src (the live-glue tree) imports it.
    const { readdirSync, statSync } = await import('node:fs')
    const offenders: string[] = []
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) {
          walk(full)
          continue
        }
        if (!/\.(mjs|ts)$/.test(entry) || entry.endsWith('.d.ts')) continue
        if (/createConfinedProcessProvider|sandbox-provider/.test(readFileSync(full, 'utf8'))) offenders.push(full)
      }
    }
    walk(join(RUNTIME, 'src'))
    expect(offenders).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// GATE 1 — unbound = typed refusal (the wiring face never inherits NO_RECHECK)
// ---------------------------------------------------------------------------

describe('a5w gate 1: unbound admission is a typed refusal, not a pass-through', () => {
  it('a gated lane with NO admission binding refuses reads with a typed C-FS denied', async () => {
    const lane: ControlledFsLane = createAdmissionGatedControlledFs({ instances: instances() })
    const { grant, ref } = readGrantFor('public/a.txt')
    const res = await lane.fs.readText(grant, ref, FULL)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.code).toBe('TOOL_BINDING_UNVERIFIED') // frozen §5 code — no new coinage
    expect(res.error.details?.['cfClass']).toBe('denied')
    expect(res.error.details?.['cfReason']).toBe('effect-outside-grant')
    expect(res.error.message).toContain('admission-unbound')
    const last = lane.ledger[lane.ledger.length - 1]
    expect(last?.stage).toBe('refused:denied:effect-outside-grant')
  })

  it('UNBOUND_ADMISSION_RECHECK itself always refuses and names itself', async () => {
    const v = await UNBOUND_ADMISSION_RECHECK.recheck({ op: 'read', canonicalLocator: '/x', parametersFingerprint: 'sha256:x' })
    expect(v).toEqual({ ok: false, reason: 'admission-unbound' })
  })
})

// ---------------------------------------------------------------------------
// GATE 2 — the recheck is bound to the PR1 canonical fingerprint (C1)
// ---------------------------------------------------------------------------

describe('a5w gate 2: AdmissionRecheck binds the PR1 parametersFingerprint (C1)', () => {
  it('happy leg: read passes; the port sees the grant fingerprint verbatim', async () => {
    const spy = spyPort({ ok: true })
    const { grant, ref } = readGrantFor('public/a.txt')
    const lane = createAdmissionGatedControlledFs({
      instances: instances(),
      admission: { admission: spy.port, parametersFingerprint: grant.parametersFingerprint },
    })
    const res = await lane.fs.readText(grant, ref, FULL)
    expect(res.ok && res.value.text).toBe('A-CONTENT\n')
    expect(spy.calls.length).toBe(1)
    expect(spy.calls[0]?.parametersFingerprint).toBe(grant.parametersFingerprint)
    expect(spy.calls[0]?.canonicalLocator).toBe(ref.canonicalLocator)
    expect(spy.calls[0]?.op).toBe('readText') // the seam names the INTERFACE op; C1 binds the fingerprint, not the op spelling
  })

  it('divergent binding: the intent fingerprint is refused BEFORE the port is consulted', async () => {
    const spy = spyPort({ ok: true })
    const { grant, ref } = readGrantFor('public/a.txt')
    const lane = createAdmissionGatedControlledFs({
      instances: instances(),
      admission: { admission: spy.port, parametersFingerprint: 'sha256:another-call' },
    })
    const res = await lane.fs.readText(grant, ref, FULL)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.message).toContain('fingerprint-divergence')
    expect(res.error.details?.['cfClass']).toBe('denied')
    expect(spy.calls.length).toBe(0) // never exec under another call's fingerprint
  })

  it('a null presented fingerprint cannot exec through a bound recheck', async () => {
    const spy = spyPort({ ok: true })
    const recheck = bindAdmissionRecheck({ admission: spy.port, parametersFingerprint: 'sha256:bound' })
    const v = await recheck.recheck({ op: 'read', canonicalLocator: '/x', parametersFingerprint: null })
    expect(v.ok).toBe(false)
    if (v.ok) return
    expect(v.reason).toContain('fingerprint-divergence')
    expect(spy.calls.length).toBe(0)
  })

  it('a port refusal passes through typed, with the port reason visible', async () => {
    const spy = spyPort({ ok: false, reason: 'grant-consumed-at-exec' })
    const { grant, ref } = readGrantFor('public/a.txt')
    const lane = createAdmissionGatedControlledFs({
      instances: instances(),
      admission: { admission: spy.port, parametersFingerprint: grant.parametersFingerprint },
    })
    const res = await lane.fs.readText(grant, ref, FULL)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.details?.['cfClass']).toBe('denied')
    expect(res.error.message).toContain('grant-consumed-at-exec')
  })
})

// ---------------------------------------------------------------------------
// GATE 3 — subtree law rides the injected SubtreeContains (C1)
// ---------------------------------------------------------------------------

describe('a5w gate 3: directory coverage runs through authority-envelope SubtreeContains', () => {
  function dirGrantOverPublic(): { grant: OperationGrant; file: ReturnType<typeof fileRef> } {
    const dir = dirRef(world, 'public', ['read'])
    const file = fileRef(world, 'public/a.txt', ['read'])
    return { grant: makeGrant({ member: MEM_A, effects: [{ kind: 'read', resource: dir }] }), file }
  }

  const realContainment: SubtreeContains = (root, child) =>
    child === root || child.startsWith(`${root.replace(/\/+$/, '')}/`)

  it('injected containment saying NO denies even where the lane prefix rule would cover', async () => {
    const spy = spyPort({ ok: true })
    const { grant, file } = dirGrantOverPublic()
    const lane = createAdmissionGatedControlledFs({
      instances: instances(),
      admission: { admission: spy.port, parametersFingerprint: grant.parametersFingerprint },
      subtreeContains: () => false,
    })
    const res = await lane.fs.readText(grant, file, FULL)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.details?.['cfReason']).toBe('effect-outside-grant')
    expect(spy.calls.length).toBe(0) // refused at the scope law, before the recheck
  })

  it('injected containment saying YES admits the subtree read', async () => {
    const spy = spyPort({ ok: true })
    const { grant, file } = dirGrantOverPublic()
    const lane = createAdmissionGatedControlledFs({
      instances: instances(),
      admission: { admission: spy.port, parametersFingerprint: grant.parametersFingerprint },
      subtreeContains: realContainment,
    })
    const res = await lane.fs.readText(grant, file, FULL)
    expect(res.ok && res.value.text).toBe('A-CONTENT\n')
  })

  it('the raw lane factory keeps its narrow lane rule untouched (zero behaviour drift)', async () => {
    const { createControlledFsLane } = await import('../controlled-fs/src/index.js')
    const { grant, file } = dirGrantOverPublic()
    const lane = createControlledFsLane({ instances: instances() })
    const res = await lane.fs.readText(grant, file, FULL)
    expect(res.ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// OpenAtPort boundary + G-g wording boundary
// ---------------------------------------------------------------------------

describe('a5w boundary pins', () => {
  it('arbitrary-tree profile is NOT published while OpenAtPort is unlanded', () => {
    expect(ARBITRARY_TREE_PROFILE_PUBLISHED).toBe(false)
    const wiring = readFileSync(join(RUNTIME, 'controlled-fs', 'src', 'admission-binding.ts'), 'utf8')
    // The wiring surface carries NO OpenAtPort implementation and no kernel claim.
    expect(wiring).not.toMatch(/openBeneath\s*[:=]/)
    expect(wiring).not.toMatch(/RESOLVE_(BENEATH|IN_ROOT)\s*[:=]/)
    const readme = readFileSync(join(RUNTIME, 'controlled-fs', 'README.md'), 'utf8')
    expect(readme).toMatch(/OpenAtPort/)
  })

  it('wiring files carry no G-g closure claim; G-g is cited OPEN only', () => {
    const files = [
      join(RUNTIME, 'controlled-fs', 'src', 'admission-binding.ts'),
      join(RUNTIME, 'controlled-fs', 'src', 'controlled-fs.ts'),
      join(RUNTIME, 'controlled-fs', 'src', 'open-at-exec.ts'),
    ]
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      expect(text, file).not.toMatch(/G-g\s*(?:CLOSED|closed|已关闭)/)
      expect(text, file).not.toMatch(/fail-closed\s*已证/)
      expect(text, file).not.toMatch(/silent[- ]channel\s*(?:safe|proven)/i)
      expect(text, file).not.toMatch(/静默通道[^。]{0,24}已证/)
      // Anything that DOES mention G-g cites the PENDING-GATES entry as OPEN.
      if (/G-g/.test(text)) {
        expect(/G-g OPEN/.test(text), file).toBe(true)
      }
    }
  })
})
