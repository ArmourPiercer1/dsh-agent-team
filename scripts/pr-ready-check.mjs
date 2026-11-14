#!/usr/bin/env node
/**
 * pr-ready-check — the machine half of the draft-first protocol
 * (`docs/runbooks/PR-DRAFT-FIRST.md` §3, criteria C1–C7).
 *
 * WHY THIS EXISTS. The L1/L2 split only saves time if a PR is created as a
 * draft and flipped to ready exactly once, on a frozen head, after the
 * settlement comment covers that head. Measurement on 2026-11-13: 12 of the
 * last 12 merged PRs were created ready, ran `ci-required` a median of two
 * times, and each extra run is a full census (~24 min). The discipline was
 * written down; nothing checked it. This script checks the machine-checkable
 * subset before `gh pr ready`, so a premature flip is refused locally instead
 * of costing 24 minutes on a runner.
 *
 * WHAT IT GATES (all against the CURRENT head sha):
 *   R1 the PR is still a draft                       (refuse ALREADY_READY)
 *   R2 no open-state marker in title / body line 1   (refuse MARKER_PRESENT)
 *   R3 mergeable state is known and not BEHIND/DIRTY (refuse STATE_UNKNOWN etc.)
 *   R4 ci-fast / ci-integration / ci-security / ci-product are green
 *   R5 ci-required-deferred is green                 (the L1 verdict)
 *   R6 ci-census is skipped                          (a census now = a second L2)
 *   R7 a dated settlement covers the current head    (reuses pr-settlement-gate)
 *   R8 the local checkout IS the PR head, is pushed, and is clean
 *   R9 no `ci-defer-full` label                      (a deferred census is not L2)
 *
 * M0 (TINF, 2026-11-14) removed five false-PASS paths the design review named
 * (`docs/plans/memo/agent-testing-infrastructure-20261114/10-GITHUB-ACTIONS-INTEGRATION.md` §3):
 *   1. an unknown/absent `mergeable_state` used to be a NOTE and still passed;
 *      it is now a refusal — "GitHub has not computed mergeability" is not a
 *      fact about the branch;
 *   2. the local HEAD was never compared with the PR head, so a stale worktree
 *      graded its own branch and called it the PR's;
 *   3. a missing upstream was read as "0 commits ahead", i.e. as pushed;
 *   4. a newer pending/queued check-run was invisible (only completed runs were
 *      sorted), so an older success could be read as this head's verdict;
 *   5. comments were fetched as a single page of 100, so a settlement older
 *      than the last 100 comments read as missing (the server-side gate
 *      paginates; a local pre-check that disagrees with it refuses a green PR).
 * Plus R9: with `ci-defer-full` present a ready flip still skips the census, so
 * the "exactly one L2" promise cannot be kept on that head.
 *
 * WHAT IT DELIBERATELY DOES NOT GATE: review-thread resolution (a human/
 * reviewer judgement), docs content, and whether the change is any good. A
 * READY verdict means "the machine-visible preconditions hold", not "this
 * should merge".
 *
 * USAGE
 *   node scripts/pr-ready-check.mjs --pr 759 [--json] [--no-git]
 *   node scripts/pr-ready-check.mjs --input fixture.json      # offline, tests
 *   node scripts/pr-ready-check.mjs --self-test               # no network
 *
 * EXIT 0 READY · 1 REFUSED (the PR is not ready; reasons printed) · 2 ERROR
 * (fetch/parse failure — a refusal, never a silent pass).
 */
import process from 'node:process'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { detectMarker, findSettlement } from './pr-settlement-gate.mjs'

export const LAYERS = ['ci-fast', 'ci-integration', 'ci-security', 'ci-product']
export const DEFERRED = 'ci-required-deferred'
export const CENSUS = 'ci-census'
export const DEFER_LABEL = 'ci-defer-full'

const SHA40 = /^[0-9a-f]{40}$/

/** A check-run name from the API may be "ci-fast / ci-fast" or "ci-fast". */
function sameCheck(name, wanted) {
  return name === wanted || name.startsWith(`${wanted} / `)
}

/**
 * The newest check-run for a wanted name, by start time.
 *
 * M0 fix 4: the previous version sorted by `completed_at` only, which drops a
 * queued/in-progress re-run (its `completed_at` is null) and lets the older
 * completed verdict stand. The newest attempt is the one that speaks for this
 * head, whether or not it has finished.
 */
export function newestCheck(checks, wanted) {
  const hits = (checks ?? []).filter((c) => sameCheck(String(c.name ?? ''), wanted))
  if (hits.length === 0) return null
  // Ordering must survive a queued re-run, which GitHub reports with BOTH
  // `started_at` and `completed_at` null (only `created_at` and `id` exist).
  // Falling back to '' sorted that attempt last and let an older success win.
  const stamp = (c) => String(c.created_at ?? c.started_at ?? c.completed_at ?? '')
  const id = (c) => Number(c.id ?? 0)
  return hits.slice().sort((a, b) => stamp(b).localeCompare(stamp(a)) || id(b) - id(a))[0]
}

/** Backwards-compatible alias (older callers used this name). */
export function latestCheck(checks, wanted) {
  return newestCheck(checks, wanted)
}

/**
 * Flatten `gh api --paginate --slurp` output (an array of pages) into one list.
 * A page is either an array (comments) or an object with a list field
 * (check-runs: {check_runs: [...]}).
 */
export function flattenPages(pages, field) {
  const out = []
  for (const page of pages ?? []) {
    if (Array.isArray(page)) out.push(...page)
    else if (field && Array.isArray(page?.[field])) out.push(...page[field])
  }
  return out
}

/**
 * Pure verdict. Input:
 *   pr:       {number, isDraft, mergeStateStatus, headRefOid, headRefName, title, body, labels}
 *   checks:   [{name, status, conclusion, started_at, completed_at}]
 *   comments: [{id, body}]
 *   git:      {clean, head, branch, upstream, ahead, remoteHasHead} | null
 * Output: {verdict, exit, reasons, notes, facts}
 */
export function evaluate(input = {}) {
  const pr = input.pr ?? {}
  const checks = input.checks ?? []
  const comments = input.comments ?? []
  const reasons = []
  const notes = []
  // A failed git read is NOT "no git state to check": only --no-git may skip
  // R8. The first version collapsed both into `git === null`, so a broken
  // checkout (not a repository, dubious ownership, a broken worktree) passed.
  if (input.gitError) {
    return { verdict: 'REFUSED', exit: 1, reasons: ['GIT_STATE_UNAVAILABLE'], notes: [String(input.gitError)], facts: { head: String(pr.headRefOid ?? '') } }
  }
  const head = typeof pr.headRefOid === 'string' ? pr.headRefOid : ''
  const facts = { head, draft: pr.isDraft === true, state: pr.mergeStateStatus ?? null }

  if (!SHA40.test(head)) {
    return { verdict: 'REFUSED', exit: 1, reasons: ['NO_HEAD_SHA'], notes: [], facts }
  }

  // R1 — already ready means this check is being run too late to save anything.
  if (pr.isDraft !== true) reasons.push('ALREADY_READY')

  // R2 — the marker must be gone before ready, or pr-settlement-gate stays
  // BLOCKED-BY-MARKER forever and the ready flip buys a guaranteed red.
  const marker = detectMarker({ title: pr.title, body: pr.body })
  facts.marker = marker
  if (marker.present) reasons.push(marker.onTitle ? 'MARKER_PRESENT_TITLE' : 'MARKER_PRESENT_BODY')

  // R3 — strict protection re-runs a BEHIND head; DIRTY cannot merge at all.
  // M0 fix 1: an unknown/absent state is a REFUSAL. "GitHub has not computed
  // mergeability yet" is not evidence that the branch is in sync.
  const state = String(pr.mergeStateStatus ?? '').toLowerCase()
  facts.state = state
  if (state === '') reasons.push('STATE_MISSING')
  else if (state === 'unknown') reasons.push('STATE_UNKNOWN')
  else if (state === 'behind') reasons.push('BRANCH_BEHIND')
  else if (state === 'dirty') reasons.push('BRANCH_DIRTY')

  // R4 — the four cheap layers, on THIS head. The newest attempt decides; a
  // pending attempt is not a green one.
  facts.layers = {}
  for (const layer of LAYERS) {
    const run = newestCheck(checks, layer)
    const status = String(run?.status ?? 'missing')
    const conclusion = status === 'completed' ? String(run?.conclusion ?? 'none') : status
    facts.layers[layer] = conclusion
    if (conclusion !== 'success') {
      reasons.push(`LAYER_${layer.toUpperCase().replace(/-/g, '_')}_${conclusion.toUpperCase()}`)
    }
  }

  // R5 — the deferred summary IS the L1 verdict (ci-required is red by design).
  const deferred = newestCheck(checks, DEFERRED)
  const deferredStatus = String(deferred?.status ?? 'missing')
  facts.deferred = deferredStatus === 'completed' ? String(deferred?.conclusion ?? 'none') : deferredStatus
  if (facts.deferred !== 'success') reasons.push(`DEFERRED_${String(facts.deferred).toUpperCase()}`)

  // R6 — census must not have run yet. If it did, this head already paid L2;
  // flipping ready again would pay it twice (create a fresh head instead).
  const census = newestCheck(checks, CENSUS)
  const censusStatus = String(census?.status ?? 'missing')
  facts.census = censusStatus === 'completed' ? String(census?.conclusion ?? 'none') : censusStatus
  if (facts.census !== 'skipped') reasons.push(`CENSUS_${String(facts.census).toUpperCase()}_NOT_SKIPPED`)

  // R7 — a dated settlement must cover the exact head we are about to freeze.
  const settlement = findSettlement(comments, head)
  facts.settlement = { settled: settlement.settled, candidates: settlement.candidates, invalid: settlement.invalid }
  if (!settlement.settled) {
    reasons.push(settlement.candidates === 0 ? 'SETTLEMENT_MISSING' : 'SETTLEMENT_NOT_COVERING_HEAD')
  }

  // R9 — a ready PR carrying the deferral label runs no census at all, so the
  // same head can never be the single L2 the protocol promises.
  const labels = (pr.labels ?? []).map((l) => (typeof l === 'string' ? l : l?.name)).filter(Boolean)
  facts.labels = labels
  if (labels.includes(DEFER_LABEL)) reasons.push('DEFERRED_LABEL_PRESENT')

  // R8 — local checkout hygiene. M0 fixes 2 and 3: the local HEAD must BE the
  // PR head (a stale worktree was silently grading its own branch), and "no
  // upstream" is not the same as "everything is pushed".
  if (input.git) {
    const g = input.git
    facts.git = g
    if (g.clean !== true) reasons.push('WORKTREE_DIRTY')
    if (typeof g.head === 'string' && g.head !== head) reasons.push('LOCAL_HEAD_NOT_PR_HEAD')
    if (g.remoteHasHead === false) reasons.push('BRANCH_NOT_PUSHED')
    if (Number(g.ahead) > 0) reasons.push('UNPUSHED_COMMITS')
  }

  const verdict = reasons.length === 0 ? 'READY' : 'REFUSED'
  return { verdict, exit: reasons.length === 0 ? 0 : 1, reasons, notes, facts }
}

// ------------------------------------------------------------------- live

function ghJson(path) {
  // One retry: the GitHub API has been seen to return a bare EOF under load
  // (observed 2026-11-13 while dogfooding this script). A single transient
  // failure must not turn a REFUSED into an ERROR, and an ERROR is still not a
  // pass — but retrying keeps the verdict about the PR, not about the network.
  let last
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const out = execFileSync('gh', ['api', path], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
      return JSON.parse(out)
    } catch (e) {
      last = e
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 750)
    }
  }
  throw last
}

/**
 * Fully paginated read (M0 fix 5). Explicit page loop rather than
 * `gh api --paginate --slurp`: the installed gh (2.46) has no `--slurp`, and
 * `--paginate` alone concatenates pages without a delimiter for object-shaped
 * endpoints (check-runs). A page shorter than per_page is the last page.
 */
function ghJsonPages(path, field) {
  const out = []
  const sep = path.includes('?') ? '&' : '?'
  for (let page = 1; page <= 50; page += 1) {
    const data = ghJson(`${path}${sep}per_page=100&page=${page}`)
    const items = Array.isArray(data) ? data : (field ? (data?.[field] ?? []) : [])
    out.push(...items)
    if (items.length < 100) break
  }
  return out
}

function gitOut(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function gitOk(args) {
  try {
    execFileSync('git', args, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

export function gather({ pr, repo, noGit }) {
  const pull = ghJson(`repos/${repo}/pulls/${pr}`)
  const head = pull.head?.sha
  // M0 fix 5: check-runs and comments are both paginated. A head can carry more
  // than 100 check-runs once re-runs accumulate, and a long-lived PR more than
  // 100 comments; reading one page made both look absent.
  const checks = ghJsonPages(`repos/${repo}/commits/${head}/check-runs?per_page=100`, 'check_runs')
  const comments = ghJsonPages(`repos/${repo}/issues/${pr}/comments?per_page=100`)
  let git = null
  let gitError = null
  if (!noGit) {
    try {
      const clean = gitOut(['status', '--porcelain']) === ''
      const localHead = gitOut(['rev-parse', 'HEAD'])
      const branch = pull.head?.ref ?? gitOut(['rev-parse', '--abbrev-ref', 'HEAD'])
      const remoteRef = `refs/remotes/origin/${branch}`
      const remoteHasHead = branch ? gitOk(['rev-parse', '--verify', '--quiet', remoteRef]) : false
      let ahead = 0
      if (remoteHasHead) ahead = Number(gitOut(['rev-list', '--count', `origin/${branch}..HEAD`]))
      git = { clean, head: localHead, branch, upstream: remoteHasHead ? `origin/${branch}` : null, ahead, remoteHasHead }
    } catch (e) {
      gitError = `git state unreadable: ${e?.message ?? e}`
    }
  }
  return {
    pr: {
      number: pull.number,
      isDraft: pull.draft,
      mergeStateStatus: pull.mergeable_state,
      headRefOid: head,
      headRefName: pull.head?.ref ?? null,
      title: pull.title,
      body: pull.body ?? '',
      labels: (pull.labels ?? []).map((l) => ({ name: l.name })),
    },
    checks,
    comments: comments.map((c) => ({ id: c.id, body: c.body ?? '' })),
    git,
    gitError,
  }
}

// ------------------------------------------------------------------- render

export function render(v, prNumber) {
  const f = v.facts
  const lines = []
  lines.push(`pr-ready-check: PR #${prNumber} head=${f.head || '?'} state=${f.state ?? '?'} draft=${f.draft}`)
  lines.push(`  layers: fast=${f.layers?.['ci-fast'] ?? '?'} integration=${f.layers?.['ci-integration'] ?? '?'} security=${f.layers?.['ci-security'] ?? '?'} product=${f.layers?.['ci-product'] ?? '?'}`)
  lines.push(`  deferred=${f.deferred ?? '?'} census=${f.census ?? '?'} settlement=${f.settlement?.settled ? 'covers-head' : 'missing'}`)
  if (f.labels?.length) lines.push(`  labels: ${f.labels.join(',')}`)
  if (f.git) lines.push(`  git: head=${String(f.git.head ?? '').slice(0, 9)} branch=${f.git.branch} upstream=${f.git.upstream ?? 'none'} ahead=${f.git.ahead} clean=${f.git.clean}`)
  if (v.reasons.length > 0) lines.push(`  refuse reasons: ${v.reasons.join(', ')}`)
  for (const n of v.notes) lines.push(`  note: ${n}`)
  return lines.join('\n')
}

export function verdictToken(v, prNumber) {
  return `DSH-PR-READY verdict=${v.verdict} pr=${prNumber} reasons=${v.reasons.length === 0 ? 'none' : v.reasons.join(',')}`
}

// --------------------------------------------------------------------- cli

function parseArgs(argv) {
  const opts = { pr: null, repo: null, json: false, noGit: false, input: null, selfTest: false, help: false }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--pr') { opts.pr = Number(argv[++i]); if (!Number.isInteger(opts.pr) || opts.pr <= 0) throw new Error('--pr needs a positive integer') }
    else if (a === '--repo') opts.repo = argv[++i]
    else if (a === '--json') opts.json = true
    else if (a === '--no-git') opts.noGit = true
    else if (a === '--input') opts.input = argv[++i]
    else if (a === '--self-test') opts.selfTest = true
    else if (a === '--help' || a === '-h') opts.help = true
    else throw new Error(`unknown argument ${a}`)
  }
  return opts
}

function selfTest() {
  const ok = { name: 'ci-fast / ci-fast', status: 'completed', conclusion: 'success', started_at: '2026-11-13T00:00:01Z', completed_at: '2026-11-13T00:00:02Z' }
  const head = 'a'.repeat(40)
  const base = {
    pr: { number: 1, isDraft: true, mergeStateStatus: 'blocked', headRefOid: head, headRefName: 'task/x', title: 'x', body: 'y', labels: [] },
    checks: [ok,
      { name: 'ci-integration / ci-integration', status: 'completed', conclusion: 'success', started_at: '2026-11-13T00:00:02Z', completed_at: '2026-11-13T00:00:03Z' },
      { name: 'ci-security / ci-security', status: 'completed', conclusion: 'success', started_at: '2026-11-13T00:00:03Z', completed_at: '2026-11-13T00:00:04Z' },
      { name: 'ci-product / ci-product', status: 'completed', conclusion: 'success', started_at: '2026-11-13T00:00:04Z', completed_at: '2026-11-13T00:00:05Z' },
      { name: 'ci-required-deferred', status: 'completed', conclusion: 'success', started_at: '2026-11-13T00:00:05Z', completed_at: '2026-11-13T00:00:06Z' },
      { name: 'ci-census / census-runtime', status: 'completed', conclusion: 'skipped', started_at: '2026-11-13T00:00:06Z', completed_at: '2026-11-13T00:00:07Z' }],
    comments: [{ id: 1, body: `**[dated settlement, 2026-11-13T16:00Z — done]**\ncovered head ${head}` }],
    git: { clean: true, head, branch: 'task/x', upstream: 'origin/task/x', ahead: 0, remoteHasHead: true },
  }
  const cases = []
  cases.push(['READY', evaluate(base), 0])
  cases.push(['marker', evaluate({ ...base, pr: { ...base.pr, title: 'DO-NOT-MERGE x' } }), 1])
  cases.push(['already ready', evaluate({ ...base, pr: { ...base.pr, isDraft: false } }), 1])
  cases.push(['settlement stale', evaluate({ ...base, comments: [] }), 1])
  cases.push(['behind', evaluate({ ...base, pr: { ...base.pr, mergeStateStatus: 'behind' } }), 1])
  cases.push(['state unknown', evaluate({ ...base, pr: { ...base.pr, mergeStateStatus: 'unknown' } }), 1])
  cases.push(['defer label', evaluate({ ...base, pr: { ...base.pr, labels: [{ name: 'ci-defer-full' }] } }), 1])
  cases.push(['census ran', evaluate({ ...base, checks: base.checks.map((c) => c.name === 'ci-census / census-runtime' ? { ...c, conclusion: 'success' } : c) }), 1])
  cases.push(['newer pending attempt', evaluate({ ...base, checks: [...base.checks, { name: 'ci-fast / ci-fast', status: 'in_progress', conclusion: null, started_at: '2026-11-13T00:10:00Z' }] }), 1])
  cases.push(['stale local head', evaluate({ ...base, git: { ...base.git, head: 'b'.repeat(40) } }), 1])
  cases.push(['branch never pushed', evaluate({ ...base, git: { ...base.git, remoteHasHead: false, upstream: null } }), 1])
  let bad = 0
  for (const [label, v, exit] of cases) {
    const pass = v.exit === exit
    if (!pass) bad += 1
    process.stdout.write(`  ${pass ? 'ok  ' : 'FAIL'} ${label}: verdict=${v.verdict} reasons=${v.reasons.join(',') || 'none'}\n`)
  }
  process.stdout.write(`DSH-PR-READY-SELFTEST ${bad === 0 ? 'PASS' : 'FAIL'} cases=${cases.length} failed=${bad}\n`)
  return bad === 0 ? 0 : 1
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    process.stdout.write('usage: node scripts/pr-ready-check.mjs --pr <n> [--repo owner/name] [--json] [--no-git]\n' +
      '       node scripts/pr-ready-check.mjs --input <fixture.json>\n' +
      '       node scripts/pr-ready-check.mjs --self-test\n')
    return 0
  }
  if (opts.selfTest) return selfTest()

  if (opts.input) {
    const payload = JSON.parse(readFileSync(resolve(opts.input), 'utf8'))
    const v = evaluate(payload)
    if (opts.json) process.stdout.write(`${JSON.stringify(v, null, 2)}\n`)
    process.stdout.write(`${render(v, payload.pr?.number ?? '?')}\n${verdictToken(v, payload.pr?.number ?? '?')}\n`)
    return v.exit
  }

  if (!opts.pr) {
    process.stdout.write('ERROR NO_PR: --pr <n> or --input <file> or --self-test\n')
    return 2
  }
  const repo = opts.repo ?? execFileSync('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], { encoding: 'utf8' }).trim()
  let payload
  try {
    payload = gather({ pr: opts.pr, repo, noGit: opts.noGit })
  } catch (e) {
    process.stdout.write(`ERROR FETCH_FAILED ${e?.message ?? e}\n`)
    return 2
  }
  const v = evaluate(payload)
  if (opts.json) process.stdout.write(`${JSON.stringify({ ...v, pr: payload.pr.number }, null, 2)}\n`)
  process.stdout.write(`${render(v, payload.pr.number)}\n${verdictToken(v, payload.pr.number)}\n`)
  return v.exit
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) {
  main().then((code) => process.exit(code), (e) => {
    process.stdout.write(`ERROR UNEXPECTED ${e?.stack ?? e}\n`)
    process.exit(2)
  })
}
