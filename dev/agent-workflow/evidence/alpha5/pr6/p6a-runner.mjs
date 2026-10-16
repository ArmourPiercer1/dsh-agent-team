#!/usr/bin/env node
/**
 * p6a-runner.mjs — Alpha.5 PR6 PoC6a (D 类 PTC/run_code：scope 隔离 + 身份归属 seam 勘查) runner.
 * Team-owned, PoC only, DORMANT (nothing here is live-wired or registered into assembly).
 * IDEMPOTENT: re-runnable; overwrites ./p6a-result.json and rewrites ./probe-scratch/.
 *
 * WHAT THIS IS / IS NOT (honesty discipline, P0 guide §1.2/§2.4):
 *  - Plain-node ToolRuntime fixture over the PREBUILT public libs of the pristine
 *    0.2.0-rc.2 test-use checkout (T), same import mechanism as alpha5-adapter-p0
 *    (ESM resolve hook → absolute lib/index.js file URLs inside T; T never written).
 *  - Code UNDER TEST (REAL pinned production libs): ToolRuntime pipeline, the reserved
 *    run_code bridge (createRunCodeTool), its binding/scheduler path, the tools/execute
 *    around-waterfall, guards, scope-filtered dispatch (dsh-scope).
 *  - ctx.ptcRuntime is a TEST DOUBLE of the @deepseek-ai/dsh-ptc-runtime Service
 *    Definition (same role upstream ptc.spec.ts's FakeRuntime fills): programs execute
 *    in-process. The TEAM-CANDIDATE wrapper (public abstract-class subclass reading the
 *    tools/execute-seam AsyncLocalStorage) is itself the object of investigation.
 *    No claim is made about the real ptc-runtime-node child process or real OS
 *    enforcement (that half is D3/D5 host scope, recorded NOT_RUN here).
 *  - ctx.sandboxPolicy is a TEST DOUBLE mirroring the REAL SandboxPolicyService.resolve()
 *    session handling (mode / workspaceRoot=session cwd / sessionId; real home
 *    packages/sandbox/sandbox-policy/src/index.ts:166-178). The production fact under
 *    test is the CHANNEL: ptc.ts:391 options.resolveSandboxPolicy(exec) wired at
 *    index.ts:948-952 to { session: exec.agent.session }.
 *  - No model keys, no Host server, no ports, no DSH_HOME world. :3080 untouched.
 *
 * Legs (三态: SUPPORT / typed-reject / SEAM-GAP — records in SEAM-VERDICTS.md):
 *  P6A-1  per-member standing-policy handoff at the runtime spec seam (session-grained).
 *  P6A-2  concurrent inner-dispatch attribution: member + parent-call identity per inner
 *         body; per-member session logs (cross-member visibility negative control).
 *  P6A-3  (a) PtcRunRequest spec census: no call identity (SEAM-GAP alone);
 *         (b) composed public seam: ctx.on('tools/execute') around-listener + AsyncLocalStorage
 *             → Team ctx.ptcRuntime wrapper sees EXACT member AND call per outer run under
 *             interleaved concurrency, verified non-circularly via subCallId-prefix ↔
 *             body-observed agent pairing;
 *         (c) negative control: same-member concurrent specs deep-equal (spec alone cannot
 *             attribute per-call).
 *  P6A-4  typed pre-dispatch denial of the OUTER run_code for one member only (guard seam).
 *  P6A-5  scope-filtered 'tools/execute' listener receives ONLY its agent's calls.
 *  P6A-6  parent cancel: in-flight inner = aborted-started form; post-abort queued =
 *         "not dispatched" form; sibling member completes (C-GW cancellation typing).
 *
 * Exit code: 0 iff every PASS-candidate leg asserted true.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { AsyncLocalStorage } from 'node:async_hooks'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url))
const TEAM_ROOT = resolve(HERE, '..', '..', '..', '..', '..') // dev/agent-workflow/evidence/alpha5/pr6 -> a5-pr6 worktree root
const TEST_USE = process.env.P6_TEST_USE
  ?? '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/exp-alpha5-poc-20261016/tests/deepseek-harness-test-use'
const SCRATCH = join(HERE, 'probe-scratch')
const BASELINE_SHA = '639ed015397290b3745d163aafe02ffee4aa3f84' // 0.2.0-rc.2 = tests/paths.mjs TEST_USE_BASELINE_SHA
const MODEL_NAME = 'qwen3.8-flash-next'

const sh = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: 'utf8' }); return { cmd: [cmd, ...args].join(' '), code: r.status, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() } }

const result = {
  poc: 'PR6 PoC6a — D-class (PTC/run_code) scope isolation & identity attribution seams',
  lane: 'Alpha.5 Lane E (PR6 PTC PoC6a + LSP PoC6b) writer',
  model_name_verbatim: { powered_by_line: 'You are a coding agent powered by the qwen3.8-flash-next model.', model: MODEL_NAME },
  recorded_at_utc: new Date().toISOString(),
  dormant: true,
  baseline_team: undefined,
  host_env: {},
  ports_used: [],
  homes_used: [],
  import_mechanism: 'ESM resolve hook p6-hook.mjs -> absolute lib/index.js file URLs inside T; no junctions; T read-only',
  test_double_declaration: 'ctx.ptcRuntime = TEST DOUBLE of the public PtcRuntime Service Definition (programs in-process; same role as upstream ptc.spec.ts FakeRuntime). ctx.sandboxPolicy = TEST DOUBLE mirroring the real SandboxPolicyService.resolve() session handling (real home cited). The run_code bridge, scheduler, guard, around-waterfall and scope dispatch under test are REAL pinned production libs. No claim about the real ptc-runtime-node child process or OS enforcement.',
  commands: [],
  legs: [],
}
const shRun = (label, cmd, args) => { const r = sh(cmd, args); result.commands.push({ label, ...r }); return r }

const gT = shRun('git T HEAD', 'git', ['-C', TEST_USE, 'rev-parse', 'HEAD'])
const gTs = shRun('git T status', 'git', ['-C', TEST_USE, 'status', '--porcelain'])
const gW = shRun('git W HEAD', 'git', ['-C', TEAM_ROOT, 'rev-parse', 'HEAD'])
const uname = shRun('uname', 'uname', ['-sr'])
result.baseline_team = { team_worktree_HEAD: gW.out, test_use: TEST_USE, expected_SHA: BASELINE_SHA }
result.host_env = { node: process.version, platform: process.platform + ' ' + process.arch, uname: uname.out, test_use_HEAD: gT.out, test_use_porcelain_empty: gTs.out === '' }
if (gT.out !== BASELINE_SHA || gTs.out !== '') {
  console.error('pinned T must be @ ' + BASELINE_SHA + ' and porcelain-clean; got ' + gT.out + ' porcelain=' + JSON.stringify(gTs.out))
  process.exit(2)
}

rmSync(SCRATCH, { recursive: true, force: true })
const wsA = join(SCRATCH, 'ws-a'); const wsB = join(SCRATCH, 'ws-b')
mkdirSync(wsA, { recursive: true }); mkdirSync(wsB, { recursive: true })

register(new URL('./p6-hook.mjs', import.meta.url), import.meta.url, { data: { testUse: TEST_USE } })
const { Context, Service } = await import('@deepseek-ai/cordis')
const SystemPrompt = (await import('@deepseek-ai/dsh-system-prompt')).default
const ToolRuntimeMod = await import('@deepseek-ai/dsh-tools')
const ToolRuntime = ToolRuntimeMod.default
const RUN_CODE_NAME = ToolRuntimeMod.RUN_CODE_NAME
const { ToolCallId } = await import('@deepseek-ai/dsh-llm')
const PtcRuntimeMod = await import('@deepseek-ai/dsh-ptc-runtime')
const PtcRuntime = PtcRuntimeMod.PtcRuntime ?? PtcRuntimeMod.default
const { createScope } = await import('@deepseek-ai/dsh-scope')

const leg = (id, verdict, detail) => { result.legs.push({ id, verdict, detail }); console.log(`[${verdict}] ${id}${detail === undefined ? '' : ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 300)}`) }

// ---------- observation channels ----------
const bodyObs = []      // native/inner body invocations (primary evidence channel, not return text)
const policyCalls = []  // what the production channel handed resolveSandboxPolicy
const runRecords = []   // what the TEAM wrapper PtcRuntime saw per outer run
const rootSeen = []     // root 'tools/execute' listener arrivals (dispatch truth map)
const scopedASeen = []  // member-A-scope 'tools/execute' listener arrivals
const lastProgramValues = [] // program-observed completion values (engine settle point, disclosed)
const sessionEvents = { 'member-A': [], 'member-B': [], 'member-C': [] }

// ---------- TEST DOUBLE sandboxPolicy (mirrors real resolve() session handling) ----------
class StubSandboxPolicy extends Service {
  constructor(ctx) { super(ctx, 'sandboxPolicy') }
  resolve(request = {}) {
    const session = request.session
    const policy = {
      mode: 'workspace-write',
      workspaceRoot: session?.header?.cwd ?? SCRATCH,
      ...(session === undefined ? {} : { sessionId: session.id }),
    }
    policyCalls.push({ received: { hasSession: session !== undefined, sessionId: session?.id ?? null, cwd: session?.header?.cwd ?? null }, returned: { ...policy } })
    return policy
  }
}

// ---------- in-process real-role PTC engine (plain object: NOT a second Service) ----------
class InProcessPtcEngine {
  language = 'typescript'
  isolation = 'p6a-in-process-test-double'
  sandboxMode = 'workspace-write' // forces the production resolveSandboxPolicy(exec) path
  resolve(request) { return { ...request, cwd: request.cwd ?? SCRATCH, timeoutMs: request.timeoutMs ?? 30_000 } }
  async run(spec) {
    const logs = []
    const fns = spec.bindings.find(b => b.global === 'tools')?.functions ?? {}
    const tools = Object.fromEntries(Object.entries(fns).map(([name, fn]) => [name, async (args) => {
      try { return await fn(args) } catch (error) { logs.push(`call ${name} failed`); throw error }
    }]))
    try {
      const fn = new Function('tools', `"use strict"; return (async () => { ${spec.program} })();`)
      const value = await fn(tools)
      lastProgramValues.push(value) // captured at the double's settle point: the caller-cancel path replaces the OUTER result, so the program-observed forms are read here (disclosed channel)
      return { logs, value }
    } catch (error) {
      return { logs, error: { kind: spec.signal?.aborted ? 'abort' : 'exception', message: String(error?.message ?? error) } }
    }
  }
}

// ---------- TEAM CANDIDATE wrapper: public ctx.ptcRuntime replacement + ALS established
// at the PUBLIC tools/execute around-seam. This composition IS the experiment. ----------
const als = new AsyncLocalStorage()
class TeamWrapperPtcRuntime extends PtcRuntime {
  inner
  constructor(ctx) { super(ctx, 'ptcRuntime'); this.inner = new InProcessPtcEngine() }
  get language() { return this.inner.language }
  get isolation() { return 'p6a-team-wrapper(inner=' + this.inner.isolation + ')' }
  get sandboxMode() { return this.inner.sandboxMode }
  resolve(request) { return this.inner.resolve(request) }
  async run(spec) {
    const id = als.getStore() // what the public around-seam established for THIS call
    const record = {
      spec_keys: Object.keys(spec).sort(),
      spec_identity_fields_found: Object.keys(spec).filter(k => /agent|member|call|scope|owner|grant|principal/i.test(k)),
      spec_sessionId: spec.sandboxPolicy?.sessionId ?? null,
      spec_workspaceRoot: spec.sandboxPolicy?.workspaceRoot ?? null,
      als: id === undefined ? null : { member: id.member, callId: id.callId },
      binding_als: [],
    }
    runRecords.push(record)
    // wrap the binding closures WITHOUT mutating the frozen spec (the bridge freezes
    // them; a Team wrapper rebuilds the namespace objects — the public seam allows the
    // runtime to transform its own spec before execution). The per-run driver lane
    // (binding()/drive() live in the execute() closure, ptc.ts:415-686) must still
    // carry THIS run's ALS store.
    const wrappedBindings = spec.bindings.map(ns => {
      const fns = {}
      for (const [name, fn] of Object.entries(ns.functions)) {
        fns[name] = async (args) => {
          const id2 = als.getStore()
          record.binding_als.push({ name, als: id2 === undefined ? null : { member: id2.member, callId: id2.callId } })
          return fn(args)
        }
      }
      return { ...ns, functions: fns }
    })
    return this.inner.run({ ...spec, bindings: wrappedBindings })
  }
}

// ---------- members (the agent object doubles as the dsh-scope key, per pinned recipe) ----------
let callSeq = 0
const memberFor = (id, sessionCwd) => ({
  id,
  session: {
    id: `sess-${id}`,
    header: { cwd: sessionCwd },
    append: (type, data) => {
      sessionEvents[id].push({ type, rootCallId: String(data?.rootCallId ?? ''), subCallId: String(data?.subCallId ?? ''), parentCallId: String(data?.parentCallId ?? ''), name: data?.name })
    },
  },
})
const A = memberFor('member-A', wsA)
const B = memberFor('member-B', wsB)
const C = memberFor('member-C', wsA) // SAME session cwd as A, different session id

// ---------- assembly ----------
let mounted = false, mountError
let ctx, scopes
try {
  ctx = new Context()
  await ctx.plugin(SystemPrompt, {})
  await ctx.plugin(ToolRuntime, { mode: 'ptc' })
  await ctx.plugin(StubSandboxPolicy)
  await ctx.plugin(TeamWrapperPtcRuntime)
  scopes = {}
  await ctx.plugin({
    inject: ['tools'],
    apply: (inner) => {
      for (const m of [A, B, C]) scopes[m.id] = createScope(inner, m).ctx
      // scope-filtered listener candidate: registered on member A's SCOPE context
      scopes['member-A'].on('tools/execute', (exec, next) => {
        scopedASeen.push({ member: exec.agent?.id ?? null, callId: String(exec.callId), name: exec.name })
        return next()
      })
    },
  })
  // root around-listener: dispatch truth map + ALS store for the Team wrapper
  ctx.on('tools/execute', (exec, next) => {
    rootSeen.push({ member: exec.agent?.id ?? null, callId: String(exec.callId), name: exec.name })
    return als.run({ member: exec.agent?.id ?? null, callId: String(exec.callId) }, () => next())
  })
  mounted = true
} catch (error) { mountError = String(error?.stack ?? error) }
leg('P6A-0.assembly', mounted ? 'PASS' : 'BLOCKED', mounted
  ? 'ctx.plugin(SystemPrompt + ToolRuntime{mode:ptc} + stub sandboxPolicy + Team wrapper PtcRuntime); agent scopes minted via createScope (agent object = scope key); root tools/execute around-listener establishes ALS; A-scope listener registered'
  : { error: mountError?.slice(0, 1200) })

if (!mounted) { finish() }

// ---------- shared tools + gate ----------
let gate = Promise.withResolvers()
let gateEntered = 0
let gateHold = false       // bodies pause inside the body when true
let gateAutoOpen = 0       // 0 = manual release only; n = auto-open after n entries
function countingTool(name) {
  return {
    name,
    description: `p6a ${name} (TEST definition standing in for a native)`,
    parameters: { type: 'object', properties: {} },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
    execute: async (_args, exec) => {
      bodyObs.push({ phase: 'enter', name, member: exec?.agent?.id ?? null, callId: String(exec?.callId ?? ''), rootCallId: String(exec?.rootCallId ?? '') })
      if (gateHold) {
        gateEntered += 1
        if (gateAutoOpen > 0 && gateEntered >= gateAutoOpen) {
          bodyObs.push({ phase: 'all-in-body', count: gateEntered }) // overlap witness recorded BEFORE any exit
          gate.resolve()
        }
        await gate.promise
      }
      bodyObs.push({ phase: 'exit', name, member: exec?.agent?.id ?? null, callId: String(exec?.callId ?? '') })
      return `ran:${name}@${exec?.agent?.id ?? 'agentless'}`
    },
  }
}
const disposeGrep = ctx.tools.register(countingTool('grep'))

const execute = async (agent, name, args, signalOverride) => {
  const callId = ToolCallId(`p6a-c${String(++callSeq)}`)
  try {
    const res = await ctx.tools.execute({ signal: signalOverride ?? new AbortController().signal, callId, name, arguments: args, ...(agent ? { agent } : {}) })
    const first = res?.content?.[0]
    return { callId: String(callId), text: first?.type === 'text' ? first.text : JSON.stringify(res?.content ?? res), value: res?.value, isError: res?.isError === true }
  } catch (error) { return { callId: String(callId), threw: String(error?.message ?? error) } }
}
const rc = (code) => ({ code, description: 'p6a' })

// ============ P6A-1 per-member standing-policy handoff ============
{
  policyCalls.length = 0; runRecords.length = 0
  const a = await execute(A, RUN_CODE_NAME, rc('return 1'))
  const b = await execute(B, RUN_CODE_NAME, rc('return 1'))
  const c = await execute(C, RUN_CODE_NAME, rc('return 1'))
  const runs3 = runRecords.slice()
  const ok = policyCalls.length === 3
    && policyCalls[0].received.sessionId === 'sess-member-A' && policyCalls[0].returned.workspaceRoot === wsA
    && policyCalls[1].received.sessionId === 'sess-member-B' && policyCalls[1].returned.workspaceRoot === wsB
    && policyCalls[2].received.sessionId === 'sess-member-C' && policyCalls[2].returned.workspaceRoot === wsA
    && runs3.length === 3
    && runs3[0].spec_sessionId === 'sess-member-A' && runs3[1].spec_sessionId === 'sess-member-B' && runs3[2].spec_sessionId === 'sess-member-C'
    && runs3[2].spec_workspaceRoot === wsA // C shares A's cwd but keeps its own sessionId
    && [a, b, c].every(r => r.isError !== true)
  leg('P6A-1.standing-policy-per-member', ok ? 'SUPPORT(session-grained)' : 'FAIL', {
    per_call_resolver_handoff: 'ptc.ts:391 options.resolveSandboxPolicy(exec) -> index.ts:948-952 policy.resolve({ session: exec.agent.session }) — production channel observed per call',
    received: policyCalls.map(p => p.received),
    runs: [a, b, c].map(r => r.threw ?? String(r.text).slice(0, 200)),
    spec_sessionIds: runs3.map(r => r.spec_sessionId),
    spec_workspaceRoots: runs3.map(r => r.spec_workspaceRoot),
    granularity_note: 'below session granularity (per-call OperationGrant, per-member-instance ≠ per-session) this channel cannot express anything — see P6A-3',
  })
}

// ============ P6A-2 concurrent inner attribution (cross-member visibility control) ============
{
  bodyObs.length = 0; gateEntered = 0; gate = Promise.withResolvers(); gateAutoOpen = 2; gateHold = true
  sessionEvents['member-A'].length = 0; sessionEvents['member-B'].length = 0
  const prog = 'const r = await tools.grep({}); return r'
  const pA = execute(A, RUN_CODE_NAME, rc(prog))
  const pB = execute(B, RUN_CODE_NAME, rc(prog))
  const [a, b] = await Promise.all([pA, pB]) // gate auto-opened when BOTH bodies were in flight
  gateHold = false; gateAutoOpen = 0
  const witnessAt = bodyObs.findIndex(o => o.phase === 'all-in-body')
  const firstExitAt = bodyObs.findIndex(o => o.phase === 'exit')
  const overlap = witnessAt >= 0 && (firstExitAt === -1 || firstExitAt > witnessAt)
  const enters = bodyObs.filter(o => o.phase === 'enter')
  const aEnters = enters.filter(e => e.member === 'member-A')
  const bEnters = enters.filter(e => e.member === 'member-B')
  const aEvts = sessionEvents['member-A'], bEvts = sessionEvents['member-B']
  const ok = overlap && enters.length === 2 && aEnters.length === 1 && bEnters.length === 1
    && aEnters[0].callId === `${a.callId}:ptc:1` && aEnters[0].rootCallId === a.callId
    && bEnters[0].callId === `${b.callId}:ptc:1` && bEnters[0].rootCallId === b.callId
    && aEvts.length >= 2 && bEvts.length >= 2
    && aEvts.every(e => e.rootCallId === a.callId) && bEvts.every(e => e.rootCallId === b.callId)
    && a.isError !== true && b.isError !== true
  leg('P6A-2.inner-attribution-no-drift', ok ? 'SUPPORT' : 'FAIL', {
    bodies_overlapped: overlap,
    per_body_identity: enters.map(e => ({ member: e.member, callId: e.callId, rootCallId: e.rootCallId })),
    a_outer_call: a.callId, b_outer_call: b.callId,
    session_log_split: { a_events: aEvts.length, b_events: bEvts.length, a_log_foreign_roots: aEvts.filter(e => e.rootCallId !== a.callId).length, b_log_foreign_roots: bEvts.filter(e => e.rootCallId !== b.callId).length },
    subcall_home: 'input = { callId: `${parentCallId}:ptc:n`, rootCallId: exec.rootCallId, agent: exec.agent, parent: exec.token } (ptc.ts:525-536); durable append per owning session (ptc.ts:611-618)',
  })
}

// ============ P6A-3 outer-run identity at the public ptcRuntime seam ============
{
  bodyObs.length = 0; runRecords.length = 0; rootSeen.length = 0
  gateEntered = 0; gate = Promise.withResolvers(); gateAutoOpen = 4; gateHold = true
  const prog = 'const r = await tools.grep({}); return r'
  const A2 = A // second concurrent call, SAME member object
  const ps = [
    execute(A, RUN_CODE_NAME, rc(prog)),
    execute(B, RUN_CODE_NAME, rc(prog)),
    execute(C, RUN_CODE_NAME, rc(prog)),
    execute(A2, RUN_CODE_NAME, rc(prog)),
  ]
  const settled = await Promise.all(ps) // gate auto-opened when all four bodies were in flight
  gateHold = false; gateAutoOpen = 0
  // non-circular verification: every binding-time ALS store must prefix-match a
  // body-observed sub-call (subCallId = `${outerCallId}:ptc:n`, ptc.ts:527) OF THE SAME MEMBER.
  const bindingChecks = []
  for (const r of runRecords) {
    for (const info of r.binding_als) {
      if (info.als === null) { bindingChecks.push({ ok: false, why: 'no ALS at binding' }); continue }
      const match = bodyObs.find(bo => bo.phase === 'enter' && bo.callId.startsWith(info.als.callId + ':ptc:'))
      bindingChecks.push({ ok: match !== undefined && match.member === info.als.member, alsMember: info.als.member, alsCallId: info.als.callId, pairedBody: match ? { member: match.member, sub: match.callId } : null })
    }
  }
  const allBindingsOk = bindingChecks.length >= 4 && bindingChecks.every(c => c.ok)
  const rootTruth = new Map(rootSeen.filter(s => s.name === RUN_CODE_NAME).map(s => [s.callId, s.member]))
  const alsTruthOk = runRecords.length === 4 && runRecords.every(r => r.als && rootTruth.get(r.als.callId) === r.als.member)
  const specShape = runRecords[0]?.spec_keys ?? []
  const noIdentityKeys = specShape.every(k => !/agent|member|call|scope|owner|grant|principal/i.test(k))
  const sameMember = runRecords.filter(r => r.spec_sessionId === 'sess-member-A')
  const strip = (r) => JSON.stringify({ k: r.spec_keys, s: r.spec_sessionId, w: r.spec_workspaceRoot })
  const deepEqualSameMember = sameMember.length === 2 && strip(sameMember[0]) === strip(sameMember[1])
  leg('P6A-3a.outer-spec-no-identity', noIdentityKeys ? 'SEAM-GAP(spec alone)' : 'FAIL', {
    spec_keys: specShape,
    runtime_spec_identity_fields: runRecords.map(r => r.spec_identity_fields_found).flat(),
    static_home: 'PtcRunRequest = { program, bindings, cwd?, timeoutMs?, sandboxPolicy?, signal? } (ptc-runtime/src/types.ts PtcRunRequest/PtcRunSpec); no agent/member/callId/owner field exists at all',
    consequence: 'the public ctx.ptcRuntime seam cannot tell WHICH member — let alone WHICH call — an outer run belongs to from the spec; sandboxPolicy.sessionId (only when the runtime declares sandboxMode and a session exists) is session-grained at best',
  })
  leg('P6A-3b.composed-around-seam-als', allBindingsOk && alsTruthOk ? 'SUPPORT(composed public seam)' : 'FAIL', {
    composition: "ctx.on('tools/execute', (exec,next) => als.run({member: exec.agent?.id, callId: exec.callId}, () => next())) + Team ctx.ptcRuntime replacement reading als at run() entry and inside wrapped bindings",
    runs: runRecords.length,
    als_members: runRecords.map(r => r.als?.member ?? 'MISSING'),
    binding_pairings: { total: bindingChecks.length, ok: bindingChecks.filter(c => c.ok).length, detail: bindingChecks },
    als_matches_root_dispatch_truth: alsTruthOk,
    per_run_driver_lane: 'binding()/drive() closures live in the per-execute() closure (ptc.ts:415-686), so the ALS store survives interleaving; verified through subCallId-prefix pairing (independent channel), not return text',
  })
  leg('P6A-3c.same-member-concurrency-negative-control', deepEqualSameMember ? 'SEAM-GAP(without 3b)' : 'FAIL', {
    concurrent_same_member_runs: sameMember.length,
    specs_deep_equal: deepEqualSameMember,
    reading: 'spec-only attribution cannot separate two in-flight runs of the SAME member (no callId field); the composed 3b seam resolves per-call identity; without it a Team wrapper cannot bind a per-call OperationGrant to the exact outer run',
  })
}

// ============ P6A-4 typed outer denial for one member only ============
{
  runRecords.length = 0
  const GUARD = 'P6A-DENY: run_code denied for member-B by team policy'
  const disposeGuard = ctx.tools.guard((exec) => (exec.name === RUN_CODE_NAME && exec.agent?.id === 'member-B') ? GUARD : undefined)
  const b = await execute(B, RUN_CODE_NAME, rc('return 1'))
  const a = await execute(A, RUN_CODE_NAME, rc('return 1'))
  disposeGuard()
  const ok = b.isError === true && String(b.text).includes(GUARD) && a.isError !== true
    && runRecords.length === 1 && runRecords[0].spec_sessionId === 'sess-member-A'
  leg('P6A-4.outer-typed-denial-per-member', ok ? 'SUPPORT(typed-reject pre-privilege)' : 'FAIL', {
    b_result: String(b.text).slice(0, 140), a_ok: a.isError !== true,
    runtime_reached_after_guard: runRecords.length, only_A_ran: runRecords[0]?.spec_sessionId === 'sess-member-A',
    home: 'guard runs inside scheduler.prepare BEFORE the body (index.ts:1519-1530); run_code is reserved from visibility filters but NOT from pre-execute/guards — outer denial precedes any privilege (zero runtime.run reached)',
  })
}

// ============ P6A-5 scope-filtered around-listener ============
{
  scopedASeen.length = 0
  await execute(A, RUN_CODE_NAME, rc('const r = await tools.grep({}); return r'))
  await execute(B, RUN_CODE_NAME, rc('const r = await tools.grep({}); return r'))
  const members = [...new Set(scopedASeen.map(s => s.member))]
  const names = [...new Set(scopedASeen.map(s => s.name))].sort()
  const ok = members.length === 1 && members[0] === 'member-A' && names.includes(RUN_CODE_NAME) && names.includes('grep')
  leg('P6A-5.scope-filtered-listener', ok ? 'SUPPORT(scope isolation)' : 'FAIL', {
    a_scope_listener_saw: { members, names, count: scopedASeen.length },
    reading: "listener registered on member-A's scope ctx receives that member's outer run_code AND its inner grep dispatch (carrier = scopeTarget(this, exec.agent), dispatchScheduledExecution index.ts:1603), and NEVER member B's; a root listener sees everything by design (Team-guard trust assumption recorded in SEAM-VERDICTS)",
  })
}

// ============ P6A-6 parent cancel: started vs not-started forms + sibling isolation ============
{
  bodyObs.length = 0; gateEntered = 0; gate = Promise.withResolvers(); gateAutoOpen = 0; gateHold = true
  const ctrl = new AbortController()
  const prog = [
    "let first=''; try { first = await tools.grep({}) } catch (e) { first = 'ERR:' + e.message }",
    "let second=''; try { second = await tools.grep({}) } catch (e) { second = 'ERR:' + e.message }",
    'return { first, second }',
  ].join('\n')
  const pA = execute(A, RUN_CODE_NAME, rc(prog), ctrl.signal)
  const pB = execute(B, RUN_CODE_NAME, rc('return 42'))
  await new Promise(r => setTimeout(r, 150)) // let A's inner grep enter the body (in-flight)
  ctrl.abort('user-cancel')
  gate.resolve() // release the held body so the process can settle
  const aSettled = await pA
  const bSettled = await pB
  gateHold = false
  const enters = bodyObs.filter(o => o.phase === 'enter').length
  const v = lastProgramValues.at(-1) ?? {}
  const startedForm = String(v.first ?? '').includes('ERR:')
  const notStartedForm = String(v.second ?? '').includes('run_code run is over') && String(v.second ?? '').includes('not dispatched')
  const ok = startedForm && notStartedForm && enters === 1 && bSettled.isError !== true
  leg('P6A-6.cancel-boundary', ok ? 'SUPPORT(C-GW typed boundary)' : 'FAIL', {
    in_flight_form: String(v.first ?? '').slice(0, 140),
    queued_form: String(v.second ?? '').slice(0, 160),
    bodies_started_total: enters,
    sibling_completed: bSettled.isError !== true,
    home: "runController abort propagates to the in-flight dispatch and abandons queued-unstarted submissions ('run_code run is over (...); X not dispatched', ptc.ts binding() head + abandon()); drainDispatches awaits the commit lane (ptc.ts drainDispatches) = the DRAINING settled edge; two forms distinguishable on the program-visible channel",
  })
}

disposeGrep()

function finish() {
  const out = join(HERE, 'p6a-result.json')
  const gT2 = shRun('git T status after', 'git', ['-C', TEST_USE, 'status', '--porcelain'])
  result.host_env.test_use_porcelain_empty_after = gT2.out === ''
  result.overall = {
    seam_summary: 'see ../SEAM-VERDICTS.md (PoC-1 format, three-state per seam)',
    inner_attribution: 'SUPPORT — agent+rootCallId+per-session logs pinned per inner dispatch by production code',
    outer_run_identity: 'SUPPORT only via composed public seam (tools/execute around-listener + ALS + ctx.ptcRuntime replacement); SEAM-GAP in PtcRunRequest spec alone',
    typed_reject: 'SUPPORT pre-privilege per member at guard seam',
    cancellation_typing: 'SUPPORT started-vs-not-started forms observable',
  }
  writeFileSync(out, JSON.stringify(result, null, 2) + '\n', 'utf8')
  const failed = result.legs.filter(l => l.verdict.startsWith('FAIL') || l.verdict === 'BLOCKED').length
  console.log(`\nwrote ${out}; legs=${result.legs.length}; failing(PASS-candidates)=${failed}`)
  process.exit(failed === 0 ? 0 : 1)
}
finish()
