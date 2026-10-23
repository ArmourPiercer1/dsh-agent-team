# Work-package authorization record (durable, minimal)

Written because every write on the EB-E0/E1 line traced back to a chat message, and a record
that lives only in a chat is not an approval source a later reader can consult. This file
records **what was authorized to whom**; it creates no obligation, grants no new authority,
and is not a contract. Where it quotes, the quote is the authority; this file is the index.

## Mandate, verbatim

> 请你新开一个会话，并行推进PR #361中的工程系统优化。目前可以开展的应该是计划书中的 E0+E1 阶段，
> 进行文档清理和文档校验系统构建。在E1阶段完成前，暂时不要合并 PR #361，以免计划内容被混在其他
> 任务计划书中难以找到、或者在文档清理过程中受到影响。

plus the standing patrol items added in the same message: PR #361 plan progress; whether
Alpha.5 execution state lets PR #361 enter its next stage; whether Alpha.5 can be parallelized
further.

**Plan of record**: PR #361, `docs/plans/memo/engineering-baseline/{architecture.md,
execution-plan.md}`, pinned at commit `b97ffdafdceeb73d58a06fe5fb6563820d063d28` — the sections
in force are E0 and E1. Pinned rather than referenced by branch: the branch moves, the
authorized text does not.

**Boundary that holds regardless of anything below**: PR #361 is not merged before E1 is
complete. E2 and beyond are not open. No product behaviour, no Host run, no new framework, no
E3/CI wiring, no whole-repository coverage target, and no batch id ratification. `AGENTS.md`,
`dev/agent-workflow/graph.yaml`, the Alpha.5 current execution entry points and `docs/STATUS.md`
are outside this work package.

## Narrow grants on this line, in order

| ruling | granted | expressly did not grant |
| --- | --- | --- |
| 2026-10-23 20:57 | write to `dev/engineering/current-state.json`; rename of a stale code name; owner-doc rule = *at least one* declared owner doc changed | semantic equivalence; all owner docs; any other path |
| 21:13 | write to `docs/contracts/engineering-baseline/INDEX.md`, same boundary helper, pre/post verification | the rest of that directory; areas as authority; calling E1 done |
| 21:38 | registry sub-items with a real SHA **and** a real log → `implemented_in_branch` / `verified_local` / C1; new features may say review-pending | whole-card E/F/E1 promotion; `merged` / `released` / C2 / C3; Alpha.5 authority entries |
| 21:42 | one bounded contracts-checker fix, then wiring the registered field check into `docs:probe` and `docs:sync --check` | an AST library; repo-wide coverage; E3 |
| 21:57 | command discipline: one real command per call, redirect only, exit preserved; no reconstructing an RC from a trimmed log | — |
| 22:02 | contracts card statically closed for that scope; header wording fix without a separate review | claiming all three modes covered (`--write` does not run the comparison) |
| 22:20 | `verified_ci` + C1 is a legal orthogonal combination — correct the prose, add **no** "CI requires C2" gate; the 18 REQ/INV/AC + 1 Idea need no per-item go-ahead (see below); package READMEs for `contracts`/`runtime`/`tools`/`testkit` are this line's to write; the owner map is fixed by specificity, first-match-wins is the defect | batch `ratified`; INV-EB-0010 as authority for E4 cleanup; REQ-EB-0004 as E2 authorization; any new product law |

## What the ids carry (recorded here, not in the normative file)

`ids.yaml` is normative and is not edited by this line. Its entries break down as **18
REQ/INV/AC ids carrying `normative_status: proposed-not-ratified`** (10 invariant, 4
requirement, 4 acceptance) plus **1 Idea carrying `normative_status:
idea-no-execution-authority`** — counted in the file itself (`grep -oE "kind: [a-z]+"` gives 10
invariant + 4 requirement + 4 acceptance + 1 idea = 19), not taken from its header comment,
which reads "every entry below is `proposed-not-ratified`" and does not match the Idea's own
value at line 143. Those values are not edited here and say nothing about permission to do
mechanical work on this line. Per the 22:20 ruling:

- **INV-EB-0001 … INV-EB-0008** index the original Alpha.5 contracts. They restate, they do
  not create; the authoritative text is where `source_anchor` points.
- **INV-EB-0009, REQ-EB-0001…0003, AC-EB-0001…0004** are the already-authorized mechanical
  refinement of E1 — the four-axis record, the probe, the sync, and the derived view.
- **INV-EB-0010** protects the boundary index only. It is not authority for any E4 cleanup.
- **REQ-EB-0004** may *describe* a dynamic tool-source derivation. The E2 implementation is
  not authorized; a sentence about a mechanism is not a work order for it.
- **IDEA-EB-0001** is `idea-no-execution-authority`: an idea, carrying no execution
  authority. Nothing promoted it, and its own entry says so.

No batch ratification was performed, and none is implied by this file existing: the 18
REQ/INV/AC ids stay `proposed-not-ratified` and the Idea keeps `idea-no-execution-authority`.
