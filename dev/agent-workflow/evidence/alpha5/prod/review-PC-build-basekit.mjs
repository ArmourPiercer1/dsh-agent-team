#!/usr/bin/env node
/**
 * review-PC-build-basekit.mjs — reviewer instrument builder (P-C round, item ①).
 *
 * Reconstructs the BASE (d714a941) W7 kit — the kit BEFORE the injection
 * surface existed — inside this worktree, and points it at THIS worktree's
 * lane sources. The base kit compiles the lane with its OWN kit-local project
 * (`tsconfig.lane.json`, restored here from the base commit) into
 * `node_modules/.a5w7-jobs-build` and the base row passes NO injections
 * (`resolveDefinition` + `onObserve` only, explicit pins everywhere).
 *
 * Running it therefore IS the question of review item ①: does the W7 semantic
 * face, with NO identity / NO lease / NO reader injection, behave exactly as
 * booked at base — on the HEAD lane sources? 22/22 = the default face did not
 * move; any red = the default changed.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5p7-rev-pc'
const HERE = join(ROOT, 'dev/agent-workflow/evidence/alpha5/prod/review-PC-basekit')
const BASE = 'd714a941'
const show = (rel) => execFileSync('git', ['-C', ROOT, 'show', BASE + ':' + rel], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

mkdirSync(HERE, { recursive: true })
let kit = show('tests/kits/a5-w7-jobs-wiring/a5w7-kit.mjs')
kit = kit
  .replace("'../../../packages/tools/harness/mock-deepseek.mjs'", JSON.stringify(join(ROOT, 'packages/tools/harness/mock-deepseek.mjs')))
  .replace("'../../kits/_shared/preset-seam.mjs'", JSON.stringify(join(ROOT, 'tests/kits/_shared/preset-seam.mjs')))
  .replace("'../../paths.mjs'", JSON.stringify(join(ROOT, 'tests/paths.mjs')))
  .replace('const KIT_DIR = dirname(new URL(import.meta.url).pathname)', 'const KIT_DIR = ' + JSON.stringify(HERE))
  .replace("const REPO_ROOT = resolve(KIT_DIR, '..', '..', '..')", 'const REPO_ROOT = ' + JSON.stringify(ROOT))
writeFileSync(join(HERE, 'a5w7-kit.mjs'), kit)
writeFileSync(join(HERE, 'a5w7-jobs-plugin.mjs'), show('tests/kits/a5-w7-jobs-wiring/a5w7-jobs-plugin.mjs'))

// The base kit-local project, with absolute paths (the copy sits elsewhere).
writeFileSync(join(HERE, 'tsconfig.lane.json'), JSON.stringify({
  '//': ['Restored from ' + BASE + ' with absolute paths: the reviewer runs the BASE',
    'kit-local compile against THIS worktree\'s lane sources (no injections).'],
  extends: join(ROOT, 'tsconfig.base.json'),
  compilerOptions: {
    rootDir: join(ROOT, 'packages/runtime/jobs-gateway'),
    outDir: join(ROOT, 'node_modules/.a5w7-jobs-build'),
    noEmit: false,
    types: [],
  },
  include: [join(ROOT, 'packages/runtime/jobs-gateway/**/*.ts')],
}, null, 2) + '\n')
console.log('built base-kit copy at ' + HERE)
