/**
 * a5w5-fixtures.mjs — W5 wiring LIVE builders (Alpha.5 wiring phase, lane W5).
 *
 * Plain-ESM port of the PR3 live-round fixture pattern (`../live/a5live-fixtures.mjs`)
 * extended to the PR5 TOOLS lane: every grant, ref, effect set and binding is
 * built through the frozen PR0/PR2 parsers, and every Search/Shell judgement
 * runs through the COMPILED a5p5 lane (`pipeline.runToolCall`, `args`,
 * `effects-schema`, `spill`, `render`) — the row re-implements NO law, it only
 * composes faces (IF-1: plugin row + public seams + dist/lane barrels).
 *
 * MODULE-GRAPH FACT (disclosed): the row uses ONE copy of the lane graph —
 * the `tests/homes/.a5w5-build` compile of THIS worktree's sources (tsc CLI
 * only, IF-5 zero-touch). The PR1/PR2/PR3 artifacts (`tool-admission`,
 * `tool-dispatch/install`, `controlled-fs`) come from the committed
 * `packages/runtime/dist` — the same artifacts the PR3 live round mounted.
 *
 * FIXTURE-GRADE disclosure (identical to the PR3 round): the kernel's trusted
 * inputs (clock, generations, documents, policy, ledger, assurance probe) are
 * exactly what the lane suites feed it, and the parameters fingerprint is the
 * assembly-declared canonical digest (law-2 binds what the assembly declares
 * for this call). Nothing here claims ENFORCE level.
 *
 * @module dev/agent-workflow/evidence/alpha5/wiring/w5/a5w5-fixtures
 */
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Load lane (single graph) + runtime-dist lanes from absolute dirs. */
export async function loadA5W5Lanes({ laneBuild, distPackages }) {
  const laneUrl = (p) => new URL(`file://${join(laneBuild, 'packages/tools/a5p5-tools/src', p)}`).href
  const domUrl = (p) => new URL(`file://${join(laneBuild, 'packages/domain/tool-governance/src', p)}`).href
  const distUrl = (p) => new URL(`file://${join(distPackages, p)}`).href
  const [a5, spill, tg, ta, td, cf] = await Promise.all([
    import(laneUrl('index.js')),
    import(laneUrl('spill.js')),
    import(domUrl('index.js')),
    import(distUrl('runtime/tool-admission/index.js')),
    import(distUrl('runtime/tool-dispatch/install.js')),
    import(distUrl('runtime/controlled-fs/src/index.js')),
  ])
  return { a5, spill, tg, ta, td, cf }
}

export const REALM = 'a5w5-realm'
export const MEM = Object.freeze({ teamSessionId: 'a5w5-ts', instanceId: 'a5w5-member' })
export const FIXED_NOW = 1_737_000_000_000

export const sha256 = (text) => `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`

/** Assembly-declared canonical parameters digest for one call (fixture grade). */
export function canonicalParamsFingerprint(params) {
  const keys = Object.keys(params).sort()
  const canon = `{${keys.map((k) => `${JSON.stringify(k)}:${JSON.stringify(params[k])}`).join(',')}}`
  return sha256(canon)
}

// ── world (TEST_METHODS §7 naming is the RUNNER's job; this builds inside it) ──

/**
 * World layout:
 *   <worldRoot>/repo/            the fixture repo the policy COVERS
 *   <worldRoot>/spill/           the spill root (STRICT descendant, law 1)
 *   <outside>/                   a directory NO policy covers (over-privilege target)
 */
export function buildW5World(worldRoot, outsideDir, token) {
  mkdirSync(join(worldRoot, 'repo'), { recursive: true })
  mkdirSync(join(worldRoot, 'spill'), { recursive: true })
  mkdirSync(outsideDir, { recursive: true })
  writeFileSync(join(worldRoot, 'repo', 'a.txt'), `alpha line\nsecond ${token} line\nthird line\n`)
  writeFileSync(join(worldRoot, 'repo', 'b.txt'), `no match here\nanother ${token} tail\n`)
  writeFileSync(join(outsideDir, 'secret.txt'), `OUTSIDE-${token}\n`)
  return { repo: join(worldRoot, 'repo'), spillRoot: join(worldRoot, 'spill'), outside: outsideDir, token }
}

// ── PR2 fixture builders (port of a5live-fixtures, extended to tool-invoke) ──

export function fileRef(tg, kind, canonicalLocator, rights) {
  const parsed = tg.parseResourceRef({ realmId: REALM, kind, canonicalLocator, rights })
  if (!parsed.ok) throw new Error(`a5w5 fixture ref rejected: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

export function effects(tg, raw) {
  const parsed = tg.parseRequestedEffectSet(raw)
  if (!parsed.ok) throw new Error(`a5w5 fixture effect set rejected: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

/**
 * Policy scope key. Port of `a5p2-fixtures.ts:145`: a tool-invoke effect (no
 * resource) keys as `<realm>|tool:<name>`; every resource effect keys as
 * `<realm>|<canonicalLocator>`.
 */
function scopeKey(effect) {
  const realm = effect.resource === null ? REALM : effect.resource.realmId
  if (effect.kind === 'tool-invoke') return `${realm}|tool:${effect.toolName}`
  return `${realm}|${effect.resource.canonicalLocator}`
}

/** allow-list document over EXPLICIT arms (kind + realm + locator|tool name). */
export function allowPolicy(tg, arms) {
  const parsed = tg.parseToolPolicyDocument({
    rules: arms.map((arm) => ({
      realmId: REALM,
      effectKind: arm.kind,
      matcher: { kind: 'exact', resource: arm.kind === 'tool-invoke' ? `${REALM}|tool:${arm.toolName}` : `${REALM}|${arm.locator}` },
      maximumEffect: 'allow',
    })),
  })
  if (!parsed.ok) throw new Error(`a5w5 fixture policy rejected: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

export function emptyHardDocs() {
  return { teamHardEnvelope: { rules: [] }, permissionMutationEnvelope: { status: 'absent' } }
}

function dimensionRecord(level) {
  const real = level === 'enforced' || level === 'author-trusted'
  return { level, mechanism: real ? 'node-lane-fallback' : null, realmId: REALM, trustRoot: real ? 'fixture:a5w5' : null, evidence: real ? 'dev/agent-workflow/evidence/alpha5/wiring/w5' : null }
}

export function assuranceContract() {
  const dims = ['content-read', 'directory-metadata', 'write', 'alias', 'network-destination', 'inherit-cancel']
  const assurance = {}
  for (const d of dims) assurance[d] = dimensionRecord('untested')
  return { implementationOrigin: 'team-trusted-extension', executionBoundary: 'confined-subprocess', assurance }
}

export function binding(tg, toolName, over = {}) {
  const assurance = assuranceContract()
  const parsed = tg.parseToolBinding({
    bindingId: `bind-a5w5-${toolName}`,
    agentScopeKey: 'a5w5-session',
    toolName,
    definitionIdentity: `def:a5w5-${toolName}`,
    providerId: 'team-own',
    implementationOrigin: assurance.implementationOrigin,
    executionBoundary: assurance.executionBoundary,
    assurance,
    policyGeneration: 1,
    authorityGeneration: 1,
    revision: 1,
    status: 'ACTIVE',
    ...over,
  })
  if (!parsed.ok) throw new Error(`a5w5 fixture binding rejected: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

/** Kernel harness (port of a5p2-kernel-harness.makeHarness, same as PR3 round). */
export function makeLiveHarness(ta, { policy, onObserve } = {}) {
  const ledger = ta.createGrantLedger()
  const innerProbe = ta.createStubAssuranceProbe({})
  const kernel = ta.createAdmissionKernel({
    clock: () => FIXED_NOW,
    authorityGeneration: () => 1,
    documents: emptyHardDocs,
    policyDocument: policy ?? (() => ({ rules: [] })),
    beneficiaryAuthority: 'member',
    assuranceProbe: innerProbe,
    requiredAssurance: () => ({}),
    ledger,
    ...(onObserve === undefined ? {} : { onObserve }),
  })
  return { kernel, ledger }
}

/**
 * THE FULL PR2 FLOW for one live tool call: bind → grant.
 * Returns the kernel decision (all three arms are the frozen vocabulary;
 * anything but `admitted` is presented verbatim and executes NOTHING).
 */
export async function admitCall({ tg, ta }, { registeredName, callId, requestedEffects, parametersFingerprint, policyArms }) {
  const kernelEvents = []
  const { kernel, ledger } = makeLiveHarness(ta, { policy: () => allowPolicy(tg, policyArms), onObserve: (row) => kernelEvents.push(row) })
  const request = {
    binding: binding(tg, registeredName),
    member: MEM,
    callId,
    realmId: REALM,
    parametersFingerprint,
    requestedEffects,
  }
  const decision = await kernel.admit(request)
  if (!decision.ok) return { stage: 'admit-errored', error: decision.error, kernel, ledger, request, kernelEvents }
  const value = decision.value
  return {
    stage: value.kind,
    decision: value,
    grant: value.kind === 'admitted' ? value.grant : null,
    kernel,
    ledger,
    request,
    kernelEvents,
  }
}

/** Exec-edge consume through the PR2 kernel (one-shot law). */
export function execEdgeConsume(flow, { replay = false } = {}) {
  const { kernel, grant, request } = flow
  const r = kernel.consumeForExecution(grant, {
    currentAuthorityGeneration: 1,
    member: MEM,
    callId: request.callId,
    realmId: REALM,
    bindingId: grant.bindingId,
    bindingRevision: grant.bindingRevision,
    parametersFingerprint: request.parametersFingerprint,
    requestedEffects: request.requestedEffects,
    cancelRequested: false,
  })
  return r.ok ? { ok: true, replay } : { ok: false, replay, code: r.error.code, message: String(r.error.message) }
}

// ── real backends for the LIVE pipeline (row-side executors) ────────────────

const CHUNK = 65_536
function writeAll(sink, text) {
  if (sink === null || sink === undefined || text.length === 0) return
  for (let i = 0; i < text.length; i += CHUNK) sink.write(text.slice(i, i + CHUNK))
}

/** Resolve a parsed target to an OS path under the world (wiring's canonical
 *  mapping, disclosed: workspace anchors at the repo dir, absolutes verbatim). */
export function resolveTarget(world, target) {
  if (target.placement === 'absolute-path') return target.locator
  if (target.placement === 'realm-home') return null // not exercised by this round
  return target.locator === '.' ? world.repo : join(world.repo, target.locator)
}

/**
 * The governed shell backend: spawns `/bin/sh -c command`, records the raw
 * outcome, streams the FULL payload into the spill sink while the lease is
 * ACTIVE. `gate` = { execEdge() } is where the bound admission fact is
 * consumed BEFORE any spawn (deny-before-spawn, the exec-edge leg).
 */
export function createRealShellBackend(a5, { world, gateRef }) {
  let executed = 0
  const lastOutcomes = []
  return {
    backendId: 'a5w5-real-shell',
    execCount: () => executed,
    outcomes: lastOutcomes,
    async run(call, io) {
      const parsed = call.parsedArgs
      if (parsed.tool !== 'bash') return { ok: false, failure: { class: 'denied', code: 'wrong-tool-for-backend', detail: 'shell backend got a non-bash call' } }
      const cwd = resolveTarget(world, parsed.cwd)
      if (cwd === null || !existsSync(cwd)) {
        return { ok: false, failure: { class: 'denied', code: 'cwd-unresolvable', detail: `cwd target does not resolve inside the world (${parsed.cwd.locator})` } }
      }
      const gate = gateRef?.current
      if (gate !== undefined && typeof gate.execEdge === 'function') {
        const edge = gate.execEdge()
        if (edge !== null && edge !== undefined && edge.ok === false) {
          return { ok: false, failure: { class: 'denied', code: `exec-edge-${String(edge.code)}`, detail: edge.message ?? 'the bound admission fact refused the exec edge' } }
        }
      }
      executed += 1
      const timeoutMs = parsed.timeoutMs ?? 30_000
      const res = spawnSync('/bin/sh', ['-c', parsed.command], { cwd, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 })
      const timedOut = res.error !== undefined && String(res.error.code ?? '') === 'ETIMEDOUT'
      const spawnFailed = res.error !== undefined && !timedOut
      if (spawnFailed) {
        return { ok: false, failure: { class: 'undetermined', code: 'spawn-failed', detail: String(res.error.message).slice(0, 200) } }
      }
      const outcome = {
        exitCode: typeof res.status === 'number' ? res.status : null,
        stdout: res.stdout ?? '',
        stderr: res.stderr ?? '',
        timedOut,
        cancelled: false,
        truncated: false,
      }
      writeAll(io.sink, res.stdout ?? '')
      writeAll(io.sink, res.stderr ?? '')
      lastOutcomes.push({ callId: call.callId, command: parsed.command, exit: outcome.exitCode, stdoutSha: sha256(outcome.stdout), stderrSha: sha256(outcome.stderr), stdoutBytes: outcome.stdout.length, stderrBytes: outcome.stderr.length, timedOut })
      return { ok: true, outcome, settlement: { kind: 'completed' } }
    },
  }
}

/** Build the exact grep argv for parsed search args (shared by the governed
 *  backend and the RAW parity leg — the parity law needs ONE argv). */
export function grepArgv(parsed, searchPath) {
  const argv = ['-rIn', '--binary-files=without-match']
  if (parsed.outputMode === 'files_with_matches') argv.splice(1, 1, '-rl')
  else if (parsed.outputMode === 'count') argv.splice(1, 1, '-rc')
  if (parsed.fixedString) argv.push('-F')
  else argv.push('-E')
  if (parsed.ignoreCase) argv.push('-i')
  if (parsed.globFilter !== undefined) argv.push(`--include=${parsed.globFilter}`)
  if (parsed.contextLines > 0 && parsed.outputMode === 'content') argv.push(`-C${parsed.contextLines}`)
  argv.push('--', parsed.pattern, searchPath)
  return argv
}

/**
 * The governed search backend: runs the real system grep with `grepArgv`,
 * shapes a SearchOutcome, and writes the RAW stdout payload to the spill sink
 * (the spill byte-for-byte IS the backend payload — the parity table pins it
 * against the raw leg's stdout). multiline is refused by name (the probe
 * greps with grep(1); scenarios never ask for multiline — honest refusal,
 * never a silent reinterpretation).
 */
export function createRealSearchBackend(a5, { world, gateRef }) {
  let executed = 0
  const lastOutcomes = []
  return {
    backendId: 'a5w5-real-search',
    execCount: () => executed,
    outcomes: lastOutcomes,
    async run(call, io) {
      const parsed = call.parsedArgs
      if (parsed.tool !== 'grep') return { ok: false, failure: { class: 'denied', code: 'wrong-tool-for-backend', detail: 'search backend got a non-grep call' } }
      if (parsed.multiline) {
        return { ok: false, failure: { class: 'denied', code: 'multiline-unsupported-on-probe', detail: 'the live probe greps with grep(1); multiline is not implemented (refused by name, never reinterpreted)' } }
      }
      const searchPath = resolveTarget(world, parsed.target)
      if (searchPath === null || !existsSync(searchPath)) {
        return { ok: false, failure: { class: 'denied', code: 'target-unresolvable', detail: `search target does not resolve inside the world (${parsed.target.locator})` } }
      }
      const gate = gateRef?.current
      if (gate !== undefined && typeof gate.execEdge === 'function') {
        const edge = gate.execEdge()
        if (edge !== null && edge !== undefined && edge.ok === false) {
          return { ok: false, failure: { class: 'denied', code: `exec-edge-${String(edge.code)}`, detail: edge.message ?? 'the bound admission fact refused the exec edge' } }
        }
      }
      executed += 1
      const argv = grepArgv(parsed, searchPath)
      const res = spawnSync('grep', argv, { encoding: 'utf8', timeout: 60_000, maxBuffer: 32 * 1024 * 1024 })
      if (res.error !== undefined) {
        return { ok: false, failure: { class: 'undetermined', code: 'grep-failed', detail: String(res.error.message).slice(0, 200) } }
      }
      if (res.status !== 0 && res.status !== 1) {
        return { ok: false, failure: { class: 'undetermined', code: `grep-exit-${String(res.status)}`, detail: String(res.stderr ?? '').slice(0, 200) } }
      }
      const rawStdout = res.stdout ?? ''
      const lines = rawStdout.length === 0 ? [] : rawStdout.split('\n').filter((l) => l !== '')
      let outcome
      if (parsed.outputMode === 'files_with_matches') {
        const files = lines.slice(0, parsed.maxResults)
        outcome = { outputMode: 'files_with_matches', matches: [], counts: [], files, totalMatches: lines.length, truncated: lines.length > files.length }
      } else if (parsed.outputMode === 'count') {
        const counts = lines.map((l) => { const i = l.lastIndexOf(':'); return { path: l.slice(0, i), count: Number(l.slice(i + 1)) } }).slice(0, parsed.maxResults)
        outcome = { outputMode: 'count', matches: [], counts, files: [], totalMatches: counts.reduce((s, c) => s + c.count, 0), truncated: lines.length > counts.length }
      } else {
        const all = lines.map((l) => {
          const m = /^(.*?):(\d+):([\s\S]*)$/.exec(l)
          return m === null ? { path: l, text: '' } : { path: m[1], line: Number(m[2]), text: m[3] }
        })
        const matches = all.slice(0, parsed.maxResults)
        outcome = { outputMode: 'content', matches, counts: [], files: [], totalMatches: all.length, truncated: all.length > matches.length }
      }
      writeAll(io.sink, rawStdout) // the FULL raw payload — spill bytes == backend bytes
      lastOutcomes.push({ callId: call.callId, argv: argv.join(' '), mode: parsed.outputMode, rawStdoutSha: sha256(rawStdout), rawBytes: rawStdout.length, totalMatches: outcome.totalMatches })
      return { ok: true, outcome, settlement: { kind: 'completed' } }
    },
  }
}

// ── RAW parity leg (the comparison side: no lane, no admission) ─────────────

export function runRawShell(command, cwd, timeoutMs = 30_000) {
  const res = spawnSync('/bin/sh', ['-c', command], { cwd, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 })
  return {
    exit: typeof res.status === 'number' ? res.status : null,
    stdoutSha: sha256(res.stdout ?? ''),
    stderrSha: sha256(res.stderr ?? ''),
    stdoutBytes: (res.stdout ?? '').length,
    stderrBytes: (res.stderr ?? '').length,
  }
}

export function runRawGrep(argv) {
  const res = spawnSync('grep', argv, { encoding: 'utf8', timeout: 60_000, maxBuffer: 32 * 1024 * 1024 })
  return { exit: res.status, stdoutSha: sha256(res.stdout ?? ''), stdoutBytes: (res.stdout ?? '').length }
}

// ── spill lifecycle LIVE driver (task ②): the real store on real disk ───────

/**
 * The lifecycle the task names, LIVE: open → write → read → authorization
 * RE-CHECK → settle+close → id-in-use REPLAY refusal, plus the off-set
 * settlement event. Every refusal is recorded VERBATIM (code/class/detail).
 */
export async function runSpillLifecycle(spill, world) {
  const mod = await import('node:fs')
  const counts = { ensureDir: 0, writeFile: 0, appendFile: 0, readText: 0, sizeBytes: 0, list: 0, remove: 0, exists: 0 }
  const inc = (k, fn) => (...a) => { counts[k] += 1; return fn(...a) }
  const port = {
    ensureDir: inc('ensureDir', (p) => mod.mkdirSync(p, { recursive: true })),
    writeFile: inc('writeFile', (p, t) => mod.writeFileSync(p, t)),
    appendFile: inc('appendFile', (p, t) => mod.writeFileSync(p, t, { flag: 'a' })),
    readText: inc('readText', (p) => mod.readFileSync(p, 'utf8')),
    sizeBytes: inc('sizeBytes', (p) => mod.readFileSync(p).length),
    list: inc('list', (d) => { try { return mod.readdirSync(d) } catch { return [] } }),
    remove: inc('remove', (p) => mod.rmSync(p, { force: true })),
    exists: inc('exists', (p) => mod.existsSync(p)),
  }
  const snap = () => ({ ...counts })
  const delta = (before) => Object.fromEntries(Object.keys(counts).map((k) => [k, counts[k] - before[k]]))

  const opened = spill.openSpillStore({ worldRoot: world.rootDir, rootDir: world.spillRoot, fs: port })
  if (!opened.ok) return { storeOk: false, refusal: opened.refusal }
  const store = opened.store
  const attribution = { realmId: REALM, tool: 'w5-lifecycle', callId: 'life-1' }
  const id = 'w5-life-1'
  const payload = 'A5W5-SPILL-LIFECYCLE-PAYLOAD-'.repeat(64)
  const out = { storeOk: true }

  // 1) open + write (ACTIVE)
  const lease1 = spill.createSpillLease()
  const sinkOpen = store.openSink({ spillId: id, lease: lease1, attribution })
  out.open = sinkOpen.ok ? { ok: true } : { ok: false, refusal: sinkOpen.refusal }
  if (!sinkOpen.ok) return out
  const sink1 = sinkOpen.sink
  const w1 = sink1.write(payload.slice(0, payload.length / 2))
  const w2 = sink1.write(payload.slice(payload.length / 2))
  out.written = { ok: w1.ok && w2.ok, bytes: sink1.bytes() }

  // 2) read (authorized)
  const bRead = snap()
  const rRead = store.readSpill(id, () => ({ allow: true }))
  out.read = { ok: rRead.ok === true, matches: rRead.ok === true && rRead.text === payload, attribution: rRead.ok === true ? rRead.attribution : null, portDelta: delta(bRead) }

  // 3) authorization RE-CHECK refuses: deny → typed refusal, payload I/O = 0
  const bDeny = snap()
  const rDeny = store.readSpill(id, () => ({ allow: false, detail: 'w5 re-check refused' }))
  out.recheck = {
    refused: rDeny.ok === false,
    refusal: rDeny.ok === false ? rDeny.refusal : null,
    payloadReadDelta: delta(bDeny).readText,
    totalPortDelta: delta(bDeny),
  }

  // 4) settle → finalize → close; write-after-close refuses
  const bClose = snap()
  const settled = lease1.settle({ kind: 'completed' })
  const finalized = settled.ok ? sink1.finalize({ kind: 'completed' }) : settled
  const closed = lease1.close()
  const lateWrite = sink1.write('late')
  out.close = { settledOk: settled.ok === true, finalizedOk: finalized.ok === true, closedOk: closed.ok === true, state: lease1.state(), writeAfterClose: lateWrite.ok === false ? lateWrite.refusal : null }

  // 5) id-in-use REPLAY: re-opening the SAME spillId refuses BEFORE any
  //    write-port call; payload and meta stay byte-identical (terminal fact
  //    preserved, attribution unchanged).
  const payloadPath = join(world.spillRoot, `${id}.spill`)
  const metaPath = join(world.spillRoot, `${id}.spill.meta`)
  const beforeSha = sha256(mod.readFileSync(payloadPath, 'utf8'))
  const beforeMeta = mod.readFileSync(metaPath, 'utf8')
  const bReplay = snap()
  const replay = store.openSink({ spillId: id, lease: spill.createSpillLease(), attribution: { realmId: 'OTHER-REALM', tool: 'attacker', callId: 'x' } })
  out.idInUse = {
    refused: replay.ok === false,
    refusal: replay.ok === false ? replay.refusal : null,
    writePortDelta: delta(bReplay).writeFile + delta(bReplay).appendFile,
    payloadUnchanged: sha256(mod.readFileSync(payloadPath, 'utf8')) === beforeSha,
    metaUnchanged: mod.readFileSync(metaPath, 'utf8') === beforeMeta,
  }

  // 6) residue enumeration on a FRESH store handle (law 3): attribution +
  //    settlement class survive on disk, not in memory.
  const fresh = spill.openSpillStore({ worldRoot: world.rootDir, rootDir: world.spillRoot, fs: port })
  out.freshResidue = fresh.ok === true
    ? fresh.store.listResidue().filter((e) => e.spillId === id).map((e) => ({ spillId: e.spillId, bytes: e.bytes, attribution: e.attribution, settlement: e.settlement }))
    : null

  // 7) off-set settlement event → spill-settlement-event-unknown
  const lease2 = spill.createSpillLease()
  const bogus = lease2.settle({ kind: 'cancelled', event: 'dispatcher-call-not-a-real-event' })
  out.unknownEvent = { refused: bogus.ok === false, refusal: bogus.ok === false ? bogus.refusal : null }
  out.portCountsTotal = counts
  return out
}

/**
 * The six-name LIVE table (task ④): each master full-prefix name settles a
 * fresh lease (accepted), plus the off-set name (refused with its own typed
 * code). `names` MUST be read from the lane's own SETTLEMENT_EVENTS — the
 * constants under test, not a copy.
 */
export function runSixNames(spill) {
  const rows = spill.SETTLEMENT_EVENTS.map((event) => {
    const lease = spill.createSpillLease()
    const r = lease.settle({ kind: 'cancelled', event })
    return { event, accepted: r.ok === true, fullPrefix: event.startsWith('dispatcher-call-') }
  })
  const off = spill.createSpillLease().settle({ kind: 'cancelled', event: 'call-cancelled-before-body' }) // the retired SHORT form
  return { rows, offSet: { event: 'call-cancelled-before-body', refused: off.ok === false, refusal: off.ok === false ? off.refusal : null } }
}
