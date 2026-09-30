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
