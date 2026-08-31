#!/usr/bin/env node
/**
 * G8-REVIEW reviewer-3 (G8-R3) — post-run dependency scan.
 *
 * Re-confirms, AFTER the full e2e run, that the run introduced no boundary
 * changes:
 *   A.  zero-core  : no `node:` builtin imports in .ts files under
 *                    packages/ (the frozen rule; .mjs/.cjs excluded)
 *   A2. record     : node: imports in .mjs/.cjs under packages/ (excluded by
 *                    the rule — listed for the record only)
 *   B.  bare specifiers in packages/ (any source extension, excluding
 *                    node_modules/dist): every non-relative, non-node:
 *                    specifier is listed; comment/doc lines are labeled as
 *                    such (the scanner is line-based; JSDoc prose can
 *                    mention specifiers)
 *   C.  no patch-package / pnpm patch / postinstall traces in any
 *                    package.json
 *   D.  lockfile unchanged vs the P7 integration tip (959e36358)
 *   E.  tracked-file invariance: worktree `git status --porcelain` contains
 *                    only the untracked evidence dir; `git diff --quiet`
 *
 * Output: ../dependency-scan.log (exit 0 iff A and C are clean and D empty).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnToLog } from '../../../../../../tests/characterization/lib/util.mjs'
import { extractSpecifiers } from '../../../../../../tests/characterization/lib/private-import.mjs'
import { walk } from '../../../../../../tests/characterization/lib/util.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const EVIDENCE_ROOT = dirname(HERE)
const WT = resolve(HERE, '..', '..', '..', '..', '..', '..')
const LOG = join(EVIDENCE_ROOT, 'dependency-scan.log')
const P7_TIP = '959e36358ee7244ff8c7e1e0b8396e70dfef4562'
const SKIP_NAMES = new Set(['node_modules', 'dist', 'coverage', '.git'])

const out = []
const emit = (line = '') => {
  out.push(line)
  console.log(line)
}

function isCommentLine(line) {
  const t = line.trim()
  return t.startsWith('*') || t.startsWith('//') || t.startsWith('/*') || t.startsWith('#')
}

// The committed extractSpecifiers is line-based and cannot see string
// literals: scanner positive-control samples (e.g.
// p7t5-no-creation-scan.test.ts: `"import ... from 'node:fs'"`) match the
// same patterns as real imports. Classify the context of each node: hit so
// only actual import statements count as zero-core violations.
function classifySpecifierLine(lineText) {
  const t = lineText.trim()
  if (isCommentLine(t)) return 'doc'
  if (/^(['"`])/.test(t)) return 'string-literal-sample'
  if (/^\s*(import|export)\b/.test(t)) return 'import'
  if (/\bfrom\s+['"]node:/.test(t)) return 'import' // from-clause of a multi-line import
  if (/\b(import\s*\(|require\s*\()\s*['"]node:/.test(t)) return 'import' // dynamic import/require
  return 'inline'
}

async function main() {
  emit('== G8R3 dependency scan (post-run) ==')
  emit(new Date().toISOString())
  emit(`worktree=${WT}`)
  emit('')

  // ── collect source files under packages/ ─────────────────────────────────
  const tsFiles = []
  const mjsFiles = []
  const pkgJsons = []
  for (const item of walk(WT, SKIP_NAMES)) {
    if (item.isDir) continue
    const p = item.path
    if (!p.startsWith(join(WT, 'packages') + sep)) continue
    const name = p.split(sep).pop()
    if (item.isDir) continue
    if (p.endsWith('.ts')) tsFiles.push(p)
    else if (p.endsWith('.mjs') || p.endsWith('.cjs')) mjsFiles.push(p)
    else if (name === 'package.json') pkgJsons.push(p)
  }
  emit(`scanned: ${tsFiles.length} .ts, ${mjsFiles.length} .mjs/.cjs, ${pkgJsons.length} package.json under packages/`)
  emit('')

  // ── A. zero-core: node: imports in .ts ────────────────────────────────────
  emit('== A. zero-core: node: builtin imports in packages/**/*.ts (rule) ==')
  let aViolations = 0
  let aSamples = 0
  for (const f of tsFiles) {
    const source = readFileSync(f, 'utf8')
    const lines = source.split('\n')
    for (const { line, spec } of extractSpecifiers(source)) {
      if (!spec.startsWith('node:')) continue
      const kind = classifySpecifierLine(lines[line - 1] || '')
      if (kind === 'import' || kind === 'inline') {
        aViolations += 1
        emit(`VIOLATION ${relative(WT, f)}:${line} [${kind}] ${spec}`)
      } else {
        aSamples += 1
        emit(`SAMPLE ${relative(WT, f)}:${line} [${kind}] ${spec} (not an import statement)`)
      }
    }
  }
  if (aViolations === 0) {
    emit(`PASS — no node: imports in any packages/**/*.ts (${aSamples} doc/string-literal mention(s) recorded, not imports)`)
  } else {
    emit(`FAIL — ${aViolations} node: import statement(s) in packages/**/*.ts`)
  }
  emit('')

  // ── A2. node: imports in .mjs/.cjs (excluded by the rule) ─────────────────
  emit('== A2. zero-core: node: imports in packages/**/*.mjs/.cjs (excluded, record) ==')
  let a2 = 0
  for (const f of mjsFiles) {
    const source = readFileSync(f, 'utf8')
    const lines = source.split('\n')
    for (const { line, spec } of extractSpecifiers(source)) {
      if (!spec.startsWith('node:')) continue
      const kind = classifySpecifierLine(lines[line - 1] || '')
      a2 += 1
      emit(`EXCLUDED ${relative(WT, f)}:${line} [${kind}] ${spec}`)
    }
  }
  emit(`${a2} node: specifier line(s) in .mjs/.cjs (harness plumbing; rule-exempt)`)
  emit('')

  // ── B. bare specifiers anywhere in packages/ source ───────────────────────
  emit('== B. bare (non-relative, non-node:) specifiers in packages/** source ==')
  const PACKAGES_ROOT = join(WT, 'packages')
  let bFindings = 0
  let bCode = 0
  let bUpstream = 0
  let bThirdParty = 0
  for (const f of [...tsFiles, ...mjsFiles]) {
    const source = readFileSync(f, 'utf8')
    for (const { line, spec } of extractSpecifiers(source)) {
      if (spec.startsWith('node:') || spec.startsWith('cordis:') || spec.startsWith('#')) continue
      if (spec.startsWith('.') || spec.startsWith('/')) {
        // relative or absolute — must stay inside packages/
        const base = resolve(dirname(f), spec)
        const rel = relative(PACKAGES_ROOT, base)
        if (rel === '' || (!rel.startsWith('..') && !rel.startsWith('node_modules'))) continue
        bFindings += 1
        emit(`ESCAPE ${relative(WT, f)}:${line}  ${spec} -> ${rel}`)
        continue
      }
      // bare specifier
      const lineText = source.split('\n')[line - 1] ?? ''
      const inComment = isCommentLine(lineText)
      bFindings += 1
      if (spec.startsWith('@deepseek-ai/')) {
        bUpstream += 1
        emit(`${inComment ? 'DOC    ' : 'VIOLATION'} ${relative(WT, f)}:${line}  ${spec}${inComment ? '' : '  (upstream specifier in code)'}`)
      } else {
        bThirdParty += 1
        emit(`${inComment ? 'DOC    ' : 'VIOLATION'} ${relative(WT, f)}:${line}  ${spec}${inComment ? '' : '  (third-party specifier in code)'}`)
      }
    }
  }
  if (bFindings === 0) emit('PASS — no bare specifiers at all in packages/ source')
  emit(`summary: total=${bFindings} upstream=${bUpstream} thirdParty=${bThirdParty}`)
  emit('')

  // ── C. patch traces in package.json ───────────────────────────────────────
  emit('== C. patch-package / pnpm patch / postinstall in package.json files ==')
  const cRe = /patch-package|patchedDependencies|"postinstall"\s*:|"preinstall"\s*:|"install"\s*:/
  let cFindings = 0
  for (const f of pkgJsons) {
    const text = readFileSync(f, 'utf8')
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i += 1) {
      if (cRe.test(lines[i])) {
        cFindings += 1
        emit(`FINDING ${relative(WT, f)}:${i + 1}  ${lines[i].trim()}`)
      }
    }
  }
  const rootPkg = join(WT, 'package.json')
  if (existsSync(rootPkg)) {
    const lines = readFileSync(rootPkg, 'utf8').split('\n')
    for (let i = 0; i < lines.length; i += 1) {
      if (cRe.test(lines[i])) {
        cFindings += 1
        emit(`FINDING package.json(root):${i + 1}  ${lines[i].trim()}`)
      }
    }
  }
  if (cFindings === 0) emit('PASS — no patch/postinstall traces')
  emit('')

  // ── D. lockfile diff vs P7 tip ────────────────────────────────────────────
  emit(`== D. pnpm-lock.yaml diff vs P7 tip ${P7_TIP} ==`)
  const lockDiff = await spawnToLog('git', ['diff', '--quiet', P7_TIP, 'HEAD', '--', 'pnpm-lock.yaml'], {
    cwd: WT,
    logPath: join(EVIDENCE_ROOT, 'harness-output', 'logs', 'lock-diff.log'),
    timeoutMs: 60_000,
  })
  // git diff --quiet exits 0 when identical, 1 when different
  const lockSame = lockDiff.ok || lockDiff.exitCode === 0
  emit(`git diff --quiet exit=${lockDiff.exitCode} -> lockfile ${lockSame ? 'UNCHANGED' : 'CHANGED'}`)
  if (!lockSame) {
    const lockFull = await spawnToLog('git', ['diff', '--stat', P7_TIP, 'HEAD', '--', 'pnpm-lock.yaml'], {
      cwd: WT,
      logPath: join(EVIDENCE_ROOT, 'harness-output', 'logs', 'lock-diff-stat.log'),
      timeoutMs: 60_000,
    })
    emit((lockFull.text ?? '').trim() || '(no stat output)')
  }
  emit('')

  // ── E. tracked-file invariance (worktree) ─────────────────────────────────
  emit('== E. worktree tracked-file invariance ==')
  const status = await spawnToLog('git', ['status', '--porcelain'], {
    cwd: WT,
    logPath: join(EVIDENCE_ROOT, 'harness-output', 'logs', 'wt-status-post.log'),
    timeoutMs: 60_000,
  })
  const statusLines = (status.text ?? '').split('\n').map((l) => l.trim()).filter(Boolean)
  for (const l of statusLines) emit(`status: ${l}`)
  const trackedMod = statusLines.filter((l) => !l.startsWith('??'))
  if (trackedMod.length === 0) emit('PASS — no tracked file modified (untracked evidence only)')
  else emit(`VIOLATION — ${trackedMod.length} tracked path(s) touched`)
  emit('')

  // ── verdict ───────────────────────────────────────────────────────────────
  const pass = aViolations === 0 && cFindings === 0 && lockSame && trackedMod.length === 0
  emit(`RESULT: ${pass ? 'PASS' : 'FAIL'} dependency-scan (A=${aViolations} C=${cFindings} D=${lockSame ? 'same' : 'CHANGED'} E=${trackedMod.length})`)

  writeFileSync(LOG, out.join('\n') + '\n')
  process.exit(pass ? 0 : 1)
}

main().catch((error) => {
  emit(`FATAL: ${error?.stack ?? error}`)
  writeFileSync(LOG, out.join('\n') + '\n')
  process.exit(1)
})
