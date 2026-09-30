/**
 * pre-alpha3 W3-B (review fix F6/F7, guide §6) — the server-side CREATION
 * preflight authority + the production requirement-fact writers.
 *
 * F6 — the creation preflight. The pure {@link startupPreflight} classifier
 * was PR-E's unit face; this module makes it the PRODUCTION creation
 * authority (guide §6.2): the single choke point every fresh TeamSession
 * mint of the production host entry shares (the `bindFresh` wrapper) runs,
 * BEFORE the registry freeze and BEFORE any durable bind write:
 *
 * ```text
 * resolve Blueprint            (the bound snapshot ref → the full blueprint)
 * → build ALL scopes           (the Team scope + every v2 template scope,
 *                               Leader included — no instance needed)
 * → fresh runtime requirement  (the live provider's per-scope feeds — the
 *   facts                       W3-A authority; NOT the durable
 *                               compatibility chain: a team that has never
 *                               been created has no durable line, and a
 *                               pre-bind probe write would leave a durable
 *                               effect behind a refused creation)
 * → startupPreflight           (the PR-E classifier, unchanged)
 * ```
 *
 * A non-`proceed` outcome is a TYPED fail-closed block with ZERO durable
 * effect (no TeamSession record, no binding row, no leader mint, no
 * consent/availability fact — the human resolves via the F7 writers and
 * re-drives the creation; the idempotent re-drive is the "重新 preflight").
 *
 * F7 — the production writers. The DegradationConsent grant and the
 * template disable/enable are DURABLE human decisions over the frozen
 * `compatibility` ledger category (the PR-E fact model, the
 * commit-before-ack `writeRequirementFact`). The production world exposes
 * them as root-level services (the frozen remote contract v1–v6 gains NO
 * method — the UI flow consumes the typed preflight result and re-drives).
 * Both writers are FAIL-CLOSED:
 *
 * - the consent is validated against a FRESH evaluation (a consent that
 *   targets a required requirement or a satisfied one is refused — the
 *   PR-E `validateConsent` — and a target that is not in the current
 *   evaluation at all is refused: a consent is never minted for a
 *   requirement the blueprint does not declare);
 * - the availability entry is validated against the bound blueprint's
 *   template set (the PR-E `validateTemplateAvailability`);
 * - a single fact per call (one ledger row — no partial write is possible),
 *   and the write COMPLETES before the ack (a write failure propagates;
 *   the caller never observes a success that is not durable);
 * - re-runs converge: a repeated disable/enable appends a new row and the
 *   latest-wins read (the `readRequirementFacts` fold) reports the current
 *   availability; the consent line is a pure history (re-consenting the
 *   same optional requirement appends, never conflicts).
 *
 * Restart semantics (authority negative #10): both facts are durable
 * ledger rows under the team's rootSessionId — they survive a restart;
 * the live readiness (the probe verdicts) resets and is re-probed, the
 * consent/availability stand. A consent is keyed by the team's
 * rootSessionId, and the blueprint is bound INTO the TeamSession identity
 * (invariant 10): a different blueprint (hash/revision) is a different
 * team — the old consent is never inherited across it.
 *
 * I/O only through the injected ports (the facts thunks, the ledger, the
 * clock); no `node:` builtins, no upstream imports.
 * @module @dsh-agent-team/runtime/requirements/creation-preflight
 */
import type { EnvironmentFact } from '../../domain/compatibility/src/index.js';
import type { TeamBlueprint } from '../../domain/blueprint/src/index.js';
import type { DegradationConsent, PreflightResult, RequirementVerdict, ScopeVerdict, TemplateAvailability } from './types.js';
import { type RequirementFactsResolution } from '../requirement-facts/index.js';
import type { OptionalRequirementAccepted, TemplateAvailabilitySet } from './facts.js';
/** The narrow durable-write port of the requirement-fact ledger. */
export interface RequirementFactLedger {
    allocateSequence(): Promise<number>;
    put(entry: Record<string, unknown>): Promise<unknown>;
}
/** The inputs of one creation-scope evaluation (all injected). */
export interface CreationScopeEvaluationOptions {
    /** The bound blueprint (the full resolved document, v1 or v2). */
    readonly blueprint: TeamBlueprint;
    /** The Team scope's FRESH facts port (the live provider's team feed). */
    readonly environmentFacts: () => Promise<readonly EnvironmentFact[]>;
    /**
     * The per-TEMPLATE scope facts port (the live provider's template-boundary
     * feeds; W3-A). ABSENT (factory worlds) → every scope evaluates against
     * the same fresh team-scope facts read (the legacy behavior).
     */
    readonly templateEnvironmentFacts?: (templateId: string) => Promise<readonly EnvironmentFact[]>;
    /**
     * D-3 (2026-09-30, adjudicated product semantics — fail-closed PENDING)
     * — the Team-scope FULL-RESOLUTION live read (the atomic 3-state
     * observations + 2-state feed pair). PRESENT → the preflight consumes
     * THIS source (the feed drives the engine, the observations drive the
     * PENDING rule: a REQUIRED capability whose live observation is UNKNOWN
     * is a typed `pending` outcome — never a seed-filled PASS). ABSENT →
     * the facts-only port stands (byte-identical; the PENDING rule is off).
     */
    readonly environmentFactsRead?: () => Promise<RequirementFactsResolution>;
    /**
     * D-3 (2026-09-30) — the per-TEMPLATE FULL-RESOLUTION live read (the
     * twin of `templateEnvironmentFacts`; same presence/absence semantics).
     */
    readonly templateEnvironmentFactsRead?: (templateId: string) => Promise<RequirementFactsResolution>;
}
/** The captured full-resolution reads of one creation-scope evaluation. */
export interface CreationScopeLiveReads {
    /** The Team scope's full resolution (present when the read port ran). */
    readonly team?: RequirementFactsResolution;
    /** The per-TEMPLATE full resolutions (keyed by templateId). */
    readonly templates: ReadonlyMap<string, RequirementFactsResolution>;
}
/** The per-scope verdicts of one creation-scope evaluation. */
export interface CreationScopeEvaluation {
    /** The raw per-scope requirement verdicts, keyed by scope key. */
    readonly scopeVerdicts: Readonly<Record<string, readonly RequirementVerdict[]>>;
    /** The classified scope verdicts (ready / degraded / blocked). */
    readonly scopeStates: readonly ScopeVerdict[];
    /**
     * D-3 (2026-09-30) — the captured full-resolution reads (present only
     * when a read port was supplied — the PENDING rule's 3-state input; the
     * pair is ATOMIC: the observations always accompany the facts the
     * verdicts were computed from).
     */
    readonly liveReads?: CreationScopeLiveReads;
}
/**
 * Evaluate EVERY scope of the blueprint against ONE fresh facts read — the
 * creation-time form of the gate's scope evaluation: the Team scope and
 * every v2 template scope go through the PURE engine on their fresh feeds
 * (no durable compatibility authority chain — a pre-bind evaluation must
 * leave NO durable effect, and a never-created team has no durable line to
 * consult; its first evaluation IS the fresh probe).
 *
 * @throws {@link TeamRuntimeError} COMPATIBILITY_BLOCKED (fail-closed) when
 *   a facts port fails (a chain failure is never a creation).
 */
export declare function evaluateCreationScopes(options: CreationScopeEvaluationOptions): Promise<CreationScopeEvaluation>;
/** The inputs of one creation preflight classification. */
export interface CreationPreflightOptions extends CreationScopeEvaluationOptions {
    /** The durable degradation consents (the caller's read; optional —
     *   absent = none, the pre-bind default). */
    readonly consents?: readonly DegradationConsent[];
    /** The durable template availability (the caller's read; optional —
     *   absent = all available, the pre-bind default). */
    readonly availability?: readonly TemplateAvailability[];
}
/**
 * Run the creation preflight (guide §6.2): evaluate ALL scopes on fresh
 * runtime facts, fold in the durable consents + template availability, and
 * classify through the PR-E {@link startupPreflight} (the pure classifier,
 * unchanged) — then apply the D-3 (2026-09-30) PENDING overlay when a
 * full-resolution read was captured.
 *
 * D-3 overlay (the same adjudicated fail-closed PENDING semantics as the
 * requirement gate / activation provider — plan §C.3 "否则 unresolved fail
 * closed；禁止 false OPEN" + E.3 "no false OPEN" + E.11 negative #10
 * "readiness 重置 unknown" + C.5): a REQUIRED applicable requirement whose
 * LIVE observation is UNKNOWN and IN-FLIGHT (a pending materialization slot
 * exists on a live session — the B5 transient window) is a typed `pending`
 * outcome — NEVER a seed-filled PASS (the static seed remains
 * bootstrap/display only, guide §2.5). PF-2 tri-state (2026-09-30 — parent
 * adjudication option A): an UNKNOWN that is NEVER-OBSERVED (no fiber /
 * pending slot / failed slot on ANY live session — structurally
 * not-yet-applicable, the first-create bootstrap window) is NOT pending —
 * its seed-satisfied 2-state stands and the seed's TRUTH decides (C.2/E.6;
 * available `true` → `proceed`/`consentRequired` per the other rules,
 * `false`/absent → `fatal` — the exemption is not a blanket OPEN); the
 * overlay reads the ONE shared classifier predicate, so the probe, the
 * gate and the preflight classify identically (probe == gate, INV-9.4).
 * Precedence
 * (documented judgment): down-based outcomes stand first — a CONFIRMED
 * unreachable required wins (`fatal` / `fixOrDisable`, the actionable
 * ones); a down outcome whose blocked scope has NO confirmed down (a
 * no-seed unknown the engine reported as a missing FATAL) is RECLASSIFIED
 * to `pending`; otherwise `pending` beats `consentRequired` / `proceed`.
 * Disabled templates are RESOLVED (their work will not start) — excluded
 * from the pending partition. RECHECKABLE by construction: PENDING now
 * means IN-FLIGHT ONLY (the PF-2 product-message correction — every
 * PENDING the decision paths emit is genuinely recheckable at the next
 * boundary; the never-observed deadlock state no longer PENDINGs), the
 * block is a verdict, not a write (zero durable effect); the re-driven
 * creation
 * re-evaluates on a fresh read (the "重新 preflight"), and the manual
 * `compatibility.reprobe` seam clears a stuck slot.
 *
 * @returns the closed {@link PreflightResult} (`proceed` / `consentRequired`
 *   / `fixOrDisable` / `fatal` / `pending` — the last only with a
 *   full-resolution read).
 */
export declare function runCreationPreflight(options: CreationPreflightOptions): Promise<PreflightResult>;
/**
 * The blocked scope keys of a creation preflight result (the human-facing
 * "what is down" projection — every scope in a blocked state).
 */
export declare function blockedScopeKeysOf(result: PreflightResult): readonly string[];
/** The inputs of one degradation-consent grant (the durable human consent). */
export interface ConsentGrantOptions {
    /** The durable-write port of the requirement-fact ledger. */
    readonly ledger: RequirementFactLedger;
    /** The bound blueprint the consent is given against (the full document). */
    readonly blueprint: TeamBlueprint;
    /** The root session id the fact row is stamped with (the team). */
    readonly rootSessionId: string;
    /** The OPTIONAL requirementId the consent covers. */
    readonly requirementId: string;
    /** The generation the consent is given against (drift detection; the
     *   creation path is a generation-1 creation — stamp the create's
     *   generation). */
    readonly generation: number;
    /** The human principal who consented (opaque). */
    readonly consentedBy: string;
    /** The Team scope's FRESH facts port (the validation evaluation). */
    readonly environmentFacts: () => Promise<readonly EnvironmentFact[]>;
    /** The per-template FRESH facts port (the validation evaluation). */
    readonly templateEnvironmentFacts?: (templateId: string) => Promise<readonly EnvironmentFact[]>;
    /** The epoch-ms clock for the fact payload (defaults to `Date.now`). */
    readonly nowMs?: () => number;
    /** The ISO-8601 clock for the fact row's `createdAt` (defaults to
     *   `nowMs`). */
    readonly now?: () => string;
}
/**
 * Durably grant ONE degradation consent (the human's `consentRequired`
 * resolution, guide §6.2): validate the target against a FRESH evaluation
 * (required-target / satisfied-target / undeclared-target = typed refusal,
 * ZERO writes), then write the `optional-requirement-accepted` fact
 * (commit-before-ack — the write completes before the ack; a failure
 * propagates, never a lost or partial consent).
 *
 * @throws {@link RequirementError} `CONSENT_TARGET_NOT_OPTIONAL` (the
 *   target is required), `CONSENT_TARGET_SATISFIED` (the target is met —
 *   or not declared at all: a consent is never minted for a requirement
 *   the blueprint does not declare). Durable-write failures propagate
 *   unchanged.
 */
export declare function grantDegradationConsent(options: ConsentGrantOptions): Promise<OptionalRequirementAccepted>;
/** The inputs of one template availability set (the durable disable/enable). */
export interface TemplateAvailabilitySetOptions {
    /** The durable-write port of the requirement-fact ledger. */
    readonly ledger: RequirementFactLedger;
    /** The bound blueprint the entry is validated against (the full document). */
    readonly blueprint: TeamBlueprint;
    /** The root session id the fact row is stamped with (the team). */
    readonly rootSessionId: string;
    /** The template the availability entry addresses. */
    readonly templateId: string;
    /** `false` = disable (the `fixOrDisable` resolution, guide §6.2);
     *   `true` = re-enable. */
    readonly available: boolean;
    /** The epoch-ms clock for the fact payload (defaults to `Date.now`). */
    readonly nowMs?: () => number;
    /** The ISO-8601 clock for the fact row's `createdAt` (defaults to
     *   `nowMs`). */
    readonly now?: () => string;
}
/**
 * Durably set ONE template's availability (the human's `fixOrDisable`
 * resolution, guide §6.2): validate the template against the bound
 * blueprint's template set (the PR-E `validateTemplateAvailability` —
 * unknown template = typed refusal, ZERO writes), then write the
 * `template-availability-set` fact (commit-before-ack; a failure
 * propagates). A repeated set appends a new row — the latest-wins read
 * fold reports the current availability (re-runs converge, no partial
 * write: the decision is exactly one row).
 *
 * @throws {@link RequirementError} `UNKNOWN_TEMPLATE` (the entry names a
 *   template the bound blueprint does not declare). Durable-write failures
 *   propagate unchanged.
 */
export declare function setTemplateAvailabilityFact(options: TemplateAvailabilitySetOptions): Promise<TemplateAvailabilitySet>;
//# sourceMappingURL=creation-preflight.d.ts.map