#!/usr/bin/env node
/**
 * A5M2-G3A contract-layer verification driver (center 卡: G3A 生产事实验证, 9c-precheck 同形).
 *
 * OFFLINE machine verification of the MERGED G3A production facts against the
 * BUILT artifacts of THIS tree (the committed install surface + the pristine
 * built host lib). NO Host, NO ports, NO tests/homes: every live seam is a
 * declared CANNED transport — this is explicitly NOT a Host round (tier stays
 * 接线未测; this driver proves contract/closure, not deployment).
 *
 * Sections:
 *  (a) B-TERMINAL closed variant table, imported from the BUILT
 *      packages/runtime/dist/packages/runtime/control/types.js. Three
 *      assertions, each printing its own verdict:
 *        A1 叶集合无漂移      - minted flat views (BUILT a5G3PaTargetFlat over
 *                              canned CLASSIFY manifests) match the table's
 *                              required ∪ per-operation adds EXACTLY, both
 *                              directions, all six operations.
 *        A2 binds 钉合逐字     - variant.leaf === 'operation'; every binds map
 *                              deep-equals the frozen {} as signed; every
 *                              minted leaf satisfies its table kind through a
 *                              CLOSED kind->checker map (unknown kind = drift).
 *        A3 mint 复现深相等    - a5G3PaTargetFlat(f) deep-equals itself
 *                              (determinism incl. the reviewed canonical-JSON
 *                              encoding: unsorted fixtures land sorted), the
 *                              view is frozen, the BUILT validatePaFamilyTarget
 *                              ACCEPTS all six real mints and REFUSES the
 *                              paired negatives (extra leaf named, nested
 *                              object leaf named) with a non-empty refusal.
 *      Constants are IMPORTED from the built modules (防记忆漂移); the canned
 *      manifests and the tool->operation mapping are transport fixtures,
 *      declared as such (the mapping is the lane's signed pairing).
 *  (b) Jobs existing face: the BUILT pristine host lib (tests/paths.mjs pin)
 *      exports JobRegistry (abstract); its TYPED contract is machine-read from
 *      the built types/index.d.ts (start/kill signatures + the return-union,
 *      never hand-typed), exercised through a canned subclass (canned
 *      transport), and the lane consumer side is checked on the BUILT dist
 *      mirror (typed refusal codes imported from the built adapter constants;
 *      the forwarder census {start,kill} + owner-fk refusal anchor-matched on
 *      the built bytes). NAMED GAP (disclosed, not a problem): the concrete
 *      host JobRegistry implementation is NOT exported by the built lib
 *      (tests/deepseek-harness-test-use/packages/jobs/jobs/lib/index.js
 *      exports only {JobId, JobRegistry, default}); the live durable registry
 *      exists only on a running Host, so the durable READ side is not
 *      reachable offline — reported per the card's gap clause.
 *  (c) any drift -> problems[] printed non-empty, exit code != 0.
 *      G3A_PRECHECK_SELFTEST=1 injects ONE named leaf drift to prove this path.
 *
 * Run: node tests/checks/a5m2-g3a-contract-precheck.mjs          (RC=0 expected)
 *      G3A_PRECHECK_SELFTEST=1 node tests/checks/a5m2-g3a-contract-precheck.mjs  (RC=1 expected)
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { deepStrictEqual, strictEqual } from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

const ROOT = new URL('../../', import.meta.url)
const problems = []
const verdicts = []
const check = (id, fn) => {
  try {
    fn()
    verdicts.push(`${id}=PASS`)
  } catch (error) {
    const why = String(error?.message ?? error).split('\n')[0].slice(0, 200)
    problems.push({ id, why })
    verdicts.push(`${id}=FAIL(${why})`)
  }
}

const DIST = (rel) => new URL(`packages/runtime/dist/${rel}`, ROOT).href

const types = await import(DIST('packages/runtime/control/types.js'))
const wiring = await import(DIST('packages/runtime/src/plugin/live/governed-families/g3-terminal-wiring.mjs'))
const adapters = await import(DIST('packages/runtime/src/plugin/live/governed-families/g3-fsproc-adapters.mjs'))
const paths = await import(new URL('tests/paths.mjs', ROOT).href)
const TEST_USE = typeof paths.TEST_USE_REL === 'string'
  ? fileURLToPath(new URL(`${paths.TEST_USE_REL}/`, ROOT))
  : (paths.TEST_USE_PATH ?? paths.TEST_USE ?? paths.default?.TEST_USE_PATH ?? null)
if (typeof TEST_USE !== 'string' || TEST_USE.length === 0) {
  problems.push({ id: 'paths.TEST_USE', why: 'tests/paths.mjs exports no pristine test-use root (cannot locate the built host jobs lib)' })
}

/* ---------------- (a) B-TERMINAL closed table ---------------- */
const TABLE = types.PA_FAMILY_TARGET_RULES?.['B-TERMINAL']
const flat = wiring.a5G3PaTargetFlat
const TOOL_NAMES = wiring.A5_G3_TERMINAL_TOOL_NAMES
if (!TABLE || typeof flat !== 'function' || !Array.isArray(TOOL_NAMES)) {
  problems.push({ id: 'imports', why: 'built B-TERMINAL table / a5G3PaTargetFlat / A5_G3_TERMINAL_TOOL_NAMES missing' })
}

// lane-signed tool -> operation pairing (transport fixture; the table speaks
// operations, the placement speaks tool names; both ends are machine-checked
// against the built artifacts: six names, six table groups, no extras).
const TOOL_TO_OPERATION = {
  terminal_open: 'pty-spawn',
  terminal_send: 'stdin-write',
  terminal_read: 'output-read',
  terminal_signal: 'signal',
  terminal_close: 'close',
  terminal_list: 'list',
}

const BASE_IDENTITY = {
  toolName: 'terminal_open',
  realmId: 'a5-realm-precheck',
  agentId: 's-precheck:agent-member-1',
  sessionHeaderId: 's-precheck',
  paramFingerprint: 'fp-precheck',
}

const MINT_FIXTURES = {
  'pty-spawn': {
    operation: 'pty-spawn',
    ...BASE_IDENTITY,
    backendTarget: {
      publicType: 'host-terminal-bash',
      serviceRegistrationId: 'reg-1',
      serviceIncarnation: 'inc-1',
      processEnvelope: { z: 1, a: { y: [3, 2], b: 'x' } }, // deliberately unsorted: canonicalization must pin it
    },
    perOpenBackend: {
      envelopeDigest: 'sha256:precheck',
      approvedPlan: {
        argv: ['/bin/sh', '-c', 'true'], executable: '/bin/sh', argv0: null,
        cwd: '/srv/precheck', rows: 50, cols: 120, graceMs: 5000, env: { Z: '1', A: '2' },
      },
    },
    perOpenCorrelationCallId: 'call-precheck-open',
  },
  'stdin-write': {
    operation: 'stdin-write',
    ...BASE_IDENTITY, toolName: 'terminal_send',
    ptyTarget: { sessionId: 'pty-precheck', serviceIncarnation: 'inc-2' },
    effectiveSubmit: true, background: false, inputDigest: 'sha256:in', inputBytes: 3,
  },
  'output-read': {
    operation: 'output-read',
    ...BASE_IDENTITY, toolName: 'terminal_read',
    ptyTarget: { sessionId: 'pty-precheck', serviceIncarnation: 'inc-2' },
    offset: { kind: 'from-end', n: 0 }, count: null,
  },
  signal: {
    operation: 'signal',
    ...BASE_IDENTITY, toolName: 'terminal_signal',
    ptyTarget: { sessionId: 'pty-precheck', serviceIncarnation: 'inc-2' },
    signal: adapters.A5_G3_TERMINAL_SIGNALS[1],
  },
  close: {
    operation: 'close',
    ...BASE_IDENTITY, toolName: 'terminal_close',
    ptyTarget: { sessionId: 'pty-precheck', serviceIncarnation: 'inc-2' },
    settlementEvidence: 'graceful',
  },
  list: { operation: 'list', ...BASE_IDENTITY, toolName: 'terminal_list' },
}

const SELFTEST = process.env.G3A_PRECHECK_SELFTEST === '1'

check('a0.table-shape', () => {
  strictEqual(TABLE.variant.leaf, 'operation', 'variant leaf must stay the signed discriminator')
  strictEqual(Object.keys(TABLE.variant.by).length, 6, 'six operation groups')
  strictEqual(TOOL_NAMES.length, 6, 'six tool names')
  for (const name of TOOL_NAMES) {
    strictEqual(typeof TOOL_TO_OPERATION[name], 'string', `no operation pairing for ${name}`)
    if (!TABLE.variant.by[TOOL_TO_OPERATION[name]]) throw new Error(`table answers no group for ${name} -> ${TOOL_TO_OPERATION[name]}`)
  }
  for (const op of Object.keys(TABLE.variant.by)) {
    for (const leaf of Object.keys(TABLE.variant.by[op].adds)) {
      if (leaf in TABLE.required) throw new Error(`${op}.adds redeclares required leaf ${leaf} (one leaf, one law)`)
    }
  }
})

const mints = {}
for (const [op, fixture] of Object.entries(MINT_FIXTURES)) {
  let mint = flat(fixture)
  if (SELFTEST && op === 'stdin-write') {
    mint = { ...mint }
    delete mint.inputDigest // the injected, named drift (proves section (c))
  }
  mints[op] = mint
}

check('A1.leaf-set-no-drift', () => {
  for (const [op, mint] of Object.entries(mints)) {
    const want = new Set([...Object.keys(TABLE.required), ...Object.keys(TABLE.variant.by[op].adds)])
    const got = Object.keys(mint)
    const missing = [...want].filter((k) => !got.includes(k))
    const extra = got.filter((k) => !want.has(k))
    if (missing.length > 0 || extra.length > 0) {
      throw new Error(`${op}: drift missing=[${missing}] extra=[${extra}]`)
    }
  }
})

const KIND_CHECKS = {
  string: (v) => typeof v === 'string' && v.length > 0,
  nonNegativeInt: (v) => Number.isInteger(v) && v >= 0,
  boolean: (v) => typeof v === 'boolean',
}

// the binds pinned AS SIGNED (root 20:38 闭表): five operations carry the
// empty binding, list carries the owner-scoping fact verbatim.
const BINDS_PIN = {
  'pty-spawn': {},
  'stdin-write': {},
  'output-read': {},
  signal: {},
  close: {},
  list: { ownerScoped: true },
}

check('A2.binds-pinned-verbatim', () => {
  for (const [op, group] of Object.entries(TABLE.variant.by)) {
    deepStrictEqual({ ...group.binds }, BINDS_PIN[op], `${op}.binds must deep-equal the signed pin verbatim`)
    strictEqual(Object.isFrozen(group.binds), true, `${op}.binds must be frozen`)
    for (const [leaf, kind] of Object.entries({ ...TABLE.required, ...group.adds })) {
      const probe = KIND_CHECKS[kind]
      if (probe === undefined) throw new Error(`${op}.${leaf}: table kind '${kind}' is outside the closed checker set (table drifted kinds)`)
      if (!probe(mints[op][leaf])) throw new Error(`${op}.${leaf}: minted value violates its table kind '${kind}'`)
    }
  }
})

check('A3.mint-repro-deep-equal', () => {
  for (const [op, fixture] of Object.entries(MINT_FIXTURES)) {
    deepStrictEqual(flat(fixture), mints[op], `${op}: a second mint of the SAME fixture must deep-equal`)
    if (!SELFTEST || op !== 'stdin-write') strictEqual(Object.isFrozen(flat(fixture)), true, `${op}: flat view must come back frozen`)
  }
  // the reviewed encoding pins canonicalization: unsorted fixture -> sorted canonical leaf
  strictEqual(mints['pty-spawn'].processEnvelopeJson, '{"a":{"b":"x","y":[3,2]},"z":1}', 'canonical JSON drift (sorted keys, arrays order-preserved)')
  strictEqual(mints['pty-spawn'].planArgv0Json, 'absent', 'null leaf lands the sanctioned \'absent\' word')
  const validate = types.validatePaFamilyTarget
  for (const [op, mint] of Object.entries(mints)) {
    const answer = validate('B-TERMINAL', mint)
    if (answer !== undefined) throw new Error(`${op}: the REAL validator refuses its own table mint - ${String(answer)}`)
  }
  const extraLeaf = validate('B-TERMINAL', { ...mints.signal, signalName: 'SIGTERM', smuggledLeaf: 'x' })
  if (typeof extraLeaf !== 'string' || !extraLeaf.includes('smuggledLeaf')) throw new Error(`extra-leaf negative must name the smuggled key, got ${JSON.stringify(extraLeaf)}`)
  const nested = validate('B-TERMINAL', { ...mints['pty-spawn'], processEnvelopeJson: { nested: true } })
  if (typeof nested !== 'string' || !nested.includes('processEnvelopeJson')) throw new Error(`nested-shape negative must name the violating leaf, got ${JSON.stringify(nested)}`)
})

/* ---------------- (b) Jobs existing face ---------------- */
const KILL_UNION_FALLBACK = null
let killUnion = KILL_UNION_FALLBACK
let typedContract = null
if (TEST_USE !== null) {
  const dts = `${TEST_USE}/packages/jobs/jobs/lib/types/index.d.ts`
  try {
    const text = readFileSync(dts, 'utf8')
    const kill = /kill\(\s*id:\s*JobId\s*,\s*caller\?\:\s*SessionId\s*,\s*reason\?\:\s*string\s*\)\s*:\s*([^\n;]+)[;\n]/.exec(text)
    const start = /start\(\s*spec:\s*JobSpec\s*\)\s*:\s*JobId/.test(text)
    typedContract = { start, killReturnRaw: kill?.[1] ?? null }
    if (kill?.[1] !== undefined) {
      killUnion = kill[1].match(/'([^']+)'/g)?.map((s) => s.replace(/'/g, '')) ?? null
    }
  } catch (error) {
    problems.push({ id: 'b.jobs.dts', why: `built host jobs typed face unreadable at ${dts}: ${String(error?.message ?? error).slice(0, 120)}` })
  }
}

const hostJobs = TEST_USE === null ? null : await import(new URL(`file://${TEST_USE}/packages/jobs/jobs/lib/index.js`)).catch(() => null)

check('b1.host-lib-surface', () => {
  if (hostJobs === null) throw new Error('built host jobs lib (tests/deepseek-harness-test-use/packages/jobs/jobs/lib/index.js) not importable')
  strictEqual(typeof hostJobs.JobRegistry, 'function', 'built lib must export JobRegistry')
  if (typedContract?.start !== true) throw new Error('built typed face does not pin start(spec: JobSpec): JobId as the lane consumer assumes')
  if (typedContract?.killReturnRaw == null) throw new Error('built typed face does not answer the kill(...) return union')
})

check('b2.typed-codes-census', () => {
  const union = killUnion
  if (!Array.isArray(union) || union.length !== 2) throw new Error(`kill union machine-read failed, got ${JSON.stringify(union)}`)
  deepStrictEqual([...union].sort(), ['already-finished', 'requested'], 'the signed kill-answer census drifted')
  // canned subclass over the BUILT abstract class: the built JobRegistry is a
  // Service (constructor takes the host ctx, wires the archive-admission hook
  // through ctx.on). The canned world answers that ctx with a total stub —
  // declared canned transport, the registry METHODS below are the fact tested.
  const deepStub = () => new Proxy(function () {}, {
    get: (_t, p) => (p === Symbol.toPrimitive ? () => 'stub' : deepStub()),
    apply: () => deepStub(),
  })
  class CannedRegistry extends hostJobs.JobRegistry {
    #jobs = new Map()
    #seq = 0
    constructor() { super(deepStub()) }
    start(spec) {
      if (typeof spec?.kind !== 'string' || typeof spec?.owner !== 'string') throw new Error('canned: JobSpec.kind/owner required')
      const id = `job-precheck-${String(++this.#seq)}`
      this.#jobs.set(id, { owner: spec.owner, finished: false })
      return id
    }
    kill(id, caller, reason) {
      const job = this.#jobs.get(id)
      if (job === undefined || job.finished) return 'already-finished'
      if (caller !== undefined && caller !== job.owner) return 'already-finished' // owner-checked: never claim a foreign job
      job.finished = true
      void reason
      return 'requested'
    }
  }
  const registry = new CannedRegistry()
  const id = registry.start({ kind: 'pty-send', owner: 's-precheck' })
  strictEqual(registry.kill(id, 's-somebody-else'), 'already-finished', 'wrong owner must never get the job')
  strictEqual(registry.kill(id, 's-precheck', 'cancelled after the background send started'), 'requested', 'owner kill answers the signed word')
  strictEqual(registry.kill(id, 's-precheck'), 'already-finished', 'finished job answers the signed word')
})

check('b3.lane-consumer-fk-closure', () => {
  // the lane's typed refusal codes come from the BUILT adapter constant, and
  // the built control-port bytes must actually route through them.
  strictEqual(adapters.A5_G3_TERMINAL_TYPED_CODES.BG_PORT_UNWIRED, 'P_TERM_BG_PORT_UNWIRED', 'built constant drift')
  const portBytes = readFileSync(fileURLToPath(new URL('packages/runtime/src/plugin/live/governed-families/g3-fsproc-adapters.mjs', ROOT)), 'utf8')
  if (!/code:\s*'P_TERM_BG_PORT_UNWIRED'/.test(portBytes)) throw new Error('built adapter source no longer carries the jobs-absent typed refusal')
  if (!/code:\s*'P_TERM_BG_OWNER_UNRESOLVED'/.test(portBytes)) throw new Error('built adapter source no longer carries the owner foreign-key refusal (JobSpec.owner is never omitted)')
  // the mount-side forwarder census {start,kill} rides the BUILT agent-bindings mirror
  const bindings = readFileSync(fileURLToPath(new URL('packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs', ROOT)), 'utf8')
  if (!bindings.includes('g3ReadJobsRegistry')) throw new Error('built agent-bindings mirror lost the g3ReadJobsRegistry validation face')
  if (!/Object\.freeze\(\{\s*start:/.test(bindings) || !/kill:\s*\(id,\s*caller,\s*reason\)/.test(bindings)) {
    throw new Error('built agent-bindings mirror no longer assembles the live {start,kill} forwarder with the reason-carrying kill')
  }
  // named gap (disclosed, NOT a problem): no concrete JobRegistry export on the
  // built lib - the durable live read exists only on a running Host.
  if ('LocalJobsRegistry' in hostJobs) problems.push({ id: 'b.gap-disclosure-stale', why: 'built lib NOW exports a concrete registry - update the driver to read it live' })
})

/* ---------------- (c) verdict ---------------- */
console.log(verdicts.join('\n'))
if (problems.length > 0) {
  console.log(JSON.stringify({ ok: false, problems }, null, 2))
  process.exit(1)
}
const digest = createHash('sha256').update(verdicts.join('|')).digest('hex').slice(0, 16)
console.log(JSON.stringify({ ok: true, checks: verdicts.length, digest, cannedTransport: true, hostRun: false }))
process.exit(0)
