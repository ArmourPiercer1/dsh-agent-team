#!/usr/bin/env node
// pbf-root-surface-check.mjs — R127 execution 1: verify the NEW install
// surface of the task tree (root package.json + cordis.patch.yml + host
// derivation) WITHOUT booting a host:
//
//   1. root package.json declares dsh.bundle.patch + dsh.client + exports
//      (the host reconcile + client scan contract).
//   2. the tracked cordis.patch.yml parses; its host row config (NO
//      glueUrl/seamUrl/defaultWorkspace) passes the REAL built validator;
//      its blueprintSource keeps the --- delimiters.
//   3. the BUILT host entry's exported derivation helpers (imported under
//      plain Node from the dist layout) point at files that EXIST in the
//      task tree: glue single candidate + seam first-existing candidate.
//   4. explicit-URL configs still validate (R122/125 worlds unchanged).
//
// Exit 0 when all pass.
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'

// The root to check: default = the PBF task worktree (pass another repo
// root as argv[2], e.g. for a fresh-clone gate).
const repoRoot = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(dirname(fileURLToPath(import.meta.url)), '..', '.worktrees', 'PBF')
const require = createRequire(import.meta.url)

let pass = true
function check(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) pass = false
}

// ---- 1. root package.json contract ----------------------------------------
const rootPkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
check('root: dsh.bundle.patch declared', rootPkg?.dsh?.bundle?.patch === './cordis.patch.yml')
check('root: dsh.client = { platform: "web" }', JSON.stringify(rootPkg?.dsh?.client) === JSON.stringify({ platform: 'web' }))
check('root: exports "." -> composition-shim/index.js', rootPkg?.exports?.['.'] === './packages/client/composition-shim/index.js')
check('root: exports "./host" -> dist host.js', rootPkg?.exports?.['./host'] === './packages/runtime/dist/packages/runtime/src/plugin/host.js')
check('root: exports "./client" -> client-bundle.js', rootPkg?.exports?.['./client'] === './packages/client/composition-shim/client-bundle.js')
check('root: exports "./package.json"', rootPkg?.exports?.['./package.json'] === './package.json')
check('root: prepare builds on install (--ignore-scripts)', /pnpm install --ignore-scripts && pnpm build && pnpm build:composition/.test(rootPkg?.scripts?.prepare ?? ''))
for (const target of Object.values(rootPkg?.exports ?? {}).filter((t) => t !== './package.json')) {
  check(`root: exports target exists on disk (${target})`, existsSync(join(repoRoot, target)))
}
check('root: cordis.patch.yml exists (tracked layer doc)', existsSync(join(repoRoot, 'cordis.patch.yml')))

// ---- 2. cordis.patch.yml — parse + real validator --------------------------
const YAML = require(join(repoRoot, 'packages/runtime/node_modules/yaml'))
const layer = YAML.parse(readFileSync(join(repoRoot, 'cordis.patch.yml'), 'utf8'))
const inserts = layer?.[0]?.insert
check('layer: one patch with two insert rows', Array.isArray(inserts) && inserts.length === 2)
const hostRow = inserts?.find((row) => row.id === 'dsh-agent-team')
const clientRow = inserts?.find((row) => row.id === 'dsh-agent-team-client')
check('layer: host row name = "dsh-agent-team/host" (subpath package)', hostRow?.name === 'dsh-agent-team/host')
check('layer: client row name = "dsh-agent-team" (bare package)', clientRow?.name === 'dsh-agent-team')
check('layer: host config carries NO glueUrl/seamUrl/defaultWorkspace',
  hostRow?.config && !('glueUrl' in hostRow.config) && !('seamUrl' in hostRow.config) && !('defaultWorkspace' in hostRow.config))
check('layer: blueprintSource keeps --- delimiters',
  typeof hostRow?.config?.blueprintSource === 'string'
  && hostRow.config.blueprintSource.split('\n')[0].trim() === '---'
  && hostRow.config.blueprintSource.trimEnd().split('\n').at(-1).trim() === '---')
check('layer: blueprint = my-team-bp-1', /blueprintId: my-team-bp-1/.test(hostRow?.config?.blueprintSource ?? ''))
check('layer: staticModel default = deepseek-official/deepseek-v4-flash',
  hostRow?.config?.staticModel?.provider === 'deepseek-official' && hostRow?.config?.staticModel?.model === 'deepseek-v4-flash')

// the REAL built validator (plain Node, dist layout)
const hostEntryUrl = pathToFileURL(join(repoRoot, rootPkg.exports['./host'])).href
const hostEntry = await import(hostEntryUrl)
let validatorOk = true
let validatorErr = null
let validated
try {
  validated = hostEntry.validateTeamPluginConfig(hostRow.config)
} catch (error) {
  validatorOk = false
  validatorErr = String(error?.message ?? error)
}
check('shipped host row config passes the REAL built validator (no URLs)', validatorOk, validatorErr ?? undefined)

// explicit-URL configs still validate (R122/125 worlds unchanged)
const explicit = structuredClone(hostRow.config)
explicit.glueUrl = 'file:///x/y.mjs'
explicit.seamUrl = 'file:///x/z.mjs'
let explicitOk = true
try {
  const v = hostEntry.validateTeamPluginConfig(explicit)
  explicitOk = v.glueUrl === 'file:///x/y.mjs' && v.seamUrl === 'file:///x/z.mjs'
} catch (error) {
  explicitOk = false
  console.log(`  explicit-config error: ${String(error?.message ?? error)}`)
}
check('explicit glueUrl/seamUrl configs still validate (regression guard)', explicitOk)

// empty-string glueUrl still fails (validator semantics)
const emptyGlue = structuredClone(hostRow.config)
emptyGlue.glueUrl = ''
let emptyRejected = false
try {
  hostEntry.validateTeamPluginConfig(emptyGlue)
} catch {
  emptyRejected = true
}
check('glueUrl present-but-empty still rejected', emptyRejected)

// ---- 3. derivation helpers from the BUILT entry (dist layout) ---------------
check('built entry exports defaultGlueUrl + defaultSeamUrlCandidates',
  typeof hostEntry.defaultGlueUrl === 'function' && typeof hostEntry.defaultSeamUrlCandidates === 'function')
const distHostUrl = hostEntryUrl
const glueUrl = hostEntry.defaultGlueUrl(distHostUrl)
check('dist layout: derived glueUrl resolves to the real dist mirror',
  glueUrl === pathToFileURL(join(repoRoot, 'packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs')).href
  && existsSync(fileURLToPath(glueUrl)),
  glueUrl)
const seamCandidates = hostEntry.defaultSeamUrlCandidates(distHostUrl)
const seamHit = seamCandidates.find((u) => existsSync(fileURLToPath(u)))
check('dist layout: first seam candidate exists and is the package seam',
  seamCandidates.length === 2
  && seamHit === seamCandidates[0]
  && seamHit === pathToFileURL(join(repoRoot, 'packages/runtime/root-binding/harness/seam.mjs')).href,
  `hit=${seamHit} of ${seamCandidates.length}`)
// src-layout derivation (unit-test runner context)
const srcHostUrl = pathToFileURL(join(repoRoot, 'packages/runtime/src/plugin/host.ts')).href
check('src layout: derived glueUrl resolves to the source .mjs',
  hostEntry.defaultGlueUrl(srcHostUrl) === pathToFileURL(join(repoRoot, 'packages/runtime/src/plugin/live/agent-bindings.mjs')).href
  && existsSync(fileURLToPath(hostEntry.defaultGlueUrl(srcHostUrl))))
const srcSeamCandidates = hostEntry.defaultSeamUrlCandidates(srcHostUrl)
check('src layout: second seam candidate is the source seam (exists)',
  srcSeamCandidates[1] === pathToFileURL(join(repoRoot, 'packages/runtime/root-binding/harness/seam.mjs')).href
  && existsSync(fileURLToPath(srcSeamCandidates[1])))

console.log(pass ? 'PASS pbf-root-surface-check' : 'FAIL pbf-root-surface-check')
process.exit(pass ? 0 : 1)
