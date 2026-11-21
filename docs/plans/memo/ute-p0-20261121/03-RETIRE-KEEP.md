# 03 — What goes and what stays (frozen 2026-11-21)

> Generated from `dev/agent-workflow/ledgers/ute-p0-assets.json`; the per-file lists are in
> [`01-ASSET-INVENTORY.md`](./01-ASSET-INVENTORY.md). This file is the decision over that
> list, in the owner's terms: whole module, and never a repair of the old thing first.
> Sequencing and gates: [`05-IMPLEMENTATION-PLAN.md`](./05-IMPLEMENTATION-PLAN.md).

```
UTE-P0-ASSETS pass modules=37 files=180 lines=69512
               delete=146 replace=2 keep=32 wave1=146 wave2=0 findings=0
```

## 0. The rule

**A module is deleted whole, replaced whole, or kept whole.** No partial deletions, no
"port the pieces we like", no editing an old asset so it coexists more comfortably. A
partial deletion creates a third state that nobody owns, and a third state is what
"新旧融合" looks like when it happens by accident.

## 1. Deleted — 146 files, 36,522 lines, all in A1

Grouped by what each one is, because the *grouping* is what carries the safety argument:

| module group | files | lines | deleted with |
| --- | --- | --- | --- |
| `family-{fs,search,web,process,ui}` + 5 rows | 61 | 12,900 | the provider lane each family needs (fs, search faces, ctx.web, ctx.shell+terminals, userQuestions) — the deletion is the *second* half of the pairing |
| `family-{inspect,agent-control,agent-state}` + 3 rows | 34 | 5,787 | `team_skill` → Team skill provider row; `subagent_fork` → row over `subagent-fork-in-process`; `exit_plan_mode` → dropped |
| generated barrel (3 generated files) | 3 | 101 | the last row; it is generated from the rows |
| 5 `confined-*` shadows | 5 | 994 | the same lanes: the shadow existed only because the preset scope resolved the inherited, unconfined service (PD-17) |
| `team-tool-plane`, `family-assembly` | 2 | 2,517 | the new binding assembler |
| `pa-mount-registry` | 1 | 477 | the new `ExecutionFact` interface (Control stops reading a mount table) |
| `native-tool-admission`, `native-bash-tool` | 2 | 240 | the new admission slot + no second `bash` declaration |
| `governance-center` + `tool-dispatch` (one group) | 11 | 4,766 | closed-world semantics **moved first**, in their own commit |
| `pa-control-bridge`, `pre-execute-adapter` | 2 | 4,087 | the three centre interfaces + a minimal deny-by-default admission point shipped in A1 |
| `a5p5-tools` (dormant) | 25 | 4,653 | nothing — zero runtime effect |
| **total** | **146** | **36,522** | |

The two `*-family` rows for kept-vs-deleted accounting reconcile in the generated inventory,
not here; if these tables and the ledger disagree, the ledger is right and the gate has
already failed.

## 2. Replaced — 2 files, 12,381 lines

| file | replaced by |
| --- | --- |
| `packages/runtime/src/plugin/live/agent-bindings.mjs` (7,138) | a new entry module: fresh file, no reuse of its local functions, old file deleted in the same PR |
| `packages/runtime/src/plugin/root.ts` (5,243) | a new root entry wiring the retained domains (TeamDomain, Control, Alpha.6) to the new centre |

These are not "refactors". Their tool-execution part is deleted; their team-lifecycle,
member-management and control-wiring parts must be **re-authored**. That re-authoring is the
real cost of A1, and it is the cost the owner accepted rather than maintaining two entry
points.

## 3. Kept — 32 files, 20,609 lines

| module | files | why it is not "the old route" |
| --- | --- | --- |
| `packages/tools/src` | 8 | the **admission layer**: guard consult, built-in deny, selector filter, tokens. It decides what is visible and callable; it does not execute. `native-fs-binding.ts` is already the target provider shape |
| `packages/runtime/control` | 5 | the sole Grant/Stop authority; verified independent of the old route at the type level (its only mention of `pa-control-bridge` is a comment). Only its *feed* changes |
| `packages/runtime/alpha6` | 12 | zero references to `team-tool-plane`, `governance-center`, `pa-mount-registry`, `a5p5-tools` (measured). It keeps its core and loses the adapters that reached into the plane |
| `operation-permission` algebra (7 files) | 7 | canonical operation, resolver, coverage, approval routing: what an operation *means* and whether it is allowed. Only the two adapters that reached into the plane are deleted |

The `tools/src` row is the important one to get right. Reading "old execution system" as
"everything under `packages/tools`" would delete the guard and the deny list — the two things
that make the *new* route safe — and that is the failure mode this document exists to prevent.

## 4. The three names that used to block deletion

| name | was | now |
| --- | --- | --- |
| `team_skill` | no host counterpart | Team skill provider served into a host-shaped row |
| `subagent_fork` | provider only, no tool | row over `subagent-fork-in-process`; or dropped if the row proves unworkable |
| `exit_plan_mode` | mod name mapping only | **dropped** — plan mode is not a Team capability |

None of these requires keeping a body "to preserve the capability". That is the whole point
of separating *deleting code* from *dropping a capability*.

## 5. Rollback

- The deletion is one commit range in the window branch; `git revert` restores the modules
  and their rows in one operation.
- No state migration, no data-shape change, no Authority move is involved.
- A revert does **not** restore the old route's guarantees automatically: if the window has
  already bound the new lanes, reverting only the deletion leaves both the new lanes and the
  old bodies mounted, which is a two-declarant realm. Rollback therefore means reverting the
  **whole A1 range**, not a single commit — and that must be stated in the window's README
  rather than discovered during an incident.

## 6. What this list does not authorise

- Not the deletion itself: A0 freezes the boundary, A1 executes it under §6 gates.
- Not touching `packages/domain`, `packages/storage`, `packages/client`, `ControlService`
  authority, the Authority pointer, or the active plan.
- Not a claim that any family is safe to *run differently*. Deleting a duplicate declaration
  is not a proof that the remaining one is confined — that proof is A1's pairing and the
  red proofs in [`04-SEAMS.md`](./04-SEAMS.md) plus `E-obs` in
  [`05-IMPLEMENTATION-PLAN.md §3.2`](./05-IMPLEMENTATION-PLAN.md).
