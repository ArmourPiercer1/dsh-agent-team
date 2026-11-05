/**
 * a5sf-dual-plane.test.mjs — BL-33 / P4-05A C1: the SAME-CALL three-way proof.
 *
 * ZERO Host boots, ZERO ports, no DSH_HOME, no pristine-host tree. For every case
 * this suite builds one real Cordis unit root over a real `node:fs` Provider
 * double, mounts the REAL product realm (`a5sfRealmConfigOf` →
 * `mountMemberA5sfRealm` → `installMemberIoProviders` / `installToolBindingRealm`),
 * makes ONE Provider call, and compares:
 *
 *   plane 1  the SHIPPED pre-Alpha.5 permission plane
 *            (`resolveOperationPermission` over `canonicalizeOperation`), via
 *            `lib/a5sf-dual-plane.mjs#decideLegacy`;
 *   plane 2  the observed `a5sf-guard-consult/1` fact the confined Provider's
 *            guard wrote BEFORE delegating (the REAL admission decision, not a
 *            projection) — plus the effect: the base Provider ran or did not;
 *   plane 3  the independent derivation in `lib/a5sf-dual-plane-oracle.mjs`,
 *            which imports neither plane.
 *
 * WHAT THE ARMS PROVE:
 *   DP1-…  every case in the declared case space: the three decisions and the
 *          verdict match the reviewed table; the guard fact is real (schema,
 *          realm, binding identity, method, locator, decidedBy) and the effect
 *          follows plane 2; both deliverables (allow) and refusals (deny/ask)
 *          are exercised.
 *   DP-SUM  the three-way table counts, the overall verdict, and the rule that
 *          every DECLARED exception was exercised at least once. A5-DUAL-PLANE-01
 *          (2026-11-05) adds: `ask` must now APPEAR in the admitted-decision
 *          table (it was 0 before the fix) and both axes × both realms must
 *          produce a refused ask call.
 *   DP-REFUSE the typed refusal of the ask lane: exactly ONE guard fact with
 *          `decision: 'ask'` / `decidedBy: 'IO_ASK_REQUIRES_APPROVAL'`, zero
 *          bytes through the base Provider, zero writes, unchanged bytes on
 *          disk, and no over-refusal (allow still allows, deny keeps its code).
 *   DP-PROJ the REAL product projection (`a5sfRealmConfigOf` →
 *          `createProductRealmProvider`) still CARRIES the ask locator in the
 *          lane the guard consumes — measured, because this vertical already
 *          shipped a projector that flattened a rule set and dropped a lane.
 *   MUT-1/2 a ceiling mutated in the fixture (widened / narrowed) flips ONLY
 *           plane 2, and the harness reports DISAGREE with plane 2 as the
 *           outlier — the comparison cannot pass vacuously, and the fact really
 *           is the consulted decision.
 *   MUT-3   the same triple a named exception excuses, produced WITHOUT the case
 *           declaring it, is a DISAGREE: the exception registry is not amnesty.
 *   MUT-4   deleting the oracle's write⇒read step flips the oracle alone: the
 *           oracle step is load-bearing.
 *   MUT-5   treating the read-only binding as if it bound a member-realm write
 *           flips the oracle alone: the 2026-11-04 ruling is encoded, not ignored.
 *   B2      the double-authority guard: a declaration wider than the bound
 *           blueprint refuses `REALM_DECLARATION_EXCEEDS_BLUEPRINT` before any
 *           realm exists; a narrowing declaration still mounts (PA9 owns the full
 *           matrix; this arm pins the seam in THIS evidence set).
 *   FENCE   the oracle's source imports only `node:` modules and names neither
 *           plane's symbols — its independence is structural.
 *
 * Run: node --test tests/world-factory/a5sf-dual-plane.test.mjs
 *
 * @module tests/world-factory/a5sf-dual-plane.test
 */
import assert from 'node:assert/strict'
import { readFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, linkSync, writeFileSync, existsSync, realpathSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative } from 'node:path'
import test, { after } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..')

/** The repo's EXISTING TS-under-plain-node hooks (no new loader). */
register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)

// The dual-plane lib imports the SHIPPED TypeScript permission modules, so it is
// loaded AFTER the hook registration (a static import would resolve too early).
const {
  DUAL_PLANE_CASES,
  EXCEPTIONS,
  caseExceptionIds,
  compareThreeWay,
  decideLegacy,
  laneToV4,
  materializeCase,
  renderTable,
  summarize,
} = await import(pathToFileURL(join(HERE, 'lib', 'a5sf-dual-plane.mjs')).href)
const { deriveOracleDecision } = await import(pathToFileURL(join(HERE, 'lib', 'a5sf-dual-plane-oracle.mjs')).href)

const row = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href)
const assembly = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'product-assembly.ts')).href)
const transports = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'guard-observability.ts')).href)
const runtimeRequire = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
const { Context, Service } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)

/** Boundary-aware containment over two canonical paths (the A5 adapter's seam). */
function testContains(parent, child) {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

const TEAM = 'team.a5sf.bl33'
const BINDING_TOOL = { read: 'dsh.fs/read', write: 'dsh.fs/write' }
const TEMPLATE = 'worker'

// --- the base Provider double ------------------------------------------------

/** Per-call counters: the effect oracle ("did the base Provider run?"). */
const providerCalls = { read: 0, write: 0 }

/** A real Cordis Service over node:fs (unit-world double, no Host). */
class TestFileSystem extends Service {
  constructor(ctx, config = {}) {
    super(ctx, 'fs')
    this.config = config
  }

  processPath(target) {
    return target.hostPath
  }

  /** Boundary-aware containment over the Provider's own path strings. */
  contains(parent, child) {
    const rel = relative(this.processPath(parent), this.processPath(child))
    return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
  }

  async resolve(path) {
    return { hostPath: path }
  }

  async readText(target) {
    providerCalls.read += 1
    return readFileSync(this.processPath(target), 'utf8')
  }

  async streamText(target) {
    const text = await this.readText(target)
    return (async function* stream() {
      yield text
    })()
  }

  async readBytes(target) {
    providerCalls.read += 1
    return readFileSync(this.processPath(target))
  }

  async readByteRange(target, range) {
    providerCalls.read += 1
    return readFileSync(this.processPath(target)).subarray(range.offset, range.offset + range.length)
  }

  async listDir() {
    return []
  }

  async stat() {
    return { lstat: { size: 0, mtimeMs: 0, mode: 0o644 } }
  }

  async lstat() {
    return { size: 0, mtimeMs: 0, mode: 0o644 }
  }

  async watch() {
    return async () => {}
  }

  async writeText(target, content) {
    providerCalls.write += 1
    writeFileSync(this.processPath(target), content, 'utf8')
    return { version: 'v1' }
  }

  async editText() {
    providerCalls.write += 1
    return { version: 'v2' }
  }
}

// --- fixture world -----------------------------------------------------------

const FIXTURES = []
after(() => {
  for (const dir of FIXTURES.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/**
 * One fixture root per case. The shape is FIXED (all cases share it) so the
 * case table's targets are readable and no case can silently depend on another
 * case's leftovers:
 *
 *   lane/inside/ok.txt        OK            lane/other/other.txt   OTHER
 *   lane/inside/ask.txt       ASK           lane/blocked/deny.txt  DENY
 *   lane/inside/askdir/deep/ask.txt ASK-DEEP  (ask on a NARROWER subtree)
 *   lane/inside/alias.txt     HARDLINK → outside/secret.txt
 *   lane/inside/link-in       SYMLINK  → lane/inside/ok.txt
 *   lane/inside/link-ask      SYMLINK  → lane/inside/ask.txt
 *   lane/inside/leaf-out      SYMLINK  → outside/secret.txt
 *   lane/inside/dangling      SYMLINK  → lane/inside/absent
 *   lane/escape               SYMLINK  → outside          (parent symlink)
 *   outside/secret.txt        SECRET
 */
function buildFixture(base) {
  for (const sub of ['lane/inside', 'lane/inside/askdir/deep', 'lane/other', 'lane/blocked', 'lane/new', 'outside']) {
    mkdirSync(join(base, sub), { recursive: true })
  }
  writeFileSync(join(base, 'lane/inside/ok.txt'), 'OK\n', 'utf8')
  writeFileSync(join(base, 'lane/inside/ask.txt'), 'ASK\n', 'utf8')
  writeFileSync(join(base, 'lane/inside/askdir/deep/ask.txt'), 'ASK-DEEP\n', 'utf8')
  writeFileSync(join(base, 'lane/other/other.txt'), 'OTHER\n', 'utf8')
  writeFileSync(join(base, 'lane/blocked/deny.txt'), 'DENY\n', 'utf8')
  writeFileSync(join(base, 'outside/secret.txt'), 'SECRET\n', 'utf8')
  linkSync(join(base, 'outside/secret.txt'), join(base, 'lane/inside/alias.txt'))
  symlinkSync(join(base, 'lane/inside/ok.txt'), join(base, 'lane/inside/link-in'))
  symlinkSync(join(base, 'lane/inside/ask.txt'), join(base, 'lane/inside/link-ask'))
  symlinkSync(join(base, 'outside/secret.txt'), join(base, 'lane/inside/leaf-out'))
  symlinkSync(join(base, 'lane/inside/absent'), join(base, 'lane/inside/dangling'))
  symlinkSync(join(base, 'outside'), join(base, 'lane/escape'))
}

// --- the real admission path -------------------------------------------------

function laneV4(value) {
  return laneToV4(value)
}

function declarationFor(materialized) {
  const member = {
    templateId: TEMPLATE,
    instanceGeneration: 1,
    ceiling: {
      read: laneV4(materialized.ceiling.read),
      write: laneV4(materialized.ceiling.write),
      network: { mode: 'allow' },
    },
    ...(materialized.restriction === undefined
      ? {}
      : {
          toolRestrictions: [
            {
              owner: 'dsh.fs',
              name: materialized.restriction.tool,
              authorization: 'allow',
              io: {
                read: laneV4(materialized.restriction.read),
                write: laneV4(materialized.restriction.write),
                network: { mode: 'allow' },
              },
              execution: { implementationOrigin: 'dsh-native', executionBoundary: 'trusted-host' },
            },
          ],
        }),
  }
  return {
    schema: assembly.A5SF_PRODUCT_REALM_SCHEMA,
    teamId: TEAM,
    blueprintRevision: '1',
    authority: { revision: 'a4:bl33:1', admitted: true },
    members: [member],
  }
}

/**
 * Mount the REAL product realm for one case, make the ONE call, and return the
 * observed guard fact + effect. Nothing here fabricates the decision: the fact
 * is written by `guard-observability.ts` inside the confined Provider, and the
 * base-Provider counters say whether the call really reached the effect.
 *
 * @param {object} input
 * @param {object} input.materialized the case whose declaration is mounted
 * @param {string} input.sinkPath the guard-consult JSONL path
 * @param {string} input.target the locator the call asks about
 * @returns {Promise<object>}
 */
async function runAdmission({ materialized, sinkPath, target }) {
  const root = new Context()
  await root.plugin(TestFileSystem, {})
  const base = root.get('fs')
  const config = row.a5sfRealmConfigOf({
    a5sfMemberPolicies: declarationFor(materialized),
    a5sfEvidencePath: sinkPath,
  })
  const realm = await row.mountMemberA5sfRealm({
    root,
    a5sfConfig: config,
    provider: () => undefined,
    member: {
      sessionId: 'session-bl33',
      instanceId: 'mi-bl33',
      teamRootSessionId: 'session-root-bl33',
      templateId: TEMPLATE,
      bindPath: 'fresh-member',
    },
  })
  assert.notEqual(realm, undefined, 'the declaration must mount a realm')

  let fs
  if (materialized.realm === 'binding') {
    const bindingIdentity = BINDING_TOOL[materialized.axis]
    const binding = realm.bindings.find((entry) => entry.toolBindingIdentity === bindingIdentity)
    assert.notEqual(binding, undefined, `the binding realm '${bindingIdentity}' must be mounted`)
    fs = binding.fs
  } else {
    fs = realm.installation.members[0].fs
  }

  providerCalls.read = 0
  providerCalls.write = 0
  let result
  let error
  try {
    const resolved = await fs.resolve(target)
    result = materialized.axis === 'read'
      ? await fs.readText(resolved)
      : await fs.writeText(resolved, materialized.content)
  } catch (caught) {
    error = caught
  }

  const facts = await transports.readGuardConsultFile(sinkPath)
  return { root, base, realm, fs, result, error, facts, calls: { ...providerCalls } }
}

// --- one case -> one three-way result ---------------------------------------

/** The exact fixture target's content before the call (for write-change checks). */
function beforeOf(target) {
  if (!existsSync(target)) return undefined
  return readFileSync(realpathSync(target), 'utf8')
}

async function evaluateCase(spec) {
  const base = mkdtempSync(join(tmpdir(), `a5sf-bl33-${spec.id}-`))
  FIXTURES.push(base)
  buildFixture(base)
  const materialized = materializeCase(spec, base)
  const target = materialized.target
  const before = beforeOf(target)
  const sinkPath = join(base, 'consult.jsonl')

  const admission = await runAdmission({ materialized, sinkPath, target })
  try {
    assert.equal(admission.facts.length, 1, 'exactly ONE guard consultation per call (no double consultation)')
    const fact = admission.facts[0]
    assert.equal(fact.schema, 'a5sf-guard-consult/1')
    assert.equal(fact.realm, materialized.realm, 'the fact came from the realm the product mounted')
    assert.equal(
      fact.toolBindingIdentity,
      materialized.realm === 'binding' ? BINDING_TOOL[materialized.axis] : null,
      'the binding realm carries its identity; the Member realm carries null',
    )
    assert.equal(fact.method, materialized.axis === 'read' ? 'readText' : 'writeText')
    assert.equal(fact.locator, target, 'the fact names the authored locator the Provider was asked about')
    assert.equal(fact.policyRevision.startsWith('a5sf1:'), true, 'the fact carries the compiled policy revision')
    assert.equal(fact.memberIdentity, 'mi-bl33')

    // The EFFECT follows plane 2: allow => the base Provider ran; ask/deny => it did not.
    if (fact.decision === 'allow') {
      assert.equal(admission.error, undefined, 'an admitted call does not throw')
      if (materialized.axis === 'read') {
        assert.equal(typeof admission.result, 'string')
        assert.equal(admission.calls.read, 1, 'the base Provider really served the read')
      } else {
        assert.equal(admission.calls.write, 1, 'the base Provider really served the write')
        assert.equal(readFileSync(realpathSync(target), 'utf8'), materialized.content)
      }
    } else {
      assert.notEqual(admission.error, undefined, 'a refused call throws')
      assert.equal(admission.calls.read, 0)
      assert.equal(admission.calls.write, 0)
      assert.equal(admission.error.code, fact.decidedBy, 'the thrown refusal carries the SAME typed code the fact recorded')
      if (materialized.axis === 'write') assert.equal(beforeOf(target), before, 'a refused write did not change the disk')
    }

    const consulted = {
      decision: fact.decision,
      decidedBy: fact.decidedBy,
      realm: fact.realm,
      toolBindingIdentity: fact.toolBindingIdentity,
      method: fact.method,
      locator: fact.locator,
      sequence: fact.sequence,
    }

    // Plane 1 — the shipped pre-Alpha.5 plane, over the same authored call.
    const legacy = await decideLegacy({
      materialized,
      contains: (parent, child) => admission.base.contains({ hostPath: parent }, { hostPath: child }),
    })

    // Plane 3 — the independent derivation from the DECLARED lanes.
    const oracle = deriveOracleDecision({
      axis: materialized.axis,
      realm: materialized.realm,
      ceiling: materialized.ceiling,
      restriction: materialized.realm === 'binding' ? materialized.restriction : undefined,
      target,
    })

    const exceptionIds = caseExceptionIds(spec)
    const comparison = compareThreeWay({
      legacy,
      consulted,
      oracle,
      exceptionIds,
      axis: materialized.axis,
      realm: materialized.realm,
    })

    assert.deepEqual(
      comparison.decisions,
      { plane1: spec.expect.plane1, plane2: spec.expect.plane2, plane3: spec.expect.plane3 },
      `${spec.id}: the reviewed expected triple`,
    )
    assert.equal(comparison.verdict, spec.expect.verdict, `${spec.id}: the reviewed verdict`)

    return {
      id: spec.id,
      axis: materialized.axis,
      realm: materialized.realm,
      resourceKind: materialized.resourceKind,
      legacy,
      consulted,
      oracle,
      comparison,
      exceptionIds,
      fact,
      calls: admission.calls,
      // A5-DUAL-PLANE-01: the bytes-on-disk witness the refusal arms assert.
      before,
      diskAfter: beforeOf(target),
      errorCode: admission.error?.code,
    }
  } finally {
    await admission.realm.dispose()
  }
}

// --- DP1: the whole case space ----------------------------------------------

const RESULTS = []

test('DP1 the same-call three-way comparison over the whole declared case space', async (t) => {
  for (const spec of DUAL_PLANE_CASES) {
    await t.test(`${spec.id} — ${spec.note}`, async () => {
      RESULTS.push(await evaluateCase(spec))
    })
  }
})

// --- DP-SUM: the table, the coverage, the overall answer --------------------

test('DP-SUM the three-way table, case-space coverage and the overall P4-05A answer', async () => {
  assert.equal(RESULTS.length, DUAL_PLANE_CASES.length, 'every case produced a result')
  const summary = summarize(RESULTS)

  // The case space itself must cover the shapes the deliverable claims.
  const axes = new Set(DUAL_PLANE_CASES.map((entry) => entry.axis))
  const realms = new Set(DUAL_PLANE_CASES.map((entry) => entry.realm))
  const kinds = new Set(DUAL_PLANE_CASES.map((entry) => entry.resourceKind))
  const decisions = new Set(RESULTS.flatMap((entry) => Object.values(entry.comparison.decisions)))
  assert.deepEqual([...axes].sort(), ['read', 'write'])
  assert.deepEqual([...realms].sort(), ['binding', 'member'])
  assert.deepEqual([...kinds].sort(), ['any', 'exact', 'subtree'])
  assert.deepEqual([...decisions].sort(), ['allow', 'ask', 'deny'])
  for (const shape of ['dotdot', 'symlink', 'hardlink', 'exact', 'any', 'ask']) {
    assert.ok(
      DUAL_PLANE_CASES.some((entry) => entry.id.includes(shape)),
      `the case space must cover the '${shape}' shape`,
    )
  }
  assert.ok(summary.byOutcome.allow > 0 && summary.byOutcome.deny > 0)
  // A5-DUAL-PLANE-01 (2026-11-05): before the fix the admission seam produced
  // ask=0 over the whole case space — `ask` could NEVER become the admitted
  // decision. The lane is now visible at admission, so refused ask calls are
  // counted under the `ask` lane they decided on, and the count is not allowed
  // to collapse back to zero.
  assert.ok(
    summary.byOutcome.ask >= 3,
    `the admitted-decision table must contain ask decisions (got ${summary.byOutcome.ask}); an ask-blind admission seam reports 0`,
  )
  // Both realms and both axes must produce at least one REFUSED ask call.
  for (const axis of ['read', 'write']) {
    for (const realm of ['member', 'binding']) {
      assert.ok(
        RESULTS.some((entry) => entry.axis === axis && entry.realm === realm && entry.fact.decision === 'ask'),
        `the ask lane must be exercised on the ${axis} axis in the ${realm} realm`,
      )
    }
  }

  // Every DECLARED exception must have been exercised, and the direction of the
  // split must be the cited one (compareThreeWay already enforces the triple).
  assert.deepEqual(summary.unexercisedExceptions, [], 'every declared exception was observed')
  for (const id of Object.keys(summary.exceptionCounts)) assert.ok(EXCEPTIONS[id] !== undefined)

  // Every disagreement must be a case the table marks DISAGREE; a new one is a
  // finding that must be written down before this suite can go green again.
  const expectedDisagreements = DUAL_PLANE_CASES.filter((entry) => entry.expect.verdict === 'DISAGREE').map((entry) => entry.id)
  assert.deepEqual(summary.disagreements.map((entry) => entry.id).sort(), expectedDisagreements.sort())

  // The overall answer. `REFUTED` is a real, recorded outcome: the suite is green
  // because it DETECTS it, not because it tolerates it.
  assert.equal(summary.overall, expectedDisagreements.length === 0 ? 'ALIGNED_WITH_CITED_EXCEPTIONS' : 'REFUTED')

  // Print the table so the run log itself carries the counts.
  console.log(`\n# BL-33 / P4-05A three-way table (${DUAL_PLANE_CASES.length} cases)\n`)
  console.log(renderTable(summary))
  console.log(`\noverall = ${summary.overall}`)
  for (const entry of summary.exceptions) console.log(`EXCEPTION ${entry.id} -> ${entry.exception}`)
  for (const entry of summary.disagreements) {
    console.log(`DISAGREE  ${entry.id} -> ${JSON.stringify(entry.decisions)} outlier=${entry.mismatch} decidedBy=${entry.decidedBy}`)
  }
})

// --- DP-REFUSE / DP-PROJ: A5-DUAL-PLANE-01 (fail closed, lane visible) ------

test('DP-REFUSE every ask-covered call is a typed refusal: ONE ask fact, zero bytes, zero writes, zero tool runs', async () => {
  const refusals = RESULTS.filter((entry) => entry.fact.decision === 'ask')
  // The three original DISAGREE cases MUST be among them — this is the arm that
  // goes red the moment the ask handling is removed (mutation control).
  const refusedIds = refusals.map((entry) => entry.id)
  for (const id of [
    'read-binding-subtree-ask-under-allow',
    'read-binding-subtree-allow-symlink-into-ask',
    'write-binding-subtree-ask-under-allow',
  ]) {
    assert.ok(refusedIds.includes(id), `the previously fail-open case '${id}' must now be refused`)
  }

  for (const entry of refusals) {
    assert.equal(entry.fact.decision, 'ask', `${entry.id}: the fact reports the lane the guard decided on`)
    assert.equal(entry.fact.decidedBy, 'IO_ASK_REQUIRES_APPROVAL', `${entry.id}: the typed refusal code`)
    assert.equal(entry.errorCode, 'IO_ASK_REQUIRES_APPROVAL', `${entry.id}: the thrown refusal carries the same code`)
    assert.equal(
      entry.fact.sequence,
      1,
      `${entry.id}: exactly ONE guard consultation — no approval request is attempted on the refusal path`,
    )
    assert.equal(entry.calls.read, 0, `${entry.id}: zero bytes read through the base Provider`)
    assert.equal(entry.calls.write, 0, `${entry.id}: zero writes through the base Provider`)
    assert.equal(entry.diskAfter, entry.before, `${entry.id}: the bytes on disk are unchanged`)
    assert.equal(entry.comparison.verdict, 'AGREE', `${entry.id}: the refusal agrees with planes 1 and 3`)
  }

  // No over-refusal: an ordinary `allow` still reaches the Provider, an ordinary
  // `deny` still refuses, and neither acquires the ask code.
  const allowCase = RESULTS.find((entry) => entry.id === 'read-binding-subtree-allow-in-lane')
  assert.equal(allowCase.fact.decision, 'allow')
  assert.equal(allowCase.calls.read, 1, 'a plain allow still serves the call')
  const denyCase = RESULTS.find((entry) => entry.id === 'read-binding-subtree-deny-explicit')
  assert.equal(denyCase.fact.decision, 'deny')
  assert.equal(denyCase.fact.decidedBy, 'IO_READ_DENIED', 'a deny keeps its own code — it is not relabelled ask')
  assert.equal(denyCase.calls.read, 0)
})

test('DP-PROJ the REAL product projection RETAINS the ask lane at admission (read, not assumed)', async () => {
  // The earlier defect in this vertical was a projector that FLATTENED a rule
  // set and silently dropped a lane (product-assembly B1, the deny-drop). This
  // arm reads the ACTUAL projection the admission plane consumes:
  // `a5sfRealmConfigOf` -> `createProductRealmProvider` -> `compileMemberPolicy`
  // (Member realm) / `compileEffectiveIo` (binding realm), and asserts the ask
  // locator is still there next to the allow that also covers it.
  const ids = [
    'read-binding-subtree-ask-under-allow',
    'read-binding-subtree-allow-symlink-into-ask',
    'write-binding-subtree-ask-under-allow',
    'read-binding-subtree-ask-narrower-subtree',
    'read-binding-subtree-ask-unrelated-locator',
    'read-member-subtree-ask-under-allow',
    'write-member-subtree-ask-under-allow',
  ]
  for (const id of ids) {
    const spec = caseById(id)
    const base = mkdtempSync(join(tmpdir(), `a5sf-bl33-proj-${id}-`))
    FIXTURES.push(base)
    buildFixture(base)
    const materialized = materializeCase(spec, base)
    const declaredAsk = materialized.ceiling[materialized.axis].ask
    assert.ok(declaredAsk.length > 0, `${id}: the case declares an ask locator`)

    const config = row.a5sfRealmConfigOf({ a5sfMemberPolicies: declarationFor(materialized) })
    assert.notEqual(config, undefined)
    const compiled = assembly.createProductRealmProvider(config.memberPolicies).compiledFor({
      sessionId: 'session-proj',
      instanceId: 'mi-bl33',
      teamRootSessionId: 'session-root-bl33',
      templateId: TEMPLATE,
      bindPath: 'fresh-member',
    })
    assert.notEqual(compiled, undefined)

    const memberLane = compiled.members[0].policy.value[materialized.axis]
    let admissionLane = memberLane
    if (materialized.realm === 'binding') {
      const binding = compiled.bindings.find((entry) => entry.toolBindingIdentity === BINDING_TOOL[materialized.axis])
      assert.notEqual(binding, undefined, `${id}: the binding realm is compiled`)
      admissionLane = binding.effective[materialized.axis]
      // The binding lane is the compiled INTERSECTION; the ask survives it.
      assert.ok(
        binding.effective[materialized.axis].ask.length > 0,
        `${id}: the EFFECTIVE lane (ceiling ∩ restriction) still carries an ask — the projection does not flatten it`,
      )
    }
    assert.ok(
      admissionLane.ask.includes(declaredAsk[0]),
      `${id}: the lane the guard consumes carries the declared ask locator '${declaredAsk[0]}'`,
    )
    assert.ok(
      admissionLane.allow.some((allowed) => declaredAsk[0].startsWith(allowed)),
      `${id}: the ask sits INSIDE an allow subtree — exactly the shape that used to be auto-approved`,
    )
    // And the unrelated ask case proves the lane is carried without refusing a
    // call it does not cover.
    if (id.includes('unrelated')) assert.equal(spec.expect.plane2, 'allow')
  }
})

// --- MUT: the harness cannot pass vacuously ---------------------------------

/** Run one call with a DECLARATION that differs from the case's own, for the control. */
async function admissionWithDeclaration(materialized, declaration, sinkPath) {
  const mutated = { ...materialized }
  const root = new Context()
  await root.plugin(TestFileSystem, {})
  const config = row.a5sfRealmConfigOf({ a5sfMemberPolicies: declaration, a5sfEvidencePath: sinkPath })
  const realm = await row.mountMemberA5sfRealm({
    root,
    a5sfConfig: config,
    provider: () => undefined,
    member: {
      sessionId: 'session-mut',
      instanceId: 'mi-bl33',
      teamRootSessionId: 'session-root-bl33',
      templateId: TEMPLATE,
      bindPath: 'fresh-member',
    },
  })
  providerCalls.read = 0
  providerCalls.write = 0
  let error
  let result
  try {
    const fs = realm.installation.members[0].fs
    const resolved = await fs.resolve(mutated.target)
    result = mutated.axis === 'read' ? await fs.readText(resolved) : await fs.writeText(resolved, mutated.content)
  } catch (caught) {
    error = caught
  }
  const facts = await transports.readGuardConsultFile(sinkPath)
  return { realm, facts, error, result, calls: { ...providerCalls } }
}

function caseById(id) {
  const spec = DUAL_PLANE_CASES.find((entry) => entry.id === id)
  assert.notEqual(spec, undefined, `unknown case '${id}'`)
  return spec
}

test('MUT-1 a ceiling WIDENED in the fixture flips only plane 2 -> DISAGREE, plane 2 is the outlier, the bytes leak', async () => {
  const spec = caseById('read-member-subtree-deny-outside')
  const base = mkdtempSync(join(tmpdir(), 'a5sf-bl33-mut1-'))
  FIXTURES.push(base)
  buildFixture(base)
  const materialized = materializeCase(spec, base)
  const sinkPath = join(base, 'consult.jsonl')

  // The control (unmutated) agrees.
  const control = await evaluateCase(spec)
  assert.equal(control.comparison.verdict, 'AGREE')

  const widened = {
    ...materialized,
    ceiling: { ...materialized.ceiling, read: { mode: 'restricted', allow: [join(base, 'lane'), join(base, 'outside')], ask: [], deny: [] } },
  }
  const admission = await admissionWithDeclaration(widened, declarationFor(widened), sinkPath)
  try {
    assert.equal(admission.facts.length, 1)
    assert.equal(admission.facts[0].decision, 'allow', 'the mutated ceiling really admits the out-of-lane read')
    assert.equal(admission.result, 'SECRET\n', 'the mutated admission really served the out-of-lane bytes')
    const legacy = await decideLegacy({ materialized, contains: testContains })
    const oracle = deriveOracleDecision({
      axis: materialized.axis,
      realm: materialized.realm,
      ceiling: materialized.ceiling,
      target: materialized.target,
    })
    assert.equal(legacy.decision, 'deny')
    assert.equal(oracle.decision, 'deny')
    const comparison = compareThreeWay({ legacy, consulted: admission.facts[0], oracle, axis: 'read', realm: 'member' })
    assert.equal(comparison.verdict, 'DISAGREE', 'a mutated ceiling must NOT pass the comparison')
    assert.equal(comparison.mismatch, 'plane2', 'plane 2 is the outlier: the two other planes agree it is out-of-lane')
  } finally {
    await admission.realm.dispose()
  }
})

test('MUT-2 a ceiling NARROWED in the fixture flips only plane 2 -> DISAGREE, the effect is refused', async () => {
  const spec = caseById('read-member-subtree-allow-in-lane')
  const base = mkdtempSync(join(tmpdir(), 'a5sf-bl33-mut2-'))
  FIXTURES.push(base)
  buildFixture(base)
  const materialized = materializeCase(spec, base)
  const sinkPath = join(base, 'consult.jsonl')

  const narrowed = {
    ...materialized,
    ceiling: { ...materialized.ceiling, read: { mode: 'restricted', allow: [join(base, 'outside')], ask: [], deny: [] } },
  }
  const admission = await admissionWithDeclaration(narrowed, declarationFor(narrowed), sinkPath)
  try {
    assert.equal(admission.facts.length, 1)
    assert.equal(admission.facts[0].decision, 'deny')
    assert.equal(admission.calls.read, 0, 'the narrowed admission refused BEFORE the base Provider')
    const legacy = await decideLegacy({ materialized, contains: testContains })
    const oracle = deriveOracleDecision({
      axis: materialized.axis,
      realm: materialized.realm,
      ceiling: materialized.ceiling,
      target: materialized.target,
    })
    assert.equal(legacy.decision, 'allow')
    assert.equal(oracle.decision, 'allow')
    const comparison = compareThreeWay({ legacy, consulted: admission.facts[0], oracle, axis: 'read', realm: 'member' })
    assert.equal(comparison.verdict, 'DISAGREE')
    assert.equal(comparison.mismatch, 'plane2')
  } finally {
    await admission.realm.dispose()
  }
})

test('MUT-3 the EX-1 triple WITHOUT the case declaring EX-1 is a DISAGREE (the registry is not amnesty)', async () => {
  const spec = caseById('read-member-subtree-deny-explicit')
  const base = mkdtempSync(join(tmpdir(), 'a5sf-bl33-mut3-'))
  FIXTURES.push(base)
  buildFixture(base)
  const materialized = materializeCase(spec, base)
  const result = await evaluateCase(spec)
  assert.equal(result.comparison.verdict, 'AGREE')

  // Drop the deny rule from PLANE 1's input only. The fabricated triple is
  // (allow, deny, deny) — the exact shape EX-1 excuses — but this case declares
  // no exception, so it must be reported as a disagreement.
  const source = {
    ...materialized,
    ceiling: {
      read: { mode: 'restricted', allow: [...materialized.ceiling.read.allow], ask: [], deny: [] },
      write: materialized.ceiling.write,
    },
  }
  const legacy = await decideLegacy({
    materialized,
    policySource: source,
    contains: testContains,
  })
  assert.equal(legacy.decision, 'allow', 'the deny rule really was dropped from plane 1')
  const oracle = deriveOracleDecision({
    axis: materialized.axis,
    realm: materialized.realm,
    ceiling: materialized.ceiling,
    target: materialized.target,
  })
  const comparison = compareThreeWay({ legacy, consulted: result.consulted, oracle, exceptionIds: [], axis: 'read', realm: 'member' })
  assert.equal(comparison.verdict, 'DISAGREE')
  assert.deepEqual(comparison.decisions, { plane1: 'allow', plane2: 'deny', plane3: 'deny' })
  assert.equal(comparison.mismatch, 'plane1')
})

test('MUT-4 deleting the oracle write⇒read step flips the oracle alone -> the exception triple no longer matches', async () => {
  const spec = caseById('write-member-subtree-deny-read-prerequisite')
  const base = mkdtempSync(join(tmpdir(), 'a5sf-bl33-mut4-'))
  FIXTURES.push(base)
  buildFixture(base)
  const materialized = materializeCase(spec, base)
  const result = await evaluateCase(spec)
  assert.equal(result.comparison.verdict, 'EXCEPTION', 'the control is the cited EX-2 exception')

  const mutatedOracle = deriveOracleDecision({
    axis: materialized.axis,
    realm: materialized.realm,
    ceiling: materialized.ceiling,
    target: materialized.target,
    mutations: { disableWriteReadPrerequisite: true },
  })
  assert.equal(mutatedOracle.decision, 'allow', 'without S4 the oracle would allow the write')
  const comparison = compareThreeWay({
    legacy: result.legacy,
    consulted: result.consulted,
    oracle: mutatedOracle,
    exceptionIds: caseExceptionIds(spec),
    axis: 'write',
    realm: 'member',
  })
  assert.equal(comparison.verdict, 'DISAGREE')
  assert.equal(comparison.mismatch, 'plane2', 'without S4 planes 1 and 3 both allow while the admitted plane denies')
})

test('MUT-5 treating the read-only binding as binding a member-realm write flips the oracle alone (2026-11-04 ruling is load-bearing)', async () => {
  const spec = caseById('write-member-subtree-allow-while-binding-read-restricted')
  const base = mkdtempSync(join(tmpdir(), 'a5sf-bl33-mut5-'))
  FIXTURES.push(base)
  buildFixture(base)
  const materialized = materializeCase(spec, base)
  const result = await evaluateCase(spec)
  assert.equal(result.comparison.verdict, 'AGREE', 'the control: a read binding does not constrain the member-realm write')

  // The naive projection: treat a member-realm write as if the read binding's
  // lane governed the read prerequisite too. The oracle then denies a write the
  // product admits, and the harness must report it as a disagreement.
  const naiveOracle = deriveOracleDecision({
    axis: materialized.axis,
    realm: 'binding',
    ceiling: materialized.ceiling,
    restriction: materialized.restriction,
    target: materialized.target,
  })
  assert.equal(naiveOracle.decision, 'deny')
  const comparison = compareThreeWay({
    legacy: result.legacy,
    consulted: result.consulted,
    oracle: naiveOracle,
    axis: 'write',
    realm: 'member',
  })
  assert.equal(comparison.verdict, 'DISAGREE')
  assert.equal(comparison.mismatch, 'plane3')
})

// --- B2: the double-authority guard ----------------------------------------

/** A real v4 blueprint source (the row's `config.blueprintSource`) for THIS team. */
function blueprintSourceOf(read) {
  const document = {
    schemaVersion: 4,
    blueprintId: TEAM,
    revision: '7',
    leader: { templateId: 'leader', persona: 'Lead.' },
    members: [{ templateId: TEMPLATE, persona: 'Worker.' }],
    requirements: [],
    memberEnvelopes: [],
    policyStates: [],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    metadata: {},
    memberIoCeilings: [{
      templateId: TEMPLATE,
      io: { read, write: { mode: 'all', deny: [] }, network: { mode: 'allow' } },
    }],
  }
  return `---\n${JSON.stringify(document, null, 2)}\n---\n`
}

test('B2 the double-authority guard: a declaration wider than the bound blueprint refuses before any realm exists', async () => {
  const base = mkdtempSync(join(tmpdir(), 'a5sf-bl33-b2-'))
  FIXTURES.push(base)
  buildFixture(base)
  const inside = join(base, 'lane', 'inside')
  const outside = join(base, 'outside')
  const accept = {
    schema: assembly.A5SF_PRODUCT_REALM_SCHEMA,
    teamId: TEAM,
    blueprintRevision: '1',
    authority: { revision: 'a4:b2:1', admitted: true },
    members: [{
      templateId: TEMPLATE,
      instanceGeneration: 1,
      ceiling: {
        read: { mode: 'restricted', allow: [inside], ask: [], deny: [] },
        write: { mode: 'all', deny: [] },
        network: { mode: 'allow' },
      },
    }],
  }

  // NARROWING still assembles (and the row would mount it).
  const accepted = row.a5sfRealmConfigOf({
    a5sfMemberPolicies: accept,
    blueprintSource: blueprintSourceOf({ mode: 'restricted', allow: [inside, outside], ask: [], deny: [] }),
  })
  assert.notEqual(accepted.memberPolicies, undefined)

  // WIDENING is refused at ROW ASSEMBLY — no realm, no call, no fact.
  assert.throws(
    () => row.a5sfRealmConfigOf({
      a5sfMemberPolicies: {
        ...accept,
        members: [{
          ...accept.members[0],
          ceiling: {
            ...accept.members[0].ceiling,
            read: { mode: 'restricted', allow: [inside, outside], ask: [], deny: [] },
          },
        }],
      },
      blueprintSource: blueprintSourceOf({ mode: 'restricted', allow: [inside], ask: [], deny: [] }),
    }),
    (error) => {
      assert.equal(error.code, 'REALM_DECLARATION_EXCEEDS_BLUEPRINT')
      assert.equal(error.name, 'TeamServiceInstallError')
      assert.match(error.detail, /ceiling\.read/)
      return true
    },
    'a declared ceiling wider than the bound blueprint must refuse — the double-authority guard',
  )
})

// --- FENCE: the oracle's independence is structural -------------------------

test('FENCE the independent oracle imports only node: modules and names neither plane', () => {
  const raw = readFileSync(join(HERE, 'lib', 'a5sf-dual-plane-oracle.mjs'), 'utf8')
  const source = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const nonNodeImports = [...source.matchAll(/from\s+'([^']+)'/g)]
    .map((match) => match[1])
    .filter((specifier) => !specifier.startsWith('node:'))
  assert.deepEqual(nonNodeImports, [], 'the oracle may import only node: builtins')
  for (const symbol of ['matchLocator', 'evaluateLocatorAccess', 'createMemberFsGuard', 'resolveOperationPermission', 'canonicalizeOperation', 'locatorWithinRuleSet', 'compileEffectiveIo']) {
    assert.equal(source.includes(symbol), false, `the oracle must not name '${symbol}' — that would make the third opinion a copy`)
  }
})
