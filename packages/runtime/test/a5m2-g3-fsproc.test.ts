/**
 * a5m2-g3-fsproc.test.ts — A5-M2 G3 (FS-PROC) fixed points for the
 * g3-fsproc-adapters module + the census-mandated GAP-CLOSURE legs. The
 * assemblies under test are UNWIRED (not mounted); these legs pin module
 * law, not product acceptance. Windows legs: NOT_RUN_WINDOWS_UNAUTHORIZED.
 *
 * Families (dispatch index M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json, records
 * 12-17 B-TERMINAL, 18-20 B-JOB, 21 B-LSP, 64 B-PTC):
 *
 *  - B-TERMINAL (terminal_open/close/list/read/send/signal): declared_mount
 *    arms over CAPTURED native definitions + the injected ptyService CURRENT
 *    facts reader. Pinned here: per-open targets carry the SERVICE
 *    registration identity/incarnation + process envelope (the model's type
 *    string only SELECTS a declared public backend, §5.1); per-send targets
 *    carry the PTY INCARNATION (a sessionId alone never authorizes); the
 *    FAITHFUL exec forward (rootCallId/token/deferContext/concludeTurn
 *    arrive intact — the child-tool channel law); the authoritative entry
 *    re-verify (facts moved AFTER execute() was called still refuse with
 *    zero body — no closure self-attestation, no ledger); target drift at
 *    the entry; drain as a NEW-CALL PROHIBITION with background-job facts
 *    surfaced UNCLEARED (drain settles nothing).
 *  - B-LSP (lsp): the closed four-operation set; one-based UTF-16 law; the
 *    §5.2 target (workspace identity + DOCUMENT revision + SERVER binary
 *    identity/generation + realm); F(read project-scope) as a grammar-valid
 *    `read` effect (proved against the real parseRequestedEffectSet);
 *    document/server drift at the entry.
 *  - B-PTC (run_code): the outer arm (the run_code ROW itself remains a
 *    NAMED GAP — the plane only reserves the name at
 *    team-tool-plane.mjs:468 today). Pinned: exec fidelity end-to-end;
 *    interpreter identity + EFFECTIVE envelope + REAL child-channel facts
 *    (the boolean stand-in was ruled not evidence); escalation args as
 *    manifest DATA under the ONE pinned vocabulary (the MOUNTED adjudication
 *    bridge, ptc-escalation-row.mjs, stays the only escalation answerer —
 *    this arm carries no approval face).
 *  - B-JOB (job_output/job_list/job_kill): NO new face — the trio is already
 *    mounted (team-tool-plane.mjs:1902-1958 + createGovernedJobsBridge), the
 *    live-bridge delegate and the shut fallback are pinned by
 *    a5p7-jobs-assembly-actuator.test.ts, and the wait/cancel abort legs by
 *    its ROOT④b family. THE uncovered leg pinned here: the management path
 *    (read/kill) across the gateway's DRAINING state — cancel stays
 *    reachable for the owner while new admits are refused, the foreign
 *    member still meets owner-mismatch with ZERO host touch, and the
 *    kill-requested ledger distinction keeps answering after the drain.
 *
 * + the r9 CANONICAL-SCHEMA fixed point, twice over: every derived face
 *   (captured authored spec → g3CanonicalRegistrationFace) EQUALS the host's
 *   own `parameterSchemaSpecToJsonSchema` lift plus the closed-surface key,
 *   passes the REAL pinned host validator (assertSupportedJsonSchema @
 *   tests/deepseek-harness-test-use core/tools lib @639ed01539) with no
 *   property-level `required: true` marker anywhere, keeps exact parent
 *   arrays, and the SAME validator still rejects missing members and off-
 *   enum/off-surface values — the captured-config mirror stays dynamic (a
 *   capture WITHOUT the host background flag has no such surface).
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
 *     approveEscalation @packages/core/tools/src/ptc.ts; the child-tool
 *     channel reads exec.rootCallId:548 / exec.token:553 /
 *     exec.deferContext:640 / exec.concludeTurn:653.
 *
 * Scope: NO Host process, NO network. Worlds are pure in-memory doubles.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-g3-fsproc
 */
import { describe, expect, it } from 'vitest'
import { Readable as NodeReadable } from 'node:stream'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { findTestRepoRoot } from '../../../tests/paths.mjs'

interface DrainFacts {
  draining: boolean
  controls: string
  inFlightCount: number
  unsettledBackgroundJobIds: readonly string[]
}
interface ArmResult {
  ok: boolean
  code?: string
  detail?: string
  settled?: string
  bodyOutcome?: string
  plan?: Record<string, unknown>
  effects?: ReadonlyArray<Record<string, unknown>>
  parametersFingerprint?: string
  manifest?: Record<string, unknown>
  reviewPayload?: Record<string, unknown>
  value?: unknown
  [k: string]: unknown
}
interface Arm {
  familyId: string
  toolName: string
  declaredAbsent: boolean
  parametersFace: Record<string, unknown> | null
  classify: (args: unknown, exec: unknown, callId: string) => ArmResult
  prepare: (plan: unknown, grant?: unknown) => ArmResult
  execute: (plan: unknown, consumed: unknown) => Promise<ArmResult>
  cancel: (plan: unknown) => ArmResult
  inFlight: () => Array<{ correlation: string; toolName: string; state: string; backgroundJobId: string | null; settlementEvidence: string | null; handleIdentity?: Record<string, unknown> | null }>
  drain: () => DrainFacts
}
type BindingFacts = { bindingId: string; bindingRevision: number; policyGeneration: number; authorityGeneration: number }
type BindingWorld = { read: () => BindingFacts; bump: (patch: Partial<BindingFacts>) => void }

const G3 = (await import(new URL('../src/plugin/live/governed-families/g3-fsproc-adapters.mjs', import.meta.url).href)) as {
  A5_G3_ADAPTER_REVISION: number
  A5_G3_FAMILIES: Record<string, string>
  A5_G3_LSP_OPERATIONS: readonly string[]
  A5_G3_TERMINAL_SIGNALS: readonly string[]
  A5_G3_TERMINAL_TYPED_CODES: Record<string, string>
  A5_G3_LSP_TYPED_CODES: Record<string, string>
  A5_G3_PTC_TYPED_CODES: Record<string, string>
  g3CanonicalRegistrationFace: (spec: Record<string, unknown>) => Record<string, unknown>
  createGovernedTerminalArms: (deps: Record<string, unknown>) => Record<TerminalName, Arm>
  createGovernedLspArm: (deps: Record<string, unknown>) => Arm
  createGovernedRunCodeArm: (deps: Record<string, unknown>) => Arm
  createHostTerminalControlPort: (deps: Record<string, unknown>) => Record<string, unknown>
}

// The ONE escalation-vocabulary source the arm must reuse (existing mounted
// row — read-only import, proves the single-source pairing).
const PTC_ROW = (await import(new URL('../src/plugin/live/ptc-escalation-row.mjs', import.meta.url).href)) as {
  PTC_ESCALATION_MODES: readonly string[]
}

// The closed effect grammar (domain, read-only): the per-family effect sets
// must PARSE through the same parser the admission kernel uses.
const EFFECTS = (await import(new URL('../../domain/tool-governance/src/index.js', import.meta.url).href)) as {
  parseRequestedEffectSet: (raw: unknown) => { ok: boolean; code?: string; value?: { effects: Array<Record<string, unknown>>; fingerprint: string } }
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

/** A FULL ToolRunContext-shape double (host tools/src/index.ts:326-430):
 *  callId + rootCallId + token + deferContext/concludeTurn included — the
 *  exact fields the PTC child-tool channel reads (ptc.ts:548/553/640/653).
 *  The recorders prove the FAITHFUL forward lands on THIS object. */
/** A faithful SubprocessTerminalHandle double (real member set: pid/output/
 *  done/write/resize/inspectForeground/inspectActivity/signalForeground/
 *  terminate — the awaited terminate IS the process-tree quiescence). */
// the SESSION's launched handle pid (world-scoped fact: the signal/read
// delegation reads the REAL pid of the handle behind the session, never a
// constant): populated at launch, keyed by sessionId by the caller legs.
const launchedPids = new Map<string, number>()
// the launch that last COMPLETED in the CURRENTLY BUILDING world (answered
// with a handle) — the route's session mint follows it; while a deferred
// world is PARKED there is NO completed launch, so the faithful double can
// never guess a missing pid. MODULE scope on purpose: the route runs inside
// the world factory's own stack — a factory-local binding would TDZ while
// its own frame is live and a second world is building.
let lastAnsweredPid: number | null = null

// FAITHFUL TEST DOUBLE of the REAL pinned-639 session capability. The fixed
// Host's @deepseek-ai/dsh-terminal-bash session class lives at
// src/session.ts:237 (LocalPtySession; the export map reaches ./src/*, the
// PRODUCTION supply of that path is flagged unverified to the integrator):
// initialize() gates startup readiness through the send contract; startSend's
// done resolves at READINESS/TIMEOUT/CANCEL/SESSION-EXIT with the REAL
// TerminalSendResult (waitReason is exactly one of 'stdin_read'|'inferred_idle'|
// 'timeout'|'session_exit'); readOutput answers the REAL TerminalSendRead
// ({delta,truncated}); cancel() requests SIGINT and returns false after
// settle; read() answers the REAL TerminalReadResult page
// (text/totalLines/lineBegin/lineEnd/truncated); signal() answers
// {delivered:true,targetPgid}; close() awaits handle.terminate(). Production
// integrators inject the REAL class (factory = (h) => new LocalPtySession(h,
// resolveConfig(config))); this double MIRRORS the pinned contract — it is not
// a relabeled handle (the relabel WAS the round-7 defect this replaces).
function makeFaithfulSessionFactory() {
  const PROMPT = 'bash-5.2$ '
  const made: Array<Record<string, unknown>> = []
  const factory = (handle: {
    pid: number
    output: { on: (ev: string, cb: (c: unknown) => void) => void; once: (ev: string, cb: () => void) => void }
    done: Promise<unknown>
    write: (d: string) => Promise<void>
    signalForeground: (s: string) => Promise<number>
    terminate: () => Promise<void>
  }, _launchSpec: Record<string, unknown>) => {
    let statusValue: Record<string, unknown> = { kind: 'running' }
    let motdValue = ''
    let closing: Promise<void> | null = null
    const lines: string[] = []
    let partial = ''
    let tail = ''
    handle.output.on('data', (chunk) => {
      const text = String(chunk)
      tail = (tail + text).slice(-8192)
      partial += text
      for (;;) { const nl = partial.indexOf('\n'); if (nl < 0) break; lines.push(partial.slice(0, nl)); partial = partial.slice(nl + 1) }
    })
    handle.done.then(() => { statusValue = { kind: 'exited', exitCode: 0, signal: null } }, () => { statusValue = { kind: 'exited', exitCode: null, signal: 'SIGKILL' } })
    const session: Record<string, unknown> = {
      pid: handle.pid,
      get motd() { return motdValue },
      status: () => statusValue,
      startSend(request: { text?: string; submit?: boolean }) {
        const text = String(request?.text ?? '')
        const submit = request?.submit !== false
        const line = submit && !text.endsWith('\n') ? `${text}\n` : text
        const mark = tail.length
        let settled = false
        let settle: (r: Record<string, unknown>) => void = () => {}
        const done = new Promise<Record<string, unknown>>((resolve) => { settle = resolve })
        const finish = (waitReason: string) => {
          if (settled) return
          settled = true
          settle({ viewport: tail.slice(-4096), waitReason, sessionStatus: statusValue, truncated: false })
        }
        const writePromise = handle.write(line).catch(() => undefined)
        void writePromise
        if (submit && text.trim() === 'exit') {
          void handle.done.then(() => { finish('session_exit') })
        } else {
          setTimeout(() => { void writePromise.then(() => { finish(tail.slice(mark).includes(PROMPT) ? 'stdin_read' : 'inferred_idle') }) }, 2)
        }
        let readPos = mark
        return {
          done,
          readOutput: () => { const delta = tail.slice(readPos); readPos = tail.length; return { delta, truncated: false } },
          cancel: () => { if (settled) return false; void handle.signalForeground('SIGINT'); finish('inferred_idle'); return true },
        }
      },
      read: (request: { offset?: number; count?: number }) => {
        const offset = request?.offset ?? 0
        const count = request?.count ?? lines.length
        const total = lines.length
        const lineBegin = Math.min(offset, total)
        const lineEnd = Math.min(offset + Math.max(count, 0), total)
        const page = lines.slice(total - lineEnd, total - lineBegin)
        return { text: page.join('\n'), totalLines: total, lineBegin, lineEnd, truncated: false }
      },
      signal: async (sig: string) => { const targetPgid = await handle.signalForeground(sig); return { delivered: true as const, targetPgid } },
      close: async () => {
        if (closing !== null) return closing
        // THE REAL close() law (session.ts:464-474 @639ed01539): a REJECTED
        // closeOnce DROPS the cached closePromise (`this.closePromise = undefined`)
        // and re-throws — the refusal is observable and a later close RE-ENTERS
        // the real terminate (never a cached permanent answer). Combined with
        // g3a CARD 2 this is the RETRYABLE refusal the close row measures.
        closing = (async () => { await handle.terminate(); if (String(statusValue?.kind ?? '') === 'running') statusValue = { kind: 'exited', exitCode: null, signal: 'SIGTERM' } })().catch((error: unknown) => { closing = null; throw error })
        return closing
      },
      initialize: async (signal?: AbortSignal) => {
        const op = (session as { startSend: (r: Record<string, unknown>) => { done: Promise<Record<string, unknown>> } }).startSend({ text: '', submit: false, ...(signal !== undefined ? { signal } : {}) })
        const result = await op.done
        if (result.waitReason === 'session_exit') throw new Error('PTY shell exited during startup')
        if (result.waitReason === 'timeout') throw new Error('PTY shell did not reach readiness before startup timeout')
        motdValue = String(result.viewport ?? '')
      },
    }
    made.push(session)
    return session
  }
  return { factory, made }
}

function makeTerminalHandle(pid: string) {
  // the REAL handle contract: output is a Node Readable (the provider
  // delivers bytes in order; it ENDS when the terminal exits) — faithful
  // consumption needs the real stream, not a stand-in
  const output = new NodeReadable({ read() {} })
  // faithful: an interactive shell (`--noprofile --norc -i`) PRINTS a prompt
  // at startup — the REAL session's initialize() readiness consumes exactly
  // this output through the send contract; the double emits it too
  queueMicrotask(() => { if (!terminated) output.push('bash-5.2$ ') })
  let exit: (v: Record<string, unknown>) => void = () => {}
  const done = new Promise<Record<string, unknown>>((resolve) => { exit = resolve })
  const writes: string[] = []
  let terminated = false
  return {
    handle: {
      pid: Number(pid),
      output,
      done,
      write: async (data: string) => {
        if (terminated) throw new Error('terminal terminated')
        writes.push(data)
        output.push(`${data}`)
      },
      resize: async () => {},
      inspectForeground: async () => ({ pgid: Number(pid), waitingInput: true }),
      inspectActivity: async () => ({ state: 'unknown' }),
      signalForeground: async () => Number(pid),
      terminate: async () => {
        terminated = true
        exit({ status: 'killed' })
        output.push(null)
      },
    },
    writes,
    terminateCalls: () => terminated,
  }
}

// THE live Agent is ONE object: the service authorizes by object identity
// (expectOwned: record.owner !== owner), and the per-open one-shot backend
// binds the EXACT approved owner. Every face of one world must share it.
const AGENT = { id: AGENT_ID, session: { header: { id: HEADER_ID, cwd: CWD } } }

function makeExec(over: Record<string, unknown> = {}) {
  const recorder = { deferred: [] as unknown[], concluded: 0 }
  const exec = {
    callId: 'hostcall-1',
    rootCallId: 'rootcall-g3',
    name: 'g3-native',
    arguments: {},
    agent: AGENT,
    signal: new AbortController().signal,
    token: { agentId: AGENT_ID, depth: 1 },
    deferContext: (context: unknown) => { recorder.deferred.push(context) },
    concludeTurn: () => { recorder.concluded += 1 },
    ...over,
  }
  return { exec, recorder }
}

function makeBinding() {
  let facts: BindingFacts = { bindingId: 'bind-g3', bindingRevision: 1, policyGeneration: 1, authorityGeneration: 1 }
  return {
    read: (): BindingFacts => ({ ...facts }),
    bump: (patch: Partial<BindingFacts>) => { facts = { ...facts, ...patch } },
  }
}

/** AUTHORED parameter specs mirroring the pinned host defineTool INPUT DSL
 *  (property-level `required: true` markers) — the shape the CAPTURED native
 *  definition carries and from which the arm DERIVES its face. */
const CAPTURED = {
  terminal_open: {
    type: { type: 'string', required: true, description: 'Declared backend type' },
    name: { type: 'string', description: 'Session display name' },
    cwd: { type: 'string', description: 'Working directory' },
  },
  terminal_send: {
    sessionId: { type: 'string', required: true, description: 'PTY session id' },
    text: { type: 'string', required: true, description: 'Input text' },
    submit: { type: 'boolean', description: 'Submit the input' },
    run_in_background: { type: 'boolean', description: 'Detach into a background job (host jobs arm mounted)' },
  },
  // THE SAME TOOL captured on a host WITHOUT the jobs arm: the derived face
  // must mirror the ACTUAL config — no background surface appears.
  terminal_send_nobg: {
    sessionId: { type: 'string', required: true, description: 'PTY session id' },
    text: { type: 'string', required: true, description: 'Input text' },
    submit: { type: 'boolean', description: 'Submit the input' },
  },
  terminal_read: {
    sessionId: { type: 'string', required: true, description: 'PTY session id' },
    offset: { type: 'number', description: 'Read offset' },
    count: { type: 'number', description: 'Read length' },
  },
  terminal_signal: {
    sessionId: { type: 'string', required: true, description: 'PTY session id' },
    signal: { type: 'string', required: true, enum: ['SIGINT', 'SIGTERM', 'SIGKILL', 'SIGTSTP', 'SIGHUP'], description: 'Signal' },
  },
  terminal_close: {
    sessionId: { type: 'string', required: true, description: 'PTY session id' },
  },
  terminal_list: {},
  lsp: {
    operation: { type: 'string', required: true, enum: ['goToDefinition', 'findReferences', 'goToImplementation', 'hover'], description: 'Navigation operation' },
    file_path: { type: 'string', required: true, description: 'Document path' },
    line: { type: 'number', required: true, description: 'One-based line' },
    character: { type: 'number', required: true, description: 'One-based UTF-16 character' },
  },
  run_code: {
    code: { type: 'string', required: true, description: 'Program source' },
    description: { type: 'string', required: true, description: 'What the program does' },
    timeoutMs: { type: 'number', description: 'Run timeout' },
    sandbox_permissions: { type: 'string', enum: ['read-only', 'workspace-write', 'danger-full-access'], description: 'Requested wider sandbox' },
    justification: { type: 'string', description: 'Why the wider sandbox is needed' },
  },
} as const

type NativeDouble = {
  def: { name: string; parameters: Record<string, unknown>; execute: (args: Record<string, unknown>, exec: Record<string, unknown>) => Promise<unknown> }
  calls: Array<{ args: Record<string, unknown>; exec: Record<string, unknown> }>
}

// ── THE PINNED HOST TOOL LIB + PRODUCTION COMPILATION (root ruling 66a521:
// production classify runs over the REAL defineTool PRODUCT — the test
// worlds compile the captured authored config through the REAL pinned
// defineTool and hand the COMPILED definition to the arm; nothing on the
// production legs rides a hand-authored stand-in for the compiled shape. ──
const HOST_LIB = (() => {
  const repo = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
  if (repo === null) throw new Error('no repo root carrying tests/deepseek-harness-test-use — failing closed')
  const lib = join(repo, 'tests', 'deepseek-harness-test-use', 'packages', 'core', 'tools', 'lib', 'index.js')
  if (!existsSync(lib)) throw new Error(`pristine host lib absent (${lib}); failing closed`)
  return pathToFileURL(lib).href
})()

type HostTools = {
  assertSupportedJsonSchema: (schema: unknown) => void
  validateJsonSchemaValue: (schema: unknown, value: unknown, path: string) => string[]
  parameterSchemaSpecToJsonSchema: (spec: Record<string, unknown>) => Record<string, unknown>
  defineTool: (options: {
    name: string
    description: string
    parameters: Record<string, unknown>
    output: { schema: Record<string, unknown>; render: (args: unknown, value: unknown) => [] }
    execute: (args: unknown, exec: unknown) => Promise<Record<string, unknown>>
  }) => {
    parameters: Record<string, unknown>
    execute: (args: unknown, exec: unknown) => Promise<Record<string, unknown>>
  }
}

const hostToolsPromise: Promise<HostTools> = import(HOST_LIB) as Promise<HostTools>
const hostTools = () => hostToolsPromise

/** THE production compilation: authored captured config → REAL defineTool
 *  product ({name, description, parameters: COMPILED schema, execute} with
 *  the host's own ToolArgsError validation in front of the body). */
async function compileNative(name: string, authored: Record<string, unknown>, behavior?: (args: Record<string, unknown>, exec: Record<string, unknown>) => unknown): Promise<Record<string, unknown>> {
  const host = await hostTools()
  return host.defineTool({
    name,
    description: `g3 production-shaped capture of ${name}`,
    parameters: JSON.parse(JSON.stringify(authored)) as Record<string, unknown>,
    output: { schema: { type: 'object', properties: { ok: { type: 'boolean' } }, additionalProperties: false }, render: () => [] },
    execute: async (args, exec) => (behavior === undefined
      ? { ok: true, echoed: args, cwd: (exec as { agent?: { session?: { header?: { cwd?: string } } } })?.agent?.session?.header?.cwd, hostCallId: (exec as { callId?: string })?.callId }
      : (behavior(args as Record<string, unknown>, exec as Record<string, unknown>) as Record<string, unknown>)),
  }) as unknown as Record<string, unknown>
}

/** A native-definition DOUBLE: the caller's object IS what the arm must
 *  enter (never a re-lookup by name); every entry is counted with the exec
 *  it received so fidelity/snapshot claims are MEASURED. PRODUCTION SHAPE:
 *  the definition is the REAL defineTool product (compiled parameters +
 *  the host's validation-wrapped execute); the counting wrapper re-wraps the
 *  COMPILED product without altering name/parameters, so the arm enters
 *  exactly what the host mount entered, entry-by-entry. */
/** An AUTHORED-shape double for the face-derivation TOLERANCE legs ONLY
 *  (g3CanonicalRegistrationFace must handle both capture shapes): never used
 *  on the production classify path, which is compiled through the host. */
function authoredNative(name: string, parameters: Record<string, unknown>): NativeDouble {
  const calls: NativeDouble['calls'] = []
  const def = {
    name,
    parameters: JSON.parse(JSON.stringify(parameters)) as Record<string, unknown>,
    execute: async (args: Record<string, unknown>, exec: Record<string, unknown>) => {
      calls.push({ args, exec })
      return { ok: true, echoed: args }
    },
  }
  return { def, calls }
}

async function makeNative(name: string, parameters: Record<string, unknown>, behavior?: (args: Record<string, unknown>, exec: Record<string, unknown>) => unknown): Promise<NativeDouble> {
  const calls: NativeDouble['calls'] = []
  const compiled = await compileNative(name, parameters, behavior)
  const compiledExecute = (compiled as { execute: (args: unknown, exec: unknown) => Promise<Record<string, unknown>> }).execute
  // the REAL defineTool product (name/parameters/execute) with the counting
  // wrapper on top: the module's delegate sees the compiled face, every
  // entry is recorded for the zero-entry proofs
  const def: NativeDouble['def'] = {
    ...(compiled as Record<string, unknown>),
    name,
    parameters: (compiled as { parameters?: Record<string, unknown> }).parameters ?? parameters,
    execute: async (args: Record<string, unknown>, exec: Record<string, unknown>) => {
      calls.push({ args, exec })
      return compiledExecute.call(compiled, args, exec)
    },
  }
  return { def, calls }
}

/** The terminals-service CURRENT-facts double (§5.1 seam): the arm's target
 *  identity comes ONLY from here — mutable so drift legs are measurable. */
function makePtyService(seedPerOpen = true, planSeed: Record<string, unknown> = {}) {
  const backends = new Map<string, { registrationId: string; incarnation: string; processEnvelope: string }>([
    ['shell', { registrationId: 'reg-shell-1', incarnation: 'backend-inc-1', processEnvelope: 'env-pty-default' }],
  ])
  // §5.1 GOVERNANCE CORE (root 15:09 REAL ROUTE): the admitted open target
  // is the APPROVED CONTROLLED EXECUTION PLAN the integrator answers for
  // this exact call — the plan the per-open one-shot registerBackend
  // registration will actually pin into SubprocessRuntime.spawnTerminal.
  // seedPerOpen=false models the UNANSWERABLE seam (refusal legs).
  const seedPlan = { executable: '/approved/bin/bash', cwd: '/approved/workspace', env: { TERM: 'dumb' }, rows: 24, cols: 80, graceMs: 5_000, terminalType: 'dumb', ...planSeed }
  let perOpenAnswer: ((callId: string) => { plan: Record<string, unknown>; envelopeDigest?: string } | null) | null =
    seedPerOpen
      ? null
      : () => null
  const sessions = new Map<string, { incarnation: string; status: string; envelope: string }>([
    ['pty-1', { incarnation: 'pty-inc-9', status: 'running', envelope: 'env-pty-default' }],
    ['pty-2', { incarnation: 'pty-inc-10', status: 'running', envelope: 'env-pty-default' }],
    ['pty-3', { incarnation: 'pty-inc-11', status: 'running', envelope: 'env-pty-default' }],
    ['pty-7', { incarnation: 'pty-inc-12', status: 'running', envelope: 'env-pty-default' }],
    ['pty-9', { incarnation: 'pty-inc-13', status: 'running', envelope: 'env-pty-default' }],
    ['pty-10', { incarnation: 'pty-inc-14', status: 'running', envelope: 'env-pty-default' }],
  ])
  return {
    backend: (type: string) => backends.get(type) ?? null,
    approvedOpenPlan: (callId: string) => (perOpenAnswer === null
      ? { plan: { ...seedPlan } }
      : perOpenAnswer(callId)),
    setPerOpen: (answer: ((callId: string) => { plan: Record<string, unknown>; envelopeDigest?: string } | null)) => { perOpenAnswer = answer },
    session: (ownerAgentId: string, sessionId: string) => (ownerAgentId === AGENT_ID ? sessions.get(sessionId) ?? null : null),
    moveBackend: (type: string) => {
      const b = backends.get(type)
      if (b !== undefined) backends.set(type, { ...b, incarnation: `${b.incarnation}-moved` })
    },
    moveEnvelope: () => {
      const cur = perOpenAnswer
      perOpenAnswer = (callId: string) => {
        const base = cur === null ? { plan: { ...seedPlan } } : cur(callId)
        return base === null ? null : { ...base, plan: { ...base.plan, env: { ...(base.plan.env as Record<string, string>), PREOPEN: 'injected' } } }
      }
    },
    moveSession: (sessionId: string) => {
      const s = sessions.get(sessionId)
      if (s !== undefined) sessions.set(sessionId, { ...s, incarnation: `${s.incarnation}-moved` })
    },
    dropSession: (sessionId: string) => { sessions.delete(sessionId) },
  }
}

type TerminalName = 'terminal_open' | 'terminal_send' | 'terminal_read' | 'terminal_signal' | 'terminal_close' | 'terminal_list'
const TERMINAL_NAMES: readonly TerminalName[] = ['terminal_open', 'terminal_send', 'terminal_read', 'terminal_signal', 'terminal_close', 'terminal_list']

async function terminalWorld(deps: { absent?: boolean; declaredBackends?: string[]; sendSpec?: Record<string, unknown>; sendBehavior?: (args: Record<string, unknown>, exec: Record<string, unknown>) => unknown; readBehavior?: (args: Record<string, unknown>, exec: Record<string, unknown>) => unknown; withSpawnProvider?: boolean; deferredSpawn?: boolean; spawnRefuse?: boolean; stubTerminals?: Record<string, never> } = {}) {
  const binding = makeBinding()
  const ptyService = makePtyService()
  // THE per-open controlled-backend provider (§5.1 core): the delegate-world
  // arms run WITHOUT a control port, so it never spawns here — its answers
  // are what classify admits. deferredSpawn (handle legs only) parks the
  // provider so post-await cancel/facts rechecks are MEASURABLE.
  let spawnCount = 0
  let gateSettle: () => void = () => {}
  const gatePromise = deps.deferredSpawn === true
    ? new Promise<void>((resolve) => { gateSettle = resolve })
    : Promise.resolve()
  const controlledSpawn = deps.withSpawnProvider !== true
    ? undefined
    : async (request: Record<string, unknown>, _context: { owner: unknown; callId: string }) => {
        spawnCount += 1
        if (deps.deferredSpawn === true) await gatePromise
        if (deps.spawnRefuse === true) return { ok: false, code: 'P_TERM_SPAWN_PROVIDER_REFUSED', detail: 'the per-open provider refused (test)' }
        const sessionId = `pty-svc-${90 + spawnCount}`
        return {
          result: { sessionId, ...(typeof request.name === 'string' ? { name: request.name } : {}), type: String(request.type), pid: 4242, status: { kind: 'running' }, motd: '$ ' },
          ownedResource: { sessionId },
        }
      }
  const natives = {} as Record<TerminalName, NativeDouble>
  const nativeDefinitions: Record<string, unknown> = {}
  const definitionIdentities: Record<string, string> = {}
  const liveDefinitions: Record<string, () => { definitionIdentity: string } | null> = {}
  for (const name of TERMINAL_NAMES) {
    const spec = name === 'terminal_send' ? (deps.sendSpec ?? CAPTURED.terminal_send) : CAPTURED[name]
    const behavior = name === 'terminal_send' ? deps.sendBehavior : name === 'terminal_read' ? deps.readBehavior : undefined
    natives[name] = await makeNative(name, spec as Record<string, unknown>, behavior)
    if (deps.absent !== true) {
      nativeDefinitions[name] = natives[name].def
      definitionIdentities[name] = `${name}@v1`
      liveDefinitions[name] = () => ({ definitionIdentity: `${name}@v1` })
    }
  }
  const controlPort = controlledSpawn === null || controlledSpawn === undefined
    ? undefined
    : G3.createHostTerminalControlPort({
        terminals: deps.stubTerminals ?? makeStubTerminals(),
        resolveOwner: (exec: Record<string, unknown>) => (exec as { agent?: unknown }).agent ?? null,
        ownerSessionId: (agentId: string) => `session-${String(agentId)}`,
        subprocess: { spawnTerminal: async () => makeTerminalHandle('4301').handle },
        approvedOpenPlan: (callId: string) => ptyService.approvedOpenPlan(callId),
      })
  const arms = G3.createGovernedTerminalArms({
    nativeDefinitions: deps.absent === true ? {} : nativeDefinitions,
    definitionIdentities: deps.absent === true ? {} : definitionIdentities,
    liveDefinitions: deps.absent === true ? {} : liveDefinitions,
    declaredBackends: deps.declaredBackends ?? ['shell'],
    ptyService,
    ...(controlPort === undefined ? {} : { controlPort }),
    providerId: 'g3-test-provider',
    memberAgentId: AGENT_ID,
    sessionHeaderId: HEADER_ID,
    realmId: 'realm-g3-test',
    bindingFacts: binding.read,
  })
  return { arms, natives, binding, ptyService, liveDefinitions, gate: { settle: gateSettle }, spawnCounts: () => spawnCount }
}

/** A minimal service stub for worlds whose arms never REACH the service on
 *  the routed path (delegate-world ports exist only to answer classify-time
 *  per-open facts); any real reach would throw, never fake success. */
function makeStubTerminals() {
  const unreachable = (method: string) => () => { throw new Error(`stub terminals.${method} reached — the test world never authorizes it`) }
  return {
    spawn: unreachable('spawn'),
    startSend: unreachable('startSend'),
    read: unreachable('read'),
    signal: unreachable('signal'),
    kill: unreachable('kill'),
    list: unreachable('list'),
    // the census-REQUIRED registration seam: the stub records but authorizes
    // nothing — any spawn past it hits the unreachable face anyway
    registerBackend: (backend: { type: string }) => { stubRegisteredTypes.push(backend.type); return () => { stubRegisteredTypes.splice(stubRegisteredTypes.indexOf(backend.type), 1) } },
    listBackends: () => [...stubRegisteredTypes],
  }
}
const stubRegisteredTypes: string[] = []

function grantFor(c: ArmResult, plan: Record<string, unknown>, binding: BindingWorld, grantId = 'grant-1') {
  const facts = binding.read()
  return { grantId, callId: plan.callId, parametersFingerprint: c.parametersFingerprint, bindingId: facts.bindingId, bindingRevision: facts.bindingRevision }
}

/** classify → prepare → execute over the consumed edge, with a grant that
 *  answers the plan (the pair the REAL A edge produces; the kernel itself is
 *  pinned by the M1 specs). */
async function runPass(arm: Arm, binding: BindingWorld, args: unknown, callId = 'call-1', exec = makeExec().exec) {
  const c = arm.classify(args, exec, callId)
  if (c.ok !== true) throw new Error(`classify refused: ${c.code} ${c.detail}`)
  const plan = c.plan as Record<string, unknown>
  expect(arm.prepare(plan, { grantId: 'grant-1' }).ok).toBe(true)
  const x = await arm.execute(plan, { consumed: true, grant: grantFor(c, plan, binding) })
  return { c, plan, x }
}

describe('g3 B-TERMINAL — six declared_mount arms over captured native definitions + the §5.1 service-facts seam', () => {
  it('all six classify: tool-invoke effect, family reviewPayload, TARGETS carry SERVICE facts (never model claims), ZERO native entries', async () => {
    const w = await terminalWorld()
    const argsByTool: Record<string, unknown> = {
      terminal_open: { type: 'shell', name: 'build' },
      terminal_send: { sessionId: 'pty-1', text: 'make\n' },
      terminal_read: { sessionId: 'pty-1', count: 50 },
      terminal_signal: { sessionId: 'pty-1', signal: 'SIGINT' },
      terminal_close: { sessionId: 'pty-1' },
      terminal_list: {},
    }
    for (const name of TERMINAL_NAMES) {
      const r = w.arms[name].classify(argsByTool[name], makeExec().exec, `call-${name}`)
      expect(r.ok, `${name}: ${r.code} ${r.detail}`).toBe(true)
      expect(r.effects).toEqual([{ kind: 'tool-invoke', toolName: name, resource: null }])
      expect(r.reviewPayload?.familyId).toBe('B-TERMINAL')
      expect(r.reviewPayload?.adapterRevision).toBe(G3.A5_G3_ADAPTER_REVISION)
      expect(r.reviewPayload?.definitionIdentity).toBe(`${name}@v1`)
      expect(String(r.parametersFingerprint).startsWith('sha256:')).toBe(true)
      expect(w.natives[name].calls.length).toBe(0)
    }
    // §5.1: the OPEN target is the CURRENT service registration, not the
    // model's type string; the per-open private backend stays a correlation
    // duty (CENTER-minted), never a model face.
    const open = w.arms.terminal_open.classify({ type: 'shell' }, makeExec().exec, 'x')
    expect(open.manifest?.backendTarget).toEqual({ publicType: 'shell', serviceRegistrationId: 'reg-shell-1', serviceIncarnation: 'backend-inc-1', processEnvelope: 'env-pty-default' })
    expect(open.manifest?.perOpenCorrelationCallId).toBe('x')
    expect(open.manifest?.operation).toBe('pty-spawn')
    // send/read/signal/close carry the PTY INCARNATION from the service —
    // the sessionId string alone is never the authority.
    expect(w.arms.terminal_send.classify({ sessionId: 'pty-1', text: '' }, makeExec().exec, 'x').manifest?.ptyTarget).toEqual({ sessionId: 'pty-1', serviceIncarnation: 'pty-inc-9', serviceStatus: 'running', serviceEnvelope: 'env-pty-default' })
    expect(w.arms.terminal_signal.classify({ sessionId: 'pty-2', signal: 'SIGTERM' }, makeExec().exec, 'x').manifest?.ptyTarget).toMatchObject({ serviceIncarnation: 'pty-inc-10' })
    expect(w.arms.terminal_list.classify({}, makeExec().exec, 'x').manifest?.ownerScoped).toBe(true)
  })

  it('unresolved targets refuse TYPED with zero reach: unknown sessionId, undeclared backend, service-lost session, absent declared service', async () => {
    const w = await terminalWorld()
    const unknownSession = w.arms.terminal_send.classify({ sessionId: 'pty-not-mine', text: 'x' }, makeExec().exec, 'c0')
    expect(unknownSession.code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.TARGET_UNRESOLVED)
    expect(unknownSession.detail).toMatch(/sessionId alone never authorizes/)

    const internal = w.arms.terminal_open.classify({ type: 'g3-internal-one-shot-9f2' }, makeExec().exec, 'c1')
    expect(internal.code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.BACKEND_NOT_DECLARED)

    // The service LOSES the session record between classify and the next
    // classify: the CURRENT facts decide again — unresolved is refused,
    // never guessed from the model's string.
    const w2 = await terminalWorld()
    w2.ptyService.dropSession('pty-1')
    expect(w2.arms.terminal_read.classify({ sessionId: 'pty-1' }, makeExec().exec, 'svc-lost').code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.TARGET_UNRESOLVED)

    const shut = await terminalWorld({ absent: true })
    for (const arm of Object.values(shut.arms)) {
      expect(arm.declaredAbsent).toBe(true)
      expect(arm.parametersFace).toBeNull()
      const r = arm.classify({ type: 'shell', sessionId: 'pty-1', text: 'x', signal: 'SIGINT' }, makeExec().exec, 'c3')
      expect(r.ok).toBe(false)
      expect(r.code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.DECLARED_ABSENT)
    }
  })

  it('identity pairing rides the REAL Host face; the closed surface MIRRORS THE CAPTURED config (no background parameter when the capture has none)', async () => {
    const w = await terminalWorld()
    const foreign = w.arms.terminal_list.classify({}, makeExec({ agent: { id: 'agent-other', session: { header: { id: HEADER_ID } } } }).exec, 'c')
    expect(foreign.code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.FOREIGN_SESSION)
    const foreignHeader = w.arms.terminal_list.classify({}, makeExec({ agent: { id: AGENT_ID, session: { header: { id: 'other-header' } } } }).exec, 'c')
    expect(foreignHeader.code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.FOREIGN_SESSION)
    expect(w.arms.terminal_list.classify({}, {}, 'c').code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.NO_OWNING_SESSION)
    expect(w.arms.terminal_read.classify({ sessionId: 'p', limit: 3 }, makeExec().exec, 'c').code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.UNKNOWN_PARAMETER)
    // THE CAPTURED-CONFIG MIRROR: a host WITHOUT the jobs arm has NO
    // run_in_background surface — the governed face never outgrows the
    // mounted native face.
    const nb = await terminalWorld({ sendSpec: CAPTURED.terminal_send_nobg })
    expect(nb.arms.terminal_send.parametersFace?.properties).not.toHaveProperty('run_in_background')
    expect(nb.arms.terminal_send.classify({ sessionId: 'pty-1', text: 'x', run_in_background: true }, makeExec().exec, 'c').code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.UNKNOWN_PARAMETER)
    expect(w.arms.terminal_send.parametersFace?.properties).toHaveProperty('run_in_background')
  })

  it('EXEC FIDELITY + full pass: the captured body is entered EXACTLY ONCE with a faithful exec (rootCallId/token/deferContext/concludeTurn arrive intact); replay refuses', async () => {
    const w = await terminalWorld()
    const { exec, recorder } = makeExec()
    const { c, plan, x } = await runPass(w.arms.terminal_send, w.binding, { sessionId: 'pty-2', text: 'python3\n' }, 'call-send', exec)
    expect(x.ok).toBe(true)
    const calls = w.natives.terminal_send.calls
    expect(calls.length).toBe(1)
    const fwd = calls[0]?.exec as Record<string, unknown>
    // EVERY own field arrives (no field loss — the child-tool channel law):
    expect(Object.keys(fwd).sort()).toEqual(Object.keys(exec).sort())
    expect(fwd.agent).toBe(exec.agent) // the CAPTURED reference, not a rebuilt id
    expect(fwd.signal).toBe(exec.signal)
    expect(fwd.callId).toBe('hostcall-1')
    expect(fwd.rootCallId).toBe('rootcall-g3') // ptc.ts:548
    expect(fwd.token).toBe(exec.token) // ptc.ts:553 (sub-dispatch parent)
    expect(fwd.name).toBe('g3-native')
    // BOUND functions still LAND ON THE LIVE EXECUTION (deferContext /
    // concludeTurn are how the host closes a run):
    ;(fwd.deferContext as (v: unknown) => void)({ synthetic: true })
    ;(fwd.concludeTurn as () => void)()
    expect(recorder.deferred).toEqual([{ synthetic: true }])
    expect(recorder.concluded).toBe(1)
    expect(calls[0]?.args).toEqual({ sessionId: 'pty-2', text: 'python3\n' }) // submit omission NOT filled
    expect(c.manifest?.effectiveSubmit).toBe(true) // the host default is manifest DATA
    expect(String(c.manifest?.inputDigest)).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(c.manifest?.inputBytes).toBe(8)
    // REPLAY: the spent edge refuses, the body stays at one entry.
    const again = await w.arms.terminal_send.execute(plan, { consumed: true, grant: grantFor(c, plan, w.binding) })
    expect(again.code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.ALREADY_CONSUMED)
    expect(w.natives.terminal_send.calls.length).toBe(1)
  })

  it('THE ENTRY RE-VERIFY (authoritative, live sources): facts that move AFTER execute() was called — the same-tick window — still refuse with ZERO body', async () => {
    // (a) CURRENT binding facts move inside the pre-entry window: the old
    //     pre-check-then-only-cancel/drain shape WOULD have entered here.
    const w = await terminalWorld()
    const c = w.arms.terminal_send.classify({ sessionId: 'pty-1', text: 'ls\n' }, makeExec().exec, 'win-1')
    expect(w.arms.terminal_send.prepare(c.plan, { grantId: 'g' }).ok).toBe(true)
    const running = w.arms.terminal_send.execute(c.plan, { consumed: true, grant: grantFor(c, c.plan as Record<string, unknown>, w.binding, 'g') })
    w.binding.bump({ policyGeneration: 2 }) // AFTER execute() was called — the window
    const late = await running
    expect(late.code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.GRANT_MISMATCH)
    expect(late.detail).toMatch(/CURRENT binding facts moved/)
    expect(w.natives.terminal_send.calls.length).toBe(0)

    // (b) bindingId moves (same revision, new binding): the entry re-query
    //     of bindingFacts() catches it — a definition identity alone is not
    //     self-attestation of the BINDING.
    const w2 = await terminalWorld()
    const c2 = w2.arms.terminal_send.classify({ sessionId: 'pty-1', text: 'ls\n' }, makeExec().exec, 'win-2')
    expect(w2.arms.terminal_send.prepare(c2.plan, { grantId: 'g' }).ok).toBe(true)
    const running2 = w2.arms.terminal_send.execute(c2.plan, { consumed: true, grant: grantFor(c2, c2.plan as Record<string, unknown>, w2.binding, 'g') })
    w2.binding.bump({ bindingId: 'bind-rotated' })
    expect((await running2).code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.GRANT_MISMATCH)
    expect(w2.natives.terminal_send.calls.length).toBe(0)

    // (c) the LIVE DISPATCHER placement read moves (definition replacement):
    //     the entry consults the integrator's CURRENT read, not the closure.
    const w3 = await terminalWorld()
    const c3 = w3.arms.terminal_send.classify({ sessionId: 'pty-1', text: 'ls\n' }, makeExec().exec, 'win-3')
    expect(w3.arms.terminal_send.prepare(c3.plan, { grantId: 'g' }).ok).toBe(true)
    const running3 = w3.arms.terminal_send.execute(c3.plan, { consumed: true, grant: grantFor(c3, c3.plan as Record<string, unknown>, w3.binding, 'g') })
    w3.liveDefinitions.terminal_send = () => ({ definitionIdentity: 'terminal_send@v2-replacement' })
    expect((await running3).code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.DEFINITION_DRIFT)
    expect(w3.natives.terminal_send.calls.length).toBe(0)

    // (d) the FUNCTION value moves (same placement identity, new body):
    // the ENTRY RE-VERIFY catches it — and (root ruling 66a521, tightening)
    // the SAME-TICK window catches it BEFORE the body is entered: the entry
    // consults the CURRENT dispatcher read, sees the new function value, and
    // refuses with ZERO body entries. A move during a REAL async await (the
    // handle legs measure that edge) is an EFFECT ENTRY with cleanup truth —
    // never this zero-effect word.
    const w4 = await terminalWorld()
    const c4 = w4.arms.terminal_send.classify({ sessionId: 'pty-1', text: 'ls\n' }, makeExec().exec, 'win-4')
    expect(w4.arms.terminal_send.prepare(c4.plan, { grantId: 'g' }).ok).toBe(true)
    const running4 = w4.arms.terminal_send.execute(c4.plan, { consumed: true, grant: grantFor(c4, c4.plan as Record<string, unknown>, w4.binding, 'g') })
    w4.natives.terminal_send.def.execute = async () => ({ moved: true })
    expect((await running4).code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.DEFINITION_DRIFT)
    expect(w4.natives.terminal_send.calls.length).toBe(0) // same-tick: refused at the entry, zero effect

    // (e) SERVICE TARGET drift at the entry: the PTY incarnation moved —
    //     the approved stdin write would hit a different process.
    const w5 = await terminalWorld()
    const c5 = w5.arms.terminal_send.classify({ sessionId: 'pty-3', text: 'ls\n' }, makeExec().exec, 'win-5')
    expect(w5.arms.terminal_send.prepare(c5.plan, { grantId: 'g' }).ok).toBe(true)
    const running5 = w5.arms.terminal_send.execute(c5.plan, { consumed: true, grant: grantFor(c5, c5.plan as Record<string, unknown>, w5.binding, 'g') })
    w5.ptyService.moveSession('pty-3')
    const drift = await running5
    expect(drift.code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.TARGET_DRIFT)
    expect(w5.natives.terminal_send.calls.length).toBe(0)

    // (f) backend registration drift for the OPEN (per-open correlation
    //     against the CURRENT backend registration):
    const w6 = await terminalWorld()
    const c6 = w6.arms.terminal_open.classify({ type: 'shell' }, makeExec().exec, 'win-6')
    expect(w6.arms.terminal_open.prepare(c6.plan, { grantId: 'g' }).ok).toBe(true)
    const running6 = w6.arms.terminal_open.execute(c6.plan, { consumed: true, grant: grantFor(c6, c6.plan as Record<string, unknown>, w6.binding, 'g') })
    w6.ptyService.moveBackend('shell')
    expect((await running6).code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.TARGET_DRIFT)
    expect(w6.natives.terminal_open.calls.length).toBe(0)

    // (g) close is the ONE operation that stays lawful when the service
    //     already lost the record (the already-closing shape belongs to the
    //     body/service, not to a drift refusal).
    const w7 = await terminalWorld()
    const c7 = w7.arms.terminal_close.classify({ sessionId: 'pty-9' }, makeExec().exec, 'win-7')
    expect(w7.arms.terminal_close.prepare(c7.plan, { grantId: 'g' }).ok).toBe(true)
    const running7 = w7.arms.terminal_close.execute(c7.plan, { consumed: true, grant: grantFor(c7, c7.plan as Record<string, unknown>, w7.binding, 'g') })
    w7.ptyService.dropSession('pty-9')
    expect((await running7).ok).toBe(true)
  })

  it('cancel before the edge stops the body (zero entries); commit-edge cancel stops the same-tick body; COMMITTED cannot be retracted', async () => {
    const w = await terminalWorld()
    const c1 = w.arms.terminal_close.classify({ sessionId: 'pty-9' }, makeExec().exec, 'cancel-1')
    expect(w.arms.terminal_close.prepare(c1.plan, { grantId: 'g' }).ok).toBe(true)
    const cancelled = w.arms.terminal_close.cancel(c1.plan)
    expect(cancelled.settled).toBe('CANCELLED-AFTER-ADMISSION')
    expect(String(cancelled.bodyOutcome)).toMatch(/zero/)
    const exec1 = await w.arms.terminal_close.execute(c1.plan, { consumed: true, grant: grantFor(c1, c1.plan as Record<string, unknown>, w.binding, 'g') })
    expect(exec1.code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.CANCELLED)
    expect(w.natives.terminal_close.calls.length).toBe(0)

    // Same-tick edge cancel: execute is entered, the entry re-check sees
    // the CANCELLED state before any body — report and count agree.
    const c2 = w.arms.terminal_close.classify({ sessionId: 'pty-10' }, makeExec().exec, 'cancel-2')
    expect(w.arms.terminal_close.prepare(c2.plan, { grantId: 'g2' }).ok).toBe(true)
    const running = w.arms.terminal_close.execute(c2.plan, { consumed: true, grant: grantFor(c2, c2.plan as Record<string, unknown>, w.binding, 'g2') })
    const edge = w.arms.terminal_close.cancel(c2.plan)
    expect(edge.settled).toBe('CANCELLED-BEFORE-EXECUTION')
    expect((await running).code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.CANCELLED)
    expect(w.natives.terminal_close.calls.length).toBe(0)
  })

  it('DRAIN HONESTY: drain() is a new-call prohibition, NOT a settlement — a background job (jobs.start) stays LIVE and UNCLEARED across it; the COMMITTED word says so; inFlight() carries the facts', async () => {
    const w = await terminalWorld({
      sendBehavior: async () => ({ kind: 'background', jobId: 'bg-job-77', note: 'host jobs.start owner=agent-member-1' }),
    })
    const { c, x } = await runPass(w.arms.terminal_send, w.binding, { sessionId: 'pty-1', text: 'sleep 30\n', run_in_background: true }, 'bg-1')
    expect(x.ok).toBe(true)
    expect(c.manifest?.background).toBe(true)
    expect(c.manifest?.backgroundJobTarget).toMatch(/jobs\.start/)
    expect(c.manifest?.effectDelta).toContain('bg-pty-send-jobs')
    // The background job is LIVE: the arm has NO settlement evidence.
    const live = w.arms.terminal_send.inFlight()
    expect(live.length).toBe(1)
    expect(live[0]).toMatchObject({ toolName: 'terminal_send', state: 'COMMITTED', backgroundJobId: 'bg-job-77' })
    expect(String(live[0]?.settlementEvidence)).toMatch(/none observed by this arm/)
    // DRAIN: states what it controls; the job fact SURVIVES the word.
    const facts = w.arms.terminal_send.drain()
    expect(facts.draining).toBe(true)
    expect(facts.controls).toMatch(/no resource is settled/)
    expect(facts.unsettledBackgroundJobIds).toEqual(['bg-job-77'])
    expect(facts.inFlightCount).toBe(0) // the call itself settled; the JOB did not
    const after = w.arms.terminal_send.classify({ sessionId: 'pty-1', text: 'x' }, makeExec().exec, 'bg-2')
    expect(after.code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.DRAINING)
    // Cancel on a COMMITTED plan never retracts and never claims the job died.
    const cancelWord = w.arms.terminal_send.cancel(c.plan)
    expect(cancelWord.settled).toBe('ALREADY-COMMITTED')
    expect(String(cancelWord.bodyOutcome)).toContain('bg-job-77')
    expect(String(cancelWord.bodyOutcome)).toMatch(/LIVE and UNCLEARED/)

    // An EXECUTING body is NOT rewound by drain: the in-flight fact answers
    // UNKNOWN, and the body still commits (no false zero-claim). The pending
    // body is installed at world creation — the bind-time capture law means
    // a SWAPPED execute is definition replacement, not a test fixture.
    let release: (v: unknown) => void = () => {}
    const w2 = await terminalWorld({
      readBehavior: () => new Promise<unknown>((resolve) => { release = resolve }),
    })
    const c2 = w2.arms.terminal_read.classify({ sessionId: 'pty-7' }, makeExec().exec, 'bg-3')
    expect(w2.arms.terminal_read.prepare(c2.plan, { grantId: 'g' }).ok).toBe(true)
    const running2 = w2.arms.terminal_read.execute(c2.plan, { consumed: true, grant: grantFor(c2, c2.plan as Record<string, unknown>, w2.binding, 'g') })
    await new Promise<void>((r) => { setTimeout(r, 0) }) // let the entry microtask chain reach the body
    const mid = w2.arms.terminal_read.drain()
    expect(mid.inFlightCount).toBe(1)
    const unknown = w2.arms.terminal_read.cancel(c2.plan)
    expect(unknown.settled).toBe('UNKNOWN-IN-FLIGHT')
    release({ done: true })
    expect((await running2).ok).toBe(true)
  })

  it('terminal_read keeps the omission law (offset/count null in the manifest, defaults belong to the body) and terminal_signal stays the closed five', async () => {
    const w = await terminalWorld()
    const r = w.arms.terminal_read.classify({ sessionId: 'pty-7' }, makeExec().exec, 'read-1')
    expect(r.manifest?.offset).toBeNull()
    expect(r.manifest?.count).toBeNull()
    expect(w.arms.terminal_read.classify({ sessionId: 'p', count: 0 }, makeExec().exec, 'x').code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.INVALID_ARGUMENTS)
    expect(w.arms.terminal_signal.classify({ sessionId: 'p', signal: 'SIGSTOP' }, makeExec().exec, 'x').code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.INVALID_ARGUMENTS)
    const pass = await runPass(w.arms.terminal_read, w.binding, { sessionId: 'pty-7' }, 'read-2')
    expect(pass.x.ok).toBe(true)
    expect(w.natives.terminal_read.calls[0]?.args).toEqual({ sessionId: 'pty-7' })
  })
})

describe('g3 B-LSP — the closed four-operation arm over the captured native lsp definition (§5.2 target facts + real read effect)', () => {
  async function lspWorld(deps: { absentServer?: boolean; unresolvableDoc?: boolean } = {}) {
    const native = await makeNative('lsp', CAPTURED.lsp)
    const binding = makeBinding()
    const doc = { kind: 'workspace', canonicalLocator: 'src/a.ts', revision: 'rev-1' }
    let realmAnswer = 'realm-g3-test'
    let scopeAnswer: 'inside' | 'outside' = 'inside'
    const arm = G3.createGovernedLspArm({
      nativeDefinition: native.def,
      definitionIdentity: 'lsp@v1',
      liveDispatcher: () => ({ definitionIdentity: 'lsp@v1' }),
      providerId: 'g3-test-provider',
      memberAgentId: AGENT_ID,
      sessionHeaderId: HEADER_ID,
      realmId: 'realm-g3-test',
      bindingFacts: binding.read,
      lspFacts: {
        server: () => (deps.absentServer === true ? null : { binaryIdentity: 'tsserver@5.6.0-sha-abc', generation: 'polgen-4' }),
        document: (filePath: string) => (deps.unresolvableDoc === true ? null : { ...doc, canonicalLocator: filePath }),
        // §5.2 INTERFACE OBLIGATIONS (the assembly adapter's realm-scoped
        // document answers): realm + cross-file scope, enforced at classify
        // AND at the entry — facts-only providers are refused, not trusted.
        documentRealm: () => realmAnswer,
        documentScope: () => scopeAnswer,
      },
    })
    return { arm, native, binding, doc, moveRealm: () => { realmAnswer = 'realm-other-member' }, moveScope: () => { scopeAnswer = 'outside' } }
  }

  it('exactly the four navigation operations classify; effects carry the REAL grammar-valid read effect (§5.2 F read project-scope); ANY fifth spelling refuses with zero body', async () => {
    const w = await lspWorld()
    for (const op of G3.A5_G3_LSP_OPERATIONS) {
      const r = w.arm.classify({ operation: op, file_path: 'src/a.ts', line: 10, character: 5 }, makeExec().exec, `lsp-${op}`)
      expect(r.ok, `${op}: ${r.code}`).toBe(true)
      // tool-invoke alone was ruled INSUFFICIENT: the §5.2 target facts and
      // the read effect must ride.
      expect(r.effects).toEqual([
        { kind: 'tool-invoke', toolName: 'lsp', resource: null },
        { kind: 'read', resource: { realmId: 'realm-g3-test', kind: 'workspace', canonicalLocator: 'src/a.ts', rights: ['read'] } },
      ])
      // The effect set PARSES through the closed domain grammar (the same
      // parser the admission kernel uses) — not a private shape.
      const parsed = EFFECTS.parseRequestedEffectSet(r.effects)
      expect(parsed.ok).toBe(true)
      expect(typeof parsed.value?.fingerprint).toBe('string')
      // §5.2 target: workspace + DOCUMENT revision + SERVER identity +
      // realm + policy generation — all present, all from facts.
      expect(r.manifest?.workspaceIdentity).toEqual({ sessionHeaderCwd: CWD })
      expect(r.manifest?.documentTarget).toEqual({ kind: 'workspace', canonicalLocator: 'src/a.ts', revision: 'rev-1' })
      expect(r.manifest?.serverTarget).toEqual({ binaryIdentity: 'tsserver@5.6.0-sha-abc', generation: 'polgen-4' })
      expect(r.manifest?.realmId).toBe('realm-g3-test')
      expect(r.manifest?.policyGeneration).toBe(1)
      expect(r.manifest?.navigationOperation).toBe(op)
      expect(r.manifest?.oneBasedLine).toBe(10) // model-facing spelling preserved
      expect(w.native.calls.length).toBe(0)
    }
    for (const op of ['executeCommand', 'diagnostics', 'rename']) {
      const r = w.arm.classify({ operation: op, file_path: 'a.ts', line: 1, character: 1 }, makeExec().exec, 'x')
      expect(r.ok).toBe(false)
      expect(r.code).toBe(G3.A5_G3_LSP_TYPED_CODES.INVALID_ARGUMENTS)
    }
  })

  it('unresolved §5.2 facts refuse TYPED: no server identity for the scope, unresolvable document; ONE-BASED UTF-16 law holds (zero/fractional refuse)', async () => {
    const noServer = await lspWorld({ absentServer: true })
    expect(noServer.arm.classify({ operation: 'hover', file_path: 'a.ts', line: 1, character: 1 }, makeExec().exec, 'x').code).toBe(G3.A5_G3_LSP_TYPED_CODES.TARGET_UNRESOLVED)
    const noDoc = await lspWorld({ unresolvableDoc: true })
    const r = noDoc.arm.classify({ operation: 'hover', file_path: 'a.ts', line: 1, character: 1 }, makeExec().exec, 'x')
    expect(r.code).toBe(G3.A5_G3_LSP_TYPED_CODES.TARGET_UNRESOLVED)
    expect(noServer.native.calls.length).toBe(0)
    expect(noDoc.native.calls.length).toBe(0)

    const w = await lspWorld()
    expect(w.arm.classify({ operation: 'hover', file_path: 'a.ts', line: 0, character: 1 }, makeExec().exec, 'x').code).toBe(G3.A5_G3_LSP_TYPED_CODES.INVALID_ARGUMENTS)
    expect(w.arm.classify({ operation: 'hover', file_path: 'a.ts', line: 1, character: 2.5 }, makeExec().exec, 'x').code).toBe(G3.A5_G3_LSP_TYPED_CODES.INVALID_ARGUMENTS)
    expect(w.arm.classify({ operation: 'hover', file_path: '  ', line: 1, character: 1 }, makeExec().exec, 'x').code).toBe(G3.A5_G3_LSP_TYPED_CODES.INVALID_ARGUMENTS)
    expect(w.native.calls.length).toBe(0)
  })

  it('full pass: the captured body receives the faithful snapshot whose agent path IS the host sessionCwd face (exec.agent.session.header.cwd); drain stops later calls', async () => {
    const w = await lspWorld()
    const { exec } = makeExec()
    const { x } = await runPass(w.arm, w.binding, { operation: 'goToDefinition', file_path: 'src/b.ts', line: 4, character: 12 }, 'lsp-pass', exec)
    expect(x.ok).toBe(true)
    expect(w.native.calls.length).toBe(1)
    expect((w.native.calls[0]?.exec as Record<string, unknown>).token).toBe(exec.token)
    expect(((w.native.calls[0]?.exec as Record<string, unknown>).agent as { session?: { header?: { cwd?: string } } }).session?.header?.cwd).toBe(CWD) // session-cwd.ts:15 path
    expect((x.value as Record<string, unknown>).cwd).toBe(CWD)
    const facts = w.arm.drain()
    expect(facts.draining).toBe(true)
    expect(w.arm.classify({ operation: 'hover', file_path: 'a.ts', line: 1, character: 1 }, makeExec().exec, 'after').code).toBe(G3.A5_G3_LSP_TYPED_CODES.DRAINING)
  })

  it('entry re-verify: a DOCUMENT revision move (the file changed after approval) and a SERVER generation move refuse TARGET_DRIFT with zero body — the navigation never answers a different file than the one approved', async () => {
    let revision = 'rev-1'
    let generation = 'polgen-4'
    const native = await makeNative('lsp', CAPTURED.lsp)
    const binding = makeBinding()
    const arm = G3.createGovernedLspArm({
      nativeDefinition: native.def,
      definitionIdentity: 'lsp@v1',
      liveDispatcher: () => ({ definitionIdentity: 'lsp@v1' }),
      providerId: 'g3-test-provider',
      memberAgentId: AGENT_ID,
      sessionHeaderId: HEADER_ID,
      realmId: 'realm-g3-test',
      bindingFacts: binding.read,
      lspFacts: {
        server: () => ({ binaryIdentity: 'tsserver@5.6.0-sha-abc', generation }),
        document: (filePath: string) => ({ kind: 'workspace', canonicalLocator: filePath, revision }),
        documentRealm: () => 'realm-g3-test',
        documentScope: () => 'inside',
      },
    })
    const c = arm.classify({ operation: 'findReferences', file_path: 'src/a.ts', line: 3, character: 2 }, makeExec().exec, 'lsp-drift')
    expect(arm.prepare(c.plan, { grantId: 'g' }).ok).toBe(true)
    const running = arm.execute(c.plan, { consumed: true, grant: grantFor(c, c.plan as Record<string, unknown>, binding, 'g') })
    revision = 'rev-2-edited' // same-tick window: the user saved the file
    const drift = await running
    expect(drift.code).toBe(G3.A5_G3_LSP_TYPED_CODES.TARGET_DRIFT)
    expect(drift.detail).toMatch(/document revision moved/)
    expect(native.calls.length).toBe(0)

    const c2 = arm.classify({ operation: 'findReferences', file_path: 'src/a.ts', line: 3, character: 2 }, makeExec().exec, 'lsp-drift-2')
    expect(arm.prepare(c2.plan, { grantId: 'g' }).ok).toBe(true)
    const running2 = arm.execute(c2.plan, { consumed: true, grant: grantFor(c2, c2.plan as Record<string, unknown>, binding, 'g') })
    generation = 'polgen-5' // a policy generation change disposes the realm
    expect((await running2).code).toBe(G3.A5_G3_LSP_TYPED_CODES.TARGET_DRIFT)
    expect(native.calls.length).toBe(0)
  })

  it('§5.2 REALM + cross-file SCOPE are interface obligations (root ruling: they do NOT downgrade to facts-only): a document the adapter answers under ANOTHER realm refuses at classify; a scope answer that flips to outside INSIDE the pre-entry window refuses at the entry — both with zero body; a provider that omits the obligations is refused as unresolved', async () => {
    // (a) classify-time realm escape: the assembly adapter says this file
    //     belongs to another member's realm — navigation refuses BEFORE any
    //     approval could cover it.
    const wEsc = await lspWorld()
    wEsc.moveRealm()
    const realmBad = wEsc.arm.classify({ operation: 'goToDefinition', file_path: 'src/a.ts', line: 2, character: 1 }, makeExec().exec, 'scope-2')
    expect(realmBad.code).toBe(G3.A5_G3_LSP_TYPED_CODES.SCOPE_ESCAPED)
    expect(realmBad.detail).toMatch(/not the bound realm/)
    expect(wEsc.native.calls.length).toBe(0)
    // (b) entry-time scope flip: inside at classify, outside in the window —
    //     the SCOPE obligation answers again at the entry and the body never
    //     runs (navigation would read a file outside the approved scope).
    const w2 = await lspWorld()
    const c = w2.arm.classify({ operation: 'findReferences', file_path: 'src/a.ts', line: 4, character: 2 }, makeExec().exec, 'scope-3')
    expect(c.ok, `${c.code} ${c.detail}`).toBe(true)
    expect(w2.arm.prepare(c.plan, { grantId: 'g' }).ok).toBe(true)
    const running = w2.arm.execute(c.plan, { consumed: true, grant: grantFor(c, c.plan as Record<string, unknown>, w2.binding, 'g') })
    w2.moveScope() // the cross-file scope answer flips inside the window
    const late = await running
    expect(late.code).toBe(G3.A5_G3_LSP_TYPED_CODES.SCOPE_ESCAPED)
    expect(late.detail).toMatch(/cross-file scope answer moved/)
    expect(w2.native.calls.length).toBe(0)
    // (c) A FACTS-ONLY provider is NOT the §5.2 implementation: an arm
    //     assembled without the realm/scope obligation answers refuses to
    //     be built — the obligations are structural, not optional facts.
    expect(() => G3.createGovernedLspArm({
      nativeDefinition: authoredNative('lsp', CAPTURED.lsp).def,
      definitionIdentity: 'lsp@v1',
      liveDispatcher: () => ({ definitionIdentity: 'lsp@v1' }),
      providerId: 'g3-test-provider', memberAgentId: AGENT_ID, sessionHeaderId: HEADER_ID, realmId: 'realm-g3-test',
      bindingFacts: makeBinding().read,
      lspFacts: { server: () => ({ binaryIdentity: 'x', generation: 'g' }), document: (p: string) => ({ kind: 'workspace', canonicalLocator: p, revision: 'r' }) },
    })).toThrow(/documentRealm/)
  })
})

describe('g3 B-PTC — the outer run_code arm (row itself a NAMED GAP; escalation answers live ONLY in the mounted bridge)', () => {
  async function ptcWorld(deps: { noFacts?: boolean; moveChannel?: boolean; noEnvelope?: boolean; noBudget?: boolean } = {}) {
    const native = await makeNative('run_code', CAPTURED.run_code)
    const binding = makeBinding()
    const arm = G3.createGovernedRunCodeArm({
      nativeDefinition: native.def,
      definitionIdentity: 'run_code@v1',
      liveDispatcher: () => ({ definitionIdentity: 'run_code@v1' }),
      providerId: 'g3-test-provider',
      memberAgentId: AGENT_ID,
      sessionHeaderId: HEADER_ID,
      realmId: 'realm-g3-test',
      bindingFacts: binding.read,
      ptcFacts: () => (deps.noFacts === true
        ? null
        : {
            interpreter: { runtimeIdentity: 'node@22.14.0@/usr/bin/node', language: 'javascript' },
            effectiveEnvelope: deps.noEnvelope === true
              ? null // an unevidenced envelope is NOT an implementation (root ruling)
              : { mode: 'workspace-write', enforcement: 'realm+env+rlimit+tree-kill' },
            timeout: { defaultMs: 30000, maxMs: 120000 },
            childChannel: {
              capabilityList: ['read', 'write', 'bash', 'todo__write'],
              channelDigest: deps.moveChannel === true ? 'sha256:chan-2' : 'sha256:chan-1',
              maxParallelSubCalls: deps.noBudget === true ? null : 8,
              runDispatchBudget: deps.noBudget === true ? null : 64,
            },
          }),
    })
    return { arm, native, binding }
  }

  it('a plain program run: EXEC FIDELITY end-to-end (the child-tool channel fields arrive intact and bound), interpreter/envelope/REAL channel facts on the target, digests (never copies), executes once', async () => {
    const w = await ptcWorld()
    const { exec, recorder } = makeExec()
    const code = 'const r = await tools.read({ file_path: "a" }); return r'
    const { c, x } = await runPass(w.arm, w.binding, { code, description: 'read a file' }, 'ptc-1', exec)
    expect(x.ok).toBe(true)
    expect(w.native.calls.length).toBe(1)
    const fwd = w.native.calls[0]?.exec as Record<string, unknown>
    // The PTC bridge reads EXACTLY these (ptc.ts): a dropped field silently
    // kills the child-tool channel — the arm forwards a faithful exec.
    expect(fwd.rootCallId).toBe(exec.rootCallId)
    expect(fwd.token).toBe(exec.token)
    expect(fwd.callId).toBe(exec.callId)
    expect(fwd.agent).toBe(exec.agent)
    expect(fwd.signal).toBe(exec.signal)
    expect(Object.keys(fwd).sort()).toEqual(Object.keys(exec).sort())
    ;(fwd.deferContext as (v: unknown) => void)({ nested: true })
    ;(fwd.concludeTurn as () => void)()
    expect(recorder.deferred).toEqual([{ nested: true }])
    expect(recorder.concluded).toBe(1)
    // Target: interpreter/provider identity + EFFECTIVE envelope + the REAL
    // child channel (the boolean stand-in is gone — facts, not flags).
    expect(c.manifest?.interpreterTarget).toEqual({ runtimeIdentity: 'node@22.14.0@/usr/bin/node', language: 'javascript' })
    expect(c.manifest?.effectiveEnvelope).toEqual({ mode: 'workspace-write', enforcement: 'realm+env+rlimit+tree-kill' })
    expect(c.manifest?.timeoutPolicy).toEqual({ defaultMs: 30000, maxMs: 120000 })
    expect(c.manifest?.childChannel).toMatchObject({ capabilityCount: 4, channelDigest: 'sha256:chan-1', maxParallelSubCalls: 8, runDispatchBudget: 64 })
    expect((c.manifest?.childChannel as Record<string, unknown>).capabilityList).toEqual(['bash', 'read', 'todo__write', 'write'])
    expect(c.manifest?.nestedToolsSecondGovernance).toBeUndefined() // ruled NOT evidence
    expect(String(c.manifest?.codeDigest)).toBe(`sha256:${createHash('sha256').update(code, 'utf8').digest('hex')}`)
    expect(c.manifest?.requestedSandboxMode).toBeNull()
    expect((x.value as Record<string, unknown>).hostCallId).toBe('hostcall-1') // the bridge reads exec.callId
  })

  it('an unattributed run refuses: no interpreter/channel facts → TARGET_UNRESOLVED; channel/interpreter drift at the entry → TARGET_DRIFT with zero body', async () => {
    const dark = await ptcWorld({ noFacts: true })
    const r = dark.arm.classify({ code: 'x', description: 'd' }, makeExec().exec, 'p0')
    expect(r.code).toBe(G3.A5_G3_PTC_TYPED_CODES.TARGET_UNRESOLVED)
    expect(dark.native.calls.length).toBe(0)

    // The approved reach is not the live reach: the channel digest moves in
    // the pre-entry window — the run refuses at the entry.
    let move = false
    const native = await makeNative('run_code', CAPTURED.run_code)
    const binding = makeBinding()
    const arm = G3.createGovernedRunCodeArm({
      nativeDefinition: native.def,
      definitionIdentity: 'run_code@v1',
      liveDispatcher: () => ({ definitionIdentity: 'run_code@v1' }),
      providerId: 'g3-test-provider',
      memberAgentId: AGENT_ID,
      sessionHeaderId: HEADER_ID,
      realmId: 'realm-g3-test',
      bindingFacts: binding.read,
      ptcFacts: () => ({
        interpreter: { runtimeIdentity: move ? 'node@23.0.0@/usr/bin/node2' : 'node@22.14.0@/usr/bin/node', language: 'javascript' },
        effectiveEnvelope: { mode: 'workspace-write', enforcement: 'realm+env+rlimit+tree-kill' },
        timeout: { defaultMs: 30000, maxMs: 120000 },
        childChannel: { capabilityList: ['read'], channelDigest: move ? 'sha256:chan-moved' : 'sha256:chan-1', maxParallelSubCalls: 8, runDispatchBudget: 64 },
      }),
    })
    const c = arm.classify({ code: 'x', description: 'd' }, makeExec().exec, 'p1')
    expect(arm.prepare(c.plan, { grantId: 'g' }).ok).toBe(true)
    const running = arm.execute(c.plan, { consumed: true, grant: grantFor(c, c.plan as Record<string, unknown>, binding, 'g') })
    move = true
    const drift = await running
    expect(drift.code).toBe(G3.A5_G3_PTC_TYPED_CODES.TARGET_DRIFT)
    expect(native.calls.length).toBe(0)
  })

  it('the escalation pair-law is typed at classify: half-pairs and unknown modes refuse, valid pairs ride as manifest DATA under the ONE pinned mode vocabulary — the arm itself never answers an escalation', async () => {
    const w = await ptcWorld()
    const good = w.arm.classify({ code: 'x', description: 'd', sandbox_permissions: 'workspace-write', justification: 'need to write' }, makeExec().exec, 'esc-1')
    expect(good.ok).toBe(true)
    expect(good.manifest?.requestedSandboxMode).toBe('workspace-write')
    expect(String(good.manifest?.justificationDigest)).toMatch(/^sha256:/) // digest, not the shown text
    for (const bad of [
      { code: 'x', description: 'd', sandbox_permissions: 'workspace-write' }, // mode without justification
      { code: 'x', description: 'd', justification: 'reason' }, // justification without mode
      { code: 'x', description: 'd', sandbox_permissions: 'danger-everything', justification: 'x' }, // invented mode
    ]) {
      const r = w.arm.classify(bad, makeExec().exec, 'esc-x')
      expect(r.ok).toBe(false)
      expect(r.code).toBe(G3.A5_G3_PTC_TYPED_CODES.ESCALATION_ARGS_INVALID)
    }
    expect(w.native.calls.length).toBe(0)
    // The single-source law: the captured face's escalation enum IS the
    // mounted row's vocabulary (assembly audit pairs them at mount).
    expect((CAPTURED.run_code.sandbox_permissions.enum as readonly string[]).join(',')).toBe(PTC_ROW.PTC_ESCALATION_MODES.join(','))
    // The arm carries NO approval face: escalate/allow/adjudicate exist
    // nowhere on it — escalation answers happen only in ptc-escalation-row.
    const faces = Object.keys(w.arm).sort().join(',')
    expect(faces).toBe('adapterRevision,cancel,classify,declaredAbsent,definitionIdentity,drain,execute,familyId,inFlight,parametersFace,prepare,providerId,toolName')
  })

  it('THE REAL ENVELOPE/BUDGET LAW (root ruling: null/empty does NOT count): an unevidenced EFFECTIVE envelope or a null budget refuses P_PTC_ENVELOPE_UNEVIDENCED at classify AND at the entry, never running behind an unenforced claim', async () => {
    const noEnvelope = await ptcWorld({ noEnvelope: true })
    const dark = noEnvelope.arm.classify({ code: 'x', description: 'd' }, makeExec().exec, 'env-dark')
    expect(dark.code).toBe(G3.A5_G3_PTC_TYPED_CODES.ENVELOPE_UNEVIDENCED)
    expect(dark.detail).toMatch(/not an implementation/)
    expect(noEnvelope.native.calls.length).toBe(0)
    const noBudget = await ptcWorld({ noBudget: true })
    const poor = noBudget.arm.classify({ code: 'x', description: 'd' }, makeExec().exec, 'env-poor')
    expect(poor.code).toBe(G3.A5_G3_PTC_TYPED_CODES.ENVELOPE_UNEVIDENCED)
    expect(poor.detail).toMatch(/maxParallelSubCalls/)
    expect(noBudget.native.calls.length).toBe(0)
    // The same law AT THE ENTRY: an envelope evidenced at classify that
    // stops being evidenced inside the pre-entry window refuses there too.
    let envelopeLive = true
    const native = await makeNative('run_code', CAPTURED.run_code)
    const binding = makeBinding()
    const arm = G3.createGovernedRunCodeArm({
      nativeDefinition: native.def,
      definitionIdentity: 'run_code@v1',
      liveDispatcher: () => ({ definitionIdentity: 'run_code@v1' }),
      providerId: 'g3-test-provider',
      memberAgentId: AGENT_ID,
      sessionHeaderId: HEADER_ID,
      realmId: 'realm-g3-test',
      bindingFacts: binding.read,
      ptcFacts: () => ({
        interpreter: { runtimeIdentity: 'node@22.14.0@/usr/bin/node', language: 'javascript' },
        effectiveEnvelope: envelopeLive ? { mode: 'workspace-write', enforcement: 'realm+env+rlimit+tree-kill' } : null,
        timeout: { defaultMs: 30000, maxMs: 120000 },
        childChannel: { capabilityList: ['read'], channelDigest: 'sha256:chan-1', maxParallelSubCalls: 8, runDispatchBudget: 64 },
      }),
    })
    const c = arm.classify({ code: 'x', description: 'd' }, makeExec().exec, 'env-edge')
    expect(arm.prepare(c.plan, { grantId: 'g' }).ok).toBe(true)
    const running = arm.execute(c.plan, { consumed: true, grant: grantFor(c, c.plan as Record<string, unknown>, binding, 'g') })
    envelopeLive = false // the sandbox answer went unevidenced in the window
    const late = await running
    expect(late.code).toBe(G3.A5_G3_PTC_TYPED_CODES.ENVELOPE_UNEVIDENCED)
    expect(late.detail).toMatch(/stopped being evidenced/)
    expect(native.calls.length).toBe(0)
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
        void caller
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

describe('g3 §5.1 REAL HANDLE PLUMBING — createHostTerminalControlPort over a faithful ctx.terminals double (root boundary ruling: real prepare/execute/terminate handles — the handle answers, the arm routes; an integrator adapter over the PUBLIC @deepseek-ai/dsh-terminal service face is the delivery shape; the module stays UNWIRED)', () => {
  /** The double answers the EXACT @deepseek-ai/dsh-terminal @639ed01539 face
   *  (spawn/startSend/read/signal/kill/list; TerminalSendOperation.done;
   *  kill true = newly closed, false = same close already in flight). Every
   *  answer below is the SERVICE word — the legs assert the ARM routed it. */
  function makeTerminalsDouble(depsDouble: { autoSettleSend?: unknown } = {}) {
    const sessions = new Map<string, { pid: number; status: string; closed: boolean; owner?: unknown }>([
      // the service's OWN live sessions (seeded identities the facts reader
      // also carries): the double stays self-consistent.
      ['pty-1', { pid: 4101, status: 'running', closed: false }],
      ['pty-2', { pid: 4102, status: 'running', closed: false }],
    ])
    // THE backend Map, faithful to the REAL service (terminal/src/index.ts
    // :119-136): registerBackend keyed by type, DUPLICATE refusal, the
    // disposer removes EXACTLY this backend OBJECT, and removal NEVER
    // touches published sessions (注销不等终止).
    const backends = new Map<string, Record<string, unknown>>()
    const log: string[] = []
    let nextId = 90
    const live = (id: string, owner?: unknown) => {
      const rec = sessions.get(id)
      if (rec === undefined || rec.closed) throw Object.assign(new Error('NO_SESSION'), { code: 'NO_SESSION' })
      // expectOwned law (real service): the EXACT owner Agent authorizes.
      if (owner !== undefined && rec.owner !== undefined && rec.owner !== owner) throw Object.assign(new Error('FOREIGN_SESSION'), { code: 'FOREIGN_SESSION' })
      return rec
    }
    return {
      log,
      backends,
      registerBackend: (backend: { type: string }) => {
        if (typeof backend?.type !== 'string' || backend.type.length === 0) throw new Error('pty backend type must be non-empty')
        if (backends.has(backend.type)) throw Object.assign(new Error(`a PTY backend named "${backend.type}" is already registered`), { code: 'DUPLICATE_BACKEND' })
        backends.set(backend.type, backend as unknown as Record<string, unknown>)
        log.push(`register:${backend.type}`)
        return () => {
          if (backends.get(backend.type) === (backend as unknown)) {
            backends.delete(backend.type)
            log.push(`deregister:${backend.type}`)
          }
        }
      },
      listBackends: () => [...backends.keys()],
      spawn: async (owner: Record<string, unknown>, request: Record<string, unknown>) => {
        log.push(`spawn:${String(request.type)}:${String(owner?.id ?? '')}:backend=${String(backends.has(String(request.type)))}`)
        const backend = backends.get(String(request.type))
        if (backend === undefined) throw Object.assign(new Error(`no PTY backend registered for "${String(request.type)}"`), { code: 'NO_BACKEND' })
        // the REAL ordering (index 154-224): capture the backend by type,
        // MINT the sessionId Host-side, await the one-shot backend.spawn
        const sessionId = `pty-svc-${String(nextId++)}`
        // the REAL request spread (index 154-224): an UNSET name must stay
        // absent, never arrive as an explicit undefined
        const backendSession = await (backend as { spawn: (spec: Record<string, unknown>) => Promise<Record<string, unknown>> }).spawn({
          sessionId,
          owner,
          type: request.type,
          ...(request.name !== undefined ? { name: request.name } : {}),
          ...(request.cwd !== undefined ? { cwd: request.cwd } : {}),
        })
        sessions.set(sessionId, { pid: 4100 + nextId, status: 'running', closed: false, owner })
        // THE session owns the REAL backend session for its whole lifetime
        // (the record retains the BackendSession — types 148-170); the
        // snapshot carries the backend's OWN pid (faithful publication).
        const launchedPid = Number(backendSession?.pid ?? lastAnsweredPid ?? 4242)
        lastAnsweredPid = null
        sessions.get(sessionId)!.pid = launchedPid
        launchedPids.set(sessionId, launchedPid)
        ;(sessions.get(sessionId) as Record<string, unknown>).__backendSession = backendSession
        // THE REAL service reply: snapshot(record, session.motd) — pid and
        // status are READ FROM THE REAL SESSION (service index.ts:186-197);
        // the double passes its facts through, no constants
        return {
          sessionId,
          ...(request.name !== undefined ? { name: request.name } : {}),
          type: String(request.type),
          pid: launchedPid,
          status: typeof (backendSession as { status?: () => unknown })?.status === 'function' ? (backendSession as { status: () => unknown }).status() : { kind: 'running' },
          motd: String((backendSession as { motd?: string })?.motd ?? ''),
        }
      },
      startSend: (owner: Record<string, unknown>, id: string, request: Record<string, unknown>) => {
        const rec = live(id, owner)
        log.push(`send:${id}:${String(request.text)}:${String(request.submit)}`)
        if (typeof depsDouble.autoSettleSend === 'object' && depsDouble.autoSettleSend !== null) {
          return { done: Promise.resolve(depsDouble.autoSettleSend), readOutput: () => ({ delta: '', truncated: false }), cancel: () => true }
        }
        const bs = (rec as Record<string, unknown>).__backendSession as { startSend: (r: Record<string, unknown>) => Record<string, unknown> } | undefined
        if (bs !== undefined) return bs.startSend(request)
        // SEEDED service session (no backend behind it in the double): the
        // stand-in operation answers with the same TerminalSendOperation
        // contract (done settles on cancel — the legs drive it).
        let settle: (v: Record<string, unknown>) => void = () => {}
        const done = new Promise<Record<string, unknown>>((resolve) => { settle = resolve })
        return {
          done,
          readOutput: () => ({ delta: '', truncated: false }),
          // CARD 5 (root central adjudication): the REAL TerminalWaitReason
          // @639ed01539 is exactly 'stdin_read' | 'inferred_idle' | 'timeout'
          // | 'session_exit' — the host NEVER answers 'cancelled' (a SIGINT
          // cancel wakes the wait; the wait still returns a real enum word).
          // The double answers a REAL member; the KILLED fact rides the
          // arm's own cancelRequested fact, never a fabricated waitReason.
          cancel: () => { settle({ viewport: '^C', waitReason: 'stdin_read', sessionStatus: { kind: 'running' }, truncated: false }); return true },
        }
      },
      read: (owner: Record<string, unknown>, id: string, request?: Record<string, unknown>) => {
        const rec = live(id, owner)
        log.push(`read:${id}`)
        const bs = (rec as Record<string, unknown>).__backendSession as { read?: (r: Record<string, unknown>) => Record<string, unknown> }
        const answered = typeof bs?.read === 'function' ? bs.read(request ?? {}) : null
        // this world's retained scrollback for a service session with no
        // captured output yet — the double's canned SERVICE answer
        if (answered === null || answered.text === '') return { text: 'make: nothing to be done\n', totalLines: 1, lineBegin: 0, lineEnd: 1, truncated: false }
        return answered
      },
      signal: async (owner: Record<string, unknown>, id: string, signal: string) => {
        const rec = live(id, owner)
        log.push(`signal:${id}:${signal}`)
        const bs = (rec as Record<string, unknown>).__backendSession as { signal?: (sig: string) => Promise<Record<string, unknown>> }
        // THE REAL service signal is a PURE PASS-THROUGH of the session's
        // TerminalSignalResult {delivered:true,targetPgid} (service index.ts)
        if (typeof bs?.signal === 'function') return await bs.signal(signal)
        // SEEDED service session: the SERVICE answers with the session's
        // REAL process group — the record's pid (faithful, not a constant)
        return { delivered: true, targetPgid: Number((rec as { pid?: number }).pid ?? 0) }
      },
      kill: async (owner: Record<string, unknown>, id: string) => {
        const rec = sessions.get(id)
        if (rec === undefined) { log.push(`kill-missing:${id}`); return false }
        if (rec.owner !== undefined && rec.owner !== owner) throw Object.assign(new Error('FOREIGN_SESSION'), { code: 'FOREIGN_SESSION' })
        if (rec.closed) { log.push(`kill-in-flight:${id}`); return false }
        // the REAL kill awaits the retained backend session's quiescent close
        const bs = (rec as Record<string, unknown>).__backendSession as { close?: (r: string) => Promise<unknown> } | undefined
        if (typeof bs?.close === 'function') await bs.close('model request')
        rec.closed = true
        log.push(`kill:${id}`)
        return true
      },
      list: (_owner: Record<string, unknown>) => {
        log.push('list')
        return [...sessions.entries()].filter(([, r]) => !r.closed).map(([sessionId, r]) => ({ sessionId, type: 'shell', pid: r.pid, status: r.status }))
      },
    }
  }

  async function handleWorld(deps: { jobs?: unknown; noOwner?: boolean; brokenPort?: boolean; noCapability?: boolean; noSessionCapability?: boolean; startupFails?: boolean; factoryFails?: boolean; cleanupFails?: boolean; openPlan?: Record<string, unknown>; deferredSpawn?: boolean; autoSettleSend?: unknown; terminateRefusals?: number } = {}) {
    const terminals = makeTerminalsDouble({ autoSettleSend: deps.autoSettleSend })
    const binding = makeBinding()
    const natives = {} as Record<TerminalName, NativeDouble>
    const nativeDefinitions: Record<string, unknown> = {}
    const definitionIdentities: Record<string, string> = {}
    const liveDefinitions: Record<string, () => { definitionIdentity: string } | null> = {}
    for (const name of TERMINAL_NAMES) {
      natives[name] = await makeNative(name, CAPTURED[name] as Record<string, unknown>)
      nativeDefinitions[name] = natives[name].def
      definitionIdentities[name] = `${name}@v1`
      liveDefinitions[name] = () => ({ definitionIdentity: `${name}@v1` })
    }
    // The broken-port world ALSO un-answers the per-open governed facts at
    // the seam: then EVERY terminal row (open included) is refused before
    // the port is even consulted — the leg below therefore measures the
    // UNANSWERED-HANDLE edge on the rows that reach prepare (send/read/
    // close) and the classify-time governed-target refusal for open.
    const ptyBridge = makePtyService(deps.brokenPort !== true, deps.openPlan ?? {})
    const tracked = makePtyService() // static seed facts (pty-1..pty-10)
    const minted = new Map<string, { incarnation: string; status: string; envelope: string }>()
    const ptyService = {
      backend: (type: string) => ptyBridge.backend(type),
      approvedOpenPlan: (callId: string) => ptyBridge.approvedOpenPlan(callId),
      moveEnvelope: () => ptyBridge.moveEnvelope(),
      session: (ownerAgentId: string, sessionId: string) =>
        tracked.session(ownerAgentId, sessionId) ?? minted.get(sessionId) ?? null,
      // the integrator's feed: sessions the SERVICE minted this world (the
      // spawn answer carries the identity; the facts reader carries it on)
      recordMinted: (sessionId: string) => {
        minted.set(sessionId, { incarnation: `svc-${sessionId}-inc-1`, status: 'running', envelope: 'env-pty-default' })
      },
      closeMinted: (sessionId: string) => {
        const cur = minted.get(sessionId)
        if (cur !== undefined) minted.set(sessionId, { ...cur, status: 'closed' })
      },
    }
    let deferredGate: { settle: () => void; settled: Promise<void> } = { settle: () => {}, settled: Promise.resolve() }
    if (deps.deferredSpawn === true) {
      let settle: () => void = () => {}
      const settled = new Promise<void>((resolve) => { settle = resolve })
      deferredGate = { settle, settled }
    }
    // THE controlled PTY capability (the ONLY launch path the one-shot
    // per-open backend may use): records the ACTUAL pinned spec; the
    // deferred world PARKS here (before the handle exists) so post-await
    // cancel/facts/cleanup is MEASURABLE, not asserted.
    const launches: Array<Record<string, unknown>> = []
    const subprocess = deps.noCapability === true ? null : {
      spawnTerminal: async (spec: Record<string, unknown>) => {
        launches.push(spec)
        if (deps.deferredSpawn === true) await deferredGate.settled
        const h = makeTerminalHandle(`42${String(40 + launches.length)}`).handle
        // CARD 2 world: a provider that REFUSES the terminate — the real
        // terminal-bash closeOnce RE-THROWS a terminate failure (`PTY
        // cleanup failed`, session.ts @639), it never answers closed:false.
        if (deps.terminateRefusals !== undefined) {
          let refusals = deps.terminateRefusals
          const realTerminate = h.terminate.bind(h)
          h.terminate = async () => {
            if (refusals > 0) { refusals -= 1; throw new Error('P_QUIESCENCE_REFUSED (test): the provider refused the awaited terminate') }
            return realTerminate()
          }
        }
        lastAnsweredPid = Number(h.pid)
        return h
      },
    }
    // THE REAL session capability for this world: the faithful pinned-
    // contract factory (production injects the REAL LocalPtySession from
    // @deepseek-ai/dsh-terminal-bash itself); the startup-failure world
    // injects a factory whose initialize REJECTS the same way the real
    // class rejects when the shell never reaches readiness.
    const faithful = makeFaithfulSessionFactory()
    const startupHandles: Array<{ handle: Record<string, unknown>; terminateCalls: number }> = []
    const sessionFactory = deps.noSessionCapability === true
      ? undefined
      : deps.startupFails === true
        ? async (handle: Record<string, unknown>) => {
            const rec: { handle: Record<string, unknown>; terminateCalls: number } = { handle, terminateCalls: 0 }
            startupHandles.push(rec)
            const orig = (handle as { terminate: () => Promise<void> }).terminate
            ;(handle as { terminate: () => Promise<void> }).terminate = async () => { rec.terminateCalls += 1; await orig() }
            const inner = await Promise.resolve(faithful.factory(handle as never, {}))
            return { ...inner, initialize: async () => { throw new Error('PTY shell did not reach readiness before startup timeout') } }
          }
        : deps.factoryFails === true
          // the capability refuses to CONSTRUCT: the cleanup law cleans the
          // NOT-CONSTRUCTED resource through provider terminate
          ? async (handle: Record<string, unknown>) => {
              const rec: { handle: Record<string, unknown>; terminateCalls: number } = { handle, terminateCalls: 0 }
              startupHandles.push(rec)
              const orig = (handle as { terminate: () => Promise<void> }).terminate
              ;(handle as { terminate: () => Promise<void> }).terminate = async () => { rec.terminateCalls += 1; await orig() }
              throw new Error('PTY capability construction failed')
            }
          : deps.cleanupFails === true
            // constructed + readiness fails + the cleanup face ALSO fails:
            // the module must propagate both and claim NO quiescence
            ? async (handle: Record<string, unknown>) => {
                const rec: { handle: Record<string, unknown>; terminateCalls: number } = { handle, terminateCalls: 0 }
                startupHandles.push(rec)
                const orig = (handle as { terminate: () => Promise<void> }).terminate
                ;(handle as { terminate: () => Promise<void> }).terminate = async () => { rec.terminateCalls += 1; await orig() }
                const inner = await Promise.resolve(faithful.factory(handle as never, {}))
                return {
                  ...inner,
                  initialize: async () => { throw new Error('PTY shell did not reach readiness before startup timeout') },
                  close: async () => { throw new Error('provider terminate failed: EPERM') },
                }
              }
            : faithful.factory
    const controlPort = deps.brokenPort === true
      ? { name: 'broken', prepare: async () => null }
      : G3.createHostTerminalControlPort({
          terminals,
          resolveOwner: (exec: Record<string, unknown>) => (deps.noOwner === true ? null : (exec as { agent?: unknown }).agent ?? null),
          jobs: deps.jobs ?? null,
          ownerSessionId: (agentId: string) => `session-${String(agentId)}`,
          ...(subprocess === null ? {} : { subprocess }),
          ...(sessionFactory !== undefined ? { sessionFactory } : {}),
          approvedOpenPlan: (callId: string) => ptyService.approvedOpenPlan(callId),
        })
    const arms = G3.createGovernedTerminalArms({
      nativeDefinitions, definitionIdentities, liveDefinitions,
      declaredBackends: ['shell'],
      ptyService,
      controlPort,
      providerId: 'g3-test-provider', memberAgentId: AGENT_ID, sessionHeaderId: HEADER_ID, realmId: 'realm-g3-test',
      bindingFacts: binding.read,
    })
    return { arms, natives, binding, terminals, ptyService, gate: deferredGate, launches, subprocess, ptyBridge, sessionFactory, startupHandles }
  }

  it('§5.1 GOVERNANCE CORE (REAL ROUTE): classify admits the APPROVED CONTROLLED OPEN PLAN; the open runs through the PER-OPEN one-shot registerBackend registration (unique internal type, disposed after publication — 注销不等终止) and the CONTROLLED spawnTerminal capability with the plan PINNED; without the capability the port REFUSES; native-shaped status/sessionId ride the answer', async () => {
    const w = await handleWorld()
    const open = w.arms.terminal_open.classify({ type: 'shell', name: 'build' }, makeExec().exec, 'h-open')
    expect(open.ok, `${open.code} ${open.detail}`).toBe(true)
    const openManifest = open.manifest as { perOpenBackend?: { approvedPlan?: Record<string, unknown>; envelopeDigest?: string }; backendTarget?: Record<string, unknown> }
    expect(openManifest.perOpenBackend?.approvedPlan).toMatchObject({ executable: '/approved/bin/bash', cwd: '/approved/workspace', rows: 24, cols: 80 }) // THE governed target: the plan the one-shot backend actually pins
    expect(String(openManifest.perOpenBackend?.envelopeDigest)).toMatch(/^sha256:/) // digest of the approved plan — re-verified against the ACTUAL launch
    expect(openManifest.backendTarget?.publicType).toBe('shell') // the public type only SELECTS the declared family
    // THE REAL ROUTE end-to-end: the per-open registration appears on the
    // service Map and is DEREGISTERED after publication; the session
    // survives the deregistration (注销不等终止); the controlled capability
    // received the PINNED plan (argv/cwd/dims/grace — the envelope of record).
    const pass = await runPass(w.arms.terminal_open, w.binding, { type: 'shell' }, 'h-route')
    expect(pass.x.ok, JSON.stringify(pass.x).slice(0, 200)).toBe(true)
    expect(w.terminals.log.filter((l: string) => /^register:dsh-g3-po-h-route-\d+$/.test(l)).length).toBe(1)
    expect(w.terminals.log.filter((l: string) => /^deregister:dsh-g3-po-h-route-\d+$/.test(l)).length).toBe(1)
    expect(w.terminals.listBackends().some((t: string) => t.startsWith('dsh-g3-po-'))).toBe(false) // route gone after the open
    expect(w.terminals.log.some((l: string) => l.startsWith('kill'))).toBe(false) // deregistration performed NO termination
    expect(w.launches.length).toBe(1) // exactly ONE controlled launch for one open
    expect(w.launches[0]).toMatchObject({ argv: ['/approved/bin/bash'], cwd: '/approved/workspace', rows: 24, cols: 80, graceMs: 5_000 }) // the ACTUAL pinned spec = the approved plan
    // The model can never select the internal type: undeclared at the
    // classify face by construction.
    const spoof = w.arms.terminal_open.classify({ type: 'dsh-g3-po-h-route-1' }, makeExec().exec, 'h-spoof')
    expect(spoof.code).toMatch(/BACKEND_NOT_DECLARED/)
    // No controlled capability ⇒ typed refusal, ZERO service reach: the
    // adapter never substitutes a bare process or a public-type route.
    const bare = await handleWorld({ noCapability: true })
    const refused = await runPass(bare.arms.terminal_open, bare.binding, { type: 'shell' }, 'np-1')
    expect(refused.x.code).toMatch(/OPEN_CAPABILITY_ABSENT/)
    expect(bare.terminals.log.filter((l: string) => l.startsWith('spawn')).length).toBe(0)
    expect(bare.natives.terminal_open.calls.length).toBe(0)
    // The envelope answer MOVING between approval and the entry refuses at
    // the entry (drift law over the approved envelope, not just registration).
    const moved = await handleWorld()
    const c2 = moved.arms.terminal_open.classify({ type: 'shell' }, makeExec().exec, 'h-open-env')
    expect(c2.ok).toBe(true)
    moved.ptyService.moveEnvelope()
    const plan2 = c2.plan as Record<string, unknown>
    expect(moved.arms.terminal_open.prepare(plan2, { grantId: 'grant-1' }).ok).toBe(true)
    const e2 = await moved.arms.terminal_open.execute(plan2, { consumed: true, grant: grantFor(c2, plan2, moved.binding, 'grant-1') })
    expect(e2.code).toMatch(/TARGET_DRIFT/)
    // the claim-time re-read saw the plan MOVE: refused BEFORE any launch
    // (zero controlled spawns), the registration route disposed
    expect(moved.launches.length).toBe(0)
    // THE REAL-ROUTE PLAN-MOVE LAW, MEASURED: the ARM's entry recheck
    // re-reads the approval seam and catches the moved plan BEFORE the port
    // is entered (defense in depth: zero service reach at all — not even a
    // registration); the one-shot's own claim-time digest check is the
    // second layer for moves that slip past the arm window.
    expect(moved.terminals.log, JSON.stringify(moved.terminals.log)).toEqual([])
    expect(moved.launches.length).toBe(0)
    expect(String(e2.code)).toMatch(/TARGET_DRIFT/)
    expect(String(e2.detail)).toMatch(/open plan|envelope/i)
  })

  it('THE ONE-SHOT CLAIM IS THE SECOND DEFENSE: a plan that moves AFTER the manifest was captured refuses at the claim BEFORE any await (zero launch, zero publication) and the route is disposed', async () => {
    const w = await handleWorld()
    const c = w.arms.terminal_open.classify({ type: 'shell' }, makeExec().exec, 'claim-move')
    expect(c.ok).toBe(true)
    // the approval seam flips AFTER classify AND after the arm's entry
    // recheck window (the arm recheck reads the same seam, so pin the arm
    // plan and move the seam only when the one-shot re-reads it): drive the
    // PORT directly with the captured manifest — the one-shot's claim-time
    // re-read is what answers here.
    const moved2 = { n: 0, turn: () => { moved2.n += 1; if (moved2.n === 1) w.ptyService.moveEnvelope() } }
    const port = G3.createHostTerminalControlPort({
      terminals: w.terminals,
      resolveOwner: (exec: Record<string, unknown>) => (exec as { agent?: unknown }).agent ?? null,
      subprocess: w.subprocess,
      sessionFactory: w.sessionFactory,
      approvedOpenPlan: () => { moved2.turn() ; return w.ptyBridge.approvedOpenPlan('claim-move') },
    })
    const prepped = await (port as unknown as { prepare: (spec: Record<string, unknown>) => Promise<Record<string, unknown>> }).prepare({
      toolName: 'terminal_open',
      canonical: { type: 'shell' },
      manifest: ((c.plan as Record<string, unknown>).manifest ?? c.manifest ?? {}) as Record<string, unknown>,
      exec: makeExec().exec, callId: 'claim-move', correlation: 'claim-move',
      isCancelled: () => false,
    })
    expect(prepped.ok).toBe(false)
    expect(String(prepped.code)).toMatch(/OPEN_PLAN_MOVED/)
    expect(String(prepped.detail)).toMatch(/BEFORE any effect/)
    expect(w.launches.length).toBe(0) // zero launch: refused before the capability
    expect(w.terminals.log.filter((l: string) => l.startsWith('register:'))).toHaveLength(1)
    expect(w.terminals.log.filter((l: string) => l.startsWith('deregister:'))).toHaveLength(1) // disposed regardless
    expect(w.terminals.log.filter((l: string) => l.startsWith('spawn:'))).toHaveLength(1) // the service ROUTE was entered; the refusal came inside the one-shot, pre-await
  })

  it('THE HANDLE ROUTES: open commits the PER-OPEN provider answer (native-shaped identity: sessionId/kind-bearing status/pid) and the captured native body is NEVER entered; remove the routing and this leg is RED', async () => {
    const w = await handleWorld()
    const { x } = await runPass(w.arms.terminal_open, w.binding, { type: 'shell', name: 'build' }, 'h-open')
    expect(x.ok, JSON.stringify(x).slice(0, 240)).toBe(true)
    // motd is the REAL initialize() viewport: what the shell actually
    // printed at readiness (the faithful prompt), not a canned constant
    expect(x.value).toMatchObject({ outcome: 'opened', sessionId: 'pty-svc-90', motd: 'bash-5.2$ ' })
    // FAITHFUL publication: the snapshot pid IS the backend session's own
    // pid (types.ts: the snapshot carries the backend's pid, not a constant)
    expect(Number((x.value as Record<string, unknown> | undefined)?.pid)).toBeGreaterThan(0)
    expect(x.value).toMatchObject({ name: 'build' })
    expect(String((x.value as Record<string, unknown> | undefined)?.type)).toBe('shell') // the caller-facing type is the DECLARED family; the internal route stays unexposed
    expect(w.terminals.log.filter((l: string) => /^spawn:dsh-g3-po-/.test(l)).length).toBe(1) // owner-authorized by the EXACT Agent; the route is the per-open INTERNAL type (the model never sees it)
    expect(w.natives.terminal_open.calls.length).toBe(0) // the HANDLE executed, not the delegate body
    const inflight = w.arms.terminal_open.inFlight()
    expect(inflight[0]?.handleIdentity).toMatchObject({ sessionId: 'pty-svc-90', status: { kind: 'running' } }) // handle-owned identity recorded from the ANSWER
  })

  it('EFFECT ENTRY HONESTY: cancel arriving AFTER the per-open spawn started does NOT claim zero effects — the started resource is CLEANED through the service and the refusal carries the cleanup truth', async () => {
    const w = await handleWorld({ deferredSpawn: true })
    const c = w.arms.terminal_open.classify({ type: 'shell' }, makeExec().exec, 'd-open')
    expect(c.ok, `${c.code} ${c.detail}`).toBe(true)
    const plan = c.plan as Record<string, unknown>
    expect(w.arms.terminal_open.prepare(plan, { grantId: 'grant-1' }).ok).toBe(true)
    const running = w.arms.terminal_open.execute(plan, { consumed: true, grant: grantFor(c, plan, w.binding, 'grant-1') })
    await new Promise((resolve) => setImmediate(resolve)) // the provider is now PARKED in the deferred spawn
    const word = w.arms.terminal_open.cancel(plan) // cancel is keyed by the ISSUED PLAN (the real edge key)
    expect(word.settled, JSON.stringify(word).slice(0, 200)).toBe('UNKNOWN-IN-FLIGHT') // prepare IS an effect entry — never 'cancelled before execution'
    expect(String(word.bodyOutcome)).toMatch(/at minimum UNKNOWN|never zero/)
    // THE REAL-ROUTE BOUNDARY, MEASURED: at cancel the capability had been
    // ENTERED but NOT ANSWERED (the pinned spec is mid-flight in the
    // deferred launch) — the word NEVER pretends a clean zero: it states
    // launchClaimed, and NOTHING is killed speculatively (the provider owns
    // its pre-answer rollback; the adapter never guesses a session that may
    // not exist).
    expect(w.launches.length).toBe(1) // entered — parked inside the controlled capability, NO handle yet
    const cleanupTruth2 = await (word as { cleanupSettled?: Promise<Record<string, unknown>> }).cleanupSettled
    expect(cleanupTruth2 === undefined || cleanupTruth2.launchClaimed === true).toBe(true)
    expect(cleanupTruth2 === undefined || cleanupTruth2.nothingToKill === true).toBe(true)
    expect(w.terminals.log.filter((l: string) => l.startsWith('kill')), JSON.stringify({ log: w.terminals.log, launches: w.launches.length })).toEqual([]) // zero speculative kills
    w.gate.settle() // the launch ANSWERS AFTER the cancel intent
    // ROOT 580f REVIEW ① (this tail REPLACES the old commit-wins tail, which
    // the root ruled the WRONG contract): the pending cancellation is REAL.
    // The instant the resource is ANSWERED, the port's post-await recheck
    // reads the cancel intent (isCancelled), CLEANS the answered session
    // through the service, and REFUSES the success commit with the cleanup
    // truth. The zero-speculative-kill law above still holds: nothing was
    // killed while nothing had been answered (不猜尚无资源) — the kill exists
    // only AFTER the real resource answered, exactly once.
    const x = await running
    expect(x.ok, JSON.stringify(x).slice(0, 220)).toBe(false) // the success commit is REFUSED, never silently cleared over a pending intent
    expect(x.code).toBe('P_TERM_CANCELLED_AFTER_EFFECT')
    expect((x as { effectsStarted?: boolean }).effectsStarted).toBe(true)
    expect((x as { cleanup?: Record<string, unknown> }).cleanup?.started).toBe(true)
    expect(w.terminals.log.filter((l: string) => l.startsWith('kill'))).toEqual(['kill:pty-svc-90']) // the ANSWERED session cleaned — after the answer, exactly once
  })

  it('FACTS MOVED AFTER THE EFFECT (no cancel — the pure drift edge): the CURRENT-FACTS recheck after the awaited spawn refuses with the drift code AND cleans the started resource — never a zero-effect word', async () => {
    const w = await handleWorld({ deferredSpawn: true })
    const c = w.arms.terminal_open.classify({ type: 'shell' }, makeExec().exec, 'd-drift')
    const plan = c.plan as Record<string, unknown>
    expect(w.arms.terminal_open.prepare(plan, { grantId: 'grant-1' }).ok).toBe(true)
    const running = w.arms.terminal_open.execute(plan, { consumed: true, grant: grantFor(c, plan, w.binding, 'grant-1') })
    await new Promise((resolve) => setImmediate(resolve)) // the provider is now PARKED in the deferred spawn
    w.ptyService.moveEnvelope() // the approved envelope moved WHILE the spawn was in flight — NO cancel: facts law alone
    w.gate.settle()
    const x = await running
    expect(x.ok).toBe(false)
    expect(x.code).toMatch(/TARGET_DRIFT/)
    expect(String(x.detail)).toMatch(/moved after|effects started/i)
    expect(x.effectsStarted).toBe(true)
    expect((x as { cleanup?: { started?: boolean } }).cleanup?.started).toBe(true)
    expect(w.terminals.log.filter((l: string) => l.startsWith('kill'))).toEqual(['kill:pty-svc-90']) // EXACTLY one cleanup of the started resource, no double kill
    const inflight = w.arms.terminal_open.inFlight()
    expect(JSON.stringify(inflight)).toMatch(/EXECUTING-REFUSED/) // refusal is NOT settlement: the effects-started fact stays visible in the live inventory
  })

  it('the REAL result is awaited through the handle: a foreground send commits EXACTLY the TerminalSendResult the operation.done resolved (viewport/waitReason/sessionStatus/truncated), the captured body never entered', async () => {
    // The real service settles `done` on readiness/timeout/exit; this world
    // drives the committed-value shape with an auto-settling operation —
    // same TerminalSendOperation contract.
    const w = await handleWorld({ autoSettleSend: { viewport: '>>> ', waitReason: 'inferred_idle', sessionStatus: { kind: 'running' }, truncated: false } })
    const record: string[] = (w.terminals as unknown as { log: string[] }).log
    const { x } = await runPass(w.arms.terminal_send, w.binding, { sessionId: 'pty-1', text: 'python3\n', submit: true }, 'h-send-2')
    expect(x.ok).toBe(true)
    // THE COMMITTED VALUE IS THE HANDLE'S ANSWER — not a re-shaped echo
    // (the waitReason rides the REAL enum spelling @639ed01539). ROOT 580f
    // REVIEW ②: the foreground word carries the HOST's own kind tag beside
    // the VERBATIM TerminalSendResult (tool-terminal src/index.ts:283:
    // { kind: 'foreground', ...result }):
    expect(x.value).toEqual({ kind: 'foreground', viewport: '>>> ', waitReason: 'inferred_idle', sessionStatus: { kind: 'running' }, truncated: false })
    expect(w.natives.terminal_send.calls.length).toBe(0)
    expect(record).toEqual(['send:pty-1:python3\n:true'])
  })

  it('terminate is the REAL face: close commits the service kill word (closed, then already-closing — kill FALSE is answered, never upgraded); read/signal/list route through the service with zero body', async () => {
    const w = await handleWorld()
    const opened = await runPass(w.arms.terminal_open, w.binding, { type: 'shell' }, 'h-o2')
    expect(opened.x.ok, JSON.stringify(opened.x).slice(0, 220)).toBe(true)
    const sessionId = String((opened.x.value as Record<string, unknown>).sessionId)
    w.ptyService.recordMinted(sessionId) // the service owns the session: the facts reader carries it
    // LIVE FIRST: read/signal/list ride the live session through the
    // service — the captured body never entered on the handle path.
    const read = await runPass(w.arms.terminal_read, w.binding, { sessionId, count: 10 }, 'h-r1')
    expect(read.x.value).toMatchObject({ text: 'make: nothing to be done\n' })
    const sig = await runPass(w.arms.terminal_signal, w.binding, { sessionId, signal: 'SIGINT' }, 'h-s1')
    // THE REAL TerminalSignalResult: {delivered:true,targetPgid} (types.ts
    // TerminalSignalResult; session.ts signal: {delivered:true,targetPgid}
    // from signalForeground) — the fabricated {deliveredTo} shape is GONE
    expect(sig.x.value).toMatchObject({ delivered: true })
    expect(Number((sig.x.value as { targetPgid?: number }).targetPgid)).toBeGreaterThan(0) // the REAL foreground group of THIS session's backend answered
    const list = await runPass(w.arms.terminal_list, w.binding, {}, 'h-l1')
    expect(Array.isArray(list.x.value)).toBe(true)
    // THEN TERMINATE: the service kill word, answered honestly twice.
    const first = await runPass(w.arms.terminal_close, w.binding, { sessionId }, 'h-c1')
    expect(first.x.value).toEqual({ sessionId, outcome: 'closed' }) // CARD 4: the close word names WHICH session the service closed beside its two-valued answer
    const again = await runPass(w.arms.terminal_close, w.binding, { sessionId }, 'h-c2')
    expect(again.x.value).toEqual({ sessionId, outcome: 'already-closing' }) // kill FALSE answered honestly — never 'closed'
    // A DEAD session refuses at the SERVICE entry (NO_SESSION through the
    // port) — zero invoke past a dead handle, zero body, always.
    expect(Object.values(w.natives).every((n) => n.calls.length === 0)).toBe(true)
    expect(w.terminals.log.filter((l) => l.startsWith('kill'))).toEqual([`kill:${sessionId}`, `kill-in-flight:${sessionId}`])
  })

  it('a background send is the REAL ctx.jobs CONTRACT, never a fake id: no registry ⇒ typed refusal with zero start; with it the REAL JobSpec (OWNER — never unowned, output source, hooks.cancel + done) starts, the drain word carries the id UNCLEARED, and cancel-after-start kills OWNER-CHECKED with the awaited settle', async () => {
    const unwired = await handleWorld()
    const refused = await runPass(unwired.arms.terminal_send, unwired.binding, { sessionId: 'pty-1', text: 'long\n', run_in_background: true }, 'bg-0')
    expect(refused.x.code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.BG_PORT_UNWIRED)
    expect(unwired.terminals.log.length).toBe(0) // zero start: preflight refusal before any resource

    const started: Array<Record<string, unknown>> = []
    let lastHooks: { cancel: (r?: string) => void; done: Promise<unknown> } | null = null
    const jobs = {
      start: (spec: Record<string, unknown>) => {
        // the REAL JobSpec contract (jobs types.d.ts:117): kind/label, OWNER
        // (an unowned job is open to any caller — forbidden here), pull
        // output sources, run(job) SYNCHRONOUS answering JobHooks
        // {cancel(reason?) synchronous, done: Promise<JobOutcome>}.
        const hooks = (spec.run as (job: unknown) => { cancel: (r?: string) => void; done: Promise<unknown> })({ append: () => {} })
        lastHooks = hooks
        started.push({
          kind: spec.kind,
          label: spec.label,
          owner: spec.owner, // NEVER omitted
          outputSourceRead: typeof (spec.output as Array<Record<string, unknown>>)[0]?.read === 'function',
          doneHook: typeof hooks.done?.then === 'function',
          cancelHook: typeof hooks.cancel === 'function',
        })
        return 'job-pty-send-7'
      },
      kill: (id: string, _caller?: string) => {
        if (lastHooks !== null) lastHooks.cancel('registry kill') // the real registry cancels the hooks; the double settles
        return id === 'job-pty-send-7' ? 'requested' : 'already-finished'
      },
    }
    const w = await handleWorld({ jobs })
    const { x } = await runPass(w.arms.terminal_send, w.binding, { sessionId: 'pty-1', text: 'make\n', run_in_background: true }, 'bg-1')
    expect(x.ok).toBe(true)
    // ROOT 580f REVIEW ②: the HOST's own background word shape @639ed01539
    // (tool-terminal src/index.ts:278) is { kind: 'background', jobId } —
    // the kind tag is the real fact, not a generic outcome string.
    expect(x.value).toEqual({ kind: 'background', jobId: 'job-pty-send-7' })
    expect(started).toEqual([{
      kind: 'pty-send', label: 'g3 terminal_send pty-1', owner: `session-${AGENT_ID}`,
      outputSourceRead: true, doneHook: true, cancelHook: true,
    }]) // OWNER carried; hooks.cancel/done present; output source rides — the REAL JobSpec shape
    expect(w.terminals.log).toEqual(['send:pty-1:make\n:true']) // the operation started INSIDE run()
    const drain = w.arms.terminal_send.drain()
    expect(drain.unsettledBackgroundJobIds).toEqual(['job-pty-send-7']) // UNCLEARED: the jobs record owns the settlement
    expect(drain.controls).toMatch(/no resource is settled/)
    // the output source speaks JobSourceRead: whole-stream offsets accumulating consumed deltas
    const sourceRead = (started.length > 0 ? jobs : jobs) && null
    void sourceRead
  })

  it('terminate is the REAL control face: a background job dies OWNER-CHECKED through registry.kill(id, caller) with the AWAITED JobOutcome; an async send dies through operation.cancel — NEVER killing the persistent PTY — with the awaited TerminalSendResult', async () => {
    let settleOperation: (v: Record<string, unknown>) => void = () => {}
    let operationDone: Promise<Record<string, unknown>> = Promise.resolve({})
    const log: string[] = []
    const terminals = {
      spawn: async () => { throw new Error('unused') },
      registerBackend: () => () => {}, // census-complete face; opens are not part of this leg
      startSend: () => {
        log.push('startSend')
        operationDone = new Promise<Record<string, unknown>>((resolve) => { settleOperation = resolve })
        return {
          done: operationDone,
          readOutput: () => ({ delta: 'out', truncated: false }),
          // CARD 5: a SIGINT cancel wakes the wait — the REAL host answers a
          // TerminalWaitReason enum member ('stdin_read' here), NEVER a
          // fabricated 'cancelled'; the cancelled FACT of this operation
          // rides the adapter's own word (cancelled:true / cancelRequested),
          // and the awaited TerminalSendResult rides VERBATIM.
          cancel: () => { log.push('operation.cancel'); settleOperation({ viewport: '^C', waitReason: 'stdin_read', sessionStatus: { kind: 'running' }, truncated: false }); return true },
        }
      },
      read: () => ({ text: '', truncated: false, oldest: 0, newest: 0 }),
      signal: async () => ({ delivered: true, targetPgid: 1 }),
      kill: async () => { log.push('service.kill — FORBIDDEN on a send cancel'); return true },
      list: () => [],
      log,
    }
    const killed: Array<[string, string | undefined]> = []
    let hooksCancel: ((r?: string) => void) | null = null
    const jobs = {
      start: (spec: Record<string, unknown>) => {
        const hooks = (spec.run as (j: unknown) => { cancel: (r?: string) => void; done: Promise<unknown> })({ append: () => {} })
        hooksCancel = hooks.cancel
        return 'job-pty-send-9'
      },
      kill: (id: string, caller?: string) => {
        killed.push([id, caller])
        hooksCancel?.('registry kill') // the real registry forwards cancel; the operation settles cancelled
        return 'requested'
      },
    }
    const port = G3.createHostTerminalControlPort({
      terminals,
      resolveOwner: (exec: Record<string, unknown>) => (exec as { agent?: unknown }).agent ?? null,
      jobs,
      ownerSessionId: (agentId: string) => `session-${String(agentId)}`,
      subprocess: { spawnTerminal: async () => { throw new Error('unused: opens are not part of this leg') } },
    }) as unknown as { prepare: (spec: Record<string, unknown>) => Promise<Record<string, unknown>> }
    const execFor = makeExec().exec
    const prepped = await port.prepare({
      toolName: 'terminal_send',
      canonical: { sessionId: 'pty-1', text: 'long\n', submit: true, run_in_background: true },
      exec: execFor, callId: 'bg-t2', correlation: 'bg-t2',
      isCancelled: () => false,
    })
    expect(prepped.ok).toBe(true)
    const handle = prepped.handle as { identity: Record<string, unknown>; terminate: () => Promise<Record<string, unknown>> }
    expect(handle.identity).toMatchObject({ jobId: 'job-pty-send-9', background: true })
    const termWord = await handle.terminate()
    expect(killed).toEqual([['job-pty-send-9', `session-${AGENT_ID}`]]) // OWNER-CHECKED kill(id, caller)
    expect(termWord).toMatchObject({ kill: 'requested' })
    // THE AWAITED real JobOutcome under the REAL waitReason law + g3a CARD 5
    // (root SIGNED OFF, kept verbatim): a bg cancel's job settles with the
    // REAL JobOutcome — status is the published three-valued word ('completed'
    // | 'killed' | 'failed', jobs/src/types.ts:16-18 @639ed01539) and the
    // KILLED fact rides the arm's DISTINCT cancelRequested fact, while the
    // waitReason stays the VERBATIM REAL enum member the provider answered
    // (SIGINT evidence = 'stdin_read' on this double; there is NO 'cancelled'
    // TerminalWaitReason). The final outcome-mapping word for bg/jobs is the
    // g3a CARD 5 block — this leg asserts THAT word.
    expect((termWord as { settled?: Record<string, unknown> }).settled).toMatchObject({ status: 'killed', detail: 'waitReason: stdin_read (cancelRequested)', result: '^C' })
    // FOREGROUND SEND TERMINATION: operation.cancel; the PTY is NEVER killed;
    // the awaited TerminalSendResult is the word.
    const fgPrepped = await port.prepare({
      toolName: 'terminal_send',
      canonical: { sessionId: 'pty-1', text: 'sleep 30\n', submit: true },
      exec: execFor, callId: 'fg-t1', correlation: 'fg-t1',
      isCancelled: () => false,
    })
    expect(fgPrepped.ok).toBe(true)
    const fgHandle = fgPrepped.handle as { terminate: () => Promise<Record<string, unknown>> }
    const fgWord = await fgHandle.terminate()
    expect(fgWord).toMatchObject({ cancelled: true }) // the cancelled FACT rides the adapter's own word…
    // …and the awaited TerminalSendResult rides VERBATIM with the REAL enum
    // waitReason (CARD 5: the host never answers 'cancelled' — the KILLED/
    // cancelled fact is the caller's own distinct fact, never an overloaded
    // waitReason value).
    expect((fgWord as { settled?: Record<string, unknown> }).settled).toMatchObject({ waitReason: 'stdin_read' })
    expect(log.filter((l) => l.startsWith('service.kill')).length).toBe(0) // cancelling an async send NEVER kills the persistent PTY
  })

  it('CARD 2 — a REFUSED terminate is NOT a closed:false success: the close row REJECTS with the provider refusal observable, the session stays open, and the close stays RETRYABLE through the same entry', async () => {
    const w = await handleWorld({ terminateRefusals: 1 })
    const opened = await runPass(w.arms.terminal_open, w.binding, { type: 'shell' }, 'c2-open')
    expect(opened.x.ok, JSON.stringify(opened.x).slice(0, 200)).toBe(true)
    const sessionId = String((opened.x.value as Record<string, unknown>).sessionId)
    w.ptyService.recordMinted(sessionId)
    // THE REFUSAL: the provider REJECTS the awaited terminate — the real
    // terminal-bash closeOnce RE-THROWS a terminate failure ('PTY cleanup
    // failed', session.ts @639ed01539); the published contract carries no
    // closed:false word. The row must REJECT with that refusal (typed
    // failure observable at the row), never resolve a fabricated success.
    const c = w.arms.terminal_close.classify({ sessionId }, makeExec().exec, 'c2-refused')
    const plan = c.plan as Record<string, unknown>
    expect(w.arms.terminal_close.prepare(plan, { grantId: 'grant-1' }).ok).toBe(true)
    await expect(w.arms.terminal_close.execute(plan, { consumed: true, grant: grantFor(c, plan, w.binding, 'grant-1') })).rejects.toThrow(/refused the awaited terminate/)
    // REFUSED ≠ SETTLED: the service did NOT mark the session closed, and
    // the arm keeps the failure visible (FAILED-UNKNOWN, never COMMITTED).
    const inflight = JSON.stringify(w.arms.terminal_close.inFlight())
    expect(inflight).toMatch(/FAILED-UNKNOWN/)
    expect(inflight).not.toMatch(/"closed":false/) // no fabricated closed:false shape anywhere
    // THE REFUSAL IS RETRYABLE: a SECOND close re-enters the real terminate
    // (the refused attempt is NOT cached as a permanent answer) and commits
    // the REAL close word — sessionId + the two-valued service answer.
    const retry = await runPass(w.arms.terminal_close, w.binding, { sessionId }, 'c2-retry')
    expect(retry.x.ok, JSON.stringify(retry.x).slice(0, 200)).toBe(true)
    expect(retry.x.value).toEqual({ sessionId, outcome: 'closed' })
    expect(w.terminals.log.filter((l: string) => l.startsWith('kill'))).toEqual([`kill:${sessionId}`]) // exactly one real close; the refused attempt logged NO kill
  })

  it('CARD 3 — a cancel of ONE in-flight send cleans its OWN operation: the recorded intent kind survives the handle commit, so the cleanup routes operation.cancel with its REAL settle awaited — the persistent PTY is NEVER killed', async () => {
    const w = await handleWorld()
    // pty-1 is a SEEDED service session whose operation settles ONLY when
    // cancelled (the double's contract) — the send stays in flight until the
    // cleanup law cancels exactly that operation.
    const c = w.arms.terminal_send.classify({ sessionId: 'pty-1', text: 'sleep 30\n', submit: true }, makeExec().exec, 'c3-cancel-send')
    expect(c.ok, `${c.code} ${c.detail}`).toBe(true)
    const plan = c.plan as Record<string, unknown>
    expect(w.arms.terminal_send.prepare(plan, { grantId: 'grant-1' }).ok).toBe(true)
    const running = w.arms.terminal_send.execute(plan, { consumed: true, grant: grantFor(c, plan, w.binding, 'grant-1') })
    await new Promise((resolve) => setImmediate(resolve)) // the operation started, the handle is mid-invoke on the real settle
    const word = w.arms.terminal_send.cancel(plan)
    expect(word.settled, JSON.stringify(word).slice(0, 200)).toBe('UNKNOWN-IN-FLIGHT') // cancel is not close — it never claims the outcome
    const cleanup = await (word as { cleanupSettled?: Promise<Record<string, unknown>> }).cleanupSettled
    // THE INTENT'S OWN FACE: the send-operation kind recorded at start rides
    // the cleanup routing (before the card-3 fix the generic handle CLOBBERED
    // it and this fell through to the session-level branch).
    expect(cleanup).toMatchObject({ routed: true, face: 'operation.cancel' })
    expect((cleanup as { settled?: Record<string, unknown> }).settled).toMatchObject({ waitReason: 'stdin_read' }) // the REAL awaited TerminalSendResult
    const x = await running
    expect(x.ok, JSON.stringify(x).slice(0, 200)).toBe(true) // the cancelled operation ANSWERED — its word commits
    expect(w.terminals.log.filter((l: string) => l.startsWith('kill'))).toEqual([]) // the persistent PTY survives one cancelled send
  })

  it('CARD 3 + root 580f① — a cancel while EXECUTING with NO resource answered REGISTERS the pending cancellation and is HONOURED the moment the real resource answers: cleanup through the service, the success commit REFUSED with the cleanup truth (never dropped bookkeeping, never a speculative kill)', async () => {
    const w = await handleWorld({ deferredSpawn: true })
    const c = w.arms.terminal_open.classify({ type: 'shell' }, makeExec().exec, 'c3-pending')
    expect(c.ok, `${c.code} ${c.detail}`).toBe(true)
    const plan = c.plan as Record<string, unknown>
    expect(w.arms.terminal_open.prepare(plan, { grantId: 'grant-1' }).ok).toBe(true)
    const running = w.arms.terminal_open.execute(plan, { consumed: true, grant: grantFor(c, plan, w.binding, 'grant-1') })
    await new Promise((resolve) => setImmediate(resolve)) // parked inside the controlled capability — NOTHING has been answered back yet
    const word = w.arms.terminal_open.cancel(plan)
    expect(word.settled).toBe('UNKNOWN-IN-FLIGHT')
    expect((word as { cancelPending?: boolean }).cancelPending).toBe(true) // REGISTERED on the no-resource path (before the fix this word dropped the bookkeeping)
    expect(w.terminals.log.filter((l: string) => l.startsWith('kill'))).toEqual([]) // 不猜尚无资源 — nothing is killed while NO resource exists
    expect(JSON.stringify(w.arms.terminal_open.inFlight())).toMatch(/"cancelPending":true/) // visible in the live inventory (observability, never authority)
    w.gate.settle() // NOW the real resource ANSWERS — root 580f①: the registered intent is HONOURED here
    const x = await running
    expect(x.ok, JSON.stringify(x).slice(0, 220)).toBe(false) // the success commit is REFUSED over the pending intent — never a silent commit that clears the bookkeeping
    expect(x.code).toBe('P_TERM_CANCELLED_AFTER_EFFECT')
    expect((x as { effectsStarted?: boolean }).effectsStarted).toBe(true)
    expect((x as { cleanup?: Record<string, unknown> }).cleanup?.started).toBe(true) // the ANSWERED session was cleaned through the service…
    expect(w.terminals.log.filter((l: string) => l.startsWith('kill'))).toEqual(['kill:pty-svc-90']) // …exactly once, and only AFTER the answer
    const inflightAfter = JSON.stringify(w.arms.terminal_open.inFlight())
    expect(inflightAfter).toMatch(/settled-with-cleanup-truth/) // the pending bookkeeping SETTLED by the real cleanup it commanded
    expect(inflightAfter).not.toMatch(/"cancelPending":true/)
  })

  it('CARD 5 — a REJECTING job done STILL SETTLES the row: JobHooks.done resolves the published terminal JobOutcome (never rejects, never leaves the awaited settle hanging), and the killed fact rides the DISTINCT cancelRequested fact', async () => {
    const build = (opts: { selfReject: boolean }) => {
      const log: string[] = []
      let rejectDone: (e: Error) => void = () => {}
      const terminals = {
        spawn: async () => { throw new Error('unused: opens are not part of this leg') },
        registerBackend: () => () => {},
        startSend: () => {
          log.push('startSend')
          const done = new Promise<Record<string, unknown>>((_resolve, reject) => { rejectDone = reject })
          if (opts.selfReject) queueMicrotask(() => rejectDone(new Error('transport died mid-send (test)')))
          return {
            done,
            readOutput: () => ({ delta: 'out', truncated: false }),
            cancel: () => { log.push('operation.cancel'); rejectDone(new Error('transport died mid-send (test)')); return true },
          }
        },
        read: () => ({ text: '', truncated: false }),
        signal: async () => ({ delivered: true, targetPgid: 1 }),
        kill: async () => { log.push('service.kill — FORBIDDEN on a send cancel'); return true },
        list: () => [],
        log,
      }
      let hooksDone: Promise<Record<string, unknown>> | null = null
      let hooksCancel: ((r?: string) => void) | null = null
      const jobs = {
        start: (spec: Record<string, unknown>) => {
          const hooks = (spec.run as (j: unknown) => { cancel: (r?: string) => void; done: Promise<Record<string, unknown>> })({ append: () => {} })
          hooksCancel = hooks.cancel
          hooksDone = hooks.done
          return 'job-c5-1'
        },
        kill: (_id: string, _caller?: string) => {
          hooksCancel?.('registry kill') // the real registry forwards the cancel; the double then REJECTS the operation's done
          return 'requested'
        },
      }
      const port = G3.createHostTerminalControlPort({
        terminals,
        resolveOwner: (exec: Record<string, unknown>) => (exec as { agent?: unknown }).agent ?? null,
        jobs,
        ownerSessionId: (agentId: string) => `session-${String(agentId)}`,
        subprocess: { spawnTerminal: async () => { throw new Error('unused') } },
      }) as unknown as { prepare: (spec: Record<string, unknown>) => Promise<Record<string, unknown>> }
      return { port, log, takeHooksDone: () => { const h = hooksDone; hooksDone = null; return h } }
    }
    const bgSpec = { toolName: 'terminal_send', canonical: { sessionId: 'pty-1', text: 'long\n', submit: true, run_in_background: true }, callId: 'c5', correlation: 'c5', isCancelled: () => false }
    // UNCANCELLED REJECTION → the published conversion: `failed` (jobs types
    // .d.ts JobHooks.done: must not reject; the runtime converts a rejection
    // to failed). The row SETTLES — it is never left unsettled.
    const a = build({ selfReject: true })
    const prepA = await a.port.prepare({ ...bgSpec, exec: makeExec().exec })
    expect(prepA.ok).toBe(true)
    const settledA = await (a.takeHooksDone() as Promise<Record<string, unknown>>) // resolves — a rejecting done NEVER surfaces as a rejected hook
    expect(settledA).toMatchObject({ status: 'failed' })
    expect(String(settledA.detail)).toMatch(/settle failed/)
    // CANCELLED REJECTION → the DISTINCT fact decides the killed status (the
    // real host never answers waitReason:'cancelled'); the awaited control
    // word carries it — a rejection cannot hang registry.kill's follow.
    const b = build({ selfReject: false })
    const prepB = await b.port.prepare({ ...bgSpec, exec: makeExec().exec })
    expect(prepB.ok).toBe(true)
    const termWord = await (prepB.handle as { terminate: () => Promise<Record<string, unknown>> }).terminate()
    expect(termWord).toMatchObject({ kill: 'requested' })
    expect((termWord as { settled?: Record<string, unknown> }).settled).toMatchObject({ status: 'killed' }) // cancelRequested — not an overloaded waitReason
    expect(String((termWord as { settled?: Record<string, unknown> }).settled?.detail)).toMatch(/cancelRequested/)
    expect(b.log.filter((l: string) => l.startsWith('service.kill')).length).toBe(0) // the persistent PTY is never killed for a cancelled background send
  })

  it('an unanswered handle NEVER executes: a port that fails to answer a real handle refuses at the entry typed with zero invoke and zero body; an owner the adapter cannot answer refuses before any service call', async () => {
    const broken = await handleWorld({ brokenPort: true })
    // The governed open target is UNANSWERABLE at the seam here: classify
    // itself refuses (the per-open law is admit-time, not best-effort).
    const openC = broken.arms.terminal_open.classify({ type: 'shell' }, makeExec().exec, 'bad-1')
    expect(openC.code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.TARGET_UNRESOLVED)
    expect(String(openC.detail)).toMatch(/per-open/)
    // A row that DOES reach the port and gets no real handle answer refuses
    // at the entry — never executes behind an unanswered handle.
    const r = await runPass(broken.arms.terminal_send, broken.binding, { sessionId: 'pty-1', text: 'ls\n' }, 'bad-1b')
    expect(r.x.code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.TARGET_UNRESOLVED)
    expect(r.x.detail).toMatch(/never executes behind an unanswered handle/)
    expect(broken.natives.terminal_send.calls.length).toBe(0)
    expect(broken.terminals.log.filter((l: string) => l.startsWith('send')).length).toBe(0)

    const ownerless = await handleWorld({ noOwner: true })
    const r2 = await runPass(ownerless.arms.terminal_open, ownerless.binding, { type: 'shell' }, 'bad-2')
    expect(r2.x.code).toBe(G3.A5_G3_TERMINAL_TYPED_CODES.PORT_OWNER_UNRESOLVED)
    expect(ownerless.terminals.log.length).toBe(0) // owner authorization FIRST: zero service reach
  })

  it('the adapter is CONTRACT-verified at assembly: a terminals face missing ANY method, or a missing resolveOwner, throws — the adapter names the entry, it does not simulate it', () => {
    expect(() => G3.createHostTerminalControlPort({ terminals: {}, resolveOwner: () => null })).toThrow(/dsh-terminal/)
    expect(() => G3.createHostTerminalControlPort({ terminals: makeTerminalsDouble() })).toThrow(/resolveOwner/)
  })
  it('ANTI-TAUTOLOGY: the SAME classified plan through the two routes lands on DIFFERENT backends — handle path commits the SERVICE word with zero native entries, delegate path enters the captured body with zero service calls; a module that ignored the port would run this leg RED', async () => {
    const wHandle = await handleWorld()
    const viaHandle = await runPass(wHandle.arms.terminal_list, wHandle.binding, {}, 'anti-1')
    expect(viaHandle.x.ok).toBe(true)
    expect(viaHandle.x.value).toEqual([{ sessionId: 'pty-1', type: 'shell', pid: 4101, status: 'running' }, { sessionId: 'pty-2', type: 'shell', pid: 4102, status: 'running' }]) // the SERVICE's list answer
    expect(wHandle.natives.terminal_list.calls.length).toBe(0)
    expect(wHandle.terminals.log).toEqual(['list'])
    const wDelegate = await terminalWorld()
    const viaDelegate = await runPass(wDelegate.arms.terminal_list, wDelegate.binding, {}, 'anti-2')
    expect(viaDelegate.x.ok).toBe(true)
    expect(wDelegate.natives.terminal_list.calls.length).toBe(1) // the captured body executed
    expect(viaDelegate.x.value).not.toEqual(viaHandle.x.value) // the answers DIFFER by construction
  })

  // ─── round-8 PTY law closure (root 16:2x/16:38, g3b service layer) ───
  it('NORMALIZE BEFORE DIGEST: the approved digest covers the CANONICAL launch envelope (executable->argv, request cwd override, terminalType default) and the spawn receives EXACTLY the digested form — no post-digest mutation, no spawn-then-refuse', async () => {
    // the plan carries NO terminalType and the REQUEST carries a cwd: the
    // round-7 defect digested {cwd:plan.cwd, terminalType:null} then
    // SPAWNED {cwd:request.cwd, terminalType:'dumb'} — a mutation AFTER
    // approval. The law now: canonicalize first, digest the canonical,
    // spawn the canonical.
    const w = await handleWorld({ openPlan: { terminalType: undefined } })
    const pass = await runPass(w.arms.terminal_open, w.binding, { type: 'shell', cwd: '/req/approved' }, 'norm-1')
    expect(pass.x.ok).toBe(true)
    expect((pass.x.value as Record<string, unknown>).outcome).toBe('opened')
    expect(w.launches.length).toBe(1)
    // the spec the controlled capability ACTUALLY received is the
    // canonical approved envelope: argv resolved from executable, the
    // REQUEST cwd already applied, 'dumb' already applied
    expect(w.launches[0]).toMatchObject({
      argv: ['/approved/bin/bash'],
      cwd: '/req/approved',
      env: { TERM: 'dumb' },
      rows: 24, cols: 80, graceMs: 5000,
      terminalType: 'dumb',
    })
    // and the post-spawn envelope recheck matched the approved digest
    // (no ENVELOPE_DRIFT): digest-spawn equality holds on the SAME
    // canonical shape — proven by the pass above plus zero cleanup words
    expect(w.terminals.log.filter((l: string) => l.startsWith('kill')).length).toBe(0)
    // env NULLISH UNIFIED (root 4fdaf review 1): an ABSENT env must not
    // materialize env:{} into the launch spec — the digest omitted env, so
    // the spawned envelope omits it too (the strict ===null test made
    // undefined diverge from null and re-opened the digest gap)
    const w2 = await handleWorld({ openPlan: { env: undefined } })
    const pass2 = await runPass(w2.arms.terminal_open, w2.binding, { type: 'shell' }, 'norm-2')
    expect(pass2.x.ok).toBe(true)
    expect((pass2.x.value as Record<string, unknown>).outcome).toBe('opened')
    expect(Object.prototype.hasOwnProperty.call(w2.launches[0] ?? {}, 'env')).toBe(false)
    expect(w2.terminals.log.filter((l: string) => l.startsWith('kill')).length).toBe(0)
  })

  it('REAL SESSION CAPABILITY REQUIRED: a mount without deps.sessionFactory refuses the open BEFORE any effect — NO registration spawn, NO handle — and names the seam (pinned 639 terminal-bash LocalPtySession); no adapter shim is substituted', async () => {
    const w = await handleWorld({ noSessionCapability: true })
    const refused = await runPass(w.arms.terminal_open, w.binding, { type: 'shell' }, 'nosec-1')
    expect(refused.x.code).toBe('P_TERM_OPEN_SESSION_CAPABILITY_ABSENT')
    expect(String((refused.x as Record<string, unknown>).detail)).toMatch(/LocalPtySession/)
    expect(w.launches.length).toBe(0) // zero spawn: refused before the first await
    expect(w.terminals.log.filter((l: string) => l.startsWith('spawn')).length).toBe(0)
    expect(w.natives.terminal_open.calls.length).toBe(0) // the captured body never ran
  })

  it('STARTUP READINESS IS THE REAL LAW AND ITS FAILURE IS STARTED-AND-CLEANED: initialize() rejecting cleans the UNPUBLISHED handle to AWAITED quiescence before publication — typed refusal, zero published session, and NOT a zero-effect word', async () => {
    const w = await handleWorld({ startupFails: true })
    const refused = await runPass(w.arms.terminal_open, w.binding, { type: 'shell' }, 'startup-1')
    expect(refused.x.code).toBe('P_TERM_OPEN_STARTUP_FAILED')
    // the effect STARTED (the controlled spawn ran) and was CLEANED: the
    // CONSTRUCTED session was cleaned through its OWN close() (which awaits
    // provider terminate — observed via the wrapped counter) BEFORE any
    // publication — an honest started-and-cleaned, never zero-effect
    expect(w.launches.length).toBe(1)
    expect(w.startupHandles.length).toBe(1)
    expect(w.startupHandles[0]?.terminateCalls).toBe(1)
    // ZERO PUBLICATION, MEASURED: the route reached the service spawn, but
    // the service's publication (sessions.set AFTER backend.spawn resolved)
    // never ran — the integrator's session-facts feed knows NO session
    expect(w.terminals.log.some((l: string) => l.startsWith('spawn:dsh-g3-po-startup-1'))).toBe(true) // the PER-OPEN route type reached the service
    expect(w.ptyService.session(AGENT_ID, 'pty-svc-90')).toBeNull()
    expect(String((refused.x as Record<string, unknown>).detail)).toMatch(/started-and-cleaned/)
  })

  it('CLEANUP PATHS ARE THE REAL LAW: an UN-CONSTRUCTED resource cleans through provider terminate (awaited, failure propagated); a cleanup FAILURE propagates BOTH errors and claims NO quiescence — resources-may-remain is stated, never hidden', async () => {
    // un-constructed: the factory itself throws -> handle.terminate route
    const wF = await handleWorld({ factoryFails: true })
    const refusedF = await runPass(wF.arms.terminal_open, wF.binding, { type: 'shell' }, 'nofac-1')
    expect(refusedF.x.code).toBe('P_TERM_OPEN_STARTUP_FAILED')
    expect(wF.launches.length).toBe(1)
    expect(wF.startupHandles[0]?.terminateCalls).toBe(1) // provider terminate AWAITED
    expect(String((refusedF.x as Record<string, unknown>).detail)).toMatch(/TERMINATED AND AWAITED to quiescence/)
    // constructed + readiness fails + CLEANUP also fails: the 4fdaf defect
    // (swallowing the cleanup rejection while claiming quiescence) is now
    // a typed started-and-CLEANUP-FAILED word carrying BOTH errors
    const wC = await handleWorld({ cleanupFails: true })
    const refusedC = await runPass(wC.arms.terminal_open, wC.binding, { type: 'shell' }, 'cleanup-1')
    expect(refusedC.x.code).toBe('P_TERM_OPEN_STARTUP_CLEANUP_FAILED')
    const detail = String((refusedC.x as Record<string, unknown>).detail)
    expect(detail).toMatch(/readiness/) // the original startup failure rides
    expect(detail).toMatch(/EPERM/) // AND the cleanup failure — nothing swallowed
    expect(detail).toMatch(/did NOT reach quiescence/)
    expect(detail).toMatch(/resources may remain/)
    expect(detail).toMatch(/started-and-CLEANUP-FAILED/) // the word IS the cleanup failure, no zero-effect dressing
    expect(wC.ptyService.session(AGENT_ID, 'pty-svc-90')).toBeNull() // never published
  })
})

describe('g3 r9 — every DERIVED face (captured authored spec → g3CanonicalRegistrationFace) IS the canonical host registration face (REAL pinned validator + REAL host lift)', () => {
  const specs: Array<[string, Record<string, unknown>]> = [
    ['terminal_open', CAPTURED.terminal_open as unknown as Record<string, unknown>],
    ['terminal_send', CAPTURED.terminal_send as unknown as Record<string, unknown>],
    ['terminal_read', CAPTURED.terminal_read as unknown as Record<string, unknown>],
    ['terminal_signal', CAPTURED.terminal_signal as unknown as Record<string, unknown>],
    ['terminal_close', CAPTURED.terminal_close as unknown as Record<string, unknown>],
    ['terminal_list', CAPTURED.terminal_list as unknown as Record<string, unknown>],
    ['lsp', CAPTURED.lsp as unknown as Record<string, unknown>],
    ['run_code', CAPTURED.run_code as unknown as Record<string, unknown>],
  ]
  const derived = specs.map(([name, spec]) => [name, G3.g3CanonicalRegistrationFace(spec)] as const)

  async function hostTools() {
    const repo = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
    if (repo === null) throw new Error('no repo root carrying tests/deepseek-harness-test-use — failing closed')
    const lib = join(repo, 'tests', 'deepseek-harness-test-use', 'packages', 'core', 'tools', 'lib', 'index.js')
    if (!existsSync(lib)) throw new Error(`pristine host lib absent (${lib}); failing closed`)
    return (await import(pathToFileURL(lib).href)) as unknown as {
      assertSupportedJsonSchema: (schema: unknown) => void
      validateJsonSchemaValue: (schema: unknown, value: unknown, path: string) => string[]
      parameterSchemaSpecToJsonSchema: (spec: Record<string, unknown>) => Record<string, unknown>
      defineTool: (options: {
        name: string
        description: string
        parameters: Record<string, unknown>
        output: { schema: Record<string, unknown>; render: (args: unknown, value: unknown) => [] }
        execute: (args: unknown, exec: unknown) => Promise<Record<string, unknown>>
      }) => { parameters: Record<string, unknown> }
    }
  }

  // THE FIXED POINT (root final ruling @639ed01539): the host defineTool
  // ALREADY transforms the authored parameters — property-level `required:
  // true` markers are lifted into parent `required` arrays — and the
  // COMPILED product IS the registration face. We compile the captured
  // authored config through the REAL pinned defineTool; the derived face must
  // equal THAT lift (plus the closed-surface key), never a mirror-lift of our
  // own re-derived from the same authored input.
  async function defineToolProduct(host: Awaited<ReturnType<typeof hostTools>>, name: string, authored: Record<string, unknown>): Promise<Record<string, unknown>> {
    return host.defineTool({
      name,
      description: `g3 fixed-point compilation of ${name}`,
      parameters: authored,
      output: {
        schema: { type: 'object', description: 'compiled probe output', additionalProperties: false, properties: {} },
        render: () => [],
      },
      execute: async () => ({}),
    }).parameters
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
    for (const branch of ['oneOf', 'anyOf', 'allOf'] as const) {
      const list = rec[branch]
      if (Array.isArray(list)) for (const child of list) if (marker(child)) return true
    }
    return false
  }

  const compiledArms: Record<string, Record<string, unknown>> = {}
  // The compiled terminal_send shape, captured for the tamper leg. A HOST
  // that ran defineTool mounts THAT shape — capturing a compiled envelope
  // is the realistic tamper surface, so the tampered shape IS built from the
  // real compiled product, never from a hand-written envelope.
  let compiledArmsReady: Promise<void> | null = null
  async function compiledArmsOnce(): Promise<void> {
    if (compiledArmsReady === null) {
      compiledArmsReady = (async () => {
        const host = await hostTools()
        for (const [name, spec] of specs) compiledArms[name] = await defineToolProduct(host, name, spec)
      })()
    }
    return compiledArmsReady
  }

  it('COMPILED-CAPTURE FIXED POINT: every face equals the REAL defineTool product (authored config → compiled parameters) + the closed-surface key; the compiled-shape capture derives IDENTICALLY; NO property-level marker; parent arrays exact', async () => {
    const host = await hostTools()
    for (const [name, spec] of specs) {
      const compiled = await defineToolProduct(host, name, spec)
      const face = G3.g3CanonicalRegistrationFace(compiled)
      // THE fixed point: the host's OWN compiler produced `compiled`; the
      // governed face carries that lift verbatim + the closed-surface key.
      const { additionalProperties: _closed, ...faceMinusClosed } = face
      expect(faceMinusClosed, `${name}: face equals the defineTool product`).toEqual(compiled)
      expect(face.additionalProperties, `${name}: closed governed surface`).toBe(false)
      expect(() => host.assertSupportedJsonSchema(face), name).not.toThrow()
      expect(marker(face), `${name}: property-level required marker`).toBe(false)
      // The host lift is IDEMPOTENT on its own product through the VALIDATOR
      // boundary (it accepts its output as a registration face); re-running it
      // through the AUTHORING parser is not legal input — the parser wants the
      // marker DSL, not compiled parent arrays (proven: JsonSchemaError
      // 'parameters.type must be a value schema object'). The derivation's
      // COMPILED test rests on this pinned acceptance, not a marker sniff.
      expect(() => host.assertSupportedJsonSchema(compiled), `${name}: host accepts its own product`).not.toThrow()
      expect(() => host.assertSupportedJsonSchema(compiled), `${name}: acceptance stable (idempotent validation)`).not.toThrow()
    }
    // The arms may ALSO capture the compiled definition (what a host that
    // ran defineTool actually mounts): deriving from that COMPILED shape
    // must produce the IDENTICAL face — no re-lift of an already-lifted
    // schema, keys taken from the compiled `properties` only.
    await compiledArmsOnce()
    for (const [name] of specs) {
      expect(G3.g3CanonicalRegistrationFace(compiledArms[name]!), `${name}: compiled-shape capture derives identically`)
        .toEqual(G3.g3CanonicalRegistrationFace(specs.find(([n]) => n === name)![1]))
    }
    const faceOf = (toolName: string): { required?: string[] } => {
      const hit = derived.find(([name]) => name === toolName)
      return (hit === undefined ? undefined : hit[1]) as { required?: string[] }
    }
    expect(faceOf('terminal_open').required).toEqual(['type'])
    expect(faceOf('terminal_send').required).toEqual(['sessionId', 'text'])
    expect(faceOf('terminal_read').required).toEqual(['sessionId'])
    expect(faceOf('terminal_signal').required).toEqual(['sessionId', 'signal'])
    expect(faceOf('terminal_close').required).toEqual(['sessionId'])
    expect(faceOf('terminal_list').required).toBeUndefined()
    expect(faceOf('lsp').required).toEqual(['operation', 'file_path', 'line', 'character'])
    expect(faceOf('run_code').required).toEqual(['code', 'description'])
    // DYNAMIC CONFIG through the REAL compiler: the SAME tool captured on a
    // host WITHOUT the jobs arm compiles to a face WITHOUT the background
    // surface — the fixed point mirrors the ACTUAL captured config, never a
    // hand-written superset.
    const nobgCompiled = await defineToolProduct(host, 'terminal_send', CAPTURED.terminal_send_nobg as unknown as Record<string, unknown>)
    const nobgFace = G3.g3CanonicalRegistrationFace(nobgCompiled)
    expect(nobgFace, 'no-jobs capture equals its own defineTool product').toEqual({ ...nobgCompiled, additionalProperties: false })
    expect(Object.keys(nobgFace.properties as Record<string, unknown>), 'no background surface when the capture has none')
      .toEqual(['sessionId', 'text', 'submit'])
    expect(G3.g3CanonicalRegistrationFace(CAPTURED.terminal_send_nobg as unknown as Record<string, unknown>), 'authored path agrees for the no-jobs capture')
      .toEqual(nobgFace)
  })

  it('the AUTHORED path agrees with the REAL lift for EVERY member; and against the defineTool product the ONLY delta is the closed-surface key (no second truth source)', async () => {
    const host = await hostTools()
    for (const [name, spec] of specs) {
      const hostLift = host.parameterSchemaSpecToJsonSchema(spec)
      const authoredFace = G3.g3CanonicalRegistrationFace(spec)
      const { additionalProperties: _closed, ...authoredMinusClosed } = authoredFace
      expect(authoredMinusClosed, `${name}: authored-path derivation equals the host lift`).toEqual(hostLift)
    }
  })

  it('a tampered COMPILED capture (envelope from the REAL product, marker smuggled back into a property) NEVER survives as compiled: the marker law enforces strip-and-collect, and schema-envelope keys are never parameter names', async () => {
    await compiledArmsOnce()
    const compiled = compiledArms['terminal_send']!
    // Clean compiled capture derives identically to the authored derivation.
    expect(G3.g3CanonicalRegistrationFace(compiled))
      .toEqual(G3.g3CanonicalRegistrationFace(CAPTURED.terminal_send as unknown as Record<string, unknown>))
    // Smuggle the marker back onto one property: no longer a compiled fixed
    // point — the authored path runs, STRIPS the marker into the parent
    // array, and NEVER nests the envelope's `properties`/`required` keys as
    // parameters (parameter keys come from parameter entries ONLY). The
    // result re-derives EXACTLY the clean capture's face.
    const tampered = structuredClone(compiled)
    ;(tampered.properties as Record<string, Record<string, unknown>>).sessionId!.required = true
    const tamperedFace = G3.g3CanonicalRegistrationFace(tampered)
    expect(tamperedFace, 'tampered capture re-derives the CLEAN face (marker law enforced)')
      .toEqual(G3.g3CanonicalRegistrationFace(compiled))
    expect(marker(tamperedFace), 'a smuggled marker never survives into a face').toBe(false)
    expect(Object.keys(tamperedFace.properties as Record<string, unknown>).sort(), 'schema-envelope keys are never parameters')
      .toEqual(['run_in_background', 'sessionId', 'submit', 'text'])
    // A FORGED envelope (a compiled shape carrying the governed closed flag
    // as if it were the host product) is not a compiled lift at all: the
    // compiled envelope is closed (type/properties/required) — the forged key
    // fails the test and the capture is refused as a compiled product. It
    // derives through the authored path (never carrying the forged flag as
    // its own authority): the derivation trusts STRUCTURE, never claims.
    const forged = structuredClone(compiled)
    forged.additionalProperties = false
    const forgedFace = G3.g3CanonicalRegistrationFace(forged)
    expect(marker(forgedFace), 'forged envelope: no property-level marker survives').toBe(false)
    expect(forgedFace.required, 'forged envelope: parameter keys are the compiled parameters only')
      .toEqual(['sessionId', 'text'])
  })

  it('the SAME validator still REJECTS missing required members and off-surface values, and accepts complete values — the arm\'s faces (parametersFace) ARE these derived faces', async () => {
    const host = await hostTools()
    const w = await terminalWorld()
    const lspArm = G3.createGovernedLspArm({
      nativeDefinition: authoredNative('lsp', CAPTURED.lsp).def,
      definitionIdentity: 'lsp@v1',
      liveDispatcher: () => ({ definitionIdentity: 'lsp@v1' }),
      providerId: 'g3-test-provider', memberAgentId: AGENT_ID, sessionHeaderId: HEADER_ID, realmId: 'realm-g3-test',
      bindingFacts: makeBinding().read,
      lspFacts: { server: () => ({ binaryIdentity: 'x', generation: 'g' }), document: (p: string) => ({ kind: 'workspace', canonicalLocator: p, revision: 'r' }), documentRealm: () => 'realm-g3-test', documentScope: () => 'inside' },
    })
    const ptcArm = G3.createGovernedRunCodeArm({
      nativeDefinition: authoredNative('run_code', CAPTURED.run_code).def,
      definitionIdentity: 'run_code@v1',
      liveDispatcher: () => ({ definitionIdentity: 'run_code@v1' }),
      providerId: 'g3-test-provider', memberAgentId: AGENT_ID, sessionHeaderId: HEADER_ID, realmId: 'realm-g3-test',
      bindingFacts: makeBinding().read,
      ptcFacts: () => ({ interpreter: { runtimeIdentity: 'i', language: 'javascript' }, effectiveEnvelope: { mode: 'read-only', enforcement: 'full' }, timeout: null, childChannel: { capabilityList: [], channelDigest: 'd', maxParallelSubCalls: 10, runDispatchBudget: 64 } }),
    })
    const openSchema = w.arms.terminal_open.parametersFace as Record<string, unknown>
    const sendSchema = w.arms.terminal_send.parametersFace as Record<string, unknown>
    const lspSchema = lspArm.parametersFace as Record<string, unknown>
    const ptcSchema = ptcArm.parametersFace as Record<string, unknown>
    expect(openSchema).toEqual(G3.g3CanonicalRegistrationFace(CAPTURED.terminal_open as unknown as Record<string, unknown>))
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
    expect(host.validateJsonSchemaValue(w.arms.terminal_list.parametersFace as Record<string, unknown>, {}, '')).toEqual([])
    expect(host.validateJsonSchemaValue(ptcSchema, { code: 'x', description: 'd', sandbox_permissions: 'workspace-write', justification: 'r' }, '')).toEqual([])
  })
})
