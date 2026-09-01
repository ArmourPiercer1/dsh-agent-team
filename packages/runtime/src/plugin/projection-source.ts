/**
 * P8-S5 Production Projection Source — the durable TeamDomain read port
 * (the P8-T2 port contract, TaskDoc §11.9; production composition P8-S5).
 *
 * {@link createTeamDomainReadPort} adapts a REAL open `TeamDomain`
 * (invariant 41 — the durable sidecar authority) to the P8-T2
 * `TeamDomainReadPort`, the bounded source the projection fold consumes:
 *
 * ```text
 * teamSessionId
 *   → teamSessions.get(rootSessionId)        (the TeamSession row — identity core)
 *   → memberInstances.list(rootSessionId)    (the MemberInstance rows)
 *   → compatibility.get(rootSessionId)       (the CompatibilityStateRecord)
 *   → ledger.list() (root-filtered)          (the TeamLedger entries)
 *   → TeamDomainProjectionSource
 * ```
 *
 * The read surface is exactly those four repositories: the port NEVER scans
 * `Root + child Session logs` (P8-T2 — the projection's complexity is
 * independent of child Session log volume), never writes, never touches the
 * (ephemeral) SessionController Team mirror, and takes no clock (the source
 * is durable; the fold stamps the produced-at time).
 *
 * Fail-closed surface (the closed code object
 * `TEAM_DOMAIN_READ_PORT_ERROR_CODES`; every thrown Error carries its code
 * verbatim in the message — the P8-T2 service does not wrap port errors, so
 * the plain Errors propagate to its caller):
 *
 * - `TEAM_PROJECTION_SOURCE_TEAM_SESSION_ABSENT` — the provided domain
 *   carries no durable `team_sessions` row under the TeamSession id;
 * - `TEAM_PROJECTION_SOURCE_TEMPLATES_UNAVAILABLE` — the bound blueprint
 *   snapshot's template content is not durably readable through this port
 *   (the v1 TeamSessionRecord freezes the identity core only and this port
 *   has no catalog read surface). S6 installs the catalog-backed source and
 *   replaces this throw. Inventing template rows from the member rows'
 *   `templateId`s is the silent weakening this port refuses;
 * - `TEAM_PROJECTION_SOURCE_POLICY_STATE_UNAVAILABLE` — no policy state is
 *   durably carried. Checked surfaces (documented derivation): the v1
 *   TeamSessionRecord field set (identity core only — "Category A's
 *   remaining fields (PolicyState, ...) are added by later versions") and
 *   the CompatibilityStateRecord field set (status, fingerprint, probe
 *   generation, outcome counts, acknowledgements — no policy state); no
 *   production TeamLedger fact family records a policy state, and the
 *   operation journal's production intents are provisioning-only. A silent
 *   `'active'` default is forbidden by the P8-S5 contract;
 * - `TEAM_PROJECTION_SOURCE_LEDGER_CATEGORY_UNKNOWN` — a durable ledger
 *   fact type with no mapping to the eight frozen ledger categories. The
 *   frozen contract invariant `totalEntries == sum(byCategory)` makes a
 *   silent misclassification data fabrication, so the read fails instead;
 * - `TEAM_PROJECTION_SOURCE_ADMISSION_STATE_INVALID` — a durable
 *   compatibility status outside the frozen four-state admission vocabulary.
 *   Unreachable for a storage-validated record (the repository parser
 *   rejects any other status on read); the port fails closed on drift
 *   anyway and never maps an unknown state silently.
 *
 * What S6 replaces / extends: the catalog-backed template source (replacing
 * the TEMPLATES throw) and the durable policy state (a later record version
 * with its owning task, or the S6 catalog-backed source; replacing the
 * POLICY_STATE throw). The live half of the P8-T2 service — the
 * `LiveResidencyOverlayPort` seam — is NOT part of this port; this adapter
 * is the durable half only.
 *
 * Pure module: no I/O beyond the repository reads, no DSH imports, no
 * `node:` builtin imports.
 * @module @dsh-agent-team/runtime/plugin/projection-source
 */

import {
  ADMISSION_STATES,
  EFFECTIVE_CONFIG_SOURCES,
  EFFECTIVE_CONFIG_STATES,
  MEMBER_LIFECYCLE_STATES,
  isAdmissionState,
} from '../../../contracts/src/index.js'
import type {
  AdmissionState,
  CompatibilitySummaryDto,
  ContextPolicy,
  EffectiveConfigDto,
  EffectiveConfigEntry,
  LedgerCategoryCounts,
  LeaderInstanceRecordDto,
  MemberInstanceRecordDto,
  RemoteSafeRecord,
  TeamSessionId,
} from '../../../contracts/src/index.js'
import { DEFAULT_CONTEXT_POLICY } from '../../../domain/member/src/index.js'
import type {
  DurableLedgerSummary,
  DurableMemberRow,
  DurableTemplateRow,
  TeamDomainProjectionSource,
  TeamDomainReadPort,
  TeamRootFacts,
} from '../../projection/index.js'
import type { TeamDomain, TeamDomainRepositories } from '../../../storage/repositories/index.js'
import type { CompatibilityStateRecord, LedgerEntry } from '../../../storage/schema/index.js'

/**
 * The closed error-code vocabulary of the production read port (see the
 * module docs for the fail-closed conditions each code names).
 */
export const TEAM_DOMAIN_READ_PORT_ERROR_CODES = {
  /** The durable domain carries no `team_sessions` row for the TeamSession id. */
  TEAM_SESSION_ABSENT: 'TEAM_PROJECTION_SOURCE_TEAM_SESSION_ABSENT',
  /** The bound snapshot's template content is not durably readable through this port (S6 supplies the catalog-backed source). */
  TEMPLATES_UNAVAILABLE: 'TEAM_PROJECTION_SOURCE_TEMPLATES_UNAVAILABLE',
  /** No policy state is durably carried by the v1 record surfaces. */
  POLICY_STATE_UNAVAILABLE: 'TEAM_PROJECTION_SOURCE_POLICY_STATE_UNAVAILABLE',
  /** A durable ledger fact type with no mapping to the eight frozen categories. */
  LEDGER_CATEGORY_UNKNOWN: 'TEAM_PROJECTION_SOURCE_LEDGER_CATEGORY_UNKNOWN',
  /** A durable compatibility status outside the frozen admission vocabulary. */
  ADMISSION_STATE_INVALID: 'TEAM_PROJECTION_SOURCE_ADMISSION_STATE_INVALID',
} as const

/** One of the closed read-port error codes. */
export type TeamDomainReadPortErrorCode =
  (typeof TEAM_DOMAIN_READ_PORT_ERROR_CODES)[keyof typeof TEAM_DOMAIN_READ_PORT_ERROR_CODES]

// --- durable fact-type vocabulary (the closed production writers) --------------
//
// The exact fact types the production code writes to the TeamLedger, each
// with its producing module (the constants live in those modules — several
// are module-private — so the closed table is declared here once):
//
//   'team-work-admitted'            action-router (work-execution / effects) → team
//   'provision-member-instance'     storage/operations journal (the ONLY
//                                   production operation intent;
//                                   storage/provisioning coordinator)        → member
//   'member-lifecycle-changed'      action-router (work-execution / effects) → lifecycle
//   'team-message-delivered'        runtime/messaging coordinator            → message
//   'team-coordination-recorded'    runtime/messaging + action-router effects → message
//   'control-request-recorded'      runtime/control service                  → control
//   'control-decision-recorded'     runtime/control service                  → control
//   'control-allow-consumed'        runtime/control service                  → control
//   'activity-progress-recorded'    runtime/activity ledger                  → progress
//   'activity-interval-opened'      runtime/activity ledger                  → progress
//   'activity-interval-closed'      runtime/activity ledger                  → progress
//
// The `policy` and `compatibility` categories have no production writer in
// v1 (the compatibility state is its own store and never passes through a
// ledger fact; the policy state has no durable fact family yet). Their
// counts stay 0 until a writing task lands — at which point its fact type
// MUST be added to this table or the read fails closed with
// LEDGER_CATEGORY_UNKNOWN.

const FACT_TEAM_WORK_ADMITTED = 'team-work-admitted'
const FACT_PROVISION_MEMBER_INSTANCE = 'provision-member-instance'
const FACT_MEMBER_LIFECYCLE_CHANGED = 'member-lifecycle-changed'
const FACT_TEAM_MESSAGE_DELIVERED = 'team-message-delivered'
const FACT_TEAM_COORDINATION_RECORDED = 'team-coordination-recorded'
const FACT_CONTROL_REQUEST_RECORDED = 'control-request-recorded'
const FACT_CONTROL_DECISION_RECORDED = 'control-decision-recorded'
const FACT_CONTROL_ALLOW_CONSUMED = 'control-allow-consumed'
const FACT_ACTIVITY_PROGRESS_RECORDED = 'activity-progress-recorded'
const FACT_ACTIVITY_INTERVAL_OPENED = 'activity-interval-opened'
const FACT_ACTIVITY_INTERVAL_CLOSED = 'activity-interval-closed'

/** The closed fact-type → frozen-category map (see the vocabulary above). */
const FACT_TYPE_CATEGORY: ReadonlyMap<string, keyof LedgerCategoryCounts> = new Map([
  [FACT_TEAM_WORK_ADMITTED, 'team'],
  [FACT_PROVISION_MEMBER_INSTANCE, 'member'],
  [FACT_MEMBER_LIFECYCLE_CHANGED, 'lifecycle'],
  [FACT_TEAM_MESSAGE_DELIVERED, 'message'],
  [FACT_TEAM_COORDINATION_RECORDED, 'message'],
  [FACT_CONTROL_REQUEST_RECORDED, 'control'],
  [FACT_CONTROL_DECISION_RECORDED, 'control'],
  [FACT_CONTROL_ALLOW_CONSUMED, 'control'],
  [FACT_ACTIVITY_PROGRESS_RECORDED, 'progress'],
  [FACT_ACTIVITY_INTERVAL_OPENED, 'progress'],
  [FACT_ACTIVITY_INTERVAL_CLOSED, 'progress'],
])

// --- structurally valid empty views (never fabricated values) ------------------

/**
 * The one unresolved effective-config entry: `value: null` (a lane the
 * factor produced no value for — the key is REQUIRED, never absent), source
 * `blueprint` (the inherited lane is the only source the durable rows alone
 * can name), state `unavailable` ("source not resolvable"). The v1
 * MemberInstance record carries no effective-config content, and resolving
 * the lanes (blueprint content, policy state, autonomy overlay) needs the
 * catalog / snapshot access this port deliberately does not have. `parseEffectiveConfigDto`
 * accepts the view below as contractually valid.
 */
const UNRESOLVED_EFFECTIVE_CONFIG_ENTRY: EffectiveConfigEntry = {
  value: null,
  source: EFFECTIVE_CONFIG_SOURCES.blueprint,
  state: EFFECTIVE_CONFIG_STATES.unavailable,
}

/**
 * The structurally valid EMPTY effective-config view: all four frozen lanes
 * present with unresolved entries, `permissions` an empty map (explicitly
 * allowed — "the map may be empty"). Fabricating values is forbidden; the
 * honest empty view keeps the fold contractually valid until the S6
 * catalog-backed source resolves the lanes.
 */
const EMPTY_EFFECTIVE_CONFIG: EffectiveConfigDto = {
  model: UNRESOLVED_EFFECTIVE_CONFIG_ENTRY,
  workspace: UNRESOLVED_EFFECTIVE_CONFIG_ENTRY,
  permissions: {},
  autonomy: UNRESOLVED_EFFECTIVE_CONFIG_ENTRY,
}

/**
 * The fingerprint sentinel for a summary field the port cannot durably
 * resolve: `parseCompatibilitySummary` rejects the empty string (opaque
 * fields must be non-empty, no control chars, ≤ 128 chars), so the summary
 * carries the literal `'none'` — "not resolvable through this port" — until
 * the S6 catalog-backed source resolves the real value.
 */
const UNRESOLVED_FINGERPRINT = 'none'

// --- the factory ----------------------------------------------------------------

/**
 * Adapt a real open `TeamDomain` to the P8-T2 `TeamDomainReadPort`.
 *
 * The adapter is a closure over the given domain's repositories: one
 * `readProjectionSource(teamSessionId)` performs the four bounded reads
 * (module docs) and derives the `TeamDomainProjectionSource` field by field
 * (each helper documents its derivation and its fail-closed branch). No
 * state is kept between reads — every call re-reads the durable rows
 * (invariant 45: durable state is read fresh).
 * @param domain - the open TeamDomain to read (its repositories; the port
 *   never closes it — ownership stays with the caller).
 * @returns the read port over that domain.
 */
export function createTeamDomainReadPort(domain: TeamDomain): TeamDomainReadPort {
  const repositories = domain.repositories

  function readProjectionSource(teamSessionId: TeamSessionId): TeamDomainProjectionSource {
    const root = String(teamSessionId)

    const row = repositories.teamSessions.get(root)
    if (row === undefined) {
      throw new Error(
        `${TEAM_DOMAIN_READ_PORT_ERROR_CODES.TEAM_SESSION_ABSENT}: the durable TeamDomain carries no team_sessions row for TeamSession '${root}' — there is no TeamSession to project`,
      )
    }

    // Evaluated BEFORE the root facts on purpose: the templates contract is
    // the port-level fail-closed (every v1 domain hits it), so it is the
    // first durable limitation a caller sees.
    const templates = durableTemplateRows(root)

    return {
      // --- identity core: VERBATIM from the durable v1 record --------------
      // (TeamSessionId = RootSessionId, invariant 9 — the port parameter is
      // the row's key; blueprint/defaultWorkspace/createdAt/generation are
      // copied unchanged from the stored row.)
      teamSessionId,
      blueprint: row.blueprint,
      ...(row.defaultWorkspace !== undefined ? { defaultWorkspace: row.defaultWorkspace } : {}),
      createdAt: row.createdAt,
      generation: row.generation,
      // handoffSourceSessionId: ABSENT — the v1 record carries no handoff
      // provenance (its later version adds the durable field; absence is a
      // missing key, never an own-undefined key).

      templates,
      root: rootFactsOf(root),
      members: memberRowsOf(repositories, root),
      ledger: ledgerSummaryOf(repositories, root),
    }
  }

  // --- templates (fail-closed until S6) ---------------------------------------

  function durableTemplateRows(root: string): readonly DurableTemplateRow[] {
    // Derivation check (documented per the P8-S5 contract): the v1
    // TeamSessionRecordDto's closed field set is the identity core
    // (schemaVersion, rootSessionId, blueprint, defaultWorkspace?,
    // createdAt, generation) and its validator (assertNoUnknownFields)
    // structurally rejects any template payload — the bound snapshot's
    // template rows live in the CATALOG (the blueprint snapshot store), not
    // in the TeamDomain sidecar, and this port has no catalog read surface.
    // The member rows' `templateId` fields are references, not template
    // content: deriving rows from them would invent displayName /
    // contextPolicy / quota data. S6 installs the catalog-backed source.
    throw new Error(
      `${TEAM_DOMAIN_READ_PORT_ERROR_CODES.TEMPLATES_UNAVAILABLE}: the bound blueprint snapshot content of TeamSession '${root}' is not durably readable through the TeamDomain port (a S6 catalog-backed source will supply the template rows)`,
    )
  }

  // --- root facts ---------------------------------------------------------------

  function rootFactsOf(root: string): TeamRootFacts {
    const compatibility = compatibilitySummaryOf(repositories.compatibility.get(root))
    return {
      // policyState: see policyStateOf — fail-closed (checked surfaces
      // documented there; a silent 'active' default is forbidden).
      policyState: policyStateOf(root),
      // admission: the frozen four-state vocabulary is the durable
      // compatibility status when a probe has run (the compatibility card
      // IS the admission state — one vocabulary, Architecture §28); with
      // no probe recorded yet, `OPEN` is the structurally minimal state
      // (a fresh TeamSession with no recorded mismatch). The admission
      // gate re-probes at its boundary and never trusts absence.
      admission: compatibility.status,
      compatibility,
      // creationBudgetConsumed: the v1 record carries no creation budget —
      // 0 when absent (the later record version with its owning task
      // carries the durable counter).
      creationBudgetConsumed: 0,
      // handoffSourceSessionId: ABSENT (v1 carries no handoff provenance).
    }
  }

  function policyStateOf(root: string): string {
    // Derivation check (documented per the P8-S5 contract) — which durable
    // surfaces were checked for the policy state:
    //   1. TeamSessionRecordDto (v1) — closed field set is the identity
    //      core only; the module docs state "Category A's remaining fields
    //      (PolicyState, overrides, admission state, ledger refs, handoff
    //      provenance) are added by later versions";
    //   2. CompatibilityStateRecord — status, fingerprint, generation,
    //      outcomes, acknowledgements, computedAt: a probe result, NOT a
    //      policy state;
    //   3. the TeamLedger fact families written in production (the closed
    //      vocabulary above) — no policy state fact type;
    //   4. the operation journal — the only production intent is
    //      'provision-member-instance'.
    // None carries the policy state, and inventing one (e.g. defaulting to
    // 'active') is the silent weakening this contract forbids. A later
    // record version (with its owning task) or the S6 catalog-backed source
    // supplies the durable value.
    throw new Error(
      `${TEAM_DOMAIN_READ_PORT_ERROR_CODES.POLICY_STATE_UNAVAILABLE}: no policy state is durably readable for TeamSession '${root}' through the TeamDomain port (the v1 TeamSessionRecord and CompatibilityStateRecord carry none and no production ledger fact family records one; a later record version or the S6 catalog-backed source will supply it)`,
    )
  }

  function compatibilitySummaryOf(record: CompatibilityStateRecord | undefined): CompatibilitySummaryDto {
    if (record === undefined) {
      // No probe has ever run for this root: the structurally minimal
      // summary. `lastProbedAt` is a DURABLE-optional field — the key is
      // ABSENT (never an own-undefined key) when the summary was built
      // without a probe timestamp. `probeGeneration: 1` is the honest
      // "no probe facts yet" minimum (a probe generation is a positive
      // integer; the first probe ever records generation 1). The
      // fingerprints carry the sentinel 'none' (parseOpaqueField rejects
      // the empty string).
      return {
        status: ADMISSION_STATES.OPEN,
        probeGeneration: 1,
        requirementFingerprint: UNRESOLVED_FINGERPRINT,
        environmentFingerprint: UNRESOLVED_FINGERPRINT,
        warningCount: 0,
        fatalCount: 0,
        acknowledgedWarningCount: 0,
      }
    }
    const counts = recordField(record.outcomes, 'counts')
    const warningCount = nonNegativeInt(counts?.['warning'])
    const fatalCount = nonNegativeInt(counts?.['fatal'])
    const unackedWarning = nonNegativeInt(counts?.['unackedWarning'])
    return {
      // status: the durable compatibility status — the SAME frozen
      // four-state vocabulary as the admission state (fail-closed on
      // drift via admissionStateOf).
      status: admissionStateOf(record.status, String(record.rootSessionId)),
      // probeGeneration: the durable probe generation (the storage parser
      // guarantees a positive integer).
      probeGeneration: record.generation,
      // requirementFingerprint: a property of the BOUND BLUEPRINT SNAPSHOT
      // content — the CompatibilityStateRecord carries only the
      // ENVIRONMENT fingerprint (its single `fingerprint` field). The
      // catalog-backed S6 source resolves the requirement fingerprint from
      // the snapshot; until then the sentinel documents "not resolvable
      // through this port".
      requirementFingerprint: UNRESOLVED_FINGERPRINT,
      // environmentFingerprint: verbatim from the record (the storage
      // parser guarantees a non-empty hygienic fingerprint at write time).
      environmentFingerprint: record.fingerprint,
      // warningCount / fatalCount: the probe's outcome counts (defensive
      // read — a malformed `outcomes` shape degrades to 0, mirroring the
      // probe module's own "malformed shape yields nothing, never a throw"
      // defensive reads).
      warningCount,
      fatalCount,
      // acknowledgedWarningCount: the probe records the UNACKNOWLEDGED
      // remainder (`unackedWarning`), not the acknowledged count directly —
      // acknowledged = warning − unackedWarning, clamped at 0 to preserve
      // the frozen invariant acknowledgedWarningCount <= warningCount.
      acknowledgedWarningCount: Math.max(0, warningCount - unackedWarning),
      // lastProbedAt: the record's computedAt (ISO-8601, storage-validated).
      lastProbedAt: record.computedAt,
    }
  }

  function admissionStateOf(status: string, root: string): AdmissionState {
    if (isAdmissionState(status)) {
      return status
    }
    // Unreachable for a storage-validated CompatibilityStateRecord (the
    // repository parser rejects any status outside the frozen four on
    // read) — fail closed on drift anyway; never map an unknown state.
    throw new Error(
      `${TEAM_DOMAIN_READ_PORT_ERROR_CODES.ADMISSION_STATE_INVALID}: the durable compatibility status of TeamSession '${root}' is '${status}' — outside the frozen admission vocabulary`,
    )
  }

  // --- member rows ---------------------------------------------------------------

  function memberRowsOf(
    repos: TeamDomainRepositories,
    root: string,
  ): readonly DurableMemberRow[] {
    const rows: DurableMemberRow[] = []
    for (const record of repos.memberInstances.list(root)) {
      // The repository deserializes every row through the documented type
      // lie (a v2 LeaderInstanceRecordDto can arrive under the member
      // record type — its absent `childSessionId` / `lifecycle` keys are
      // invisible to the declared type), so discriminate STRUCTURALLY at
      // runtime, never by instance id.
      const row = record as MemberInstanceRecordDto | LeaderInstanceRecordDto
      if ('childSessionId' in row) {
        // MemberInstanceRecordDto (v1 member row): childSessionId and
        // lifecycle are durable and verbatim.
        rows.push({
          instanceId: row.instanceId,
          templateId: row.templateId,
          label: row.label,
          childSessionId: row.childSessionId,
          lifecycle: row.lifecycle,
          createdAt: row.createdAt,
          contextPolicy: defaultContextPolicy(),
          effectiveConfig: EMPTY_EFFECTIVE_CONFIG,
          ...(row.groupId !== undefined ? { groupId: row.groupId } : {}),
          ...(row.workspace !== undefined ? { workspace: row.workspace } : {}),
        })
      } else {
        // LeaderInstanceRecordDto (v2 leader row): no childSessionId and NO
        // lifecycle key by construction (invariant 14 — the leader row
        // carries neither). The lifecycle is derived, not stored: the
        // leader of a live TeamSession is the admitted-active coordinator,
        // and the P8-T2 fixture `rawLeaderMember` fixes the same 'RUNNING'
        // default — `DurableMemberRow.lifecycle` is a required field, so a
        // structurally valid default (documented here) is the honest
        // derivation; the S6 overlay refines live state.
        rows.push({
          instanceId: row.instanceId,
          templateId: row.templateId,
          label: row.label,
          lifecycle: MEMBER_LIFECYCLE_STATES.RUNNING,
          createdAt: row.createdAt,
          contextPolicy: defaultContextPolicy(),
          effectiveConfig: EMPTY_EFFECTIVE_CONFIG,
          ...(row.groupId !== undefined ? { groupId: row.groupId } : {}),
          ...(row.workspace !== undefined ? { workspace: row.workspace } : {}),
        })
      }
      // activity: ABSENT for every row — the v1 record durably carries
      // only the `activityVersion` counter, not an activity summary
      // (status / subject / progress fields are live or future-durable
      // facts). Omitted rather than fabricated.
    }
    return rows
  }

  function defaultContextPolicy(): ContextPolicy {
    // Derivation check (documented per the P8-S5 contract): neither the v1
    // MemberInstanceRecordDto nor the v2 LeaderInstanceRecordDto durably
    // carries a contextPolicy field (the frozen field sets above). The
    // P8-S5 contract fixes the domain default: `persistent` (Architecture
    // §11.2 — the domain/member DEFAULT_CONTEXT_POLICY). (The G8-S1
    // stand-in derives per-template policies from the LIVE blueprint;
    // this port has no blueprint content access, so the domain default is
    // the durable fact it can honestly report.)
    return DEFAULT_CONTEXT_POLICY
  }

  // --- ledger summary --------------------------------------------------------------

  function ledgerSummaryOf(repos: TeamDomainRepositories, root: string): DurableLedgerSummary {
    // One bounded read of the whole store; the summary is PER-ROOT — a
    // shared-domain deployment may carry other teams' entries, so every
    // number below is computed over the root-filtered list (the control
    // service's loadControlState root-filters the same way).
    const entries = repos.ledger.list()
    const rootEntries: LedgerEntry[] = []
    for (const entry of entries) {
      if (String(entry.rootSessionId) === root) {
        rootEntries.push(entry)
      }
    }

    let latestSequence = 0
    for (const entry of rootEntries) {
      if (entry.sequence > latestSequence) {
        latestSequence = entry.sequence
      }
    }

    const byCategory = {
      team: 0,
      member: 0,
      lifecycle: 0,
      message: 0,
      control: 0,
      policy: 0,
      compatibility: 0,
      progress: 0,
    } satisfies LedgerCategoryCounts
    for (const entry of rootEntries) {
      const category = FACT_TYPE_CATEGORY.get(entry.factType)
      if (category === undefined) {
        throw new Error(
          `${TEAM_DOMAIN_READ_PORT_ERROR_CODES.LEDGER_CATEGORY_UNKNOWN}: ledger sequence ${entry.sequence} of TeamSession '${root}' carries fact type '${entry.factType}' with no mapping to the eight frozen ledger categories — refusing to misclassify`,
        )
      }
      byCategory[category] += 1
    }

    // pendingControlCount: the entry shape DOES distinguish pending — a
    // request fact is pending while no decision fact carries its
    // requestId (exactly the control service's loadControlState
    // derivation: a request whose requestId matches no decision is
    // 'pending'). A request fact whose payload requestId is missing or
    // non-string is EXCLUDED from the count, mirroring the control
    // service's parse guards (malformed facts are ignored, never counted).
    const decidedRequestIds = new Set<string>()
    for (const entry of rootEntries) {
      if (entry.factType !== FACT_CONTROL_DECISION_RECORDED) {
        continue
      }
      const requestId = stringField(entry.payload, 'requestId')
      if (requestId !== undefined) {
        decidedRequestIds.add(requestId)
      }
    }
    let pendingControlCount = 0
    for (const entry of rootEntries) {
      if (entry.factType !== FACT_CONTROL_REQUEST_RECORDED) {
        continue
      }
      const requestId = stringField(entry.payload, 'requestId')
      if (requestId !== undefined && !decidedRequestIds.has(requestId)) {
        pendingControlCount += 1
      }
    }

    return {
      latestSequence,
      // totalEntries: the root-filtered entry count — equal to
      // repos.ledger.entryCount() in the standard one-domain-per-team
      // deployment, and computed from the same list as `byCategory` so the
      // frozen invariant totalEntries == sum(byCategory) holds by
      // construction even under a shared-domain deployment.
      totalEntries: rootEntries.length,
      byCategory,
      pendingControlCount,
    }
  }

  return { readProjectionSource }
}

// --- defensive read helpers (lossless-JSON payloads; malformed ≠ throw) --------

/**
 * A STRING payload field as a defensive read: `undefined` for absent,
 * null, non-string, or empty values (the ledger entry parser rejects
 * non-remote-safe JSON at write time, so a well-formed fact always has
 * string fields where the writers put them — a malformed shape degrades to
 * "absent", never a throw, mirroring the probe module's defensive reads).
 */
function stringField(record: RemoteSafeRecord | undefined, key: string): string | undefined {
  const value = record?.[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** A nested RECORD payload field as a defensive read (arrays and scalars → undefined). */
function recordField(record: RemoteSafeRecord | undefined, key: string): RemoteSafeRecord | undefined {
  const value = record?.[key]
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined
  }
  return value
}

/** A NON-NEGATIVE INTEGER outcome count as a defensive read (malformed → 0). */
function nonNegativeInt(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0
}
