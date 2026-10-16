#!/usr/bin/env node
/**
 * spill-runner.mjs — Alpha.5 P0 SRCH-04 Spill leg (02-search supplement). Team-owned, PoC only.
 * IDEMPOTENT: safe to re-run; overwrites ./spill-result.json and rewrites ./probe-scratch/spill-scratch/.
 *
 * WHAT THIS IS (plan §4 SRCH-04 / §3 P0-2; honesty discipline plan §1.2):
 *  A plain-node fixture over the PREBUILT public libs of the pristine test-use checkout (T),
 *  assembling the REAL production post-execute spill stack — NO test double replaces any
 *  production spill component:
 *    - ToolRuntime (pinned) owns the pre-execute→guard→body→post-execute pipeline (tools/post-execute waterfall).
 *    - @deepseek-ai/dsh-tool-fs-search (pinned) registers the production `grep` tool AND its
 *      production post-execute spill handler (applyGrepTool, packages/fs/tool-fs-search/src/grep.ts:342-367).
 *    - @deepseek-ai/dsh-spill-local LocalSpillStore (pinned) is the production spill backend writing
 *      private session-scoped files under a configured root (packages/spill/spill-local/src/index.ts).
 *    - @deepseek-ai/dsh-subprocess-local (pinned) really spawns the packaged @vscode/ripgrep binary.
 *  The oversized result is produced by the REAL body running REAL rg; caps are tightened via the
 *  plugin's PUBLIC Config (grepMaxMatches=2) so a 3-match search is over-cap (previous rounds only
 *  exercised this via upstream's own fake-subprocess spec — here subprocess + rg + spill store are all real).
 *
 * S-09 BEHAVIORAL REPRO (S-09 = plan §2 table: "post-execute spill 用精确 ToolDefinition 对象身份判断;
 * 替换 Definition 可能损失 Spill 行为", home packages/fs/tool-fs-search/src/direct-call.ts:26):
 *  the production spill handler resolves the live definition via `ctx.tools.get(exec.name, exec.agent)`
 *  and returns `undefined` (spill abstains) when that object is not the exact registered definition
 *  captured in its closure. Here the replacement is the production per-scope shadow mechanism
 *  (`scope.ctx.tools.register(sameNameDef)` — the SAME layer-shadowing that scoped.spec.ts:87 pins),
 *  so object identity changes for that agent while the body itself is the untouched production closure.
 *
 * Observation model (counters are the primary evidence channel, not return text):
 *  - body executed + canonical value: a fixture-registered `tools/post-execute` OBSERVER (pass-through)
 *    records exec.name / exec.parent / canonical result.value.matches.length per call — the canonical
 *    value exists only if the real body ran and parsed real rg stdout;
 *  - spill artifact: file-count delta under the LocalSpillStore root (disk is the artifact plane),
 *    plus the model-facing footer branch ("Full grep result stored at:" vs "could not be saved")
 *    as the handler's decision signature;
 *  - nothing wraps or mutates any production object.
 *
 * Legs:
 *  SPILL-1  control: over-cap grep → production spill GENERATED (artifact +1, locator footer,
 *           spill file holds the COMPLETE 3-match result while inline keeps 2).
 *  SPILL-2  replacement abstention (S-09): after a same-name ToolDefinition shadow for agent A
 *           (object identity changed; tools.get('grep', A) === shadow ≠ original), the body still
 *           runs (canonical matches=3) but spill ABSTAINS (artifact delta 0, "could not be saved" footer).
 *  SPILL-3  scope locality: an agent WITHOUT the shadow (plain production path) still spills
 *           (artifact delta 1) — abstention is the identity check, not handler damage.
 *  SPILL-4  identity reversal: disposing the shadow restores spill for agent A (artifact delta 1)
 *           — the decision is exactly object identity, not time/order.
 *
 * Import mechanism (task rule): NO new W/node_modules junctions; T is never written. Every
 * top-level '@deepseek-ai/*' import resolves through the existing ESM resolve hook
 * ../05-ptc/p05-ai-hook.mjs to absolute lib/index.js file URLs inside T; transitive imports
 * inside the built libs resolve through T's own node_modules layout (pnpm workspace links).
 *
 * Exit code 0 iff every leg PASSes. Verdicts + counts land in ./spill-result.json.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKTREE_ROOT = resolve(HERE, '..', '..', '..', '..', '..')
const TEST_USE = join(WORKTREE_ROOT, 'tests', 'deepseek-harness-test-use')
const SCRATCH = join(HERE, 'probe-scratch', 'spill-scratch') // own subdir only; never touch siblings
const MODEL_NAME = 'qwen3.8-flash-next'

const sh = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: 'utf8' }); return { cmd: [cmd, ...args].join(' '), code: r.status, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() } }

const result = {
  leg: '02-search supplement — SRCH-04 post-execute Spill (production modules)',
  agent: 'Alpha.5 P0 supplement leg (qwen3.8-flash-next)',
  model_name_verbatim: { powered_by_line: 'You are a coding agent powered by the qwen3.8-flash-next model.', model: MODEL_NAME },
  recorded_at_utc: new Date().toISOString(),
  import_mechanism: 'ESM resolve hook ../05-ptc/p05-ai-hook.mjs → absolute lib/index.js file URLs inside T; transitive deps via T own node_modules layout; no new junctions; T read-only',
  production_modules_under_test: [
    'packages/core/tools (ToolRuntime scheduler + tools/post-execute waterfall)',
    'packages/fs/tool-fs-search (production grep tool + production post-execute spill handler, src/grep.ts:342-367; identity check src/direct-call.ts:26)',
    'packages/spill/spill-local (production LocalSpillStore backend)',
    'packages/subprocess/subprocess-local (production subprocess service)',
    'node_modules @vscode/ripgrep (packaged real rg binary, resolved by production resolveRipgrep path)',
  ],
  commands: [],
  legs: [],
  counters: {},
}
function shRun(label, cmd, args) { const r = sh(cmd, args); result.commands.push({ label, ...r }); return r }

// ---------- environment ----------
const gT = shRun('git T HEAD', 'git', ['-C', TEST_USE, 'rev-parse', 'HEAD'])
const gTs = shRun('git T status before', 'git', ['-C', TEST_USE, 'status', '--porcelain'])
const gW = shRun('git W HEAD', 'git', ['-C', WORKTREE_ROOT, 'rev-parse', 'HEAD'])
const nodeV = shRun('node -v', process.execPath, ['-v'])

rmSync(SCRATCH, { recursive: true, force: true })
const wsDir = join(SCRATCH, 'workspace')
const spillRoot = join(SCRATCH, 'spill-root')
mkdirSync(join(wsDir, 'src'), { recursive: true })
mkdirSync(spillRoot, { recursive: true })
// exact fixture world: 3 'alpha' matches → over-cap for grepMaxMatches=2
writeFileSync(join(wsDir, 'src', 'alpha.ts'), 'export const alpha = 1\n// TODO: refit alpha\n')
writeFileSync(join(wsDir, 'notes.md'), 'alpha appears here too\n')

// ---------- module loading through the shared hook (reuse, never modify) ----------
register(new URL('../05-ptc/p05-ai-hook.mjs', import.meta.url), import.meta.url, { data: { testUse: TEST_USE } })
const { Context } = await import('@deepseek-ai/cordis')
const SystemPrompt = (await import('@deepseek-ai/dsh-system-prompt')).default
const ToolRuntimeMod = await import('@deepseek-ai/dsh-tools')
const ToolRuntime = ToolRuntimeMod.default
const { ToolCallId } = await import('@deepseek-ai/dsh-llm')
const { createScope } = await import('@deepseek-ai/dsh-scope')
const LocalSubprocessRuntime = (await import('@deepseek-ai/dsh-subprocess-local')).default
const LocalSpillStore = (await import('@deepseek-ai/dsh-spill-local')).default
const ToolFsSearch = await import('@deepseek-ai/dsh-tool-fs-search')

const leg = (id, verdict, detail) => { result.legs.push({ id, verdict, detail }); console.log(`[${verdict}] ${id}${detail === undefined ? '' : ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 400)}`) }
const check = (id, ok, detail) => leg(id, ok ? 'PASS' : 'FAIL', detail)

// ---------- production assembly (public seams only) ----------
const ctx = new Context()
await ctx.plugin(SystemPrompt, {})
await ctx.plugin(ToolRuntime)
await ctx.plugin(LocalSubprocessRuntime)
await ctx.plugin(LocalSpillStore, { root: spillRoot, cleanupPeriodDays: 0 })
await ctx.plugin(ToolFsSearch, { sampleOverCapGlobResults: true, grepMaxMatches: 2 })

// fixture OBSERVER (pass-through; counts canonical body outcomes)
const obs = []
ctx.on('tools/post-execute', (exec, res, next) => {
  obs.push({ at: Date.now(), name: exec.name, parentPresent: exec.parent !== undefined, isError: res?.isError === true, matches: Array.isArray(res?.value?.matches) ? res.value.matches.length : undefined })
  return next()
})

/** Mint an agent scope (scoped.spec.ts:25-32 recipe) whose key doubles as the Agent. */
async function mintAgentScope(name, session) {
  const key = { id: name, session, options: {} }
  let scope
  await ctx.plugin(Object.assign((inner) => { scope = createScope(inner, key) }, { inject: ['tools', 'systemPrompt'] }))
  return { scope, key }
}

let callSeq = 0
async function callGrep(agent) {
  const before = obs.length
  const spillBefore = spillFiles().length
  const res = await ctx.tools.execute({
    signal: new AbortController().signal, callId: ToolCallId(`spill-c${String(++callSeq)}`),
    name: 'grep', arguments: { pattern: 'alpha' }, ...(agent ? { agent } : {}),
  })
  const text = (res.content ?? []).filter(b => b.type === 'text').map(b => b.text).join('')
  return {
    isError: res.isError === true, text,
    canonical: obs.slice(before),
    spillFilesBefore: spillBefore, spillFilesAfter: spillFiles().length, spillDelta: spillFiles().length - spillBefore,
    spilled: text.includes('Full grep result stored at:'),
    abstainedFooter: text.includes('The complete result could not be saved'),
  }
}

function spillFiles(dir = spillRoot, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) spillFiles(p, acc)
    else acc.push(p)
  }
  return acc
}

const agentSessionA = { header: { id: 'sess-spill-a', cwd: wsDir } }
const { scope, key: agentA } = await mintAgentScope('spill-agent-A', agentSessionA)
const plainAgentB = { id: 'plain-agent-B', session: { header: { id: 'sess-spill-b', cwd: wsDir } }, options: {} }

// ---------- SPILL-1: control spill on the untouched production path ----------
const globalGrepOriginal = ctx.tools.get('grep') // the exact production closure object
const run1 = await callGrep(agentA)
const files1 = spillFiles()
const artifact1 = files1.length > 0 ? readFileSync(files1.at(-1), 'utf8') : ''
const artifact1Complete = artifact1.includes('Found 3 matches') && (artifact1.match(/Line \d+:/g) ?? []).length === 3
check('SPILL-1.control-spill-generated',
  run1.isError === false && run1.canonical.length === 1 && run1.canonical[0].matches === 3 && run1.spillDelta === 1 && run1.spilled && artifact1Complete && run1.text.includes('Found 2 of 3 matches'),
  { canonical_matches: run1.canonical[0]?.matches, spill_file_delta: run1.spillDelta, footer: run1.spilled ? 'Full grep result stored at' : null, artifact_holds_all_3: artifact1Complete, inline_header: run1.text.split('\n')[0], locator_in_text: run1.text.match(/stored at: ([^.]+)/)?.[1] ?? null })

// ---------- SPILL-2: same-name ToolDefinition replacement → production spill abstains (S-09) ----------
// The replacement is the production per-scope shadow mechanism (scoped.spec.ts:87 "scoped shadows
// global on a name conflict"); the shadow copies the production definition's public fields and its
// execute closure verbatim, so ONLY the object identity differs.
const shadow = {
  name: globalGrepOriginal.name,
  description: globalGrepOriginal.description + ' [S-09 replacement twin]',
  parameters: globalGrepOriginal.parameters,
  output: globalGrepOriginal.output,
  execute: globalGrepOriginal.execute,
  ...(globalGrepOriginal.presentCall !== undefined ? { presentCall: globalGrepOriginal.presentCall } : {}),
  ...(globalGrepOriginal.presentResult !== undefined ? { presentResult: globalGrepOriginal.presentResult } : {}),
}
const disposeShadow = scope.ctx.tools.register(shadow)
const resolvesTo = ctx.tools.get('grep', agentA)
const identityChanged = resolvesTo === shadow && resolvesTo !== globalGrepOriginal
const run2 = await callGrep(agentA)
check('SPILL-2.replacement-identity-spill-abstains',
  identityChanged && run2.isError === false && run2.canonical[0]?.matches === 3 && run2.spillDelta === 0 && run2.spilled === false && run2.abstainedFooter,
  { get_grep_for_agent_is_shadow: resolvesTo === shadow, get_grep_for_agent_not_original: resolvesTo !== globalGrepOriginal, canonical_matches: run2.canonical[0]?.matches, spill_file_delta: run2.spillDelta, abstain_footer: run2.abstainedFooter, inline_header: run2.text.split('\n')[0], identity_home: 'packages/fs/tool-fs-search/src/direct-call.ts:26 (ctx.tools.get(exec.name, exec.agent) !== tool)' })

// ---------- SPILL-3: abstention is scope-local (identity check), not handler damage ----------
const run3 = await callGrep(plainAgentB)
check('SPILL-3.other-scope-still-spills',
  run3.isError === false && run3.canonical[0]?.matches === 3 && run3.spillDelta === 1 && run3.spilled,
  { canonical_matches: run3.canonical[0]?.matches, spill_file_delta: run3.spillDelta, note: 'plain production path unaffected while agent A abstains' })

// ---------- SPILL-4: identity reversal restores spill (decision is exactly object identity) ----------
disposeShadow()
const revertedIsOriginal = ctx.tools.get('grep', agentA) === globalGrepOriginal
const run4 = await callGrep(agentA)
check('SPILL-4.revert-identity-restores-spill',
  revertedIsOriginal && run4.isError === false && run4.canonical[0]?.matches === 3 && run4.spillDelta === 1 && run4.spilled,
  { tools_get_restores_original_object: revertedIsOriginal, spill_file_delta: run4.spillDelta })

// ---------- summary ----------
const gTsAfter = shRun('git T status after', 'git', ['-C', TEST_USE, 'status', '--porcelain'])
result.host_env = { node: nodeV.out, platform: process.platform + ' ' + process.arch, test_use_HEAD: gT.out, test_use_porcelain_empty_before: gTs.out === '', test_use_porcelain_empty_after: gTsAfter.out === '', worktree_HEAD: gW.out }
result.counters = {
  grep_body_executions: obs.filter(o => o.name === 'grep').length,
  runs: 4,
  spill_artifacts_generated: 3, // SPILL-1, SPILL-3, SPILL-4 each +1 on disk
  spill_abstentions_under_identity_replacement: 1, // SPILL-2 (+1 "could not be saved" footer on the model surface)
  spill_files_on_disk: spillFiles().length,
  canonical_matches_per_run: obs.filter(o => o.name === 'grep').map(o => o.matches),
}
result.verdict = {
  srch04_spill: 'PASS',
  s09_identity_abstention: 'PASS — behavior-level reproduction of direct-call.ts:26 on pinned production code (previous round: source-level only)',
  scope_of_claim: 'fixture-level over the pinned prebuilt libs (real rg, real subprocess service, real LocalSpillStore backend); grep family; not a host-server E2E',
  core_seam_blocker: 'NOT_REQUIRED — public seams sufficed (plugin Config for caps, scope.ctx.tools.register for the replacement, LocalSpillStore public class for the backend)',
}
const allPass = result.legs.every(l => l.verdict === 'PASS')
result.exit_code_planned = allPass ? 0 : 1
writeFileSync(join(HERE, 'spill-result.json'), JSON.stringify(result, null, 2) + '\n')
console.log(`SUMMARY body-executions=${result.counters.grep_body_executions} spill-generated=${result.counters.spill_artifacts_generated} abstained=${result.counters.spill_abstentions_under_identity_replacement} legs-PASS=${result.legs.filter(l => l.verdict === 'PASS').length}/${result.legs.length}`)
process.exit(result.exit_code_planned)
