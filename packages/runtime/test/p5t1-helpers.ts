/**
 * p5t1-helpers — shared fixtures and fakes for the P5-T1 (TeamAgentBinder)
 * tests (TaskDoc §11.5 must-test groups 1–3).
 *
 * Contents:
 *
 * - {@link P5T1_FIXTURE} — the P5-T1 fixture identities (frozen contracts
 *   v1 branded ids), distinct from the P4 fixture values;
 * - {@link seedTeamWorld} — a durable TeamDomain world over the testkit
 *   `FileStorageSeam` (one TeamSession + `team-root` binding, one
 *   MemberInstance + `team-member` child binding, one `ordinary` binding),
 *   the durable truth the binder READS (the binder never writes it);
 * - {@link restartTeamWorld} — the process-restart model: a NEW seam
 *   instance over the SAME scratch dir, re-opening the durable domain
 *   (the durable files outlive the realm; the Agent residency is gone);
 * - {@link FakeAgentSetupSurface} — the mock-first injected
 *   `TeamAgentSetupSurface` (ruling R28: mock-first in T1): records every
 *   call, simulates the ephemeral residency (installed-slot state), and
 *   supports one-shot fault injection per effect channel;
 * - slot / guard factories: {@link recordingSlot} (records its slot
 *   contexts; optional one-shot apply fault), {@link rejectingGuard},
 *   {@link throwingGuard}.
 *
 * Test-only module (no `.test.ts` suffix): never imported by production
 * code.
 * @module @dsh-agent-team/runtime/test/p5t1-helpers
 */

import {
  createBlueprintSnapshotRef,
  parseBlueprintContentHash,
  parseBlueprintId,
  parseBlueprintRevision,
  parseChildSessionId,
  parseInstanceId,
  parseRootSessionId,
  parseSessionId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import { createTeamDomain, openTeamDomain } from '../../storage/repositories/index.js'
import type { TeamDomain } from '../../storage/repositories/index.js'
import { destroyDir, FileStorageSeam, scratchDir } from '../../testkit/fault-injection/file-seam.mjs'
import { createTeamDomainReadHandle } from '../agent-setup/binder/index.js'
import type {
  AdmissionGuard,
  AgentSetupEventRecord,
  OverlaySlot,
  OverlaySlotName,
  RestoredScope,
  TeamAgentStepContext,
  TeamAgentSetupSurface,
} from '../agent-setup/binder/index.js'

/** The P5-T1 fixture identities (frozen contracts v1 branded ids). */
export const P5T1_FIXTURE = {
  rootSessionId: parseRootSessionId('session-root-p5t1'),
  childSessionId: parseChildSessionId('session-child-p5t1'),
  ordinarySessionId: parseSessionId('session-ordinary-p5t1'),
  instanceId: parseInstanceId('inst-p5t1alpha'),
  templateId: parseTemplateId('p5t1worker'),
  blueprint: createBlueprintSnapshotRef({
    blueprintId: parseBlueprintId('P5T1-BP'),
    revision: parseBlueprintRevision('1'),
    contentHash: parseBlueprintContentHash('sha256-0123456789abcdef0123456789abcdef'),
  }),
  createdAt: '2026-08-30T00:00:00Z',
}

/** The plain-string identities of one seeded world (for binder calls). */
export interface P5T1WorldIds {
  readonly rootSessionId: string
  readonly childSessionId: string
  readonly ordinarySessionId: string
  readonly instanceId: string
}

/** One seeded durable TeamDomain world (the binder's read-only truth). */
export interface P5T1World {
  /** The scratch dir backing the seam (destroy in the test's `finally`). */
  readonly scratchDir: string
  /** The file seam (exposes `writeLog` / `writeCount` for zero-write proof). */
  readonly seam: FileStorageSeam
  /** The open durable domain (repositories = the read handle's source). */
  readonly domain: TeamDomain
  /** The plain-string identities of the seeded sessions/instance. */
  readonly ids: P5T1WorldIds
}

/**
 * Seed one durable TeamDomain world over a FRESH scratch dir with optional
 * record omissions / overrides (the error-path worlds):
 *
 * - by default the FULL world (see the individual flags);
 * - `teamSession: false` — no TeamSession record (the root NOT_FOUND world);
 * - `memberInstance: false` — no MemberInstance record (the member
 *   NOT_FOUND world);
 * - `memberLifecycle` — the seeded MemberInstance lifecycle (the DISPOSED
 *   world uses `'DISPOSED'`);
 * - `memberChildSessionId` — override the MemberInstance record's
 *   `childSessionId` (the RECORD_CONFLICT world: the binding and the
 *   record disagree);
 * - `teamRootBinding` / `teamMemberBinding` / `ordinaryBinding` — the
 *   session-kind binding rows.
 *
 * @param basename - the scratch dir basename (unique per test).
 */
export interface P5T1PartialWorldOptions {
  /** Seed the TeamSession record (default true). */
  readonly teamSession?: boolean
  /** Seed the team-root binding row (default true). */
  readonly teamRootBinding?: boolean
  /** Seed the MemberInstance record (default true). */
  readonly memberInstance?: boolean
  /** Seed the team-member binding row (default true). */
  readonly teamMemberBinding?: boolean
  /** Seed the ordinary binding row (default true). */
  readonly ordinaryBinding?: boolean
  /** The seeded MemberInstance lifecycle (default `'CREATED'`). */
  readonly memberLifecycle?: 'CREATED' | 'RUNNING' | 'SETTLED' | 'ARCHIVED' | 'DISPOSED'
  /** Override the MemberInstance record's `childSessionId` (conflict world). */
  readonly memberChildSessionId?: string
}

export async function seedPartialWorld(
  basename: string,
  options: P5T1PartialWorldOptions = {},
): Promise<P5T1World> {
  const dir = scratchDir(basename)
  const seam = new FileStorageSeam(dir)
  const domain = await createTeamDomain(seam)
  const root = String(P5T1_FIXTURE.rootSessionId)
  const child = String(P5T1_FIXTURE.childSessionId)
  const ordinary = String(P5T1_FIXTURE.ordinarySessionId)
  const instance = String(P5T1_FIXTURE.instanceId)

  if (options.teamSession !== false) {
    await domain.repositories.teamSessions.put({
      blueprint: P5T1_FIXTURE.blueprint,
      createdAt: P5T1_FIXTURE.createdAt,
      defaultWorkspace: 'C:/agent-team/work/p5t1',
      generation: 1,
      rootSessionId: P5T1_FIXTURE.rootSessionId,
    })
  }
  if (options.teamRootBinding !== false) {
    await domain.repositories.sessionBindings.put({ kind: 'team-root', schemaVersion: 1, sessionId: root })
  }
  if (options.memberInstance !== false) {
    await domain.repositories.memberInstances.put({
      activityVersion: 1,
      childSessionId: parseChildSessionId(options.memberChildSessionId ?? child),
      createdAt: P5T1_FIXTURE.createdAt,
      groupId: 'grp-p5t1',
      instanceId: P5T1_FIXTURE.instanceId,
      label: 'p5t1-worker',
      lifecycle: options.memberLifecycle ?? 'CREATED',
      rootSessionId: P5T1_FIXTURE.rootSessionId,
      templateId: P5T1_FIXTURE.templateId,
      workspace: 'C:/agent-team/work/p5t1-worker',
    })
  }
  if (options.teamMemberBinding !== false) {
    await domain.repositories.sessionBindings.put({
      instanceId: instance,
      kind: 'team-member',
      rootSessionId: root,
      schemaVersion: 1,
      sessionId: child,
    })
  }
  if (options.ordinaryBinding !== false) {
    await domain.repositories.sessionBindings.put({ kind: 'ordinary', schemaVersion: 1, sessionId: ordinary })
  }

  return {
    scratchDir: dir,
    seam,
    domain,
    ids: { rootSessionId: root, childSessionId: child, ordinarySessionId: ordinary, instanceId: instance },
  }
}

/** Seed the FULL durable world (TeamSession + member + both bindings + ordinary). */
export async function seedTeamWorld(basename: string): Promise<P5T1World> {
  return seedPartialWorld(basename)
}

/**
 * The process-restart model (DevPlan §18.5): a NEW `FileStorageSeam`
 * instance over the SAME scratch dir re-opens the durable TeamDomain. The
 * durable records survive; the ephemeral Agent residency does NOT (the
 * caller's fake surface starts with an empty residency).
 *
 * @param dir - the scratch dir of an already seeded world.
 * @returns the reopened durable domain (repositories usable for a read handle).
 */
export async function restartTeamWorld(dir: string): Promise<TeamDomain> {
  const seam = new FileStorageSeam(dir)
  return openTeamDomain(seam)
}

/** One recorded call of the {@link FakeAgentSetupSurface}. */
export interface FakeSurfaceCall {
  readonly method: 'getInstalledSlots' | 'installOverlay' | 'restoreScope' | 'recordSessionEvent'
  readonly sessionId: string
  /** The slot (installOverlay). */
  readonly slot?: string
  /** The restored scope (restoreScope). */
  readonly scope?: RestoredScope
  /** The recorded event (recordSessionEvent). */
  readonly event?: AgentSetupEventRecord
}

/**
 * The mock-first injected `TeamAgentSetupSurface` (ruling R28): records
 * every COMPLETED call in `calls` (a call that throws is not recorded —
 * the effect did not happen), simulates the EPHEMERAL residency
 * (installed-slot state per session — `installOverlay` adds one slot
 * idempotently, `restoreScope` sets the full slot set), and supports
 * one-shot fault injection per effect channel (`failNextInstall` /
 * `failNextRestore` / `failNextRecordEvent`) plus `dropResidency` (the
 * residency is lost, e.g. after a restart — the durable world is
 * untouched).
 */
export class FakeAgentSetupSurface implements TeamAgentSetupSurface {
  /** Every completed call, in order (the call-recording evidence). */
  readonly calls: FakeSurfaceCall[] = []
  private readonly residency = new Map<string, Set<string>>()
  private nextInstallFault: Error | undefined
  private nextRestoreFault: Error | undefined
  private nextRecordEventFault: Error | undefined

  getInstalledSlots(sessionId: string): readonly string[] {
    this.calls.push({ method: 'getInstalledSlots', sessionId })
    const slots = this.residency.get(sessionId)
    return slots === undefined ? [] : [...slots]
  }

  installOverlay(sessionId: string, slot: OverlaySlotName): void {
    if (this.nextInstallFault !== undefined) {
      const fault = this.nextInstallFault
      this.nextInstallFault = undefined
      throw fault
    }
    this.calls.push({ method: 'installOverlay', sessionId, slot })
    let slots = this.residency.get(sessionId)
    if (slots === undefined) {
      slots = new Set<string>()
      this.residency.set(sessionId, slots)
    }
    slots.add(String(slot))
  }

  restoreScope(sessionId: string, scope: RestoredScope): void {
    if (this.nextRestoreFault !== undefined) {
      const fault = this.nextRestoreFault
      this.nextRestoreFault = undefined
      throw fault
    }
    this.calls.push({ method: 'restoreScope', sessionId, scope })
    this.residency.set(sessionId, new Set(scope.slots.map(String)))
  }

  recordSessionEvent(sessionId: string, event: AgentSetupEventRecord): void {
    if (this.nextRecordEventFault !== undefined) {
      const fault = this.nextRecordEventFault
      this.nextRecordEventFault = undefined
      throw fault
    }
    this.calls.push({ method: 'recordSessionEvent', sessionId, event })
  }

  /** Arm a one-shot fault on the NEXT `installOverlay` (the binder must fail-closed). */
  failNextInstall(fault: Error): void {
    this.nextInstallFault = fault
  }

  /** Arm a one-shot fault on the NEXT `restoreScope` (the binder must fail-closed). */
  failNextRestore(fault: Error): void {
    this.nextRestoreFault = fault
  }

  /** Arm a one-shot fault on the NEXT `recordSessionEvent` (the binder must fail-closed). */
  failNextRecordEvent(fault: Error): void {
    this.nextRecordEventFault = fault
  }

  /** Simulate the loss of the ephemeral residency of one session (durable world untouched). */
  dropResidency(sessionId: string): void {
    this.residency.delete(sessionId)
  }

  /** Count the recorded calls of one method (optionally restricted to one session). */
  countCalls(method: FakeSurfaceCall['method'], sessionId?: string): number {
    return this.calls.filter(
      (call) => call.method === method && (sessionId === undefined || call.sessionId === sessionId),
    ).length
  }

  /** The events recorded for one session, in order. */
  eventsFor(sessionId: string): readonly AgentSetupEventRecord[] {
    return this.calls
      .filter((call) => call.method === 'recordSessionEvent' && call.sessionId === sessionId)
      .map((call) => call.event as AgentSetupEventRecord)
  }
}

/** A slot that records every `apply` context (and may fault once). */
export interface RecordingSlot extends OverlaySlot {
  /** The slot contexts this slot applied, in order. */
  readonly applied: readonly TeamAgentStepContext[]
}

/**
 * Build a recording slot (for slot-contract tests): `apply` records its
 * context; with `failFirstApply` the FIRST `apply` throws that error (a
 * one-shot fault) and later applies succeed.
 */
export function recordingSlot(name: OverlaySlotName, failFirstApply?: Error): RecordingSlot {
  const applied: TeamAgentStepContext[] = []
  let first = true
  return {
    name,
    applied,
    apply(context: TeamAgentStepContext): void {
      if (first) {
        first = false
        if (failFirstApply !== undefined) throw failFirstApply
      }
      applied.push(context)
    },
  }
}

/** A guard that rejects with the given closed code (and optional detail). */
export function rejectingGuard(code: string, detail?: string): AdmissionGuard {
  return {
    decide(): { status: 'rejected'; code: string; detail?: string } {
      return detail === undefined ? { status: 'rejected', code } : { status: 'rejected', code, detail }
    },
  }
}

/** A guard that always throws (the fail-closed admission fault). */
export function throwingGuard(error: Error): AdmissionGuard {
  return {
    decide(): never {
      throw error
    },
  }
}

/**
 * Build the read-only TeamDomain handle over one world's repositories
 * (the P4 storage repositories — the real durable facade; the binder
 * consumes only its three read methods).
 */
export function readHandleFor(domain: TeamDomain) {
  return createTeamDomainReadHandle(domain.repositories)
}

export { destroyDir }
