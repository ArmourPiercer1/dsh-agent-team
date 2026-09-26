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
 * NOT placed (deliberate): packages/runtime/src/plugin/upstream-resolver.mjs —
 * the emitted host.js registers its resolve hook through a layout-candidate
 * list (dist OR source path), so the source-tree file already satisfies it.
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
