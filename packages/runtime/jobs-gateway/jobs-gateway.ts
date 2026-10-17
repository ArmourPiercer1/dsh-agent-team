/**
 * jobs-gateway.ts — the composed adapter: JobOwner admission, the lease
 * window, the cancellation boundary, and the C-BIND result-attribution
 * chain, as ONE DORMANT object the Web/Jobs surface would consume.
 *
 * THE TWO-QUESTION SPLIT (this is the design):
 *  - WHAT HAPPENED (outcome facts) is decided by the dispatch plane and read
 *    off its event faces — an outcome record is written whenever the plane
 *    emits an outcome-carrying event, whatever the lease state.
 *  - WHETHER OUR WORK IS DONE (completion evidence) is the lease window's
 *    question — and a settle that crosses the ACTIVE→DRAINING boundary is
 *    refused there even when the outcome fact is known (PR1 Gate R4: a
 *    callback crossing the boundary cannot be authenticated as "the Body
 *    returned before the state changed"). Recording that a Body ran is not
 *    laundering a cross-boundary settle into a release.
 *
 * THE C-BIND CHAIN (MCP withdraw → re-register → binding change → result
 * attribution), per INTERFACES-v1 §C-BIND:
 *  - `tools/change` is an INFORMATION channel, not a security mechanism: the
 *    event says only "something moved". Cancelling on the event alone would
 *    cancel every in-flight job of every governed name; each job therefore
 *    re-reads THE (scope, name) definition it was validated against and is
 *    cancelled only when THAT identity moved (an unreadable read counts as
 *    moved — the closed world credits no read it cannot make).
 *  - scope filtering only prevents accidental friendly fire; it is not an
 *    authorization decision.
 *  - Result attribution is to the definition VALIDATED AT EXECUTION TIME
 *    (the job's `pinnedIdentity`). A later re-registration under the same
 *    name never claims the earlier job's result, and never absorbs its lease.
 *
 * @module runtime/jobs-gateway/jobs-gateway
 */
import { classifyDispatchEvent } from './cancellation-boundary.js'
import { createLeaseWindow } from './lease-window.js'
import type { LeaseWindow } from './lease-window.js'
import { gatewayRefusal, jobOwnerKey } from './types.js'
import type {
  DispatchEvent,
  GatewayRefusal,
  JobOutcome,
  JobOwner,
} from './types.js'
import { projectJobForViewer, redactCredentials } from './web-projection.js'
import type { ProjectionSource, WebJobView } from './web-projection.js'

/** A live definition read: {scope, name} → current identity. */
export type DefinitionIdentityProbe = (
  scopeKey: string,
  name: string,
) => { readonly ok: boolean; readonly identity: string }

export interface GatewayObservation {
  readonly event: string
  readonly [rest: string]: unknown
}

export interface GatewayJobRecord {
  readonly jobId: string
  /** Canonical member-scope key bound at admission; immutable from here. */
  readonly ownerKey: string
  /** The agent scope whose Definition the job was validated against. */
  readonly scopeKey: string
  readonly toolName: string
  /** Definition identity validated at admission — the attribution anchor. */
  readonly pinnedIdentity: string
  state: 'leased' | 'settled'
  outcome: JobOutcome | null
  /** The lane asked for this call's cancellation (C-BIND re-read said moved). */
  cancelRequested: boolean
  readonly evidence: DispatchEvent[]
}

export interface JobsGateway {
  readonly lease: LeaseWindow
  readonly admitJob: (input: {
    readonly jobId: string
    readonly owner: JobOwner
    readonly scopeKey: string
    readonly toolName: string
    readonly pinnedIdentity: string
  }) => { readonly ok: true; readonly job: GatewayJobRecord } | GatewayRefusal
  /** Feed one dispatch-plane event. Tokens are redacted AT COLLECTION. */
  readonly observeDispatchEvent: (event: DispatchEvent) => { readonly ok: true } | GatewayRefusal
  /** One `tools/change`: per in-flight job, re-read its OWN identity; cancel only what moved. */
  readonly onRegistryChange: (
    probe?: DefinitionIdentityProbe,
  ) => readonly { jobId: string; pinnedIdentity: string; currentIdentity: string }[]
  readonly job: (jobId: string) => readonly GatewayJobRecord[]
  readonly projectFor: (
    viewer: JobOwner,
    jobId: string,
  ) => { readonly ok: true; readonly view: WebJobView } | GatewayRefusal
}

export function createJobsGateway(options: {
  readonly resolveDefinition?: DefinitionIdentityProbe
  readonly onObserve?: (observation: GatewayObservation) => void
} = {}): JobsGateway {
  const observations: GatewayObservation[] = []
  const emit = (observation: GatewayObservation): void => {
    observations.push(observation)
    options.onObserve?.(observation)
  }

  const lease = createLeaseWindow(emit)
  const jobs = new Map<string, GatewayJobRecord>()

  const admitJob: JobsGateway['admitJob'] = (input) => {
    const existing = jobs.get(input.jobId)
    if (existing !== undefined) {
      // Same jobId re-admitted must not silently swap the owner.
      if (existing.ownerKey !== jobOwnerKey(input.owner)) {
        emit({ event: 'gateway-admit-owner-claim-conflict', jobId: input.jobId, severity: 'alarm' })
        return gatewayRefusal('owner-mismatch', 'this jobId is already owned by another member scope')
      }
      return gatewayRefusal('duplicate-job', `job ${input.jobId} already admitted`)
    }
    const took = lease.acquire({ callId: input.jobId, jobKey: jobOwnerKey(input.owner) })
    if (!took.ok) return took
    // The owner binding is frozen at admission: the caller's object cannot be
    // mutated later to re-attribute the job.
    const ownerKey = jobOwnerKey({
      rootSessionId: input.owner.rootSessionId,
      instanceId: input.owner.instanceId,
    })
    const record: GatewayJobRecord = {
      jobId: input.jobId,
      ownerKey,
      scopeKey: input.scopeKey,
      toolName: input.toolName,
      pinnedIdentity: input.pinnedIdentity,
      state: 'leased',
      outcome: null,
      cancelRequested: false,
      evidence: [],
    }
    jobs.set(input.jobId, record)
    emit({ event: 'gateway-job-admitted', jobId: input.jobId, ownerKey, tool: input.toolName })
    return { ok: true, job: record }
  }

  const observeDispatchEvent: JobsGateway['observeDispatchEvent'] = (rawEvent) => {
    // Redaction happens AT COLLECTION: the record stores only swept events,
    // so nothing downstream can forget to scrub.
    const event = redactCredentials(rawEvent)
    const record = jobs.get(event.callId)
    if (record === undefined) {
      // The plane emits for calls that never took a gateway lease (a door
      // refusal, a non-governed scope): noted, never invented into a job.
      emit({ event: 'gateway-event-unknown-job', planeEvent: event.event, callId: event.callId })
      return gatewayRefusal('unknown-job', `no gateway job for callId ${event.callId}`)
    }
    const outcome = classifyDispatchEvent(event)
    if (outcome === undefined) {
      emit({ event: 'gateway-event-without-outcome', planeEvent: event.event, callId: event.callId })
      return { ok: true }
    }
    record.evidence.push(event)
    record.outcome = outcome
    // OUTCOME FACT (what happened) is recorded regardless of lease state —
    // but the token's end goes through the boundary: during/after a drain a
    // 'settled' end is refused there and the half-state stands (PR1 Gate R4).
    const ended = lease.end(event.callId, 'settled')
    if (ended.ok) {
      record.state = 'settled'
    } else {
      emit({
        event: 'gateway-job-outcome-recorded-lease-unconfirmed',
        planeEvent: event.event,
        callId: event.callId,
        detail: ended.detail,
      })
      // The job's outcome face is still what the plane said; only its lease
      // confirmation failed. A settled-outcome job whose lease is stuck is
      // reported that way, never quietly as done.
      if (outcome.kind !== 'unresolved') record.state = 'settled'
    }
    return { ok: true }
  }

  const onRegistryChange: JobsGateway['onRegistryChange'] = (probe) => {
    const cancelled: { jobId: string; pinnedIdentity: string; currentIdentity: string }[] = []
    const reader = probe ?? options.resolveDefinition
    for (const record of [...jobs.values()]) {
      if (record.state !== 'leased' || record.cancelRequested) continue
      // Each in-flight job asks about ITSELF: (its scope, its name), not the
      // event. `tools/change` carries no payload — trusting it wholesale is
      // friendly fire; trusting a neighbour's read is attribution error.
      // No reader at all ⇒ NOTHING can be shown unmoved ⇒ everything moves
      // (the closed world credits no read it cannot make).
      const read = reader
        ? reader(record.scopeKey, record.toolName)
        : ({ ok: false, identity: 'no-reader' } as const)
      if (read.ok && read.identity === record.pinnedIdentity) continue
      const currentIdentity = read.ok ? read.identity : `unreadable:${read.identity}`
      record.cancelRequested = true
      cancelled.push({
        jobId: record.jobId,
        pinnedIdentity: record.pinnedIdentity,
        currentIdentity,
      })
      emit({
        event: 'gateway-cancel-requested',
        jobId: record.jobId,
        reason: read.ok ? 'definition-moved' : 'definition-unreadable',
        pinnedIdentity: record.pinnedIdentity,
        currentIdentity,
      })
    }
    return cancelled
  }

  return {
    lease,
    admitJob,
    observeDispatchEvent,
    onRegistryChange,
    job: (jobId) => (jobId === '*' ? [...jobs.values()] : jobs.has(jobId) ? [jobs.get(jobId)!] : []),
    projectFor: (viewer, jobId) => {
      const record = jobs.get(jobId)
      if (record === undefined) return gatewayRefusal('unknown-job', `no gateway job ${jobId}`)
      const source: ProjectionSource = {
        jobId: record.jobId,
        ownerKey: record.ownerKey,
        toolName: record.toolName,
        pinnedIdentity: record.pinnedIdentity,
        state: record.state,
        // RESULT ATTRIGATION: the outcome carries the job's OWN pinned
        // identity — the definition validated when the call was admitted.
        // A re-registration under the same name later never owns this view.
        outcome: record.outcome,
      }
      return projectJobForViewer(viewer, source)
    },
  }
}
