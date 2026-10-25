## FIX-T — test-infrastructure only (`tests/world-factory/**`), closes the G3 risk items

Zero product surface; upstream pristine base untouched (`tests/deepseek-harness-test-use` porcelain-empty @ the 0.2.0-rc.2 pin before AND after every live run); :3080 only ever probed read-only (alive, 401, unchanged). Evidence (untracked, local): `dev/agent-workflow/evidence/u5-fixt-20261026/` — RED/GREEN race logs, live RUN records, budget ledger, gate transcripts, `manifest.json` (44 files, sha256).

### T1 — stale-lease reclaim double-ownership race (FIXED)

**RED (pre-fix, final metric = a winner OBSERVING an asserted co-owner — sequential hand-offs after release are legal and deliberately not counted):**
- natural interleaving: **193/300** trials with double-ownership (up to 8 concurrent winners on one port under a forced stale window);
- the old unlink-then-create reclaim moved a FRESH claim away — any slot-emptying variant keeps the race (v1 rename-claim: 3/200 even after “claim-before-delete”).

**GREEN (protocol v5, this branch):** **460/460 CLEAN** — 300 natural + 80 forced-stale + 80 forced-reclaim trials, 6–8 racing processes per port, zero observed co-ownership, zero lease-file collisions. Protocol: append-only `seq` claim log per slot dir; ownership ORDER = byte offset of one's unique token line read back (a post-write `fstat` sees peers' appends too — v3 tie RED; decide-wait for a lower-order line whose claim file is still being written — v4 RED); stale claims reclaimed **by name** (rename of the ONE file, ENOENT=lost); legacy pre-FIX-T bare-file slots coexist via sweep sentinel + link-identity claim (rename of the slot path once silently moved a whole directory — the last 1/150). `release()` is token-guarded and appends a release line. `lease-race.mjs` keeps the harness rerunnable (`--inject stale|reclaim`); the hook-patched pre-fix library that produced the REDs is in evidence.

### T2 — live abnormal-kill crash reclaim (was SKIP in G3 — now PASSES live)

New `crash-reclaim` supervisor mode: victim World runs a canary call held IN FLIGHT at a gate, gets SIGKILLed as its OWNED process group (detached spawn), and PASS requires the full conjunction: in-flight trio (`.pre` present / `.post` absent / no victim RUN record → **the kill provably landed mid-tool**) + both stale leases reclaimed **with provenance** naming the killed runner (from the reclaim receipt OR from a live peer's swept claim — the protocol preserves `reclaimedFrom` either way) + host resolved dead (group kill OR /proc-environ-proof-gated reclaim kill) + reclaim kills restricted to ownership-recorded pids + post-reclaim /proc scan: **zero live processes anywhere claiming the destroyed DSH_HOME** + zero refusals + home deleted only via the ownership marker + ports idle. **crash-reclaim-3: abnormal-kill-reclaim PASS, crash-simulation-reclaim PASS** (a real orphaned process killed through the environ-proof gate). `--reconstruct` replays stored conditions with 0 spawns and deliberately cannot recolor a survivor that never straddled the kill.

**Disclosed residue (budget):** the 5th case `other-world-unaffected` FAILed live in all 3 attempts for SUPERVISOR-side reasons, root-caused each time (run1 over-strict conjunction; run2 peer-legitimate sweep not accepted; run3 survivor started concurrently and finished its ~5 s suite before the kill + child-`close` lagging an exited runner). All fixed forward on this branch (survivor starts only after the victim holds the gate, kill waits for survivor's U5-IN-RUN; completion settles on RUN RECORD + dead pid). The shared budget ledger consumed **6 of 6 authorized host starts** on these three diagnostic attempts, so the forward-fixed sequence has no clean live re-run yet — it needs +2 starts at owner discretion. The factory-side T2 acceptance conjunction itself is live-PASSED and reconstruct-replayable today; the pre-existing parallel-mode supervisor ran its survivor (7/7 core PASS incl. leak-check + stable-instance-unchanged) in every attempt.

### T3 — ledger/log capacity (FIXED)

`canary/ledger-cap.mjs`: byte-capped JSONL appends (default 2 MiB, hard ceiling 16 MiB, rows never rewritten/truncated — the Oracle keeps reading honest history), 256 B notice reserve ⇒ **deterministic single** `LEDGER-CAP-REACHED` notice. Wired into: canary ledger + U6 shadow ledger (in-Host, inside the World home), budget ledger (1 MiB, survives a 20 000-row flood), supervisor runner logs (32 MiB rolling). `startHost` additionally REFUSES any ledger/marker path that escapes the owned home.

## Verification
- C1: `node --test tests/world-factory/world-factory.test.mjs` → **13/13** (race harness included offline via `U5_RACE_TRIALS`; CI-safe, zero ports/boots).
- `ci-pr-gate` required legs **7/7 pass**; census (built tree, quiet re-run): **identity set IDENTICAL to the published nine-root baseline — zero new reds** (an earlier mid-commit census flagged 2 “new” reds: a3p3/a4p7; both reproduced as artifacts of git mutation during the run + missing CI build prelude — the a4p7 composition-smoke leg needs `pnpm build`/`build:composition`, exactly what census-runtime.yml does before grading).
- `docs:sync --check` blocking=0; `docs:probe --base origin/master` blocking=0 non_blocking=0 advisories=0.
- Host-start budget ledger: 6 of 6 (shared `live/budget.jsonl`, attached to every runner; reconstructions cost 0).

## Disclosures
- `seq` claim log is append-only (~90 B/lease start) under the lease root — reclaimed with the root; documented in the factory README.
- Legacy bare-file lease coexistence is REQUIRED while peers still run the pre-FIX-T protocol against the shared lease root (link-identity sweep + sentinel); it retires when this branch lands.
- Canary green ≠ product green: this validates the test infrastructure (G3), not the Alpha.5 per-tool matrix.
