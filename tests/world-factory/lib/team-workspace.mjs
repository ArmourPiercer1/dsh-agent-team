/**
 * team-workspace.mjs — the World's Team workspace: what a Team session's
 * `header.cwd` is, and therefore what a Member's `bash` child is confined to.
 *
 * WHY THIS EXISTS (PD-14, PRODUCT-DEBT-REGISTER — measured 2026-11-06 in
 * `dev/agent-workflow/evidence/a5sf-sub-devlive/README.md` §5, corroborated by
 * the Shell-PTY lane, and REFUSED as a product fix: the shipped row contract
 * already names this knob, `cordis.patch.yml` lines 10-24).
 *
 * The chain, each link measured or read from the pinned tree:
 *
 *   1. the Host process is launched with `cwd = <pinned host checkout>`
 *      (`tests/characterization/lib/instance.mjs` — the CLI entry is a
 *      relative path, so the launch directory has always been the runtime
 *      tree);
 *   2. the product derives the Team's effective workspace from the launch
 *      directory when the row carries none:
 *      `withDefaultWorkspace(config, launchCwd)` → `config.defaultWorkspace`
 *      (`packages/runtime/src/plugin/host.ts`, documented in the root
 *      `cordis.patch.yml` as the operator's launch directory);
 *   3. the glue gives every Member session that value as its `meta.cwd`
 *      (`packages/runtime/src/plugin/live/agent-bindings.mjs` §T12-M1 —
 *      `request.workspace ?? config.defaultWorkspace`), i.e. it becomes
 *      `session.header.cwd`;
 *   4. the pinned sandbox policy resolves the per-call root as
 *      `session.header.cwd ?? config.workspaceRoot`
 *      (`tests/deepseek-harness-test-use/packages/sandbox/sandbox-policy/src/index.ts`,
 *      the `resolve()` body);
 *   5. the Linux backend mounts that root read-write for the child:
 *      `bwrap … --bind <root> <root>` (`@deepseek-ai/dsh-sandbox-local`,
 *      `bwrapProfileArgs`).
 *
 * A World that declares no Team workspace therefore gets link 1's answer — the
 * pinned host checkout — at link 5: a Member's `bash` child is genuinely
 * read-write on a shared, never-deleted tree, while the World's own
 * `expectedWorkspaceRoot` (`<home>/workspace`) is what the World's record
 * claims. That is PD-14.
 *
 * THE FIX LAYER, and why it is this one. The World already knows its workspace
 * (`TestWorld.workspaceDir = <home>/workspace`), and the product already
 * documents how a composition overrides it (the profile's own
 * `cordis.patch.yml` row with the same `id` and a `config` replaces the bundle
 * layer's config — `cordis.patch.yml` line 19-24: "use that to … set
 * `defaultWorkspace`"). One World already did this by hand
 * (`u6-arc-d-assembly.mjs#teamRowConfig`, whose test asserts "native edit must
 * run in the World workspace, not the Host launch tree"); twelve others did
 * not. So the defect is a **test-fixture omission**, not a product default:
 * for a real operator, link 1 IS the workspace they launched from, and the
 * launch-directory default is the documented answer (changing it would alter
 * what real users get, justified by nothing PD-14 measured). This module makes
 * the fixture side a LAW at the one place every World passes through
 * (`TestWorld.startHost`), instead of a key each assembly may forget.
 *
 * WHAT THIS MODULE DOES NOT DO. It does not touch the pinned tree, does not
 * read or write anything (pure), does not decide the sandbox root (the pinned
 * product does, at link 4), and does not accept "the host checkout" as a
 * workspace: that value is REFUSED, so the defect cannot be re-created by a
 * World that means well.
 */

import { isAbsolute, relative, resolve, sep } from 'node:path'

/** Typed refusals: a World that cannot honestly declare its Team workspace. */
export const TEAM_WORKSPACE_ERRORS = Object.freeze({
  OUTSIDE_WORLD: 'TEAM_WORKSPACE_OUTSIDE_WORLD',
  ON_HOST_TREE: 'TEAM_WORKSPACE_ON_HOST_TREE',
  NOT_ABSOLUTE: 'TEAM_WORKSPACE_NOT_ABSOLUTE',
})

export class TeamWorkspaceError extends Error {
  /**
   * @param {string} code one of `TEAM_WORKSPACE_ERRORS`
   * @param {string} detail human sentence (carries the offending path)
   */
  constructor(code, detail) {
    super(`team-workspace: ${code}: ${detail}`)
    this.name = 'TeamWorkspaceError'
    this.code = code
    this.detail = detail
  }
}

/** True when `child` is `parent` itself or sits underneath it. */
function contains(parent, child) {
  const rel = relative(parent, child)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

/**
 * The Team row shape a World composes: a plugin row whose `config` is a Team
 * row (the shipped row's config keys — `rootSessionId` + a blueprint source —
 * are the two every assembly sets and no other row does).
 *
 * Deliberately shape-based rather than id-based: the shipped row id is
 * `dsh-agent-team` (root `cordis.patch.yml`), but a World may mount the same
 * product entry under a probe id; the question this predicate answers is "will
 * this row boot the Team runtime", not "what is it called".
 *
 * @param {{ id?: unknown, config?: unknown }} row
 * @returns {boolean}
 */
export function isTeamRow(row) {
  if (row === null || typeof row !== 'object') return false
  const config = row.config
  if (config === null || typeof config !== 'object') return false
  return typeof config.rootSessionId === 'string' &&
    (typeof config.blueprintSource === 'string' || config.blueprintDir !== undefined)
}

/**
 * Bind every Team row in `rows` to the World's own workspace, or refuse.
 *
 * Pure: returns new row/config objects, never mutates the input (a World's
 * assembly may keep its `teamRowConfig()` snapshot for its own assertions).
 *
 * Rules, in order:
 *   1. a Team row that ALREADY declares `defaultWorkspace` keeps it — the
 *      World's explicit declaration outranks this law, which is what makes it
 *      a default and not a hard-coded path (`u6-arc-d` relies on it). It is
 *      validated, not trusted: absolute, inside this World's home, and NOT
 *      inside the pinned host checkout.
 *   2. a Team row that declares none is bound to `workspaceDir`.
 *   3. a non-Team row (the canary, a probe row, a preset declaration) is
 *      returned untouched.
 *
 * @param {Array<{ id?: unknown, name?: unknown, config?: object }>} rows
 * @param {{ home: string, workspaceDir: string, hostTree: string }} world
 * @returns {{ rows: Array<object>, report: {
 *   worldWorkspace: string,
 *   bound: string[],
 *   declared: Array<{ id: string, defaultWorkspace: string }>,
 *   untouched: number,
 * } }}
 */
export function bindTeamDefaultWorkspace(rows, world) {
  if (!Array.isArray(rows)) {
    throw new TypeError('bindTeamDefaultWorkspace: rows must be an array')
  }
  const { home, workspaceDir, hostTree } = world ?? {}
  for (const [name, value] of [['home', home], ['workspaceDir', workspaceDir], ['hostTree', hostTree]]) {
    if (typeof value !== 'string' || value.trim() === '' || !isAbsolute(value)) {
      throw new TypeError(`bindTeamDefaultWorkspace: '${name}' must be an absolute path (got ${JSON.stringify(value)})`)
    }
  }
  const worldHome = resolve(home)
  const workspace = resolve(workspaceDir)
  const host = resolve(hostTree)
  if (!contains(worldHome, workspace)) {
    throw new TeamWorkspaceError(
      TEAM_WORKSPACE_ERRORS.OUTSIDE_WORLD,
      `this World's workspace ${JSON.stringify(workspace)} is not inside its owned home ${JSON.stringify(worldHome)}`,
    )
  }

  const report = { worldWorkspace: workspace, bound: [], declared: [], untouched: 0 }
  const out = rows.map((row) => {
    if (!isTeamRow(row)) {
      report.untouched += 1
      return row
    }
    const id = typeof row.id === 'string' ? row.id : '<unnamed-team-row>'
    const config = row.config
    if (config.defaultWorkspace === undefined) {
      report.bound.push(id)
      return { ...row, config: { ...config, defaultWorkspace: workspace } }
    }
    if (typeof config.defaultWorkspace !== 'string' || config.defaultWorkspace.trim() === '') {
      throw new TeamWorkspaceError(
        TEAM_WORKSPACE_ERRORS.NOT_ABSOLUTE,
        `Team row ${JSON.stringify(id)} declares a non-string/blank defaultWorkspace (${JSON.stringify(config.defaultWorkspace)})`,
      )
    }
    const declared = resolve(config.defaultWorkspace)
    if (!isAbsolute(config.defaultWorkspace)) {
      throw new TeamWorkspaceError(
        TEAM_WORKSPACE_ERRORS.NOT_ABSOLUTE,
        `Team row ${JSON.stringify(id)} declares a relative defaultWorkspace (${JSON.stringify(config.defaultWorkspace)}); the row is machine-read and the value must be absolute`,
      )
    }
    if (contains(host, declared)) {
      throw new TeamWorkspaceError(
        TEAM_WORKSPACE_ERRORS.ON_HOST_TREE,
        `Team row ${JSON.stringify(id)} declares defaultWorkspace ${JSON.stringify(declared)} INSIDE the pinned host checkout ${JSON.stringify(host)}; a Member's bash child would be read-write on a shared tree that is never deleted (PD-14)`,
      )
    }
    if (!contains(worldHome, declared)) {
      throw new TeamWorkspaceError(
        TEAM_WORKSPACE_ERRORS.OUTSIDE_WORLD,
        `Team row ${JSON.stringify(id)} declares defaultWorkspace ${JSON.stringify(declared)} outside this World's owned home ${JSON.stringify(worldHome)}; nothing outside the home is deleted at teardown`,
      )
    }
    report.declared.push({ id, defaultWorkspace: declared })
    return row
  })
  return { rows: out, report }
}
