# PR #401 Security Review R1 — u7 grep drain

**Verdict: PASS-WITH-FINDINGS**

**Reviewed head:** `1081ef9616a2c056b237194607c97e5e1e6312a6` (`task/u7-grep-drain-20261026`).

## Verdict summary

The shipped false admit is real on `origin/master` and is closed on this head. I reproduced the master failure with the new adversarial suite: late `Permission denied` stderr admitted `ok:true` with two matches; an undrained stderr stream admitted; a stdout `close` without `end` admitted. The same suite is 8/8 green on this head, including the positive control and 60 repeated interleaved walks. No adversarial shape 2a–2f admitted incorrectly.

One availability finding remains: `watchStreamEnd()` does not handle a stream that has already emitted `end` before it is called. A direct injected `PassThrough` probe ended the stream, then called the helper; the returned promise did not settle and bounded-await returned `null` after the 250 ms bound. This is fail-closed (no security admit), but is an avoidable availability refusal if a provider ever supplies an already-ended stream. Current row wiring creates the watches immediately after `spawnStreaming` returns and before `raceConfinedSettle`, so I found no evidence that the production provider can be already-ended at that point. Track as a low-severity follow-up or harden the helper with a readable-state precheck.

## Reproduction and adversarial shapes

| Shape | Driven / evidence | Row answer | Per-item verdict |
|---|---|---|---|
| 2a. stderr `close` without `end` after late data | `u7-grep-late-stream.test.ts` SEC-6 (`destroy()` after summary); master run admitted, HEAD refused | `walker-error`, no sink write | **VERIFIED**: fail-closed |
| 2b. stderr `end` with final queued data | SEC-1/2/3/4 use real Node `PassThrough` with `data` listeners attached before writes/flowing; both drain and data listeners are on the same stream object; HEAD receives late bytes before `end` and classifies them | coverage late => `walker-permission-refused`; regex late => `walker-invalid-pattern`; whole stdout late => `ok:true` with 2 matches | **VERIFIED**: no reorder/admit bug |
| 2c. stderr never ends; bound expires | SEC-5 | typed `walker-error`, `drainIncomplete:1`, `DRAIN-INCOMPLETE`; ~261 ms, under 2 s; no sink write | **VERIFIED**: bounded fail-closed |
| 2d. stderr `error` | Helper semantics and row gate accept only `end`; `error` is named non-end and maps to `walker-error` | no admit | **VERIFIED by code path**; no dedicated test leg in this file |
| 2e. watch installed before settle | `search-backend.mjs` lines 926–939: data + end/close/error watches precede `raceConfinedSettle`; SEC-7 fast control admitted in 51 ms | normal search remains `ok:true` | **VERIFIED** |
| 2f. cancelled path | `search-backend.mjs` line 991 uses `cancelled ? null : ...`; cancellation checks at lines 994–1007 return cancellation before drain verdict/completion | cancellation refusal, never an admit | **VERIFIED by code path and existing cancel suites** |
| 2g. stream already ended before watch | Direct helper probe: `PassThrough.end()`, yield, then `watchStreamEnd()`; bounded wait timed out | fail-closed timeout (`null`), but availability regression if provider can expose this state | **FINDING**: low severity availability |

No shape in 2a–2f admitted wrongly on HEAD. The only wrong admits were on master: 2a/2c and the late-data coverage case; all were refused on HEAD.

## RED/GREEN

Ran `node -v`: `v24.21.0`.

Ran `pnpm exec vitest run packages/runtime/test/u7-grep-late-stream.test.ts --reporter=verbose` on HEAD: **1 file, 8 tests passed**.

Ran the same suite against `origin/master`'s `search-backend.mjs` in a scratch replacement (restored afterward): **7 tests failed, 1 passed**. Confirmed false admit and all documented reds, including SEC-1 `ok:true` with two matches and SEC-5 undrained `ok:true`.

## Drain rule and timer checks

- `stream-drain.mjs:53–70`: `watchStreamEnd` resolves first terminal form among `end`, `close`, `error`; `release()` is idempotent and removes handlers.
- `search-backend.mjs:926–927`: watches are installed on the same `child.stdout` / `child.stderr` objects as the `data` handlers.
- `search-backend.mjs:991`: drain is skipped on cancelled path (`cancelled ? null : ...`).
- `search-backend.mjs:1031–1036`: admission requires both forms exactly `'end'`; any `close`, `error`, or bound expiry becomes `walker-error` with `drainIncomplete`.
- `stream-drain.mjs:81`: Node v24.21.0 `Timeout.prototype.unref()` returns the same Timeout object (`true` by identity); `clearTimeout(timer)` therefore works. The verbose suite completed without hanging.

## Glob row byte/semantic review

`GLOB_STDERR_DRAIN_MS` was master’s literal `250`; HEAD aliases it to `STREAM_DRAIN_MS`, also `250`. The three glob timer sites (stdout cap, stream drain, payload record fuse) now use `awaitBounded`; stdout terminal watching uses the shared helper. The glob row’s acceptance remains intentionally unchanged: any terminal form counts for stdout collection, stderr remains observed rather than enforced, and rc-first behavior is unchanged. Existing rc-first, alpha5-glob-backend(+adversarial), a5-cancel-glob, alpha5-glue7, and u7-g6b-late-stream evidence is green in the PR evidence battery. I found no intended semantic change to glob’s judgement law; only timer/watch mechanics were deduplicated.

## M2 guard judgement

`git show --stat b720fa8f6` and `git show -s` confirm `b720fa8f61e2c09dc2e40bca5482d6cc324bfe7c` is the U6 PR5 move commit (`feat(search-family): move the search rows into their own lane; ARC-A fitness gate`). Comparing the moved commit’s blobs to the pre-move master is meaningful for the historical claim “the move itself changed only declared deltas.” The provenance-tag presence check prevents a vacuous missing/replaced lane file.

However, this relaxation means M2 no longer detects undeclared edits to the live lane files. That gap is partly covered by M1/M3/M4, the search golden vectors (digest `0dabc187…`), and the search regression/adversarial suites, but those are behavioral/structural coverage rather than a complete byte-level declaration guard. A stronger alternative is a reviewed current-lane digest (or explicit reviewed blob pin) that each lane-owned fix must update deliberately, while retaining the historical move-commit comparison. I judge the relaxation justified for this PR’s need to land the reviewed drain fix without falsifying move history, but it is a residual guard weakness.

## Scope checks

- `dev/agent-workflow/ledgers/arc-a-protected-center.json` contains no `search-family` or sandbox-provider path.
- No new refusal code was added: the drain failure uses existing `walker-error` and adds `drainIncomplete` only as counts/detail.
- Refusal text tables are unchanged; no walker words are placed on the wire (audit/debug only).
- No host was booted; :3080 and `~/.dsh` were untouched.

## Hosted checks

At review time, `gh pr view 401 --json headRefOid,statusCheckRollup` reported head `1081ef9616…`; `candidate-protection`, `synthesize-merge-tree`, `pr-gate`, `ci-fast`, `ci-integration`, and `ci-security` were **SUCCESS**. `census-runtime` and `ci-full / ci-full` were still **IN_PROGRESS**. They were not treated as green.

## Findings

1. **LOW — availability hardening gap — `packages/tools/search-family/src/stream-drain.mjs:53–69`.** `watchStreamEnd` attaches one-shot listeners but does not detect an already-ended stream. Such a stream waits until the 250 ms fuse and is refused. Current production ordering makes this unlikely, but the helper contract is generic and a provider timing change could turn every otherwise-valid call into a fail-closed refusal. Recommended follow-up: detect an already-terminal readable state before/while installing the watch, or document/prove provider freshness as an invariant and add a regression test.
2. **LOW/MEDIUM — M2 residual coverage weakness — `packages/runtime/test/u6-pr5-search-move-law.test.ts:132–144`.** Historical move parity is now pinned to `MOVE_SHA`, so live lane bytes can drift without M2 failing. Existing goldens/suites reduce the risk but do not replace a reviewed current-byte declaration. Recommended follow-up: add a reviewed current-lane digest updated explicitly with each intentional lane fix.

## COULD-NOT-VERIFY

- No dedicated injected `stderr`-`error` test leg was added/run; the helper and gate were inspected and the existing non-`end` gate is direct.
- Hosted `census-runtime` and `ci-full` were still running at the time of review; final conclusions should refresh them before merge.
- I did not claim a natural local real-rg late-stderr reproduction; the deterministic provider-seam reproduction is the direct proof, while the PR evidence records the hosted natural race.

## Merge recommendation

**Do not merge until hosted `census-runtime` and `ci-full` finish successfully.** If both finish SUCCESS, merge is reasonable with the two low-severity follow-ups recorded; no 2a–2f adversarial shape admitted wrongly on this head.
