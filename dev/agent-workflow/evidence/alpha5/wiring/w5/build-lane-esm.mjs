#!/usr/bin/env node
/**
 * build-lane-esm.mjs — W5 wiring: compile the DORMANT `a5p5-tools` lane to
 * plain ESM for the LIVE row, WITHOUT touching any shared file.
 *
 * The lane tsconfig is `noEmit` by law (its own); the runtime dist carries
 * the PR1/PR2/PR3 artifacts but NOT the tools lane (WIRING-SURFACE #7: a5p5
 * stays on its lane runner). The live row is plain Node ESM inside the Host
 * process, so it needs built JS. This driver invokes tsc with PURE
 * COMMAND-LINE flags (no tsconfig file created anywhere under packages/ —
 * IF-5 shared-file zero-touch) over the lane's `src/index.ts` entry; tsc
 * pulls the relative `domain/tool-governance` closure with it and mirrors
 * the repo layout under OUT. That build copy is the lane's ONE module graph
 * for the row (the row's fixture builders import the SAME copy the lane's
 * pipeline imports — no second algebra instance inside the row).
 *
 * OUT lives under gitignored `tests/homes/` (workspace-write constraint; it
 * is a build product, not a DSH_HOME world — disclosed in the README).
 *
 * Usage: node build-lane-esm.mjs <worktree> <outDir> [tscJsPath]
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const [worktreeArg, outArg, tscArg] = process.argv.slice(2)
if (worktreeArg === undefined || outArg === undefined) {
  console.error('usage: node build-lane-esm.mjs <worktree> <outDir> [tscJsPath]')
  process.exit(1)
}
const WORKTREE = resolve(worktreeArg)
const OUT = resolve(outArg)
const TSC_CANDIDATES = [
  tscArg,
  join(WORKTREE, 'node_modules', 'typescript', 'lib', 'tsc.js'),
  '/srv/workspace/dsh-plugins/dsh-agent-team/node_modules/typescript/lib/tsc.js',
].filter((p) => p !== undefined && p !== '')
const TSC = TSC_CANDIDATES.find((p) => existsSync(p))
if (TSC === undefined) {
  console.error(`FATAL: no typescript/lib/tsc.js found among ${JSON.stringify(TSC_CANDIDATES)}`)
  process.exit(1)
}
const ENTRY = join(WORKTREE, 'packages', 'tools', 'a5p5-tools', 'src', 'index.ts')
if (!existsSync(ENTRY)) {
  console.error(`FATAL: lane entry missing at ${ENTRY}`)
  process.exit(1)
}
mkdirSync(OUT, { recursive: true })

// Compiler options mirror tsconfig.base.json verbatim (the lane typechecks
// clean under them at its own tsc gate; loosening strict breaks its
// discriminated-union narrowing, so the build face repeats the base face).
const res = spawnSync(process.execPath, [
  TSC,
  ENTRY,
  '--target', 'ES2022',
  '--lib', 'ES2022',
  '--module', 'NodeNext',
  '--moduleResolution', 'NodeNext',
  '--strict', 'true',
  '--noUncheckedIndexedAccess', 'true',
  '--noImplicitOverride', 'true',
  '--esModuleInterop', 'true',
  '--forceConsistentCasingInFileNames', 'true',
  '--isolatedModules', 'true',
  '--verbatimModuleSyntax', 'true',
  '--skipLibCheck',
  '--declaration', 'false',
  '--sourceMap', 'false',
  '--removeComments', 'false',
  '--rootDir', WORKTREE,
  '--outDir', OUT,
], { encoding: 'utf8', cwd: WORKTREE })
const out = `${res.stdout ?? ''}${res.stderr ?? ''}`
if (res.status !== 0) {
  console.error(out.slice(0, 4000))
  console.error(`FATAL: tsc exited ${String(res.status)}`)
  process.exit(1)
}
const builtEntry = join(OUT, 'packages', 'tools', 'a5p5-tools', 'src', 'index.js')
const builtDomain = join(OUT, 'packages', 'domain', 'tool-governance', 'src', 'index.js')
if (!existsSync(builtEntry) || !existsSync(builtDomain)) {
  console.error(`FATAL: expected outputs missing (${builtEntry}, ${builtDomain})`)
  console.error(out.slice(0, 2000))
  process.exit(1)
}
console.log(`lane ESM build OK: ${builtEntry}`)
