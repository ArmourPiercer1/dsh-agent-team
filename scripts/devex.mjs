#!/usr/bin/env node
/**
 * devex.mjs — EB4-D bounded self-service commands (U7-3).
 *
 * WHY THIS IS A ROUTER AND NOT A NEW CHECK. EB4-D asks for a small, finite command set
 * ("bootstrap / verify changed / Host / security / release / diag"), each with a real error
 * explanation and a named Owner, and it forbids "a second set of parallel scripts". Every check
 * this repository needs already exists as its own script with its own refusal vocabulary. What a
 * newcomer lacks is the answer to "which one do I run now, how long does it take, and what does a
 * red mean". So this file owns exactly three things and nothing else:
 *
 *   1. a CLOSED table of named commands, each mapping to EXISTING `scripts/*.mjs` / `pnpm` argv —
 *      no command here implements a check, so there is no second verdict to drift from the first;
 *   2. declared BOUNDS per command (wall-clock timeout, captured-output cap, scope) that are
 *      ENFORCED when the command is run through `devex run`: a step that overruns is killed and
 *      reported `TIMEOUT`, never left running and never reported green;
 *   3. a single verdict line per run, `DEVEX-RESULT name=… verdict=pass|fail|timeout|refused …`,
 *      where the child's own exit status is the only source of pass/fail.
 *
 * WHAT IS DELIBERATELY ABSENT, and why:
 *   - `host` (boot a test instance): booting is a test-instance operation with its own red lines
 *     (ports, DSH_HOME, never 3080) owned by docs/TEST_METHODS.md and the WorldFactory; a
 *     convenience wrapper would be a second launcher. `devex describe host` prints the pointer and
 *     `devex run host` REFUSES.
 *   - `release` (tag / promote / push): approval-gated, never self-service; `describe` points at
 *     docs/RELEASE.md and `run` REFUSES.
 *   - no `--fix`, no writes outside what the routed script itself already does (only `bootstrap`
 *     writes, and only what `pnpm install` / `pnpm setup` write).
 *
 * BOUNDS ENFORCEMENT. The child runs with `spawnSync` + `timeout` (SIGKILL on overrun) and
 * `maxBuffer`; captured output beyond `outputCap` is cut to its TAIL (a verdict line is usually at
 * the end) with the cut size stated. Measured costs live next to each entry so a reader can check
 * the bound is not fiction; they were measured in the u7-3 worktree and are context, not promises.
 *
 * Usage:
 *   node scripts/devex.mjs list                 # the closed table, one line each
 *   node scripts/devex.mjs describe <name>      # what it runs, bounds, owner, what a red means
 *   node scripts/devex.mjs run <name>           # run it under its bounds; one DEVEX-RESULT line
 *   node scripts/devex.mjs --self-test          # every routed script exists; bounds are sane
 * Exit: run → the routed command's verdict (0 pass, 1 fail/timeout, 2 refused); list/describe 0;
 *       unknown name / usage 2; self-test 0 or 1.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const KiB = 1024

/**
 * The closed command table. `argv[0] === 'node'` routes to process.execPath; `pnpm` routes through
 * PATH (the repo pins pnpm 11.7.0). `measured` = observed on this host (u7-3 worktree, 2026-10-26).
 */
export const COMMANDS = Object.freeze({
  bootstrap: {
    summary: 'fresh checkout → deps + build + install-surface freshness (the cold-start)',
    argv: ['pnpm', 'setup'],
    bounds: { timeoutMs: 10 * 60_000, outputCap: 16 * KiB, scope: 'writes packages/*/dist + composition-shim (the committed install surface); never outside the repo' },
    prerequisite: 'pnpm install --frozen-lockfile (add --store-dir <in-workspace store> under a sandbox)',
    measured: 'exit 0, 10 s',
    owner: 'Release Owner (install surface)',
    red: 'DSH-ARTIFACT-VERDICT … verdict=stale: a source change lacks its rebuilt artifacts — commit them in the SAME commit (docs/RECOVERY.md §2)',
    doc: 'docs/INSTALL-COLD-START.md',
  },
  'verify-changed': {
    summary: 'T0 document/authority gates over THIS change (merge-base..HEAD + uncommitted)',
    steps: [
      ['node', 'scripts/docs-sync.mjs', '--check'],
      ['node', 'scripts/docs-probe.mjs', '--base', 'origin/master'],
    ],
    bounds: { timeoutMs: 2 * 60_000, outputCap: 16 * KiB, scope: 'read-only' },
    measured: 'docs:sync 0.4 s / 581 B; docs:probe 0.45 s / 1.2 KiB',
    owner: 'Doc/Contract Owner',
    red: 'any FAIL line is blocking (LINK_DANGLING, CLAIM_WITHOUT_EVIDENCE, STALE_GENERATED_VIEW…); docs:probe REFUSED BASE_UNRESOLVABLE = fetch origin/master, never --worktree-only to dodge it',
    doc: 'tests/doc-consistency/README.md',
  },
  'verify-gate': {
    summary: 'the PR merge gate, default mode (census skipped by name — CI runs --full)',
    argv: ['node', 'scripts/ci-pr-gate.mjs'],
    bounds: { timeoutMs: 6 * 60_000, outputCap: 24 * KiB, scope: 'read-only except the scratch worktree check-artifacts-at-head creates and removes under .scratch/' },
    measured: 'exit 0, 53–69 s, DSH-CI-VERDICT pass pass=7 skip=1 skipped=census',
    owner: 'CI Owner',
    red: 'a missing DSH-CI-VERDICT line is a FAIL, never not-run; a `refused` leg names its missing prerequisite (scripts/ci-pr-gate.mjs header)',
    doc: 'docs/INSTALL-COLD-START.md',
  },
  security: {
    summary: 'zero-core (no upstream patch) on the pristine host + lint identity diff + diagnostic self-test',
    steps: [
      ['node', 'scripts/verify-zero-core.mjs', '--host', '@HOST_TREE@'],
      ['node', 'scripts/lint-identities.mjs', '--diff', 'dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt'],
      ['node', 'scripts/diag-call-chain.mjs', '--self-test'],
    ],
    bounds: { timeoutMs: 4 * 60_000, outputCap: 16 * KiB, scope: 'read-only; the host tree is only read' },
    measured: 'zero-core <1 s (0 findings, C1–C3); lint-identities ~17 s (new 0); diag self-test 0.08 s',
    owner: 'Security Reviewer',
    red: 'zero-core FINDING = an upstream rewrite trace (CORE PATCH BUDGET = 0 → CORE_SEAM_BLOCKER path, never a patch); lint `new N` = a new identity vs baseline',
    doc: 'docs/RELEASE.md',
  },
  diag: {
    summary: 'attribute one refusal (pass the text after `--`): `devex run diag -- --text "<a5p5-refused …>"`',
    argv: ['node', 'scripts/diag-call-chain.mjs'],
    passArgs: true,
    bounds: { timeoutMs: 15_000, outputCap: 24 * KiB, scope: 'read-only; input ≤1 MiB; redacted output (scripts/diag-call-chain.mjs BOUNDS)' },
    measured: '≈80 ms',
    owner: 'Runtime/Observability Owner',
    red: 'exit 1 = UNKNOWN_CODE / NO_PRODUCTION_EMITTER (never a nearest match); exit 2 = REFUSED (no refusal found, oversize, unsafe output)',
    doc: 'docs/DIAGNOSIS-CALL-CHAIN.md',
  },
  state: {
    summary: 'what state am I in: authority pointer + evidence store integrity',
    steps: [
      ['node', 'scripts/current-authority.mjs', 'status'],
      ['node', 'scripts/evidence-store.mjs', 'verify'],
    ],
    bounds: { timeoutMs: 60_000, outputCap: 8 * KiB, scope: 'read-only' },
    measured: 'authority 0.07 s; evidence-store verify 1.1 s (20148 entries)',
    owner: 'Workflow/Contract Owner + Evidence Owner',
    red: 'POINTER_* / TWO_CURRENT_AUTHORITY = authority transaction needed (approval-gated, docs/RECOVERY.md §4); evidence MISSING/DIGEST_MISMATCH = restore --from-git',
    doc: 'docs/RECOVERY.md',
  },
  'integration-order': {
    summary: 'EB4-E: does a family branch still rest on merged-head C2? (pass a branch after `--`)',
    argv: ['node', 'scripts/integration-order.mjs'],
    passArgs: true,
    bounds: { timeoutMs: 30_000, outputCap: 16 * KiB, scope: 'read-only git + evidence reads' },
    measured: 'see scripts/integration-order.mjs',
    owner: 'Workflow Owner',
    red: 'BRANCH_LOCAL_ONLY / STALE_AGAINST_MERGE_HEAD = branch-local C2 cannot substitute for merged-head C2',
    doc: 'docs/PARALLEL-INTEGRATION.md',  // written by EB4-E (next step); exists by the time EB4-D+E commit lands
  },
  host: {
    summary: 'boot a test Host instance — NOT self-service here',
    refuse: 'booting a Host is a test-instance operation with its own red lines (ports 3180–3186/3491–3500 only, DSH_HOME under tests/homes/, never 3080 or ~/.dsh); use the WorldFactory / the documented chain in docs/TEST_METHODS.md §2. A wrapper here would be a second launcher.',
    bounds: { timeoutMs: 0, outputCap: 0, scope: 'none (refused)' },
    owner: 'Host/Test Maintainer',
    doc: 'docs/TEST_METHODS.md',
  },
  release: {
    summary: 'tag / promote / push — NOT self-service',
    refuse: 'release steps are approval-gated (user release decision + logged one-shot push authorization); see docs/RELEASE.md §3. Nothing here tags, pushes or moves stable.',
    bounds: { timeoutMs: 0, outputCap: 0, scope: 'none (refused)' },
    owner: 'Release Owner',
    doc: 'docs/RELEASE.md',
  },
})

/** Where the pristine host lives: the root checkout owns it, task worktrees reach it at ../../tests. */
export function hostTree(root = REPO_ROOT) {
  for (const cand of [join(root, 'tests', 'deepseek-harness-test-use'), resolve(root, '..', '..', 'tests', 'deepseek-harness-test-use')]) {
    if (existsSync(join(cand, 'package.json'))) return cand
  }
  return null
}

function stepsOf(entry) {
  if (entry.steps) return entry.steps
  if (entry.argv) return [entry.argv]
  return []
}

function tailCap(text, cap) {
  const buf = Buffer.from(text)
  if (buf.length <= cap) return text
  return `…(${String(buf.length - cap)} bytes cut from the head; tail kept)\n${buf.subarray(buf.length - cap).toString('utf8')}`
}

/** Run one routed command under its bounds. Pure of policy: verdict comes from the child's status. */
export function runEntry(name, extra = [], { root = REPO_ROOT, spawn = spawnSync } = {}) {
  const entry = COMMANDS[name]
  if (entry === undefined) return { verdict: 'refused', exit: 2, out: `unknown command ${JSON.stringify(name)} — \`node scripts/devex.mjs list\`` }
  if (entry.refuse) return { verdict: 'refused', exit: 2, out: `REFUSED ${name}: ${entry.refuse}` }
  if (extra.length > 0 && !entry.passArgs) return { verdict: 'refused', exit: 2, out: `REFUSED ${name}: takes no arguments (bounds and scope are fixed per entry)` }
  const host = hostTree(root)
  const started = Date.now()
  const deadline = started + entry.bounds.timeoutMs
  const parts = []
  for (const raw of stepsOf(entry)) {
    let argv = raw.map((a) => (a === '@HOST_TREE@' ? host : a))
    if (argv.includes(null)) {
      return { verdict: 'refused', exit: 2, out: `${parts.join('\n')}\nREFUSED ${name}: needs the pristine test host (tests/deepseek-harness-test-use) and none was found from ${root}; see docs/TEST_METHODS.md §1` }
    }
    if (entry.passArgs) argv = [...argv, ...extra]
    const remaining = deadline - Date.now()
    if (remaining <= 0) return { verdict: 'timeout', exit: 1, out: `${parts.join('\n')}\nTIMEOUT ${name}: budget ${String(entry.bounds.timeoutMs)} ms spent before step ${argv.join(' ')}` }
    const [cmd, ...args] = argv
    const r = spawn(cmd === 'node' ? process.execPath : cmd, args, {
      cwd: root,
      encoding: 'utf8',
      timeout: remaining,
      killSignal: 'SIGKILL',
      maxBuffer: 64 * 1024 * 1024,
    })
    const text = `${r.stdout ?? ''}${r.stderr ?? ''}`
    parts.push(`── ${argv.join(' ')} → ${r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGKILL' ? 'TIMEOUT' : `exit ${String(r.status)}`}\n${tailCap(text, entry.bounds.outputCap)}`)
    if (r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGKILL') return { verdict: 'timeout', exit: 1, out: parts.join('\n') }
    if (r.error) return { verdict: 'refused', exit: 2, out: `${parts.join('\n')}\nREFUSED ${name}: could not spawn ${cmd}: ${String(r.error.message)}` }
    if (r.status !== 0) return { verdict: r.status === 2 ? 'refused' : 'fail', exit: r.status === 2 ? 2 : 1, out: parts.join('\n') }
  }
  return { verdict: 'pass', exit: 0, out: parts.join('\n'), ms: Date.now() - started }
}

/** Static sanity: every routed script exists, bounds are positive and coherent, docs exist. */
export function selfTest(root = REPO_ROOT) {
  const problems = []
  let pkg = null
  try { pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) } catch { /* absent root = missing package.json, pnpm script check will report it */ }
  for (const [name, e] of Object.entries(COMMANDS)) {
    for (const k of ['summary', 'owner', 'doc', 'bounds']) if (e[k] === undefined) problems.push(`${name}: missing ${k}`)
    if (e.doc && !existsSync(join(root, e.doc))) problems.push(`${name}: doc ${e.doc} does not exist`)
    if (e.refuse) {
      if (e.argv || e.steps) problems.push(`${name}: a refused entry must route nowhere`)
      continue
    }
    if (!e.red) problems.push(`${name}: no error explanation (EB4-D: every command needs one)`)
    if (!(e.bounds.timeoutMs > 0) || !(e.bounds.outputCap > 0) || typeof e.bounds.scope !== 'string') problems.push(`${name}: bounds must declare a positive timeout, a positive output cap and a scope`)
    for (const step of stepsOf(e)) {
      if (step[0] === 'node' && !existsSync(join(root, step[1]))) problems.push(`${name}: routed script ${step[1]} does not exist`)
      if (step[0] === 'pnpm' && (pkg?.scripts?.[step[1]] === undefined)) problems.push(`${name}: pnpm script ${step[1]} is not in package.json${pkg === null ? ' (package.json absent)' : ''}`)
    }
  }
  return problems
}

function describe(name) {
  const e = COMMANDS[name]
  const lines = [`${name} — ${e.summary}`]
  if (e.refuse) lines.push(`  REFUSED as self-service: ${e.refuse}`)
  for (const s of stepsOf(e)) lines.push(`  runs: ${s.join(' ')}${e.passArgs ? ' [args after --]' : ''}`)
  if (e.prerequisite) lines.push(`  needs first: ${e.prerequisite}`)
  lines.push(`  bounds: timeout ${String(e.bounds.timeoutMs / 1000)} s · output cap ${String(e.bounds.outputCap)} B · scope: ${e.bounds.scope}`)
  if (e.measured) lines.push(`  measured here: ${e.measured}`)
  if (e.red) lines.push(`  a red means: ${e.red}`)
  lines.push(`  owner: ${e.owner} · doc: ${e.doc}`)
  return lines.join('\n')
}

function main(argv) {
  const [verb, ...rest] = argv
  if (verb === '--self-test') {
    const p = selfTest()
    process.stdout.write(p.length === 0 ? `devex --self-test: OK ${String(Object.keys(COMMANDS).length)} entries\n` : `devex --self-test: FAIL ${String(p.length)}\n${p.map((x) => `  ${x}`).join('\n')}\n`)
    process.exit(p.length === 0 ? 0 : 1)
  }
  if (verb === 'list') {
    for (const [n, e] of Object.entries(COMMANDS)) process.stdout.write(`${n.padEnd(18)} ${e.refuse ? '[refused] ' : ''}${e.summary}\n`)
    process.exit(0)
  }
  if (verb === 'describe') {
    if (!rest[0] || COMMANDS[rest[0]] === undefined) { process.stdout.write(`usage: devex describe <${Object.keys(COMMANDS).join('|')}>\n`); process.exit(2) }
    process.stdout.write(`${describe(rest[0])}\n`)
    process.exit(0)
  }
  if (verb === 'run') {
    const name = rest[0]
    const dd = rest.indexOf('--')
    const extra = dd === -1 ? rest.slice(1) : rest.slice(dd + 1)
    if (dd === -1 && rest.length > 1) { process.stdout.write('REFUSED: pass routed arguments after `--`\n'); process.exit(2) }
    const r = runEntry(name, extra)
    process.stdout.write(`${r.out}\n`)
    process.stdout.write(`DEVEX-RESULT name=${String(name)} verdict=${r.verdict}${r.ms === undefined ? '' : ` ms=${String(r.ms)}`}\n`)
    process.exit(r.exit)
  }
  process.stdout.write('usage: devex.mjs list | describe <name> | run <name> [-- args] | --self-test\n')
  process.exit(2)
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) main(process.argv.slice(2))
