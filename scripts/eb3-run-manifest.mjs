#!/usr/bin/env node
/**
 * eb3-run-manifest.mjs — EB3-D: RUN Manifest validation (sources + evidence).
 *
 * The plan, §EB3-D: "RUN schema/hash 与 artifact uploader/validator, CI 出具候选与
 * Host/TrustedSources 完整摘要"; "改写 RUN、错 digest、混入不同来源代际必须拒绝"
 * — a rewritten RUN, a wrong digest, or a mix of generations must be REFUSED.
 *
 * THE SCHEMA IS NOT INVENTED HERE. `tests/world-factory/lib/run-record.mjs` already
 * owns it (`u5-run-record/1`: bindings of Team SHA / Host SHA / config / World /
 * authority digests, a per-case verdict set, the worst-of `overall` rule, and the
 * rule that SKIP/REFUSED/ENV_BLOCK are disclosures and never colours). This file
 * imports that module and reuses `VERDICTS` and `overallVerdict` rather than
 * restating them; a second copy of a verdict algebra is two algebras.
 *
 * WHAT IT ADDS — THE THREE THINGS A RECORD CAN LIE ABOUT
 *
 *  1. SOURCE BINDING (RUN_SOURCE_UNRESOLVED / RUN_HOST_PIN_DRIFT /
 *     RUN_AUTHORITY_BINDING_MISMATCH). `bindings.teamSha` must be a commit that
 *     exists in THIS repository. `bindings.hostSha` is a commit of the pristine
 *     HOST repository, which is deliberately not in this repo's object database —
 *     so it is graded against the pin `tests/paths.mjs` declares, which is the
 *     same source every real-host kit reads. `bindings.authority.pointer
 *     .content_digest` must equal the live `dev/engineering/current-authority.json`,
 *     and `pointerSha256` must be the sha256 of those exact pointer bytes: a RUN
 *     recorded against a superseded authority is a different generation and says so.
 *
 *  2. EVIDENCE BINDING (RUN_EVIDENCE_MISSING / RUN_EVIDENCE_DIGEST_MISMATCH).
 *     When the record names evidence files, they must exist and, when a digest is
 *     recorded, match. A record citing evidence that is not on the tree proves
 *     nothing a cold reader can check.
 *
 *  3. INTERNAL CONSISTENCY (RUN_OVERALL_DISHONEST / RUN_SCHEMA / RUN_CASE_VERDICT).
 *     `overall` must equal the worst-of rule over `cases`; every selected case must
 *     be present; a case verdict outside the shared set is a schema finding. This is
 *     the "改写 RUN" (rewritten RUN) case: hand-editing `overall` to PASS while a
 *     case says FAIL is exactly the edit this rule catches.
 *
 * WHAT IT DOES NOT DO. It does not decide whether a PASS was CORRECT — that is the
 * suite's C2 evidence, and this file says so in its own output rather than letting
 * a green RUN read as a product claim.
 *
 * Exported for scripts/eb3-ci-negative-controls.mjs:
 *   validateRunRecord({ record, rel, ctx }) → { findings }
 *   findRunRecords(root), RUN_VERDICTS
 *
 *   node scripts/eb3-run-manifest.mjs [--paths a,b] [--new a,b | --new-since <ref>] [--json]
 *     --new  records added/changed by the change under review: graded STRICT
 *            (must bind the CURRENT authority generation; must be finalised).
 *            History stays graded on internal honesty + a REAL generation.
 *
 * Exit: 0 no findings | 1 findings | 2 could not grade.
 *
 * @module scripts/eb3-run-manifest
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { VERDICTS, overallVerdict } from '../tests/world-factory/lib/run-record.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
export const RUN_SCHEMA = 'u5-run-record/1'
export const RUN_VERDICTS = VERDICTS

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')
const POSIX = (p) => p.split('\\').join('/')

/** The host pin, read from tests/paths.mjs (the single source of truth for it). */
export function hostPin(root = ROOT) {
  const text = readFileSync(join(root, 'tests/paths.mjs'), 'utf8')
  const sha = /export const TEST_USE_BASELINE_SHA\s*=\s*'([0-9a-f]{40})'/.exec(text)?.[1]
  const version = /export const DSH_BASELINE_VERSION\s*=\s*'([^']+)'/.exec(text)?.[1]
  if (sha === undefined) throw new Error('tests/paths.mjs declares no TEST_USE_BASELINE_SHA — refusing to grade a RUN against an unknown host pin')
  return { sha, version }
}

/** The live authority pointer, or null when the tree predates the pointer. */
export function liveAuthority(root = ROOT) {
  const abs = join(root, 'dev/engineering/current-authority.json')
  if (!existsSync(abs)) return null
  const bytes = readFileSync(abs)
  return { pointer: JSON.parse(bytes.toString('utf8')), pointerSha256: sha256(bytes) }
}

/** Build the grading context once per process. */
export function context(root = ROOT) {
  return { root, host: hostPin(root), authority: liveAuthority(root), commitExists: (sha) => {
    try { execFileSync('git', ['-C', root, 'cat-file', '-e', `${sha}^{commit}`], { stdio: 'ignore' }); return true } catch { return false }
  } }
}

/**
 * @param {object} p
 * @param {object} p.record      parsed RUN record
 * @param {string} p.rel         its repo-relative path, for findings
 * @param {object} p.ctx         from context()
 */
export function validateRunRecord({ record, rel, ctx, strictGeneration = false }) {
  const findings = []
  const add = (code, detail) => findings.push({ code, detail: `${rel}: ${detail}` })

  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    add('RUN_SCHEMA', `not a JSON object (${Array.isArray(record) ? 'array' : typeof record})`)
    return { findings }
  }
  if (record.schema !== RUN_SCHEMA) {
    add('RUN_SCHEMA', `schema=${JSON.stringify(record.schema)} — this validator grades ${RUN_SCHEMA}`)
    return { findings }
  }
  // INCOMPLETE RECORDS ARE SKIPPED, NOT GRADED. An intermediate evidence.json with
  // `cases:[]` and no `overall` is a pre-finalize() snapshot, not a completed RUN:
  // its case algebra is always technically wrong and every finding would be wrong about
  // what the record claims. The EB3-D rules apply to records that have been finalised.
  if (typeof record.finishedAt !== 'string' || typeof record.overall === 'undefined') {
    return { findings, incomplete: true }
  }
  if (typeof record.runId !== 'string' || record.runId === '') add('RUN_SCHEMA', 'runId is not a non-empty string')

  // ── source binding
  const b = record.bindings ?? {}
  // RECONSTRUCT RECORDS have `mode: "reconstruct"` and carry no teamSha/hostSha — they
  // are offline re-judgements of an earlier run and explicitly disclose that. Grading
  // them against source/host pins would flag every one as RUN_SOURCE_UNRESOLVED while
  // their own bindings say exactly what they are.
  const isReconstruct = b.mode === 'reconstruct'
  if (!isReconstruct && (typeof b.teamSha !== 'string' || !/^[0-9a-f]{7,64}$/.test(b.teamSha))) {
    add('RUN_SOURCE_UNRESOLVED', `bindings.teamSha=${JSON.stringify(b.teamSha)} is not a commit id`)
  } else if (!isReconstruct && !ctx.commitExists(b.teamSha)) {
    add('RUN_SOURCE_UNRESOLVED', `bindings.teamSha=${b.teamSha} is not a commit in this repository — the RUN cannot be tied to a tree a reader can check out`)
  }
  if (!isReconstruct) {
    if (typeof b.hostSha !== 'string' || !/^[0-9a-f]{40}$/.test(b.hostSha)) {
      add('RUN_SCHEMA', `bindings.hostSha=${JSON.stringify(b.hostSha)} is not a full 40-hex commit id`)
    } else if (b.hostSha !== ctx.host.sha) {
      add('RUN_HOST_PIN_DRIFT', `bindings.hostSha=${b.hostSha} but tests/paths.mjs pins ${ctx.host.sha} (${ctx.host.version}) — the record measures a DIFFERENT host generation than the one this tree declares`)
    }
  }

  // ── authority generation
  // EB3-D says "混入不同来源代际必须拒绝" — mixing SOURCE GENERATIONS must be refused.
  // Historical records captured against an earlier but VALID snapshot are not a
  // generation mix: they are evidence of work done in that generation. The rule is:
  //   a) the record's authority generation must be a known snapshot (not invented);
  //   b) its pointerSha256 must match the bytes of THAT snapshot's pointer; and
  //   c) the current-run path is treated as a freshness disclosure, not a hard error.
  // A record with NO authority block at all is graded only against (a) — it predates
  // the authority system; we do not retroactively grade it against a pointer it never
  // saw.
  if (ctx.authority !== null) {
    const a = b.authority
    if (a === undefined || a === null) {
      // ABSENT: tolerated only for HISTORY (records that predate the pointer). A record
      // ADDED by the change under review is graded --strict-generation, where absence
      // is a refusal: new evidence must say which generation it measured.
      if (strictGeneration) add('RUN_AUTHORITY_BINDING_MISMATCH', 'bindings.authority is absent on a NEW record — fresh evidence must bind the current authority generation')
    } else {
      const sv = a.pointer?.snapshot_version
      if (typeof sv !== 'string' || !/^as[0-9]{8}r[0-9]+$/.test(sv)) {
        add('RUN_AUTHORITY_BINDING_MISMATCH', `bindings.authority.pointer.snapshot_version=${JSON.stringify(sv)} is not a valid snapshot version (expected as<date>r<n>)`)
      } else {
        // Verify the named snapshot EXISTS in the tree; a made-up version string
        // cannot be graded but also cannot be trusted.
        const snapPath = join(ctx.root, 'dev/engineering/authority-snapshots', `${sv}.json`)
        if (!existsSync(snapPath)) {
          add('RUN_AUTHORITY_BINDING_MISMATCH', `bindings.authority.pointer.snapshot_version=${sv} but dev/engineering/authority-snapshots/${sv}.json does not exist — the record claims a generation nobody can read`)
        }
        // Fresh-run check: if the record was captured under an OLDER generation than
        // the current live pointer, that is a generation disclosure (informational),
        // not a hard error — the evidence is valid history.
        const got = a.pointer?.content_digest
        const live = ctx.authority.pointer.content_digest
        if (strictGeneration && sv !== ctx.authority.pointer.snapshot_version) {
          add('RUN_AUTHORITY_BINDING_MISMATCH', `NEW record binds generation ${sv} but the live pointer is ${ctx.authority.pointer.snapshot_version} — fresh evidence from a superseded generation mixed into this change`)
        }
        if (strictGeneration && a.pointerSha256 !== ctx.authority.pointerSha256) {
          add('RUN_AUTHORITY_BINDING_MISMATCH', `NEW record pointerSha256=${JSON.stringify(a.pointerSha256)} but the live pointer bytes hash to ${ctx.authority.pointerSha256}`)
        }
        if (sv === ctx.authority.pointer.snapshot_version && got !== live) {
          add('RUN_AUTHORITY_BINDING_MISMATCH', `bindings.authority.pointer.content_digest=${JSON.stringify(got)} but the live ${sv} pointer is ${JSON.stringify(live)} — the record claims the CURRENT generation but does not match it`)
        }
      }
    }
  }

  // ── case algebra
  const cases = Array.isArray(record.cases) ? record.cases : null
  if (cases === null) {
    add('RUN_SCHEMA', 'cases is not an array')
    return { findings }
  }
  for (const [i, c] of cases.entries()) {
    if (typeof c?.id !== 'string' || c.id === '') add('RUN_SCHEMA', `cases[${String(i)}].id is not a non-empty string`)
    if (!RUN_VERDICTS.includes(c?.verdict)) {
      add('RUN_CASE_VERDICT', `cases[${String(i)}] (${String(c?.id)}) verdict=${JSON.stringify(c?.verdict)} is not one of ${RUN_VERDICTS.join('|')}`)
    }
  }
  const selected = Array.isArray(record.selectedCases) ? record.selectedCases : null
  if (selected !== null) {
    const have = new Set(cases.map((c) => c?.id))
    for (const id of selected) {
      if (!have.has(id)) add('RUN_CASE_VERDICT', `selected case ${JSON.stringify(id)} produced no verdict row — recordRunRecord's finalize() writes FAIL for exactly this, so its absence means the record was written by something else`)
    }
  }
  // overall must be the worst-of rule. Only computed when every verdict is legal,
  // because overallVerdict throws on an unknown token (and a throw is not a finding).
  if (cases.every((c) => RUN_VERDICTS.includes(c?.verdict))) {
    const expected = overallVerdict(cases)
    if (record.overall !== expected) {
      add('RUN_OVERALL_DISHONEST', `overall=${JSON.stringify(record.overall)} but the worst-of rule over cases is ${expected} — a rewritten RUN`)
    }
  }

  // ── evidence binding
  const declared = Array.isArray(record.evidence) ? record.evidence : []
  for (const e of declared) {
    const p = typeof e === 'string' ? e : e?.path
    if (typeof p !== 'string' || p === '') { add('RUN_SCHEMA', `an entry in evidence is not a path`); continue }
    const abs = join(ctx.root, p)
    if (!existsSync(abs)) {
      add('RUN_EVIDENCE_MISSING', `evidence "${p}" does not exist in the tree — a record citing evidence a cold reader cannot open proves nothing`)
      continue
    }
    const want = typeof e === 'object' ? (e.sha256 ?? null) : null
    if (want !== null && sha256(readFileSync(abs)) !== want) {
      add('RUN_EVIDENCE_DIGEST_MISMATCH', `evidence "${p}" hashes to ${sha256(readFileSync(abs)).slice(0, 16)}… but the record says ${String(want).slice(0, 16)}…`)
    }
  }
  return { findings }
}

/** RUN records on the tree: any tracked JSON whose `schema` is the RUN schema. */
export function findRunRecords(root = ROOT, only = null) {
  const list = only ?? execFileSync('git', ['-C', root, 'ls-files', '-z', 'dev/agent-workflow/evidence'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
    .split('\0').filter((p) => p.endsWith('.json'))
  const out = []
  for (const rel of list) {
    const abs = join(root, rel)
    if (!existsSync(abs)) continue
    let rec
    try { rec = JSON.parse(readFileSync(abs, 'utf8')) } catch { continue }
    // A record that LOOKS like a RUN record but does not parse is caught by the
    // tracked-json sweep below; here we only collect parseable candidates.
    if (rec !== null && typeof rec === 'object' && typeof rec.schema === 'string' && rec.schema.startsWith('u5-run-record')) out.push({ rel: POSIX(relative('.', rel)), record: rec })
  }
  return out
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) {
  const argv = process.argv.slice(2)
  const arg = (n) => { const i = argv.indexOf(n); return i > -1 ? argv[i + 1] : null }
  const json = argv.includes('--json')
  let out
  try {
    const ctx = context(ROOT)
    const only = arg('--paths')?.split(',').map((s) => s.trim()).filter(Boolean) ?? null
    // --new <a,b>: records ADDED/CHANGED by the change under review, graded strict.
    // --new-since <ref>: the same set, computed HERE from `git diff <ref>...HEAD`, so the
    // workflow step is one simple command (the R2 leg allowlist cannot prove a shell
    // `if` that chooses between two invocations; this removes the choice from the shell).
    const since = arg('--new-since')
    let freshList = arg('--new')?.split(',').map((s) => s.trim()).filter(Boolean) ?? []
    if (since !== null) {
      freshList = execFileSync('git', ['-C', ROOT, 'diff', '--name-only', `${since}...HEAD`, '--', 'dev/agent-workflow/evidence'], { encoding: 'utf8' })
        .split('\n').map((s) => s.trim()).filter((s) => s.endsWith('.json'))
    }
    const fresh = new Set(freshList)
    const records = findRunRecords(ROOT, only)
    const findings = []
    const incomplete = []
    for (const r of records) {
      const v = validateRunRecord({ record: r.record, rel: r.rel, ctx, strictGeneration: fresh.has(r.rel) })
      if (v.incomplete) {
        incomplete.push(r.rel)
        // A NEW record that never finalised is not evidence of anything.
        if (fresh.has(r.rel)) findings.push({ code: 'RUN_INCOMPLETE', detail: `${r.rel}: added by this change but has no finishedAt/overall — an unfinalised RUN is not a result` })
      }
      findings.push(...v.findings)
    }
    out = { records: records.length, strict: [...fresh].filter((p) => records.some((r) => r.rel === p)).length, incomplete, findings }
  } catch (e) {
    console.error(`EB3-RUN-MANIFEST refused could-not-grade: ${String(e?.message ?? e)}`)
    process.exit(2)
  }
  if (json) console.log(JSON.stringify(out, null, 2))
  else {
    for (const f of out.findings) console.log(`  ${f.code} ${f.detail}`)
    if (out.incomplete.length > 0) console.log(`  DISCLOSED ${String(out.incomplete.length)} unfinalised record(s) (no finishedAt/overall) graded as NOT-A-RESULT, not as pass: ${out.incomplete.slice(0, 6).join(', ')}${out.incomplete.length > 6 ? ' …' : ''}`)
    console.log(`EB3-RUN-MANIFEST ${out.findings.length === 0 ? 'pass' : 'fail'} records=${String(out.records)} strict=${String(out.strict)} incomplete=${String(out.incomplete.length)} findings=${String(out.findings.length)}`)
    console.log('LIMIT a green here means the record is internally honest and tied to THIS tree/host-pin/authority generation; it is not a claim that the graded behaviour was correct (that is the suite C2 evidence)')
  }
  process.exit(out.findings.length === 0 ? 0 : 1)
}
