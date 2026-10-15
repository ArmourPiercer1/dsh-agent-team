#!/usr/bin/env node
/**
 * ptc-outer-child.mjs — Alpha.5 PTC-08 OUTER-process fixture (05-ptc supplement). Team-owned, PoC only.
 *
 * THIS PROCESS IS THE OUTER PROCESS: a real OS process (its pid is self-reported in the final
 * JSON line and cross-checked by the parent runner against the spawn pid). It mounts the REAL
 * production PTC outer stack from the pristine test-use checkout (T) over the same ESM-hook
 * mechanism as p05 (absolute lib/index.js file URLs; no junctions; T read-only):
 *   - @deepseek-ai/dsh-ptc-runtime-node NodePtcRuntime (pinned, packages/ptc-runtime/ptc-runtime-node):
 *     isolation='process' — every run_code program runs in a FRESH SANDBOXED NODE CHILD PROCESS
 *     (spawned through @deepseek-ai/dsh-sandbox-local + @deepseek-ai/dsh-subprocess-local under
 *     @deepseek-ai/dsh-sandbox-policy). No test double replaces the runtime.
 *   - ToolRuntime (pinned) in mode 'ptc' owns the run_code transport + the dispatch pipeline;
 *     the registry-private createRunCodeTool bridge (lib/index.js createRunCodeTool) hands the
 *     REAL binding closures to the REAL runtime. tools.guard (pinned) is the denial point.
 * The only test doubles are the two registered tool BODIES ('echo', 'blocked') — the same role
 * upstream specs fill with counting tools; the guarded pipeline, bridge, scheduler, and runtime
 * are production libs.
 *
 * Program executed (in the real spawned Node child): positive control `tools.echo` (body +1,
 * value round-trip) + guard-rejected `tools.blocked` (typed ToolCallError with the guard reason
 * reaches the program, original body counter delta 0). The program reports its own OS pid
 * (innerPid); outer pid = this process. Both are asserted distinct by the parent.
 *
 * argv: --test-use <dir> --scratch <dir>
 * Output: one JSON line prefixed 'PTC_OUTER_RESULT:' on stdout (final line). Exit 0 iff inner
 * assertions pass; nonzero detail codes otherwise.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { register } from 'node:module'

const argv = process.argv.slice(2)
const arg = (flag) => argv[argv.indexOf(flag) + 1]
const TEST_USE = resolve(arg('--test-use'))
const SCRATCH = resolve(arg('--scratch'))
if (!TEST_USE || !SCRATCH) { console.error('usage: ptc-outer-child.mjs --test-use <dir> --scratch <dir>'); process.exit(2) }

register(new URL('./p05-ai-hook.mjs', import.meta.url), import.meta.url, { data: { testUse: TEST_USE } })

const wsDir = join(SCRATCH, 'ws')
rmSync(SCRATCH, { recursive: true, force: true })
mkdirSync(wsDir, { recursive: true })
writeFileSync(join(wsDir, 'readme.txt'), 'ptc-outer fixture workspace\n')

const { Context } = await import('@deepseek-ai/cordis')
const SystemPrompt = (await import('@deepseek-ai/dsh-system-prompt')).default
const ToolRuntimeMod = await import('@deepseek-ai/dsh-tools')
const ToolRuntime = ToolRuntimeMod.default
const { RUN_CODE_NAME } = ToolRuntimeMod
const { ToolCallId } = await import('@deepseek-ai/dsh-llm')
const SessionStore = (await import('@deepseek-ai/dsh-session')).default
const SessionProjections = (await import('@deepseek-ai/dsh-session-projection')).default
const FileSystem = (await import('@deepseek-ai/dsh-fs-local')).default
const Subprocess = (await import('@deepseek-ai/dsh-subprocess-local')).default
const Sandbox = (await import('@deepseek-ai/dsh-sandbox-local')).default
const SandboxPolicy = (await import('@deepseek-ai/dsh-sandbox-policy')).default
const { NodePtcRuntime } = await import('@deepseek-ai/dsh-ptc-runtime-node')

const GUARD_REASON = 'PTC-OUTER-GUARD: blocked is denied by fixture policy'
const out = {
  outerPid: process.pid, ppid: process.ppid, node: process.version, platform: process.platform,
  assembly: [], bodyCounts: { echo: 0, blocked: 0 }, events: [], ok: false, error: null,
}
const bump = (name) => { if (name in out.bodyCounts) out.bodyCounts[name] += 1 }

try {
  const ctx = new Context()
  // production service stack (workflow-ptc/tests/setup.ts mountWorkflowRuntime recipe, public seams)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjections)
  await ctx.plugin(FileSystem)
  await ctx.plugin(Subprocess)
  await ctx.plugin(Sandbox, {})
  await ctx.plugin(SandboxPolicy, { mode: 'danger-full-access', workspaceRoot: wsDir })
  out.assembly.push('sessions/sessionProjections/fs/subprocess/sandbox/sandboxPolicy(danger-full-access, ws)')
  await ctx.plugin(NodePtcRuntime, { timeoutMs: 120_000, graceMs: 2_000 })
  out.assembly.push(`NodePtcRuntime(isolation=${ctx.ptcRuntime.isolation}, language=${ctx.ptcRuntime.language}, sandboxMode=${ctx.ptcRuntime.sandboxMode})`)
  await ctx.plugin(SystemPrompt, {})
  await ctx.plugin(ToolRuntime, { mode: 'ptc' })
  out.assembly.push('SystemPrompt + ToolRuntime(mode:"ptc")')

  const counting = (name) => ({
    name,
    description: `ptc-outer counting body for ${name}`,
    parameters: { type: 'object', properties: {} },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
    execute: async () => { bump(name); return `ran:${name}@outer-pid-${process.pid}` },
  })
  ctx.tools.register(counting('echo'))
  ctx.tools.register(counting('blocked'))

  // pass-through observer: records inner-dispatch execs (exec.parent set) with canonical values
  ctx.on('tools/post-execute', (exec, res, next) => {
    out.events.push({ type: 'observer/post-execute', name: exec.name, parentPresent: exec.parent !== undefined, isError: res?.isError === true })
    return next()
  })

  // the denial point: production monotonic guard, plain ctx → global
  ctx.tools.guard((exec) => (exec.name === 'blocked' ? GUARD_REASON : undefined))
  out.assembly.push('ctx.tools.guard(blocks "blocked" globally)')

  // real production Session (workflow-ptc/tests/setup.ts fakeParent recipe: ctx.sessions.create with cwd meta)
  const session = ctx.sessions.create(undefined, { meta: { cwd: wsDir } })
  const agent = { id: session.id, session, options: {} }
  out.sessionId = session.id

  const code = [
    'const ok = await tools.echo({});',
    'let denied;',
    `try { await tools.blocked({}); denied = { rejected: false }; } catch (e) { denied = { rejected: true, name: e && e.name, toolName: e && e.toolName, message: String(e && e.message) }; }`,
    'return { ok, denied, innerPid: process.pid, innerNode: process.version };',
  ].join(' ')
  const res = await ctx.tools.execute({
    signal: new AbortController().signal, callId: ToolCallId('ptc-outer-c1'),
    name: RUN_CODE_NAME, arguments: { code, description: 'PTC-08 outer: guard-deny + positive control' }, agent,
  })
  const text = (res.content ?? []).map(b => b.text ?? '').join('')
  out.runCode = { isError: res.isError === true, textHead: text.slice(0, 2000) }
  const durable = (typeof session.snapshotEvents === 'function' ? [...session.snapshotEvents()] : [])
    .filter(e => String(e?.type ?? '').includes('ptc-dispatch'))
    .map(e => ({ type: e.type, name: e.data?.name ?? e.data?.toolName, isError: e.data?.isError }))
  out.durableDispatchEvents = durable

  // canonical run_code value ({logs, result, sandbox}) via durable dispatch is not enough; parse program value from logs text is lossy —
  // instead re-derive from observer-independent facts: body counters + program-visible rejection echoed in logs.
  const logsJoined = out.runCode.textHead
  const programValue = /"innerPid":\s*(\d+)/.exec(logsJoined)
  out.innerPidFromProgramText = programValue ? Number(programValue[1]) : null
  out.ok = out.runCode.isError === false
    && out.bodyCounts.echo === 1 && out.bodyCounts.blocked === 0
    && logsJoined.includes(GUARD_REASON) && logsJoined.includes('ran:echo@outer-pid-')
  if (!out.ok) out.error = 'assertions not all true (see bodyCounts/runCode)'
} catch (err) {
  out.error = String(err?.stack ?? err).slice(0, 2000)
}

console.log('PTC_OUTER_RESULT:' + JSON.stringify(out))
process.exit(out.ok ? 0 : 1)
