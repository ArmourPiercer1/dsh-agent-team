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
 *                       the production persona observer, plan §C.2)
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
 * Pure module over injected ports: no I/O, no live Agent, no `node:`
 * builtins. The ports are the I/O boundary (the production host binds them
 * to the glue's live state + the DSH public seams).
 * @module @dsh-agent-team/runtime/requirement-facts/provider
 */

import { deepFreeze } from '../../contracts/src/index.js'
import {
  parseEnvironmentFacts,
  parseRequirements,
} from '../../domain/compatibility/src/index.js'
import type { EnvironmentFact, Requirement } from '../../domain/compatibility/src/index.js'
import {
  MEMBER_LIVENESS,
  PROBE_VERDICTS,
  SUPPLY_AXIS,
  deriveMaterializationStatus,
  type CapabilityObservation,
  type ProbeVerdict,
} from '../readiness/index.js'
import {
  assertRequirementFactScope,
  type MemberMaterializationView,
  type RequirementFactsPorts,
  type RequirementFactsResolution,
  type RequirementObservation,
  type RequirementFactScope,
  type RuntimeRequirementFactsProvider,
} from './types.js'
import type { RuntimeSubstratePlan } from '../agent-setup/preset/index.js'

/**
 * The initial live generation of the 2-state engine feed (a probe port that
 * reports no generation of its own). The engine's fingerprint folds
 * availability + generation; a constant initial generation is the
 * compatibility probe's deterministic generation (cf.
 * PERSONA_PROBE_GENERATION) — availability flips change the fingerprint,
 * which is the re-evaluation the gate runs at every boundary.
 */
const INITIAL_LIVE_GENERATION = 1

/** The detail marker of a bootstrap-seed fact in the engine feed. */
const SEED_FACT_DETAIL = 'bootstrap seed (config.environmentFacts) — not runtime truth'

/** The (domain, subject) collision-proof key (the engine's own keying). */
function subjectKey(domain: string, subject: string): string {
  return `${domain}\u0000${subject}`
}

/** The readiness view of one probe (the 3-state + provenance). */
interface ReadinessView {
  readonly verdict: ProbeVerdict
  readonly source: string
  readonly observedAt: string
  readonly reason?: string
  readonly generation?: number
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
function personaReadiness(observation: RuntimeSubstratePlan['root']['persona'], presetId: string): ReadinessView & { reason?: string } {
  if (observation.kind === 'standard') {
    return { verdict: PROBE_VERDICTS.reachable, source: 'substrate-resolver', observedAt: '' }
  }
  if (observation.kind === 'complete') {
    return {
      verdict: PROBE_VERDICTS.unreachable,
      source: 'substrate-resolver',
      observedAt: '',
      reason: `preset '${presetId}' has a complete effective persona (the §13.5 conflict)`,
    }
  }
  if (observation.kind === 'absent') {
    return {
      verdict: PROBE_VERDICTS.unreachable,
      source: 'substrate-resolver',
      observedAt: '',
      reason: `preset '${presetId}' has no effective persona`,
    }
  }
  // unresolved: typed fail-closed observation → re-probable unknown.
  return {
    verdict: PROBE_VERDICTS.unknown,
    source: 'substrate-resolver',
    observedAt: '',
    reason: `preset '${presetId}' persona unresolved: ${observation.reason ?? 'the substrate could not be observed'}`,
  }
}

/**
 * Create the runtime requirement-facts provider over the injected ports
 * (the review fix F1 — the RequirementAuthority's only live environment
 * source).
 * @param ports - the supply list, the readiness probe, the substrate plan,
 *   the optional seed + materialization view + the clock.
 * @returns the provider surface.
 */
export function createRuntimeRequirementFactsProvider(ports: RequirementFactsPorts): RuntimeRequirementFactsProvider {
  const configured = new Set(ports.configuredMcpServers)

  return {
    async resolveFacts(args): Promise<RequirementFactsResolution> {
      const scope = assertRequirementFactScope(args.scope)
      const requirements = parseRequirements(args.requirements)
      const seedFacts = parseEnvironmentFacts(ports.seedFacts ?? [])
      const seedBySubject = new Map<string, EnvironmentFact>()
      for (const fact of seedFacts) {
        seedBySubject.set(subjectKey(fact.domain, fact.subject), fact)
      }

      // The substrate plan resolves at most once per call (memoized promise).
      let planPromise: Promise<RuntimeSubstratePlan> | undefined
      const substratePlan = (): Promise<RuntimeSubstratePlan> => {
        if (planPromise === undefined) {
          planPromise = Promise.resolve(ports.substratePlan())
        }
        return planPromise
      }

      // The member materialization view resolves at most once per call.
      let materializationPromise: Promise<MemberMaterializationView | undefined> | undefined
      const materializationView = (): Promise<MemberMaterializationView | undefined> => {
        if (materializationPromise === undefined) {
          materializationPromise =
            scope.kind === 'template' && ports.memberMaterialization !== undefined
              ? ports.memberMaterialization(scope)
              : Promise.resolve(undefined)
        }
        return materializationPromise
      }

      // The readiness probe memoized per (type, subject) within this call.
      const probeCache = new Map<string, Promise<CapabilityObservation>>()
      const probe = (type: Requirement['type'], subject: string): Promise<CapabilityObservation> => {
        const key = subjectKey(type, subject)
        let pending = probeCache.get(key)
        if (pending === undefined) {
          pending = Promise.resolve(ports.readiness.probe(type, subject))
          probeCache.set(key, pending)
        }
        return pending
      }

      // One materialization view for the whole call (the scope is one).
      const view = await materializationView()

      const observations: RequirementObservation[] = []
      // The feed is per (domain, subject) — unique (the engine rejects
      // duplicate pairs), deterministically ordered.
      const feedEntries = new Map<string, { readonly domain: string; readonly subject: string; fact: EnvironmentFact | undefined }>()

      for (const requirement of requirements) {
        for (const subject of requirement.subjects) {
          let observation: RequirementObservation
          switch (requirement.type) {
            case 'mcpServer': {
              const supply = configured.has(subject) ? SUPPLY_AXIS.configured : SUPPLY_AXIS.unconfigured
              let readiness: ReadinessView
              if (supply === SUPPLY_AXIS.unconfigured) {
                // Unconfigured: the capability CANNOT be live (a structural
                // configuration defect, not a runtime outage — recovery is
                // reconfiguration). Deterministic unreachable, no probe.
                readiness = {
                  verdict: PROBE_VERDICTS.unreachable,
                  source: 'supply',
                  observedAt: ports.now(),
                  reason: `mcp server '${subject}' is not configured on this row`,
                }
              } else {
                const live = await probe('mcpServer', subject)
                readiness = observationToView(live)
              }
              const materialization =
                scope.kind === 'template'
                  ? deriveMaterializationStatus({
                      liveness: view === undefined ? MEMBER_LIVENESS.cold : view.liveness,
                      slot: view?.mcpSlots.get(subject),
                    })
                  : undefined
              observation = deepFreeze({
                requirementId: requirement.requirementId,
                type: requirement.type,
                subject,
                supply,
                readiness: readiness.verdict,
                readinessSource: readiness.source,
                readinessObservedAt: readiness.observedAt,
                ...(readiness.reason !== undefined ? { readinessReason: readiness.reason } : {}),
                ...(materialization !== undefined ? { materialization } : {}),
              })
              break
            }
            case 'persona': {
              const plan = await substratePlan()
              const entry =
                subject === plan.root.presetId
                  ? { presetId: plan.root.presetId, persona: plan.root.persona }
                  : subject === plan.member.presetId
                    ? { presetId: plan.member.presetId, persona: plan.member.persona }
                    : undefined
              const now = ports.now()
              let readiness: ReadinessView
              if (entry === undefined) {
                readiness = {
                  verdict: PROBE_VERDICTS.unknown,
                  source: 'substrate-resolver',
                  observedAt: now,
                  reason: `persona requirement subject '${subject}' is not the observed root/member preset of this plan`,
                }
              } else {
                const mapped = personaReadiness(entry.persona, entry.presetId)
                readiness = { ...mapped, observedAt: now }
              }
              observation = deepFreeze({
                requirementId: requirement.requirementId,
                type: requirement.type,
                subject,
                readiness: readiness.verdict,
                readinessSource: readiness.source,
                readinessObservedAt: readiness.observedAt,
                ...(readiness.reason !== undefined ? { readinessReason: readiness.reason } : {}),
              })
              break
            }
            default: {
              // tool / skill / modelRoute / teamStructure: the existing
              // authoritative probe ports (a missing port is `unknown`,
              // fail-soft — the readiness provider's contract, plan §C.4).
              const live = await probe(requirement.type, subject)
              const readiness = observationToView(live)
              observation = deepFreeze({
                requirementId: requirement.requirementId,
                type: requirement.type,
                subject,
                readiness: readiness.verdict,
                readinessSource: readiness.source,
                readinessObservedAt: readiness.observedAt,
                ...(readiness.reason !== undefined ? { readinessReason: readiness.reason } : {}),
              })
              break
            }
          }
          observations.push(observation)
          // The feed: one entry per (domain, subject) — the first observation
          // for a pair decides (all observations of a pair share the same
          // live verdict within one resolution).
          const key = subjectKey(observation.type, observation.subject)
          if (!feedEntries.has(key)) {
            feedEntries.set(key, { domain: observation.type, subject: observation.subject, fact: undefined })
          }
          const entryState = feedEntries.get(key)!
          if (entryState.fact === undefined) {
            entryState.fact = deriveEngineFact(observation.type, observation.subject, observation, seedBySubject)
          }
        }
      }

      // Deterministic feed order (domain, then subject — the engine's own
      // probe-record order).
      const environmentFacts: EnvironmentFact[] = [...feedEntries.values()]
        .sort((a, b) => (a.domain === b.domain ? (a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : 0) : a.domain < b.domain ? -1 : 1))
        .map((entry) => entry.fact)
        .filter((fact): fact is EnvironmentFact => fact !== undefined)

      return deepFreeze({
        observations: deepFreeze(observations),
        environmentFacts: deepFreeze(environmentFacts),
        resolvedAt: ports.now(),
      })
    },
  }
}

/** The readiness view of one capability observation (the 3-state + provenance). */
function observationToView(observation: CapabilityObservation): ReadinessView {
  return {
    verdict: observation.verdict,
    source: observation.source,
    observedAt: observation.observedAt,
    ...(observation.reason !== undefined ? { reason: observation.reason } : {}),
    ...(observation.generation !== undefined ? { generation: observation.generation } : {}),
  }
}

/**
 * Derive the 2-state engine fact of one (domain, subject) from its live
 * observation (the feed contract, types.ts): live verdicts win; the
 * bootstrap seed feeds only an `unknown` live verdict.
 * @returns the fact, or `undefined` (omitted — the engine's unprobed sentinel).
 */
function deriveEngineFact(
  domain: string,
  subject: string,
  observation: RequirementObservation,
  seedBySubject: ReadonlyMap<string, EnvironmentFact>,
): EnvironmentFact | undefined {
  if (observation.readiness === PROBE_VERDICTS.reachable) {
    return deepFreeze({
      domain: domain as EnvironmentFact['domain'],
      subject,
      available: true,
      generation: observationGeneration(observation),
    })
  }
  if (observation.readiness === PROBE_VERDICTS.unreachable) {
    return deepFreeze({
      domain: domain as EnvironmentFact['domain'],
      subject,
      available: false,
      generation: observationGeneration(observation),
    })
  }
  // unknown: the bootstrap seed is the only pre-observation source (guide
  // §2.3 — a seed, never the runtime truth); without one the fact is omitted.
  const seed = seedBySubject.get(subjectKey(domain, subject))
  if (seed === undefined) return undefined
  return deepFreeze({
    domain: seed.domain,
    subject: seed.subject,
    available: seed.available,
    generation: seed.generation,
    detail: SEED_FACT_DETAIL,
  })
}

/** The generation of the live feed fact (the observation's, or the initial). */
function observationGeneration(observation: RequirementObservation): number {
  // The readiness view carried the optional generation; it is provenance of
  // the probe port. The observation surface does not re-expose it (the gate
  // reads the 3-state observation), so the feed uses the initial live
  // generation — availability flips (not generations) drive re-evaluation.
  return INITIAL_LIVE_GENERATION
}
