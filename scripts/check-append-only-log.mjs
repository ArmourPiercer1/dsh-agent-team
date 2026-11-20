#!/usr/bin/env node
/**
 * check-append-only-log.mjs — the append-only guard for
 * `dev/agent-workflow/SESSION_ROUTER_LOG.md`.
 *
 * WHY THIS EXISTS, MEASURED. On 2026-11-20 two squash merges replaced the log
 * with only their own entries: #800 turned 9276 lines into 26, and #801 (built
 * on the truncated file) turned it into 48. Both were caught by a human reading
 * a diffstat, not by a gate: `state-freshness` grades the NEWEST heading and
 * pointer agreement, so a file that keeps its newest heading and loses 9250
 * older ones still passed. The repository rule is "只追加执行日志" (append-only);
 * a rule with no checker is a hope.
 *
 * WHAT IT GRADES. The base revision's bytes must be an exact PREFIX of the head
 * revision's bytes. That is the strongest and simplest statement of append-only:
 * every historical line survives, in order, unmodified, and new entries go after
 * them. A shrunk file, a reworded entry and a reordered entry all fail.
 *
 * THE LIMIT, STATED. A prefix check cannot tell a legitimate append from a
 * wholesale rewrite that happens to reproduce the old text; it also says nothing
 * about whether the new entry is TRUE. It checks preservation, not content.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

export const LOG_PATH = 'dev/agent-workflow/SESSION_ROUTER_LOG.md'

/** Normalize line endings and the trailing newline, nothing else. */
export function normalizeLog(text) {
  const lf = String(text).replace(/\r\n/g, '\n')
  return lf.endsWith('\n') ? lf : `${lf}\n`
}

/**
 * @param {{baseText: string, headText: string}} input
 * @returns {{verdict: 'pass'|'fail', lines: number, added: number, removed: number, reason: string}}
 */
export function checkAppendOnly({ baseText, headText }) {
  const base = normalizeLog(baseText)
  const head = normalizeLog(headText)
  const lines = head.split('\n').length - 1
  if (head === base) return { verdict: 'pass', lines, added: 0, removed: 0, reason: 'unchanged' }
  if (head.startsWith(base)) {
    const added = head.slice(base.length).split('\n').length - 1
    return { verdict: 'pass', lines, added, removed: 0, reason: `appended ${added} line(s)` }
  }
  const baseLines = base.split('\n')
  const headLines = head.split('\n')
  let diverge = 0
  while (diverge < baseLines.length && diverge < headLines.length && baseLines[diverge] === headLines[diverge]) diverge += 1
  const removed = Math.max(0, baseLines.length - 1 - diverge)
  const added = Math.max(0, headLines.length - 1 - diverge)
  const missing = baseLines.length - 1 - diverge
  const reason = missing > 0
    ? `LOG_TRUNCATED_OR_REWRITTEN: first divergence at line ${diverge + 1}; ${missing} base line(s) missing or changed`
    : 'LOG_REORDERED_OR_REWRITTEN at the last base line'
  return { verdict: 'fail', lines, added, removed, reason }
}

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

/**
 * @param {{cwd?: string, file?: string, base?: string}} [options]
 * @returns {{verdict: 'pass'|'fail'|'refused', base: string|null, lines: number, added: number, removed: number, detail: string}}
 */
export function checkAppendOnlyLog({ cwd = process.cwd(), file = LOG_PATH, base = null } = {}) {
  let baseSha = null
  try {
    const ref = base ?? (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'origin/master')
    const resolved = git(['rev-parse', '--verify', `${ref}^{commit}`], cwd).trim()
    baseSha = git(['merge-base', resolved, 'HEAD'], cwd).trim()
  } catch (e) {
    return { verdict: 'refused', base: null, lines: 0, added: 0, removed: 0, detail: `REFUSED: no usable base revision (${String(e && e.message ? e.message : e)}); an append-only claim needs a base to append TO` }
  }
  let baseText
  let headText
  try {
    baseText = git(['show', `${baseSha}:${file}`], cwd)
    headText = readFileSync(`${cwd}/${file}`, 'utf8')
  } catch (e) {
    return { verdict: 'refused', base: baseSha, lines: 0, added: 0, removed: 0, detail: `REFUSED: cannot read ${file} at base or head (${String(e && e.message ? e.message : e)})` }
  }
  const r = checkAppendOnly({ baseText, headText })
  return { verdict: r.verdict, base: baseSha, lines: r.lines, added: r.added, removed: r.removed, detail: r.reason }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const baseArg = args.includes('--base') ? args[args.indexOf('--base') + 1] : null
  const r = checkAppendOnlyLog({ base: baseArg })
  process.stdout.write(`DSH-APPEND-ONLY-LOG verdict=${r.verdict} base=${r.base ?? '-'} lines=${r.lines} added=${r.added} removed=${r.removed} detail="${r.detail}"\n`)
  process.exit(r.verdict === 'pass' ? 0 : r.verdict === 'refused' ? 3 : 1)
}
