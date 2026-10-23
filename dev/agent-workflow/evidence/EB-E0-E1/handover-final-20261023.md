# EB E0–E1 — implementation stops here: final SHA, materials, unknowns, and the switch path

Authored 2026-10-23 (UTC) at root's closure instruction. **This line stops implementing after this
file.** No new checker, no new review round, no Host run, no PR #361 merge, no E2.

## Coordinates

| item | value |
| --- | --- |
| branch | `task/eb-e0-e1-doc-baseline-20261029` |
| worktree | `.worktrees/eb-e0-e1` (exclusive to this line) |
| last SHA before this file | `cab9dba3908d1d7dab796f4047646d0b40bf881a` |
| final SHA | **this file's own commit** — read `git rev-parse HEAD` on the branch; it is also the pushed `refs/heads/task/eb-e0-e1-doc-baseline-20261029` tip and is printed in the closing report |
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
- `integration-freeze.md` — satisfied vs unsatisfied freeze conditions, in its own words
- `controls-run-1.log` … `controls-run-26.log`, `controls-failures-1.log`,
  `mutation-control-1.log`, `probe-run-1.log`, `contracts-field-agreement-{1,2}.log`,
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

## Explicit non-claims

This file claims no E0/E1 exit. It does not delete or soften any exit condition: the switch, the
performance/resource baselines and the Integration Freeze evidence remain open requirements of the
PR #361 plan, recorded here with the reason each is open (coordination, or measurement this line
was not authorized to perform).
