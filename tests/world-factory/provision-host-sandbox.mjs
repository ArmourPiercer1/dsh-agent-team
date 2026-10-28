#!/usr/bin/env node
/**
 * provision-host-sandbox.mjs — operator CLI for the pinned native sandbox
 * assets of a Host runtime checkout (docs/TEST_METHODS.md §9).
 *
 *   node tests/world-factory/provision-host-sandbox.mjs [options]
 *
 * Offline and local-only: it copies the gitignored native assets from an
 * explicit LOCAL source tree and verifies them against the committed pinned
 * manifest. It never downloads anything and never writes into the source tree.
 *
 * Exit codes: 0 = usable (present or provisioned), 1 = backend still unusable
 * (an environment state, recorded as ENV_BLOCK by suites), 2 = fail-closed
 * typed error (digest/manifest/source problem — supply chain, not environment).
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  HostSandboxAssetError, MANIFEST_REL, SOURCE_TREE_ENV,
  preflightHostSandbox, readHostSandboxAssetManifest,
} from './lib/host-sandbox-assets.mjs'
import { DSH_BASELINE_VERSION, findTestRepoRoot, TEST_USE_BASELINE_SHA, testUseTree } from '../paths.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** The Team tree this CLI lives in (manifest + default-source lookup root). */
const TEAM_TREE = resolve(HERE, '..', '..')

const usage = () => {
  console.log([
    'usage: node tests/world-factory/provision-host-sandbox.mjs [options]',
    '',
    '  --runtime-tree <path>  destination runtime checkout (default: <this tree>/tests/deepseek-harness-test-use)',
    `  --source-tree <path>   LOCAL source tree (default: $${SOURCE_TREE_ENV} → the main Team checkout's runtime tree)`,
    '  --check                report only: never copy, never write',
    '  --manifest             print the pinned manifest and exit',
    '',
    'exit 0 = backend usable · 1 = still unusable (environment) · 2 = fail-closed (supply chain)',
  ].join('\n'))
}

const args = process.argv.slice(2)
const opt = (name) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? null : args[i + 1] ?? null
}
if (args.includes('--help') || args.includes('-h')) { usage(); process.exit(0) }

try {
  if (args.includes('--manifest')) {
    // MANIFEST_REL is repo-root-relative, so the root passed here is the TEAM
    // tree — never `HERE` (that spells tests/world-factory twice, and the
    // advertised flag then crashed instead of printing the pin: review round 1).
    console.log(JSON.stringify(readHostSandboxAssetManifest({ repoRoot: TEAM_TREE }), null, 2))
    process.exit(0)
  }

  const runtimeTree = resolve(opt('runtime-tree') ?? testUseTree(findTestRepoRoot(TEAM_TREE) ?? TEAM_TREE))
  const sourceTree = opt('source-tree')
  const check = args.includes('--check')

  console.log(`runtime tree : ${runtimeTree}`)
  console.log(`baseline pin : ${DSH_BASELINE_VERSION}@${TEST_USE_BASELINE_SHA}`)
  console.log(`manifest     : ${MANIFEST_REL}`)
  const p = await preflightHostSandbox({
    runtimeTree,
    sourceTree,
    repoRoot: TEAM_TREE,
    provision: !check,
    throwOnProbeError: true,
  })
  console.log(`probe        : ${p.verdicts.map((v) => `${v.phase}=${v.backend}`).join(' -> ')}`)
  console.log(`backend      : ${p.backend} (usable: ${p.usable})`)
  console.log(`launcher     : ${p.launcherPresent ? 'present' : 'ABSENT'} ${p.launcherSha256 ?? ''}`)
  if (p.asset !== null) {
    console.log(`provisioning : ${p.asset.action} (${p.asset.bytesWritten} bytes) from ${p.asset.source?.kind} ${p.asset.source?.tree}`)
    for (const f of p.asset.files) console.log(`  ${f.relPath}  ${f.state}  ${f.sha256}  ${f.mode}`)
  }
  if (p.provisionError !== null) console.log(`provision    : refused (${p.provisionError.code}) — environment state, recorded as ENV_BLOCK by suites`)
  console.log(`porcelain    : ${p.porcelainEmpty === true ? 'empty (assets are gitignored)' : `NOT clean/unavailable: ${JSON.stringify(p.porcelain?.lines ?? [])}`}`)
  process.exit(p.usable ? 0 : 1)
} catch (error) {
  // Every typed failure — manifest, probe, provisioning — leaves through THIS
  // printer with exit 2. Nothing above may throw past it: an uncaught error
  // exits 1, which this CLI documents as "environment", not "fail closed".
  if (error instanceof HostSandboxAssetError) {
    console.error(`FAIL-CLOSED ${error.code}`)
    console.error(String(error.message))
  } else {
    console.error(`FAIL-CLOSED (unexpected): ${String(error?.stack ?? error)}`)
  }
  process.exit(2)
}
