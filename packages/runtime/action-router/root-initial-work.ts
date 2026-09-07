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
 *   Phase A, under ONE withTeamLock acquisition (the shared
 *   coordination.chains):
 *     enforceCompatibilityGate (the existing single compatibility
 *     authority — the gate runs BEFORE any scan decision, exactly like
 *     the router's new-work admission) ->
 *     admitRootInitialWorkLocked (the two-fact scanner + strategy: the
 *     replay decision | the typed rejection | the durable admission
 *     fact);
 *   -> the chain is RELEASED
 *   -> Phase B (WITHOUT the chain): the `deliverRootWork` port call —
 *      the ROOT TURN itself (the leader's own team tools can re-enter
 *      the router's facade on the SAME chain during it — the N1
 *      deadlock the split removes);
 *   -> Phase C, RE-ACQUIRING the same chain (no abort signal — this
 *      seam accepts none): the terminal fact (fresh-read convergence —
 *      a concurrent same-token delivery's terminal is never duplicated).
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
 * LOCK TOPOLOGY (INV-9.1, repair-r1 F3-B: the three-phase lock split —
 * the N1 sibling of F3-A's member work-chain split; the shared per-team
 * chain is NEVER held across the ROOT turn):
 *
 *   Phase A `admitRootInitialWorkLocked` — validation, scan, decision
 *     (replay | typed rejection | fresh admission fact | admitted-only
 *     retry decision). Takes NO lock of its own: the production closure
 *     runs it inside ONE acquisition that also carries the
 *     compatibility gate (the CR-8 analog — the gate may re-probe inline,
 *     a durable compatibility write, and a racing new-work admission for
 *     the same team must not interleave into its read→probe→re-read→admit
 *     window). A replay or a typed rejection completes INSIDE that
 *     acquisition (zero further writes).
 *   Phase B `deliverRootWork` — the port call ONLY. Runs WITHOUT the
 *     shared chain (the chain is released before the ROOT TURN starts),
 *     with NO abort signal (this seam accepts no request signal at all —
 *     the S6 command surface is transport-cancellation-free). This is
 *     what frees the team while the leader's turn runs: the leader's own
 *     team tools (`team_delegate` / `team_follow_up` /
 *     `team_report_progress` — the N1 hang) re-enter the router's facade
 *     and acquire the SAME chain; they must not queue behind the
 *     delivery that started them (the deadlock this split removes).
 *   Phase C `settleRootInitialWorkLocked` — the terminal fact.
 *     RE-ACQUIRES the same chain WITHOUT any abort signal (N6: the
 *     terminal settlement is a durable obligation and is never gated by a
 *     request signal — on this seam there is none to gate it). It
 *     FRESH-READS the durable state first: a concurrent same-token
 *     delivery that already committed the terminal is never duplicated
 *     (zero writes; the existing terminal sequence is reported).
 *
 * THROW-AFTER-SETTLE (N3, preserved): on a delivery fault Phase C does
 * not write (this strategy's fail-closed writes NOTHING — a delivery
 * failure leaves the terminal absent by design) and the typed
 * `WORK_DELIVERY_FAILED` rejection propagates: the leader's rejection
 * always lands on the durable state the same-token retry recovers from
 * (the admission fact retained, the terminal absent), and a half-
 * committed terminal never exists.
 *
 * OVERLAP SEMANTICS (H3-root, documented — the root analog of F3-A's
 * H3, per the round's U6 sub-decision (i) "accept + document"): because
 * Phase B holds no chain, a CONCURRENT same-token admit can pass its
 * Phase A as an ADMITTED-ONLY RETRY while the first call's delivery is
 * still in flight (the pre-fix lock coupling made it a zero-delivery
 * replay — that serialization was the coupling this split removes). Both
 * model-visible deliveries then run at-least-once: plan §15.7 is
 * explicit that the ambiguous window (admission durable, terminal not
 * yet) is NOT claimed exactly-once, and the model-visible text carries
 * the requestToken so the model dedupes. The durable state converges via
 * the Phase C fresh-read — exactly ONE admission fact and exactly ONE
 * terminal fact for the token, no fake state (this strategy owns none),
 * no new error code. The overlap is a documented, convergent interleave,
 * not a race the chain must hide. (A concurrent DIFFERENT-token call
 * still gets the typed INITIAL_WORK_ALREADY_ADMITTED from its Phase A
 * scan — the one-slot rule is untouched.)
 *
 * `executeRootInitialWorkLocked` is the three-phase orchestrator (the
 * direct test seam): with `teamLocks` installed it performs the Phase A
 * acquisition itself and Phase C re-acquires it; without (the pre-F3-B
 * tcm-m3 shape) the phases run without the shared chain — the test
 * world is single-threaded per world. Both paths share the SAME phase
 * bodies — one scan, one admission algorithm, one delivery call, one
 * settlement owner.
 *
 * I/O only through the injected TeamDomain repositories (invariant 41)
 * and the injected delivery port; no member lifecycle, no activity, no
 * node: builtins, no upstream imports.
 *
 * @module @dsh-agent-team/runtime/action-router/root-initial-work
 */

import { canonicalJsonStringify } from '../../contracts/src/index.js'
import type { TeamBlueprint } from '../../domain/blueprint/src/index.js'
import { sha256Hex } from '../../domain/blueprint/src/index.js'
import type { EnvironmentFact } from '../../domain/compatibility/src/index.js'
import type { TeamDomainRepositories } from '../../storage/repositories/index.js'
import type { LedgerEntry } from '../../storage/schema/index.js'
import { TEAM_RUNTIME_ERROR_CODES, TeamRuntimeError } from '../admission/errors.js'
import { enforceCompatibilityGate } from '../admission/gate.js'
import type { ResolvedCaller } from '../admission/resolve.js'
import type { TeamOperationChainMap } from '../coordination/index.js'
import { commitDurableFact, withTeamLock } from './effects.js'

/** The payload discriminator of a Root initial-work fact (the scanner's filter). */
export const ROOT_TARGET_KIND = 'root'

/** The EXISTING admission fact type (the Root entries carry `targetKind: 'root'`). */
export const FACT_WORK_ADMITTED = 'team-work-admitted'

/** The ONE new fact type: the terminal SUCCESS record of one Root initial work. */
export const FACT_ROOT_WORK_DELIVERED = 'team-root-work-delivered'

/** One durable fact reference (the sequence + the payload record). */
export interface RootWorkFactRef {
  readonly sequence: number
  readonly payload: Record<string, unknown>
}

/** The outcome of the Root initial-work scan (plan §15.6 decision table). */
export interface RootInitialWorkScan {
  /** The minimum-sequence `team-work-admitted` Root fact for the REQUESTED token (absent = none). */
  readonly admitted?: RootWorkFactRef
  /** The minimum-sequence terminal `team-root-work-delivered` Root fact for the REQUESTED token (absent = none). */
  readonly terminal?: RootWorkFactRef
  /** Every Root initial-work fact (admitted OR delivered) for a token DIFFERENT from the requested one — any entry means the team's one initial-work slot is occupied. */
  readonly foreign: readonly RootWorkFactRef[]
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
    readonly rootSessionId: string
    readonly requestToken: string
    readonly prompt: string
    readonly attachedContext?: string
  }): Promise<void>
}

/**
 * Everything one execution of the Root initial-work strategy needs.
 *
 * Lock scope (INV-9.1): the phase BODIES (`admitRootInitialWorkLocked`,
 * the `deliverRootWork` port call, `settleRootInitialWorkLocked`) take no
 * lock of their own — the caller owns the acquisition boundary. With
 * `teamLocks` installed, `executeRootInitialWorkLocked` performs the Phase
 * A acquisition and Phase C re-acquires it; the production closure holds
 * the gate + Phase A in ONE acquisition and completes Phase B/C after the
 * lock is released. `teamLocks` is absent ONLY in the direct test seam
 * (the tcm-m3 shape): the phases then run without the shared chain (the
 * test world is single-threaded per world).
 */
export interface RootInitialWorkDeps {
  /** The durable authority (ledger list + append). */
  readonly repositories: TeamDomainRepositories
  /** The deterministic clock (ISO-8601). */
  readonly now: () => string
  /** The team (root) session id. */
  readonly rootSessionId: string
  /** The resolved calling authority (evidence only — no member resolution). */
  readonly caller: ResolvedCaller
  /** The stable operation identity (the client-issued request token). */
  readonly requestToken: string
  /** The model-visible prompt (non-empty). */
  readonly prompt: string
  /** The optional attached-context block (absent/empty = no block). */
  readonly attachedContext?: string
  /** The live Root input delivery port. */
  readonly deliverRootWork: RootWorkDeliveryPort
  /** The shared per-team operation chain (the production `coordination.
   *  chains` — the same map the production root wires into the router
   *  facade, the activity ledger's guarded commit, the lifecycle service
   *  and this module's closure; INV-9.1). Present: `executeRootInitial-
   *  WorkLocked` acquires it for Phase A and Phase C re-acquires it
   *  (WITHOUT any abort signal — this seam accepts none); Phase B never
   *  holds it. Absent: the direct test seam runs the phases without the
   *  shared chain. */
  readonly teamLocks?: TeamOperationChainMap
}

/** The outcome of one Root initial-work execution. */
export interface RootInitialWorkResult {
  /** `fresh` = the full chain ran; `retry` = the admission existed (crash
   *  recovery), delivery was re-driven; `replay` = a terminal success
   *  already existed, ZERO delivery and ZERO writes. */
  readonly mode: 'fresh' | 'retry' | 'replay'
  readonly rootSessionId: string
  readonly requestToken: string
  readonly payloadFingerprint: string
  /** The durable sequence of the (original) `team-work-admitted` fact. On a `replay` where the admission fact is somehow absent (unreachable — the terminal is only ever committed after the admission), the terminal sequence stands in. */
  readonly sequence: number
  /** The durable sequence of the terminal `team-root-work-delivered` fact (committed by this call, or the pre-existing one on a `replay` / a concurrent same-token settlement — the Phase C fresh-read convergence). */
  readonly terminalSequence: number
  /** Whether this call performed a model-visible delivery (false on `replay`). */
  readonly delivered: boolean
}

/** The one-line caller ref (the evidence shape of the work chain; the
 *  key is OMITTED for the honest Leader — no member row — because the
 *  ledger entries are validated as lossless JSON, where `undefined`
 *  leaves are not remote-safe). */
function callerRef(caller: ResolvedCaller): Record<string, unknown> {
  if (caller.role === 'human') {
    return { kind: 'human', humanId: caller.humanId }
  }
  const instanceId = caller.callerMember?.instanceId
  return {
    kind: 'instance',
    ...(instanceId !== undefined ? { instanceId } : {}),
    role: caller.role,
  }
}

/** A fault description for `details.cause` (no invented structure). */
function describeFailure(failure: unknown): string {
  if (failure instanceof Error) return failure.message
  return typeof failure === 'string' && failure.length > 0 ? failure : 'unknown failure'
}

/**
 * The durable payload fingerprint of one Root initial work: the SHA-256 of
 * the canonical JSON of the model-visible content (`prompt` plus the
 * `attachedContext` when present and non-empty — the exact content the
 * delivery port turns into text). An empty `attachedContext` is equivalent
 * to an absent one (the delivery port applies the same rule).
 */
export function computeRootWorkPayloadFingerprint(
  prompt: string,
  attachedContext?: string,
): string {
  const record: Record<string, unknown> = { prompt }
  if (attachedContext !== undefined && attachedContext !== '') {
    record['attachedContext'] = attachedContext
  }
  return `sha256:${sha256Hex(canonicalJsonStringify(record))}`
}

/** True for one Root initial-work fact (the two fact types + the discriminator). */
function isRootWorkFact(entry: LedgerEntry): boolean {
  if (entry.factType !== FACT_WORK_ADMITTED && entry.factType !== FACT_ROOT_WORK_DELIVERED) {
    return false
  }
  return entry.payload['targetKind'] === ROOT_TARGET_KIND
}

/** The payload's `requestToken` as a string (undefined when malformed). */
function factToken(payload: Record<string, unknown>): string | undefined {
  const value = payload['requestToken']
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/**
 * Scan the team's durable ledger for the Root initial-work state of one
 * requested token (plan §15.6 decision table). Reads ONLY
 * `targetKind === 'root'` facts of the two Root fact types for this team —
 * member work facts (no `targetKind`) and other teams' facts are ignored,
 * and the ordinary member scanner (`scanWorkUnitFacts`) mirrors this
 * filter by skipping every `targetKind === 'root'` fact (no token
 * collision between the two worlds).
 */
export function scanRootInitialWorkFacts(
  repositories: TeamDomainRepositories,
  rootSessionId: string,
  requestToken: string,
): RootInitialWorkScan {
  let admitted: RootWorkFactRef | undefined
  let terminal: RootWorkFactRef | undefined
  const foreign: RootWorkFactRef[] = []
  for (const entry of repositories.ledger.list()) {
    if (entry.rootSessionId !== rootSessionId) continue
    if (!isRootWorkFact(entry)) continue
    const token = factToken(entry.payload)
    if (token === undefined) continue // a malformed root fact: never a decision input
    if (token !== requestToken) {
      foreign.push({ sequence: entry.sequence, payload: entry.payload })
      continue
    }
    const ref: RootWorkFactRef = { sequence: entry.sequence, payload: entry.payload }
    if (entry.factType === FACT_ROOT_WORK_DELIVERED) {
      if (terminal === undefined || entry.sequence < terminal.sequence) terminal = ref
    } else {
      if (admitted === undefined || entry.sequence < admitted.sequence) admitted = ref
    }
  }
  return {
    ...(admitted !== undefined ? { admitted } : {}),
    ...(terminal !== undefined ? { terminal } : {}),
    foreign,
  }
}

/** Validate the request shape (closed codes; zero writes). */
function validateDeps(deps: RootInitialWorkDeps): void {
  if (typeof deps.requestToken !== 'string' || deps.requestToken.length === 0) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODES.REQUEST_MALFORMED,
      'TeamRuntime: root initial work requires a non-empty requestToken',
      { rootSessionId: deps.rootSessionId },
    )
  }
  if (typeof deps.prompt !== 'string' || deps.prompt.length === 0) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODES.REQUEST_MALFORMED,
      'TeamRuntime: root initial work requires a non-empty prompt',
      { rootSessionId: deps.rootSessionId, requestToken: deps.requestToken },
    )
  }
}

/**
 * The same-token/different-payload rejection (plan §15.6: "same token +
 * different payload → typed mismatch"). Zero durable writes.
 */
function mismatchError(
  deps: RootInitialWorkDeps,
  storedFingerprint: unknown,
  requestedFingerprint: string,
  storedSequence: number,
): TeamRuntimeError {
  return new TeamRuntimeError(
    TEAM_RUNTIME_ERROR_CODES.ROOT_WORK_PAYLOAD_MISMATCH,
    `TeamRuntime: requestToken '${deps.requestToken}' already carries a Root initial work with a different payload fingerprint (stored sequence ${storedSequence}) — the same token must mean the same work; refusing to change the admitted work`,
    {
      rootSessionId: deps.rootSessionId,
      requestToken: deps.requestToken,
      storedFingerprint:
        typeof storedFingerprint === 'string' ? storedFingerprint : undefined,
      requestedFingerprint,
      storedSequence,
    },
  )
}

/**
 * The at-most-one-slot rejection (plan §15.6: "another token's initial
 * work exists → typed INITIAL_WORK_ALREADY_ADMITTED"). Zero durable
 * writes.
 */
function alreadyAdmittedError(deps: RootInitialWorkDeps, occupant: RootWorkFactRef): TeamRuntimeError {
  const occupantToken = factToken(occupant.payload) ?? '(malformed)'
  return new TeamRuntimeError(
    TEAM_RUNTIME_ERROR_CODES.INITIAL_WORK_ALREADY_ADMITTED,
    `TeamRuntime: team '${deps.rootSessionId}' already carries a creation-time Root initial work under a different requestToken ('${occupantToken}', durable sequence ${occupant.sequence}) — at most one initial work per creation; a fresh operation must use its own token only before any admission, a retry must reuse the admitted token`,
    {
      rootSessionId: deps.rootSessionId,
      requestToken: deps.requestToken,
      existingToken: occupantToken,
      existingSequence: occupant.sequence,
    },
  )
}

/**
 * Phase B (delivery) of the Root initial-work chain (INV-9.1): the
 * `deliverRootWork` port call ONLY — the token-leading model-visible text
 * goes to the Root (leader) session and the ROOT TURN runs. Runs WITHOUT
 * the shared per-team chain (the leader's own team tools can re-enter the
 * router's facade on the same chain during this window — the N1 hang the
 * split removes) and with NO abort signal (this seam accepts none). Takes
 * no lock of its own.
 *
 * A fault propagates as WORK_DELIVERY_FAILED (the closed delivery code,
 * reused from the member work chain): the durable admission stays, NO
 * terminal fact is written, and the same-token retry recovers from the
 * admission fact (plan §15.7).
 *
 * @throws WORK_DELIVERY_FAILED on any delivery fault.
 */
async function deliverRootInitialWork(deps: RootInitialWorkDeps): Promise<void> {
  try {
    await deps.deliverRootWork.deliverRootWork({
      rootSessionId: deps.rootSessionId,
      requestToken: deps.requestToken,
      prompt: deps.prompt,
      ...(deps.attachedContext !== undefined ? { attachedContext: deps.attachedContext } : {}),
    })
  } catch (error) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODES.WORK_DELIVERY_FAILED,
      `TeamRuntime: Root initial work delivery to team '${deps.rootSessionId}' failed: ${describeFailure(error)} (the durable admission is retained; retry with the SAME requestToken)`,
      {
        rootSessionId: deps.rootSessionId,
        requestToken: deps.requestToken,
        cause: describeFailure(error),
      },
    )
  }
}

/** The admission fact payload (plan §15.7; lossless JSON, no undefined leaves). */
function admissionFactPayload(deps: RootInitialWorkDeps, fingerprint: string): Record<string, unknown> {
  return {
    targetKind: ROOT_TARGET_KIND,
    rootSessionId: deps.rootSessionId,
    requestToken: deps.requestToken,
    payloadFingerprint: fingerprint,
    prompt: deps.prompt,
    ...(deps.attachedContext !== undefined && deps.attachedContext !== ''
      ? { attachedContext: deps.attachedContext }
      : {}),
    caller: callerRef(deps.caller),
    at: deps.now(),
  }
}

/** The terminal fact payload (plan §15.7; the terminal SUCCESS record). */
function terminalFactPayload(deps: RootInitialWorkDeps, fingerprint: string): Record<string, unknown> {
  return {
    targetKind: ROOT_TARGET_KIND,
    rootSessionId: deps.rootSessionId,
    requestToken: deps.requestToken,
    payloadFingerprint: fingerprint,
    workOutcome: 'delivered',
    at: deps.now(),
  }
}

/**
 * The Phase A outcome (INV-9.1): `replay` — the chain is DONE with the
 * result (zero delivery, zero writes; no Phase B/C); `owed` — the unit is
 * durably admitted (fresh: the fact committed by this Phase A; retry: the
 * pre-existing fact) and owes Phase B (delivery) + Phase C (the terminal
 * fact).
 */
export type RootInitialWorkPhaseA =
  | { readonly kind: 'replay'; readonly result: RootInitialWorkResult }
  | {
      readonly kind: 'owed'
      readonly mode: 'fresh' | 'retry'
      readonly sequence: number
      readonly fingerprint: string
    }

/**
 * Phase A (admission) of the Root initial-work chain (INV-9.1): the
 * validation, the scan, the plan §15.6 decision table, and — on the FRESH
 * branch — the durable admission fact. The complete pre-delivery durable
 * half. Takes NO lock of its own: the caller owns the acquisition
 * boundary (the production closure's gate acquisition; the orchestrator's
 * own Phase A acquisition with `teamLocks` installed).
 *
 * @param deps - the strategy dependencies (ports, identity, content).
 * @returns `replay` — the chain is DONE (zero delivery, zero writes; no
 *   Phase B/C) — or `owed` — the unit is durably admitted and owes
 *   Phase B (delivery) + Phase C (the terminal fact).
 * @throws REQUEST_MALFORMED (input shape); ROOT_WORK_PAYLOAD_MISMATCH
 *   (same token, different payload); INITIAL_WORK_ALREADY_ADMITTED
 *   (another token's slot); DURABLE_WRITE_FAILED on a durable protocol
 *   fault.
 */
export async function admitRootInitialWorkLocked(
  deps: RootInitialWorkDeps,
): Promise<RootInitialWorkPhaseA> {
  validateDeps(deps)
  const fingerprint = computeRootWorkPayloadFingerprint(deps.prompt, deps.attachedContext)
  const scan = scanRootInitialWorkFacts(deps.repositories, deps.rootSessionId, deps.requestToken)

  // 1. TERMINAL SUCCESS for the same token (plan §15.6): replay — zero
  //    delivery, zero writes. A different fingerprint is the typed
  //    mismatch (the same token must mean the same work).
  if (scan.terminal !== undefined) {
    const terminalFingerprint = scan.terminal.payload['payloadFingerprint']
    if (terminalFingerprint !== fingerprint) {
      throw mismatchError(
        deps,
        terminalFingerprint,
        fingerprint,
        scan.terminal.sequence,
      )
    }
    // A terminal success is only replayable when the durable admission (if
    // present) names the same payload. Contradictory facts are ledger
    // corruption, not a basis for choosing the terminal half and claiming
    // success; fail closed for either possible request fingerprint.
    if (
      scan.admitted !== undefined &&
      scan.admitted.payload['payloadFingerprint'] !== fingerprint
    ) {
      throw mismatchError(
        deps,
        scan.admitted.payload['payloadFingerprint'],
        fingerprint,
        scan.admitted.sequence,
      )
    }
    return {
      kind: 'replay',
      result: {
        mode: 'replay',
        rootSessionId: deps.rootSessionId,
        requestToken: deps.requestToken,
        payloadFingerprint: fingerprint,
        // The original admission sequence (absent is structurally
        // unreachable — the terminal is only ever committed after the
        // admission; the terminal sequence stands in as the honest
        // fallback rather than a fabricated number).
        sequence: scan.admitted?.sequence ?? scan.terminal.sequence,
        terminalSequence: scan.terminal.sequence,
        delivered: false,
      },
    }
  }

  // 2. The team's ONE initial-work slot is occupied by ANOTHER token
  //    (an admitted or a durably delivered root fact): typed rejection,
  //    zero writes. A fresh token is a new operation, never a replay.
  if (scan.foreign.length > 0) {
    // The earliest occupant (durable order: the first fact that took the slot).
    let occupant = scan.foreign[0]!
    for (const fact of scan.foreign) {
      if (fact.sequence < occupant.sequence) occupant = fact
    }
    throw alreadyAdmittedError(deps, occupant)
  }

  // 3. ADMITTED (same token, no terminal): the crash window between the
  //    admission commit and the terminal commit — ADMITTED-ONLY RETRY:
  //    delivery is re-driven (Phase B), NO second admission fact.
  if (scan.admitted !== undefined) {
    if (scan.admitted.payload['payloadFingerprint'] !== fingerprint) {
      throw mismatchError(
        deps,
        scan.admitted.payload['payloadFingerprint'],
        fingerprint,
        scan.admitted.sequence,
      )
    }
    return {
      kind: 'owed',
      mode: 'retry',
      sequence: scan.admitted.sequence,
      fingerprint,
    }
  }

  // 4. FRESH: no root facts for the token — the admission fact FIRST
  //    (the operation identity + intent); Phase B/C owe the delivery and
  //    the terminal fact.
  const sequence = await commitDurableFact(
    deps.repositories,
    deps.rootSessionId,
    deps.now,
    FACT_WORK_ADMITTED,
    admissionFactPayload(deps, fingerprint),
  )
  return {
    kind: 'owed',
    mode: 'fresh',
    sequence,
    fingerprint,
  }
}

/**
 * Phase C (settlement) of the Root initial-work chain (INV-9.1): the
 * terminal `team-root-work-delivered` fact for a SUCCESSFUL delivery.
 * Takes no lock of its own: the caller owns the Phase C acquisition
 * (WITHOUT any abort signal — N6; this seam accepts no request signal at
 * all).
 *
 * Fresh-read convergence (the H3-root overlap, documented): a concurrent
 * same-token delivery may have committed the terminal first — the durable
 * pair stays UNIQUE (zero writes here; the existing terminal sequence is
 * reported). A contradictory-fingerprint terminal is ledger corruption:
 * fail closed (the typed mismatch), zero writes.
 *
 * @throws ROOT_WORK_PAYLOAD_MISMATCH (corrupt contradictory terminal).
 */
async function settleRootInitialWorkLocked(
  deps: RootInitialWorkDeps,
  admitted: Extract<RootInitialWorkPhaseA, { readonly kind: 'owed' }>,
): Promise<RootInitialWorkResult> {
  const rescan = scanRootInitialWorkFacts(
    deps.repositories,
    deps.rootSessionId,
    deps.requestToken,
  )
  if (rescan.terminal !== undefined) {
    const terminalFingerprint = rescan.terminal.payload['payloadFingerprint']
    if (terminalFingerprint !== admitted.fingerprint) {
      throw mismatchError(
        deps,
        terminalFingerprint,
        admitted.fingerprint,
        rescan.terminal.sequence,
      )
    }
    return {
      mode: admitted.mode,
      rootSessionId: deps.rootSessionId,
      requestToken: deps.requestToken,
      payloadFingerprint: admitted.fingerprint,
      sequence: admitted.sequence,
      terminalSequence: rescan.terminal.sequence,
      delivered: true,
    }
  }
  const terminalSequence = await commitDurableFact(
    deps.repositories,
    deps.rootSessionId,
    deps.now,
    FACT_ROOT_WORK_DELIVERED,
    terminalFactPayload(deps, admitted.fingerprint),
  )
  return {
    mode: admitted.mode,
    rootSessionId: deps.rootSessionId,
    requestToken: deps.requestToken,
    payloadFingerprint: admitted.fingerprint,
    sequence: admitted.sequence,
    terminalSequence,
    delivered: true,
  }
}

/**
 * The Phase C acquisition (INV-9.1 / N6): re-acquire the shared chain for
 * the terminal settlement WITHOUT any abort signal — this seam accepts no
 * request signal at all (the S6 command surface is transport-
 * cancellation-free), so the terminal settlement is a durable obligation
 * that runs unconditionally once the delivery resolves. With no chain
 * installed (the direct test seam) the work runs as-is.
 */
async function acquirePhaseC(
  deps: RootInitialWorkDeps,
  work: () => Promise<unknown>,
): Promise<unknown> {
  if (deps.teamLocks === undefined) return work()
  return withTeamLock(deps.teamLocks, deps.rootSessionId, work)
}

/**
 * Phase B + Phase C of an ALREADY-ADMITTED Root initial work (INV-9.1):
 * the delivery WITHOUT the shared chain (the ROOT TURN — the leader's own
 * team tools re-enter the router's facade on the same chain during it:
 * the N1 hang the split removes), then the terminal fact re-acquired on
 * the SAME chain WITHOUT any abort signal (N6). Shared by the
 * `executeRootInitialWorkLocked` orchestrator (direct seam) and the
 * production closure (where Phase A ran inside the gate acquisition and
 * the lock is released before this is called).
 *
 * On a delivery fault NO terminal fact is written (this strategy's
 * fail-closed writes nothing — plan §15.7) and the typed
 * `WORK_DELIVERY_FAILED` rejection propagates: the leader's rejection
 * always lands on the durable state the same-token retry recovers from
 * (the admission retained, the terminal absent) — throw-after-settle
 * (N3), never a half-committed terminal.
 *
 * @throws WORK_DELIVERY_FAILED (the durable state is consistent — N3) on
 *   any delivery fault; ROOT_WORK_PAYLOAD_MISMATCH (corrupt terminal)
 *   from the Phase C convergence; DURABLE_WRITE_FAILED on durable
 *   protocol faults.
 */
export async function completeRootInitialWorkAfterAdmission(
  deps: RootInitialWorkDeps,
  admitted: Extract<RootInitialWorkPhaseA, { readonly kind: 'owed' }>,
): Promise<RootInitialWorkResult> {
  // Phase B — no shared chain (INV-9.1), no abort signal (this seam
  // accepts none): the ROOT TURN.
  await deliverRootInitialWork(deps)
  // Phase C — re-acquired (N6: never gated by a request signal).
  return (await acquirePhaseC(
    deps,
    () => settleRootInitialWorkLocked(deps, admitted),
  )) as RootInitialWorkResult
}

/**
 * Execute the Root initial-work strategy for one team — the THREE-PHASE
 * ORCHESTRATOR (INV-9.1, module docs): Phase A (gate-free — the
 * compatibility gate is the closure's, inside its ONE acquisition) under
 * the chain when `teamLocks` is installed → Phase B without the chain →
 * Phase C re-acquired (without any abort signal). With `teamLocks`
 * absent (the direct test seam — the tcm-m3 shape) the phases run
 * without the shared chain (the test world is single-threaded per world;
 * the pre-F3-B behavior of this seam is preserved exactly).
 *
 * @param deps - the strategy dependencies (ports, identity, content, the
 *        optional shared chain).
 * @returns the strategy outcome (see {@link RootInitialWorkResult}).
 * @throws {@link TeamRuntimeError} REQUEST_MALFORMED (input shape),
 *   ROOT_WORK_PAYLOAD_MISMATCH (same token, different payload),
 *   INITIAL_WORK_ALREADY_ADMITTED (another token's slot),
 *   WORK_DELIVERY_FAILED (the delivery fault, admission retained).
 */
export async function executeRootInitialWorkLocked(
  deps: RootInitialWorkDeps,
): Promise<RootInitialWorkResult> {
  const admitted =
    deps.teamLocks === undefined
      ? await admitRootInitialWorkLocked(deps)
      : await withTeamLock(deps.teamLocks, deps.rootSessionId, () => admitRootInitialWorkLocked(deps))
  if (admitted.kind === 'replay') return admitted.result
  return completeRootInitialWorkAfterAdmission(deps, admitted)
}

/** The closure's per-call arguments (the v1/v2 shared entry point). */
export interface RootInitialWorkArgs {
  /** The TARGET team's root session id (may differ from the row's boot root — the glue delivers into any team root of the row's domain). */
  readonly rootSessionId: string
  /** The resolved calling authority (the S6 principal derivation). */
  readonly caller: ResolvedCaller
  /** The stable operation identity (the client-issued request token). */
  readonly requestToken: string
  /** The model-visible prompt (non-empty). */
  readonly prompt: string
  /** The optional attached-context block. */
  readonly attachedContext?: string
  /** The TARGET team's bound blueprint (the compatibility gate's input; the S6 handler resolves it from the target's durable TeamSession row — the gate is the existing single compatibility authority, plan §15.8). */
  readonly blueprint: TeamBlueprint
}

/** The closure inputs the production root wires (plan §15.8). */
export interface RootInitialWorkClosureInput {
  /** The SHARED per-team operation chain (the production `coordination.chains` — the Phase A (gate + admission) acquisition and the Phase C re-acquisition run on it; Phase B, the ROOT TURN, never holds it — INV-9.1 / N1). */
  readonly teamLocks: TeamOperationChainMap
  /** The durable authority (the opened TeamDomain repositories). */
  readonly repositories: TeamDomainRepositories
  /** The environment-facts port (the compatibility gate's fresh-facts read). */
  readonly environmentFacts: () => Promise<readonly EnvironmentFact[]>
  /** The deterministic clock (ISO-8601). */
  readonly now: () => string
  /** The live Root input delivery port (the glue's `deliverRootWork`). */
  readonly deliverRootWork: RootWorkDeliveryPort
}

/** One admitted Root initial-work command (the plan §15.8 closure). */
export type AdmitRootInitialWork = (args: RootInitialWorkArgs) => Promise<RootInitialWorkResult>

/**
 * Build the production `admitRootInitialWork` closure (plan §15.8) — the
 * THREE-PHASE lock scope (INV-9.1, repair-r1 F3-B):
 *
 *   Phase A, in ONE withTeamLock acquisition of the shared
 *   coordination.chains:
 *     enforceCompatibilityGate (the existing single compatibility
 *     authority, INSIDE the lock: the gate may re-probe inline and a
 *     racing new-work admission for the same team must not interleave —
 *     the CR-8 analog, gate + Phase A in ONE acquisition) ->
 *     admitRootInitialWorkLocked (scan + decision + the fresh admission
 *     fact; a replay / a typed rejection completes in the same
 *     acquisition).
 *   -> the chain is RELEASED
 *   -> Phase B (WITHOUT the chain): the `deliverRootWork` port call —
 *      the ROOT TURN. The leader's own team tools (`team_delegate` /
 *      `team_follow_up` / `team_report_progress`) re-enter the router's
 *      facade and acquire the SAME chain during it (the N1 deadlock the
 *      pre-fix single-hold caused is removed).
 *   -> Phase C, RE-ACQUIRING the same chain (no abort signal — N6):
 *      the terminal fact (fresh-read convergence).
 *
 * This is NOT a second TeamRuntime facade: the S6 remote handler calls
 * this closure directly (no `performAction`, no Member lifecycle /
 * activity, no second public entry point).
 */
export function createAdmitRootInitialWork(
  input: RootInitialWorkClosureInput,
): AdmitRootInitialWork {
  return async (args: RootInitialWorkArgs): Promise<RootInitialWorkResult> => {
    const deps: RootInitialWorkDeps = {
      repositories: input.repositories,
      now: input.now,
      rootSessionId: args.rootSessionId,
      caller: args.caller,
      requestToken: args.requestToken,
      prompt: args.prompt,
      ...(args.attachedContext !== undefined ? { attachedContext: args.attachedContext } : {}),
      deliverRootWork: input.deliverRootWork,
      teamLocks: input.teamLocks,
    }
    // Phase A — the compatibility gate + the admission decision in ONE
    // acquisition of the shared chain (the CR-8 analog). A replay or a
    // typed rejection completes inside this acquisition (zero further
    // writes); an `owed` unit releases the chain and owes Phase B/C.
    const admitted = await withTeamLock(
      input.teamLocks,
      args.rootSessionId,
      async () => {
        const environmentFacts = await input.environmentFacts()
        await enforceCompatibilityGate(
          input.repositories,
          args.blueprint,
          args.rootSessionId,
          environmentFacts,
          input.now,
        )
        return admitRootInitialWorkLocked(deps)
      },
    )
    if (admitted.kind === 'replay') return admitted.result
    // Phase B (the ROOT TURN — chain released) + Phase C (re-acquired,
    // no abort signal) run AFTER the acquisition releases (INV-9.1).
    return completeRootInitialWorkAfterAdmission(deps, admitted)
  }
}
