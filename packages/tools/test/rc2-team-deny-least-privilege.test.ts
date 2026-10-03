/**
 * rc2-team-deny-least-privilege.test.ts — the two capability lanes the 0.2.0-rc.2
 * upgrade round argued about, pinned against the REAL tool catalog and the real
 * leader gates, with positive AND negative cases for the four tools that the
 * rc2 kit's stale fixture catalog had pushed into `builtinToolDeny`.
 *
 * WHY A SEPARATE FILE (and what it does NOT duplicate).
 * `issue2-builtin-deny-focused.test.ts` pins the deny ADAPTER's contract with a
 * fake `agentCtx`; `t2-tool-selector-deny.test.ts` pins the allow lane. Neither
 * pins the question the PR #62 review actually asked: for the four tools
 * `team_list_pending_control`, `team_archive_member`, `team_grant_permission`,
 * `team_revoke_permission` — (a) can the mask lane reach them at all, (b) does
 * the allow lane decide their reachability, (c) what refuses a member who calls
 * one, and (d) does that refusal happen before any durable effect.
 *
 * THE TWO LANES (glue `packages/runtime/src/plugin/live/agent-bindings.mjs:2166-2205`,
 * frozen order: model → presets.mount → builtinToolDeny → Team tools):
 *   - ALLOW lane — `selectTeamTools(catalog, capabilities.teamTools)`: an
 *     allow-list over the plugin's OWN registrations. Names outside the catalog
 *     are dropped; the list decides exactly which team tools an agent gets.
 *   - MASK lane — `applyBuiltInToolDeny` → `agentCtx.tools.restrict({deny})`:
 *     a mask over the BUILTIN tools the agent INHERITS from the host. The glue
 *     comment is explicit that a builtin deny "cannot hide a team tool", because
 *     team tools are registered on the agent AFTER the mask, by name.
 *   The four names are therefore invisible to the mask lane: they are not part of
 *   the host's restrictable global vocabulary, and `restrict()` refuses them —
 *   `tools.restrict() names unknown global tool(s) "…"` — which is exactly why
 *   the stale kit fixture (11-name catalog over a 15-tool surface) failed.
 *
 * ATTRIBUTION (corrected after review — no production gate was changed for this).
 * That refusal is NOT a 0.2 tightening: the `restrict()` body and the unknown-name
 * message are byte-identical between 0.1.7-rc.1 (`46a7f68b`, core/tools/index.ts:1096+)
 * and 0.2.0-rc.2 (`639ed015`, :1097+). At the exact base commit the plugin already
 * registered all four names (`0838739d` 2026-09-18, `98b2926c` 2026-09-21,
 * `940cd841` 2026-10-02) while the kit's catalog still listed 11, so this is
 * PRE-EXISTING FIXTURE DEBT — the archived green evidence predates the tools
 * themselves (2026-09-17, `denyList: []`). The fixture is what got fixed
 * (`tests/kits/rc2-real-host-smoke/fixture-invariants.mjs`).
 *
 * RUNNER CONSTRAINTS (plain-node shim): every `it` body is SYNCHRONOUS, so the
 * world is built and every tool executed once at module load inside an awaited
 * IIFE (the `archive-member-tool.test.ts` pattern); matchers limited to
 * toBe / toEqual / toBeGreaterThan / toThrow (+ `.not`).
 *
 * SELF-CLEANLINESS: inside the P4-T6 whole-tree scanner's scope; no legacy Team
 * SessionEvent denylist token appears in this source.
 *
 * @module @dsh-agent-team/tools/test/rc2-team-deny-least-privilege
 */
import { afterAll, describe, expect, it } from 'vitest'

import { destroyP6T1World } from '../../runtime/test/p6t1-helpers.js'

import type { PolicyEntry } from '../../domain/policy/src/index.js'

import { applyBuiltInToolDeny } from '../src/builtin-deny.js'
import { selectTeamTools } from '../src/tool-selector.js'
import { P6T2_ROOT, P6T2_SEEDS, createP6T6World, runTool, type P6T6World } from './p6t6-helpers.js'

// The four tools under review, and the kit's real leader allow lane (SIX names —
// the smoke kit grants create + delegate, `LEADER_TEAM_TOOLS_ALLOW` in
// tests/kits/rc2-real-host-smoke/rc2-real-host-smoke.mjs).
const FOUR = ['team_list_pending_control', 'team_archive_member', 'team_grant_permission', 'team_revoke_permission']
const KIT_LEADER_ALLOW = ['team_list_members', 'team_list_templates', 'team_inspect_config', 'team_create_member', 'team_delegate', 'team_collect']
// The exact catalog order the plugin registers (pinned below against the factory).
const CATALOG_ORDER = [
  'team_list_members',
  'team_list_templates',
  'team_inspect_config',
  'team_create_member',
  'team_delegate',
  'team_follow_up',
  'team_collect',
  'team_send_message',
  'team_report_progress',
  'team_request_control',
  'team_resolve_control',
  'team_list_pending_control',
  'team_archive_member',
  'team_grant_permission',
  'team_revoke_permission',
]
// The globals a 0.2.0-rc.2 root agent actually inherits on the minimal-style
// preset surface (leg 0 of the kit measured this).
const HOST_GLOBALS = ['bash', 'edit', 'read', 'read_image', 'write']

/** The allow lane's policy shape (`selectTeamTools` takes a PolicyEntry). */
const allow = (items: readonly string[]): PolicyEntry => ({ kind: 'allow', items: [...items] })
const DENY_ALL: PolicyEntry = { kind: 'deny' }

const CODES = {
  pending: 'TEAM_TOOL_PENDING_LIST_NOT_LEADER',
  archive: 'TEAM_TOOL_ARCHIVE_NOT_LEADER',
  permission: 'TEAM_TOOL_PERMISSION_NOT_LEADER',
  unwired: 'TEAM_TOOL_PERMISSION_UNWIRED',
} as const

const LEADER_SESSION = String(P6T2_ROOT)
const MEMBER_SESSION = String(P6T2_SEEDS.worker.childSessionId)
const TARGET_ID = String(P6T2_SEEDS.worker2.instanceId)

interface Outcome {
  readonly status: string
  readonly code: string | null
  readonly resultStatus: string
  readonly message: string
}

/** Index-safe read of a prepared outcome map. */
function pick(rec: Record<string, Outcome>, key: string): Outcome {
  const value = rec[key]
  if (value === undefined) throw new Error(`no prepared outcome for ${key}`)
  return value
}

function summarize(result: unknown): Outcome {
  const r = (result ?? {}) as { status?: string; code?: string }
  return {
    status: String(r.status ?? ''),
    code: r.code !== undefined ? String(r.code) : null,
    resultStatus: String(r.status ?? ''),
    message: String((r as { message?: unknown }).message ?? ''),
  }
}

/** A restrict seam with the host's real vocabulary and its real error. */
function makeRestrictSeam(known: readonly string[]) {
  const calls: Array<{ deny: string[] }> = []
  const ctx = {
    tools: {
      restrict(opts: { deny: string[] }) {
        calls.push({ deny: [...opts.deny] })
        const unknown = opts.deny.filter((n) => !known.includes(n))
        if (unknown.length > 0) {
          throw new Error(
            `tools.restrict() names unknown global tool(s) ${unknown.map((n) => `"${n}"`).join(', ')}; known global tools: ${known.join(', ')}`,
          )
        }
        return () => {}
      },
    },
  }
  return { ctx, calls }
}

/**
 * One read of the durable governance state, through the SAME paths the tools use:
 * the control service (`listControlState`, what `team_list_pending_control`
 * filters) and the TeamDomain repositories the facts and the append-only
 * permission-overlay store live in.
 */
interface GovernanceState {
  controlRequests: Array<{ requestId: string; kind: string; status: string; requestSequence: number }>
  controlDecisions: number
  controlConsumptions: number
  controlAbandonments: number
  ledger: Array<{ sequence: number; factType: string }>
  overlaySnapshots: Array<{ snapshotId: string }>
}

/**
 * One read of the durable governance state, through the SAME paths the tools use:
 * the control service (`listControlState`, what `team_list_pending_control`
 * filters) and the TeamDomain repositories the fact ledger and the append-only
 * permission-overlay store live in.
 */
interface GovernanceState {
  controlRequests: Array<{ requestId: string; kind: string; status: string; requestSequence: number }>
  controlDecisions: number
  controlConsumptions: number
  controlAbandonments: number
  ledger: Array<{ sequence: number; factType: string }>
  overlaySnapshots: Array<{ snapshotId: string }>
}

/**
 * Read the durable governance state through the paths the tools themselves use.
 * Shared by both worlds below so the refusal world and the writable world are
 * measured identically — two readers with two notions of "unchanged" would make
 * the comparison meaningless.
 */
async function governanceSnapshot(
  env: P6T6World,
  targetInstanceId: string,
): Promise<GovernanceState> {
  const repos = env.world.domain.repositories
  const controlState = await env.control.listControlState(P6T2_ROOT)
  return {
    controlRequests: controlState.requests.map((r) => ({
      requestId: String(r.requestId), kind: String(r.kind), status: String(r.status),
      requestSequence: r.requestSequence,
    })),
    controlDecisions: controlState.decisions.length,
    controlConsumptions: controlState.consumptions.length,
    controlAbandonments: controlState.abandonments.length,
    ledger: repos.ledger.list().map((e) => ({ sequence: e.sequence, factType: e.factType })),
    overlaySnapshots: repos.permissionOverlays
      .history(P6T2_ROOT, targetInstanceId)
      .map((snap) => ({ snapshotId: snap.snapshotId })),
  }
}

interface Prepared {
  env: P6T6World
  catalogNames: string[]
  member: Record<string, Outcome>
  leader: Record<string, Outcome>
  // Only what the fixture can actually READ durably. A pending-approval count is
  // deliberately absent: this world exposes memberInstances, not the governance
  // pending/permission store, so any number here would be a literal wearing the
  // clothes of an observation (see A8).
  effectsBefore: { lifecycle: string | null; memberState: string }
  effectsAfterRefusals: { lifecycle: string | null; memberState: string }
  effectsAfter: { lifecycle: string | null; memberState: string }
  governanceBefore: GovernanceState
  governanceAfterRefusals: GovernanceState
  governanceAfterLeader: GovernanceState
}

const PREP = await (async (): Promise<Prepared | null> => {
  const env = await createP6T6World('rc2-team-deny-lp', ['leader', 'worker', 'worker2'])
  const member = env.callerMap.bySession.get(MEMBER_SESSION)
  if (member === undefined) throw new Error('fixture: no member caller for the worker session')
  const args = (extra: Record<string, unknown> = {}) => ({
    rootSessionId: LEADER_SESSION,
    requestToken: 'rc2-deny-lp-token',
    targetInstanceId: TARGET_ID,
    ...extra,
  })
  const permissionRules = [{ operationClass: 'file', matcher: { kind: 'exact', value: 'team/notes.txt' }, effect: 'allow' }]
  const callArgs: Record<string, Record<string, unknown>> = {
    team_list_pending_control: { rootSessionId: LEADER_SESSION, requestToken: 'rc2-deny-lp-token' },
    team_archive_member: args(),
    team_grant_permission: args({ rules: permissionRules }),
    team_revoke_permission: args({ rules: permissionRules }),
  }
  const readState = () => {
    const record = env.world.domain.repositories.memberInstances.get(P6T2_ROOT, TARGET_ID) as { lifecycle?: string } | undefined
    const list = env.tools.find((t) => t.name === 'team_list_members')
    if (list === undefined) throw new Error('fixture: team_list_members missing')
    return {
      lifecycle: record?.lifecycle !== undefined ? String(record.lifecycle) : null,
      memberState: String(JSON.stringify(record ?? null)),
    }
  }
  // The real governance plane, read through the service and the repositories
  // rather than inferred: pending/decided control requests (the same state
  // `team_list_pending_control` filters), the append-only fact ledger, and the
  // per-member permission-overlay snapshots (`team_grant_permission`'s target).
  const governanceState = (): Promise<GovernanceState> => governanceSnapshot(env, TARGET_ID)
  const effectsBefore = readState()
  const governanceBefore = await governanceState()
  const memberOut: Record<string, Outcome> = {}
  const leaderOut: Record<string, Outcome> = {}
  for (const name of FOUR) {
    const call = callArgs[name]
    if (call === undefined) throw new Error(`no fixture args for ${name}`)
    memberOut[name] = summarize(await runTool(env, name, call, MEMBER_SESSION))
  }
  // The window closes HERE: A8/A8b are about the four MEMBER refusals, so the
  // leader round must not sit inside them (an earlier revision bracketed both,
  // which would have attributed any leader-side movement to the refusals).
  const effectsAfterRefusals = readState()
  const governanceAfterRefusals = await governanceState()
  for (const name of FOUR) {
    const call = callArgs[name]
    if (call === undefined) throw new Error(`no fixture args for ${name}`)
    leaderOut[name] = summarize(await runTool(env, name, call, LEADER_SESSION))
  }
  const effectsAfter = readState()
  const governanceAfterLeader = await governanceState()
  return {
    env,
    catalogNames: env.tools.map((t) => t.name),
    member: memberOut,
    leader: leaderOut,
    effectsBefore,
    effectsAfterRefusals,
    effectsAfter,
    governanceBefore,
    governanceAfterRefusals,
    governanceAfterLeader,
  }
})()

// The world is built at module load (the shim forbids async `it` bodies), so it
// is torn down here: the scratch dir is SHARED between worlds, and a world left
// behind makes the next run fail with "team_domain already exists".
/**
 * The SECOND world, built with the governance mutation port actually wired
 * (`createP6T6World(..., { permissionLane: true })` — see p6t6-helpers). This is
 * what makes A8b's empty baseline into a proof: the same stores, the same
 * reader, but a call that CAN write.
 *
 * Order follows the review instruction: prove the legitimate Leader write lands
 * FIRST, then show the member refusals do not touch the same durable stores.
 */
interface PreparedWrite {
  env: P6T6World
  grant: Outcome
  grantRules: string
  baseline: GovernanceState
  afterGrant: GovernanceState
  afterRefusals: GovernanceState
  refusals: Record<string, Outcome>
}

const PREP2 = await (async (): Promise<PreparedWrite | null> => {
  const env = await createP6T6World('rc2-team-deny-lp-write', ['leader', 'worker', 'worker2'], {
    permissionLane: true,
  })
  if (env.permissionWired !== true) throw new Error('fixture: the governance seam did not wire')
  // A TIGHTENING rule (deny): the closed carrier law applies a tightening
  // immediately, while an expansion needs explicit envelope coverage — the
  // earlier `effect: 'allow'` rule would have refused typed here and produced
  // another empty baseline dressed up as a control.
  // The CLOSED permission vocabulary speaks in tool classes
  // (`FILE_PERMISSION_TOOL_VALUES`: read | read_image | write | edit | lsp), not
  // in a "file" pseudo-class — a class the authority cannot speak about is
  // refused typed (`PERMISSION_MUTATION_MALFORMED`, zero write), which is what
  // the first version of this control hit.
  const rules = [{ operationClass: 'read', matcher: { kind: 'exact', value: 'team/notes.txt' }, effect: 'deny' }]
  const baseline = await governanceSnapshot(env, TARGET_ID)
  const grant = summarize(await runTool(env, 'team_grant_permission', {
    rootSessionId: LEADER_SESSION,
    targetInstanceId: TARGET_ID,
    requestToken: 'rc2-a8-write-token',
    rules,
  }, LEADER_SESSION))
  const afterGrant = await governanceSnapshot(env, TARGET_ID)
  const refusals: Record<string, Outcome> = {}
  for (const name of FOUR) {
    const call = name === 'team_grant_permission' || name === 'team_revoke_permission'
      ? { rootSessionId: LEADER_SESSION, targetInstanceId: TARGET_ID, requestToken: 'rc2-a8-refusal-token', rules }
      : name === 'team_archive_member'
        ? { rootSessionId: LEADER_SESSION, targetInstanceId: TARGET_ID, requestToken: 'rc2-a8-refusal-token' }
        : { rootSessionId: LEADER_SESSION, requestToken: 'rc2-a8-refusal-token' }
    refusals[name] = summarize(await runTool(env, name, call, MEMBER_SESSION))
  }
  const afterRefusals = await governanceSnapshot(env, TARGET_ID)
  return {
    env,
    grant,
    grantRules: JSON.stringify(rules),
    baseline,
    afterGrant,
    afterRefusals,
    refusals,
  }
})()

afterAll(async () => {
  if (PREP !== null) await destroyP6T1World(PREP.env.world)
  if (PREP2 !== null) await destroyP6T1World(PREP2.env.world)
})

describe('rc2 least privilege — the real catalog and the two capability lanes', () => {
  it('A1 the registered catalog is the 15 names the kit fixture must cover', () => {
    expect(PREP !== null).toBe(true)
    if (PREP === null) return
    expect(PREP.catalogNames).toEqual(CATALOG_ORDER)
    for (const name of FOUR) expect(PREP.catalogNames.includes(name)).toBe(true)
  })

  it('A2 the allow lane selects exactly the allow list, in catalog order', () => {
    if (PREP === null) throw new Error('world unavailable')
    const selected = selectTeamTools(PREP.env.tools, allow(KIT_LEADER_ALLOW)).map((t) => t.name)
    expect(selected).toEqual(['team_list_members', 'team_list_templates', 'team_inspect_config', 'team_create_member', 'team_delegate', 'team_collect'])
    // Order of the allow list is irrelevant; catalog order wins, duplicates merge.
    const shuffled = selectTeamTools(PREP.env.tools, allow([...KIT_LEADER_ALLOW].reverse())).map((t) => t.name)
    expect(shuffled).toEqual(selected)
    const doubled = selectTeamTools(PREP.env.tools, allow([...KIT_LEADER_ALLOW, 'team_delegate', 'team_delegate'])).map((t) => t.name)
    expect(doubled).toEqual(selected)
    // An unknown name never materializes and never widens the lane.
    expect(selectTeamTools(PREP.env.tools, allow(['team_teleport_member'])).length).toBe(0)
    expect(selectTeamTools(PREP.env.tools, DENY_ALL).length).toBe(0)
  })

  it('A3 the four tools become reachable ONLY through the allow lane', () => {
    if (PREP === null) throw new Error('world unavailable')
    for (const name of FOUR) {
      expect(selectTeamTools(PREP.env.tools, allow(KIT_LEADER_ALLOW)).map((t) => t.name).includes(name)).toBe(false)
      expect(selectTeamTools(PREP.env.tools, allow([...KIT_LEADER_ALLOW, name])).map((t) => t.name).includes(name)).toBe(true)
    }
  })

  it('A4 the mask lane forwards the deny list verbatim and does nothing when empty', () => {
    const seam = makeRestrictSeam(HOST_GLOBALS)
    const disposer = applyBuiltInToolDeny(seam.ctx as never, ['read', 'read', 'bash'])
    expect(seam.calls.length).toBe(1)
    const firstCall = seam.calls[0]
    if (firstCall === undefined) throw new Error('restrict() was never called')
    expect(firstCall.deny).toEqual(['read', 'bash'])
    expect(typeof disposer.dispose).toBe('function')
    const emptySeam = makeRestrictSeam(HOST_GLOBALS)
    applyBuiltInToolDeny(emptySeam.ctx as never, [])
    expect(emptySeam.calls.length).toBe(0)
  })

  it('A5 the mask lane CANNOT mask a team tool — it refuses the name (same in both host generations)', () => {
    const seam = makeRestrictSeam(HOST_GLOBALS)
    // The stale-kit shape: team names leaked into builtinToolDeny.
    expect(() => applyBuiltInToolDeny(seam.ctx as never, FOUR)).toThrow()
    // The refusal is the host's own unknown-global-tool error, propagated
    // unchanged (contract 5 of issue2-builtin-deny-focused): setup fails closed
    // rather than reporting a mask that was never applied.
    let message = ''
    try {
      applyBuiltInToolDeny(seam.ctx as never, ['team_archive_member'])
    } catch (err) {
      message = String((err as Error).message)
    }
    expect(message.indexOf('unknown global tool') >= 0).toBe(true)
    expect(message.indexOf('"team_archive_member"') >= 0).toBe(true)
    // Structurally: the mask vocabulary is the inherited globals, and the team
    // namespace is disjoint from it — so no deny lane can hide a team tool, and
    // team reachability is decided only by the allow lane (A3).
    expect(HOST_GLOBALS.filter((n) => n.startsWith('team_')).length).toBe(0)
    expect(FOUR.filter((n) => HOST_GLOBALS.includes(n)).length).toBe(0)
  })

  it('A6 a member caller of any of the four tools is refused before any effect', () => {
    if (PREP === null) throw new Error('world unavailable')
    expect(pick(PREP.member, 'team_list_pending_control').status).toBe('rejected')
    expect(pick(PREP.member, 'team_list_pending_control').code).toBe(CODES.pending)
    expect(pick(PREP.member, 'team_archive_member').code).toBe(CODES.archive)
    expect(pick(PREP.member, 'team_grant_permission').code).toBe(CODES.permission)
    expect(pick(PREP.member, 'team_revoke_permission').code).toBe(CODES.permission)
  })

  it('A7 the gate is caller-scoped: the leader is not refused by the member gate', () => {
    if (PREP === null) throw new Error('world unavailable')
    expect(pick(PREP.leader, 'team_list_pending_control').code).not.toBe(CODES.pending)
    expect(pick(PREP.leader, 'team_archive_member').code).not.toBe(CODES.archive)
    expect(pick(PREP.leader, 'team_grant_permission').code).not.toBe(CODES.permission)
    expect(pick(PREP.leader, 'team_revoke_permission').code).not.toBe(CODES.permission)
    // Positive controls that do not depend on lifecycle wiring owned by other
    // suites: the leader's pending list works, and the permission pair reaches
    // the (recorded) unwired-permission refusal BELOW the leader gate — proof
    // the leader passed the gate rather than being refused by it.
    expect(pick(PREP.leader, 'team_list_pending_control').resultStatus).toBe('pending-control-listed')
    expect(pick(PREP.leader, 'team_grant_permission').code).toBe(CODES.unwired)
    expect(pick(PREP.leader, 'team_revoke_permission').code).toBe(CODES.unwired)
  })

  it('A8 the member refusals leave the target durable member record unmoved', () => {
    if (PREP === null) throw new Error('world unavailable')
    // Bracketed on the refusals alone (the leader round is outside this window).
    expect(PREP.effectsAfterRefusals.lifecycle).toEqual(PREP.effectsBefore.lifecycle)
    expect(PREP.effectsAfterRefusals.memberState).toEqual(PREP.effectsBefore.memberState)
    // The whole PREP window, leader round included, is inert on this record.
    expect(PREP.effectsAfter.lifecycle).toEqual(PREP.effectsBefore.lifecycle)
    expect(PREP.effectsAfter.memberState).toEqual(PREP.effectsBefore.memberState)
    // And the target really is a member instance, so A6 was a caller refusal and
    // not an "unknown target" accident.
    expect(PREP.effectsBefore.lifecycle !== null).toBe(true)
    /*
     * What this case does NOT establish, kept because an earlier revision claimed
     * it: member-record equality is not governance stasis. The governance plane is
     * read for real in A8b/A8c instead of being guessed here. (An earlier
     * `expect(effectsAfter.pending).toEqual(effectsBefore.pending)` compared two
     * occurrences of a literal `0`, and a placeholder `expect(true).toBe(true)`
     * closed this case; both were tautologies and both are deleted.)
     */
  })

  it('A8b the four refusals move no durable governance state - read through the control service and the repositories', () => {
    if (PREP === null) throw new Error('world unavailable')
    // Not a member-instance read wearing a governance label: `controlRequests`
    // comes from ControlService.listControlState (the very state
    // team_list_pending_control filters), `ledger` from the append-only fact
    // ledger, `overlaySnapshots` from the permission_overlays store that
    // team_grant_permission writes through.
    expect(PREP.governanceAfterRefusals).toEqual(PREP.governanceBefore)
    // And the window as a whole (leader round included) moved nothing.
    expect(PREP.governanceAfterLeader).toEqual(PREP.governanceBefore)
    // THE LIMITATION, asserted rather than footnoted: this baseline is EMPTY, so
    // the equality above is containment on an empty store, not a falsifiable
    // "a write would have been seen" proof. If this fixture ever gains a write
    // path this fails, and A8b must be re-read as a real stasis claim.
    expect(PREP.governanceBefore.ledger.length).toBe(0)
    expect(PREP.governanceBefore.overlaySnapshots.length).toBe(0)
    expect(PREP.governanceBefore.controlRequests.length).toBe(0)
  })

  it('A8c WHY A8b cannot be falsified in this fixture: the governance port is absent, measured verbatim', () => {
    if (PREP === null) throw new Error('world unavailable')
    // The Leader - the ONE caller allowed to mutate permissions - is refused
    // BEFORE any store access, because ctx.options.permission is undefined in
    // this world (packages/tools/src/tools.ts:1347-1352: "unwired on this host
    // (no governance mutation port) - zero write"). So no call this fixture can
    // make is able to write permission_overlays; that is why A8b's baseline is
    // empty and why an earlier "pending stayed 0" claim was vacuous.
    const grant = pick(PREP.leader, 'team_grant_permission')
    expect(grant.status).toBe('rejected')
    expect(grant.code).toBe(CODES.unwired)
    expect(grant.message.indexOf('no governance mutation port') >= 0).toBe(true)
    expect(grant.message.indexOf('zero write') >= 0).toBe(true)
    // The other channel cannot move either, for a different real reason: the
    // Leader's archive is refused by the lifecycle FSM (ARCHIVE is legal only
    // from SETTLED), which is a guard refusal, not a store fault.
    const archive = pick(PREP.leader, 'team_archive_member')
    expect(archive.status).toBe('rejected')
    expect(archive.code).toBe('TEAM_RUNTIME_LIFECYCLE_TRANSITION_REJECTED')
    expect(PREP.governanceAfterLeader.overlaySnapshots.length).toBe(0)
  })

  it('A8d the legitimate Leader grant WRITES the real permission_overlay store (the control A8b lacked)', () => {
    if (PREP2 === null) throw new Error('writable world unavailable')
    expect(PREP2.env.permissionWired).toBe(true)
    // Same store A8b reads, same reader — no second source of truth.
    expect(PREP2.baseline.overlaySnapshots.length).toBe(0)
    expect(PREP2.grant.status).not.toBe('rejected')
    expect(PREP2.afterGrant.overlaySnapshots.length).toBe(1)
    expect(PREP2.afterGrant.overlaySnapshots[0]?.snapshotId.length ?? 0).toBeGreaterThan(0)
    // The write is the durable append-only chain, not an in-memory answer.
    const stored = PREP2.env.world.domain.repositories.permissionOverlays
      .history(P6T2_ROOT, TARGET_ID)
    expect(stored.length).toBe(1)
    expect(stored[0]?.identity.memberInstanceId).toBe(TARGET_ID)
    expect(JSON.stringify(stored[0]?.state.rules)).toContain('deny')
  })

  it('A8e with a live write path, the four member refusals still move NO durable governance state', () => {
    if (PREP2 === null) throw new Error('writable world unavailable')
    // This is the falsifiable version of A8b: the window now sits on a store
    // that demonstrably accepts writes (A8d), so "nothing moved" could have
    // failed and did not.
    expect(PREP2.afterGrant.overlaySnapshots.length).toBeGreaterThan(0)
    for (const name of FOUR) {
      expect(PREP2.refusals[name]?.status).toBe('rejected')
    }
    expect(PREP2.afterRefusals).toEqual(PREP2.afterGrant)
  })

  it('A9 the deny disposer unwinds the mask exactly once (no standing mask)', () => {
    const seam = makeRestrictSeam(HOST_GLOBALS)
    let lifts = 0
    const ctx = { tools: { restrict: () => () => { lifts += 1 } } }
    const disposer = applyBuiltInToolDeny(ctx as never, ['bash'])
    disposer.dispose()
    disposer.dispose()
    expect(lifts).toBe(1)
    expect(seam.calls.length).toBe(0)
  })
})
