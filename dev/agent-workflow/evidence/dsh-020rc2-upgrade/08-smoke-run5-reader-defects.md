# The first bounded main rc2 real-host smoke after the reviewer patch — VERDICT FAIL, and why

Run: `logs/rc2-smoke-020rc2-r5.log`, evidence dir `rc2-smoke-run5/`, stamp
`2026-10-03T16-28-45`, head `65f07a26` (= reviewer patch `97efc2d6` + A8 correction).
One run, as authorized. `--host-port 3491 --mock-port 3496`, no `--keep`.

**Result: `VERDICT FAIL — 14/19 criteria passed; failed: S1a, S3b, S4c, S4e, S5b`, exit 2.**
This is **not** a host-compatibility PASS, and it is **not** a compaction diagnostic abort:
`run.log` contains no compaction dispatch at all (`grep -ci compact` → 0), so nothing was
masked by that path either.

## Containment behaved — single-observer VM measurements, not independently reproduced

| | observed |
| --- | --- |
| model requests | **17** of the 120 total ceiling |
| max per session/purpose | 6 (`agent\|b99c5f44f9`) of 40 |
| max same-state repeats | 5 (`title\|9a162a451f\|0`) of the 6 `sameStateRepeats` ceiling — a near-limit worth watching, not a trip |
| budget violations / aborts | `history: []`; no `RUN CONTROL` abort record; no child-lifetime trip (cap 20 min, run took ~4 s of host life) |
| owned cleanup | `RUN CONTROL: owned process group stopped (pid=38)` → `teardown: stopping host + mock` → `world removed` |
| after the run | 0 listeners on 3180-3186 / 3491-3500; 0 kit/host/mock processes; `:3080` still the only 30xx listener (stable instance, probed `3080=401` before and after, never bound or written by me) |

**Provenance of this table:** every row is a measurement I took in this VM after the run
(`ss -ltnH`, filtered `ps -eo args`, `git status`, the kit's own `run-budget.json`), plus the
`:3080` probe. It is one observer on one machine and has **not** been reproduced by an
independent host or reviewer; treat the process/port rows as "reported by this VM", not as an
independently verified fact. `run-budget.json` is the strongest row because the kit wrote it
during the run rather than after it.

The three older `tests/homes/rc2-smoke-*` worlds (14:16 / 14:29 / 14:41) are retained
evidence from the earlier killed runs; this run's world was removed.

## The five failures sit on proven kit-side 0.1-envelope readers — which does not yet clear the host

Four of the five criteria read the transcript with a **literal 0.1.x envelope lookup**:

```js
body.messages.find(m => m.role === 'tool')?.content          // S1a, S2a, S3b, S4c
(body.messages ?? []).filter(mm => mm.role === 'system')      // S4e, S5b
```

The pinned host delivers tool results as **content parts nested inside `role:user`** and
carries the persona where `wire-shape.mjs`'s `systemText()` looks for it, not at
`role:'system'`. Both lookups therefore returned `''`, which is exactly what the log shows
(`result=` empty on S1a/S3b/S4c, `hasB=false hasA=false` on S4e, `hasC=false hasB=false` on
S5b) — an empty read reported as a product failure.

**What is proven here is the reader defect, not the product outcome.** The two
measurements below show that the expressions these criteria used return the empty string on
this host generation, so their FAILs carry no information about persona binding, the
post-approval execution path or create-member. They do **not** show that those dimensions
work, and they do not exclude a host-side problem underneath — the same run is equally
consistent with "reader blind" and "reader blind *and* the feature broken". Only a re-run
with corrected, call-identity-specific oracles can separate those, and none has happened.

Two measurements behind the reader claim, not inference from the code:

1. `rc2-smoke-run5/s4-b-member-request.json` records `systemPrompt: ""` (len 0) for the B
   member request at seq 9 — while `mock-requests.json` for that same seq 9 shows a request
   carrying the B delegation marker and answered with the canned `RC2_MEMBER_B_DONE`. So the
   member turn existed and the mock replied; what is NOT established is whether blueprint B's
   persona reached that model call, because the recorded string is the output of the broken
   extractor and the helper's output for that seq was never written to a file.
2. The criteria that used the generation-aware helper on the same run passed: **S4b**
   (`s1-b-leader-request.json` was written from `systemTextOf(bStart)` at kit line 1531 →
   4000 chars of persona, `hasB=true hasA=false`) and **S5c**
   (`systemTextOf(bMemberAgain)` → "B member keeps B persona"). Same run, same host, same
   member turns — the helper sees the persona, the inline filter does not.

This is the trap the repo already documents for f15 ("marker-driven oracles written for the
older wire counting `role:tool` messages loop forever on this baseline"); the kit's *waiters*
had been made generation-aware (`toolMsgsOf`), but six *assertions* had not.

## The replacement readers (still not a valid measurement)

`rc2-real-host-smoke.mjs` routes them through the existing generation-aware readers —
`toolResultTextOf()` (a join over `toolMsgsOf` + `wire-shape.toolResultText`) for
S1a/S2a/S3b/S4c and `systemTextOf()` for S4e/S5b. The required **substrings** are unchanged,
and no inline `role === 'tool'` / `role === 'system'` lookup remains (47/47 guard tests,
24/24 wire-shape + fixture-invariants, `node --check` clean).

**But the claim "assertions unchanged in strength" was wrong, and the independent reviewer
was right.** For the persona criteria `systemTextOf` is the intended single value, so those
are equivalent-in-intent. For the tool-result criteria it is not: joining every tool result
the request carries means S3b's and S4c's substring tests can be satisfied by an *earlier*
result inside the same request — by size, the joined strings are the request's whole carried
history (1 result for S1a's request at seq 5, 2 at seq 6, 3 for S3b at seq 7, and **4 for
S4c at seq 8**, whose earlier entries include S2's deny text). That is a route to a **false
pass**, i.e. a weaker oracle, not an equal one. Reading by call identity / expected result is
the correct fix and it belongs to the owner of the two frozen kit files; the reviewer patch
is pending upload. Until it lands and a run is executed, none of S1a/S2a/S3b/S4c counts as
measured — the replacement code is an improvement in the right direction, not a result.

## What is still owed before anyone calls this suite green

- **A second bounded run is needed and was NOT taken** — one run was authorized and it is
  spent. The re-run must show 19/19 (or fail on something real) with the same containment
  envelope. Until then the 0.2 compatibility of the B/C persona binding, the post-approval
  execution path and the create-member path is **unmeasured**: this run neither proved nor
  disproved them, because the oracles that would have measured them were reading the wrong
  envelope.
- **Raw evidence is retained locally and NOT committed.** Measured, not hedged: the live web
  boot token (`?token=…`) occurs in exactly two files, `rc2-smoke-run5/instance.log` and
  `instance-tail.txt`. `mock.log` and `mock-requests.json` contain only the run's *fixture*
  markers (`requestToken=rc2-…`, which the excerpt's credential scan does not flag), but all
  four stay untracked anyway until the (reviewer-patched) sanitizer produces the committed
  copy and its `--verify` output has been read line by line. No token-bearing file goes into
  the PR.
- **Request bodies are gone: `role`/content shape and tool-result content per seq are
  MISSING, and stay missing.** The mock recorder at `65f07a26` kept only
  `seq / receivedAt / userText(300 chars) / toolMsgCount / reply`, so this run cannot state
  the message shape of any request — including the two that the persona criteria depended on.
  Nothing in the excerpt reconstructs those shapes: no synthesized entries, no "would have
  been" rows, no re-derived bodies. If the shape matters, the recorder must persist a
  whitelisted body digest and a later run must capture it; that is a kit change belonging to
  the frozen-file owner.
- The title-dispatch repeat count (5 of 6 allowed for one state key) deserves a look before
  any longer chain, where it would plausibly reach the ceiling.

## Measurement excerpt for independent review (added at `1720db2b`)

Because "trust my prose" is not a review basis, the run now also ships a
deterministic, credential-free excerpt:

- generator: `tools/run5-oracle-digest.mjs` (whitelist fields only; emits lengths,
  sha256 and marker-presence bits instead of text; scans its own output for
  boot-token / `?token=` / authorization / bearer / api-key shapes and exits 2
  without writing on any hit; no wall-clock, so re-running reproduces identical bytes)
- output: `rc2-smoke-run5/run5-oracle-digest.json` (its sha256 is recorded in the commit
  that last regenerated it, not here — a regenerated digest must not be cited from prose that
  predates it)

Two revisions are named explicitly, because the run and the review lock are
different trees: the run executed at **`65f07a26`** (inline readers: role-tool at
lines 1545/1572/1620/1650, role-system at 1671/1714), while the reviewer locked
**`00a9a391`**, which already contains the reader replacement and therefore shows
zero inline sites and the `toolResultTextOf` / `systemTextOf` call sites instead.
The digest hashes both blobs and lists every family call site, plus the per-criterion
binding from each oracle id to the expression that produced its observation.

**Open review point, recorded as the reviewer's finding and not defended away:** the
replacement `toolResultTextOf` joins *every* tool result a request carries. With the
cumulative counts in the digest (10 by seq 9, 15 by seq 11) a criterion such as S3b or
S4c could be satisfied by an *earlier* result — including the S2 deny text — rather than
by the result it means to observe. Reading by call identity / expected result is the
correct fix, and the follow-up mixed-history regression is what proves it. That work
belongs to the owner of the two frozen kit files; this round changed neither file
(the digest records both as byte-identical to the locked head), and no second host run
was started.
