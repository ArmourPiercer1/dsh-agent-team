# DATASET 1 — invocation record (round-2 fix, 2026-09-30)

Transcribed from the execution session record. The raw dataset-1 logs post-date the commands and carry no header — that is the gap this file and dataset 2 close.

## Per-run command (each of the 10 dataset-1 runs)

Each raw log was produced by exactly one execution of the verbatim command:

    pnpm exec vitest run packages/runtime/test/p6t1-parallel.test.ts

- **FOLDED runs** (`folded-run1..5.log`): executed with cwd = `/home/user/dsh-plugins/dsh-agent-team/.worktrees/f15-mcp-live-loss` @ `4940b5e2` (PR #44 head at run time).
- **BASE runs** (`base-run1..5.log`): executed with cwd = `/home/user/dsh-plugins/dsh-agent-team/.worktrees/pre-alpha3-pre-e-requirement-recovery` @ `06b094ab` (PR #44 base).

Output redirection (per run, inside the loop commands below): `> <scratch>/folded-run<i>.log 2>&1` (resp. `base-run<i>.log`), with `<scratch>` = `/home/user/dsh-plugins/dsh-agent-team/.gate-tmp/ab/` (untracked scratch, deleted after use; the logs were then copied into this evidence directory with an EOF-only whitespace scrub, `perl -0777 -pi -e 's/\n+\z/\n/'` — zero content change).

## Full loop command — FOLDED (quoted in full; transcribed verbatim from the execution session record)

```
D=/home/user/dsh-plugins/dsh-agent-team/.gate-tmp/ab && mkdir -p $D && cd /home/user/dsh-plugins/dsh-agent-team/.worktrees/f15-mcp-live-loss && for i in 1 2 3 4 5; do echo "════ FOLDED RUN $i @ $(date -u +%H:%M:%S)Z ════"; pnpm exec vitest run packages/runtime/test/p6t1-parallel.test.ts > $D/folded-run$i.log 2>&1; ec=$?; echo "exit=$ec"; grep -E "^\s*Test Files|^\s*Tests  " $D/folded-run$i.log; if [ $ec -ne 0 ]; then grep -E "^ FAIL " $D/folded-run$i.log; grep -B1 -A3 "AssertionError" $D/folded-run$i.log | head -40; fi; done; echo "════ post git status (f15) ════"; git status --short | head -3
```

## Full loop command — BASE (quoted in full; transcribed verbatim from the execution session record)

```
D=/home/user/dsh-plugins/dsh-agent-team/.gate-tmp/ab && cd /home/user/dsh-plugins/dsh-agent-team/.worktrees/pre-alpha3-pre-e-requirement-recovery && echo "═══ pre-e pre-state ═══" && git status --porcelain | head -3 && git rev-parse HEAD && for i in 1 2 3 4 5; do echo "════ BASE RUN $i @ $(date -u +%H:%M:%S)Z ════"; pnpm exec vitest run packages/runtime/test/p6t1-parallel.test.ts > $D/base-run$i.log 2>&1; ec=$?; echo "exit=$ec"; grep -E "^\s*Test Files|^\s*Tests  " $D/base-run$i.log; if [ $ec -ne 0 ]; then grep -E "^ FAIL " $D/base-run$i.log; grep -B1 -A3 "AssertionError" $D/base-run$i.log | head -40; fi; done; echo "════ pre-e post git status ════"; git status --porcelain | head -10; echo "════ post HEAD ════"; git rev-parse HEAD
```

Note: the per-run `echo "… RUN $i @ $(date -u +%H:%M:%S)Z …"` lines fired just **before** each `pnpm exec` boot (loop-echo clock), while each raw log's vitest `Start at` line is the vitest clock — the two can differ by 1 s. The dataset-1 table in `AB-ATTRIBUTION.md` was re-audited cell-by-cell against the raw logs' `Start at` lines (converted to UTC; host tz +08:00); the single mismatch found (row 5, FOLDED: 01:28:54Z → 01:28:55Z) is corrected there.

# DATASET 3 — invocation record (2026-09-30, PR-F option-B A/B)

Unlike dataset 1, every dataset-3 raw log SELF-EMBEDS its full provenance header (the `# p6t1-parallel A/B — DATASET 3, run N (TREE: base|folded)` / `# WORKTREE:` / `# HEAD:` / `# CMD:` / `# START: <UTC>Z` lines + a `# NOTE:` line on the folded logs), then the raw vitest output, then `# EXIT: n` — the commands below are the loops that produced them; the per-run `# START:` timestamps are the UTC wall clock read at log-header write (sub-second lead over the vitest `Start at` line, same loop-echo caveat as dataset 1).

## Full loop command — BASE (verbatim as executed)

```
BASE=/home/user/dsh-plugins/dsh-agent-team/.worktrees/p6t1-ab-ds3-base
EV=/home/user/dsh-plugins/dsh-agent-team/.worktrees/pre-alpha3-prf-closure/dev/agent-workflow/evidence/f15-mcp-live-loss/p6t1-ab-attribution/dataset3
mkdir -p $EV
echo "════ BASE pre: $(date -u +%Y-%m-%dT%H:%M:%SZ) ════"
echo "HEAD pre: $(git -C $BASE rev-parse HEAD)"
echo "porcelain pre: [$(git -C $BASE status --porcelain | head -3)]"
for i in 1 2 3 4 5; do
  {
    echo "# p6t1-parallel A/B — DATASET 3, run $i (TREE: base)"
    echo "# WORKTREE: $BASE"
    echo "# HEAD: $(git -C $BASE rev-parse HEAD)"
    echo "# CMD: pnpm exec vitest run packages/runtime/test/p6t1-parallel.test.ts"
    echo "# START: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "────────────────────────────────────────────────────────────"
  } > $EV/base-run$i.log
  ( cd $BASE && pnpm exec vitest run packages/runtime/test/p6t1-parallel.test.ts >> $EV/base-run$i.log 2>&1; echo "# EXIT: $?" >> $EV/base-run$i.log )
  echo "run $i done $(date -u +%H:%M:%SZ): $(grep -E '^\s+Tests  ' $EV/base-run$i.log | head -1) $(grep 'EXIT' $EV/base-run$i.log)"
done
echo "════ BASE post: $(date -u +%Y-%m-%dT%H:%M:%SZ) ════"
echo "HEAD post: $(git -C $BASE rev-parse HEAD)"
echo "porcelain post: [$(git -C $BASE status --porcelain | head -3)]"
```

Pre-state (recorded by the loop): `HEAD pre: 0a0a19a603db7ef5c560a05895835462372f5910`, `porcelain pre: []`. Post-state: `HEAD post: 0a0a19a603db7ef5c560a05895835462372f5910`, `porcelain post: []` (05:50:40Z). The scratch worktree was DELETED after this loop (`git worktree remove /home/user/dsh-plugins/dsh-agent-team/.worktrees/p6t1-ab-ds3-base --force`) — disclosed sub-artifact; per-log attribution survives in each raw log's vitest `RUN` header (`RUN v4.1.11 /home/user/dsh-plugins/dsh-agent-team/.worktrees/p6t1-ab-ds3-base`).

**Dependency-setup note (disclosed)**: `pnpm install` in the scratch failed (`[ERR_SQLITE_ERROR] unable to open database file` — the pnpm store `/home/user/.local/share/pnpm/store/v11` is outside the workspace-write sandbox). `node_modules` = full `cp -a` (608M, no hardlinks) from the PR-F worktree + the per-package `node_modules` link trees — valid because `pnpm-lock.yaml` + all `package.json` are byte-identical between `0a0a19a6` and `3b7039e8` (verified by `git diff`). An INVALID first iteration (05:49:41–05:49:46Z, root-only copy) produced 5× `Cannot find package 'yaml'` import failures with NO TESTS RUN; its five logs were OVERWRITTEN by the valid loop above (05:50:35–05:50:40Z). The invalid logs no longer exist; this entry is their disclosure.

## Full loop command — FOLDED (verbatim as executed)

```
ME=/home/user/dsh-plugins/dsh-agent-team/.worktrees/pre-alpha3-prf-closure
EV=$ME/dev/agent-workflow/evidence/f15-mcp-live-loss/p6t1-ab-attribution/dataset3
echo "════ FOLDED pre: $(date -u +%Y-%m-%dT%H:%M:%SZ) ════"
echo "HEAD pre: $(git -C $ME rev-parse HEAD)"
echo "porcelain pre (tracked-only): [$(git -C $ME status --porcelain --untracked-files=no | head -3)]"
for i in 1 2 3 4 5; do
  {
    echo "# p6t1-parallel A/B — DATASET 3, run $i (TREE: folded)"
    echo "# WORKTREE: $ME"
    echo "# HEAD: $(git -C $ME rev-parse HEAD)"
    echo "# CMD: pnpm exec vitest run packages/runtime/test/p6t1-parallel.test.ts"
    echo "# START: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "# NOTE: untracked kit edits present (tests/kits/pr-f-closure-smoke/pr-f-closure-smoke.mjs — Part-2 kit fixes, NOT imported by the test under run); packages/ + runtime test tree = exact HEAD state"
    echo "────────────────────────────────────────────────────────────"
  } > $EV/folded-run$i.log
  ( cd $ME && pnpm exec vitest run packages/runtime/test/p6t1-parallel.test.ts >> $EV/folded-run$i.log 2>&1; echo "# EXIT: $?" >> $EV/folded-run$i.log )
  echo "run $i done $(date -u +%H:%M:%SZ): $(grep -E '^\s+Tests  ' $EV/folded-run$i.log | head -1) $(grep 'EXIT' $EV/folded-run$i.log)"
done
echo "════ FOLDED post: $(date -u +%Y-%m-%dT%H:%M:%SZ) ════"
echo "HEAD post: $(git -C $ME rev-parse HEAD)"
```

Pre-state: `HEAD pre: 3b7039e89f2ab9a072d89e2e3caa2af01fe7d355`, `porcelain pre (tracked-only): []`. Post-state: `HEAD post: 3b7039e89f2ab9a072d89e2e3caa2af01fe7d355` (05:55:29Z). Serialized: no host-port kit run in flight during this loop (the prf kit fresh-world re-runs execute after the dataset-3 record is complete, per the option-B ruling).

# DATASET 3B — invocation record (2026-09-30, parent ruling branch (iii) combined path)

Per the parent ruling: base-only ×10 on a RECREATED scratch worktree @ `0a0a19a6` (the dataset-3 base scratch had been deleted after dataset 3), same self-embedded protocol as dataset 3, labeled `# p6t1-parallel A/B — DATASET 3B, run N (TREE: base)`, evidence into `dataset3b/`. ASYMMETRIC by design — rationale (per the ruling: "ASYMMETRIC by design — rationale to be recorded in invocations.md"): dataset-3b exists to measure the BASE occurrence rate of the unexonerated P2 signature (L193), which is the input to the ruling's exoneration clause ("ANY base P2 → exoneration by direct observation"); the folded P2 rate is already recorded across the full-suite rounds and is the subject of the original-raw-log re-verification ordered by the ruling (see `AB-ATTRIBUTION.md`, PARENT RULING section). A base-only loop is therefore both sufficient and the minimal valid experiment; adding folded cells would consume the sequential-run budget without adding information the clause consumes.

## Scratch worktree (recreated)

```
git -C /home/user/dsh-plugins/dsh-agent-team worktree add .worktrees/p6t1-ab-ds3b-base 0a0a19a603db7ef5c560a05895835462372f5910
```

**Dependency-setup disclosure (two steps, both pre-loop, NO TESTS ran in either):**
1. `pnpm install` in the scratch FAILED in the sandbox (`[ERR_SQLITE_ERROR] unable to open database file` — the pnpm store `/home/user/.local/share/pnpm/store/v11` is outside the workspace-write sandbox — same as the dataset-3 scratch). Fallback = `cp -a` of `node_modules` from the PR-F worktree (valid: `pnpm-lock.yaml` + every `package.json` byte-identical between `0a0a19a6` and `3b7039e8`, verified by empty `git diff` on those paths).
2. The FIRST per-package copy loop used a broken path-strip construct and produced `cp: cannot create directory '.worktrees/p6t1-ab-ds3b-base/.worktrees/pre-alpha3-prf-closure/packages/…'` failures (spurious nested path). Fixed by re-running the copy with an explicit `cd`-anchored loop below. The fresh checkout had NO per-package `node_modules` (nothing existed to corrupt), so no partial state survived; validity was verified before any test ran: `pnpm exec vitest --version` from the scratch = `vitest/4.1.11 linux-x64 node-v24.21.0` (root + all 8 per-package link trees present).

```
cd /home/user/dsh-plugins/dsh-agent-team/.worktrees/pre-alpha3-prf-closure && for d in packages/*/node_modules; do cp -a "$d" "/home/user/dsh-plugins/dsh-agent-team/.worktrees/p6t1-ab-ds3b-base/$d"; done
```

## Full loop command — BASE ×10 (verbatim as executed)

```
BASE=/home/user/dsh-plugins/dsh-agent-team/.worktrees/p6t1-ab-ds3b-base
EV=/home/user/dsh-plugins/dsh-agent-team/.worktrees/pre-alpha3-prf-closure/dev/agent-workflow/evidence/f15-mcp-live-loss/p6t1-ab-attribution/dataset3b
mkdir -p $EV
echo "════ BASE pre: $(date -u +%Y-%m-%dT%H:%M:%SZ) ════"
echo "HEAD pre: $(git -C $BASE rev-parse HEAD)"
echo "porcelain pre: [$(git -C $BASE status --porcelain | head -3)]"
for i in 01 02 03 04 05 06 07 08 09 10; do
  {
    echo "# p6t1-parallel A/B — DATASET 3B, run $i (TREE: base)"
    echo "# WORKTREE: $BASE"
    echo "# HEAD: $(git -C $BASE rev-parse HEAD)"
    echo "# CMD: pnpm exec vitest run packages/runtime/test/p6t1-parallel.test.ts"
    echo "# START: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "# NOTE: scratch worktree RECREATED @ 0a0a19a6 per the parent ruling (dataset-3b; branch (iii) combined path); node_modules = cp -a from the PR-F worktree (pnpm-lock.yaml + package.json byte-identical across 0a0a19a6/3b7039e8, disclosed); ASYMMETRIC by design: base-only x10 testing the base occurrence rate of the unexonerated P2 signature (the folded rate is already recorded ~3/~30)"
    echo "────────────────────────────────────────────────────────────"
  } > $EV/base-run$i.log
  ( cd $BASE && pnpm exec vitest run packages/runtime/test/p6t1-parallel.test.ts >> $EV/base-run$i.log 2>&1; echo "# EXIT: $?" >> $EV/base-run$i.log )
  echo "run $i done $(date -u +%H:%M:%SZ): $(grep -E '^\s+Tests  ' $EV/base-run$i.log | head -1) $(grep 'EXIT' $EV/base-run$i.log)"
done
echo "════ BASE post: $(date -u +%Y-%m-%dT%H:%M:%SZ) ════"
echo "HEAD post: $(git -C $BASE rev-parse HEAD)"
echo "porcelain post: [$(git -C $BASE status --porcelain | head -3)]"
```

Pre-state (recorded by the loop): `HEAD pre: 0a0a19a603db7ef5c560a05895835462372f5910`, `porcelain pre: []`. Post-state: `HEAD post: 0a0a19a603db7ef5c560a05895835462372f5910`, `porcelain post: []` (loop window 06:02:19–06:02:30Z UTC). **Result: 9/10 GREEN; base-run05 = P2 (L193, `expected 2 to be +0`, N=5 raised quotas) — EXONERATION TRIGGERED** per the ruling's outcome clause (see `AB-ATTRIBUTION.md`, DATASET 3B section).

**Worktree deletion (post-loop, per the ruling "worktree deleted + disclosed after"):**

```
git -C /home/user/dsh-plugins/dsh-agent-team worktree remove .worktrees/p6t1-ab-ds3b-base --force
```

Verified: zero `p6t1-ab*` worktrees remain after deletion (`git worktree list | grep -c p6t1-ab` = 0). Per-log attribution survives in each raw log's vitest `RUN` header (`RUN v4.1.11 /home/user/dsh-plugins/dsh-agent-team/.worktrees/p6t1-ab-ds3b-base`).

Serialized: no host-port kit run in flight during this loop (the prf kit fresh-world re-runs are separate sequential host runs; this loop used no host ports — vitest in-process only).
