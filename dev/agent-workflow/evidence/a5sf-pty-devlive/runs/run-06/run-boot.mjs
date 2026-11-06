#!/usr/bin/env node
/**
 * run-boot.mjs — the Shell/PTY face's DEV-LIVE iteration driver
 * (`a5sf-pty-devlive`).
 *
 * DERIVED FROM TWO DRIVERS, each for one measured reason:
 *
 *   - `evidence/a5sf-web-devlive/run-boot.mjs` supplies the WORKING dev-live
 *     loop: a POLLING health gate (a 404 while the product boot is still pending
 *     means PENDING, not failed), a DISCOVERY-FIRST leader blueprint (the
 *     leader's model-visible surface is read from the mock's own first request
 *     and every unmanaged name is denied, because A2C-2 refuses `team.create`
 *     otherwise — BL-17 boot #4 died exactly there), the dev-live grant/lease/
 *     ledger/outcome rows and one evidence directory per start.
 *   - `evidence/a5sf-bl17-live2/run-boot.mjs` supplies the FOUR Shell-PTY
 *     questions and their instruments (the confined-realm provider row and the
 *     `bash_probe` caller). It never reached a single case: its one start died
 *     at `team.create` before its own probe design could be exercised.
 *
 * WHAT THIS LANE ADDED AFTER READING THE PRODUCT (zero boots, before the first
 * start): BL-17's probe design could NOT attach. Route C refuses a native mount
 * that ADDS a model-visible name (`a5sf-realm-row.mjs`: "would CHANGE the
 * Member's model-visible tool surface (added: [...])"), and `bash_probe`
 * existed only in `a5sfNativeToolModules`. This driver declares the probe on the
 * MEMBER PRESET as well, so the realm shadow is surface-neutral, and it gives
 * the preset mount and the realm mount DIFFERENT ledgers so a call that landed
 * on the preset definition is visible as such (the LOCUS witness).
 *
 * THE SIX QUESTIONS (five tabled in the preflight bundle, one declared untabled
 * with its reason — see `UNTABLED_CASES`):
 *
 *   1. `member-terminal-face` — Q1: WHAT terminal does a Member actually get?
 *      The Member's own model turn calls `bash`; the record carries the pid,
 *      `ps -o pid=,sess=,tty=,ppid=`, `/proc/$$/fd/0`, the driver's own
 *      `/proc/<pid>` reading, the composed profile that names the PTY stack, the
 *      governed realm's own face answer for that Member, and the confined
 *      provider's spawn counter (which must NOT contain the `bash` command).
 *   2. `same-pty-multi-command` — Q2: two `bash` calls in ONE Member turn on ONE
 *      PTY (same pid/session/tty), with a SECOND Member as the control (a
 *      different pid), so "one shell" cannot be confused with "one global
 *      shell".
 *   3. `product-shell-read-unlanned` — Q3 on the PRODUCT PATH: the Member's own
 *      `bash` reads a file the confined write-only lane would refuse. The
 *      declaration in the bundle is the LANE's expectation (deny); the judged
 *      proposition is what the product path actually does.
 *   4. `write-only-read-denied` — Q3 on the CONFINED FACE: a declared read of a
 *      write-only root is refused on the READ axis (`IO_READ_DENIED`), with zero
 *      provider calls and zero bytes.
 *   5. `chmod-gap` — Q4: a `chmod` with NO chmod declaration, on a file inside
 *      the read lane and outside the write lane, still changes the mode.
 *   6. (`untabled`) `network-deny-refusal` — Q5: a netdeny Member's probe is
 *      refused at admission (`NETWORK_UNCONFINED_REALM`) with zero processes.
 *
 * THE ATTRIBUTION LAW OF THIS LANE. A correct outcome with a wrong LOCUS is a
 * false pass. Every case artefact names the layer that produced the outcome
 * (`locus`) and, where two layers answer the same question differently (Q3),
 * BOTH answers are recorded. The concentrated result is that the confined
 * read-axis refusal is real on the confined `subprocess` face and ABSENT on the
 * Member's product shell path.
 *
 * IT DOES NOT ASK, AND MUST NEVER CLAIM, OS-LEVEL NETWORK ISOLATION. The
 * verified wording is quoted verbatim from
 * `dev/agent-workflow/evidence/a5sf-subprocess-face/README.md` §7:
 *
 *   "Refusing to spawn is **not** evidence of network isolation: it is a
 *    statement about our own admission code, made before the OS was asked."
 *
 * `osLevelNetworkIsolationClaimed: false` is stamped on every artefact.
 *
 * MODES
 *   --plan                    host-free: write the preflight bundle, grade it
 *                             with the shared zero-boot preflight, write the
 *                             plan projection. ZERO host starts.
 *   --evidence <dir>          the boot. Refuses before any ledger row unless
 *                             the bundle is bound to the current HEAD, the
 *                             authority pointer matches, and the shared
 *                             preflight reports PASS for this exact bundle.
 *
 * @module dev/agent-workflow/evidence/a5sf-pty-devlive/run-boot
 */
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createConnection } from 'node:net'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  apiPrompt,
  authenticate,
  emitPatchLayer,
  fetchJson,
} from '../../../../tests/world-factory/lib/world-factory.mjs'
import {
  createRunRecord,
  formatSummary,
  overallVerdict,
  readAuthorityBinding,
} from '../../../../tests/world-factory/lib/run-record.mjs'
import { createA5sfHarness } from '../../../../tests/world-factory/lib/a5sf-harness.mjs'
import {
  MANAGED_TOOL_NAMES,
  SAFE_UNMANAGED_TOOL_NAMES,
  hasMarker,
  remoteCall,
  surfaceNamesOf,
  toolMsgsOf,
} from '../../../../tests/world-factory/lib/u6-fs-assembly.mjs'
import { preRegisterBudget, resolveHeadCommit } from '../../../../tests/world-factory/suites/150-a5sf-read.mjs'
import { presetDeclarationRow, persistentShellGroup, smokePresetPlugins } from '../../../../tests/kits/_shared/preset-seam.mjs'
import { TEST_USE_BASELINE_SHA } from '../../../../tests/paths.mjs'
import { assertAcceptanceRootWiring } from '../../../../tests/world-factory/lib/a5sf-acceptance-preflight.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..')
const SUITE = 'a5sf-pty-devlive'
const FACE = 'Shell-PTY'
const LINE = 'a5sfptydv'

const PROVIDER_ROW = join(HERE, 'a5sf-pty-realm-provider-row.mjs')
const TOOL_MODULE = join(HERE, 'a5sf-pty-bash-probe-tool.mjs')
const OBSERVER_MODULE = join(HERE, 'a5sf-pty-session-observer.mjs')
const SOLO_DRIVER = join(HERE, 'run-boot.mjs')
const GRANT_PATH = join(HERE, 'dev-live-grant.json')
const BUNDLE_PATH = join(HERE, 'preflight-bundle.json')
const PREFLIGHT_LOG = join(HERE, 'preflight.log')
const PREFLIGHT_CLI = join(REPO_ROOT, 'scripts', 'a5sf-preflight.mjs')

const PLAN_ONLY = process.argv.includes('--plan')

function hostTreePath() {
  const local = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')
  if (existsSync(join(local, 'packages', 'shell', 'tool-bash-persistent', 'lib', 'index.js'))) return local
  return join(REPO_ROOT, '..', '..', 'tests', 'deepseek-harness-test-use')
}
const HOST_TREE = hostTreePath()
const HOST_TOOL_BASH_PERSISTENT = join(HOST_TREE, 'packages', 'shell', 'tool-bash-persistent', 'lib', 'index.js')
const HOST_TOOL_FS = join(HOST_TREE, 'packages', 'fs', 'tool-fs', 'lib', 'index.js')

const ROOT = 'session-a5sf-pty-root'
const CREATE_ROOT = 'session-a5sf-pty-team'
const BP_ANCHOR_ID = 'team.a5sf.pty.anchor'
const BP_MAIN_ID = 'team.a5sf.pty.main'
const PRESET_ID = 'a5sf-pty-base'
const BINDING_IDENTITY = 'team/pty-shell'
const BOOT_TIMEOUT_MS = 240_000

/** The five cases the SHARED preflight schema can table. */
const CASES = [
  'member-terminal-face',
  'same-pty-multi-command',
  'product-shell-read-unlanned',
  'write-only-read-denied',
  'chmod-gap',
]
/**
 * The sixth case, DELIBERATELY OUTSIDE THE PREFLIGHT TABLE, with the reason.
 *
 * `checkPolicyPaths` accepts a network refusal only through the
 * `admission-refusal` class, and `checkDriverCallerSurface` then requires the
 * DECLARED caller to be a legacy Member whose preset surfaces
 * `web_fetch`+`web_search` through the pinned web module. That shape is about a
 * WEB caller; a Shell-PTY network refusal has a `subprocess` caller and no web
 * preset, so the only way to table it would be to declare a caller this boot
 * does not have. BL-17 hit the same wall and hand-checked the row; this lane
 * does the same, declares it here, judges it with the same strictness, and says
 * so in the README and in the run record. It is NOT hidden: `SELECTED_CASES`
 * carries it into the run record and the driver refuses to run if the two lists
 * do not cover every case the judges know.
 */
const UNTABLED_CASES = ['network-deny-refusal']
const SELECTED_CASES = [...CASES, ...UNTABLED_CASES]

const LIMIT_SENTENCE = 'Refusing to spawn is **not** evidence of network isolation: it is a statement about our own admission code, made before the OS was asked.'

const MARKERS = Object.freeze({
  // NON-PREFIX markers on purpose. Run 01 routed the second Member's turn as
  // the first Member's fourth call because `MK_PTY_WORKER` is a prefix of
  // `MK_PTY_WORKER2` and the routing table tested the shorter name first: the
  // control Member received a stuffed text reply, never ran `bash`, and Q2's
  // control arm read `null`. Distinct prefixes fix the cause; the routing table
  // additionally matches MOST-SPECIFIC-FIRST so a future edit cannot re-open it.
  discovery: 'MK_PTY_DISC',
  create: 'MK_PTY_CREATE',
  worker: 'MK_PTY_WKR1',
  worker2: 'MK_PTY_WKR2',
  netdeny: 'MK_PTY_NET',
})

/** Most-specific marker first; the router reads exactly this order. */
const MARKER_PRECEDENCE = [MARKERS.worker2, MARKERS.worker, MARKERS.netdeny, MARKERS.create, MARKERS.discovery]

const SECRET_TOKEN_PRODUCT = 'A5SF_PTY_SECRET_PRODUCT_4f1c'
const SECRET_TOKEN_FACE = 'A5SF_PTY_SECRET_FACE_9b27'
const SECRET_TOKEN_KERNEL = 'A5SF_PTY_SECRET_KERNEL_7d43'
const SECRET_TOKEN_WRITEONLY = 'A5SF_PTY_SECRET_WRITEONLY_1e88'

// ─────────────────────────────────────────────────────────────────────────────
// paths of the current run (set by the entry point)
// ─────────────────────────────────────────────────────────────────────────────
let OUT = HERE
let RUN_LOG = join(HERE, 'run.log')
let ABOUT = {} // { head, authority, grant, paths }
const PLAN_LOG = join(HERE, 'plan.log')

function logTo(path, line) {
  const text = `[${new Date().toISOString()}] ${line}`
  // eslint-disable-next-line no-console
  console.log(text)
  try {
    appendFileSync(path, `${text}\n`)
  } catch {
    /* the console is the live channel */
  }
}
const log = (line) => logTo(PLAN_ONLY ? PLAN_LOG : RUN_LOG, line)

const sha256File = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const redact = (text) => String(text ?? '').replace(/\?token=[A-Za-z0-9_-]+/gu, '?token=<redacted>')
const rel = (path) => relative(REPO_ROOT, path).replaceAll('\\', '/')
const readJson = (path) => {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
}
const parseJsonl = (path) => {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter((line) => line.trim() !== '').map((line) => {
    try { return JSON.parse(line) } catch { return { unparseable: line.slice(0, 200) } }
  })
}
const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

async function waitFor(predicate, timeoutMs, everyMs = 400) {
  const t0 = Date.now()
  for (;;) {
    let value = null
    try { value = await predicate() } catch { value = null }
    if (value !== null && value !== undefined && value !== false) return { hit: true, value, elapsedMs: Date.now() - t0 }
    if (Date.now() >= t0 + timeoutMs) return { hit: false, value, elapsedMs: Date.now() - t0 }
    await sleep(everyMs)
  }
}

/**
 * THE POLLING HEALTH GATE (inherited from the web lane, PD-11 fix).
 *
 * `GET /__p6t6/health` answers 404 until the p6t6 row has finished its setup:
 * before that the route is simply not registered, which means PENDING, not
 * failed. A settled failure registers the same route and answers
 * `200 {ok:false, setupError}`. Every probe is retained with its body and
 * elapsed time; the gate aborts only on a settled failure or the timeout.
 */
async function pollHealth(origin, { timeoutMs = BOOT_TIMEOUT_MS, everyMs = 500, requestTimeoutMs = 30_000 } = {}) {
  const t0 = Date.now()
  const probes = []
  for (;;) {
    let probe = null
    let error = null
    try {
      probe = await fetchJson(`${origin}/__p6t6/health`, undefined, requestTimeoutMs)
    } catch (caught) {
      error = String(caught?.message ?? caught)
    }
    const entry = {
      seq: probes.length + 1,
      at: new Date().toISOString(),
      elapsedMs: Date.now() - t0,
      status: probe?.status ?? null,
      body: probe?.body ?? null,
      ...(error === null ? {} : { error }),
    }
    probes.push(entry)
    const kind = entry.status === 200 && entry.body?.ok === true
      ? 'ready'
      : entry.status === 200 && entry.body?.ok === false
        ? 'failed'
        : 'pending'
    if (kind !== 'pending') return { kind, probes, final: entry, elapsedMs: Date.now() - t0, timeoutMs }
    if (Date.now() - t0 >= timeoutMs) return { kind: 'timeout', probes, final: probes[probes.length - 1] ?? null, elapsedMs: Date.now() - t0, timeoutMs }
    await sleep(everyMs)
  }
}

function portOpen(port, timeoutMs = 2500) {
  return new Promise((done) => {
    const socket = createConnection({ port, host: '127.0.0.1' })
    let settled = false
    const finish = (open) => {
      if (settled) return
      settled = true
      socket.destroy()
      done(open)
    }
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
    setTimeout(() => finish(false), timeoutMs)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// authority / preflight bundle
// ─────────────────────────────────────────────────────────────────────────────

export function authorityBlock() {
  const pointerPath = 'dev/engineering/current-authority.json'
  const pointerAbs = join(REPO_ROOT, pointerPath)
  const pointer = readJson(pointerAbs) ?? {}
  const snapshot = readJson(join(REPO_ROOT, 'dev', 'engineering', 'authority-snapshots', `${String(pointer.snapshot_version)}.json`)) ?? {}
  const contract = snapshot.current_contract ?? {}
  return {
    pointerPath,
    snapshotVersion: String(pointer.snapshot_version ?? ''),
    contentDigest: String(pointer.content_digest ?? ''),
    baseline: String(contract.baseline ?? ''),
    pointerSha256: existsSync(pointerAbs) ? sha256File(pointerAbs) : '',
  }
}

/** The same block list the FS/Web lanes tabled, re-derived at this HEAD. */
export function buildPreflightBundle({ head, rowIds }) {
  const authority = authorityBlock()
  const workspace = 'tests/homes/<world>/workspace'
  const laneInside = `${workspace}/lane/inside`
  const writeOnly = `${workspace}/lane/write-only`
  return {
    schema: 'a5sf-zero-boot-preflight/1',
    at: new Date().toISOString(),
    face: FACE,
    world: LINE,
    mode: 'plan',
    candidate: {
      head,
      baseline: authority.baseline,
      hostPin: TEST_USE_BASELINE_SHA,
      recordClass: 'DEV-LIVE',
      note: 'DEV-LIVE development tree (owner ruling 2026-11-09). This bundle can never fund a CANDIDATE-C2 start.',
    },
    authority,
    grant: {
      grantId: 'devlive-pty-shell-1',
      scope: 'DEV-LIVE',
      grantedBy: 'owner 2026-11-09 ruling (dev-live workflow) + this lane\'s dev-live-grant.json',
      face: FACE,
      world: LINE,
      boundCommit: head,
      plannedStarts: 1,
      priorRows: 0,
      maxStarts: 2,
    },
    runRecord: {
      teamSha: head,
      hostSha: TEST_USE_BASELINE_SHA,
      recordClass: 'DEV-LIVE',
      suite: SUITE,
      selectedCases: SELECTED_CASES,
      ledger: {
        bootRows: 1,
        plannedStarts: 1,
        aborts: 0,
        path: '<evidence-dir>/run-ledger.jsonl',
        arithmetic: 'bootRows === plannedStarts - aborts; the projection declares the PLANNED arithmetic (one boot, no abort) and the run writes its own ledger.json next to it',
      },
      bindings: {
        face: FACE,
        worldLine: LINE,
        grantScope: 'DEV-LIVE',
        recordClass: 'DEV-LIVE',
        candidateClaimEligibility: 'DEV-LIVE record: never eligible for V@B=yes or any frozen-candidate claim (enforced by run-record.mjs#finalize)',
        authority: { pointer: { snapshot_version: authority.snapshotVersion, content_digest: authority.contentDigest } },
      },
    },
    fixtures: {
      'member-terminal-face': { kind: 'file-in-read-lane', locator: `${laneInside}/pty-identity.txt`, bytes: 45 },
      'same-pty-multi-command': { kind: 'file-in-read-lane', locator: `${laneInside}/pty-shared.txt`, bytes: 43 },
      'product-shell-read-unlanned': { kind: 'file-in-write-only-lane', locator: `${writeOnly}/secret-product.txt`, token: '<SECRET_PRODUCT>' },
      'write-only-read-denied': { kind: 'file-in-write-only-lane', locator: `${writeOnly}/secret-face.txt`, token: '<SECRET_FACE>' },
      'chmod-gap': { kind: 'file-in-read-lane-outside-write-lane', locator: `${laneInside}/mode.txt`, modeBefore: '644', modeWanted: '600' },
      'network-deny-refusal': { kind: 'member-lane', templateId: 'nether', networkAccess: 'deny' },
      workspace,
      note: 'planted by the driver AFTER the World exists (plantFixtures()): three readable files inside the read lane, four write-only files whose bytes are the tokens the judges look for. The tokens are generated per run and recorded in the run\'s fixtures.json, never in this bundle.',
    },
    sources: {
      driver: rel(SOLO_DRIVER),
      providerRow: rel(PROVIDER_ROW),
      probeTool: rel(TOOL_MODULE),
      preset: 'tests/kits/_shared/preset-seam.mjs # smokePresetPlugins + persistentShellGroup (pty + terminal-bash + tool-bash-persistent)',
      probePresetRow: 'the SAME bash_probe module is declared on the member preset AND in a5sfNativeToolModules: route C refuses an attach that ADDS a model-visible name, so the preset declaration is what makes the realm shadow surface-neutral',
      note: 'Five cases are tabled. The sixth (network-deny-refusal) is declared in driver.untabledCases: the shared schema\'s network branch requires a WEB caller declaration, which a Shell-PTY network refusal does not have; it is judged by the driver with the same strictness (see CASES/UNTABLED_CASES in run-boot.mjs).',
    },
    assembly: {
      requiredDistFaces: ['fs', 'subprocess'],
      distFaces: { fs: true, subprocess: true, web: false },
      hostModules: [
        { path: rel(HOST_TOOL_BASH_PERSISTENT), role: 'the pinned @deepseek-ai/dsh-tool-bash-persistent the MEMBER PRESET mounts (Q1\'s tool)' },
        { path: rel(HOST_TOOL_FS), role: 'the pinned @deepseek-ai/dsh-tool-fs the member preset mounts' },
        { path: rel(PROVIDER_ROW), role: 'the teamA5sfRealm provider: one compiled Member + the confined subprocess face + the confined-spawn counter' },
        { path: rel(TOOL_MODULE), role: 'the bash_probe caller (preset mount + realm shadow)' },
        { path: rel(OBSERVER_MODULE), role: 'the pty_observe witness, mounted INSIDE the shell group so it reads the SAME isolated terminals instance the bash tool used' },
        { path: rel(SOLO_DRIVER), role: 'this driver' },
      ],
      rowHandoff: {
        usesHandOverRows: true,
        beforeBoot: true,
        emittedRowIds: rowIds,
        worldRowIds: rowIds,
        healthProbeRowPresent: true,
      },
    },
    identity: {
      bootRoot: ROOT,
      teamRoot: CREATE_ROOT,
      createRoot: CREATE_ROOT,
      stateQueryRoot: CREATE_ROOT,
      toolRouteRoot: CREATE_ROOT,
      archiveRoot: CREATE_ROOT,
      oracleRoot: CREATE_ROOT,
      directiveRoot: CREATE_ROOT,
      blueprints: [
        { blueprintId: BP_ANCHOR_ID, members: 1 },
        { blueprintId: BP_MAIN_ID, members: 3 },
      ],
      memberBindings: CASES.concat(UNTABLED_CASES).map((id) => ({
        caseId: id,
        memberIdentity: id === 'network-deny-refusal' ? 'member-nether' : 'member-worker',
        toolBindingIdentity: BINDING_IDENTITY,
      })),
    },
    nativeModules: [
      {
        name: 'bash_probe',
        path: rel(TOOL_MODULE),
        face: 'subprocess',
        inject: ['tools', 'subprocess'],
        expectedTools: ['bash_probe'],
        requiresConfig: ['ledgerPath', 'program'],
        config: { ledgerPath: '<world-home>/confined-probe.jsonl', program: '/bin/bash', mount: 'realm' },
        note: 'also declared on the member preset (presetLedgerPath) with a DIFFERENT ledger, so a call that did not reach the realm is visible',
      },
    ],
    policy: {
      kind: 'shell-class',
      network: 'deny',
      networkAccess: 'allow',
      networkProbeEnforced: false,
      effectiveReadAllow: [laneInside],
      effectiveWriteAllow: [writeOnly],
      ceiling: { read: [workspace], write: [workspace] },
      restriction: { read: [laneInside], write: [writeOnly] },
      shellClass: { programs: ['bash'] },
      networkDenyMember: { templateId: 'nether', networkAccess: 'deny' },
      note: 'effective = ceiling ∩ restriction, computed by the product algebra in the provider row (intersectPathRuleSets) over test-composition fixtures. The WRITE lane is a strict subset of the READ lane: `lane/inside` is readable and NOT writable, `lane/write-only` is writable and NOT readable. The worker\'s network access is `allow`; only the `nether` Member\'s realm declares `deny`. `networkAccess: allow` here is the worker\'s lane, and no tabled case grades the network axis.',
      laneExpectationMapping: 'case.expected is the LANE\'s declared expectation. `product-shell-read-unlanned` (axis read) and `chmod-gap` (axis write) are locators the declared lane DENIES; their judges record whether the PRODUCT PATH / the OS profile actually delivers that denial. A PASS there means the proposition stated in `judgeProposition` was proven, NOT that the lane served the call.',
      osLevelNetworkIsolationClaimed: false,
    },
    cases: [
      {
        id: 'member-terminal-face',
        face: 'subprocess',
        axis: 'read',
        locator: `${laneInside}/pty-identity.txt`,
        guardFactKey: 'member-terminal-face',
        expected: 'allow',
        method: 'bash',
        collector: 'pty-observation',
        returnShape: ['call', 'result', 'claim', 'locus'],
        terminate: true,
        archiveBeforeStart: true,
        corpus: ['member-terminal-face'],
        judgeProposition: 'the Member\'s own model turn calls `bash` and the call is served by the PRESET persistent-shell stack (pinned dsh-terminal + dsh-terminal-bash) on a real PTY, with the governed realm answering NO terminal face and the confined subprocess provider recording NO spawn for it',
        note: 'the disposition (allow inside the read lane) is incidental; the observable is WHICH layer served the call',
      },
      {
        id: 'same-pty-multi-command',
        face: 'subprocess',
        axis: 'read',
        locator: `${laneInside}/pty-shared.txt`,
        guardFactKey: 'same-pty-multi-command',
        expected: 'allow',
        method: 'bash',
        collector: 'pty-observation',
        returnShape: ['call', 'result', 'claim', 'control'],
        terminate: true,
        archiveBeforeStart: true,
        corpus: ['same-pty-multi-command'],
        judgeProposition: 'two bash commands in ONE Member turn share one backend PTY (same pid, session and tty) and a SECOND Member gets a different one',
        note: 'the disposition (allow inside the read lane) is incidental; the observable is PTY identity across commands and across Members',
      },
      {
        id: 'product-shell-read-unlanned',
        face: 'subprocess',
        axis: 'read',
        locator: `${writeOnly}/secret-product.txt`,
        guardFactKey: 'product-shell-read-unlanned',
        expected: 'deny',
        method: 'bash',
        collector: 'pty-observation',
        returnShape: ['call', 'result', 'claim', 'locus'],
        terminate: true,
        archiveBeforeStart: true,
        corpus: ['product-shell-read-unlanned'],
        judgeProposition: 'the Member\'s own `bash` reads a file the confined write-only lane declares unreadable and RETURNS ITS BYTES — i.e. the confined read axis is not on the product shell path',
        note: 'the bundle\'s expected=deny is the LANE\'s expectation; the judge records what the product path does and names the locus',
      },
      {
        id: 'write-only-read-denied',
        face: 'subprocess',
        axis: 'read',
        locator: `${writeOnly}/secret-face.txt`,
        guardFactKey: 'write-only-read-denied',
        expected: 'deny',
        method: 'bash_probe',
        collector: 'guard-fact',
        returnShape: ['call', 'result', 'claim'],
        terminate: true,
        archiveBeforeStart: true,
        corpus: ['write-only-read-denied'],
        expectedCode: 'IO_READ_DENIED',
        expectedFact: { method: 'spawn', decision: 'deny', decidedBy: 'IO_READ_DENIED' },
        judgeProposition: 'a declared read of a write-only root is refused on the READ axis (IO_READ_DENIED), zero provider calls, zero bytes',
        note: 'supplementary arm (not a case): the SAME body with the write-only root DECLARED as a read is admitted and the OS profile refuses the read — that separates the admission axis from the kernel',
      },
      {
        id: 'chmod-gap',
        face: 'subprocess',
        axis: 'write',
        locator: `${laneInside}/mode.txt`,
        guardFactKey: 'chmod-gap',
        expected: 'deny',
        method: 'bash_probe',
        collector: 'os-effect',
        returnShape: ['call', 'result', 'claim', 'locus'],
        terminate: true,
        archiveBeforeStart: true,
        corpus: ['chmod-gap'],
        judgeProposition: 'a `chmod` with NO chmod declaration changes the mode of an in-read/out-write file, because neither the admission (nothing declared) nor the OS profile (Landlock has no chmod right) covers it',
        note: 'the disclosure under test; a REFUTED verdict (mode unchanged) would be the BETTER product outcome and is recorded as such',
      },
    ],
    driver: {
      note: 'Discovery-first leader blueprint + polling health gate (both inherited from the web lane). The probe tool is on the member preset AND in a5sfNativeToolModules; two ledgers make the LOCUS observable. `captures` are full bodies; `captureLimits.body.maxChars=null` declares unbounded retention.',
      blueprint: {
        leader: {
          tools: ['bash', 'bash_probe', 'edit', 'pty_observe', 'read', 'read_image', 'team_archive_member', 'team_delegate', 'write'],
          builtinToolDeny: 'discovery-first',
          teamTools: ['team_archive_member', 'team_delegate'],
          managed: MANAGED_TOOL_NAMES,
          safeUnmanaged: SAFE_UNMANAGED_TOOL_NAMES,
          presetTools: ['bash', 'bash_probe', 'edit', 'pty_observe', 'read', 'read_image', 'write'],
          note: 'the LEADER and the MEMBER share one preset id in this lane (the smoke preset + the bash_probe caller), so the leader surface is the member preset surface plus the two team tools. `builtinToolDeny: discovery-first` = the deny list is COMPUTED at run time from the anchor leader\'s own model request (the web lane\'s fix for A2C-2: BL-17 boot #4 died at team.create on an uncovered unmanaged name). `bash_probe` classifies unmanaged, so the run-time deny list covers it; the MEMBER is legacy/non-strict, keeps the preset name, and route C therefore shadows an EXISTING name instead of adding one.',
        },
      },
      caseManifest: { cases: CASES },
      plannedCases: CASES,
      untabledCases: [
        {
          id: 'network-deny-refusal',
          reason: 'SHARED-SCHEMA-LIMIT',
          detail: 'the only tabled network class is admission-refusal, and checkDriverCallerSurface then REQUIRES a legacy Member whose preset surfaces web_fetch+web_search through the pinned web module. A Shell-PTY network refusal has a subprocess caller and no web preset; tabling it would force a false caller declaration. Judged by the driver with the same strictness; declared here and in the run record so it is not hidden.',
          judgedBy: 'the driver\'s network-deny judge (typed code NETWORK_UNCONFINED_REALM, 0 confined spawn attempts, 0 bytes, and — a LOCUS fact, not a defect — 0 guard-consult facts because the shipped face throws on this branch before the guard)',
        },
      ],
      steps: [
        { id: 'preconditions', canFail: false },
        { id: 'dev-live-grant', produces: ['grant'], canFail: false },
        { id: 'compose-rows', produces: ['rows'], canFail: false },
        { id: 'boot-host', produces: ['host'], canFail: true, captures: ['status', 'body'], captureLimits: { body: { maxChars: null } } },
        { id: 'health-gate', requires: ['host'], canFail: true, gate: true, captures: ['status', 'body'], captureLimits: { body: { maxChars: null } } },
        { id: 'discover-leader-surface', requires: ['host'], produces: ['leader-surface'], canFail: true, captures: ['status', 'body', 'mock-requests'], captureLimits: { body: { maxChars: null } } },
        { id: 'write-main-blueprint', requires: ['leader-surface'], produces: ['blueprint'], canFail: true, captures: ['status', 'body'], captureLimits: { body: { maxChars: null } } },
        { id: 'create-team', requires: ['blueprint'], produces: ['team-session'], canFail: true, captures: ['status', 'body'], captureLimits: { body: { maxChars: null } } },
        { id: 'state-gate', requires: ['team-session'], produces: ['state-open'], canFail: true, gate: true, captures: ['status', 'body'], captureLimits: { body: { maxChars: null } } },
        { id: 'live-leader-gate', requires: ['state-open'], produces: ['live-leader-gate'], canFail: true, gate: true, captures: ['status', 'body'], captureLimits: { body: { maxChars: null } } },
        { id: 'delegate-worker', requires: ['live-leader-gate'], produces: ['member-worker'], canFail: true, captures: ['status', 'body'], captureLimits: { body: { maxChars: null } } },
        { id: 'member-bash-calls', requires: ['member-worker'], produces: ['pty-observations'], canFail: true, captures: ['status', 'body', 'mock-requests', 'tool-results'], captureLimits: { body: { maxChars: null } } },
        { id: 'delegate-worker2-control', requires: ['live-leader-gate'], produces: ['member-worker2'], canFail: true, captures: ['status', 'body'], captureLimits: { body: { maxChars: null } } },
        { id: 'confined-probes', requires: ['pty-observations'], produces: ['confined-probes', 'guard-facts', 'confined-spawns'], canFail: true, captures: ['status', 'body', 'guard-facts', 'confined-spawns'], captureLimits: { body: { maxChars: null } } },
        { id: 'teardown', requires: ['confined-probes'], canFail: true, captures: ['status', 'body'], captureLimits: { body: { maxChars: null } } },
      ],
    },
    limit: {
      wording: LIMIT_SENTENCE,
      osLevelNetworkIsolationClaimed: false,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// blueprints / rows
// ─────────────────────────────────────────────────────────────────────────────

const BP_ANCHOR_YAML = [
  '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
  'leader:', '  templateId: leader',
  `  persona: ${JSON.stringify(`You are the leader of the a5sf Shell/PTY anchor team. ${MARKERS.discovery}: reply with one short line. Call no tool.`)}`,
  'members:', '  - templateId: worker', '    persona: "You are the a5sf Shell/PTY anchor worker."',
  'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
].join('\n')

function mainBlueprintYaml(denyList) {
  const denyYaml = denyList.length === 0
    ? '    builtinToolDeny: []'
    : ['    builtinToolDeny:', ...denyList.map((name) => `      - ${JSON.stringify(name)}`)].join('\n')
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the a5sf Shell/PTY DEV-LIVE team (${SUITE}). The driver dispatches the probes through the product row tool route; do not delegate on your own.`)}`,
    '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
    '        - team_delegate',
    '        - team_archive_member',
    denyYaml,
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: deny', '      allow: []', '      ask: []', '      deny: []',
    'teamEnvelope:', '  allow:', '    - create-member', '    - assign-task', '    - send-message', '    - report-progress', '    - archive-member', '  deny: []',
    'members:',
    '  - templateId: worker', '    displayName: "a5sf pty shell worker"',
    `    persona: ${JSON.stringify(`You are the a5sf Shell/PTY worker. ${MARKERS.worker}: run the bash commands the driver scripts, one call per turn, and nothing else.`)}`,
    '  - templateId: worker2', '    displayName: "a5sf pty shell worker 2 (PTY control)"',
    `    persona: ${JSON.stringify(`You are the second a5sf Shell/PTY worker. ${MARKERS.worker2}: run the bash command the driver scripts, one call, and nothing else.`)}`,
    '  - templateId: nether', '    displayName: "a5sf pty network-deny member"',
    `    persona: ${JSON.stringify(`You are the a5sf Shell/PTY network-deny member. ${MARKERS.netdeny}: reply with one short line; call no tool.`)}`,
    'memberEnvelopes:',
    '  - templateId: worker', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    '  - templateId: worker2', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    '  - templateId: nether', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []',
    'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}

function blueprintFacade() {
  const req = createRequire(join(REPO_ROOT, 'noop.cjs'))
  return req(join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'domain', 'blueprint', 'src', 'index.js'))
}

function assertBlueprintText(text, wantId, wantMembers, label) {
  const facade = blueprintFacade()
  let parsed
  try {
    parsed = facade.parseBlueprint(text)
  } catch (error) {
    throw new Error(`${label} rejected by the host validator: ${String(error?.message ?? error)}`)
  }
  const doc = parsed.blueprint ?? parsed
  if (doc.blueprintId !== wantId) throw new Error(`${label} resolves as ${String(doc.blueprintId)}, want ${wantId}`)
  if (!Array.isArray(doc.members) || doc.members.length !== wantMembers) {
    throw new Error(`${label} members=${String(doc.members?.length)}, want ${wantMembers}`)
  }
  const leaderTools = doc.leader?.capabilities?.builtinToolDeny
  return { ok: true, via: 'parseBlueprint(dist domain facade = the host own import)', builtinToolDeny: Array.isArray(leaderTools) ? leaderTools : null }
}

function rowPathsOf({ home, workspaceDir }) {
  const workspace = realpathSync(workspaceDir)
  return {
    workspace,
    laneInside: join(workspace, 'lane', 'inside'),
    writeOnly: join(workspace, 'lane', 'write-only'),
    ptyIdentity: join(workspace, 'lane', 'inside', 'pty-identity.txt'),
    ptyShared: join(workspace, 'lane', 'inside', 'pty-shared.txt'),
    modeFile: join(workspace, 'lane', 'inside', 'mode.txt'),
    secretProduct: join(workspace, 'lane', 'write-only', 'secret-product.txt'),
    secretFace: join(workspace, 'lane', 'write-only', 'secret-face.txt'),
    secretKernel: join(workspace, 'lane', 'write-only', 'secret-kernel.txt'),
    secretWriteOnly: join(workspace, 'lane', 'write-only', 'secret-write-only.txt'),
    // ledgers and counters — all inside the World home
    sink: join(home, 'a5sf-consult.jsonl'),
    counter: join(home, 'confined-counter.jsonl'),
    presetProbeLedger: join(home, 'preset-probe.jsonl'),
    realmProbeLedger: join(home, 'confined-probe.jsonl'),
    laneReport: join(home, 'lane-report.json'),
    scratchRoot: join(home, 'shell-scratch'),
  }
}

function teamRowConfig({ home, paths }) {
  const dist = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  return {
    rootSessionId: ROOT,
    bootPhase: 'create',
    blueprintSource: BP_ANCHOR_YAML,
    blueprintDir: join(home, 'blueprints'),
    rootPresetId: PRESET_ID,
    memberPresetId: PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'a5sf-pty-model' },
    deniedSelection: null,
    mcpServers: [],
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: pathToFileURL(join(dist, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href,
    seamUrl: pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href,
    a5sfEvidencePath: paths.sink,
    // The ONE composition-provided tool this run adds. It is mounted by the
    // SAME product row a real native module rides; it decides nothing. Its
    // realm ledger differs from the preset row's, so a call that landed on the
    // preset definition is visible as such.
    a5sfNativeToolModules: [
      { url: pathToFileURL(TOOL_MODULE).href, config: { ledgerPath: paths.realmProbeLedger, program: '/bin/bash', mount: 'realm' } },
    ],
    a5sfExpectedTools: { [pathToFileURL(TOOL_MODULE).href]: ['bash_probe'] },
    // NOTE: no `teamToolPlane` — the ONLY confinement is the a5sf two-axis
    // realm the provider row supplies.
  }
}

function memberPresetPlugins({ paths }) {
  const plugins = smokePresetPlugins({
    personaText: 'You are a coding agent powered by the {{model}} model.',
    cwdSuffix: 'Your working directory is {{cwd}}.',
    bashDescription: 'Run commands in a persistent bash shell. State is persistent across calls.',
  })
  // The LOCUS witness for Q1 must sit INSIDE the shell group: that group
  // isolates the `terminals` service, so a plugin outside it would observe a
  // DIFFERENT (empty) registry and prove nothing. It is appended to the group's
  // own config array, never to the preset root.
  const group = plugins.find((plugin) => plugin?.id === 'persistent-shell')
  if (group === undefined || !Array.isArray(group.config)) throw new Error('the smoke preset no longer carries the persistent-shell group: the observer cannot be placed in the PTY group')
  group.config.push({ id: 'pty-session-observer', name: pathToFileURL(OBSERVER_MODULE).href })
  // The probe on the PRESET (see the header): route C shadows an existing name,
  // it does not add one. This definition talks to whatever `subprocess` service
  // the scope resolves and writes to its OWN ledger.
  plugins.push({
    id: 'pty-bash-probe',
    name: pathToFileURL(TOOL_MODULE).href,
    config: { ledgerPath: paths.presetProbeLedger, program: '/bin/bash', mount: 'preset' },
  })
  return plugins
}

function rowsFor({ home, workspaceDir }) {
  const dist = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  const PRODUCTION_ROW = pathToFileURL(join(dist, 'src', 'plugin', 'host.js')).href
  const P6T6_ROW = pathToFileURL(join(REPO_ROOT, 'packages', 'tools', 'harness', 'plugin.mjs')).href
  const paths = rowPathsOf({ home, workspaceDir })
  const config = teamRowConfig({ home, paths })
  return {
    paths,
    config,
    rows: [
      {
        id: 'a5sf-pty-realm',
        name: pathToFileURL(PROVIDER_ROW).href,
        config: {
          allowRoot: paths.workspace,
          readAllow: [paths.laneInside],
          writeAllow: [paths.writeOnly],
          shellPrograms: ['bash'],
          networkDenyTemplates: ['nether'],
          bindingIdentity: BINDING_IDENTITY,
          laneReportPath: paths.laneReport,
          laneProbePaths: [
            paths.laneInside, paths.writeOnly, paths.secretProduct, paths.secretFace,
            paths.secretKernel, paths.secretWriteOnly, paths.modeFile,
          ],
          counterPath: paths.counter,
          scratchRoot: paths.scratchRoot,
        },
      },
      { id: 'dsh-agent-team', name: PRODUCTION_ROW, config },
      { id: 'p6t6-team-tools', name: P6T6_ROW },
      presetDeclarationRow({
        id: PRESET_ID,
        displayName: 'a5sf pty dev-live base',
        description: `a5sf Shell-PTY DEV-LIVE preset (${LINE}) = the smoke preset (pinned dsh-terminal + dsh-terminal-bash + tool-bash-persistent) + the bash_probe caller`,
        plugins: memberPresetPlugins({ paths }),
      }),
    ],
  }
}

function handOverRows(world, rows) {
  if (world?.u6Fs === undefined || !Array.isArray(world.u6Fs.rows)) {
    throw new Error('World contract changed: world.u6Fs.rows is not an array')
  }
  world.u6Fs.rows.push(...rows)
  return world.u6Fs.rows.map((row) => String(row.id))
}

function rowIdentityCheck(rows) {
  const byPackage = new Map()
  for (const row of rows) {
    const spec = String(row?.name ?? '')
    if (!spec.startsWith('file://')) continue
    const modulePath = fileURLToPath(spec)
    if (!existsSync(modulePath)) {
      return { ok: false, reason: 'ROW_MODULE_MISSING', detail: `${String(row.id)} -> ${modulePath} does not exist` }
    }
    const pkg = dirname(dirname(modulePath))
    const list = byPackage.get(pkg) ?? []
    list.push(String(row.id))
    byPackage.set(pkg, list)
  }
  for (const [pkgPath, list] of byPackage) {
    if (list.length > 1) return { ok: false, reason: 'DUPLICATE_CLIENT_PACKAGE_SOURCES', detail: `${pkgPath} sourced from ${list.join(', ')}` }
  }
  return { ok: true }
}

function homeSandboxPin({ home, workspaceRoot }) {
  const root = realpathSync(workspaceRoot)
  const path = join(home, 'cordis.patch.yml')
  const yaml = [
    '# a5sf Shell-PTY DEV-LIVE fixture: pin the DEPLOYMENT file-sandbox fallback',
    '# root to this World\'s workspace (the confined realm resolves sandboxPolicy',
    '# without a session, so the fallback — not the session cwd — fences every read).',
    '- id: sandbox-policy',
    '  config:',
    '    mode: "workspace-write"',
    `    workspaceRoot: ${JSON.stringify(root)}`,
    '',
  ].join('\n')
  writeFileSync(path, yaml)
  return { path, mode: 'workspace-write', workspaceRoot: root }
}

/** Plant the fixture files the cases read. Called AFTER the World exists. */
function plantFixtures({ paths }) {
  for (const dir of [paths.laneInside, paths.writeOnly]) mkdirSync(dir, { recursive: true })
  writeFileSync(paths.ptyIdentity, 'pty identity fixture (inside the read lane)\n')
  writeFileSync(paths.ptyShared, 'pty shared fixture (inside the read lane)\n')
  writeFileSync(paths.modeFile, 'mode fixture (read lane, NOT write lane)\n')
  writeFileSync(paths.modeFile, 'mode fixture (read lane, NOT write lane)\n')
  // The four secret files sit in the WRITE-ONLY root: writable, unreadable.
  writeFileSync(paths.secretProduct, `${SECRET_TOKEN_PRODUCT}\n`)
  writeFileSync(paths.secretFace, `${SECRET_TOKEN_FACE}\n`)
  writeFileSync(paths.secretKernel, `${SECRET_TOKEN_KERNEL}\n`)
  writeFileSync(paths.secretWriteOnly, `${SECRET_TOKEN_WRITEONLY}\n`)
  return {
    laneInside: paths.laneInside,
    writeOnly: paths.writeOnly,
    mode: { path: paths.modeFile, mode: (statSync(paths.modeFile).mode & 0o777).toString(8) },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// the mock script (marker-routed)
// ─────────────────────────────────────────────────────────────────────────────

// WHY THE SHELL REPORTS ITS OWN /proc FIELDS. Run 01 shipped a judge that read
// `/proc/<pid>` from the DRIVER's side and compared it with `ps`: the shell
// printed `$$`=2 and `/dev/pts/0` while `ps -o tty=` printed `?`, and the
// driver's `/proc/2` was an unrelated process. The cause is not a product
// defect: the host process runs inside the platform sandbox's PID namespace, so
// the shell's pid is namespace-local and `ps` cannot resolve the tty there.
// The fix is EVIDENCE THAT DOES NOT CROSS A NAMESPACE BOUNDARY — the shell reads
// its own `/proc/$$/stat` (ppid, session, tty_nr). `tty_nr`'s major 136 is the
// Linux pts major, so a nonzero mainline `tty_nr` is a KERNEL fact about the
// controlling terminal, independent of any namespace the reader lives in.
const SHARED_ENV_TOKEN = 'A5SF_PTY_SHARED_5c31'

/**
 * THE SHELL REPORTS ITS OWN /proc FIELDS — and carries state between calls.
 *
 * RUN-01/02/03 DEFECTS (judge, not product), all three fixed here:
 *
 *  1. `/proc/<pid>` read from the DRIVER is useless: the shell's `$$` is a PID-
 *     namespace-local pid (`$$`=2) because the host runs inside the platform
 *     sandbox's PID namespace. The shell therefore reads its OWN
 *     `/proc/$$/stat`: `tty_nr` is a DEVICE number (major 136 = the Linux pts
 *     major), which is namespace-independent — `ps -o tty=` prints `?` and the
 *     session field prints 0 inside that namespace, and neither is evidence.
 *  2. `same pid` does NOT mean "one shell": every Member's shell reports
 *     `$$`=2 and `/dev/pts/0` in its own namespace, so two different shells look
 *     identical. The namespace-independent proof is STATE THAT SURVIVES A CALL:
 *     call 1 exports a per-run variable and changes directory, call 2 reads both.
 *  3. The `cd` used a RELATIVE path and the shell starts in the HOST CHECKOUT
 *     (`owner.session.header.cwd`), not the World workspace — so the relative
 *     `cd` failed and the cwd assertion was unmeasurable. The absolute lane path
 *     is interpolated per run.
 */
const cmdOneOf = ({ laneInside }) => [
  // The STARTING directory is captured BEFORE the `cd`: on this World the
  // Member's persistent shell starts in the HOST CHECKOUT
  // (`owner.session.header.cwd`), not in the World workspace — an observation
  // about the product preset's shell, recorded rather than smoothed away.
  'echo "A5SF_PTY_START_CWD=$(pwd)"',
  `export A5SF_PTY_SHARED=${SHARED_ENV_TOKEN}`,
  `cd ${JSON.stringify(laneInside)}`,
  'echo "A5SF_PTY_RUN=1"',
  'echo "A5SF_PTY_PID=$$"',
  'echo "A5SF_PTY_PS=$(ps -o pid=,sess=,tty=,ppid= -p $$ | tr -s " ")"',
  'echo "A5SF_PTY_FD0=$(readlink /proc/$$/fd/0)"',
  'echo "A5SF_PTY_TTYCMD=$(tty 2>&1)"',
  'echo "A5SF_PTY_PPID=$(awk \'{print $4}\' /proc/$$/stat)"',
  'echo "A5SF_PTY_SESS=$(awk \'{print $6}\' /proc/$$/stat)"',
  'echo "A5SF_PTY_TTYNR=$(awk \'{print $7}\' /proc/$$/stat)"',
  'echo "A5SF_PTY_CWD=$(pwd)"',
  'echo "A5SF_PTY_SHARED_SEEN=${A5SF_PTY_SHARED:-UNSET}"',
].join('; ')

const cmdTwoOf = (paths) => cmdOneOf(paths).replaceAll('A5SF_PTY_RUN=1', 'A5SF_PTY_RUN=2')
const cmdTwoControlOf = (paths) => cmdTwoOf(paths).replaceAll('A5SF_PTY_RUN=2', 'A5SF_PTY_RUN=2C')

function makeDecide({ routingLog, paths }) {
  const served = new Map()
  const bump = (key) => {
    const count = (served.get(key) ?? 0) + 1
    served.set(key, count)
    return count
  }
  return function decide({ seq, req }) {
    const messages = Array.isArray(req?.messages) ? req.messages : []
    let lastUser = ''
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role !== 'user') continue
      const content = messages[i]?.content
      lastUser = typeof content === 'string' ? content : Array.isArray(content) ? content.map((p) => p?.text ?? '').join('\n') : ''
      break
    }
    const allText = messages.map((m) => {
      const content = m?.content
      // tool_result blocks carry `content: [{type:'text',text}]`, so a JSON
      // projection is the only lossless reading for marker routing.
      return typeof content === 'string' ? content : JSON.stringify(content ?? '')
    }).join('\n')
    // TITLE GENERATION is a host-internal turn. It carries the whole history
    // (including the delegation marker) and must NEVER consume a script — the
    // BL-17 boot-2 lesson. It is detected first and answered harmlessly.
    const isTitle = /Generate the session title/i.test(allText)
    // MOST-SPECIFIC FIRST: a marker that is a prefix of another must never
    // win. `MARKER_PRECEDENCE` is the single ordered list both the router and
    // the assertions read.
    const marker = isTitle
      ? null
      : (MARKER_PRECEDENCE.find((candidate) => allText.includes(candidate)) ?? null)
    let reply
    let disposition = 'harmless-text'
    let effective = marker
    if (isTitle) {
      effective = 'title'
      reply = { kind: 'text', text: 'a5sf Shell-PTY dev-live run' }
    } else if (marker === null) {
      effective = 'fallback'
      reply = { kind: 'text', text: 'Acknowledged. No tool call.' }
    } else if (marker === MARKERS.discovery) {
      reply = { kind: 'text', text: 'Surface discovery acknowledged. No tool call.' }
    } else if (marker === MARKERS.create) {
      reply = { kind: 'text', text: 'Team created marker acknowledged. No tool call.' }
    } else if (marker === MARKERS.netdeny) {
      reply = { kind: 'text', text: 'Network-deny member acknowledged. No tool call.' }
    } else if (marker === MARKERS.worker2) {
      const count = bump(MARKERS.worker2)
      if (count > 1) {
        reply = { kind: 'text', text: 'That marker was already answered once; no further tool call.' }
        disposition = 'exhausted'
      } else {
        reply = { kind: 'tool-call', toolCalls: [{ name: 'bash', arguments: { command: cmdTwoControlOf(paths) } }] }
        disposition = 'tool-call'
      }
    } else {
      // the worker: one scripted bash call per model request
      const count = bump(MARKERS.worker)
      if (count === 1) {
        reply = { kind: 'tool-call', toolCalls: [{ name: 'bash', arguments: { command: cmdOneOf(paths) } }] }
        disposition = 'tool-call'
      } else if (count === 2) {
        reply = { kind: 'tool-call', toolCalls: [{ name: 'bash', arguments: { command: cmdTwoOf(paths) } }] }
        disposition = 'tool-call'
      } else if (count === 3) {
        reply = {
          kind: 'tool-call',
          toolCalls: [{ name: 'bash', arguments: { command: `echo "A5SF_PTY_READ=start"; cat ${JSON.stringify(paths.secretProduct)}; echo "A5SF_PTY_READ_STATUS=$?"` } }],
        }
        disposition = 'tool-call'
      } else {
        reply = { kind: 'text', text: 'A5SF_PTY_WORKER_DONE' }
        disposition = 'done'
      }
    }
    const decision = {
      seq: routingLog.length + 1,
      mockSeq: seq ?? null,
      at: new Date().toISOString(),
      effective,
      servedCount: effective === null ? 0 : (served.get(effective) ?? 0),
      disposition,
      replyKind: reply.kind,
      toolName: reply.kind === 'tool-call' ? reply.toolCalls[0].name : null,
    }
    routingLog.push(decision)
    try {
      writeJson(join(OUT, 'marker-routing.json'), { decidedBy: 'the driver\'s own decide() log, appended per model request', markers: MARKERS, routingLog, osLevelNetworkIsolationClaimed: false })
      appendFileSync(RUN_LOG, `[${decision.at}] mock seq=${String(seq)} effective=${String(effective)} disposition=${disposition}\n`)
    } catch {
      /* the run must survive a logging failure */
    }
    return reply
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OS observation of a PTY process (the driver's own /proc read)
// ─────────────────────────────────────────────────────────────────────────────

function procObservation(pid) {
  const out = { pid: pid ?? null, readable: false }
  if (!Number.isInteger(pid) || pid <= 0) return out
  try {
    const stat = readFileSync(`/proc/${String(pid)}/stat`, 'utf8')
    // comm may contain spaces/parens: peel it off first.
    const after = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/u)
    out.readable = true
    out.comm = stat.slice(stat.indexOf('(') + 1, stat.lastIndexOf(')'))
    out.state = after[0]
    out.ppid = Number(after[1])
    out.pgrp = Number(after[2])
    out.session = Number(after[3])
    out.ttyNr = Number(after[4])
  } catch (error) {
    out.error = String(error?.message ?? error)
  }
  for (const fd of [0, 1, 2]) {
    try { out[`fd${String(fd)}`] = readFileSync(`/proc/${String(pid)}/fd/${String(fd)}`).toString() } catch { /* not readable */ }
    try { out[`fd${String(fd)}Target`] = readlinkSync(`/proc/${String(pid)}/fd/${String(fd)}`) } catch { /* not readable */ }
  }
  try { out.cmdline = readFileSync(`/proc/${String(pid)}/cmdline`, 'utf8').split('\u0000').filter((s) => s !== '').join(' ') } catch { /* not readable */ }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// plan
// ─────────────────────────────────────────────────────────────────────────────

function runSharedPreflight() {
  const args = [PREFLIGHT_CLI, '--bundle', BUNDLE_PATH, '--repo', REPO_ROOT, '--host-root', HOST_TREE]
  const res = spawnSync(process.execPath, args, { encoding: 'utf8', cwd: REPO_ROOT, maxBuffer: 64 * 1024 * 1024 })
  const text = `${String(res.stdout ?? '')}${String(res.stderr ?? '')}`.trim()
  writeFileSync(PREFLIGHT_LOG, `${text}\n`)
  let verdict = null
  const line = String(res.stdout ?? '').split('\n').find((l) => l.startsWith('DSH-A5SF-PREFLIGHT '))
  if (line !== undefined) {
    try { verdict = JSON.parse(line.slice('DSH-A5SF-PREFLIGHT '.length)) } catch { verdict = null }
  }
  return { status: res.status, text, verdict }
}

async function plan() {
  rmSync(PLAN_LOG, { force: true })
  const head = resolveHeadCommit(REPO_ROOT)
  if (head === null) throw new Error('git rev-parse HEAD failed: the bundle cannot be bound')
  log(`PLAN (host-free). head=${head} hostPin=${TEST_USE_BASELINE_SHA} hostTree=${HOST_TREE}`)
  if (!existsSync(HOST_TOOL_BASH_PERSISTENT)) throw new Error(`the pinned persistent-bash module is missing: ${HOST_TOOL_BASH_PERSISTENT}`)
  if (!existsSync(HOST_TOOL_FS)) throw new Error(`the pinned fs module is missing: ${HOST_TOOL_FS}`)

  const dry = rowsFor({ home: join(HERE, '.rowcheck'), workspaceDir: HERE })
  const identity = rowIdentityCheck(dry.rows)
  log(`row identity: ${JSON.stringify(identity)}`)
  if (identity.ok !== true) throw new Error(`row composition refused: ${identity.reason}: ${identity.detail}`)
  const patchText = emitPatchLayer(['a5sf Shell-PTY DEV-LIVE fixture rows (plan projection)'], dry.rows)
  const emittedRowIds = dry.rows.map((row) => String(row.id))
  for (const id of emittedRowIds) {
    if (!patchText.includes(id)) throw new Error(`row ${id} is absent from the emitted profile patch`)
  }
  // The preset must name the three PTY rows AND the probe: Q1's attribution
  // chain starts at the composed profile, so a plan that lost one of them would
  // spend a start measuring nothing.
  const presetText = JSON.stringify(dry.rows.find((row) => String(row.id) === `preset-${PRESET_ID}`) ?? {})
  for (const need of ['@deepseek-ai/dsh-terminal', '@deepseek-ai/dsh-terminal-bash', '@deepseek-ai/dsh-tool-bash-persistent', 'bash_probe', 'a5sf-pty-session-observer']) {
    if (!presetText.includes(need)) throw new Error(`the preset declaration lost ${need}`)
  }
  assertBlueprintText(BP_ANCHOR_YAML, BP_ANCHOR_ID, 1, 'anchor.yaml')
  const mainProbe = assertBlueprintText(mainBlueprintYaml(['x']), BP_MAIN_ID, 3, 'main.yaml (deny probe)')
  log(`blueprints parsed: anchor=1 member, main=3 members, leader builtinToolDeny=${JSON.stringify(mainProbe.builtinToolDeny)}`)

  const bundle = buildPreflightBundle({ head, rowIds: emittedRowIds })
  writeJson(BUNDLE_PATH, bundle)
  let resolved
  try { resolved = assertAcceptanceRootWiring(bundle.identity) } catch (error) { throw new Error(`identity roots refused: ${String(error?.message ?? error)}`) }
  log(`identity roots: ${JSON.stringify(resolved)}`)

  const preflight = runSharedPreflight()
  log(`shared preflight: exit=${String(preflight.status)} verdict=${String(preflight.verdict?.verdict ?? 'null')} summary=${String(preflight.verdict?.summary ?? '')}`)
  if (preflight.verdict?.verdict !== 'PASS') {
    const findings = preflight.verdict?.findings ?? preflight.verdict?.unknown ?? []
    throw new Error(`the shared preflight did not PASS (${String(preflight.verdict?.verdict ?? `exit ${String(preflight.status)}`)}): ${JSON.stringify(findings).slice(0, 4000)}`)
  }
  writeJson(join(HERE, 'plan-rows.json'), {
    at: new Date().toISOString(),
    head,
    rows: emittedRowIds,
    patchBytes: patchText.length,
    patchSha256: createHash('sha256').update(patchText).digest('hex'),
    osLevelNetworkIsolationClaimed: false,
  })
  const verdictPath = join(HERE, 'plan-verdict.json')
  writeJson(verdictPath, {
    schema: `${SUITE}/plan/1`,
    at: new Date().toISOString(),
    head,
    hostPin: TEST_USE_BASELINE_SHA,
    preflight: { exit: preflight.status, verdict: preflight.verdict?.verdict ?? null, summary: preflight.verdict?.summary ?? null, checks: preflight.verdict?.checks ?? [] },
    tabledCases: CASES,
    untabledCases: UNTABLED_CASES,
    osLevelNetworkIsolationClaimed: false,
  })
  log('PLAN OK')
}

// ─────────────────────────────────────────────────────────────────────────────
// boot
// ─────────────────────────────────────────────────────────────────────────────

function archivePreBoot({ head }) {
  const dir = join(OUT, '..', '..', '..', '..', 'dev', 'agent-workflow', 'evidence', SUITE, 'archive')
  void dir
  return { files: [] }
}

function toolResultTextsOf(requests) {
  return requests.flatMap((r) => toolMsgsOf(r))
}

async function boot({ evidenceDir }) {
  OUT = resolve(evidenceDir)
  RUN_LOG = join(OUT, 'run.log')
  mkdirSync(OUT, { recursive: true })
  rmSync(RUN_LOG, { force: true })
  log(`BOOT MODE. repo=${REPO_ROOT} hostTree=${HOST_TREE} evidence=${OUT}`)

  const head = resolveHeadCommit(REPO_ROOT)
  if (head === null) throw new Error('git rev-parse HEAD failed: the grant cannot be bound')
  log(`HEAD=${head} pinned host=${TEST_USE_BASELINE_SHA}`)
  if (!existsSync(HOST_TOOL_BASH_PERSISTENT)) throw new Error(`the pinned persistent-bash module is missing: ${HOST_TOOL_BASH_PERSISTENT}`)
  if (!existsSync(GRANT_PATH)) throw new Error(`no dev-live grant at ${GRANT_PATH}`)
  if (!existsSync(BUNDLE_PATH)) throw new Error(`NO PREFLIGHT BUNDLE at ${BUNDLE_PATH}: run --plan first`)

  // The bundle must be bound to THIS head, and the shared preflight must PASS
  // for THIS bundle right now. A stale PASS is not a gate.
  const bundle = readJson(BUNDLE_PATH)
  if (String(bundle?.candidate?.head ?? '') !== head) {
    throw new Error(`the preflight bundle is bound to ${String(bundle?.candidate?.head ?? 'null')} but HEAD is ${head}; re-run --plan`)
  }
  const preflight = runSharedPreflight()
  log(`shared preflight re-run: exit=${String(preflight.status)} verdict=${String(preflight.verdict?.verdict ?? 'null')} summary=${String(preflight.verdict?.summary ?? '')}`)
  if (preflight.verdict?.verdict !== 'PASS') {
    throw new Error(`PREFLIGHT_NOT_PASS: ${String(preflight.verdict?.verdict ?? `exit ${String(preflight.status)}`)} ${JSON.stringify(preflight.verdict?.findings ?? []).slice(0, 3000)}`)
  }
  const authority = authorityBlock()
  if (bundle.authority?.contentDigest !== authority.contentDigest || bundle.authority?.snapshotVersion !== authority.snapshotVersion) {
    throw new Error(`AUTHORITY_MOVED: bundle=${JSON.stringify({ v: bundle.authority?.snapshotVersion, d: bundle.authority?.contentDigest })} now=${JSON.stringify({ v: authority.snapshotVersion, d: authority.contentDigest })}`)
  }
  log(`authority: snapshot=${authority.snapshotVersion} digest=${authority.contentDigest.slice(0, 16)}… baseline=${authority.baseline}`)

  // ── row composition precondition (never spend a start on it) ────────────
  const dry = rowsFor({ home: join(HERE, '.rowcheck'), workspaceDir: HERE })
  const identity = rowIdentityCheck(dry.rows)
  if (identity.ok !== true) throw new Error(`row composition refused before any ledger row: ${identity.reason}: ${identity.detail}`)

  const LEDGER_PATH = join(OUT, 'run-ledger.jsonl')
  const RUN_RECORD_PATH = join(OUT, 'run-record.json')
  const runId = `${SUITE}-${new Date().toISOString().replace(/[:.]/gu, '-')}`
  const record = createRunRecord({
    runId,
    suite: SUITE,
    selectedCases: SELECTED_CASES,
    recordClass: 'DEV-LIVE',
    bindings: {
      teamSha: head,
      hostSha: TEST_USE_BASELINE_SHA,
      hostTree: HOST_TREE,
      line: LINE,
      face: FACE,
      worldLine: LINE,
      recordClass: 'DEV-LIVE',
      grantScope: 'DEV-LIVE',
      grantId: 'devlive-pty-shell-1',
      candidateClaimEligibility: 'DEV-LIVE record: never eligible for a V@B=yes or any frozen-candidate claim (enforced by run-record.mjs#finalize)',
      sink: 'world-home a5sf-consult.jsonl (copy: guard-facts.json)',
      authority: {
        pointer: { snapshot_version: authority.snapshotVersion, content_digest: authority.contentDigest },
        baseline: authority.baseline,
        pointerSha256: authority.pointerSha256,
      },
      providerComposition: 'test row a5sf-pty-realm-provider-row.mjs (the product has no v3-blueprint -> compiled-lane bridge at this base); the intersection is the product algebra intersectPathRuleSets',
      laneAlgebra: 'packages/runtime/dist/packages/runtime/member-io-policy/src/path-rules.js # intersectPathRuleSets',
      toolCaller: 'test-composition tool a5sf-pty-bash-probe-tool.mjs (calls the shipped confined face; decides nothing), mounted on the preset AND shadowed by the realm',
      osLevelNetworkIsolationClaimed: false,
    },
    ledgerPath: LEDGER_PATH,
  })
  const harness = createA5sfHarness({
    repoRoot: REPO_ROOT,
    evidenceRoot: OUT,
    suite: SUITE,
    line: LINE,
    runRecord: record,
    maxHostStarts: 2,
    hostTree: HOST_TREE,
  })

  const lease = await preRegisterBudget({
    grantPath: GRANT_PATH,
    headCommit: head,
    runRecord: record,
    requiredBoots: 1,
    face: FACE,
    world: LINE,
    leaseRoot: harness.factory.leaseRoot,
  })
  log(`dev-live lease open: grant=${lease.grant.grantId} face=${lease.face} world=${lease.world} slotHeld=${String(lease.holdsSlot())}`)

  const add = (id, verdict, detail = {}) => {
    record.addCase(id, verdict, detail)
    log(`case ${id}: ${verdict} ${redact(JSON.stringify(detail)).slice(0, 900)}`)
  }

  let world = null
  let bootInfo = null
  let teardown = null
  let stage = 'preconditions'
  let runPaths = null
  let fixtures = null
  const routingLog = []

  try {
    stage = 'world-create'
    world = await harness.createWorld({ line: LINE, u6Fs: { rows: [] } })
    const { rows, config, paths } = rowsFor({ home: world.home, workspaceDir: world.workspaceDir })
    runPaths = paths
    fixtures = { ...plantFixtures({ paths }), presetProbeLedger: paths.presetProbeLedger, realmProbeLedger: paths.realmProbeLedger }
    const handed = handOverRows(world, rows)
    if (JSON.stringify(handed) !== JSON.stringify(rows.map((r) => r.id))) throw new Error('row handoff identity/order mismatch')
    log(`world=${world.id} rows=${JSON.stringify(handed)}`)
    mkdirSync(config.blueprintDir, { recursive: true })
    writeFileSync(join(config.blueprintDir, 'anchor.yaml'), BP_ANCHOR_YAML)
    assertBlueprintText(BP_ANCHOR_YAML, BP_ANCHOR_ID, 1, 'anchor.yaml')
    writeFileSync(join(config.blueprintDir, 'main.yaml'), mainBlueprintYaml(['__PLACEHOLDER__']))
    writeFileSync(join(world.home, 'p6t6-directive.json'), `${JSON.stringify({
      boot: 1,
      phase: 'create',
      reportDir: world.logDir,
      runStamp: world.id,
      rootSessionId: CREATE_ROOT,
    }, null, 2)}\n`)
    const homePin = homeSandboxPin({ home: world.home, workspaceRoot: world.workspaceDir })
    writeJson(join(OUT, 'fixtures.json'), {
      at: new Date().toISOString(),
      workspace: paths.workspace,
      lanes: { read: paths.laneInside, writeOnly: paths.writeOnly },
      files: fixtures,
      secrets: {
        product: SECRET_TOKEN_PRODUCT,
        face: SECRET_TOKEN_FACE,
        kernel: SECRET_TOKEN_KERNEL,
        writeOnly: SECRET_TOKEN_WRITEONLY,
      },
      homePin,
      rows: handed,
      osLevelNetworkIsolationClaimed: false,
    })

    stage = 'mock-start'
    const decide = makeDecide({ routingLog, paths })
    await world.startMock({ decide })
    log(`mock started on port ${String(world.mock?.port)}`)

    stage = 'boot-host'
    bootInfo = await lease.boot(() => harness.boot({ world, phase: `${SUITE}-boot1`, bootTimeoutMs: BOOT_TIMEOUT_MS }))
    record.record.boots = [{ phase: `${SUITE}-boot1`, world: world.id, port: bootInfo.port, logPath: bootInfo.logPath }]
    // The 2-concurrent dev-Host cap is a MACHINE slot, taken by lease.boot()
    // immediately before the spawn and released by lease.finish(). Assert it is
    // actually held at the moment the Host exists: a slot that was never taken
    // would make every concurrency statement in this evidence false.
    if (lease.holdsSlot() !== true) throw new Error('DEV_LIVE_SLOT_NOT_HELD: lease.boot() returned without a machine slot')
    log(`dev-live slot held=${String(lease.holdsSlot())} (DEV_LIVE_SLOT_LIMIT=2 machine-wide)`)
    log(`BOOTED port=${bootInfo.port} log=${bootInfo.logPath}`)

    const origin = `http://127.0.0.1:${bootInfo.port}`
    const hostPid = world.instance?.child?.pid ?? null
    const cookie = await authenticate(origin, world.token)
    log(`authenticated (token never recorded); host pid=${String(hostPid)}`)
    const toolRoute = async (name, args, as, callId) => fetchJson(`${origin}/__p6t6/tool`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name, args, as, callId }),
    }, 180_000)

    stage = 'health-gate'
    const health = await pollHealth(origin, { timeoutMs: BOOT_TIMEOUT_MS })
    writeJson(join(OUT, 'health.json'), {
      gate: 'poll',
      fixedDefect: 'a single 404-while-pending probe aborts the world and the world teardown is then reported as `TeamDomain is closed` (PD-11 masking); this gate polls and keeps every body',
      timeoutMs: health.timeoutMs,
      elapsedMs: health.elapsedMs,
      probeCount: health.probes.length,
      kind: health.kind,
      final: health.final,
      probes: health.probes,
      osLevelNetworkIsolationClaimed: false,
    })
    if (health.kind === 'failed') throw new Error(`health gate: settled failure status=200 ok=false setupError=${JSON.stringify(health.final?.body?.setupError ?? null)} after ${String(health.elapsedMs)}ms`)
    if (health.kind === 'timeout') throw new Error(`health gate timed out after ${String(health.timeoutMs)}ms (${String(health.probes.length)} probes); last status=${JSON.stringify(health.final?.status ?? null)}`)
    log(`health 200 ready=${String(health.final.body.ready)} after ${String(health.elapsedMs)}ms (${String(health.probes.length)} probe(s))`)

    // ── discovery-first ────────────────────────────────────────────────────
    stage = 'discover-leader-surface'
    const discW = await waitFor(async () => {
      const res = await apiPrompt(origin, cookie, ROOT, `${MARKERS.discovery}: reply with one short line. Call no tool.`, 'ptydv-disc')
      return res.status === 200 ? res : null
    }, 60_000, 2000)
    if (!discW.hit) throw new Error('the discovery prompt was never accepted on the anchor session')
    const surfaceW = await waitFor(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, MARKERS.discovery) && surfaceNamesOf(r).length > 0), 90_000)
    if (!surfaceW.hit) throw new Error('the discovery model request never carried a tool surface')
    const discRequest = [...world.mock.requests]
      .filter((r) => hasMarker(r, MARKERS.discovery))
      .sort((a, b) => surfaceNamesOf(b).length - surfaceNamesOf(a).length)[0]
    const surface = [...new Set(surfaceNamesOf(discRequest))].sort()
    const denyList = surface
      .filter((name) => !name.startsWith('team_') && !MANAGED_TOOL_NAMES.includes(name) && !SAFE_UNMANAGED_TOOL_NAMES.includes(name))
      .sort()
    writeJson(join(OUT, 'surface.json'), {
      discovery: { marker: MARKERS.discovery, tools: surface, toolsCount: surface.length },
      denyList,
      memberPresetSurfaceNote: 'the LEADER preset is the same preset id as the member preset, so this surface is also the member preset surface minus the team tools',
      provenance: 'the tool list the mock recorded on the ANCHOR leader\'s own model request',
      osLevelNetworkIsolationClaimed: false,
    })
    log(`discovery surface (${String(surface.length)}): ${JSON.stringify(surface)}`)
    log(`discovery-first deny list: ${JSON.stringify(denyList)}`)

    stage = 'write-main-blueprint'
    const mainText = mainBlueprintYaml(denyList)
    writeFileSync(join(config.blueprintDir, 'main.yaml'), mainText)
    const parsedMain = assertBlueprintText(readFileSync(join(config.blueprintDir, 'main.yaml'), 'utf8'), BP_MAIN_ID, 3, 'main.yaml')
    log(`main blueprint parsed; builtinToolDeny entries=${String(parsedMain.builtinToolDeny?.length ?? 0)}`)

    stage = 'create-team'
    const created = await remoteCall(fetchJson, origin, cookie, 'team.create', {
      rootSessionId: CREATE_ROOT,
      blueprintId: BP_MAIN_ID,
      initialWork: { prompt: `${MARKERS.create}: reply with one short line. Call no tool.` },
    }, 'ptydv-create', 1)
    writeJson(join(OUT, 'create-team.json'), { status: created.status, body: created.body, osLevelNetworkIsolationClaimed: false })
    if (created.status !== 200 || created.body?.result?.ok !== true) {
      throw new Error(`team.create refused: status=${created.status} body=${JSON.stringify(created.body).slice(0, 4000)}`)
    }
    log(`team.create ok on ${CREATE_ROOT}`)

    stage = 'state-gate'
    const stateW = await waitFor(async () => {
      const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
      if (st.status !== 200) return null
      if (st.body?.rootSessionId !== CREATE_ROOT) return null
      if (st.body?.teamSession?.rootSessionId !== CREATE_ROOT) return null
      if (String(st.body?.teamSession?.blueprintId ?? '') !== BP_MAIN_ID) return null
      return { status: st.status, body: st.body }
    }, 90_000)
    if (!stateW.hit) throw new Error('the created team never appeared on the directive root state route')
    writeJson(join(OUT, 'state.json'), { ...stateW.value, osLevelNetworkIsolationClaimed: false })
    log(`state-gate open: blueprint=${String(stateW.value.body.teamSession.blueprintId)} members=${String((stateW.value.body.members ?? []).length)}`)

    stage = 'live-leader-gate'
    const liveW = await waitFor(async () => {
      const h = await fetchJson(`${origin}/__p6t6/health`, undefined, 30_000)
      const list = Array.isArray(h.body?.liveSessions) ? h.body.liveSessions : []
      return list.includes(CREATE_ROOT) ? list : null
    }, 90_000)
    if (!liveW.hit) throw new Error(`the created team root ${CREATE_ROOT} never became a live agent`)
    log(`live leader gate open: liveSessions=${JSON.stringify(liveW.value)}`)

    const waitMember = async (label) => {
      const found = await waitFor(async () => {
        const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
        if (st.status !== 200) return null
        const member = (st.body?.members ?? []).find((m) => String(m.label) === label && String(m.childSessionId ?? '') !== '')
        return member === undefined ? null : member
      }, 180_000)
      if (!found.hit) throw new Error(`member ${label} never became live`)
      return found.value
    }

    const delegate = async ({ label, templateId, prompt, callId }) => {
      const res = await toolRoute('team_delegate', {
        rootSessionId: CREATE_ROOT,
        requestToken: callId,
        delegationTemplateId: templateId,
        label,
        prompt,
      }, CREATE_ROOT, callId)
      writeJson(join(OUT, `delegate-${label}.json`), { status: res.status, body: res.body, osLevelNetworkIsolationClaimed: false })
      log(`delegate ${label}: status=${res.status} ok=${String(res.body?.ok)}`)
      if (res.status !== 200 || res.body?.ok !== true) {
        throw new Error(`team_delegate refused for ${label}: status=${res.status} body=${JSON.stringify(res.body).slice(0, 2000)}`)
      }
      const member = await waitMember(label)
      log(`member ${label}: instanceId=${String(member.instanceId)} childSessionId=${String(member.childSessionId)} lifecycle=${String(member.lifecycle)}`)
      return member
    }

    // ── Q1 + Q2 + Q3(product): the Member's OWN model turn ─────────────────
    stage = 'delegate-worker'
    const worker = await delegate({
      label: 'ptydv-worker',
      templateId: 'worker',
      callId: 'ptydv-delegate-worker',
      prompt: `${MARKERS.worker}: this is a Shell/PTY measurement. Execute exactly the bash commands you are given, one tool call per turn, then stop. Do not call any other tool.`,
    })
    const workerInstanceId = String(worker.instanceId)
    const workerSession = String(worker.childSessionId)

    stage = 'member-bash-calls'
    const doneW = await waitFor(() => {
      const reqs = (world.mock?.requests ?? []).filter((r) => hasMarker(r, MARKERS.worker))
      return reqs.some((r) => toolResultTextsOf([r]).some((m) => m.text.includes('A5SF_PTY_WORKER_DONE') || m.text.includes('A5SF_PTY_READ_STATUS'))) ? reqs : null
    }, 180_000)
    if (!doneW.hit) log(`the worker turn did not reach its scripted end within the window; recording what exists (${String(doneW.elapsedMs)}ms)`)
    const workerRequests = (world.mock?.requests ?? []).filter((r) => hasMarker(r, MARKERS.worker))
    const workerToolResults = toolResultTextsOf(workerRequests)
    const withSurface = workerRequests.filter((r) => surfaceNamesOf(r).length > 0)
    const workerSurface = withSurface.length > 0 ? [...new Set(surfaceNamesOf(withSurface[withSurface.length - 1]))].sort() : []
    const toolResultText = (tag) => {
      const hit = workerToolResults.find((m) => m.text.includes(tag))
      return hit === undefined ? null : hit
    }
    const r1 = toolResultText('A5SF_PTY_RUN=1')
    const r2 = toolResultText('A5SF_PTY_RUN=2')
    const r3 = toolResultText('A5SF_PTY_READ=start')
    const parseTag = (text, tag) => {
      if (typeof text !== 'string') return null
      const m = new RegExp(`${tag}=([^\\n"]*)`, 'u').exec(text)
      return m === null ? null : m[1].trim()
    }
    const ptyOf = (text) => (text === null ? null : {
      run: parseTag(text.text, 'A5SF_PTY_RUN'),
      pid: Number(parseTag(text.text, 'A5SF_PTY_PID')),
      ps: parseTag(text.text, 'A5SF_PTY_PS'),
      fd0: parseTag(text.text, 'A5SF_PTY_FD0'),
      ttyCmd: parseTag(text.text, 'A5SF_PTY_TTYCMD'),
      ppid: Number(parseTag(text.text, 'A5SF_PTY_PPID')),
      sess: Number(parseTag(text.text, 'A5SF_PTY_SESS')),
      ttyNr: Number(parseTag(text.text, 'A5SF_PTY_TTYNR')),
      cwd: parseTag(text.text, 'A5SF_PTY_CWD'),
      startCwd: parseTag(text.text, 'A5SF_PTY_START_CWD'),
      sharedSeen: parseTag(text.text, 'A5SF_PTY_SHARED_SEEN'),
      isError: text.isError === true,
    })
    const pty1 = ptyOf(r1)
    const pty2 = ptyOf(r2)
    const writeJsonSafe = (name, value) => writeJson(join(OUT, name), value)

    // The composed profile: Q1's attribution starts at what the profile declares.
    const composedPatchPath = join(world.home, 'profiles', 'web', 'cordis.patch.yml')
    const composedPatch = existsSync(composedPatchPath) ? readFileSync(composedPatchPath, 'utf8') : ''
    try { copyFileSync(composedPatchPath, join(OUT, 'composed-profile.patch.yml')) } catch { /* absent is recorded below */ }
    const profileHas = (needle) => composedPatch.includes(needle)
    const counterRows = () => parseJsonl(runPaths.counter)
    const confinedSpawnRows = () => counterRows().filter((row) => String(row?.leg ?? '').startsWith('confined-spawn'))
    const realmMemberRows = () => counterRows().filter((row) => row?.leg === 'realm-member')
    const factsRows = () => parseJsonl(runPaths.sink)
    const presetProbeRows = () => parseJsonl(runPaths.presetProbeLedger)
    const realmProbeRows = () => parseJsonl(runPaths.realmProbeLedger)

    const proc1 = procObservation(pty1?.pid)
    const proc2 = procObservation(pty2?.pid)
    const channelOf = (pty, proc) => {
      const ttyNr = Number.isInteger(pty?.ttyNr) ? pty.ttyNr : null
      return {
        pid: pty?.pid ?? null,
        ps: pty?.ps ?? null,
        psSess: pty?.ps?.split(/\s+/u)[1] ?? null,
        psTty: pty?.ps?.split(/\s+/u)[2] ?? null,
        ttyCmd: pty?.ttyCmd ?? null,
        fd0: pty?.fd0 ?? null,
        // the shell's OWN /proc/$$/stat fields (namespace-independent facts)
        self: {
          ppid: Number.isInteger(pty?.ppid) ? pty.ppid : null,
          session: Number.isInteger(pty?.sess) ? pty.sess : null,
          ttyNr,
          ttyMajor: ttyNr === null ? null : (ttyNr >> 8),
          ttyMinor: ttyNr === null ? null : (ttyNr & 0xff),
        },
        // the DRIVER's /proc read: recorded, never gating (see outerProcNote)
        outerProc: proc === null ? null : {
          readable: proc.readable === true,
          comm: proc.comm ?? null,
          ppid: proc.ppid ?? null,
          session: proc.session ?? null,
          ttyNr: proc.ttyNr ?? null,
          fd0: proc.fd0Target ?? null,
          cmdline: proc.cmdline ?? null,
        },
        outerProcNote: 'non-gating: the driver reads /proc/<pid> in ITS OWN PID namespace. The shell\'s `$$` is namespace-local on this World (the host runs inside the platform sandbox), so this field is recorded to SHOW the namespace boundary, not to prove or disprove the PTY.',
      }
    }
    const ch1 = channelOf(pty1, proc1)
    const ch2 = channelOf(pty2, proc2)

    /** Ask `pty_observe` on ONE Member session and normalize the answer. */
    const observeOn = async (session, tag) => {
      const res = await toolRoute('pty_observe', {}, session, `ptydv-probe-observe-${tag}`)
      const value = res.status === 200 && res.body?.ok === true
        ? (() => { try { return JSON.parse(res.body.value) } catch { return null } })()
        : null
      const sessions = Array.isArray(value?.sessions) ? value.sessions : []
      return {
        ok: value !== null,
        status: res.status,
        httpError: res.status === 200 ? null : String(res.body?.error?.message ?? res.body?.error ?? ''),
        owner: value?.owner ?? null,
        backends: Array.isArray(value?.backends) ? value.backends.map(String) : [],
        sessions,
        shellSessions: sessions.filter((one) => String(one?.type ?? '') === 'shell'),
        errors: Array.isArray(value?.errors) ? value.errors : [],
      }
    }

    // ── Q1's DIRECT witness: ask the PTY SERVICE, not the profile ───────────
    // `pty_observe` is mounted INSIDE the same preset group as the `bash` tool,
    // so it reaches the SAME isolated `terminals` instance that served the call.
    // Route-C shadows only the names in `a5sfNativeToolModules`; this preset
    // tool stays the preset's and calls the inherited service.
    const observeWitness = {
      ...(await observeOn(workerSession, 'worker1')),
      note: 'the PTY service itself, asked on the SAME owner handle the `bash` tool used; mounted inside the same preset group so it observes the SAME isolated `terminals` instance',
    }
    writeJson(join(OUT, 'pty-service-witness.json'), { at: new Date().toISOString(), witness: observeWitness, osLevelNetworkIsolationClaimed: false })
    log(`pty_observe: ok=${String(observeWitness.ok)} backends=${JSON.stringify(observeWitness.backends)} sessions=${String(observeWitness.sessions.length)} shellSessions=${String(observeWitness.shellSessions.length)} errors=${JSON.stringify(observeWitness.errors)}`)

    const bashSpawnInConfined = confinedSpawnRows().filter((row) => Array.isArray(row?.argv) && row.argv.some((a) => String(a).includes('A5SF_PTY_RUN')))
    const realmFacesForWorker = realmMemberRows().find((row) => String(row?.memberInstanceId ?? '') === workerInstanceId) ?? null

    const q1Checks = {
      memberSurfaceHasBash: workerSurface.includes('bash'),
      memberTurnRan: withSurface.length > 0,
      bashCallServed: pty1 !== null && pty1.isError !== true && pty1.pid > 0,
      realPtySlaveOnFd0: typeof ch1.fd0 === 'string' && ch1.fd0.startsWith('/dev/pts/'),
      controllingTerminalIsPts: ch1.self.ttyMajor === 136 && ch1.self.ttyNr !== 0,
      ttyDeviceNumbersMatchFd0: ch1.self.ttyMinor !== null && String(ch1.fd0) === `/dev/pts/${String(ch1.self.ttyMinor)}`,
      profileDeclaresPtyStack: profileHas('@deepseek-ai/dsh-terminal') && profileHas('@deepseek-ai/dsh-terminal-bash') && profileHas('@deepseek-ai/dsh-tool-bash-persistent'),
      realmAnsweredNoTerminalFace: realmFacesForWorker !== null && realmFacesForWorker.hasTerminalsFace === false,
      confinedProviderRanNoBash: bashSpawnInConfined.length === 0,
      presetProbeUnused: presetProbeRows().length === 0,
      serviceWitnessListsOneShellSession: observeWitness.ok === true && observeWitness.shellSessions.length >= 1,
      serviceWitnessRegistersShellBackend: observeWitness.ok === true && observeWitness.backends.includes('shell'),
    }
    const q1Verdict = Object.values(q1Checks).every((v) => v === true) ? 'PASS' : 'FAIL'
    const q1Artifact = {
      schema: `${SUITE}/member-terminal-face/1`,
      at: new Date().toISOString(),
      caseId: 'member-terminal-face',
      question: 'What terminal does a Member actually get on today\'s product path, and which service does its tool call reach?',
      answeredBy: 'the Member\'s OWN model turn: the mock issued the `bash` tool call the driver scripted',
      ownerRuling: 'DEV-LIVE development evidence; never a candidate claim and never V@B',
      member: { instanceId: workerInstanceId, childSessionId: workerSession, templateId: 'worker', legacy: true, capabilitiesAbsent: true },
      surface: { toolsFromMemberModelRequest: workerSurface, hasBash: workerSurface.includes('bash') },
      call: { tool: 'bash', command: cmdOneOf(runPaths), toolResultIsError: pty1?.isError ?? null, raw: r1?.text ?? null },
      result: {
        channel: ch1,
        shellStartCwd: pty1?.startCwd ?? null,
        proc: proc1,
        sameForSecondCall: null,
        presetProbeRows: presetProbeRows().length,
        confinedSpawnRowsDuringBash: bashSpawnInConfined,
        allConfinedSpawnRows: confinedSpawnRows(),
      },
      attribution: {
        service: '@deepseek-ai/dsh-terminal — `TerminalSessionService` (pinned host 0.639ed01539)',
        backend: '@deepseek-ai/dsh-terminal-bash (the `shell` pty backend the service registers)',
        tool: '@deepseek-ai/dsh-tool-bash-persistent (inject: [\'tools\',\'terminals\'])',
        whyThisService: [
          'the composed profile for this World declares exactly one `bash` tool row: @deepseek-ai/dsh-tool-bash-persistent, inside the preset group that also mounts @deepseek-ai/dsh-terminal and @deepseek-ai/dsh-terminal-bash (composed-profile.patch.yml)',
          'the tool row cannot obtain a PTY from anywhere else: its only PTY seam is inject [\'tools\',\'terminals\']',
          'the shell\'s OWN /proc/$$/stat reports a controlling terminal whose tty_nr major is 136 (the Linux pts major) and a positive session id, and /proc/$$/fd/0 resolves to a /dev/pts/N slave',
          'the confined subprocess provider (the realm\'s other process face) recorded NO spawn attempt for the bash command, so the shell did not come from the confined face',
          'the governed realm\'s own compiled answer for this Member records realmFaces=[subprocess] and hasTerminalsFace=false, so no realm installed a terminal',
        ],
        serviceWitness: observeWitness,
        serviceWitnessProves: 'the isolated `terminals` instance the preset group owns registered the `shell` backend type and held exactly one owner-scoped session for this Member, whose snapshot names the session id, type and pid — i.e. the SERVICE that served the call, not an inference from the profile',
        governedRealmAnswer: realmFacesForWorker,
        composedProfilePresent: composedPatch !== '',
        profileHasPtyStack: q1Checks.profileDeclaresPtyStack,
      },
      locus: {
        layer: 'Product preset (inherited legacy-generation PTY), NOT a governed realm face',
        detail: 'request -> tool route -> agent tools -> @deepseek-ai/dsh-tool-bash-persistent -> ctx.terminals -> TerminalSessionService -> @deepseek-ai/dsh-terminal-bash -> node-pty -> /dev/pts/N',
        notTheConfinedFace: 'zero confined-spawn-attempt rows carry the bash command',
      },
      checks: q1Checks,
      verdict: q1Verdict,
      limits: {
        notClaimed: 'this is an attribution of the SERVICE that served the call on this composition; it is not a claim that the pinned PTY service is safe, confined or isolated',
        osLevelNetworkIsolationClaimed: false,
      },
      osLevelNetworkIsolationClaimed: false,
    }
    writeJsonSafe('item1-member-terminal-face.json', q1Artifact)
    add('member-terminal-face', q1Verdict, {
      service: q1Artifact.attribution.service,
      pid: ch1.pid, ttyNr: ch1.self.ttyNr, fd0: ch1.fd0, serviceSessionId: observeWitness.shellSessions[0]?.sessionId ?? null,
      realmHasTerminalsFace: realmFacesForWorker?.hasTerminalsFace ?? null,
      confinedSpawnForBash: bashSpawnInConfined.length,
      failedChecks: Object.entries(q1Checks).filter(([, v]) => v !== true).map(([k]) => k),
      artifact: 'item1-member-terminal-face.json',
    })

    // ── Q2: same PTY across commands, and the second-Member control ─────────
    stage = 'delegate-worker2-control'
    const worker2 = await delegate({
      label: 'ptydv-worker2',
      templateId: 'worker2',
      callId: 'ptydv-delegate-worker2',
      prompt: `${MARKERS.worker2}: execute exactly the bash command you are given, one tool call, then stop.`,
    })
    await waitFor(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, MARKERS.worker2) && toolMsgsOf(r).some((m) => m.text.includes('A5SF_PTY_RUN=2C'))), 180_000)
    const worker2Requests = (world.mock?.requests ?? []).filter((r) => hasMarker(r, MARKERS.worker2))
    const r2c = toolResultTextsOf(worker2Requests).find((m) => m.text.includes('A5SF_PTY_RUN=2C')) ?? null
    const pty2c = r2c === null ? null : (() => {
      const t = r2c.text
      return {
        run: parseTag(t, 'A5SF_PTY_RUN'),
        pid: Number(parseTag(t, 'A5SF_PTY_PID')),
        ps: parseTag(t, 'A5SF_PTY_PS'),
        fd0: parseTag(t, 'A5SF_PTY_FD0'),
        isError: r2c.isError === true,
      }
    })()
    const proc2c = procObservation(pty2c?.pid)
    const ch2c = channelOf(pty2c, proc2c)
    const w2Witness = { ...(await observeOn(String(worker2.childSessionId), 'worker2')) }
    writeJson(join(OUT, 'pty-service-witness-worker2.json'), { at: new Date().toISOString(), witness: w2Witness, osLevelNetworkIsolationClaimed: false })
    log(`pty_observe worker2: ok=${String(w2Witness.ok)} sessions=${String(w2Witness.sessions.length)} shellSessions=${String(w2Witness.shellSessions.length)}`)
    const sessionIdOf = (witness) => (witness.shellSessions[0]?.sessionId ?? null)
    const servicePidOf = (witness) => (witness.shellSessions[0]?.pid ?? null)
    const q2Checks = {
      twoCommandsInOneMemberTurn: pty1 !== null && pty2 !== null,
      samePid: pty1 !== null && pty2 !== null && pty1.pid === pty2.pid && pty1.pid > 0,
      // NOT gated: session ids are PID-namespaced (both read 0), and equal pids
      // are not discriminating (every Member's shell reads `$$`=2). The state
      // below is what only ONE live shell can produce.
      sameTtyDevice: Number.isInteger(ch1.self.ttyNr) && ch1.self.ttyNr === ch2.self.ttyNr && ch1.self.ttyNr !== 0 && String(ch1.fd0) === String(ch2.fd0),
      shareEnvAcrossCalls: pty2?.sharedSeen === SHARED_ENV_TOKEN,
      shareCwdAcrossCalls: pty2?.cwd === runPaths.laneInside && pty1?.cwd === runPaths.laneInside,
      notARespawn: pty1 !== null && pty2 !== null && pty1.run === '1' && pty2.run === '2' && pty1.isError !== true && pty2.isError !== true,
      controlTurnRanBash: pty2c !== null && pty2c.pid > 0,
      controlOwnsADifferentServiceSession: observeWitness.ok && w2Witness.ok
        && sessionIdOf(w2Witness) !== null && sessionIdOf(observeWitness) !== null
        && sessionIdOf(w2Witness) !== sessionIdOf(observeWitness),
      controlServicePidDiffers: servicePidOf(w2Witness) !== null && servicePidOf(observeWitness) !== null
        && servicePidOf(w2Witness) !== servicePidOf(observeWitness),
    }
    const q2Verdict = Object.values(q2Checks).every((v) => v === true) ? 'PASS' : 'FAIL'
    writeJsonSafe('item2-same-pty-multi-command.json', {
      schema: `${SUITE}/same-pty-multi-command/1`,
      at: new Date().toISOString(),
      caseId: 'same-pty-multi-command',
      question: 'Do several commands in one Member session share ONE backend PTY, or does each command spawn?',
      initiation: 'the Member\'s own model turn: the mock issued two sequential `bash` calls',
      member: { instanceId: workerInstanceId, childSessionId: workerSession, templateId: 'worker' },
      commands: [cmdOneOf(runPaths), cmdTwoOf(runPaths)],
      channels: { first: ch1, second: ch2 },
      control: {
        member: { instanceId: String(worker2.instanceId), childSessionId: String(worker2.childSessionId), templateId: 'worker2' },
        command: cmdTwoControlOf(runPaths),
        channel: ch2c,
        serviceWitness: w2Witness,
        purpose: 'a second Member on the SAME World: if the two Members shared one shell, "same pid" would be a global fact rather than a per-Member one. The DISCRIMINATOR is the PTY service\'s own owner-scoped session identity (two agents cannot share one owner-scoped session), because the in-namespace pids of two different Members can both read `2`.',
      },
      locus: { layer: 'Product preset (inherited legacy-generation PTY)', service: '@deepseek-ai/dsh-terminal' },
      checks: q2Checks,
      verdict: q2Verdict,
      limits: { note: 'same pid/session/tty is PTY identity, not process-tree confinement; the shell is the legacy persistent shell the preset mounts', osLevelNetworkIsolationClaimed: false },
      osLevelNetworkIsolationClaimed: false,
    })
    add('same-pty-multi-command', q2Verdict, {
      pid: ch1.pid, sessions: [ch1.self.session, ch2.self.session], ttyNrs: [ch1.self.ttyNr, ch2.self.ttyNr],
      controlPid: ch2c?.pid ?? null, controlServiceSessionId: sessionIdOf(w2Witness),
      failedChecks: Object.entries(q2Checks).filter(([, v]) => v !== true).map(([k]) => k),
      artifact: 'item2-same-pty-multi-command.json',
    })

    // ── Q3 on the PRODUCT PATH: the Member's own bash reads the secret ──────
    stage = 'product-shell-read'
    const productReadText = r3?.text ?? ''
    const productBytesReturned = productReadText.includes(SECRET_TOKEN_PRODUCT)
    const productReadStatus = parseTag(productReadText, 'A5SF_PTY_READ_STATUS')
    const q3pChecks = {
      readExecuted: r3 !== null && r3.isError !== true,
      bytesReturned: productBytesReturned,
      exitZero: productReadStatus === '0',
      noGuardFactForProductRead: factsRows().filter((fact) => String(fact?.locator ?? '').includes('secret-product')).length === 0,
    }
    const q3pVerdict = Object.values(q3pChecks).every((v) => v === true) ? 'PASS' : 'FAIL'
    writeJsonSafe('item3-product-shell-read.json', {
      schema: `${SUITE}/product-shell-read-unlanned/1`,
      at: new Date().toISOString(),
      caseId: 'product-shell-read-unlanned',
      question: 'On the Product path, does a read attempt refuse on the read axis and return no bytes?',
      laneExpectation: { declared: 'deny', why: 'the write-only root is writable and declared unreadable; the bundle tables expected=deny for the LANE' },
      observed: { decision: productBytesReturned ? 'allow' : 'deny', bytesReturned: productBytesReturned, exitStatus: productReadStatus },
      command: `cat ${runPaths.secretProduct}`,
      invocation: 'the Member\'s own model turn (mock-issued `bash` call #3)',
      locus: {
        layer: 'Product preset (inherited legacy-generation PTY)',
        detail: 'the confined write-only lane is NEVER consulted on this path: no a5sf guard fact names the locator, and the shell reads the file inside the child process',
      },
      contrast: 'the SAME locator class through the confined face (write-only-read-denied) is refused with IO_READ_DENIED and zero bytes — the two answers differ because the LAYERS differ',
      checks: q3pChecks,
      verdict: q3pVerdict,
      verdictMeaning: 'PASS = the proposition in the bundle\'s judgeProposition is proven: the product shell returns the bytes, i.e. the confined read axis is NOT on the product shell path. It is NOT a pass of the lane expectation.',
      limits: { note: 'this says the a5sf read axis is absent from the product shell path; it says nothing about OS-level file permissions the process happens to have', osLevelNetworkIsolationClaimed: false },
      osLevelNetworkIsolationClaimed: false,
    })
    add('product-shell-read-unlanned', q3pVerdict, {
      bytesReturned: productBytesReturned,
      observed: 'allow',
      laneExpectation: 'deny',
      locus: 'product preset / legacy PTY (no a5sf guard consultation)',
      failedChecks: Object.entries(q3pChecks).filter(([, v]) => v !== true).map(([k]) => k),
      artifact: 'item3-product-shell-read.json',
    })

    // ── Q3/Q4/Q5 on the CONFINED FACE ──────────────────────────────────────
    stage = 'confined-probes'
    const probe = async (memberSession, memberInstanceId, { label, body, cwd, reads, writes, chmod }) => {
      const before = {
        facts: factsRows().length,
        confined: confinedSpawnRows().length,
        realmProbe: realmProbeRows().length,
        presetProbe: presetProbeRows().length,
      }
      const res = await toolRoute('bash_probe', { body, cwd, ...(reads === undefined ? {} : { reads }), ...(writes === undefined ? {} : { writes }), ...(chmod === undefined ? {} : { chmod }) }, memberSession, `ptydv-probe-${label}`)
      const facts = factsRows().slice(before.facts)
      const confined = confinedSpawnRows().slice(before.confined)
      const realmProbe = realmProbeRows().slice(before.realmProbe)
      const presetProbe = presetProbeRows().slice(before.presetProbe)
      const bodyJson = res.body ?? null
      const errorMessage = res.status === 200 && bodyJson?.ok === false
        ? String(bodyJson?.error?.message ?? '')
        : (res.status === 200 ? '' : String(bodyJson?.error ?? ''))
      const errorInfo = res.status === 200 && bodyJson?.ok === false ? (bodyJson?.error?.info ?? null) : null
      // RUN-01 DEFECT: the typed code was read ONLY from `error.info.code`, which
      // the product route does not populate, so two refusals that DID happen were
      // judged FAIL. The code is stated in four places; take the first present
      // and RECORD all four so the reader can see which one answered.
      const probeRow = realmProbe[realmProbe.length - 1] ?? presetProbe[presetProbe.length - 1] ?? null
      const denyFact = facts.find((fact) => fact?.decision === 'deny') ?? null
      const messagePrefix = /^([A-Z][A-Z0-9_]{3,}):/u.exec(errorMessage)?.[1] ?? null
      const codes = {
        errorInfo: errorInfo?.code ?? null,
        probeRow: probeRow?.code ?? null,
        messagePrefix,
        guardFact: denyFact?.decidedBy ?? null,
      }
      const typedCode = codes.errorInfo ?? codes.probeRow ?? codes.messagePrefix ?? codes.guardFact ?? null
      const value = res.status === 200 && bodyJson?.ok === true ? bodyJson.value : null
      const parsedValue = typeof value === 'string' ? (() => { try { return JSON.parse(value) } catch { return null } })() : null
      const artifact = {
        label,
        request: { body, cwd, reads: reads ?? null, writes: writes ?? null, chmod: chmod ?? null },
        memberSession,
        memberInstanceId,
        status: res.status,
        ok: bodyJson?.ok ?? null,
        errorMessage,
        errorInfo,
        codes,
        typedCode,
        value: parsedValue,
        facts,
        confinedSpawnRows: confined,
        realmProbeRows: realmProbe,
        presetProbeRows: presetProbe,
        locus: presetProbe.length > 0
          ? 'PRESET bash_probe (the realm shadow did NOT attach) — this call did not reach the confined face'
          : (realmProbe.length > 0 ? 'confined subprocess face (shipped admission + P1-07 OS profile)' : 'unknown (no probe ledger row)'),
      }
      log(`probe ${label}: status=${String(res.status)} ok=${String(bodyJson?.ok)} code=${String(artifact.typedCode)} facts=${String(facts.length)} confinedRows=${String(confined.length)} presetRows=${String(presetProbe.length)}`)
      return artifact
    }

    // 1. write-only root DECLARED as a read -> must refuse on the READ axis
    const pWriteOnly = await probe(workerSession, workerInstanceId, {
      label: 'write-only-read',
      body: `cat ${JSON.stringify(runPaths.secretFace)}`,
      cwd: runPaths.laneInside,
      reads: [runPaths.secretFace],
    })
    const woFacts = pWriteOnly.facts.filter((f) => f?.decision === 'deny')
    const woChecks = {
      // The typed READ-AXIS reason is the shipped guard fact. The product ALSO
      // states a path-capability reason (`PATH_NOT_ALLOWED`) for the same
      // refusal; both are recorded, and the fact is what names the axis.
      readAxisFactIsTyped: woFacts.length === 1 && String(woFacts[0]?.decidedBy ?? '') === 'IO_READ_DENIED',
      refusalCarriesATypedReason: (pWriteOnly.codes.guardFact ?? pWriteOnly.codes.probeRow ?? pWriteOnly.codes.messagePrefix) !== null,
      refusedOnReadAxis: woFacts.length === 1 && String(woFacts[0]?.method ?? '') === 'spawn' && String(woFacts[0]?.decidedBy ?? '') === 'IO_READ_DENIED',
      zeroProcesses: pWriteOnly.confinedSpawnRows.length === 0,
      zeroBytes: !JSON.stringify(pWriteOnly.value ?? '').includes(SECRET_TOKEN_FACE),
      reachedTheConfinedFace: pWriteOnly.presetProbeRows.length === 0 && pWriteOnly.realmProbeRows.length === 1,
    }
    const woVerdict = Object.values(woChecks).every((v) => v === true) ? 'PASS' : 'FAIL'
    writeJsonSafe('item4-write-only-read-denied.json', {
      schema: `${SUITE}/write-only-read-denied/1`,
      at: new Date().toISOString(),
      caseId: 'write-only-read-denied',
      question: 'With a write lane but no read lane, does a read attempt refuse on the READ axis and return no bytes?',
      answer: woVerdict === 'PASS' ? 'YES on the confined subprocess face' : 'NOT PROVEN (see checks)',
      axis: 'read',
      fact: { name: 'IO_READ_DENIED', method: woFacts[0]?.method ?? null, decision: woFacts[0]?.decision ?? null, locator: woFacts[0]?.locator ?? null, decidedBy: woFacts[0]?.decidedBy ?? null },
      refusalReasonCodes: pWriteOnly.codes,
      refusalText: pWriteOnly.errorMessage,
      invocation: 'driver-initiated tool route call on the Member session (`bash_probe`), i.e. the same agent scope a model tool call executes in',
      probe: pWriteOnly,
      checks: woChecks,
      verdict: woVerdict,
      locus: { layer: 'a5sf admission (the shipped confined `subprocess` face guard), before any provider call', notTheOs: 'zero provider calls: the refusal happened before the OS was asked' },
      limits: { note: 'an admission refusal is a statement about our admission code, not about OS confinement', osLevelNetworkIsolationClaimed: false },
      osLevelNetworkIsolationClaimed: false,
    })
    add('write-only-read-denied', woVerdict, {
      fact: 'IO_READ_DENIED', axis: 'read',
      providerCalls: pWriteOnly.confinedSpawnRows.length,
      bytesReturned: JSON.stringify(pWriteOnly.value ?? '').includes(SECRET_TOKEN_FACE),
      failedChecks: Object.entries(woChecks).filter(([, v]) => v !== true).map(([k]) => k),
      artifact: 'item4-write-only-read-denied.json',
    })

    // 1b. SUPPLEMENTARY: the same body with the write-only root DECLARED as a
    // read -> admitted, and the OS profile refuses the read. This separates the
    // admission axis from the kernel and is NOT a case.
    const pKernel = await probe(workerSession, workerInstanceId, {
      label: 'kernel-read-supplementary',
      // RUN-01 DEFECT: this arm declared the WRITE-ONLY root as a read, so the
      // admission refused it (PATH_NOT_ALLOWED) and the kernel was never asked —
      // a LOCUS error. It now declares an IN-LANE read (admitted) and the body
      // reads the out-of-lane file, so the ONLY layer left to refuse is the OS
      // profile.
      body: `cat ${JSON.stringify(runPaths.secretKernel)}`,
      cwd: runPaths.laneInside,
      reads: [runPaths.laneInside],
    })
    const kernelChecks = {
      admitted: pKernel.ok === true,
      childRan: (pKernel.confinedSpawnRows.length + pKernel.realmProbeRows.filter((row) => row?.stage === 'completed').length) > 0,
      noSecretBytes: !JSON.stringify(pKernel.value ?? '').includes(SECRET_TOKEN_KERNEL),
      childReportedFailure: pKernel.value !== null && pKernel.value?.ok === true && Number(pKernel.value?.exitCode ?? 0) !== 0,
    }
    writeJsonSafe('item4b-kernel-read-supplementary.json', {
      schema: `${SUITE}/kernel-read-supplementary/1`,
      at: new Date().toISOString(),
      caseId: null,
      supplementary: true,
      notACase: true,
      why: 'not a case: it observes the OS profile AFTER an admitted call. It is tabled nowhere in the preflight bundle and adds no row to the run record; it exists to pin the LOCUS of the read refusal (admission vs kernel).',
      answer: Object.values(kernelChecks).every((v) => v === true)
        ? 'the admission admits a DECLARED read of the write-only root and the OS profile refuses the read (no bytes)'
        : 'see checks',
      probe: pKernel,
      checks: kernelChecks,
      locus: { layer: 'P1-07 Landlock OS profile (kernel), after admission' },
      osLevelNetworkIsolationClaimed: false,
    })
    log(`supplementary kernel read: ${JSON.stringify(kernelChecks)}`)

    // 2. Q4: the chmod gap
    const modeBefore = (statSync(runPaths.modeFile).mode & 0o777).toString(8)
    const pChmod = await probe(workerSession, workerInstanceId, {
      label: 'chmod-gap',
      body: `chmod 600 ${JSON.stringify(runPaths.modeFile)}; stat -c '%a' ${JSON.stringify(runPaths.modeFile)}`,
      cwd: runPaths.laneInside,
    })
    const modeAfter = (statSync(runPaths.modeFile).mode & 0o777).toString(8)
    const chmodChecks = {
      callCompleted: pChmod.ok === true,
      modeChanged: modeBefore !== modeAfter && modeAfter === '600',
      noChmodDeclaration: true,
      reachedTheConfinedFace: pChmod.presetProbeRows.length === 0 && pChmod.realmProbeRows.length === 1,
    }
    // PASS = the GAP IS REPRODUCED (the proposition). A refusal would be the
    // better product outcome and would REFUTE the disclosure.
    const chmodVerdict = Object.values(chmodChecks).every((v) => v === true) ? 'PASS' : 'FAIL'
    writeJsonSafe('item5-chmod-gap.json', {
      schema: `${SUITE}/chmod-gap/1`,
      at: new Date().toISOString(),
      caseId: 'chmod-gap',
      question: 'Is the disclosed `chmod` gap reproducible on this tree?',
      disclosure: 'Landlock has no chmod permission bit, so an UNDECLARED same-uid `chmod` is outside this admission\'s reach (ALPHA5-SANDBOX-BACKLOG BL-17 (3))',
      observed: { modeBefore, modeAfter, changed: modeBefore !== modeAfter },
      invocation: 'driver-initiated `bash_probe` on the Member session, with NO `chmod` declaration',
      probe: pChmod,
      checks: chmodChecks,
      verdict: chmodVerdict,
      verdictMeaning: chmodVerdict === 'PASS'
        ? 'GAP_REPRODUCED: the mode changed while neither the admission (nothing declared) nor the OS profile covered the chmod'
        : 'GAP_REFUTED on this tree: the mode did not change (a BETTER outcome than the disclosure predicted)',
      finding: chmodVerdict === 'PASS' ? 'CHMOD_GAP_REPRODUCED' : 'CHMOD_GAP_NOT_REPRODUCED',
      locus: { layer: 'neither admission nor kernel: the admission never saw it (no declaration) and the OS profile has no chmod right' },
      limits: { note: 'the read/write axis of the file is enforced; only the MODE change is outside the reach', osLevelNetworkIsolationClaimed: false },
      osLevelNetworkIsolationClaimed: false,
    })
    add('chmod-gap', chmodVerdict, {
      modeBefore, modeAfter,
      finding: chmodVerdict === 'PASS' ? 'CHMOD_GAP_REPRODUCED' : 'CHMOD_GAP_NOT_REPRODUCED',
      failedChecks: Object.entries(chmodChecks).filter(([, v]) => v !== true).map(([k]) => k),
      artifact: 'item5-chmod-gap.json',
    })

    // 3. Q5: the network-deny refusal position (the UNTABLED case)
    stage = 'delegate-netdeny'
    const nether = await delegate({
      label: 'ptydv-nether',
      templateId: 'nether',
      callId: 'ptydv-delegate-nether',
      prompt: `${MARKERS.netdeny}: reply with one short line. Call no tool.`,
    })
    stage = 'confined-probes'
    const pNet = await probe(String(nether.childSessionId), String(nether.instanceId), {
      label: 'network-deny',
      body: 'echo A5SF_NET_BODY_RAN',
      cwd: runPaths.laneInside,
      reads: [runPaths.laneInside],
    })
    const netFacts = pNet.facts
    const netChecks = {
      typedRefusal: pNet.typedCode === 'NETWORK_UNCONFINED_REALM',
      // RUN-03 DEFECT (judge, not product): this checked for exactly ONE guard
      // fact. The shipped face throws `ConfinedSubprocessRefusal` on the network
      // branch BEFORE it ever consults the guard (`team-services/src/subprocess.js`,
      // the `probeNetworkDenial` branch has no `await guard(...)`), so zero guard
      // facts is the CORRECT product shape here — and the absence is itself the
      // LOCUS finding. The refusal is proven by the typed code, the absence of a
      // process, and the absence of the body's output.
      refusedAtAdmission: pNet.typedCode === 'NETWORK_UNCONFINED_REALM' && pNet.confinedSpawnRows.length === 0,
      theGuardWasNeverConsulted: netFacts.length === 0,
      zeroProcesses: pNet.confinedSpawnRows.length === 0,
      bodyNeverRan: !JSON.stringify(pNet.value ?? '').includes('A5SF_NET_BODY_RAN'),
      reachedTheConfinedFace: pNet.presetProbeRows.length === 0 && pNet.realmProbeRows.length === 1,
      networkDenyLaneOnThisMember: (realmMemberRows().find((row) => String(row?.memberInstanceId ?? '') === String(nether.instanceId))?.networkAccess ?? null) === 'deny',
    }
    const netVerdict = Object.values(netChecks).every((v) => v === true) ? 'PASS' : 'FAIL'
    writeJsonSafe('item6-network-deny-refusal.json', {
      schema: `${SUITE}/network-deny-refusal/1`,
      at: new Date().toISOString(),
      caseId: 'network-deny-refusal',
      untabled: true,
      untabledReason: UNTABLED_CASES.includes('network-deny-refusal') ? 'the shared preflight schema grades a network refusal only through the admission-refusal class, which then requires a WEB caller declaration this Shell-PTY case does not have (see driver.untabledCases)' : null,
      question: 'Where does `network: deny` refuse on the confined shell face?',
      observed: { typedCode: pNet.typedCode, processes: pNet.confinedSpawnRows.length, bodyRan: JSON.stringify(pNet.value ?? '').includes('A5SF_NET_BODY_RAN') },
      member: { instanceId: String(nether.instanceId), childSessionId: String(nether.childSessionId), templateId: 'nether' },
      probe: pNet,
      checks: netChecks,
      verdict: netVerdict,
      locus: {
        layer: 'the shipped confined face (team-services subprocess adapter): `probeNetworkDenial(provider)` answers `network-destination: unsupported`, and the face throws `ConfinedSubprocessRefusal(NETWORK_UNCONFINED_REALM)` BEFORE any process exists',
        neverConsulted: 'the guard-consult sink: this branch throws directly, so it writes no `a5sf-guard-consult` fact. Recorded so a reader does not read "zero facts" as "no refusal".',
        refusedBeforeTheOs: 'the refusal is a statement about our own admission code; no child was forked, so the OS was never asked',
      },
      guardFactsObserved: netFacts.length,
      limitQuotedVerbatim: LIMIT_SENTENCE,
      limitSource: 'dev/agent-workflow/evidence/a5sf-subprocess-face/README.md §7',
      claimsConfinement: false,
      osLevelNetworkIsolationClaimed: false,
    })
    add('network-deny-refusal', netVerdict, {
      typedCode: pNet.typedCode,
      processes: pNet.confinedSpawnRows.length,
      bodyRan: netChecks.bodyNeverRan === false,
      failedChecks: Object.entries(netChecks).filter(([, v]) => v !== true).map(([k]) => k),
      artifact: 'item6-network-deny-refusal.json',
    })

    // ── the run-level artefacts ───────────────────────────────────────────
    stage = 'artefacts'
    const allCounter = counterRows()
    writeJson(join(OUT, 'guard-facts.json'), { sink: runPaths.sink, facts: factsRows(), locus: 'the shipped a5sf guard consult sink (fail-closed)', osLevelNetworkIsolationClaimed: false })
    writeJson(join(OUT, 'counter-rows.json'), {
      realmMembers: realmMemberRows(),
      confinedSpawnAttempts: allCounter.filter((row) => row?.leg === 'confined-spawn-attempt'),
      confinedSpawns: allCounter.filter((row) => row?.leg === 'confined-spawn'),
      baseSpawns: allCounter.filter((row) => row?.leg === 'base-spawn'),
      allRows: allCounter,
      note: 'test-composition instrumentation: every confined provider spawn attempt and every inherited-base `subprocess.spawn` call. A `bash` call that produced no confined-spawn-attempt did not come from the confined face.',
      osLevelNetworkIsolationClaimed: false,
    })
    writeJson(join(OUT, 'probe-ledgers.json'), {
      realmLedger: runPaths.realmProbeLedger,
      presetLedger: runPaths.presetProbeLedger,
      realmRows: realmProbeRows(),
      presetRows: presetProbeRows(),
      note: 'the LOCUS witness: a call served by the PRESET definition writes to presetLedger and no guard fact; a call served by the realm shadow writes to realmLedger',
      osLevelNetworkIsolationClaimed: false,
    })
    writeJson(join(OUT, 'lane-report.json'), readJson(runPaths.laneReport) ?? { missing: runPaths.laneReport })
    const routed = (world.mock?.requests ?? []).map((request, index) => ({
      seq: index + 1,
      tools: surfaceNamesOf(request),
      markers: Object.values(MARKERS).filter((marker) => hasMarker(request, marker)),
      routed: routingLog[index] ?? null,
    }))
    writeJson(join(OUT, 'marker-routing.json'), {
      decidedBy: 'the driver\'s own decide() log, aligned 1:1 with the mock request order',
      markers: MARKERS,
      requests: routed,
      titleTurnsNeverConsumedAScript: routingLog.filter((r) => r.effective === 'title').every((r) => r.replyKind === 'text'),
      osLevelNetworkIsolationClaimed: false,
    })
    writeJson(join(OUT, 'mock-requests.json'), { count: (world.mock?.requests ?? []).length, requests: world.mock?.requests ?? [], osLevelNetworkIsolationClaimed: false })

    stage = 'teardown'
    const port = bootInfo.port
    teardown = await world.teardown()
    const closed = !(await portOpen(port))
    const homeAfter = existsSync(world.home)
    writeJson(join(OUT, 'teardown.json'), {
      at: new Date().toISOString(),
      teardown,
      port,
      portClosedAfterTeardown: closed,
      homeRemoved: homeAfter === false,
      homePath: world.home,
      hostPid,
      osLevelNetworkIsolationClaimed: false,
    })
    log(`teardown: portClosed=${String(closed)} homeRemoved=${String(homeAfter === false)}`)
    if (!closed) throw new Error(`the host port ${port} is still open after teardown`)
    if (homeAfter) throw new Error(`the World home ${world.home} was not removed`)
  } catch (error) {
    record.markAborted({ stage, detail: null, error: String(error?.stack ?? error?.message ?? error) })
    log(`ABORT at ${stage}: ${String(error?.stack ?? error?.message ?? error)}`)
    if (world !== null) {
      try {
        const requests = world.mock?.requests ?? []
        writeJson(join(OUT, 'mock-requests.json'), { count: requests.length, requests, abortedAt: stage, osLevelNetworkIsolationClaimed: false })
        if (runPaths !== null) {
          writeJson(join(OUT, 'guard-facts.json'), { sink: runPaths.sink, facts: parseJsonl(runPaths.sink), abortedAt: stage, osLevelNetworkIsolationClaimed: false })
          writeJson(join(OUT, 'counter-rows.json'), { allRows: parseJsonl(runPaths.counter), abortedAt: stage, osLevelNetworkIsolationClaimed: false })
          writeJson(join(OUT, 'probe-ledgers.json'), {
            realmRows: parseJsonl(runPaths.realmProbeLedger),
            presetRows: parseJsonl(runPaths.presetProbeLedger),
            abortedAt: stage,
            osLevelNetworkIsolationClaimed: false,
          })
        }
      } catch (diagnosticError) {
        log(`abort diagnostics failed: ${String(diagnosticError?.message ?? diagnosticError)}`)
      }
    }
    if (world !== null && teardown === null) {
      try {
        teardown = await world.teardown()
        writeJson(join(OUT, 'teardown.json'), {
          at: new Date().toISOString(),
          teardown,
          abortedDuring: stage,
          port: bootInfo?.port ?? null,
          portClosedAfterTeardown: bootInfo?.port === undefined ? null : !(await portOpen(bootInfo.port)),
          homeRemoved: existsSync(world.home) === false,
          homePath: world.home,
          abortedDuringStage: stage,
          osLevelNetworkIsolationClaimed: false,
        })
      } catch (teardownError) {
        log(`teardown after abort failed: ${String(teardownError?.message ?? teardownError)}`)
      }
    }
  } finally {
    if (bootInfo !== null && teardown === null && world !== null) {
      try { teardown = await world.teardown() } catch { /* recorded above */ }
    }
    const finalized = record.finalize()
    let outcomeRow = null
    try {
      outcomeRow = lease.finish({
        overall: finalized.overall,
        cases: finalized.cases.map((c) => ({ id: c.id, verdict: c.verdict })),
        teardown,
      })
    } catch (finishError) {
      log(`dev-live outcome row failed: ${String(finishError?.message ?? finishError)}`)
    }
    const rows = parseJsonl(LEDGER_PATH)
    const intentRows = rows.filter((row) => row?.kind === 'budget-intent')
    const bootRows = rows.filter((row) => row?.kind === undefined)
    const outcomeRows = rows.filter((row) => row?.kind === 'dev-live-outcome')
    const aborts = bootRows.length === 0 ? 1 : 0
    writeJson(join(OUT, 'ledger.json'), {
      schema: `${SUITE}/ledger/1`,
      recordClass: 'DEV-LIVE',
      ledgerPath: 'run-ledger.jsonl',
      plannedStarts: 1,
      aborts,
      boots: bootRows.length,
      arithmetic: 'boots === plannedStarts - aborts',
      holds: bootRows.length === 1 - aborts,
      rows,
      intentRow: intentRows[0] ?? null,
      bootRow: bootRows[0] ?? null,
      outcomeRow: outcomeRows[0] ?? outcomeRows[outcomeRows.length - 1] ?? null,
      devLiveOutcomeRecorded: outcomeRows.length >= 1,
      note: 'one fresh dev-live lease: intent row + start row written before the spawn, outcome row written after teardown; no cumulative cap is claimed or consumed; at most 2 dev Hosts machine-wide (DEV_LIVE_SLOT_LIMIT)',
      osLevelNetworkIsolationClaimed: false,
    })
    record.record.osLevelNetworkIsolationClaimed = false
    record.write(RUN_RECORD_PATH)
    const copy = (name, from) => {
      try { copyFileSync(from, join(OUT, name)) } catch { /* absent */ }
    }
    copy('preflight-bundle.json', BUNDLE_PATH)
    copy('preflight.log', PREFLIGHT_LOG)
    copy('dev-live-grant.json', GRANT_PATH)
    for (const doc of ['a5sf-pty-realm-provider-row.mjs', 'a5sf-pty-bash-probe-tool.mjs', 'run-boot.mjs']) {
      copy(doc, join(HERE, doc))
    }
    log(formatSummary(finalized))
    log(`ledger: boots=${String(bootRows.length)} planned=1 aborts=${String(aborts)} outcome=${String(outcomeRows.length)}`)
    writeJson(join(OUT, 'verdict.json'), {
      schema: `${SUITE}/verdict/1`,
      at: new Date().toISOString(),
      recordClass: finalized.recordClass,
      candidateClaimEligibility: finalized.candidateClaimEligibility ?? null,
      overall: finalized.overall,
      abortedAt: finalized.abortedAt ?? null,
      partial: finalized.partial === true,
      cases: finalized.cases.map((c) => ({ id: c.id, verdict: c.verdict })),
      tabledCases: CASES,
      untabledCases: UNTABLED_CASES,
      devLiveOutcomeRecorded: outcomeRows.length >= 1,
      limit: LIMIT_SENTENCE,
      osLevelNetworkIsolationClaimed: false,
    })
    log(`OVERALL=${finalized.overall}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// entry
// ─────────────────────────────────────────────────────────────────────────────

const isMain = process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (isMain) {
  const idx = process.argv.indexOf('--evidence')
  const evidenceDir = idx === -1 ? null : process.argv[idx + 1]
  const run = PLAN_ONLY ? plan : (() => {
    if (evidenceDir === null) throw new Error('--evidence <dir> is required for a boot (one directory per start)')
    return boot({ evidenceDir })
  })
  Promise.resolve()
    .then(() => run())
    .then(() => {
      if (PLAN_ONLY) process.exit(0)
      const verdict = readJson(join(OUT, 'verdict.json'))
      process.exit(verdict?.overall === 'PASS' ? 0 : 1)
    })
    .catch((error) => {
      log(`FATAL: ${String(error?.stack ?? error?.message ?? error)}`)
      process.exit(2)
    })
}

export { LIMIT_SENTENCE, plan, boot, rowsFor, mainBlueprintYaml, BP_ANCHOR_YAML }
