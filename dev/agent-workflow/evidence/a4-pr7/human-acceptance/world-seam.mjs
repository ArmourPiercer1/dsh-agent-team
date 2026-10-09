/**
 * world-seam.mjs — shared plumbing for the A4-PR7 W5 human-acceptance world.
 *
 * WHAT THIS IS: the one place that knows how to reach a REAL durable Team
 * world on disk, from a plain `node` process, with NO host running. Both
 * scripts in this directory use it:
 *
 *   make-corrupt-world.mjs     copy the acceptance world + append the damaged row
 *   verify-corrupt-world.mjs   read the same world through the production read plane
 *
 * WHY IT IS SHAPED LIKE THIS (every choice below is measured, see FINDINGS.md):
 *
 * 1. NO hand-written bytes. The append goes through the repository's own
 *    write API — `openTeamDomain(seam)` → `repositories.ledger.allocateSequence()`
 *    → `repositories.ledger.put(entry)` — loaded from this repo's BUILT
 *    production output (`packages/runtime/dist/…`, the same artifact the
 *    plugin row mounts). That is the code path that produces the canonical
 *    key-sorted row bytes, allocates the ledger sequence, and advances
 *    `team_sessions.generation` (S1-A stamp). Nothing here re-implements any
 *    of it, so the injected row is byte-shaped exactly like a row the product
 *    wrote.
 * 2. The `StorageDomainSeam` is the ROW-OWNED real seam
 *    (`packages/runtime/root-binding/harness/seam.mjs`, exported
 *    `createRealStorageDomainSeam`) over the REAL host backend: the pristine
 *    test runtime's `storage-json` + `storage-domain` built libs, i.e. the
 *    very modules the booted host loads when it serves
 *    `<DSH_HOME>/storages/team_domain.json`. The only invented object is the
 *    Cordis `ctx` the facility needs, and it is minimal and inert:
 *    `storage.backend.get()` (routing), a `logger` that swallows, and an
 *    `emit()` that swallows (`domain/changed` has no subscriber offline).
 * 3. Reads are production reads too: `ControlService.listControlState()` and
 *    the s6 remote port/dispatcher (`team.listCorruptControlLegs`, contract
 *    v9), wired exactly as `packages/runtime/src/plugin/root.ts` wires them
 *    (the precedent is `packages/runtime/test/a4w1-corrupt-warning.test.ts`).
 *
 * RED LINES this module enforces for both callers:
 *   - a world may live ONLY under `<repo>/tests/homes/` (TEST_METHODS §1/§5/§7);
 *   - ports outside the 3180 family / 3491-3500 are never probed, and `:3080`
 *     is never touched by anything in this directory;
 *   - nothing here writes outside the destination world.
 *
 * @module dev/agent-workflow/evidence/a4-pr7/human-acceptance/world-seam
 */

import { existsSync, readFileSync } from 'node:fs'
import { connect } from 'node:net'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** This directory. */
export const HERE = dirname(fileURLToPath(import.meta.url))

/**
 * The repo root this evidence dir sits in (`dev/agent-workflow/evidence/a4-pr7/human-acceptance`
 * is five levels below it). Every path below is derived from it, so the
 * scripts work from any checkout of this branch without configuration.
 */
export const REPO_ROOT = resolve(HERE, '..', '..', '..', '..', '..')

/** The existing acceptance world this recipe copies (see its own README.md). */
export const SOURCE_WORLD_NAME = 'a4-accept-20261007T16-57-26Z'

/** Default destination world name (fixed, so re-running is idempotent). */
export const DEFAULT_WORLD_NAME = 'a4-w5-corrupt-acceptance'

/** Marker this tool writes into the destination world (ownership proof). */
export const WORLD_MARKER = '.a4-w5-corrupt-world.json'

/** The durable TeamDomain unit file inside a world. */
export const LEDGER_REL_PATH = join('storages', 'team_domain.json')

/**
 * The `requestId` of the damaged row. It doubles as the IDEMPOTENCE SENTINEL:
 * a row carrying it is the row this tool writes, and a second run that finds
 * one writes nothing. It is NOT an attribution member — `corruptLegDisclosesMember`
 * compares `actionName` / `toolName` / `correlation` / `operationFingerprint` /
 * `subject` / `targetInstanceId` only — so the wire still reports the row
 * `disclosesMember: false` while echoing the requestId it actually read.
 */
export const DAMAGE_REQUEST_ID = 'req-a4w5-human-acceptance-damage'

/** Ports a test host may own (TEST_METHODS §1). Anything else is never probed. */
export const TEST_PORTS = new Set([
  3180, 3181, 3182, 3183, 3184, 3185, 3186,
  3491, 3492, 3493, 3494, 3495, 3496, 3497, 3498, 3499, 3500,
])

/**
 * What `--copy` skips, and why (also restated in RECIPE.md). Everything
 * excluded is per-boot state of the SOURCE instance; inheriting any of it
 * would make the copy look like a running host or carry another instance's
 * secrets. Everything durable — `storages/`, `sessions/`, `blueprints/`,
 * `profiles/web/{package.json,cordis.yml,pnpm-workspace.yaml}`, `workspace/`,
 * `.anonymous-user-id` — is copied.
 */
export const COPY_EXCLUDES = [
  '.accept-host.json', // supervisor marker: another instance's pids + port
  '.accept-launch.json', // another instance's web launch token
  '.credentials.yaml', // another instance's host credential/grant records
  'accept-probe.log', // the source world's own :3080 probe history
  'logs', // previous boots' host logs + raw mock-model bodies
  '.tmp-home', // per-boot HOME/XDG/npm scratch (boot.mjs recreates it)
  '.tmp-xdg',
  '.tmp-npm-cache',
  'p6t6-directive.json', // carries the source world's reportDir; boot.mjs rewrites it
  'profiles/web/cordis.patch.yml', // carries the source world's paths; boot.mjs regenerates it
]

/**
 * Print a failure and exit non-zero. Every refusal in these scripts goes
 * through here, so an operator always gets one actionable line.
 * @param {string} message - what refused and what to do about it.
 * @returns {never}
 */
export function fail(message) {
  process.stderr.write(`\n[a4-w5 FAIL] ${message}\n`)
  process.exit(1)
}

/**
 * Minimal `--flag` / `--opt value` parser (no dependency, no positional args).
 * @param {string[]} argv - `process.argv.slice(2)`.
 * @returns {{ flags: Set<string>, opts: Map<string, string> }}
 */
export function parseArgs(argv) {
  const flags = new Set()
  const opts = new Map()
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) fail(`unexpected argument '${token}' (only --flag / --opt value are accepted)`)
    const name = token.slice(2)
    const next = argv[i + 1]
    if (next !== undefined && !next.startsWith('--')) {
      opts.set(name, next)
      i += 1
    } else {
      flags.add(name)
    }
  }
  return { flags, opts }
}

/**
 * Resolve one world directory and prove it is a legal test world.
 * @param {string} repo - the repo root.
 * @param {string|undefined} raw - the `--world` / `--source-world` value, if any.
 * @param {string} defaultName - the world name to use when none was passed.
 * @param {string} label - which option this is, for the refusal message.
 * @returns {string} the absolute world path.
 */
export function resolveWorld(repo, raw, defaultName, label) {
  const homes = resolve(repo, 'tests', 'homes')
  const world = resolve(repo, raw ?? join('tests', 'homes', defaultName))
  const inside = relative(homes, world)
  if (inside === '' || inside.startsWith('..') || inside.startsWith('/') || world === homes) {
    fail(
      `${label} must be a world directory INSIDE <repo>/tests/homes/ (TEST_METHODS §1/§5/§7), got ${world}.\n` +
      `           Pass --world tests/homes/<name>, and never a real user home (~/.dsh).`,
    )
  }
  return world
}

/**
 * The host's own storage backend modules (the pristine test runtime, TEST_METHODS §1).
 * @param {string} repo - the repo root.
 * @returns {{ jsonUrl: string, domainUrl: string }} `file://` URLs.
 */
export function hostStorageLibUrls(repo) {
  const base = join(repo, 'tests', 'deepseek-harness-test-use', 'packages', 'storage')
  const json = join(base, 'storage-json', 'lib', 'index.js')
  const domain = join(base, 'storage-domain', 'lib', 'index.js')
  for (const [what, p] of [['storage-json', json], ['storage-domain', domain]]) {
    if (!existsSync(p)) {
      fail(
        `the pristine test runtime does not provide the ${what} module (${p}).\n` +
        `           Build/land it first: TEST_METHODS §1 (checkout at the pinned baseline) and §2 (pnpm run build).`,
      )
    }
  }
  return { jsonUrl: pathToFileURL(json).href, domainUrl: pathToFileURL(domain).href }
}

/**
 * Resolve + validate one built production module, then import it.
 * @param {string} repo - the repo root.
 * @param {string} rel - path under the repo, e.g. `packages/runtime/dist/…/service.js`.
 * @returns {Promise<object>} the module namespace.
 */
export async function loadBuilt(repo, rel) {
  const p = join(repo, rel)
  if (!existsSync(p)) {
    fail(
      `missing built artifact ${rel}.\n` +
      `           Run 'pnpm install && pnpm build' (then 'pnpm build:composition' for the browser half) in ${repo}.`,
    )
  }
  return await import(pathToFileURL(p).href)
}

/**
 * Open one durable world through the production storage layer, offline.
 *
 * The returned `close()` releases the domain AND the facility, so the process
 * can exit; an unclosed domain is harmless offline (no lock file survives) but
 * closing keeps the "no live handle" story honest.
 *
 * @param {string} repo - the repo root.
 * @param {string} world - the world directory.
 * @returns {Promise<{ domain: object, close: () => Promise<void> }>}
 */
export async function openWorld(repo, world) {
  if (!existsSync(join(world, LEDGER_REL_PATH))) {
    fail(`no durable TeamDomain at ${join(world, LEDGER_REL_PATH)} — that is not a booted world.`)
  }
  const { jsonUrl, domainUrl } = hostStorageLibUrls(repo)
  const { JsonStorageBackend } = await import(jsonUrl)
  const { DomainFacility } = await import(domainUrl)
  const { createRealStorageDomainSeam } = await loadBuilt(
    repo, 'packages/runtime/root-binding/harness/seam.mjs')
  const { openTeamDomain } = await loadBuilt(
    repo, 'packages/runtime/dist/packages/storage/repositories/team-domain.js')

  const backend = new JsonStorageBackend(join(world, 'storages'))
  const swallow = () => {}
  // The inert Cordis context `DomainFacility`/`DomainImpl` touch: backend
  // routing, a logger that discards, and `emit` for `domain/changed` (offline
  // there is no subscriber; the booted host's own facility is a different
  // process and never sees these writes — that is exactly why the app must be
  // stopped while injecting).
  const ctx = {
    storage: { backend: { get: () => backend } },
    logger: { debug: swallow, info: swallow, warn: swallow, error: swallow },
    emit: swallow,
  }
  const facility = new DomainFacility(ctx, { backend: 'json' })
  const seam = createRealStorageDomainSeam(facility)
  const domain = await openTeamDomain(seam)
  return {
    domain,
    close: async () => {
      await domain.close()
      await seam.closeAll()
    },
  }
}

/**
 * Load the production read surface the scripts assert against (control
 * service, blueprint catalog, s6 remote ports/dispatcher).
 * @param {string} repo - the repo root.
 * @returns {Promise<Record<string, any>>}
 */
export async function loadProductionReadSurface(repo) {
  const control = await loadBuilt(repo, 'packages/runtime/dist/packages/runtime/control/index.js')
  const blueprint = await loadBuilt(repo, 'packages/runtime/dist/packages/domain/blueprint/src/index.js')
  const s6 = await loadBuilt(repo, 'packages/runtime/dist/packages/runtime/src/plugin/s6-remote.js')
  return {
    createControlService: control.createControlService,
    parseBlueprint: blueprint.parseBlueprint,
    createBlueprintCatalog: blueprint.createBlueprintCatalog,
    createS6RemotePorts: s6.createS6RemotePorts,
    createS6RemoteDispatcher: s6.createS6RemoteDispatcher,
  }
}

/**
 * Does a TCP port answer right now? Used ONLY to refuse injecting into a world
 * whose host is still running. Never called with a port outside TEST_PORTS.
 * @param {number} port - candidate test port.
 * @returns {Promise<boolean>} true when something accepts connections.
 */
export function portAccepts(port) {
  return new Promise((resolvePromise) => {
    if (!TEST_PORTS.has(port)) {
      resolvePromise(false)
      return
    }
    const socket = connect({ host: '127.0.0.1', port }, () => {
      socket.destroy()
      resolvePromise(true)
    })
    socket.on('error', () => resolvePromise(false))
    socket.setTimeout(1_500, () => {
      socket.destroy()
      resolvePromise(false)
    })
  })
}

/**
 * Refuse to touch a world whose recorded host is still listening.
 *
 * The recorded `hostPid` alone is NOT a usable signal: a stopped acceptance
 * world leaves its marker behind with stale pids, and a stale pid can still
 * look "alive" (measured on this box: `process.kill(3,0)` succeeds against a
 * kernel thread while the host is long gone). A listening port is evidence.
 *
 * @param {string} label - which world is being checked.
 * @param {string} world - the world directory.
 * @returns {Promise<void>}
 */
export async function refuseRunningHost(label, world) {
  const markerPath = join(world, '.accept-host.json')
  if (!existsSync(markerPath)) return
  let recorded
  try {
    recorded = JSON.parse(readFileSync(markerPath, 'utf8'))
  } catch {
    return // unreadable marker: no port claim to honour
  }
  const port = Number(recorded?.port)
  if (!Number.isInteger(port)) return
  if (!TEST_PORTS.has(port)) {
    fail(
      `${label} records a host on port ${port}, outside the test family (TEST_METHODS §1). ` +
      `Refusing to probe it, and refusing to touch ${world}.`,
    )
  }
  if (await portAccepts(port)) {
    fail(
      `${label} still has a live host listening on 127.0.0.1:${port} ` +
      `(marker ${markerPath}). The ledger append must run with the app STOPPED: a running host holds the ` +
      `whole unit in memory and its next write would drop the appended row. ` +
      `Stop it first (from the acceptance-world directory: node boot.mjs --stop).`,
    )
  }
}

/**
 * The damaged row this recipe appends: one `control-request-recorded` fact the
 * STRICT reader refuses, in the shape the control module itself names
 * UNATTRIBUTABLE.
 *
 * Every member `corruptLegDisclosesMember` (packages/runtime/control/service.ts)
 * compares is present-and-unreadable, per the measured predicate:
 *   - `actionName` / `correlation`: present and EMPTY. `requestMemberRequirement`
 *     probes the reader and reports both as rejecting empty, so an empty value
 *     is not a value at all — it is the damage, and it discloses nothing.
 *   - `toolName` / `operationFingerprint`: the wrong TYPE (a number). The
 *     predicate requires a string, and `parseRequestPayload` refuses a
 *     present-but-non-string value — so each is both a refusal cause and
 *     non-disclosing. (An empty STRING would be the opposite: `toolName` is
 *     optional, so `''` IS a disclosed value. That is why this row uses 42.)
 *   - `subject`: a number, so `parseSubject` answers undefined — an unreadable
 *     identity discloses nothing (and is itself a refusal cause).
 *   - `targetInstanceId`: EMPTY, so the legacy projection discloses nothing.
 *
 * This is deliberately the SAME shape as the W1 acceptance row
 * (`unattributableRow()` in packages/runtime/test/a4w1-corrupt-warning.test.ts,
 * the "W13-i shape"), so the human in front of the GUI sees the case the
 * automated acceptance proves — not a new invention. `requestId` is a readable
 * string on purpose: the read plane echoes identities it actually read, and a
 * recognisable one makes the row findable by the person cleaning up.
 *
 * @param {string} rootSessionId - the TeamSession this row is filed under.
 * @param {string} [requestId] - the sentinel identity; one per damaged row, so a
 *   world holding MORE THAN ONE damaged Team can carry both (the ledger of a world
 *   is shared, and idempotence is keyed by this id — see `findDamagedRowSequence`).
 * @returns {Record<string, unknown>} the payload (canonicalisation is the repository's job).
 */
export function damagedControlRow(rootSessionId, requestId = DAMAGE_REQUEST_ID) {
  void rootSessionId // the entry carries the root; the payload deliberately names nobody
  return {
    requestId,
    kind: 'leader-approval',
    requester: { kind: 'human', humanId: 'a4-w5-human-acceptance' },
    subject: 42,
    targetInstanceId: '',
    actionName: '',
    toolName: 42,
    correlation: '',
    operationFingerprint: 42,
    executionCoupling: 'guarded',
  }
}

/**
 * Find the damaged row (idempotence probe) among the durable ledger entries.
 * @param {Array<{factType: string, sequence: number, payload: unknown}>} entries - `ledger.list()`.
 * @param {string} [requestId] - which damaged row to look for (defaults to the recipe's own).
 * @returns {number|undefined} the ledger sequence when present.
 */
export function findDamagedRowSequence(entries, requestId = DAMAGE_REQUEST_ID) {
  for (const entry of entries) {
    if (entry.factType !== 'control-request-recorded') continue
    const payload = entry.payload
    if (payload !== null && typeof payload === 'object' && payload['requestId'] === requestId) {
      return entry.sequence
    }
  }
  return undefined
}
