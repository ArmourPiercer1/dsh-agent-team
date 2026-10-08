#!/usr/bin/env node
// Reproduction of the tokenless run this file exists to prevent.
//
// The first draft of `scripts/ci-pr-gate.mjs` kept the skipped-leg NAMES in a local array while the
// final-token builder read `counts.skipped`. The run therefore threw a TypeError between its last
// leg line and its verdict token — producing exactly the transcript shape whose absence this gate
// defines as a failure:
//
//   DSH-CI-LEG leg=census verdict=pass seconds=0.1 detail=…
//   TypeError: Cannot read properties of undefined (reading 'length')
//       at finalToken (scripts/ci-pr-gate.mjs:124:59)
//       at main (scripts/ci-pr-gate.mjs:892:27)
//   [exit 1, no DSH-CI-VERDICT line ever printed]
//
// That transcript was real, but it belonged to a draft whose line numbers no longer exist, so it is
// reproduced here against the CURRENT module instead of quoted from memory: the same builder, called
// with the counts object the draft used to pass it. The fix (one object owns every number the token
// states, and the token is printed from a `finally`) is pinned by `--self-test`.
//
// Usage: node dev/agent-workflow/evidence/a4-pr7/ci-gate/scratch/reproduce-tokenless-crash.mjs
import { finalToken } from '../../../../../../scripts/ci-pr-gate.mjs'

console.log('=== reproduction: what a run looked like when the verdict builder could throw ===')
console.log('the leg line printed first, exactly as the draft printed it:')
console.log('  DSH-CI-LEG leg=census verdict=pass seconds=0.1 detail=identity set IDENTICAL to the published baseline')
try {
  // The draft's shape: pass/fail/skip/legs on `counts`, the skip NAMES somewhere else.
  finalToken('fail', { pass: 6, fail: 1, skip: 0, legs: 7 })
  console.log('NOT REPRODUCED: finalToken accepted the incomplete counts object — the pin has lapsed.')
  process.exit(1)
} catch (e) {
  console.log(`reproduced: ${e.constructor.name}: ${e.message}`)
  console.log('and nothing after this point would have run, so the run had no verdict token.')
  console.log('exit code would have been non-zero, and a reader who only greps for the token sees silence.')
  process.exit(0)
}
