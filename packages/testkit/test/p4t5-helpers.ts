/**
 * p4t5-helpers — shared fixtures and the FILE-BACKED fault-injection realm
 * lifecycle for the P4-T5 (crash/restart) tests (ruling R22).
 *
 * The P4-T5 process-restart model:
 *
 * - a "realm" is the whole in-memory stack over one scratch dir: one
 *   {@link FileStorageSeam} (the file-backed seam), one TeamDomain
 *   (`createTeamDomain` / `openTeamDomain` over the seam), one fresh
 *   deterministic `FakeAgentFactoryAdapter`, and one
 *   `ProvisioningCoordinator` — i.e. everything the OS process would hold;
 * - a "crash" is the seam-level armed `CrashFault` firing mid-durable-write
 *   (the tmp file is left behind, the target keeps the old bytes);
 * - a "process restart" is {@link dropRealm} (ALL in-memory state lost)
 *   followed by {@link reopenRealm} (a brand-new seam + repository +
 *   journal + binding + provisioning stack constructed over the SAME
 *   scratch dir). Durable files outlive the realm; the fresh stack
 *   rehydrates from them.
 *
 * No `node:` builtin is imported here (zero-core `.ts` rule): every
 * filesystem operation goes through the `.mjs` harness (file-seam.mjs),
 * which is the only testkit module allowed to touch them.
 *
 * @module p4t5-helpers
 */

import {
  CrashFault,
  FileStorageSeam,
  scratchDir,
  destroyDir,
} from '../fault-injection/file-seam.mjs'
import {
  parseChildSessionId,
  parseInstanceId,
  parseRootSessionId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import type { ChildSessionId, InstanceId, RootSessionId, TemplateId } from '../../contracts/src/index.js'
import { createTeamDomain, openTeamDomain, type TeamDomain } from '../../storage/repositories/index.js'
import { isTeamDomainError, TEAM_DOMAIN_NAME, type TeamDomainError } from '../../storage/schema/index.js'
import {
  createProvisioningCoordinator,
  deterministicToken,
  FakeAgentFactoryAdapter,
  PROVISIONING_STAGES,
  provisioningOperationId,
  type ProvisionRequest,
  type ProvisioningCoordinator,
  type ProvisioningStage,
} from '../../storage/provisioning/index.js'

/**
 * Copy the committed `committed-world` fixture into a fresh scratch dir
 * (re-exported so the tests consume it through one module boundary).
 */
export { copyFixtureIntoScratch } from '../fault-injection/file-seam.mjs'

/**
 * The P4-T5 fixture identities (the same id VALUES as the P4-T1/T4
 * `P4_FIXTURE` so the seam-write arithmetic and child ids stay comparable
 * across tasks; re-derived here because cross-package access is via
 * production modules only).
 */
export const P4T5_FIXTURE = {
  rootSessionId: parseRootSessionId('session-root-1'),
  otherRootSessionId: parseRootSessionId('session-root-2'),
  instanceId: parseInstanceId('inst-alpha'),
  secondInstanceId: parseInstanceId('inst-beta'),
  templateId: parseTemplateId('researcher'),
  createdAt: '2026-08-29T12:00:00Z',
}

/**
 * The deterministic child session id the fresh (restarted) fake adapter
 * re-derives for the fixture member — `session-child-<token>` where the
 * token is the identity's deterministic base36 rendering (the fake's
 * idempotent-minting contract).
 */
export const P4T5_CHILD_SESSION_ID: ChildSessionId = parseChildSessionId(
  `session-child-${deterministicToken(`${String(P4T5_FIXTURE.rootSessionId)}\u0000${String(P4T5_FIXTURE.instanceId)}`, 16)}`,
)

/** The canonical provisioning request of the fixture member (inst-alpha). */
export const P4T5_REQUEST = {
  instanceId: P4T5_FIXTURE.instanceId,
  templateId: P4T5_FIXTURE.templateId,
  label: 'Alpha Researcher',
  allocationToken: 'p4t5-alloc-alpha-1',
} as const

/**
 * Build one provisioning request. `overrides` replace individual fields so
 * tests can derive variants (a second member, a different allocation
 * token) without mutating the canonical request.
 */
export function provisionRequest(
  overrides: {
    instanceId?: InstanceId | string
    templateId?: TemplateId | string
    label?: string
    groupId?: string
    workspace?: string
    allocationToken?: string
  } = {},
): ProvisionRequest {
  return {
    instanceId: overrides.instanceId ?? P4T5_REQUEST.instanceId,
    templateId: overrides.templateId ?? P4T5_REQUEST.templateId,
    label: overrides.label ?? P4T5_REQUEST.label,
    ...(overrides.groupId !== undefined ? { groupId: overrides.groupId } : {}),
    ...(overrides.workspace !== undefined ? { workspace: overrides.workspace } : {}),
    allocationToken: overrides.allocationToken ?? P4T5_REQUEST.allocationToken,
  }
}

/**
 * One in-memory stack over one scratch dir: the file seam, the TeamDomain,
 * the fake adapter, and the provisioning coordinator. Dropping the realm
 * (losing every reference) is the process-death model; the durable files
 * in `dir` outlive it.
 */
export interface P4t5Realm {
  /** The scratch dir holding the durable state. */
  readonly dir: string
  /** The file-backed seam (crash arming + write accounting). */
  readonly seam: FileStorageSeam
  /** The open TeamDomain over the seam. */
  readonly domain: TeamDomain
  /** The deterministic external-effect adapter (fresh per realm). */
  readonly adapter: FakeAgentFactoryAdapter
  /** The team-scoped provisioning coordinator. */
  readonly coordinator: ProvisioningCoordinator
}

/**
 * Build the in-memory stack over an open TeamDomain (fresh adapter +
 * coordinator — what a fresh process constructs).
 */
function buildRealm(dir: string, seam: FileStorageSeam, domain: TeamDomain, rootSessionId: RootSessionId | string): P4t5Realm {
  const adapter = new FakeAgentFactoryAdapter()
  const coordinator = createProvisioningCoordinator({ domain, rootSessionId, adapter })
  return { dir, seam, domain, adapter, coordinator }
}

/**
 * Create a FRESH file-backed realm: a fresh scratch dir + seam,
 * `createTeamDomain` (the eight schema_meta stamp writes), a fresh adapter
 * and coordinator.
 * @param scratchBaseName - the per-test scratch dir name.
 * @param rootSessionId - the team the coordinator is scoped to (default fixture root).
 */
export async function createFileRealm(
  scratchBaseName: string,
  rootSessionId: RootSessionId | string = P4T5_FIXTURE.rootSessionId,
): Promise<P4t5Realm> {
  const dir = scratchDir(scratchBaseName)
  const seam = new FileStorageSeam(dir)
  const domain = await createTeamDomain(seam)
  return buildRealm(dir, seam, domain, rootSessionId)
}

/**
 * RESTART over an existing scratch dir (the process-restart model): a
 * brand-new seam + `openTeamDomain` + fresh adapter + coordinator over the
 * SAME durable files. This is the P4-T5 stand-in for an OS process
 * restart; a real process + real StorageDomain binding is P5 runtime
 * territory (DevPlan §17.5 criterion 7).
 * @param dir - the scratch dir holding the durable state (from a dropped realm).
 * @param rootSessionId - the team the coordinator is scoped to (default fixture root).
 */
export async function reopenRealm(
  dir: string,
  rootSessionId: RootSessionId | string = P4T5_FIXTURE.rootSessionId,
): Promise<P4t5Realm> {
  const seam = new FileStorageSeam(dir)
  const domain = await openTeamDomain(seam)
  return buildRealm(dir, seam, domain, rootSessionId)
}

/**
 * Kill the realm (process death): best-effort close of the domain and the
 * seam, then the realm's in-memory state is simply lost. The durable files
 * in `realm.dir` are untouched.
 */
export async function dropRealm(realm: P4t5Realm): Promise<void> {
  try {
    await realm.domain.close()
  } catch {
    // a crashed process performs no clean close — best effort only
  }
  try {
    await realm.seam.closeAll()
  } catch {
    // best effort only
  }
}

/**
 * Delete a scratch dir (recursive, force). Call from the test's finally
 * block on BOTH success and failure so the worktree stays clean.
 */
export function destroyScratch(dir: string): void {
  destroyDir(dir)
}

/** The eight `schema_meta` stamp writes `createTeamDomain` performs. */
export const STAMP_WRITE_COUNT = 8

/**
 * Arm a crash AFTER exactly `base + offset` total seam writes: the first
 * `base + offset` writes commit, every later write throws the seam's
 * `CrashFault` (STICKY — the restart constructs a new seam, so no explicit
 * disarm is ever needed across a restart). `base` is the seam writeCount
 * snapshot after realm creation (the eight schema_meta stamps).
 */
export function armCrashAt(seam: FileStorageSeam, base: number, offset: number): void {
  seam.armCrashAfterWrites(base + offset)
}

/** The result of a guarded async call. */
export interface Captured<T = unknown> {
  /** True when the call succeeded. */
  readonly ok: boolean
  /** The thrown error, or `undefined` when the call succeeded. */
  readonly error: unknown
  /** The return value, or `undefined` when the call threw. */
  readonly value: T
}

/** Run `fn` (sync or async), capturing its error or value without re-throwing. */
export function capture<T>(fn: () => T | Promise<T>): Promise<Captured<T>> {
  return Promise.resolve()
    .then(() => fn())
    .then(
      (value: T): Captured<T> => ({ ok: true, error: undefined, value }),
      (error: unknown): Captured<T> => ({ ok: false, error, value: undefined as unknown as T }),
    )
}

/** True when `error` is a `TeamDomainError` with exactly `code`. */
export function hasTeamDomainCode(error: unknown, code: string): boolean {
  return isTeamDomainError(error) && (error as TeamDomainError).code === code
}

/** The `details` payload of a `TeamDomainError` (or `undefined`). */
export function detailOf(error: unknown): Record<string, unknown> | undefined {
  if (!isTeamDomainError(error)) return undefined
  const details = (error as TeamDomainError).details
  return details !== undefined ? { ...details } : undefined
}

/** True when `error` is the seam's armed-fault `CrashFault`. */
export function isCrashFault(error: unknown): boolean {
  return error instanceof CrashFault || (error instanceof Error && error.name === 'CrashFault')
}

/** The deterministic operation id of one provisioning request under one team. */
export function operationIdFor(rootSessionId: string, request: ProvisionRequest): string {
  return provisioningOperationId(rootSessionId, String(request.instanceId))
}

/** One row of the frozen Development Plan §17.4 fault-injection matrix. */
export interface BoundarySpec {
  readonly id: string
  readonly boundary: string
  /** Seam writes applied before the crash fires (0 = before any provisioning write). */
  readonly offset: number
  /** False for the no-crash boundaries (B7 "after MemberInstance commit", B10 "after committed"). */
  readonly crashes: boolean
  /** Seam writes the post-restart recovery drive must perform (8 - offset). */
  readonly expectedRecoveryWrites: number
  /** The derived stage of the durable state the crash leaves. */
  readonly expectedPostCrashStage: ProvisioningStage
}

/**
 * The ten frozen Development Plan §17.4 boundaries with the seam-write
 * arithmetic (fresh world): W1 op PREPARED, W2 child recorded on op row,
 * W3 member record, W4 binding, W5 ledger counter boot, W6 counter bump,
 * W7 fact, W8 COMMITTED row. B2/B3 share one seam boundary (the adapter
 * call performs NO seam write); B6/B8 share the same seam state (the ledger
 * write is the first commit write).
 */
export const BOUNDARIES: readonly BoundarySpec[] = [
  { id: 'B1', boundary: 'before op prepare', offset: 0, crashes: true, expectedRecoveryWrites: 8, expectedPostCrashStage: PROVISIONING_STAGES.NONE },
  { id: 'B2', boundary: 'after op prepare', offset: 1, crashes: true, expectedRecoveryWrites: 7, expectedPostCrashStage: PROVISIONING_STAGES.ALLOCATED },
  { id: 'B3', boundary: 'before child create (same seam state as B2: the adapter call performs no seam write)', offset: 1, crashes: true, expectedRecoveryWrites: 7, expectedPostCrashStage: PROVISIONING_STAGES.ALLOCATED },
  { id: 'B4', boundary: 'after child create', offset: 2, crashes: true, expectedRecoveryWrites: 6, expectedPostCrashStage: PROVISIONING_STAGES.CHILD_SESSION_CREATED },
  { id: 'B5', boundary: 'before SessionBinding', offset: 3, crashes: true, expectedRecoveryWrites: 5, expectedPostCrashStage: PROVISIONING_STAGES.CHILD_SESSION_CREATED },
  { id: 'B6', boundary: 'before MemberInstance commit', offset: 4, crashes: true, expectedRecoveryWrites: 4, expectedPostCrashStage: PROVISIONING_STAGES.CHILD_BOUND },
  { id: 'B7', boundary: 'after MemberInstance commit (no crash)', offset: 8, crashes: false, expectedRecoveryWrites: 0, expectedPostCrashStage: PROVISIONING_STAGES.INSTANCE_COMMITTED },
  { id: 'B8', boundary: 'before ledger (same seam state as B6: the ledger write is the first commit write)', offset: 4, crashes: true, expectedRecoveryWrites: 4, expectedPostCrashStage: PROVISIONING_STAGES.CHILD_BOUND },
  { id: 'B9', boundary: 'before operation committed (fact durable, COMMITTED row not written)', offset: 7, crashes: true, expectedRecoveryWrites: 1, expectedPostCrashStage: PROVISIONING_STAGES.CHILD_BOUND },
  { id: 'B10', boundary: 'after committed (no crash)', offset: 8, crashes: false, expectedRecoveryWrites: 0, expectedPostCrashStage: PROVISIONING_STAGES.INSTANCE_COMMITTED },
]

/** The durable domain name (re-export convenience for the tests). */
export const FAULT_DOMAIN_NAME: string = TEAM_DOMAIN_NAME

/**
 * The durable table file of one store under one scratch dir (forward-slash
 * join — valid on every platform node runs on; no `node:` import needed).
 */
export function durableTablePath(scratchDirPath: string, table: string): string {
  return `${scratchDirPath}/${TEAM_DOMAIN_NAME}/${table}.json`
}

/** The L1 domain-stamp meta file under one scratch dir. */
export function durableMetaPath(scratchDirPath: string): string {
  return `${scratchDirPath}/${TEAM_DOMAIN_NAME}.meta.json`
}

/**
 * Canonical (sorted-key, no whitespace) JSON — byte-compatible with the
 * contracts `canonicalJsonStringify` for plain remote-safe values. Used to
 * re-serialize a tampered row without perturbing its canonical byte form.
 */
export function canonicalStringify(value: unknown): string {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk)
    if (v !== null && typeof v === 'object') {
      const out: Record<string, unknown> = {}
      for (const key of Object.keys(v as Record<string, unknown>).sort()) {
        out[key] = walk((v as Record<string, unknown>)[key])
      }
      return out
    }
    return v
  }
  return JSON.stringify(walk(value))
}
