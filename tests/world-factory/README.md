# tests/world-factory — the ONE TestWorldFactory + real-Host Canary/Oracle (U5 / gate G3)

One creation/reclamation point for test Worlds on the pinned pristine Host
(`tests/deepseek-harness-test-use` @ `TEST_USE_BASELINE_SHA`), plus the
test-only **Canary** that walks the full public path once per live run
(registration → dispatch through a real model turn against a mock provider →
effect on disk → returned result) and an **Oracle** that judges effects ONLY
from channels independent of the tool's own return value.

Nothing here is collected by vitest (`vitest.config.ts` only includes
`packages/*/test/**`). Live-Host runners are opt-in by construction: they boot
a Host only when a human/agent invokes them explicitly, and every `startHost`
is written to a shared budget ledger BEFORE the spawn; a run whose ledger
already holds `--max-host-starts` entries REFUSEs every case instead of
booting.

## Test tiers

| tier | what | run | touches Host? |
| --- | --- | --- | --- |
| **C1 adapter-local** | offline unit + sensitivity tests of the factory machinery (port leases, verdict algebra, Oracle fault-planting sensitivity, cleanup-ownership guards, mock decide discrimination, host-base guard) | `node --test tests/world-factory/world-factory.test.mjs` | NO — CI-safe |
| **C2 real-Host, candidate-pinned** | the Canary suites below against the pinned pristine Host at `TEST_USE_BASELINE_SHA` (the fixed candidate; no floating versions) | `node tests/world-factory/u5-canary-runner.mjs --suite <core\|core-restart\|negatives\|u6-shadow\|u6-fs> --line <line> --evidence <dir> [--budget-ledger <jsonl>] [--max-host-starts 15]` | YES — budget-leased |
| **C3 parallel/crash orchestration** | two Worlds live in parallel; victim SIGKILLed; crash-residue reclaim; other-World + pristine + :3080 + sibling-home untouched checks | `node tests/world-factory/u5-parallel-supervisor.mjs --evidence <dir>` (modes: `--reconstruct <liveRecord>` re-judges a finished live run with zero spawns) | YES (2–3 starts) |

C1 is the ONLY tier CI runs. C2/C3 require a built Host tree and lease ports
3180–3186 / 3491–3500 — never 3080 (the stable dev instance is probed
read-only before/after and never signalled).

## What each C2 suite proves

* `core` (one World, one boot): `token-gate` (401 without token),
  `positive-control` (full chain green), `error-return-with-effect` (tool
  throws AFTER its effect → result errored, Oracle still sees the effect),
  `planted-defect-detected` (the canary LIES `ran:true` while writing nothing;
  the sound Oracle must report NO effect — this PASS IS a fault-planting RED),
  `oracle-blinding-divergence` (the deliberately-broken `ignore-marker` Oracle
  turns the SAME planted defect GREEN — the divergence is the sensitivity
  proof), `leak-check` (every owned pid dead, every leased port idle, every
  lease file gone, World home released).
* `core-restart` = `core` + `restart-persistence` (stop/boot again on the SAME
  World: boot-1 markers survive, fresh session writes again).
* `negatives`: `wrong-scope-no-effect` (mounted but not registered → a forced
  model call yields no effect and an error result), `start-failure-classified`
  (unparseable profile-patch layer → boot dies → verdict **START_FAILED**,
  never PASS), `timeout-classified` (tool outlives its case budget → verdict
  **TIMEOUT**), `interrupt-classified` (`session/cancel` mid-call →
  classified, cancel accepted, result never returns clean).

* `u6-fs` (U6 PR2 C2, one governed Team World, one boot): the kernel-owned
  governed `read` lane on the REAL pinned Host — `fs:mounted` (production Team
  row + p6t6 state + probe row registered), `fs:governed-read-positive` (a
  permissions-carrying member's read answered by the host Body, content claim
  proven outside the transcript via the probe ledger), `fs:refusal-zero-effect`
  (deny-lane read: call reached the dispatcher, result errored, the denied
  file's unique claim appears NOWHERE), `fs:ctl-native-read` (CI-03: the
  permissions-less template's native read unchanged), `fs:identity-swap` +
  `fs:toctou-abort` (the probe row's SPOOF re-registration of the governed
  name between-calls and inside a call's execute window — PASS requires zero
  spoof-Body effect; the ledger records which host law refused the plant:
  dispatch-time identity refusal or the registry's own scope law),
  `fs:identity-swap-sensitivity` (reads run immediately before the swap and
  after restore — the plant verdict cannot be explained by a dead lane),
  `fs:leak-check` (as everywhere).

`negatives` carries honest worst-of semantics: that record's overall is
TIMEOUT/START_FAILED **by design** — the classification is the demonstrated
behaviour. **The green signal for G3 is the `core` suite**, repeated
identically. `RUN-SUMMARY`/exit codes can never say PASS while any case is
non-PASS (`lib/run-record.mjs`, pinned by C1).

## Boundaries (hard)

* Pristine Host base is READ-ONLY: `assertHostBase` (porcelain empty + HEAD ==
  pin) runs before AND after every live run; drift fails the run.
* `:3080`: read-only GET probe recorded before/after; never killed, never
  written.
* Cleanup deletes ONLY paths carrying this World's `.u5-created.json` marker;
  pid kills target ONLY pids listed in `.u5-ownership.json` AND verified via
  `/proc/<pid>/environ` (`DSH_HOME=<this home>`); a recorded-but-unverifiable
  pid is REFUSED, never killed. Port leases are pid+start-time files with
  crash-recoverable stale reclaim; a foreign listener on a free-leased port is
  `EXTERNAL_BIND` → refuse, never touch.
* Windows: descendant-process-TREE cleanup beyond the recorded pids is NOT
  implemented → `windows-process-tree-cleanup: ENV_BLOCK` (stated, not
  claimed). Linux is the graded platform.
* Fresh-home disclosure: the two base-bundle LLM-API metadata contributors
  (`session-log-deepseek`, `plugin-package-inventory-deepseek`) fail EVERY
  model request with `REQUEST_EXTENSION` on a fresh unauthenticated DSH_HOME
  (measured; reported upstream in the PR body). Worlds disable ONLY them
  through their own public `config.enabled` flag (s1-h0-m1 `noext` precedent);
  all tools/Guard/dispatch paths stay mounted. The Canary never touches any
  Alpha.5 product governance path.

## Evidence

Raw logs + RUN records live OUTSIDE git under the `--evidence` root (planned:
`dev/agent-workflow/evidence/u5-g3-20261025/` in the main checkout). Launch
tokens never reach disk: only sha256 8-char fingerprints are recorded.

## Canary green ≠ product green

The Canary is a TEST-ONLY plugin exercising public seams. Its PASS proves the
test infrastructure end-to-end (gate G3). It does NOT make any product tool
green: the Alpha.5 per-tool matrix reds stay red and must be read from
`TOOL-CAPABILITY-MATRIX-9b2.md`, not from here.
