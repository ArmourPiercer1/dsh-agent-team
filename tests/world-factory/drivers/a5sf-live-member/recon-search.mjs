/**
 * recon-search.mjs — the SEARCH / SUBPROCESS reconnaissance arm of the
 * `a5sf-live-member` driver (Alpha.5 five-surface DEV-LIVE round, face B).
 *
 * WHY IT IS A MODULE, NOT A SECOND ENTRY POINT. The real Member turn driver is
 * `run-boot.mjs`; this file adds only what the Search question needs and is
 * imported by that driver when `--recon-search` is passed. There is no second
 * boot driver, no second composition and no product change.
 *
 * THE QUESTION IT ANSWERS, WITH PROCESS EVIDENCE:
 *   the governed Member's model-visible `grep` / `glob` are pinned-host tools
 *   (`@deepseek-ai/dsh-tool-fs-search`) that execute the packaged `rg` through
 *   `ctx.subprocess.spawn()`. Is that spawn the Member's CONFINED subprocess
 *   face (the one the realm compiles and the PD-12 `bash` shadow consumes), or
 *   the inherited, unconfined host service?
 *
 * The arms are therefore split into two classes and never mixed:
 *   - BEHAVIOUR: in-lane hit, out-of-lane read, parent read, ignore/hidden/VCS
 *     rules, exit 0/1/2 semantics, timeout;
 *   - PROCESS: the real `rg` child's argv / ppid / namespaces, the absence of
 *     the confined launcher, and the resource that would prove a read ruleset
 *     (an out-of-lane byte that came back).
 *
 * WHAT IS FIXTURE (disclosed): the scripted model decisions, the fixture tree,
 * the `/proc` watcher, and the `tool-fs-search` `timeoutMs` override on the
 * preset row this arm copies (the shipped row sets only
 * `sampleOverCapGlobResults`; the override exists so the timeout arm can abort
 * inside seconds instead of two minutes). Everything that EXECUTES the call is
 * the shipped path.
 *
 * @module tests/world-factory/drivers/a5sf-live-member/recon-search
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, readlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** The arm is enabled by the driver's own flag (never by an env default). */
export function reconMode() {
  return process.argv.includes('--recon-search')
}

/** Whether the ToolBinding arm is requested (second boot; see README). */
export function reconBindingMode() {
  return process.argv.includes('--recon-binding')
}

export const RECON = Object.freeze({
  token: 'a5sf-rs-turn',
  done: 'A5SF_RS_MEMBER_DONE',
  inLane: 'A5SF_RS_INLANE_NEEDLE',
  ignored: 'A5SF_RS_IGNORED_NEEDLE',
  hidden: 'A5SF_RS_HIDDEN_NEEDLE',
  outLane: 'A5SF_RS_OUTLANE_NEEDLE',
  absent: 'A5SF_RS_ABSENT_NEEDLE_9f13',
  inLaneFile: 'in-lane.txt',
  nestedFile: 'nested.txt',
  ignoredFile: 'ignored.txt',
  hiddenFile: 'hidden.txt',
  secretFile: 'secret-out-of-lane.txt',
  timeoutMs: 1500,
})

/** The ten scripted calls, in one fixed order, one tool call per turn. */
export function reconScript({ workspaceDir, outOfLaneDir }) {
  return [
    { id: 'call-rs-01-grep-inlane', name: 'grep', label: 'grep-inlane-hit', args: { pattern: RECON.inLane, path: workspaceDir } },
    { id: 'call-rs-02-grep-outlane', name: 'grep', label: 'grep-out-of-lane', args: { pattern: RECON.outLane, path: outOfLaneDir } },
    { id: 'call-rs-03-grep-ignore', name: 'grep', label: 'grep-gitignore', args: { pattern: RECON.ignored, path: workspaceDir } },
    { id: 'call-rs-04-grep-hidden', name: 'grep', label: 'grep-hidden-vcs', args: { pattern: RECON.hidden, path: workspaceDir } },
    { id: 'call-rs-05-grep-nomatch', name: 'grep', label: 'grep-no-match', args: { pattern: RECON.absent, path: workspaceDir } },
    { id: 'call-rs-06-grep-badregex', name: 'grep', label: 'grep-invalid-regex', args: { pattern: '[', path: workspaceDir } },
    { id: 'call-rs-07-glob-workspace', name: 'glob', label: 'glob-workspace', args: { pattern: '**/*.txt', path: workspaceDir } },
    { id: 'call-rs-08-glob-outlane', name: 'glob', label: 'glob-out-of-lane', args: { pattern: '*', path: outOfLaneDir } },
    { id: 'call-rs-09-grep-parent', name: 'grep', label: 'grep-parent-dir', args: { pattern: RECON.outLane, path: '..' } },
    { id: 'call-rs-10-grep-slow', name: 'grep', label: 'grep-timeout', args: { pattern: RECON.absent, path: '/usr' } },
  ]
}

/**
 * The fixture tree. The `.gitignore` / hidden / `.git` entries exist so the
 * ignore classes are MEASURED rather than assumed; the out-of-lane secret is
 * one directory ABOVE the compiled read ceiling so a byte that comes back is
 * an OS fact, not an inference.
 */
export function reconFixtures({ workspaceDir, homeDir }) {
  const outOfLaneDir = join(homeDir, 'out-of-lane')
  mkdirSync(outOfLaneDir, { recursive: true })
  mkdirSync(join(workspaceDir, 'sub'), { recursive: true })
  mkdirSync(join(workspaceDir, '.hidden'), { recursive: true })
  mkdirSync(join(workspaceDir, '.git'), { recursive: true })
  writeFileSync(join(workspaceDir, RECON.inLaneFile), `${RECON.inLane}\n`, 'utf8')
  writeFileSync(join(workspaceDir, 'sub', RECON.nestedFile), `${RECON.inLane}\n`, 'utf8')
  writeFileSync(join(workspaceDir, RECON.ignoredFile), `${RECON.ignored}\n`, 'utf8')
  writeFileSync(join(workspaceDir, '.gitignore'), `${RECON.ignoredFile}\n`, 'utf8')
  writeFileSync(join(workspaceDir, '.hidden', RECON.hiddenFile), `${RECON.hidden}\n`, 'utf8')
  // `rg` treats `.git` as VCS metadata: grep skips it, glob excludes it. The
  // file carries the hidden needle so a leak is a returned byte either way.
  writeFileSync(join(workspaceDir, '.git', 'config'), `${RECON.hidden}\n`, 'utf8')
  writeFileSync(join(workspaceDir, 'clean.txt'), 'no needle lives here\n', 'utf8')
  writeFileSync(join(outOfLaneDir, RECON.secretFile), `${RECON.outLane}\n`, 'utf8')
  writeFileSync(join(outOfLaneDir, 'other.txt'), 'unrelated\n', 'utf8')
  return { workspaceDir, outOfLaneDir, secretPath: join(outOfLaneDir, RECON.secretFile), script: reconScript({ workspaceDir, outOfLaneDir }) }
}

/**
 * The shipped preset row's config, with ONE disclosed fixture override: the
 * `tool-fs-search` `timeoutMs` is lowered so the timeout arm aborts inside the
 * boot. No other config key is touched.
 */
export function reconPresetConfig(config) {
  const clone = JSON.parse(JSON.stringify(config))
  const plugins = Array.isArray(clone?.plugins) ? clone.plugins : []
  for (const plugin of plugins) {
    if (plugin?.id !== 'tool-fs-search') continue
    plugin.config = { ...(plugin.config ?? {}), timeoutMs: RECON.timeoutMs }
  }
  return clone
}

/** The scripted Member step for the recon arm. */
export function reconMemberStep({ req, resultIdsOf, lastToolResultText, script }) {
  const seen = resultIdsOf(req)
  for (const step of script) {
    if (!seen.has(step.id)) return { kind: 'tool-call', toolCalls: [{ id: step.id, name: step.name, arguments: step.args }] }
  }
  return { kind: 'text', content: `${RECON.done} ${lastToolResultText(req).slice(0, 400)}` }
}

/**
 * The arm's `toolBindings` entry (v4 grammar, read by the ONE product parser).
 * `trusted-host` is the HONEST boundary for the native path under test: the
 * binding says the tool is served by the host, which is what this arm checks.
 * A `confined-subprocess` declaration would refuse at assembly (see README).
 */
export function reconToolBindings({ workspaceDir, outOfLaneDir }) {
  return [{
    owner: 'dsh.fs',
    name: 'grep',
    authorization: 'allow',
    io: {
      read: { mode: 'restricted', allow: [workspaceDir], ask: [], deny: [] },
      write: { mode: 'all', deny: [] },
      network: { mode: 'allow' },
    },
    execution: { implementationOrigin: 'dsh-native', executionBoundary: 'trusted-host' },
  }]
}

// ─────────────────────────────────────────────────────────────────────────────
// independent /proc observation
// ─────────────────────────────────────────────────────────────────────────────
const RG_RE = /(?:^|\/)(?:rg|\S*ripgrep\S*)\s/u
const ATTR = ['NoNewPrivs', 'Seccomp', 'CapEff', 'NSpid']
function readText(path) {
  try { return readFileSync(path, 'utf8') } catch { return null }
}
function procStatusOf(pid) {
  const text = readText(`/proc/${pid}/status`)
  if (text === null) return null
  const out = {}
  for (const line of text.split('\n')) {
    const i = line.indexOf(':')
    if (i === -1) continue
    const key = line.slice(0, i).trim()
    if (ATTR.includes(key)) out[key] = line.slice(i + 1).trim()
  }
  return out
}
function nsLinkOf(pid, name) {
  try { return readlinkSync(`/proc/${pid}/ns/${name}`) } catch { return null }
}
function nsOf(pid) {
  const out = {}
  for (const name of ['mnt', 'pid', 'net', 'user', 'cgroup']) out[name] = nsLinkOf(pid, name)
  return out
}
function cmdlineOf(pid) {
  const text = readText(`/proc/${pid}/cmdline`)
  return text === null ? null : text.replaceAll('\0', ' ').trim()
}
function mountinfoDigest(pid) {
  const text = readText(`/proc/${pid}/mountinfo`)
  if (text === null) return null
  return { sha256: createHash('sha256').update(text).digest('hex'), lines: text.split('\n').filter(Boolean).length }
}

/**
 * Scan every process and keep the ones that matter for THIS question:
 * `rg` children (any), the confined launcher, and `bwrap`. Each sighting is
 * enriched while the process is still alive — a `/proc` read after exit is
 * impossible, so this is done inline.
 */
export function reconScanProc({ hostPid = null } = {}) {
  const hits = []
  let pids = []
  try { pids = readdirSync('/proc').filter((n) => /^\d+$/u.test(n)) } catch { return hits }
  for (const pidText of pids) {
    const pid = Number(pidText)
    const cmdline = cmdlineOf(pid)
    if (cmdline === null || cmdline === '') continue
    const isRg = RG_RE.test(cmdline) && /ripgrep|@vscode\/ripgrep/u.test(cmdline)
    const isLauncher = cmdline.includes('landlock-prelauncher')
    const isBwrap = cmdline.includes('bwrap')
    if (!isRg && !isLauncher && !isBwrap) continue
    const stat = (() => {
      const text = readText(`/proc/${pid}/stat`)
      if (text === null) return null
      const tail = text.slice(text.lastIndexOf(')') + 2).split(' ')
      return { state: tail[0], ppid: Number(tail[1]) }
    })()
    const ppid = stat?.ppid ?? null
    hits.push({
      at: new Date().toISOString(),
      pid,
      ppid,
      state: stat?.state ?? null,
      kind: isRg ? 'rg' : isLauncher ? 'confined-launcher' : 'bwrap',
      cmdline: cmdline.slice(0, 900),
      ppidCmdline: ppid === null ? null : (cmdlineOf(ppid) ?? '').slice(0, 300),
      isHostChild: ppid !== null && hostPid !== null && ppid === hostPid,
      status: procStatusOf(pid),
      ns: nsOf(pid),
      mountinfo: mountinfoDigest(pid),
    })
  }
  return hits
}

// ─────────────────────────────────────────────────────────────────────────────
// collection + judges
// ─────────────────────────────────────────────────────────────────────────────
const FACT_METHODS = new Set(['shellRead', 'spawn', 'spawn:write', 'searchRead', 'globRead'])

export function reconSamples(transcript, script) {
  const byId = new Map((transcript?.calls ?? []).map((c) => [String(c.callId), c]))
  return script.map((step) => {
    const call = byId.get(step.id) ?? null
    const text = String(call?.result?.text ?? '')
    return {
      id: step.id,
      label: step.label,
      tool: step.name,
      arguments: step.args,
      issued: call !== null,
      resultPresent: call?.result !== null && call?.result !== undefined,
      isError: call?.result?.isError ?? null,
      text,
    }
  })
}

const includes = (sample, needle) => sample.text.includes(needle)

/** The ten behavioural observations, each stated as the proposition it is. */
export function judgeReconSearch({ samples, proc, facts, hostPid, bindingMode }) {
  const s = Object.fromEntries(samples.map((x) => [x.label, x]))
  const rg = proc.filter((h) => h.kind === 'rg').map((h) => ({ ...h, aliveAtCollection: existsSync(`/proc/${h.pid}`) }))
  const launchers = proc.filter((h) => h.kind === 'confined-launcher')
  const terms = {
    'rs:grep-on-surface': {
      proposition: 'the governed Member\'s model-visible surface carries the pinned host `grep` (pattern/path/include) and `glob` (pattern/path)',
      clauses: [
        { id: 'grep-issued', ok: s['grep-inlane-hit']?.issued === true, detail: 'the Member issued a grep call through the surface' },
        { id: 'glob-issued', ok: s['glob-workspace']?.issued === true, detail: 'the Member issued a glob call through the surface' },
      ],
    },
    'rs:grep-inlane-hit': {
      proposition: 'grep admits an IN-CEILING workspace search and returns the matching file and line',
      clauses: [
        { id: 'not-error', ok: s['grep-inlane-hit']?.isError === false, detail: `isError=${String(s['grep-inlane-hit']?.isError)}` },
        { id: 'names-file', ok: includes(s['grep-inlane-hit'] ?? { text: '' }, RECON.inLaneFile), detail: 'the result names in-lane.txt' },
        { id: 'carries-line', ok: includes(s['grep-inlane-hit'] ?? { text: '' }, RECON.inLane), detail: 'the result carries the matched line text' },
      ],
    },
    'rs:grep-out-of-lane': {
      proposition: 'grep does NOT return bytes from a directory outside the Member\'s compiled read ceiling',
      clauses: [
        { id: 'issued', ok: s['grep-out-of-lane']?.issued === true, detail: 'the Member issued the out-of-lane grep' },
        { id: 'result-present', ok: s['grep-out-of-lane']?.resultPresent === true, detail: 'a tool result came back' },
        { id: 'no-secret-bytes', ok: includes(s['grep-out-of-lane'] ?? { text: '' }, RECON.outLane) === false, detail: 'NO out-of-lane needle appeared in the result' },
        { id: 'typed-refusal', ok: /SEARCH_|IO_READ_DENIED|PERMISSION/u.test(String(s['grep-out-of-lane']?.text ?? '')), detail: 'a typed refusal, if refused, must be named' },
      ],
    },
    'rs:grep-parent-dir': {
      proposition: 'grep does NOT reach the parent of the Member workspace (`path: \"..\"`)',
      clauses: [
        { id: 'issued', ok: s['grep-parent-dir']?.issued === true, detail: 'the Member issued the parent-dir grep' },
        { id: 'no-secret-bytes', ok: includes(s['grep-parent-dir'] ?? { text: '' }, RECON.outLane) === false, detail: 'NO out-of-lane needle appeared in the result' },
        { id: 'typed-refusal', ok: /SEARCH_|IO_READ_DENIED|PERMISSION/u.test(String(s['grep-parent-dir']?.text ?? '')), detail: 'a typed refusal, if refused, must be named' },
      ],
    },
    'rs:grep-ignore': {
      proposition: 'grep honours .gitignore (a gitignored file is not searched)',
      clauses: [
        { id: 'not-error', ok: s['grep-gitignore']?.isError === false, detail: `isError=${String(s['grep-gitignore']?.isError)}` },
        { id: 'ignored-absent', ok: includes(s['grep-gitignore'] ?? { text: '' }, RECON.ignoredFile) === false, detail: 'ignored.txt is absent from the result' },
        { id: 'no-ignored-bytes', ok: includes(s['grep-gitignore'] ?? { text: '' }, RECON.ignored) === false, detail: 'the ignored needle is absent from the result' },
      ],
    },
    'rs:grep-hidden-vcs': {
      proposition: 'grep skips hidden files and VCS metadata by default (rg defaults)',
      clauses: [
        { id: 'not-error', ok: s['grep-hidden-vcs']?.isError === false, detail: `isError=${String(s['grep-hidden-vcs']?.isError)}` },
        { id: 'hidden-absent', ok: includes(s['grep-hidden-vcs'] ?? { text: '' }, RECON.hiddenFile) === false, detail: '.hidden/hidden.txt is absent' },
        { id: 'git-absent', ok: /\.git\//u.test(String(s['grep-hidden-vcs']?.text ?? '')) === false, detail: '.git/config is absent' },
      ],
    },
    'rs:grep-exit-nomatch': {
      proposition: 'a zero-match grep is a SUCCESS (rg exit 1), never an error',
      clauses: [
        { id: 'not-error', ok: s['grep-no-match']?.isError === false, detail: `isError=${String(s['grep-no-match']?.isError)}` },
        { id: 'empty-answer', ok: /No matches found|Found 0/u.test(String(s['grep-no-match']?.text ?? '')), detail: 'the result states no matches in the success shape' },
      ],
    },
    'rs:grep-exit-error': {
      proposition: 'a pattern rg rejects is an ERROR (rg exit 2) distinguishable from a zero-match success, and the model-facing text names its typed code',
      clauses: [
        { id: 'is-error', ok: s['grep-invalid-regex']?.isError === true, detail: `isError=${String(s['grep-invalid-regex']?.isError)}` },
        { id: 'distinct-from-nomatch', ok: s['grep-no-match']?.isError === false && s['grep-invalid-regex']?.isError === true, detail: 'no-match is success, bad pattern is error' },
        { id: 'typed-code', ok: /SEARCH_INVALID_PATTERN/u.test(String(s['grep-invalid-regex']?.text ?? '')), detail: 'the result names SEARCH_INVALID_PATTERN (measured: the wire carries only rg\'s stderr words)' },
      ],
    },
    'rs:glob-workspace': {
      proposition: 'glob lists workspace paths by rg semantics (`--no-ignore --hidden`, VCS metadata still excluded)',
      clauses: [
        { id: 'not-error', ok: s['glob-workspace']?.isError === false, detail: `isError=${String(s['glob-workspace']?.isError)}` },
        { id: 'names-inlane', ok: includes(s['glob-workspace'] ?? { text: '' }, RECON.inLaneFile), detail: 'in-lane.txt is listed' },
        { id: 'names-ignored', ok: includes(s['glob-workspace'] ?? { text: '' }, RECON.ignoredFile), detail: 'ignored.txt is listed (glob uses --no-ignore)' },
        { id: 'no-vcs', ok: /\.git\//u.test(String(s['glob-workspace']?.text ?? '')) === false, detail: '.git is excluded by GLOB_VCS_EXCLUDES' },
      ],
    },
    'rs:glob-out-of-lane': {
      proposition: 'glob does NOT list files outside the Member\'s compiled read ceiling',
      clauses: [
        { id: 'issued', ok: s['glob-out-of-lane']?.issued === true, detail: 'the Member issued the out-of-lane glob' },
        { id: 'no-secret-file', ok: includes(s['glob-out-of-lane'] ?? { text: '' }, RECON.secretFile) === false, detail: 'the out-of-lane file name is absent' },
        { id: 'typed-refusal', ok: /SEARCH_|IO_READ_DENIED|PERMISSION/u.test(String(s['glob-out-of-lane']?.text ?? '')), detail: 'a typed refusal, if refused, must be named' },
      ],
    },
    'rs:grep-timeout': {
      proposition: 'a grep that exceeds its cooperative budget is ABORTED with an error naming the timeout, and no search answer is composed from the unfinished walk',
      clauses: [
        { id: 'is-error', ok: s['grep-timeout']?.isError === true, detail: `isError=${String(s['grep-timeout']?.isError)}` },
        { id: 'timeout-named', ok: /timed out/u.test(String(s['grep-timeout']?.text ?? '')), detail: 'the error names the timeout' },
        { id: 'no-answer', ok: /Found \d+|No matches found/u.test(String(s['grep-timeout']?.text ?? '')) === false, detail: 'no search answer was composed' },
      ],
    },
    'rs:guard-facts': {
      proposition: 'the product guard sink records a Member/Tool/Call/PolicyRevision fact for the search calls',
      clauses: [
        { id: 'zero-search-facts', ok: (facts ?? []).filter((f) => FACT_METHODS.has(f?.method)).length === 0, detail: `${String((facts ?? []).length)} guard fact(s); none for grep/glob` },
      ],
    },
    'rs:process-host-direct': {
      proposition: 'the real `rg` child is a direct child of the HOST process (same mount/pid namespace, no confined launcher) — i.e. the inherited base subprocess service',
      clauses: [
        { id: 'rg-sighted', ok: rg.length > 0, detail: `${String(rg.length)} rg sighting(s)` },
        { id: 'host-child', ok: rg.some((h) => h.isHostChild === true), detail: `at least one rg ppid == host pid (${String(hostPid)})` },
        { id: 'host-template-argv', ok: rg.some((h) => h.cmdline.includes('--no-config') && (h.cmdline.includes('--json') || h.cmdline.includes('--files'))), detail: 'argv carries the pinned host templates' },
        { id: 'no-lane-flags', ok: rg.every((h) => h.cmdline.includes('--no-ignore-parent') === false && h.cmdline.includes('--no-ignore-vcs') === false), detail: 'the confined face\'s lane-safe flags are absent' },
        { id: 'no-confined-launcher', ok: launchers.length === 0, detail: `${String(launchers.length)} confined launcher(s) for the search calls` },
      ],
    },
  }
  const cases = Object.entries(terms).map(([id, t]) => {
    const failed = t.clauses.filter((c) => c.ok !== true)
    return {
      id,
      proposition: bindingMode === true && id === 'rs:grep-out-of-lane' ? `${t.proposition} — WITH a v4 toolBindings entry for grep narrowing read to the workspace` : t.proposition,
      verdict: failed.length === 0 ? 'PROVEN' : 'REFUTED',
      failed: failed.map((c) => `${c.id}: ${c.detail}`),
      clauses: t.clauses,
    }
  })
  const governance = {
    grep: {
      outOfLaneLeak: includes(s['grep-out-of-lane'] ?? { text: '' }, RECON.outLane),
      parentLeak: includes(s['grep-parent-dir'] ?? { text: '' }, RECON.outLane),
      guardFacts: (facts ?? []).length,
    },
    glob: { outOfLaneLeak: includes(s['glob-out-of-lane'] ?? { text: '' }, RECON.secretFile) },
  }
  return { cases, governance }
}

/** Write the raw arm artefacts beside the driver's normal per-boot files. */
export function writeReconArtefacts({ bootDir, samples, proc, facts, hostPid, ownershipPath, transcript }) {
  const rg = proc.filter((h) => h.kind === 'rg').map((h) => ({ ...h, aliveAtCollection: existsSync(`/proc/${h.pid}`) }))
  const launchers = proc.filter((h) => h.kind === 'confined-launcher')
  const host = hostPid === null ? null : {
    pid: hostPid,
    cmdline: (() => { try { return readFileSync(`/proc/${hostPid}/cmdline`, 'utf8').replaceAll('\0', ' ').trim().slice(0, 400) } catch { return null } })(),
    ns: nsOf(hostPid),
    mountinfo: (() => {
      try {
        const text = readFileSync(`/proc/${hostPid}/mountinfo`, 'utf8')
        return { sha256: createHash('sha256').update(text).digest('hex'), lines: text.split('\n').filter(Boolean).length }
      } catch { return null }
    })(),
    status: procStatusOf(hostPid),
  }
  const argv = rg.map((h) => h.cmdline)
  const payload = {
    schema: 'a5sf-recon-search/1',
    at: new Date().toISOString(),
    question: 'does the governed Member\'s model-visible grep/glob execute the packaged rg on the CONFINED Member subprocess face, or on the inherited host service?',
    transcriptFile: transcript?.file ?? null,
    samples,
    process: {
      host,
      rgSightings: rg,
      confinedLaunchers: launchers,
      bwrap: proc.filter((h) => h.kind === 'bwrap').length,
      rgArgv: argv,
      distinctRgPpid: [...new Set(rg.map((h) => h.ppid))],
      allRgHostChildren: rg.length > 0 && rg.every((h) => h.isHostChild === true),
      sameMntNsAsHost: host === null ? null : rg.every((h) => h.ns?.mnt === host.ns?.mnt),
      samePidNsAsHost: host === null ? null : rg.every((h) => h.ns?.pid === host.ns?.pid),
      sameMountinfoAsHost: host === null ? null : rg.every((h) => h.mountinfo?.sha256 === host.mountinfo?.sha256),
    },
    guardFacts: facts,
    ownership: existsSync(ownershipPath) ? (() => { try { return JSON.parse(readFileSync(ownershipPath, 'utf8')) } catch { return null } })() : null,
  }
  writeFileSync(join(bootDir, 'recon-search.json'), JSON.stringify(payload, null, 2) + '\n')
  const text = [
    'RECON-SEARCH — process evidence (raw)',
    `host pid: ${String(hostPid)}`,
    `host cmdline: ${String(host?.cmdline)}`,
    `rg sightings: ${String(rg.length)}; distinct ppids: ${JSON.stringify(payload.process.distinctRgPpid)}`,
    `same mnt ns as host: ${String(payload.process.sameMntNsAsHost)}; same pid ns: ${String(payload.process.samePidNsAsHost)}; same mountinfo: ${String(payload.process.sameMountinfoAsHost)}`,
    `confined launchers during the Member turn: ${String(launchers.length)}`,
    '',
    'rg argv seen:',
    ...argv.map((a) => `  ${a}`),
    '',
    'host status:',
    `  ${JSON.stringify(host?.status)}`,
    '',
    'guard facts:',
    `  ${JSON.stringify(facts)}`,
  ].join('\n')
  writeFileSync(join(bootDir, 'process-evidence.txt'), text + '\n')
  return payload
}
