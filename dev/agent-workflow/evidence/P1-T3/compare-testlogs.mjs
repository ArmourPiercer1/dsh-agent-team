#!/usr/bin/env node
// compare-testlogs.mjs — diff two vitest run logs (baseline vs post) for new/gone failures.
//
// Usage: node compare-testlogs.mjs <baseline.log> <post.log>
// Prints a JSON result to stdout. Exit 0 = NO_NEW_FAILURES, 1 = NEW_FAILURES_PRESENT, 2 = usage error.
//
// Identity model (all normalized so that timing/scheduling noise cannot create diffs):
//   failIds      — "Failed Tests" section entries: `FAIL |<pool>| <file> > <full test name>`.
//                  Names are wrapped at the terminal width in the raw log; continuation lines are
//                  re-joined heuristically (a continuation ends at a blank line, an error/stack/diff
//                  line, or a section divider). Pooled and unpooled entry shapes are both accepted.
//   nameIds      — progress-section "×" lines: `× <test name> <duration>` with the trailing
//                  `<N>(.<M>)?(ms|s)` duration stripped (the raw duration is run-specific noise).
//   unhandledIds — "Unhandled Rejection" entries: the error message lines re-joined (wrapped) up to
//                  the first blank line / stack line / divider, capped at 160 chars.
// The three identity kinds are diffed independently (set semantics: duplicate listings of the same
// test collapse, so per-run duplicate blocks cannot create false churn).
//
// Note: the raw log may list more FAIL entries than the "Tests N failed" summary (duplicate
// listings of tests failing in multiple blocks/pools); set semantics make that immaterial.

import { readFileSync } from 'node:fs'

const baseArg = process.argv[2]
const postArg = process.argv[3]
if (!baseArg || !postArg) {
  console.error('usage: node compare-testlogs.mjs <baseline.log> <post.log>')
  process.exit(2)
}

const stripAnsi = (s) => s.replace(/\u001b\[[0-9;]*m/g, '')

// A line that begins an error body (rather than continuing a wrapped test name).
const ERROR_START =
  /^(?:[A-Za-z]*Error\b|AssertionError|❯|⎯|\d+\||[-+]\s|-?\s*Expected|Received\b|at\s|Expected:|Received:)/

const isDivider = (l) => /^\s*⎯/.test(l)
const isErrorStart = (l) => ERROR_START.test(l)

function extract(logPath) {
  const text = stripAnsi(readFileSync(logPath, 'utf8'))
  const lines = text.split(/\r?\n/)
  const failIds = new Set()
  const nameIds = new Set()
  const unhandledIds = new Set()
  const summaries = []
  let failedTestsHeader = null
  let unhandledCountLine = null
  let lastBlockCounter = null
  let i = 0
  while (i < lines.length) {
    const line = lines[i].replace(/\s+$/, '')
    if (!line) { i++; continue }

    const fh = line.match(/Failed Tests\s+(\d+)/)
    if (fh) { failedTestsHeader = fh[1]; i++; continue }
    const uh = line.match(/Vitest caught (\d+) unhandled errors/)
    if (uh) { unhandledCountLine = uh[1]; i++; continue }
    const bc = line.match(/^\s*⎯+\s*\[(\d+)\/(\d+)\]⎯+\s*$/)
    if (bc) { lastBlockCounter = `${bc[1]}/${bc[2]}`; i++; continue }
    if (/^\s*Test Files\s/.test(line) || /^\s*Tests\s/.test(line) || /^\s*Duration\s/.test(line) || /^\s*Errors?\s/.test(line)) {
      summaries.push(line.trim())
      i++
      continue
    }

    // Pooled FAIL entry: `FAIL  |<pool>| <file> > <name...>`
    const f = line.match(/^\s*FAIL\s+\|([^|]*)\|\s+(\S+)\s+>\s*(.*)$/)
    // Unpooled FAIL entry: `FAIL  <file> > <name...>`
    const f2 = f === null ? line.match(/^\s*FAIL\s+(\S+)\s+>\s*(.*)$/) : null
    if (f || f2) {
      const e = f || f2
      const file = f ? e[2] : e[1]
      let name = (f ? e[3] : e[2]).trim()
      i++
      while (i < lines.length) {
        const nxt = lines[i].replace(/\s+$/, '')
        if (!nxt || isDivider(nxt) || isErrorStart(nxt)) break
        name += ' ' + nxt.trim()
        i++
      }
      failIds.add(`${file.trim()} > ${name}`)
      continue
    }

    // Progress "×" line: `× <test name> <duration>`.
    const x = line.match(/^\s*×\s+(.+)$/)
    if (x) {
      let name = x[1].trim()
      name = name.replace(/\s+\d+(?:\.\d+)?\s*(?:ms|s)$/, '')
      nameIds.add(name)
      i++
      continue
    }

    // Unhandled Rejection block.
    if (line.match(/^\s*⎯+\s*Unhandled Rejection\s*⎯+\s*$/)) {
      i++
      let msg = ''
      while (i < lines.length) {
        const nxt = lines[i].replace(/\s+$/, '')
        if (!nxt || isDivider(nxt) || /^\s*❯/.test(nxt)) break
        msg += (msg ? ' ' : '') + nxt.trim()
        i++
      }
      unhandledIds.add('unhandled: ' + msg.slice(0, 160))
      continue
    }

    i++
  }
  return {
    failIds: [...failIds].sort(),
    nameIds: [...nameIds].sort(),
    unhandledIds: [...unhandledIds].sort(),
    summaries,
    failedTestsHeader,
    unhandledCountLine,
    lastBlockCounter,
  }
}

function diff(a, b) {
  const aSet = new Set(a)
  const bSet = new Set(b)
  return {
    new_in_post: b.filter((x) => !aSet.has(x)),
    gone_in_post: a.filter((x) => !bSet.has(x)),
    common: b.filter((x) => aSet.has(x)),
  }
}

const base = extract(baseArg)
const post = extract(postArg)

const failDiff = diff(base.failIds, post.failIds)
const nameDiff = diff(base.nameIds, post.nameIds)
const unhandledDiff = diff(base.unhandledIds, post.unhandledIds)

const newCount = failDiff.new_in_post.length + nameDiff.new_in_post.length + unhandledDiff.new_in_post.length

const result = {
  baseline: {
    summaries: base.summaries,
    failed_tests_header: base.failedTestsHeader,
    unhandled_count_line: base.unhandledCountLine,
    last_block_counter: base.lastBlockCounter,
    fail_entries: base.failIds.length,
    progress_x_entries: base.nameIds.length,
    unhandled_entries: base.unhandledIds.length,
  },
  post: {
    summaries: post.summaries,
    failed_tests_header: post.failedTestsHeader,
    unhandled_count_line: post.unhandledCountLine,
    last_block_counter: post.lastBlockCounter,
    fail_entries: post.failIds.length,
    progress_x_entries: post.nameIds.length,
    unhandled_entries: post.unhandledIds.length,
  },
  fail_section: { new_in_post: failDiff.new_in_post, gone_in_post: failDiff.gone_in_post, common: failDiff.common.length },
  progress_names: { new_in_post: nameDiff.new_in_post, gone_in_post: nameDiff.gone_in_post, common: nameDiff.common.length },
  unhandled: { new_in_post: unhandledDiff.new_in_post, gone_in_post: unhandledDiff.gone_in_post, common: unhandledDiff.common.length },
  verdict: newCount === 0 ? 'NO_NEW_FAILURES' : 'NEW_FAILURES_PRESENT',
}
console.log(JSON.stringify(result, null, 2))
process.exitCode = newCount === 0 ? 0 : 1
