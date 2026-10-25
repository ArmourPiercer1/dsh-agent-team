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
  {
    // alpha5 PTC fs half-arm (10:04Z work order): the escalation
    // adjudication row — production import edge from agent-bindings (the
    // gate), shipped through the same dist mirror as every prior live row.
    src: 'packages/runtime/src/plugin/live/ptc-escalation-row.mjs',
    dist: 'packages/runtime/dist/packages/runtime/src/plugin/live/ptc-escalation-row.mjs',
  },
  {
    // U6 PR1 center-assembly SHADOW row: the config-gated
    // (`teamToolPlane.centerAssembly: 'shadow'`) mount that agent-bindings
    // dynamically imports — production import edge from the glue (the gate),
    // shipped through the same dist mirror law as every prior live row. Its
    // own relative import of the governance-center lane resolves INSIDE the
    // mirror (tsc emits the lane; this .mjs rides the byte-copy list).
    src: 'packages/runtime/src/plugin/live/center-shadow-row.mjs',
    dist: 'packages/runtime/dist/packages/runtime/src/plugin/live/center-shadow-row.mjs',
  },
  // GLUE-7 production backend assembly row (byte-copied: tsc never emits
  // .mjs; the plane row imports it by a relative in-face specifier, so the
  // shipped face must carry it exactly like the plane row itself).
  //
  // A5-SRGP (PR5 search row) CORRECTED the scope of the two entries below on the
  // master replay, and the correction stays visible here because an earlier note in
  // this list was wrong in a way only the whole-tree census caught:
  // `a5g6-install-face-render` (run 39114260882) failed with
  // `Cannot find module './glob-backend.mjs' imported from
  // .../dist/.../search-backend.mjs`. The law is the TRANSITIVE import graph of the
  // shipped face, not "what the plane row happens to name":
  //
  //   plane-effect-backends.mjs -> search-backend.mjs -> glob-backend.mjs
  //
  // The search row delegates its anchored-walk and shared-law work to the confined-rg
  // row (`search-backend.mjs:186` imports `openAnchoredWalkRoot` +
  // `verifyGlobResultsBeneath` from `./glob-backend.mjs`), so the face must carry that
  // file even though the PLANE never imports it and even though the glob row is not
  // itself production-wired on this line. The dropped note asked only "does the plane
  // import the glob row?", heard "no", and cut the copy — a narrowing measured from
  // the wrong importer. The list must be walked from every file it already contains,
  // which is what leg `M3` of `alpha5-search-backend.test.ts` now pins so the mistake
  // cannot be repeated by the next reader who narrows this list.
  {
    src: 'packages/runtime/src/plugin/live/glob-backend.mjs',
    dist: 'packages/runtime/dist/packages/runtime/src/plugin/live/glob-backend.mjs',
  },
  {
    src: 'packages/runtime/src/plugin/live/search-backend.mjs',
    dist: 'packages/runtime/dist/packages/runtime/src/plugin/live/search-backend.mjs',
  },
  {
    src: 'packages/runtime/src/plugin/live/plane-effect-backends.mjs',
    dist: 'packages/runtime/dist/packages/runtime/src/plugin/live/plane-effect-backends.mjs',
  },
  // A5-CANCEL (branch `a5-cancel-leg`): the two async confined-rg rows above both
  // import this module by RELATIVE specifier, so on the strict
  // `files: ["dist"]` install face a missing copy is ERR_MODULE_NOT_FOUND at the
  // first search/glob call — the same failure class GLUE-6 RED-A recorded for
  // `upstream-resolver.mjs`. Walked from the files the list already contains, as
  // the M3 leg of `alpha5-search-backend.test.ts` requires.
  {
    src: 'packages/runtime/src/plugin/live/cancel-leg.mjs',
    dist: 'packages/runtime/dist/packages/runtime/src/plugin/live/cancel-leg.mjs',
  },
  // A5-M1 (PR358-B): the PA mount registry is imported by the production
  // root entry (`root.ts` — a `@ts-ignore` relative `.mjs` specifier that
  // tsc never emits) exactly like upstream-resolver was at GLUE-6 RED-A:
  // on the strict `files: ["dist"]` install face a missing copy is
  // ERR_MODULE_NOT_FOUND at root construction. Same law as every entry:
  // byte-identical placement, drift gate D compares src vs dist.
  {
    src: 'packages/runtime/src/plugin/live/pa-mount-registry.mjs',
    dist: 'packages/runtime/dist/packages/runtime/src/plugin/live/pa-mount-registry.mjs',
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
  // A5-M1 PACKING (root-approved): the landlock pre-launcher is a TRACKED
  // runtime asset (`git ls-tree` at the release commit carries it) that tsc
  // never emits, so the strict `files: ["dist"]` install face shipped WITHOUT
  // it — and `provider.js`'s own default launcher path
  // (`assembly.launcherPath ?? join(dirname(fileURLToPath(import.meta.url)),
  // 'launcher', 'landlock-prelauncher.py')`, dist provider.js:90) resolved to a
  // missing file, so confined bash could not start from an installed package at
  // all. Same class as GLUE-6 RED-A (a runtime dependency outside tsc's emit
  // must sit INSIDE the mirror). Byte-identical placement like every entry here;
  // the drift gate (check D) compares src vs dist. NO sandbox rule, trust rule
  // or path-trust boundary changes: the CONFINE_CONFIG_INCOMPLETE /
  // TRUST_ROOT_SHA_MISMATCH triple and the verifyLauncherIntegrity byte gate
  // still decide every single use of this file.
  {
    src: 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py',
    dist: 'packages/runtime/dist/packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py',
  },
  // U6 PR2 PACKING: the FS family lane's .mjs runtime modules. Same law as
  // every entry above — tsc never emits `.mjs`, so the lane's runtime face
  // (barrel + mechanics + executor + presentation + row + contribution)
  // rides the byte-copy mirror; check D compares src vs dist. The lane's ONE
  // TypeScript module (`read-normalizer.ts`, the pure projection the
  // canonicalizer statically imports) is EMITTED by tsc through the runtime
  // build include, so it is deliberately NOT listed here. The relative edges
  // (`../../..` up to `packages/…`) resolve identically in src and in the
  // mirror because the mirror sits at `dist/packages/…`.
  {
    src: 'packages/tools/fs-family/src/index.mjs',
    dist: 'packages/runtime/dist/packages/tools/fs-family/src/index.mjs',
  },
  {
    src: 'packages/tools/fs-family/src/fs-mechanics.mjs',
    dist: 'packages/runtime/dist/packages/tools/fs-family/src/fs-mechanics.mjs',
  },
  {
    src: 'packages/tools/fs-family/src/read-presentation.mjs',
    dist: 'packages/runtime/dist/packages/tools/fs-family/src/read-presentation.mjs',
  },
  {
    src: 'packages/tools/fs-family/src/read-executor.mjs',
    dist: 'packages/runtime/dist/packages/tools/fs-family/src/read-executor.mjs',
  },
  {
    src: 'packages/tools/fs-family/src/read-row.mjs',
    dist: 'packages/runtime/dist/packages/tools/fs-family/src/read-row.mjs',
  },
  {
    src: 'packages/tools/fs-family/src/fs-read-contribution.mjs',
    dist: 'packages/runtime/dist/packages/tools/fs-family/src/fs-read-contribution.mjs',
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
