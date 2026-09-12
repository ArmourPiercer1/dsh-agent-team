/**
 * a2c7-subtree-matcher.test.ts — A2C-7 (alpha.2 capability-completion
 * round, plan §9) MUST-TEST: the `subtree` PermissionResource kind,
 * end-to-end over the ONLY legal containment authority (the pinned
 * upstream public seam `FileSystem.contains(parent, child)` — plan
 * §9.1/§9.4; zero `startsWith`, zero targetKey parsing, plan §1.5):
 *
 *   G1  root itself matches (operationTarget == root)
 *   G2  child matches
 *   G3  deep descendant matches
 *   G4  sibling no match
 *   G5  prefix trap: `/src` does NOT match `/src2` (the real backend's
 *       `contains()` rejects it; the explicitly-labeled
 *       `startsWithAuthority` NEGATIVE FIXTURE shows the string
 *       authority WOULD match — it is never the authority)
 *   G6  relative/absolute aliases via backend (one canonical identity,
 *       cross-spelling containment)
 *   G7  `..` traversal via backend (the traversal spelling canonicalizes
 *       to the same identity; containment holds)
 *   G8  Windows casing semantics BY BACKEND (Linux host: the case-
 *       SENSITIVE local backend is the backend-semantic equivalent — a
 *       case-variant spelling is a DIFFERENT identity, so no match; the
 *       Windows delta is recorded, the module never case-folds)
 *   G9  symlink/junction alias identity (the rule `./alias` matches the
 *       TARGET's paths — the authority is the canonical identity)
 *   G10 junction retarget fresh decision (H4 for subtree: retarget the
 *       alias between decisions — the authority FOLLOWS the new target
 *       on the NEXT decision; no install-time freeze)
 *   G11 exact unchanged (the exact lane is byte-identical in the
 *       presence of the subtree machinery; a different-tool rule is
 *       never canonicalized)
 *   G12 any unchanged (whole-tool any allow/deny, file + shell class)
 *   G13 deny > ask > allow unchanged (a subtree rule in all three lanes
 *       — the deny lane wins with rule provenance)
 *   G14 shell subtree schema rejects (bash/pwsh + subtree in EVERY lane
 *       = MALFORMED_DTO — the A2C-1 shell contract, `resource: any`
 *       ask/deny only, is not regressed; read/read_image/write/edit/lsp
 *       + subtree is accepted in all three lanes with the exact
 *       path constraints: trim / non-empty / control-char / length)
 *   G15 canonicalization failure lanes (plan §9.8, pinned per lane:
 *       deny subtree unresolvable root OR containment undeterminable →
 *       FAIL CLOSED → deny before A3 (the rule cannot be dropped);
 *       allow subtree failure → no positive grant → non-match →
 *       priority/default; ask subtree failure → the rule contributes
 *       nothing (the P1-3 asymmetry — the ask lane is never reported,
 *       the final outcome falls to the default, never a minted allow))
 *   G16 cold resume (dispose + fresh install — the subtree semantics are
 *       identical, there is no stale canonical-rule cache: the module
 *       owns none, and the re-install follows the CURRENT topology)
 *
 * RED probes (plan §9.9, fail on the base tree, file LOADS on the base
 * tree — the new post-fix surface is reached through the namespace
 * import / plain-object literals only, exactly the a2c1 pattern):
 *
 *   R1  the Blueprint schema currently REJECTS `{ kind: subtree }`
 *       (the grammar gap — deterministic: pre-fix MALFORMED_DTO
 *       "kind must be one of exact | any"; post-fix accepted with the
 *       exact path constraints)
 *   R2  the prefix-trap demonstration: the labeled `startsWithAuthority`
 *       negative fixture WRONGLY matches `/src2` under root `/src`
 *       (proving string authority over opaque keys is unsound — it is a
 *       fixture, never the authority), while the REAL pinned backend's
 *       `contains()` correctly rejects the pair and the pipeline
 *       therefore does NOT deny the sibling-prefix operation
 *
 * Architecture pinned here (plan §9.5/§9.6): A3 stays PURE (the matcher
 * receives the OPERATION-RELATIVE containment boolean
 * `CanonicalRule.resource = { kind: 'subtree'; rootKey; containsOperation }`
 * — `rootKey` is provenance/debug equality only and can never itself
 * infer containment); the A5 adapter owns the per-decision resolution
 * batch (a decision-local opaque key → FsTarget map, dropped at decision
 * end — no cross-call cache, H4 fresh canonicalization) and calls the
 * public `fs.contains` seam on the same live provider basis as the
 * operation.
 *
 * Real-backend section (plan §9.9: at least one test must call the REAL
 * pinned `FileSystem.contains()` — the prebuilt `@deepseek-ai/dsh-fs-local`
 * of the pristine test-use checkout, the `a2-canonical-operation-realfs.mjs`
 * construction pattern: prebuilt lib by absolute URL, the minimal
 * `{ reflect: { provide() {} } }` ctx double, a temp dir under
 * `os.tmpdir`). The section degrades to a recorded skip
 * (`{ available: false, reason }`) only when the prebuilt lib is absent.
 *
 * RUNNER CONSTRAINTS (this repo's plain-node shim): every async scenario
 * runs at MODULE level (top-level await) and captures its results; the
 * `it` bodies are pure synchronous assertions. Shim matchers used:
 * toBe / toEqual (+.not) only.
 *
 * P4-T6 SELF-CLEANLINESS: this file is inside the whole-tree scanner's
 * scope (`packages/**`), so no legacy Team SessionEvent denylist token
 * may appear in this source — none does. This new scannable file moves
 * the p4t6 filesScanned pin 695 → 696 (the pin update belongs to the
 * single-writer integration tip — do NOT edit the pin; reported delta
 * in the A2C-7 report).
 *
 * @module @dsh-agent-team/runtime/test/a2c7-subtree-matcher
 */
import { describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as op from '../operation-permission/index.js'
import type {
  CanonicalOperation,
  CanonicalRule,
  CanonicalRules,
  PreExecuteExec,
  PreToolDecisionLike,
} from '../operation-permission/index.js'
import { createControlService } from '../control/index.js'
import type { ControlRequestRecord, ControlService } from '../control/index.js'
import { PERMISSION_RESOURCE_KINDS, parseBlueprint } from '../../domain/blueprint/src/index.js'
import type { PermissionTool, TemplatePermissionPolicy } from '../../domain/blueprint/src/index.js'
import type { ActionCaller } from '../admission/index.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  P6T4_NOW,
  P6T4_ROOT,
  P6T4_SEEDS,
  createP6T4World,
  destroyP6T1World,
  leaderCaller,
  memberCaller,
} from './p6t4-helpers.js'

// ---------------------------------------------------------------------------
// Constants.
// ---------------------------------------------------------------------------

const LEADER_ID = String(P6T4_SEEDS.leader.instanceId)
const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)

// ---------------------------------------------------------------------------
// The deterministic FAKE local backend (models ONE backend for the
// unit-level groups: the identity is the canonical absolute segment list
// (a case-SENSITIVE local-filesystem model); the key is `fskey:<canonical>`
// (opaque to the module — the module never sees through it); the handle
// carries the segment list (the backend's canonical identity — what
// realpath would give). The fake `contains` is the BACKEND's own
// `node:path.relative` semantics computed over the canonical segments
// (a segment-wise prefix — the same contract the real section pins on
// the pinned backend). It is NOT the forbidden string authority: the
// forbidden thing is `operationKey.startsWith(rootKey)` on the OPAQUE
// key strings, demonstrated as unsound by `startsWithAuthority` below
// over REAL backend keys (G5/R2).
// ---------------------------------------------------------------------------

const FAKE_CWD = '/workspace'

/** One fake backend handle: the canonical segment identity (opaque object). */
interface FakeHandle {
  readonly segs: readonly string[]
}

/** The UNSOUND string authority (NEGATIVE FIXTURE ONLY — plan §9.4
 *  forbidden: `operation.key.startsWith(root.key)`). Used in G5/R2 to
 *  demonstrate that the string authority WRONGLY matches the
 *  sibling-prefix operation — it is never wired into any pipeline. */
function startsWithAuthority(rootKey: string, operationKey: string): boolean {
  return operationKey.startsWith(rootKey)
}

/** The backend's canonicalization (a case-sensitive local FS model):
 *  absolutize against the cwd, split, resolve `.`/`..` segment-wise. */
function fakeCanonicalSegments(raw: string): string[] {
  const absolute = raw.startsWith('/') || /^[A-Za-z]:[\\/]/.test(raw) ? raw : FAKE_CWD + '/' + raw
  const prefix = /^[A-Za-z]:/.test(absolute) ? absolute.slice(0, 2) : ''
  const segments = absolute.slice(prefix.length).split(/[\\/]+/)
  const out: string[] = []
  for (const segment of segments) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') out.pop()
    else out.push(segment)
  }
  return out
}

interface FakeLocalFsOptions {
  /** Raw paths the backend fails to resolve (transient IO error model). */
  readonly failFor?: ReadonlySet<string>
  /** Resolve WITHOUT the opaque handle (the pre-A2C-7 seam shape —
   *  containment then undeterminable). */
  readonly noHandles?: boolean
  /** `contains` throws (a provider fault — containment undeterminable). */
  readonly containsThrow?: boolean
}

interface FakeLocalFs {
  readonly resolveTarget: (path: string) => Promise<{ key: string; display: string; handle?: unknown }>
  readonly containsTargets: (parent: unknown, child: unknown) => boolean
  /** Model a topology mutation: re-point an alias raw path at a new
   *  canonical identity (the symlink/junction retarget). */
  setTarget: (rawPath: string, segs: readonly string[]) => void
  /** The canonical segments the backend assigns one raw path (diagnostic). */
  segsOf: (rawPath: string) => string[]
  readonly calls: string[]
}

/** Build one deterministic fake local backend (one alias level — an
 *  alias rewrites its path prefix to the alias target's identity, the
 *  upstream realpath semantics for one symlink level). */
function makeFakeLocalFs(options: FakeLocalFsOptions = {}): FakeLocalFs {
  const calls: string[] = []
  const aliasOverride = new Map<string, string[]>()
  const canonicalSegments = (raw: string): string[] => {
    let segs = fakeCanonicalSegments(raw)
    for (const [prefixRaw, replacement] of aliasOverride) {
      const prefixSegs = fakeCanonicalSegments(prefixRaw)
      if (segs.length >= prefixSegs.length && prefixSegs.every((s, i) => segs[i] === s)) {
        segs = [...replacement, ...segs.slice(prefixSegs.length)]
        break // one alias level (alias -> dir, never alias -> alias)
      }
    }
    return segs
  }
  const keyOf = (segs: readonly string[]): string => 'fskey:/' + segs.join('/')
  return {
    resolveTarget: async (raw: string): Promise<{ key: string; display: string; handle?: unknown }> => {
      calls.push(raw)
      if (options.failFor !== undefined && options.failFor.has(raw)) {
        throw new Error(`fake backend: cannot resolve '${raw}'`)
      }
      const segs = canonicalSegments(raw)
      const key = keyOf(segs)
      const display = '/' + segs.join('/')
      return options.noHandles ? { key, display } : { key, display, handle: { segs } satisfies FakeHandle }
    },
    containsTargets: (parent: unknown, child: unknown): boolean => {
      if (options.containsThrow) throw new Error('fake backend: contains fault (injected)')
      const ps = (parent as FakeHandle).segs
      const cs = (child as FakeHandle).segs
      // The backend's relative() semantics over canonical segments:
      // child == parent OR a segment-wise descendant.
      return ps.length <= cs.length && ps.every((s, i) => cs[i] === s)
    },
    setTarget: (rawPath: string, segs: readonly string[]): void => {
      // Store the RAW path (the lookup normalizes it with the same
      // fakeCanonicalSegments — never re-normalize a canonical form).
      aliasOverride.set(rawPath, [...segs])
    },
    segsOf: (rawPath: string): string[] => canonicalSegments(rawPath),
    calls,
  }
}

// ---------------------------------------------------------------------------
// The policy fixtures (raw A1 shape — the adapter canonicalizes them).
// ---------------------------------------------------------------------------

function subtreeRule(tool: PermissionTool, path: string): { tool: PermissionTool; resource: { kind: 'subtree'; path: string } } {
  return { tool, resource: { kind: 'subtree', path } }
}
function exactRule(tool: PermissionTool, path: string): { tool: PermissionTool; resource: { kind: 'exact'; path: string } } {
  return { tool, resource: { kind: 'exact', path } }
}
function anyRule(tool: PermissionTool): { tool: PermissionTool; resource: { kind: 'any' } } {
  return { tool, resource: { kind: 'any' } }
}

// ---------------------------------------------------------------------------
// The fake agent ctx (the a5a/h5/a2c1 double).
// ---------------------------------------------------------------------------

type PreExecuteListener = (
  exec: PreExecuteExec,
  next: () => Promise<PreToolDecisionLike>,
) => Promise<PreToolDecisionLike>

type GuardFn = (exec: { readonly name: string }) => string | undefined

interface FakeAgentCtx {
  readonly on: (event: string, listener: PreExecuteListener) => () => void
  readonly tools: { guard(guard: GuardFn): () => void }
  trigger: (
    exec: PreExecuteExec,
    next: () => Promise<PreToolDecisionLike>,
  ) => Promise<PreToolDecisionLike>
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
    if (listener === undefined) throw new Error('a2c7 fake ctx: no listener registered')
    return listener(exec, next)
  }
  return { on, tools: { guard }, trigger }
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

// ---------------------------------------------------------------------------
// The adapter environment (one P6-T4 durable world + the REAL control
// service + one adapter install on a fresh fake ctx — the a2c1 pattern;
// the member caller/target default; isLeader parameterized).
// ---------------------------------------------------------------------------

interface EnvOptions {
  readonly isLeader?: boolean
  readonly caller?: ActionCaller
  readonly targetInstanceId?: string
}

interface Env {
  readonly world: P6T1World
  readonly service: ControlService
  readonly ctx: FakeAgentCtx
  readonly observations: Record<string, unknown>[]
  readonly dispose: () => void
}

/** Install the adapter on a fresh fake ctx over one durable world. */
function installEnv(
  world: P6T1World,
  service: ControlService,
  ctx: FakeAgentCtx,
  options: {
    readonly policy: TemplatePermissionPolicy
    readonly resolveTarget: (path: string) => Promise<{ key: string; display: string; handle?: unknown }>
    readonly containsTargets?: (parent: unknown, child: unknown) => boolean | Promise<boolean>
    readonly observations: Record<string, unknown>[]
  } & EnvOptions,
): () => void {
  const isLeader = options.isLeader ?? false
  const caller = options.caller ?? (isLeader ? leaderCaller() : memberCaller(WORKER_ID))
  const targetInstanceId = options.targetInstanceId ?? (isLeader ? LEADER_ID : WORKER_ID)
  const params = {
    policy: options.policy,
    resolveTarget: options.resolveTarget,
    ...(options.containsTargets !== undefined ? { containsTargets: options.containsTargets } : {}),
    controlService: service,
    rootSessionId: P6T4_ROOT,
    caller,
    targetInstanceId,
    isLeader,
    onObserve: (observation: Record<string, unknown>): void => {
      options.observations.push(observation)
    },
  }
  return op.installParameterPermissionListener(ctx, params as Parameters<typeof op.installParameterPermissionListener>[1])
}

/** One flow drive against a fake-ctx env: trigger (unawaited), wait
 *  (bounded) for a durable request, optionally resolve it, await the
 *  decision. TOTAL on both trees (pre-fix: the subtree rule is treated
 *  as an EXACT rule over its path — the descendant scenarios downgrade
 *  to the default and the probe settles any request it finds, so the
 *  runner never hangs — its very existence is the RED). */
interface Flow {
  readonly decisionKind: string
  readonly decisionReason: string | undefined
  readonly nextCalls: number
  readonly request: ControlRequestRecord | undefined
  readonly paused: boolean
  readonly rowsBefore: RowCounts
  readonly rowsAfter: RowCounts
}

async function runFlow(
  env: { service: ControlService; ctx: FakeAgentCtx },
  name: string,
  callId: string,
  arguments_: Record<string, unknown>,
  resolveWith?: { readonly caller: ActionCaller; readonly decision: 'allow' | 'deny' },
): Promise<Flow> {
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
    rowsBefore,
    rowsAfter,
  }
}

/** One Blueprint parse (never throws — captures the closed error
 *  code/message on failure; the policy is copied out for equality). */
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
// The real pinned-backend section (the `a2-canonical-operation-realfs.mjs`
// pattern: prebuilt lib by absolute URL, the minimal ctx double, a temp
// dir under os.tmpdir — degraded to `{ available: false, reason }` when
// the build is absent, never a crash).
// ---------------------------------------------------------------------------

const TEST_DIR = resolve(fileURLToPath(import.meta.url), '..')
const PACKAGES_DIR = resolve(TEST_DIR, '..', '..')
/** The worktree root (walk up from here to the test-use marker — the
 *  gitignored pristine checkout lives in the MAIN repo, two levels up). */
const WALK_START = resolve(PACKAGES_DIR, '..')

/** Walk up to the test-use marker (canonical tests/ layout first; the
 *  legacy references/ layout stays as a fallback for pre-move machines). */
function findTestUseRoot(): string | null {
  let dir = WALK_START
  for (let depth = 0; depth < 4; depth += 1) {
    for (const rel of [
      join('tests', 'deepseek-harness-test-use'),
      join('references', 'deepseek-harness-test-use'),
    ]) {
      const candidate = join(dir, rel)
      if (existsSync(join(candidate, 'packages', 'fs', 'fs-local', 'lib', 'index.js'))) {
        return candidate
      }
    }
    dir = resolve(dir, '..')
  }
  return null
}

type RealFs = {
  resolve(path: string, opts?: { cwd?: string }): Promise<{ targetKey: unknown; displayPath: unknown }>
  contains(parent: unknown, child: unknown): boolean
}

interface RealSection {
  readonly available: boolean
  readonly reason?: string
  readonly cases?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// The module-level driver (every async scenario runs here; the `it`
// bodies below are pure synchronous assertions over `R`).
// ---------------------------------------------------------------------------

const R: Record<string, unknown> = await (async () => {
  const out: Record<string, unknown> = {}

  // =========================================================================
  // SECTION 1 — the Blueprint schema (domain) — G14 + R1.
  // Pre-fix: `{ kind: subtree }` is REJECTED in every lane (the grammar gap).
  // Post-fix: accepted for read/read_image/write/edit/lsp in all three
  // lanes with the exact path constraints; shell (bash/pwsh) subtree is
  // schema-REJECTED with the A2C-1 shell contract intact.
  // =========================================================================
  const blueprintSource = (permissionLines: string[]): string =>
    [
      '---',
      'schemaVersion: 1',
      'blueprintId: a2c7-probe',
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
    ].join('\n')

  const perm = (defaultLane: string, lanes: Record<string, string[]>): string[] =>
    [
      `    permissions:`,
      `      default: ${defaultLane}`,
      `      allow: ${lanes.allow === undefined ? '[]' : '\n' + lanes.allow.map((l) => '        ' + l).join('\n')}`,
      `      ask: ${lanes.ask === undefined ? '[]' : '\n' + lanes.ask.map((l) => '        ' + l).join('\n')}`,
      `      deny: ${lanes.deny === undefined ? '[]' : '\n' + lanes.deny.map((l) => '        ' + l).join('\n')}`,
    ]

  const ruleLines = (tool: string, kind: string, path?: string): string[] =>
    path === undefined
      ? [`- tool: ${tool}`, '  resource:', `    kind: ${kind}`]
      : [`- tool: ${tool}`, '  resource:', `    kind: ${kind}`, `    path: ${path}`]
  /** A rule with an explicit `path:` line (the constraint fixtures need
   *  YAML double-quoted scalars so the SPACES / control character reach
   *  the schema layer instead of being normalized by the YAML layer). */
  const rawRule = (tool: string, kind: string, pathLine: string): string[] =>
    [`- tool: ${tool}`, '  resource:', `    kind: ${kind}`, pathLine]

  const schema: Record<string, unknown> = {}
  // R1 — the deterministic RED probe: pre-fix this parse FAILS
  // (MALFORMED_DTO, "kind must be one of exact | any"); post-fix it is
  // accepted and the resource normalizes (trimmed) to the subtree shape.
  schema.readSubtreeAllow = runParse(
    blueprintSource(perm('deny', { allow: ruleLines('read', 'subtree', 'src') })),
  )
  schema.readSubtreeAsk = runParse(
    blueprintSource(perm('deny', { ask: ruleLines('read', 'subtree', 'src') })),
  )
  schema.readSubtreeDeny = runParse(
    blueprintSource(perm('deny', { deny: ruleLines('read', 'subtree', 'src') })),
  )
  // Every file-class tool accepts subtree (one source, four allow rules).
  schema.fileToolsSubtree = runParse(
    blueprintSource(
      perm('deny', {
        allow: [
          ...ruleLines('read', 'subtree', 'src'),
          ...ruleLines('read_image', 'subtree', 'src'),
          ...ruleLines('write', 'subtree', 'src'),
          ...ruleLines('edit', 'subtree', 'src'),
          ...ruleLines('lsp', 'subtree', 'src'),
        ],
      }),
    ),
  )
  // Shell class: subtree is schema-REJECTED in EVERY lane (A2C-1: the
  // shell keeps only `resource: any` in ask/deny — bash has none at all).
  for (const tool of ['bash', 'pwsh']) {
    for (const lane of ['allow', 'ask', 'deny']) {
      schema[`${tool}Subtree${lane}`] = runParse(
        blueprintSource(perm('deny', { [lane]: ruleLines(tool, 'subtree', 'src') })),
      )
    }
  }
  // The exact path constraints ride on subtree (same as exact):
  // (double-quoted YAML scalars — the schema layer must see the spaces
  //  and the control character verbatim; the trim is the schema's job.)
  schema.subtreeTrim = runParse(
    blueprintSource(perm('deny', { allow: rawRule('read', 'subtree', '    path: "  src  "') })),
  )
  schema.subtreeEmpty = runParse(
    blueprintSource(perm('deny', { allow: rawRule('read', 'subtree', '    path: ""') })),
  )
  schema.subtreeBlank = runParse(
    blueprintSource(perm('deny', { allow: rawRule('read', 'subtree', '    path: "   "') })),
  )
  schema.subtreeControlChar = runParse(
    blueprintSource(perm('deny', { allow: rawRule('read', 'subtree', '    path: "sr\\u0001c"') })),
  )
  schema.subtreeTooLong = runParse(
    blueprintSource(perm('deny', { allow: ruleLines('read', 'subtree', 'a'.repeat(1025)) })),
  )
  // A closed resource shape: an extra field on a subtree resource rejects.
  schema.subtreeExtraField = runParse(
    blueprintSource(
      perm('deny', {
        allow: [...ruleLines('read', 'subtree', 'src'), '    extra: 1'],
      }),
    ),
  )
  // The truly-unknown kind still rejects (the renamed fixture: kind 'glob').
  schema.unknownKind = runParse(
    blueprintSource(perm('deny', { allow: ruleLines('read', 'glob', 'src') })),
  )
  // exact / any are unchanged:
  schema.exactUnchanged = runParse(
    blueprintSource(perm('deny', { allow: ruleLines('read', 'exact', 'src/a.txt') })),
  )
  schema.anyUnchanged = runParse(
    blueprintSource(perm('deny', { allow: ruleLines('read', 'any') })),
  )
  schema.anyExtraField = runParse(
    blueprintSource(perm('deny', { allow: [...ruleLines('read', 'any'), '    extra: 1'] })),
  )
  out.schema = schema

  // =========================================================================
  // SECTION 2 — the A3 pure resolver (no env, no fs): the matcher receives
  // the OPERATION-RELATIVE containment boolean — `rootKey` is provenance
  // only and can never itself infer containment (plan §9.5).
  // =========================================================================
  const a3FileOp = (key: string, display: string): CanonicalOperation => ({
    tool: 'read',
    resource: { kind: 'file', key, display },
    fingerprint: 'a2c7-fp',
  })
  const a3BashOp = (): CanonicalOperation => ({
    tool: 'bash',
    resource: { kind: 'tool', key: 'bash', display: 'bash' },
    fingerprint: 'a2c7-fp',
  })
  const a3SubtreeRule = (rootKey: string, containsOperation: boolean): CanonicalRule => ({
    tool: 'read',
    resource: { kind: 'subtree', rootKey, containsOperation },
  } as CanonicalRule)
  const a3ExactRule = (key: string): CanonicalRule => ({
    tool: 'read',
    resource: { kind: 'exact', key },
  })
  const a3AnyRule = (): CanonicalRule => ({ tool: 'read', resource: { kind: 'any' } })
  const a3Rules = (
    allow: readonly CanonicalRule[],
    ask: readonly CanonicalRule[] = [],
    deny: readonly CanonicalRule[] = [],
  ): CanonicalRules => ({ allow: [...allow], ask: [...ask], deny: [...deny] })
  const a3Policy = (defaultLane: 'ask' | 'deny'): TemplatePermissionPolicy => ({
    default: defaultLane,
    allow: [],
    ask: [],
    deny: [],
  })
  const a3 = (
    label: string,
    policy: TemplatePermissionPolicy,
    operation: CanonicalOperation,
    rules: CanonicalRules,
  ): void => {
    try {
      const decision = op.resolveOperationPermission(policy, operation, rules)
      out.a3 = out.a3 ?? {}
      ;(out.a3 as Record<string, unknown>)[label] = {
        decision: decision.decision,
        source: decision.provenance.source,
        effect: decision.provenance.effect,
        lane: decision.provenance.lane,
        ruleIndex: decision.provenance.ruleIndex,
      }
    } catch (error: unknown) {
      out.a3 = out.a3 ?? {}
      ;(out.a3 as Record<string, unknown>)[label] = {
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
  // The containment boolean is the whole matcher input: containsOperation
  // true matches regardless of the (unconsulted) rootKey vs operation key;
  // false never matches; the tool must match; file-class operations only.
  a3('containsTrue', a3Policy('deny'), a3FileOp('k_child', '/x/child'), a3Rules([a3SubtreeRule('k_root', true)]))
  a3('containsFalse', a3Policy('deny'), a3FileOp('k_child', '/x/child'), a3Rules([a3SubtreeRule('k_root', false)]))
  // The A3-purity contract: rootKey 'k_A' vs operation key 'k_B' — A3 must
  // still match (it NEVER compares keys; the A5 seam computed the boolean).
  a3('rootKeyIgnored', a3Policy('deny'), a3FileOp('k_B', '/b'), a3Rules([a3SubtreeRule('k_A', true)]))
  a3('toolMismatch', a3Policy('deny'), a3FileOp('k_child', '/x/child'), a3Rules([
    { tool: 'write', resource: { kind: 'subtree', rootKey: 'k_root', containsOperation: true } } as CanonicalRule,
  ]))
  a3('shellOperationNoMatch', a3Policy('deny'), a3BashOp(), a3Rules([
    { tool: 'bash', resource: { kind: 'subtree', rootKey: 'k_root', containsOperation: true } } as CanonicalRule,
  ]))
  // Priority: a subtree rule in all three lanes — the deny lane wins with
  // RULE provenance (source 'rule', lane 'deny', ruleIndex 0).
  a3('priorityDenyWins', a3Policy('ask'), a3FileOp('k_child', '/x/child'), a3Rules(
    [a3SubtreeRule('k_root', true)],
    [a3SubtreeRule('k_root', true)],
    [a3SubtreeRule('k_root', true)],
  ))
  // exact / any unchanged:
  a3('exactMatch', a3Policy('deny'), a3FileOp('k_a', '/a'), a3Rules([a3ExactRule('k_a')]))
  a3('exactMismatch', a3Policy('deny'), a3FileOp('k_a', '/a'), a3Rules([a3ExactRule('k_b')]))
  a3('anyMatch', a3Policy('deny'), a3FileOp('k_a', '/a'), a3Rules([a3AnyRule()]))
  a3('defaultDeny', a3Policy('deny'), a3FileOp('k_a', '/a'), a3Rules([]))

  // =========================================================================
  // SECTION 3 — the A5 adapter over the deterministic FAKE backend
  // (G1-G4, G11-G13, G15, G16). One durable P6-T4 world per env; the
  // member caller/target default. Every scenario is TOTAL on both trees
  // (pre-fix: the subtree rule is treated as an EXACT rule over its path —
  // the descendant scenarios downgrade to the default and any request the
  // pre-fix tree raises is settled by the probe, so the runner never hangs).
  // =========================================================================
  interface FakeEnv {
    world: P6T1World
    service: ControlService
    ctx: FakeAgentCtx
    observations: Record<string, unknown>[]
    dispose: () => void
    fs: FakeLocalFs
  }
  const fakeEnv = async (
    basename: string,
    policy: TemplatePermissionPolicy,
    fs: FakeLocalFs,
  ): Promise<FakeEnv> => {
    const world = await createP6T4World(basename, ['leader', 'worker'])
    const service = createControlService({
      teamDomain: world.domain,
      blueprintCatalog: world.catalog,
      externalPolicyFacts: world.ports.externalPolicyFacts,
      now: () => P6T4_NOW,
      waitPollIntervalMs: 5,
    })
    const ctx = makeFakeAgentCtx()
    const observations: Record<string, unknown>[] = []
    const dispose = installEnv(world, service, ctx, {
      policy,
      resolveTarget: fs.resolveTarget,
      containsTargets: fs.containsTargets,
      observations,
    })
    return { world, service, ctx, observations, dispose, fs }
  }
  const destroyFakeEnv = async (env: FakeEnv): Promise<void> => {
    env.dispose()
    await destroyP6T1World(env.world)
  }
  const resolveDeny = { caller: leaderCaller(), decision: 'deny' as const }
  const resolveAllow = { caller: leaderCaller(), decision: 'allow' as const }

  const fake: Record<string, unknown> = {}
  const flow = async (
    label: string,
    env: FakeEnv,
    name: string,
    callId: string,
    args: Record<string, unknown>,
    resolveWith?: { readonly caller: ActionCaller; readonly decision: 'allow' | 'deny' },
  ): Promise<Flow> => {
    const result = await runFlow(env, name, callId, args, resolveWith)
    fake[label] = { ...result, observations: [...env.observations] }
    return result
  }
  try {
    // --- G1 root itself (directory root + file root) -----------------------
    {
      const fs = makeFakeLocalFs()
      const env = await fakeEnv('a2c7-g1', {
        default: 'deny',
        allow: [subtreeRule('read', 'src'), subtreeRule('read', 'notes.txt')],
        ask: [],
        deny: [],
      }, fs)
      await flow('g1DirRoot', env, 'read', 'a2c7-g1-1', { file_path: 'src' })
      await flow('g1FileRoot', env, 'read', 'a2c7-g1-2', { file_path: 'notes.txt' })
      await destroyFakeEnv(env)
    }
    // --- G2/G3/G4 child, deep descendant, sibling --------------------------
    {
      const fs = makeFakeLocalFs()
      const env = await fakeEnv('a2c7-g234', {
        default: 'deny',
        allow: [subtreeRule('read', 'src')],
        ask: [],
        deny: [],
      }, fs)
      await flow('g2Child', env, 'read', 'a2c7-g234-1', { file_path: 'src/a.txt' })
      await flow('g3Deep', env, 'read', 'a2c7-g3-1', { file_path: 'src/x/y/z.txt' })
      await flow('g4Sibling', env, 'read', 'a2c7-g4-1', { file_path: 'other/a.txt' })
      await destroyFakeEnv(env)
    }
    // --- G11 exact unchanged + the different-tool rule is never
    //     canonicalized (H4: rules that cannot match are never resolved) ---
    {
      const fs = makeFakeLocalFs()
      const env = await fakeEnv('a2c7-g11', {
        default: 'deny',
        allow: [exactRule('read', 'src/a.txt'), subtreeRule('write', 'src')],
        ask: [],
        deny: [],
      }, fs)
      await flow('g11ExactMatch', env, 'read', 'a2c7-g11-1', { file_path: 'src/a.txt' })
      await flow('g11ExactMismatch', env, 'read', 'a2c7-g11-2', { file_path: 'src/b.txt' })
      fake.g11RuleCalls = [...fs.calls]
      await destroyFakeEnv(env)
    }
    // --- G12 any unchanged (file-class any allow; shell-class any deny) ----
    {
      const fs = makeFakeLocalFs()
      const env = await fakeEnv('a2c7-g12', {
        default: 'ask',
        allow: [anyRule('read')],
        ask: [],
        deny: [anyRule('bash')],
      }, fs)
      await flow('g12AnyAllow', env, 'read', 'a2c7-g12-1', { file_path: 'anywhere/f.txt' }, resolveAllow)
      await flow('g12BashAnyDeny', env, 'bash', 'a2c7-g12-2', { command: 'echo hi' })
      await destroyFakeEnv(env)
    }
    // --- G13 deny > ask > allow (a subtree rule in ALL three lanes) --------
    {
      const fs = makeFakeLocalFs()
      const env = await fakeEnv('a2c7-g13', {
        default: 'ask',
        allow: [subtreeRule('read', 'src')],
        ask: [subtreeRule('read', 'src')],
        deny: [subtreeRule('read', 'src')],
      }, fs)
      await flow('g13DenyWins', env, 'read', 'a2c7-g13-1', { file_path: 'src/a.txt' }, resolveDeny)
      await destroyFakeEnv(env)
    }
    // --- G15 canonicalization failure lanes (plan §9.8) ---------------------
    {
      // deny subtree, unresolvable root → FAIL CLOSED → deny before A3
      // (the frozen P1-3 reason prefix — pinned by h4/a5a via .includes).
      const fs = makeFakeLocalFs({ failFor: new Set(['src']) })
      const env = await fakeEnv('a2c7-g15a', {
        default: 'ask',
        allow: [],
        ask: [],
        deny: [subtreeRule('read', 'src')],
      }, fs)
      await flow('g15DenyUnresolvable', env, 'read', 'a2c7-g15a-1', { file_path: 'src/a.txt' }, resolveDeny)
      await destroyFakeEnv(env)
    }
    {
      // deny subtree, root + operation resolve but the backend exposes no
      // opaque handle (the pre-A2C-7 seam shape) → containment UNDETERMINABLE
      // → the deny lane FAILS CLOSED (the rule cannot be dropped).
      const fs = makeFakeLocalFs({ noHandles: true })
      const env = await fakeEnv('a2c7-g15b', {
        default: 'ask',
        allow: [],
        ask: [],
        deny: [subtreeRule('read', 'src')],
      }, fs)
      await flow('g15DenyUndeterminable', env, 'read', 'a2c7-g15b-1', { file_path: 'src/a.txt' }, resolveDeny)
      await destroyFakeEnv(env)
    }
    {
      // deny subtree, the containment SEAM itself faults (throws) →
      // undeterminable → FAIL CLOSED (same lane, same contract).
      const fs = makeFakeLocalFs({ containsThrow: true })
      const env = await fakeEnv('a2c7-g15c', {
        default: 'ask',
        allow: [],
        ask: [],
        deny: [subtreeRule('read', 'src')],
      }, fs)
      await flow('g15DenyContainsFault', env, 'read', 'a2c7-g15c-1', { file_path: 'src/a.txt' }, resolveDeny)
      await destroyFakeEnv(env)
    }
    {
      // allow subtree, unresolvable root → NO positive grant → non-match →
      // the priority/default outcome (default ask → the ask flow; default
      // deny → deny). A failed allow rule NEVER denies, NEVER grants.
      const fs = makeFakeLocalFs({ failFor: new Set(['src']) })
      const env = await fakeEnv('a2c7-g15d', {
        default: 'ask',
        allow: [subtreeRule('read', 'src')],
        ask: [],
        deny: [],
      }, fs)
      await flow('g15AllowUnresolvableDefaultAsk', env, 'read', 'a2c7-g15d-1', { file_path: 'src/a.txt' }, resolveAllow)
      await destroyFakeEnv(env)
    }
    {
      const fs = makeFakeLocalFs({ failFor: new Set(['src']) })
      const env = await fakeEnv('a2c7-g15e', {
        default: 'deny',
        allow: [subtreeRule('read', 'src')],
        ask: [],
        deny: [],
      }, fs)
      await flow('g15AllowUnresolvableDefaultDeny', env, 'read', 'a2c7-g15e-1', { file_path: 'src/a.txt' })
      await destroyFakeEnv(env)
    }
    {
      // ask subtree, unresolvable root → the rule contributes NOTHING
      // (the P1-3 asymmetry: the ask lane is never reported — zero
      // 'deny-canonicalization-failure' observations) → the default.
      const fs = makeFakeLocalFs({ failFor: new Set(['src']) })
      const env = await fakeEnv('a2c7-g15f', {
        default: 'deny',
        allow: [],
        ask: [subtreeRule('read', 'src')],
        deny: [],
      }, fs)
      await flow('g15AskUnresolvable', env, 'read', 'a2c7-g15f-1', { file_path: 'src/a.txt' })
      await destroyFakeEnv(env)
    }
    {
      // allow subtree + containment SEAM fault → undeterminable → the
      // allow rule is a non-match (no escalation; no grant minted).
      const fs = makeFakeLocalFs({ containsThrow: true })
      const env = await fakeEnv('a2c7-g15g', {
        default: 'deny',
        allow: [subtreeRule('read', 'src')],
        ask: [],
        deny: [],
      }, fs)
      await flow('g15AllowContainsFault', env, 'read', 'a2c7-g15g-1', { file_path: 'src/a.txt' })
      await destroyFakeEnv(env)
    }
    // --- G16 cold resume (dispose + fresh install — no stale cache) --------
    {
      const fs = makeFakeLocalFs()
      fs.setTarget('alias', fs.segsOf('dirA')) // alias -> dirA (the T0 topology)
      const policy: TemplatePermissionPolicy = {
        default: 'deny',
        allow: [subtreeRule('read', 'alias')],
        ask: [],
        deny: [],
      }
      const env1 = await fakeEnv('a2c7-g16-a', policy, fs)
      await flow('g16T0ViaTarget', env1, 'read', 'a2c7-g16-1', { file_path: 'dirA/f.txt' })
      await destroyFakeEnv(env1)
      // The topology retargets (junction ≡ symlink on Linux) BETWEEN the
      // agent lifecycles; a FRESH install (the cold-resume analogue) must
      // follow the CURRENT topology — there is no carried-over state.
      fs.setTarget('alias', fs.segsOf('dirB'))
      const env2 = await fakeEnv('a2c7-g16-b', policy, fs)
      await flow('g16StaleTargetNoMatch', env2, 'read', 'a2c7-g16-2', { file_path: 'dirA/f.txt' })
      await flow('g16NewTargetMatches', env2, 'read', 'a2c7-g16-3', { file_path: 'dirB/f.txt' })
      await destroyFakeEnv(env2)
    }
  } catch (error: unknown) {
    fake.error = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error)
  }
  out.fake = fake

  // =========================================================================
  // SECTION 4 — the REAL pinned local backend (plan §9.9: at least one
  // test must call the REAL `FileSystem.contains()` — the prebuilt
  // `@deepseek-ai/dsh-fs-local` of the pristine test-use checkout, the
  // `a2-canonical-operation-realfs.mjs` construction pattern). G5-G10 +
  // the real-backend root-itself leg + R2. Degrades to
  // `{ available: false, reason }` when the prebuilt lib is absent.
  // =========================================================================
  const testUseRoot = findTestUseRoot()
  if (testUseRoot === null) {
    out.real = { available: false, reason: 'test-use prebuilt fs-local lib not found (tests/deepseek-harness-test-use or legacy references/ layout)' }
  } else {
    try {
      const libUrl = pathToFileURL(
        join(testUseRoot, 'packages', 'fs', 'fs-local', 'lib', 'index.js'),
      ).href
      const { LocalFileSystem } = (await import(libUrl)) as {
        LocalFileSystem: new (ctx: unknown, config: { cwd?: string; diffBasisMaxBytes?: number }) => RealFs
      }
      const tmp = mkdtempSync(join(tmpdir(), 'dsh-a2c7-real-'))
      // The fixture tree (all REAL files on the OS this host runs):
      mkdirSync(join(tmp, 'src', 'x', 'y'), { recursive: true })
      mkdirSync(join(tmp, 'src2'), { recursive: true })
      mkdirSync(join(tmp, 'other'), { recursive: true })
      mkdirSync(join(tmp, 'dirA'), { recursive: true })
      mkdirSync(join(tmp, 'dirB'), { recursive: true })
      writeFileSync(join(tmp, 'src', 'a.txt'), 'a\n', 'utf8')
      writeFileSync(join(tmp, 'src', 'x', 'y', 'z.txt'), 'z\n', 'utf8')
      writeFileSync(join(tmp, 'src2', 'f.txt'), 'trap\n', 'utf8')
      writeFileSync(join(tmp, 'other', 'a.txt'), 'o\n', 'utf8')
      writeFileSync(join(tmp, 'dirA', 'f.txt'), 'A\n', 'utf8')
      writeFileSync(join(tmp, 'dirB', 'f.txt'), 'B\n', 'utf8')
      writeFileSync(join(tmp, 'root-file.txt'), 'r\n', 'utf8')
      writeFileSync(join(tmp, 'CaseFile.txt'), 'c\n', 'utf8')
      // The symlink alias (≡ a directory junction on Windows): alias -> dirA.
      symlinkSync(join(tmp, 'dirA'), join(tmp, 'alias'), 'dir')

      const fsx = new LocalFileSystem({ reflect: { provide() {} } }, {
        cwd: tmp,
        diffBasisMaxBytes: 10 * 1024 * 1024,
      })
      const resolveTarget = async (path: string) => {
        const target = await fsx.resolve(path, { cwd: tmp })
        return { key: String(target.targetKey), display: String(target.displayPath), handle: target }
      }
      const containsTargets = (parent: unknown, child: unknown): boolean => fsx.contains(parent, child)

      const realCases: Record<string, unknown> = {}
      const realFlows: Record<string, FlowData> = {}
      const realFlow = async (
        label: string,
        env: FakeEnv,
        name: string,
        callId: string,
        args: Record<string, unknown>,
        resolveWith?: { readonly caller: ActionCaller; readonly decision: 'allow' | 'deny' },
      ): Promise<Flow> => {
        const result = await runFlow(env, name, callId, args, resolveWith)
        realFlows[label] = { ...result, observations: [...env.observations] }
        return result
      }
      const realEnv = async (
        basename: string,
        policy: TemplatePermissionPolicy,
      ): Promise<FakeEnv> => {
        const world = await createP6T4World(basename, ['leader', 'worker'])
        const service = createControlService({
          teamDomain: world.domain,
          blueprintCatalog: world.catalog,
          externalPolicyFacts: world.ports.externalPolicyFacts,
          now: () => P6T4_NOW,
          waitPollIntervalMs: 5,
        })
        const ctx = makeFakeAgentCtx()
        const observations: Record<string, unknown>[] = []
        const dispose = installEnv(world, service, ctx, {
          policy,
          resolveTarget,
          containsTargets,
          observations,
        })
        return { world, service, ctx, observations, dispose, fs: { calls: [] } as unknown as FakeLocalFs }
      }

      // --- R2 / G5 the prefix trap: `/src` vs `/src2` -----------------------
      // The labeled NEGATIVE FIXTURE (the forbidden string authority over
      // the OPAQUE keys) WRONGLY matches; the REAL `contains()` correctly
      // rejects; the pipeline therefore does NOT deny the sibling-prefix
      // operation (the decision is the DEFAULT, not the deny rule).
      const srcRes = await resolveTarget('src')
      const src2fRes = await resolveTarget(join('src2', 'f.txt'))
      realCases.prefixTrap = {
        rootKey: srcRes.key,
        operationKey: src2fRes.key,
        // The UNSOUND string authority (fixture only — never the authority):
        startsWithAuthorityTrap: startsWithAuthority(srcRes.key, src2fRes.key),
        // The REAL pinned-backend authority:
        realContainsRejectsTrap: containsTargets(srcRes.handle, src2fRes.handle),
      }
      {
        const env = await realEnv('a2c7-real-g5', {
          default: 'deny',
          allow: [],
          ask: [],
          deny: [subtreeRule('read', 'src')],
        })
        // The trap leg: the operation is OUTSIDE the subtree (sibling
        // prefix) → the deny rule does NOT match → default deny.
        await realFlow('g5TrapDefault', env, 'read', 'a2c7-g5-1', { file_path: join('src2', 'f.txt') })
        // The positive control: a true child IS denied by the rule.
        await realFlow('g5ChildDenied', env, 'read', 'a2c7-g5-2', { file_path: join('src', 'a.txt') })
        await destroyP6T1World(env.world)
        env.dispose()
      }
      // --- G6 relative/absolute aliases via the backend ---------------------
      {
        const env = await realEnv('a2c7-real-g6', {
          default: 'deny',
          allow: [subtreeRule('read', 'src'), subtreeRule('read', join(tmp, 'src'))],
          ask: [],
          deny: [],
        })
        // Relative rule path, ABSOLUTE operation spelling (same identity):
        await realFlow('g6RelRuleAbsOp', env, 'read', 'a2c7-g6-1', { file_path: join(tmp, 'src', 'a.txt') })
        // Absolute rule path, RELATIVE operation spelling:
        await realFlow('g6AbsRuleRelOp', env, 'read', 'a2c7-g6-2', { file_path: join('src', 'a.txt') })
        await destroyP6T1World(env.world)
        env.dispose()
      }
      // --- G7 `..` traversal via the backend --------------------------------
      {
        const env = await realEnv('a2c7-real-g7', {
          default: 'deny',
          allow: [subtreeRule('read', 'src')],
          ask: [],
          deny: [],
        })
        // The traversal spelling canonicalizes to the same identity:
        await realFlow('g7Traversal', env, 'read', 'a2c7-g7-1', { file_path: join('src', '..', 'src', 'a.txt') })
        // And the canonicalization identity facts:
        const direct = await resolveTarget(join('src', 'a.txt'))
        const traversal = await resolveTarget(join('src', '..', 'src', 'a.txt'))
        realCases.traversal = {
          directKey: direct.key,
          traversalKey: traversal.key,
          sameIdentity: direct.key === traversal.key,
          containsDirect: containsTargets(srcRes.handle, direct.handle),
        }
        await destroyP6T1World(env.world)
        env.dispose()
      }
      // --- G8 Windows casing semantics BY BACKEND ---------------------------
      // On this Linux host the local backend is CASE-SENSITIVE: the
      // case-variant spelling resolves to a DIFFERENT canonical identity,
      // so containment fails and the operation is a non-match (the
      // default). This is the backend-semantic equivalent of the Windows
      // semantics (on case-insensitive NTFS the same spelling WOULD match)
      // — the backend owns the case semantics; the module NEVER case-folds.
      // The Windows delta is recorded in the A2C-7 evidence.
      {
        const env = await realEnv('a2c7-real-g8', {
          default: 'deny',
          allow: [subtreeRule('read', 'src')],
          ask: [],
          deny: [],
        })
        const baseOp = await resolveTarget(join('src', 'a.txt'))
        const variantOp = await resolveTarget(join('SRC', 'a.txt'))
        realCases.casing = {
          baseKey: baseOp.key,
          variantKey: variantOp.key,
          caseSensitiveBackend: baseOp.key !== variantOp.key,
          containsVariant: containsTargets(srcRes.handle, variantOp.handle),
        }
        await realFlow('g8CaseVariantNoMatch', env, 'read', 'a2c7-g8-1', { file_path: join('SRC', 'a.txt') })
        await destroyP6T1World(env.world)
        env.dispose()
      }
      // --- G9 symlink/junction alias identity --------------------------------
      // The rule `./alias` (alias -> dirA): the authority is the canonical
      // IDENTITY — the rule matches the TARGET's own paths, not just the
      // alias spelling.
      {
        const env = await realEnv('a2c7-real-g9', {
          default: 'deny',
          allow: [subtreeRule('read', 'alias')],
          ask: [],
          deny: [],
        })
        // Via the TARGET's path (no alias in the operation spelling):
        await realFlow('g9ViaTargetPath', env, 'read', 'a2c7-g9-1', { file_path: join('dirA', 'f.txt') })
        // Via the ALIAS spelling:
        await realFlow('g9ViaAliasPath', env, 'read', 'a2c7-g9-2', { file_path: join('alias', 'f.txt') })
        const aliasRes = await resolveTarget('alias')
        const dirARes = await resolveTarget('dirA')
        realCases.aliasIdentity = {
          aliasKey: aliasRes.key,
          dirAKey: dirARes.key,
          sameIdentity: aliasRes.key === dirARes.key,
        }
        await destroyP6T1World(env.world)
        env.dispose()
      }
      // --- G10 junction retarget — the H4 fresh-decision proof ---------------
      // ONE install, THREE decisions: retarget the alias (alias -> dirB)
      // BETWEEN decisions (Linux: a junction retarget ≡ a symlink
      // retarget). The authority FOLLOWS the new target on the NEXT
      // decision — no install-time freeze.
      {
        const env = await realEnv('a2c7-real-g10', {
          default: 'deny',
          allow: [subtreeRule('read', 'alias')],
          ask: [],
          deny: [],
        })
        // T0: alias -> dirA — the target's file is inside the subtree.
        await realFlow('g10T0TargetMatches', env, 'read', 'a2c7-g10-1', { file_path: join('dirA', 'f.txt') })
        // The topology mutation (the same live provider sees it):
        const aliasPath = join(tmp, 'alias')
        rmSync(aliasPath)
        symlinkSync(join(tmp, 'dirB'), aliasPath, 'dir')
        // T1: the OLD target is OUTSIDE the subtree now (fresh decision):
        await realFlow('g10T1OldTargetNoMatch', env, 'read', 'a2c7-g10-2', { file_path: join('dirA', 'f.txt') })
        // T2: the NEW target IS inside the subtree:
        await realFlow('g10T1NewTargetMatches', env, 'read', 'a2c7-g10-3', { file_path: join('dirB', 'f.txt') })
        realCases.retarget = {
          t0Decision: realFlows.g10T0TargetMatches?.decisionKind,
          t1OldDecision: realFlows.g10T1OldTargetNoMatch?.decisionKind,
          t1NewDecision: realFlows.g10T1NewTargetMatches?.decisionKind,
        }
        await destroyP6T1World(env.world)
        env.dispose()
      }
      // --- G1 real-backend root-itself (file root) ---------------------------
      {
        const env = await realEnv('a2c7-real-g1', {
          default: 'deny',
          allow: [subtreeRule('read', 'root-file.txt')],
          ask: [],
          deny: [],
        })
        const rootRes = await resolveTarget('root-file.txt')
        realCases.rootItself = {
          containsSelf: containsTargets(rootRes.handle, rootRes.handle),
        }
        await realFlow('g1RealRootItself', env, 'read', 'a2c7-g1-1', { file_path: 'root-file.txt' })
        await destroyP6T1World(env.world)
        env.dispose()
      }
      out.real = { available: true, root: testUseRoot, cwd: tmp, cases: realCases, flows: realFlows }
      rmSync(tmp, { recursive: true, force: true })
    } catch (error: unknown) {
      out.real = { available: false, reason: error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error) }
    }
  }

  return out
})()

// ---------------------------------------------------------------------------
// ASSERTIONS (synchronous `it` bodies — the shim constraint: toBe /
// toEqual (+.not) only; fragment checks via `.includes()` + `.toBe`).
// ---------------------------------------------------------------------------

/** One flow record with its captured observations (both A5 sections). */
type FlowData = Flow & { readonly observations: Record<string, unknown>[] }

/** The REAL section's flow set (named — total on both trees). */
interface RealFlows {
  readonly g1RealRootItself: FlowData
  readonly g5TrapDefault: FlowData
  readonly g5ChildDenied: FlowData
  readonly g6RelRuleAbsOp: FlowData
  readonly g6AbsRuleRelOp: FlowData
  readonly g7Traversal: FlowData
  readonly g8CaseVariantNoMatch: FlowData
  readonly g9ViaTargetPath: FlowData
  readonly g9ViaAliasPath: FlowData
  readonly g10T0TargetMatches: FlowData
  readonly g10T1OldTargetNoMatch: FlowData
  readonly g10T1NewTargetMatches: FlowData
}

interface RealSectionData {
  readonly available: boolean
  readonly reason?: string
  readonly cases?: Record<string, { [k: string]: unknown }>
  readonly flows?: RealFlows
}

/** The SCHEMA section's parse results (named — G14 + R1 fixtures). */
interface SchemaSection {
  readonly readSubtreeAllow: ParseResult
  readonly readSubtreeAsk: ParseResult
  readonly readSubtreeDeny: ParseResult
  readonly fileToolsSubtree: ParseResult
  readonly bashSubtreeAllow: ParseResult
  readonly bashSubtreeAsk: ParseResult
  readonly bashSubtreeDeny: ParseResult
  readonly pwshSubtreeAllow: ParseResult
  readonly pwshSubtreeAsk: ParseResult
  readonly pwshSubtreeDeny: ParseResult
  readonly subtreeTrim: ParseResult
  readonly subtreeEmpty: ParseResult
  readonly subtreeBlank: ParseResult
  readonly subtreeControlChar: ParseResult
  readonly subtreeTooLong: ParseResult
  readonly subtreeExtraField: ParseResult
  readonly unknownKind: ParseResult
  readonly exactUnchanged: ParseResult
  readonly anyUnchanged: ParseResult
  readonly anyExtraField: ParseResult
}

/** One A3 capture (a pure resolver call; an error row on throw). */
interface A3Capture {
  readonly decision?: string
  readonly source?: string
  readonly effect?: string
  readonly lane?: string | null
  readonly ruleIndex?: number | null
  readonly error?: string
}

/** The A3 section's captures (named). */
interface A3Section {
  readonly containsTrue: A3Capture
  readonly containsFalse: A3Capture
  readonly rootKeyIgnored: A3Capture
  readonly toolMismatch: A3Capture
  readonly shellOperationNoMatch: A3Capture
  readonly priorityDenyWins: A3Capture
  readonly exactMatch: A3Capture
  readonly exactMismatch: A3Capture
  readonly anyMatch: A3Capture
  readonly defaultDeny: A3Capture
}

/** The FAKE section's flows + the G11 resolver-call log (named). */
interface FakeSection {
  readonly g1DirRoot: FlowData
  readonly g1FileRoot: FlowData
  readonly g2Child: FlowData
  readonly g3Deep: FlowData
  readonly g4Sibling: FlowData
  readonly g11ExactMatch: FlowData
  readonly g11ExactMismatch: FlowData
  readonly g11RuleCalls: string[]
  readonly g12AnyAllow: FlowData
  readonly g12BashAnyDeny: FlowData
  readonly g13DenyWins: FlowData
  readonly g15DenyUnresolvable: FlowData
  readonly g15DenyUndeterminable: FlowData
  readonly g15DenyContainsFault: FlowData
  readonly g15AllowUnresolvableDefaultAsk: FlowData
  readonly g15AllowUnresolvableDefaultDeny: FlowData
  readonly g15AskUnresolvable: FlowData
  readonly g15AllowContainsFault: FlowData
  readonly g16T0ViaTarget: FlowData
  readonly g16StaleTargetNoMatch: FlowData
  readonly g16NewTargetMatches: FlowData
  readonly error?: string
}

const REAL = R.real as RealSectionData
const SCHEMA = R.schema as SchemaSection
const A3 = R.a3 as A3Section
const FAKE = R.fake as FakeSection
const FLOWS = FAKE

/** The stable reason fragment (shim-safe). */
function hasFrag(s: string | undefined, frag: string): boolean {
  return s !== undefined && s.includes(frag)
}

/** The stages present in a flow's captured observations. */
function obsStages(flow: { observations: Record<string, unknown>[] }): string[] {
  return flow.observations.map((o) => String(o.stage ?? ''))
}

function failClosedObs(
  flow: { observations: Record<string, unknown>[] },
): Record<string, unknown> | undefined {
  return flow.observations.find((o) => o.stage === 'deny-canonicalization-failure')
}

describe('A2C-7 RED probes (fail on the base tree; the file LOADS on the base tree)', () => {
  it('R1 — the Blueprint schema REJECTS `{ kind: subtree }` pre-fix (the grammar gap)', () => {
    const r = SCHEMA.readSubtreeAllow
    // Post-fix: accepted, normalized to the subtree resource shape.
    expect((r.code) === undefined).toBe(true)
    expect(r.policy).toEqual({
      default: 'deny',
      allow: [{ tool: 'read', resource: { kind: 'subtree', path: 'src' } }],
      ask: [],
      deny: [],
    })
    // And the closed vocabulary grows (the pre-fix constant is
    // ['exact', 'any'] — this assertion is part of the RED evidence).
    expect([...PERMISSION_RESOURCE_KINDS]).toEqual(['exact', 'subtree', 'any'])
  })

  it('R2 — the prefix trap: the labeled startsWith fixture WRONGLY matches, the REAL contains() rejects (demonstration on both trees)', () => {
    const trap = REAL.cases?.prefixTrap as {
      rootKey: string
      operationKey: string
      startsWithAuthorityTrap: boolean
      realContainsRejectsTrap: boolean
    }
    expect(trap.startsWithAuthorityTrap).toBe(true)
    expect(trap.realContainsRejectsTrap).toBe(false)
    // The root and operation keys really differ only by the sibling prefix:
    expect(trap.operationKey.startsWith(trap.rootKey)).toBe(true)
  })
})

describe('A2C-7 G14 — the Blueprint grammar (subtree accepted for file tools, schema-REJECTED for shell, exact path constraints)', () => {
  it('read + subtree is accepted in ask and deny lanes (and all five file-class tools in allow)', () => {
    expect((SCHEMA.readSubtreeAsk.code) === undefined).toBe(true)
    expect(SCHEMA.readSubtreeAsk.policy?.ask).toEqual([
      { tool: 'read', resource: { kind: 'subtree', path: 'src' } },
    ])
    expect((SCHEMA.readSubtreeDeny.code) === undefined).toBe(true)
    expect(SCHEMA.readSubtreeDeny.policy?.deny).toEqual([
      { tool: 'read', resource: { kind: 'subtree', path: 'src' } },
    ])
    expect((SCHEMA.fileToolsSubtree.code) === undefined).toBe(true)
    expect(SCHEMA.fileToolsSubtree.policy?.allow).toEqual([
      { tool: 'read', resource: { kind: 'subtree', path: 'src' } },
      { tool: 'read_image', resource: { kind: 'subtree', path: 'src' } },
      { tool: 'write', resource: { kind: 'subtree', path: 'src' } },
      { tool: 'edit', resource: { kind: 'subtree', path: 'src' } },
      { tool: 'lsp', resource: { kind: 'subtree', path: 'src' } },
    ])
  })

  it('bash/pwsh + subtree is schema-REJECTED in EVERY lane (the A2C-1 shell contract is not regressed)', () => {
    for (const tool of ['bash', 'pwsh']) {
      for (const lane of ['allow', 'ask', 'deny']) {
        const r = (SCHEMA as unknown as Record<string, ParseResult>)[`${tool}Subtree${lane}`] as ParseResult
        expect(r.code, `${tool} ${lane}`).toBe('MALFORMED_DTO')
        expect(hasFrag(r.message, `'subtree' resource`), r.message).toBe(true)
      }
    }
  })

  it('the A2C-1 shell rejections are BYTE-IDENTICAL (exact in any lane; any in the allow lane)', () => {
    const bashExact = runParse(
      [
        '---', 'schemaVersion: 1', 'blueprintId: a2c7-probe', 'revision: "1"',
        'leader:', '  templateId: leader', '  persona: "Lead."', '  capabilities:',
        '    teamTools:', '      kind: allow', '      items: []',
        '    builtinToolDeny: []', '    skills:', '      kind: allow', '      items: []',
        '    mcp:', '      kind: allow', '      items: []',
        '    permissions:', '      default: deny', '      allow: []', '      ask:',
        '        - tool: bash', '          resource:', '            kind: exact', '            path: x',
        '      deny: []',
        'members: []', 'requirements: []', 'memberEnvelopes: []', 'policyStates: []', 'metadata: {}', '---',
      ].join('\n'),
    )
    expect(bashExact.code).toBe('MALFORMED_DTO')
    expect(hasFrag(bashExact.message, 'does not accept an \'exact\' resource in any lane'), bashExact.message).toBe(true)
    const bashAnyAllow = runParse(
      [
        '---', 'schemaVersion: 1', 'blueprintId: a2c7-probe', 'revision: "1"',
        'leader:', '  templateId: leader', '  persona: "Lead."', '  capabilities:',
        '    teamTools:', '      kind: allow', '      items: []',
        '    builtinToolDeny: []', '    skills:', '      kind: allow', '      items: []',
        '    mcp:', '      kind: allow', '      items: []',
        '    permissions:', '      default: ask', '      allow:',
        '        - tool: bash', '          resource:', '            kind: any',
        '      ask: []', '      deny: []',
        'members: []', 'requirements: []', 'memberEnvelopes: []', 'policyStates: []', 'metadata: {}', '---',
      ].join('\n'),
    )
    expect(bashAnyAllow.code).toBe('MALFORMED_DTO')
    expect(hasFrag(bashAnyAllow.message, 'grants no positive whole-tool permission for bash'), bashAnyAllow.message).toBe(true)
  })

  it('the exact path constraints ride on subtree: trim-normalized, empty/blank/control-char/too-long/extra-field all reject', () => {
    expect((SCHEMA.subtreeTrim.code) === undefined).toBe(true)
    expect(SCHEMA.subtreeTrim.policy?.allow).toEqual([
      { tool: 'read', resource: { kind: 'subtree', path: 'src' } },
    ])
    expect(SCHEMA.subtreeEmpty.code).toBe('MALFORMED_DTO')
    expect(SCHEMA.subtreeBlank.code).toBe('MALFORMED_DTO')
    expect(SCHEMA.subtreeControlChar.code).toBe('MALFORMED_DTO')
    expect(SCHEMA.subtreeTooLong.code).toBe('MALFORMED_DTO')
    expect(SCHEMA.subtreeExtraField.code).toBe('MALFORMED_DTO')
  })

  it('a truly-unknown kind (glob) still rejects; exact and any are unchanged (any stays closed)', () => {
    expect(SCHEMA.unknownKind.code).toBe('MALFORMED_DTO')
    expect((SCHEMA.exactUnchanged.code) === undefined).toBe(true)
    expect(SCHEMA.exactUnchanged.policy?.allow).toEqual([
      { tool: 'read', resource: { kind: 'exact', path: 'src/a.txt' } },
    ])
    expect((SCHEMA.anyUnchanged.code) === undefined).toBe(true)
    expect(SCHEMA.anyUnchanged.policy?.allow).toEqual([{ tool: 'read', resource: { kind: 'any' } }])
    expect(SCHEMA.anyExtraField.code).toBe('MALFORMED_DTO')
  })
})

describe('A2C-7 G13/A3 — the PURE resolver: the containment boolean is the whole matcher input (rootKey is provenance only)', () => {
  it('containsOperation=true matches; false never matches; rootKey is NEVER consulted', () => {
    expect(A3.containsTrue).toEqual({ decision: 'allow', source: 'rule', effect: 'allow', lane: 'allow', ruleIndex: 0 })
    expect(A3.containsFalse).toEqual({ decision: 'deny', source: 'default', effect: 'deny', lane: undefined, ruleIndex: undefined })
    // rootKey 'k_A' vs operation key 'k_B' — still matches (A3 never
    // compares keys; the A5 seam computed the boolean).
    expect(A3.rootKeyIgnored).toEqual({ decision: 'allow', source: 'rule', effect: 'allow', lane: 'allow', ruleIndex: 0 })
  })

  it('the tool must match; file-class operations only; deny > ask > allow with RULE provenance', () => {
    expect(A3.toolMismatch).toEqual({ decision: 'deny', source: 'default', effect: 'deny', lane: undefined, ruleIndex: undefined })
    expect(A3.shellOperationNoMatch).toEqual({ decision: 'deny', source: 'default', effect: 'deny', lane: undefined, ruleIndex: undefined })
    expect(A3.priorityDenyWins).toEqual({ decision: 'deny', source: 'rule', effect: 'deny', lane: 'deny', ruleIndex: 0 })
  })

  it('exact and any are unchanged at A3', () => {
    expect(A3.exactMatch).toEqual({ decision: 'allow', source: 'rule', effect: 'allow', lane: 'allow', ruleIndex: 0 })
    expect(A3.exactMismatch).toEqual({ decision: 'deny', source: 'default', effect: 'deny', lane: undefined, ruleIndex: undefined })
    expect(A3.anyMatch).toEqual({ decision: 'allow', source: 'rule', effect: 'allow', lane: 'allow', ruleIndex: 0 })
    expect(A3.defaultDeny).toEqual({ decision: 'deny', source: 'default', effect: 'deny', lane: undefined, ruleIndex: undefined })
  })
})

describe('A2C-7 G1-G4 — root itself / child / deep descendant / sibling (fake backend)', () => {
  it('the root itself matches (directory root and file root)', () => {
    expect(FLOWS.g1DirRoot.decisionKind).toBe('allow')
    expect(FLOWS.g1DirRoot.nextCalls).toBe(1)
    expect((FLOWS.g1DirRoot.request) === undefined).toBe(true)
    expect(FLOWS.g1FileRoot.decisionKind).toBe('allow')
    expect((FLOWS.g1FileRoot.request) === undefined).toBe(true)
  })

  it('a child and a deep descendant match (the subtree the exact lane could not express)', () => {
    expect(FLOWS.g2Child.decisionKind).toBe('allow')
    expect(FLOWS.g2Child.nextCalls).toBe(1)
    expect((FLOWS.g2Child.request) === undefined).toBe(true)
    expect(obsStages(FLOWS.g2Child).includes('decision')).toBe(true)
    const decisionObs = FLOWS.g2Child.observations.find((o) => o.stage === 'decision') as { provenance: Record<string, unknown> }
    expect(decisionObs.provenance.source).toBe('rule')
    expect(FLOWS.g3Deep.decisionKind).toBe('allow')
    expect((FLOWS.g3Deep.request) === undefined).toBe(true)
  })

  it('a sibling is a NON-MATCH (the default outcome, zero interference)', () => {
    expect(FLOWS.g4Sibling.decisionKind).toBe('deny')
    expect(hasFrag(FLOWS.g4Sibling.decisionReason, 'the template\'s default (deny)')).toBe(true)
    expect((FLOWS.g4Sibling.request) === undefined).toBe(true)
    expect(FLOWS.g4Sibling.nextCalls).toBe(0)
  })
})

describe('A2C-7 G11-G13 — exact unchanged / any unchanged / deny>ask>allow (fake backend)', () => {
  it('the exact lane is unchanged; a different-tool rule is NEVER canonicalized (H4: rules that cannot match are never resolved)', () => {
    expect(FLOWS.g11ExactMatch.decisionKind).toBe('allow')
    expect((FLOWS.g11ExactMatch.request) === undefined).toBe(true)
    expect(FLOWS.g11ExactMismatch.decisionKind).toBe('deny')
    expect(hasFrag(FLOWS.g11ExactMismatch.decisionReason, 'the template\'s default (deny)')).toBe(true)
    // The 'write' subtree rule (path 'src') was never resolved by either
    // 'read' decision — only the operation paths and the same-tool exact
    // rule path appear in the resolver call log.
    const calls = FAKE.g11RuleCalls as string[]
    expect(calls.includes('src')).toBe(false)
    expect(calls.includes('src/a.txt')).toBe(true)
  })

  it('any is unchanged: file-class any allow (static allow + external recheck + next) and shell-class any deny', () => {
    expect(FLOWS.g12AnyAllow.decisionKind).toBe('allow')
    expect(FLOWS.g12AnyAllow.nextCalls).toBe(1)
    expect((FLOWS.g12AnyAllow.request) === undefined).toBe(true)
    expect(FLOWS.g12BashAnyDeny.decisionKind).toBe('deny')
    expect(hasFrag(FLOWS.g12BashAnyDeny.decisionReason, 'the template\'s deny rule 0 denies bash')).toBe(true)
    expect((FLOWS.g12BashAnyDeny.request) === undefined).toBe(true)
    expect(FLOWS.g12BashAnyDeny.nextCalls).toBe(0)
  })

  it('deny > ask > allow: a subtree rule in ALL three lanes — the deny lane wins with RULE provenance, zero request rows', () => {
    expect(FLOWS.g13DenyWins.decisionKind).toBe('deny')
    expect(hasFrag(FLOWS.g13DenyWins.decisionReason, 'the template\'s deny rule 0 denies read on /workspace/src/a.txt')).toBe(true)
    expect((FLOWS.g13DenyWins.request) === undefined).toBe(true)
    expect(FLOWS.g13DenyWins.nextCalls).toBe(0)
    expect(FLOWS.g13DenyWins.rowsAfter.requests).toBe(0)
  })
})

describe('A2C-7 G15 — canonicalization failure lanes (plan §9.8, pinned per lane)', () => {
  it('deny subtree, unresolvable root → FAIL CLOSED → deny before A3 (the frozen P1-3 reason, no request, zero next)', () => {
    const f = FLOWS.g15DenyUnresolvable
    expect(f.decisionKind).toBe('deny')
    expect(hasFrag(f.decisionReason, 'a static deny rule could not be canonicalized')).toBe(true)
    expect(hasFrag(f.decisionReason, 'src')).toBe(true)
    expect((f.request) === undefined).toBe(true)
    expect(f.nextCalls).toBe(0)
    const obs = failClosedObs(f)
    expect((obs) !== undefined).toBe(true)
    expect(obs?.paths).toEqual(['src'])
  })

  it('deny subtree, containment UNDETERMINABLE (no opaque handle) → FAIL CLOSED (the rule cannot be dropped)', () => {
    const f = FLOWS.g15DenyUndeterminable
    expect(f.decisionKind).toBe('deny')
    expect(hasFrag(f.decisionReason, 'a static deny rule could not be canonicalized')).toBe(true)
    expect((f.request) === undefined).toBe(true)
    expect(f.nextCalls).toBe(0)
    const obs = failClosedObs(f)
    expect((obs) !== undefined).toBe(true)
    expect(obs?.paths).toEqual(['src'])
    // The A2C-7 additive provenance: the failure cause per path.
    const causes = obs?.causes as { path: string; kind: string; cause: string }[] | undefined
    expect(causes?.[0]?.path).toBe('src')
    expect(causes?.[0]?.kind).toBe('subtree')
  })

  it('deny subtree, the containment seam FAULTS (throws) → undeterminable → FAIL CLOSED (same lane, same contract)', () => {
    const f = FLOWS.g15DenyContainsFault
    expect(f.decisionKind).toBe('deny')
    expect(hasFrag(f.decisionReason, 'a static deny rule could not be canonicalized')).toBe(true)
    expect((f.request) === undefined).toBe(true)
    expect(f.nextCalls).toBe(0)
    expect((failClosedObs(f)) !== undefined).toBe(true)
  })

  it('allow subtree, unresolvable root → NO positive grant → non-match → the default (ask → the ask flow; deny → deny)', () => {
    expect(FLOWS.g15AllowUnresolvableDefaultAsk.decisionKind).toBe('allow')
    expect((FLOWS.g15AllowUnresolvableDefaultAsk.request) !== undefined).toBe(true)
    expect(FLOWS.g15AllowUnresolvableDefaultAsk.nextCalls).toBe(1)
    expect((failClosedObs(FLOWS.g15AllowUnresolvableDefaultAsk)) === undefined).toBe(true)
    expect(FLOWS.g15AllowUnresolvableDefaultDeny.decisionKind).toBe('deny')
    expect(hasFrag(FLOWS.g15AllowUnresolvableDefaultDeny.decisionReason, 'the template\'s default (deny)')).toBe(true)
    expect((FLOWS.g15AllowUnresolvableDefaultDeny.request) === undefined).toBe(true)
    expect(FLOWS.g15AllowUnresolvableDefaultDeny.nextCalls).toBe(0)
    expect((failClosedObs(FLOWS.g15AllowUnresolvableDefaultDeny)) === undefined).toBe(true)
  })

  it('ask subtree, unresolvable root → the rule contributes NOTHING (the P1-3 asymmetry: the ask lane is never reported) → the default', () => {
    const f = FLOWS.g15AskUnresolvable
    expect(f.decisionKind).toBe('deny')
    expect(hasFrag(f.decisionReason, 'the template\'s default (deny)')).toBe(true)
    expect((f.request) === undefined).toBe(true)
    expect(f.nextCalls).toBe(0)
    // NO fail-closed observation for the ask lane (the P1-3 asymmetry pin):
    expect((failClosedObs(f)) === undefined).toBe(true)
    expect(obsStages(f).includes('deny-canonicalization-failure')).toBe(false)
  })

  it('allow subtree, the containment seam FAULTS → undeterminable → non-match (no escalation, no grant minted)', () => {
    const f = FLOWS.g15AllowContainsFault
    expect(f.decisionKind).toBe('deny')
    expect(hasFrag(f.decisionReason, 'the template\'s default (deny)')).toBe(true)
    expect((f.request) === undefined).toBe(true)
    expect(f.nextCalls).toBe(0)
    expect((failClosedObs(f)) === undefined).toBe(true)
  })
})

describe('A2C-7 G16 — cold resume (dispose + fresh install; no stale canonical-rule cache)', () => {
  it('the fresh install follows the CURRENT topology: the stale target is outside, the new target is inside', () => {
    expect(FLOWS.g16T0ViaTarget.decisionKind).toBe('allow')
    expect((FLOWS.g16T0ViaTarget.request) === undefined).toBe(true)
    const stale = FLOWS.g16StaleTargetNoMatch
    expect(stale.decisionKind).toBe('deny')
    expect(hasFrag(stale.decisionReason, 'the template\'s default (deny)')).toBe(true)
    expect((stale.request) === undefined).toBe(true)
    expect(stale.nextCalls).toBe(0)
    expect(FLOWS.g16NewTargetMatches.decisionKind).toBe('allow')
    expect((FLOWS.g16NewTargetMatches.request) === undefined).toBe(true)
  })
})

describe('A2C-7 G5-G10 — the REAL pinned backend (the authority is the real `FileSystem.contains()`)', () => {
  it('the real backend section ran (the prebuilt pinned lib is present on this host)', () => {
    expect(REAL.available).toBe(true)
  })

  it('G5 the prefix trap: the deny rule rooted at `src` does NOT deny the sibling-prefix `src2/f.txt` (the default does); a true child IS denied by the rule', () => {
    const trap = FLOWS2(REAL).g5TrapDefault
    expect(trap.decisionKind).toBe('deny')
    expect(hasFrag(trap.decisionReason, 'the template\'s default (deny)')).toBe(true)
    expect((trap.request) === undefined).toBe(true)
    expect(trap.nextCalls).toBe(0)
    const child = FLOWS2(REAL).g5ChildDenied
    expect(child.decisionKind).toBe('deny')
    expect(hasFrag(child.decisionReason, 'the template\'s deny rule 0 denies read')).toBe(true)
    expect((child.request) === undefined).toBe(true)
  })

  it('G6 relative/absolute aliases: one canonical identity — cross-spelling containment holds both ways', () => {
    const f = FLOWS2(REAL)
    expect(f.g6RelRuleAbsOp.decisionKind).toBe('allow')
    expect((f.g6RelRuleAbsOp.request) === undefined).toBe(true)
    expect(f.g6AbsRuleRelOp.decisionKind).toBe('allow')
    expect((f.g6AbsRuleRelOp.request) === undefined).toBe(true)
  })

  it('G7 `..` traversal: the traversal spelling canonicalizes to the SAME identity — containment holds', () => {
    const c = REAL.cases?.traversal as { directKey: string; traversalKey: string; sameIdentity: boolean; containsDirect: boolean }
    expect(c.sameIdentity).toBe(true)
    expect(c.containsDirect).toBe(true)
    expect(FLOWS2(REAL).g7Traversal.decisionKind).toBe('allow')
    expect((FLOWS2(REAL).g7Traversal.request) === undefined).toBe(true)
  })

  it('G8 casing semantics BY BACKEND: this (case-sensitive) backend treats the case variant as a DIFFERENT identity → non-match (the module never case-folds; the Windows delta is recorded)', () => {
    const c = REAL.cases?.casing as { baseKey: string; variantKey: string; caseSensitiveBackend: boolean; containsVariant: boolean }
    expect(c.caseSensitiveBackend).toBe(true)
    expect(c.containsVariant).toBe(false)
    expect(FLOWS2(REAL).g8CaseVariantNoMatch.decisionKind).toBe('deny')
    expect(hasFrag(FLOWS2(REAL).g8CaseVariantNoMatch.decisionReason, 'the template\'s default (deny)')).toBe(true)
    expect((FLOWS2(REAL).g8CaseVariantNoMatch.request) === undefined).toBe(true)
  })

  it('G9 symlink alias identity: the rule `./alias` matches the TARGET\'s own paths (and the alias spelling)', () => {
    const c = REAL.cases?.aliasIdentity as { aliasKey: string; dirAKey: string; sameIdentity: boolean }
    expect(c.sameIdentity).toBe(true)
    const f = FLOWS2(REAL)
    expect(f.g9ViaTargetPath.decisionKind).toBe('allow')
    expect((f.g9ViaTargetPath.request) === undefined).toBe(true)
    expect(f.g9ViaAliasPath.decisionKind).toBe('allow')
    expect((f.g9ViaAliasPath.request) === undefined).toBe(true)
  })

  it('G10 junction retarget — the H4 fresh-decision proof: one install, the authority FOLLOWS the new target on the next decision (no install-time freeze)', () => {
    const f = FLOWS2(REAL)
    expect(f.g10T0TargetMatches.decisionKind).toBe('allow')
    const oldTarget = f.g10T1OldTargetNoMatch
    expect(oldTarget.decisionKind).toBe('deny')
    expect(hasFrag(oldTarget.decisionReason, 'the template\'s default (deny)')).toBe(true)
    expect((oldTarget.request) === undefined).toBe(true)
    expect(f.g10T1NewTargetMatches.decisionKind).toBe('allow')
    expect((f.g10T1NewTargetMatches.request) === undefined).toBe(true)
  })

  it('G1 (real) the root itself matches on the real backend (contains(self) = true)', () => {
    const c = REAL.cases?.rootItself as { containsSelf: boolean }
    expect(c.containsSelf).toBe(true)
    expect(FLOWS2(REAL).g1RealRootItself.decisionKind).toBe('allow')
    expect((FLOWS2(REAL).g1RealRootItself.request) === undefined).toBe(true)
  })
})

/** The real section's flow set (typed access). */
function FLOWS2(real: RealSectionData): RealFlows {
  return real.flows as unknown as RealFlows
}
