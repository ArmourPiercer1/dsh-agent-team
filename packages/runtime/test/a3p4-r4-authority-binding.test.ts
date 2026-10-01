/**
 * a3p4-r4-authority-binding.test.ts — pre-alpha3 PR4 ROUND 4: the authority
 * facts are ADDRESSED-TEAM bound, anchored at the TARGET member's effective
 * workspace, sourced from the EXPLICIT §6 config carrier (never a derivation
 * of the leader's static lanes), and the risen cells are additionally capped
 * by the acting leader's OWN effective answer.
 *
 * Round 3 shipped the opposite on every axis (all four confirmed by external
 * review at 3d432261):
 *   BLOCK-2  the row anchor was parsed ONCE and every team read a row-wide
 *            CONSTANT envelope (`void teamSessionId`) — two teams minted
 *            from the same blueprint/template evaluated team B's member
 *            under team A's authority;
 *   BLOCK-3  paths canonicalized at the ROW's defaultWorkspace while the
 *            member RUNS at its own workspace — relative rules mis-resolved
 *            and an effective comparison could "see no rise" past a real
 *            DENY (the laundering class);
 *   BLOCK-4  the envelope was DERIVED by copying the leader's static
 *            ALLOW/ASK lanes — the same-lane DENY/ASK EXCEPTIONS were
 *            silently swallowed (existential union fold over-granted);
 *   BLOCK-1  exec-class expansion was UNREACHABLE (shell rules skipped; the
 *            carrier grammar carried no fingerprint authority).
 *
 * Group A is the FIRST DIRECT spec of `createPermissionAuthorityFacts` (the
 * round-3 ledger's honest admission: zero direct tests). Group B pins the
 * kernel `authorityCeiling` with X1's two demos verbatim (deny-exception
 * subtraction + ask-ceiling cap) and the legacy-compatibility contract.
 * The end-to-end entry legs live in a3p4-pr4-production-entry-regression
 * .test.ts (E-series, real `apply()` boot).
 *
 * Offline, host-free: no DSH host, no port, no model, no network. The fs
 * provider double mirrors the host's canonicalizer contract (absolute path →
 * key verbatim; relative → resolved against the SUPPLIED cwd — exactly what
 * the entry's BLOCK-3 anchor must never stop doing).
 *
 * @module @dsh-agent-team/runtime/test/a3p4-r4-authority-binding
 */

import { describe, expect, it } from 'vitest'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { parseBlueprint } from '../../domain/blueprint/src/index.js'
import { createPermissionAuthorityFacts } from '../src/plugin/permission-plane.js'
import {
  authorizeLeaderPermissionMutation,
  PermissionMutationError,
  renderPermissionResourceText,
  type PermissionMutationEnvelope,
  type PermissionStaticLayerFacts,
} from '../governance/permission-mutation.js'
import type { PermissionOverlayRule } from '../permission-governance/types.js'
import { PERMISSION_MUTATION_ERROR_CODES } from '../governance/index.js'
import { LEADER_INSTANCE_ID } from '../../contracts/src/index.js'

// ──────────────────────────────────────────────────────────────────────────
// The blueprint factory: one skeleton, four dials (carrier / leader lanes /
// worker lanes / revision). EVERY source goes through the REAL domain
// validator (parseBlueprint), so a fixture drift from the shipped grammar
// fails here, not silently downstream.
// ──────────────────────────────────────────────────────────────────────────

interface FileRule {
  readonly kind: 'exact' | 'subtree'
  readonly path: string
}

interface BpOpts {
  readonly revision?: string
  /** YAML lines of the top-level permissionMutationEnvelope (absent = no carrier). */
  readonly carrier?: readonly string[]
  readonly leaderWrite?: readonly FileRule[]
  readonly leaderBashAny?: 'allow' | 'deny'
  readonly workerWrite?: readonly FileRule[]
}

/** One template's `permissions:` block (allow-lane rules + optional bash
 *  `any` rule; ask/deny lanes stay empty — the lanes this round exercises
 *  are the ceiling and the effective comparison, not blueprint lane shape). */
function permsBlock(rules: readonly FileRule[], bash: 'allow' | 'deny' | undefined, indent: number): string[] {
  const pad = (n: number): string => ' '.repeat(n)
  const lines: string[] = [`${pad(indent)}permissions:`, `${pad(indent + 2)}default: deny`]
  if (rules.length === 0 && bash === undefined) {
    lines.push(`${pad(indent + 2)}allow: []`)
  } else {
    lines.push(`${pad(indent + 2)}allow:`)
    for (const rule of rules) {
      lines.push(
        `${pad(indent + 4)}- tool: write`,
        `${pad(indent + 6)}resource:`,
        `${pad(indent + 8)}kind: ${rule.kind}`,
        `${pad(indent + 8)}path: "${rule.path}"`,
      )
    }
    if (bash !== undefined) {
      lines.push(
        `${pad(indent + 4)}- tool: bash`,
        `${pad(indent + 6)}resource:`,
        `${pad(indent + 8)}kind: any`,
      )
    }
  }
  lines.push(`${pad(indent + 2)}ask: []`)
  lines.push(`${pad(indent + 2)}deny: []`)
  return lines
}

function bpSource(opts: BpOpts): string {
  return [
    '---',
    'schemaVersion: 1',
    'blueprintId: team.a3p4r4',
    `revision: "${opts.revision ?? '1'}"`,
    'leader:',
    '  templateId: leader',
    '  persona: Lead.',
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items: [team_send_message]',
    '    builtinToolDeny: []',
    '    skills:',
    '      kind: allow',
    '      items: []',
    '    mcp:',
    '      kind: allow',
    '      items: []',
    ...permsBlock(opts.leaderWrite ?? [], opts.leaderBashAny, 4),
    'members:',
    '  - templateId: worker',
    '    displayName: Worker',
    '    persona: Work.',
    '    capabilities:',
    '      teamTools:',
    '        kind: allow',
    '        items: [team_send_message]',
    '      builtinToolDeny: []',
    '      skills:',
    '        kind: allow',
    '        items: []',
    '      mcp:',
    '        kind: allow',
    '        items: []',
    ...(opts.workerWrite === undefined ? [] : permsBlock(opts.workerWrite, undefined, 6)),
    ...(opts.carrier ?? []),
    'teamEnvelope:',
    '  allow: [send-message]',
    '  deny: []',
    'memberEnvelopes:',
    '  - templateId: worker',
    '    envelope:',
    '      allow: [send-message]',
    '      deny: []',
    'policyStates:',
    '  - id: default',
    '    description: d',
    'quotas:',
    '  team: { maxInstances: 4, maxConcurrent: 4 }',
    '  members: { maxInstances: 2, maxConcurrent: 2 }',
    'metadata: {}',
    '---',
  ].join('\n')
}

/** A carrier over one file rule. */
function fileCarrier(operationClass: string, kind: 'exact' | 'subtree', path: string, maximumEffect: string): string[] {
  return [
    'permissionMutationEnvelope:',
    '  rules:',
    `    - operationClass: ${operationClass}`,
    '      matcher:',
    `        kind: ${kind}`,
    `        path: "${path}"`,
    `      maximumEffect: ${maximumEffect}`,
  ]
}

/** A carrier over one exec fingerprint rule. */
function fingerprintCarrier(operationClass: string, fingerprint: string, maximumEffect: string): string[] {
  return [
    'permissionMutationEnvelope:',
    '  rules:',
    `    - operationClass: ${operationClass}`,
    '      matcher:',
    '        kind: fingerprint',
    `        fingerprint: "${fingerprint}"`,
    `      maximumEffect: ${maximumEffect}`,
  ]
}

// ──────────────────────────────────────────────────────────────────────────
// Group A harness — the production authority-facts builder DIRECTLY, over a
// provider double that mirrors the host canonicalizer contract.
// ──────────────────────────────────────────────────────────────────────────

interface Harness {
  readonly facts: ReturnType<typeof createPermissionAuthorityFacts>
  readonly calls: () => number
  readonly bpA: ReturnType<typeof parseBlueprint>
  readonly bpB: ReturnType<typeof parseBlueprint>
  blueprints: Map<string, ReturnType<typeof parseBlueprint>>
  templates: Map<string, string | undefined>
  workspaces: Map<string, string | undefined>
  faultsLeft: { value: number }
}

function harness(opts: {
  blueprints: Record<string, string>
  templates: Record<string, string | undefined>
  workspaces: Record<string, string | undefined>
  faults?: number
}): Harness {
  const blueprints = new Map<string, ReturnType<typeof parseBlueprint>>()
  for (const [team, source] of Object.entries(opts.blueprints)) {
    blueprints.set(team, parseBlueprint(source))
  }
  const templates = new Map(Object.entries(opts.templates))
  const workspaces = new Map(Object.entries(opts.workspaces))
  const faultsLeft = { value: opts.faults ?? 0 }
  let calls = 0
  const facts = createPermissionAuthorityFacts({
    resolveBlueprint: (team) => blueprints.get(team),
    memberTemplateId: (team, member) => templates.get(`${team}|${member}`),
    memberWorkspace: (team, member) => workspaces.get(`${team}|${member}`),
    canonicalize: async (path, cwd) => {
      if (faultsLeft.value > 0) {
        faultsLeft.value -= 1
        throw new Error('injected provider fault')
      }
      calls += 1
      // The host contract: the fs provider resolves against the SUPPLIED cwd.
      return path.startsWith('/') ? path : `${cwd.replace(/\/$/, '')}/${path}`
    },
  })
  return {
    facts,
    calls: () => calls,
    bpA: blueprints.get('session-team-a') ?? blueprints.values().next().value as never,
    bpB: blueprints.get('session-team-b') as never,
    blueprints,
    templates,
    workspaces,
    faultsLeft,
  }
}

const TEAM_A = 'session-team-a'
const TEAM_B = 'session-team-b'
const WORKER = 'inst-worker'
const OTHER = 'inst-other'

describe('createPermissionAuthorityFacts (round 4): addressed-team binding + carrier envelope + target-workspace anchor', () => {
  it('A1 — each addressed team reads its OWN bound Blueprint (identical template ids, row-wide constant dead)', async () => {
    // Both blueprints use the SAME templateId `worker` (the exact BLOCK-2
    // shape): team A carries the expansion authority, team B carries NONE.
    const h = harness({
      blueprints: {
        [TEAM_A]: bpSource({
          carrier: fileCarrier('write', 'exact', '/ws/a/out.json', 'allow'),
          workerWrite: [{ kind: 'exact', path: '/ws/a/out.json' }],
        }),
        [TEAM_B]: bpSource({
          workerWrite: [{ kind: 'exact', path: '/ws/b/out.json' }],
        }),
      },
      templates: {
        [`${TEAM_A}|${WORKER}`]: 'worker',
        [`${TEAM_B}|${WORKER}`]: 'worker',
      },
      workspaces: {
        [`${TEAM_A}|${WORKER}`]: '/ws/a',
        [`${TEAM_B}|${WORKER}`]: '/ws/b',
      },
    })
    const envA = await h.facts.permissionEnvelope(TEAM_A, WORKER)
    expect(envA.rules).toHaveLength(1)
    expect(envA.rules[0]?.matcher).toEqual({ kind: 'exact', resource: '/ws/a/out.json' })
    const envB = await h.facts.permissionEnvelope(TEAM_B, WORKER)
    expect(envB.rules, 'team B has NO carrier — the row-wide constant envelope is dead').toEqual([])
    // Static facts resolve from each team's OWN bound template as well.
    const factsA = await h.facts.staticLayers(TEAM_A, WORKER)
    const factsB = await h.facts.staticLayers(TEAM_B, WORKER)
    expect(factsA?.layers[0]?.rules.map((r) => `${r.effect}:${r.matcher.resource}`)).toEqual(['allow:/ws/a/out.json'])
    expect(factsB?.layers[0]?.rules.map((r) => `${r.effect}:${r.matcher.resource}`)).toEqual(['allow:/ws/b/out.json'])
    // An unaddressable team (no durable row → resolver throws upstream → the
    // host wrapper abstains) is UNKNOWN, never a fallback to the anchor.
    const envGhost = await h.facts.permissionEnvelope('session-ghost', WORKER)
    expect(envGhost.rules).toEqual([])
    expect(await h.facts.staticLayers('session-ghost', WORKER)).toBeUndefined()
  })

  it('A2 — relative matchers canonicalize at the TARGET member workspace, never a shared anchor', async () => {
    const h = harness({
      blueprints: { [TEAM_A]: bpSource({ carrier: fileCarrier('write', 'exact', 'out.json', 'allow') }) },
      templates: { [`${TEAM_A}|${WORKER}`]: 'worker', [`${TEAM_A}|${OTHER}`]: 'worker' },
      workspaces: { [`${TEAM_A}|${WORKER}`]: '/members/m1', [`${TEAM_A}|${OTHER}`]: '/members/m2' },
    })
    const envW = await h.facts.permissionEnvelope(TEAM_A, WORKER)
    const envO = await h.facts.permissionEnvelope(TEAM_A, OTHER)
    expect(envW.rules[0]?.matcher).toEqual({ kind: 'exact', resource: '/members/m1/out.json' })
    expect(envO.rules[0]?.matcher).toEqual({ kind: 'exact', resource: '/members/m2/out.json' })
    // And the member's OWN static rules share the same anchor.
    const h2 = harness({
      blueprints: {
        [TEAM_A]: bpSource({ workerWrite: [{ kind: 'exact', path: 'out.json' }] }),
      },
      templates: { [`${TEAM_A}|${WORKER}`]: 'worker' },
      workspaces: { [`${TEAM_A}|${WORKER}`]: '/members/m1' },
    })
    const facts = await h2.facts.staticLayers(TEAM_A, WORKER)
    expect(facts?.layers[0]?.rules.map((r) => `${r.effect}:${r.matcher.resource}`)).toEqual(['allow:/members/m1/out.json'])
  })

  it('A3 — exec fingerprints carry VERBATIM with ZERO provider calls (BLOCK-1 grammar reachability)', async () => {
    const fp = `sha256:${'a'.repeat(64)}`
    const h = harness({
      blueprints: { [TEAM_A]: bpSource({ leaderBashAny: 'allow', carrier: fingerprintCarrier('bash', fp, 'allow') }) },
      templates: { [`${TEAM_A}|${WORKER}`]: 'worker' },
      workspaces: { [`${TEAM_A}|${WORKER}`]: '/members/m1' },
    })
    const env = await h.facts.permissionEnvelope(TEAM_A, WORKER)
    expect(env.rules).toEqual([
      { operationClass: 'bash', matcher: { kind: 'fingerprint', resource: fp }, maximumEffect: 'allow' },
    ])
    const facts = await h.facts.staticLayers(TEAM_A, WORKER)
    expect(facts).toEqual({ layers: [] }) // the worker template declares none
    expect(h.calls(), 'a fingerprint canonicalizes nothing; a no-permissions template canonicalizes nothing').toBe(0)
  })

  it('A4 — an absent carrier is a LEGAL typed absence (zero authority, zero fs calls), never a read failure', async () => {
    const h = harness({
      blueprints: {
        [TEAM_A]: bpSource({ workerWrite: [{ kind: 'exact', path: '/ws/a/keep.json' }] }),
      },
      templates: { [`${TEAM_A}|${WORKER}`]: 'worker' },
      workspaces: { [`${TEAM_A}|${WORKER}`]: '/ws/a' },
    })
    const env = await h.facts.permissionEnvelope(TEAM_A, WORKER)
    expect(env.rules).toEqual([])
    // …while the UNAFFECTED reads keep working on correct current facts.
    const facts = await h.facts.staticLayers(TEAM_A, WORKER)
    expect(facts?.layers).toHaveLength(1)
    expect(h.facts.healthy()).toBe(true)
  })

  it('A5 — unknown bindings abstain fail-closed (typed downstream), never hard-fail reads', async () => {
    const h = harness({
      blueprints: { [TEAM_A]: bpSource({ carrier: fileCarrier('write', 'exact', 'out.json', 'allow') }) },
      templates: { [`${TEAM_A}|${WORKER}`]: 'worker' },
      workspaces: { [`${TEAM_A}|${WORKER}`]: '/ws/a' },
    })
    // Member with NO durable row: template UNKNOWN → static UNKNOWN.
    expect(await h.facts.staticLayers(TEAM_A, 'inst-ghost')).toBeUndefined()
    // Member with no resolvable workspace → zero envelope (never a guess).
    h.workspaces.set(`${TEAM_A}|${WORKER}`, undefined)
    const env = await h.facts.permissionEnvelope(TEAM_A, WORKER)
    expect(env.rules).toEqual([])
    expect(h.calls()).toBe(0)
  })

  it('A6 — a provider fault abstains WITHOUT caching (bounded recovery: the next read rebuilds)', async () => {
    const h = harness({
      blueprints: { [TEAM_A]: bpSource({ carrier: fileCarrier('write', 'exact', 'out.json', 'allow') }) },
      templates: { [`${TEAM_A}|${WORKER}`]: 'worker' },
      workspaces: { [`${TEAM_A}|${WORKER}`]: '/ws/a' },
      faults: 1,
    })
    const first = await h.facts.permissionEnvelope(TEAM_A, WORKER)
    expect(first.rules, 'a canonicalization fault yields NO authority this round').toEqual([])
    expect(h.facts.healthy()).toBe(false)
    const second = await h.facts.permissionEnvelope(TEAM_A, WORKER)
    expect(second.rules, 'the fault was NOT cached — the retry rebuilds (GAP3 bounded recovery)').toHaveLength(1)
    expect(second.rules[0]?.matcher).toEqual({ kind: 'exact', resource: '/ws/a/out.json' })
    expect(h.facts.healthy()).toBe(true)
  })

  it('A7 — drift ACROSS the canonicalization await discards the mixed-identity document (never cached, never served)', async () => {
    const h = harness({
      blueprints: { [TEAM_A]: bpSource({ carrier: fileCarrier('write', 'exact', 'out.json', 'allow') }) },
      templates: { [`${TEAM_A}|${WORKER}`]: 'worker' },
      workspaces: { [`${TEAM_A}|${WORKER}`]: '/members/old' },
    })
    let flipped = false
    const original = h.facts
    void original
    // Flip the member's workspace WHILE the canonicalization is in flight.
    const inflight = h.facts.permissionEnvelope(TEAM_A, WORKER)
    h.workspaces.set(`${TEAM_A}|${WORKER}`, '/members/new')
    flipped = true
    const env = await inflight
    expect(flipped).toBe(true)
    expect(env.rules, 'a document canonicalized at a basis that moved mid-await is discarded whole').toEqual([])
    expect(h.facts.healthy()).toBe(false)
    // The next read (stable bindings) rebuilds correctly against CURRENT facts.
    const stable = await h.facts.permissionEnvelope(TEAM_A, WORKER)
    expect(stable.rules[0]?.matcher).toEqual({ kind: 'exact', resource: '/members/new/out.json' })
  })

  it('A8 — the cache is keyed by the FULL binding tuple (stable reads reuse; rebind rebuilds)', async () => {
    const h = harness({
      blueprints: { [TEAM_A]: bpSource({ carrier: fileCarrier('write', 'exact', 'out.json', 'allow') }) },
      templates: { [`${TEAM_A}|${WORKER}`]: 'worker' },
      workspaces: { [`${TEAM_A}|${WORKER}`]: '/ws/a' },
    })
    await h.facts.permissionEnvelope(TEAM_A, WORKER)
    const afterFirst = h.calls()
    await h.facts.permissionEnvelope(TEAM_A, WORKER)
    expect(h.calls(), 'a stable binding re-reads NOTHING from the provider').toBe(afterFirst)
    // Rebind the team to a new snapshot (carrier ceiling ASK now): the cache
    // key moved (contentHash) → the document is REBUILT, never stale-served.
    h.blueprints.set(TEAM_A, parseBlueprint(bpSource({ revision: '2', carrier: fileCarrier('write', 'exact', 'out.json', 'ask') })))
    const rebound = await h.facts.permissionEnvelope(TEAM_A, WORKER)
    expect(rebound.rules[0]?.maximumEffect).toBe('ask')
    expect(h.calls()).toBeGreaterThan(afterFirst)
  })

  it('A9 — the leader-ceiling facts read the LEADER template AT THE TARGET MEMBER basis (X1 shared key space)', async () => {
    const h = harness({
      blueprints: {
        [TEAM_A]: bpSource({ leaderWrite: [{ kind: 'subtree', path: 'work' }] }),
      },
      templates: { [`${TEAM_A}|${WORKER}`]: 'worker' },
      workspaces: { [`${TEAM_A}|${WORKER}`]: '/members/m1' },
    })
    const ceiling = await h.facts.leaderAuthorityFacts(TEAM_A, WORKER)
    expect(ceiling?.layers[0]?.label).toBe('leader')
    expect(ceiling?.layers[0]?.rules.map((r) => `${r.effect}:${r.matcher.resource}`)).toEqual(['allow:/members/m1/work'])
    expect(await h.facts.leaderAuthorityFacts(TEAM_A, 'inst-ghost')).toBeUndefined()
    // The leader POSITION reads its own template at ITS OWN workspace.
    h.workspaces.set(`${TEAM_A}|${LEADER_INSTANCE_ID}`, '/team/default')
    h.templates.set(`${TEAM_A}|${LEADER_INSTANCE_ID}`, undefined)
    const own = await h.facts.staticLayers(TEAM_A, LEADER_INSTANCE_ID)
    expect(own?.layers[0]?.label).toBe('leader')
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Group B — the kernel authorityCeiling (X1's two demos pinned verbatim).
// ──────────────────────────────────────────────────────────────────────────

function ov(operation: string, matcher: Parameters<typeof renderPermissionResourceText>[0], effect: 'allow' | 'ask' | 'deny'): PermissionOverlayRule {
  return { operation, resource: renderPermissionResourceText(matcher), effect }
}

function staticLayer(rules: readonly { operationClass: string; matcher: { kind: 'exact' | 'subtree'; resource: string }; effect: 'allow' | 'ask' | 'deny' }[]): PermissionStaticLayerFacts {
  return { layers: [{ label: 't', default: 'deny', rules: [...rules] }] }
}

const keyContainment = (parent: string, child: string): boolean => {
  const rel = relative(resolve(parent), resolve(child))
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

const ENVELOPE_WORK_ALLOW: PermissionMutationEnvelope = {
  rules: [{ operationClass: 'write', matcher: { kind: 'subtree', resource: '/work' }, maximumEffect: 'allow' }],
}

describe('authorizeLeaderPermissionMutation authorityCeiling (round 4): the grantor cannot give what it does not hold', () => {
  it('B1 (X1 demo 1, deny-exception leg) — allow-subtree + DENY-exact leader cannot grant the exception ALLOW, and CAN grant the rest', () => {
    const base = {
      latestRules: [] as PermissionOverlayRule[],
      envelope: ENVELOPE_WORK_ALLOW,
      staticFacts: { layers: [] } as PermissionStaticLayerFacts, // target declares none → deny fallback
      subtreeContains: keyContainment,
      authorityCeiling: {
        overlayRules: [] as PermissionOverlayRule[],
        staticFacts: staticLayer([
          { operationClass: 'write', matcher: { kind: 'subtree', resource: '/work' }, effect: 'allow' },
          { operationClass: 'write', matcher: { kind: 'exact', resource: '/work/secret' }, effect: 'deny' },
        ]),
      },
    }
    expect(() =>
      authorizeLeaderPermissionMutation({
        ...base,
        plannedRules: [ov('write', { kind: 'exact', resource: '/work/secret' }, 'allow')],
        mutationRules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: '/work/secret' }, effect: 'allow' }],
      }),
    ).toThrowError(expect.objectContaining({ code: PERMISSION_MUTATION_ERROR_CODES.EXPANSION_OUTSIDE_ENVELOPE }))
    // The same grant WITHOUT the exception inside the leader's own lane
    // commits — the denial is what subtracts, not the region shape.
    expect(() =>
      authorizeLeaderPermissionMutation({
        ...base,
        plannedRules: [ov('write', { kind: 'exact', resource: '/work/ok' }, 'allow')],
        mutationRules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: '/work/ok' }, effect: 'allow' }],
      }),
    ).not.toThrow()
  })

  it('B2 (X1 demo 2, ask-ceiling leg) — an ASK exception caps the grantor at ASK (allow refuses, ask commits)', () => {
    const base = {
      latestRules: [] as PermissionOverlayRule[],
      envelope: ENVELOPE_WORK_ALLOW,
      staticFacts: { layers: [] } as PermissionStaticLayerFacts,
      subtreeContains: keyContainment,
      authorityCeiling: {
        overlayRules: [] as PermissionOverlayRule[],
        staticFacts: staticLayer([
          { operationClass: 'write', matcher: { kind: 'subtree', resource: '/work' }, effect: 'allow' },
          { operationClass: 'write', matcher: { kind: 'exact', resource: '/work/b' }, effect: 'ask' },
        ]),
      },
    }
    let thrown: unknown
    try {
      authorizeLeaderPermissionMutation({
        ...base,
        plannedRules: [ov('write', { kind: 'exact', resource: '/work/b' }, 'allow')],
        mutationRules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: '/work/b' }, effect: 'allow' }],
      })
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(PermissionMutationError)
    expect((thrown as PermissionMutationError).code).toBe(PERMISSION_MUTATION_ERROR_CODES.EXPANSION_OUTSIDE_ENVELOPE)
    expect(() =>
      authorizeLeaderPermissionMutation({
        ...base,
        plannedRules: [ov('write', { kind: 'exact', resource: '/work/b' }, 'ask')],
        mutationRules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: '/work/b' }, effect: 'ask' }],
      }),
    ).not.toThrow()
  })

  it('B3 — an UNKNOWN grantor refuses EFFECT_CONTEXT_UNAVAILABLE (an unknown leader is never assumed to hold the effect)', () => {
    expect(() =>
      authorizeLeaderPermissionMutation({
        latestRules: [],
        plannedRules: [ov('write', { kind: 'exact', resource: '/work/x' }, 'allow')],
        mutationRules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: '/work/x' }, effect: 'allow' }],
        envelope: ENVELOPE_WORK_ALLOW,
        staticFacts: { layers: [] },
        subtreeContains: keyContainment,
        authorityCeiling: { overlayRules: [], staticFacts: undefined },
      }),
    ).toThrowError(expect.objectContaining({ code: PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE }))
  })

  it('B4 — legacy compatibility: WITHOUT authorityCeiling the envelope-only judgement is byte-for-byte the PR3 algebra', () => {
    // The exact B1 refused-grant input minus the ceiling: the hand-authored
    // pre-round-4 lanes (the a3p3 suite, 80/80 family) keep flowing.
    expect(() =>
      authorizeLeaderPermissionMutation({
        latestRules: [],
        plannedRules: [ov('write', { kind: 'exact', resource: '/work/secret' }, 'allow')],
        mutationRules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: '/work/secret' }, effect: 'allow' }],
        envelope: ENVELOPE_WORK_ALLOW,
        staticFacts: { layers: [] },
        subtreeContains: keyContainment,
      }),
    ).not.toThrow()
  })

  it('B5 (R-A shape) — honestly-anchored deny facts make the deny→allow flip a PROVEN rise that refuses (the laundering class stays closed)', () => {
    // The round-3 laundering needed MIS-ANCHORED facts (the deny key at the
    // wrong root so the cell "saw no rise"). With the facts at the target's
    // basis (Group A2), the flip is decidable and the envelope-free grant
    // refuses typed — never commits.
    expect(() =>
      authorizeLeaderPermissionMutation({
        latestRules: [],
        plannedRules: [ov('write', { kind: 'exact', resource: '/members/m1/data/g.json' }, 'allow')],
        mutationRules: [
          { operationClass: 'write', matcher: { kind: 'exact', resource: '/members/m1/data/g.json' }, effect: 'allow' },
        ],
        envelope: { rules: [] },
        staticFacts: staticLayer([
          { operationClass: 'write', matcher: { kind: 'subtree', resource: '/members/m1/data' }, effect: 'deny' },
        ]),
        subtreeContains: keyContainment,
      }),
    ).toThrowError(expect.objectContaining({ code: PERMISSION_MUTATION_ERROR_CODES.EXPANSION_OUTSIDE_ENVELOPE }))
  })
})
