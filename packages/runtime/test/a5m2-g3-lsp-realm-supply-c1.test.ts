/**
 * A5M2-G3-LSP-REALM-SUPPLY C1 — the realm supply + realm-scoped document
 * resolver over the REAL createLspRealmAssembly (root 限施工裁决: the
 * committed face is REUSED directly — measured present on int/master; no
 * parallel rewrite), with CANNED transport (options.deps.spawnStream per
 * the a5lsp2-streaming precedent). Author side, 接线未测; the fake answers
 * are declared canned transport, never a Host claim.
 *
 * Legs: (1) the supply surface is CLOSED; (2) assembly discipline the
 * supply rides: first assemble, HOT reuse, generation-mismatch REFUSE at
 * the discipline entry, policyChange destroy/rebuild with the journal in
 * order (begin -> realm-disposed -> realm-assembled -> complete), teardown
 * net-zero; (3) the four §5.2 facts against REAL files: server live-only
 * with the policy-identity law, canonical locator/kind/revision drift,
 * documentRealm mapping the `lsp:<member>:<gen>` spelling and MOVING with
 * the generation, documentScope inside/outside with the escape cases;
 * (4) the INTEGRATION leg: the REAL buildG3LspWiring + REAL
 * createGovernedLspArm eat this REAL supply — all four operations walk to
 * SERVED, the durable flat carries the real realm/server/document facts,
 * and the negative trio: realm moved (policyChange -> SCOPE_ESCAPED before
 * any body), document edited between approval and entry (TARGET_DRIFT,
 * zero body), realm disposed (TARGET_UNRESOLVED, zero body).
 *
 * @module @dsh-agent-team/runtime/test/a5m2-g3-lsp-realm-supply-c1
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable, Writable } from 'node:stream'

import { createLspRealmAssembly } from '../sandbox-provider/lsp-assembly.js'

const SUPPLY = (await import(new URL('../src/plugin/live/governed-families/lsp-realm-supply.mjs', import.meta.url).href)) as {
  createA5LspRealmSupply: (input: Record<string, unknown>) => Supply & { ok?: boolean, code?: string, detail?: string }
  a5LspRealmId: (memberId: string, generation: string) => string
  A5_LSP_SUPPLY_CODES: Record<string, string>
}
interface Supply {
  memberId: string
  facts: {
    server: () => { binaryIdentity: string, generation: string } | null
    document: (filePath: string, workspaceRoot: string) => { kind: string, canonicalLocator: string, revision: string } | null
    documentRealm: (locator: string, workspaceRoot: string) => string | null
    documentScope: (locator: string, workspaceRoot: string) => 'inside' | 'outside'
  }
  realmIdOf: (generation: string) => string
  syncGeneration: (generation: string) => Promise<{ ok: boolean, status: string, instance?: Record<string, unknown>, result?: Record<string, unknown> }>
  ensureLive: () => Promise<unknown>
  query: (request: Record<string, unknown>) => Promise<Record<string, unknown>>
  controlPort: {
    prepare: (spec: Record<string, unknown>) => Promise<Record<string, unknown>>
    drift: (canonical: Record<string, unknown>) => (handle: Record<string, unknown>) => { ok: false, code: string, detail: string } | null
    handleStatus: (handle: Record<string, unknown>) => Record<string, unknown>
    cancelCleanup: (live: Record<string, unknown>, context: Record<string, unknown>) => Promise<Record<string, unknown>>
    liveHandles: (member: string) => readonly Record<string, unknown>[]
  }
  drainAll: () => Promise<{ ok: boolean }>
}
const WIRING = (await import(new URL('../src/plugin/live/governed-families/g3-lsp-wiring.mjs', import.meta.url).href)) as {
  buildG3LspWiring: (input: Record<string, unknown>) => Built
  A5_G3_LSP_WIRING_CODES: Record<string, string>
}
interface Built {
  ok: boolean
  code?: string
  definitions?: Array<{ name: string, execute: (args: Record<string, unknown>, exec: Record<string, unknown>) => Promise<unknown> }>
  familyRegistrations?: () => Array<{ entry: Record<string, unknown> }>
}

const MEMBER = 'agent-member-1'

// ---------------------------------------------------------------------------
// CANNED transport (the a5lsp2-streaming precedent): the launcher fake
// answers the fd-3 handshake with a payload pid; no real process exists.
// Since the root LSP-review ruling (2026-10-25) the canned payload speaks
// the STANDARD protocol over real Content-Length framing (initialize
// handshake, the four textDocument operations, notifications accepted,
// $/cancelRequest recorded) — the transport stays CANNED (author-side,
// non-Host: canned is never promoted to C2), but the PROTOCOL the supply
// and the assembly are tested against is the real one. `hang` models a
// server that never answers (the reclaim leg), `cancels` records what the
// wire was told.
// ---------------------------------------------------------------------------
let pidSeq = 41000
function fakeProcess (payloadPid: number) {
  const handshake = new Readable({ read() {} })
  handshake.push(Buffer.from(JSON.stringify({ stream: true, pid: payloadPid }) + '\n', 'utf8'))
  handshake.push(null)
  let resolveExit: (v: { code: number | null, signal: string | null }) => void = () => {}
  const exit = new Promise<{ code: number | null, signal: string | null }>((r) => { resolveExit = r })
  const signals: string[] = []
  const stdout = new Readable({ read() {} })
  const proc: {
    pid: number
    stdin: Writable
    stdout: Readable
    stderr: Readable
    handshake: Readable
    signals: string[]
    cancels: number[]
    requests: string[]
    hang: boolean
    dead: boolean
    kill: (signal?: string | number) => boolean
    exit: Promise<{ code: number | null, signal: string | null }>
  } = {
    pid: payloadPid - 1, // the launcher supervisor pid (the payload pid rides the handshake)
    stdout,
    stdin: new Writable({ write() { /* replaced below (the responder needs proc) */ } }),
    stderr: Readable.from((async function* () { /* canned: no payload bytes */ })()),
    handshake,
    signals,
    cancels: [],
    requests: [],
    hang: false,
    dead: false,
    kill(signal?: string | number): boolean {
      const s = String(signal ?? 'SIGTERM')
      if (!signals.includes(s)) signals.push(s)
      // the CANNED process law: a signaled process DIES (exit resolves, OS
      // liveness flips) — the provider settles only on an OBSERVED death
      // ('run.exited && !pidAlive'), exactly like the real /proc arm.
      if (!proc.dead) {
        proc.dead = true
        resolveExit({ code: null, signal: s })
      }
      return true
    },
    exit,
  }
  const frame = (obj: unknown): void => {
    const body = JSON.stringify(obj)
    stdout.push(Buffer.from(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`, 'utf8'))
  }
  const respond = (msg: Record<string, unknown>): void => {
    const method = String(msg.method ?? '')
    const id = msg.id as number | undefined
    proc.requests.push(method)
    if (method === '$/cancelRequest') {
      proc.cancels.push(Number((msg.params as { id?: number } | undefined)?.id))
      return
    }
    if (method === 'initialize') {
      frame({ jsonrpc: '2.0', id, result: { capabilities: { hoverProvider: true, definitionProvider: true, referencesProvider: true, implementationProvider: true }, serverInfo: { name: 'canned-lsp', pid: payloadPid } } })
      return
    }
    if (method === 'shutdown') { frame({ jsonrpc: '2.0', id, result: null }); return }
    if (id === undefined) return // notifications (initialized/didOpen/didClose) are accepted silently
    if (proc.hang) return // the never-answer model (reclaim/timeout legs)
    const uri = String((msg.params as { textDocument?: { uri?: string } } | undefined)?.textDocument?.uri ?? 'file:///unknown')
    if (method === 'textDocument/hover') {
      const pos = (msg.params as { position?: { line?: number, character?: number } } | undefined)?.position
      frame({ jsonrpc: '2.0', id, result: { contents: { kind: 'markdown', value: `HOVER canned pid=${String(payloadPid)} ${uri} at ${String(pos?.line)},${String(pos?.character)}` } } })
      return
    }
    if (method === 'textDocument/definition' || method === 'textDocument/implementation') {
      frame({ jsonrpc: '2.0', id, result: [{ uri, range: { start: { line: 0, character: 6 }, end: { line: 0, character: 7 } } }] })
      return
    }
    if (method === 'textDocument/references') {
      frame({ jsonrpc: '2.0', id, result: [
        { uri, range: { start: { line: 0, character: 6 }, end: { line: 0, character: 7 } } },
        { uri, range: { start: { line: 3, character: 2 }, end: { line: 3, character: 3 } } },
      ] })
      return
    }
    frame({ jsonrpc: '2.0', id, error: { code: -32601, message: `canned: unsupported ${method}` } })
  }
  let inbuf = ''
  proc.stdin = new Writable({
    write(chunk, _enc, cb) {
      inbuf += String(chunk)
      for (;;) {
        const headerEnd = inbuf.indexOf('\r\n\r\n')
        if (headerEnd < 0) break
        const m = /content-length:\s*(\d+)/i.exec(inbuf.slice(0, headerEnd))
        const start = headerEnd + 4
        if (m === null) { inbuf = inbuf.slice(start); continue }
        const length = Number(m[1])
        if (inbuf.length < start + length) break
        const body = inbuf.slice(start, start + length)
        inbuf = inbuf.slice(start + length)
        let msg: Record<string, unknown>
        try { msg = JSON.parse(body) } catch { continue }
        respond(msg)
      }
      cb()
    },
  })
  return proc
}

function fakeDepsOf (spawned: Array<ReturnType<typeof fakeProcess>>) {
  const byPid = new Map<number, ReturnType<typeof fakeProcess>>()
  return {
    availability: () => ({ rows: [{ subject: 'python3', present: true, note: 'canned transport: fake injected' }] }),
    run: () => ({ rc: 0, stdout: '', stderr: '' }),
    probeFacts: () => ({
      abiVersion: 4,
      legs: {
        selective: { leg: 'selective', verdict: 'ENFORCE-CONFIRMED', rc: 0, checks: [] },
        denyall: { leg: 'denyall', verdict: 'ENFORCE-CONFIRMED', rc: 0, checks: [] },
        badhandled: { leg: 'badhandled', verdict: 'DEMO-CONFIRMED', rc: 0, checks: [] },
      },
    }),
    spawnStream: () => {
      const proc = fakeProcess(++pidSeq)
      spawned.push(proc)
      byPid.set(proc.pid + 1, proc) // keyed by the PAYLOAD pid the handshake reports
      return { ok: true, value: proc }
    },
    signalProcess: (pid: number, signal: 'SIGTERM' | 'SIGKILL') => {
      const proc = byPid.get(pid)
      if (proc === undefined) return false // already gone: never claim a signal landed
      proc.kill(signal)
      return true
    },
    pidAlive: (pid: number) => {
      const proc = byPid.get(pid)
      return proc !== undefined && !proc.dead // OS liveness: alive until the fake dies
    },
  }
}

let root = ''
let ws = ''

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'dsh-lsp-supply-'))
  ws = join(root, 'ws')
  mkdirSync(join(ws, 'src'), { recursive: true })
  writeFileSync(join(ws, 'src', 'a.ts'), 'export const a = 1\n', 'utf8')
  mkdirSync(join(root, 'scratch'), { recursive: true })
})
afterAll(() => { rmSync(root, { recursive: true, force: true }) })

interface WorldOut { events: Array<Record<string, unknown>>, spawned: Array<ReturnType<typeof fakeProcess>> }
function makeAssembly (world: WorldOut, generations: { cwd: string } = { cwd: ws }) {
  const policyFor = (memberId: string, generation: string) => ({
    grantFingerprint: `grant-${generation}`,
    bindingId: `bind-${generation}`,
    argv: [`/srv/fake-langserver-${generation}`, '--stdio'],
    cwd: generations.cwd,
    env: [],
  })
  const assembly = createLspRealmAssembly({
    assembly: { minAbiVersion: 3 },
    trustRoot: null,
    scratchRoot: join(root, 'scratch'),
    policyFor,
    deps: fakeDepsOf(world.spawned) as never,
    journal: (event) => { world.events.push(event as Record<string, unknown>) },
    ready: async () => true, // the transport is canned; readiness scripting is the assembly spec's own leg (a5lsp2), not this supply's
    terminateGraceMs: 50,
    terminateDeadlineMs: 1_000,
  })
  return { assembly, policyFor }
}

describe('A5M2-G3-LSP-REALM-SUPPLY C1 — the supply over the REAL realm assembly', () => {
  it('(1) the supply surface is CLOSED and hard-visits the published face', () => {
    expect(SUPPLY.createA5LspRealmSupply({ assembly: {}, memberId: MEMBER, serverIdentityOf: () => 'x', extra: 1 } as never).code).toBe(SUPPLY.A5_LSP_SUPPLY_CODES.INPUT_INVALID)
    expect(SUPPLY.createA5LspRealmSupply({ memberId: MEMBER, serverIdentityOf: () => 'x' } as never).code).toBe(SUPPLY.A5_LSP_SUPPLY_CODES.INPUT_INVALID)
    const world: WorldOut = { events: [], spawned: [] }
    const { assembly } = makeAssembly(world)
    expect(SUPPLY.createA5LspRealmSupply({ assembly, memberId: MEMBER } as never).code, 'generation is REQUIRED (the execution face of the approved tuple)').toBe(SUPPLY.A5_LSP_SUPPLY_CODES.INPUT_INVALID)
    expect(SUPPLY.createA5LspRealmSupply({ assembly, memberId: MEMBER, generation: '', serverIdentityOf: () => 'x' } as never).code).toBe(SUPPLY.A5_LSP_SUPPLY_CODES.INPUT_INVALID)
  })

  it('(2) the supply rides the assembly discipline: assemble -> HOT reuse -> generation-mismatch REFUSE -> policyChange destroy/rebuild (journal ordered) -> net-zero', async () => {
    const world: WorldOut = { events: [], spawned: [] }
    const { assembly, policyFor } = makeAssembly(world)
    const supply = SUPPLY.createA5LspRealmSupply({ assembly, memberId: MEMBER, generation: 'g1', serverIdentityOf: (m: string, g: string) => policyFor(m, g).argv[0] })
    expect(supply.memberId).toBe(MEMBER)
    const first = await supply.syncGeneration('g1')
    expect(first.status).toBe('assembled')
    expect(first.ok).toBe(true)
    const hot = await supply.syncGeneration('g1')
    expect(hot.status).toBe('hot-reuse')
    expect(world.spawned.length, 'HOT reuse started NO second process').toBe(1)
    // the discipline entry: a generation change through ensure REFUSES
    const refused = await assembly.ensure(MEMBER, 'g2')
    expect(refused.ok).toBe(false)
    const moved = await supply.syncGeneration('g2')
    expect(moved.status).toBe('policy-changed')
    expect(world.spawned.length).toBe(2)
    const kinds = world.events.map((e) => e.kind)
    expect(kinds).toEqual(['realm-assembled', 'policy-change-begin', 'realm-disposed', 'realm-assembled', 'policy-change-complete'])
    const disposed = world.events.find((e) => e.kind === 'realm-disposed')
    const assembledFirst = world.events.find((e) => e.kind === 'realm-assembled')
    expect(disposed).toMatchObject({ memberId: MEMBER, generation: 'g1', lastPid: assembledFirst?.pid })
    expect(world.spawned[0]?.signals).toContain('SIGTERM')
    const torn = await supply.drainAll()
    expect(torn.ok).toBe(true)
    expect((assembly as unknown as { size: () => number }).size()).toBe(0)
    expect(supply.facts.server()).toBeNull()
  })

  it('(3) the four §5.2 facts: live-only server (policy identity), canonical locator + REAL stat revision (drift moves it), realm mapping MOVES with the generation, scope inside/outside both ways', async () => {
    const world: WorldOut = { events: [], spawned: [] }
    const { assembly, policyFor } = makeAssembly(world)
    const supply = SUPPLY.createA5LspRealmSupply({ assembly, memberId: MEMBER, generation: 'g1', serverIdentityOf: (m: string, g: string) => policyFor(m, g).argv[0] })
    // no realm yet: server refuses, nothing substitutes
    expect(supply.facts.server()).toBeNull()
    expect(supply.facts.documentRealm('src/a.ts', ws)).toBeNull()
    // documents resolve against REAL files BEFORE any realm (locator/revision are facts, realm is not)
    const doc = supply.facts.document('src/a.ts', ws)
    expect(doc).not.toBeNull()
    expect(doc?.kind).toBe('workspace')
    expect(doc?.canonicalLocator).toBe('src/a.ts')
    expect(String(doc?.revision)).toMatch(/^stat:v1:\d+:\d+$/)
    expect(supply.facts.document('src/a.ts', ws)?.revision, 'same bytes -> same revision (reproducible fact)').toBe(doc?.revision)
    expect(supply.facts.document('src/missing.ts', ws), 'a missing file is UNRESOLVABLE, never guessed').toBeNull()
    expect(supply.facts.document('../escape/a.ts', ws), 'a ..-escape is unresolvable before it resolves').toBeNull()
    const absInside = supply.facts.document(join(ws, 'src', 'a.ts'), ws)
    expect(absInside?.kind).toBe('absolute-path')
    // scope: inside for both spellings, outside for a sibling tree
    expect(supply.facts.documentScope('src/a.ts', ws)).toBe('inside')
    expect(supply.facts.documentScope(join(ws, 'src', 'a.ts'), ws)).toBe('inside')
    expect(supply.facts.documentScope(join(root, 'scratch', 'a.ts'), ws)).toBe('outside')
    expect(supply.facts.documentScope('../escape/a.ts', ws)).toBe('outside')
    // realm mapping rides the live generation, spelling lsp:<member>:<gen>
    await supply.syncGeneration('g1')
    expect(supply.facts.documentRealm('src/a.ts', ws)).toBe(SUPPLY.a5LspRealmId(MEMBER, 'g1'))
    expect(supply.facts.documentRealm(join(root, 'scratch', 'a.ts'), ws), 'an out-of-scope locator vouches for NO realm').toBeNull()
    expect(supply.facts.server()).toEqual({ binaryIdentity: '/srv/fake-langserver-g1', generation: 'g1' })
    // drift: an edit moves the revision (the arm's entry recheck re-reads exactly this)
    writeFileSync(join(ws, 'src', 'a.ts'), 'export const a = 2\n', 'utf8')
    const drifted = supply.facts.document('src/a.ts', ws)
    expect(drifted?.revision).not.toBe(doc?.revision)
    // generation move: the realm answer MOVES (a mount naming the old realm then reads SCOPE_ESCAPED by construction)
    await supply.syncGeneration('g2')
    expect(supply.facts.documentRealm('src/a.ts', ws)).toBe(SUPPLY.a5LspRealmId(MEMBER, 'g2'))
    expect(supply.facts.server()).toEqual({ binaryIdentity: '/srv/fake-langserver-g2', generation: 'g2' })
    // a serverIdentityOf that refuses to answer = no server fact, never an inferred one
    const silent = SUPPLY.createA5LspRealmSupply({ assembly, memberId: MEMBER, generation: 'g1', serverIdentityOf: () => null })
    expect(silent.facts.server()).toBeNull()
    await supply.drainAll()
  })

  it('(4) INTEGRATION: the REAL wiring + REAL delegate arm eat this REAL supply — four operations WALK TO SERVED; realm-moved / document-edited / realm-disposed each refuse with ZERO body', async () => {
    const world: WorldOut = { events: [], spawned: [] }
    const { assembly, policyFor } = makeAssembly(world)
    const supply = SUPPLY.createA5LspRealmSupply({ assembly, memberId: MEMBER, generation: 'g1', serverIdentityOf: (m: string, g: string) => policyFor(m, g).argv[0] })
    await supply.syncGeneration('g1')

    const HEADER = 's-header-1'
    const bindingFactsValue = { bindingId: 'a5p1:scope:lsp', bindingRevision: 1, policyGeneration: 3, authorityGeneration: 0 }
    const placed = new Map<string, unknown>()
    let bodyRuns = 0
    const native = {
      name: 'lsp',
      description: 'native lsp production description',
      parameters: {
        type: 'object',
        properties: {
          operation: { type: 'string', enum: ['goToDefinition', 'findReferences', 'goToImplementation', 'hover'] },
          file_path: { type: 'string' },
          line: { type: 'number' },
          character: { type: 'number' },
        },
        required: ['operation', 'file_path', 'line', 'character'],
        additionalProperties: false,
      },
      execute: async () => { bodyRuns += 1; return { served: bodyRuns } },
      output: { schema: { type: 'object' }, render: (v: unknown) => JSON.stringify(v) },
    }
    const walks: Array<Record<string, unknown>> = []
    const closePlans: string[] = []
    const pa = {
      open: async (walk: Record<string, unknown>) => {
        walks.push(walk)
        const grant = Object.freeze({ grantId: `grant-${String(walks.length)}`, callId: walk.callId, realmId: walk.realmId, bindingId: bindingFactsValue.bindingId, bindingRevision: bindingFactsValue.bindingRevision, parametersFingerprint: walk.parametersFingerprint, singleUse: true })
        return { kind: 'approved', grant }
      },
      edge: async (input: Record<string, unknown>) => ({ kind: 'allow', consumedProof: { grant: input.grant } }),
      closePlan: (callId: string) => { closePlans.push(callId) },
    }
    const armRealmId = supply.realmIdOf('g1') // THE mount-round spelling: name the CURRENT realm at mount
    const asm = WIRING.buildG3LspWiring({
      realmId: armRealmId,
      providerId: 'g3-lsp-supply-provider',
      memberAgentId: MEMBER,
      sessionHeaderId: HEADER,
      readNative: () => native,
      lspFacts: supply.facts,
      bindingFacts: () => ({ ...bindingFactsValue }),
      placementFeed: (name: string) => (placed.has(name) ? { definitionIdentity: `lsp@supply-${name}`, realmId: armRealmId } : undefined),
      identityOf: () => 'lsp@supply-lsp',
      pa,
    }) as Built
    expect(asm.ok).toBe(true)
    const definition = asm.definitions?.[0]
    if (definition !== undefined) placed.set('lsp', definition)
    const execFor = (callId: string) => Object.freeze({
      token: { t: callId },
      callId,
      agent: { id: MEMBER, session: { header: { id: HEADER, cwd: ws } } },
    })
    // ALL FOUR operations walk to SERVED through the real supply (the walk
    // goes BEYOND every P_LSP_* refusal — this is the center's 四 op 腿).
    for (const [index, operation] of ['goToDefinition', 'findReferences', 'goToImplementation', 'hover'].entries()) {
      const answer = await definition?.execute({ operation, file_path: 'src/a.ts', line: 7, character: 3 }, execFor(`call-walk-${String(index)}`))
      expect(answer, `${operation} must SERVE`).toEqual({ served: index + 1 })
    }
    expect(bodyRuns).toBe(4)
    // the durable walk carries the REAL supply's facts at full value
    const walk = walks[0] as { family: { targetManifest: Record<string, unknown> } }
    expect(walk.family.targetManifest).toMatchObject({
      realmId: 'lsp:agent-member-1:g1',
      docKind: 'workspace',
      canonicalLocator: 'src/a.ts',
      serverBinaryIdentity: '/srv/fake-langserver-g1',
      serverGeneration: 'g1',
      workspaceCwd: ws,
    })
    expect(String(walk.family.targetManifest.documentRevisionJson)).toMatch(/^"stat:v1:/)

    // NEGATIVE 1 — realm moved: the generation changes under the mount; the
    // mount still names the OLD realm -> SCOPE_ESCAPED at classify, zero body.
    await supply.syncGeneration('g2')
    const moved = await definition?.execute({ operation: 'hover', file_path: 'src/a.ts', line: 7, character: 3 }, execFor('call-moved')).catch((error: { code?: string }) => error)
    expect((moved as { code?: string }).code).toBe('P_LSP_REALM_SCOPE_ESCAPED')
    expect(bodyRuns).toBe(4)

    // NEGATIVE 2 — document edited between approval and entry: restore the
    // realm spelling match, then move the revision INSIDE the walk (the edge
    // hook edits the file after classify; the entry recheck re-reads it).
    const remounted = WIRING.buildG3LspWiring({
      realmId: supply.realmIdOf('g2'),
      providerId: 'g3-lsp-supply-provider',
      memberAgentId: MEMBER,
      sessionHeaderId: HEADER,
      readNative: () => native,
      lspFacts: supply.facts,
      bindingFacts: () => ({ ...bindingFactsValue }),
      placementFeed: (name: string) => (placed.has(name) ? { definitionIdentity: `lsp@supply-${name}`, realmId: supply.realmIdOf('g2') } : undefined),
      identityOf: () => 'lsp@supply-lsp',
      pa: {
        open: pa.open,
        edge: async (input: Record<string, unknown>) => {
          writeFileSync(join(ws, 'src', 'a.ts'), 'export const a = 3 // moved mid-walk\n', 'utf8')
          return { kind: 'allow', consumedProof: { grant: input.grant } }
        },
        closePlan: pa.closePlan,
      },
    }) as Built
    const drifted = await remounted.definitions?.[0]?.execute({ operation: 'goToDefinition', file_path: 'src/a.ts', line: 7, character: 3 }, execFor('call-drift')).catch((error: { code?: string }) => error)
    expect((drifted as { code?: string }).code, 'the entry recheck re-reads the REAL revision fact').toBe('P_LSP_TARGET_DRIFT')
    expect(bodyRuns, 'the edit refused BEFORE the body').toBe(4)

    // NEGATIVE 3 — realm disposed: nothing answers the server fact; the arm
    // refuses UNRESOLVED, a bare-process reach never substitutes.
    await supply.drainAll()
    const dead = await remounted.definitions?.[0]?.execute({ operation: 'hover', file_path: 'src/a.ts', line: 7, character: 3 }, execFor('call-dead')).catch((error: { code?: string }) => error)
    expect((dead as { code?: string }).code).toBe('P_LSP_TARGET_UNRESOLVED')
    expect(bodyRuns).toBe(4)
    // closePlan law: it rides every OPEN walk (4 served + the drift refusal,
    // which dies AFTER the edge); a CLASSIFICATION refusal never opened a
    // plan, so it has nothing to close — the bridge closes only what it opened.
    expect(closePlans.length).toBe(5)
  })

  it('(6) THE QUERY BACKEND (root ruling P1-a/P1-b): the FIRST CALL assembles the APPROVED generation (the real lifecycle trigger — zero manual sync), speaks STANDARD LSP over the confined pipes, and answers the 639 closed union', async () => {
    const world: WorldOut = { events: [], spawned: [] }
    const { assembly, policyFor } = makeAssembly(world)
    const supply = SUPPLY.createA5LspRealmSupply({ assembly, memberId: MEMBER, generation: 'g1', serverIdentityOf: (m: string, g: string) => policyFor(m, g).argv[0] })
    expect(world.spawned.length, 'zero process before the first governed work (the lazy law stands)').toBe(0)
    const hover = await supply.query({ operation: 'hover', file_path: 'src/a.ts', workspaceRoot: ws, line: 7, character: 3 })
    expect(hover.kind).toBe('hover')
    const contents = ((hover as { hover?: { contents?: string } | null }).hover ?? {})?.contents ?? ''
    expect(contents, 'the ONE-BASED grammar maps onto the zero-based protocol').toContain('at 6,2')
    expect(contents).toContain('HOVER canned')
    expect(world.spawned.length, 'THE FIRST CALL DROVE THE REAL LIFECYCLE (the trigger the review found missing)').toBe(1)
    expect([...(world.spawned[0]?.requests ?? [])].slice(0, 5)).toEqual(['initialize', 'initialized', 'textDocument/didOpen', 'textDocument/hover', 'textDocument/didClose'])
    const def = await supply.query({ operation: 'goToDefinition', file_path: 'src/a.ts', workspaceRoot: ws, line: 1, character: 1 })
    expect(def.kind).toBe('locations')
    expect((def as { locations: unknown[] }).locations.length).toBe(1)
    const refs = await supply.query({ operation: 'findReferences', file_path: 'src/a.ts', workspaceRoot: ws, line: 1, character: 1 })
    expect((refs as { locations: unknown[] }).locations.length).toBe(2)
    const impl = await supply.query({ operation: 'goToImplementation', file_path: 'src/a.ts', workspaceRoot: ws, line: 1, character: 1 })
    expect(impl.kind, 'LocationLink/Location answers normalize onto the closed union').toBe('locations')
    expect(world.spawned.length, 'hot reuse across calls (one realm per member x generation)').toBe(1)
    expect(supply.facts.server()?.generation, 'the approved generation is the ensured one').toBe('g1')
    const torn = await supply.drainAll()
    expect(torn.ok).toBe(true)
    await expect(supply.query({ operation: 'hover', file_path: 'src/a.ts', workspaceRoot: ws, line: 1, character: 1 })).rejects.toThrow(/DRAINED/)
  })

  it('(7) THE DELEGATE PORT: prepare is the effect entry AND the lifecycle; drift/handleStatus/liveHandles ride the LIVE instance; cancelCleanup RECLAIMS the in-flight wire request; drainAll REJECTS what is pending', async () => {
    const world: WorldOut = { events: [], spawned: [] }
    const { assembly, policyFor } = makeAssembly(world)
    const supply = SUPPLY.createA5LspRealmSupply({ assembly, memberId: MEMBER, generation: 'g1', serverIdentityOf: (m: string, g: string) => policyFor(m, g).argv[0] })
    const port = supply.controlPort
    const started: Array<Record<string, unknown>> = []
    const startedRow = (): Record<string, unknown> => {
      const row = started[0]
      if (row === undefined) throw new Error('recordStarted never answered the realm resource')
      return row
    }
    const execOf = { agent: { session: { header: { cwd: ws } } } }
    // pre-effect cancel: the honest zero-effect word, nothing entered
    const cancelled = await port.prepare({ canonical: { operation: 'hover', file_path: 'src/a.ts', line: 1, character: 1 }, exec: execOf, isCancelled: () => true, recordStarted: (r: Record<string, unknown>) => { started.push(r) } })
    expect((cancelled as { zeroEffects?: boolean }).zeroEffects).toBe(true)
    expect((cancelled as { code?: string }).code).toBe(SUPPLY.A5_LSP_SUPPLY_CODES.CANCELLED_BEFORE_EFFECT)
    expect(world.spawned.length).toBe(0)
    // the real prepare: the lifecycle runs HERE (P1-b, the port path)
    const prepared = await port.prepare({
      canonical: { operation: 'hover', file_path: 'src/a.ts', line: 2, character: 4 },
      exec: execOf,
      isCancelled: () => false,
      recheckFacts: () => null,
      recordStarted: (r: Record<string, unknown>) => { started.push(r) },
    }) as { ok: boolean, handle?: { identity?: Record<string, unknown>, invoke?: () => Promise<unknown> } }
    expect(prepared.ok).toBe(true)
    expect(world.spawned.length).toBe(1)
    expect(started[0]).toMatchObject({ __kind: 'lsp-realm-instance', generation: 'g1' })
    // the live seams read the REAL instance
    const handle = prepared.handle as { identity: Record<string, unknown>, invoke: () => Promise<unknown> }
    expect(port.handleStatus(handle as unknown as Record<string, unknown>).live).toBe(true)
    expect(port.drift({})(handle as unknown as Record<string, unknown>), 'no move -> null').toBeNull()
    expect(port.liveHandles(MEMBER).length).toBe(1)
    // the reclaim: a server that never answers; cancelCleanup RECLAIMS the
    // wire request ($/cancelRequest on the pipe, typed reject into the call)
    const proc = world.spawned[0] as { hang: boolean, cancels: number[] } | undefined
    if (proc === undefined) throw new Error('the prepared call answered no realm process')
    proc.hang = true
    const inFlight = handle.invoke()
    const inFlightSettled = inFlight.catch((error: unknown) => error) // handler attached AT creation (no unhandled-rejection window)
    const refused = await Promise.race([
      inFlightSettled.then(() => null),
      new Promise((r) => setTimeout(() => r('PENDING-AS-EXPECTED'), 30)),
    ])
    expect(refused, 'a hanging server keeps the call pending (no premature settle)').toBe('PENDING-AS-EXPECTED')
    const cleaned = await port.cancelCleanup(startedRow(), { exec: execOf, reason: 'spec cancel' })
    expect((cleaned as { cleaned?: boolean }).cleaned).toBe(true)
    const edge = await inFlightSettled
    expect((edge as { code?: string }).code).toBe(SUPPLY.A5_LSP_SUPPLY_CODES.CANCELLED)
    expect(proc.cancels.length, 'the wire was TOLD about the cancellation').toBeGreaterThanOrEqual(1)
    // drain REJECTS what is still pending (the real backend is net-zero too)
    proc.hang = true
    const second = await Promise.all([
      handle.invoke().catch((error: unknown) => error), // handler attached AT creation
      (async () => await supply.drainAll())(),
    ])
    expect(second[1]).toMatchObject({ ok: true })
    const edge2 = second[0]
    expect((edge2 as { code?: string }).code).toBe(SUPPLY.A5_LSP_SUPPLY_CODES.DRAINED)
    expect((assembly as unknown as { size: () => number }).size()).toBe(0)
  })
})
