/**
 * p6t1-helpers — shared world factory and fakes for the P6-T1
 * (ActivationProvider) tests (TaskDoc §11.7 P6-T1; DevPlan §19.2).
 *
 * Contents:
 *
 * - {@link P6T1_FIXTURE} — the P6-T1 fixture identities (distinct from the
 *   P4 / P5 fixture values);
 * - {@link P6T1_BLUEPRINT_SOURCE} — the fixture blueprint (two member
 *   templates — `worker` persistent, `scout` fresh_per_delegation — one
 *   optional + one required compatibility requirement, mutation envelopes,
 *   team + per-member quotas);
 * - {@link parseFixtureBlueprint} / {@link createP6T1Catalog} — the REAL
 *   blueprint parse + catalog over the fixture source;
 * - {@link makeEnvironmentFacts} — the default OPEN environment facts
 *   (both probeable requirements available);
 * - {@link makeExternalPolicyFacts} — the empty external hard-policy facts;
 * - {@link FakeChildSessionFactory} — the mock-first
 *   {@link ChildSessionFactoryPort}: deterministic child ids per
 *   `(rootSessionId, instanceId)` (the idempotency contract), call
 *   recording, one-shot fault injection;
 * - {@link createP6T1World} — one durable TeamDomain world over the testkit
 *   `FileStorageSeam` (the REAL repositories + the REAL provider), the
 *   mock-first surface / durability / factory, and the seam's
 *   `writeCount` / `writeLog` as the zero-write + ordering proof channel;
 * - {@link restartP6T1World} — the process-restart model (DevPlan §18.5):
 *   a NEW seam over the SAME scratch dir re-opens the durable domain with a
 *   FRESH surface and a FRESH child factory (the ephemeral state is lost,
 *   the durable state survives);
 * - {@link destroyP6T1World} — close + destroy the scratch dir.
 *
 * The seam's durable write log (one entry per committed write:
 * `{domain, table, key, op}`) is the authoritative durable-write evidence:
 * every persistent write of the provider flows through the TeamDomain
 * repositories (invariant 41), and the repositories flow through the seam.
 *
 * @module dsh-agent-team/runtime/test/p6t1-helpers
 */

import {
  LEADER_INSTANCE_ID,
  createBlueprintSnapshotRef,
  parseBlueprintContentHash,
  parseBlueprintId,
  parseBlueprintRevision,
  parseChildSessionId,
  parseInstanceId,
  parseRootSessionId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import type { MemberInstanceRecordDto } from '../../contracts/src/index.js'
import {
  createBlueprintCatalog,
  parseBlueprint,
} from '../../domain/blueprint/src/index.js'
import type { TeamBlueprint } from '../../domain/blueprint/src/index.js'
import type { EnvironmentFact } from '../../domain/compatibility/src/index.js'
import type { ExternalPolicyFacts } from '../../domain/policy/src/index.js'
import {
  createTeamDomain,
  openTeamDomain,
} from '../../storage/repositories/index.js'
import type { TeamDomain } from '../../storage/repositories/index.js'
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
} from '../../testkit/fault-injection/file-seam.mjs'
import { createActivationProvider } from '../activation/index.js'
import type {
  ActivationProvider,
  ActivationProjectionEvent,
  MemberActivationRequest,
} from '../activation/index.js'
import { FakeAgentSetupSurface } from './p5t1-helpers.js'
import { FakeSessionDurability, captureError } from './p5t6-helpers.js'
import type { AdmissionGuard, OverlaySlot, OverlaySlotName } from '../agent-setup/binder/index.js'

/** The P6-T1 fixture identities (frozen contracts v1 branded ids). */
export const P6T1_FIXTURE = {
  rootSessionId: parseRootSessionId('session-root-p6t1'),
  leaderTemplateId: parseTemplateId('leader'),
  workerTemplateId: parseTemplateId('worker'),
  scoutTemplateId: parseTemplateId('scout'),
  defaultWorkspace: 'C:/agent-team/work/p6t1',
  createdAt: '2026-08-30T08:00:00Z',
} as const

/**
 * The fixture blueprint source (the closed v1 schema): two member templates
 * (`worker` = default persistent context, `scout` = fresh_per_delegation),
 * one OPTIONAL tool requirement (ack-able WARNING when unmet) and one
 * REQUIRED skill requirement (FATAL when unmet), mutation envelopes, and
 * team + per-member quotas (the quota-race gate fixture).
 */
export const P6T1_BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: P6T1-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the P6T1 team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the P6T1 work.',
  '  - templateId: scout',
  '    displayName: Scout',
  '    persona: You scout for the P6T1 team.',
  '    contextPolicy: fresh_per_delegation',
  'requirements:',
  '  - domain: tool',
  '    name: web',
  '    optional: true',
  '  - domain: skill',
  '    name: base',
  'teamEnvelope:',
  '  allow:',
  '    - create-member',
  '    - assign-task',
  '  deny:',
  '    - delete-team',
  'memberEnvelopes:',
  '  - templateId: worker',
  '    envelope:',
  '      allow:',
  '        - web.search',
  '      deny: []',
  '  - templateId: scout',
  '    envelope:',
  '      allow: []',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: The P6T1 default state.',
  'quotas:',
  '  team:',
  '    maxInstances: 4',
  '    maxConcurrent: 3',
  '  members:',
  '    maxInstances: 2',
  'metadata: {}',
  '---',
  '',
].join('\n')

/** The fixture blueprint (parsed; contentHash derived from the source). */
export function parseFixtureBlueprint(): TeamBlueprint {
  return parseBlueprint(P6T1_BLUEPRINT_SOURCE)
}

/** A REAL blueprint catalog holding the fixture blueprint (+ any extras). */
export function createP6T1Catalog(extra: readonly TeamBlueprint[] = []) {
  return createBlueprintCatalog([parseFixtureBlueprint(), ...extra])
}

/**
 * The default environment facts: every probeable fixture requirement
 * available at generation 1 (the compatibility status is OPEN). Pass
 * overrides to model degraded environments (e.g. `web` unavailable →
 * BLOCKED_WARNING for the optional requirement).
 */
export function makeEnvironmentFacts(
  overrides: readonly EnvironmentFact[] = [],
): EnvironmentFact[] {
  const base: EnvironmentFact[] = [
    { domain: 'tool', subject: 'web', available: true, generation: 1 },
    { domain: 'skill', subject: 'base', available: true, generation: 1 },
  ]
  const key = (f: EnvironmentFact) => `${f.domain}\u0000${f.subject}`
  const byKey = new Map<string, EnvironmentFact>(base.map((f) => [key(f), f]))
  for (const fact of overrides) byKey.set(key(fact), fact)
  return [...byKey.values()]
}

/** The empty external hard-policy facts (no hard entries, nothing suppressed). */
export function makeExternalPolicyFacts(): ExternalPolicyFacts {
  return { hard: {}, capabilityExists: {} }
}

/** One recorded child-session factory call. */
export interface FakeChildFactoryCall {
  readonly rootSessionId: string
  readonly instanceId: string
  readonly templateId: string
  readonly label: string
  readonly workspace?: string
}

/**
 * The mock-first {@link ChildSessionFactoryPort}:
 *
 * - deterministic child session id per `(rootSessionId, instanceId)` — the
 *   port's idempotency contract (a re-drive after a crash returns the SAME
 *   child, never a second one);
 * - call recording (the "exactly one external effect per instance" proof
 *   channel — idempotent re-calls are recorded but return the same child);
 * - one-shot fault injection.
 */
export class FakeChildSessionFactory {
  /** Every factory call, in order (including idempotent re-calls). */
  readonly calls: FakeChildFactoryCall[] = []
  /** The created children, keyed by `${root}\u0000${instance}`. */
  private readonly children = new Map<string, string>()
  private nextFault: Error | undefined = undefined

  createChildSession(request: {
    rootSessionId: string
    instanceId: string
    templateId: string
    label: string
    workspace?: string
  }): Promise<{ childSessionId: string }> {
    const call: FakeChildFactoryCall = {
      rootSessionId: request.rootSessionId,
      instanceId: request.instanceId,
      templateId: request.templateId,
      label: request.label,
      ...(request.workspace !== undefined ? { workspace: request.workspace } : {}),
    }
    this.calls.push(call)
    if (this.nextFault !== undefined) {
      const fault = this.nextFault
      this.nextFault = undefined
      return Promise.reject(fault)
    }
    const k = `${request.rootSessionId}\u0000${request.instanceId}`
    let child = this.children.get(k)
    if (child === undefined) {
      const token = request.instanceId.replace(/^inst-/, '')
      child = String(parseChildSessionId(`session-child-p6t1-${token}`))
      this.children.set(k, child)
    }
    return Promise.resolve({ childSessionId: child })
  }

  /** The child session id previously created for (root, instance), if any. */
  childOf(rootSessionId: string, instanceId: string): string | undefined {
    return this.children.get(`${rootSessionId}\u0000${instanceId}`)
  }

  /** The number of DISTINCT children created (idempotent re-calls don't add). */
  get distinctChildren(): number {
    return this.children.size
  }

  /** Inject a fault into the NEXT factory call only. */
  failNext(fault: Error): void {
    this.nextFault = fault
  }
}

/** One durable seam write (mirrors the seam's writeLog entry shape). */
export interface SeamWrite {
  readonly domain: string
  readonly table: string
  readonly key: string
  readonly op: string
}

/** The optional world wiring (all mock-first ports). */
export interface P6T1WorldOptions {
  /** Override the fixture blueprint source (e.g. different quotas for the
   *  parallel/quota-race tests). The TeamSession record is seeded with the
   *  overridden blueprint's snapshot ref, and the catalog holds it. */
  readonly blueprintSource?: string
  /** Extra catalog entries (for the hash-mismatch / unresolvable tests). */
  readonly catalogExtra?: readonly TeamBlueprint[]
  /** Override the TeamSession seed's bound blueprint snapshot ref (for the
   *  BLUEPRINT_UNRESOLVED / BLUEPRINT_HASH_MISMATCH tests: a revision the
   *  catalog does not hold, or a content hash the catalog's blueprint does
   *  not carry). */
  readonly blueprintRef?: {
    readonly blueprintId: string
    readonly revision: string
    readonly contentHash: string
  }
  /** The environment facts port (default: OPEN facts). */
  readonly environmentFacts?: () => Promise<readonly EnvironmentFact[]>
  /** The external policy facts port (default: empty facts). */
  readonly externalPolicyFacts?: () => Promise<ExternalPolicyFacts>
  /** Binder slot overrides. */
  readonly slots?: Partial<Record<OverlaySlotName, OverlaySlot>>
  /** The binder admission guard (default: the admitting guard). */
  readonly admissionGuard?: AdmissionGuard
  /** The projection publisher (default: a recording publisher). */
  readonly projectionPublisher?: (event: ActivationProjectionEvent) => void
  /** Seed extra committed member records (for the delegation-continue tests). */
  readonly seedMembers?: readonly Partial<MemberInstanceRecordDto>[]
}

/** One durable TeamDomain world wired with the ActivationProvider. */
export interface P6T1World {
  /** The scratch dir backing the seam (destroyed by `destroyP6T1World`). */
  readonly scratchDir: string
  /** The file seam (the `writeCount` / `writeLog` zero-write proof channel). */
  readonly seam: FileStorageSeam
  /** The open durable domain. */
  readonly domain: TeamDomain
  /** The fixture blueprint (parsed from the fixture source). */
  readonly blueprint: TeamBlueprint
  /** The REAL blueprint catalog. */
  readonly catalog: ReturnType<typeof createP6T1Catalog>
  /** The mock-first agent-setup surface. */
  readonly surface: FakeAgentSetupSurface
  /** The mock-first child-Session durability barrier. */
  readonly durability: FakeSessionDurability
  /** The mock-first child-session factory (the one external effect). */
  readonly childFactory: FakeChildSessionFactory
  /** Every projection event published, in order. */
  readonly projections: ActivationProjectionEvent[]
  /** The provider under test. */
  readonly provider: ActivationProvider
  /** The ports this world is wired with (for rebuilding after restart). */
  readonly ports: {
    readonly environmentFacts: () => Promise<readonly EnvironmentFact[]>
    readonly externalPolicyFacts: () => Promise<ExternalPolicyFacts>
    readonly slots?: Partial<Record<OverlaySlotName, OverlaySlot>>
    readonly admissionGuard?: AdmissionGuard
    readonly projectionPublisher?: (event: ActivationProjectionEvent) => void
  }
  /** The seam write count right after seeding (the zero-write baseline). */
  readonly seedWriteCount: number
  /**
   * The seam write log since the seeding baseline (the ordering /
   * zero-write evidence for provider calls).
   */
  readonly writesSinceSeed: () => SeamWrite[]
}

/**
 * Build one durable world: a REAL TeamDomain over a fresh scratch dir
 * (seeded with the TeamSession record + the team-root binding), a REAL
 * blueprint catalog over the fixture source, and the mock-first ports.
 *
 * @param basename - the scratch dir basename (unique per test).
 * @param options - optional port wiring (see {@link P6T1WorldOptions}).
 */
export async function createP6T1World(
  basename: string,
  options: P6T1WorldOptions = {},
): Promise<P6T1World> {
  const dir = scratchDir(basename)
  const seam = new FileStorageSeam(dir)
  const domain = await createTeamDomain(seam)
  const blueprint =
    options.blueprintSource !== undefined
      ? parseBlueprint(options.blueprintSource)
      : parseFixtureBlueprint()
  const catalog =
    options.blueprintSource !== undefined
      ? createBlueprintCatalog([blueprint, ...(options.catalogExtra ?? [])])
      : createP6T1Catalog(options.catalogExtra)

  // Seed the durable TeamSession + team-root binding (the pre-existing team).
  const repositories = domain.repositories
  const ref = options.blueprintRef ?? {
    blueprintId: String(blueprint.blueprintId),
    revision: String(blueprint.revision),
    contentHash: String(blueprint.contentHash),
  }
  await repositories.teamSessions.put({
    rootSessionId: P6T1_FIXTURE.rootSessionId,
    blueprint: createBlueprintSnapshotRef({
      blueprintId: parseBlueprintId(ref.blueprintId),
      revision: parseBlueprintRevision(ref.revision),
      contentHash: parseBlueprintContentHash(ref.contentHash),
    }),
    defaultWorkspace: P6T1_FIXTURE.defaultWorkspace,
    createdAt: P6T1_FIXTURE.createdAt,
    generation: 1,
  })
  await repositories.sessionBindings.put({
    kind: 'team-root',
    schemaVersion: 1,
    sessionId: P6T1_FIXTURE.rootSessionId,
  })
  for (const seed of options.seedMembers ?? []) {
    const input = {
      rootSessionId: P6T1_FIXTURE.rootSessionId,
      instanceId: parseInstanceId(String(seed.instanceId ?? 'inst-seed-p6t1')),
      templateId: parseTemplateId(String(seed.templateId ?? 'worker')),
      label: String(seed.label ?? 'seed-member'),
      ...(seed.groupId !== undefined ? { groupId: String(seed.groupId) } : {}),
      childSessionId: parseChildSessionId(
        String(seed.childSessionId ?? 'session-child-p6t1-seed'),
      ),
      ...(seed.workspace !== undefined ? { workspace: String(seed.workspace) } : {}),
      lifecycle: (seed.lifecycle as MemberInstanceRecordDto['lifecycle']) ?? 'CREATED',
      createdAt: String(seed.createdAt ?? P6T1_FIXTURE.createdAt),
      activityVersion: seed.activityVersion ?? 1,
    }
    await repositories.memberInstances.put(input)
  }
  const seedWriteCount = seam.writeCount

  const surface = new FakeAgentSetupSurface()
  const durability = new FakeSessionDurability()
  const childFactory = new FakeChildSessionFactory()
  const projections: ActivationProjectionEvent[] = []
  const projectionPublisher = options.projectionPublisher ?? ((event) => {
    projections.push(event)
  })
  const environmentFacts = options.environmentFacts ?? (async () => makeEnvironmentFacts())
  const externalPolicyFacts = options.externalPolicyFacts ?? (async () => makeExternalPolicyFacts())
  const provider = createActivationProvider({
    teamDomain: domain,
    blueprintCatalog: catalog,
    environmentFacts,
    externalPolicyFacts,
    childSessionFactory: childFactory,
    sessionDurability: durability,
    surface,
    ...(options.slots !== undefined ? { slots: options.slots } : {}),
    ...(options.admissionGuard !== undefined ? { admissionGuard: options.admissionGuard } : {}),
    projectionPublisher,
  })

  return {
    scratchDir: dir,
    seam,
    domain,
    blueprint,
    catalog,
    surface,
    durability,
    childFactory,
    projections,
    provider,
    ports: {
      environmentFacts,
      externalPolicyFacts,
      ...(options.slots !== undefined ? { slots: options.slots } : {}),
      ...(options.admissionGuard !== undefined ? { admissionGuard: options.admissionGuard } : {}),
      ...(options.projectionPublisher !== undefined
        ? { projectionPublisher: options.projectionPublisher }
        : {}),
    },
    seedWriteCount,
    writesSinceSeed: () => seam.writeLog.slice(seedWriteCount) as unknown as SeamWrite[],
  }
}

/**
 * The process-restart model (DevPlan §18.5): close the old domain, open a
 * NEW seam over the SAME scratch dir (the durable records survive), and
 * re-wire the provider with a FRESH surface + factory + durability (the
 * ephemeral state is lost — the coordinator cache is per-provider, so a
 * fresh provider is the honest restart shape).
 *
 * @param world - the world to restart.
 * @param basename - ignored (the scratch dir is shared); kept for symmetry.
 * @returns the re-wired world over the same scratch dir.
 */
export async function restartP6T1World(world: P6T1World): Promise<P6T1World> {
  await world.domain.close()
  const seam = new FileStorageSeam(world.scratchDir)
  const domain = await openTeamDomain(seam)
  const blueprint = world.blueprint
  const catalog = world.catalog
  const repositories = domain.repositories
  const seedWriteCount = seam.writeCount
  const surface = new FakeAgentSetupSurface()
  const durability = new FakeSessionDurability()
  const childFactory = new FakeChildSessionFactory()
  const projections: ActivationProjectionEvent[] = []
  // A user-supplied publisher survives the restart; the default one
  // re-wires to the NEW world's own projection array.
  const projectionPublisher =
    world.ports.projectionPublisher ?? ((event) => {
      projections.push(event)
    })
  const provider = createActivationProvider({
    teamDomain: domain,
    blueprintCatalog: catalog,
    environmentFacts: world.ports.environmentFacts,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    childSessionFactory: childFactory,
    sessionDurability: durability,
    surface,
    ...(world.ports.slots !== undefined ? { slots: world.ports.slots } : {}),
    ...(world.ports.admissionGuard !== undefined ? { admissionGuard: world.ports.admissionGuard } : {}),
    projectionPublisher,
  })
  return {
    scratchDir: world.scratchDir,
    seam,
    domain,
    blueprint,
    catalog,
    surface,
    durability,
    childFactory,
    projections,
    provider,
    ports: world.ports,
    seedWriteCount,
    writesSinceSeed: () => seam.writeLog.slice(seedWriteCount) as unknown as SeamWrite[],
  }
}

/** Close the world's domain and destroy the scratch dir. */
export async function destroyP6T1World(world: P6T1World): Promise<void> {
  await world.domain.close()
  destroyDir(world.scratchDir)
}

/**
 * Build one activation request with the P6-T1 defaults (leader-explicit
 * `worker` activation); override any field for the test.
 */
export function makeRequest(
  overrides: Partial<MemberActivationRequest> = {},
): MemberActivationRequest {
  return {
    rootSessionId: String(P6T1_FIXTURE.rootSessionId),
    source: 'leader-explicit',
    templateId: String(P6T1_FIXTURE.workerTemplateId),
    label: 'p6t1-member',
    requestToken: 'tok-p6t1-default',
    callerId: String(LEADER_INSTANCE_ID),
    ...overrides,
  }
}

/** The leader-delegate request default (template-level `worker` delegation). */
export function makeDelegateRequest(
  overrides: Partial<MemberActivationRequest> = {},
): MemberActivationRequest {
  return {
    rootSessionId: String(P6T1_FIXTURE.rootSessionId),
    source: 'leader-delegate',
    delegation: { templateId: String(P6T1_FIXTURE.workerTemplateId) },
    label: 'p6t1-delegated',
    requestToken: 'tok-p6t1-delegate',
    callerId: String(LEADER_INSTANCE_ID),
    ...overrides,
  }
}

/**
 * Assert that `error` is an ActivationError with the exact code; return the
 * error for further detail assertions. (The test shim has no toThrow
 * matchers beyond the basics, so the error is captured explicitly.)
 */
export function assertActivationCode(
  error: unknown,
  code: string,
): { code: string; details?: Record<string, unknown> } {
  const record = (error ?? {}) as {
    name?: unknown
    code?: unknown
    details?: unknown
  }
  if (record.name !== 'ActivationError' || record.code !== code) {
    const actual =
      error instanceof Error
        ? `${record.name ?? error.name}/${record.code ?? 'n/a'}: ${error.message}`
        : String(error)
    throw new Error(`assertActivationCode: expected ActivationError code '${code}' but got ${actual}`)
  }
  const details = record.details
  return {
    code: String(record.code),
    ...(details !== undefined && typeof details === 'object' ? { details: details as Record<string, unknown> } : {}),
  }
}

export { captureError, FakeAgentSetupSurface, FakeSessionDurability, LEADER_INSTANCE_ID }
