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
 * Exported for scripts/eb3-ci-negative-controls.mjs (C3):
 *   checkFamilyDefinitions({ files, ledger? }) → { findings }
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

/**
 * @param {object} p
 * @param {Map<string,string>} p.files   repo-relative path → text (contributions + rows)
 * @param {object} [p.ledger]            the ARC-A census ledger
 */
export function checkFamilyDefinitions({ files, ledger = loadCensusLedger() }) {
  const findings = []
  const contribPaths = [...files.keys()].filter(isContributionPath).sort()
  const { contributions } = scanContributions({ paths: contribPaths, files })

  // ARC-A L3 + L4, reused — surfaced under EB3 codes so the CI leg names them.
  for (const v of scanCensus({ contributions, ledger }).violations) {
    findings.push({ code: 'DEF_CENSUS_DRIFT', path: v.path, detail: `${v.path}: ${v.kind} — ${v.detail}` })
  }
  for (const v of scanClosedness({ contributions }).violations) {
    findings.push({ code: 'DEF_NAME_UNREADABLE', path: v.path, detail: `${v.path}: ${v.kind} — ${v.detail}` })
  }

  // The execution arm.
  const bookedByPath = new Map(ledger.families.flatMap((f) => f.contributionPaths.map((p) => [p, f])))
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
    if (/\bsourceDocument\b/.test(text) && !/\b[A-Za-z_$][\w$]*\.execute\?\.toString\?\.\(\)/.test(text)) {
      findings.push({ code: 'DEF_EXECUTION_REPLACED', path, detail: `${path}: the bound source document no longer binds any row's execute transport — a swapped body would keep the same digest` })
    }
    // Same rule inside the contribution itself: some families define the row inline.
    checkExecuteMembers(path, text, findings)
  }
  for (const [path, text] of files) {
    if (isFamilyRowPath(path)) checkExecuteMembers(path, text, findings)
  }
  return { findings }
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

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) {
  const json = process.argv.includes('--json')
  let out
  try {
    const paths = trackedDefinitionPaths(ROOT)
    const files = new Map(paths.map((p) => [p, readFileSync(join(ROOT, p), 'utf8')]))
    out = { files: files.size, ...checkFamilyDefinitions({ files }) }
  } catch (e) {
    console.error(`EB3-FAMILY-DEFINITIONS refused could-not-grade: ${String(e?.message ?? e)}`)
    process.exit(2)
  }
  if (json) console.log(JSON.stringify(out, null, 2))
  else {
    for (const f of out.findings) console.log(`  ${f.code} ${f.detail}`)
    console.log(`EB3-FAMILY-DEFINITIONS ${out.findings.length === 0 ? 'pass' : 'fail'} files=${String(out.files)} findings=${String(out.findings.length)}`)
  }
  process.exit(out.findings.length === 0 ? 0 : 1)
}
