/**
 * a5sf-pty-contract-world.mjs — the host-free world for the Shell-PTY capability
 * face's LAYER B (native-tool contract) arms.
 *
 * THE FACE HAS **TWO** HALVES TODAY, and this world builds both, because the
 * contract differs between them:
 *
 *   1. THE PRODUCT'S POLICY-BOUND REGISTRY (`packages/runtime/team-sandbox/src/
 *      terminal.ts`, P1-08). A pure lifecycle state machine over an injected
 *      `PtyHandle` port: `acquire` → `assertCurrent` → `revoke`/`shutdown`.
 *      It owns IDENTITY (trusted member + policy revision) and the kill/reap
 *      accounting. It has **no I/O channel at all** — `PtyHandle` carries
 *      `pid`, `backend`, `descendants()` and `kill()` and nothing else, so
 *      "write"/"read"/"exit status" are not representable in it (a finding, see
 *      the evidence README). The arms drive the REAL product module through the
 *      repo's TS loader; the port is the seam the module itself injects.
 *
 *   2. THE PINNED HOST PTY SERVICE (`@deepseek-ai/dsh-terminal`,
 *      `packages/terminal/terminal/lib/index.js` at the pinned baseline) — the
 *      service a `terminals`-consuming native module resolves when no realm
 *      installs a confined terminal face. It owns the REAL per-session contract
 *      the registry does not: `spawn` → `startSend` (write) → `read` →
 *      `signal`/`kill` → `close`, with a per-session status that distinguishes
 *      exit code from signal. Its backend is the injected port
 *      (`registerBackend`), so an in-process world can pin the service's
 *      semantics without a real PTY: the SERVICE (ids, ownership, fencing,
 *      cleanup) is real, only the terminal mechanics behind the port are a
 *      recorder.
 *
 *   3. THE PRODUCT COMPOSITION REFUSAL. A native module that declares
 *      `inject: ['terminals']` is refused at composition time by
 *      `mountA5sfRealm(...).mountNativeToolModules` with
 *      `TERMINALS_LEGACY_PTY_REFUSED` — before any fiber, before the module's
 *      `apply`, and before any backend allocation. The refusal world mounts the
 *      REAL pinned `TerminalSessionService` with a counting backend and the REAL
 *      pinned `tool-bash-persistent` module, so "zero allocations" is a counter
 *      over a service that really could allocate.
 *
 * NO HOST BOOT, no port, no DSH_HOME, no `tests/homes/**`. No real PTY is
 * created: the OS-level PTY is NOT_REACHED here and the evidence README prints
 * the one-shot command a boot would run.
 *
 * HOST-REQUIRED (three states, same law as the FS/Subprocess faces): the four
 * pinned entries are `lib/` build outputs of the gitignored checkout.
 *   absent            => one `A5SF-PTY-CONTRACT-HOST-REFUSED` line, every case
 *                        registered as SKIPPED (`pass 0`);
 *   present, partial  => hard failure (a pin violation, not an absence);
 *   present, complete => every arm runs.
 * `A5SF_REQUIRE_PINNED_HOST=1` turns the refusal into a failure.
 *
 * @module tests/world-factory/lib/a5sf-pty-contract-world
 */

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { findTestRepoRoot, testUseTree } from '../../paths.mjs'

/** The Member identity every arm runs under. */
export const PTY_CONTRACT_IDENTITY = Object.freeze({
  teamId: 'team-a5sf-pty-contract',
  memberInstanceId: 'member-a5sf-pty-contract',
  templateId: 'worker',
  instanceGeneration: 1,
})

/** The refusal code the composition must produce (read from the module, not invented). */
export const LEGACY_PTY_REFUSAL = 'TERMINALS_LEGACY_PTY_REFUSED'

/** A second member, used by the concurrency arms to prove identity is per-member. */
export const SECOND_IDENTITY = Object.freeze({
  teamId: 'team-a5sf-pty-contract',
  memberInstanceId: 'member-a5sf-pty-contract-2',
  templateId: 'worker',
  instanceGeneration: 1,
})

const SEAM_CACHE = new Map()

/**
 * WHERE the pinned entries live and WHAT the arms consume. Exported so the
 * suite's host gate can distinguish an environment ABSENCE from a pin
 * VIOLATION (a partial/older checkout).
 */
export function ptyContractHostLayout(repoRoot) {
  const override = process.env.A5SF_PTY_CONTRACT_HOST_ROOT
  const root = override === undefined || override === '' ? testUseTree(findTestRepoRoot(repoRoot) ?? repoRoot) : override
  return {
    root,
    entries: {
      terminalService: join(root, 'packages', 'terminal', 'terminal', 'lib', 'index.js'),
      agentRegistry: join(root, 'packages', 'core', 'agent', 'lib', 'index.js'),
      session: join(root, 'packages', 'core', 'session', 'lib', 'index.js'),
      persistentBash: join(root, 'packages', 'shell', 'tool-bash-persistent', 'lib', 'index.js'),
    },
  }
}

const REGISTRY_CACHE = new Map()

/** Load the PRODUCT policy-bound lifecycle module (`terminal.ts`), cached per root. */
export function loadRegistryModule(repoRoot) {
  if (REGISTRY_CACHE.has(repoRoot)) return REGISTRY_CACHE.get(repoRoot)
  const promise = import(pathToFileURL(join(repoRoot, 'packages/runtime/team-sandbox/src/terminal.ts')).href)
  REGISTRY_CACHE.set(repoRoot, promise)
  return promise
}

/** Load the repo seams and the PINNED module entries. Cached per repo root. */
export function loadPtyContractSeams(repoRoot) {
  if (SEAM_CACHE.has(repoRoot)) return SEAM_CACHE.get(repoRoot)
  const promise = (async () => {
    register(pathToFileURL(join(repoRoot, 'scripts', 'run-tests-hooks.mjs')).href)
    const memberIoPolicy = await import(pathToFileURL(join(repoRoot, 'packages/runtime/member-io-policy/src/index.ts')).href)
    const services = await import(pathToFileURL(join(repoRoot, 'packages/runtime/team-services/src/index.ts')).href)
    const runtimeRequire = createRequire(join(repoRoot, 'packages/runtime/package.json'))
    const { Context, Service } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
    const ToolRuntime = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href)).default
    const SystemPrompt = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href)).default
    const { bindScopeParent, createScope } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-scope')).href)

    const layout = ptyContractHostLayout(repoRoot)
    for (const [name, entry] of Object.entries(layout.entries)) {
      if (!existsSync(entry)) {
        throw new Error(`the pinned baseline's ${name} entry is missing (${entry}); provision tests/deepseek-harness-test-use and build it`)
      }
    }
    // The pinned entries import their peers by package name; resolve from the
    // pinned terminal package so the pinned tree's own node_modules graph is used.
    const pinnedRequire = createRequire(join(layout.root, 'packages', 'terminal', 'terminal', 'package.json'))
    const resolve = (name) => pathToFileURL(pinnedRequire.resolve(name)).href
    const [terminalService, agentRegistry, session, persistentBash] = await Promise.all([
      import(pathToFileURL(layout.entries.terminalService).href),
      import(pathToFileURL(layout.entries.agentRegistry).href),
      import(pathToFileURL(layout.entries.session).href),
      import(pathToFileURL(layout.entries.persistentBash).href),
    ])
    return Object.freeze({
      memberIoPolicy,
      services,
      Context,
      Service,
      ToolRuntime,
      SystemPrompt,
      bindScopeParent,
      createScope,
      TerminalSessionService: terminalService.default,
      TerminalError: terminalService.TerminalError,
      TerminalSessionId: terminalService.TerminalSessionId,
      AgentRegistry: agentRegistry.default,
      Session: session.Session,
      SessionId: session.SessionId,
      persistentBash,
      pinnedRequire,
      resolve,
      hostRoot: layout.root,
    })
  })()
  SEAM_CACHE.set(repoRoot, promise)
  return promise
}

// ---------------------------------------------------------------------------
// The PORT RECORDER for the product registry (`PtyHandle`).
// ---------------------------------------------------------------------------

let PORT_PID = 4000

/**
 * One recorded `PtyHandle`. `killBehaviour` is how the REAL process would
 * answer the port's `kill`:
 *   'resolve'      — the kill is delivered, the process dies;
 *   'exited'       — the process had ALREADY exited non-zero (a real PTY's
 *                    kill then rejects: there is no process to signal);
 *   'group-gone'   — the process group is already gone (ESRCH: the child was
 *                    reaped by init/an OOM killer/last-resort path).
 */
export function recordedPort({ binding, backend = 'pty', killBehaviour = 'resolve', label = binding } = {}) {
  const pid = (PORT_PID += 7)
  const record = {
    label,
    binding,
    backend,
    pid,
    alive: true,
    kills: [],
    killErrors: [],
    killBehaviour,
    descendantsBefore: Object.freeze([pid + 1, pid + 2]),
    descendantsAfter: Object.freeze([]),
  }
  const handle = {
    pid,
    backend,
    descendants: () => (record.alive ? record.descendantsBefore : record.descendantsAfter),
    async kill(signal = 'SIGTERM') {
      record.kills.push(signal)
      if (record.killBehaviour === 'exited') {
        record.alive = false
        record.killErrors.push('TERMINAL_EXITED')
        throw Object.assign(new Error('terminal process already exited with code 7'), { code: 'TERMINAL_EXITED' })
      }
      if (record.killBehaviour === 'group-gone') {
        record.alive = false
        record.killErrors.push('ESRCH')
        throw Object.assign(new Error('terminal process group is gone'), { code: 'ESRCH' })
      }
      record.alive = false
    },
  }
  return { record, handle }
}

/**
 * The registry harness: the REAL product `createTerminalDomainRegistry` (the
 * module under test) over recorded ports. `setRevision` changes the CURRENT
 * revision the policy lane reports — the only widening/tightening input.
 */
export async function makeRegistryHarness({ repoRoot, trusted = () => true } = {}) {
  const seams = await loadPtyContractSeams(repoRoot)
  // The product lifecycle module is loaded LAZILY and separately: the pinned
  // host-service arms and the composition-refusal arms do not read it, so a tree
  // without it reds exactly the arms that claim its contract (the RED baseline's
  // whole point — see `red-first-run.log`).
  const terminal = await loadRegistryModule(repoRoot)
  let revision = 'rev-1'
  const records = []
  const log = []
  const registry = terminal.createTerminalDomainRegistry({
    currentRevision: () => revision,
    now: () => '2026-11-07T00:00:00.000Z',
    isTrustedMember: trusted,
  })

  const acquire = (binding, options = {}) => {
    const identity = options.identity ?? PTY_CONTRACT_IDENTITY
    const { record, handle } = recordedPort({
      binding,
      backend: options.backend ?? 'pty',
      killBehaviour: options.killBehaviour ?? 'resolve',
      label: options.label ?? binding,
    })
    records.push(record)
    const spec = {
      owner: { identity, toolBindingIdentity: binding },
      sessionHandle: options.sessionHandle ?? `session-${binding}`,
      policyRevision: options.policyRevision ?? revision,
      backend: options.backend ?? 'pty',
      spawn: async () => {
        log.push(['allocate', record.label])
        return handle
      },
    }
    return registry.acquire(spec).then((result) => {
      log.push(['acquire', record.label, result.ok ? 'ok' : result.code])
      return { result, record, handle }
    })
  }

  return {
    seams,
    terminal,
    registry,
    records,
    log,
    acquire,
    setRevision(value) { revision = value },
    currentRevision: () => revision,
    recordFor(label) {
      const found = records.filter((candidate) => candidate.label === label)
      assert.equal(found.length, 1, `expected exactly one recorded port labelled '${label}', got ${found.length}`)
      return found[0]
    },
    allocations: () => log.filter((entry) => entry[0] === 'allocate').length,
    killLog: () => records.flatMap((record) => record.kills.map((signal) => [record.label, signal])),
    async dispose() { await registry.shutdown() },
  }
}

// ---------------------------------------------------------------------------
// The PORT RECORDER for the pinned HOST terminal service (`TerminalBackend`).
// ---------------------------------------------------------------------------

/** The switches the instrument-sensitivity controls flip (see mutations.mjs). */
export const HOST_CONTROLS = Object.freeze([
  'host-close-noop',
  'host-close-twice',
  'host-collapse-exit',
  'host-cross-writes',
])

function hostControl() {
  const value = process.env.A5SF_PTY_CONTRACT_CONTROL ?? ''
  return value === '' ? null : value
}

/**
 * The recorded backend the REAL pinned `TerminalSessionService` is driven with.
 * The service is real (ids, ownership fencing, cleanup); only the PTY mechanics
 * behind the injected port are recorded. `scenario` picks what the (simulated)
 * process reports: a non-zero exit, a signal death, or a transport error.
 */
export function recordingBackend({ type = 'pty-recording', scenarios = [] } = {}) {
  const control = hostControl()
  const log = []
  const sessions = []
  let spawned = 0
  let cursor = 0

  const provider = {
    type,
    async spawn(spec) {
      spawned += 1
      const scenario = scenarios[cursor] ?? 'running'
      cursor += 1
      const sessionId = spec.sessionId
      log.push(['spawn', sessionId, scenario])
      let closed = 0
      const state = {
        sessionId,
        scenario,
        pid: 900 + spawned,
        sends: [],
        reads: [],
        signals: [],
        closed: 0,
      }
      sessions.push(state)

      const statusOf = () => {
        if (control === 'host-collapse-exit') return { kind: 'exited', exitCode: 0, signal: null }
        if (scenario === 'exit-7') return { kind: 'exited', exitCode: 7, signal: null }
        if (scenario === 'killed') return { kind: 'exited', exitCode: null, signal: 'SIGTERM' }
        return { kind: 'running' }
      }

      const session = {
        get motd() { return 'pty-recording ready' },
        get pid() { return state.pid },
        startSend(request) {
          // `host-cross-writes`: the instrument attributes the write to the OTHER
          // session, which is how a crossed write would be observed downstream.
          const sendTarget = control === 'host-cross-writes'
            ? (sessions.find((candidate) => candidate !== state) ?? state)
            : state
          sendTarget.sends.push(request.text)
          if (scenario === 'transport-error') {
            return {
              done: Promise.reject(Object.assign(new Error('PTY transport write failed'), { code: 'EIO' })),
              readOutput: () => ({ delta: '', truncated: false }),
              cancel: () => false,
            }
          }
          const reported = statusOf()
          return {
            done: Promise.resolve({ viewport: `viewport:${request.text}`, waitReason: reported.kind === 'exited' ? 'session_exit' : 'inferred_idle', sessionStatus: reported, truncated: false }),
            readOutput: () => ({ delta: `delta:${request.text}`, truncated: false }),
            cancel: () => true,
          }
        },
        read(request) {
          state.reads.push(request)
          // `host-cross-writes`: the instrument attributes the read to the OTHER
          // session, which is how a crossed write would be observed downstream.
          const other = sessions.find((candidate) => candidate !== state)
          const attributed = control === 'host-cross-writes' && other !== undefined ? other.sessionId : sessionId
          return { text: `scrollback:${attributed}`, totalLines: 1, lineBegin: 0, lineEnd: 1, truncated: false }
        },
        async signal(signal) {
          state.signals.push(signal)
          return { delivered: true, targetPgid: state.pid + 1 }
        },
        status: statusOf,
        async close(reason) {
          closed += 1
          state.closed = closed
          log.push(['close', sessionId, reason])
          if (control === 'host-close-twice') {
            // The double-close defect: the port is closed once but reported twice.
            state.closed = closed + 1
          }
          if (control === 'host-close-noop') return
          state.status = { kind: 'exited', exitCode: 0, signal: null }
        },
      }
      return session
    },
  }

  return {
    provider,
    log,
    sessions,
    control,
    spawned: () => spawned,
    stateOf(sessionId) {
      const found = sessions.find((candidate) => candidate.sessionId === sessionId)
      assert.ok(found !== undefined, `no recorded backend session '${sessionId}'`)
      return found
    },
    sendsFor(sessionId) { return this.stateOf(sessionId).sends.slice() },
    closesFor(sessionId) { return this.stateOf(sessionId).closed },
  }
}

/** A real Agent object (the pinned shape) rooted at a real Cordis scope. */
export function stubAgent(seams, parentCtx, rawId) {
  const id = seams.SessionId(rawId)
  const scopeFiber = parentCtx.plugin(() => undefined)
  const session = seams.Session.create(id)
  const agent = {
    id,
    options: {},
    session,
    inbox: { push() {}, close() {} },
    status: 'idle',
    ctx: scopeFiber.ctx,
    send() {},
    followup() {},
    steer: () => ({ outcome: Promise.resolve({ status: 'rejected' }) }),
    inject() {},
    cancel() {},
    runMaintenance: (task) => task(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
  return agent
}

/**
 * The HOST-SERVICE harness: the REAL pinned `TerminalSessionService` and the
 * REAL pinned `AgentRegistry`, over the recorded backend port.
 */
export async function makeHostTerminalWorld({ repoRoot, label = 'host', scenarios = [] } = {}) {
  const seams = await loadPtyContractSeams(repoRoot)
  const root = new seams.Context()
  await root.plugin(seams.AgentRegistry)
  const serviceFiber = await root.plugin(seams.TerminalSessionService)
  const backend = recordingBackend({ scenarios })
  const unregister = root.terminals.registerBackend(backend.provider)
  const owner = stubAgent(seams, root, `pty-owner-${label}`)
  const foreign = stubAgent(seams, root, `pty-foreign-${label}`)
  await root.agents.register(owner)
  await root.agents.register(foreign)
  return {
    seams,
    root,
    label,
    terminals: root.terminals,
    backend,
    owner,
    foreign,
    async dispose() {
      unregister()
      await serviceFiber.dispose()
      await root.dispose?.()
    },
  }
}

// ---------------------------------------------------------------------------
// The COMPOSITION-REFUSAL world (product route).
// ---------------------------------------------------------------------------

/** The base `fs` Provider the realm needs (the PTY arms never touch it). */
export function baseFsClass(Service) {
  return class BaseFs extends Service {
    constructor(ctx, config = {}) {
      super(ctx, 'fs')
      this.config = config
    }

    processPath(target) { return target.hostPath ?? target }
    contains(parent, child) { return String(this.processPath(child)).startsWith(String(this.processPath(parent))) }
    async resolve(path) { return { hostPath: path, displayPath: path } }
    async readText() { return '' }
    async streamText() { return (async function* stream() {})() }
    async readBytes() { return new Uint8Array() }
    async readByteRange() { return new Uint8Array() }
    async listDir() { return [] }
    async stat() { return { type: 'file', size: 0, mtimeMs: 0, mode: 0o644 } }
    async lstat() { return this.stat() }
    async watch() { return async () => undefined }
    async writeText() { return { version: 'v1' } }
    async editText() { return { version: 'v2' } }
  }
}

/** The Member ceiling under the fixed identity (the realm needs a compiled policy). */
export function memberCeiling({ identity = PTY_CONTRACT_IDENTITY, revision = 'rev-a5sf-pty-contract' } = {}) {
  return Object.freeze({
    memberIdentity: identity.memberInstanceId,
    templateId: identity.templateId,
    instanceGeneration: identity.instanceGeneration,
    revision,
    read: Object.freeze({ mode: 'restricted', allow: Object.freeze([]), ask: Object.freeze([]), deny: Object.freeze([]) }),
    write: Object.freeze({ mode: 'restricted', allow: Object.freeze([]), ask: Object.freeze([]), deny: Object.freeze([]) }),
    network: Object.freeze({ access: 'deny' }),
  })
}

/**
 * Build the composition world: a real in-process Cordis root carrying
 *   - the REAL pinned `TerminalSessionService` with a recorded backend,
 *   - the REAL pinned `AgentRegistry` + one live owner,
 *   - the PRODUCT `mountA5sfRealm` Member realm (no `terminals` face exists to
 *     mount — that absence is the precondition the refusal arm pins).
 * The caller then drives `realm.mountNativeToolModules`.
 */
export async function makeRefusalWorld({ repoRoot, label = 'refusal', scenarios = [] } = {}) {
  const seams = await loadPtyContractSeams(repoRoot)
  const dir = mkdtempSync(join(tmpdir(), `a5sf-pty-contract-${label}-`))
  const inside = join(dir, 'inside')
  mkdirSync(inside, { recursive: true })

  const BaseFs = baseFsClass(seams.Service)
  const root = new seams.Context()
  await root.plugin(seams.SystemPrompt)
  await root.plugin(seams.ToolRuntime)
  await root.plugin(BaseFs, {})
  await root.plugin(seams.AgentRegistry)
  const terminalsFiber = await root.plugin(seams.TerminalSessionService)
  const backend = recordingBackend({ type: 'pty-counting', scenarios })
  const unregister = root.terminals.registerBackend(backend.provider)
  const owner = stubAgent(seams, root, `pty-refusal-owner-${label}`)
  await root.agents.register(owner)

  const agentKey = { session: { header: {} } }
  const agent = seams.createScope(root, agentKey)
  const facts = []
  const realm = await seams.services.mountA5sfRealm({
    root: agent.ctx,
    members: [{ identity: PTY_CONTRACT_IDENTITY, policy: { ok: true, value: memberCeiling() } }],
    providerClass: BaseFs,
    onGuardConsult: (fact) => facts.push(fact),
  })
  const member = realm.installation.members[0]
  assert.ok(member !== undefined, 'the product realm mounted no Member')

  return {
    seams,
    dir,
    inside,
    root,
    agentKey,
    realm,
    member,
    memberCtx: member.ctx,
    terminals: root.terminals,
    backend,
    owner,
    facts,
    /** The inherited host service the member scope resolves (the widening precondition). */
    inheritedTerminals: member.ctx.get('terminals'),
    async dispose() {
      await realm.dispose()
      unregister()
      await terminalsFiber.dispose()
      await root.dispose?.()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

/** The REAL pinned persistent-bash native module, wrapped to record `apply`. */
export function persistentBashModule(seams) {
  const applied = []
  const module = {
    name: seams.persistentBash.name,
    inject: seams.persistentBash.inject,
    Config: seams.persistentBash.Config,
    apply(ctx, config) {
      applied.push('apply')
      return seams.persistentBash.apply(ctx, config)
    },
  }
  return { module, applied }
}

/**
 * A synthetic native module shaped exactly like a Cordis plugin object.
 * `greedy` makes its `apply` allocate a PTY through the resolved `terminals`
 * service — so "the refusal happened BEFORE the allocation" is measurable: if
 * the composition mounted the module first, this allocation would run.
 */
export function terminalsConsumerModule({ name = 'pty-greedy-consumer', defer = false, greedy = false, owner } = {}) {
  const applied = []
  const allocations = []
  const state = { applied, allocations }
  const run = (ctx) => {
    applied.push('apply')
    if (!greedy) return
    allocations.push('attempt')
    // The REAL pinned service is resolvable here when no confined terminal face
    // is installed; a greedy module would open the legacy shell exactly like this.
    ctx.terminals
      .spawn(owner, { type: 'pty-counting' })
      .then((result) => allocations.push(`allocated:${result.sessionId}`), (error) => allocations.push(`failed:${error?.code ?? 'unknown'}`))
  }
  const module = defer
    ? {
        name,
        inject: ['tools'],
        apply(ctx) {
          ctx.inject(['terminals'], (injected) => run(injected))
        },
      }
    : {
        name,
        inject: ['tools', 'terminals'],
        apply: run,
      }
  return { module, state }
}

/** A module that consumes NO PTY service (the targeted-refusal control). */
export function inertModule({ name = 'pty-inert-consumer' } = {}) {
  const applied = []
  return {
    module: {
      name,
      inject: ['tools'],
      apply() { applied.push('apply') },
    },
    applied,
  }
}
