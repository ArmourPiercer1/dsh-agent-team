#!/usr/bin/env node
/**
 * a5rr-host-kit.mjs — RA-REVIEW Tier-B measurement on the pinned REAL host.
 *
 * ONE synthetic world on port 3185: pinned pristine 0.2.0-rc.2 web host + the
 * read-only probe row (public profile-patch seam only). Two NON-team sessions
 * through the public `session/create` entry — `standard` (its preset realm
 * carries tool-fs/tool-bash copies in the agent scope) and `minimal` (ships
 * none) — one mock-model setup turn each, then the probe measures ① on the
 * live registry:
 *
 *   H1 host pinned + porcelain-clean before AND after      (infrastructure)
 *   H2 IF-5 shared surface byte-untouched                  (infrastructure)
 *   H3 ports self-proved free; :3080 probed read-only, never operated
 *   H4 trusted GLOBAL face is EMPTY (bind-diag law re-pinned on this run)
 *   H5 the scoped read `tools.get(name, agent)` is a STABLE object identity
 *      across reads for every scoped-present name — identity of the
 *      definition-that-executes IS readable through the public scoped seam
 *   H6 NO resolved definition carries an id/uuid/version/generation/revision
 *      field — the host offers IDENTITY, not a GENERATION label; per-call
 *      re-read + object identity is the only generation proxy (and that is
 *      exactly what the Guard's drift check consumes)
 *   H7 no name resolves on the unscoped (trusted global) face ⇒ CURRENT
 *      fact-3 has NO trusted side to compare against for preset-realm copies
 *      — the GLUE-4 stop, re-measured live (sameDefinition false / absent)
 *   H8 a FORGED scope key (a plain object) resolves NOTHING that a scoped
 *      agent has privately — the team's scoped view is unreachable through a
 *      handle the assembly does not hold
 *   H9 `minimal` non-team face shows NO team/preset expansion (read/write/
 *      edit/read_image absent there) — least-privilege baseline unchanged
 *
 * Honesty: every criterion comes from live route reads captured at
 * observation time; a missing leg FAILS; tokens redacted at capture; the
 * world is swept (TEST_METHODS §7); no DSH_PERMISSION_MODE knob — no tool
 * ever executes (catalog/identity reads only).
 *
 * EXIT: 0 GREEN · 2 a criterion failed (RED) · 1 fatal.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { startMockModel } from '../../../../../../packages/tools/harness/mock-deepseek.mjs'
import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH } from '../../../../../../tests/paths.mjs'

const args = process.argv.slice(2)
const argValue = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
const KEEP = args.includes('--keep')
const HERE = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(HERE, '..', '..', '..', '..', '..', '..')))
const RUN_STAMP = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-') + 'Z'
const EVIDENCE_DIR = resolve(argValue('evidence-dir', join(HERE, 'runs', RUN_STAMP)))
mkdirSync(EVIDENCE_DIR, { recursive: true })

const HOST_PORT = Number(argValue('port', 3185))
const TESTUSE = resolve(argValue('testuse', join(WORKTREE, 'tests', 'deepseek-harness-test-use')))
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const ROW_PATH = join(HERE, 'a5rr-probe-row.mjs')
const WORLD_PREFIX = argValue('world-prefix', 'a5rr')

const FIVE = ['bash', 'edit', 'read', 'read_image', 'write']
const PRESETS = ['standard', 'minimal']

const hex8 = (s) => createHash('sha256').update(s).digest('hex').slice(0, 8)
const REDACTIONS = [
  [/(https?:\/\/[^\s"'`]+?\?token=)([A-Za-z0-9_-]{8,})/g, (_m, head, tok) => head + `<REDACTED-${hex8(tok)}>`],
  [/\b(token|api_key|apikey|access_token)=["']?[A-Za-z0-9_\-.=]{8,}/gi, (m0) => m0.split('=')[0] + '=<REDACTED>'],
  [/dsh-auth-[A-Za-z0-9_-]{6,}/g, 'dsh-auth-<REDACTED>'],
  [/\bBearer\s+[A-Za-z0-9._-]{6,}/gi, 'Bearer <REDACTED>'],
]
const redact = (text) => REDACTIONS.reduce((t, [re, r]) => t.replace(re, r), text)

const CRITERIA = []
function check(id, claim, cond, observed) {
  CRITERIA.push({ id, claim, pass: cond === true, observed })
  console.log(`${cond === true ? 'PASS' : 'FAIL'} ${id} — ${claim}${observed === undefined ? '' : ` [${observed}]`}`)
}
const die = (msg) => { throw new Error(`FATAL: ${msg}`) }

function portFree(port) {
  return new Promise((res) => { const srv = createServer(); srv.once('error', () => res(false)); srv.once('listening', () => srv.close(() => res(true))); srv.listen(port, '127.0.0.1') })
}
function gitAt(dir, ...a) { return spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).stdout.trim() }
const stableProbe = async () => { try { const r = await fetch('http://127.0.0.1:3080/', { redirect: 'manual', signal: AbortSignal.timeout(5000) }); return r.status } catch { return 'unreachable' } }
const writeEvidence = (name, value) => writeFileSync(join(EVIDENCE_DIR, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n')
const repoRel = (p) => relative(WORKTREE, p).split('\\').join('/')

const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/
async function waitFor(deadlineMs, fn, what) {
  const deadline = Date.now() + deadlineMs
  for (;;) {
    const v = await fn()
    if (v !== null && v !== undefined && v !== false) return v
    if (Date.now() >= deadline) die(`timeout waiting for ${what}`)
    await new Promise((r) => setTimeout(r, 250))
  }
}
async function fetchJson(url, init, timeoutMs = 30_000) {
  const res = await fetch(url, { ...(init ?? {}), signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } } catch { return { status: res.status, body: text } }
}

async function main() {
  console.log(`a5rr host-kit stamp=${RUN_STAMP} port=${HOST_PORT}`)
  const head = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  const porcelainBefore = gitAt(TESTUSE, 'status', '--porcelain')
  check('H1', `test-use host pinned pristine @${TEST_USE_BASELINE_SHA.slice(0, 10)}`, head === TEST_USE_BASELINE_SHA && porcelainBefore === '', `head=${head.slice(0, 10)} porcelain=${porcelainBefore === '' ? 0 : 'DIRTY'}`)
  const sharedDiff = spawnSync('git', ['-C', WORKTREE, 'status', '--porcelain', '--', 'packages', 'scripts', 'vitest.config.ts', 'cordis.patch.yml'], { encoding: 'utf8' }).stdout.trim()
  check('H2', 'IF-5 shared surface byte-untouched (measurement lives only in this evidence dir)', sharedDiff === '', sharedDiff === '' ? 'porcelain empty' : sharedDiff.split('\n').slice(0, 4).join(' | '))
  if (!(await portFree(HOST_PORT))) die(`host port ${HOST_PORT} busy`)
  let mockPort = 0
  for (const p of [3491, 3492, 3493, 3494, 3495]) { if (await portFree(p)) { mockPort = p; break } }
  if (mockPort === 0) die('no mock port free')
  const stableBefore = await stableProbe()

  const HOME = join(WORKTREE, 'tests', 'homes', `${WORLD_PREFIX}-world-${RUN_STAMP}`)
  const INSTANCE_RAW = join(EVIDENCE_DIR, 'instance.raw.log')
  const INSTANCE_LOG = join(EVIDENCE_DIR, 'instance.log')
  const MK = `A5RR_${RUN_STAMP.replace(/[^A-Za-z0-9]/g, '')}`
  const mock = await startMockModel({
    port: mockPort,
    log: () => {},
    decide: ({ req }) => {
      const text = JSON.stringify(req?.messages ?? [])
      for (const preset of PRESETS) if (text.includes(`${MK}_${preset.toUpperCase()}_SETUP`)) return { kind: 'text', content: `${MK}_${preset.toUpperCase()}_OK` }
      return { kind: 'text', content: 'a5rr-mock: unscripted request, completing quietly.' }
    },
  })

  let host = null
  const facts = { run: RUN_STAMP, home: repoRel(HOME), ok: false }
  try {
    mkdirSync(join(HOME, 'workspace'), { recursive: true })
    mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
    writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), [
      `# a5rr RA-REVIEW probe world (run ${RUN_STAMP}): read-only probe row only — public profile-patch seam; NO tool rows mounted.`,
      '- insert:',
      '    - id: a5rr-probe',
      `      name: ${JSON.stringify(pathToFileURL(ROW_PATH).href)}`,
      '      config: {}',
      '',
    ].join('\n'))
    const outFd = openSync(INSTANCE_RAW, 'a')
    host = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(HOST_PORT), '--no-open'], {
      cwd: join(HOME, 'workspace'),
      stdio: ['ignore', outFd, outFd],
      env: { ...process.env, DSH_HOME: HOME, DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH, DEEPSEEK_BASE_URL: `http://127.0.0.1:${mockPort}`, DEEPSEEK_API_KEY: 'a5rr-mock-key' },
    })
    const boot = await waitFor(90_000, () => { try { const m = BOOT_MARKER.exec(readFileSync(INSTANCE_RAW, 'utf8')); return m === null ? false : m } catch { return false } }, 'host boot marker')
    const origin = `http://127.0.0.1:${boot[1]}`
    const auth = await fetch(`${origin}/?token=${boot[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
    const cookie = auth.headers.get('set-cookie')
    if (!(auth.status === 303 && cookie !== null)) die(`token gate returned ${String(auth.status)}`)
    await waitFor(30_000, async () => { const h = await fetchJson(`${origin}/__a5rr/health`).catch(() => null); return h?.status === 200 && h.body.applied === true ? h : false }, 'probe row apply')

    for (const preset of PRESETS) {
      const created = await fetchJson(`${origin}/api/session/create`, {
        method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
        body: JSON.stringify({ type: 'client-request', rpcId: `a5rr-${preset}-c-${Math.random().toString(36).slice(2, 10)}`, method: 'session/create', payload: { args: { request: { agentPreset: preset } } } }),
      }, 60_000)
      const sessionId = created.body?.result?.value?.sessionId ?? created.body?.value?.sessionId ?? null
      if (typeof sessionId !== 'string' || sessionId === '') die(`session/create ${preset} returned no sessionId`)
      facts[preset] = { sessionId }
      const promptRes = await fetchJson(`${origin}/api/session/prompt`, {
        method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
        body: JSON.stringify({ type: 'client-request', rpcId: `a5rr-${preset}-p-${Math.random().toString(36).slice(2, 10)}`, method: 'session/prompt', payload: { args: { request: { requestId: `a5rr-${preset}-r-${Math.random().toString(36).slice(2, 10)}`, sessionId, mode: 'queue', content: [{ type: 'text', text: `${MK}_${preset.toUpperCase()}_SETUP This is a setup turn. Do not call any tools. Reply with the single word OK.` }] } } } }),
      }, 240_000)
      facts[preset].setupStatus = promptRes.status
    }
    await waitFor(120_000, async () => PRESETS.every((p) => (mock.requests ?? []).some((r) => JSON.stringify(r.body?.messages ?? []).includes(`${MK}_${p.toUpperCase()}_SETUP`))), 'both setup turns reached the mock')
    const observed = await waitFor(90_000, async () => {
      const f = await fetchJson(`${origin}/__a5rr/facts?names=${FIVE.join(',')}`).catch(() => null)
      if (f?.status !== 200) return false
      return (f.body.agents ?? []).filter((a) => Array.isArray(a.scopedNames)).length >= PRESETS.length ? f.body : false
    }, 'probe facts with both Agents live')
    facts.globalNames = observed.globalNames
    facts.probeAgents = observed.agents
    facts.ok = true
  } finally {
    writeEvidence('world-facts.json', facts)
    try { if (host !== null) host.kill() } catch { /* gone */ }
    await new Promise((r) => setTimeout(r, 1000))
    try { writeFileSync(INSTANCE_LOG, redact(readFileSync(INSTANCE_RAW, 'utf8'))); rmSync(INSTANCE_RAW) } catch { /* no log */ }
    const porcelainAfter = gitAt(TESTUSE, 'status', '--porcelain')
    check('H1b', 'test-use host STILL porcelain-clean after the world', porcelainAfter === '', porcelainAfter === '' ? 'porcelain 0' : 'DIRTY')
    if (!KEEP) { try { rmSync(HOME, { recursive: true, force: true }) } catch { /* best effort */ } }
    facts.swept = !existsSync(HOME)
  }
  const stableAfter = await stableProbe()
  check('H3', `host/mock ports self-proved (${HOST_PORT}/${mockPort}); :3080 read-only probed, never operated`, String(stableBefore) === String(stableAfter), `:3080 ${String(stableBefore)} → ${String(stableAfter)}, operated=false`)

  const byPreset = {}
  const agentsById = {}
  for (const a of facts.probeAgents ?? []) agentsById[a.session] = a
  for (const preset of PRESETS) { const a = agentsById[facts[preset]?.sessionId]; byPreset[preset] = a ?? null }

  check('H4', 'trusted GLOBAL face is EMPTY (bind-diag law re-pinned: no scoped-realm registration reaches it)', Array.isArray(facts.globalNames) && facts.globalNames.length === 0, JSON.stringify(facts.globalNames))

  const std = byPreset.standard
  const fivePresent = std ? FIVE.filter((n) => std.perName?.[n]?.scopedPresent === true) : []
  const stableReads = std ? FIVE.filter((n) => std.perName?.[n]?.scopedPresent === true && std.perName[n].scopedIdentityStable === true) : []
  check('H5', '① IDENTITY IS READABLE: every scoped-present definition returns the SAME object across public scoped reads (the executor resolves this same reference — get→resolveExecution, index.ts:1247/1578)',
    fivePresent.length === FIVE.length && stableReads.length === FIVE.length, `stable ${stableReads.length}/${FIVE.length} on the standard agent`)
  const idFieldsSeen = (facts.probeAgents ?? []).flatMap((a) => FIVE.map((n) => a.perName?.[n]?.identityLikeFields).filter(Array.isArray)).flat()
  const exposesBody = std ? FIVE.every((n) => std.perName?.[n]?.exposesExecuteBody === true) : false
  check('H6', '① NO GENERATION LABEL EXISTS: no resolved definition carries id/uuid/version/generation/revision/definitionId — object identity + per-call re-read is the ONLY generation proxy (and drift detection is the only generation MECHANISM)',
    idFieldsSeen.length === 0 && exposesBody, `identityLikeFields=[${idFieldsSeen.join(',')}] exposesExecute=${exposesBody}`)
  const globalAny = std ? FIVE.some((n) => std.perName?.[n]?.globalPresent === true) : true
  check('H7', 'CURRENT fact-3 has NO trusted side on this host for preset-realm copies (unscoped face resolves nothing) ⇒ the GLUE-4 stop re-measured live',
    globalAny === false, `globalPresent any-of-five=${globalAny}`)
  const forgedLeaks = (facts.probeAgents ?? []).some((a) => FIVE.some((n) => a.perName?.[n]?.scopedPresent === true && a.perName[n].forgedScopeResolves === true))
  check('H8', 'NC-3 on the REAL host: a forged (non-host) scope key resolves NOTHING the agent holds privately — the scoped view is unreachable through an unowned handle',
    forgedLeaks === false, `forgedScope leaks=${forgedLeaks}`)
  const min = byPreset.minimal
  const minExpanded = min ? FIVE.filter((n) => n !== 'bash' && min.perName?.[n]?.scopedPresent === true) : ['<missing>']
  check('H9', 'minimal non-team face shows zero expansion from any scoped mount plane (read/write/edit/read_image absent)',
    min !== null && minExpanded.length === 0, `expanded=${JSON.stringify(minExpanded)} minimalNames=${JSON.stringify(min?.scopedNames ?? null)}`)

  writeEvidence('criteria.json', { run: RUN_STAMP, criteria: CRITERIA })
  const failed = CRITERIA.filter((c) => !c.pass)
  console.log(`\n${failed.length === 0 ? 'GREEN' : 'RED'} ${CRITERIA.filter((c) => c.pass).length}/${CRITERIA.length} (${failed.map((c) => c.id).join(',') || 'all passed'})`)
  process.exit(failed.length === 0 ? 0 : 2)
}

main().catch((e) => { console.error(String(e?.stack ?? e)); writeEvidence('fatal.txt', String(e?.stack ?? e)); process.exit(1) })
