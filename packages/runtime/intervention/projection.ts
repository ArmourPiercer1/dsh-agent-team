/**
 * Alpha.4 A4-PR3 — the Intervention PROJECTION surface (plan Task 3 lane C;
 * spec §14.1, §14.2, §16, §17.3, §18.3; ADR A1-17, A5-7, X8).
 *
 * Lane C's rule for this PR is that the projection is built **from Control
 * state only**. The Compatibility and GovernanceWarning sources keep their
 * adapter seam here ({@link InterventionSourceAdapter}) but ship unwired:
 * PR6 owns them together with the client's `INTERNAL_FACT_TYPES` mapping
 * (ADR A5-7), and the interim disclosure is recorded in
 * `intervention/index.ts` and the interface freeze — escalation and
 * abandonment rows render as generic Events until then.
 *
 * The authority boundary (spec §14.2) is enforced three ways, not asserted:
 *
 * 1. **Capability**: this module exports read functions only. It has no
 *    repository handle, no lock, and no write path; the durable write it
 *    would need to influence a decision is not reachable from here.
 * 2. **Immutability**: every item leaves {@link freezeItem} deep-frozen, so
 *    "editing a projected item to grant a review" is a `TypeError` in
 *    strict-mode ESM rather than a bug to review.
 * 3. **The edge pin + the behavioural proof**: ADR A1-17 forbids an import
 *    edge from the evaluator / authority kernel / Control service /
 *    operation guard into `intervention/**`, and
 *    `a4p3-intervention-projection.test.ts` proves both halves — the edge
 *    does not exist, and mutating (attempting to mutate) a projected item
 *    leaves the guard's verdict byte-identical.
 *
 * @module @dsh-agent-team/runtime/intervention
 */

import type { ApprovalCaseState, ApprovalCaseSummary, ControlSubject } from '../control/types.js'
import { CONTROL_LEG_TERMINAL_REASONS } from '../control/types.js'
import type {
  InterventionItem,
  RequiredAuthorityReader,
  RequiredAuthorityReaderInput,
} from './types.js'
import { deriveInterventionItems, deriveZeroLegAuthorityUnavailableItem } from './derivation.js'

/**
 * The narrow, structural slice of the Control plane the projection reads.
 *
 * Declared as a subset (not as `ControlService`) on purpose: the projection
 * must not gain the capability to write, and a structural subset is what
 * keeps that checkable at the type level. It is satisfied by the real
 * `ControlService` without the latter knowing about this module — the
 * dependency direction stays `intervention → control`, never the reverse
 * (ADR A1-17).
 */
export interface InterventionControlSource {
  /** The team's open approval cases (one item per CASE, not per leg). */
  listOpenApprovalCases(input: {
    readonly rootSessionId: string
    readonly subject?: ControlSubject
  }): Promise<readonly ApprovalCaseSummary[]>
  /**
   * The team's DECIDED approval cases (the fold mirror of the open read).
   * OPTIONAL on this seam on purpose: a source that does not offer it keeps
   * the shipped open-only projection untouched (fail-safe, not fail-open).
   * The real Control service implements it; what gets SURFACED from the
   * decided set is decided by THIS lane (the `terminalReason` filter in
   * {@link projectInterventions}), never by the control read.
   */
  listDecidedApprovalCases?(input: {
    readonly rootSessionId: string
    readonly subject?: ControlSubject
  }): Promise<readonly ApprovalCaseSummary[]>
}

/**
 * The seam PR6 fills for the non-Control sources (spec §15, §16). Declared
 * now so PR3's projection signature does not change under PR6; PR3 never
 * calls one, and an empty adapter list is the shipped state.
 */
export interface InterventionSourceAdapter {
  /** A stable, human-readable adapter name for diagnostics. */
  readonly source: string
  /** Derive this source's items for one team. Never writes anything. */
  project(input: {
    readonly rootSessionId: string
    readonly subject?: ControlSubject
  }): Promise<readonly InterventionItem[]>
}

/** Recursively freeze a projected value (see the module header, point 2). */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const inner of Object.values(value as Record<string, unknown>)) deepFreeze(inner)
    return Object.freeze(value)
  }
  return value
}

/**
 * The immutability boundary of the projection.
 *
 * @param item - a freshly derived item.
 * @returns the same item, deep-frozen.
 */
export function freezeItem(item: InterventionItem): InterventionItem {
  return deepFreeze(item)
}

/** Input of the team-wide projection. */
export interface ProjectInterventionsInput {
  readonly rootSessionId: string
  /** The Control-plane source (the only source wired in A4-PR3). */
  readonly control: InterventionControlSource
  /** Optional non-Control adapters; unwired until PR6. */
  readonly adapters?: readonly InterventionSourceAdapter[]
  /** Restrict the projection to one subject's items. */
  readonly subject?: ControlSubject
  /** The injected required-authority reader (PR4 wires the governance one). */
  readonly reader?: RequiredAuthorityReader
}

/**
 * Project one team's interventions.
 *
 * The Control slice reads open approval cases and derives one item per case;
 * the reader decides legality. A reader that throws is treated as
 * "no facts", never as "allow": the item then carries no legal actions
 * (spec §18.3 — the client may only use server-provided actions).
 *
 * The decided half of the A1-12 telling (spec §11.6) is merged in here:
 * decided cases stamped `terminalReason: resolver-unavailable` join the
 * projected set as terminal items (see the filter below); every other
 * decided close stays invisible exactly as before this lane.
 *
 * @param input - the projection input.
 * @returns the frozen items, Control first then each adapter in order.
 */
export async function projectInterventions(
  input: ProjectInterventionsInput,
): Promise<readonly InterventionItem[]> {
  const summaries = await input.control.listOpenApprovalCases({
    rootSessionId: input.rootSessionId,
    ...(input.subject !== undefined ? { subject: input.subject } : {}),
  })
  const caseStates: ApprovalCaseState[] = summaries.map((summary) => summary.state)
  // The TELLING half of A1-12 (spec §11.6: terminate as authority-unavailable
  // AND "surface typed Admin-required result and InterventionItem"; plan
  // §6.D:651: "Once a leg escalates, the old leg is visibly terminal"). A
  // DECIDED case whose terminal decision row carries the A2-8 stamp
  // `terminalReason: resolver-unavailable` — the escalate with no next rung
  // (PR #118's durable close) or the zero-review case born DECIDED (audit
  // F2) — is a terminal intervention, and it is surfaced as one. EVERY other
  // decided close (an ordinary allow/deny, a drift close) stays out of the
  // list, byte-identical to the pre-existing projection. The generic decided
  // READ lives in Control (`listDecidedApprovalCases`, a fold mirror with no
  // surfacing opinion); the narrow filter that names what becomes visible
  // lives HERE, in the intervention lane. Absence of the optional read is
  // fail-safe: the projection stays open-only, exactly as before.
  if (typeof input.control.listDecidedApprovalCases === 'function') {
    const decided = await input.control.listDecidedApprovalCases({
      rootSessionId: input.rootSessionId,
      ...(input.subject !== undefined ? { subject: input.subject } : {}),
    })
    for (const summary of decided) {
      const state = summary.state
      if (
        state.terminalDecision?.terminalReason
        !== CONTROL_LEG_TERMINAL_REASONS.RESOLVER_UNAVAILABLE
      ) {
        continue
      }
      if (caseStates.some(
        (open) => open.identity.approvalCaseId === state.identity.approvalCaseId,
      )) {
        continue
      }
      caseStates.push(state)
    }
  }
  const safeReader: RequiredAuthorityReader | undefined =
    input.reader === undefined
      ? undefined
      : (readerInput: RequiredAuthorityReaderInput) => {
          try {
            return input.reader?.(readerInput) as ReturnType<RequiredAuthorityReader>
          } catch {
            // An unreadable ceiling is NOT a permission grant, and it is not a
            // fact either (audit F6). The wrapper used to SYNTHESIZE a fact bag
            // here - `requiredAuthority` taken from the leg's own rung, which
            // nobody read - and the item then published an authority-looking
            // field plus a real-looking `deny`. Absence is the honest answer:
            // no `requiredAuthority` is published and no action is offered, and
            // `ceiling-undetermined` says why (spec 18.3, A5-2).
            return undefined
          }
        }
  const control = (await deriveInterventionItems(caseStates, safeReader)).map(freezeItem)
  const rest: InterventionItem[] = []
  for (const adapter of input.adapters ?? []) {
    const items = await adapter.project({
      rootSessionId: input.rootSessionId,
      ...(input.subject !== undefined ? { subject: input.subject } : {}),
    })
    for (const item of items) rest.push(freezeItem(item))
  }
  return [...control, ...rest]
}

/**
 * Project a terminal, zero-REVIEW case (ADR A1-12) as one frozen informational
 * item. Kept separate from {@link projectInterventions} because such a case is
 * born DECIDED and therefore never appears in the open-case read (audit F2
 * gives it a leg row so the termination is durable; a decided row is not an
 * open one) — this is the seam PR4/PR5 call when a request terminates
 * synchronously and they hold the identity facts rather than a case read.
 *
 * @param input - the frozen identity facts of the terminated case.
 * @returns the frozen informational item.
 */
export function projectZeroLegTermination(input: {
  readonly approvalCaseId: string
  readonly requiredAuthority: Parameters<
    typeof deriveZeroLegAuthorityUnavailableItem
  >[0]['requiredAuthority']
  readonly fingerprint?: string
  readonly observedAt: string
}): InterventionItem {
  return freezeItem(deriveZeroLegAuthorityUnavailableItem(input))
}

// ---------------------------------------------------------------------------
// A4-PR6 — the GovernanceWarning source adapter (spec §15/§16; plan §6.0/§6.B)
// ---------------------------------------------------------------------------

/**
 * The STRUCTURAL view of one durable warning the adapter projects (A4-PR6).
 *
 * Declared structurally — NOT imported from `governance-warning/**` — so the
 * intervention lane's import law survives its first production consumer: the
 * lane still imports no authority/writer module, and the caller (the plugin
 * assembly) adapts its snapshot type to this shape. Every field here is a
 * DIAGNOSTIC rendering input; none of it is authority (spec §14.2), and the
 * projection is still read-only in every direction.
 */
export interface InterventionWarningSourceView {
  readonly interventionId: string
  readonly warningId: string
  readonly kind: 'envelope-consistency'
  readonly fingerprint: string
  readonly verdict: 'mismatch' | 'undetermined'
  readonly observationCount: number
  readonly firstObservedAt: string
  readonly lastObservedAt: string
  readonly acknowledged: boolean
  readonly acknowledgedAt?: string
  readonly acknowledgedBy?: string
}

/** The injected warning reader (the durable fold, supplied by the caller). */
export interface InterventionWarningSourceReader {
  list(rootSessionId: string): Promise<readonly InterventionWarningSourceView[]>
}

/**
 * The PR6 fill of the PR3 adapter seam: map durable warnings to frozen
 * `warning`-kind items.
 *
 * The law the items carry (each pinned by `a4p6-intervention-aggregation.test.ts`):
 * - `responseBehavior` is ALWAYS `informational`: a warning never puts the
 *   Team in the state where a reviewer is expected to act (spec §15.0 — a
 *   non-blocking stage must never look like `wait-for-response`);
 * - `blockScope` is `null`: the warning never blocks work at runtime; only
 *   the START GATE (6.A, in the plugin layer) consults the verdict, and it
 *   blocks START, not work;
 * - `legalActions` is the WARNING plane only: `['acknowledge']` while the
 *   fingerprint is unacknowledged, `[]` after;
 * - `requiredAuthority` / `currentReviewAuthority` are NEVER published: an
 *   acknowledged warning is not a review, and rendering an authority field
 *   here would manufacture the authority-looking field spec §14.2 forbids;
 * - `observationCount`/timestamps fold the §15.4 dedup — repeat observations
 *   of the same fingerprint update them, they never mint a second item.
 */
export function createGovernanceWarningSourceAdapter(
  deps: InterventionWarningSourceReader,
): InterventionSourceAdapter {
  return {
    source: 'governance-warning',
    async project({ rootSessionId }) {
      const warnings = await deps.list(rootSessionId)
      return warnings.map((warning): InterventionItem => {
        const item: InterventionItem = {
          interventionId: warning.interventionId,
          kind: 'warning',
          responseBehavior: 'informational',
          blockScope: null,
          source: { kind: 'governance-warning', id: warning.warningId },
          status: warning.acknowledged ? 'acknowledged' : 'open',
          legalActions: warning.acknowledged ? [] : ['acknowledge'],
          derivationReasons: warning.acknowledged
            ? ['warning-acknowledged']
            : ['warning-observed'],
          fingerprint: warning.fingerprint,
          createdAt: warning.firstObservedAt,
          updatedAt: warning.acknowledged ? warning.acknowledgedAt : warning.lastObservedAt,
          lastObservedAt: warning.lastObservedAt,
          observationCount: warning.observationCount,
        }
        return item
      })
    },
  }
}
