/**
 * Alpha.5 P2 seam — mechanically observable guard consultations, and a plain
 * file transport so a DIFFERENT process can read what the installing process
 * actually consulted.
 *
 * WHY THIS EXISTS: `installToolBindingRealm` builds the confined Provider's
 * guard closure itself and never returns it (`install.ts:293` at the base of
 * this package), so from outside the module "the guard was consulted for this
 * call" was an inference from the base Provider having run, not an observation.
 * An in-process callback alone could not fix that for a C2 suite: the suite
 * runs in its own process, the Host in another. This module therefore owns
 * exactly two things, and nothing else:
 *
 *   1. {@link observeGuard} — an additive wrapper around the ONE guard the
 *      confined Provider already calls. It records the guard's OWN decision
 *      (the typed `TeamIoDenial` code, or allow) BEFORE the Provider delegates,
 *      then rethrows the original refusal. It never decides anything: no
 *      locator algebra, no policy re-evaluation, no second oracle.
 *   2. {@link createGuardConsultFileSink} / {@link readGuardConsultFile} — an
 *      append-only JSONL transport (and its strict reader). The file is
 *      EVIDENCE TRANSPORT, NOT AUTHORITY: it carries facts the installing
 *      process reported; it grants nothing and is not a ledger.
 *
 * FAIL-CLOSED ON THE TRANSPORT: when an observer/sink is supplied and a
 * consultation record cannot be written, the observed call is REFUSED with
 * {@link GuardObservationError} — carrying both the decision the guard made
 * and the transport failure. An unrecorded allow never reaches the Provider,
 * and an unrecorded refusal is never silently swapped for an allow. The
 * DEFAULT path (no observer) is untouched: `install.ts` uses the original
 * guard object and the original class when no observer is passed.
 *
 * @module @dsh-agent-team/runtime/team-services/guard-observability
 */
import type { FsGuard } from './fs.js';
import { TeamIoDenial } from './types.js';
/** The one record schema. A reader that does not know it must fail loud. */
export declare const GUARD_CONSULT_SCHEMA = "a5sf-guard-consult/1";
/** `decidedBy` for an admitted consultation (refusals carry the denial code). */
export declare const GUARD_ALLOW_DECIDED_BY = "ALLOW";
/** Closed transport-refusal vocabulary (this module; not the install codes). */
export declare const GUARD_CONSULT_TRANSPORT_CODES: readonly ["SINK_PATH_REQUIRED", "CONSULT_FILE_INVALID"];
export type GuardConsultTransportCode = (typeof GUARD_CONSULT_TRANSPORT_CODES)[number];
/** Which realm the consultation came from (the same guard shape enforces both). */
export type GuardConsultRealm = 'member' | 'binding';
/**
 * The lane the guard's own typed outcome maps to. Two values are direct
 * (`allow`, `*_DENIED` ⇒ `deny`); `IO_POLICY_UNSUPPORTED` is the guard's
 * "cannot prove admission" refusal and is the `ask` lane, the same mapping the
 * R3 chain recorder uses (`tests/world-factory/lib/a5sf-evidence.mjs`). So is
 * `IO_ASK_REQUIRES_APPROVAL` (A5-DUAL-PLANE-01): the guard PROVED the lane's
 * disposition is `ask` and refused because no approval can be consumed here —
 * the fact must report `ask` (not `deny`) so the three-way comparison sees the
 * lane the author declared while the effect still shows a refusal. It is a
 * MAPPING of the guard's own code, not a new decision.
 */
export type GuardConsultDecision = 'allow' | 'deny' | 'ask';
/** One consultation, exactly as the installing process saw it. */
export interface GuardConsultFact {
    /** {@link GUARD_CONSULT_SCHEMA}; makes an alien line fail loud, not parse. */
    readonly schema: typeof GUARD_CONSULT_SCHEMA;
    readonly realm: GuardConsultRealm;
    readonly memberIdentity: string;
    /** The compiled tool binding, or `null` for the Member ceiling realm. */
    readonly toolBindingIdentity: string | null;
    readonly policyRevision: string;
    /** The Provider method that asked the guard (e.g. `readText`). */
    readonly method: string;
    /** The provider-resolved host path the guard was asked about. */
    readonly locator: string;
    readonly decision: GuardConsultDecision;
    /** `ALLOW`, or the guard's own `TeamIoDenial` code for a refusal. */
    readonly decidedBy: string;
    /** 1-based per observed guard (per realm); file order is the cross-realm order. */
    readonly sequence: number;
    readonly observedAt: string;
    /**
     * OPTIONAL, additive: what the consulting face did to the request BEYOND the
     * lane decision (BL-16: the confined `spawn` face records that it disabled
     * rg's ancestor/VCS ignore discovery, and exactly which semantics that
     * removed). The guard's decision is unchanged and the fact count is
     * unchanged — this is the recorded answer to "why did my grep behave this
     * way", not a second decision.
     */
    readonly annotations?: readonly string[];
}
/** What a caller may hand `install*`/`mount*` to observe consultations. */
export type GuardConsultObserver = (fact: GuardConsultFact) => void | Promise<void>;
/** The realm identity an observed guard records on every fact. */
export interface GuardConsultContext {
    readonly realm: GuardConsultRealm;
    readonly memberIdentity: string;
    readonly toolBindingIdentity: string | null;
    readonly policyRevision: string;
}
/** A consultation that could not be transported. The call is refused. */
export declare class GuardObservationError extends Error {
    readonly code: "GUARD_OBSERVATION_FAILED";
    /** The record the observer refused to accept (the decision is NOT lost). */
    readonly fact: GuardConsultFact;
    readonly decision: GuardConsultDecision;
    readonly decidedBy: string;
    /** The guard's original refusal, when the decision was a refusal. */
    readonly denial: TeamIoDenial | null;
    constructor(fact: GuardConsultFact, cause: unknown, denial: TeamIoDenial | null);
}
/** A malformed sink path or a malformed consultation file. */
export declare class GuardConsultTransportError extends Error {
    readonly code: GuardConsultTransportCode;
    readonly detail: string;
    constructor(code: GuardConsultTransportCode, detail: string);
}
/**
 * Wrap ONE guard so every consultation is reported to `observer` before the
 * confined Provider delegates. The returned guard performs the SAME admission
 * call as the guard it wraps; it only adds the report and the fail-closed
 * transport rule.
 *
 * A non-`TeamIoDenial` error is NOT a decision (a resolver fault outside the
 * guard's vocabulary): it is rethrown unrecorded rather than labelled.
 */
export declare function observeGuard(guard: FsGuard, observer: GuardConsultObserver, context: GuardConsultContext): FsGuard;
/** The file sink a caller hands to {@link observeGuard}. */
export interface GuardConsultFileSink {
    readonly path: string;
    record(fact: GuardConsultFact): Promise<void>;
}
/** Options for {@link createGuardConsultFileSink}. */
export interface GuardConsultFileSinkOptions {
    /** Append-only JSONL path. The parent directory must already exist. */
    readonly path: string;
}
/**
 * A plain append-only JSONL sink. Writes are serialised so the file order is
 * the consultation order. The sink owns NO counter and NO ledger: each line is
 * the fact it was handed, verbatim, plus the schema the fact already carries.
 * A write failure rejects (the guard then refuses the call).
 */
export declare function createGuardConsultFileSink(options: GuardConsultFileSinkOptions): GuardConsultFileSink;
/** Read + validate an append-only consultation file. Missing file rejects. */
export declare function readGuardConsultFile(path: string): Promise<GuardConsultFact[]>;
//# sourceMappingURL=guard-observability.d.ts.map