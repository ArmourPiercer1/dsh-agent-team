#!/usr/bin/env node
/**
 * browser-smoke-host.mjs — the SERVED-BUNDLE browser smoke host
 * (PR #35 follow-up, guide §11 E1–E5 / Step H): boots the SAME proven
 * world as the spill E2E kit (seed from the retained mpr smoke world,
 * row patch retargeted to the task worktree dist) and KEEPS it running
 * so a real browser can drive the served client bundle. The seeded mpr
 * world carries only the HOST row (host.js) — the profile gets a second
 * CLIENT row appended (the S8 pattern): the composition-shim package
 * (inert node half + package.json manifest) whose `./client` export IS
 * the built client-bundle.js; without it the dynamic cordis runner never
 * loads the team client half in a browser tab (no 团队 tab, zero
 * /team-remote traffic — the negative result of attempt 1).
 *
 *   E1 — cold member ownership (open the member child fresh;
 *        getReadState(child) = team-member → getProjection(root) —
 *        no prior root visit)
 *   E2 — ordinary session (getReadState = none; NO periodic
 *        getProjection for the ordinary session id)
 *   E3 — lightweight polling (stable team page, ~10s: getReadState
 *        at cadence; getProjection ONLY the cold read)
 *   E4/E5 — live-only / manual-ledger semantics (the browser drives
 *        the UI; the network evidence is the acceptance)
 *
 * The browser leg is driven by the AGENT (browser_* tools) against the
 * printed token URL; this script only owns the host lifecycle:
 *
 *   node browser-smoke-host.mjs --worktree <wt> [--testuse <testuse>]
 *
 * SEED IDENTITY (defaults = the literals this kit was proven against, so an
 * unflagged run is unchanged; a flag only changes where the seed world and
 * its main-team id come FROM, never a durable fact or a check):
 *
 *   --seed-world <world>    REQUIRED. Seed DSH_HOME — a name under
 *                           <main>/tests/homes or an absolute path INSIDE it
 *                           (realpath-checked; '..', symlink escapes,
 *                           empty/ambiguous values and separator-carrying world
 *                           names are fatal; a missing flag is fatal and lists
 *                           the worlds that exist)
 *   --t1 <rootSessionId>    REQUIRED. The selected world's team root; checked
 *                           for shape only, then held to the world's own
 *                           member_instances + session_bindings rows
 *
 * MEMBER IDENTITY is NOT a flag and not a literal: the (member session,
 * member instance) pair this host addresses is DERIVED from the durable store
 * of the selected world and corroborated by its own session_bindings row (the
 * same authority team.getReadState resolves an affiliation from), then
 * re-derived from the COPY that boots. Readiness is positive on that pair —
 * authenticate with the launch token, then require team.getReadState to answer
 * relation=team-member for THIS instance under THIS root; a bare non-405, a
 * 404, or another member's state is NOT readiness.
 *
 * writes smoke-host.json (origin / world / derived member / facts) and prints
 *   READY access-record=<world>/browser-access.json origin=<origin> tokenUrl=<scrubbed>
 * when the route is ready; stays alive until SIGTERM/SIGINT, then
 * tears down (host + mock) and writes teardown.json (stable probes
 * pre==post, ports released, test-use porcelain still empty).
 *
 * *** CONTRACT CHANGE (PR #53 review): the raw launch URL is NO LONGER printed
 * to the console and NEVER enters evidence. A browser lane reads it from the
 * private access record inside the testhome (0600, gitignored), NOT from the
 * READY line. Credentials leave this process only through that record.
 *
 * CREDENTIAL HYGIENE: a v6 team.getReadState answer carries the team's live
 * token (s6-remote.ts gives every team relation its liveToken cell), so BOTH
 * outbound channels are sanitized — scrub() masks `?token=` URL values AND
 * `liveToken`/`lt-v1-…` values in JSON text, and the persisted readyReadState is
 * a redactLiveTokenFields() copy. Assertions always run on the ORIGINAL response
 * object; redaction happens only on the way out. Deterministic check:
 * live-token-redaction-check.mjs (no host, no network, synthetic fixture).
 *
 * PORTS: host = first free of 3181..3186; mock = 3496 (fallback 3497).
 * :3080/:3180 are NEVER bound — read-only probes pre and post.
 */

import { spawn, spawnSync } from 'node:child_process'
import {
  closeSync, existsSync, mkdirSync, openSync, readFileSync,
  readdirSync, realpathSync, rmSync, statSync, writeFileSync,
} from 'node:fs'
import net from 'node:net'
import { createHash } from 'node:crypto'
import { dirname, isAbsolute, join, resolve, sep } from 'node:path'
import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'
import { redactLiveTokenFields, redactLiveTokenText } from './live-token-redact.mjs'

const args = process.argv.slice(2)
function argValue(name, dflt) {
  const i = args.indexOf(`--${name}`)
  if (i === -1) return dflt
  const v = args[i + 1]
  if (v === undefined || v.startsWith('--')) throw new Error(`--${name} requires a value`)
  return v
}

const KIT_DIR = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(KIT_DIR, '..', '..', '..')))
let TESTUSE = resolve(argValue('testuse', join(WORKTREE, 'tests', 'deepseek-harness-test-use')))
if (!existsSync(TESTUSE) && existsSync(join(WORKTREE, '..', '..', 'tests', 'deepseek-harness-test-use'))) {
  TESTUSE = resolve(join(WORKTREE, '..', '..', 'tests', 'deepseek-harness-test-use'))
}
const MAIN = resolve(WORKTREE, '..', '..')
import { TEST_USE_BASELINE_SHA } from '../../../tests/paths.mjs'  // canonical test-infrastructure pin (docs/TEST_METHODS.md §1)
const HOST_BASELINE_SHA = TEST_USE_BASELINE_SHA // canonical pin = tests/paths.mjs (moves with the pinned host generation)
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')

// ── seed-identity overrides ────────────────────────────────────────────────
// The seed world and its team root are REQUIRED flags; there is no default and
// no remembered literal (see requiredSeedInput). Nothing downstream re-derives a
// fact from the CLI — the durable facts below stay as recorded.
const HOMES_ROOT = join(MAIN, 'tests', 'homes')
function flagValue(flag) {
  const i = args.indexOf(flag)
  if (i === -1) return undefined
  const v = args[i + 1]
  if (v === undefined || v.startsWith('--')) dieFatal(`${flag} requires a value`)
  return v
}
/** A seed world: a name under HOMES_ROOT or an absolute path INSIDE it. The
 *  REAL path must stay inside HOMES_ROOT — '..', symlink escapes, empty or
 *  ambiguous values and separator-carrying world names are fatal. */
function insideHomes(flag, raw) {
  if (typeof raw !== 'string' || raw.trim().length === 0) dieFatal(`${flag}: empty value`)
  if (/\s/.test(raw) || raw.startsWith('-') || raw.includes('\\')) dieFatal(`${flag}: ambiguous value ${JSON.stringify(raw)}`)
  if (raw === '.' || raw.split('/').includes('..')) dieFatal(`${flag}: path escape ${JSON.stringify(raw)}`)
  if (!isAbsolute(raw) && raw.includes('/')) dieFatal(`${flag}: a world name must not contain separators: ${JSON.stringify(raw)}`)
  const candidate = isAbsolute(raw) ? resolve(raw) : resolve(HOMES_ROOT, raw)
  let real = null
  let root = null
  try { real = realpathSync(candidate) } catch { dieFatal(`${flag}: does not resolve: ${candidate}`) }
  try { root = realpathSync(HOMES_ROOT) } catch { dieFatal(`homes root missing: ${HOMES_ROOT}`) }
  if (real !== root && !real.startsWith(root + sep)) dieFatal(`${flag}: resolves outside the homes root ${root}: ${real}`)
  if (!statSync(real).isDirectory()) dieFatal(`${flag}: not a directory: ${real}`)
  return candidate
}
function matchingToken(flag, raw, pattern) {
  if (typeof raw !== 'string' || raw.trim().length === 0) dieFatal(`${flag}: empty value`)
  if (!pattern.test(raw)) dieFatal(`${flag}: ${JSON.stringify(raw)} does not match ${pattern}`)
  return raw
}
/**
 * A seed is an INPUT here, never a remembered literal.
 *
 * Both values used to DEFAULT to the world this kit was first proven against
 * (`mpr-2026-09-27T08-35-52` and its `session-mpr-t1-…` team). That made an
 * unflagged run silently select a generation-local artifact: on any host where
 * that retained world no longer exists the kit dies on a stale default instead
 * of naming what is actually available, and on a host where it DOES exist the
 * run silently proves something about the past rather than the current world.
 * A missing seed is now fatal, and the fatal lists the worlds to choose from.
 */
function requiredSeedInput(flag, check) {
  const raw = flagValue(flag)
  if (raw === undefined) {
    let available = []
    try {
      available = readdirSync(HOMES_ROOT).filter((n) => !n.startsWith('.') && !n.startsWith('-'))
    } catch {
      /* the listing is a convenience; the fatality stands on its own */
    }
    dieFatal(`${flag} is REQUIRED — no seed is assumed (the retired default was the mpr-2026-09-27T08-35-52 generation). Worlds available under ${HOMES_ROOT}: ${available.length === 0 ? '(none)' : available.join(', ')}`)
  }
  return check(flag, raw)
}
const SRC_WORLD = requiredSeedInput('--seed-world', insideHomes)
const HOST_PORT_MIN = 3181
const HOST_PORT_MAX = 3186
const MOCK_PORTS = [3496, 3497]
const STABLE_PROBES = ['http://127.0.0.1:3080/', 'http://127.0.0.1:3180/']
const BOOT_TIMEOUT_MS = 300_000
const RUN_STAMP_REQUESTED = `tvs-smoke-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`
// EXCLUSIVE world provisioning (review C). The stamp has second granularity, so two runs started in
// the same second used to land on the SAME tests/homes/<stamp> directory — and the seeding step did
// `rmSync(WORLD)` before `cp -r`, deleting the OTHER run's live world (sessions, locks, durable
// store) out from under it. Provisioning is now an atomic `mkdirSync` of the exact name: an
// existing path is refused, never removed, and we fall forward to a suffixed name. Every
// pre-existing world is left exactly as found; nothing here claims the carrier is what makes the
// world fresh — the exclusivity is.
function provisionWorldDir (homesRoot, base) {
  const candidates = [base, `${base}-p${process.pid}`, ...Array.from({ length: 6 }, (_, i) => `${base}-p${process.pid}-${i + 2}`)]
  for (const name of candidates) {
    const dir = join(homesRoot, name)
    try {
      mkdirSync(dir)                       // non-recursive: an existing path => EEXIST, never touched
      return { runStamp: name, world: dir, requested: base, collided: name !== base, exclusive: true }
    } catch (e) {
      if (e && e.code === 'EEXIST') continue
      dieFatal(`cannot provision the test home ${dir}: ${e && e.message}`)
    }
  }
  dieFatal(`cannot provision a fresh test home under ${homesRoot}: every candidate of ${base} already exists`)
}
const WORLD_PROVISION = provisionWorldDir(HOMES_ROOT, RUN_STAMP_REQUESTED)
const RUN_STAMP = WORLD_PROVISION.runStamp          // == basename(WORLD), and the evidence-dir suffix
const WORLD = WORLD_PROVISION.world
const EVIDENCE_DIR = join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'team-view-sync-complete', `wp9b-browser-smoke-${RUN_STAMP}`)
const INSTANCE_LOG = join(EVIDENCE_DIR, 'instance.log')

// The selected world's team root. The shape check is a typo guard ONLY: the
// former pattern `^session-mpr-t1-…$` encoded one remembered team, which is how
// a valid current-generation root (e.g. a real host run's `session-…`) became
// unaddressable no matter what the durable store said. Identity is settled where
// the truth is — deriveT1MemberPair below dies unless the COPY's own
// member_instances row is rooted at T1 and a team-member binding corroborates it.
const T1 = requiredSeedInput('--t1', (flag, raw) => matchingToken(flag, raw, /^session-[A-Za-z0-9][A-Za-z0-9._:-]*$/))

// The member identity this smoke addresses is DERIVED from the world that is
// actually selected — it is not a literal. An earlier revision pinned
// `session-team-child-…` / `inst-…` here; when the world became --seed-world
// overridable those two literals stayed behind, so a run against a new seed
// still probed (and reported) a member of the OLD world. That is an identity
// coupling, not a parameterization (external review on PR #53 — fix B2). The
// pair now comes from the durable store of the selected world, corroborated by
// the SAME rows team.getReadState resolves an affiliation from:
//   member_instances row -> rootSessionId === T1, a non-leader template, its own
//                           childSessionId;
//   session_bindings row -> kind 'team-member', sessionId === that child
//                           session, and it names THAT instance under THAT root.
// A member of another root, a leader row, or an uncorroborated session id is
// not acceptable here; an unresolvable pair is fatal before anything boots.
const DURABLE_STORE = join('storages', 'team_domain.json')

function durableMemberFacts(storePath, where) {
  if (!existsSync(storePath)) dieFatal(`${where}: durable store missing: ${storePath}`)
  let store = null
  try { store = JSON.parse(readFileSync(storePath, 'utf8')) } catch (e) {
    dieFatal(`${where}: durable store unreadable (${storePath}): ${e.message}`)
  }
  const tables = store?.tables
  if (tables === null || typeof tables !== 'object') dieFatal(`${where}: durable store has no tables object: ${storePath}`)
  const rowOf = (v) => { try { return typeof v === 'string' ? JSON.parse(v) : v } catch { return null } }
  const members = Object.values(tables.member_instances ?? {}).map(rowOf)
    .filter((r) => r !== null && typeof r?.instanceId === 'string')
  const bindings = new Map()
  for (const b of Object.values(tables.session_bindings ?? {}).map(rowOf)) {
    if (b !== null && typeof b?.sessionId === 'string') bindings.set(b.sessionId, b)
  }
  return { members, bindings }
}

/** The single (member session, member instance) pair this smoke addresses. */
function deriveT1MemberPair(storePath, where) {
  const { members, bindings } = durableMemberFacts(storePath, where)
  const rooted = members.filter((r) => r.rootSessionId === T1)
  if (rooted.length === 0) {
    dieFatal(`${where}: the durable store carries no member_instances row rooted at ${T1} — the selected world does not contain the selected team`)
  }
  const explained = rooted.map((r) => `${r.instanceId}/${r.templateId}/${r.childSessionId ?? 'no-child-session'}`)
  const candidates = rooted
    .filter((r) => r.templateId !== 'leader' && typeof r.childSessionId === 'string' && r.childSessionId !== '')
    .filter((r) => {
      const b = bindings.get(r.childSessionId)
      return b?.kind === 'team-member' && b.sessionId === r.childSessionId && b.instanceId === r.instanceId && b.rootSessionId === T1
    })
    // deterministic pick: a plain worker first (the member shape this smoke was
    // proven against), then any corroborated member; instanceId breaks ties.
    .sort((a, b) => (a.templateId === b.templateId ? 0 : a.templateId === 'worker' ? -1 : b.templateId === 'worker' ? 1 : 0)
      || (a.instanceId === b.instanceId ? 0 : a.instanceId < b.instanceId ? -1 : 1))
  if (candidates.length === 0) {
    dieFatal(`${where}: no member of ${T1} has a child session corroborated by a team-member binding (rows: ${explained.join(', ')})`)
  }
  const row = candidates[0]
  const binding = bindings.get(row.childSessionId)
  return {
    memberSession: row.childSessionId,
    memberInstance: row.instanceId,
    templateId: row.templateId,
    label: row.label ?? null,
    lifecycle: row.lifecycle ?? null,
    owningRoot: row.rootSessionId,
    bindingKind: binding.kind,
    corroboratedMembers: candidates.length,
    derivedFrom: storePath,
  }
}

const MEMBER = deriveT1MemberPair(join(SRC_WORLD, DURABLE_STORE), 'seed world')
// The affirmative read state observed at readiness (recorded into evidence).
let READY_READ_STATE = null

function log(msg) { process.stdout.write(`[smoke-host ${new Date().toISOString()}] ${msg}\n`) }
function dieFatal(msg) { log(`FATAL ${msg}`); process.exit(1) }

function gitIn(cwd, argv) {
  const r = spawnSync('git', ['-C', cwd, ...argv], { encoding: 'utf8' })
  return { status: r.status, out: (r.stdout ?? '').trim() }
}
async function isPortFree(port) {
  return new Promise((resolveP) => {
    const s = net.createServer()
    s.once('error', () => resolveP(false))
    s.once('listening', () => s.close(() => resolveP(true)))
    s.listen(port, '127.0.0.1')
  })
}
async function probe(url, timeoutMs = 5_000) {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) })
    return res.status
  } catch { return null }
}
function scrub(text) {
  // Two credential channels, both must be closed on the way OUT (this is a
  // sanitize-for-log helper; the wire and the assertions never see it):
  //  - `?token=<launch token>` URL parameters (the original case);
  //  - `liveToken` / `lt-v1-…` values sitting in JSON fields or free text — a
  //    v6 team.getReadState answer carries the team's live token, so a
  //    token=URL-only scrub leaves it intact (external review block on PR #53).
  return redactLiveTokenText(String(text).replace(/token=[A-Za-z0-9_-]+/g, 'token=SCRUBBED'))
}

/** The launch token -> the session cookie the browser would hold (303 +
 *  set-cookie), same handshake the spill e2e driver uses. The readiness probe
 *  needs it: an UNAUTHENTICATED POST to /team-remote answers something (a 4xx),
 *  and "answered something" is exactly what the old readiness check mistook for
 *  a ready route. */
async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) {
    throw new Error(`dsh web authentication returned HTTP ${res.status} (expected 303 + set-cookie)`)
  }
  return setCookie.split(';', 1)[0]
}

/** One lightweight v6 team.getReadState probe. Returns the status, the parsed
 *  body and the unwrapped result record (null when the host did not answer with
 *  one — a 404 / an auth failure / a typed error all leave `data` null). */
async function remoteReadState(origin, cookie, sessionId, tag) {
  const res = await fetch(`${origin}/team-remote/team.getReadState`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `smoke-${tag}-${Date.now()}`,
      method: 'team.getReadState',
      payload: { version: 6, params: { sessionId } },
    }),
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null)
  const status = res === null ? -1 : res.status
  let body = null
  try { body = res === null ? null : await res.json() } catch { body = null }
  // Unwrap the RPC envelope with the HOUSE convention — the sibling spill driver
  // reads the same answer as `body.result.ok === true ? body.result.value.data`
  // — and the wire confirms it here:
  //   {"type":"server-response","rpcId":…,"result":{"ok":true,"value":{"data":{…}}}}
  // A `{ok:false}` result is a typed error, not a record, so it yields null data.
  // `body.value.data` alone (what this helper did until 2026-10-01) reads a
  // perfectly AFFIRMATIVE answer as null, so readiness polled for its whole 60 s
  // budget and died: observed live in the carrier run, where status=200 and
  // relation / teamSessionId / memberInstanceId / disposed were ALL already
  // satisfied (masked console: dev/agent-workflow/evidence/
  // test-infra-fixture-param/run-carrier-boot-2026-10-01T14-04-27.log).
  const value = body?.result?.ok === true ? body.result.value
    : body?.result != null ? null
      : body?.value ?? null
  const data = value?.data ?? (typeof value?.relation === 'string' ? value : null) ?? null
  return { status, body, data }
}

function waitForLogLine(logPath, predicate, timeoutMs, alive) {
  const deadline = Date.now() + timeoutMs
  let last = -1
  return new Promise((resolveP) => {
    const timer = setInterval(() => {
      if (!alive()) { clearInterval(timer); resolveP(null); return }
      try {
        const content = readFileSync(logPath, 'utf8')
        if (content.length !== last) {
          last = content.length
          const lines = content.split('\n')
          for (let i = lines.length - 1; i >= 0; i -= 1) {
            if (predicate(lines[i])) { clearInterval(timer); resolveP(lines[i]); return }
          }
        }
      } catch { /* not yet */ }
      if (Date.now() > deadline) { clearInterval(timer); resolveP(null) }
    }, 250)
  })
}

/** Retarget the seeded world's profile patch to this worktree (same as the spill kit). */
function rewriteWorldProfile() {
  const p = join(WORLD, 'profiles', 'web', 'cordis.patch.yml')
  let s = readFileSync(p, 'utf8')
  for (const u of [...new Set([...s.matchAll(/file:\/\/\/[^\s"]+/g)].map((m) => m[0]))]) {
    const abs = u.replace(/^file:\/\//, '')
    const idx = abs.indexOf('/packages/')
    if (idx === -1) continue
    const oldRoot = abs.slice(0, idx)
    s = s.split(`${oldRoot}/packages/`).join(`${WORKTREE}/packages/`)
  }
  s = s.split(`${SRC_WORLD}/blueprints`).join(`${WORLD}/blueprints`)
  // The mpr world carries only the HOST row (host.js) — the BROWSER needs the
  // second CLIENT row (the S8 pattern: an inert node half whose package.json
  // manifest serves the `./client` export, the built client-bundle.js, to the
  // dynamic cordis runner). Without it the team client half never loads in a
  // browser tab (no 团队 tab, zero /team-remote traffic).
  //
  // THE ROW GOES IN AN `insert:` LIST. A top-level `- id:`/`- name:` mapping
  // is parsed as a PatchOptions entry TARGETING an (absent) row id and is
  // silently dropped with a per-entry Loader warning — the same
  // "mapping form is silently ignored" trap the mpr profile header warns
  // about (attempts 1+2 of this kit negative-verified it: host inventory
  // lists the row's siblings but never the client row; boot table = 62
  // upstream entries, zero team entries).
  const shimIndex = `${WORKTREE}/packages/client/composition-shim/index.js`
  s += [
    '',
    '# browser client row (S8 pattern — the team client half bundle):',
    '- insert:',
    '    - id: dsh-agent-team-client',
    `      name: "file://${shimIndex}"`,
    '',
  ].join('\n')
  writeFileSync(p, s)
  const check = readFileSync(p, 'utf8')
  if (!check.includes('p6t6-team-tools')) throw new Error('profile rewrite dropped the p6t6 harness row')
  if (!check.includes(`${WORLD}/blueprints`)) throw new Error('profile rewrite missed the blueprintDir retarget')
  if (!check.includes('dsh-agent-team-client')) throw new Error('profile rewrite dropped the client row')
  if (!check.includes(shimIndex)) throw new Error('profile rewrite dropped the client bundle path')
}

function spawnHost({ port, home, logPath, mockPort }) {
  const outFd = openSync(logPath, 'a')
  const errFd = openSync(logPath, 'a')
  let child
  try {
    child = spawn(
      process.execPath,
      [HOST_BIN, 'web', '--port', String(port), '--no-open'],
      {
        cwd: home,
        stdio: ['ignore', outFd, errFd],
        env: {
          ...process.env,
          DSH_HOME: home,
          DSH_CLIENT_COMMIT_HASH: HOST_BASELINE_SHA,
          DEEPSEEK_BASE_URL: `http://127.0.0.1:${mockPort}`,
          DEEPSEEK_API_KEY: 'tvs-smoke-key',
        },
      },
    )
  } catch (error) {
    closeSync(outFd)
    closeSync(errFd)
    throw new Error(`host spawn failed: ${error.message}`)
  }
  const exitInfo = { exited: false, code: undefined, signal: undefined, message: undefined }
  child.on('error', (error) => {
    exitInfo.exited = true
    exitInfo.signal = 'spawn-error'
    exitInfo.message = error.message
  })
  child.on('close', (code, signal) => {
    exitInfo.exited = true
    exitInfo.code = code
    exitInfo.signal = signal
  })
  return { child, exitInfo, alive: () => !exitInfo.exited, logPath }
}

function stopHost(h) {
  if (h.alive()) {
    try { h.child.kill('SIGTERM') } catch { /* already gone */ }
  }
}

async function main() {
  // ── preflight ─────────────────────────────────────────────────────────────
  const head = gitIn(TESTUSE, ['rev-parse', 'HEAD'])
  const porcelain = gitIn(TESTUSE, ['status', '--porcelain'])
  if (head.status !== 0 || head.out !== HOST_BASELINE_SHA) dieFatal(`test-use HEAD mismatch: ${head.out} (want ${HOST_BASELINE_SHA})`)
  if (porcelain.status !== 0 || porcelain.out !== '') dieFatal(`test-use porcelain not empty: ${porcelain.out.slice(0, 80)}`)
  // PR #35 third follow-up P1 (guide §15): the browser evidence is
  // BOUND to the exact tested commit — worktree HEAD + the worktree
  // porcelain as a HARD gate (a dirty working tree cannot prove an
  // immutable commit passed this smoke) + the served client bundle's
  // size + sha256 (which bytes the browser actually loaded). The check
  // runs BEFORE this run creates any artifact (EVIDENCE_DIR is created
  // below the gate): the gate is the strict empty-porcelain form, no
  // self-exclusion needed — an external console redirect must live
  // OUTSIDE the worktree for the same reason.
  const wtHead = gitIn(WORKTREE, ['rev-parse', 'HEAD'])
  const wtPorcelain = gitIn(WORKTREE, ['status', '--porcelain'])
  if (wtHead.status !== 0) dieFatal(`worktree HEAD failed: ${wtHead.out.slice(0, 80)}`)
  if (wtPorcelain.status !== 0 || wtPorcelain.out !== '') dieFatal(`worktree porcelain not empty (the smoke must run on a clean commit): ${wtPorcelain.out.slice(0, 120)}`)
  const BUNDLE_PATH = join(WORKTREE, 'packages', 'client', 'composition-shim', 'client-bundle.js')
  const bundleBytes = readFileSync(BUNDLE_PATH)
  const bundleHash = createHash('sha256').update(bundleBytes).digest('hex')

  mkdirSync(EVIDENCE_DIR, { recursive: true })
  log(`kit: served-bundle browser smoke host`)
  log(`worktree=${WORKTREE} testuse=${TESTUSE}`)
  log(`world=${WORLD} (seed from ${SRC_WORLD})`)
  log(`commit binding: worktree HEAD=${wtHead.out} porcelain='' bundle=${bundleBytes.length}B sha256=${bundleHash.slice(0, 16)}…`)
  const stablePre = {}
  for (const u of STABLE_PROBES) stablePre[u] = await probe(u)
  let hostPort = null
  for (let p = HOST_PORT_MIN; p <= HOST_PORT_MAX; p += 1) {
    if (await isPortFree(p)) { hostPort = p; break }
  }
  let mockPort = null
  for (const p of MOCK_PORTS) {
    if (await isPortFree(p)) { mockPort = p; break }
  }
  if (hostPort === null || mockPort === null) dieFatal('no free port (host 3181..3186 / mock 3496..3497)')
  log(`stable pre=${JSON.stringify(stablePre)} hostPort=${hostPort} mockPort=${mockPort}`)

  // ── seed the world (no spill blueprint — the T1 seed team is enough) ──────
  log(`seeding world ${WORLD} from ${SRC_WORLD} (exclusive provisioning: requested=${WORLD_PROVISION.requested}${WORLD_PROVISION.collided ? ' -> suffixed because that name was taken; nothing was deleted' : ''})`)
  // The directory is ours from the mkdir above, so it must still be empty: seeding into anything
  // else would mean we did not create it. The copy writes CONTENTS (SRC/.), not a nested subdir.
  const preSeed = readdirSync(WORLD)
  if (preSeed.length !== 0) dieFatal(`world dir ${WORLD} is not empty (${preSeed.length} entries) — refusing to seed a directory this run did not exclusively create`)
  const cp = spawnSync('cp', ['-r', `${SRC_WORLD}/.`, WORLD], { encoding: 'utf8' })
  if (cp.status !== 0) dieFatal(`world seed failed: ${cp.stderr}`)
  const sessionsRoot = join(WORLD, 'sessions')
  for (const top of readdirSync(sessionsRoot)) {
    const dir = join(sessionsRoot, top)
    if (!statSync(dir).isDirectory()) continue
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry)
      if (statSync(p).isDirectory() && existsSync(join(p, 'session.lock'))) {
        rmSync(join(p, 'session.lock'))
        log(`removed stale session.lock: ${join(entry, 'session.lock')}`)
      }
    }
  }
  rewriteWorldProfile()
  // Re-derive against the COPY that is about to boot: the pair this smoke
  // addresses must be a fact of the booted world, not only of the seed.
  const memberCopy = deriveT1MemberPair(join(WORLD, DURABLE_STORE), 'seeded copy')
  if (memberCopy.memberSession !== MEMBER.memberSession || memberCopy.memberInstance !== MEMBER.memberInstance) {
    dieFatal(`member identity drifted between seed and copy: seed=${MEMBER.memberSession}/${MEMBER.memberInstance} copy=${memberCopy.memberSession}/${memberCopy.memberInstance}`)
  }
  log(`member identity derived from the world: session=${MEMBER.memberSession} instance=${MEMBER.memberInstance} template=${MEMBER.templateId} label=${MEMBER.label} lifecycle=${MEMBER.lifecycle} owner=${MEMBER.owningRoot} binding=${MEMBER.bindingKind} (${MEMBER.corroboratedMembers} corroborated member(s) of ${T1})`)
  log('world seeded (row patch retargeted to this worktree; stale locks cleared)')

  // ── mock model (world fidelity: the boot side-calls need a model) ─────────
  let MOCK = null
  const MOCK_LOG = join(EVIDENCE_DIR, 'mock.log')
  try {
    MOCK = await startMockModel({
      port: mockPort,
      decide: () => ({ kind: 'text', content: 'smoke host: no work expected' }),
      log: (msg) => { try { writeFileSync(MOCK_LOG, `${msg}\n`, { flag: 'a' }) } catch { /* ignore */ } },
    })
  } catch (e) {
    dieFatal(`mock model failed to start: ${e.message}`)
  }
  log(`mock model on 127.0.0.1:${mockPort}`)

  // ── host boot ─────────────────────────────────────────────────────────────
  const h = spawnHost({ port: hostPort, home: WORLD, logPath: INSTANCE_LOG, mockPort })
  const origin = `http://127.0.0.1:${hostPort}`
  let tokenUrl = null
  try {
    const line = await waitForLogLine(INSTANCE_LOG, (l) => l.includes('/?token='), BOOT_TIMEOUT_MS, h.alive)
    if (line === null) dieFatal(`host boot failed: no boot marker within ${BOOT_TIMEOUT_MS}ms${h.exitInfo.exited ? ` (exit code=${h.exitInfo.code})` : ''}`)
    const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(line.replace(/.*dsh web:\s*/, ''))
    if (m === null || m[1] !== String(hostPort)) dieFatal(`boot marker port mismatch: ${scrub(line)}`)
    tokenUrl = `http://127.0.0.1:${hostPort}/?token=${m[2]}`
    // Readiness = the /team-remote route is mounted AND the derived member's
    // own read state answers positively. The old wait stopped at the first
    // NON-405 status, which a 401/404/typed-error answer also satisfies — it
    // proved nothing about the member the smoke is about to drive (external
    // review on PR #53, fix B2). So: authenticate with the launch token, then
    // poll until team.getReadState(derived member session) answers
    // relation=team-member for THIS instance under THIS root and not disposed.
    const cookie = await authenticate(origin, m[2])
    const tRoute = Date.now()
    let lastStatus = 0
    let lastBody = null
    let readState = null
    while (Date.now() - tRoute < 60_000) {
      const r = await remoteReadState(origin, cookie, MEMBER.memberSession, 'ready')
      lastStatus = r.status
      lastBody = r.body
      const d = r.data
      if (r.status === 200 && d?.relation === 'team-member' && d?.teamSessionId === T1
        && d?.memberInstanceId === MEMBER.memberInstance && d?.disposed === false) {
        readState = d
        break
      }
      await new Promise((rr) => setTimeout(rr, 250))
    }
    if (readState === null) {
      dieFatal(`the /team-remote route never became READY for member ${MEMBER.memberInstance} of ${T1} (never an affirmative team-member read state; last status=${lastStatus}, last answer=${scrub(JSON.stringify(lastBody ?? null)).slice(0, 300)})`)
    }
    log(`route ready (${Date.now() - tRoute}ms after boot marker; readState=${scrub(JSON.stringify(readState)).slice(0, 220)})`)
    // The assertions above ran against the ORIGINAL response object. Only the
    // retained copy is redacted — a field-aware deep copy, so the record still
    // shows WHICH member was verified and on what generation (see
    // live-token-redact.mjs; deterministic check: live-token-redaction-check.mjs).
    READY_READ_STATE = readState
  } catch (e) {
    stopHost(h)
    try { await MOCK.close() } catch { /* ignore */ }
    dieFatal(e.message ?? String(e))
  }

  // The retained evidence NEVER carries the launch token (scrubbed URL).
  writeFileSync(join(EVIDENCE_DIR, 'smoke-host.json'), JSON.stringify({
    runStamp: RUN_STAMP,
    worldProvision: WORLD_PROVISION,
    origin,
    tokenUrl: scrub(tokenUrl),
    hostPort,
    mockPort,
    world: WORLD,
    worktree: WORKTREE,
    worktreeHead: wtHead.out,
    worktreePorcelain: wtPorcelain.out,
    clientBundle: { path: 'packages/client/composition-shim/client-bundle.js', sizeBytes: bundleBytes.length, sha256: bundleHash },
    t1: T1,
    // The addressed member is DERIVED from the booted world's durable rows (see
    // deriveT1MemberPair); the record proves which pair and on whose authority.
    t1MemberSession: MEMBER.memberSession,
    t1MemberInstance: MEMBER.memberInstance,
    memberIdentity: {
      derivedFrom: MEMBER.derivedFrom,
      templateId: MEMBER.templateId,
      label: MEMBER.label,
      lifecycle: MEMBER.lifecycle,
      owningRootSessionId: MEMBER.owningRoot,
      bindingKind: MEMBER.bindingKind,
      corroboratedMembers: MEMBER.corroboratedMembers,
      seedAndCopyAgree: true,
    },
    // Persisted copy only: liveToken is masked here, the in-memory object the
    // assertions judged is untouched (its raw form is never written anywhere).
    readyReadState: redactLiveTokenFields(READY_READ_STATE),
    stablePre,
  }, null, 2))

  // The operational launch URL never enters logs or sanitized evidence. It goes
  // to ONE private access record inside the testhome (gitignored, 0600), which
  // is where a real browser lane reads it from; the console and smoke-host.json
  // carry only the scrubbed form plus the pointer (external review on PR #53).
  const accessRecord = join(WORLD, 'browser-access.json')
  writeFileSync(accessRecord, JSON.stringify({
    note: 'PRIVATE operational record — raw launch URL. Not evidence: never commit, never paste into a log or a report. Valid only while this host is alive.',
    runStamp: RUN_STAMP,
    world: WORLD,
    origin,
    launchUrl: tokenUrl,
    memberSession: MEMBER.memberSession,
    memberInstance: MEMBER.memberInstance,
  }, null, 2), { mode: 0o600 })
  log(`READY access-record=${accessRecord} origin=${origin} tokenUrl=${scrub(tokenUrl)}`)

  // ── stay alive until the agent tears us down ──────────────────────────────
  let stopping = false
  const stop = async (signal) => {
    if (stopping) return
    stopping = true
    log(`stop (${signal}): tearing down`)
    stopHost(h)
    try { await MOCK.close() } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 500))
    const stablePost = {}
    for (const u of STABLE_PROBES) stablePost[u] = await probe(u)
    const porcelainPost = gitIn(TESTUSE, ['status', '--porcelain'])
    const headPost = gitIn(TESTUSE, ['rev-parse', 'HEAD'])
    const portFreeHost = await isPortFree(hostPort)
    const portFreeMock = await isPortFree(mockPort)
    writeFileSync(join(EVIDENCE_DIR, 'teardown.json'), JSON.stringify({
      stablePost,
      stableUnchanged: JSON.stringify(stablePre) === JSON.stringify(stablePost),
      porcelainPost: porcelainPost.out,
      headPost: headPost.out,
      portFreeHost,
      portFreeMock,
    }, null, 2))
    writeFileSync(join(EVIDENCE_DIR, 'instance.log.scrubbed'), scrub(readFileSync(INSTANCE_LOG, 'utf8')))
    try { if (existsSync(MOCK_LOG)) writeFileSync(join(EVIDENCE_DIR, 'mock.log.scrubbed'), scrub(readFileSync(MOCK_LOG, 'utf8'))) } catch { /* ignore */ }
    log('teardown done')
    process.exit(0)
  }
  process.on('SIGTERM', () => { void stop('SIGTERM') })
  process.on('SIGINT', () => { void stop('SIGINT') })
  // The host dying on its own = an early fatal.
  const watchdog = setInterval(() => {
    if (!h.alive() && !stopping) {
      try { stopHost(h) } catch { /* ignore */ }
      try { void MOCK?.close() } catch { /* ignore */ }
      log(`FATAL host exited early (code=${h.exitInfo.code} signal=${h.exitInfo.signal ?? 'none'}) — log tail: ${scrub(readFileSync(INSTANCE_LOG, 'utf8').split('\n').slice(-20).join(' | '))}`)
      process.exit(1)
    }
  }, 1_000)
  process.on('exit', () => { clearInterval(watchdog) })
}

main().catch((e) => dieFatal(`unhandled: ${e.stack ?? e}`))
