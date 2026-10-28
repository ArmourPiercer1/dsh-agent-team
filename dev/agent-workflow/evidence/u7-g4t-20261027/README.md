# G4-T crash-survivor evidence

## Diagnosis before change

The three historical live failures were not factory reclaim failures. In the recorded run, the victim's abnormal kill/reclaim path passed, but `other-world-unaffected` was false because the survivor had already completed before the victim kill landed (`aAliveWhileBCrashedAndReclaimed=false`). The prior parallel orchestration started the survivor concurrently with the victim and killed after a victim `U5-IN-RUN` signal; the fast core suite could finish before that delay, so the survivor was not proven to overlap the kill/reclaim window. The synthetic straddle replay is explicitly `kind: synthetic-offline`, `delivery: NOT_DELIVERY`, and does not satisfy live confirmation.

The forward fix in `tests/world-factory/u5-parallel-supervisor.mjs` changes crash-reclaim sequencing: the victim is held at `U5-IN-FLIGHT` first; only then is the survivor started; the supervisor waits for the survivor's own `U5-IN-RUN` before SIGKILLing the victim process group; survivor completion is settled from its RUN record plus dead pid (with `close` only as a fast path), avoiding a delayed close event. Code inspection shows the forward fix guarantees only that the survivor started and signaled mid-run before the kill wait. It does NOT hold the survivor alive across `killAfterMs` plus reclaim delay, nor request an explicit during/after-reclaim effect/read. The predicate correctly requires survivor-alive at reclaim and its own suite PASS; reclaim is victim-ownership/lease scoped and the global untouched checks run at the end. The live retry below confirms the remaining orchestration gap rather than satisfying it: the core suite is too fast to guarantee overlap without an explicit survivor hold/probe handshake.

No `packages/**` defect is implicated. This lane adds only a pure supervisor sequencing invariant test and evidence.

## Sequencing law

For a timeline with `survivor_healthy_at`, `kill_at`, and `survivor_last_probe_at`, the live conjunction requires `kill_at ∈ (survivor_healthy_at, survivor_last_probe_at)` (strict bounds). Reclaim resource events must name only the victim world/resources; survivor home, ports, and leases must not appear in victim reclaim effects. The C1 test has RED cases for pre-fix/non-overlap and mutation cases, GREEN for the fixed ordering, and checks victim-only resource scope.

## Test-use runtime disclosure

The pristine runtime is cloned into `tests/deepseek-harness-test-use` from `/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use` with `--local --no-hardlinks`, detached at `639ed015397290b3745d163aafe02ffee4aa3f84`; porcelain was empty. It was installed with `pnpm install --ignore-scripts --frozen-lockfile` and built with `DSH_CLIENT_COMMIT_HASH=639ed01539 pnpm run build`. No upstream source was modified.

## Probe design and live attempts

Each survivor probe now performs an authenticated health request and a real session-create effect/read. The JSONL row records `at`, `kind`, `ok`, HTTP status, and bounded evidence: health response byte count/SHA-256/content match plus session-create response byte count/SHA-256/session id/content match. Only `ok: true` rows count; any failed row in the held window fails the verdict. The post-reclaim row is emitted only by a request made after the `victimKilledAndReclaimed` sentinel. Host identity continuity is checked using the same survivor world id and host pid before/after reclaim; the supervisor no longer treats runner-process liveness as survivor-host liveness.

## Live attempts and verdict

Preflight `ss -ltn` showed the stable development listener only at :3080 (read-only probe `401`); no test-port listener was present. The shared lease root was not used by the dry-run: its simulation lease root was the fresh `.worktrees/u7-g4t/.artifacts/tmp/dryrun-leases-P3XuAg`, and the snapshot assertion reported `sharedRootUnchanged=true`. The C1 world-factory suite passed **42/42**.

The completed authorized live run used exactly **two Host starts** (victim + survivor), with `--mode crash-reclaim --survivor-suite core --max-host-starts 2`. The finalized record is `live/crash-reclaim-1/run-u5-crash-2026-10-28T05-53-32-928Z.json`: `schema=u5-run-record/1`, `teamSha=d8f40c0daeaa513dbb0cb98a875df5c2ceb8e8b4`, `hostSha=639ed015397290b3745d163aafe02ffee4aa3f84`, `teamTreeClean=true`, and parent `bindings.authority` present. It started at `2026-10-28T05:53:33.047Z` and finalized at `2026-10-28T05:56:20.848Z` UTC; supervisor exit was 0 and `overall=PASS`.

All parent cases passed: `abnormal-kill-reclaim`, `crash-simulation-reclaim`, `other-world-unaffected`, `pristine-host-and-stable-untouched`, and `sibling-homes-untouched`. The survivor child was overall PASS, including `token-gate`, `positive-control`, `error-return-with-effect`, `planted-defect-detected`, `oracle-blinding-divergence`, `leak-check`, and `stable-instance-unchanged`. Reclaim was victim-only: victim host/mock leases `3188/13053` were released with provenance, the victim home was deleted through its ownership marker, no unrecorded pid was killed, and refusals were empty. The survivor host was never restarted; both temporary worlds were cleaned.

The fail-closed live survivor conjunction is recorded as `survivorHealthyAt=1793166976011`, `killAt=1793166976412`, `victimKilledAndReclaimedAt=1793166977981`, `survivorLastProbeAt=1793166978135`, and `survivorTornDownAt=1793166978425`. Thus `survivorHealthyAt < killAt < victimKilledAndReclaimedAt < survivorLastProbeAt <= survivorTornDownAt`; `preKillProbeSucceeded=true`, `postReclaimProbeSucceeded=true`, `failedProbeInWindow=false`, `survivorHostIdentityContinuous=true`, and `reclaimVictimOnly=true`.

Probe evidence is real authenticated health plus session-create effect/read, not timestamp-only evidence. The pre-kill rows are all `health-effect`, `ok=true`, HTTP `200`; their health digest is `9e6eace2965139f9440823f5310c423d3b4869a55361721b60b19843ec0ade07`, and effect/read digests include `4f778269b8eb21f161d2ae71a5ea4e2aae82e561349896ef84292641d3eb876b`, `37062d2c464c019b198bbef90b26d83faf260b992efdf0831a5227d3adaf7936`, `9fc1c6ea5127be560de690a749e66ad60188ac4852731221dba3e05a86bd6ff9`, `3d9c993fb63770c360df67e5cef8b0c2d2ed9805883d38d37728bd01ad224a57`, `9872d24356e16d4431b55d27fe326afc373276ebc273203589ebcc844696de4b`, `7a5fa086d97f87894c1419939ad16cee13bde55ce6eced3c207d04e8f7b59678`, and `b6699dbe8cb03bd0ac20fce0050b42fcb5ee78e02ca2fa401d931b098e5fd91a`. The post-reclaim `after-reclaim` row at `1793166978135` is also `ok=true`, HTTP `200`, with health digest `9e6eace2965139f9440823f5310c423d3b4869a55361721b60b19843ec0ade07` and effect/read digest `98a5440848260e8f32a447afb8813e6660760af6c2791346d9ec873b89ea6164`.

The pristine test-use tree remained clean at `639ed015397290b3745d163aafe02ffee4aa3f84`; the stable :3080 probe remained `401` before and after; and `foreignChanges=[]`. No `packages/**` or upstream source was changed. This finalized overall-PASS record with fail-closed probes now backs the live survivor conjunction for **R-G3-1 / R-REM-1**.

## Law and diagnosis

The earlier failure was orchestration, not reclaim: the survivor completed before the victim kill. The fixed run holds the survivor through reclaim, performs authenticated health/effect reads before and after reclaim, and fails closed on any failed probe, missing strict interval, identity restart, or non-victim reclaim. Earlier attempts remain historical evidence and are not recolored.
