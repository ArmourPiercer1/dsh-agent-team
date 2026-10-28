# G4-T crash-survivor evidence

## Diagnosis before change

The three historical live failures were not factory reclaim failures. In the recorded run, the victim's abnormal kill/reclaim path passed, but `other-world-unaffected` was false because the survivor had already completed before the victim kill landed (`aAliveWhileBCrashedAndReclaimed=false`). The prior parallel orchestration started the survivor concurrently with the victim and killed after a victim `U5-IN-RUN` signal; the fast core suite could finish before that delay, so the survivor was not proven to overlap the kill/reclaim window. The synthetic straddle replay is explicitly `kind: synthetic-offline`, `delivery: NOT_DELIVERY`, and does not satisfy live confirmation.

The forward fix in `tests/world-factory/u5-parallel-supervisor.mjs` changes crash-reclaim sequencing: the victim is held at `U5-IN-FLIGHT` first; only then is the survivor started; the supervisor waits for the survivor's own `U5-IN-RUN` before SIGKILLing the victim process group; survivor completion is settled from its RUN record plus dead pid (with `close` only as a fast path), avoiding a delayed close event. Code inspection shows the forward fix guarantees only that the survivor started and signaled mid-run before the kill wait. It does NOT hold the survivor alive across `killAfterMs` plus reclaim delay, nor request an explicit during/after-reclaim effect/read. The predicate correctly requires survivor-alive at reclaim and its own suite PASS; reclaim is victim-ownership/lease scoped and the global untouched checks run at the end. The live retry below confirms the remaining orchestration gap rather than satisfying it: the core suite is too fast to guarantee overlap without an explicit survivor hold/probe handshake.

No `packages/**` defect is implicated. This lane adds only a pure supervisor sequencing invariant test and evidence.

## Sequencing law

For a timeline with `survivor_healthy_at`, `kill_at`, and `survivor_last_probe_at`, the live conjunction requires `kill_at ∈ (survivor_healthy_at, survivor_last_probe_at)` (strict bounds). Reclaim resource events must name only the victim world/resources; survivor home, ports, and leases must not appear in victim reclaim effects. The C1 test has RED cases for pre-fix/non-overlap and mutation cases, GREEN for the fixed ordering, and checks victim-only resource scope.

## Test-use runtime disclosure

The pristine runtime is cloned into `tests/deepseek-harness-test-use` from `/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use` with `--local --no-hardlinks`, detached at `639ed015397290b3745d163aafe02ffee4aa3f84`; porcelain was empty. It was installed with `pnpm install --ignore-scripts --frozen-lockfile` and built with `DSH_CLIENT_COMMIT_HASH=639ed01539 pnpm run build`. No upstream source was modified.

## Live attempts and verdict

Preflight `ss -ltn` showed only the stable :3080 listener in the prohibited stable range; no 3180/13000 test ports were occupied. The earlier authorized attempt and retry remain preserved under `live/` and `live-retry/`: the first was an environment failure (missing built `apps/cli/lib/bin.js`), and the retry correctly recorded the pre-fix scheduling failure (`other-world-unaffected=FAIL`) rather than recoloring it.

After the supervisor fix was committed at `c1045d307`, the final authorized live run used exactly two Host starts (victim + survivor), with `--mode crash-reclaim --survivor-suite core --max-host-starts 2`. The finalized record is `live-final/run-u5-crash-2026-10-28T04-32-11-886Z.json` (`schema=u5-run-record/1`, `teamSha=c1045d3077b48c70d36d11cd6a729675f794fe84`, `hostSha=639ed015397290b3745d163aafe02ffee4aa3f84`, `teamTreeClean=true`, and the parent `bindings.authority` present). The run began at 04:32:11.807Z and finished at 04:33:41.762Z UTC; supervisor exit was 0 and overall verdict was PASS.

All parent cases passed: `abnormal-kill-reclaim`, `crash-simulation-reclaim`, `other-world-unaffected`, `pristine-host-and-stable-untouched`, and `sibling-homes-untouched`. The survivor child record was overall PASS, with `token-gate`, `positive-control`, `error-return-with-effect`, `planted-defect-detected`, `oracle-blinding-divergence`, `leak-check`, and `stable-instance-unchanged` all PASS. Victim-only reclaim released ports 3184/3500 with provenance from `u5cbv-20261028T04-32-12Z`, deleted only that victim home, killed no unrecorded pids, and reported no refusals; the survivor was never restarted. Both temporary homes were cleaned.

The measured sequencing law is satisfied by the recorded millisecond timeline: survivor healthy at `1793162016809`, victim SIGKILL at `1793162017180`, victim killed-and-reclaimed sentinel at `1793162018759`, survivor's final post-reclaim probe at `1793162018832`, and survivor teardown at `1793162019118`. Thus `survivorHealthyAt < killAt < survivorLastProbeAt <= survivorTornDownAt`, the post-reclaim probe exists, and reclaim touched victim resources only. This is the required live survivor conjunction backing R-G3-1/R-REM-1; the finalized overall-PASS record closes the former scheduling gap.

The pristine test-use tree remained clean at `639ed015397290b3745d163aafe02ffee4aa3f84`. The stable :3080 read-only probe remained `401` before and after, with the listener set unchanged; no `tests/homes` worlds remained. C1 dry-run passed before the live run. No `packages/**` or upstream source was changed.

## Law and diagnosis

The prior failure was orchestration, not reclaim: the survivor completed and tore down before the victim SIGKILL. The fix holds the survivor behind a release sentinel, performs repeated health probes, and releases it only after `victimKilledAndReclaimed`. The live law is strict: `survivorHealthyAt < killAt < survivorLastProbeAt <= survivorTornDownAt`, plus a probe after reclaim and a non-empty victim-only reclaim set. A run that cannot prove that interval must fail closed.

The earlier attempts remain historical evidence and are not recolored; the final record is the first finalized overall-PASS live proof.
