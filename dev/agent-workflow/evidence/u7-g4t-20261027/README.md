# G4-T crash-survivor evidence

## Diagnosis before change

The three historical live failures were not factory reclaim failures. In the recorded run, the victim's abnormal kill/reclaim path passed, but `other-world-unaffected` was false because the survivor had already completed before the victim kill landed (`aAliveWhileBCrashedAndReclaimed=false`). The prior parallel orchestration started the survivor concurrently with the victim and killed after a victim `U5-IN-RUN` signal; the fast core suite could finish before that delay, so the survivor was not proven to overlap the kill/reclaim window. The synthetic straddle replay is explicitly `kind: synthetic-offline`, `delivery: NOT_DELIVERY`, and does not satisfy live confirmation.

The forward fix in `tests/world-factory/u5-parallel-supervisor.mjs` changes crash-reclaim sequencing: the victim is held at `U5-IN-FLIGHT` first; only then is the survivor started; the supervisor waits for the survivor's own `U5-IN-RUN` before SIGKILLing the victim process group; survivor completion is settled from its RUN record plus dead pid (with `close` only as a fast path), avoiding a delayed close event. The fixed path therefore guarantees, by construction: survivor started and reached healthy/mid-run before kill; survivor is alive at the reclaim instant; survivor's own suite must finish PASS afterward; reclaim is scoped to victim ownership and leases; victim home/ports are reclaimed; global host/stable/sibling-home checks run at the end. A real health+effect/read probe during the window remains represented by the survivor's core suite and its RUN record; this lane will not recolor a run lacking the live overlap boolean.

No `packages/**` defect is implicated. This lane adds only a pure supervisor sequencing invariant test and evidence.

## Sequencing law

For a timeline with `survivor_healthy_at`, `kill_at`, and `survivor_last_probe_at`, the live conjunction requires `kill_at ∈ (survivor_healthy_at, survivor_last_probe_at)` (strict bounds). Reclaim resource events must name only the victim world/resources; survivor home, ports, and leases must not appear in victim reclaim effects. The C1 test has RED cases for pre-fix/non-overlap and mutation cases, GREEN for the fixed ordering, and checks victim-only resource scope.

## Test-use runtime disclosure

The pristine runtime is cloned into `tests/deepseek-harness-test-use` from `/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use` with `--local --no-hardlinks`, detached at `639ed015397290b3745d163aafe02ffee4aa3f84`; porcelain was empty. It was installed with `pnpm install --ignore-scripts --frozen-lockfile` and built with `DSH_CLIENT_COMMIT_HASH=639ed01539 pnpm run build`. No upstream source was modified.

Live commands, host-start count, records, and final verdicts will be appended below.
