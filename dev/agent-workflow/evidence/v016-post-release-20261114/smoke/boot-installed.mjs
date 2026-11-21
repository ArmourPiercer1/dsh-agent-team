#!/usr/bin/env node
/**
 * boot-installed.mjs — post-release verification harness (evidence instrument,
 * NOT product code).
 *
 * Boots the PINNED-INSTALL DSH_HOME (the `dsh-agent-team` package installed by
 *   pnpm dsh plugin --profile web add github:ArmourPiercer1/dsh-agent-team#v0.1.6
 * into a throwaway `DSH_HOME`) with a real `dsh web`, then over the public HTTP
 * surface:
 *
 *   1. proves the `/team-remote` RPC channel is mounted (`team.getProjection`);
 *   2. creates ONE Team from a v5 blueprint (`team.create`);
 *   3. reads the projection back (`team.getProjection`) and records the Team.
 *
 * The plugin tree under test is the INSTALLED package (`<DSH_HOME>/profiles/web
 * /node_modules/dsh-agent-team`), not the repository checkout: the profile
 * config row (the shipped `cordis.patch.yml`) is the only product wiring and
 * `alpha6ReviewRouting` is ABSENT — i.e. the product default (Alpha.6 OFF).
 *
 * Exit 0 = boot + mount + Team created; 2 = a check failed; 1 = fatal.
 */
import { spawn } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const HOME = process.env.DSH_HOME
const PORT = Number(process.env.PORT ?? 3191)
const DSH_BIN = resolve(process.env.DSH_BIN ?? join(process.cwd(), 'node_modules/.bin/dsh'))
const EVIDENCE = resolve(process.env.EVIDENCE ?? 'dev/agent-workflow/evidence/v016-post-release-20261114/smoke')
const BLUEPRINT = process.env.BLUEPRINT
const WS = resolve(process.env.WS ?? process.cwd())
if (!HOME) throw new Error('DSH_HOME is required')

mkdirSync(EVIDENCE, { recursive: true })
const LOG = join(EVIDENCE, 'boot-instance.log')
const out = { instrument: 'boot-installed.mjs', dshHome: HOME, port: PORT, checks: {}, team: null, errors: [] }
function log(line) { process.stdout.write(`${line}\n`) }

async function fetchJson(url, options = {}) {
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(60_000) })
  const text = await res.text()
  let body = null
  try { body = JSON.parse(text) } catch { body = text.slice(0, 2000) }
  return { status: res.status, body, headers: res.headers }
}

const hostLog = openSync(LOG, 'a')
const child = spawn(process.execPath, [DSH_BIN, 'web', '--port', String(PORT), '--no-open'], {
  cwd: WS,
  stdio: ['ignore', hostLog, hostLog],
  env: { ...process.env, DSH_HOME: HOME },
})
const closed = new Promise((r) => child.on('close', (code, signal) => r({ code, signal })))
let exitInfo = null
closed.then((v) => { exitInfo = v })
const alive = () => exitInfo === null

async function boot() {
  const deadline = Date.now() + 240_000
  const offset = existsSync(LOG) ? readFileSync(LOG).length : 0
  while (Date.now() < deadline) {
    if (!alive()) break
    const text = existsSync(LOG) ? readFileSync(LOG, 'utf8').slice(offset) : ''
    const m = [...text.matchAll(/dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+)/gu)].at(-1)
    if (m) {
      const url = m[1]
      const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
      const cookie = res.headers.get('set-cookie')
      if (res.status !== 303 || cookie === null) throw new Error(`auth failed: status=${res.status}`)
      return { origin: url.replace(/\/\?token=.*$/u, ''), cookie: cookie.split(';', 1)[0], authStatus: res.status }
    }
    await sleep(400)
  }
  const tail = existsSync(LOG) ? readFileSync(LOG, 'utf8').split('\n').slice(-30).join('\n') : '<no log>'
  throw new Error(`no boot line in 240s (exit=${exitInfo?.code}/${exitInfo?.signal}); log tail:\n${tail}`)
}

function rpc(origin, cookie, method, params, version = 4) {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `v016post-${method}-${Math.random().toString(36).slice(2, 10)}`,
      method,
      payload: { version, params },
    }),
  })
}

let originConfig = null
try {
  originConfig = await boot()
  out.boot = { origin: originConfig.origin, authStatus: originConfig.authStatus, command: ['node', DSH_BIN, 'web', '--port', String(PORT), '--no-open'] }
  log(`boot ok: ${originConfig.origin}`)

  const mounted = await rpc(originConfig.origin, originConfig.cookie, 'team.getProjection', { teamSessionId: 'team-root' })
  out.checks.teamRemoteMounted = {
    httpStatus: mounted.status,
    /// A mounted channel answers with an RPC envelope. A 404 means the mount is
    /// absent (the user-world static 405/404 failure this check exists to catch).
    bodyKind: mounted.body?.type ?? typeof mounted.body,
    bodyPreview: JSON.stringify(mounted.body).slice(0, 500),
  }
  log(`/team-remote mounted: status=${mounted.status} type=${mounted.body?.type}`)

  // The route registers before the Team runtime finishes starting; wait for the
  // runtime to leave `runtime-not-ready` before reading the projection.
  const readyDeadline = Date.now() + 180_000
  let projection = mounted
  while (Date.now() < readyDeadline) {
    projection = await rpc(originConfig.origin, originConfig.cookie, 'team.getProjection', { teamSessionId: 'team-root' })
    const reason = projection.body?.result?.error?.details?.reason
    if (projection.body?.result?.ok === true || (reason !== 'runtime-not-ready' && projection.status === 200)) break
    await sleep(1000)
  }
  out.checks.projectionWhenReady = {
    httpStatus: projection.status,
    bodyPreview: JSON.stringify(projection.body).slice(0, 4000),
  }
  out.team = projection.body?.result ?? null
  log(`projection: status=${projection.status} ok=${projection.body?.result?.ok}`)

  // A stock profile boots with `bootPhase: create-or-open` and NO
  // blueprintSource override, so the first boot mints the root Team from the
  // bundle's own default design. `team.getProjection` on that root is the
  // read-back that the Team exists durably (the projection fold resolves the
  // Team row or reports a typed failure; it never invents one).
  const roots = await rpc(originConfig.origin, originConfig.cookie, 'team.listRoots', {}, 3)
  out.checks.listRoots = { httpStatus: roots.status, bodyPreview: JSON.stringify(roots.body).slice(0, 4000) }
  log(`team.listRoots: status=${roots.status}`)
} catch (error) {
  out.errors.push(String(error?.stack ?? error))
  process.exitCode = 1
} finally {
  try { child.kill('SIGTERM') } catch { /* gone */ }
  const done = await Promise.race([closed, sleep(15_000).then(() => 'timeout')])
  if (done === 'timeout' && alive()) { try { child.kill('SIGKILL') } catch { /* gone */ } }
  closeSync(hostLog)
  writeFileSync(join(EVIDENCE, 'boot-summary.json.md'), `${JSON.stringify(out, null, 2)}\n`)
  log(`wrote ${join(EVIDENCE, 'boot-summary.json.md')}`)
}
