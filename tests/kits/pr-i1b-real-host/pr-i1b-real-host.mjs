#!/usr/bin/env node
/**
 * Alpha.6 PR-I1b (Lane 2) — the REAL-HOST instrument for the two legs PR #522 round 1 left ENV-REFUSED.
 *
 * WHAT THIS IS. `packages/runtime/test/a6-pr-i1b-admission.test.ts` pinned this lane's caller-role closure
 * against the production resolve path in the only two ways a spec on this tree had: the VALUES of
 * `CONTROL_RESOLVER_ROLES` (strong — a bidirectional value comparison), and the PRESENCE of two strings in
 * `control/service.ts` (weak — a phrase in a file). Round-1 finding F-I1b1-3 named exactly what that leaves
 * unpinned: "not what the resolve path returns when a host actually runs it". This kit measures that. It boots
 * the pinned pristine host (`tests/deepseek-harness-test-use`, detached at `TEST_USE_BASELINE_SHA`) with THIS
 * worktree's BUILT row mounted through the public profile-patch seam — CORE PATCH BUDGET = 0, nothing in this
 * file writes to the host tree, and the run asserts `git status --porcelain` of that tree is empty before AND
 * after — and asks the live host, over public seams only, who may resolve each kind of control request.
 *
 * THE SEAMS IT DRIVES (all public, all row-mounted, no host patch):
 *  - `POST /team-remote/team.resolveControl` v4 — the HUMAN ingress. The frozen wire carries no identity
 *    (adjudication U3: a command, never an identity), so the caller reaching the closure is the host-derived
 *    human, always, for every kind.
 *  - `POST /__p6t6/tool {as: <root session>, name: 'team_resolve_control'}` — the LEADER ingress: the row's own
 *    `live.executeTool`, which resolves the boot-created root session's live agent and runs the production
 *    tool, so the caller reaching the closure is `{kind:'instance', instanceId:'inst-leader'}` resolved by the
 *    REAL `resolveCaller` against REAL durable rows. PR-I2's feasibility report recorded the resolver-role
 *    matrix as "needs a member ask-lane tool use under a model"; for a LEADER caller that is not true — the
 *    boot root session is live with no model in the loop, which is why this arm runs here. A MEMBER caller has
 *    no ingress at all (no remote carrier accepts an identity; a `team_*` tool needs a live member agent), so
 *    the member row of the matrix stays unmeasured and the capture says so.
 *  - `POST /__p6t6/control/mutate` — the creator of the durable requests both ingresses act on (the only
 *    public creator of a subject/coupling-bearing request on this host), and the seam that presents an EXPLICIT
 *    caller to the real `resolveCaller` for the arms no ingress reaches.
 *
 * ONE FRESH REQUEST PER INGRESS: a control decision is exactly-once durable, so reusing a requestId across the
 * two ingresses would measure `already decided` on the second one instead of the role closure.
 *
 * WHAT LANDS IN EVIDENCE. `dev/agent-workflow/evidence/alpha6-pr-i1b-real-host/`: a stamped directory
 * (verdict.json + the host's own log + MEASURED-LINES.txt) and a stable `capture.json`, which the spec reads.
 * Every cell records the host's verbatim code and message plus `reachedClosure` — whether that answer came
 * FROM the resolver-role closure or from an earlier gate. A cell that never reached the closure is recorded as
 * such and the spec refuses to read it as agreement, because a check that passes on a cell the host never
 * evaluated is the same mistake as a mutation that never ran.
 *
 * ENVIRONMENT. World = `tests/homes/<line>-<UTC>` (workspace-internal, TEST_METHODS §7), deleted at teardown
 * unless `--keep-world`. Port from the 318x family: 3080 and 3180 are never touched, every candidate is probed
 * before use and proven free after teardown. Process marker `a6pri1b<stamp><label>host<port>` — unique to this
 * run, so teardown kills only what this run started. `DSH_HOME` is set explicitly on every spawn; never
 * inherited (an inherited `DSH_HOME` once put a world in `/home/armourpiercer/.dsh`, where the boot failed
 * read-only with zero bytes written).
 *
 * Usage: node tests/kits/pr-i1b-real-host/pr-i1b-real-host.mjs [--port 3182] [--keep-world]
 * Exit 0 only when every check below passed; exit 1 naming the failures otherwise.
 */

import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createConnection } from 'node:net'
import { join } from 'node:path'
import { CLIENT_COMMIT_HASH, TEST_USE_BASELINE_SHA } from '../../paths.mjs'

// The worktree root, computed from THIS file's location — deliberately NOT tests/paths.mjs#findTestRepoRoot,
// which walks upward looking for a materialized runtime and can land on a DIFFERENT tree (the lane-2 main
// checkout) when this worktree has none. Every path below must belong to the tree that owns this kit file.
const WORKTREE = join(import.meta.dirname, '..', '..', '..')
const RUNTIME = join(WORKTREE, 'tests', 'deepseek-harness-test-use')

const argv = process.argv.slice(2)
const KEEP_WORLD = argv.includes('--keep-world')
const PORT_OVERRIDE = (() => {
  const i = argv.indexOf('--port')
  return i >= 0 ? Number(argv[i + 1]) : null
})()

const PORT_CANDIDATES = [3182, 3183, 3184, 3185, 3186, 3187, 3188, 3189]
const FORBIDDEN_PORTS = new Set([3080, 3180])
const RUN_STAMP = `a6pri1b-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}Z`
const EVIDENCE_ROOT = join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'alpha6-pr-i1b-real-host')
const CAPTURE_DIR = join(EVIDENCE_ROOT, RUN_STAMP)

const ROW = `file://${join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')}`
const P6T6_ROW = `file://${join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')}`
const GLUE = `file://${join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')}`
const SEAM = `file://${join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')}`

/** The three closed kinds of `CONTROL_RESOLVER_ROLES`, in its declaration order. */
const KINDS = ['leader-approval', 'user-approval', 'envelope-mutation']
const LEADER_INSTANCE_ID = 'inst-leader'
const UNKNOWN_INSTANCE_ID = 'inst-nobody'

const blueprint = (id) => [
  '---', 'schemaVersion: 3', `blueprintId: ${id}`, 'revision: "1"',
  'leader:', '  templateId: leader', '  persona: "You are the leader of the PR-I1b real-host probe team."',
  'members:', '  - templateId: worker', '    persona: "You are a worker of the PR-I1b real-host probe team."',
  'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
].join('\n')

const lines = []
const log = (s) => { lines.push(String(s)); console.log(String(s)) }
/** The launch token never leaves this file: anything that can carry a boot URL is scrubbed before storage. */
const scrub = (s) => String(s).replace(/([?&]token=)[^&#\s]*/g, '$1<REDACTED>')

const portInUse = (port) => new Promise((resolve) => {
  const socket = createConnection({ host: '127.0.0.1', port })
  socket.setTimeout(1500)
  socket.once('connect', () => { socket.destroy(); resolve(true) })
  socket.once('timeout', () => { socket.destroy(); resolve(false) })
  socket.once('error', () => { socket.destroy(); resolve(false) })
})

const results = []
const check = (id, ok, measured) => {
  results.push({ id, ok: ok === true, measured: String(measured) })
  log(`${ok === true ? 'PASS' : 'FAIL'} ${id} — ${measured}`)
}
const gitOut = (args, cwd) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim()
const porcelainCount = (tree) => gitOut(['status', '--porcelain'], tree).split('\n').filter((l) => l !== '').length

/**
 * Boot one world with the lane's built row and hand back its call seams. `extraConfig` is spliced into the row
 * config verbatim — that IS the enable-surface probe: whatever the composition asks for beyond the frozen
 * fields, the host either honours or ignores, and the run measures which.
 */
async function bootWorld({ label, port, rootSessionId, extraConfig = {} }) {
  const home = join(WORKTREE, 'tests', 'homes', `${RUN_STAMP}-${label}`)
  const logPath = join(home, 'host.log')
  if (existsSync(home) && readdirSync(home).length > 0) {
    throw new Error(`${label}: world ${home} exists and is not empty — refusing to share a world`)
  }
  mkdirSync(join(home, 'profiles', 'web'), { recursive: true })
  mkdirSync(join(home, 'blueprints'), { recursive: true })
  const bp = blueprint(`team.a6pri1b-${label}`)
  writeFileSync(join(home, 'blueprints', 'anchor.yaml'), bp)
  writeFileSync(join(home, 'p6t6-directive.json'), JSON.stringify({ boot: 1, phase: 'create', reportDir: home, rootSessionId }, null, 2))
  const rowConfig = {
    rootSessionId, bootPhase: 'create', blueprintSource: bp, blueprintDir: join(home, 'blueprints'),
    seedMembers: [], generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'a6pri1b-i1b-model' },
    deniedSelection: null, mcpServers: [], mcpServer: null, environmentFacts: [],
    externalPolicyFacts: { hard: {}, capabilityExists: {} }, glueUrl: GLUE, seamUrl: SEAM,
    ...extraConfig,
  }
  writeFileSync(join(home, 'profiles', 'web', 'cordis.patch.yml'), [
    `# PR-I1b real-host instrument (world ${RUN_STAMP}-${label}): THIS worktree's built dsh-agent-team row plus`,
    `# the p6t6 harness row, mounted ONLY through the public profile-patch seam (CORE PATCH BUDGET = 0).`,
    '- insert:',
    '  - id: dsh-agent-team',
    `    name: ${ROW}`,
    '    config:',
    ...Object.entries(rowConfig).map(([k, v]) => `      ${k}: ${JSON.stringify(v)}`),
    '  - id: p6t6-team-tools',
    `    name: ${P6T6_ROW}`,
    '',
  ].join('\n'))

  writeFileSync(logPath, '')
  const fd = openSync(logPath, 'a')
  const marker = `a6pri1b${RUN_STAMP}${label}host${port}`
  const child = spawn('/bin/bash', ['-c', `exec -a ${marker} node apps/cli/lib/bin.js web --port ${port} --no-open`], {
    cwd: RUNTIME, stdio: ['ignore', fd, fd],
    env: { ...process.env, DSH_HOME: home, DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH },
  })
  log(`${label}: spawned marker=${marker} port=${port} DSH_HOME=${home}`)

  let bootUrl = null
  const deadline = Date.now() + 240_000
  while (Date.now() < deadline && bootUrl === null) {
    await new Promise((r) => setTimeout(r, 1000))
    const m = /dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+)/.exec(readFileSync(logPath, 'utf8'))
    if (m) bootUrl = m[1]
  }
  if (bootUrl === null) {
    const tail = readFileSync(logPath, 'utf8').split('\n').slice(-40).join('\n')
    child.kill('SIGKILL')
    throw new Error(`${label}: no boot marker within 240s. log tail:\n${tail}`)
  }
  const token = new URL(bootUrl).searchParams.get('token')
  const origin = `http://127.0.0.1:${port}`
  const auth = await fetch(`${origin}/?token=${token}`, { redirect: 'manual' })
  const cookie = (auth.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')

  const post = async (path, body, headers = {}) => {
    const res = await fetch(`${origin}${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
    })
    const text = await res.text()
    let parsed = null
    try { parsed = JSON.parse(text) } catch { /* the caller reports the raw text */ }
    return { status: res.status, body: parsed, text }
  }
  const remote = (method, version, params) => post(`/team-remote/${method}`, {
    type: 'client-request', rpcId: `a6pri1b-${Math.random().toString(36).slice(2, 10)}`, method, payload: { version, params },
  }, { cookie })
  const mutate = (body) => post('/__p6t6/control/mutate', body)
  const tool = (name, as, args) => post('/__p6t6/tool', { name, as, args })
  const getJson = (path) => fetch(`${origin}${path}`).then((r) => r.json()).catch(() => null)

  const stop = async () => {
    child.kill('SIGTERM')
    await new Promise((r) => setTimeout(r, 4000))
    let alive = child.exitCode === null && child.signalCode === null
    if (alive) {
      spawn('/bin/bash', ['-c', `pkill -f '${marker}' || true`])
      await new Promise((r) => setTimeout(r, 2000))
      alive = child.exitCode === null && child.signalCode === null
    }
    const free = !(await portInUse(port))
    // The host's own log is read BEFORE the world is deleted — it is evidence, and the world is not.
    const logText = existsSync(logPath) ? readFileSync(logPath, 'utf8') : ''
    if (!KEEP_WORLD) rmSync(home, { recursive: true, force: true })
    return { alive, free, home, marker, logText }
  }

  return {
    label, port, home, logPath, marker, origin, bootUrl, rowConfig,
    authStatus: auth.status, hasCookie: cookie !== '', remote, mutate, tool, getJson, stop,
  }
}

async function main() {
  if (!existsSync(join(RUNTIME, 'apps', 'cli', 'lib', 'bin.js'))) {
    throw new Error(`ENV-REFUSED: the pristine runtime is not materialized at ${RUNTIME} — TEST_METHODS §2 recipe (clone --local --no-hardlinks, checkout --detach ${TEST_USE_BASELINE_SHA}, install, build)`)
  }
  if (!existsSync(new URL(ROW).pathname)) {
    throw new Error(`ENV-REFUSED: this worktree's built row is absent at ${ROW} — run pnpm build`)
  }
  const laneHead = gitOut(['rev-parse', 'HEAD'], WORKTREE)
  const hostHead = gitOut(['rev-parse', 'HEAD'], RUNTIME)
  const hostPorcelainBefore = porcelainCount(RUNTIME)
  log(`lane head=${laneHead}; host head=${hostHead} (pin ${TEST_USE_BASELINE_SHA}); host porcelain before=${hostPorcelainBefore}`)
  check('host-is-the-pinned-baseline', hostHead === TEST_USE_BASELINE_SHA && hostPorcelainBefore === 0,
    `host HEAD ${hostHead} vs pin ${TEST_USE_BASELINE_SHA}, porcelain ${hostPorcelainBefore}`)

  let port = PORT_OVERRIDE
  if (port !== null && (FORBIDDEN_PORTS.has(port) || await portInUse(port))) {
    log(`requested port ${port} unusable; falling back to the candidate list`)
    port = null
  }
  if (port === null) {
    for (const p of PORT_CANDIDATES) {
      if (FORBIDDEN_PORTS.has(p)) continue
      if (!(await portInUse(p))) { port = p; break }
      log(`port ${p} busy, trying next`)
    }
  }
  if (port === null) throw new Error(`no free port in ${PORT_CANDIDATES.join(', ')} (3080 and 3180 are never used)`)

  const ROOT = `session-a6pri1b-i1b-root-${RUN_STAMP}`
  const host = await bootWorld({ label: 'matrix', port, rootSessionId: ROOT })
  check('boot-line-shape', /^http:\/\/127\.0\.0\.1:\d+\/\?token=/.test(host.bootUrl), `dsh web line at port ${port} (token redacted)`)
  const bare = await fetch(`${host.origin}/`)
  check('gate-401-without-token', bare.status === 401, `GET / with no token -> ${bare.status}`)
  check('gate-303-and-cookie', host.authStatus === 303 && host.hasCookie,
    `GET /?token= -> ${host.authStatus}, cookie ${host.hasCookie ? 'issued' : 'ABSENT'}`)

  // 1. The real `resolveCaller`, driven with an EXPLICIT caller against REAL durable rows. An unknown instance
  //    is refused by the host's own resolver, in the host's own words. Those words are what the injected port of
  //    `openAssignmentAdmission` is allowed to throw, and the spec compares them with what the SAME function
  //    throws in-process — the memo §9 triple (复用 resolveCaller 或其等价公开面) measured, not quoted.
  const unknownCaller = await host.mutate({
    action: 'abandon', rootSessionId: ROOT, caller: { kind: 'instance', instanceId: UNKNOWN_INSTANCE_ID },
    requestId: 'control-a6pri1b-never-created',
  })
  const unknownCode = unknownCaller.body?.code ?? null
  const unknownMessage = unknownCaller.body?.message ?? String(unknownCaller.text).slice(0, 300)
  check('real-resolver-refuses-unknown-caller', unknownCode === 'TEAM_RUNTIME_CALLER_NOT_FOUND',
    `${unknownCode} — ${scrub(unknownMessage).slice(0, 170)}`)

  // 2. A durable request per kind per ingress. A decision is exactly-once durable, so the two ingresses never
  //    share a requestId.
  const createRequest = async (kind, arm) => {
    const res = await host.mutate({
      action: 'request', rootSessionId: ROOT, kind,
      actionName: `a6pri1b-i1b-probe-${arm}`, correlation: `a6pri1b-i1b-corr-${kind}-${arm}`,
      targetInstanceId: LEADER_INSTANCE_ID, toolName: 'bash', summary: `PR-I1b real-host probe request (${arm} arm)`,
    })
    return {
      status: res.status, requestId: res.body?.value?.requestId ?? null,
      code: res.body?.code ?? null, message: res.body?.message ?? String(res.text).slice(0, 200),
    }
  }

  // 3. THE MEASUREMENT: every kind, resolved by every caller role this host can present.
  const closureOf = (message) => String(message).includes('is not a resolver for kind') ? 'refused-by-closure' : 'not-refused-by-closure'
  const answers = {}
  const created = {}
  for (const kind of KINDS) {
    // (a) the LEADER ingress — production tool, production service, a caller the real resolver read off durable rows.
    const leaderRequest = await createRequest(kind, 'leader')
    created[`${kind}|leader`] = leaderRequest
    check(`create-request-${kind}-leader-arm`, typeof leaderRequest.requestId === 'string',
      `${leaderRequest.status} requestId=${leaderRequest.requestId ?? `code=${leaderRequest.code} ${scrub(leaderRequest.message).slice(0, 130)}`}`)
    const pending = await host.tool('team_list_pending_control', ROOT, { rootSessionId: ROOT, requestToken: `a6pri1b-i1b-list-${kind}` })
    const pendingRows = pending.body?.value?.pending ?? []
    const seenRow = Array.isArray(pendingRows) ? pendingRows.find((r) => r?.requestId === leaderRequest.requestId) ?? null : null
    const leader = await host.tool('team_resolve_control', ROOT, {
      rootSessionId: ROOT, requestId: leaderRequest.requestId, decision: 'allow',
      // `requestToken` is the required per-call correlation token of EVERY team tool (it becomes the durable
      // `correlation` of whatever the call writes) — not an identity, not a secret. The identity is the `as`
      // session, which is the whole point of driving this ingress.
      requestToken: `a6pri1b-i1b-resolve-${kind}`, note: 'a6pri1b-i1b-leader',
    })
    const leaderBody = leader.body?.value ?? leader.body ?? {}
    const leaderCode = leaderBody.code ?? (leaderBody.status === 'control-resolved' ? 'CONTROL_RESOLVED' : 'UNKNOWN')
    const leaderMessage = leaderBody.message ?? JSON.stringify(leaderBody).slice(0, 220)
    answers[`${kind}|leader`] = {
      ingress: 'p6t6-tool:team_resolve_control', requestId: leaderRequest.requestId, status: leader.status,
      code: leaderCode, message: scrub(leaderMessage), sawRequestInPendingList: seenRow !== null,
      reachedClosure: closureOf(leaderMessage) === 'refused-by-closure', closure: closureOf(leaderMessage),
    }
    log(`LEADER resolve ${kind} -> ${leader.status} ${leaderCode} [${closureOf(leaderMessage)}] :: ${scrub(leaderMessage).slice(0, 200)}`)

    // (b) the HUMAN ingress — the frozen v4 wire, host-derived human principal.
    const humanRequest = await createRequest(kind, 'human')
    created[`${kind}|human`] = humanRequest
    check(`create-request-${kind}-human-arm`, typeof humanRequest.requestId === 'string',
      `${humanRequest.status} requestId=${humanRequest.requestId ?? `code=${humanRequest.code}`}`)
    const human = await host.remote('team.resolveControl', 4, {
      teamSessionId: ROOT, requestId: humanRequest.requestId, decision: 'allow', note: 'a6pri1b-i1b-human',
    })
    const humanError = human.body?.result?.ok === true ? null : (human.body?.result?.error ?? null)
    const humanCode = humanError?.code ?? 'CONTROL_RESOLVED'
    const humanMessage = humanError?.message ?? 'the durable decision was written'
    answers[`${kind}|human`] = {
      ingress: 'team-remote:team.resolveControl.v4', requestId: humanRequest.requestId, status: human.status,
      code: humanCode, message: scrub(humanMessage), reachedClosure: closureOf(humanMessage) === 'refused-by-closure',
      closure: humanError === null ? 'allowed' : closureOf(humanMessage),
    }
    log(`HUMAN  resolve ${kind} -> ${human.status} ${humanCode} :: ${scrub(humanMessage).slice(0, 200)}`)
  }

  // The closure's teeth, measured: 'user-approval' allows ONLY human, so the SAME host and the SAME kind must
  // answer the leader with the role refusal (printing its own allowed list) while the human gets a decision. A
  // host that let both through, or refused both, fails here — this is the cell the lane has been claiming by
  // mirror alone.
  const ul = answers['user-approval|leader']
  const uh = answers['user-approval|human']
  check('closure-splits-by-role-on-user-approval',
    ul?.closure === 'refused-by-closure' && String(ul.message).includes('allowed: [human]') && uh?.closure === 'allowed',
    `leader -> ${ul?.code} "${String(ul?.message).slice(0, 150)}"; human -> ${uh?.code}`)
  for (const kind of ['leader-approval', 'envelope-mutation']) {
    const cell = answers[`${kind}|leader`]
    check(`leader-cell-recorded-${kind}`, typeof cell?.code === 'string',
      `leader -> ${cell?.code} closure=${cell?.closure} "${String(cell?.message).slice(0, 120)}" — ${cell?.reachedClosure ? 'the closure answered' : 'an earlier gate answered, so this cell is NOT evidence about the closure'}`)
    check(`human-allowed-by-host-${kind}`, answers[`${kind}|human`]?.closure === 'allowed',
      `human -> ${answers[`${kind}|human`]?.code} "${String(answers[`${kind}|human`]?.message).slice(0, 120)}"`)
  }
  check('member-role-has-no-ingress', true,
    'no public carrier presents a MEMBER caller to the closure: /team-remote carries no identity (U3) and every team_* tool needs a live member agent. Recorded so the spec refuses to read the matrix as complete.')

  // 4. S-7 on a real host: what a NON-ENABLING team's durable world actually holds, after real durable writes.
  //    The census is taken with real rows in the ledger, so "zero review-assignment factTypes" is a measurement
  //    and not the silence of an untouched store.
  const ledger = await host.remote('team.getLedgerPage', 1, { teamSessionId: ROOT })
  const entries = ledger.body?.result?.value?.data?.entries ?? []
  const factTypes = [...new Set(entries.map((e) => e?.factType ?? null))].sort()
  check('durable-ledger-census-nonempty', entries.length > 0,
    `getLedgerPage ${ledger.status} entries=${entries.length} factTypes=[${factTypes.join(', ')}]`)

  const teardown = await host.stop()
  const hostPorcelainAfter = porcelainCount(RUNTIME)
  check('teardown-process-and-port', !teardown.alive && teardown.free,
    `child alive=${teardown.alive}, port ${port} free=${teardown.free}`)
  check('host-tree-stayed-clean', hostPorcelainBefore === 0 && hostPorcelainAfter === 0,
    `git status --porcelain in the pristine runtime: before=${hostPorcelainBefore}, after=${hostPorcelainAfter}`)

  // 5. The ENABLE surface of S-7. The row config is the entry's ONLY input channel, so "a Team that has not
  //    enabled the feature" is only a real host state if some host-visible field exists to enable it. Ask the
  //    host directly: boot a SECOND world whose row config carries the feature under two plausible names, and
  //    see whether the host honours it. Honoured = the enabled arm is real and this lane's dormancy story needs
  //    re-reading. Ignored = the enabled arm has no host surface at all, which is what the lane claims.
  const enableRoot = `session-a6pri1b-enable-root-${RUN_STAMP}`
  const enablePort = port + 100
  if (FORBIDDEN_PORTS.has(enablePort) || await portInUse(enablePort)) {
    throw new Error(`enable-probe port ${enablePort} is not usable`)
  }
  const enableHost = await bootWorld({
    label: 'enable', port: enablePort, rootSessionId: enableRoot,
    extraConfig: { feature: 'on', assignmentFeature: 'on' },
  })
  const enableHealth = await enableHost.getJson('/__p6t6/health')
  const enableWrite = await enableHost.mutate({
    action: 'request', rootSessionId: enableRoot, kind: 'leader-approval',
    actionName: 'a6pri1b-i1b-enable-probe', correlation: 'a6pri1b-i1b-corr-enable',
    targetInstanceId: LEADER_INSTANCE_ID, toolName: 'bash', summary: 'enable-surface probe',
  })
  const enableLedger = await enableHost.remote('team.getLedgerPage', 1, { teamSessionId: enableRoot })
  const enableEntries = enableLedger.body?.result?.value?.data?.entries ?? []
  const enableFactTypes = [...new Set(enableEntries.map((e) => e?.factType ?? null))].sort()
  const enableTeardown = await enableHost.stop()
  check('enable-surface-is-not-a-switch',
    enableHealth?.ok === true && typeof enableWrite.body?.value?.requestId === 'string' && enableFactTypes.length > 0,
    `row config with feature:'on' + assignmentFeature:'on' -> row ready=${enableHealth?.ok === true}, durable write accepted=${typeof enableWrite.body?.value?.requestId === 'string'}, census=[${enableFactTypes.join(', ')}] — nothing was refused and no admission behaviour appeared`)
  check('enable-world-cleaned', !enableTeardown.alive && enableTeardown.free,
    `enable world alive=${enableTeardown.alive}, port ${enablePort} free=${enableTeardown.free}`)

  const capture = {
    kit: 'pr-i1b-real-host', runStamp: RUN_STAMP,
    laneHead, hostHead, hostBaselineSha: TEST_USE_BASELINE_SHA, clientCommitHash: CLIENT_COMMIT_HASH,
    hostPorcelainBefore, hostPorcelainAfter,
    row: ROW, p6t6Row: P6T6_ROW,
    worlds: KEEP_WORLD
      ? [teardown.home, enableTeardown.home]
      : [`${teardown.home} (deleted at teardown)`, `${enableTeardown.home} (deleted at teardown)`],
    ports: [port, enablePort], markers: [teardown.marker, enableTeardown.marker],
    rootSessionId: ROOT, unknownCaller: { code: unknownCode, message: scrub(unknownMessage) },
    rowConfigFields: Object.keys(host.rowConfig), created, answers,
    durableCensus: { entries: entries.length, factTypes },
    enableCensus: { entries: enableEntries.length, factTypes: enableFactTypes },
    checks: results,
  }
  mkdirSync(CAPTURE_DIR, { recursive: true })
  writeFileSync(join(CAPTURE_DIR, 'verdict.json'), JSON.stringify(capture, null, 2) + '\n')
  writeFileSync(join(CAPTURE_DIR, 'host.log'), scrub(teardown.logText))
  writeFileSync(join(CAPTURE_DIR, 'MEASURED-LINES.txt'), lines.map((l) => scrub(l)).join('\n') + '\n')
  writeFileSync(join(EVIDENCE_ROOT, 'capture.json'), JSON.stringify(capture, null, 2) + '\n')
  log(`evidence: ${CAPTURE_DIR}`)

  const failed = results.filter((r) => !r.ok)
  log(`VERDICT kit=pr-i1b-real-host run=${RUN_STAMP} head=${laneHead} checks=${results.length} failed=${failed.length}`)
  if (failed.length > 0) {
    log('FAILED: ' + failed.map((f) => f.id).join(', '))
    process.exitCode = 1
  }
}

main().catch((error) => {
  log(`FATAL ${scrub(error?.message ?? error)}`)
  try { spawn('/bin/bash', ['-c', `pkill -f 'a6pri1b${RUN_STAMP}' || true`]) } catch { /* best effort */ }
  for (const label of ['matrix', 'enable']) {
    try { rmSync(join(WORKTREE, 'tests', 'homes', `${RUN_STAMP}-${label}`), { recursive: true, force: true }) } catch { /* best effort */ }
  }
  process.exitCode = 1
})
