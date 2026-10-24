/**
 * A5M2-RSJ SURFACE lane — record `surface:neg4_preset_selfregister`
 * (B-ISOLATION, M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX recordIndex 92; matrix
 * NEG-4 "Preset/Team 自注册覆盖", historical bind-diag ABSTAIN — this slice
 * moves the AUTHOR-SIDE capture law from ABSTAIN to VERIFIED, and no claim
 * here says otherwise). Scoped by the root's M0 no-master assignment
 * (CENTER relay 2026-10-23) as the author-side REAL REJECTION verification:
 * typed refusals + ZERO durable writes on a REAL medium, Host NEVER started.
 *
 * The family fact under test (record note, verbatim): "preset-realm never
 * reached global tools.schemas()". Its executable shape at the Team lane is
 * the closed-world trio the assembly actually runs:
 *  V1 the ROW REGISTRAR refuses invented registrations and spoofed faces
 *     (the committed G1 mount law: frozen name set, same-native-face law) —
 *     while KNOWN names still mount (a blanket refusal would prove nothing);
 *  V2 the PLANE NAME LAW (`verifyPlaneNames`, the committed exported gate):
 *     closed classes, one-name-one-placement, unsupported reserved-native
 *     claims refused — the positive alias map still passes;
 *  V3 the CLOSED-WORLD GUARD (`installScopedToolGuard`, the committed
 *     tool-dispatch lane) over a faithful registry double (a5p1 pattern,
 *     measured: guard stage before the waterfall, before the Body):
 *     a tool that self-registers into the AGENT scope after publish — the
 *     exact shape of a preset-realm registration that "never reached the
 *     global view" — is bound UNVERIFIED and REFUSED AT DISPATCH, loudly,
 *     while the known allowed tool still runs (C2 law: dynamic unknown
 *     cannot run, known allowed still can — 全 deny 不算);
 *  V4 ZERO DURABLE WRITES on the real FileStorageSeam medium: the whole
 *     negative trio leaves writeCount and every family file byte-identical,
 *     and a liveness contrast (one real PRE-TEAM ledger append) proves the
 *     zero is meaningful, not an idle medium.
 *
 * DISCLOSURES (honest labels): the Host registry is driven as the measured
 * double above (the guard itself is the real committed module); no Host
 * process, no network, no boot. The boot-time profile/patch loader behavior
 * of the 639 host is NOT exercised here (no Host is started) — this slice
 * verifies the Team-side capture law of the record, not the loader YAML
 * parser. NOT C2; claims no C2.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-verify-surface-neg4-preset-selfregister
 */
import { describe, expect, it, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { fileURLToPath, URL as NodeURL } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { installScopedToolGuard, type ScopedGuardAgentCtx } from '../tool-dispatch/index.js'
import { createTeamDomain } from '../../storage/repositories/index.js'
import { TEAM_DOMAIN_STORES } from '../../storage/schema/index.js'
import { FileStorageSeam } from '../../testkit/fault-injection/file-seam.mjs'

type G1Module = {
  mountG1SurfaceAdapter: (recordName: string, deps?: Record<string, unknown>) => unknown
}
type PlaneModule = {
  verifyPlaneNames: (names: Record<string, unknown>, readName: unknown) => { ok: boolean; code?: string; message?: string }
}
type SeamWriteFace = { writeCount: number }

const G1 = (await import(new URL('../src/plugin/live/governed-families/g1-surface-adapters.mjs', import.meta.url).href)) as G1Module
const PLANE = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as PlaneModule

// 639 read-only base: the family law this record carries is stated in the
// committed glue as an observable fact — read it from disk (fail closed).
const GLUE_SOURCE = readFileSync(fileURLToPath(new NodeURL('../src/plugin/live/agent-bindings.mjs', import.meta.url)), 'utf8')

const TRUSTED = {
  memberAgentId: 'agent-member-n4',
  sessionHeaderId: 'session-header-n4',
  realmId: 'realm-n4',
  owner: 'owner-n4',
  profileId: 'profile-n4',
}
const BINDINGS = () => ({ bindingId: 'binding-n4', bindingRevision: 1, policyGeneration: 1, authorityGeneration: 1 })

function g1Mount(name: string, native: Record<string, unknown> | undefined): unknown {
  return G1.mountG1SurfaceAdapter(name, {
    ...(native === undefined ? {} : { native }),
    providerId: 'rsj-surface',
    definitionIdentity: 'def-n4-1',
    trusted: TRUSTED,
    bindingFacts: BINDINGS,
    ports: {},
  })
}

// ── faithful registry double (a5p1 measured pattern: guard stage FIRST, ─────
// ── before waterfalls and Body; the waterfall stages are not needed for ─────
// ── deny-at-guard / pass-through legs and are honestly omitted) ─────────────
function makeHost(options: { surface: string[]; globalSurface: string[] }) {
  const surface = [...options.surface]
  const globalSurface = [...options.globalSurface]
  const defs = new Map<string, { name: string; execute: () => string }>()
  const gdefs = new Map<string, { name: string; execute: () => string }>()
  const defOf = (name: string): { name: string; execute: () => string } | undefined => {
    const known = defs.get(name)
    if (known !== undefined) return known
    if (!surface.includes(name)) return undefined
    const row = { name, execute: () => `def:${name}` }
    defs.set(name, row)
    return row
  }
  const globalDefOf = (name: string): { name: string; execute: () => string } | undefined => {
    const known = gdefs.get(name)
    if (known !== undefined) return known
    if (!globalSurface.includes(name)) return undefined
    const agreed = defOf(name)
    if (agreed === undefined) return undefined
    gdefs.set(name, agreed)
    return agreed
  }
  const guards: ((exec: { name: string; agent?: unknown }) => string | undefined)[] = []
  const listeners = new Map<string, ((...args: never[]) => unknown)[]>()
  const ctx = {
    tools: {
      guard: (guardFn: (exec: { name: string; agent?: unknown }) => string | undefined) => {
        guards.push(guardFn)
        return () => {
          const at = guards.indexOf(guardFn)
          if (at >= 0) guards.splice(at, 1)
        }
      },
      schemas: (scope?: unknown) => (scope === undefined
        ? globalSurface.map((name) => ({ name }))
        : surface.map((name) => ({ name }))),
      get: (name: string, scope?: unknown) => (scope === undefined ? globalDefOf(name) : defOf(name)),
    },
    on: (event: string, listener: (...args: never[]) => unknown) => {
      const list = listeners.get(event) ?? []
      list.push(listener)
      listeners.set(event, list)
      return () => {
        const at = list.indexOf(listener)
        if (at >= 0) list.splice(at, 1)
      }
    },
  } as unknown as ScopedGuardAgentCtx
  return {
    ctx,
    surface,
    globalSurface,
    listeners,
    /** A preset-realm SELF-REGISTRATION: the name enters THIS agent's scope
     *  only — the global public view never sees it (the family fact, driven
     *  as an attack). */
    selfRegister: (name: string): void => {
      surface.push(name)
      defs.set(name, { name, execute: () => 'PRESET_BODY_RAN' })
      for (const listener of listeners.get('tools/change') ?? []) (listener as () => void)()
    },
    /** Run one call the way the measured registry does: guard chain first —
     *  a denial skips the Body entirely (a5p1-order-hazard measurement). */
    runExecute: async (input: { callId: string; name: string }, body: () => Promise<unknown>): Promise<unknown> => {
      const exec = { ...input, agent: { id: 'agent-n4' } }
      for (const guardFn of [...guards]) {
        const denial = guardFn(exec)
        if (denial !== undefined) throw new Error(denial)
      }
      return await body()
    },
  }
}

function installGuard(host: ReturnType<typeof makeHost>) {
  const outcome = installScopedToolGuard({
    agentCtx: host.ctx,
    runtimeAgent: { id: 'agent-n4', session: { header: { id: 'session-n4' } } },
    agentScopeKey: 'session-n4',
    trustedIdentities: ['session-n4', 'agent-n4'],
    // What the real assembly passes: a name is native only if the GLOBAL
    // public view also shows it.
    nativeNames: host.globalSurface,
  })
  if (!outcome.ok) throw new Error(`guard install refused: ${outcome.error.message}`)
  return outcome.value
}

// ── the real durable medium for the zero-write claim (+ liveness contrast) ──
const SCRATCH = mkdtempSync(join(tmpdir(), 'a5m2-n4-'))
const seam = new FileStorageSeam(join(SCRATCH, 'seam')) as unknown as SeamWriteFace & { closeAll(): Promise<void> }
const domain = await createTeamDomain(seam as never)

function familyDigest(): string {
  const hash = createHash('sha256')
  for (const store of TEAM_DOMAIN_STORES) {
    const f = join(SCRATCH, 'seam', 'team_domain', `${store}.json`)
    hash.update(store).update(':').update(existsSync(f) ? createHash('sha256').update(readFileSync(f)).digest('hex') : '<absent>')
  }
  return hash.digest('hex')
}

afterAll(async () => {
  try { await domain.close() } catch { /* closed */ }
  try { await seam.closeAll() } catch { /* closed */ }
  try { rmSync(SCRATCH, { recursive: true, force: true }) } catch { /* scratch */ }
})

describe('a5m2 surface:neg4_preset_selfregister (B-ISOLATION) — author-side real rejection, typed refusals, zero durable writes (no Host, NOT C2)', () => {
  it('V1 row registrar: invented registrations and spoofed faces die typed at the mount; KNOWN names still mount', () => {
    // dynamic UNKNOWN registration — refused, no guessed names:
    expect(() => g1Mount('preset_self_tool', { name: 'preset_self_tool', description: 'i registered myself' })).toThrow(TypeError)
    // same-name SPOOF: an invented record cannot mount under a known name's
    // face law either — the capture must be the SAME native face:
    expect(() => g1Mount('team_list_pending_control', { name: 'team_something_else', description: 'spoof' })).toThrow(/SAME native face/)
    expect(() => g1Mount('team_list_pending_control', { name: 'team_list_pending_control' })).toThrow(/SAME native face|description/)
    // POSITIVE (known allowed still mounts — a blanket refusal proves nothing):
    expect(() => g1Mount('team_list_pending_control', {
      name: 'team_list_pending_control',
      description: 'read the Team pending-control queue',
    })).not.toThrow()
  })

  it('V2 plane name law (real verifyPlaneNames): closed classes, one name one placement, reserved-native claims refused; the valid map passes', () => {
    expect(PLANE.verifyPlaneNames({ grep: 'team_grep', glob: 'team_glob', bash: 'team_bash' }, 'read').ok).toBe(true)
    const inventedClass = PLANE.verifyPlaneNames({ grep: 'team_grep', glob: 'team_glob', bash: 'team_bash', preset: 'preset_self_tool' } as never, 'read')
    expect(inventedClass.ok).toBe(false)
    expect(inventedClass.code).toBe('PLANE_NAMES_INVALID')
    const doubleClaim = PLANE.verifyPlaneNames({ grep: 'team_search', glob: 'team_search', bash: 'team_bash' }, 'read')
    expect(doubleClaim.ok).toBe(false)
    expect(doubleClaim.message ?? '').toContain('one name, one placement')
    const reservedHijack = PLANE.verifyPlaneNames({ grep: 'team_grep', glob: 'team_glob', bash: 'read' }, 'read')
    expect(reservedHijack.ok).toBe(false)
    expect(reservedHijack.code).toBe('PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED')
    const badShape = PLANE.verifyPlaneNames({ grep: 'Team-Grep', glob: 'team_glob', bash: 'team_bash' }, 'read')
    expect(badShape.ok).toBe(false)
    expect(badShape.code).toBe('PLANE_NAMES_INVALID')
  })

  it('V3 closed-world guard: a preset-realm self-registration (agent scope only, global view never sees it) is refused AT DISPATCH, loudly, while the known allowed tool still runs', async () => {
    const host = makeHost({ surface: ['read', 'bash'], globalSurface: ['read', 'bash'] })
    const handle = installGuard(host)
    expect(handle.publish().ok).toBe(true)
    // The SELF-REGISTRATION: after publish, a preset-realm name enters the
    // agent surface; the global public view never shows it (family fact).
    host.selfRegister('preset_self_tool')
    const toolsFace = host.ctx as unknown as { tools: { schemas: (s?: unknown) => Array<{ name: string }> } }
    expect(toolsFace.tools.schemas(undefined).some((s) => s.name === 'preset_self_tool')).toBe(false)
    expect(toolsFace.tools.schemas('agent-n4').some((s) => s.name === 'preset_self_tool')).toBe(true)
    let ran = false
    const denial = await host.runExecute({ callId: 'n4-1', name: 'preset_self_tool' }, async () => { ran = true; return 'BODY' }).catch((e: unknown) => String((e as Error).message))
    expect(typeof denial).toBe('string')
    expect(String(denial)).toContain('team tool guard')
    expect(ran).toBe(false)
    // loud, not silent: the post-publish self-registration is BOUND UNBOUND-
    // OBSERVED and reported (the tools/change handler names it), never swallowed.
    expect(handle.observations().some((o: { event?: string }) =>
      /unverified|tools-change-unbound-names/.test(String(o?.event ?? ''))
      && JSON.stringify(o).includes('preset_self_tool'))).toBe(true)
    // inheritance positive (dynamic unknown cannot run — known allowed CAN):
    let knownRan = false
    const known = await host.runExecute({ callId: 'n4-2', name: 'read' }, async () => { knownRan = true; return 'RAN' })
    expect(known).toBe('RAN')
    expect(knownRan).toBe(true)
  })

  it('V4 zero durable writes on the REAL medium: the whole negative trio leaves writeCount and every family file byte-identical; one real PRE-TEAM append proves the medium live', async () => {
    const ledger = (domain.repositories as { ledger: { putPreTeam(e: unknown): Promise<unknown>; allocateSequence(): Promise<number>; list(): unknown[] } }).ledger
    // run the trio AGAIN here so the zero is measured over exactly these legs
    const writeBefore = seam.writeCount
    const digestBefore = familyDigest()
    expect(() => g1Mount('preset_self_tool_again', { name: 'preset_self_tool_again', description: 'x' })).toThrow(TypeError)
    expect(PLANE.verifyPlaneNames({ grep: 'a', glob: 'a', bash: 'team_bash' }, 'read').ok).toBe(false)
    const host = makeHost({ surface: ['read'], globalSurface: ['read'] })
    const handle = installGuard(host)
    expect(handle.publish().ok).toBe(true)
    host.selfRegister('preset_self_tool')
    await host.runExecute({ callId: 'n4-z', name: 'preset_self_tool' }, async () => 'BODY').catch(() => undefined)
    expect(seam.writeCount).toBe(writeBefore)
    expect(familyDigest()).toBe(digestBefore)
    // liveness contrast: the same medium DOES take a real durable write.
    const seq = await ledger.allocateSequence()
    await ledger.putPreTeam({
      schemaVersion: 2,
      sequence: seq,
      rootSessionId: 'session-n4-scratch',
      factType: 'control-request-recorded',
      payload: { requestId: 'n4-contrast' },
      createdAt: new Date().toISOString(),
    })
    expect(seam.writeCount).toBeGreaterThan(writeBefore)
    expect(familyDigest()).not.toBe(digestBefore)
    expect(ledger.list()).toHaveLength(1)
  })

  it('V5 family law read-anchor: the committed glue states the guard law this slice exercised (E2→E1 for this lane)', () => {
    expect(GLUE_SOURCE).toContain('no name is inherited as native; every inherited tool is bound UNVERIFIED and refused at dispatch')
    expect(GLUE_SOURCE).toContain('the closed-world Guard is armed on this agent\'s scope BEFORE the')
  })
})
