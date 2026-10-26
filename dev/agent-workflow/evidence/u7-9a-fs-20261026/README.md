# U7-9a — FS family REQUIRED tools on the governance kernel (evidence)

Task: deliver the FS family's required members `write`, `edit`, `read_image`
as family contributions through the CLOSED schema + Registry + the SAME
kernel as `read`/bash/search/jobs (one ledger), and prove **CA-01**: new
family members land with ZERO center diff. Branch
`task/u7-9a-fs-mutation-family-20261026` (base a0f3f610c), single writer.

## Review round R1 — per-finding disposition

1. **BLOCKER (attachment-store effect ungoverned)** — FIXED RED-first. The
   commit now rides the FINGERPRINTED requested effect set as
   `{kind:'domain-ref', domainAuthorityId:'attachment-store'}` (the
   grammar's cross-domain arm; SAME constant as the contribution
   descriptor's second target). The closed admission grammar carries NO
   grantable rung for `domain-ref` (`RESOURCE_EFFECT_KINDS` — protected
   center), so the Kernel refuses the set and the store is NEVER touched:
   declared effect ⊆ admitted effects or ZERO commit (C1 I-12 negative
   control: most-permissive lane → typed refusal, `store.saved` empty, no
   RAN; I-13 pin: remove the arm and the test goes red). Reviewer's law
   "do not leave a declared effect that no admission covers" now holds by
   construction. A future center rung mapping activates the commit arm
   with ZERO family change (flagged for center owners, out of CA-01 scope).
2. **MAJOR (str_replace_editor scope claim)** — WITHDRAWN; receipts +
   disposition in `M04-STR-REPLACE-EDITOR-INVENTORY.md` (host-package
   direct read, three boot-surface runtime receipts, plane face); matrix
   untouched; M-04 stays an OPEN obligation for the matrix owner.
3. **MAJOR (three C2 legs)** — boots 5+6 spent as directed; see the C2
   section: two legs now PASS on live evidence, the third's disk truth is
   proven with its recorded-verdict harness gap disclosed verbatim; no
   non-PASS was flipped without disk evidence.
4. **MINOR (golden digest head binding)** — re-recorded at the final code
   head with explicit head binding (`golden-recording.txt` §R1; parser/
   corpus files proven byte-identical between heads via git hashes).

## CA-01 zero-center-diff — PROVEN

* `dev/agent-workflow/ledgers/arc-a-protected-center.json` (33 protected
  files) — `packages/runtime/test/u6-arc-a-fitness.test.ts` (ARC-A L1–L4)
  passes unchanged on this tree: 12/12, incl. the BOOKED-digest legs
  (`canonical-operation.ts` sha `a1746afc…0a87` = master = branch).
* Census booking updated (`arc-a-family-census.json`): `dsh.fs-family` now
  books TWO contribution paths (read + family), four bound-definition
  nativeNames — the L3 diff is zero-violation.
* Assembly-config zero growth: the plane config the C2 world carries is the
  u6-fs read World's key set EXACTLY (pinned by
  `tests/world-factory/world-factory.test.mjs` u7-fs-mut test #2).

## Canonicalization golden gate — PROVEN

`u7-9a-mutation-golden-vectors.test.ts` + `u7-9a-mutation-golden-corpus.mts`:
1440 vectors replayed through the shipped family parsers must reproduce
master's `canonicalizeOperation` fingerprints byte-identically; corpus digest
`91fee9a6ff7ea6db450e49b7fd2b39b142a3fc06d4f924664521a69329da332b`
(master recording vs the branch re-run — `golden-recording.txt`).
Deviation law: vocabulary = center codes; deviations only STRICTER, disclosed
(fs-family README §U7-9a: 1 MiB write cap, unknown-parameter refusal,
per-path serialization, create = no recursive parents, `/proc/self/fd`).

## C1 (in-process, full plane + real PA + real provider) — 35/35 GREEN (R1: +I-12/I-13)

`packages/runtime/test/u7-9a-fs-mutation-c1.test.ts` — governed write/edit/
read_image positives from disk, token-ledger replay/cancel arms
(`{cancelled:true}` resolution law), pre-aborted signal, default-deny zero
disk, symlink/escape zero effect, edit receipt law, image honest-arm,
per-path serialization races (final = one whole payload).
Regression: u6-pr2/pr3/pr5 kernel-flow + a5-m1 + golden-vectors all green.

## C2 (host boots, `--suite u7-fs-mut`) — 6 boots (budget 6, reviewer R1 grant +2), final run: 6/7 fsm cases PASS

ONE boot per run; verdicts = the runner's OWN disk reads + host-log
witnesses; boot 5+ additionally carries the FULL mock journal
(`mockLaneTranscript`: per-request `resultHead` = the host's own tool_result
head — the witness class pre-row deaths leave). `c2/` holds all six runs.

| boot | outcome | what it measured |
| --- | --- | --- |
| u7fsmut1 | 3/8 | plane config WITHOUT `centerAssembly` → every governed call refused `TOOL_BINDING_UNVERIFIED`; boot-root native control refused fail-closed |
| u7fsmut2 | 3/8 | shadow keys alone insufficient — refusal detail `identity-gap=no-answer-object, entry-cause=no-placement-name` |
| u7fsmut3 | 3/8 | same post-lane-fixes; transcript forensics added |
| u7fsmut4 | 5/8 | `paPlacementNameOf` fix → **write/edit positives PASS on disk + RAN witnesses**; the three R1-open legs FAIL as disclosed |
| u5x-12-45 (R1) | journal run | the three "pre-dispatch deaths" are NAMED (see below) — none was a product defect |
| u5x-12-48 (R1, final) | **6/7** | `fsm:refusal-zero-effect` **PASS arm=template-layer-denied**; `fsm:image-lane-honest` **PASS arm=typed-refusal** with live host-log witness `governed-image pre-gate-refused code=IMAGE_MODEL_NOT_CAPABLE`; ctl cell recorded FAIL on a HARNESS oracle bug — its DISK truth PASSED (`run-6.ctl-native-disk-truth.txt`, byte-exact run-unique claim; journal seq 31 `Created file`) |

### R1 finding 3 — what the boot-5 journal actually measured (nothing stays "silent")

1. **denied-target write**: refused HIGHER than the plane row — the host's
   own TEMPLATE permission layer answers
   `Error: permission denied: write[…/u7fsmut-denied.txt]: effective deny`
   (journal seq 19); disk sha identical. Governance stack refused, zero
   effect: honest PASS arm `template-layer-denied` (boot 6, live).
2. **read_image**: the row RAN and answered its own typed sentence
   `refused-admission IMAGE_MODEL_NOT_CAPABLE` (pre-PA route gate; the mock
   model declares no image input — environment, disclosed); boot 6 also
   shows the new host-log witness (pre-gate observe added this round).
   Zero commit; img sha stable. Honest PASS arm `typed-refusal`.
   NOTE: under the R1 blocker fix the attachment commit rides the
   fingerprinted effect set as `domain-ref(attachment-store)` — the closed
   admission grammar has no grantable rung for it (protected center), so
   even a capable model refuses with ZERO commit at the PA edge (C1 I-12);
   commit mechanics stand admitted-state-proven (C1 I-2/I-3/I-13).
3. **ctl native write**: boot 4's `[sandbox: file access denied under
   workspace-write mode]` was the native row addressing ANOTHER member's
   workspace by absolute path. Boot 5/6 write a RELATIVE name → the native
   row SUCCEEDS into its own session root (the pristine runtime checkout;
   journal `Created file`) and the run-unique bytes are on disk
   (`run-5.ctl-native-disk-truth.txt`, `run-6.ctl-native-disk-truth.txt`).
   The recorded ctl cells still read FAIL: the runner's own oracle walked
   the world HOME and missed the session root (harness bug). Kit fixed
   this round (oracle walks the factory hostTree + records + restores the
   pristine tree by removing its own run-unique file); NO budget remained
   to re-boot the cell — it is disclosed exactly as measured, not flipped:
   the case's DISK truth is proven, its recorded verdict is not re-run.
   Side effect found and fixed: boot-4's stray file had tripped boot-5/6's
   hidden `host-base-pristine-post` guard (RUN-SUMMARY FAIL:2 in run-6 =
   ctl oracle + that residue; both root-caused, residue removed).

Budget law honored: 6/6 starts (4 delivery + 2 R1 grant), offline-verify
before every boot, no seventh boot.

## Gates (fix round R1; numbers bound to the heads named below)

* `ci-pr-gate` @ evidence head 16e8daf7b (all code committed; quiet tree):
  **7 pass / 0 fail** (census leg named-skip, opt-in law) —
  `ci-pr-gate-fixround.log`. The docs-only commit that records this number
  adds only evidence/text files (no scannable, no canonicalization, no
  protected path).
* quick battery @ fix heads: world-factory kit **34/34**;
  fitness+C1+golden+unsupported-c1+a5p0-audit+p4t6 = **72/72**
  (70 + the 2 new C1 tests I-12/I-13).
* root vitest 628 files @ 16e8daf7b (quiet tree, recorded nothing running):
  6 failed files = EXACTLY the env-dependent master baseline set
  (t2-blueprint-hash, p6t3-mediation, p6t3-restart, a4p7-merge-gate,
  rc2-sanitize-evidence, p6t6-actions) — **NEW reds = 0**
  (`root-vitest-fixround.log`). An earlier mid-run pass showed 3 extra
  reds: p4t6 raced a commit touching the index mid-run (self-inflicted,
  discipline noted), and a5p4-lane-hygiene + alpha5-glob-backend are
  concurrency flakes — all three GREEN solo, GREEN in this clean run.
* CA-01 byte certificate R1: `ca01-zero-diff-proof-r1.txt` — 33/33, zero
  drift vs base AND current origin/master, per-file git blob hashes.

## Bookings

* p4t6 file-count ledger: +15 scannable files booked
  (`SCANNED_PATHS_U79A`), tie `1292 − 1277 = 15`; honest unbooked RED
  regenerated for the record: `p4t6-RED-unbooked.log`
  (`expected 1292 to be 1277`).
* PLACEMENTS: 9 new mirrors (`node scripts/place-dist-glue.mjs` → 37
  placements, byte-identical; check D green).
* str_replace_editor (M-04): the earlier OUT_OF_SCOPE/NONE_SHIPPED closure is
  WITHDRAWN per review R1 finding 2 — receipts + honest disposition in
  M04-STR-REPLACE-EDITOR-INVENTORY.md: pinned host REGISTERED natively
  (fs/tool-str-replace-editor, direct read), booted worlds' surface does
  NOT carry it, plane has no takeover row; the governed arm stays
  NOT_IMPLEMENTED and the load-condition ruling stays OPEN (matrix owner).
  This delivery neither depends on M-04 nor closes it (matrix untouched).
