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
 *  - `createConfinedShellBackend` (shell class) rides the confined Process
 *    provider — `createConfinedProcessProvider` + the P-LSP `spawnStreaming`
 *    ladder (`packages/runtime/sandbox-provider/provider.ts:661`), the
 *    Landlock pre-launcher (`launcher/landlock-prelauncher.py`), the launcher
 *    byte-pin DOUBLE gate (pb-CONTRACT §1 `ProviderAssemblyConfig`), and the
 *    frozen lease/terminate law. The argv array is explicit (never a shell
 *    string on the provider's own face), the network dimension makes NO
 *    claim (the lane refuses a `deny` profile — PoC-4b honesty).
 *
 *  - `createAnchoredSearchBackend` (grep, read-only) rides the REAL grep
 *    search the W5 wiring round shipped and proved live — argv construction,
 *    outcome shaping and the spill-bytes law ported verbatim from
 *    `dev/agent-workflow/evidence/alpha5/wiring/w5/a5w5-fixtures.mjs`
 *    (`grepArgv` + `createRealSearchBackend`). The governed anchor is the
 *    P-C controlled-fs INSTANCE root declared on the plane row
 *    (`packages/runtime/controlled-fs/src/admission-binding.ts:211`), with
 *    the lane's own containment law `isBeneath`
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
import { constants as fsConstants, existsSync, realpathSync, statSync } from 'node:fs'
import { open as fsOpen } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { setTimeout as sleepTimer } from 'node:timers'
import { createConfinedProcessProvider } from '../../../sandbox-provider/index.js'
import { buildGlobCommand, GLOB_MAX_RESULTS, resolveRgPath } from '@deepseek-ai/dsh-tool-fs-search'
import { isBeneath, verifyOpenedHandle } from '../../../controlled-fs/src/index.js'

/** Bounded single-file read (no silent truncation: over-bound refuses). */
export const MAX_READ_BYTES = 1024 * 1024

/**
 * Anchor a parsed target (`{placement, locator}`) at the governed root and
 * prove containment TWICE: lexically before touching the fs, and again
 * through `realpathSync` (the symlink-alias class the C-FS lane refuses at
 * exec time). `isBeneath` is the controlled-fs lane's own law — one
 * containment algebra for the whole plane.
 */
export function resolveAnchored(rootDir, locatorTarget) {
  let rootReal
  try {
    rootReal = realpathSync(rootDir)
  } catch {
    return { ok: false, code: 'root-unavailable', detail: `the governed root does not resolve: ${rootDir}` }
  }
  const lex = locatorTarget.placement === 'absolute-path'
    ? resolve(locatorTarget.locator)
    : resolve(rootReal, locatorTarget.locator)
  if (!isBeneath(rootReal, lex)) {
    return { ok: false, code: 'target-outside-governed-root', detail: `target lexically escapes the governed root (${locatorTarget.placement}: ${locatorTarget.locator})` }
  }
  if (!existsSync(lex)) return { ok: false, code: 'target-unresolvable', detail: `target does not exist inside the governed root (${locatorTarget.locator})` }
  let real
  try {
    real = realpathSync(lex)
  } catch {
    return { ok: false, code: 'target-unresolvable', detail: `target realpath failed (${locatorTarget.locator})` }
  }
  if (!isBeneath(rootReal, real)) {
    return { ok: false, code: 'symlink-alias', detail: 'target resolves outside the governed root through a symlink — refused, never followed' }
  }
  return { ok: true, path: real, rootReal }
}

/** Anchor a raw relative/absolute path string (the governed read row). */
export function resolveAnchoredPath(rootDir, rawPath) {
  if (typeof rawPath !== 'string' || rawPath.trim().length === 0) {
    return { ok: false, code: 'locator-rejected', detail: 'the read path must be a non-empty string' }
  }
  if (rawPath.includes('://')) return { ok: false, code: 'locator-rejected', detail: 'a filesystem locator never wears a URI scheme' }
  if (rawPath.startsWith('\\')) return { ok: false, code: 'locator-rejected', detail: 'UNC/leading-` targets are refused' }
  return resolveAnchored(rootDir, rawPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(rawPath)
    ? { placement: 'absolute-path', locator: rawPath }
    : { placement: 'workspace', locator: rawPath })
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
 * The grep backend over the REAL read-only search implementation, anchored at
 * the governed controlled-fs instance root. `multiline` is refused BY NAME
 * (the implementation greps with grep(1)) — honest refusal, never a silent
 * reinterpretation. `execCount` counts bodies that actually ran; every
 * pre-execute refusal (anchor, capability gate) never counts.
 */
export function createAnchoredSearchBackend({ realmId, rootDir, observe = () => {} }) {
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

/** System path entries the confined shell needs to boot `/bin/sh` (rx only). */
const SYSTEM_RX = (path) => ({ path, accessBits: { execute: true, readFile: true, readDir: true } })

/**
 * The shell backend over the CONFINED Process provider (P-B assembly face +
 * P-LSP streaming arm). The provider owns every law: probe capture, launcher
 * byte-pin double gate, one-shot plan, lease states, terminate escalation.
 * This adapter only shapes the a5p5 call into a `SpawnRequest` and the
 * streaming handle back into a `ShellOutcome` (streaming raw bytes into the
 * pipeline's spill sink while the lease is ACTIVE, per the spill law).
 */
export function createConfinedShellBackend({ realmId, templateId, instanceId, cwdRoot, confined, observe = () => {} }) {
  const scratchRoot = confined.scratchRoot ?? cwdRoot ?? confined.workingDir
  const provider = createConfinedProcessProvider({
    realmId,
    trustRoot: confined.trustRoot ?? null,
    scratchRoot,
    ...(confined.runnerCommand === undefined ? {} : { runnerCommand: confined.runnerCommand }),
    assembly: confined.assembly ?? {},
  })
  let probed = null
  let executed = 0
  let trace = []
  const lastRuns = []
  return {
    backendId: 'a5g7-confined-exec-shell',
    get lastStageTrace() { return trace },
    execCount: () => executed,
    lastRuns,
    async run(call, io) {
      const parsed = call.parsedArgs
      if (parsed.tool !== 'bash') {
        return { ok: false, failure: { class: 'denied', code: 'wrong-tool-for-backend', detail: 'the shell backend got a non-bash call' } }
      }
      // Refusals with ZERO side effects, before probe/spawn of any kind:
      if (parsed.background === true) {
        return { ok: false, failure: { class: 'denied', code: 'background-not-supported', detail: 'background spawn is not implemented by the confined-exec row (refused by name, never reinterpreted as a foreground run)' } }
      }
      const base = cwdRoot ?? confined.workingDir
      if (base === undefined) {
        return { ok: false, failure: { class: 'denied', code: 'cwd-unavailable', detail: 'no governed cwd root is configured (the assembly never invents one)' } }
      }
      let cwd = base
      if (parsed.cwd !== undefined) {
        const anchored = resolveAnchored(base, parsed.cwd)
        if (!anchored.ok) {
          return { ok: false, failure: { class: 'denied', code: anchored.code, detail: `cwd: ${anchored.detail}` } }
        }
        cwd = anchored.path
      } else {
        const anchored = resolveAnchored(base, { placement: 'workspace', locator: '.' })
        if (!anchored.ok) return { ok: false, failure: { class: 'denied', code: anchored.code, detail: anchored.detail } }
        cwd = anchored.path
      }
      trace = ['probe']
      if (probed === null) {
        probed = await provider.probe()
        if (probed.ok !== true) {
          trace = ['probe', 'terminate']
          observe(`confined-shell capability REFUSED realm=${realmId} code=${probed.error?.code}`)
          return { ok: false, failure: { class: 'denied', code: `confined-unavailable:${String(probed.error?.code ?? 'probe-refused')}`, detail: String(probed.error?.message ?? 'probe refused').slice(0, 240) } }
        }
        observe(`confined-shell capability OK realm=${realmId} rows=${probed.value.length}`)
      }
      trace = ['probe', 'prepare', 'execute']
      // runtime-base-narrow DYNAMIC GRANT: the per-call anchored workspace
      // root enters the plan EXPLICITLY — the provider base no longer shadows
      // it with a '/' READ_DIR (bug fix, glue7 §4b name-class leak). Default
      // face: the SAME entry bits this row has always carried for its anchor
      // (read/rw inside, nothing outside). Assembly-declared `allowPaths`
      // face: a READ_DIR grant on the anchored root only — strict parity
      // with what the removed '/' READ_DIR incidentally provided there
      // (that rule never granted READ_FILE), zero new write lanes.
      const anchorGrant = confined.allowPaths === undefined
        ? { path: cwd, accessBits: { readFile: true, readDir: true, writeFile: true, makeReg: true, truncate: true, removeFile: true } }
        : { path: cwd, accessBits: { readDir: true } }
      const request = {
        grantFingerprint: `glue7:${realmId}:${templateId}:${call.callId}`,
        realmId,
        bindingId: `glue7-plane:${templateId}`,
        memberScope: instanceId,
        argv: ['/bin/sh', '-c', parsed.command],
        cwd,
        env: [['PATH', '/usr/bin:/bin']],
        allowPaths: [
          ...(confined.allowPaths ?? [
            SYSTEM_RX('/bin'), SYSTEM_RX('/usr'), SYSTEM_RX('/lib'),
            ...(existsSync('/lib64') ? [SYSTEM_RX('/lib64')] : []),
          ]),
          anchorGrant,
        ],
      }
      const handle = await provider.spawnStreaming(request)
      if (handle.ok !== true) {
        trace = ['probe', 'prepare', 'terminate']
        observe(`confined-shell spawn REFUSED realm=${realmId} call=${call.callId} code=${handle.error?.code}`)
        return { ok: false, failure: { class: 'denied', code: `confined-refused:${String(handle.error?.code ?? 'spawn-refused')}`, detail: String(handle.error?.message ?? 'spawn refused').slice(0, 240) } }
      }
      executed += 1
      const h = handle.value
      let stdout = ''
      let stderr = ''
      let timedOut = false
      h.stdout.on('data', (c) => { const s = String(c); stdout += s; if (io.sink) io.sink.write(s) })
      h.stderr.on('data', (c) => { const s = String(c); stderr += s; if (io.sink) io.sink.write(s) })
      const timeoutMs = typeof parsed.timeoutMs === 'number' && parsed.timeoutMs > 0 ? parsed.timeoutMs : 60_000
      const exit = await Promise.race([
        h.exited,
        new Promise((r) => sleepTimer(() => r({ timedOut: true }), timeoutMs)),
      ])
      if (exit.timedOut === true) {
        timedOut = true
        await h.terminate()
      } else {
        await h.terminate() // normal end: the lease settles through the SAME frozen arm (terminated state)
      }
      trace = ['probe', 'prepare', 'execute', 'terminate']
      lastRuns.push({ callId: call.callId, pid: h.pid, exit: exit.code ?? null, timedOut, stdoutBytes: stdout.length, stderrBytes: stderr.length })
      observe(`confined-shell ran realm=${realmId} call=${call.callId} pid=${String(h.pid)} exit=${String(exit.code ?? 'not-observed')} timedOut=${String(timedOut)}`)
      return {
        ok: true,
        outcome: {
          exitCode: timedOut ? null : (typeof exit.code === 'number' ? exit.code : null),
          stdout,
          stderr,
          timedOut,
          cancelled: false,
          truncated: false,
        },
        settlement: timedOut
          ? { kind: 'cancelled', event: 'dispatcher-call-terminated-after-body-start' }
          : { kind: 'completed' },
      }
    },
  }
}

/**
 * THE fs-class row: the governed `read` body + its lane gate, anchored at
 * the SAME controlled-fs instance root. `decide` is the plane lane (deny
 * fast path); the default-deny gate re-checks ALLOW coverage at the effect's
 * own granularity — under `deny` an effect the policy never names never
 * touches the fs (no lane-widening anywhere in this file).
 */
export function createGovernedReadExecutor({ realmId, rootDir, policy, decide, subtreeContains, observe = () => {} }) {
  let executed = 0
  const ruleCovers = (rules, locator) => rules.some((rule) => {
    if (rule?.tool !== 'read') return false
    const kind = rule?.resource?.kind
    if (kind === 'any') return true
    if (kind === 'exact') return typeof rule.resource.path === 'string' && rule.resource.path === locator
    if (kind === 'subtree') {
      if (typeof rule?.resource?.path !== 'string') return false
      if (typeof subtreeContains === 'function') {
        return subtreeContains({ realmId, parent: rule.resource.path, child: locator }) === true
      }
      return false // without the containment seam, a subtree rule proves nothing: refuse
    }
    return false
  })
  const executor = async (raw) => {
    const record = (raw !== null && typeof raw === 'object') ? raw : {}
    // file_path = the canonical spelling the frozen operation-permission
    // layer resolves for `read`; `path` stays accepted for placement-direct
    // callers (unit legs).
    const rawPath = record.file_path ?? record.path
    const parsed = resolveAnchoredPath(rootDir, typeof rawPath === 'string' ? rawPath.trim() : rawPath)
    if (!parsed.ok) {
      return `refused-schema ${String(parsed.code)} — ${parsed.detail}`
    }
    const effects = [
      { kind: 'tool-invoke', toolName: 'read', resource: null },
      { kind: 'read', resource: { realmId, kind: 'file', canonicalLocator: parsed.path, rights: ['read'] } },
    ]
    const verdict = decide({ effects })
    if (verdict.kind === 'deny') return `refused-admission ${String(verdict.code)} — the template lane denies this read effect`
    if (policy?.default === 'deny' && !ruleCovers([...(policy?.allow ?? []), ...(policy?.ask ?? [])], parsed.path)) {
      observe(`governed-read default-deny refusal call path=${parsed.path}`)
      return 'refused-admission template-default-deny — the policy defaults to DENY and no rule covers this read effect'
    }
    // TOCTOU fix (independent security review ①(c) leg C1: an external
    // rename->symlink swap in the realpath->read window leaked at iteration
    // 23/20000). The check-time path string no longer carries the open: the
    // lane's OWN safe-open law runs (O_NOFOLLOW) and the ACTUAL fd is
    // re-read at exec time by `verifyOpenedHandle` (open-at-exec.ts:
    // /proc/self/fd containment + fstat-vs-snapshot drift). A swap that
    // landed after resolveAnchored returned is caught here as
    // exec-time-escape / drift — BEFORE any byte is read, zero disclosed.
    // Bytes come from the verified handle, never from the path string.
    let stat
    try {
      stat = statSync(parsed.path)
    } catch {
      return 'refused-io target-unreadable — the anchored target could not be stat-ed'
    }
    if (!stat.isFile()) return 'refused-io not-a-file — the governed read is a file effect, never a directory walk'
    let handle
    try {
      handle = await fsOpen(parsed.path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW)
    } catch (error) {
      const code = String(error?.code ?? '')
      if (code === 'ELOOP') return 'refused-io symlink-alias — the OS refused the open (ELOOP): symlink alias'
      if (code === 'ENOENT') return 'refused-io target-unreadable — the object does not exist at open time'
      if (code === 'EISDIR') return 'refused-io not-a-file — the governed read is a file effect, never a directory walk'
      return `refused-io open-failed — ${code.slice(0, 80)}`
    }
    const snapshot = { dev: Number(stat.dev), ino: Number(stat.ino), size: stat.size, mtimeMs: stat.mtimeMs }
    const recheck = await verifyOpenedHandle(handle, parsed.rootReal, snapshot)
    if (recheck.verdict !== 'confirmed') {
      await handle.close().catch(() => undefined)
      const detail = recheck.verdict === 'escape'
        ? `exec-time re-read: the fd resolved to ${recheck.resolvedPath} — OUTSIDE the governed anchor`
        : recheck.verdict === 'drift'
          ? `snapshot ${String(recheck.snapshot.dev)}:${String(recheck.snapshot.ino)} != opened ${String(recheck.actual.dev)}:${String(recheck.actual.ino)}`
          : recheck.detail
      observe(`governed-read exec-refused:${recheck.verdict} path=${parsed.path}`)
      return `refused-io exec-time-${recheck.verdict} — ${String(detail).slice(0, 200)}; zero bytes disclosed`
    }
    if (recheck.identity.size > MAX_READ_BYTES) {
      await handle.close().catch(() => undefined)
      return `refused-io read-too-large — ${String(recheck.identity.size)} bytes exceeds the ${String(MAX_READ_BYTES)} governed read bound (refused, never truncated)`
    }
    executed += 1
    try {
      const text = await handle.readFile({ encoding: 'utf8' })
      await handle.close().catch(() => undefined)
      observe(`governed-read RAN bytes=${String(recheck.identity.size)} path=${parsed.path}`)
      return text
    } catch (error) {
      await handle.close().catch(() => undefined)
      return `refused-io read-failed — ${String(error?.message ?? error).slice(0, 200)}`
    }
  }
  executor.execCount = () => executed
  return executor
}
