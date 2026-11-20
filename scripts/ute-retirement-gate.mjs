#!/usr/bin/env node
/**
 * ute-retirement-gate.mjs — the machine gate on "may this tool family retire?"
 *
 * WHY THIS FILE EXISTS. UTE G1 permits the old governed tool families to be
 * replaced, one family at a time. The owner fixed the predicate (UTE-0, frozen
 * contract `docs/plans/memo/ute-g1-20261120/RETIREMENT.md`):
 *
 *   RetireAllowed = OldBaseline ∧ NewPathVerified
 *                 ∧ SemanticDifferencesResolved ∧ NegativeControlsPass
 *
 * A predicate that lives in a memo is a promise; a predicate that lives in a
 * ledger string is worse — it is the silent-green channel this repository keeps
 * closing (see ACCEPT_PROVEN_UNBACKED in `scripts/eb3-tool-acceptance.mjs`, and
 * `CLAIM_NOT_OBSERVABLE` in the FS witness). So the ledger ROW is not the
 * evidence: every term must point at a COMMITTED file, and this gate re-reads
 * that file and checks that it actually contains the verdict the row claims.
 * A row that trusts its own strings is exactly what this gate refuses.
 *
 * LEDGER: dev/agent-workflow/ledgers/ute-retirement.json (schema ute-retirement/1)
 *
 *   {
 *     "schema": "ute-retirement/1",
 *     "families": [{
 *       "family": "fs",
 *       "state": "NOT_RETIREABLE",             // mirror of the computed verdict
 *       "terms": {
 *         "oldBaseline": {
 *           "verdict": true,
 *           "evidence": { "path": "tests/…/old-path.tsv",
 *                         "expect": ["FS-W1-create"], "contradicts": [] }
 *         },
 *         "newPathVerified":       { … },
 *         "semanticDifferencesResolved": {
 *           "verdict": false,
 *           "differences": [{ "id": "lane-refusal-code", "blocking": true,
 *                             "approval": null }],
 *           "evidence": { "path": "…/SEMANTIC-DIFFERENCES.md",
 *                         "expect": ["retirement-blocking   YES"] }
 *         },
 *         "negativeControlsPass":  { … }
 *       }
 *     }]
 *   }
 *
 * TERM SEMANTICS (checked, never trusted):
 *   - `verdict` is the row's claim. A false claim is a refusal under that
 *     term's code; a true claim must be backed by evidence that PROVES it.
 *   - `evidence.path` must be a repo-relative path that git knows and the
 *     process can read, and must contain every `expect` token literally, and
 *     must contain none of the `contradicts` tokens. Else it is unreadable
 *     (missing/untracked) or contradicted (present but says something else).
 *   - `semanticDifferencesResolved` is NOT byte equality: the owner ruled it may
 *     be an APPROVED semantic change. The term is derived, not asserted — every
 *     difference with `blocking:true` must carry an `approval` whose `record` is
 *     itself a committed file naming the approver. An approval record that does
 *     not exist or does not name `by` is unreadable / contradicted evidence.
 *   - `state` is a display mirror. The verdict is computed from the terms; a row
 *     that says RETIREABLE while a term fails cannot become retireable by
 *     editing the state string, and a row whose terms all pass while it still
 *     says NOT_RETIREABLE is a contradiction (UTE_STATE_CONTRADICTED), never a
 *     pass.
 *
 * NAMED REFUSALS (exit 1; every one is a line the reviewer can grep):
 *   UTE_OLD_BASELINE_MISSING            oldBaseline term not established
 *   UTE_NEW_PATH_UNVERIFIED             newPathVerified term not established
 *   UTE_SEMANTIC_DIFFERENCES_UNRESOLVED a blocking difference has no approval
 *   UTE_NEGATIVE_CONTROLS_FAILING       negativeControlsPass term not established
 *   UTE_LEDGER_UNKNOWN_FAMILY           no row for the requested family
 *   UTE_EVIDENCE_UNREADABLE             pointer missing / untracked / no expect
 *   UTE_EVIDENCE_CONTRADICTED           file read, but not the claimed verdict
 *   UTE_STATE_CONTRADICTED              state=RETIREABLE while the terms fail
 *                                       cannot fabricate a pass (and the
 *                                       reverse is refused, not silently green)
 *
 *   UTE_LEDGER_SCHEMA (exit 2)          the ledger cannot be graded at all
 *
 * USAGE
 *   node scripts/ute-retirement-gate.mjs --family fs
 *   node scripts/ute-retirement-gate.mjs --all [--json]
 *   node scripts/ute-retirement-gate.mjs --family fs --ledger <path> --json
 *
 * EXIT: 0 every requested family is retireable | 1 at least one refused |
 *       2 could not grade (ledger absent/unparseable/wrong schema, bad argv).
 *
 * Exported for scripts/ute-retirement-gate.test.mjs:
 *   LEDGER_REL, LEDGER_SCHEMA, TERMS, TERM_REFUSAL_CODES, REFUSAL_CODES,
 *   loadLedger, defaultIsTracked, checkTerm, checkRetirement
 *
 * @module scripts/ute-retirement-gate
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

export const LEDGER_REL = 'dev/agent-workflow/ledgers/ute-retirement.json'
export const LEDGER_SCHEMA = 'ute-retirement/1'

/** The four terms of the owner's predicate, in predicate order. */
export const TERMS = Object.freeze([
  'oldBaseline',
  'newPathVerified',
  'semanticDifferencesResolved',
  'negativeControlsPass',
])

/** term → the named refusal code for "this term is not established". */
export const TERM_REFUSAL_CODES = Object.freeze({
  oldBaseline: 'UTE_OLD_BASELINE_MISSING',
  newPathVerified: 'UTE_NEW_PATH_UNVERIFIED',
  semanticDifferencesResolved: 'UTE_SEMANTIC_DIFFERENCES_UNRESOLVED',
  negativeControlsPass: 'UTE_NEGATIVE_CONTROLS_FAILING',
})

export const REFUSAL_CODES = Object.freeze([
  'UTE_OLD_BASELINE_MISSING',
  'UTE_NEW_PATH_UNVERIFIED',
  'UTE_SEMANTIC_DIFFERENCES_UNRESOLVED',
  'UTE_NEGATIVE_CONTROLS_FAILING',
  'UTE_LEDGER_UNKNOWN_FAMILY',
  'UTE_EVIDENCE_UNREADABLE',
  'UTE_EVIDENCE_CONTRADICTED',
  'UTE_STATE_CONTRADICTED',
])

/** States the gate understands. `RETIREABLE` is the only pass state. */
export const STATES = Object.freeze(['RETIREABLE', 'NOT_RETIREABLE', 'RETIRED'])
const PASS_STATE = 'RETIREABLE'

/** A repo-relative path: no absolute, no `..`, no empty segments. */
function safeRelPath(p) {
  if (typeof p !== 'string' || p.length === 0) return false
  if (isAbsolute(p)) return false
  const norm = normalize(p).split(sep).join('/')
  if (norm === '' || norm === '.' || norm.startsWith('../') || norm.includes('/../')) return false
  return norm === p.split(sep).join('/')
}

/**
 * The real committed-file test: `git ls-files --error-unmatch` over the tree
 * that owns the ledger. An evidence file that is not in the index (or is
 * ignored/untracked) can never back a retirement — a cold clone cannot open it.
 * Injected in tests so a fixture repo can use the same implementation.
 */
export function defaultIsTracked(root, relPath) {
  try {
    execFileSync('git', ['-C', root, 'ls-files', '--error-unmatch', '--', relPath], {
      stdio: ['ignore', 'ignore', 'ignore'],
    })
    return true
  } catch {
    return false
  }
}

/**
 * Read and verify ONE evidence pointer against its claimed verdict.
 *
 * @returns {{code: string, detail: string} | null} null when the evidence backs
 *          the claim; a named finding otherwise. Never returns "unknown as ok".
 */
export function checkTermEvidence({ evidence, root, readFile = (p) => readFileSync(p, 'utf8'), isTracked = defaultIsTracked }) {
  if (evidence === undefined || evidence === null || typeof evidence !== 'object') {
    return { code: 'UTE_EVIDENCE_UNREADABLE', detail: 'no evidence pointer (a verdict with no evidence is not a verdict)' }
  }
  const { path: rel, expect, contradicts } = evidence
  if (!safeRelPath(rel)) {
    return { code: 'UTE_EVIDENCE_UNREADABLE', detail: `evidence path ${JSON.stringify(rel)} is not a repo-relative path` }
  }
  if (!isTracked(root, rel)) {
    return { code: 'UTE_EVIDENCE_UNREADABLE', detail: `${rel} is not a committed file (git ls-files --error-unmatch refused it)` }
  }
  let text
  try {
    text = readFile(join(root, rel))
  } catch (e) {
    return { code: 'UTE_EVIDENCE_UNREADABLE', detail: `${rel} could not be read: ${String(e && e.message ? e.message : e)}` }
  }
  const expected = Array.isArray(expect) ? expect : []
  if (expected.length === 0) {
    // No tokens = no check = the silent-green channel. Refuse to grade it.
    return { code: 'UTE_EVIDENCE_UNREADABLE', detail: `${rel}: no \`expect\` tokens declared, so the claimed verdict is not checkable` }
  }
  const missing = expected.filter((token) => typeof token !== 'string' || token.length === 0 || !text.includes(token))
  if (missing.length > 0) {
    return {
      code: 'UTE_EVIDENCE_CONTRADICTED',
      detail: `${rel}: does not contain the claimed verdict token(s) ${missing.map((t) => JSON.stringify(t)).join(', ')}`,
    }
  }
  const forbidden = Array.isArray(contradicts) ? contradicts : []
  const present = forbidden.filter((token) => typeof token === 'string' && token.length > 0 && text.includes(token))
  if (present.length > 0) {
    return {
      code: 'UTE_EVIDENCE_CONTRADICTED',
      detail: `${rel}: contains ${present.map((t) => JSON.stringify(t)).join(', ')} — the file contradicts the claimed verdict`,
    }
  }
  return null
}

/** Is every retirement-blocking difference covered by a named approval? */
function evaluateDifferences(term, context) {
  const findings = []
  const differences = Array.isArray(term.differences) ? term.differences : null
  if (differences === null) {
    return {
      established: false,
      findings: [{ code: TERM_REFUSAL_CODES.semanticDifferencesResolved, detail: 'the term declares no `differences` list; "resolved" must be derived from the recorded differences, not asserted' }],
    }
  }
  let established = true
  for (const diff of differences) {
    if (diff === null || typeof diff !== 'object' || typeof diff.id !== 'string' || diff.id.length === 0) {
      findings.push({ code: TERM_REFUSAL_CODES.semanticDifferencesResolved, detail: 'a difference entry has no stable `id`' })
      established = false
      continue
    }
    const blocking = diff.blocking === true
    if (!blocking) continue
    const approval = diff.approval
    if (approval === null || approval === undefined) {
      findings.push({
        code: TERM_REFUSAL_CODES.semanticDifferencesResolved,
        detail: `blocking difference ${diff.id} has no owner approval (SemanticDifferencesResolved may be an APPROVED semantic change — it may not be silence)`,
      })
      established = false
      continue
    }
    if (typeof approval.by !== 'string' || approval.by.length === 0 || typeof approval.on !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(approval.on)) {
      findings.push({
        code: TERM_REFUSAL_CODES.semanticDifferencesResolved,
        detail: `blocking difference ${diff.id}: approval needs \`by\` (named approver) and \`on\` (YYYY-MM-DD)`,
      })
      established = false
      continue
    }
    const recordProblem = checkTermEvidence({
      evidence: { path: approval.record, expect: [approval.by], contradicts: [] },
      root: context.root,
      readFile: context.readFile,
      isTracked: context.isTracked,
    })
    if (recordProblem !== null) {
      findings.push({ ...recordProblem, detail: `blocking difference ${diff.id}: approval record — ${recordProblem.detail}` })
      established = false
    }
  }
  // An explicit `verdict:false` must not be overridden by an empty difference
  // list: a row that knows it is unresolved stays unresolved.
  if (term.verdict === false) established = false
  return { established, findings }
}

/**
 * Grade ONE term. `established` is derived where it can be derived; a bare
 * `verdict:true` is only a claim that the evidence must then prove.
 */
export function checkTerm({ name, term, context }) {
  const findings = []
  if (term === null || typeof term !== 'object') {
    return { established: false, findings: [{ code: TERM_REFUSAL_CODES[name], detail: 'term is absent' }] }
  }

  let established
  if (name === 'semanticDifferencesResolved') {
    const evaluated = evaluateDifferences(term, context)
    established = evaluated.established
    findings.push(...evaluated.findings)
    if (!established && !findings.some((f) => f.code === TERM_REFUSAL_CODES[name])) {
      findings.push({
        code: TERM_REFUSAL_CODES[name],
        detail: 'at least one retirement-blocking difference is not covered by an approved compatibility interface',
      })
    }
  } else {
    established = term.verdict === true
    if (!established) {
      findings.push({
        code: TERM_REFUSAL_CODES[name],
        detail: `term ${name} is ${JSON.stringify(term.verdict)} — the predicate requires it to be established`,
      })
    }
  }

  // Evidence is checked for EVERY term that carries a pointer, true or false:
  // a row that names a nonexistent or contradictory file is refused even when
  // (especially when) the verdict it claims is "blocking".
  const evidenceProblem = checkTermEvidence({
    evidence: term.evidence,
    root: context.root,
    readFile: context.readFile,
    isTracked: context.isTracked,
  })
  if (evidenceProblem !== null) findings.push(evidenceProblem)

  return { established, findings }
}

/** Grade one family row. Returns a verdict computed from the terms. */
export function evaluateFamily({ family, ledger, root = ROOT, readFile, isTracked = defaultIsTracked }) {
  const findings = []
  const families = Array.isArray(ledger?.families) ? ledger.families : []
  const row = families.find((f) => f !== null && typeof f === 'object' && f.family === family)
  if (row === undefined) {
    return {
      family,
      allowed: false,
      state: null,
      findings: [{ code: 'UTE_LEDGER_UNKNOWN_FAMILY', detail: `the ledger has no row for family ${JSON.stringify(family)} (known: ${families.map((f) => f?.family).filter(Boolean).join(', ') || 'none'})` }],
    }
  }

  const context = { root, readFile, isTracked }
  let allEstablished = true
  for (const name of TERMS) {
    const term = row.terms !== null && typeof row.terms === 'object' ? row.terms[name] : undefined
    const graded = checkTerm({ name, term, context })
    if (!graded.established) allEstablished = false
    findings.push(...graded.findings.map((f) => ({ ...f, term: name })))
  }

  const state = typeof row.state === 'string' ? row.state : null
  if (state === null || !STATES.includes(state)) {
    findings.push({ code: 'UTE_STATE_CONTRADICTED', detail: `state ${JSON.stringify(row.state)} is not one of ${STATES.join('|')}; the row cannot be graded` })
  } else if (allEstablished && state !== PASS_STATE) {
    findings.push({
      code: 'UTE_STATE_CONTRADICTED',
      detail: `all four terms are established but the row still says state=${state} — a human must flip it; the gate will not do it for them`,
    })
  } else if (!allEstablished && state === PASS_STATE) {
    findings.push({
      code: 'UTE_STATE_CONTRADICTED',
      detail: `state=RETIREABLE while the predicate is not satisfied — editing the state string does not establish a term`,
    })
  }

  const allowed = allEstablished && state === PASS_STATE && findings.length === 0
  return { family, allowed, state, findings }
}

/** Load + shape-check the ledger. Returns `{ledger}` or `{refused}` (exit 2). */
export function loadLedger({ root = ROOT, ledger } = {}) {
  let parsed
  if (ledger !== undefined && ledger !== null) {
    parsed = ledger
  } else {
    const abs = join(root, LEDGER_REL)
    if (!existsSync(abs)) return { refused: 'UTE_LEDGER_SCHEMA', detail: `${LEDGER_REL} does not exist` }
    let text
    try {
      text = readFileSync(abs, 'utf8')
    } catch (e) {
      return { refused: 'UTE_LEDGER_SCHEMA', detail: `${LEDGER_REL} could not be read: ${String(e && e.message ? e.message : e)}` }
    }
    try {
      parsed = JSON.parse(text)
    } catch (e) {
      return { refused: 'UTE_LEDGER_SCHEMA', detail: `${LEDGER_REL} is not JSON: ${String(e && e.message ? e.message : e)}` }
    }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { refused: 'UTE_LEDGER_SCHEMA', detail: 'the ledger is not a JSON object' }
  }
  if (parsed.schema !== LEDGER_SCHEMA) {
    return { refused: 'UTE_LEDGER_SCHEMA', detail: `schema is ${JSON.stringify(parsed.schema)}, expected ${JSON.stringify(LEDGER_SCHEMA)}` }
  }
  if (!Array.isArray(parsed.families)) {
    return { refused: 'UTE_LEDGER_SCHEMA', detail: '`families` must be an array' }
  }
  const seen = new Set()
  for (const row of parsed.families) {
    if (row === null || typeof row !== 'object' || typeof row.family !== 'string' || row.family.length === 0) {
      return { refused: 'UTE_LEDGER_SCHEMA', detail: 'every family row needs a non-empty string `family`' }
    }
    if (seen.has(row.family)) {
      return { refused: 'UTE_LEDGER_SCHEMA', detail: `duplicate family row ${JSON.stringify(row.family)} — one row per family` }
    }
    seen.add(row.family)
  }
  return { ledger: parsed }
}

/**
 * Grade one family (thin wrapper over load + evaluate) — the exported entry the
 * test suite drives with an in-memory ledger.
 */
export function checkRetirement({ ledger, family, root = ROOT, readFile, isTracked = defaultIsTracked }) {
  const loaded = loadLedger({ root, ledger })
  if (loaded.refused !== undefined) {
    return { allowed: false, couldNotGrade: loaded.refused, detail: loaded.detail, findings: [{ code: loaded.refused, detail: loaded.detail }] }
  }
  return evaluateFamily({ family, ledger: loaded.ledger, root, readFile, isTracked })
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function parseArgv(argv) {
  const out = { family: null, all: false, json: false, ledger: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--all') out.all = true
    else if (a === '--json') out.json = true
    else if (a === '--family') out.family = argv[++i] ?? null
    else if (a === '--ledger') out.ledger = argv[++i] ?? null
    else return { error: `unknown argument ${JSON.stringify(a)} (usage: --family <id> | --all, [--ledger <path>], [--json])` }
  }
  if (!out.all && (out.family === null || out.family.length === 0)) return { error: 'one of --family <id> or --all is required' }
  if (out.all && out.family !== null) return { error: '--all and --family are mutually exclusive' }
  return out
}

function main(argv) {
  const args = parseArgv(argv)
  if (args.error !== undefined) {
    console.error(`UTE-RETIREMENT-REFUSED code=UTE_LEDGER_SCHEMA detail=${JSON.stringify(args.error)}`)
    return 2
  }
  const root = args.ledger === null ? ROOT : ROOT
  const loaded = args.ledger === null
    ? loadLedger({ root })
    : (() => {
      const abs = resolve(process.cwd(), args.ledger)
      if (!existsSync(abs)) return { refused: 'UTE_LEDGER_SCHEMA', detail: `${args.ledger} does not exist` }
      let text
      try {
        text = readFileSync(abs, 'utf8')
      } catch (e) {
        return { refused: 'UTE_LEDGER_SCHEMA', detail: `${args.ledger} could not be read: ${String(e && e.message ? e.message : e)}` }
      }
      let parsed
      try {
        parsed = JSON.parse(text)
      } catch (e) {
        return { refused: 'UTE_LEDGER_SCHEMA', detail: `${args.ledger} is not JSON: ${String(e && e.message ? e.message : e)}` }
      }
      return loadLedger({ root, ledger: parsed })
    })()
  if (loaded.refused !== undefined) {
    if (args.json) console.log(JSON.stringify({ schema: 'ute-retirement-verdict/1', couldNotGrade: loaded.refused, detail: loaded.detail }, null, 2))
    else console.log(`UTE-RETIREMENT-REFUSED code=${loaded.refused} detail=${JSON.stringify(loaded.detail)}`)
    return 2
  }

  const families = args.all ? loaded.ledger.families.map((f) => f.family) : [args.family]
  const verdicts = families.map((family) => evaluateFamily({ family, ledger: loaded.ledger, root }))
  const refused = verdicts.filter((v) => !v.allowed)

  if (!args.json) {
    console.log(`UTE-RETIREMENT-GATE ledger=${args.ledger ?? LEDGER_REL} schema=${LEDGER_SCHEMA} families=${families.length}`)
    for (const v of verdicts) {
      if (v.allowed) {
        console.log(`UTE-RETIREMENT-ALLOW family=${v.family} terms=4/4 state=${PASS_STATE}`)
        continue
      }
      const codes = [...new Set(v.findings.map((f) => f.code))]
      console.log(`UTE-RETIREMENT-REFUSED family=${v.family} codes=${codes.join(',')} state=${v.state}`)
      for (const f of v.findings) {
        console.log(`  UTE-RETIREMENT-FINDING code=${f.code}${f.term ? ` term=${f.term}` : ''} detail=${JSON.stringify(f.detail)}`)
      }
    }
    console.log(`UTE-RETIREMENT-SUMMARY requested=${verdicts.length} allowed=${verdicts.length - refused.length} refused=${refused.length}`)
  } else {
    const payload = {
      schema: 'ute-retirement-verdict/1',
      ledger: args.ledger ?? LEDGER_REL,
      requested: verdicts.length,
      allowed: verdicts.filter((v) => v.allowed).map((v) => v.family),
      refused: refused.map((v) => ({
        family: v.family,
        state: v.state,
        codes: [...new Set(v.findings.map((f) => f.code))],
        findings: v.findings,
      })),
    }
    console.log(JSON.stringify(payload, null, 2))
  }
  return refused.length === 0 ? 0 : 1
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  process.exitCode = main(process.argv.slice(2))
}
