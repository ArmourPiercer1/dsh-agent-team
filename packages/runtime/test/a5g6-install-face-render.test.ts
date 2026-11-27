/**
 * a5g6-install-face-render.test.ts — GLUE-6 unit legs for the two shipped-
 * artifact defects this round closes. Both legs grade the SHIPPED surface
 * (the committed `packages/runtime/dist` mirror), not a lane copy; the live
 * proofs of the same two claims are the recorded runs under
 * `dev/agent-workflow/evidence/alpha5/glue6/` (the boot leg and the live
 * host trio leg — the latter is the one no synth test can substitute for,
 * see the README's RED-② row).
 *
 * LEG A — install-face self-sufficiency (RED-A). The entry loads two .mjs
 * files at RUNTIME through relative specifiers: the `module.register`
 * resolve hook and the default storage seam. tsc never emits .mjs, so before
 * GLUE-6 both lived ONLY outside `packages/runtime/dist` while the published
 * face of the runtime package is `files: ["dist"]` — a strict unfolding of
 * that face booted `ERR_MODULE_NOT_FOUND …/src/plugin/upstream-resolver.mjs`
 * (evidence alpha5/install-entry run 2026-10-17T17-06-56Z, RED-A). The fix
 * places both byte-identically INSIDE the mirror
 * (`scripts/place-dist-glue.mjs` PLACEMENTS — the drift gate compares src vs
 * dist) and makes the entry prefer the in-mirror specifier. This leg pins:
 * the mirror carries both files byte-for-byte, and the entry's FIRST
 * candidate for each is a path inside the mirror that EXISTS on disk.
 *
 * LEG B — the render contract (RED-②). The host declares
 * `output.render(args, value): ContentBlock[]` and uses the return value AS
 * the tool result's model-facing content; the plane's assembly-side face
 * returned `String(value?.text)`, so the host threw
 * `content.some is not a function` while assembling ANY live trio result.
 * This leg pins the contract shape on the shipped module for BOTH lanes of
 * the lane's closed `{ text }` envelope (computed refusal, presented result).
 *
 * @module @dsh-agent-team/runtime/test/a5g6-install-face-render
 */

import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import * as host from '../src/plugin/host.js'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/** The runtime package's published face: everything the manifest ships. */
const DIST_ROOT = join(REPO_ROOT, 'packages', 'runtime', 'dist')

/** The shipped production entry (the file a mounted row imports). */
const DIST_ENTRY = join(DIST_ROOT, 'packages', 'runtime', 'src', 'plugin', 'host.js')

const sha256 = (path: string): string =>
  createHash('sha256').update(readFileSync(path)).digest('hex')

/**
 * The entry's runtime .mjs dependencies that tsc cannot emit: source file →
 * its required position INSIDE the published face. Kept explicit (not read
 * from PLACEMENTS) so this leg stays a statement about the INSTALL FACE: if
 * the placement list and the shipped bytes ever disagree, both this leg and
 * the `check:artifacts` drift gate go red, and this one names the file.
 */
const RUNTIME_DEPENDENCY_MIRRORS: readonly { readonly src: string, readonly dist: string }[] = [
  {
    src: 'packages/runtime/src/plugin/upstream-resolver.mjs',
    dist: 'packages/runtime/dist/packages/runtime/src/plugin/upstream-resolver.mjs',
  },
  {
    src: 'packages/runtime/root-binding/harness/seam.mjs',
    dist: 'packages/runtime/dist/packages/runtime/root-binding/harness/seam.mjs',
  },
]

describe('GLUE-6 LEG A — the shipped install face carries its own runtime .mjs', () => {
  it('every runtime .mjs dependency is present INSIDE the published dist face', () => {
    for (const { dist } of RUNTIME_DEPENDENCY_MIRRORS) {
      expect(existsSync(join(REPO_ROOT, dist)), `missing in the install face: ${dist}`).toBe(true)
    }
  })

  it('each mirror is BYTE-IDENTICAL to its tracked source (placement law)', () => {
    for (const { src, dist } of RUNTIME_DEPENDENCY_MIRRORS) {
      const srcPath = join(REPO_ROOT, src)
      const distPath = join(REPO_ROOT, dist)
      expect(sha256(distPath), `placement drift: ${dist} != ${src}`).toBe(sha256(srcPath))
    }
  })

  it('the entry resolves its storage seam INSIDE the face (candidate 0, on disk)', () => {
    // A real-tree assertion (pbf-default-artifact-urls pins the pure
    // derivation): candidate 0 of the SHIPPED entry's own module URL must be
    // a file that exists and lies under the published `dist` face — the
    // surface a strict `files: ["dist"]` unfolding contains.
    const entryUrl = pathToFileURL(DIST_ENTRY).href
    const first = host.defaultSeamUrlCandidates(entryUrl)[0] as string
    const seamPath = fileURLToPath(first)
    expect(existsSync(seamPath), `candidate 0 does not exist: ${first}`).toBe(true)
    expect(seamPath.startsWith(DIST_ROOT + '/'), `candidate 0 escapes the face: ${first}`).toBe(true)
  })

  it('the entry registers the resolve hook from a file it SHIPS', () => {
    // `registerUpstreamResolverOnce` picks the first candidate that EXISTS
    // (`module.register` is lazy, so existence — not "did the call throw" —
    // is what decides; see the RED-A note in host.ts). For the shipped entry
    // that candidate is the co-located mirror copy.
    const hookPath = join(DIST_ROOT, 'packages', 'runtime', 'src', 'plugin', 'upstream-resolver.mjs')
    expect(existsSync(hookPath)).toBe(true)
    expect(dirname(hookPath)).toBe(dirname(DIST_ENTRY))
    // The shipped hook is world-agnostic: it recognizes BOTH layouts it can
    // be loaded from, so the mirror copy derives the same repository
    // candidates as the source copy instead of silently deadening the
    // fallback for the shipped layout.
    const shipped = readFileSync(hookPath, 'utf8')
    expect(shipped).toContain("'packages/runtime/dist/packages/runtime/src/plugin/upstream-resolver.mjs'")
    expect(shipped).toContain("'packages/runtime/src/plugin/upstream-resolver.mjs'")
  })
})

// ROUND 72 (2026-11-22): GLUE-6 LEG B graded the SHIPPED PLANE's render arms
// (`createTeamToolPlaneAssembly` → four definitions rendering ContentBlock[]). That module was retired by
// the UTE A0/A1 cut (1617d5839) and the centre assembles the team tool surface instead, so the arm has no
// subject on this tree. LEG A above (the upstream-resolver face and its dist placement) is untouched and
// still graded. Re-anchoring the render law on the centre's assembly is a design task: the centre does not
// expose a `definitions` surface, it admits calls through `admit()`.
