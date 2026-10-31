# PR-I1a — real-Host durability evidence (rounds 15–18, 2026-10-31)

Produced by `tests/kits/pr-i1a-real-host/pr-i1a-real-host.mjs` (driver) with
`tests/kits/pr-i1a-real-host/pri1a-probe-row.mjs` (probe row, mounted only through the public
`profiles/web/cordis.patch.yml` seam — the host tree is never patched; CORE PATCH BUDGET = 0).

Host: `tests/deepseek-harness-test-use`, pristine, detached @ `639ed015397290b3745d163aafe02ffee4aa3f84`
(0.2.0-rc.2, the pin in `tests/paths.mjs`), `DSH_HOME` inside this worktree at `tests/homes/<world>`,
ports 3182 / 3183 (validated against `TEST_PORT_RANGES` immediately before boot — see round 16), one
unique process marker per boot. Both worlds deleted at teardown; both ports free; host porcelain 0
before and after (each run records it in `capture.json`).

# Round 18 (fix round for review round 3: MINOR F-I1a3-1/2 + INFOs F-I1a3-4/5/6)

Headline — the green run at the bytes this round commits, `a6pri1a-2026-10-31T20-01-31Z`:

```
DSH-PRI1A-REALHOST verdict=pass pass=27 fail=0 refused=0 legs=27
```

(default port 3182, restart 3183, boot pids 37→49; one unique marker per boot, both worlds deleted at
teardown, `tests/homes/` empty, host porcelain 0 before and after, both ports validated against
`TEST_PORT_RANGES` immediately before any world existed.) Normalizing pid / argv0 marker / module nonce /
run-stamp / clock, that transcript differs from round 17's green transcript **only** in its `lane head`
line: no leg's assertion moved this round either — the work is in how a FAIL names what it graded, in
the self-test that guards it, and in committing the tooling that produced these files.

## F-I1a3-1 — an arm descriptor is a measurement, not a transcription

Round 17 located a driver conjunct by its own label but **transcribed** the offsets of the cross-file
descriptors: `{ file: PROBE_REL, anchor: …, from: 2, lines: 4 }` asserts "the arm starts two lines below
wherever that anchor matched today". That is a guess about the file's layout, and the reviewer's plant
proved what the guess costs: one comment line between the anchor and the arm it pointed past, and the
FAIL block quoted the **comment** as "the bytes it was graded from" while `--self-test` printed
`verdict=pass checks=30 problems=0`.

Reproduced here at the bytes this commit ships (`a6pri1a-2026-10-31T20-18-20Z`, via the harness now in
`mutation-harness/`): the planted line is

```
        // plant-A comment line that shifts the graded arm by one
```

inserted at `pri1a-probe-row.mjs:246` on top of the committed mut-payload hunk; the planted file hashes to
`7b242c4eadfec9f707dab607043ec1a582f76a689e3c83f7c21021d66256902e` — the same hash round 3 measured, so
the plant is byte-identical, not a paraphrase of it. The kit exits 1 with
`verdict=fail pass=26 fail=1 refused=0 legs=27 failed=boot-2-rows-are-boot-1-rows`, and the FAIL block now
quotes the graded arm at its **shifted** line — `pri1a-probe-row.mjs:247 writes: { created, replay,
transferred, retired }, rows,` — while the planted comment appears **nowhere** in the transcript (the run
asserts both, `--expect-regex` and `--expect-absent`; round 17 would have printed `:246`, the comment).

The fix is a **category rule**, so that no amount of future re-editing can silently reintroduce the old
behaviour, and it is not a re-transcription of the offsets:

* Every graded arm is registered once near the top of the driver by `bareQuote()` / `armDescriptor()` —
  anchor, span length, and **one signature per line of the span** (`ARM_REOPEN_PROBE`,
  `ARM_BOOT1_HANDOFF`, `ARM_BOOT2_HANDOFF`, `ARM_NEW_FAMILY_STEP`, `ARM_SELFTEST`). A descriptor claiming
  `lines: N` must carry N signatures; that is checked when the descriptor is built, not when it is used.
* `locate()` resolves a descriptor **together with** its offsets. Line k of the span must contain
  signature k, else the FAIL prints `…: <span drifted>` and
  `line N of this arm's L-line span does not contain its signature "…" — the arm moved or was rewritten;
  REFUSING to quote bytes it did not grade` — with no bytes quoted for that arm. A descriptor that carries
  a `from` offset is refused at grade time, the refusal printed where the bytes would have been.
* `--self-test` sweeps the registry: every descriptor must resolve **and** quote its own span, and two
  structural scans over the driver's code lines fail if any descriptor is hand-written inline
  (`file: DRIVER_REL|PROBE_REL`) or carries a `from:` offset. The scans read code lines only — a comment
  may mention those tokens without tripping them, which is stated where the scan is defined so the rule is
  about code and not about prose. **`checks=41 problems=0`** at these bytes
  (`a6pri1a-selftest-round18/selftest.txt`; round 17 measured 30, and every added check moves the exit
  code — the eleven additions are the sweep of each registered arm, its shifted-span refusals, and the
  two structural scans).
* The drift that cannot be absorbed is committed too: `a6pri1a-2026-10-31T20-18-42Z` plants a line
  **inside** a graded span, and the FAIL block prints the refusal and no bytes at all for that arm.
  Quoted correctly, or refused — those are the only two outcomes this instrument allows.
* **Not claimed (F-I1a3-3, left open on purpose).** `--self-test` grades its own machinery, not its own
  meaningfulness: an assertion emptied to a constant `true` still passes. 41 checks narrow that class and
  do not close it; nothing in this section says otherwise.

## F-I1a3-4 — "the bytes it was graded from" means ARM bytes, and only arm bytes

The FAIL header now says it in the transcript rather than in prose: `each quotes the ARM bytes it was
graded from (arm bytes only — an arm's own inputs are not quoted, so a mutation of an input reddens the
leg with these bytes pristine)`. That limit is demonstrated, not asserted:
`a6pri1a-2026-10-31T20-19-04Z` mutates the arm's **input** one line above the span
(`const previousBootPid = Number(config.previousBootPid)` → `Number(0)`) and the leg reddens with the arm
quoted unchanged — `pri1a-probe-row.mjs:260 const freshProcess = Number.isInteger(previousBootPid) &&
previousBootPid > 0 && previousBootPid !== process.pid`. So a FAIL's quote is evidence about the arm that
decided the verdict; it is not a dump of everything the verdict depends on, and it should not be read as
one. (Round 17's wording, "the source bytes of that line", was not wrong but was unscoped, which is what
let the mut-seq transcript read as though it quoted the probe's whole computation.)

## F-I1a3-2 — every leg-name-to-file attribution re-checked, the pattern treated as the finding

Three published attributions in this PR have now been wrong, all of them the same mistake — a **leg name**
quoted correctly and filed under a **test file** chosen from memory. The re-check grepped each quoted leg
name against `packages/*/test/*.ts` at these bytes:

| leg name as published | file published | file where it actually is | verdict |
| --- | --- | --- | --- |
| `the client lane runs, and no failure appears outside the disclosed baseline` | `packages/testkit/test/p4t6-session-event-scan.test.ts` | `packages/testkit/test/a4p7-merge-gate.test.ts:1694` | **was wrong — corrected below and in a new dated log entry** |
| `refuses the leg, by name, when the host module closure cannot be traversed` | `packages/testkit/test/a4p7-merge-gate.test.ts` | `packages/testkit/test/a4p7-merge-gate.test.ts:1137` | correct, now given a line anchor |
| `is green, asserted by arm name and by absence of a skip — never by the exit code` | (unnamed in prose: "a *different* a4p7 leg") | `packages/testkit/test/a4p7-merge-gate.test.ts:837` | correct, now named and anchored |

Non-attributions checked and left alone, because inventing a correction would be its own error: the
battery row `packages/testkit/test/p4t6-session-event-scan.test.ts | 20` is a **file** in the nine-file
battery (it has 20 tests), not a leg attribution; the memo attributes the two red legs to "两条 a4p7 腿"
and never to a wrong file; `boot-1-lock-was-serialised` is a **kit leg** id
(`tests/kits/pr-i1a-real-host/pr-i1a-real-host.mjs:696`), not a vitest test, and no document claims
otherwise. `p4t6-session-event-scan.test.ts` never mentions the client lane at all — the published
attribution had no basis in the file it named.

## F-I1a3-5 — the two unusable round-17 runs, stated accurately

The sentence these two directories used to carry read: "both were **deleted before this commit** — nothing
in this README, the memo or the log refers to them." That was self-contradicting: the sentence is itself a
reference, and the round-17 log entry describes both. Corrected where it was published (see the dated
correction under the round-17 section) to: they are **not cited as evidence** anywhere — no claim in this
PR, the memo or the log rests on either run's transcript.

## F-I1a3-6 — the mutation harness is committed beside the transcripts it produced

`mutation-harness/` holds the version of the harness that actually ran these round-18 transcripts
(`mutrun.sh`, `law.mjs`, `diff-lines.mjs`, `plants/*.mjs`) plus its own README: the METHOD LAW as
executable steps, the exit code each refusal returns, the re-run commands, and the disclosed ceiling.
Round 17 described the law in prose and left the tool in a scratch directory — which is how the round's
own first incident happened, and why prose is not the deliverable. It emits the same
`MUTATION-METHOD-LAW.txt` shape the earlier committed reds use (and now writes `MUTATION.diff` next to it
when the mutation is a committed hunk), so a transcript from 20-06 and one from 20-13 stay comparable.

## Round-18 run directories

| directory | what it grades | verdict line |
| --- | --- | --- |
| `a6pri1a-2026-10-31T20-01-31Z` | **the measurement run at the committed kit bytes** | `…verdict=pass pass=27 fail=0 refused=0 legs=27` |
| `a6pri1a-2026-10-31T20-12-18Z` | **mut-seq** re-run at these bytes by the committed harness | `…failed=boot-2-new-family-continues-the-chain` |
| `a6pri1a-2026-10-31T20-12-40Z` | **mut-pid** re-run | `…failed=boot-2-reopened-in-a-fresh-process` |
| `a6pri1a-2026-10-31T20-13-02Z` | **mut-payload** re-run | `…failed=boot-2-rows-are-boot-1-rows` |
| `a6pri1a-2026-10-31T20-13-24Z` | **mut-driver-pid** re-run (driver-side arm) | `…failed=boot-2-reopened-in-a-fresh-process` |
| `a6pri1a-2026-10-31T20-18-20Z` | **plant A** — the reviewer's F-I1a3-1 plant, byte-identical | `…failed=boot-2-rows-are-boot-1-rows`, arm quoted at its shifted line |
| `a6pri1a-2026-10-31T20-18-42Z` | **plant B** — a line inside a graded span | `…failed=boot-2-reopened-in-a-fresh-process`, arm **refused** |
| `a6pri1a-2026-10-31T20-19-04Z` | **plant C** — arm's input mutated, arm pristine (F-I1a3-4) | `…failed=boot-2-reopened-in-a-fresh-process`, arm quoted pristine |
| `a6pri1a-selftest-round18` | not a run — `--self-test` at these bytes | `DSH-PRI1A-REALHOST-SELFTEST verdict=pass checks=41 problems=0` |
| `a6pri1a-port-band-refusals-round18` | not a run — the six refused ports re-measured | six × `verdict=port-refused`, every `rc=2`, `tests/homes` empty |

Each red directory carries `MUTATION-METHOD-LAW.txt`: pin refusal, the planted bytes in angle brackets,
the pre-diff's own bytes when the plant sits on a committed hunk, census before / after / **predicted from
the declaration**, the whole-file rebuild line, `node --check`, the kit verdict and named leg, the stated
reason and stated absence, then the restore with its sha256, byte `cmp` and `node --check`. Eight
directories produced earlier in this round, by revisions of this harness or its plant scripts that were
still being fixed, were moved out of this directory **before** the commit, into this worktree's gitignored
scratch (`.artifacts/alpha6-s0/pri1a-fix3/superseded-run-dirs/`), and are not part of the repository:
`…T20-06-52Z` / `…T20-07-26Z` / `…T20-07-48Z` / `…T20-08-15Z` (the first pass of the four hunks, superseded
by the four re-runs above); `…T20-09-57Z` (a plant-A attempt run before `--expect-absent` existed — it
failed its own rc=85 assertion); `…T20-10-56Z` / `…T20-11-23Z` / `…T20-11-49Z` (the first plant runs, whose
scripts echoed their own `planted:` line, duplicating the law's declaration line closely enough to be
misread as two planted bytes — a plant script now reads the planted line back off the disk and fails the
run if it is not what was declared). Nothing committed was rewritten or removed.

## Gate measurements at the round-18 bytes

`pr-i1a-real-host.mjs` `ba03e7d65740e317322d897190c1ca4e7fea4ae9fb8c3a272d3d3ddff2a4496d` (905 lines;
changed: registered arm descriptors, the two refusals, the widened self-test); `pri1a-probe-row.mjs`
`40528066b6508473565acffc8a66b66c1a1e75b67305d980ece80c5df0b83ebd` — **byte-identical to the round-15 pin**
(313 lines + trailing newline; re-measured after the last mutation restored, and quoted here precisely so
that "unchanged" is checkable rather than asserted). Every run in the table above ran on bytes carrying
these hashes.

Writer spec `Tests 49 passed (49)`; runtime typecheck exit 0; the named nine-file battery
`Tests 2 failed | 317 passed (319)` with **both red legs named, never counted** —
`refuses the leg, by name, when the host module closure cannot be traversed`
(`packages/testkit/test/a4p7-merge-gate.test.ts:1137`) and
`the client lane runs, and no failure appears outside the disclosed baseline`
(`packages/testkit/test/a4p7-merge-gate.test.ts:1694`) — see F-I1a2-6 above for why the total is not a
fingerprint, and F-I1a3-2 above for why the file anchors are given. `node scripts/docs-sync.mjs --check`
and `node scripts/eb3-evidence-guard.mjs --new-since HEAD~1` are quoted in the round-18 report.
`packages/**` is untouched this round: `git status --porcelain` over `packages/` is empty.

# Round 17 (fix round for review round 2: MINOR F-I1a2-1 + the cheap INFOs F-I1a2-2/4/5/6)

Headline — the green run at the bytes this round commits,
`a6pri1a-2026-10-31T18-32-44Z`:

```
DSH-PRI1A-REALHOST verdict=pass pass=27 fail=0 refused=0 legs=27
```

(`--port 3182`, restart 3183, boot pids 37→49; both worlds deleted, `tests/homes/` empty at teardown,
host porcelain 0 before and after, ports validated against `TEST_PORT_RANGES` in-run.) Leg count is
unchanged at 27 and the PASS lines of the three legs this round reworked are byte-identical to
round 16's apart from the run-varying pid / argv0 marker / module nonce — the fix is in the FAIL
branch and in the tooling around the runs, not in what a green run asserts.

## F-I1a2-1 — a FAIL now prints WHAT IT GRADED, and the committed hunk shows the mutated arm

`check()` takes a fourth argument: the list of CONJUNCTS the leg evaluated. On FAIL it prints every
one of them — which side of the instrument computed it (`[probe]` or `[driver]`), the `file:line` it
was graded from, the values each side produced, and the **source bytes of that line, read from disk
during this run** (round-18 scoping, F-I1a3-4: *the arm's* bytes and only the arm's — an arm's own inputs
are never quoted, so a mutation of an input reddens the leg with the printed bytes pristine; the header
line of a FAIL says so in the transcript itself). The reopen-identity leg carries 9 conjuncts, the rows
leg 2, the continue-chain leg 2; every other leg keeps its 3-argument call, which is why the leg count
did not move.

The `file:line` is not transcribed — `locate()` finds the arm in the kit bytes at grade time and
requires exactly one match. A driver conjunct is located by its own label (which must therefore be
unique in this file); a cross-file quote names its anchor explicitly. Zero matches or several matches
print `<anchor matched N lines, not 1 — this quote is NOT the graded arm>` instead of quoting
something plausible. Two consequences were learned by writing them down: an anchor literal written on
a *different* line than its arm matches both lines (so cross-line quotes only ever point at the
probe), and a comment that mentions an anchor breaks its uniqueness.

> **Round-18 correction (F-I1a3-1).** The paragraph above is true of the *anchor*, and this round found out
> the hard way that it was not true of the whole coordinate: the cross-file descriptors added offsets by
> hand (`from: 2`), and an offset is a transcription of yesterday's layout, not a measurement taken at
> grade time. One planted comment line was enough for the FAIL block to quote the wrong bytes while this
> section's own `--self-test` stayed green. Fixed as a category rule in round 18 — see **F-I1a3-1** above;
> the paragraph is kept as it was written because it records what round 17 actually measured.

`node tests/kits/pr-i1a-real-host/pr-i1a-real-host.mjs --self-test` grades this machinery without
booting anything — 30 assertions, `DSH-PRI1A-REALHOST-SELFTEST verdict=pass checks=30 problems=0`,
transcript in `a6pri1a-selftest-round17/selftest.txt`. It is not a leg: no world, no port, nothing
about the writer is measured there. It exists because a claim like "a FAIL prints what it graded"
must be measured, and writing it caught two bugs in the first draft. **Round-18 note:** 30 was honest for
round 17 and insufficient — none of those 30 checks resolved a descriptor together with its offsets, which
is why the plant above slipped through at `checks=30 problems=0`. The same command now measures 41
(`a6pri1a-selftest-round18/selftest.txt`).

## Round-17 run directories

| directory | mutated arm, named | verdict line |
| --- | --- | --- |
| `a6pri1a-2026-10-31T18-32-44Z` | **the measurement run at the committed kit bytes** | `…verdict=pass pass=27 fail=0 refused=0 legs=27` |
| `a6pri1a-2026-10-31T18-39-14Z` | **mut-pid** — probe side, `pri1a-probe-row.mjs:260`, `previousBootPid !== process.pid` → `process.pid !== process.pid` | `…verdict=fail pass=26 fail=1 refused=0 legs=27 failed=boot-2-reopened-in-a-fresh-process` |
| `a6pri1a-2026-10-31T18-39-38Z` | **mut-driver-pid** — driver side, `pr-i1a-real-host.mjs:663`, `p2?.pid === host2.spawnPid` → `host1.spawnPid` | `…failed=boot-2-reopened-in-a-fresh-process` |
| `a6pri1a-2026-10-31T18-40-00Z` | **mut-payload** — probe side, `pri1a-probe-row.mjs:299` (boot 2's handoff line), `rows,` → `rows: rows.map(row => ({…payload:{…assignmentEpoch: 99}})),` | `…failed=boot-2-rows-are-boot-1-rows` |
| `a6pri1a-2026-10-31T18-40-22Z` | **mut-seq** — probe side, `pri1a-probe-row.mjs:290`, the step **predicate** `fresh.sequence === previousMax + 1` → `+ 2` | `…failed=boot-2-new-family-continues-the-chain` |
| `a6pri1a-selftest-round17` | not a run — `--self-test` output at these bytes | `DSH-PRI1A-REALHOST-SELFTEST verdict=pass checks=30 problems=0` |
| `a6pri1a-port-band-refusals-round17` | not a run — the six refused ports re-measured at these bytes | six × `verdict=port-refused`, every `rc=2`, `tests/homes` empty |

Each of the four red directories now contains **`MUTATION.diff`** (the `diff -u` of the mutated file,
worktree-relative labels) and **`MUTATION-METHOD-LAW.txt`** (the exact bytes changed, the FROM arm's
occurrence count and line number, delimiter/quote/marker/line/byte counts before and after with the
expected delta, `node --check` on the mutated bytes, the kit verdict, the restore sha256 and `cmp`).
Red transcripts before this round were unfalsifiable in one specific way: they printed the *values*
the leg narrated. Under mut-driver-pid the narration still says `reported=268 spawned=268` —
self-consistent and misleading — while the quoted bytes say
`conjunct('driver', 'boot-2 self-reported pid equals the pid this driver spawned', p2?.pid === host1.spawnPid,`.
That gap is what this round closes.

What each transcript demonstrates, arm by arm:

* **mut-pid** — one RED, `[probe] pri1a-probe-row.mjs:260`, quoting `process.pid !== process.pid`;
  all eight driver conjuncts print `ok`. The probe's own predicate is the only arm that broke.
* **mut-driver-pid** — one RED, `[driver] pr-i1a-real-host.mjs:663`, quoting `=== host1.spawnPid`,
  while the probe step prints `ok`. The probe cannot see this mutation; only the driver arm can.
* **mut-payload** — the handoff line quoted at `pri1a-probe-row.mjs:299` shows the mutated `.map(…
  assignmentEpoch: 99 …)`, and the FAIL line names `FIELD PATH rows[0].payload.assignmentEpoch:
  boot 1 1 vs boot 2 99` (F-I1a2-2). The row-count leg (`boot-2-rows-survived-the-restart`, 3 rows
  read back) and the durable replay / generation legs stayed green — only the byte-identity leg bit.
* **mut-seq** — RED is `[probe] pri1a-probe-row.mjs:290`; the quoted 4-line window shows the
  predicate reading `+ 2` **two lines away from** the `expected: previousMax + 1` that the probe's
  measured JSON still reports. So the red and the reported expectation genuinely disagree, and the
  quote is what shows why.

**Claim deleted rather than kept.** Round 16 described mut-seq as "probe expected value mutated
`previousMax + 1`→`+ 2`". Its own transcript contradicts that wording: the measured JSON reports
`"expected":4`, so what was mutated was never the expected value. The reproducible statement is
`pri1a-probe-row.mjs:290`, the step's **predicate** side, and that is what this round re-ran and
committed the hunk for. Round-16's four red directories stay for the append-only log's sake, but their
mutations are **undemonstrated** — no hunk was committed with them, and this round could not
reconstruct them from the repository (see the correction under the round-16 table).

## F-I1a2-2 — the rows FAIL names the row and field

The 400-character-per-side truncation stays (a 3-row ledger dump would swamp the transcript), and in
front of it the FAIL now prints the first difference it can locate: `FIELD PATH
rows[2].payload.assignmentEpoch: boot 1 1 vs boot 2 99`, `row COUNT: boot 1 handed back 3 row(s),
boot 2 2 row(s)`, `rows[1].createdAt: absent in boot 2 (present side "t")`, or — since the leg grades
a `JSON.stringify` equality, which grades key order — `every value matches and the KEY ORDER differs
(boot 1 … vs boot 2 …)`. If nothing differs it says so and calls that a fault in the instrument,
rather than inventing a difference. `--self-test` asserts each of these shapes.

## Method-law incident, disclosed because it changed what was measured

The first version of this round's mutation harness computed the expected byte delta wrongly, tripped
its own assertion and exited **with the probe still mutated**. Two runs inherited that mutation
before it was noticed: `a6pri1a-2026-10-31T18-34-06Z` (which failed the reopen leg for a reason that
was not the mutation it claimed) and `a6pri1a-2026-10-31T18-34-30Z` (three failed legs at once).
Neither is citable, neither was committed, and both were **deleted before that commit** — they are **not
cited as evidence** anywhere: no claim in this README, the memo or the log rests on either run's
transcript. The harness was rewritten to (a) refuse to touch
bytes whose sha256 is not the pinned one, and (b) restore on every exit path including a failed
assertion; the four transcripts committed here were produced by that version, each verifying its own
restore before the next mutation started.

> **Round-18 correction (F-I1a3-5).** This paragraph published the last sentence as "both were **deleted
> before this commit** — nothing in this README, the memo or the log refers to them", which is
> self-contradicting: the sentence is itself a reference to them, and the round-17 log entry names both
> directories. What is true, and what the sentence now says, is the weaker claim that can actually be
> checked — the two runs are not **cited as evidence** by any claim in this PR.

## Gate measurements at the round-17 bytes

`pr-i1a-real-host.mjs` `5376fd21dde5b8ae0b3d8f85a10604cd879cbb67eea28b92a7095d1b9ee380b4` (changed:
graded conjuncts, the row locator, `--self-test`); `pri1a-probe-row.mjs`
`40528066b6508473565acffc8a66b66c1a1e75b67305d980ece80c5df0b83ebd` (**unchanged** since round 15 —
this round touched the driver only, and the pin is quoted to show that). Both hashes were re-measured
after the last mutation restored, and every run above ran on bytes carrying them.

Writer spec `Tests 49 passed (49)`; runtime typecheck exit 0; nine-file battery
`Tests 2 failed | 317 passed (319)` with the two disclosed legs named (see the next two sections for
why the number alone is not a fingerprint); `git status --porcelain` over `packages/` empty — no
production source moved.

## F-I1a2-5 — what lint did NOT cover

`npx eslint tests/kits/pr-i1a-real-host/pr-i1a-real-host.mjs tests/kits/pr-i1a-real-host/pri1a-probe-row.mjs`
at these bytes prints, for each file, `0:0 warning File ignored because of a matching ignore pattern`
and exits 0. **Both kit files match an eslint ignore pattern, so lint never read the instrument**: any
statement that "lint covered the kit" is false, and no claim in this PR should be read that way. What
covers these two files is `node --check` (syntax only), the kit's own `--self-test`, and the runs
above. Where a lint figure is quoted for this PR, it covers `packages/**` sources and specs only.

## F-I1a2-6 — the aggregate is not a fingerprint of the two red legs

`node scripts/docs-sync.mjs --check` at this tree prints, quoted verbatim (exit 0) instead of being
paraphrased into prose figures:

```
docs:sync --check: docs=105 notes=4 plans=68(0 declaring) findings=0 blocking=0 contracts=20 pairs compared
AUTHORITY_SOURCE_BINDING {"kind":"authority-pointer","pointer_file":"dev/engineering/current-authority.json","snapshot_file":"dev/engineering/authority-snapshots/as20261026r1.json","snapshot_version":"as20261026r1","content_digest":"sha256:93692d7aeb3b097c3b3467e0a9207f1da5f05c2c1cb324c74d25168b1516a4d4","pointer_digest_verified":true,"view_may_not_reverse_decide_authority":true}
LIMIT complete static check: no C1/C2/C3, no security negative, no runtime behaviour proof
```

and the `Tests 2 failed | 317 passed (319)` figure is **not** a fingerprint of the two disclosed legs.
Measured in this worktree at these bytes by moving the gitignored `packages/client/dist` aside
(`.gitignore` line 34 `dist/`; 404 files; fingerprint of the sorted file list restored and verified
afterwards, `git status --porcelain` over `packages/` empty), the same two test files still answer
`2 failed` — but the red pair is
`is green, asserted by arm name and by absence of a skip — never by the exit code` together with
`the client lane runs, and no failure appears outside the disclosed baseline`, i.e. a *different*
a4p7 leg is red for a *different* reason (the absent build output, not the un-traversable closure).
Any fresh clone lands in that second state. So the two published **names** are load-bearing and the
totals are not: `refuses the leg, by name, when the host module closure cannot be traversed`
(`packages/testkit/test/a4p7-merge-gate.test.ts:1137`) and
`the client lane runs, and no failure appears outside the disclosed baseline`
(`packages/testkit/test/a4p7-merge-gate.test.ts:1694`) — quote these, not the counts.

> **Round-18 correction (F-I1a3-2).** This paragraph published the second leg as living in
> `packages/testkit/test/p4t6-session-event-scan.test.ts`. It does not live there — that file never
> mentions the client lane, and the leg is `packages/testkit/test/a4p7-merge-gate.test.ts:1694`. The same
> wrong file was published in this PR's round-17 entry in `SESSION_ROUTER_LOG.md` (line 7567); the log is
> append-only, so the correction there is a new dated entry rather than an edit of that line. Both legs
> now carry line anchors, and every other leg-name-to-file attribution in this README and in the memo was
> re-grepped at these bytes — the results, including the non-errors that were left alone, are in the
> F-I1a3-2 table above. The pattern, not the single slip, is the finding: three published attributions in
> one PR were leg names quoted correctly and filed under a path chosen from memory, so from this round on
> an attribution is written only with the `file:line` the grep returned.

# Round 16 (fix round for review round 1: MINOR F-I1a1-1/2/3 + INFOs)

The kit grew 24 → 27 legs. What changed in the instrument, and where each claim's evidence lives:

1. **F-I1a1-1 — the reopen leg is a real predicate.** The probe records its own kernel identity
   (`process.pid`, `process.argv0`, a per-boot UUID nonce) in both reports; the driver hands boot 2 the
   pid + argv0 marker IT SPAWNED for boot 1, the probe asserts its identity differs, and the driver
   cross-grades every reported identity against its own spawn records. Four `step(id, true, …)`
   constants are gone: `real-seam-built`, `domain-created-real-medium` and `domain-closed` became
   observed predicates AND gained driver legs (`boot-1-real-seam-built`,
   `boot-1-domain-created-on-real-medium`, `boot-1-domain-closed-clean` — the "+3 legs");
   `domain-reopened-fresh-process` became the pid/argv0 comparison described here.
2. **F-I1a1-2 — every port source is validated against `TEST_PORT_RANGES`** (the sanctioned bands
   3180-3199 / 3491-3500 / 13000-13099 in `tests/paths.mjs`): the candidate defaults, an explicit
   `--port`, and the derived restart port — refused naming the bands (exit 2 `verdict=port-refused`)
   before any world exists, and re-asserted inside `bootWorld` immediately before each spawn.
   Transcript: `a6pri1a-port-band-refusals/port-refusals.txt` (six refused values — 45678, 3080,
   3180, `abc`, 3179, 13200 — every one rc=2, `tests/homes` empty afterwards).
3. **F-I1a1-3 — the cross-boot comparison is FULL rows.** Both boots hand back every field
   `ledger.list()` returns, `payload` included (writer `LedgerEntry`,
   `packages/storage/schema/ledger.ts`), and the driver compares the full-row JSON. The claim in the
   PASS line now says FULL rows and additionally cites the transitive guarantee: a payload the shipped
   fold cannot reconcile answers `REVIEW_ASSIGNMENT_WRITE_FOLD_UNRECONCILED`
   (`packages/runtime/review-assignment/writer.ts`, the fold-unreconciled refusal) instead of replaying.
4. **INFO — the disk leg names the files it scanned** (in `MEASURED-LINES.txt` and in
   `capture.json` `disk.scannedFiles`); this round scanned `.anonymous-user-id`, `.credentials.yaml`,
   `storages/team_domain.json`, `storages/workspace.json` (4 files) with hits only in
   `storages/team_domain.json`.
5. **INFO — the continue leg grades the EXACT expected sequence** (`previousMax + 1`, asserted by the
   probe with `expected` in its measured JSON and re-derived by the driver from boot 1's rows), not
   merely `> previousMax`.

## Round-16 run directories

| directory | what it is | verdict line (inside `MEASURED-LINES.txt`) |
| --- | --- | --- |
| `a6pri1a-2026-10-31T16-51-03Z` | **the round-16 measurement run at the committed kit bytes** (`--port 3182`; restart 3183; boot pids 36→48) | `DSH-PRI1A-REALHOST verdict=pass pass=27 fail=0 refused=0 legs=27` |
| `a6pri1a-2026-10-31T16-52-50Z` | expected red — **mut-pid**: probe reopen predicate mutated to `process.pid !== process.pid` (compares the pid to ITSELF, always false) | `DSH-PRI1A-REALHOST verdict=fail pass=26 fail=1 refused=0 legs=27 failed=boot-2-reopened-in-a-fresh-process` |
| `a6pri1a-2026-10-31T16-54-26Z` | expected red — **mut-driver-pid**: driver cross-grade mutated `host2.spawnPid`→`host1.spawnPid` (compares boot 1's spawn pid to ITSELF); the probe step itself still said PASS, the driver-side grade reddened it alone | `DSH-PRI1A-REALHOST verdict=fail pass=26 fail=1 refused=0 legs=27 failed=boot-2-reopened-in-a-fresh-process` |
| `a6pri1a-2026-10-31T16-54-55Z` | expected red — **mut-payload**: boot 2's reported rows mutated to carry `assignmentEpoch: 99`; only the FULL-row identity leg reddened — proving payload bytes are now compared, while the count leg and the durable replay/fold stayed green | `DSH-PRI1A-REALHOST verdict=fail pass=26 fail=1 refused=0 legs=27 failed=boot-2-rows-are-boot-1-rows` |
| `a6pri1a-2026-10-31T16-55-23Z` | expected red — **mut-seq**: probe expected value mutated `previousMax + 1`→`+ 2`; the durable chain handed out 4 and the probe's own predicate (driver side still `+ 1` and still satisfied) reddened the continue leg — **wording corrected by round 17: the arm actually mutated was the step PREDICATE at `pri1a-probe-row.mjs:290`, not the reported expected value (which is why the transcript says `expected: 4` while the leg is red); round 17 re-ran this mutation with the hunk committed** | `DSH-PRI1A-REALHOST verdict=fail pass=26 fail=1 refused=0 legs=27 failed=boot-2-new-family-continues-the-chain` |

Each mutation was one localized edit; its exact bytes were printed with `diff -u` against a
pre-mutation backup (plus `cmp -l` for the one-byte cases) and the structure was asserted before the
run; after each run the file was restored and verified with `diff -q` and sha256 against the backup
(`pri1a-probe-row.mjs` `40528066b6508473565acffc8a66b66c1a1e75b67305d980ece80c5df0b83ebd`,
`pr-i1a-real-host.mjs` `1e34a06880b478b35725ebe02a76452e2ac64fa635a830bc19409d80dd127e42`). The
green run above ran on exactly those restored bytes (same hashes before and after the mutation runs),
so the PASS record and the four red records grade the same instrument. The mutation itself is not
part of the committed kit — these four transcripts are kept so the PASS is falsifiable per the
three-arm rule (`docs/plans/memo/alpha6-review-separation/pri1a-writer-design-20261031.md` §2b R-28).

**Corrected by round 17, because two sentences above overstate what was published.** The `diff -u`
outputs were printed into the fix session and were **never committed**, and no other file in the
repository records the four round-16 hunks — so a reviewer holding only this commit cannot reproduce
any of the four round-16 reds, and cannot check the descriptions against anything. They are therefore
**undemonstrated**, not disproved, and the falsifiability claim for this PR now rests on the
round-17 directories, each of which carries its own `MUTATION.diff`. The `pr-i1a-real-host.mjs` hash
quoted above is the round-16 byte state and is no longer the committed state (round-17 pins are in
the round-17 section); `pri1a-probe-row.mjs` is byte-identical to it.

**Disclosure, same shape as round 15:** each run's `capture.json` records `laneHead` at the worktree
HEAD *before this fix commit* (`9dd6ff48c`) — a single commit cannot contain its own sha. The kit
bytes inside the commit are byte-identical to the bytes these runs measured (sha256 above).

## Battery composition wherever the number 319 is claimed

The nine-file regression battery, run with the root `vitest` over exactly these files —
`Tests 2 failed | 317 passed (319)`, `Test Files 1 failed | 8 passed (9)`; the two failures are the
disclosed a4p7 reds (`refuses the leg, by name, when the host module closure cannot be traversed`,
`the client lane runs, and no failure appears outside the disclosed baseline`), unrelated to PR-I1a:

| file | tests |
| --- | --- |
| `packages/runtime/test/a6-pri1a-writer.test.ts` | 49 |
| `packages/testkit/test/a4p7-merge-gate.test.ts` | 35 |
| `packages/runtime/test/a6-pr2-assignment-kernel.test.ts` | 69 |
| `packages/runtime/test/a6-pr3-wake-kernel.test.ts` | 76 |
| `packages/runtime/test/a6-pr2-lane-hygiene.test.ts` | 29 |
| `packages/testkit/test/p4t6-session-event-scan.test.ts` | 20 |
| `packages/runtime/test/a6-pr3-lane-hygiene.test.ts` | 16 |
| `packages/runtime/test/a6-pr0-lane-hygiene.test.ts` | 14 |
| `packages/runtime/test/a4pr0a-fact-type-closed-set.test.ts` | 11 |

# Round 15 (original round — kept verbatim as history)

## What these two directories are

| directory | what it is | verdict line (inside `MEASURED-LINES.txt`) |
| --- | --- | --- |
| `a6pri1a-2026-10-31T15-46-00Z` | the measurement run | `DSH-PRI1A-REALHOST verdict=pass pass=24 fail=0 refused=0 legs=24` |
| `a6pri1a-2026-10-31T15-46-27Z` | **an expected red, kept on purpose** | `DSH-PRI1A-REALHOST verdict=fail pass=23 fail=1 refused=0 legs=24 failed=boot-1-sequence-chain-is-1-2-3` |

Round-15 note, corrected by round 16: the round-15 reopen leg graded a probe step that recorded the
literal `true`, and the cross-boot comparison covered a six-field projection, not full rows. Both are
fixed as described above; the round-15 bullets below describe what that instrument DID measure and
the claims that stay unchanged.

The second directory is **not a regression**. It is the falsifiability proof for the first one: the
single byte `3` in the expected sequence-chain literal `'1,2,3'` was changed to `'1,2,4'`
(`tests/kits/pr-i1a-real-host/pr-i1a-real-host.mjs`, the `boot-1-sequence-chain-is-1-2-3` check), the
kit was re-run against a fresh world, the leg went red and the run exited 1. The file was then
restored and compared against a pre-mutation backup with `diff -q` (identical). A gate that cannot
produce this transcript is not a gate — see the three-arm rule recorded in
`docs/plans/memo/alpha6-review-separation/pri1a-writer-design-20261031.md` §2b R-28.

## What the pass run measured (graded C2, first time for this PR)

Two separate host processes over one world, driving the **built** writer
(`packages/runtime/dist/…/review-assignment/writer.js`) over the host's own `storageDomain` /
`LedgerRepository` / `TeamSessionsRepository` (opened through
`packages/runtime/root-binding/harness/seam.mjs`):

* `review-assignment-created` @ sequence 1 / epoch 1, `-transferred` @ 2 / 2, `-retired` @ 3 / 3.
* in-process replay of the first command → `{"applied":"already","sequence":1}` (no new row).
* `team_sessions.generation` 1 → 4 across the three durable writes; the replay advanced none.
* after the host process exited, the driver scanned the world's files on disk and found each of the
  three fact-type literals inside `storages/team_domain.json` (the probe's own report and the host
  logs are excluded from that scan by name, so the leg cannot be fed by the probe's own words).
* a second host process reopened the same domain: three rows byte-identical to boot 1, generation
  still 4, replay still `already` **at the original sequence**, zero new rows, and a fresh
  `approvalCaseId` continued the chain at sequence 4.
* injected per-root lock: `acquires=4`, peak depth 1.

## What it does NOT claim

`launcher: ABSENT` on this host and this lane has zero production callers, so the probe row is the
only writer in these boots and the production `dsh-agent-team` row is deliberately absent (its
`team_domain` can be opened once per process). Therefore nothing here grades: real-host **concurrent**
reconciliation (single writer here; cross-process lock provisioning is PR-I1b's adapter decision),
**client projection** rendering over the real store, or interleaving with the `control` path under one
lock. Those three stay named-and-unmeasured in the memo (§2b R-28, §3, §4) — they wait on wiring, not
on an environment.

The lock leg is not corroboration either, and this round says so plainly (F-I1a2-4):
`boot-1-lock-was-serialised` grades the counters **the probe reports about its own injected per-root
lock** (`acquires=4`, peak depth 1, zero re-entry, read out of the probe's report JSON), and boot 2's
counters are not graded at all. Nothing outside the probe — not the host log, not the ledger, not the
driver — independently observes that lock, so the leg shows the injected wrapper was entered the
number of times the probe claims, nothing more. It is deliberately not restated as evidence that the
real lock serialises anything: cross-process lock behaviour is PR-I1b's decision, and pretending the
probe's self-report corroborates it would be the weakest kind of overclaim in this document.

Files per run: `MEASURED-LINES.txt` (transcript incl. its own verdict), `capture.json`
(token-scrubbed machine record: heads, porcelain, ports, per-leg detail, disk census),
`host-write.log` / `host-restart.log` (captured inside `stop()` before the world is deleted).
