#!/usr/bin/env node
/**
 * run-jobs-abort-live.mjs — #349 merge-release LIVE receipts for the FOUR
 * jobs abort boundaries, re-issued AT THE EXACT HEAD 515b3805 (2026-10-20
 * batch; the earlier live round rode a0187704, and live receipts must ride
 * the exact head to count). Reviewer-executed; run by the #349 auditor.
 *
 * Shape (inherited verbatim from the proven run-a5jobs-live.mjs kit):
 *  - boots the REAL pristine host (@639ed01539, HEAD+porcelain verified
 *    before AND after) on its OWN port (canonical family, :3080/:3180 probed
 *    read-only before/after and never touched), on its OWN DSH_HOME under
 *    tests/homes (swept at teardown unless --keep);
 *  - mounts the PRODUCTION row + production glue + jobsEnabled plane through
 *    the PUBLIC profile-patch seam only (the jobs-era world of the C3 kit),
 *    plus the batch's probe row (probe-jobs-abort-row.mjs) which runs the
 *    four boundaries against the REAL bridge (committed dist), the REAL
 *    assembly (committed dist) and the host's REAL jobs registry, with REAL
 *    spawned-process jobs and process-level unhandledRejection /
 *    uncaughtException collectors (zero-hit asserted);
 *  - mock model ONLY (no real model anywhere); boot tokens redacted at
 *    capture; every receipt is machine JSON.
 *
 * Exit: 0 all criteria green; 2 any red; 1 fatal.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync, closeSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const HERE = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(HERE, '..', '..', '..', '..', '..', '..', '..')
const PATHS = await import(pathToFileURL(join(WORKTREE, 'tests', 'paths.mjs')).href)
const { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH, homeDir, testUseTree, findTestRepoRoot, isSanctionedTestPort } = PATHS
const { startMockModel } = await import(pathToFileURL(join(WORKTREE, 'packages', 'tools', 'harness', 'mock-deepseek.mjs')).href)

const TESTUSE = testUseTree(findTestRepoRoot(WORKTREE) ?? WORKTREE)
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const DIST_RUNTIME = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const PRODUCTION_ROW_NAME = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'host.js')).href
const GLUE_URL = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
const SEAM_URL = pathToFileURL(join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
const P6T6_ROW_NAME = pathToFileURL(join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')).href
const PROBE_ROW_NAME = pathToFileURL(join(HERE, 'probe-jobs-abort-row.mjs')).href

const argv = process.argv.slice(2)
const FLAG_KEEP = argv.includes('--keep')
const argValue = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1] }
const HOST_PORT = Number(argValue('host-port', 3186))
const MOCK_PORT = Number(argValue('mock-port', 3496))

const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const RUN_DIR = join(HERE, `live-${RUN_STAMP}`)
const SMOKE_PRESET_ID = 'rc2-smoke'
const BP_ANCHOR_ID = 'team.a5jobs-anchor'
const MK = `A5ABORT_${RUN_STAMP.replace(/[^A-Za-z0-9]/g, '')}`

const criteria = []
const redact = (t) => String(t).split(MK).join('MK').replace(/([?&]token=)[A-Za-z0-9_-]+/g, '$1REDACTED')
function log(line) { const s = redact(line); process.stdout.write(s + '\n'); try { writeFileSync(join(RUN_DIR, 'run.log'), s + '\n', { flag: 'a' }) } catch { /* pre-dir */ } }
function check(id, name, ok, detail) { criteria.push({ id, name, ok: ok === true, detail: redact(String(detail ?? '')).slice(0, 500) }); log(`${ok === true ? 'PASS' : 'FAIL'} ${id} — ${name}${detail !== undefined ? ` (${redact(String(detail)).slice(0, 300)})` : ''}`) }
function writeEvidence(name, content) { writeFileSync(join(RUN_DIR, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2)) }
function dieFatal(msg, code = 1) { log(`FATAL ${msg}`); try { writeEvidence('summary.json', { runStamp: RUN_STAMP, fatal: redact(msg), criteria }) } catch { /* dir gone */ } process.exit(code) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitFor(timeoutMs, probe, label) { const end = Date.now() + timeoutMs; for (;;) { const v = await Promise.resolve().then(probe).catch(() => false); if (v !== false && v !== null) return v; if (Date.now() > end) throw new Error(`timeout waiting for ${label}`); await sleep(500) } }
async function portFree(port) { const net = await import('node:net'); return new Promise((done) => { const s = net.createServer(); s.once('error', () => done(false)); s.once('listening', () => s.close(() => done(true))); s.listen(port, '127.0.0.1') }) }
async function probeStable(url) { const res = await fetch(url, { signal: AbortSignal.timeout(5_000) }).catch(() => null); return { url, status: res === null ? 'unreachable' : res.status } }
async function authenticate(origin, token) { const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) }); const c = res.headers.get('set-cookie'); if (res.status !== 303 || c === null) throw new Error(`auth HTTP ${res.status}`); return c.split(';', 1)[0] }
function dfNow() { const r = spawnSync('df', ['-k', '/srv'], { encoding: 'utf8' }).stdout ?? spawnSync('df', ['-k'], { encoding: 'utf8' }).stdout ?? ''; return r.trim() }
function testUseState() {
  const rev = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: TESTUSE, encoding: 'utf8' }).stdout?.trim()
  const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: TESTUSE, encoding: 'utf8' }).stdout?.trim()
  return { rev, dirty }
}
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/

// ── the world patch (public seam only; jobs era of the C3 kit + probe row) ──
function bpAnchorYaml(rootSid) {
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader', `  persona: "You are the leader of the a5jobs-abort boot team. ${MK}_DISC is the discovery marker."`,
    'members:', '  - templateId: worker', '    persona: "You are a worker of the a5jobs-abort boot team."',
    'memberEnvelopes: []', 'requirements: []',
    'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
    'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}
function yamlScalar(v) { if (v === null) return 'null'; if (typeof v === 'number' || typeof v === 'boolean') return String(v); const s = String(v); return /^[A-Za-z0-9._\-/ ]+$/.test(s) && !/^\s|\s$/.test(s) ? s : JSON.stringify(s) }
function yamlEmit(key, value, indent) {
  const pad = '  '.repeat(indent)
  if (Array.isArray(value)) return value.length === 0 ? [`${pad}${key}: []`] : [`${pad}${key}:`, ...value.map((i) => yamlItem(i, indent + 1)).flat()]
  if (value !== null && typeof value === 'object') return Object.keys(value).length === 0 ? [`${pad}${key}: {}`] : [`${pad}${key}:`, ...Object.entries(value).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))]
  return [`${pad}${key}: ${yamlScalar(value)}`]
}
function yamlItem(item, indent) {
  const pad = '  '.repeat(indent)
  if (item === null || typeof item !== 'object') return [`${pad}- ${yamlScalar(item)}`]
  const entries = Object.entries(item)
  const [fk, fv] = entries[0]
  const first = yamlEmit(fk, fv, indent + 1)
  return [`${pad}- ${first[0].slice((indent + 1) * 2)}`, ...first.slice(1), ...entries.slice(1).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))]
}
function writePatchFile(home, blueprintDir, rootSid) {
  mkdirSync(join(home, 'profiles', 'web'), { recursive: true })
  const cfg = {
    rootSessionId: rootSid, bootPhase: 'create',
    blueprintSource: bpAnchorYaml(rootSid), blueprintDir,
    rootPresetId: SMOKE_PRESET_ID, memberPresetId: SMOKE_PRESET_ID,
    seedMembers: [], generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'a5jobs-abort-model' },
    deniedSelection: null, mcpServers: [], mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: GLUE_URL, seamUrl: SEAM_URL,
    teamToolPlane: { realmId: `a5abort-realm-${RUN_STAMP.slice(0, 10)}`, jobsEnabled: true },
  }
  const { presetDeclarationRow, smokePresetPlugins } = await0()
  const lines = [
    `# a5jobs abort-live patch (run ${RUN_STAMP}): production row + jobsEnabled plane + p6t6 observability + probe row + smoke preset — public profile-patch seam only.`,
    '- insert:',
    ...yamlItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: cfg }, 2),
    ...yamlItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    ...yamlItem({ id: 'a5jobs-jobs-abort-probe', name: PROBE_ROW_NAME }, 2),
    ...yamlItem(presetDeclarationRow({
      id: SMOKE_PRESET_ID, displayName: 'a5jobs abort live',
      description: `a5jobs abort live preset (run ${RUN_STAMP}); mounted through the public profile-patch seam.`,
      plugins: smokePresetPlugins({
        personaText: 'You are a coding agent powered by the {{model}} model.',
        cwdSuffix: 'Your working directory is {{cwd}}.',
        bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
      }),
    }), 2),
    '',
  ]
  writeFileSync(join(home, 'profiles', 'web', 'cordis.patch.yml'), lines.join('\n'))
}
// tiny sync access shim (top-level await import already happened above)
let SHARED = null
function await0() { return SHARED }

async function main() {
  mkdirSync(RUN_DIR, { recursive: true })
  SHARED = await import(pathToFileURL(join(WORKTREE, 'tests', 'kits', '_shared', 'preset-seam.mjs')).href)
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: WORKTREE, encoding: 'utf8' }).stdout?.trim()
  if (head !== '515b3805b11db9986ced7d0577942e0669ffe5dd') dieFatal(`worktree HEAD is ${head}, not the audited 515b3805…`)
  const tu0 = testUseState()
  if (tu0.rev !== TEST_USE_BASELINE_SHA || (tu0.dirty ?? 'x') !== '') dieFatal(`test-use not pristine: ${JSON.stringify(tu0)}`)
  if (!isSanctionedTestPort(HOST_PORT) || !isSanctionedTestPort(MOCK_PORT)) dieFatal(`ports outside canonical family: ${HOST_PORT}/${MOCK_PORT}`)
  if (!(await portFree(HOST_PORT))) dieFatal(`host port ${HOST_PORT} not free`)
  if (!(await portFree(MOCK_PORT))) dieFatal(`mock port ${MOCK_PORT} not free`)
  const dfBefore = dfNow(); writeEvidence('df-before.txt', dfBefore)
  const preStable = { p3080: await probeStable('http://127.0.0.1:3080/'), p3180: await probeStable('http://127.0.0.1:3180/') }
  writeEvidence('pre-stable-probe.json', preStable)
  check('A0.0', 'pre-flight: head=515b3805, test-use pristine-at-baseline, sanctioned free ports, df recorded, stable :3080/:3180 probed read-only', true, `ports=${HOST_PORT}/${MOCK_PORT} stable=${JSON.stringify(preStable)}`)

  const mock = await startMockModel({
    port: MOCK_PORT,
    decide: (req) => {
      const first = (req?.messages ?? [])[0]
      const t = typeof first?.content === 'string' ? first.content : String(first?.content?.[0]?.text ?? '')
      if (/^Create a concise title/.test(t) || /^Generate the session title/.test(t)) return { kind: 'text', content: 'a5jobs abort live' }
      return { kind: 'text', content: `${MK}_IDLE` }
    },
    log: (l) => { try { writeFileSync(join(RUN_DIR, 'mock.log'), String(l) + '\n', { flag: 'a' }) } catch { /* best effort */ } },
  })

  const HOME = homeDir(WORKTREE, `a5jobs-abort-${RUN_STAMP}`)
  const WORKSPACE = join(HOME, 'workspace')
  const BLUEPRINT_DIR = join(RUN_DIR, 'blueprints')
  const ROOT = `session-a5abort-root-${RUN_STAMP}`
  const instanceLog = join(RUN_DIR, 'instance.log')
  let child = null
  let receipt = null
  try {
    mkdirSync(WORKSPACE, { recursive: true })
    mkdirSync(BLUEPRINT_DIR, { recursive: true })
    writePatchFile(HOME, BLUEPRINT_DIR, ROOT)
    writeFileSync(join(BLUEPRINT_DIR, 'a5jobs-anchor.yaml'), bpAnchorYaml(ROOT))
    writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({ boot: 1, phase: 'create', reportDir: RUN_DIR, runStamp: RUN_STAMP, rootSessionId: ROOT }, null, 2))
    const outFd = openSync(instanceLog, 'a')
    child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(HOST_PORT), '--no-open'], {
      cwd: WORKSPACE, stdio: ['ignore', outFd, outFd],
      env: {
        ...process.env,
        DSH_HOME: HOME,
        DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
        DEEPSEEK_BASE_URL: `http://127.0.0.1:${mock.port}`,
        DEEPSEEK_API_KEY: 'a5abort-mock-key',
        DSH_A5JOBS_WORKTREE: WORKTREE,
        DSH_A5JOBS_RESULT_DIR: RUN_DIR,
        DSH_A5JOBS_HEAD: head,
        DSH_A5JOBS_STAMP: RUN_STAMP,
      },
    })
    const boot = await waitFor(360_000, () => { try { return BOOT_MARKER.exec(readFileSync(instanceLog, 'utf8')) ?? false } catch { return false } }, 'boot marker')
    const origin = `http://127.0.0.1:${boot[1]}`
    await authenticate(origin, boot[2])
    check('A1.0', 'real pristine host booted on the production row, jobsEnabled plane, probe row (public seam only)', true, `origin=${origin}`)
    await waitFor(180_000, async () => {
      const hb = await fetch(`http://127.0.0.1:${HOST_PORT}/__p6t6/health`, { signal: AbortSignal.timeout(10_000) }).then((r) => r.json().catch(() => null)).catch(() => null)
      if (hb?.ok === false && hb?.setupError !== undefined) throw new Error(`row setup failed: ${String(hb.setupError).slice(0, 500)}`)
      return hb?.ok === true
    }, 'production row health')
    const probeHealth = await waitFor(120_000, async () => {
      const r = await fetch(`http://127.0.0.1:${HOST_PORT}/__a5jobs-abort/health`, { signal: AbortSignal.timeout(10_000) }).then((x) => x.json().catch(() => null)).catch(() => null)
      return r?.ok === true && r?.jobsPresent === true ? r : false
    }, 'probe health with real jobs registry present')
    check('A1.1', 'the probe row is mounted INSIDE the world and the REAL host jobs registry is present (ctx.get(jobs))', true, JSON.stringify(probeHealth))

    const res = await fetch(`http://127.0.0.1:${HOST_PORT}/__a5jobs-abort/run`, { method: 'POST', signal: AbortSignal.timeout(240_000) })
    receipt = await res.json()
    writeEvidence('receipt.json', receipt)
    check('A1.2', 'the four-boundary batch returned a machine receipt (receipt.json)', res.status === 200 && receipt?.legs?.length === 7, `legs=${receipt?.legs?.length} ok=${receipt?.ok}`)
    for (const leg of receipt?.legs ?? []) {
      check(`L:${leg.id}`, `${leg.boundary} — counts=${JSON.stringify(leg.countsDelta)} checks=${JSON.stringify(leg.checks)}`, leg.ok === true, `text=${JSON.stringify(leg.text.slice(0, 200))}`)
    }
    check('A2.0', 'process-level collectors: unhandledRejection=0 AND uncaughtException=0 over the whole batch', (receipt?.collector?.unhandled ?? [1]).length === 0 && (receipt?.collector?.uncaught ?? [1]).length === 0, JSON.stringify(receipt?.collector))
    check('A2.1', 'reap: every REAL spawned job exited (killed through the real svc cancel path)', receipt?.aliveAfter === 0, `reap=${JSON.stringify(receipt?.reap)} aliveAfter=${receipt?.aliveAfter}`)
  } catch (error) {
    check('EX.0', 'the batch completed (a batch-level throw fails the run verbatim)', false, String(error?.stack ?? error).slice(0, 900))
  } finally {
    if (child !== null) { try { child.kill() } catch { /* gone */ } }
    await sleep(2500)
    try { await mock.close() } catch { /* gone */ }
    try {
      const raw = readFileSync(instanceLog, 'utf8')
      writeFileSync(join(RUN_DIR, 'instance.tail.log'), redact(raw.split('\n').slice(-400).join('\n')))
    } catch { /* no log */ }
    if (!FLAG_KEEP) { try { rmSync(HOME, { recursive: true, force: true }) } catch { /* best effort */ } }
    const stragglers = spawnSync('bash', ['-c', `pgrep -af A5ABORT_SPAWNMARK_${RUN_STAMP.replace(/[^A-Za-z0-9]/g, '')} 2>/dev/null | grep -v pgrep || true`], { encoding: 'utf8' }).stdout?.trim() ?? ''
    check('A3.0', 'teardown to zero: world swept, no straggler producer processes', (FLAG_KEEP || !existsSync(HOME)) && stragglers === '', `swept=${!existsSync(HOME)} stragglers=${JSON.stringify(stragglers.slice(0, 200))}`)
  }
  const postStable = { p3080: await probeStable('http://127.0.0.1:3080/'), p3180: await probeStable('http://127.0.0.1:3180/') }
  writeEvidence('post-stable-probe.json', postStable)
  const tu1 = testUseState()
  const dfAfter = dfNow(); writeEvidence('df-after.txt', dfAfter)
  check('A4.0', 'stable :3080/:3180 unchanged (same probe outcome before/after); test-use pristine AFTER; df recorded before and after',
    String(preStable.p3080.status) === String(postStable.p3080.status)
    && String(preStable.p3180.status) === String(postStable.p3180.status)
    && tu1.rev === TEST_USE_BASELINE_SHA && (tu1.dirty ?? 'x') === '',
    `stable=${JSON.stringify(postStable)} tuAfter=${JSON.stringify(tu1)}`)
  const failed = criteria.filter((c) => !c.ok)
  writeEvidence('summary.json', { runStamp: RUN_STAMP, head, hostPort: HOST_PORT, mockPort: MOCK_PORT, total: criteria.length, failed: failed.map((c) => c.id), criteria: criteria.map(({ id, ok, name }) => ({ id, ok, name })), receiptOk: receipt?.ok ?? null })
  if (failed.length > 0) { log(`FAILED ${failed.length}/${criteria.length}: ${failed.map((c) => c.id).join(', ')}`); process.exit(2) }
  log(`ALL GREEN: ${criteria.length}/${criteria.length} criteria — jobs four-boundary LIVE receipts at 515b3805`)
  process.exit(0)
}

main().catch((e) => dieFatal(`harness fatal: ${String(e?.stack ?? e)}`))
