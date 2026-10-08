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
  /** §7.3 v3-only: `3` is the ONLY document version this build parses, so the
   *  option is the literal `3` — a caller can no longer ask for a v1 or v2
   *  fixture by accident, and the two legs whose subject WAS a v1 document say
   *  so by building their bytes directly instead of reaching for a digit that
   *  no longer exists. */
  readonly schemaVersion?: 3
  /** Build a document that OMITS both required authority documents. Only a
   *  leg that proves the refusal may use this: at v3 the pair is required, so
   *  omitting it is an invalid document, not a legal absence. */
  readonly omitCarriers?: boolean
  /** The v3 `teamHardEnvelope` carrier lines (a SECOND document, never a
   *  rename of the first — spec §3.2/§7.4). */
  readonly hardCarrier?: readonly string[]
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
    `schemaVersion: ${String(opts.schemaVersion ?? 3)}`,
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
    // §7.3 v3-only: a v3 document MUST declare both authority documents
    // (`validate.ts` requires them before any canonicalization exists), so an
    // omitted carrier is no longer a representable document shape. Callers that
    // exercise a SPECIFIC carrier still pass it; the rest get the honest zero
    // `rules: []` — no authority, which is exactly what "no carrier" used to
    // mean for every read in this file. `omitCarriers` is the one escape hatch,
    // and it exists only so a leg can prove the refusal.
    ...(opts.omitCarriers
      ? []
      : [
          ...(opts.carrier ?? ['permissionMutationEnvelope:', '  rules: []']),
          ...(opts.hardCarrier ?? ['teamHardEnvelope:', '  rules: []']),
        ]),
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

  it('A8 (round 5 rewrite) — NO cross-call authority cache: every read canonicalizes FRESH; a rebind lands on the next read', async () => {
    const h = harness({
      blueprints: { [TEAM_A]: bpSource({ carrier: fileCarrier('write', 'exact', 'out.json', 'allow') }) },
      templates: { [`${TEAM_A}|${WORKER}`]: 'worker' },
      workspaces: { [`${TEAM_A}|${WORKER}`]: '/ws/a' },
    })
    await h.facts.permissionEnvelope(TEAM_A, WORKER)
    const afterFirst = h.calls()
    await h.facts.permissionEnvelope(TEAM_A, WORKER)
    // Round 5 (parent ruling + R-A): a CONSTANT provider version is NOT a
    // version — after a symlink/junction re-point or a lazy provider swap a
    // cached canonical would authorize stale paths. Every read therefore
    // canonicalizes FRESH through the CURRENT provider (the governance
    // service's serialized outer layer makes this per-mutation).
    expect(h.calls(), 'a stable binding must re-read the provider FRESH (no unprovable-version cache)').toBeGreaterThan(afterFirst)
    // Rebind the team to a new snapshot (carrier ceiling ASK now): the next
    // read reflects the NEW binding immediately — fresh by construction.
    h.blueprints.set(TEAM_A, parseBlueprint(bpSource({ revision: '2', carrier: fileCarrier('write', 'exact', 'out.json', 'ask') })))
    const rebound = await h.facts.permissionEnvelope(TEAM_A, WORKER)
    expect(rebound.rules[0]?.maximumEffect).toBe('ask')
    expect(h.calls()).toBeGreaterThan(afterFirst)
  })

  it('A9 (round 5 rewrite) — the LEADER POSITION reads its own template through the SAME addressed staticLayers reader', async () => {
    // Round 4's leader-ceiling reader is REMOVED (the parent's final review:
    // the ceiling fold was a second policy gate ADR §6 does not have). The
    // leader position remains a first-class addressed reader for its OWN
    // static facts (the decision-plane consumer of the leader template).
    const h = harness({
      blueprints: {
        [TEAM_A]: bpSource({ leaderWrite: [{ kind: 'subtree', path: 'work' }] }),
      },
      templates: { [`${TEAM_A}|${WORKER}`]: 'worker' },
      workspaces: { [`${TEAM_A}|${WORKER}`]: '/members/m1' },
    })
    // The leader position has NO member row: the template comes from the
    // bound Blueprint's leader, the workspace from the caller-supplied
    // effective root workspace (the durable TeamSession default — FIX-3).
    h.workspaces.set(`${TEAM_A}|${LEADER_INSTANCE_ID}`, '/team/default')
    const own = await h.facts.staticLayers(TEAM_A, LEADER_INSTANCE_ID)
    expect(own?.layers[0]?.label).toBe('leader')
    expect(own?.layers[0]?.rules.map((r) => `${r.effect}:${r.matcher.resource}`)).toEqual(['allow:/team/default/work'])
    expect(await h.facts.staticLayers('session-ghost', LEADER_INSTANCE_ID)).toBeUndefined()
    expect(await (h.facts.permissionEnvelope(TEAM_A, LEADER_INSTANCE_ID))).toBeDefined()
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

describe('authorizeLeaderPermissionMutation envelope-only algebra (round 5): the carrier is the WHOLE policy — the leader-facts ceiling gate is REMOVED (ADR §6, parent final review)', () => {
  it('B1 (round-5 inversion of the X1 demo-1 shape) — the carrier subtree covering the member ALLOW COMMITS; a leader lane that denies X never gates the member expansion', () => {
    const base = {
      latestRules: [] as PermissionOverlayRule[],
      envelope: ENVELOPE_WORK_ALLOW,
      staticFacts: { layers: [] } as PermissionStaticLayerFacts, // target declares none → deny fallback
      subtreeContains: keyContainment,
    }
    // Round 4 REFUSED this shape via the leader-facts ceiling fold; the
    // parent's final review ruled that fold a SECOND policy condition the
    // frozen §6 does not carry. The envelope is the whole expansion policy:
    // a covering carrier commits, and what the leader's OWN lane holds is
    // the leader's execution question, not the grantor's gate. Carrier
    // breadth over a leader deny is a content-hash-pinned blueprint AUTHOR
    // choice (§6), pinned here as the ruled semantics.
    expect(() =>
      authorizeLeaderPermissionMutation({
        ...base,
        plannedRules: [ov('write', { kind: 'exact', resource: '/work/secret' }, 'allow')],
        mutationRules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: '/work/secret' }, effect: 'allow' }],
      }),
    ).not.toThrow()
    // The rest of the covered region commits, as always.
    expect(() =>
      authorizeLeaderPermissionMutation({
        ...base,
        plannedRules: [ov('write', { kind: 'exact', resource: '/work/ok' }, 'allow')],
        mutationRules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: '/work/ok' }, effect: 'allow' }],
      }),
    ).not.toThrow()
  })

  it('B2 (envelope-level subtraction) — the carrier\'s OWN maximumEffect ladder is the cap (ask covers ask, refuses allow)', () => {
    // The subtraction that SURVIVES the ceiling removal is the envelope's
    // own ladder-strictness: a carrier rule with maximumEffect `ask` never
    // contributes `allow` coverage (this is the same math the entry
    // R4-ceiling leg pins at host apply — envelope arithmetic, not leader
    // facts). The R-A ruling: carrier exception lanes are structural;
    // breadth is the author\'s declared choice.
    const envelope: PermissionMutationEnvelope = {
      rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: '/work/b' }, maximumEffect: 'ask' }],
    }
    let thrown: unknown
    try {
      authorizeLeaderPermissionMutation({
        latestRules: [],
        plannedRules: [ov('write', { kind: 'exact', resource: '/work/b' }, 'allow')],
        mutationRules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: '/work/b' }, effect: 'allow' }],
        envelope,
        staticFacts: { layers: [] } as PermissionStaticLayerFacts,
        subtreeContains: keyContainment,
      })
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(PermissionMutationError)
    expect((thrown as PermissionMutationError).code).toBe(PERMISSION_MUTATION_ERROR_CODES.EXPANSION_OUTSIDE_ENVELOPE)
    expect(() =>
      authorizeLeaderPermissionMutation({
        latestRules: [],
        plannedRules: [ov('write', { kind: 'exact', resource: '/work/b' }, 'ask')],
        mutationRules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: '/work/b' }, effect: 'ask' }],
        envelope,
        staticFacts: { layers: [] } as PermissionStaticLayerFacts,
        subtreeContains: keyContainment,
      }),
    ).not.toThrow()
  })

  // B3 (round-4 unknown-grantor leg) is REMOVED with the ceiling gate: an
  // unknown leader had no meaning once the leader facts are out of the
  // grant decision (round-5 FIX-1; R-C classification).

  it('B4 — the envelope-only judgement is the UNCONDITIONAL algebra (post-removal this is the whole decision)', () => {
    // The exact B1 input shape: after the round-5 removal there is no
    // ceiling input to omit — this is the PR3 algebra every caller gets
    // (the a3p3 suite, 80/80 family, pins the same envelope-only math).
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

// ──────────────────────────────────────────────────────────────────────────
// Group C (A4-PR1) — the v3 `teamHardEnvelope` READER. Nothing in production
// authorization consults this document yet: PR1 wires no caller (plan Task 1),
// and the v1/v2-vs-v3 switch in `buildEnvelope`'s consumers stays PR2's per ADR
// A5-12. What is pinned here is the reader's CONTRACT, because PR2's decision
// rests on three distinctions whose wrong side would each be green under a
// naive `document ?? { rules: [] }` implementation:
//   absent (a v1/v2 team)      ≠ declared-empty (a v3 team that says so)
//   declared-empty             ≠ unavailable (a faulted or drifted read)
// and on the APPROVAL plane the first two mean "narrows nothing" while the
// third must mean "no answer" — an approval ceiling is the one place where
// handing out the identity is the UNSAFE direction (ADR A1-4/A1-7/A2-4).
//
// §7.3 v3-only changes the FIRST of those three, not the ban on synthesizing
// it: `absent` was reached by "a v1/v2 team", and there are no v1/v2 documents
// any more (both authority documents are required fields at v3). So `absent`
// has no reachable document trigger — see C1, which records the branch this
// leaves dead in `permission-plane.ts` / `authority-ceiling.ts`. `declared` and
// `unavailable` are unchanged, and C1/C3/C4 keep the three answers apart.
// ──────────────────────────────────────────────────────────────────────────

/** The v3 hard-ceiling carrier: same grammar as the mutation carrier, because
 *  A3-9 made it ONE grammar — two documents, two roles, one shape. */
function hardCarrierLines(rules: readonly (readonly string[] | string)[]): string[] {
  // `.flat()` because a rule is a LINE GROUP, not a line — one element per rule
  // keeps the call sites readable, and `join('\n')` upstream would otherwise
  // render a whole rule as a comma-joined scalar (a YAML error far from its
  // cause, which is exactly why this comment is here).
  return ['teamHardEnvelope:', '  rules:', ...rules.flat()]
}

function hardRule(operationClass: string, matcherLines: readonly string[], maximumEffect: string): string[] {
  return [`    - operationClass: ${operationClass}`, '      matcher:', ...matcherLines, `      maximumEffect: ${maximumEffect}`]
}

describe('createPermissionAuthorityFacts (A4-PR1): the v3 hard-ceiling reader is additive, and absence is not a fault', () => {
  const v3Bp = (opts: { readonly hard: readonly (readonly string[] | string)[] }): string =>
    bpSource({
      revision: '1',
      schemaVersion: 3,
      carrier: fileCarrier('write', 'subtree', '/work/lead', 'allow'),
      hardCarrier: hardCarrierLines(opts.hard),
    })
  const v3Harness = (hard: readonly (readonly string[] | string)[], faults?: number): Harness =>
    harness({
      blueprints: { [TEAM_A]: v3Bp({ hard }) },
      templates: { [`${TEAM_A}|${WORKER}`]: 'worker' },
      workspaces: { [`${TEAM_A}|${WORKER}`]: '/work/m1' },
      ...(faults === undefined ? {} : { faults }),
    })

  // §7.3 DELETE-SUBJECT half: the ORIGINAL C1 read a v1 document through the
  // hard-ceiling reader and asserted `{ status: 'absent' }`. That scenario is no
  // longer reachable: `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS` is `[3]`, so
  // `parseBlueprint` refuses the bytes before any reader exists, and at v3 BOTH
  // authority documents are required fields — which means
  // `permission-plane.ts` `readHardCeiling`'s `document === undefined` branch
  // has NO reachable trigger any more (its companion comment in
  // `authority-ceiling.ts` still says "a v1/v2 Team states `{ status: 'absent' }`";
  // that sentence, and that branch, are what this cutover makes stale — recorded
  // here and in 7-3-flip/FINDINGS.md rather than quietly left in place, because
  // retiring a production branch is not part of the version flip).
  //
  // What this leg KEEPS is the half that was never about v1: the three answers
  // a hard ceiling can give stay three distinct answers, and the reader still
  // never hands out a synthesized `{ rules: [] }`. The two reachable outcomes
  // are pinned by C3 (declared-empty) and C4 (unavailable); this leg pins the
  // two ways a document can now be REFUSED instead of read.
  it('C1 (§7.3 migration-required contract) — a retired-version document and a v3 document missing a required authority document are both refused before any read exists', async () => {
    // (1) The exact bytes the original C1 fed the reader: a v1 document, now
    // carrying both authority documents so that the VERSION is the only thing
    // wrong with it (an omitted carrier would refuse for a different reason and
    // this assertion would pass for the wrong cause).
    const v1Source = bpSource({
      revision: '1',
      carrier: fileCarrier('write', 'subtree', '/work/lead', 'allow'),
      hardCarrier: hardCarrierLines([hardRule('write', ['        kind: subtree', '        path: "/work/m1/src"'], 'allow')]),
    }).replace('schemaVersion: 3', 'schemaVersion: 1')
    // The re-stamp must actually have applied. A fixture that quietly stayed v3
    // would make this pass while proving nothing — the §7.4 census caught that
    // exact failure mode in `askFixtureVariant`.
    expect(v1Source, 'the version re-stamp must have applied').toContain('schemaVersion: 1')
    // The code is the DOMAIN one. Deliberately NOT
    // `BLUEPRINT_SCHEMA_VERSION_UNSUPPORTED`: A1-21 keeps those refusals apart
    // because they ask the operator for different actions. At the plugin
    // boundary these same bytes answer `BLUEPRINT_MIGRATION_REQUIRED`, because
    // v1/v2 land in the DERIVED `RETIRED_BLUEPRINT_DOCUMENT_VERSIONS` — that
    // routing moved with the accepted set on its own, which is the payoff of
    // deriving it instead of hard-coding 1 and 2.
    expect(() => parseBlueprint(v1Source)).toThrowError(
      expect.objectContaining({ code: 'SCHEMA_VERSION_MISMATCH' }),
    )

    // (2) A v3 document that declares NO authority documents is an INVALID
    // document, not a legal absence: `validate.ts` `requireField` fires for
    // `permissionMutationEnvelope` first, before any canonicalization or
    // authority read exists, and it names the field it wanted.
    expect(() =>
      parseBlueprint(bpSource({ revision: '1', carrier: fileCarrier('write', 'subtree', '/work/lead', 'allow'), omitCarriers: true })),
    ).toThrowError(
      expect.objectContaining({
        code: 'MALFORMED_DTO',
        message: expect.stringContaining("missing required field 'permissionMutationEnvelope'"),
      }),
    )

    // (3) And the ban the original leg was really about survives verbatim: the
    // declared-empty outcome belongs to a document that SAYS so, and nothing
    // above this line produced one.
    const declaredEmpty = parseBlueprint(bpSource({ revision: '1' }))
    expect(declaredEmpty.teamHardEnvelope).toEqual({ rules: [] })
  })

  it('C2 — a v3 hard ceiling resolves file matchers at the TARGET WORKSPACE and carries a fingerprint verbatim', async () => {
    const h = v3Harness([
      hardRule('write', ['        kind: subtree', '        path: "src/**"'], 'ask'),
      hardRule('bash', ['        kind: fingerprint', '        fingerprint: "sha256:deadbeef"'], 'deny'),
    ])
    const read = await h.facts.teamHardEnvelope(TEAM_A, WORKER)
    expect(read.status).toBe('declared')
    if (read.status !== 'declared') return
    expect(read.document.rules.length).toBe(2)
    const [fileRule, execRule] = read.document.rules
    expect(fileRule?.matcher).toEqual({ kind: 'subtree', resource: '/work/m1/src/**' })
    expect(fileRule?.maximumEffect).toBe('ask')
    // The exec identity is the fingerprint: canonicalizing it through the PATH
    // provider would let a filesystem answer rename an operation identity.
    expect(execRule?.matcher).toEqual({ kind: 'fingerprint', resource: 'sha256:deadbeef' })
    // Exactly one provider call for two rules — the counter is the assertion
    // that "verbatim" is a fact about the code path, not about the output text.
    expect(h.calls()).toBe(1)
    // The hard ceiling is its OWN document: the mutation carrier on the same
    // blueprint is untouched by this read (two documents, two readers).
    const ceiling = await h.facts.permissionEnvelope(TEAM_A, WORKER)
    expect(ceiling.rules.length).toBe(1)
    expect(ceiling.rules[0]?.matcher).toEqual({ kind: 'subtree', resource: '/work/lead' })
  })

  it('C3 — a declared-empty v3 ceiling is `declared` with zero rules and ZERO provider calls', async () => {
    const h = v3Harness(['    []'])
    const read = await h.facts.teamHardEnvelope(TEAM_A, WORKER)
    // `status: 'declared'` is the ONLY place a `{rules: []}` hard ceiling may
    // come from: a document that says so. Absence (C1) and failure (C4) have
    // their own outcomes and never borrow this one.
    expect(read.status).toBe('declared')
    if (read.status !== 'declared') return
    expect(read.document).toEqual({ rules: [] })
    expect(h.calls()).toBe(0)
  })

  it('C4 — a provider fault is `unavailable`, never `absent` (the widening this outcome exists to prevent)', async () => {
    const h = v3Harness([hardRule('write', ['        kind: subtree', '        path: "src/**"'], 'ask')], 1)
    const read = await h.facts.teamHardEnvelope(TEAM_A, WORKER)
    expect(read).toEqual({ status: 'unavailable' })
    // Same abstention slot that carries `NO_ENVELOPE` for the expansion reader,
    // filled with the OPPOSITE polarity on purpose: a failed expansion read
    // must mean zero authority, a failed approval-plane read must mean nothing
    // except unknown. A consumer that maps `unavailable` onto the identity has
    // widened approval authority exactly when storage is least trustworthy.
    expect(JSON.stringify(read)).not.toContain('rules')
  })
})
