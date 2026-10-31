/**
 * Alpha.6 PR-I1a (Lane 2) — the one durable writer of `ReviewAssignment` facts.
 *
 * WHAT THIS FILE ADDS, AND WHY IT WAS MISSING. PR2′ shipped the vocabulary (`types.ts`), the payload gate
 * (`facts.ts`), the fold and the CAS pre-flight — and, as `types.ts` A-8 said out loud, NO writer: "Durable writes
 * go through a port that PR-I1 wires (`allocateSequence()` + `put`, precedent `ArtifactLedgerPort.appendGranted`);
 * no writer exists in this PR, which is what 'dormant' means here". This is that writer. It reuses the Team
 * ledger that already exists — its sequence counter, its row shape, its write chain, its fold — and it does not
 * create a second approval ledger: the three fact types below are the only thing this module can append, they are
 * already booked into the frozen `team` category on BOTH projection surfaces (see
 * `REVIEW_ASSIGNMENT_FROZEN_CATEGORY`), and A-1 still holds: nothing this module writes can carry authority.
 *
 * THE THREE LAWS THAT DECIDE EVERY OTHER CHOICE HERE:
 *
 *  - **ONE WRITER (D-1).** Exactly one module in this repository appends `review-assignment-*` rows, and it is
 *    this one. A hygiene leg scans for a second (`a6-pr2-lane-hygiene.test.ts`), because two of the laws below
 *    are only sound under that assumption. The consequence for whoever wires this up next — PR-I1b, whose
 *    decision entry point lives INSIDE the protected centre — is a precondition, not a suggestion: route through
 *    this function. Re-implementing the write inside `control/service.ts` would put two locks on the same state,
 *    which is precisely the thing A-2's CAS cannot survive.
 *
 *  - **THE LOCK IS INJECTED, NOT IMPORTED (D-2).** ControlService serialises its writes with a `teamLocks` map
 *    that is a private closure (`control/service.ts:1656`), and reaching into it means editing the protected
 *    centre — which belongs to PR-I1b, not here. So this module takes a lock port. That means the writer's lock
 *    and the control plane's lock are, today, different objects, and the honest question is whether that is safe.
 *    It is, for a specific reason worth stating instead of assuming: the CAS domain of A-2 is this family's
 *    `assignmentEpoch`, and by the law above nothing but this writer appends these rows. A concurrent ControlService
 *    write can only append rows of OTHER families, which moves `sequence` (monotonic, allocated atomically on the
 *    host's single per-domain write chain) and cannot move `epochApplied`, cannot reorder two rows of this family,
 *    and cannot make this fold see an epoch it has not written. Two locks protecting disjoint mutable state is not
 *    a race; two locks protecting one state would be.
 *
 *  - **A REFUSAL IS AN ANSWER, AND NOTHING IS EVER HALF-CLAIMED (D-4/D-5).** There is no rollback anywhere in this
 *    storage layer — the ledger is append-only and failures roll forward, and the existing precedent for a
 *    multi-row operation is "retry completes the half-write" (`closeZeroReviewCaseTransactionally`). So every
 *    failure path that reached the ledger names exactly one of FOUR DURABILITY CLAIMS, and each claim is carried
 *    by its own code, because a caller switch-ing on the closed set is reading the NAME. Stated as four durability claims:
 *      1. **nothing this command did is durable** — `REVIEW_ASSIGNMENT_DURABLE_WRITE_FAILED`: allocation refused,
 *         allocation unusable, the ledger unreadable before anything was allocated, or the append refused and the
 *         re-read confirms nothing is at that sequence;
 *      2. **the row this command wrote IS durable at that sequence** — `REVIEW_ASSIGNMENT_ROW_DURABLE`, produced
 *         only by a branch that re-reads the ledger and identifies the row as this command's (family, root and
 *         payload), never by inference out of an exception;
 *      3. **the read-back did not find this command's row at that sequence** — `REVIEW_ASSIGNMENT_READBACK_MISMATCH`: either a different row holds it, or nothing does — round 3 of #517 (F-R3-2) caught this claim worded as an identity judgement about a row the module had not found, which the empty case cannot support;
 *      4. **it cannot be told** — `REVIEW_ASSIGNMENT_DURABLE_STATE_UNKNOWN`: the ledger could not be read far
 *         enough to answer, so the row MAY be durable at that sequence and it MAY be absent.
 *    Round 1 of #517 caught this module withholding claim 2 while the row sat durable at that sequence, because
 *    `LedgerRepository.putEntry` appends the row and only then stamps the session generation, so a root naming no
 *    TeamSession row makes the append succeed and the stamp throw. Round 2 caught the same branch MAKING claim 2
 *    about a row it had not identified: the re-read matched on sequence alone, where the success path matches
 *    family and root and payload, so a `control-leg-decided` row filed under another team's root was reported as
 *    this command's durable row — with a promise about the retry that the same module then refused. Both
 *    directions are pinned by legs that produce each code and assert no two claims share one. No answer here
 *    predicts what a retry answers; only the fold knows.
 *    A refusal is never a retraction either: a write is only reported as applied after it has been read back out
 *    of the ledger, and a read-back disagreement is reported as one rather than presented as a take-back — the row
 *    stays, because the honest sentence about an append-only ledger is that you cannot un-write it.
 *
 * WHAT THIS MODULE IS NOT: it is not an authority check (A-1, and a row it writes cannot become one — the payload
 * gate refuses authority-bearing keys before anything durable happens), it is not a router (that is `router.ts`,
 * and the caller passes the target it decided), and it is not wired to anything yet: production imports of this
 * lane remain empty and pinned so (`a6-pr2-lane-hygiene.test.ts`, `ALLOWED_CONSUMERS = []`).
 *
 * @module @dsh-agent-team/runtime/review-assignment/writer
 */

import { parseRootSessionId } from '../../contracts/src/index.js'

import {
  REVIEW_ASSIGNMENT_PAYLOAD_FIELDS,
  decodeAssignmentPayload,
  encodeAssignmentFact,
  foldReviewAssignmentRows,
  isReviewAssignmentFactType,
  checkAssignmentMutation,
} from './facts.js'
import type { ReviewAssignmentPayload } from './facts.js'
import { REVIEW_ASSIGNMENT_FACT_TYPES } from './types.js'
import type {
  ReviewAssignment,
  ReviewAssignmentFactKind,
  ReviewAssignmentRefusal,
  ReviewAssignmentState,
  ReviewAssignmentTarget,
} from './types.js'

/**
 * The writer's own refusal codes, in the order a reader meets them in the flow below. The kernel's refusals
 * (`REVIEW_ASSIGNMENT_*` in `types.ts`) pass through unchanged when the refusal came from the kernel; these are
 * the ones that only exist once a durable write is on the table, so they are a separate closed set rather than
 * an addition to the frozen kernel vocabulary.
 */
export const REVIEW_ASSIGNMENT_WRITE_REFUSALS = [
  'REVIEW_ASSIGNMENT_WRITE_COMMAND_MALFORMED',
  'REVIEW_ASSIGNMENT_WRITE_ROOT_UNMINTABLE',
  'REVIEW_ASSIGNMENT_WRITE_CROSS_TEAM_ROW',
  'REVIEW_ASSIGNMENT_WRITE_FOLD_UNRECONCILED',
  'REVIEW_ASSIGNMENT_WRITE_CLOCK_UNREADABLE',
  'REVIEW_ASSIGNMENT_DURABLE_WRITE_FAILED',
  /** The append landed and something after it failed, so the row IS durable while the command is NOT accepted.
   *  Kept distinct because this answer and `REVIEW_ASSIGNMENT_DURABLE_WRITE_FAILED` say opposite things about
   *  whether a row exists, and a caller's retry is aimed differently in each case. The word order here is
   *  deliberate rather than clumsy: the lane's import screen reads the module-specifier preposition followed by
   *  any quoted token, comments included, so this paragraph must not put that preposition in front of a code
   *  name — the trap this file's own header already warns about, which I walked into again. */
  'REVIEW_ASSIGNMENT_ROW_DURABLE',
  /**
   *  The read-back did not find the row this command wrote at the sequence it allocated. THREE branches produce it,
   *  and the claim is the negative one they share — this module could not confirm its own row at that sequence:
   *  (a) the append reported a failure and a DIFFERENT row holds that sequence;
   *  (b) the append succeeded and the row that came back is a different one, or does not decode;
   *  (c) the append succeeded and NOTHING is at that sequence on the next read.
   *  Branch (c) is why the name must not be read as "a foreign row is there": the append already reported success
   *  and this storage layer has no rollback, so this module will not say nothing was written (claim 1), will not
   *  say the row is durable (claim 2), and did manage to read, so it does not answer the unknown code either
   *  (claim 4). What it says is that its own write was not corroborated at that sequence.
   */
  'REVIEW_ASSIGNMENT_READBACK_MISMATCH',
  /** The ledger could not be read far enough to answer a durability question, so this module refuses to guess in
   *  either direction. Deliberately not folded into `REVIEW_ASSIGNMENT_DURABLE_WRITE_FAILED`, whose claim is the
   *  opposite one — that nothing this command did is durable — and round 2 of #517 measured four states answering
   *  that name, two of which could not support it. */
  'REVIEW_ASSIGNMENT_DURABLE_STATE_UNKNOWN',
] as const

export type ReviewAssignmentWriteRefusal = (typeof REVIEW_ASSIGNMENT_WRITE_REFUSALS)[number]

/**
 * What a refusal result may name. The kernel's refusals pass through **unchanged** rather than being re-labelled:
 * a `REVIEW_ASSIGNMENT_LEG_MISMATCH` returned by `checkAssignmentMutation` means exactly what it means when the
 * caller called the kernel itself, and inventing a durable wrapper code for it would make the durable path
 * report a different fact than the pure path about the same state. (The wording here is not incidental: the
 * lane's import screen reads the preposition that introduces a module specifier followed by any quoted token,
 * comments included, and two earlier drafts of this paragraph began that phrase with the preposition and then
 * named the kernel function in backticks — which the screen, correctly, read as an import of a module named
 * after a function. A screen that is literal is a screen; a screen that gets worked around is not, so the
 * sentence moved instead.)
 */
export type ReviewAssignmentRefusalCode = ReviewAssignmentWriteRefusal | ReviewAssignmentRefusal

/** A row of the ledger as the ports see it: the fields this module reads, with the payload left unknown. */
export interface ReviewAssignmentLedgerRow {
  readonly sequence: number
  readonly rootSessionId: string
  readonly factType: string
  readonly payload: unknown
}

/**
 * The row this module hands to `put`. `schemaVersion` is deliberately NOT here: it belongs to the storage schema,
 * which this lane does not import — the import-closure leg in `a6-pr2-lane-hygiene.test.ts` is the reason. The adapter that
 * satisfies this port is the place that knows the schema version, and it is exactly the kind of thin adapter the
 * `ArtifactLedgerPort` precedent puts at the composition root.
 */
export interface ReviewAssignmentRowDraft {
  readonly sequence: number
  readonly rootSessionId: string
  readonly factType: string
  readonly payload: ReviewAssignmentPayload
  readonly createdAt: string
}

/** The write half. `allocateSequence` then `put`, in that order, because the ledger rejects an unallocated one. */
export interface ReviewAssignmentLedgerWriterPort {
  allocateSequence(): Promise<number>
  put(row: ReviewAssignmentRowDraft): Promise<unknown>
}

/**
 * The read half: the WHOLE ledger, in sequence order, unfiltered — the row-level filter is this module's job.
 *
 * **An unfiltered, un-truncated, non-stale read is part of this port's contract.** The writer re-reads inside
 * the lock rather than trusting a cached view, and it refuses when a row it can see does not reconcile. What it
 * cannot do is see a row it was not shown, so it is blind to a suffix it is never shown — a fold over a shorter
 * ledger is just a fold over a shorter ledger. That asymmetry is measured in both directions, not asserted: hide
 * a MIDDLE row of a real chain and the epoch CAS convicts the reader (`REVIEW_ASSIGNMENT_EPOCH_CONFLICT`, folded
 * into `REVIEW_ASSIGNMENT_WRITE_FOLD_UNRECONCILED`); hide the NEWEST row and the command is accepted.
 * The consequence of that second shape is worse than "two live rows in one epoch", and the leg pins it: the
 * writer mints the next sequence claiming an epoch an earlier row already claimed, and from that moment the case
 * is permanently unwritable — every later command reads both rows and refuses to fold them. A `slice`, a stale
 * cache or a filtered adapter behind this port is an adapter bug with
 * that consequence, and no amount of care inside this module fixes it — which is why the obligation belongs to
 * whoever writes the adapter (PR-I1b) and not to a defensive check here.
 *
 * The shape above is silent about what a returned ledger answer may do besides be read, so the promise is written
 * here: a reader may throw, it may return something that throws when it is walked, and this module treats either as
 * an answer rather than a crash. All four places that read the ledger are guarded over the WHOLE read — the call,
 * the iteration and the per-row property access — and a reader that fails in any of those ways is met with a
 * refusal naming the state the module is really in: nothing this command did is durable, or durable but unreadable,
 * or durable and identified, or not corroborated at its own sequence — never with an exception reaching the caller
 * (measured: `answers with a refusal instead of an exception at EVERY read of the injected ledger`, plus the
 * round-3 legs for a null element and for a cursor that throws on iteration).
 * The two other injected ports answer under the same law: a clock that throws is met beside the branch that screens
 * an unreadable clock VALUE, and a lock that refuses the acquisition is met with the first durability claim,
 * because the acquisition is taken before anything is allocated. A rejection raised from INSIDE the critical
 * section is not relabelled as a lock failure — inside, the branches above already answer for themselves, and a
 * guard that swallowed them would be the same lie in a new place.
 * An adapter may therefore hand this writer a ledger, a clock or a lock that fails and the contract still answers;
 * what it must not hand it is a ledger that lies by omission.
 */
export interface ReviewAssignmentLedgerReaderPort {
  list(): readonly ReviewAssignmentLedgerRow[]
}

/**
 * Per-root serialisation. `withLock` must be non-reentrant from this module's point of view: this writer holds it
 * exactly once per call and never calls back into itself.
 */
export interface ReviewAssignmentLockPort {
  withLock<T>(rootSessionId: string, critical: () => Promise<T>): Promise<T>
}

/** Everything the writer needs. No optional port: an half-wired writer is the dormant half this lane forbids. */
export interface ReviewAssignmentStoreDeps {
  readonly ledger: ReviewAssignmentLedgerWriterPort & ReviewAssignmentLedgerReaderPort
  readonly lock: ReviewAssignmentLockPort
  /** The store's clock (ISO-8601). Precedent: `GovernanceProposalStoreDeps.now` — the durable stamp is the
   *  store's, not the caller's, so a caller cannot date its own fact. */
  readonly now: () => string
}

/** The command shape. `kind` is the operation the caller decided; legality is decided by `checkAssignmentMutation`. */
export interface ReviewAssignmentCommand {
  readonly kind: ReviewAssignmentFactKind
  readonly rootSessionId: string
  readonly approvalCaseId: string
  readonly currentLegRequestId: string
  /** The target the row will name: the new handler for `created`/`transferred`, the outgoing one for `retired`. */
  readonly target: ReviewAssignmentTarget
  readonly reasonCode: string
  readonly basedOnCaseVersion: string
  readonly actorCallerRef: string
}

/** A durable write, or a faithful report of a replay that needed no write. */
export interface ReviewAssignmentWriteApplied {
  readonly ok: true
  /** `'already'` is the idempotent-replay answer of D-4: this exact row is already durable at this sequence. */
  readonly applied: 'written' | 'already'
  readonly sequence: number
  readonly factType: string
  readonly assignmentEpoch: number
  readonly payload: ReviewAssignmentPayload
  /** The fold as it stands after the write, so the caller can act without a second read. */
  readonly state: ReviewAssignmentState
}

export type ReviewAssignmentWriteResult =
  | ReviewAssignmentWriteApplied
  | { readonly ok: false; readonly refusal: ReviewAssignmentRefusalCode; readonly detail: string }

function refuseWrite(refusal: ReviewAssignmentWriteRefusal, detail: string): ReviewAssignmentWriteResult {
  return { ok: false, refusal, detail }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

/**
 * The shape the durable layer will accept in `createdAt`, spelled here rather than imported.
 *
 * `contracts/src/dto/common.ts` owns this rule as `ISO_8601_TIMESTAMP_PATTERN`, and this lane may not import it:
 * the contracts barrel does not re-export the pattern, adding it to a frozen v1 surface is a decision this PR is
 * not authorised to make, and widening the lane's import allow-list to a deep contracts path to reach one regex
 * would weaken the very leg that makes the lane's purity claim mean something. So the rule is duplicated, and
 * `a6-pri1a-writer.test.ts` reads the contract source and asserts the two patterns are the same expression —
 * which turns the duplication from a drift risk into a pinned fact.
 */
const CREATED_AT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/

/** The first handful of `factType@sequence` handles, with the remainder counted rather than listed. */
function rowHandles(diagnostics: readonly { factType: string; ledgerSequence: number }[]): string {
  const shown = diagnostics.slice(0, 8).map((diagnostic) => `${diagnostic.factType}@${String(diagnostic.ledgerSequence)}`)
  const rest = diagnostics.length - shown.length
  return rest > 0 ? `${shown.join(', ')}, +${String(rest)} more` : shown.join(', ')
}

/**
 * Does the calendar date in an ISO instant exist?
 *
 * The contract's pattern is structural: `2026-13-45T99:99:99Z` matches it. That is not a flaw in the contract —
 * a DTO pattern is a shape test — but this writer hands the stamp to a ledger that validates harder, and the
 * measured consequence of relying on the shape alone was a bad clock producing
 * `REVIEW_ASSIGNMENT_DURABLE_WRITE_FAILED` with a sequence already spent, when the truthful answer is "your clock
 * is unreadable and I allocated nothing". So the ranges are checked here, with the day-of-month table and the
 * leap rule spelled out, because the lane reads no clock and therefore cannot ask one.
 */
function instantIsReal(iso: string): boolean {
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(iso)
  if (parts === null) return false
  const [y, m, d, hour, minute, second] = parts.slice(1, 7).map(Number)
  if ([y, m, d, hour, minute, second].some((part) => part === undefined || !Number.isSafeInteger(part))) return false
  if (y === undefined || m === undefined || d === undefined || hour === undefined || minute === undefined || second === undefined) return false
  if (m < 1 || m > 12) return false
  if (hour > 23 || minute > 59 || second > 59) return false
  const daysInMonth = [31, y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  const max = daysInMonth[m - 1]
  if (max === undefined) return false
  return d >= 1 && d <= max
}

/** Field-wise equality over the CLOSED payload field set — the same list the encoder writes from. */
function samePayload(a: ReviewAssignmentPayload, b: ReviewAssignmentPayload): boolean {
  for (const field of REVIEW_ASSIGNMENT_PAYLOAD_FIELDS) {
    if ((a as unknown as Record<string, unknown>)[field] !== (b as unknown as Record<string, unknown>)[field]) {
      return false
    }
  }
  return true
}

/**
 * The one entry point: fold the family, decide legality, write, read back.
 *
 * Everything happens inside one `withLock` hold, and the fold is done FROM THE LEDGER inside that hold rather than
 * taken from a cache — the same discipline `loadControlState` uses (`control/service.ts:1766`: re-fold inside the
 * lock, never trust a cached view), and the reason the epoch CAS in A-2 means anything.
 */
export async function applyReviewAssignment(
  deps: ReviewAssignmentStoreDeps,
  command: ReviewAssignmentCommand,
): Promise<ReviewAssignmentWriteResult> {
  if (
    typeof command !== 'object' ||
    command === null ||
    // `kind` is the KEY of the fact-type table ('created'), not its value ('review-assignment-created').
    // The first version of this line compared against `Object.values`, so every valid command was refused as
    // malformed — which is the survivable direction (a writer that cannot write fails loudly), and it is also
    // the confusion a caller will make, so `a6-pri1a-writer.test.ts` has a leg that feeds the value as the key
    // and requires the refusal to name the shape rather than accept the row.
    !(Object.keys(REVIEW_ASSIGNMENT_FACT_TYPES) as readonly string[]).includes(command.kind) ||
    !isNonEmptyString(command.rootSessionId) ||
    !isNonEmptyString(command.approvalCaseId) ||
    !isNonEmptyString(command.currentLegRequestId) ||
    typeof command.target !== 'object' ||
    command.target === null
  ) {
    return refuseWrite(
      'REVIEW_ASSIGNMENT_WRITE_COMMAND_MALFORMED',
      '`kind` must be one of the three fact-type KEYS (created | transferred | retired), not a fact-type ' +
        'value, and the ids must be non-empty strings',
    )
  }
  // The root is not just any string: it is the ledger's team key, and this lane is not allowed to invent a team
  // id that the host would reject at read time. Minting through the contract parser is the cheapest proof that
  // what lands in `rootSessionId` is a root session id at all.
  let mintedRoot: string
  try {
    mintedRoot = parseRootSessionId(command.rootSessionId)
  } catch {
    return refuseWrite(
      'REVIEW_ASSIGNMENT_WRITE_ROOT_UNMINTABLE',
      `${JSON.stringify(command.rootSessionId)} is not a root session id, so it cannot own a ledger row`,
    )
  }

  // Round 3 of #517 (F-R3-6): a lock that refuses the acquisition is a refusal, not a crash. The acquisition is
  // taken before this module allocates anything, so the first durability claim is the honest one here. The flag is
  // what keeps that claim true: a rejection raised AFTER the critical section was entered came from a branch that
  // already answers for itself, and relabelling it would be this module claiming a state it never observed.
  let enteredCriticalSection = false
  try {
    return await deps.lock.withLock(mintedRoot, () => {
      enteredCriticalSection = true
      return writeLocked(deps, command, mintedRoot)
    })
  } catch (lockError) {
    if (enteredCriticalSection) throw lockError
    return refuseWrite(
      'REVIEW_ASSIGNMENT_DURABLE_WRITE_FAILED',
      `the team lock could not be acquired for this root (${describe(lockError)}); nothing was allocated and nothing ` +
        'this command did is durable',
    )
  }
}

async function writeLocked(
  deps: ReviewAssignmentStoreDeps,
  command: ReviewAssignmentCommand,
  root: string,
): Promise<ReviewAssignmentWriteResult> {
  // Round 2 of #517 (F-R2-3): the rule round 1 stated for the re-read — a read of an injected port must not
  // escape as an exception, because then the question has no answer at all — applies to EVERY read. Round 3
  // (F-R3-1) caught that this site guarded the CALL only: the list call was inside the try and the two filters over
  // its answer were outside, so a reader that returned normally but yielded an undecodable element (a null row, an
  // array whose iteration throws) still threw straight out of `applyReviewAssignment`, while the same row was
  // answered at the other three sites. The try therefore covers the read AND what the read produced — iteration and
  // per-row property access — and nothing downstream of this block touches the raw answer again. This read happens
  // before anything is allocated, so the honest code is the "nothing is durable" one rather than the unknown one.
  let all: readonly ReviewAssignmentLedgerRow[]
  let family: readonly ReviewAssignmentLedgerRow[]
  let mine: readonly ReviewAssignmentLedgerRow[]
  try {
    all = deps.ledger.list()
    family = all.filter((row) => isReviewAssignmentFactType(row.factType))
    mine = family.filter((row) => row.rootSessionId === root)
  } catch (error) {
    return refuseWrite(
      'REVIEW_ASSIGNMENT_DURABLE_WRITE_FAILED',
      `the ledger could not be read before anything was allocated (${describe(error)}); nothing was allocated and ` +
        'nothing this command did is durable',
    )
  }

  // Ownership before anything is trusted (D-7). A row filed under THIS root whose payload names a different team
  // is the cross-team shape the kernel already has a code for, and it must stop the write: folding it would let
  // another team's row move this case's epoch, and skipping it silently would be the clean-slate lie A-7 forbids.
  const foreign: string[] = []
  for (const row of mine) {
    const decoded = decodeAssignmentPayload(row.factType, row.payload)
    if (decoded.ok && decoded.value.rootSessionId !== row.rootSessionId) {
      foreign.push(`${row.factType}@${String(row.sequence)}`)
    }
  }
  if (foreign.length > 0) {
    return refuseWrite(
      'REVIEW_ASSIGNMENT_WRITE_CROSS_TEAM_ROW',
      `${String(foreign.length)} row(s) filed under this root name another team: ${foreign.join(', ')}`,
    )
  }

  const state = foldReviewAssignmentRows(
    mine.map((row) => ({ ledgerSequence: row.sequence, factType: row.factType, payload: row.payload })),
    root,
    command.approvalCaseId,
  )
  if (state.unreconciled) {
    // Named rather than lumped: "some row of this family could not be applied" is the same sentence for a row
    // another team wrote, a payload with an authority key in it, and a sequence that went backwards, and those
    // three want three different repairs.
    const codes = [...new Set(state.diagnostics.map((diagnostic) => diagnostic.refusal))].join(', ')
    return refuseWrite(
      'REVIEW_ASSIGNMENT_WRITE_FOLD_UNRECONCILED',
      // The row handles are the point of this message. A caller told only "the fold is unreconciled" has to
      // re-read and re-diagnose the whole ledger to find the row to repair, and the first draft of this line
      // named the codes alone — a leg about a broken lock caught that, because the handle it asked for was a
      // sequence and no sequence was in the text. Capped at eight because a ledger with five thousand
      // unreadable rows must not produce a five-thousand-row refusal string.
      `${String(state.diagnostics.length)} row(s) of this family could not be applied (${codes}) ` +
      `[${rowHandles(state.diagnostics)}]; the fold may be missing an assignment that exists, so no mutation is safe`,
    )
  }

  const legality = checkAssignmentMutation(state, command.kind, command.target, command.currentLegRequestId)
  if (!legality.ok) {
    // A replay of a command that already landed is not a conflict, and pretending otherwise teaches the caller to
    // retry until it gets a different answer. D-4: equality is decided against the kernel's own encoder, over the
    // closed field set, for the epoch the durable row actually carries.
    const replay = findAppliedReplay(mine, command)
    if (replay !== null) {
      return {
        ok: true,
        applied: 'already',
        sequence: replay.sequence,
        factType: replay.factType,
        assignmentEpoch: replay.payload.assignmentEpoch,
        payload: replay.payload,
        state,
      }
    }
    return { ok: false, refusal: legality.refusal, detail: legality.detail }
  }

  const assignment: ReviewAssignment = {
    rootSessionId: root,
    approvalCaseId: command.approvalCaseId,
    currentLegRequestId: command.currentLegRequestId,
    target: command.target,
    assignmentEpoch: legality.value.assignmentEpoch,
    reasonCode: command.reasonCode,
    basedOnCaseVersion: command.basedOnCaseVersion,
    actorCallerRef: command.actorCallerRef,
  }
  const encoded = encodeAssignmentFact(command.kind, assignment, legality.value.expectedPreviousEpoch)
  if (!encoded.ok) {
    return { ok: false, refusal: encoded.refusal, detail: encoded.detail }
  }

  // Round 3 of #517 (F-R3-6): the value screen below answered an unreadable clock; a clock that THREW escaped as an
  // exception. Same question, same answer, and the closed set already owns the code.
  let createdAt: unknown
  try {
    createdAt = deps.now()
  } catch (clockError) {
    return refuseWrite(
      'REVIEW_ASSIGNMENT_WRITE_CLOCK_UNREADABLE',
      `the store's clock threw instead of answering (${describe(clockError)}); nothing was allocated`,
    )
  }
  if (typeof createdAt !== 'string' || !CREATED_AT_PATTERN.test(createdAt) || !instantIsReal(createdAt)) {
    return refuseWrite(
      'REVIEW_ASSIGNMENT_WRITE_CLOCK_UNREADABLE',
      `the store's clock returned ${typeof createdAt === 'string' ? JSON.stringify(createdAt) : typeof createdAt}, ` +
        'which cannot be a durable timestamp; nothing was allocated',
    )
  }

  const factType = REVIEW_ASSIGNMENT_FACT_TYPES[command.kind]
  let sequence: number
  try {
    sequence = await deps.ledger.allocateSequence()
  } catch (error) {
    return refuseWrite(
      'REVIEW_ASSIGNMENT_DURABLE_WRITE_FAILED',
      `the ledger refused to allocate a sequence (${describe(error)}); nothing was written, and if the ledger moved` +
        ' its counter while trying, that reservation is spent — no later row may reuse it, and this command is not applied`,'
    )
  }
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    return refuseWrite(
      'REVIEW_ASSIGNMENT_DURABLE_WRITE_FAILED',
      `the ledger allocated ${String(sequence)}, which is not a usable sequence; nothing was written, and if the` +
        ' ledger moved its counter while producing it, that reservation is spent too — no later row may reuse it, and' +
        ' this command is not applied`,'
    )
  }

  try {
    await deps.ledger.put({ sequence, rootSessionId: root, factType, payload: encoded.value, createdAt })
  } catch (error) {
    // A throw is not the same observation as "no row exists", and the difference is reachable rather than
    // theoretical: `putEntry` appends the record and only afterwards advances the session generation
    // (`repositories/ledger.ts:201/214`), and that stamp throws `missing-key` for a root with no TeamSession row
    // (`repositories/team-sessions.ts:119`) — a root this writer deliberately mints without a team-existence
    // check (§2.2 / memo R-5). So the append can be durable while the call fails, and the only honest way to
    // choose between the two answers is to look.
    //
    // The complementary state, which round 2 of #517 measured (memo R-20) and which this module can neither
    // produce nor prevent, is quieter and worse: where a TeamSession row DOES exist, a stamp that fails after a
    // landed append throws nothing at all. The ledger moves ahead and `team_sessions.generation` stays one
    // behind, and the reader that turns that into a silent omission is the projection frame — the stamp is put
    // into the frame the client is sent (`projection-source.ts:499` and `:532`), and a frame whose generation
    // equals the generation already applied is judged `duplicate` and dropped (`remote/src/push/generation.ts:73-79`;
    // `remote/src/pull/pull-v6.ts:141-150` calls that cell the client's single ledger-refresh trigger). A client
    // holding generation N therefore discards every later frame carrying the new row until some OTHER write
    // advances that root's stamp. Nothing here refuses; it under-reports. That is PR-I1b's obligation (recorded
    // on #502 with the rest of the wiring duties), because the fix is in who writes the stamp and when, not in
    // a reader this module does not own.
    // The re-read is itself a call into an injected port, and a call that throws while answering "did my row
    // land?" must not escape as an exception: the question would then have no answer at all, which is worse
    // than the honest "I cannot tell you".
    //
    // And a row found at that sequence is not yet THE row this command wrote. Round 1's fix matched on
    // `sequence` alone, which is the one field a row's identity does not settle: round 2 drove the tampering
    // medium this lane's own spec admits (an append that rewrites the payload, with the stamp failing after the
    // append landed) and a reader that obeys the port contract exactly, and both answers were wrong — the module
    // called a foreign row durable and promised a retry outcome it then refused itself. So the catch applies the
    // SAME screen the success path applies, family and root and payload, and keeps the two claims apart.
    let landed: ReturnType<ReviewAssignmentLedgerReaderPort['list']>[number] | undefined
    try {
      landed = deps.ledger.list().find((row) => row.sequence === sequence)
    } catch (readError) {
      return refuseWrite(
        'REVIEW_ASSIGNMENT_DURABLE_STATE_UNKNOWN',
        `sequence ${String(sequence)} was allocated and the row write failed (${describe(error)}), and the ledger ` +
          `could not be re-read to determine whether the row is durable (${describe(readError)}) — it MAY be ` +
          'durable at that sequence and it MAY be absent. This command is not accepted. Nothing here predicts what ' +
          'a retry answers: the retry re-reads, and answers from what it finds',
      )
    }
    if (landed !== undefined) {
      const landedPayload = decodeAssignmentPayload(landed.factType, landed.payload)
      if (
        landed.factType !== factType ||
        landed.rootSessionId !== root ||
        !landedPayload.ok ||
        !samePayload(landedPayload.value, encoded.value)
      ) {
        return refuseWrite(
          'REVIEW_ASSIGNMENT_READBACK_MISMATCH',
          `sequence ${String(sequence)} was allocated and the row write reported a failure (${describe(error)}), ` +
            `and what is durable at that sequence is not the row this command wrote (${landed.factType}@` +
            `${String(landed.sequence)}, filed under ${landed.rootSessionId}` +
            (landedPayload.ok ? '' : ', whose payload does not decode') +
            '). This command is not accepted, and this answer deliberately does not claim that this command wrote ' +
            'that row — the row stays, because an append-only ledger cannot be un-written',
        )
      }
      return refuseWrite(
        'REVIEW_ASSIGNMENT_ROW_DURABLE',
        `sequence ${String(sequence)} was allocated and the write reported a failure (${describe(error)}), but the ` +
          `row this command wrote IS durable at that sequence (${landed.factType}@${String(landed.sequence)}, same ` +
          'root, same payload as commanded) — the failure came after the append, not instead of it. This command ' +
          'is not accepted as written. Whether a retry then reads as already applied is the fold\u2019s verdict on ' +
          'this row, and a refusal here does not predict it',
      )
    }
    // The gap this leaves is real and is reported as such, and the claim is now verified rather than assumed:
    // the ledger was re-read and nothing is at that sequence. The ledger allows the gap to be filled later.
    return refuseWrite(
      'REVIEW_ASSIGNMENT_DURABLE_WRITE_FAILED',
      `sequence ${String(sequence)} was allocated and the row write failed (${describe(error)}); the ledger was ` +
        're-read and no assignment row exists at that sequence, so nothing this command did is durable',
    )
  }

  // Read-back, because "the write did not throw" is not the same claim as "the row is in the ledger" — the
  // precedent is `writeLegRowLocked`'s read-back refusal (control/service.ts:4628-4641), and the failure mode it
  // protects against is a durable layer that reports success on a partial apply.
  // Same rule as the catch: this read is a call into an injected port too, and round 2 measured it throwing at
  // the caller with the row already durable — the exact question the guard above exists to keep answerable, at
  // its sibling site. The row MAY be durable; that is the fourth claim, and it is not the first one.
  let reread: ReturnType<ReviewAssignmentLedgerReaderPort['list']>[number] | undefined
  try {
    reread = deps.ledger.list().find((row) => row.sequence === sequence)
  } catch (readError) {
    return refuseWrite(
      'REVIEW_ASSIGNMENT_DURABLE_STATE_UNKNOWN',
      `sequence ${String(sequence)} was written and the ledger could not be read back to confirm it ` +
        `(${describe(readError)}) — the row MAY be durable at that sequence and it MAY be absent. This command is ` +
        'not accepted, and it is not reported as applied either: an applied answer requires a read-back',
    )
  }
  if (reread === undefined) {
    return refuseWrite(
      'REVIEW_ASSIGNMENT_READBACK_MISMATCH',
      `sequence ${String(sequence)} was written and is not present when the ledger is read again`,
    )
  }
  const rereadPayload = decodeAssignmentPayload(reread.factType, reread.payload)
  if (
    !rereadPayload.ok ||
    reread.factType !== factType ||
    reread.rootSessionId !== root ||
    !samePayload(rereadPayload.value, encoded.value)
  ) {
    return refuseWrite(
      'REVIEW_ASSIGNMENT_READBACK_MISMATCH',
      `sequence ${String(sequence)} came back as something other than the row written there` +
        (rereadPayload.ok ? '' : ' (the stored payload does not decode)'),
    )
  }

  // The row is durable and identified — the read-back above proved it. What can still fail is the LAST read, the
  // one that folds the family state this answer carries. Answering `written` would report a state the module
  // never read, and answering "unknown" would contradict the claim it just verified, so this answers with the one
  // code whose claim is still true: the row this command wrote IS durable at that sequence, and the command is
  // not reported as applied because its state could not be produced.
  let finalState: ReviewAssignmentState
  try {
    finalState = foldReviewAssignmentRows(
      deps.ledger
        .list()
        .filter((row) => isReviewAssignmentFactType(row.factType) && row.rootSessionId === root)
        .map((row) => ({ ledgerSequence: row.sequence, factType: row.factType, payload: row.payload })),
      root,
      command.approvalCaseId,
    )
  } catch (readError) {
    return refuseWrite(
      'REVIEW_ASSIGNMENT_ROW_DURABLE',
      `the row this command wrote IS durable at that sequence (${reread.factType}@${String(reread.sequence)}, ` +
        `same root, same payload as commanded) and the write itself reported no failure, but the family state ` +
        `could not be read (${describe(readError)}). This command is not reported as applied: an applied answer ` +
        'carries a state, and this module will not hand out one it did not read',
    )
  }

  return {
    ok: true,
    applied: 'written',
    sequence: reread.sequence,
    factType: reread.factType,
    assignmentEpoch: rereadPayload.value.assignmentEpoch,
    payload: rereadPayload.value,
    state: finalState,
  }
}

/**
 * The durable row this command already produced, if there is one.
 *
 * Reconstructing the payload the encoder WOULD have written for a row's own epoch and comparing field-for-field is
 * the only honest replay test available here, because `createdAt` is the store's clock and is deliberately not
 * part of the payload — a faithful replay across two processes is therefore not byte-identical, and the storage
 * layer's identical-bytes no-op rule cannot be what makes a retry safe. Epoch-scoped equality is what makes a
 * retry safe; byte identity stays as the backstop underneath it.
 */
function findAppliedReplay(
  rows: readonly ReviewAssignmentLedgerRow[],
  command: ReviewAssignmentCommand,
): { readonly sequence: number; readonly factType: string; readonly payload: ReviewAssignmentPayload } | null {
  for (const row of rows) {
    if (row.factType !== REVIEW_ASSIGNMENT_FACT_TYPES[command.kind]) continue
    const stored = decodeAssignmentPayload(row.factType, row.payload)
    if (!stored.ok) continue
    if (stored.value.approvalCaseId !== command.approvalCaseId) continue
    const rebuilt = encodeAssignmentFact(
      command.kind,
      {
        rootSessionId: command.rootSessionId,
        approvalCaseId: command.approvalCaseId,
        currentLegRequestId: command.currentLegRequestId,
        target: command.target,
        assignmentEpoch: stored.value.assignmentEpoch,
        reasonCode: command.reasonCode,
        basedOnCaseVersion: command.basedOnCaseVersion,
        actorCallerRef: command.actorCallerRef,
      },
      stored.value.previousEpoch,
    )
    if (rebuilt.ok && samePayload(rebuilt.value, stored.value)) {
      return { sequence: row.sequence, factType: row.factType, payload: stored.value }
    }
  }
  return null
}

/**
 * An error's identity, kept out of a refusal detail by construction: never a caller object, and never less than
 * what the thing being reported actually says. A plain `Error` contributes its message; anything else is
 * summarised by the fields an operator reads — the storage seam rejects with a `code` and a `problem` rather than
 * an `Error` — and only then falls back to `typeof`. The fallback used to be the whole function, so every
 * non-`Error` refusal from a composed adapter read "(object)" at the one moment a human was reading this string
 * (round 2 of #517, INFO-1).
 */
function describe(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>
    const parts = ['code', 'problem', 'message']
      .map((field) => (typeof record[field] === 'string' ? (record[field] as string) : undefined))
      .filter((part): part is string => part !== undefined && part.length > 0)
    if (parts.length > 0) return parts.join(' — ')
  }
  return typeof error
}
