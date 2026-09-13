/**
 * A2C-2 (alpha.2, plan §7) — the Permission Coverage Gate: the closed
 * six-class authority-owner classification of the FINAL model-facing
 * tool surface, the strict (capabilities.permissions) setup gate, and
 * the typed deterministic error
 * (alpha2-permission-coverage-unmanaged-tools).
 *
 * THE GATE (what this file proves — plan §7):
 * - the gate checks OWNERSHIP, not declaration (invariant §1.1): every
 *   final-surface tool must have a clear authority owner (the closed
 *   six classes: MANAGED_OPERATION_PERMISSION / OTHER_MANAGED_TEAM_TOOL
 *   / OTHER_MANAGED_MCP / SAFE_UNMANAGED / KNOWN_SENSITIVE_UNMANAGED /
 *   UNKNOWN_UNMANAGED);
 * - a KNOWN_SENSITIVE_UNMANAGED or UNKNOWN_UNMANAGED tool on the final
 *   surface of a strict agent FAILS THE SETUP LOUDLY (the typed error,
 *   deterministic sorted detail) — NO auto-hide (the gate never
 *   restrict()s a discovered tool) and NO acknowledgement escape hatch;
 * - the gate is ABSENT without capabilities.permissions (invariant
 *   §1.2): the alpha.1 / legacy path runs byte-for-byte unchanged;
 * - MCP ownership is PROVEN by the actual mount (the schemas() delta
 *   across the reconcile) — never by name-prefix guessing;
 * - unknown-by-default (plan §7.8): a preset update that adds a new
 *   tool blocks under strict mode until reviewed.
 *
 * RED-FIRST PROTOCOL (this file is the RED probe file for A2C-2):
 * - S0 (P1-P3) are the plan §7.6 RED probes: each asserts the PRE-FIX
 *   observable gap with a stable characterization leg (true on both
 *   trees — it documents the gap) + a gate leg (the post-fix fact —
 *   the assertion that FAILS on the base tree). On the base tree the
 *   file LOADS (every imported symbol exists at base; the post-fix
 *   exports are reached through the `op` namespace object only) and
 *   exactly the gate legs fail. Post-fix: every scenario is green.
 * - the GREEN sections (the G / F / S groups) are added with the
 *   implementation and go green in one step.
 *
 * RUNNER CONSTRAINTS (plain-node shim + vitest 4, node env, threads
 * pool — TEST_METHODS):
 * - every async scenario runs at MODULE level (top-level await) and
 *   captures its results into `R`; the `it` bodies are pure
 *   SYNCHRONOUS assertions over the captured results;
 * - the shim matchers are toBe / toEqual ONLY (no toContain / toMatch /
 *   toThrow-with-args): thrown errors are caught in the driver and
 *   their fields asserted.
 *
 * P4-T6 SELF-CLEANLINESS: this file carries ZERO legacy Team
 * SessionEvent denylist tokens (the five legacy event strings as exact
 * quoted literals, the five legacy payload identifiers, SessionEventMap,
 * the quoted dsh-session/types specifier). The two new scannable files
 * of this task (this test + the new operation-permission source file)
 * move the p4t6 `filesScanned` pin 692 → 694; the pin update belongs
 * to the main agent at the integration tip (DEC-1 union) — this task
 * only reports the expected-vs-actual delta.
 *
 * @module @dsh-agent-team/runtime/test/a2c2-permission-coverage
 */
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createScope, scopeOf } from '@deepseek-ai/dsh-scope'
import type { Scope } from '@deepseek-ai/dsh-scope'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import type { ToolDefinition, ToolExecutionResult, ToolRunContext } from '@deepseek-ai/dsh-tools'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { Agent } from '@deepseek-ai/dsh-agent'
import * as op from '../operation-permission/index.js'
import { PERMISSION_TOOL_NAMES } from '../../domain/blueprint/src/index.js'
import type { TemplatePermissionPolicy } from '../../domain/blueprint/src/index.js'
import { applyBuiltInToolDeny } from '../../tools/src/index.js'
import type { ActionCaller } from '../admission/index.js'
import { LEADER_INSTANCE_ID } from './p6t1-helpers.js'
import {
  P6T4_ROOT,
  createP6T4Service,
  createP6T4World,
  destroyP6T1World,
  leaderCaller,
} from './p6t4-helpers.js'

// ---------------------------------------------------------------------------
// Constants.
// ---------------------------------------------------------------------------

/** The strict default-deny policy (the A1-normalized shape). */
const STRICT_DENY: TemplatePermissionPolicy = { default: 'deny', allow: [], ask: [], deny: [] }

/** The three Team tool names used as the injected team-tool fact
 *  (real catalog names — packages/tools TeamToolDefinition). */
const TEAM_TOOLS = ['team_delegate', 'team_follow_up', 'team_inspect_config']

/** The synthetic unknown tool name (the §7.3-F unknown-semantics case). */
const UNKNOWN_TOOL = 'foo_magic'

/** The synthetic MCP-introduced tool name (the §7.3-C proven-mount case). */
const MCP_TOOL = 'mcp_weather'

/** The synthetic job-family name (the job_* prefix family leg — a
 *  future job control is sensitive, not unknown). */
const JOB_FAMILY_TOOL = 'job_pause'

// ---------------------------------------------------------------------------
// The structural shape of the post-fix API (accessed through the `op`
// namespace object ONLY — the RED file must LOAD on the base tree,
// where these exports do not exist yet; the gate legs capture a
// `present: false` marker on base and assert it is present post-fix).
// ---------------------------------------------------------------------------

interface A2C2Facts {
  readonly managedToolNames: readonly string[]
  readonly teamToolNames: readonly string[]
  readonly mcpToolNames: readonly string[]
}

interface A2C2Classified {
  readonly name: string
  readonly classification: string
}

interface A2C2Verdict {
  readonly ok: boolean
  readonly tools: readonly A2C2Classified[]
  readonly safeUnmanaged: readonly string[]
  readonly unmanagedTools: readonly {
    readonly name: string
    readonly classification: string
    readonly reason: string
    readonly remediation: string
  }[]
}

interface A2C2Detail {
  readonly instanceId: string
  readonly presetId: string | null
  readonly unmanagedTools: readonly {
    readonly name: string
    readonly classification: string
    readonly reason: string
    readonly remediation: string
  }[]
}

interface A2C2Api {
  readonly classifyPermissionCoverageTool?: (name: string, facts: A2C2Facts) => A2C2Classified
  readonly evaluatePermissionCoverage?: (toolNames: readonly string[], facts: A2C2Facts) => A2C2Verdict
  readonly mcpIntroducedToolNames?: (preMcp: readonly string[], final: readonly string[]) => string[]
  readonly permissionCoverageGateEnabled?: (permissions: TemplatePermissionPolicy | undefined) => boolean
  readonly buildPermissionCoverageErrorDetail?: (
    verdict: A2C2Verdict,
    context: { readonly instanceId: string; readonly presetId: string | null },
  ) => A2C2Detail
  readonly PermissionCoverageUnmanagedError?: new (detail: A2C2Detail) => Error & {
    code?: string
    detail?: A2C2Detail
  }
  readonly isPermissionCoverageUnmanagedError?: (value: unknown) => boolean
}

/** The post-fix API surface (undefined members on the base tree). */
const a2c2 = op as unknown as A2C2Api

/** The empty ownership facts (no team / no mcp — the pure registries). */
const EMPTY_FACTS: A2C2Facts = { managedToolNames: PERMISSION_TOOL_NAMES, teamToolNames: [], mcpToolNames: [] }

// ---------------------------------------------------------------------------
// The real-pipeline helpers (h1a/issue2/a2c1 recipe: the REAL upstream
// composition — cordis Context + ToolRuntime + dsh-scope + the REAL
// capability mask).
// ---------------------------------------------------------------------------

/** Mount the registry (with its systemPrompt dependency) on a fresh context. */
async function mountUpstream(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt, {})
  await ctx.plugin(ToolRuntime)
  return ctx
}

/** Mint an agent scope whose key doubles as a minimal Agent-like object. */
async function mintAgentScope(ctx: Context, name: string): Promise<{ scope: Scope; key: Agent }> {
  const key = { id: name as SessionId } as Agent
  let scope!: Scope
  await ctx.plugin(
    Object.assign((inner: Context) => {
      scope = createScope(inner, key)
    }, { inject: ['tools', 'systemPrompt'] }),
  )
  return { scope, key }
}

/** One synthetic tool definition (the body counts invocations). */
function makeTool(
  name: string,
  reply: string,
  onBody: (exec: ToolRunContext) => void,
): ToolDefinition {
  return {
    name,
    description: `a2c2 synthetic ${name}`,
    parameters: { type: 'object', properties: {} },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value as string }],
    },
    execute: (_args, exec): Promise<string> => {
      onBody(exec)
      return Promise.resolve(reply)
    },
  }
}

/**
 * The agent-scoped surface enumeration — the EXACT glue seam
 * (A2C-2, plan §7.2): the setup callback's agent ctx is the scope ctx
 * extended with the agent identity, so `scopeOf(agentCtx)` IS the
 * scope key (the Agent), and `tools.schemas(scope)` is the model-facing
 * surface: the inherited (restricted) surface + the scope's own
 * registrations. Sorted names.
 */
function surfaceNames(ctx: Context, scope: Scope): string[] {
  const agentCtx = scope.ctx.extend({ agent: scopeOf(scope.ctx) })
  const scopeKey = scopeOf(agentCtx)
  return ctx.tools.schemas(scopeKey as never).map((s) => s.name).sort()
}

/** Drive one tool call through the REAL pipeline of one agent scope. */
async function drive(
  ctx: Context,
  key: Agent,
  callId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolExecutionResult> {
  const controller = new AbortController()
  return await ctx.tools.execute({
    signal: controller.signal,
    callId: ToolCallId(callId),
    name,
    arguments: args,
    agent: key,
  })
}

/** A path resolver that must never run (unsupported tools are
 *  classified before any path resolution; a call here is a bug). */
const THROWING_RESOLVER = (): never => {
  throw new Error('a2c2: the resolver must not be called for an unsupported tool')
}

/** Install the REAL default-deny listener on one scope (the A5
 *  frozen adapter — present at base; A2C-2 does not touch it). */
function installDefaultDeny(
  scope: Scope,
  service: ReturnType<typeof createP6T4Service>,
  caller: ActionCaller,
  targetInstanceId: string,
  observations: Record<string, unknown>[],
): void {
  op.installParameterPermissionListener(scope.ctx, {
    policy: STRICT_DENY,
    resolveTarget: THROWING_RESOLVER,
    controlService: service,
    rootSessionId: P6T4_ROOT,
    caller,
    targetInstanceId,
    isLeader: true,
    onObserve: (observation) => {
      observations.push(observation)
    },
  })
}

// ===========================================================================
// MODULE-LEVEL SCENARIO DRIVER (top-level await — the shim constraint:
// every async scenario runs here; the `it` bodies below are synchronous
// assertions over the captured results). Every scenario is TOTAL on
// both trees (never throws at module level — the post-fix API is
// reached only through the a2c2 namespace guards).
// ===========================================================================

const R: Record<string, unknown> = await (async () => {
  const out: Record<string, unknown> = {}

  // ==========================================================================
  // S0-P1 · the unknown tool on the final surface under default=deny
  // (plan §7.6 probe 1). Pre-fix observable gap: a tool whose semantics
  // the Team plugin has not reviewed (foo_magic) sits on the model-facing
  // surface, the A2 canonical vocabulary classifies it as unsupported,
  // and NO setup-time check fails — the parameter-permission layer only
  // sees it at CALL time (and passes unsupported tools through). Post-fix:
  // the Coverage Gate classifies it UNKNOWN_UNMANAGED and the verdict
  // fails (ok: false) — the setup must reject it (FATAL lane F1/F2 prove
  // the throw + the typed error).
  // ==========================================================================
  {
    const ctx = await mountUpstream()
    const { scope, key } = await mintAgentScope(ctx, 'a2c2-p1')
    let bodyCalls = 0
    scope.ctx.tools.register(makeTool(UNKNOWN_TOOL, 'ok', () => {
      bodyCalls += 1
    }))
    // stable characterization (both trees): the capability layer alone
    // never removes an unknown tool from the surface, and the A2
    // canonical vocabulary does not know it.
    const surface = surfaceNames(ctx, scope)
    const classify = op.classifyPermissionTool(UNKNOWN_TOOL)
    // post-fix gate leg (RED on base): the evaluator classifies it
    // UNKNOWN_UNMANAGED.
    const evaluator = a2c2.evaluatePermissionCoverage
    const gatePresent = typeof evaluator === 'function'
    const verdict = gatePresent ? evaluator!([UNKNOWN_TOOL], EMPTY_FACTS) : undefined
    out.p1 = {
      surfaceHasUnknown: surface.includes(UNKNOWN_TOOL),
      surface,
      vocabularyKind: classify.kind,
      bodyCalls,
      gatePresent,
      verdictOk: verdict?.ok,
      verdictUnmanaged: verdict?.unmanagedTools,
      verdictTools: verdict?.tools,
    }
  }

  // ==========================================================================
  // S0-P2 · default=deny does not auto-remove an unsupported tool
  // (plan §7.6 probe 2). Pre-fix observable gap: with the REAL
  // default-deny listener installed (the A5 frozen adapter) on a real
  // agent scope, a known-sensitive unmanaged tool (web_fetch) stays on
  // the surface AND its body runs when called (the unsupported
  // pass-through) — the runtime layer neither hides nor gates it; only
  // a SETUP-TIME gate can reject the surface. Post-fix: the evaluator
  // classifies web_fetch KNOWN_SENSITIVE_UNMANAGED (the network
  // category) and the verdict fails.
  // ==========================================================================
  {
    const world = await createP6T4World('a2c2-p2', ['leader', 'worker'])
    try {
      const service = createP6T4Service(world)
      const ctx = await mountUpstream()
      const { scope, key } = await mintAgentScope(ctx, 'a2c2-p2')
      let bodyCalls = 0
      scope.ctx.tools.register(makeTool('web_fetch', 'ok', () => {
        bodyCalls += 1
      }))
      const observations: Record<string, unknown>[] = []
      const caller = leaderCaller()
      installDefaultDeny(scope, service, caller, LEADER_INSTANCE_ID, observations)
      // stable characterization (both trees): the listener install
      // changes NOTHING about the surface, and the unsupported tool's
      // body runs (zero control rows — the pass-through).
      const surface = surfaceNames(ctx, scope)
      const result = await drive(ctx, key, 'a2c2-p2-call', 'web_fetch', { url: 'https://example.invalid' })
      const text = result.content[0]?.type === 'text' ? result.content[0].text : undefined
      // post-fix gate leg (RED on base).
      const evaluator = a2c2.evaluatePermissionCoverage
      const classifier = a2c2.classifyPermissionCoverageTool
      const gatePresent = typeof evaluator === 'function' && typeof classifier === 'function'
      const classified = gatePresent ? classifier!('web_fetch', EMPTY_FACTS) : undefined
      const verdict = gatePresent ? evaluator!(['web_fetch'], EMPTY_FACTS) : undefined
      out.p2 = {
        surfaceHasWebFetch: surface.includes('web_fetch'),
        bodyCalls,
        resultText: text,
        gatePresent,
        classification: classified?.classification,
        verdictOk: verdict?.ok,
        verdictUnmanaged: verdict?.unmanagedTools,
      }
    } finally {
      await destroyP6T1World(world)
    }
  }

  // ==========================================================================
  // S0-P3 · grep / subagent / web_fetch escape the 7-name managed
  // vocabulary (plan §7.6 probe 3). Pre-fix observable gap: the final
  // managed vocabulary (PERMISSION_TOOL_NAMES) covers only the
  // alpha.2 operation-permission tools — the fs-search, orchestration,
  // and egress tools are NOT in it, and the A2 canonical classifier
  // marks them unsupported. Post-fix: the evaluator classifies all
  // three KNOWN_SENSITIVE_UNMANAGED (fsSearch / orchestration / network
  // categories) and a surface of exactly those three fails.
  // ==========================================================================
  {
    const escaping = ['grep', 'subagent', 'web_fetch']
    // stable characterization (both trees).
    const managedSet = [...PERMISSION_TOOL_NAMES].sort()
    const inVocabulary = escaping.map((name) => PERMISSION_TOOL_NAMES.includes(name))
    const classifyKinds = escaping.map((name) => op.classifyPermissionTool(name).kind)
    // post-fix gate leg (RED on base): a SHUFFLED input order classifies
    // all three sensitive and the verdict fails with the sorted detail.
    const evaluator = a2c2.evaluatePermissionCoverage
    const gatePresent = typeof evaluator === 'function'
    const verdict = gatePresent ? evaluator!(['web_fetch', 'subagent', 'grep'], EMPTY_FACTS) : undefined
    out.p3 = {
      managedSet,
      inVocabulary,
      classifyKinds,
      gatePresent,
      verdictOk: verdict?.ok,
      verdictUnmanaged: verdict?.unmanagedTools,
    }
  }

  // ==========================================================================
  // G — the six-class evaluator matrix (plan §7.3). Pure legs: the
  // evaluator is called directly with injected facts (no live surface).
  // Total on both trees: the post-fix API is reached only through the
  // a2c2 namespace guards (base: a `present: false` marker is captured;
  // the it legs fail there — the GREEN scenarios go green in one step
  // with the implementation).
  // ==========================================================================
  const hasGate = typeof a2c2.evaluatePermissionCoverage === 'function'
  const evalCoverage = (names: readonly string[], facts: A2C2Facts): A2C2Verdict | undefined =>
    hasGate ? a2c2.evaluatePermissionCoverage!(names, facts) : undefined
  const classifyOne = (name: string, facts: A2C2Facts): A2C2Classified | undefined =>
    typeof a2c2.classifyPermissionCoverageTool === 'function'
      ? a2c2.classifyPermissionCoverageTool!(name, facts)
      : undefined
  const introduced = (pre: readonly string[], fin: readonly string[]): string[] | undefined =>
    typeof a2c2.mcpIntroducedToolNames === 'function' ? a2c2.mcpIntroducedToolNames!(pre, fin) : undefined

  // G1 · MANAGED_OPERATION_PERMISSION — the 7-name final managed
  // vocabulary classifies managed and the surface PASSES (invariant
  // §1.3: no explicit Blueprint rule is required for coverage).
  {
    const verdict = evalCoverage([...PERMISSION_TOOL_NAMES], EMPTY_FACTS)
    out.g1 = {
      present: hasGate,
      ok: verdict?.ok,
      tools: verdict?.tools,
      unmanaged: verdict?.unmanagedTools,
      safe: verdict?.safeUnmanaged,
    }
  }

  // G2 · OTHER_MANAGED_TEAM_TOOL — the exactly selected+registered Team
  // tool names classify team-managed (the teamTools capability + the
  // Team runtime are the authority owner).
  {
    const facts: A2C2Facts = { ...EMPTY_FACTS, teamToolNames: TEAM_TOOLS }
    const verdict = evalCoverage([...TEAM_TOOLS], facts)
    out.g2 = {
      present: hasGate,
      ok: verdict?.ok,
      tools: verdict?.tools,
      unmanaged: verdict?.unmanagedTools,
    }
  }

  // G3 · OTHER_MANAGED_MCP — the PROVEN mount delta (never a name-prefix
  // guess) classifies mcp-managed; names present before the mount are
  // never claimed by the mount.
  {
    const pre = ['read', 'bash', 'team_delegate']
    const fin = ['team_delegate', 'mcp_weather', 'read', 'bash']
    const delta = introduced(pre, fin)
    const facts: A2C2Facts = {
      ...EMPTY_FACTS,
      teamToolNames: ['team_delegate'],
      mcpToolNames: delta ?? [],
    }
    const verdict = evalCoverage(fin, facts)
    out.g3 = {
      present: hasGate && delta !== undefined,
      delta,
      ok: verdict?.ok,
      tools: verdict?.tools,
      unmanaged: verdict?.unmanagedTools,
    }
  }

  // G4 · SAFE_UNMANAGED — the closed source-reviewed registry
  // (todo_write) classifies safe: coverage PASSES with the diagnostic.
  {
    const verdict = evalCoverage(['todo_write'], EMPTY_FACTS)
    out.g4 = {
      present: hasGate,
      ok: verdict?.ok,
      tools: verdict?.tools,
      unmanaged: verdict?.unmanagedTools,
      safe: verdict?.safeUnmanaged,
    }
  }

  // G5 · KNOWN_SENSITIVE_UNMANAGED — every closed registry entry + the
  // synthetic job-family name (the job_ prefix family leg) classifies
  // sensitive; the surface of exactly those FAILS.
  {
    const names = [
      ...(op as { KNOWN_SENSITIVE_TOOL_NAMES?: readonly string[] }).KNOWN_SENSITIVE_TOOL_NAMES ?? [],
      JOB_FAMILY_TOOL,
    ]
    const verdict = evalCoverage(names, EMPTY_FACTS)
    out.g5 = {
      present: hasGate && (op as { KNOWN_SENSITIVE_TOOL_NAMES?: readonly string[] }).KNOWN_SENSITIVE_TOOL_NAMES !== undefined,
      registry: (op as { KNOWN_SENSITIVE_TOOL_NAMES?: readonly string[] }).KNOWN_SENSITIVE_TOOL_NAMES,
      prefixes: (op as { KNOWN_SENSITIVE_TOOL_PREFIXES?: readonly string[] }).KNOWN_SENSITIVE_TOOL_PREFIXES,
      safe: (op as { SAFE_UNMANAGED_TOOL_NAMES?: readonly string[] }).SAFE_UNMANAGED_TOOL_NAMES,
      ok: verdict?.ok,
      classifications: verdict?.tools.map((t) => t.classification),
      unmanaged: verdict?.unmanagedTools,
    }
  }

  // G6 · UNKNOWN_UNMANAGED — anything not owned by the five classes is
  // unknown: FATAL, never warning-only (plan §7.3-F).
  {
    const verdict = evalCoverage(['zeta_magic', 'foo_magic'], EMPTY_FACTS)
    out.g6 = {
      present: hasGate,
      ok: verdict?.ok,
      tools: verdict?.tools,
      unmanaged: verdict?.unmanagedTools,
    }
  }

  // G7 · the fixed precedence — a proven owner beats a name-based
  // suspicion (the anti-name-guessing guarantee): managed > team > mcp >
  // safe > sensitive > unknown; the closed registries stay disjoint.
  {
    const factsManagedTeam: A2C2Facts = { ...EMPTY_FACTS, teamToolNames: ['read'] }
    const factsMcpSensitive: A2C2Facts = { ...EMPTY_FACTS, mcpToolNames: ['grep'] }
    const factsTeamMcp: A2C2Facts = { ...EMPTY_FACTS, teamToolNames: [MCP_TOOL], mcpToolNames: [MCP_TOOL] }
    const safe = (op as { SAFE_UNMANAGED_TOOL_NAMES?: readonly string[] }).SAFE_UNMANAGED_TOOL_NAMES ?? []
    const sensitive =
      (op as { KNOWN_SENSITIVE_TOOL_NAMES?: readonly string[] }).KNOWN_SENSITIVE_TOOL_NAMES ?? []
    const overlapSafeSensitive = safe.filter((n) => sensitive.includes(n))
    const overlapManagedSensitive = [...PERMISSION_TOOL_NAMES].filter((n) => sensitive.includes(n))
    out.g7 = {
      present: hasGate,
      managedBeatsTeam: classifyOne('read', factsManagedTeam)?.classification,
      mcpBeatsSensitive: classifyOne('grep', factsMcpSensitive)?.classification,
      mcpVerdictOk: evalCoverage(['grep'], factsMcpSensitive)?.ok,
      teamBeatsMcp: classifyOne(MCP_TOOL, factsTeamMcp)?.classification,
      registryOverlapSafeSensitive: overlapSafeSensitive,
      registryOverlapManagedSensitive: overlapManagedSensitive,
    }
  }

  // G8 · determinism — three different input orders of the same surface
  // give byte-identical verdicts (the sorted contract the typed error
  // detail relies on).
  {
    const surface = ['web_fetch', 'read', 'grep', 'todo_write', 'subagent', 'bash']
    const v1 = evalCoverage(surface, EMPTY_FACTS)
    const v2 = evalCoverage([...surface].reverse(), EMPTY_FACTS)
    const v3 = evalCoverage([...surface].sort((a, b) => b.localeCompare(a)), EMPTY_FACTS)
    out.g8 = {
      present: hasGate,
      v1,
      v1EqualsV2: v1 !== undefined && v2 !== undefined ? JSON.stringify(v1) === JSON.stringify(v2) : false,
      v1EqualsV3: v1 !== undefined && v3 !== undefined ? JSON.stringify(v1) === JSON.stringify(v3) : false,
    }
  }

  // G9 · the realistic mixed surface — the full standard-preset shape
  // (managed + team + proven-mcp + safe) PASSES; adding one sensitive +
  // one job-family tool FAILS with exactly those two entries.
  {
    const good = [
      ...PERMISSION_TOOL_NAMES,
      'team_delegate',
      'team_follow_up',
      MCP_TOOL,
      'todo_write',
    ]
    const facts: A2C2Facts = {
      managedToolNames: PERMISSION_TOOL_NAMES,
      teamToolNames: ['team_delegate', 'team_follow_up'],
      mcpToolNames: [MCP_TOOL],
    }
    const vGood = evalCoverage(good, facts)
    const vBad = evalCoverage([...good, 'grep', 'job_kill'], facts)
    out.g9 = {
      present: hasGate,
      goodOk: vGood?.ok,
      goodTools: vGood?.tools,
      badOk: vBad?.ok,
      badUnmanaged: vBad?.unmanagedTools,
      goodSafe: vGood?.safeUnmanaged,
    }
  }

  // ==========================================================================
  // F — the FATAL lanes + the typed error shape (plan §7.4).
  // ==========================================================================

  // F1 · the pure FATAL lane + the typed error: the closed code, the
  // deterministic sorted detail (instanceId + presetId + unmanagedTools
  // [{name, classification, reason, remediation}]), the deterministic
  // message, the type guard, and the explicit presetId: null leg.
  {
    const verdict = evalCoverage(['grep', 'foo_magic', 'zeta_magic'], EMPTY_FACTS)
    const detailBuilder = a2c2.buildPermissionCoverageErrorDetail
    const errorCtor = a2c2.PermissionCoverageUnmanagedError
    const guard = a2c2.isPermissionCoverageUnmanagedError
    const present =
      hasGate &&
      typeof detailBuilder === 'function' &&
      typeof errorCtor === 'function' &&
      typeof guard === 'function'
    const detail = present ? detailBuilder!(verdict!, { instanceId: 'inst-a2c2', presetId: 'standard' }) : undefined
    const detailNullPreset = present
      ? detailBuilder!(verdict!, { instanceId: 'inst-a2c2', presetId: null })
      : undefined
    let error: (Error & { code?: string; detail?: A2C2Detail }) | undefined
    let errorNullPreset: (Error & { code?: string; detail?: A2C2Detail }) | undefined
    if (present) {
      error = new errorCtor!(detail!)
      errorNullPreset = new errorCtor!(detailNullPreset!)
    }
    out.f1 = {
      present,
      verdictOk: verdict?.ok,
      detail,
      errorName: error?.name,
      errorCode: error?.code,
      errorDetail: error?.detail,
      errorMessage: error?.message,
      errorNullPresetMessage: errorNullPreset?.message,
      detailNullPresetPresetId: detailNullPreset?.presetId,
      guardTrue: error !== undefined ? guard!(error) : false,
      guardFalse: guard ? guard!(new Error('plain')) : false,
      instanceGuard: error !== undefined && typeof error.message === 'string' ? error.message.includes('inst-a2c2') : false,
    }
  }

  // F2 · the real-seam FATAL lane — the EXACT glue chain (plan §7.2):
  // the real agent scope registers a known-sensitive tool (grep) + an
  // unknown tool (foo_magic) on its own surface; the public
  // `tools.schemas(scopeOf(agentCtx))` enumeration feeds the evaluator;
  // the verdict fails with exactly those two entries.
  {
    const ctx = await mountUpstream()
    const { scope } = await mintAgentScope(ctx, 'a2c2-f2')
    scope.ctx.tools.register(makeTool('grep', 'ok', () => undefined))
    scope.ctx.tools.register(makeTool(UNKNOWN_TOOL, 'ok', () => undefined))
    const surface = surfaceNames(ctx, scope)
    const verdict = evalCoverage(surface, EMPTY_FACTS)
    out.f2 = {
      present: hasGate,
      surface,
      ok: verdict?.ok,
      unmanaged: verdict?.unmanagedTools,
    }
  }

  // F3 · the hidden-sensitive lane — the capability layer
  // (builtinToolDeny → the public restrict() seam) removes the
  // sensitive tool BEFORE the gate runs: the same surface then PASSES.
  // The contrast (no deny → FATAL) is F2.
  {
    const ctx = await mountUpstream()
    // register grep on the GLOBAL layer: the agent scope inherits it
    // (the preset-tool position builtinToolDeny masks).
    ctx.tools.register(makeTool('grep', 'ok', () => undefined))
    const { scope, key } = await mintAgentScope(ctx, 'a2c2-f3')
    const surfaceWith = surfaceNames(ctx, scope)
    const verdictWith = evalCoverage(surfaceWith, EMPTY_FACTS)
    // the REAL capability mask on the agent scope (the T2 adapter over
    // the public tools.restrict seam).
    applyBuiltInToolDeny(scope.ctx, ['grep'])
    const surfaceWithout = surfaceNames(ctx, scope)
    const verdictWithout = evalCoverage(surfaceWithout, EMPTY_FACTS)
    void key
    out.f3 = {
      present: hasGate,
      surfaceWith,
      surfaceWithout,
      okWith: verdictWith?.ok,
      okWithout: verdictWithout?.ok,
      unmanagedWith: verdictWith?.unmanagedTools,
      unmanagedWithout: verdictWithout?.unmanagedTools,
    }
  }

  // ==========================================================================
  // S — the real-seam legs (MCP delta, legacy enablement, lifecycle).
  // ==========================================================================

  // S1 · the MCP delta on the REAL seam — the pre-MCP snapshot and the
  // final surface are both taken through `tools.schemas(scopeOf(...))`;
  // the mount's actual addition (a scope-own registration, the MCP
  // position) is the delta; the delta name classifies
  // OTHER_MANAGED_MCP and the surface PASSES.
  {
    const ctx = await mountUpstream()
    ctx.tools.register(makeTool('read', 'ok', () => undefined))
    ctx.tools.register(makeTool('bash', 'ok', () => undefined))
    const { scope } = await mintAgentScope(ctx, 'a2c2-s1')
    const pre = surfaceNames(ctx, scope)
    // the permitted MCP mount introduces its tool into the agent scope
    // (the reconcileMcp position — the fiber's tools register on the
    // agent scope ctx).
    scope.ctx.tools.register(makeTool(MCP_TOOL, 'ok', () => undefined))
    const fin = surfaceNames(ctx, scope)
    const delta = introduced(pre, fin)
    const verdict = evalCoverage(fin, { ...EMPTY_FACTS, mcpToolNames: delta ?? [] })
    out.s1 = {
      present: hasGate && delta !== undefined,
      pre,
      fin,
      delta,
      ok: verdict?.ok,
      tools: verdict?.tools,
    }
  }

  // S2 · the strict-mode condition (invariant §1.2 / plan §7.1) — the
  // gate is ENABLED ⇔ the Template declares capabilities.permissions;
  // absent policy = the gate is ABSENT (the alpha.1 / legacy path
  // byte-for-byte unchanged — zero gate code runs).
  {
    const enabled = a2c2.permissionCoverageGateEnabled
    out.s2 = {
      present: typeof enabled === 'function',
      absentPolicy: enabled ? enabled(undefined) : undefined,
      strictPolicy: enabled ? enabled(STRICT_DENY) : undefined,
    }
  }

  // S3 · the lifecycle invariant (plan §7.7) — the four bind paths
  // (fresh-root / fresh-member / cold-root / cold-member) all run the
  // SAME setup surface → the SAME verdict. Modeled as four identically
  // composed agent scopes on one host (the same inherited preset
  // surface + the same scope-own Team tool registration): a passing
  // composition and a FATAL composition, verdicts identical across all
  // four scopes (the verdict depends only on the final surface + the
  // ownership facts — the property the bind-path-independent gate
  // placement in the shared agentSetup callback requires).
  {
    const ctx = await mountUpstream()
    // the shared inherited (preset) surface: one managed tool.
    ctx.tools.register(makeTool('read', 'ok', () => undefined))
    const scopes: { label: string; scope: Scope }[] = []
    for (const label of ['fresh-root', 'fresh-member', 'cold-root', 'cold-member']) {
      const { scope } = await mintAgentScope(ctx, `a2c2-s3-${label}`)
      // the scope-own Team tool registration (the setup position).
      scope.ctx.tools.register(makeTool('team_delegate', 'ok', () => undefined))
      scopes.push({ label, scope })
    }
    const facts: A2C2Facts = { ...EMPTY_FACTS, teamToolNames: ['team_delegate'] }
    // the PASS composition: every tool owned (managed + team) — all
    // four scopes give the identical passing verdict.
    const passVerdicts = scopes.map(({ label, scope }) => {
      const surface = surfaceNames(ctx, scope)
      return { label, surface, verdict: evalCoverage(surface, facts) }
    })
    // the FATAL variant: every scope additionally registers a
    // known-sensitive + the unknown tool → all four fail identically.
    for (const { scope } of scopes) {
      scope.ctx.tools.register(makeTool('grep', 'ok', () => undefined))
      scope.ctx.tools.register(makeTool(UNKNOWN_TOOL, 'ok', () => undefined))
    }
    const fatalVerdicts = scopes.map(({ label, scope }) => {
      const surface = surfaceNames(ctx, scope)
      return { label, surface, verdict: evalCoverage(surface, facts) }
    })
    const passJson = passVerdicts.map((g) => JSON.stringify({ surface: g.surface, verdict: g.verdict }))
    const fatalJson = fatalVerdicts.map((f) => JSON.stringify({ surface: f.surface, verdict: f.verdict }))
    out.s3 = {
      present: hasGate,
      passSurfaces: passVerdicts.map((g) => g.surface),
      passVerdictsIdentical: passJson.every((j) => j === passJson[0]),
      passVerdict: passVerdicts[0]?.verdict,
      fatalSurfaces: fatalVerdicts.map((f) => f.surface),
      fatalVerdictsIdentical: fatalJson.every((j) => j === fatalJson[0]),
      fatalVerdict: fatalVerdicts[0]?.verdict,
    }
  }

  return out
})()

// ===========================================================================
// S0 — the plan §7.6 RED probes (pre-fix gap characterization + the
// post-fix gate legs).
// ===========================================================================

describe('a2c2 S0 · RED probes (plan §7.6)', () => {
  it('P1 · the unknown tool on the final surface under default=deny is UNKNOWN_UNMANAGED (the gate rejects it; nothing auto-removes it)', () => {
    const p1 = R['p1'] as Record<string, any>
    // stable characterization of the pre-fix gap (both trees):
    expect(p1.surfaceHasUnknown).toBe(true) // the capability layer alone never removes it
    expect(p1.vocabularyKind).toBe('unsupported') // the A2 vocabulary does not know it
    expect(p1.bodyCalls).toBe(0) // nothing was called — the gap is at SETUP time
    // the post-fix gate leg (RED on base):
    expect(p1.gatePresent).toBe(true)
    expect(p1.verdictOk).toBe(false)
    expect(p1.verdictUnmanaged).toEqual([
      {
        name: UNKNOWN_TOOL,
        classification: 'unknown-unmanaged',
        reason: 'no reviewed authority owner is known for this tool (unknown semantics)',
        remediation:
          'remove the tool with builtinToolDeny or add a reviewed authority owner (a source-reviewed SAFE_UNMANAGED entry or an operation adapter)',
      },
    ])
    expect(p1.verdictTools).toEqual([{ name: UNKNOWN_TOOL, classification: 'unknown-unmanaged' }])
  })

  it('P2 · default=deny does not auto-remove an unsupported tool (web_fetch stays on the surface and its body runs; the gate classifies it sensitive)', () => {
    const p2 = R['p2'] as Record<string, any>
    // stable characterization of the pre-fix gap (both trees):
    expect(p2.surfaceHasWebFetch).toBe(true) // the listener install never hides the tool
    expect(p2.bodyCalls).toBe(1) // the unsupported pass-through ran the body
    expect(p2.resultText).toBe('ok')
    // the post-fix gate leg (RED on base):
    expect(p2.gatePresent).toBe(true)
    expect(p2.classification).toBe('known-sensitive-unmanaged')
    expect(p2.verdictOk).toBe(false)
    expect(p2.verdictUnmanaged).toEqual([
      {
        name: 'web_fetch',
        classification: 'known-sensitive-unmanaged',
        reason: 'network egress is outside the static permission coverage (no alpha.2 operation adapter)',
        remediation:
          'remove the tool with builtinToolDeny (or another capability-layer removal) or add a reviewed authority owner (an operation adapter)',
      },
    ])
  })

  it('P3 · grep/subagent/web_fetch escape the 7-name managed vocabulary (all three are KNOWN_SENSITIVE_UNMANAGED; the surface of exactly those fails)', () => {
    const p3 = R['p3'] as Record<string, any>
    // stable characterization of the pre-fix gap (both trees):
    expect(p3.managedSet).toEqual(['bash', 'edit', 'lsp', 'pwsh', 'read', 'read_image', 'write'])
    expect(p3.inVocabulary).toEqual([false, false, false])
    expect(p3.classifyKinds).toEqual(['unsupported', 'unsupported', 'unsupported'])
    // the post-fix gate leg (RED on base):
    expect(p3.gatePresent).toBe(true)
    expect(p3.verdictOk).toBe(false)
    expect(p3.verdictUnmanaged).toEqual([
      {
        name: 'grep',
        classification: 'known-sensitive-unmanaged',
        reason: 'filesystem search can disclose content outside read-permission coverage (A2C-6 is deferred; no alpha.2 operation adapter)',
        remediation:
          'remove the tool with builtinToolDeny (or another capability-layer removal) or add a reviewed authority owner (an operation adapter)',
      },
      {
        name: 'subagent',
        classification: 'known-sensitive-unmanaged',
        reason: 'generic subagent/workflow orchestration escapes MemberInstance governance (no alpha.2 operation adapter)',
        remediation:
          'remove the tool with builtinToolDeny (or another capability-layer removal) or add a reviewed authority owner (an operation adapter)',
      },
      {
        name: 'web_fetch',
        classification: 'known-sensitive-unmanaged',
        reason: 'network egress is outside the static permission coverage (no alpha.2 operation adapter)',
        remediation:
          'remove the tool with builtinToolDeny (or another capability-layer removal) or add a reviewed authority owner (an operation adapter)',
      },
    ])
  })
})

describe('a2c2 G · the six-class evaluator matrix (plan §7.3)', () => {
  it('G1 · the 7-name managed vocabulary classifies MANAGED_OPERATION_PERMISSION and PASSES without any explicit rule (invariant §1.3)', () => {
    const g1 = R['g1'] as Record<string, any>
    expect(g1.present).toBe(true)
    expect(g1.ok).toBe(true)
    expect(g1.tools).toEqual([
      { name: 'bash', classification: 'managed-operation-permission' },
      { name: 'edit', classification: 'managed-operation-permission' },
      { name: 'lsp', classification: 'managed-operation-permission' },
      { name: 'pwsh', classification: 'managed-operation-permission' },
      { name: 'read', classification: 'managed-operation-permission' },
      { name: 'read_image', classification: 'managed-operation-permission' },
      { name: 'write', classification: 'managed-operation-permission' },
    ])
    expect(g1.unmanaged).toEqual([])
    expect(g1.safe).toEqual([])
  })

  it('G2 · the selected+registered Team tools classify OTHER_MANAGED_TEAM_TOOL and PASS', () => {
    const g2 = R['g2'] as Record<string, any>
    expect(g2.present).toBe(true)
    expect(g2.ok).toBe(true)
    expect(g2.tools).toEqual([
      { name: 'team_delegate', classification: 'other-managed-team-tool' },
      { name: 'team_follow_up', classification: 'other-managed-team-tool' },
      { name: 'team_inspect_config', classification: 'other-managed-team-tool' },
    ])
    expect(g2.unmanaged).toEqual([])
  })

  it('G3 · the proven MCP-mount delta classifies OTHER_MANAGED_MCP (names present before the mount are never claimed)', () => {
    const g3 = R['g3'] as Record<string, any>
    expect(g3.present).toBe(true)
    expect(g3.delta).toEqual(['mcp_weather'])
    expect(g3.ok).toBe(true)
    expect(g3.tools).toEqual([
      { name: 'bash', classification: 'managed-operation-permission' },
      { name: 'mcp_weather', classification: 'other-managed-mcp' },
      { name: 'read', classification: 'managed-operation-permission' },
      { name: 'team_delegate', classification: 'other-managed-team-tool' },
    ])
    expect(g3.unmanaged).toEqual([])
  })

  it('G4 · the closed SAFE_UNMANAGED registry (todo_write) PASSES with the safe-unmanaged diagnostic', () => {
    const g4 = R['g4'] as Record<string, any>
    expect(g4.present).toBe(true)
    expect(g4.ok).toBe(true)
    expect(g4.tools).toEqual([{ name: 'todo_write', classification: 'safe-unmanaged' }])
    expect(g4.unmanaged).toEqual([])
    expect(g4.safe).toEqual(['todo_write'])
  })

  it('G5 · every closed known-sensitive registry entry + the job_ family leg classify KNOWN_SENSITIVE_UNMANAGED and the surface FAILS', () => {
    const g5 = R['g5'] as Record<string, any>
    expect(g5.present).toBe(true)
    expect(g5.registry).toEqual([
      'grep',
      'glob',
      'subagent',
      'subagent_fork',
      'ralph',
      'workflow',
      'web_fetch',
      'web_search',
      'job_list',
      'job_output',
      'job_kill',
      'send_message',
      'interrupt_agent',
      'list_agents',
    ])
    expect(g5.prefixes).toEqual(['job_'])
    expect(g5.safe).toEqual(['todo_write'])
    expect(g5.ok).toBe(false)
    // all 15 entries (14 exact names + the synthetic job-family leg)
    // classify sensitive — the prefix family is the same class.
    expect(g5.classifications).toEqual(Array(15).fill('known-sensitive-unmanaged'))
    // the sorted detail: the synthetic job-family name carries the jobs
    // category reason (the family mapping).
    const jobPause = g5.unmanaged.find((e: any) => e.name === JOB_FAMILY_TOOL)
    expect(jobPause).toEqual({
      name: JOB_FAMILY_TOOL,
      classification: 'known-sensitive-unmanaged',
      reason: 'background job process control is outside the static permission coverage (no alpha.2 operation adapter)',
      remediation:
        'remove the tool with builtinToolDeny (or another capability-layer removal) or add a reviewed authority owner (an operation adapter)',
    })
    expect(g5.unmanaged.map((e: any) => e.name)).toEqual(
      [...g5.registry, JOB_FAMILY_TOOL].sort(),
    )
  })

  it('G6 · unknown tools classify UNKNOWN_UNMANAGED: FATAL, never warning-only (plan §7.3-F)', () => {
    const g6 = R['g6'] as Record<string, any>
    expect(g6.present).toBe(true)
    expect(g6.ok).toBe(false)
    expect(g6.tools).toEqual([
      { name: 'foo_magic', classification: 'unknown-unmanaged' },
      { name: 'zeta_magic', classification: 'unknown-unmanaged' },
    ])
    expect(g6.unmanaged).toEqual([
      {
        name: 'foo_magic',
        classification: 'unknown-unmanaged',
        reason: 'no reviewed authority owner is known for this tool (unknown semantics)',
        remediation:
          'remove the tool with builtinToolDeny or add a reviewed authority owner (a source-reviewed SAFE_UNMANAGED entry or an operation adapter)',
      },
      {
        name: 'zeta_magic',
        classification: 'unknown-unmanaged',
        reason: 'no reviewed authority owner is known for this tool (unknown semantics)',
        remediation:
          'remove the tool with builtinToolDeny or add a reviewed authority owner (a source-reviewed SAFE_UNMANAGED entry or an operation adapter)',
      },
    ])
  })

  it('G7 · the fixed precedence — a proven owner beats a name-based suspicion; the closed registries stay disjoint', () => {
    const g7 = R['g7'] as Record<string, any>
    expect(g7.present).toBe(true)
    expect(g7.managedBeatsTeam).toBe('managed-operation-permission')
    expect(g7.mcpBeatsSensitive).toBe('other-managed-mcp')
    expect(g7.mcpVerdictOk).toBe(true)
    expect(g7.teamBeatsMcp).toBe('other-managed-team-tool')
    expect(g7.registryOverlapSafeSensitive).toEqual([])
    expect(g7.registryOverlapManagedSensitive).toEqual([])
  })

  it('G8 · determinism — three input orders of the same surface give byte-identical verdicts', () => {
    const g8 = R['g8'] as Record<string, any>
    expect(g8.present).toBe(true)
    expect(g8.v1EqualsV2).toBe(true)
    expect(g8.v1EqualsV3).toBe(true)
  })

  it('G9 · the realistic mixed surface PASSES; adding one sensitive + one job-family tool FAILS with exactly those two', () => {
    const g9 = R['g9'] as Record<string, any>
    expect(g9.present).toBe(true)
    expect(g9.goodOk).toBe(true)
    expect(g9.goodSafe).toEqual(['todo_write'])
    expect(g9.goodTools).toEqual([
      { name: 'bash', classification: 'managed-operation-permission' },
      { name: 'edit', classification: 'managed-operation-permission' },
      { name: 'lsp', classification: 'managed-operation-permission' },
      { name: 'mcp_weather', classification: 'other-managed-mcp' },
      { name: 'pwsh', classification: 'managed-operation-permission' },
      { name: 'read', classification: 'managed-operation-permission' },
      { name: 'read_image', classification: 'managed-operation-permission' },
      { name: 'team_delegate', classification: 'other-managed-team-tool' },
      { name: 'team_follow_up', classification: 'other-managed-team-tool' },
      { name: 'todo_write', classification: 'safe-unmanaged' },
      { name: 'write', classification: 'managed-operation-permission' },
    ])
    expect(g9.badOk).toBe(false)
    expect(g9.badUnmanaged.map((e: any) => e.name)).toEqual(['grep', 'job_kill'])
  })
})

describe('a2c2 F · the FATAL lanes + the typed error shape (plan §7.4)', () => {
  it('F1 · the FATAL verdict builds the deterministic typed error (closed code + sorted detail + deterministic message + the type guard + the explicit presetId: null)', () => {
    const f1 = R['f1'] as Record<string, any>
    expect(f1.present).toBe(true)
    expect(f1.verdictOk).toBe(false)
    expect(f1.detail).toEqual({
      instanceId: 'inst-a2c2',
      presetId: 'standard',
      unmanagedTools: [
        {
          name: 'foo_magic',
          classification: 'unknown-unmanaged',
          reason: 'no reviewed authority owner is known for this tool (unknown semantics)',
          remediation:
            'remove the tool with builtinToolDeny or add a reviewed authority owner (a source-reviewed SAFE_UNMANAGED entry or an operation adapter)',
        },
        {
          name: 'grep',
          classification: 'known-sensitive-unmanaged',
          reason: 'filesystem search can disclose content outside read-permission coverage (A2C-6 is deferred; no alpha.2 operation adapter)',
          remediation:
            'remove the tool with builtinToolDeny (or another capability-layer removal) or add a reviewed authority owner (an operation adapter)',
        },
        {
          name: 'zeta_magic',
          classification: 'unknown-unmanaged',
          reason: 'no reviewed authority owner is known for this tool (unknown semantics)',
          remediation:
            'remove the tool with builtinToolDeny or add a reviewed authority owner (a source-reviewed SAFE_UNMANAGED entry or an operation adapter)',
        },
      ],
    })
    expect(f1.errorName).toBe('PermissionCoverageUnmanagedError')
    expect(f1.errorCode).toBe('alpha2-permission-coverage-unmanaged-tools')
    // the detail round-trips losslessly on the error.
    expect(f1.errorDetail).toEqual(f1.detail)
    // the deterministic message (the sorted entries + the closed code).
    expect(f1.errorMessage).toBe(
      "permission coverage gate failed for instance 'inst-a2c2': 3 unmanaged tool(s) on the final model-facing surface: " +
        'foo_magic (unknown-unmanaged), grep (known-sensitive-unmanaged), zeta_magic (unknown-unmanaged) ' +
        '(code: alpha2-permission-coverage-unmanaged-tools)',
    )
    // the explicit presetId: null leg (never omitted).
    expect(f1.detailNullPresetPresetId).toBe(null)
    // the message is deterministic across the preset legs.
    expect(f1.errorNullPresetMessage).toBe(f1.errorMessage)
    // the type guard.
    expect(f1.guardTrue).toBe(true)
    expect(f1.guardFalse).toBe(false)
    // the instance identity is carried in the message.
    expect(f1.instanceGuard).toBe(true)
  })

  it('F2 · the real-seam FATAL lane — the exact glue chain (schemas(scopeOf) enumeration → evaluator) fails with exactly the unmanaged entries', () => {
    const f2 = R['f2'] as Record<string, any>
    expect(f2.present).toBe(true)
    expect(f2.surface).toEqual(['foo_magic', 'grep'])
    expect(f2.ok).toBe(false)
    expect(f2.unmanaged).toEqual([
      {
        name: 'foo_magic',
        classification: 'unknown-unmanaged',
        reason: 'no reviewed authority owner is known for this tool (unknown semantics)',
        remediation:
          'remove the tool with builtinToolDeny or add a reviewed authority owner (a source-reviewed SAFE_UNMANAGED entry or an operation adapter)',
      },
      {
        name: 'grep',
        classification: 'known-sensitive-unmanaged',
        reason: 'filesystem search can disclose content outside read-permission coverage (A2C-6 is deferred; no alpha.2 operation adapter)',
        remediation:
          'remove the tool with builtinToolDeny (or another capability-layer removal) or add a reviewed authority owner (an operation adapter)',
      },
    ])
  })

  it('F3 · the hidden-sensitive lane — builtinToolDeny (the public restrict seam) removes the sensitive tool before the gate runs: the same surface then PASSES', () => {
    const f3 = R['f3'] as Record<string, any>
    expect(f3.present).toBe(true)
    // without the mask: the inherited sensitive tool is on the surface
    // and the gate fails (the F2 contrast).
    expect(f3.surfaceWith).toEqual(['grep'])
    expect(f3.okWith).toBe(false)
    expect(f3.unmanagedWith).toEqual([
      {
        name: 'grep',
        classification: 'known-sensitive-unmanaged',
        reason: 'filesystem search can disclose content outside read-permission coverage (A2C-6 is deferred; no alpha.2 operation adapter)',
        remediation:
          'remove the tool with builtinToolDeny (or another capability-layer removal) or add a reviewed authority owner (an operation adapter)',
      },
    ])
    // with the REAL capability mask: the tool is gone and the surface
    // passes (the gate sees what the model sees).
    expect(f3.surfaceWithout).toEqual([])
    expect(f3.okWithout).toBe(true)
    expect(f3.unmanagedWithout).toEqual([])
  })
})

describe('a2c2 S · the real-seam legs (MCP delta, legacy enablement, lifecycle)', () => {
  it('S1 · the MCP delta on the REAL seam — the proven mount addition classifies OTHER_MANAGED_MCP and the surface PASSES', () => {
    const s1 = R['s1'] as Record<string, any>
    expect(s1.present).toBe(true)
    expect(s1.pre).toEqual(['bash', 'read'])
    expect(s1.fin).toEqual(['bash', 'mcp_weather', 'read'])
    expect(s1.delta).toEqual(['mcp_weather'])
    expect(s1.ok).toBe(true)
    expect(s1.tools).toEqual([
      { name: 'bash', classification: 'managed-operation-permission' },
      { name: 'mcp_weather', classification: 'other-managed-mcp' },
      { name: 'read', classification: 'managed-operation-permission' },
    ])
  })

  it('S2 · the strict-mode condition — the gate is ABSENT without capabilities.permissions (invariant §1.2: not disabled-quietly)', () => {
    const s2 = R['s2'] as Record<string, any>
    expect(s2.present).toBe(true)
    expect(s2.absentPolicy).toBe(false)
    expect(s2.strictPolicy).toBe(true)
  })

  it('S3 · the lifecycle invariant — the four bind-path surfaces (fresh/cold × root/member) give identical verdicts (PASS and FATAL variants)', () => {
    const s3 = R['s3'] as Record<string, any>
    expect(s3.present).toBe(true)
    // the shared inherited surface + the scope-own Team tool: every
    // scope's final surface is [read, team_delegate] — all owners
    // present, the verdict PASSES identically across all four scopes.
    expect(s3.passSurfaces).toEqual([
      ['read', 'team_delegate'],
      ['read', 'team_delegate'],
      ['read', 'team_delegate'],
      ['read', 'team_delegate'],
    ])
    expect(s3.passVerdictsIdentical).toBe(true)
    expect(s3.passVerdict?.ok).toBe(true)
    expect(s3.passVerdict?.tools).toEqual([
      { name: 'read', classification: 'managed-operation-permission' },
      { name: 'team_delegate', classification: 'other-managed-team-tool' },
    ])
    // the FATAL variant (sensitive + unknown added to every scope)
    // fails identically across all four scopes.
    expect(s3.fatalSurfaces).toEqual([
      ['foo_magic', 'grep', 'read', 'team_delegate'],
      ['foo_magic', 'grep', 'read', 'team_delegate'],
      ['foo_magic', 'grep', 'read', 'team_delegate'],
      ['foo_magic', 'grep', 'read', 'team_delegate'],
    ])
    expect(s3.fatalVerdictsIdentical).toBe(true)
    expect(s3.fatalVerdict?.ok).toBe(false)
    expect(s3.fatalVerdict?.unmanagedTools.map((e: any) => e.name)).toEqual(['foo_magic', 'grep'])
  })
})
