# F1 — `scripts/freeze-candidate.mjs` truncated its own report (root cause of the hosted red that held `freeze-candidate.test.mjs` out of collection)

**Dated:** 2026-11-18 (real UTC, `date -u`). **Branch:** `task/residual-fixes-20261116`.
**Defect in one sentence.** The generator ended with `process.exit(main(...))`, and
`process.stdout` is a PIPE under a test harness or a dispatcher, where the tail of the
report — the `DIGEST` / `CLEAN` / `DRIFT` summary line every assertion reads — is still
queued in the stream when the process is torn down.

**Why the tail is queued.** The `--check` report is **20 911 bytes / 174 lines**, written
as ~174 separate `process.stdout.write` calls. Past the stream's 16 KB high-water mark the
writes are asynchronous; `process.exit()` does not wait for the event loop, so the last
chunk (2.8–16 KB, ending with the verdict line) is dropped and the caller sees **exit 1
with a truncated report**. That is exactly the hosted shape B2 recorded: *"exit was 1 but
the DIGEST line did not match"* on head `49bb277f`, with a byte-identical input set.

## 1. Reproduction harness (generator level)

`.artifacts/tmp/repro-freeze-candidate-flush.mjs` (gitignored scratch; source below). It
runs the generator `N` times through a bounded concurrency pool, each child's stdout a
**pipe**, against a manifest whose `content_digest` was tampered (so `--check` exits 1 and
the report ends with `DIGEST … MISMATCH` then `DRIFT …` — the exact lines the suite reads).

```js
#!/usr/bin/env node
import { spawn } from 'node:child_process'
const [script, nArg, cArg, manifest] = process.argv.slice(2)
const N = Number(nArg ?? 300)
const C = Number(cArg ?? 50)
const args = ['--check', '--manifest', manifest]
function one() {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [script, ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = '', err = ''
    p.stdout.setEncoding('utf8'); p.stderr.setEncoding('utf8')
    p.stdout.on('data', (d) => { out += d }); p.stderr.on('data', (d) => { err += d })
    p.on('close', (code) => resolve({ code, out, err }))
  })
}
let next = 0; const results = []
await Promise.all(Array.from({ length: C }, async () => {
  while (next < N) { const i = next; next += 1; results[i] = await one() }
}))
const empty = results.filter((r) => r.out === '')
const emptyExit1 = results.filter((r) => r.out === '' && r.code === 1)
const noDigest = results.filter((r) => !/^DIGEST .* MISMATCH$/m.test(r.out))
const noSummary = results.filter((r) => !/^DRIFT /m.test(r.out))
const badExit = results.filter((r) => r.code !== 1)
console.log(`RUNS ${N} concurrency=${C}`)
console.log(`EMPTY_STDOUT ${empty.length}`)
console.log(`EMPTY_STDOUT_EXIT1 ${emptyExit1.length}`)
console.log(`MISSING_DIGEST_LINE ${noDigest.length}`)
console.log(`MISSING_DRIFT_SUMMARY ${noSummary.length}`)
console.log(`WRONG_EXIT ${badExit.length}`)
```

## 2. Before / after (same command, same tree, same tampered manifest)

`f1-generator-truncation-before.txt` / `f1-generator-truncation-after.txt`:

```
# BEFORE  node .artifacts/tmp/repro-freeze-candidate-flush.mjs scripts/freeze-candidate.mjs 400 200 .artifacts/tmp/tampered-digest.json
RUNS 400 concurrency=200
EMPTY_STDOUT 0
EMPTY_STDOUT_EXIT1 0
MISSING_DIGEST_LINE 267
MISSING_DRIFT_SUMMARY 0
WRONG_EXIT 0
  sample exit=1 bytes=20277 last="OK    product.sha_meaning = \"…\"|"
  sample exit=1 bytes=20091 last="OK    product.sha = \"168266dbfe7f2de091d998431bd56ce4dba0dbb5\"|"

# AFTER
RUNS 400 concurrency=200
EMPTY_STDOUT 0
EMPTY_STDOUT_EXIT1 0
MISSING_DIGEST_LINE 0
MISSING_DRIFT_SUMMARY 0
WRONG_EXIT 0
```

**Dose–response** (old binary, same tampered manifest): concurrency 40 → 96/200 lost the
verdict line; concurrency 100 → 174/300; concurrency 200 → 265–267/400. Never a fully
**empty** stdout in these runs — the first ~16–20 KB always reaches the pipe before the
exit, so the honest statement of the root cause is *"the tail is truncated"*, not
*"stdout is always empty"*. A truncated tail is sufficient and is what the suite hit:
`exit 1` plus a missing `DIGEST … MISMATCH` line.

## 3. The suite itself, under the same pool

`f1-suite-concurrent-before.txt` / `f1-suite-concurrent-after.txt`
(120 runs, concurrency 20, each run spawning the generator several times):

```
# BEFORE (old generator)          # AFTER (process.exitCode)
RUNS 120 concurrency=20           RUNS 120 concurrency=20
GREEN 60                          GREEN 120
RED 60                            RED 0
GREEN_WITH_SUMMARY_LINE 60        GREEN_WITH_SUMMARY_LINE 120
```

The reds name the missing summary line, e.g.
`FAIL --check is CLEAN against the committed cand-v0.1.6-1 manifest (exit 0): expected a CLEAN summary line`
and `FAIL --check DETECTS a tampered content_digest (exit 1, DIGEST MISMATCH): expected DIGEST ... MISMATCH`.

## 4. Change

`scripts/freeze-candidate.mjs` (last line only):

```diff
-if (invokedDirectly) process.exit(main(process.argv.slice(2)))
+if (invokedDirectly) process.exitCode = main(process.argv.slice(2))
```

Same exit code, same `main()`, no caller-visible semantics change other than the report
actually arriving. The **test** was not touched (`git diff -- tests/` for this commit is
empty).

## 5. Collection

With the reproduction clean, `tests/s2-authority/freeze-candidate.test.mjs` was re-measured
and collected in commit *"test(collection): collect the two repaired s2-authority suites"*
— see `COLLECTION.md` in this directory for the measurement, the leg it joined, and the
`48 → 46` baseline regeneration.
