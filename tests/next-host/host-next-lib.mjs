/**
 * host-next-lib.mjs — the NEXT HOST (0.2.2-rc.5) test lane's shared plumbing.
 *
 * WHAT THIS IS: the second, independent pinned DSH host (tests/paths.mjs
 * `NEXT_HOST`) is a gitignored, shallow clone at a lightweight upstream tag.
 * This module is the ONE place the lane (a) fails loudly when that host or its
 * pinned native assets are absent, and (b) resolves the host's public package
 * entry modules — by package name, through the host tree's own resolver, never
 * by reaching into a `src/` private module.
 *
 * FAIL-LOUD LAW (repo precedent: "missing host -> skip" hid two real breaks):
 * every export here THROWS on a missing/mismatched host tree or asset. There is
 * no skip path, no `t.skip()`, no faked fallback. The lane is run explicitly
 * (`node --test tests/next-host/`) because the tree is provisioned by a
 * documented command (docs/TEST_METHODS.md §11) and is not part of CI's
 * census; a run without the tree is a RED run, not a green skip.
 *
 * CORE PATCH BUDGET = 0: nothing here writes to the host tree except the
 * provisioning CLI's own `bin/` write (via the shared, digest-verified
 * provisioner), and no host `src/` module is imported.
 */
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { NEXT_HOST, nextHostTree } from '../paths.mjs'
import { detectedLibcVariant, manifestPlatformEntry, readHostSandboxAssetManifest } from '../world-factory/lib/host-sandbox-assets.mjs'

/** Repo root of the worktree this module lives in (tests/next-host -> ../..). */
export const NEXT_LANE_REPO_ROOT = resolve(new URL('.', import.meta.url).pathname, '..', '..')

export class NextHostMissingError extends Error {
  constructor(detail) {
    super(`next host lane: ${detail}`)
    this.name = 'NextHostMissingError'
  }
}

/** Absolute path of the pinned next-host tree. */
export function nextTree(repoRoot = NEXT_LANE_REPO_ROOT) {
  return nextHostTree(repoRoot)
}

const git = (args, cwd) => spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' })

/**
 * Assert the next-host tree exists, is a git checkout at EXACTLY the pinned
 * commit, and that its package version is the pinned version. Throws otherwise.
 * @returns {{tree: string, head: string, version: string}}
 */
export function assertNextHostTree(repoRoot = NEXT_LANE_REPO_ROOT) {
  const tree = nextTree(repoRoot)
  if (!existsSync(tree) || !statSync(tree).isDirectory()) {
    throw new NextHostMissingError(`no host tree at ${tree} — provision it with the documented command (docs/TEST_METHODS.md §11): git clone --branch ${NEXT_HOST.tag} --depth 1 ${NEXT_HOST.url} ${NEXT_HOST.treeRel}`)
  }
  if (!existsSync(join(tree, 'apps/cli/lib/bin.js'))) {
    throw new NextHostMissingError(`the host tree at ${tree} is not BUILT (apps/cli/lib/bin.js missing) — run: cd ${NEXT_HOST.treeRel} && pnpm install --ignore-scripts --frozen-lockfile && DSH_CLIENT_COMMIT_HASH=${NEXT_HOST.shortSha} pnpm run build`)
  }
  const head = git(['rev-parse', 'HEAD'], tree)
  if (head.status !== 0) throw new NextHostMissingError(`${tree} is not a git checkout: ${String(head.stderr ?? '').trim()}`)
  const sha = String(head.stdout ?? '').trim()
  if (sha !== NEXT_HOST.sha) {
    throw new NextHostMissingError(`the host tree at ${tree} is at ${sha}, the pin is ${NEXT_HOST.sha} (${NEXT_HOST.tag}) — refusing to test a drifted tree`)
  }
  const version = JSON.parse(readFileSync(join(tree, 'package.json'), 'utf8')).version
  if (version !== NEXT_HOST.version) {
    throw new NextHostMissingError(`the host tree at ${tree} declares version ${version}, the pin is ${NEXT_HOST.version}`)
  }
  return { tree, head: sha, version }
}

/**
 * Assert the pinned native assets are the COMMITTED bytes (per-file length +
 * sha256 + mode from the manifest's `next` entry). A locally built addon is NOT
 * accepted — measured on this very tree: a plain `pnpm run build` produced
 * `bin/glibc/system.node` = dfa6d586-shaped 75450f92… (17352 B), not the pin.
 * @returns {{files: Array<{relPath: string, sha256: string, bytes: number, mode: string}>}}
 */
export function assertNextHostAssets(repoRoot = NEXT_LANE_REPO_ROOT) {
  const { tree } = assertNextHostTree(repoRoot)
  const manifest = readHostSandboxAssetManifest({ repoRoot })
  const pinned = manifestPlatformEntry(manifest, {
    version: NEXT_HOST.version,
    sha: NEXT_HOST.sha,
    platform: `${process.platform}-${process.arch}`,
    libc: detectedLibcVariant(),
  })
  const platformDir = join(tree, 'native', 'system', 'packages', `${process.platform}-${process.arch}`)
  const files = []
  for (const [relPath, spec] of Object.entries(pinned.files)) {
    const path = join(platformDir, relPath)
    if (!existsSync(path)) {
      throw new NextHostMissingError(`pinned native asset ${relPath} is ABSENT from the next host tree — provision it: node scripts/provision-host-assets.mjs --from-package --host next`)
    }
    const bytes = readFileSync(path)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    if (sha256 !== spec.sha256 || bytes.length !== spec.bytes) {
      throw new NextHostMissingError(`pinned native asset ${relPath} is DRIFTED: ${sha256} (${bytes.length} B), pin is ${spec.sha256} (${spec.bytes} B) — a locally built binary is not the pinned host; re-provision with node scripts/provision-host-assets.mjs --from-package --host next`)
    }
    files.push({ relPath, sha256, bytes: bytes.length, mode: spec.mode })
  }
  return { files, launcher: pinned.launcher }
}

/**
 * The host tree's own package resolver, anchored at the packages this lane
 * imports (all of them are published packages with a public `exports` map; the
 * resolver is the host's, so a package rename shows up as a resolution error
 * here rather than as a silent private-path import).
 */
const PER_SPEC_ANCHORS = [
  'packages/core/tools/package.json',
  'packages/test-support/agent-loop-testkit/package.json',
  'packages/test-support/tool-testkit/package.json',
  'packages/ptc-runtime/ptc-runtime/package.json',
  'packages/core/agent/package.json',
]

/** Resolve one host package entry to an absolute file path. */
export function resolveHostModule(spec, tree = nextTree()) {
  for (const rel of PER_SPEC_ANCHORS) {
    try {
      return createRequire(join(tree, rel)).resolve(spec)
    } catch (error) {
      if (error?.code !== 'MODULE_NOT_FOUND') throw error
    }
  }
  throw new NextHostMissingError(`the next host tree at ${tree} does not resolve ${spec} — is the tree installed (pnpm install --ignore-scripts --frozen-lockfile)?`)
}

/** Dynamic-import one host public package entry by package name. */
export function hostImport(spec, tree = nextTree()) {
  return import(pathToFileURL(resolveHostModule(spec, tree)).href)
}

/** A workspace-internal scratch cwd for a harness context (never /tmp). */
export function nextLaneWorkdir(repoRoot = NEXT_LANE_REPO_ROOT) {
  const root = join(repoRoot, '.artifacts', 'tmp', 'next-host-lane')
  mkdirSync(root, { recursive: true })
  return mkdtempSync(join(root, 'cwd-'))
}

/**
 * One machine-greppable evidence line per assertion. The runner prints these
 * verbatim; the evidence file and the PR quote them as measured, not restated.
 */
export function proof(id, ok, detail) {
  const line = `NEXT-SMOKE ${id} ${ok ? 'ok' : 'FAIL'} ${detail}`
  console.log(line)
  return line
}
