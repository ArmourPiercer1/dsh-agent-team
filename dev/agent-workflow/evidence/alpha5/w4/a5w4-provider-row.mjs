/**
 * a5w4-provider-row.mjs — Alpha.5 W4 wiring: the PR4 confined-process PROVIDER
 * FACTORY assembled INTO a real session Agent, on the pinned Host, through the
 * public seams only.
 *
 * WHAT THIS ROW IS (WIRING-PHASE-PLAN W4, IF-1): a plain plugin row mounted
 * through the public profile-patch seam (`$DSH_HOME/profiles/web/cordis.patch.yml`,
 * a top-level loader patch array — the live round's measured shape) — the same
 * seam the production `dsh-agent-team` row and the live round's assembly row
 * use. It registers exactly ONE restricted exec tool on the live session Agent
 * (`a5w4_confined_exec`, the Agent resolved through the PUBLIC `ctx.agents`
 * seam — the measured Host fact from `../live/README.md` stands: a plain row's
 * `agent/created` subscription receives nothing in a plain-session world, so
 * assembly is route-driven exactly like the live round). Behind the tool stands
 * the REAL Lane C provider: `createConfinedProcessProvider` imported from this
 * worktree's BUILT DIST public barrel
 * (`packages/runtime/dist/packages/runtime/sandbox-provider/index.js`),
 * spawning through the tracked trusted pre-launcher (real Landlock, real execve).
 *
 * THE RESTRICTION (受限 exec 工具): the model cannot choose argv. The tool's
 * only arguments are `{mode, tag}`; every SpawnRequest (argv/cwd/allowPaths/
 * networkProfile) is FIXED in this row. One request shape per wiring claim:
 *
 *   supported / supported-deny  the SAME confined policy over two fixtures: a
 *                               cat of an ALLOWED file (rc 0, spill content
 *                               match) and a cat of a PRIVATE file the domain
 *                               must refuse (rc!=0, stderr EACCES) — the OS
 *                               enforcement plane acting on the payload.
 *   net-deny / net-restricted / net-forged  network dimensions the lane does
 *                               NOT offer: typed IO_POLICY_UNSUPPORTED BEFORE
 *                               any process exists (PoC-4b honesty — deny and
 *                               restricted BOTH refused; a forged 'unconfined'
 *                               is outside the closed set).
 *   pty                       a request the frozen C-PROC SpawnRequest cannot
 *                               EVEN EXPRESS (no PTY arm). Passing `pty:true`
 *                               through would be silently DROPPED — a
 *                               capability downgrade in silence. The wiring
 *                               law: a request the seam cannot express is
 *                               refused with the typed IO_POLICY_UNSUPPORTED
 *                               AT THE WIRING BOUNDARY, before any provider
 *                               entry point runs.
 *   missing-pieces            an instance whose precondition preflight finds no
 *                               launcher script → SANDBOX_UNAVAILABLE before
 *                               the probe legs and before any spawn (no-fallback
 *                               law; the existence preflight itself runs
 *                               `python3 --version` / `test -f` — precondition
 *                               probes, recorded as such, not payload spawns).
 *   revoked                   negative-control-B CONTRAST: SAME factory, SAME
 *                               request shape, enforcement plane OS-REVOKED for
 *                               the launcher processes by the committed
 *                               seccomp-BPF wrapper (landlock syscalls → EACCES,
 *                               kernel-enforced). The authoritative probe
 *                               measures abi-unavailable ⇒ prepare refuses
 *                               SANDBOX_UNAVAILABLE; the naked-spawn arm does
 *                               not exist. The same request SUCCEEDED in the
 *                               pos phase — the contrast is the criterion.
 *   chan                      G-6/G-7 observation-channel reuse leg (below).
 *
 * THE COUNTING SPY (public `deps` seam, zero lane edit): ProviderOptions.deps
 * is the frozen injection point ("tests inject a counting fake to watch ZERO
 * calls" — provider.ts). This row injects the REAL launcher deps wrapped in a
 * per-instance counting spy: every launcher invocation (probe legs and
 * confined-exec alike) is journalled with its class, rc, and the launcher's
 * answer JSON (rc/pid/out_ref). That gives the wiring face what the provider's
 * RunOutput does NOT carry — the payload's EXIT CODE and PID (review-LaneC
 * 观察 1: seam 缺 rc 面; the seam extension is a GLUE-owned follow-up, NOT a
 * lane edit; until then the spy IS the observation channel, disclosed here).
 *
 * DISCLOSED ASSEMBLY FACT (measured pre-run): provider.execute() passes ITS
 * OWN module-relative launcherPath as argv[0] — inside dist that path does not
 * exist (tsc emit carries no .py assets). The public deps seam is exactly
 * where an assembly decides WHICH trusted bytes run: the spy rewrites argv[0]
 * to the TRACKED launcher the trustRoot names by sha256, and journals both
 * identities. The argv tail stays provider-compiled, untouched.
 *
 * HARD REALM (review-LaneC 观察 2: "装配 hard realm 时必须配 hardDimensions"):
 * every instance this row builds is constructed WITH
 * `hardDimensions: ['content-read','write']` — every accepted spawn ran through
 * `verifyHardProfileEvidence` against the REAL captured probe evidence (realm
 * match + every leg clean + enforced rows carrying mechanism/trustRoot/
 * evidence). No hand-built evidence anywhere near the verifier (the fabrication
 * guard exists exactly against this row typing in an `enforced`).
 *
 * G-6/G-7 CHANNEL OBSERVATION, reused at the provider face (recorded, per plan
 * "如适用"): the provider seam emits NO §5 events (its cancellation surface is
 * the lease state machine, C-GW boundary), so there is no provider event
 * channel to score. What IS reused: the observation plumbing — a row-owned
 * `tools/change` control subscription on the live Agent scope (the live round's
 * G-4 control form) plus ONE legal registry move on the row's OWN Definition
 * (dispose + re-register), recording whether the REAL registry delivered. It
 * makes NO channel-closure claim in either direction; the G-g posture (silent
 * channel is not fail-closed) is unchanged and OPEN.
 *
 * DORMANT law respected: zero production-file change (this file lives under
 * dev/agent-workflow/evidence/, OUTSIDE every packages/** census/DORMANT walk —
 * the a5p4 hygiene walk roots at `packages/`); zero shared-file change (IF-5);
 * TEST-SIDE assembly only — the live registry and agent-bindings are untouched;
 * `HARD_PROFILE_ENABLED` stays false in the lane (this row consumes capability
 * rows and the prepare-time hard-DIMENSION gate; it never turns a verification
 * accept into an enablement).
 *
 * Kit-provided environment (run-w4.mjs):
 *   A5W4_DIST, A5W4_LAUNCHER, A5W4_PYTHON, A5W4_REVOKE_PY, A5W4_REALM,
 *   A5W4_TRUSTROOT, A5W4_SCRATCH, A5W4_FIXTURES, A5W4_LEDGER
 *
 * @module dev/agent-workflow/evidence/alpha5/w4/a5w4-provider-row
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

export const name = 'a5w4-provider-row'
export const inject = ['webServer', 'agents']

const DIST = process.env['A5W4_DIST'] ?? ''
const LAUNCHER = process.env['A5W4_LAUNCHER'] ?? ''
const PYTHON = process.env['A5W4_PYTHON'] ?? 'python3'
const REVOKE_PY = process.env['A5W4_REVOKE_PY'] ?? ''
const REALM = process.env['A5W4_REALM'] ?? 'a5w4-realm'
const TRUSTROOT = process.env['A5W4_TRUSTROOT'] ?? 'unanchored'
const SCRATCH = process.env['A5W4_SCRATCH'] ?? ''
const FIXTURES = process.env['A5W4_FIXTURES'] ?? ''
const LEDGER = process.env['A5W4_LEDGER'] ?? ''
const RUN_TAG = 'w4run'

const JOURNAL = []
function record(row) {
  const stamped = { at: new Date().toISOString(), ...row }
  JOURNAL.push(stamped)
  if (LEDGER !== '') {
    try {
      mkdirSync(dirname(LEDGER), { recursive: true })
      appendFileSync(LEDGER, JSON.stringify(stamped) + '\n')
    } catch { /* the journal route is the authoritative in-process copy */ }
  }
}

const slug = (v) => String(v ?? 'untagged').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)
function safeLabel(read) {
  try { return String(read() ?? '(unknown-agent)') } catch (error) { return `(unreadable: ${String(error?.message ?? error).slice(0, 60)})` }
}
const agentLabel = (agent) => slug(safeLabel(() => agent?.id ?? agent?.session?.header?.id ?? agent?.scopeKey))

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

/** Recursive manifest of a subtree: sorted `rel|size` lines (write evidence). */
function manifest(root) {
  const out = []
  const walk = (dir) => {
    let entries = []
    try { entries = readdirSync(dir) } catch { return }
    for (const entry of entries.sort()) {
      const full = join(dir, entry)
      let st = null
      try { st = statSync(full) } catch { continue }
      if (st.isDirectory()) walk(full)
      else if (st.isFile()) out.push(`${relative(root, full)}|${String(st.size)}`)
    }
  }
  if (existsSync(root)) walk(root)
  return out
}

/** Classify one launcher invocation by its mode argument (argv[1]). */
const classify = (argv) => {
  const a = String(argv?.[1] ?? '')
  if (a === '--confined-exec') return 'confined-exec'
  if (a === '--abi-probe') return 'abi-probe'
  if (a === '--enforce-leg') return `enforce-leg:${String(argv?.[2] ?? '?')}`
  if (a === '--fd-close') return 'fd-close'
  return `other:${a.slice(0, 20)}`
}

const assemblies = new Map()

/** One provider instance: REAL launcher deps wrapped in the counting spy. */
function buildInstance(mod, label, { pythonPath, launcherPath }) {
  const real = mod.createLauncherDeps({ pythonPath, launcherPath })
  const counters = { runs: 0, confinedExec: 0, byKind: {} }
  const execAnswers = []
  const abiAnswers = []
  const legVerdicts = {}
  const offeredLauncherPaths = new Set()
  const spyRun = (argv, timeoutMs) => {
    const kind = classify(argv)
    if (typeof argv?.[0] === 'string') offeredLauncherPaths.add(argv[0])
    counters.runs += 1
    counters.byKind[kind] = (counters.byKind[kind] ?? 0) + 1
    if (kind === 'confined-exec') counters.confinedExec += 1
    record({ leg: 'run-spy', instance: label, kind, offered: String(argv?.[0] ?? ''), rewritten: argv?.[0] !== launcherPath })
    const r = real.run([launcherPath, ...(argv ?? []).slice(1)], timeoutMs)
    record({ leg: 'run-answer', instance: label, kind, rc: r.rc, stderrTail: String(r.stderr ?? '').slice(0, 160) })
    if (kind.startsWith('enforce-leg:')) {
      let verdict = 'MIXED/FAILED'
      try {
        const line = String(r.stdout ?? '').trim().split('\n').filter((l) => l.length > 0).pop()
        const v = JSON.parse(line ?? 'null')
        if (typeof v?.verdict === 'string') verdict = v.verdict
      } catch { /* unparseable stays MIXED/FAILED — the probe's own truth */ }
      legVerdicts[kind.slice('enforce-leg:'.length)] = verdict
      record({ leg: 'leg-verdict', instance: label, kind, verdict })
    }
    if (kind === 'confined-exec') {
      let answer = null
      try {
        const line = String(r.stdout ?? '').trim().split('\n').filter((l) => l.length > 0).pop()
        if (line !== undefined) answer = JSON.parse(line)
      } catch { answer = null }
      execAnswers.push({ rc: answer?.rc ?? null, pid: answer?.pid ?? null, executed: answer?.executed === true, outRef: answer?.out_ref ?? null, errRef: answer?.err_ref ?? null, launcherRc: r.rc })
      record({ leg: 'exec-answer', instance: label, rc: answer?.rc ?? null, pid: answer?.pid ?? null, launcherRc: r.rc, abiUnavailable: answer?.abi_unavailable === true })
    }
    if (kind === 'abi-probe') {
      const raw = String(r.stdout ?? '')
      let abiVersion = null
      try {
        const line = raw.trim().split('\n').filter((l) => l.length > 0).pop()
        const v = JSON.parse(line ?? 'null')
        if (v?.kind === 'abi-available' && typeof v?.abi_version === 'number') abiVersion = v.abi_version
      } catch { /* unparseable stays null — the probe's own truth */ }
      abiAnswers.push({ abiVersion, eaccesInRaw: /EACCES/.test(raw) || /EACCES/.test(String(r.stderr ?? '')), rawHead: raw.slice(0, 400) })
      record({ leg: 'abi-answer', instance: label, abiVersion, eaccesInRaw: /EACCES/.test(raw) })
    }
    return r
  }
  const launcher = { pythonPath, launcherPath, run: spyRun }
  const deps = {
    availability: () => ({ rows: mod.runAvailabilityPreflight({ pythonPath, launcherPath, runnerCommand: null }) }),
    run: spyRun,
    probeFacts: () => {
      const abi = mod.runAbiProbe(launcher)
      const legs = {}
      for (const leg of mod.ENFORCEMENT_LEGS) {
        legs[leg] = mod.runEnforcementLeg(launcher, leg, join(SCRATCH, label, `probe-${RUN_TAG}`, leg))
      }
      return { abiVersion: abi.abiVersion, legs }
    },
  }
  const provider = mod.createConfinedProcessProvider({
    realmId: REALM,
    trustRoot: TRUSTROOT,
    scratchRoot: join(SCRATCH, label),
    hardDimensions: ['content-read', 'write'], // 观察 2 law: a hard realm ALWAYS carries its hardDimensions
    deps,
  })
  return { provider, counters, execAnswers, abiAnswers, legVerdicts, offeredLauncherPaths: [...offeredLauncherPaths], launcher }
}

/** The one SpawnRequest shape the tool can ever produce (row-fixed, restricted). */
function spawnRequest(mode, tag) {
  const base = {
    grantFingerprint: `a5w4-grant-${slug(tag)}`,
    realmId: REALM,
    bindingId: 'a5w4-wiring-binding',
    memberScope: 'session',
    cwd: FIXTURES,
    env: [],
    allowPaths: [{ path: join(FIXTURES, 'allow'), accessBits: { readFile: true, readDir: true } }],
  }
  if (mode === 'supported') return { ...base, argv: ['/usr/bin/cat', join(FIXTURES, 'allow', 'ok.txt')] }
  if (mode === 'supported-deny') return { ...base, argv: ['/usr/bin/cat', join(FIXTURES, 'private', 'secret.txt')] }
  if (mode === 'net-deny') return { ...base, argv: ['/usr/bin/cat', join(FIXTURES, 'allow', 'ok.txt')], networkProfile: 'deny' }
  if (mode === 'net-restricted') return { ...base, argv: ['/usr/bin/cat', join(FIXTURES, 'allow', 'ok.txt')], networkProfile: 'restricted' }
  // a FORGED profile outside the closed set — the closed-set arm must catch it
  if (mode === 'net-forged') return { ...base, argv: ['/usr/bin/cat', join(FIXTURES, 'allow', 'ok.txt')], networkProfile: 'unconfined' }
  return { ...base, argv: ['/usr/bin/cat', join(FIXTURES, 'allow', 'ok.txt')] }
}

export async function apply(ctx) {
  record({ leg: 'plugin-apply', pid: process.pid, dist: DIST, launcher: LAUNCHER, realm: REALM })
  let prov = null
  try {
    prov = await import(pathToFileURL(join(DIST, 'runtime', 'sandbox-provider', 'index.js')).href)
    record({ leg: 'barrel-import', ok: true, names: ['createConfinedProcessProvider', 'createLauncherDeps', 'runAvailabilityPreflight', 'runAbiProbe', 'runEnforcementLeg', 'ENFORCEMENT_LEGS'].map((n) => `${n}:${typeof prov[n]}`).join(',') })
  } catch (error) {
    record({ leg: 'barrel-import', ok: false, error: String(error?.message ?? error) })
  }

  if (typeof ctx.webServer?.register === 'function') {
    ctx.webServer.register({
      kind: 'exact', path: '/__a5w4/health',
      handler: (_req, res) => sendJson(res, 200, { ok: true, pid: process.pid, applied: true, barrel: prov !== null, agents: [...assemblies.keys()] }),
    }, 'a5w4 health')
    ctx.webServer.register({
      kind: 'exact', path: '/__a5w4/journal',
      handler: (_req, res) => sendJson(res, 200, { rows: JOURNAL }),
    }, 'a5w4 journal')
    ctx.webServer.register({
      kind: 'exact', path: '/__a5w4/state',
      handler: async (_req, res) => {
        const out = {}
        for (const [label, asm] of assemblies) {
          const probes = {}
          for (const [inst, holder] of Object.entries(asm.instances)) {
            let rows = null
            if (holder !== null) {
              const p = await holder.provider.probe()
              rows = p.ok ? p.value.map((r) => ({ dimension: r.dimension, level: r.level, mechanism: r.mechanism, realmId: r.realmId, trustRoot: r.trustRoot, evidence: r.evidence, note: r.note.slice(0, 200) })) : { refused: p.error }
            }
            probes[inst] = { rows, abiAnswers: holder?.abiAnswers ?? [], legVerdicts: holder?.legVerdicts ?? {}, counters: holder?.counters ?? null, offeredLauncherPaths: holder?.offeredLauncherPaths ?? [], hardDimensionsConfigured: ['content-read', 'write'] }
          }
          out[label] = {
            registration: asm.registration,
            toolResults: asm.toolResults,
            channel: { controlEvents: asm.controlEvents },
            instances: probes,
            fixturesManifest: manifest(FIXTURES),
          }
        }
        sendJson(res, 200, { realm: REALM, trustRoot: TRUSTROOT, scratchManifest: manifest(SCRATCH), assemblies: out })
      },
    }, 'a5w4 state')
    ctx.webServer.register({
      kind: 'exact', path: '/__a5w4/assemble',
      handler: async (req, res) => {
        let body = ''
        for await (const chunk of req) body += chunk
        let parsed
        try { parsed = JSON.parse(body || '{}') } catch { parsed = {} }
        const sessionId = String(parsed?.sessionId ?? '')
        let agent = null
        try { agent = ctx.agents.get?.(sessionId) ?? null } catch { agent = null }
        if (agent === null || agent === undefined) { sendJson(res, 404, { ok: false, error: `no agent for session ${sessionId}` }); return }
        const label = agentLabel(agent)
        if (assemblies.has(label)) { sendJson(res, 200, { ok: true, already: true, label }); return }
        try {
          await assemble(label, agent, prov)
          sendJson(res, 200, { ok: true, assembled: true, label, registration: assemblies.get(label)?.registration ?? null })
        } catch (error) {
          record({ leg: 'assembly-failed', label, error: String(error?.stack ?? error).slice(0, 800) })
          sendJson(res, 500, { ok: false, error: String(error?.message ?? error) })
        }
      },
    }, 'a5w4 assemble')
  }

  async function assemble(label, agent, mod) {
    const asm = { registration: null, toolResults: [], controlEvents: 0, channelMove: 'not-attempted', instances: {}, disposers: [] }
    assemblies.set(label, asm)
    let inner
    try { inner = agent?.ctx } catch (error) { asm.registration = { ok: false, why: `agent-ctx-unreadable: ${String(error?.message ?? error)}` }; return }
    if (typeof inner?.tools?.register !== 'function') { asm.registration = { ok: false, why: 'agent-ctx-unusable' }; record({ leg: 'agent-ctx-unusable', label }); return }
    if (mod === null) { asm.registration = { ok: false, why: 'barrel-import-failed' }; return }

    // the three provider instances of the wiring (main / missing-pieces / revoked)
    asm.instances.main = buildInstance(mod, 'main', { pythonPath: PYTHON, launcherPath: LAUNCHER })
    asm.instances.missing = buildInstance(mod, 'missing', { pythonPath: PYTHON, launcherPath: join(dirname(SCRATCH), 'a5w4-no-such-launcher.py') })
    asm.instances.revoked = REVOKE_PY !== ''
      ? buildInstance(mod, 'revoked', { pythonPath: REVOKE_PY, launcherPath: LAUNCHER })
      : null

    // G-6/G-7 form control subscription on the LIVE Agent scope (observation only)
    try {
      const off = inner.on('tools/change', () => { asm.controlEvents += 1 })
      asm.disposers.push(() => { try { typeof off === 'function' ? off() : off?.dispose?.() } catch { /* unwind */ } })
    } catch (error) { record({ leg: 'listen-fail', label, event: 'tools/change', error: String(error?.message ?? error) }) }

    const definition = () => ({
      name: 'a5w4_confined_exec',
      description: 'Alpha.5 W4 provider wiring (restricted confined exec probe). Arguments: { mode: "supported"|"supported-deny"|"net-deny"|"net-restricted"|"net-forged"|"pty"|"missing-pieces"|"revoked"|"chan", tag: string }. argv is fixed by the assembly row; the model chooses only the mode.',
      parameters: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['supported', 'supported-deny', 'net-deny', 'net-restricted', 'net-forged', 'pty', 'missing-pieces', 'revoked', 'chan'] },
          tag: { type: 'string' },
        },
        required: ['mode', 'tag'],
      },
      output: {
        schema: { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string' } } },
        render: (_args, value) => [{ type: 'text', text: String(value?.text ?? '') }],
      },
      execute: async (args) => runTool(asm, String(args?.mode ?? 'unknown'), String(args?.tag ?? 'untagged')),
    })
    asm.definition = definition
    asm.agentCtxInner = inner

    try {
      const dispose = inner.tools.register(definition())
      asm.toolDisposer = () => { try { typeof dispose === 'function' ? dispose() : dispose?.dispose?.() } catch { /* unwind */ } }
      asm.disposers.push(asm.toolDisposer)
      asm.registration = { ok: true, name: 'a5w4_confined_exec', via: 'agent-ctx-tools-register' }
      record({ leg: 'register', label, name: 'a5w4_confined_exec', ok: true })
    } catch (error) {
      asm.registration = { ok: false, why: `register-threw: ${String(error?.message ?? error)}` }
      record({ leg: 'register', label, name: 'a5w4_confined_exec', ok: false, error: String(error?.message ?? error) })
    }
  }

  async function runTool(asm, mode, tag) {
    const line = (fields) => {
      const row = { mode, tag, ...fields }
      asm.toolResults.push(row)
      record({ leg: 'tool-result', ...row })
      // the model-visible text ECHOES the scripted tag (marker-carrying results)
      return { text: `A5W4-RES tag=${slug(tag)} mode=${mode} ok=${String(row.ok)} code=${String(row.code)} rc=${String(row.rc)} pid=${String(row.pid)} lease=${String(row.lease)} stage=${String(row.stage)}` }
    }
    if (mode === 'chan') {
      // the ONE legal registry move on the row's own Definition (G-6 form),
      // observed through the row-owned control subscription installed at assembly.
      const before = asm.controlEvents
      if (asm.toolDisposer === undefined || asm.agentCtxInner === undefined) {
        return line({ ok: false, code: null, rc: null, pid: null, lease: null, stage: 'chan-not-assembled', controlEventsBefore: before, controlEventsAfter: asm.controlEvents })
      }
      try { asm.toolDisposer(); asm.channelMove = 'disposed' } catch (error) { record({ leg: 'chan-move-dispose-failed', error: String(error?.message ?? error) }) }
      try {
        const re = asm.agentCtxInner.tools.register(asm.definition())
        asm.toolDisposer = () => { try { typeof re === 'function' ? re() : re?.dispose?.() } catch { /* unwind */ } }
        asm.channelMove = 'disposed-reregistered'
      } catch (error) { record({ leg: 'chan-move-reregister-failed', error: String(error?.message ?? error) }) }
      record({ leg: 'chan-move', before, controlEventsAfter: asm.controlEvents, move: asm.channelMove })
      return line({ ok: true, code: null, rc: null, pid: null, lease: null, stage: 'observation-only', controlEventsBefore: before, controlEventsAfter: asm.controlEvents, move: asm.channelMove, gGnote: 'observation only: provider seam emits no §5 events; no channel-closure claim either way (G-g posture unchanged)' })
    }
    if (mode === 'pty') {
      // A request the frozen C-PROC SpawnRequest cannot express (no PTY arm).
      // The provider would silently DROP it; the wiring refuses it typed FIRST.
      const msg = 'PTY dimension is outside the frozen C-PROC SpawnRequest (no PTY arm exists on this seam; plan §7 keeps PTY full-fidelity unclaimed). A request the seam cannot express is refused typed at the wiring boundary instead of being silently downgraded to a spawn whose real shape differs from the asked one.'
      record({ leg: 'refused-wiring-boundary', mode, tag, code: 'IO_POLICY_UNSUPPORTED' })
      return line({ ok: false, code: 'IO_POLICY_UNSUPPORTED', message: msg, stage: 'wiring-boundary-before-provider', spyDelta: 0, ceDelta: 0, providerTouched: false })
    }
    const instanceLabel = mode === 'missing-pieces' ? 'missing' : mode === 'revoked' ? 'revoked' : 'main'
    const holder = asm.instances[instanceLabel]
    if (holder === null || holder === undefined) return line({ ok: false, code: 'SANDBOX_UNAVAILABLE', rc: null, pid: null, lease: null, stage: 'instance-missing', spyDelta: 0, ceDelta: 0 })
    const before = { runs: holder.counters.runs, ce: holder.counters.confinedExec }
    const scratchBefore = new Set(manifest(SCRATCH))
    let res
    try {
      res = await holder.provider.spawn(spawnRequest(mode, tag))
    } catch (error) {
      return line({ ok: false, code: 'THREW', rc: null, pid: null, lease: null, stage: 'provider-spawn-threw', message: String(error?.message ?? error).slice(0, 400), spyDelta: holder.counters.runs - before.runs, ceDelta: holder.counters.confinedExec - before.ce })
    }
    const spyDelta = holder.counters.runs - before.runs
    const ceDelta = holder.counters.confinedExec - before.ce
    const newPaths = manifest(SCRATCH).filter((p) => !scratchBefore.has(p))
    const spawnEvidencePaths = newPaths.filter((p) => /(^|\/)plans\//.test(p) || /(^|\/)out\//.test(p))
    if (!res.ok) {
      return line({
        ok: false, code: res.error?.code ?? null, rc: null, pid: null, lease: null, message: String(res.error?.message ?? ''), stage: 'provider-refused',
        spyDelta, ceDelta, spawnEvidencePaths, abiAnswer: holder.abiAnswers[holder.abiAnswers.length - 1] ?? null,
      })
    }
    const { receipt, output, lease } = res.value
    const answer = holder.execAnswers[holder.execAnswers.length - 1] ?? null
    const allowContent = (() => { try { return readFileSync(join(FIXTURES, 'allow', 'ok.txt'), 'utf8') } catch { return '' } })()
    const secretContent = (() => { try { return readFileSync(join(FIXTURES, 'private', 'secret.txt'), 'utf8') } catch { return '' } })()
    return line({
      ok: true, code: null, stage: 'provider-executed',
      rc: answer?.rc ?? null, pid: answer?.pid ?? null, launcherRc: answer?.launcherRc ?? null,
      lease: lease.status, receiptPid: receipt.processIdentity,
      outRefExists: answer?.outRef !== null && existsSync(String(answer?.outRef ?? '')),
      errRefExists: answer?.errRef !== null && existsSync(String(answer?.errRef ?? '')),
      stdoutHead: output.stdout.slice(0, 120), stderrHead: output.stderr.slice(0, 200),
      stdoutMatch: mode === 'supported' ? output.stdout.trim() === allowContent.trim() : undefined,
      stderrEACCES: /Permission denied|EACCES/i.test(output.stderr),
      secretLeaked: secretContent.trim().length > 0 && (output.stdout.includes(secretContent.trim().slice(0, 16)) || output.stderr.includes(secretContent.trim().slice(0, 16))),
      spyDelta, ceDelta, spawnEvidencePaths, newPathsCount: newPaths.length,
    })
  }

  ctx.effect?.(() => {
    for (const asm of assemblies.values()) {
      for (const d of asm.disposers.splice(0)) { try { d() } catch { /* scope unwind covers it */ } }
    }
  }, 'a5w4-provider-row')
  record({ leg: 'apply-done' })
}
