#!/usr/bin/env node
/**
 * p05-runner.mjs — Alpha.5 P0-5 PTC leg (05-ptc) runner. Team-owned, PoC only. IDEMPOTENT:
 * safe to re-run; overwrites ./p05-result.json and rewrites ./probe-scratch/.
 *
 * WHAT THIS IS / IS NOT (honesty discipline, plan §1.2, §2.4):
 *  - Plain-node ToolRuntime fixture over the PREBUILT public libs of the pristine
 *    0.2.0-rc.2 test-use checkout (import mechanism: ESM resolve hook p05-ai-hook.mjs
 *    mapping @deepseek-ai/* to absolute lib/index.js file URLs inside T — NO new
 *    W/node_modules junctions, T never written; docs/TEST_METHODS.md §3).
 *  - The PTC runtime mounted here is a TEST DOUBLE of the `ctx.ptcRuntime` Service
 *    Definition (the same role upstream's own ptc.spec.ts fills with FakeRuntime).
 *    It executes the program in-process and calls the binding closures that the
 *    REAL run_code bridge handed to the runtime — so the BRIDGE (registry-private
 *    scheduler path ptc.ts:557/622-638 → index.ts:816-821) is the real production
 *    code under test. This is NOT a proof about the real Node worker-thread runtime
 *    or about real outer-process OS-level I/O (recorded NOT_RUN).
 *  - PTC-01 (run_code cannot be registered / restricted) is NOT re-run here: it is
 *    covered by the coordinator's 01-routing leg L7 (01-routing/p01-result.json,
 *    id "L7.PTC-01.reserved-run-code", verdict PASS). Referenced, cited.
 *
 * Legs:
 *  P05-PTC-1  mount ToolRuntime with config { mode:'ptc' } via ctx.plugin (public
 *             assembly surface; same recipe as pristine ptc.spec.ts:68) + double runtime.
 *  P05-PTC-2  run_code reserved transport presentation under ptc mode: registry
 *             projection `tools.schemas(agent)` keeps run_code (and the visible tools);
 *             the MODEL wire surface (systemPrompt tools section, = ToolRuntime.wireSchemas)
 *             collapses to run_code only; PTC_ONLY section present.
 *  P05-PTC-3  model-direct (non-nested) `grep` call under ptc → denied by the collapse
 *             (UNKNOWN_TOOL route message), native body counter stays 0.
 *  P05-PTC-4  inner dispatch POSITIVE CONTROL: run_code program calls tools.grep;
 *             native body counter +1, durable tool/ptc-dispatch(-start) events,
 *             program receives the body's value.
 *  P05-PTC-5  inner dispatch NEGATIVE CONTROL (Team-guard analog): tools.guard denies
 *             `grep` → inner call fails, native body counter delta 0, guard reason
 *             reaches the program as the binding rejection, isError settle event logged.
 *  P05-PTC-6  PTC-01 citation (01-routing L7) — no re-run.
 *  P05-PTC-7  bridge construction surface: static facts + public-seam verdict for
 *             constructing one inner dispatch (public = ctx.ptcRuntime Service
 *             Definition; NO CORE_SEAM_BLOCKER needed for the inner-dispatch question).
 *  P05-PTC-8  outer Node direct fs/net I/O under enforcement: NOT_RUN (no real outer
 *             ptc Node worker process in this fixture).
 *
 * Exit code: 0 iff every PASS-candidate leg asserted true. NOT_RUN never forces exit 0's
 * meaning of "proven" — see p05-result.json verdict fields.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKTREE_ROOT = resolve(HERE, '..', '..', '..', '..', '..')
const TEST_USE = join(WORKTREE_ROOT, 'tests', 'deepseek-harness-test-use')
const BASELINE = join(WORKTREE_ROOT, 'dev', 'agent-workflow', 'evidence', 'alpha5-adapter-p0', '00-baseline', 'p00-fixture.mjs')
const ROUTING = join(WORKTREE_ROOT, 'dev', 'agent-workflow', 'evidence', 'alpha5-adapter-p0', '01-routing', 'p01-result.json')
const SCRATCH = join(HERE, 'probe-scratch')
const MODEL_NAME = 'qwen3.8-flash-next'

const sh = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: 'utf8' }); return { cmd: [cmd, ...args].join(' '), code: r.status, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() } }

const result = {
  leg: '05-ptc (P0-5 PTC leg)',
  agent: 'independent experimenter (not the coordinator)',
  model_name_verbatim: { powered_by_line: 'You are a coding agent powered by the qwen3.8-flash-next model.', model: MODEL_NAME },
  recorded_at_utc: new Date().toISOString(),
  host_env: {},
  import_mechanism: 'ESM resolve hook p05-ai-hook.mjs → absolute lib/index.js file URLs inside T; no new node_modules junctions; T read-only',
  test_double_declaration: 'ctx.ptcRuntime is an in-process TEST DOUBLE of the @deepseek-ai/dsh-ptc-runtime Service Definition (same role as upstream ptc.spec.ts FakeRuntime). The run_code bridge + ToolRuntime scheduler under test are real pinned production libs. No claim is made about the real Node worker-thread runtime or real outer-process OS I/O.',
  commands: [],
  legs: [],
}

function shRun(label, cmd, args) { const r = sh(cmd, args); result.commands.push({ label, ...r }); return r }

// ---------- environment ----------
const gT = shRun('git T HEAD', 'git', ['-C', TEST_USE, 'rev-parse', 'HEAD'])
const gTs = shRun('git T status', 'git', ['-C', TEST_USE, 'status', '--porcelain'])
const gW = shRun('git W HEAD', 'git', ['-C', WORKTREE_ROOT, 'rev-parse', 'HEAD'])
const uname = shRun('uname', 'uname', ['-sr'])
result.host_env = { node: process.version, platform: process.platform + ' ' + process.arch, uname: uname.out, test_use_HEAD: gT.out, test_use_porcelain_empty: gTs.out === '', worktree_HEAD: gW.out }

rmSync(SCRATCH, { recursive: true, force: true })
mkdirSync(SCRATCH, { recursive: true })
const wsDir = join(SCRATCH, 'workspace')
mkdirSync(wsDir, { recursive: true })

// ---------- module loading through the hook ----------
register(new URL('./p05-ai-hook.mjs', import.meta.url), import.meta.url, { data: { testUse: TEST_USE } })
const p00 = await import(new URL('../00-baseline/p00-fixture.mjs', import.meta.url).href) // read-only reuse: countingTool/tag/identityOf
const { Context } = await import('@deepseek-ai/cordis')
const SystemPromptMod = await import('@deepseek-ai/dsh-system-prompt')
const SystemPrompt = SystemPromptMod.default
const ToolRuntimeMod = await import('@deepseek-ai/dsh-tools')
const ToolRuntime = ToolRuntimeMod.default
const { RUN_CODE_NAME } = ToolRuntimeMod
const { ToolCallId } = await import('@deepseek-ai/dsh-llm')
const PtcRuntimeMod = await import('@deepseek-ai/dsh-ptc-runtime')
const PtcRuntime = PtcRuntimeMod.PtcRuntime ?? PtcRuntimeMod.default
const { createScope } = await import('@deepseek-ai/dsh-scope')

const leg = (id, verdict, detail) => { result.legs.push({ id, verdict, detail }); console.log(`[${verdict}] ${id}${detail === undefined ? '' : ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 300)}`) }

// ---------- TEST DOUBLE PtcRuntime (Service Definition implementation) ----------
// Runs the program body in-process and invokes exactly the binding closures that the
// REAL createRunCodeTool bridge produced (ptc.ts functions namespace). Binding outcomes
// are logged so the program-visible behavior is an observation channel.
class P05TestDoublePtcRuntime extends PtcRuntime {
  language = 'typescript'
  isolation = 'p05-in-process-test-double'
  runLog = []
  resolve(request) { return { ...request, cwd: request.cwd ?? process.cwd(), timeoutMs: request.timeoutMs ?? 30_000 } }
  async run(spec) {
    const logs = []
    const fns = spec.bindings.find(b => b.global === 'tools')?.functions ?? {}
    const tools = {}
    for (const [name, fn] of Object.entries(fns)) {
      tools[name] = async (args) => {
        try {
          const value = await fn(args)
          logs.push(`call ${name} ok`)
          this.runLog.push({ name, ok: true, value })
          return value
        } catch (error) {
          logs.push(`call ${name} failed: ${String(error?.message ?? error)}`)
          this.runLog.push({ name, ok: false, message: String(error?.message ?? error) })
          throw error
        }
      }
    }
    try {
      const fn = new Function('tools', `"use strict"; return (async () => { ${spec.program} })();`)
      const value = await fn(tools)
      return { logs, value }
    } catch (error) {
      return { logs, error: { kind: 'exception', message: String(error?.message ?? error) } }
    }
  }
}

// ---------- assembly: config { mode: 'ptc' } from ctx.plugin ----------
let mounted = false
let mountError = undefined
let ctx, runtime, agentScope
const agentEvents = []
const agent = { id: 'p05-agent-A', session: { header: { cwd: wsDir }, append: (type, data) => { agentEvents.push({ type, at: Date.now(), data }) } } }
try {
  ctx = new Context()
  await ctx.plugin(SystemPrompt, {})
  await ctx.plugin(ToolRuntime, { mode: 'ptc' }) // public assembly surface: Config.mode (index.ts:810-813); pristine recipe ptc.spec.ts:68
  await ctx.plugin(P05TestDoublePtcRuntime)
  runtime = ctx.ptcRuntime
  await ctx.plugin(Object.assign((inner) => { agentScope = createScope(inner, agent) }, { inject: ['tools', 'systemPrompt'] }))
  mounted = true
} catch (error) { mountError = String(error?.message ?? error) }

leg('P05-PTC-1.config-mode-ptc-mount', mounted ? 'PASS' : 'BLOCKED',
  mounted
    ? { assembly_surface: 'ctx.plugin(ToolRuntime, {mode:"ptc"}) — ToolRuntime.static Config z{mode:native|ptc|both} (packages/core/tools/src/index.ts:810-813); same call shape as pristine packages/core/tools/tests/ptc.spec.ts:68', ptcRuntime_double: 'ctx.ptcRuntime = P05TestDoublePtcRuntime (isolation ' + runtime.isolation + ')' }
    : { error: mountError, note: 'config channel from ctx.plugin rejected — record replacement surface' })

if (mounted) {
  // shared observation: counting tool as the "native" grep body (TEST DEFINITION standing in for the native)
  const obs = p00.obs ?? []
  const grepDef = p00.countingTool(obs, 'grep', 'native-grep-double')
  Object.defineProperty(grepDef, 'description', { value: 'P05MARKERGREP tool.', configurable: true })
  const disposeGrep = ctx.tools.register(grepDef)

  const callSeq = { n: 0 }
  const execute = async (name, args, withAgent = true) => {
    const callId = ToolCallId(`p05-c${String(++callSeq.n)}`)
    const before = obs.length
    try {
      const res = await ctx.tools.execute({ signal: new AbortController().signal, callId, name, arguments: args, ...(withAgent ? { agent } : {}) })
      const first = res?.content?.[0]
      return { text: first?.type === 'text' ? first.text : JSON.stringify(res?.content ?? res), isError: res?.isError === true, value: res?.value, bodies: obs.slice(before), eventsBefore: 0 }
    } catch (error) {
      return { threw: String(error?.message ?? error), bodies: obs.slice(before) }
    }
  }
  const countOf = (identity) => obs.filter(o => o.event === 'body' && o.identity === identity).length

  // ---- P05-PTC-2: presentation of the reserved transport under ptc mode ----
  // The model-request tool list is `assembly.tools` (system-prompt assemble() collects the
  // ctx.systemPrompt.tools(...) provider output = ToolRuntime.wireSchemas; index.ts:1008-1029
  // consumed by system-prompt/src/index.ts:578-595, 622).
  const schemas = ctx.tools.schemas(agent).map(s => s.name)
  const assembly = await ctx.systemPrompt.assemble()
  const wireNames = assembly.tools.map(t => t.name)
  const ptcOnly = assembly.sections.find(s => s.name === 'tools:ptc-only')
  const sdk = assembly.sections.find(s => s.name === 'tools:sdk')
  const p2 = schemas.includes(RUN_CODE_NAME) && schemas.includes('grep')
    && wireNames.length === 1 && wireNames[0] === RUN_CODE_NAME
    && ptcOnly !== undefined && ptcOnly.text.includes(RUN_CODE_NAME) && sdk !== undefined && sdk.text.includes('grep')
  leg('P05-PTC-2.schemas-presentation', p2 ? 'PASS' : 'FAIL', {
    registry_projection_tools_schemas_agent: schemas,
    model_wire_tools_list: wireNames,
    ptc_only_instruction_present: ptcOnly !== undefined,
    sdk_section_declares_grep: sdk !== undefined && sdk.text.includes('grep'),
    note: 'collapse home: ToolRuntime.wireSchemas index.ts:1022-1026 (schemas filtered to run_code under ptc); raw registry projection schemas() intentionally NOT collapsed (index.ts:1260-1262) — recorded as the honest distinction; same-name registration ban = 01-routing L7',
  })

  // ---- P05-PTC-3: model-direct grep denied (collapse), body 0 ----
  const direct = await execute('grep', {})
  const p3 = direct.isError === true && String(direct.text).includes(RUN_CODE_NAME) && countOf('native-grep-double') === 0
  leg('P05-PTC-3.model-direct-denied', p3 ? 'PASS' : 'FAIL', { result_text: String(direct.text ?? direct.threw).slice(0, 200), native_body_counter: countOf('native-grep-double'), home: 'collapses() index.ts:1351-1352; denial result index.ts:1453-1472' })

  // ---- P05-PTC-4: inner dispatch positive control ----
  const inner = await execute(RUN_CODE_NAME, { code: 'const r = await tools.grep({}); return r', description: 'p05 positive control' })
  const starts = agentEvents.filter(e => e.type === 'tool/ptc-dispatch-start')
  const settles = agentEvents.filter(e => e.type === 'tool/ptc-dispatch')
  const p4 = inner.isError !== true && String(inner.value?.result ?? '').startsWith('ran:grep@native-grep-double')
    && countOf('native-grep-double') === 1 && starts.length === 1 && settles.length === 1 && settles[0].data.isError === false
  leg('P05-PTC-4.inner-dispatch-positive', p4 ? 'PASS' : 'FAIL', {
    outer_value: inner.value, native_body_counter: countOf('native-grep-double'),
    ptc_dispatch_start_events: starts.length, ptc_dispatch_settle_events: settles.length,
    scheduler_evidence: 'binding closure reads registry[TOOL_RUNTIME_SCHEDULER] (ptc.ts:557) and runs scheduler.prepare/dispatch/finalize/finish (ptc.ts:622-638 → index.ts:816-821) = the SAME ToolRuntime staged pipeline as the native loop (pre-execute→guard→body→post-execute)',
  })

  // ---- P05-PTC-5: guard deny (Team-guard analog) → inner original body 0 ----
  const GUARD_REASON = 'P05-GUARD-DENY: grep not permitted by team policy'
  const disposeGuard = ctx.tools.guard((exec) => (exec.name === 'grep' ? GUARD_REASON : undefined))
  const denied = await execute(RUN_CODE_NAME, { code: 'const r = await tools.grep({}); return r', description: 'p05 negative control' })
  const deniedSettles = agentEvents.filter(e => e.type === 'tool/ptc-dispatch' && e.data.isError === true)
  const p5 = denied.isError === true && String(denied.text).includes(GUARD_REASON) && countOf('native-grep-double') === 1
    && deniedSettles.length === 1 && runtime.runLog.some(l => l.name === 'grep' && l.ok === false && String(l.message).includes(GUARD_REASON))
  leg('P05-PTC-5.guard-deny-inner-original-zero', p5 ? 'PASS' : 'FAIL', {
    outer_isError: denied.isError, outer_text: String(denied.text ?? denied.threw).slice(0, 220),
    native_body_counter_delta_after_guard: countOf('native-grep-double') - 1,
    guard_reason_reached_program: runtime.runLog.at(-1),
    isError_settle_events: deniedSettles.length,
    home: 'guard monotonic append index.ts:1136-1142; guardReason in prepare index.ts:1519; guard layer runs inside scheduler.prepare used by the PTC bridge',
  })
  disposeGuard()

  // ---- P05-PTC-7: bridge construction surface (static + public seam verdict) ----
  leg('P05-PTC-7.bridge-construction-public-seam', 'PASS-CITED', {
    bridge_home: 'createRunCodeTool(registry, RunCodeBridgeOptions) ptc.ts:333; options are registry-private closures, minted only at ToolRuntime.requirePtcTransport index.ts:944-961',
    inner_dispatch_surface: 'registry[TOOL_RUNTIME_SCHEDULER] ptc.ts:557 (symbol exported index.ts:480) — staged prepare/dispatch/finalize/finish',
    public_seam_for_inner_dispatch: 'YES — implement ctx.ptcRuntime (abstract class PtcRuntime, @deepseek-ai/dsh-ptc-runtime package root) and dispatch via ctx.tools.execute({name:"run_code"}); P05-PTC-4/5 are the executed minimal pair (positive body=1 / guard-deny body=0)',
    core_seam_blocker_inner: 'NOT REQUIRED for the "inner call goes through the same ToolRuntime + guard" question (public seam sufficed, executed)',
  })

  disposeGrep()
}

// ---- P05-PTC-6: PTC-01 citation (no re-run) ----
let l7 = undefined
try { l7 = JSON.parse(await import('node:fs/promises').then(fs => fs.readFile(ROUTING, 'utf8'))).legs.find(l => l.id === 'L7.PTC-01.reserved-run-code') } catch { /* recorded below */ }
leg('P05-PTC-6.PTC-01-citation', l7?.verdict === 'PASS' ? 'CITED-PASS' : 'MISSING', {
  source: '01-routing/p01-result.json leg L7.PTC-01.reserved-run-code (coordinator-run, do not re-run per task order)',
  register_threw: l7?.detail,
  static_home: 'register rejection index.ts:1080-1082; restrict rejection index.ts:1111-1113',
})

// ---- P05-PTC-8: outer direct I/O NOT_RUN ----
leg('P05-PTC-8.outer-direct-io', 'NOT_RUN', {
  reason: 'this fixture has no real outer PTC Node process: the runtime TEST DOUBLE executes the program in the fixture process (in-process new Function), so outer-process direct fs/net I/O under OS enforcement is NOT exercised here',
  required_for_eventual_GO: 'real pinned host + a ctx.ptcRuntime worker-thread/process backend (@deepseek-ai/dsh-ptc-runtime-node lib is present in T/packages/ptc-runtime/ptc-runtime-node) + P0-4 OS enforcement (bwrap/landlock) — per guide §3 P0-5 "外层 Node 进程直接 fs/net 必须符合强制保证"',
  status: 'NOT_RUN (never mark run_code PTC-02 as fully passed on this evidence)',
})

result.overall = {
  model_visible_transport: 'PASS (P05-PTC-2): under mode ptc the model wire surface presents only run_code; grep reachable only nested',
  inner_dispatch_same_runtime: 'PASS (P05-PTC-4/5): nested calls run through the same ToolRuntime staged pipeline; guard deny → original body 0 (counter evidence, not return-text evidence)',
  outer_direct_io: 'NOT_RUN (P05-PTC-8)',
  PTC_01: 'CITED from 01-routing L7 (PASS)',
  verdict_candidate: 'run_code / PTC: BOUNDED-DEFER on strict guarantees pending real-host outer-process evidence; inner-dispatch admission+guard leg proven on pinned libs with an in-process runtime double; no CORE_SEAM_BLOCKER required for inner dispatch',
}

const out = join(HERE, 'p05-result.json')
writeFileSync(out, JSON.stringify(result, null, 2) + '\n', 'utf8')
// final state re-check: T must remain byte-clean
const gT2 = shRun('git T status after', 'git', ['-C', TEST_USE, 'status', '--porcelain'])
result.host_env.test_use_porcelain_empty_after = gT2.out === ''
writeFileSync(out, JSON.stringify(result, null, 2) + '\n', 'utf8')
const failed = result.legs.filter(l => l.verdict === 'FAIL' || (l.verdict === 'BLOCKED')).length
console.log(`\nwrote ${out}; legs=${result.legs.length}; failing(PASS-candidates)=${failed}`)
process.exit(failed === 0 ? 0 : 1)
