# Integration Freeze — honest status of the E0–E1 line

Authored 2026-10-23 (UTC) in `.worktrees/eb-e0-e1`, branch `task/eb-e0-e1-doc-baseline-20261029`, base
`929fc4af23725a1de4cda9206eb7abb149b1bf12`. **Amended 2026-10-24**: four statements below had gone stale
against this branch's own later commits and against the capacity line's work, and a stale freeze record is
worse than none because it reads as current. Amended rows keep the earlier wording as dated history. This
record exists so that "not yet satisfied" is written down instead of being inferred from silence.

## Conditions that ARE satisfied

| item | evidence |
| --- | --- |
| exclusive worktree / branch, no co-owner | `git worktree list`; ledger line in the shared `dev/agent-workflow/evidence/COORDINATION.md` (main checkout, untracked shared file) |
| PR #361 remains open, draft, **unmerged**; its two plans stay in place, unmigrated | GitHub API `state=open draft=true merged=false`, head `b97ffdafdceeb73d58a06fe5fb6563820d063d28`, base `929fc4af`; `docs/plans/memo/engineering-baseline/` does not exist on trunk, so there was nothing to move |
| no **behaviour** change in product code | amended 2026-10-24 — the row used to read "no product change at all", which stopped being true and is replaced by the two rows below rather than quietly kept. Host files, the shared gate `scripts/ci-pr-gate.mjs`, `AGENTS.md`, `dev/agent-workflow/graph.yaml`, `docs/STATUS.md` and every Alpha.5 plan file remain untouched |
| what the branch **does** touch inside `packages/`, disclosed rather than left to be discovered | (a) 9 package `README.md` files, doc-only, one per package, inside this line's write grant; (b) **five files carrying a comment-only correction**: `packages/domain/tool-governance/src/index.ts` plus its four committed build mirrors under `packages/runtime/dist/packages/domain/tool-governance/src/`. The source edit is comment-only (`git diff -U0` on the source yields zero non-comment lines); the mirrors are the repository-standard `tsc` regeneration of it, required because they are tracked artifacts and a stale mirror fails the artifact census; behaviour is unchanged — comment-stripped `.js`/`.d.ts` are byte-identical to the previous ones, and the source maps differ only in `mappings` with no `sourcesContent`. A census that compares committed artifacts cannot distinguish "prose fix" from "shipped change", so this is stated here, not inferred later |
| no new dependencies, installs, worlds, Host base, ports | worktree has no `node_modules`; every tool is plain Node builtins; no port was bound (`:3080` untouched). `package.json` gains **three** script lines (`docs:probe`, `docs:sync`, `docs:controls`); the neighbouring `check:install-manifest` line, which comes from `5b39cab13` on master, differs only by the trailing comma the insertion required. An earlier row here said "three additive lines" in a context that implied they were all docs entries — corrected for precision |
| non-destructive | no `prune`, `gc`, `clean`, no recursive delete outside this line's own scratch under the gitignored `.worktrees/` |
| negative controls exist and are non-vacuous | amended: `controls-run-1.log` (21 controls, `failed=0`) was the state at authoring; the set is **94 controls** now, latest full run `controls-run-27.log` `failed=0`. Alongside it: `mutation-control-1.log` (disabling `checkIdUniqueness` makes NEG-5 fail, restoring makes it pass), `mutation-control-2-legacy-mirror.log` (single-field mutations of the derived-view mirror), and `decision-record-negative-controls-1.log` (an undeclared id, a deleted id entry, a delivery claim in a `proposed/` note, and a dead reference are each caught). All are author runs: no independent re-run of the set has been ordered |
| derived view cannot launder a claim | `gen-current-state.mjs` refuses `verified_*` with no existing artifact (`FAKE_VERIFICATION`) and refuses `--write` while findings exist (NEG-7); the mirror of `graph.yaml#current_contract` covers all six fields and `checkLegacyMirror()` refuses a mirror that resolves instead of copies |

## Conditions NOT satisfied (open, by design or by lack of authority)

1. **Superseded 2026-10-23, kept visible because this file is a record.** It read "no merge, no push, no
   PR", which was true when written; the branch was then pushed for read-only review as **draft PR #362**
   (base `929fc4af2`, `merged=false`). **Amended 2026-10-24:** the user answered root's question at
   **09:09:04Z** — *"同意，该批最终验证通过后合并，暂不切换权威入口，也暂不合并 PR #361 的整份计划"* — so
   merging this non-authoritative documentation/tooling base batch, after its final verification, is
   authorized and **executed by root, not by this line**. As of this writing nothing has been merged: #361
   and #362 are both open and unmerged, and this line does not press that button.
1a. Promotion of this line's content into any shared gate still needs the coordination owner's go-ahead.
2. **E1 entry conditions for CI are unmet.** `docs:probe` / `docs:sync` are **not** wired into
   `scripts/ci-pr-gate.mjs` or into any workflow, and this batch's instruction is explicit that the
   workflow CI enforcement is not to be touched. That gate file is shared execution infrastructure owned by
   the Alpha.5 line; adding a leg is EB3-B and needs agreement. Not done here.
3. **No formal authority switch — and the 09:09:04Z answer does not authorize one.** `graph.yaml#current_contract`
   is untouched; the generated view mirrors it read-only; the prepared `docs/STATUS.md` derived-line patch
   (`adoption-diff-status-generated-line.patch`) is **left unapplied** by instruction, with
   `git apply --check` verified so main can take it or drop it. `.agents/notes/`,
   `docs/contracts/engineering-baseline/` and `dev/engineering/registry.yaml` each state in their own text
   that they take over no execution authority. Adoption remains **zero switched consumers**, which is the
   axis on which no exit can be claimed.
4. **Stable ids are `proposed-not-ratified`.** `INV-EB-*`, `REQ-EB-*`, `AC-EB-*` need Contract Owner
   ratification. The two `IDEA-EB-*` entries carry a different kind of non-authority,
   `idea-no-execution-authority`: they may not be turned into work by citation.
5. **Amended — this row was simply wrong.** It read "EB1-D (phase-plan interface) not started; `EB1-D`
   stays `not_started`", while `dev/engineering/registry.yaml` records `EB1-D` as `implemented_in_branch` /
   `verified_local` / `not_released`, and the phase-plan citation interface plus the Idea-to-Contract rules
   are in this branch. What genuinely remains on the exit path is **EB3-B** (no CI wiring), the
   ratification in (4), the switch in (3), and E2-and-beyond, which are **not opened**.
6. **Pre-existing document debt is reported, not fixed.** The full check finds issues in files this line
   does not own (`docs/STATUS.md`, `docs/BRANCHING.md`); they are recorded as baseline debt rather than
   edited, because those documents belong to the main line.
7. **Limits of the checks themselves**, declared rather than hidden: claims inside Markdown table cells are
   not scanned; historical text (round log, `evidence/**`, finished plans, frozen contract records) is never
   retro-flagged; prose semantics stay a human judgement; a green probe proves no behaviour, so it implies
   no C1/C2/C3.
8. **Census-level `NOT_VERIFIED`s stand** (`baseline-inventory.md`): the 93 governance records stay
   `executionEvidence=NOT_RUN`, and the dynamic MCP instance inventory was never collected. **Amended:**
   this row also asserted "the 8.6 G of unreferenced evidence/recovery data is escalated, not cleaned".
   That was an observation taken at the 2026-10-23 census moment (5.1 G `evidence/retired-trees-2026-10-23/`,
   3.5 G `recovery/`, a 38 M incident, each with zero tracked references *at that instant*); the capacity
   line has since cleaned or protected that material, and a zero-reference count was never evidence about
   whether the content was wanted. It is history here, not a present claim.
9. **EB0 is not an exit either** (`eb0-baseline-from-receipts-20261024.md`): the samples are n = 1 on shared
   infrastructure against a scripted mock, **EB0-5 has no same-platform selector p50/p95 study**, and there
   is no warm/hot pair. Producing one needs repeated runs, which root has not ordered, so it stays open
   instead of being filled with an estimate.
10. **The Alpha.5 install boundary is a scope decision, not progress.** `EB-ADR-0004` + `IDEA-EB-0002`
    record that Alpha.5 declines to promise isolation of `install_bundle`'s install-internal IO — the other
    seven `plugin_manager` actions keep their obligations, and the install action still owes an accurate
    target, real PA plus Host approval, end-point freshness and waitcancel, none of which is implemented or
    tested here. Contract authority for it is main's (`ALPHA5-EFFECTIVE-BACKLOG.md` §D BL20/BL21, whose
    text is not yet in the refs visible from this checkout; current short table row
    `dev/agent-workflow/evidence/a5m2-integration/TOOL-TABLE-CURRENT.md:27` at `c9258f50f…` on
    `feat/a5-m2-integration`), and this line links it rather than restating it.

## What closes this record

History first: at authoring the close read "a coordination decision, then a small draft PR carrying exactly
this branch's content — opened, not merged". That has been overtaken. The draft PR exists (#362), the
coordination answer arrived at 09:09:04Z, and what remains is not a decision but a verification: checks
green on one SHA, that same SHA green in hosted CI, root's independent scope read, and only then root's
merge of the documentation/tooling base batch — authority entry point unswitched, PR #361's plan unmerged.
What no merge closes: the authority switch (3), the CI wiring (2), the ratifications (4), the EB0-5
distribution study (9), and the open install-IO question (10).
