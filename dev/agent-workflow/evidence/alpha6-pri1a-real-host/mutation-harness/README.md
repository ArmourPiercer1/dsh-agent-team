# PR-I1a mutation harness — the METHOD LAW, as an executable

Committed at F-I1a3-6 so the next reviewer checks the **law** instead of trusting a transcript. The round-17
round shipped transcripts and described the protocol in prose; the protocol itself lived in the fix session's
scratch, and its first revision is what caused the round's one self-inflicted incident — an assertion tripped
mid-run, that version exited **with the mutation still applied**, and the next two kit runs inherited the
contaminated bytes. Round 3 reviewed this commit in its own clone with its own harness and fixed the same two
things there (refuse bytes that are not the pinned sha256; restore on every exit path and verify the restore).

This directory is the version that **actually ran** the round-18 transcripts next to it: the four committed
mutations re-run at the round-18 bytes (`…T20-12-18Z`, `…T20-12-40Z`, `…T20-13-02Z`, `…T20-13-24Z`) and the
three plants that grade F-I1a3-1 and F-I1a3-4 (`…T20-18-20Z`, `…T20-18-42Z`, `…T20-19-04Z`). It emits the
same `MUTATION-METHOD-LAW.txt` shape the earlier committed reds use, so the transcripts stay comparable. It also writes `MUTATION.diff` beside a run whose mutation is a committed hunk.

Dated 2026-10-31, two fixes to this directory (round-4 review):

* **F-I1a4-2 — the re-run commands below now run as written.** Every caller-supplied path (`diff:`,
  `edit:`, `--pre-diff`) is resolved to an absolute path **at entry** (`abspath`, `mutrun.sh:72`): the
  diff half reaches git through `git -C "$TREE" apply` (cwd=$TREE) while the edit half and the existence
  checks run from the caller's cwd, so relative paths meant different things to the two halves — before
  this fix, `diff:../a6pri1a-…` from here failed `can't open patch` (rc=86) and `edit:plants/…` from the
  tree root failed `REFUSE … does not exist` (rc=87), exactly as the round-4 review measured. Resolution
  order: caller's cwd, then the tree root (the same two roots `abspath`'s comment names).
* **F-I1a4-5 — hunk headers are generated, never typed.** A stored `MUTATION.diff` carries the header
  its generator wrote **when the patch was made**; replaying it after the target file moved leaves the
  numbers stale (measured: `…T20-13-24Z`'s header says 660, the hunk lands at 762 at `3ac9fd52e`). Such a
  replay is disclosed beside the patch (`../a6pri1a-2026-10-31T20-13-24Z/HUNK-HEADER-NOTE.md`), and what
  pins a mutation is the law's whole-file rebuild check and planted-line read-back — never the header.

Order, stated exactly: the four hunks ran first, the three plants last. Between those two batches two things
were fixed — the insertion branch of `law.mjs expected` (a one-line replacement does not take that branch)
and the plant scripts' read-back confirmation (used only by the three plants) — so the three plant
transcripts are the output of every file exactly as committed, and the four hunk transcripts are the output
of these bytes for every code path they actually exercise.

## Files

| file | what it is |
| --- | --- |
| `mutrun.sh` | the driver: pin refusal → backup → plant → confirm from bytes → run the kit → restore on every exit path → verify |
| `law.mjs` | the checks: `counts`, `expected`, `verify`, `nul` (each one moves the exit code) |
| `diff-lines.mjs` | the minimum line comparison `verify` needs — common prefix, common suffix, and whatever moved in between |
| `plants/plant-a-drift.mjs` | the reviewer's round-3 plant: one comment line between an anchor and the arm it pointed two lines ahead to |
| `plants/plant-b-span-drift.mjs` | one comment line planted **inside** a graded span — the case the instrument must refuse |
| `plants/plant-c-input.mjs` | an arm's **input** mutated with the arm left pristine — the limit F-I1a3-4 discloses |

## The law, in force order

1. **Pin refusal.** The target's sha256 must equal the pinned sha256 or nothing is touched (exit 88). This is
   also the verification of the *previous* run's restore, taken before this run may begin: mutated bytes do
   not hash to the pin, so no run can inherit them.
2. **Intended file.** Only the two kit files may be touched; the same file at `HEAD` is hashed too, so the
   transcript says whether the pinned bytes are the committed bytes.
3. **Bytes printed.** The declared old line and new line are printed, and the whole file is then required to
   be the previous file with exactly that change (`law.mjs verify`): any other line that moved anywhere in the
   file fails the run. The delimiter/quote/marker/line/byte census must equal the value **predicted from the
   declaration** (`law.mjs expected`), never a value read back out of the mutated bytes.
4. **Structure.** `node --check` on the mutated bytes, plus a NUL scan.
5. **Leg reddened.** The kit must exit 1 and its verdict line must name the leg the mutation claims to
   falsify; `--expect-regex` additionally requires the *stated reason* in the transcript, and
   `--expect-absent` fails the run if bytes that must never be quoted appear in it. A mutation that exits
   green, or reddens some other leg, is not evidence and exits 83/85.
6. **Restore.** A trap restores on every exit path — normal end, assertion failure, SIGINT, SIGTERM — and the
   restore is verified by sha256 == pin, byte `cmp` against the backup, and `node --check`. No exit 0 without it.

Every check above moves the exit code. A line that cannot fail the run is not printed.

## Re-running one — the commands as actually run, with output

Round 18 wrote a re-run recipe whose relative paths could not run as written (F-I1a4-2, measured by the
reviewer: `diff:../a6pri1a-…` failed `can't open patch` rc=86, `edit:plants/…` from the tree root failed
`REFUSE … does not exist` rc=87). The harness now resolves every caller path absolutely at entry
(`abspath`), and what follows is the literal round-19 re-run — same cwd (this directory), no exports
needed, the defaults for `PRI1A_TREE`/`PRI1A_SCRATCH` used as-is:

```bash
cd <worktree>/dev/agent-workflow/evidence/alpha6-pri1a-real-host/mutation-harness

# the pin is re-measured, never transcribed (probe unchanged this round):
$ sha256sum ../../../../tests/kits/pr-i1a-real-host/pri1a-probe-row.mjs
40528066b6508473565acffc8a66b66c1a1e75b67305d980ece80c5df0b83ebd

$ ./mutrun.sh r19-mut-seq tests/kits/pr-i1a-real-host/pri1a-probe-row.mjs 40528066b6508473565acffc8a66b66c1a1e75b67305d980ece80c5df0b83ebd \
    diff:../a6pri1a-2026-10-31T20-12-18Z/MUTATION.diff \
    "      step('new-family-writes-after-restart', fresh.ok === true && fresh.sequence === previousMax + 1," \
    "      step('new-family-writes-after-restart', fresh.ok === true && fresh.sequence === previousMax + 2," \
    boot-2-new-family-continues-the-chain \
    --expect-regex 'pri1a-probe-row\.mjs:290 step\(.new-family-writes-after-restart.' \
    -- node tests/kits/pr-i1a-real-host/pr-i1a-real-host.mjs --port 3185
  …
  restore verified inside the run, before the next mutation could inherit anything
  METHOD LAW VERDICT: pass
  MUTATION-METHOD-LAW.txt and MUTATION.diff written into a6pri1a-2026-10-31T21-33-32Z      # rc=0

$ ./mutrun.sh r19-plant-A-from-drift tests/kits/pr-i1a-real-host/pri1a-probe-row.mjs 40528066b6508473565acffc8a66b66c1a1e75b67305d980ece80c5df0b83ebd \
    edit:plants/plant-a-drift.mjs "" "        // plant-A comment line that shifts the graded arm by one" \
    boot-2-rows-are-boot-1-rows --pre-diff ../a6pri1a-2026-10-31T20-13-02Z/MUTATION.diff \
    --expect-regex 'pri1a-probe-row\.mjs:247 writes: \{ created, replay, transferred, retired \}, rows,' \
    --expect-absent 'plant-A comment line that shifts' \
    -- node tests/kits/pr-i1a-real-host/pr-i1a-real-host.mjs --port 3187
  …
  METHOD LAW VERDICT: pass
  MUTATION-METHOD-LAW.txt and MUTATION.diff written into a6pri1a-2026-10-31T21-33-55Z      # rc=0
```

The two round-4 reproduction plants run the same way (`PRI1A_ANCHOR=<exact line to plant after>` is the
extra exported input `plants/plant-insert-after.mjs` reads): `r19-plant-D-selfcert` (--port 3190) and
`r19-plant-A2-byte-copy` (--port 3193), both `METHOD LAW VERDICT: pass`, in
`a6pri1a-2026-10-31T21-34-22Z` and `a6pri1a-2026-10-31T21-34-44Z`.

Ports come from `tests/paths.mjs` `TEST_PORT_RANGES` (3180-3199 / 3491-3500 / 13000-13099); the kit itself
re-validates the band immediately before every spawn and refuses 3080 and 3180 by name — see
`../a6pri1a-port-band-refusals-round18/port-refusals.txt`. Round-18 runs used 3184-3189; the round-19 runs
above used 3185 / 3187 / 3190 (+ derived restart ports), each proven free again in its transcript.

## What each plant is for

* **plant A** — F-I1a3-1 as the reviewer planted it, byte for byte (the planted file hashes to
  `7b242c4eadfec9f707dab607043ec1a582f76a689e3c83f7c21021d66256902e`, the same hash round 3 measured). The
  FAIL block must name the graded arm at its **shifted** line (`pri1a-probe-row.mjs:247 writes: { created, …`),
  and the planted comment must appear **nowhere** in the transcript. Round 17 printed the comment as "the
  bytes it was graded from" while its self-test stayed green.
* **plant B** — the drift that cannot be absorbed: a line inside a graded span. The instrument prints
  `…: <span drifted>` plus the line it could not verify and **no bytes at all** for that arm
  (`REFUSING to quote bytes it did not grade`). **Rewritten 2026-10-31 (F-I1a4-1) — this bullet used to
  end "Quoted correctly, or refused: those are the two outcomes", and that was false.** The honest scope
  has THREE outcomes: a span whose every line passes the grade-time rules PRINTS, as its descriptor's
  DECLARED region — signature-uniqueness WITHIN THE SPAN and code-landing are containment, and
  containment cannot prove
  the region is the arm's statement (the FAIL header says exactly that, and a signature that survives
  only as string, comment or regex-literal content still prints — A6 is string content, and round 5
  measured N3 comment content (planted-file sha `09637367…`) and N2 regex-literal content (planted-file
  sha `77884683…`) certify `verdict=pass checks=55 problems=0` the same way; clause widened at round 20,
  F-I1a5-3); anything the rules can see — blank or
  repeated token, moved or ambiguous anchor, a descriptor the builder never returned, a comment line in
  the span — is REFUSED with its reason where the bytes would have been; and a descriptor that declares
  a wider or shifted region of live code whose signature is distinct within that span is published as
  declared. The instrument guarantees that every quoted line is a live line of the arm's file, carrying
  its signature uniquely WITHIN THE CERTIFIED SPAN and landing on code; it detects the misquote classes
  it can see in bytes; it does not certify that a published region is the statement, or that a token
  occurring once in the span occurs once in the file (that stricter reading is what the self-test's
  per-arm sweep checks, and plant A2 shows why the two layers are split).
* **plant C** — F-I1a3-4. The arm's input goes bad one line above the span; the leg reddens and the quoted arm
  bytes stay pristine, which is exactly why the README scopes "the bytes it was graded from" to **arm** bytes.

* **plant D-selfcert (round 19)** — F-I1a4-1: the reviewer's plant D, a comment line carrying a span
  signature inserted INSIDE the 2-line `ARM_REOPEN_PROBE` span (on top of the committed mut-pid hunk, so
  the leg is genuinely red). At round-18 bytes this published the comment as the arm's graded bytes with
  `checks=41 problems=0`; at the round-19 bytes the FAIL block prints
  `pri1a-probe-row.mjs:<span not on code>` naming the line and refuses the bytes
  (`a6pri1a-2026-10-31T21-34-22Z`; `--expect-absent 'round-4 plant D'` proves the comment text never
  enters the transcript).
* **plant A2-byte-copy (round 19)** — the counter-case the fix must NOT refuse: a byte-copy of the
  signature line (with a trailing marker comment) inserted into the same span. Every printed line is a
  live line of the arm's own widened expression, so the span PUBLISHES — quoted correctly — and what
  flags the duplication is the self-test's stricter per-arm file-wide sweep
  (`arm-signature-tokens-occur-once-in-file … occurrences: 2`, `verdict=fail checks=55 problems=1`).
  The span-wide reading of "unique" is defined in the driver's registry comment; this plant is why it
  is defined that way (`a6pri1a-2026-10-31T21-34-44Z`).

## Ceiling, disclosed (F-I1a3-3, not closed here)

Nothing in this harness grades the *assertions* of the kit's own `--self-test`: an assertion rewritten to a
constant `true` still passes. The harness proves that a planted defect is caught and that the bytes it graded
are the bytes it printed; it does not prove that the kit's checks are meaningful. Round 18 adds checks to the
self-test sweep, which narrows that class; it does not close it. **Measured since, dated 2026-10-31 (round
4): the meta-ceiling is not hypothetical — five assertions across four families were emptied to constants and
`checks=41 problems=0` still printed** (the count never moved). A published check-count is a count, never a
claim of meaningfulness: what each check is worth is shown by the named plant that moves its exit code, and
F-I1a3-3 stays open — no text in this repository may claim it closed. Round 19 (the round-4 fix) adds the
per-arm distinctiveness checks and the four synthetic shape plants; each of the five round-4 misquotes is
reproduced against those bytes and its outcome recorded in the evidence README, so the new checks are worth
what those transcripts show, not what the count shows.
