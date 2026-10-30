#!/usr/bin/env node
/**
 * u7r3-wfpoc — offline citation probe (PoC for USER-RULING-20261031 §4).
 *
 * READ-ONLY. Boots nothing, opens no socket, spends no pool, writes nothing outside
 * this evidence directory. It reads the pristine Host checkout named by tests/paths.mjs
 * and asserts that every `file:line` cited by POC-REPORT.md still says what the report
 * claims it says. A DRIFT line means the Host moved under the report; a FAIL means the
 * report asserted something the source does not say.
 *
 * Legal posture: this file imports no Host module. It reads text. That is the whole
 * point of the lane — the five ruling questions are answered from the public contract
 * surface, so a probe that only reads bytes can check them.
 *
 * Usage: node probe-citations.mjs [path-to-pristine-checkout]
 * Default path = tests/deepseek-harness-test-use resolved from the repo root.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TEST_USE_BASELINE_SHA, TEST_USE_REL } from '../../../../tests/paths.mjs'

const here = dirname(fileURLToPath(import.meta.url))

/** The pristine checkout is gitignored and lives per-repo, not per-worktree: walk up. */
function findCheckout(start) {
  for (let dir = start; dir !== dirname(dir); dir = dirname(dir)) {
    const candidate = join(dir, TEST_USE_REL)
    if (existsSync(join(candidate, 'package.json'))) return candidate
  }
  return undefined
}

const productRoot = resolve(here, '../../../..')
const root = process.argv[2] !== undefined ? resolve(process.argv[2]) : findCheckout(here)
if (root === undefined) {
  process.stdout.write(`no pristine checkout (${TEST_USE_REL}) found above ${here}\n`)
  process.exit(2)
}

// The pins in tests/paths.mjs are the only source for the baseline (TEST_METHODS §4.2).
// Asserting them here is what makes the citations below addressable at all.
const head = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const porcelain = execFileSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8' }).trim()
if (head !== TEST_USE_BASELINE_SHA) {
  process.stdout.write(`checkout HEAD ${head} != pinned ${TEST_USE_BASELINE_SHA}: citations are stale, not verified\n`)
  process.exit(2)
}
if (porcelain !== '') {
  process.stdout.write('pristine checkout is DIRTY — the tree under the citations has been edited:\n')
  process.stdout.write(`${porcelain}\n`)
  process.exit(2)
}

/** [file, line, mustContain, why] — `why` is the ruling question it evidences. */
const CLAIMS = [
  // ---- Q1: is there a public orchestration interface at all? ----
  ['packages/workflow/workflow/src/index.ts', 31, "declare module '@deepseek-ai/cordis'", 'Q1 workflowEngine is a declared Cordis service'],
  ['packages/workflow/workflow/src/index.ts', 168, 'abstract start(request: WorkflowStartRequest): WorkflowRun', 'Q1 the one public engine method'],
  ['packages/workflow/workflow/src/runtime-types.ts', 19, 'export interface WorkflowStartRequest', 'Q1 the public start contract'],
  ['packages/workflow/workflow/src/runtime-types.ts', 27, 'subagentProvider?: string', 'Q1 consumer-selected child provider for a run'],
  ['packages/workflow/workflow/src/runtime-types.ts', 33, 'signal?: AbortSignal', 'Q1/Q3 cancellation enters through the request'],
  ['packages/preset/agent-preset-registry/src/index.ts', 297, 'serviceFor<K extends string & keyof Context>(agent: { ctx: Context }, name: K)', 'Q1 the PUBLIC read path into an isolated preset realm'],
  ['docs/subsystems/core.md', 545, 'serviceFor<K extends string & keyof Context>(agent: { ctx: Context }, name: K)', 'Q1 serviceFor is in the generated public catalog'],
  ['packages/preset/agent-preset-registry/src/mount.ts', 267, 'Preset services require isolate realms', 'Q1 preset services may NOT leak to the root realm'],
  ['vendor/cordis/src/reflect.ts', 238, 'const key = this.ctx[symbols.isolate][name]', 'Q1 ctx.get is realm-keyed: a host-plane get cannot see it'],
  ['packages/bundle/web-app/cordis.patch.yml', 538, 'disabled: true', 'Q1 web-app disables the host-plane engine row'],
  ['packages/bundle/web-app/presets/standard.patch.yml', 84, 'workflowEngine: true', 'Q1 shipped preset mounts the engine ISOLATED'],
  ['packages/bundle/web-app/presets/standard.patch.yml', 120, "'@deepseek-ai/dsh-workflow-ptc'", 'Q1 the standard preset does mount the engine'],
  ['packages/bundle/base/cordis.patch.yml', 394, "'@deepseek-ai/dsh-workflow-ptc'", 'Q1 the base bundle mounts it host-plane instead'],

  // ---- Q2: how do steps inherit permission? ----
  ['packages/workflow/workflow-ptc/src/host.ts', 200, 'const run = await this.subagents.start(this.provider, {', 'Q2 the engine starts children ITSELF'],
  ['packages/workflow/workflow-ptc/src/host.ts', 203, 'signal: this.controller.signal,', 'Q2 the request it builds (signal, and nothing narrowing)'],
  ['packages/workflow/workflow-ptc/src/runtime.ts', 33, "SUPPORTED_AGENT_OPTIONS = new Set(['label', 'phase', 'schema', 'provider', 'model'])", 'Q2 the SCRIPT chooses provider/model'],
  ['packages/subagent/subagent/src/child-agent.ts', 218, 'if (composition.toolFilter !== undefined) childCtx.tools.restrict(composition.toolFilter)', 'Q2 a filter narrows only if one was sent — and none is'],
  ['packages/subagent/subagent/src/index.ts', 649, "{ when: request.toolFilter !== undefined, cap: 'toolFilter' },", 'Q2 a provider may DECLINE the toolFilter capability'],
  ['packages/subagent/subagent/src/index.ts', 512, 'registerProvider(provider: SubagentProvider): () => void {', 'Q2 the public (unproven) route-A alternative'],
  ['packages/workflow/workflow-ptc/src/index.ts', 166, 'runCtx.sandboxPolicy.resolve({ session: request.parent.session })', 'Q2 what DOES inherit: the parent session file policy'],
  ['packages/workflow/workflow-ptc/src/index.ts', 76, 'no subagent provider registered for', 'Q2 the override must name a REGISTERED provider'],

  // ---- Q3: how does cancellation reach the children? ----
  ['packages/workflow/workflow-ptc/src/host.ts', 281, 'timeoutMs: null,', 'Q3/Q4 the PTC process runs with no elapsed budget'],
  ['packages/workflow/workflow-ptc/src/host.ts', 148, "cancel(reason = 'workflow cancelled'): void {", 'Q3 public cancel'],
  ['packages/workflow/workflow/src/runtime-types.ts', 46, 'cancel(reason?: string): void', 'Q3 cancel on the public run handle'],
  ['packages/workflow/tool-workflow/src/index.ts', 307, "cancel: (reason?: string) => { run.cancel(reason ?? 'background workflow job killed') },", 'Q3 background stop is a public job kill'],
  ['packages/subagent/subagent/src/index.ts', 328, 'interrupt(targetSessionId: SessionId, authority: SubagentInterruptAuthority): void {', 'Q3 the public interrupt is NOT the workflow path'],
  ['packages/subagent/subagent/src/index.ts', 320, 'An absent target \u2014 including a one-shot or unknown id \u2014', 'Q3 one-shot workflow children are an accepted no-op for interrupt'],

  // ---- Q4: what guarantees a derailed run converges? ----
  ['docs/subsystems/workflow.md', 95, 'The PTC engine has no overall elapsed deadline', 'Q4 documented: no overall deadline, no cleanup deadline'],
  ['packages/workflow/workflow/README.md', 131, 'Runs are holder-owned, not service-tracked', 'Q4 no service-side reaper exists'],
  ['packages/workflow/workflow-ptc/src/runtime.ts', 107, 'timeout: this.limits.syncTimeoutMs', 'Q4 the only timeout bounds the initial sync slice'],
  ['packages/jobs/jobs-local/src/index.ts', 662, 'without settling remains indistinguishable from a slow stop and may stall', 'Q4 upstream admits teardown can stall'],
  ['packages/guard/timeout-policy/src/index.ts', 2, 'Cooperative tool-call timeout enforcer. A tool declares `timeoutMs` and', 'Q4 the timeout guard is cooperative and opt-in'],

  // ---- Q5: can a result be attributed and read back? ----
  ['packages/workflow/tool-workflow/src/index.ts', 440, 'const recordsRun = exec.parent === undefined', 'Q5 durable records exist only for a top-level run'],
  ['packages/workflow/tool-workflow/src/index.ts', 423, 'exec.parent === undefined', 'Q5 the same gate on the background path'],
  ['packages/session-query/session-query/src/index.ts', 184, 'async readSession(sessionId: SessionId): Promise<SessionLogSnapshot> {', 'Q5 the public read-back path'],
  ['packages/workflow/workflow/src/types.ts', 124, 'export interface WorkflowResultInfo {', 'Q5 the result info carries no value'],
  ['packages/jobs/jobs-local/src/index.ts', 592, 'job.result = outcome.result', 'Q5 the background value lives in a memory outcome'],
]

/** Claims whose ABSENCE is the finding (route-B gaps). A hit here is a report bug.
 * Shape: [file, scopeRegex|whole-file, forbiddenRegex, why]. The scope is narrowed
 * first so a stray word elsewhere in the file cannot mask a real leak. */
const NEGATIVE = [
  ['packages/workflow/workflow/src/runtime-types.ts', null, /\btoolFilter\b/, 'Q2 WorkflowStartRequest must have NO tool-filter field'],
  ['packages/workflow/workflow-ptc/src/host.ts', null, /toolFilter/, 'Q2 the engine must send NO tool filter when starting a child'],
  ['packages/workflow/workflow-ptc/src/index.ts', null, /maxRuntime|reap|deadline/, 'Q4 the engine must register no deadline/reaper'],
  ['packages/workflow/tool-workflow/src/types.ts', /export interface ToolWorkflowRunEndData \{[\s\S]*?\}/, /value|result/, 'Q5 the durable run-end payload must carry no result value'],
  ['packages/workflow/workflow/src/types.ts', /export interface WorkflowResultInfo[\s\S]*?\}/, /value/, 'Q5 the live result info must carry no value either'],
  ['packages/workflow/tool-workflow/src/index.ts', null, /timeoutMs/, 'Q4 the native workflow row declares NO timeoutMs, so the timeout guard never applies'],
]


const read = (file) => readFileSync(join(root, file), 'utf8').split('\n')

/** Our OWN tree (`P:` in the report) — cited at this worktree's head, so it is checked
 * against the branch being pushed, not against some older checkout. */
const PRODUCT = [
  ['packages/tools/agent-control-family/src/agent-runtime-port.mjs', 324, 'default:', 'Q-current runWorkflow has no resolver branch'],
  ['packages/tools/agent-control-family/src/agent-runtime-port.mjs', 325, 'runWorkflow stays unwired at AC-1', 'Q-current AC-81 unwired finding stands'],
  ['packages/tools/agent-control-family/src/agent-runtime-port.mjs', 82, 'TIER_A_CHILD_TOOL_FILTER = Object.freeze({ allow: Object.freeze([]) })', 'Q2 Tier A forces a zero-tool child'],
  ['packages/tools/agent-control-family/src/agent-runtime-port.mjs', 83, "TIER_A_FORBIDDEN_SPEC_FIELDS = Object.freeze(['provider', 'model'", 'Q2 Tier A forbids script-chosen routes'],
  ['packages/tools/agent-control-family/src/agent-runtime-port.mjs', 204, 'toolFilter: TIER_A_CHILD_TOOL_FILTER,', 'Q2 the filter the port sends — the engine sends none'],
  ['packages/tools/agent-control-family/src/agent-control-executor.mjs', 183, "refused(LEG_UNWIRED.code, `${LEG_UNWIRED.detail} (leg '${legName}')`)", 'Q-current per-leg typed refusal'],
  ['packages/tools/agent-control-family/src/agent-control-executor.mjs', 249, "refused(LEG_UNWIRED.code, `${LEG_UNWIRED.detail} (leg 'runWorkflow')`)", 'Q-current the workflow row refuses today'],
  ['packages/tools/agent-control-family/src/agent-control-executor.mjs', 205, 'the legs run as THIS caller and no', 'Q2 law (c) as our product defines it'],
  ['packages/tools/agent-control-family/src/agent-control-executor.mjs', 237, 'caller: cl, spec: args', 'Q2 our leg shape (caller-bound delegates)'],
  ['packages/tools/agent-control-family/src/workflow-row.mjs', 4, 'through the executor-supplied, caller-bound spawn/steer delegates', 'Q2 law (c) text'],
  ['packages/tools/agent-control-family/src/workflow-row.mjs', 23, "prompt: { type: 'string', description: 'The closed orchestration request", 'Q-scope the row takes a request, not a JS script'],
  ['packages/tools/agent-control-family/src/workflow-row.mjs', 34, 'agent: exec.agent', 'Q1 the DISPATCH-provided caller agent the read path needs'],
  ['packages/runtime/src/plugin/live/team-tool-plane.mjs', 1602, 'const hostService = (name) => {', 'Q1 our host-service face'],
  ['packages/runtime/src/plugin/live/team-tool-plane.mjs', 1629, 'hostService: (name) => hostService(name),', 'Q1 what cap exposes to the port (name lookup only)'],
  ['packages/runtime/src/plugin/live/agent-bindings.mjs', 2295, 'presets.composedPreset(agentCtx) !== undefined', 'Q1 we already read the preset plane publicly'],
  ['packages/runtime/src/plugin/live/agent-bindings.mjs', 2306, 'await presets.mount(agentCtx', 'Q1 our agents ARE joined to a preset'],
  ['packages/runtime/test/u7-f-agent-control-c1.test.ts', 74, 'const makeFakeRuntime =', 'Q-truth C1 proves the port contract against a FAKE port'],
  ['packages/runtime/test/u7-f-agent-control-c1.test.ts', 307, 'AC-16 workflow POSITIVE: the driver spawns only through the caller-bound delegate', 'Q2 the AC-16 shape the Host engine cannot produce'],
  ['packages/runtime/test/u7-f-agent-control-c1.test.ts', 774, 'AC-51 every MUTATION row requests its EXACT declared set', 'Q-scope the declared-effect assertion a route-A would re-wire'],
]

let failed = 0

process.stdout.write(`# u7r3-wfpoc citation probe\ncheckout: ${root}\nHEAD: ${head} (= pinned ${TEST_USE_BASELINE_SHA}) porcelain: clean\n`)

process.stdout.write('\n## positive claims (file:line must say what the report says)\n')
for (const [file, line, needle, why] of CLAIMS) {
  let text = ''
  try {
    text = read(file)[line - 1] ?? ''
  } catch (error) {
    process.stdout.write(`READ-FAIL ${file}: ${String(error)}\n`)
    failed += 1
    continue
  }
  const ok = text.includes(needle)
  if (!ok) failed += 1
  process.stdout.write(`${ok ? 'OK      ' : 'DRIFT   '}${file}:${line}  ${why}\n`)
  if (!ok) process.stdout.write(`        expected: ${needle}\n        actual  : ${text.trim().slice(0, 160)}\n`)
}

process.stdout.write('\n## negative claims (the absence IS the finding)\n')
for (const [file, scope, pattern, why] of NEGATIVE) {
  let text
  try {
    const whole = readFileSync(join(root, file), 'utf8')
    text = scope === null ? whole : scope.exec(whole)?.[0]
  } catch (error) {
    process.stdout.write(`READ-FAIL ${file}: ${String(error)}\n`)
    failed += 1
    continue
  }
  if (text === undefined) {
    process.stdout.write(`SCOPE-MISS ${file}  ${why}\n`)
    failed += 1
    continue
  }
  const ok = !pattern.test(text)
  if (!ok) failed += 1
  process.stdout.write(`${ok ? 'ABSENT  ' : 'PRESENT '}${file}  ${why}\n`)
  if (!ok) process.stdout.write(`        unexpected ${String(pattern)} inside: ${text.replace(/\s+/g, ' ').slice(0, 150)}\n`)
}

process.stdout.write('\n## product claims (our own tree, at this worktree head)\n')
for (const [file, line, needle, why] of PRODUCT) {
  let text = ''
  try {
    text = (readFileSync(join(productRoot, file), 'utf8').split('\n')[line - 1] ?? '')
  } catch (error) {
    process.stdout.write(`READ-FAIL ${file}: ${String(error)}\n`)
    failed += 1
    continue
  }
  const ok = text.includes(needle)
  if (!ok) failed += 1
  process.stdout.write(`${ok ? 'OK      ' : 'DRIFT   '}${file}:${line}  ${why}\n`)
  if (!ok) process.stdout.write(`        expected: ${needle}\n        actual  : ${text.trim().slice(0, 160)}\n`)
}

process.stdout.write(`\n## result\nclaims=${CLAIMS.length + NEGATIVE.length + PRODUCT.length} failures=${failed}\n`)
process.exitCode = failed === 0 ? 0 : 1
