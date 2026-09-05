/**
 * rmr-create-or-open — `createOrOpenTeamDomain` (remote-mount-race fix,
 * root cause B): the restart-safe production entry.
 *
 * The shipped bundle row boots with `bootPhase: "create-or-open"`, and the pre-fix
 * production default (`bootPhase: "create"`) threw TEAM_DOMAIN_EXISTS on
 * every returning home — the rejection was swallowed by the row bootstrap
 * (zero terminal signal: the /team-remote routes never registered and the
 * team UI failed with the frontend static handler's HTTP 405). The
 * create-or-open entry must:
 *
 *   1. FRESH   — a never-stamped medium is initialized with the full
 *                eight-store stamp, so FIRST-EVER production boots work
 *                under `resume` (pre-fix `resume` called openTeamDomain,
 *                which throws SCHEMA_STAMP_MISSING on a fresh medium —
 *                first-ever boots would have broken);
 *   2. ADOPT   — an existing stamped domain is adopted WITHOUT re-stamping
 *                (stampedAt values preserved — adopt, never touch), so
 *                RETURNING production hosts work under `resume`;
 *   3. PARTIAL — a crash between the eight stamp writes leaves a partial
 *                domain diagnosed EXACTLY as openTeamDomain diagnoses it
 *                (SCHEMA_STAMP_MISSING, the exact first missing store in
 *                canonical order) — adopt-or-initialize never papers over
 *                a partial create;
 *   4. L1      — a version-mismatched persisted domain fails at the seam
 *                open (SCHEMA_VERSION_MISMATCH) before any
 *                adopt/initialize decision;
 *   5. SEAM    — a non-seam argument fails with SEAM_FAILURE
 *                (not-a-seam), exactly as createTeamDomain does.
 *
 * Conventions mirror p4-01 (module-top-level captures — the sync shim
 * forbids async `it` bodies).
 */

import { describe, expect, it } from 'vitest'

import { TEAM_DOMAIN_NAME } from '../schema/index.js'
import {
  createOrOpenTeamDomain,
  createTeamDomain,
  openTeamDomain,
} from '../repositories/index.js'
import {
  InMemoryStorageSeam,
  P4_STORES,
  asTeamDomainError,
  capture,
  detail,
} from './p4-helpers.js'

// --- scenario 1: FRESH medium → initialize (the first-ever boot) -----------
const seamFresh = new InMemoryStorageSeam()
const freshDomain = await createOrOpenTeamDomain(seamFresh)
const freshStamps = freshDomain.repositories.schemaMeta.listStamps()
await freshDomain.close()
// the strict open entry agrees the medium is now a complete domain
const freshReopen = await capture(() => openTeamDomain(seamFresh))

// --- scenario 2: ADOPT (returning home; stamp values must survive) ---------
const seamAdopt = new InMemoryStorageSeam()
const created = await createTeamDomain(seamAdopt)
const originalStamps = new Map(created.repositories.schemaMeta.listStamps())
await created.close()
const adopted = await createOrOpenTeamDomain(seamAdopt)
const adoptedStamps = new Map(adopted.repositories.schemaMeta.listStamps())
await adopted.close()

// --- scenario 3: PARTIAL create → the exact diagnosis (never repaired) -----
const seamPartial = new InMemoryStorageSeam()
seamPartial.setCrashAfterWrites(5) // stamps 1–5 durable, the 6th write crashes
const partialCreate = await capture(() => createOrOpenTeamDomain(seamPartial))
seamPartial.clearCrash()
const partialAdopt = await capture(() => createOrOpenTeamDomain(seamPartial))
const partialStrictOpen = await capture(() => openTeamDomain(seamPartial))

// --- scenario 4: L1 version mismatch ----------------------------------------
const seamL1 = new InMemoryStorageSeam()
seamL1.seedDomainVersion(TEAM_DOMAIN_NAME, 2, [...P4_STORES])
const l1Adopt = await capture(() => createOrOpenTeamDomain(seamL1))

// --- scenario 5: non-seam argument -------------------------------------------
const notASeam = await capture(() => createOrOpenTeamDomain({} as never))

describe('rmr createOrOpenTeamDomain (adopt-or-initialize, root cause B)', () => {
  it('initializes a fresh medium with the full eight-store stamp (first-ever boot)', () => {
    expect(freshDomain.name).toBe(TEAM_DOMAIN_NAME)
    expect(freshStamps.size).toBe(8)
    for (const store of P4_STORES) {
      expect(freshStamps.get(store) !== undefined).toBe(true)
    }
    // the strict open entry agrees the medium is now a complete domain
    // (the create-equivalent, not a half-world)
    expect(freshReopen.ok).toBe(true)
    if (freshReopen.ok && freshReopen.value !== undefined) {
      expect(freshReopen.value.repositories.schemaMeta.listStamps().size).toBe(8)
    }
  })

  it('adopts an existing stamped domain WITHOUT re-stamping (returning home)', () => {
    expect(adopted.name).toBe(TEAM_DOMAIN_NAME)
    expect(adoptedStamps.size).toBe(8)
    // adopt, never touch: every stampedAt value survived byte-for-byte
    for (const [store, stamp] of originalStamps) {
      const adoptedStamp = adoptedStamps.get(store)
      expect(adoptedStamp !== undefined).toBe(true)
      if (adoptedStamp !== undefined) {
        expect(adoptedStamp.stampedAt).toBe(stamp.stampedAt)
        expect(adoptedStamp.version).toBe(stamp.version)
        expect(adoptedStamp.store).toBe(stamp.store)
      }
    }
  })

  it('diagnoses a partial create EXACTLY as the strict open entry (no repair)', () => {
    expect(partialCreate.ok).toBe(false)
    expect(partialAdopt.ok).toBe(false)
    const partialAdoptError = asTeamDomainError(partialAdopt.error)
    expect(partialAdoptError.code).toBe('SCHEMA_STAMP_MISSING')
    // the exact first missing store in canonical order (6th of 8)
    expect(detail(partialAdoptError, 'store')).toBe(P4_STORES[5])
    expect(detail(partialAdoptError, 'found')).toBe(null)
    // the strict open entry gives the identical diagnosis
    expect(partialStrictOpen.ok).toBe(false)
    const strictOpenError = asTeamDomainError(partialStrictOpen.error)
    expect(strictOpenError.code).toBe('SCHEMA_STAMP_MISSING')
    expect(detail(strictOpenError, 'store')).toBe(detail(partialAdoptError, 'store'))
  })

  it('fails a version-mismatched persisted domain at the seam open (L1)', () => {
    expect(l1Adopt.ok).toBe(false)
    const l1Error = asTeamDomainError(l1Adopt.error)
    expect(l1Error.code).toBe('SCHEMA_VERSION_MISMATCH')
  })

  it('rejects a non-seam argument with SEAM_FAILURE (not-a-seam)', () => {
    expect(notASeam.ok).toBe(false)
    const seamError = asTeamDomainError(notASeam.error)
    expect(seamError.code).toBe('SEAM_FAILURE')
    expect(detail(seamError, 'problem')).toBe('not-a-seam')
  })
})
