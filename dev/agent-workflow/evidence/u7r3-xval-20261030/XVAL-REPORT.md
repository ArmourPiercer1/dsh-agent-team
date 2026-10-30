# XVAL-REPORT — controlled parallel-validation experiment (deliverable)

**Lane:** `task/u7r3-xval-20261030` @ `51b023dad4` · **Date (real UTC):** 2026-10-30 · **Pool C1 (环境验证), 3 starts, NO acceptance credit anywhere.**
Machine under test: **6 vCPU / 24 GiB RAM / ext4, 37–41 GiB free**. All raw data: `measure/row-*.json`, `x1/`, `x2/`, `measure/lease-race/`, `logs/` (this directory). Protocol + budget history: `README.md`.

## Verdicts

**P0 — dual-worktree TestWorldFactory concurrency: SAFE (PASS 17/17 ×2).**
Two worktrees of the same commit, each with its own provisioned test-use runtime, booted one canary Host World each against the **shared** port-lease root (default hoist to main `.artifacts/tmp/port-leases` — proven identical from both sides, `bindings.leaseRoot.hoisted=true`). x1 booted first and HELD; x2 booted while x1 was live (sequential start order, concurrent residency — the registered "各1，同转" protocol). Host ports 3189/3190, mock ports 13054/13055 — **first-try distinct, zero collision**; distinct DSH_HOMEs under each worktree; distinct evidence/log trees; same Team SHA + same pinned Host SHA in both records; public readiness witnesses (401 tokenless → 303+cookie → 200) both; 118 overlap samples across 117 s proving both worlds answering simultaneously; complete teardown (killed pids, ports free, zero leftover leases/homes, :3080 byte-equal 401 pre/post, real `~/.dsh` mtime byte-equal). Boot time was **insensitive** to the co-resident idle world: 46.0 s (alone phase) vs 45.5 s (x2 while x1 up) — idle worlds cost ~0 CPU (loadavg 0.26–0.47 across the overlap).

**Forced lease contention** (zero starts, `measure/lease-race/`): 8 simultaneous acquirers (4 per worktree) on a 6-port band → 6 winners on distinct ports, 2 losers with typed `LEASE_HELD` after 6–11 ms, zero live leases after release. The arbitration is deterministic by construction: append-only claim log per port slot, byte-offset claim order decides, loser unlinks its own claim and never steals — **lease contention self-serializes in milliseconds and needs no workflow-level lock**.

**P1 — serial vs parallel C1: near-zero interference for the tested pair.**
Condensed from `measure/P1-TABLE.md` (every row carries ambient loadavg; every row started under a loadavg<3 gate; zero gate waits fired):

| set | serial walls (s) | parallel walls (s) | ratio | CPU s (user+sys) | peak RSS | notes |
| --- | --- | --- | --- | --- | --- | --- |
| A `node --test` pair (light, xval-a) | 0.39 / 0.39 | 0.50 / 0.44 | x1.11–1.28 (= +0.05–0.11 s) | ~0.75 | 90 MiB | light by design |
| B `vitest run packages/runtime/test` (466 files, 5777 tests, xval-b) | 249.7 / 253.1 | 251.7 / 250.4 | **x1.00** | ~595–603 (~2.4 cores avg) | 1.52–1.71 GiB | exit-1s = documented flakes below |

Total CPU is *identical* serial-vs-parallel (no oversubscription amplification); disk delta 52 kB per B-run, 0 for A; min MemAvailable 20.6 GiB of 24 GiB **during** the heaviest rows; RSS high-water (1855 MiB) came from a row with NO co-rotation (b-rca3) → spread is noise, not interference. The two exit=1 rows (`a+b-parallel-2`, `b-rca3`) are **wall-clock-sensitive-test flakes, RCA'd and NOT washed out** (`measure/FLAKE-RCA.md`): two *different* timing legs flaked once each across 5 full-family runs — one during parallel, one during a **standalone serial re-run** — with 6/6 and 3/3 green single-file re-runs after each, and a standing risk-ledger entry (**R-413-1**: this family has ~2/10 transient timing failures under unmodified code, obligation: fake-clock PR). Failure directions were safe-side (typed refusals; the guarded safety properties themselves held).

**P2 — real-Host + light-C1 co-rotation: SAFE (folded into P0, budget law).**
The dedicated x3 boot went **unspent**: start #1 was consumed by an RCA'd probe-script crash (real boot, line 1 in `host-start-budget.jsonl`) and the ledger caps at exactly 3 lines, so P2's measurement rode inside the P0 overlap window — a **harsher** condition than planned: the light C1 pair ran in xval-b while BOTH real Host worlds were live and held (118 health samples across the window). Result: 0.419 s process-wall vs 0.399/0.400 s serial (**x1.05**), both worlds kept answering 401-tokenless throughout, teardown clean afterward. No budget line was spent beyond the registered three; no retry beyond budget was attempted.

## What parallelizes safely (on this machine, with these mechanisms)

1. **N worktrees booting Worlds concurrently** — distinct ports/homes/logs per construction; shared lease root arbitrates any port-slot collision in <15 ms with typed refusals; no shared mutable state exists between worlds (DSH_HOME under each worktree is enforced by `createWorld`).
2. **Boot + light C1 co-rotation** — measured x1.05 (2-host variant). Boot does not slow under an idle co-resident world (−1%), and idle worlds don't slow C1 (x1.05 = noise class).
3. **A heavy CPU suite + a light test set on separate worktrees** — x1.00 on the heavy side; the light side pays +0.1 s class process-start latency only.
4. **Builds on separate host trees** — the two independent test-use `pnpm run build`s (188 s / 181 s) ran inside overlapping provisioning jobs with no measurable inflation (ESBUILD_WORKER_THREADS=1 per TEST_METHODS §2).
5. **Lease acquisition under arbitrary contention** — self-serializing, millisecond-scale, deterministic (see race probe).

## What must serialize — and the mechanical why

| Serialization | Mechanism | Evidence |
| --- | --- | --- |
| **A build and a test against the SAME host tree** | `pnpm build` rewrites `packages/*/dist` in place (no transaction); vitest imports read those same files mid-write → torn reads. Different trees = independent, fine. | dist is tracked, in-place replaced; §2 build chain |
| **Two boots for the same world name/line in the same worktree** | `createWorld` HOME_RE + homes census refuse a colliding live world (fail-closed); same-second same-line names collide by construction (utcStamp is second-granular). | world-factory createWorld guards |
| **Heavy CPU suite vs wall-clock-sensitive C1 legs when a green census is needed** | CPU oversubscription stretches real-timer windows (lock settle/heartbeat legs) → typed-refusal flakes. Not a correctness break, but census-purity is lost. | FLAKE-RCA + R-413-1 (~2/10 even standalone) |
| **Anything touching `:3080` or real `~/.dsh`** | never — lease port-policy refuses unsanctioned bands (3080 included); worlds are pinned to their worktree homes. Enforced, not just procedural. | port-lease policy + byte-equal pre/post witnesses in every RUN record |
| **Host boots against the start budget** | budget law: pre-registration line BEFORE each spawn, ≤ registered starts, same-class-failure RCA before any retry. | `host-start-budget.jsonl` (exactly 3/3) |
| **pnpm install against a shared writable store** | NOT TESTED here (our store was on a read-only FS → installs were store-isolated/serial); do not claim parallel-install safety without a probe. | EF-01, README |

## Current bottleneck

**None of CPU/RAM/disk binds the current 2-workflow regime:** heaviest measured composite (B + A + 2 live worlds + probes) used ~2.7 of 6 vCPU (avg ~2.4 from B alone), peaked ~3.4 GiB RAM of 24 (min MemAvailable 20.6 GiB), and ≤52 kB/run of disk. The practical ceiling today is **software-side**: the wall-clock sensitivity of R-413-1-class legs — flake risk, not throughput.

## Is +1 vCPU / +RAM / +disk warranted?

- **RAM: NO.** Worst tested case consumed ~3.4 GiB of 24; two concurrent heavy B-suites + 3 worlds project < 6 GiB.
- **Disk: NO.** 37.4 GiB free at session end; per-run footprint is KB-scale; a provisioned worktree is ~4 GiB one-time (≈8 concurrent lanes fit).
- **vCPU: NOT for the current regime; YES only for a specific 3-heavy upgrade.** B is CPU-bound at ~2.4 cores and did not slow when co-running, so +1 vCPU buys nothing today. If policy later allows **two** heavy CPU families concurrently (2×2.4 cores + coordinator + boot ≈ 5.1–5.5 of 6), timing-sensitive legs enter flake risk before throughput does — +2 vCPU (6→8) would be the honest ask at that point, with the fake-clock PR as the cheaper alternative.

## 2 → 3 concurrent workflows: **YES, conditionally**

Conditions derived from measurement (not taste):
1. **≤1 heavy CPU family-suite in flight** at any moment (the runtime vitest family is *the* heavy class at ~2.4 cores); the 3rd workflow must be boot / light-C1 / evidence class. (Boots and light sets measured x1.00–x1.05 alongside it.)
2. **Keep host boots one-at-a-time** (registered cadence; double-simultaneous-boot was deliberately NOT probed — 46 s boot vs 90 s timeout leaves headroom, but don't spend budget discovering the cliff).
3. **Run wall-clock-sensitive census/gate suites isolated** (or twice), or land the R-413-1 fake-clock PR before letting heavy suites share their time window.
4. **Keep the ambient loadavg<3 gate** for measurement and timing-sensitive runs (it fired zero times this session — cheap insurance).
5. Port leases, homes, and evidence trees need **no** new coordination — the factory already provides per-worktree isolation + millisecond self-arbitrating lease claims on a shared root.

## Compliance ledger (this lane)

- Budget: exactly 3 host-start lines (line 1 consumed by RCA'd probe crash — World reclaimed via the factory's own `reclaimWorld`, receipts in README; lines 2–3 = P0 pair; x3 UNSPENT by choice under the cap, P2 folded). Pool C1 used-count +3 recorded append-only in `dev/agent-workflow/gates/BOOT-BUDGET-20261031C.md`.
- Same-class-failure law: both crashed attempts were RCA'd before retry (probe-script bugs, disclosed, crash-guard added); zero Host/environment boot failures occurred.
- Read-only laws honored with byte-level witnesses: :3080 answered 401 pre AND post in every run record; `~/.dsh` mtime unchanged (1793195142559.5686 pre=post); main checkout + shared baseline never written; xval-a/b test-use trees porcelain-empty at pin 639ed0153972 (pre and post).
- No acceptance credit claimed anywhere; every RUN record carries `noAcceptanceCredit: true` + suite suffix `(NO-ACCEPTANCE-CREDIT)`.
- Full vitest never run (root config untouched); set B is a targeted single-package directory, selection smokes in `logs/p1-set-selection.log`.
- Residue: zero leftover homes/leases/ports (verified post-teardown); xval-a/xval-b worktrees + their test-use trees INTENTIONALLY KEPT (gitignored throwaways, `logs/`-referenced) for reviewer re-runs — remove with `git -C /srv/workspace/dsh-plugins/dsh-agent-team worktree remove --force .worktrees/xval-{a,b}` when done.
