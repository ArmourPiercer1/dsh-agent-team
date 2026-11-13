#!/usr/bin/env node
/**
 * pr-ready-check — the machine half of `docs/DEV-PR-WORKFLOW.md` §4.
 *
 * WHY THIS EXISTS. The L1/L2 split only saves time if a PR is created as a
 * draft and flipped to ready exactly once, on a frozen head, after the
 * settlement comment covers that head. Measurement on 2026-11-13: 12 of the
 * last 12 merged PRs were created ready, ran `ci-required` a median of two
 * times, and each extra run is a full census (24m13s). The discipline was
 * written down; nothing checked it. This script checks the machine-checkable
 * subset before `gh pr ready`, so a premature flip is refused locally instead
 * of costing 24 minutes on a runner.
 *
 * WHAT IT GATES (all against the CURRENT head sha):
 *   R1 the PR is still a draft                       (refuse ALREADY_READY)
 *   R2 no open-state marker in title / body line 1   (refuse MARKER_PRESENT)
 *   R3 the branch is not BEHIND / DIRTY              (refuse NOT_IN_SYNC)
 *   R4 ci-fast / ci-integration / ci-security / ci-product are green
 *   R5 ci-required-deferred is green                 (the L1 verdict)
 *   R6 ci-census is skipped                          (a census now = a second L2)
 *   R7 a dated settlement covers the current head    (reuses pr-settlement-gate)
 *   R8 the local worktree is clean and pushed        (when run from a checkout)
 *
 * WHAT IT DELIBERATELY DOES NOT GATE: review-thread resolution (a human/
 * reviewer judgement, §8.5.3), docs content, and whether the change is any
 * good. A READY verdict means "the machine-visible preconditions hold", not
 * "this should merge".
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

const SHA40 = /^[0-9a-f]{40}$/

/** A check-run name from the API may be "ci-fast / ci-fast" or "ci-fast". */
function sameCheck(name, wanted) {
  return name === wanted || name.startsWith(`${wanted} / `)
}

/** Latest check-run for a wanted name, by completed_at (ISO strings sort). */
export function latestCheck(checks, wanted) {
  const hits = (checks ?? []).filter((c) => sameCheck(String(c.name ?? ''), wanted))
  if (hits.length === 0) return null
  return hits.slice().sort((a, b) => String(b.completed_at ?? '').localeCompare(String(a.completed_at ?? '')))[0]
}

/**
 * Pure verdict. Input:
 *   pr:       {number, isDraft, mergeStateStatus, headRefOid, title, body}
 *   checks:   [{name, status, conclusion, completed_at}]
 *   comments: [{id, body}]
 *   git:      {clean, ahead} | null
 * Output: {verdict, exit, reasons, notes, facts}
 */
export function evaluate(input = {}) {
  const pr = input.pr ?? {}
  const checks = input.checks ?? []
  const comments = input.comments ?? []
  const reasons = []
  const notes = []
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
  const state = String(pr.mergeStateStatus ?? '').toLowerCase()
  facts.state = state
  if (state === 'behind') reasons.push('BRANCH_BEHIND')
  if (state === 'dirty') reasons.push('BRANCH_DIRTY')
  if (state === '' || state === 'unknown') notes.push('STATE_UNKNOWN: GitHub has not computed mergeability yet')

  // R4 — the four cheap layers, on THIS head.
  facts.layers = {}
  for (const layer of LAYERS) {
    const run = latestCheck(checks, layer)
    const conclusion = run?.conclusion ?? 'MISSING'
    facts.layers[layer] = conclusion
    if (conclusion !== 'success') reasons.push(`LAYER_${layer.toUpperCase().replace(/-/g, '_')}_${String(conclusion).toUpperCase()}`)
  }

  // R5 — the deferred summary IS the L1 verdict (ci-required is red by design).
  const deferred = latestCheck(checks, DEFERRED)
  facts.deferred = deferred?.conclusion ?? 'MISSING'
  if (facts.deferred !== 'success') reasons.push(`DEFERRED_${String(facts.deferred).toUpperCase()}`)

  // R6 — census must not have run yet. If it did, this head already paid L2;
  // flipping ready again would pay it twice (create a fresh head instead).
  const census = latestCheck(checks, CENSUS)
  facts.census = census?.conclusion ?? census?.status ?? 'MISSING'
  if (facts.census !== 'skipped') reasons.push(`CENSUS_${String(facts.census).toUpperCase()}_NOT_SKIPPED`)

  // R7 — a dated settlement must cover the exact head we are about to freeze.
  const settlement = findSettlement(comments, head)
  facts.settlement = { settled: settlement.settled, candidates: settlement.candidates, invalid: settlement.invalid }
  if (!settlement.settled) {
    reasons.push(settlement.candidates === 0 ? 'SETTLEMENT_MISSING' : 'SETTLEMENT_NOT_COVERING_HEAD')
  }

  // R8 — local checkout hygiene, only when a checkout was provided.
  if (input.git) {
    if (input.git.clean !== true) reasons.push('WORKTREE_DIRTY')
    if (Number(input.git.ahead) > 0) reasons.push('UNPUSHED_COMMITS')
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

function gitOut(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

export function gather({ pr, repo, noGit }) {
  const pull = ghJson(`repos/${repo}/pulls/${pr}`)
  const head = pull.head?.sha
  const checks = []
  let page = 1
  for (;;) {
    const batch = ghJson(`repos/${repo}/commits/${head}/check-runs?per_page=100&page=${page}`)
    checks.push(...(batch.check_runs ?? []))
    if ((batch.check_runs ?? []).length < 100 || page >= 5) break
    page += 1
  }
  const comments = ghJson(`repos/${repo}/issues/${pr}/comments?per_page=100`)
  let git = null
  if (!noGit) {
    try {
      const clean = gitOut(['status', '--porcelain']) === ''
      let ahead = 0
      try {
        ahead = Number(gitOut(['rev-list', '--count', '@{u}..HEAD']))
      } catch {
        ahead = 0 // no upstream: the push step is the caller's own check
      }
      git = { clean, ahead }
    } catch {
      git = null
    }
  }
  return {
    pr: {
      number: pull.number,
      isDraft: pull.draft,
      mergeStateStatus: pull.mergeable_state,
      headRefOid: head,
      title: pull.title,
      body: pull.body ?? '',
    },
    checks,
    comments: comments.map((c) => ({ id: c.id, body: c.body ?? '' })),
    git,
  }
}

// ------------------------------------------------------------------- render

export function render(v, prNumber) {
  const f = v.facts
  const lines = []
  lines.push(`pr-ready-check: PR #${prNumber} head=${f.head || '?'} state=${f.state ?? '?'} draft=${f.draft}`)
  lines.push(`  layers: fast=${f.layers?.['ci-fast'] ?? '?'} integration=${f.layers?.['ci-integration'] ?? '?'} security=${f.layers?.['ci-security'] ?? '?'} product=${f.layers?.['ci-product'] ?? '?'}`)
  lines.push(`  deferred=${f.deferred ?? '?'} census=${f.census ?? '?'} settlement=${f.settlement?.settled ? 'covers-head' : 'missing'}`)
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
  const ok = { name: 'ci-fast / ci-fast', status: 'completed', conclusion: 'success', completed_at: '2026-11-13T00:00:01Z' }
  const head = 'a'.repeat(40)
  const base = {
    pr: { number: 1, isDraft: true, mergeStateStatus: 'blocked', headRefOid: head, title: 'x', body: 'y' },
    checks: [ok,
      { name: 'ci-integration / ci-integration', status: 'completed', conclusion: 'success', completed_at: '2026-11-13T00:00:02Z' },
      { name: 'ci-security / ci-security', status: 'completed', conclusion: 'success', completed_at: '2026-11-13T00:00:03Z' },
      { name: 'ci-product / ci-product', status: 'completed', conclusion: 'success', completed_at: '2026-11-13T00:00:04Z' },
      { name: 'ci-required-deferred', status: 'completed', conclusion: 'success', completed_at: '2026-11-13T00:00:05Z' },
      { name: 'ci-census / census-runtime', status: 'completed', conclusion: 'skipped', completed_at: '2026-11-13T00:00:06Z' }],
    comments: [{ id: 1, body: `**[dated settlement, 2026-11-13T16:00Z — done]**\ncovered head ${head}` }],
    git: { clean: true, ahead: 0 },
  }
  const cases = []
  cases.push(['READY', evaluate(base), 0])
  cases.push(['marker', evaluate({ ...base, pr: { ...base.pr, title: 'DO-NOT-MERGE x' } }), 1])
  cases.push(['already ready', evaluate({ ...base, pr: { ...base.pr, isDraft: false } }), 1])
  cases.push(['settlement stale', evaluate({ ...base, comments: [] }), 1])
  cases.push(['behind', evaluate({ ...base, pr: { ...base.pr, mergeStateStatus: 'behind' } }), 1])
  cases.push(['census ran', evaluate({ ...base, checks: base.checks.map((c) => c.name === 'ci-census / census-runtime' ? { ...c, conclusion: 'success' } : c) }), 1])
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
