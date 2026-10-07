/**
 * A4-PR6 stage 6.A — the GovernanceWarning service.
 *
 * The durable, team-locked diagnostic lane (spec §15, plan §6.A): it folds
 * the envelope-consistency comparison into `consistent | mismatch |
 * undetermined`, mints fingerprint-bound warnings for the last two, gates
 * the Team start through the ONE frozen `GovernanceStartCheck` port, and
 * records fingerprint-bound acknowledgements that are REMINDER STATE ONLY.
 *
 * What this module never does:
 * - write a `ControlRequest`, an approval case, or any decision value (a
 *   warning is not an approval case — pinned by the 6.A tests);
 * - return `wait-for-response` or any status the Team waits in;
 * - affect the authority evaluator (ack changes reminder state, full stop);
 * - clear `migration-required` for anybody, ever (plan:594).
 *
 * Durability law (A5-6): the lane writes ONLY the two fact types
 * `governance-warning-observed` / `governance-warning-acknowledged` through
 * an injected writer port; the production adapter funnels them through the
 * same durable commit path as every other ledger fact, so the rows appear
 * in the same fold the UI reads. Reads go through an injected reader port.
 * The service holds NO repositories/locks itself — the production caller
 * owns the team lock, exactly like the proposal store's ports.
 *
 * @module @dsh-agent-team/runtime/governance-warning/service
 */
import { type EnvelopeContains, type GovernanceConsistencyResult, type GovernanceEnvelopeView, type GovernanceStartOutcome, type GovernanceWarningAcknowledgeInput, type GovernanceWarningAcknowledgeOutcome, type GovernanceWarningSnapshot } from './types.js';
/** One durable warning row as read back from the ledger fold. */
export interface GovernanceWarningRow {
    readonly factType: string;
    readonly payload: Readonly<Record<string, unknown>>;
    readonly createdAt: string;
}
export interface GovernanceWarningWriterPort {
    /**
     * Append one `governance-warning-observed` row. NAMED methods (not a
     * `factType` parameter) so the durable funnel call site in the host
     * carries the FACT-TYPE LITERAL: the `a4pr0a-fact-type-closed-set` guard
     * derives every writable type statically, and a variable-typed funnel
     * call would land in its unresolved-dynamic-writer set — a reviewed
     * disclosure the PR would have to carry with no need for it. The type is
     * the port's to fix; the host wires each literal once.
     */
    writeObserved(rootSessionId: string, payload: Record<string, unknown>): Promise<void>;
    /** Append one `governance-warning-acknowledged` row (reminder state only). */
    writeAcknowledged(rootSessionId: string, payload: Record<string, unknown>): Promise<void>;
}
export interface GovernanceWarningReaderPort {
    /** Every warning row of the team, ascending by sequence (both fact types). */
    list(rootSessionId: string, factTypes: readonly string[]): Promise<readonly GovernanceWarningRow[]>;
}
/** The bound-authority-document view the comparator consumes. */
export type GovernanceWarningDocumentView = 
/** No v3 authority documents (a v1/v2 bound blueprint — bridge world). */
{
    readonly stage: 'pre-v3';
    readonly schemaVersion: number;
}
/** v3, hard ceiling unreadable / corrupt (the two fail-closed arms). */
 | {
    readonly stage: 'unreadable';
} | {
    readonly stage: 'corrupt';
}
/** v3, documents readable. `absent` hard = no human-user narrowing. */
 | {
    readonly stage: 'v3';
    readonly hardStatus: 'declared' | 'absent';
    readonly blueprintContentHash: string;
    readonly leader: GovernanceEnvelopeView;
    readonly hard: GovernanceEnvelopeView;
};
export interface GovernanceWarningDocsPort {
    read(teamSessionId: string): Promise<GovernanceWarningDocumentView>;
}
export interface GovernanceWarningServiceDeps {
    readonly writer: GovernanceWarningWriterPort;
    readonly reader: GovernanceWarningReaderPort;
    readonly docs: GovernanceWarningDocsPort;
    readonly contains: EnvelopeContains;
    readonly now: () => string;
    /**
     * The v1/v2 BRIDGE posture (plan:598-603). TRUE through PR6: a v1/v2
     * bound document keeps today's behaviour (`open`, zero warnings). PR7 7.2
     * flips this to FALSE at the wiring, producing `migration-required` — the
     * arm below is already ack-immune and unit-pinned in that posture.
     */
    readonly bridge?: boolean;
}
/** The service surface (what 6.A wiring and the 6.B source adapter consume). */
export interface GovernanceWarningService {
    /** The start gate: the TWO `team.create` sites, post-bind pre-start. */
    checkStart(teamSessionId: string): Promise<GovernanceStartOutcome>;
    /** The SAME gate re-entered by `ensureRootLive` after its preflight. */
    checkEnsureRootLive(teamSessionId: string): Promise<GovernanceStartOutcome>;
    /**
     * The runtime boundary observation: recomputes and observes; NEVER
     * blocks, NEVER throws at the caller (a warning updates the existing
     * item; the Team keeps running — spec §15.2).
     */
    observeRuntime(teamSessionId: string): Promise<void>;
    acknowledge(input: GovernanceWarningAcknowledgeInput): Promise<GovernanceWarningAcknowledgeOutcome>;
    listWarnings(teamSessionId: string): Promise<readonly GovernanceWarningSnapshot[]>;
}
/**
 * The pure envelope-consistency comparison (spec §15.3). Law: at EVERY
 * witness point (every declared matcher of either document), the leader's
 * broadest claim must not EXCEED the human-user hard envelope's lane at the
 * same point; `absent` hard means no narrowing (the `allow` identity). A
 * single undecidable containment relation absorbs the whole comparison into
 * `undetermined` — it is never reported as `consistent`; a decided mismatch
 * anywhere dominates (`mismatch` is the stronger signal).
 *
 * The CONFIGURATION stage (create/publish diagnostic — no Blueprint editor
 * exists in Alpha.4, so no product surface calls it yet; disclosed) runs
 * this SAME comparator over the declared, un-canonicalised documents with a
 * containment that answers only for provable declaration relations and
 * `undefined` otherwise — a declaration whose relation needs the filesystem
 * reads `undetermined`, never a fabricated `consistent`.
 */
export declare function compareEnvelopes(leader: GovernanceEnvelopeView, hard: GovernanceEnvelopeView, contains: EnvelopeContains): GovernanceConsistencyResult;
/** Stable id derivation: the fingerprint IS the dedup key and the ack key. */
export declare function warningIdForFingerprint(fingerprint: string): string;
export declare function interventionIdForWarningId(warningId: string): string;
export declare function createGovernanceWarningService(deps: GovernanceWarningServiceDeps): GovernanceWarningService;
//# sourceMappingURL=service.d.ts.map