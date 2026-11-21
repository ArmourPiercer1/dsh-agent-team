# P0 — the retirement-first plan (2026-11-21)

> **Status: INVENTORY / DECISION INPUT. No product code, no assembly, no Authority, no
> deletion is changed by this directory.** It exists so that the *next* PRs can delete
> whole modules instead of negotiating with them.

## Why this directory exists

The UTE G1 round measured eight families on both paths and produced **0 of 8 retireable**:
27 members, 87 body files, 31 blocking differences, **0 approvals**. That was not a
measurement failure — it was a *criterion* failure. `OldBaseline ∧ NewPathVerified ∧
SemanticDifferencesResolved ∧ NegativeControlsPass` makes the new mechanism wait for the
old one to sign off, and the old one's signer is the owner, who is the party asking for
the migration. An engine that needs a signature to move, whose only signer wants it moved,
stalls.

The owner's ruling of 2026-11-21 replaces that criterion:

1. **Retirement before development.** Where a module belongs to a route we have decided
   against, delete the whole module; do not patch it into shape first.
2. **Grade the centre, not the tools.** The central capability (binding, provider faces,
   admission, settlement, stop) is tested against *system* obligations, with no tool
   family bound.
3. **Then bind the families in parallel**, and grade per-family *effects*.

This P0 is the input to (1): **what exists, who serves it today, and what may be deleted
whole.**

## The one measurement that makes the plan possible

In the pinned next host (`tests/deepseek-harness-next` @ `9c2670d3`), every booked
family's native tool already executes **through a provider service**:

| native tool package | provider faces it calls |
| --- | --- |
| `fs/tool-fs` (`read`, `write`, `edit`, `read_image`, `apply_patch`) | `ctx.fs` ×37 |
| `fs/tool-fs-search` (`grep`, `glob`) | `ctx.fs`, `ctx.subprocess`, `ctx.shell` |
| `web/tool-web` (`web_fetch`, `web_search`) | `ctx.web` ×14 |
| `shell/tool-bash`, `shell/tool-pwsh` | `ctx.shell` ×7 / ×8 |
| `shell/tool-bash-persistent` | `ctx.terminals` ×9 |
| `ptc-runtime` | **none** — it spawns its own worker |

So the Team family bodies are not "the only implementation of a capability". They are a
**second declaration** of capabilities the host already declares, plus the enforcement
that belongs in the provider. That is what makes whole-module deletion a real option
instead of a leap.

## Documents

| file | what it answers |
| --- | --- |
| [`01-ASSET-INVENTORY.md`](./01-ASSET-INVENTORY.md) | **generated** from the git tree: 28 modules, 140 files, 30,624 lines, per-file lists |
| [`02-SERVING-CENSUS.md`](./02-SERVING-CENSUS.md) | for each booked name: does the retained path serve it, through which face, and what bucket that puts the module in |
| [`03-RETIRE-KEEP.md`](./03-RETIRE-KEEP.md) | the delete/keep list at **whole-module** granularity, two waves, pairings, preconditions, rollback |
| [`04-SEAMS.md`](./04-SEAMS.md) | the central capability the centre must supply, the five red proofs that grade it, and the `CORE_SEAM_BLOCKER` rule |

## The buckets (one per module, no mixing)

- **A** — served by the retained path **and** carries no governance of its own: deleting it
  changes nothing observable. (Nothing lands here today among the old body modules; the
  dormant `a5p5-tools` barrel is the one A, and it is labelled that way so nobody mistakes
  its deletion for progress.)
- **B** — served by the retained path, but **the only enforcement today**: deletable only
  in the same PR that binds the provider lane. Never alone.
- **C** — at least one booked name has **no** retained counterpart (or the module is
  blocked by a module that does): not deletable at all until that name has a home.
- **KEEP** — an asset the new architecture builds **on** (admission, guard, deny, selector,
  provider binding), not a route to retire.

## Machine gate

```
node scripts/ute-p0-assets.mjs --check    # UTE-P0-ASSETS pass modules=28 files=140 ...
node scripts/ute-p0-assets.mjs --write    # regenerate ledger + 01-ASSET-INVENTORY.md
node --test scripts/ute-p0-assets.test.mjs  # 17 arms, each a mutation that must red
```

The ledger is `dev/agent-workflow/ledgers/ute-p0-assets.json`, **generated** by
`git ls-files` over the module roots. The gate reds when: a listed file is missing; a
tracked file under a module root is unlisted; a file is claimed by two modules; a bucket,
verdict, wave or kind is incoherent; a bucket-B module names no pairing; a bucket-C module
states no reason; the totals stop summing; or the prose inventory stops mentioning a
module. That is the whole point: **an inventory that cannot go stale**.

## What P0 deliberately does not decide

- It does not delete anything, and it does not pre-approve a deletion: the pairings in
  `03` are *obligations*, one per module, not a schedule.
- It does not decide the fate of the three C families (`team_skill`, `subagent_fork`,
  `exit_plan_mode`) — that is an owner question, and it is written as one.
- It does not touch `ControlService`, the settlement route, the Authority pointer, the
  active plan, or any product assembly.
- It does not claim `NewPathVerified` for anything. Whole-module deletion is *not* a
  safety verdict; it is the removal of a duplicate declaration, and the safety argument
  for each wave is the pairing, not the deletion.
