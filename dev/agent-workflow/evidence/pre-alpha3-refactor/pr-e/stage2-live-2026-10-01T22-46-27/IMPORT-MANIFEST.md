# run-7 stage-2 LIVE evidence — review-ready import manifest

Imported 2026-10-02 by the sole PR54 evidence writer (parent-approved single commit, new files only;
the 034b7418 observer source is NOT touched by this commit). Raw run remains untouched in the
acceptance carrier at
`.worktrees/int-alpha3-stage2/dev/agent-workflow/evidence/pre-alpha3-refactor/pr-e/stage2-live-2026-10-01T22-46-27/`.

## What was tested (pinned in `03-launch-argv.txt`, pre-launch blob equality recorded there)

- carrier HEAD `e63da1256f7313822a2205b34696d330bba79e65`, tree `da83b95bce459aa0b525535d5431200a5b2524d6`
  (parents `76dfd4c7…` + `034b7418…`)
- PR54 observer under test = `034b7418` (stage2-observer.mjs blob `06ed02d49aa2…`, test `a13120cfbde9…`)
- PR56 frozen client fix = `28416977` (css `35d884486d18…`, client-bundle `38b136f8fc76…`); packages delta vs 76dfd4c7 = 0
- runner `301e8e57…`, paired `042a5981…`; MEMBER_MODE=1, real member perspective (`session-team-child-…` entry, world `prereq-2026-10-01T22-46-27`)

## Outcome (raw-verifiable in `kit-run.log` / `17-result-summary.txt` / `11-paired-exit.txt`)

- observer 40/40 PASS; marker `observe/marker.json` claimed **observed-pending** at 22:46:42.526Z (kit VERIFIED 22:46:42.908Z)
- kit VERDICT PASS — all 16 criteria green (59 PASS / 0 FAIL lines); runner=0 kit=0 paired=0; signals issued = 0
- owned identity cleanup `16-owned-identity.raw` (26 identities all exited, ports 0, stable :3080 = 401 zero-touch);
  runtime restore proof `19-runtime-restored-raw.txt` (bwrap/NNP1/caps 0; UI policy restored workspace-write + ask)

## Decision semantics (explicit — this distinction is load-bearing)

- **The observer only observed; it never clicked Allow or Deny.** `tests/kits/.../stage2-observer.mjs` L45:
  "It NEVER clicks allow/deny, refresh, filters, or any other control." `kit-run.log` 22:46:42.908Z:
  "observation recorded (uiObserveRecords/S9 evidence only; **decisions[] untouched**)".
- **The marker is an observation claim, never a HumanAllow.** `observe/marker.json` carries
  `claimed:"observed-pending"` + requestId `ctrl-0vl9ypc11b9h7308kmqom0hy` + digest equal to `scratch/payload.json`.
- **The scripted resolve is a separate, pre-planned kit step executed AFTER the marker was verified**:
  `kit-run.log` 22:46:42.919Z `remote team.resolveControl v4 [resolve-b3a-ctrl-0vl] -> 200 ok=true`.
  Source call sites: `pr-e-requirement-recovery-smoke.mjs` L767-768 (`resolveControl` → `team.resolveControl`),
  L1959 (recovery lane uses `policy.recovery`), L1963 (ask lane resolves `'allow'`, note `kit e12 … (ask approval)`),
  L2665 (b3c late-allow-after-abandon leg). Other legs resolve with the kit's planned decisions
  (e.g. scripted DENY at 22:46:45.374Z `resolve-b3b-ctrl-1bj`; further allows 22:50:06.154Z / 22:50:11.157Z).
  Summary: **observer only observes (no Allow/Deny click); the kit's scripted Allow/Deny executes independently.**
- **Native scrub attribution**: on its PASS path the kit itself rewrote 14 evidence files (sk-token redactions;
  launch token printed as `token=REDACTED`) — attributed in `17-result-summary.txt` ("done by the kit on PASS (not by me)").
  `kit-run.log` is therefore imported as natively-scrubbed output, not as pre-scrub raw.

## Notes

- `20-coordination-manifest.txt` (env-side aggregation) is retained for provenance but is **not authoritative**:
  it contains a self-row whose sha256 cannot reflect the file's final bytes (stale by construction).
  Authoritative hashes for this import are in the generated table below, which deliberately excludes this file.
- `observer/dom-normal.json` and `observer/dom-narrow.json` are byte-identical **as produced by the observer**
  (structural DOM extraction without viewport-dependent fields; all viewport geometry lives in
  `observer/comparisons.json`, including the pre/post geometry-stability sampling). Recorded as produced; not a rewrite.

## Prior six FAIL/NR runs — safe summaries copied, raws retained at source

Original full directories remain on the acceptance carrier (untracked, NOT imported):
`stage2-live-2026-10-01T{19-42-32, 20-10-42, 20-33-42, 20-57-08, 21-44-23, 22-15-13}` + six `prereq-*`
dirs. Only the safe per-run summaries are copied here (secret-scanned, 0 hits) under
`../stage2-prior-runs-safe-summaries/<run-dir>/`. They stand as recorded — runs 1-6 are **not** retroactively PASS:

- `19-42-32` run1: FAILURE NOTE — await-timeout anomaly, scene preserved, zero patches.
- `20-10-42` run2: S2O_ROOT_ROW_MISSING; VERDICT FAIL (S1,S6,S7,S8,S9,S14).
- `20-33-42` run3: VERDICT FAIL, same six criteria; paired FAIL, state kept.
- `20-57-08` run4: observer FAIL fast-path, controlled cancel (kit-printed PASS=15 FAIL=0 at cancel).
- `21-44-23` run5: S2O_CHECKS_FAILED — marker refused (NARROW_RID_READABLE etc.).
- `22-15-13` run6: 34 PASS / 6 narrow-geometry FAIL — marker refused, fast cancel.

## Generated file table (this file excluded by design)

### run-7 dir (`stage2-live-2026-10-01T22-46-27/`, IMPORT-MANIFEST.md excluded)

```
03-launch-argv.txt bytes=1818 sha256=12d4cac9172e31a06a638a831da2cc39b3de4b0280800a502362ca4755fa9249
10-paired-console-raw.log bytes=4101 sha256=3fa1166e7d677418ef76f90fc77d8e0ada4803cffcac611c99202730995db7a5
11-paired-exit.txt bytes=2 sha256=9a271f2a916b0b6ee6cecb2426f0b3206ef074578be55d9bc94f6f3fe3ab86aa
15-owned-identity-recorder.sh bytes=1821 sha256=83208a77883c270bee93ce8874d627bb7c2faf52214f7981ae164cc4c8faafcf
16-owned-identity.raw bytes=114995 sha256=cf52faf67ff7206a3692b9d41ed61cbd2cdf9578bb18383b8374ed1cf4e4be5e
17-result-summary.txt bytes=3366 sha256=f3ecbd325eba76cc4857c447b5f204b3ab61a5810fc2617cea2c2c512306df04
18-finally-by-identity.txt bytes=1715 sha256=2f69675dc33473ffb7ed31e5f629e178bfffe98c949dad690c00022156a3404a
19-runtime-restored-raw.txt bytes=2796 sha256=5a3df15ccafcc1a2912ac4d33a97fdd2ae19d69c472e00897ce6b09cdbef9afc
20-coordination-manifest.txt bytes=3566 sha256=28bde9e3e2f79458069b5e945f74b06793332b325cc1170f18b09fe65fadd809
kit-run.log bytes=54933 sha256=adab70af5fb62931fa2b0ab89e1d3da552c0d96f7383412be4ebabc8a9eae69b
observe/marker.json bytes=206 sha256=d20be6f73de7268c6bd1e2ed46c42498844bb341a6a2945962bf78a660ec073c
observer/comparisons.json bytes=19955 sha256=fd934714df6117f8f7ca43db69d6fe4d2ed2bf33522c71912ac701ec2d22d0ee
observer/dom-narrow.json bytes=1753 sha256=af3da5901feb2cc29d770dce5bfc9f7764f2633aa088706f37f7d06985856a15
observer/dom-normal.json bytes=1753 sha256=af3da5901feb2cc29d770dce5bfc9f7764f2633aa088706f37f7d06985856a15
observer/manifest.json bytes=1317 sha256=06fd7fa9c1bfe53759828f3e383af39fe2d99b3451d49c4d8698210b66c82be9
observer/meta.json bytes=601 sha256=21ccb7592a5e6907d7bdaab384f298f192f98b101f640becc7f47adf818da3a9
observer/panel-narrow.png bytes=43395 sha256=767d96418c15a3a33e65aba4c67551fa62d632c3dd024c1194a45f9f2e4d01d8
observer/panel-normal.png bytes=55130 sha256=ef61e0b5a2b8f8b8467aa88ca7b2ebfec6dc257cc01f61e48219b9573760cc86
observer/shot-narrow.png bytes=71440 sha256=8432fbee091ef4f2d056fd08774794bd09d3ac4d918a78b6344442b0f030c469
observer/shot-normal.png bytes=106343 sha256=57c004273202b054a0f758693dbcae5ee65d27dfc1410a156e75a7102156e98c
observe/summary.json bytes=355 sha256=8650316986111794cab9a19690d716e78192b0582f502932632aa6ac39aa4c34
.run-dir-path.txt bytes=156 sha256=292bf7a3d1dbd4f24992d63d8532831fd879f7dab459a34b4f21aae928345feb
scratch/digest-row.json bytes=1843 sha256=4cefa94414b64017500e8f42e6b51327173d08fe81900359834b5f372a943f92
scratch/payload.json bytes=1058 sha256=7d3904c82d8978ec04294a35c6d2dcc48e24d3f30967f6152feb4b79f3eaee29
```

### prior safe summaries (`stage2-prior-runs-safe-summaries/`)

```
stage2-live-2026-10-01T19-42-32/12-failure-note.txt bytes=2127 sha256=6e2727707766d863b08b6e33225e003a715c3f700fc101f28870343dcb71559e
stage2-live-2026-10-01T20-10-42/17-result-summary.txt bytes=4454 sha256=73d0fd713c5f1ca95c709ee7b11effa16b916bfa8b93345c14bd46c83844cf22
stage2-live-2026-10-01T20-33-42/17-result-summary.txt bytes=3227 sha256=ebf27d4f09d8864d728bb7910caf53fe141749c6b2ce891d0b9cc9ac059f2df0
stage2-live-2026-10-01T20-57-08/17-result-summary.txt bytes=4987 sha256=dd6f0969ea96546dd16d87d77a09aeebde9541dc0818b29d3509741eaedf0434
stage2-live-2026-10-01T21-44-23/17-result-summary.txt bytes=5279 sha256=e4e689d378e64e167b17fb4edb0a95cb30995f70486d5f32155450e02c863c6f
stage2-live-2026-10-01T22-15-13/17-result-summary.txt bytes=6132 sha256=2e02a5ff2bf49336930f22d39c26c96203f078dd1bb5dbda41e54347a13e14ea
```
