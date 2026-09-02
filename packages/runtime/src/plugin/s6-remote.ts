/**
 * P8-S6 A31 + A33 + A34 — the production remote-handler registration, the
 * ledger-page pagination completion, and the production dispatcher of the
 * Remote contract v1 (plan §20; closes CR-12 together with A30/A32).
 *
 * The frozen `packages/remote` library ships a SYNCHRONOUS dispatcher and
 * twelve synchronous ports (its design note §6: the ports are pure reads
 * over injected tables). The vNext production facades are ASYNC (durable
 * repository writes, the action router's team lock, the lifecycle chains,
 * the compatibility prober). This module is the PRODUCTION async mirror:
 *
 * - the dispatcher mirrors the frozen seven invariants byte-for-byte
 *   (unknown endpoint BEFORE the envelope; the closed envelope; the
 *   per-method closed param schema; the typed-error pass-through with the
 *   source identity under `details.cause`; the untyped-throw →
 *   `internal-error` with no leak; the lossless-JSON check before the
 *   success reply; the promise that never rejects) — the ONLY divergence
 *   is the `await` of the category handler (invariant 4), forced by the
 *   async facades;
 * - the twelve ports are host adapters over the runtime authorities ONLY
 *   (plan §20.4: a remote handler must call Runtime/Team service
 *   authority — never a direct repository mutation, never a direct
 *   Agent.followup, never a local compatibility recompute);
 * - every client-claimed principal (`caller` / `actor` / `acknowledgedBy`)
 *   is derived SERVER-SIDE through the installed `serverPrincipalDerivation`
 *   seam (A32; closes CR-4) — the claim is input to the derivation, never
 *   authority;
 * - `team.getLedgerPage` additionally flows through the pagination
 *   completion (A34): the frozen `createLedgerPageTracker` (the A33
 *   wiring) gates every served page (plan §20.5/§20.6: the stable cursor,
 *   the load-earlier session, the growth-safe historical window).
 *
 * The wire contract is UNCHANGED: every `outcome.data` shape mirrors the
 * frozen category handlers (one dotted endpoint per method, the same
 * value shapes, the same provenance cells), so a frozen-contract client
 * cannot tell the mirror apart from the frozen dispatcher.
 *
 * Pure assembly module: no `node:` builtins, no DSH imports (the DSH side
 * arrives exclusively through the injected ports).
 * @module @dsh-agent-team/runtime/plugin/s6-remote
 */

import {
  REMOTE_CATEGORIES,
  isRemoteMethod,
  remoteCategoryOf,
} from '../../../remote/src/contracts/catalog.js'
import {
  REMOTE_CONTRACT_ERROR_CODES,
  isRemoteContractError,
  remoteContractError,
} from '../../../remote/src/contracts/errors.js'
import {
  parseRemoteMethodParams,
  parseRemoteTeamGetLedgerPageParams,
} from '../../../remote/src/contracts/params.js'
import type {
  RemoteCatalogGetParams,
  RemoteCompatibilityAckParams,
  RemoteCompatibilityGetParams,
  RemoteCompatibilityReprobeParams,
  RemoteHandoffCreateParams,
  RemoteHandoffPrepareParams,
  RemoteIntentProbeParams,
  RemoteLegacyInspectParams,
  RemoteMemberCreateParams,
  RemoteMemberFollowupParams,
  RemoteMemberLifecycleParams,
  RemoteMemberSendParams,
  RemoteMethodParams,
  RemoteOverrideGetParams,
  RemoteOverrideResetParams,
  RemoteOverrideSetParams,
  RemotePolicyStateGetParams,
  RemotePolicyStateSetParams,
  RemoteTeamCreateParams,
  RemoteTeamGetLedgerPageParams,
  RemoteTeamGetProjectionParams,
} from '../../../remote/src/contracts/params.js'
import { parseRemoteRequest } from '../../../remote/src/contracts/request.js'
import type { RemoteRequest } from '../../../remote/src/contracts/request.js'
import {
  buildRemoteError,
  buildRemoteSuccess,
} from '../../../remote/src/contracts/response.js'
import type {
  RemoteProvenanceContext,
  RemoteResponse,
} from '../../../remote/src/contracts/response.js'
import {
  REMOTE_PROJECTION_FIELDS,
  type RemoteLedgerEntryValue,
  type RemoteLedgerPageValue,
} from '../../../remote/src/contracts/types.js'
import { REMOTE_CONTRACT_VERSION } from '../../../remote/src/contracts/version.js'
import type { RemoteSafeRecord } from '../../../remote/src/contracts/remote-safe.js'
import { REMOTE_BACKING_ERROR_CODE_SET } from '../../../remote/src/handlers/dispatch.js'
import type { RemoteDispatcher } from '../../../remote/src/handlers/dispatch.js'
import type { RemoteHandlerOutcome } from '../../../remote/src/handlers/ports.js'
import { REMOTE_RPC_CHANNEL } from '../../../remote/src/handlers/register.js'
import type {
  ConnectionLike,
  RemoteRegistration,
} from '../../../remote/src/handlers/register.js'
import { createLedgerPageTracker } from '../../../remote/src/push/ledger-page.js'
import type { PageCheckResult } from '../../../remote/src/push/types.js'
import { TeamPluginError } from './types.js'
import type {
  RemoteHandlerRegistration,
  RemoteQueryCommandCompletion,
  ServerPrincipalDerivation,
} from './types.js'
import {
  S6_PRINCIPAL_ERROR_CODES,
  SERVER_PRINCIPAL_TRANSPORTS,
  createServerPrincipalContext,
  isServerPrincipalContext,
} from './s6-principal.js'
import type { ServerPrincipalContext } from './s6-principal.js'
import type { TeamDomainRepositories } from '../../../storage/repositories/index.js'
import type {
  ActionCaller,
  TeamRuntime,
  TeamRuntimeActionOutcome,
  TeamRuntimeActionRequest,
} from '../../admission/index.js'
import { validateActionRequest } from '../../admission/index.js'
import type { InstanceId, TeamSessionId } from '../../../contracts/src/index.js'
import { canonicalJsonStringify } from '../../../contracts/src/index.js'
import type { LifecycleService } from '../../lifecycle/index.js'
import { activePolicyState } from '../../mutation/index.js'
import type {
  AdmittedGovernanceOverride,
  AdmitGovernanceOverrideArgs,
  MutationActor,
  MutationAuthority,
  OverrideStorePort,
  PolicyEntry,
  PolicyStateTransitionRecord,
  PolicyStateView,
} from '../../mutation/index.js'
import {
  PROBE_TRIGGER_VALUES,
  compatibilityRequirementsOf,
} from '../../compatibility/index.js'
import type { CompatibilityProber } from '../../compatibility/index.js'
import { evaluateCompatibility } from '../../../domain/compatibility/src/index.js'
import type { EnvironmentFact } from '../../../domain/compatibility/src/index.js'
import type {
  BlueprintCatalog,
  BlueprintTemplate,
  TeamBlueprint,
} from '../../../domain/blueprint/src/index.js'
import { sha256Hex } from '../../../domain/blueprint/src/index.js'
import { DEFAULT_POLICY_STATE_ID } from '../../../domain/policy/src/index.js'
import type {
  ColdRootBindingInput,
  FreshRootBindingInput,
  RootBindingResult,
} from '../../root-binding/index.js'
import type { HandoffService } from '../../handoff/index.js'
import type { LegacyHomePort, LegacyInspectFn } from './legacy-surface.js'
import type { ProjectionService } from '../../projection/index.js'

// --- the stable S6 remote error codes (the typed domain errors) ----------------------

/** The stable error codes the S6 remote surfaces throw (CR-4/CR-12 boundary). */
export const S6_REMOTE_ERROR_CODES = {
  /** A34 — the ledger-page tracker rejected the page (the 20.5/20.6 boundary). */
  LEDGER_PAGE_REJECTED: 'TEAM_REMOTE_LEDGER_PAGE_REJECTED',
  /** A31 — no durable compatibility state to read (fail-closed). */
  COMPATIBILITY_STATE_ABSENT: 'TEAM_REMOTE_COMPATIBILITY_STATE_ABSENT',
  /** A31 — the durable compatibility state is structurally malformed. */
  COMPATIBILITY_STATE_MALFORMED: 'TEAM_REMOTE_COMPATIBILITY_STATE_MALFORMED',
  /** A31 — the requested PolicyState is outside the bound blueprint's closed set. */
  POLICY_STATE_UNKNOWN: 'TEAM_REMOTE_POLICY_STATE_UNKNOWN',
  /** A31 — a catalog revision is not a safe integer (host bug, fail-closed). */
  CATALOG_REVISION_MALFORMED: 'TEAM_REMOTE_CATALOG_REVISION_MALFORMED',
  /** A31 — a durable ledger entry is structurally malformed (fail-closed). */
  LEDGER_ENTRY_MALFORMED: 'TEAM_REMOTE_LEDGER_ENTRY_MALFORMED',
  /** A31 — handoff.prepare: the production root exposes no source-session read surface. */
  HANDOFF_PREPARE_UNAVAILABLE: 'TEAM_HANDOFF_SOURCE_SURFACE_UNAVAILABLE',
  /** A31 — legacy.inspect: no legacy home port is bound to this root. */
  LEGACY_HOME_UNAVAILABLE: 'TEAM_REMOTE_LEGACY_HOME_UNAVAILABLE',
  /** A31 — an instance-scoped override request carries no target instance. */
  OVERRIDE_TARGET_REQUIRED: 'TEAM_REMOTE_OVERRIDE_TARGET_REQUIRED',
  /** A31 — team.create names a blueprint snapshot the bound TeamSession does not carry. */
  TEAM_CREATE_BLUEPRINT_MISMATCH: 'TEAM_REMOTE_TEAM_CREATE_BLUEPRINT_MISMATCH',
} as const

export type S6RemoteErrorCode = (typeof S6_REMOTE_ERROR_CODES)[keyof typeof S6_REMOTE_ERROR_CODES]

// --- the production port vocabulary (the async mirror of the frozen twelve) ----------

/**
 * The admission request the `member.create` / `member.send` /
 * `member.followup` handlers build (the structural mirror of the frozen
 * `RemoteAdmissionRequest`). `callerClaim` is the CLIENT'S claim: it is
 * input to the server-side principal derivation (A32) and NEVER authority —
 * the port acts on the derived caller only (plan §20.3, CR-4).
 */
export interface S6RemoteAdmissionRequest {
  readonly rootSessionId: string
  readonly action: 'create-member' | 'send-message' | 'follow-up'
  /** The client's caller claim (derivation input only). */
  readonly callerClaim: unknown
  readonly requestToken: string
  readonly targetInstanceId?: string
  readonly delegationTemplateId?: string
  readonly delegationInstanceId?: string
  readonly body?: string
  readonly subject?: string
  readonly payload?: RemoteSafeRecord
}

/** The `override.set` request (the structural mirror of the frozen shape). */
export interface S6RemoteOverrideSetRequest {
  readonly teamSessionId: string
  readonly capability: string
  readonly value: RemoteSafeRecord
  /** The client's actor claim (derivation input only). */
  readonly actorClaim: unknown
  readonly scope?: 'team' | 'instance'
  readonly targetInstanceId?: string
}

/** The `override.reset` request (the structural mirror of the frozen shape). */
export interface S6RemoteOverrideResetRequest {
  readonly teamSessionId: string
  readonly capability: string
  /** The client's actor claim (derivation input only). */
  readonly actorClaim: unknown
  readonly scope?: 'team' | 'instance'
  readonly targetInstanceId?: string
}

/** The `policyState.set` request (the structural mirror of the frozen shape). */
export interface S6RemotePolicyStateSwitchRequest {
  readonly teamSessionId: string
  readonly target: RemoteSafeRecord
  /** The client's actor claim (derivation input only). */
  readonly actorClaim: unknown
}

/** Port 1/12 — blueprint catalog discovery (`catalog.*`). */
export interface S6RemoteCatalogPort {
  list(): Promise<readonly RemoteSafeRecord[]>
  get(blueprintId: string, blueprintRevision?: number): Promise<RemoteSafeRecord>
}
/** Port 2/12 — the pre-creation compatibility probe (`intent.probe`). */
export interface S6RemoteIntentPort {
  probe(
    blueprintId: string,
    blueprintRevision: number | undefined,
    environmentFacts: readonly RemoteSafeRecord[],
  ): Promise<RemoteSafeRecord>
}
/** Port 3/12 — TeamSession creation via the root binding (`team.create`). */
export interface S6RemoteTeamCreatePort {
  /**
   * Bind a fresh root or rehydrate a cold root for the requested
   * blueprint. `initialWork` (BC-03 / R1-A) is optional: when present it
   * is admitted through the existing work-admission path (the facade's
   * `follow-up` action on the leader instance) as part of the creation;
   * absent, the behavior is unchanged.
   * @returns the value object
   *   `{ path: 'fresh-root' | 'cold-root', durable: <state> | null,
   *   bind: <bind result> }` (lossless JSON).
   */
  create(
    rootSessionId: string,
    blueprintId: string,
    blueprintRevision?: number,
    initialWork?: RemoteSafeRecord,
  ): Promise<RemoteSafeRecord>
}
/** Port 4/12 — the whole-projection observation (`team.getProjection`). */
export interface S6RemoteProjectionPort {
  project(teamSessionId: string): Promise<RemoteSafeRecord>
}
/** Port 5/12 — the durable ledger behind the D-5 slicer (`team.getLedgerPage`). */
export interface S6RemoteLedgerPort {
  listEntries(teamSessionId: string): Promise<readonly RemoteLedgerEntryValue[]>
  countEntries(teamSessionId: string): Promise<number>
}
/** Port 6/12 — member admission over the TeamRuntime facade (`member.*`). */
export interface S6RemoteAdmissionPort {
  performAction(
    request: S6RemoteAdmissionRequest,
    caller: ActionCaller,
  ): Promise<TeamRuntimeActionOutcome>
}
/** Port 7/12 — member lifecycle over the LifecycleService (`member.*`). */
export interface S6RemoteLifecyclePort {
  archive(teamSessionId: string, instanceId: string): Promise<RemoteSafeRecord>
  restore(teamSessionId: string, instanceId: string): Promise<RemoteSafeRecord>
  dispose(teamSessionId: string, instanceId: string): Promise<RemoteSafeRecord>
}
/** Port 8/12 — governance overrides over the mutation admission (`override.*`). */
export interface S6RemoteOverridePort {
  get(
    teamSessionId: string,
    capability: string,
    scope?: 'team' | 'instance',
    targetInstanceId?: string,
  ): Promise<RemoteSafeRecord | null>
  set(request: S6RemoteOverrideSetRequest, caller: ActionCaller): Promise<RemoteSafeRecord>
  reset(request: S6RemoteOverrideResetRequest, caller: ActionCaller): Promise<{ readonly removed: boolean }>
}
/** Port 9/12 — the TeamSession PolicyState over the mutation service (`policyState.*`). */
export interface S6RemotePolicyStatePort {
  read(teamSessionId: string): Promise<RemoteSafeRecord>
  switchState(request: S6RemotePolicyStateSwitchRequest, caller: ActionCaller): Promise<RemoteSafeRecord>
}
/** Port 10/12 — the durable compatibility state over the prober (`compatibility.*`). */
export interface S6RemoteCompatibilityPort {
  current(teamSessionId: string): Promise<RemoteSafeRecord>
  acknowledge(teamSessionId: string, requirementId: string, caller: ActionCaller, note?: string): Promise<RemoteSafeRecord>
  probe(teamSessionId: string, trigger: string): Promise<RemoteSafeRecord>
}
/** Port 11/12 — start-a-team-from-here over the handoff service (`handoff.*`). */
export interface S6RemoteHandoffPort {
  prepareSource(sourceSessionId: string): Promise<RemoteSafeRecord>
  start(sourceSessionId: string, requestToken: string, staged?: RemoteSafeRecord): Promise<RemoteSafeRecord>
}
/** Port 12/12 — the read-only legacy inspection (`legacy.inspect`). */
export interface S6RemoteLegacyPort {
  inspect(dshHome: string, workspaceCwd?: string, projectDir?: string): Promise<RemoteSafeRecord>
}

/** The twelve production ports (the async mirror of the frozen `RemoteHandlerDeps`). */
export interface S6RemotePorts {
  readonly catalog: S6RemoteCatalogPort
  readonly intent: S6RemoteIntentPort
  readonly teamCreate: S6RemoteTeamCreatePort
  readonly projection: S6RemoteProjectionPort
  readonly ledger: S6RemoteLedgerPort
  readonly admission: S6RemoteAdmissionPort
  readonly lifecycle: S6RemoteLifecyclePort
  readonly override: S6RemoteOverridePort
  readonly policyState: S6RemotePolicyStatePort
  readonly compatibility: S6RemoteCompatibilityPort
  readonly handoff: S6RemoteHandoffPort
  readonly legacy: S6RemoteLegacyPort
}

// --- the construction inputs ------------------------------------------------------------

/** The root-binding surface the `team.create` port drives. */
export interface S6RootBindingPort {
  bindFresh(input: FreshRootBindingInput): Promise<RootBindingResult>
  rehydrateCold(input: ColdRootBindingInput): Promise<RootBindingResult>
}

/** The construction inputs of the S6 remote surfaces (all injected). */
export interface S6RemoteOptions {
  /** The bound root session id (this host's single TeamSession). */
  readonly rootSessionId: string
  /** The open TeamDomain repositories (the durable rows). */
  readonly repositories: TeamDomainRepositories
  /** The host blueprint catalog (the single bound blueprint). */
  readonly catalog: BlueprintCatalog
  /** The bound blueprint (policy-state closed set, template quota). */
  readonly blueprint: TeamBlueprint
  /** The bound leader's instance id (the leader authority). */
  readonly leaderInstanceId: string
  /** The projection service (durable source + the S6 overlay). */
  readonly projection: ProjectionService
  /** The TeamRuntime action facade (the ONLY admission authority). */
  readonly runtime: TeamRuntime
  /** The lifecycle service (the ONLY lifecycle authority). */
  readonly lifecycle: LifecycleService
  /** The mutation service (the ONLY PolicyState authority). */
  readonly mutationService: {
    switchPolicyState(request: {
      teamSessionId: TeamSessionId
      target: PolicyStateView
      actor: MutationActor
    }): PolicyStateTransitionRecord
  }
  /** The mutation store's transition rows (the durable PolicyState read). */
  readonly mutationTransitions: (teamSessionId: string) => readonly PolicyStateTransitionRecord[]
  /** The governance-override admission (the ONLY override authority). */
  readonly admitGovernanceOverride: (
    args: AdmitGovernanceOverrideArgs,
    store?: OverrideStorePort,
  ) => Promise<AdmittedGovernanceOverride>
  /** The durable override store (list/delete of the addressed record). */
  readonly overrideStore: OverrideStorePort
  /** The override record identity source (the durable `overrides` rows). */
  readonly overrideRecords: (rootSessionId: string) => readonly RemoteSafeRecord[]
  /** The root binding (fresh + cold). */
  readonly rootBinding: S6RootBindingPort
  /** The compatibility prober (the ONLY compatibility authority). */
  readonly compatibility: CompatibilityProber
  /** The handoff service (the ONLY handoff authority). */
  readonly handoff: HandoffService
  /**
   * The handoff prepare source producer (P8-S7-R4 A28 un-wiring): the
   * EXACTLY-ONE canonical surface freeze + the one-shot NON-MODEL
   * deterministic digest, returned as the remote-safe `summary` payload.
   * ABSENT → `handoff.prepare` fails closed exactly as before (the S5A
   * boot world and test worlds without the DSH session read service).
   */
  readonly handoffPrepare?: (sourceSessionId: string) => Promise<RemoteSafeRecord>
  /** The frozen legacy reader's operational entry. */
  readonly legacyInspect: LegacyInspectFn
  /** The legacy home port (ABSENT in the boot world: fail-closed). */
  readonly legacyHome: LegacyHomePort | undefined
  /** The installed A32 principal derivation (the seam's `current()`). */
  readonly principal: ServerPrincipalDerivation
  /** The deterministic clock (ISO-8601). */
  readonly now: () => string
}

// --- small local helpers ------------------------------------------------------------------

/** True for a plain (non-array, non-null) object. */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** A safe non-negative integer. */
function isSafeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

/**
 * BC-03 / R1-A — the stable logical-operation token of one creation-time
 * work admission: the content hash of the initial work's canonical JSON.
 * The work chain's token protocol (closure plan §CR2) then makes a retried
 * `team.create` carrying the SAME initial work a replay/resume (zero
 * duplicate `team-work-admitted` facts), while a different payload is a
 * distinct logical operation (a fresh admission through the same gates).
 * The token scan is root-scoped, so identical payloads on different teams
 * never collide.
 */
function initialWorkRequestToken(initialWork: RemoteSafeRecord): string {
  return `team-create:initial-work:sha256:${sha256Hex(canonicalJsonStringify(initialWork))}`
}

/** Map the derived caller to the mutation authority (server-side). */
function authorityOf(caller: ActionCaller, leaderInstanceId: string): MutationAuthority {
  if (caller.kind === 'human') return { kind: 'operator' }
  if (caller.instanceId === leaderInstanceId) return { kind: 'leader' }
  return { kind: 'member', instanceId: caller.instanceId }
}

/** Map the derived caller to the mutation actor (server-side). */
function actorOf(
  caller: ActionCaller,
  rootSessionId: string,
  leaderInstanceId: string,
): MutationActor {
  if (caller.kind === 'human') return { kind: 'human' }
  if (caller.instanceId === leaderInstanceId) return { kind: 'leader' }
  return {
    kind: 'member',
    member: { rootSessionId: rootSessionId as TeamSessionId, instanceId: caller.instanceId as InstanceId },
  }
}

/** Map a blueprint template to its wire discovery record. */
function templateToRecord(template: BlueprintTemplate): RemoteSafeRecord {
  const record: Record<string, unknown> = { templateId: template.templateId, persona: template.persona }
  if (template.displayName !== undefined) record['displayName'] = template.displayName
  if (template.description !== undefined) record['description'] = template.description
  if (template.modelPreference !== undefined) record['modelPreference'] = template.modelPreference
  if (template.contextPolicy !== undefined) record['contextPolicy'] = template.contextPolicy
  return record as RemoteSafeRecord
}

/** Map a resolved blueprint to its wire discovery record. */
function blueprintToRecord(blueprint: TeamBlueprint): RemoteSafeRecord {
  const record: Record<string, unknown> = {
    schemaVersion: blueprint.schemaVersion,
    blueprintId: blueprint.blueprintId,
    revision: blueprint.revision,
    contentHash: blueprint.contentHash,
    leader: templateToRecord(blueprint.leader),
    members: [...blueprint.members.map((template) => templateToRecord(template))],
    requirements: [
      ...blueprint.requirements.map((requirement) => ({
        domain: requirement.domain,
        name: requirement.name,
        optional: requirement.optional,
      })),
    ],
    policyStates: [
      ...blueprint.policyStates.map((state) => {
        const stateRecord: Record<string, unknown> = { id: state.id, fields: [...state.fields] }
        if (state.description !== undefined) stateRecord['description'] = state.description
        return stateRecord
      }),
    ],
  }
  if (blueprint.displayName !== undefined) record['displayName'] = blueprint.displayName
  if (blueprint.description !== undefined) record['description'] = blueprint.description
  if (blueprint.quotas !== undefined) {
    const quotaOf = (quota: { maxInstances?: number; maxConcurrent?: number } | undefined) =>
      quota === undefined
        ? null
        : {
            maxInstances: quota.maxInstances ?? null,
            maxConcurrent: quota.maxConcurrent ?? null,
          }
    record['quotas'] = {
      team: quotaOf(blueprint.quotas.team),
      members: quotaOf(blueprint.quotas.members),
    }
  }
  return record as RemoteSafeRecord
}

/** The durable effect sequence of an admission outcome (the frozen rule, verbatim). */
function admissionEffectSequence(outcome: Record<string, unknown>): number | undefined {
  const effect = outcome['effect']
  if (effect === null || typeof effect !== 'object' || Array.isArray(effect)) return undefined
  const effectRecord = effect as Record<string, unknown>
  let candidate: unknown
  switch (typeof effectRecord['kind'] === 'string' ? effectRecord['kind'] : '') {
    case 'fact-recorded':
    case 'work-admitted':
    case 'lifecycle-changed':
      candidate = effectRecord['sequence']
      break
    case 'member-activated':
      candidate = effectRecord['ledgerSequence']
      break
    default:
      return undefined
  }
  if (typeof candidate === 'number' && Number.isSafeInteger(candidate)) {
    return candidate
  }
  return undefined
}

/** One ledger entry from a durable row (the frozen wire shape, field-by-field). */
function ledgerEntryWire(record: Record<string, unknown>): RemoteLedgerEntryValue {
  const schemaVersion = record['schemaVersion']
  const sequence = record['sequence']
  const rootSessionId = record['rootSessionId']
  const factType = record['factType']
  const payload = record['payload']
  const createdAt = record['createdAt']
  if (!isSafeInt(schemaVersion)) {
    throw new TeamPluginError(
      S6_REMOTE_ERROR_CODES.LEDGER_ENTRY_MALFORMED,
      `durable ledger entry carries a malformed schemaVersion (${String(schemaVersion)})`,
      { reason: 'malformed-schema-version' },
    )
  }
  if (!isSafeInt(sequence) || sequence < 1) {
    throw new TeamPluginError(
      S6_REMOTE_ERROR_CODES.LEDGER_ENTRY_MALFORMED,
      `durable ledger entry carries a malformed sequence (${String(sequence)})`,
      { reason: 'malformed-sequence' },
    )
  }
  if (typeof rootSessionId !== 'string' || rootSessionId.length === 0) {
    throw new TeamPluginError(
      S6_REMOTE_ERROR_CODES.LEDGER_ENTRY_MALFORMED,
      'durable ledger entry carries a malformed rootSessionId',
      { reason: 'malformed-root-session-id' },
    )
  }
  if (typeof factType !== 'string' || factType.length === 0) {
    throw new TeamPluginError(
      S6_REMOTE_ERROR_CODES.LEDGER_ENTRY_MALFORMED,
      'durable ledger entry carries a malformed factType',
      { reason: 'malformed-fact-type' },
    )
  }
  if (!isPlainRecord(payload)) {
    throw new TeamPluginError(
      S6_REMOTE_ERROR_CODES.LEDGER_ENTRY_MALFORMED,
      'durable ledger entry carries a malformed payload',
      { reason: 'malformed-payload' },
    )
  }
  if (typeof createdAt !== 'string' || createdAt.length === 0) {
    throw new TeamPluginError(
      S6_REMOTE_ERROR_CODES.LEDGER_ENTRY_MALFORMED,
      'durable ledger entry carries a malformed createdAt',
      { reason: 'malformed-created-at' },
    )
  }
  const operationId = record['operationId']
  return {
    schemaVersion,
    sequence,
    rootSessionId,
    factType,
    payload: payload as RemoteSafeRecord,
    operationId: operationId === undefined ? null : (operationId as string),
    createdAt,
  }
}

/**
 * The durable PolicyState read (the mutation store's transition rows).
 *
 * The remote read evaluates at the far-future step: it reports the state of
 * the LATEST durable transition (or the default state when the store is
 * empty). The production step clock is pinned to 0 (the step model advances
 * with the work chain, not with explicit transitions), so evaluating at
 * step 0 would hide every explicit transition from the remote read
 * permanently — the client must read back the state it set.
 */
function policyStateReadOf(
  transitions: readonly PolicyStateTransitionRecord[],
  atStep: number,
): PolicyStateView {
  return activePolicyState(transitions, atStep)
}

/** The compatibility verdict of one durable state record (defensive read). */
function compatibilityCurrentOf(state: Record<string, unknown>): RemoteSafeRecord {
  const status = state['status']
  const fingerprint = state['fingerprint']
  const generation = state['generation']
  const computedAt = state['computedAt']
  const outcomes = state['outcomes']
  if (
    typeof status !== 'string' ||
    typeof fingerprint !== 'string' ||
    !isSafeInt(generation) ||
    typeof computedAt !== 'string' ||
    !isPlainRecord(outcomes)
  ) {
    throw new TeamPluginError(
      S6_REMOTE_ERROR_CODES.COMPATIBILITY_STATE_MALFORMED,
      'the durable compatibility state is structurally malformed',
      { reason: 'malformed-state' },
    )
  }
  const counts = outcomes['counts']
  if (
    !isPlainRecord(counts) ||
    !isSafeInt(counts['pass']) ||
    !isSafeInt(counts['warning']) ||
    !isSafeInt(counts['fatal']) ||
    !isSafeInt(counts['unackedWarning']) ||
    !isSafeInt(counts['staleAcknowledgement'])
  ) {
    throw new TeamPluginError(
      S6_REMOTE_ERROR_CODES.COMPATIBILITY_STATE_MALFORMED,
      'the durable compatibility state carries a malformed counts block',
      { reason: 'malformed-counts' },
    )
  }
  return {
    status,
    environmentFingerprint: fingerprint,
    generation,
    recordedAt: computedAt,
    counts: {
      pass: counts['pass'],
      warning: counts['warning'],
      fatal: counts['fatal'],
      unackedWarning: counts['unackedWarning'],
      staleAcknowledgement: counts['staleAcknowledgement'],
    },
  }
}

// --- the port builders ---------------------------------------------------------------------

/**
 * Build the twelve production remote ports over one bound root.
 *
 * Every port asserts the bound root first (the foreign-team guard — the
 * A32 seam re-asserts it for the claim-carrying methods; the other methods
 * assert it here, so NO team-scoped remote method can address another
 * TeamSession). Every authority call goes to the runtime facade; the
 * ports themselves perform no repository writes except the single
 * `override.reset` deletion of the ADDRESS-RESOLVED record (the reset
 * authority: the admission's identity resolution + the durable delete —
 * the mutation admission is the set authority, the delete is the
 * audit-preserving revoke the frozen contract names).
 * @param options - the root-bound inputs.
 * @returns the twelve ports.
 */
export function createS6RemotePorts(options: S6RemoteOptions): S6RemotePorts {
  const { rootSessionId, repositories, catalog, blueprint, leaderInstanceId, now } = options

  function assertBoundRoot(method: string, teamSessionId: unknown): string {
    if (typeof teamSessionId !== 'string' || teamSessionId !== rootSessionId) {
      throw new TeamPluginError(
        S6_PRINCIPAL_ERROR_CODES.FOREIGN_TEAM,
        `remote method '${method}' addresses TeamSession '${String(teamSessionId)}' but this host is bound to '${rootSessionId}'`,
        { reason: 'foreign-team', requested: String(teamSessionId), bound: rootSessionId },
      )
    }
    return teamSessionId
  }

  function resolveBlueprint(blueprintId: string, revision: number | undefined): TeamBlueprint {
    if (revision === undefined) return catalog.resolveLatest(blueprintId)
    if (!Number.isSafeInteger(revision)) {
      throw new TeamPluginError(
        S6_REMOTE_ERROR_CODES.CATALOG_REVISION_MALFORMED,
        `blueprint revision '${String(revision)}' is not a safe integer`,
        { reason: 'malformed-revision', blueprintId },
      )
    }
    return catalog.resolve(blueprintId, String(revision))
  }

  function rootLedgerEntries(): readonly Record<string, unknown>[] {
    return repositories.ledger
      .list()
      .filter((entry) => entry.rootSessionId === rootSessionId) as unknown as readonly Record<string, unknown>[]
  }

  return {
    // --- 1/12 catalog: host catalog discovery (read-only) ---------------------------
    catalog: {
      async list(): Promise<readonly RemoteSafeRecord[]> {
        const rows: RemoteSafeRecord[] = []
        for (const blueprintId of catalog.blueprintIds) {
          const revisions = catalog.listRevisions(blueprintId).map((revision) => {
            const value = Number(revision)
            if (!Number.isSafeInteger(value)) {
              throw new TeamPluginError(
                S6_REMOTE_ERROR_CODES.CATALOG_REVISION_MALFORMED,
                `blueprint '${blueprintId}' carries a malformed revision '${revision}'`,
                { reason: 'malformed-revision', blueprintId, revision },
              )
            }
            return value
          })
          rows.push({ blueprintId, revisions })
        }
        return rows
      },
      async get(blueprintId: string, blueprintRevision?: number): Promise<RemoteSafeRecord> {
        return blueprintToRecord(resolveBlueprint(blueprintId, blueprintRevision))
      },
    },

    // --- 2/12 intent: the pure domain probe (no local recompute of durable state) ---
    intent: {
      async probe(
        blueprintId: string,
        blueprintRevision: number | undefined,
        environmentFacts: readonly RemoteSafeRecord[],
      ): Promise<RemoteSafeRecord> {
        const resolved = resolveBlueprint(blueprintId, blueprintRevision)
        const result = evaluateCompatibility({
          requirements: compatibilityRequirementsOf(resolved),
          environmentFacts: environmentFacts as unknown as readonly EnvironmentFact[],
        })
        return result as unknown as RemoteSafeRecord
      },
    },

    // --- 3/12 teamCreate: the root binding (fresh or cold) ---------------------------
    teamCreate: {
      async create(
        requestedRootSessionId: string,
        blueprintId: string,
        blueprintRevision: number | undefined,
        initialWork: RemoteSafeRecord | undefined,
      ): Promise<RemoteSafeRecord> {
        assertBoundRoot('team.create', requestedRootSessionId)
        const resolved = resolveBlueprint(blueprintId, blueprintRevision)
        // BC-03 / R1-A: optional initial work admitted through the EXISTING
        // work-admission path (facade follow-up on the leader instance).
        // Pure step 0 BEFORE any durable bind (malformed work fails without
        // partial creation); the full chain AFTER the bind, under facade
        // authority (gates + work-chain token replay/resume included).
        let initialWorkRequest: TeamRuntimeActionRequest | undefined
        if (initialWork !== undefined) {
          initialWorkRequest = {
            rootSessionId,
            action: 'follow-up',
            caller: await options.principal({
              method: 'team.create',
              request: {
                version: REMOTE_CONTRACT_VERSION,
                params: {
                  rootSessionId,
                  blueprintId,
                  ...(blueprintRevision !== undefined ? { blueprintRevision } : {}),
                  initialWork,
                },
              },
            }),
            targetInstanceId: leaderInstanceId,
            requestToken: initialWorkRequestToken(initialWork),
            payload: { ...initialWork },
          }
          validateActionRequest(initialWorkRequest)
        }
        const durableRow = repositories.teamSessions.get(rootSessionId)
        let result: RootBindingResult
        if (durableRow !== undefined) {
          // The cold path: the durable row's bound snapshot is the truth;
          // a request naming a different snapshot is a foreign intent.
          if (
            durableRow.blueprint.blueprintId !== resolved.blueprintId ||
            (blueprintRevision !== undefined &&
              Number(durableRow.blueprint.revision) !== blueprintRevision)
          ) {
            throw new TeamPluginError(
              S6_REMOTE_ERROR_CODES.TEAM_CREATE_BLUEPRINT_MISMATCH,
              `team.create names blueprint '${resolved.blueprintId}' (revision ${String(blueprintRevision ?? 'latest')}) but the bound TeamSession carries '${durableRow.blueprint.blueprintId}' (revision '${durableRow.blueprint.revision}')`,
              { reason: 'blueprint-mismatch' },
            )
          }
          result = await options.rootBinding.rehydrateCold({ rootSessionId: rootSessionId as TeamSessionId })
        } else {
          result = await options.rootBinding.bindFresh({
            rootSessionId: rootSessionId as TeamSessionId,
            blueprint: {
              blueprintId: resolved.blueprintId,
              revision: resolved.revision,
              contentHash: resolved.contentHash,
            },
          })
        }
        if (initialWorkRequest !== undefined) {
          await options.runtime.performAction(initialWorkRequest)
        }
        return {
          path: result.path,
          durable: result.durable ?? null,
          bind: result.bind as unknown as RemoteSafeRecord,
        } as unknown as RemoteSafeRecord
      },
    },

    // --- 4/12 projection: the projection service (durable source + overlay) ---------
    projection: {
      async project(teamSessionId: string): Promise<RemoteSafeRecord> {
        assertBoundRoot('team.getProjection', teamSessionId)
        const projection = options.projection.project(teamSessionId as TeamSessionId)
        return projection as unknown as RemoteSafeRecord
      },
    },

    // --- 5/12 ledger: the durable rows behind the D-5 slicer (root-filtered) --------
    ledger: {
      async listEntries(teamSessionId: string): Promise<readonly RemoteLedgerEntryValue[]> {
        assertBoundRoot('team.getLedgerPage', teamSessionId)
        return rootLedgerEntries().map((record) => ledgerEntryWire(record))
      },
      async countEntries(teamSessionId: string): Promise<number> {
        assertBoundRoot('team.getLedgerPage', teamSessionId)
        return rootLedgerEntries().length
      },
    },

    // --- 6/12 admission: the TeamRuntime facade (NEVER the claimed caller) ----------
    admission: {
      async performAction(
        request: S6RemoteAdmissionRequest,
        caller: ActionCaller,
      ): Promise<TeamRuntimeActionOutcome> {
        const base = {
          rootSessionId: rootSessionId as TeamSessionId,
          caller,
          requestToken: request.requestToken,
        }
        let facadeRequest: TeamRuntimeActionRequest
        if (request.action === 'create-member') {
          facadeRequest = {
            ...base,
            action: 'create-member',
            ...(request.delegationTemplateId !== undefined
              ? { delegationTemplateId: request.delegationTemplateId }
              : {}),
            ...(request.delegationInstanceId !== undefined
              ? { delegationInstanceId: request.delegationInstanceId }
              : {}),
            ...(request.payload !== undefined ? { payload: { ...request.payload } } : {}),
          }
        } else if (request.action === 'send-message') {
          // The authoritative recipient/body come from the parsed params;
          // the client's extra payload fields merge UNDER them (no
          // override of the authority fields).
          const payload: Record<string, unknown> = { ...(request.payload ?? {}) }
          payload['recipientInstanceId'] = request.targetInstanceId
          payload['body'] = request.body
          if (request.subject !== undefined) payload['subject'] = request.subject
          facadeRequest = {
            ...base,
            action: 'send-message',
            targetInstanceId: request.targetInstanceId as InstanceId,
            payload,
          }
        } else {
          facadeRequest = {
            ...base,
            action: 'follow-up',
            targetInstanceId: request.targetInstanceId as InstanceId,
            ...(request.payload !== undefined ? { payload: { ...request.payload } } : {}),
          }
        }
        return options.runtime.performAction(facadeRequest)
      },
    },

    // --- 7/12 lifecycle: the LifecycleService (the only lifecycle authority) --------
    lifecycle: {
      async archive(teamSessionId: string, instanceId: string): Promise<RemoteSafeRecord> {
        assertBoundRoot('member.archive', teamSessionId)
        const result = await options.lifecycle.archiveMember({
          rootSessionId: rootSessionId as TeamSessionId,
          instanceId: instanceId as InstanceId,
        })
        return result as unknown as RemoteSafeRecord
      },
      async restore(teamSessionId: string, instanceId: string): Promise<RemoteSafeRecord> {
        assertBoundRoot('member.restore', teamSessionId)
        const result = await options.lifecycle.restoreMember({
          rootSessionId: rootSessionId as TeamSessionId,
          instanceId: instanceId as InstanceId,
        })
        return result as unknown as RemoteSafeRecord
      },
      async dispose(teamSessionId: string, instanceId: string): Promise<RemoteSafeRecord> {
        assertBoundRoot('member.dispose', teamSessionId)
        const result = await options.lifecycle.disposeMember({
          rootSessionId: rootSessionId as TeamSessionId,
          instanceId: instanceId as InstanceId,
        })
        return result as unknown as RemoteSafeRecord
      },
    },

    // --- 8/12 override: the governance-override admission ----------------------------
    override: {
      async get(
        teamSessionId: string,
        capability: string,
        scope?: 'team' | 'instance',
        targetInstanceId?: string,
      ): Promise<RemoteSafeRecord | null> {
        assertBoundRoot('override.get', teamSessionId)
        const records = options.overrideRecords(rootSessionId)
        const effectiveScope = scope ?? 'team'
        const matches = records.filter((record) => {
          if (record['scope'] !== effectiveScope) return false
          if (effectiveScope === 'instance' && record['instanceId'] !== targetInstanceId) return false
          if (effectiveScope === 'team' && record['instanceId'] !== undefined) return false
          const values = record['values']
          return isPlainRecord(values) && capability in values
        })
        // The most-recently-written record wins (the slot winner by generation).
        let winner: RemoteSafeRecord | null = null
        for (const record of matches) {
          const generation = record['generation']
          if (!isSafeInt(generation)) continue
          if (winner === null || generation > (winner['generation'] as number)) winner = record
        }
        return winner
      },
      async set(request: S6RemoteOverrideSetRequest, caller: ActionCaller): Promise<RemoteSafeRecord> {
        assertBoundRoot('override.set', request.teamSessionId)
        const authority = authorityOf(caller, leaderInstanceId)
        const scope = request.scope ?? 'team'
        const instanceId = scope === 'instance' ? request.targetInstanceId : undefined
        if (scope === 'instance' && (instanceId === undefined || instanceId.length === 0)) {
          throw new TeamPluginError(
            S6_REMOTE_ERROR_CODES.OVERRIDE_TARGET_REQUIRED,
            'override.set with instance scope requires a targetInstanceId',
            { reason: 'missing-target' },
          )
        }
        const kind = authority.kind === 'operator' ? 'human-override' : 'autonomy-overlay'
        const records = options.overrideRecords(rootSessionId)
        const slotMatches = records.filter(
          (record) =>
            record['kind'] === kind &&
            record['scope'] === scope &&
            (scope === 'instance' ? record['instanceId'] === instanceId : record['instanceId'] === undefined),
        )
        let winnerGeneration = 0
        for (const record of slotMatches) {
          const generation = record['generation']
          if (isSafeInt(generation) && generation > winnerGeneration) winnerGeneration = generation
        }
        // The server-side deterministic clean record id (the remote
        // contract carries NO client-supplied record id; the id is bound
        // to the addressed slot + the current slot generation, so a
        // concurrent same-slot set collides instead of clobbering).
        const recordId = `ovr-${request.capability}-${scope === 'instance' ? instanceId : 'team'}-g${winnerGeneration}`
        const admitted = await options.admitGovernanceOverride(
          {
            authority,
            rootSessionId,
            recordId,
            scope,
            ...(instanceId !== undefined ? { instanceId } : {}),
            cells: { [request.capability]: request.value as unknown as PolicyEntry },
            now,
          },
          options.overrideStore,
        )
        const record: Record<string, unknown> = {
          recordId: admitted.recordId,
          kind: admitted.kind,
          scope: admitted.scope,
          rootSessionId: admitted.rootSessionId,
          values: admitted.values as unknown as RemoteSafeRecord,
          generation: admitted.generation,
          updatedAt: admitted.updatedAt,
        }
        if (admitted.instanceId !== undefined) record['instanceId'] = admitted.instanceId
        if (admitted.origin !== undefined) record['origin'] = admitted.origin
        return record as RemoteSafeRecord
      },
      async reset(
        request: S6RemoteOverrideResetRequest,
        caller: ActionCaller,
      ): Promise<{ readonly removed: boolean }> {
        assertBoundRoot('override.reset', request.teamSessionId)
        const authority = authorityOf(caller, leaderInstanceId)
        const scope = request.scope ?? 'team'
        const instanceId = scope === 'instance' ? request.targetInstanceId : undefined
        const kind = authority.kind === 'operator' ? 'human-override' : 'autonomy-overlay'
        const records = options.overrideRecords(rootSessionId)
        const slotMatches = records.filter(
          (record) =>
            record['kind'] === kind &&
            record['scope'] === scope &&
            (scope === 'instance' ? record['instanceId'] === instanceId : record['instanceId'] === undefined),
        )
        let winner: RemoteSafeRecord | null = null
        for (const record of slotMatches) {
          const generation = record['generation']
          if (!isSafeInt(generation)) continue
          if (winner === null || generation > (winner['generation'] as number)) winner = record
        }
        if (winner === null) return { removed: false }
        const removed = await repositories.overrides.delete({
          kind: winner['kind'] as 'human-override' | 'autonomy-overlay',
          recordId: winner['recordId'] as string,
          scope: winner['scope'] as 'team' | 'instance',
          rootSessionId,
          ...(scope === 'instance' ? { instanceId } : {}),
        })
        return { removed }
      },
    },

    // --- 9/12 policyState: the mutation service (invariant 40: explicit only) -------
    policyState: {
      async read(teamSessionId: string): Promise<RemoteSafeRecord> {
        assertBoundRoot('policyState.get', teamSessionId)
        const view = policyStateReadOf(
          options.mutationTransitions(rootSessionId),
          Number.MAX_SAFE_INTEGER,
        )
        // R2-1 (BQ-10): the surface reports the CURRENT state plus the
        // AVAILABLE AUTHORIZED TRANSITIONS — the bound blueprint's closed
        // state set (default + the declared states, declaration order)
        // minus the state already active (a self-transition is a no-op
        // the surface does not advertise). The frozen
        // RemotePolicyStateGetValue.state is an open RemoteSafeRecord, so
        // the additive key passes the remote plane unchanged. No impact
        // PREVIEW is invented: the backend provides no preview surface
        // for a not-yet-admitted transition (adjudication, documented in
        // S7R2-result.md). The A31 rejection semantics are untouched: an
        // out-of-closed-set target still fails POLICY_STATE_UNKNOWN and a
        // member actor still fails UNAUTHORIZED_TRANSITION (switchState).
        const closedStates = new Set<string>([
          DEFAULT_POLICY_STATE_ID,
          ...blueprint.policyStates.map((state) => state.id),
        ])
        const availableTransitions = [...closedStates].filter(
          (stateId) => stateId !== view.stateId,
        )
        return {
          ...(view as unknown as RemoteSafeRecord),
          availableTransitions,
        }
      },
      async switchState(
        request: S6RemotePolicyStateSwitchRequest,
        caller: ActionCaller,
      ): Promise<RemoteSafeRecord> {
        assertBoundRoot('policyState.set', request.teamSessionId)
        const target = request.target
        const stateId = target['stateId']
        const closed = new Set<string>([DEFAULT_POLICY_STATE_ID, ...blueprint.policyStates.map((state) => state.id)])
        if (typeof stateId !== 'string' || !closed.has(stateId)) {
          throw new TeamPluginError(
            S6_REMOTE_ERROR_CODES.POLICY_STATE_UNKNOWN,
            `policyState.set names state '${String(stateId)}' which is outside the bound blueprint's closed set (${[...closed].join(', ')})`,
            { reason: 'unknown-state', stateId: String(stateId) },
          )
        }
        const transition = options.mutationService.switchPolicyState({
          teamSessionId: rootSessionId as TeamSessionId,
          target: target as unknown as PolicyStateView,
          actor: actorOf(caller, rootSessionId, leaderInstanceId),
        })
        return {
          entryId: transition.entryId,
          origin: transition.origin,
          state: transition.state as unknown as RemoteSafeRecord,
          requestedAtStep: transition.requestedAtStep,
          effectiveFromStep: transition.effectiveFromStep,
        }
      },
    },

    // --- 10/12 compatibility: the prober (durable state; no local recompute) --------
    compatibility: {
      async current(teamSessionId: string): Promise<RemoteSafeRecord> {
        assertBoundRoot('compatibility.get', teamSessionId)
        const state = await options.compatibility.current()
        if (state === undefined) {
          throw new TeamPluginError(
            S6_REMOTE_ERROR_CODES.COMPATIBILITY_STATE_ABSENT,
            `no durable compatibility state exists for TeamSession '${rootSessionId}'`,
            { reason: 'state-absent' },
          )
        }
        return compatibilityCurrentOf(state as unknown as Record<string, unknown>)
      },
      async acknowledge(
        teamSessionId: string,
        requirementId: string,
        caller: ActionCaller,
        note?: string,
      ): Promise<RemoteSafeRecord> {
        assertBoundRoot('compatibility.ack', teamSessionId)
        const verdict = await options.compatibility.acknowledge({
          requirementId,
          acknowledgedBy: caller.kind === 'human' ? caller.humanId : caller.instanceId,
          ...(note !== undefined ? { note } : {}),
        })
        return verdict as unknown as RemoteSafeRecord
      },
      async probe(teamSessionId: string, trigger: string): Promise<RemoteSafeRecord> {
        assertBoundRoot('compatibility.reprobe', teamSessionId)
        if (!(PROBE_TRIGGER_VALUES as readonly string[]).includes(trigger)) {
          throw new TeamPluginError(
            S6_REMOTE_ERROR_CODES.COMPATIBILITY_STATE_MALFORMED,
            `compatibility.reprobe names trigger '${trigger}' outside the closed vocabulary`,
            { reason: 'unknown-trigger', trigger },
          )
        }
        const outcome = await options.compatibility.probe(trigger as (typeof PROBE_TRIGGER_VALUES)[number])
        return outcome as unknown as RemoteSafeRecord
      },
    },

    // --- 11/12 handoff: the handoff service (§34.4 fail-closed triad) ---------------
    handoff: {
      async prepareSource(sourceSessionId: string): Promise<RemoteSafeRecord> {
        // P8-S7-R4 A28: the producer is injected by the production root
        // (the DSH public sessionQuery authority + the deterministic
        // digest). ABSENT (the S5A boot world / test worlds without the
        // session read service) → fail closed exactly as before.
        const producer = options.handoffPrepare
        if (producer === undefined) {
          throw new TeamPluginError(
            S6_REMOTE_ERROR_CODES.HANDOFF_PREPARE_UNAVAILABLE,
            `the production root exposes no DSH public session read surface for handoff prepare (source session '${sourceSessionId}')`,
            { reason: 'source-surface-unavailable' },
          )
        }
        return producer(sourceSessionId)
      },
      async start(
        sourceSessionId: string,
        requestToken: string,
        staged?: RemoteSafeRecord,
      ): Promise<RemoteSafeRecord> {
        const state = await options.handoff.startTeamFromHere({
          requestToken,
          sourceSessionId,
          ...(staged !== undefined ? { staged } : {}),
        })
        return state as unknown as RemoteSafeRecord
      },
    },

    // --- 12/12 legacy: the frozen read-only reader (fail-closed without a home) -----
    legacy: {
      async inspect(dshHome: string, workspaceCwd?: string, projectDir?: string): Promise<RemoteSafeRecord> {
        if (options.legacyHome === undefined) {
          throw new TeamPluginError(
            S6_REMOTE_ERROR_CODES.LEGACY_HOME_UNAVAILABLE,
            "this production root carries no legacy home port (the boot world does not bind one); legacy.inspect is fail-closed",
            { reason: 'legacy-home-unavailable' },
          )
        }
        const inspection = options.legacyInspect(options.legacyHome, {
          dshHome,
          ...(workspaceCwd !== undefined ? { workspaceCwd } : {}),
          ...(projectDir !== undefined ? { projectDir } : {}),
        })
        return inspection as unknown as RemoteSafeRecord
      },
    },
  }
}

// --- the category handlers (the async mirror of the frozen nine) ------------------------

/** One async category handler as wired by the production dispatcher. */
type S6CategoryHandler = (
  method: string,
  params: RemoteMethodParams,
  envelope: RemoteRequest,
) => Promise<RemoteHandlerOutcome>

/**
 * Wire the twelve ports into the nine category handlers.
 *
 * Every value shape mirrors the frozen handler byte-for-byte (the wire
 * contract). The claim-carrying methods derive the principal through the
 * A32 seam BEFORE the port call (the port acts on the derived caller).
 */
function buildS6CategoryHandlers(ports: S6RemotePorts, principal: ServerPrincipalDerivation) {
  return {
    [REMOTE_CATEGORIES.CATALOG]:
      ((method: string, params: RemoteMethodParams): Promise<RemoteHandlerOutcome> => {
        switch (method) {
          case 'catalog.list': {
            return ports.catalog.list().then((blueprints) => ({ data: { blueprints } }))
          }
          case 'catalog.get': {
            const getParams = params as RemoteCatalogGetParams
            return ports
              .catalog.get(getParams.blueprintId, getParams.blueprintRevision)
              .then((blueprint) => ({ data: { blueprint } }))
          }
          default:
            return Promise.reject(new Error(`catalog handler routed an unknown method: ${method}`))
        }
      }) as S6CategoryHandler,

    [REMOTE_CATEGORIES.INTENT]:
      ((method: string, params: RemoteMethodParams): Promise<RemoteHandlerOutcome> => {
        switch (method) {
          case 'intent.probe': {
            const probeParams = params as RemoteIntentProbeParams
            return ports
              .intent.probe(probeParams.blueprintId, probeParams.blueprintRevision, probeParams.environmentFacts)
              .then((compatibility) => ({ data: { compatibility } }))
          }
          default:
            return Promise.reject(new Error(`intent handler routed an unknown method: ${method}`))
        }
      }) as S6CategoryHandler,

    [REMOTE_CATEGORIES.TEAM]:
      ((method: string, params: RemoteMethodParams): Promise<RemoteHandlerOutcome> => {
        switch (method) {
          case 'team.create': {
            const createParams = params as RemoteTeamCreateParams
            return ports
              .teamCreate.create(
                createParams.rootSessionId,
                createParams.blueprintId,
                createParams.blueprintRevision,
                createParams.initialWork,
              )
              .then((created) => ({ data: { path: created['path'], durable: created['durable'], bind: created['bind'] } }))
          }
          case 'team.getProjection': {
            const projectionParams = params as RemoteTeamGetProjectionParams
            return ports.projection.project(projectionParams.teamSessionId).then((raw) => {
              const projection = normalizeS6Projection(raw)
              return {
                data: { projection },
                projectionGeneration: projection['generation'],
              }
            })
          }
          case 'team.getLedgerPage': {
            const pageParams = params as RemoteTeamGetLedgerPageParams
            return Promise.all([
              ports.ledger.listEntries(pageParams.teamSessionId),
              ports.ledger.countEntries(pageParams.teamSessionId),
            ]).then(([allEntries, total]) => {
              const entriesAfter: RemoteLedgerEntryValue[] = []
              for (const entry of allEntries) {
                if (entry.sequence > pageParams.afterSequence) entriesAfter.push(entry)
              }
              const page = entriesAfter.slice(0, pageParams.limit)
              let nextAfterSequence: number | null = null
              if (entriesAfter.length > pageParams.limit) {
                const last = page[page.length - 1]
                if (last === undefined) {
                  throw new TeamPluginError(
                    S6_REMOTE_ERROR_CODES.LEDGER_PAGE_REJECTED,
                    'internal ledger slicing error',
                    { reason: 'internal-slicing-error' },
                  )
                }
                nextAfterSequence = last.sequence
              }
              return { data: { entries: page, nextAfterSequence, total } }
            })
          }
          default:
            return Promise.reject(new Error(`team handler routed an unknown method: ${method}`))
        }
      }) as S6CategoryHandler,

    [REMOTE_CATEGORIES.MEMBER]:
      ((method: string, params: RemoteMethodParams, envelope: RemoteRequest): Promise<RemoteHandlerOutcome> => {
        switch (method) {
          case 'member.create': {
            const createParams = params as RemoteMemberCreateParams
            const request: S6RemoteAdmissionRequest = {
              rootSessionId: createParams.teamSessionId,
              action: 'create-member',
              callerClaim: createParams.caller,
              requestToken: createParams.requestToken,
              ...(createParams.delegationTemplateId !== undefined
                ? { delegationTemplateId: createParams.delegationTemplateId }
                : {}),
              ...(createParams.delegationInstanceId !== undefined
                ? { delegationInstanceId: createParams.delegationInstanceId }
                : {}),
              ...(createParams.payload !== undefined ? { payload: createParams.payload } : {}),
            }
            return Promise.resolve(
              principal({ method, request: envelope }),
            ).then((caller) => ports.admission.performAction(request, caller)).then((outcome) => ({
              data: { outcome: outcome as unknown as RemoteSafeRecord },
              effectSequence: admissionEffectSequence(outcome as unknown as Record<string, unknown>),
            }))
          }
          case 'member.send': {
            const sendParams = params as RemoteMemberSendParams
            const request: S6RemoteAdmissionRequest = {
              rootSessionId: sendParams.teamSessionId,
              action: 'send-message',
              callerClaim: sendParams.caller,
              requestToken: sendParams.requestToken,
              targetInstanceId: sendParams.recipientInstanceId,
              body: sendParams.body,
              ...(sendParams.subject !== undefined ? { subject: sendParams.subject } : {}),
              ...(sendParams.payload !== undefined ? { payload: sendParams.payload } : {}),
            }
            return Promise.resolve(
              principal({ method, request: envelope }),
            ).then((caller) => ports.admission.performAction(request, caller)).then((outcome) => ({
              data: { outcome: outcome as unknown as RemoteSafeRecord },
              effectSequence: admissionEffectSequence(outcome as unknown as Record<string, unknown>),
            }))
          }
          case 'member.followup': {
            const followupParams = params as RemoteMemberFollowupParams
            const request: S6RemoteAdmissionRequest = {
              rootSessionId: followupParams.teamSessionId,
              action: 'follow-up',
              callerClaim: followupParams.caller,
              requestToken: followupParams.requestToken,
              targetInstanceId: followupParams.targetInstanceId,
              ...(followupParams.payload !== undefined ? { payload: followupParams.payload } : {}),
            }
            return Promise.resolve(
              principal({ method, request: envelope }),
            ).then((caller) => ports.admission.performAction(request, caller)).then((outcome) => ({
              data: { outcome: outcome as unknown as RemoteSafeRecord },
              effectSequence: admissionEffectSequence(outcome as unknown as Record<string, unknown>),
            }))
          }
          case 'member.archive': {
            const lifecycleParams = params as RemoteMemberLifecycleParams
            return ports.lifecycle.archive(lifecycleParams.teamSessionId, lifecycleParams.instanceId).then((result) => ({ data: result }))
          }
          case 'member.restore': {
            const lifecycleParams = params as RemoteMemberLifecycleParams
            return ports.lifecycle.restore(lifecycleParams.teamSessionId, lifecycleParams.instanceId).then((result) => ({ data: result }))
          }
          case 'member.dispose': {
            const lifecycleParams = params as RemoteMemberLifecycleParams
            return ports.lifecycle.dispose(lifecycleParams.teamSessionId, lifecycleParams.instanceId).then((result) => ({ data: result }))
          }
          default:
            return Promise.reject(new Error(`member handler routed an unknown method: ${method}`))
        }
      }) as S6CategoryHandler,

    [REMOTE_CATEGORIES.OVERRIDE]:
      ((method: string, params: RemoteMethodParams, envelope: RemoteRequest): Promise<RemoteHandlerOutcome> => {
        switch (method) {
          case 'override.get': {
            const getParams = params as RemoteOverrideGetParams
            return ports
              .override.get(getParams.teamSessionId, getParams.capability, getParams.scope, getParams.targetInstanceId)
              .then((override) => ({ data: { override } }))
          }
          case 'override.set': {
            const setParams = params as RemoteOverrideSetParams
            const request: S6RemoteOverrideSetRequest = {
              teamSessionId: setParams.teamSessionId,
              capability: setParams.capability,
              value: setParams.value as unknown as RemoteSafeRecord,
              actorClaim: setParams.actor,
              ...(setParams.scope !== undefined ? { scope: setParams.scope } : {}),
              ...(setParams.targetInstanceId !== undefined
                ? { targetInstanceId: setParams.targetInstanceId }
                : {}),
            }
            return Promise.resolve(
              principal({ method, request: envelope }),
            ).then((caller) => ports.override.set(request, caller)).then((result) => ({ data: result }))
          }
          case 'override.reset': {
            const resetParams = params as RemoteOverrideResetParams
            const request: S6RemoteOverrideResetRequest = {
              teamSessionId: resetParams.teamSessionId,
              capability: resetParams.capability,
              actorClaim: resetParams.actor,
              ...(resetParams.scope !== undefined ? { scope: resetParams.scope } : {}),
              ...(resetParams.targetInstanceId !== undefined
                ? { targetInstanceId: resetParams.targetInstanceId }
                : {}),
            }
            return Promise.resolve(
              principal({ method, request: envelope }),
            ).then((caller) => ports.override.reset(request, caller)).then((result) => ({ data: { removed: result.removed } }))
          }
          default:
            return Promise.reject(new Error(`override handler routed an unknown method: ${method}`))
        }
      }) as S6CategoryHandler,

    [REMOTE_CATEGORIES.POLICY_STATE]:
      ((method: string, params: RemoteMethodParams, envelope: RemoteRequest): Promise<RemoteHandlerOutcome> => {
        switch (method) {
          case 'policyState.get': {
            const getParams = params as RemotePolicyStateGetParams
            return ports.policyState.read(getParams.teamSessionId).then((state) => ({ data: { state } }))
          }
          case 'policyState.set': {
            const setParams = params as RemotePolicyStateSetParams
            const request: S6RemotePolicyStateSwitchRequest = {
              teamSessionId: setParams.teamSessionId,
              target: setParams.target as unknown as RemoteSafeRecord,
              actorClaim: setParams.actor,
            }
            return Promise.resolve(
              principal({ method, request: envelope }),
            ).then((caller) => ports.policyState.switchState(request, caller)).then((transition) => ({ data: { transition } }))
          }
          default:
            return Promise.reject(new Error(`policyState handler routed an unknown method: ${method}`))
        }
      }) as S6CategoryHandler,

    [REMOTE_CATEGORIES.COMPATIBILITY]:
      ((method: string, params: RemoteMethodParams, envelope: RemoteRequest): Promise<RemoteHandlerOutcome> => {
        switch (method) {
          case 'compatibility.get': {
            const getParams = params as RemoteCompatibilityGetParams
            return ports.compatibility.current(getParams.teamSessionId).then((verdict) => ({ data: { verdict } }))
          }
          case 'compatibility.ack': {
            const ackParams = params as RemoteCompatibilityAckParams
            return Promise.resolve(
              principal({ method, request: envelope }),
            ).then((caller) =>
              ports.compatibility.acknowledge(
                ackParams.teamSessionId,
                ackParams.requirementId,
                caller,
                ackParams.note,
              ),
            ).then((verdict) => ({ data: { verdict } }))
          }
          case 'compatibility.reprobe': {
            const reprobeParams = params as RemoteCompatibilityReprobeParams
            return ports
              .compatibility.probe(reprobeParams.teamSessionId, reprobeParams.trigger)
              .then((probe) => ({ data: { probe } }))
          }
          default:
            return Promise.reject(new Error(`compatibility handler routed an unknown method: ${method}`))
        }
      }) as S6CategoryHandler,

    [REMOTE_CATEGORIES.HANDOFF]:
      ((method: string, params: RemoteMethodParams): Promise<RemoteHandlerOutcome> => {
        switch (method) {
          case 'handoff.prepare': {
            const prepareParams = params as RemoteHandoffPrepareParams
            return ports.handoff.prepareSource(prepareParams.sourceSessionId).then((summary) => ({
              data: { summary, sourceSessionId: prepareParams.sourceSessionId },
            }))
          }
          case 'handoff.create': {
            const createParams = params as RemoteHandoffCreateParams
            return ports
              .handoff.start(createParams.sourceSessionId, createParams.requestToken, createParams.staged)
              .then((state) => ({ data: { state } }))
          }
          default:
            return Promise.reject(new Error(`handoff handler routed an unknown method: ${method}`))
        }
      }) as S6CategoryHandler,

    [REMOTE_CATEGORIES.LEGACY]:
      ((method: string, params: RemoteMethodParams): Promise<RemoteHandlerOutcome> => {
        switch (method) {
          case 'legacy.inspect': {
            const inspectParams = params as RemoteLegacyInspectParams
            return ports
              .legacy.inspect(inspectParams.dshHome, inspectParams.workspaceCwd, inspectParams.projectDir)
              .then((inspection) => ({ data: { inspection } }))
          }
          default:
            return Promise.reject(new Error(`legacy handler routed an unknown method: ${method}`))
        }
      }) as S6CategoryHandler,
  }
}

/**
 * Validate the projection at the TOP LEVEL only (the frozen D-4 rule,
 * mirrored): the nine closed `TeamProjectionDto` fields must be present
 * with the right structural kinds; the nested values pass through.
 */
function normalizeS6Projection(raw: unknown): RemoteSafeRecord & { readonly generation: number } {
  if (!isPlainRecord(raw)) {
    throw new TeamPluginError(
      S6_REMOTE_ERROR_CODES.COMPATIBILITY_STATE_MALFORMED,
      `the projection port returned a malformed value (expected an object, got ${String(raw)})`,
      { reason: 'port-contract', field: 'projection' },
    )
  }
  for (const field of REMOTE_PROJECTION_FIELDS) {
    if (!(field in raw)) {
      throw new TeamPluginError(
        S6_REMOTE_ERROR_CODES.COMPATIBILITY_STATE_MALFORMED,
        `the projection port returned a malformed value (missing field '${field}')`,
        { reason: 'port-contract', field: `projection.${field}` },
      )
    }
  }
  const schemaVersion = raw['schemaVersion']
  const generation = raw['generation']
  if (!isSafeInt(schemaVersion)) {
    throw new TeamPluginError(
      S6_REMOTE_ERROR_CODES.COMPATIBILITY_STATE_MALFORMED,
      "the projection port returned a malformed 'schemaVersion'",
      { reason: 'port-contract', field: 'projection.schemaVersion' },
    )
  }
  if (!isSafeInt(generation) || generation < 1) {
    throw new TeamPluginError(
      S6_REMOTE_ERROR_CODES.COMPATIBILITY_STATE_MALFORMED,
      "the projection port returned a malformed 'generation'",
      { reason: 'port-contract', field: 'projection.generation' },
    )
  }
  return raw as RemoteSafeRecord & { readonly generation: number }
}

// --- the production dispatcher (the frozen seven invariants, async) ---------------------

/**
 * Map any failure value to a typed error result (the frozen invariants
 * 4a/4b/5, mirrored verbatim).
 */
function toS6RemoteErrorResult(error: unknown, ctx: RemoteProvenanceContext): RemoteResponse {
  // Invariant 4a: the remote layer's own typed errors keep their code.
  if (isRemoteContractError(error)) {
    const details = error.details
    const field =
      details !== undefined && typeof details['field'] === 'string' ? details['field'] : undefined
    const reason =
      details !== undefined && typeof details['reason'] === 'string'
        ? details['reason']
        : undefined
    return buildRemoteError(error.code, error.message, ctx, { field, reason })
  }
  // Invariant 4b (T12-H4): ONLY an error whose string `code` is a member of
  // the closed backing vocabulary (REMOTE_BACKING_ERROR_CODE_SET, the single
  // definition shared with the pure remote dispatcher) passes through with
  // code + message; the source identity rides under details.cause (never its
  // stack, never a live object — lossless-checked under cause.details). An
  // `Error` with an out-of-vocabulary `code` (a Node ENOENT with a path in
  // the message, a synthetic code, …) degrades to invariant 5.
  if (error instanceof Error) {
    const typed = error as Error & { readonly code?: unknown; readonly details?: unknown }
    if (typeof typed.code === 'string' && REMOTE_BACKING_ERROR_CODE_SET.has(typed.code)) {
      return buildRemoteError(typed.code, typed.message, ctx, {
        reason: 'domain-error',
        cause: { code: typed.code, message: typed.message },
        sourceDetails: typed.details,
      })
    }
  }
  // Invariant 5: an untyped throw — generic message, no leak.
  return buildRemoteError(
    REMOTE_CONTRACT_ERROR_CODES.INTERNAL_ERROR,
    'internal error in remote handler',
    ctx,
    { reason: 'untyped-error' },
  )
}

/**
 * Create the production throw-proof dispatcher (the frozen seven
 * invariants; the async mirror).
 *
 * T12-B4 — the mounted entry owns the transport's trusted
 * {@link ServerPrincipalContext}: the default is the connection-gate basis
 * (the DSH web seam's gate enforced 401/403 upstream of dispatch, so every
 * request reaching this dispatcher already passed it). A caller may pass an
 * explicit context (the production surfaces do); one that fails the
 * structural guard typed-rejects EVERY request under the existing
 * `TEAM_REMOTE_PRINCIPAL_INVALID` code — before any claim is read, with no
 * new wire code. See the `ServerPrincipalContext` authority model in
 * s6-principal for the full seam contract.
 *
 * @param ports - the twelve production ports.
 * @param principal - the installed A32 principal derivation.
 * @param principalContext - the trusted PrincipalContext of the mounting
 *   transport (defaults to the connection-gate basis).
 * @returns the seam entry point: `(endpoint, payload) => Promise<RemoteResponse>`.
 */
export function createS6RemoteDispatcher(
  ports: S6RemotePorts,
  principal: ServerPrincipalDerivation,
  principalContext?: ServerPrincipalContext,
): RemoteDispatcher {
  const handlers = buildS6CategoryHandlers(ports, principal)
  const context: ServerPrincipalContext =
    principalContext ??
    createServerPrincipalContext({ transport: SERVER_PRINCIPAL_TRANSPORTS.CONNECTION_GATE })
  const contextValid = isServerPrincipalContext(context)
  return async (endpoint: string, payload: unknown): Promise<RemoteResponse> => {
    let ctx: RemoteProvenanceContext = {
      method: endpoint,
      endpoint,
      contractVersion: REMOTE_CONTRACT_VERSION,
      requestToken: null,
    }
    let response: RemoteResponse
    try {
      // T12-B4: the trusted PrincipalContext is consulted at the mounted
      // entry, BEFORE invariant 1 — fail-closed. No derivation, no claim
      // read, no new wire code.
      if (!contextValid) {
        throw new TeamPluginError(
          S6_PRINCIPAL_ERROR_CODES.PRINCIPAL_INVALID,
          'the remote mount does not carry the connection-gate authority basis',
          { reason: 'principal-context-broken' },
        )
      }
      // Invariant 1: unknown endpoint (checked before the envelope).
      if (!isRemoteMethod(endpoint)) {
        throw remoteContractError(
          REMOTE_CONTRACT_ERROR_CODES.UNKNOWN_METHOD,
          `endpoint '${endpoint}' is not a method of the closed Remote contract v1 catalog`,
          { reason: 'unknown-endpoint' },
        )
      }
      // Invariant 2: the request envelope (closed: version + params).
      const request = parseRemoteRequest(payload)
      ctx = { ...ctx, contractVersion: request.version }
      // Invariant 3: the method's closed param schema.
      const parsed = parseRemoteMethodParams(endpoint, request.params)
      ctx = { ...ctx, requestToken: parsed.requestToken }
      // Invariant 4: the category handler (the backing port call) — the
      // async mirror awaits (the frozen dispatcher calls synchronously).
      const outcome = await handlers[remoteCategoryOf(endpoint)](endpoint, parsed.params, request)
      // Invariant 6: lossless check + provenance on the success value.
      response = buildRemoteSuccess(outcome.data, {
        ...ctx,
        projectionGeneration: outcome.projectionGeneration ?? null,
        effectSequence: outcome.effectSequence ?? null,
      })
    } catch (error) {
      response = toS6RemoteErrorResult(error, ctx)
    }
    // Invariant 7: the promise never rejects.
    return Promise.resolve(response)
  }
}

/**
 * Register the production dispatcher on the public seam (the frozen
 * register semantics, mirrored: one channel, the idempotent disposer).
 * @param ports - the twelve production ports.
 * @param principal - the installed A32 principal derivation.
 * @param principalContext - the trusted PrincipalContext of the mounting
 *   transport (T12-B4; defaults to the connection-gate basis).
 * @returns the `RemoteHandlerRegistration` the A31 seam installs.
 */
export function createS6RemoteRegistration(
  ports: S6RemotePorts,
  principal: ServerPrincipalDerivation,
  principalContext?: ServerPrincipalContext,
): RemoteHandlerRegistration {
  const dispatcher = createS6RemoteDispatcher(ports, principal, principalContext)
  return (connection: ConnectionLike): RemoteRegistration => {
    const channel = REMOTE_RPC_CHANNEL
    const handleResult = connection.rpc.handle(channel, dispatcher)
    if (typeof handleResult === 'function') {
      const disposeRegistration = handleResult as () => void
      let disposed = false
      return {
        channel,
        dispose: () => {
          if (disposed) return
          disposed = true
          disposeRegistration()
        },
      }
    }
    return { channel, dispose: () => {} }
  }
}

// --- A33 + A34 the pagination completion (the tracker gate) ------------------------------

/** The tracker cache bound (single-root host; one session per start anchor). */
const S6_TRACKER_CACHE_MAX = 16

/**
 * The A33 tracker cache: one `createLedgerPageTracker` session per
 * pagination START anchor. A request at anchor A continues the session
 * whose anchor is A (a mid-pagination continuation); any other state at
 * A starts a fresh session (a load-earlier / reconnect from A — idempotent
 * re-serve; documented). The cache is bounded (oldest evicted beyond
 * {@link S6_TRACKER_CACHE_MAX}).
 */
interface S6TrackerCache {
  trackerForAnchor(afterSequence: number): { readonly tracker: ReturnType<typeof createLedgerPageTracker> }
}

function createS6TrackerCache(): S6TrackerCache {
  const sessions = new Map<number, { readonly tracker: ReturnType<typeof createLedgerPageTracker> }>()
  return {
    trackerForAnchor(afterSequence: number) {
      const existing = sessions.get(afterSequence)
      if (existing !== undefined && existing.tracker.state().anchor === afterSequence) return existing
      const tracker = createLedgerPageTracker(afterSequence)
      sessions.set(afterSequence, { tracker })
      while (sessions.size > S6_TRACKER_CACHE_MAX) {
        const oldest = sessions.keys().next().value
        if (oldest === undefined) break
        sessions.delete(oldest)
      }
      return sessions.get(afterSequence)!
    },
  }
}

/**
 * The A34 remote query/command completion (the plan §20.5/§20.6 gate).
 *
 * `team.getLedgerPage` is gated BEFORE dispatch: the expected page is
 * computed from the durable ledger (the same slicer the dispatcher path
 * serves — dispatch is synchronous w.r.t. the durable rows, so the
 * pre-computed page IS the served page), then the tracker session for the
 * request's start anchor validates it (the 20.5/20.6 invariants: the
 * stable cursor, the load-earlier session, the growth-safe window, the
 * monotonic total). A rejected page is a typed error response BEFORE any
 * dispatch (fail-closed). Every other method passes through to the
 * dispatcher unchanged.
 *
 * The returned value is the lossless-JSON `RemoteResponse` (the seam
 * contract).
 */
export function createS6RemoteQueryCommandCompletion(
  ports: S6RemotePorts,
  options: Pick<S6RemoteOptions, 'rootSessionId'>,
  dispatcher: RemoteDispatcher,
): RemoteQueryCommandCompletion {
  const { rootSessionId } = options
  const trackers = createS6TrackerCache()

  return (input: { readonly method: string; readonly request: RemoteRequest }): Promise<unknown> => {
    const { method, request } = input
    if (method !== 'team.getLedgerPage') {
      // The non-paging query/command methods: the dispatcher is the
      // completion (the same seven invariants).
      return dispatcher(method, request)
    }
    const ctx: RemoteProvenanceContext = {
      method,
      endpoint: method,
      contractVersion: request.version,
      requestToken: null,
    }
    // 1. The bound-root guard (before anything else — a foreign TeamSession
    //    never reaches the ledger).
    const rawTeamSessionId = (request.params as Record<string, unknown>)['teamSessionId']
    if (typeof rawTeamSessionId !== 'string' || rawTeamSessionId !== rootSessionId) {
      return Promise.resolve(
        buildRemoteError(
          S6_PRINCIPAL_ERROR_CODES.FOREIGN_TEAM,
          `remote method '${method}' addresses TeamSession '${String(rawTeamSessionId)}' but this host is bound to '${rootSessionId}'`,
          ctx,
          { reason: 'foreign-team' },
        ),
      )
    }
    // 2. The closed param schema (malformed → the dispatcher reports it
    //    with the frozen codes; the pre-gate never invents a third code).
    let pageParams: RemoteTeamGetLedgerPageParams
    try {
      pageParams = parseRemoteTeamGetLedgerPageParams(method, request.params)
    } catch {
      return dispatcher(method, request)
    }
    // 3. The expected page (the D-5 slicer over the durable rows).
    return Promise.all([
      ports.ledger.listEntries(pageParams.teamSessionId),
      ports.ledger.countEntries(pageParams.teamSessionId),
    ]).then(([allEntries, total]) => {
      const entriesAfter: RemoteLedgerEntryValue[] = []
      for (const entry of allEntries) {
        if (entry.sequence > pageParams.afterSequence) entriesAfter.push(entry)
      }
      const page = entriesAfter.slice(0, pageParams.limit)
      let nextAfterSequence: number | null = null
      if (entriesAfter.length > pageParams.limit) {
        const last = page[page.length - 1]
        if (last === undefined) {
          return buildRemoteError(
            S6_REMOTE_ERROR_CODES.LEDGER_PAGE_REJECTED,
            'internal ledger slicing error',
            ctx,
            { reason: 'internal-slicing-error' },
          )
        }
        nextAfterSequence = last.sequence
      }
      const pageValue: RemoteLedgerPageValue = { entries: page, nextAfterSequence, total }
      // 4. The tracker gate (the A33 session for this start anchor).
      const session = trackers.trackerForAnchor(pageParams.afterSequence)
      const check: PageCheckResult = session.tracker.applyPage(
        { afterSequence: pageParams.afterSequence, limit: pageParams.limit },
        pageValue,
      )
      if (!check.ok) {
        return buildRemoteError(
          S6_REMOTE_ERROR_CODES.LEDGER_PAGE_REJECTED,
          `the ledger page was rejected by the pagination tracker: ${check.reason}`,
          ctx,
          { reason: check.reason },
        )
      }
      // 5. The lossless-JSON success reply (the served page).
      return buildRemoteSuccess(pageValue, {
        ...ctx,
        projectionGeneration: null,
        effectSequence: null,
      })
    })
  }
}

// --- the single entry point the production root installs ---------------------------------

/** The S6 remote surfaces the production root installs into the seams. */
export interface S6RemoteSurfaces {
  /** A31 — the registration the `remoteHandlerRegistration` seam installs. */
  readonly registration: RemoteHandlerRegistration
  /** A34 — the completion the `remoteQueryCommandCompletion` seam installs. */
  readonly completion: RemoteQueryCommandCompletion
}

/**
 * Build the complete S6 remote surface set (A31 + A33 + A34) over one
 * bound root (the single entry point the production root calls).
 *
 * T12-B4: the production surface owns the transport's trusted
 * PrincipalContext EXPLICITLY — the DSH web seam's connection gate is the
 * authority basis of every call reaching the mounted dispatcher (and the
 * completion surface), recorded here at construction, never taken from a
 * payload claim.
 *
 * @param options - the root-bound inputs.
 * @returns the registration (A31) + the completion (A34, A33-gated).
 */
export function createS6RemoteSurfaces(options: S6RemoteOptions): S6RemoteSurfaces {
  const ports = createS6RemotePorts(options)
  const principalContext = createServerPrincipalContext({
    transport: SERVER_PRINCIPAL_TRANSPORTS.CONNECTION_GATE,
  })
  const dispatcher = createS6RemoteDispatcher(ports, options.principal, principalContext)
  const completion = createS6RemoteQueryCommandCompletion(ports, options, dispatcher)
  return {
    registration: createS6RemoteRegistration(ports, options.principal, principalContext),
    completion,
  }
}
