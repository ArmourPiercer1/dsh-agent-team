/**
 * A6 (alpha.2, plan §11) — production wiring spec: the FROZEN A1–A5 APIs
 * composed into the live agent lifecycle.
 *
 * What this file proves (plan §11 + the A6 dispatch legs):
 *
 * 1. THE INSTALL DECISION (plan §11.1): the glue installs the A5
 *    `tools/pre-execute` listener on exactly the agents whose bound
 *    template declares `capabilities.permissions` — absent policy = ZERO
 *    listeners (the alpha.1 / legacy path stays byte-for-byte unchanged;
 *    this suite's zero-listener legs are that proof), present policy =
 *    exactly ONE listener per permitted agent (per-agent scoping).
 *
 * 2. THE LISTENER LIFECYCLE (plan §11.3): agent-scoped, lifecycle-owned —
 *    a cold resume RE-INSTALLS on the fresh agent ctx, and close() DRAINS
 *    every install (the shared toolDisposers drain). No module-level
 *    mutable authority is involved: each world's listeners live on that
 *    world's own ctx doubles.
 *
 * 3. THE FROZEN PIPELINE THROUGH THE PRODUCTION INSTALL: the REGISTERED
 *    listener (captured off the ctx double) is driven with real pre-
 *    execute payloads over the spy control service + the bridge's fake
 *    fs seam — static allow / static deny / unsupported-tool
 *    pass-through, the full ask path (request → wait → guard) with the
 *    routing bit (leader → user-approval, member → leader-approval), the
 *    exact control scope (rootSessionId / caller / targetInstanceId /
 *    actionName / toolName / correlation / operationFingerprint), and the
 *    onObserve diagnostics rows on the binding's observation surface.
 *
 * 4. THE CONTROL-SERVICE REF CONTRACT (the teamToolsRef pattern): the
 *    glue reads `controlServiceRef.current` LAZILY at setup time (a fill
 *    after construction, before boot, still installs), and a permissions
 *    template with an unfilled ref FAILS CLOSED with the typed
 *    `alpha2-permission-control-unavailable` error (setup rejection).
 *
 * 5. THE FS SEAM CONTRACT (V1-1 — the live-matrix wiring fix): the
 *    resolveTarget closure resolves file targets through the `fsBackend`
 *    deps accessor (the host row's lazy strict `ctx.get('fs')` global-
 *    store read; the property proxy `agentCtx.fs` is topology-sensitive
 *    and can never resolve on the agent scope). A permissions template
 *    with an UNUSABLE accessor FAILS CLOSED at RESOLVE time with the typed
 *    canonicalization denial (never a pass-through, zero-effect), and with
 *    the dep ABSENT it fails closed at SETUP time with the typed
 *    `alpha2-permission-fs-unavailable` error (the control-unavailable
 *    twin).
 *
 * DESIGN RULINGS pinned here (see the A6 report for the full argument):
 *
 * - FACT 3a: `staticCapabilitiesOf` does NOT project `permissions`
 *   (alpha.1 pins its shape) — the glue reads the policy DIRECTLY off the
 *   located (deep-frozen) template; this suite's per-agent scoping
 *   (leader + member A installed, member B not) is the behavioral proof.
 * - FACT 3b: the session cwd is read LAZILY at RESOLVE time off
 *   `agentCtx.agent.session.header.cwd` (never captured at install) — the
 *   lazy-cwd leg rewrites the header between drives and pins the
 *   resolver's recorded cwd.
 * - `instanceId` (from the glue's durable consumption resolution) is the
 *   caller AND targetInstanceId for both roles: the leader position
 *   resolves to `inst-leader`, a member to its durable row — pinned by
 *   the requestControl scope assertions.
 *
 * Method: the real live glue over the t12a bridge doubles (the same
 * foundation as t4a-capability-wiring) — real `agentSetup` execution on
 * real blueprint parsing, real A5 adapter, spy control service. The
 * plain-node runner constraint (synchronous `it` bodies) means every
 * world is built and every listener leg is driven at MODULE TOP LEVEL
 * (top-level await) and the `it` blocks assert on the captured state.
 *
 * Zero Team SessionEvent vocabulary (the p4t6 denylist): this file
 * carries none (the committed scanner scans it).
 */
import { describe, expect, it } from 'vitest'
import {
  WORKTREE_ROOT,
  createAgentPresetsDouble,
  createLiveWorld,
  removeFixtureHome,
  withDshHome,
  writeDurableFixture,
  type AgentCtxDouble,
} from './t12a-live-bridge.mjs'
import { join } from 'node:path'

// ── the world identities ───────────────────────────────────────────────────
const ROOT = 'session-a6a-root'
const CHILD_A = 'session-a6a-child-a'
const CHILD_B = 'session-a6a-child-b'
const INST_A = 'inst-a6aa'
const INST_B = 'inst-a6ab'
/** The glue's LEADER_INSTANCE_ID mirror (packages/contracts; the glue .mjs). */
const LEADER_INST = 'inst-leader'
/** The bridge default workspace (the meta.cwd every boot agent gets). */
const DEFAULT_WS = join(WORKTREE_ROOT, 'default-workspace')

// ── the A6 blueprint: permissions on leader + tpl-a, ABSENT on tpl-b ──────
// Every capabilities-carrying template declares all four alpha.1
// sub-fields (the closed-v1 requirement) plus — for leader and tpl-a —
// the alpha.2 `permissions` block (A1-normalized by parseBlueprint).
// tpl-b carries capabilities WITHOUT permissions: the per-agent scoping
// control (it must get ZERO listeners while its siblings get one each).
const PERMISSION_BLUEPRINT = [
  '---',
  'schemaVersion: 1',
  'blueprintId: team.a6a',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: "You are the leader of the a6a test team."',
  '  capabilities:',
  '    teamTools:',
  '      kind: allow',
  '      items:',
  '        - team_send_message',
  '        - team_list_members',
  '    builtinToolDeny: []',
  '    skills:',
  '      kind: allow',
  '      items: []',
  '    mcp:',
  '      kind: allow',
  '      items: []',
  // NOTE (H2 ruling): the former allow-lane `bash` + `any` rule was
  // REMOVED — the schema rejects a positive whole-tool bash grant in
  // the allow lane (bash is legal only as `any` in ask/deny — member A
  // below keeps its legal deny-lane bash rule for M3).
  '    permissions:',
  '      default: ask',
  '      allow:',
  '        - tool: read',
  '          resource:',
  '            kind: exact',
  '            path: "/data/notes.md"',
  '      ask:',
  '        - tool: write',
  '          resource:',
  '            kind: exact',
  '            path: "/data/notes.md"',
  '      deny:',
  '        - tool: lsp',
  '          resource:',
  '            kind: any',
  'members:',
  '  - templateId: tpl-a',
  '    persona: "You are member A of the a6a test team."',
  '    capabilities:',
  '      teamTools:',
  '        kind: allow',
  '        items:',
  '          - team_delegate',
  '      builtinToolDeny:',
  '        - write',
  '      skills:',
  '        kind: allow',
  '        items: []',
  '      mcp:',
  '        kind: deny',
  '      permissions:',
  '        default: ask',
  '        allow:',
  '          - tool: read',
  '            resource:',
  '              kind: any',
  '        ask:',
  '          - tool: write',
  '            resource:',
  '              kind: any',
  '        deny:',
  '          - tool: bash',
  '            resource:',
  '              kind: any',
  '  - templateId: tpl-b',
  '    persona: "You are member B of the a6a test team."',
  '    capabilities:',
  '      teamTools:',
  '        kind: allow',
  '        items:',
  '          - team_delegate',
  '      builtinToolDeny: []',
  '      skills:',
  '        kind: allow',
  '        items: []',
  '      mcp:',
  '        kind: deny',
  'requirements: []',
  'memberEnvelopes: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

// ── the alpha.1 regression blueprint: capabilities present on all three ────
// templates, `permissions` ABSENT on every one (the legacy/alpha.1 world:
// the full capability wiring must apply exactly as t4a pins it, and ZERO
// permission listeners may install).
const ALPHA1_BLUEPRINT = [
  '---',
  'schemaVersion: 1',
  'blueprintId: team.a6a-alpha1',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: "You are the leader of the a6a alpha.1 team."',
  '  capabilities:',
  '    teamTools:',
  '      kind: allow',
  '      items:',
  '        - team_send_message',
  '        - team_list_members',
  '    builtinToolDeny: []',
  '    skills:',
  '      kind: allow',
  '      items: []',
  '    mcp:',
  '      kind: allow',
  '      items: []',
  'members:',
  '  - templateId: tpl-a',
  '    persona: "You are member A of the a6a alpha.1 team."',
  '    capabilities:',
  '      teamTools:',
  '        kind: allow',
  '        items:',
  '          - team_delegate',
  '      builtinToolDeny:',
  '        - write',
  '      skills:',
  '        kind: allow',
  '        items: []',
  '      mcp:',
  '        kind: deny',
  '  - templateId: tpl-b',
  '    persona: "You are member B of the a6a alpha.1 team."',
  '    capabilities:',
  '      teamTools:',
  '        kind: deny',
  '      builtinToolDeny: []',
  '      skills:',
  '        kind: deny',
  '      mcp:',
  '        kind: deny',
  'requirements: []',
  'memberEnvelopes: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

// ── the durable member rows (the backend truth both phases resolve) ────────
const memberRowA = { childSessionId: CHILD_A, instanceId: INST_A, templateId: 'tpl-a' }
const memberRowB = { childSessionId: CHILD_B, instanceId: INST_B, templateId: 'tpl-b' }

// ── the minimal team-tool catalog (the selector filters by name) ───────────
const toolCatalog = {
  tools: [
    { name: 'team_delegate' },
    { name: 'team_send_message' },
    { name: 'team_list_members' },
  ],
}

// ── the spy control service (the A4 surface the adapter consumes) ──────────
interface SpyRequestArgs {
  rootSessionId: string
  caller: { kind: string; instanceId: string }
  kind: string
  targetInstanceId: string
  actionName: string
  toolName?: string
  correlation: string
  operationFingerprint?: string
  summary?: string
}
interface SpyGuardScope {
  rootSessionId: string
  targetInstanceId: string
  actionName: string
  toolName?: string
  correlation: string
  operationFingerprint?: string
}
interface SpyControlService {
  readonly requests: SpyRequestArgs[]
  readonly waits: Array<{ rootSessionId: string; requestId: string }>
  readonly guards: SpyGuardScope[]
  readonly checks: Array<{ capabilityDomain?: string; toolName?: string }>
  nextDecision: { decision: 'allow' | 'deny'; reason?: string }
  nextGuard: { allowed: boolean; reason?: string }
  /** A2C-4: the shared read-only external hard check the static-allow
   *  path runs before the authorized-execution mark. The default is
   *  ALLOWED — the live-bridge host's external policy is the absent-cell
   *  "no host restriction" facts, so the production service would return
   *  `{ allowed: true }` for every operation in this world. */
  nextCheck: { allowed: boolean; reason?: string }
  requestControl(args: SpyRequestArgs): Promise<{ requestId: string; kind: string }>
  awaitControlDecision(input: {
    rootSessionId: string
    requestId: string
  }): Promise<{ requestId: string; decision: 'allow' | 'deny'; decisionSequence: number }>
  guardOperation(scope: SpyGuardScope): Promise<{
    allowed: boolean
    reason?: string
    requestId: string
    decisionSequence: number
  }>
  checkExternalOperation(input: { capabilityDomain?: string; toolName?: string }): Promise<{
    allowed: boolean
    reason?: string
  }>
  /** The durable request id the spy created for one correlation (the
   *  requestControl RETURN value — not part of the request args). */
  requestIdFor(correlation: string): string | undefined
}
function makeSpyControlService(): SpyControlService {
  let seq = 0
  const requestIdsByCorrelation = new Map<string, string>()
  const service: SpyControlService = {
    requests: [],
    waits: [],
    guards: [],
    checks: [],
    nextDecision: { decision: 'allow' },
    nextGuard: { allowed: true },
    nextCheck: { allowed: true },
    async requestControl(args) {
      service.requests.push(args)
      seq += 1
      const requestId = `a6a-req-${seq}`
      requestIdsByCorrelation.set(args.correlation, requestId)
      return { requestId, kind: args.kind }
    },
    async awaitControlDecision(input) {
      service.waits.push({ rootSessionId: input.rootSessionId, requestId: input.requestId })
      return { requestId: input.requestId, decision: service.nextDecision.decision, decisionSequence: 1 }
    },
    async guardOperation(scope) {
      service.guards.push({ ...scope })
      return { allowed: service.nextGuard.allowed, requestId: `a6a-req-${seq}`, decisionSequence: 1 }
    },
    async checkExternalOperation(input) {
      service.checks.push({ ...input })
      return {
        allowed: service.nextCheck.allowed,
        ...(service.nextCheck.reason !== undefined ? { reason: service.nextCheck.reason } : {}),
      }
    },
    requestIdFor(correlation) {
      return requestIdsByCorrelation.get(correlation)
    },
  }
  return service
}

// ── assertion helpers (the ctx doubles are separate scopes per agent) ──────
function activePreExecute(ctx: AgentCtxDouble): number {
  return ctx.listeners.filter((l) => l.event === 'tools/pre-execute' && l.active).length
}
function totalPreExecute(ctx: AgentCtxDouble): number {
  return ctx.listeners.filter((l) => l.event === 'tools/pre-execute').length
}
/** H1 (alpha.2 hardening, P0): the ACTIVE end-cap guards on one ctx
 *  (the `tools.guard` registrations the install makes alongside the
 *  waterfall listener — the composite disposer removes both on close). */
function activeEndCapGuards(ctx: AgentCtxDouble): number {
  return ctx.toolGuards.filter((g) => g.active).length
}
function toolNames(ctx: AgentCtxDouble): string[] {
  return ctx.registeredTools.map((def) => String((def as { name?: string }).name ?? ''))
}
function denyLists(ctx: AgentCtxDouble): string[][] {
  return ctx.toolRestrictions.map((r) => [...r.deny])
}

/** The allow decision the driven `next` continuation returns. */
const NEXT_ALLOW = { kind: 'allow' } as const

interface DriveOutcome {
  decision: { kind: string; reason?: string }
  nextCalls: number
}
/**
 * Drive the REGISTERED listener of one agent ctx with one pre-execute
 * payload (the same payload shape the upstream pipeline dispatches —
 * `exec.agent` is absent on the bridge double by design; the A5 adapter
 * never reads it, FACT 3b). Returns the decision + the next-call count.
 */
async function drivePreExecute(
  ctx: AgentCtxDouble,
  callId: string,
  name: string,
  args: unknown,
): Promise<DriveOutcome> {
  const entry = ctx.listeners.find((l) => l.event === 'tools/pre-execute' && l.active)
  if (entry === undefined) {
    throw new Error('drivePreExecute: no active tools/pre-execute listener on the ctx')
  }
  let nextCalls = 0
  const decision = (await entry.listener(
    { callId, name, arguments: args, signal: new AbortController().signal },
    async () => {
      nextCalls += 1
      return NEXT_ALLOW
    },
  )) as { kind: string; reason?: string }
  return { decision, nextCalls }
}

/** Parse the `alpha2-perm:` observation rows into their structured form. */
function permObservations(observations: readonly string[]): Array<Record<string, unknown>> {
  return observations
    .filter((row) => row.startsWith('alpha2-perm: '))
    .map((row) => JSON.parse(row.slice('alpha2-perm: '.length)) as Record<string, unknown>)
}

// ══════════════════════════════════════════════════════════════════════════
// WORLD 1 — the CREATE phase: permissions present, the control-service ref
// filled at construction (the production host shape).
// ══════════════════════════════════════════════════════════════════════════
const spy1 = makeSpyControlService()
const world1 = await createLiveWorld({
  rootSessionId: ROOT,
  teamTools: toolCatalog,
  agentPresets: createAgentPresetsDouble(),
  controlServiceRef: { current: spy1 },
  members: [memberRowA, memberRowB],
  configOverrides: {
    bootPhase: 'create',
    blueprintSource: PERMISSION_BLUEPRINT,
    seedMembers: [
      { instanceId: INST_A, templateId: 'tpl-a', label: 'Member A', childSessionId: CHILD_A },
      { instanceId: INST_B, templateId: 'tpl-b', label: 'Member B', childSessionId: CHILD_B },
    ],
  },
})
await world1.binding.boot()
const w1Leader = world1.agents.handles.get(ROOT)!.agent.ctx
const w1A = world1.agents.handles.get(CHILD_A)!.agent.ctx
const w1B = world1.agents.handles.get(CHILD_B)!.agent.ctx
// Capture the pre-close state (close() drains the disposers below).
const w1LeaderActive = activePreExecute(w1Leader)
const w1AActive = activePreExecute(w1A)
const w1BActive = activePreExecute(w1B)
const w1LeaderTotal = totalPreExecute(w1Leader)
const w1ATotal = totalPreExecute(w1A)
const w1BTotal = totalPreExecute(w1B)
// H1: the end-cap guard registrations (one per permission install,
// alongside the listener; member B — no policy — gets neither).
const w1LeaderGuards = activeEndCapGuards(w1Leader)
const w1AGuards = activeEndCapGuards(w1A)
const w1BGuards = activeEndCapGuards(w1B)
await world1.binding.close()
const w1LeaderActiveAfterClose = activePreExecute(w1Leader)
const w1AActiveAfterClose = activePreExecute(w1A)
const w1BActiveAfterClose = activePreExecute(w1B)
// H1: the composite disposer removed BOTH (listener first, guard last).
const w1LeaderGuardsAfterClose = activeEndCapGuards(w1Leader)
const w1AGuardsAfterClose = activeEndCapGuards(w1A)
const w1BGuardsAfterClose = activeEndCapGuards(w1B)

// ══════════════════════════════════════════════════════════════════════════
// WORLD 2 — the ALPHA.1 regression: capabilities present on all three
// templates, `permissions` ABSENT, NO controlServiceRef passed at all.
// ══════════════════════════════════════════════════════════════════════════
const world2 = await createLiveWorld({
  rootSessionId: 'session-a6a-alpha1-root',
  teamTools: toolCatalog,
  agentPresets: createAgentPresetsDouble(),
  members: [memberRowA, memberRowB],
  configOverrides: {
    bootPhase: 'create',
    blueprintSource: ALPHA1_BLUEPRINT,
    seedMembers: [
      { instanceId: INST_A, templateId: 'tpl-a', label: 'Member A', childSessionId: CHILD_A },
      { instanceId: INST_B, templateId: 'tpl-b', label: 'Member B', childSessionId: CHILD_B },
    ],
  },
})
await world2.binding.boot()
const w2Root = 'session-a6a-alpha1-root'
const w2Leader = world2.agents.handles.get(w2Root)!.agent.ctx
const w2A = world2.agents.handles.get(CHILD_A)!.agent.ctx
const w2B = world2.agents.handles.get(CHILD_B)!.agent.ctx
const w2LeaderListeners = activePreExecute(w2Leader)
const w2AListeners = activePreExecute(w2A)
const w2BListeners = activePreExecute(w2B)
// H3 (alpha.2 hardening closure, plan §16 leg): the alpha.1 regression is
// a ZERO-INSTALL decision — no `capabilities.permissions` means no
// waterfall listener AND no end-cap guard (the guard is installed only
// alongside its listener, never on its own).
const w2LeaderGuards = activeEndCapGuards(w2Leader)
const w2AGuards = activeEndCapGuards(w2A)
const w2BGuards = activeEndCapGuards(w2B)
const w2LeaderTools = toolNames(w2Leader)
const w2ATools = toolNames(w2A)
const w2ADeny = denyLists(w2A)
const w2BTools = toolNames(w2B)
await world2.binding.close()

// ══════════════════════════════════════════════════════════════════════════
// WORLD 3 — the COLD-RESUME phase: the restart re-derives from the durable
// rows and RE-INSTALLS the listeners on the FRESH agent ctxs.
// ══════════════════════════════════════════════════════════════════════════
const world3 = await createLiveWorld({
  rootSessionId: ROOT,
  teamTools: toolCatalog,
  agentPresets: createAgentPresetsDouble(),
  controlServiceRef: { current: makeSpyControlService() },
  members: [memberRowA, memberRowB],
  configOverrides: {
    bootPhase: 'resume',
    blueprintSource: PERMISSION_BLUEPRINT,
  },
})
const resumeHome = `${WORKTREE_ROOT}/.tmp-a6a-resume-home`
await withDshHome(resumeHome, async () => {
  writeDurableFixture(resumeHome, ROOT)
  writeDurableFixture(resumeHome, CHILD_A)
  writeDurableFixture(resumeHome, CHILD_B)
  await world3.binding.boot()
})
removeFixtureHome(resumeHome)
const w3Leader = world3.agents.handles.get(ROOT)!.agent.ctx
const w3A = world3.agents.handles.get(CHILD_A)!.agent.ctx
const w3B = world3.agents.handles.get(CHILD_B)!.agent.ctx
const w3LeaderActive = activePreExecute(w3Leader)
const w3AActive = activePreExecute(w3A)
const w3BActive = activePreExecute(w3B)
const w3LeaderIsFreshCtx = w3Leader !== w1Leader
const w3AIsFreshCtx = w3A !== w1A
// H3 (alpha.2 hardening closure, plan §16 leg): the cold-resume re-install
// re-derives the end-cap guards on the FRESH agent ctxs (leader=1,
// member A=1; member B — no policy — gets neither). These guards on the
// fresh ctxs are what enforce the §21 criterion AFTER a restart: the
// hostile force-allow is dead on arrival because the fresh ctx's guard
// has never seen a final-allow mark.
const w3LeaderGuards = activeEndCapGuards(w3Leader)
const w3AGuards = activeEndCapGuards(w3A)
const w3BGuards = activeEndCapGuards(w3B)
await world3.binding.close()

// ══════════════════════════════════════════════════════════════════════════
// WORLD 4 — the DRIVEN world: the registered listener is driven with real
// pre-execute payloads over the spy control service + the fake fs seam.
// ══════════════════════════════════════════════════════════════════════════
const spy4 = makeSpyControlService()
const world4 = await createLiveWorld({
  rootSessionId: ROOT,
  teamTools: toolCatalog,
  agentPresets: createAgentPresetsDouble(),
  controlServiceRef: { current: spy4 },
  members: [memberRowA, memberRowB],
  configOverrides: {
    bootPhase: 'create',
    blueprintSource: PERMISSION_BLUEPRINT,
    seedMembers: [
      { instanceId: INST_A, templateId: 'tpl-a', label: 'Member A', childSessionId: CHILD_A },
      { instanceId: INST_B, templateId: 'tpl-b', label: 'Member B', childSessionId: CHILD_B },
    ],
  },
})
await world4.binding.boot()
const leader4 = world4.agents.handles.get(ROOT)!.agent
const member4 = world4.agents.handles.get(CHILD_A)!.agent
const leaderCtx = leader4.ctx
const memberCtx = member4.ctx

// ── the leader legs ────────────────────────────────────────────────────────
// L1: static ALLOW (the read exact rule matches the same absolute path).
const l1 = await drivePreExecute(leaderCtx, 'a6a-l1', 'read', { file_path: '/data/notes.md' })
const l1Requests = spy4.requests.length
// L2: static ASK (the write exact rule) — the full request → wait → guard
// path with the LEADER routing (user-approval).
const l2 = await drivePreExecute(
  leaderCtx,
  'a6a-l2',
  'write',
  { file_path: '/data/notes.md', content: 'leader write' },
)
// L3: static DENY (the lsp any rule) — no control row, no next.
const l3 = await drivePreExecute(
  leaderCtx,
  'a6a-l3',
  'lsp',
  { file_path: '/data/notes.md', operation: 'hover', line: 1, character: 1 },
)
// L4: UNSUPPORTED tool (team_delegate) — pass-through, zero interference.
const l4 = await drivePreExecute(leaderCtx, 'a6a-l4', 'team_delegate', { to: INST_A, prompt: 'hi' })

// ── the member A legs ──────────────────────────────────────────────────────
// M1: static ALLOW (the read any rule) — the RELATIVE path resolves against
// the session cwd (the bridge default workspace at this point).
const m1 = await drivePreExecute(memberCtx, 'a6a-m1', 'read', { file_path: 'notes.md' })
// M2: static ASK (the write any rule) — the MEMBER routing
// (leader-approval) with the durable member identity.
const m2 = await drivePreExecute(memberCtx, 'a6a-m2', 'write', { file_path: 'other.md', content: 'member write' })
// M3: static DENY (the bash any rule) — tool-level, no fs call.
const m3 = await drivePreExecute(memberCtx, 'a6a-m3', 'bash', { command: 'ls' })

// ── the LAZY cwd leg (FACT 3b): the header is rewritten BETWEEN drives and ─
// ── the resolver's recorded cwd tracks it (never captured at install). ─────
member4.session.header.cwd = '/a6a/ws-1'
const lazy1 = await drivePreExecute(memberCtx, 'a6a-lazy1', 'read', { file_path: 'rel.md' })
member4.session.header.cwd = '/a6a/ws-2'
const lazy2 = await drivePreExecute(memberCtx, 'a6a-lazy2', 'read', { file_path: 'rel.md' })
void lazy1
void lazy2

const w4FsCalls = [...memberCtx.fs.calls]
const w4LeaderFsCalls = [...leaderCtx.fs.calls]
const w4Observations = [...world4.binding.observations]
const w4SpyRequests = [...spy4.requests]
const w4SpyWaits = [...spy4.waits]
const w4SpyGuards = [...spy4.guards]
await world4.binding.close()

// ══════════════════════════════════════════════════════════════════════════
// WORLD 5 — the LAZY ref read: the ref is filled AFTER construction (the
// world is already built) but BEFORE boot — the glue must still see it.
// ══════════════════════════════════════════════════════════════════════════
const ref5 = { current: undefined as unknown }
const world5 = await createLiveWorld({
  rootSessionId: ROOT,
  teamTools: toolCatalog,
  agentPresets: createAgentPresetsDouble(),
  controlServiceRef: ref5,
  members: [memberRowA, memberRowB],
  configOverrides: {
    bootPhase: 'create',
    blueprintSource: PERMISSION_BLUEPRINT,
    seedMembers: [
      { instanceId: INST_A, templateId: 'tpl-a', label: 'Member A', childSessionId: CHILD_A },
      { instanceId: INST_B, templateId: 'tpl-b', label: 'Member B', childSessionId: CHILD_B },
    ],
  },
})
const w5RefSameObject = world5.controlServiceRef === ref5
const w5RefUnfilledAtConstruction = ref5.current === undefined
// The production ordering: the root fills the ref during construction; the
// entry boots after. Here the fill is deliberately deferred past the world
// construction to prove the glue reads the ref at SETUP time.
ref5.current = makeSpyControlService()
await world5.binding.boot()
const w5Leader = world5.agents.handles.get(ROOT)!.agent.ctx
const w5A = world5.agents.handles.get(CHILD_A)!.agent.ctx
const w5B = world5.agents.handles.get(CHILD_B)!.agent.ctx
const w5LeaderActive = activePreExecute(w5Leader)
const w5AActive = activePreExecute(w5A)
const w5BActive = activePreExecute(w5B)
await world5.binding.close()

// ══════════════════════════════════════════════════════════════════════════
// WORLD 6 — FAIL CLOSED: permissions present, the ref NEVER filled. The
// boot must reject with the typed alpha2-permission-control-unavailable
// error (the setup rejection rolls the unpublished agent back).
// ══════════════════════════════════════════════════════════════════════════
const ref6 = { current: undefined as unknown }
const world6 = await createLiveWorld({
  rootSessionId: ROOT,
  teamTools: toolCatalog,
  agentPresets: createAgentPresetsDouble(),
  controlServiceRef: ref6,
  members: [memberRowA, memberRowB],
  configOverrides: {
    bootPhase: 'create',
    blueprintSource: PERMISSION_BLUEPRINT,
    seedMembers: [
      { instanceId: INST_A, templateId: 'tpl-a', label: 'Member A', childSessionId: CHILD_A },
      { instanceId: INST_B, templateId: 'tpl-b', label: 'Member B', childSessionId: CHILD_B },
    ],
  },
})
let failClosedError: unknown
try {
  await world6.binding.boot()
} catch (error) {
  failClosedError = error
}
const failClosedCode =
  failClosedError instanceof Error && typeof (failClosedError as { code?: unknown }).code === 'string'
    ? String((failClosedError as unknown as { code: string }).code)
    : undefined
const failClosedMessage =
  failClosedError instanceof Error ? (failClosedError as Error).message : String(failClosedError)
const w6Creates = [...world6.agents.creates]
const w6Observations = [...world6.binding.observations]
await world6.binding.close()

// ══════════════════════════════════════════════════════════════════════════
// WORLD 7 — FAIL CLOSED (V1-1, resolve time): the fs seam is UNUSABLE at
// RESOLVE time (the host accessor's failure mode — the `fs` public service
// absent, the accessor throwing the typed service-missing error). Every
// file-tool decision must deny at canonicalization: typed, never a
// pass-through, zero-effect (next never awaited, no control row created).
// An unsupported tool still passes through (classification precedes
// canonicalization).
// ══════════════════════════════════════════════════════════════════════════
const spy7 = makeSpyControlService()
const world7 = await createLiveWorld({
  rootSessionId: ROOT,
  teamTools: toolCatalog,
  agentPresets: createAgentPresetsDouble(),
  controlServiceRef: { current: spy7 },
  fsBackend: () => {
    const error = new Error(
      'the "fs" public service is absent (or lacks resolve) — it is resolved lazily per call and must be up before parameter-permission canonicalization resolves a file target (fail-closed: a typed canonicalization denial, never a pass-through)',
    )
    ;(error as { code?: string }).code = 'team-plugin-service-missing'
    throw error
  },
  members: [memberRowA, memberRowB],
  configOverrides: {
    bootPhase: 'create',
    blueprintSource: PERMISSION_BLUEPRINT,
    seedMembers: [
      { instanceId: INST_A, templateId: 'tpl-a', label: 'Member A', childSessionId: CHILD_A },
      { instanceId: INST_B, templateId: 'tpl-b', label: 'Member B', childSessionId: CHILD_B },
    ],
  },
})
await world7.binding.boot()
const w7Leader = world7.agents.handles.get(ROOT)!.agent.ctx
const w7A = world7.agents.handles.get(CHILD_A)!.agent.ctx
const w7LeaderActive = activePreExecute(w7Leader)
const w7AActive = activePreExecute(w7A)
// F1: a LEADER file operation (read, the exact-allow path) — even the
// allow lane dies at canonicalization (deny, zero next, zero control rows).
const f1 = await drivePreExecute(w7Leader, 'a6a-f1', 'read', { file_path: '/data/notes.md' })
// F2: a MEMBER file operation (write, relative path) — same typed denial.
const f2 = await drivePreExecute(w7A, 'a6a-f2', 'write', { file_path: 'other.md', content: 'x' })
// F3: an UNSUPPORTED tool (team_delegate) still passes through — the
// classification step precedes canonicalization (zero interference).
const f3 = await drivePreExecute(w7Leader, 'a6a-f3', 'team_delegate', { to: INST_A, prompt: 'hi' })
const w7SpyRequests = [...spy7.requests]
const w7Observations = [...world7.binding.observations]
await world7.binding.close()

// ══════════════════════════════════════════════════════════════════════════
// WORLD 8 — FAIL CLOSED (V1-1, install time): the fsBackend dep ABSENT
// from the glue deps (the bridge omits it) on a permissions-carrying
// template → the setup rejects with the typed
// alpha2-permission-fs-unavailable error (the control-unavailable twin:
// a permissions agent never runs unguarded).
// ══════════════════════════════════════════════════════════════════════════
const ref8 = { current: makeSpyControlService() as unknown }
const world8 = await createLiveWorld({
  rootSessionId: ROOT,
  teamTools: toolCatalog,
  agentPresets: createAgentPresetsDouble(),
  controlServiceRef: ref8,
  fsBackend: null,
  members: [memberRowA, memberRowB],
  configOverrides: {
    bootPhase: 'create',
    blueprintSource: PERMISSION_BLUEPRINT,
    seedMembers: [
      { instanceId: INST_A, templateId: 'tpl-a', label: 'Member A', childSessionId: CHILD_A },
      { instanceId: INST_B, templateId: 'tpl-b', label: 'Member B', childSessionId: CHILD_B },
    ],
  },
})
let fsMissingError: unknown
try {
  await world8.binding.boot()
} catch (error) {
  fsMissingError = error
}
const fsMissingCode =
  fsMissingError instanceof Error && typeof (fsMissingError as { code?: unknown }).code === 'string'
    ? String((fsMissingError as unknown as { code: string }).code)
    : undefined
const fsMissingMessage = fsMissingError instanceof Error ? (fsMissingError as Error).message : String(fsMissingError)
const w8Creates = [...world8.agents.creates]
const w8Observations = [...world8.binding.observations]
await world8.binding.close()

// ══════════════════════════════════════════════════════════════════════════
// The assertions (synchronous `it` bodies over the captured state — the
// plain-node shim constraint).
// ══════════════════════════════════════════════════════════════════════════

describe('A6 alpha.2 production wiring — the install decision (plan §11.1)', () => {
  it('create phase: the leader (permissions present) gets EXACTLY ONE active tools/pre-execute listener', () => {
    expect(w1LeaderActive).toBe(1)
    expect(w1LeaderTotal).toBe(1)
  })
  it('create phase: member A (permissions present) gets EXACTLY ONE active listener', () => {
    expect(w1AActive).toBe(1)
    expect(w1ATotal).toBe(1)
  })
  it('create phase: member B (permissions ABSENT) gets ZERO listeners (per-agent scoping)', () => {
    expect(w1BActive).toBe(0)
    expect(w1BTotal).toBe(0)
  })
  it('H1: the leader AND member A each register EXACTLY ONE active end-cap guard (the install requires the tools.guard seam)', () => {
    expect(w1LeaderGuards).toBe(1)
    expect(w1AGuards).toBe(1)
  })
  it('H1: member B (permissions ABSENT) registers ZERO end-cap guards (no policy → no install at all)', () => {
    expect(w1BGuards).toBe(0)
  })
  it('alpha.1 world: capabilities present, permissions absent, no ref — ZERO listeners on all three agents', () => {
    expect(w2LeaderListeners).toBe(0)
    expect(w2AListeners).toBe(0)
    expect(w2BListeners).toBe(0)
  })
  it('H3 §16: the alpha.1 zero-install world has ZERO end-cap guards too (the guard ships only alongside its listener — no orphan monotonic guards on a no-policy install)', () => {
    expect(w2LeaderGuards).toBe(0)
    expect(w2AGuards).toBe(0)
    expect(w2BGuards).toBe(0)
  })
  it('alpha.1 world: the leader capability wiring is UNCHANGED (team-tools selection intact)', () => {
    expect(w2LeaderTools).toEqual(['team_send_message', 'team_list_members'])
  })
  it('alpha.1 world: member A capability wiring is UNCHANGED (selection + builtin deny)', () => {
    expect(w2ATools).toEqual(['team_delegate'])
    expect(w2ADeny).toEqual([['write']])
  })
  it('alpha.1 world: member B capability wiring is UNCHANGED (teamTools deny = zero team tools)', () => {
    expect(w2BTools).toEqual([])
  })
  it('cold resume: the listeners are RE-INSTALLED on the FRESH agent ctxs (leader + member A)', () => {
    expect(w3LeaderActive).toBe(1)
    expect(w3AActive).toBe(1)
  })
  it('cold resume: member B (no policy) still gets ZERO listeners', () => {
    expect(w3BActive).toBe(0)
  })
  it('H3 §16: the cold-resume re-install re-derives the end-cap guards on the FRESH ctxs (leader=1, member A=1, member B=0 — the §21 decider survives the restart)', () => {
    expect(w3LeaderGuards).toBe(1)
    expect(w3AGuards).toBe(1)
    expect(w3BGuards).toBe(0)
  })
  it('cold resume: the resume ctxs are FRESH doubles (not the create-phase ctxs)', () => {
    expect(w3LeaderIsFreshCtx).toBe(true)
    expect(w3AIsFreshCtx).toBe(true)
  })
  it('close(): the leader listener is DRAINED (disposer run, active=false)', () => {
    expect(w1LeaderActiveAfterClose).toBe(0)
    expect(w1LeaderTotal).toBe(1)
  })
  it('close(): the member A listener is DRAINED', () => {
    expect(w1AActiveAfterClose).toBe(0)
    expect(w1ATotal).toBe(1)
  })
  it('H1: close() DRAINS the end-cap guards too (the composite disposer removed listener first, guard last)', () => {
    expect(w1LeaderGuardsAfterClose).toBe(0)
    expect(w1AGuardsAfterClose).toBe(0)
    expect(w1BGuardsAfterClose).toBe(0)
  })
  it('close(): member B is untouched (it never had a listener)', () => {
    expect(w1BActiveAfterClose).toBe(0)
    expect(w1BTotal).toBe(0)
  })
})

describe('A6 alpha.2 production wiring — the frozen A5 pipeline through the production install', () => {
  it('leader static allow (read exact rule): next called ONCE, the next decision passes through, zero control rows', () => {
    expect(l1.decision.kind).toBe('allow')
    expect(l1.nextCalls).toBe(1)
    expect(l1Requests).toBe(0)
  })
  it('leader ask: requestControl routed to user-approval (isLeader=true → CONTROL_REQUEST_KINDS.USER_APPROVAL)', () => {
    const ask = w4SpyRequests.find((r) => r.correlation === 'a6a-l2')
    expect(ask !== undefined).toBe(true)
    expect(ask!.kind).toBe('user-approval')
  })
  it('leader ask: the request scope carries the team root + the LEADER identity (inst-leader for caller AND target)', () => {
    const ask = w4SpyRequests.find((r) => r.correlation === 'a6a-l2')!
    expect(ask.rootSessionId).toBe(ROOT)
    expect(ask.caller).toEqual({ kind: 'instance', instanceId: LEADER_INST })
    expect(ask.targetInstanceId).toBe(LEADER_INST)
  })
  it('leader ask: the request action scope (actionName / toolName / correlation / fingerprint shape)', () => {
    const ask = w4SpyRequests.find((r) => r.correlation === 'a6a-l2')!
    expect(ask.actionName).toBe('parameter-permission')
    expect(ask.toolName).toBe('write')
    expect(ask.correlation).toBe('a6a-l2')
    expect(typeof ask.operationFingerprint === 'string' && ask.operationFingerprint.startsWith('sha256:')).toBe(true)
  })
  it('leader ask: awaitControlDecision waited on the EXACT request the adapter created', () => {
    const askRequestId = spy4.requestIdFor('a6a-l2')
    expect(typeof askRequestId === 'string' && askRequestId.length > 0).toBe(true)
    const wait = w4SpyWaits.find((w) => w.requestId === askRequestId)
    expect(wait !== undefined).toBe(true)
    expect(wait!.rootSessionId).toBe(ROOT)
  })
  it('leader ask: guardOperation guarded the EXACT scope (same fingerprint, same identity, same root)', () => {
    const ask = w4SpyRequests.find((r) => r.correlation === 'a6a-l2')!
    const guard = w4SpyGuards.find((g) => g.correlation === 'a6a-l2')
    expect(guard !== undefined).toBe(true)
    expect(guard!.rootSessionId).toBe(ROOT)
    expect(guard!.targetInstanceId).toBe(LEADER_INST)
    expect(guard!.actionName).toBe('parameter-permission')
    expect(guard!.toolName).toBe('write')
    expect(guard!.operationFingerprint).toBe(ask.operationFingerprint)
  })
  it('leader ask: the durable allow → next called ONCE and its decision passes through', () => {
    expect(l2.decision.kind).toBe('allow')
    expect(l2.nextCalls).toBe(1)
  })
  it('leader static deny (lsp any rule): denied BEFORE next (zero next calls, zero control rows)', () => {
    expect(l3.decision.kind).toBe('deny')
    expect(l3.nextCalls).toBe(0)
    expect(w4SpyRequests.filter((r) => r.correlation === 'a6a-l3').length).toBe(0)
  })
  it('leader unsupported tool (team_delegate): pass-through — next ONCE, zero control rows', () => {
    expect(l4.decision.kind).toBe('allow')
    expect(l4.nextCalls).toBe(1)
    expect(w4SpyRequests.filter((r) => r.correlation === 'a6a-l4').length).toBe(0)
  })
  it('member ask: requestControl routed to leader-approval with the DURABLE member identity (caller AND target)', () => {
    const ask = w4SpyRequests.find((r) => r.correlation === 'a6a-m2')
    expect(ask !== undefined).toBe(true)
    expect(ask!.kind).toBe('leader-approval')
    expect(ask!.rootSessionId).toBe(ROOT)
    expect(ask!.caller).toEqual({ kind: 'instance', instanceId: INST_A })
    expect(ask!.targetInstanceId).toBe(INST_A)
    expect(ask!.actionName).toBe('parameter-permission')
    expect(ask!.toolName).toBe('write')
  })
  it('member ask: wait + guard on the exact scope, then the durable allow → next ONCE', () => {
    const ask = w4SpyRequests.find((r) => r.correlation === 'a6a-m2')!
    const m2RequestId = spy4.requestIdFor('a6a-m2')
    expect(typeof m2RequestId === 'string' && m2RequestId.length > 0).toBe(true)
    expect(w4SpyWaits.some((w) => w.requestId === m2RequestId && w.rootSessionId === ROOT)).toBe(true)
    expect(
      w4SpyGuards.some(
        (g) =>
          g.correlation === 'a6a-m2' &&
          g.targetInstanceId === INST_A &&
          g.operationFingerprint === ask.operationFingerprint,
      ),
    ).toBe(true)
    expect(m2.decision.kind).toBe('allow')
    expect(m2.nextCalls).toBe(1)
  })
  it('member static allow (read any rule, relative path): next ONCE, the session cwd threaded to the resolver', () => {
    expect(m1.decision.kind).toBe('allow')
    expect(m1.nextCalls).toBe(1)
    expect(w4FsCalls.some((c) => c.path === 'notes.md' && c.cwd === DEFAULT_WS)).toBe(true)
  })
  it('member static deny (bash any rule): denied, zero next, zero control rows', () => {
    expect(m3.decision.kind).toBe('deny')
    expect(m3.nextCalls).toBe(0)
    expect(w4SpyRequests.filter((r) => r.correlation === 'a6a-m3').length).toBe(0)
  })
  it('lazy cwd (FACT 3b): the resolver cwd tracks the LIVE header across drives (ws-1 then ws-2)', () => {
    expect(w4FsCalls.some((c) => c.path === 'rel.md' && c.cwd === '/a6a/ws-1')).toBe(true)
    expect(w4FsCalls.some((c) => c.path === 'rel.md' && c.cwd === '/a6a/ws-2')).toBe(true)
    const ws1 = w4FsCalls.find((c) => c.path === 'rel.md' && c.cwd === '/a6a/ws-1')
    const ws2 = w4FsCalls.find((c) => c.path === 'rel.md' && c.cwd === '/a6a/ws-2')
    expect(ws1 !== undefined && ws2 !== undefined).toBe(true)
    // the two drives canonicalized to DIFFERENT resource keys → different
    // fingerprints (the cwd is part of the resource identity, not a
    // cached-at-install constant).
    const rows = permObservations(w4Observations).filter((r) => r.stage === 'canonicalized')
    const fp1 = rows.filter((r) => r.callId === 'a6a-lazy1').map((r) => String(r.fingerprint))
    const fp2 = rows.filter((r) => r.callId === 'a6a-lazy2').map((r) => String(r.fingerprint))
    expect(fp1.length).toBe(1)
    expect(fp2.length).toBe(1)
    expect(fp1[0] === fp2[0]).toBe(false)
  })
  it('leader cwd: the absolute rule/operation paths resolve with the session cwd threaded (default workspace)', () => {
    expect(w4LeaderFsCalls.some((c) => c.path === '/data/notes.md' && c.cwd === DEFAULT_WS)).toBe(true)
  })
  it('onObserve: the diagnostics rows land on the binding observation surface (all five pipeline stages observed)', () => {
    const stages = new Set(permObservations(w4Observations).map((r) => String(r.stage)))
    for (const stage of ['canonicalized', 'decision', 'request-created', 'decision-arrived', 'guard-verdict']) {
      expect(stages.has(stage)).toBe(true)
    }
  })
  it('onObserve: the rows are SMALL structured records (JSON, a stage + a callId — no payloads)', () => {
    for (const row of permObservations(w4Observations)) {
      expect(typeof row.stage).toBe('string')
      expect(typeof row.callId).toBe('string')
    }
  })
})

describe('A6 alpha.2 production wiring — the control-service ref contract (the teamToolsRef pattern)', () => {
  it('the bridge returns the SAME ref object the caller passed (the shared ref identity)', () => {
    expect(w5RefSameObject).toBe(true)
  })
  it('the ref was unfilled at construction and the glue read it LAZILY: a fill after construction, before boot, installs', () => {
    expect(w5RefUnfilledAtConstruction).toBe(true)
    expect(w5LeaderActive).toBe(1)
    expect(w5AActive).toBe(1)
  })
  it('the lazy fill still scopes correctly: member B (no policy) gets zero listeners', () => {
    expect(w5BActive).toBe(0)
  })
  it('FAIL CLOSED: permissions present + ref never filled → boot rejects with the typed error', () => {
    expect(failClosedCode).toBe('alpha2-permission-control-unavailable')
  })
  it('FAIL CLOSED: the error names the session and the leader identity (diagnostic, not silent)', () => {
    expect(failClosedMessage.includes(ROOT)).toBe(true)
    expect(failClosedMessage.includes(LEADER_INST)).toBe(true)
  })
  it('FAIL CLOSED: the observation recorded the typed failure (never silent)', () => {
    expect(w6Observations.some((row) => row.includes('alpha2-perm: permission-control-unavailable'))).toBe(true)
  })
  it('FAIL CLOSED: the boot stopped at the root setup — no member was created (setup rejection rolls the agent back)', () => {
    expect(w6Creates.length).toBe(1)
    expect(w6Creates[0]?.sessionId).toBe(ROOT)
  })
})

describe('A6 alpha.2 production wiring — the fs seam contract (V1-1 live-matrix fix)', () => {
  it('WORLD 7: the listeners are STILL INSTALLED when the fs service is absent (the seam is resolved lazily per call)', () => {
    expect(w7LeaderActive).toBe(1)
    expect(w7AActive).toBe(1)
  })
  it('F1: the leader file operation (the exact-allow path) denies at canonicalization — typed, not a pass-through', () => {
    expect(f1.decision.kind).toBe('deny')
    const reason = String(f1.decision.reason ?? '')
    expect(reason.includes('canonicalization failed for tool "read"')).toBe(true)
    expect(reason.includes('resolver-threw')).toBe(true)
    // the resolver's rejection (the service-missing failure mode) is
    // embedded verbatim by the A2 canonicalizer — the denial carries the
    // reason, it is not a bare pass-through allow.
    expect(reason.includes('the "fs" public service is absent')).toBe(true)
  })
  it('F1: zero-effect — next was NEVER awaited and NO control row was created', () => {
    expect(f1.nextCalls).toBe(0)
    expect(w7SpyRequests.length).toBe(0)
  })
  it('F2: the member file operation denies the SAME way (per-agent, not leader-only)', () => {
    expect(f2.decision.kind).toBe('deny')
    const reason = String(f2.decision.reason ?? '')
    expect(reason.includes('canonicalization failed for tool "write"')).toBe(true)
    expect(reason.includes('resolver-threw')).toBe(true)
    expect(f2.nextCalls).toBe(0)
  })
  it('F3: the unsupported tool still passes through (classification precedes canonicalization — zero interference)', () => {
    expect(f3.decision.kind).toBe('allow')
    expect(f3.nextCalls).toBe(1)
  })
  it('F1: the canonicalization-failure landed as a structured observation (never silent)', () => {
    const rows = permObservations(w7Observations).filter((row) => row.stage === 'canonicalization-failed')
    expect(rows.some((row) => row.callId === 'a6a-f1' && row.tool === 'read')).toBe(true)
  })
  it('WORLD 8: the fsBackend dep ABSENT on a permissions template → boot rejects with the typed error', () => {
    expect(fsMissingCode).toBe('alpha2-permission-fs-unavailable')
  })
  it('WORLD 8: the error names the session and the leader identity (diagnostic, not silent)', () => {
    expect(fsMissingMessage.includes(ROOT)).toBe(true)
    expect(fsMissingMessage.includes(LEADER_INST)).toBe(true)
  })
  it('WORLD 8: the observation recorded the typed failure (never silent)', () => {
    expect(w8Observations.some((row) => row.includes('alpha2-perm: permission-fs-unavailable'))).toBe(true)
  })
  it('WORLD 8: the boot stopped at the root setup — no member was created (setup rejection rolls the agent back)', () => {
    expect(w8Creates.length).toBe(1)
    expect(w8Creates[0]?.sessionId).toBe(ROOT)
  })
})
