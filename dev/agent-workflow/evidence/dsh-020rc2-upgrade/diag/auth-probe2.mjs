#!/usr/bin/env node
/**
 * DIAGNOSTIC PROBE 2 (throwaway, evidence-only) — 0.2.0-rc.2 upgrade round.
 *
 * Probe 1 (`auth-probe.mjs`) proved the mounted channel answers reads AND the
 * `team.create` write lane with HTTP 200 + typed envelopes, and that the real
 * blocker is `TEAM_REMOTE_TEAM_CREATE_ROOT_START_FAILED` (`tools.restrict()
 * names unknown global tool '…'`, caused by the kit's stale team-tool
 * catalog). It did NOT reproduce the `HTTP 401` the kit saw for
 * `team.create`. The one remaining difference between probe 1 and the kit is
 * the intervening LEG 0 user turn on the core public channel
 * (`POST /api/session/prompt`), so this probe inserts exactly that call and
 * re-tests the same cookie afterwards.
 *
 * Sequence on a private world (own DSH_HOME under tests/homes, ports 3494 /
 * 3499 — inside the documented 3491-3500 family):
 *   1 authenticate                      → cookie
 *   2 catalog.list                      → baseline: cookie works
 *   3 POST /api/session/prompt (turn)   → the kit's LEG 0 shape
 *   4 catalog.list  (SAME cookie)       → 401 here ⇒ the turn rotated the auth
 *   5 team.create   (SAME cookie)       → the kit's exact failure position
 *   6 re-authenticate, catalog.list     → proves recovery is possible
 * Nothing is written outside this worktree; the host is stopped at the end.
 */
import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { startMockModel } from '../../../../../packages/tools/harness/mock-deepseek.mjs'
import { CLIENT_COMMIT_HASH } from '../../../../../tests/paths.mjs'

const WT = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade'
const TESTUSE = join(WT, 'tests', 'deepseek-harness-test-use')
const SRC_HOME = join(WT, 'tests', 'homes', 'rc2-smoke-2026-10-03T14-29-39')
const SRC_BLUEPRINTS = join(WT, '.rc2-smoke-blueprints-2026-10-03T14-29-39')
const STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const HOME = join(WT, 'tests', 'homes', `auth-probe2-${STAMP}`)
const WORKSPACE = join(HOME, 'workspace')
const BLUEPRINTS = join(WT, `.auth-probe2-blueprints-${STAMP}`)
const PORT = 3494
const MOCK_PORT = 3499
const DIAG_DIR = join(WT, 'dev', 'agent-workflow', 'evidence', 'dsh-020rc2-upgrade', 'diag')
const LOG = join(DIAG_DIR, `auth-probe2-${STAMP}.log`)
const say = (line) => {
  const text = `[${new Date().toISOString()}] ${line}`
  console.log(text)
  writeFileSync(LOG, text + '\n', { flag: 'a' })
}

mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
mkdirSync(WORKSPACE, { recursive: true })
mkdirSync(BLUEPRINTS, { recursive: true })
copyFileSync(join(SRC_HOME, 'profiles', 'web', 'cordis.patch.yml'), join(HOME, 'profiles', 'web', 'cordis.patch.yml'))
const patch = readFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), 'utf8')
writeFileSync(
  join(HOME, 'profiles', 'web', 'cordis.patch.yml'),
  patch.replace(/blueprintDir: "[^"]*"/, `blueprintDir: "${BLUEPRINTS}"`),
)
if (existsSync(SRC_BLUEPRINTS)) {
  for (const f of readdirSync(SRC_BLUEPRINTS)) copyFileSync(join(SRC_BLUEPRINTS, f), join(BLUEPRINTS, f))
}
const ROOT_ID = /rootSessionId: "([^"]+)"/.exec(patch)?.[1] ?? 'auth-probe2-root'
writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({ boot: 1, phase: 'create', reportDir: DIAG_DIR, runStamp: STAMP, rootSessionId: ROOT_ID }, null, 2))
say(`world=${HOME} port=${PORT} mock=${MOCK_PORT} root=${ROOT_ID}`)

const mock = await startMockModel({
  port: MOCK_PORT,
  decide: () => ({ kind: 'text', content: 'AUTH_PROBE2_IDLE' }),
  log: () => { /* not needed for this matrix */ },
})

const logPath = join(DIAG_DIR, `auth-probe2-instance-${STAMP}.log`)
const outFd = openSync(logPath, 'a')
const child = spawn(process.execPath, [join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js'), 'web', '--port', String(PORT), '--no-open'], {
  cwd: WORKSPACE,
  stdio: ['ignore', outFd, outFd],
  env: {
    ...process.env,
    DSH_HOME: HOME,
    DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
    DEEPSEEK_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
    DEEPSEEK_API_KEY: 'auth-probe2-mock-key',
  },
})
const deadline = Date.now() + 300_000
let url = null
while (url === null && Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 500))
  const m = /http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/.exec(readFileSync(logPath, 'utf8'))
  if (m !== null) url = { origin: `http://127.0.0.1:${m[1]}`, token: m[2] }
}
if (url === null) {
  say(`FATAL no boot marker in 300s; tail=${readFileSync(logPath, 'utf8').split('\n').slice(-8).join(' | ').slice(0, 600)}`)
  child.kill(); process.exit(1)
}
say(`booted at ${url.origin}`)

const authenticate = async (label) => {
  const res = await fetch(`${url.origin}/?token=${url.token}`, { redirect: 'manual' })
  const setCookie = res.headers.get('set-cookie')
  say(`${label}: authenticate HTTP ${res.status} cookieChars=${setCookie?.length ?? 0}`)
  return setCookie?.split(';', 1)[0] ?? ''
}

const remote = async (label, cookie, method, version, params) => {
  const res = await fetch(`${url.origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `p2-${label}-${Math.random().toString(36).slice(2, 8)}`, method, payload: { version, params } }),
  })
  const text = await res.text()
  let shape = 'non-json'
  try {
    const j = JSON.parse(text)
    shape = `ok=${j?.result?.ok} code=${j?.result?.error?.code ?? '-'} msg=${String(j?.result?.error?.message ?? '').slice(0, 140)}`
  } catch { /* non-json */ }
  say(`[${label}] ${method} → HTTP ${res.status} | ${shape} | rawHead=${text.slice(0, 90)}`)
  return res.status
}

const cookie = await authenticate('step1')
await remote('step2-before-turn', cookie, 'catalog.list', 1, {})

// step 3 — the kit's LEG 0 shape: one user turn on the CORE public channel.
const promptRes = await fetch(`${url.origin}/api/session/prompt`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie },
  body: JSON.stringify({
    type: 'client-request',
    rpcId: `p2-prompt-${Math.random().toString(36).slice(2, 8)}`,
    method: 'session/prompt',
    payload: { args: { request: { requestId: `p2-req-${Math.random().toString(36).slice(2, 8)}`, sessionId: ROOT_ID, mode: 'queue', content: [{ type: 'text', text: 'AUTH_PROBE2_TURN' }] } } },
  }),
})
const promptSetCookie = promptRes.headers.get('set-cookie')
say(`step3: /api/session/prompt → HTTP ${promptRes.status} rotatedSetCookie=${promptSetCookie !== null ? `yes(${promptSetCookie.split(';', 1)[0].length} chars)` : 'no'} bodyHead=${(await promptRes.text()).slice(0, 120)}`)
await new Promise((r) => setTimeout(r, 3000))

await remote('step4-after-turn-same-cookie', cookie, 'catalog.list', 1, {})
await remote('step5-create-after-turn', cookie, 'team.create', 1, { rootSessionId: 'session-auth-probe2-e', blueprintId: 'team.rc2-b', initialWork: { prompt: 'AUTH_PROBE2_WORK' } })
const cookie2 = await authenticate('step6')
await remote('step7-after-reauth', cookie2, 'catalog.list', 1, {})

say('stopping host')
child.kill()
await new Promise((r) => setTimeout(r, 1500))
mock.close?.()
say(`done; world retained at ${HOME}; instance log ${logPath}`)
process.exit(0)
