/**
 * A5M2-G3-TERMINAL-WIRING — the spec of the B-TERMINAL PRODUCTION WIRING
 * BRIDGE (`governed-families/g3-terminal-wiring.mjs`). The G6 wiring-spec
 * discipline verbatim: the BRIDGE is the unit under test; the REAL pieces
 * used here are the committed G3 family adapter (imported as-is — its own
 * 42-leg spec owns the §5.1 engine halves), the pb §6 identity mint
 * (`definitionIdentityOf`), the production family-registry ENTRY bytes, the
 * published rules-gate checkers (control/types.ts), and the REAL pinned-639
 * TerminalBackendCleanupError class read from the READ-ONLY pristine Host
 * checkout (tests/deepseek-harness-test-use @639ed01539 — the same file the
 * live service imports; the checkout is a symlink to the shared pristine
 * objects, never written, zero copy).
 *
 * DISCLOSED STAND-INS (NOT C2 — no Host, no ports, no tests/homes, no
 * network): the six native faces are recorded doubles in the host defineTool
 * shape (the COMPILED parameters surface, per root 19:25 — constraints are
 * the adapter's, never hand-mirrored here); the `pa` seat is a recording
 * double obeying the real paAdmit open/edge/closePlan CONTRACT SHAPE (the
 * plane-mount C1 spec rides the REAL seat); the terminals service, the
 * subprocess capability and the session factory are recording doubles — the
 * adapter spec owns the faithful LocalPtySession double.
 *
 * Legs:
 *  (a) CLOSED input surface + THE REAL SEAT law (a duck is refused by name);
 *  (b) ONE CAPTURE per native name; the honest DECLARED-INACTIVE census;
 *  (c) placement-moment identity bind (the SAME def object; an unbound seam
 *      THROWS — never a silent null);
 *  (d) the FULL WALK serves: classify -> open -> edge -> demanded one-shot
 *      consumedProof -> arm -> the PORT's answer travels VERBATIM; the
 *      family block rides the walk at FULL VALUE (载荷法); closePlan lands
 *      on every path;
 *  (e) refusals before the arm enter NOTHING: deny at open, a missing
 *      consume witness, an absent call identity — zero port entries each;
 *  (f) registration keys are the placement feed's RUNTIME identities —
 *      a silent feed THROWS (ABSENT), a moved feed THROWS (MOVED);
 *  (g) dispose law: drain is the adapter's DRAINING new-call prohibition;
 *  (h) 同Host错误类: the REAL pinned-639 TerminalBackendCleanupError bytes
 *      are pinned from the published face, and a startup+cleanup failure
 *      crosses the row as `instanceof` THAT class (never a re-wrapped word);
 *  (i) grammar fail-closed: the B-TERMINAL typed plan measured against the
 *      REAL published checkers — the exact measured refusal bytes are
 *      pinned, never a invented kind.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-g3-terminal-wiring
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { definitionIdentityOf } from '../tool-dispatch/index.js'
import { isLosslessJsonValue, validatePaFamilyTarget } from '../control/types.js'

const REALM = 'g3-wire-realm'
const PROVIDER = 'g3-wire-provider'
const MEMBER = 'agent-member-1'
const HEADER = 's-header-1'

interface Built {
  ok: boolean
  code?: string
  detail?: string
  definitions?: Definition[]
  declared?: Array<Record<string, unknown>>
  drain?: () => Record<string, unknown>
  familyRegistrations?: () => Array<{ name: string, definitionIdentity: string, entry: Record<string, unknown> }>
}
type Definition = {
  name: string
  description: string
  parameters: unknown
  output: unknown
  execute: (args: Record<string, unknown>, exec: Record<string, unknown>) => Promise<unknown>
}

const WIRING = (await import(new URL('../src/plugin/live/governed-families/g3-terminal-wiring.mjs', import.meta.url).href)) as {
  buildG3TerminalWiring: (input: Record<string, unknown>) => Built
  a5G3PaTargetFlat: (manifest: Record<string, unknown>) => Record<string, unknown>
  A5_G3_TERMINAL_TOOL_NAMES: readonly string[]
  A5_G3_TERMINAL_WIRING_CODES: Record<string, string>
}
const CODES = WIRING.A5_G3_TERMINAL_WIRING_CODES
const TOOL_NAMES = WIRING.A5_G3_TERMINAL_TOOL_NAMES

// THE REAL CLASS (root 414, 同Host): read from the READ-ONLY pristine Host
// checkout pinned at 639ed01539 — the very file the live TerminalSession-
// Service imports (terminal/src/index.ts:9). The path resolves through the
// worktree's tests/deepseek-harness-test-use (a SYMLINK to the shared
// pristine checkout — the main tree's own clean @639ed01539 objects, never
// written; zero copy, zero install, capacity-disclosed).
type RealCleanupErrorCtor = new (spawnError: unknown, cleanupError: unknown) => AggregateError & { spawnError: unknown, cleanupError: unknown, name: string }
const RealCleanupError = ((await import(new URL('../../../tests/deepseek-harness-test-use/packages/terminal/terminal/src/types.ts', import.meta.url).href)) as { TerminalBackendCleanupError: RealCleanupErrorCtor }).TerminalBackendCleanupError

/** The COMPILED parameters faces (the REAL defineTool product shape — the
 *  adapter's g3ParameterEntries law reads `properties`; nothing here is a
 *  hand-mirrored constraint set: every semantic check lives in the adapter). */
const PARAMS: Record<string, Record<string, unknown>> = {
  terminal_open: { type: 'object', properties: { type: { type: 'string' }, name: { type: 'string' }, cwd: { type: 'string' } }, required: ['type'], additionalProperties: false },
  terminal_send: { type: 'object', properties: { sessionId: { type: 'string' }, text: { type: 'string' }, timeoutMs: { type: 'number' } }, required: ['sessionId', 'text'], additionalProperties: false },
  terminal_read: { type: 'object', properties: { sessionId: { type: 'string' }, offset: { type: 'number' } }, required: ['sessionId'], additionalProperties: false },
  terminal_signal: { type: 'object', properties: { sessionId: { type: 'string' }, signal: { type: 'string', enum: ['SIGINT', 'SIGTERM', 'SIGKILL', 'SIGTSTP', 'SIGHUP'] } }, required: ['sessionId', 'signal'], additionalProperties: false },
  terminal_close: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'], additionalProperties: false },
  terminal_list: { type: 'object', properties: {}, required: [], additionalProperties: false },
}

function makeNatives (present: Set<string>) {
  const natives = new Map<string, Definition>()
  for (const name of TOOL_NAMES) {
    if (!present.has(name)) continue
    natives.set(name, {
      name,
      description: `native ${name} production description`,
      parameters: PARAMS[name],
      execute: async () => { throw new Error('NATIVE BODY NEVER RUNS THROUGH THE WIRING ROW') },
      output: { schema: { type: 'object' }, render: (value: unknown) => JSON.stringify(value) },
    })
  }
  return natives
}

interface WorldOpts {
  absent?: string[]
  noFeed?: boolean
  movedFeed?: boolean
  identityUnbound?: boolean
}

function makeWorld (opts: WorldOpts = {}) {
  const present = new Set(TOOL_NAMES.filter((n) => !(opts.absent ?? []).includes(n)))
  const natives = makeNatives(present)
  const seamReads: string[] = []
  const readNative = (name: string) => {
    seamReads.push(name)
    return natives.get(name)
  }
  const portCalls: string[] = []
  // THE recording terminals double (the seven §5.1 service entries; the
  // adapter's own list answer is what the LIST row must serve VERBATIM).
  const terminals = {
    registerBackend: (backend: { type: string }) => { portCalls.push(`registerBackend:${backend.type}`); return () => {} },
    spawn: async () => { portCalls.push('spawn'); throw new Error('spec world: spawn not driven here') },
    startSend: () => { portCalls.push('startSend'); throw new Error('spec world: startSend not driven here') },
    read: () => { portCalls.push('read'); return { viewport: '', cursorOffset: 0 } },
    signal: async () => { portCalls.push('signal'); return { kind: 'sent' } },
    kill: async () => { portCalls.push('kill'); return true },
    list: () => { portCalls.push('list'); return Object.freeze([{ sessionId: 'pty-1', type: 'shell', status: { kind: 'running' } }]) },
  }
  const subprocess = { spawnTerminal: async () => { portCalls.push('spawnTerminal'); throw new Error('spec world: no PTY spawn driven here') } }
  const sessionFactory = async () => { throw new Error('spec world: no session constructed here') }
  const ptyService = {
    backend: (type: string) => (type === 'shell' ? { registrationId: 'reg-shell-1', incarnation: 'inc-1', processEnvelope: { sandbox: 'landlock' } } : null),
    session: (ownerAgentId: string, sessionId: string) => (ownerAgentId === MEMBER && sessionId === 'pty-1' ? { incarnation: 'pty-inc-1', status: { kind: 'running' } } : null),
    approvedOpenPlan: () => ({ plan: { argv: ['/bin/bash'], cwd: '/tmp/g3-wire', rows: 24, cols: 80, graceMs: 2000 } }),
  }
  // THE recording PA double — the published contract SHAPE (open -> grant,
  // edge -> one-shot consumedProof, closePlan per call). The kernel pairing
  // fields (callId / parametersFingerprint / bindingId / bindingRevision)
  // are carried EXACTLY as the real grant struct publishes them
  // (domain/tool-governance/src/grant.ts:41-48).
  const walks: Array<Record<string, unknown>> = []
  const closePlans: string[] = []
  let denyOpen = false
  let dropProof = false
  const bindingFactsValue = { bindingId: 'a5p1:scope:tool', bindingRevision: 1, policyGeneration: 0, authorityGeneration: 0 }
  const pa = {
    openCalls: 0,
    open: async (walk: Record<string, unknown>) => {
      pa.openCalls += 1
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
    edge: async (input: Record<string, unknown>) => {
      if (dropProof) return { kind: 'allow' }
      return { kind: 'allow', consumedProof: { grant: input.grant } }
    },
    closePlan: (callId: string) => { closePlans.push(callId) },
  }
  const placed = new Map<string, Definition>()
  const placementFeed = (name: string) => {
    if (opts.noFeed === true) return undefined
    const def = placed.get(name)
    if (def === undefined) return undefined
    const identity = definitionIdentityOf(def)
    if (identity === null) return undefined
    return Object.freeze({ definitionIdentity: opts.movedFeed === true ? `${identity}+moved` : identity, realmId: REALM })
  }
  const identityOf = (def: unknown) => (opts.identityUnbound === true ? null : definitionIdentityOf(def))
  const events: Array<Record<string, unknown>> = []
  const baseInput = {
    realmId: REALM,
    providerId: PROVIDER,
    memberAgentId: MEMBER,
    sessionHeaderId: HEADER,
    readNative,
    declaredBackends: ['shell'],
    ptyService,
    controlPortDeps: {
      terminals,
      resolveOwner: (exec: Record<string, unknown>) => (exec?.agent ?? null) as unknown,
      subprocess,
      sessionFactory,
      TerminalBackendCleanupError: RealCleanupError,
    },
    bindingFacts: () => ({ ...bindingFactsValue }),
    placementFeed,
    identityOf,
    pa,
    observe: (event: Record<string, unknown>) => { events.push(event) },
  }
  const execFor = (callId: string) => Object.freeze({
    token: { t: callId },
    callId,
    agent: { id: MEMBER, session: { header: { id: HEADER } } },
  })
  const build = (over: Record<string, unknown> = {}) => {
    const asm = WIRING.buildG3TerminalWiring({ ...baseInput, ...over }) as Built
    for (const definition of (asm.definitions ?? [])) placed.set(definition.name, definition)
    return asm
  }
  return { build, input: (over: Record<string, unknown> = {}) => ({ ...baseInput, ...over }), walks, closePlans, portCalls, seamReads, events, pa, placed, natives, setDenyOpen: (v: boolean) => { denyOpen = v }, setDropProof: (v: boolean) => { dropProof = v }, execFor, RealCleanupError }
}

const refusalOf = async (promise: Promise<unknown>) => {
  let error: unknown = null
  let resolved = false
  try {
    await promise
    resolved = true
  } catch (e) {
    error = e
  }
  if (resolved) throw new Error('expected a refusal, got a resolve')
  const e = (error ?? {}) as { code?: string, message?: string }
  return { code: String(e.code ?? ''), message: String(e.message ?? ''), error }
}

describe('A5M2-G3-TERMINAL-WIRING — the B-TERMINAL bridge: closed input, real seat, one capture, full walk, zero-entry refusals, runtime keys, real class, pinned grammar', () => {
  it('(a1) the input surface is CLOSED: an unknown knob refuses with the typed code', () => {
    const w = makeWorld()
    const bad = WIRING.buildG3TerminalWiring({ ...w.input(), extraKnob: true }) as Built
    expect(bad.ok).toBe(false)
    expect(bad.code).toBe(CODES.INPUT_INVALID)
    expect(String(bad.detail)).toContain('closed')
  })

  it('(a2) THE REAL SEAT law: a duck {ok:true} never poses — the refusal names the published paAdmit shape', () => {
    const w = makeWorld()
    for (const duck of [{ ok: true }, { open: async () => {} }, null]) {
      const bad = WIRING.buildG3TerminalWiring(w.input({ pa: duck })) as Built
      expect(bad.ok).toBe(false)
      expect(bad.code).toBe(CODES.INPUT_INVALID)
      expect(String(bad.detail)).toContain('paAdmit')
    }
  })

  it('(a3) the §5.1 seam that cannot answer the per-open plan refuses at assembly, not at every classify', () => {
    const w = makeWorld()
    const bad = WIRING.buildG3TerminalWiring(w.input({ ptyService: { backend: () => null, session: () => null } })) as Built
    expect(bad.ok).toBe(false)
    expect(bad.code).toBe(CODES.INPUT_INVALID)
    expect(String(bad.detail)).toContain('approvedOpenPlan')
  })

  it('(b) ONE CAPTURE per name + the honest DECLARED-INACTIVE census: an uncaptured native gets NO def, NO registration, native untouched', () => {
    const w = makeWorld({ absent: ['terminal_open'] })
    const asm = w.build()
    expect(asm.ok).toBe(true)
    for (const name of TOOL_NAMES) {
      expect(w.seamReads.filter((n) => n === name).length, `seam reads for ${name}`).toBe(1)
    }
    expect((asm.definitions as Definition[]).map((d) => d.name)).toEqual([
      'terminal_send', 'terminal_read', 'terminal_signal', 'terminal_close', 'terminal_list',
    ])
    expect(asm.declared).toEqual([{ name: 'terminal_open', familyId: 'B-TERMINAL', status: 'DECLARED-INACTIVE', reason: 'capture-absent' }])
    expect(asm.familyRegistrations!()).toHaveLength(5)
  })

  it('(c) placement-moment bind: identityOf receives the PLACED def object (the same object the feed later reads); an unbound seam THROWS', () => {
    const w = makeWorld()
    const asm = w.build()
    expect(asm.ok).toBe(true)
    for (const definition of asm.definitions as Definition[]) {
      const fed = w.placed.get(definition.name)
      expect(fed).toBe(definition)
    }
    expect(() => w.build({ identityOf: () => null })).toThrow(CODES.IDENTITY_UNBOUND)
  })

  it('(d) FULL WALK SERVES: classify -> open -> edge -> consumedProof DEMAND -> arm -> the PORT answer travels VERBATIM; family block at FULL VALUE; closePlan on every path', async () => {
    const w = makeWorld()
    const asm = w.build()
    const def = (asm.definitions as Definition[]).find((d) => d.name === 'terminal_list') as Definition
    const served = await def.execute({}, w.execFor('exec-list-1'))
    // VERBATIM: the served value IS the terminals.list answer (the port's
    // word is the service word — no re-shape, no wrapper).
    expect(served).toEqual([{ sessionId: 'pty-1', type: 'shell', status: { kind: 'running' } }])
    expect(w.portCalls).toContain('list')
    expect(w.walks).toHaveLength(1)
    const walk = w.walks[0] as { callId?: string, realmId?: string, toolName?: string, parametersFingerprint?: string, family?: { familyId?: string, adapterRevision?: number, providerIdentity?: string, targetManifest?: unknown } }
    expect(walk.callId).toBe('exec-list-1')
    expect(walk.realmId).toBe(REALM)
    expect(walk.toolName).toBe('terminal_list')
    expect(walk.family).toMatchObject({ familyId: 'B-TERMINAL', adapterRevision: 3, providerIdentity: PROVIDER })
    expect(walk.family?.targetManifest).toBeTypeOf('object')
    expect(String(walk.parametersFingerprint)).toMatch(/^sha256:/)
    expect(w.closePlans).toEqual(['exec-list-1'])
    expect(w.events.some((e) => e.event === 'g3-wire:served')).toBe(true)
  })

  it('(d2) the READ row serves the service answer and the grant the arm paired with IS the edge witness grant (object identity)', async () => {
    const w = makeWorld()
    const asm = w.build()
    const def = (asm.definitions as Definition[]).find((d) => d.name === 'terminal_read') as Definition
    let seenGrant: unknown = null
    const originalEdge = w.pa.edge
    w.pa.edge = async (input: Record<string, unknown>) => { const r = await originalEdge(input); seenGrant = ((r ?? {}) as { consumedProof?: { grant?: unknown } }).consumedProof?.grant; return r }
    const served = await def.execute({ sessionId: 'pty-1' }, w.execFor('exec-read-1'))
    expect(served).toMatchObject({ viewport: '' })
    expect(w.portCalls).toContain('read')
    expect(seenGrant).not.toBeNull()
    expect(String((seenGrant as Record<string, unknown>).grantId)).toMatch(/^grant-/)
    expect(w.closePlans).toEqual(['exec-read-1'])
  })

  it('(e1) deny at the open edge: the refusal carries the SEAT bytes and the ports stayed at ZERO entries; closePlan still lands', async () => {
    const w = makeWorld()
    const asm = w.build()
    w.setDenyOpen(true)
    const def = (asm.definitions as Definition[]).find((d) => d.name === 'terminal_list') as Definition
    const refusal = await refusalOf(def.execute({}, w.execFor('exec-deny-1')))
    expect(refusal.code).toBe('ADMISSION_REFUSED')
    expect(w.portCalls.length, 'zero port entry').toBe(0)
    expect(w.closePlans).toEqual(['exec-deny-1'])
  })

  it('(e2) an edge that allows WITHOUT its one-shot witness refuses CONSUME_PROOF_MISSING — zero port entry, never a self-attested consumption', async () => {
    const w = makeWorld()
    const asm = w.build()
    w.setDropProof(true)
    const def = (asm.definitions as Definition[]).find((d) => d.name === 'terminal_list') as Definition
    const refusal = await refusalOf(def.execute({}, w.execFor('exec-noproof-1')))
    expect(refusal.code).toBe(CODES.CONSUME_PROOF_MISSING)
    expect(w.portCalls.length, 'zero port entry').toBe(0)
    expect(w.closePlans).toEqual(['exec-noproof-1'])
  })

  it('(e3) no ISSUED call identity: the bridge refuses BEFORE the PA walk — zero open calls, zero port entries', async () => {
    const w = makeWorld()
    const asm = w.build()
    const def = (asm.definitions as Definition[]).find((d) => d.name === 'terminal_list') as Definition
    const execNoCallId = { token: { t: 1 }, agent: { id: MEMBER, session: { header: { id: HEADER } } } }
    const refusal = await refusalOf(def.execute({}, execNoCallId))
    expect(refusal.code).toBe(CODES.CALL_ID_ABSENT)
    expect(w.pa.openCalls).toBe(0)
    expect(w.portCalls.length).toBe(0)
  })

  it('(e4) classify refusals are the ADAPTER\'s words verbatim (unknown parameter, undeclared backend) — pure pre-edge, zero PA, zero port', async () => {
    const w = makeWorld()
    const asm = w.build()
    const def = (asm.definitions as Definition[]).find((d) => d.name === 'terminal_open') as Definition
    const r1 = await refusalOf(def.execute({ type: 'shell', surprise: 1 }, w.execFor('exec-open-1')))
    expect(r1.message).toContain('P_TERM_CLASSIFY_UNKNOWN_PARAMETER')
    const r2 = await refusalOf(def.execute({ type: 'not-declared' }, w.execFor('exec-open-2')))
    expect(r2.message).toContain('P_TERM_CLASSIFY_BACKEND_NOT_DECLARED')
    expect(w.pa.openCalls).toBe(0)
    expect(w.portCalls.length).toBe(0)
  })

  it('(f) registration keys are the placement feed\'s RUNTIME identities; a silent feed THROWS (ABSENT), a moved feed THROWS (MOVED)', () => {
    const ok = makeWorld()
    const asm = ok.build()
    const regs = asm.familyRegistrations!()
    expect(regs).toHaveLength(6)
    for (const reg of regs) {
      expect(reg.definitionIdentity).toBe(definitionIdentityOf(ok.placed.get(reg.name) as Definition))
      expect(reg.entry).toEqual({ familyId: 'B-TERMINAL', adapterRevision: 3, providerIdentity: PROVIDER })
    }
    const silentAsm = makeWorld({ noFeed: true }).build()
    expect(() => silentAsm.familyRegistrations!()).toThrow(CODES.PLACEMENT_KEY_ABSENT)
    const moved = makeWorld({ movedFeed: true })
    const asm3 = moved.build()
    expect(() => asm3.familyRegistrations!()).toThrow(CODES.PLACEMENT_KEY_MOVED)
  })

  it('(g) drain: the adapter\'s own DRAINING bytes refuse new calls through the row, zero port entry', async () => {
    const w = makeWorld()
    const asm = w.build()
    const drained = asm.drain!()
    expect(String(drained.semantics)).toContain('new-call prohibition only')
    const def = (asm.definitions as Definition[]).find((d) => d.name === 'terminal_list') as Definition
    const refusal = await refusalOf(def.execute({}, w.execFor('exec-post-drain')))
    expect(refusal.message).toContain('P_TERM_DRAINING')
    expect(w.portCalls.length).toBe(0)
  })

  it('(h1) 同Host错误类 bytes pinned from the PUBLISHED face @639ed01539: an AggregateError carrying [spawnError, cleanupError], the exact message and name', () => {
    const spawnError = new Error('spawn failed')
    const cleanupError = new Error('cleanup failed')
    const combined = new RealCleanupError(spawnError, cleanupError)
    expect(combined).toBeInstanceOf(AggregateError)
    expect([...combined.errors]).toEqual([spawnError, cleanupError])
    expect(combined.message).toBe('PTY backend startup and cleanup both failed')
    expect(combined.name).toBe('TerminalBackendCleanupError')
    expect(combined.spawnError).toBe(spawnError)
    expect(combined.cleanupError).toBe(cleanupError)
  })

  it('(h2) a REAL startup+cleanup failure crosses the ROW as instanceof the REAL class — never a re-wrapped word, never a swallowed cleanup', async () => {
    const w = makeWorld()
    // The session CONSTRUCTS, initialize() fails, the session's own close()
    // fails too: the adapter law (rejectAfterStartupCleanup, the REAL
    // terminal-bash index.ts:174-180/219-228 sequence) answers the REAL
    // class carrying BOTH errors — the row must propagate THAT object.
    const session = {
      initialize: async () => { throw new Error('P_TERM_READY_FAILED (spec): initialize refused') },
      close: async () => { throw new Error('P_TERM_CLOSE_REFUSED (spec): close failed') },
    }
    const backends = new Map<string, { type: string, spawn: (spec: Record<string, unknown>) => Promise<unknown> }>()
    const serviceTerminals = {
      registerBackend: (backend: { type: string, spawn: (spec: Record<string, unknown>) => Promise<unknown> }) => {
        backends.set(backend.type, backend)
        return () => { backends.delete(backend.type) }
      },
      // THE REAL ordering (index.ts:154-224): capture the backend BY TYPE,
      // MINT the sessionId Host-side, AWAIT the one-shot backend.spawn —
      // the same sequence the faithful fsproc double runs.
      spawn: async (owner: unknown, request: Record<string, unknown>) => {
        const backend = backends.get(String(request.type))
        if (backend === undefined) throw Object.assign(new Error(`no PTY backend registered for "${String(request.type)}"`), { code: 'NO_BACKEND' })
        const sessionId = 'pty-svc-cleanup-1'
        // THE REAL SPAWN CATCH KEEPS THE CLEANUP FACT (index.ts:197-199): the
        // startup/cleanup error passes through this service frame AS-IS — the
        // row below must still meet the REAL class (no re-wrap, no swallow),
        // so the double awaits straight through without intercepting.
        return { sessionId, session: await backend.spawn({ sessionId, owner, type: request.type }) }
      },
      startSend: () => { throw new Error('spec: startSend not driven here') },
      read: () => ({}),
      signal: async () => ({}),
      kill: async () => true,
      list: () => [],
    }
    const asm = w.build({
      controlPortDeps: {
        terminals: serviceTerminals,
        resolveOwner: (exec: Record<string, unknown>) => exec?.agent ?? null,
        subprocess: {
          spawnTerminal: async () => Object.freeze({
            pid: 4242, type: 'spec-pty', status: () => ({ kind: 'running' }),
            terminate: async () => {}, write: async () => {}, onData: () => () => {}, resize: () => {},
          }),
        },
        sessionFactory: async () => session,
        TerminalBackendCleanupError: w.RealCleanupError,
      },
    })
    const def = (asm.definitions as Definition[]).find((d) => d.name === 'terminal_open') as Definition
    const failure = await refusalOf(def.execute({ type: 'shell' }, w.execFor('exec-open-cleanup')))
    // THE MEASURED LAW (adapter line 1063-1067, the fsproc leg
    // 'REAL TerminalBackendCleanupError crosses the service'): the aggregate
    // passes the service's OWN `instanceof cleanupErrorClass` — possible only
    // because the injected object IS the published class (h1 bytes) — and the
    // port answers the STARTUP_CLEANUP refusal naming BOTH errors from the
    // aggregate itself. THE CODE ITSELF IS THE PROOF OF THE CLASS CROSSING:
    // a look-alike would have fallen to the generic word.
    expect(failure.code).toBe('P_TERM_OPEN_STARTUP_CLEANUP_FAILED')
    expect(failure.message).toContain('P_TERM_READY_FAILED (spec): initialize refused')
    expect(failure.message).toContain('P_TERM_CLOSE_REFUSED (spec): close failed')
    expect(failure.message).toContain('cleanup did NOT reach quiescence')
    expect(failure.message).toContain('resources may remain')
    // the row never re-wraps the refusal into anything else: the adapter's
    // word travels verbatim (root 19:25 — no stable wrapper masks the fact),
    // and the plan fact is closed exactly once.
    expect(w.closePlans).toEqual(['exec-open-cleanup'])
  })

  it('(i) B-TERMINAL closed table (root 20:38 闭表): the wiring FLAT VIEW passes the SIGNED grammar for all six verbs; nested/extra/unknown shapes deny fail-closed', () => {
    // The grammar file now carries PA_FAMILY_TARGET_RULES['B-TERMINAL']
    // (variant over `operation`, the B-INSPECT discrimination law). The
    // durable claim is the adapter CLASSIFY manifest through the wiring's
    // a5G3PaTargetFlat — one-for-one FULL-VALUE leaves (the B-CONTROL mint
    // law); snapshot/null-only leaves stay OUT (the entry digest re-check
    // and the service recheck own them). Measured refusals pinned below are
    // the table's OWN words — never invented.
    const flat = WIRING.a5G3PaTargetFlat
    const common = (operation: string, toolName: string) => ({ operation, toolName, realmId: 'realm-g3', agentId: 'agent-1', sessionHeaderId: 'hdr-1', paramFingerprint: 'sha256:p' })
    const openNested = {
      ...common('pty-spawn', 'terminal_open'),
      backendTarget: { publicType: 'shell', serviceRegistrationId: 'reg-shell-1', serviceIncarnation: 'inc-1', processEnvelope: 'sandbox:landlock' },
      perOpenBackend: { approvedPlan: { argv: ['/bin/bash'], cwd: '/tmp/g3-wire', rows: 24, cols: 80, graceMs: 2000 }, envelopeDigest: 'sha256:x' },
      perOpenCorrelationCallId: 'c-1',
      requestedCwd: '/tmp/g3-wire',
      effectDelta: ['os-pty-spawn-shell', 'process-io-envelope'],
    }
    expect(isLosslessJsonValue(openNested)).toBe(true)
    const flatOpen = flat(openNested)
    expect(validatePaFamilyTarget('B-TERMINAL', flatOpen)).toBeUndefined()
    // 全值契约 (root 21:07): the approved plan and the process envelope ride
    // the row under the reviewed canonical-JSON encoding ('absent' = null),
    // the digest stays beside them:
    expect(flatOpen.planArgvJson).toBe('["/bin/bash"]')
    expect(flatOpen.planCwd).toBe('/tmp/g3-wire')
    expect(flatOpen.planRows).toBe(24)
    expect(flatOpen.planCols).toBe(80)
    expect(flatOpen.planGraceMs).toBe(2000)
    expect(flatOpen.planTerminalType).toBe('dumb')
    expect(flatOpen.planEnvJson).toBe('absent')
    expect(flatOpen.planExecutableJson).toBe('absent')
    expect(flatOpen.processEnvelopeJson).toBe('"sandbox:landlock"')
    expect(flatOpen.approvedEnvelopeDigest).toBe('sha256:x')
    // The RAW nested manifest is NOT the durable claim shape (closed keys
    // deny, fail closed — the flat view is the only claim the table knows):
    expect(validatePaFamilyTarget('B-TERMINAL', openNested)).toBe('backendPublicType: required by the B-TERMINAL typed plan, absent')
    const ptyTarget = { sessionId: 'pty-1', serviceIncarnation: 'pid:4242', serviceStatus: { kind: 'running' }, serviceEnvelope: null }
    expect(validatePaFamilyTarget('B-TERMINAL', flat({
      ...common('stdin-write', 'terminal_send'), ptyTarget,
      effectiveSubmit: true, background: false, backgroundJobTarget: null,
      inputDigest: 'sha256:t', inputBytes: 4, effectDelta: ['shell-input-injection-stdin'],
    }))).toBeUndefined()
    expect(validatePaFamilyTarget('B-TERMINAL', flat({
      ...common('output-read', 'terminal_read'), ptyTarget, offset: null, count: null,
    }))).toBeUndefined()
    // a windowed read rides its numbers at full value (root 21:07):
    const flatWin = flat({ ...common('output-read', 'terminal_read'), ptyTarget, offset: 40, count: 800 })
    expect(validatePaFamilyTarget('B-TERMINAL', flatWin)).toBeUndefined()
    expect(flatWin.offsetJson).toBe('40')
    expect(flatWin.countJson).toBe('800')
    expect(validatePaFamilyTarget('B-TERMINAL', flat({
      ...common('signal', 'terminal_signal'), ptyTarget, signal: 'SIGINT', effectDelta: ['os-signal-to-process-group'],
    }))).toBeUndefined()
    expect(validatePaFamilyTarget('B-TERMINAL', flat({
      ...common('close', 'terminal_close'), ptyTarget, effectDelta: ['owned-process-tree-kill'],
      settlementEvidence: 'the service close outcome (closed | already-closing) is the only termination word',
    }))).toBeUndefined()
    expect(validatePaFamilyTarget('B-TERMINAL', flat({ ...common('list', 'terminal_list'), ownerScoped: true }))).toBeUndefined()
    // binds law: list's ownerScoped is the ONE literal, never a boolean slot:
    expect(validatePaFamilyTarget('B-TERMINAL', { ...common('list', 'terminal_list'), ownerScoped: false }))
      .toContain('not the')
    // an unknown operation passes THROUGH the flat map UNCHANGED and the
    // table names it (never a fallback group):
    expect(validatePaFamilyTarget('B-TERMINAL', flat({ ...common('pty-exotic', 'terminal_x') })))
      .toContain('selects no B-TERMINAL variant group')
    // the six-verb leaf sets are CLOSED: a smuggled leaf denies with its own name:
    expect(validatePaFamilyTarget('B-TERMINAL', { ...common('output-read', 'terminal_read'), ptySessionId: 'pty-1', ptyIncarnation: 'pid:4242', offsetJson: 'absent', countJson: 'absent', smuggled: 'x' }))
      .toBe('smuggled: not part of the B-TERMINAL typed plan')
  })
})

// center (root G3A760 narrow review): REGRESSION PINS for the backends
// transport. The merge that landed B-TERMINAL carried the a5G3TerminalInject
// GUARD condition but dropped the conditional SPREAD from the backends
// literal, so plane:1402 read `input.backends?.terminal === undefined` and
// the post-mount wiring-face check (:5421 region) refused EVERY terminal
// session (alpha5-g3-terminal-mount-refused). createAgentBindings needs a
// live Host agent ctx (a5m2-g1-wire-c1 header, same disclosure), so the
// in-repo guard is the pinned-edge class (a5p7 precedent): the binding must
// carry the EXACT transport line, and the plane must keep reading EXACTLY
// that key. A true end-to-end enablement leg rides the live kit — this pin
// is not a substitute for it and nothing here claims 已测试.
describe('B-TERMINAL backends transport — regression pins (root G3A760)', () => {
  it('the bindings backends union carries the terminal spread (not just the guard)', () => {
    const src = readFileSync(fileURLToPath(new URL('../src/plugin/live/agent-bindings.mjs', import.meta.url).href), 'utf8')
    expect(src).toContain('...(a5G3TerminalInject === null ? {} : { terminal: a5G3TerminalInject }),')
    // the guard alone (without the spread) was the regression shape:
    expect(src).toContain('a5SpawnWiring === null && a5G3TerminalInject === null')
  })
  it('the plane reads exactly input.backends?.terminal', () => {
    const src = readFileSync(fileURLToPath(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href), 'utf8')
    expect(src).toContain('const terminalInjectRaw = input.backends?.terminal')
  })
})
