/**
 * A5M2-G3-PTC-RUNCODE — the single governed `run_code` row on the REAL
 * bytes (root 04:4x throughput card; the a5G3TerminalInject pattern, the
 * e78 handoff facts [A]-[E]).
 *
 * Legs:
 *  (a) CAPTURE PIN on the MEASURED host enum ([B]): the arm constructs on
 *      the real minted 2-target ESCALATION_TARGETS enum and THROWS on the
 *      3-member bridge vocabulary (the bytes pinned at
 *      sandbox/sandbox/src/escalation.ts:41 + core/tools/src/ptc.ts:110);
 *  (b) CLOSED input surface (unknown knob / duck pa refuse typed);
 *  (c) capture-absent = honest DECLARED-INACTIVE census (no def, no
 *      registration, native untouched — the 85 law);
 *  (d) FULL WALK SERVES: classify -> open -> edge -> consumedProof ->
 *      prepare -> execute; the CAPTURED BODY answer travels VERBATIM; the
 *      B-PTC family block rides the walk at FULL VALUE and is
 *      GRAMMAR-CLEAN against the PA closed table (the 闭表 pairing);
 *  (e) budget NOT_READY is the TYPED refusal, zero PA entry, zero body
 *      entry (the named blocker leg: no face -> no invented budget);
 *  (f) interpreter face absent -> P_PTC_TARGET_UNRESOLVED at classify;
 *  (g) the flat view passes an unrecognized manifest THROUGH unchanged;
 *  (h) registration keys ride the placement feed FRESH: absent THROWS,
 *      moved THROWS; entry carries the adapter's family bytes;
 *  (i) admission deny: typed refusal, closePlan still lands, body never
 *      runs;
 *  (j) P1 EVIDENCE (root consolidated run_code card): the bridge is PRESENT
 *      UNMOUNTED — the host unconditionally reserves `run_code` against
 *      registration/shadowing (639 core/tools/src/index.ts:1080-1081,
 *      quoted in the census evidence byte); the plane/bindings placement
 *      path is RETIRED (the sources carry no contribution); the census
 *      observation names the P1 on every mount story. The PA seat law is
 *      the REAL callable paAdmit shape (item 1): genuine seat accepted,
 *      garbage (plain-object duck, memberless function) refused.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-g3-ptc-wiring
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { definitionIdentityOf } from '../tool-dispatch/index.js'
import { validatePaFamilyTarget } from '../control/types.js'

const REALM = 'g3-ptc-realm'
const PROVIDER = 'g3-ptc-provider'
const MEMBER = 'agent-member-1'
const HEADER = 's-header-1'

const ADAPTER = (await import(new URL('../src/plugin/live/governed-families/g3-fsproc-adapters.mjs', import.meta.url).href)) as {
  createGovernedRunCodeArm: (deps: Record<string, unknown>) => unknown
  A5_G3_PTC_RUN_CODE_ESCALATION_TARGETS: readonly string[]
  A5_G3_PTC_TOTAL_DISPATCH_CAP_DISCLOSURE: string
}

type Definition = {
  name: string
  description: string
  parameters: unknown
  output: unknown
  execute: (args: Record<string, unknown>, exec: Record<string, unknown>) => Promise<unknown>
}

type Asm = {
  ok: boolean
  code?: string
  detail?: string
  definitions: Definition[]
  declared: Array<Record<string, unknown>>
  rows?: Record<string, unknown>
  drain?: () => unknown
  familyRegistrations: () => Array<{ name: string, definitionIdentity: string, entry: Record<string, unknown> }>
}

type GuardAsm = {
  ok: boolean
  code?: string
  detail?: string
  kind: string
  armed: boolean
  declared: Array<Record<string, unknown>>
  onPreExecute: ((exec: Record<string, unknown>, next: () => Promise<Record<string, unknown>>) => Promise<Record<string, unknown>>) | null
  familyRegistrations: () => Array<{ name: string, definitionIdentity: string, entry: Record<string, unknown> }>
  drain: () => Record<string, unknown>
  mount?: Record<string, string>
}

const PTC_WIRING = (await import(new URL('../src/plugin/live/governed-families/g3-ptc-wiring.mjs', import.meta.url).href)) as {
  buildG3RunCodeWiring: (input: Record<string, unknown>) => Asm
  buildG3RunCodeGuard: (input: Record<string, unknown>) => GuardAsm
  a5G3PtcPaTargetFlat: (manifest: Record<string, unknown>) => Record<string, unknown>
  A5_G3_RUN_CODE_TOOL_NAME: string
  A5_G3_PTC_WIRING_CODES: Record<string, string>
  A5_G3_PTC_MOUNT_STATUS: { mounted: boolean, code: string, evidence: string, nextShape: string }
  A5_G3_PTC_GUARD_STATUS: Record<string, string>
  A5_G3_PTC_GUARD_CODES: Record<string, string>
}
const CODES = PTC_WIRING.A5_G3_PTC_WIRING_CODES
const GUARD_CODES = PTC_WIRING.A5_G3_PTC_GUARD_CODES

/** The MEASURED host minted schema face (639 escalation.ts:41 via ptc.ts:110):
 *  the two escalation TARGETS — never the 3-member bridge ask vocabulary. */
const REAL_ENUM = ['workspace-write', 'danger-full-access']
const BRIDGE_ENUM = ['read-only', 'workspace-write', 'danger-full-access']

function makeNative (enumValue: readonly string[], calls: string[]): Definition {
  return {
    name: 'run_code',
    description: 'native run_code production description',
    // AUTHORED shape (the adapter's pin law reads the parameter faces
    // directly — same law as the lsp operation pin; g3ParameterEntries
    // keeps the authored top-level keys as the declared surface).
    parameters: {
      code: { type: 'string' },
      description: { type: 'string' },
      timeoutMs: { type: 'number' },
      sandbox_permissions: { type: 'string', enum: [...enumValue] },
      justification: { type: 'string' },
    },
    output: { schema: { type: 'object' }, render: (value: unknown) => JSON.stringify(value) },
    execute: async () => { calls.push('native-execute'); return 'NATIVE-TRANSPORT-ANSWER' },
  }
}

type Facts = {
  interpreter: { runtimeIdentity: string, language: string } | null
  effectiveEnvelope: { mode: string, enforcement: string }
  timeout: { defaultMs: number, maxMs: number }
  childChannel: {
    capabilityList: string[]
    channelDigest: string
    maxParallelSubCalls: number | null
    runDispatchBudget: number | null
  }
}

const GOOD_FACTS = (): Facts => ({
  interpreter: {
    runtimeIdentity: 'ptc-runtime:NodePtcRuntime:typescript:process',
    language: 'typescript',
  },
  effectiveEnvelope: {
    mode: 'workspace-write',
    enforcement: 'confine-unset (host sandbox default)',
  },
  timeout: { defaultMs: 120_000, maxMs: 600_000 },
  childChannel: {
    capabilityList: ['grep', 'read'],
    channelDigest: 'sha256:chan-1',
    maxParallelSubCalls: 10,
    runDispatchBudget: 64,
  },
})

interface WorldOpts {
  captureAbsent?: boolean
  nativeEnum?: readonly string[]
  facts?: (() => Record<string, unknown> | null) | null
  noFeed?: boolean
  movedFeed?: boolean
}

function makeWorld (opts: WorldOpts = {}) {
  const nativeCalls: string[] = []
  const natives = new Map<string, Definition>()
  if (opts.captureAbsent !== true) natives.set('run_code', makeNative(opts.nativeEnum ?? REAL_ENUM, nativeCalls))
  const seamReads: string[] = []
  const readNative = (name: string) => {
    seamReads.push(name)
    return natives.get(name)
  }
  const bindingFactsValue = { bindingId: 'a5p1:scope:run_code', bindingRevision: 1, policyGeneration: 0, authorityGeneration: 0 }
  const walks: Array<Record<string, unknown>> = []
  const closePlans: string[] = []
  let denyOpen = false
  // THE REAL PA SEAT SHAPE (root consolidated card item 1): the plane's own
  // paAdmit is an async FUNCTION carrying open / edge / closePlan as
  // properties (team-tool-plane :1992), passed through AS-IS — the double
  // mirrors THAT shape; a plain-object duck is GARBAGE the bridge must
  // refuse, never the other way round.
  const pa = Object.assign(async function paAdmitDouble () {
    return { kind: 'deny', code: 'DOUBLE_NOT_A_DIRECT_CALL', detail: 'spec world: the double is seated as the plane seats paAdmit; walks ride open/edge/closePlan' }
  }, {
    open: async (walk: Record<string, unknown>) => {
      walks.push(walk)
      if (denyOpen) return { kind: 'deny', code: 'ADMISSION_REFUSED', detail: 'spec world: the admission refused' }
      const grant = Object.freeze({
        grantId: `grant-${String(walks.length)}`,
        callId: walk.callId,
        realmId: walk.realmId,
        bindingId: bindingFactsValue.bindingId,
        bindingRevision: bindingFactsValue.bindingRevision,
        parametersFingerprint: walk.parametersFingerprint,
        singleUse: true,
      })
      return { kind: 'approved', grant }
    },
    edge: async (input: Record<string, unknown>) => ({ kind: 'allow', consumedProof: { grant: input.grant } }),
    closePlan: (callId: string) => { closePlans.push(callId) },
  })
  const placed = new Map<string, Definition>()
  const placementFeed = (name: string) => {
    if (opts.noFeed === true) return undefined
    const def = placed.get(name)
    if (def === undefined) return undefined
    const identity = definitionIdentityOf(def)
    if (identity === null) return undefined
    return Object.freeze({ definitionIdentity: opts.movedFeed === true ? `${identity}+moved` : identity, realmId: REALM })
  }
  const events: Array<Record<string, unknown>> = []
  const baseInput = {
    realmId: REALM,
    providerId: PROVIDER,
    memberAgentId: MEMBER,
    sessionHeaderId: HEADER,
    readNative,
    ptcFacts: opts.facts === null ? () => GOOD_FACTS() : opts.facts ?? GOOD_FACTS,
    bindingFacts: () => ({ ...bindingFactsValue }),
    placementFeed,
    identityOf: (def: unknown) => definitionIdentityOf(def),
    pa,
    observe: (event: Record<string, unknown>) => { events.push(event) },
  }
  const execFor = (callId: string) => Object.freeze({
    token: { t: callId },
    callId,
    agent: { id: MEMBER, session: { header: { id: HEADER } } },
  })
  const build = (over: Record<string, unknown> = {}) => {
    const asm = PTC_WIRING.buildG3RunCodeWiring({ ...baseInput, ...over })
    for (const definition of (asm.definitions ?? [])) placed.set(definition.name, definition)
    return asm
  }
  return {
    build, walks, closePlans, seamReads, events, pa, placed, nativeCalls,
    setDenyOpen: (v: boolean) => { denyOpen = v },
    execFor,
  }
}

const refusalOf = async (promise: Promise<unknown>) => {
  try {
    await promise
    return null
  } catch (error) {
    return error as Error & { code?: string }
  }
}

describe('A5M2-G3-PTC-RUNCODE — the governed run_code row on the REAL bytes', () => {
  it('(a) capture pin rides the MEASURED host enum: the real 2-target def constructs, the 3-member bridge pin THROWS ([B] resolution, pinned bytes)', async () => {
    expect(ADAPTER.A5_G3_PTC_RUN_CODE_ESCALATION_TARGETS).toEqual(REAL_ENUM)
    const nativeCalls: string[] = []
    const deps = (definition: Definition) => ({
      nativeDefinition: definition,
      definitionIdentity: 'def#1',
      liveDispatcher: () => ({ definitionIdentity: 'def#1', realmId: REALM }),
      providerId: PROVIDER,
      memberAgentId: MEMBER,
      sessionHeaderId: HEADER,
      realmId: REALM,
      bindingFacts: () => ({ bindingId: 'b', bindingRevision: 1, policyGeneration: 0, authorityGeneration: 0 }),
      ptcFacts: GOOD_FACTS,
    })
    expect(ADAPTER.createGovernedRunCodeArm(deps(makeNative(REAL_ENUM, nativeCalls)))).toBeTruthy()
    expect(() => ADAPTER.createGovernedRunCodeArm(deps(makeNative(BRIDGE_ENUM, nativeCalls)))).toThrow(/no longer matches the pinned/)
    // the BRIDGE vocabulary itself is UNTOUCHED (ptc-escalation-row face):
    const row = await import(new URL('../src/plugin/live/ptc-escalation-row.mjs', import.meta.url).href) as { PTC_ESCALATION_MODES: readonly string[] }
    expect(row.PTC_ESCALATION_MODES).toEqual(BRIDGE_ENUM)
  })

  it('(b) closed input surface: an unknown knob and a duck pa both refuse typed at assembly', () => {
    const w = makeWorld()
    const bad = w.build({ extraKnob: true })
    expect(bad.ok).toBe(false)
    expect(bad.code).toBe(CODES.INPUT_INVALID)
    const duck = PTC_WIRING.buildG3RunCodeWiring({
      realmId: REALM,
      providerId: PROVIDER,
      memberAgentId: MEMBER,
      sessionHeaderId: HEADER,
      readNative: () => undefined,
      ptcFacts: GOOD_FACTS,
      bindingFacts: () => ({ bindingId: 'b', bindingRevision: 1, policyGeneration: 0, authorityGeneration: 0 }),
      placementFeed: () => undefined,
      identityOf: () => 'def#1',
      pa: { ok: true },
    })
    expect(duck.ok).toBe(false)
    expect(duck.code).toBe(CODES.INPUT_INVALID)
    // GARBAGE also covers a MEMBERLESS function (item 1 law: the real seat
    // is a callable CARRYING open / edge / closePlan — the callable shape
    // alone never substitutes for the three faces).
    const memberless = PTC_WIRING.buildG3RunCodeWiring({
      realmId: REALM,
      providerId: PROVIDER,
      memberAgentId: MEMBER,
      sessionHeaderId: HEADER,
      readNative: () => undefined,
      ptcFacts: GOOD_FACTS,
      bindingFacts: () => ({ bindingId: 'b', bindingRevision: 1, policyGeneration: 0, authorityGeneration: 0 }),
      placementFeed: () => undefined,
      identityOf: () => 'def#1',
      pa: async () => ({ kind: 'deny' }),
    })
    expect(memberless.ok).toBe(false)
    expect(memberless.code).toBe(CODES.INPUT_INVALID)
  })

  it('(c) capture-absent is the honest DECLARED-INACTIVE census: no def, no registration, native untouched, drain safe', () => {
    const w = makeWorld({ captureAbsent: true })
    const asm = w.build()
    expect(asm.ok).toBe(true)
    expect(asm.definitions).toEqual([])
    expect(asm.declared).toHaveLength(1)
    expect(asm.declared[0]).toMatchObject({ name: 'run_code', status: 'DECLARED-INACTIVE', reason: 'capture-absent' })
    expect(asm.familyRegistrations()).toEqual([])
    const drain = asm.drain
    expect(drain, 'the assembly always carries the drain word').toBeTypeOf('function')
    expect(() => drain!()).not.toThrow()
    expect(w.seamReads).toEqual(['run_code'])
  })

  it('(d) FULL WALK SERVES: the captured body answer travels VERBATIM; the B-PTC family block rides FULL VALUE and is GRAMMAR-CLEAN against the PA closed table; closePlan lands', async () => {
    const w = makeWorld()
    const asm = w.build()
    const def = asm.definitions[0] as Definition
    const answer = await def.execute({ code: 'return 1', description: 'walk spec' }, w.execFor('exec-run-1'))
    expect(answer).toBe('NATIVE-TRANSPORT-ANSWER')
    expect(w.nativeCalls).toEqual(['native-execute'])
    expect(w.walks.length).toBe(1)
    expect(w.closePlans).toEqual(['exec-run-1'])
    expect(w.walks.length).toBe(1)
    const walk = w.walks[0] as Record<string, unknown>
    const family = walk.family as Record<string, unknown>
    expect(family.familyId).toBe('B-PTC')
    expect(family.providerIdentity).toBe(PROVIDER)
    const target = family.targetManifest as Record<string, unknown>
    expect(target.operation).toBe('program-run')
    expect(target.interpreterRuntimeIdentity).toBe('ptc-runtime:NodePtcRuntime:typescript:process')
    expect(target.envelopeMode).toBe('workspace-write')
    // ACTUAL mapping (root final limited ruling): a supplied observation is
    // the canonical-JSON STRING; the total-count cap carries the honest
    // NOT-IMPLEMENTED disclosure constant verbatim — never a fake number.
    expect(target.maxParallelSubCalls).toBe('10')
    expect(target.runDispatchBudget).toBe(ADAPTER.A5_G3_PTC_TOTAL_DISPATCH_CAP_DISCLOSURE)
    expect(target.requestedSandboxMode).toBeNull()
    expect(target.justificationDigest).toBeNull()
    // the 闭表 pairing: the flat view validates against the REAL table.
    expect(validatePaFamilyTarget('B-PTC', target)).toBeUndefined()
    // unknown family still denies above the table (the closed-table law).
    expect(validatePaFamilyTarget('B-NOPE', target)).toMatch(/no target structure/)
    expect(w.events.some((e) => e.event === 'g3-ptc-wire:served')).toBe(true)
  })

  it('(e) budget law = ACTUAL MAPPING (root final limited ruling): absence SERVES on the disclosure leaf; a GARBAGE supplied number refuses TYPED with zero PA entry and zero body entry; an absent child-channel ANSWER still refuses', async () => {
    // (e1) THE WITHDRAWAL PROVEN POSITIVE: the retired every-run refusal is
    // gone — an unobservable budget pair (nulls, the honest answer of a
    // world with no public face) SERVES, carrying the disclosure leaf.
    const wServe = makeWorld({
      facts: () => {
        const facts = GOOD_FACTS()
        facts.childChannel = { ...facts.childChannel, maxParallelSubCalls: null, runDispatchBudget: null }
        return facts
      },
    })
    const defServe = wServe.build().definitions[0] as Definition
    const servedValue = await defServe.execute({ code: 'return 1', description: 'face-less budget' }, wServe.execFor('exec-run-2'))
    expect(servedValue).toBe('NATIVE-TRANSPORT-ANSWER')
    expect(wServe.nativeCalls).toEqual(['native-execute'])
    expect(wServe.walks.length).toBe(1)
    // (e2) garbage NEVER passes: a supplied non-number budget refuses TYPED
    // before the PA seat, the body entered zero times.
    const wBad = makeWorld({
      facts: () => {
        const facts = GOOD_FACTS()
        facts.childChannel = { ...facts.childChannel, runDispatchBudget: 'four' as unknown as number }
        return facts
      },
    })
    const defBad = wBad.build().definitions[0] as Definition
    const errorBad = await refusalOf(defBad.execute({ code: 'return 1', description: 'garbage budget' }, wBad.execFor('exec-run-3')))
    expect(errorBad).not.toBeNull()
    expect(String(errorBad?.message)).toContain('P_PTC_ENVELOPE_UNEVIDENCED')
    expect(String(errorBad?.message)).toContain('runDispatchBudget')
    expect(wBad.walks.length).toBe(0)
    expect(wBad.nativeCalls).toEqual([])
    expect(wBad.closePlans).toEqual([])
    // (e3) M0's channel FACTS stay mandatory every run: the child-channel
    // ANSWER itself absent refuses P_PTC_TARGET_UNRESOLVED.
    const wNo = makeWorld({
      facts: () => ({ ...GOOD_FACTS(), childChannel: null }),
    })
    const defNo = wNo.build().definitions[0] as Definition
    const errorNo = await refusalOf(defNo.execute({ code: 'return 1', description: 'no channel answer' }, wNo.execFor('exec-run-4')))
    expect(errorNo).not.toBeNull()
    expect(String(errorNo?.message)).toContain('P_PTC_TARGET_UNRESOLVED')
    expect(wNo.walks.length).toBe(0)
  })

  it('(f) interpreter face absent answers TYPED P_PTC_TARGET_UNRESOLVED — no unattributed run, no PA entry', async () => {
    const w = makeWorld({
      facts: () => {
        const facts = GOOD_FACTS()
        return { ...facts, interpreter: null }
      },
    })
    const asm = w.build()
    const def = asm.definitions[0] as Definition
    const error = await refusalOf(def.execute({ code: 'return 1', description: 'no interpreter' }, w.execFor('exec-run-3')))
    expect(String(error?.message)).toContain('P_PTC_TARGET_UNRESOLVED')
    expect(w.walks.length).toBe(0)
    expect(w.nativeCalls).toEqual([])
  })

  it('(g) the flat view passes an unrecognized manifest THROUGH unchanged (nothing is invented)', () => {
    const alien = { operation: 'something-else', toolName: 'run_code' }
    expect(PTC_WIRING.a5G3PtcPaTargetFlat(alien)).toBe(alien)
    expect(PTC_WIRING.a5G3PtcPaTargetFlat({ operation: 'program-run' })).toEqual({ operation: 'program-run' })
  })

  it('(h) registration keys ride the placement feed FRESH: present pairs the adapter family bytes, absent THROWS, moved THROWS (MODULE law, kept with the UNMOUNTED bridge per (j) — no production mount rides it today)', () => {
    const w = makeWorld()
    const asm = w.build()
    const registrations = asm.familyRegistrations()
    expect(registrations).toHaveLength(1)
    expect(registrations[0]?.name).toBe('run_code')
    expect(registrations[0]?.definitionIdentity).toBe(definitionIdentityOf(asm.definitions[0] as Definition))
    expect(registrations[0]?.entry).toMatchObject({ familyId: 'B-PTC', providerIdentity: PROVIDER })

    const wNoFeed = makeWorld({ captureAbsent: false, noFeed: true })
    const asmNoFeed = wNoFeed.build()
    expect(() => asmNoFeed.familyRegistrations()).toThrow(CODES.PLACEMENT_KEY_ABSENT)

    const wMoved = makeWorld({ movedFeed: true })
    const asmMoved = wMoved.build()
    expect(() => asmMoved.familyRegistrations()).toThrow(CODES.PLACEMENT_KEY_MOVED)
  })

  it('(i) admission deny: typed refusal, closePlan still lands, the body never runs', async () => {
    const w = makeWorld()
    const asm = w.build()
    w.setDenyOpen(true)
    const def = asm.definitions[0] as Definition
    const error = await refusalOf(def.execute({ code: 'return 1', description: 'denied' }, w.execFor('exec-run-4')))
    expect(error?.code).toBe('ADMISSION_REFUSED')
    expect(w.nativeCalls).toEqual([])
    expect(w.closePlans).toEqual(['exec-run-4'])
  })

  it('(j) P1 EVIDENCE (root consolidated card): the mount census names the host-forbidden registration; the GENUINE callable seat is ACCEPTED, garbage refused (item 1)', () => {
    // THE P1, pinned: the host 639 reserves the name against registration
    // or shadowing — a placement arm would roll back the WHOLE plane at
    // the unified registration, so this bridge is PRESENT UNMOUNTED and
    // the status rides EVERY census observation. The quote is the host's
    // own byte (core/tools/src/index.ts:1080-1081, read at this baseline).
    const status = PTC_WIRING.A5_G3_PTC_MOUNT_STATUS
    expect(status.mounted).toBe(false)
    expect(status.code).toBe('P1-HOST-FORBIDDEN-REGISTRATION')
    expect(status.evidence).toContain('cannot be registered or shadowed')
    expect(status.evidence).toContain('PLANE_PLACEMENT_CONFLICT')
    expect(status.nextShape, 'the root-allowed shape interposes the EXISTING seams, never a shadow registration').toContain('tools/execute(next)')
    // the census observation carries the status — the declared path:
    const w = makeWorld({ captureAbsent: true })
    w.build()
    const declaredEvent = w.events.find((e) => e.event === 'g3-ptc-wire:declared')
    expect(declaredEvent).toBeDefined()
    expect((declaredEvent?.mount as Record<string, unknown>)?.code).toBe('P1-HOST-FORBIDDEN-REGISTRATION')
    // THE REAL SEAT SHAPE (item 1, root-measured): the plane's paAdmit is
    // a CALLABLE carrying the three faces — the GENUINE shape assembles
    // and serves (legs (d)-(i) all run on the function-shaped double
    // precisely because the check mirrors it); the plain-object duck and
    // the memberless function are garbage and refuse typed (leg (b)).
    const wReal = makeWorld()
    const asmReal = wReal.build()
    expect(asmReal.ok).toBe(true)
    expect(asmReal.definitions).toHaveLength(1)
    // THE RETIRED PLACEMENT PATH stays retired (the discovered fact is
    // pinned forward, not deleted): the plane carries NO runCode
    // contribution and the bindings NO inject — re-adding a placement
    // arm is RED until the seam card legitimately lands.
    const planeSrc = readFileSync(fileURLToPath(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href), 'utf8')
    const bindingsSrc = readFileSync(fileURLToPath(new URL('../src/plugin/live/agent-bindings.mjs', import.meta.url).href), 'utf8')
    expect(planeSrc).not.toContain('buildG3RunCodeWiring')
    expect(planeSrc).not.toContain('runCodeDefs')
    expect(bindingsSrc).not.toContain('a5G3RunCodeInject')
  })
})

// ── THE GUARD-SEAM ENTRY (root FINAL LIMITED ruling 2026-10-25): the WIRED
// shape — one scope-filtered `tools/pre-execute` listener over the PUBLIC
// seam; the reserved native is never registered, shadowed, or wrapped. ──
function makeGuardWorld (opts: { captureAbsent?: boolean, swapNativeAfterBuild?: boolean } = {}) {
  const nativeCalls: string[] = []
  const natives = new Map<string, Definition>()
  if (opts.captureAbsent !== true) natives.set('run_code', makeNative(REAL_ENUM, nativeCalls))
  const bindingFactsValue = { bindingId: 'a5p1:scope:run_code', bindingRevision: 1, policyGeneration: 0, authorityGeneration: 0 }
  const walks: Array<Record<string, unknown>> = []
  const closePlans: string[] = []
  let denyOpen = false
  const pa = Object.assign(async function paAdmitDouble () {
    return { kind: 'deny', code: 'DOUBLE_NOT_A_DIRECT_CALL' }
  }, {
    open: async (walk: Record<string, unknown>) => {
      walks.push(walk)
      if (denyOpen) return { kind: 'deny', code: 'ADMISSION_REFUSED', detail: 'spec world: the admission refused' }
      return {
        kind: 'approved',
        grant: Object.freeze({
          grantId: `grant-${String(walks.length)}`,
          callId: walk.callId,
          realmId: walk.realmId,
          bindingId: bindingFactsValue.bindingId,
          bindingRevision: bindingFactsValue.bindingRevision,
          parametersFingerprint: walk.parametersFingerprint,
          singleUse: true,
        }),
      }
    },
    edge: async (input: Record<string, unknown>) => ({ kind: 'allow', consumedProof: { grant: input.grant } }),
    closePlan: (callId: string) => { closePlans.push(callId) },
  })
  let nextCalls = 0
  const events: Array<Record<string, unknown>> = []
  const readNative = (name: string) => natives.get(name)
  const guard = PTC_WIRING.buildG3RunCodeGuard({
    realmId: REALM,
    providerId: PROVIDER,
    memberAgentId: MEMBER,
    sessionHeaderId: HEADER,
    readNative,
    ptcFacts: GOOD_FACTS,
    bindingFacts: () => ({ ...bindingFactsValue }),
    identityOf: (def: unknown) => definitionIdentityOf(def),
    pa,
    observe: (event: Record<string, unknown>) => { events.push(event) },
  })
  const allowNext = async () => {
    nextCalls += 1
    return { kind: 'allow' } as Record<string, unknown>
  }
  const execFor = (over: Record<string, unknown> = {}) => Object.freeze({
    name: 'run_code',
    callId: 'g-call-1',
    arguments: { code: 'return 1', description: 'guard leg' },
    agent: { id: MEMBER, session: { header: { id: HEADER } } },
    ...over,
  })
  return {
    guard,
    events,
    walks,
    closePlans,
    nativeCalls,
    nextCalls: () => nextCalls,
    allowNext,
    execFor,
    refuseAtOpen: () => { denyOpen = true },
    swapNative: () => {
      const fresh = makeNative(REAL_ENUM, nativeCalls)
      natives.set('run_code', Object.assign(Object.create(Object.getPrototypeOf(fresh)), fresh))
    },
    readNative,
  }
}

describe('A5M2-G3-PTC-GUARD — the wired run_code interposition (root final limited ruling)', () => {
  it('(k) scope filter: every NON-matching call passes through next() byte-untouched (zero walk, zero PA)', async () => {
    const w = makeGuardWorld()
    const onPre = w.guard.onPreExecute
    expect(onPre).toBeTypeOf('function')
    const fn = onPre as NonNullable<GuardAsm['onPreExecute']>
    expect(await fn(w.execFor({ name: 'grep' }), w.allowNext)).toEqual({ kind: 'allow' })
    expect(await fn(w.execFor({ agent: { id: 'agent-other' } }), w.allowNext)).toEqual({ kind: 'allow' })
    expect(w.nextCalls()).toBe(2)
    expect(w.walks.length).toBe(0)
    expect(w.closePlans).toEqual([])
  })

  it('(l) matching call: classify -> open -> edge ONE consume -> prepare -> next() runs ONCE and its decision travels VERBATIM; the plan closes once', async () => {
    const w = makeGuardWorld()
    const fn = w.guard.onPreExecute as NonNullable<GuardAsm['onPreExecute']>
    const decision = await fn(w.execFor(), w.allowNext)
    expect(decision).toEqual({ kind: 'allow' })
    expect(w.nextCalls()).toBe(1)
    expect(w.walks.length).toBe(1)
    expect(w.closePlans).toEqual(['g-call-1'])
    const family = ((w.walks[0] as Record<string, unknown>).family as Record<string, unknown>).targetManifest as Record<string, unknown>
    expect(family.operation).toBe('program-run')
    expect(family.runDispatchBudget).toBe(ADAPTER.A5_G3_PTC_TOTAL_DISPATCH_CAP_DISCLOSURE)
    expect(w.events.some((e) => e.event === 'g3-ptc-wire:guard-mounted')).toBe(true)
    expect(w.events.some((e) => e.event === 'g3-ptc-wire:guard-allowed')).toBe(true)
    // the ledger key is the RESERVED NATIVE's own identity — NO definition
    // is placed, NO name is registered by the guard assembly.
    const regs = w.guard.familyRegistrations()
    expect(regs).toHaveLength(1)
    expect(regs[0]?.definitionIdentity).toBe(definitionIdentityOf(w.readNative('run_code') as object))
    expect(JSON.stringify(Object.keys(w.guard))).not.toContain('definitions')
  })

  it('(m) refusal BEFORE next(): a denied admission returns the typed deny with the next() face NEVER CALLED (zero body entry) and one plan close', async () => {
    const w = makeGuardWorld()
    w.refuseAtOpen()
    const fn = w.guard.onPreExecute as NonNullable<GuardAsm['onPreExecute']>
    const decision = await fn(w.execFor(), w.allowNext)
    expect(decision.kind).toBe('deny')
    expect(String(decision.reason)).toContain('ADMISSION_REFUSED')
    expect(w.nextCalls()).toBe(0)
    expect(w.closePlans).toEqual(['g-call-1'])
  })

  it('(n) capture absent: armed=false, NO listener face, the DECLARED-INACTIVE census names the reason, registrations stay empty', () => {
    const w = makeGuardWorld({ captureAbsent: true })
    expect(w.guard.ok).toBe(true)
    expect(w.guard.armed).toBe(false)
    expect(w.guard.onPreExecute).toBeNull()
    expect(w.guard.declared[0]).toMatchObject({ name: 'run_code', status: 'DECLARED-INACTIVE', reason: 'capture-absent' })
    expect(w.guard.familyRegistrations()).toEqual([])
    expect(w.events.some((e) => e.event === 'g3-ptc-wire:guard-declared')).toBe(true)
  })

  it('(o) token replay: the SAME execution token never opens a second admission walk (typed deny, zero next())', async () => {
    const w = makeGuardWorld()
    const fn = w.guard.onPreExecute as NonNullable<GuardAsm['onPreExecute']>
    const sharedToken = { t: 'transport-1' }
    expect((await fn(w.execFor({ token: sharedToken }), w.allowNext)).kind).toBe('allow')
    const replay = await fn(w.execFor({ token: sharedToken }), w.allowNext)
    expect(replay.kind).toBe('deny')
    expect(String(replay.reason)).toContain(GUARD_CODES.TOKEN_REPLAY)
    expect(w.walks.length).toBe(1)
    expect(w.nextCalls()).toBe(1)
  })

  it('(p) drain: the word is a new-call prohibition — later matching calls refuse TYPED and the reserved native is never reached', async () => {
    const w = makeGuardWorld()
    const fn = w.guard.onPreExecute as NonNullable<GuardAsm['onPreExecute']>
    expect((await fn(w.execFor(), w.allowNext)).kind).toBe('allow')
    w.guard.drain()
    const after = await fn(w.execFor({ callId: 'g-call-2' }), w.allowNext)
    expect(after.kind).toBe('deny')
    expect(String(after.reason)).toContain(GUARD_CODES.DRAINED)
    expect(w.nextCalls()).toBe(1)
  })

  it('(q) identities do not float: a MOVED reserved-native identity THROWS at the registration read (never a guessed key)', () => {
    const w = makeGuardWorld({ swapNativeAfterBuild: true })
    w.swapNative()
    expect(() => w.guard.familyRegistrations()).toThrow(GUARD_CODES.KEY_MOVED)
  })

  it('(r) status honesty: the PLACEMENT entry stays UNMOUNTED forever; the GUARD entry carries the registration ban and the untouched-native face verbatim', () => {
    expect(PTC_WIRING.A5_G3_PTC_MOUNT_STATUS.mounted).toBe(false)
    expect(PTC_WIRING.A5_G3_PTC_GUARD_STATUS.registrationBan).toContain('1080-1081')
    expect(PTC_WIRING.A5_G3_PTC_GUARD_STATUS.tier).toContain('WIRED-NOT-TESTED')
    expect(PTC_WIRING.A5_G3_PTC_GUARD_STATUS.nativeUntouched).toContain('660')
    const guardSrc = readFileSync(fileURLToPath(new URL('../src/plugin/live/governed-families/g3-ptc-wiring.mjs', import.meta.url).href), 'utf8')
    // the guard entry NEVER touches the placement/registration surfaces
    const guardSection = guardSrc.slice(guardSrc.indexOf('export function buildG3RunCodeGuard'))
    expect(guardSection).not.toContain('placementFeed')
    expect(guardSection).not.toContain('definitions.push')
  })
})
