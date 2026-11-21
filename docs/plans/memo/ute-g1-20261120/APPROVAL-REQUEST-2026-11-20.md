# UTE G1 — the approval request (2026-11-20). NOT an approval; it is the thing to sign or refuse.

**What this file is.** Three families have finished every axis an agent can measure
and are refused by the retirement gate for exactly one reason: a **blocking
semantic difference with no reference-bound owner approval**. The gate does not
accept silence as approval (`UTE_SEMANTIC_DIFFERENCES_UNRESOLVED`,
`UTE_APPROVAL_UNREFERENCED`), and neither does this file. Everything below is a
question, stated so that answering it is a single decision rather than a reading
exercise.

**What signing one of these does.** It sets `SemanticDifferencesResolved` for that
family — the fourth and last retirement term. It does **not** retire anything, does
not switch the production execution path, does not delete a legacy family body, and
does not move Authority. Retirement remains a separate, explicit act that requires a
consolidated release request (`RETIREMENT.md` §6).

**The record shape the gate accepts** (`scripts/ute-retirement-gate.mjs`,
`UTE_APPROVAL_UNREFERENCED`): for each difference, a record with `by`, `on`,
`record`, and `reference` of the form `PR #<n> @ <40-hex>` where the 40-hex is a
real commit **ancestor of HEAD**. The gate proves the binding; it cannot prove the
approver's entitlement — that is why the reference has to be a real merge you made.

---

## 1. FS family — two differences, both about HOW a refusal is expressed

| id | old path | new path | blocking |
| --- | --- | --- | --- |
| `lane-refusal-code` | refuses with `FS_SANDBOX_DENIED` | refuses with `FS_PERMISSION_DENIED` (the pinned host's own structured `FsError`) | yes |
| `refusal-observation-shape` | prose in the model-facing text | typed `FsError` code | yes |

**What the owner already ruled (2026-11-20).** Route **B+C**: keep the native
structured `FsError` (never mint `FS_SANDBOX_DENIED` without an fs-sandbox
protocol), and judge old/new compatibility through the **closed refusal-category
mapping** in `tests/ute-g1-fs/lib/refusal-categories.mjs` rather than literal code
equality. That ruling is recorded as a **technical route only** — it is explicitly
not this signature.

**What the evidence shows.** The mapping is TOTAL in both directions and refuses an
unmapped value rather than defaulting it (`REFUSAL_VOCABULARY_INCOMPLETE`); six
corpus classes are evidenced by golden rows and a seventh (`route-unresolved`) by an
executed withheld-continuation fixture; six mutants turn the vocabulary red. The
nine-category closure is the compatibility surface, so "the codes differ" is inside
the approved comparison rather than outside it.

**The question.** Do you accept that a lane denial expressed as a typed
`FS_PERMISSION_DENIED` (with the closed category preserved) is semantically
equivalent to the old prose/`FS_SANDBOX_DENIED` surface for retirement purposes —
recognising that a consumer keying on the literal old code string would need the
mapping table?

**If the answer is no**, the honest alternatives are: (a) add a compatibility
shim that emits both, which is a product change with its own baseline movement;
(b) keep FS non-retireable indefinitely; (c) retire only the three tools whose
refusal surface did not move and leave `read_image` (we already hold that a partial
unit is `UTE_UNIT_UNDERCLAIMED`, so this would be a deliberate ruling, not an
accident).

---

## 2. Search family — three differences, one of them a product defect

| id | what moves | blocking |
| --- | --- | --- |
| `SD-SEARCH-1-grep-path-default` | a `grep` **without** `path` returns **0 matches** on the product route (host argv omits the operand; the confined child's fd 0 is a readable socket, so ripgrep reads stdin) while the governed row appends `.` and returns the real set | yes |
| `SD-SEARCH-2-grep-vcs-ignore` | route C runs `--no-ignore-parent --no-ignore-vcs` (a `.gitignore`d file **is** searched); the governed row keeps VCS ignore in force (it is **not**) | yes |
| `SD-SEARCH-3-refusal-surface` | route C gives one generic model-facing text for every confined denial, with the cause only in the guard fact (`IO_READ_DENIED` for both a lane denial and a missing target) | yes |

**The important distinction.** `SD-SEARCH-1` is not a framing difference: it is a
**measured behaviour defect** on the product route, and the tool's own description
says a missing path defaults to the workspace. It is recorded, not fixed, because
fixing it is a product change with its own baseline movement. `SD-SEARCH-2` is a
policy question about whether VCS-ignored files are in scope.

**The question.** Three decisions, and they are separable:
1. `SD-SEARCH-1` — fix it (product change, new baseline) or accept the current
   0-match behaviour as the shipped semantics? An acceptance is a promise to users,
   not just a retirement formality; that is why it needs your signature and not mine.
2. `SD-SEARCH-2` — should the confined face and the governed row agree on VCS
   ignore? If yes, one side moves.
3. `SD-SEARCH-3` — is a single model-facing text plus a guard fact an acceptable
   refusal surface for Search, given a consumer cannot distinguish lane denial from
   missing target?

---

## 3. Web family — three differences, one of them an architecture question

| id | what moves | blocking |
| --- | --- | --- |
| `SD-WEB-1-native-name-claim-collision` | **two claimants for the same native names**: `packages/tools/families/web.mjs` claims `web_fetch`/`web_search` (opt-in `webEnabled`), and the product route-C composition also serves both. An install with `webEnabled: true` has two producers and the seam names no winner | yes |
| `SD-WEB-2-redirect-ownership` | the legacy transport **never follows** a redirect (one bounded response) and the governed row drives the chain under `MAX_REDIRECT_HOPS=5`; route C hands the call to the pinned provider, which follows same-origin hops itself — **one tool call produces three network effects** (`WEB_REDIRECT_UNMEDIATE_ON_ALLOW`) | yes |
| `SD-WEB-3-refusal-surface` | legacy raises typed `webRefusal(...)` codes; route C renders the pinned provider's `WebError`s as **prose** while the guard fact says `ALLOW` | yes |

**The question.** `SD-WEB-1` is not a retirement formality: a name with two
producers cannot be retired, and the seam must name which one owns it. `SD-WEB-2`
changes how many network effects one call has — a security-relevant count, not a
formatting choice.

---

## 4. One meta-question that applies to all three

FS's 16-vector baseline was captured **after** the route-C `read_image` repair
(PR #802) merged. The ledger records the capture point, and the ledger is the
authority for what was measured; but whether a baseline captured on a tree that
includes a just-merged repair is acceptable for a retirement claim is a **ruling**,
not a measurement. The alternatives: accept it (the repair only made a
previously-unreachable tool reachable, and the old-path rows came out byte-identical
across the repair), or require a re-capture on a tree with the repair aged by N
merges.

---

## 5. What I will not do with any answer

- I will not write an approval record myself, and I will not set
  `semanticDifferencesResolved: true` on the strength of this file.
- I will not switch the production execution path, delete a legacy family body, or
  move Authority on the strength of any approval — those need the consolidated
  release request with its matrix, switch plan, rollback plan and deletable-code
  list.
- I will not treat a "no" as a blocker to continue: a refusal on Search's
  `SD-SEARCH-1`, for instance, simply means the product defect gets scheduled as a
  fix with its own baseline, and the family stays refused until it lands.
