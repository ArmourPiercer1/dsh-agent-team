/**
 * pre-alpha3 PR-E / review fix F1 — the `RuntimeRequirementFactsProvider`:
 * the production live-environment source for the RequirementAuthority
 * (guide §2.3 — "#40 建立 live fact provider 的底层 seam, #42 切换 consumer").
 *
 * The provider resolves the LIVE facts of the bound Blueprint's requirements
 * at one boundary scope:
 *
 * ```text
 * MCP supply         -> ports.configuredMcpServers
 * MCP readiness      -> ports.readiness (the #40 CapabilityReadinessProvider —
 *                       a FRESH probe per call; the durable telemetry is
 *                       NEVER read back as readiness)
 * MCP materialization-> ports.memberMaterialization (the glue's ephemeral
 *                       live MCP state — template/instance boundary only;
 *                       a cold member is `not-applicable`, never `failed`)
 * persona            -> ports.substratePlan (the RuntimeSubstrateResolver +
 *                       the production persona observer, plan §C.2); the
 *                       persona KIND convention (the v2 SUBJECT convention,
 *                       plan §E.3): a subject that is a closed required
 *                       persona kind resolves the OBSERVED kind of the role
 *                       the scope addresses (team ⇒ root, template ⇒ member,
 *                       R8); a non-kind subject keeps the frozen v1 preset-id
 *                       path byte-for-byte
 * other domains      -> ports.readiness (the existing authoritative probe
 *                       ports; a missing port is `unknown`, fail-soft)
 * ```
 *
 * Every resolution is FRESH (no caching across calls): after a restart the
 * readiness recovers to `unknown` and the next probe re-establishes the
 * verdict (guide §2.3: "restart 后 readiness 应恢复为 unknown,再 probe").
 * The row `config.environmentFacts` enters only as the bootstrap seed
 * (guide §2.3): it feeds the engine for subjects whose live verdict is
 * `unknown` — never for a subject with a live verdict.
 *
 * **Probeable scoping (D-3 narrowing, 2026-09-30 — parent adjudication,
 * option 1).** Each observation carries the `probeable` STRUCTURAL fact:
 * whether a live probe port is registered for its capability type (read
 * here from the host's probe-port registry through the readiness port's
 * `hasProbe` query — the single source of truth; a readiness surface
 * without the query is treated as fully probeable). The D-3 PENDING
 * reclassification (see `./pending.js`) applies to REQUIRED subjects of
 * PROBEABLE types whose observation has not settled (the transient
 * materialization window — B5). A required `unknown` of a NON-probeable
 * type (no live probe port — structurally unobservable live; in the
 * current production host: `skill`/`tool`/`modelRoute`/`teamStructure`,
 * which register no probe port, while `mcpServer` does) keeps the legacy
 * seed-satisfied 2-state — the documented known gap (the bootstrap seed
 * is the only source for such types), the pre-W2-A behavior preserved
 * DELIBERATELY; it is NOT the W2-A "seed never truth" rule, which applies
 * to probeable domains where the live verdict settles.
 *
 * **The PF-2 tri-state (2026-09-30 — parent adjudication, option A).** The
 * probe port's observation of an UNSETTLED (`unknown`) probeable subject
 * may carry the `observationState` (see {@link ObservationState}):
 * `in-flight` — a pending materialization slot exists on a live session
 * (the B5 transient window; the D-3 typed PENDING stands) — or
 * `never-observed` — no fiber / pending slot / failed slot on ANY live
 * session (the capability is STRUCTURALLY not-yet-applicable; the
 * canonical v1→v2 first-create shape where a team-scope server
 * materializes only at the leader boundary of an EXISTING team — PENDING
 * there would be a liveness deadlock, because no observation can settle
 * short of the create itself). The provider carries the state onto each
 * observation (only `never-observed` is written; absent = `in-flight`,
 * the conservative default — the exemption is never inferred) and the ONE
 * shared classifier predicate in `./pending.js` applies it: a
 * never-observed required subject keeps the legacy seed-satisfied 2-state
 * (the bootstrap seed is the only pre-observation source — C.2; E.6
 * preflight; the seed's TRUTH decides — available `true` → OPEN/proceed,
 * `false`/absent → FATAL — the exemption is NOT a blanket OPEN), while
 * every other decision consumer (the probe drop-filter, the creation
 * preflight, the gate, the activation step) inherits identical behavior
 * from the same predicate — probe == gate (INV-9.4).
 *
 * Pure module over injected ports: no I/O, no live Agent, no `node:`
 * builtins. The ports are the I/O boundary (the production host binds them
 * to the glue's live state + the DSH public seams).
 * @module @dsh-agent-team/runtime/requirement-facts/provider
 */
import { deepFreeze } from '../../contracts/src/index.js';
import { isRequiredPersonaKind, parseEnvironmentFacts, parseRequirements, } from '../../domain/compatibility/src/index.js';
import { MATERIALIZATION_STATES, MEMBER_LIVENESS, PROBE_VERDICTS, SUPPLY_AXIS, deriveMaterializationStatus, } from '../readiness/index.js';
import { assertRequirementFactScope, REQUIREMENT_FACT_SCOPE_ROLES, } from './types.js';
/**
 * The initial live generation of the 2-state engine feed (a probe port that
 * reports no generation of its own). The engine's fingerprint folds
 * availability + generation; a constant initial generation is the
 * compatibility probe's deterministic generation (cf.
 * PERSONA_PROBE_GENERATION) — availability flips change the fingerprint,
 * which is the re-evaluation the gate runs at every boundary.
 */
const INITIAL_LIVE_GENERATION = 1;
/** The detail marker of a bootstrap-seed fact in the engine feed. */
const SEED_FACT_DETAIL = 'bootstrap seed (config.environmentFacts) — not runtime truth';
/** The (domain, subject) collision-proof key (the engine's own keying). */
function subjectKey(domain, subject) {
    return `${domain}\u0000${subject}`;
}
/**
 * Map the persona-kind observation of the substrate plan to the 3-state
 * readiness verdict of a `persona` requirement (the adapter's own mapping —
 * composable is available, the conflict is not):
 *
 * - `standard` → `reachable` (the composable persona holds);
 * - `complete` → `unreachable` (the §13.5 conflict — unavailable);
 * - `absent`   → `unreachable` (no composable persona — unavailable);
 * - `unresolved` → `unknown` (typed — the substrate could not be observed;
 *   re-probe at the next boundary; the bind-time slot fails closed on its
 *   own before any work starts).
 */
function personaReadiness(observation, presetId) {
    if (observation.kind === 'standard') {
        return { verdict: PROBE_VERDICTS.reachable, source: 'substrate-resolver', observedAt: '' };
    }
    if (observation.kind === 'complete') {
        return {
            verdict: PROBE_VERDICTS.unreachable,
            source: 'substrate-resolver',
            observedAt: '',
            reason: `preset '${presetId}' has a complete effective persona (the §13.5 conflict)`,
        };
    }
    if (observation.kind === 'absent') {
        return {
            verdict: PROBE_VERDICTS.unreachable,
            source: 'substrate-resolver',
            observedAt: '',
            reason: `preset '${presetId}' has no effective persona`,
        };
    }
    // unresolved: typed fail-closed observation → re-probable unknown.
    return {
        verdict: PROBE_VERDICTS.unknown,
        source: 'substrate-resolver',
        observedAt: '',
        reason: `preset '${presetId}' persona unresolved: ${observation.reason ?? 'the substrate could not be observed'}`,
    };
}
/**
 * Create the runtime requirement-facts provider over the injected ports
 * (the review fix F1 — the RequirementAuthority's only live environment
 * source).
 * @param ports - the supply list, the readiness probe, the substrate plan,
 *   the optional seed + materialization view + the clock.
 * @returns the provider surface.
 */
export function createRuntimeRequirementFactsProvider(ports) {
    const configured = new Set(ports.configuredMcpServers);
    return {
        async resolveFacts(args) {
            const scope = assertRequirementFactScope(args.scope);
            const requirements = parseRequirements(args.requirements);
            const seedFacts = parseEnvironmentFacts(ports.seedFacts ?? []);
            const seedBySubject = new Map();
            for (const fact of seedFacts) {
                seedBySubject.set(subjectKey(fact.domain, fact.subject), fact);
            }
            // The substrate plan resolves at most once per call (memoized promise).
            let planPromise;
            const substratePlan = () => {
                if (planPromise === undefined) {
                    planPromise = Promise.resolve(ports.substratePlan());
                }
                return planPromise;
            };
            // The member materialization view is resolved per (scope, subject)
            // INSIDE the mcpServer branch, after that subject's readiness probe
            // (Finding F: the probe of this very call may have just stamped the
            // slot `failed` — the view must read the post-stamp truth; see the
            // mcpServer case). No memoization: the port is a pure state read.
            // The readiness probe memoized per (type, subject) within this call.
            const probeCache = new Map();
            const probe = (type, subject) => {
                const key = subjectKey(type, subject);
                let pending = probeCache.get(key);
                if (pending === undefined) {
                    pending = Promise.resolve(ports.readiness.probe(type, subject));
                    probeCache.set(key, pending);
                }
                return pending;
            };
            // D-3 narrowing (2026-09-30, parent adjudication — option 1): the
            // deterministic STRUCTURAL fact — whether a live probe port is
            // registered for the capability type. The single source of truth is
            // the host's probe-port registry, read through the readiness port's
            // `hasProbe` query; a readiness surface without the query (test
            // doubles predating it) is treated as fully probeable — the
            // conservative default that preserves the D-3 PENDING semantics
            // wherever the structural fact is unavailable (never a timing- or
            // observation-count-based guess).
            const hasProbe = ports.readiness.hasProbe;
            const isProbeable = (type) => hasProbe === undefined ? true : hasProbe(type);
            const observations = [];
            // The feed is per (domain, subject) — unique (the engine rejects
            // duplicate pairs), deterministically ordered.
            const feedEntries = new Map();
            for (const requirement of requirements) {
                for (const subject of requirement.subjects) {
                    let observation;
                    switch (requirement.type) {
                        case 'mcpServer': {
                            const supply = configured.has(subject) ? SUPPLY_AXIS.configured : SUPPLY_AXIS.unconfigured;
                            let readiness;
                            // The live probe observation (undefined when unconfigured — the
                            // deterministic supply-unreachable path probes nothing).
                            let live;
                            if (supply === SUPPLY_AXIS.unconfigured) {
                                // Unconfigured: the capability CANNOT be live (a structural
                                // configuration defect, not a runtime outage — recovery is
                                // reconfiguration). Deterministic unreachable, no probe.
                                readiness = {
                                    verdict: PROBE_VERDICTS.unreachable,
                                    source: 'supply',
                                    observedAt: ports.now(),
                                    reason: `mcp server '${subject}' is not configured on this row`,
                                };
                            }
                            else {
                                live = await probe('mcpServer', subject);
                                readiness = observationToView(live);
                            }
                            // Finding F (confirmed-loss ordering) — the materialization
                            // view is resolved AFTER this subject's readiness probe: the
                            // aggregate probe of THIS VERY resolution may have just
                            // witnessed the confirmed loss (retired the fiber, stamped
                            // the slot `failed`) — the view must read the POST-stamp
                            // truth, so the scope verdict and the target verdict agree
                            // on the same boundary state within one gate passage (a
                            // pre-probe capture left the scope verdict `mounted` while
                            // the target verdict saw `failed` — the same boundary, two
                            // truths, one passage). One port call per (scope, subject):
                            // the port is a pure state read (the host's member row list
                            // + the ephemeral consumption state), and a LATER subject's
                            // probe may stamp its own slot after this one's view was
                            // read (no per-call memoization — the fresh read is the
                            // point). Template scopes only (the team scope has no
                            // instance boundary); port absent (factory / test worlds) →
                            // `undefined` → the cold default (byte-identical legacy).
                            const view = scope.kind === 'template' && ports.memberMaterialization !== undefined
                                ? await ports.memberMaterialization(scope)
                                : undefined;
                            const materialization = scope.kind === 'template'
                                ? deriveMaterializationStatus({
                                    liveness: view === undefined ? MEMBER_LIVENESS.cold : view.liveness,
                                    slot: view?.mcpSlots.get(subject),
                                })
                                : undefined;
                            observation = deepFreeze({
                                requirementId: requirement.requirementId,
                                type: requirement.type,
                                subject,
                                supply,
                                readiness: readiness.verdict,
                                readinessSource: readiness.source,
                                readinessObservedAt: readiness.observedAt,
                                ...(readiness.reason !== undefined ? { readinessReason: readiness.reason } : {}),
                                // D-3 narrowing: only NON-probeable types are marked (the
                                // absent field = the probeable default; see types.ts).
                                ...(isProbeable(requirement.type) ? {} : { probeable: false }),
                                // PF-2 tri-state: the probe port's observation state of an
                                // unsettled verdict rides through (only `never-observed` is
                                // written; absent = in-flight — the conservative default).
                                ...(live !== undefined && live.observationState === 'never-observed' ? { observationState: live.observationState } : {}),
                                ...(materialization !== undefined ? { materialization } : {}),
                            });
                            break;
                        }
                        case 'persona': {
                            const plan = await substratePlan();
                            // The persona KIND convention (the v2 SUBJECT convention —
                            // plan §E.3 / ADR-24 / SKILL.md §4.1; the domain compatibility
                            // closed set is the single source of truth): a subject that IS a
                            // closed required persona kind names the REQUIRED kind — the world
                            // fact is the OBSERVED kind of the role the SCOPE addresses
                            // (plan §C.2 R8): team scope ⇒ the ROOT entry; template scope ⇒
                            // the entry of the role the scope CARRIES (Blocker-1 shared
                            // contract — the scope's `role` identity):
                            //   - role `leader` ⇒ the ROOT entry — the leader IS the root
                            //     (the root mounts config.rootPresetId, agent-bindings v3;
                            //     plan §C.2: the ROOT entry is "the actual preset used by
                            //     the Leader"; the bind-time persona slot reads the ROOT
                            //     entry, root.ts presetSeam — Architecture §13.1: members
                            //     inherit the root's bind substrate);
                            //   - role `member` ⇒ the MEMBER entry — the member requirement
                            //     uses the member's actual observation, not the root's.
                            // A subject that is NOT a kind keeps the LEGACY preset-id path
                            // byte-for-byte (the frozen v1 convention: the subject is the
                            // observed root/member preset id — the v1 frozen Blueprint cold
                            // resume is unchanged).
                            const entry = isRequiredPersonaKind(subject)
                                ? scope.kind === 'template' && scope.role === REQUIREMENT_FACT_SCOPE_ROLES.member
                                    ? plan.member
                                    : plan.root
                                : subject === plan.root.presetId
                                    ? { presetId: plan.root.presetId, persona: plan.root.persona }
                                    : subject === plan.member.presetId
                                        ? { presetId: plan.member.presetId, persona: plan.member.persona }
                                        : undefined;
                            const now = ports.now();
                            let readiness;
                            if (entry === undefined) {
                                readiness = {
                                    verdict: PROBE_VERDICTS.unknown,
                                    source: 'substrate-resolver',
                                    observedAt: now,
                                    reason: `persona requirement subject '${subject}' is not the observed root/member preset of this plan`,
                                };
                            }
                            else {
                                const mapped = personaReadiness(entry.persona, entry.presetId);
                                readiness = { ...mapped, observedAt: now };
                            }
                            observation = deepFreeze({
                                requirementId: requirement.requirementId,
                                type: requirement.type,
                                subject,
                                readiness: readiness.verdict,
                                readinessSource: readiness.source,
                                readinessObservedAt: readiness.observedAt,
                                ...(readiness.reason !== undefined ? { readinessReason: readiness.reason } : {}),
                                // D-3 narrowing: persona is observed via the substrate
                                // plan, never a readiness probe port — the registry's
                                // structural fact applies (the production host registers
                                // no `persona` probe port: persona-unknown keeps the
                                // legacy 2-state, it is not the transient probe window).
                                ...(isProbeable(requirement.type) ? {} : { probeable: false }),
                            });
                            // B3 (external review, P2) — typed end-to-end diagnostics:
                            // the KIND convention's world fact reports the OBSERVED kind
                            // (the engine's typed §13.5 lane keys on exactly that —
                            // engine.ts: `facts.some(f => f.domain === 'persona' &&
                            // f.subject === 'complete')`). When the observed kind of the
                            // scope's role is `complete`, emit the `(persona, 'complete')`
                            // world fact ALONGSIDE the kind-subject fact so the host lane
                            // surfaces the FROZEN typed conflict (
                            // TEAM_PERSONA_COMPLETE_PRESET_CONFLICT) instead of degrading
                            // to the generic PERSONA_INCOMPATIBLE. The kind-subject fact
                            // keying is preserved (the engine still probes `standard`
                            // unmet); the legacy preset-id path does NOT emit this
                            // (the frozen v1 feed stays byte-identical).
                            if (isRequiredPersonaKind(subject) &&
                                entry !== undefined &&
                                entry.persona.kind === 'complete') {
                                const alongsideKey = subjectKey('persona', 'complete');
                                if (!feedEntries.has(alongsideKey)) {
                                    feedEntries.set(alongsideKey, {
                                        domain: 'persona',
                                        subject: 'complete',
                                        fact: {
                                            domain: 'persona',
                                            subject: 'complete',
                                            available: true,
                                            generation: INITIAL_LIVE_GENERATION,
                                        },
                                    });
                                }
                            }
                            break;
                        }
                        default: {
                            // tool / skill / modelRoute / teamStructure: the existing
                            // authoritative probe ports (a missing port is `unknown`,
                            // fail-soft — the readiness provider's contract, plan §C.4).
                            const live = await probe(requirement.type, subject);
                            const readiness = observationToView(live);
                            observation = deepFreeze({
                                requirementId: requirement.requirementId,
                                type: requirement.type,
                                subject,
                                readiness: readiness.verdict,
                                readinessSource: readiness.source,
                                readinessObservedAt: readiness.observedAt,
                                ...(readiness.reason !== undefined ? { readinessReason: readiness.reason } : {}),
                                // D-3 narrowing: tool/skill/modelRoute/teamStructure carry
                                // the registry's structural fact (absent = probeable).
                                ...(isProbeable(requirement.type) ? {} : { probeable: false }),
                                // PF-2 tri-state: the probe port's observation state of an
                                // unsettled verdict rides through (only `never-observed` is
                                // written; absent = in-flight — the conservative default).
                                ...(live.observationState === 'never-observed' ? { observationState: live.observationState } : {}),
                            });
                            break;
                        }
                    }
                    observations.push(observation);
                    // The feed: one entry per (domain, subject) — the first observation
                    // for a pair decides (all observations of a pair share the same
                    // live verdict within one resolution).
                    const key = subjectKey(observation.type, observation.subject);
                    if (!feedEntries.has(key)) {
                        feedEntries.set(key, { domain: observation.type, subject: observation.subject, fact: undefined });
                    }
                    const entryState = feedEntries.get(key);
                    if (entryState.fact === undefined) {
                        entryState.fact = deriveEngineFact(observation.type, observation.subject, observation, seedBySubject);
                    }
                }
            }
            // Deterministic feed order (domain, then subject — the engine's own
            // probe-record order).
            const environmentFacts = [...feedEntries.values()]
                .sort((a, b) => (a.domain === b.domain ? (a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : 0) : a.domain < b.domain ? -1 : 1))
                .map((entry) => entry.fact)
                .filter((fact) => fact !== undefined);
            return deepFreeze({
                observations: deepFreeze(observations),
                environmentFacts: deepFreeze(environmentFacts),
                resolvedAt: ports.now(),
            });
        },
    };
}
/** The readiness view of one capability observation (the 3-state + provenance). */
function observationToView(observation) {
    return {
        verdict: observation.verdict,
        source: observation.source,
        observedAt: observation.observedAt,
        ...(observation.reason !== undefined ? { reason: observation.reason } : {}),
        ...(observation.generation !== undefined ? { generation: observation.generation } : {}),
    };
}
/**
 * Derive the 2-state engine fact of one (domain, subject) from its live
 * observation (the feed contract, types.ts): live verdicts win; the
 * bootstrap seed feeds only an `unknown` live verdict.
 * @returns the fact, or `undefined` (omitted — the engine's unprobed sentinel).
 */
function deriveEngineFact(domain, subject, observation, seedBySubject) {
    // Finding F (target-specific gating) — the FIRST check, beating the
    // readiness verdict and the bootstrap seed: a confirmed materialization
    // FAILURE is the 2-state DOWN even when the aggregate readiness is
    // `reachable` (the mask Finding F reports: a healthy sibling's fiber
    // keeps the SERVER-level probe up while the boundary's own mount is
    // `failed`) and even when the seed says `available` (the seed is a
    // bootstrap truth, never the boundary truth). Guide §2.5.5: a resident
    // member with a failed slot blocks that template's normal work. The
    // axis is present only for the mcpServer domain (the template/instance
    // boundary) — `pending` / `mounted` / `not-applicable` never flip the
    // feed (the readiness axis decides there: the liveness adjudication —
    // PENDING must never be a state only the blocked action can settle).
    if (observation.materialization === MATERIALIZATION_STATES.failed) {
        return deepFreeze({
            domain: domain,
            subject,
            available: false,
            generation: observationGeneration(observation),
        });
    }
    if (observation.readiness === PROBE_VERDICTS.reachable) {
        return deepFreeze({
            domain: domain,
            subject,
            available: true,
            generation: observationGeneration(observation),
        });
    }
    if (observation.readiness === PROBE_VERDICTS.unreachable) {
        return deepFreeze({
            domain: domain,
            subject,
            available: false,
            generation: observationGeneration(observation),
        });
    }
    // unknown: the bootstrap seed is the only pre-observation source (guide
    // §2.3 — a seed, never the runtime truth); without one the fact is omitted.
    const seed = seedBySubject.get(subjectKey(domain, subject));
    if (seed === undefined)
        return undefined;
    return deepFreeze({
        domain: seed.domain,
        subject: seed.subject,
        available: seed.available,
        generation: seed.generation,
        detail: SEED_FACT_DETAIL,
    });
}
/** The generation of the live feed fact (the observation's, or the initial). */
function observationGeneration(_observation) {
    // The readiness view carried the optional generation; it is provenance of
    // the probe port. The observation surface does not re-expose it (the gate
    // reads the 3-state observation), so the feed uses the initial live
    // generation — availability flips (not generations) drive re-evaluation.
    return INITIAL_LIVE_GENERATION;
}
//# sourceMappingURL=provider.js.map