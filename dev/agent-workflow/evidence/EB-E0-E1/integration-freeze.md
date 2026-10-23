# Integration Freeze — honest status of the E0–E1 line

Authored 2026-10-23 (UTC) in `.worktrees/eb-e0-e1`, branch
`task/eb-e0-e1-doc-baseline-20261029`, base `929fc4af23725a1de4cda9206eb7abb149b1bf12`.
This record exists so that "not yet satisfied" is written down instead of being
inferred from silence.

## Conditions that ARE satisfied

| item | evidence |
| --- | --- |
| exclusive worktree / branch, no co-owner | `git worktree list`; ledger line in the shared `dev/agent-workflow/evidence/COORDINATION.md` (main checkout, untracked shared file) |
| PR #361 remains open, draft, **unmerged**; its two plans stay in place, unmigrated | GitHub API `state=open draft=true merged=false`, head `b97ffdafdceeb73d58a06fe5fb6563820d063d28`, base `929fc4af`; `docs/plans/memo/engineering-baseline/` does not exist on trunk, so there was nothing to move |
| no product / Host / shared-execution-file change | commit touches only `.agents/notes/`, `docs/contracts/engineering-baseline/`, `docs/glossary.md`, `docs/terminology.md`, `docs/ideas/`, `dev/engineering/`, `scripts/doc*`, `scripts/verify-agent-notes.mjs`, `scripts/gen-current-state.mjs`, `tests/doc-consistency/`, this evidence dir, and three additive `package.json` script lines |
| no new dependencies, installs, worlds, Host base, ports | worktree has no `node_modules`; every tool is plain Node builtins; no port was bound (`:3080` untouched) |
| non-destructive | no `prune`, `gc`, `clean`, no recursive delete outside the line's own scratch fixture under the gitignored `.worktrees/eb1-controls-scratch/` |
| negative controls exist and are non-vacuous | `controls-run-1.log` (21 controls, `failed=0`) plus `mutation-control-1.log`, where disabling `checkIdUniqueness` makes NEG-5 fail (`exit 0 != 1`) and restoring makes it pass again |
| derived view cannot launder a claim | `gen-current-state.mjs` refuses `verified_*` with no existing artifact (`FAKE_VERIFICATION`) and `--write` refuses while findings exist (NEG-7) |

## Conditions NOT satisfied (open, by design or by lack of authority)

1. **Superseded 2026-10-23, kept visible because this file is a record.** This item
   read "no merge, no push, no PR — commits exist only on this local branch", which was
   true when written. Under the same-day authorization the branch was pushed for
   read-only review and **draft PR #362** was opened (base `929fc4af2`, `merged=false`).
   Unchanged: no merge, no authority switch, and PR #361 plus both of its plans stay
   exactly where they are.
1a. Promotion of this line's content into any shared gate still needs the coordination
   owner's go-ahead; the E1 entry condition is a coordination decision, not a technical
   one I can grant myself.
2. **E1 entry conditions for CI are unmet.** `docs:probe` / `docs:sync` are **not**
   wired into `scripts/ci-pr-gate.mjs` or any workflow. That file is shared execution
   infrastructure owned by the Alpha.5 line, and its state-freshness leg already owns
   `current_contract` pointer grammar (plus a `phase_status`/Q9 checker on the in-progress
   refs, 19 matches vs 0 at `@929`). Adding a ninth leg is EB3-B and needs agreement.
3. **No formal authority switch.** `graph.yaml#current_contract` is untouched; the
   generated view mirrors it read-only. `.agents/notes/`, `docs/contracts/engineering-baseline/`
   and `dev/engineering/registry.yaml` declare in their own text that they take over no
   execution authority.
4. **Stable ids are `proposed-not-ratified`.** `INV-EB-*`, `REQ-EB-*`, `AC-EB-*` need
   Contract Owner ratification; nothing in this branch may be cited as law yet.
5. **EB1-D (phase-plan interface) not started**; `EB1-D` stays `not_started`. E2 and
   beyond are **not opened**.
6. **Pre-existing document debt is reported, not fixed.** The full check finds issues in
   files this line does not own (`docs/STATUS.md`, `docs/BRANCHING.md`); they are recorded
   as baseline debt rather than edited, because those documents belong to the main line and
   the standing instruction says the old `AGENTS.md` / graph / PR #361 plans stay as they are.
7. **Limits of the checks themselves**, declared rather than hidden: claims inside
   Markdown table cells are not scanned; historical text (round log, `evidence/**`,
   finished plans, frozen contract records) is never retro-flagged; prose semantics remain a
   human judgement; T0 proves no behaviour, so no C1/C2/C3 is implied by a green probe.
8. **Census-level `NOT_VERIFIED`s stand** (see `baseline-inventory.md`): the 93 governance
   records stay `executionEvidence=NOT_RUN`, dynamic MCP instance inventory was never
   collected, and the 8.6 G of unreferenced evidence/recovery data is escalated, not cleaned.

## What would close this record

A coordination decision on (2) and (4), then a small draft PR carrying exactly this
branch's content — opened, not merged, per the standing rule that implementation happens
in a separate small draft PR while PR #361 and both its plans stay where they are.
