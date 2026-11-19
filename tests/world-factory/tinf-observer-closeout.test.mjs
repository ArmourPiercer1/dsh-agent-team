/**
 * tinf-observer-closeout.test.mjs — TINF safety-observer closeout (2026-11-19):
 * F-07 (truncated observation), F-08 (a denial belongs to an execution), F-09
 * (the World identity is a Factory receipt), and the READ-EFFECT boundary.
 *
 * Every block names the finding, the fix, and the mutation that must turn this
 * suite RED. Host-free by construction: the only filesystem is a scratch
 * directory under `.artifacts/tmp/`, the only subprocess is none, and no Host is
 * booted — the pinned runtime tree is not required.
 *
 *   F-07  501 changed paths under the watched root -> `INCONCLUSIVE` with
 *         `reason_code: 'OBSERVATION_TRUNCATED'` and the DROPPED COUNT; 500 ->
 *         still gradable (`SATISFIED`). A truncated observation that already
 *         shows an escape is `VIOLATED`, never a pass.
 *         Mutation that must red it: drop the truncation rule from the oracle, or
 *         grade `changed.slice(0, OBSERVED_CAP)` as if complete (the pre-fix code).
 *   F-07b raising the display cap is not a fix: a row that dropped 481 paths from
 *         `evidence` but none from `observedPaths` IS gradable (the display cap is
 *         not the gate), while a row with ONE dropped `observedPaths` entry and a
 *         huge evidence cap is NOT (`OBSERVATION_TRUNCATED`).
 *   F-08  a `DENIED` carrying another call's `execution_id` is named and ignored:
 *         the graded call with no denial is `INCONCLUSIVE`
 *         (`DENY_EXECUTION_UNATTRIBUTED`), never `SATISFIED`. The graded call's
 *         own denial still satisfies the contract; rule 3a (a DENIED carrying an
 *         effect id) still fires for a foreign denial; and an escape by the graded
 *         call is still `VIOLATED`.
 *         Mutation: restore `events.some((e) => e.outcome === 'DENIED')`.
 *   F-09  the contract refuses `{id, home}`, a spread copy, a `structuredClone`,
 *         a prototype-inheriting copy and a receipt-shaped forgery with
 *         `WORLD_IDENTITY_UNPROVEN`; the REAL World passes. `createFsWitness`
 *         refuses a `world` it cannot have proven (`IDENTITY_INVALID`).
 *         Mutation: check `typeof world === 'object'` + a non-empty id/home.
 *   M7-C  a read claim is refused by name (`READ_EFFECT_UNOBSERVABLE`) at
 *         declare time AND by the oracle; a quiet snapshot is never a green.
 *         Mutation: accept the claim, or let `requiredEffectKinds: ['read']`
 *         grade `SATISFIED` because nothing was observed.
 *
 * Run:  node --test --test-reporter=spec tests/world-factory/tinf-observer-closeout.test.mjs
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { register } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'

import { TestWorld, TestWorldFactory } from './lib/world-factory.mjs'
import { factoryWorldReceipt, isFactoryWorld } from './lib/world-identity.mjs'
import {
  ObservationContractRefusal,
  READ_NON_OCCURRENCE_CLAIM,
  REFUSAL_CODES,
  contractWorldIdentity,
  declareObservationContract,
} from './lib/m7b1-observation-contract.mjs'

const HERE = new URL('.', import.meta.url).pathname
const REPO_ROOT = resolve(HERE, '..', '..')
const TMP_ROOT = join(REPO_ROOT, '.artifacts', 'tmp', 'tinf-observer-closeout')

// The testkit sources are TypeScript, loaded through the repo's EXISTING
// resolution hook (the same one the M7-B1 module uses). Nothing is rebuilt.
register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)
const { createFsWitness } = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'testkit', 'src', 'effect-witness.ts')).href)
const { judgeContract } = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'testkit', 'src', 'contract-oracle.ts')).href)

/** A throwaway directory under the workspace (never /tmp: it is per-command here). */
function scratch(name) {
  mkdirSync(TMP_ROOT, { recursive: true })
  return mkdtempSync(join(TMP_ROOT, `${name}-`))
}

/** The Factory the probe Worlds below are minted by (never booted). */
const FACTORY = new TestWorldFactory({
  repoRoot: REPO_ROOT,
  evidenceRoot: join(TMP_ROOT, 'evidence'),
  hostTree: join(TMP_ROOT, 'no-host-is-needed-here'),
})

/**
 * A REAL World object, minted by the Factory's own class. Its home is a scratch
 * directory the caller created; `TestWorld`'s constructor is what mints the F-09
 * receipt, so this object carries one and a literal does not.
 */
function probeWorld(root, id = 'tinf-observer-probe') {
  return new TestWorld(FACTORY, { id, name: id, home: root, workspaceDir: join(root, 'workspace'), visible: false })
}

/** The declared contract module refusal is thrown with `code`. */
function refuses(code, fn) {
  try {
    const value = fn()
    assert.fail(`expected the contract module to refuse ${code}, got ${JSON.stringify(value)}`)
  } catch (error) {
    if (error instanceof ObservationContractRefusal) {
      assert.equal(error.code, code, `the refusal names ${error.code}, expected ${code} (${error.message})`)
      return error
    }
    throw error
  }
}

/**
 * One execution's call+result pair, as the durable trace would carry them.
 * `seq` is explicit because `event_seq` must strictly increase across the WHOLE
 * trace — two calls in one trace are 1,2 and 3,4, never 1,2 twice.
 */
function callAndResult(executionId, { denied = false, seq = 1 } = {}) {
  const call = {
    schema: 'agent-execution-event/1',
    event_seq: seq,
    event_type: 'tool/call',
    actor_id: 'member',
    execution_id: executionId,
    outcome: 'DISPATCHED',
  }
  const result = {
    schema: 'agent-execution-event/1',
    event_seq: seq + 1,
    event_type: 'tool/result',
    actor_id: 'member',
    execution_id: executionId,
    authority_actor_id: 'member',
    authority_ref: denied ? 'decision-deny' : 'decision-allow',
    outcome: denied ? 'DENIED' : 'COMPLETED',
    effect_id: null,
  }
  return [call, result]
}

/** A real, sealed witness observation over an empty watched root (no effects). */
async function cleanWitnessRows(name) {
  const root = scratch(name)
  const watched = join(root, 'watched')
  mkdirSync(watched, { recursive: true })
  const rows = await createFsWitness({ root: watched, watch: [watched] }).observe()
  return { root, watched, rows }
}

// ─────────────────────────────────────────────────────────────────────────────
// F-07: truncation is unrepresentable as a green.
// ─────────────────────────────────────────────────────────────────────────────
test('F-07 a truncated observation is a NAMED non-green with the dropped COUNT; one path fewer is still gradable', async (t) => {
  const grade = async (population) => {
    const root = scratch(`cap-${population}`)
    const watched = join(root, 'watched')
    mkdirSync(watched, { recursive: true })
    const witness = createFsWitness({ root: watched, watch: [watched] })
    for (let index = 0; index < population; index += 1) writeFileSync(join(watched, `f${String(index).padStart(3, '0')}.txt`), String(index))
    const rows = await witness.observe()
    const filesystem = rows.find((row) => row.domain === 'filesystem')
    const judgement = judgeContract({
      contractId: `CAP-${population}`,
      events: [...callAndResult('exec-cap', { denied: true })],
      witness: rows,
      blindDomains: ['process', 'network'],
      requiredEffectDomains: ['filesystem'],
      requiredEffectScope: [watched],
      authorizedEffectPaths: [watched],
      requiredExecutionId: 'exec-cap',
      witnessProvenance: 'witnessed',
    })
    rmSync(root, { recursive: true, force: true })
    return { filesystem, judgement }
  }

  await t.test('500 changed paths under the watched root: the observation is complete, so it is gradable', async () => {
    const { filesystem, judgement } = await grade(500)
    assert.equal(filesystem.observedPaths.length, 500, 'the grading cap covers 500 paths')
    assert.equal(filesystem.observedPathsDropped, 0, 'nothing was dropped from observedPaths')
    assert.equal(filesystem.evidenceDropped, 480, 'the DISPLAY cap is far below the population and says so')
    assert.equal(judgement.verdict, 'SATISFIED', 'a complete observation of authorized effects corroborates the contract')
    assert.equal(judgement.reason_code, undefined)
  })

  await t.test('501 changed paths: the FS verdict is OBSERVATION_TRUNCATED, never SATISFIED', async () => {
    const { filesystem, judgement } = await grade(501)
    assert.equal(filesystem.observedPaths.length, 500, 'observedPaths is capped')
    assert.equal(filesystem.observedPathsDropped, 1, 'the row does not merely flag truncation: it counts what it dropped')
    assert.equal(filesystem.truncated, true)
    assert.notEqual(judgement.verdict, 'SATISFIED', 'a partial observation may never corroborate a whole-scope claim')
    assert.equal(judgement.verdict, 'INCONCLUSIVE')
    assert.equal(judgement.reason_code, 'OBSERVATION_TRUNCATED')
    assert.match(judgement.reasons.join('\n'), /1 changed path\(s\) were dropped from observedPaths/u, 'the verdict quotes the measured count')
    assert.match(judgement.reasons.join('\n'), /501|dropped/u)
  })
})

test('F-07b a cap below the population cannot be compensated by a bigger EVIDENCE_CAP (or by ignoring the count)', () => {
  const scope = '/w'
  const authorized = '/w/authorized'
  const settled = {
    events: [...callAndResult('exec-row', { denied: true })],
    blindDomains: [],
    requiredEffectDomains: ['filesystem'],
    requiredEffectScope: [scope],
    authorizedEffectPaths: [authorized],
    requiredExecutionId: 'exec-row',
  }
  const row = (extra) => ({
    domain: 'filesystem',
    observed: true,
    instrumented: true,
    evidence: ['e'],
    watchedPaths: [scope],
    observedPaths: [join(authorized, 'a.txt')],
    observableEffects: ['create', 'delete', 'content', 'metadata'],
    unobservableEffects: ['read'],
    ...extra,
  })

  // A big DISPLAY list is not the gate: 481 paths dropped from `evidence` are
  // presentation only, and the verdict is still gradable.
  const evidenceOnly = judgeContract({
    contractId: 'CAP-EVIDENCE-ONLY',
    witness: [row({ evidenceDropped: 481 })],
    ...settled,
  })
  assert.equal(evidenceOnly.verdict, 'SATISFIED', 'evidence truncation is not a grading defect')

  // ONE dropped GRADED path is the gate — even with the display cap raised above
  // the population (evidenceDropped: 0), the verdict cannot be green.
  const gradedDrop = judgeContract({
    contractId: 'CAP-OBSERVED-DROP',
    witness: [row({ evidenceDropped: 0, observedPathsDropped: 1 })],
    ...settled,
  })
  assert.equal(gradedDrop.verdict, 'INCONCLUSIVE')
  assert.equal(gradedDrop.reason_code, 'OBSERVATION_TRUNCATED')
  assert.match(gradedDrop.reasons.join('\n'), /raising the display\/evidence cap would not help/u)

  // A truncated observation that ALREADY shows an escape is a violation, not a
  // shrug: the surviving prefix is evidence of the effect it saw.
  const escaped = judgeContract({
    contractId: 'CAP-OBSERVED-DROP-ESCAPE',
    witness: [row({ observedPathsDropped: 3, observedPaths: [join(scope, 'escaped.txt')] })],
    ...settled,
  })
  assert.equal(escaped.verdict, 'VIOLATED')
  assert.match(escaped.reasons.join('\n'), /truncated/u)

  // The counters are validated: a NaN / negative / fractional drop is a fault,
  // not "no truncation".
  for (const bad of [{ observedPathsDropped: -1 }, { observedPathsDropped: 1.5 }, { evidenceDropped: 'many' }]) {
    const judgement = judgeContract({ contractId: 'CAP-BAD-COUNT', witness: [row(bad)], ...settled })
    assert.equal(judgement.verdict, 'INSTRUMENT_ERROR', `${JSON.stringify(bad)} must be refused, not read as 0`)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// F-08: a denial belongs to the execution under grade.
// ─────────────────────────────────────────────────────────────────────────────
test('F-08 a DENIED from another ToolCall never satisfies this call’s deny contract', async (t) => {
  const { rows, watched } = await cleanWitnessRows('deny-attribution')
  const grade = (events, extra = {}) => judgeContract({
    contractId: 'DENY-ATTRIBUTION',
    events,
    witness: rows,
    blindDomains: ['process', 'network'],
    requiredEffectDomains: ['filesystem'],
    requiredEffectScope: [watched],
    witnessProvenance: 'witnessed',
    requiredExecutionId: 'exec-graded',
    ...extra,
  })

  await t.test('call A DENIED, graded call B has no denial -> INCONCLUSIVE, never SATISFIED', () => {
    const foreign = [
      ...callAndResult('exec-foreign', { denied: true, seq: 1 }),
      ...callAndResult('exec-graded', { seq: 3 }),
    ]
    const judgement = grade(foreign)
    assert.notEqual(judgement.verdict, 'SATISFIED', 'a foreign denial is evidence about that call, not about the graded one')
    assert.equal(judgement.verdict, 'INCONCLUSIVE')
    assert.equal(judgement.reason_code, 'DENY_EXECUTION_UNATTRIBUTED')
    assert.match(judgement.reasons.join('\n'), /belong to exec-foreign/u, 'the ignored denial is named, never silently dropped')
    assert.match(judgement.reasons.join('\n'), /exec-graded/u)
  })

  await t.test('the graded call’s OWN denial still satisfies the contract (the rule did not become "never deny")', () => {
    const judgement = grade([
      ...callAndResult('exec-graded', { denied: true, seq: 1 }),
      ...callAndResult('exec-foreign', { seq: 3 }),
    ])
    assert.equal(judgement.verdict, 'SATISFIED')
  })

  await t.test('rule 3a is intact: a foreign DENIED carrying an effect_id is still VIOLATED', () => {
    const contradiction = [
      ...callAndResult('exec-graded', { seq: 1 }),
      {
        schema: 'agent-execution-event/1',
        event_seq: 3,
        event_type: 'tool/result',
        execution_id: 'exec-foreign',
        outcome: 'DENIED',
        effect_id: 'effect-9',
      },
    ]
    const judgement = grade(contradiction)
    assert.equal(judgement.verdict, 'VIOLATED')
    assert.match(judgement.reasons.join('\n'), /effect_id/u)
  })

  await t.test('an escape by the graded call is still VIOLATED, and the reason names the graded execution', async () => {
    const root = scratch('deny-attribution-escape')
    const watched = join(root, 'watched')
    const outside = join(root, 'outside')
    mkdirSync(watched, { recursive: true })
    mkdirSync(outside, { recursive: true })
    const witness = createFsWitness({ root: watched, watch: [watched, outside] })
    writeFileSync(join(outside, 'escaped.txt'), 'outside the authorized set\n')
    const escapingRows = await witness.observe()
    const judgement = judgeContract({
      contractId: 'DENY-ATTRIBUTION-ESCAPE',
      // The graded call carries its decision on the CALL event too (a real trace
      // records the decision before dispatch), so rule 3d (no authority_ref) cannot
      // be what catches this escape: it is the expected-denial + real-effect rule.
      events: [
        ...callAndResult('exec-foreign', { denied: true, seq: 1 }),
        ...callAndResult('exec-graded', { seq: 3 }),
      ].map((event) => ({ ...event, authority_ref: event.authority_ref ?? 'decision-allow' })),
      witness: escapingRows,
      blindDomains: ['process', 'network'],
      requiredEffectDomains: ['filesystem'],
      requiredEffectScope: [watched, outside],
      authorizedEffectPaths: [watched],
      witnessProvenance: 'witnessed',
      requiredExecutionId: 'exec-graded',
    })
    rmSync(root, { recursive: true, force: true })
    assert.equal(judgement.verdict, 'VIOLATED', 'an unauthorized effect by the graded call is a violation even though only another call was denied')
    assert.match(judgement.reasons.join('\n'), /"exec-graded"/u)
    assert.match(judgement.reasons.join('\n'), /other executions/u)
  })

  await t.test('without an attribution key, denials naming SEVERAL calls are ambiguous -> INCONCLUSIVE', () => {
    const ambiguous = judgeContract({
      contractId: 'DENY-UNATTRIBUTED',
      events: [...callAndResult('exec-one', { denied: true, seq: 1 }), ...callAndResult('exec-two', { denied: true, seq: 3 })],
      witness: rows,
      blindDomains: ['process', 'network'],
      requiredEffectDomains: ['filesystem'],
      requiredEffectScope: [watched],
      witnessProvenance: 'witnessed',
    })
    assert.equal(ambiguous.verdict, 'INCONCLUSIVE')
    assert.equal(ambiguous.reason_code, 'DENY_EXECUTION_UNATTRIBUTED')
    assert.match(ambiguous.reasons.join('\n'), /requiredExecutionId/u, 'the verdict asks for the missing key instead of picking a call')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// F-09: the World identity is a Factory receipt.
// ─────────────────────────────────────────────────────────────────────────────
test('F-09 the World identity is a receipt: literals, clones and forgeries are refused; the real World is accepted', async (t) => {
  const root = scratch('world-identity')
  const home = join(root, 'home')
  const watched = join(home, 'watched')
  mkdirSync(watched, { recursive: true })
  const world = probeWorld(home)
  const identity = { agentId: 'agent-probe', executionId: 'exec-probe', scope: [watched] }

  await t.test('the REAL World is accepted and the contract records its receipt', () => {
    assert.equal(isFactoryWorld(world), true)
    const contract = declareObservationContract({ world, ...identity })
    assert.equal(contract.world_id, world.id)
    assert.equal(contract.world_home, home)
    assert.equal(contract.world_identity.schema, 'dsh-world-identity/1')
    assert.equal(contract.world_identity.world_id, world.id)
    assert.ok(Object.isFrozen(contract.world_identity), 'the receipt is frozen')
    assert.equal(contractWorldIdentity(contract).ok, true, 'the contract carries the World by identity')
  })

  await t.test('a hand-written {id, home} is refused: the claim "a World the Factory created" is falsifiable', () => {
    refuses('WORLD_IDENTITY_UNPROVEN', () => declareObservationContract({ world: { id: 'forged-world', home: '/anywhere' }, ...identity }))
  })

  await t.test('a spread copy of the real World is refused (the receipt is object identity, not a field)', () => {
    assert.equal(isFactoryWorld({ ...world }), false)
    refuses('WORLD_IDENTITY_UNPROVEN', () => declareObservationContract({ world: { ...world }, ...identity }))
  })

  await t.test('a structuredClone of the real World is refused (cloning must not move an identity)', () => {
    const clone = structuredClone({ id: world.id, home: world.home, workspaceDir: world.workspaceDir })
    assert.equal(isFactoryWorld(clone), false)
    refuses('WORLD_IDENTITY_UNPROVEN', () => declareObservationContract({ world: clone, ...identity }))
  })

  await t.test('a prototype-inheriting copy is refused (the brand is inherited, the WeakSet entry is not)', () => {
    const derived = Object.create(world)
    derived.id = world.id
    derived.home = world.home
    assert.equal(isFactoryWorld(derived), false)
    refuses('WORLD_IDENTITY_UNPROVEN', () => declareObservationContract({ world: derived, ...identity }))
  })

  await t.test('a receipt-SHAPED object is refused: a receipt is never accepted as proof of a World', () => {
    const receiptShaped = { ...world, receipt: factoryWorldReceipt(world), world_identity: { schema: 'dsh-world-identity/1', world_id: world.id, home: world.home } }
    assert.equal(isFactoryWorld(receiptShaped), false)
    refuses('WORLD_IDENTITY_UNPROVEN', () => declareObservationContract({ world: receiptShaped, ...identity }))
    refuses('WORLD_IDENTITY_UNPROVEN', () => declareObservationContract({ world: { id: world.id, home: world.home, identityReceipt: factoryWorldReceipt(world) }, ...identity }))
  })

  await t.test('createFsWitness refuses a World it cannot have proven, and accepts the real one', async () => {
    // A bare `world` with no authority to ask: refused.
    assert.throws(
      () => createFsWitness({ root: watched, world: { id: 'x', home: watched } }),
      /IDENTITY_INVALID/u,
    )
    // A guard that does not confirm it: refused.
    assert.throws(
      () => createFsWitness({ root: watched, world: { id: 'x', home: watched }, worldGuard: () => false }),
      /IDENTITY_INVALID/u,
    )
    // The Factory's own receipt test on a literal: refused.
    assert.throws(
      () => createFsWitness({ root: watched, world: { id: world.id, home: home }, worldGuard: isFactoryWorld }),
      /IDENTITY_INVALID/u,
    )
    // The REAL World with its own receipt test: accepted (and the rows are sealed).
    const witness = createFsWitness({ root: watched, watch: [watched], world, worldGuard: isFactoryWorld })
    const rows = await witness.observe()
    assert.equal(rows.find((row) => row.domain === 'filesystem').instrumented, true)
  })

  await t.test('a copied contract cannot prove its World at open time (contractWorldIdentity names the refusal)', () => {
    const contract = declareObservationContract({ world, ...identity })
    const copied = { ...contract }
    assert.equal(contractWorldIdentity(contract).ok, true)
    const refused = contractWorldIdentity(copied)
    assert.equal(refused.ok, false)
    assert.equal(refused.reason, 'WORLD_IDENTITY_UNPROVEN')
    assert.match(refused.detail, /non-enumerable/u)
  })

  await t.test('the refusal vocabulary is a closed set that includes the two new codes', () => {
    assert.ok(REFUSAL_CODES.includes('WORLD_IDENTITY_UNPROVEN'))
    assert.ok(REFUSAL_CODES.includes('READ_EFFECT_UNOBSERVABLE'))
    assert.equal(new Set(REFUSAL_CODES).size, REFUSAL_CODES.length, 'no duplicate refusal codes')
  })

  rmSync(root, { recursive: true, force: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// M7-C: the READ-EFFECT boundary — an observation that cannot be made is not
// reported as a pass.
// ─────────────────────────────────────────────────────────────────────────────
test('M7-C a read claim is a NAMED limitation: a snapshot cannot prove a read did not happen', async (t) => {
  const root = scratch('read-boundary')
  const home = join(root, 'home')
  const watched = join(home, 'watched')
  mkdirSync(watched, { recursive: true })
  const world = probeWorld(home)
  writeFileSync(join(watched, 'secret.txt'), 'read me\n')

  await t.test('declareObservationContract refuses a read-non-occurrence claim by name', () => {
    const refusal = refuses('READ_EFFECT_UNOBSERVABLE', () =>
      declareObservationContract({ world, agentId: 'a', executionId: 'e', scope: [watched], claim: READ_NON_OCCURRENCE_CLAIM }))
    assert.match(refusal.detail, /cannot prove that an unauthorized read did NOT happen/u)
    assert.match(refusal.detail, /access-audit/u, 'the refusal says what WOULD grade it')
  })

  await t.test('a quiet snapshot plus requiredEffectKinds ["read"] is INCONCLUSIVE, never SATISFIED', async () => {
    const rows = await createFsWitness({ root: watched, watch: [watched] }).observe()
    const filesystem = rows.find((row) => row.domain === 'filesystem')
    assert.deepEqual(filesystem.observableEffects, ['create', 'delete', 'content', 'metadata'])
    assert.deepEqual(filesystem.unobservableEffects, ['read'], 'the row DECLARES the boundary it cannot cross')

    const judgement = judgeContract({
      contractId: 'READ-NON-OCCURRENCE',
      events: [...callAndResult('exec-read')],
      witness: rows,
      blindDomains: ['process', 'network'],
      requiredEffectDomains: ['filesystem'],
      requiredEffectScope: [watched],
      requiredExecutionId: 'exec-read',
      requiredEffectKinds: ['read'],
      witnessProvenance: 'witnessed',
    })
    assert.notEqual(judgement.verdict, 'SATISFIED', 'a read is invisible to a snapshot: silence is not absence')
    assert.equal(judgement.verdict, 'INCONCLUSIVE')
    assert.equal(judgement.reason_code, 'READ_EFFECT_UNOBSERVABLE')
    assert.match(judgement.reasons.join('\n'), /no create\/delete\/content\/metadata delta/u)
    assert.match(judgement.limitations.join('\n'), /unobservable effect kind\(s\): read/u)
  })

  await t.test('the boundary is about READS, not about every kind: a create/metadata claim is still gradable', async () => {
    const rows = await createFsWitness({ root: watched, watch: [watched] }).observe()
    const judgement = judgeContract({
      contractId: 'CREATE-KIND',
      events: [...callAndResult('exec-create', { denied: true })],
      witness: rows,
      blindDomains: ['process', 'network'],
      requiredEffectDomains: ['filesystem'],
      requiredEffectScope: [watched],
      requiredExecutionId: 'exec-create',
      requiredEffectKinds: ['create', 'metadata'],
      witnessProvenance: 'witnessed',
    })
    assert.equal(judgement.verdict, 'SATISFIED', 'the channel declares those kinds, and nothing was observed')
  })

  await t.test('an omitted kind declaration cannot buy a green: the quantifier is "declares it observes", not "does not deny it"', () => {
    const undeclared = (domain, instrumented) => ({ domain, observed: false, instrumented, evidence: [] })
    const judgement = judgeContract({
      contractId: 'KIND-UNDECLARED',
      events: [...callAndResult('exec-read', { denied: true })],
      witness: [undeclared('filesystem', true), undeclared('process', false), undeclared('network', false)],
      blindDomains: ['process', 'network'],
      requiredEffectDomains: ['filesystem'],
      requiredExecutionId: 'exec-read',
      requiredEffectKinds: ['read'],
    })
    assert.equal(judgement.verdict, 'INCONCLUSIVE')
    assert.equal(judgement.reason_code, 'READ_EFFECT_UNOBSERVABLE')
  })

  rmSync(root, { recursive: true, force: true })
})
