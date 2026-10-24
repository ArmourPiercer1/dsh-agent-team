# EB E0–E1 — implementation stops here: final SHA, materials, unknowns, and the switch path

Authored 2026-10-23 (UTC) at root's closure instruction. **This line stops implementing after this
file.** No new checker, no new review round, no Host run, no PR #361 merge, no E2.

## Coordinates

| item | value |
| --- | --- |
| branch | `task/eb-e0-e1-doc-baseline-20261029` |
| worktree | `.worktrees/eb-e0-e1` (exclusive to this line) |
| last SHA before this file | `cab9dba3908d1d7dab796f4047646d0b40bf881a` |
| tip SHA | read `git rev-parse HEAD` on the branch (this file has been amended since round 1; the tip is also the pushed `refs/heads/task/eb-e0-e1-doc-baseline-20261029` head). Round-1 tip `00e13e9ca…`; delivery-CI closure tips `b644a28f8…` then `9d8e24f9d…`, at which pr-gate / candidate-protection / census-runtime all completed success |
| PR | **#362**, open, draft — the line's vehicle; never merged by this line |
| base of the line | `929fc4af23725a1de4cda9206eb7abb149b1bf12` |
| PR #361 (untouched) | open, draft, **unmerged**, head `b97ffdafdceeb73d58a06fe5fb6563820d063d28`; its two plans unmigrated |
| working tree at handover | clean, no uncommitted changes |

## Where the materials are

**Entry surfaces (what a new agent reads, in order)**

- `README.md` → "CURRENT navigation (2026-10-23, this checkout, EB-E0/E1 docs line)" bullet
- `dev/engineering/README.md` — four axes, acceptance levels (with the PR #355 citation and its
  not-in-this-tree qualification), what the tools can and cannot see, the frozen-docs boundary,
  and the new **"Where this line has NOT exited"** section
- `dev/engineering/work-package-authorization.md` — the durable authorization record (verbatim
  mandate, PR #361 pinned SHA, the 20:57→22:20 grant table, per-id layering)
- `packages/{contracts,runtime,tools,testkit,domain,storage,remote,client,legacy}/README.md` — 9 of
  9 packages resolve to their own navigation file

**The tools this line built**

- `scripts/docs-sync.mjs` (`--check` / `--write`), `scripts/docs-probe.mjs` (`--base`),
  `scripts/doc-checks.mjs` (checks incl. the specificity-based owner map),
  `scripts/contracts-field-agreement.mjs`, `scripts/generated-write.mjs`,
  `scripts/doc-consistency-controls.mjs` (the 94 controls)
- `dev/engineering/registry.yaml` (12 entries, C1 only), `registry.schema.json`,
  `doc-ownership.yaml`, generated `current-state.json`
- `docs/contracts/engineering-baseline/INDEX.md` (generated) and `ids.yaml` (18
  `proposed-not-ratified` + 1 `idea-no-execution-authority`)

**Evidence already on the branch (37 tracked files, `dev/agent-workflow/evidence/EB-E0-E1/`)**

- `exit-evidence-sources.md` — §§7–13: the CI/C1 ruling and its retraction, acceptance levels read
  from source, the cold-read result with its 11-row gap table and disposition
- `baseline-inventory.md` — EB0-1…EB0-5 **read-only tree census**, each fact labelled by its source
- `eb0-baseline-from-receipts-20261024.md` — EB0-1…EB0-5 **assembled from receipts that already
  existed**, which is not the same as EB0 being complete: it is an inventory with samples, most rows
  n = 1, and EB0-5 has no same-platform selector p50/p95 study. It carries the field-level authority reconciliation, hosted CI durations with their queue caveat,
  the shipped-package attribution sample, install/cleanup/capacity receipts with the shared-volume
  disclaimer, and the window-4 timing decomposition whose unattributed ~14.9 s tail is left UNKNOWN
- `integration-freeze.md` — satisfied vs unsatisfied freeze conditions, in its own words
- `controls-run-1.log` … `controls-run-27.log`, `controls-failures-1.log`,
  `mutation-control-1.log`, `mutation-control-2-legacy-mirror.log`,
  `decision-record-negative-controls-1.log` (the decision/id placement rules proved able to fail),
  `adoption-diff-status-generated-line.patch` (prepared, **unapplied**), `probe-run-1.log`,
  `contracts-field-agreement-{1,2}.log`,
  `ci-prgate-f44e-to-ff1f58.log`, `lint-line-1.json`, `catalog-index-preview.md`

## Bounded baseline available from material that already exists (no new runs)

| what | where it comes from | value |
| --- | --- | --- |
| doc-control population | `controls-run-26.log` | 94 controls, 0 failed (author run) |
| contract field agreement | `contracts-field-agreement-2.log` | 20 pairs compared; 13 interfaces + 1 array unpaired; 1 `NOT_CHECKED` |
| registry population | `dev/engineering/registry.yaml` | 12 entries, all `verified_tier: C1` |
| id inventory | `docs/contracts/engineering-baseline/ids.yaml` | 19 entries: 18 proposed-not-ratified, 1 idea |
| runtime lane count | `packages/runtime/README.md` | 34 lane directories (with the print command) |
| lane consumer ledger | `scripts/audit-a5-tool-governance-imports.mjs` + pinned test | 26 booked consumers; 25 direct lane importers; 22 barrel importers |
| CI on the line's heads | GitHub check-runs API, read-only | `pr-gate` + `candidate-protection` reached success on earlier heads; both `in_progress` on `cab9dba39` at read time; the census leg refuses itself inside CI, so green ≠ census measured |
| lint on the line | `lint-line-1.json` | clean, run with `--no-ignore` from the workspace-root binary |

## Unknowns — things this line does not know and did not fake

1. **Performance and resource baselines (EB0-1…EB0-5 as performance)**: never measured. The census
   is a tree inventory; any latency/throughput/memory/resource claim is unsupported.
2. **Integration Freeze**: no candidate SHA frozen, no full-tool matrix run, no replayable C2/C3
   evidence. A green `pr-gate` is not a freeze.
3. **Independence of the controls**: all "94/0" numbers are author runs. No second party re-ran
   them; no CI executes this branch's tooling (EB3-B not built).
4. **C2/C3 in general**: nothing on this branch has real-Host integration evidence; every registry
   entry is C1 by construction.
5. **Ownership**: no accountable role is recorded for any of the 9 packages. Root's 23:03 ruling:
   that is an explicit *unknown*, not a blocker, and no appointment was made.
6. **The four 20260829 frozen documents**: not found in the commit history visible from this
   checkout. The directory that should hold them is tracked and not gitignored (it holds four
   alpha.1-era files), and the two AGENTS.md revisions in this environment disagree about its
   tracking status — this tree's says tracked since 2026-10-07 with the four docs as semantic
   authority, the main checkout's older revision says local/gitignored. Whether the four exist in
   refs elsewhere is unknown here; nothing was reconstructed, and no remote search was run.
7. **Contracts coverage beyond the 20 pairs**: 13 interfaces and 1 array have no pairing; 1 field
   set is `NOT_CHECKED`.
8. **Whether the generated view has any consumer yet**: by design it has none, so "parallel run"
   today means "generated and checked, not consulted".

## The old entry, the parallel run, and the one-time switch

- **Old sole consumption entry**: `dev/agent-workflow/graph.yaml#current_contract` — still the
  authority; untouched by this branch (not one byte).
- **New fact relation**: `dev/engineering/registry.yaml` (authored claims) + generated
  `current-state.json` (derived view, which mirrors the old pointer read-only).
- **Parallel-run diff today**: the generated view is fresh (`docs:sync --check` 0) and mirrors the
  old pointer; no consumer reads it as authority; therefore the two cannot yet disagree in any
  observable way — which is exactly the precondition the plan wants before a switch.
- **The switch (PR #361 execution-plan :56)**: move the *single* consumption entry to the new
  relation in one move, so that no state has "two editable currents"; the old state then becomes
  read-only history. Plan :53 requires the parallel phase first, with "旧/current 对账" as its
  acceptance.
- **Status**: `not_started_requires_coordination`. **Owner**: not this docs branch — it moves a
  shared consumption entry, so it needs root's coordinated window (root has said it will arrange a
  window that does not disturb Alpha.5) and, per the plan, the Workflow/Doc owner decision on what
  the consumers become. **Path**: pin a candidate SHA → re-run `docs:sync --check` and the 94
  controls on that SHA → reconcile old vs new by hand once → change the consumer(s) in one commit
  → keep the generated view read-only afterwards. Any switch commit must cite the candidate SHA it
  was verified on.

## Batch status at 2026-10-24 (merge authorized; root executes it, not this line)

The user answered root's question at **09:09:04Z**: *"同意，该批最终验证通过后合并，暂不切换权威入口，也暂不
合并 PR #361 的整份计划"*. So this non-authoritative documentation/tooling base batch may be merged once its
final verification is green — by root, after an independent scope read of the same SHA. Contents in one
list: the read-only doc tools and their fixtures; the generated view with the six-field `legacy_authority`
mirror; the 9 package READMEs; the five comment-only governance-header files (no behaviour, disclosed in
`integration-freeze.md`); the `install_bundle` decision record `EB-ADR-0004` and its open item
`IDEA-EB-0002`; and the reading entry points. Never in it: `AGENTS.md`, `graph.yaml`, `docs/STATUS.md`
content, the applied STATUS derived line, any workflow CI enforcement, any EB3 wiring.

## Three states, stated separately (added 2026-10-24)

The line's own vocabulary insists that implementation, verification and adoption are different
axes, so the handover says them separately instead of averaging them into "done":

| axis | state | the evidence for that word |
| --- | --- | --- |
| **Implementation** | built and in the tree | `docs:sync` / `docs:probe` / `doc-checks` / `contracts-field-agreement` / `generated-write` / 94 controls in `scripts/`; `dev/engineering/` data set; 9 package READMEs; 38 tracked evidence files |
| **Verification** | measured, author-run, externally confirmed on the delivery itself | 94/0 controls (author runs, never independently re-run); cold read 7/7 with caveats; `a5p5-dormant-audit` 9/9 after the token fix; **hosted CI at `9d8e24f9d…` all three green** -- pr-gate 87 s, candidate-protection 14 s, census-runtime 1042 s (verified by reading the check-runs API, not by assertion) |
| **Adoption** | **zero consumers switched** | `view.migration.migration_of_legacy_consumers = not_started_requires_coordination`; every executable consumer of `current_contract` still reads `graph.yaml`; the only reader of the generated view reads a *mirror of the old*, so treating it as the switched consumer would be circular |

Adoption is the axis that keeps this line from claiming an E1/E0 exit, and no amount of green on the
other two changes it.

## The actual consumers of the old pointer, and the one-to-one map

Executable consumers found by reading the code (not by guessing from file names):

| consumer | what it does with `current_contract` | new candidate entry | verdict for a switch |
| --- | --- | --- | --- |
| `scripts/ci-pr-gate.mjs` (Q1–Q8, shared file, not this line's) | grades the block: exactly-one block, `phase_id` grammar, all three doc targets must exist, baseline exactly 40 hex and an ancestor; Q6 forbids any other file re-declaring a baseline and pins `REF_CANON = dev/agent-workflow/graph.yaml#current_contract` | nothing equivalent -- the registry validates *claims*, not the current pointer | **cannot switch**; the gate would have to grade the new relation, which is a shared-file change outside this line |
| `packages/testkit/test/a5-current-contract.test.ts` | pins the production path and its negatives (missing block must FAIL, duplicate baseline inside the block fails, `phase-baseline-ref` marker grammar) | nothing equivalent | **cannot switch** for the same reason |
> Read exactly, from `ci-pr-gate.mjs`: **Q3** requires all six fields (`phase_id`, `active_plan`,
> `backlog`, `matrix`, `baseline`, `baseline_collected`) to appear exactly once inside the block, and
> **Q2** additionally requires the three document targets to exist. So `backlog` and `matrix` are
> switch-blocking (a view without them cannot answer Q2), `baseline_collected` is presence-blocking
> only (its value feeds `info.contract`, no verdict uses it), and the gate reads `graph.yaml`, never
> the view.

| `scripts/gen-current-state.mjs` | reads the block, emits `legacy_authority` (3 of 6 fields) into the view | *is* the bridge | already migrated in the read-only direction; extending it is the only cheap prep step |
| `scripts/docs-probe.mjs` | prints the view's mirror as `viewMirror`, and states it complements rather than re-implements the gate | consumes the bridge | no switch needed; would become circular if called the new consumer |
| `scripts/doc-checks.mjs` | `PLAN_CITATION_CONFLICT`: plan `phase_id` must agree with the pointer | could read the registry later | keep on the old store until the registry carries `phase_id` with equal force |
| marker prose: `AGENTS.md` + the three `docs/plans/active/alpha5-tool-io-governance/` files (`phase-baseline-ref` markers) | the human/agent-facing "where is current" entry, enforced by the gate's Q6/`REF_CANON` and the testkit marker tests | the entry order in `README.md` → `dev/engineering/README.md` | **this is the only surface a small window could actually move**, and even then only its wording, not the store |

## The one parallel-run reconciliation that was actually performed (2026-10-24, read-only)

Field-by-field, at `9d8e24f9d…`: `phase_id`, `active_plan`, `baseline` **equal**; `backlog`, `matrix`,
`baseline_collected` **not mirrored**; view adds `baseline_exists` / `baseline_is_ancestor_of_head` =
true. Full table, the consumer column, and the two parser mistakes made on the way (one of them mine,
in an ad-hoc script, which disagreed with the shipped generator and was wrong) are in
[`eb0-baseline-from-receipts-20261024.md`](eb0-baseline-from-receipts-20261024.md).

So: **the parallel run is evidenced as agreement on the three fields that exist, and as absence on
three that do not.** It is *not* evidence that parallel running is proven in general -- the existence
of a generated file was never the standard, and two of the missing three fields are required by a
live CI leg.

## A small switch window main could actually run (proposal, not action)

Scope deliberately small, reversible in one commit, and it does not touch `AGENTS.md`, `graph.yaml`
or the gate's semantics:

1. ~~Prep~~ **DONE at root's instruction (this round)**: `legacy_authority` now carries all six
   fields, `registry.schema.json` documents the list under `x-generated-view-mirror`, and
   `checkLegacyMirror()` (run by every `docs:sync --check`) enforces the mirror contract —
   `LEGACY_MIRROR_INCOMPLETE` / `LEGACY_MIRROR_VALUE` / `LEGACY_MIRROR_SCHEMA_MISMATCH`, with the
   mutation control in `mutation-control-2-legacy-mirror.log`. The `MIRROR_VALUE` leg is the code
   form of the semantic rule: the mirror copies the graph, it does not resolve it, so the frozen
   `baseline` can never be quietly replaced by the live HEAD and `matrix` never becomes a live tool
   table. No authority moved; `ci-pr-gate` is untouched and never reads the view.
   Reconciliation at pinned `01640829ec8e4765fa3b9d1d0c8e6a554de75171`: **6 equal, 0 mismatch**
   (`legacy-mirror-reconciliation-01640829.md`).
2. **Reconcile once at a pinned SHA:** re-run the field table above on that SHA and commit the output
   as evidence. Acceptance: all six fields equal, plus the two derived proofs true.
3. **Move one narrative consumer, not the store — prepared, NOT applied.**
   `adoption-diff-status-generated-line.patch` adds exactly one derived read-only line to
   `docs/STATUS.md` under the update-discipline line, carrying the six mirrored values and naming
   `current-state.json#legacy_authority` as its source and `graph.yaml#current_contract` as the
   authority and sole write point. `docs/STATUS.md` is **not** this line's file, so the diff was
   built against a copy and verified with `git apply --check` (**RC 0**, STATUS still unmodified);
   the pre-apply content hashes `02000a2ca40e…`. Main applies it when it wants the consumer, runs
   `pnpm docs:sync --check`, and rolls back by reverting that one commit — the line is explicitly
   annotated as removable without losing state.
4. **Only after 1–3 sit for a phase** does a real question arise about the gate and the testkit test
   reading the new relation -- and that is a Workflow/Doc owner decision with a shared-file change,
   i.e. not something a docs branch proposes in advance.

Never in this sequence do two editable "current"s exist: the graph block stays the store, the view
stays derived, and the marker grammar stays canonical.

## Explicit non-claims

This file claims no E0/E1 exit. It does not delete or soften any exit condition: the switch, the
performance/resource baselines and the Integration Freeze evidence remain open requirements of the
PR #361 plan, recorded here with the reason each is open (coordination, or measurement this line
was not authorized to perform).
