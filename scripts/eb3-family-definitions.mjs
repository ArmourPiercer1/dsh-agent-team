#!/usr/bin/env node
/**
 * eb3-family-definitions.mjs — EB3: "替换执行 Definition 必须被发现" (a replaced
 * execution Definition must be detected), as a CI check that does not depend on
 * the census reaching the merge decision.
 *
 * WHAT IS ALREADY OWNED ELSEWHERE, AND REUSED. `packages/testkit/test/arc-a-fitness/
 * scan.mjs` (ARC-A L3/L4) owns "which contributions exist and what names they
 * claim": scanContributions + scanCensus + scanClosedness. This file imports those
 * three, unchanged, so the census ledger stays the one booking of families and the
 * closedness law stays one law. Why it is not enough on its own: that suite rides
 * the root census, which `pr-gate` runs `--allow-refused census` on hosted runners
 * (the pristine host is absent there), so on the Required path its verdict never
 * arrives (RED.md, M3c).
 *
 * WHAT THIS ADDS — THE EXECUTION ARM. ARC-A reads names; a Definition can keep its
 * name and lose its body. Three shapes are refused here:
 *
 *   DEF_EXECUTION_REPLACED  `execution.via` is not the BOOKED value. Every booked
 *                           family is `family-body`; a flip to `named-bridge` moves
 *                           the effect onto a provider no review attached to this
 *                           family. (A real named-bridge family is booked as such in
 *                           the census, and then this rule asks for exactly that.)
 *   DEF_EXECUTION_REPLACED  the contribution's bound-source document stops binding
 *                           the row's execute transport (`execute: definition.execute
 *                           ?.toString?.()`) — the digest would then no longer change
 *                           when the body is swapped, which is how a replaced body
 *                           passes a digest check. Also: any row `execute:` member
 *                           in a family row file that is not a plain function literal
 *                           (`execute: async (` / `execute: (` / `execute(`) — a
 *                           computed or fall-through transport (`execute: x ?? (...)`).
 *   DEF_NAME_UNREADABLE     ARC-A L4 `not-verified` (non-literal nativeNames, no
 *                           readable block, familyId not exactly one literal),
 *                           surfaced under this check's name so the CI leg reports it.
 *   DEF_CENSUS_DRIFT        ARC-A L3 census violations (unbooked/vanished family,
 *                           familyId drift, mount drift).
 *
 * WHAT THIS ADDS — THE RETIREMENT-LICENCE ARM (RETIREMENT.md §5.1). The UTE-0
 * gate was inert about deletion: nothing ran it when someone removed the old
 * path, so a UTE-4 deletion PR could go green until a reviewer noticed. This leg
 * already runs on the required path and already loads the family census, so it
 * needs no new workflow line, manifest leg or argv. For every retirement-ledger
 * row that declares `oldPath.files`, a declared file that is missing while the
 * retirement gate does not ALLOW that row is:
 *
 *   DEF_RETIREMENT_UNLICENSED  a declared old-path file was deleted before the
 *                              row was allowed (detail carries the gate's codes)
 *
 * An unreadable retirement ledger or census is the same finding with detail
 * `retirement-ledger-unreadable` — fail closed, because an unreadable ledger
 * must not silently license deletion.
 *
 * THE CUT'S FROZEN SET IS A LICENCE, NOT A SILENCE (Round 72, hosted-CI repair). When a declared
 * old-path file is missing AND it is in the A0 frozen delete set
 * (`dev/agent-workflow/ledgers/ute-p0-assets.snapshot.json`), the deletion was performed by the
 * NAMED cut, whose own instrument (`scripts/ute-cut-closure.mjs`, `ute-p0-assets --check`) grades it
 * on every PR: the UTE-4 per-family licence is not the authority for that act, so asking it for one
 * is asking the wrong question. Those files are reported on a `DEF_RETIRED_BY_CUT` line and are NOT
 * findings. The discharge is narrow by construction: a file that is missing but NOT in the frozen set
 * keeps the finding, and an unreadable frozen set discharges nothing (fail closed).
 *
 * WHAT THIS ADDS — THE INVENTORY ARM (UTE-3, 2026-11-20). UTE-4 may only
 * delete a family's old path against an `oldPath.files` declaration, and that
 * declaration is only auditable if the files on it are the family's real
 * implementation. `scripts/ute-family-inventory.mjs` owns that inventory and its
 * own refusals; this leg INVOKES it (in process, no new argv, no new workflow
 * line, no new manifest leg) so the required CI path is red when the inventory
 * drifts from the census, the tree, the parsed imports or the measured
 * retirement readiness. The inventory's findings flow into this leg's finding
 * list unchanged, which is why a reviewer sees the inventory's own code names
 * (`INVENTORY_*`) on the required path. This arm is invoked by the CLI only:
 * `checkFamilyDefinitions` keeps its injected-file contract so the negative
 * control suite can mutate ONE input without grading the real tree.
 *
 * Exported for scripts/eb3-ci-negative-controls.mjs (C3):
 *   checkFamilyDefinitions({ files, ledger?, retirement?, root? }) → { findings }
 *   checkRetirementLicences({ files, retirement?, root? }) → { findings }
 *
 *   node scripts/eb3-family-definitions.mjs [--json]
 *
 * Exit: 0 no findings | 1 findings | 2 could not grade.
 *
 * @module scripts/eb3-family-definitions
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import {
  scanCensus,
  scanClosedness,
  scanContributions,
} from '../packages/testkit/test/arc-a-fitness/scan.mjs'
import {
  CENSUS_REL,
  LEDGER_REL as RETIREMENT_LEDGER_REL,
  checkRetirement,
} from './ute-retirement-gate.mjs'
import { checkInventory, defaultTrackedPaths } from './ute-family-inventory.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
export const CENSUS_LEDGER_REL = 'dev/agent-workflow/ledgers/arc-a-family-census.json'

/** Booked execution arm per family. The census ledger predates this field, so the
 *  default is the only value every booked family carries today; a family that is
 *  booked with `execution` in the ledger is graded against that instead. */
const DEFAULT_EXECUTION_VIA = 'family-body'

export function loadCensusLedger(root = ROOT) {
  const abs = join(root, CENSUS_LEDGER_REL)
  if (!existsSync(abs)) throw new Error(`ARC-A census ledger absent: ${CENSUS_LEDGER_REL}`)
  return JSON.parse(readFileSync(abs, 'utf8'))
}

const isContributionPath = (p) =>
  (p.includes('/src/') ? /\/src\/[^/]*contribution[^/]*\.mjs$/.test(p) : /(^|\/)[^/]*contribution[^/]*\.mjs$/.test(p))
  && !p.includes('/dist/')

/** Row files whose `execute:` members are the placed transport. */
const isFamilyRowPath = (p) => /^packages\/tools\/[a-z0-9-]+-family\/src\/[^/]*-row\.mjs$/.test(p)
  || /^tests\/[^/]*-family\/src\/[^/]*-row\.mjs$/.test(p)

/** A plain function literal: `execute: async (`, `execute: (`, `execute: function`,
 *  or method shorthand `execute(` / `async execute(`. */
const PLAIN_EXECUTE = /^\s*(?:async\s+)?execute\s*(?::\s*(?:async\s*)?(?:\(|function\b)|\()/
const ANY_EXECUTE_MEMBER = /^\s*(?:async\s+)?execute\s*[:(]/

/** The text of the object literal assigned to `sourceDocument`, balanced on braces, or
 *  null when the file does not build one in that shape. */
function sourceDocumentLiteral(text) {
  const m = /\bsourceDocument\s*=\s*canonicalJsonStringify\(\s*\{/.exec(text)
  if (m === null) return null
  let depth = 0
  for (let i = m.index + m[0].length - 1; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1
    else if (text[i] === '}') { depth -= 1; if (depth === 0) return text.slice(m.index, i + 1) }
  }
  return null
}

/**
 * The retirement-licence arm (RETIREMENT.md §5.1). Inputs are injectable so the
 * C3 negative controls can drive it from an in-memory file map without touching
 * the tree: `retirement` may carry an already-parsed retirement `ledger` and
 * `census`, plus overrides for the gate's readFile/isTracked/fileExists/
 * revExists/isAncestor. When the retirement ledger (or the census) is not in the
 * injected map it is read from `root`; when it cannot be read at all the check
 * fails closed with `retirement-ledger-unreadable` — an unreadable ledger must
 * never license a deletion.
 *
 * Presence rule: an injected `files` map is the complete universe (deleting an
 * entry simulates deleting the file); with no map, the tree is consulted.
 *
 * @param {object} p
 * @param {Map<string,string>|object|undefined} p.files repo-relative path → text
 * @param {object} [p.retirement] injected ledger/census and gate overrides
 * @param {string} [p.root] tree used when the injected map has no ledger entry
 * @returns {{findings: Array<{code: string, path: string, detail: string}>}}
 */
export function checkRetirementLicences({ files, retirement = {}, root = ROOT }) {
  let ledger
  let census
  try {
    ledger = retirement.ledger !== undefined ? retirement.ledger : readInjectedJson(RETIREMENT_LEDGER_REL, files, root)
    if (typeof ledger === 'string') ledger = JSON.parse(ledger)
    if (ledger === null || typeof ledger !== 'object' || ledger.schema !== 'ute-retirement/1' || !Array.isArray(ledger.families)) {
      throw new Error('retirement ledger shape')
    }
    census = retirement.census !== undefined ? retirement.census : readInjectedJson(CENSUS_REL, files, root)
    if (typeof census === 'string') census = JSON.parse(census)
    if (census === null || typeof census !== 'object' || !Array.isArray(census.families)) {
      throw new Error('census shape')
    }
  } catch {
    // Fail closed: a ledger we cannot read cannot license anything.
    return { findings: [{ code: 'DEF_RETIREMENT_UNLICENSED', path: RETIREMENT_LEDGER_REL, detail: 'retirement-ledger-unreadable' }] }
  }

  const present = (rel) => {
    if (files instanceof Map) return files.has(rel)
    if (files !== undefined && files !== null && typeof files === 'object') return Object.prototype.hasOwnProperty.call(files, rel)
    return existsSync(join(root, rel))
  }

  const gateOptions = { root, census }
  for (const key of ['readFile', 'isTracked', 'fileExists', 'revExists', 'isAncestor']) {
    if (retirement[key] !== undefined) gateOptions[key] = retirement[key]
  }

  const frozen = frozenDeleteSet({ retirement, root })
  const findings = []
  const retiredByCut = []
  for (const row of ledger.families) {
    const declared = row?.oldPath?.files
    if (!Array.isArray(declared) || declared.length === 0) continue
    const missing = declared.filter((rel) => typeof rel === 'string' && rel.length > 0 && !present(rel))
    if (missing.length === 0) continue
    const verdict = checkRetirement({ ledger, family: row.family, ...gateOptions })
    if (verdict.allowed) continue // retirement is the licensed act: absence is expected
    const gateCodes = [...new Set((verdict.findings ?? []).map((f) => f.code))]
    for (const rel of missing) {
      // The A0/A1 cut deleted this file on purpose and its own instrument grades that act on every PR;
      // the UTE-4 per-family licence is not the authority for a cut deletion (see the module doc).
      if (frozen.has(rel)) { retiredByCut.push({ family: row.family, path: rel }); continue }
      findings.push({
        code: 'DEF_RETIREMENT_UNLICENSED',
        path: rel,
        detail: `retirement row ${JSON.stringify(row.family)} is not allowed (${gateCodes.join(',') || verdict.couldNotGrade || 'unknown'}) but its declared old-path file ${rel} is missing — deleting the old path is the licensed act, not the argument for one`,
      })
    }
  }
  return { findings, retiredByCut }
}

/**
 * The A0 frozen delete set, read from the cut's own ledger. Empty when the ledger is absent or
 * unreadable — a discharge that cannot be read discharges nothing (fail closed), which is why this
 * returns an empty Set rather than throwing: the caller's findings are then exactly what they were.
 *
 * @param {{retirement?: object, root?: string}} p
 * @returns {Set<string>} repo-relative paths the cut froze for deletion
 */
function frozenDeleteSet({ retirement = {}, root = ROOT }) {
  const rel = 'dev/agent-workflow/ledgers/ute-p0-assets.snapshot.json'
  try {
    const raw = retirement.frozen !== undefined
      ? (typeof retirement.frozen === 'string' ? JSON.parse(retirement.frozen) : retirement.frozen)
      : JSON.parse(readFileSync(join(root, rel), 'utf8'))
    // The ledger's own law (scripts/ute-cut-closure.mjs#loadFrozen): a module is in the delete set
    // when its verdict is `delete` or `replace`; the SNAPSHOT is the attestation and wins.
    return new Set((raw?.modules ?? [])
      .filter((m) => m?.verdict === 'delete' || m?.verdict === 'replace')
      .flatMap((m) => (Array.isArray(m?.files) ? m.files : []))
      .filter((x) => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

/** Parse a JSON input from an injected map, else from `root`. Throws on absence. */
function readInjectedJson(rel, files, root) {
  if (files instanceof Map && files.has(rel)) return JSON.parse(files.get(rel))
  if (files !== undefined && files !== null && !(files instanceof Map) && typeof files === 'object' && Object.prototype.hasOwnProperty.call(files, rel)) {
    return JSON.parse(files[rel])
  }
  // Not in the injected map: the ledger/census is read from the tree, exactly as
  // the CI leg does today (the map holds definitions, not the ledgers).
  return JSON.parse(readFileSync(join(root, rel), 'utf8'))
}

/**
 * @param {object} p
 * @param {Map<string,string>} p.files   repo-relative path → text (contributions + rows)
 * @param {object} [p.ledger]            the ARC-A census ledger
 * @param {object} [p.retirement]        injected retirement ledger/census + overrides
 * @param {string} [p.root]              tree root for the deletion arm
 */
export function checkFamilyDefinitions({ files, ledger, retirement = {}, root = ROOT }) {
  const findings = []
  // An absent census must not throw out of the retirement arm: the arm reports
  // `retirement-ledger-unreadable` (fail closed), and the ARC-A arms are simply
  // not gradeable, which is a refusal, not a crash.
  let censusLedger = ledger
  if (censusLedger === undefined) {
    try {
      censusLedger = loadCensusLedger(root)
    } catch {
      censusLedger = null
    }
  }
  const contribPaths = [...files.keys()].filter(isContributionPath).sort()
  const { contributions } = scanContributions({ paths: contribPaths, files })

  // ARC-A L3 + L4, reused — surfaced under EB3 codes so the CI leg names them.
  if (censusLedger !== null && censusLedger !== undefined) {
    for (const v of scanCensus({ contributions, ledger: censusLedger }).violations) {
      findings.push({ code: 'DEF_CENSUS_DRIFT', path: v.path, detail: `${v.path}: ${v.kind} — ${v.detail}` })
    }
  }
  for (const v of scanClosedness({ contributions }).violations) {
    findings.push({ code: 'DEF_NAME_UNREADABLE', path: v.path, detail: `${v.path}: ${v.kind} — ${v.detail}` })
  }

  // The execution arm.
  const bookedByPath = new Map((censusLedger?.families ?? []).flatMap((f) => f.contributionPaths.map((p) => [p, f])))
  for (const path of contribPaths) {
    const text = files.get(path)
    if (text === undefined) continue
    const booked = bookedByPath.get(path)
    const expectedVia = booked?.execution ?? DEFAULT_EXECUTION_VIA
    const vias = [...text.matchAll(/\bvia:\s*(['"])([^'"]+)\1/g)].map((m) => m[2])
    if (vias.length === 0) {
      findings.push({ code: 'DEF_EXECUTION_REPLACED', path, detail: `${path}: no literal execution.via — the execution arm is unreadable` })
    } else {
      for (const via of new Set(vias)) {
        if (via !== expectedVia) {
          findings.push({ code: 'DEF_EXECUTION_REPLACED', path, detail: `${path}: execution.via='${via}' but the family is booked '${expectedVia}' — the effect moved off the reviewed body` })
        }
      }
    }
    // A contribution that binds a row Definition must bind its execute transport in
    // the source digest; contributions that bind module namespaces only (search) are
    // checked through their row file below.
    // The digest must bind SOME row's execute transport. The first draft pinned the
    // identifier `definition.execute`, which search-family legitimately spells
    // `grepDefinition.execute` / `globDefinition.execute` (one candidate, two rows) —
    // the check was wrong about the law, not the tree. The law is the binding, not
    // the identifier.
    // UNIVERSAL, not existential. The first form fired only when NO row was bound, so a
    // four-row contribution (fs-family-contribution: read/write/edit/read_image) could
    // drop ONE row's binding and pass — the hosted run of PR #395 at 820fd7e0e caught the
    // control's 3d leg MISSING exactly that on the merged tree. The law: every row
    // Definition the source document binds by name must ALSO bind its execute transport.
    if (/\bsourceDocument\b/.test(text)) {
      // Scoped to the `sourceDocument = canonicalJsonStringify({ … })` literal: the same
      // file also builds an INPUT-contract digest from `name: definition.name` (no execute,
      // by design), and an unscoped scan read that as an unbound row.
      const doc = sourceDocumentLiteral(text) ?? text
      const bound = new Set([...doc.matchAll(/\b([A-Za-z_$][\w$]*)\.execute\?\.toString\?\.\(\)/g)].map((m) => m[1]))
      const named = new Set([...doc.matchAll(/\bname:\s*([A-Za-z_$][\w$]*)\.name\b/g)].map((m) => m[1]))
      if (bound.size === 0) {
        findings.push({ code: 'DEF_EXECUTION_REPLACED', path, detail: `${path}: the bound source document no longer binds any row's execute transport — a swapped body would keep the same digest` })
      }
      for (const ident of named) {
        if (!bound.has(ident)) {
          findings.push({ code: 'DEF_EXECUTION_REPLACED', path, detail: `${path}: the source document binds ${ident}.name but not ${ident}.execute — that row's body could be swapped and keep the same digest` })
        }
      }
    }
    // Same rule inside the contribution itself: some families define the row inline.
    checkExecuteMembers(path, text, findings)
  }
  for (const [path, text] of files) {
    if (isFamilyRowPath(path)) checkExecuteMembers(path, text, findings)
  }
  // The deletion half of UTE-4: required CI refuses a removed old path unless
  // the retirement gate allows that family's row (RETIREMENT.md §5.1).
  const licences = checkRetirementLicences({ files, retirement, root })
  findings.push(...licences.findings)
  return { findings, retiredByCut: licences.retiredByCut ?? [] }
}

function checkExecuteMembers(path, text, findings) {
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (!ANY_EXECUTE_MEMBER.test(line)) continue
    if (/^\s*(\/\/|\*)/.test(line)) continue
    // `execute: definition.execute?.toString?.() ?? null` is the digest binding,
    // not a transport.
    if (/execute:\s*[A-Za-z_$][\w$]*\.execute\?\.toString/.test(line)) continue
    // `<ident>: { name: …, execute: <ident>.execute?.toString?.() ?? null }` is the
    // same digest binding, one nesting level deeper (search-family's two-row form).
    if (/execute:\s*[A-Za-z_$][\w$]*\.execute\?\.toString\?\.\(\)/.test(line)) continue
    if (!PLAIN_EXECUTE.test(line)) {
      findings.push({ code: 'DEF_EXECUTION_REPLACED', path, detail: `${path}:${String(i + 1)}: row transport is not a plain function literal (${line.trim().slice(0, 100)}) — a computed or fall-through execute is a replaced Definition` })
    }
  }
}

/** Tracked contribution + row files (git index = tracked truth). */
export function trackedDefinitionPaths(root = ROOT) {
  const out = execFileSync('git', ['-C', root, 'ls-files', '-z', 'packages/tools', 'tests'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return out.split('\0').filter((p) => p.length > 0 && (isContributionPath(p) || isFamilyRowPath(p))).sort()
}

/** The UTE-3 inventory arm: grade the family inventory and surface its findings
 *  under this leg's own name. A ledger that cannot be graded at all is a
 *  finding here (fail closed) — a required leg must never read green because the
 *  inventory was unreadable. */
export function checkInventoryArm({ root = ROOT, trackedPaths } = {}) {
  const result = checkInventory({ root, trackedPaths })
  if (result.refused !== undefined) {
    return {
      families: [],
      universe: 0,
      findings: [{ code: result.refused, path: 'dev/agent-workflow/ledgers/ute-family-inventory.json', detail: `the UTE-3 family inventory could not be graded: ${result.detail}` }],
    }
  }
  return {
    families: result.families.map((f) => f.familyId),
    universe: result.universe,
    retired: result.retired ?? [],
    retiredSharedFiles: result.retiredSharedFiles ?? [],
    findings: result.findings.map((f) => ({ code: f.code, path: f.familyId ?? 'dev/agent-workflow/ledgers/ute-family-inventory.json', detail: f.detail })),
  }
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) {
  const json = process.argv.includes('--json')
  let out
  try {
    const paths = trackedDefinitionPaths(ROOT)
    const files = new Map(paths.map((p) => [p, readFileSync(join(ROOT, p), 'utf8')]))
    // The retirement arm treats the injected map as the file universe, so the
    // declared old-path files must be in it too; otherwise every row would look
    // deleted. They are read from the tree here, once.
    try {
      const retirementLedger = JSON.parse(readFileSync(join(ROOT, RETIREMENT_LEDGER_REL), 'utf8'))
      for (const row of retirementLedger.families ?? []) {
        for (const rel of row?.oldPath?.files ?? []) {
          if (typeof rel === 'string' && !files.has(rel) && existsSync(join(ROOT, rel))) files.set(rel, readFileSync(join(ROOT, rel), 'utf8'))
        }
      }
    } catch {
      // Absent/unparseable ledger: the arm itself fails closed and reports it.
    }
    // UTE-3: the required leg also invokes the family inventory. Same step, same
    // argv, same manifest leg — the inventory's refusals are this leg's findings.
    const inventory = checkInventoryArm({ root: ROOT, trackedPaths: defaultTrackedPaths(ROOT) })
    const definitions = checkFamilyDefinitions({ files })
    // THE A0 SUBJECT DISCHARGE (round 80). A census row is stale because A0 deleted the
    // family's contribution files. When the same family is booked `retired-by-a0-cut` (with
    // frozen modules + tracked citations + named successors, validated by ute-cut-closure)
    // AND every file it booked is absent, the finding is replaced by one disposition naming
    // the family and its frozen evidence. A path that is NOT covered, or that reappears,
    // keeps the finding: a resurrection is graded, never retired.
    const a0Retired = new Map(inventory.retired.map((r) => [r.familyId, r]))
    const censusLedger = JSON.parse(readFileSync(join(ROOT, CENSUS_LEDGER_REL), 'utf8'))
    const contributionFamily = new Map()
    for (const fam of censusLedger.families ?? []) {
      for (const rel of fam.contributionPaths ?? []) contributionFamily.set(rel, fam.familyId)
      for (const rel of fam.contribution ?? []) contributionFamily.set(rel, fam.familyId)
    }
    const retiredA0 = []
    const kept = []
    for (const finding of definitions.findings) {
      const familyId = contributionFamily.get(finding.path)
      const subject = familyId === undefined ? undefined : a0Retired.get(familyId)
      const absent = !files.has(finding.path) && !existsSync(join(ROOT, finding.path))
      if (finding.code === 'DEF_CENSUS_DRIFT' && subject !== undefined && absent) {
        retiredA0.push({ familyId, path: finding.path, frozenModules: subject.frozenModules, detail: finding.detail })
      } else {
        kept.push(finding)
      }
    }
    out = {
      files: files.size,
      ...definitions,
      findings: [...kept, ...inventory.findings],
      retiredByA0: retiredA0,
      retiredFamilies: inventory.retired.map((r) => ({ familyId: r.familyId, kind: r.kind, files: r.files, frozenModules: r.frozenModules, successors: r.successors })),
      retiredSharedFiles: inventory.retiredSharedFiles,
      inventory: { families: inventory.families, universe: inventory.universe, retiredFamilies: inventory.retired.length },
    }
  } catch (e) {
    console.error(`EB3-FAMILY-DEFINITIONS refused could-not-grade: ${String(e?.message ?? e)}`)
    process.exit(2)
  }
  if (json) console.log(JSON.stringify(out, null, 2))
  else {
    for (const f of out.findings) console.log(`  ${f.code} ${f.detail}`)
    if ((out.retiredByCut ?? []).length > 0) {
      console.log(`  DEF_RETIRED_BY_CUT ${String(out.retiredByCut.length)} declared old-path file(s) are in the A0 frozen delete set — the cut, not a UTE-4 per-family retirement, licensed their deletion (graded by ute-cut-closure on every PR)`)
    }
    for (const subject of out.retiredFamilies ?? []) {
      console.log(`  DEF_RETIRED_BY_A0 family=${subject.familyId} kind=${subject.kind} files=${String(subject.files)} frozen=${subject.frozenModules.join(',')} successors=${subject.successors.filter((x) => !x.startsWith('node ')).join('|')}`)
    }
    for (const row of out.retiredByA0 ?? []) {
      console.log(`  DEF_RETIRED_BY_A0 census-row=${row.path} family=${row.familyId} frozen=${row.frozenModules.join(',')}`)
    }
    if ((out.retiredSharedFiles ?? []).length > 0) {
      console.log(`  DEF_RETIRED_BY_A0 shared=${out.retiredSharedFiles.join('|')}`)
    }
    console.log(`EB3-FAMILY-DEFINITIONS ${out.findings.length === 0 ? 'pass' : 'fail'} files=${String(out.files)} findings=${String(out.findings.length)} retiredFamilies=${String((out.retiredFamilies ?? []).length)} retiredCensusRows=${String((out.retiredByA0 ?? []).length)} retiredByCut=${String((out.retiredByCut ?? []).length)}`)
  }
  process.exit(out.findings.length === 0 ? 0 : 1)
}
