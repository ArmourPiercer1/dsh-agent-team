/**
 * A4 (fix/a4-check-artifacts-nonempty): `pnpm check:artifacts` must not be able
 * to report success when it compared NOTHING.
 *
 * The finding (reproduced independently by a reviewer and reported again by a
 * second lane): a run whose produced set is empty printed `OK: 0 files` and
 * exited 0. The reported repro is a `git archive` export nested inside a
 * checkout: the parent repo's `.tmp-*` / export-path ignore rule made every
 * artifact read as ignored, `produced` collapsed to zero, `tracked` (an index
 * query over the SAME pathspecs) was zero too, and A/B/C/D all compared empty
 * against empty. Leg `world-empty` below rebuilds that exact world — a
 * directory under `packages/testkit/test/.tmp-fault/` (gitignored at
 * `.gitignore:51`, so the collapse mechanism is the real one, not a mock),
 * with one file placed in every install surface so the disk walk succeeds.
 *
 * Scope discipline: this spec asserts ONLY the non-emptiness guard and that
 * the existing comparison semantics are untouched (a matching one-file set
 * still passes; a drifted file still prints the existing `C content-drift
 * (git add)` line). The stage-order artefacts of `git add` are not build
 * failures and are not touched.
 *
 * Test-world discipline (both traps this phase already met):
 * - G1: every world is CREATED here (rmSync + mkdirSync), never inherited
 *   from residue; the suite passes with the scratch directory absent.
 * - No knobs: the checker is driven as a child process at its real path with
 *   only `cwd` varied. There is deliberately NO environment switch that can
 *   shrink or expand the produced set — a knob that can shrink a set is a
 *   knob that can empty one. Git purity uses git's own config isolation
 *   (GIT_CONFIG_GLOBAL/SYSTEM, no global ignore rules bleeding into the
 *   inner repo), not a checker-side seam.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { INSTALL_SURFACES } from '../../../scripts/client-composition-surface.mjs'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const CHECKER = join(REPO_ROOT, 'scripts/check-artifacts-committed.mjs')

/**
 * `place-dist-glue.mjs` carries no type surface and adding one would leave
 * this lane's ownership — so the placements are loaded the settled way for
 * untyped scripts: the child process imports the module, exactly as the
 * checker itself does (one home; a new placement joins these worlds and the
 * gates without an edit here).
 */
function loadPlacements(): Array<{ src: string; dist: string }> {
  const url = pathToFileURL(join(REPO_ROOT, 'scripts/place-dist-glue.mjs')).href
  const out = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', `const m = await import(${JSON.stringify(url)}); console.log(JSON.stringify(m.PLACEMENTS))`],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  )
  return JSON.parse(out) as Array<{ src: string; dist: string }>
}
const PLACEMENTS = loadPlacements()
const SCRATCH = join(REPO_ROOT, 'packages/testkit/test/.tmp-fault/a4-artifacts-nonempty')

/** git's own config isolation — the inner test repo sees no global/system
 * ignore rules; nothing checker-side is involved. */
const GIT_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_ALLOW_PROTOCOL: 'never',
}

function makeWorld(name: string): string {
  const root = join(SCRATCH, name)
  rmSync(root, { recursive: true, force: true })
  mkdirSync(root, { recursive: true })
  return root
}

function worldFile(root: string, rel: string, content: string): void {
  const file = join(root, rel)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, content)
}

function gitIn(root: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', env: GIT_ENV })
}

function runChecker(cwd: string): { out: string; status: number } {
  const r = spawnSync(process.execPath, [CHECKER], {
    cwd,
    encoding: 'utf8',
    env: GIT_ENV,
  })
  return { out: r.stdout + r.stderr, status: r.status ?? -1 }
}

/** A world that IS its own git repo, with the PLACEMENTS glue pair staged
 * byte-identical: exactly ONE produced file (the dist mirror, the first
 * surface), matching its staged blob, no placement drift. */
function makeMatchingRepo(name: string): string {
  const root = makeWorld(name)
  for (const surface of INSTALL_SURFACES) mkdirSync(join(root, surface), { recursive: true })
  for (const { src, dist } of PLACEMENTS) {
    worldFile(root, src, 'export const glue = 1\n')
    worldFile(root, dist, 'export const glue = 1\n')
  }
  gitIn(root, 'init', '-q', '.')
  gitIn(root, 'add', '-A')
  // world self-check: the inner repo must NOT read its own artifacts as
  // ignored (if a global ignore rule ever reaches this world, fail HERE,
  // visibly, instead of testing an empty set by accident).
  const ignored = gitIn(
    root, 'ls-files', '--ignored', '--exclude-standard', '-o', '--', ...INSTALL_SURFACES,
  ).trim()
  expect(ignored, 'test world is contaminated by ignore rules').toBe('')
  return root
}

describe('check:artifacts cannot report success over an empty produced set', () => {
  it('the reported world: artifacts ignored away -> non-zero, names the produced-set count and all three ways', () => {
    // The exact failure world: nested inside this checkout under the
    // gitignored .tmp-fault path, one real file per install surface, and NO
    // git repo of its own — so `git ls-files --ignored` (run against the
    // OUTER repo, pathspecs resolved from cwd) marks every artifact ignored
    // and the index query returns nothing. produced = 0 of N.
    const root = makeWorld('ignored-collapse')
    for (const [i, surface] of INSTALL_SURFACES.entries()) {
      worldFile(root, `${surface}/f${String(i)}.js`, 'x\n')
    }
    // The glue pair byte-identical, exactly as in the reported export (the
    // committed mirror matched its src, so arm D was silent — which is what
    // let the run reach the all-empty A/B/C comparison and print OK over
    // nothing). Without this the unfixed checker exits 1 on D by accident
    // and the leg would pass for the wrong reason — caught by the mutation
    // replay, recorded in the commit.
    for (const { src, dist } of PLACEMENTS) {
      worldFile(root, src, 'export const glue = 1\n')
      worldFile(root, dist, 'export const glue = 1\n')
    }
    const producedCount = INSTALL_SURFACES.length + PLACEMENTS.length
    const r = runChecker(root)
    expect(r.out, 'the old false green must never print again').not.toMatch(/OK: 0 files/)
    expect(r.status, `must not exit 0 over nothing: ${r.out}`).not.toBe(0)
    // names the produced-set count...
    expect(r.out).toMatch(new RegExp(`0 of ${String(producedCount)}`))
    // ...and the three real ways to get there:
    expect(r.out).toMatch(/top-?level/i) // cwd not at the toplevel
    expect(r.out).toMatch(/ignor/i) // artifacts ignored away
    expect(r.out).toMatch(/emitt?ed? nothing|emits nothing|emitted nothing|emitting nothing|no output|nothing/i) // build emitted nothing
    // And on the machine-readable channel the same refusal, not a prose-only one: the
    // verdict token is what `a4p7-merge-gate` grades, so this world pins the token too.
    expect(r.out).toMatch(/DSH-ARTIFACT-VERDICT script=check-artifacts-committed subject=index verdict=refused reason=empty-produced-set/)
  })

  it('a produced set of one matching file still passes exactly as before', () => {
    const root = makeMatchingRepo('one-matching-file')
    const r = runChecker(root)
    expect(r.out, r.out).toContain(`OK: 1 file`)
    expect(r.out, 'the OK a consumer reads is the token, and it names its subject').toContain(
      'DSH-ARTIFACT-VERDICT script=check-artifacts-committed subject=index verdict=ok compared=1',
    )
    expect(r.status, r.out).toBe(0)
  })

  it('a genuinely drifted file still prints the existing content-drift message (semantics untouched)', () => {
    const root = makeMatchingRepo('one-drifted-file')
    const dist = PLACEMENTS[0]?.dist
    expect(dist).toBeTruthy()
    worldFile(root, dist ?? '', 'export const glue = 2 // drifted, not re-staged\n')
    const r = runChecker(root)
    expect(r.status, r.out).toBe(1)
    expect(r.out).toMatch(/C content-drift \(git add\)/)
    expect(r.out).toContain(dist ?? '')
    // `drift=1 sites=2`, and that is not a slip: this world's single file is BOTH `C
    // content-drift` (its bytes differ from the index) and `D glue placement drift` (its
    // mirror no longer equals its src). Distinct paths vs reported arm lines are different
    // facts, so the token carries both. This expectation was written as `drift=1` from a
    // guess and the instrument corrected it — the two-count split is what the correction
    // produced, not a reconciliation of the failure.
    expect(r.out).toMatch(/DSH-ARTIFACT-VERDICT script=check-artifacts-committed subject=index verdict=stale compared=\d+ drift=1 sites=2/)
  })

  it('a missing install-surface directory keeps its existing ERROR (walk failure is not the new guard)', () => {
    const root = makeWorld('missing-surface')
    mkdirSync(join(root, INSTALL_SURFACES[0] ?? 'packages/runtime/dist'), { recursive: true })
    const r = runChecker(root)
    expect(r.status).not.toBe(0)
    expect(r.out).toMatch(/ERROR: .* missing .* build/)
    expect(r.out).toMatch(/DSH-ARTIFACT-VERDICT script=check-artifacts-committed subject=index verdict=refused reason=surface-missing/)
  })
})
