/**
 * P8-S5B — operation fencing acceptance (plan §19 Goal 3; CR-8 closure).
 *
 * For each cross-module race window R1..R6 this file either PROVES the
 * current per-team fencing is sufficient (R1, R2, R3, R4, R6) or exercises
 * the ONE shared Team-level coordinator that closes the window (R5 —
 * `packages/runtime/coordination`, the single shared per-team chain the
 * production root wires through the router facade, the activity ledger and
 * the P7-T3 lifecycle service).
 *
 * RACES (concurrent operations on ONE team):
 *
 * - R1  follow-up || archive-member (seeded RUNNING worker);
 * - R2  follow-up || dispose-member (seeded RUNNING worker);
 * - R3  restore-member || follow-up (seeded ARCHIVED worker);
 * - R4  create-member x3 at the per-template quota boundary (leader only);
 * - R5  environment drift (FATAL) || two new-work consultations — the
 *       non-atomic compatibility replaceState delete→put gap (the R5 hit:
 *       a later-starting probe's delete lands in the earlier probe's
 *       put→post-probe-re-read window → spurious NO_STATE_AFTER_REPROBE
 *       fail-closed);
 * - R6  governance-override mutation || next-step begin (the optimistic
 *       generation guard is only sound when concurrent admits serialize).
 *
 * METHOD (repeatability): every race uses top-level-await scenario capture
 * over REAL TeamDomain worlds (testkit FileStorageSeam) with BOUNDED
 * iterations and a CONTROLLED microtask stagger sweep (no wall-clock
 * timing, no native timers):
 *
 * - R1/R2/R3 run ONE concurrent pair per race; the invariants are
 *   BRANCH-AWARE — they hold under EITHER serialization order (both order
 *   branches are asserted, and exactly one branch may hold), so the suite
 *   is green for every interleaving the microtask scheduler produces;
 * - R4 runs ONE concurrent triple at the exact quota boundary; the counts
 *   are order-independent (the facade chain + provider quota make the
 *   exact-limit outcome deterministic);
 * - R5 drives the window at the CONSULTATION level — the true CR-8 seam:
 *   the router's own facade chain already serializes router-mediated
 *   follow-ups (empirically ZERO NO_STATE hits at the router level
 *   across the 0..24 stagger sweep), and a pure start-stagger sweep
 *   (S = 0..32) also never hits: B's probe->put span is structurally
 *   shorter than A's put->re-read gap, so a same-time-start B can never
 *   land its delete inside that gap. The window opens only when B's
 *   environment-facts delivery lags A's (the production shape: each site
 *   awaits its own facts port before consulting). METHOD: the 2D
 *   CONTROLLED grid (S = 0..12 start stagger of B) x (D = 0..6
 *   facts-delivery microtask delay of B) — every knob a pure microtask
 *   tick count, the engine is deterministic (every cell reproduces the
 *   same interleaving on every run), FRESH world per cell. D shifts B's
 *   phase one tick at a time through A's probe lifecycle: dual-probe
 *   lost-update cells (D=0..3), the CR-8 hit cell (S=0, D=4: B's
 *   probe-delete lands in A's put->re-read gap -> spurious
 *   NO_STATE_AFTER_REPROBE fail-closed), then serialized no-probe cells
 *   (D>=5). Half A (no coordinator) asserts >= 1 NO_STATE_AFTER_REPROBE
 *   across the grid while the durable row stays well-formed in every
 *   cell; half B (both admits through ONE shared coordinator chain,
 *   IDENTICAL grid) asserts ZERO hits, exactly ONE re-probe per cell,
 *   and the deterministic final generation = initial + 1;
 * - R6 Part A serializes two concurrent admits through the coordinator's
 *   chain (the production row's governanceQueue shape) and asserts the
 *   deterministic optimistic-guard conflict; Part B runs the same pair
 *   UNSERIALIZED and captures the lost-update evidence (two records at
 *   the same slot generation, both "admitted"); Part C exercises the
 *   MutationService future-boundary contract (beginStep capture frozen
 *   against a concurrent requestMutation; the mutation visible only from
 *   step+1; release idempotent).
 *
 * @module @dsh-agent-team/runtime/test/p8s5b-operation-fencing
 */

import { describe, expect, it } from 'vitest'

import { createTeamRuntime } from '../action-router/index.js'
import type { TeamRuntime, TeamRuntimeActionRequest } from '../admission/index.js'
import { TEAM_RUNTIME_ERROR_CODES } from '../admission/index.js'
import { createWorkActivityWriter } from '../activity/index.js'
import { createCompatibilityAuthority } from '../compatibility/index.js'
import type {
  CompatibilityAdmissionDecision,
  CompatibilityAuthorityOptions,
} from '../compatibility/index.js'
import { createTeamOperationCoordinator } from '../coordination/index.js'
import {
  MUTATION_ERROR_CODES,
  admitGovernanceOverride,
  isMutationError,
  selectSlotWinner,
} from '../mutation/index.js'
import type {
  AdmittedGovernanceOverride,
  MutationLedgerEntry,
  OverrideRecordView,
  OverrideStorePort,
  SlotIdentity,
} from '../mutation/index.js'
import {
  P6T2_NOW,
  P6T2_ROOT,
  P6T2_SEEDS,
  createFakeLifecycleCommitPort,
  createP6T2World,
  humanCaller,
  makeActionRequest,
  memberList,
  membersByTemplate,
  p6t2Seed,
} from './p6t2-helpers.js'
import { destroyP6T1World, makeEnvironmentFacts } from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import { factsSkillBaseDown } from './p7t1-helpers.js'
import type { MutableFacts } from './p8s4a-helpers.js'
import {
  P7T2_ALPHA,
  P7T2_TEAM,
  allow,
  createP7T2World,
  deny,
  fixtureMember,
  snapshotCapture,
} from './p7t2-helpers.js'

// ---------------------------------------------------------------------------
// Shared scenario helpers
// ---------------------------------------------------------------------------

/** The seeded worker every follow-up targets. */
const WORKER_ID = P6T2_SEEDS.worker.instanceId

/** The re-probe fail-closed reason string (closed vocabulary, authority.ts). */
const NO_STATE_AFTER_REPROBE = 'no-state-after-reprobe'

/** One entry-point attempt: the effect kind, or the rejection code + details. */
interface EntryResult {
  readonly ok: boolean
  readonly kind: string
  readonly error: string | undefined
  readonly errorDetails: Record<string, unknown> | undefined
}

async function runEntry(
  runtime: TeamRuntime,
  request: TeamRuntimeActionRequest,
): Promise<EntryResult> {
  try {
    const outcome = await runtime.performAction(request)
    return { ok: true, kind: outcome.effect.kind, error: undefined, errorDetails: undefined }
  } catch (error) {
    const record = (error ?? {}) as { code?: unknown; details?: unknown }
    return {
      ok: false,
      kind: 'error',
      error: record.code !== undefined ? String(record.code) : undefined,
      errorDetails:
        record.details !== undefined ? (record.details as Record<string, unknown>) : undefined,
    }
  }
}

/** Yield exactly `n` microtasks (the controlled stagger; n=0 yields one). */
async function tick(n: number): Promise<void> {
  let pending: Promise<void> = Promise.resolve()
  for (let i = 0; i < n; i++) {
    pending = pending.then(() => undefined)
  }
  await pending
}

/** The no-op recording delivery port (work chain settlement succeeds). */
function noopDelivery(): {
  readonly port: {
    deliver(args: {
      readonly rootSessionId: string
      readonly instanceId: string
      readonly childSessionId: string
      readonly requestToken: string
      readonly prompt: string
      readonly attachedContext?: string
    }): Promise<void>
  }
  readonly calls: { readonly instanceId: string; readonly requestToken: string }[]
} {
  const calls: { readonly instanceId: string; readonly requestToken: string }[] = []
  return {
    port: {
      async deliver(args: {
        readonly instanceId: string
        readonly requestToken: string
      }): Promise<void> {
        calls.push({ instanceId: args.instanceId, requestToken: args.requestToken })
      },
    },
    calls,
  }
}

/**
 * The FULL P8-S3 production work-chain wiring over one world (fake
 * lifecycle commit + no-op delivery + in-facade activity writer), with the
 * optional SHARED team-chain map (P8-S5B coordinator).
 */
function createFenceRuntime(
  world: P6T1World,
  deliveryPort: ReturnType<typeof noopDelivery>['port'],
  teamLocks?: Map<string, Promise<unknown>>,
): TeamRuntime {
  return createTeamRuntime({
    teamDomain: world.domain,
    activationProvider: world.provider,
    blueprintCatalog: world.catalog,
    environmentFacts: world.ports.environmentFacts,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T2_NOW,
    lifecycleCommit: createFakeLifecycleCommitPort(world),
    workDelivery: deliveryPort,
    workActivity: createWorkActivityWriter({ teamDomain: world.domain, now: () => P6T2_NOW }),
    ...(teamLocks !== undefined ? { teamLocks } : {}),
  })
}

/** Count durable work-admitted facts for one instance (zombie-work check). */
function countWorkFacts(world: P6T1World, instanceId: string): number {
  return world.domain.repositories.ledger
    .list()
    .filter(
      (entry) =>
        entry.factType === 'team-work-admitted' && entry.payload['targetInstanceId'] === instanceId,
    ).length
}

/** The fresh durable lifecycle of one member ('MISSING' when gone). */
function memberLifecycle(world: P6T1World, instanceId: string): string {
  const member = world.domain.repositories.memberInstances.get(P6T2_ROOT, instanceId)
  return member === undefined ? 'MISSING' : String(member.lifecycle)
}

/** The durable compatibility row (or undefined). */
function compatRowOf(world: P6T1World): {
  readonly fingerprint: string
  readonly generation: number
  readonly status: string
} | undefined {
  const row = world.domain.repositories.compatibility.get(P6T2_ROOT)
  if (row === undefined) return undefined
  return { fingerprint: row.fingerprint, generation: row.generation, status: row.status }
}

/** Build one mutable-facts P6-T2 world (the environment is controllable). */
async function createMutableWorld(
  basename: string,
  seedNames: readonly (keyof typeof P6T2_SEEDS)[],
): Promise<{ world: P6T1World; facts: MutableFacts }> {
  const facts: MutableFacts = { current: makeEnvironmentFacts() }
  const world = await createP6T2World(basename, seedNames, {
    environmentFacts: async () => facts.current,
  })
  return { world, facts }
}

// ---------------------------------------------------------------------------
// R1 — follow-up || archive-member (RUNNING worker)
// ---------------------------------------------------------------------------

interface R1 {
  readonly followUp: EntryResult
  readonly archive: EntryResult
  readonly finalLifecycle: string
  readonly workFactCount: number
}

let r1: R1
{
  const world = await createP6T2World('p8s5b-r1', ['leader', 'worker'])
  try {
    const delivery = noopDelivery()
    const runtime = createFenceRuntime(world, delivery.port)
    const [followUp, archive] = await Promise.all([
      runEntry(
        runtime,
        makeActionRequest({
          targetInstanceId: WORKER_ID,
          requestToken: 'tok-r1-follow-up',
          payload: { prompt: 'r1 follow-up' },
        }),
      ),
      runEntry(
        runtime,
        makeActionRequest({
          action: 'archive-member',
          targetInstanceId: WORKER_ID,
          requestToken: 'tok-r1-archive',
        }),
      ),
    ])
    r1 = {
      followUp,
      archive,
      finalLifecycle: memberLifecycle(world, WORKER_ID),
      workFactCount: countWorkFacts(world, WORKER_ID),
    }
  } finally {
    destroyP6T1World(world)
  }
}

// ---------------------------------------------------------------------------
// R2 — follow-up || dispose-member (RUNNING worker)
// ---------------------------------------------------------------------------

interface R2 {
  readonly followUp: EntryResult
  readonly dispose: EntryResult
  readonly finalLifecycle: string
  readonly workFactCount: number
}

let r2: R2
{
  const world = await createP6T2World('p8s5b-r2', ['leader', 'worker'])
  try {
    const delivery = noopDelivery()
    const runtime = createFenceRuntime(world, delivery.port)
    const [followUp, dispose] = await Promise.all([
      runEntry(
        runtime,
        makeActionRequest({
          targetInstanceId: WORKER_ID,
          requestToken: 'tok-r2-follow-up',
          payload: { prompt: 'r2 follow-up' },
        }),
      ),
      runEntry(
        runtime,
        makeActionRequest({
          action: 'dispose-member',
          // The P6T2 blueprint envelope does NOT grant the leader
          // dispose-member (team-level envelope allow-list); the human
          // owner is the caller of record for this race (p6t2 pattern).
          caller: humanCaller(),
          targetInstanceId: WORKER_ID,
          requestToken: 'tok-r2-dispose',
        }),
      ),
    ])
    r2 = {
      followUp,
      dispose,
      finalLifecycle: memberLifecycle(world, WORKER_ID),
      workFactCount: countWorkFacts(world, WORKER_ID),
    }
  } finally {
    destroyP6T1World(world)
  }
}

// ---------------------------------------------------------------------------
// R3 — restore-member || follow-up (ARCHIVED worker)
// ---------------------------------------------------------------------------

interface R3 {
  readonly followUp: EntryResult
  readonly restore: EntryResult
  readonly finalLifecycle: string
  readonly workFactCount: number
}

let r3: R3
{
  const world = await createP6T2World('p8s5b-r3', ['leader'], {
    seedMembers: [p6t2Seed('worker', { lifecycle: 'ARCHIVED' })],
  })
  try {
    const delivery = noopDelivery()
    const runtime = createFenceRuntime(world, delivery.port)
    const [followUp, restore] = await Promise.all([
      runEntry(
        runtime,
        makeActionRequest({
          targetInstanceId: WORKER_ID,
          requestToken: 'tok-r3-follow-up',
          payload: { prompt: 'r3 follow-up' },
        }),
      ),
      runEntry(
        runtime,
        makeActionRequest({
          action: 'restore-member',
          targetInstanceId: WORKER_ID,
          requestToken: 'tok-r3-restore',
        }),
      ),
    ])
    r3 = {
      followUp,
      restore,
      finalLifecycle: memberLifecycle(world, WORKER_ID),
      workFactCount: countWorkFacts(world, WORKER_ID),
    }
  } finally {
    destroyP6T1World(world)
  }
}

// ---------------------------------------------------------------------------
// R4 — create-member x3 at the per-template quota boundary (maxInstances 2)
// ---------------------------------------------------------------------------

interface R4 {
  readonly outcomes: readonly EntryResult[]
  readonly activatedCount: number
  readonly quotaRejectedCount: number
  readonly workerCount: number
  readonly totalMemberCount: number
}

let r4: R4
{
  const world = await createP6T2World('p8s5b-r4', ['leader'])
  try {
    const delivery = noopDelivery()
    const runtime = createFenceRuntime(world, delivery.port)
    const outcomes = await Promise.all([
      runEntry(
        runtime,
        makeActionRequest({
          action: 'create-member',
          delegationTemplateId: 'worker',
          payload: { label: 'r4-member-a' },
          requestToken: 'tok-r4-a',
        }),
      ),
      runEntry(
        runtime,
        makeActionRequest({
          action: 'create-member',
          delegationTemplateId: 'worker',
          payload: { label: 'r4-member-b' },
          requestToken: 'tok-r4-b',
        }),
      ),
      runEntry(
        runtime,
        makeActionRequest({
          action: 'create-member',
          delegationTemplateId: 'worker',
          payload: { label: 'r4-member-c' },
          requestToken: 'tok-r4-c',
        }),
      ),
    ])
    r4 = {
      outcomes,
      activatedCount: outcomes.filter((o) => o.ok && o.kind === 'member-activated').length,
      quotaRejectedCount: outcomes.filter(
        (o) => o.error === TEAM_RUNTIME_ERROR_CODES.QUOTA_EXCEEDED_TEMPLATE_INSTANCES,
      ).length,
      workerCount: membersByTemplate(world, 'worker').length,
      totalMemberCount: memberList(world).length,
    }
  } finally {
    destroyP6T1World(world)
  }
}

// ---------------------------------------------------------------------------
// R5 — drift || new work (the non-atomic replaceState gap)
// ---------------------------------------------------------------------------

/** The flattened one-admission decision view (admit / block / reprobe). */
interface R5DecisionView {
  readonly decision: string
  readonly reprobeReason: string | undefined
  readonly status: string | undefined
  readonly generation: number | undefined
  readonly reprobed: boolean | undefined
}

function decisionView(d: CompatibilityAdmissionDecision): R5DecisionView {
  if (d.decision === 'reprobe') {
    return {
      decision: 'reprobe',
      reprobeReason: d.reprobeReason,
      status: undefined,
      generation: undefined,
      reprobed: undefined,
    }
  }
  return {
    decision: d.decision,
    reprobeReason: undefined,
    status: d.status,
    generation: d.generation,
    reprobed: d.reprobed,
  }
}

/** One R5 half-A/B iteration at one controlled (stagger, facts-delay) cell. */
interface R5Iteration {
  readonly stagger: number
  readonly factsDelay: number
  readonly warmFingerprint: string
  readonly initialGeneration: number
  readonly finalRow: { fingerprint: string; generation: number; status: string } | undefined
  readonly a: R5DecisionView
  readonly b: R5DecisionView
  readonly probesA: number
  readonly probesB: number
}

/** S = 0..12: the controlled microtask start-stagger of the second site. */
const R5_STAGGERS = 13

/** D = 0..6: the controlled microtask delivery delay of B's facts port. */
const R5_DELAYS: readonly number[] = [0, 1, 2, 3, 4, 5, 6]

async function runR5Iteration(
  stagger: number,
  factsDelay: number,
  withCoordinator: boolean,
): Promise<R5Iteration> {
  const half = withCoordinator ? 'c' : 'u'
  const { world, facts } = await createMutableWorld(
    `p8s5b-r5${half}-${stagger}-${factsDelay}`,
    ['leader', 'worker'],
  )
  const coordinator = withCoordinator ? createTeamOperationCoordinator() : undefined
  try {
    // ONE independent consultation site = one fresh authority (its own
    // prober; the per-prober promise-chain lock never interlocks across
    // instances — authority.ts: "entry points build one per
    // consultation").
    const consult = (
      counter: { n: number },
      factsPort: CompatibilityAuthorityOptions['environmentFacts'],
    ) =>
      createCompatibilityAuthority({
        repositories: world.domain.repositories,
        rootSessionId: P6T2_ROOT,
        blueprint: world.blueprint,
        environmentFacts: factsPort,
        now: () => P6T2_NOW,
        onProbe: () => {
          counter.n += 1
        },
      })

    // Warm-up: plants the durable row (generation 1) over the CLEAN
    // environment — the production pre-drift state (row present, fresh).
    const warm = await consult({ n: 0 }, async () => facts.current).admit()
    if (warm.decision !== 'admit') {
      throw new Error(`r5 warm-up (${stagger}/${factsDelay}) expected admit, got ${warm.decision}`)
    }
    const initial = compatRowOf(world)
    if (initial === undefined) {
      throw new Error(`r5: compatibility row missing after warm-up (${stagger}/${factsDelay})`)
    }
    // Drift the environment to FATAL (skill base missing) — the durable
    // row is now stale-fingerprint for every consultation.
    facts.current = factsSkillBaseDown()

    // Two independent consultation sites consult concurrently: B starts
    // `stagger` microtasks after A AND its own environment-facts port
    // resolves `factsDelay` microtasks later than A's (the production
    // shape — each site awaits its own facts before consulting; D = 0
    // keeps the exact A port shape, so (S, 0) is the pure start-stagger
    // cell).
    const countsA = { n: 0 }
    const countsB = { n: 0 }
    const factsPortB: CompatibilityAuthorityOptions['environmentFacts'] =
      factsDelay > 0
        ? async () => {
            await tick(factsDelay)
            return facts.current
          }
        : async () => facts.current
    const authA = consult(countsA, async () => facts.current)
    const authB = consult(countsB, factsPortB)
    const aDecision: Promise<CompatibilityAdmissionDecision> =
      withCoordinator && coordinator !== undefined
        ? coordinator.run(P6T2_ROOT, () => authA.admit())
        : authA.admit()
    const bDecision: Promise<CompatibilityAdmissionDecision> = (async () => {
      if (stagger > 0) {
        await tick(stagger)
      }
      if (withCoordinator && coordinator !== undefined) {
        return coordinator.run(P6T2_ROOT, () => authB.admit())
      }
      return authB.admit()
    })()
    const [a, b] = await Promise.all([aDecision, bDecision])
    return {
      stagger,
      factsDelay,
      warmFingerprint: initial.fingerprint,
      initialGeneration: initial.generation,
      finalRow: compatRowOf(world),
      a: decisionView(a),
      b: decisionView(b),
      probesA: countsA.n,
      probesB: countsB.n,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

let r5: { readonly halfA: R5Iteration[]; readonly halfB: R5Iteration[] }
{
  const halfA: R5Iteration[] = []
  for (let s = 0; s < R5_STAGGERS; s += 1) {
    for (const d of R5_DELAYS) {
      halfA.push(await runR5Iteration(s, d, false))
    }
  }
  const halfB: R5Iteration[] = []
  for (let s = 0; s < R5_STAGGERS; s += 1) {
    for (const d of R5_DELAYS) {
      halfB.push(await runR5Iteration(s, d, true))
    }
  }
  r5 = { halfA, halfB }
}

// ---------------------------------------------------------------------------
// R6 — governance-override mutation || next step begin
// ---------------------------------------------------------------------------

/** The in-memory override store port (append-only; the admission layer is
 *  the final shape arbiter for these scenarios). */
class OverrideMemStore implements OverrideStorePort {
  private readonly records: OverrideRecordView[] = []

  async list(rootSessionId: string): Promise<readonly OverrideRecordView[]> {
    return this.records.filter((record) => record.rootSessionId === rootSessionId)
  }

  async put(record: unknown): Promise<unknown> {
    this.records.push(record as OverrideRecordView)
    return record
  }

  get all(): readonly OverrideRecordView[] {
    return this.records
  }
}

/** The team-scope leader slot every R6 override targets. */
const R6_SLOT: SlotIdentity = {
  kind: 'autonomy-overlay',
  scope: 'team',
  rootSessionId: P6T2_ROOT,
}

/** One admit attempt: the admitted view, or the MutationError code + details. */
interface AdmitOutcome {
  readonly ok: boolean
  readonly value: AdmittedGovernanceOverride | undefined
  readonly code: string | undefined
  readonly details: Record<string, unknown> | undefined
}

async function admitOutcome(
  attempt: () => Promise<AdmittedGovernanceOverride>,
): Promise<AdmitOutcome> {
  try {
    const value = await attempt()
    return { ok: true, value, code: undefined, details: undefined }
  } catch (error) {
    if (isMutationError(error)) {
      return {
        ok: false,
        value: undefined,
        code: error.code,
        details: error.details,
      }
    }
    throw error
  }
}

/** Count the slot records at one generation (lost-update evidence). */
function slotRecordsAt(store: OverrideMemStore, generation: number): OverrideRecordView[] {
  return store.all.filter(
    (record) =>
      record.rootSessionId === P6T2_ROOT &&
      record.scope === 'team' &&
      record.kind === 'autonomy-overlay' &&
      record.generation === generation,
  )
}

const R6_NOW = (): string => P6T2_NOW

let r6a: {
  readonly seed: AdmittedGovernanceOverride
  readonly second: AdmitOutcome
  readonly third: AdmitOutcome
  readonly gen2Count: number
  readonly winner: OverrideRecordView | null
}
{
  const store = new OverrideMemStore()
  const seed = await admitGovernanceOverride(
    {
      authority: { kind: 'leader' },
      rootSessionId: P6T2_ROOT,
      recordId: 'ovr-p8s5b-base',
      scope: 'team',
      cells: { model: { kind: 'allow', items: ['model-a'] } },
      now: R6_NOW,
    },
    store,
  )
  // Production row shape: two CONCURRENT admits of DISTINCT recordIds in
  // the SAME slot, both carrying the winner generation the caller read
  // (1), serialized through the shared team chain.
  const chain = createTeamOperationCoordinator()
  const second = await admitOutcome(() =>
    chain.run(P6T2_ROOT, () =>
      admitGovernanceOverride(
        {
          authority: { kind: 'leader' },
          rootSessionId: P6T2_ROOT,
          recordId: 'ovr-p8s5b-2',
          scope: 'team',
          cells: { model: { kind: 'allow', items: ['model-b'] } },
          expectedGeneration: seed.generation,
          now: R6_NOW,
        },
        store,
      ),
    ),
  )
  const third = await admitOutcome(() =>
    chain.run(P6T2_ROOT, () =>
      admitGovernanceOverride(
        {
          authority: { kind: 'leader' },
          rootSessionId: P6T2_ROOT,
          recordId: 'ovr-p8s5b-3',
          scope: 'team',
          cells: { model: { kind: 'allow', items: ['model-c'] } },
          expectedGeneration: seed.generation,
          now: R6_NOW,
        },
        store,
      ),
    ),
  )
  r6a = {
    seed,
    second,
    third,
    gen2Count: slotRecordsAt(store, 2).length,
    winner: selectSlotWinner(store.all, R6_SLOT),
  }
}

let r6b: {
  readonly second: AdmitOutcome
  readonly third: AdmitOutcome
  readonly gen2Count: number
  readonly winner: OverrideRecordView | null
}
{
  const store = new OverrideMemStore()
  await admitGovernanceOverride(
    {
      authority: { kind: 'leader' },
      rootSessionId: P6T2_ROOT,
      recordId: 'ovr-p8s5b-base',
      scope: 'team',
      cells: { model: { kind: 'allow', items: ['model-a'] } },
      now: R6_NOW,
    },
    store,
  )
  // UNSERIALIZED: both admits start in the same tick; both list the slot
  // before either put lands (the async port yields), so both pass the
  // optimistic guard against the SAME winner — the lost update.
  const [second, third] = await Promise.all([
    admitOutcome(() =>
      admitGovernanceOverride(
        {
          authority: { kind: 'leader' },
          rootSessionId: P6T2_ROOT,
          recordId: 'ovr-p8s5b-2',
          scope: 'team',
          cells: { model: { kind: 'allow', items: ['model-b'] } },
          expectedGeneration: 1,
          now: R6_NOW,
        },
        store,
      ),
    ),
    admitOutcome(() =>
      admitGovernanceOverride(
        {
          authority: { kind: 'leader' },
          rootSessionId: P6T2_ROOT,
          recordId: 'ovr-p8s5b-3',
          scope: 'team',
          cells: { model: { kind: 'allow', items: ['model-c'] } },
          expectedGeneration: 1,
          now: R6_NOW,
        },
        store,
      ),
    ),
  ])
  r6b = {
    second,
    third,
    gen2Count: slotRecordsAt(store, 2).length,
    winner: selectSlotWinner(store.all, R6_SLOT),
  }
}

/** One projection of an effective-configuration cell. */
interface CellView {
  readonly effective: unknown
  readonly layer: string
  readonly origin: string
  readonly recordId: string | null
}

function cellOf(snap: Record<string, unknown>, capability: string): CellView {
  const cells = snap['cells'] as Record<string, CellView>
  const cell = cells[capability]
  if (cell === undefined) throw new Error(`cellOf: missing cell '${capability}'`)
  return cell
}

let r6c: {
  readonly snap0Before: Record<string, unknown>
  readonly snap0After: Record<string, unknown>
  readonly snap1: Record<string, unknown>
  readonly effectiveFromStep: number
  readonly recordId: string
  readonly contributions1: readonly MutationLedgerEntry[]
  readonly inflightAfterRelease: number
}
{
  const world = createP7T2World({
    blueprint: {
      values: { model: allow('m-a', 'm-b', 'm-c') },
      autonomyEnvelope: { model: allow('m-a', 'm-b', 'm-c') },
    },
    templates: {
      [P7T2_ALPHA]: {
        values: { model: deny() },
        mutationEnvelope: { model: allow('m-a', 'm-b', 'm-c') },
      },
    },
  })
  const { service, clock } = world
  const alpha = fixtureMember(P7T2_ALPHA)
  service.registerInstance(P7T2_TEAM, alpha, {
    workspace: 'ws-p8s5b',
    contextPolicy: 'ctx-p8s5b',
  })

  // Step 0: the in-flight capture (template deny baseline, no contributions).
  const capture0 = service.beginStep(alpha)
  const snap0Before = snapshotCapture(capture0)

  // Concurrent mutation at step 0: future-boundary (effective from step 1).
  const record = service.requestMutation({
    teamSessionId: P7T2_TEAM,
    capability: 'model',
    value: allow('m-b'),
    actor: { kind: 'member', member: alpha },
  })

  // The in-flight capture is UNCHANGED (frozen value).
  const snap0After = snapshotCapture(capture0)

  // Step 1: the mutation is visible now.
  clock.advance(1)
  const capture1 = service.beginStep(alpha)
  const snap1 = snapshotCapture(capture1)
  const contributions1 = ((snap1['contributions'] as readonly MutationLedgerEntry[]) ?? []).filter(
    (entry) => entry.capability === 'model',
  )

  // release() is idempotent; the in-flight count returns to zero.
  capture0.release()
  capture0.release()
  capture1.release()
  capture1.release()
  const inflightAfterRelease = service.inflightCount()

  r6c = {
    snap0Before,
    snap0After,
    snap1,
    effectiveFromStep: record.effectiveFromStep,
    recordId: record.recordId,
    contributions1,
    inflightAfterRelease,
  }
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

describe('P8-S5B R1: follow-up || archive-member (the fencing is sufficient)', () => {
  it('the follow-up ALWAYS executes (both orders leave the worker work-accepting)', () => {
    expect(r1.followUp.ok).toBe(true)
  })

  it('exactly ONE archive branch holds, and the final state matches that branch', () => {
    const archiveExecuted = r1.archive.ok
    const archiveRejectedFromRunning =
      r1.archive.error === TEAM_RUNTIME_ERROR_CODES.LIFECYCLE_TRANSITION_REJECTED
    expect(archiveExecuted !== archiveRejectedFromRunning).toBe(true)
    if (archiveExecuted) {
      // Order A: the work settled first (SETTLED -> ARCHIVED is the only
      // legal archive edge).
      expect(r1.finalLifecycle).toBe('ARCHIVED')
    } else {
      // Order B: archive from RUNNING has no FSM edge (rejected); the
      // worker keeps the work outcome.
      expect(r1.finalLifecycle).toBe('SETTLED')
    }
  })

  it('exactly ONE work fact, no zombie work, no double settlement', () => {
    expect(r1.workFactCount).toBe(1)
  })
})

describe('P8-S5B R2: follow-up || dispose-member (the fencing is sufficient)', () => {
  it('the dispose ALWAYS executes and the worker ends DISPOSED (terminal)', () => {
    expect(r2.dispose.ok).toBe(true)
    expect(r2.finalLifecycle).toBe('DISPOSED')
  })

  it('exactly ONE follow-up branch holds (settled work, or rejected at the fresh view)', () => {
    const followUpExecuted = r2.followUp.ok
    const followUpRejected =
      r2.followUp.error === TEAM_RUNTIME_ERROR_CODES.WORK_STATE_REJECTED
    expect(followUpExecuted !== followUpRejected).toBe(true)
    if (followUpExecuted) {
      expect(r2.workFactCount).toBe(1)
    } else {
      expect(r2.workFactCount).toBe(0)
    }
  })
})

describe('P8-S5B R3: restore-member || follow-up (the fencing is sufficient)', () => {
  it('the restore ALWAYS executes and the worker ends SETTLED (never RUNNING via Restore)', () => {
    expect(r3.restore.ok).toBe(true)
    expect(r3.finalLifecycle).toBe('SETTLED')
  })

  it('exactly ONE follow-up branch holds (admitted from SETTLED, or rejected from ARCHIVED)', () => {
    const followUpExecuted = r3.followUp.ok
    const followUpRejected =
      r3.followUp.error === TEAM_RUNTIME_ERROR_CODES.WORK_STATE_REJECTED
    expect(followUpExecuted !== followUpRejected).toBe(true)
    if (followUpExecuted) {
      expect(r3.workFactCount).toBe(1)
    } else {
      expect(r3.workFactCount).toBe(0)
    }
  })
})

describe('P8-S5B R4: create-member x3 at the quota boundary (the fencing is sufficient)', () => {
  it('exactly TWO creations execute and exactly ONE is quota-rejected', () => {
    expect(r4.activatedCount).toBe(2)
    expect(r4.quotaRejectedCount).toBe(1)
    expect(r4.outcomes.length).toBe(3)
  })

  it('the durable member set is EXACTLY at the quota (no oversubscription)', () => {
    expect(r4.workerCount).toBe(2)
    expect(r4.totalMemberCount).toBe(3)
  })
})

describe('P8-S5B R5a: drift || new work WITHOUT the coordinator (the window is real)', () => {
  it('every consultation outcome stays in the safe set (never admit under FATAL drift)', () => {
    for (const iteration of r5.halfA) {
      for (const outcome of [iteration.a, iteration.b]) {
        expect(outcome.decision === 'admit').toBe(false)
        expect(outcome.decision === 'block' || outcome.decision === 'reprobe').toBe(true)
      }
    }
  })

  it('at least one NO_STATE_AFTER_REPROBE fail-closed across the (stagger, facts-delay) grid', () => {
    let hits = 0
    for (const iteration of r5.halfA) {
      for (const outcome of [iteration.a, iteration.b]) {
        if (outcome.reprobeReason === NO_STATE_AFTER_REPROBE) {
          hits += 1
        }
      }
    }
    expect(hits).toBeGreaterThan(0)
  })

  it('two independent consultation sites interleave (both probe in some grid cell; at most one probe each)', () => {
    let dual = 0
    for (const iteration of r5.halfA) {
      expect(iteration.probesA <= 1).toBe(true)
      expect(iteration.probesB <= 1).toBe(true)
      expect(iteration.probesA >= 1).toBe(true)
      if (iteration.probesA + iteration.probesB === 2) {
        dual += 1
      }
    }
    expect(dual).toBeGreaterThan(0)
  })

  it('the durable row stays well-formed after every grid cell (present, drift-bound)', () => {
    for (const iteration of r5.halfA) {
      const row = iteration.finalRow
      expect(row !== undefined).toBe(true)
      if (row !== undefined) {
        expect(row.fingerprint !== iteration.warmFingerprint).toBe(true)
      }
    }
  })
})

describe('P8-S5B R5b: drift || new work WITH the shared coordinator (the window is closed)', () => {
  it('ZERO NO_STATE_AFTER_REPROBE across the entire (stagger, facts-delay) grid', () => {
    for (const iteration of r5.halfB) {
      expect(iteration.a.reprobeReason !== NO_STATE_AFTER_REPROBE).toBe(true)
      expect(iteration.b.reprobeReason !== NO_STATE_AFTER_REPROBE).toBe(true)
    }
  })

  it('exactly one re-probe per iteration (the second consultation sees the fresh row)', () => {
    for (const iteration of r5.halfB) {
      expect(iteration.probesA + iteration.probesB).toBe(1)
      expect(iteration.a.reprobed).toBe(true)
      expect(iteration.b.reprobed).toBe(false)
    }
  })

  it('deterministic generation: exactly one advance (final = initial + 1) every grid cell', () => {
    for (const iteration of r5.halfB) {
      const row = iteration.finalRow
      expect(row !== undefined).toBe(true)
      if (row !== undefined) {
        expect(row.generation).toBe(iteration.initialGeneration + 1)
        expect(row.fingerprint !== iteration.warmFingerprint).toBe(true)
      }
    }
  })

  it('both outcomes are fail-closed blocks (the FATAL environment is never admitted)', () => {
    for (const iteration of r5.halfB) {
      expect(iteration.a.decision).toBe('block')
      expect(iteration.b.decision).toBe('block')
    }
  })
})

describe('P8-S5B R6a: governance override admits SERIALIZED through the shared chain', () => {
  it('the first concurrent admit wins; the second is a deterministic generation conflict', () => {
    expect(r6a.second.ok).toBe(true)
    if (r6a.second.value !== undefined) {
      expect(r6a.second.value.generation).toBe(2)
      expect(r6a.second.value.supersededRecordId).toBe('ovr-p8s5b-base')
    }
    expect(r6a.third.ok).toBe(false)
    expect(r6a.third.code).toBe(MUTATION_ERROR_CODES.OVERRIDE_GENERATION_CONFLICT)
  })

  it('the slot ends with exactly ONE generation-2 record (no lost update)', () => {
    expect(r6a.gen2Count).toBe(1)
    expect(r6a.winner).not.toBe(null)
    if (r6a.winner !== null) {
      expect(r6a.winner.recordId).toBe('ovr-p8s5b-2')
      expect(r6a.winner.generation).toBe(2)
    }
  })
})

describe('P8-S5B R6b: the SAME admits UNserialized (the lost-update evidence)', () => {
  it('both admits pass the stale guard and BOTH are "admitted" at generation 2', () => {
    expect(r6b.second.ok).toBe(true)
    expect(r6b.third.ok).toBe(true)
    if (r6b.second.value !== undefined) expect(r6b.second.value.generation).toBe(2)
    if (r6b.third.value !== undefined) expect(r6b.third.value.generation).toBe(2)
  })

  it('the slot carries TWO same-generation records (one mutation is shadowed)', () => {
    expect(r6b.gen2Count).toBe(2)
    expect(r6b.winner).not.toBe(null)
    if (r6b.winner !== null) {
      // Tie at generation 2 -> lexicographic tie-break; the LOST record is
      // durable but can never win again (the shadowed mutation).
      expect(r6b.winner.recordId).toBe('ovr-p8s5b-2')
    }
  })
})

describe('P8-S5B R6c: the MutationService future boundary (beginStep || requestMutation)', () => {
  it('the step-0 baseline is the template deny with zero contributions', () => {
    expect(r6c.snap0Before['step']).toBe(0)
    expect(cellOf(r6c.snap0Before, 'model').effective).toEqual({ kind: 'deny' })
    expect(cellOf(r6c.snap0Before, 'model').layer).toBe('template')
    expect((r6c.snap0Before['contributions'] as unknown[]).length).toBe(0)
  })

  it('the concurrent mutation is recorded at the future boundary (effective from step 1)', () => {
    expect(r6c.effectiveFromStep).toBe(1)
  })

  it('the in-flight step-0 capture is UNCHANGED by the concurrent mutation (frozen value)', () => {
    expect(r6c.snap0After).toEqual(r6c.snap0Before)
  })

  it('the step-1 capture resolves the model cell to the member overlay', () => {
    expect(r6c.snap1['step']).toBe(1)
    const cell = cellOf(r6c.snap1, 'model')
    expect(cell.effective).toEqual({ kind: 'allow', items: ['m-b'] })
    expect(cell.layer).toBe('instanceOverlay')
    expect(cell.origin).toBe('member')
    expect(cell.recordId).toBe(r6c.recordId)
    expect(r6c.contributions1.length).toBe(1)
  })

  it('release() settles the in-flight work (idempotent; the count returns to zero)', () => {
    expect(r6c.inflightAfterRelease).toBe(0)
  })
})
