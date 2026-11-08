/**
 * profile-module-graph.mjs — THE INSTALL GRAPH EVERY WORLD GETS.
 *
 * WHY THIS EXISTS (PD-32, 2026-11-15). A Cordis preset row's specifier must
 * resolve in the composition's module graph. `@deepseek-ai/cordis-plugin-loader`
 * resolves EVERY row through ONE base —
 *
 *     loader.internal.import(name, this.ctx.baseUrl)
 *
 * — and `baseUrl` is the composition's (the profile's) directory, not the row's
 * depth. So a preset row may name a bundle subpath (`dsh-agent-team/web-tool`)
 * exactly like a profile row does, and the only question is whether the bundle
 * is INSTALLED in that graph.
 *
 * This repo's Worlds build `profiles/web/` from an empty directory, so nothing
 * was installed and the bare names had nothing to resolve against. The failure
 * is not "the module is missing": a row that cannot import is `never started`,
 * and the preset audit then refuses to construct the Agent AT ALL — every
 * confined face goes down with it (fs, shell, skill, present), not just the name
 * that failed. Two lanes paid for this separately (PD-27's driver hid it by
 * rewriting the row to a `file:` URL, i.e. measured a tree that was not the
 * shipped one), which is exactly how a green arm gets counted against a dead
 * preset.
 *
 * The fix belongs HERE, in the World factory, not in each driver: provision the
 * package the profile's rows name, the way an install would, and let every World
 * inherit it. It is TEST-ONLY — no product row, no product code, nothing that
 * changes what a real install looks like. The subject under test stays the
 * shipped bytes; only the graph around it is provisioned.
 *
 * WHAT IT DOES, GENERICALLY. It reads the repository's OWN `package.json`
 * `name` + `exports` and links `<repoRoot>` into
 * `<home>/profiles/<profile>/node_modules/<name>`. One link makes EVERY declared
 * subpath resolvable (Node walks the linked package's own `exports` map), so
 * this is not a hardcoded `./web-tool`: a lane that adds an export adds nothing
 * here. `verifyProfileModuleGraph()` then proves each declared subpath actually
 * resolves from a file inside the profile — the check runs at World creation, so
 * a graph that cannot serve the composition fails loudly at boot rather than
 * silently disabling tools.
 *
 * NEGATIVE CONTROL. `A5SF_WF_NO_INSTALL_GRAPH=1` skips provisioning (and
 * `A5SF_PD30_NO_INSTALL_GRAPH=1` is kept as the older alias the PD-30 driver
 * documents). That is how "the graph is what makes the shipped rows load" is
 * measured instead of assumed.
 */
import { existsSync, lstatSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'

/** Every refusal this module raises carries a stable, greppable code. */
export const PROFILE_GRAPH_CODES = Object.freeze({
  UNRESOLVED: 'A5SF_PROFILE_GRAPH_UNRESOLVED',
  PRESET_NEVER_STARTED: 'A5SF_PRESET_NEVER_STARTED',
  PRESET_NO_MEMBER: 'A5SF_PRESET_NO_MEMBER',
  PRESET_NO_SURFACE: 'A5SF_PRESET_NO_SURFACE',
})

/** The named error a dead preset raises — never a bare `Error`. */
export class ShippedPresetAuditError extends Error {
  /**
   * @param {string} code one of {@link PROFILE_GRAPH_CODES}.
   * @param {string} message the audit line, so a reader can see what failed.
   * @param {object} [details] the measured facts behind the refusal.
   */
  constructor(code, message, details = {}) {
    super(`${code}: ${message}`)
    this.name = 'ShippedPresetAuditError'
    this.code = code
    Object.assign(this, details)
  }
}

/** The package name + declared subpath exports of the tree under test. */
export function profilePackageOf(repoRoot) {
  const manifestPath = join(repoRoot, 'package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (typeof manifest?.name !== 'string' || manifest.name === '') {
    throw new Error(`profile-module-graph: ${manifestPath} declares no package name; the profile graph cannot be provisioned`)
  }
  const exportsField = manifest.exports
  const subpaths = exportsField === undefined
    ? []
    : typeof exportsField === 'string'
      ? ['.']
      : Object.keys(exportsField)
  return Object.freeze({ name: manifest.name, subpaths: Object.freeze(subpaths) })
}

/** Is the negative control requested? Both spellings are documented. */
export function installGraphDisabled(env = process.env) {
  return env.A5SF_WF_NO_INSTALL_GRAPH === '1' || env.A5SF_PD30_NO_INSTALL_GRAPH === '1'
}

/**
 * Provision the profile module graph for one World.
 *
 * @param {object} input
 * @param {string} input.home the World's DSH_HOME.
 * @param {string} input.repoRoot the tree under test (linked, never copied).
 * @param {string} [input.profile] profile directory name (default `web`).
 * @returns {{provisioned: boolean, reason?: string, profileModules: string, link: string|null, package: object}}
 */
export function provisionProfileModuleGraph({ home, repoRoot, profile = 'web' }) {
  // A unit-test fixture is sometimes a bare temporary directory (no manifest):
  // there is nothing to install and nothing that could resolve, so say so
  // instead of failing every offline World test.
  let pkg
  try {
    pkg = profilePackageOf(repoRoot)
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return Object.freeze({ provisioned: false, reason: `no package manifest at ${join(repoRoot, 'package.json')} — nothing to install`, profileModules: join(home, 'profiles', profile, 'node_modules'), link: null, package: null })
    }
    throw error
  }
  const profileModules = join(home, 'profiles', profile, 'node_modules')
  const link = join(profileModules, pkg.name)
  if (installGraphDisabled()) {
    return Object.freeze({ provisioned: false, reason: 'A5SF_WF_NO_INSTALL_GRAPH=1 (negative control)', profileModules, link: null, package: pkg })
  }
  mkdirSync(profileModules, { recursive: true })
  const existing = (() => { try { return lstatSync(link) } catch { return null } })()
  if (existing === null) {
    symlinkSync(resolve(repoRoot), link, process.platform === 'win32' ? 'junction' : 'dir')
  } else if (!existing.isSymbolicLink()) {
    throw new Error(`profile-module-graph: ${link} exists and is not a symlink; refusing to write over an installed package directory`)
  }
  return Object.freeze({ provisioned: true, profileModules, link, package: pkg })
}

/**
 * Prove every declared subpath resolves FROM the profile, not merely that the
 * symlink exists: a link to a tree whose `exports` map is stale (or a target
 * that does not exist) must fail here, at World creation, and name the subpath.
 *
 * @param {object} input
 * @param {string} input.home the World's DSH_HOME.
 * @param {string} input.repoRoot the tree under test.
 * @param {string} [input.profile] profile directory name (default `web`).
 * @returns {{package: string, resolved: Record<string, string>}}
 */
export function verifyProfileModuleGraph({ home, repoRoot, profile = 'web' }) {
  const pkg = profilePackageOf(repoRoot)
  const profileDir = join(home, 'profiles', profile)
  const require = createRequire(join(profileDir, 'noop.js'))
  const resolved = {}
  const failures = []
  for (const subpath of pkg.subpaths) {
    if (subpath === './package.json') {
      // Not a module: existence is the only meaningful answer.
      const target = join(repoRoot, 'package.json')
      if (!existsSync(target)) failures.push(`${subpath} -> ${target}`)
      resolved[subpath] = target
      continue
    }
    try {
      resolved[subpath] = require.resolve(subpath === '.' ? pkg.name : `${pkg.name}/${subpath.replace(/^\.\//u, '')}`)
    } catch (error) {
      failures.push(`${subpath} (${error?.code ?? 'resolve failed'})`)
    }
  }
  if (failures.length > 0) {
    throw new ShippedPresetAuditError(
      PROFILE_GRAPH_CODES.UNRESOLVED,
      `${pkg.name} does not resolve from ${profileDir}: ${failures.join(', ')}; a shipped row naming any of these would be `
        + '`never started`, which takes the whole Agent down rather than one tool (provision the graph, or run the negative control)',
      { profileDir, failures },
    )
  }
  return Object.freeze({ package: pkg.name, resolved })
}

/**
 * The preset audit, shared: "did every row of the shipped preset actually
 * import?" Read from the host's own log BEFORE any arm is judged, because a
 * dead preset produces no error at the arm level — it produces empty results
 * that look like green refusals.
 *
 * @param {string} hostLogText the host log (stdout+stderr) of this boot.
 * @returns {{neverStarted: boolean, lines: string[]}}
 */
export function presetAuditOf(hostLogText) {
  // TWO spellings, one meaning: the Agent's own preset audit says
  // `never started`, while a TOP-LEVEL row that cannot resolve is logged by the
  // composition as `failed to import`. Both mean "this row never mounted"; with
  // no graph at all the second fires first (the host row itself is a bundle
  // subpath), which is why a harness that only greps `never started` still
  // reports the useless symptom — "p6t6 never answered", "0 Members", "no goal".
  const lines = String(hostLogText ?? '')
    .split('\n')
    .filter((line) => /never started|failed to import/u.test(line))
  return Object.freeze({ neverStarted: lines.length > 0, lines: Object.freeze(lines) })
}

/**
 * Throw when the shipped preset did not mount. Named codes only: a caller (and
 * an evidence reader) must be able to tell `never started` from `no Member`
 * from `no surface`.
 *
 * @param {object} input
 * @param {string} input.hostLogText the boot's host log.
 * @param {Array<object>} [input.members] the Team's members after creation.
 * @param {string} [input.template] the template the arm needs.
 * @param {number} [input.surfaceCount] the model-visible tool count of that Member.
 * @param {number} [input.minSurface] the floor (default 1).
 * @returns {{neverStarted: boolean, members: number, surfaceCount: number|null}}
 */
export function assertShippedPresetMounted({ hostLogText, members = undefined, template = null, surfaceCount = null, minSurface = 1 }) {
  const audit = presetAuditOf(hostLogText)
  if (audit.neverStarted) {
    throw new ShippedPresetAuditError(
      PROFILE_GRAPH_CODES.PRESET_NEVER_STARTED,
      `a preset row is \`never started\` (its module did not import), so the Agent was never constructed and no arm below `
        + `can be evidence: ${audit.lines.join(' | ')}`,
      { neverStarted: true, lines: audit.lines },
    )
  }
  // `undefined` = this phase does not know the membership yet (the Team creates
  // its Member after boot); `[]` = it looked and found none, which is a dead
  // preset and must be refused.
  const checked = Array.isArray(members)
  const list = checked ? members : []
  if (checked && list.length === 0) {
    throw new ShippedPresetAuditError(
      PROFILE_GRAPH_CODES.PRESET_NO_MEMBER,
      'the Team constructed no Member; a preset that mounts nothing is a dead preset, not an empty result',
      { neverStarted: false, members: 0 },
    )
  }
  if (template !== null && !list.some((m) => String(m?.templateId ?? '') === template)) {
    throw new ShippedPresetAuditError(
      PROFILE_GRAPH_CODES.PRESET_NO_MEMBER,
      `the Team constructed no '${template}' Member (got ${list.map((m) => String(m?.templateId ?? '?')).join(', ')})`,
      { neverStarted: false, members: list.length, template },
    )
  }
  if (surfaceCount !== null && surfaceCount < minSurface) {
    throw new ShippedPresetAuditError(
      PROFILE_GRAPH_CODES.PRESET_NO_SURFACE,
      `the governed Member's model-visible surface is ${String(surfaceCount)} names (floor ${String(minSurface)}); the preset `
        + 'did not mount for it, so every arm would be measured against a dead Agent',
      { neverStarted: false, members: list.length, surfaceCount },
    )
  }
  return Object.freeze({ neverStarted: false, members: list.length, surfaceCount })
}

/**
 * Write the provisioning record beside a boot's other evidence, so every run
 * states WHERE its module graph came from (World factory vs a driver's own copy
 * vs the negative control).
 *
 * @param {string} path the JSON destination.
 * @param {object} record the provisioning + verification record.
 */
export function writeProfileGraphRecord(path, record) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`)
}
