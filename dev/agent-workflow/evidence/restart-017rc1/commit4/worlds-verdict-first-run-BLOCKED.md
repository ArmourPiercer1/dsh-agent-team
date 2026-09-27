# Commit 4 — 0.1.7 real-host restart regression kit — Worlds A–E verdict

- **Round**: Commit 4 live-host verification (guide §13.6 Worlds A–E + 20× race stress), plugin build under test = `task/team-restart-017rc1` @ **`61419de337f2bec6f17abe7b4ca6750ce26cfb92`** (accepted Commit 3), host = **0.1.7-rc.1 @ `46a7f68b09`** pristine test-use, `DSH_CLIENT_COMMIT_HASH=46a7f68b09`.
- **Kit**: `dev/agent-workflow/evidence/restart-017rc1/commit4/kit.mjs` (per-world fresh home `tests/homes/rst017-c4-<stamp>-<world>`, fresh mock @3497, U8 git-install `git+file:///<bare>#task/team-restart-017rc1`, self-teardown SIGTERM+mock.close, serial worlds, :3080 pre/post probe).
- **Date**: 2026-09-26.

## VERDICT: BLOCKED — product defect (reported as-is per §17.16; parent adjudication requested)

**All worlds are blocked at boot 1 by a single committed product defect**: the C1 Team activation fence's `runOwned` releases the ownership guard *synchronously* (try/finally around a non-awaited `operation()`), so the guard is already gone when the awaited 0.1.7 `agent/created` serial seam fires — the fence vetoes the Team's **own** bootstrap create on every fresh home (and by the same mechanism every guarded create/resume, including the boot `resume` path on returning homes).

Full root-cause chain, in-host evidence, fix, and severity: **`commit4/DEFECT-c1-runOwned-guard-lifetime.md`**. No bypass was attempted; no assertion was downgraded.

## Per-world status

| World | Intent (guide §13.6) | Status | Evidence |
|---|---|---|---|
| A | dynamic Team root, 13-item list + gate-5 | **BLOCKED at boot 1** — bootstrap create vetoed (6 runs: 11-42-48, 11-48-34, 11-49-18, 11-51-27, 11-56-46, 11-58-14) | `run-A.log`, `run-A-diag*.log`, `world-A/boot-1/{instance.log, probe-events/fence-probe-events.jsonl, setup-failure.json (run 1)}`, homes `rst017-c4-2026-09-26T11-42-48-A` (original) + `rst017-c4-2026-09-26T11-58-14-A` (decisive diag) |
| B | dynamic member child, 7-item list | **NOT RUN** — would reproduce the identical pre-world-flow signature (bootstrap is world-independent) | — |
| C | ordinary non-Team negative control (most important non-regression) | **RAN (12-00-30) — identical signature**: install S0–S3 PASS, boot 1 bootstrap create vetoed, FATAL; ordinary-session flow never reached | `run-C.log`, `world-C/boot-1/{instance.log, probe-events/...}`, `world-C/home-removed.json` + `world-C/home-snapshot/` |
| D | ordinary-mode v5 wire + typed fail-closed | **NOT RUN** — same blocker | — |
| E | ≥20× restart race stress | **NOT RUN** — same blocker | — |

The failure occurs in plugin bootstrap, **before any world-specific flow** — World C (second world, different subject, no hook) reproduces the exact signature: install clean → single `agent/created` (source `startup`, the glue's boot create) → exact-generation `agent/disposed` 21 ms later → `bootstrap FAILED: TeamSessionActivationInterceptedError: dsh-agent-team: intercepted foreign Agent activation for Team-managed session "<boot root>"` → p6t6 `setupError` latch → kit boot gate FATAL.

## What this round DID verify (green, retained as evidence)

- **S0 preflight** (every run): test-use pin + pristine, worktree tip, CLI 0.1.7-rc.1, ports, :3080/:3180 baselines.
- **Install S0–S3** (every run, 7× total): bare-clone tip == 61419de, `dsh plugin add` exit 0, no incompat/exemption lines, bundles auto-contains, committed install surface complete. **Installed dist byte-identical to worktree dist** (`cmp` on host.js / agent-bindings.mjs / team-session-activation.js) — no build drift.
- **0.1.7 ground truth** (read + instrumented): the public create chain is fully awaited up to `ctx.serial("agent/created")` (cordis serial = ordered, awaited dispatch) — the seam fires inside the awaited create, so a vetoing listener rejects the create and upstream rolls back the unpublished agent (`agent/disposed`) — exactly the observed sequence; that chain behaves as designed.
- **Fence unit semantics in isolation** (`fence-semantics-repro.mjs` + output): owned-activation passes, foreign rejects with the exact production wording, ordinary passes — when the decision point sits in the operation's synchronous prefix (the shape the unit tests A3/A4 exercise). The defect is specifically the guard's lifetime across *awaited* operations.
- **In-host observation pipeline** (`diag-hook-c4.mjs`, in-memory `registerHooks` transforms only — product files byte-identical on disk): proved exactly ONE `apply()`, ONE fence instance (F1), resolver bound, guard (`runOwnedActivation` → `runOwned`) on the call stack of `agents.create` ← `createTeamAgent` ← `boot()` ← `bootstrap(host.js:1279)`, and the fence's own `beforeAgentCreated` (same instance F1, same map M1) reading `ownedDepth=0` at the seam → VETO. See DEFECT file for the verbatim log.
- **Kit self-consistency**: pre/post :3080 probe unchanged (401→401; object-comparison kit bug found and fixed this round — `JSON.stringify` compare), port teardown verified free after every run.

## What is unevaluable under 61419de

- §13.6 assertion lists for A (13 items) and B (7 items); C's ordinary-promotion success criterion (its whole point is that the ordinary flow works — the plugin never bootstraps); D's v5-wire sequence (cold root → prepareOrdinaryOpen → typed fail-closed → re-takeover); E's 20× race acceptance (20/20 live / 0 writer-held / 0 double agent / 0 leaked handle).
- gate-5 live closure (wire minimum and browser gold standard) — requires a live Team takeover, unreachable.
- §17.16 deterministic green gate: **cannot be green until the fix lands**.

## FLAGS (kit design decisions carried into the verdict)

1. Probe row **PASSIVE + listed first** in `cordis.patch.yml` (observer; the production fence vetoes — probe `veto`/`permitted` fields are informational). Veto evidence is multi-channel: probe created→disposed→(bootstrap FAILED) sequence + exact production wording in instance log + mock-count frozen + final live state.
2. `sessionPersistence.stat(root)` is asserted via wire-level equivalents (session log readable with assistant rows + follow snapshot) — the `session.v4.jsonl.zstd` filename is never used as a product criterion.
3. Home retention: keep A/E/failures; World C (failed) home was snapshot+removed by the kit's post-world retention block (boot-gate FATAL is not a `check()` failure — a kit limitation documented here, no evidence lost: `world-C/home-snapshot/`).
4. gate-5 wire minimum always; browser gold standard via `--browser-hold` only if browser infra is up (degradation documented in-world if used).
5. p6t6 `boot` directive cycles 1–4; per-world fresh mock with its own request log; `A7q1` mock-count invariant (exactly +1 for the gate-5 request).
6. Diagnostic mode (`RST017_HOST_HOOK=1`) = in-memory module transforms only (product + upstream files byte-identical on disk); used solely for attribution, not in the recorded A/C verdict runs (C ran without the hook; A's decisive attribution log is from run 11-58-14).

## DEVIATIONS from the Commit 4 directive

- **None of substance.** Worlds B, D, E were not run: the single defect blocks every world at the same pre-world-flow point (empirically confirmed on 2 of 5 worlds; the bootstrap code path is world-independent by construction — the kit, probe, and mock are ready for an immediate full A–E + 20× race re-run once the fix lands).
- Kit bug fixed this round (no assertion impact): post-run :3080 stability check compared probe objects with `===` (always false) → `JSON.stringify` compare.
- No test-use, main-repo, or guide changes; no git commit; :3080 untouched (401→401).

## Requested parent adjudication

1. Accept the defect attribution (C1 fence `runOwned` guard lifetime, source + committed dist @ 61419de) and the proposed one-line-shape fix (`async runOwned` + `return await operation()`), plus a regression test with the real host shape (`agent/created` reached after awaited hops).
2. After the fix + rebuilt committed artifacts: re-run `node kit.mjs --world A,B,C,D,E` (+ `--browser-hold` if the browser gold standard is wanted for gate-5); the kit is ready and no kit-side change is expected to be needed.
3. This `worlds-verdict.md` will be reissued with per-world assertion results after a green (or adjudicated) full run.
