# u7 grep-drain — the production grep row drains walker streams before classifying (2026-10-26)

Branch `task/u7-grep-drain-20261026`, worktree `.worktrees/u7-grep-drain`, off `origin/master` 21f3f5b08. `origin/master` f37406e47 (which includes #399) was merged in before the PR. Single writer. No host was booted, and :3080 and ~/.dsh were not touched.

## Answer first: a false admit WAS reachable on shipped code

`createAnchoredRgSearchBackend` (`packages/tools/search-family/src/search-backend.mjs`, the PRODUCTION grep row the plane mounts through `search-mechanics.mjs`) read its `stdout`/`stderr` buffers once `exited` and `terminate` had settled. It never waited for the streams to END. With stdout complete on time (match records plus the `summary` record, so the completion proof passed) and stderr carrying `rg: ./locked: Permission denied (os error 13)` 40 ms later, the row returned:

```
{"ok":true,"outcome":{"outputMode":"content","matches":[…a.ts…, …readable/b.ts…],"totalMatches":2,"truncated":false},"settlement":{"kind":"completed"}}
```

`walkerCoverageRefusal` exists to refuse exactly this case: a walk that skipped a subtree it could not read. It saw an empty string. → `late-stream-RED-before-fix.log` (SEC-1).

Scope of that claim: this was proven by deterministic injection at the provider seam, with the real frozen handle shape and real PassThrough pipes. A natural reproduction needs two things at once: rg's coverage line has to reach the parent after the launcher's `exit`, and stdout has to be complete by then. The hosted P8 red (below) shows the lateness half happening on the real chain. Both lines travel the same stderr pipe, and the row read stderr the same way for both.

## The hosted red

Census run 40397268848 (ci-full, capture 1 of 2) failed `alpha5-search-backend.test.ts:517` (P8, regex `(`) with `expected 'walker-error' to be 'walker-invalid-pattern'`. rg's `regex parse error` reached the parent after `exited`, and `classifyWalkerStderr` read `''`. SEC-2 reproduces exactly that assertion.

## RED → GREEN (`packages/runtime/test/u7-grep-late-stream.test.ts`)

Technique: the sibling u7-g6b lane's injected late-stream provider. `exited` resolves after about 5 ms, and the late bytes are written 40 ms after `terminate()`. Everything above the handle is real row code: the real anchor, the verifiers, the classifiers and the projection.

| leg | shape | master (21f3f5b08) | after |
| --- | --- | --- | --- |
| SEC-1 | stdout matches+summary on time, `Permission denied` late | **ok:true, 2 matches (FALSE ADMIT)** | walker-permission-refused, 0 sink |
| SEC-2 | `regex parse error` late, no stdout (hosted P8) | walker-error (misclassified) | walker-invalid-pattern |
| SEC-3 | whole stdout incl. summary late | walker-error (wrong refusal of a complete walk) | ok, 2 matches |
| SEC-4 | stdout late + coverage refusal late | walker-error | walker-permission-refused |
| SEC-5 | stderr never ends | **ok:true (admitted undrained)** | walker-error `drainIncomplete=1`, `DRAIN-INCOMPLETE` line, <2 s |
| SEC-6 | stdout destroyed (close without end) after summary | **ok:true** | walker-error |
| SEC-7 | control, all on time | ok | ok (unchanged) |
| SEC-8 | 60 interleaved SEC-1/2/3 | 60/60 misjudged | 0 |

Every leg also asserts that no row listener (`data`/`end`/`close`/`error`) stays on either pipe once the call has returned.

## Fix: one shared drain helper

New `packages/tools/search-family/src/stream-drain.mjs`. It holds mechanics only, no verdicts and no wording:
- `watchStreamEnd(stream)` is installed before the settle race. The first of `end`/`close`/`error` settles it and names the form. `release()` is idempotent.
- `awaitBounded(p, ms)` returns the value, or `null` if the bound expires first. Its timer is unref'd and cleared on both exits.
- `STREAM_DRAIN_MS = 250` is the glob row's measured cap-family constant. `GLOB_STDERR_DRAIN_MS` is now an alias of it, so there is one bound and no copy. It lives in the helper because the grep row already imports the glob row.

Grep row (`search-backend.mjs`):
- The watches are installed with the `data` listeners.
- The drain is awaited after the owned terminate, and only on the path that judges the walk. The timeout arm and the cancel arm make no claim about the tree, so they never wait.
- The existing `after-settle` channel ask follows the drain await, so a withdrawal during the drain is still a cancel. The cancel map is unchanged, and C3 (13 asks) is green.
- Verdict order: signal/launcher → overflow → **drain verdict** → completion law (summary) → coverage → parse.
- A drain verdict that is not `end`/`end` is a typed `walker-error` with `drainIncomplete: 1` plus an audit line. No new table code was added, and it is never a success.
- The release stays in the one `finally` slot (`releaseStreamListeners`), and S5's single-call-site pin holds.

Glob row (`glob-backend.mjs`): the stdout watch and its three timers (cap, drain, record fuse) now go through the helper. Behaviour is byte-identical: any terminal form still counts as collected, and STDERR is still observed, not enforced. Its suites (rc-first, glob-backend(+adversarial), a5-cancel-glob, glue7, u7-g6b-late-stream) are green and were not edited.

Move law: `u6-pr5-search-move-law` M2 pinned the WORKING TREE of the three moved files byte-for-byte against master, so any lane fix would have tripped it. M2 now compares the move commit's own blobs (`b720fa8f6`) with the pre-move master. That is the claim the test makes ("moved with exactly the declared deltas"). It also checks that the lane file still carries its provenance tag. M1/M3/M4 are unchanged.

## Load rates (6 cores, 12 busy-loop workers)

| run | row | walks | misjudged |
| --- | --- | --- | --- |
| real launcher + real rg, P8 `(` ×500 (`loop-p8-real.instrument.ts`) | master | 500 | 0 (window did not open locally; p50 155 ms) |
| same | fixed | 500 | **0** (p50 108 ms, p99 185 ms) |
| injected SEC-1/2/3 ×500 rounds (`U7GD_REP_ROUNDS=500`) | master | 1500 | **1500** |
| same | fixed | 1500 | **0** |

As the sibling lane also found, the real-chain window does not open on this host. The mechanism and its fix are proven by the deterministic injection.

## Regression battery (all green)

On the branch commit, and again on the merged tree: 22 files / 373 tests on the branch commit, 23 files / 375 tests on the merged tree (adds u7-g6b-late-stream). They include alpha5-search-backend (P8), a5-cancel-search/glob, a5b2, a5b3, alpha5-g6b-rc-first, alpha5-glob-backend(+adversarial), glue7, u7-g6b-late-stream, golden vectors (409 vectors, digest `0dabc187…`, byte-identical), u6-pr5 move-law, a5p4 hygiene and provider, a5w wiring, a5int-r3, globoff, scratch-default, u6-arc-a, a5p7, and a5-m1-auth-bridge. Logs: `battery-after-fix.log`, `battery-merged.log`.

## Gates

- `ci-pr-gate.mjs --store-dir .tmp-pnpm-store`: pass 7 / fail 0 / skip 1 (census is opt-in). lint-identities: new 0. artifacts-at-head: drift 0. → `ci-pr-gate.txt`
- docs-probe blocking 0, docs-sync blocking 0, eb3-* all exit 0. → `docs-eb3-checks.txt`
- p4t6: two new scannable paths booked in `p4t6-bookings/u7grepdrain.json`. Measured RED was `scanner counts 1310, ledger derives … 1308` (`p4t6-RED-unbooked.log`). Green on the branch and on the merged tree (union with u7g6b).
- dist: the `stream-drain.mjs` placement was appended to `scripts/dist-placements/050-search-family.json`, and the mirror was placed with `node scripts/place-dist-glue.mjs`.
- Protected-center ledger `dev/agent-workflow/ledgers/arc-a-protected-center.json`: it contains no search-family, sandbox-provider or stream path, so no protected path moved.
- Coordination with #399: that PR retired the archived glob factory in `search-mechanics.mjs`. This branch never edits that file, and the merge of origin/master was clean.

## Review round 1 (#401 PASS-WITH-FINDINGS, review branch task/u7-grep-review-20261026 @ 853764fd4): both findings closed

**F-1: availability; a stream already terminal at install time made the drain wait out its bound.** `watchStreamEnd` attached `once('end'|'close'|'error')` unconditionally. A stream that had already ended therefore never resolved: the 250 ms bound expired and a clean walk was refused as `walker-error`. That fails closed, but it costs availability.
- Fix (`stream-drain.mjs` `terminalStateOf`): the stream's own state is read BEFORE any listener is attached. `readableEnded` → `'end'`. Then `errored` → `'error'`. Then `readableAborted`/`destroyed`/`closed` → `'close'`. Only a live stream gets listeners. `release()` stays idempotent (a no-op when nothing was attached).
- Ordering note (measured on node v24): a plain `destroy()` reads `readableAborted=true, errored=null`. That is why `errored` is checked before `readableAborted`; otherwise a torn pipe would be misreported as `'error'`.
- RED → GREEN: `f1-RED-before-fix.log` (the PR head's helper: 5 failed / 9 passed) → `f1-GREEN-after-fix.log` (14/14).
  - Row legs:
    - F1-a: stderr already ended. Admitted, 2 matches, no DRAIN-INCOMPLETE.
    - F1-b: stderr already destroyed. Typed `walker-error` whose audit names `stdout=end stderr=close`, not a bound expiry.
  - Helper legs:
    - H1: already ended → `'end'`, no listener attached.
    - H2: already destroyed → `'close'`.
    - H3: already errored → `'error'`.
    - H4: a live stream still waits for its event, and `release()` gives back every listener, idempotently.

**F-2: no guard against drift of the current lane bytes.** M2 is now about move-parity (the move commit's blobs). The reviewer pointed out that nothing pinned the live lane bytes any more.
- New leg M5 in `u6-pr5-search-move-law.test.ts` adds a `LANE_DIGESTS` ledger: one sha256 per row file (`search-backend.mjs`, `glob-backend.mjs`, `cancel-leg.mjs`), each with a `why`. The rule, stated in the test: a lane-owned change MUST update the digest AND its reason in the same commit. This PR is the first entry.
- Non-vacuity checks inside M5:
  - The cancel-leg digest must equal its move blob (untouched since the move).
  - The two changed rows must differ from their move blobs.
- M2 (move-parity) is kept unchanged. Recorded digests:
  - `search-backend.mjs` `164c56d6…bc15a4`
  - `glob-backend.mjs` `ee1006d5…de608af`
  - `cancel-leg.mjs` `90233b20…2e2da` (= move blob)
- RED proof: one trailing newline appended to `cancel-leg.mjs` turned M5 red with the ledger message (`m5-RED-unexplained-change.log`). The file was restored afterwards.

Battery on the post-findings head: 23 files / 382 tests green (`battery-findings-closed.log`).
Round-2 gates: `ci-pr-gate` pass 7 / fail 0 / skip 1 (census opt-in); docs-probe and docs-sync blocking 0; eb3-* exit 0 (`docs-eb3-checks-round2.txt`).
