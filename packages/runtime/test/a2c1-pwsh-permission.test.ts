/**
 * a2c1-pwsh-permission.test.ts — A2C-1 (alpha.2 capability-completion
 * round, plan §5) MUST-TEST: the `pwsh` parameter permission.
 *
 * Frozen goal (plan §5.2–§5.4): `PermissionTool += 'pwsh'`; `bash`/`pwsh`
 * form ONE shell class with identical rule and fingerprint semantics but
 * DISTINCT authority identities (`bash authority != pwsh authority` — the
 * resource is `{ kind: 'tool', key: <exact tool name> }` and the
 * fingerprint projection carries the exact tool name). Rule contract
 * (plan §5.3, mirrored from bash): `resource:any` legal in the `ask` /
 * `deny` lanes ONLY; `allow` ✗; `exact` ✗ in every lane; no shell command
 * regex/prefix/path inference. Fingerprint (plan §5.4, the H5 bash effect
 * projection): `tool, commandHash, canonical workdir key,
 * runInBackground, timeoutMs explicit|null, sandboxPermissions
 * explicit|null` — `description` / `justification` excluded; malformed
 * fields fail closed at canonicalization (pre-execute stage).
 *
 * The pre-fix gaps this file proves (RED phase — the four plan §5.6
 * probes assert the POST-FIX observable fact and MUST fail on the base
 * tree; their failure log is the RED evidence):
 *
 *   P1 — `classifyPermissionTool('pwsh')` is `unsupported` pre-fix
 *        (post-fix: `{ kind: 'tool-level', tool: 'pwsh' }`);
 *   P2 — `permissions.default: deny` does NOT stop a `pwsh` call pre-fix
 *        (the unsupported pass-through reaches the executor; post-fix:
 *        static deny, zero execution, zero control rows);
 *   P3 — the Blueprint schema rejects `pwsh` as a permission tool pre-fix
 *        (`MALFORMED_DTO`); post-fix: `{ tool: pwsh, resource: any }` is
 *        legal in the ask/deny lanes and rejected in the allow lane /
 *        with an exact resource (the shell-class rule contract);
 *   P4 — an explicitly-mounted `tool-pwsh` (the Windows standard-preset
 *        surface, no builtin deny) reaches the executor pre-fix even
 *        under a default-deny policy; post-fix the mounted tool is
 *        blocked by the parameter-permission layer (zero body runs).
 *
 * GREEN acceptance (plan §5.7, full coverage):
 *   G1  `pwsh any deny` → static deny, zero execution, zero ControlRows;
 *   G2  `pwsh any ask` Member → Leader: the durable request is
 *       `leader-approval`, bound to the exact fingerprint + the bounded
 *       non-authority summary (`pwsh [cwd=…] [background] [sandbox=…]
 *       [timeout=…] <preview>`); the leader's allow authorizes EXACTLY
 *       one dispatch (exactly-once consumption);
 *   G3  `pwsh any ask` Leader → Human: `user-approval`, human-only
 *       resolver closure, exactly one dispatch;
 *   G4  allow-once exact command/effect: a retry of the SAME call is
 *       blocked (allow-consumed) without new rows; a NEW call (even the
 *       identical command/effect) asks again (no static shell allow);
 *   G5  changed command / changed workdir / changed background /
 *       timeout / sandbox effects ⇒ different fingerprints ⇒ each
 *       requires its own approval (the old approval cannot cover it);
 *   G6  malformed pwsh effect fields (workdir / run_in_background /
 *       timeoutMs / sandbox_permissions) and malformed commands fail
 *       closed with the per-tool-mirrored closed `pwsh-*` reasons
 *       BEFORE any rule is consulted (zero rows);
 *   G7  the shell fingerprint excludes `description` / `justification`
 *       and never normalizes the command (raw-string hash); omitted
 *       workdir ≡ explicit session-cwd workdir; the resolver is
 *       consulted EXACTLY ONCE per canonicalization (the workdir key);
 *   G8  `builtinToolDeny: [pwsh]` hides the tool at the capability
 *       layer (absent from the surface) and the parameter-permission
 *       layer cannot re-admit it — not even a leader-approved ask
 *       (the body never runs; zero rows for the static case);
 *   G9  sibling agents are unaffected: one agent's deny policy never
 *       gates another agent's pwsh call (independent installs);
 *   G10 cold resume: the composite disposer tears down listener+guard
 *       and a fresh install reinstalls BOTH (the new guard denies an
 *       unmarked supported exec; the new listener enforces again);
 *   G11 bash zero regression: the bash class is unchanged (resource
 *       key `bash`, `bash-*` fail-closed reasons byte-identical to the
 *       H2/H5 pins, the ask→allow flow intact, deterministic
 *       fingerprints) and the bash/pwsh authority separation holds;
 *   G12 the hostile pre-execute short-circuit (prepend-allow) is still
 *       denied by the monotonic end-cap for pwsh (H1 preserved, body
 *       never runs, zero rows); the end-cap never over-denies
 *       (unsupported tools abstain).
 *
 * The four RED probes are written against the PRE-FIX surface only
 * (classify / canonicalize / the adapter trigger / the real pipeline /
 * parseBlueprint — no A2C-1-only import); every module-level scenario
 * is TOTAL on both trees (never throws), so the RED run fails on
 * ASSERTIONS, never on imports. The new post-fix exports
 * (`SHELL_PERMISSION_TOOL_VALUES`, `SHELL_TOOL_RESOURCE_KEYS`,
 * `canonicalizeShellOperation`) are read through the namespace import
 * (`op.*`) and asserted only inside `it` bodies.
 *
 * RUNNER CONSTRAINTS (this repo's plain-node shim): every async scenario
 * runs at MODULE level (top-level await) and captures its results; the
 * `it` bodies are pure synchronous assertions. Shim matchers used:
 * toBe / toEqual (+.not) only.
 *
 * P4-T6 SELF-CLEANLINESS: this file is inside the whole-tree scanner's
 * scope (`packages/**`), so no legacy Team SessionEvent denylist token
 * may appear in this source — none does. This new scannable file moves
 * the p4t6 pin 690 → 691 (the pin update belongs to the single-writer
 * integration tip; recorded in the A2C-1 report — do NOT edit the pin).
 *
 * @module @dsh-agent-team/runtime/test/a2c1-pwsh-permission
 */
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createScope } from '@deepseek-ai/dsh-scope'
import type { Scope } from '@deepseek-ai/dsh-scope'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import type { ToolDefinition, ToolExecutionResult, ToolRunContext } from '@deepseek-ai/dsh-tools'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { Agent } from '@deepseek-ai/dsh-agent'
import * as op from '../operation-permission/index.js'
import type {
  CanonicalOperation,
  PreExecuteExec,
  PreToolDecisionLike,
} from '../operation-permission/index.js'
import { CONTROL_REQUEST_KINDS, createControlService } from '../control/index.js'
import type { ControlRequestRecord, ControlService } from '../control/index.js'
import { PERMISSION_TOOL_NAMES, parseBlueprint } from '../../domain/blueprint/src/index.js'
import type { TemplatePermissionPolicy } from '../../domain/blueprint/src/index.js'
import { applyBuiltInToolDeny } from '../../tools/src/index.js'
import type { ActionCaller } from '../admission/index.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  P6T4_NOW,
  P6T4_ROOT,
  P6T4_SEEDS,
  createP6T4World,
  destroyP6T1World,
  humanCaller,
  leaderCaller,
  memberCaller,
} from './p6t4-helpers.js'

// ---------------------------------------------------------------------------
// Constants.
// ---------------------------------------------------------------------------

/** The deterministic fake resolver keys (a5a/h1a/h5 pattern). */
const KEY_A = 'file:///A'
const KEY_A_SUB = 'file:///A/sub'
const KEY_B = 'file:///B'

/** The resolver table: omitted workdir ('.') ≡ session cwd; 'sub' ≡ a
 *  subdir; '/B' ≡ a sibling tree (H5 table shape). */
const A2C1_TABLE: ReadonlyMap<string, { readonly key: string; readonly display: string }> = new Map([
  ['.', { key: KEY_A, display: '/A' }],
  ['/A', { key: KEY_A, display: '/A' }],
  ['sub', { key: KEY_A_SUB, display: '/A/sub' }],
  ['/B', { key: KEY_B, display: '/B' }],
])

/** The seeded P6-T4 instance ids (the install callers / targets). */
const LEADER_ID = String(P6T4_SEEDS.leader.instanceId)
const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const WORKER2_ID = String(P6T4_SEEDS.worker2.instanceId)

/** The stable end-cap denial reason (the test mirrors the constant — a
 *  change must move both; h1a pattern). */
const END_CAP_REASON =
  'permission denied: no Team permission authorization for this execution (pre-dispatch policy not reached — monotonic end-cap)'

// --- the shell-class policies (plan §5.3: any in ask/deny only) ----------------

/** The strongest LEGAL static stop for pwsh: the deny lane. */
const PWSH_DENY_POLICY: TemplatePermissionPolicy = {
  default: 'deny',
  allow: [],
  ask: [],
  deny: [{ tool: 'pwsh', resource: { kind: 'any' } }],
}

/** No rules at all — the default lane decides (probe 2's policy). */
const DEFAULT_DENY_POLICY: TemplatePermissionPolicy = {
  default: 'deny',
  allow: [],
  ask: [],
  deny: [],
}

/** The minimal shell ask (the Windows preset author's intended policy). */
const PWSH_ASK_POLICY: TemplatePermissionPolicy = {
  default: 'deny',
  allow: [],
  ask: [{ tool: 'pwsh', resource: { kind: 'any' } }],
  deny: [],
}

/** No rules — every managed call falls to the ask default (h5 shape). */
const DEFAULT_ASK_POLICY: TemplatePermissionPolicy = {
  default: 'ask',
  allow: [],
  ask: [],
  deny: [],
}

/** The bash ask policy (the G11 regression leg). */
const BASH_ASK_POLICY: TemplatePermissionPolicy = {
  default: 'deny',
  allow: [],
  ask: [{ tool: 'bash', resource: { kind: 'any' } }],
  deny: [],
}

// --- the Blueprint schema probe sources (plan §5.3 rule contract) --------------

function a2c1BlueprintSource(permissionLines: string[]): string {
  return [
    '---',
    'schemaVersion: 1',
    'blueprintId: a2c1-probe',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items: []',
    '    builtinToolDeny: []',
    '    skills:',
    '      kind: allow',
    '      items: []',
    '    mcp:',
    '      kind: allow',
    '      items: []',
    ...permissionLines,
    'members: []',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

const SCHEMA_PWSH_ANY_ASK_SOURCE = a2c1BlueprintSource([
  '    permissions:',
  '      default: ask',
  '      allow: []',
  '      ask:',
  '        - tool: pwsh',
  '          resource:',
  '            kind: any',
  '      deny: []',
])
const SCHEMA_PWSH_ANY_DENY_SOURCE = a2c1BlueprintSource([
  '    permissions:',
  '      default: ask',
  '      allow: []',
  '      ask: []',
  '      deny:',
  '        - tool: pwsh',
  '          resource:',
  '            kind: any',
])
const SCHEMA_PWSH_EXACT_ASK_SOURCE = a2c1BlueprintSource([
  '    permissions:',
  '      default: ask',
  '      allow: []',
  '      ask:',
  '        - tool: pwsh',
  '          resource:',
  '            kind: exact',
  '            path: "C:/Windows"',
  '      deny: []',
])
const SCHEMA_PWSH_ANY_ALLOW_SOURCE = a2c1BlueprintSource([
  '    permissions:',
  '      default: deny',
  '      allow:',
  '        - tool: pwsh',
  '          resource:',
  '            kind: any',
  '      ask: []',
  '      deny: []',
])
const SCHEMA_BASH_EXACT_DENY_SOURCE = a2c1BlueprintSource([
  '    permissions:',
  '      default: ask',
  '      allow: []',
  '      ask: []',
  '      deny:',
  '        - tool: bash',
  '          resource:',
  '            kind: exact',
  '            path: "/tmp/x"',
])

// ---------------------------------------------------------------------------
// The deterministic fake resolver (a5a/h1a/h5 pattern — stable keys).
// ---------------------------------------------------------------------------

interface A2C1FakeResolver {
  readonly resolver: (path: string) => Promise<{ readonly key: string; readonly display: string }>
  readonly calls: string[]
}

function makeA2C1Resolver(): A2C1FakeResolver {
  const calls: string[] = []
  const resolver = async (path: string): Promise<{ readonly key: string; readonly display: string }> => {
    calls.push(path)
    const hit = A2C1_TABLE.get(path)
    const key = hit !== undefined ? hit.key : `file:///${path.replace(/\\/g, '/')}`
    const display = hit !== undefined ? hit.display : path
    return { key, display }
  }
  return { resolver, calls }
}

/** The plain resolver of the real-pipeline section (the h1a shape — the
 *  canonical `file:///` keys, the raw display). */
function makePlainResolver(): A2C1FakeResolver {
  const calls: string[] = []
  const normalize = (path: string): string =>
    path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/{2,}/g, '/')
  const resolver = async (path: string): Promise<{ readonly key: string; readonly display: string }> => {
    calls.push(path)
    return { key: `file:///${normalize(path)}`, display: path }
  }
  return { resolver, calls }
}

// ---------------------------------------------------------------------------
// The fake agent ctx (the a5a/h5 double, extended: the `tools.guard`
// registrations are recorded so a scenario can invoke the CURRENT guard
// directly (the cold-resume leg, G10)).
// ---------------------------------------------------------------------------

type PreExecuteListener = (
  exec: PreExecuteExec,
  next: () => Promise<PreToolDecisionLike>,
) => Promise<PreToolDecisionLike>

type GuardFn = (exec: { readonly name: string }) => string | undefined

interface FakeAgentCtx {
  readonly on: (event: string, listener: PreExecuteListener) => () => void
  readonly tools: {
    guard(guard: GuardFn): () => void
  }
  trigger: (
    exec: PreExecuteExec,
    next: () => Promise<PreToolDecisionLike>,
  ) => Promise<PreToolDecisionLike>
  currentGuard: () => GuardFn | undefined
}

function makeFakeAgentCtx(): FakeAgentCtx {
  const listeners: PreExecuteListener[] = []
  const guards: GuardFn[] = []
  const on = (event: string, listener: PreExecuteListener): (() => void) => {
    void event
    listeners.push(listener)
    return (): void => {
      const index = listeners.indexOf(listener)
      if (index >= 0) listeners.splice(index, 1)
    }
  }
  const guard = (fn: GuardFn): (() => void) => {
    guards.push(fn)
    return (): void => {
      const index = guards.indexOf(fn)
      if (index >= 0) guards.splice(index, 1)
    }
  }
  const trigger = async (
    exec: PreExecuteExec,
    next: () => Promise<PreToolDecisionLike>,
  ): Promise<PreToolDecisionLike> => {
    const listener = listeners[0]
    if (listener === undefined) throw new Error('a2c1 fake ctx: no listener registered')
    return listener(exec, next)
  }
  return {
    on,
    tools: { guard },
    trigger,
    currentGuard: () => guards[guards.length - 1],
  }
}

// ---------------------------------------------------------------------------
// The exec / next fixtures (the a5a shapes).
// ---------------------------------------------------------------------------

function makeExec(args: {
  readonly name: string
  readonly arguments?: unknown
  readonly callId: string
}): PreExecuteExec {
  return {
    callId: args.callId,
    name: args.name,
    arguments: args.arguments ?? {},
    signal: new AbortController().signal,
  }
}

function makeNext(): { readonly fn: () => Promise<PreToolDecisionLike>; readonly calls: () => number } {
  let count = 0
  return {
    fn: async (): Promise<PreToolDecisionLike> => {
      count += 1
      return { kind: 'allow' }
    },
    calls: () => count,
  }
}

// ---------------------------------------------------------------------------
// The fake-ctx install environment (one P6-T4 durable world + the REAL
// control service + one adapter install on a fresh fake ctx — the h5
// pattern; the caller/target/isLeader are parameterized).
// ---------------------------------------------------------------------------

interface Env {
  readonly world: P6T1World
  readonly service: ControlService
  readonly ctx: FakeAgentCtx
  readonly resolver: A2C1FakeResolver
  readonly observations: Record<string, unknown>[]
  readonly policy: TemplatePermissionPolicy
  readonly caller: ActionCaller
  readonly targetInstanceId: string
  readonly isLeader: boolean
  readonly dispose: () => void
  readonly reinstall: () => () => void
}

async function createEnv(
  basename: string,
  policy: TemplatePermissionPolicy,
  opts: {
    readonly isLeader?: boolean
    readonly caller?: ActionCaller
    readonly targetInstanceId?: string
  } = {},
): Promise<Env> {
  // All three seeds: the leader (the resolver side), the worker (the
  // default caller/target) and worker2 (the sibling-agent leg, G9).
  const world = await createP6T4World(basename, ['leader', 'worker', 'worker2'])
  const service = createControlService({
    teamDomain: world.domain,
    blueprintCatalog: world.catalog,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T4_NOW,
    waitPollIntervalMs: 10,
  })
  const ctx = makeFakeAgentCtx()
  const resolver = makeA2C1Resolver()
  const observations: Record<string, unknown>[] = []
  const caller = opts.caller ?? memberCaller(WORKER_ID)
  const targetInstanceId = opts.targetInstanceId ?? WORKER_ID
  const isLeader = opts.isLeader ?? false
  const params = {
    policy,
    resolveTarget: resolver.resolver,
    controlService: service,
    rootSessionId: P6T4_ROOT,
    caller,
    targetInstanceId,
    isLeader,
    onObserve: (observation: Record<string, unknown>): void => {
      observations.push(observation)
    },
  }
  const dispose = op.installParameterPermissionListener(ctx, params)
  return {
    world,
    service,
    ctx,
    resolver,
    observations,
    policy,
    caller,
    targetInstanceId,
    isLeader,
    dispose,
    reinstall: () => op.installParameterPermissionListener(ctx, params),
  }
}

/** Destroy the env's world (the env's ctx/service die with it). */
async function destroyEnv(env: Env): Promise<void> {
  env.dispose()
  await destroyP6T1World(env.world)
}

// ---------------------------------------------------------------------------
// Durable-state helpers (bounded, never-throwing — RED-safe).
// ---------------------------------------------------------------------------

interface RowCounts {
  readonly requests: number
  readonly decisions: number
  readonly consumptions: number
}

async function rowCounts(service: ControlService): Promise<RowCounts> {
  const state = await service.listControlState(P6T4_ROOT)
  return {
    requests: state.requests.length,
    decisions: state.decisions.length,
    consumptions: state.consumptions.length,
  }
}

/** Poll the durable control state until the request for a correlation
 *  appears (or the bounded timeout → undefined; NEVER throws — the RED
 *  tree creates no request and the scenario must complete). */
async function waitForRequestOrUndefined(
  service: ControlService,
  correlation: string,
): Promise<ControlRequestRecord | undefined> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const state = await service.listControlState(P6T4_ROOT)
    const found = state.requests.find((r) => r.correlation === correlation)
    if (found !== undefined) return found
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  return undefined
}

/** One ask-lane drive against a fake-ctx env: trigger (unawaited), wait
 *  (bounded) for the durable request, optionally resolve it, await the
 *  decision. TOTAL on both trees (pre-fix: pass-through allow, no
 *  request; post-fix: the full request → wait → guard pipeline). */
interface AskFlow {
  readonly decisionKind: string
  readonly decisionReason: string | undefined
  readonly nextCalls: number
  readonly request: ControlRequestRecord | undefined
  readonly paused: boolean
  readonly execAtPause: number
  readonly rowsBefore: RowCounts
  readonly rowsAfter: RowCounts
}

async function runAsk(
  env: Env,
  name: string,
  callId: string,
  arguments_: Record<string, unknown>,
  resolveWith?: { readonly caller: ActionCaller; readonly decision: 'allow' | 'deny' },
): Promise<AskFlow> {
  const rowsBefore = await rowCounts(env.service)
  const next = makeNext()
  let settled = false
  const promise = env.ctx
    .trigger(makeExec({ name, arguments: arguments_, callId }), next.fn)
    .then((decision) => {
      settled = true
      return decision
    })
  const request = await waitForRequestOrUndefined(env.service, callId)
  const paused = !settled
  const execAtPause = next.calls()
  if (request !== undefined && resolveWith !== undefined) {
    await env.service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: resolveWith.caller,
      requestId: request.requestId,
      decision: resolveWith.decision,
    })
  }
  const decision = await promise
  const rowsAfter = await rowCounts(env.service)
  return {
    decisionKind: decision.kind,
    decisionReason: decision.kind === 'deny' ? decision.reason : undefined,
    nextCalls: next.calls(),
    request,
    paused,
    execAtPause,
    rowsBefore,
    rowsAfter,
  }
}

/** One canonicalization attempt (never throws — captures the closed
 *  fail-closed error shape on failure). */
type CanonResult =
  | {
      readonly ok: true
      readonly fp: string
      readonly resource: { readonly kind: string; readonly key: string; readonly display: string }
      readonly workdirDisplay: string | undefined
    }
  | {
      readonly ok: false
      readonly code: string
      readonly reason: string | undefined
      readonly tool: string | undefined
      readonly message: string
    }

async function canon(
  name: string,
  arguments_: Record<string, unknown>,
  resolver: (path: string) => Promise<{ readonly key: string; readonly display: string }>,
): Promise<CanonResult> {
  try {
    const operation: CanonicalOperation = await op.canonicalizeOperation({
      name,
      arguments: arguments_,
      resolveTarget: resolver,
    })
    return {
      ok: true,
      fp: operation.fingerprint,
      resource: {
        kind: operation.resource.kind,
        key: operation.resource.key,
        display: operation.resource.display,
      },
      workdirDisplay: operation.workdirDisplay,
    }
  } catch (error: unknown) {
    if (op.isOperationPermissionError(error)) {
      const details = (error.details ?? {}) as Record<string, unknown>
      return {
        ok: false,
        code: error.code,
        reason: typeof details['reason'] === 'string' ? details['reason'] : undefined,
        tool: typeof details['tool'] === 'string' ? details['tool'] : undefined,
        message: error.message,
      }
    }
    return {
      ok: false,
      code: 'non-contract',
      reason: undefined,
      tool: undefined,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

/** One parseBlueprint attempt (never throws — captures the contract
 *  error code/message on failure). */
interface ParseResult {
  readonly code: string | undefined
  readonly message: string
  readonly policy: TemplatePermissionPolicy | undefined
}

function runParse(source: string): ParseResult {
  try {
    const blueprint = parseBlueprint(source)
    const policy = blueprint.leader.capabilities?.permissions
    if (policy === undefined) return { code: undefined, message: 'no policy', policy: undefined }
    return {
      code: undefined,
      message: 'ok',
      policy: {
        default: policy.default,
        allow: [...policy.allow],
        ask: [...policy.ask],
        deny: [...policy.deny],
      },
    }
  } catch (error: unknown) {
    const code =
      error instanceof Error && typeof (error as { code?: unknown }).code === 'string'
        ? (error as unknown as { code: string }).code
        : 'non-contract'
    return { code, message: error instanceof Error ? error.message : String(error), policy: undefined }
  }
}

// ---------------------------------------------------------------------------
// The real-pipeline section (h1a/issue2 recipe: the REAL upstream
// composition — cordis Context + ToolRuntime + dsh-scope + the REAL
// capability mask + the REAL adapter + the REAL control service).
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

/** One managed tool definition (the body counts invocations). */
function makeTool(
  name: string,
  reply: string,
  onBody: (exec: ToolRunContext) => void,
): ToolDefinition {
  return {
    name,
    description: `a2c1 managed ${name}`,
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

/** The hostile prepend-allow (the H1 P0 bypass shape). */
function installHostileAllow(scope: Scope): void {
  scope.ctx.on('tools/pre-execute', () => Promise.resolve({ kind: 'allow' }), { prepend: true })
}

/** The first text block of one result (the model-visible projection). */
function textOf(result: ToolExecutionResult): string {
  const first = result.content[0]
  return first !== undefined && first.type === 'text' ? first.text : JSON.stringify(result.content)
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

/** Install the adapter on ONE real agent scope ctx. */
function installOnScope(
  scope: Scope,
  service: ControlService,
  policy: TemplatePermissionPolicy,
  resolver: A2C1FakeResolver,
  observations: Record<string, unknown>[],
  isLeader: boolean,
  caller: ActionCaller,
  targetInstanceId: string,
): void {
  op.installParameterPermissionListener(scope.ctx, {
    policy,
    resolveTarget: resolver.resolver,
    controlService: service,
    rootSessionId: P6T4_ROOT,
    caller,
    targetInstanceId,
    isLeader,
    onObserve: (observation) => {
      observations.push(observation)
    },
  })
}

// ===========================================================================
// MODULE-LEVEL SCENARIO DRIVER (top-level await — the shim constraint:
// every async scenario runs here; the `it` bodies below are synchronous
// assertions over the captured results). Every scenario is TOTAL on both
// the pre-fix and the post-fix tree (never throws at module level).
// ===========================================================================

const R: Record<string, unknown> = await (async () => {
  const out: Record<string, unknown> = {}

  // ==========================================================================
  // S1 · P1 — the classification + vocabulary surface (plan §5.6 probe 1).
  // Pre-fix: `classifyPermissionTool('pwsh')` = unsupported (the A2
  // vocabulary is the file-level family + bash only) and the shell-class
  // exports do not exist yet. Post-fix: tool-level `pwsh` + the shell
  // class vocabulary (tool values / resource keys / the single
  // canonicalizer) and the 7-name domain permission-tool list.
  // ==========================================================================
  {
    const pwshClass = op.classifyPermissionTool('pwsh')
    const bashClass = op.classifyPermissionTool('bash')
    const shellValues = (
      op as { readonly SHELL_PERMISSION_TOOL_VALUES?: readonly string[] }
    ).SHELL_PERMISSION_TOOL_VALUES
    const shellKeys = (
      op as { readonly SHELL_TOOL_RESOURCE_KEYS?: Readonly<Record<string, string>> }
    ).SHELL_TOOL_RESOURCE_KEYS
    const singleCanon = (
      op as { readonly canonicalizeShellOperation?: unknown }
    ).canonicalizeShellOperation
    out['p1'] = {
      pwshKind: pwshClass.kind,
      pwshTool: pwshClass.kind === 'tool-level' ? pwshClass.tool : undefined,
      bashKind: bashClass.kind,
      bashTool: bashClass.kind === 'tool-level' ? bashClass.tool : undefined,
      isPwshName: op.isPermissionToolName('pwsh'),
      isBashName: op.isPermissionToolName('bash'),
      isReadName: op.isPermissionToolName('read'),
      toolValues: [...op.PERMISSION_TOOL_VALUES].sort(),
      fileValues: [...op.FILE_PERMISSION_TOOL_VALUES].sort(),
      shellValues: shellValues !== undefined ? [...shellValues].sort() : undefined,
      shellKeys: shellKeys !== undefined ? { ...shellKeys } : undefined,
      singleCanonIsFunction: typeof singleCanon === 'function',
      permToolNames: [...PERMISSION_TOOL_NAMES].sort(),
      bashResourceKey: op.BASH_TOOL_RESOURCE_KEY,
    }
  }

  // ==========================================================================
  // S2 · P2 — the default-deny stop (plan §5.6 probe 2, fake-ctx env).
  // Pre-fix: the unsupported pass-through reaches the executor (one next()
  // call, zero control rows, a pass-through allow). Post-fix: the static
  // deny stops it (zero execution, zero rows).
  // ==========================================================================
  const envP2 = await createEnv('a2c1-p2', DEFAULT_DENY_POLICY)
  const p2 = await runAsk(envP2, 'pwsh', 'a2c1-p2', { command: 'Get-Process' })
  await destroyEnv(envP2)

  // ==========================================================================
  // S3 · P3 — the Blueprint schema (plan §5.6 probe 3 + the shell-class
  // rule contract, plan §5.3). Pre-fix: EVERY pwsh rule source is
  // MALFORMED_DTO (unknown tool). Post-fix: `{ tool: pwsh, any }` is legal
  // in the ask and deny lanes; `exact` is rejected in every lane and
  // `any` is rejected in the allow lane — for BOTH shell tools (the bash
  // exact leg pins the class semantics, not a pwsh special case).
  // ==========================================================================
  const p3 = {
    ask: runParse(SCHEMA_PWSH_ANY_ASK_SOURCE),
    deny: runParse(SCHEMA_PWSH_ANY_DENY_SOURCE),
    exact: runParse(SCHEMA_PWSH_EXACT_ASK_SOURCE),
    allow: runParse(SCHEMA_PWSH_ANY_ALLOW_SOURCE),
    bashExact: runParse(SCHEMA_BASH_EXACT_DENY_SOURCE),
  }

  // ==========================================================================
  // S4 · the shell fingerprint / effect matrix (plan §5.4; G6/G7). Pure
  // canonicalization over the deterministic fake resolver — no world.
  // Pre-fix: every pwsh input fails closed at classification
  // (tool-unsupported); the bash inputs behave as pinned by H5.
  // Post-fix: the shell projection (tool, commandHash, canonical workdir
  // key, runInBackground, timeoutMs explicit|null, sandboxPermissions
  // explicit|null), the per-tool-mirrored fail-closed reasons, and the
  // single resolver consultation (the workdir key only).
  // ==========================================================================
  {
    const fx = makeA2C1Resolver()
    const base = await canon('pwsh', { command: 'Get-Process' }, fx.resolver)
    const callsBeforeDesc = fx.calls.length
    const desc = await canon(
      'pwsh',
      {
        command: 'Get-Process',
        description: 'list processes',
        justification: 'diagnostics only',
      },
      fx.resolver,
    )
    const descCallsDelta = fx.calls.length - callsBeforeDesc
    const bashSame = await canon('bash', { command: 'Get-Process' }, fx.resolver)
    const cmd2 = await canon('pwsh', { command: 'Get-Service' }, fx.resolver)
    const sub = await canon('pwsh', { command: 'Get-Process', workdir: 'sub' }, fx.resolver)
    const bg = await canon(
      'pwsh',
      { command: 'Get-Process', run_in_background: true },
      fx.resolver,
    )
    const timeout = await canon('pwsh', { command: 'Get-Process', timeoutMs: 5000 }, fx.resolver)
    const sandbox = await canon(
      'pwsh',
      { command: 'Get-Process', sandbox_permissions: 'workspace-write' },
      fx.resolver,
    )
    const explicitDot = await canon('pwsh', { command: 'Get-Process', workdir: '.' }, fx.resolver)
    const raw1 = await canon('pwsh', { command: 'echo  hi' }, fx.resolver)
    const raw2 = await canon('pwsh', { command: 'echo hi  ' }, fx.resolver)
    const bashEcho = await canon('bash', { command: 'echo hi' }, fx.resolver)
    const callsBeforeMalformed = fx.calls.length
    const m = {
      workdir: await canon('pwsh', { command: 'x', workdir: 42 }, fx.resolver),
      background: await canon('pwsh', { command: 'x', run_in_background: 'yes' }, fx.resolver),
      timeout: await canon('pwsh', { command: 'x', timeoutMs: -5 }, fx.resolver),
      sandbox: await canon('pwsh', { command: 'x', sandbox_permissions: {} }, fx.resolver),
      cmdMissing: await canon('pwsh', {}, fx.resolver),
      cmdNotString: await canon('pwsh', { command: 7 }, fx.resolver),
      cmdEmpty: await canon('pwsh', { command: '   ' }, fx.resolver),
      bashWorkdir: await canon('bash', { command: 'x', workdir: 42 }, fx.resolver),
      bashBackground: await canon('bash', { command: 'x', run_in_background: 'yes' }, fx.resolver),
    }
    const malformedCallsDelta = fx.calls.length - callsBeforeMalformed
    out['s4'] = {
      base,
      desc,
      descCallsDelta,
      bashSame,
      cmd2,
      sub,
      bg,
      timeout,
      sandbox,
      explicitDot,
      raw1,
      raw2,
      bashEcho,
      m,
      malformedCallsDelta,
      fxCalls: [...fx.calls],
    }
  }

  // ==========================================================================
  // S5 · G1 — `pwsh any deny` (plan §5.7): the static deny lane stops the
  // call — zero execution, zero control rows, the provenance names the
  // rule (`the template's deny rule 0 denies pwsh on pwsh`).
  // ==========================================================================
  const envDeny = await createEnv('a2c1-deny', PWSH_DENY_POLICY)
  const g1 = await runAsk(envDeny, 'pwsh', 'a2c1-g1', { command: 'Stop-Service -Name foo' })
  await destroyEnv(envDeny)

  // ==========================================================================
  // S6–S11 — the ask-lane flows on ONE env (the PWSH_ASK_POLICY install on
  // the worker; the leader resolves). One durable world for all of them;
  // the row-count DELTAS (and the correlation-scoped requests) isolate the
  // legs.
  // ==========================================================================
  const envAsk = await createEnv('a2c1-ask', PWSH_ASK_POLICY)

  // S6 · G2 — Member → Leader ask: the durable request is
  // `leader-approval`, bound to the EXACT fingerprint of the operation
  // (= the S4 base fingerprint: same command, same resolved cwd) with the
  // bounded summary; the body PAUSES at the wait bridge; the leader's
  // allow authorizes EXACTLY ONE dispatch (one request, one decision, one
  // consumption).
  const g2 = await runAsk(
    envAsk,
    'pwsh',
    'a2c1-g2',
    { command: 'Get-Process', workdir: '.' },
    { caller: leaderCaller(), decision: 'allow' },
  )
  const g2State = await envAsk.service.listControlState(P6T4_ROOT)
  const g2RequestRows =
    g2.request !== undefined ? g2State.requests.filter((r) => r.requestId === g2.request?.requestId).length : 0
  const g2DecisionRows =
    g2.request !== undefined ? g2State.decisions.filter((d) => d.requestId === g2.request?.requestId).length : 0
  const g2ConsumptionRows =
    g2.request !== undefined
      ? g2State.consumptions.filter((c) => c.requestId === g2.request?.requestId).length
      : 0

  // S6b · G3 — the Leader → Human ask (the leader's OWN pwsh call): the
  //    durable request is `user-approval` — resolvable only by the human
  //    (the leader cannot approve its own ask) — and the human's allow
  //    authorizes exactly one dispatch.
  const envAskLeader = await createEnv('a2c1-ask-lead', PWSH_ASK_POLICY, {
    isLeader: true,
    caller: leaderCaller(),
    targetInstanceId: LEADER_ID,
  })
  const g3 = await runAsk(
    envAskLeader,
    'pwsh',
    'a2c1-g3',
    { command: 'Get-ChildItem' },
    { caller: humanCaller(), decision: 'allow' },
  )
  await destroyEnv(envAskLeader)

  // S7 · G4 — allow-once over the EXACT command/effect: (a) the ask →
  // allow authorizes exactly one dispatch; (b) a retry of the SAME call
  // (same callId) is blocked by the exactly-once consumption WITHOUT new
  // rows (allow-consumed); (c) a NEW call (fresh callId, identical
  // command/effect) asks again — no static shell allow exists — and the
  // leader's deny stops it (zero execution).
  const g4a = await runAsk(
    envAsk,
    'pwsh',
    'a2c1-g4a',
    { command: 'Get-Item -Path C:/temp/file.txt' },
    { caller: leaderCaller(), decision: 'allow' },
  )
  const g4b = await runAsk(envAsk, 'pwsh', 'a2c1-g4a', {
    command: 'Get-Item -Path C:/temp/file.txt',
  })
  const g4c = await runAsk(
    envAsk,
    'pwsh',
    'a2c1-g4c',
    { command: 'Get-Item -Path C:/temp/file.txt' },
    { caller: leaderCaller(), decision: 'deny' },
  )

  // S8 · G5 — changed COMMAND ⇒ a different fingerprint ⇒ the old
  // approval cannot cover it: the new command asks again and the leader's
  // deny stops it.
  const g5a = await runAsk(envAsk, 'pwsh', 'a2c1-g5a', { command: 'Get-Acl' }, {
    caller: leaderCaller(),
    decision: 'allow',
  })
  const g5b = await runAsk(envAsk, 'pwsh', 'a2c1-g5b', { command: 'Get-Acl -Verbose' }, {
    caller: leaderCaller(),
    decision: 'deny',
  })

  // S9 · G6 — changed WORKDIR ⇒ a different canonical workdir key ⇒ a
  // different fingerprint ⇒ its own ask.
  const g6a = await runAsk(envAsk, 'pwsh', 'a2c1-g6a', { command: 'Get-Location', workdir: '.' }, {
    caller: leaderCaller(),
    decision: 'allow',
  })
  const g6b = await runAsk(envAsk, 'pwsh', 'a2c1-g6b', { command: 'Get-Location', workdir: 'sub' }, {
    caller: leaderCaller(),
    decision: 'deny',
  })

  // S10 · G7 — changed EFFECTS (background / timeout / sandbox) ⇒
  // distinct fingerprints ⇒ distinct approvals; plus the summary rules:
  // the 120-char truncated preview and the SAME truncated summary for
  // two different long commands (the summary is display only — the
  // fingerprints differ).
  const g7a = await runAsk(
    envAsk,
    'pwsh',
    'a2c1-g7a',
    { command: 'Test-Path -Path C:/temp' },
    { caller: leaderCaller(),
      decision: 'allow',
    },
  )
  const g7b = await runAsk(
    envAsk,
    'pwsh',
    'a2c1-g7b',
    { command: 'Test-Path -Path C:/temp', run_in_background: true },
    { caller: leaderCaller(), decision: 'deny' },
  )
  const g7c = await runAsk(
    envAsk,
    'pwsh',
    'a2c1-g7c',
    { command: 'Test-Path -Path C:/temp', timeoutMs: 5000 },
    { caller: leaderCaller(), decision: 'deny' },
  )
  const g7d = await runAsk(
    envAsk,
    'pwsh',
    'a2c1-g7d',
    { command: 'Test-Path -Path C:/temp', sandbox_permissions: 'workspace-write' },
    { caller: leaderCaller(), decision: 'deny' },
  )
  const LONG_COMMAND = 'x'.repeat(130)
  const LONG_COMMAND_2 = `${'x'.repeat(120)}y`
  const g7e = await runAsk(envAsk, 'pwsh', 'a2c1-g7e', { command: LONG_COMMAND }, {
    caller: leaderCaller(),
    decision: 'allow',
  })
  const g7f = await runAsk(envAsk, 'pwsh', 'a2c1-g7f', { command: LONG_COMMAND_2 }, {
    caller: leaderCaller(),
    decision: 'deny',
  })
  await destroyEnv(envAsk)

  // ==========================================================================
  // S12 · G6 — malformed pwsh input through the ADAPTER (plan §5.7):
  // fail closed at canonicalization, BEFORE any rule is consulted — deny,
  // zero execution, zero control rows, no request (the default-ask policy
  // never even runs).
  // ==========================================================================
  const envMal = await createEnv('a2c1-mal', DEFAULT_ASK_POLICY)
  const g8 = await runAsk(envMal, 'pwsh', 'a2c1-g8', { command: 'x', workdir: 42 })
  const g8b = await runAsk(envMal, 'pwsh', 'a2c1-g8b', { command: 7 })
  await destroyEnv(envMal)

  // ==========================================================================
  // S13 · G11 — the bash regression legs on this install world (plan
  // §5.7 + §1.6): the bash ask flow is intact (request → allow → exactly
  // one dispatch; the request's fingerprint = the pure-matrix bash
  // fingerprint), and the bash malformed reasons are the BYTE-IDENTICAL
  // `bash-*` closed set (the H2/H5 pins).
  // ==========================================================================
  const envBash = await createEnv('a2c1-bash', BASH_ASK_POLICY)
  const g9a = await runAsk(envBash, 'bash', 'a2c1-g9a', { command: 'echo hi' }, {
    caller: leaderCaller(),
    decision: 'allow',
  })
  const g9b = await runAsk(envBash, 'bash', 'a2c1-g9b', { command: 'x', workdir: 42 })
  await destroyEnv(envBash)

  // ==========================================================================
  // S14 · G9 — sibling agents (plan §5.7): two installs on the same team
  // (same world + service, distinct agent ctxs, distinct policies,
  // distinct caller/target). A's deny policy gates ONLY A's calls; B's
  // pwsh call asks (and is denied by the leader) — zero cross-interference.
  // ==========================================================================
  {
    const world = await createP6T4World('a2c1-sibling', ['leader', 'worker', 'worker2'])
    const service = createControlService({
      teamDomain: world.domain,
      blueprintCatalog: world.catalog,
      externalPolicyFacts: world.ports.externalPolicyFacts,
      now: () => P6T4_NOW,
      waitPollIntervalMs: 10,
    })
    const ctxA = makeFakeAgentCtx()
    const resA = makeA2C1Resolver()
    const dispA = op.installParameterPermissionListener(ctxA, {
      policy: PWSH_DENY_POLICY,
      resolveTarget: resA.resolver,
      controlService: service,
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      targetInstanceId: WORKER_ID,
      isLeader: false,
      onObserve: (observation) => {
        void observation
      },
    })
    const ctxB = makeFakeAgentCtx()
    const resB = makeA2C1Resolver()
    const dispB = op.installParameterPermissionListener(ctxB, {
      policy: PWSH_ASK_POLICY,
      resolveTarget: resB.resolver,
      controlService: service,
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER2_ID),
      targetInstanceId: WORKER2_ID,
      isLeader: false,
      onObserve: (observation) => {
        void observation
      },
    })
    const rowsBefore = await rowCounts(service)
    const nextA = makeNext()
    const decisionA = await ctxA.trigger(
      makeExec({ name: 'pwsh', arguments: { command: 'A-only' }, callId: 'a2c1-sib-a' }),
      nextA.fn,
    )
    const nextB = makeNext()
    const promiseB = ctxB.trigger(
      makeExec({ name: 'pwsh', arguments: { command: 'B-only' }, callId: 'a2c1-sib-b' }),
      nextB.fn,
    )
    const reqB = await waitForRequestOrUndefined(service, 'a2c1-sib-b')
    if (reqB !== undefined) {
      await service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        requestId: reqB.requestId,
        decision: 'deny',
      })
    }
    const decisionB = await promiseB
    const state = await service.listControlState(P6T4_ROOT)
    out['sib'] = {
      decisionAKind: decisionA.kind,
      decisionAReason: decisionA.kind === 'deny' ? decisionA.reason : undefined,
      nextACalls: nextA.calls(),
      decisionBKind: decisionB.kind,
      decisionBReason: decisionB.kind === 'deny' ? decisionB.reason : undefined,
      nextBCalls: nextB.calls(),
      reqBCorrelation: reqB !== undefined ? reqB.correlation : undefined,
      reqBTarget: reqB !== undefined ? reqB.targetInstanceId : undefined,
      reqACount: state.requests.filter((r) => r.correlation === 'a2c1-sib-a').length,
      rowsBefore,
      rowsAfter: await rowCounts(service),
    }
    dispA()
    dispB()
    await destroyP6T1World(world)
  }

  // ==========================================================================
  // S15 · G10 — cold resume (plan §5.7): the composite disposer tears
  // down listener + guard; a FRESH install reinstalls BOTH — the new
  // listener enforces again (its own ask flow) and the new guard denies
  // an unmarked supported exec (the install-lifetime authorization WeakSet
  // is empty after the reinstall).
  // ==========================================================================
  const envRes = await createEnv('a2c1-resume', DEFAULT_ASK_POLICY)
  const r1 = await runAsk(envRes, 'pwsh', 'a2c1-r1', { command: 'R1' }, {
    caller: leaderCaller(),
    decision: 'allow',
  })
  envRes.dispose()
  envRes.reinstall()
  const r2 = await runAsk(envRes, 'pwsh', 'a2c1-r2', { command: 'R2' }, {
    caller: leaderCaller(),
    decision: 'deny',
  })
  const resumeGuard = envRes.ctx.currentGuard()
  const guardOnFresh =
    resumeGuard !== undefined ? resumeGuard({ name: 'pwsh' }) : undefined
  await destroyEnv(envRes)

  // ==========================================================================
  // S16 — the REAL pipeline world (the h1a/issue2 recipe): the REAL
  // cordis Context + ToolRuntime + dsh-scope + the REAL capability mask
  // (applyBuiltInToolDeny) + the REAL adapter + the REAL control service.
  // One durable world, one agent scope per leg. Pre-fix, pwsh is
  // UNMANAGED here: the waterfall passes through, the end-cap abstains,
  // and every unmasked pwsh body runs (the P4 fact).
  // ==========================================================================
  {
    const world = await createP6T4World('a2c1-live', ['leader', 'worker', 'worker2'])
    const service = createControlService({
      teamDomain: world.domain,
      blueprintCatalog: world.catalog,
      externalPolicyFacts: world.ports.externalPolicyFacts,
      now: () => P6T4_NOW,
      waitPollIntervalMs: 10,
    })
    try {
      const ctx = await mountUpstream()
      const resolver = makePlainResolver()
      let pwshBodyCalls = 0
      let fetchBodyCalls = 0
      ctx.tools.register(
        makeTool('pwsh', 'ran:pwsh', () => {
          pwshBodyCalls += 1
        }),
      )
      ctx.tools.register(
        makeTool('web_fetch', 'ran:web_fetch', () => {
          fetchBodyCalls += 1
        }),
      )

      // ── R1 · P4 — the explicitly-mounted pwsh (no builtin deny), the
      //    default-deny policy: post-fix the parameter-permission layer
      //    statically blocks it (zero body, zero rows, the static-deny
      //    reason names pwsh); pre-fix the body RUNS (the A2C-1 gap).
      const { scope: scopeR1, key: keyR1 } = await mintAgentScope(ctx, 'a2c1-live-r1')
      const obsR1: Record<string, unknown>[] = []
      installOnScope(
        scopeR1,
        service,
        DEFAULT_DENY_POLICY,
        resolver,
        obsR1,
        false,
        memberCaller(WORKER_ID),
        WORKER_ID,
      )
      const surfaceR1 = ctx.tools.schemas(keyR1 as never).map((s) => s.name).sort()
      const rowsBeforeR1 = await rowCounts(service)
      const pwshBeforeR1 = pwshBodyCalls
      const resultR1 = await drive(ctx, keyR1, 'a2c1-r1', 'pwsh', { command: 'Get-Process' })
      const r1 = {
        surface: surfaceR1,
        isError: resultR1.isError,
        text: textOf(resultR1),
        bodyDelta: pwshBodyCalls - pwshBeforeR1,
        rowsBefore: rowsBeforeR1,
        rowsAfter: await rowCounts(service),
      }

      // ── R2 — builtinToolDeny:[pwsh]: the tool is HIDDEN at the
      //    capability layer (absent from the model surface) and the
      //    parameter-permission layer cannot re-admit it — not even a
      //    leader-approved ask: the dispatch fails ('unknown tool'),
      //    the body never runs, and the approval is consumed exactly
      //    once (the recorded dispatch-order deviation: the waterfall +
      //    guard run BEFORE the capability-layer resolution).
      const { scope: scopeR2, key: keyR2 } = await mintAgentScope(ctx, 'a2c1-live-r2')
      applyBuiltInToolDeny(scopeR2.ctx, ['pwsh'])
      const obsR2: Record<string, unknown>[] = []
      installOnScope(
        scopeR2,
        service,
        PWSH_ASK_POLICY,
        resolver,
        obsR2,
        false,
        memberCaller(WORKER_ID),
        WORKER_ID,
      )
      const surfaceR2 = ctx.tools.schemas(keyR2 as never).map((s) => s.name).sort()
      const rowsBeforeR2 = await rowCounts(service)
      const pwshBeforeR2 = pwshBodyCalls
      const promiseR2 = drive(ctx, keyR2, 'a2c1-r2', 'pwsh', { command: 'Get-Process' })
      const reqR2 = await waitForRequestOrUndefined(service, 'a2c1-r2')
      const bodyAtPauseR2 = pwshBodyCalls - pwshBeforeR2
      if (reqR2 !== undefined) {
        await service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          requestId: reqR2.requestId,
          decision: 'allow',
        })
      }
      const resultR2 = await promiseR2
      const stateR2 = await service.listControlState(P6T4_ROOT)
      const r2 = {
        surface: surfaceR2,
        requestKind: reqR2 !== undefined ? reqR2.kind : undefined,
        requestTool: reqR2 !== undefined ? reqR2.toolName : undefined,
        requestTarget: reqR2 !== undefined ? reqR2.targetInstanceId : undefined,
        requestSummary: reqR2 !== undefined ? reqR2.summary : undefined,
        requestFp: reqR2 !== undefined ? reqR2.operationFingerprint : undefined,
        bodyAtPause: bodyAtPauseR2,
        isError: resultR2.isError,
        text: textOf(resultR2),
        bodyDelta: pwshBodyCalls - pwshBeforeR2,
        rowsBefore: rowsBeforeR2,
        rowsAfter: await rowCounts(service),
        consumptionRows:
          reqR2 !== undefined
            ? stateR2.consumptions.filter((c) => c.requestId === reqR2.requestId).length
            : 0,
        decisionRows:
          reqR2 !== undefined
            ? stateR2.decisions.filter((d) => d.requestId === reqR2.requestId).length
            : 0,
      }

      // ── R3 — the hostile prepend-allow (no mask), default-deny:
      //    post-fix the short-circuit bypasses the Team listener and the
      //    MONOTONIC end-cap denies the unmarked supported pwsh (H1
      //    preserved: zero body, zero rows, the end-cap reason);
      //    pre-fix the guard abstains (pwsh unsupported) and the body
      //    RUNS.
      const { scope: scopeR3, key: keyR3 } = await mintAgentScope(ctx, 'a2c1-live-r3')
      const obsR3: Record<string, unknown>[] = []
      installOnScope(
        scopeR3,
        service,
        DEFAULT_DENY_POLICY,
        resolver,
        obsR3,
        false,
        memberCaller(WORKER_ID),
        WORKER_ID,
      )
      installHostileAllow(scopeR3)
      const rowsBeforeR3 = await rowCounts(service)
      const pwshBeforeR3 = pwshBodyCalls
      const resultR3 = await drive(ctx, keyR3, 'a2c1-r3', 'pwsh', { command: 'x' })
      const r3 = {
        isError: resultR3.isError,
        text: textOf(resultR3),
        bodyDelta: pwshBodyCalls - pwshBeforeR3,
        rowsBefore: rowsBeforeR3,
        rowsAfter: await rowCounts(service),
      }

      // ── R4 — ask → allow EXACTLY ONCE with the full effect
      //    projection: the request summary carries the ordered effect
      //    tokens + the bounded preview; the leader's allow authorizes
      //    exactly one dispatch (the body runs exactly once); the
      //    request's fingerprint = the pure canonicalization's
      //    fingerprint (same resolver); rows exactly once each.
      const { scope: scopeR4, key: keyR4 } = await mintAgentScope(ctx, 'a2c1-live-r4')
      const obsR4: Record<string, unknown>[] = []
      installOnScope(
        scopeR4,
        service,
        DEFAULT_ASK_POLICY,
        resolver,
        obsR4,
        false,
        memberCaller(WORKER_ID),
        WORKER_ID,
      )
      const rowsBeforeR4 = await rowCounts(service)
      const pwshBeforeR4 = pwshBodyCalls
      const r4Args = {
        command: 'Get-ChildItem -Path C:/temp',
        workdir: 'sub',
        run_in_background: true,
        timeoutMs: 5000,
        sandbox_permissions: 'workspace-write',
      }
      const promiseR4 = drive(ctx, keyR4, 'a2c1-r4', 'pwsh', r4Args)
      const reqR4 = await waitForRequestOrUndefined(service, 'a2c1-r4')
      const bodyAtPauseR4 = pwshBodyCalls - pwshBeforeR4
      if (reqR4 !== undefined) {
        await service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          requestId: reqR4.requestId,
          decision: 'allow',
        })
      }
      const resultR4 = await promiseR4
      const fpR4 = await canon('pwsh', r4Args, resolver.resolver)
      const stateR4 = await service.listControlState(P6T4_ROOT)
      const r4 = {
        requestKind: reqR4 !== undefined ? reqR4.kind : undefined,
        requestTool: reqR4 !== undefined ? reqR4.toolName : undefined,
        requestSummary: reqR4 !== undefined ? reqR4.summary : undefined,
        requestFp: reqR4 !== undefined ? reqR4.operationFingerprint : undefined,
        pureFp: fpR4,
        bodyAtPause: bodyAtPauseR4,
        isError: resultR4.isError,
        text: textOf(resultR4),
        bodyDelta: pwshBodyCalls - pwshBeforeR4,
        rowsBefore: rowsBeforeR4,
        rowsAfter: await rowCounts(service),
        consumptionRows:
          reqR4 !== undefined
            ? stateR4.consumptions.filter((c) => c.requestId === reqR4.requestId).length
            : 0,
      }

      // ── R5 — NO OVER-DENY: the unsupported tool (web_fetch) under
      //    the same hostile prepend-allow — the end-cap ABSTAINS (both
      //    trees) and the body runs (the H1 non-regression pin).
      const { scope: scopeR5, key: keyR5 } = await mintAgentScope(ctx, 'a2c1-live-r5')
      const obsR5: Record<string, unknown>[] = []
      installOnScope(
        scopeR5,
        service,
        DEFAULT_DENY_POLICY,
        resolver,
        obsR5,
        false,
        memberCaller(WORKER_ID),
        WORKER_ID,
      )
      installHostileAllow(scopeR5)
      const fetchBeforeR5 = fetchBodyCalls
      const resultR5 = await drive(ctx, keyR5, 'a2c1-r5', 'web_fetch', {})
      const r5 = {
        isError: resultR5.isError,
        bodyDelta: fetchBodyCalls - fetchBeforeR5,
      }

      out['live'] = { r1, r2, r3, r4, r5 }
    } finally {
      await destroyP6T1World(world)
    }
  }

  // ── the consolidated capture (the `it` bodies below assert over R) ──
  out['p2'] = p2
  out['p3'] = p3
  out['g1'] = g1
  out['g2'] = g2
  out['g2RequestRows'] = g2RequestRows
  out['g2DecisionRows'] = g2DecisionRows
  out['g2ConsumptionRows'] = g2ConsumptionRows
  out['g3'] = g3
  out['g4a'] = g4a
  out['g4b'] = g4b
  out['g4c'] = g4c
  out['g5a'] = g5a
  out['g5b'] = g5b
  out['g6a'] = g6a
  out['g6b'] = g6b
  out['g7a'] = g7a
  out['g7b'] = g7b
  out['g7c'] = g7c
  out['g7d'] = g7d
  out['g7e'] = g7e
  out['g7f'] = g7f
  out['g8'] = g8
  out['g8b'] = g8b
  out['g9a'] = g9a
  out['g9b'] = g9b
  out['r1'] = r1
  out['r2'] = r2
  out['guardOnFresh'] = guardOnFresh

  return out
})()

// ===========================================================================
// ASSERTIONS (synchronous `it` bodies — the shim constraint).
// ===========================================================================

// ---------------------------------------------------------------------------
// The capture shapes (the `it` bodies cast over the module-level `R`).
// ---------------------------------------------------------------------------

type CanonOk = Extract<CanonResult, { readonly ok: true }>
type CanonFail = Extract<CanonResult, { readonly ok: false }>

interface S4Capture {
  readonly base: CanonResult
  readonly desc: CanonResult
  readonly descCallsDelta: number
  readonly bashSame: CanonResult
  readonly cmd2: CanonResult
  readonly sub: CanonResult
  readonly bg: CanonResult
  readonly timeout: CanonResult
  readonly sandbox: CanonResult
  readonly explicitDot: CanonResult
  readonly raw1: CanonResult
  readonly raw2: CanonResult
  readonly bashEcho: CanonResult
  readonly m: {
    readonly workdir: CanonResult
    readonly background: CanonResult
    readonly timeout: CanonResult
    readonly sandbox: CanonResult
    readonly cmdMissing: CanonResult
    readonly cmdNotString: CanonResult
    readonly cmdEmpty: CanonResult
    readonly bashWorkdir: CanonResult
    readonly bashBackground: CanonResult
  }
  readonly malformedCallsDelta: number
  readonly fxCalls: string[]
}

interface P3Capture {
  readonly ask: ParseResult
  readonly deny: ParseResult
  readonly exact: ParseResult
  readonly allow: ParseResult
  readonly bashExact: ParseResult
}

interface SibCapture {
  readonly decisionAKind: string
  readonly decisionAReason: string | undefined
  readonly nextACalls: number
  readonly decisionBKind: string
  readonly decisionBReason: string | undefined
  readonly nextBCalls: number
  readonly reqBCorrelation: string | undefined
  readonly reqBTarget: string | undefined
  readonly reqACount: number
  readonly rowsBefore: RowCounts
  readonly rowsAfter: RowCounts
}

interface LiveLegR1 {
  readonly surface: string[]
  readonly isError: boolean
  readonly text: string
  readonly bodyDelta: number
  readonly rowsBefore: RowCounts
  readonly rowsAfter: RowCounts
}
interface LiveLegR2 {
  readonly surface: string[]
  readonly requestKind: string | undefined
  readonly requestTool: string | undefined
  readonly requestTarget: string | undefined
  readonly requestSummary: string | undefined
  readonly requestFp: string | undefined
  readonly bodyAtPause: number
  readonly isError: boolean
  readonly text: string
  readonly bodyDelta: number
  readonly rowsBefore: RowCounts
  readonly rowsAfter: RowCounts
  readonly consumptionRows: number
  readonly decisionRows: number
}
interface LiveLegR3 {
  readonly isError: boolean
  readonly text: string
  readonly bodyDelta: number
  readonly rowsBefore: RowCounts
  readonly rowsAfter: RowCounts
}
interface LiveLegR4 {
  readonly requestKind: string | undefined
  readonly requestTool: string | undefined
  readonly requestSummary: string | undefined
  readonly requestFp: string | undefined
  readonly pureFp: CanonResult
  readonly bodyAtPause: number
  readonly isError: boolean
  readonly text: string
  readonly bodyDelta: number
  readonly rowsBefore: RowCounts
  readonly rowsAfter: RowCounts
  readonly consumptionRows: number
}
interface LiveLegR5 {
  readonly isError: boolean
  readonly bodyDelta: number
}
interface LiveCapture {
  readonly r1: LiveLegR1
  readonly r2: LiveLegR2
  readonly r3: LiveLegR3
  readonly r4: LiveLegR4
  readonly r5: LiveLegR5
}

/** One captured static-deny / guard reason, read safely (RED-safe). */
function reasonFrag(reason: string | undefined, frag: string): boolean {
  return typeof reason === 'string' && reason.includes(frag)
}

// ===========================================================================
// ASSERTIONS (synchronous `it` bodies — the shim constraint). Every
// assertion asserts the POST-FIX observable fact: on the base tree the
// RED probes (P1–P4) fail, and the GREEN scenarios fail along with them
// (they turn green in one step with the implementation).
// ===========================================================================

describe('A2C-1 RED probes (plan §5.6 — fail on the base tree)', () => {
  it('P1: classifyPermissionTool("pwsh") is TOOL-LEVEL (pre-fix: unsupported)', () => {
    const p1 = R['p1'] as Record<string, unknown>
    expect(p1['pwshKind']).toBe('tool-level')
    expect(p1['pwshTool']).toBe('pwsh')
    expect(p1['isPwshName']).toBe(true)
  })

  it('P2: the default-deny policy STOPS the pwsh call (pre-fix: the pass-through reaches the executor)', () => {
    const p2 = R['p2'] as AskFlow
    expect(p2.decisionKind).toBe('deny')
    expect(p2.nextCalls).toBe(0)
    expect(p2.rowsAfter).toEqual(p2.rowsBefore)
    expect(reasonFrag(p2.decisionReason, 'denies pwsh on pwsh')).toBe(true)
  })

  it('P3: the Blueprint schema accepts { tool: pwsh, resource: any } in the ask lane (pre-fix: MALFORMED_DTO)', () => {
    const p3 = R['p3'] as P3Capture
    expect(p3.ask.code).toBe(undefined)
    expect(p3.ask.policy).toEqual({
      default: 'ask',
      allow: [],
      ask: [{ tool: 'pwsh', resource: { kind: 'any' } }],
      deny: [],
    })
    expect(p3.deny.code).toBe(undefined)
  })

  it('P4: the explicitly-mounted tool-pwsh is BLOCKED by the parameter-permission layer (pre-fix: the body runs)', () => {
    const live = R['live'] as LiveCapture
    expect(live.r1.bodyDelta).toBe(0)
    expect(live.r1.isError).toBe(true)
    expect(live.r1.rowsAfter).toEqual(live.r1.rowsBefore)
    expect(live.r1.text.includes('denies pwsh on pwsh')).toBe(true)
  })
})

describe('A2C-1 GREEN: classification + vocabulary (plan §5.2/§5.5)', () => {
  it('the shell class: bash+pwsh are tool-level, the shell vocabulary is complete, the domain list has 7 names', () => {
    const p1 = R['p1'] as Record<string, unknown>
    expect(p1['bashKind']).toBe('tool-level')
    expect(p1['bashTool']).toBe('bash')
    expect(p1['isBashName']).toBe(true)
    expect(p1['isReadName']).toBe(true)
    expect(p1['shellValues']).toEqual(['bash', 'pwsh'])
    expect(p1['shellKeys']).toEqual({ bash: 'bash', pwsh: 'pwsh' })
    expect(p1['singleCanonIsFunction']).toBe(true)
    expect(p1['permToolNames']).toEqual(['bash', 'edit', 'lsp', 'pwsh', 'read', 'read_image', 'write'])
    expect(p1['toolValues']).toEqual(p1['permToolNames'])
    expect(p1['fileValues']).toEqual(['edit', 'lsp', 'read', 'read_image', 'write'])
    expect(p1['bashResourceKey']).toBe('bash')
  })

  it('the shell-class rule contract (the schema): exact ✗ every lane, any ✗ the allow lane — for BOTH shell tools', () => {
    const p3 = R['p3'] as P3Capture
    expect(p3.exact.code).toBe('MALFORMED_DTO')
    expect(p3.exact.message.includes('exact')).toBe(true)
    expect(p3.allow.code).toBe('MALFORMED_DTO')
    expect(p3.allow.message.includes('allow')).toBe(true)
    expect(p3.bashExact.code).toBe('MALFORMED_DTO')
    expect(p3.bashExact.message.includes('exact')).toBe(true)
    expect(p3.deny.policy).toEqual({
      default: 'ask',
      allow: [],
      ask: [],
      deny: [{ tool: 'pwsh', resource: { kind: 'any' } }],
    })
  })
})

describe('A2C-1 GREEN: the shell fingerprint / effect matrix (plan §5.4)', () => {
  it('the resource identity: { kind: tool, key: pwsh, display: pwsh } + the canonical workdir display', () => {
    const s4 = R['s4'] as S4Capture
    const b = s4.base as CanonOk
    expect(b.resource).toEqual({ kind: 'tool', key: 'pwsh', display: 'pwsh' })
    expect(b.workdirDisplay).toBe('/A')
    expect(typeof b.fp === 'string' && b.fp.startsWith('sha256:')).toBe(true)
  })

  it('the authority separation: bash and pwsh with the SAME command have DISTINCT fingerprints and resource keys', () => {
    const s4 = R['s4'] as S4Capture
    const b = s4.base as CanonOk
    const bs = s4.bashSame as CanonOk
    expect(bs.resource).toEqual({ kind: 'tool', key: 'bash', display: 'bash' })
    expect(typeof b.fp === 'string' && typeof bs.fp === 'string' && bs.fp !== b.fp).toBe(true)
  })

  it('each effect dimension changes the fingerprint; description/justification do NOT', () => {
    const s4 = R['s4'] as S4Capture
    const b = s4.base as CanonOk
    const d = s4.desc as CanonOk
    expect(d.fp).toBe(b.fp)
    expect(s4.descCallsDelta).toBe(1)
    const legs = [s4.cmd2, s4.sub, s4.bg, s4.timeout, s4.sandbox] as CanonOk[]
    for (const leg of legs) {
      expect(typeof leg.fp === 'string' && typeof b.fp === 'string' && leg.fp !== b.fp).toBe(true)
    }
    expect(new Set(legs.map((leg) => leg.fp)).size).toBe(5)
  })

  it('the command is never normalized (raw-string hash); omitted workdir ≡ explicit cwd workdir', () => {
    const s4 = R['s4'] as S4Capture
    const b = s4.base as CanonOk
    const r1 = s4.raw1 as CanonOk
    const r2 = s4.raw2 as CanonOk
    expect(typeof r1.fp === 'string' && typeof r2.fp === 'string' && r1.fp !== r2.fp).toBe(true)
    expect((s4.explicitDot as CanonOk).fp).toBe(b.fp)
  })

  it('malformed effect fields fail closed with the per-tool-mirrored pwsh-* reasons — BEFORE the resolver is consulted', () => {
    const s4 = R['s4'] as S4Capture
    const code = op.OPERATION_PERMISSION_ERROR_CODES.OPERATION_CANONICALIZATION_FAILED
    const legs: [CanonResult, string][] = [
      [s4.m.workdir, 'pwsh-workdir-not-a-string'],
      [s4.m.background, 'pwsh-run-in-background-not-boolean'],
      [s4.m.timeout, 'pwsh-timeout-ms-invalid'],
      [s4.m.sandbox, 'pwsh-sandbox-permissions-not-a-string'],
      [s4.m.cmdMissing, 'pwsh-command-missing'],
      [s4.m.cmdNotString, 'pwsh-command-not-a-string'],
      [s4.m.cmdEmpty, 'pwsh-command-empty'],
    ]
    for (const [leg, reason] of legs) {
      expect(leg.ok).toBe(false)
      const f = leg as CanonFail
      expect(f.code).toBe(code)
      expect(f.reason).toBe(reason)
      expect(f.tool).toBe('pwsh')
    }
    expect(s4.malformedCallsDelta).toBe(0)
  })

  it('the bash malformed reasons stay the BYTE-IDENTICAL bash-* closed set (the H2/H5 pins)', () => {
    const s4 = R['s4'] as S4Capture
    const bw = s4.m.bashWorkdir as CanonFail
    const bb = s4.m.bashBackground as CanonFail
    expect(bw.reason).toBe('bash-workdir-not-a-string')
    expect(bb.reason).toBe('bash-run-in-background-not-boolean')
    const code = op.OPERATION_PERMISSION_ERROR_CODES.OPERATION_CANONICALIZATION_FAILED
    expect(bw.code).toBe(code)
    expect(bb.code).toBe(code)
  })
})

describe('A2C-1 GREEN: deny / ask / allow-once flows (plan §5.7)', () => {
  it('G1: the pwsh any deny lane — static deny, zero execution, zero rows, the provenance names the rule', () => {
    const g1 = R['g1'] as AskFlow
    expect(g1.decisionKind).toBe('deny')
    expect(g1.nextCalls).toBe(0)
    expect(g1.rowsAfter).toEqual(g1.rowsBefore)
    expect(reasonFrag(g1.decisionReason, "the template's deny rule 0 denies pwsh on pwsh")).toBe(true)
  })

  it('G2: the Member→Leader ask — leader-approval bound to the EXACT fingerprint + the bounded summary; the allow authorizes exactly one dispatch', () => {
    const g2 = R['g2'] as AskFlow
    const s4 = R['s4'] as S4Capture
    expect(g2.paused).toBe(true)
    expect(g2.execAtPause).toBe(0)
    expect(g2.decisionKind).toBe('allow')
    expect(g2.nextCalls).toBe(1)
    const req = g2.request
    expect(req).not.toBe(undefined)
    if (req === undefined) return
    expect(req.kind).toBe(CONTROL_REQUEST_KINDS.LEADER_APPROVAL)
    expect(req.toolName).toBe('pwsh')
    expect(req.correlation).toBe('a2c1-g2')
    expect(req.targetInstanceId).toBe(WORKER_ID)
    expect(req.summary).toBe('pwsh [cwd=/A] Get-Process')
    expect(req.operationFingerprint).toBe((s4.base as CanonOk).fp)
    expect(R['g2RequestRows']).toBe(1)
    expect(R['g2DecisionRows']).toBe(1)
    expect(R['g2ConsumptionRows']).toBe(1)
    expect(g2.rowsAfter.requests).toBe(g2.rowsBefore.requests + 1)
    expect(g2.rowsAfter.decisions).toBe(g2.rowsBefore.decisions + 1)
    expect(g2.rowsAfter.consumptions).toBe(g2.rowsBefore.consumptions + 1)
  })

  it('G3: the Leader→Human ask — user-approval, the human-only closure, exactly one dispatch', () => {
    const g3 = R['g3'] as AskFlow
    expect(g3.paused).toBe(true)
    expect(g3.decisionKind).toBe('allow')
    expect(g3.nextCalls).toBe(1)
    const req = g3.request
    expect(req).not.toBe(undefined)
    if (req === undefined) return
    expect(req.kind).toBe(CONTROL_REQUEST_KINDS.USER_APPROVAL)
    expect(req.toolName).toBe('pwsh')
    expect(req.targetInstanceId).toBe(LEADER_ID)
  })

  it('G4: allow-once over the EXACT command/effect — the same-call retry is blocked (allow-consumed, no new rows); a NEW call asks again (no static shell allow)', () => {
    const g4a = R['g4a'] as AskFlow
    const g4b = R['g4b'] as AskFlow
    const g4c = R['g4c'] as AskFlow
    expect(g4a.decisionKind).toBe('allow')
    expect(g4a.nextCalls).toBe(1)
    expect(g4b.decisionKind).toBe('deny')
    expect(g4b.nextCalls).toBe(0)
    expect(reasonFrag(g4b.decisionReason, 'allow-consumed')).toBe(true)
    expect(g4b.rowsAfter).toEqual(g4b.rowsBefore)
    expect(g4c.decisionKind).toBe('deny')
    expect(g4c.nextCalls).toBe(0)
    const reqA = g4a.request
    const reqC = g4c.request
    expect(reqA).not.toBe(undefined)
    expect(reqC).not.toBe(undefined)
    if (reqA === undefined || reqC === undefined) return
    expect(reqA.operationFingerprint).toBe(reqC.operationFingerprint)
    expect(reqC.correlation).toBe('a2c1-g4c')
  })
})

describe('A2C-1 GREEN: the fingerprint mismatch (plan §5.7)', () => {
  it('G5: the changed command — a different fingerprint, its own ask; the old approval cannot cover it', () => {
    const g5a = R['g5a'] as AskFlow
    const g5b = R['g5b'] as AskFlow
    expect(g5a.decisionKind).toBe('allow')
    expect(g5a.nextCalls).toBe(1)
    expect(g5b.decisionKind).toBe('deny')
    expect(g5b.nextCalls).toBe(0)
    const reqA = g5a.request
    const reqB = g5b.request
    expect(reqA).not.toBe(undefined)
    expect(reqB).not.toBe(undefined)
    if (reqA === undefined || reqB === undefined) return
    expect(reqA.operationFingerprint).not.toBe(reqB.operationFingerprint)
    expect(reqB.correlation).toBe('a2c1-g5b')
  })

  it('G6: the changed workdir — a different canonical key, its own ask', () => {
    const g6a = R['g6a'] as AskFlow
    const g6b = R['g6b'] as AskFlow
    expect(g6a.decisionKind).toBe('allow')
    expect(g6a.nextCalls).toBe(1)
    expect(g6b.decisionKind).toBe('deny')
    expect(g6b.nextCalls).toBe(0)
    const reqA = g6a.request
    const reqB = g6b.request
    expect(reqA).not.toBe(undefined)
    expect(reqB).not.toBe(undefined)
    if (reqA === undefined || reqB === undefined) return
    expect(reqA.operationFingerprint).not.toBe(reqB.operationFingerprint)
    expect(reqB.summary).toBe('pwsh [cwd=/A/sub] Get-Location')
  })

  it('G7: the changed effects (background / timeout / sandbox) — four distinct fingerprints; the allow covers exactly its own', () => {
    const g7a = R['g7a'] as AskFlow
    const g7b = R['g7b'] as AskFlow
    const g7c = R['g7c'] as AskFlow
    const g7d = R['g7d'] as AskFlow
    expect(g7a.decisionKind).toBe('allow')
    expect(g7a.nextCalls).toBe(1)
    for (const g of [g7b, g7c, g7d] as AskFlow[]) {
      expect(g.decisionKind).toBe('deny')
      expect(g.nextCalls).toBe(0)
    }
    const fps = [g7a.request, g7b.request, g7c.request, g7d.request].map((r) =>
      r === undefined ? undefined : r.operationFingerprint,
    )
    expect(fps.every((f) => typeof f === 'string')).toBe(true)
    expect(new Set(fps).size).toBe(4)
  })

  it('G7: the summary — the ordered effect tokens + the 120-char truncated preview; the SAME truncated summary for different commands (display-only, never the fingerprint)', () => {
    const g7a = R['g7a'] as AskFlow
    const g7e = R['g7e'] as AskFlow
    const g7f = R['g7f'] as AskFlow
    const reqA = g7a.request
    expect(reqA).not.toBe(undefined)
    if (reqA === undefined) return
    expect(reqA.summary).toBe('pwsh [cwd=/A] Test-Path -Path C:/temp')
    const reqE = g7e.request
    const reqF = g7f.request
    expect(reqE).not.toBe(undefined)
    expect(reqF).not.toBe(undefined)
    if (reqE === undefined || reqF === undefined) return
    expect(reqE.summary).toBe(`pwsh [cwd=/A] ${'x'.repeat(120)}...`)
    expect(reqF.summary).toBe(reqE.summary)
    expect(reqE.operationFingerprint).not.toBe(reqF.operationFingerprint)
    expect(g7e.decisionKind).toBe('allow')
    expect(g7e.nextCalls).toBe(1)
    expect(g7f.decisionKind).toBe('deny')
    expect(g7f.nextCalls).toBe(0)
  })
})

describe('A2C-1 GREEN: fail-closed + bash regression + sibling + resume (plan §5.7 + §1.6)', () => {
  it('G8: the malformed pwsh input fails closed BEFORE the rules — deny, zero execution, zero rows, no request', () => {
    const g8 = R['g8'] as AskFlow
    const g8b = R['g8b'] as AskFlow
    const legs: [AskFlow, string][] = [
      [g8, 'pwsh-workdir-not-a-string'],
      [g8b, 'pwsh-command-not-a-string'],
    ]
    for (const [g, frag] of legs) {
      expect(g.decisionKind).toBe('deny')
      expect(g.nextCalls).toBe(0)
      expect(g.rowsAfter).toEqual(g.rowsBefore)
      expect(g.request).toBe(undefined)
      expect(reasonFrag(g.decisionReason, frag)).toBe(true)
    }
  })

  it('G11: the bash regression — the ask flow intact (the request bound to the bash fingerprint), the bash-* reasons byte-identical', () => {
    const g9a = R['g9a'] as AskFlow
    const g9b = R['g9b'] as AskFlow
    const s4 = R['s4'] as S4Capture
    expect(g9a.decisionKind).toBe('allow')
    expect(g9a.nextCalls).toBe(1)
    const reqA = g9a.request
    expect(reqA).not.toBe(undefined)
    if (reqA === undefined) return
    expect(reqA.kind).toBe(CONTROL_REQUEST_KINDS.LEADER_APPROVAL)
    expect(reqA.toolName).toBe('bash')
    expect(reqA.summary).toBe('bash [cwd=/A] echo hi')
    expect(reqA.operationFingerprint).toBe((s4.bashEcho as CanonOk).fp)
    expect(g9b.decisionKind).toBe('deny')
    expect(g9b.nextCalls).toBe(0)
    expect(g9b.rowsAfter).toEqual(g9b.rowsBefore)
    expect(reasonFrag(g9b.decisionReason, 'bash-workdir-not-a-string')).toBe(true)
  })

  it('G9: the sibling agents — A\'s deny policy gates ONLY A; B asks independently (zero cross-interference)', () => {
    const sib = R['sib'] as SibCapture
    expect(sib.decisionAKind).toBe('deny')
    expect(sib.nextACalls).toBe(0)
    expect(sib.reqACount).toBe(0)
    expect(reasonFrag(sib.decisionAReason, 'denies pwsh on pwsh')).toBe(true)
    expect(sib.decisionBKind).toBe('deny')
    expect(sib.nextBCalls).toBe(0)
    expect(sib.reqBCorrelation).toBe('a2c1-sib-b')
    expect(sib.reqBTarget).toBe(WORKER2_ID)
    expect(reasonFrag(sib.decisionBReason, 'the approval was denied')).toBe(true)
    expect(sib.rowsAfter.requests).toBe(sib.rowsBefore.requests + 1)
    expect(sib.rowsAfter.decisions).toBe(sib.rowsBefore.decisions + 1)
  })

  it('G10: the cold resume — the fresh install reinstalls BOTH the listener (its own ask flow) and the end-cap guard (it denies the unmarked supported exec)', () => {
    const r1 = R['r1'] as AskFlow
    const r2 = R['r2'] as AskFlow
    const guard = R['guardOnFresh'] as string | undefined
    expect(r1.decisionKind).toBe('allow')
    expect(r1.nextCalls).toBe(1)
    const req1 = r1.request
    expect(req1).not.toBe(undefined)
    expect(r2.decisionKind).toBe('deny')
    expect(r2.nextCalls).toBe(0)
    const req2 = r2.request
    expect(req2).not.toBe(undefined)
    if (req1 !== undefined && req2 !== undefined) {
      expect(req2.requestId).not.toBe(req1.requestId)
    }
    expect(guard).toBe(END_CAP_REASON)
  })
})

describe('A2C-1 GREEN: the real pipeline — the capability mask + the hostile end-cap (plan §5.7 + H1)', () => {
  it('G12: the hostile prepend-allow is denied by the MONOTONIC end-cap for pwsh (H1 preserved: zero body, zero rows, the end-cap reason); NO over-deny for unsupported tools', () => {
    const live = R['live'] as LiveCapture
    expect(live.r3.isError).toBe(true)
    expect(live.r3.bodyDelta).toBe(0)
    expect(live.r3.rowsAfter).toEqual(live.r3.rowsBefore)
    expect(live.r3.text.includes(END_CAP_REASON)).toBe(true)
    expect(live.r5.isError).toBe(false)
    expect(live.r5.bodyDelta).toBe(1)
  })

  it('G8: builtinToolDeny:[pwsh] — the tool is absent from the model surface and the parameter-permission layer cannot re-admit it: the approved ask still never runs the body (consumed exactly once)', () => {
    const live = R['live'] as LiveCapture
    expect(live.r2.surface.includes('pwsh')).toBe(false)
    expect(live.r2.surface.includes('web_fetch')).toBe(true)
    expect(live.r2.bodyDelta).toBe(0)
    expect(live.r2.bodyAtPause).toBe(0)
    expect(live.r2.isError).toBe(true)
    expect(live.r2.requestKind).toBe(CONTROL_REQUEST_KINDS.LEADER_APPROVAL)
    expect(live.r2.requestTool).toBe('pwsh')
    expect(live.r2.requestTarget).toBe(WORKER_ID)
    expect(live.r2.requestSummary).toBe('pwsh [cwd=.] Get-Process')
    expect(live.r2.consumptionRows).toBe(1)
    expect(live.r2.decisionRows).toBe(1)
  })

  it('G2 (real pipeline): the ask → allow authorizes EXACTLY ONE dispatch — the full effect summary + the exact fingerprint (the pure canonicalization match)', () => {
    const live = R['live'] as LiveCapture
    expect(live.r4.isError).toBe(false)
    expect(live.r4.bodyDelta).toBe(1)
    expect(live.r4.bodyAtPause).toBe(0)
    expect(live.r4.requestKind).toBe(CONTROL_REQUEST_KINDS.LEADER_APPROVAL)
    expect(live.r4.requestTool).toBe('pwsh')
    expect(live.r4.requestSummary).toBe(
      'pwsh [cwd=sub] [background] [sandbox=workspace-write] [timeout=5000ms] Get-ChildItem -Path C:/temp',
    )
    expect(live.r4.consumptionRows).toBe(1)
    expect(live.r4.rowsAfter.requests).toBe(live.r4.rowsBefore.requests + 1)
    expect(live.r4.rowsAfter.decisions).toBe(live.r4.rowsBefore.decisions + 1)
    expect(live.r4.rowsAfter.consumptions).toBe(live.r4.rowsBefore.consumptions + 1)
    const pureFp = live.r4.pureFp
    expect(pureFp.ok).toBe(true)
    if (pureFp.ok) {
      expect(live.r4.requestFp).toBe(pureFp.fp)
    }
  })

  it('the P4 surface fact: the mounted pwsh is PRESENT in the model surface (no mask) yet the parameter-permission layer still blocks it (the static-deny reason names pwsh)', () => {
    const live = R['live'] as LiveCapture
    expect(live.r1.surface.includes('pwsh')).toBe(true)
    expect(live.r1.surface.includes('web_fetch')).toBe(true)
    expect(live.r1.text.includes('denies pwsh on pwsh')).toBe(true)
  })
})
