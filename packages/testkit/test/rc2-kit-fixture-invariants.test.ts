/**
 * rc2-kit-fixture-invariants.test.ts — the rc2 kit's fixture pre-flight, and
 * the guarantee the reviewer asked for: an invalid fixture is refused BEFORE any
 * B/C blueprint exists and BEFORE any B/C host call.
 *
 * THE DEFECT (independent review of PR #62, 2026-10-03). The kit's L0c
 * criterion checked "no team tool may fall into `builtinToolDeny`", recorded a
 * FAIL — and then kept going: it wrote `rc2-b.yaml` / `rc2-c.yaml` with the bad
 * deny list and issued the B/C `team.create` calls anyway. Three more host calls
 * against a fixture already known to be invalid, and the real cause
 * (`tools.restrict()` refusing an unknown global-tool name) was buried under the
 * downstream leg failures the comment claimed to prevent.
 *
 * The pre-flight now lives in `tests/kits/rc2-real-host-smoke/fixture-invariants.mjs`
 * and materialization happens INSIDE it, after the invariants, so "check then
 * continue" cannot be re-introduced by editing a call site. These tests pin:
 *
 *   I1  the kit's catalog equals the plugin's real team-tool namespace — read
 *       from `packages/tools/src/tools.ts`, including the verb-built permission
 *       pair that a `name: 'team_*'` grep misses (the drift detector: a new team
 *       tool that skips this constant now fails a unit test instead of poisoning
 *       a blueprint);
 *   I2  the exact historical drift (the 11-name catalog against today's surface)
 *       is detected and names exactly the four tools;
 *   I3  a healthy derivation materializes both blueprints and yields a deny list
 *       of non-team, non-managed names only;
 *   I4  a stale catalog writes ZERO blueprints — the materialization spy is never
 *       called, and the on-violations hook (the kit's abort path) runs first;
 *   I5  an unknown name in the leader `teamTools` allow lane is refused too
 *       (`selectTeamTools` would otherwise drop it silently);
 *   I6  the kit source keeps the ordering that makes I4 true (a source-shape
 *       guard, clearly labelled as such: it is not a behaviour proxy).
 *
 * RUNNER CONSTRAINTS: synchronous bodies, shim-safe matchers.
 *
 * @module @dsh-agent-team/testkit/test/rc2-kit-fixture-invariants
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  FixtureInvariantError,
  TEAM_TOOL_CATALOG,
  deriveBuiltinToolDeny,
  findFixtureViolations,
  materializeBcFixtures,
} from '../../../tests/kits/rc2-real-host-smoke/fixture-invariants.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../..')
const TOOLS_SRC = join(REPO, 'packages/tools/src/tools.ts')
const KIT_SRC = join(REPO, 'tests/kits/rc2-real-host-smoke/rc2-real-host-smoke.mjs')

/** The plugin's real team-tool namespace, straight from the registration site. */
function catalogFromSource(): string[] {
  const src = readFileSync(TOOLS_SRC, 'utf8')
  const statics: string[] = []
  for (const m of src.matchAll(/^\s*name:\s*'(team_[A-Za-z0-9_]+)'/gm)) {
    if (typeof m[1] === 'string') statics.push(m[1])
  }
  // The permission pair is built from a verb at tools.ts:1316 — no `name:` literal.
  const pair: string[] = []
  for (const m of src.matchAll(/\?\s*'(team_[A-Za-z0-9_]+)'\s*:\s*'(team_[A-Za-z0-9_]+)'/g)) {
    if (typeof m[1] === 'string') pair.push(m[1])
    if (typeof m[2] === 'string') pair.push(m[2])
  }
  return [...new Set([...statics, ...pair])].sort()
}

/** A live discovery surface: 5 preset tools + todo_write + the team namespace. */
const LIVE_SURFACE = [
  'bash',
  'edit',
  'read',
  'read_image',
  'write',
  'todo_write',
  // A builtin the kit neither manages nor whitelists: THIS is what belongs in
  // `builtinToolDeny` (the archived green evidence shows `denyList: []` because
  // that generation's preset surface carried nothing else).
  'web_search',
  ...TEAM_TOOL_CATALOG,
].sort()

// The kit's own constants (mirrored here on purpose: importing the kit module
// would boot the kit). I6 checks the two literals still occur in the kit source.
const MANAGED = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
const SAFE_UNMANAGED = ['todo_write']
const LEADER_ALLOW = ['team_list_members', 'team_list_templates', 'team_inspect_config', 'team_create_member', 'team_delegate', 'team_collect']

/** The catalog as it stood at the base commit — 11 names, four tools missing. */
const STALE_CATALOG = TEAM_TOOL_CATALOG.filter(
  (n) => !['team_list_pending_control', 'team_archive_member', 'team_grant_permission', 'team_revoke_permission'].includes(n),
)

interface Spy {
  writes: string[]
  calls: string[]
}

function spies(): Spy & { writeBlueprint: (name: string, yaml: string) => void; renderBlueprint: (name: string, args: { denyList: string[] }) => string } {
  const spy: Spy = { writes: [], calls: [] }
  return {
    ...spy,
    writeBlueprint: (name: string) => {
      spy.writes.push(name)
    },
    renderBlueprint: (name: string, args: { denyList: string[] }) => {
      spy.calls.push(name)
      return `id: ${name}\nbuiltinToolDeny: [${args.denyList.join(', ')}]\n`
    },
  }
}

describe('rc2 kit fixture pre-flight — an invalid fixture never reaches the host', () => {
  it('I1 the kit catalog is the plugin catalog, including the verb-built pair', () => {
    const real = catalogFromSource()
    expect([...TEAM_TOOL_CATALOG].sort()).toEqual(real)
    expect(TEAM_TOOL_CATALOG.length).toBe(15)
    // The pair a `name: 'team_*'` grep loses — pinned explicitly.
    expect(TEAM_TOOL_CATALOG).toContain('team_grant_permission')
    expect(TEAM_TOOL_CATALOG).toContain('team_revoke_permission')
    expect(new Set(TEAM_TOOL_CATALOG).size).toBe(TEAM_TOOL_CATALOG.length)
  })

  it('I2 the historical 11-name drift is detected and names exactly four tools', () => {
    expect(STALE_CATALOG.length).toBe(11)
    const deny = deriveBuiltinToolDeny({ surface: LIVE_SURFACE, managed: MANAGED, safeUnmanaged: SAFE_UNMANAGED, teamCatalog: STALE_CATALOG })
    const violations = findFixtureViolations({ denyList: deny, teamCatalog: STALE_CATALOG, leaderTeamTools: LEADER_ALLOW, managed: MANAGED })
    expect(violations.length).toBe(1)
    const first = violations[0]
    if (first === undefined) throw new Error('pre-flight reported no violation')
    expect(first.code).toBe('stale-team-catalog')
    expect([...first.names].sort()).toEqual(
      ['team_archive_member', 'team_grant_permission', 'team_list_pending_control', 'team_revoke_permission'].sort(),
    )
    // The healthy catalog shows the same surface is clean: the difference IS
    // the constant, which is why this is fixture debt and not a host behavior.
    const okDeny = deriveBuiltinToolDeny({ surface: LIVE_SURFACE, managed: MANAGED, safeUnmanaged: SAFE_UNMANAGED })
    expect(findFixtureViolations({ denyList: okDeny, teamCatalog: TEAM_TOOL_CATALOG, leaderTeamTools: LEADER_ALLOW, managed: MANAGED })).toEqual([])
  })

  it('I3 a healthy pre-flight materializes both blueprints with a clean deny list', () => {
    const s = spies()
    const out = materializeBcFixtures({
      surface: LIVE_SURFACE,
      managed: MANAGED,
      safeUnmanaged: SAFE_UNMANAGED,
      leaderTeamTools: LEADER_ALLOW,
      blueprints: {
        'rc2-b.yaml': { bpId: 'bp-b', leaderPersona: 'L', workerPersona: 'W' },
        'rc2-c.yaml': { bpId: 'bp-c', leaderPersona: 'L', workerPersona: 'W' },
      },
      writeBlueprint: s.writeBlueprint,
      renderBlueprint: s.renderBlueprint,
    })
    expect(s.writes).toEqual(['rc2-b.yaml', 'rc2-c.yaml'])
    expect(out.violations).toEqual([])
    // Only genuinely non-team, non-managed names survive the subtraction:
    // managed tools and the explicit safe-unmanaged whitelist are kept, so the
    // deny lane holds the one builtin the kit takes no position on.
    expect(out.denyList).toEqual(['web_search'])
    expect(out.denyList.some((n) => n.startsWith('team_'))).toBe(false)
  })

  it('I4 a stale catalog writes ZERO blueprints and the abort hook runs first', () => {
    const s = spies()
    const order: string[] = []
    let caught: unknown = null
    try {
      materializeBcFixtures({
        surface: LIVE_SURFACE,
        managed: MANAGED,
        safeUnmanaged: SAFE_UNMANAGED,
        teamCatalog: STALE_CATALOG,
        leaderTeamTools: LEADER_ALLOW,
        blueprints: {
          'rc2-b.yaml': { bpId: 'bp-b', leaderPersona: 'L', workerPersona: 'W' },
          'rc2-c.yaml': { bpId: 'bp-c', leaderPersona: 'L', workerPersona: 'W' },
        },
        onViolations: (violations) => {
          order.push(`onViolations:${violations.length}`)
          // The kit's hook aborts through the owner's cleanup; a throwing hook
          // must not be able to downgrade the refusal.
          throw new Error('RunAborted(simulated owner abort)')
        },
        writeBlueprint: (name: string, yaml: string) => {
          order.push(`write:${name}`)
          s.writeBlueprint(name, yaml)
        },
        renderBlueprint: s.renderBlueprint,
      })
    } catch (err) {
      caught = err
    }
    // The refusal is loud and typed…
    expect(caught instanceof Error).toBe(true)
    // …and NOTHING was materialized: no blueprint, no render, no host call
    // reachable (the caller only reaches team.create through a return value).
    expect(s.writes).toEqual([])
    expect(s.calls).toEqual([])
    expect(order).toEqual(['onViolations:1'])
  })

  it('I4b the typed error survives even when the hook declines to throw', () => {
    let caught: unknown = null
    try {
      materializeBcFixtures({
        surface: LIVE_SURFACE,
        managed: MANAGED,
        safeUnmanaged: SAFE_UNMANAGED,
        teamCatalog: STALE_CATALOG,
        leaderTeamTools: LEADER_ALLOW,
        blueprints: { 'rc2-b.yaml': { bpId: 'bp-b', leaderPersona: 'L', workerPersona: 'W' } },
        onViolations: () => {},
        writeBlueprint: () => {
          throw new Error('write must not be reached')
        },
        renderBlueprint: () => 'x',
      })
    } catch (err) {
      caught = err
    }
    expect(caught instanceof FixtureInvariantError).toBe(true)
    expect((caught as { exitCode?: number }).exitCode).toBe(2)
  })

  it('I5 an unknown leader team-tool name is refused (silent drop is the failure)', () => {
    const violations = findFixtureViolations({
      denyList: [],
      teamCatalog: TEAM_TOOL_CATALOG,
      leaderTeamTools: [...LEADER_ALLOW, 'team_teleport_member'],
      managed: MANAGED,
    })
    expect(violations.length).toBe(1)
    const first = violations[0]
    if (first === undefined) throw new Error('pre-flight reported no violation')
    expect(first.code).toBe('unknown-team-tool')
    expect(first.names).toEqual(['team_teleport_member'])
  })

  it('I6 the kit source keeps the pre-flight ahead of materialization and cleanup over exit', () => {
    const src = readFileSync(KIT_SRC, 'utf8')
    // I6a — the kit still routes B/C through the ordered pre-flight…
    const materializeAt = src.indexOf('materializeBcFixtures({')
    const createAt = src.indexOf('team.create(')
    expect(materializeAt).toBeGreaterThan(-1)
    expect(createAt).toBeGreaterThan(-1)
    // …BEFORE the first B/C host call, and there is no loose write of the B/C
    // blueprints left outside it.
    expect(materializeAt).toBeLessThan(createAt)
    expect(src.includes("writeFileSync(join(BLUEPRINT_DIR, 'rc2-b.yaml')")).toBe(false)
    // I6b — its violation hook aborts (owner cleanup) instead of continuing.
    const hook = src.slice(src.indexOf('onViolations: (violations'), src.indexOf('onViolations: (violations') + 1_600)
    expect(hook.includes('RC.abort(')).toBe(true)
    // I6c — a fatal inside the ARMED region throws so the owner's finally runs
    // (stop host child + close mock); the `process.exit` fallback survives only
    // for the pre-arm case, where nothing has been spawned yet to clean up.
    const dieFatalRaw = src.slice(src.indexOf('function dieFatal'), src.indexOf('function makeDecide'))
    // Strip comments first: the explanatory comment MENTIONS `process.exit()`,
    // and an index test over prose would report the wrong order.
    const dieFatal = dieFatalRaw
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('//'))
      .join('\n')
    const armedAt = dieFatal.indexOf('RC.armed()')
    const throwAt = dieFatal.indexOf('throw new RunAborted')
    const exitAt = dieFatal.indexOf('process.exit')
    expect(armedAt).toBeGreaterThan(-1)
    expect(throwAt).toBeGreaterThan(-1)
    expect(exitAt).toBeGreaterThan(-1)
    // The armed throw is the FIRST thing the fatal does; exit is the fallback.
    expect(throwAt).toBeLessThan(exitAt)
    // I6d — the kit's own constants that I2/I3 mirror.
    expect(src.includes("const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']")).toBe(true)
    expect(src.includes("import { TEAM_TOOL_CATALOG, deriveBuiltinToolDeny, materializeBcFixtures } from './fixture-invariants.mjs'")).toBe(true)
  })
})
