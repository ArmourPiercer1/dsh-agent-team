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
 * WHY THE UNIT IS DERIVED (external review of #795/#796, 2026-11-20). The first
 * revision was a consistency checker: the FS row claimed three terms from a
 * 10-vector corpus that covers `read`/`write`/`edit` and never `read_image`,
 * while the FS family is one indivisible four-tool assembly
 * (`packages/tools/families/fs.mjs` claims all four; a partial mount is refused
 * `PLANE_FS_FAMILY_INCOMPLETE`). A row must therefore declare `unit.familyId`
 * and the gate derives the members from the reviewed census
 * `dev/agent-workflow/ledgers/arc-a-family-census.json` — the row cannot shrink
 * the retirement unit to the tools it happened to verify. Coverage is then
 * measured from the baseline TSV's `entry` column and the new path's
 * `NEW-PATH-VECTOR <id>` lines, never from a self-asserted "read_image covered"
 * sentence. A failed coverage check makes the corresponding term NOT
 * established, so a partial corpus cannot be laundered into a green term.
 *
 * WHY DELETION IS CHECKED HERE TOO. The gate was also inert about deletion:
 * nothing ran it when someone removed the old path. Every row declares
 * `oldPath.files` (repo-relative, tracked); a file that is gone while the row is
 * not allowed is `UTE_OLD_PATH_PARTIALLY_REMOVED`. `scripts/eb3-family-definitions.mjs`
 * calls this module on the required CI leg, so a UTE-4 deletion PR is red before
 * a reviewer has to notice.
 *
 * LEDGER: dev/agent-workflow/ledgers/ute-retirement.json (schema ute-retirement/1)
 *
 *   {
 *     "schema": "ute-retirement/1",
 *     "families": [{
 *       "family": "fs",
 *       "unit": { "familyId": "dsh.fs-family" },     // members come from the census
 *       "oldPath": { "files": ["packages/tools/…"] }, // present unless allowed
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
 *                             "approval": { "by": "owner", "on": "2026-11-20",
 *                                           "record": "…/approval.md",
 *                                           "reference": "PR #123 @ <40-hex>" } }],
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
 *   - `semanticDifferencesResolved` is derived: every blocking difference needs
 *     an `approval` whose `record` is a committed file naming the approver AND
 *     whose `reference` is `PR #<n> @ <40-hex>` resolving to an ancestor of the
 *     graded HEAD. A name in a committed file proves transcription, not
 *     authority (RETIREMENT.md §3 P4b).
 *   - unit coverage is a PRECONDITION of a term being established, graded
 *     inside the term it invalidates (RETIREMENT.md §2): every member needs a
 *     baseline vector, every baseline vector must be reproduced, every covered
 *     member needs its own `NC-MEMBER <member>` control.
 *   - `state` is a display mirror. The verdict is computed from the terms; a row
 *     that says RETIREABLE while a term fails cannot become retireable by
 *     editing the state string, and a row whose terms all pass while it still
 *     says NOT_RETIREABLE is a contradiction (UTE_STATE_CONTRADICTED), never a
 *     pass.
 *
 * NAMED REFUSALS (exit 1; every one is a line the reviewer can grep):
 *   UTE_OLD_BASELINE_MISSING            oldBaseline term not established
 *   UTE_NEW_PATH_UNVERIFIED             newPathVerified term not established
 *   UTE_SEMANTIC_DIFFERENCES_UNRESOLVED a blocking difference has no bound approval
 *   UTE_NEGATIVE_CONTROLS_FAILING       negativeControlsPass term not established
 *   UTE_LEDGER_UNKNOWN_FAMILY           no row for the requested family
 *   UTE_EVIDENCE_UNREADABLE             pointer missing / untracked / no expect
 *   UTE_EVIDENCE_CONTRADICTED           file read, but not the claimed verdict
 *   UTE_STATE_CONTRADICTED              state=RETIREABLE while the terms fail
 *                                       cannot fabricate a pass (and the
 *                                       reverse is refused, not silently green)
 *   UTE_UNIT_UNDECLARED                 the row declares no retirement unit
 *   UTE_UNIT_UNKNOWN_FAMILY             unit.familyId is not in the census
 *   UTE_UNIT_UNDERCLAIMED               declared members are a strict subset
 *   UTE_UNIT_OVERCLAIMED                declared members are a strict superset
 *   UTE_UNIT_UNGRADABLE                 census/unit/baseline cannot be derived
 *   UTE_MEMBER_UNCOVERED                a member lacks baseline/reproduction/NC
 *   UTE_VECTOR_UNREPRODUCED             the new path did not reproduce a vector
 *   UTE_APPROVAL_UNREFERENCED           approval not bound to an ancestor commit
 *                                       (or bound to the root commit)
 *   UTE_APPROVAL_RECORD_INVALID         approval record is not a tracked
 *                                       dev/agent-workflow/approvals/ document,
 *                                       does not parse as ute-approval/1, or does
 *                                       not name THIS family/difference as
 *                                       approved with matching by/on/reference
 *   UTE_DIFFERENCE_SCHEMA_INVALID       a difference's `blocking` is not literally
 *                                       boolean (a string/1/absent is not false)
 *   UTE_DIFFERENCES_UNDECLARED          `differences: []` with no committed
 *                                       `SD-VERDICT differences=0` measurement —
 *                                       an empty list is "nobody said", not "none"
 *   UTE_OLD_PATH_UNDECLARED             the row declares no old-path file list
 *   UTE_OLD_PATH_PARTIALLY_REMOVED      a declared old-path file is gone early
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
 *       A missing `unit`/`oldPath` block is exit 1 (a graded refusal), never 2.
 *
 * Exported for scripts/ute-retirement-gate.test.mjs and
 * scripts/eb3-family-definitions.mjs:
 *   CENSUS_REL, LEDGER_REL, LEDGER_SCHEMA, APPROVALS_REL, APPROVAL_SCHEMA,
 *   TERMS, TERM_REFUSAL_CODES, REFUSAL_CODES, defaultIsTracked,
 *   defaultRevExists, defaultIsAncestor, defaultIsRootCommit,
 *   checkApprovalRecord, parseBaselineTsv, resolveUnit, checkUnitCoverage,
 *   checkOldPathPresence, checkTerm, loadLedger, evaluateFamily,
 *   checkRetirement
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
export const CENSUS_REL = 'dev/agent-workflow/ledgers/arc-a-family-census.json'
export const LEDGER_SCHEMA = 'ute-retirement/1'

/**
 * The ONLY directory an approval record may live in. A dedicated, boring,
 * greppable location is the point: "any committed file containing the word
 * `owner`" was the fabrication channel the 2026-11-21 review found, and a
 * directory whose contents are all approval documents removes it.
 */
export const APPROVALS_REL = 'dev/agent-workflow/approvals'
export const APPROVAL_SCHEMA = 'ute-approval/1'
export const APPROVAL_DECISIONS = Object.freeze(['approved', 'rejected', 'deferred'])

/** The measurement token that licenses `differences: []` (RETIREMENT.md §3). */
const ZERO_DIFFERENCES_TOKEN = 'SD-VERDICT differences=0'
const ZERO_DIFFERENCES_PATTERN = /(?:^|\s)SD-VERDICT differences=0(?=\s|$)/m

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
  'UTE_UNIT_UNDECLARED',
  'UTE_UNIT_UNKNOWN_FAMILY',
  'UTE_UNIT_UNDERCLAIMED',
  'UTE_UNIT_OVERCLAIMED',
  'UTE_UNIT_UNGRADABLE',
  'UTE_MEMBER_UNCOVERED',
  'UTE_VECTOR_UNREPRODUCED',
  'UTE_APPROVAL_UNREFERENCED',
  'UTE_APPROVAL_RECORD_INVALID',
  'UTE_DIFFERENCE_SCHEMA_INVALID',
  'UTE_DIFFERENCES_UNDECLARED',
  'UTE_OLD_PATH_UNDECLARED',
  'UTE_OLD_PATH_PARTIALLY_REMOVED',
])

/** States the gate understands. `RETIREABLE` is the only pass state. */
export const STATES = Object.freeze(['RETIREABLE', 'NOT_RETIREABLE', 'RETIRED'])
const PASS_STATE = 'RETIREABLE'

/** The only approval reference shape the gate accepts (RETIREMENT.md §3 P4b). */
const APPROVAL_REFERENCE = /^PR #\d+ @ ([0-9a-f]{40})$/

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
 * Does the 40-hex naming an approval resolve to a commit object here? An
 * approval reference that a cold clone cannot resolve is a string, not an
 * authorisation (RETIREMENT.md §3 P4b). Overridable in tests.
 */
export function defaultRevExists(root, sha) {
  try {
    execFileSync('git', ['-C', root, 'cat-file', '-e', `${sha}^{commit}`], {
      stdio: ['ignore', 'ignore', 'ignore'],
    })
    return true
  } catch {
    return false
  }
}

/**
 * Is that commit already on the graded HEAD's history? An approval of a commit
 * that only exists on a side branch is not merged authority.
 */
export function defaultIsAncestor(root, sha) {
  try {
    execFileSync('git', ['-C', root, 'merge-base', '--is-ancestor', sha, 'HEAD'], {
      stdio: ['ignore', 'ignore', 'ignore'],
    })
    return true
  } catch {
    return false
  }
}

/**
 * Is that commit the BEGINNING of history (no parent)? The 2026-11-21 review
 * fabricated an approval whose reference was the repository root commit: that
 * commit can never review a difference, so "is an ancestor" alone is not a
 * binding. Fail closed — a commit whose parents cannot be read is treated as
 * root, because an unprovable non-root is not a licence.
 */
export function defaultIsRootCommit(root, sha) {
  try {
    const out = execFileSync('git', ['-C', root, 'rev-list', '--parents', '-n', '1', sha], { encoding: 'utf8' })
    const fields = out.trim().split(/\s+/).filter((f) => f.length > 0)
    return fields.length <= 1
  } catch {
    return true
  }
}

/** Is `rel` a file path under the dedicated approvals directory (never the dir itself)? */
function isInsideApprovals(rel) {
  if (!safeRelPath(rel)) return false
  const norm = normalize(rel).split(sep).join('/')
  return norm.startsWith(`${APPROVALS_REL}/`) && norm.slice(APPROVALS_REL.length + 1).length > 0
}

/**
 * Verify that a blocking difference's approval RECORD is a real approval
 * document, not merely "a committed file that contains the approver's name".
 *
 * The record must:
 *   - live under `dev/agent-workflow/approvals/` (the dedicated, greppable dir);
 *   - be tracked by git (a cold clone can open it);
 *   - parse as JSON `ute-approval/1`;
 *   - name THIS family and THIS difference id;
 *   - decide `approved` (rejected/deferred are decisions, not approvals);
 *   - agree with the ledger's `by`/`on`/`reference` (the pointer and the
 *     document may not tell two different stories).
 *
 * @returns {{code: string, detail: string} | null} null when the record is a
 *          genuine, family-and-difference-specific approval.
 */
export function checkApprovalRecord({ approval, family, differenceId, context }) {
  const rel = approval?.record
  if (typeof rel !== 'string' || !isInsideApprovals(rel)) {
    return {
      code: 'UTE_APPROVAL_RECORD_INVALID',
      detail: `approval.record ${JSON.stringify(rel)} is not inside ${APPROVALS_REL}/ — only a dedicated approval document can licence a difference (a committed file that merely contains the approver's name is not one)`,
    }
  }
  if (!context.isTracked(context.root, rel)) {
    return {
      code: 'UTE_APPROVAL_RECORD_INVALID',
      detail: `${rel} is not a committed file (git ls-files --error-unmatch refused it), so a cold clone cannot read the approval`,
    }
  }
  let text
  try {
    text = context.readFile(join(context.root, rel))
  } catch (e) {
    return {
      code: 'UTE_APPROVAL_RECORD_INVALID',
      detail: `${rel} could not be read: ${String(e && e.message ? e.message : e)}`,
    }
  }
  let record
  try {
    record = JSON.parse(text)
  } catch (e) {
    return {
      code: 'UTE_APPROVAL_RECORD_INVALID',
      detail: `${rel} is not JSON (${String(e && e.message ? e.message : e)}); an approval record is a machine-readable ute-approval/1 document`,
    }
  }
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    return { code: 'UTE_APPROVAL_RECORD_INVALID', detail: `${rel} is not a JSON object` }
  }
  if (record.schema !== APPROVAL_SCHEMA) {
    return {
      code: 'UTE_APPROVAL_RECORD_INVALID',
      detail: `${rel}: schema is ${JSON.stringify(record.schema)}, expected ${JSON.stringify(APPROVAL_SCHEMA)}`,
    }
  }
  for (const field of ['family', 'difference', 'by', 'on', 'reference', 'rationale']) {
    if (typeof record[field] !== 'string' || record[field].length === 0) {
      return { code: 'UTE_APPROVAL_RECORD_INVALID', detail: `${rel}: \`${field}\` must be a non-empty string` }
    }
  }
  if (record.family !== family) {
    return {
      code: 'UTE_APPROVAL_RECORD_INVALID',
      detail: `${rel}: approval is for family ${JSON.stringify(record.family)}, not ${JSON.stringify(family)} — an approval is not transferable across families`,
    }
  }
  if (record.difference !== differenceId) {
    return {
      code: 'UTE_APPROVAL_RECORD_INVALID',
      detail: `${rel}: approval is for difference ${JSON.stringify(record.difference)}, not ${JSON.stringify(differenceId)} — an approval of one difference is not an approval of another`,
    }
  }
  if (record.decision !== 'approved') {
    return {
      code: 'UTE_APPROVAL_RECORD_INVALID',
      detail: `${rel}: decision is ${JSON.stringify(record.decision)}, expected "approved" (one of ${APPROVAL_DECISIONS.join('|')}); a deferred or rejected difference is not resolved`,
    }
  }
  if (record.by !== approval.by) {
    return {
      code: 'UTE_APPROVAL_RECORD_INVALID',
      detail: `${rel}: record names approver ${JSON.stringify(record.by)} but the ledger says ${JSON.stringify(approval.by)} — the pointer and the document disagree`,
    }
  }
  if (record.on !== approval.on) {
    return {
      code: 'UTE_APPROVAL_RECORD_INVALID',
      detail: `${rel}: record is dated ${JSON.stringify(record.on)} but the ledger says ${JSON.stringify(approval.on)}`,
    }
  }
  if (record.reference !== approval.reference) {
    return {
      code: 'UTE_APPROVAL_RECORD_INVALID',
      detail: `${rel}: record references ${JSON.stringify(record.reference)} but the ledger says ${JSON.stringify(approval.reference)} — the binding must be the same in both places`,
    }
  }
  return null
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

/**
 * Resolve the retirement UNIT for a row from the census, never from the row.
 *
 * WHY: the FS family is an indivisible four-tool assembly (one Registry
 * candidate, `PLANE_FS_FAMILY_INCOMPLETE` on a partial mount). A row that
 * declares only the three tools its corpus happens to cover is under-claiming
 * the unit, so a green `read`/`write`/`edit` could have unlocked retiring a
 * family that was never verified. `familyId` is the row's only choice; the
 * members come from the reviewed census.
 *
 * @returns {{members: string[], findings: Array<{code: string, detail: string}>}}
 */
export function resolveUnit({ row, census, root = ROOT, readFile = (p) => readFileSync(p, 'utf8'), isTracked = defaultIsTracked }) {
  const findings = []
  const familyId = row?.unit?.familyId
  if (typeof familyId !== 'string' || familyId.length === 0) {
    return {
      members: [],
      findings: [{
        code: 'UTE_UNIT_UNDECLARED',
        detail: 'the row has no non-empty `unit.familyId`; without a declared unit the family cannot be graded (a row without a unit is not conservatively small, it is ungradable)',
      }],
    }
  }

  let book
  if (census !== undefined && census !== null) {
    book = census
  } else {
    if (!isTracked(root, CENSUS_REL)) {
      return {
        members: [],
        findings: [{
          code: 'UTE_UNIT_UNGRADABLE',
          detail: `${CENSUS_REL} is not a committed file, so the retirement unit cannot be derived (fail closed: an unbooked unit is not a smaller unit)`,
        }],
      }
    }
    try {
      book = readFile(join(root, CENSUS_REL))
    } catch (e) {
      return {
        members: [],
        findings: [{ code: 'UTE_UNIT_UNGRADABLE', detail: `${CENSUS_REL} could not be read: ${String(e && e.message ? e.message : e)}` }],
      }
    }
  }
  if (typeof book === 'string') {
    try {
      book = JSON.parse(book)
    } catch (e) {
      return {
        members: [],
        findings: [{ code: 'UTE_UNIT_UNGRADABLE', detail: `${CENSUS_REL} is not JSON: ${String(e && e.message ? e.message : e)}` }],
      }
    }
  }
  if (book === null || typeof book !== 'object' || !Array.isArray(book.families)) {
    return {
      members: [],
      findings: [{ code: 'UTE_UNIT_UNGRADABLE', detail: `${CENSUS_REL} is not an object with a \`families\` array, so no unit can be derived` }],
    }
  }

  const entry = book.families.find((f) => f !== null && typeof f === 'object' && f.familyId === familyId)
  if (entry === undefined) {
    const known = book.families.map((f) => f?.familyId).filter((id) => typeof id === 'string')
    return {
      members: [],
      findings: [{
        code: 'UTE_UNIT_UNKNOWN_FAMILY',
        detail: `unit.familyId ${JSON.stringify(familyId)} is not booked in ${CENSUS_REL} (known: ${known.join(', ') || 'none'})`,
      }],
    }
  }

  const nativeNames = entry.nativeNames
  if (!Array.isArray(nativeNames) || nativeNames.length === 0 || !nativeNames.every((n) => typeof n === 'string')) {
    return {
      members: [],
      findings: [{
        code: 'UTE_UNIT_UNGRADABLE',
        detail: `${CENSUS_REL} books family ${JSON.stringify(familyId)} without a non-empty string array \`nativeNames\`, so its unit cannot be derived`,
      }],
    }
  }
  const members = []
  for (const raw of nativeNames) {
    const name = raw.replace(/^\(bound-definition\)\s+/, '').trim()
    if (name.length === 0) continue
    if (!members.includes(name)) members.push(name) // census order, deduplicated
  }
  if (members.length === 0) {
    return {
      members: [],
      findings: [{
        code: 'UTE_UNIT_UNGRADABLE',
        detail: `${CENSUS_REL} books family ${JSON.stringify(familyId)} with no usable member names after stripping the \`(bound-definition)\` prefix`,
      }],
    }
  }

  if (row.unit.members !== undefined) {
    const declared = row.unit.members
    if (!Array.isArray(declared) || !declared.every((m) => typeof m === 'string' && m.length > 0)) {
      findings.push({
        code: 'UTE_UNIT_UNGRADABLE',
        detail: `unit.members must be an array of non-empty strings when present; it is ${JSON.stringify(declared)} — the declared unit cannot be compared to the census unit`,
      })
    } else {
      const declaredUnique = [...new Set(declared)]
      const missing = members.filter((m) => !declaredUnique.includes(m))
      const extra = declaredUnique.filter((m) => !members.includes(m))
      if (missing.length > 0) {
        findings.push({
          code: 'UTE_UNIT_UNDERCLAIMED',
          detail: `unit.members omits ${missing.map((m) => JSON.stringify(m)).join(', ')}; the census unit for ${JSON.stringify(familyId)} is ${members.map((m) => JSON.stringify(m)).join(', ')} — a family retires as its whole assembly, not as the tools a corpus happened to cover`,
        })
      }
      if (extra.length > 0) {
        findings.push({
          code: 'UTE_UNIT_OVERCLAIMED',
          detail: `unit.members adds ${extra.map((m) => JSON.stringify(m)).join(', ')} that the census does not book for ${JSON.stringify(familyId)} — editing the ledger is not a unit split`,
        })
      }
    }
  }

  return { members, findings }
}

/**
 * Parse the old-path baseline record as a TSV. The `id` column names a vector;
 * the `entry` column names the tool that produced the observed effect. Coverage
 * is derived from these measured columns, never from a sentence in the ledger.
 *
 * @returns {{vectors: Array<{id: string, entry: string}>} | {error: string}}
 */
export function parseBaselineTsv(text) {
  const lines = String(text).split(/\r?\n/)
  let header = null
  let headerLine = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() === '') continue
    header = lines[i].split('\t').map((cell) => cell.trim())
    headerLine = i
    break
  }
  if (header === null) return { error: 'the baseline file is empty (no header row)' }
  const idIndex = header.indexOf('id')
  const entryIndex = header.indexOf('entry')
  if (idIndex < 0 || entryIndex < 0) {
    return { error: `the header needs exact \`id\` and \`entry\` columns, got ${header.map((h) => JSON.stringify(h)).join(', ')}` }
  }
  const vectors = []
  for (let i = headerLine + 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '') continue
    const cells = lines[i].split('\t')
    if (cells.length < header.length) {
      return { error: `data row ${String(i + 1)} has ${String(cells.length)} column(s) but the header has ${String(header.length)}; refusing to guess which member a short row measured` }
    }
    vectors.push({ id: cells[idIndex].trim(), entry: cells[entryIndex].trim() })
  }
  return { vectors }
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Read a repo-relative evidence file for coverage; absent/unreadable text is empty. */
function readCoverageText(rel, root, readFile, isTracked) {
  if (!safeRelPath(rel)) return { rel, text: '', problem: `evidence path ${JSON.stringify(rel)} is not repo-relative` }
  // Coverage is derived from COMMITTED artifacts only: an untracked file can be
  // edited freely, so it cannot establish which members the corpus measured.
  if (!isTracked(root, rel)) return { rel, text: '', problem: `${rel} is not a committed file` }
  try {
    return { rel, text: readFile(join(root, rel)), problem: null }
  } catch (e) {
    return { rel, text: '', problem: `${rel} could not be read: ${String(e && e.message ? e.message : e)}` }
  }
}

/**
 * Derive unit coverage from the artifacts themselves (RETIREMENT.md §2):
 *   - every member has at least one baseline vector (`entry` column);
 *   - every baseline vector id appears as `NEW-PATH-VECTOR <id> PASS`;
 *   - every covered member has its own `NC-MEMBER <member>` control line.
 *
 * The returned findings carry the `term` they invalidate, so `evaluateFamily`
 * can make that term NOT established. A failed coverage check is not a warning:
 * a term whose unit was never measured is not evidence about the unit.
 *
 * @returns {{findings: Array<{code: string, term: string, detail: string}>,
 *            coverage: {oldBaseline: string[], newPathVerified: string[], negativeControlsPass: string[]}}}
 */
export function checkUnitCoverage({ members, row, root = ROOT, readFile = (p) => readFileSync(p, 'utf8'), isTracked = defaultIsTracked }) {
  const findings = []
  const coverage = { oldBaseline: [], newPathVerified: [], negativeControlsPass: [] }
  const baselinePointer = row?.terms?.oldBaseline?.evidence?.path
  const baseline = readCoverageText(baselinePointer, root, readFile, isTracked)
  if (baseline.problem !== null) {
    return {
      findings: [{
        code: 'UTE_UNIT_UNGRADABLE',
        term: 'oldBaseline',
        detail: `${baseline.problem} — the baseline record cannot be parsed, so unit coverage cannot be derived (refusing to guess)`,
      }],
      coverage,
    }
  }
  const parsed = parseBaselineTsv(baseline.text)
  if (parsed.error !== undefined) {
    return {
      findings: [{
        code: 'UTE_UNIT_UNGRADABLE',
        term: 'oldBaseline',
        detail: `${baseline.rel}: ${parsed.error}`,
      }],
      coverage,
    }
  }
  const vectors = parsed.vectors
  const baselineEntries = new Set(vectors.map((v) => v.entry))
  for (const member of members) {
    if (baselineEntries.has(member)) coverage.oldBaseline.push(member)
    else {
      findings.push({
        code: 'UTE_MEMBER_UNCOVERED',
        term: 'oldBaseline',
        detail: `member ${JSON.stringify(member)} has no baseline vector: ${baseline.rel} has no \`entry\` value ${JSON.stringify(member)} (entries: ${[...baselineEntries].map((e) => JSON.stringify(e)).join(', ') || 'none'})`,
      })
    }
  }

  // New path: the prototype's own transcript must reproduce every baseline
  // vector. A `GREEN vectors=10` summary is not enough — the ids are checked.
  const newPointer = row?.terms?.newPathVerified?.evidence?.path
  const newPath = readCoverageText(newPointer, root, readFile, isTracked)
  const reproduced = new Set()
  for (const vector of vectors) {
    if (vector.id.length === 0) {
      findings.push({
        code: 'UTE_UNIT_UNGRADABLE',
        term: 'newPathVerified',
        detail: `${baseline.rel}: a baseline vector has an empty \`id\`, so the new path cannot be asked to reproduce it`,
      })
      continue
    }
    const token = `NEW-PATH-VECTOR ${vector.id} PASS`
    if (newPath.text.includes(token)) reproduced.add(vector.id)
    else {
      findings.push({
        code: 'UTE_VECTOR_UNREPRODUCED',
        term: 'newPathVerified',
        detail: `vector ${JSON.stringify(vector.id)} is not reproduced: ${newPath.rel} does not contain ${JSON.stringify(token)}`,
      })
    }
  }
  for (const member of members) {
    const mine = vectors.filter((v) => v.entry === member)
    if (mine.some((v) => reproduced.has(v.id))) coverage.newPathVerified.push(member)
    else {
      // A member with NO baseline vector is also uncovered on this axis: it has
      // nothing to reproduce, which is exactly the FS `read_image` state that
      // the external review found hidden behind a green "vectors=10" summary
      // (RETIREMENT.md §6). "Not measured" is refused, never skipped.
      findings.push({
        code: 'UTE_MEMBER_UNCOVERED',
        term: 'newPathVerified',
        detail: mine.length === 0
          ? `member ${JSON.stringify(member)} has no baseline vector to reproduce, so ${newPath.rel || 'the new-path evidence'} cannot have verified it`
          : `member ${JSON.stringify(member)} has baseline vector(s) ${mine.map((v) => JSON.stringify(v.id)).join(', ')} but none is reproduced by ${newPath.rel || 'the new-path evidence'}`,
      })
    }
  }

  // Negative controls: a family-level `NC-VERDICT GREEN controls=4` proves the
  // harness bites somewhere, not that it bites each member. The FS corpus has
  // four family-level controls and none for a member, which is why FS is
  // refused for this axis even after read/write/edit are covered.
  const ncPointer = row?.terms?.negativeControlsPass?.evidence?.path
  const nc = readCoverageText(ncPointer, root, readFile, isTracked)
  for (const member of members) {
    if (!vectors.some((v) => v.entry === member)) continue
    const token = new RegExp(`(?:^|\\s)NC-MEMBER\\s+${escapeRegExp(member)}(?=\\s|$)`, 'm')
    if (token.test(nc.text)) coverage.negativeControlsPass.push(member)
    else {
      findings.push({
        code: 'UTE_MEMBER_UNCOVERED',
        term: 'negativeControlsPass',
        detail: `member ${JSON.stringify(member)} has baseline evidence but ${nc.rel || 'the negative-control evidence'} contains no \`NC-MEMBER ${member}\` control line`,
      })
    }
  }

  return { findings, coverage }
}

/**
 * The committed measurement that licenses `differences: []`. An empty array is
 * NOT "we compared and found none" — it is "nobody said what the comparison
 * found". Only a committed file carrying the exact token
 * `SD-VERDICT differences=0` turns emptiness into a measurement.
 */
function checkZeroDifferencesMeasurement(term, context) {
  const rel = term?.evidence?.path
  if (typeof rel !== 'string' || !safeRelPath(rel) || !context.isTracked(context.root, rel)) {
    return {
      code: 'UTE_DIFFERENCES_UNDECLARED',
      detail: `the term declares an EMPTY \`differences\` list and names no committed measurement file, so "we compared and found none" is asserted, not shown (an empty list means nobody said what the comparison found)`,
    }
  }
  let text
  try {
    text = context.readFile(join(context.root, rel))
  } catch (e) {
    return {
      code: 'UTE_DIFFERENCES_UNDECLARED',
      detail: `${rel} could not be read (${String(e && e.message ? e.message : e)}); an empty \`differences\` list needs a readable ${JSON.stringify(ZERO_DIFFERENCES_TOKEN)} measurement`,
    }
  }
  if (!ZERO_DIFFERENCES_PATTERN.test(text)) {
    return {
      code: 'UTE_DIFFERENCES_UNDECLARED',
      detail: `${rel} does not contain the exact measurement token ${JSON.stringify(ZERO_DIFFERENCES_TOKEN)} — an empty list is "nobody said", not "we compared and found none"`,
    }
  }
  return null
}

/** Is every retirement-blocking difference covered by a named, bound approval? */
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
  if (differences.length === 0) {
    const zero = checkZeroDifferencesMeasurement(term, context)
    if (zero !== null) {
      findings.push(zero)
      established = false
    }
  }
  for (const diff of differences) {
    if (diff === null || typeof diff !== 'object' || typeof diff.id !== 'string' || diff.id.length === 0) {
      findings.push({ code: TERM_REFUSAL_CODES.semanticDifferencesResolved, detail: 'a difference entry has no stable `id`' })
      established = false
      continue
    }
    // `blocking` is a schema fact, not a truthiness test. A string "yes", the
    // number 1, or an absent key must be REFUSED as a schema error: treating any
    // of them as non-blocking is the silent-green channel the 2026-11-21 review
    // reproduced (`blocking: "yes"` skipped the approval requirement entirely).
    if (typeof diff.blocking !== 'boolean') {
      findings.push({
        code: 'UTE_DIFFERENCE_SCHEMA_INVALID',
        detail: `difference ${diff.id}: \`blocking\` must be the boolean true or false, got ${JSON.stringify(diff.blocking)} — a string, a number or an absent key is a schema error, not "non-blocking"`,
      })
      established = false
      continue
    }
    if (diff.blocking === false) continue
    const approval = diff.approval
    if (approval === null || approval === undefined) {
      // The refusal text carries the difference's OWN recorded status (its
      // `summary`), so a route ruling ("B+C adopted, approval PENDING") is
      // visible in the gate output without being mistaken for an approval.
      // This is message enrichment only: the branch still refuses, and an
      // annotation can never establish the term.
      const recorded = typeof diff.summary === 'string' && diff.summary.length > 0
        ? `; recorded status: ${diff.summary}`
        : ''
      findings.push({
        code: TERM_REFUSAL_CODES.semanticDifferencesResolved,
        detail: `blocking difference ${diff.id} has no owner approval (SemanticDifferencesResolved may be an APPROVED semantic change — it may not be silence)${recorded}`,
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
    // Legacy check (kept, not replaced): the record is a committed file that
    // literally contains the approver's name. It is necessary but not
    // sufficient — see the dedicated-record check below.
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
    // The dedicated record must be a real ute-approval/1 document inside
    // dev/agent-workflow/approvals/, naming THIS family and THIS difference.
    const recordCheck = checkApprovalRecord({ approval, family: context.family, differenceId: diff.id, context })
    if (recordCheck !== null) {
      findings.push({ ...recordCheck, detail: `blocking difference ${diff.id}: ${recordCheck.detail}` })
      established = false
    }
    // P4b (RETIREMENT.md §3): a name in a committed file proves transcription,
    // not authority. The approval must name a PR and a merge commit that exists
    // here AND is already an ancestor of the graded HEAD — and it must not be
    // the root commit (the beginning of history reviewed nothing).
    const reference = approval.reference
    const match = typeof reference === 'string' ? APPROVAL_REFERENCE.exec(reference) : null
    if (match === null) {
      findings.push({
        code: 'UTE_APPROVAL_UNREFERENCED',
        detail: `blocking difference ${diff.id}: approval.reference is absent or not \`PR #<n> @ <40-hex>\` (got ${JSON.stringify(reference)}) — a transcribed name is not a bound approval`,
      })
      established = false
    } else {
      const sha = match[1]
      const exists = context.revExists(context.root, sha)
      const ancestor = exists && context.isAncestor(context.root, sha)
      if (!exists || !ancestor) {
        findings.push({
          code: 'UTE_APPROVAL_UNREFERENCED',
          detail: `blocking difference ${diff.id}: approval reference commit ${sha} ${exists ? 'is not an ancestor of HEAD' : 'does not exist in this repository'} — the approval is not traceable to a merged act`,
        })
        established = false
      } else if (context.isRootCommit(context.root, sha)) {
        findings.push({
          code: 'UTE_APPROVAL_UNREFERENCED',
          detail: `blocking difference ${diff.id}: approval reference commit ${sha} is the root commit (no parent) — the beginning of history is not a review of a difference`,
        })
        established = false
      }
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

/**
 * The deletion half of the gate (RETIREMENT.md §5.1): a declared old-path file
 * that is gone while the row is not allowed is retirement happening without a
 * licence. When the row IS allowed the same absence is expected, not a finding.
 */
export function checkOldPathPresence({ row, allowed, root = ROOT, fileExists = existsSync, isTracked = defaultIsTracked }) {
  const files = row?.oldPath?.files
  if (!Array.isArray(files) || files.length === 0 || !files.every(safeRelPath)) {
    return {
      findings: [{
        code: 'UTE_OLD_PATH_UNDECLARED',
        detail: 'oldPath.files must be a non-empty array of repo-relative paths; an undeclared old path makes early deletion invisible, so it is refused',
      }],
    }
  }
  const missing = []
  for (const rel of new Set(files)) {
    if (!fileExists(join(root, rel)) || !isTracked(root, rel)) missing.push(rel)
  }
  if (missing.length > 0 && !allowed) {
    return {
      findings: [{
        code: 'UTE_OLD_PATH_PARTIALLY_REMOVED',
        detail: `declared old-path file(s) ${missing.map((p) => JSON.stringify(p)).join(', ')} are gone or untracked while the row is not allowed — deleting the implementation before the gate allows is the UTE-4 act run backwards`,
      }],
    }
  }
  return { findings: [] }
}

/** Grade one family row. Returns a verdict computed from the terms. */
export function evaluateFamily({
  family,
  ledger,
  root = ROOT,
  readFile = (p) => readFileSync(p, 'utf8'),
  isTracked = defaultIsTracked,
  fileExists = existsSync,
  revExists = defaultRevExists,
  isAncestor = defaultIsAncestor,
  isRootCommit = defaultIsRootCommit,
}) {
  const findings = []
  const families = Array.isArray(ledger?.families) ? ledger.families : []
  const row = families.find((f) => f !== null && typeof f === 'object' && f.family === family)
  if (row === undefined) {
    return {
      family,
      allowed: false,
      state: null,
      terms: null,
      unit: null,
      coverage: null,
      findings: [{ code: 'UTE_LEDGER_UNKNOWN_FAMILY', detail: `the ledger has no row for family ${JSON.stringify(family)} (known: ${families.map((f) => f?.family).filter(Boolean).join(', ') || 'none'})` }],
    }
  }

  const context = { root, readFile, isTracked, revExists, isAncestor, isRootCommit, family }

  // The unit is resolved from the census, not from the row. A row without a
  // gradable unit cannot establish any term (unit coverage is a precondition).
  const resolved = resolveUnit({ row, root, readFile, isTracked })
  findings.push(...resolved.findings.map((f) => ({ ...f, term: 'unit' })))
  const members = resolved.members
  const unitGradable = resolved.findings.length === 0 && members.length > 0

  const establishedByTerm = {}
  for (const name of TERMS) {
    const term = row.terms !== null && typeof row.terms === 'object' ? row.terms[name] : undefined
    const graded = checkTerm({ name, term, context })
    establishedByTerm[name] = graded.established
    findings.push(...graded.findings.map((f) => ({ ...f, term: name })))
  }

  let coverage = { oldBaseline: [], newPathVerified: [], negativeControlsPass: [] }
  if (unitGradable) {
    const gradedCoverage = checkUnitCoverage({ members, row, root, readFile, isTracked })
    coverage = gradedCoverage.coverage
    for (const finding of gradedCoverage.findings) {
      // A term whose unit was never measured cannot count toward `allowed`.
      if (TERMS.includes(finding.term)) establishedByTerm[finding.term] = false
    }
    findings.push(...gradedCoverage.findings)
  }

  const allEstablished = unitGradable && TERMS.every((name) => establishedByTerm[name] === true)
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

  const prelimAllowed = allEstablished && state === PASS_STATE && findings.length === 0
  const oldPath = checkOldPathPresence({ row, allowed: prelimAllowed, root, fileExists, isTracked })
  findings.push(...oldPath.findings.map((f) => ({ ...f, term: 'oldPath' })))

  const allowed = prelimAllowed && oldPath.findings.length === 0
  return {
    family,
    allowed,
    state,
    terms: establishedByTerm,
    unit: {
      familyId: typeof row.unit?.familyId === 'string' ? row.unit.familyId : null,
      members,
      declared: Array.isArray(row.unit?.members) ? row.unit.members : null,
    },
    coverage,
    findings,
  }
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
    // A missing `unit` / `oldPath` block is NOT a schema failure: it is a graded
    // refusal (exit 1, UTE_UNIT_UNDECLARED / UTE_OLD_PATH_UNDECLARED). Only a
    // ledger that cannot be graded at all is exit 2.
  }
  return { ledger: parsed }
}

/**
 * Grade one family (thin wrapper over load + evaluate) — the exported entry the
 * test suite drives with an in-memory ledger.
 */
export function checkRetirement({
  ledger,
  family,
  root = ROOT,
  readFile = (p) => readFileSync(p, 'utf8'),
  isTracked = defaultIsTracked,
  fileExists = existsSync,
  revExists = defaultRevExists,
  isAncestor = defaultIsAncestor,
  isRootCommit = defaultIsRootCommit,
}) {
  const loaded = loadLedger({ root, ledger })
  if (loaded.refused !== undefined) {
    return { allowed: false, couldNotGrade: loaded.refused, detail: loaded.detail, findings: [{ code: loaded.refused, detail: loaded.detail }] }
  }
  return evaluateFamily({ family, ledger: loaded.ledger, root, readFile, isTracked, fileExists, revExists, isAncestor, isRootCommit })
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

/** `<members with baseline+reproduction+NC>/<census members>` — the allow-line unit fact. */
function unitFact(verdict) {
  const members = Array.isArray(verdict?.unit?.members) ? verdict.unit.members : []
  const coverage = verdict?.coverage ?? {}
  const covered = members.filter((m) =>
    (coverage.oldBaseline ?? []).includes(m)
    && (coverage.newPathVerified ?? []).includes(m)
    && (coverage.negativeControlsPass ?? []).includes(m))
  return { covered, total: members.length, text: `${String(covered.length)}/${String(members.length)}` }
}

function coveragePayload(verdict) {
  return {
    oldBaseline: verdict?.coverage?.oldBaseline ?? [],
    newPathVerified: verdict?.coverage?.newPathVerified ?? [],
    negativeControlsPass: verdict?.coverage?.negativeControlsPass ?? [],
  }
}

function main(argv) {
  const args = parseArgv(argv)
  if (args.error !== undefined) {
    console.error(`UTE-RETIREMENT-REFUSED code=UTE_LEDGER_SCHEMA detail=${JSON.stringify(args.error)}`)
    return 2
  }
  const root = ROOT
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
      const unit = unitFact(v)
      if (v.allowed) {
        console.log(`UTE-RETIREMENT-ALLOW family=${v.family} terms=4/4 unit=${unit.text} state=${PASS_STATE}`)
        continue
      }
      const codes = [...new Set(v.findings.map((f) => f.code))]
      console.log(`UTE-RETIREMENT-REFUSED family=${v.family} codes=${codes.join(',')} state=${v.state} unit=${unit.text}`)
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
        terms: v.terms,
        unit: v.unit,
        coverage: coveragePayload(v),
      })),
      // Additive machine view: every requested row (allowed ones included) with
      // the derived unit and coverage sets, so a consumer does not have to
      // re-run the gate to learn what was measured.
      verdicts: verdicts.map((v) => ({
        family: v.family,
        allowed: v.allowed,
        state: v.state,
        terms: v.terms,
        unit: v.unit,
        coverage: coveragePayload(v),
        codes: [...new Set(v.findings.map((f) => f.code))],
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
