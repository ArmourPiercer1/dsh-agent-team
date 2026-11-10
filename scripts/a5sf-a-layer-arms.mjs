#!/usr/bin/env node
/**
 * a5sf-a-layer-arms.mjs — render the Alpha.5 A-layer arm index.
 *
 * Docs generator only: no product code, no host, no boot, no port, no DSH_HOME.
 * It reads the tracked `packages/**\/test/a5sf-*.test.ts` suites and prints the
 * markdown table embedded in `TOOL-ACCEPTANCE-MATRIX.md` §1.1.2.
 *
 * WHY THIS EXISTS. TOOL-ACCEPTANCE-MATRIX §1.1.1 gap 1 says the A layer
 * (capability face × permission axis shared safety) existed as test arms but
 * not as a document. This renders that document from the suites that are
 * actually present, so a row can never describe a suite nobody shipped:
 *
 *   * the suite list is DISCOVERED (glob), never typed;
 *   * every discovered suite must be attributed to a face in FACE below — an
 *     unattributed suite is a hard failure, not a silent "cross-face" row;
 *   * the counts are TITLE-TOKEN counts, stated as such in the table header.
 *     They index where allow / deny / refuse-before-side-effect arms live;
 *     they are not a verdict, a grade or a `V@B`.
 *
 * The scan universe is deliberately only `packages/**\/test/a5sf-*.test.ts`
 * (the suites the root vitest census collects; `vitest.config.ts` include).
 * The `tests/world-factory/*.mjs` A-layer arms are outside this universe and
 * are cited by the matrix's per-row evidence columns, not by this table.
 *
 * Usage: node scripts/a5sf-a-layer-arms.mjs
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

/**
 * Face attribution, same vocabulary as `ALPHA5-SANDBOX-BACKLOG.md` §0.1.1 and
 * `TOOL-ACCEPTANCE-MATRIX.md` §1.1.1. Keep this closed: a new a5sf suite must
 * be attributed here in the same commit that adds it.
 */
const FACE = new Map([
  ['a5sf-member-policy.test.ts', 'FS Provider'],
  ['a5sf-path-rules.test.ts', 'FS Provider'],
  ['a5sf-pd17-fs-policy.test.ts', 'FS Provider'],
  ['a5sf-bl16-grep-realm.test.ts', 'Subprocess'],
  ['a5sf-confined-subprocess.test.ts', 'Subprocess'],
  ['a5sf-subprocess-contract.test.ts', 'Subprocess'],
  ['a5sf-subprocess-unconfined-realm.test.ts', 'Subprocess'],
  ['a5sf-os-runner.test.ts', 'Subprocess'],
  ['a5sf-terminal-lifecycle.test.ts', 'Shell-PTY'],
  ['a5sf-provider-composition.test.ts', 'Cross-face'],
  ['a5sf-service-install.test.ts', 'Cross-face'],
  ['a5sf-invocation.test.ts', 'Cross-face'],
  ['a5sf-trust-registry.test.ts', 'Cross-face'],
  ['a5sf-approval-takeover.test.ts', 'Cross-face'],
  ['a5sf-pd20-admission-close.test.ts', 'Cross-face'],
  ['a5sf-pd20-closed-arguments.test.ts', 'Cross-face'],
  ['a5sf-v4-member-ceiling-projection.test.ts', 'Cross-face'],
])

/** Title-token lexicons. Deliberately narrow: an index, not a semantics claim. */
const ALLOW = /\b(allow|allows|allowed|admit|admits|admitted|keep|keeps|success|succeeds|works|passes)\b/i
const DENY = /\b(deny|denied|denies|refuse|refuses|refused|refusal|reject|rejects|rejected)\b/i
const BEFORE = /\bBEFORE\b|\bzero spawn|\b0 spawn|\bzero process|\b0 process|\bpre-side-effect/i

/** `it('…')` / `test('…')` / `it.each(…)('…')` titles at any nesting depth. */
const TITLE = /^\s*(?:it|test)(?:\.(?:skip|only|each))?\(\s*'((?:[^'\\]|\\.)*)'/gm

function discoverSuites() {
  const out = []
  for (const pkg of readdirSync(join(REPO_ROOT, 'packages'), { withFileTypes: true })) {
    if (!pkg.isDirectory()) continue
    let entries
    try {
      entries = readdirSync(join(REPO_ROOT, 'packages', pkg.name, 'test'), { withFileTypes: true })
    } catch {
      continue // package without a test root
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue
      if (!/^a5sf-.*\.test\.ts$/.test(entry.name)) continue
      out.push(`packages/${pkg.name}/test/${entry.name}`)
    }
  }
  return out.sort()
}

const rows = []
const byFace = new Map()
for (const rel of discoverSuites()) {
  const base = rel.slice(rel.lastIndexOf('/') + 1)
  const face = FACE.get(base)
  if (face === undefined) {
    console.error(`a5sf-a-layer-arms: ${rel} has no FACE attribution — add it to FACE before rendering`)
    process.exit(1)
  }
  const source = readFileSync(join(REPO_ROOT, rel), 'utf8')
  const titles = [...source.matchAll(TITLE)].map((m) => m[1])
  const arm = {
    rel,
    face,
    total: titles.length,
    allow: titles.filter((t) => ALLOW.test(t)).length,
    deny: titles.filter((t) => DENY.test(t)).length,
    before: titles.filter((t) => BEFORE.test(t)).length,
  }
  rows.push(arm)
  const agg = byFace.get(face) ?? { suites: 0, total: 0, allow: 0, deny: 0, before: 0 }
  agg.suites += 1
  agg.total += arm.total
  agg.allow += arm.allow
  agg.deny += arm.deny
  agg.before += arm.before
  byFace.set(face, agg)
}

const lines = []
lines.push('| 套件 | Face | 臂 | 标题含 allow/admit/keep | 标题含 deny/refuse/reject | 标题含 BEFORE / 0 spawn |')
lines.push('|---|---|---|---|---|---|')
for (const r of rows) {
  lines.push(`| \`${r.rel}\` | ${r.face} | ${r.total} | ${r.allow} | ${r.deny} | ${r.before} |`)
}
lines.push('')
lines.push('| Face | 套件 | 臂 | allow 词元 | deny/refuse 词元 | before-side-effect 词元 |')
lines.push('|---|---|---|---|---|---|')
for (const [face, agg] of byFace) {
  lines.push(`| ${face} | ${agg.suites} | ${agg.total} | ${agg.allow} | ${agg.deny} | ${agg.before} |`)
}
process.stdout.write(lines.join('\n') + '\n')
