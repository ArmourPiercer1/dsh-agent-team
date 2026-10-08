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
 * DURABLE-WRITE DISCIPLINE (corrected by A4-PR7 `compat-atomic`).
 *
 * The previous version of this block asserted that a state replace is "a
 * delete + put serialized behind the prober's promise-chain lock … on the same
 * team_domain write chain". That was FALSE and the code contradicted it: the
 * promise-chain lock is PER PROBER INSTANCE, and `putRecord`/`deleteRow` go
 * straight to `table.put`/`table.delete` — only `updateRaw` reaches the seam's
 * per-domain write chain. Two independent consultations built over ONE
 * repositories object (which is what every entry point does) therefore raced:
 * one lost per round, deterministically, and its rejection surfaced as
 * ACTIVATION_COMPATIBILITY_BLOCKED_FATAL — a false refusal of legitimate work
 * (`dev/agent-workflow/evidence/a4-pr7/p6t1-flake/FINDINGS.md` SS7). A module
 * comment asserting a property the code lacks is a defect that recruits the
 * next reader; the property is stated below as it NOW holds, including the part
 * that still does not hold.
 *
 * - ONE state transition = ONE durable write:
 *   `compatibility.replaceIfGeneration(record, expectedGeneration)`, whose
 *   generation check runs INSIDE the seam's atomic write-chain slot (the same
 *   `update` read-modify-write `teamSessions.advanceGeneration` uses). A writer
 *   conditioned on a generation that has moved on is rejected with
 *   `RECORD_DUPLICATE` / problem `stale-generation-compatibility-state` and
 *   writes NOTHING: a lost race is detectable, never silently destructive.
 * - NO probe path deletes any more, so the row is never observable as ABSENT
 *   between two writes, and a crash mid-write leaves the PREVIOUS row — human
 *   acknowledgements included — intact. The "documented crash window (delete
 *   landed, put lost)" this block used to describe, and the fail-safe re-probe
 *   it supposedly forced, no longer exist: nothing is lost, so nothing has to
 *   be re-established from nothing.
 * - WHAT IS STILL NOT GUARANTEED, named so the next reader does not have to
 *   rediscover it: the COLD transition (the caller read no row, so
 *   `expectedGeneration: 0`) is a `put`, and the public seam has no conditional
 *   create (`update` rejects a missing key with `missing-key`), so a create
 *   whose occupied-key check reads BEFORE a concurrent create's write is not
 *   detectable at this seam. Its blast radius is bounded: the two candidates
 *   carry the same generation and the same environment fingerprint (both
 *   probed the same live facts) and differ only in `computedAt`; the surviving
 *   row is always ONE probe's complete, well-formed record — never absent,
 *   never torn, never a state no probe computed — and every reader, the loser
 *   included, re-reads the row. Closing this last window needs a conditional
 *   create in the upstream storage seam: that is a host change (CORE_SEAM_BLOCKER
 *   with a zero core-patch budget), so it is disclosed, not papered over.
 * - `teamSessions.advanceGeneration` remains a SEPARATE durable write, ordered
 *   strictly AFTER the state transition is durable (a failed state write
 *   rejects before any advance). The compatibility row's own generation is what
 *   the compare-and-set conditions on; the team-session stamp is the
 *   state-durable-before-stamp lag marker of hooks A/B, unchanged.
 * - CONVERGENCE, not repetition: two consultations that race one generation
 *   still commit exactly ONE transition; the loser used to be refused, and a
 *   refusal of work the durable state actually permits is itself a failure.
 *   `isLostStateRace` identifies the typed signal, and the freshness paths
 *   (`ensureFreshGeneration` here, step 3 of
 *   `createCompatibilityAuthority().evaluate()`) treat a loser whose row now
 *   carries the live fingerprint as the freshness establishment it was waiting
 *   for. A loser whose row does NOT carry the live fingerprint still fails
 *   closed exactly as before, and `probe()` itself keeps rejecting with the
 *   typed conflict, so a version conflict always stays observable by name.
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
 * Is `error` the typed signal that ANOTHER writer committed the compatibility
 * state this writer was about to commit — a LOST COMPARE-AND-SET rather than a
 * failing write path?
 *
 * Both shapes of that signal come from `CompatibilityRepository` and both are
 * `RECORD_DUPLICATE` on the `compatibility` store, which is precisely what the
 * closed v1 code means — "a different record already occupies the key"
 * (`storage/schema/errors.ts`):
 *
 * - problem `stale-generation-compatibility-state`: the generation check inside
 *   the seam's write-chain slot rejected this writer because the row moved on;
 * - problem `duplicate-compatibility-state`: the cold create found the key
 *   already occupied by another creator's row.
 *
 * The predicate never swallows anything on its own: its users converge ONLY when
 * the durable row now carries the fingerprint they were trying to establish
 * (`ensureFreshGeneration`, and step 3 of the authority's evaluation chain);
 * otherwise the error propagates unchanged and the consultation fails closed
 * exactly as before. `probe()` itself always rejects with it, so a version
 * conflict stays observable BY NAME to any caller that asked for a probe.
 */
export declare function isLostStateRace(error: unknown): boolean;
/**
 * Create one per-TeamSession compatibility prober (the P7-T1 public
 * constructor).
 *
 * @param deps - the injected dependencies (see {@link CompatibilityProberDeps}).
 * @returns the prober (implements {@link CompatibilityProber}).
 */
export declare function createCompatibilityProber(deps: CompatibilityProberDeps): CompatibilityProber;
//# sourceMappingURL=probe.d.ts.map