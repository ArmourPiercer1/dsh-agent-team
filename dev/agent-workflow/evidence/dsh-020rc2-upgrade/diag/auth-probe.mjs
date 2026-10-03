#!/usr/bin/env node
/**
 * DIAGNOSTIC PROBE (throwaway, evidence-only) — 0.2.0-rc.2 upgrade round.
 *
 * Question: in the rc2 real-host smoke run the FIRST `/team-remote` POST of a
 * freshly authenticated web session (`team.create`, contract v1, with
 * initialWork) is answered by the HOST with a bare HTTP 401 (no JSON body),
 * while later out-of-band POSTs on the same mounted channel
 * (`catalog.list`, `team.listRoots`) succeed with a freshly minted cookie.
 *
 * This probe boots a private world the same way the kit does (public
 * profile-patch seam only, port 3493 / mock 3498 — inside the documented
 * 3491-3500 test family), authenticates exactly like the kit
 * (`GET /?token=` → 303 + set-cookie), and then walks a matrix of reads and
 * writes over the mounted channel to separate the three candidate causes:
 *   (1) the method (team.create specifically),
 *   (2) the write lane (any state-changing method on a mounted channel),
 *   (3) the session/cookie (the kit's cookie vs a fresh one).
 *
 * It creates no production state: every root it creates lives in its own
 * DSH_HOME under tests/homes/ and the host is stopped at the end.
 */
import { spawn, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { startMockModel } from '../../../../../packages/tools/harness/mock-deepseek.mjs'
import { CLIENT_COMMIT_HASH } from '../../../../../tests/paths.mjs'

const WT = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade'
const TESTUSE = join(WT, 'tests', 'deepseek-harness-test-use')
const SRC_HOME = join(WT, 'tests', 'homes', 'rc2-smoke-2026-10-03T14-29-39')
const SRC_BLUEPRINTS = join(WT, '.rc2-smoke-blueprints-2026-10-03T14-29-39')
const STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const HOME = join(WT, 'tests', 'homes', `auth-probe-${STAMP}`)
const WORKSPACE = join(HOME, 'workspace')
const BLUEPRINTS = join(WT, `.auth-probe-blueprints-${STAMP}`)
const PORT = 3493
const MOCK_PORT = 3498
const DIAG_DIR = join(WT, 'dev', 'agent-workflow', 'evidence', 'dsh-020rc2-upgrade', 'diag')
const LOG = join(DIAG_DIR, `auth-probe-${STAMP}.log`)

const say = (line) => {
  const text = `[${new Date().toISOString()}] ${line}`
  console.log(text)
  writeFileSync(LOG, text + '\n', { flag: 'a' })
}

// ── private world (copy the kit's materialized patch + blueprints) ──────────
mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
mkdirSync(WORKSPACE, { recursive: true })
mkdirSync(BLUEPRINTS, { recursive: true })
mkdirSync(DIAG_DIR, { recursive: true })
copyFileSync(join(SRC_HOME, 'profiles', 'web', 'cordis.patch.yml'), join(HOME, 'profiles', 'web', 'cordis.patch.yml'))
// Rewrite the row config's blueprintDir to this probe's copy.
const patch = readFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), 'utf8')
writeFileSync(
  join(HOME, 'profiles', 'web', 'cordis.patch.yml'),
  patch.replace(/blueprintDir: "[^"]*"/, `blueprintDir: "${BLUEPRINTS}"`),
)
for (const f of existsSync(SRC_BLUEPRINTS) ? (await import('node:fs')).readdirSync(SRC_BLUEPRINTS) : []) {
  copyFileSync(join(SRC_BLUEPRINTS, f), join(BLUEPRINTS, f))
}
const ROOT_ID = /rootSessionId: "([^"]+)"/.exec(patch)?.[1] ?? 'auth-probe-root'
writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({ boot: 1, phase: 'create', reportDir: DIAG_DIR, runStamp: STAMP, rootSessionId: ROOT_ID }, null, 2))
say(`world=${HOME} port=${PORT} mock=${MOCK_PORT} root=${ROOT_ID}`)

const mockLog = join(DIAG_DIR, `auth-probe-mock-${STAMP}.log`)
const mock = await startMockModel({
  port: MOCK_PORT,
  decide: () => ({ kind: 'text', content: 'AUTH_PROBE_IDLE' }),
  log: (l) => { try { writeFileSync(mockLog, l + '\n', { flag: 'a' }) } catch { /* best effort */ } },
})
say(`mock listening on ${mock.port}`)

// ── boot ───────────────────────────────────────────────────────────────────
const logPath = join(DIAG_DIR, `auth-probe-instance-${STAMP}.log`)
const { openSync } = await import('node:fs')
const outFd = openSync(logPath, 'a')
const child = spawn(process.execPath, [join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js'), 'web', '--port', String(PORT), '--no-open'], {
  cwd: WORKSPACE,
  stdio: ['ignore', outFd, outFd],
  env: {
    ...process.env,
    DSH_HOME: HOME,
    DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
    DEEPSEEK_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
    DEEPSEEK_API_KEY: 'auth-probe-mock-key',
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
  say(`FATAL no boot marker in 300s; log tail: ${readFileSync(logPath, 'utf8').split('\n').slice(-12).join(' | ').slice(0, 900)}`)
  child.kill(); mock.close?.(); process.exit(1)
}
say(`booted at ${url.origin}`)

const authenticate = async () => {
  const res = await fetch(`${url.origin}/?token=${url.token}`, { redirect: 'manual' })
  const setCookie = res.headers.get('set-cookie')
  say(`authenticate: status=${res.status} cookieChars=${setCookie?.length ?? 0}`)
  return setCookie?.split(';', 1)[0] ?? ''
}
const cookie = await authenticate()

const call = async (label, method, version, params, extraHeaders = {}, redirect = 'manual') => {
  try {
    const res = await fetch(`${url.origin}/team-remote/${method}`, {
      method: 'POST',
      redirect,
      headers: { 'content-type': 'application/json', cookie, ...extraHeaders },
      body: JSON.stringify({ type: 'client-request', rpcId: `probe-${label}-${Math.random().toString(36).slice(2, 8)}`, method, payload: { version, params } }),
    })
    const text = await res.text()
    let shape = 'non-json'
    try {
      const j = JSON.parse(text)
      shape = `json ok=${j?.result?.ok} code=${j?.result?.error?.code ?? '-'} msg=${String(j?.result?.error?.message ?? '').slice(0, 120)} path=${j?.result?.value?.data?.path ?? '-'}`
    } catch { /* non-json */ }
    say(`[${label}] ${method} v${version} → HTTP ${res.status} | ${shape} | raw=${text.slice(0, 160)}`)
  } catch (e) {
    say(`[${label}] ${method} v${version} → FETCH ERROR ${String(e?.message ?? e)}`)
  }
}

const BP_B = 'team.rc2-b'
await call('A-read', 'catalog.list', 1, {})
await call('B-write-lane-bogus', 'team.resolveControl', 4, { rootSessionId: ROOT_ID, requestId: 'probe-nope', decision: 'allow' })
await call('C-create-no-initial-work', 'team.create', 1, { rootSessionId: 'session-auth-probe-c', blueprintId: BP_B })
await call('D-create-with-origin', 'team.create', 1, { rootSessionId: 'session-auth-probe-d', blueprintId: BP_B }, { origin: url.origin })
await call('E-create-with-initial-work', 'team.create', 1, { rootSessionId: 'session-auth-probe-e', blueprintId: BP_B, initialWork: { prompt: 'AUTH_PROBE_WORK' } })
const cookie2 = await authenticate()
await call('F-create-fresh-cookie', 'team.create', 1, { rootSessionId: 'session-auth-probe-f', blueprintId: BP_B }, { /* fresh cookie below */ })
say(`(F used the first cookie; second cookie chars=${cookie2.length})`)
await call('G-read-again', 'team.listRoots', 6, {})

say('stopping host')
child.kill()
await new Promise((r) => setTimeout(r, 1500))
try { spawnSync('pkill', ['-f', `homes/auth-probe-${STAMP}`]) } catch { /* best effort */ }
mock.close?.()
say(`done; world retained at ${HOME}; instance log ${logPath}`)
process.exit(0)
