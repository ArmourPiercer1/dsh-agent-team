#!/usr/bin/env node
/**
 * Dist glue placement (R125 master product closure).
 *
 * tsc never emits .mjs. The production host row's `glueUrl` is a
 * row-owned path with no fallback: it must point at a file that EXISTS in
 * the built dist tree. The T12/P9 boot kit (packages/tools/harness/
 * t12-vertical.mjs) did this placement by hand ("tsc never emits .mjs:
 * place the FINAL glue byte-identically at its dist path"); this script
 * productizes that step so `pnpm build:composition` yields a mountable
 * dist on any machine.
 *
 * Files placed (byte-identical copies, idempotent):
 *   packages/runtime/src/plugin/live/agent-bindings.mjs
 *     -> packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs
 *
 * GLUE-6 (install-surface self-sufficiency, RED-A): the two files the shipped
 * entry loads at RUNTIME through a relative specifier are runtime
 * dependencies of the installed package, so they ride this list too. The
 * pre-GLUE-6 stance — "upstream-resolver.mjs is deliberately NOT placed, the
 * emitted host.js registers its resolve hook through a layout-candidate list,
 * so the source-tree file already satisfies it" — assumed a source checkout
 * is always present. It is not: the published face of the runtime package is
 * `files: ["dist"]`, and a strict unfolding of that face booted RED with
 * `ERR_MODULE_NOT_FOUND … packages/runtime/src/plugin/upstream-resolver.mjs`
 * (evidence: alpha5/install-entry run 2026-10-17T17-06-56Z, RED-A). Both
 * files now ship INSIDE the mirror and host.ts prefers the in-mirror
 * specifier, so the strict install face is self-contained:
 *   packages/runtime/src/plugin/upstream-resolver.mjs
 *     -> packages/runtime/dist/packages/runtime/src/plugin/upstream-resolver.mjs
 *   packages/runtime/root-binding/harness/seam.mjs
 *     -> packages/runtime/dist/packages/runtime/root-binding/harness/seam.mjs
 *
 * u7-w0 (2026-10-26) — the list is COLLECTED BY ENUMERATION. Until u7-w0 every
 * family lane appended its `{src, dist}` entries + a comment block to an in-file
 * `PLACEMENTS` array here — a shared list 2 of the 7 merged U7 PRs edited in
 * parallel. A lane now ADDS ONE FILE, `scripts/dist-placements/<NNN>-<family>.json`
 * (schema `dist-placements/1`), and edits nothing in this script. ORDER IS
 * EXPLICIT: files sort by name (the numeric prefix), entries keep their order
 * inside a file; `PLACEMENTS[0]` must stay the glue (composition-smoke reads it
 * as THE glue placement) and the loader refuses a list that breaks that. The
 * 38 entries at origin/master 88107ad71 moved verbatim, in order, with each
 * entry's comment carried as its `note`.
 *
 * Usage: node place-dist-glue.mjs [repo-root]   (default: cwd)
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The drop-in directory the list is collected from (beside this script). */
export const PLACEMENTS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'dist-placements')
const SCHEMA = 'dist-placements/1'
const FILE_NAME = /^\d{3}-[a-z0-9][a-z0-9-]*\.json$/
/** The glue: PLACEMENTS[0] by contract (composition-smoke's glue placement). */
export const GLUE_SRC = 'packages/runtime/src/plugin/live/agent-bindings.mjs'

/**
 * Load every placement file in sorted file-name order and return the flat
 * `[{src, dist}]` list. FAIL-CLOSED: any schema error, mis-named file, mirror
 * law breach (`dist !== packages/runtime/dist/<src>`), duplicate src/dist,
 * duplicate order prefix, or a first entry that is not the glue throws — a
 * placement list the gates cannot trust is never returned.
 * @param {string} [dir]
 * @returns {Array<{src: string, dist: string}>}
 */
export function loadPlacements(dir = PLACEMENTS_DIR) {
  const files = readdirSync(dir).filter((n) => n.endsWith('.json')).sort()
  if (files.length === 0) throw new Error(`place-dist-glue: no placement files in ${dir}`)
  const prefixes = new Set()
  const out = []
  const srcs = new Set()
  const dists = new Set()
  for (const file of files) {
    if (!FILE_NAME.test(file)) throw new Error(`place-dist-glue: ${file}: placement files are <NNN>-<family>.json (the prefix is the order)`)
    const prefix = file.slice(0, 3)
    if (prefixes.has(prefix)) throw new Error(`place-dist-glue: ${file}: order prefix ${prefix} is already taken — the order must be total`)
    prefixes.add(prefix)
    const doc = JSON.parse(readFileSync(join(dir, file), 'utf8'))
    if (doc?.schema !== SCHEMA) throw new Error(`place-dist-glue: ${file}: schema ${JSON.stringify(doc?.schema)} (expected ${SCHEMA})`)
    if (!Array.isArray(doc.placements) || doc.placements.length === 0) throw new Error(`place-dist-glue: ${file}: placements must be a non-empty array`)
    for (const p of doc.placements) {
      if (typeof p?.src !== 'string' || typeof p?.dist !== 'string') throw new Error(`place-dist-glue: ${file}: every placement needs src and dist strings`)
      if (p.dist !== `packages/runtime/dist/${p.src}`) throw new Error(`place-dist-glue: ${file}: mirror law — dist must be packages/runtime/dist/<src> (src ${p.src}, dist ${p.dist})`)
      if (srcs.has(p.src)) throw new Error(`place-dist-glue: ${file}: duplicate src ${p.src}`)
      if (dists.has(p.dist)) throw new Error(`place-dist-glue: ${file}: duplicate dist ${p.dist}`)
      srcs.add(p.src)
      dists.add(p.dist)
      out.push({ src: p.src, dist: p.dist })
    }
  }
  if (out[0]?.src !== GLUE_SRC) throw new Error(`place-dist-glue: the first placement must be the glue ${GLUE_SRC} (got ${String(out[0]?.src)})`)
  return out
}

/**
 * The dist-mirror placements (repo-root-relative). This list is the SINGLE
 * home for "which src files tsc never emits but the installed dist must
 * carry" — check-artifacts-committed.mjs imports it for its parity check
 * (check D), so a new placement file is gated automatically.
 */
export const PLACEMENTS = Object.freeze(loadPlacements().map((p) => Object.freeze(p)))

// Direct-invocation guard: the placement runs only when this file IS the
// node entry point (`node scripts/place-dist-glue.mjs [root]`); when
// imported (check-artifacts-committed.mjs) it exports PLACEMENTS only.
const invokedDirectly = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  const root = resolve(process.argv[2] ?? process.cwd())
  for (const { src, dist } of PLACEMENTS) {
    const srcPath = join(root, src)
    const distPath = join(root, dist)
    if (!existsSync(srcPath)) {
      console.error(`place-dist-glue: source missing: ${srcPath}`)
      process.exit(1)
    }
    // The dist tree must exist (tsc ran) — but NOT the target directory: tsc
    // creates directories only for files it emits, and .mjs files are not
    // emitted, so the target dir is created here.
    const distRoot = join(root, 'packages/runtime/dist')
    if (!existsSync(distRoot)) {
      console.error(`place-dist-glue: dist tree missing (${distRoot}) — run the package build (tsc) first`)
      process.exit(1)
    }
    mkdirSync(dirname(distPath), { recursive: true })
    copyFileSync(srcPath, distPath)
    console.log(`place-dist-glue: ${src} -> ${dist} (byte-identical)`)
  }
  console.log(`place-dist-glue: done (${PLACEMENTS.length} placement(s))`)
}
