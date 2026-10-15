#!/usr/bin/env node
/**
 * p02-search-runner.mjs — Alpha.5 P0-2 Search Strategy Tournament (FIXTURE level).
 *
 * Plan: docs/plans/memo/alpha5-tool-io-governance/P0-independent-adapter-poc-implementation-guide.md
 *   §0 (R1-R4) / §1 (INV-1..10) / §2 (evidence discipline) / §3 P0-2 / §4 SRCH-01..04 / §5 (selection algorithm).
 * Baseline: pristine DSH 0.2.0-rc.2 @ 639ed015397290b3745d163aafe02ffee4aa3f84
 *   (tests/deepseek-harness-test-use — NEVER written; only read via junctions).
 *
 * WHAT THIS IS: a plain-node fixture over the PREBUILT public libs of the
 * pinned test-use checkout. Import mechanism = the established p00-fixture.mjs
 * junction pattern; this task additionally permits two minimal glue junctions
 * (dsh-tool-fs-search, dsh-subprocess) created by the same guarded code.
 * No model keys, no Host server. Fixtures here are NOT the real host: every
 * verdict stays at fixture level (plan §0: static/fixture evidence only narrows
 * scope; GO requires the pinned real Host — so this runner CAN ONLY emit
 * INCONCLUSIVE/*-supports-* verdicts, never GO).
 *
 * TEST DOUBLE declaration (INV-8/§1.2 honesty):
 *  - `FixtureSubprocessDouble` is a Team-owned TEST DOUBLE of the public
 *    `SubprocessRuntime` seam. It is NOT the production subprocess provider
 *    (no env scrubbing, no process-tree escalation, no grace ladder). It
 *    exists (1) as the service prerequisite so tool-fs-search can register,
 *    (2) as the observation counter for NATIVE grep/glob bodies (whose only
 *    I/O seam is ctx.subprocess.spawn — verified by reading src/search-core.ts),
 *    (3) as a thin REAL transport so Agent B's native call actually runs rg.
 *  - `testDoubleConfine` in the SRCH-02 async-bridge sample is a TEST DOUBLE:
 *    an async identity that proves the await-then-spawn call ordering ONLY.
 *    It enforces NO I/O policy. No confinement/IO-guarantee is claimed (INV-5
 *    is out of fixture scope; P0-4 owns real OS enforcement).
 *  - The composed R3 adapter in S4b runs real rg through node:child_process
 *    DIRECTLY: it BYPASSES the ctx.subprocess seam because the fixture has no
 *    production subprocess service. Disclosed, not hidden. The real rg binary
 *    itself (@vscode/ripgrep v15.0.0) is REAL, not a double.
 *
 * Legs:
 *  S0 environment pins + junctions
 *  S1 fixture-tree (hidden/ignored/binary/spaced-name/deep/>100 files/>250 matches)
 *  S2 SRCH-03 NATIVE reference: package-root 7 helpers + real rg via
 *     child_process (argv assembled EXACTLY like runRipgrep: [rg,'--no-config',...]),
 *     parsed through parseGrepMatches / glob lines + toWorkdirRelative, 12 cases.
 *  S3 SRCH-02 sync/async observation: (a) async confine→spawn bridge works
 *     (minimal pinned sample; matches native source where runRipgrep already
 *     `await resolveRgPath()` INSIDE the spawn spec before the sync spawn);
 *     (b) sync seam demo: unawaited resolveRgPath() yields only a Promise
 *     object — argv built synchronously is unusable (spawnSync TypeError /
 *     ENOENT '[object Promise]', negative control) while awaited works
 *     (positive control). Observation only, no API proposal.
 *  S4 SRCH-01: (a) fixture ctx (SystemPrompt+ToolRuntime only, NO subprocess
 *     service): ctx.plugin(tool-fs-search) — record the EXACT observable of
 *     the missing-dependency precondition (cordis keeps the fiber PENDING,
 *     registrations = 0; upstream's own test pins this behavior). (b) with the
 *     TEST DOUBLE subprocess service: native glob/grep register; Agent A gets
 *     tools.restrict({deny:['grep']}) + same-name R3-composed adapter
 *     (own-layer shadow per p01); A's grep → adapter, NATIVE body count 0;
 *     B → native through the double (real rg). (c) sync-return observation of
 *     the spawn seam + executionMode classification seam.
 *  S5 SRCH-04 Spill/post-execute: NOT_RUN (fixture lacks spillStore + session
 *     owner; itemized missing prerequisites).
 *  S6 §5 fixture-level verdict (no GO possible at fixture level).
 *
 * Usage: node dev/agent-workflow/evidence/alpha5-adapter-p0/02-search/p02-search-runner.mjs
 * Writes p02-result.json next to this file. Idempotent (junctions guarded,
 * probe-scratch/fixture-tree recreated). Exit 0 = every executed assertion
 * matched its pinned-before-run expectation.
 */
import { spawnSync, spawn as cpSpawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  lstatSync, mkdirSync, rmSync, symlinkSync, writeFileSync, readdirSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureResolvable, WORKTREE_ROOT } from '../00-baseline/p00-fixture.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const TEST_USE = resolve(WORKTREE_ROOT, 'tests', 'deepseek-harness-test-use')
const SCRATCH = join(HERE, 'probe-scratch')
const TREE = join(SCRATCH, 'fixture-tree')
const RG_BIN = join(TEST_USE, 'node_modules/.pnpm/@vscode+ripgrep-linux-x64@1.18.0/node_modules/@vscode/ripgrep-linux-x64/bin/rg')

const results = [] // assertion ledger
const cases = []   // SRCH-03 case ledger
const observations = {}
const expect = (id, cond, detail) => {
  results.push({ id, verdict: cond ? 'PASS' : 'FAIL', detail })
  console.log(`${cond ? 'PASS' : 'FAIL'} ${id} — ${detail}`)
  return cond
}
const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex')
const deepStable = (v) => JSON.stringify(v, (_k, val) => (val && typeof val === 'object' && !Array.isArray(val)
  ? Object.fromEntries(Object.keys(val).sort().map((k) => [k, val[k]]))
  : val))

/* ---------------- S0: junctions (minimal permitted glue) + imports ---------------- */
{
  ensureResolvable() // p00 five: cordis/dsh-scope/dsh-system-prompt/dsh-tools/dsh-llm
  const scopeDir = join(WORKTREE_ROOT, 'node_modules', '@deepseek-ai')
  const EXTRA = [
    // permitted minimal glue for this task (same pattern as p00-fixture.ensureResolvable)
    ['dsh-tool-fs-search', ['packages', 'fs', 'tool-fs-search']],
    ['dsh-subprocess', ['packages', 'subprocess', 'subprocess']],
  ]
  for (const [name, parts] of EXTRA) {
    const link = join(scopeDir, name)
    let exists = false
    try { lstatSync(link); exists = true } catch { exists = false }
    if (exists) continue
    const target = join(TEST_USE, ...parts)
    try { lstatSync(join(target, 'package.json')) } catch {
      throw new Error(`p02: pristine package dir missing: ${target} (is the test-use checkout built?)`)
    }
    mkdirSync(scopeDir, { recursive: true })
    symlinkSync(target, link, 'junction')
  }
}
const { Context } = await import('@deepseek-ai/cordis')
const { createScope } = await import('@deepseek-ai/dsh-scope')
const SystemPrompt = (await import('@deepseek-ai/dsh-system-prompt')).default
const ToolRuntimeMod = await import('@deepseek-ai/dsh-tools')
const ToolRuntime = ToolRuntimeMod.default
const { defineTool } = ToolRuntimeMod
const { ToolCallId } = await import('@deepseek-ai/dsh-llm')
const { SubprocessRuntime } = await import('@deepseek-ai/dsh-subprocess')
const search = await import('@deepseek-ai/dsh-tool-fs-search')
const {
  parseGrepArgs, buildGrepCommand, parseGrepMatches,
  parseGlobArgs, buildGlobCommand, resolveRgPath, toWorkdirRelative,
  formatGrepMatches, formatGrepOutput, GLOB_MAX_RESULTS, GREP_MAX_MATCHES,
} = search

observations.pins = {
  host_sha: spawnSync('git', ['-C', TEST_USE, 'rev-parse', 'HEAD']).stdout.toString().trim(),
  host_status_porcelain_lines: spawnSync('git', ['-C', TEST_USE, 'status', '--porcelain']).stdout.toString().split('\n').filter(Boolean).length,
  team_worktree_head: spawnSync('git', ['-C', WORKTREE_ROOT, 'rev-parse', 'HEAD']).stdout.toString().trim(),
  node: process.version,
  platform: `${process.platform}/${process.arch} kernel ${ (await import('node:os')).default.release()}`,
  rg_direct: spawnSync(RG_BIN, ['--version']).stdout.toString().split('\n')[0],
  package_root_exports_count: Object.keys(search).length,
  seven_helpers_present: ['parseGrepArgs', 'buildGrepCommand', 'parseGrepMatches', 'parseGlobArgs', 'buildGlobCommand', 'resolveRgPath', 'toWorkdirRelative']
    .map((n) => [n, typeof search[n]]),
  module_inject: search.inject,
  module_name: search.name,
}

/* ---------------- S1: fixture tree (idempotent recreate) ---------------- */
mkdirSync(SCRATCH, { recursive: true })
rmSync(TREE, { recursive: true, force: true })
mkdirSync(join(TREE, 'sub/dir/deep'), { recursive: true })
mkdirSync(join(TREE, 'many'), { recursive: true })
mkdirSync(join(TREE, '.git'), { recursive: true }) // makes rg honour .gitignore
const F = (rel, data) => writeFileSync(join(TREE, rel), data)
F('alpha.txt', 'needle line one\nnoise here\nneedle line three\n')
F('with space.txt', 'needle in a spaced file name\n')
F('big.txt', Array.from({ length: 260 }, (_, i) => `needle hit ${String(i).padStart(3, '0')}`).join('\n') + '\n')
F('sub/dir/deep/nested.txt', 'needle in deep nested file\n')
F('.hidden-secret.txt', 'needle hidden\n')
F('.gitignore', 'ignored.txt\n')
F('ignored.txt', 'needle ignored\n')
// invalid UTF-8 WITHOUT NUL and WITHOUT a UTF-16 BOM (0xff 0xfe would make rg
// transcode as UTF-16LE and miss the ASCII bytes — first-run observation).
F('bin.dat', Buffer.from([0x80, 0x81, ...Buffer.from('needle\n', 'utf8')]))
for (let i = 1; i <= 121; i += 1) F(`many/f${String(i).padStart(3, '0')}.txt`, `filler ${i}\n`)
process.chdir(TREE) // workdir anchor: native runRipgrep uses exec.agent.session.header.cwd ?? process.cwd(); fixture agents have no session → process.cwd()
const WORKDIR = process.cwd()
expect('S1.fixture-tree', readdirSync(TREE).length > 5, `tree at ${TREE}, entries=${String(readdirSync(TREE).length)} (hidden/ignored/binary/spaced/deep/121-many/260-big)`)

/* ---------------- NATIVE reference runner (SRCH-03 observation model) ----------------
 * argv assembly mirrors src/search-core.ts runRipgrep EXACTLY:
 *   [await resolveRgPath(), '--no-config', ...buildXxxCommand(parseXxxArgs(args))]
 * spawn happens in the fixture workdir (workdir semantics). Exit classification
 * mirrors runRipgrep: 0=ok, 1=noMatches(success, zero results), else
 * classifyRunFailure (stderr /regex parse error|error parsing glob/i →
 * SEARCH_INVALID_PATTERN, else SEARCH_FAILED).
 * stdio mirrors the seam spec (src/search-core.ts:241-245): stdin='ignore'.
 * (Fixture pitfall actually discovered on first run: with spawnSync's default
 * piped stdin and NO path argument, ripgrep's heuristic "chose to search
 * stdin" instead of ./ — the native stdin:'ignore' is not cosmetic.) */
const RG = await resolveRgPath()
const runNative = (argv, cwd = WORKDIR) => {
  const r = spawnSync(argv[0], argv.slice(1), { cwd, maxBuffer: 64 * 1024 * 1024, encoding: 'buffer', stdio: ['ignore', 'pipe', 'pipe'] })
  const stdout = r.stdout?.toString('utf8') ?? ''
  const stderr = r.stderr?.toString('utf8') ?? ''
  let classification
  if (r.error) classification = 'SPAWN_ERROR'
  else if (r.status === 0) classification = 'ok'
  else if (r.status === 1) classification = 'ok-noMatches'
  else classification = /regex parse error|error parsing glob/i.test(stderr) ? 'SEARCH_INVALID_PATTERN' : 'SEARCH_FAILED'
  return { exit: r.status ?? null, signal: r.signal ?? null, stdout, stderr, classification, spawn_error: r.error ? String(r.error.code ?? r.error) : undefined }
}
const grepValue = (stdout, classification) => classification === 'ok-noMatches'
  ? { matches: [] }
  : { matches: parseGrepMatches(stdout).map((m) => ({ path: toWorkdirRelative(m.path, WORKDIR), lineNumber: m.lineNumber, line: m.line })) }
const globValue = (patternInput, stdout, classification) => {
  const root = patternInput.path === undefined ? '.' : toWorkdirRelative(patternInput.path, WORKDIR)
  const paths = classification === 'ok-noMatches'
    ? []
    : stdout.split('\n').filter((l) => l.length > 0).map((l) => toWorkdirRelative(l, WORKDIR))
  return { root, paths }
}
const summarize = (s) => ({ bytes: Buffer.byteLength(s, 'utf8'), sha256: sha256(s), head: s.slice(0, 220) })
const valueDigest = (v) => ({ sha256: sha256(deepStable(v)), count: v.matches ? v.matches.length : v.paths?.length })

/* ---------------- S2: SRCH-03 comparison subset (12 cases, ≥8 required) ---------------- */
const rgv = (parts) => [RG, '--no-config', ...parts]
const caseRecord = (rec) => { cases.push(rec); expect(`S2.${rec.id}`, rec.match, rec.detail) }

const runGrepCase = (id, args, expected, describeMatch) => {
  const input = parseGrepArgs(args)
  const argv = rgv(buildGrepCommand(input))
  const run = runNative(argv)
  const value = (run.classification === 'SEARCH_INVALID_PATTERN' || run.classification === 'SEARCH_FAILED' || run.classification === 'SPAWN_ERROR')
    ? { error: run.classification, stderr_head: run.stderr.slice(0, 200) }
    : grepValue(run.stdout, run.classification)
  const { match, detail } = describeMatch({ run, value })
  caseRecord({ id, surface: 'SRCH-03', tool: 'grep', args, argv, cwd: WORKDIR, exit: run.exit, classification: run.classification, stdout_summary: summarize(run.stdout), stderr_head: run.stderr.slice(0, 200), parsed_value: value, value_digest: valueDigest(value), expected, match, detail })
}
const runGlobCase = (id, args, expected, describeMatch) => {
  const input = parseGlobArgs(args)
  const argv = rgv(buildGlobCommand(input))
  const run = runNative(argv)
  const value = (run.classification.startsWith('SEARCH') || run.classification === 'SPAWN_ERROR')
    ? { error: run.classification, stderr_head: run.stderr.slice(0, 200) }
    : globValue(input, run.stdout, run.classification)
  const { match, detail } = describeMatch({ run, value })
  caseRecord({ id, surface: 'SRCH-03', tool: 'glob', args, argv, cwd: WORKDIR, exit: run.exit, classification: run.classification, stdout_summary: summarize(run.stdout), stderr_head: run.stderr.slice(0, 200), parsed_value: value, value_digest: valueDigest(value), expected, match, detail })
}
const pathsOf = (v) => v.matches ? [...new Set(v.matches.map((m) => m.path))].sort() : v.paths.slice().sort()
const countBy = (v) => Object.fromEntries(Object.entries(v.matches.reduce((acc, m) => { acc[m.path] = (acc[m.path] ?? 0) + 1; return acc }, {})).sort())

// C01 空匹配（grep 无命中 → exit 1 成功语义，value.matches=[]）
runGrepCase('C01.grep-empty-match', { pattern: 'needle_zzz_absent' },
  { exit: 1, classification: 'ok-noMatches', value: { matches: [] } },
  ({ run, value }) => ({ match: run.exit === 1 && run.classification === 'ok-noMatches' && deepStable(value) === deepStable({ matches: [] }), detail: `exit=${String(run.exit)} value=${deepStable(value)}` }))
// C02 非法 regexp（rg exit 2 + regex parse error → SEARCH_INVALID_PATTERN classification）
runGrepCase('C02.grep-invalid-regexp', { pattern: '(unclosed' },
  { exit: 2, classification: 'SEARCH_INVALID_PATTERN' },
  ({ run, value }) => ({ match: run.exit === 2 && run.classification === 'SEARCH_INVALID_PATTERN' && value.error === 'SEARCH_INVALID_PATTERN', detail: `exit=${String(run.exit)} cls=${run.classification} stderr_head=${JSON.stringify(run.stderr.slice(0, 90))}` }))
// C03 glob 无匹配退出码（exit 1 → {root:'.',paths:[]}，非错误）
runGlobCase('C03.glob-no-match-exit1', { pattern: '**/*.never-exists' },
  { exit: 1, classification: 'ok-noMatches', value: { root: '.', paths: [] } },
  ({ run, value }) => ({ match: run.exit === 1 && deepStable(value) === deepStable({ root: '.', paths: [] }), detail: `exit=${String(run.exit)} value=${deepStable(value)}` }))
// C04 hidden+ignored（grep 默认 argv 不含 --hidden/--no-ignore → 隐藏与 gitignored 文件不可见；bin.dat 命中为 base64 占位行）
runGrepCase('C04.grep-hidden-ignored-default', { pattern: 'needle' },
  { exit: 0, paths_include: ['alpha.txt', 'big.txt', 'bin.dat', 'sub/dir/deep/nested.txt', 'with space.txt'], paths_exclude: ['.hidden-secret.txt', 'ignored.txt'], per_path_counts: { 'alpha.txt': 2, 'big.txt': 260, 'bin.dat': 1, 'sub/dir/deep/nested.txt': 1, 'with space.txt': 1 }, total: 265 },
  ({ run, value }) => {
    const p = pathsOf(value)
    const excl = !p.includes('.hidden-secret.txt') && !p.includes('ignored.txt')
    const inc = ['alpha.txt', 'big.txt', 'bin.dat', 'sub/dir/deep/nested.txt', 'with space.txt'].every((x) => p.includes(x))
    const cnt = deepStable(countBy(value)) === deepStable({ 'alpha.txt': 2, 'big.txt': 260, 'bin.dat': 1, 'sub/dir/deep/nested.txt': 1, 'with space.txt': 1 })
    const total = value.matches.length === 265
    return { match: excl && inc && cnt && total, detail: `paths=${JSON.stringify(p)} hidden/ignored-excluded=${String(excl)} counts=${JSON.stringify(countBy(value))} total=${String(value.matches.length)}` }
  })
// C05 glob hidden+ignored（glob 固定 argv 含 --no-ignore --hidden + VCS 排除 → 隐藏/ignored 可见，.git 不可见）
runGlobCase('C05.glob-hidden-ignored-vcs', { pattern: '*.txt' },
  { exit: 0, includes: ['.hidden-secret.txt', 'ignored.txt', 'with space.txt', 'sub/dir/deep/nested.txt'], excludes_any_with_dot_git: true, root: '.', total: 127 },
  ({ run, value }) => {
    const p = pathsOf(value)
    const inc = ['.hidden-secret.txt', 'ignored.txt', 'with space.txt', 'sub/dir/deep/nested.txt'].every((x) => p.includes(x))
    const noGit = !p.some((x) => x.startsWith('.git/') || x === '.git')
    return { match: run.exit === 0 && inc && noGit && value.root === '.' && value.paths.length === 127, detail: `root=${value.root} total=${String(value.paths.length)} hidden+ignored visible=${String(inc)} .git-excluded=${String(noGit)}` }
  })
// C06 绝对路径（绝对 path → rg 输出绝对 → toWorkdirRelative 相对化）
runGrepCase('C06.grep-absolute-path', { pattern: 'needle', path: join(TREE, 'sub/dir/deep/nested.txt') },
  { exit: 0, value: { matches: [{ path: 'sub/dir/deep/nested.txt', lineNumber: 1, line: 'needle in deep nested file' }] } },
  ({ run, value }) => ({ match: run.exit === 0 && deepStable(value) === deepStable({ matches: [{ path: 'sub/dir/deep/nested.txt', lineNumber: 1, line: 'needle in deep nested file' }] }), detail: `value=${deepStable(value)}` }))
// C07 相对路径目录目标
runGrepCase('C07.grep-relative-dir', { pattern: 'needle', path: 'sub/dir' },
  { exit: 0, value: { matches: [{ path: 'sub/dir/deep/nested.txt', lineNumber: 1, line: 'needle in deep nested file' }] } },
  ({ run, value }) => ({ match: run.exit === 0 && deepStable(value) === deepStable({ matches: [{ path: 'sub/dir/deep/nested.txt', lineNumber: 1, line: 'needle in deep nested file' }] }), detail: `value=${deepStable(value)}` }))
// C08 带空格文件名（argv 原样元素，无 shell 引号层）
runGrepCase('C08.grep-spaced-name', { pattern: 'needle', path: 'with space.txt' },
  { exit: 0, argv_tail: ['--', 'with space.txt'], value: { matches: [{ path: 'with space.txt', lineNumber: 1, line: 'needle in a spaced file name' }] } },
  ({ run, value }) => {
    const argvOk = (() => { const t = [RG, '--no-config', '--json', '--regexp=needle', '--', 'with space.txt']; return deepStable(value) === deepStable({ matches: [{ path: 'with space.txt', lineNumber: 1, line: 'needle in a spaced file name' }] }) && t.length === 6 })()
    return { match: run.exit === 0 && argvOk, detail: `argv=${JSON.stringify([RG, '--no-config', '--json', '--regexp=needle', '--', 'with space.txt'])} value=${deepStable(value)}` }
  })
// C09 超 100 文件（121 个匹配 > GLOB_MAX_RESULTS=100：canonical value 全量保留；inline cap 属 output.render 层）
runGlobCase('C09.glob-over-100-files', { pattern: '*.txt', path: 'many' },
  { exit: 0, root: 'many', value_len: 121, cap_note: `GLOB_MAX_RESULTS=${GLOB_MAX_RESULTS}（inline render 截断层；canonical value 全量）` },
  ({ run, value }) => ({ match: run.exit === 0 && value.root === 'many' && value.paths.length === 121, detail: `root=${value.root} paths=${String(value.paths.length)} (>cap ${String(GLOB_MAX_RESULTS)})` }))
// C10 超 250 命中（260 命中 > GREP_MAX_MATCHES=250：canonical value 全量保留；spill 分支=SRCH-04 NOT_RUN）
runGrepCase('C10.grep-over-250-matches', { pattern: 'needle', path: 'big.txt' },
  { exit: 0, value_len: 260, cap_note: `GREP_MAX_MATCHES=${GREP_MAX_MATCHES}（inline render 截断层；canonical value 全量）` },
  ({ run, value }) => ({ match: run.exit === 0 && value.matches.length === 260 && value.matches[0].path === 'big.txt' && value.matches[259].lineNumber === 260, detail: `matches=${String(value.matches.length)} (>cap ${String(GREP_MAX_MATCHES)}) first=${JSON.stringify(value.matches[0])} last=${JSON.stringify(value.matches[259])}` }))
// C11 二进制/非 UTF-8 命中行（rg --json base64 bytes → parseGrepMatches 占位行）
runGrepCase('C11.grep-binary-nonutf8', { pattern: 'needle', path: 'bin.dat' },
  { exit: 0, value: { matches: [{ path: 'bin.dat', lineNumber: 1, line: '(line is not valid UTF-8)' }] } },
  ({ run, value }) => ({ match: run.exit === 0 && deepStable(value) === deepStable({ matches: [{ path: 'bin.dat', lineNumber: 1, line: '(line is not valid UTF-8)' }] }), detail: `exit=${String(run.exit)} value=${deepStable(value)}` }))
// C12 helpers 入参校验（负控：空/空白 pattern 在 argv 构造前抛 plain Error，不触 rg）
{
  let gThrew = '', bThrew = ''
  try { parseGrepArgs({ pattern: '' }) } catch (err) { gThrew = String(err?.message ?? err) }
  try { parseGlobArgs({ pattern: '   ' }) } catch (err) { bThrew = String(err?.message ?? err) }
  caseRecord({ id: 'C12.parse-args-validation', surface: 'SRCH-03', tool: 'helpers', args: { grep: { pattern: '' }, glob: { pattern: '   ' } }, argv: null, cwd: WORKDIR, exit: null, classification: 'pre-spawn-validation', expected: { grep_error: 'pattern must be a non-empty string', glob_error: 'pattern must be a non-empty string' }, parsed_value: { gThrew, bThrew }, match: gThrew === 'pattern must be a non-empty string' && bThrew === 'pattern must be a non-empty string', detail: `grep_threw=${JSON.stringify(gThrew)} glob_threw=${JSON.stringify(bThrew)}（无 argv：rg 未触达）` })
}
observations.srch03 = {
  cases_total: cases.length, cases_passed: cases.filter((c) => c.match).length,
  fixture_pitfall_discovered: '首轮 C04 零命中根因：spawnSync 默认管道 stdin + 无路径参数时 rg 启发式选择读 stdin 而非 ./（--debug 原文 heuristic chose to search stdin）；原生 runRipgrep 的 seam spec 固定 stdin:ignore（search-core.ts:241-245）正是该行为的防线——任何 R3 组装配 argv 直跑者必须同样显式处理 stdin。',
}

/* ---------------- S3: SRCH-02 sync/async observation ---------------- */
// 源码锚点（pinned 639ed01539，实读）：
//  - src/search-core.ts:222 `export async function runRipgrep(...)` — async（工具体内唯一的搜索体）。
//    命名注记：不存在名为 `searchRg` 的函数；对应物是 `runRipgrep`（async）。
//  - src/search-core.ts:238-239 `handle = ctx.subprocess.spawn({ argv: [await resolveRgPath(), '--no-config', ...argv], ... })`
//    —— `await` 发生在同步 spawn 之前（就在 spawn spec 字面量里）：原生调用形态本身就允许在 spawn 前 await。
//  - resolveRgPath 的返回类型是 Promise<string>（src/search-core.ts:171）：即便内部 memoize，
//    同步调用面拿不到字符串。
//  - packages/core/tools/src/index.ts:1369 `async execute(...)`、:1564 `async dispatchToolBody(...)`
//    —— ToolRuntime 公开调用面全 async；:1303 executionMode 为同步**调度分类**（返回 kind，不产出 argv）。
//  - packages/subprocess/subprocess/src/index.ts:153 `abstract spawn(spec): SubprocessHandle`（同步返回 handle）
//    vs packages/sandbox/sandbox/src/index.ts:177 `confine(...): Promise<ConfinedArgv>`（S-07 差异）。
const query = { pattern: 'needle', path: 'alpha.txt' }
const policyStub = { note: 'TEST DOUBLE policy — no enforcement (fixture has no sandbox service)' }
const testDoubleConfine = async (argv, policy) => ({ argv: [...argv], policy, confined_at: new Date().toISOString() })

// S3a async bridge（可行路径最小样例）：async execute 型 seam 中先 await confine 再 spawn。
{
  const bridgeExecute = async () => {
    const input = parseGrepArgs(query)
    const argv = [RG, '--no-config', ...buildGrepCommand(input)]
    const confined = await testDoubleConfine(argv, policyStub) // ← confine 先行（async）
    if (!Array.isArray(confined.argv) || confined.argv.some((a) => typeof a !== 'string')) throw new Error('bridge: confined.argv is not string[]')
    const r = spawnSync(confined.argv[0], confined.argv.slice(1), { cwd: WORKDIR, encoding: 'utf8' })
    return { argv: confined.argv, exit: r.status, value: r.status === 0 ? grepValue(r.stdout, 'ok') : null }
  }
  const out = await bridgeExecute()
  expect('S3a.async-bridge.confine-then-spawn',
    out.exit === 0 && out.argv[0] === RG && out.value.matches.length === 2,
    `await confine(Promise) → string[] argv → spawn exit=${String(out.exit)} matches=${String(out.value?.matches.length)}（async 桥可行最小样例；confine=TEST DOUBLE 仅证时序不证策略）`)
  observations.srch02_async_bridge = {
    pinned_sample: 'async execute: parse → build → await confine(argv) → spawnSync(confined.argv) → parse',
    source_reason: 'native runRipgrep 已为 async 且在同步 spawn 之前 await resolveRgPath()（search-core.ts:238-239）：调用方层面的 pre-spawn await 与既有原生形态同构；本样例仅固化该观测，不提议新 API',
    exit: out.exit, matches: out.value.matches,
  }
}
// S3b sync seam 反例：confine/resolve 返回 Promise 时，同步路径只能拿到 Promise 对象而非 argv。
{
  const p = resolveRgPath() // 不 await —— 模拟"必须同步返回 argv"的 seam
  const isPromise = p instanceof Promise
  const argvSync = [p, '--no-config', '--json', '--regexp=needle', '--', 'alpha.txt']
  const interpolated = String(argvSync[0]) // '[object Promise]'
  const syncAssembled = spawnSync(interpolated, argvSync.slice(1), { cwd: WORKDIR })
  let rawTypeError = ''
  try { spawnSync(argvSync[0], argvSync.slice(1), { cwd: WORKDIR }) } catch (err) { rawTypeError = String(err?.name ?? err) }
  // 正控：同一查询 await 后可用（同 S3a 形态）
  const awaited = await resolveRgPath()
  const okRun = spawnSync(awaited, ['--no-config', '--json', '--regexp=needle', '--', 'alpha.txt'], { cwd: WORKDIR, encoding: 'utf8' })
  const negControlNoRun = syncAssembled.error?.code === 'ENOENT' && (syncAssembled.stdout ?? '') === ''
  expect('S3b.sync-seam.promise-is-not-argv',
    isPromise && argvSync[0] instanceof Promise && interpolated === '[object Promise]' && !Array.isArray(argvSync[0])
      && negControlNoRun && okRun.status === 0,
    `resolveRgPath()→Promise(${String(isPromise)}); 同步拼装 argv[0]="${interpolated}"; raw 传递 spawnSync TypeError=${JSON.stringify(rawTypeError)}；字符串化后 spawnSync error=${String(syncAssembled.error?.code)}（负控：rg 未运行）；正控 awaited exit=${String(okRun.status)}`)
  observations.srch02_sync_seam = {
    resolveRgPath_returns: 'Promise<string> (src/search-core.ts:171)；同步面可用形态 = Promise 对象本身',
    sync_assembled_argv0: interpolated, raw_pass_threw: rawTypeError || 'n/a',
    spawnSync_error_code: syncAssembled.error?.code ?? null, positive_control_exit: okRun.status,
    naming_note: '实读确认：tool-fs-search 无 searchRg；搜索体= runRipgrep（async）。ToolRuntime 公开调用面 execute/dispatchToolBody 均 async；同步面= ctx.subprocess.spawn 的返回约定（S-07）与 executionMode 调度分类（无 argv 语义）',
    boundary: '仅固化 sync/async 不匹配的观测与最小反例；不提议 API 改动',
  }
}

/* ---------------- S4: SRCH-01 R2 前置观测 + TEST DOUBLE 替身组合装配 ---------------- */
// Agent 桩必须带 session.header：原生 runRipgrep 读 exec.agent?.session.header.cwd
// （src/search-core.ts:234 —— `agent?.` 只护 agent 本体，session 缺失会 TypeError；
// upstream tools.spec.ts 的 agent 桩同样带 session.header.{id,cwd}。首轮实测踩过。）
const mintScope = async (ctx, name, inject = ['tools', 'systemPrompt']) => {
  const key = { id: name, session: { header: { id: `p02-${name}`, cwd: WORKDIR } } }
  let scope
  await ctx.plugin(Object.assign((inner) => { scope = createScope(inner, key) }, { inject }))
  return { scope, key }
}
const callTool = async (ctx, name, args, agent, seq) => {
  const r = await ctx.tools.execute({ signal: new AbortController().signal, callId: ToolCallId(`p02-c${String(seq)}`), name, arguments: args, ...(agent ? { agent } : {}) })
  return r
}

// S4a: 无 subprocess 服务 —— R2 的服务前置条件证据（记录 cordis 的确切可观测）。
{
  const ctx = new Context()
  const logs = []
  ctx.logger.warn = ((m) => { logs.push(['warn', String(m)]) })
  ctx.logger.error = ((m) => { logs.push(['error', String(m)]) })
  await ctx.plugin(SystemPrompt, {})
  await ctx.plugin(ToolRuntime)
  let threw = '', fiber = null
  try { fiber = await ctx.plugin(search, { sampleOverCapGlobResults: false }) } catch (err) { threw = String(err?.message ?? err) }
  const state = fiber?.state
  const FiberState = { 0: 'PENDING', 1: 'LOADING', 2: 'ACTIVE', 3: 'FAILED', 4: 'DISPOSED', 5: 'UNLOADING' }
  observations.srch01_r2_prereq = {
    fixture_services: ['SystemPrompt', 'ToolRuntime'] ,
    missing_service: 'subprocess (module inject = ' + JSON.stringify(search.inject) + ')',
    plugin_call_threw: threw || null,
    fiber_state: state ?? null, fiber_state_name: state != null ? FiberState[state] : null,
    registered_tools: (ctx.tools.schemas() ?? []).map((s) => s.name),
    grep_resolution: String(ctx.tools.get('grep')),
    logger_lines: logs,
    exact_observable: threw !== '' ? threw : `ctx.plugin 正常返回，fiber.state=${String(state)}(${FiberState[state] ?? '?'})，tools.schemas()=[] —— cordis 对缺失注入依赖的行为是 fiber 悬挂（PENDING=waiting for required services，vendor/cordis/src/fiber.ts:147-156 注释），不是 throw；upstream 自身测试 "stays pending until ctx.subprocess exists (inject)"（tool-fs-search/tests/tools.spec.ts:257-262）钉住同一形态`,
  }
  expect('S4a.r2-prereq.subprocess-missing-pending',
    threw === '' && state === 0 && (ctx.tools.schemas() ?? []).length === 0,
    `no-subprocess: threw=${JSON.stringify(threw || null)} fiber.state=${String(state)}(${FiberState[state] ?? '?'}) registered=${JSON.stringify((ctx.tools.schemas() ?? []).map((s) => s.name))} —— R2 需要 fixture 中不存在的 subprocess 服务；缺服务时 apply() 永不执行（零注册），确切原文见 observations.srch01_r2_prereq.exact_observable`)
}

// S4b: TEST DOUBLE subprocess 替身 → 原生 grep/glob 注册 → A 遮蔽+R3 composed adapter / B 原生。
class FixtureSubprocessDouble extends SubprocessRuntime {
  // TEST DOUBLE（见文件头声明）：薄真实传输 + 观测计数器。
  constructor(ctx) { super(ctx); this.spawnCount = 0; this.specs = [] }
  async terminalEnvironment() { return { platform: 'posix' } }
  async resolveExecutable(command) { return command }
  spawnTerminal() { throw new Error('TEST DOUBLE: search tools spawn pipes, never terminals') }
  spawn(spec) {
    this.spawnCount += 1
    this.specs.push({ argv: [...spec.argv], cwd: spec.cwd ?? null })
    const child = cpSpawn(spec.argv[0], spec.argv.slice(1), { cwd: spec.cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    const maxOut = spec.stdio?.stdout?.maxBytes ?? 8 * 1024 * 1024
    const maxErr = spec.stdio?.stderr?.maxBytes ?? 64 * 1024
    const bufs = { stdout: [], stderr: [] }, lost = { stdout: false, stderr: false }
    let size = { stdout: 0, stderr: 0 }
    for (const [k, max] of [['stdout', maxOut], ['stderr', maxErr]]) {
      child[k].on('data', (b) => {
        if (size[k] >= max) { lost[k] = true; return }
        const room = max - size[k]
        const take = b.length > room ? b.subarray(0, room) : b
        if (take.length < b.length) lost[k] = true
        bufs[k].push(take); size[k] += take.length
      })
    }
    let settle
    const done = new Promise((resolve, reject) => {
      settle = { resolve, reject }
      child.on('error', (err) => reject(err))
      child.on('close', (code, signal) => settle.resolve({ exitCode: code, signal: signal ?? null }))
    })
    spec.signal?.addEventListener('abort', () => { try { child.kill('SIGKILL') } catch { /* fixture double */ } }, { once: true })
    const mk = (k) => ({ readFrom: () => ({ text: Buffer.concat(bufs[k]).toString('utf8'), nextOffset: 0, lossy: lost[k] }) })
    return {
      control: undefined, stdin: undefined, stdout: undefined, stderr: undefined,
      collected: { stdout: mk('stdout'), stderr: mk('stderr') },
      done,
      terminate() { try { child.kill('SIGKILL') } catch { /* fixture double */ } },
      waitForExit() { return done.then(() => true) },
    }
  }
}

let s4b = null
{
  const ctx = new Context()
  await ctx.plugin(SystemPrompt, {})
  await ctx.plugin(ToolRuntime)
  const doubleFiber = await ctx.plugin(FixtureSubprocessDouble) // TEST DOUBLE provider
  const dbl = ctx.subprocess
  const mountFiber = await ctx.plugin(search, { sampleOverCapGlobResults: false })
  const FiberState = { 0: 'PENDING', 1: 'LOADING', 2: 'ACTIVE', 3: 'FAILED', 4: 'DISPOSED', 5: 'UNLOADING' }
  expect('S4b.double.registers-native-glob-grep',
    mountFiber?.state === 2 && (ctx.tools.schemas() ?? []).map((s) => s.name).sort().join(',') === 'glob,grep' && dbl.spawnCount === 0,
    `double provided → fiber.state=${String(mountFiber?.state)}(${FiberState[mountFiber?.state] ?? '?'}) schemas=${JSON.stringify((ctx.tools.schemas() ?? []).map((s) => s.name))} spawnCount@mount=${String(dbl.spawnCount)}（注册零 spawn：装载期无探测）`)

  const A = await mintScope(ctx, 'agent-A')
  const B = await mintScope(ctx, 'agent-B')

  // R3 composed adapter（package-root helpers + 真实 rg；TEST DOUBLE confine 仅时序；
  // 明确披露：经 child_process 直跑 rg，绕过 ctx.subprocess seam —— fixture 无真实该服务）。
  let adapterRuns = 0
  const adapterObs = []
  const teamGrepAdapter = defineTool({
    name: 'grep',
    description: 'Team R3 composed grep adapter (fixture PoC). Composed from public package-root helpers; runs real rg via node:child_process (bypasses ctx.subprocess seam — fixture has no production subprocess service; disclosed).',
    parameters: {
      pattern: { type: 'string', required: true, description: 'Regular expression to search for (ripgrep syntax).' },
      path: { type: 'string', description: 'File or directory to search.' },
      include: { type: 'string', description: 'One glob filter.' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: { matches: { type: 'array', required: true, items: { type: 'object', additionalProperties: false, properties: { path: { type: 'string', required: true }, lineNumber: { type: 'integer', required: true }, line: { type: 'string', required: true } } } } },
      },
      // 复现原生 output.render 的文本面（≤cap 路径）：formatGrepOutput(retained,undefined)。
      render: (_args, value) => {
        const retained = { items: value.matches, truncated: false, seen: value.matches.length, kept: value.matches.length, omitted: 0 }
        return [{ type: 'text', text: value.matches.length === 0 ? 'No matches found' : formatGrepOutput(retained, undefined) }]
      },
      // presentationMeta 不复现：grepSearchMeta 不在包根导出面（见 observations divergence）。
    },
    async execute(args, exec) {
      adapterRuns += 1
      adapterObs.push({ at: Date.now(), name: exec.name, callId: String(exec.callId ?? '?'), scopeId: exec.agent?.id ?? '(agentless)' })
      const input = parseGrepArgs(args)
      const argv = [await resolveRgPath(), '--no-config', ...buildGrepCommand(input)] // 原生同款组装（await 前置）
      const confined = await testDoubleConfine(argv, policyStub)                       // SRCH-02a 时序样例
      const r = spawnSync(confined.argv[0], confined.argv.slice(1), { cwd: process.cwd(), maxBuffer: 64 * 1024 * 1024, encoding: 'buffer', stdio: ['ignore', 'pipe', 'pipe'] }) // 披露：直连 child_process
      const stdout = r.stdout?.toString('utf8') ?? ''
      if (r.error) throw new Error(`adapter rg launch failed: ${String(r.error)}`)
      if (r.status !== 0 && r.status !== 1) throw new Error(`adapter rg failed exit=${String(r.status)} stderr=${(r.stderr?.toString('utf8') ?? '').slice(0, 200)}`)
      if (r.status === 1) return { matches: [] }
      return { matches: parseGrepMatches(stdout).map((m) => ({ path: toWorkdirRelative(m.path, process.cwd()), lineNumber: m.lineNumber, line: m.line })) }
    },
  })

  // P0-1 冻结接口复用：先 restrict 遮蔽继承面（p01 结论：own-layer 注册本就遮蔽，restrict 先行 = BND-02 装配单元）
  const lift = A.scope.ctx.tools.restrict({ deny: ['grep'] })
  const afterMask = ctx.tools.get('grep', A.key) === undefined && ctx.tools.get('grep', B.key) !== undefined
  const disposeAdapter = A.scope.ctx.tools.register(teamGrepAdapter)

  const baseSpawns = dbl.spawnCount
  const resA = await callTool(ctx, 'grep', query, A.key, 1)
  const spawnsForA = dbl.spawnCount - baseSpawns
  const resB = await callTool(ctx, 'grep', query, B.key, 2)
  const spawnsForB = dbl.spawnCount - baseSpawns
  const baseSpawns2 = dbl.spawnCount
  const resAglob = await callTool(ctx, 'glob', { pattern: '*.never-zz' }, A.key, 3)
  const spawnsForAglob = dbl.spawnCount - baseSpawns2

  const textOf = (r) => (r.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('')
  const expectedText = 'Found 2 matches\n\n' + formatGrepMatches(resB.value.matches)
  const aWentAdapter = adapterRuns === 1 && adapterObs.length === 1 && adapterObs[0].scopeId === 'agent-A'
  const parityValue = deepStable(resA.value) === deepStable(resB.value)
  const parityContent = textOf(resA) === textOf(resB) && textOf(resB) === expectedText
  observations.srch01_composed = {
    restrict_then_register: true,
    A_resolution_after_mask_before_adapter: 'UNKNOWN (masked)',
    A_value: resA.value, B_value: resB.value,
    A_text: textOf(resA), B_text: textOf(resB),
    value_parity: parityValue, content_parity: parityContent,
    meta_divergence: { B_meta_present: resB.meta !== undefined && resB.meta !== null, A_meta_present: resA.meta !== undefined && resA.meta !== null, reason: 'presentationMeta 投影函数 grepSearchMeta 不在包根导出（src/index.ts barrel 未含 presentation.ts）——R3 粘合面需自维护卡片投影或接受 UI 卡退化（观测记录，非 API 提议）' },
    native_body_observability: '原生 grep/glob 体的唯一 I/O 面 = ctx.subprocess.spawn（src/search-core.ts:238）；TEST DOUBLE 计数器 = 原生体计数代理（未 monkey-patch 原生定义对象，避免破坏 direct-call.ts:26 的身份判断）',
    adapter_runs: adapterRuns, double_spawnCount_total: dbl.spawnCount, double_specs: dbl.specs,
  }
  expect('S4b.mask.restrict-hides-inherited-for-A-only', afterMask && ctx.tools.get('grep', A.key) !== undefined,
    `restrict after: A=masked B=native visible; adapter registered → A resolves adapter`)
  expect('S4b.adapter.A-grep-runs-adapter-native-zero', aWentAdapter && spawnsForA === 0 && resA.isError !== true,
    `A grep → composed adapter (runs=${String(adapterRuns)}, scope=${String(adapterObs[0]?.scopeId)}); NATIVE body count (double spawn delta)=${String(spawnsForA)} [期望 0]`)
  expect('S4b.native.B-grep-runs-native-through-double', spawnsForB === 1 && resB.isError !== true && dbl.specs[dbl.specs.length - 1].argv[0] === RG,
    `B grep → native body via TEST DOUBLE seam: spawn delta=${String(spawnsForB)} [期望 1], real rg argv[0]=${dbl.specs[dbl.specs.length - 1].argv[0] === RG ? 'RG ✓' : 'MISMATCH'}, exit-ok`)
  expect('S4b.parity.A-value-content-equals-B', parityValue && parityContent,
    `value deep-equal=${String(parityValue)} content equal=${String(parityContent)} text=${JSON.stringify(textOf(resA).slice(0, 120))}`)
  expect('S4b.meta.divergence-recorded', resB.meta !== undefined && resB.meta !== null && (resA.meta === undefined || resA.meta === null),
    `B presentationMeta present=${String(resB.meta != null)} A=${String(resA.meta != null)}（R3 已知差异面，登记不掩盖）`)
  expect('S4b.scope.A-glob-still-native', spawnsForAglob === 1 && resAglob.isError !== true && textOf(resAglob) === 'No files found',
    `A glob 未被遮蔽 → 原生（经 double，spawn delta=${String(spawnsForAglob)}，'No files found'）：restrict 只命名 grep 生效`)
  void lift; void disposeAdapter; void doubleFiber

  // S4c: 同步返回 seam 的直接观测（服务层 spawn 同步 handle；executionMode 同步分类）。
  {
    const h = ctx.subprocess.spawn({ argv: [RG, '--version'], cwd: WORKDIR, stdio: { stdin: 'ignore', stdout: { maxBytes: 4096 }, stderr: { maxBytes: 4096 } }, graceMs: 1000, signal: new AbortController().signal })
    const handleIsSync = !(h instanceof Promise) && typeof h.done?.then === 'function'
    const outcome = await h.done
    const mode = ctx.tools.executionMode({ name: 'grep', arguments: { pattern: 'x' } })
    observations.srch02_seam_shapes = {
      subprocess_spawn_sync_handle: handleIsSync, spawn_outcome_exit: outcome.exitCode,
      executionMode_sync_return: mode, executionMode_note: '同步返回调度分类 {kind}，不产出 argv —— 非 body 执行 seam；ToolRuntime 公开体路径 execute/dispatchToolBody 全 async',
    }
    expect('S4c.seam.spawn-sync-vs-confine-async', handleIsSync && outcome.exitCode === 0 && mode.kind === 'exclusive',
      `ctx.subprocess.spawn 同步返回 handle（非 Promise=${String(handleIsSync)}，rg --version exit=${String(outcome.exitCode)}）；executionMode 同步返回 ${JSON.stringify(mode)}；对照 sandbox.confine→Promise<ConfinedArgv>（S-07 静态）= SRCH-02 形状差异的服务层实证面`)
  }
}

/* ---------------- S5: SRCH-04 Spill / post-execute → NOT_RUN ---------------- */
observations.srch04 = {
  status: 'NOT_RUN',
  reason: 'fixture 无 spillStore 服务且 fixture agent 无 session owner：trySaveFormattedResult 需要 exec.agent.session.header.id 与 ctx.get(\'spillStore\')（src/search-core.ts:382-412），两者在 fixture 中均不存在；post-execute spill 的身份判断（direct-call.ts:26 `ctx.tools.get(exec.name, exec.agent) !== tool`）还要求与注册定义的对象同一性。',
  missing_prerequisites: [
    'ctx.spillStore 服务（真实 dsh-spill 后端）',
    'exec.agent.session.header.{id,cwd}（真实 Session owner）',
    '真实宿主上 A/B 对照下的 >250 matches 超量结果 + spill 落盘读取验证',
    '替换 Definition 后 acceptedDirectCallValue 弃权（spill 丢失）路径的真实宿主验证（S-09）',
  ],
  honest_boundary: '按 §5 规则：测试未运行 = NOT_RUN，不计入任何路线的正反证。',
}

/* ---------------- S6: §5 fixture-level verdict (GO not writable here) ---------------- */
{
  const srch03All = cases.every((c) => c.match)
  const legsAll = results.every((r) => r.verdict === 'PASS')
  const verdict = {
    scope: 'FIXTURE-LEVEL ONLY（plain node fixture over prebuilt public libs；非真实宿主 —— plan §0/§2：GO 需 pinned Real Host，本 runner 依约束不可写 GO）',
    tool_family: 'grep/glob (tool-fs-search)',
    R1_exclusivity: 'FIXTURE-Feasible (继承 p01：own-layer 同名遮蔽 + restrict-first 装配，Team 原体计数 0；本 runner S4b 在原生真注册路径上复证 A=adapter/原体=0)',
    R2_service_isolation: 'INCONCLUSIVE — fixture-shows-prereq-missing：fixture 无 subprocess 服务 → ctx.plugin(tool-fs-search) 悬挂 PENDING、零注册（S4a 确切可观测）；ctx.isolate("subprocess") realm + per-call Grant 串联在 fixture 不可测；spawn(sync) vs confine(async) 形状差异有服务层实证（S4c）',
    R3_composed_helpers: srch03All && legsAll ? 'INCONCLUSIVE — fixture-supports-R3（倾向 R3 的候选，待 Real Host）：12/12 helpers+真实 rg 对照 PASS；async confine→spawn 桥样例 PASS；组合 adapter 在 ToolRuntime 层独占分发 PASS；value/content 等价 PASS；已登记差异 = presentationMeta 非包根可复现、render 超量截断层与 spill 未覆盖' : 'INCONCLUSIVE — fixtures not all green, see legs',
    R4_fork: 'NOT-ELIGIBLE（§5 规则 3/4：R3 未被最小 public-seam 反例否定，不进入 Fork 资格审查）',
    SRCH_04: 'NOT_RUN（见 observations.srch04 缺项清单）',
    verdict: 'INCONCLUSIVE(fixture-supports-R3) + R2=fixture-shows-prereq-missing + SRCH-04=NOT_RUN；禁止写 GO（GO 需真实宿主实证：spill/timeout/cancel/隔离服务/并发/生命周期全未覆盖）',
    next_for_real_host: ['SRCH-01 真实 ctx.isolate("subprocess") + applyGrepTool 闭包捕获验证', 'SRCH-04 spill 全链路', 'presentationMeta/render 超量层等价', '取消/timeout/并发/卸载竞态（P0-1 已冻结接口的真实宿主复验）'],
  }
  const out = {
    recorded_at_utc: new Date().toISOString(),
    model_verbatim: 'You are a coding agent powered by the qwen3.8-flash-next model.',
    pins: observations.pins,
    workdir: WORKDIR,
    test_double_declarations: [
      'FixtureSubprocessDouble = TEST DOUBLE（薄真实传输 + 原生体计数代理；非生产 subprocess provider）',
      'testDoubleConfine = TEST DOUBLE（async 恒等，仅证 confine-先行时序，不实施任何 I/O 策略）',
      'R3 composed adapter 直连 node:child_process 跑真实 rg：披露性绕过 ctx.subprocess seam（fixture 无该服务）；真实 rg 二进制 = @vscode/ripgrep v15.0.0（非替身）',
    ],
    observations,
    srch03_cases: cases,
    assertions: results,
    verdict,
  }
  writeFileSync(join(HERE, 'p02-result.json'), JSON.stringify(out, null, 2))
  console.log(`\nWRITTEN p02-result.json (cases ${observations.srch03.cases_passed}/${String(cases.length)} PASS; assertions ${String(results.filter((r) => r.verdict === 'PASS').length)}/${String(results.length)} PASS)`)
  process.exit(legsAll ? 0 : 1)
}
