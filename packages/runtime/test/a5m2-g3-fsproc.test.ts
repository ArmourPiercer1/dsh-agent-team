/**
 * a5m2-g3-fsproc.test.ts — A5-M2 G3 (FS-PROC) C1/C2-shape legs for the
 * g3-fsproc-adapters module + the census-mandated GAP-CLOSURE fixed points.
 *
 * Families (dispatch index M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json, records
 * 12-17 B-TERMINAL, 18-20 B-JOB, 21 B-LSP, 64 B-PTC):
 *
 *  - B-TERMINAL (terminal_open/close/list/read/send/signal): declared_mount
 *    arms over CAPTURED native definitions (native doubles here mirror the
 *    pinned tool-terminal bodies: they pair on exec.agent and read the call
 *    signal — the real bodies are the CENTER's mount job; this spec proves
 *    the ARM laws: closed parameter surface, declared-backend selection
 *    (§5.1), declared-absent typed refusal with zero reach, identity
 *    pairing, single consume, commit-edge cancel, drain with no fallback,
 *    definition drift).
 *  - B-LSP (lsp): closed FOUR-operation navigation set, one-based UTF-16
 *    coordinate law, the REAL sessionCwd path (exec.agent.session.header.cwd)
 *    reaching the captured body through the snapshot; no generic fallback.
 *  - B-PTC (run_code): the outer arm (run_code row itself is a NAMED GAP —
 *    the plane only reserves the name at team-tool-plane.mjs:468 today);
 *    escalation args are manifest DATA under the ONE pinned mode vocabulary
 *    (PTC_ESCALATION_MODES, ptc-escalation-row.mjs — the MOUNTED adjudication
 *    bridge stays the only escalation answerer; this arm exposes no approval
 *    face at all) and nested-tools-second-governance is a manifest fact.
 *  - B-JOB (job_output/job_list/job_kill): NO new face — the trio is already
 *    mounted (team-tool-plane.mjs:1902-1958 + createGovernedJobsBridge), the
 *    live-bridge delegate and the shut fallback are pinned by
 *    a5p7-jobs-assembly-actuator.test.ts, and the wait/cancel abort legs by
 *    its ROOT④b family. THE uncovered leg pinned here: the management path
 *    (read/kill) across the gateway's DRAINING state — cancel stays reachable
 *    for the owner while new admits are refused, the foreign member still
 *    meets owner-mismatch with ZERO host touch, and the kill-requested
 *    ledger distinction keeps answering after the drain.
 *
 * + the r9 CANONICAL-SCHEMA fixed point: every registration face exported by
 *   the module passes the REAL pinned host validator (assertSupported-
 *   JsonSchema @ tests/deepseek-harness-test-use core/tools lib @639ed01539)
 *   with no property-level `required: true` marker anywhere, exact parent
 *   arrays, and the SAME validator still rejecting a missing member.
 *
 * Native faces recorded at the pin (report facts, proven by these legs):
 *   terminals: TerminalSessionService spawn:154/startSend:243/read:263/
 *     signal:274/kill:285/list:308 @packages/terminal/terminal/src/index.ts;
 *     tools @packages/terminal/tool-terminal/src/index.ts:164/199/302/335/
 *     360/391.
 *   lsp: Lsp.query(request, signal) @packages/lsp/lsp/src/index.ts:143;
 *     tool @packages/lsp/tool-lsp/src/index.ts:110+; parseLspArgs oneBased
 *     @.../render.ts:46; sessionCwd @.../session-cwd.ts:15.
 *   jobs: JobRegistry start/list/get/read/readAt/kill/wait @packages/jobs/
 *     jobs/src/index.ts (NO owner()/done() at the pin).
 *   ptc: RUN_CODE_NAME:30, createRunCodeTool:333, escalation pair-law
 *     approveEscalation @packages/core/tools/src/ptc.ts.
 *
 * Scope: NO Host process, NO network. Windows legs: NOT_RUN_WINDOWS_
 * UNAUTHORIZED. Worlds are pure in-memory doubles.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-g3-fsproc
 */
import { describe, expect, it } from 'vitest'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { findTestRepoRoot } from '../../../tests/paths.mjs'

interface ArmResult {
  ok: boolean
  code?: string
  detail?: string
  settled?: string
  plan?: Record<string, unknown>
  effects?: ReadonlyArray<{ kind: string; toolName: string; resource: null }>
  parametersFingerprint?: string
  manifest?: Record<string, unknown>
  reviewPayload?: Record<string, unknown>
  [k: string]: unknown
}
interface Arm {
  familyId: string
  toolName: string
  declaredAbsent: boolean
  classify: (args: unknown, exec: unknown, callId: string) => ArmResult
  prepare: (plan: unknown, grant?: unknown) => ArmResult
  execute: (plan: unknown, consumed: unknown) => Promise<ArmResult>
  cancel: (plan: unknown) => ArmResult
  drain: () => void
}
type BindingFacts = { bindingId: string; bindingRevision: number; policyGeneration: number; authorityGeneration: number }

const G3 = (await import(new URL('../src/plugin/live/governed-families/g3-fsproc-adapters.mjs', import.meta.url).href)) as {
  A5_G3_ADAPTER_REVISION: number
  A5_G3_FAMILIES: Record<string, string>
  A5_G3_LSP_OPERATIONS: readonly string[]
  A5_G3_TERMINAL_SIGNALS: readonly string[]
  A5_G3_TERMINAL_TYPED_CODES: Record<string, string>
  A5_G3_LSP_TYPED_CODES: Record<string, string>
  A5_G3_PTC_TYPED_CODES: Record<string, string>
  A5_G3_TERMINAL_OPEN_PARAMETERS: Record<string, unknown>
  A5_G3_TERMINAL_SEND_PARAMETERS: Record<string, unknown>
  A5_G3_TERMINAL_READ_PARAMETERS: Record<string, unknown>
  A5_G3_TERMINAL_SIGNAL_PARAMETERS: Record<string, unknown>
  A5_G3_TERMINAL_CLOSE_PARAMETERS: Record<string, unknown>
  A5_G3_TERMINAL_LIST_PARAMETERS: Record<string, unknown>
  A5_G3_LSP_PARAMETERS: Record<string, unknown>
  A5_G3_PTC_PARAMETERS: Record<string, unknown>
  createGovernedTerminalArms: (deps: Record<string, unknown>) => Record<TerminalName, Arm>
  createGovernedLspArm: (deps: Record<string, unknown>) => Arm
  createGovernedRunCodeArm: (deps: Record<string, unknown>) => Arm
}

// The ONE escalation-vocabulary source the arm must reuse (existing mounted
// row — read-only import, proves the single-source pairing).
const PTC_ROW = (await import(new URL('../src/plugin/live/ptc-escalation-row.mjs', import.meta.url).href)) as {
  PTC_ESCALATION_MODES: readonly string[]
}

const GW = (await import(new URL('../src/plugin/live/jobs-gateway-assembly.mjs', import.meta.url).href)) as {
  createLiveJobsGatewayAssembly: (opts: { teamRoot: unknown; rootSessionId: string }) => {
    definitions: { register: (scopeKey: string, name: string, identity: string) => void }
    attributeBackgroundJob: (i: { hostJobId: string; owner: { rootSessionId: string; instanceId: string }; scopeKey: string; toolName?: string }) => { ok: boolean }
    observations: () => Array<Record<string, unknown>>
    drain: () => { ok: boolean }
  }
  jobsBridgeScopeKey: (t: { realmId: string; rootSessionId: string; instanceId: string }) => string
}
const BE = (await import(new URL('../src/plugin/live/plane-effect-backends.mjs', import.meta.url).href)) as {
  createGovernedJobsBridge: (deps: Record<string, unknown>) => {
    jobOutput: (args: Record<string, unknown>, caller: string | undefined, signal?: AbortSignal) => Promise<{ text: string }>
    jobList: (caller: string | undefined) => Promise<{ text: string }>
    jobKill: (args: Record<string, unknown>, caller: string | undefined) => Promise<{ text: string }>
  }
}

const AGENT_ID = 'agent-member-1'
const HEADER_ID = 'ses-header-g3'
const CWD = '/work/member-space'

function makeExec(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    agent: { id: AGENT_ID, session: { header: { id: HEADER_ID, cwd: CWD } } },
    signal: new AbortController().signal,
    callId: 'hostcall-1',
    ...over,
  }
}

function makeBinding() {
  let facts: BindingFacts = { bindingId: 'bind-g3', bindingRevision: 1, policyGeneration: 1, authorityGeneration: 1 }
  return {
    read: (): BindingFacts => ({ ...facts }),
    bump: (patch: Partial<BindingFacts>) => { facts = { ...facts, ...patch } },
  }
}

/** A native-definition DOUBLE: the caller's object IS what the arm must
 *  enter (never a re-lookup by name); every entry is counted with the exec
 *  it received so identity/snapshot claims are MEASURED. */
type TerminalName = 'terminal_open' | 'terminal_send' | 'terminal_read' | 'terminal_signal' | 'terminal_close' | 'terminal_list'
const TERMINAL_NAMES: readonly TerminalName[] = ['terminal_open', 'terminal_send', 'terminal_read', 'terminal_signal', 'terminal_close', 'terminal_list']

function makeNative(name: string, behavior?: (args: Record<string, unknown>, exec: Record<string, unknown>) => unknown) {
  const calls: Array<{ args: Record<string, unknown>; exec: Record<string, unknown>; agent: unknown }> = []
  const def: { name: string; execute: (args: Record<string, unknown>, exec: Record<string, unknown>) => Promise<unknown> } = {
    name,
    execute: async (args, exec) => {
      const agent = exec?.agent as { session?: { header?: { cwd?: string } } } | undefined
      calls.push({ args, exec, agent: exec?.agent })
      return behavior === undefined ? { echoed: args, cwd: agent?.session?.header?.cwd, hostCallId: exec?.callId } : behavior(args, exec)
    },
  }
  return { def, calls }
}

function terminalWorld(deps: { absent?: boolean; declaredBackends?: string[] } = {}) {
  const binding = makeBinding()
  const natives: Record<TerminalName, ReturnType<typeof makeNative>> = {} as Record<TerminalName, ReturnType<typeof makeNative>>
  const nativeDefinitions: Record<string, unknown> = {}
  const definitionIdentities: Record<string, string> = {}
  for (const name of TERMINAL_NAMES) {
    natives[name] = makeNative(name)
    if (deps.absent !== true) {
      nativeDefinitions[name] = natives[name].def
      definitionIdentities[name] = `${name}@v1`
    }
  }
  const arms = G3.createGovernedTerminalArms({
    nativeDefinitions: deps.absent === true ? {} : nativeDefinitions,
    definitionIdentities: deps.absent === true ? {} : definitionIdentities,
    declaredBackends: deps.declaredBackends ?? ['shell'],
    providerId: 'g3-test-provider',
    memberAgentId: AGENT_ID,
    sessionHeaderId: HEADER_ID,
    bindingFacts: binding.read,
  })
  return { arms, natives, binding }
}

/** classify → prepare → execute over the consumed edge, with a grant that
 *  answers the plan (the pair the REAL A edge produces; the kernel itself is
 *  pinned by the M1 specs). */
async function runPass(arm: Arm, binding: { read: () => BindingFacts }, args: unknown, callId = 'call-1', exec = makeExec()) {
  const c = arm.classify(args, exec, callId)
  if (c.ok !== true) throw new Error(`classify refused: ${c.code} ${c.detail}`)
  const plan = c.plan as Record<string, unknown>
  expect(arm.prepare(plan, { grantId: 'grant-1' }).ok).toBe(true)
  const facts = binding.read()
  const grant = {
    grantId: 'grant-1',
    callId: plan.callId,
    parametersFingerprint: plan.parametersFingerprint,
    bindingId: facts.bindingId,
    bindingRevision: facts.bindingRevision,
  }
  const x = await arm.execute(plan, { consumed: true, grant })
  return { c, plan, x }
}

describe('g3 B-TERMINAL — six declared_mount arms over captured native definitions', () => {
  it('all six classify to the exact tool-invoke effect + family reviewPayload, ZERO native entries', () => {
    const w = terminalWorld()
    const argsByTool: Record<string, unknown> = {
      terminal_open: { type: 'shell', name: 'build' },
      terminal_send: { sessionId: 'pty-1', text: 'make\n' },
      terminal_read: { sessionId: 'pty-1', count: 50 },
      terminal_signal: { sessionId: 'pty-1', signal: 'SIGINT' },
      terminal_close: { sessionId: 'pty-1' },
      terminal_list: {},
    }
    for (const name of TERMINAL_NAMES) {
      const args = argsByTool[name]
      const r = w.arms[name].classify(args, makeExec(), `call-${name}`)
      expect(r.ok, `${name}: ${r.code} ${r.detail}`).toBe(true)
      expect(r.effects).toEqual([{ kind: 'tool-invoke', toolName: name, resource: null }])
      expect(r.reviewPayload?.familyId).toBe('B-TERMINAL')
      expect(r.reviewPayload?.adapterRevision).toBe(G3.A5_G3_ADAPTER_REVISION)
      expect((r.reviewPayload?.definitionIdentity as string)).toBe(`${name}@v1`)
      expect(typeof r.parametersFingerprint).toBe('string')
      expect(String(r.parametersFingerprint).startsWith('sha256:')).toBe(true)
      expect(w.natives[name].calls.length).toBe(0)
    }
    expect(w.arms.terminal_open.classify({ type: 'shell' }, makeExec(), 'x').manifest?.operation).toBe('pty-spawn')
    expect(w.arms.terminal_send.classify({ sessionId: 'p', text: '' }, makeExec(), 'x').manifest?.operation).toBe('stdin-write')
    expect(w.arms.terminal_list.classify({}, makeExec(), 'x').manifest?.ownerScoped).toBe(true)
  })

  it('DECLARED_MOUNT law: an undeclared/internal backend type and an absent declared service refuse TYPED with zero reach', () => {
    const w = terminalWorld()
    const internal = w.arms.terminal_open.classify({ type: 'g3-internal-one-shot-9f2' }, makeExec(), 'c1')
    expect(internal.ok).toBe(false)
    expect(internal.code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.BACKEND_NOT_DECLARED)
    expect(w.natives.terminal_open.calls.length).toBe(0)

    const shut = terminalWorld({ absent: true })
    for (const arm of Object.values(shut.arms)) {
      expect(arm.declaredAbsent).toBe(true)
      const r = arm.classify({ type: 'shell', sessionId: 'pty-1', text: 'x', signal: 'SIGINT' }, makeExec(), 'c2')
      expect(r.ok).toBe(false)
      expect(r.code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.DECLARED_ABSENT)
    }
  })

  it('identity pairing rides the REAL Host face: a foreign agent or a headerless exec never classifies', () => {
    const w = terminalWorld()
    const foreign = w.arms.terminal_list.classify({}, makeExec({ agent: { id: 'agent-other', session: { header: { id: HEADER_ID } } } }), 'c')
    expect(foreign.code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.FOREIGN_SESSION)
    const foreignHeader = w.arms.terminal_list.classify({}, makeExec({ agent: { id: AGENT_ID, session: { header: { id: 'other-header' } } } }), 'c')
    expect(foreignHeader.code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.FOREIGN_SESSION)
    const bare = w.arms.terminal_list.classify({}, {}, 'c')
    expect(bare.code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.NO_OWNING_SESSION)
    const unknown = w.arms.terminal_read.classify({ sessionId: 'p', limit: 3 }, makeExec(), 'c')
    expect(unknown.code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.UNKNOWN_PARAMETER)
  })

  it('terminal_send full pass: the captured body is entered EXACTLY ONCE with the snapshot (captured Agent reference, caller omission preserved for the host submit default)', async () => {
    const w = terminalWorld()
    const exec = makeExec()
    const { c, x } = await runPass(w.arms.terminal_send, w.binding, { sessionId: 'pty-2', text: 'python3\n' }, 'call-send', exec)
    expect(x.ok).toBe(true)
    const calls = w.natives.terminal_send.calls
    expect(calls.length).toBe(1)
    expect(calls[0]?.agent).toBe(exec.agent) // the CAPTURED reference, not a rebuilt id
    expect(calls[0]?.args).toEqual({ sessionId: 'pty-2', text: 'python3\n' }) // submit omission NOT filled
    expect(c.manifest?.effectiveSubmit).toBe(true) // the host default is manifest DATA
    expect(String(c.manifest?.inputDigest)).toMatch(/^sha256:[0-9a-f]{64}$/)
    // REPLAY: the spent edge refuses, the body stays at one entry.
    const again = await w.arms.terminal_send.execute(c.plan, {
      consumed: true,
      grant: { grantId: 'grant-1', callId: 'call-send', parametersFingerprint: c.parametersFingerprint, ...w.binding.read() },
    })
    expect(again.code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.ALREADY_CONSUMED)
    expect(w.natives.terminal_send.calls.length).toBe(1)
  })

  it('cancel before the edge stops the body (zero entries); commit-edge cancel stops the same-tick body; COMMITTED cannot be retracted', async () => {
    const w = terminalWorld()
    const c1 = w.arms.terminal_close.classify({ sessionId: 'pty-9' }, makeExec(), 'cancel-1')
    expect(w.arms.terminal_close.prepare(c1.plan, { grantId: 'g' }).ok).toBe(true)
    const cancelled = w.arms.terminal_close.cancel(c1.plan)
    expect(cancelled.settled).toBe('CANCELLED-AFTER-ADMISSION')
    expect(String(cancelled.bodyOutcome)).toMatch(/zero/)
    const exec = await w.arms.terminal_close.execute(c1.plan, { consumed: true, grant: { grantId: 'g', callId: 'cancel-1', parametersFingerprint: c1.parametersFingerprint, ...w.binding.read() } })
    expect(exec.code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.CANCELLED)
    expect(w.natives.terminal_close.calls.length).toBe(0)

    // Same-tick edge cancel: execute is entered, the commit-edge re-check
    // sees the CANCELLED state before the body — report and count agree.
    const c2 = w.arms.terminal_close.classify({ sessionId: 'pty-10' }, makeExec(), 'cancel-2')
    expect(w.arms.terminal_close.prepare(c2.plan, { grantId: 'g2' }).ok).toBe(true)
    const running = w.arms.terminal_close.execute(c2.plan, { consumed: true, grant: { grantId: 'g2', callId: 'cancel-2', parametersFingerprint: c2.parametersFingerprint, ...w.binding.read() } })
    const edge = w.arms.terminal_close.cancel(c2.plan)
    expect(edge.settled).toBe('CANCELLED-BEFORE-EXECUTION')
    const done = await running
    expect(done.code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.CANCELLED)
    expect(w.natives.terminal_close.calls.length).toBe(0)
  })

  it('drain stops every NEW call with no fallback; definition drift at the edge refuses before the body', async () => {
    const w = terminalWorld()
    const c = w.arms.terminal_signal.classify({ sessionId: 'pty-3', signal: 'SIGTERM' }, makeExec(), 'drain-1')
    w.arms.terminal_signal.drain()
    const after = w.arms.terminal_signal.classify({ sessionId: 'pty-3', signal: 'SIGTERM' }, makeExec(), 'drain-2')
    expect(after.code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.DRAINING)
    // c was classified BEFORE the drain; the commit-edge drain arm stops it.
    expect(w.arms.terminal_signal.prepare(c.plan, { grantId: 'g' }).code ?? 'ok').toBe(G3.A5_G3_TERMINAL_TYPED_CODES.DRAINING)

    const w2 = terminalWorld()
    const c2 = w2.arms.terminal_open.classify({ type: 'shell' }, makeExec(), 'drift-1')
    expect(w2.arms.terminal_open.prepare(c2.plan, { grantId: 'g' }).ok).toBe(true)
    // The placed definition's execute MOVES after classify (definition
    // replacement): the edge refuses, the moved body is never entered.
    w2.natives.terminal_open.def.execute = async () => ({ moved: true })
    const drift = await w2.arms.terminal_open.execute(c2.plan, { consumed: true, grant: { grantId: 'g', callId: 'drift-1', parametersFingerprint: c2.parametersFingerprint, ...w2.binding.read() } })
    expect(drift.code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.DEFINITION_DRIFT)
    expect(w2.natives.terminal_open.calls.length).toBe(0)
  })

  it('terminal_read keeps the omission law (offset/count null in the manifest, defaults belong to the body) and terminal_signal stays the closed five', async () => {
    const w = terminalWorld()
    const r = w.arms.terminal_read.classify({ sessionId: 'pty-7' }, makeExec(), 'read-1')
    expect(r.manifest?.offset).toBeNull()
    expect(r.manifest?.count).toBeNull()
    expect(w.arms.terminal_read.classify({ sessionId: 'p', count: 0 }, makeExec(), 'x').code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.INVALID_ARGUMENTS)
    expect(w.arms.terminal_signal.classify({ sessionId: 'p', signal: 'SIGSTOP' }, makeExec(), 'x').code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.INVALID_ARGUMENTS)
    const pass = await runPass(w.arms.terminal_read, w.binding, { sessionId: 'pty-7' }, 'read-2')
    expect(pass.x.ok).toBe(true)
    expect(w.natives.terminal_read.calls[0]?.args).toEqual({ sessionId: 'pty-7' })
  })
})

describe('g3 B-LSP — the closed four-operation arm over the captured native lsp definition', () => {
  function lspWorld() {
    const native = makeNative('lsp')
    const binding = makeBinding()
    const arm = G3.createGovernedLspArm({
      nativeDefinition: native.def,
      definitionIdentity: 'lsp@v1',
      providerId: 'g3-test-provider',
      memberAgentId: AGENT_ID,
      sessionHeaderId: HEADER_ID,
      bindingFacts: binding.read,
    })
    return { arm, native, binding }
  }

  it('exactly the four navigation operations classify; ANY fifth spelling (executeCommand/diagnostics) refuses with zero body', () => {
    const w = lspWorld()
    for (const op of G3.A5_G3_LSP_OPERATIONS) {
      const r = w.arm.classify({ operation: op, file_path: 'src/a.ts', line: 10, character: 5 }, makeExec(), `lsp-${op}`)
      expect(r.ok, `${op}: ${r.code}`).toBe(true)
      expect(r.effects).toEqual([{ kind: 'tool-invoke', toolName: 'lsp', resource: null }])
      expect(r.manifest?.navigationOperation).toBe(op)
      expect(r.manifest?.oneBasedLine).toBe(10) // model-facing spelling preserved
      expect(w.native.calls.length).toBe(0)
    }
    for (const op of ['executeCommand', 'diagnostics', 'rename']) {
      const r = w.arm.classify({ operation: op, file_path: 'a.ts', line: 1, character: 1 }, makeExec(), 'x')
      expect(r.ok).toBe(false)
      expect(r.code).toBe(G3.A5_G3_LSP_TYPED_CODES.INVALID_ARGUMENTS)
    }
  })

  it('ONE-BASED UTF-16 coordinate law: zero/fractional coordinates refuse typed (the zero-based conversion stays the native body parseLspArgs law)', () => {
    const w = lspWorld()
    expect(w.arm.classify({ operation: 'hover', file_path: 'a.ts', line: 0, character: 1 }, makeExec(), 'x').code).toBe(G3.A5_G3_LSP_TYPED_CODES.INVALID_ARGUMENTS)
    expect(w.arm.classify({ operation: 'hover', file_path: 'a.ts', line: 1, character: 2.5 }, makeExec(), 'x').code).toBe(G3.A5_G3_LSP_TYPED_CODES.INVALID_ARGUMENTS)
    expect(w.arm.classify({ operation: 'hover', file_path: '  ', line: 1, character: 1 }, makeExec(), 'x').code).toBe(G3.A5_G3_LSP_TYPED_CODES.INVALID_ARGUMENTS)
    expect(w.native.calls.length).toBe(0)
  })

  it('full pass: the captured body receives the snapshot whose agent path IS the host sessionCwd face (exec.agent.session.header.cwd); drain stops later calls', async () => {
    const w = lspWorld()
    const { x } = await runPass(w.arm, w.binding, { operation: 'goToDefinition', file_path: 'src/b.ts', line: 4, character: 12 }, 'lsp-pass')
    expect(x.ok).toBe(true)
    expect(w.native.calls.length).toBe(1)
    expect(((w.native.calls[0]?.exec?.agent ?? {}) as { session?: { header?: { cwd?: string } } }).session?.header?.cwd).toBe(CWD) // session-cwd.ts:15 path
    expect((x.value as Record<string, unknown>).cwd).toBe(CWD)
    w.arm.drain()
    expect(w.arm.classify({ operation: 'hover', file_path: 'a.ts', line: 1, character: 1 }, makeExec(), 'after').code).toBe(G3.A5_G3_LSP_TYPED_CODES.DRAINING)
  })
})

describe('g3 B-PTC — the outer run_code arm (row itself a NAMED GAP; escalation answers live ONLY in the mounted bridge)', () => {
  function ptcWorld() {
    const native = makeNative('run_code')
    const binding = makeBinding()
    const arm = G3.createGovernedRunCodeArm({
      nativeDefinition: native.def,
      definitionIdentity: 'run_code@v1',
      providerId: 'g3-test-provider',
      memberAgentId: AGENT_ID,
      sessionHeaderId: HEADER_ID,
      bindingFacts: binding.read,
    })
    return { arm, native, binding }
  }

  it('a plain program run classifies with digests (never copies) and executes once through the snapshot; nestedToolsSecondGovernance is a manifest fact', async () => {
    const w = ptcWorld()
    const { c, x } = await runPass(w.arm, w.binding, { code: 'const r = await tools.read({ file_path: "a" }); return r', description: 'read a file' }, 'ptc-1')
    expect(x.ok).toBe(true)
    expect(w.native.calls.length).toBe(1)
    expect(c.manifest?.requestedSandboxMode).toBeNull()
    expect(c.manifest?.nestedToolsSecondGovernance).toBe(true)
    expect(String(c.manifest?.codeDigest)).toBe(`sha256:${(await import('node:crypto')).createHash('sha256').update('const r = await tools.read({ file_path: "a" }); return r', 'utf8').digest('hex')}`)
    expect((x.value as Record<string, unknown>).hostCallId).toBe('hostcall-1') // the bridge reads exec.callId
  })

  it('the escalation pair-law is typed at classify: half-pairs and unknown modes refuse, valid pairs ride as manifest DATA under the ONE pinned mode vocabulary — the arm itself never answers an escalation', () => {
    const w = ptcWorld()
    const good = w.arm.classify({ code: 'x', description: 'd', sandbox_permissions: 'workspace-write', justification: 'need to write' }, makeExec(), 'esc-1')
    expect(good.ok).toBe(true)
    expect(good.manifest?.requestedSandboxMode).toBe('workspace-write')
    expect(String(good.manifest?.justificationDigest)).toMatch(/^sha256:/) // digest, not the shown text
    for (const bad of [
      { code: 'x', description: 'd', sandbox_permissions: 'workspace-write' }, // mode without justification
      { code: 'x', description: 'd', justification: 'reason' }, // justification without mode
      { code: 'x', description: 'd', sandbox_permissions: 'danger-everything', justification: 'x' }, // invented mode
    ]) {
      const r = w.arm.classify(bad, makeExec(), 'esc-x')
      expect(r.ok).toBe(false)
      expect(r.code).toBe(G3.A5_G3_PTC_TYPED_CODES.ESCALATION_ARGS_INVALID)
    }
    expect(w.native.calls.length).toBe(0)
    // The single-source law: the arm's mode enum IS the mounted row's.
    expect(((G3.A5_G3_PTC_PARAMETERS.properties ?? {}) as Record<string, { enum?: readonly string[] }>).sandbox_permissions?.enum).toBe(PTC_ROW.PTC_ESCALATION_MODES)
    // The arm carries NO approval face: escalate/allow/adjudicate exist
    // nowhere on it — escalation answers happen only in ptc-escalation-row.
    const faces = Object.keys(w.arm).sort().join(',')
    expect(faces).toBe('adapterRevision,cancel,classify,declaredAbsent,definitionIdentity,drain,execute,familyId,prepare,providerId,toolName')
  })
})

describe('g3 B-JOB gap closure — the management path across the gateway DRAINING state', () => {
  const ROOT = 'root-g3'

  function fakeHostJobs() {
    const jobs = new Map<string, { owner: string; killed: boolean }>()
    const calls: string[] = []
    return {
      calls,
      seed: (id: string, owner: string) => { jobs.set(id, { owner, killed: false }) },
      read: (id: string, caller?: string) => {
        calls.push(`read:${id}:${caller ?? '*'}`)
        const j = jobs.get(id)
        if (j === undefined) throw new Error('unknown job')
        if (caller !== undefined && j.owner !== caller) throw new Error('job belongs to another session')
        return { chunks: [{ at: 0, text: 'output-bytes' }], lossy: false, job: { status: j.killed ? 'stopping' : 'running' } }
      },
      list: (caller?: string) => {
        calls.push(`list:${caller ?? '*'}`)
        return [...jobs.entries()].filter(([, j]) => j.owner === caller).map(([id, j]) => ({ id, kind: 'bash', status: j.killed ? 'stopping' : 'running', label: 'cmd' }))
      },
      kill: (id: string, caller?: string): 'requested' | 'already-finished' => {
        calls.push(`kill:${id}:${caller ?? '*'}`)
        const j = jobs.get(id)
        if (j === undefined) throw new Error('unknown job')
        if (caller !== undefined && j.owner !== caller) throw new Error('job belongs to another session')
        if (j.killed) return 'already-finished'
        j.killed = true
        return 'requested'
      },
    }
  }

  it('after the lease window drains (new admits refused, pinned by the a5p7 specs), the OWNER can still READ and REQUEST KILL; the foreign member still meets owner-mismatch with ZERO host touch; the two kill forms never collapse', async () => {
    const host = fakeHostJobs()
    const domain = { repositories: { memberInstances: { list: (rootKey: string) => (rootKey === ROOT ? [{ instanceId: 'inst-1' }, { instanceId: 'inst-2' }] : []) } } }
    const asm = GW.createLiveJobsGatewayAssembly({ teamRoot: domain, rootSessionId: ROOT })
    const scopeA = GW.jobsBridgeScopeKey({ realmId: 'realm-g3', rootSessionId: ROOT, instanceId: 'inst-1' })
    asm.definitions.register(scopeA, 'bash', 'bash@v1')
    expect(asm.attributeBackgroundJob({ hostJobId: 'jg1', owner: { rootSessionId: ROOT, instanceId: 'inst-1' }, scopeKey: scopeA, toolName: 'bash' }).ok).toBe(true)
    host.seed('jg1', 'agent-1')
    const planeRow = () => ({ placementFeed: (name: string) => ({ definitionIdentity: `${name}@v1`, realmId: 'realm-g3' }) })
    const bridgeA = BE.createGovernedJobsBridge({
      scopeKey: scopeA,
      viewer: { rootSessionId: ROOT, instanceId: 'inst-1' },
      gatewayRow: () => asm,
      planeRow,
      jobsService: () => host,
    })
    // Bridge-B speaks for the FOREIGN member scope over the SAME host face.
    const scopeB = GW.jobsBridgeScopeKey({ realmId: 'realm-g3', rootSessionId: ROOT, instanceId: 'inst-2' })
    const bridgeB = BE.createGovernedJobsBridge({
      scopeKey: scopeB,
      viewer: { rootSessionId: ROOT, instanceId: 'inst-2' },
      gatewayRow: () => asm,
      planeRow,
      jobsService: () => host,
    })

    // DRAIN FIRST: the admission side dies at the first instant (the a5p7
    // specs pin that half); what must SURVIVE is the management path — a
    // policy tightening may never strand a running job beyond cancel.
    expect(asm.drain().ok).toBe(true)
    const callsAtDrain = host.calls.length

    const out = await bridgeA.jobOutput({ job_id: 'jg1' }, 'agent-1')
    expect(out.text).toContain('output-bytes')
    expect(out.text).toContain('[status: running]')

    const denied = await bridgeB.jobKill({ job_id: 'jg1' }, 'agent-2')
    expect(denied.text).toContain('refused: owner-mismatch')
    expect(host.calls.length).toBe(callsAtDrain + 1) // ONLY agent-1's read above — the foreign kill never reached the host

    const killed = await bridgeA.jobKill({ job_id: 'jg1', reason: 'policy tightened' }, 'agent-1')
    expect(killed.text).toBe('requested cancellation of job jg1')
    const obs = asm.observations().filter((o) => o.event === 'gateway-cancel-requested')
    expect(obs.length).toBe(1)

    // The kill stays a REQUEST across the drain: a second kill answers the
    // OTHER native form and mints no second request observation.
    const again = await bridgeA.jobKill({ job_id: 'jg1' }, 'agent-1')
    expect(again.text).toBe('job jg1 had already finished')
    expect(asm.observations().filter((o) => o.event === 'gateway-cancel-requested').length).toBe(1)
    // The rows never fall back: every answer, refusal included, rides the
    // bridge's own text envelope — there is no second (native) face to leak.
  })
})

describe('g3 r9 — every exported registration face IS a canonical host registration face (REAL pinned validator)', () => {
  const faces: Array<[string, Record<string, unknown>]> = [
    ['terminal_open', G3.A5_G3_TERMINAL_OPEN_PARAMETERS],
    ['terminal_send', G3.A5_G3_TERMINAL_SEND_PARAMETERS],
    ['terminal_read', G3.A5_G3_TERMINAL_READ_PARAMETERS],
    ['terminal_signal', G3.A5_G3_TERMINAL_SIGNAL_PARAMETERS],
    ['terminal_close', G3.A5_G3_TERMINAL_CLOSE_PARAMETERS],
    ['terminal_list', G3.A5_G3_TERMINAL_LIST_PARAMETERS],
    ['lsp', G3.A5_G3_LSP_PARAMETERS],
    ['run_code', G3.A5_G3_PTC_PARAMETERS],
  ]

  async function hostValidator() {
    const repo = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
    if (repo === null) throw new Error('no repo root carrying tests/deepseek-harness-test-use — failing closed')
    const hostTools = join(repo, 'tests', 'deepseek-harness-test-use', 'packages', 'core', 'tools', 'lib', 'index.js')
    if (!existsSync(hostTools)) throw new Error(`pristine host lib absent (${hostTools}); failing closed`)
    return (await import(pathToFileURL(hostTools).href)) as unknown as {
      assertSupportedJsonSchema: (schema: unknown) => void
      validateJsonSchemaValue: (schema: unknown, value: unknown, path: string) => string[]
    }
  }

  const marker = (node: unknown): boolean => {
    if (node === null || typeof node !== 'object') return false
    const rec = node as Record<string, unknown>
    if (Object.hasOwn(rec, 'required') && rec.required === true) return true
    const props = rec.properties
    if (props !== null && typeof props === 'object') {
      for (const child of Object.values(props as Record<string, unknown>)) if (marker(child)) return true
    }
    if (rec.items !== undefined && marker(rec.items)) return true
    return false
  }

  it('the REAL Host639 validator accepts every face; NO property-level required marker survives anywhere; parent arrays are exact', async () => {
    const host = await hostValidator()
    for (const [name, schema] of faces) {
      expect(() => host.assertSupportedJsonSchema(schema), name).not.toThrow()
      expect(marker(schema), `${name}: property-level required marker`).toBe(false)
    }
    expect(G3.A5_G3_TERMINAL_OPEN_PARAMETERS.required).toEqual(['type'])
    expect(G3.A5_G3_TERMINAL_SEND_PARAMETERS.required).toEqual(['sessionId', 'text'])
    expect(G3.A5_G3_TERMINAL_READ_PARAMETERS.required).toEqual(['sessionId'])
    expect(G3.A5_G3_TERMINAL_SIGNAL_PARAMETERS.required).toEqual(['sessionId', 'signal'])
    expect(G3.A5_G3_TERMINAL_CLOSE_PARAMETERS.required).toEqual(['sessionId'])
    expect(G3.A5_G3_LSP_PARAMETERS.required).toEqual(['operation', 'file_path', 'line', 'character'])
    expect(G3.A5_G3_PTC_PARAMETERS.required).toEqual(['code', 'description'])
  })

  it('the SAME validator still REJECTS missing required members and walks complete values clean (constraints intact, nothing loosened)', async () => {
    const host = await hostValidator()
    const [openSchema, sendSchema, lspSchema, ptcSchema] = [
      G3.A5_G3_TERMINAL_OPEN_PARAMETERS,
      G3.A5_G3_TERMINAL_SEND_PARAMETERS,
      G3.A5_G3_LSP_PARAMETERS,
      G3.A5_G3_PTC_PARAMETERS,
    ]
    expect(host.validateJsonSchemaValue(openSchema, { name: 'main' }, '').join(';')).toMatch(/type/)
    expect(host.validateJsonSchemaValue(sendSchema, { sessionId: 'pty-1' }, '').join(';')).toMatch(/text/)
    expect(host.validateJsonSchemaValue(lspSchema, { operation: 'hover', file_path: 'a.ts', line: 1 }, '').join(';')).toMatch(/character/)
    expect(host.validateJsonSchemaValue(ptcSchema, { code: 'x' }, '').join(';')).toMatch(/description/)
    // enum + closed surface bind through the SAME validator:
    expect(host.validateJsonSchemaValue(lspSchema, { operation: 'executeCommand', file_path: 'a.ts', line: 1, character: 1 }, '').join(';')).toMatch(/operation/)
    expect(host.validateJsonSchemaValue(ptcSchema, { code: 'x', description: 'd', sandbox_permissions: 'danger-everything' }, '').join(';')).toMatch(/sandbox_permissions/)
    expect(host.validateJsonSchemaValue(lspSchema, { operation: 'hover', file_path: 'a.ts', line: 1, character: 1, extra: true }, '').join(';')).toMatch(/extra/)
    // positives walk clean:
    expect(host.validateJsonSchemaValue(openSchema, { type: 'shell' }, '')).toEqual([])
    expect(host.validateJsonSchemaValue(sendSchema, { sessionId: 'pty-1', text: 'ls\n', run_in_background: true }, '')).toEqual([])
    expect(host.validateJsonSchemaValue(G3.A5_G3_TERMINAL_LIST_PARAMETERS, {}, '')).toEqual([])
    expect(host.validateJsonSchemaValue(ptcSchema, { code: 'x', description: 'd', sandbox_permissions: 'workspace-write', justification: 'r' }, '')).toEqual([])
  })
})
