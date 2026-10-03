# The first bounded main rc2 real-host smoke after the reviewer patch — VERDICT FAIL, and why

Run: `logs/rc2-smoke-020rc2-r5.log`, evidence dir `rc2-smoke-run5/`, stamp
`2026-10-03T16-28-45`, head `65f07a26` (= reviewer patch `97efc2d6` + A8 correction).
One run, as authorized. `--host-port 3491 --mock-port 3496`, no `--keep`.

**Result: `VERDICT FAIL — 14/19 criteria passed; failed: S1a, S3b, S4c, S4e, S5b`, exit 2.**
This is **not** a host-compatibility PASS, and it is **not** a compaction diagnostic abort:
`run.log` contains no compaction dispatch at all (`grep -ci compact` → 0), so nothing was
masked by that path either.

## Containment behaved (measured, not asserted)

| | observed |
| --- | --- |
| model requests | **17** of the 120 total ceiling |
| max per session/purpose | 6 (`agent\|b99c5f44f9`) of 40 |
| max same-state repeats | 5 (`title\|9a162a451f\|0`) of the 6 `sameStateRepeats` ceiling — a near-limit worth watching, not a trip |
| budget violations / aborts | `history: []`; no `RUN CONTROL` abort record; no child-lifetime trip (cap 20 min, run took ~4 s of host life) |
| owned cleanup | `RUN CONTROL: owned process group stopped (pid=38)` → `teardown: stopping host + mock` → `world removed` |
| after the run | 0 listeners on 3180-3186 / 3491-3500; 0 kit/host/mock processes; `:3080` still the only 30xx listener (stable instance, probed `3080=401` before and after, never bound or written by me) |

The three older `tests/homes/rc2-smoke-*` worlds (14:16 / 14:29 / 14:41) are retained
evidence from the earlier killed runs; this run's world was removed.

## The five failures are the kit's own 0.1-envelope readers, not the host

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

Two independent proofs, not inference from the code:

1. `rc2-smoke-run5/s4-b-member-request.json` records `systemPrompt: ""` (len 0) for the B
   member request at seq 9 — while `mock-requests.json` for that same seq 9 shows the
   request arrived with the delegation marker, a runtime-context body and a reply
   (`RC2_MEMBER_DONE` family). The request existed; only the extractor was blind.
2. The criteria that used the generation-aware helper on the same run passed: **S4b**
   (`systemTextOf(leader)` → 4000-char persona, `hasB=true hasA=false`) and **S5c**
   (`systemTextOf(bMemberAgain)` → "B member keeps B persona"). Same run, same host, same
   member turns — the helper sees the persona, the inline filter does not.

This is the trap the repo already documents for f15 ("marker-driven oracles written for the
older wire counting `role:tool` messages loop forever on this baseline"); the kit's *waiters*
had been made generation-aware (`toolMsgsOf`), but six *assertions* had not.

## Fixed, without relaxing a single claim

`rc2-real-host-smoke.mjs` now routes all of them through the existing, generation-aware
readers — `toolResultTextOf()` (a thin join over `toolMsgsOf` + `wire-shape.toolResultText`)
for S1a/S2a/S3b/S4c, and `systemTextOf()` for S4e/S5b. The required substrings are unchanged:
probe content must still appear, `rc2-smoke` must still appear after the approval, the create
result must still show no reject, and member B must carry B's persona **and not** A's (C not
B's). No inline `role === 'tool'` / `role === 'system'` lookup remains in the kit. After the
change: 47/47 guard tests (`sanitize-evidence` + `run-control` + `runner-wiring` regressions),
24/24 wire-shape + fixture-invariants, `node --check` clean.

## What is still owed before anyone calls this suite green

- **A second bounded run is needed and was NOT taken** — one run was authorized and it is
  spent. The re-run must show 19/19 (or fail on something real) with the same containment
  envelope. Until then the 0.2 compatibility of the B/C persona binding, the post-approval
  execution path and the create-member path is **unmeasured**: this run neither proved nor
  disproved them, because the oracles that would have measured them were reading the wrong
  envelope.
- **Raw evidence is retained locally and NOT committed**: `rc2-smoke-run5/instance.log`,
  `instance-tail.txt`, `mock.log` and `mock-requests.json` carry the run's live web boot
  token. They stay under the evidence dir untracked until the (reviewer-patched) sanitizer
  produces the committed copy and `--verify` is read; no token-bearing file goes into the PR.
- The title-dispatch repeat count (5 of 6 allowed for one state key) deserves a look before
  any longer chain, where it would plausibly reach the ceiling.

## Measurement excerpt for independent review (added at `1720db2b`)

Because "trust my prose" is not a review basis, the run now also ships a
deterministic, credential-free excerpt:

- generator: `tools/run5-oracle-digest.mjs` (whitelist fields only; emits lengths,
  sha256 and marker-presence bits instead of text; scans its own output for
  boot-token / `?token=` / authorization / bearer / api-key shapes and exits 2
  without writing on any hit; no wall-clock, so re-running reproduces identical bytes)
- output: `rc2-smoke-run5/run5-oracle-digest.json`
  (sha256 `668ce17ab7fa784591a61388aa5d9ff2cb99eb8c2ef9252ed94a98570f9cb3ee`)

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
