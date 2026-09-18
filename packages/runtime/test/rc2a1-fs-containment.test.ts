/**
 * rc2a1-fs-containment.test.ts — RC2-A1 (rc2-repair plan §13, A1-T1..T6):
 * the production fs containment contract of the rc.2 public seam
 * (`resolve` + `contains`, plan §14.1: a REQUIRED contract, never an
 * optional compatibility extension).
 *
 * Every world boots the REAL production host entry
 * (`hostEntry.apply` — packages/runtime/src/plugin/host.ts) with the REAL
 * production glue (the row loads the row's `glueUrl` default — the
 * agent-bindings.mjs next to this entry — through its own `import`), a
 * REAL bridge agents double (createAgentsDouble, the 0.1.5-style
 * `setup(agentCtx, agent)` contract), and a class-style fake upstream `fs`
 * service. The full canonicalization chain therefore runs exactly as in
 * production: host.ts `fsBackend` facade (the A1 bug site — the receiver
 * preservation) → glue `resolveTarget` / `containsTargets` → A2 adapter →
 * static decision.
 *
 * A1-T1 — the production facade preserves the receiver on BOTH seams
 *         (resolve AND contains — plan §13 T1; the pre-fix facade copied
 *         method references without their receiver, and the live smoke
 *         run 11-02-31 showed the production `this.processPath is not a
 *         function` failure on the contains side; the resolve side was
 *         the same latent class — upstream `LocalFileSystem.resolve`
 *         reads `this.config.cwd` when the caller omits `opts.cwd`).
 * A1-T2 — allow subtree: a static allow, no control request.
 * A1-T3 — deny subtree: a static deny (rule provenance).
 * A1-T4 — sibling trap: `team` is NOT a parent of `teambar` (contains
 *         false — a prefix-matching regression would have allowed it).
 * A1-T5 — relative/absolute equivalence under the same cwd: the same
 *         file spelled `team/a.md` (relative) and `/data/team/a.md`
 *         (absolute) canonicalizes to the SAME identity (fingerprint)
 *         and the SAME subtree decision.
 * A1-T6 — a resolve-only provider + a subtree permission is a TYPED
 *         SETUP FAILURE (`alpha2-permission-fs-containment-unavailable`)
 *         (plan §12: an agent never runs on a broken authority).
 *
 * World style: the module-level IIFE + synchronous `it` bodies of the
 * bound-blueprint-persona-root suite (flow-critical invariants throw at
 * module load — a failed world is a failed file, never a silent skip).
 */

import { describe, expect, it } from 'vitest'
import * as hostEntry from '../src/plugin/host.js'
import {
  FileStorageSeam,
  destroyDir,
  scratchDir,
} from '../../testkit/fault-injection/file-seam.mjs'
import {
  createAgentPresetsDouble,
  createAgentsDouble,
} from './t12a-live-bridge.mjs'

// --- fail-fast invariant (the bound-blueprint check pattern) -----------------

function check(condition: boolean, label: string): void {
  if (!condition) throw new Error(`RC2A1 invariant: ${label}`)
}

// --- A1-T1: the class-style fake fs (the receiver assertions) -----------------

/**
 * The plan §13 T1 fixture: a REAL class whose seams call an INSTANCE
 * method through `this` (the upstream fs-local `processPath` pattern).
 * Any receiver loss at the facade throws inside the seam call — the
 * EXACT production A1 signature (`this.processPath is not a function`) —
 * and the explicit `self` marker turns a silently-wrong receiver into a
 * loud typed failure.
 */
class ReceiverFakeFs {
  // eslint-disable-next-line @typescript-eslint/no-this-alias -- the receiver marker (A1-T1)
  private readonly self = this
  readonly resolveCalls: Array<{ path: string; cwd: string | undefined }> = []
  readonly containsCalls: Array<{ parent: string; child: string }> = []

  /** The upstream fs-local pattern: instance method over target keys. */
  processPath(target: unknown): string {
    const raw = typeof target === 'string' ? target : String((target as { targetKey?: unknown } | null)?.targetKey ?? '')
    return raw.startsWith('file://') ? raw.slice('file://'.length) : raw
  }

  /** The receiver assertion — a lost receiver NEVER reaches a seam body. */
  assertReceiver(): void {
    if (this === null || this === undefined || this.self !== this) {
      throw new Error('RC2A1-T1: the fs seam receiver was lost (this !== the provider instance)')
    }
  }

  async resolve(path: string, opts?: { cwd?: string }): Promise<{ targetKey: string; displayPath: string }> {
    this.assertReceiver()
    this.resolveCalls.push({
      path: String(path),
      cwd: opts?.cwd === undefined ? undefined : String(opts.cwd),
    })
    return this.targetOf(path, opts?.cwd)
  }

  contains(parent: unknown, child: unknown): boolean {
    this.assertReceiver()
    const pk = this.processPath(parent)
    const ck = this.processPath(child)
    this.containsCalls.push({ parent: pk, child: ck })
    // The upstream fs-local containment semantics over the canonical
    // keys: equal (the subtree root itself) or strictly below — no
    // `..` escape, no sibling prefix match.
    return ck === pk || ck.startsWith(`${pk}/`)
  }

  private targetOf(path: string, cwd: string | undefined): { targetKey: string; displayPath: string } {
    const p = String(path).replace(/\\/g, '/')
    const joined =
      p.startsWith('/')
        ? p
        : typeof cwd === 'string' && cwd !== ''
          ? `${cwd.replace(/\/+$/, '')}/${p}`
          : `/${p}`
    const out: string[] = []
    for (const s of joined.split('/')) {
      if (s === '' || s === '.') continue
      if (s === '..') out.pop()
      else out.push(s)
    }
    const key = `/${out.join('/')}`
    return { targetKey: `file://${key}`, displayPath: key }
  }
}

/**
 * The A1-T6 fixture: a RESOLVE-ONLY provider (the pre-A2C-7 / degraded
 * seam — the plan §12 "rc.2-only production fixture"). No `contains`.
 */
function resolveOnlyFs(): {
  resolveCalls: Array<{ path: string; cwd: string | undefined }>
  resolve: (path: string, opts?: { cwd?: string }) => Promise<{ targetKey: string; displayPath: string }>
} {
  const resolveCalls: Array<{ path: string; cwd: string | undefined }> = []
  return {
    resolveCalls,
    async resolve(path, opts = {}) {
      resolveCalls.push({
        path: String(path),
        cwd: opts.cwd === undefined ? undefined : String(opts.cwd),
      })
      const fs = new ReceiverFakeFs()
      return fs.resolve(path, { cwd: opts.cwd })
    },
  }
}

// --- the world boot (production host entry + production glue) ----------------

const WORLD_A_ROOT = 'session-rc2a1-a'
const WORLD_B_ROOT = 'session-rc2a1-b'
const A1_WORKSPACE = '/data'

/**
 * The shared blueprint (World A and World B): a subtree ALLOW (read
 * `/data/team`), a subtree DENY (read `/data/runtime`), default deny.
 * The session cwd is A1_WORKSPACE (the boot `meta.cwd` the agents double
 * materializes as the session header — the FACT 3b lazy-read basis), so
 * the relative spelling `team/a.md` canonicalizes into the allow subtree.
 */
const A1_BLUEPRINT = `---
schemaVersion: 1
blueprintId: rc2a1.bp
revision: "1"
leader:
  templateId: leader
  persona: "You are the leader of the rc2a1 containment team."
  capabilities:
    teamTools:
      kind: allow
      items: []
    builtinToolDeny: []
    skills:
      kind: allow
      items: []
    mcp:
      kind: allow
      items: []
    permissions:
      default: deny
      allow:
        - tool: read
          resource:
            kind: subtree
            path: /data/team
      ask: []
      deny:
        - tool: read
          resource:
            kind: subtree
            path: /data/runtime
members:
  - templateId: worker-a
    displayName: Worker A
    persona: "You are worker-a of the rc2a1 containment team."
requirements: []
memberEnvelopes: []
policyStates: []
metadata: {}
---
`

interface A1World {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test doubles), untyped by design
  readonly root: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the bridge agents double
  readonly agents: any
  readonly rootSessionId: string
}

async function bootWorld(
  label: string,
  rootSessionId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the upstream fs service (class instance or resolve-only object)
  fs: any,
): Promise<A1World> {
  const provided: Record<string, unknown> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the test Cordis context double (the p8s5a pattern)
  const ctx: any = {
    get: (name: string) => provided[name],
    provide: (name: string, value: unknown) => {
      provided[name] = value
    },
    effect: (factory: () => () => void, _label?: string) => {
      void factory()
    },
  }
  provided.agents = createAgentsDouble({ passExplicitAgent: true })
  provided.sessions = {
    flush: async (session: unknown) => session,
  }
  provided.agentPresets = createAgentPresetsDouble()
  provided.workspaceRegistry = {
    list: () => [],
    resolveByPath: async () => undefined,
  }
  provided.teamStorageSeam = new FileStorageSeam(scratchDir(`rc2a1-${label}`))
  provided.fs = fs
  await hostEntry.apply(
    ctx,
    {
      bootPhase: 'create',
      rootSessionId,
      blueprintSource: A1_BLUEPRINT,
      generation: 1,
      defaultWorkspace: A1_WORKSPACE,
      seedMembers: [],
      staticModel: { provider: 'rc2a1', model: 'rc2a1-model' },
      deniedSelection: null,
      mcpServer: null,
      environmentFacts: [],
      externalPolicyFacts: { hard: {}, capabilityExists: {} },
    },
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the root facade (dynamic surface)
  const root: any = await (provided.teamRoot as { ready: Promise<unknown> }).ready
  return { root, agents: provided.agents, rootSessionId }
}

// --- the pre-execute drive (the a6a payload shape) ----------------------------

interface DriveOutcome {
  readonly decision: { readonly kind: string; readonly reason?: string }
  readonly nextCalls: number
}

/**
 * Drive the REGISTERED `tools/pre-execute` listener of the world's leader
 * agent ctx with one payload (the same payload shape the upstream
 * pipeline dispatches — the a6a `drivePreExecute` contract).
 */
async function drivePreExecute(
  world: A1World,
  callId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<DriveOutcome> {
  const handle = world.agents.handles.get(world.rootSessionId)
  if (handle === undefined) {
    throw new Error(`drivePreExecute: no live agent for ${world.rootSessionId}`)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the bridge agent ctx double
  const agentCtx: any = handle.agent.ctx
  const entry = (agentCtx?.listeners ?? []).find(
    (l: { event?: string; active?: boolean }) => l.event === 'tools/pre-execute' && l.active === true,
  )
  if (entry === undefined) {
    throw new Error('drivePreExecute: no active tools/pre-execute listener on the leader ctx')
  }
  let nextCalls = 0
  const decision = (await entry.listener(
    { callId, name, arguments: args, signal: new AbortController().signal },
    async () => {
      nextCalls += 1
      return { kind: 'allow' as const }
    },
  )) as { kind: string; reason?: string }
  return { decision, nextCalls }
}

/** The `alpha2-perm:` observation rows of one world, structured. */
function permObservations(world: A1World): Array<Record<string, unknown>> {
  const rows: readonly string[] = world.root.live.observations
  return rows
    .filter((row) => typeof row === 'string' && row.startsWith('alpha2-perm: '))
    .map((row) => JSON.parse(row.slice('alpha2-perm: '.length)) as Record<string, unknown>)
}

/** The canonicalized rows for one callId (one per driven call). */
function canonicalizedOf(world: A1World, callId: string): Array<Record<string, unknown>> {
  return permObservations(world).filter(
    (row) => row['stage'] === 'canonicalized' && row['callId'] === callId,
  )
}

/** The decision rows for one callId. */
function decisionOf(world: A1World, callId: string): Array<Record<string, unknown>> {
  return permObservations(world).filter(
    (row) => row['stage'] === 'decision' && row['callId'] === callId,
  )
}

/**
 * A1-T1: the receiver-loss fingerprint — the rows the A2 adapter writes
 * when a seam call throws (the pre-fix production signature, run
 * 11-02-31: `containment-undeterminable` → the fail-closed canonicalization
 * denial that blocked even the allow lane).
 */
function hasCanonicalizationFailure(world: A1World): boolean {
  return permObservations(world).some(
    (row) =>
      row['stage'] === 'canonicalization-failed' ||
      row['stage'] === 'containment-undeterminable' ||
      (typeof row['reason'] === 'string' && row['reason'].includes('canonicaliz')),
  )
}

// ══════════════════════════════════════════════════════════════════════════
// WORLD A — the full seam (class-style fake, both seams): A1-T1..T5
// ══════════════════════════════════════════════════════════════════════════

interface WorldAState {
  readonly fs: ReceiverFakeFs
  readonly t1: {
    readonly decision: string
    readonly nextCalls: number
    readonly resolveCalls: number
    readonly containsCalls: number
    readonly canonicalizationFailure: boolean
  }
  readonly t2: {
    readonly decision: string
    readonly nextCalls: number
    readonly controlRequests: number
  }
  readonly t3: {
    readonly decision: string
    readonly provenance: string
    readonly lane: string
    readonly nextCalls: number
  }
  readonly t4: {
    readonly decision: string
    readonly nextCalls: number
    readonly siblingContains: Array<{ parent: string; child: string }>
  }
  readonly t5: {
    readonly relDecision: string
    readonly absDecision: string
    readonly relFingerprint: string
    readonly absFingerprint: string
    readonly relDisplay: string
    readonly absDisplay: string
  }
}

const worldA: WorldAState = await (async (): Promise<WorldAState> => {
  destroyDir(scratchDir('rc2a1-a'))
  const fs = new ReceiverFakeFs()
  const world = await bootWorld('a', WORLD_A_ROOT, fs)

  // A1-T1 + A1-T2 — the relative allow-subtree read (both seams engaged:
  // the operation target + the two rule roots resolve; the subtree rules
  // contain). A lost receiver on EITHER seam throws inside the call and
  // the adapter reports the canonicalization failure instead of the
  // allow (the live A1 signature).
  const t1 = await drivePreExecute(world, 'rc2a1-t1', 'read', { file_path: 'team/a.md' })
  check(t1.decision.kind === 'allow', `T1: the allow-subtree read is a static allow (got ${JSON.stringify(t1.decision)})`)
  check(!hasCanonicalizationFailure(world), 'T1: no canonicalization failure after the first drive')

  // A1-T3 — the deny-subtree read: a static DENY with rule provenance.
  const t3 = await drivePreExecute(world, 'rc2a1-t3', 'read', { file_path: '/data/runtime/a.md' })
  check(t3.decision.kind === 'deny', `T3: the deny-subtree read is a static deny (got ${JSON.stringify(t3.decision)})`)
  const t3DecisionRowMaybe = decisionOf(world, 'rc2a1-t3')[0]
  check(t3DecisionRowMaybe !== undefined, 'T3: a decision observation row exists for the deny drive')
  const t3DecisionRow = t3DecisionRowMaybe!
  const t3Provenance = (t3DecisionRow['provenance'] ?? {}) as Record<string, unknown>

  // A1-T4 — the sibling trap: `/data/teambar/x` is OUTSIDE the `/data/team`
  // subtree (contains false). A prefix-matching regression would have
  // returned allow here.
  const t4 = await drivePreExecute(world, 'rc2a1-t4', 'read', { file_path: '/data/teambar/x' })
  check(t4.decision.kind === 'deny', `T4: the sibling read is NOT allowed by the subtree rule (got ${JSON.stringify(t4.decision)})`)
  const siblingContains = fs.containsCalls.filter((c) => c.child === '/data/teambar/x')

  // A1-T5 — relative/absolute equivalence (same cwd): `team/a.md` vs
  // `/data/team/a.md` — the SAME canonical identity (fingerprint +
  // display) and the SAME subtree decision.
  const t5rel = await drivePreExecute(world, 'rc2a1-t5rel', 'read', { file_path: 'team/a.md' })
  const t5abs = await drivePreExecute(world, 'rc2a1-t5abs', 'read', { file_path: '/data/team/a.md' })
  check(t5rel.decision.kind === 'allow', `T5: the relative spelling is allowed (got ${JSON.stringify(t5rel.decision)})`)
  check(t5abs.decision.kind === 'allow', `T5: the absolute spelling is allowed (got ${JSON.stringify(t5abs.decision)})`)
  const relRowMaybe = canonicalizedOf(world, 'rc2a1-t5rel')[0]
  const absRowMaybe = canonicalizedOf(world, 'rc2a1-t5abs')[0]
  check(relRowMaybe !== undefined && absRowMaybe !== undefined, 'T5: canonicalized rows exist for both spellings')
  // The check above throws on absence (module-load failure); the `!` is
  // the documented narrowing for the flow-critical check pattern.
  const relRow = relRowMaybe!
  const absRow = absRowMaybe!
  check(
    relRow['fingerprint'] === absRow['fingerprint'] && relRow['fingerprint'] !== undefined,
    `T5: the relative and absolute spellings canonicalize to the SAME identity (rel=${String(relRow['fingerprint'])} abs=${String(absRow['fingerprint'])})`,
  )
  check(
    typeof relRow['fingerprint'] === 'string' && relRow['fingerprint'].length > 0,
    'T5: the canonical fingerprint is present and non-empty',
  )

  // A1-T1 (flow-critical): BOTH seams were exercised with their receivers
  // intact (the class fake throws inside the seam call on any receiver
  // loss — the live A1 signature). The allow-subtree canonicalization
  // resolves the operation target + the two rule roots and contains the
  // subtree rules against the target.
  check(fs.resolveCalls.length >= 3, `T1: resolve was exercised through the facade (calls=${fs.resolveCalls.length})`)
  check(fs.containsCalls.length >= 1, `T1: contains was exercised through the facade (calls=${fs.containsCalls.length})`)
  check(
    fs.containsCalls.some((c) => c.parent === '/data/team' && c.child === '/data/team/a.md'),
    'T1: the /data/team rule contained /data/team/a.md through the class seam',
  )

  // The T2 control-request count (a static allow NEVER requests control —
  // the ask lane would have a request-created row; the allow lane must
  // not).
  const controlRequests = permObservations(world).filter((row) => row['stage'] === 'request-created').length

  await world.root.close()
  destroyDir(scratchDir('rc2a1-a'))

  return {
    fs,
    t1: {
      decision: t1.decision.kind,
      nextCalls: t1.nextCalls,
      resolveCalls: fs.resolveCalls.length,
      containsCalls: fs.containsCalls.length,
      canonicalizationFailure: hasCanonicalizationFailure(world),
    },
    t2: {
      decision: t1.decision.kind,
      nextCalls: t1.nextCalls,
      controlRequests,
    },
    t3: {
      decision: t3.decision.kind,
      provenance: String(t3Provenance['source'] ?? ''),
      lane: String(t3Provenance['lane'] ?? ''),
      nextCalls: t3.nextCalls,
    },
    t4: {
      decision: t4.decision.kind,
      nextCalls: t4.nextCalls,
      siblingContains,
    },
    t5: {
      relDecision: t5rel.decision.kind,
      absDecision: t5abs.decision.kind,
      relFingerprint: String(relRow['fingerprint'] ?? ''),
      absFingerprint: String(absRow['fingerprint'] ?? ''),
      relDisplay: String(relRow['resourceDisplay'] ?? ''),
      absDisplay: String(absRow['resourceDisplay'] ?? ''),
    },
  }
})()

// ══════════════════════════════════════════════════════════════════════════
// WORLD B — the resolve-only provider + subtree permission (A1-T6)
// ══════════════════════════════════════════════════════════════════════════

interface WorldBState {
  readonly setupError: {
    readonly isError: boolean
    readonly code: string
    readonly message: string
    readonly instanceId: string
  }
}

const worldB: WorldBState = await (async (): Promise<WorldBState> => {
  destroyDir(scratchDir('rc2a1-b'))
  const fs = resolveOnlyFs()
  let bootError: unknown
  try {
    const world = await bootWorld('b', WORLD_B_ROOT, fs)
    // The setup failure must surface as the BOOT rejection — if boot
    // settled, the agent ran on a broken authority (the plan §12 defect).
    check(false, 'T6: the resolve-only provider + subtree permission must reject the boot')
    await world.root.close()
    destroyDir(scratchDir('rc2a1-b'))
    bootError = new Error('unreachable')
  } catch (error) {
    bootError = error
  } finally {
    destroyDir(scratchDir('rc2a1-b'))
  }
  const isError = bootError instanceof Error
  const code = isError && typeof (bootError as { code?: unknown }).code === 'string'
    ? String((bootError as { code?: string }).code)
    : ''
  const message = bootError instanceof Error ? bootError.message : String(bootError)
  const instanceId = bootError !== null && typeof bootError === 'object' && typeof (bootError as { instanceId?: unknown }).instanceId === 'string'
    ? String((bootError as { instanceId?: string }).instanceId)
    : ''
  return {
    setupError: { isError, code, message, instanceId },
  }
})()

// ══════════════════════════════════════════════════════════════════════════
// THE ASSERTIONS (synchronous bodies over the captured world states)
// ══════════════════════════════════════════════════════════════════════════

describe('RC2-A1 fs containment (plan §13, A1-T1..T6)', () => {
  it('A1-T1: the production fsBackend facade preserves the receiver on resolve AND contains', () => {
    // Both seams were exercised (the flow-critical counts are checked at
    // world boot — a receiver loss throws INSIDE the seam call, producing
    // the canonicalization-failure rows instead of the static decisions,
    // and fails the file at module load). The observable outcome: a
    // subtree decision was REACHED at all (the pre-fix facade could not —
    // `this.processPath is not a function`, run 11-02-31) and the
    // contains seam was called on the class instance with the upstream
    // parent/child pair.
    expect(worldA.t1.decision).toBe('allow')
    expect(worldA.t1.canonicalizationFailure).toBe(false)
    expect(
      worldA.fs.containsCalls.some((c) => c.parent === '/data/team' && c.child === '/data/team/a.md'),
    ).toBe(true)
  })

  it('A1-T2: allow subtree is a static allow with NO control request', () => {
    expect(worldA.t2.decision).toBe('allow')
    // next() ran exactly once — the pipeline continued to the tool body
    // (the fail-closed zero-effect install never returns ask).
    expect(worldA.t2.nextCalls).toBe(1)
    expect(worldA.t2.controlRequests).toBe(0)
  })

  it('A1-T3: deny subtree is a static deny with rule provenance', () => {
    expect(worldA.t3.decision).toBe('deny')
    expect(worldA.t3.provenance).toBe('rule')
    expect(worldA.t3.lane).toBe('deny')
    expect(worldA.t3.nextCalls).toBe(0)
  })

  it('A1-T4: the sibling trap — `team` is NOT a parent of `teambar` (contains false)', () => {
    expect(worldA.t4.decision).toBe('deny')
    expect(worldA.t4.nextCalls).toBe(0)
    // The seam was CALLED with the sibling pair (the rule root + the
    // operation target) and returned false — a string-prefix matcher
    // would have allowed `/data/teambar/x` under `/data/team`.
    expect(
      worldA.t4.siblingContains.some((c) => c.parent === '/data/team' && c.child === '/data/teambar/x'),
    ).toBe(true)
  })

  it('A1-T5: relative/absolute equivalence under the same cwd (identity + decision)', () => {
    expect(worldA.t5.relDecision).toBe('allow')
    expect(worldA.t5.absDecision).toBe('allow')
    expect(worldA.t5.relFingerprint).toBe(worldA.t5.absFingerprint)
    // The canonical display paths are the same absolute file.
    expect(worldA.t5.relDisplay).toBe(worldA.t5.absDisplay)
    expect(worldA.t5.relDisplay).toBe('/data/team/a.md')
  })

  it('A1-T6: a resolve-only provider + subtree permission is a typed setup failure', () => {
    expect(worldB.setupError.isError).toBe(true)
    expect(worldB.setupError.code).toBe('alpha2-permission-fs-containment-unavailable')
    // The message names the incomplete seam (operator-diagnostics shape,
    // the sibling typed errors' pattern).
    expect(worldB.setupError.message.includes('contains()')).toBe(true)
    expect(worldB.setupError.message.includes('alpha2-permission-fs-containment-unavailable')).toBe(true)
    // The leader's durable identity rides the error (the sibling typed
    // errors' instanceId pattern).
    expect(worldB.setupError.instanceId).toBe('inst-leader')
  })
})
