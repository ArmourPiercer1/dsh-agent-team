# 05 — Implementation plan A0 → D (frozen 2026-11-21)

> This is the plan the owner approved on 2026-11-21. It carries one retraction: **`read` is
> graded before `write` as a TEST ORDER, not because the host requires a prior read** — the
> shipped composition does not (see §3.1, and §3.2 for the obligation that applies only if the
> guard is enabled, which A1 keeps off).
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

**Not yet a closure.** This table is an inventory. The closure is computed separately
(`scripts/ute-cut-closure.mjs`): **192 references** from 109 files — 13 from 6 surviving
production files (each with a declared disposition), 156 from tests whose subject retires, 21
from 16 tests of **kept** capabilities that import a **replaced** entry (they must be re-pointed
in A1, not deleted), 2 historical evidence records — plus **52 committed dist artifacts** that
must be deleted with their sources. Three of those production references are invisible to any
`git ls-files` inventory: a dynamic
`new URL('./confined-*.mjs', import.meta.url)` in `a5sf-realm-row.mjs`, the
`pre-execute-adapter` re-export in `operation-permission/index.ts`, and the dist placements in
`scripts/dist-placements/`.

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
3. **Build** the new centre skeleton: binding assembler; admission slot (addressed by the
   runtime Agent object — see §3.2); the **three contracts** Control consumes
   (`InvocationAuthorityFacts` pre-execution, `DurableAdmission`, `ExecutionFact`); and the
   minimal deny-by-default admission point. Facts recorded *after* execution cannot replace
   the registry's approval-time role: decision, revalidation and one-shot grant consumption
   all need the pre-execution contract, and Stop-before-consume needs it to be able to fail
   closed.
4. **Delete** the 146 files in `03-RETIRE-KEEP.md §1`.
5. **Replace** `agent-bindings.mjs` and `root.ts` with new entries. The team-lifecycle,
   member-management and control-wiring parts are re-authored here — this is the real cost
   of A1 and the reason it is a window and not a PR.
6. **Re-point** Alpha.6 and Control at the three contracts (§2 step 3); both keep their
authority — only their feed changes, from a plane mount table to the centre's contracts.
7. **Prove** the cut with the §5 criteria.

Prohibited inside the window: keeping a dual entry alive across a PR boundary; keeping a
`*_legacy` copy "for reference"; leaving a deleted module's tests green by deleting the
tests with it (a test that no longer has a subject must be *named* in the window's red list).

## 3. B — grade the centre, starting with `read`

### 3.1 `read` comes first — and what is actually enforced (A0 review P0-1)

**Correction to an earlier draft of this plan.** It claimed the host *forces* a read before a
write. It does not, in the shipped composition, and the draft was wrong:

- `packages/fs/tool-fs/src/write.ts:119` takes an intent from `ctx.waterfall('fs/write-intent', …)`
  whose bare default is `undefined` — an unconditional atomic write.
- The listener that supplies `createIfAbsent` / `replaceIfVersion` is
  `packages/fs/fs-observation-policy`, and the base bundle ships it **`disabled: true`**
  (`packages/bundle/base/cordis.patch.yml:292-294`). Upstream's own note records the decision:
  in base-backed profiles every mutating tool runs "against the bare provider", and
  "**a model can overwrite or edit a file it never read**".
- With the row enabled, an existing-file write without a prior observation fails
  `FS_NOT_OBSERVED`; a write whose observed version moved fails `FS_STALE_VERSION`.

So `read` first is **a test order**, not a host invariant — and it is still the right order,
for two reasons that survive the correction: the read axis is the cheaper place to prove
confinement plumbing, and a read establishes the file's existence and content for the test's
own assertions. What must change is the claim around it.

**Three consequences, all mandatory:**

1. **Pin the composition, do not assume it.** Before rung 2 is graded, the suite asserts the
   actual Team product composition: is the `fs-observation-policy` row present and enabled for
   a Member, or not? The answer is recorded as a named fact in the test, with the row located
   in the composition the product ships — a green rung 2 on a composition whose policy row is
   disabled proves nothing about read-before-write.
2. **`E-obs` is conditional.** It is a centre obligation **only if** the guard is enabled. If
   the composition inherits the shipped default, `E-obs` is deleted from this plan rather than
   kept as decoration, and the FS contract is documented as "no observation guard: writes are
   unconditional" in the tool-acceptance matrix.
3. **Test both directions.** Without a negative arm, rung 2 cannot distinguish "the guard
   works" from "there is no guard": `write` to an unread existing file **must** be refused
   when the policy is on, and **must** succeed when it is off. A green that only checks the
   permissive direction is the same defect class as an unbound corpus token — a test passing
   because its precondition silently vanished.

### 3.2 `E-obs`: the obligation when (and only when) the guard is enabled

The observation state is not a property of the FS provider. It is held by the policy plugin:
one `WeakMap` per `apply()`, keyed by an owner derived from the execution actor
(`actor.agent.session`, `fs-observation-policy/src/index.ts:36-52`), keyed internally by
`FsTarget.targetKey`. A shared FS provider therefore establishes **nothing**. The centre must
guarantee three things, and each is separately testable:

1. the **same gate instance** serves the `read` that observes and the `write` that consults;
2. the **same owner** (`exec.agent.session`) is derived for both calls;
3. the **same event scope** receives the `fs/write-intent` waterfall — a lane mounted on an
   isolated scope must still reach the listener the tool's waterfall fires on.

Break any one and every read→write fails `FS_NOT_OBSERVED` while every single-call test stays
green. That is precisely the defect class the second-declarant architecture hid: the old
shadows derived their own execution context, so their observation state could never have been
the host row's. Red proof: the pair with a fresh actor, a per-call provider, or a detached
event scope must fail; the pair as shipped must succeed.

### 3.2b Is A1's cut complete? (the four-zero condition)

`UTE-CUT-CLOSURE` must not merely agree with its own committed report. In the `cut` state it
asserts four zeros, computed against the **frozen A0 snapshot** (so a deleted target is still
recognised as a target, not as "not found"):

```
A1CutPass = RetiredSources == 0            # nothing from the delete set is still on disk
          ∧ SurvivingProductionRefs == 0   # no surviving production file resolves into it
          ∧ RetiredDistArtifacts == 0      # no committed dist artifact for a retired source
          ∧ DuplicateDeclarants == 0       # no booked name has two declarants
```

The first three are static and exact. The fourth is a static pre-filter: the authoritative
check is the binding assembler's own refusal at B, but A1 has no excuse for shipping a realm
where a booked name is declared twice.

### 3.3 The B ladder (each rung is a mechanism, not a tool)

| rung | native tool | mechanism proven | red proofs |
| --- | --- | --- | --- |
| 1 | `read` | the read axis goes through the confined `ctx.fs`; an unauthorised read is refused **at the face**, before the underlying provider | P1, P2, P3 |
| 2 | `read` → `write` | mutation admitted, denied, or escalated by real Control; **and**, when the guard is enabled, observation identity + version survival across the lane (`E-obs`) with its negative arm | P1, P4 |
| 3 | `grep` | subprocess spawn through **`ctx.subprocess` only** (rc.5: spawn-backed, never `ctx.shell`); the child is confined | P2, P3 |
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
| `UTE-P0-ASSETS` (coherence + frozen snapshot + **cut state**) | **green** — and it cannot be the naive "every file exists" check: see below |
| `UTE-CUT-CLOSURE` (references into the delete set) | **green** — every production referrer disposed, every test referrer registered **by file**, and at `cut` time the four zeros of §3.2b |
| new-centre contract tests (P1–P5 with the probe fixtures) | **green** |
| native-probe ladder rungs 1–2 | **green** before A1 merges |
| `docs-sync`, append-only log, CI manifest/workflow parity, test catalog | **green** |
| the old product suites (planes, families, shadows, PA bridge, pre-execute) | **red by construction**, and only as an explicitly enumerated list of retired subjects |

**A gate that demands presence cannot survive the cut it guards** (A0 review P0-2). The
earlier draft required `UTE-P0-ASSETS` to stay green while A1 deletes 146 files it validates
with `existsSync` — a correct deletion therefore failed its own mandatory gate. Split:

- `--snapshot` freezes the **A0 attestation** once (`ute-p0-assets.snapshot.json`,
  content-addressed over the boundary). `--check` reds if the live ledger drifts from it. The
  snapshot is never regenerated to hide a removal.
- `--check` also names the **cut state**: `pending` (every listed file must exist),
  `partial` (**a named RED** — a half-cut realm is a two-declarant realm), `cut` (every
  deletable file must be **absent**, every kept file present).
- `UTE-CUT-CLOSURE` supplies what the inventory cannot: specifiers resolved **textually
  against the frozen snapshot** (so a dangling reference is still visible after its target is
  deleted), dynamic `new URL` references, re-exports, side-effect imports, dist parity, and the
  per-file exemption/disposition registries. Its own negative control deletes a module in a
  throwaway git repo, keeps the import, and requires the check to fail.

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
