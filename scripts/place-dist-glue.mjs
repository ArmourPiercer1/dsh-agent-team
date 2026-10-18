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
 * Usage: node place-dist-glue.mjs [repo-root]   (default: cwd)
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The dist-mirror placements (repo-root-relative). This list is the SINGLE
 * home for "which src files tsc never emits but the installed dist must
 * carry" — check-artifacts-committed.mjs imports it for its parity check
 * (check D), so a new placement added here is gated automatically.
 */
export const PLACEMENTS = [
  {
    src: 'packages/runtime/src/plugin/live/agent-bindings.mjs',
    dist: 'packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs',
  },
  // GLUE-5 live rows (byte-copied like the glue itself: tsc never emits .mjs).
  {
    src: 'packages/runtime/src/plugin/live/team-tool-plane.mjs',
    dist: 'packages/runtime/dist/packages/runtime/src/plugin/live/team-tool-plane.mjs',
  },
  {
    src: 'packages/runtime/src/plugin/live/jobs-gateway-assembly.mjs',
    dist: 'packages/runtime/dist/packages/runtime/src/plugin/live/jobs-gateway-assembly.mjs',
  },
  // GLUE-7 production backend assembly row (byte-copied: tsc never emits
  // .mjs; the plane row imports it by a relative in-face specifier, so the
  // shipped face must carry it exactly like the plane row itself).
  // A5-SRGP search row (byte-copied: tsc never emits .mjs, and the plane's search
  // row delegates to it by a relative in-face specifier, so the shipped face must
  // carry it exactly like the plane row itself).
  //
  // SCOPE NOTE, because branch lines differ here: the anchored GLOB row
  // (`glob-backend.mjs`) is deliberately NOT listed. On this baseline it ships as a
  // DORMANT file — `plane-effect-backends.mjs` still builds the glob row inline and
  // imports nothing from it — so putting a copy of it in the dist face would claim a
  // face row nothing can reach. A placement means "the shipped face needs this
  // byte-copy", not "this source file exists". When the glob mount lands and imports
  // it, that row's owner adds the entry.
  {
    src: 'packages/runtime/src/plugin/live/search-backend.mjs',
    dist: 'packages/runtime/dist/packages/runtime/src/plugin/live/search-backend.mjs',
  },
  {
    src: 'packages/runtime/src/plugin/live/plane-effect-backends.mjs',
    dist: 'packages/runtime/dist/packages/runtime/src/plugin/live/plane-effect-backends.mjs',
  },
  // GLUE-6 RED-A: the entry's RUNTIME dependencies outside tsc's emit. The
  // resolve hook is registered by `module.register` at apply time and the
  // storage seam is imported by the boot row — both from a relative
  // specifier, so on the strict `files: ["dist"]` install face they must sit
  // INSIDE the mirror or the bootstrap dies with ERR_MODULE_NOT_FOUND.
  // Byte-identical like every other placement; the drift gate (check D)
  // compares src vs dist for each entry of this list.
  {
    src: 'packages/runtime/src/plugin/upstream-resolver.mjs',
    dist: 'packages/runtime/dist/packages/runtime/src/plugin/upstream-resolver.mjs',
  },
  {
    src: 'packages/runtime/root-binding/harness/seam.mjs',
    dist: 'packages/runtime/dist/packages/runtime/root-binding/harness/seam.mjs',
  },
]

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
