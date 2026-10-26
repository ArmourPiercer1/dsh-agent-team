# feat(u7-9a): FS family — governed write/edit/read_image on the kernel, zero center diff (CA-01)

First S5 per-family delivery. The FS family's three REQUIRED tools `write`,
`edit`, `read_image` become **fs-family contributions through the closed
schema + Registry + the SAME governance kernel** as `read`/bash/search/jobs
(one ledger). `str_replace_editor` (M-04) scope claim is **withdrawn per review R1**: receipts in `dev/agent-workflow/evidence/u7-9a-fs-20261026/M04-STR-REPLACE-EDITOR-INVENTORY.md` — at the pinned baseline the host registers the name natively, the booted-world surface does not carry it, the plane has no takeover row; the governed arm stays NOT_IMPLEMENTED and the load-condition ruling stays open with the matrix owner (matrix untouched). This PR neither depends on M-04 nor closes it

## Matrix untouched; M-04 stays honestly open (R2 confirmation)

- NO matrix cell was re-coloured: `git diff origin/master HEAD -- docs/plans/`
  is EMPTY — `TOOL-CAPABILITY-MATRIX-9b2.md` (and every plan/backlog file) at
  this head equals master's, byte for byte. This PR never edits those files.
- M-04 (`str_replace_editor`) remains **NOT_IMPLEMENTED with the
  load-condition ruling OPEN** with the matrix owner. The R1 delivery claim
  (`OUT_OF_SCOPE / NONE_SHIPPED`) is WITHDRAWN; `M04-STR-REPLACE-EDITOR-INVENTORY.md`
  records the receipts only (host package registered natively at the pinned
  baseline; booted-world surface does not carry the name; plane has no
  takeover row) and closes nothing. This delivery neither depends on M-04
  nor discharges it.

## CA-01 — zero center diff: PROVEN, two independent ways

- **Byte-level certificate**
  (`dev/agent-workflow/evidence/u7-9a-fs-20261026/ca01-zero-diff-proof.txt`):
  all **33/33** files in `arc-a-protected-center.json` byte-identical between
  HEAD and BOTH base `a0f3f610c` and current `origin/master` (`97bbc2563`).
  `canonical-operation.ts` @ HEAD = booked digest `a1746afc…`.
- **ARC-A L1–L4 fitness scan** (`u6-arc-a-fitness.test.ts`): 12/12 green;
  census re-booked for the family's two contribution paths (L3 zero-violation).
- **Assembly zero-growth**: the mount config the C2 world carries is the
  u6-fs read World's key set EXACTLY (pinned:
  `['centerAssembly','centerShadowLedger','confinedProvider','fsInstance','realmId']`).

## Golden gate (canonicalization parity)

1440 vectors through the shipped family parsers reproduce master's
`canonicalizeOperation` fingerprints **byte-identically**; corpus digest
`91fee9a6ff7ea6db450e49b7fd2b39b142a3fc06d4f924664521a69329da332b`
(recorded from master, re-run on-branch; `golden-recording.txt`). Deviation
law: vocabulary = center codes; deviations only **stricter + disclosed**
(lane README §U7-9a: 1 MiB write cap, unknown-param refusal, per-path
serialization, no mkdir-recursive, `/proc/self/fd` verified handles,
read_image honest-arm).

## Review round R2 (BLOCKED on one cell → fixed, this push)

- **ctl-native-write resolved via the review's option (b)**: one
  R2-authorized boot (7th, `c2/boot7-authorization.md`) with the corrected
  oracle — the cell now records **PASS on the runner's own disk read**
  (same evidence class as the accepted write/edit PASSes), overall=PASS
  8/8 for the run. No ENV_BLOCK claim was made: native member write is
  possible on this host (the boot-4 sandbox denial was a cross-workspace
  absolute path, not a law).
- **origin/master @ 94890f090 merged**; conflicts were harness-only
  (canary runner, world-factory lib, p4t6 bookings) resolved keeping both
  sides' intent; CA-01 **re-issued against the new master: 33/33
  byte-identical, mismatches 0** (`ca01-zero-diff-proof-r2.txt`).
- Merged-tree gates: ci-pr-gate 7/0; root vitest 628/629 with the single
  red being the OLD-REDS ENV-1 provisioning gap (client dist unbuilt —
  upstream's own record names the fix); after provisioning, a4p7 is
  35/35 green and the suite is fully green (**NEW reds 0** against the
  now-green baseline; the five old env reds were closed upstream in #393).

## Review round R1 (BLOCKED → fixed)

- **BLOCKER fixed RED-first**: the attachment commit rides the fingerprinted
  requested effect set as `domain-ref(attachment-store)` — same constant as
  the contribution descriptor's declared target; the closed grammar has no
  grantable rung (protected center `RESOURCE_EFFECT_KINDS`), so the Kernel
  refuses and the store is NEVER touched. Declared effect ⊆ admitted
  effects, or zero commit. C1 I-12 (negative control on the REAL kernel:
  most-permissive lane → typed refusal, zero attachments) + I-13 (pin: the
  requested set must carry the declared arm). A future center rung mapping
  activates commits with zero family change.
- **M-04 scope claim withdrawn** (receipts + open disposition, matrix untouched).
- **Boots 5–6 spent on the three non-PASS cells**; the mock journal named
  every former "pre-dispatch death"; two cells PASS on live evidence; the
  third (ctl) recorded FAIL on a harness oracle bug — **resolved in R2:
  kit fixed, one R2-granted boot, cell now PASS on recorded disk evidence
  (final C2 run overall=PASS, 8/8)**. Boots 5/6 FAILs stay disclosed as
  history; nothing was recoloured into a PASS.
- **Golden digest re-bound** to the final code head (`golden-recording.txt` §R1).

## Per-tool matrix (C1 in-process / C2 host)

| tool | C1 (35/35 total) | C2 verdict (6/6 boots, final boot) |
| --- | --- | --- |
| mount (feed) | registration legs | **PASS** — `[...,read,write,edit,read_image]` from the unchanged key set |
| write | positives, token-replay/cancel, pre-abort, default-deny zero-disk, symlink/escape | **PASS** — disk bytes == content + `governed-write RAN` witness |
| edit | receipt law (`FsEditReceipt` pair), not-found, zero-effect denials | **PASS** — PLANT_AFTER on disk, before-token gone, `governed-edit RAN` |
| write→unnamed target | C1 default-deny zero-disk **proven** | **PASS arm=`template-layer-denied`** (boot 6) — the host TEMPLATE permission layer refuses (`effective deny`, journal tool_result witness) ABOVE the plane row; disk sha identical. Refusal-layer named, zero effect proven. |
| read_image | positives (admitted-state), refusal arms, bounds, I-12/I-13 kernel arms | **PASS arm=`typed-refusal`** (boot 6) — row's own sentence `refused-admission IMAGE_MODEL_NOT_CAPABLE` + live host-log witness `governed-image pre-gate-refused …`; zero commit, img sha stable. Under the R1 fix the commit arm is additionally kernel-governed: no admitted rung ⇒ refusal with zero commit at ANY model (C1 I-12). |
| native control (CI-03) | n/a | **PASS (boot 7, R2 re-run)** — corrected oracle records the runner's OWN disk read: `oracleBytesEqual:true`, run-unique bytes at `ctlFoundPath` (the member-native session root), `governedRanSawCtlPath:false`, `laneCtlDone:true`, host-log corroborated, then self-restores the pristine tree. Boots 5/6 recorded FAIL stands disclosed as history (oracle tree bug, fixed in-kit); ENV_BLOCK was NOT needed — boot 4's sandbox denial was a cross-workspace absolute path, not a confinement law. |
| leak-check | — | **PASS** — pids dead, ports released, home/leases released |

Boot forensics (6/6 starts, each offline-verified first): boots 1–4 =
PA authority leg → shadow-assembly keys → `identity-gap=no-placement-name`
→ **`paPlacementNameOf` family-spelling fix**. Boots 5–6 (R1 grant) = the
full mock journal (`resultHead` per request) NAMED the remaining three
legs: template-layer denial, row-typed image refusal, native write landing
in the session root. Full chain: evidence `c2/` + README.

## Evidence & receipts

`dev/agent-workflow/evidence/u7-9a-fs-20261026/`: README (full round),
golden recording, C1 log, four-boot C2 logs/JSONs + budget ledger, honest
p4t6 unbooked RED (`expected 1292 to be 1277`), gates log, root-vitest
subset proof, CA-01 certificate.

## Bookings & gates

- p4t6 ledger: 15 files booked (`SCANNED_PATHS_U79A`), tie `1292 − 1277 = 15` (MEASURED).
- Census + PLACEMENTS (37 mirrors; `artifacts-at-head`: HEAD carries its own build).
- `a5p0-layer-audit` consumer registration: 3 executors (same single thin
  `parseRequestedEffectSet` face as read-executor) + 2 type-only post-consume
  edges — audit green.
- U-C1-4 closed mount domain: seven governed names (was four).
- `ci-pr-gate` re-run on the fix-round tree: **7 pass / 0 fail** (census
  leg named-skip per opt-in law); typecheck all packages clean; lint
  identities **new 0**; artifacts-at-head: HEAD carries its own build
  (1820 files, 37 glue). World-factory pins 34/34;
  fitness+C1+golden+unsupported-c1+a5p0+p4t6 battery **72/72**
  (C1 35/35 incl. R1 I-12/I-13).
- Root vitest (fix-round tree, quiet): 6 failed files = EXACTLY the
  env-dependent master baseline set; **NEW reds = 0**.

## Risks / disclosures

1. R1+R2 dispositions above; boot budget 7/7 (4 + 2 R1 + 1 R2) exhausted
   without further rulings. Every C2 cell now carries a recorded PASS
   (boots 4–7); the earlier FAIL lines remain in the logs as history,
   with their root causes named. The native arm's stray-file side effect
   on the pristine runtime tree is fixed: the oracle removes exactly the
   run-unique file it recorded (post-boot-7 porcelain verified clean).
2. `paPlacementNameOf` gained three literal arms in the sanctioned assembly
   plane (not a protected file; precedent: U6 PR2–PR6 plane edits) — future
   family names need the same arm; a follow-up can generalize the lookup.
3. The six files still red here (t2-blueprint-hash, p6t3-mediation,
   p6t3-restart, a4p7-merge-gate, rc2-sanitize-evidence, p6t6-actions) are
   the known env-dependent master baseline set; nothing in this PR's scope
   touches them.

**DO NOT MERGE** — single-writer task delivery; owner review next.
