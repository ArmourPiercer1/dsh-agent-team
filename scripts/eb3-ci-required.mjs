#!/usr/bin/env node
/**
 * eb3-ci-required.mjs — EB3-B/C: the layered-CI shape checker.
 *
 * WHAT IT ENFORCES. `dev/ci/eb3-ci-manifest.json` is the one declaration of the
 * CI layers (ci-fast / ci-integration / ci-security / ci-full) and of the
 * synthetic merge-tree summary job that is the single Required context. This
 * file grades the workflow YAML against it, and every rule exists because a
 * job can be PRESENT and still not gate anything:
 *
 *   CI_REQUIRED_JOB_ABSENT      declared layer/summary job not found in its workflow
 *   CI_JOB_UNDECLARED           a workflow job nobody declared (the next tidy-up deletes it unseen)
 *   CI_LAYER_NOT_TRIGGERED      a layer workflow is not reachable on an event the manifest demands
 *   CI_LAYER_PATH_FILTERED      a trigger carries paths/paths-ignore — a PR outside the filter
 *                               never runs the layer, and "never ran" must not read as green
 *   CI_LAYER_SKIPPABLE          a layer job carries a job-level `if:` (a skipped job reports
 *                               `skipped`, which a needs-graph does not treat as failure)
 *   CI_LAYER_CONTINUE_ON_ERROR  job- or step-level continue-on-error: a red step reported green
 *   CI_LAYER_CANCELLABLE        cancel-in-progress true where the manifest forbids it —
 *                               `cancelled` is neither green nor red
 *   CI_LAYER_LEG_MISSING        no step EXECUTES the leg's declared invocation (echo, name:, comment,
 *                               quoted string do not count — see "leg invocation" below)
 *   CI_LAYER_LEG_WEAKENED       the invocation runs but with a required flag missing, a forbidden
 *                               flag present (e.g. --allow-refused census), `|| true`, an
 *                               un-pipefailed pipe, or a conditional step
 *   CI_HOST_DEPENDENT_SUITE_IN_HOST_FREE_LAYER   a hostFree layer lists a suite that resolves
 *                               the pinned host checkout (checkSuiteLists)
 *   CI_SUMMARY_NOT_ALWAYS       the summary job lacks `if: always()` — when a layer fails a
 *                               summary without always() is SKIPPED, and skipped is not red
 *   CI_SUMMARY_NEEDS_INCOMPLETE the summary does not call + need every layer — that layer can
 *                               fail while the summary stays green
 *   CI_SUMMARY_NOT_GRADING      the summary does not hand `toJSON(needs)` to the grader, so
 *                               it cannot tell success from skipped/cancelled/failure
 *   CI_WORKFLOW_UNPARSEABLE     a workflow file the parser rejects (never a skipped file)
 *   CI_DECLARED_JOB_ABSENT      a job the manifest declares as known-non-required has vanished
 *
 * Each rule is a predicate over the PARSED workflow (`yaml`, a root dependency),
 * not over line regexes — a reformatting must not change the verdict, and a
 * quoted `if: "false"` must not escape a line regex. Rules about what a step DOES
 * read the parsed `run:` script as commands (commandsOf), never as text: the R1
 * review of PR #395 proved the first leg rule — a substring search — was satisfied
 * by `echo docs:sync --check`.
 *
 * Exported for scripts/eb3-ci-negative-controls.mjs (C1):
 *   checkRequiredJobs({ files, manifest? }) → { findings }
 *   REQUIRED_JOBS, MANIFEST_REL, loadManifest(), workflowFiles()
 *
 *   node scripts/eb3-ci-required.mjs [--json]
 *
 * Exit: 0 no findings | 1 findings | 2 could not grade (manifest/IO error).
 *
 * @module scripts/eb3-ci-required
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { loadManifest, MANIFEST_REL } from './eb3-ci-manifest.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
// ONE loader: the Required summary grades with scripts/eb3-ci-manifest.mjs (dependency
// free, because it must not need `pnpm install` to state a verdict), and this file
// re-exports it so the shape rules and the grader cannot read two different manifests.
export { loadManifest, MANIFEST_REL }

/** `on:` normalised to { eventName: config|null }. A YAML 1.1 reader turns a
 *  bare `on` key into boolean true; `yaml` (1.2 core) keeps "on". Both are read,
 *  so a parser swap cannot silently empty the trigger set. */
function triggersOf(doc) {
  const raw = doc?.on ?? doc?.true ?? null
  if (raw === null || raw === undefined) return {}
  if (typeof raw === 'string') return { [raw]: null }
  if (Array.isArray(raw)) return Object.fromEntries(raw.map((e) => [e, null]))
  return raw
}


// ───────────────────────────────── leg invocation — an ALLOWLIST (R1 blocker, R2 F-2)
//
// HISTORY, because the rule has failed twice and the reasons are the specification.
//  R1: the first rule was a substring search (`echo docs:sync --check` satisfied it).
//  R2 F-2: the second rule parsed commands but was a DENYLIST of known evasions, and
//      claimed "a construct it does not understand never SATISFIES a leg". The R2
//      reviewer falsified that claim with three invented shapes:
//        if false; then node …; fi      node … &      node … || exit 0
//      A denylist enumerates what is wrong and passes the rest; a new shape is green.
//
// THE RULE NOW: a leg is satisfied ONLY by a shape this reader POSITIVELY RECOGNISES.
// Everything else — including every construct it has never seen — is LEG_UNPROVEN,
// with the construct named. False reds over false greens: a real workflow line that
// fails this rule is rewritten into the allowed shape; the rule is not widened.
//
// THE ALLOWED SHAPE (all must hold):
//  STEP   `run:` is a string; no `if:` or exactly always()/success(); no
//         `continue-on-error`; `shell:` unset or exactly `bash`; no `working-directory`;
//         no step `env.PATH`. (Unset shell on ubuntu = `bash -e {0}`; `bash` = `bash
//         --noprofile --norc -eo pipefail {0}` — both errexit, both measured in hosted
//         logs of this PR.)
//  SCRIPT read line by line after joining `\`-continuations and dropping blank and
//         whole-line `#` lines. EVERY line BEFORE the leg's line must itself be in the
//         allowed PRELUDE set (below); the reader does not reason about a line it does
//         not recognise, it stops. Lines AFTER the leg line are not read for safety
//         except: no `trap` anywhere in the script (an EXIT trap after can rewrite the
//         status).
//  LINE   the leg line is ONE simple command: optional leading `NAME=value` words, then
//         argv. Its tokens contain NO shell metacharacter outside quotes:
//         ; & | < > ( ) { } ` $( !  — with exactly ONE exception: a TRAILING pipeline
//         `<leg> 2>&1 | tee <file>` / `| tee -a <file>` when the script set pipefail
//         before it (the census line). The leg's argv must start with the leg's cmd and
//         carry its required flags and none of its forbidden ones.
//  ASSIGNMENTS: a leading `NAME=value` on the leg line, and a prelude assignment line,
//         are allowed only for NAME in LEG_ASSIGNMENT_ALLOWLIST (D12) — one law for both.
//  PRELUDE lines the reader accepts before a leg line:
//           set -e / -eu / -euo pipefail / -eo pipefail / -o pipefail / -o errexit /
//               -o nounset (any combination of those letters/options, never `+`)
//           mkdir -p <words without metacharacters>
//           a NAME=value assignment whose NAME is in LEG_ASSIGNMENT_ALLOWLIST
//           echo <quoted or plain words without metacharacters, may end `>> "$GITHUB_*"`>
//           a previous leg-shaped simple command (node/pnpm … without metacharacters)
//         Nothing else. A `cd`, `source`, `trap`, function definition, alias, `PATH=`
//         reassignment, `set +…`, `shopt`, or any compound construct before the leg
//         makes the leg UNPROVEN.
//
// The reader is deliberately small. It is not a shell; it is a recogniser for the
// handful of shapes these workflows need, and its silence means "not proven".

/** Is a step/job `if:` an un-falsifiable always()? Accepts `always()` and
 *  `always() && <terms with no negation and no `false`>`; rejects anything else,
 *  including `always() && false`, which contains the word and never runs. */
export function isAlwaysCondition(cond) {
  const text = String(cond ?? '').trim().replace(/^\$\{\{/, '').replace(/\}\}$/, '').trim()
  if (text === '') return false
  const parts = text.split('&&').map((x) => x.trim())
  if (!parts.includes('always()')) return false
  return !parts.some((x) => /^!/.test(x) || /\bfalse\b/.test(x) || /\bnull\b/.test(x))
}

/** Is the value a verdict step WRITES to $GITHUB_OUTPUT derived from job.status?
 *
 *  The first version accepted any `${{ … job.status … }}` anywhere in the script, and
 *  C11-c proved that wrong: delete the `case`, write a constant, and a surviving
 *  `echo "… status=${{ job.status }}"` LOG line still satisfied it. The rule traces the
 *  written value instead: the line `echo "verdict=<X>" >> "$GITHUB_OUTPUT"` must write
 *  either `${{ … job.status … }}` directly, or `$V` for a variable V whose EVERY
 *  assignment sits inside a `case "${{ job.status }}" in … esac`. A comment, a log line
 *  mentioning job.status, or an assignment outside the case does not qualify. */
export function computesFromJobStatus(script) {
  const lines = String(script ?? '').split(/\r?\n/).filter((l) => !/^\s*#/.test(l))
  const writeMatch = lines.map((l) => /echo\s+["']?verdict=([^"'\s>]+)["']?\s*>>\s*["']?\$GITHUB_OUTPUT/.exec(l)).find(Boolean)
  if (writeMatch === undefined) return false
  const val = writeMatch[1]
  if (/^\$\{\{[^}]*job\.status[^}]*\}\}$/.test(val)) return true
  const mv = /^\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?$/.exec(val)
  if (mv === null) return false
  const v = mv[1]
  let inCase = false
  let assignedInCase = false
  for (const l of lines) {
    if (/^\s*case\s+["']?\$\{\{\s*job\.status\s*\}\}["']?\s+in\b/.test(l)) { inCase = true; continue }
    if (inCase && /^\s*esac\b/.test(l)) { inCase = false; continue }
    if (new RegExp('(?:^|[\\s;)])' + v + '=').test(l)) {
      if (!inCase) return false
      assignedInCase = true
    }
  }
  return assignedInCase
}

/** Logical lines of a run: script — continuations joined, blank and whole-line `#`
 *  comment lines dropped. Inline `# …` is NOT stripped: a line carrying one is simply
 *  not in the allowed set (the reader does not guess where a comment starts). */
export function logicalLines(script) {
  return String(script ?? '').replace(/\\\r?\n/g, ' ').split(/\r?\n/)
    .map((l) => l.trim()).filter((l) => l !== '' && !l.startsWith('#'))
}

/** Tokenise ONE simple command, or return null if it contains anything outside the
 *  allowed vocabulary: an unquoted shell metacharacter, a command substitution (even
 *  inside double quotes), backticks, or an unterminated quote. */
export function simpleCommand(line) {
  const toks = []
  let cur = ''
  let had = false
  let q = null
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i]
    if (q === "'") { if (c === "'") q = null; else cur += c; continue }
    if (q === '"') {
      if (c === '"') { q = null; continue }
      if (c === '`' || (c === '$' && line[i + 1] === '(')) return null
      if (c === '\\' && i + 1 < line.length) { cur += line[i + 1]; i += 1; continue }
      cur += c
      continue
    }
    if (c === "'" || c === '"') { q = c; had = true; continue }
    if (/\s/.test(c)) { if (had || cur !== '') { toks.push(cur); cur = ''; had = false } continue }
    if (';&|<>(){}`!#\\'.includes(c)) return null
    if (c === '$' && line[i + 1] === '(') return null
    cur += c
    had = true
  }
  if (q !== null) return null
  if (had || cur !== '') toks.push(cur)
  return toks.length === 0 ? null : toks
}

const ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*=/

/** THE ONE ASSIGNMENT LAW (D12, found by main-agent verification at 6c1aeda17).
 *
 *  A `NAME=value` before a leg — as an inline prefix on the leg line OR as a prelude
 *  line — is allowed ONLY when NAME is on this list: names that cannot change WHICH
 *  program runs, what it loads, or how its status is reported. The first allowlist
 *  reader skipped every inline prefix unchecked, and NODE_OPTIONS=--require=<preload>
 *  was demonstrated to turn `process.exit(3)` into status 0; the prelude path had a
 *  six-name DENYLIST. Both now share this list, and anything not on it is UNPROVEN.
 *
 *  Kept deliberately small: locale/colour/timezone/CI-flag only. No real leg line uses
 *  a prefix today (the only prefixed command in these workflows is the HOST build in
 *  ci-full, which is not a leg). A name is added here only with a reason it cannot
 *  affect execution or status. */
export const LEG_ASSIGNMENT_ALLOWLIST = Object.freeze(['CI', 'FORCE_COLOR', 'NO_COLOR', 'TZ', 'LANG', 'LC_ALL'])

/** null if every token is an allowlisted assignment, else the first refused NAME. */
function refusedAssignment(tokens) {
  for (const tok of tokens) {
    const name = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(tok)?.[1]
    if (name === undefined) return null
    if (!LEG_ASSIGNMENT_ALLOWLIST.includes(name)) return name
  }
  return null
}
const SET_OPT = /^set$/
/** Is this logical line in the PRELUDE allowlist? Returns a reason string if NOT. */
function preludeRefusal(line) {
  const argv = simpleCommand(line)
  // echo … >> "$GITHUB_OUTPUT" / "$GITHUB_ENV": the only redirection the prelude accepts.
  if (argv === null) {
    const m = /^(echo\s+.*?)\s*>>\s*"?\$(GITHUB_OUTPUT|GITHUB_ENV|GITHUB_STEP_SUMMARY)"?$/.exec(line)
    if (m !== null && simpleCommand(m[1])?.[0] === 'echo') return null
    return `a line the reader does not recognise precedes the leg: \`${line.slice(0, 80)}\``
  }
  if (SET_OPT.test(argv[0])) {
    for (const a of argv.slice(1)) {
      if (a.startsWith('+')) return `\`${line}\` turns a shell safety option OFF before the leg`
      if (/^-[euo]+$/.test(a) || ['pipefail', 'errexit', 'nounset'].includes(a)) continue
      return `\`${line}\` sets an option the reader does not recognise (${a})`
    }
    return null
  }
  if (argv.every((t) => ASSIGN.test(t))) {
    // Same law as an inline prefix on the leg line: one allowlist, not a denylist.
    const bad = refusedAssignment(argv)
    if (bad !== null) return `\`${line.slice(0, 80)}\` assigns ${bad}, which is not on the leg assignment allowlist (${LEG_ASSIGNMENT_ALLOWLIST.join(', ')}) — it may change what runs or how its status is reported`
    return null
  }
  // A prefixed prelude COMMAND carries its prefixes into that command only; the prefix
  // names are still graded, so a refused name cannot ride in on a harmless-looking head.
  const pfx = refusedAssignment(argv)
  if (pfx !== null) return `\`${line.slice(0, 80)}\` prefixes ${pfx}, which is not on the leg assignment allowlist`
  const head = argv.find((t) => !ASSIGN.test(t))
  if (head === 'mkdir' || head === 'echo' || head === 'node' || head === 'pnpm') return null
  return `\`${argv[0]}\` before the leg is outside the reader's allowlist (cd/source/trap/functions/alias/shopt and every compound construct are)`
}

/** Positive recognition of the leg on ONE logical line. Returns { argv } or { why }. */
function legLine(line, leg, pipefailSet) {
  let body = line
  // The single allowed pipeline: `<leg> [2>&1] | tee [-a] <file>`, leg FIRST, and only
  // with pipefail already set (so the leg's status is the pipeline's status).
  const tee = /^(.*?)\s*(?:2>&1\s*)?\|\s*tee\s+(?:-a\s+)?("[^"$`]*(?:\$[A-Za-z_][A-Za-z0-9_]*[^"$`]*)*"|[^\s;&|<>()`$]+)\s*$/.exec(line)
  if (tee !== null) {
    if (!pipefailSet) return { why: 'the leg is piped into tee without `set -o pipefail` before it — its exit code never reaches the step' }
    body = tee[1]
  }
  const argv = simpleCommand(body)
  if (argv === null) return { why: `the leg line is not a single simple command (it contains an operator, redirection, substitution or grouping): \`${line.slice(0, 90)}\`` }
  let i = 0
  while (i < argv.length && ASSIGN.test(argv[i])) i += 1
  const cmd = argv.slice(i)
  if (!leg.cmd.every((w, k) => cmd[k] === w)) return null // not this leg's line
  // The leg's own inline prefixes: graded by the one allowlist (D12). This is the path
  // that was skipped unchecked; NODE_OPTIONS=--require=… was proven to flip exit 3 to 0.
  const bad = refusedAssignment(argv.slice(0, i))
  if (bad !== null) return { why: `the leg line prefixes ${bad}=…, which is not on the leg assignment allowlist (${LEG_ASSIGNMENT_ALLOWLIST.join(', ')}) — it may change what runs or how its status is reported` }
  return { argv: cmd }
}

/**
 * Grade one leg against one job. null = satisfied by an allowlisted shape. Otherwise
 * { code, why } — CI_LAYER_LEG_MISSING (nothing that even looks like the leg),
 * CI_LAYER_LEG_WEAKENED (the leg runs with a missing/forbidden flag), or
 * CI_LAYER_LEG_UNPROVEN (a leg-looking command in a shape the reader cannot prove gates
 * the step — the construct is named).
 */
export function gradeLeg(job, leg) {
  const steps = Array.isArray(job?.steps) ? job.steps : []
  const unproven = []
  const weakened = []
  const mentions = (s) => typeof s?.run === 'string' && s.run.includes(leg.cmd[leg.cmd.length - 1])
  for (const step of steps) {
    if (!mentions(step)) continue
    const stepWhy = stepRefusal(step)
    const lines = logicalLines(step.run)
    let pipefail = false
    let blocked = null
    const scriptWide = /(^|\n)\s*trap\b/.test(step.run) ? 'a `trap` in the script can rewrite the exit status' : null
    for (const line of lines) {
      const hit = legLine(line, leg, pipefail)
      if (hit !== null) {
        const why = stepWhy ?? blocked ?? scriptWide ?? hit.why ?? null
        if (why !== null) { unproven.push(`${String(step.name ?? 'unnamed step')}: ${why}`); break }
        const rest = hit.argv.slice(leg.cmd.length)
        const problems = []
        for (const f of leg.check ?? []) if (!rest.includes(f)) problems.push(`missing ${f}`)
        for (const f of leg.forbid ?? []) {
          const at = rest.indexOf(f)
          if (at === -1) continue
          const vals = leg.forbidValues?.[f]
          if (vals === undefined) { problems.push(`carries forbidden ${f}`); continue }
          const v = String(rest[at + 1] ?? '').split(',').map((x) => x.trim())
          if (vals.some((x) => v.includes(x))) problems.push(`carries forbidden ${f} ${rest[at + 1]}`)
        }
        if (problems.length === 0) return null
        weakened.push(`${String(step.name ?? 'unnamed step')}: ${problems.join(', ')}`)
        break
      }
      // Not the leg line: it must be an allowed prelude line, or nothing after it counts.
      if (blocked === null) {
        const r = preludeRefusal(line)
        if (r !== null) blocked = r
        else {
          const a = simpleCommand(line)
          if (a?.[0] === 'set' && a.slice(1).some((x) => /^-[a-z]*o$/.test(x) || x === '-o') && a.includes('pipefail')) pipefail = true
          if (a?.[0] === 'set' && a.slice(1).some((x) => /^-[eu]*o[eu]*$/.test(x)) && a.includes('pipefail')) pipefail = true
        }
      }
    }
    // A leg-mentioning step where no line was recognised as the leg: the leg is buried
    // inside some construct the reader does not prove (if/case/loop/function/$(…)/-c).
    if (unproven.length === 0 && weakened.length === 0) {
      unproven.push(`${String(step.name ?? 'unnamed step')}: \`${leg.cmd.join(' ')}\` appears only inside a construct the reader does not prove (if/case/loop/function/substitution/\`-c\` string/heredoc/operator)`)
    }
  }
  if (weakened.length > 0) return { code: 'CI_LAYER_LEG_WEAKENED', why: `\`${leg.cmd.join(' ')}\` runs but weakened — ${weakened.join(' ;; ')}` }
  if (unproven.length > 0) return { code: 'CI_LAYER_LEG_UNPROVEN', why: `\`${leg.cmd.join(' ')}\` is not PROVEN to gate its step — ${unproven.join(' ;; ')}` }
  return { code: 'CI_LAYER_LEG_MISSING', why: `no step executes \`${leg.cmd.join(' ')}\`` }
}

/** Step-level conditions under which no leg in the step is proven. */
function stepRefusal(step) {
  if ('if' in step && !/^\s*(?:\$\{\{\s*)?(?:always\(\)|success\(\))(?:\s*\}\})?\s*$/.test(String(step.if))) return `step if: ${JSON.stringify(step.if)} (only unconditional, always() or success() is proven to run)`
  if (step['continue-on-error'] !== undefined && step['continue-on-error'] !== false) return `step continue-on-error=${JSON.stringify(step['continue-on-error'])}`
  if (step.shell !== undefined && step.shell !== 'bash') return `step shell: ${JSON.stringify(step.shell)} (only unset or exactly \`bash\` is proven errexit)`
  if (step['working-directory'] !== undefined) return `step working-directory: ${JSON.stringify(step['working-directory'])} moves the relative script path`
  if (step.env !== undefined && Object.keys(step.env).some((k) => ['PATH', 'BASH_ENV', 'ENV', 'NODE_OPTIONS'].includes(k))) return 'step env reassigns PATH/BASH_ENV/ENV/NODE_OPTIONS — what `node` resolves to is not proven'
  return null
}

/** Retained for the binding/grading rules: the simple commands of a script, by the
 *  same allowlist (non-simple lines are omitted, not guessed at). */
export function commandsOf(script) {
  return logicalLines(script).map((l) => simpleCommand(l)).filter((a) => a !== null)
    .map((argv) => { let i = 0; while (i < argv.length && ASSIGN.test(argv[i])) i += 1; return { argv: argv.slice(i), swallowed: false, piped: false } })
    .filter((c) => c.argv.length > 0)
}

// ─────────────────────────────── host-dependent suites in a host-free layer (hosted #1 red)
/** Spellings that make a suite resolve the PINNED HOST checkout (tests/paths.mjs). */
export const HOST_DEPENDENCE_MARKERS = Object.freeze([
  'findTestRepoRoot',
  'TEST_USE_REL',
  'TEST_USE_BASELINE_SHA',
  'deepseek-harness-test-use',
])

/** Read a suite list file: one path per line, `#` comments and blanks ignored. */
export function readSuiteList(text) {
  return String(text).split('\n').map((l) => l.trim()).filter((l) => l !== '' && !l.startsWith('#'))
}

/**
 * Every layer that declares a `suiteList` is graded: each listed suite must exist, and
 * a `hostFree` layer may list no suite that names a host-dependence marker (comments
 * included, on purpose: a suite whose only mention is a comment costs one rename to
 * clear, and a false negative here costs a red hosted run nobody can reproduce
 * locally — the exact incident this rule was written from).
 *
 * @param {object} p
 * @param {string} [p.root]
 * @param {object} [p.manifest]
 * @param {Record<string,string>} [p.override]  path → text, for controls (no disk writes)
 */
export function checkSuiteLists({ root = ROOT, manifest = loadManifest(root), override = {} } = {}) {
  const findings = []
  const read = (rel) => (rel in override ? override[rel] : existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8') : null)
  for (const layer of manifest.layers) {
    if (typeof layer.suiteList !== 'string') continue
    const listText = read(layer.suiteList)
    if (listText === null) {
      findings.push({ code: 'CI_SUITE_LIST_ABSENT', detail: `layer ${layer.id}: suite list ${layer.suiteList} is absent` })
      continue
    }
    const suites = readSuiteList(listText)
    if (suites.length === 0) findings.push({ code: 'CI_SUITE_LIST_EMPTY', detail: `layer ${layer.id}: ${layer.suiteList} lists no suite` })
    for (const s of suites) {
      const text = read(s)
      if (text === null) { findings.push({ code: 'CI_SUITE_ABSENT', detail: `layer ${layer.id}: listed suite ${s} does not exist` }); continue }
      if (layer.hostFree !== true) continue
      const hits = HOST_DEPENDENCE_MARKERS.filter((m) => text.includes(m))
      if (hits.length > 0) {
        findings.push({
          code: 'CI_HOST_DEPENDENT_SUITE_IN_HOST_FREE_LAYER',
          detail: `layer ${layer.id} is declared hostFree but lists ${s}, which resolves the pinned host (${hits.join(', ')}) — on a hosted runner it cannot run; move it to a layer that provisions the host and record the move in ${MANIFEST_REL}`,
        })
      }
    }
  }
  // Every suite a manifest MOVES out of a host-free list must land somewhere real.
  for (const mv of manifest.movedSuites ?? []) {
    const dest = manifest.layers.find((l) => l.id === mv.to)
    if (dest === undefined) findings.push({ code: 'CI_SUITE_MOVE_DANGLING', detail: `${mv.suite} moved to unknown layer ${String(mv.to)}` })
    else if (dest.hostFree !== false) findings.push({ code: 'CI_SUITE_MOVE_DANGLING', detail: `${mv.suite} moved to ${mv.to}, which does not provision the host` })
    if (read(mv.suite) === null) findings.push({ code: 'CI_SUITE_ABSENT', detail: `moved suite ${mv.suite} does not exist` })
  }
  return { findings }
}

/**
 * @param {object} p
 * @param {Map<string,string>} p.files  repo-relative path → workflow YAML text
 * @param {object} [p.manifest]          defaults to the tracked manifest
 */
export function checkRequiredJobs({ files, manifest = loadManifest() }) {
  const findings = []
  const add = (code, detail, extra = {}) => findings.push({ code, detail, ...extra })

  const docs = new Map()
  for (const [path, text] of files) {
    if (!/^\.github\/workflows\/[^/]+\.ya?ml$/.test(path)) continue
    try {
      docs.set(path, parseYaml(text) ?? {})
    } catch (e) {
      add('CI_WORKFLOW_UNPARSEABLE', `${path}: ${String(e?.message ?? e).split('\n')[0]}`, { path })
    }
  }
  const jobAt = (workflow, job) => docs.get(workflow)?.jobs?.[job] ?? null

  // ── every declared layer
  for (const layer of manifest.layers) {
    const job = jobAt(layer.workflow, layer.job)
    if (job === null) {
      add('CI_REQUIRED_JOB_ABSENT', `layer ${layer.id}: job "${layer.job}" not found in ${layer.workflow}`, { layer: layer.id, job: layer.job })
      continue
    }
    const doc = docs.get(layer.workflow)
    const on = triggersOf(doc)
    // A layer is reachable for an event either directly or as a reusable workflow
    // the summary calls (workflow_call); `mustRunOn` names the event the layer must
    // be graded under, and the summary rules below prove the call happens.
    for (const ev of layer.mustRunOn ?? []) {
      if (!(ev in on) && !('workflow_call' in on)) {
        add('CI_LAYER_NOT_TRIGGERED', `layer ${layer.id}: ${layer.workflow} neither triggers on ${ev} nor is callable (workflow_call)`, { layer: layer.id })
      }
    }
    for (const [ev, cfg] of Object.entries(on)) {
      if (cfg && typeof cfg === 'object' && ('paths' in cfg || 'paths-ignore' in cfg)) {
        add('CI_LAYER_PATH_FILTERED', `layer ${layer.id}: ${ev} trigger carries a paths filter — a PR outside it never runs this layer`, { layer: layer.id })
      }
    }
    if ('if' in job) {
      add('CI_LAYER_SKIPPABLE', `layer ${layer.id}: job-level if: ${JSON.stringify(job.if)} — a skipped layer reports "skipped"`, { layer: layer.id })
    }
    if (job['continue-on-error'] !== undefined && job['continue-on-error'] !== false) {
      add('CI_LAYER_CONTINUE_ON_ERROR', `layer ${layer.id}: job continue-on-error=${JSON.stringify(job['continue-on-error'])}`, { layer: layer.id })
    }
    for (const [i, step] of (job.steps ?? []).entries()) {
      if (step?.['continue-on-error'] !== undefined && step['continue-on-error'] !== false) {
        add('CI_LAYER_CONTINUE_ON_ERROR', `layer ${layer.id}: step ${String(i)} (${String(step.name ?? step.uses ?? 'unnamed')}) continue-on-error=${JSON.stringify(step['continue-on-error'])}`, { layer: layer.id })
      }
    }
    const cancel = doc?.concurrency?.['cancel-in-progress'] ?? job?.concurrency?.['cancel-in-progress'] ?? false
    if (cancel !== false && layer.cancelInProgress === false) {
      add('CI_LAYER_CANCELLABLE', `layer ${layer.id}: cancel-in-progress=${JSON.stringify(cancel)}`, { layer: layer.id })
    }
    if (!Array.isArray(layer.legs) || layer.legs.length === 0) {
      add('CI_LAYER_LEG_MISSING', `layer ${layer.id}: the manifest declares no legs — a layer with nothing to invoke gates nothing`, { layer: layer.id })
    }
    for (const leg of layer.legs ?? []) {
      const miss = gradeLeg(job, leg)
      if (miss !== null) add(miss.code, `layer ${layer.id}: leg "${leg.id}" — ${miss.why} (${layer.workflow}#${layer.job})`, { layer: layer.id, leg: leg.id })
    }
    // The merge-tree binding is a leg too: a layer that never compares its checkout to
    // the synthetic tree may be grading a different tree than the one reported.
    // Graded by the SAME allowlist as every other leg, plus: its argument must be the
    // caller's merge_tree input and the step must pass the event in.
    const bindLeg = { id: 'merge-tree-binding', cmd: ['node', 'scripts/eb3-merge-tree.mjs'], check: ['--assert-tree'] }
    const bindMiss = gradeLeg(job, bindLeg)
    const bindStep = (job.steps ?? []).find((s) => typeof s?.run === 'string' && s.run.includes('--assert-tree'))
    const bindArg = bindStep !== undefined && /--assert-tree\s+"\$\{\{\s*inputs\.merge_tree\s*\}\}"/.test(bindStep.run)
    const bindEvent = /^\$\{\{\s*github\.event_name\s*\}\}$/.test(String(bindStep?.env?.EB3_EVENT ?? '').trim())
    if (bindMiss !== null) add(bindMiss.code, `layer ${layer.id}: leg "${bindLeg.id}" — ${bindMiss.why}`, { layer: layer.id, leg: bindLeg.id })
    else if (!bindArg || !bindEvent) add('CI_LAYER_LEG_WEAKENED', `layer ${layer.id}: leg "${bindLeg.id}" — must assert "\${{ inputs.merge_tree }}" with EB3_EVENT=\${{ github.event_name }}`, { layer: layer.id, leg: bindLeg.id })
    // THE OUTPUT CONTRACT. The summary grader reads outputs.verdict; a layer that never
    // writes one would be graded `verdict-missing` and red forever, which is correct but
    // unhelpful to whoever has to fix it. Stating the rule here names the defect at its
    // source instead. The token must be derived from ${{ job.status }} so it cannot
    // report PASS for a job GitHub itself calls a failure, while still being able to say
    // something finer than `success`/`failure`.
    // THE REUSABLE-WORKFLOW BOUNDARY. `jobs.<id>.outputs` is NOT visible to a caller of a
    // reusable workflow; only `on.workflow_call.outputs` is. The rule below graded the job
    // output alone and passed four layers whose outputs never crossed the boundary — the
    // hosted aggregate then reported verdict-missing for all of them while every layer job
    // was green (run 40346069026). Grading the boundary is a separate rule because it is a
    // separate mechanism.
    const wc = (doc.on ?? doc[true])?.workflow_call
    const boundary = wc?.outputs?.verdict
    if (boundary === undefined) {
      add('CI_WORKFLOW_CALL_OUTPUT_MISSING', `layer ${layer.id}: ${layer.workflow} declares no on.workflow_call.outputs.verdict, so its verdict cannot reach the Required summary (a job-level outputs: does not cross a reusable-workflow boundary)`, { layer: layer.id })
    } else {
      const want = `jobs.${layer.job}.outputs.verdict`
      if (!String(boundary.value ?? '').includes(want)) {
        add('CI_WORKFLOW_CALL_OUTPUT_MISSING', `layer ${layer.id}: on.workflow_call.outputs.verdict must read \${{ ${want} }}; it reads ${JSON.stringify(boundary.value ?? null)}`, { layer: layer.id })
      }
    }
    if (!('outputs' in job) || !('verdict' in (job.outputs ?? {}))) {
      add('CI_LAYER_VERDICT_OUTPUT_MISSING', `layer ${layer.id}: ${layer.workflow}#${layer.job} declares no outputs.verdict — the Required summary cannot grade it`, { layer: layer.id })
    } else {
      // The value must be BOUND to something a step computed from job.status — either
      // inline `job.status` or a `steps.<id>.outputs.*` produced by an `if: always()`
      // step that reads it. An unbound literal (`verdict: PASS`) is the failure this
      // rule exists for: it reports PASS for a job GitHub calls a failure.
      const v = String(job.outputs.verdict)
      const bound = v.includes('job.status') || /steps\.([A-Za-z0-9_-]+)\.outputs\./.test(v)
      if (!bound) {
        add('CI_LAYER_VERDICT_OUTPUT_UNBOUND', `layer ${layer.id}: outputs.verdict=${JSON.stringify(v)} is not bound to job.status, so it can report PASS for a job GitHub calls a failure`, { layer: layer.id })
        continue
      }
      const stepId = /steps\.([A-Za-z0-9_-]+)\.outputs\./.exec(v)?.[1]
      if (stepId !== undefined) {
        const step = (job.steps ?? []).find((s) => s?.id === stepId)
        if (step === undefined) {
          add('CI_LAYER_VERDICT_OUTPUT_UNBOUND', `layer ${layer.id}: outputs.verdict reads steps.${stepId}.* but no step carries that id`, { layer: layer.id })
        } else if (!isAlwaysCondition(step.if)) {
          add('CI_LAYER_VERDICT_OUTPUT_UNBOUND', `layer ${layer.id}: the step producing the verdict (${stepId}) if=${JSON.stringify(step.if ?? null)} is not un-falsifiable always() — on a failed layer it never runs, the output is empty, and the summary cannot distinguish that from a green one`, { layer: layer.id })
        } else if (!computesFromJobStatus(step.run)) {
          // Mentioning `${ { job.status } }` in a shell comment or a string, then writing a
          // constant, is the evasion this closes: the value must be read as an EXPRESSION
          // (a `case`/`if` on it, or a `${{ … job.status … }}` feeding the value).
          add('CI_LAYER_VERDICT_OUTPUT_UNBOUND', `layer ${layer.id}: the verdict step (${stepId}) does not COMPUTE its value from job.status (a comment or a string mentioning it does not count)`, { layer: layer.id })
        }
      }
    }
  }

  // ── the summary (synthetic merge tree) job — the one Required context
  const agg = manifest.aggregate
  const aggDoc = docs.get(agg.workflow)
  const summary = jobAt(agg.workflow, agg.job)
  if (summary === null) {
    add('CI_REQUIRED_JOB_ABSENT', `summary: job "${agg.job}" not found in ${agg.workflow}`, { layer: 'aggregate', job: agg.job })
  } else {
    const on = triggersOf(aggDoc)
    if (!('pull_request' in on)) add('CI_LAYER_NOT_TRIGGERED', `summary: ${agg.workflow} does not trigger on pull_request`, { layer: 'aggregate' })
    for (const [ev, cfg] of Object.entries(on)) {
      if (cfg && typeof cfg === 'object' && ('paths' in cfg || 'paths-ignore' in cfg)) {
        add('CI_LAYER_PATH_FILTERED', `summary: ${ev} trigger carries a paths filter — the Required context would be ABSENT on PRs outside it`, { layer: 'aggregate' })
      }
    }
    const aggCancel = aggDoc?.concurrency?.['cancel-in-progress'] ?? false
    if (aggCancel !== false) add('CI_LAYER_CANCELLABLE', `summary: ${agg.workflow} cancel-in-progress=${JSON.stringify(aggCancel)}`, { layer: 'aggregate' })
    // `always()` must be the WHOLE condition (allowing `${{ }}` and `always() && success()`
    // style conjunctions only of things that cannot be false). `always() && false` contains
    // the word and never runs — the R1 review's shape, and my own C11-a.
    const ifText = String(summary.if ?? '').trim().replace(/^\$\{\{/, '').replace(/\}\}$/, '').trim()
    const ifParts = ifText.split('&&').map((x) => x.trim())
    if (!ifParts.includes('always()') || ifParts.some((x) => /^!/.test(x) || /\bfalse\b/.test(x))) {
      add('CI_SUMMARY_NOT_ALWAYS', `summary: ${agg.job} if=${JSON.stringify(summary.if ?? null)} — the condition must BE always() (or always() && <unfalsifiable>); a failed layer would SKIP the summary`, { layer: 'aggregate' })
    }
    if (summary['continue-on-error'] !== undefined && summary['continue-on-error'] !== false) {
      add('CI_LAYER_CONTINUE_ON_ERROR', `summary: continue-on-error=${JSON.stringify(summary['continue-on-error'])}`, { layer: 'aggregate' })
    }
    const needs = Array.isArray(summary.needs) ? summary.needs : summary.needs ? [summary.needs] : []
    // `synthesize` must be in needs too: a merge CONFLICT happens there, and a summary
    // that does not need it would be skipped-on-failure-free of that outcome.
    for (const g of agg.gradedNeeds ?? []) {
      if (!needs.includes(g)) add('CI_SUMMARY_NEEDS_INCOMPLETE', `summary: ${agg.job}.needs omits graded need "${g}" declared in ${MANIFEST_REL}`, { layer: 'aggregate' })
    }
    if (!(agg.gradedNeeds ?? []).includes('synthesize')) {
      add('CI_SUMMARY_NEEDS_INCOMPLETE', `summary: ${MANIFEST_REL} aggregate.gradedNeeds omits "synthesize" — the synthetic merge tree would be ungraded`, { layer: 'aggregate' })
    }
    if (!needs.includes('synthesize')) {
      add('CI_SUMMARY_NEEDS_INCOMPLETE', `summary: ${agg.job}.needs omits "synthesize" — a merge conflict would not reach the Required verdict`, { layer: 'aggregate' })
    }
    // Layers are separate workflow FILES; one check context can only see them if the
    // summary workflow CALLS each as a reusable workflow and `needs` that caller.
    const aggJobs = aggDoc?.jobs ?? {}
    for (const layer of manifest.layers) {
      const caller = Object.entries(aggJobs).find(([, j]) => typeof j?.uses === 'string' && j.uses.replace(/@.*$/, '') === `./${layer.workflow}`)
      if (caller === undefined) {
        add('CI_SUMMARY_NEEDS_INCOMPLETE', `summary: ${agg.workflow} has no job calling ./${layer.workflow} — layer ${layer.id} is invisible to the Required context`, { layer: layer.id })
        continue
      }
      if ('if' in caller[1]) {
        add('CI_LAYER_SKIPPABLE', `summary: caller "${caller[0]}" of layer ${layer.id} carries if: ${JSON.stringify(caller[1].if)}`, { layer: layer.id })
      }
      if (!needs.includes(caller[0])) {
        add('CI_SUMMARY_NEEDS_INCOMPLETE', `summary: ${agg.job}.needs omits "${caller[0]}" (layer ${layer.id}) — that layer can fail while the summary stays green`, { layer: layer.id })
      }
    }
    // Same invocation law as the layers (this was a substring rule too — R1 finding 4):
    // a step must EXECUTE `node scripts/eb3-merge-tree.mjs --grade-needs`, unweakened,
    // and that step's env must bind EB3_NEEDS_JSON to toJSON(needs) exactly.
    // The grader leg is graded by the SAME allowlist, and must take "$EB3_NEEDS_JSON"
    // as the --grade-needs VALUE (check list: the flag, then the variable as its own
    // token), with that env bound exactly to toJSON(needs).
    const gradeLegSpec = { cmd: ['node', 'scripts/eb3-merge-tree.mjs'], check: ['--grade-needs', '$EB3_NEEDS_JSON'] }
    const gradeStep = (summary.steps ?? []).find((s) => typeof s?.run === 'string' && gradeLeg({ steps: [s] }, gradeLegSpec) === null)
    const needsBound = gradeStep !== undefined
      && /^\$\{\{\s*toJSON\(\s*needs\s*\)\s*\}\}$/.test(String(gradeStep.env?.EB3_NEEDS_JSON ?? '').trim())
    // The synthesize job must EXECUTE the merge-tree script (same invocation law).
    const synth = aggDoc?.jobs?.synthesize
    const synthMiss = synth === undefined ? { code: 'CI_SUMMARY_NOT_SYNTHESIZING', why: 'no synthesize job' }
      : gradeLeg(synth, { cmd: ['node', 'scripts/eb3-merge-tree.mjs'], check: ['--synthesize'] })
    if (synthMiss !== null) {
      add(synthMiss.code === 'CI_LAYER_LEG_WEAKENED' ? 'CI_SUMMARY_NOT_SYNTHESIZING' : 'CI_SUMMARY_NOT_SYNTHESIZING', `summary: synthesize job — ${synthMiss.why}`, { layer: 'aggregate' })
    }
    if (!needsBound) {
      add('CI_SUMMARY_NOT_GRADING', `summary: no step executes \`node scripts/eb3-merge-tree.mjs --grade-needs "$EB3_NEEDS_JSON"\` with EB3_NEEDS_JSON=\${{ toJSON(needs) }} unweakened — it cannot tell success from skipped/cancelled`, { layer: 'aggregate' })
    }
  }

  // ── every job the manifest DECLARES (required or not) must still exist.
  // knownNonRequired entries are declarations too: a declared informational job that
  // silently vanishes (census-runtime deleted, say) is drift in the CI's own description
  // of itself, and the C2 baseline showed the existing gate saw nothing when it happened.
  for (const k of manifest.knownNonRequired ?? []) {
    if (jobAt(k.workflow, k.job) === null) {
      add('CI_DECLARED_JOB_ABSENT', `declared non-required job ${k.workflow}#${k.job} is gone — remove it from ${MANIFEST_REL} in the same change if that is intended, so the removal is a reviewed line`, { job: k.job })
    }
  }

  // ── every workflow job must be declared somewhere
  const declared = new Set([
    ...manifest.layers.map((l) => `${l.workflow}#${l.job}`),
    ...[agg.job, ...(agg.jobs ?? [])].map((j) => `${agg.workflow}#${j}`),
    ...(manifest.knownNonRequired ?? []).map((k) => `${k.workflow}#${k.job}`),
  ])
  const layerFiles = new Set(manifest.layers.map((l) => `./${l.workflow}`))
  for (const [path, doc] of docs) {
    for (const [jobId, job] of Object.entries(doc?.jobs ?? {})) {
      if (declared.has(`${path}#${jobId}`)) continue
      if (path === agg.workflow && typeof job?.uses === 'string' && layerFiles.has(job.uses.replace(/@.*$/, ''))) continue
      add('CI_JOB_UNDECLARED', `${path}#${jobId} is not declared in ${MANIFEST_REL} — its Required status would be invisible`, { job: jobId })
    }
  }

  return { findings }
}

export const REQUIRED_JOBS = (() => {
  const m = loadManifest()
  return [...m.layers, { ...m.aggregate, id: 'aggregate' }]
})()

/** `.github/workflows/*.yml` of a root as a path→text map. */
export function workflowFiles(root = ROOT) {
  const dir = join(root, '.github/workflows')
  const map = new Map()
  for (const f of readdirSync(dir).sort()) {
    if (!/\.ya?ml$/.test(f)) continue
    map.set(`.github/workflows/${f}`, readFileSync(join(dir, f), 'utf8'))
  }
  return map
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) {
  const json = process.argv.includes('--json')
  let out
  try {
    const files = workflowFiles(ROOT)
    const wf = checkRequiredJobs({ files })
    const sl = checkSuiteLists({ root: ROOT })
    out = { files: files.size, findings: [...wf.findings, ...sl.findings] }
  } catch (e) {
    console.error(`EB3-CI-REQUIRED refused could-not-grade: ${String(e?.message ?? e)}`)
    process.exit(2)
  }
  if (json) console.log(JSON.stringify(out, null, 2))
  else {
    for (const f of out.findings) console.log(`  ${f.code} ${f.detail}`)
    console.log(`EB3-CI-REQUIRED ${out.findings.length === 0 ? 'pass' : 'fail'} workflows=${String(out.files)} findings=${String(out.findings.length)}`)
  }
  process.exit(out.findings.length === 0 ? 0 : 1)
}
