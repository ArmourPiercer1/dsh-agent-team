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

## 5. Per-family ledger and the only route to UTE-4

`[PROPOSED-BY-MEMO]` (P6) UTE-4 may delete old code for a family only when the
gate allows that family's row. Sequence:

```bash
# before touching the family's old path
node scripts/ute-retirement-gate.mjs --family fs          # exit 0 required
# the mechanical default for every family not yet ready
node scripts/ute-retirement-gate.mjs --all                # exit 1 is the honest state
```

The gate prints one of:

```
UTE-RETIREMENT-ALLOW family=<f> terms=4/4 state=RETIREABLE
UTE-RETIREMENT-REFUSED family=<f> codes=<named codes> state=<mirror>
UTE-RETIREMENT-FINDING code=<code> term=<term> detail="<why>"
UTE-RETIREMENT-SUMMARY requested=N allowed=N refused=N
```

`--json` emits `ute-retirement-verdict/1` with the same facts for machine
consumption. Exit codes: `0` allowed, `1` refused, `2` could not grade (ledger
absent/unparseable/wrong schema). `2` is **never** a green.

## 6. Seeded state (2026-11-20, measured by the gate itself)

`[MEASURED]` The ledger seeds one row, `fs`:

| term | verdict | evidence | why |
|---|---|---|---|
| `oldBaseline` | `true` | `tests/ute-g1-fs/golden/old-path.tsv` | 10 vectors captured on legacy route-C (0.2.0-rc.2 @ `639ed01539`) |
| `newPathVerified` | `true` | `dev/agent-workflow/evidence/ute-g1-fs-20261119/new-path-run.txt` | `PROTOTYPE-VERDICT GREEN vectors=10 failed=0` on rc.5 |
| `semanticDifferencesResolved` | **`false`** | `tests/ute-g1-fs/golden/SEMANTIC-DIFFERENCES.md` | both differences are `retirement-blocking YES`; neither has an approval |
| `negativeControlsPass` | `true` | `dev/agent-workflow/evidence/ute-g1-fs-20261119/negative-controls.txt` | `NC-VERDICT GREEN controls=4 failed=0` |

Therefore `fs` is `NOT_RETIREABLE` and the gate refuses it with
`UTE_SEMANTIC_DIFFERENCES_UNRESOLVED`. Verbatim transcript:
`dev/agent-workflow/evidence/ute0-contract-20261120/gate-refusal.txt`.

`[PROPOSED-BY-MEMO]` Later families add rows; they do **not** edit the `fs` row's
evidence to claim completion. A difference that is genuinely gone is retired by
editing the difference list **with a pointer to the evidence that measured it
gone** (`tests/ute-g1-fs/lib/semantic-differences.mjs` change discipline), and
then adding the approval record — never by deleting the row.

## 7. Exit criterion for UTE-4 (what the owner can check)

`[PROPOSED-BY-MEMO]` UTE-4 is done when, for every migrated family, the gate
allows the row; the old family's code, its definitions and its data are removed
in the same per-family change set that cites the allow line; and the
`OldBaseline` artifact is preserved (retirement deletes the implementation, never
the evidence). A family with no ledger row cannot be retired: absence is not a
pass.
