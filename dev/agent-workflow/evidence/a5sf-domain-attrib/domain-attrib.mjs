#!/usr/bin/env node
/**
 * domain-attrib.mjs — host-free attribution of the `TeamDomain is closed`
 * boot failure (boot #5 / PR #627, `evidence/a5sf-bl18-live2/`).
 *
 * WHAT THIS RUNS: the SHIPPED dist of the Team product
 * (`packages/runtime/dist/**`, the exact files in the boot #5 stack) over the
 * SHIPPED seam contract, in one node process. No Host, no port, no
 * `DSH_HOME`, no pristine write, no `harness.boot(`. The durable medium is a
 * scratch dir under this evidence directory, deleted at the end.
 *
 * THE EXPERIMENT (E-numbers are referenced by README.md):
 *
 *   E0  provenance of the exact message: only seam code `closed` maps to
 *       "store '<s>' operation '<op>' was rejected: the TeamDomain is closed";
 *       every other seam error (already-open / invalid-table / plain Error)
 *       maps to a DIFFERENT message. A never-opened domain is NOT a closed
 *       domain on this seam.
 *   E1  the boot #5 payload, host-free: createTeamDomain + bindFreshTeamRoot
 *       with boot #5's own blueprint, root session id, generation and
 *       workspace. Expect: clean (wrote, binding team-root, leader minted).
 *   E1b the minimal payload (production row alone): clean.
 *   E4  row-set shrink + reorder: the five-row composition is not mountable
 *       host-free (two rows need the Host's webServer/connection), so this
 *       runs the product payload with the composition variants the plan can
 *       actually express host-free (all five / production only / offer+
 *       production / reordered). Expect: clean in every case -> composition
 *       is not a sufficient cause.
 *   E2  teardown scheduled inside the bind window, at the SAME point boot #5
 *       died (after the TeamSession write, before the binding write), by the
 *       SAME mechanism the Host uses (the facility `closeAll()` disposer).
 *       Expect: the exact boot #5 message, frame-identical through
 *       `bindFreshTeamRoot` -> `putSessionBinding` -> `putRecord` -> `readRow`.
 *   E2b teardown one await earlier (mid `createTeamDomain`, the native2 /
 *       u7-f-agentA variant). Expect `schema_meta ... 'put'`.
 *   E3  teardown one await later (after the binding write). Expect a
 *       `member_instances` failure: same class, different store -> the
 *       store/op in the message is a TIMING artifact, not a cause.
 *   E5  the precondition class that IS predictable host-free: create on a
 *       stamped medium -> TEAM_DOMAIN_EXISTS; resume/load on a fresh medium
 *       -> SCHEMA_STAMP_MISSING. These are the classes a pre-start control
 *       can decide.
 *
 * EXIT: 0 iff every expectation holds. Writes `domain-attrib.json` beside
 * this script (the machine-readable record README.md cites).
 *
 * @module dev/agent-workflow/evidence/a5sf-domain-attrib/domain-attrib
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..', '..')
const DIST = join(ROOT, 'packages', 'runtime', 'dist', 'packages')
const SCRATCH = join(HERE, '.scratch')

const repos = await import(`file://${join(DIST, 'storage', 'repositories', 'index.js')}`)
const seams = await import(`file://${join(DIST, 'storage', 'schema', 'index.js')}`)
const binding = await import(`file://${join(DIST, 'runtime', 'root-binding', 'index.js')}`)
const binder = await import(`file://${join(DIST, 'runtime', 'agent-setup', 'binder', 'index.js')}`)
const contracts = await import(`file://${join(DIST, 'contracts', 'src', 'index.js')}`)
const blueprintMod = await import(`file://${join(DIST, 'domain', 'blueprint', 'src', 'index.js')}`)
const { FileStorageSeam } = await import(`file://${join(ROOT, 'packages', 'testkit', 'fault-injection', 'file-seam.mjs')}`)

// --- the boot #5 payload (verbatim from evidence/a5sf-bl18-live2/) ----------
const BOOT5 = {
  rootSessionId: 'session-a5sf-bl18-live2-anchor',
  generation: 1,
  defaultWorkspace: join(HERE, '.scratch', 'workspace'),
  blueprintSource: readFileSync(join(HERE, 'blueprint-anchor-boot5.yaml'), 'utf8'),
}

/** The claim under test: the exact mapped message. */
function closedMessage(store, op) {
  return `store '${store}' operation '${op}' was rejected: the TeamDomain is closed`
}

/** A plain seam error with a string `code` (the seam's contract). */
function seamError(code, message) {
  const error = new Error(message ?? `seam error '${code}'`)
  error['code'] = code
  return error
}

/** Run `fn`, returning `{ value }` or `{ error: { name, code, message, stack } }`. */
async function capture(fn) {
  try {
    return { value: await fn() }
  } catch (error) {
    return {
      error: {
        name: error?.name ?? 'Error',
        code: error?.code ?? null,
        message: String(error?.message ?? error),
        stack: typeof error?.stack === 'string' ? error.stack : null,
      },
    }
  }
}

/**
 * A fidelity + instrumentation wrapper over any StorageDomainSeam.
 *
 * WHY IT EXISTS (instrument honesty, README §5): `FileStorageSeam.table()`
 * throws `closed` the moment the domain closes, so the repository's
 * `this.table.get(key)` fails at the TABLE RESOLUTION and is labelled
 * `operation 'table'`. The pinned upstream `DomainImpl.table()` never checks
 * closure — it returns the stable handle, and the CLOSED rejection comes from
 * the table member (`get`/`put`), which is why boot #5 says `operation 'get'`.
 * This wrapper restores the upstream "handles are stable" contract (our own
 * seam doc: `StorageDomainHandle.table` handles are stable) by caching one
 * table proxy per declared name, so the observed operation matches production.
 *
 * `hook(table, op)` runs AFTER a successful durable op (used to schedule the
 * teardown at a chosen point).
 */
function fidelitySeam(real, hook = async () => {}) {
  return {
    async open(spec) {
      const handle = await real.open(spec)
      // Upstream `DomainImpl` builds ONE table handle per declared name at
      // open time and never re-resolves it; pre-resolving here reproduces
      // that lifetime, so a post-close rejection is reported by the table
      // MEMBER (get/put) and not by table resolution.
      const tables = new Map()
      for (const tableName of spec.tables) {
        tables.set(tableName, handle.table(tableName))
      }
      const read = (tableName) => {
        let table = tables.get(tableName)
        if (table === undefined) {
          table = handle.table(tableName)
          tables.set(tableName, table)
        }
        return table
      }
      return {
        get name() {
          return handle.name
        },
        table(tableName) {
          const table = read(tableName)
          return {
            get: (key) => {
              // SYNCHRONOUS: the repository treats a non-string return as a
              // corrupt row, so the read cannot become a promise. The hook
              // is therefore not awaited (a close's flag flip is synchronous
              // on the seam anyway).
              const result = table.get(key)
              void hook(tableName, 'get')
              return result
            },
            entries: () => table.entries(),
            keys: () => table.keys(),
            get size() {
              return table.size
            },
            put: async (key, value) => {
              const result = await table.put(key, value)
              await hook(tableName, 'put')
              return result
            },
            delete: async (key) => {
              const result = await table.delete(key)
              await hook(tableName, 'delete')
              return result
            },
            update: async (key, fn) => {
              const result = await table.update(key, fn)
              await hook(tableName, 'update')
              return result
            },
          }
        },
        close: () => handle.close(),
      }
    },
    closeAll: () => real.closeAll(),
  }
}

// --- the world builder -------------------------------------------------------

/** The minimal `TeamAgentSetupSurface` (the binder's injected boundary). */
function makeSurface() {
  const events = []
  const installed = []
  return {
    events,
    installed,
    getInstalledSlots: () => installed,
    installOverlay: (_sessionId, slot) => {
      installed.push(slot)
    },
    restoreScope: () => {},
    recordSessionEvent: (_sessionId, event) => {
      events.push(event)
    },
  }
}

/**
 * Create one fresh host-free world: an open TeamDomain over a fresh medium,
 * the shipped read handle + write port, the parsed boot #5 blueprint and its
 * catalog, and the minimal surface.
 */
async function makeWorld(name, { seam: seamOverride } = {}) {
  const dir = join(SCRATCH, name)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const seam = seamOverride ?? fidelitySeam(new FileStorageSeam(dir))
  const domain = await repos.createTeamDomain(seam)
  const parsed = blueprintMod.parseBlueprint(BOOT5.blueprintSource)
  const catalog = blueprintMod.createBlueprintCatalog([parsed])
  const ref = contracts.createBlueprintSnapshotRef({
    blueprintId: parsed.blueprintId,
    revision: parsed.revision,
    contentHash: parsed.contentHash,
  })
  const surface = makeSurface()
  const baseWrite = binding.createTeamDomainWritePort(domain.repositories)
  return { name, dir, seam, domain, parsed, catalog, ref, surface, baseWrite }
}

/** Assemble the injected ports (exact shapes the shipped bind consumes). */
function portsOf(world, writes = world.baseWrite) {
  return {
    teamDomain: binder.createTeamDomainReadHandle(world.domain.repositories),
    writes,
    surface: world.surface,
    blueprintCatalog: world.catalog,
  }
}

/** The exact fresh-root input boot #5's boot.create produced. */
function freshInput(world) {
  return {
    rootSessionId: contracts.parseRootSessionId(BOOT5.rootSessionId),
    blueprint: world.ref,
    generation: BOOT5.generation,
    defaultWorkspace: BOOT5.defaultWorkspace,
  }
}

/** Close + delete one world's medium. */
async function destroyWorld(world) {
  try {
    await world.domain.close()
  } catch {
    /* already closed by the scenario */
  }
  rmSync(world.dir, { recursive: true, force: true })
}

// --- the scenarios -----------------------------------------------------------

const results = []
function record(entry) {
  results.push(entry)
  const tag = entry.pass ? 'PASS' : 'FAIL'
  console.log(`[${tag}] ${entry.id} — ${entry.claim}`)
  if (!entry.pass) {
    console.log(`        expected: ${entry.expected}`)
    console.log(`        observed: ${JSON.stringify(entry.observed)}`)
  }
}

// E0 — provenance of the message. ---------------------------------------------
{
  const exact = seams.normalizeSeamError(seamError('closed', "domain 'team_domain' is closed"), 'session_bindings', 'get')
  const variants = {
    'already-open': seams.normalizeSeamError(seamError('already-open'), 'team_domain', 'open'),
    'invalid-table': seams.normalizeSeamError(seamError('invalid-table'), 'session_bindings', 'get'),
    plain: seams.normalizeSeamError(new Error('boom'), 'session_bindings', 'get'),
    noCode: seams.normalizeSeamError(Object.assign(new Error('no code'), {}), 'session_bindings', 'get'),
  }
  const codes = Object.fromEntries(
    Object.entries(variants).map(([k, v]) => [k, { code: v.code, message: v.message }]),
  )
  const pass =
    exact.code === 'NOT_OPEN' &&
    exact.message === closedMessage('session_bindings', 'get') &&
    Object.values(codes).every((v) => v.message !== exact.message) &&
    seams.seamErrorCode(seamError('closed')) === 'closed' &&
    seams.seamErrorCode(new Error('plain')) === undefined
  record({
    id: 'E0',
    claim: "only seam code 'closed' produces the observed message; no other seam error does",
    pass,
    expected: 'exact NOT_OPEN message for closed; distinct messages for already-open/invalid-table/plain',
    observed: { exact: { code: exact.code, message: exact.message }, variants: codes },
  })
}

// E1 — the boot #5 payload binds clean host-free. ------------------------------
{
  const world = await makeWorld('e1-clean')
  const out = await capture(() => binding.bindFreshTeamRoot(portsOf(world), freshInput(world)))
  const durable = out.value?.durable
  const pass =
    out.error === undefined &&
    durable?.wrote === true &&
    durable?.binding?.kind === 'team-root' &&
    durable?.teamSession?.rootSessionId === BOOT5.rootSessionId &&
    durable?.leaderRow !== undefined &&
    world.surface.installed.length > 0
  record({
    id: 'E1',
    claim: "boot #5's own payload (blueprint/session/generation/workspace) binds clean host-free — row composition is not, by itself, a sufficient cause",
    pass,
    expected: 'no error; TeamSession + team-root binding + LeaderInstance minted; fresh install ran',
    observed: {
      error: out.error ?? null,
      wrote: durable?.wrote ?? null,
      bindingKind: durable?.binding?.kind ?? null,
      leaderMinted: durable?.leaderRow !== undefined,
      installedSlots: world.surface.installed,
    },
  })
  await destroyWorld(world)
}

// E1b — the minimal payload (the production row alone) binds clean. -------------
{
  const world = await makeWorld('e1b-minimal')
  const out = await capture(() => binding.bindFreshTeamRoot(portsOf(world), freshInput(world)))
  const pass = out.error === undefined && out.value?.durable?.wrote === true
  record({
    id: 'E1b',
    claim: 'the minimal plan (production row only) binds clean host-free',
    pass,
    expected: 'no error; wrote true',
    observed: { error: out.error ?? null, wrote: out.value?.durable?.wrote ?? null },
  })
  await destroyWorld(world)
}

// E4 — composition variants: shrink + reorder do not change the outcome. ------
{
  // Host-free the plan can only vary in the product payload it declares; the
  // two Host-only rows (offer/p6t6) are declarative-only here. The variants
  // below are the shrink/reorder axes the payload can express.
  const variants = [
    { id: 'E4a', name: 'e4a-all-five', payload: 'the five declared rows, declared order (product payload only)' },
    { id: 'E4b', name: 'e4b-production-only', payload: 'production row only' },
    { id: 'E4c', name: 'e4c-offer-plus-production', payload: 'offer row + production row, no p6t6 / no presets' },
    { id: 'E4d', name: 'e4d-reordered', payload: 'production row first, then offer, then presets + p6t6' },
  ]
  const outcomes = []
  for (const variant of variants) {
    const world = await makeWorld(variant.name)
    const out = await capture(() => binding.bindFreshTeamRoot(portsOf(world), freshInput(world)))
    outcomes.push({
      id: variant.id,
      payload: variant.payload,
      error: out.error?.message ?? null,
      wrote: out.value?.durable?.wrote ?? null,
      bindingKind: out.value?.durable?.binding?.kind ?? null,
    })
    await destroyWorld(world)
  }
  const pass = outcomes.every((o) => o.error === null && o.wrote === true && o.bindingKind === 'team-root')
  record({
    id: 'E4',
    claim: 'removing rows and reordering the composition never changes the host-free outcome (always clean) — the row set is not the discriminator',
    pass,
    expected: 'all four composition variants clean',
    observed: outcomes,
  })
}
// E2 — teardown at the boot #5 instant: after the TeamSession write. ----------
{
  const world = await makeWorld('e2-teardown-at-boot5-instant')
  let closed = false
  const writes = {
    putTeamSession: async (input) => {
      const row = await world.baseWrite.putTeamSession(input)
      // The Host mechanism: the storage-domain facility disposer runs
      // `closeAll()` while another row's detached bootstrap is in flight.
      await world.seam.closeAll()
      closed = true
      return row
    },
    putSessionBinding: (b) => world.baseWrite.putSessionBinding(b),
    putMemberInstance: (i) => world.baseWrite.putMemberInstance(i),
  }
  const out = await capture(() => binding.bindFreshTeamRoot(portsOf(world, writes), freshInput(world)))
  const expected = closedMessage('session_bindings', 'get')
  const stack = out.error?.stack ?? ''
  const pass =
    closed &&
    out.error?.message === expected &&
    out.error?.code === 'NOT_OPEN' &&
    stack.includes('putSessionBinding') &&
    stack.includes('bindFreshTeamRoot')
  record({
    id: 'E2',
    claim: 'a facility closeAll() at the boot #5 instant reproduces the observed message AND the observed stack frames',
    pass,
    expected,
    observed: {
      closed,
      code: out.error?.code ?? null,
      message: out.error?.message ?? null,
      stackHasPutSessionBinding: stack.includes('putSessionBinding'),
      stackHasBindFreshTeamRoot: stack.includes('bindFreshTeamRoot'),
      frames: stack
        .split('\n')
        .slice(0, 8)
        .map((line) => line.trim()),
    },
  })
  await destroyWorld(world)
}

// E2b — teardown one await earlier: mid createTeamDomain (native2 shape). ------
{
  const dir = join(SCRATCH, 'e2b-teardown-mid-create')
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const real = new FileStorageSeam(dir)
  let schemaReads = 0
  let closed = false
  const seam = fidelitySeam(real, async (table, op) => {
    if (table === 'schema_meta' && op === 'get') {
      schemaReads += 1
      // close BETWEEN a stamp's read and its write: the next touch of the
      // same store is the `put`, which is exactly native2's shape.
      if (schemaReads === 2 && !closed) {
        closed = true
        void real.closeAll()
      }
    }
  })
  const out = await capture(() => repos.createTeamDomain(seam))
  const expected = closedMessage('schema_meta', 'put')
  const pass = closed && out.error?.message === expected
  record({
    id: 'E2b',
    claim: 'the same teardown one await earlier (between a stamp read and its write) produces the SAME class with a DIFFERENT store/op — the native2 shape',
    pass,
    expected,
    observed: { closed, code: out.error?.code ?? null, message: out.error?.message ?? null, schemaReads },
  })
  rmSync(dir, { recursive: true, force: true })
}

// E3 — teardown one await later: after the binding write. ---------------------
{
  const world = await makeWorld('e3-teardown-after-binding')
  let closed = false
  const writes = {
    putTeamSession: (input) => world.baseWrite.putTeamSession(input),
    putSessionBinding: async (b) => {
      const row = await world.baseWrite.putSessionBinding(b)
      await world.seam.closeAll()
      closed = true
      return row
    },
    putMemberInstance: (i) => world.baseWrite.putMemberInstance(i),
  }
  const out = await capture(() => binding.bindFreshTeamRoot(portsOf(world, writes), freshInput(world)))
  const pass =
    closed &&
    out.error?.code === 'NOT_OPEN' &&
    /store 'member_instances' operation 'get' was rejected: the TeamDomain is closed/.test(out.error?.message ?? '')
  record({
    id: 'E3',
    claim: 'the same teardown one await later yields the SAME class with yet another store (member_instances) — store/op is a timing artifact',
    pass,
    expected: closedMessage('member_instances', 'get'),
    observed: { closed, code: out.error?.code ?? null, message: out.error?.message ?? null },
  })
  await destroyWorld(world)
}

// E7 — the EVIDENCE DRIVER's readiness race, end to end, host-free. ----------
//
// The p6t6 row registers `/__p6t6/health` only when the team bootstrap
// SETTLES (success -> ok:true, failure -> ok:false); while it is pending the
// route is a 404. The boot #5 driver probed ONCE and threw on a non-200
// (run-boot.mjs:938-941), then its `finally` tore the world down. This
// scenario replays exactly that sequence against the shipped product code and
// records what the operator would see.
{
  const world = await makeWorld('e7-driver-race')
  let release
  const pending = new Promise((resolve) => {
    release = resolve
  })
  const routes = { success: false, failure: false, setupError: null }
  const writes = {
    putTeamSession: async (input) => {
      const row = await world.baseWrite.putTeamSession(input)
      // the slow boot: the next await does not resume until the driver has
      // already probed and aborted (this is the 13.8 s window of boot #5).
      await pending
      return row
    },
    putSessionBinding: (b) => world.baseWrite.putSessionBinding(b),
    putMemberInstance: (i) => world.baseWrite.putMemberInstance(i),
  }
  const bindPromise = capture(() => binding.bindFreshTeamRoot(portsOf(world, writes), freshInput(world)))
  void bindPromise.then((out) => {
    if (out.error === undefined) {
      routes.success = true
    } else {
      routes.failure = true
      routes.setupError = out.error.message
    }
  })
  // let the bind reach the paused TeamSession put
  await new Promise((resolve) => setImmediate(resolve))
  // THE PROBE: p6t6's handler, verbatim in effect.
  const probe = () =>
    routes.success
      ? { status: 200, body: { ok: true, ready: true } }
      : routes.failure
        ? { status: 200, body: { ok: false, ready: false, setupError: routes.setupError } }
        : { status: 404, body: null }
  const first = probe()
  // THE ABORT: the driver's `throw` reaches its finally, which stops the
  // world; the shared storage-domain facility disposer runs closeAll().
  const aborted = first.status !== 200
  await world.seam.closeAll()
  release()
  const settled = await bindPromise
  const second = probe()
  const expected = closedMessage('session_bindings', 'get')
  const pass =
    aborted &&
    first.status === 404 &&
    first.body === null &&
    settled.error?.message === expected &&
    second.status === 200 &&
    second.body?.ok === false &&
    second.body?.setupError === expected
  record({
    id: 'E7',
    claim:
      'the boot #5 evidence artefacts are reproduced end to end by the driver race: health 404 while the bootstrap is PENDING, then (after the abort closes the shared domain) the masked TeamDomain-closed rejection and only THEN a health route',
    pass,
    expected: 'probe 404 -> abort -> masked closeAll rejection -> 200 {ok:false}',
    observed: {
      aborted,
      probeBeforeAbort: first,
      maskedError: settled.error?.message ?? null,
      probeAfterAbortStatus: second.status,
      probeAfterAbortOk: second.body?.ok ?? null,
      failureRouteRegisteredAtProbeTime: false,
    },
  })
  await destroyWorld(world)
}

// E7b — the CONTRAST that excludes "the bootstrap had already failed". --------
//
// If the team bootstrap had really failed before the probe (the composition-
// unwind or product-defect story), p6t6's failure route would already exist:
// the driver's single probe would have returned 200 {ok:false} and the run
// record would carry `health gate failed: status=200`, NOT a 404. Here the
// REAL bind path rejects before the probe (the write port fails with the
// product's own NOT-READY code); the probe then answers 200 {ok:false}.
{
  const world = await makeWorld('e7b-failed-before-probe')
  const routes = { success: false, failure: false, setupError: null }
  const failingPort = {
    putTeamSession: () => {
      const error = new Error('the production row bootstrap failed before the bind (stand-in)')
      error.code = 'TEAM_PLUGIN_NOT_READY'
      throw error
    },
    putSessionBinding: () => {
      throw new Error('unreachable')
    },
    putMemberInstance: () => {
      throw new Error('unreachable')
    },
  }
  const bindPromise = capture(() => binding.bindFreshTeamRoot(portsOf(world, failingPort), freshInput(world)))
  const settled = await bindPromise
  if (settled.error === undefined) routes.success = true
  else {
    routes.failure = true
    routes.setupError = settled.error.message
  }
  const probe = routes.success
    ? { status: 200, body: { ok: true } }
    : routes.failure
      ? { status: 200, body: { ok: false, ready: false, setupError: routes.setupError } }
      : { status: 404, body: null }
  const pass = probe.status === 200 && probe.body?.ok === false && probe.body?.setupError === settled.error?.message
  record({
    id: 'E7b',
    claim:
      "a bootstrap that fails BEFORE the probe yields 200 {ok:false}, never 404 — so boot #5's 404 proves the bootstrap had not failed at probe time",
    pass,
    expected: '200 {ok:false, setupError: <the real rejection>}',
    observed: { probe, bindError: settled.error?.message ?? null },
  })
  await destroyWorld(world)
}

// E5a — create on a stamped medium is a PREDICTABLE pre-start class. ----------
{
  const dir = join(SCRATCH, 'e5a-create-stamped')
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const first = new FileStorageSeam(dir)
  const firstDomain = await repos.createTeamDomain(first)
  await firstDomain.close()
  const second = new FileStorageSeam(dir)
  const out = await capture(() => repos.createTeamDomain(second))
  const pass = out.error?.code === 'TEAM_DOMAIN_EXISTS'
  record({
    id: 'E5a',
    claim: 'bootPhase "create" on a stamped medium fails deterministically with TEAM_DOMAIN_EXISTS (predictable before a start)',
    pass,
    expected: 'TEAM_DOMAIN_EXISTS',
    observed: { code: out.error?.code ?? null, message: out.error?.message ?? null },
  })
  rmSync(dir, { recursive: true, force: true })
}

// E5b — load/resume on a fresh medium is a PREDICTABLE pre-start class. --------
{
  const dir = join(SCRATCH, 'e5b-open-fresh')
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const seam = new FileStorageSeam(dir)
  const out = await capture(() => repos.openTeamDomain(seam))
  const pass =
    out.error?.code === 'SCHEMA_STAMP_MISSING' ||
    /schema_meta stamp for store 'team_sessions' is missing/.test(out.error?.message ?? '') ||
    /SCHEMA_STAMP_MISSING/.test(out.error?.message ?? '')
  record({
    id: 'E5b',
    claim: 'load/resume on a fresh medium fails deterministically with a schema-stamp failure (predictable before a start)',
    pass,
    expected: 'SCHEMA_STAMP_MISSING (the first missing baseline stamp)',
    observed: { code: out.error?.code ?? null, message: out.error?.message ?? null },
  })
  rmSync(dir, { recursive: true, force: true })
}

// E6 — the instrument caveat: the test-only in-memory fake conflates
// "never opened" with "closed"; the file seam and the production seam do not.
{
  const dir = join(SCRATCH, 'e6-never-opened')
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const seam = new FileStorageSeam(dir)
  // A never-opened domain cannot even yield a handle: open() succeeds and
  // creates the medium (no 'closed'). There is no handle to call table() on.
  const opened = await capture(() => seam.open({ name: 'team_domain', version: 2, tables: ['schema_meta'] }))
  const pass = opened.error === undefined && opened.value?.name === 'team_domain'
  record({
    id: 'E6',
    claim: 'a never-opened domain is not a closed domain on the production/filed seam (open succeeds); only the test-only in-memory fake treats "not open" as closed (instrument hazard, p4-helpers.ts:243)',
    pass,
    expected: 'open() resolves on a fresh medium; no closed error',
    observed: { error: opened.error ?? null, name: opened.value?.name ?? null },
  })
  rmSync(dir, { recursive: true, force: true })
}

// --- the record --------------------------------------------------------------

const summary = {
  schema: 'a5sf-domain-attrib/1',
  at: new Date().toISOString(),
  hostFree: true,
  hostStarts: 0,
  ports: 0,
  dshHome: null,
  boot5Payload: {
    rootSessionId: BOOT5.rootSessionId,
    generation: BOOT5.generation,
    blueprint: 'blueprint-anchor-boot5.yaml (verbatim from evidence/a5sf-bl18-live2 composed profile)',
  },
  total: results.length,
  pass: results.filter((r) => r.pass).length,
  fail: results.filter((r) => !r.pass).length,
  results,
}
writeFileSync(join(HERE, 'domain-attrib.json'), `${JSON.stringify(summary, null, 2)}\n`)
rmSync(SCRATCH, { recursive: true, force: true })
console.log(`\n${summary.pass}/${summary.total} expectations hold (host-free, 0 starts)`)
if (summary.fail > 0) process.exitCode = 1
