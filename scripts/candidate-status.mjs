#!/usr/bin/env node
/**
 * candidate-status — the machine-readable answer to "what IS this frozen
 * candidate?", derived from the manifests already in the tree.
 *
 * WHY THIS EXISTS. `status: FROZEN` means exactly one thing: the identity is
 * locked (commit + ref + trees + content digest). It does NOT mean accepted.
 * Acceptance is a separate fact that lives under `evidence.record_root` as C2-A
 * and C2-B records, and nothing in the repository read the two together. The
 * 2026-11-12/13 churn (five v0.1.6 candidates in 68 hours) produced exactly the
 * question "the frozen version still has a bug, so what did 'frozen' mean?" —
 * and no command could answer it.
 *
 * This tool is READ-ONLY. It never rewrites a manifest, never moves a ref, and
 * never claims eligibility: it reports the facts and the metadata defects it can
 * prove from the tree and from git.
 *
 * WHAT IT REPORTS, per candidate:
 *   identity    FROZEN (status + content_digest present) | NOT_FROZEN
 *   acceptance  C2_NOT_RUN | C2_A_ONLY | C2_A_AND_B | CANDIDATE_ELIGIBLE |
 *               RECORDED_RUN_PASS (a cited run, no C2 records)
 *   lineage     predecessor by frozen_at_utc, and whether git agrees the commits
 *               are ordered; `immutability.supersedes` is reported as recorded
 *               or not (today it is hardcoded null, so lineage is prose-only)
 *   defects     RECORD_ROOT_MISSING, RECORD_ROOT_STALE_PATH, RECORD_FOREIGN,
 *               LINEAGE_UNRECORDED, ANCESTRY_CHAIN_BROKEN,
 *               ANCESTRY_MANIFEST_DISAGREES, REF_MISSING
 *
 * EXIT 0 no defects · 1 defects (the finding IS the output) · 2 cannot read the
 * candidate directory (a refusal, never a silent pass).
 *
 * USAGE
 *   node scripts/candidate-status.mjs [--dir dev/engineering/candidates] [--json]
 *   node scripts/candidate-status.mjs --self-test
 */
import process from 'node:process'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { recordRootFor } from './freeze-candidate.mjs'

const CANDIDATE_DIR = 'dev/engineering/candidates'

/**
 * The evidence directory a candidate id owns. Delegated to the freeze
 * generator's `recordRootFor` on purpose: the `cand-` -> `candidate-` mapping
 * lives in exactly one place, and a reader must not learn a second rule.
 */
export function derivedRecordRoot(candidateId) {
  return recordRootFor(candidateId)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

/** Classify acceptance from the C2 records actually present. */
export function acceptanceOf(manifest, records) {
  const classes = new Set(records.map((r) => r.class))
  const eligible = records.filter((r) => r.eligible === true)
  if (classes.has('C2-A') && classes.has('C2-B')) {
    return eligible.length === 2 ? 'CANDIDATE_ELIGIBLE' : 'C2_A_AND_B'
  }
  if (classes.has('C2-A')) return 'C2_A_ONLY'
  if (classes.has('C2-B')) return 'C2_B_ONLY'
  const cited = manifest?.evidence?.overall
  if (typeof cited === 'string' && /^PASS/i.test(cited)) return 'RECORDED_RUN_PASS'
  return 'C2_NOT_RUN'
}

/**
 * Pure report. `entries` is one object per manifest:
 *   {manifest, rootExists, records:[{class, sha, eligible}], refExists}
 * `ctx.isAncestor(a, b)` answers "is a an ancestor of b" (true/false/null when
 * unavailable). Nothing here touches the filesystem or git directly, so the
 * tests can pin the algebra without fixtures on disk.
 */
export function report(entries, ctx = {}) {
  const isAncestor = typeof ctx.isAncestor === 'function' ? ctx.isAncestor : () => null
  const rows = []
  const defects = []
  const notes = []

  const sorted = entries
    .map((e) => ({ ...e, at: Date.parse(e?.manifest?.frozen_at_utc ?? '') || 0 }))
    .sort((a, b) => a.at - b.at)

  for (const [i, e] of sorted.entries()) {
    const m = e.manifest ?? {}
    const id = m.candidate_id ?? '<missing-id>'
    const commit = m.candidate_commit ?? ''
    const root = m.evidence?.record_root ?? null
    const derived = derivedRecordRoot(id)
    const records = Array.isArray(e.records) ? e.records : []

    const identity = m.status === 'FROZEN' && typeof m.content_digest === 'string' ? 'FROZEN' : 'NOT_FROZEN'
    const acceptance = acceptanceOf(m, records)

    // lineage: the predecessor is the previous candidate in freeze order; git
    // decides whether the two commits are actually ordered.
    const prev = i > 0 ? sorted[i - 1] : null
    const prevId = prev?.manifest?.candidate_id ?? null
    const prevCommit = prev?.manifest?.candidate_commit ?? ''
    let chain = 'FIRST'
    if (prev) {
      const forward = isAncestor(prevCommit, commit)
      const backward = isAncestor(commit, prevCommit)
      chain = forward === true ? 'AFTER' : backward === true ? 'BEFORE' : forward === null ? 'UNKNOWN' : 'SEPARATE_LINE'
      if (chain === 'BEFORE') defects.push({ id, code: 'ANCESTRY_CHAIN_BROKEN', detail: `frozen after ${prevId} but its commit is an ancestor of ${prevId}'s` })
      if (chain === 'SEPARATE_LINE') notes.push({ id, code: 'SEPARATE_LINE', detail: `not comparable with ${prevId}; treated as a different product line, not a break` })
    }

    const recordedSupersedes = m.immutability?.supersedes ?? null
    // Lineage is expected between candidates of the same line
    // (`cand-v0.1.6-3` -> `cand-v0.1.6-4`); a jump across lines
    // (`cand-a5sf-fs-search-1` -> `cand-v0.1.6-1`) is a new family, not a
    // missing supersedes.
    const family = (idv) => String(idv ?? '').replace(/-\d+$/, '')
    const sameFamily = prev ? family(prevId) === family(id) : false
    if (prev && !sameFamily) {
      notes.push({ id, code: 'LINEAGE_FAMILY_CHANGE', detail: `predecessor by freeze time is ${prevId}, a different candidate line` })
    }
    if (prev && sameFamily && chain === 'AFTER' && recordedSupersedes === null) {
      defects.push({ id, code: 'LINEAGE_UNRECORDED', detail: `immutability.supersedes is null; predecessor by freeze time is ${prevId}` })
    }
    if (e.recordsRoot && root && e.recordsRoot !== root) {
      notes.push({ id, code: 'EVIDENCE_AT_DERIVED_ROOT', detail: `records read from ${e.recordsRoot}; the manifest points at ${root}` })
    }

    if (root && !e.rootExists) {
      // D12 freezes before C2: the directory legitimately does not exist until
      // an adjudicator creates it. Pending is a note; missing is a defect only
      // when the manifest no longer claims to be awaiting C2.
      if (m.evidence?.status === 'AWAITING_C2') {
        notes.push({ id, code: 'RECORD_ROOT_NOT_YET_CREATED', detail: `${root} does not exist yet (status AWAITING_C2)` })
      } else {
        defects.push({ id, code: 'RECORD_ROOT_MISSING', detail: `${root} does not exist` })
      }
    }
    if (root && root !== derived) {
      defects.push({ id, code: 'RECORD_ROOT_STALE_PATH', detail: `record_root is ${root}, derived from the candidate id is ${derived}` })
    }
    for (const r of records) {
      if (r.sha && commit && r.sha !== commit) {
        defects.push({ id, code: 'RECORD_FOREIGN', detail: `${r.class} record names ${r.sha}, manifest names ${commit}` })
      }
    }

    const claimed = m.ancestry?.candidate_is_ancestor_of_origin_master
    const live = isAncestor(commit, 'origin/master')
    if (typeof claimed === 'boolean' && live !== null && claimed !== live) {
      defects.push({ id, code: 'ANCESTRY_MANIFEST_DISAGREES', detail: `manifest says ${claimed}, git says ${live}` })
    }
    if (e.refExists === false) {
      defects.push({ id, code: 'REF_MISSING', detail: `${m.candidate_ref ?? '<no ref>'} does not resolve` })
    }

    rows.push({
      id,
      identity,
      acceptance,
      commit,
      frozenAt: m.frozen_at_utc ?? null,
      predecessor: prevId,
      chain,
      lineageRecorded: recordedSupersedes,
      root,
      rootExists: e.rootExists === true,
      records: records.map((r) => `${r.class}${r.eligible === true ? ':eligible' : ''}`),
      refExists: e.refExists,
    })
  }

  const summary = {
    candidates: rows.length,
    frozen: rows.filter((r) => r.identity === 'FROZEN').length,
    accepted: rows.filter((r) => r.acceptance === 'CANDIDATE_ELIGIBLE').length,
    c2NotRun: rows.filter((r) => r.acceptance === 'C2_NOT_RUN').length,
    defects: defects.length,
  }
  return { rows, defects, notes, summary }
}

// ------------------------------------------------------------------- live

function gitOk(args) {
  try {
    execFileSync('git', args, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function isAncestor(a, b) {
  if (!a || !b) return null
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', a, b], { stdio: 'ignore' })
    return true
  } catch (e) {
    return e?.status === 1 ? false : null
  }
}

export function gather(dir = CANDIDATE_DIR) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
  const entries = []
  for (const f of files) {
    const manifest = readJson(join(dir, f))
    if (manifest?.kind !== 'frozen-candidate') continue
    const root = manifest.evidence?.record_root ?? null
    const rootExists = typeof root === 'string' ? existsSync(root) : false
    // Read the records the manifest points at, but if that path is stale, also
    // look where the candidate id says they should be. A manifest defect must
    // not hide the adjudication that actually exists (cand-3/4 are exactly
    // this case), and the mismatch is still reported as a defect.
    const derived = derivedRecordRoot(manifest.candidate_id ?? '')
    const recordsRoot = rootExists ? root : (existsSync(derived) ? derived : null)
    const records = []
    if (recordsRoot) {
      for (const name of ['C2-A.json', 'C2-B.json']) {
        const p = join(recordsRoot, name)
        if (!existsSync(p)) continue
        try {
          const r = readJson(p)
          records.push({
            class: r?.recordClass === 'CANDIDATE-C2' ? (name === 'C2-A.json' ? 'C2-A' : 'C2-B') : name.replace('.json', ''),
            sha: r?.candidateSha ?? r?.candidateCommit ?? null,
            eligible: r?.candidateClaimEligibility?.eligible === true,
          })
        } catch {
          records.push({ class: name.replace('.json', ''), sha: null, eligible: false })
        }
      }
    }
    const ref = manifest.candidate_ref
    const refExists = typeof ref === 'string' ? gitOk(['rev-parse', '--verify', '--quiet', ref]) : null
    entries.push({ manifest, rootExists, records, recordsRoot, refExists })
  }
  return entries
}

// ---------------------------------------------------------------- render

export function render(result) {
  const lines = []
  for (const r of result.rows) {
    lines.push(`${r.id}  ${r.identity}  ${r.acceptance}  root=${r.root ? (r.rootExists ? 'ok' : 'MISSING') : 'none'}  ref=${r.refExists === false ? 'MISSING' : 'ok'}  lineage=${r.predecessor ?? '-'}`)
    for (const d of result.defects.filter((x) => x.id === r.id)) lines.push(`  DEFECT ${d.code}: ${d.detail}`)
    for (const n of result.notes.filter((x) => x.id === r.id)) lines.push(`  note ${n.code}: ${n.detail}`)
  }
  const s = result.summary
  lines.push(`candidate-status: candidates=${s.candidates} frozen=${s.frozen} accepted=${s.accepted} c2_not_run=${s.c2NotRun} defects=${s.defects}`)
  return lines.join('\n')
}

export function verdictToken(result) {
  const codes = [...new Set(result.defects.map((d) => d.code))].sort()
  return `DSH-CANDIDATE-STATUS candidates=${result.summary.candidates} defects=${result.summary.defects} codes=${codes.join(',') || 'none'}`
}

// ------------------------------------------------------------------- cli

function parseArgs(argv) {
  const opts = { dir: CANDIDATE_DIR, json: false, selfTest: false, help: false }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--dir') opts.dir = argv[++i]
    else if (a === '--json') opts.json = true
    else if (a === '--self-test') opts.selfTest = true
    else if (a === '--help' || a === '-h') opts.help = true
    else throw new Error(`unknown argument ${a}`)
  }
  return opts
}

function selfTest() {
  const mk = (id, commit, at, over = {}) => ({
    manifest: {
      kind: 'frozen-candidate',
      candidate_id: id,
      candidate_commit: commit,
      candidate_ref: `refs/heads/candidate/${id}`,
      status: 'FROZEN',
      content_digest: 'sha256:x',
      frozen_at_utc: at,
      evidence: { record_root: derivedRecordRoot(id) },
      ancestry: { candidate_is_ancestor_of_origin_master: true },
      immutability: { supersedes: null },
      ...(over.manifest ?? {}),
    },
    rootExists: over.rootExists ?? false,
    records: over.records ?? [],
    refExists: over.refExists ?? true,
  })
  const A = (sha, eligible = false) => ({ class: 'C2-A', sha, eligible })
  const ancestorMap = { 'c1:c2': true, 'c2:c1': false, 'c1:origin/master': true, 'c2:origin/master': true }
  const isAncestor = (a, b) => ancestorMap[`${a}:${b}`] ?? null
  const entries = [
    mk('cand-v0.1.6-1', 'c1', '2026-11-10T00:00:00Z', { rootExists: true, records: [A('c1')] }),
    mk('cand-v0.1.6-2', 'c2', '2026-11-11T00:00:00Z', { rootExists: false, records: [] }),
  ]
  const r = report(entries, { isAncestor })
  const codes = r.defects.map((d) => d.code)
  const checks = [
    ['first is C2_A_ONLY', r.rows[0].acceptance === 'C2_A_ONLY'],
    ['second is C2_NOT_RUN', r.rows[1].acceptance === 'C2_NOT_RUN'],
    ['missing root is a defect', codes.includes('RECORD_ROOT_MISSING')],
    ['null supersedes is a defect', codes.includes('LINEAGE_UNRECORDED')],
    ['chain AFTER is not a break', r.rows[1].chain === 'AFTER'],
  ]
  let bad = 0
  for (const [label, ok] of checks) {
    if (!ok) bad += 1
    process.stdout.write(`  ${ok ? 'ok  ' : 'FAIL'} ${label}\n`)
  }
  process.stdout.write(`DSH-CANDIDATE-STATUS-SELFTEST ${bad === 0 ? 'PASS' : 'FAIL'} cases=${checks.length} failed=${bad}\n`)
  return bad === 0 ? 0 : 1
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    process.stdout.write('usage: node scripts/candidate-status.mjs [--dir <dir>] [--json]\n' +
      '       node scripts/candidate-status.mjs --self-test\n')
    return 0
  }
  if (opts.selfTest) return selfTest()
  let entries
  try {
    entries = gather(opts.dir)
  } catch (e) {
    process.stdout.write(`ERROR CANDIDATE_DIR_UNREADABLE ${e?.message ?? e}\n`)
    return 2
  }
  const result = report(entries, { isAncestor })
  if (opts.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  process.stdout.write(`${render(result)}\n${verdictToken(result)}\n`)
  return result.defects.length === 0 ? 0 : 1
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) {
  main().then((code) => process.exit(code), (e) => {
    process.stdout.write(`ERROR UNEXPECTED ${e?.stack ?? e}\n`)
    process.exit(2)
  })
}
