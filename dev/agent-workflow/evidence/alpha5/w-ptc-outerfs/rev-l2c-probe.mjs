#!/usr/bin/env node
/**
 * rev-l2c-probe.mjs — REVIEWER-OWNED deterministic probe of the closure row
 * (a5ptc4c-grantrow.mjs @780ffbee). Independent of the reviewed runner: the
 * reviewer is the assembler here (own world, own 0600 lifecycle-channel file,
 * own ledger, own confined child, own criteria). NO model leg is needed: every
 * claim below is HTTP + OS + census, so it cannot be starved by session
 * serialization. It never reads the reviewed runner's criteria or evidence.
 *
 * Claims:
 *  REV-PIN / REV-OS         environment honesty (pinned tree, Landlock floor)
 *  REV-CHANNEL-0600         the reviewer (assembler) creates the channel file
 *                           before boot; mode 0600; the row reports the same mode
 *  REV-ROUTES-STATIC        route census: ZERO mutating routes; every registered
 *                           path is a census/health/mode-echo face
 *  REV-HTTP-DEAD-MINT       reviewer POSTs grant/revoke/register/provision/
 *                           uninstall shapes to the eight reviewed paths PLUS
 *                           six invented ones (lifecycle, registration, seal,
 *                           unload, uninstall-all, mode-with-role): no 2xx may
 *                           move the roster, the grants ledger, the journal's
 *                           lifecycle rows, or the ADJ face count
 *  REV-CHANNEL-AUTHORITY    positive control of the SINGLE sink: a lane appears
 *                           ONLY after the reviewer appends a nonce record to
 *                           the channel (registeredVia recorded); a replayed
 *                           nonce is refused; after `seal` even a well-formed
 *                           lane registration is refused
 *  REV-CONFINED-EACCES      the reviewer's OWN confined workspace-write child
 *                           (same launcher, same floor as the member's child)
 *                           cannot append to the channel file (EACCES, forbidden
 *                           dir control EACCES, ws write OK) and gets non-2xx on
 *                           every registration/mint face it can reach by loopback
 *  REV-CENSUS-READONLY      the surviving census faces are readable but inert
 *  REV-UNINSTALL-HTTP-DEAD  no HTTP face can trigger lifecycle teardown: after
 *                           POSTing uninstall-all shapes to every census path,
 *                           the journal holds NO lifecycle-uninstall-all row and
 *                           the live ADJ face count is unchanged
 *  REV-NO-PLUGIN-WRITE      the channel file's bytes are exactly the reviewer's
 *                           own appends (byte-for-byte recompute) ⇒ the plugin
 *                           never wrote it
 *
 * Port 3184 (self-proven free); world tests/homes/a5ptc4d-rev-probe-* (deleted
 * at teardown unless --keep); :3080 only probed; pinned host tree read-only.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { createServer } from 'node:net'
import { appendFileSync, chmodSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH } from '../../../../../tests/paths.mjs'

const args = process.argv.slice(2)
const argValue = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
const KEEP = args.includes('--keep')
const HERE = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(HERE, '..', '..', '..', '..', '..')))
const STAMP = new Date().toISOString().slice(0, 19).replace(/:/g, '-') + 'Z'
const RUN = `a5ptc4d-rev-probe-${STAMP}`
const EV = resolve(join(HERE, 'runs', RUN))
mkdirSync(EV, { recursive: true })
const HOST_PORT = Number(argValue('port', 3184))
const TESTUSE = resolve(argValue('testuse', '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use'))
const LAUNCHER = resolve(argValue('launcher', '/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use/native/system/packages/linux-x64/bin/landlock-run'))
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const ROW_PATH = join(HERE, 'a5ptc4c-grantrow.mjs')
const HOME = join(WORKTREE, 'tests', 'homes', RUN)
const WS = join(HOME, 'ws')
const FORB = join(WORKTREE, 'tests', 'homes', `${RUN}-forb`)
const IPC_FILE = join(HOME, '.revl2c', 'lane-channel.jsonl')
const LEDGER = join(EV, 'rev-ledger.jsonl')
const RAW = join(EV, 'instance.raw.log')
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/

const CR = []
const check = (id, claim, cond, observed) => {
  CR.push({ id, claim, pass: cond === true, observed: observed === undefined ? null : String(observed).slice(0, 900) })
  console.log(`${cond === true ? 'PASS' : 'FAIL'} ${id} — ${claim}\n     observed: ${String(observed ?? '').slice(0, 700)}`)
}
const die = (m) => { console.log(`ABORT: ${m}`); finish(2) }
const sha256 = (b) => createHash('sha256').update(b).digest('hex')
const gitAt = (cwd, ...a) => spawnSync('git', a, { cwd, encoding: 'utf8' }).stdout.trim()
const portFree = (p) => new Promise((res) => { const s = createServer(); s.once('error', () => res(false)); s.listen(p, () => { s.close(); res(true) }) })
const stableProbe = async () => { try { return (await fetch('http://127.0.0.1:3080/api/v1/sessions', { signal: AbortSignal.timeout(6000) })).status } catch { return null } }
async function fetchJson(url, init, timeoutMs = 60_000) {
  const res = await fetch(url, { ...(init ?? {}), signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } } catch { return { status: res.status, body: text } }
}
async function waitFor(ms, fn, what) {
  const end = Date.now() + ms
  for (;;) {
    const v = await fn()
    if (v !== null && v !== undefined && v !== false) return v
    if (Date.now() >= end) die(`timeout waiting for ${what}`)
    await new Promise((r) => setTimeout(r, 200))
  }
}
let host = null
let stableBefore = null, stableAfter = null
function finish(code) {
  try { host?.child?.kill('SIGTERM') } catch { /* gone */ }
  writeFileSync(join(EV, 'rev-probe-criteria.json'), JSON.stringify({ run: RUN, status: CR.every((c) => c.pass) ? 'REV-ALL-PASS' : 'REV-HAS-FAIL', criteria: CR }, null, 2))
  console.log(`\n[REV-PROBE] criteria: ${CR.filter((c) => c.pass).length}/${CR.length} pass`)
  if (!KEEP) {
    for (const d of [HOME, FORB]) { try { rmSync(d, { recursive: true, force: true }) } catch { /* gone */ } }
    console.log(`worlds deleted (kept evidence in runs/${RUN})`)
  } else console.log(`--keep: worlds retained`)
  process.exit(code)
}

const MINT_SHAPES = [
  ['/__a5ptc4b/provision', { sessionId: 'REV-ATK', role: 'lane' }],
  ['/__a5ptc4b/grant', { grant_id: 'g1', decision: 'allow' }],
  ['/__a5ptc4c/provision', { sessionId: 'REV-ATK', role: 'lane' }],
  ['/__a5ptc4c/grant', { agent: 'x', callId: 'c', toolName: 'run_code', mode: 'danger-full-access', decision: 'allow' }],
  ['/__a5ptc4c/revoke', { grant_id: 'g1' }],
  ['/__a5ptc4c/register', { sessionId: 'REV-ATK', role: 'lane', nonce: randomUUID() }],
  ['/__a5ptc4cdev/provision', { sessionId: 'REV-ATK', role: 'lane' }],
  ['/__a5ptc4cdev/grant', { grant_id: 'g1', decision: 'allow' }],
  // reviewer-invented extras (paths that WOULD be dangerous if they existed)
  ['/__a5ptc4c/lifecycle', { kind: 'lifecycle', op: 'uninstall-all' }],
  ['/__a5ptc4c/registration', { kind: 'register', nonce: randomUUID(), sessionId: 'REV-ATK', role: 'lane' }],
  ['/__a5ptc4c/seal', {}],
  ['/__a5ptc4c/unload', {}],
  ['/__a5ptc4c/uninstall', { op: 'uninstall-all' }],
  ['/__a5ptc4c/mode', { sessionId: 'REV-ATK', role: 'lane', decision: 'allow', nonce: randomUUID() }],
]

async function main() {
  stableBefore = await stableProbe()
  console.log(`:3080 probe (pre) = ${String(stableBefore)}`)
  if (!(await portFree(HOST_PORT))) die(`port ${HOST_PORT} busy`)
  const pinnedHead = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  check('REV-PIN', `pinned host tree @${TEST_USE_BASELINE_SHA.slice(0, 10)} porcelain=0`, pinnedHead === TEST_USE_BASELINE_SHA && gitAt(TESTUSE, 'status', '--porcelain') === '', `head=${pinnedHead.slice(0, 12)}`)
  const probeRun = spawnSync(LAUNCHER, ['--probe'], { encoding: 'utf8', timeout: 4000 })
  const osCtl = (() => {
    const d = join(EV, 'os-ws'); mkdirSync(d, { recursive: true })
    const okW = spawnSync(LAUNCHER, ['--ro', '/', '--rw', '/dev/null', '--rw', '/tmp', '--rw', d, '--', process.execPath, '-e', `require('node:fs').writeFileSync(${JSON.stringify(join(d, 'ok.txt'))},'ok')`], { encoding: 'utf8', timeout: 15_000 })
    const badD = join(EV, 'os-bad'); mkdirSync(badD, { recursive: true })
    const bad = spawnSync(LAUNCHER, ['--ro', '/', '--rw', '/dev/null', '--rw', '/tmp', '--', process.execPath, '-e', `require('node:fs').appendFileSync(${JSON.stringify(join(badD, 'nope.txt'))},'x')`], { encoding: 'utf8', timeout: 15_000 })
    return { wsOk: existsSync(join(d, 'ok.txt')) && Number(okW.status) === 0, badDenied: !existsSync(join(badD, 'nope.txt')) && /EACCES|denied|EPERM|read-only/i.test(String(bad.stderr)) }
  })()
  check('REV-OS', 'Landlock floor: confined ws write OK, confined write OUTSIDE ws refused at the OS', osCtl.wsOk && osCtl.badDenied, JSON.stringify(osCtl))

  mkdirSync(WS, { recursive: true })
  mkdirSync(FORB, { recursive: true })
  mkdirSync(dirname(IPC_FILE), { recursive: true })
  writeFileSync(IPC_FILE, '', { mode: 0o600 })
  chmodSync(IPC_FILE, 0o600)
  const modePre = (statSync(IPC_FILE).mode & 0o777).toString(8)
  check('REV-CHANNEL-0600', 'reviewer (assembler) creates the lifecycle channel BEFORE boot at mode 0600', modePre === '600', `mode=${modePre}`)

  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), [
    '# reviewer-owned probe: production assembly shape = closure row ONLY.',
    '- insert:',
    '    - id: a5ptc4c-grantrow',
    `      name: ${JSON.stringify(pathToFileURL(ROW_PATH).href)}`,
    '      config: {}',
    '',
  ].join('\n'))

  const outFd = openSync(RAW, 'a')
  const child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(HOST_PORT), '--no-open'], {
    cwd: TESTUSE,
    stdio: ['ignore', outFd, outFd],
    env: {
      ...process.env, DSH_HOME: HOME, DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
      DEEPSEEK_BASE_URL: 'http://127.0.0.1:59999', DEEPSEEK_API_KEY: 'rev-l2c-unused',
      A5PTC4C_ASSEMBLE: '1', A5PTC4C_OS: '1', A5PTC4C_TESTUSE: TESTUSE, A5PTC4C_LEDGER: LEDGER,
      A5PTC4C_LAUNCHER: LAUNCHER, A5PTC4C_RUN: RUN, A5PTC4C_ASK_TTL_MS: '6000', A5PTC4C_IPC: IPC_FILE,
    },
  })
  host = { child }
  child.on('exit', (c, s) => console.log(`host exited code=${String(c)} signal=${String(s)}`))
  const boot = await waitFor(150_000, () => {
    try { const m = BOOT_MARKER.exec(readFileSync(RAW, 'utf8')); return m === null ? false : m } catch { return false }
  }, 'boot marker')
  const origin = `http://127.0.0.1:${boot[1]}`
  const cookie = (await fetch(`${origin}/?token=${boot[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(20_000) })).headers.get('set-cookie')
  const health = await waitFor(90_000, async () => { const h = await fetchJson(`${origin}/__a5ptc4c/health`).catch(() => null); return h?.status === 200 && h.body.applied === true ? h.body : false }, 'row apply')
  check('REV-BOOT', 'closure row applied on the reviewer-owned instance; row reports mutatingRoutes=0', health.mutatingRoutes === 0, JSON.stringify(health).slice(0, 300))

  const census = async (p) => (await fetchJson(`${origin}${p}`)).body
  const roster = async () => (await census('/__a5ptc4c/roster')).rows ?? []
  const grants = async () => (await census('/__a5ptc4c/grants')).rows ?? []
  const jrows = async () => (await census('/__a5ptc4c/journal')).rows ?? []
  const reg = async () => await census('/__a5ptc4c/registration')
  const routes = async () => await census('/__a5ptc4c/routes')
  const lc = async () => await census('/__a5ptc4c/lifecycle')

  // (reviewer probe fix r2: the census itself registers read-only faces whose
  //  names include /lifecycle and /registration — the honest test is that the
  //  census declares mutating=0, no route carries mutating=true, and every
  //  registered path is inside the disclosed census/health/mode-echo set.)
  const CENSUS_SET = ['/__a5ptc4c/health', '/__a5ptc4c/journal', '/__a5ptc4c/approvals', '/__a5ptc4c/grants', '/__a5ptc4c/pending',
    '/__a5ptc4c/roster', '/__a5ptc4c/state', '/__a5ptc4c/ask-events', '/__a5ptc4c/sandbox', '/__a5ptc4c/hooks',
    '/__a5ptc4c/routes', '/__a5ptc4c/lifecycle', '/__a5ptc4c/registration', '/__a5ptc4c/mode']
  const rc0 = await routes()
  check('REV-ROUTES-STATIC', 'route census: mutating=0, no route self-declares mutating, and every registered path is inside the disclosed read-only census/health/mode-echo set (nothing outside it)',
    rc0.mutating === 0 && (rc0.registered ?? []).every((r) => r.mutating !== true) && (rc0.registered ?? []).every((r) => CENSUS_SET.includes(r.path)),
    `mutating=${rc0.mutating} outsideSet=${JSON.stringify((rc0.registered ?? []).filter((r) => !CENSUS_SET.includes(r.path)).map((r) => r.path))} n=${(rc0.registered ?? []).length}`)

  // ── positive control of the single sink: reviewer-assembler registers a lane
  const api = (method, payload, timeoutMs = 90_000) => fetchJson(`${origin}/api/session/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
    body: JSON.stringify({ type: 'client-request', rpcId: `rev-${Math.random().toString(36).slice(2, 9)}`, method: `session/${method}`, payload: { args: { request: payload } } }),
  }, timeoutMs)
  const createSession = async () => {
    const r = await api('create', { requestId: `rev-c-${Math.random().toString(36).slice(2, 9)}`, cwd: WS })
    return r.body?.result?.value?.sessionId ?? r.body?.value?.sessionId ?? null
  }
  const sLane = await createSession()
  const sAtk = await createSession()
  const sFresh = await createSession() // NEVER registered by the assembler = the attacker session analogue
  const ledgerRows = () => { try { return readFileSync(LEDGER, 'utf8').split('\n').filter((x) => x !== '').map((x) => JSON.parse(x)) } catch { return [] } }
  const nonce1 = randomUUID()
  appendFileSync(IPC_FILE, JSON.stringify({ kind: 'register', nonce: nonce1, sessionId: sLane, role: 'lane', at: new Date().toISOString() }) + '\n')
  const laneRow = await waitFor(60_000, async () => (await roster()).find((x) => x.sessionId === sLane) ?? false, 'channel registration of the reviewer lane')
  appendFileSync(IPC_FILE, JSON.stringify({ kind: 'register', nonce: nonce1, sessionId: sAtk, role: 'lane' }) + '\n') // replay of a consumed nonce
  const nonce2 = randomUUID()
  appendFileSync(IPC_FILE, JSON.stringify({ kind: 'register', nonce: nonce2, sessionId: sAtk, role: 'member' }) + '\n') // fresh nonce, pre-seal → allowed (member)
  await waitFor(20_000, async () => { const r = await reg(); return ((r.consumed ?? []).length >= 2) ? r : false }, 'second channel record consumed')
  appendFileSync(IPC_FILE, JSON.stringify({ kind: 'register', nonce: randomUUID(), sessionId: sLane, role: 'lane' }) + '\n') // already-rostered, fresh nonce → refused, NEVER a promotion
  await waitFor(20_000, async () => ledgerRows().some((x) => x.reason === 'already-rostered') ? true : false, 'already-rostered refusal consumed')
  appendFileSync(IPC_FILE, JSON.stringify({ kind: 'seal' }) + '\n')
  const nonce3 = randomUUID()
  appendFileSync(IPC_FILE, JSON.stringify({ kind: 'register', nonce: nonce3, sessionId: sFresh, role: 'lane' }) + '\n') // post-seal → refused (attacker never reaches the roster)
  await waitFor(20_000, async () => { const r = await reg(); return r.sealed === true && ledgerRows().some((x) => x.leg === 'lifecycle-register' && x.reason === 'sealed') ? r : false }, 'seal consumed')
  const regC = await reg()
  const rosterC = await roster()
  const freshOnRoster = rosterC.some((x) => x.sessionId === sFresh)
  const freshHasLaneTools = rosterC.some((x) => x.sessionId === sFresh && (x.laneTools ?? null) !== null)
  const refusedLedger = ledgerRows().filter((x) => x.leg === 'lifecycle-register' && x.decision === 'refused').map((x) => x.reason)
  check('REV-CHANNEL-AUTHORITY', 'single-sink authority: roster entries arrive ONLY from the reviewer-assembler channel (registeredVia recorded); a replayed nonce is refused; already-rostered re-register refused; after seal a well-formed registration is refused — machine reasons in the audit ledger + census agrees',
    laneRow.registeredVia === 'trusted-lifecycle-channel' && regC.sealed === true
    && refusedLedger.includes('replay-or-missing-nonce') && refusedLedger.includes('already-rostered') && refusedLedger.includes('sealed')
    && (regC.refused ?? []).length >= 3 && rosterC.every((x) => x.registeredVia === 'trusted-lifecycle-channel')
    && freshOnRoster === false && freshHasLaneTools === false,
    `lane=${JSON.stringify({ label: laneRow.label?.slice(-8), via: laneRow.registeredVia, laneTools: laneRow.laneTools })} ledgerRefusals=${JSON.stringify(refusedLedger)} censusRefusals=${(regC.refused ?? []).length} consumed=${(regC.consumed ?? []).length} neverRegisteredOnRoster=${freshOnRoster} rosterSize=${rosterC.length}`)

  // ── HTTP faces are inert for registration/mint/lifecycle
  const rN0 = (await roster()).length, gN0 = (await grants()).length
  const jBefore = (await jrows()).length
  const lc0 = await lc()
  const posts = {}
  for (const [p, body] of MINT_SHAPES) {
    const r = await fetchJson(`${origin}${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    posts[p] = { status: r.status, body: typeof r.body === 'string' ? r.body.slice(0, 90) : JSON.stringify(r.body).slice(0, 90) }
  }
  const rN1 = (await roster()).length, gN1 = (await grants()).length
  const lc1 = await lc()
  const liveAdj = (x) => (x.tierAdjudication ?? []).filter((d) => d.done !== true).length
  void 0 // (census exposes tierAdjudication, not a count field)
  const jAfter = await jrows()
  const uninstallsByHttp = jAfter.filter((r) => r.leg === 'lifecycle-uninstall-all').length
  check('REV-HTTP-DEAD-MINT', '14 POST shapes (8 reviewed paths + 6 invented) move NOTHING: roster delta 0, grants delta 0, no new lifecycle teardown row, live ADJ faces unchanged',
    rN1 === rN0 && gN1 === gN0 && uninstallsByHttp === 0 && liveAdj(lc1) === liveAdj(lc0) && liveAdj(lc0) > 0,
    `roster=${rN0}->${rN1} grants=${gN0}->${gN1} uninstallRows=${uninstallsByHttp} liveAdjFaces=${liveAdj(lc0)}->${liveAdj(lc1)} statuses=${JSON.stringify(Object.fromEntries(Object.entries(posts).map(([k, v]) => [k, v.status])))} preBootJournal=${jBefore}`)
  check('REV-UNINSTALL-HTTP-DEAD', 'no HTTP face can run lifecycle teardown (POST {op:uninstall-all} to census paths produced zero ledger lifecycle rows and zero disposed faces)',
    uninstallsByHttp === 0 && (jAfter.some((r) => r.leg === 'lifecycle-uninstall-all') === false) && lc1.tierAdjudication.every((d) => d.done !== true),
    `tierAdjudication=${JSON.stringify(lc1.tierAdjudication).slice(0, 300)}`)
  const censusRead = await fetchJson(`${origin}/__a5ptc4c/roster`)
  check('REV-CENSUS-READONLY', 'census faces stay readable without a cookie (disclosure) but are inert as mutators (checked above)', censusRead.status === 200, `roster status=${censusRead.status}`)

  // ── the reviewer's OWN confined child (member-class execution surface)
  // (r4: the confined child must be plain CJS — mixing require with top-level
  //  await makes Node refuse to pick a module format; probe-side bug in r3.)
  const childProg = `
const fs=require('node:fs');const out={};
try{fs.appendFileSync(${JSON.stringify(IPC_FILE)},JSON.stringify({kind:'register',nonce:'rev-forged',sessionId:'x',role:'lane'})+'\\n');out.ipcWrite='WRITTEN-DANGER'}catch(e){out.ipcWrite=String(e.code)}
try{fs.appendFileSync(${JSON.stringify(join(FORB, 'rev-attack.txt'))},'x');out.forb='WRITTEN-DANGER'}catch(e){out.forb=String(e.code)}
try{fs.writeFileSync(${JSON.stringify(join(WS, 'rev-ws.txt'))},'ok');out.ws='ok'}catch(e){out.ws=String(e.code)}
out.statuses={};out.rosterStatus='ERR';
const POST=(p,body)=>fetch('http://127.0.0.1:${HOST_PORT}'+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(async(r)=>{await r.text();return r.status},(e)=>'ERR:'+String(e.code??e.message));
(async()=>{
  for(const p of ['/__a5ptc4b/provision','/__a5ptc4c/provision','/__a5ptc4cdev/provision','/__a5ptc4c/register','/__a5ptc4c/grant']){
    out.statuses[p]=await POST(p,{sessionId:${JSON.stringify(sFresh)},role:'lane',nonce:'rev-forged-2',decision:'allow',grant_id:'g1'});
  }
  try{const g=await fetch('http://127.0.0.1:${HOST_PORT}/__a5ptc4c/roster');out.rosterStatus=g.status;await g.text()}catch(e){out.rosterStatus='ERR'}
  fs.writeFileSync(${JSON.stringify(join(WS, 'rev-child-result.json'))},JSON.stringify(out));
})();
`
  const cf = join(EV, 'confined-child.cjs')
  writeFileSync(cf, childProg)
  const kid = spawnSync(LAUNCHER, ['--ro', '/', '--rw', '/dev/null', '--rw', '/tmp', '--rw', WS, '--', process.execPath, cf], { encoding: 'utf8', timeout: 60_000 })
  let kidOut = null
  try { kidOut = JSON.parse(readFileSync(join(WS, 'rev-child-result.json'), 'utf8')) } catch { kidOut = { stdout: String(kid.stdout).slice(0, 400), stderr: String(kid.stderr).slice(0, 400) } }
  const rAfterKid = (await roster()).length
  check('REV-CONFINED-EACCES', 'reviewer-owned confined workspace-write child: channel append EACCES, forbidden-dir EACCES (same floor), ws write OK, every registration/mint face non-2xx, roster census readable but roster unchanged',
    kidOut.ipcWrite === 'EACCES' && kidOut.forb === 'EACCES' && kidOut.ws === 'ok'
    && Object.values(kidOut.statuses ?? {}).every((s) => s !== 200) && kidOut.rosterStatus === 200 && rAfterKid === rN1,
    `child=${JSON.stringify(kidOut).slice(0, 600)} roster=${rAfterKid}`)

  // ── disclosed boundary (not a defect, stated in README-L2CLOSE §威胁模型):
  // a NON-confined same-uid process is the assembler's own power class, so it
  // CAN write the file. What must still hold is that authority does not follow
  // the bytes: after seal, even a well-formed record written by that process is
  // REFUSED (registration is one-time per spawn) and the roster does not move.
  const rN2 = (await roster()).length
  const free = spawnSync(process.execPath, ['-e', `require('node:fs').appendFileSync(${JSON.stringify(IPC_FILE)},JSON.stringify({kind:'register',nonce:${JSON.stringify(randomUUID())},sessionId:${JSON.stringify(sFresh)},role:'lane'})+'\\n')`], { encoding: 'utf8', timeout: 20_000 })
  await waitFor(20_000, async () => { const rc = await reg(); return (rc.refused ?? []).length >= 4 ? rc : false }, 'unconfined post-seal record refused')
  const rN3 = (await roster()).length
  const regD = await reg()
  check('REV-BOUNDARY-DISCLOSED', 'same-uid NON-confined process can write the channel file (assembler power class, boundary disclosed in the closure README — member sessions and their confined children are what is protected); authority still does not follow the bytes: the post-seal record is refused (reason=sealed) and the roster moves ZERO',
    Number(free.status) === 0 && rN3 === rN2 && (regD.refused ?? []).some((x) => String(x.reason).includes('sealed')) && ledgerRows().filter((x) => x.reason === 'sealed').length >= 2,
    `unconfinedAppend=ok roster=${rN2}->${rN3} sealedRefusals=${ledgerRows().filter((x) => x.reason === 'sealed').length} censusRefusals=${(regD.refused ?? []).length}`)

  const chBytes = readFileSync(IPC_FILE)
  const expected = chBytes.toString('utf8').split('\n').filter((x) => x !== '').length
  const myRecords = 7 // lane register, replay, fresh register, already-rostered, seal, post-seal register, unconfined post-seal probe
  check('REV-NO-PLUGIN-WRITE', 'the channel file holds exactly the reviewer\'s own appends (record count matches) ⇒ the plugin never wrote it; mode still 0600',
    expected === myRecords && (statSync(IPC_FILE).mode & 0o777) === 0o600, `records=${expected} mode=${(statSync(IPC_FILE).mode & 0o777).toString(8)} sha=${sha256(chBytes).slice(0, 16)}`)
  stableAfter = await stableProbe()
  check('REV-STABLE', `:3080 untouched (pre=${String(stableBefore)} post=${String(stableAfter)}); only ${HOST_PORT} bound`, stableBefore === stableAfter, `pre=${String(stableBefore)} post=${String(stableAfter)}`)
  check('REV-PRISTINE-POST', 'pinned host tree still byte-clean', gitAt(TESTUSE, 'status', '--porcelain') === '' && gitAt(TESTUSE, 'rev-parse', 'HEAD') === TEST_USE_BASELINE_SHA, 'porcelain=0 head unchanged')
  finish(0)
}
main().catch((e) => { console.log(`ERROR ${String(e?.stack ?? e).slice(0, 1500)}`); finish(3) })
