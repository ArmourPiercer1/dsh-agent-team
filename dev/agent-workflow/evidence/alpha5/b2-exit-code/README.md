# A5-B2 — exit-code fidelity on the confined stream arm

Branch `alpha5-b2-rc-pr`, base **`104b499173687daa0f5c537bc37ae7600089576c`**, recorded
from the remote rather than relayed:

```
$ git ls-remote origin refs/heads/master
104b499173687daa0f5c537bc37ae7600089576c	refs/heads/master
```

Work order: root 12:50Z, approved path **(a)** — the established interface,
**additive**, as its own PR. The read-only diagnosis it cites (`e129c27c`, and the
ticket `0baca7f5` recorded in `alpha5/COORDINATION.md:152`) is **not reachable from
this repository**: `git cat-file -t e129c27c` and `git cat-file -t 0baca7f5` both
answer `Not a valid object name`, and neither SHA appears in `git ls-remote origin`.
Every line cited in the order was therefore re-measured in the tree at the base above
before being edited; the two places where the citation and the tree disagreed are
named in the ledger below rather than smoothed over.

## What was wrong, in the record's own words

The two natexe captures and the a5rbn live wire show a confined child that was
correctly refused by the kernel, reporting success:

```
bash · exit=0
> (empty stdout)
stderr:
> cat: ../outside/secret.txt: Permission denied
a5p5-meta {"kind":"shell","exitCode":0,"timedOut":false,"cancelled":false,...}
```

Sources (read by the new spec, never rewritten — the spec asserts they still contain
this text, which is what lets it say what changed):

* `dev/agent-workflow/evidence/alpha5/natexe/glue7-rerun-run1-E2-drift-before-commit.log:19`
* `dev/agent-workflow/evidence/alpha5/natexe/glue7-rerun-run2-GREEN-24-24.log:19`
* `dev/agent-workflow/evidence/alpha5/runtime-base-narrow/runs/2026-10-17T23-06-13Z/wire-digests-assembled.jsonl` seq 10 and 11 (the second one is `ls` of two outside directories, also `exit=0`)

Those legs were guarding confinement, and confinement held — the secret bytes never
reached the wire. What was wrong is the number: `exit=0` is the completion state of a
run that did not complete, and it is not neutral, because the model reads it as the
command having worked. The 0 came from `landlock-prelauncher.py`'s stream arm: it
records the real rc in `<out-dir>/exit.json` and then exits 0 whatever the payload did
— and everything above inherited that 0.

## The change: four sites, additive, renderer and host contract untouched

| # | site | what |
| --- | --- | --- |
| ① | `packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py` | the stream arm grows `--exit-passthrough` (bare flag, default **off**). Off, the arm is the historical behaviour; on, `sys.exit(rc)` with a negative `rc` (killed by signal N, as `waitpid` reports it) mapped to `128 + N`. One-shot and probe arms untouched. |
| ② | `packages/runtime/sandbox-provider/provider.ts` | `SpawnRequest` gains `readonly exitPassthrough?: boolean`; the stream argv (`:589` at the base, `:617` after the edit) appends the token only when the request sets it. `prepare()` deliberately does NOT copy the field into the policy file — one byte, one source of truth. |
| ③ | `packages/runtime/src/plugin/live/plane-effect-backends.mjs` | **shell arm only**: the request sets `exitPassthrough: true`, and the outcome mapping now requires a non-negative number (`exit.code >= 0`) before reporting one. |
| ④ | `packages/runtime/test/a5b2-exit-code-fidelity.test.ts` | new spec, ten legs, RED-first (below). |

**The mapping decision, and why not `null`.** The contract reserves a non-number for
NOT OBSERVED — `packages/tools/a5p5-tools/src/types.ts:144-151`: `exitCode === null`
means "killed at timeout before an exit was seen … never a fabricated 0 and never
conflated with 'stopped'". A signal death is the opposite case: the end WAS observed,
it simply had no exit code. Putting it in the null bucket would erase the difference
between "killed by SIGKILL" and "we never saw an end at all", so it is reported in the
convention `/bin/sh` itself uses: `128 + signum` (SIGTERM → 143, SIGKILL → 137). The
citation in the order was `types.ts:145`; in the tree at this base the law sits at
`:144-151` with the field itself at `:151` — same statement, precise lines measured.

### Correction (branch `alpha5-b2c-comment`, off master `b35b9ea763430f385706effe205a852daa3697bc`)

An earlier revision of the launcher comment ended that passage with a claim which is
**false**, and it is recorded here rather than quietly rewritten:

> … 128 + signum (SIGTERM -> 143, SIGKILL -> 137), **which is a number the caller can
> distinguish from any code a payload could have returned and from null.**

A payload can return 137 itself — the literal `exit 137`, or any wrapper re-reporting its
child's signal status — and it reaches the same number through the non-negative branch.
The mapping is constructive and one-way: the launcher knows which branch it took, and the
exit status does not carry that. So the 128..159 range identifies no cause of death, and
the sentence promised a discrimination the interface does not provide.

Replaced by what is true: the `/bin/sh` convention, stated together with the coincidence,
with "the reported number never identifies a cause of death", and with the record that
DOES separate the two cases — `<out-dir>/exit.json`, whose `rc` is the raw waitpid value
(a returned code stays positive, a killed payload is negative). Two sibling wordings in
`provider.ts` carried the same overreach in milder form (a constructed value described as
"the code it actually measured", and a flat "or 128+signum if a signal killed it"); both
now say the value is constructed and may coincide with a code the payload chose.

The corrected statement is pinned rather than merely re-worded: **leg `A5`** runs
`exit 137` and `kill -KILL $$` through the same arm and asserts they yield the SAME
observable code (137) while their `exit.json` records differ (`137` against `-9`). It was
written to pass — a witness, not a RED — and it is the thing that fails if the stronger
claim is ever re-asserted in behaviour rather than prose.

Inventory of same-shape claims (`distinguish|differentiate|told apart|tell apart|confused|
ambiguous` within ±6 lines of exit-code context, across all `.ts/.mts/.mjs/.js/.py` under
`packages/`, `dist` excluded as a derived mirror): **4 hits, 1 real.** The other three are
unrelated vocabulary — an `'ambiguous-omission'` blueprint code name, a
`CONTROL_GUARD_AMBIGUOUS` constant, and a test-doubles sentence about canonical order of
table additions. A second pass over every mention of `128+signum`, `143` and `137` in
`packages/` and in this directory found only the two provider wordings above, now
corrected. **One false claim, three comment edits, zero behaviour change**: the launcher's
executable lines are untouched, its bytes change in comments only, and every byte-pin
holder recomputes the hash — verified by running them (`a5b2` 11/11 with the new `A5`;
glue7 + the a5lsp2 pair + a5p4-assembly-config + a5rbn + a5int-r3 + search = 100/100;
`p4t6` 10/10 with NO booking movement, since the new leg lives in an already-booked file;
`a5p5-dormant-audit` 8/8; `pnpm -r run typecheck` clean; 8 placements; drift gates at the
commit below).

**Why 128+signum at all, then?** Because the two alternatives are both wrong: reporting 0
for a run that never returned, or reporting null ("no end observed") for an end that was
plainly observed. The convention keeps the two apart in the only direction the exit status
can express, and the honest sentence about it says what it cannot do.

**Why only the shell arm, stated as a boundary.** The glob and search rows carry no
payload exit code on their face and prove completion from the stream instead —
`alpha5-search-backend.test.ts` leg `P8b` pins exactly that law. They leave the flag
unset, so the argv they spawn with is unchanged byte for byte, and leg `X4` of the new
spec asserts in the same round that neither row grows an `exit=` or an `exitCode` key
anywhere on its wire. The flag is per-request, not per-launcher, which is what makes
that possible without a second launcher byte.

**Red lines the order set, and how they are held:** no blanket "failures return 0"; no
exit code ever inferred from stderr text; every code comes from the `waitpid` status.
`renderShellResult` and the host contract were not edited at all.

## Captures

* `red-pristine-104b4991.log` — the new spec against the base with the three edits
  stashed: **5 failed / 5 passed**. Red: `A2` (`expected +0 to be 3`), `A3`
  (`SIGTERM death must read 143 … expected +0 to be 143`), `A4` (`a terminated payload
  must not report success: expected +0 not to be +0`), `X1` (the recorded shape:
  `expected +0 to be 1` with `bash · exit=0` quoted in the message), `X3` (`exit 1
  must not be flattened or guessed: expected +0 to be 1`). Green in the RED run, and
  that is the point: `A1` (flag off keeps 0), `X2` (`true` → 0), `X4` (glob/search
  carry nothing), `X5` (timeout), `X6` (cancelled disclosure) — the controls and the
  anti-collateral legs never depended on the fix.
* `green-fixed.log` — same spec, edits applied: **10 passed**.
* `gates-plane-and-faces.log` — shell/search/glob + hygiene + wiring suites after the fix.
* `p4t6-red-unbooked.log` — master's scanner spec against this tree with the new file
  on disk and unbooked: `expected 1197 to be 1196`.
* `p4t6-green-booked.log` — after booking the one path by name: 10/10.
* `gates-provider-lane.log` — the provider lane after the edit (`a5lsp2-streaming`,
  `a5lsp2-assembly`, `a5p4-assembly-config`, `a5rbn-runtime-base-narrow`,
  `a5int-r3-mount-integration`): 5 files, 46/46.
* `gates-at-head.log` — the round's five face suites re-run AT THE COMMITTED HEAD
  (a5b2, glue7 shell, search, glob, glob-adversarial): 121/121.

## Bookings

`packages/testkit/test/p4t6-session-event-scan.test.ts`: one new module-scope list
`SCANNED_PATHS_A5B2` (`packages/runtime/test/a5b2-exit-code-fidelity.test.ts`), added
to both union sums and to the by-path presence list, with the tie
`expect(SCANNED_PATHS_A5B2.length).toBe(1197 - 1196)` and the leg-title sentence.
The pair is **measured on this tree**, not copied: 1196 was the int-r3 chain's booked
total here, and the RED read above is the evidence that the movement is exactly this
round's one file. The three production edits add no new scannable path (the launcher is
a `.py`, outside the scan; the provider `.ts` and the plane `.mjs` were booked by
earlier rounds).

**Launcher byte-pin:** no literal pin needed editing. Every holder recomputes it
(`alpha5-glob-harness.ts:27`, `alpha5-glue7-plane-backends.test.ts:41`,
`a5int-r3-mount-integration.test.ts:44`, `a5rbn-runtime-base-narrow.test.ts:37`,
`a5lsp2-assembly.test.ts:178`, `a5lsp2-streaming.test.ts:67`), and the natexe probe
scripts pass the hash they computed at run time — verified by running those suites
rather than by reading them. The only files carrying the pre-fix hash are historical
captures (`srgp/probes/coverage-measurements.json`, two `runtime-base-narrow` criteria
files, `glob-backend/parity-table.json`), which are records and stay untouched.

## Disclosed, not fixed

* **`cancelled` on this row is a literal `false`** (`plane-effect-backends.mjs`, the
  shell outcome — `:675` at the base), so the `bash · cancelled` line of
  `packages/tools/a5p5-tools/src/render.ts:183-184` has no path through this row and
  stays untested-by-construction. That is not a lie — the row has no cancel input, only
  its own timeout, and that reports `timedOut` with a null code — but whether the
  effect face should offer cancellation at all is a different semantic and belongs to
  that face, not to an exit-code ticket. Pinned as `X6` so the gap is written down
  rather than implied.
* **Provider `terminate()` is not cancellation.** Leg `A4` measures what it is: the
  payload dies of a signal and the mapped code lands in the 128 range, never 0, never
  null. Whether it was SIGTERM or the escalated SIGKILL depends on how the payload
  treats TERM, so the leg pins the range and reports the observed value rather than
  pretending the ladder is deterministic.
* **The bash wire argument is named `timeout` but carries milliseconds**
  (`args.ts:201` reads `timeout`, bounds `1..MAX_TIMEOUT_MS` with
  `MAX_TIMEOUT_MS = 600_000`, and hands it to `timeoutMs` unchanged; the row's default
  is `60_000`). `X5` therefore drives the timeout with `timeout: 1`, which is one
  millisecond. Renaming or re-scaling a shipped argument is a contract change and is
  not this ticket's to make; it is recorded because a reader of the leg would
  otherwise assume seconds.
