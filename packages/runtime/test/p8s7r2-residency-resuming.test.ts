/**
 * p8s7r2-residency-resuming.test.ts — R2-5 (P8-S7-R2): F12 the residency
 * tri-state (BQ-07 "residency diagnostic"; UI §24 "resident / cold /
 * resuming").
 *
 * The repair: `resuming` was NOT derivable (S6 open item — the overlay's
 * old module docs stated so). The mechanism (R2 card): the live glue owns
 * a per-session EPHEMERAL resuming marker (agent-bindings.mjs
 * `resumingSessions` — written at the production resume points,
 * `ensureLiveAgent` and the boot resume phase; cleared when the resume
 * settles, success or failure) and exposes it through `isResuming`; the
 * production overlay (s6-live-overlay.ts) reports the frozen tri-state
 * `resident` > `resuming` > `cold` per row. The DISPOSED exclusion and
 * the overlay's read-only-ness are unchanged by this repair.
 *
 * Test-level scope honesty: this suite unit-tests the OVERLAY against a
 * stub live binding (structural `TeamAgentBindings` surface with a
 * call-recording, foreign-access-throwing Proxy). The glue bundle itself
 * cannot be imported in-chain (its module-scope `@deepseek-ai/*` imports
 * are unresolvable in the runner process); the glue marker wiring is
 * covered by (a) the production `node --check` + import smoke over the
 * rebuilt dist in the C7 battery, and (b) the live harness E2E (C7),
 * whose resume-bearing scenarios boot the real glue. The frozen
 * residency vocabulary (RESIDENCY_STATES incl. `resuming`) and the
 * MemberLiveActivityDto shape are PRE-EXISTING contract facts — this
 * repair adds no contract surface.
 *
 * Runner note: the plain-node shim forbids async `it()` bodies — every
 * assertion here is synchronous (the overlay snapshot is a pure
 * synchronous read).
 * @module @dsh-agent-team/runtime/test/p8s7r2-residency-resuming
 */

import { describe, expect, it } from 'vitest'
import {
  MEMBER_LIFECYCLE_STATES,
  RESIDENCY_STATES,
} from '../../contracts/src/index.js'
import type { InstanceId } from '../../contracts/src/index.js'
import { createLiveResidencyOverlay } from '../src/plugin/s6-live-overlay.js'

const ROOT_SID = 'session-p8s7r2r'
const FIXED_NOW = '2026-09-02T00:00:00.000Z'
const CREATED_AT = '2026-08-01T00:00:00.000Z'

const LEADER_ID = 'inst-p8s7r2rleader' as InstanceId
const WA_ID = 'inst-p8s7r2rwa' as InstanceId
const WB_ID = 'inst-p8s7r2rwb' as InstanceId
const WC_ID = 'inst-p8s7r2rwc' as InstanceId
const WD_ID = 'inst-p8s7r2rd' as InstanceId
const WA_CHILD = 'session-child-p8s7r2rwa'
const WB_CHILD = 'session-child-p8s7r2rwb'
const WC_CHILD = 'session-child-p8s7r2rwc'
const WD_CHILD = 'session-child-p8s7r2rd'

/** The durable rows the fake repository surface returns (one world). */
const ROWS: readonly Record<string, unknown>[] = [
  // The v2-shaped leader row: NO childSessionId / lifecycle keys (the
  // documented type lie) — the overlay resolves it against the root.
  {
    schemaVersion: 1,
    rootSessionId: ROOT_SID,
    instanceId: LEADER_ID,
    templateId: 'leader',
    label: 'Leader',
    createdAt: CREATED_AT,
  },
  {
    schemaVersion: 1,
    rootSessionId: ROOT_SID,
    instanceId: WA_ID,
    templateId: 'worker',
    label: 'WA',
    childSessionId: WA_CHILD,
    lifecycle: MEMBER_LIFECYCLE_STATES.CREATED,
    createdAt: CREATED_AT,
    activityVersion: 1,
  },
  {
    schemaVersion: 1,
    rootSessionId: ROOT_SID,
    instanceId: WB_ID,
    templateId: 'worker',
    label: 'WB',
    childSessionId: WB_CHILD,
    lifecycle: MEMBER_LIFECYCLE_STATES.RUNNING,
    createdAt: CREATED_AT,
    activityVersion: 1,
  },
  {
    schemaVersion: 1,
    rootSessionId: ROOT_SID,
    instanceId: WC_ID,
    templateId: 'worker',
    label: 'WC',
    childSessionId: WC_CHILD,
    lifecycle: MEMBER_LIFECYCLE_STATES.SETTLED,
    createdAt: CREATED_AT,
    activityVersion: 1,
  },
  // The DISPOSED row: excluded from the snapshot (no live facts).
  {
    schemaVersion: 1,
    rootSessionId: ROOT_SID,
    instanceId: WD_ID,
    templateId: 'worker',
    label: 'WD',
    childSessionId: WD_CHILD,
    lifecycle: MEMBER_LIFECYCLE_STATES.DISPOSED,
    createdAt: CREATED_AT,
    activityVersion: 1,
  },
]

/**
 * A stub live binding: the two overlay surfaces (hasLive / isResuming)
 * over the given resident/resuming sets, behind a Proxy that RECORDS every
 * call and THROWS on any foreign property access (the read-only-ness
 * proof — the overlay may only read the two residency surfaces).
 */
function makeLive(resident: readonly string[], resuming: readonly string[]) {
  const calls: string[] = []
  const target: Record<string, unknown> = {
    hasLive: (sid: string) => {
      calls.push(`hasLive:${sid}`)
      return resident.includes(sid)
    },
    isResuming: (sid: string) => {
      calls.push(`isResuming:${sid}`)
      return resuming.includes(sid)
    },
  }
  const live = new Proxy(target, {
    get(t, prop) {
      if (prop === 'hasLive' || prop === 'isResuming') return t[prop as string]
      throw new Error(
        `p8s7r2-residency: the overlay touched a foreign live surface: ${String(prop)}`,
      )
    },
  })
  return { live: live as never, calls }
}

/** One overlay snapshot over the fixed row set, with the probe log. */
function snapshotWith(resident: readonly string[], resuming: readonly string[]) {
  const { live, calls } = makeLive(resident, resuming)
  let listCalls = 0
  const repos = {
    memberInstances: {
      list: (_root: string) => {
        listCalls += 1
        return ROWS
      },
    },
  }
  const port = createLiveResidencyOverlay({
    repositories: repos as never,
    live,
    rootSessionId: ROOT_SID,
    now: () => FIXED_NOW,
  })
  const snap = port.snapshot()
  return { snap, calls, listCalls }
}

describe('p8s7r2-residency: F12 the residency tri-state (R2-5, BQ-07, UI §24)', () => {
  it('R25.1 F12: a live member reports resident with the injected clock stamp (and the short-circuit never probes the marker)', () => {
    const { snap, calls } = snapshotWith([WA_CHILD], [])
    expect(snap.get(WA_ID)).toEqual({
      residency: RESIDENCY_STATES.resident,
      lastActivityAt: FIXED_NOW,
    })
    expect(calls.includes(`hasLive:${WA_CHILD}`)).toBe(true)
    expect(calls.includes(`isResuming:${WA_CHILD}`)).toBe(false)
  })

  it('R25.2 F12: a cold member with an in-flight glue resume reports resuming (no clock stamp — the row is not live yet)', () => {
    const { snap } = snapshotWith([], [WB_CHILD])
    // toEqual is exact: a stray lastActivityAt / any extra key fails.
    expect(snap.get(WB_ID)).toEqual({ residency: RESIDENCY_STATES.resuming })
  })

  it('R25.3 F12: a cold member without a marker reports cold (the unchanged baseline)', () => {
    const { snap } = snapshotWith([], [])
    expect(snap.get(WB_ID)).toEqual({ residency: RESIDENCY_STATES.cold })
    expect(snap.get(WC_ID)).toEqual({ residency: RESIDENCY_STATES.cold })
  })

  it('R25.4 F12: a DISPOSED row is excluded even when its session carries the resuming marker (exclusion unchanged; no residency probe for it)', () => {
    const { snap, calls } = snapshotWith([], [WD_CHILD])
    expect(snap.has(WD_ID)).toBe(false)
    expect(calls.some((c) => c.includes(WD_CHILD))).toBe(false)
  })

  it('R25.5 F12: the v2 leader row (no childSessionId) resolves the resuming marker against the root session', () => {
    const resuming = snapshotWith([], [ROOT_SID])
    expect(resuming.snap.get(LEADER_ID)).toEqual({ residency: RESIDENCY_STATES.resuming })
    const live = snapshotWith([ROOT_SID], [])
    expect(live.snap.get(LEADER_ID)).toEqual({
      residency: RESIDENCY_STATES.resident,
      lastActivityAt: FIXED_NOW,
    })
  })

  it('R25.6 F12: the snapshot is a pure read — only hasLive/isResuming on the live surface, one repository list, and every non-DISPOSED row is present', () => {
    const { snap, calls, listCalls } = snapshotWith([WA_CHILD], [WB_CHILD])
    expect(snap.size).toBe(4) // leader + 3 non-DISPOSED members
    expect(listCalls).toBe(1)
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.every((c) => c.startsWith('hasLive:') || c.startsWith('isResuming:'))).toBe(true)
  })

  it('R25.7 F12: per-session marker scoping — resident / resuming / cold coexist in one snapshot', () => {
    const { snap } = snapshotWith([WA_CHILD], [WB_CHILD])
    expect(snap.get(WA_ID)?.residency).toBe(RESIDENCY_STATES.resident)
    expect(snap.get(WB_ID)?.residency).toBe(RESIDENCY_STATES.resuming)
    expect(snap.get(WC_ID)?.residency).toBe(RESIDENCY_STATES.cold)
  })
})
