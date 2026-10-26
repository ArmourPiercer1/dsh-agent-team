/**
 * plane-effect-backends.mjs — GLUE-7: the PRODUCTION backend assembly for the
 * governed Team TOOL PLANE. This file is GLUE, nothing else: every backend
 * here rides an execution implementation this repository already ships and
 * has already proven live. No new executor architecture exists in this file —
 * it is the wiring the int-a5b README correction named as the delivery gap
 * (the production mount row never passed `backends`, so every live
 * read/search/shell dispatch landed on the typed shut face).
 *
 * THE INVENTORY (each backend -> the existing implementation it rides):
 *
 *  - `createConfinedShellBackend` (shell class) — SINCE U6 PR3 THIS CODE
 *    LIVES IN THE PROCESS-FAMILY LANE:
 *    `packages/tools/process-family/src/confined-shell-executor.mjs` (owner
 *    role: that lane's README; CI-07 names the reviewed provider it drives).
 *    This file IMPORTS and re-exports it unchanged — the mechanics it rides
 *    are untouched: the confined Process provider
 *    (`createConfinedProcessProvider` + the P-LSP `spawnStreaming` ladder,
 *    `packages/runtime/sandbox-provider/provider.ts:661`), the Landlock
 *    pre-launcher (`launcher/landlock-prelauncher.py`), the launcher
 *    byte-pin DOUBLE gate (pb-CONTRACT §1 `ProviderAssemblyConfig`), and the
 *    frozen lease/terminate law. The argv array is explicit (never a shell
 *    string on the provider's own face), the network dimension makes NO
 *    claim (the lane refuses a `deny` profile — PoC-4b honesty).
 *
 *  - `createAnchoredSearchBackend` (search, read-only) has TWO bodies and
 *    picks by what the mount holds. With a confined provider it delegates to
 *    `./search-backend.mjs` — the PR5 fixed-ripgrep row (memo plan :33
 *    "grep/glob R3 + … 原生等价层", :132 "真实固定 rg 版行为回归"): the host's
 *    PUBLIC `@deepseek-ai/dsh-tool-fs-search` grep vocabulary run INSIDE the
 *    same confined provider face the glob row rides, on the anchored walk root.
 *    Without one it keeps the grep(1) port the W5 wiring round shipped and
 *    proved live (`dev/agent-workflow/evidence/alpha5/wiring/w5/a5w5-fixtures.mjs`
 *    `grepArgv` + `createRealSearchBackend`) — a mount with a controlled-fs
 *    instance and no sandbox must not lose its search row, and that port is the
 *    RED control the parity suite pins (R1–R5). Both bodies anchor the same way:
 *    the P-C controlled-fs INSTANCE root declared on the plane row
 *    (`packages/runtime/controlled-fs/src/admission-binding.ts:211`) under the
 *    lane's own containment law `isBeneath`
 *    (`packages/runtime/controlled-fs/src/open-at-exec.ts:53`).
 *
 *  - `createGovernedReadExecutor` (fs class, the placed governed `read`)
 *    rides the SAME controlled-fs instance root: real bytes, anchored reads,
 *    deny-lane re-check BEFORE any read (the G1 law), template-default-deny
 *    honored (an effect the policy never names never runs), escapes refused.
 *
 *  - GLOB has NO existing implementation in this repo. The row stays
 *    TYPED-SHUT (the plane passes the `shut` backend explicitly), honestly
 *    disclosed — inventing one here would be a new executor, which GLUE-7
 *    is forbidden to do.
 *
 * Fail-closed law (unchanged): a missing configuration never widens —
 * no `fsInstance` = no search/read row (the shut landing stays), no
 * `confinedProvider` = no shell row, an unavailable provider refuses typed,
 * `background: true` is refused BY NAME (never reinterpreted), and every
 * refusal is the closed `BackendFailure` triad (denied / hidden /
 * undetermined) — the plane pipeline renders them, this file never throws.
 *
 * @module packages/runtime/src/plugin/live/plane-effect-backends
 */

import { spawnSync } from 'node:child_process'
import { constants as fsConstants, existsSync, statSync } from 'node:fs'
import { open as fsOpen } from 'node:fs/promises'
import { relative } from 'node:path'
// U6 PR3: only the sleep TIMER remains a center need (the search leg at
// :480); clearSleepTimer moved with the shell mechanics to the
// process-family lane (shell-mechanics.mjs imports its own).
import { setTimeout as sleepTimer } from 'node:timers'
import { createConfinedProcessProvider } from '../../../sandbox-provider/index.js'
import { buildGlobCommand, GLOB_MAX_RESULTS, resolveRgPath } from '@deepseek-ai/dsh-tool-fs-search'
import { verifyOpenedHandle } from '../../../controlled-fs/src/index.js'
import { createAnchoredRgSearchBackend } from './search-backend.mjs'
// U6 PR2 (U6 slice plan, PR2 of 6): the governed `read` row's mechanics,
// window/presentation law, effect executor and row DEFINITION moved VERBATIM
// to the FS family lane (`packages/tools/fs-family/`, owner role: see that
// lane's README). This center file keeps the OLD export surface as a
// re-export so every pinned consumer — the shipped read suites, the adjacent
// .d.mts typings, team-tool-plane — resolves UNCHANGED; the family lane is
// now the single home of the read-slice logic. `resolveAnchored` is a LIVE
// internal here too (search/glob rows anchor through the same law — one
// home, no copy), which is why this is an import + named re-export rather
// than a bare `export ... from` edge.
import {
  createGovernedReadExecutor,
  lexicalAnchor,
  MAX_READ_BYTES,
  READ_ROW_CHUNK_BYTES,
  READ_ROW_LINE_CAP,
  READ_ROW_MAX_LINE_LENGTH,
  READ_ROW_MAX_OUTPUT_BYTES,
  resolveAnchored,
  resolveAnchoredPath,
} from '../../../../tools/fs-family/src/index.mjs'
export {
  createGovernedReadExecutor,
  lexicalAnchor,
  MAX_READ_BYTES,
  READ_ROW_CHUNK_BYTES,
  READ_ROW_LINE_CAP,
  READ_ROW_MAX_LINE_LENGTH,
  READ_ROW_MAX_OUTPUT_BYTES,
  resolveAnchored,
  resolveAnchoredPath,
}

/** The ONE argv builder (ported verbatim from the W5 wiring round). */
export function grepArgv(parsed, searchPath) {
  const argv = ['-rIn', '--binary-files=without-match']
  if (parsed.outputMode === 'files_with_matches') argv.splice(1, 1, '-rl')
  else if (parsed.outputMode === 'count') argv.splice(1, 1, '-rc')
  if (parsed.fixedString) argv.push('-F')
  else argv.push('-E')
  if (parsed.ignoreCase) argv.push('-i')
  if (parsed.globFilter !== undefined) argv.push(`--include=${parsed.globFilter}`)
  if (parsed.contextLines > 0 && parsed.outputMode === 'content') argv.push(`-C${String(parsed.contextLines)}`)
  argv.push('--', parsed.pattern, searchPath)
  return argv
}

/**
 * §4c AUDIT closure — the fd-view presentation rewrite is PATH-FIELD ONLY.
 * A line that IS the fd view (`-l` form: the whole line is the path field)
 * becomes the anchored spelling; a `fdView:`-prefixed line (any prefixed
 * form) swaps ONLY its prefix; everything else is BODY — presented
 * byte-for-byte as on disk, ALWAYS. A line the parser cannot attribute to a
 * path field that nevertheless carries the fd name keeps the fd name
 * VERBATIM and raises the honest audit observation — never a body rewrite
 * (the previous global split/join rewrote matched CONTENT bytes that
 * happened to contain the literal fd path: display-integrity face, now
 * closed with a RED-pinned leg, G1b).
 */
function remapFdViewLines(raw, fdView, anchorPath, audit) {
  if (raw.length === 0) return raw
  let bodyCarries = 0
  const out = raw.split('\n').map((l) => {
    if (l === fdView) return anchorPath
    if (l.startsWith(`${fdView}:`)) return anchorPath + l.slice(fdView.length)
    if (l.includes(fdView)) {
      bodyCarries += 1
      return l
    }
    return l
  }).join('\n')
  if (bodyCarries > 0) audit(`${String(bodyCarries)} unattributable line(s) keep the fd name verbatim (body bytes never rewritten)`)
  return out
}
function writeAll(sink, text) {
  if (sink === null || sink === undefined || text.length === 0) return
  const CHUNK = 64 * 1024
  for (let i = 0; i < text.length; i += CHUNK) sink.write(text.slice(i, i + CHUNK))
}

/**
 * The search row of the plane, anchored at the governed controlled-fs instance
 * root. TWO implementations, selected by what the mount actually has:
 *
 *  - `confined` present → the row DELEGATES to `search-backend.mjs`, the
 *    confined fixed-ripgrep row (PR5 "原生等价层", memo plan :33/:132): the
 *    host's PUBLIC `buildGrepCommand`/`parseGrepArgs`/`parseGrepMatches` over
 *    the same confined provider face the glob row rides, so the plane's answer
 *    is what a default-law `rg` answers (ignore / hidden / VCS law, binary law,
 *    `--json` framing) instead of grep(1) folklore. FOUR knobs are refused BY NAME
 *    there, never reinterpreted: `multiline` and `contextLines` (rg does answer
 *    `-C n` with a distinct `context` record — measured, probes N9 — but the lane's
 *    `SearchMatchLine` has no arm for that distinction, and forwarding them as
 *    matches would relabel a neighbour line as a hit), and `fixedString` /
 *    `ignoreCase`, which the lane's own grep argument law carries (its
 *    `src/args.ts:148-149`) and which this port honours below, but which the
 *    host's PUBLIC grep vocabulary (`buildGrepCommand`: pattern / path / include)
 *    cannot express. `(?i)` and literal-escaping encodings exist — that is
 *    precisely why they are refused rather than quietly adopted: they are a mapping
 *    this row does not own. THE MOUNT-FLIP OWNER MUST CARRY THIS: flipping to the
 *    rg row narrows those two knobs from "honoured" to "refused by name"; leg `V6b`
 *    pins the delta from both sides, and the honest widening is the host growing an
 *    arm in its own vocabulary, not this row guessing one.
 *  - `confined` absent (a mount with a controlled-fs instance but NO confined
 *    provider — leg G8/G9 shape) → the grep(1) port below, UNCHANGED. It is
 *    kept deliberately, not by accident: without a confined provider there is
 *    no sandbox to run rg in, and a member with a search grant must not lose
 *    the row. It is the RED control the parity suite pins leg by leg
 *    (`alpha5-search-backend.test.ts` R1–R5: no ignore/hidden/VCS law, context
 *    lines arriving as matches, newline-named files splitting in two), and the
 *    retirement note says so out loud.
 *
 * `execCount` counts bodies that actually ran; every pre-execute refusal
 * (anchor, capability gate, refusal-by-name) never counts.
 */
export function createAnchoredSearchBackend({ realmId, rootDir, observe = () => {}, confined = null, templateId = 'plane', instanceId = 'member', timeoutMs, maxJsonBytes }) {
  if (confined !== null && confined !== undefined) {
    const rgRow = createAnchoredRgSearchBackend({
      realmId,
      rootDir,
      confined,
      templateId,
      instanceId,
      observe,
      ...(typeof timeoutMs === 'number' ? { timeoutMs } : {}),
      ...(typeof maxJsonBytes === 'number' ? { maxJsonBytes } : {}),
    })
    return rgRow
  }
  let executed = 0
  let trace = []
  const lastOutcomes = []
  return {
    backendId: 'a5g7-controlled-fs-anchored-grep',
    get lastStageTrace() { return trace },
    execCount: () => executed,
    lastOutcomes,
    async run(call, io) {
      const parsed = call.parsedArgs
      if (parsed.tool !== 'grep') {
        return { ok: false, failure: { class: 'denied', code: 'wrong-tool-for-backend', detail: 'the search backend got a non-grep call' } }
      }
      if (parsed.multiline) {
        return { ok: false, failure: { class: 'denied', code: 'multiline-unsupported', detail: 'the anchored search rides grep(1); multiline is not implemented (refused by name, never reinterpreted)' } }
      }
      trace = ['probe']
      const anchor = resolveAnchored(rootDir, parsed.target)
      if (!anchor.ok) {
        trace = ['probe', 'terminate']
        observe(`anchored-search refused ${String(anchor.code)} call=${call.callId} realm=${realmId}`)
        return { ok: false, failure: { class: 'denied', code: anchor.code, detail: anchor.detail } }
      }
      trace = ['probe', 'prepare', 'execute']
      // TOCTOU fix (independent security review ①(c) leg C2: a string target
      // handed to the child let an external rename->symlink swap leak at
      // 1/400 — the spawned grep re-resolves the STRING at its own open).
      // FILE targets now ride a VERIFIED FD: the lane's safe-open law
      // (O_NOFOLLOW) + exec-time `verifyOpenedHandle`, and the child sees
      // ONLY the inherited descriptor (`/proc/self/fd/N`) — never the path
      // string. DIRECTORY targets keep the string: `grep -r` neither
      // descends a command-line symlinked dir nor follows in-tree symlinks
      // (asymmetric follow law, measured 0 leaks in 400 swap iterations by
      // the independent review) and a recursive walk cannot ride one fd;
      // that residual is DISCLOSED, not exempted (README §4).
      const argv = grepArgv(parsed, anchor.path)
      let dataHandle = null
      let fdView = null
      try {
        if (statSync(anchor.path).isFile()) {
          try {
            dataHandle = await fsOpen(anchor.path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW)
          } catch (error) {
            const code = String(error?.code ?? '')
            trace = [...trace, 'terminate']
            if (code === 'ELOOP') return { ok: false, failure: { class: 'denied', code: 'symlink-alias', detail: 'the OS refused the open (ELOOP): symlink alias' } }
            if (code === 'ENOENT') return { ok: false, failure: { class: 'denied', code: 'not-a-file', detail: 'the target does not exist at open time' } }
            return { ok: false, failure: { class: 'undetermined', code: 'grep-open-failed', detail: code.slice(0, 80) } }
          }
          let st = null
          try { st = statSync(anchor.path) } catch { st = null }
          const snapshot = st === null ? null : { dev: Number(st.dev), ino: Number(st.ino), size: st.size, mtimeMs: st.mtimeMs }
          const recheck = await verifyOpenedHandle(dataHandle, anchor.rootReal, snapshot)
          if (recheck.verdict !== 'confirmed') {
            await dataHandle.close().catch(() => undefined)
            dataHandle = null
            trace = [...trace, 'terminate']
            const detail = recheck.verdict === 'escape'
              ? `exec-time re-read: the fd resolved to ${recheck.resolvedPath} — OUTSIDE the governed anchor`
              : recheck.verdict === 'drift'
                ? `snapshot ${String(recheck.snapshot.dev)}:${String(recheck.snapshot.ino)} != opened ${String(recheck.actual.dev)}:${String(recheck.actual.ino)}`
                : recheck.detail
            observe(`anchored-search exec-refused:${recheck.verdict} call=${call.callId}`)
            return { ok: false, failure: { class: recheck.verdict === 'escape' ? 'denied' : 'undetermined', code: `exec-time-${recheck.verdict}`, detail: String(detail).slice(0, 200) } }
          }
          // spawnSync's stdio puts the inherited fd at CHILD index 3 —
          // the parent's own fd number is meaningless in the child.
          fdView = '/proc/self/fd/3'
          for (let i = argv.length - 1; i >= 0; i--) if (argv[i] === anchor.path) argv[i] = fdView
        }
      } catch { /* stat race on the target: grep's own open answers (exit 2 = typed) */ }
      const res = spawnSync('grep', argv, {
        cwd: anchor.rootReal,
        encoding: 'utf8',
        timeout: 60_000,
        maxBuffer: 32 * 1024 * 1024,
        ...(dataHandle === null ? {} : { stdio: ['ignore', 'pipe', 'pipe', dataHandle.fd] }),
      })
      if (dataHandle !== null) await dataHandle.close().catch(() => undefined)
      if (res.error !== undefined) {
        trace = [...trace, 'terminate']
        return { ok: false, failure: { class: 'undetermined', code: 'grep-failed', detail: String(res.error.message).slice(0, 200) } }
      }
      if (res.status !== 0 && res.status !== 1) {
        trace = [...trace, 'terminate']
        return { ok: false, failure: { class: 'undetermined', code: `grep-exit-${String(res.status)}`, detail: String(res.stderr ?? '').slice(0, 200) } }
      }
      executed += 1
      const rawStdout = res.stdout ?? ''
      const rawOut = fdView === null ? rawStdout : remapFdViewLines(rawStdout, fdView, anchor.path, (msg) => {
        observe(`anchored-search presentation-audit call=${call.callId} ${msg}`)
      })
      const lines = rawOut.length === 0 ? [] : rawOut.split('\n').filter((l) => l !== '')
      let outcome
      if (parsed.outputMode === 'files_with_matches') {
        const files = lines.slice(0, parsed.maxResults)
        outcome = { outputMode: 'files_with_matches', matches: [], counts: [], files, totalMatches: lines.length, truncated: lines.length > files.length }
      } else if (parsed.outputMode === 'count') {
        const counts = lines.map((l) => { const i = l.lastIndexOf(':'); return { path: l.slice(0, i), count: Number(l.slice(i + 1)) } }).slice(0, parsed.maxResults)
        outcome = { outputMode: 'count', matches: [], counts, files: [], totalMatches: counts.reduce((s, c) => s + c.count, 0), truncated: lines.length > counts.length }
      } else {
        const all = lines.map((l) => {
          const m = /^(.*?):(\d+):([\s\S]*)$/.exec(l)
          return m === null ? { path: l, text: '' } : { path: m[1], line: Number(m[2]), text: m[3] }
        })
        const matches = all.slice(0, parsed.maxResults)
        outcome = { outputMode: 'content', matches, counts: [], files: [], totalMatches: all.length, truncated: all.length > matches.length }
      }
      writeAll(io.sink, rawOut) // the FULL raw payload — spill == backend bytes except the PATH-FIELD-only fd-view remap above
      trace = [...trace, 'terminate']
      lastOutcomes.push({ callId: call.callId, argv: argv.join(' '), mode: parsed.outputMode, totalMatches: outcome.totalMatches })
      return { ok: true, outcome, settlement: { kind: 'completed' } }
    },
  }
}

/**
 * THE glob row (GLUE-7 scope probe -> PR5 commitment): the REAL ripgrep
 * `--files` walk, run INSIDE the confined sandbox on the same provider face
 * the shell row proved live (kernel-enforced read scope: the rg process
 * cannot read outside its allowPaths no matter what the pattern names).
 * The argv/limit vocabulary is the host PUBLIC PACKAGE ROOT's own
 * (`@deepseek-ai/dsh-tool-fs-search`: `buildGlobCommand` bakes
 * `--files --glob=P --sort=modified --no-ignore --hidden` + the
 * GLOB_VCS_EXCLUDES negations, search root behind `--`) — the plan's R3
 * route names these helpers verbatim (memo plan :128; scope probe
 * evidence/alpha5/glue7/glob/README.md, ruling: within the original
 * authorization, no new decision needed). The PRESENTATION is the LANE's
 * own SearchOutcome (`files_with_matches`) so the reviewed renderer and
 * spill law stay single-owned (the host's formatGlobOutput is bound to the
 * host's own spill/sampling caps surface — double-formatting would fork
 * the render law; disclosed). Anchoring is the SAME `resolveAnchored` law
 * the read/grep rows carry (lex + realpath + isBeneath: a symlink whose
 * FINAL target escapes the governed root is refused BEFORE any spawn), and
 * the bounded-output cap is `GLOB_MAX_RESULTS` — an over-cap walk reports
 * `truncated` honestly, it is never silently cut.
 */
export function createAnchoredGlobBackend({ realmId, rootDir, templateId = 'plane', instanceId = 'member', confined, observe = () => {}, timeoutMs = 60_000 }) {
  const provider = createConfinedProcessProvider({
    realmId,
    trustRoot: confined.trustRoot ?? null,
    // the provider materialises its scratch INSIDE the sandbox-visible cwd —
    // a scratch rooted AT the governed root leaks the sandbox's own layout
    // into every walk result (live-measured, probe-cwd). Default it OUTSIDE
    // the governed root; a configured scratchRoot still rules. (The shell
    // row's same default is disclosed to review, not silently changed here.)
    scratchRoot: confined.scratchRoot ?? `${rootDir}.a5g7-glob-scratch`,
    ...(confined.runnerCommand === undefined ? {} : { runnerCommand: confined.runnerCommand }),
    assembly: confined.assembly ?? {},
  })
  let probed = null
  let rgPath = null
  let executed = 0
  let trace = []
  const lastRuns = []
  return {
    backendId: 'a5g7-confined-rg-glob',
    get lastStageTrace() { return trace },
    execCount: () => executed,
    lastRuns,
    async run(call, io) {
      const parsed = call.parsedArgs
      if (parsed.tool !== 'glob') {
        return { ok: false, failure: { class: 'denied', code: 'wrong-tool-for-backend', detail: 'the glob backend got a non-glob call' } }
      }
      const anchor = resolveAnchored(rootDir, parsed.target)
      if (!anchor.ok) {
        trace = ['anchor-refused']
        observe(`anchored-glob refused ${String(anchor.code)} call=${call.callId} realm=${realmId}`)
        return { ok: false, failure: { class: 'denied', code: anchor.code, detail: anchor.detail } }
      }
      const walkRel = anchor.path === anchor.rootReal ? '.' : relative(anchor.rootReal, anchor.path)
      if (rgPath === null) {
        try { rgPath = await resolveRgPath() } catch (e) {
          trace = ['probe', 'terminate']
          return { ok: false, failure: { class: 'failed', code: 'rg-unavailable', detail: String((e && e.message) ?? e).slice(0, 200) } }
        }
      }
      trace = ['probe']
      if (probed === null) {
        probed = await provider.probe()
        if (probed.ok !== true) {
          trace = ['probe', 'terminate']
          observe(`anchored-glob capability REFUSED realm=${realmId} code=${probed.error?.code}`)
          return { ok: false, failure: { class: 'denied', code: `confined-unavailable:${String(probed.error?.code ?? 'probe-refused')}`, detail: String(probed.error?.message ?? 'probe refused') } }
        }
        observe(`anchored-glob capability OK realm=${realmId} rows=${probed.value.length} rg=${rgPath}`)
      }
      trace = ['probe', 'prepare', 'execute']
      // TOCTOU (the review's ①(c) law APPLIED BEFORE THE WALK SHIPS, reusing
      // the SAME handle-verification law, no new architecture): the anchor
      // DIRECTORY is opened O_DIRECTORY|O_NOFOLLOW and exec-time verified
      // (`verifyOpenedHandle`). The provider's cwd then rides the VERIFIED
      // fd's `/proc/self/fd/N` magic link — libuv opens the cwd string in
      // the PARENT at spawn, and the magic link lands on the verified INODE:
      // a later external rename->symlink swap of the path (which rg FOLLOWS
      // for command-line dirs — measured, unlike grep -r) cannot steer the
      // walk. The walk root is always `.`; the presentation keeps the
      // root-relative spelling. No path string reaches rg's argv.
      let dirHandle
      try {
        dirHandle = await fsOpen(anchor.path, fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW)
      } catch (error) {
        const code = String(error?.code ?? '')
        trace = [...trace, 'terminate']
        if (code === 'ELOOP') return { ok: false, failure: { class: 'denied', code: 'symlink-alias', detail: 'the walk root was swapped to a symlink at open time (ELOOP)' } }
        if (code === 'ENOENT') return { ok: false, failure: { class: 'denied', code: 'not-a-directory', detail: 'the walk root does not exist at open time' } }
        if (code === 'ENOTDIR') return { ok: false, failure: { class: 'denied', code: 'not-a-directory', detail: 'a path component is not a directory' } }
        return { ok: false, failure: { class: 'undetermined', code: 'glob-open-failed', detail: code.slice(0, 80) } }
      }
      try {
        const dst = statSync(anchor.path)
        const dsnap = { dev: Number(dst.dev), ino: Number(dst.ino), size: dst.size, mtimeMs: dst.mtimeMs }
        const drecheck = await verifyOpenedHandle(dirHandle, anchor.rootReal, dsnap)
        if (drecheck.verdict !== 'confirmed') {
          trace = [...trace, 'terminate']
          const detail = drecheck.verdict === 'escape'
            ? `exec-time re-read: the walk-root fd resolved to ${drecheck.resolvedPath} — OUTSIDE the governed anchor`
            : drecheck.verdict === 'drift'
              ? `snapshot ${String(drecheck.snapshot.dev)}:${String(drecheck.snapshot.ino)} != opened ${String(drecheck.actual.dev)}:${String(drecheck.actual.ino)}`
              : drecheck.detail
          observe(`anchored-glob exec-refused:${drecheck.verdict} call=${call.callId}`)
          return { ok: false, failure: { class: drecheck.verdict === 'escape' ? 'denied' : 'undetermined', code: `exec-time-${drecheck.verdict}`, detail: String(detail).slice(0, 200) } }
        }
      } catch (e) {
        await dirHandle.close().catch(() => undefined)
        trace = [...trace, 'terminate']
        return { ok: false, failure: { class: 'undetermined', code: 'glob-open-failed', detail: String((e && e.message) ?? e).slice(0, 120) } }
      }
      const rgBinDir = rgPath.slice(0, rgPath.lastIndexOf('/'))
      const request = {
        grantFingerprint: `glue7:${realmId}:${templateId}:${call.callId}`,
        realmId,
        bindingId: `glue7-plane:${templateId}`,
        memberScope: instanceId,
        argv: [rgPath, ...buildGlobCommand({ pattern: parsed.pattern })],
        // The provider/launcher chain opens the cwd by STRING (parent fds
        // do not cross the launcher — measured), so the string stays. The
        // ①(c) closure is TWO-LAYER, both pre-existing laws, no new
        // machinery: (1) the verified pre-open above (O_DIRECTORY|
        // O_NOFOLLOW + exec-time re-read) refuses a swap that landed
        // before the spawn — deterministic, zero-walk; (2) whatever slips
        // the microsecond window between re-read and the launcher's chdir
        // lands the child on the swap target, and the walk runs under
        // Landlock with allowPaths = the governed root ONLY: an outside
        // swap target gets the KERNEL refusal (read_dir not granted) and
        // rg discloses zero bytes — the confinement backstop, same law
        // the shell row ships. An inside-root redirect cannot escape the
        // boundary (every realm path is readable anyway); its integrity
        // residual is disclosed in the glue7 README §4, never exempted.
        cwd: anchor.path,
        env: [['PATH', '/usr/bin:/bin']],
        allowPaths: [
          SYSTEM_RX('/bin'), SYSTEM_RX('/usr'), SYSTEM_RX('/lib'),
          ...(existsSync('/lib64') ? [SYSTEM_RX('/lib64')] : []),
          SYSTEM_RX(rgBinDir),
          { path: anchor.rootReal, accessBits: { readFile: true, readDir: true } },
        ],
      }
      // The walk root is ALWAYS `.`: it arrives already bound to the
      // verified inode via the cwd magic link — NO path string reaches rg
      // (rg follows command-line symlinked dirs, measured: unlike grep -r,
      // so an argv string would keep the ①(c) window open). Subtree walks
      // are presented root-relative below.
      let handle
      try {
        handle = await provider.spawnStreaming(request)
      } finally {
        // the verification fd has served its law — retire it (the walk's
        // OWN protection is the Landlock rule set, not this fd)
        await dirHandle.close().catch(() => undefined)
      }
      if (handle.ok !== true) {
        trace = ['probe', 'prepare', 'terminate']
        observe(`anchored-glob spawn REFUSED realm=${realmId} call=${call.callId} code=${handle.error?.code}`)
        return { ok: false, failure: { class: 'denied', code: `confined-refused:${String(handle.error?.code ?? 'spawn-refused')}`, detail: String(handle.error?.message ?? 'spawn refused') } }
      }
      executed += 1
      const h = handle.value
      let stdout = ''
      let stderr = ''
      h.stdout.on('data', (c) => { const str = String(c); stdout += str; if (io.sink) io.sink.write(str) })
      h.stderr.on('data', (c) => { stderr += String(c) })
      const exit = await Promise.race([
        h.exited,
        new Promise((r) => sleepTimer(() => r({ timedOut: true }), timeoutMs)),
      ])
      await h.terminate() // the lease settles through the frozen arm (once per path)
      if (exit.timedOut === true) {
        trace = [...trace, 'terminate']
        return {
          ok: true,
          outcome: { outputMode: 'files_with_matches', matches: [], counts: [], files: [], totalMatches: 0, truncated: false },
          settlement: { kind: 'cancelled', event: 'dispatcher-call-terminated-after-body-start' },
        }
      }
      const code = typeof exit.code === 'number' ? exit.code : null
      trace = [...trace, 'terminate']
      if (code !== 0 && code !== 1) {
        // rg exit>=2 is a REAL walker error (invalid pattern syntax,
        // unreadable root): it lands as a typed failure — never a silently
        // empty list.
        observe(`anchored-glob ERROR realm=${realmId} call=${call.callId} exit=${String(code)}`)
        return { ok: false, failure: { class: 'failed', code: `rg-exit-${String(code)}`, detail: (stderr.trim() || 'ripgrep reported an error').slice(0, 400) } }
      }
      if (code === 0 && stderr.trim().length > 0) {
        // Live-measured (glue7/glob/probe-rg-exit + probe-cwd): the streaming
        // arm does not always surface the payload's exit code on this host
        // (rg's hard-error exit 2 read back as 0). A HARD walker error never
        // writes files and always speaks on stderr — so the walker's own
        // words, not the code, carry the typed failure. A quiet success has
        // an empty stderr (verified on the success legs).
        observe(`anchored-glob walker-error realm=${realmId} call=${call.callId} (exit read as ${String(code)}; stderr carried it)`)
        return { ok: false, failure: { class: 'failed', code: 'rg-walker-error', detail: stderr.trim().slice(0, 400) } }
      }
      // presentation: root-relative spelling (the anchor algebra), the
      // subtree prefix restored after the `.`-rooted walk
      const walkPrefix = walkRel === '.' ? '' : `${walkRel}/`
      const all = stdout.split('\n').filter((l) => l.trim().length > 0).map((l) => walkPrefix + (l.startsWith('./') ? l.slice(2) : l))
      const files = all.slice(0, GLOB_MAX_RESULTS)
      lastRuns.push({ callId: call.callId, pid: h.pid, exit: code, total: all.length })
      observe(`anchored-glob ran realm=${realmId} call=${call.callId} pid=${String(h.pid)} files=${String(all.length)} capped=${String(all.length > GLOB_MAX_RESULTS)}`)
      return {
        ok: true,
        outcome: {
          outputMode: 'files_with_matches',
          matches: [],
          counts: [],
          files,
          totalMatches: all.length,
          truncated: all.length > files.length,
        },
        settlement: { kind: 'completed' },
      }
    },
  }
}

// ── U6 PR3: the shell-class mechanics + the confined shell EXECUTOR moved
// VERBATIM to the process family lane (`packages/tools/process-family/`,
// owner role: see that lane's README). This center file keeps the OLD export
// surface as a re-export so every pinned consumer — a5b2-exit-code-fidelity,
// a5b3-cancel-leg, alpha5-glue7-plane-backends, team-tool-plane — resolves
// UNCHANGED (the PR2 fs-family precedent); the family lane is now the single
// home of the shell-slice logic. SYSTEM_RX stays lane-internal (it never had
// a center export to keep).
import {
  raceShellSettle,
  shellCancelled,
  SHELL_STREAM_DRAIN_MS,
  drainShellStdio,
  createConfinedShellBackend,
  // SYSTEM_RX is a LIVE internal of this file too (the glob row's provider
  // grants boot paths through the same entry builder — one home, no copy;
  // PR2's `resolveAnchored` precedent).
  SYSTEM_RX,
} from '../../../../tools/process-family/src/index.mjs'
export {
  raceShellSettle,
  shellCancelled,
  SHELL_STREAM_DRAIN_MS,
  drainShellStdio,
  createConfinedShellBackend,
}

/**
 * B-ACT-1-PR C2 — the governed jobs-management bridge (the effect body
 * behind the plane's fixed `job_output`/`job_list`/`job_kill` takeover
 * row). Adapter-first by construction: the effect face is the host
 * `JobRegistry` PUBLIC service (`ctx.get('jobs')` @639ed01539, every
 * management op caller-scopable); nothing is forked.
 *
 * THE FENCE ORDER IS THE LAW (pc-CONTRACT §1 jobs row, PR7):
 *  1. the gateway row (`checkManagementAccess`, member-scope owner fence over
 *     the durable attribution ledger) answers FIRST; a team-layer refusal
 *     NEVER reaches the host layer (the two fences answer only for
 *     themselves — the measured non-reach is pinned in
 *     test/a5p7-jobs-assembly-actuator.test.ts);
 *  2. an un-attributed jobId passes CORDed:false — the host's caller fence
 *     (`exec.agent?.id`, the dispatch-provided caller the host tool itself
 *     passes) stays authoritative and the bridge never invents ownership;
 *  3. `kill` answers the host's two native forms — 'requested' marks the
 *     REQUEST on the gateway (noteKillRequested), 'already-finished' settles
 *     nothing new. Cancel requested ≠ terminated (PR1 Gate R4).
 *
 * The gateway definition store is fed LAZILY at first use from the live
 * placement feed (the def#N identities mint only after the seam's install
 * pass — the pb §6 laziness law), and every refusal answers in the plane's
 * closed { text } envelope. A caller the dispatch did not name
 * (`exec.agent?.id` absent) is refused — an absent caller would query the
 * host UNFILTERED and this bridge never un-fences.
 */
export function createGovernedJobsBridge({ scopeKey, viewer, gatewayRow, planeRow, jobsService, observe = () => {}, waitDefaultMs = 30_000, waitCapMs = 600_000 }) {
  // scopeKey = the BRIDGE-SPECIFIC opaque definition key, produced ONLY by
  // the lane's single derivation helper (jobsBridgeScopeKey, re-exported by
  // the live assembly row this bridge is handed): the member dimension rides
  // the key, the root dimension rides the per-root live assembly - two
  // member bridges can no longer share a definition row.
  if (typeof scopeKey !== 'string' || scopeKey === '') throw new Error('jobs bridge: scopeKey is required')
  if (viewer === undefined || typeof viewer.rootSessionId !== 'string' || typeof viewer.instanceId !== 'string') {
    throw new Error('jobs bridge: viewer must carry the durable member pair {rootSessionId, instanceId}')
  }
  // ROOT③ (review, round B): name -> LAST REGISTERED identity. A one-way
  // Set pinned the FIRST feed identity forever, so a REPLACED lane (a
  // definition swap / remount that mints a new def identity) left a stale
  // pin behind for every later admit. The row-local store is last-write-
  // wins, so the honest shape is: register whenever the feed identity
  // MOVED (the laziness law stands: an identity that has not minted is
  // still never registered as undefined).
  const registered = new Map()
  const refuse = (code, detail) => {
    observe(`a5jobs: refused ${code}`)
    return { text: `refused: ${code} — ${String(detail).slice(0, 200)}` }
  }
  // ROOT residual order (round E): the WHOLE feed disappearing (planeRow null
  // or the placementFeed field gone) is the SAME revocation law as one entry
  // going missing - it invalidates EVERY name this scope had registered
  // (same store + local-pin machinery, no new gateway semantics, no API
  // growth). A silent early return used to KEEP the stale identities alive,
  // so admission after a teardown answered on pins of a plane that no longer
  // exists; fail-closed until the feed returns is the honest shape.
  const invalidateAll = (asm) => {
    for (const name of registered.keys()) {
      if (typeof asm.definitions.unregister === 'function') {
        asm.definitions.unregister(scopeKey, name)
        observe(`a5jobs: definition-invalidated name=${name} scope=${scopeKey}`)
      }
    }
    registered.clear()
  }
  const ensureDefinitions = (asm) => {
    const plane = typeof planeRow === 'function' ? planeRow() : null
    if (plane === null || plane === undefined || typeof plane.placementFeed !== 'function') {
      invalidateAll(asm)
      return
    }
    for (const name of ['bash', 'job_output', 'job_list', 'job_kill']) {
      const entry = plane.placementFeed(name)
      // Not minted yet: retry on the next call — never register an
      // undefined identity (the closed world has no guessed pins).
      // ROOT checklist (1): a WITHDRAWN or unreadable definition that this
      // scope had ALREADY registered invalidates that exact member scope's
      // row (store + local pin) - a stale pin never masquerades as a closed
      // revocation; the next admit fail-closes at 'never-registered'.
      if (entry === undefined || entry === null || entry.definitionIdentity === undefined) {
        if (registered.delete(name) && typeof asm.definitions.unregister === 'function') {
          asm.definitions.unregister(scopeKey, name)
          observe(`a5jobs: definition-invalidated name=${name} scope=${scopeKey}`)
        }
        continue
      }
      const identity = String(entry.definitionIdentity)
      if (registered.get(name) === identity) continue
      const moved = registered.has(name)
      asm.definitions.register(scopeKey, name, identity)
      registered.set(name, identity)
      observe(`a5jobs: ${moved ? 'definition-re-registered' : 'definition-registered'} name=${name} scope=${scopeKey}`)
    }
  }
  const resolve = () => {
    const asm = typeof gatewayRow === 'function' ? gatewayRow() : null
    if (asm === null || asm === undefined) {
      return { refusal: refuse('gateway-not-active', 'the Team jobs gateway live row is not mounted for this root') }
    }
    let svc
    try {
      svc = typeof jobsService === 'function' ? jobsService() : undefined
    } catch (error) {
      return { refusal: refuse('jobs-service-unavailable', error?.message ?? error) }
    }
    if (svc === undefined || svc === null) {
      return { refusal: refuse('jobs-service-unavailable', 'the host jobs registry service is absent from the global store') }
    }
    ensureDefinitions(asm)
    return { asm, svc }
  }
  const checked = (jobId, r) => {
    const gate = r.asm.checkManagementAccess({ jobId, viewer })
    return gate.ok === true ? null : refuse(gate.code, gate.detail)
  }
  return {
    bridgeId: 'a5-jobs-bridge',
    /** Attribution-producer hook: feed the gateway definition store from
     *  the live placement feed BEFORE any `attributeBackgroundJob` admit,
     *  so a receipt born before the first management call still finds its
     *  creating-lane pin (the laziness law holds: an identity that has not
     *  minted is never registered as undefined). */
    ensureRegistered: () => {
      const asm = typeof gatewayRow === 'function' ? gatewayRow() : null
      if (asm !== null && asm !== undefined) ensureDefinitions(asm)
    },
    /** job_output: gate -> (wait, ROOT④b abort-aware) -> svc.read(caller);
     *  the delta composition mirrors the host readBody (chunks in offset
     *  order, the lossy notice, the once-only result tail) in the plane's
     *  text envelope. ROOT④b (root ruling option a — minimal forwarding, no
     *  recorded divergence, zero core): the dispatch's `exec?.signal`
     *  cancels the WAIT on the host's OWN public surface
     *  (`wait(id, timeoutMs, caller?, signal?)` @639ed01539). Three ordered
     *  arms, each MEASURED: a pre-aborted signal never touches svc.wait; a
     *  mid-wait abort is caught by the local race leg (the service also
     *  honours the forwarded signal — belt AND braces); an abort landing as
     *  wait settles — or one the service swallows — is caught by the
     *  re-check BEFORE any read. The typed `wait-aborted` return carries a
     *  BOUNDED slice of the abort reason's message/string form (the plane
     *  envelope's 200-char cap applies) - stated at that honest strength,
     *  NOT as full-reason-object identity fidelity (root wording ruling).
     *  The host read is never reached on an abort (call count zero, zero
     *  output leak). Un-aborted calls are untouched in BOTH arms:
     *  timed-out-then-read and killed-then-readable keep their positive
     *  controls, and the no-wait read path is unchanged. */
    async jobOutput(args, caller, signal) {
      if (typeof args?.job_id !== 'string' || args.job_id === '') return refuse('job-id-required', 'job_id is required')
      if (typeof caller !== 'string' || caller === '') return refuse('caller-unresolved', 'dispatch did not name the calling agent; the bridge never queries unfiltered')
      const r = resolve()
      if (r.refusal !== undefined) return r.refusal
      const denied = checked(args.job_id, r)
      if (denied !== null) return denied
      const abortReason = () => {
        const raw = signal?.reason
        if (typeof raw === 'string' && raw !== '') return raw
        if (raw?.message !== undefined && raw.message !== '') return String(raw.message)
        return signal?.aborted === true ? 'aborted' : 'not-aborted'
      }
      const abortReturn = () => refuse('wait-aborted', `the call was cancelled: ${abortReason()}`)
      // ROOT-close(2) (root, round-B addendum): the SAME cancellation contract
      // governs the NO-wait arm too - a pre-cancelled call never reaches
      // svc.read. The entry check is arm-independent; in the no-wait path
      // there is no await between entry and read, so it doubles as the
      // pre-read re-check the structural allowance permits.
      if (signal?.aborted === true) return abortReturn()
      try {
        if (args.wait === true) {
          if (signal?.aborted === true) return abortReturn() // a dead signal never touches the service
          const ms = typeof args.timeout_ms === 'number' ? args.timeout_ms : waitDefaultMs
          if (signal !== null && signal !== undefined && typeof signal.addEventListener === 'function') {
            let onAbort
            try {
              // ROOT-close(1) (root, round-B addendum) NO-LOST-EVENT shape:
              // the abort listener goes in BEFORE svc.wait is even called,
              // and a re-check runs AFTER the call - so an abort that fires
              // SYNCHRONOUSLY during the service call (and a service that
              // returns a never-settling promise) can neither outrun the
              // listener nor hang the race. The service ALSO honours the
              // forwarded signal (public surface) - belt AND braces.
              const abortPromise = new Promise((_resolve, reject) => {
                onAbort = () => reject(new Error('wait aborted'))
                signal.addEventListener('abort', onAbort, { once: true })
              })
              // ROOT-close(3) (root 10:0xZ risk order): a REJECTED promise
              // that no path consumes is a process-level unhandledRejection.
              // Every early return below (sync abort during the service
              // call, the catch arm) can leave abortPromise/waitPromise
              // rejected-but-unconsumed, so BOTH are pre-consumed with a
              // no-op handler AT CONSTRUCTION - race keeps its own
              // subscription and still sees the rejection. The listener is
              // removed on EVERY exit: the finally covers the early
              // returns, and the pre-construction returns own no listener.
              abortPromise.catch(() => {})
              const waitPromise = r.svc.wait(args.job_id, Math.min(ms, waitCapMs), caller, signal)
              waitPromise.catch(() => {}) // same law for the service promise on the early-return paths
              if (signal.aborted === true) return abortReturn() // fired DURING the service call: listener armed first, the re-check catches it
              await Promise.race([waitPromise, abortPromise])
            } catch (error) {
              if (signal.aborted === true) return abortReturn() // the abort owns the outcome, whatever the wait rejected with
              throw error
            } finally {
              if (typeof onAbort === 'function') signal.removeEventListener('abort', onAbort)
            }
          } else {
            await r.svc.wait(args.job_id, Math.min(ms, waitCapMs), caller, signal)
          }
          if (signal?.aborted === true) return abortReturn() // race/re-check BEFORE any read: an abort as wait settles still never reads
        }
        const read = await r.svc.read(args.job_id, caller)
        // ROOT final contract, ALIGNED TO THE PINNED HOST (tool-jobs
        // render.ts:75-84 + index.ts:330-335): `log` chunks are OBSERVER-ONLY
        // producer narration and NEVER reach the model; stdout (+ unlabelled)
        // in order, then every stderr chunk in ONE [stderr] section; a lossy
        // read or a model-visible gapBefore ends the delta with the
        // dropped-output notice naming the spill - SCOPED: the host carries
        // absolute spill paths, this governed face presents the file name
        // only (a Team member must not read the host's world layout); then
        // the ONE-TIME result tail (the service hands it out on the first
        // post-settlement read only); then the status line LAST - the host's
        // statusLine(publicJob(job)) semantics (detail = progress ?? detail).
        // With the status line, a timed-out wait on a RUNNING job and a
        // finished job with no new bytes are DISTINGUISHABLE - the collapse
        // the root BLOCK named (and native wait settlement suppresses a
        // follow-up completion notice, so this is substance, not cosmetics).
        const visible = (read.chunks ?? []).filter((c) => c?.channel !== 'log')
        const out = visible.filter((c) => c?.channel !== 'stderr').map((c) => String(c?.text ?? '')).join('')
        const err = visible.filter((c) => c?.channel === 'stderr').map((c) => String(c?.text ?? '')).join('')
        const errSep = out.length > 0 && !out.endsWith('\n') ? '\n' : ''
        let delta = out + (err.length > 0 ? `${errSep}[stderr]\n${err}` : '')
        if (read.lossy === true || visible.some((c) => c?.gapBefore === true)) {
          const spill = (read.job?.output?.spillPaths ?? []).map((p) => String(p).split(/[\\/]/).pop() ?? String(p))
          const notice = `[some output was dropped from memory; full output: ${spill.length > 0 ? `job spill file(s): ${spill.join(', ')}` : '(unavailable)'}]`
          delta = `${delta}${delta.length > 0 && !delta.endsWith('\n') ? '\n' : ''}${notice}`
        }
        const joined = read.result === undefined
          ? delta
          : `${delta}${delta.length > 0 && !delta.endsWith('\n') ? '\n' : ''}${read.result}`
        const body = joined.length > 0 ? joined : '(no new output)'
        const job = read.job
        // A read whose service carries no job view (a thinner face than the
        // host JobRead contract) keeps the OLD body verbatim - the status
        // line is added exactly when the read offers a host-shaped job view.
        const statusLine = job === undefined || job === null || typeof job.status !== 'string'
          ? ''
          : `\n[status: ${job.status}${(() => { const d = job.progress ?? job.detail; return d === undefined || d === null ? '' : `, ${String(d)}` })()}]`
        return { text: `${body}${statusLine}` }
      } catch (error) {
        return refuse('host-jobs-refused', error?.message ?? error)
      }
    },
    /** job_list: ROOT① (review, round B) — the host caller fence scopes the
     *  rows to the DISPATCH caller, but the caller is dispatch-provided: a
     *  routing shape that ever presents the SAME caller to two governed
     *  members must NOT let the Team layer surface rows ALREADY attributed
     *  to a foreign member scope. So the list consults the gateway PER ROW:
     *  attributed rows follow the same owner fence job_output/job_kill
     *  answer to (a foreign row is HIDDEN — the layer that knows, declines
     *  silently and echoes no identity, C-GW law); rows with no team record
     *  pass as the disclosed corded:false host jurisdiction — the fence
     *  still invents nothing. */
    async jobList(caller) {
      if (typeof caller !== 'string' || caller === '') return refuse('caller-unresolved', 'dispatch did not name the calling agent; the bridge never queries unfiltered')
      const r = resolve()
      if (r.refusal !== undefined) return r.refusal
      try {
        const jobs = await r.svc.list(caller)
        const visible = jobs.filter((j) => r.asm.checkManagementAccess({ jobId: j.id, viewer }).ok === true)
        return { text: visible.length === 0 ? '(no background jobs)' : visible.map((j) => `${j.id} [${j.kind}] ${j.status} — ${j.label}`).join('\n') }
      } catch (error) {
        return refuse('host-jobs-refused', error?.message ?? error)
      }
    },
    /** The mount's computed definition scope (helper output, read-only): the
     *  future creation producer consumes THIS - it never recomputes the tuple. */
    get scopeKey() {
      return scopeKey
    },
    /** job_kill: gate -> svc.kill(caller, reason); 'requested' marks the
     *  gateway REQUEST (never a settlement), the two forms never collapse. */
    async jobKill(args, caller) {
      if (typeof args?.job_id !== 'string' || args.job_id === '') return refuse('job-id-required', 'job_id is required')
      if (typeof caller !== 'string' || caller === '') return refuse('caller-unresolved', 'dispatch did not name the calling agent; the bridge never queries unfiltered')
      const r = resolve()
      if (r.refusal !== undefined) return r.refusal
      const denied = checked(args.job_id, r)
      if (denied !== null) return denied
      try {
        const outcome = await r.svc.kill(args.job_id, caller, typeof args.reason === 'string' ? args.reason : undefined)
        if (outcome === 'requested') {
          r.asm.noteKillRequested(args.job_id)
          return { text: `requested cancellation of job ${args.job_id}` }
        }
        return { text: `job ${args.job_id} had already finished` }
      } catch (error) {
        return refuse('host-jobs-refused', error?.message ?? error)
      }
    },
  }
}
