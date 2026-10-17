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
 * THE INJECTION SURFACE (production assembly contract, pc-CONTRACT.md):
 * the legs proved the laws with the ROW holding the identity read and the
 * definition store next to the gateway. The production module takes them as
 * INJECTED sources instead of row-local constants:
 *  - `identity` (a {@link GatewayIdentitySource}): durable host state, not
 *    the caller's claim, is the admission authority. Absent (fixture mode)
 *    the caller's owner object is taken at face value, exactly as the
 *    a5p7 fixtures and the legs ran at base.
 *  - `lease` (a {@link LeaseWindow}, e.g. one built by `createLeaseWindow`
 *    with the assembly's own observation sink): the job-side lease mirror
 *    belongs to the ASSEMBLY — teardown drains the window the assembly
 *    owns, and generation rebuilds keep ONE window if the assembly says so.
 *    Absent, the gateway creates its own window (base behavior).
 *  - `resolveDefinition` doubles as the admit-time identity reader: an
 *    admission may OMIT `pinnedIdentity` and the gateway pins whatever the
 *    reader says NOW (execution-time validation at the admit edge); an
 *    unreadable read REFUSES the admission (`mapping-rejected`, closed
 *    world). An explicit `pinnedIdentity` stays the caller-pinned fixture
 *    shape (the legs' verbatim 'def-v1'/'def-v2' attributions).
 *
 * @module runtime/jobs-gateway/jobs-gateway
 */
import { classifyDispatchEvent } from './cancellation-boundary.js';
import { createLeaseWindow } from './lease-window.js';
import { gatewayRefusal, jobOwnerKey } from './types.js';
import { projectJobForViewer, redactCredentials } from './web-projection.js';
export function createJobsGateway(options = {}) {
    const observations = [];
    const emit = (observation) => {
        observations.push(observation);
        options.onObserve?.(observation);
    };
    const lease = options.lease ?? createLeaseWindow(emit);
    const jobs = new Map();
    const admitJob = (input) => {
        // GATE 1 — the identity authority (only when one is injected). The
        // claim is checked against durable host state FIRST, so a veto here is
        // the zero-registration shape the W7M-2 legs measured: no lease token,
        // no job record, no observation other than the alarm itself.
        let confirmed = null;
        if (options.identity !== undefined) {
            confirmed = options.identity.resolve({
                rootSessionId: input.owner.rootSessionId,
                instanceId: input.owner.instanceId,
            });
            if (confirmed === null) {
                emit({
                    event: 'gateway-admit-identity-unconfirmed',
                    jobId: input.jobId,
                    severity: 'alarm',
                    // The refusal detail stays static: an unconfirmed claim carries
                    // no identity worth echoing.
                    detail: 'the injected identity source does not confirm this member scope from durable host state',
                });
                return gatewayRefusal('owner-not-durable', 'the claimed member scope is not confirmed by the injected identity source');
            }
        }
        const claimKey = jobOwnerKey(confirmed ?? input.owner);
        const existing = jobs.get(input.jobId);
        if (existing !== undefined) {
            // Same jobId re-admitted must not silently swap the owner.
            if (existing.ownerKey !== claimKey) {
                emit({ event: 'gateway-admit-owner-claim-conflict', jobId: input.jobId, severity: 'alarm' });
                return gatewayRefusal('owner-mismatch', 'this jobId is already owned by another member scope');
            }
            return gatewayRefusal('duplicate-job', `job ${input.jobId} already admitted`);
        }
        // GATE 2 — the admit-time definition pin. An omitted `pinnedIdentity`
        // is resolved through the injected reader AT THIS INSTANT (execution-
        // time validation at the admit edge); an unreadable read refuses the
        // admission BEFORE any lease exists (closed world: the gateway admits
        // no call whose Definition it cannot read). An explicit pin is the
        // fixture shape and passes through verbatim.
        let pinnedIdentity;
        if (typeof input.pinnedIdentity === 'string' && input.pinnedIdentity !== '') {
            pinnedIdentity = input.pinnedIdentity;
        }
        else {
            const reader = options.resolveDefinition;
            const read = reader
                ? reader(input.scopeKey, input.toolName)
                : { ok: false, identity: 'no-reader' };
            if (!read.ok) {
                emit({
                    event: 'gateway-admit-definition-unreadable',
                    jobId: input.jobId,
                    scopeKey: input.scopeKey,
                    toolName: input.toolName,
                    severity: 'alarm',
                });
                return gatewayRefusal('mapping-rejected', `no execution-time definition identity to pin for ${input.scopeKey}/${input.toolName} (${read.identity})`);
            }
            pinnedIdentity = read.identity;
        }
        const took = lease.acquire({ callId: input.jobId, jobKey: claimKey });
        if (!took.ok)
            return took;
        // The owner binding is frozen at admission from the AUTHORITY COPY (the
        // injected source's confirmed owner when one exists): the caller's
        // object cannot be mutated later to re-attribute the job.
        const ownerKey = jobOwnerKey({
            rootSessionId: (confirmed ?? input.owner).rootSessionId,
            instanceId: (confirmed ?? input.owner).instanceId,
        });
        const record = {
            jobId: input.jobId,
            ownerKey,
            scopeKey: input.scopeKey,
            toolName: input.toolName,
            pinnedIdentity,
            state: 'leased',
            outcome: null,
            cancelRequested: false,
            evidence: [],
        };
        jobs.set(input.jobId, record);
        emit({ event: 'gateway-job-admitted', jobId: input.jobId, ownerKey, tool: input.toolName });
        return { ok: true, job: record };
    };
    const observeDispatchEvent = (rawEvent) => {
        // Redaction happens AT COLLECTION: the record stores only swept events,
        // so nothing downstream can forget to scrub.
        const event = redactCredentials(rawEvent);
        const record = jobs.get(event.callId);
        if (record === undefined) {
            // The plane emits for calls that never took a gateway lease (a door
            // refusal, a non-governed scope): noted, never invented into a job.
            emit({ event: 'gateway-event-unknown-job', planeEvent: event.event, callId: event.callId });
            return gatewayRefusal('unknown-job', `no gateway job for callId ${event.callId}`);
        }
        const outcome = classifyDispatchEvent(event);
        if (outcome === undefined) {
            emit({ event: 'gateway-event-without-outcome', planeEvent: event.event, callId: event.callId });
            return { ok: true };
        }
        record.evidence.push(event);
        record.outcome = outcome;
        // OUTCOME FACT (what happened) is recorded regardless of lease state —
        // but the token's end goes through the boundary: during/after a drain a
        // 'settled' end is refused there and the half-state stands (PR1 Gate R4).
        const ended = lease.end(event.callId, 'settled');
        if (ended.ok) {
            record.state = 'settled';
        }
        else {
            emit({
                event: 'gateway-job-outcome-recorded-lease-unconfirmed',
                planeEvent: event.event,
                callId: event.callId,
                detail: ended.detail,
            });
            // The job's outcome face is still what the plane said; only its lease
            // confirmation failed. A settled-outcome job whose lease is stuck is
            // reported that way, never quietly as done.
            if (outcome.kind !== 'unresolved')
                record.state = 'settled';
        }
        return { ok: true };
    };
    const onRegistryChange = (probe) => {
        const cancelled = [];
        const reader = probe ?? options.resolveDefinition;
        for (const record of [...jobs.values()]) {
            if (record.state !== 'leased' || record.cancelRequested)
                continue;
            // Each in-flight job asks about ITSELF: (its scope, its name), not the
            // event. `tools/change` carries no payload — trusting it wholesale is
            // friendly fire; trusting a neighbour's read is attribution error.
            // No reader at all ⇒ NOTHING can be shown unmoved ⇒ everything moves
            // (the closed world credits no read it cannot make).
            const read = reader
                ? reader(record.scopeKey, record.toolName)
                : { ok: false, identity: 'no-reader' };
            if (read.ok && read.identity === record.pinnedIdentity)
                continue;
            const currentIdentity = read.ok ? read.identity : `unreadable:${read.identity}`;
            record.cancelRequested = true;
            cancelled.push({
                jobId: record.jobId,
                pinnedIdentity: record.pinnedIdentity,
                currentIdentity,
            });
            emit({
                event: 'gateway-cancel-requested',
                jobId: record.jobId,
                reason: read.ok ? 'definition-moved' : 'definition-unreadable',
                pinnedIdentity: record.pinnedIdentity,
                currentIdentity,
            });
        }
        return cancelled;
    };
    return {
        lease,
        admitJob,
        observeDispatchEvent,
        onRegistryChange,
        job: (jobId) => (jobId === '*' ? [...jobs.values()] : jobs.has(jobId) ? [jobs.get(jobId)] : []),
        projectFor: (viewer, jobId) => {
            const record = jobs.get(jobId);
            if (record === undefined)
                return gatewayRefusal('unknown-job', `no gateway job ${jobId}`);
            const source = {
                jobId: record.jobId,
                ownerKey: record.ownerKey,
                toolName: record.toolName,
                pinnedIdentity: record.pinnedIdentity,
                state: record.state,
                // RESULT ATTRIGATION: the outcome carries the job's OWN pinned
                // identity — the definition validated when the call was admitted.
                // A re-registration under the same name later never owns this view.
                outcome: record.outcome,
            };
            return projectJobForViewer(viewer, source);
        },
    };
}
//# sourceMappingURL=jobs-gateway.js.map