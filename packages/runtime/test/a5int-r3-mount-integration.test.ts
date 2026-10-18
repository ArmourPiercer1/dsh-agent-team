/**
 * a5int-r3 — the two integration conditions of the mount flip, as LEGS.
 *
 * Stack: master `15481988` (glob row dormant, "mount comes with integration
 * round + runtime_base narrowing") ⊕ srgp `3f78fcce` (the confined-rg search
 * face), DECLARATIVE REHEARSAL of PR #330's candidate head. The flip itself is
 * three lines in `packages/runtime/src/plugin/live/team-tool-plane.mjs`:
 *
 *   1. the search row passes `confined: confinedCfg` — the one line the srgp
 *      lane left to the integration owner (its README, "Gap for the integration
 *      owner"); without it production runs the grep(1) port and the rg row only
 *      exists for callers that hand in the provider conf.
 *   2. the glob row leaves the typed shut face for `createAnchoredGlobBackend`,
 *      with CANDIDATE-A's name-class exposure documented at the row (outside
 *      NAMES can surface through the provider's `runtime_base '/'` READ_DIR
 *      grant + the verify -> launcher string-chdir window; bytes never — the
 *      re-review measured 3/10700). This file does not pretend that away: every
 *      leg here is about the WIRE and the GRANT, never about the provider face.
 *   3. the shell row's mounted name becomes the native `bash` — the ONLY
 *      native claim the 216-cell matrix accepts for this lane
 *      (`bash @ 'bash' ACCEPTED`, evidence/alpha5/natexe
 *      /matrix-reserved-native-receipt.log:115 + its footer "2 accepted
 *      (bash@bash, read@read), 214 refused"), while `grep`/`glob` keep their
 *      GLUE-5 aliases because claiming them natively is REFUSED. `names` is
 *      ROW-CONFIG input (team-tool-plane.mjs:439), so this is a wiring flip,
 *      not a change to the lane default.
 *
 * The two conditions the parent asked to make testable:
 *   (a) ALLOWPATHS SAME-SHAPE — the glob row may not grant a wider face than its
 *       siblings; the search row's and the glob row's grant lists are the same
 *       list, and only the shell row carries a write lane.
 *   (b) INTERNAL LOG NEVER REACHES A MEMBER-VISIBLE SINK — the plane wires no
 *       `internalLog` into any row, and the host-side observation channel never
 *       shows up in what a member can read back.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const WORLD = join(REPO, 'tests/homes', `a5int-r3-${Date.now().toString(36)}`)
const ROOT_DIR = join(WORLD, 'root')
const OUTSIDE_DIR = join(WORLD, 'outside')
const REALM = 'a5int-r3-realm'
const PLANE_SRC = join(REPO, 'packages/runtime/src/plugin/live/team-tool-plane.mjs')
const GLOB_SRC = join(REPO, 'packages/runtime/src/plugin/live/glob-backend.mjs')
const SEARCH_SRC = join(REPO, 'packages/runtime/src/plugin/live/search-backend.mjs')
const MATRIX_RECEIPT = join(REPO, 'dev/agent-workflow/evidence/alpha5/natexe/matrix-reserved-native-receipt.log')

interface PlaneValue {
  definitions: ReadonlyArray<{ name: string }>
  ownNames: readonly string[]
  backends: Record<string, { backendId?: string }>
}
interface PlaneRow {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) =>
    | { ok: true; value: PlaneValue }
    | { ok: false; code: string; message: string }
  verifyPlaneNames: (names: Record<string, string>, readName: string) => { ok: boolean; code?: string }
  DEFAULT_PLANE_NAMES: Record<string, string>
}

let row: PlaneRow

const fsInstance = () => ({ fs: 'a5int-ctl', rootDir: ROOT_DIR, realmId: REALM, kind: 'absolute-path' })
const confinedProvider = () => ({
  trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
  assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
})
const POLICY = Object.freeze({
  default: 'ask',
  allow: [{ tool: 'read', resource: { kind: 'any' } }],
  ask: [] as unknown[],
  deny: [] as unknown[],
})

function buildPlane(extra: Record<string, unknown> = {}, sink: string[] = []) {
  const built = row.createTeamToolPlaneAssembly({
    permissionPolicy: POLICY,
    realmId: REALM,
    templateId: 'a5int-tpl',
    role: 'member',
    instanceId: 'a5int-instance',
    onObserve: (r: unknown) => sink.push(String(r)),
    ...extra,
  })
  return { built, sink }
}

/**
 * Backend identity of a mounted row, typed for `noUncheckedIndexedAccess` — the merge gate's
 * typecheck lane runs the test tree too (a5int-r3 round-12 fix ③).
 */
function backendIdOf(value: PlaneValue, row: 'search' | 'glob' | 'shell'): string {
  const entry = (value.backends as Record<string, { backendId?: string } | undefined>)[row]
  return String(entry?.backendId)
}

/** The `allowPaths: [ … ]` literal a source file hands to the confined provider. */
/**
 * The `allowPaths: [ … ]` literal a source file hands to the confined provider.
 * BRACKET-BALANCED, not `indexOf('],')`: a `],` planted in a comment or string must not
 * truncate the extraction (round-12 review ④ — silent truncation would make the parity
 * law vacuously true). Brackets inside quoted strings and `//` comments are skipped, so
 * the returned list is the real grant list whatever the surrounding prose says.
 */
function grantBlockOf(src: string): string[] {
  const i = src.lastIndexOf('allowPaths: [')
  if (i < 0) throw new Error('no allowPaths grant found')
  const start = src.indexOf('[', i)
  let depth = 0
  let quote: string | null = null
  let lineComment = false
  let end = -1
  for (let k = start; k < src.length; k++) {
    const c = src[k]
    if (lineComment) {
      if (c === '\n') lineComment = false
      continue
    }
    if (quote !== null) {
      if (c === '\\') k++
      else if (c === quote) quote = null
      continue
    }
    if (c === '/' && src[k + 1] === '/') { lineComment = true; continue }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue }
    if (c === '[') depth++
    else if (c === ']') {
      depth--
      if (depth === 0) { end = k; break }
    }
  }
  if (end < 0) throw new Error('grant block never closes')
  const block = src.slice(start, end + 1)
  // bracket-only lines are structure, not grants — dropping them makes any count
  // assertion about "the grant items" mean the items
  return block.split('\n').map((l) => l.trim())
    .filter((l) => /[A-Za-z0-9_']/.test(l) && !l.startsWith('//'))
}

beforeAll(async () => {
  row = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as PlaneRow
  mkdirSync(join(ROOT_DIR, 'data'), { recursive: true })
  mkdirSync(OUTSIDE_DIR, { recursive: true })
  writeFileSync(join(ROOT_DIR, 'data', 'needle.txt'), 'A5INT-INSIDE-TOK\nnoise\n')
  writeFileSync(join(OUTSIDE_DIR, 'secret.txt'), 'A5INT-OUTSIDE-SECRET-42\n')
})

afterAll(() => {
  try { rmSync(WORLD, { recursive: true, force: true }) } catch { /* best effort */ }
})

describe('a5int-r3 mount flip — the two integration conditions', () => {
  it('FLIP COVERAGE: with the provider conf the search row is the rg face and the glob row is live-anchored; without it both disclosed controls stay', async () => {
    // configured world: BOTH rows leave the shut landing.
    const hostLog: string[] = []
    const { built } = buildPlane({ plane: { fsInstance: fsInstance(), confinedProvider: confinedProvider() } }, hostLog)
    expect(built.ok, JSON.stringify(built)).toBe(true)
    if (!built.ok) return
    expect(hostLog.join('\n')).toContain('production-admission-note')
    // Identity, not vibes: each row reports the backend it actually mounted.
    // glob = this lane's anchored confined-rg face; search = the srgp rg face
    // (SEARCH_BACKEND_ID, search-backend.mjs:189), which production could NOT
    // reach before flip 1. A reverted flip changes these strings and goes red.
    expect(backendIdOf(built.value, 'glob')).toBe('a5glb-anchored-confined-rg-glob')
    expect(backendIdOf(built.value, 'search')).toBe('a5srgp-anchored-confined-rg-grep')
    expect(backendIdOf(built.value, 'shell')).toBe('a5g7-confined-exec-shell')
    expect(built.value.definitions.map((d) => d.name)).toContain('team_glob')
    // unconfigured world: the control row — search keeps the grep port, glob keeps
    // the typed shut face. The flip is conditional on the anchor, never invented.
    const bare = buildPlane()
    expect(bare.built.ok, JSON.stringify(bare.built)).toBe(true)
    if (!bare.built.ok) return
    // an unconfigured plane builds no fs-class/shell row, so it announces no row —
    // only its own admission note (a5p2prod) is on the host channel.
    const bareObserved = bare.sink.join('\n')
    expect(bareObserved).not.toContain('a5glb-glob')
    expect(bareObserved).not.toContain('a5g7-shell')
    // nothing configured at all: every row keeps the typed shut landing,
    // byte-for-byte as GLUE-7 shipped it (the closed world invents nothing).
    expect(backendIdOf(bare.built.value, 'glob')).toBe('a5-effect-face-pending')
    expect(backendIdOf(bare.built.value, 'search')).toBe('a5-effect-face-pending')
    expect(backendIdOf(bare.built.value, 'shell')).toBe('a5-effect-face-pending')
    // the DISCLOSED CONTROL (glue7 legs G1/G1b/G2/G9): an fsInstance world with NO
    // provider conf keeps the grep(1) search port and the shut glob row — flip 1 is
    // conditional on the provider conf, flip 2 on both, and neither is ever invented.
    const anchoredOnly = buildPlane({ plane: { fsInstance: fsInstance() } })
    expect(anchoredOnly.built.ok, JSON.stringify(anchoredOnly.built)).toBe(true)
    if (!anchoredOnly.built.ok) return
    expect(backendIdOf(anchoredOnly.built.value, 'search')).toBe('a5g7-controlled-fs-anchored-grep')
    expect(backendIdOf(anchoredOnly.built.value, 'glob')).toBe('a5-effect-face-pending')
  })

  it('CONDITION (a) ALLOWPATHS SAME-SHAPE: the glob row grants exactly what the search row grants, and only the shell row carries a write lane', () => {
    const globGrants = grantBlockOf(readFileSync(GLOB_SRC, 'utf8'))
    const searchGrants = grantBlockOf(readFileSync(SEARCH_SRC, 'utf8'))
    // Same list, same order, same bits: the rg walker may not read wider than the
    // rg searcher. A divergence here is a scope change and must be reviewed as one.
    expect(globGrants).toEqual(searchGrants)
    // Not vacuous: neither list grants a write lane anywhere…
    const joined = globGrants.join(' ')
    expect(joined).not.toContain('writeFile')
    expect(joined).not.toContain('makeReg')
    // …while the shell row's grant (the sibling that legitimately runs commands)
    // DOES carry one, which is what makes "same-shape" a real statement.
    const shellSrc = readFileSync(join(REPO, 'packages/runtime/src/plugin/live/plane-effect-backends.mjs'), 'utf8')
    const shellRow = shellSrc.slice(shellSrc.indexOf("argv: ['/bin/sh', '-c', parsed.command]"))
    const shellGrant = shellSrc.slice(shellSrc.lastIndexOf('const anchorGrant'), shellSrc.indexOf("argv: ['/bin/sh', '-c', parsed.command]"))
    expect(shellRow.length, 'the confined-shell row is the one with a write lane').toBeGreaterThan(0)
    expect(shellGrant).toContain('writeFile')
    // and the plane wires both rows off the SAME governed root, so the anchor the
    // two read-only grants name is one anchor, not two.
    const planeSrc = readFileSync(PLANE_SRC, 'utf8')
    const searchRow = planeSrc.slice(planeSrc.indexOf('const realSearch'), planeSrc.indexOf('const realGlob'))
    const globRow = planeSrc.slice(planeSrc.indexOf('const realGlob'), planeSrc.indexOf('const productionBackends'))
    expect(searchRow).toContain('rootDir: fsInstance.rootDir')
    expect(globRow).toContain('rootDir: fsInstance.rootDir')
  })

  it('RED-INJECTION ④: a `],` planted in a comment still yields every grant item', () => {
    // The parity law is worth nothing if the reader can be silenced. This synthetic pair
    // differs ONLY in grant order and BOTH carry `],` inside a comment — the exact shape a
    // planted marker takes. An `indexOf('],')` reader returns a one-line block for both and
    // declares them equal; the balanced reader does not.
    const synth = (a: string, b: string) => '  const request = {\n    allowPaths: [\n      // escape hatch ], keep reading\n      { path: \'' + a + '\', accessBits: { readFile: true } },\n      { path: \'' + b + '\', accessBits: { readDir: true } },\n    ],\n  }\n'
    const one = grantBlockOf(synth('/bin', '/usr'))
    const two = grantBlockOf(synth('/usr', '/bin'))
    expect(one.length, 'the planted `],` must not truncate the list').toBe(2)
    expect(one).toContain("{ path: '/bin', accessBits: { readFile: true } },")
    expect(one).toContain("{ path: '/usr', accessBits: { readDir: true } },")
    expect(one).not.toEqual(two) // teeth: a real divergence stays a RED
    // and the real sources still agree under the hardened reader
    expect(grantBlockOf(readFileSync(GLOB_SRC, 'utf8'))).toEqual(grantBlockOf(readFileSync(SEARCH_SRC, 'utf8')))
  })

  it('CONDITION (b) INTERNAL LOG IS NOT A MEMBER SINK: the plane wires no internalLog, and host observations never read back through the wire', async () => {
    const planeSrc = readFileSync(PLANE_SRC, 'utf8')
    // The rows hand their rows a HOST sink (logBackend -> observe -> console), and
    // `internalLog` — the backends' own debug face, default OFF — is never passed by
    // production. If someone wires it to a member-visible channel this leg goes red.
    expect(planeSrc).not.toContain('internalLog')
    // Behavioural half: drive the plane and read back everything a member can see.
    const { built, sink } = buildPlane({ plane: { fsInstance: fsInstance(), confinedProvider: confinedProvider() } })
    expect(built.ok, JSON.stringify(built)).toBe(true)
    if (!built.ok) return
    const wire = JSON.stringify(built.value.definitions.map((d) => d.name))
    // the assembly's own surface (definitions/ownNames/backends) carries no log line
    for (const line of sink) expect(wire).not.toContain(line)
    // …and no internal path of the governed world is part of the mounted surface
    expect(wire).not.toContain(ROOT_DIR)
    expect(sink.length, 'the configured rows do announce themselves host-side').toBeGreaterThan(0)
  })

  it('FLIP 3 NAMES: only the matrix-accepted native claim is mountable (bash@bash); grep/glob native claims stay refused', () => {
    // the authority: the 216-cell matrix receipt's own footer
    const receipt = readFileSync(MATRIX_RECEIPT, 'utf8')
    expect(receipt).toContain('2 accepted (bash@bash, read@read)')
    // the row-config the int wiring passes
    const names = { grep: 'team_grep', glob: 'team_glob', bash: 'bash' }
    expect(row.verifyPlaneNames(names, 'read').ok).toBe(true)
    const { built } = buildPlane({ plane: { fsInstance: fsInstance(), confinedProvider: confinedProvider(), names } })
    expect(built.ok, JSON.stringify(built)).toBe(true)
    if (!built.ok) return
    const mounted = built.value.definitions.map((d) => d.name)
    expect(mounted).toContain('bash') // the shell class under its native spelling
    expect(mounted).toContain('team_grep') // grep/glob keep the GLUE-5 aliases
    expect(mounted).toContain('team_glob')
    // and the matrix's refusals are enforced by the same gate, not by convention
    expect(row.verifyPlaneNames({ ...names, grep: 'grep' }, 'read').ok).toBe(false)
    expect(row.verifyPlaneNames({ ...names, glob: 'glob' }, 'read').ok).toBe(false)
    // the lane default is untouched by this round (the flip is wiring, not a new default)
    expect(row.DEFAULT_PLANE_NAMES.bash).toBe('team_bash')
  })
})
