/**
 * P9-T4 (S3-B) — the pure durable-ledger adapter: loaded
 * `RemoteLedgerEntryValue[]` (+ completeness authority) →
 * `TeamUiLedgerModel`, and the combined entry `adaptTeamUi` that
 * satisfies the plan §7.1 purity contract
 * `output = pure(TeamProjectionDto, loaded RemoteLedgerEntryValue[])`.
 *
 * Purity / forbidden edges (plan §7.1, gate G3): no backend write, no
 * authoritative lifecycle storage, no session-log scan, no DOM, no
 * TeamDomain import. Payloads are heterogeneous wire records, so every
 * leaf read is FAIL-SAFE (typeof string / integer guards); a row that
 * lacks a leaf it needs is SKIPPED, never patched with an invented
 * value. The raw `payload` is passed through on every row verbatim.
 *
 * PR #56 (subject-aware control adaptation): a control REQUEST row's
 * identity is `requestId` + `actionName` + the canonical
 * `ControlSubject` read over the closed map
 * (`instance→instanceId | template→templateId | team→rootSessionId`,
 * `packages/runtime/control/types.ts` L256-259) — the pre-fix
 * `targetInstanceId` requirement silently dropped every non-instance
 * subject (the S9 `template:worker` case, `service.ts` L1490-1492
 * writes the leaf for the instance subject ONLY). An unknown /
 * malformed subject now yields an explicit `unsupported-subject`
 * chain (visible, non-decidable) instead of a silent drop; the
 * `reviewPayload` (+ lossless-guarded) and the FULL wire
 * `reviewPayloadDigest` ride the chain verbatim. Display-side only —
 * NO canonicalization / hash ships in the product (display ≠
 * verification).
 *
 * Completeness gating (plan §7.4; design lock): `entries` / `controls`
 * / `messages` / `intervals` are always derived from the LOADED entries
 * (the `completeness` marker carries the authority); `progress`
 * (historical work rows) and `pendingControlByInstance` are emitted
 * ONLY for a known-complete ledger — a partial ledger never claims a
 * complete task board and never distributes pending counts.
 *
 * `adaptTeamUi` additionally overlays the §7.3 per-instance pending
 * badges onto the snapshot member rows — and only then: the projection
 * adapter alone always leaves them `null` (unknown).
 *
 * Implementation note: the pairing passes (control decisions, interval
 * closes) run over MUTABLE internal drafts; the exported rows are the
 * readonly public types, produced once at the end. The module itself is
 * pure: inputs are never mutated, every output is freshly built.
 *
 * Pure module: no React, no I/O. Erasable TS only.
 * @module @dsh-agent-team/client/model/ledger-adapter
 */

import type {
  ProgressValue,
  TeamProjectionDto,
} from '../../../contracts/src/index.js'
import type {
  RemoteLedgerEntryValue,
  RemoteSafeJsonValue,
} from '../../../remote/src/index.js'
import { adaptTeamProjection } from './projection-adapter.js'
import type { TeamPerspective } from '../state/team-session-resolution.js'
import type { TeamLedgerState } from '../state/team-ledger-store.js'
import type {
  TeamUiActivityIntervalRow,
  TeamUiControlChain,
  TeamUiControlRenderMode,
  TeamUiControlSubject,
  TeamUiLedgerModel,
  TeamUiLedgerRow,
  TeamUiMessageRow,
  TeamUiProgressRow,
  TeamUiSnapshot,
} from './team-ui-snapshot.js'

/**
 * CLIENT-LOCAL frozen mirror of the host fact-type → category
 * vocabulary. PROVENANCE (the client may not import the host package —
 * `packages/runtime` is host-side authority):
 * `packages/runtime/src/plugin/projection-source.ts` `FACT_TYPE_CATEGORY`
 * (the 19-fact vNext vocabulary — 12 + the TCM-M3 `team-root-work-delivered`
 * terminal record + the strict-read `artifact-read-granted` durable
 * authorization grant + the pre-alpha3 PR-C `capability-runtime-event`
 * compatibility telemetry + the four pre-alpha3 PR-E requirement / recovery
 * facts (`optional-requirement-accepted`, `template-availability-set`,
 * `recovery-incident-opened`, `recovery-incident-closed`); the host fails
 * closed `LEDGER_CATEGORY_UNKNOWN` on any unmapped fact type, so an unknown
 * `category` here can only ever be display-side, never authority-side).
 * A row whose fact type is absent from this map carries NO `category`
 * (omitted, never guessed).
 */
const FACT_TYPE_CATEGORY: Readonly<Record<string, LedgerCategoryValue>> = {
  'team-work-admitted': 'team',
  // TCM-M3: the creation-time Root initial work's terminal success record
  // (the host's one new fact type; the `targetKind: 'root'` payload
  // discriminator distinguishes the Root entries) → the existing `team`
  // category (no new category — plan §15.7).
  'team-root-work-delivered': 'team',
  'provision-member-instance': 'member',
  'member-lifecycle-changed': 'lifecycle',
  'team-message-delivered': 'message',
  'team-coordination-recorded': 'message',
  'control-request-recorded': 'control',
  'control-decision-recorded': 'control',
  'control-allow-consumed': 'control',
  // A4-PR0a: mirror of the host category map — the inline-abort terminal mark.
  // The renderer already had a case for this fact type while the category map
  // did not, so an abandoned request degraded the client's ledger summary.
  'control-request-abandoned': 'control',
  // A4-PR3 (ADR A5-22's mirror rule, with the category CORRECTED by X8-R3):
  // the additive escalation-leg mark, written by `control/service.ts`
  // `escalateApprovalLeg`. It lands in `control` — the same reasoning as the
  // abandon row above: an escalation closes a control LEG and opens the risen
  // one, it is not a governance PROPOSAL, so it does not belong beside
  // `governance-proposal-recorded` in `policy` (the original A5-6 rationale
  // did not transfer). Registration in this map and in the host's
  // `projection-source.ts` ship in the SAME commit, and the VALUE is pinned by
  // `ledger-adapter.test.ts` — `a4pr0a-fact-type-closed-set.test.ts` compares
  // the two maps' KEY SETS only, so without that pin a `policy` value here
  // would classify the row differently from the host, invisibly.
  // It deliberately enters the pairing switch NOWHERE: the terminal `deny`
  // decision row (reason `escalated`) is what closes leg 1, and the risen leg
  // is an ordinary request row — so no pending count can double-count a case.
  'control-escalation-recorded': 'control',
  // Strict-read durable authorization grant: a control-and-persistence
  // fact, NOT a control request/decision (it never enters the pairing
  // switch below, never increments a pending count, and is hidden from
  // the Events surface by team-ledger-model's INTERNAL_FACT_TYPES).
  'artifact-read-granted': 'control',
  'activity-progress-recorded': 'progress',
  'activity-interval-opened': 'progress',
  'activity-interval-closed': 'progress',
  'policy-state-transitioned': 'policy',
  // A4-PR0 (ADR A5-22): mirror of the host category map, in the SAME commit as
  // the host registration — the client's ledger summary must classify the row
  // exactly as the host's fold does. A durable governance PROPOSAL is a
  // statement about the Team's authority awaiting review, so it lands in the
  // frozen `policy` category beside the policy-state transitions (ADR A3-7: no
  // ninth category). No product surface writes one at PR0 (ADR A4-6); a row
  // whose type is absent from this map simply carries no category client-side,
  // and `a4pr0a-fact-type-closed-set.test.ts` C3 fails the drift.
  'governance-proposal-recorded': 'policy',
  // pre-alpha3 PR-C §C.7: the durable capability readiness telemetry (the
  // compatibility category's first production writer). A compatibility
  // CATEGORY — no new category. Hidden from the Events surface by
  // team-ledger-model's INTERNAL_FACT_TYPES (it is an operational telemetry
  // fact, not a user-facing event).
  'capability-runtime-event': 'compatibility',
  // pre-alpha3 PR-E §E.5: the requirement / recovery durable facts (consent,
  // template availability, recovery-incident open/close) — the frozen
  // `compatibility` category's next writers (no new category). Mirrors the
  // host's projection-source FACT_TYPE_CATEGORY. Hidden from the Events
  // surface by team-ledger-model's INTERNAL_FACT_TYPES (a dedicated UI row
  // kind for these is separate work; until then they stay authority/audit
  // state, not user activity).
  'optional-requirement-accepted': 'compatibility',
  'template-availability-set': 'compatibility',
  'recovery-incident-opened': 'compatibility',
  'recovery-incident-closed': 'compatibility',
}

/** The frozen category literals (the contracts `LedgerCategory` closed set). */
type LedgerCategoryValue =
  | 'team'
  | 'member'
  | 'lifecycle'
  | 'message'
  | 'control'
  | 'policy'
  | 'compatibility'
  | 'progress'

/** One wire payload as a plain leaf-readable record. */
type Payload = Readonly<Record<string, RemoteSafeJsonValue>>

/**
 * PR #56 — the CLIENT-LOCAL frozen mirror of the contracts
 * lossless-JSON guard (PROVENANCE — same mirror discipline as
 * `FACT_TYPE_CATEGORY` above; the client product bundle builder fences
 * the reachable graph to its own dist module root, so no cross-package
 * VALUE import is possible: `scripts/build-client-composition.mjs`
 * module-root rule. The check mirrors
 * `packages/contracts/src/remote-safe.ts` `isRemoteSafeJsonValue` —
 * null / boolean / string / finite number / plain array / plain object;
 * class instances, Date, Map/Set, undefined, NaN, Infinity, functions,
 * symbols are NOT lossless JSON). This is a PRESENTATION-side integrity
 * gate only — no canonicalization, no hash (display ≠ verification).
 */
function isLosslessJsonValue(value: unknown): boolean {
  if (value === null) return true
  switch (typeof value) {
    case 'boolean':
    case 'string':
      return true
    case 'number':
      return Number.isFinite(value)
    case 'object': {
      if (Array.isArray(value)) return value.every((item) => isLosslessJsonValue(item))
      const proto = Object.getPrototypeOf(value) as unknown
      if (proto !== Object.prototype && proto !== null) return false
      return Object.entries(value as Record<string, unknown>).every(
        ([key, item]) => key.length > 0 && isLosslessJsonValue(item),
      )
    }
    default:
      return false
  }
}

/**
 * The recovery-dispatch review-payload schema id. The SHIPPED v1
 * classifier is the POSITIVE id ONLY: the `reviewPayload` is present
 * and its `schema` leaf equals this value (PROVENANCE
 * `packages/runtime/action-router/router.ts` L331 —
 * `schema: 'dsh-agent-team/recovery-dispatch/v1'`).
 *
 * ACCEPTED LIMITATION — USER OPTION A (user resolution; scope locked):
 * payload+digest-absent rows are not protocol-identifiable; the row
 * keeps its plain subject mode, disclosed. WHY it is not resolvable
 * from the client: with `reviewPayload` AND `reviewPayloadDigest` both
 * absent, recovery-requiredness is NOT identifiable from the protocol
 * fields: the `kind` vocabulary is the three generic values; the write
 * path accepts ANY non-empty actionName/correlation (service.ts
 * L1287-1294); the `recovery:` correlation prefix (router.ts L524) is
 * a producer convention, NOT a reserved contract token. Normal
 * producers ALWAYS write payload+digest together (router.ts L516-531)
 * and NO normal path strips them; with both absent the current service
 * treats the row as legacy and accepts Allow, and the post-resolve
 * execution continuation re-checks ONLY the decision value, the frozen
 * invocation's abort signal and the terminal abandon mark before
 * invoking the frozen in-memory call (router.ts L619 decision, L645
 * abort signal, L682 terminal-abandon mark) —
 * i.e. NO integrity re-check exists for a HYPOTHETICAL payload-less
 * recovery row; there is NO demonstrated authorization bypass and NO
 * normal producer path that creates one.
 * Option B (a protocol marker + pre-execution integrity check) is
 * DEFERRED to Alpha3 — nothing B-shaped ships here (no protocol
 * fields); GREEN pins of the accepted A behavior live in the PR #56
 * specs (labelled ACCEPTED LIMITATION — USER OPTION A).
 * UNKNOWN #2 (deferred; NOT implemented): the
 * template/team-subject absent-payload producer-invariant option
 * (coordinator's B/C options).
 */
const RECOVERY_DISPATCH_V1_SCHEMA = 'dsh-agent-team/recovery-dispatch/v1'

/**
 * The recovery-dispatch/v1 digest SHAPE (the router recipe
 * `sha256:${sha256Hex(canonicalJsonStringify(payload))}`,
 * router.ts L530). SHAPE validation ONLY — the client has no
 * canonicalization / hash; a shape-valid digest is NOT a verified
 * digest (display ≠ verification).
 */
const SHA256_DIGEST_SHAPE = /^sha256:[0-9a-f]{64}$/

/** The closed canonical subject map (`packages/runtime/control/types.ts` L256-259). */
const SUBJECT_ID_LEAF: Readonly<Record<TeamUiControlSubject['kind'], string>> = {
  instance: 'instanceId',
  template: 'templateId',
  team: 'rootSessionId',
}

/**
 * The fail-safe read of the durable `ControlSubject` over the CLOSED
 * canonical map (`instance→instanceId | template→templateId |
 * team→rootSessionId`, `packages/runtime/control/types.ts` L256-259).
 * STRICT, mirroring the backend `parseSubject` (service.ts L436-462):
 * the kind's OWN non-empty id leaf must be present AND the OTHER two
 * kind leaves must be ABSENT — a contradictory shape (e.g.
 * `template` + an extra `instanceId`) is malformed input and yields
 * `undefined` (the caller decides legacy-compat vs unsupported — NEVER
 * a trusted pick, frozen batch #2 of PR #56; the server rejects such
 * rows at WRITE time, this is the display-side fail-closed mirror).
 */
function readControlSubject(payload: Payload): TeamUiControlSubject | undefined {
  const raw = payload['subject']
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const record = raw as Payload
  const kind = record['kind']
  if (kind !== 'instance' && kind !== 'template' && kind !== 'team') return undefined
  const id = str(record, SUBJECT_ID_LEAF[kind])
  if (id === undefined || id.length === 0) return undefined
  for (const leaf of Object.values(SUBJECT_ID_LEAF)) {
    if (leaf !== SUBJECT_ID_LEAF[kind] && record[leaf] !== undefined) return undefined
  }
  return { kind, id }
}

/** The fail-safe raw `subject.kind` leaf for the unsupported presentation. */
function rawSubjectKind(payload: Payload): string {
  const raw = payload['subject']
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return 'absent'
  const kind = (raw as Payload)['kind']
  return typeof kind === 'string' && kind.length > 0 ? kind : 'absent'
}

/** Mutable internal draft of one control chain (pairing pass). */
interface ControlDraft {
  requestId: string
  requestSequence: number
  targetInstanceId?: string
  actionName: string
  requestedAt: string
  pending: boolean
  kind?: string
  toolName?: string
  capabilityDomain?: string
  summary?: string
  requesterId?: string
  requesterRefKind?: 'instance' | 'human'
  subject?: TeamUiControlSubject
  subjectKindRaw?: string
  /** Verbatim durable logical correlation (display passthrough only —
   *  NOT a classifier: the `recovery:` prefix heuristic was rejected). */
  correlation?: string
  renderMode?: TeamUiControlRenderMode
  reviewIntegrity?: 'reviewable' | 'incomplete'
  reviewPayload?: RemoteSafeJsonValue
  reviewPayloadDigest?: string
  abandoned?: boolean
  decision?: {
    value: string
    sequence: number
    decidedAt: string
    reason?: string
    note?: string
  }
}

/** Mutable internal draft of one activity interval (pairing pass). */
interface IntervalDraft {
  correlation: string
  instanceId: string
  openedAt: string
  openedSequence: number
  isOpen: boolean
  subject?: string
  note?: string
  closedAt?: string
  closedSequence?: number
  closeNote?: string
}

/** Fail-safe string leaf read (`undefined` for any non-string / absent). */
function str(payload: Payload, key: string): string | undefined {
  const value = payload[key]
  return typeof value === 'string' ? value : undefined
}

/** Fail-safe integer leaf read (`undefined` for any non-integer / absent). */
function num(payload: Payload, key: string): number | undefined {
  const value = payload[key]
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined
}

/** The closed progress vocabulary check (fail-safe; absent → undefined). */
function progressOf(value: unknown): ProgressValue | undefined {
  return value === 'in-progress' || value === 'completed' || value === 'blocked' ? value : undefined
}

/** One raw entry → the row (skips the entries whose identity leaves are broken). */
function adaptEntry(entry: RemoteLedgerEntryValue): TeamUiLedgerRow | undefined {
  if (!Number.isInteger(entry.sequence)) return undefined
  if (typeof entry.factType !== 'string') return undefined
  const category = FACT_TYPE_CATEGORY[entry.factType]
  return {
    sequence: entry.sequence,
    factType: entry.factType,
    ...(category === undefined ? {} : { category }),
    rootSessionId: entry.rootSessionId,
    operationId: entry.operationId,
    createdAt: entry.createdAt,
    payload: (entry.payload ?? {}) as Payload,
  }
}

/**
 * The display-side review-integrity verdict of one control request
 * (boundary 3, client display side only — the backend authority is
 * untouched):
 *  - recovery-dispatch/v1 (positive id): `reviewable` iff a LOSSLESS
 *    `reviewPayload` was present AND the wire carries a SHAPE-valid
 *    `reviewPayloadDigest`; a missing/corrupted payload or an
 *    invalid/absent digest → `incomplete` (the panel shows the
 *    explicit "cannot fully review" state and disables Allow;
 *    deny/close keep their safe semantics);
 *  - DEFENSE-IN-DEPTH (any other defined row): a `reviewPayloadDigest`
 *    leaf present while NO lossless `reviewPayload` is carried on the
 *    line → `incomplete` — a digest pointing at a payload the ledger
 *    does not carry cannot be reviewed. CURRENT BACKEND CANNOT PRODUCE
 *    this shape (the write path rejects: service.ts L1369-1374; the
 *    read path drops the line: L654-656) — this rule is a display-side
 *    guard against corrupt/hand-built durable data ONLY, and claims
 *    NOTHING about the row being recovery-v1 (the classification gap
 *    stays a DECLARED UNKNOWN — see RECOVERY_DISPATCH_V1_SCHEMA).
 * `undefined` = no integrity claim (plain/legacy rows, untouched).
 * SHAPE check only — the client ships no canonicalization / hash
 * (display ≠ verification).
 */
function controlReviewIntegrity(
  recoveryV1: boolean,
  reviewPayload: RemoteSafeJsonValue | undefined,
  reviewPayloadDigest: string | undefined,
): 'reviewable' | 'incomplete' | undefined {
  if (recoveryV1) {
    if (reviewPayload === undefined) return 'incomplete'
    if (reviewPayloadDigest === undefined || SHA256_DIGEST_SHAPE.test(reviewPayloadDigest) === false) {
      return 'incomplete'
    }
    return 'reviewable'
  }
  if (reviewPayload === undefined && reviewPayloadDigest !== undefined) return 'incomplete'
  return undefined
}

/** One `control-request-recorded` fact → the draft (skipped only when the
 *  REQUEST identity leaves (requestId / actionName) are broken — an
 *  unknown subject stays visible as `unsupported-subject`, PR #56). */
function adaptControlRequestDraft(
  entry: RemoteLedgerEntryValue,
  payload: Payload,
): ControlDraft | undefined {
  const requestId = str(payload, 'requestId')
  const actionName = str(payload, 'actionName')
  if (requestId === undefined || actionName === undefined) return undefined
  // PR #56 — the durable SUBJECT (the pre-fix drop point: the old gate
  // also required `targetInstanceId`, silently dropping every
  // `template` / `team` subject — the S9 `template:worker` production
  // case; `service.ts` L1490-1492 only ever writes it for the instance
  // subject).
  const subject = readControlSubject(payload)
  const legacyTarget = str(payload, 'targetInstanceId')
  let subjectState: 'defined' | 'legacy-instance' | 'unsupported'
  if (subject !== undefined) {
    // A PR-D row carries BOTH leaves ONLY for a matching instance
    // subject; any other combination is contradictory input → fail
    // closed, never a trusted pick (frozen batch #2 of PR #56 — the
    // backend rejects a targetInstanceId that disagrees with / stands
    // outside an instance subject, service.ts L610-616).
    subjectState = subject.kind === 'instance'
      ? (legacyTarget !== undefined && legacyTarget !== subject.id ? 'unsupported' : 'defined')
      : legacyTarget !== undefined
        ? 'unsupported'
        : 'defined'
  } else if (payload['subject'] === undefined && legacyTarget !== undefined && legacyTarget.length > 0) {
    // LEGACY history row (no `subject` leaf): the instance-only flow
    // (`types.ts`: ABSENT execution fields = legacy semantics, the
    // instance-only guarded flow) — the leaf is the instance id
    // verbatim, explicitly labeled compat.
    subjectState = 'legacy-instance'
  } else {
    subjectState = 'unsupported'
  }
  // The review payload + the FULL wire digest, verbatim (boundary 2).
  // A present-but-NON-LOSSLESS payload is malformed at the service
  // boundary → OMITTED (never rendered, never guessed; the durable
  // display contract `packages/runtime/control/types.ts` L406-425).
  const rawReviewPayload: RemoteSafeJsonValue | undefined = payload['reviewPayload']
  const reviewPayload = rawReviewPayload !== undefined && isLosslessJsonValue(rawReviewPayload)
    ? rawReviewPayload
    : undefined
  const reviewPayloadDigest = str(payload, 'reviewPayloadDigest')
  // recovery-dispatch/v1 classification (display side): the SHIPPED
  // classifier is the payload `schema` leaf POSITIVE ID ONLY (router.ts
  // L331). The `recovery:` correlation-prefix fallback (router.ts L524)
  // is NOT shipped — ACCEPTED LIMITATION, USER OPTION A (locked): with
  // payload+digest both absent the row is not protocol-identifiable; it
  // keeps its plain subject mode with NO integrity gate, disclosed (see
  // RECOVERY_DISPATCH_V1_SCHEMA; green pins in the PR #56 specs).
  // Option B (protocol marker + pre-execution integrity check) is
  // DEFERRED to Alpha3 — nothing B-shaped here. The DEFENSE-IN-DEPTH
  // digest-without-payload guard below is classification-NEUTRAL.
  // NOTE (frozen batch #1): `typeof null === 'object'`, and null is a
  // LEGAL RemoteSafeJsonValue — the null check below is load-bearing:
  // without it the schema read indexes into null and the WHOLE TeamView
  // crashes on a legal non-recovery row.
  const schemaId =
    rawReviewPayload !== undefined && rawReviewPayload !== null
      && typeof rawReviewPayload === 'object' && !Array.isArray(rawReviewPayload)
      ? str(rawReviewPayload as Payload, 'schema')
      : undefined
  const correlation = str(payload, 'correlation')
  const recoveryV1 = schemaId === RECOVERY_DISPATCH_V1_SCHEMA
  // PR #56 boundary 3 — the display-side integrity verdict (v1 rules +
  // the DEFENSE-IN-DEPTH digest-without-payload guard; undefined = no
  // integrity claim on the row at all).
  const reviewIntegrity = controlReviewIntegrity(recoveryV1, reviewPayload, reviewPayloadDigest)
  const renderMode: TeamUiControlRenderMode =
    subjectState === 'unsupported'
      ? 'unsupported-subject'
      : recoveryV1 === true
        ? 'recovery-v1'
        : subjectState === 'legacy-instance'
          ? 'legacy-compat'
          : 'standard'
  // F9U (UI §26.2 "requester"): the durable `ControlCallerRef` ref —
  // fail-safe leaf reads (a malformed ref is ABSENT, never invented).
  const requester = payload['requester']
  let requesterId: string | undefined
  let requesterRefKind: 'instance' | 'human' | undefined
  if (typeof requester === 'object' && requester !== null) {
    const ref = requester as Payload
    if (ref['kind'] === 'instance') {
      requesterId = str(ref, 'instanceId')
      if (requesterId !== undefined) requesterRefKind = 'instance'
    } else if (ref['kind'] === 'human') {
      requesterId = str(ref, 'humanId')
      if (requesterId !== undefined) requesterRefKind = 'human'
    }
  }
  return {
    requestId,
    requestSequence: entry.sequence,
    // The subject-DERIVED instance identity only — never fabricated
    // for a non-instance / unsupported subject (PR #56).
    ...(subjectState === 'defined' && subject !== undefined && subject.kind === 'instance'
      ? { targetInstanceId: subject.id }
      : subjectState === 'legacy-instance' && legacyTarget !== undefined
        ? { targetInstanceId: legacyTarget }
        : {}),
    ...(subjectState === 'unsupported'
      ? { subjectKindRaw: rawSubjectKind(payload) }
      : { subject: subject ?? { kind: 'instance' as const, id: legacyTarget ?? '' } }),
    ...(correlation === undefined ? {} : { correlation }),
    renderMode,
    ...(reviewIntegrity === undefined ? {} : { reviewIntegrity }),
    ...(reviewPayload === undefined ? {} : { reviewPayload }),
    ...(reviewPayloadDigest === undefined ? {} : { reviewPayloadDigest }),
    actionName,
    requestedAt: entry.createdAt,
    pending: true,
    kind: str(payload, 'kind'),
    toolName: str(payload, 'toolName'),
    capabilityDomain: str(payload, 'capabilityDomain'),
    summary: str(payload, 'summary'),
    ...(requesterId === undefined ? {} : { requesterId }),
    ...(requesterRefKind === undefined ? {} : { requesterRefKind }),
  }
}

/**
 * Pair one `control-decision-recorded` fact onto its request draft
 * (join key: the frozen `requestId`). An orphan decision (no loaded
 * request fact) becomes a draft only when the writer's own `scope`
 * names the target + action + request sequence — no invented values;
 * otherwise it is skipped.
 */
function adaptControlDecisionDraft(
  entry: RemoteLedgerEntryValue,
  payload: Payload,
  requests: Map<string, ControlDraft>,
  orphans: ControlDraft[],
): void {
  const requestId = str(payload, 'requestId')
  const decision = str(payload, 'decision')
  if (requestId === undefined || decision === undefined) return
  const target = payload['scope']
  const scope: Payload | undefined =
    typeof target === 'object' && target !== null ? (target as Payload) : undefined
  const reason = str(payload, 'reason')
  const note = str(payload, 'note')
  const block = {
    value: decision,
    sequence: entry.sequence,
    decidedAt: entry.createdAt,
    ...(reason === undefined ? {} : { reason }),
    ...(note === undefined ? {} : { note }),
  }
  const request = requests.get(requestId)
  if (request !== undefined) {
    request.pending = false
    request.decision = block
    return
  }
  // ORPHAN (no loaded request fact): the writer's own `scope` names the
  // identity — the PR-D scope carries the durable `subject`
  // (`service.ts` `scopeOf` L1075-1078), the LEGACY scope names
  // `targetInstanceId` (instance-only flow, only when the `subject`
  // leaf is ABSENT). Either way: no invented values; a scope naming
  // neither → still skipped. Frozen batch #2 of PR #56: an EXPLICIT
  // but malformed `scope.subject` is NOT the legacy flow — fail closed
  // to an unsupported chain (visible, non-decidable), never a silent
  // fallback onto the legacy leaf.
  const scopeSubject = scope === undefined ? undefined : readControlSubject(scope)
  const scopeSubjectPresent = scope !== undefined && scope['subject'] !== undefined
  const targetInstanceId = scope === undefined ? undefined : str(scope, 'targetInstanceId')
  const actionName = scope === undefined ? undefined : str(scope, 'actionName')
  const requestSequence = num(payload, 'requestSequence')
  if (actionName === undefined || requestSequence === undefined) return
  if (scopeSubject === undefined && scopeSubjectPresent && scope !== undefined) {
    orphans.push({
      requestId,
      requestSequence,
      subjectKindRaw: rawSubjectKind(scope),
      actionName,
      requestedAt: entry.createdAt,
      pending: false,
      renderMode: 'unsupported-subject',
      toolName: str(scope, 'toolName'),
      decision: block,
    })
    return
  }
  if (scopeSubject === undefined && (targetInstanceId === undefined || targetInstanceId.length === 0)) return
  orphans.push({
    requestId,
    requestSequence,
    ...(scopeSubject !== undefined
      ? scopeSubject.kind === 'instance'
        ? { subject: scopeSubject, targetInstanceId: scopeSubject.id }
        : { subject: scopeSubject }
      : { subject: { kind: 'instance' as const, id: targetInstanceId ?? '' }, targetInstanceId }),
    actionName,
    requestedAt: entry.createdAt,
    pending: false,
    renderMode: scopeSubject !== undefined ? 'standard' : 'legacy-compat',
    toolName: scope === undefined ? undefined : str(scope, 'toolName'),
    decision: block,
  })
}

/**
 * Pair one terminal `control-request-abandoned` fact (the inline-flow
 * additive close, `packages/runtime/control/service.ts` L34-41 — the
 * append-only ledger has NO delete; the abandon fact IS the close) onto
 * its request draft. Join key: the frozen `requestId` ONLY (the abandon
 * payload `{requestId, rootSessionId, abandonedAt, reason?}` carries NO
 * subject leaf — service.ts L355-360).
 *
 * COORDINATOR-RULED (PR #56): UNIFORM across all subject kinds — once a
 * durable abandon exists for the requestId, the chain NEVER displays
 * pending and NEVER offers Allow (instance AND template AND team
 * identically): the abandon fact is the TERMINAL mark and wins over a
 * concurrent decision (`packages/runtime/control/types.ts` L434-439;
 * `errors.ts` L71/L140 abandonment = terminal). The recorded decision
 * block (when the ledger also carries one) stays on the chain verbatim
 * — facts are never rewritten, only the derived display closes.
 * No request draft loaded → nothing to pair (no invented chain).
 */
function adaptControlAbandonDraft(
  entry: RemoteLedgerEntryValue,
  payload: Payload,
  requests: Map<string, ControlDraft>,
): void {
  const requestId = str(payload, 'requestId')
  if (requestId === undefined) return
  const request = requests.get(requestId)
  if (request === undefined) return
  request.pending = false
  request.abandoned = true
}

/** One `team-message-delivered` fact → the row (recipient pair only — no invented sender). */
function adaptDeliveredMessage(
  entry: RemoteLedgerEntryValue,
  payload: Payload,
): TeamUiMessageRow | undefined {
  const subject = str(payload, 'subject')
  const to = str(payload, 'recipientInstanceId') ?? str(payload, 'deliveredToInstanceId')
  if (subject === undefined || to === undefined) return undefined
  return { sequence: entry.sequence, kind: 'delivered', to, subject, at: entry.createdAt }
}

/** One `team-coordination-recorded` fact → the row (only `send-message` actions are message rows). */
function adaptCoordinationMessage(
  entry: RemoteLedgerEntryValue,
  payload: Payload,
): TeamUiMessageRow | undefined {
  if (str(payload, 'action') !== 'send-message') return undefined
  const subject = str(payload, 'subject')
  const to = str(payload, 'targetInstanceId') ?? str(payload, 'recipientInstanceId')
  if (subject === undefined || to === undefined) return undefined
  const from = str(payload, 'caller')
  return {
    sequence: entry.sequence,
    kind: 'coordination',
    ...(from === undefined ? {} : { from }),
    to,
    subject,
    at: entry.createdAt,
  }
}

/** One `activity-interval-opened` fact → the draft (correlation + instance are required). */
function adaptIntervalOpenDraft(
  entry: RemoteLedgerEntryValue,
  payload: Payload,
): IntervalDraft | undefined {
  const correlation = str(payload, 'correlation')
  const instanceId = str(payload, 'instanceId')
  if (correlation === undefined || instanceId === undefined) return undefined
  return {
    correlation,
    instanceId,
    openedAt: entry.createdAt,
    openedSequence: entry.sequence,
    isOpen: true,
    subject: str(payload, 'subject'),
    note: str(payload, 'note'),
  }
}

/** Pair one `activity-interval-closed` fact onto its open draft (join key: `correlation`). */
function adaptIntervalCloseDraft(
  entry: RemoteLedgerEntryValue,
  payload: Payload,
  opens: Map<string, IntervalDraft>,
): void {
  const correlation = str(payload, 'correlation')
  if (correlation === undefined) return
  const open = opens.get(correlation)
  if (open === undefined) return // close without a loaded open: no invented interval
  if (open.isOpen === false) return // a second close is an anomaly: the first stands
  open.isOpen = false
  open.closedAt = entry.createdAt
  open.closedSequence = entry.sequence
  const closeNote = str(payload, 'closeNote') ?? str(payload, 'note')
  if (closeNote !== undefined) open.closeNote = closeNote
}

/** One `activity-progress-recorded` fact → the historical work row (complete-ledger only). */
function adaptProgressRow(
  entry: RemoteLedgerEntryValue,
  payload: Payload,
): TeamUiProgressRow | undefined {
  const instanceId = str(payload, 'instanceId')
  const subject = str(payload, 'subject')
  const progress = progressOf(payload['progress'])
  if (instanceId === undefined || subject === undefined || progress === undefined) return undefined
  return {
    sequence: entry.sequence,
    instanceId,
    subject,
    progress,
    at: entry.createdAt,
    summary: str(payload, 'summary'),
    lastAction: str(payload, 'lastAction'),
    correlation: str(payload, 'correlation'),
  }
}

/**
 * Adapt the loaded ledger entries to the durable-ledger model (pure;
 * deterministic for one entry set + completeness).
 *
 * @param entries - the store's merged, sequence-ordered loaded entries
 *   (the adapter re-sorts defensively; the store is the order authority).
 * @param complete - the store's completeness verdict
 *   (`total !== null && loadedUniqueEntryCount >= total` — a count-domain
 *   rule per INV-9.2: the loaded unique count, never the sequence
 *   frontier); the authority for the `progress` /
 *   `pendingControlByInstance` gates.
 */
export function adaptTeamLedger(
  entries: readonly RemoteLedgerEntryValue[],
  complete: boolean,
): TeamUiLedgerModel {
  const ordered = [...entries].sort((a, b) => a.sequence - b.sequence)

  const rows: TeamUiLedgerRow[] = []
  const requests = new Map<string, ControlDraft>()
  const orphans: ControlDraft[] = []
  const messages: TeamUiMessageRow[] = []
  const opens = new Map<string, IntervalDraft>()
  const progressRows: TeamUiProgressRow[] = []

  for (const entry of ordered) {
    const row = adaptEntry(entry)
    if (row !== undefined) rows.push(row)
    const payload: Payload = (entry.payload ?? {}) as Payload
    switch (entry.factType) {
      case 'control-request-recorded': {
        const draft = adaptControlRequestDraft(entry, payload)
        if (draft !== undefined && requests.has(draft.requestId) === false) requests.set(draft.requestId, draft)
        break
      }
      case 'control-decision-recorded':
        adaptControlDecisionDraft(entry, payload, requests, orphans)
        break
      case 'control-request-abandoned':
        adaptControlAbandonDraft(entry, payload, requests)
        break
      case 'team-message-delivered': {
        const message = adaptDeliveredMessage(entry, payload)
        if (message !== undefined) messages.push(message)
        break
      }
      case 'team-coordination-recorded': {
        const message = adaptCoordinationMessage(entry, payload)
        if (message !== undefined) messages.push(message)
        break
      }
      case 'activity-interval-opened': {
        const draft = adaptIntervalOpenDraft(entry, payload)
        if (draft !== undefined && opens.has(draft.correlation) === false) opens.set(draft.correlation, draft)
        break
      }
      case 'activity-interval-closed':
        adaptIntervalCloseDraft(entry, payload, opens)
        break
      case 'activity-progress-recorded': {
        const rowFact = adaptProgressRow(entry, payload)
        if (rowFact !== undefined) progressRows.push(rowFact)
        break
      }
      default:
        break // rows-only facts (team / member / lifecycle / policy / allow-consumed)
    }
  }

  // The pairing passes are done: drafts become the readonly public rows.
  const controls: TeamUiControlChain[] = [...requests.values(), ...orphans]
    .sort((a, b) => a.requestSequence - b.requestSequence)
    .map(draft => draft)
  const intervals: TeamUiActivityIntervalRow[] = [...opens.values()]
    .sort((a, b) => a.openedSequence - b.openedSequence)
    .map(draft => draft)

  // §7.4 gate: historical work rows + per-instance pending counts only
  // over a KNOWN-COMPLETE ledger; a partial ledger yields neither.
  let progress: readonly TeamUiProgressRow[] = []
  let pendingControlByInstance: Readonly<Record<string, number>> = {}
  if (complete) {
    progress = progressRows
    const byInstance: Record<string, number> = {}
    for (const chain of controls) {
      if (chain.pending === false) continue
      // PR #56: only an INSTANCE-subject chain badges a member instance
      // (a template / team / unsupported subject has no instance to
      // badge — instance chains keep counting byte-identically).
      if (chain.targetInstanceId === undefined) continue
      byInstance[chain.targetInstanceId] = (byInstance[chain.targetInstanceId] ?? 0) + 1
    }
    pendingControlByInstance = byInstance
  }

  return {
    completeness: complete ? 'complete' : 'partial',
    entries: rows,
    controls,
    messages,
    intervals,
    progress,
    pendingControlByInstance,
  }
}

/** The combined T4 output: the snapshot (+ §7.3 badges when complete) and the ledger model. */
export interface TeamUiState {
  readonly snapshot: TeamUiSnapshot
  readonly ledger: TeamUiLedgerModel
}

/**
 * The plan §7.1 combined pure adapter:
 * `pure(TeamProjectionDto, loaded RemoteLedgerEntryValue[])` (+ the
 * viewer perspective and the store's completeness verdict).
 *
 * The §7.3 overlay: ONLY when the ledger is known complete are the
 * snapshot member rows' `pendingControlCount` badges filled from
 * `pendingControlByInstance` (absence of a pending request is a known
 * zero, not unknown); under `partial` they stay `null`.
 */
export function adaptTeamUi(
  projection: TeamProjectionDto,
  perspective: TeamPerspective,
  entries: readonly RemoteLedgerEntryValue[],
  complete: boolean,
): TeamUiState {
  const base = adaptTeamProjection(projection, perspective)
  const ledger = adaptTeamLedger(entries, complete)
  if (complete === false) return { snapshot: base, ledger }
  const members = base.members.map(member => ({
    ...member,
    pendingControlCount: ledger.pendingControlByInstance[member.instanceId] ?? 0,
  }))
  return { snapshot: { ...base, members }, ledger }
}

/**
 * P9-T5 (S3-C) — lift one `TeamLedgerState` (the T4 store's published
 * snapshot) into the UI ledger model: the loaded entries are replayed
 * through the same pure `adaptTeamLedger`, and completeness is the
 * store's own verdict rule — known complete iff the last accepted `total`
 * is non-null and the LOADED UNIQUE ENTRY COUNT has reached it (the
 * `orderedSequences` length; INV-9.2: a count-domain rule — the
 * `completeThrough` frontier is a SEQUENCE-domain value and is never
 * compared to the total, so a shifted sequence base can never claim
 * completion early). `undefined` (no binding yet) yields the empty
 * partial model: a partial ledger clearly represented (gate G3), never a
 * claim over an unknown ledger.
 *
 * Type-only import of the store state (no runtime cycle: the store module
 * imports nothing from `model/`).
 * @param state - the store's published snapshot, or `undefined` for no binding.
 * @returns the UI ledger model over the loaded entries.
 */
export function ledgerModelFromStoreState(
  state: TeamLedgerState | undefined,
): TeamUiLedgerModel {
  if (state === undefined) return adaptTeamLedger([], false)
  const entries: RemoteLedgerEntryValue[] = []
  for (const sequence of state.orderedSequences) {
    const entry = state.entriesBySequence.get(sequence)
    if (entry !== undefined) entries.push(entry)
  }
  const complete = state.total !== null && state.orderedSequences.length >= state.total
  return adaptTeamLedger(entries, complete)
}
