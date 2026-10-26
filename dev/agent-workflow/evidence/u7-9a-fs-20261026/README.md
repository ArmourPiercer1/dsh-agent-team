# U7-9a — FS family REQUIRED tools on the governance kernel (evidence)

Task: deliver the FS family's required members `write`, `edit`, `read_image`
as family contributions through the CLOSED schema + Registry + the SAME
kernel as `read`/bash/search/jobs (one ledger), and prove **CA-01**: new
family members land with ZERO center diff. Branch
`task/u7-9a-fs-mutation-family-20261026` (base a0f3f610c), single writer.

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

## C1 (in-process, full plane + real PA + real provider) — 33/33 GREEN

`packages/runtime/test/u7-9a-fs-mutation-c1.test.ts` — governed write/edit/
read_image positives from disk, token-ledger replay/cancel arms
(`{cancelled:true}` resolution law), pre-aborted signal, default-deny zero
disk, symlink/escape zero effect, edit receipt law, image honest-arm,
per-path serialization races (final = one whole payload).
Regression: u6-pr2/pr3/pr5 kernel-flow + a5-m1 + golden-vectors all green.

## C2 (host boots, `--suite u7-fs-mut`) — 4 boots (budget 4), final 5/8

ONE boot per run; verdicts = the runner's OWN disk reads + host-log
witnesses (never the transcript); `c2/` holds all four runs (`run-N.json`,
`run-N.log`, `logs/<world>/`).

| boot | outcome | what it measured |
| --- | --- | --- |
| u7fsmut1 | 3/8 | plane config WITHOUT `centerAssembly` → every governed call refused `TOOL_BINDING_UNVERIFIED` (PA authority-generation leg is part of the PROVEN mount shape); boot-root "native control" refused fail-closed — the root is itself plane-governed |
| u7fsmut2 | 3/8 | shadow keys alone insufficient — detail (added as executor forensics) pinned the refusal arm: `identity-gap=no-answer-object, entry-cause=no-placement-name` |
| u7fsmut3 | 3/8 | same detail post-lane-fixes; transcript forensics added (whole-body tool regex lied — disclosed) |
| u7fsmut4 | **5/8** | `paPlacementNameOf` family-spelling fix (measured root cause: the read-only special case predates the family) → **fsm:write-positive PASS** (disk bytes = W1_CONTENT + `governed-write RAN`), **fsm:edit-positive PASS** (PLANT_AFTER on disk, before-token gone, `governed-edit RAN`), fsm:mounted PASS (feed rows `[...,read,write,edit,read_image]` from the UNCHANGED key set), fsm:leak-check PASS |

### The three undecided legs — measured product/environment laws (DISCLOSED)

1. `fsm:refusal-zero-effect` — the DISK law holds (`shaIdentical:true`,
   byte-compare vs pre-boot sha) and no governed RAN line ever names the
   denied path; but the denied-path call died at a HOST layer BEFORE the row
   (zero row witnesses, zero host-log error lines): the refusal happened
   earlier than the kernel body (stricter), yet the row-level witness the
   case shape demands cannot exist for a pre-row death. Not flipped to PASS:
   "silent" is not a witness (SKIP≠PASS).
2. `fsm:image-lane-honest` — the `read_image` call likewise never reached
   the row on this host config (zero witnesses; `arm:"silent"`). Its
   honest-refusal and positive arms are both C1-proven in-process
   (I-1…I-12); the host leg stays UNDECIDED, disclosed.
3. `fsm:ctl-native-write` — the CI-03 (capabilities-less) member's NATIVE
   `write` answered `[sandbox: file access denied under workspace-write
   mode]` (transcript `resultHead`, boot 4 seq 31): the test host's tool
   sandbox confines member-native writes; the governed rows are unaffected
   (they run through the plane's own confined provider — that IS the
   delivery). The governed-negative half PASSES (`governedRanSawCtlPath:
   false`, zero bytes at the ctl path). Prepared-but-UNBOOTED fix: target
   the member's own sandbox workspace (relative path) + home-walk oracle.

Budget law honored: ≤4 host starts, offline-verify before every boot, no
fifth boot; the three legs above are disclosed exactly as measured, not
passed.

## Gates (merged tree 56a55c21c, origin/master @ 97bbc2563)

* `ci-pr-gate`: 7 pass / 0 fail (census leg named-skip, opt-in law);
  typecheck all packages; lint identities new 0; artifacts-at-head: HEAD
  carries its own build (1820 files, 37 glue).
* root vitest 628 files: failing set ⊆ master baseline (7→6 files;
  a5p7-lane-hygiene green) — NEW reds = 0 (`root-vitest-vs-baseline.txt`).
* quick battery: world-factory 34/34, fitness+C1+golden+unsupported-c1+
  a5p0-audit+p4t6 = 70/70.
* CA-01 byte certificate: `ca01-zero-diff-proof.txt` (33/33, zero drift vs
  base AND current master).

## Bookings

* p4t6 file-count ledger: +15 scannable files booked
  (`SCANNED_PATHS_U79A`), tie `1292 − 1277 = 15`; honest unbooked RED
  regenerated for the record: `p4t6-RED-unbooked.log`
  (`expected 1292 to be 1277`).
* PLACEMENTS: 9 new mirrors (`node scripts/place-dist-glue.mjs` → 37
  placements, byte-identical; check D green).
* str_replace_editor: obligations state NOT mounted in any shipped bundle/
  preset (matrix M-04 gap=NONE_SHIPPED) → OUT_OF_SCOPE for this delivery
  (no shipped surface to govern).
