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


// ───────────────────────────────────────────────── leg invocation (R1 review blocker)
//
// THE FIRST RULE WAS A SUBSTRING SEARCH, and it was a green light wired to nothing:
// `stepsText(job).includes(leg)` matched `echo docs:sync --check`, a `# node …` shell
// comment, a step `name:`, or the census invocation carrying `--allow-refused census`.
// The PR #395 R1 review proved the echo evasion. The rule below grades what a step
// would EXECUTE.
//
// WHAT IS PARSED, AND THE YAML FACT IT RESTS ON (measured with the `yaml` package, not
// assumed): a `#` line BETWEEN steps is a YAML comment and is gone after parsing — a
// commented-out step simply does not exist, so it can invoke nothing. A `#` line INSIDE
// a `run: |` block is part of the script STRING the parser returns, so this code strips
// shell comments itself. `name:` is never read.
//
// HOW A SCRIPT BECOMES COMMANDS: line continuations are joined; each line is split on
// the shell list/pipe operators (`;`, `&&`, `||`, `|`) OUTSIDE quotes; each piece is
// tokenised with quote removal; leading `VAR=value` assignments and the wrappers `env`,
// `exec`, `time` are dropped; the first word is the command. An invocation counts only
// when it is a COMMAND (so `echo node scripts/x.mjs` is `echo`, and a quoted string
// handed to printf is an argument). A command whose failure is swallowed — followed by
// `|| true`/`|| :`, or inside a pipeline whose status the step does not take
// (`set -o pipefail` absent) — is WEAKENED, not missing, and is named as such.
//
// NOT A SHELL. This is a conservative reader of the shapes these workflows use: a
// construct it does not understand (an `eval`, a function defined and called later, a
// heredoc-fed interpreter) never SATISFIES a leg — it can only fail to find one, which
// is the safe direction. Command substitution `$( … )` is not entered: an invocation
// whose output is captured is not one whose exit code gates the step.

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

/** Split a shell line on top-level `;` `&&` `||` `|`, outside quotes. Returns
 *  [{ text, op }] where op is the operator FOLLOWING the piece (or null). */
function splitShellList(line) {
  const out = []
  let cur = ''
  let q = null
  let depth = 0 // $( … ) nesting — operators inside a substitution are not top-level
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i]
    const n = line[i + 1]
    if (q !== null) {
      cur += c
      if (c === '\\' && q === '"') { cur += n ?? ''; i += 1; continue }
      if (c === q) q = null
      continue
    }
    if (c === "'" || c === '"') { q = c; cur += c; continue }
    if (c === '\\') { cur += c + (n ?? ''); i += 1; continue }
    if (c === '$' && n === '(') { depth += 1; cur += '$('; i += 1; continue }
    if (c === ')' && depth > 0) { depth -= 1; cur += c; continue }
    if (depth === 0) {
      if ((c === '&' && n === '&') || (c === '|' && n === '|')) { out.push({ text: cur, op: c + n }); cur = ''; i += 1; continue }
      if (c === ';' || c === '|') { out.push({ text: cur, op: c }); cur = ''; continue }
      if (c === '#' && (cur === '' || /\s$/.test(cur))) break // shell comment to end of line
    }
    cur += c
  }
  out.push({ text: cur, op: null })
  return out.filter((p) => p.text.trim() !== '')
}

/** Tokenise one simple command with quote removal. */
function tokenize(text) {
  const toks = []
  let cur = ''
  let had = false
  let q = null
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]
    if (q !== null) {
      if (c === q) { q = null; continue }
      if (c === '\\' && q === '"' && i + 1 < text.length) { cur += text[i + 1]; i += 1; continue }
      cur += c
      continue
    }
    if (c === "'" || c === '"') { q = c; had = true; continue }
    if (c === '\\' && i + 1 < text.length) { cur += text[i + 1]; i += 1; had = true; continue }
    if (/\s/.test(c)) { if (had || cur !== '') { toks.push(cur); cur = ''; had = false } continue }
    cur += c
    had = true
  }
  if (had || cur !== '') toks.push(cur)
  return toks
}

/** Every executed simple command in a `run:` script: { argv, swallowed, piped }. */
export function commandsOf(script) {
  const joined = String(script ?? '').replace(/\\\r?\n/g, ' ')
  const pipefail = /\bset\s+(?:-[a-z]*o\s+pipefail|-o\s+pipefail|-euo\s+pipefail|-eo\s+pipefail)\b|\bset\s+-o\s+pipefail\b/.test(joined)
  const cmds = []
  for (const rawLine of joined.split(/\r?\n/)) {
    if (/^\s*#/.test(rawLine)) continue
    const pieces = splitShellList(rawLine)
    for (let i = 0; i < pieces.length; i += 1) {
      let argv = tokenize(pieces[i].text)
      while (argv.length > 0 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(argv[0])) argv = argv.slice(1)
      while (argv.length > 0 && ['env', 'exec', 'time', 'command'].includes(argv[0])) argv = argv.slice(1)
      if (argv.length === 0) continue
      const next = pieces[i].op
      const after = pieces[i + 1] !== undefined ? tokenize(pieces[i + 1].text) : []
      const swallowed = next === '||' && ['true', ':'].includes(after[0])
      // A command on the LEFT of a pipe gates the step only under pipefail.
      const piped = next === '|' && !pipefail
      cmds.push({ argv, swallowed, piped })
    }
  }
  return cmds
}

/** Does argv invoke `want` (a command prefix, e.g. ['node','scripts/x.mjs'])? */
function invokes(argv, want) {
  if (argv.length < want.length) return false
  return want.every((w, i) => argv[i] === w)
}

/**
 * Grade one leg against one job. Returns null when satisfied, otherwise a finding.
 * The leg is satisfied by the FIRST matching invocation that carries every required
 * flag and none of the forbidden ones, and whose failure reaches the step.
 */
export function gradeLeg(job, leg) {
  const steps = Array.isArray(job?.steps) ? job.steps : []
  const seen = []
  for (const step of steps) {
    if (typeof step?.run !== 'string') continue
    // A step that may be skipped does not run the leg on every PR.
    const skippable = 'if' in step && !/^\s*(?:\$\{\{\s*)?(?:always\(\)|success\(\))(?:\s*\}\})?\s*$/.test(String(step.if))
    for (const c of commandsOf(step.run)) {
      if (!invokes(c.argv, leg.cmd)) continue
      const rest = c.argv.slice(leg.cmd.length)
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
      if (c.swallowed) problems.push('failure swallowed by `|| true`')
      if (c.piped) problems.push('left of a pipe without `set -o pipefail` — its exit code never reaches the step')
      if (skippable) problems.push(`step has a conditional if: ${JSON.stringify(step.if)}`)
      if (problems.length === 0) return null
      seen.push(`${String(step.name ?? 'unnamed step')}: ${problems.join(', ')}`)
    }
  }
  return seen.length === 0
    ? { code: 'CI_LAYER_LEG_MISSING', why: `no step EXECUTES \`${leg.cmd.join(' ')}\` (echoes, step names, comments and quoted strings do not count)` }
    : { code: 'CI_LAYER_LEG_WEAKENED', why: `\`${leg.cmd.join(' ')}\` is invoked but weakened — ${seen.join(' ;; ')}` }
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
    const bindLeg = { id: 'merge-tree-binding', cmd: ['['] }
    const binds = (job.steps ?? []).some((s) => typeof s?.run === 'string'
      && commandsOf(s.run).some((c) => c.argv[0] === '[' && c.argv.includes('$GOT') && c.argv.includes('$EB3_MERGE_TREE'))
      && JSON.stringify(s.env ?? {}).includes('inputs.merge_tree'))
    if (!binds) add('CI_LAYER_LEG_MISSING', `layer ${layer.id}: leg "${bindLeg.id}" — no step compares HEAD^{tree} with inputs.merge_tree`, { layer: layer.id, leg: bindLeg.id })
    // THE OUTPUT CONTRACT. The summary grader reads outputs.verdict; a layer that never
    // writes one would be graded `verdict-missing` and red forever, which is correct but
    // unhelpful to whoever has to fix it. Stating the rule here names the defect at its
    // source instead. The token must be derived from ${{ job.status }} so it cannot
    // report PASS for a job GitHub itself calls a failure, while still being able to say
    // something finer than `success`/`failure`.
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
    const gradeStep = (summary.steps ?? []).find((s) => typeof s?.run === 'string'
      && gradeLeg({ steps: [s] }, { cmd: ['node', 'scripts/eb3-merge-tree.mjs'], check: ['--grade-needs'] }) === null)
    const needsBound = gradeStep !== undefined
      && /^\$\{\{\s*toJSON\(\s*needs\s*\)\s*\}\}$/.test(String(gradeStep.env?.EB3_NEEDS_JSON ?? '').trim())
      && commandsOf(gradeStep.run).some((c) => c.argv[0] === 'node' && c.argv.includes('$EB3_NEEDS_JSON'))
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
