/**
 * The fresh-member creation path (P5-T6; DevPlan §18.5 member residency;
 * TaskDoc §11.5 P5-T6 card).
 *
 * {@link createFreshMember} creates one member of a bound Team: it
 * derives the stable identity from the creation spec, durably commits the
 * MemberInstance record and the `team-member` session binding (idempotent
 * and CONVERGENT re-runs skip the writes or repair the lost side of the
 * crash window), and then runs the P5-T1 binder's fresh-member path so
 * the member becomes a resident agent with its full overlay scope — all
 * three frozen overlay slots (`persona`, `model`, `capability`) installed
 * plus the admission GUARD decision (the "四槽位" of the ruling: the
 * complete overlay set plus the admission decision point; DevPlan §18.2
 * substrate wiring lives in the injected slot implementations).
 *
 * Orchestration (every step fail-closed; the binder is never run unless
 * the durable state is consistent):
 *
 * 1. Identity derivation (`./identity.js`) — the spec is validated
 *    fail-closed (`MEMBER_RESIDENCY_INVALID_INPUT`, no effect); the
 *    derived `(instanceId, childSessionId)` is the ONLY identity used
 *    from here on (invariants 18/19/23/24).
 * 2. Root resolution (READ ONLY, before any effect) — the root session
 *    must carry a `team-root` binding (`MEMBER_RESIDENCY_ROOT_NOT_BOUND`
 *    otherwise — a member cannot be created under an unbound or
 *    ordinary/member session) AND a durable TeamSession record
 *    (`MEMBER_RESIDENCY_RECORD_CONFLICT` otherwise — a team-root binding
 *    without its record is an integrity violation, invariant 41).
 * 3. The child-Session durability barrier (DevPlan §18.5 "Session
 *    durable") — `ports.sessionDurability.ensureDurable(childSessionId)`
 *    is awaited BEFORE the first durable write. UNCONDITIONAL: the
 *    convergent-replay and idempotent-re-run paths call it too (the real
 *    upstream seam — `sessions.flush(liveSession)`, rc.1's replacement for
 *    `sessionPersistence.ensureMaterialized` — is a no-op there: the
 *    artifact is already durable or the resumed session's load already
 *    marked it materialized). Fail-closed: a rejection propagates with
 *    ZERO durable
 *    writes performed (nothing has been put yet). After it resolves the
 *    child artifact is durable on disk (header-only when the session has
 *    no events yet), so a later crash inside the write window below
 *    leaves a COLD-RESUMABLE world, never a durable row pointing at a
 *    missing session.
 * 4. MemberInstance record — absent: durably put the `CREATED` /
 *    activityVersion-1 record. PRESENT: it must match the spec's
 *    immutable identity (templateId, label, groupId, workspace,
 *    childSessionId) exactly — `MEMBER_RESIDENCY_RECORD_CONFLICT`
 *    otherwise; a `DISPOSED` record is
 *    `MEMBER_RESIDENCY_LIFECYCLE_CONFLICT` (the terminal state is never
 *    re-entered by the create path; a re-creation after disposal is a
 *    DIFFERENT spec / different derived identity).
 * 5. `team-member` session binding — absent: durably put it. PRESENT: it
 *    must agree with the derived identity (`MEMBER_RESIDENCY_RECORD_CONFLICT`
 *    otherwise). CONVERGENT REPLAY (I1c): when the record is absent but a
 *    CONSISTENT binding is present, step 4 re-puts the record (recovery)
 *    and step 5 keeps the binding — a re-drive after a lost record
 *    produces no duplicate row (the repositories' identical-bytes put is
 *    an idempotent no-op) and no crash.
 *
 * CRASH-SAFE ORDERING: the child-session artifact is durable BEFORE the
 * MemberInstance record, and the record is committed BEFORE the binding
 * (the barrier + the T5 mirror ordering). Every crash point is therefore
 * recoverable:
 *
 * - a crash BEFORE the barrier (step 3) leaves NO member rows — at most a
 *   possibly-orphaned EMPTY session artifact, diagnosable per DevPlan
 *   §17.4 (no committed MemberInstance);
 * - a crash between the barrier and the record put leaves a durable
 *   artifact + NO member rows — the same diagnosable orphan class;
 * - a crash between the record put and the binding put leaves a durable
 *   artifact + a binding-less record: the re-run detects it (step 5 sees
 *   no binding) and completes it — there is no unrecoverable half-write;
 * - a crash AFTER the binding (or in the binder step) leaves a fully
 *   COLD-RESUMABLE world (artifact + record + binding all durable) with
 *   at most the ephemeral residency lost — exactly the state the COLD
 *   path recovers.
 *
 * A binding WITHOUT a record cannot arise from this module's ordering; it
 * is repaired convergently when consistent (step 4) and rejected
 * otherwise (step 5's conflict check).
 *
 * 6. The binder's fresh-member path (P5-T1) — a NEW
 *    `TeamAgentBinder` per call (fresh per-invocation state, mirror of
 *    the T5 discipline), driving `bindFreshMember(childSessionId)`:
 *    per slot in `OVERLAY_SLOT_ORDER` → `slot.apply(context)` +
 *    `surface.installOverlay(childSessionId, slot)` + the
 *    `agent-setup/overlay-installed` event record; then
 *    `admissionGuard.decide(context)` + the `agent-setup/admission-decided`
 *    record. Any binder failure propagates fail-closed and the durable
 *    commit of steps 4–5 STANDS BY DESIGN (DevPlan §18.5: durable commit
 *    + lost ephemeral residency is exactly the state the COLD path —
 *    `./cold-member.js` — recovers; re-reading the same durable rows on
 *    the next call is the recovery, not a duplicate).
 *
 * Idempotency: a re-run on a world where the member already exists
 * (records consistent, no lost rows) performs ZERO durable writes
 * (`durable.wrote === false`) and re-runs the fresh install on the same
 * records (the slot `apply` contract is idempotent; the surface
 * `installOverlay` is re-entrant by the T1 contract).
 *
 * @module @dsh-agent-team/runtime/member-residency/fresh-member
 */
import type { FreshMemberResult, MemberCreateSpec, MemberResidencyPorts } from './types.js';
/**
 * Create one FRESH member of a bound Team (see the module docs for the
 * full orchestration and the crash/convergence guarantees).
 *
 * @param ports - the injected handles (read handle, write port, the
 *   child-Session durability barrier, surface, residency port, optional
 *   slot/guard/clock overrides).
 * @param spec - the member creation spec (the canonical identity input).
 * @returns the result: the durable state (written or pre-existing) plus
 *   the binder's fresh-member bind result (all three overlay slots
 *   installed, admission decision included). On resolution the child
 *   Session artifact is durable on disk (the 18.5 "Session durable"
 *   postcondition) AND the TeamDomain rows are durable/consistent.
 * @throws {@link MemberResidencyError} (`MEMBER_RESIDENCY_INVALID_INPUT`,
 *   `MEMBER_RESIDENCY_ROOT_NOT_BOUND`,
 *   `MEMBER_RESIDENCY_RECORD_CONFLICT`,
 *   `MEMBER_RESIDENCY_LIFECYCLE_CONFLICT`) before any effect; a
 *   durability-barrier rejection (`sessionDurability.ensureDurable`) is a
 *   pre-commit seam failure — it propagates with ZERO durable writes; a
 *   repository/seam write error or a binder error after the durable
 *   commit (fail-closed; see the module docs).
 */
export declare function createFreshMember(ports: MemberResidencyPorts, spec: MemberCreateSpec): Promise<FreshMemberResult>;
//# sourceMappingURL=fresh-member.d.ts.map