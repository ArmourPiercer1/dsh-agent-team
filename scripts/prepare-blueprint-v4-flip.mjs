#!/usr/bin/env node
/**
 * prepare-blueprint-v4-flip.mjs — the v4 翻档 PREP STROKE (VNEXT-SCHEMA-ADR
 * M-1 irreversible half + M-6 runtime-edge prep; this round FLIPS NOTHING).
 *
 * WHAT THIS IS: a read-only dry run. It parses the frozen version constants
 * out of `packages/domain/blueprint/src/schema.ts`, derives what the flip
 * (adding the next defined version to the run set) WOULD do — the constant
 * change, the derived RETIRED change, the gate-arm truth table before/after,
 * and the complete consumer list proving the flip is a SINGLE-SITE edit
 * (every gate derives from the constants; no scattered per-file literals) —
 * and writes that report under the round's evidence directory.
 *
 * WHAT IT IS NOT: the flip. The flip is the IRREVERSIBLE step (a document
 * that runs today lands in the migration arm tomorrow); it awaits the A-4
 * window ruling. This script never writes any repo source file, and it
 * refuses to run if the working tree's constants already carry the flip
 * (then there is nothing to prepare).
 *
 * Version digits are READ from the schema file — this script contains no
 * document-version digit literals of its own (A4-PR7 version-clean fence:
 * scripts/ is in scan scope and this file emits zero `key: <digit>` carriers).
 *
 * Run:  node scripts/prepare-blueprint-v4-flip.mjs [--out <path>]
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SCHEMA_FILE = join(REPO_ROOT, 'packages/domain/blueprint/src/schema.ts')

function extractArray(source, exportName) {
  const re = new RegExp(`${exportName}[^=]*=\\s*\\[([^\\]]*)\\]`, 'm')
  const m = re.exec(source)
  if (m === null) throw new Error(`cannot locate ${exportName} in schema.ts — the flip prep refuses to guess constants`)
  return m[1].split(',').map((s) => s.trim()).filter((s) => s !== '').map((s) => Number(s))
}

const source = readFileSync(SCHEMA_FILE, 'utf8')
const supported = extractArray(source, 'SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS')
const defined = extractArray(source, 'DEFINED_BLUEPRINT_DOCUMENT_VERSIONS')

const nextVersion = Math.max(...defined) + 1
const isFlipped = supported.includes(nextVersion)

// The full consumer census: every production reference to the two constant
// names. The flip's zero-diff claim is that this list IS the blast radius —
// all of them DERIVE from the constants; none re-states a version digit.
const grepOut = execFileSync(
  'git',
  ['-C', REPO_ROOT, 'grep', '-l', 'SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS\\|DEFINED_BLUEPRINT_DOCUMENT_VERSIONS', '--', 'packages', 'scripts'],
  { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
).trim().split('\n').filter((l) => l !== '')
const DIGIT_CARRIER = /schemaVersion["']?\s*:\s*\d/
const digitBearing = grepOut.filter((file) => DIGIT_CARRIER.test(readFileSync(join(REPO_ROOT, file), 'utf8')))

const fmt = (xs) => `[${xs.join(', ')}]`
const retiredNow = defined.filter((v) => !supported.includes(v))
const supportedAfter = [...supported, nextVersion]
const retiredAfter = defined.filter((v) => !supportedAfter.includes(v))
const demoted = retiredAfter.filter((v) => !retiredNow.includes(v))

function arm(version, sup, def) {
  if (!def.includes(version)) return 'SCHEMA_VERSION_UNSUPPORTED (never defined)'
  if (sup.includes(version)) return 'RUNS'
  return 'operator-owns MISMATCH arm (well-formed, not a run version)'
}

const census = new Set(defined)
census.add(nextVersion)
const definedAfter = [...defined, nextVersion]
const rows = [...census]
  .sort((a, b) => a - b)
  .map((v) => `| ${String(v)} | ${arm(v, supported, defined)} | ${arm(v, supportedAfter, definedAfter)} |`)

const report = `# v4 翻档 prep stroke — DRY RUN ONLY (flip = NOT-APPLIED)

Generated read-only by \`scripts/prepare-blueprint-v4-flip.mjs\`.
Round: alpha5-schema-rev (VNEXT-SCHEMA reversible half; ADR M-1/M-6).

## STATUS

- Flip applied: **NO** (this script writes no source file).
- Gate window: the flip is the IRREVERSIBLE half of M-1; it waits for the
  A-4 window ruling. \`A-4 窗口时长未定只阻退役决策\` — exactly this stroke
  is what that ruling will consume.
- Old-version retirement: **NOT declared** anywhere by this round.

## Constants (read from schema.ts, not restated here)

| set | now | after the prepared flip |
| --- | --- | --- |
| SUPPORTED (run set) | ${fmt(supported)} | ${fmt(supportedAfter)} |
| DEFINED | ${fmt(defined)} | ${fmt([...defined, nextVersion])} |
| RETIRED (derived) | ${fmt(retiredNow)} | ${fmt(retiredAfter)} |

Why THIS step (not the grammar) is the irreversible one: the flip itself
demits nothing — v3 keeps running and the derived retired set stays
${fmt(retiredAfter)} (${demoted.length === 0 ? 'nothing is demoted by adding the new version' : 'demoted: ' + demoted.join(', ')}).
Irreversibility arrives the moment the first document is AUTHORED in the new
format: rolling the run set back afterwards would strand stored documents
that no longer validate. That is the point of no return the A-4 window
ruling prices — a WRITE-format decision, not a constant edit.
Retirement of v3 (removing it from the run set) is a SEPARATE later ruling;
翻档 ≠ 退役, and this round declares neither.

## Gate-arm truth table (per the two-name discipline of A1-21)

| version | gate now | gate after flip |
| --- | --- | --- |
${rows.join('\n')}

## Zero-diff census (M-6 prep): the flip's blast radius IS this list

Every production reference to the version constants derives from them;
none re-states a document-version digit at its own site; a listed file that
DOES carry a digit literal (schema.ts itself and its testdata/fixtures are
expected and legal — the version-clean fence polices them) belongs to the
flip PR's own edit list:

${grepOut.map((f) => `- ${f}`).join('\n')}

Digit-carrier check outside schema.ts: ${digitBearing.length === 0 ? 'clean — no consumer file carries a `key: <digit>` document-version literal' : `FLAGGED: ${digitBearing.join(', ')}`}

## The flip PR (when and if the ruling comes) is ONE edit plus tests

1. \`schema.ts\`: run set gains the next version (the derived sets move themselves).
2. The frozen per-version parser branch for the new version already exists,
   dormant, in-repo (this round shipped the authoring grammar half); its
   dispatch line joins the per-version switch.
3. Docs face (M-7) updates in the same PR; retirement wording stays a
   SEPARATE later decision (翻档 ≠ 退役).
4. The flip PR must ALSO land the envelope-scope expansion (M-3, deferred
   here on purpose) atomically — half-landing the effect-face scope with a
   runnable v4 would create a parse-accept / runtime-unmap split.
`

const outArgIndex = process.argv.indexOf('--out')
const outPath = outArgIndex >= 0 ? resolve(process.argv[outArgIndex + 1]) : join(REPO_ROOT, 'dev/agent-workflow/evidence/alpha5/schema-rev/runs/v4-flip-PREP.md')
if (isFlipped) {
  process.stderr.write('the working tree already carries the flip — nothing to prepare; refusing to write a stale prep stroke\n')
  process.exit(2)
}
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, report, 'utf8')
process.stdout.write(`prep stroke written (source untouched): ${outPath}\n`)
