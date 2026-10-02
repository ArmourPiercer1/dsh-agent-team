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
import { parseMemberInstanceRecord } from '../../contracts/src/index.js'
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

/** A REAL v2 LeaderInstanceRecordDto: schemaVersion 2 with the child and
 *  lifecycle keys ABSENT (Architecture §9.2 — validation REJECTS their
 *  presence; the fixture below is passed through the real contract
 *  validator so the leader leg cannot be a faked legacy row). */
function v2LeaderRow(rootSessionId: string): Record<string, unknown> {
  return parseMemberInstanceRecord({
    schemaVersion: 2,
    rootSessionId,
    instanceId: 'inst-leader',
    templateId: 'leader',
    label: 'leader',
    createdAt: '2026-01-01T00:00:00.000Z',
    activityVersion: 1,
  }) as unknown as Record<string, unknown>
}

/** The durable TeamSession row the glue leader leg reads back. */
function teamRow(rootSessionId: string): Record<string, unknown> {
  return { schemaVersion: 2, rootSessionId, generation: 1 }
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
  options: { readonly teamSession?: Record<string, unknown> } = {},
): Promise<World> {
  const world = await createLiveWorld({
    rootSessionId: ROOT,
    members: members as never[],
    teamSession: (options.teamSession ?? teamRow(ROOT)) as never,
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

  it('REAL v2 leader row (validator-gated, no child/lifecycle keys): the leader pair resolves the root handle at the team-session key', async () => {
    // The fixture IS the frozen contract: parseMemberInstanceRecord only
    // returns for a schemaVersion-2 leader record WITHOUT child/lifecycle
    // keys (their presence is rejected — pinned right here, and the row
    // below carries none because the validator forbids it).
    const leader = v2LeaderRow(ROOT)
    expect(Object.keys(leader)).not.toContain('childSessionId')
    expect(Object.keys(leader)).not.toContain('lifecycle')
    expect(() =>
      parseMemberInstanceRecord({ ...leader, childSessionId: 'session-fake-child' }),
    ).toThrow()
    const world = await bootWorld([leader as never], [])
    const handle = receiptOf(world).liveHandle({ teamSessionId: ROOT, memberInstanceId: 'inst-leader' })
    expect(handle, 'the leader pair keys to the team session id — exactly where boot registered the root handle').toBeDefined()
    expect((handle?.agent as { id: string }).id).toBe(ROOT)
    // Attribution is derived FROM the durable facts (team row + leader row
    // instance id), never echoed: the request-shaped identity matches only
    // because the durable facts genuinely name this team.
    expect(handle?.teamSessionId).toBe(ROOT)
    expect(handle?.memberInstanceId).toBe('inst-leader')
    // The leader RECEIVES through the real production binding:
    ;(handle?.agent as { status: string }).status = 'running'
    const before = counters(world)
    const result = realBinding(world).deliver({
      teamSessionId: ROOT,
      memberInstanceId: 'inst-leader',
      text: 'permission overlay updated team-wide',
    })
    expect(result).toEqual({ delivered: true })
    const after = counters(world)
    expect(after.injects - before.injects).toBe(1)
    expect(after.steers).toBe(before.steers)
    expect(after.followups).toBe(before.followups)
    world.binding.close()
  })

  it('leader leg fail-closed: no durable TeamSession row, or a cold (never-booted) root handle, reads undefined with zero side effects', async () => {
    // (a) no durable team row (an explicit EMPTY teamSessions list
    // suppresses the bridge synthesized default row):
    const noTeam = await createLiveWorld({
      rootSessionId: ROOT,
      members: [v2LeaderRow(ROOT) as never] as never[],
      teamSessions: [] as never[],
      configOverrides: { bootPhase: 'create', seedMembers: [] },
    })
    // No boot here: the durable-fact refusal needs no live surface, and
    // nothing may be created by the read itself.
    expect(
      receiptOf(noTeam).liveHandle({ teamSessionId: ROOT, memberInstanceId: 'inst-leader' }),
      'no durable TeamSession row -> no leader attribution',
    ).toBeUndefined()
    // (b) cold root handle: the receipt is read BEFORE any boot — the
    // root handle is not registered; the receipt must not create it.
    const cold = await createLiveWorld({
      rootSessionId: ROOT,
      members: [v2LeaderRow(ROOT) as never] as never[],
      teamSession: teamRow(ROOT) as never,
      configOverrides: { bootPhase: 'create', seedMembers: [] },
    })
    const before = counters(cold)
    expect(before.creates).toBe(0)
    expect(
      receiptOf(cold).liveHandle({ teamSessionId: ROOT, memberInstanceId: 'inst-leader' }),
      'a cold root stays exactly as cold as it was',
    ).toBeUndefined()
    const after = counters(cold)
    expect(after.creates, 'reading the receipt created nothing').toBe(0)
    expect(after.resumes).toBe(0)
    expect(after.injects).toBe(0)
  })

  it('ambiguous binding (real list order, alpha-first): BOTH claimants are refused outright — no first-match owner, zero side effects', async () => {
    // A corrupted durable table: TWO rows bind the SAME child session.
    // The rows are supplied in the REAL repo.list order (instanceId byte
    // order — alpha first), the exact ordering under which the old
    // first-match winner would inject alpha notice into betas handle.
    const sharedChild = 'session-COLLISION-shared-1'
    const world = await bootWorld(
      [memberRow('inst-alpha', sharedChild), memberRow('inst-beta', sharedChild)],
      [{ instanceId: 'inst-alpha', templateId: 'tpl-t12a', childSessionId: sharedChild }],
    )
    const receipt = receiptOf(world)
    expect(
      receipt.liveHandle({ teamSessionId: ROOT, memberInstanceId: 'inst-alpha' }),
      'the requesting pair IS one of the claimants — over-broad refusal is CORRECT: a corrupted binding is not a delivery target',
    ).toBeUndefined()
    expect(
      receipt.liveHandle({ teamSessionId: ROOT, memberInstanceId: 'inst-beta' }),
      'the other claimant is refused identically',
    ).toBeUndefined()
    // The REAL gate drops the notice (handle absent -> not-live), zero
    // side effects on refusal:
    const result = realBinding(world).deliver({
      teamSessionId: ROOT,
      memberInstanceId: 'inst-alpha',
      text: 'must never reach any agent under an ambiguous binding',
    })
    expect(result).toEqual({ delivered: false, drop: 'not-live' })
    const c = counters(world)
    expect(c.injects).toBe(0)
    expect(c.steers).toBe(0)
    expect(c.followups).toBe(0)
    world.binding.close()
  })

  it('ambiguous binding (swapped order): refusal is order-independent — the swap changes nothing', async () => {
    const sharedChild = 'session-COLLISION-shared-2'
    const swapped = await bootWorld(
      [memberRow('inst-beta', sharedChild), memberRow('inst-alpha', sharedChild)],
      [{ instanceId: 'inst-beta', templateId: 'tpl-t12a', childSessionId: sharedChild }],
    )
    const receipt = receiptOf(swapped)
    expect(receipt.liveHandle({ teamSessionId: ROOT, memberInstanceId: 'inst-alpha' })).toBeUndefined()
    expect(receipt.liveHandle({ teamSessionId: ROOT, memberInstanceId: 'inst-beta' })).toBeUndefined()
    expect(
      realBinding(swapped).deliver({ teamSessionId: ROOT, memberInstanceId: 'inst-beta', text: 'x' }),
    ).toEqual({ delivered: false, drop: 'not-live' })
    expect(counters(swapped).injects).toBe(0)
    swapped.binding.close()
  })

  it('no over-refusal: the SAME rows with the collision removed resolve normally (exactly-one binding still delivers)', async () => {
    const sharedChild = 'session-COLLISION-removed-3'
    const world = await bootWorld(
      [memberRow('inst-alpha', sharedChild)],
      [{ instanceId: 'inst-alpha', templateId: 'tpl-t12a', childSessionId: sharedChild }],
    )
    const handle = receiptOf(world).liveHandle({ teamSessionId: ROOT, memberInstanceId: 'inst-alpha' })
    expect(handle, 'a single-row binding is NOT refused by the ambiguity guard').toBeDefined()
    expect(handle?.memberInstanceId).toBe('inst-alpha')
    ;(handle?.agent as { status: string }).status = 'running'
    expect(
      realBinding(world).deliver({ teamSessionId: ROOT, memberInstanceId: 'inst-alpha', text: 'fine' }),
    ).toEqual({ delivered: true })
    expect(counters(world).injects).toBe(1)
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
