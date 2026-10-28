#!/usr/bin/env node
/**
 * closure-round2.mjs — prints the per-suite oracle closure measured by
 * tests/world-factory/lib/binding-digests.mjs for EVERY collected suite plus
 * both runner entries. Evidence generator for
 * dev/agent-workflow/evidence/u7-g4r-20261028/README.md ("Per-suite oracle
 * closure"). Writes nothing into the repo; artifacts go to a temp dir.
 *
 * Run: node dev/agent-workflow/evidence/u7-g4r-20261028/closure-round2.mjs
 */
import { mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { captureOracleBinding } from '../../../../tests/world-factory/lib/binding-digests.mjs'

const ROOT = new URL('../../../../', import.meta.url).pathname
const dir = mkdtempSync(join(tmpdir(), 'u7-g4r-closure-'))
const entries = [['core (u5-canary runner)', 'u5-canary-runner.mjs'], ['u7-4a-jobs (standalone runner)', 'u7-4a-jobs-suite.mjs']]
for (const f of readdirSync(join(ROOT, 'tests/world-factory/suites')).sort()) entries.push([f.replace(/\.mjs$/, ''), `suites/${f}`])

console.log(`# oracle closures measured at teamSha ${process.env.TEAM_SHA ?? 'working tree'}`)
console.log(`# hashLaw sha256(path + 0x00 + bytes + 0x00) per source, sources in lexically ascending repo-relative posix order`)
for (const [suite, rel] of entries) {
  const { worldOracle: o } = captureOracleBinding({
    artifactPath: join(ROOT, 'tests/world-factory', rel),
    evidencePath: join(dir, `${suite.replace(/[ ()]/g, '-')}.oracle.json`),
    sourceRoot: join(ROOT, 'tests/world-factory'),
    repoRoot: ROOT,
    suite,
  })
  const outside = o.sources.filter((s) => !s.startsWith('tests/world-factory/'))
  console.log(`suite=${suite.replace(/ /g, '_')} entry=tests/world-factory/${rel}`)
  console.log(`  complete=${String(o.complete)} literalReadsComplete=${String(o.literalReadsComplete)} sources=${String(o.sources.length)} excludedHelpers=${o.excludedHelpers.join('|') || 'none'}`)
  console.log(`  sources=${o.sources.join('|')}`)
  if (outside.length > 0) console.log(`  outsideTestsWorldFactory=${outside.join('|')}`)
  if (o.unresolvedDynamicImports.length > 0) console.log(`  unresolvedDynamicImports=${o.unresolvedDynamicImports.join('|')}`)
  if (o.unresolvedLiteralReads.length > 0) console.log(`  unresolvedLiteralReads=${o.unresolvedLiteralReads.join('|')}`)
  console.log(`  externalSpecifiers=${o.externalSpecifiers.join('|')}`)
}
