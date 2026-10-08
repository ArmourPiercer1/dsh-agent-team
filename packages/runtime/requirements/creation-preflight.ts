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

import type { EnvironmentFact } from '../../domain/compatibility/src/index.js'
import { evaluateCompatibility } from '../../domain/compatibility/src/index.js'
import type { TeamBlueprint } from '../../domain/blueprint/src/index.js'
import type {
  DegradationConsent,
  PreflightResult,
  RequirementVerdict,
  ScopeVerdict,
  TemplateAvailability,
} from './types.js'
import { scopeKey, SCOPE_STATES, PREFLIGHT_OUTCOMES } from './types.js'
import {
  classifyScopeReadiness,
  type LiveReadinessSubject,
  type RequirementFactsResolution,
  type ScopeReadinessClassification,
} from '../requirement-facts/index.js'
import { evaluateScopes } from './evaluator.js'
import { scopeRequirementInputsOf, projectVerdicts } from './scope-requirements.js'
import { startupPreflight } from './startup-preflight.js'
import { validateConsent } from './consent.js'
import { validateTemplateAvailability } from './template-availability.js'
import {
  OPTIONAL_REQUIREMENT_ACCEPTED_FACT_TYPE,
  TEMPLATE_AVAILABILITY_SET_FACT_TYPE,
  optionalRequirementAcceptedPayload,
  templateAvailabilitySetPayload,
  writeRequirementFact,
} from './facts.js'
import type { OptionalRequirementAccepted, TemplateAvailabilitySet } from './facts.js'
import { REQUIREMENT_ERROR_CODES, RequirementError } from './errors.js'
import { TEAM_RUNTIME_ERROR_CODES, TeamRuntimeError } from '../admission/errors.js'

// ---------------------------------------------------------------------------
// the ledger port (the narrow writer surface — mirrors writeRequirementFact)
// ---------------------------------------------------------------------------

/** The narrow durable-write port of the requirement-fact ledger. */
export interface RequirementFactLedger {
  allocateSequence(): Promise<number>
  put(entry: Record<string, unknown>): Promise<unknown>
}

// ---------------------------------------------------------------------------
// F6 — the creation-scope evaluation (fresh, PURE — no durable effect)
// ---------------------------------------------------------------------------

/** The inputs of one creation-scope evaluation (all injected). */
export interface CreationScopeEvaluationOptions {
  /** The bound blueprint (the full resolved document, v1 or v2). */
  readonly blueprint: TeamBlueprint
  /** The Team scope's FRESH facts port (the live provider's team feed). */
  readonly environmentFacts: () => Promise<readonly EnvironmentFact[]>
  /**
   * The per-TEMPLATE scope facts port (the live provider's template-boundary
   * feeds; W3-A). ABSENT (factory worlds) → every scope evaluates against
   * the same fresh team-scope facts read (the legacy behavior).
   */
  readonly templateEnvironmentFacts?: (templateId: string) => Promise<readonly EnvironmentFact[]>
  /**
   * D-3 (2026-09-30, adjudicated product semantics — fail-closed PENDING)
   * — the Team-scope FULL-RESOLUTION live read (the atomic 3-state
   * observations + 2-state feed pair). PRESENT → the preflight consumes
   * THIS source (the feed drives the engine, the observations drive the
   * PENDING rule: a REQUIRED capability whose live observation is UNKNOWN
   * is a typed `pending` outcome — never a seed-filled PASS). ABSENT →
   * the facts-only port stands (byte-identical; the PENDING rule is off).
   */
  readonly environmentFactsRead?: () => Promise<RequirementFactsResolution>
  /**
   * D-3 (2026-09-30) — the per-TEMPLATE FULL-RESOLUTION live read (the
   * twin of `templateEnvironmentFacts`; same presence/absence semantics).
   */
  readonly templateEnvironmentFactsRead?: (
    templateId: string,
  ) => Promise<RequirementFactsResolution>
}

/** The captured full-resolution reads of one creation-scope evaluation. */
export interface CreationScopeLiveReads {
  /** The Team scope's full resolution (present when the read port ran). */
  readonly team?: RequirementFactsResolution
  /** The per-TEMPLATE full resolutions (keyed by templateId). */
  readonly templates: ReadonlyMap<string, RequirementFactsResolution>
}

/** The per-scope verdicts of one creation-scope evaluation. */
export interface CreationScopeEvaluation {
  /** The raw per-scope requirement verdicts, keyed by scope key. */
  readonly scopeVerdicts: Readonly<Record<string, readonly RequirementVerdict[]>>
  /** The classified scope verdicts (ready / degraded / blocked). */
  readonly scopeStates: readonly ScopeVerdict[]
  /**
   * D-3 (2026-09-30) — the captured full-resolution reads (present only
   * when a read port was supplied — the PENDING rule's 3-state input; the
   * pair is ATOMIC: the observations always accompany the facts the
   * verdicts were computed from).
   */
  readonly liveReads?: CreationScopeLiveReads
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
export async function evaluateCreationScopes(
  options: CreationScopeEvaluationOptions,
): Promise<CreationScopeEvaluation> {
  const { blueprint, environmentFacts, templateEnvironmentFacts } = options
  const inputs = scopeRequirementInputsOf(blueprint)

  // D-3 (2026-09-30) — the captured full-resolution reads (the atomic
  // observations + feed pair; the PENDING rule's 3-state input).
  const liveReads: { team?: RequirementFactsResolution; templates: Map<string, RequirementFactsResolution> } =
    { templates: new Map() }

  // 1. Team scope — one fresh facts read (a failure is a chain failure).
  let teamFacts: readonly EnvironmentFact[]
  try {
    if (options.environmentFactsRead !== undefined) {
      // D-3: the full-resolution read (the feed half drives the engine;
      // the observations half is captured for the PENDING rule).
      liveReads.team = await options.environmentFactsRead()
      teamFacts = liveReads.team.environmentFacts
    } else {
      teamFacts = await environmentFacts()
    }
  } catch (error) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED,
      'TeamRuntime: the environment-facts port failed during the creation preflight — the creation fails closed (zero durable effect)',
      {
        source: 'creation-preflight',
        reason: 'facts-unavailable',
        cause: error instanceof Error ? error.message : undefined,
      },
    )
  }
  const scopeVerdicts: Record<string, readonly RequirementVerdict[]> = {
    team: projectVerdicts(evaluateCompatibility({ requirements: inputs.team, environmentFacts: teamFacts })),
  }

  // 2. Template scopes — each on ITS OWN fresh feed (v2 only; the feeds
  //    may not be unioned — (domain, subject) pairs may collide across
  //    scopes, W3-A). A read failure is a chain failure (fail-closed).
  // A4-PR7 §7.3 Option A (decision record: dev/agent-workflow/evidence/a4-pr7/7-3-decision/Dossier.md):
  // the §E.2 grammar is a property of the blueprint SHAPE, not of its version digit — the scope list
  // `inputs.templates` is the shape (empty for a document that declares nothing), so no version test.
  {
    for (const [templateId, requirementInputs] of Object.entries(inputs.templates)) {
      let templateFacts: readonly EnvironmentFact[]
      if (options.templateEnvironmentFactsRead !== undefined) {
        // D-3: the full-resolution read (captured per template).
        try {
          const resolution = await options.templateEnvironmentFactsRead(templateId)
          liveReads.templates.set(templateId, resolution)
          templateFacts = resolution.environmentFacts
        } catch (error) {
          throw new TeamRuntimeError(
            TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED,
            `TeamRuntime: the template-environment-facts-read port failed for template '${templateId}' during the creation preflight — the creation fails closed (zero durable effect)`,
            {
              source: 'creation-preflight',
              reason: 'facts-unavailable',
              templateId,
              cause: error instanceof Error ? error.message : undefined,
            },
          )
        }
      } else if (templateEnvironmentFacts === undefined) {
        templateFacts = teamFacts
      } else {
        try {
          templateFacts = await templateEnvironmentFacts(templateId)
        } catch (error) {
          throw new TeamRuntimeError(
            TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED,
            `TeamRuntime: the template-environment-facts port failed for template '${templateId}' during the creation preflight — the creation fails closed (zero durable effect)`,
            {
              source: 'creation-preflight',
              reason: 'facts-unavailable',
              templateId,
              cause: error instanceof Error ? error.message : undefined,
            },
          )
        }
      }
      scopeVerdicts[scopeKey({ level: 'template', templateId })] = projectVerdicts(
        evaluateCompatibility({ requirements: requirementInputs, environmentFacts: templateFacts }),
      )
    }
  }

  return {
    scopeVerdicts,
    scopeStates: evaluateScopes({ scopeVerdicts }),
    ...(liveReads.team !== undefined || liveReads.templates.size > 0
      ? { liveReads: { ...(liveReads.team !== undefined ? { team: liveReads.team } : {}), templates: liveReads.templates } }
      : {}),
  }
}

/** The inputs of one creation preflight classification. */
export interface CreationPreflightOptions extends CreationScopeEvaluationOptions {
  /** The durable degradation consents (the caller's read; optional —
   *   absent = none, the pre-bind default). */
  readonly consents?: readonly DegradationConsent[]
  /** The durable template availability (the caller's read; optional —
   *   absent = all available, the pre-bind default). */
  readonly availability?: readonly TemplateAvailability[]
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
export async function runCreationPreflight(options: CreationPreflightOptions): Promise<PreflightResult> {
  const evaluation = await evaluateCreationScopes(options)
  const base = startupPreflight({
    scopeVerdicts: evaluation.scopeVerdicts,
    ...(options.consents !== undefined ? { consents: options.consents } : {}),
    ...(options.availability !== undefined ? { availability: options.availability } : {}),
    // Finding J (2026-10-01, ADR-12) — the consent key carries the bound
    // blueprint's content hash: a durable consent is honored for exactly the
    // scope + hash it was granted for (a legacy unkeyed row fails closed
    // against a keyed evaluation).
    blueprintContentHash: options.blueprint.contentHash,
  })
  if (evaluation.liveReads === undefined) return base
  return applyPendingOverlay(base, evaluation, options)
}

/**
 * D-3 (2026-09-30) — the PENDING overlay over the classifier's result
 * (pure over the captured full-resolution reads; see
 * {@link runCreationPreflight} for the adjudicated semantics).
 */
function applyPendingOverlay(
  base: PreflightResult,
  evaluation: CreationScopeEvaluation,
  options: CreationPreflightOptions,
): PreflightResult {
  const inputs = scopeRequirementInputsOf(options.blueprint)
  const liveReads = evaluation.liveReads!
  const availability = new Map(
    (options.availability ?? []).map((entry) => [entry.templateId, entry.available]),
  )

  // The shared classifier (the COLD-member `not-applicable` mcpServer
  // exemption lives inside it — E.11 negative #1, guide §2.5.4).
  const emptyClassification: ScopeReadinessClassification = { pending: [], down: [] }
  const teamClass =
    liveReads.team !== undefined
      ? classifyScopeReadiness({
          scopeKey: 'team',
          inputs: inputs.team,
          observations: liveReads.team.observations,
        })
      : emptyClassification
  const templateClasses = new Map<string, ScopeReadinessClassification>()
  for (const [templateId, requirementInputs] of Object.entries(inputs.templates)) {
    const read = liveReads.templates.get(templateId)
    if (read === undefined) continue
    templateClasses.set(
      templateId,
      classifyScopeReadiness({
        scopeKey: scopeKey({ level: 'template', templateId }),
        inputs: requirementInputs,
        observations: read.observations,
      }),
    )
  }

  // 1. Reclassification: a down outcome whose blocked scope has NO
  //    confirmed down (a no-seed unknown the engine reported as a missing
  //    FATAL) is the honest PENDING category; a confirmed down keeps the
  //    actionable down outcome.
  if (base.outcome === PREFLIGHT_OUTCOMES.fatal) {
    if (teamClass.down.length === 0 && teamClass.pending.length > 0) {
      return pendingPreflight(base, teamClass.pending)
    }
    return base
  }
  if (base.outcome === PREFLIGHT_OUTCOMES.fixOrDisable) {
    // The classifier's fix-or-disable targets: the blocked, NON-disabled
    // template scopes (a disabled template is resolved — its required
    // work will not start).
    const targetIds = base.scopes
      .filter(
        (scope) =>
          scope.scope.level === 'template' &&
          scope.state === SCOPE_STATES.blocked &&
          scope.scope.templateId !== undefined &&
          availability.get(scope.scope.templateId) !== false,
      )
      .map((scope) => scope.scope.templateId as string)
    const targetsHaveDown = targetIds.some(
      (templateId) => (templateClasses.get(templateId)?.down.length ?? 0) > 0,
    )
    if (!targetsHaveDown) {
      const findings = targetIds.flatMap((templateId) => templateClasses.get(templateId)?.pending ?? [])
      if (findings.length > 0) return pendingPreflight(base, findings)
    }
    return base
  }

  // 2. Not a down outcome: `pending` beats `consentRequired` / `proceed`
  //    (a required capability that has not yet been observed admits
  //    nothing — fail-closed). Disabled templates are resolved (excluded).
  const pendingFindings: readonly LiveReadinessSubject[] = [
    ...teamClass.pending,
    ...[...templateClasses.entries()]
      .filter(([templateId]) => availability.get(templateId) !== false)
      .flatMap(([, classification]) => classification.pending),
  ]
  if (pendingFindings.length > 0) {
    return pendingPreflight(base, pendingFindings)
  }
  return base
}

/** Build the typed `pending` preflight result from the live findings. */
function pendingPreflight(
  base: PreflightResult,
  findings: readonly LiveReadinessSubject[],
): PreflightResult {
  return {
    outcome: PREFLIGHT_OUTCOMES.pending,
    scopes: base.scopes,
    consentRequiredRequirementIds: [],
    fixOrDisableRequirementIds: [],
    fatalRequirementIds: [],
    pendingRequirementIds: [...new Set(findings.map((finding) => finding.requirementId))],
  }
}

/**
 * The blocked scope keys of a creation preflight result (the human-facing
 * "what is down" projection — every scope in a blocked state).
 */
export function blockedScopeKeysOf(result: PreflightResult): readonly string[] {
  return result.scopes
    .filter((scope) => scope.state === SCOPE_STATES.blocked)
    .map((scope) => scopeKey(scope.scope))
}

// ---------------------------------------------------------------------------
// F7 — the production writers (durable, fail-closed, commit-before-ack)
// ---------------------------------------------------------------------------

/** The inputs of one degradation-consent grant (the durable human consent). */
export interface ConsentGrantOptions {
  /** The durable-write port of the requirement-fact ledger. */
  readonly ledger: RequirementFactLedger
  /** The bound blueprint the consent is given against (the full document). */
  readonly blueprint: TeamBlueprint
  /** The root session id the fact row is stamped with (the team). */
  readonly rootSessionId: string
  /** The OPTIONAL requirementId the consent covers. */
  readonly requirementId: string
  /** The generation the consent is given against (drift detection; the
   *   creation path is a generation-1 creation — stamp the create's
   *   generation). */
  readonly generation: number
  /** The human principal who consented (opaque). */
  readonly consentedBy: string
  /**
   * Finding J (2026-10-01, ADR-12) — the scope the consent is granted FOR
   * (the scopeKey: `team` or `template:<id>`). PRESENT → the target is
   * validated against that scope's verdicts (the requirement must be unmet
   * there). ABSENT → the scope is DERIVED: the requirement must be unmet in
   * exactly ONE scope (unmet in several = the closed
   * `DUPLICATE_REQUIREMENT_SCOPE` typed refusal — the grant must name the
   * scope; unmet in none = `CONSENT_TARGET_SATISFIED` as before).
   */
  readonly scopeKey?: string
  /** The Team scope's FRESH facts port (the validation evaluation). */
  readonly environmentFacts: () => Promise<readonly EnvironmentFact[]>
  /** The per-template FRESH facts port (the validation evaluation). */
  readonly templateEnvironmentFacts?: (templateId: string) => Promise<readonly EnvironmentFact[]>
  /** The epoch-ms clock for the fact payload (defaults to `Date.now`). */
  readonly nowMs?: () => number
  /** The ISO-8601 clock for the fact row's `createdAt` (defaults to
   *   `nowMs`). */
  readonly now?: () => string
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
export async function grantDegradationConsent(options: ConsentGrantOptions): Promise<OptionalRequirementAccepted> {
  const nowMs = options.nowMs ?? Date.now
  const evaluation = await evaluateCreationScopes({
    blueprint: options.blueprint,
    environmentFacts: options.environmentFacts,
    ...(options.templateEnvironmentFacts !== undefined
      ? { templateEnvironmentFacts: options.templateEnvironmentFacts }
      : {}),
  })
  // Finding J (2026-10-01, ADR-12) — the consent is keyed by
  // (scope, blueprint content hash, requirementId). The same requirementId
  // may be declared in MULTIPLE scopes (the v2 validator guarantees
  // uniqueness WITHIN a list only), so a consent must be bound to the EXACT
  // scope it covers — a flat ID-only match let one consent bleed across
  // scopes (and, unkeyed by hash, across blueprint revisions).
  const matches: Array<{ scopeKey: string; verdict: RequirementVerdict }> = []
  for (const [key, verdicts] of Object.entries(evaluation.scopeVerdicts)) {
    for (const row of verdicts) {
      if (row.requirementId === options.requirementId) matches.push({ scopeKey: key, verdict: row })
    }
  }
  if (matches.length === 0) {
    // Not declared in ANY scope of the bound blueprint: there is nothing to
    // consent to. `CONSENT_TARGET_SATISFIED` in the closed vocabulary is
    // the code for "not unmet in the current evaluation" — an undeclared
    // target is vacuously not unmet; the detail carries the distinction.
    throw new RequirementError(
      REQUIREMENT_ERROR_CODES.CONSENT_TARGET_SATISFIED,
      `consent names requirement '${options.requirementId}' which is not unmet in the current evaluation (the bound blueprint declares no such requirement) — nothing to consent to`,
      { requirementId: options.requirementId, reason: 'requirement-not-in-evaluation' },
    )
  }

  // Resolve the consent's SCOPE: an explicit `scopeKey` names it (the target
  // must be unmet in THAT scope); otherwise the requirement must be unmet in
  // exactly ONE scope (the derived scope). Unmet in several scopes is an
  // ambiguous binding — the closed `DUPLICATE_REQUIREMENT_SCOPE` code; the
  // grant must name the scope.
  const unmetMatches = matches.filter((m) => m.verdict.outcome === 'warning')
  let targetScopeKey: string
  if (options.scopeKey !== undefined) {
    const inScope = matches.find((m) => m.scopeKey === options.scopeKey)
    if (inScope === undefined) {
      throw new RequirementError(
        REQUIREMENT_ERROR_CODES.CONSENT_TARGET_SATISFIED,
        `consent names requirement '${options.requirementId}' for scope '${options.scopeKey}' which is not unmet in that scope (the bound blueprint does not declare it there, or it is met there) — nothing to consent to in that scope`,
        { requirementId: options.requirementId, scopeKey: options.scopeKey, reason: 'requirement-not-unmet-in-scope' },
      )
    }
    targetScopeKey = inScope.scopeKey
  } else if (unmetMatches.length === 1) {
    targetScopeKey = unmetMatches[0]!.scopeKey
  } else if (unmetMatches.length > 1) {
    throw new RequirementError(
      REQUIREMENT_ERROR_CODES.DUPLICATE_REQUIREMENT_SCOPE,
      `consent for requirement '${options.requirementId}' is ambiguous: the requirement is unmet in more than one scope (${unmetMatches.map((m) => m.scopeKey).join(', ')}) — a consent is per-scope (ADR-12); name the scope (scopeKey) in the grant`,
      { requirementId: options.requirementId, scopeKeys: unmetMatches.map((m) => m.scopeKey) },
    )
  } else {
    // Declared but met in every scope: classify the first match (the
    // pre-J flat semantics — required-target / satisfied-target, typed).
    const first = matches[0]!
    if (first.verdict.complete === true) {
      throw new RequirementError(
        REQUIREMENT_ERROR_CODES.CONSENT_TARGET_NOT_OPTIONAL,
        `consent targets a REQUIRED requirement '${options.requirementId}' (a consent covers an OPTIONAL requirement only)`,
        { requirementId: options.requirementId },
      )
    }
    throw new RequirementError(
      REQUIREMENT_ERROR_CODES.CONSENT_TARGET_SATISFIED,
      `consent targets a SATISFIED requirement '${options.requirementId}' (there is nothing to consent to)`,
      { requirementId: options.requirementId },
    )
  }
  // The PR-E validation against the TARGET SCOPE's verdict (a consent is
  // per-scope — a required / satisfied target in another scope does not
  // make this grant valid, and vice versa).
  const targetVerdict = matches.find((m) => m.scopeKey === targetScopeKey)!.verdict
  validateConsent(
    {
      requirementId: options.requirementId,
      generation: options.generation,
      consentedAt: nowMs(),
      consentedBy: options.consentedBy,
    },
    [targetVerdict],
  )
  // The consent is STAMPED with its key: the granted scope + the bound
  // blueprint's content hash (ADR-12: durable per Team + immutable
  // Blueprint contentHash + requirement scope).
  const payload = optionalRequirementAcceptedPayload({
    requirementId: options.requirementId,
    generation: options.generation,
    consentedAt: nowMs(),
    consentedBy: options.consentedBy,
    scopeKey: targetScopeKey,
    contentHash: options.blueprint.contentHash,
  })
  await writeRequirementFact(
    options.ledger,
    options.rootSessionId,
    OPTIONAL_REQUIREMENT_ACCEPTED_FACT_TYPE,
    payload,
    options.now ?? (() => new Date(nowMs()).toISOString()),
  )
  return payload
}

/** The inputs of one template availability set (the durable disable/enable). */
export interface TemplateAvailabilitySetOptions {
  /** The durable-write port of the requirement-fact ledger. */
  readonly ledger: RequirementFactLedger
  /** The bound blueprint the entry is validated against (the full document). */
  readonly blueprint: TeamBlueprint
  /** The root session id the fact row is stamped with (the team). */
  readonly rootSessionId: string
  /** The template the availability entry addresses. */
  readonly templateId: string
  /** `false` = disable (the `fixOrDisable` resolution, guide §6.2);
   *   `true` = re-enable. */
  readonly available: boolean
  /** The epoch-ms clock for the fact payload (defaults to `Date.now`). */
  readonly nowMs?: () => number
  /** The ISO-8601 clock for the fact row's `createdAt` (defaults to
   *   `nowMs`). */
  readonly now?: () => string
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
export async function setTemplateAvailabilityFact(
  options: TemplateAvailabilitySetOptions,
): Promise<TemplateAvailabilitySet> {
  const knownTemplateIds = [
    options.blueprint.leader.templateId,
    ...options.blueprint.members.map((member) => member.templateId),
  ]
  // The PR-E validation (unknown template = typed, zero writes).
  validateTemplateAvailability([{ templateId: options.templateId, available: options.available }], knownTemplateIds)
  const nowMs = options.nowMs ?? Date.now
  const payload = templateAvailabilitySetPayload({
    templateId: options.templateId,
    available: options.available,
    at: nowMs(),
  })
  await writeRequirementFact(
    options.ledger,
    options.rootSessionId,
    TEMPLATE_AVAILABILITY_SET_FACT_TYPE,
    payload,
    options.now ?? (() => new Date(nowMs()).toISOString()),
  )
  return payload
}
