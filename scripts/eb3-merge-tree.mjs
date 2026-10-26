#!/usr/bin/env node
/**
 * eb3-merge-tree.mjs — EB3-C: the synthetic merge tree, and the grader of the one
 * Required context.
 *
 * THE PLAN, VERBATIM: "合成 merge tree Required（缺席、skip、ENV_BLOCK、refused、
 * cancel 不能绿）" — a synthetic merge tree is Required, and absence, skip,
 * ENV_BLOCK, refused and cancel may NOT be green.
 *
 * TWO JOBS, ONE FILE.
 *
 *   --synthesize --base <ref> [--head <ref>]
 *       Builds the merge of base and head WITHOUT touching any branch:
 *       `git merge-tree --write-tree` yields the merged TREE; `git commit-tree`
 *       wraps it in a parentless-of-HEAD commit with parents (base, head); the
 *       commit is printed. Conflicts are a hard refusal (exit 1, never "skip the
 *       merge check"). The workflow checks this commit out and runs every layer on
 *       it — so what is graded is what WOULD land, not the branch in isolation
 *       (the caliber ruling already recorded for the census: "the CI census grades
 *       the PR MERGE-REF"). Pull-request runners already check out GitHub's
 *       `refs/pull/N/merge`; this mode makes the same thing true locally and for
 *       push/dispatch runs, and records the tree id so the two can be compared.
 *
 *   --grade-needs <json>          (or env EB3_NEEDS_JSON)
 *       Grades `toJSON(needs)` from the summary job. EVERY declared layer must be
 *       present with result `success`. Anything else — `failure`, `cancelled`,
 *       `skipped`, a layer missing from `needs` entirely, or an empty `needs` — is
 *       a FAIL, each with its own class so the reader knows WHICH non-green it was.
 *       Layers additionally publish an `outputs.verdict` token; a layer whose job
 *       succeeded while its token says ENV_BLOCK / REFUSED / SKIP is a FAIL too —
 *       that is the shape of a step that printed a disclosure and exited 0.
 *
 * NO STATE IS GREEN BY DEFAULT. The grader enumerates the GREEN state (success +
 * verdict=PASS) and fails everything else; it never enumerates the red states and
 * passes the rest. A new GitHub result value (there have been additions before)
 * therefore fails closed.
 *
 * Verdict channel:
 *   EB3-MERGE-TREE tree=<sha> commit=<sha> base=<sha> head=<sha>
 *   EB3-REQUIRED <pass|fail> layers=<n> green=<n> nongreen=<id:class,...|none>
 *
 * Exported for scripts/eb3-ci-negative-controls.mjs:
 *   gradeNeeds({ needs, manifest? }) → { verdict, rows }
 *   synthesizeMergeTree({ root, base, head }) → { tree, commit, base, head }
 *   GREEN_RESULT, GREEN_VERDICT
 *
 * Exit: 0 pass | 1 fail | 2 could not grade (bad JSON, unresolvable refs).
 *
 * @module scripts/eb3-merge-tree
 */
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
// The DEPENDENCY-FREE loader, not eb3-ci-required.mjs: that one imports the `yaml`
// package, and this grader runs in a job that installs nothing (a red gate must not be
// able to become an install error dressed as a layer failure).
import { loadManifest } from './eb3-ci-manifest.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

/** The ONLY green job result. */
export const GREEN_RESULT = 'success'
/** The ONLY green layer verdict token. */
export const GREEN_VERDICT = 'PASS'

/**
 * Grade the summary job's `needs` context against the manifest.
 *
 * @param {object} p
 * @param {object} p.needs     parsed toJSON(needs): { <callerJobId>: { result, outputs } }
 * @param {object} [p.manifest]
 * @param {object} [p.callerOf] layer id → caller job id in the summary workflow
 */
export function gradeNeeds({ needs, manifest = loadManifest(), callerOf = defaultCallers(manifest) }) {
  const rows = []
  if (needs === null || typeof needs !== 'object' || Array.isArray(needs)) {
    return { verdict: 'fail', rows: [{ layer: '*', klass: 'needs-unreadable', detail: `needs is ${Array.isArray(needs) ? 'an array' : typeof needs}` }] }
  }
  for (const layer of manifest.layers) {
    const caller = callerOf[layer.id]
    const entry = needs[caller]
    if (entry === undefined) {
      rows.push({ layer: layer.id, klass: 'absent', detail: `no needs.${String(caller)} — the layer never reported to the Required context` })
      continue
    }
    const result = String(entry.result ?? '')
    if (result !== GREEN_RESULT) {
      // Name the class by the observed value; an unrecognised value is still red.
      const klass = ['failure', 'cancelled', 'skipped'].includes(result) ? result : `unrecognised-result:${result || 'empty'}`
      rows.push({ layer: layer.id, klass, detail: `needs.${caller}.result=${result || '(empty)'}` })
      continue
    }
    const verdict = String(entry.outputs?.verdict ?? '')
    if (verdict !== GREEN_VERDICT) {
      // A job that SUCCEEDED while its own verdict token says otherwise: the step
      // printed a disclosure (ENV_BLOCK / REFUSED / SKIP) and exited 0, or never
      // wrote a token at all. Both are red here.
      const klass = verdict === '' ? 'verdict-missing' : `verdict-${verdict.toLowerCase()}`
      rows.push({ layer: layer.id, klass, detail: `needs.${caller}.result=success but outputs.verdict=${verdict || '(missing)'}` })
      continue
    }
    rows.push({ layer: layer.id, klass: 'green', detail: 'success + verdict=PASS' })
  }
  const extra = Object.keys(needs).filter((k) => !Object.values(callerOf).includes(k))
  for (const k of extra) rows.push({ layer: k, klass: 'info-undeclared-need', detail: 'a need the manifest does not declare (not graded)' })
  const nonGreen = rows.filter((r) => r.klass !== 'green' && !r.klass.startsWith('info-'))
  return { verdict: nonGreen.length === 0 && rows.some((r) => r.klass === 'green') ? 'pass' : 'fail', rows }
}

/** Caller job ids in the summary workflow: `<layer id>` by convention (ci-fast → ci-fast). */
function defaultCallers(manifest) {
  return Object.fromEntries(manifest.layers.map((l) => [l.id, l.id]))
}

/**
 * Build the synthetic merge commit of base and head without moving any ref.
 * Throws with a named reason on conflict or unresolvable refs.
 */
export function synthesizeMergeTree({ root = ROOT, base, head = 'HEAD' }) {
  const git = (args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  const baseSha = git(['rev-parse', '--verify', `${base}^{commit}`])
  const headSha = git(['rev-parse', '--verify', `${head}^{commit}`])
  let tree
  try {
    // --write-tree prints the tree id on line 1; on conflict it exits 1 and lists them.
    tree = git(['merge-tree', '--write-tree', '--no-messages', baseSha, headSha]).split('\n')[0]
  } catch (e) {
    const out = String(e?.stdout ?? '') + String(e?.stderr ?? '')
    throw new Error(`MERGE_CONFLICT base=${baseSha.slice(0, 12)} head=${headSha.slice(0, 12)}: ${out.split('\n').slice(0, 6).join(' | ')}`)
  }
  if (!/^[0-9a-f]{40,64}$/.test(tree)) throw new Error(`MERGE_TREE_UNREADABLE: git merge-tree printed ${JSON.stringify(tree)}`)
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 'eb3-merge-tree', GIT_AUTHOR_EMAIL: 'eb3-merge-tree@invalid',
    GIT_COMMITTER_NAME: 'eb3-merge-tree', GIT_COMMITTER_EMAIL: 'eb3-merge-tree@invalid',
    // Deterministic: the same (base, head) yields the same synthetic commit id.
    GIT_AUTHOR_DATE: '1970-01-01T00:00:00Z', GIT_COMMITTER_DATE: '1970-01-01T00:00:00Z',
  }
  const commit = execFileSync('git', ['-C', root, 'commit-tree', tree, '-p', baseSha, '-p', headSha, '-m', `eb3 synthetic merge tree of ${baseSha} + ${headSha}`], { encoding: 'utf8', env }).trim()
  return { tree, commit, base: baseSha, head: headSha }
}

// ───────────────────────────────────────────────────────────────────────── CLI
const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) {
  const argv = process.argv.slice(2)
  const arg = (name) => { const i = argv.indexOf(name); return i > -1 ? argv[i + 1] : null }

  if (argv.includes('--synthesize')) {
    const base = arg('--base')
    if (base === null) { console.error('EB3-MERGE-TREE REFUSED NO_BASE: a merge tree without a base is not a merge tree'); process.exit(2) }
    try {
      const r = synthesizeMergeTree({ root: ROOT, base, head: arg('--head') ?? 'HEAD' })
      console.log(`EB3-MERGE-TREE tree=${r.tree} commit=${r.commit} base=${r.base} head=${r.head}`)
      const out = argv.includes('--github-output') ? process.env['GITHUB_OUTPUT'] : undefined
      if (argv.includes('--github-output') && out === undefined) {
        console.error('EB3-MERGE-TREE REFUSED: --github-output needs $GITHUB_OUTPUT')
        process.exit(2)
      }
      if (out !== undefined) {
        const { appendFileSync } = await import('node:fs')
        appendFileSync(out, `tree=${r.tree}\ncommit=${r.commit}\nbase=${r.base}\nhead=${r.head}\n`)
      }
      process.exit(0)
    } catch (e) {
      const msg = String(e?.message ?? e)
      console.error(`EB3-MERGE-TREE ${msg.startsWith('MERGE_CONFLICT') ? 'fail' : 'REFUSED'} ${msg}`)
      process.exit(msg.startsWith('MERGE_CONFLICT') ? 1 : 2)
    }
  }

  if (argv.includes('--grade-needs')) {
    const raw = arg('--grade-needs') ?? process.env['EB3_NEEDS_JSON'] ?? null
    if (raw === null || raw.trim() === '') {
      // Absence of the needs context is absence of every layer: red, not "nothing to grade".
      console.log('EB3-REQUIRED fail layers=0 green=0 nongreen=*:needs-absent')
      process.exit(1)
    }
    let needs
    try { needs = JSON.parse(raw) } catch (e) {
      console.log(`EB3-REQUIRED fail layers=0 green=0 nongreen=*:needs-unparseable (${String(e?.message ?? e).slice(0, 80)})`)
      process.exit(1)
    }
    const g = gradeNeeds({ needs })
    for (const r of g.rows) console.log(`  ${r.layer.padEnd(16)} ${r.klass.padEnd(22)} ${r.detail}`)
    const graded = g.rows.filter((r) => !r.klass.startsWith('info-'))
    const green = graded.filter((r) => r.klass === 'green')
    const non = graded.filter((r) => r.klass !== 'green').map((r) => `${r.layer}:${r.klass}`)
    console.log(`EB3-REQUIRED ${g.verdict} layers=${String(graded.length)} green=${String(green.length)} nongreen=${non.join(',') || 'none'}`)
    process.exit(g.verdict === 'pass' ? 0 : 1)
  }

  console.error('usage: eb3-merge-tree.mjs --synthesize --base <ref> [--head <ref>] | --grade-needs <json>')
  process.exit(2)
}
