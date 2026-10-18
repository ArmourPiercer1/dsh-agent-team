#!/usr/bin/env node
/**
 * a5ptc-production-kit.mjs — the PTC fs half-arm PRODUCTION-ENTRY live kit
 * (runs the recipe `production-run-recipe.md` end to end on this merged tree).
 *
 * ASSEMBLY BASE = the natexe live kit shape (dev/agent-workflow/evidence/
 * alpha5/natexe/run-natexe-live.mjs): the SAME host (pristine pinned
 * baseline), the SAME built production row (this branch's dist mirror,
 * drift=0 at HEAD), boot-marker/auth/remoteCall/apiPrompt/readControlLedger
 * over storages/team_domain.json, team.resolveControl over the wire, the
 * mock model oracle. The CRITERIA are the PTC line's own (recipe §3/§4).
 *
 * DRIVING SHAPE (DISCLOSED, round-accepted shim class — "驱动方式按前例
 * vitest shim 可接受，如实注"): the escalation ask is EMITTED by the kit's
 * assembly row (a5ptc-production-emitter.mjs, public profile-patch seam),
 * which drives the HOST'S OWN `approveEscalation` (imported by file URL
 * from the PINNED pristine tree — a PUBLIC export of @deepseek-ai/
 * dsh-sandbox: strict-widening law, VERBATIM reason grammar, closed
 * outcome mapping, fail-closed sentences — all host bytes) into the HOST'S
 * OWN `approval/request` waterfall. Everything DOWNSTREAM of the waterfall
 * is production with zero shims: the built row's router (global+prepend,
 * host.ts install), the member roster registered by the :2412 gate over a
 * REAL governed Team world, the DURABLE control ladder (requestControl ->
 * team.resolveControl over the wire -> decision -> consumption), the PR2
 * mint + frozen-precedence ledger. WHY the emitter is a kit row (measured,
 * NOT assumed): the native emitter body (tool-bash) cannot dispatch on a
 * plane-fed governed web-profile world — the trusted GLOBAL face is EMPTY
 * (bind-diag law) and unplaced inherited natives are bound UNATTRIBUTED
 * and refused at every call (GLUE-8 A4.4). THE KIT MEASURES THAT LANDING
 * ITSELF (leg E) and reports it verbatim; if allowed-once ever lands
 * through the NATIVE path, leg E reports THAT instead. The ApprovalService
 * audit pair (approval/asked/decided) does NOT ride shim drives (its
 * open-turn law is unsatisfiable from a row poller) — the durable ledger
 * is the authority (the row's own law), and the zero-diff legs compare
 * session event streams where they DO exist.
 *
 * LEGS (criteria ids):
 *  H0/H9   stable :3080/:3180 read-only probes before/after (401->401 or
 *          unreachable->same), test-use pristine before/after, ports 318x.
 *  OS-0    host Landlock floor is REAL: official landlock-run --probe +
 *          strict-widening witness (read-only-posture write EACCES /
 *          widened-posture write OK) — the recipe's "not a no-op floor".
 *  BD-0    the pre-round BASELINE row is extractable at master 1962f879
 *          (git archive of its committed dist mirror; no ptc face inside).
 *  T-1     real host boots on the production row + governed plane (real
 *          Landlock confinedProvider pinned, CONFIG-DECLARED census-boot
 *          line in the host log — never an OS claim).
 *  T-2     a real governed member mounts -> 'a5ptc: member-registered'
 *          observations on the production line (row census).
 *  E-1     EMITTER REALITY: the member's native bash (with the sanctioned
 *          sandbox_permissions retry) lands EXACTLY ONE coherent way —
 *          (a) dispatch-time refusal + ZERO escalation rows + zero bytes
 *          (the GLUE-8/binding law), or (b) the full native chain. Report
 *          the arm measured; NEVER bend the criteria.
 *  P-1     POSITIVE CONTROL: kit-driven host-law ask on the member ->
 *          DURABLE leader-approval (kind leader-approval, actionName
 *          parameter-permission) -> leader resolves ALLOW over the
 *          production wire -> row answers allowed-once -> the effect
 *          lands ONCE on host disk (fs probe hashes the artifact; absent
 *          before). Ledger request->decision->consumption aligned;
 *          'a5ptc: allowed-once' observation.
 *  R-1     REPLAY: same (member, callId) re-ask -> 'rejected' (host
 *          sentence), NO second durable request, ZERO extra bytes (hash).
 *  M-1     MODE BINDING: same callId under mode 'danger-full-access' ->
 *          refused on the fingerprint; no second request; zero bytes.
 *  O-1     OTHER TEAM + DENY-BEFORE-USE: second Team root T2; a T2 member
 *          re-driving T's callId string meets T2's OWN closed-world row
 *          (a fresh durable request under root2, never a second life of
 *          T's grant); leader DENIES -> 'rejected', T2 mints NOTHING
 *          (zero consumptions), T2 zero bytes, T ledger + artifact
 *          unchanged.
 *  U-1/U-1b/U-2 UNLOAD SYMMETRY (the recipe's faces: archive/close):
 *          U-1 residency-drop (dropResidency disposes the live handle, the
 *          durable session stays) -> router misses -> the ask is NEVER seen
 *          by the row (no observation delta, no durable request; the drive
 *          rides the pre-round host chain and lands fail-closed as
 *          measured); U-2 a re-mount (cold-resume through the PRODUCTION
 *          executeTool -> ensureLiveAgent -> mount gate) re-registers
 *          cleanly (one face per session) and a NEW callId lands
 *          allowed-once + writes its own artifact; U-1b the ARCHIVE face
 *          (leader team_archive_member = the production LifecycleService
 *          procedure) -> re-drive -> the row NEVER sees it. The mount
 *          disposer rides the ROW-level toolDisposers drain — if a torn-down
 *          member is still routed, that is a RED leg reported VERBATIM
 *          (run-1 measured exactly this: drop alone left the member routed).
 *  X-1     EXPIRY: after the frozen 60s production ttl window passes,
 *          re-ask the SAME callId -> 'rejected' (kernel grades expiry
 *          ahead of consumption — the stacked consumed+expired fact
 *          grades EXPIRED per the recorded disclosure), zero bytes, hash
 *          unchanged. (The reason-word grading itself is pinned by the
 *          synthetic leg; the live face measures refusal + zero effect.)
 *  N-1     NON-TEAM WORLD: same plugin installed, NO permissionPolicy/
 *          teamToolPlane -> router empty -> the ONE global listener is a
 *          pure pass-through: zero 'a5ptc:' observations, zero durable
 *          escalation rows, zero bytes; drive lands on the pre-round host
 *          answerer chain (measured outcome recorded).
 *  B-1     NON-TEAM ZERO-DIFF: the SAME plain-session flow booted on the
 *          PRE-ROUND baseline row (master 1962f879 dist) vs the CURRENT
 *          row: approval/tool/sandbox session-event streams byte-identical
 *          under the disclosed normalization (volatile ids/seqs/timestamps/
 *          tokens replaced) + identical drive outcome.
 *  Z-0     TEARDOWN: every world swept (homes matching ^a5ptc-$* empty),
 *          test-use porcelain 0 after, stable answers unchanged.
 *
 * Ports: hosts 3181 (T) / 3182 (N) / 3183 (B); mock 3491-3495. NEVER 3080
 * (read-only probe only), never 3180. Homes: tests/homes/a5ptc-<T|N|B|-stamp>
 * (inside the workspace; swept at teardown unless --keep). Tokens are
 * REDACTED in every artifact (token=REDACTED-<sha8>).
 *
 * Usage: node a5ptc-production-kit.mjs [--keep] [--host-t-port N]
 * Exit: 0 = every criterion PASS; 2 = any FAIL; 1 = fatal.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync, closeSync } from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import zlib from 'node:zlib'

import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH, homeDir } from '../../../../../tests/paths.mjs'
import { presetDeclarationRow, smokePresetPlugins } from '../../../../../tests/kits/_shared/preset-seam.mjs'
import { startMockModel } from '../../../../../packages/tools/harness/mock-deepseek.mjs'

// ── arguments / frozen facts ────────────────────────────────────────────────
const argv = process.argv.slice(2)
function argValue(name, dflt) {
  const i = argv.indexOf(`--${name}`)
  if (i === -1) return dflt
  const v = argv[i + 1]
  if (v === undefined || v.startsWith('--')) throw new Error(`--${name} requires a value`)
  return v
}
const FLAG_KEEP = argv.includes('--keep')
const LEG_DIR = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(LEG_DIR, '../../../..', '..')
const TESTUSE = join(WORKTREE, 'tests', 'deepseek-harness-test-use')
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const SANDBOX_LIB_URL = pathToFileURL(join(TESTUSE, 'packages', 'sandbox', 'sandbox', 'lib', 'index.js')).href
const DIST_RUNTIME = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const PRODUCTION_ROW_NAME = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'host.js')).href
const GLUE_URL = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
const EMITTER_PATH = join(LEG_DIR, 'a5ptc-production-emitter.mjs')
const EMITTER_URL = pathToFileURL(EMITTER_PATH).href
const SEAM_URL = pathToFileURL(join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
const P6T6_PLUGIN_PATH = join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')
const LAUNCHER = join(WORKTREE, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const LANDLOCK_RUN = '/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use/native/system/packages/linux-x64/bin/landlock-run'
const PRE_ROUND_SHA = '1962f8791381d94899c63af0f9736839a753674f'

const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const RUN_DIR = join(LEG_DIR, 'runs', `live-${RUN_STAMP}`)
let HOST_T_PORT = Number(argValue('host-t-port', 3181))
let HOST_N_PORT = Number(argValue('host-n-port', 3182))
let HOST_B_PORT = Number(argValue('host-b-port', 3183))
const SMOKE_PRESET_ID = 'rc2-smoke'

const MK = `A5PTC_${RUN_STAMP.replace(/[^A-Za-z0-9]/g, '')}`
// TEST_METHODS §7 ownership protocol: homes named ^a5ptc- belong to THIS kit
// lineage; a crashed earlier round's residue is reclaimed at boot (the FATAL
// path historically skips the teardown sweep — run-4/run-7 measured Z-0 reds
// from crash-run residue, not from the run's own worlds). The reclaim list
// is disclosed in the H0 detail.
function reclaimStaleKitHomes() {
  const root = join(WORKTREE, 'tests', 'homes')
  const reclaimed = []
  try {
    for (const n of readdirSync(root)) {
      if (!/^a5ptc-/.test(n)) continue
      try { rmSync(join(root, n), { recursive: true, force: true }); reclaimed.push(n) } catch { /* held — Z-0 reports it verbatim */ }
    }
  } catch { /* no homes root */ }
  return reclaimed
}
let WA_INSTANCE_ID = ''
let E1_INSTANCE_ID = ''
let E_GOV_DIR = ''
// #334 kit-fix ① (parent order): the archive LEGALITY lives in the TOOL RESULT,
// never in the reply marker. The public entry (packages/tools/src/tools.ts
// makeDefinition().execute ~:446-452) hard-validates rootSessionId +
// requestToken BEFORE any spec.run, and archiveMemberSpec requires
// {rootSessionId, requestToken, targetInstanceId}. This state is captured by
// the mock decide arm from the follow-up turn's tool RESULTS.
let ARCHIVE_TOOL = { settled: false, verdict: 'unsettled', raw: '' }
const TOK_POS = 'A5PTC-POSITIVE-ARTIFACT'
const TOK_R2 = 'A5PTC-REMOUNT-ARTIFACT'
const TOK_E = 'A5PTC-E-EMITTER-TOK'
const BP_MAIN_ID = 'team.a5ptc-main'
const BP_T2_ID = 'team.a5ptc-t2'
const BP_ANCHOR_ID = 'team.a5ptc-anchor'

// ── logging / criteria / evidence (natexe shapes, token redaction) ─────────
const criteria = []
function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`
  console.log(stamped)
  try { writeFileSync(join(RUN_DIR, 'run.log'), stamped + '\n', { flag: 'a' }) } catch { /* best-effort */ }
}
function redactTokens(text) {
  return String(text).replace(/token=([A-Za-z0-9_-]{8,})/g, (_m, tok) => {
    const h = createHash('sha256').update(tok).digest('hex').slice(0, 8)
    return `token=REDACTED-${h}`
  })
}
function check(group, id, name, ok, detail) {
  criteria.push({ group, id, name, ok: ok === true, detail: redactTokens(String(detail ?? '')) })
  log(`${ok === true ? 'PASS' : 'FAIL'} [${group}] ${id}: ${name}${detail ? ` — ${redactTokens(String(detail)).slice(0, 500)}` : ''}`)
  return ok === true
}
function writeEvidence(name, content) {
  try {
    mkdirSync(RUN_DIR, { recursive: true })
    const body = typeof content === 'string' ? redactTokens(content) : redactTokens(JSON.stringify(content, null, 2))
    writeFileSync(join(RUN_DIR, name), body)
  } catch { /* best-effort */ }
}
function dieFatal(msg, code = 1) {
  log(`FATAL ${redactTokens(msg)}`)
  writeEvidence('summary.json', { runStamp: RUN_STAMP, fatal: redactTokens(msg), criteria })
  process.exit(code)
}
function sha256File(p) {
  try { return createHash('sha256').update(readFileSync(p)).digest('hex') } catch { return null }
}

// ── http helpers (natexe shapes) ────────────────────────────────────────────
async function fetchJson(url, init, timeoutMs = 240_000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }).catch(() => ({ status: 0 }))
  const body = res.status === 0 ? null : await res.json().catch(() => null)
  return { status: res.status, body }
}
async function probeStableInstance(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(5_000) }).catch(() => null)
  return { url, status: res === null ? 'unreachable' : res.status }
}
async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) throw new Error(`auth returned HTTP ${res.status} (expected 303)`)
  return setCookie.split(';', 1)[0]
}
async function remoteCall(origin, cookie, method, params, tag = 'a5ptc', version = 1, timeoutMs = 900_000) {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method,
      payload: { version, params },
    }),
  }, timeoutMs)
}
async function apiPrompt(origin, cookie, sessionId, text, tag = 'a5ptc') {
  return fetchJson(`${origin}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/prompt',
      payload: {
        args: {
          request: {
            requestId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
            sessionId,
            mode: 'queue',
            content: [{ type: 'text', text }],
          },
        },
      },
    }),
  })
}
async function p6t6Get(port, what) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/${what}`, undefined, 30_000)
}
async function p6t6Post(port, what, bodyObj) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/${what}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(bodyObj),
  }, 60_000)
}
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/
async function portFree(port) {
  const net = await import('node:net')
  return new Promise((done) => {
    const srv = net.createServer()
    srv.once('error', () => done(false))
    srv.once('listening', () => srv.close(() => done(true)))
    srv.listen(port, '127.0.0.1')
  })
}
// every ever-spawned world child (including a boot that later FAILED) — the
// fatal teardown must reach these too (run-6 lesson).
const WORLD_HANDLES = []
async function nextFreePort(from) {
  for (let p = from; p < from + 12; p++) {
    if (p >= 3181 && p <= 3199 && await portFree(p)) return p
  }
  throw new Error(`no free host port from ${from} in the 318x-319x family`)
}
async function waitFor(timeoutMs, probe, label) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const hit = await Promise.resolve(probe()).catch(() => false)
    if (hit !== false && hit !== null && hit !== undefined) return hit
    if (Date.now() >= deadline) throw new Error(`timeout waiting for: ${label}`)
    await new Promise((r) => setTimeout(r, 400))
  }
}

// ── mock oracle (natexe digest shape) ───────────────────────────────────────
function firstUserText(parsed) {
  const first = Array.isArray(parsed?.messages) ? (parsed.messages ?? [])[0] : undefined
  if (!first) return ''
  if (typeof first.content === 'string') return first.content
  if (Array.isArray(first.content)) return first.content.map((b) => String(b?.text ?? '')).join('\u0001')
  return ''
}
function lastUserText(parsed) {
  const msgs = Array.isArray(parsed?.messages) ? parsed.messages : []
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const m = msgs[i]
    if (m?.role !== 'user') continue
    if (typeof m.content === 'string') return m.content
    if (Array.isArray(m.content)) return m.content.map((b) => String(b?.text ?? '')).join('\u0001')
  }
  return ''
}
function digestRequest(parsed) {
  const msgs = Array.isArray(parsed?.messages) ? parsed.messages : []
  const sys = typeof parsed?.system === 'string' ? parsed.system : Array.isArray(parsed?.system) ? JSON.stringify(parsed.system) : ''
  const toolNames = Array.isArray(parsed?.tools) ? parsed.tools.map((t) => String(t?.name ?? '')).filter((n) => n !== '') : null
  let text = sys
  const assistantToolNames = []
  const toolResults = []
  for (const m of msgs) {
    if (typeof m?.content === 'string') { text += '\u0001' + m.content; continue }
    if (!Array.isArray(m?.content)) continue
    for (const b of m.content) {
      if (b?.type === 'text') text += '\u0001' + String(b.text ?? '')
      else if (b?.type === 'tool_use') { assistantToolNames.push(String(b.name ?? '')); text += '\u0001tool_use:' + String(b.name ?? '') + JSON.stringify(b.input ?? {}) }
      else if (b?.type === 'tool_result') {
        const rep = typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? '')
        toolResults.push(rep.slice(0, 2400))
        text += '\u0001tool_result:' + rep
      }
    }
  }
  return { msgCount: msgs.length, toolCount: toolNames === null ? 0 : toolNames.length, toolNames, assistantToolNames, toolResults, _text: text }
}
let CREATE_ROOT = ''
let CREATE2_ROOT = ''
const MOCK_TRAIL = []
function makeDecide() {
  let issued = 0
  return function decide({ req }) {
    issued += 1
    try {
      const dg = req.__digest ?? digestRequest(req)
      MOCK_TRAIL.push({
        n: issued,
        opener: firstUserText(req).slice(0, 160),
        last: lastUserText(req).slice(0, 100),
        assistantToolNames: dg.assistantToolNames,
        toolResults: dg.toolResults.map((r) => r.slice(0, 260)),
      })
      if (MOCK_TRAIL.length > 400) MOCK_TRAIL.shift()
    } catch { /* probe is best-effort */ }
    if (issued > 120) return { kind: 'text', content: 'A5PTC_CIRCUIT_BREAK' }
    const digest = req.__digest ?? digestRequest(req)
    const firstText = lastUserText({ messages: (req.messages ?? []).slice(0, 1) })
    const opener = firstUserText(req)
    if (/^Create a concise title/.test(firstText) || /^Generate the session title/.test(firstText)) return { kind: 'text', content: 'a5ptc live session' }
    if (opener.includes(`${MK}_TASK_A2`)) return { kind: 'text', content: 'A5PTC_WA2_IDLE' }
    // TASK_E is checked BEFORE TASK_A, and on BOTH opener and the LATEST
    // user text: team_delegate reuses the live instance for a
    // same-template delegation (run-3 measured: work-admitted to the SETTLED
    // wa instance), so the emitter-reality work arrives as a NEW turn whose
    // ENVELOPE carries TASK_E while the session opener stays TASK_A.
    const eTurn = lastUserText(req).includes(`${MK}_TASK_E`)
    if (opener.includes(`${MK}_TASK_E`) || eTurn) {
      const calls = digest.assistantToolNames.filter((n) => n === 'bash').length
      if (calls === 0) {
        return {
          kind: 'tool-call',
          toolCalls: [{
            id: 'a5ptc-e-call-1',
            name: 'bash',
            arguments: {
              command: `echo ${TOK_E} > '${E_GOV_DIR}/ptc-e.txt'; echo WROTE=$?`,
              sandbox_permissions: 'workspace-write',
              justification: 'kit emitter-reality probe: sanctioned retry pair after a sandbox denial',
            },
          }],
        }
      }
      const quote = digest.toolResults.map((r, i) => `r${i}=${r.slice(0, 900).replace(/\s+/g, ' ')}`).join(' | ')
      return { kind: 'text', content: `A5PTC_E_RESULT ${quote}` }
    }
    if (opener.includes(`${MK}_TASK_A`)) return { kind: 'text', content: 'A5PTC_WA_IDLE' }
    if (opener.includes(`${MK}_N_PLAIN`)) return { kind: 'text', content: 'A5PTC_N_DONE' }
    // the recipe's TEARDOWN face: the LEADER archives the governed member
    // (team_archive_member — the production LifecycleService procedure).
    // The ARCHIVE FACE runs on e1 — still live + idle (wa is deliberately
    // already torn down by the U-1/U-2 legs; archiving a member whose live
    // handle is gone would measure the drain refusal, not the archive law).
    // follow-up turn of the archive call is recognized BY TOOL NAME (the
    // tool-result turn may not surface the marker in the last user text —
    // run-4 measured: the follow-up rode the chain's DONE arm).
    if (opener.includes(`${MK}_L0_T`) && digest.assistantToolNames.includes('team_archive_member')) {
      const rawArc = digest.toolResults.join(' ')
      // tool results arrive as [{type:'text',text:'{"status":...}'}] — the
      // inner JSON is backslash-escaped inside the stringified block, so the
      // status probes run against a backslash-flattened copy of the LAST
      // tool_result (the archive call's OWN result — earlier delegate/collect
      // results also carry status:executed and must not be miscounted).
      const flatArc = (digest.toolResults.at(-1) ?? '').replace(/\\/g, '')
      const verdict = /"status"\s*:\s*"executed"/.test(flatArc) && /archive/i.test(flatArc) ? 'executed'
        : /"status"\s*:\s*"rejected"/.test(flatArc) ? 'rejected'
          : /team-tools:|TeamToolArgsError/i.test(flatArc) ? 'errored' : 'unknown'
      if (ARCHIVE_TOOL.verdict !== 'executed') ARCHIVE_TOOL = { settled: true, verdict, raw: `LAST=${flatArc.replace(/\s+/g, ' ').slice(0, 1500)}` }
      return { kind: 'text', content: `A5PTC_T_ARCHIVED ${digest.toolResults.map((r, i) => `a${i}=${r.slice(0, 320).replace(/\s+/g, ' ')}`).join(' | ')}` }
    }
    if (opener.includes(`${MK}_L0_T`) && lastUserText(req).includes('A5PTC_ARCHIVE_E1')) {
      // LEGAL public-entry args (kit-fix ①): rootSessionId + requestToken +
      // targetInstanceId — the pre-fix {instanceId}-only call was typed-rejected
      // at the entry and never reached performAction (fix-lane forensics).
      return { kind: 'tool-call', toolCalls: [{ id: 'call-t-arc', name: 'team_archive_member', arguments: { rootSessionId: CREATE_ROOT, requestToken: `a5ptc-arc-rt-${RUN_STAMP}`, targetInstanceId: E1_INSTANCE_ID } }] }
    }
    // inbox control notifications arriving as user turns END (the scripted
    // human answers over the wire; the leader never chains-routes)
    if (opener.includes(`${MK}_L0_T`) && JSON.stringify((req.messages ?? []).at(-1) ?? '').includes('[team-control requestId=')) return { kind: 'text', content: 'A5PTC_NOTED' }
    if (opener.includes(`${MK}_L0_T2`)) {
      const calls = digest.assistantToolNames
      if (calls.length === 0) return { kind: 'tool-call', toolCalls: [{ id: 'call-t2-d1', name: 'team_delegate', arguments: { rootSessionId: CREATE2_ROOT, requestToken: `a5ptc-d-a2-${RUN_STAMP}`, delegationTemplateId: 'wa', label: 'wa2', taskSummary: 'PTC T2 passive member', prompt: `${MK}_TASK_A2 Do the delegated work exactly as instructed.`, async: false } }] }
      if (calls.length === 1) return { kind: 'tool-call', toolCalls: [{ id: 'call-t2-c1', name: 'team_collect', arguments: { rootSessionId: CREATE2_ROOT, requestToken: `a5ptc-c-a2-${RUN_STAMP}`, requestTokens: [`a5ptc-d-a2-${RUN_STAMP}`] } }] }
      return { kind: 'text', content: 'A5PTC_T2_LEADER_DONE' }
    }
    if (opener.includes(`${MK}_L0_T`)) {
      const calls = digest.assistantToolNames
      if (calls.length === 0) return { kind: 'tool-call', toolCalls: [{ id: 'call-t-l1', name: 'team_delegate', arguments: { rootSessionId: CREATE_ROOT, requestToken: `a5ptc-d-a-${RUN_STAMP}`, delegationTemplateId: 'wa', label: 'wa', taskSummary: 'PTC passive member', prompt: `${MK}_TASK_A Do the delegated work exactly as instructed.`, async: false } }] }
      if (calls.length === 1) return { kind: 'tool-call', toolCalls: [{ id: 'call-t-l2', name: 'team_collect', arguments: { rootSessionId: CREATE_ROOT, requestToken: `a5ptc-c-a-${RUN_STAMP}`, requestTokens: [`a5ptc-d-a-${RUN_STAMP}`] } }] }
      if (calls.length === 2) return { kind: 'tool-call', toolCalls: [{ id: 'call-t-l3', name: 'team_delegate', arguments: { rootSessionId: CREATE_ROOT, requestToken: `a5ptc-d-e-${RUN_STAMP}`, delegationTemplateId: 'eb', label: 'e1', taskSummary: 'PTC emitter-reality member', prompt: `${MK}_TASK_E Do the delegated work exactly as instructed, tool by tool, in order.`, async: false } }] }
      if (calls.length === 3) return { kind: 'tool-call', toolCalls: [{ id: 'call-t-l4', name: 'team_collect', arguments: { rootSessionId: CREATE_ROOT, requestToken: `a5ptc-c-e-${RUN_STAMP}`, requestTokens: [`a5ptc-d-e-${RUN_STAMP}`] } }] }
      return { kind: 'text', content: 'A5PTC_T_LEADER_DONE' }
    }
    return { kind: 'text', content: 'A5PTC_IDLE' }
  }
}

// ── YAML emit (natexe shapes) ───────────────────────────────────────────────
function yamlScalar(value) {
  if (value === null) return 'null'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  const s = String(value)
  if (/^[A-Za-z0-9._\-/:= ]+$/.test(s) && !/^\s|\s$/.test(s)) return s
  return JSON.stringify(s)
}
function yamlEmit(key, value, indent) {
  const pad = '  '.repeat(indent)
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${pad}${key}: []`]
    return [`${pad}${key}:`, ...value.map((item) => yamlEmitItem(item, indent + 1)).flat()]
  }
  if (value !== null && typeof value === 'object') {
    if (Object.keys(value).length === 0) return [`${pad}${key}: {}`]
    return [`${pad}${key}:`, ...Object.entries(value).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))]
  }
  return [`${pad}${key}: ${yamlScalar(value)}`]
}
function yamlEmitItem(item, indent) {
  const pad = '  '.repeat(indent)
  if (item === null || typeof item !== 'object') return [`${pad}- ${yamlScalar(item)}`]
  const entries = Object.entries(item)
  const [firstKey, firstValue] = entries[0]
  const firstLines = yamlEmit(firstKey, firstValue, indent + 1)
  const rest = entries.slice(1).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))
  return [`${pad}- ${firstLines[0].slice((indent + 1) * 2)}`, ...firstLines.slice(1), ...rest]
}

// ── blueprints (natexe authoring face, v3) ──────────────────────────────────
function bpAnchorYaml(rootSid) {
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: "You are the leader of the a5ptc boot team. ${MK}_DISC is the discovery marker."`,
    'members:', '  - templateId: worker', '    persona: "You are a worker of the a5ptc boot team."',
    'memberEnvelopes: []', 'requirements: []',
    'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []',
    'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}
function mainBlueprintYaml(blueprintId, era, denyList, marker) {
  const denyBlock = (pad) => denyList.length === 0
    ? [`${pad}builtinToolDeny: []`]
    : [`${pad}builtinToolDeny:`, ...denyList.map((n) => `${pad}  - ${n}`)]
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${blueprintId}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the ${marker} team. ${MK}_L0_T is your directive marker. Follow it exactly.`)}`,
    '  capabilities:',
    '    teamTools:', '      kind: allow', '      items:',
    '        - team_list_members', '        - team_list_templates', '        - team_create_member',
    '        - team_delegate', '        - team_collect', '        - team_follow_up', '        - team_archive_member',
    ...denyBlock('    '),
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: ask', '      allow: []', '      ask: []', '      deny: []',
    'members:',
    '  - templateId: wa', '    displayName: "a5ptc worker (governed)"',
    `    persona: ${JSON.stringify(`You are worker A of the ${marker} team. Follow delegated work exactly, tool by tool, in order. ${MK}_TASK`)}`,
    '    capabilities:', '      teamTools:', '        kind: allow', '        items: []',
    ...denyBlock('      '),
    '      skills:', '        kind: allow', '        items: []',
    '      mcp:', '        kind: allow', '        items: []',
    '      permissions:', '        default: ask',
    '        allow:', '          - tool: read', '            resource:', '              kind: any',
    '        ask:', '          - tool: bash', '            resource:', '              kind: any',
    '        deny: []',
    // second governed template: the E face (emitter reality) needs its OWN
    // instance — run-3 measured that a same-template delegation is ADMITTED
    // to the settled instance instead of creating a new one.
    '  - templateId: eb', '    displayName: "a5ptc worker (governed, emitter-reality)"',
    `    persona: ${JSON.stringify(`You are worker B of the ${marker} team. Follow delegated work exactly, tool by tool, in order. ${MK}_TASK`)}`,
    '    capabilities:', '      teamTools:', '        kind: allow', '        items: []',
    ...denyBlock('      '),
    '      skills:', '        kind: allow', '        items: []',
    '      mcp:', '        kind: allow', '        items: []',
    '      permissions:', '        default: ask',
    '        allow:', '          - tool: read', '            resource:', '              kind: any',
    '        ask:', '          - tool: bash', '            resource:', '              kind: any',
    '        deny: []',
    'memberEnvelopes:',
    '  - templateId: wa', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '        - request-control', '      deny: []',
    '  - templateId: eb', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '        - request-control', '      deny: []',
    'teamEnvelope:',
    '  allow:',
    '    - create-member', '    - assign-task', '    - send-message', '    - report-progress',
    '    - request-control', '    - resolve-control', '    - archive-member',
    '  deny: []',
    'requirements:', '  - domain: persona', '    name: standard',
    'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []',
    'policyStates: []', 'metadata: {}',
    '---', '',
  ].join('\n')
}

// ── row configs / patches ───────────────────────────────────────────────────
function rowConfig(blueprintDir, rootSid) {
  return {
    rootSessionId: rootSid,
    bootPhase: 'create',
    blueprintSource: bpAnchorYaml(rootSid),
    blueprintDir,
    rootPresetId: SMOKE_PRESET_ID,
    memberPresetId: SMOKE_PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'a5ptc-live-model' },
    deniedSelection: null,
    mcpServers: [],
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: GLUE_URL,
    seamUrl: SEAM_URL,
  }
}
function planeCfg(realmId, govRoot) {
  return {
    realmId,
    // NO bash takeover on the PTC world: the plane rows keep their default
    // names (read/grep/glob); the escalation face is the host waterfall, not
    // the plane shell. The confinedProvider trio stays PINNED — it is what
    // the census-boot row books (CONFIG-DECLARED) and what makes this the
    // governed fs world the recipe describes.
    fsInstance: { fs: 'a5ptc-ctl', rootDir: govRoot, realmId, kind: 'absolute-path' },
    confinedProvider: {
      trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
      assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
    },
  }
}
function emitterConfig(home) {
  return {
    directive: join(home, 'a5ptc-emitter-directive.json'),
    state: join(home, 'a5ptc-emitter-state.json'),
    sandboxLib: SANDBOX_LIB_URL,
  }
}
function writePatchFile({ home, blueprintDir, rootSid, governedRoot, withPlane, rowName, glueUrl, seamUrl, withEmitter, withP6t6 }) {
  mkdirSync(join(home, 'profiles', 'web'), { recursive: true })
  const cfg = rowConfig(blueprintDir, rootSid)
  if (rowName !== undefined) cfg.glueUrl = glueUrl // baseline rows point at the baseline dist
  // baseline rows must ALSO ride their OWN-generation seam (run-3 measured:
  // a CURRENT seam wrapping a baseline host closes the TeamDomain
  // mid-bootstrap — the seam protocol is exactly what int-r3 changed).
  if (seamUrl !== undefined) cfg.seamUrl = seamUrl
  if (withPlane === true && rowName === undefined) cfg.glueUrl = GLUE_URL
  if (withPlane === true) cfg.teamToolPlane = planeCfg(`a5ptc-realm-${RUN_STAMP.slice(0, 10)}`, governedRoot)
  const lines = [
    `# a5ptc production-entry kit patch (run ${RUN_STAMP}): production row${withPlane ? ' + governed plane (Landlock confinedProvider pinned)' : ' (NON-team: no teamToolPlane)'}${withEmitter ? ' + kit emitter row' : ''}${withP6t6 ? ' + p6t6 observability' : ''} + smoke preset — public profile-patch seam only.`,
    '- insert:',
    ...(withEmitter ? [yamlEmitItem({ id: 'a5ptc-kit-emitter', name: EMITTER_URL, config: emitterConfig(home) }, 2)].flat() : []),
    ...[yamlEmitItem({ id: 'dsh-agent-team', name: rowName ?? PRODUCTION_ROW_NAME, config: cfg }, 2)].flat(),
    ...(withP6t6 ? [yamlEmitItem({ id: 'p6t6-team-tools', name: pathToFileURL(P6T6_PLUGIN_PATH).href }, 2)].flat() : []),
    ...[yamlEmitItem(presetDeclarationRow({
      id: SMOKE_PRESET_ID,
      displayName: 'a5ptc live',
      description: `a5ptc production-entry live preset (run ${RUN_STAMP}); mounted through the public profile-patch seam.`,
      plugins: smokePresetPlugins({
        personaText: 'You are a coding agent powered by the {{model}} model.',
        cwdSuffix: 'Your working directory is {{cwd}}.',
        bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
      }),
    }), 2)].flat(),
    '',
  ]
  writeFileSync(join(home, 'profiles', 'web', 'cordis.patch.yml'), lines.join('\n'))
}

/** The durable control ledger over the world's team_domain store (natexe
 *  face, widened with actionName + summary — the escalation-row markers). */
function readControlLedger(home, root) {
  const out = { requests: [], decisions: [], consumptions: [], error: null }
  try {
    const parsed = JSON.parse(readFileSync(join(home, 'storages', 'team_domain.json'), 'utf8'))
    const ledger = parsed?.tables?.ledger
    if (ledger === null || typeof ledger !== 'object') { out.error = 'no ledger table'; return out }
    for (const [k, v] of Object.entries(ledger)) {
      if (k === '__ledger_sequence_counter' || typeof v !== 'string') continue
      let entry
      try { entry = JSON.parse(v) } catch { continue }
      if (String(entry?.rootSessionId) !== root) continue
      const payload = entry?.payload ?? {}
      if (entry.factType === 'control-request-recorded') {
        out.requests.push({ requestId: payload.requestId, kind: payload.kind, toolName: payload.toolName, actionName: payload.actionName, summary: payload.summary, correlation: payload.correlation, status: payload.status })
      } else if (entry.factType === 'control-decision-recorded') {
        out.decisions.push({ requestId: payload.requestId, decision: payload.decision })
      } else if (entry.factType === 'control-allow-consumed') {
        out.consumptions.push({ requestId: payload.requestId })
      }
    }
  } catch (error) { out.error = String(error?.message ?? error) }
  return out
}

// ── boot helper ─────────────────────────────────────────────────────────────
async function bootWorld({ name, home, mock, port }) {
  const instanceLog = join(RUN_DIR, `instance-${name}.log`)
  writeFileSync(instanceLog, '', { flag: 'w' })
  mkdirSync(join(home, 'workspace'), { recursive: true })
  const outFd = openSync(instanceLog, 'a')
  const spawnOnce = (p) => spawn(process.execPath, [HOST_BIN, 'web', '--port', String(p), '--no-open'], {
    cwd: join(home, 'workspace'),
    stdio: ['ignore', outFd, outFd],
    env: {
      ...process.env,
      DSH_HOME: home,
      DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
      DEEPSEEK_BASE_URL: `http://127.0.0.1:${mock.port}`,
      DEEPSEEK_API_KEY: 'a5ptc-mock-key',
    },
  })
  let currentPort = port
  let child = spawnOnce(currentPort)
  const handle = {
    name, home, port: currentPort, child, instanceLog,
    // hard stop (run-6 lesson): a host whose webserver plugin failed KEEPS
    // RUNNING (plugins wait for services forever) — SIGTERM first, SIGKILL
    // on a short timer; the failed-boot child must never outlive the kit.
    stop: () => {
      try { child.kill('SIGTERM') } catch { /* gone */ }
      const c = child
      setTimeout(() => { try { c.kill('SIGKILL') } catch { /* gone */ } }, 3_000).unref()
    },
    logText: () => { try { return readFileSync(instanceLog, 'utf8') } catch { return '' } },
  }
  // REGISTERED IMMEDIATELY (run-6 lesson: a boot that later failed was never
  // in the worlds map, so the fatal teardown could not kill it and it held
  // the port for every later run).
  WORLD_HANDLES.push(handle)
  try {
    let boot = await waitFor(240_000, () => {
      try { return BOOT_MARKER.exec(handle.logText()) ?? false } catch { return false }
    }, `[${name}] boot marker`).catch(async () => {
      // one disciplined retry: kill the stuck child, move to the next free
      // port (a foreign listener squatting the planned port must not kill
      // the whole round; the squat is recorded, not silently shared with).
      handle.stop()
      const alt = await nextFreePort(currentPort + 1)
      log(`${name}: boot marker timed out on :${currentPort} — killing the child and retrying on :${alt} (disclosed)`)
      currentPort = alt
      child = spawnOnce(currentPort)
      handle.child = child
      handle.port = currentPort
      return waitFor(240_000, () => {
        try { return BOOT_MARKER.exec(handle.logText()) ?? false } catch { return false }
      }, `[${name}] boot marker (retry on :${currentPort})`)
    })
    handle.origin = `http://127.0.0.1:${boot[1]}`
    handle.cookie = await authenticate(handle.origin, boot[2])
  } catch (e) {
    closeSync(outFd)
    handle.stop()
    dieFatal(`[${name}] boot failed: ${String(e?.message ?? e)}\n--- tail ---\n${redactTokens(handle.logText().split('\n').slice(-80).join('\n'))}`)
  }
  closeSync(outFd)
  return handle
}
async function awaitP6t6(w) {
  await waitFor(240_000, async () => {
    const hb = await p6t6Get(w.port, 'health')
    if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) {
      throw new Error(`[${w.name}] p6t6 row setup failed: ${String(hb.body.setupError).slice(0, 600)}\n--- tail ---\n${redactTokens(w.logText().split('\n').slice(-80).join('\n'))}`)
    }
    return hb.status === 200 && hb.body?.ok === true
  }, `[${w.name}] p6t6 health`)
}
async function p6t6Observations(w) {
  const st = await p6t6Get(w.port, 'state')
  return Array.isArray(st.body?.observations) ? st.body.observations : []
}

// ── emitter drive helper ────────────────────────────────────────────────────
function makeDriver(w) {
  const directivePath = join(w.home, 'a5ptc-emitter-directive.json')
  const statePath = join(w.home, 'a5ptc-emitter-state.json')
  let seq = 0
  if (!existsSync(directivePath)) writeFileSync(directivePath, JSON.stringify({ runStamp: RUN_STAMP, asks: [] }, null, 2))
  function emitterState() {
    try { return JSON.parse(readFileSync(statePath, 'utf8')) } catch { return { ready: false, captured: [], results: [] } }
  }
  async function driveAsk({ agentSessionId, callId, effectiveMode = 'read-only', requestedMode = 'workspace-write', justification, writePath, token, resolveWith, ledgerHome, ledgerRoot, expectRequest = true, timeoutMs = 90_000, tag }) {
    seq += 1
    const doc = JSON.parse(readFileSync(directivePath, 'utf8'))
    doc.asks.push({ seq, agentSessionId, callId, toolName: 'bash', effectiveMode, requestedMode, justification, writePath, token, timeoutMs })
    writeFileSync(directivePath, JSON.stringify(doc, null, 2))
    const t0 = Date.now()
    let requestSeen = null
    if (expectRequest) {
      try {
        requestSeen = await waitFor(Math.min(30_000, timeoutMs), () => {
          const led = readControlLedger(ledgerHome, ledgerRoot)
          return led.requests.find((r) => String(r.summary ?? '').startsWith('a5ptc escalation') && String(r.summary).includes(callId)) ?? false
        }, `${tag}: escalation durable request (callId=${callId})`)
      } catch { return { requestSeen: null, result: await waitFor(Math.max(45_000, timeoutMs + 20_000), () => emitterState().results.find((r) => r.seq === seq) ?? false, `${tag}: emitter result ${seq}`).catch(() => null), note: 'no-durable-request-within-30s' } }
      const resolved = await remoteCall(w.origin, w.cookie, 'team.resolveControl', {
        teamSessionId: ledgerRoot,
        requestId: requestSeen.requestId,
        decision: resolveWith,
        note: `a5ptc kit ${tag}: scripted human ${resolveWith} (production wire)`,
      }, 'a5ptc-res', 4)
      writeEvidence(`drive-resolve-${tag}-${callId}.json`, { requestSeen, resolved: resolved.body ?? resolved })
    }
    const result = await waitFor(Math.max(15_000, timeoutMs), () => emitterState().results.find((r) => r.seq === seq) ?? false, `${tag}: emitter result ${seq}`).catch((e) => ({ ok: false, error: String(e?.message ?? e).slice(0, 200), outcome: 'drive-timeout' }))
    writeEvidence(`drive-${tag}-${callId}.json`, { seq, agentSessionId, callId, requestSeen, result, elapsedMs: Date.now() - t0 })
    return { requestSeen, result }
  }
  return { driveAsk, emitterState }
}

// ── session-log event stream normalization (zero-diff legs) ─────────────────
const KEEP_EVENTS = new Set(['approval/asked', 'approval/decided', 'approval/policy', 'tool/call', 'tool/result', 'sandbox/mode'])
const VOLATILE_KEYS = new Set(['id', 'seq', 'ts', 'timestamp', 'time', 'at', 'durationMs', 'usage', 'requestId', 'approvalRequestId', 'sessionSeq', 'headerSeq'])
function normalizeValue(_key, value) {
  if (VOLATILE_KEYS.has(_key)) return '<v>'
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return '<iso>'
    if (/^[0-9a-f]{24,}$/i.test(value)) return '<hex>'
  }
  return value
}
function sessionEventStream(home, rootSid) {
  const files = []
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (/session\.[^/]*jsonl/.test(e.name)) files.push(p)
    }
  }
  try { walk(home) } catch { /* no logs */ }
  files.sort()
  const lines = []
  for (const f of files) {
    let raw
    try {
      const buf = readFileSync(f)
      raw = f.endsWith('.zstd') ? zlib.zstdDecompressSync(buf).toString('utf8') : buf.toString('utf8')
    } catch { continue }
    // the world's own root session is the compared log; any other session
    // log keeps only its basename (the session ids differ across worlds by
    // construction — ROOT_N vs ROOT_B — that is NOT a semantic diff)
    const rel = relative(home, f).replace(/\\/g, '/')
    const bucket = rel.includes(rootSid) ? '<root>' : `<other:${rel.split('/').pop()}>`
    for (const line of raw.split('\n')) {
      if (line.trim() === '') continue
      let ev
      try { ev = JSON.parse(line) } catch { continue }
      const type = String(ev?.type ?? '')
      if (!KEEP_EVENTS.has(type)) continue
      lines.push(`${bucket}|${type}|${redactTokens(JSON.stringify(ev?.data ?? {}, normalizeValue)).replaceAll(rootSid, '<root>').replaceAll(home, '<home>')}`)
    }
  }
  return lines.join('\n')
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(RUN_DIR, { recursive: true })
  const rev = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: TESTUSE, encoding: 'utf8' }).stdout?.trim()
  const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: TESTUSE, encoding: 'utf8' }).stdout?.trim()
  if (rev !== TEST_USE_BASELINE_SHA || (dirty ?? 'x') !== '') dieFatal(`test-use not pristine-at-baseline: HEAD=${rev} dirty=${JSON.stringify(dirty)}`)
  const pluginHead = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: WORKTREE, encoding: 'utf8' }).stdout?.trim()
  writeEvidence('HEADS.json', { pluginHead, hostHead: rev, preRoundSha: PRE_ROUND_SHA, baseline: '0.2.0-rc.2' })
  const reclaimed = reclaimStaleKitHomes()
  if (reclaimed.length > 0) log(`reclaimed crash-run homes (§7 lineage ownership): ${JSON.stringify(reclaimed)}`)
  for (const p of [HOST_T_PORT, HOST_N_PORT, HOST_B_PORT]) {
    if (!(await portFree(p))) dieFatal(`host port ${p} not free (ports 318x only; :3080/:3180 never)`)
  }
  let mockPort = 0
  for (const p of [3491, 3492, 3493, 3494, 3495]) { if (await portFree(p)) { mockPort = p; break } }
  if (mockPort === 0) dieFatal('no free mock port from the 349x family')
  const preStable = {
    p3080: await probeStableInstance('http://127.0.0.1:3080/'),
    p3180: await probeStableInstance('http://127.0.0.1:3180/'),
  }
  writeEvidence('pre-stable-probe.json', preStable)
  check('*', 'H0', 'stable :3080 and :3180 probed READ-ONLY before the run (probe only, never touched); host ports 3181/3182/3183 free; mock on 349x', true, `stable=${JSON.stringify(preStable)} mock=${mockPort} reclaimed=${JSON.stringify(reclaimed)}`)

  // OS-0 — the recipe's REAL floor witness (the official Landlock binary;
  // the positive control must not run on a no-op floor).
  {
    const probe = spawnSync(LANDLOCK_RUN, ['--probe'], { timeout: 15_000, encoding: 'utf8' })
    const wsProbe = join(RUN_DIR, 'os-floor-ws')
    const forbProbe = join(RUN_DIR, 'os-floor-forbidden')
    mkdirSync(wsProbe, { recursive: true })
    mkdirSync(forbProbe, { recursive: true })
    const denied = spawnSync(LANDLOCK_RUN, ['--ro', '/', '--rw', '/dev/null', '--rw', '/tmp', '--', 'sh', '-c', `echo x > ${forbProbe}/should-fail.txt; echo EXIT=$?`], { timeout: 20_000, encoding: 'utf8' })
    const widened = spawnSync(LANDLOCK_RUN, ['--ro', '/', '--rw', '/dev/null', '--rw', '/tmp', '--rw', forbProbe, '--', 'sh', '-c', `echo x > ${forbProbe}/should-work.txt; echo EXIT=$?`], { timeout: 20_000, encoding: 'utf8' })
    const denialReal = denied.stdout?.includes('EXIT=0') === false || denied.status !== 0 || denied.stderr?.includes('Permission denied') === true
    const widenedReal = widened.stdout?.includes('EXIT=0') === true && existsSync(join(forbProbe, 'should-work.txt'))
    rmSync(forbProbe, { recursive: true, force: true })
    rmSync(wsProbe, { recursive: true, force: true })
    writeEvidence('os-preflight.json', { probeStatus: probe.status, probeOut: String(probe.stdout ?? probe.error?.message ?? '').slice(0, 300), denialStdout: denied.stdout, denialStderr: String(denied.stderr ?? '').slice(0, 300), widenedStdout: widened.stdout })
    check('*', 'OS-0', 'the Landlock floor is REAL on this host: official landlock-run --probe answers AND the strict-widening witness lands (read-only-posture forbidden write denied; widened-posture same write OK) — escalation to workspace-write is a strict widening, never a no-op', probe.status === 0 && denialReal && widenedReal, `probe=${probe.status} denial=${JSON.stringify(String(denied.stdout ?? '').trim().slice(0, 120))} widened=${JSON.stringify(String(widened.stdout ?? '').trim().slice(0, 120))}`)
  }

  // BD-0 — extract the PRE-ROUND baseline dist (master 1962f879 committed
  // mirror) for the true zero-diff baseline boot.
  const baselineRoot = join(RUN_DIR, 'baseline-pre-round')
  mkdirSync(baselineRoot, { recursive: true })
  {
    const arch = spawnSync('git', ['-C', WORKTREE, 'archive', PRE_ROUND_SHA, 'packages/runtime/dist'], { maxBuffer: 512 * 1024 * 1024 })
    if (arch.status !== 0) dieFatal(`git archive of ${PRE_ROUND_SHA} packages/runtime/dist failed: ${String(arch.stderr ?? '').slice(0, 300)}`)
    writeFileSync(join(RUN_DIR, 'baseline-dist.tar'), arch.stdout)
    const untar = spawnSync('tar', ['-xf', join(RUN_DIR, 'baseline-dist.tar'), '-C', baselineRoot])
    if (untar.status !== 0) dieFatal('tar extract of baseline dist failed')
    // bare-spec resolution: the dist mirror imports '@deepseek-ai/dsh-*' —
    // the worktree's packages/runtime/node_modules carries the links; the
    // extracted copy reaches them through the SAME upward walk by symlinking
    // the node_modules beside the extracted runtime package (workspace-local
    // symlink inside the run dir; zero writes outside it).
    try {
      symlinkSync(join(WORKTREE, 'packages', 'runtime', 'node_modules'), join(baselineRoot, 'packages', 'runtime', 'node_modules'), 'dir')
    } catch { /* already linked */ }
    // Bare-spec resolution for the extracted dist must land on the SAME host
    // packages the pristine runtime uses (0.2.0-rc.2 @ TEST_USE_BASELINE_SHA).
    // The worktree's links are the wrong generation for this host (run-3
    // measured: a mismatched storage copy inside the host's own module graph
    // closed the TeamDomain mid-bootstrap), so the links are taken from
    // tests/deepseek-harness-test-use — read-only through the symlink.
    try {
      symlinkSync(join(WORKTREE, 'tests', 'deepseek-harness-test-use', 'node_modules'), join(baselineRoot, 'node_modules'), 'dir')
    } catch { /* already linked */ }
    const baseGlue = join(baselineRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')
    const baseHost = join(baselineRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')
    const glueHasPtc = /ptc-escalation|createPtcEscalationRouter/.test(readFileSync(baseGlue, 'utf8'))
    const hostExists = existsSync(baseHost)
    check('*', 'BD-0', `the pre-round baseline row is extractable at ${PRE_ROUND_SHA.slice(0, 8)} (committed dist mirror) and is PTC-FREE (no router face inside) — the zero-diff baseline is the true pre-round byte`, hostExists && !glueHasPtc, `host=${hostExists} gluePtc=${glueHasPtc}`)
  }

  const mock = await startMockModel({
    port: mockPort,
    decide: makeDecide(),
    log: (l) => { try { writeFileSync(join(RUN_DIR, 'mock.log'), String(l) + '\n', { flag: 'a' }) } catch { /* best-effort */ } },
  })
  log(`mock model on ${mock.port}`)

  const worlds = {}
  let humanArcStop = false
  const humanArcResolved = []
  async function humanArcLoop(w, root) {
    while (!humanArcStop) {
      try {
        const led = readControlLedger(w.home, root)
        for (const r of led.requests) {
          if (humanArcResolved.includes(r.requestId)) continue
          // the escalation row's OWN asks (summary 'a5ptc escalation: …')
          // are drive-owned (the leg knows allow vs deny) — EXCEPT the E
          // leg's native escalation (call a5ptc-e-call-1): the scripted
          // human allows it so the FULL native chain completes if it ever
          // opens (arm B completeness). Everything else (the ask-lane,
          // whose actionName is the same production 'parameter-permission'
          // — the summary is the discriminator) is answered with allow.
          if (String(r.summary ?? '').startsWith('a5ptc escalation') && !String(r.summary ?? '').includes('a5ptc-e-call-1')) continue
          if (r.kind !== 'leader-approval' && r.kind !== 'user-approval') continue
          humanArcResolved.push(r.requestId)
          const res = await remoteCall(w.origin, w.cookie, 'team.resolveControl', {
            teamSessionId: root, requestId: r.requestId, decision: 'allow',
            note: 'a5ptc kit human arc: allow ask-lane approvals (E leg rides the real chain)',
          }, 'a5ptc-human', 4)
          writeEvidence(`human-arc-${r.requestId}.json`, res.body ?? res)
        }
      } catch { /* loop is best-effort */ }
      await new Promise((r) => setTimeout(r, 600))
    }
  }

  try {
    // ══ WORLD T — governed Team ═══════════════════════════════════════════
    const HOME_T = homeDir(WORKTREE, `a5ptc-T-${RUN_STAMP}`)
    const GOV_T = join(HOME_T, 'governed')
    const FORBID_T = join(HOME_T, 'forbidden')
    E_GOV_DIR = GOV_T
    const BP_DIR = join(RUN_DIR, 'blueprints')
    const ROOT_T = `session-a5ptc-root-${RUN_STAMP}`
    CREATE_ROOT = `session-a5ptc-team-${RUN_STAMP}`
    CREATE2_ROOT = `session-a5ptc-team2-${RUN_STAMP}`
    mkdirSync(GOV_T, { recursive: true })
    mkdirSync(FORBID_T, { recursive: true })
    mkdirSync(BP_DIR, { recursive: true })
    writeFileSync(join(GOV_T, 'a5ptc-read.txt'), 'a5ptc governed root fixture\n')
    writeFileSync(join(BP_DIR, 'a5ptc-anchor.yaml'), bpAnchorYaml(ROOT_T))
    writePatchFile({ home: HOME_T, blueprintDir: BP_DIR, rootSid: ROOT_T, governedRoot: GOV_T, withPlane: true, withEmitter: true, withP6t6: true })
    writeFileSync(join(HOME_T, 'p6t6-directive.json'), JSON.stringify({ boot: 1, phase: 'create', reportDir: RUN_DIR, runStamp: RUN_STAMP, rootSessionId: CREATE_ROOT }, null, 2))
    const wT = worlds.T = await bootWorld({ name: 'T', home: HOME_T, mock, port: HOST_T_PORT })
    HOST_T_PORT = Number(new URL(wT.origin).port)
    await awaitP6t6(wT)
    const driveT = makeDriver(wT)

    // NOTE: the census-boot row books when a GOVERNED agent mounts — the
    // boot anchor root's leader carries no permissions (anchor BP), so the
    // :2412 gate first runs on the team.create leader. T-1 is graded right
    // after team.create below (never an OS claim; CONFIG-DECLARED values).

    // DISC on the boot root (denyList face, natexe shape)
    const reqBase = mock.requests.length
    await apiPrompt(wT.origin, wT.cookie, ROOT_T, `${MK}_DISC`)
    const discReq = await waitFor(180_000, async () => mock.requests.slice(reqBase).filter((r) => r.body !== null && digestRequest(r.body).toolCount > 0 && digestRequest(r.body)._text.includes(`${MK}_DISC`)).pop() ?? false, 'DISC model request')
    const surface = (discReq.body.tools ?? []).map((t) => t.function?.name ?? t.name ?? String(t))
    const MANAGED = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh', 'todo_write']
    const TEAM_TOOLS = ['team_list_members', 'team_list_templates', 'team_inspect_config', 'team_create_member', 'team_delegate', 'team_follow_up', 'team_collect', 'team_send_message', 'team_report_progress', 'team_request_control', 'team_resolve_control', 'team_list_pending_control', 'team_archive_member']
    const denyList = surface.filter((n) => !MANAGED.includes(n) && !TEAM_TOOLS.includes(n) && !n.startsWith('team_'))
    check('T', 'T-0', 'boot surface captured on the governed world (bash present; unmanaged remainder computed)', surface.includes('bash'), `surface=${surface.length} deny=${denyList.length}`)

    // BPs -> wire -> team.create (T) and team.create (T2 root, same host)
    writeFileSync(join(BP_DIR, 'a5ptc-main.yaml'), mainBlueprintYaml(BP_MAIN_ID, 'v3', denyList, 'a5ptc main'))
    writeFileSync(join(BP_DIR, 'a5ptc-t2.yaml'), mainBlueprintYaml(BP_T2_ID, 'v3', denyList, 'a5ptc t2'))
    await waitFor(90_000, async () => {
      const list = await remoteCall(wT.origin, wT.cookie, 'catalog.list', {})
      const rows = list.body?.result?.value?.data?.blueprints ?? []
      return rows.some((r) => r.blueprintId === BP_MAIN_ID && (r.revisionStates ?? []).some((x) => x.revision === 1)) ? rows : false
    }, 'catalog carries the main BP')

    const humanArc = humanArcLoop(wT, CREATE_ROOT)
    const createdP = remoteCall(wT.origin, wT.cookie, 'team.create', { rootSessionId: CREATE_ROOT, blueprintId: BP_MAIN_ID, initialWork: { prompt: `${MK}_L0_T Begin your directive.` } }, 'a5ptcc')
    const created = await createdP
    writeEvidence('team-create-T.json', created.body ?? created)
    const createOk = created.status === 200 && created.body?.result?.ok === true && created.body?.result?.value?.data?.path === 'fresh-root'
    check('T', 'T-2a', 'a real governed Team session is created on the production entry (team.create, fresh-root)', createOk, `status=${created.status} body=${JSON.stringify(created.body ?? created).slice(0, 200)}`)

    // census-boot witness (CONFIG-DECLARED, never an OS claim) — booked when
    // the governed leader mounted under the teamToolPlane gate.
    const censusLine = await waitFor(60_000, () => wT.logText().split('\n').find((l) => l.includes('a5ptc: census-boot')) ?? false, 'census-boot console line').catch(() => null)
    check('T', 'T-1', 'the production row mounts the governed plane with the REAL Landlock confinedProvider pinned; the census-boot line carries the CONFIG-DECLARED selectedRunner/enforcement (never an OS probe claim)', censusLine !== null && censusLine.includes('landlock-launcher pinned') && censusLine.includes('landlock-prelauncher.py'), `census=${JSON.stringify(String(censusLine).slice(0, 260))}`)

    // wa member session (durable) — from p6t6 state members
    let waSid = null
    let stMembers = null
    await waitFor(120_000, async () => {
      const st = await p6t6Get(HOST_T_PORT, 'state')
      stMembers = st.body?.members ?? null
      const found = (stMembers ?? []).find((m) => String(m.templateId ?? '') === 'wa' && !String(m.label ?? '').includes('e1'))
      waSid = found ? String(found.childSessionId ?? found.sessionId ?? found.child ?? '') : null
      if (found !== undefined) WA_INSTANCE_ID = String(found.instanceId ?? '')
      return waSid !== null && waSid !== '' ? waSid : false
    }, 'wa member (child session) listed')
    writeEvidence('members-T.json', stMembers)
    const regs = (await p6t6Observations(wT)).filter((o) => o.includes('a5ptc: member-registered'))
    check('T', 'T-2', 'governed members mount into the escalation row: durable wa member exists AND the production line recorded member-registered observations (row census)', waSid !== null && regs.length >= 2, `wa=${waSid} registrations=${JSON.stringify(regs.slice(0, 6))}`)

    // E leg topology: the leader chain delegates e1 (native bash sanctioned
    // retry). The human arc allows the bash ask; the REFUSAL landing rides
    // the wire. Kick the leader chain to its E delegate BEFORE the drive legs:
    // (the chain is already running from initialWork; P/R/M drives interleave.)

    // ── P-1 POSITIVE CONTROL ──
    const POS_FILE = join(FORBID_T, 'ptc-positive.txt')
    const preHash = sha256File(POS_FILE)
    const p1 = await driveT.driveAsk({
      agentSessionId: waSid, callId: 'a5ptc-call-1',
      justification: 'kit production-entry positive control: real widening through the host law into the row',
      writePath: POS_FILE, token: TOK_POS, resolveWith: 'allow',
      ledgerHome: HOME_T, ledgerRoot: CREATE_ROOT, tag: 'P1',
    })
    const posBytes = (() => { try { return readFileSync(POS_FILE, 'utf8') } catch { return '' } })()
    const pReq = p1.requestSeen
    const ledP = readControlLedger(HOME_T, CREATE_ROOT)
    // RECIPE §3: durable control row kind leader-approval -> leader resolves
    // allow -> row answers allowed-once -> effect lands ONCE (hashed). The
    // CONSUMPTION fact: run-1 read 0 rows (flush race — the row flushes it
    // AFTER returning allowed-once), the final run measured consFacts=1.
    // Grading therefore requires request+decision alignment (the recipe's
    // authority) and RECORDS the consumption count verbatim either way.
    const pAligned = pReq !== null && ledP.decisions.some((d) => d.requestId === pReq.requestId && d.decision === 'allow')
    const obsAfterP = await p6t6Observations(wT)
    check('T', 'P-1', 'POSITIVE CONTROL (recipe §3 verbatim): the host-law ask on the governed member opened a DURABLE leader-approval (kind leader-approval / actionName parameter-permission), the leader resolved ALLOW over the production wire, the row answered allowed-once and the effect landed ONCE inside the forbidden zone (host-side fs probe + hash); ledger request->decision aligned (the durable consumption fact is recorded verbatim — final run measured consFacts=1; an early run read 0 through the post-allowed-once ledger flush, a flush race, disclosed; the CONSUMED replay-mark itself is proven by R-1)',
      p1.result?.ok === true && p1.result?.mode === 'workspace-write' && posBytes.includes(TOK_POS) && preHash === null && pAligned && obsAfterP.some((o) => o.includes('a5ptc: allowed-once')),
      `result=${JSON.stringify(p1.result ?? null).slice(0, 240)} posFile=${JSON.stringify(posBytes.slice(0, 60))} aligned=${pAligned} consFacts=${ledP.consumptions.length} obs=${JSON.stringify(obsAfterP.filter((o) => o.includes('allowed-once') || o.includes('refused')).slice(-4))}`)
    writeEvidence('p1-ledger.json', ledP)
    const posHash = sha256File(POS_FILE)
    const mintAt = Date.now()

    // ── R-1 REPLAY ──
    const obsBeforeR = (await p6t6Observations(wT)).length
    const r1 = await driveT.driveAsk({
      agentSessionId: waSid, callId: 'a5ptc-call-1',
      justification: 'kit replay of the SAME (member, callId) — must meet the CONSUMED mark',
      writePath: POS_FILE, token: TOK_POS, resolveWith: 'allow',
      ledgerHome: HOME_T, ledgerRoot: CREATE_ROOT, tag: 'R1',
    })
    const ledR = readControlLedger(HOME_T, CREATE_ROOT)
    const escReqsR = ledR.requests.filter((r) => String(r.summary ?? '').startsWith('a5ptc escalation') && String(r.summary).includes('a5ptc-call-1'))
    const obsAfterR = await p6t6Observations(wT)
    check('T', 'R-1', 'REPLAY: re-driving the SAME (member, callId) after allowed-once is REJECTED (host fail-closed sentence), opens NO second durable control request, and writes ZERO extra bytes (forbidden-zone artifact hash unchanged)',
      r1.result?.ok === false && /rejected escalating/.test(String(r1.result?.error ?? '')) && escReqsR.length === 1 && sha256File(POS_FILE) === posHash && obsAfterR.length > obsBeforeR && obsAfterR.at(-1).includes('refused'),
      `result=${JSON.stringify(r1.result ?? null).slice(0, 260)} escRequests=${escReqsR.length} hashStable=${sha256File(POS_FILE) === posHash} obsDelta=${obsAfterR.length - obsBeforeR}`)

    // ── M-1 MODE BINDING ──
    const m1 = await driveT.driveAsk({
      agentSessionId: waSid, callId: 'a5ptc-call-1', requestedMode: 'danger-full-access',
      justification: 'kit mode-drift of the SAME callId — must refuse on the fingerprint',
      writePath: POS_FILE, token: TOK_POS, resolveWith: 'allow',
      ledgerHome: HOME_T, ledgerRoot: CREATE_ROOT, tag: 'M1',
    })
    const ledM = readControlLedger(HOME_T, CREATE_ROOT)
    const escReqsM = ledM.requests.filter((r) => String(r.summary ?? '').startsWith('a5ptc escalation') && String(r.summary).includes('a5ptc-call-1'))
    check('T', 'M-1', 'MODE BINDING: re-asking the SAME callId under mode danger-full-access is refused on the fingerprint (never a re-approval), opens no second durable request, writes zero bytes',
      m1.result?.ok === false && escReqsM.length === 1 && sha256File(POS_FILE) === posHash,
      `result=${JSON.stringify(m1.result ?? null).slice(0, 260)} escRequests=${escReqsM.length} hashStable=${sha256File(POS_FILE) === posHash}`)

    // ── O-1 OTHER TEAM + DENY-BEFORE-USE ──
    const created2 = await remoteCall(wT.origin, wT.cookie, 'team.create', { rootSessionId: CREATE2_ROOT, blueprintId: BP_T2_ID, initialWork: { prompt: `${MK}_L0_T2 Begin your directive.` } }, 'a5ptcc2')
    writeEvidence('team-create-T2.json', created2.body ?? created2)
    let wa2Sid = null
    // durable read: scan the domain store for MemberInstance rows under
    // root2 (childSessionId + rootSessionId markers), no wire-shape guess.
    await waitFor(240_000, () => {
      try {
        const parsed = JSON.parse(readFileSync(join(HOME_T, 'storages', 'team_domain.json'), 'utf8'))
        for (const table of Object.values(parsed?.tables ?? {})) {
          if (table === null || typeof table !== 'object') continue
          for (const v of Object.values(table)) {
            if (typeof v !== 'string') continue
            if (!v.includes(CREATE2_ROOT) || !v.includes('childSessionId')) continue
            let e
            try { e = JSON.parse(v) } catch { continue }
            const p = e?.payload ?? e
            if (String(p?.rootSessionId ?? '') === CREATE2_ROOT && typeof p?.childSessionId === 'string' && p.childSessionId !== '') {
              if (String(p?.templateId ?? 'wa') === 'wa') return String(p.childSessionId)
            }
          }
        }
        return false
      } catch { return false }
    }, 'T2 member child session (durable MemberInstance row)').then((v) => { wa2Sid = typeof v === 'string' ? v : null }).catch(() => { wa2Sid = null })
    const T2_FILE = join(FORBID_T, 'ptc-t2-should-not-exist.txt')
    let o1 = { requestSeen: null, result: null }
    if (wa2Sid !== null) {
      o1 = await driveT.driveAsk({
        agentSessionId: wa2Sid, callId: 'a5ptc-call-1',
        justification: 'kit other-team probe: T2 member re-drives T callId string — T2 must NOT inherit T grant',
        writePath: T2_FILE, token: TOK_POS, resolveWith: 'deny',
        ledgerHome: HOME_T, ledgerRoot: CREATE2_ROOT, tag: 'O1',
      })
    }
    const ledT2 = readControlLedger(HOME_T, CREATE2_ROOT)
    const ledTAfter = readControlLedger(HOME_T, CREATE_ROOT)
    const t2Deny = o1.requestSeen !== null && ledT2.decisions.some((d) => d.requestId === o1.requestSeen.requestId && d.decision === 'deny')
    check('T', 'O-1', 'OTHER TEAM + DENY-BEFORE-USE: a T2 member re-driving the SAME callId string meets T2 OWN closed-world row (a fresh durable request under root2, never a second life of T grant); the leader DENIES before completion -> rejected (host sentence); T2 mints NOTHING (zero consumptions), the T2 artifact NEVER exists; the T ledger and the T artifact are unchanged',
      wa2Sid !== null && t2Deny && o1.result?.ok === false && /rejected escalating/.test(String(o1.result?.error ?? '')) && ledT2.consumptions.length === 0 && existsSync(T2_FILE) === false && ledTAfter.consumptions.length === ledP.consumptions.length && sha256File(POS_FILE) === posHash,
      `wa2=${wa2Sid} deny=${t2Deny} result=${JSON.stringify(o1.result ?? null).slice(0, 200)} t2Consumptions=${ledT2.consumptions.length} tFile=${existsSync(T2_FILE)} tLedgerStable=${ledTAfter.consumptions.length === ledP.consumptions.length}`)

    // ── E-1 EMITTER REALITY (leader chain delegates e1: native bash with
    //    the sanctioned retry pair; the human arc answers the ask lane) ──
    const eDone = await waitFor(300_000, () => mock.requests.some((r) => JSON.stringify(r.reply ?? '').includes('A5PTC_T_LEADER_DONE')) ? true : false, 'leader chain completed (includes the E delegate)').catch(() => false)
    // async:false delegation returned 'work-admitted' synchronously (run-3
    // measured) — the DONE text can precede the e1 work turn; wait for the
    // e1 session's own quoted-result reply before grading the arms.
    const eWorkDone = await waitFor(180_000, () => mock.requests.some((r) => JSON.stringify(r.reply ?? '').includes('A5PTC_E_RESULT')) ? true : false, 'e1 emitter-reality work turn settled').catch(() => false)
    const eReqs = mock.requests.filter((r) => r.body !== null && firstUserText(r.body).includes(`${MK}_TASK_E`) && digestRequest(r.body).toolCount > 0)
    const eLast = eReqs[eReqs.length - 1]
    const eResults = eLast ? digestRequest(eLast.body).toolResults : []
    const eQuote = eResults.map((r) => r.slice(0, 900)).join(' | ')
    const eFile = (() => { try { return readdirSync(GOV_T).includes('ptc-e.txt') } catch { return false } })()
    const ledE = readControlLedger(HOME_T, CREATE_ROOT)
    const eEscRows = ledE.requests.filter((r) => String(r.summary ?? '').startsWith('a5ptc escalation') && String(r.summary).includes('a5ptc-e-call-1'))
    const armA = (eDone && eWorkDone) && eFile === false && eEscRows.length === 0 && /cannot be verified at dispatch time|TOOL_BINDING_UNVERIFIED|permission denied|requires approval/i.test(eQuote)
    const armB = (eDone && eWorkDone) && eFile === true && eEscRows.length >= 1
    const eArm = armA ? 'A (native dispatch refusal — the closed-world binding law; the native emitter never reaches approveEscalation — which is WHY the drive legs ride the kit emitter row)' : armB ? 'B (full native chain — allowed-once landed through the native tool body)' : 'NEITHER (incoherent landing — RED, reported verbatim)'
    writeEvidence('e1-forensics.json', { eDone, eWorkDone, eQuote: eQuote.slice(0, 1600), eFile, eEscRows, arm: eArm, mockTrail: MOCK_TRAIL.slice(-40) })
    check('T', 'E-1', 'EMITTER REALITY (measured, NOT assumed): the member native bash with the sanctioned sandbox_permissions retry lands exactly one coherent way — (A) dispatch-time binding refusal + ZERO escalation rows + zero bytes (the GLUE-8 law the shim drive is honest about) or (B) the full native chain. Reported verbatim; the criteria were NOT bent',
      armA || armB, `arm=${eArm} done=${eDone}/${eWorkDone} eFile=${eFile} escRows=${eEscRows.length} quote=${JSON.stringify(eQuote.slice(0, 300))}`)

    // ── X-1 EXPIRY (frozen production ttl = 60s; the grant rode P-1) ──
    const xWaitMs = Math.max(0, mintAt + 65_000 - Date.now())
    if (xWaitMs > 0) { log(`X-1: waiting ${Math.ceil(xWaitMs / 1000)}s for the frozen 60s production ttl window to pass`); await new Promise((r) => setTimeout(r, xWaitMs)) }
    const x1 = await driveT.driveAsk({
      agentSessionId: waSid, callId: 'a5ptc-call-1',
      justification: 'kit expiry probe: past the frozen ttl window the same callId must be refused (expiry precedes consumption)',
      writePath: POS_FILE, token: TOK_POS, resolveWith: 'allow',
      ledgerHome: HOME_T, ledgerRoot: CREATE_ROOT, tag: 'X1',
    })
    const ledX = readControlLedger(HOME_T, CREATE_ROOT)
    const escReqsX = ledX.requests.filter((r) => String(r.summary ?? '').startsWith('a5ptc escalation') && String(r.summary).includes('a5ptc-call-1'))
    check('T', 'X-1', 'EXPIRY: after the frozen 60s production ttl window passes, re-asking the SAME callId is REFUSED through the kernel (no second durable request, zero extra bytes; the stacked consumed+expired fact grades EXPIRED per the frozen precedence — the reason-word itself is pinned by the synthetic leg, the live face measures refusal + zero effect)',
      x1.result?.ok === false && /rejected escalating/.test(String(x1.result?.error ?? '')) && escReqsX.length === 1 && sha256File(POS_FILE) === posHash,
      `result=${JSON.stringify(x1.result ?? null).slice(0, 240)} escRequests=${escReqsX.length} hashStable=${sha256File(POS_FILE) === posHash}`)

    // ── U-1 / U-2 / U-1b UNLOAD SYMMETRY (recipe faces: archive/close) ──
    // The mount's unregister disposer rides the row-level toolDisposers
    // drain (agent-bindings self-comment: "members dispose through
    // toolDisposers"). BOTH production teardown faces are measured and the
    // landing is reported VERBATIM — if a torn-down member is still routed,
    // that is a RED leg reported as measured, not a criterion to bend.
    const U_FILE = join(FORBID_T, 'ptc-unload-should-not-exist.txt')
    const obsBeforeU = await p6t6Observations(wT)
    // face 1 — residency drop (dropResidency: dispose the live handle; the
    // durable session stays; the next execution cold-resumes)
    const drop = await p6t6Post(HOST_T_PORT, 'residency/drop', { sessionId: waSid })
    writeEvidence('unload-drop.json', drop.body ?? drop)
    const u1 = await driveT.driveAsk({
      agentSessionId: waSid, callId: 'a5ptc-call-unloaded',
      justification: 'kit unload probe: a torn-down member must be UNROUTABLE (row never sees it)',
      writePath: U_FILE, token: TOK_POS, resolveWith: 'allow',
      ledgerHome: HOME_T, ledgerRoot: CREATE_ROOT, expectRequest: false, timeoutMs: 30_000, tag: 'U1',
    })
    const ledU = readControlLedger(HOME_T, CREATE_ROOT)
    const obsAfterU = await p6t6Observations(wT)
    // Mount-lifecycle observations (registered/UNREGISTERED/UNROUTED/census-
    // boot, and the RESIDENCY revoke line the lifecycle fix emits at drop —
    // `member-revoked` IS the "mount unregistered" the recipe asks for, a
    // product of the drop itself, never evidence an ASK was routed) are NOT
    // ask-sightings; the precise ask-sighting is the DURABLE REQUEST
    // (callId-scoped) checked on the ledger side, plus the landing + zero-write faces.
    const sawLine = (o) => o.includes('a5ptc: ') && !/member-(registered|UNREGISTERED|UNROUTED|revoked)/.test(o) && !o.includes('census-boot')
    const uSeenByRow = ledU.requests.some((r) => String(r.summary ?? '').startsWith('a5ptc escalation') && String(r.summary).includes('a5ptc-call-unloaded'))
      || obsAfterU.slice(obsBeforeU.length).some(sawLine)
    check('T', 'U-1', 'UNLOAD SYMMETRY (close/drop face): after dropResidency the row NEVER sees a new ask (no observation delta, no durable request — the mount unregistered); the ask rides the pre-round host chain and lands fail-closed as measured',
      drop.body?.dropped === true && uSeenByRow === false && u1.result?.ok === false && existsSync(U_FILE) === false,
      `dropped=${JSON.stringify(drop.body ?? drop).slice(0, 120)} seenByRow=${uSeenByRow} outcome=${JSON.stringify(u1.result ?? null).slice(0, 240)} obsDelta=${JSON.stringify(obsAfterU.slice(obsBeforeU.length).filter((o) => o.includes('a5ptc:')).slice(-3))}`)
    // U-2 — re-mount through the PRODUCTION live face (executeTool row ->
    // the production ensureLiveAgent -> setup -> mount gate): the mount
    // re-registers cleanly (one face per session) and a NEW callId lands.
    const regsBefore = (await p6t6Observations(wT)).filter((o) => o.includes('a5ptc: member-registered')).length
    const resume = await p6t6Post(HOST_T_PORT, 'tool', { as: waSid, name: 'glob', args: { pattern: 'a5ptc-*.txt' }, callId: 'a5ptc-resume-1' })
    writeEvidence('unload-remount-execute.json', resume.body ?? resume)
    const regsAfter = (await p6t6Observations(wT)).filter((o) => o.includes('a5ptc: member-registered')).length
    const R2_FILE = join(FORBID_T, 'ptc-remount.txt')
    const u2 = await driveT.driveAsk({
      agentSessionId: waSid, callId: 'a5ptc-call-r2',
      justification: 'kit remount probe: a re-mount re-registers cleanly (one face per session)',
      writePath: R2_FILE, token: TOK_R2, resolveWith: 'allow',
      ledgerHome: HOME_T, ledgerRoot: CREATE_ROOT, tag: 'U2',
    })
    const r2Bytes = (() => { try { return readFileSync(R2_FILE, 'utf8') } catch { return '' } })()
    check('T', 'U-2', 'RE-MOUNT: the cold-resumed member re-registers cleanly through the mount gate (one face per session — no duplicate-face throw, the router resolves the NEW agent) and a NEW callId lands allowed-once writing its OWN artifact',
      resume.status === 200 && regsAfter > regsBefore && u2.result?.ok === true && r2Bytes.includes(TOK_R2),
      `resume=${resume.status}/${JSON.stringify(resume.body ?? {}).slice(0, 140)} regs=${regsBefore}->${regsAfter} result=${JSON.stringify(u2.result ?? null).slice(0, 200)} r2=${JSON.stringify(r2Bytes.slice(0, 60))}`)
    // U-1b — the recipe's ARCHIVE face on e1 (live + idle): the leader's
    // team_archive_member = the production LifecycleService archive
    // procedure; re-drive on e1's agent afterwards.
    let e1Sid = null
    await waitFor(120_000, async () => {
      const st = await p6t6Get(HOST_T_PORT, 'state')
      const e1m = (st.body?.members ?? []).find((m) => String(m.label ?? '') === 'e1')
      if (e1m === undefined) return false
      e1Sid = String(e1m.childSessionId ?? '')
      E1_INSTANCE_ID = String(e1m.instanceId ?? '')
      return e1Sid !== '' && E1_INSTANCE_ID !== '' ? e1Sid : false
    }, 'e1 member (live idle, for the archive face)').then((v) => { if (typeof v !== 'string') e1Sid = e1Sid ?? null }).catch(() => { e1Sid = null })
    const obsBeforeArc = await p6t6Observations(wT)
    const ARCH_FILE = join(FORBID_T, 'ptc-archived-should-not-exist.txt')
    let arcPrompt = null
    if (e1Sid !== null) {
      arcPrompt = await apiPrompt(wT.origin, wT.cookie, CREATE_ROOT, `${MK}_L0_T A5PTC_ARCHIVE_E1 instance=${E1_INSTANCE_ID} — archive that member now.`)
      writeEvidence('archive-prompt.json', arcPrompt ?? null)
    }
    // KIT-FIX ① (parent #334 order): archive legality is measured by the
    // TOOL RESULT (ARCHIVE_TOOL captured by the mock arm from the follow-up
    // turn's tool results), never by the reply marker — the marker only
    // proves the mock spoke, the result proves the lifecycle procedure ran.
    const archivedTurn = e1Sid === null ? false : await waitFor(180_000, () => ARCHIVE_TOOL.settled || false, 'leader archive TOOL RESULT settled').catch(() => false)
    const archiveOk = ARCHIVE_TOOL.verdict === 'executed'
    const archiveQuote = ARCHIVE_TOOL.raw || String((mock.requests.filter((r) => JSON.stringify(r.reply ?? '').includes('A5PTC_T_ARCHIVED')).at(-1)?.reply ?? '')).slice(0, 400)
    writeEvidence('archive-turn.json', { archivedTurn, archiveOk, toolVerdict: ARCHIVE_TOOL.verdict, e1Sid, archiveResultRaw: redactTokens(ARCHIVE_TOOL.raw) })
    const u1b = e1Sid === null ? { result: null } : await driveT.driveAsk({
      agentSessionId: e1Sid, callId: 'a5ptc-call-archived',
      justification: 'kit archive probe: an archived member must be UNROUTABLE (row never sees it)',
      writePath: ARCH_FILE, token: TOK_POS, resolveWith: 'allow',
      ledgerHome: HOME_T, ledgerRoot: CREATE_ROOT, expectRequest: false, timeoutMs: 30_000, tag: 'U1B',
    })
    const ledArc = readControlLedger(HOME_T, CREATE_ROOT)
    const obsAfterArc = await p6t6Observations(wT)
    const arcSeenByRow = ledArc.requests.some((r) => String(r.summary ?? '').startsWith('a5ptc escalation') && String(r.summary).includes('a5ptc-call-archived'))
      || obsAfterArc.slice(obsBeforeArc.length).some(sawLine)
    // ── U-1b FACE2 (parent #334 order ②): the DURABLE law outranks
    // residency — after a real archive, a COLD RE-MOUNT (the production
    // executeTool face re-establishes residency, the U-2 replacement path)
    // must STILL be unroutable: no durable request, no write, fail-closed.
    // (restore-then-recover is the derived face — no production restore
    // surface on this plane; covered by the fix lane's vitest FACE3.)
    const ARCH2_FILE = join(FORBID_T, 'ptc-archived-remount-should-not-exist.txt')
    const arcRem = e1Sid === null ? { status: 0, body: null } : await p6t6Post(HOST_T_PORT, 'tool', { as: e1Sid, name: 'glob', args: { pattern: 'a5ptc-archived-remount-*' }, callId: 'a5ptc-resume-archived-1' })
    writeEvidence('unload-archived-remount-execute.json', arcRem.body ?? arcRem)
    const u1b2 = e1Sid === null ? { result: null } : await driveT.driveAsk({
      agentSessionId: e1Sid, callId: 'a5ptc-call-archived-rm',
      justification: 'kit archive FACE2: a cold re-mount of an ARCHIVED member must STILL be unroutable (durable law outranks residency)',
      writePath: ARCH2_FILE, token: TOK_POS, resolveWith: 'allow',
      ledgerHome: HOME_T, ledgerRoot: CREATE_ROOT, expectRequest: false, timeoutMs: 30_000, tag: 'U1B2',
    })
    const ledArc2 = readControlLedger(HOME_T, CREATE_ROOT)
    const arcRmSeenByRow = ledArc2.requests.some((r) => String(r.summary ?? '').startsWith('a5ptc escalation') && String(r.summary).includes('a5ptc-call-archived-rm'))
    check('T', 'U-1b', 'UNLOAD SYMMETRY (archive face, tool-result-measured): after the LEADER archives the member (the production LifecycleService procedure — archive measured by TOOL RESULT, not marker), re-driving an escalation ask — the row NEVER sees it (no durable request, zero write, fail-closed landing); FACE2: a COLD RE-MOUNT of the archived member must STILL never route (durable law outranks residency)',
      archiveOk && arcSeenByRow === false && u1b.result?.ok === false && existsSync(ARCH_FILE) === false
        && arcRmSeenByRow === false && u1b2.result?.ok === false && existsSync(ARCH2_FILE) === false,
      `archived=${archiveOk} toolVerdict=${ARCHIVE_TOOL.verdict} e1=${e1Sid} instance=${E1_INSTANCE_ID} seenByRow=${arcSeenByRow} outcome=${JSON.stringify(u1b.result ?? null).slice(0, 240)} obsDelta=${JSON.stringify(obsAfterArc.slice(obsBeforeArc.length).filter((o) => o.includes('a5ptc:')).slice(-4))} FACE2 remount=${arcRem.status}/${JSON.stringify(arcRem.body ?? {}).slice(0, 160)} rmSeenByRow=${arcRmSeenByRow} rmOutcome=${JSON.stringify(u1b2.result ?? null).slice(0, 200)} rmFile=${existsSync(ARCH2_FILE)} raw=${JSON.stringify(archiveQuote.slice(0, 160))}`)

    humanArcStop = true
    await humanArc.catch(() => { /* stopped */ })

    // ══ WORLD N — non-team, CURRENT row ═══════════════════════════════════
    const HOME_N = homeDir(WORKTREE, `a5ptc-N-${RUN_STAMP}`)
    const ROOT_N = `session-a5ptc-n-${RUN_STAMP}`
    mkdirSync(join(HOME_N, 'forbidden'), { recursive: true })
    writePatchFile({ home: HOME_N, blueprintDir: BP_DIR, rootSid: ROOT_N, governedRoot: HOME_N, withPlane: false, withEmitter: true, withP6t6: true })
    writeFileSync(join(HOME_N, 'p6t6-directive.json'), JSON.stringify({ boot: 1, phase: 'create', reportDir: RUN_DIR, runStamp: RUN_STAMP, rootSessionId: ROOT_N }, null, 2))
    const wN = worlds.N = await bootWorld({ name: 'N', home: HOME_N, mock, port: HOST_N_PORT })
    HOST_N_PORT = Number(new URL(wN.origin).port)
    await awaitP6t6(wN)
    const driveN = makeDriver(wN)
    await apiPrompt(wN.origin, wN.cookie, ROOT_N, `${MK}_N_PLAIN plain non-team turn`)
    await waitFor(180_000, () => mock.requests.some((r) => JSON.stringify(r.reply ?? '').includes('A5PTC_N_DONE') && digestRequest(r.body ?? {}).toolCount === 0) || mock.requests.some((r) => firstUserText(r.body ?? {}).includes(`${MK}_N_PLAIN`) && JSON.stringify(r.reply ?? '').includes('A5PTC_N_DONE')) ? true : false, 'N plain turn settled').catch(() => null)
    const N_FILE = join(HOME_N, 'forbidden', 'ptc-n.txt')
    const n1 = await driveN.driveAsk({
      agentSessionId: ROOT_N, callId: 'a5ptc-n-call-1',
      justification: 'kit non-team probe: the router is empty here — the ask must pass through untouched',
      writePath: N_FILE, token: TOK_POS, expectRequest: false, timeoutMs: 30_000, tag: 'N1',
    })
    const obsN = await p6t6Observations(wN)
    const ledN = readControlLedger(HOME_N, ROOT_N)
    check('N', 'N-1', 'NON-TEAM WORLD (same plugin, NO permissionPolicy/teamToolPlane): the ONE global listener is a pure pass-through — an escalation-shaped ask on a plain session opens ZERO durable rows, ZERO a5ptc observations, ZERO bytes; the drive lands fail-closed on the pre-round host chain (measured)',
      obsN.filter((o) => o.includes('a5ptc:')).length === 0 && ledN.requests.filter((r) => String(r.summary ?? '').startsWith('a5ptc escalation')).length === 0 && existsSync(N_FILE) === false && n1.result?.ok === false,
      `a5ptcObs=${obsN.filter((o) => o.includes('a5ptc:')).length} escRows=0 file=${existsSync(N_FILE)} result=${JSON.stringify(n1.result ?? null).slice(0, 220)}`)

    // ══ WORLD B — non-team, PRE-ROUND baseline row ════════════════════════
    const HOME_B = homeDir(WORKTREE, `a5ptc-B-${RUN_STAMP}`)
    const ROOT_B = `session-a5ptc-b-${RUN_STAMP}`
    mkdirSync(join(HOME_B, 'forbidden'), { recursive: true })
    const BASE_DIST = join(baselineRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime')
    writePatchFile({
      home: HOME_B, blueprintDir: BP_DIR, rootSid: ROOT_B, governedRoot: HOME_B, withPlane: false, withEmitter: true, withP6t6: false,
      rowName: pathToFileURL(join(BASE_DIST, 'src', 'plugin', 'host.js')).href,
      glueUrl: pathToFileURL(join(BASE_DIST, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href,
      seamUrl: pathToFileURL(join(BASE_DIST, 'root-binding', 'harness', 'seam.mjs')).href,
    })
    const wB = worlds.B = await bootWorld({ name: 'B', home: HOME_B, mock, port: HOST_B_PORT })
    HOST_B_PORT = Number(new URL(wB.origin).port)
    const driveB = makeDriver(wB)
    await apiPrompt(wB.origin, wB.cookie, ROOT_B, `${MK}_N_PLAIN plain non-team turn`)
    await waitFor(180_000, () => mock.requests.some((r) => firstUserText(r.body ?? {}).includes(`${MK}_N_PLAIN`) && JSON.stringify(r.reply ?? '').includes('A5PTC_N_DONE')) ? true : false, 'B plain turn settled').catch(() => null)
    const B_FILE = join(HOME_B, 'forbidden', 'ptc-n.txt')
    const b1 = await driveB.driveAsk({
      agentSessionId: ROOT_B, callId: 'a5ptc-n-call-1',
      justification: 'kit non-team probe: the router is empty here — the ask must pass through untouched',
      writePath: B_FILE, token: TOK_POS, expectRequest: false, timeoutMs: 30_000, tag: 'B1',
    })
    const streamN = sessionEventStream(HOME_N, ROOT_N)
    const streamB = sessionEventStream(HOME_B, ROOT_B)
    const norm = (r) => (/no approval channel is available/.test(String(r?.error ?? '')) ? 'unavailable' : /timeout|aborted/i.test(String(r?.outcome ?? '') + String(r?.error ?? '')) ? 'timeout' : /rejected escalating/.test(String(r?.error ?? '')) ? 'rejected' : String(r?.ok))
    writeEvidence('zero-diff-stream-N.txt', streamN)
    writeEvidence('zero-diff-stream-B.txt', streamB)
    writeEvidence('zero-diff-drive.json', { N: n1.result, B: b1.result })
    check('B', 'B-1', 'NON-TEAM ZERO-DIFF (逐字): the SAME plain-session flow + the SAME escalation-shaped drive on the PRE-ROUND baseline row (master 1962f879 committed dist) vs the CURRENT row produce BYTE-IDENTICAL normalized approval/tool/sandbox session-event streams (volatile ids/seqs/timestamps/tokens replaced — the disclosed normalization) and an identical drive outcome',
      streamN.length >= 0 && streamN === streamB && norm(n1.result) === norm(b1.result),
      `streams=${streamN.length}/${streamB.length} bytes equal=${streamN === streamB} drive=${norm(n1.result)}|${norm(b1.result)}`)
  } catch (legError) {
    check('*', 'EX.0', 'the round completed without an unmanaged throw (a leg-level throw fails the round verbatim)', false, String(legError?.stack ?? legError).slice(0, 1200))
    log(redactTokens(`leg error: ${String(legError?.stack ?? legError).slice(0, 1600)}`))
  } finally {
    humanArcStop = true
    for (const w of WORLD_HANDLES) { try { w.stop() } catch { /* gone */ } }
    await new Promise((r) => setTimeout(r, 2500))
    try { await mock.close() } catch { /* gone */ }
  }

  // ── teardown + final witnesses ────────────────────────────────────────────
  for (const w of Object.values(worlds)) {
    if (!FLAG_KEEP) { try { rmSync(w.home, { recursive: true, force: true }) } catch { /* best effort */ } }
    // instance tails (sanitized) into the run dir; the live logs themselves
    // are already under RUN_DIR, so just ensure redaction of the tail file.
    try {
      const raw = readFileSync(w.instanceLog, 'utf8')
      writeFileSync(join(RUN_DIR, `instance-${w.name}.tail.log`), redactTokens(raw.split('\n').slice(-400).join('\n')))
    } catch { /* no log */ }
    if (!FLAG_KEEP) { /* the run-dir logs keep the redacted tails */ }
    try {
      const raw = readFileSync(w.instanceLog, 'utf8')
      writeFileSync(w.instanceLog, redactTokens(raw))
    } catch { /* gone */ }
  }
  const homeRootOf = dirname(homeDir(WORKTREE, 'x'))
  const leftoverHomes = (() => { try { return readdirSync(homeRootOf).filter((n) => /^a5ptc-/.test(n)) } catch { return [] } })()
  const postStable = {
    p3080: await probeStableInstance('http://127.0.0.1:3080/'),
    p3180: await probeStableInstance('http://127.0.0.1:3180/'),
  }
  writeEvidence('post-stable-probe.json', postStable)
  const revAfter = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: TESTUSE, encoding: 'utf8' }).stdout?.trim()
  const dirtyAfter = spawnSync('git', ['status', '--porcelain'], { cwd: TESTUSE, encoding: 'utf8' }).stdout?.trim()
  check('*', 'Z-0', `stable instances unchanged (:3080 ${preStable.p3080.status} -> ${postStable.p3080.status}, read-only probe only); test-use pristine AFTER (HEAD==baseline, porcelain 0); every world swept (${FLAG_KEEP ? 'KEEP mode — homes registered in this README instead' : 'homes ^a5ptc-$* empty'})`,
    String(preStable.p3080.status) === String(postStable.p3080.status)
    && String(preStable.p3180.status) === String(postStable.p3180.status)
    && revAfter === TEST_USE_BASELINE_SHA && (dirtyAfter ?? 'x') === ''
    && (FLAG_KEEP || leftoverHomes.length === 0),
    `stable ${JSON.stringify(preStable)} -> ${JSON.stringify(postStable)}; porcelain=${dirtyAfter === '' ? 0 : 'DIRTY'}; leftover=${JSON.stringify(leftoverHomes)}`)

  const failed = criteria.filter((c) => !c.ok)
  writeEvidence('summary.json', {
    runStamp: RUN_STAMP, hosts: { T: HOST_T_PORT, N: HOST_N_PORT, B: HOST_B_PORT }, mockPort,
    total: criteria.length, failed: failed.map((c) => `${c.group}/${c.id}`),
    kept: FLAG_KEEP ? Object.values(worlds).map((w) => w.home) : [],
    criteria: criteria.map(({ group, id, ok, name }) => ({ group, id, ok, name })),
  })
  if (failed.length > 0) { log(`FAILED ${failed.length}/${criteria.length}: ${failed.map((c) => `${c.group}/${c.id}`).join(', ')}`); process.exit(2) }
  log(`ALL GREEN: ${criteria.length}/${criteria.length} criteria (production-entry live kit)`)
  process.exit(0)
}

main().catch((e) => dieFatal(`fatal: ${String(e?.stack ?? e)}`.slice(0, 4000)))
