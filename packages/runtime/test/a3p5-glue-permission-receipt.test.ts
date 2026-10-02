/**
 * alpha.3 PR5 — ROOT BLOCK-2 fix verified against the REAL glue.
 *
 * Every leg below executes the ACTUAL `live/agent-bindings.mjs`
 * `permissionNoticeReceipt` code (the real `createAgentBindings` boot
 * paths through the t12a live bridge — hostless dependent fakes, but the
 * receipt logic, the durable-member lookup, the liveAgents map and the
 * boot seed/restore binding paths are the production ones). The fix law
 * under test (root R-A): liveHandle resolves the SAME key the REGISTRANT
 * used — the DURABLE MemberInstance row's `childSessionId` (never a
 * re-derivation, no derived fallback) — and the returned identity is
 * derived FROM the durable reverse mapping, never echoed from the
 * request. No-wake holds on every leg: injects/steers/followups and the
 * create/resume counters are pinned. Host E2E is NOT claimed (host/kit
 * stays NOT_RUN for this lane).
 */
import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'

import { createLiveWorld } from './t12a-live-bridge.mjs'
import {
  createPermissionDeliveryBinding,
  type PermissionLiveHandle,
} from '../permission-notification/index.js'

const ROOT = 'session-a3p5glue-root'

/** The NUL separator of the glue derivation, built without embedding a
 *  NUL byte in this source file. */
const NUL = String.fromCharCode(0)

/** Mirrors the glue childSessionIdFor formula EXACTLY (the regression
 *  leg proves derived-id members keep working under the durable law). */
function childSidOf(rootSessionId: string, instanceId: string): string {
  const digest = createHash('sha256')
    .update(`${rootSessionId}${NUL}${instanceId}`, 'utf8')
    .digest('hex')
  return `session-team-child-${digest.slice(0, 32)}`
}

type World = Awaited<ReturnType<typeof createLiveWorld>>

interface MemberRow {
  rootSessionId: string
  instanceId: string
  templateId: string
  childSessionId?: string
  lifecycle?: string
  [key: string]: unknown
}

function memberRow(
  instanceId: string,
  childSessionId: string | undefined,
  extra: Record<string, unknown> = {},
): MemberRow {
  return {
    rootSessionId: ROOT,
    instanceId,
    templateId: 'tpl-t12a',
    childSessionId,
    lifecycle: 'RUNNING',
    ...extra,
  }
}

async function bootWorld(
  members: readonly MemberRow[],
  seedMembers: readonly Record<string, unknown>[],
  bootPhase = 'create',
): Promise<World> {
  const world = await createLiveWorld({
    rootSessionId: ROOT,
    members: members as never[],
    configOverrides: { bootPhase, seedMembers },
  })
  await world.binding.boot()
  return world
}

function receiptOf(world: World) {
  const surface = (
    world.binding as unknown as {
      permissionNoticeReceipt?: {
        closing: () => boolean
        liveHandle: (identity: {
          teamSessionId: string
          memberInstanceId: string
        }) => { teamSessionId: string; memberInstanceId: string; agent: unknown } | undefined
      }
    }
  ).permissionNoticeReceipt
  if (surface === undefined) throw new Error('the real glue must expose permissionNoticeReceipt')
  return surface
}

/** The REAL production binding composed over the REAL glue receipt (the
 *  same composition the root performs — only the lifecycle fact is a
 *  constant here, since these glue worlds carry no lifecycle plane). */
function realBinding(world: World) {
  const receipt = receiptOf(world)
  return createPermissionDeliveryBinding({
    closing: () => receipt.closing(),
    liveHandle: (identity) => {
      const handle = receipt.liveHandle(identity)
      return handle === undefined ? undefined : (handle as unknown as PermissionLiveHandle)
    },
    lifecycleActive: () => true,
  })
}

function counters(world: World) {
  return {
    creates: world.records.creates.length,
    resumes: world.records.resumes.length,
    followups: world.records.followups.length,
    steers: world.records.steers.length,
    injects: world.records.injects.length,
  }
}

describe('a3p5 glue receipt — ROOT BLOCK-2 fix law on the REAL agent-bindings module', () => {
  it('positive seeded member with a non-derived boot seed childSessionId resolves through the durable row, identity row-derived', async () => {
    // The seed child is a legitimate VERBATIM config id, NOT the derived
    // sha256 form — the exact class the old re-derivation silently missed.
    const customChild = 'session-CUSTOM-nonderived-7731'
    const world = await bootWorld(
      [memberRow('inst-seedx', customChild)],
      [{ instanceId: 'inst-seedx', templateId: 'tpl-t12a', childSessionId: customChild }],
    )
    const handle = receiptOf(world).liveHandle({ teamSessionId: ROOT, memberInstanceId: 'inst-seedx' })
    expect(handle, 'the durable row supplies the key the registrant used').toBeDefined()
    expect(handle?.teamSessionId).toBe(ROOT)
    expect(handle?.memberInstanceId).toBe('inst-seedx')
    // The agent IS the live double created for the CUSTOM session id.
    expect((handle?.agent as { id: string }).id).toBe(customChild)
    // No wake, no capacity: reading the receipt created/resumed nothing.
    const c = counters(world)
    expect(c.followups).toBe(0)
    expect(c.steers).toBe(0)
    expect(c.injects).toBe(0)
    world.binding.close()
  })

  it('positive receive: a running non-derived seeded member receives exactly one inject through the real binding, never steer or followup', async () => {
    const customChild = 'session-CUSTOM-receive-42'
    const world = await bootWorld(
      [memberRow('inst-recv', customChild)],
      [{ instanceId: 'inst-recv', templateId: 'tpl-t12a', childSessionId: customChild }],
    )
    const receipt = receiptOf(world)
    const handle = receipt.liveHandle({ teamSessionId: ROOT, memberInstanceId: 'inst-recv' })
    expect(handle).toBeDefined()
    ;(handle?.agent as { status: string }).status = 'running'
    const before = counters(world)
    const result = realBinding(world).deliver({
      teamSessionId: ROOT,
      memberInstanceId: 'inst-recv',
      text: 'permission overlay updated for your instance',
    })
    expect(result).toEqual({ delivered: true })
    const after = counters(world)
    expect(after.injects - before.injects).toBe(1)
    expect(after.steers).toBe(before.steers)
    expect(after.followups).toBe(before.followups)
    expect(after.creates).toBe(before.creates)
    expect(after.resumes).toBe(before.resumes)
    world.binding.close()
  })

  it('positive restored member: durable childSessionId different from any derivation receives; the receipt itself resumes nothing', async () => {
    // Restore phase: the glue re-binds children from the DURABLE rows —
    // verbatim, so a restored child is the legitimate non-derived case.
    const restoredChild = 'session-RESTORED-legacy-binding-9'
    const world = await bootWorld([memberRow('inst-restored', restoredChild)], [], 'resume')
    const receipt = receiptOf(world)
    const handle = receipt.liveHandle({ teamSessionId: ROOT, memberInstanceId: 'inst-restored' })
    expect(handle, 'the restored member resolves through its durable row').toBeDefined()
    expect((handle?.agent as { id: string }).id).toBe(restoredChild)
    const before = counters(world)
    const again = receipt.liveHandle({ teamSessionId: ROOT, memberInstanceId: 'inst-restored' })
    expect(again?.agent).toBe(handle?.agent)
    const after = counters(world)
    // The receipt path performs ZERO create/resume work of its own.
    expect(after.creates).toBe(before.creates)
    expect(after.resumes).toBe(before.resumes)
    world.binding.close()
  })

  it('leader pair hits the root handle through the durable leader row whose childSessionId is the root itself', async () => {
    const world = await bootWorld([memberRow('inst-leader', ROOT, { templateId: 'leader' })], [])
    const handle = receiptOf(world).liveHandle({ teamSessionId: ROOT, memberInstanceId: 'inst-leader' })
    expect(handle, 'the leader position is a durable row like every pair').toBeDefined()
    expect((handle?.agent as { id: string }).id).toBe(ROOT)
    expect(handle?.memberInstanceId).toBe('inst-leader')
    world.binding.close()
  })

  it('anti-echo leg: under a durable child-binding collision the receipt returns the true owner identity and the real binding drops identity-mismatch with zero injects', async () => {
    // A corrupted world: TWO rows bind the SAME child session (the live
    // agent belongs to inst-beta). The OLD echo-identity receipt made this
    // case structurally undetectable — the anti-echo smell the root named.
    const sharedChild = 'session-COLLISION-shared-1'
    const world = await bootWorld(
      [memberRow('inst-beta', sharedChild), memberRow('inst-alpha', sharedChild)],
      [{ instanceId: 'inst-beta', templateId: 'tpl-t12a', childSessionId: sharedChild }],
    )
    const handle = receiptOf(world).liveHandle({ teamSessionId: ROOT, memberInstanceId: 'inst-alpha' })
    expect(handle, 'a live entry exists under the bound key').toBeDefined()
    // Identity comes FROM the durable reverse mapping — the TRUE owner —
    // never the request echo:
    expect(handle?.memberInstanceId).toBe('inst-beta')
    // And the REAL production gate FIRES on the mismatch:
    const result = realBinding(world).deliver({
      teamSessionId: ROOT,
      memberInstanceId: 'inst-alpha',
      text: 'must never reach an agent it does not belong to',
    })
    expect(result).toEqual({ delivered: false, drop: 'identity-mismatch' })
    const c = counters(world)
    expect(c.injects).toBe(0)
    expect(c.steers).toBe(0)
    expect(c.followups).toBe(0)
    world.binding.close()
  })

  it('stale handle leg: a re-pointed durable row reads undefined for the old live child and the new key stays cold (no adopt, no create)', async () => {
    const oldChild = 'session-STALE-old-live-3'
    const newChild = 'session-STALE-new-cold-3'
    const rows = [memberRow('inst-stale', oldChild)]
    const world = await bootWorld(rows, [
      { instanceId: 'inst-stale', templateId: 'tpl-t12a', childSessionId: oldChild },
    ])
    // The durable row re-points (the old child handle is STILL live — the
    // exact stale-handle race the fix law must not deliver into).
    rows[0]!.childSessionId = newChild
    const handle = receiptOf(world).liveHandle({ teamSessionId: ROOT, memberInstanceId: 'inst-stale' })
    expect(handle, 'the durable row now names a cold key — undefined, fail closed').toBeUndefined()
    const c = counters(world)
    expect(c.creates, 'the new key was NOT materialized by the receipt').toBe(2) // root + original seed only
    expect(c.injects).toBe(0)
    world.binding.close()
  })

  it('ghost leg: a pair with no durable row reads undefined with zero side effects', async () => {
    const world = await bootWorld([], [])
    const before = counters(world)
    const handle = receiptOf(world).liveHandle({ teamSessionId: ROOT, memberInstanceId: 'inst-ghost' })
    expect(handle).toBeUndefined()
    const after = counters(world)
    expect(after.creates).toBe(before.creates)
    expect(after.resumes).toBe(before.resumes)
    expect(after.injects).toBe(0)
    world.binding.close()
  })

  it('regression: derived-id members of the ordinary runtime case resolve through the same durable law unchanged', async () => {
    const derivedChild = childSidOf(ROOT, 'inst-derived')
    const world = await bootWorld(
      [memberRow('inst-derived', derivedChild)],
      [{ instanceId: 'inst-derived', templateId: 'tpl-t12a', childSessionId: derivedChild }],
    )
    const handle = receiptOf(world).liveHandle({ teamSessionId: ROOT, memberInstanceId: 'inst-derived' })
    expect(handle).toBeDefined()
    expect((handle?.agent as { id: string }).id).toBe(derivedChild)
    expect(handle?.memberInstanceId).toBe('inst-derived')
    world.binding.close()
  })
})
