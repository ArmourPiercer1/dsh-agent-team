/**
 * scan.mjs — G8 reviewer-2 criterion-1 dependency scan (brief §4.5/§5.1).
 *
 * Proves, at the source level, that the Remote contract v1
 * (`packages/remote`) carries NO SessionController Team mirror and no
 * upstream / session-log / legacy source dependency:
 *
 *   Part A — `packages/remote/src` scanned with the REPO'S OWN committed
 *            scanner (`test/p8t3-negative-scan.mjs`, rules R1-R6, incl. the
 *            P4-T6 frozen denylist for legacy Team SessionEvent vocabulary).
 *            Zero violations required.
 *   Part B — `packages/remote/test`: the same rules applied per file; a hit
 *            counts as a violation only in CODE context. Doc-comment lines,
 *            string-literal occurrences (e.g. the P8-T3 positive-control
 *            test description), and bare `vitest` / `vitest/*` test-infra
 *            imports are classified and listed, never counted.
 *   Part C — full import-specifier audit over every `.ts` in
 *            `packages/remote` (static + dynamic + require): no `node:`
 *            builtins, no upstream/private specifier, no external bare
 *            dependency; relative specifiers resolved and checked to stay
 *            inside the worktree (sibling vNext package imports are
 *            enumerated and allowed; escapes outside the worktree or into
 *            `references/` are violations).
 *   Part D — the handler dependency surface: `RemoteHandlerDeps` in
 *            `src/handlers/ports.ts` must declare exactly the 12 frozen
 *            ports (by-construction proof that no mirror port can hide in
 *            the dispatcher wiring).
 *   Part E — `test/p8t4-test-client.ts` side-channel proof: the browser-
 *            side sync client's data needs are met SOLELY by its transport
 *            (every import resolves inside `packages/remote`; no
 *            storage/runtime/domain sibling import, no node: builtins,
 *            not even vitest).
 *
 * Output: `../dependency-scan.log` (proof header: git toplevel + HEAD of
 * the reviewed worktree). Exit 0 = PASS, 1 = FAIL.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HARNESSED_DIR = fileURLToPath(new URL('.', import.meta.url))
const EVIDENCE_DIR = join(HARNESSED_DIR, '..')
const WORKTREE_ROOT = join(HARNESSED_DIR, '..', '..', '..', '..', '..', '..')
const MAIN_ROOT = join(WORKTREE_ROOT, '..', '..')
const LOG_DIR = join(EVIDENCE_DIR, 'harness-output', 'logs')
const OUT = join(EVIDENCE_DIR, 'dependency-scan.log')

const EXPECTED_HEAD = '93d2a96e3ded6a92820f78ee9de94eac9ea6fffb'
const EXPECTED_PORTS = [
  'admission', 'catalog', 'compatibility', 'handoff', 'intent', 'ledger',
  'lifecycle', 'legacy', 'override', 'policyState', 'projection', 'teamCreate',
]

const lines = []
function log(msg) {
  lines.push(msg)
  console.log(msg)
}

/** FILE-FD stdio git one-liner (piped stdio is forbidden in this sandbox). */
async function git(cwd, args, logPath) {
  const { spawnToLog } = await import(pathToFileURL(join(MAIN_ROOT, 'tests/characterization/lib/util.mjs')).href)
  const result = await spawnToLog('git', args, { cwd, logPath, timeoutMs: 30_000 })
  if (!result.ok) {
    throw new Error(`git ${args.join(' ')} failed (exit=${result.exitCode})`)
  }
  return result.text.trim()
}

function collectTs(dir, out) {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue
      collectTs(full, out)
      continue
    }
    if (entry.name.endsWith('.ts')) out.push(full)
  }
  return out
}

/**
 * Classify one violation hit: 'doc-comment' (trimmed line starts with a
 * comment marker), 'string-literal' (an odd number of one quote kind
 * precedes the hit column), else 'code'.
 */
function classifyHit(lineText, column) {
  const trimmed = lineText.trim()
  if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('/**')) {
    return 'doc-comment'
  }
  const before = lineText.slice(0, Math.max(0, column - 1))
  for (const quote of ['"', "'", '`']) {
    let count = 0
    for (const ch of before) {
      if (ch === '\\') continue // skip escaped-quote complexity; parity is still indicative
      if (ch === quote) count += 1
    }
    if (count % 2 === 1) return 'string-literal'
  }
  return 'code'
}

/**
 * True when the hit column sits on an import specifier inside an import /
 * require / dynamic-import statement. The specifier position is inside
 * quotes by construction, so the quote-parity heuristic cannot classify it;
 * the statement context decides instead.
 */
function insideImportStatement(lineText, column) {
  // The scanner reports the column at the specifier text, i.e. just inside
  // the opening quote — strip that quote before testing the prefix.
  let before = lineText.slice(0, Math.max(0, column - 1)).trimEnd()
  before = before.replace(/['"`]\s*$/, '').trimEnd()
  return /(^|\s)import\s*$/.test(before)
    || /(^|\s)from\s*$/.test(before)
    || /\bimport\(\s*$/.test(before)
    || /\brequire\(\s*$/.test(before)
}

/** Extract the quoted specifier from a scanner detail string, if present. */
function specifierFromDetail(detail) {
  const m = /'([^']*)'/.exec(detail)
  return m ? m[1] : null
}

async function main() {
  mkdirSync(LOG_DIR, { recursive: true })
  log('=== G8 reviewer-2 criterion-1 dependency scan — start ===')

  // Proof header.
  const toplevel = await git(WORKTREE_ROOT, ['rev-parse', '--show-toplevel'], join(LOG_DIR, 'scan-git-toplevel.log'))
  const head = await git(WORKTREE_ROOT, ['rev-parse', 'HEAD'], join(LOG_DIR, 'scan-git-head.log'))
  log(`git rev-parse --show-toplevel: ${toplevel}`)
  log(`git rev-parse HEAD: ${head}`)
  if (head !== EXPECTED_HEAD) {
    throw new Error(`worktree HEAD ${head} !== reviewed integration HEAD ${EXPECTED_HEAD}`)
  }

  const scanner = await import(pathToFileURL(join(WORKTREE_ROOT, 'packages/remote/test/p8t3-negative-scan.mjs')).href)
  const { scanP8T3OwnedFiles, matchP8T3RulesInText } = scanner

  let failures = 0
  const fail = (msg) => {
    failures += 1
    log(`FAIL ${msg}`)
  }
  const pass = (msg) => log(`PASS ${msg}`)

  // ── Part A — src via the repo's own committed scanner ────────────────────
  log('')
  log('── Part A: packages/remote/src — repo scanner (R1-R6 incl. P4-T6 denylist) ──')
  const srcScan = scanP8T3OwnedFiles()
  log(`scanned src files: ${srcScan.files.length}`)
  for (const f of srcScan.files) log(`  - ${f}`)
  if (srcScan.totalViolations === 0) {
    pass(`src: R1-R6 zero violations over ${srcScan.files.length} files`)
  } else {
    fail(`src: ${srcScan.totalViolations} R1-R6 violations`)
    for (const v of srcScan.violations) log(`  violation ${v.rule} ${v.file}:${v.line}:${v.column} — ${v.detail}`)
  }
  const srcSpecs = srcScan.fileResults.flatMap((fr) => fr.importSpecifiers.map((s) => s.specifier))
  log(`src import specifiers: ${srcSpecs.length} (all relative per R6; distinct: ${[...new Set(srcSpecs)].length})`)

  // ── Part B — test directory, same rules, code-context only ──────────────
  log('')
  log('── Part B: packages/remote/test — R1-R6 with code-context classification ──')
  const testDir = join(WORKTREE_ROOT, 'packages', 'remote', 'test')
  const testFiles = collectTs(testDir, []).sort()
  let testCodeViolations = 0
  let testNonCode = 0
  let testAllowedImport = 0
  for (const full of testFiles) {
    const rel = relative(WORKTREE_ROOT, full).split(sep).join('/')
    const text = readFileSync(full, 'utf8')
    const result = matchP8T3RulesInText(text, rel)
    if (result.violations.length === 0) continue
    const fileLines = text.split(/\r?\n/)
    for (const v of result.violations) {
      const lineText = fileLines[v.line - 1] ?? ''
      let ctx = classifyHit(lineText, v.column)
      let allowed = false
      if ((v.rule === 'R1' || v.rule === 'R2' || v.rule === 'R6') && insideImportStatement(lineText, v.column)) {
        // The hit sits on an import specifier: an import statement is code
        // context by definition, regardless of quote parity.
        ctx = 'code'
        if (v.rule === 'R6') {
          const spec = specifierFromDetail(v.detail)
          if (spec === 'vitest' || spec?.startsWith('vitest/')) {
            allowed = true // bare test-infra import: allowed in test files
          }
        }
      }
      if (ctx === 'code' && !allowed) {
        testCodeViolations += 1
        log(`  CODE violation ${v.rule} ${rel}:${v.line} — ${v.detail}`)
      } else if (ctx === 'code') {
        testAllowedImport += 1
        log(`  code (allowed test-infra import) ${v.rule} ${rel}:${v.line} — ${v.detail}`)
      } else {
        testNonCode += 1
        log(`  non-code (${ctx}) ${v.rule} ${rel}:${v.line} — ${v.detail}`)
      }
    }
  }
  log(`test files scanned: ${testFiles.length}`)
  if (testCodeViolations === 0) {
    pass(`test: zero code-context R1-R6 violations (${testNonCode} doc-comment/string-literal + ${testAllowedImport} allowed vitest test-infra import(s) listed above)`)
  } else {
    fail(`test: ${testCodeViolations} code-context R1-R6 violations`)
  }

  // ── Part C — full import-specifier audit (src + test, .ts) ───────────────
  log('')
  log('── Part C: import specifier audit over packages/remote/**/*.ts ──')
  const allFiles = collectTs(join(WORKTREE_ROOT, 'packages', 'remote'), []).sort()
  const UPSTREAM_RE = /deepseek-harness|^references\/|^@deepseek-ai\//
  const classifications = {}
  let importViolations = 0
  const siblingImports = []
  for (const full of allFiles) {
    const rel = relative(WORKTREE_ROOT, full).split(sep).join('/')
    const text = readFileSync(full, 'utf8')
    const { importSpecifiers } = matchP8T3RulesInText(text, rel)
    for (const s of importSpecifiers) {
      let cls
      let resolvedRel = null
      if (s.specifier.startsWith('node:')) {
        cls = 'VIOLATION(node-builtin)'
      } else if (UPSTREAM_RE.test(s.specifier)) {
        cls = 'VIOLATION(upstream-private)'
      } else if (s.specifier.startsWith('./') || s.specifier.startsWith('../')) {
        const base = resolve(dirname(full), s.specifier)
        const tsCandidate = base.endsWith('.js') ? base.slice(0, -3) + '.ts' : base
        const target = resolve(WORKTREE_ROOT, relative(WORKTREE_ROOT, base))
        if (!target.startsWith(resolve(WORKTREE_ROOT) + sep) && target !== resolve(WORKTREE_ROOT)) {
          cls = 'VIOLATION(relative-escape-worktree)'
        } else if (target.includes(join('references')) || target.includes('deepseek-harness')) {
          cls = 'VIOLATION(escape-to-references)'
        } else if (target.startsWith(join(WORKTREE_ROOT, 'packages', 'remote'))) {
          cls = 'internal(remote)'
        } else {
          cls = 'sibling-vnext-package'
          const pkgRel = relative(join(WORKTREE_ROOT, 'packages'), target).split(sep).join('/')
          siblingImports.push(`${rel} → ${pkgRel}`)
        }
        resolvedRel = relative(WORKTREE_ROOT, tsCandidate).split(sep).join('/')
      } else if (s.specifier === 'vitest' || s.specifier.startsWith('vitest/')) {
        cls = 'test-infra(vitest)'
      } else if (s.specifier.startsWith('@dsh-agent-team/')) {
        cls = 'self-package'
      } else {
        cls = 'VIOLATION(external-bare)'
      }
      if (!classifications[cls]) classifications[cls] = 0
      classifications[cls] += 1
      if (cls.startsWith('VIOLATION')) {
        importViolations += 1
        log(`  ${cls} ${rel}:${s.line} — '${s.specifier}'`)
      }
    }
  }
  log(`files audited: ${allFiles.length}`)
  for (const [cls, n] of Object.entries(classifications).sort()) log(`  ${cls}: ${n}`)
  if (siblingImports.length > 0) {
    log('  sibling vNext package imports (internal; enumerated):')
    for (const s of [...new Set(siblingImports)]) log(`    ${s}`)
  }
  if (importViolations === 0) {
    pass('import audit: zero node:/upstream/external/escape specifiers')
  } else {
    fail(`import audit: ${importViolations} violating specifiers`)
  }

  // ── Part D — the 12-port dependency surface ──────────────────────────────
  log('')
  log('── Part D: RemoteHandlerDeps surface (src/handlers/ports.ts) ──')
  const portsText = readFileSync(join(WORKTREE_ROOT, 'packages/remote/src/handlers/ports.ts'), 'utf8')
  const ifaceMatch = portsText.match(/export interface RemoteHandlerDeps \{([\s\S]*?)\n\}/)
  if (ifaceMatch === null) {
    fail('RemoteHandlerDeps interface not found in ports.ts')
  } else {
    const portNames = [...ifaceMatch[1].matchAll(/^\s*readonly (\w+):/gm)].map((m) => m[1])
    log(`declared ports (${portNames.length}): ${portNames.join(', ')}`)
    const expected = new Set(EXPECTED_PORTS)
    const actual = new Set(portNames)
    const missing = [...expected].filter((p) => !actual.has(p))
    const extra = [...actual].filter((p) => !expected.has(p))
    if (portNames.length === 12 && missing.length === 0 && extra.length === 0) {
      pass('RemoteHandlerDeps is exactly the 12 frozen ports (no mirror port in the dispatcher wiring)')
    } else {
      fail(`RemoteHandlerDeps deviation: missing=[${missing}] extra=[${extra}] count=${portNames.length}`)
    }
  }

  // ── Part E — p8t4 test client: transport-only data path ──────────────────
  log('')
  log('── Part E: p8t4-test-client.ts side-channel proof ──')
  const tcPath = join(WORKTREE_ROOT, 'packages/remote/test/p8t4-test-client.ts')
  const tcText = readFileSync(tcPath, 'utf8')
  const tc = matchP8T3RulesInText(tcText, 'packages/remote/test/p8t4-test-client.ts')
  log(`imports (${tc.importSpecifiers.length}):`)
  let tcSideChannel = 0
  for (const s of tc.importSpecifiers) {
    let cls
    if (s.specifier.startsWith('node:')) cls = 'node-builtin'
    else if (s.specifier === 'vitest' || s.specifier.startsWith('vitest/')) cls = 'vitest'
    else if (s.specifier.startsWith('./') || s.specifier.startsWith('../')) {
      const target = resolve(dirname(tcPath), s.specifier)
      cls = target.startsWith(join(WORKTREE_ROOT, 'packages', 'remote')) ? 'internal(remote)' : 'ESCAPES-remote'
    } else {
      cls = 'external'
    }
    log(`  '${s.specifier}' → ${cls}`)
    if (cls !== 'internal(remote)') tcSideChannel += 1
  }
  if (tcSideChannel === 0 && tc.violations.length === 0) {
    pass('p8t4 test client: every import stays inside packages/remote (no storage/runtime/domain side channel, no node: builtins, no vitest)')
  } else {
    fail(`p8t4 test client: ${tcSideChannel} non-remote imports or ${tc.violations.length} rule violations`)
  }

  // ── verdict ───────────────────────────────────────────────────────────────
  log('')
  if (failures === 0) {
    log('SCAN: PASS (src R1-R6=0, test code-context=0, import audit=0, ports=12, test-client side-channel=0)')
  } else {
    log(`SCAN: FAIL (${failures} failing part(s))`)
  }
  log('=== G8 reviewer-2 criterion-1 dependency scan — done ===')

  writeFileSync(OUT, lines.join('\n') + '\n')
  process.exitCode = failures === 0 ? 0 : 1
}

main().catch((error) => {
  console.error(`scan fatal: ${error.stack ?? error}`)
  process.exitCode = 1
})
