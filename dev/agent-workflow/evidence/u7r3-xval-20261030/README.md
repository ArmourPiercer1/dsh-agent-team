# u7r3-xval — controlled parallel-validation experiment (evidence)

**Date (real UTC):** 2026-10-30 (records use real-UTC `date -u`; see `docs/plans/.../CLOCK-ANCHOR` mapping — this lane labels everything real-UTC per the user directive).
**Lane branch:** `task/u7r3-xval-20261030` @ pre-registered tip `51b023dad4` (measurement worktrees `xval-a`/`xval-b` are detached checkouts of exactly this commit).
**Registration:** `dev/agent-workflow/gates/BOOT-BUDGET-20261031C.md` pre-registration (pool **C1 环境验证池**, 3 starts x1/x2/x3).
**Credit:** **NO ACCEPTANCE CREDIT anywhere** — every RUN record carries `noAcceptanceCredit: true`; nothing in this directory is a Family acceptance格; World RUN records bind to this experiment lane only.

## Machine (measured, not assumed)

6 vCPU / 24 GiB RAM / ext4 107G (≈40 GiB free at start) / host load baseline ~1.5 with other lanes possibly active. Baseline capture: `logs/env-baseline.txt` (2026-10-30T14:27Z: load 2.75, :3080 = 401, `~/.dsh` mtime `2026-10-28T13:45:42.560Z`, test bands empty).

## Environment facts (EF) discovered while provisioning

| # | Fact | Consequence / handling |
| --- | --- | --- |
| EF-01 | pnpm store, `~/.npm`, `~/.cache` live on a **read-only filesystem** (`/home/user` RO mount; `ERR_SQLITE_ERROR` on the store index) | all pnpm state redirected to workspace `.artifacts/tmp/xval-pnpm/{store,npm-cache}`; integrity stays strict via `--frozen-lockfile --ignore-scripts` (lockfile-verified fetches, registry reachable) |
| EF-02 | the main checkout's `tests/deepseek-harness-test-use` is a **shallow** git repo — `git clone --local` silently falls back (`warning: --local is ignored`) | clone still lands byte-exact detached `@639ed0153972…` with porcelain EMPTY (verified in both worktrees, pre+post); recorded, no rule bent |
| EF-03 | shared baseline `/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness` has **no `.git`** (EF-04 of the brief) | never used as clone source (by rule anyway); used nowhere — it also carries NO built native sandbox assets |
| EF-04 | `preflightHostSandbox` auto-provisioning from a TASK WORKTREE refuses with `SOURCE_IS_DESTINATION` → the sanctioned override refuses with `SOURCE_TREE_OUTSIDE_ALLOWED_ROOTS` (main checkout is not a trusted root from a worktree; the baseline is trusted but asset-less) | rule-compliant resolution = the documented trust gate's own root: a `cp -al` HARDLINK copy of the pinned main runtime tree INSIDE each worktree (`.artifacts/tmp/xval-sbx-source`, gitignored), digests verified == manifest pins (`a752bc72…`, `54a9c25c…`) — precedent `u7-g4r3-20261028/setup/SETUP-NOTES.md`; `probes/provision-sbx-source.sh` |
| EF-05 | fresh-clone test-use native assets missing (gitignored) ⇒ first `preflightHostSandbox` provisions them (backend verdict then = **partial** — old Landlock ABI, matching main-checkout measurements) | pinned in both RUN records `bindings.sandboxPreflight` |

## Provisioning (TEST_METHODS §2, per measurement worktree)

`probes/provision-testuse.sh` ×2: verified main pin (`639ed015397290b3745d163aafe02ffee4aa3f84`, porcelain empty) → `git clone --local --no-hardlinks` → `checkout --detach` the pin (HEAD + porcelain verified) → `pnpm install --ignore-scripts --frozen-lockfile` (EF-01 redirection) → `DSH_CLIENT_COMMIT_HASH=639ed01539 ESBUILD_WORKER_THREADS=1 pnpm run build` (188 s / 181 s) → `apps/cli/lib/bin.js` present, porcelain empty post-build. Logs: `logs/provision-xval-{a,b}.log`. `xval-b` additionally got a root workspace install (vitest runner for set B); `xval-a` intentionally has NO root node_modules (set A + boot probes are node-builtin-only) — the asymmetry is disclosed, it removes any shared-write question for set A.

## Budget accounting — host-start-budget.jsonl (≤3 lines — FINAL: exactly 3)

| line | token | at (real-UTC) | outcome |
| --- | --- | --- | --- |
| 1 | x1 | 14:56:53Z | **consumed by a probe-script crash** (RCA below): real Host boot on :3191, probe TypeError after `startHost` → orphan World reclaimed via the factory's own `reclaimWorld` (killed=[], leases 3191/13056 released, home deleted; ports verified free). Attempt archived: `x1/attempt-1-crash/probe-crash.log`, `x1/RUN-x1.ATTEMPT1-sink-preflight-FAIL.json` (earlier pre-trust-gate attempt). |
| 2 | x1 | 15:02:45Z | P0 x1 (xval-a): boot :3189 in 46.0 s → RUN **PASS 17/17** |
| 3 | x2 | 15:04:23Z | P0 x2 (xval-b): boot :3190 in 45.5 s → RUN **PASS 17/17** |
| — | x3 | — | **UNSPENT (by budget law).** Line 1's waste left only 2 starts for a protocol needing P0(2)+P2(1). The P2 question (light C1 co-rotating with live real Host worlds) was answered by FOLDING the C1 run into the P0 overlap window — two live Host worlds + C1, a HARSH interference condition than the single-host variant. No boot was attempted beyond the registered 3 starts; the same-class-failure law was respected (the crash was RCA'd — probe bug, not environment — before the line-2 retry). |

**Same-class-failure note:** both x1 attempts that failed failed in the LANE PROBE code (attempt 0 = trust-gate `SOURCE_IS_DESTINATION` → fixed via the documented §9 mechanism; attempt 1 = `getCase(...).detail` TypeError → fixed + crash-guard `uncaughtException → teardown+finalize` added). Zero Host/environment failures occurred; the boot path itself never failed.

## P0 — dual-worktree TestWorldFactory concurrency (the core test)

Protocol (`probes/p0-concurrent.sh`): x1 boots ALONE (sequential start order), then x2 boots WHILE x1 is live; both rendezvous and hold; overlap window = the P2 fold-in below; then both tear down. Probe = `probes/xval-boot-probe.mjs` (lane code, evidence-dir resident, NOT a tracked suite): boots a plain canary World (the minimal factory-demonstrated shape; suites 010/130 only add probe rows, which do not touch the concurrency surface) on each worktree's own `TestWorldFactory({repoRoot})`.

Proven on PASS (both RUN records `x1/RUN-x1.json`, `x2/RUN-x2.json`, 17/17 each):

- lease root: default hoist **proved identical on both worktrees** = `…/dsh-agent-team/.artifacts/tmp/port-leases` (`bindings.leaseRoot.hoisted=true`)
- distinct ports: host 3189 vs 3190, mock 13054 vs 13055, lease claims visible per-world
- distinct DSH_HOMEs under each worktree's own `tests/homes/`; distinct log/evidence trees; same Team SHA 51b023dad4 + same Host SHA 639ed0153972 in both `host-base-pre/post` (porcelain empty both sides, pre+post)
- public readiness witness: GET / 401 tokenless → `?token` 303+cookie → GET / **200 (34845 B)** both worlds
- sandbox preflight `partial` bound into both records
- :3080 401 pre AND post (byte-equal), real `~/.dsh` mtime byte-equal pre/post
- teardown receipts: killed pids, ports released (verified free), zero lease entries naming either world, zero leftover homes in either census
- **lease contention mechanics** (zero starts, `measure/lease-race/LEASE-RACE-VERDICT.json`): 8 simultaneous cross-worktree acquirers on a 6-port band → 6 distinct winners, 2 refusals (`LEASE_HELD` in 6–11 ms — append-order arbitration, never a steal), 0 live leases after release. The boot pair itself never contended (empty band head, 3189/3190 first-try wins).

## P1 — serial vs parallel C1 control — see `measure/P1-TABLE.md`

Set A (light, brief-named): `node --test tests/world-factory/binding-digests.test.mjs registries.test.mjs` (xval-a). Set B (heavier targeted family): `pnpm exec vitest run packages/runtime/test` (xval-b, 466 files/5777 tests; selection smokes `logs/p1-set-selection.log` — the brief's example single u7-9a C1 file is 2.6 s and gives no contention signal; full root vitest stayed forbidden). Every row gated on ambient loadavg1 < 3; all builds finished before ANY measurement row; only tests run during rows.

## P2 — real-Host + light-C1 co-rotation (folded, budget law)

`measure/row-p2-fold-a.json`: set A ran inside the P0 overlap window while BOTH worlds were live and held (probes 401-probe + loadavg-sample every second across the hold — see `x1/OVERLAP-x1.json`/`x2/OVERLAP-x2.json` samples incl. each sample's loadavg); process-wall 0.419 s vs serial 0.399/0.400 s (x1.05); both worlds answered 401 throughout (118 samples); teardown clean after. x3 UNSPENT (see budget table).

## P1 flakes (kept, not washed) — see `measure/FLAKE-RCA.md`

Two DIFFERENT wall-clock-sensitive legs flaked once each across five full-family runs: `u7-agentstate-fs-store-c1` N2 (in row a+b-parallel-2) and `a5-m1-auth-bridge` B4-D3 (in standalone serial RCA re-run b-rca3). Single-file re-runs after each: 6/6 and 3/3 green. Registered risk **R-413-1** (SESSION_ROUTER_LOG) documents this family's ~2/10 transient timing-failure rate under unmodified code with a fake-clock remediation obligation. The reproduction of a flake in a STANDALONE run rules out parallel co-rotation as the cause; failure directions were safe-side (typed refusals; guarded properties themselves held). Table timings unaffected.

## Repro commands

All runners live in `probes/` (self-contained, absolute-pathed). Order used: provision ×2 → provision-sbx-source ×2 → lease-race → p0-concurrent.sh → p1-serial-parallel.sh → build-table.mjs.
