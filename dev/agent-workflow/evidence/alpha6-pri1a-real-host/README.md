# PR-I1a — real-Host durability evidence (round 15, 2026-10-31)

Produced by `tests/kits/pr-i1a-real-host/pr-i1a-real-host.mjs` (driver) with
`tests/kits/pr-i1a-real-host/pri1a-probe-row.mjs` (probe row, mounted only through the public
`profiles/web/cordis.patch.yml` seam — the host tree is never patched; CORE PATCH BUDGET = 0).

Host: `tests/deepseek-harness-test-use`, pristine, detached @ `639ed015397290b3745d163aafe02ffee4aa3f84`
(0.2.0-rc.2, the pin in `tests/paths.mjs`), `DSH_HOME` inside this worktree at `tests/homes/<world>`,
ports 3182 / 3183, one unique process marker per boot. Both worlds deleted at teardown; both ports
free; host porcelain 0 before and after (each run records it in `capture.json`).

## What these two directories are

| directory | what it is | verdict line (inside `MEASURED-LINES.txt`) |
| --- | --- | --- |
| `a6pri1a-2026-10-31T15-46-00Z` | the measurement run | `DSH-PRI1A-REALHOST verdict=pass pass=24 fail=0 refused=0 legs=24` |
| `a6pri1a-2026-10-31T15-46-27Z` | **an expected red, kept on purpose** | `DSH-PRI1A-REALHOST verdict=fail pass=23 fail=1 refused=0 legs=24 failed=boot-1-sequence-chain-is-1-2-3` |

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
