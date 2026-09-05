/**
 * P7-T1 — probe generation + warning ACK fingerprint (the core of the
 * runtime compatibility module).
 *
 * One {@link CompatibilityProber} owns one TeamSession's compatibility
 * generation line (the durable `compatibility` store row of the
 * TeamDomain, keyed by the root session id):
 *
 * - **probe generation** (Development Plan §20.1): every one of the five
 *   re-probe triggers runs a fresh probe — a fresh environment-facts
 *   read, an engine evaluation carrying the durable acknowledgements,
 *   and a durable state replace at generation + 1 bound to the new
 *   environment fingerprint. A probe never starts, admits, or cancels
 *   any work; it only classifies and records (Architecture §27.2/§28,
 *   the P3 engine contract).
 * - **warning ACK fingerprint** (Architecture §27.3): an
 *   acknowledgement is bound to the CURRENT mismatch fingerprint AND
 *   the CURRENT environment fingerprint of the evaluation it
 *   acknowledges — never a permanent "ignore all warnings" flag. The
 *   engine re-derives both fingerprints on every evaluation and
 *   re-classifies each durable ack VALID / STALE / MISSING; a drift
 *   therefore makes the old ack stale and the warning re-blocks
 *   (the §41.7 invalidation).
 * - **drift → new work admission** (DevPlan §20.1 "新 warning：block
 *   NEW work"; Architecture §28.1/§28.2/§41.7): the new-work gate
 *   re-checks freshness first (a stale/absent generation forces a
 *   `STALE_GENERATION_BEFORE_NEW_WORK` re-probe), then blocks NEW work
 *   on BLOCKED_WARNING / BLOCKED_FATAL. In-flight work admitted before
 *   the drift is tracked per prober and its settle path NEVER
 *   consults the current compatibility state (§28.2: compatibility
 *   drift 不自动取消正在执行的 model/tool operation).
 *
 * Durable-write discipline: the `compatibility` repository has no
 * upsert (a different state at the same key is RECORD_DUPLICATE), so a
 * state replace is a delete + put serialized behind the prober's
 * promise-chain lock (the P6-T1 provider pattern). The documented crash
 * window (delete landed, put lost) leaves the row ABSENT — the
 * new-work gate then treats the generation as stale and re-probes: the
 * fail-safe direction (a missing state can never be a stale GREEN).
 *
 * In-flight boundary (documented): the in-flight work ledger is in
 * memory per prober instance (process lifetime). Durable crash-window
 * reconciliation of in-flight work belongs to the P4 operation journal;
 * this module encodes only the §28.2 settle semantics.
 *
 * I/O only through the injected TeamDomain repositories and the
 * environment-facts port; no node: builtins, no upstream imports.
 * @module @dsh-agent-team/runtime/compatibility/probe
 */
import type { EnvironmentFact } from '../../domain/compatibility/src/index.js';
import type { TeamBlueprint } from '../../domain/blueprint/src/index.js';
import type { TeamDomainRepositories } from '../../storage/repositories/index.js';
import type { CompatibilityProber, DriftObservation, ProbeOutcome } from './types.js';
/** The dependencies of one compatibility prober (all injected). */
export interface CompatibilityProberDeps {
    /** The TeamDomain repositories (the durable `compatibility` store). */
    readonly repositories: TeamDomainRepositories;
    /** The root session id the prober owns (one generation line per team). */
    readonly rootSessionId: string;
    /** The bound blueprint (immutable durable snapshot). */
    readonly blueprint: TeamBlueprint;
    /**
     * The environment-facts port: a FRESH read of the current probe
     * verdicts (availability + generation per capability). The prober
     * never caches facts across probes.
     */
    readonly environmentFacts: () => Promise<readonly EnvironmentFact[]>;
    /** The clock port (default: `new Date().toISOString()`). */
    readonly now?: () => string;
    /** Optional probe observer (provenance channel; never fails a probe). */
    readonly onProbe?: (outcome: ProbeOutcome, drift: DriftObservation) => void;
}
/**
 * Create one per-TeamSession compatibility prober (the P7-T1 public
 * constructor).
 *
 * @param deps - the injected dependencies (see {@link CompatibilityProberDeps}).
 * @returns the prober (implements {@link CompatibilityProber}).
 */
export declare function createCompatibilityProber(deps: CompatibilityProberDeps): CompatibilityProber;
//# sourceMappingURL=probe.d.ts.map