# U7-G6b — glue7 G6b census-load flake (2026-10-26)

Branch `task/u7-g6b-census-flake-20261026`, worktree `.worktrees/u7-g6b`, off `origin/master` f3f415aa0. Single writer. No host boot, :3080 and ~/.dsh untouched.

## 1. The red, from the hosted transcripts (not the census summary)

The census summary named only the test title. The `census-runtime-transcripts-*` artifacts carry the vitest failure detail. Excerpts are in this directory.

| run | head | capture | failing assertion |
| --- | --- | --- | --- |
| 40386960117 | 181cbb836 | 1 of 2 | `alpha5-glue7-plane-backends.test.ts:301` `expect((capped.outcome?.files ?? []).length).toBe(100)`: **expected +0 to be 100**. `capped.ok` was true and the leg took 550 ms, so this was not the 60 s timeout. → `hosted-40386960117-capture-1-G6b.txt` |
| 40386788330 | 395f83970 | 2 of 2 | `:304` `expect(bad.ok).toBe(false)`: **expected true to be false**. `[unclosed` came back as a success. → `hosted-40386788330-capture-2-G6b.txt` |

These are two different assertions with one shape: **the row answered `ok:true` with an empty list on a walk it had not finished hearing**.

## 2. Root cause: the archived factory reads stdio at `exit`, before the streams end

The leg drove `createAnchoredGlobBackend` from `packages/tools/search-family/src/search-mechanics.mjs` (master :274–473). That is the ARCHIVED CANDIDATE-A factory. It shipped nothing: the barrel re-exported it only as `createAnchoredGlobBackendCandidate` (`index.mjs:65`), and the plane imports the PRODUCTION row from `glob-backend.mjs` (`team-tool-plane.mjs:88`, mounted at `:1704`). The archived factory:

1. awaits `h.exited`, which is the launcher's `'exit'` event, then `h.terminate()`, and then reads its `stdout`/`stderr` string buffers with **no wait for the streams to end**. Node may fire `'exit'` while the stdio `'data'` callbacks are still pending. Under census load (nine roots in parallel) the window is real. A 105-file walk then reads as `files=[]` (the :301 red).
2. judges rg's walker error by the launcher exit code plus a SPEECH fallback. The streaming arm reads rg's rc 2 back as 0, so if the stderr speech has not arrived either, the leg returns an empty SUCCESS (the :304 red).

The g6b-flake rounds 2–6 + step B already repaired exactly this class **in the production row only**: stdout end-collection `glob-backend.mjs` ~:1176-1213, plus the rc-first payload record ~:1280-1350. The archived copy never received them.

### Discriminating experiments

- **(d)/(e) late delivery: deterministic RED.** `packages/runtime/test/u7-g6b-late-stream.test.ts` injects a provider handle in the real frozen streaming shape (the rc-first suite's fake). `exited` resolves at once and the payload bytes arrive 40 ms later, after terminate, inside every drain bound. Run against BOTH factories before the fix (`late-stream-RED-before-fix.log`):
  - PRODUCTION `glob-backend.mjs`: **2/2 green** (cap 100 + truncated; late rc=2 → `walker-error`).
  - ARCHIVED candidate: **2/2 red, with exactly the hosted shapes**: `expected +0 to be 100`, and `{"ok":true,...,"files":[]}` for `[unclosed`.
- **(a) WORLD-name collision: excluded.** The census captures run sequentially (`ci-pr-gate.mjs:1562` loop), and each vitest file runs in one worker, so a `Date.now()` WORLD is not shared inside a capture. The failure shape (ok:true + empty list, 550 ms) is not a deleted-root shape either: a missing root would refuse at `resolveAnchored`/`fsOpen` as `not-a-directory`.
- **(b) timeout / cap gate: excluded.** 550 ms vs `timeoutMs = 60_000`. A timeout returns `settlement.kind:'cancelled'`, not `completed`.
- **(c) `execCount` race: excluded.** The failing assertions precede it.
- **Local load reproduction rate (before).** The real-launcher loop of the c1/c2/c3 sequence ran 200× under 12 busy-loop workers on 6 cores plus the whole runtime suite in parallel: **0/200** (`loop-before-200-cpu12-plus-runtime-suite.jsonl`). A second run of 200× was pinned to ONE core shared with 4 busy workers, with instrumentation recording stdout bytes at `exit`, after terminate, and at stream end: **0/200, and 0/400 walks had any byte outstanding at `exit`** (`diag-before-200-one-core-starved.jsonl`). On this host the window does not open locally. The hosted rate is 3 red captures out of the last 3 non-master census runs (2 runs, 3 captures), while master's own census runs were green. That fits the census reruns on the hosted runner, which is busier during PR-ref runs. The deterministic injection above is the evidence for the mechanism, not the local load rate.

## 3. Fix: retire the archived factory (one glob row, one walker law)

The archive existed to keep CANDIDATE-A's "bounded face" available for comparison. Delegating it to the production helpers would have left a second factory face that could drift again, and the verbatim move law pinned its bytes anyway. So it is RETIRED:

- `search-mechanics.mjs`: removed `createAnchoredGlobBackend` (master :319–539 of the U6 PR5 source region) and its now-unused imports (sandbox-provider, fs-search, `SYSTEM_RX`, `existsSync`/`relative`/`sleepTimer`). The file no longer mounts the provider.
- `index.mjs`: removed the `createAnchoredGlobBackendCandidate` alias.
- `alpha5-glue7-plane-backends.test.ts` G6b: the same three faces are now asserted on the SHIPPED row (`glob-backend.mjs`, `backendId a5glb-anchored-confined-rg-glob`): 100-cap + truncated, `[unclosed` → `walker-error` (rc-first), symlink-final → `symlink-alias` before any spawn, `execCount() === 2`. No assertion was relaxed. The walker-error pin is narrowed from `/rg-walker-error|rg-exit-\d/` to the exact `walker-error`.
- `u6-pr5-search-move-law.test.ts` M1: pins the kept region (master :107–318) VERBATIM **and** the retired tail's absence.
- `a5p4-lane-hygiene.test.ts` / `a5w-integration-wiring.test.ts`: `search-mechanics.mjs` is unbooked as a provider mount (its only mount was the retired factory). The hygiene walk now holds it to "names the lane nowhere".
- `p4t6-session-event-scan.test.ts`: booked the one new scannable spec (`SCANNED_PATHS_U7G6B`, 1306 → 1307, `p4t6-RED-unbooked.log`).
- dist mirror re-placed (`scripts/place-dist-glue.mjs`).

Protected-center ledger (`dev/agent-workflow/ledgers/arc-a-protected-center.json`): no search-family or sandbox-provider path is listed, so no protected path moved. The production `glob-backend.mjs` and the provider are byte-unchanged.

**Production exposure: none.** No shipped governed path ever returned an empty success for an invalid glob. The racy factory had no production consumer.

## 4. Proof

- After the fix, the c1/c2/c3 sequence on the shipped row ran **600×** with the real launcher under 12 busy workers on 6 cores plus a concurrent full runtime-suite pass: **0/600** failures, walk p50 858 ms / p99 1383 ms / max 28.8 s. The concurrent runtime pass ran 5261 tests, all green. One collection failure, `p7t4-root-fork.test.ts`, was stale `.tmp-fault` scratch from an earlier interrupted run in this worktree; it is green on its own after the scratch is cleared and unrelated to this change.
- Affected suites: 20 files / 286 tests green. They include `u7-g6b-late-stream`, `alpha5-glue7-plane-backends`, `alpha5-g6b-rc-first`, `alpha5-glob-backend` (+adversarial), `a5-cancel-glob`, `a5-cancel-search`, `alpha5-search-backend`, `a5-globoff-key`, `a5int-r3-mount-integration`, `a5p4-lane-hygiene`, `a5w-integration-wiring`, `u6-pr5-search-*`, `u6-arc-a-*`, `a5b3-cancel-leg`, `a5-scratch-default` and `p4t6`.
