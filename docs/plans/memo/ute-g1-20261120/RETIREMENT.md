# RETIREMENT — the four-term predicate, per family

**Part of:** `docs/plans/memo/ute-g1-20261120/` — the frozen UTE G1 implementation
contract. Marker discipline: [`README.md`](./README.md) §0.
**Machine gate:** [`scripts/ute-retirement-gate.mjs`](../../../../scripts/ute-retirement-gate.mjs).
**Ledger:** [`dev/agent-workflow/ledgers/ute-retirement.json`](../../../../dev/agent-workflow/ledgers/ute-retirement.json).

---

## 1. The predicate

`[OWNER-DECIDED]` (D2) For one tool family `f`:

```
RetireAllowed(f) = OldBaseline(f)
                 ∧ NewPathVerified(f)
                 ∧ SemanticDifferencesResolved(f)
                 ∧ NegativeControlsPass(f)
```

`[OWNER-DECIDED]` (D4) The predicate is evaluated **per family**, and families
retire independently: FS may retire before Web/PTY. `[PROPOSED-BY-MEMO]` Two
consequences follow and are binding for UTE-4:

1. **No cross-family inference.** A green term for `fs` is not evidence for
   `web`, `process`, `pty`, `search`, `mcp`, `ptc` or any other family. A ledger
   row must be filled from that family's own evidence.
2. **No cross-axis inference inside a family.** An effect-axis green does not
   establish read confinement (`CLAIM_NOT_OBSERVABLE`), and a write-path green
   does not establish process/PTY lifecycle behaviour. This is #765's R-S3.2,
   adopted verbatim.

### 1.1 What "family" means here: the assembly, not a chosen subset

`[MEASURED]` The FS family is **one indivisible assembly**. Re-read
`packages/tools/families/fs.mjs`:

- `claims: (cap) => [cap.readName, WRITE_NATIVE_NAME, EDIT_NATIVE_NAME, READ_IMAGE_NATIVE_NAME]`
  — four model-visible names: `read`, `write`, `edit`, `read_image`.
- `build()` refuses a partial mount with `PLANE_FS_FAMILY_INCOMPLETE` ("the fs
  family mounts read+write+edit+read_image together; a partial fs lane is a broken
  assembly (fail closed)"), and ONE Registry candidate carries all four row
  definitions (`fs-family-contribution.mjs`, U7-9a).

So "retire the FS family" retires **all four** names. A row that verifies
`read`/`write`/`edit` and calls that `NewPathVerified` is not being conservative —
it is under-claiming the unit, and the gate must refuse it. This was the external
review's first finding on #795/#796 (2026-11-20): the FS golden corpus has no
`read_image` vector (attachment storage, image-capability routing, refusal,
cancellation), yet three of four terms were `true` and only the semantic-difference
term stood between the ledger and an allowed retirement.

`[MEASURED]` A reviewed, machine-readable member census already exists:
`dev/agent-workflow/ledgers/arc-a-family-census.json` books, per family,
`familyId`, the `lane` that owns the contribution, and `nativeNames` (e.g.
`dsh.fs-family` → `(bound-definition) read|write|edit|read_image`). It is
protected by its own fitness gate: an unbooked or vanished family is red
(`census-missing` / `census-stale`, ARC-A L3). **Therefore the unit is derived
from the census, not from this ledger**: a row declares `unit.familyId` and the
gate reads the members from the census file.

| ledger says | gate answers |
|---|---|
| no `unit` block | `UTE_UNIT_UNDECLARED` — a row without a unit cannot be graded |
| `familyId` not in the census | `UTE_UNIT_UNKNOWN_FAMILY` |
| declares fewer members than the census books | `UTE_UNIT_UNDERCLAIMED` |
| declares a member the census does not book | `UTE_UNIT_OVERCLAIMED` |

`[PROPOSED-BY-MEMO]` A family may be split into smaller retirement units **only
when the split is proven at runtime** (each sub-unit mounts and switches
independently, with its own evidence), and then the census books the sub-units.
Editing the ledger is not a split; renaming a member is not a split.

`[PROPOSED-BY-MEMO]` Consequence for FS today, stated plainly: its retirement unit
is four tools, the corpus covers three, so FS **is refused for coverage** — the
true state, not a paperwork problem.

`[OWNER-DECIDED]` (D3) `SemanticDifferencesResolved` may be satisfied by an
**approved semantic change**, not only by byte equality. It is therefore *not*
"the two paths look the same"; it is "every difference is recorded, and every
retirement-blocking one has an approval that names the interface being adopted".

## 2. What proves each term

Each term has (a) a required evidence artifact, (b) a check the gate performs on
it, and (c) a named refusal code when it does not hold. The ledger only *points*;
the gate re-reads the committed file and requires it to contain the claimed
verdict token.

| term | must be established by | what the gate checks | refusal code |
|---|---|---|---|
| `OldBaseline` | a committed baseline record of the **old** path for this family: request → observed effect/verdict, with the host pin and the governance seam named (FS example: `tests/ute-g1-fs/golden/old-path.tsv`, identity in `old-path.meta.txt`) | the file is committed, readable, contains every `expect` token, contains no `contradicts` token; the term's `verdict` is `true` | `UTE_OLD_BASELINE_MISSING` |
| `NewPathVerified` | a committed verdict from the **new** path for this family, on the pinned next host, through the host's own executor (FS example: `PROTOTYPE-VERDICT GREEN vectors=10 failed=0` in `dev/agent-workflow/evidence/ute-g1-fs-20261119/new-path-run.txt`) | same evidence rules; the verdict token must be present verbatim (a `GREEN` that exists only in prose fails) | `UTE_NEW_PATH_UNVERIFIED` |
| `SemanticDifferencesResolved` | the family's recorded differences list, each with `blocking` and — when blocking — an `approval` carrying `by`, `on` (YYYY-MM-DD) and `record` (a committed approval file that names the approver). FS example: `tests/ute-g1-fs/golden/SEMANTIC-DIFFERENCES.md` | the term is **derived**, not asserted: `verdict:true` cannot survive a blocking difference without an approval; the approval record is itself checked as evidence (committed, names the approver) | `UTE_SEMANTIC_DIFFERENCES_UNRESOLVED` (plus `UTE_EVIDENCE_*` for a bad record) |
| `NegativeControlsPass` | the family's own negative controls: a committed transcript where each claim has a control that fails when the claim is false, and a positive control proving the control is not vacuous (FS example: `NC-VERDICT GREEN controls=4 failed=0`) | same evidence rules; the transcript must state the verdict, not just list controls | `UTE_NEGATIVE_CONTROLS_FAILING` |

`[PROPOSED-BY-MEMO]` **Unit coverage is a precondition of a term being
established**, so it is graded *inside* the term it invalidates rather than as a
fifth term (the owner's predicate has four terms, D2):

| coverage check | derived from (never from a self-asserted token) | refusal code (term) |
|---|---|---|
| the row's unit exists and equals the census unit | `unit.familyId` → `arc-a-family-census.json` `nativeNames` | `UTE_UNIT_UNDECLARED` / `UTE_UNIT_UNKNOWN_FAMILY` / `UTE_UNIT_UNDERCLAIMED` / `UTE_UNIT_OVERCLAIMED` |
| every unit member has at least one **baseline** vector | `oldBaseline.evidence` file parsed as TSV: header row with `id` and `entry`, one data row per vector; `entry` is the member | `UTE_MEMBER_UNCOVERED` (`oldBaseline`) |
| every baseline vector is **reproduced** by the new path | the same TSV's `id` values, each required to appear as `NEW-PATH-VECTOR <id> PASS` in `newPathVerified.evidence` | `UTE_VECTOR_UNREPRODUCED` (`newPathVerified`) |
| every covered member has at least one negative control of its own | `negativeControlsPass.evidence` must contain one `NC-MEMBER <member>` line per member that has a baseline vector | `UTE_MEMBER_UNCOVERED` (`negativeControlsPass`) |
| the declared old path is still in the tree unless the row is allowed | `oldPath.files` (repo-relative, tracked) + the working tree | `UTE_OLD_PATH_PARTIALLY_REMOVED` |

`[PROPOSED-BY-MEMO]` Why these are derived, not declared: the baseline TSV is a
measured artifact whose `entry` column is the tool that produced the effect; the
new-path evidence is the prototype's own transcript. A row cannot fake coverage by
writing "read_image covered" into the ledger — the gate looks for a vector row,
and there is none. A TSV without `id`/`entry` columns is refused as
`UTE_UNIT_UNGRADABLE` rather than guessed at.

Evidence is checked for **every** term that carries a pointer, including a term
whose verdict is already `false` (a row that names a nonexistent or contradictory
file is not "honestly blocked", it is ungradable):

| condition | code |
|---|---|
| pointer missing, absolute, `..`-escaping, untracked by git, unreadable, or carries no `expect` tokens (a vacuous claim) | `UTE_EVIDENCE_UNREADABLE` |
| file is committed and readable but does **not** contain the claimed verdict token, or contains a declared `contradicts` token | `UTE_EVIDENCE_CONTRADICTED` |
| no row for the requested family | `UTE_LEDGER_UNKNOWN_FAMILY` |
| `state` is not one of the closed set, or `state` disagrees with the computed predicate in either direction | `UTE_STATE_CONTRADICTED` |
| the ledger itself is absent, unparseable, wrong schema, duplicate/nameless rows | `UTE_LEDGER_SCHEMA` (exit 2: cannot grade) |

`[PROPOSED-BY-MEMO]` (P5) The `state` field is a **mirror**. The predicate is
computed from the four terms; the gate will not let `state:RETIREABLE` out-vote a
failed term, and it will not silently pass a row whose terms all hold but whose
state was never flipped. Flipping `state` is a human act after the gate allows.

## 3. Who approves `SemanticDifferencesResolved`

`[OWNER-DECIDED]` (D3) The difference may be resolved by an approved semantic
change. `[PROPOSED-BY-MEMO]` (P4) The approval is:

- **signed by the owner** — not by the implementing agent, not by the
  Integration Owner acting alone, and never by the executor. The Integration
  Owner may *transcribe* an owner ruling into the record; transcription is not
  approval.
- **dated** (`on: YYYY-MM-DD`, the real UTC date of the ruling).
- **named** (`by: <approver>`), and the record file must contain that name so the
  gate can check the signature is not invented.
- **scoped** to the ledger row and the difference id(s) it covers, and it states
  **which compatibility interface** is adopted (§4) and **which branches are not
  covered** (e.g. "provider pinned for determinism; the by-route branch is not
  covered").

`[UNKNOWN]` The record *path convention* (`dev/agent-workflow/evidence/<task>/…`)
is this memo's proposal; the owner may choose another committed location. The
gate accepts any committed path declared in the ledger's `approval.record`, so a
different convention is a ledger edit, not a gate change.

`[PROPOSED-BY-MEMO]` An approval of one difference is not an approval of another,
and an approval for FS is not an approval for Web/PTY. Approvals do not expire by
time, but they are scoped: moving the host pin or changing the provider
implementation re-opens the question and the approval record must be re-issued
(a new dated record; the old one is never edited).

`[PROPOSED-BY-MEMO]` (P4b) **An approval must be reference-bound.** The record
naming the approver is necessary but not sufficient: a name in a committed file
proves transcription, not authority. The approval therefore also carries a
machine-checkable reference to a real, already-merged act of approval:

```
"reference": "PR #<n> @ <40-hex merge commit>"
```

and the gate refuses (`UTE_APPROVAL_UNREFERENCED`) unless the 40-hex resolves to a
commit that exists in this repository and is an ancestor of the graded HEAD. That
is what makes "the owner approved it" traceable to a PR and a commit instead of to
a string. `[UNKNOWN]` Whether the owner prefers a PR review id, a specific
protected-branch setting, or a release note; the *requirement* of a resolvable
reference is the proposal, the reference format is the owner's to change.

`[PROPOSED-BY-MEMO]` **Honest limit, stated so it is not oversold:** the gate is
a *retirement evidence and licence checker*, not a cryptographically independent
authorisation service. It proves (a) the evidence is committed and says what the
row claims, (b) the unit is fully covered, (c) the approval is bound to a real
commit. It does **not** prove that the named person is entitled to approve — that
is enforced by the protected branch, PR review and the CI record the reference
points at. Writing this limit down is part of the fix: an over-claimed gate is a
silent-green channel with better marketing.

## 4. The two currently blocking differences (carried forward)

Both are recorded as `retirement-blocking YES` in
[`tests/ute-g1-fs/golden/SEMANTIC-DIFFERENCES.md`](../../../../tests/ute-g1-fs/golden/SEMANTIC-DIFFERENCES.md),
declared in `tests/ute-g1-fs/lib/semantic-differences.mjs`, printed as
`SEMANTIC-DIFF …` lines by `run-prototype.mjs` on every run, and asserted by
`lane-suite.test.mjs`. This memo **carries them forward as blockers**; it does
not close them and does not restate "FS is equivalent".

### 4.1 `lane-refusal-code` — `FS_SANDBOX_DENIED` vs `FS_PERMISSION_DENIED`

`[MEASURED]` The next host's `tool-fs` assumes an `FsError` with code
`FS_SANDBOX_DENIED` can only come from an `fs-sandbox` backend that resolved a
sandbox policy, and dereferences `policy.mode` when it sees one
(`packages/fs/tool-fs/src/sandbox.ts:139-143` on rc.5). A lane-only provider that
raises that code turns the refusal into a crash (`Cannot read properties of
undefined (reading 'mode')`). The prototype therefore raises
`FS_PERMISSION_DENIED` for lane denials.

`[MEASURED]` The *old* path's observed refusal on the measured route-C world is
**prose** (`authored locator '<abs path>' is outside every allow subtree of the
lane`); `FS_SANDBOX_DENIED` is the host code the next-path provider would share
with the old path if the upstream sharp edge did not exist. Both facts are
recorded in the golden file.

**The compatibility-interface question that must be owner-approved before
switching** `[PROPOSED-BY-MEMO]` — the owner must choose one and have it
recorded as the approval for this difference:

- **(A) Adopt the `fs-sandbox` protocol.** The new provider declares
  `sandboxMode`, mounts `sandbox-policy`, and lets the host map the denial into
  its `[sandbox: …]` marker. Refusal code stays `FS_SANDBOX_DENIED`; the
  model-facing text matches the host's sandbox vocabulary. Cost: the provider
  must actually *be* that backend, which is a capability claim it must be able to
  honour (a lane-only provider must not pretend).
- **(B) Keep a non-sandbox code** (`FS_PERMISSION_DENIED`) and accept that
  model-facing refusal text differs from the old path. Cost: a user-visible
  semantic difference that must be declared in release notes / acceptance rows,
  and any test or client that keys on `FS_SANDBOX_DENIED` must be updated.

Either choice is a **semantic change** requiring the approval in §3. Doing
neither (raising `FS_SANDBOX_DENIED` without the protocol) is a crash and is not
an option.

### 4.2 `refusal-observation-shape` — prose vs typed code

`[MEASURED]` The legacy governed path refuses with human messages
(`authored locator '…' is outside every allow subtree of the lane`,
`cannot modify "…": file has not been read — read the file, then retry`,
`cannot edit "…": file changed since it was read — re-read the file, then retry`).
The next host answers with typed `FsError` codes (`FS_PERMISSION_DENIED`,
`FS_NOT_OBSERVED`, …). The corpus compares a closed **class** vocabulary
(`lane-deny`, `write-requires-read`, `stale-version`, `other`); codes are recorded
verbatim but are not a pass condition.

**The compatibility-interface question** `[PROPOSED-BY-MEMO]`: an equivalence
oracle that compares codes directly would go red for reasons that are not
behaviour changes. Retirement therefore needs one of:

- **(C) Declare the class vocabulary as the contract** (approved semantic change:
  code-level equality is not required), with the difference disclosed in the
  family's acceptance row; or
- **(D) Make the old path emit codes** before comparing (a change to the old
  path, so it cannot be done "on the way out" — it needs its own gate and its own
  evidence).

`[PROPOSED-BY-MEMO]` (C) is the cheaper and honest option, but the choice is the
owner's, and it must name (i) which refusal surfaces are covered, (ii) which
clients/tests key on the text, and (iii) what evidence will be produced to show
the class mapping is not hiding a behaviour change.

### 4.3 What "resolved" means for these two, and what it must not mean

Resolved means: an owner-approved record exists for each blocking difference,
naming the chosen interface (A/B for 4.1, C/D for 4.2) and its uncovered
branches. It does **not** mean "the prototype passes its own corpus": the corpus
was built to tolerate these differences, so a green corpus is evidence *about
effects*, not about equivalence of refusal surfaces.

## 5. The only route to UTE-4 — and why the gate is not advisory

`[PROPOSED-BY-MEMO]` (P6) UTE-4 may delete old code for a family only when the
gate allows that family's row.

### 5.1 The deletion itself is the trigger (CI, not a developer's good intentions)

The UTE-0 gate was correct about *evidence* and inert about *deletion*: nothing
ran it when someone removed the old path. The external review called that out
(2026-11-20 §3.4: "它当前更准确地说是退役证据一致性检查器，还不是独立可信的退役
授权器"). Two changes close it without inventing a new CI architecture:

1. **The ledger declares the old path.** A row carries
   `oldPath: { files: [ …repo-relative, tracked… ] }` — the family's own old
   implementation files (row definitions, contribution, plane body). The gate
   checks every declared file is present in the tree. If one is gone and the row is
   not allowed → `UTE_OLD_PATH_PARTIALLY_REMOVED`. This is tree-state, not diff
   state, so it cannot be defeated by a shallow checkout.
2. **A required CI leg runs it on every PR.**
   `scripts/eb3-family-definitions.mjs` (the `ci-fast` leg that already loads
   `arc-a-family-census.json`, so it needs no new workflow line, no new manifest
   leg and no new argv) imports the retirement ledger and, for every family with a
   declared `oldPath`, refuses `DEF_RETIREMENT_UNLICENSED` when a declared file is
   missing/named-not-tracked and the row is not allowed. The refusal line carries
   the gate's own codes.

`[PROPOSED-BY-MEMO]` Consequence, and the point: a UTE-4 deletion PR is red before
a reviewer has to notice. You cannot delete the implementation first and file the
evidence afterwards — removing the file and dropping the ledger row are the same
act.

`[PROPOSED-BY-MEMO]` The deletion hook covers what the ledger declares. It is not
a proof that *every* file of the old path is declared; growing a family's
`oldPath.files` to the full inventory is UTE-3 work, and an undeclared file is a
gap to be closed, not a pass. `[UNKNOWN]` The exact inventory per family beyond FS
is not measured yet.

Manual route (still supported, e.g. before opening a PR):

```bash
node scripts/ute-retirement-gate.mjs --family fs          # exit 0 required
node scripts/ute-retirement-gate.mjs --all                # exit 1 is the honest state
```

The gate prints one of:

```
UTE-RETIREMENT-ALLOW family=<f> terms=4/4 unit=<n>/<n> state=RETIREABLE
UTE-RETIREMENT-REFUSED family=<f> codes=<named codes> state=<mirror> unit=<covered>/<total>
UTE-RETIREMENT-FINDING code=<code> term=<term> detail="<why>"
UTE-RETIREMENT-SUMMARY requested=N allowed=N refused=N
```

`--json` emits `ute-retirement-verdict/1` with the same facts plus the derived
unit, the coverage sets and the refusal list, for machine consumption. Exit codes:
`0` allowed, `1` refused, `2` could not grade (ledger absent/unparseable/wrong
schema, ungradable unit). `2` is **never** a green.

### 5.2 The closed refusal vocabulary (as of this revision)

| code | meaning |
|---|---|
| `UTE_OLD_BASELINE_MISSING` | `oldBaseline` term not established |
| `UTE_NEW_PATH_UNVERIFIED` | `newPathVerified` term not established |
| `UTE_SEMANTIC_DIFFERENCES_UNRESOLVED` | a blocking difference has no bound approval |
| `UTE_NEGATIVE_CONTROLS_FAILING` | `negativeControlsPass` term not established |
| `UTE_EVIDENCE_UNREADABLE` | pointer missing / untracked / no `expect` tokens / unreadable |
| `UTE_EVIDENCE_CONTRADICTED` | file read, but it does not state the claimed verdict |
| `UTE_STATE_CONTRADICTED` | the mirrored `state` disagrees with the computed predicate |
| `UTE_LEDGER_UNKNOWN_FAMILY` | no row for the requested family |
| `UTE_UNIT_UNDECLARED` / `UTE_UNIT_UNKNOWN_FAMILY` / `UTE_UNIT_UNDERCLAIMED` / `UTE_UNIT_OVERCLAIMED` | the retirement unit is absent, unknown, smaller than, or larger than the census unit |
| `UTE_UNIT_UNGRADABLE` | the unit cannot be derived (bad census entry, unparseable baseline TSV) |
| `UTE_MEMBER_UNCOVERED` | a unit member has no baseline vector / no new-path reproduction / no negative control |
| `UTE_VECTOR_UNREPRODUCED` | a baseline vector the new path did not reproduce |
| `UTE_APPROVAL_UNREFERENCED` | an approval is not bound to an existing commit (or names no reference) |
| `UTE_OLD_PATH_UNDECLARED` | the row declares no usable `oldPath.files` (absent/empty/not repo-relative safe paths) |
| `UTE_OLD_PATH_PARTIALLY_REMOVED` | a declared old-path file is gone while the row is not allowed |
| `UTE_LEDGER_SCHEMA` (exit 2) | the ledger cannot be graded at all |

## 6. Seeded state (re-measured after the coverage rule, 2026-11-20)

`[MEASURED]` The ledger seeds one row, `fs`, with `unit.familyId = dsh.fs-family`
(four members) and `oldPath.files` = the FS family's row/contribution files. The
gate refuses it; the measured transcript is
`dev/agent-workflow/evidence/ute0-rev2-20261120/gate-refusal.txt`:

| check | result today | why |
|---|---|---|
| unit | 4 members: `read`, `write`, `edit`, `read_image` | derived from `arc-a-family-census.json`, not chosen by the row |
| `oldBaseline` | refused (`UTE_MEMBER_UNCOVERED`) | the 10-vector TSV covers `read`/`write`/`edit`; there is no `read_image` vector |
| `newPathVerified` | refused (`UTE_MEMBER_UNCOVERED`) | all 10 baseline vectors are reproduced (`NEW-PATH-VECTOR <id> PASS`, no `UTE_VECTOR_UNREPRODUCED`), but `read_image` has no vector to reproduce |
| `semanticDifferencesResolved` | refused (`UTE_SEMANTIC_DIFFERENCES_UNRESOLVED`) | both differences are `retirement-blocking YES`; neither has a bound approval |
| `negativeControlsPass` | refused (`UTE_MEMBER_UNCOVERED` ×3) | the 4 recorded controls are family-level; there is no `NC-MEMBER read`, `NC-MEMBER write` or `NC-MEMBER edit` line, so control coverage of the unit is unproven |
| `state` | `NOT_RETIREABLE` (mirror) | consistent with the computed verdict — no `UTE_STATE_CONTRADICTED` |
| readiness | `unit=0/4` | zero of the four members is covered on every axis the gate requires; `UTE-RETIREMENT-SUMMARY requested=1 allowed=0 refused=1`, exit 1 |

`[MEASURED]` Verbatim refusal transcript, the `--json` verdict and the mutation
transcript: `dev/agent-workflow/evidence/ute0-rev2-20261120/` (`gate-refusal.txt`,
`gate-fs-json.json`, `mutants.txt`, `negatives.txt`, `family-definitions.txt`). The
gate suite is **31/31** with **14/14** real mutations turning a named control red,
and the required-CI hook is exercised by **35/35** negative controls (two of them
are the deletion-licensed / deletion-unlicensed pair).

`[PROPOSED-BY-MEMO]` Later families add rows; they do **not** edit the `fs` row's
evidence to claim completion. A difference that is genuinely gone is retired by
editing the difference list **with a pointer to the evidence that measured it
gone** (`tests/ute-g1-fs/lib/semantic-differences.mjs` change discipline), and then
adding the bound approval record — never by deleting the row.

## 7. Exit criterion for UTE-4 (what the owner can check)

`[PROPOSED-BY-MEMO]` UTE-4 is done when, for every migrated family:

1. the gate allows the row, covering the **whole census unit**;
2. the old family's code, its definitions and its data are removed in the same
   per-family change set that cites the allow line — and required CI's
   `DEF_RETIREMENT_UNLICENSED` arm stays green *because* the row is allowed, not
   because nothing was declared;
3. the `OldBaseline` artifact is preserved (retirement deletes the implementation,
   never the evidence);
4. no family is retired by shrinking its declared unit, by deleting its census row,
   or by removing its old-path declaration.

A family with no ledger row cannot be retired: absence is not a pass. A family
whose census unit is smaller than what it actually mounts cannot be retired either
— fix the census first, and that edit is itself reviewable.
