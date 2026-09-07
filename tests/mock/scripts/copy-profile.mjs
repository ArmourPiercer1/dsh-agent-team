/**
 * copy-profile.mjs — junction-preserving copy of the DSH web profile tree.
 *
 * WHY: the profile's top-level node_modules is a LINK FARM — every entry is
 * an absolute junction into the host tree (references/deepseek-harness-test-
 * use/apps/cli/node_modules/...). On Windows fs.cpSync follows junctions and
 * dies with STATUS_STACK_BUFFER_OVERRUN (0xC0000409) on the transitive cycle
 * (observed: node crash in ~2.4s, 2026-09-07). This walker lstats everything
 * (never follows links), copies regular files and directories, and
 * RE-CREATES every junction at the destination with its original target.
 * The host tree is the durable pinned test source, so the foreign targets
 * remain valid. (Scan evidence: 273 links, all foreign, none under
 * profiles/web/node_modules, which is a plain hardlinked pnpm tree.)
 *
 * Usage: node copy-profile.mjs <srcDir> <dstDir>
 * Exits non-zero on any lstat/readdir/copy error.
 */
import { cpSync, lstatSync, mkdirSync, readdirSync, readlinkSync, rmSync, symlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const [srcDir, dstDir] = process.argv.slice(2)
if (srcDir === undefined || dstDir === undefined) {
  console.error('usage: node copy-profile.mjs <srcDir> <dstDir>')
  process.exit(2)
}
const srcAbs = srcDir.replace(/\\/g, '/')
const dstAbs = dstDir.replace(/\\/g, '/')
// Idempotent: a previous crashed/partial copy must not survive.
if (existsSync(dstAbs)) rmSync(dstAbs, { recursive: true, force: true })

const stats = { files: 0, dirs: 0, links: 0, linkTargets: new Map() }

function copyTree(s, d) {
  const st = lstatSync(s)
  if (st.isSymbolicLink()) {
    const target = readlinkSync(s)
    // Junctions are directory-only on Windows; file links use the file type.
    let type = 'junction'
    try {
      if (lstatSync(target).isFile()) type = 'file'
    } catch { /* dangling target — a reparse point does not need it */ }
    stats.linkTargets.set(target, (stats.linkTargets.get(target) ?? 0) + 1)
    symlinkSync(target, d, type)
    stats.links++
    return
  }
  if (st.isDirectory()) {
    mkdirSync(d, { recursive: true })
    stats.dirs++
    for (const name of readdirSync(s)) {
      copyTree(join(s, name), join(d, name))
    }
    return
  }
  // Regular file (pnpm store hardlinks copy as plain files).
  cpSync(s, d)
  stats.files++
}

copyTree(srcAbs, dstAbs)
const foreign = [...stats.linkTargets.entries()].filter(([t]) => !t.startsWith(srcDir)).length
console.log(`COPY_PROFILE_OK files=${stats.files} dirs=${stats.dirs} junctions=${stats.links} uniqueTargets=${stats.linkTargets.size} foreignTargets=${foreign}`)
if (!existsSync(join(dstAbs, 'web', 'package.json'))) {
  console.error('COPY_PROFILE_VERIFY_FAIL: dst web/package.json missing after copy')
  process.exit(1)
}
// Sanity: the destination must contain the same top-level shape.
const srcTop = readdirSync(srcAbs).sort()
const dstTop = readdirSync(dstAbs).sort()
if (srcTop.join(',') !== dstTop.join(',')) {
  console.error(`COPY_PROFILE_VERIFY_FAIL: top-level mismatch src=${srcTop.join(',')} dst=${dstTop.join(',')}`)
  process.exit(1)
}
console.log('COPY_PROFILE_VERIFY_OK')
