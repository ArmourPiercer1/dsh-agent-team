/**
 * a4p7-blueprint-version-clean.test.ts — A4-PR7 Task 7.5: the fence is only a
 * fence because a test calls it.
 *
 * `scripts/verify-blueprint-version-clean.mjs` is the v3-only scan ADR A3-16
 * owns, and ADR A5-9 requires PR7's gate to invoke it BY NAME — the precedent it
 * cites is `verify-zero-core.mjs`, a script that exists and is invoked by
 * nothing. So this file's first job is to be the caller, and its second is to
 * make the scan's output reviewable rather than merely red.
 *
 * THE DEFERRAL LIST BELOW IS NOT AN EXEMPTION MECHANISM. It is the recorded,
 * per-path state of Task 7.4 (fixture migration, one file per lane): every entry
 * names the lane that owns the file and why it is still authoring a v1/v2
 * document at this commit. Two assertions keep it honest in both directions — a
 * NEW offending path fails the list, and a path that migrated but stayed on the
 * list fails too. The list shrinking to empty IS the cutover's fixture work being
 * done; nothing here makes the fence passable in advance.
 *
 * Why the scan walks `git ls-files` and never the filesystem or `rg`, and why it
 * reports "not run" instead of "clean" when it cannot read the tree, are both
 * documented in the script; the "not run is not clean" arm is asserted here, on
 * a directory that is not a git repository.
 */

import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import {
  scanBlueprintVersionSites,
  formatReport,
  versionSitesInText,
} from '../../../scripts/verify-blueprint-version-clean.mjs'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const SCRIPT = 'scripts/verify-blueprint-version-clean.mjs'

/**
 * Task 7.4's per-lane deferral set, generated from the scan and annotated by
 * hand with the owning lane from the plan's lane table (Task 7.4). A file leaves
 * this list by being migrated to a v3 document with an explicit
 * `teamHardEnvelope`, never by being added to a skip list in the scanner.
 */
const DEFERRALS: ReadonlyMap<string, string> = new Map([
  // Lane `C-tools+harness` — the plan names these four sites by path.
  ['packages/tools/harness/d4-restart-reopen.mjs', 'C-tools+harness (plan-named site, harness/d4-restart-reopen.mjs:220)'],
  ['packages/tools/harness/g5-member-e2e.mjs', 'C-tools+harness (plan-named site, harness/g5-member-e2e.mjs:267)'],
  ['packages/tools/harness/run.mjs', 'C-tools+harness (plan-named site, harness/run.mjs:214)'],
  ['packages/tools/harness/t12-vertical.mjs', 'C-tools+harness (plan-named site, harness/t12-vertical.mjs:215; also emits a v2 document)'],
  // Lane `C-runtime-fixtures` — the runtime bounded-run harness's Blueprint source.
  ['packages/runtime/root-binding/harness/blueprint-source.mjs', 'C-runtime-fixtures (bounded-run harness Blueprint source)'],
  // Lane `C-testkit` — the authoring script and the maintained kit fixtures.
  ['scripts/blueprint-authoring.mjs', 'C-testkit (the blueprint authoring script)'],
  ['tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs', 'C-testkit (kit fixture)'],
  ['tests/kits/exec-contract-live-smoke/blueprint.mjs', 'C-testkit (kit fixture)'],
  ['tests/kits/f15-mcp-live-loss-smoke/f15-mcp-live-loss-smoke.mjs', 'C-testkit (kit fixture; also emits a v2 document)'],
  ['tests/kits/mcp-initial-grant-smoke/mcp-initial-grant-smoke.mjs', 'C-testkit (kit fixture)'],
  ['tests/kits/model-preference-routing-smoke/model-preference-routing-smoke.mjs', 'C-testkit (kit fixture)'],
  ['tests/kits/pr-b-effective-policy-smoke/pr-b-effective-policy-smoke.mjs', 'C-testkit (kit fixture)'],
  ['tests/kits/pr-c-mcp-isolation-smoke/pr-c-mcp-isolation-smoke.mjs', 'C-testkit (kit fixture; also emits a v2 document)'],
  ['tests/kits/pr-d-control-real-host/pr-d-control-real-host.mjs', 'C-testkit (kit fixture)'],
  ['tests/kits/pr-e-requirement-recovery-smoke/pr-e-requirement-recovery-smoke.mjs', 'C-testkit (kit fixture; also carries the V1 anchor contentHash literal that 7.3 re-pins)'],
  ['tests/kits/pr-f-closure-smoke/pr-f-closure-smoke.mjs', 'C-testkit (kit fixture; also carries the V1 anchor contentHash literal that 7.3 re-pins)'],
  ['tests/kits/rc2-real-host-smoke/rc2-real-host-smoke.mjs', 'C-testkit (kit fixture)'],
  ['tests/kits/send-message-liveness-smoke/send-message-liveness-smoke.mjs', 'C-testkit (kit fixture)'],
  ['tests/kits/team-view-sync-complete-e2e/team-view-sync-complete-e2e.mjs', 'C-testkit (kit fixture)'],
  ['tests/kits/work-completion-wakeup-smoke/work-completion-wakeup-smoke.mjs', 'C-testkit (kit fixture)'],
])

const run = scanBlueprintVersionSites()
const report = formatReport(run)
const foundPaths = [...new Set(run.sites.map((site) => site.path))].sort()

describe('a4p7 blueprint document-version fence (Task 7.5)', () => {
  it('the scan ran (a scan that could not run is never reported as clean)', () => {
    expect(run.ran, `scan did not run: ${String(run.reason)}`).toBe(true)
    // A positive control for `ran`: the scope is non-trivial, so an empty tree
    // or a truncated `git ls-files` cannot pass as "nothing to check".
    expect(run.scopeFiles).toBeGreaterThan(100)
  })

  it('invoking the script by name is a real gate: non-zero exit while sites exist', () => {
    const spawned = spawnSync(process.execPath, [SCRIPT], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    })
    expect(spawned.status, spawned.stderr).toBe(run.sites.length > 0 ? 1 : 0)
    expect(spawned.stdout).toContain('RESULT ')
    expect(spawned.stdout).toContain(report.split('\n')[0])
  })

  it('a directory that is not a repository reports not-run with exit 2, never clean', () => {
    const spawned = spawnSync(process.execPath, [resolve(REPO_ROOT, SCRIPT)], {
      cwd: '/tmp',
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    })
    expect(spawned.stdout).toContain('RESULT not-run')
    expect(spawned.stdout).not.toContain('RESULT clean')
    expect(spawned.status).toBe(2)
  })

  it('the offending set is EXACTLY the recorded Task 7.4 deferral set (no new path)', () => {
    const unexpected = foundPaths.filter((p) => !DEFERRALS.has(p))
    expect(unexpected).toEqual([])
  })

  it('every deferred path is still offending (a migrated path must leave the list)', () => {
    const stale = [...DEFERRALS.keys()].filter((p) => !foundPaths.includes(p))
    expect(stale).toEqual([])
  })

  it('the fence needs no exemption for its own author', () => {
    // A scanner that exempts its own source is one line away from exempting
    // anything, so the fence's own script must not appear in its findings — it is
    // written so that its prose never spells the literal it hunts for. (When this
    // test fails because someone documented a version literal in the header, fix
    // the prose; do NOT add a self-exclusion.)
    expect(foundPaths).not.toContain('scripts/verify-blueprint-version-clean.mjs')
    expect(foundPaths.filter((p) => p.startsWith('scripts/verify-blueprint-version-clean'))).toEqual([])
  })

  it('the fence reports sites, not a bare count, and names a file the reader can open', () => {
    // The plan's X10 law: the contract is the path set, so the report must carry
    // paths and line numbers. `run.mjs` is a named Task 7.4 site — the positive
    // control that detection actually finds a known v1 author.
    expect(report).toContain('OFFENDING packages/tools/harness/run.mjs :: ')
    expect(report).toMatch(/OFFENDING \S+ :: L\d+=v[12]/)
    expect(report).toContain(`RESULT dirty(${String(foundPaths.length)} files`)
  })

  it('the predicate: a retired version counts, the supported version does not, prose does not', () => {
    const v1 = versionSitesInText('blueprintId: team.x\nschemaVersion: 1\n')
    expect(v1).toEqual([{ line: 2, version: 1 }])
    expect(versionSitesInText('blueprintId: team.x\nschemaVersion: 3\n')).toEqual([])
    // A file that does not key `blueprintId` is not a Blueprint-version site —
    // this is the half that keeps prose and unrelated documents out of the set.
    expect(versionSitesInText('schemaVersion: 1\nsomeOtherKey: 3\n')).toEqual([])
    // Line numbers must point at the offending line, not at line 1: a report a
    // reader cannot follow is a report nobody fixes.
    expect(
      versionSitesInText('blueprintId: team.x\n\n\nschemaVersion: 2\n')[0]?.line,
    ).toBe(4)
  })

  it('a real in-scope file that keys blueprintId WITHOUT a version literal is not a site', () => {
    // The other direction of the same predicate, measured on the tree rather
    // than on a sample: this kit file keys `blueprintId` and must be clean.
    const clean = 'tests/kits/exec-contract-live-smoke/exec-contract-live-smoke.mjs'
    expect(foundPaths).not.toContain(clean)
    expect(run.scopeFiles).toBeGreaterThan(foundPaths.length)
  })
})
