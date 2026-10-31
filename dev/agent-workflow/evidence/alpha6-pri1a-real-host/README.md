# PR-I1a — real-Host durability evidence (rounds 15–16, 2026-10-31)

Produced by `tests/kits/pr-i1a-real-host/pr-i1a-real-host.mjs` (driver) with
`tests/kits/pr-i1a-real-host/pri1a-probe-row.mjs` (probe row, mounted only through the public
`profiles/web/cordis.patch.yml` seam — the host tree is never patched; CORE PATCH BUDGET = 0).

Host: `tests/deepseek-harness-test-use`, pristine, detached @ `639ed015397290b3745d163aafe02ffee4aa3f84`
(0.2.0-rc.2, the pin in `tests/paths.mjs`), `DSH_HOME` inside this worktree at `tests/homes/<world>`,
ports 3182 / 3183 (validated against `TEST_PORT_RANGES` immediately before boot — see round 16), one
unique process marker per boot. Both worlds deleted at teardown; both ports free; host porcelain 0
before and after (each run records it in `capture.json`).

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
| `a6pri1a-2026-10-31T16-55-23Z` | expected red — **mut-seq**: probe expected value mutated `previousMax + 1`→`+ 2`; the durable chain handed out 4 and the probe's own predicate (driver side still `+ 1` and still satisfied) reddened the continue leg | `DSH-PRI1A-REALHOST verdict=fail pass=26 fail=1 refused=0 legs=27 failed=boot-2-new-family-continues-the-chain` |

Each mutation was one localized edit; its exact bytes were printed with `diff -u` against a
pre-mutation backup (plus `cmp -l` for the one-byte cases) and the structure was asserted before the
run; after each run the file was restored and verified with `diff -q` and sha256 against the backup
(`pri1a-probe-row.mjs` `40528066b6508473565acffc8a66b66c1a1e75b67305d980ece80c5df0b83ebd`,
`pr-i1a-real-host.mjs` `1e34a06880b478b35725ebe02a76452e2ac64fa635a830bc19409d80dd127e42`). The
green run above ran on exactly those restored bytes (same hashes before and after the mutation runs),
so the PASS record and the four red records grade the same instrument. The mutation itself is not
part of the committed kit — these four transcripts are kept so the PASS is falsifiable per the
three-arm rule (`docs/plans/memo/alpha6-review-separation/pri1a-writer-design-20261031.md` §2b R-28).

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

Files per run: `MEASURED-LINES.txt` (transcript incl. its own verdict), `capture.json`
(token-scrubbed machine record: heads, porcelain, ports, per-leg detail, disk census),
`host-write.log` / `host-restart.log` (captured inside `stop()` before the world is deleted).
