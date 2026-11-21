# 03 — Retire / keep list (whole modules, two waves)

> The list is generated into [`01-ASSET-INVENTORY.md`](./01-ASSET-INVENTORY.md) from
> `dev/agent-workflow/ledgers/ute-p0-assets.json`. This file is the **decision** over that
> list, in the owner's terms: whole-module delete, whole-module keep, no repairing the old
> thing first.

## 0. The rule this list obeys

**A module is deleted whole or kept whole.** No partial deletions, no "port the pieces we
like", no editing an old asset so it can coexist more comfortably. The reason is not
tidiness: every partial deletion creates a third state that nobody owns, and a third state
is what "新旧融合" looks like when it happens by accident.

## 1. Wave 1 — delete 66 files (5 families, whole)

Each line is **one PR**, and the PR must contain both halves. The pairing is not a
formality: the module being deleted *is* the enforcement today, so a deletion-only PR
would remove a containment while leaving the tool reachable.

| # | module | files | deleted together with |
| --- | --- | --- | --- |
| W1-1 | `family-fs` + `row-fs` + `shadow-fs` | 17 + 1 + 1 | the fs provider lane on the Member realm, promoted from `packages/tools/src/native-fs-binding.ts` (subclass the host provider, one lane decision, delegate to `super`) |
| W1-2 | `family-search` + `row-search` + `shadow-search` | 9 + 1 + 1 | the search faces (`ctx.fs` + `ctx.subprocess`) on the same realm |
| W1-3 | `family-web` + `row-web` + `shadow-web` | 10 + 1 + 1 | the `ctx.web` lane on the same realm |
| W1-4 | `family-process` + `row-process` + `shadow-bash` + `shadow-terminal` | 11 + 1 + 1 + 1 | the `ctx.shell` and `ctx.terminals` lanes (the terminal provider pins the OS boundary at creation, UTE-10) |
| W1-5 | `family-ui` + `row-ui` | 9 + 1 | the `ctx.userQuestions` passthrough and the present receipt face |

Invariant after every wave-1 PR (and the gate for it):

> **every booked name has exactly one declarant in the shipped realm.** Not "the second one
> is disabled", not "the second one is shadowed": one.

That invariant is the mechanical definition of "the new mechanism took over". It is also
the thing the previous plan could never reach, because a body that is still mounted cannot
be argued away by a green test.

## 2. Wave 2 — delete 31 files, but only after the three C names have homes

| module | files | blocked by |
| --- | --- | --- |
| `family-inspect` + `row-inspect` | 10 + 1 | `team_skill` has no retained path; the two cordis rows are spelled differently |
| `family-agent-control` + `row-agent-control` | 14 + 1 | `subagent_fork` has no retained path (provider, not tool) |
| `family-agent-state` + `row-agent-state` | 7 + 1 | `exit_plan_mode` has no retained path (mod name mapping, not a tool) |
| `team-tool-plane` + `seam-family-assembly` + `rows-barrel` | 1 + 1 + 3 | the three families above; `native-tool-admission` must first be re-pointed at the binding assembler |
| `native-bash-shadow` | 1 | admission carried by the binding assembler instead of a second `bash` declaration |
| `a5p5-tools` (dormant) | 25 | the plane is its only importer; bucket A, so its deletion changes nothing and must not be sold as progress |

**Wave 2 is not "later, someday".** It is gated on three owner answers, and each answer is
one of two kinds:

- *give it a home* — expose the Team capability through a provider served into a host-shaped
  row (the `team_skill` path), or
- *drop it* — an explicit ruling that the capability is not part of the next version.

Either answer unblocks a deletion. Silence unblocks nothing, which is why the question is
written down instead of assumed.

## 3. Keep — 43 files, and why they are not "the old route"

| module | files | why it stays |
| --- | --- | --- |
| `central-tools-src` (`guard.ts`, `builtin-deny.ts`, `tool-selector.ts`, `tokens.ts`, `types.ts`, `tools.ts`, `index.ts`, `native-fs-binding.ts`) | 8 | this is the **admission layer**, not a route: the guard consult, the built-in deny list and the selector filter apply to whatever the host declares, and `native-fs-binding.ts` is already the target shape of a provider lane |
| `central-native-admission` | 1 | a publication slot with no policy of its own; it is how a *native* definition consults admission, which is exactly what survives the plane |
| `family-inspect` / `family-agent-control` / `family-agent-state` (+3 rows) | 31 | bucket C: a booked name has no home |
| (remaining) | 3 | the three C rows are listed above; totals reconcile in the generated inventory |

The `tools/src` module is the important one to get right. It is tempting to read "old
execution system" as "everything under `packages/tools`". That would delete the guard and
the deny list — the two things that make the *new* route safe — and it is the failure mode
this document exists to prevent.

## 4. Rollback

Whole-module deletion makes rollback trivial, which is half its value:

- every wave PR is a single commit range that deletes whole directories;
- `git revert <squash-commit>` restores the module and its row in one operation;
- no state migration, no data shape change, no Authority move is involved in any wave PR.

The one thing a revert cannot restore is a test that was deleted with its module — which is
correct: those tests were the module's own, and re-instating the module re-instates them.

## 5. What this list does **not** authorise

- It does not authorise wave 1 today: each wave-1 PR still needs its pairing built and its
  own gate green.
- It does not authorise deleting anything under `packages/domain`, `packages/runtime`
  (settlement, control, permission), `packages/storage`, or `packages/client`. None of those
  are in scope, and `packages/domain/tool-governance` is the shared read-only algebra that
  `a5p5-tools` consumed.
- It does not change `dev/engineering/current-authority.json`, the active plan, or the
  `AGENTS.md` fork rule. The narrow-fork proposal in #765 remains a proposal.
- It does not claim any family is safe to *run differently*. Deleting a duplicate
  declaration is not a proof that the remaining one is confined — that proof is wave 1's
  pairing (the provider lane) and the five red proofs in [`04-SEAMS.md`](./04-SEAMS.md).
