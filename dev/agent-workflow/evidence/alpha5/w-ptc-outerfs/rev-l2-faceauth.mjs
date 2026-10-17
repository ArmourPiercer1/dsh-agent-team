#!/usr/bin/env node
/**
 * rev-l2-faceauth.mjs — reviewer micro-probe (round 4): the AUTHORITY BOUNDARY of
 * the assembly-time provisioning face. Deterministic, no in-world legs.
 *
 * Questions (each answered by a live answer, not by reading code):
 *  Q1  Is an already-rostered member UPGRADEABLE to lane by re-posting provision?
 *      (if yes -> any member could mint Grants = self-escalation; expect: no)
 *  Q2  Can a session that is NOT on the roster be registered as a lane actor by a
 *      request that carries NO host credential? (if yes -> the Grant-authority
 *      bootstrap is protected only by loopback reachability, i.e. by "the world
 *      operator is us", not by authentication)
 *  Q3  Are the read-only census faces readable without the host launch token?
 *
 * This is a DISCLOSURE probe for the production-wiring note; it is not one of the
 * root's six criteria. Port 3184 (self-proven free); world a5ptc4b-rev-face-*.
 */
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { startMockModel } from '../../../../../packages/tools/harness/mock-deepseek.mjs'
import { CLIENT_COMMIT_HASH } from '../../../../../tests/paths.mjs'

const HERE = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(HERE, '..', '..', '..', '..', '..')
const STAMP = new Date().toISOString().slice(0, 19).replace(/:/g, '-') + 'Z'
const RUN = `a5ptc4b-rev-face-${STAMP}`
const OUT = join(HERE, 'runs', RUN)
const PORT = 3184
const TESTUSE = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use'
const LAUNCHER = '/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use/native/system/packages/linux-x64/bin/landlock-run'
const HOME = join(WORKTREE, 'tests', 'homes', RUN)
const WS = join(HOME, 'ws')
mkdirSync(OUT, { recursive: true })
mkdirSync(WS, { recursive: true })
mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), [
  '- insert:',
  '    - id: a5ptc4b-grantrow',
  `      name: ${JSON.stringify(pathToFileURL(join(HERE, 'a5ptc4b-grantrow.mjs')).href)}`,
  '      config: {}',
  '',
].join('\n'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const j = async (url, init) => {
  try {
    const r = await fetch(url, { ...(init ?? {}), signal: AbortSignal.timeout(20_000) })
    let b = null
    try { b = JSON.parse(await r.text()) } catch { /* non-json */ }
    return { status: r.status, body: b }
  } catch (e) { return { status: 'error', body: String(e?.message ?? e) } }
}
const post = (path, body) => j(`http://127.0.0.1:${PORT}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const get = (path) => j(`http://127.0.0.1:${PORT}${path}`)

const free = await new Promise((res) => { const s = createServer(); s.once('error', () => res(false)); s.once('listening', () => s.close(() => res(true))); s.listen(PORT, '127.0.0.1') })
if (!free) { console.log('FATAL port busy'); process.exit(1) }
const mock = await startMockModel({ port: 0, decide: () => ({ kind: 'text', content: 'quiet' }) })
const raw = join(OUT, 'instance.raw.log')
const child = spawn(process.execPath, [join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js'), 'web', '--port', String(PORT), '--no-open'], {
  cwd: TESTUSE, stdio: ['ignore', openSync(raw, 'a'), openSync(raw, 'a')],
  env: { ...process.env, DSH_HOME: HOME, DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH, DEEPSEEK_BASE_URL: `http://127.0.0.1:${mock.port}`, DEEPSEEK_API_KEY: 'k', A5PTC4B_ASSEMBLE: '1', A5PTC4B_OS: '1', A5PTC4B_TESTUSE: TESTUSE, A5PTC4B_LEDGER: join(OUT, 'ledger.jsonl'), A5PTC4B_LAUNCHER: LAUNCHER, A5PTC4B_RUN: RUN, A5PTC4B_ASK_TTL_MS: '6000' },
})
const origin = `http://127.0.0.1:${PORT}`
let boot = null
for (let t = 0; t < 300 && boot == null; t += 1) { await sleep(300); try { const m = /token=([A-Za-z0-9_-]+)/.exec(readFileSync(raw, 'utf8')); if (m) boot = m } catch { /* wait */ } }
const cookie = (await fetch(`${origin}/?token=${boot[1]}`, { redirect: 'manual' })).headers.get('set-cookie')
const api = async (method, payload) => j(`${origin}/api/session/${method}`, {
  method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
  body: JSON.stringify({ type: 'client-request', rpcId: `f-${Math.random().toString(36).slice(2, 9)}`, method: `session/${method}`, payload: { args: { request: payload } } }),
})
const create = async () => {
  const r = await api('create', { requestId: `f-c-${Math.random().toString(36).slice(2, 9)}`, cwd: WS })
  return r.body?.result?.value?.sessionId ?? r.body?.value?.sessionId ?? null
}
const sid = {}
for (const k of ['LANE', 'M1', 'FRESH']) sid[k] = await create()
await post('/__a5ptc4b/provision', { sessionId: sid.LANE, role: 'lane' })
const provM1 = await post('/__a5ptc4b/provision', { sessionId: sid.M1, role: 'member' })

// Q1: re-post provision for the SAME session asking for the lane role
const upgrade = await post('/__a5ptc4b/provision', { sessionId: sid.M1, role: 'lane' })
const roster1 = await get('/__a5ptc4b/roster')
const m1entry = (roster1.body?.rows ?? []).find((r) => r.label === provM1.body?.label)
// Q2: register a never-rostered session as a lane actor, with NO host credential
const freshLane = await post('/__a5ptc4b/provision', { sessionId: sid.FRESH, role: 'lane' })
const roster2 = await get('/__a5ptc4b/roster')
// Q3: read census with no credential
const censusNoAuth = await get('/__a5ptc4b/grants')
const rosterNoAuth = await get('/__a5ptc4b/roster')
const out = {
  Q1_upgrade_answer: upgrade.body, q1_role_after: m1entry?.role,
  q1_verdict: upgrade.body?.already === true && m1entry?.role === 'member' ? 'NO self-escalation: the face answers already:true and the role STAYS member' : 'CHECK: role changed or unexpected answer',
  Q2_fresh_lane_answer: freshLane.body, q2_lane_count: (roster2.body?.rows ?? []).filter((r) => r.role === 'lane').length,
  q2_verdict: freshLane.body?.ok === true && freshLane.body?.role === 'lane' ? 'REACHABLE-AND-AUTHORIZING without any host credential: a caller that can reach the port may designate ANY session as a Grant-minting lane actor' : 'refused',
  Q3_census_no_credential: { grants: censusNoAuth.status, roster: rosterNoAuth.status, laneRolesVisible: (rosterNoAuth.body?.rows ?? []).map((r) => r.role) },
}
writeFileSync(join(OUT, 'face-authority.json'), JSON.stringify(out, null, 2) + '\n')
console.log(JSON.stringify(out, null, 2))
child.kill()
await sleep(400)
await mock.close?.()
try { writeFileSync(join(OUT, 'instance.log'), readFileSync(raw, 'utf8').replace(/(token=)[A-Za-z0-9_-]{8,}/g, '$1<REDACTED>')); rmSync(raw) } catch { /* ok */ }
rmSync(HOME, { recursive: true, force: true })
process.exit(0)
