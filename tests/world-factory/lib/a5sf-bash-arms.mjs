/**
 * a5sf-bash-arms.mjs — the host-free harness of the BL-17 (P2-04) backend
 * round: the confined `subprocess` face's SHELL-CLASS admission, its lane
 * consults, the network capability probe and the governed-realm PTY refusal.
 *
 * WHAT THIS IS. NOT a second policy compiler and NOT a second guard:
 *
 *   effective lane   the ONE compiler (`compileEffectiveIo`) over a member
 *                    ceiling and a tool restriction, exactly as P1-02 ships;
 *   kernel profile   the ONE compiler (`compileExecutionProfile`, P1-07) over
 *                    that effective lane — the arms read its REAL access bits
 *                    (the "effect" a write-only lane produces);
 *   lane decision    the face's own `evaluateLocatorAccess` + `TeamIoDenial` +
 *                    `observeGuard` chain (the same facts the `fs` face emits);
 *   spawn boundary   a FAKE provider that RECORDS every `SpawnRequest` and
 *                    COUNTS calls, so "refused before any process" is a
 *                    counter, not a claim. No process is ever created here (no
 *                    PTY, no shell run — that half needs a Host boot).
 *
 * Every loader is the repo's existing `.ts`-under-`node` hook
 * (`scripts/run-tests-hooks.mjs`), so no test-only loader is introduced.
 *
 * @module tests/world-factory/lib/a5sf-bash-arms
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** The Member identity every arm runs under (a trusted, complete identity). */
export const BASH_IDENTITY = Object.freeze({
  teamId: 'team-bl17-bash',
  memberInstanceId: 'member-bl17-bash',
  templateId: 'worker',
  instanceGeneration: 3,
})

const SEAM_CACHE = new Map()

/**
 * Load the REAL seams (and the Cordis pieces the composition arm needs).
 * Dynamic imports only: the `.ts` hook must be registered first.
 */
export async function loadBashSeams(repoRoot) {
  if (SEAM_CACHE.has(repoRoot)) return SEAM_CACHE.get(repoRoot)
  const promise = (async () => {
    register(pathToFileURL(join(repoRoot, 'scripts', 'run-tests-hooks.mjs')).href)
    const [policy, services, profile, mount, runtimeRequire] = await Promise.all([
      import(pathToFileURL(join(repoRoot, 'packages/runtime/member-io-policy/src/index.ts')).href),
      import(pathToFileURL(join(repoRoot, 'packages/runtime/team-services/src/index.ts')).href),
      import(pathToFileURL(join(repoRoot, 'packages/runtime/team-sandbox/src/profile.ts')).href),
      import(pathToFileURL(join(repoRoot, 'packages/runtime/team-services/src/mount.ts')).href),
      Promise.resolve(createRequire(join(repoRoot, 'packages/runtime/package.json'))),
    ])
    const [cordis, tools, systemPrompt, scope] = await Promise.all([
      import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href),
      import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href),
      import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href),
      import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-scope')).href),
    ])
    const seams = Object.freeze({
      compileMemberPolicy: policy.compileMemberPolicy,
      projectToolIoRestriction: policy.projectToolIoRestriction,
      compileEffectiveIo: policy.compileEffectiveIo,
      compileExecutionProfile: profile.compileExecutionProfile,
      compileExecutionProfileCodes: profile.PROFILE_REFUSAL_CODES,
      services,
      mountA5sfRealm: services.mountA5sfRealm,
      Context: cordis.Context,
      Service: cordis.Service,
      ToolRuntime: tools.default,
      SystemPrompt: systemPrompt.default,
      bindScopeParent: scope.bindScopeParent,
      createScope: scope.createScope,
    })
    return seams
  })()
  SEAM_CACHE.set(repoRoot, promise)
  return promise
}

/** One restricted lane (the shipped v4 shape: allow/ask/deny lists). */
export function lane(allow, deny = []) {
  return Object.freeze({
    mode: 'restricted',
    allow: Object.freeze([...allow]),
    ask: Object.freeze([]),
    deny: Object.freeze([...deny]),
  })
}

/** One Member ceiling under the fixed identity (network axis configurable). */
export function memberPolicy({ read, write, network = 'allow' }) {
  return Object.freeze({
    memberIdentity: BASH_IDENTITY.memberInstanceId,
    templateId: BASH_IDENTITY.templateId,
    instanceGeneration: BASH_IDENTITY.instanceGeneration,
    revision: 'rev-bl17-bash',
    read,
    write,
    network: Object.freeze({ access: network }),
  })
}

/**
 * The effective lane = ceiling ∩ tool restriction, produced by the ONE
 * compiler. `restriction` defaults to the ceiling itself (`all` is the
 * intersection unit, but a restricted ceiling is its own restriction here).
 */
export function effectiveOf(seams, { read, write, network = 'allow' }) {
  const compiled = seams.compileEffectiveIo(
    memberPolicy({ read, write, network }),
    { bindingIdentity: 'team/bash', read, write, network },
    {
      memberIdentity: BASH_IDENTITY.memberInstanceId,
      callId: 'call-bl17-bash',
      policyRevision: 'rev-bl17-bash',
      toolBindingIdentity: 'team/bash',
      approvedOnce: false,
    },
  )
  if (!compiled.ok) throw new Error(`compileEffectiveIo refused: ${JSON.stringify(compiled)}`)
  return compiled.value
}

/**
 * The FAKE spawn boundary. It records the exact `SpawnRequest` the face hands
 * the OS provider, so a refusal arm can assert `spawnCalls === 0` (no process
 * was even requested) and an admit arm can inspect `argv`, `allowPaths` and
 * `networkProfile`.
 *
 * `network` controls what the provider's OWN capability probe reports:
 *   'unsupported' (the default, and what THIS host's provider set reports)
 *   'enforced'    (a hypothetical backend; only the mutation control needs it)
 *   'absent'      (a provider with no probe at all)
 */
export function fakeProvider({ network = 'unsupported' } = {}) {
  const requests = []
  const provider = {
    requests,
    get spawnCalls() {
      return requests.length
    },
    async spawnStreaming(request) {
      requests.push(request)
      const { PassThrough } = await import('node:stream')
      const stdout = new PassThrough()
      const stderr = new PassThrough()
      const stdin = new PassThrough()
      stdout.end('')
      stderr.end('')
      return {
        ok: true,
        value: {
          pid: 4242,
          stdin,
          stdout,
          stderr,
          exited: Promise.resolve({ code: 0, signal: null }),
          terminate: async () => ({ ok: true, value: undefined }),
          payloadExit: Promise.resolve({ form: 'recorded', rc: 0, pid: 4242 }),
        },
      }
    },
  }
  if (network !== 'absent') {
    provider.probe = async () => ({
      ok: true,
      value: [{ dimension: 'network-destination', level: network, note: `fake provider probe: network-destination=${network}` }],
    })
  }
  return provider
}

/** A plain base (not a Cordis Service) so the class can be built in isolation. */
class BareSubprocess {
  constructor(ctx) {
    this.ctx = ctx
  }

  spawn() {
    throw new Error('BL17_TRIPWIRE: the bare base spawn must never run')
  }
}

/**
 * Build ONE confined subprocess face over the REAL module, with the fake
 * boundary and a fact sink.
 */
export function makeFace(seams, { effective, shellClass, provider, onFact }) {
  const facts = []
  const Confined = seams.services.createConfinedSubprocessClass(BareSubprocess, {
    effective,
    provider,
    onGuardConsult: (fact) => {
      facts.push(fact)
      if (onFact !== undefined) onFact(fact)
    },
    ...(shellClass === undefined ? {} : { shellClass }),
    realmId: 'realm-bl17-bash',
    memberScope: BASH_IDENTITY.memberInstanceId,
  })
  const face = new Confined({})
  return { face, facts }
}

/** The spawn spec shape the native seam uses (a `bash -c` invocation). */
export function shellSpec({ program = '/bin/bash', body = 'true', cwd, shell, stdio }) {
  return {
    argv: [program, '-c', body],
    cwd,
    stdio: stdio ?? {
      stdin: 'ignore',
      stdout: { maxBytes: 4096 },
      stderr: { maxBytes: 4096 },
    },
    graceMs: 1000,
    ...(shell === undefined ? {} : { shell }),
  }
}

/**
 * Run one spawn to its `done` settlement. A synchronous throw (the shape
 * refusals) and an async rejection (the admission refusals) are returned in
 * the same shape so the arms can assert on `code` either way.
 */
export async function runSpawn(face, spec) {
  let handle
  try {
    handle = face.spawn(spec)
  } catch (error) {
    return { spawned: false, error }
  }
  try {
    await handle.done
    return { spawned: true, error: null }
  } catch (error) {
    return { spawned: false, error }
  }
}

/** The typed refusal code of an error (never string-parsed from a message). */
export function refusalCode(error) {
  const code = error?.code
  return typeof code === 'string' ? code : null
}

/**
 * A witness over the REAL compiled kernel profile: "would the kernel grant
 * this access to this path?" It reads only `allowPaths`/`accessBits` (the
 * profile the provider receives), so it can catch a read the profile would
 * grant — the negative control the write-only arm needs.
 */
export function profileAccess(profile, target) {
  let merged = null
  for (const entry of profile.allowPaths) {
    const path = entry.path.replace(/\/+$/u, '')
    const inside = target === path || target.startsWith(`${path}/`)
    if (!inside) continue
    merged = { ...(merged ?? {}), ...entry.accessBits }
  }
  const granted = merged ?? {}
  return Object.freeze({
    matched: merged !== null,
    readFile: granted.readFile === true,
    readDir: granted.readDir === true,
    writeFile: granted.writeFile === true,
    makeReg: granted.makeReg === true,
    removeFile: granted.removeFile === true,
    execute: granted.execute === true,
  })
}

/** `true` when the kernel profile would serve a READ of `target`. */
export function profileWouldRead(profile, target) {
  const access = profileAccess(profile, target)
  return access.matched && (access.readFile || access.readDir)
}

/** `true` when the kernel profile would serve a WRITE of `target`. */
export function profileWouldWrite(profile, target) {
  const access = profileAccess(profile, target)
  return access.matched && (access.writeFile || access.makeReg || access.removeFile)
}

/**
 * A temp world with the three directories the arms need:
 *   inside/     read + write (the ordinary lane)
 *   writeOnly/   write but NOT read (只写不读)
 *   outside/     neither read nor write (the negative side)
 */
export function makeBashWorld(label) {
  const root = mkdtempSync(join(tmpdir(), `a5sf-bash-${label}-`))
  const inside = join(root, 'inside')
  const writeOnly = join(root, 'writeOnly')
  const outside = join(root, 'outside')
  for (const dir of [inside, writeOnly, outside]) mkdirSync(dir, { recursive: true })
  writeFileSync(join(inside, 'in-lane.txt'), 'IN-LANE-BASH-BYTES\n', 'utf8')
  writeFileSync(join(writeOnly, 'write-only.txt'), 'WRITE-ONLY-BASH-BYTES\n', 'utf8')
  writeFileSync(join(outside, 'secret.txt'), 'OUTSIDE-BASH-SECRET\n', 'utf8')
  return {
    root,
    inside,
    writeOnly,
    outside,
    cleanup() {
      rmSync(root, { recursive: true, force: true })
    },
  }
}

/** Snapshot a file's bytes + mode (the effect control for chmod/create). */
export function snapshotFile(path) {
  if (!existsSync(path)) return { exists: false }
  const stat = statSync(path)
  return {
    exists: true,
    mode: stat.mode & 0o777,
    bytes: readFileSync(path, 'utf8'),
  }
}

// ---------------------------------------------------------------------------
// The composition arm: a governed Member realm and a `terminals` consumer.
// ---------------------------------------------------------------------------

/** The base `fs` Provider a realm shadows (the install capability gate). */
export function makeBaseFsClass(Service) {
  return class BaseFs extends Service {
    constructor(ctx, config = {}) {
      super(ctx, 'fs')
      this.config = config
    }

    processPath(target) {
      return target.hostPath
    }

    contains(parent, child) {
      return String(this.processPath(child)).startsWith(String(this.processPath(parent)))
    }

    async resolve(path) {
      return { hostPath: path, displayPath: path }
    }

    async readText() {
      return ''
    }

    async streamText() {
      return (async function* stream() {
        yield ''
      })()
    }

    async readBytes() {
      return new Uint8Array()
    }

    async readByteRange() {
      return new Uint8Array()
    }

    async listDir() {
      return []
    }

    async stat() {
      return { type: 'file', size: 0, mtimeMs: 0, mode: 0o644 }
    }

    async lstat() {
      return this.stat()
    }

    async watch() {
      return async () => undefined
    }

    async writeText(target) {
      return { path: this.processPath(target), displayPath: this.processPath(target), version: 'v1' }
    }

    async editText(target) {
      return { path: this.processPath(target), displayPath: this.processPath(target), version: 'v2' }
    }
  }
}

/** The inherited legacy PTY service: consulting it is a FAILURE (a tripwire). */
export function makeLegacyTerminalsClass(Service) {
  return class BaseTerminals extends Service {
    static calls = 0

    constructor(ctx, config = {}) {
      super(ctx, 'terminals')
      this.config = config
    }

    async spawn() {
      BaseTerminals.calls += 1
      throw new Error('BL17_TRIPWIRE: the INHERITED legacy-generation terminals service spawned a PTY')
    }

    list() {
      BaseTerminals.calls += 1
      return []
    }

    read() {
      BaseTerminals.calls += 1
      throw new Error('BL17_TRIPWIRE: the INHERITED legacy-generation terminals service was read')
    }

    async kill() {
      BaseTerminals.calls += 1
      throw new Error('BL17_TRIPWIRE: the INHERITED legacy-generation terminals service was killed')
    }
  }
}

/**
 * Mount ONE governed Member realm (real `mountA5sfRealm` + real confined `fs`
 * shadow) on an in-process Cordis root. The caller then mounts a native module
 * through the realm's OWN `mountNativeToolModules` seam.
 */
export async function mountGovernedRealm(seams, { world, label, withSubprocessFace = false }) {
  const BaseFs = makeBaseFsClass(seams.Service)
  const BaseTerminals = makeLegacyTerminalsClass(seams.Service)
  const root = new seams.Context()
  await root.plugin(seams.SystemPrompt)
  await root.plugin(seams.ToolRuntime)
  await root.plugin(BaseFs, {})
  await root.plugin(BaseTerminals, {})
  const agentKey = { session: { header: {} } }
  const agent = seams.createScope(root, agentKey)
  const provider = fakeProvider()
  const effective = effectiveOf(seams, { read: lane([world.inside]), write: lane([world.inside]) })
  const realm = await seams.mountA5sfRealm({
    root: agent.ctx,
    members: [{
      identity: BASH_IDENTITY,
      policy: { ok: true, value: memberPolicy({ read: lane([world.inside]), write: lane([world.inside]) }) },
    }],
    providerClass: BaseFs,
    ...(withSubprocessFace
      ? { subprocess: { effective, provider, realmId: `realm-${label}` } }
      : {}),
    onGuardConsult: () => undefined,
  })
  return { root, agentKey, realm, provider, BaseTerminals }
}

/** A fake native module that declares what it injects (Cordis plugin shape). */
export function terminalsConsumerModule({ defer = false } = {}) {
  if (defer) {
    return {
      name: 'tool-bash-persistent-deferred',
      inject: ['tools'],
      apply(ctx) {
        ctx.inject(['terminals'], () => undefined)
      },
    }
  }
  return {
    name: 'tool-bash-persistent',
    inject: ['tools', 'terminals'],
    apply() {
      // A real module would register `bash` here; the refusal fires first.
    },
  }
}
