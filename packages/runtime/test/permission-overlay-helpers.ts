/**
 * permission-overlay-helpers — shared fixtures and the durable-world harness
 * for the Alpha.3 PR1 (PermissionOverlay Foundation) specs.
 *
 * The specs run over the REAL durable path: the testkit
 * {@link import('../../testkit/fault-injection/file-seam.mjs').FileStorageSeam}
 * file-backed `StorageDomainSeam` (the same double the governance restart
 * specs use), so every append here is a real atomic write to a scratch
 * medium. No host, no port, no model, no network.
 *
 * ISOLATION RULE: every `it` gets its OWN scratch dir
 * ({@link openWorld}), because these specs prove things about the contents of
 * a medium — a shared world would leak rows from one case into the next and
 * turn "the durable set is exactly these two snapshots" into luck. A RESTART
 * is modelled by {@link World.reopen}: a NEW seam object over the SAME
 * directory (a fresh process), never a reused handle.
 *
 * This file carries FIXTURE DATA and the world harness only — no production
 * logic. It is NOT a test file (no `.test.ts` suffix); it is type-checked
 * with the package.
 *
 * @module @dsh-agent-team/runtime/test/permission-overlay-helpers
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parseInstanceId, parseRootSessionId } from '../../contracts/src/index.js'
import type { InstanceId, RootSessionId } from '../../contracts/src/index.js'
import { destroyDir, FileStorageSeam, scratchDir } from '../../testkit/fault-injection/file-seam.mjs'
import { openPermissionOverlayStore } from '../../storage/repositories/permission-overlays.js'
import { TEAM_DOMAIN_NAME } from '../../storage/schema/index.js'
import type { PermissionOverlayStore } from '../../storage/repositories/permission-overlays.js'
import { PERMISSION_OVERLAY_STORE } from '../../storage/schema/permission-overlay.js'
import type {
  PermissionOverlayEffect,
  PermissionOverlaySnapshotInput,
} from '../../storage/schema/permission-overlay.js'
import { createPermissionOverlayRepositoryPort } from '../permission-governance/index.js'
import type { PermissionOverlayRepositoryPort } from '../permission-governance/index.js'

/** The fixture TeamSession (root session) identity. */
export const FIXTURE_TEAM_SESSION_ID: RootSessionId = parseRootSessionId('session-root-1')

/** A second fixture TeamSession — identity isolation leg. */
export const OTHER_TEAM_SESSION_ID: RootSessionId = parseRootSessionId('session-root-2')

/** The fixture MemberInstance identity. */
export const FIXTURE_INSTANCE_ID: InstanceId = parseInstanceId('inst-alpha')

/** A second fixture MemberInstance — same-team isolation leg. */
export const OTHER_INSTANCE_ID: InstanceId = parseInstanceId('inst-beta')

/**
 * One session on a durable overlay world: a scratch dir, the open store, and
 * the port built on it. A RESTART opens a NEW session over the SAME dir.
 */
export interface OverlaySession {
  /** The absolute scratch dir of this world. */
  readonly dir: string
  /** The open durable store. */
  readonly store: PermissionOverlayStore
  /** The persistence-only port over that store. */
  readonly port: PermissionOverlayRepositoryPort
}

/**
 * One durable overlay world owned by a single `it`: the session plus the
 * restart and teardown handles.
 */
export interface World extends OverlaySession {
  /** The (TeamSession, MemberInstance) pair the fixture snapshots use. */
  readonly identity: { readonly teamSessionId: string; readonly memberInstanceId: string }
  /** RESTART: a NEW seam + a NEW store handle over the SAME directory. */
  reopen(): Promise<OverlaySession>

  /** Delete the world (recursive; a no-op when absent). */
  destroy(): void
}

/**
 * Open a FRESH durable world: the scratch dir is deleted first (a crashed
 * prior run may leave a medium behind), then the overlay store is opened over
 * it. Every `it` should own one world.
 * @param name - a plain identifier naming the case (the scratch dir name).
 */
export async function openWorld(name: string): Promise<World> {
  const dir = scratchDir(`po-${name}`)
  destroyDir(dir)
  const session = await attach(dir)
  return {
    ...session,
    identity: { teamSessionId: FIXTURE_TEAM_SESSION_ID, memberInstanceId: FIXTURE_INSTANCE_ID },
    reopen: () => attach(dir),
    destroy: () => destroyDir(dir),
  }
}

async function attach(dir: string): Promise<OverlaySession> {
  const store = await openPermissionOverlayStore(new FileStorageSeam(dir))
  return {
    dir,
    store,
    port: createPermissionOverlayRepositoryPort({ repository: store.repository }),
  }
}

/**
 * One minimal, structurally valid overlay snapshot input.
 * @param generation - the metadata generation to stamp.
 * @param overrides - field overrides for the negative / leg-specific cases.
 */
export function snapshotInput(
  generation: number,
  overrides: {
    readonly teamSessionId?: string
    readonly memberInstanceId?: string
    readonly previousSnapshotId?: string | null
    readonly rules?: readonly { operation: string; resource: string; effect: PermissionOverlayEffect }[]
    readonly actor?: string
    readonly mutationId?: string
    readonly timestamp?: string
    readonly reason?: string
  } = {},
): PermissionOverlaySnapshotInput {
  const teamSessionId = overrides.teamSessionId ?? FIXTURE_TEAM_SESSION_ID
  const memberInstanceId = overrides.memberInstanceId ?? FIXTURE_INSTANCE_ID
  return {
    identity: { teamSessionId, memberInstanceId },
    state: {
      rules:
        overrides.rules ?? [{ operation: 'write', resource: 'output/result.json', effect: 'allow' }],
    },
    metadata: {
      generation,
      previousSnapshotId:
        overrides.previousSnapshotId ?? (generation === 1 ? null : snapshotKeyAt(teamSessionId, memberInstanceId, generation - 1)),
    },
    provenance: {
      actor: overrides.actor ?? 'leader:inst-root',
      mutationId: overrides.mutationId ?? `mut-${String(generation)}`,
      timestamp: overrides.timestamp ?? '2026-10-01T12:00:00.000Z',
      reason: overrides.reason ?? `fixture generation ${String(generation)}`,
    },
  }
}

/**
 * The durable snapshot key of one (identity, generation) position, computed
 * HERE — independently of the implementation — so the chain and CAS legs
 * assert the contract instead of echoing the implementation's own output.
 */
export function snapshotKeyAt(teamSessionId: string, memberInstanceId: string, generation: number): string {
  return `${teamSessionId}#${memberInstanceId}#${String(generation)}`
}

/** The fixture world's generation-`n` key (TeamSession 1 / instance alpha). */
export function fixtureKey(generation: number): string {
  return snapshotKeyAt(FIXTURE_TEAM_SESSION_ID, FIXTURE_INSTANCE_ID, generation)
}

/**
 * Read the raw durable rows of the overlay store straight off the medium:
 * `{ <row key>: <stored canonical JSON string> }`. This is the byte-level
 * evidence the immutability and never-overwrite legs compare against.
 * @param dir - the world's scratch dir.
 */
export function rawOverlayRows(dir: string): Record<string, string> {
  const path = join(dir, TEAM_DOMAIN_NAME, `${PERMISSION_OVERLAY_STORE}.json`)
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>
}

/** Deep clone of a raw-row map (a byte-stability baseline). */
export function cloneRows(rows: Record<string, string>): Record<string, string> {
  return JSON.parse(JSON.stringify(rows)) as Record<string, string>
}

/** Read the `code` of a thrown TeamDomain error (duck-typed). */
export function errorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code: unknown }).code)
  }
  return undefined
}

/** Read the `details.problem` tag of a thrown error (duck-typed). */
export function errorProblem(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'details' in error) {
    const details = (error as { details?: unknown }).details
    if (typeof details === 'object' && details !== null && 'problem' in details) {
      return String((details as Record<string, unknown>)['problem'])
    }
  }
  return undefined
}

/** Run `fn`, returning its result or its thrown error. */
export async function capture<T>(fn: () => Promise<T> | T): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
  try {
    return { ok: true, value: await fn() }
  } catch (error) {
    return { ok: false, error }
  }
}
