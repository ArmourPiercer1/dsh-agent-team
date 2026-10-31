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

## Re-running one

```bash
cd <worktree>
export PRI1A_TREE=$PWD PRI1A_SCRATCH=/tmp/pri1a-scratch   # scratch is never evidence
cd dev/agent-workflow/evidence/alpha6-pri1a-real-host/mutation-harness

# a committed mutation, at whatever bytes the tree holds (re-measure the pin first)
node -e 'const{createHash:h}=require("crypto"),{readFileSync:f}=require("fs");process.stdout.write(h("sha256").update(f(process.argv[1])).digest("hex"))' \
  ../../../../tests/kits/pr-i1a-real-host/pri1a-probe-row.mjs

./mutrun.sh mut-seq tests/kits/pr-i1a-real-host/pri1a-probe-row.mjs <that-sha256> \
  diff:../a6pri1a-2026-10-31T20-12-18Z/MUTATION.diff \
  "      step('new-family-writes-after-restart', fresh.ok === true && fresh.sequence === previousMax + 1," \
  "      step('new-family-writes-after-restart', fresh.ok === true && fresh.sequence === previousMax + 2," \
  boot-2-new-family-continues-the-chain --expect-regex 'previousMax \+ 2' \
  -- node tests/kits/pr-i1a-real-host/pr-i1a-real-host.mjs --port 3185

# the reviewer's plant, reproduced on top of the committed mut-payload hunk
./mutrun.sh plant-a-from-drift tests/kits/pr-i1a-real-host/pri1a-probe-row.mjs <that-sha256> \
  edit:plants/plant-a-drift.mjs "" "        // plant-A comment line that shifts the graded arm by one" \
  boot-2-rows-are-boot-1-rows --pre-diff ../a6pri1a-2026-10-31T20-13-02Z/MUTATION.diff \
  --expect-regex 'pri1a-probe-row\.mjs:247 writes: . created, replay, transferred, retired ., rows,' \
  --expect-absent 'plant-A comment line that shifts the graded arm' \
  -- node tests/kits/pr-i1a-real-host/pr-i1a-real-host.mjs --port 3188
```

Ports come from `tests/paths.mjs` `TEST_PORT_RANGES` (3180-3199 / 3491-3500 / 13000-13099); the kit itself
re-validates the band immediately before every spawn and refuses 3080 and 3180 by name — see
`../a6pri1a-port-band-refusals-round18/port-refusals.txt`. Round-18 runs used 3184-3189.

## What each plant is for

* **plant A** — F-I1a3-1 as the reviewer planted it, byte for byte (the planted file hashes to
  `7b242c4eadfec9f707dab607043ec1a582f76a689e3c83f7c21021d66256902e`, the same hash round 3 measured). The
  FAIL block must name the graded arm at its **shifted** line (`pri1a-probe-row.mjs:247 writes: { created, …`),
  and the planted comment must appear **nowhere** in the transcript. Round 17 printed the comment as "the
  bytes it was graded from" while its self-test stayed green.
* **plant B** — the drift that cannot be absorbed: a line inside a graded span. The instrument prints
  `…: <span drifted>` plus the line it could not verify and **no bytes at all** for that arm
  (`REFUSING to quote bytes it did not grade`). Quoted correctly, or refused: those are the two outcomes.
* **plant C** — F-I1a3-4. The arm's input goes bad one line above the span; the leg reddens and the quoted arm
  bytes stay pristine, which is exactly why the README scopes "the bytes it was graded from" to **arm** bytes.

## Ceiling, disclosed (F-I1a3-3, not closed here)

Nothing in this harness grades the *assertions* of the kit's own `--self-test`: an assertion rewritten to a
constant `true` still passes. The harness proves that a planted defect is caught and that the bytes it graded
are the bytes it printed; it does not prove that the kit's checks are meaningful. Round 18 adds checks to the
self-test sweep, which narrows that class; it does not close it.
