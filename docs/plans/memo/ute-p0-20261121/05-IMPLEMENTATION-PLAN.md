# 05 — Implementation plan A0 → D (frozen 2026-11-21)

> This is the plan the owner approved on 2026-11-21, with one correction folded in:
> **`read` is graded before `write`**, because the host's own write path requires a prior
> observed read. §3.1 gives the mechanism; §3.2 turns it into a centre obligation the
> previous draft had missed.
>
> [`03-RETIRE-KEEP.md`](./03-RETIRE-KEEP.md) says **what** goes; this file says **in what
> order, with what gates, and what may not be true while it happens**.

## 0. What this plan replaces

It replaces the per-family equivalence criterion (`OldBaseline ∧ NewPathVerified ∧
SemanticDifferencesResolved ∧ NegativeControlsPass`), which produced 0 of 8 retireable
families and would have forced the new mechanism to wait for the old one's signature. That
criterion is retired as a *blocking* gate; the G1 ledger survives as evidence, not as a door.

It also replaces the idea that the old route can be *repaired into* the new one. Whole
module, or nothing.

## 1. A0 — freeze the boundary (sign once, then no re-negotiation)

The machine ledger is the boundary: `dev/agent-workflow/ledgers/ute-p0-assets.json`,
regenerated from `git ls-files` and graded by `scripts/ute-p0-assets.mjs --check`.

```
UTE-P0-ASSETS pass modules=37 files=180 lines=69512
               delete=146 replace=2 keep=32 wave1=146 wave2=0 findings=0
```

| group | modules | files | lines | disposition |
| --- | --- | --- | --- | --- |
| eight family bodies | 8 | 87 | 17,532 | delete (A1) |
| eight rows + generated barrel | 9 | 11 | 1,256 | delete (A1) |
| five confined shadows | 5 | 5 | 994 | delete (A1) |
| plane, seam, pa-mount-registry, native-tool-admission, native-bash | 5 | 5 | 3,234 | delete (A1) |
| governance-center + tool-dispatch (one group) | 1 | 11 | 4,766 | delete (A1), semantics moved first |
| pa-control-bridge + pre-execute-adapter | 2 | 2 | 4,087 | delete (A1) |
| a5p5-tools (dormant) | 1 | 25 | 4,653 | delete (A1), zero runtime effect |
| agent-bindings + root (assembly) | 2 | 2 | 12,381 | **replace** (A1) |
| **total that goes** | **33** | **148** | **48,903** | |
| `tools/src` (admission) · `control` · `alpha6` · permission algebra | 4 | 32 | 20,609 | **keep** |

The seven rulings that made this table a boundary instead of an opinion:

1. **A1 runs on one long-lived window branch**, not as small always-green PRs. The window
   has its own required-green set (§6) and there may never be a second window in parallel.
2. `team_skill` **gets a home** (a Team provider served into a host-shaped row).
3. `subagent_fork` **gets a home** (a row over the host's `subagent-fork-in-process` provider).
4. `exit_plan_mode` is **dropped** — the host has only a `claude-code-mods` name mapping,
   never a native tool.
5. `packages/tools/src` is **KEEP whole**: guard, builtin-deny and selector are admission,
   not execution; `native-fs-binding.ts` is already the target provider shape.
6. **Closed-world semantics are moved into the new centre before `tool-dispatch` is
   deleted** — that move is its own commit, and it is a prerequisite, not a follow-up.
7. **A1 ships a minimal deny-by-default admission point** so the model-visible tools are
   never unguarded while B is being built; `ute-retirement-gate` / PR #819 is closed rather
   than merged (see §8).

## 2. A1 — delete the old execution system, once

Order inside the window branch (each step a commit; CI green-set from §6 applies to the
window as a whole, not to each commit):

1. **Move** closed-world semantics into the new centre (`domain/tool-governance` and
   `jobs-gateway/cancellation-boundary` stop importing `tool-dispatch`).
2. **Bind** the provider lanes (fs, web, shell, terminals, subprocess, userQuestions, goals,
   sessionProjections) on the Member realm. This is the *pairing* half of every B module.
3. **Build** the new centre skeleton: binding assembler, admission slot (addressed by the
   runtime Agent object — see §3.2), `Invocation` / `Binding` / `ExecutionFact` interfaces,
   and the minimal deny-by-default admission point.
4. **Delete** the 146 files in `03-RETIRE-KEEP.md §1`.
5. **Replace** `agent-bindings.mjs` and `root.ts` with new entries. The team-lifecycle,
   member-management and control-wiring parts are re-authored here — this is the real cost
   of A1 and the reason it is a window and not a PR.
6. **Re-point** Alpha.6 at the three interfaces; alpha6 and control keep their authority.
7. **Prove** the cut with the §5 criteria.

Prohibited inside the window: keeping a dual entry alive across a PR boundary; keeping a
`*_legacy` copy "for reference"; leaving a deleted module's tests green by deleting the
tests with it (a test that no longer has a subject must be *named* in the window's red list).

## 3. B — grade the centre, starting with `read`

### 3.1 Why `read` comes first (owner correction, 2026-11-21)

The host does not need a read for a *bare* write, but the shipped composition does:

- `packages/fs/tool-fs/src/write.ts:119` — a single-slot waterfall `fs/write-intent`
  produces `createIfAbsent` or `replaceIfVersion`; the bare default is `undefined`
  (unconditional).
- `packages/fs/fs-observation-policy/src/index.ts` is that slot, and it **is mounted in the
  base bundle** (`packages/bundle/base/cordis.patch.yml:292`). With it mounted, writing an
  existing file without a prior observation fails `FS_NOT_OBSERVED` ("file has not been
  read — read the file, then retry"), and a write whose observed version moved fails
  `FS_STALE_VERSION`.
- The observation is recorded in a `WeakMap` keyed by an **owner derived from the execution
  actor** (`actor.agent.session`), per provider instance.

So the ladder starts with `read` for two independent reasons: it is needed to *exercise* a
real mutation at all, and it is the cheapest way to prove the read axis before the write
axis. A probe that starts with `write` would be testing the bare default and grading an
architecture we are not shipping.

### 3.2 A centre obligation this correction reveals (`E-obs`)

Because the observation owner is derived from the execution actor and held weakly per
provider instance, the centre must guarantee:

> **The observed-read state that `read` records is the same state `write` consults, in the
> same session, across the lane.**

Two ways to break it, both silent: re-deriving the execution context inside the lane (a
fresh actor → different owner), or constructing a per-call provider instance (a fresh
`WeakMap`). Either one turns every read-then-write into `FS_NOT_OBSERVED` while every
single-call test still passes.

This is exactly the class of defect the "second declarant" architecture hid: the shadow
tools re-derived their own execution context, so their observation state and the host row's
state could not have been the same. `E-obs` is therefore a *centre* obligation (it shapes
the binding and the lane lifetime), not a tool-level detail.

Its red proof is cheap and non-vacuous:

- green: `read` then `write` on the same existing file in one session succeeds;
- red: the same pair with the lane deriving a fresh actor, or with a per-call provider
  instance, must fail with `FS_NOT_OBSERVED` / `FS_STALE_VERSION`.

### 3.3 The B ladder (each rung is a mechanism, not a tool)

| rung | native tool | mechanism proven | red proofs |
| --- | --- | --- | --- |
| 1 | `read` | the read axis goes through the confined `ctx.fs`; an unauthorised read is refused **at the face**, before the underlying provider | P1, P2, P3 |
| 2 | `read` → `write` | observation identity and version survival across the lane (`E-obs`); mutation admitted, denied, or escalated by real Control | P1, P4 |
| 3 | `grep` | subprocess spawn through `ctx.subprocess` / `ctx.shell`; the child is confined | P2, P3 |
| 4 | `web_fetch` | network allow/deny with zero egress when denied | P1, P3 |
| 5 | native persistent `bash` | PTY generation, profile, Stop; the OS boundary is pinned at creation | P4, P5 |
| 6 | `run_code` | nested admission inside PTC (no `ctx.*` face — separate OS-domain route) | P1, P4 |

Honesty constraint carried from G1: on rung 1 a green result may **never** be reported as
"reads are confined" — under snapshot instruments read confinement stays
`CLAIM_NOT_OBSERVABLE`. What a green rung 1 proves is narrower and still real: the request
reached the confined provider and the refusal happened at the face.

### 3.4 The one acceptance sentence for B

> **With the complete old execution system gone, the new centre still calls unmodified
> native DSH tools and independently performs identity binding, authorisation, I/O
> enforcement, Stop, and execution-fact recording.**

What it excludes, in writing: read confinement as an observable claim; PTC's confinement
(no `ctx.*`, OS-domain, graded in C); remote MCP internals; whole-tool worker isolation.

## 4. C — bind the mechanisms in parallel

FS, web, subprocess, PTY, PTC. Rules: a binding may not modify the centre's permission
semantics; a binding may not introduce a second execution kernel; a tool that needs a face
the centre does not have is a **centre** change reviewed as such, not a local workaround.

## 5. D — whole-system acceptance

Multi-agent concurrency, Stop, revocation, crash recovery, native-semantics retention,
host upgrade, release. The old per-family golden vectors are **reference material only**;
they are not a blocking criterion for the new architecture.

## 6. Gates: what stays green, and what is allowed to be red

The window branch (`vnext/a1-cut`) has its own required set:

| gate | status inside the window |
| --- | --- |
| `UTE-P0-ASSETS` (ledger vs tree) | **green** — it is the boundary itself |
| new-centre contract tests (P1–P5 with the probe fixtures) | **green** |
| native-probe ladder rungs 1–2 | **green** before A1 merges |
| `docs-sync`, append-only log, CI manifest/workflow parity, test catalog | **green** |
| the old product suites (planes, families, shadows, PA bridge, pre-execute) | **red by construction**, and only as an explicitly enumerated list of retired subjects |

The red list is a committed file with one rule: **it may only shrink**. A test that is
deleted because its subject was deleted must be listed by name; a test that is skipped
without being listed is a gate failure.

## 7. Risk ledger

| risk | why it is real | control |
| --- | --- | --- |
| A1 leaves the dev branch unusable for a while | the execution route is removed before the centre is complete | one window branch, its own green set, nothing merged to `master` until rung 2 is green |
| unguarded window | `pre-execute-adapter` is the enforcement listener | A1 ships a minimal deny-by-default point before the deletion commit |
| silent capability regression | `tool-dispatch`'s closed-world rules are production-imported | semantics move first, in their own commit, with their own tests |
| observation identity broken | §3.2 — a fresh actor or per-call provider is invisible to single-call tests | `E-obs` red proof on rung 2 |
| fusion returns | history: two entry points, "temporarily" kept | dual entry forbidden across PRs; `NATIVE-DUPLICATE-DECLARANT` structural test (one declarant per booked name) |
| overclaiming safety | read confinement is not observable | `CLAIM_NOT_OBSERVABLE` written into B's acceptance (§3.3) |

## 8. Relationship to open work

- **#821** (this memo + the ledger + the gate): updated to carry this plan; still a draft,
  because it is a boundary to be signed, not a change to merge.
- **#819** (retirement-gate hardening round 2): **closed, not merged.** It hardens a gate
  that A0 retires, and merging it would spend a hosted census on a door that is being
  removed. The branch stays for anyone who wants to revisit it.
- **G1 ledger and the per-family suites**: demoted to evidence. They are the record of what
  the old route did, and the source of the honest defects (`SD-SEARCH-1`) that deletion
  removes for free.
