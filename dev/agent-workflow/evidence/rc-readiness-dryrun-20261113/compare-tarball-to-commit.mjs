#!/usr/bin/env node
/**
 * compare-tarball-to-commit.mjs — RC dry-run helper (DEV-LIVE).
 *
 * Answers one question: is the packed artifact the packed COMMIT, or some
 * worktree that merely looked clean? (Tarball ↔ commit identity, item 3.)
 *
 * METHOD
 *   1. Extract the tarball into scratch (`tar -xzf`), read `package/package.json`
 *      (version + private).
 *   2. For every REGULAR file member, hash its bytes the way git hashes a blob
 *      (`git hash-object`, i.e. `sha1("blob <len>\0" + content)`) and compare it
 *      with `git ls-tree -r <commit>` for the same relative path.
 *   3. Report: matched, mismatched (path + both shas), tarball-only (untracked in
 *      the commit), and commit-only (tracked but not shipped — informational).
 *
 * LIMITS (stated in the README, repeated here because the tool must not imply
 * more than it checked)
 *   - It compares CONTENT, not tar metadata: mtimes/uid/gid/mode are not part of
 *     git and are never compared. A tarball can therefore differ byte-wise from a
 *     second pack of the same tree without any content difference (see §3).
 *   - "commit-only" files are expected: the tarball ships the `files` allow-list
 *     plus README/package.json, not the whole repo.
 *   - `dist/` is tracked in git, so it is compared like any other file; this is
 *     exactly why the comparison is meaningful for the install surface.
 *
 * USAGE node compare-tarball-to-commit.mjs <tarball> <commit> [--out <json>]
 */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..', '..')
const [TARBALL, COMMIT] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const outIdx = process.argv.indexOf('--out')
const OUT = outIdx === -1 ? null : process.argv[outIdx + 1]
if (!TARBALL || !COMMIT) {
  console.error('usage: compare-tarball-to-commit.mjs <tarball> <commit> [--out <json>]')
  process.exit(2)
}

const scratch = join(REPO, '.artifacts', 'tmp', `rc-dryrun-extract-${process.pid}`)
rmSync(scratch, { recursive: true, force: true })
mkdirSync(scratch, { recursive: true })

function git(args, input) {
  const out = spawnSync('git', ['-C', REPO, ...args], { input, encoding: 'buffer', maxBuffer: 512 * 1024 * 1024 })
  if (out.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${String(out.stderr)}`)
  return out.stdout
}

try {
  const extract = spawnSync('tar', ['-xzf', TARBALL, '-C', scratch], { encoding: 'utf8' })
  if (extract.status !== 0) throw new Error(`tar failed: ${extract.stderr}`)
  const pkg = JSON.parse(readFileSync(join(scratch, 'package', 'package.json'), 'utf8'))

  // Regular file members only (directories/symlinks are not content).
  const listing = spawnSync('tar', ['-tzvf', TARBALL], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 })
  const members = String(listing.stdout).split('\n').filter(Boolean)
    .filter((line) => line.startsWith('-'))              // regular files
    .map((line) => line.split(/\s+/).slice(5).join(' ').replace(/^package\//, ''))

  // The commit's full tree, path -> git blob sha.
  const tree = new Map()
  for (const line of git(['ls-tree', '-r', '-z', COMMIT]).toString('utf8').split('\0')) {
    if (line === '') continue
    const [meta, path] = line.split('\t')
    const [, type, sha] = meta.split(' ')
    if (type === 'blob') tree.set(path, sha)
  }

  const matched = []
  const mismatched = []
  const tarballOnly = []
  const tarballPaths = new Set()
  for (const rel of members) {
    tarballPaths.add(rel)
    const abs = join(scratch, 'package', rel)
    if (!existsSync(abs)) continue
    const content = readFileSync(abs)
    const sha = createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex')
    const inCommit = tree.get(rel)
    if (inCommit === undefined) tarballOnly.push(rel)
    else if (inCommit === sha) matched.push(rel)
    else mismatched.push({ path: rel, tarball: sha, commit: inCommit })
  }
  const commitOnly = [...tree.keys()].filter((p) => !tarballPaths.has(p))

  const result = {
    schema: 'rc-dryrun/tarball-vs-commit/1',
    tarball: resolve(TARBALL),
    tarballSha256: createHash('sha256').update(readFileSync(TARBALL)).digest('hex'),
    tarballBytes: readFileSync(TARBALL).length,
    commit: git(['rev-parse', COMMIT]).toString('utf8').trim(),
    internalPackage: { name: pkg.name, version: pkg.version, private: pkg.private === true },
    counts: {
      regularMembers: members.length,
      matched: matched.length,
      mismatched: mismatched.length,
      tarballOnly: tarballOnly.length,
      commitTracked: tree.size,
      commitOnly: commitOnly.length,
    },
    mismatched,
    tarballOnly: tarballOnly.slice(0, 200),
    note: 'content-only comparison (git blob sha1); tar mtimes/uid/gid/mode are not compared and are not part of git',
  }
  const text = `${JSON.stringify(result, null, 2)}\n`
  if (OUT !== null) writeFileSync(OUT, text)
  process.stdout.write(text)
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
