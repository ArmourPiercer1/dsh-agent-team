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
 *   CI_LAYER_LEG_MISSING        a mandatory leg the manifest names is not invoked by the layer
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
 * quoted `if: "false"` must not escape a line regex.
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
import { readFileSync, readdirSync } from 'node:fs'
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

function stepsText(job) {
  return (Array.isArray(job?.steps) ? job.steps : [])
    .map((s) => `${String(s?.run ?? '')}\n${JSON.stringify(s?.with ?? {})}\n${JSON.stringify(s?.env ?? {})}`)
    .join('\n')
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
    const text = stepsText(job)
    for (const leg of layer.mandatoryLegs ?? []) {
      if (!text.includes(leg)) {
        add('CI_LAYER_LEG_MISSING', `layer ${layer.id}: mandatory leg "${leg}" is not invoked by any step of ${layer.workflow}#${layer.job}`, { layer: layer.id, leg })
      }
    }
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
        } else if (!/\balways\(\)/.test(String(step.if ?? ''))) {
          add('CI_LAYER_VERDICT_OUTPUT_UNBOUND', `layer ${layer.id}: the step producing the verdict (${stepId}) is not if: always() — on a failed layer it never runs, the output is empty, and the summary cannot distinguish that from a green one`, { layer: layer.id })
        } else if (!String(step.run ?? '').includes('job.status')) {
          add('CI_LAYER_VERDICT_OUTPUT_UNBOUND', `layer ${layer.id}: the verdict step (${stepId}) does not read job.status`, { layer: layer.id })
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
    if (!/\balways\(\)/.test(String(summary.if ?? ''))) {
      add('CI_SUMMARY_NOT_ALWAYS', `summary: ${agg.job} if=${JSON.stringify(summary.if ?? null)} — without always() a failed layer SKIPS the summary`, { layer: 'aggregate' })
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
    const sText = stepsText(summary)
    if (!/toJSON\(\s*needs\s*\)/.test(sText) || !sText.includes('eb3-merge-tree.mjs') || !sText.includes('--grade-needs')) {
      add('CI_SUMMARY_NOT_GRADING', `summary: ${agg.job} must pass toJSON(needs) to scripts/eb3-merge-tree.mjs --grade-needs; otherwise it cannot tell success from skipped/cancelled`, { layer: 'aggregate' })
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
    out = { files: files.size, ...checkRequiredJobs({ files }) }
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
