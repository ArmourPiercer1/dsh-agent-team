/**
 * TCM-M3 (Team Create Minimal Fix plan §15.7 / §15.8) — the creation-time
 * Root initial-work strategy: the narrow Root-only vertical that admits and
 * delivers the ONE creation-time initial work of one team into the Root
 * (leader) session, without the Member machinery.
 *
 * WHAT THIS MODULE IS:
 *
 * The v2 `team.admitInitialWork` command (and the v1 compatibility path,
 * which G1 re-wires onto the SAME entry point) must not run through
 * `TeamRuntime.performAction(follow-up, target=inst-leader)`: that chain
 * is a Member work unit — it needs a durable Leader member record, a
 * `childSessionId`, the activity interval, and the
 * `member-lifecycle-changed` settlement (plan §2.3 / §15.8: none of those
 * may appear here). This module is the narrow alternative:
 *
 *   withTeamLock (the caller's shared coordination.chains) ->
 *   enforceCompatibilityGate (the existing single compatibility
 *   authority — the gate runs BEFORE any scan decision, exactly like the
 *   router's new-work admission) ->
 *   executeRootInitialWorkLocked (the two-fact scanner + strategy).
 *
 * DURABLE REPRESENTATION (plan §15.7; NO new schema, NO new ledger
 * category — both fact types map to the existing `team` category):
 *
 *   `team-work-admitted` (the EXISTING fact type; the Root entries are
 *     distinguished by the payload):
 *       { targetKind: 'root', rootSessionId, requestToken,
 *         payloadFingerprint, prompt, attachedContext?, caller, at }
 *   `team-root-work-delivered` (the ONE new fact type; the terminal
 *     SUCCESS record — a delivery failure writes nothing):
 *       { targetKind: 'root', rootSessionId, requestToken,
 *         payloadFingerprint, workOutcome: 'delivered', at }
 *
 * NEITHER payload carries a member addressing key (no `instanceId`, no
 * `targetInstanceId`, no `childSessionId`): the projection/disposed-history
 * attribution (the closed addressing-key table in
 * `src/plugin/projection-source.ts`) therefore never attributes a Root
 * fact to a regular member, and the honest Leader (a Leader row that never
 * got a durable member record) is unaffected — this strategy reads and
 * writes NO member record, runs NO lifecycle transition, and opens NO
 * activity interval.
 *
 * SCANNER (plan §15.6 / §2.4) — over the team's ledger facts filtered to
 * `targetKind === 'root'` and the two fact types above:
 *
 *   same token + terminal `team-root-work-delivered` + same
 *   payloadFingerprint -> TERMINAL REPLAY: zero delivery, zero writes
 *   (the call reports `mode: 'replay'`);
 *   same token + different payloadFingerprint (on the admitted AND/OR the
 *   terminal fact) -> ROOT_WORK_PAYLOAD_MISMATCH (typed; zero writes);
 *   ANY other token's root fact (admitted or delivered) ->
 *   INITIAL_WORK_ALREADY_ADMITTED (typed; zero writes): at most ONE
 *   initial-work slot per creation — the slot is occupied by a non-terminal
 *   admitted fact as well, so a user new operation under a fresh token is
 *   never mistaken for a network replay;
 *   same token + admitted (no terminal) + same payloadFingerprint ->
 *   ADMITTED-ONLY RETRY: delivery is attempted again, NO second admission
 *   fact (the crash window between the admission commit and the terminal
 *   commit recovers exactly from the durable admission);
 *   nothing for the token -> FRESH: the admission fact is committed FIRST
 *   (via the shared `commitDurableFact`), then delivery, then the terminal
 *   fact. A delivery fault propagates as WORK_DELIVERY_FAILED with the
 *   admission fact retained and NO terminal fact — the same-token retry
 *   then recovers (plan §15.7: the ambiguous crash window is explicitly
 *   NOT claimed exactly-once; the model-visible text carries the
 *   requestToken so the model can dedupe).
 *
 * The ORDINARY member scanner (`scanWorkUnitFacts` in
 * `work-execution.ts`) skips every `targetKind === 'root'` fact: a root
 * initial-work fact sharing a token with a member work request must never
 * be resumed (or settled) by a member chain (token-collision guard).
 *
 * LOCKING: `executeRootInitialWorkLocked` takes NO lock of its own — the
 * production wiring (the `createAdmitRootInitialWork` closure below) runs
 * it inside the SAME per-team promise chain the router / activity /
 * lifecycle modules share (`coordination.chains`), so the scan->admit->
 * deliver->terminal sequence is serialized per team and cannot interleave
 * with a racing admission (P8-S5B CR-8 shape). The closure also keeps the
 * compatibility gate INSIDE the lock (the gate may re-probe inline — a
 * durable compatibility write — and a racing new-work admission for the
 * same team must not interleave into its read->probe->re-read window).
 *
 * I/O only through the injected TeamDomain repositories (invariant 41)
 * and the injected delivery port; no member lifecycle, no activity, no
 * node: builtins, no upstream imports.
 *
 * @module @dsh-agent-team/runtime/action-router/root-initial-work
 */
import type { TeamBlueprint } from '../../domain/blueprint/src/index.js';
import type { EnvironmentFact } from '../../domain/compatibility/src/index.js';
import type { TeamDomainRepositories } from '../../storage/repositories/index.js';
import type { ResolvedCaller } from '../admission/resolve.js';
import type { TeamOperationChainMap } from '../coordination/index.js';
/** The payload discriminator of a Root initial-work fact (the scanner's filter). */
export declare const ROOT_TARGET_KIND = "root";
/** The EXISTING admission fact type (the Root entries carry `targetKind: 'root'`). */
export declare const FACT_WORK_ADMITTED = "team-work-admitted";
/** The ONE new fact type: the terminal SUCCESS record of one Root initial work. */
export declare const FACT_ROOT_WORK_DELIVERED = "team-root-work-delivered";
/** One durable fact reference (the sequence + the payload record). */
export interface RootWorkFactRef {
    readonly sequence: number;
    readonly payload: Record<string, unknown>;
}
/** The outcome of the Root initial-work scan (plan §15.6 decision table). */
export interface RootInitialWorkScan {
    /** The minimum-sequence `team-work-admitted` Root fact for the REQUESTED token (absent = none). */
    readonly admitted?: RootWorkFactRef;
    /** The minimum-sequence terminal `team-root-work-delivered` Root fact for the REQUESTED token (absent = none). */
    readonly terminal?: RootWorkFactRef;
    /** Every Root initial-work fact (admitted OR delivered) for a token DIFFERENT from the requested one — any entry means the team's one initial-work slot is occupied. */
    readonly foreign: readonly RootWorkFactRef[];
}
/**
 * The model-visible delivery port of the Root initial work (the live glue's
 * thin `deliverRootWork` adapter — the REAL Agent input seam, the same path
 * as the handoff `deliverRootContext`). The port submits the token-leading
 * text (the requestToken is the model-visible dedupe identity) and
 * propagates rejections: at-least-once is owned by the durable side (this
 * module), the glue only submits.
 */
export interface RootWorkDeliveryPort {
    deliverRootWork(input: {
        readonly rootSessionId: string;
        readonly requestToken: string;
        readonly prompt: string;
        readonly attachedContext?: string;
    }): Promise<void>;
}
/**
 * Everything one execution of the Root initial-work strategy needs
 * (the caller already holds the team's coordination chain; the
 * compatibility gate was already enforced by the closure).
 */
export interface RootInitialWorkDeps {
    /** The durable authority (ledger list + append). */
    readonly repositories: TeamDomainRepositories;
    /** The deterministic clock (ISO-8601). */
    readonly now: () => string;
    /** The team (root) session id. */
    readonly rootSessionId: string;
    /** The resolved calling authority (evidence only — no member resolution). */
    readonly caller: ResolvedCaller;
    /** The stable operation identity (the client-issued request token). */
    readonly requestToken: string;
    /** The model-visible prompt (non-empty). */
    readonly prompt: string;
    /** The optional attached-context block (absent/empty = no block). */
    readonly attachedContext?: string;
    /** The live Root input delivery port. */
    readonly deliverRootWork: RootWorkDeliveryPort;
}
/** The outcome of one Root initial-work execution. */
export interface RootInitialWorkResult {
    /** `fresh` = the full chain ran; `retry` = the admission existed (crash
     *  recovery), delivery was re-driven; `replay` = a terminal success
     *  already existed, ZERO delivery and ZERO writes. */
    readonly mode: 'fresh' | 'retry' | 'replay';
    readonly rootSessionId: string;
    readonly requestToken: string;
    readonly payloadFingerprint: string;
    /** The durable sequence of the (original) `team-work-admitted` fact. On a `replay` where the admission fact is somehow absent (unreachable — the terminal is only ever committed after the admission), the terminal sequence stands in. */
    readonly sequence: number;
    /** The durable sequence of the terminal `team-root-work-delivered` fact (committed by this call, or the pre-existing one on a `replay`). */
    readonly terminalSequence: number;
    /** Whether this call performed a model-visible delivery (false on `replay`). */
    readonly delivered: boolean;
}
/**
 * The durable payload fingerprint of one Root initial work: the SHA-256 of
 * the canonical JSON of the model-visible content (`prompt` plus the
 * `attachedContext` when present and non-empty — the exact content the
 * delivery port turns into text). An empty `attachedContext` is equivalent
 * to an absent one (the delivery port applies the same rule).
 */
export declare function computeRootWorkPayloadFingerprint(prompt: string, attachedContext?: string): string;
/**
 * Scan the team's durable ledger for the Root initial-work state of one
 * requested token (plan §15.6 decision table). Reads ONLY
 * `targetKind === 'root'` facts of the two Root fact types for this team —
 * member work facts (no `targetKind`) and other teams' facts are ignored,
 * and the ordinary member scanner (`scanWorkUnitFacts`) mirrors this
 * filter by skipping every `targetKind === 'root'` fact (no token
 * collision between the two worlds).
 */
export declare function scanRootInitialWorkFacts(repositories: TeamDomainRepositories, rootSessionId: string, requestToken: string): RootInitialWorkScan;
/**
 * Execute the Root initial-work strategy for one team (the plan §15.8
 * "locked executor"). The caller MUST already hold the team's
 * coordination chain AND have enforced the compatibility gate (the
 * `createAdmitRootInitialWork` closure does both) — this function takes
 * no lock of its own (chains are not re-entrant).
 *
 * Durable order (STATE/EVIDENCE — plan §15.7): the admission fact FIRST
 * (the operation identity + intent), then the model-visible delivery,
 * then the terminal fact. A delivery fault leaves the admission durable
 * and the terminal absent (the same-token retry recovers); a terminal
 * fault leaves an admitted-but-undelivered unit the same retry recovers.
 *
 * @throws {@link TeamRuntimeError} REQUEST_MALFORMED (input shape),
 *   ROOT_WORK_PAYLOAD_MISMATCH (same token, different payload),
 *   INITIAL_WORK_ALREADY_ADMITTED (another token's slot),
 *   WORK_DELIVERY_FAILED (the delivery fault, admission retained).
 */
export declare function executeRootInitialWorkLocked(deps: RootInitialWorkDeps): Promise<RootInitialWorkResult>;
/** The closure's per-call arguments (the v1/v2 shared entry point). */
export interface RootInitialWorkArgs {
    /** The TARGET team's root session id (may differ from the row's boot root — the glue delivers into any team root of the row's domain). */
    readonly rootSessionId: string;
    /** The resolved calling authority (the S6 principal derivation). */
    readonly caller: ResolvedCaller;
    /** The stable operation identity (the client-issued request token). */
    readonly requestToken: string;
    /** The model-visible prompt (non-empty). */
    readonly prompt: string;
    /** The optional attached-context block. */
    readonly attachedContext?: string;
    /** The TARGET team's bound blueprint (the compatibility gate's input; the S6 handler resolves it from the target's durable TeamSession row — the gate is the existing single compatibility authority, plan §15.8). */
    readonly blueprint: TeamBlueprint;
}
/** The closure inputs the production root wires (plan §15.8). */
export interface RootInitialWorkClosureInput {
    /** The SHARED per-team operation chain (the production `coordination.chains` — the strategy runs inside the same lock the router / activity / lifecycle modules use). */
    readonly teamLocks: TeamOperationChainMap;
    /** The durable authority (the opened TeamDomain repositories). */
    readonly repositories: TeamDomainRepositories;
    /** The environment-facts port (the compatibility gate's fresh-facts read). */
    readonly environmentFacts: () => Promise<readonly EnvironmentFact[]>;
    /** The deterministic clock (ISO-8601). */
    readonly now: () => string;
    /** The live Root input delivery port (the glue's `deliverRootWork`). */
    readonly deliverRootWork: RootWorkDeliveryPort;
}
/** One admitted Root initial-work command (the plan §15.8 closure). */
export type AdmitRootInitialWork = (args: RootInitialWorkArgs) => Promise<RootInitialWorkResult>;
/**
 * Build the production `admitRootInitialWork` closure (plan §15.8):
 *
 *   withTeamLock (the shared coordination.chains) ->
 *   enforceCompatibilityGate (the existing single compatibility
 *   authority, INSIDE the lock: the gate may re-probe inline and a
 *   racing new-work admission for the same team must not interleave) ->
 *   executeRootInitialWorkLocked.
 *
 * This is NOT a second TeamRuntime facade: the S6 remote handler calls
 * this closure directly (no `performAction`, no Member lifecycle /
 * activity, no second public entry point).
 */
export declare function createAdmitRootInitialWork(input: RootInitialWorkClosureInput): AdmitRootInitialWork;
//# sourceMappingURL=root-initial-work.d.ts.map