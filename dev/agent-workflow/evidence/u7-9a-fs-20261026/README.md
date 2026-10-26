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

### R1 RED control (measured, then reverted)

The two new guards were verified to FAIL on the defect they exist for:
with the `domain-ref` arm temporarily deleted from the executor's
requested set, `npx vitest run u7-9a-fs-mutation-c1.test.ts` →
**I-12 × (the call SUCCEEDS and commits ungoverned — the exact BLOCKER
shape) and I-13 × (pin: declared arm absent)**; arm restored, dist
re-placed (mirrors byte-identical), 35/35 green again, working tree clean
(`git status --porcelain` = 0).

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

## C2 (host boots, `--suite u7-fs-mut`) — 7 boots (4 delivery + 2 R1 grant + 1 R2 grant), FINAL RUN: 8/8 PASS (overall=PASS)

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
| u5x-12-48 (R1) | 6/7 | refusal + image legs PASS on live layered arms; ctl cell FAIL on the harness oracle's wrong-tree bug (disk truth captured) |
| **u5ctl7-14-11 (R2)** | **8/8 overall=PASS** | **`fsm:ctl-native-write` PASS on the runner's OWN disk read**: `oracleBytesEqual:true`, run-unique bytes `U7FSMUT_CTL_CLAIM_u5ctl7-…\nnative-control-write\n` read at `ctlFoundPath` (the member-native session root), governed RAN witnesses never name the ctl path (`governedRanSawCtlPath:false` — entailed by the PASS formula), `laneCtlDone:true`, host-log corroborated; the oracle then REMOVED its own file (pristine host tree verified clean post-run). All other seven cases PASS alongside it. `c2/run-7.log` + `run-7.json` + `<runId>.u7fsmut-evidence.json` + `logs/u5ctl7-…/`. |

### R2 final C2 disposition (the exact tally the reviewer asked for)

| cell | final |
| --- | --- |
| fsm:mounted | PASS (boot 4, re-proved boots 5–7) |
| fsm:write-positive | PASS — disk bytes + `governed-write RAN` |
| fsm:edit-positive | PASS — disk bytes + `governed-edit RAN` |
| fsm:refusal-zero-effect | PASS arm=`template-layer-denied` — named host refusal layer, sha identical |
| fsm:image-lane-honest | PASS arm=`typed-refusal` — row's own typed sentence + host-log witness, zero commit |
| fsm:ctl-native-write | **PASS (boot 7, disk evidence recorded by the corrected oracle)** — the R1 recorded FAIL (boots 5/6) stands disclosed as history; the harness root cause was fixed in-kit and the cell RE-RAN as the R2 review directed. No ENV_BLOCK was needed: native member write is NOT impossible on this host — boot 4's sandbox denial was a cross-workspace absolute path; the member-native row writes its own session root. |
| fsm:leak-check | PASS — pids dead, ports released, home/leases released |

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
   to re-boot the cell at R1 time. RESOLVED AT R2: the corrected oracle
   RE-RAN (boot 7) and the cell records PASS on its own recorded disk
   evidence — not a conversion of the old sidecar, a fresh verdict.
   Side effect found and fixed: boot-4's stray file had tripped boot-5/6's
   hidden `host-base-pristine-post` guard (RUN-SUMMARY FAIL:2 in run-6 =
   ctl oracle + that residue; both root-caused, residue removed).

Budget law honored: 7/7 starts (4 delivery + 2 R1 grant + 1 R2 grant —
`c2/boot7-authorization.md`), offline-verify before every boot, no eighth
boot without a new ruling. Post-boot-7: pristine host tree verified clean
(oracle self-cleanup worked — the cell that dirtied it now restores it).

## Gates (fix rounds R1+R2; numbers bound to the heads named below)

* **MERGE (R2, second and final)**: master moved again mid-round;
  origin/master @ c5e43f1d5 merged at fd5c2b3d2 (#392 team-tool-plane
  backgroundJobs key + CREATING-LANE pin + agent-bindings override,
  eslint node-globals, p4t6 U74A booking). Conflicts: p4t6 booking lists
  only — resolved keeping ALL THREE bookings (U74A + U70 + U79A ride
  every sum; tie GREEN 10/10). team-tool-plane auto-merged BOTH sides
  (verified: paPlacementNameOf arms + backgroundJobs/CREATING-LANE
  present; kit 35/35 + C1 35/35 + fitness green on top; PLACEMENTS 38,
  glue re-placed). The earlier 94890f090 merge (cf2c56fb8) stays as
  history in the branch. CA-01 FINAL certificate re-issued vs c5e43f1d5:
  branch contribution 0 AND HEAD==master 33/33 —
  `ca01-zero-diff-proof-r2-final.txt` (the authoritative cert).
* **MERGE (R2a)**: origin/master @ 94890f090 merged at cf2c56fb8; the ONLY
  conflicts were harness/p4t6 (`u5-canary-runner.mjs`, `lib/world-factory.mjs`,
  `p4t6-session-event-scan.test.ts`) — resolved keeping BOTH sides' intent
  (u6-arc-d extended row + u7-0 census World beside u7FsMut; both
  SCANNED_PATHS bookings ride every sum). CA-01 RE-ISSUED vs the new master:
  33/33 byte-identical, mismatches 0 (`ca01-zero-diff-proof-r2.txt`).
* `ci-pr-gate` @ merged tree: **7 pass / 0 fail** (census named-skip) —
  `ci-pr-gate-merged.log`.
* root vitest @ merged tree (629 files): **628 green + a4p7-merge-gate**,
  whose red was the OLD-REDS ENV-1 provisioning gap (`packages/client/dist`
  not built — upstream's own record names the provisioning step); after
  `pnpm run build` in packages/client, a4p7 is **35/35 green solo**. The
  five old env-dependent baseline reds are GONE (closed upstream by #393).
  **NEW reds = 0 against a now-green baseline.** FINAL-HEAD run
  (df9e08c48, after the second merge): **630 files / 630 passed, exit 0**
  (`root-vitest-final.log`) — the suite is fully green, zero existing or
  new reds. Final-head `ci-pr-gate`: **7 pass / 0 fail**
  (`ci-pr-gate-final.log`); hosted pr-gate + candidate-protection +
  census-runtime all SUCCESS on df9e08c48. (The commit carrying these two
  logs is docs-only; its head re-runs the same trio — recorded green.)
* quick battery @ merged tree: kit **35/35** (upstream +1),
  fitness+C1+golden+unsupported-c1+a5p0 = **62/62**, p4t6 re-tied
  **10/10** (both bookings), boot 7 recorded overall=PASS.
* CA-01 certificates: `ca01-zero-diff-proof.txt` (delivery),
  `ca01-zero-diff-proof-r1.txt` (+ appendix), `ca01-zero-diff-proof-r2.txt`
  (bound to master 94890f090 — the merge).

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
