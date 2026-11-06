/**
 * a5sf-sub-devlive-realm-row.mjs — the BOOT COMPOSITION half of the Subprocess
 * face's DEV-LIVE measurement (recordClass DEV-LIVE; no candidate claim).
 *
 * DERIVED FROM `evidence/a5sf-fs-devlive/driver/a5sf-fs-devlive-realm-row.mjs`
 * (the accepted FS/Search dev-live composition) with the FS binding realm and
 * the search counters REMOVED, and exactly three things added:
 *
 *   1. a per-TEMPLATE network axis: the `denyTemplateId` Member's compiled
 *      policy carries `network: { access: 'deny' }`, every other Member
 *      `network: { access: 'allow' }`. That is how one Host start measures a
 *      deny lane AND its positive control without a second boot.
 *   2. a `shell` counter: the shipped `ctx.shell` executor (the product's own
 *      `@deepseek-ai/dsh-bash-sandbox` / `dsh-bash-local` family) is wrapped
 *      ONCE so every execution records its executor class name, command and
 *      workdir. This is what answers "which executor did a Member's `bash`
 *      reach" with a live record instead of a source reading.
 *   3. a provider-capability echo: the real provider's `probe()` is recorded
 *      (leg `network-probe`) on first use, because the deny refusal's reason is
 *      the provider's own capability row and must be visible in the artefact.
 *
 * WHAT IS PRODUCT AND WHAT IS FIXTURE (stated so this cannot be read as more):
 *   - the CEILING lane (read/write roots) and the network axis are COMPOSITION
 *     INPUTS authored here (fixtures);
 *   - the confined `subprocess` face, the guard/algebra, the OS profile, the
 *     Landlock launcher pin and the realm installer are the SHIPPED ones;
 *   - the raw OS provider is P1-07's, created here because this composition
 *     owns the launcher pin (the realm must not guess an assembly);
 *   - the counters are test instrumentation (the shipped provider has none).
 *
 * @module dev/agent-workflow/evidence/a5sf-sub-devlive/driver/a5sf-sub-devlive-realm-row
 */
import { createHash } from 'node:crypto'
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const name = 'a5sf-sub-devlive-realm'
/** `ctx.provide` needs no injection; the counters inject their own (`subprocess`,
 *  `shell`). */
export const inject = []

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..', '..', '..')
const DIST = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime')

const providerModule = await import(pathToFileURL(join(DIST, 'sandbox-provider', 'provider.js')).href)

const LAUNCHER = join(REPO_ROOT, 'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')

const SUB_COUNTER_MARK = Symbol.for('a5sf.sub-devlive.base-subprocess-counter')
const SHELL_COUNTER_MARK = Symbol.for('a5sf.sub-devlive.shell-counter')

// ─────────────────────────────────────────────────────────────────────────────
// counters (test instrumentation — they decide nothing)
// ─────────────────────────────────────────────────────────────────────────────

function recorder(ledgerPath) {
  return (row) => {
    try {
      mkdirSync(dirname(ledgerPath), { recursive: true })
      appendFileSync(ledgerPath, JSON.stringify({ at: new Date().toISOString(), ...row }) + '\n')
    } catch {
      /* instrumentation is best-effort: never break a host call */
    }
  }
}

/**
 * Wrap the BASE `subprocess` service's `spawn` — the inherited, deployment-wide
 * service. A `base-spawn` record is the live proof that a call executed on the
 * host service (the unconfined comparison path), because the confined face
 * overrides `spawn` on its own class and never reaches this prototype.
 */
function installBaseSubprocessCounter(subCtx, ledgerPath) {
  const base = subCtx.get('subprocess')
  if (base === undefined || base === null) return
  const ctor = Object.getPrototypeOf(base)?.constructor
  if (typeof ctor !== 'function') return
  const proto = ctor.prototype
  const record = recorder(ledgerPath)
  if (proto[SUB_COUNTER_MARK] === true) return
  const original = proto.spawn
  if (typeof original !== 'function') return
  Object.defineProperty(proto, 'spawn', {
    configurable: true,
    writable: true,
    value: function instrumentedBaseSpawn(spec) {
      let argv = []
      try { argv = Array.isArray(spec?.argv) ? spec.argv.map((a) => String(a)) : [] } catch { argv = [] }
      record({ leg: 'base-spawn', argv, cwd: String(spec?.cwd ?? ''), baseCtor: ctor.name })
      try {
        return original.call(this, spec)
      } catch (error) {
        record({
          leg: 'base-spawn-failed',
          argv,
          cwd: String(spec?.cwd ?? ''),
          cause: {
            name: typeof error?.name === 'string' ? error.name : typeof error,
            code: typeof error?.code === 'string' ? error.code : null,
            syscall: typeof error?.syscall === 'string' ? error.syscall : null,
            path: typeof error?.path === 'string' ? error.path : null,
            message: String(error?.message ?? error).slice(0, 500),
          },
        })
        throw error
      }
    },
  })
  Object.defineProperty(proto, SUB_COUNTER_MARK, { configurable: true, writable: true, value: true })
  record({ leg: 'base-subprocess-counter-installed', baseCtor: ctor.name, note: 'records only the inherited host service arm' })
}

/**
 * Wrap the SHIPPED shell executor's `execute` on its actual class prototype.
 * The product's `bash` tool calls `ctx.shell.execute(ctx.shell.resolve(...))`,
 * so this records the executor class, the command and the workdir of every
 * shell execution the Host serves — including one that never reaches the a5sf
 * confined face (that is the point).
 */
function installShellCounter(shellCtx, ledgerPath) {
  const shell = shellCtx.get('shell')
  if (shell === undefined || shell === null) return
  const ctor = shell.constructor
  if (typeof ctor !== 'function') return
  const proto = ctor.prototype
  const record = recorder(ledgerPath)
  record({
    leg: 'shell-service',
    executor: ctor.name,
    sandboxMode: (() => { try { return shell.sandboxMode ?? null } catch { return null } })(),
    note: 'the ctx.shell service the host composes; a bash tool call resolves THIS executor',
  })
  if (proto[SHELL_COUNTER_MARK] === true) return
  const original = proto.execute
  if (typeof original !== 'function') return
  Object.defineProperty(proto, 'execute', {
    configurable: true,
    writable: true,
    value: async function instrumentedShellExecute(spec) {
      let command = ''
      try { command = String(spec?.command ?? '') } catch { command = '' }
      let workdir = ''
      try { workdir = String(spec?.workdir ?? '') } catch { workdir = '' }
      let sandboxPolicy = null
      try {
        const policy = spec?.sandboxPolicy
        sandboxPolicy = policy === undefined || policy === null
          ? null
          : { mode: policy.mode ?? null, workspaceRoot: policy.workspaceRoot ?? null }
      } catch { sandboxPolicy = null }
      record({
        leg: 'shell-exec',
        executor: ctor.name,
        command: command.slice(0, 2000),
        workdir,
        sandboxPolicy,
        note: 'a real Product shell execution; the executor class is the one the host mounted as ctx.shell',
      })
      return await original.call(this, spec)
    },
  })
  Object.defineProperty(proto, SHELL_COUNTER_MARK, { configurable: true, writable: true, value: true })
}

/** Wrap P1-07's raw provider so the confined face's SPAWN, EXIT and the
 *  provider's own capability probe are visible as records. */
const STDERR_CAPTURE_BYTES = 8192

function countedProvider(inner, ledgerPath, realmTag) {
  const record = recorder(ledgerPath)
  let probeRecorded = false
  return {
    async spawnStreaming(request, streaming) {
      const argv = Array.isArray(request?.argv) ? request.argv.map((a) => String(a)) : []
      record({
        leg: 'provider-call',
        realm: realmTag,
        argv,
        cwd: String(request?.cwd ?? ''),
        networkProfile: request?.networkProfile ?? null,
        grantFingerprint: String(request?.grantFingerprint ?? ''),
      })
      const spawned = await inner.spawnStreaming(request, streaming)
      const stderrChunks = []
      let stderrBytes = 0
      const handleStderr = spawned?.value?.stderr ?? null
      if (handleStderr !== null && typeof handleStderr?.on === 'function') {
        handleStderr.on('data', (chunk) => {
          if (stderrBytes >= STDERR_CAPTURE_BYTES) return
          const buf = Buffer.from(chunk)
          stderrChunks.push(buf)
          stderrBytes += buf.length
        })
      }
      if (spawned !== null && spawned !== undefined && spawned.ok === true && spawned.value !== null && spawned.value !== undefined) {
        record({ leg: 'confined-spawn', realm: realmTag, argv, cwd: String(request?.cwd ?? '') })
        const exited = spawned.value.exited
        if (exited !== null && exited !== undefined && typeof exited.then === 'function') {
          exited.then((outcome) => {
            record({ leg: 'confined-exit', realm: realmTag, argv, code: outcome?.code ?? null, signal: outcome?.signal ?? null, pid: spawned.value?.pid ?? null, stderr: Buffer.concat(stderrChunks).toString('utf8').slice(0, STDERR_CAPTURE_BYTES), stderrBytes })
          }).catch(() => {
            record({ leg: 'confined-exit', realm: realmTag, argv, code: null, signal: 'exit-unavailable', stderr: Buffer.concat(stderrChunks).toString('utf8').slice(0, STDERR_CAPTURE_BYTES), stderrBytes })
          })
        }
      } else {
        record({ leg: 'confined-spawn-failed', realm: realmTag, argv, ok: spawned?.ok ?? null, code: spawned?.error?.code ?? null, message: String(spawned?.error?.message ?? '').slice(0, 500) })
      }
      return spawned
    },
    async probe() {
      const answer = await inner.probe()
      if (!probeRecorded) {
        probeRecorded = true
        let projection = answer
        try { projection = JSON.parse(JSON.stringify(answer)) } catch { projection = String(answer) }
        record({ leg: 'network-probe', realm: realmTag, answer: projection })
      }
      return answer
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// the row
// ─────────────────────────────────────────────────────────────────────────────

function lane(allow) {
  return Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })
}

export function apply(ctx, config) {
  const allowRoot = typeof config?.allowRoot === 'string' ? config.allowRoot.trim() : ''
  if (allowRoot === '') throw new TypeError('a5sf-sub-devlive-realm: config.allowRoot (the compiled lane root) is required')
  const counterPath = typeof config?.counterPath === 'string' ? config.counterPath.trim() : ''
  if (counterPath === '') throw new TypeError('a5sf-sub-devlive-realm: config.counterPath is required')
  const laneReportPath = typeof config?.laneReportPath === 'string' ? config.laneReportPath.trim() : ''
  const scratchRoot = typeof config?.scratchRoot === 'string' ? config.scratchRoot.trim() : ''
  if (scratchRoot === '') throw new TypeError('a5sf-sub-devlive-realm: config.scratchRoot is required (inside the World home)')
  const denyTemplateId = typeof config?.denyTemplateId === 'string' && config.denyTemplateId !== ''
    ? config.denyTemplateId
    : 'worker-deny'

  const readLane = lane([allowRoot])
  const writeLane = lane([allowRoot])

  const report = {
    schema: 'a5sf-sub-devlive/lane-report/1',
    at: new Date().toISOString(),
    computedBy: 'the shipped realm install; the lane INPUTS are composition fixtures',
    allowRoot,
    denyTemplateId,
    lanes: { read: readLane, write: writeLane },
    network: { [denyTemplateId]: 'deny', other: 'allow' },
    note: 'the read/write lane inputs are fixtures; the intersection, the confined face and the OS profile are the shipped ones. The network axis is fixed per Member TEMPLATE so one Host start carries a deny lane and its allow control.',
  }
  if (laneReportPath !== '') {
    mkdirSync(dirname(laneReportPath), { recursive: true })
    // no fs import needed: the row may be loaded before 'fs' exists
    appendFileSync(laneReportPath + '.jsonl', JSON.stringify(report) + '\n')
  }

  /** One raw OS provider per Member (the launcher pin belongs to this row). */
  const providers = new Map()
  const providerFor = (instanceId) => {
    const cached = providers.get(instanceId)
    if (cached !== undefined) return cached
    const raw = providerModule.createConfinedProcessProvider({
      realmId: `member:${instanceId}`,
      trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
      scratchRoot: join(scratchRoot, instanceId),
      assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
    })
    const counted = countedProvider(raw, counterPath, `member:${instanceId}`)
    providers.set(instanceId, counted)
    return counted
  }

  const provider = {
    compiledFor(member) {
      const instanceId = String(member?.instanceId ?? '')
      if (instanceId === '') return undefined
      const templateId = String(member?.templateId ?? 'worker')
      // The LEADER gets no a5sf realm: this lane measures the MEMBER face, and
      // an installed realm on the leader would make "which executor did the
      // leader reach" ambiguous. The leader's tools stay on the shipped root
      // services, which is exactly the population path this lane compares to.
      if (templateId === 'leader') return undefined
      const instanceGeneration = 1
      const revision = `a5sf-sub:${instanceId}:g${String(instanceGeneration)}`
      const networkAccess = templateId === denyTemplateId ? 'deny' : 'allow'
      const identity = Object.freeze({
        teamId: 'team-a5sf-sub',
        memberInstanceId: instanceId,
        templateId,
        instanceGeneration,
      })
      const policy = Object.freeze({
        memberIdentity: instanceId,
        templateId,
        instanceGeneration,
        revision,
        read: readLane,
        write: writeLane,
        network: Object.freeze({ access: networkAccess }),
      })
      const effective = Object.freeze({
        memberIdentity: instanceId,
        toolBindingIdentity: 'dsh.subprocess/exec',
        invocationId: `a5sf-sub:${instanceId}:exec`,
        policyRevision: revision,
        read: readLane,
        write: writeLane,
        network: Object.freeze({ access: networkAccess }),
      })
      return {
        members: [{ identity, policy: { ok: true, value: policy } }],
        subprocess: {
          effective,
          provider: providerFor(instanceId),
          realmId: `member:${instanceId}`,
          bindingId: 'dsh.subprocess/exec',
          memberScope: instanceId,
          // BL-17: the COMPOSITION's declared shell class. Without it the
          // confined face admits NO shell program (the BL-16 refusal) and this
          // lane would measure that refusal instead of the argv predicate.
          // `['bash']` is the one program the fixture probe drives; the Member
          // cannot widen it through argv/config/a tool call.
          shellClass: Object.freeze({ programs: Object.freeze(['bash']) }),
        },
      }
    },
  }
  ctx.provide('teamA5sfRealm', provider)

  ctx.inject(['subprocess'], (subCtx) => installBaseSubprocessCounter(subCtx, counterPath))
  ctx.inject(['shell'], (shellCtx) => installShellCounter(shellCtx, counterPath))
}
