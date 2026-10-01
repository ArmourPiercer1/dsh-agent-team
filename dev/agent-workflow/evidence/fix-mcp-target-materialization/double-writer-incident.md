# F (fix/mcp-target-materialization) — DOUBLE-WRITER INCIDENT RECORD

Parent-verified evidence (main-session, read-only). For the fix-report section + PR description.
Worktree: /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/fix-mcp-materialization · branch tip (committed) = `a8ac28e8` throughout the incident (NO writer committed during it).

## Timeline (all UTC, 2026-10-01)
| t | event |
| --- | --- |
| ~06:33 | original builder 02e1512b active: increment (a) log (incr-a-*.log), increment-(b) WIP in flight |
| 06:37:~30 | parent issues interrupt #1 to 02e1512b (after a failed send_message "subagent unavailable" — MISJUDGED as death) |
| 06:39:29 | original writes pending.ts (last in-flight write of increment-(b); parent stashed WIP → `wip-increment-b-diff.patch` (15276 B, 06:39) + `wip-increment-b-pending.patch` (4228 B, 06:41) — PROVENANCE SNAPSHOT of the original's uncommitted work) |
| 06:44 | parent dispatches replacement 37c48419 with self-contained brief (believing 02e1512b dead) — DOUBLE WRITER STATE BEGINS (undisclosed) |
| 06:46:16 | replacement's ONLY write this session: router.ts (recovery-offer fix — T1 root cause) |
| 06:46–06:53 | original continues: zz diagnostic hooks added to the frozen test file (6-line expectBlocked hook) + host.ts (ZZ-PORT hooks) + `zz-mtm-engine-check.test.ts` (06:53:33, zz-throwaway) |
| ~06:50:30 | parent interrupt #2 (not settled — original was blocked mid-turn) |
| 06:51 | replacement discovers the instrumentation, reports to parent; parent identifies 02e1512b as the live writer (registry: [running]), issues interrupt #2 follow-up + sequencing order to replacement |
| 06:59:16–06:59:45 | ORIGINAL's final burst: host.ts (06:59:16, increment-(b) port re-touch), requirement-gate.ts (06:59:19 — its own hook, later stripped back to HEAD), provider.ts (06:59:42 — **T4 fix**: per-subject materialization view AFTER the readiness probe, no memoization, + increment-(b) deriveEngineFact failed→DOWN), frozen test (06:59:45 — **T5 fixture correction** world D: `world.root.live.dropResidency` glue seam instead of direct double-handle dispose + its own zz-hook strip restoring the expectBlocked region to HEAD) |
| ~06:59:50 | parent interrupt #3 |
| ~07:00 | 02e1512b STOP CONFIRMED: "was stopped before it finished. It left no closing message." |
| 07:01:52 | replacement deletes `zz-mtm-engine-check.test.ts` per parent order; worktree = exactly 5 modified files, 0 untracked |
| 07:04:53 | quiescence verified: mtimes unchanged since 06:59:45 (5 min) |
| 07:05 | T1–T6 verification IN on the post-06:59 tree: **2 files / 10 tests GREEN, EXIT clean** (`matrix-after-0659-writes.log`; workload identity vs the prior RED run confirmed — no fast-pass artifact) |

## Writer inventory + per-file provenance (current uncommitted diff vs `a8ac28e8`)
| file | Δ | author | content |
| --- | --- | --- | --- |
| packages/runtime/action-router/router.ts | +56/−~14 | replacement (06:46:16, its only write) | T1 fix: `dispatchRecoveryIfOffered` catches the control-service OFFER rejection → rejected offer returns undefined → the original typed block (COMPATIBILITY_BLOCKED) stands instead of ENVELOPE_OUT_OF_BOUNDS replacing it |
| packages/runtime/requirement-facts/provider.ts | +61 | original (06:59:42, atop its increment-(b) WIP) | T4 fix (view-after-probe, per-subject, no memo) + increment-(b) `deriveEngineFact` failed→DOWN 2-state fact |
| packages/runtime/requirement-facts/pending.ts | +43 | original (increment-(b) WIP; last in-flight write 06:39:29, stashed 06:41) | 3-state `materializationFailed` classifier fold |
| packages/runtime/src/plugin/host.ts | +154 | original (increment-(b) WIP; re-touched 06:59:16) | `memberMaterialization` port: target's OWN boundary read + conservative scope fold (replacement re-diffs vs the 06:39 patch as commit prep) |
| packages/runtime/test/mcp-target-materialization.test.ts | +18 (net; 1 hunk @@ -710) | original (06:59:45) | world-D cold fixture correction ONLY (7 old → 11 new lines + the zz-hook strip restoring the expectBlocked region to HEAD). T5 assertion block (it @ ~L847: slotCAtBoot undefined / follow-up ADMITTED / cResumed=true / slotCAfterResume 'mounted') UNCHANGED. T4 leg (world E) byte-unchanged. T5 was RED pre-correction (cResumed=false) — no weaker prior pass exists |

Overlap (files touched by both writers): NONE at the file level — router.ts = replacement only; the other four = original only (the replacement made zero writes to them this session). The two writers' T1 theories were independent (replacement's router fix + the original's provider ordering work for T4) — disjoint concerns.

## Stop confirmations
- 02e1512b: interrupts #1 (#1 @ ~06:37, not settled — blocked mid-turn) / #2 (@ ~06:50:30, not settled) / **#3 (@ ~06:59:50) → STOPPED ~07:00, no closing message** (runtime notice). Registry thereafter: no longer [running].
- 37c48419: active single writer after ~07:00; commit-HOLD honored (no commit; read-only prep only); quiescence of the tree verified at 07:04:53 (no mtime activity after 06:59:45 = no live writer).

## zz diagnostic removal check (parent-verified 07:02)
`grep -rc "zz-temporary\|zz-throwaway\|ZZ-PORT\|ZZ-ENGINE" packages/` → **zero hits** (requirement-gate.ts back at HEAD, hook stripped with no residual diff). `zz-mtm-engine-check.test.ts` → **absent** (deleted 07:01:52 per order). `git status` = 5 modified files, 0 untracked.

## Retention verification (no code loss / no test weakening)
1. **A role contract** (picked `9162e0f1` = content of `1461a6f2bf2a5dc18f1a16b671b6ea5bf552e3fb`): intact — `types.ts`/`index.ts`/`root.ts` UNTOUCHED vs HEAD this session; contract markers present in the working tree: `REQUIREMENT_FACT_SCOPE_ROLES` (3 files), `missing or non-closed role` (1), `MALFORMED_DTO` (2). provider.ts uncommitted hunks (imports / L204 / L241 / L273 / L440 deriveEngineFact) do not touch the role-mapping region.
2. **F increment 1** (`a8ac28e8`, committed): structurally intact by definition (it IS the committed tip; all uncommitted work is a superset on top); its unit face (mcp-target-materialization-unit.test.ts U1–U5) GREEN in the 07:05 run.
3. **Scoped facts realized**: increment-(b) (provider DOWN fact + pending 3-state + host target-read port) + T4 fix all present in the tree; T1–T6 GREEN.
4. **T4/T5 coverage**: single frozen-test hunk (world-D fixture only); T4 leg byte-unchanged; T5 assertions byte-unchanged; T5 RED pre-correction (evidence: incr-b-matrix2 log — no "weaker old pass"); fixture correction moves the world to the PRODUCTION cold path (glue `dropResidency` seam; a direct double-handle dispose leaves the glue registry stale = a plugin-internal fault state the cold guard never sees — traced: the only production team-session dispose paths are the glue's own dropResidency/close/drain; the F15 supervisor budget path is fiber withdrawal only).
5. **No-loss argument**: the stop interrupted the original's TURN, not its FILES — all its uncommitted work is intact on disk (it is exactly the 4 non-router files of the current diff). The 06:39/06:41 WIP patches are the earlier provenance snapshot; host.ts's post-stash re-touch (06:59:16) is the original's own continuation (increment-(b) refinement), being re-diffed against the patch as commit prep. Nothing was discarded: the only deleted file was the zz-throwaway diagnostic (by design).

## Worktree snapshot artifacts (same directory)
- `snapshot-timestamp.txt` (07:02:xx), `01-worktree-snapshot.txt` (status + diff-stat + per-file mtimes), `02-full-uncommitted-diff.txt` (465 lines — the complete uncommitted diff at snapshot time)
- `wip-increment-b-diff.patch` / `wip-increment-b-pending.patch` (06:39/06:41 provenance)
- `matrix-after-0659-writes.log` (07:05 T1–T6 GREEN) + `incr-b-matrix2.log` (prior RED: T4+T5 failing — the coverage baseline)

## Commit plan (pending parent green light, single writer = replacement)
- Commit(s) over `a8ac28e8` with per-file provenance disclosed; fix-report section "DOUBLE-WRITER INCIDENT & RECOVERY" citing this record (timeline, provenance table, stop confirmations, retention checks); PR description MUST carry the incident + the verification that no code was lost and no test was weakened (the 5 retention points above + the RED-baseline log).
