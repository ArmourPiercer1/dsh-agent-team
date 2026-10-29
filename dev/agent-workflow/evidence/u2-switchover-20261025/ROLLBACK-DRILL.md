# U2 rollback drill (design item 6) — executed 2026-10-25 UTC

Throwaway **detached** worktree `.worktrees/u2-rollback-drill-20261025` created at commit C
(`8552597c3`), full checkout (sparse `/*`), reverted with
`git revert --no-edit 8552597c3 f44ca07dd` (the switch commit set: C then B). The worktree was
removed after the drill (`git worktree remove --force`, only path touched). No branch, no push,
zero effect on the live worktree.

## PRE-REVERT (switched state, commit C tree)

```
{"ok":true,"status":"POINTER","pointer_file":"dev/engineering/current-authority.json","snapshot_file":"dev/engineering/authority-snapshots/as20261025r1.json","snapshot_version":"as20261025r1","content_digest":"sha256:220427218281602d572e8749858d08e17c388b9cbb437d68e3f3987869195062",...,"two_current_findings":[]}
loader exit=0
pointer: PRESENT
```

## REVERT

```
[detached HEAD def76092b] Revert "U2 commit C (entry docs): ..."
[detached HEAD 9a05f54f1] Revert "U2 commit B (G2 SWITCH): ..."
revert exit=0   (clean, zero conflicts)
```

## POST-REVERT state

```
pointer: ABSENT (expected)
snapshot as20261025r1.json: ABSENT (expected)
graph.yaml:91 current_contract:  (block restored verbatim)
  phase_id: alpha5-tool-io-governance
  active_plan: docs/plans/active/alpha5-tool-io-governance/current-execution-plan.md
AGENTS.md:2 carrier back to dev/agent-workflow/graph.yaml#current_contract (pre-switch bytes)
```

## CONSUMERS IN THE ROLLED-BACK TREE

| Consumer | Result | Reading |
| --- | --- | --- |
| `current-authority.mjs status` | exit 3 `{"ok":false,"status":"ABSENT","refused":"POINTER_ABSENT"}` | loader's documented ABSENT code — fail-closed for pointer-mode callers; branching consumers gate on `pointerExists()` instead, as designed |
| `ci-pr-gate graph-parse` | **pass** (mapping-keys 52 — block restored) | |
| `ci-pr-gate state-freshness` | **pass**: "current contract ok (phase_id alpha5-tool-io-governance, baseline 9b2ee57bc5af…, matrix rows 26)" | dispatch hit the LEGACY entry (`pointerExists=false` → `checkCurrentContract`): the restored graph block is graded GREEN again — the switch is fully reversible with `git revert` alone |
| census precheck branch | `-e dev/engineering/current-authority.json` false → legacy awk path extracts `9b2ee57bc5afd30e89855e09d1769d2e5ec83912` | precheck follows the authority back to graph.yaml automatically |
| pre-commit fence | exit 0 (pointer fence inert with no pointer; graph fence parses block) | |

## Known pre-existing condition surfaced by the drill (not caused by the switch)

`docs-sync --check` / `docs-probe --base` in the rolled-back tree report
`STALE_GENERATED_VIEW`. Measured here: at the clean pre-switch tree, a fresh full-tree
`build()+renderView()` differs from the committed view in ~337 lines — the committed view on
origin/master was generated in a sparse environment (`legacy_authority.present:false`,
`exists:false` entries). The condition predates U2 and is **fixed forward** by commit B's
regenerated full-tree view (pointer mode, `authority_source_binding`); a rollback returns to
that pre-existing staleness, which the drill records but does not attempt to repair.

## Side-effects note (honesty)

During setup, a `cd` failure made one `git revert` execute in the stale root checkout
`/srv/workspace/dsh-plugins/dsh-agent-team` (HEAD `6259cf4bc`) instead of the drill worktree.
Aborted immediately (`git revert --abort`); verified restored: HEAD unchanged, zero conflict
entries, working tree back to its pre-existing (not-this-task) dirt. Root checkout content
intact. The drill was then re-executed properly in the correctly-pathed worktree, as above.
