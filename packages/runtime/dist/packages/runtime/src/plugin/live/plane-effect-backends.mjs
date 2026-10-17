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
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { setTimeout as sleepTimer } from 'node:timers'
import { createConfinedProcessProvider } from '../../../sandbox-provider/index.js'
import { isBeneath } from '../../../controlled-fs/src/index.js'

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
      const argv = grepArgv(parsed, anchor.path)
      const res = spawnSync('grep', argv, { cwd: anchor.rootReal, encoding: 'utf8', timeout: 60_000, maxBuffer: 32 * 1024 * 1024 })
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
      const lines = rawStdout.length === 0 ? [] : rawStdout.split('\n').filter((l) => l !== '')
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
      writeAll(io.sink, rawStdout) // the FULL raw payload — spill bytes == backend bytes
      trace = [...trace, 'terminate']
      lastOutcomes.push({ callId: call.callId, argv: argv.join(' '), mode: parsed.outputMode, totalMatches: outcome.totalMatches })
      return { ok: true, outcome, settlement: { kind: 'completed' } }
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
      const request = {
        grantFingerprint: `glue7:${realmId}:${templateId}:${call.callId}`,
        realmId,
        bindingId: `glue7-plane:${templateId}`,
        memberScope: instanceId,
        argv: ['/bin/sh', '-c', parsed.command],
        cwd,
        env: [['PATH', '/usr/bin:/bin']],
        allowPaths: confined.allowPaths ?? [
          SYSTEM_RX('/bin'), SYSTEM_RX('/usr'), SYSTEM_RX('/lib'),
          ...(existsSync('/lib64') ? [SYSTEM_RX('/lib64')] : []),
          { path: cwd, accessBits: { readFile: true, readDir: true, writeFile: true, makeReg: true, truncate: true, removeFile: true } },
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
    const rawPath = record.path
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
    let stat
    try {
      stat = statSync(parsed.path)
    } catch {
      return 'refused-io target-unreadable — the anchored target could not be stat-ed'
    }
    if (!stat.isFile()) return 'refused-io not-a-file — the governed read is a file effect, never a directory walk'
    if (stat.size > MAX_READ_BYTES) return `refused-io read-too-large — ${String(stat.size)} bytes exceeds the ${String(MAX_READ_BYTES)} governed read bound (no silent truncation)`
    executed += 1
    try {
      const text = readFileSync(parsed.path, 'utf8')
      observe(`governed-read RAN bytes=${String(stat.size)} path=${parsed.path}`)
      return text
    } catch (error) {
      return `refused-io read-failed — ${String(error?.message ?? error).slice(0, 200)}`
    }
  }
  executor.execCount = () => executed
  return executor
}
