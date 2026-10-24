# dev/engineering — derived current state (EB1-C, v0)

Two files, two very different jobs:

| file | who writes it | what it may contain |
| --- | --- | --- |
| `registry.yaml` | a human, in a PR | only decisions and references that cannot be derived: status per axis, owner role, citations, evidence paths |
| `current-state.json` | `node scripts/gen-current-state.mjs` | a read-only assembled view: registry + Git facts + evidence existence. **Generated. Never hand-edit.** Scope: existence and static facts (T0); it proves no runtime behaviour. |

`registry.schema.json` states the shape; enforcement is hand-rolled inside the
generator (rule by rule, printed on failure) so this runs in a worktree with no
`node_modules`. It is not a JSON-Schema-processing dependency claim.

## The four axes (INV-EB-0009)

```
decision_status        proposed | accepted | rejected | superseded | pending_coordination
implementation_status  not_started | in_progress | implemented_in_branch | merged
verification_status    not_verified | verified_local | verified_ci | verified_host
release_status         not_released | candidate | released
```

None implies another. `accepted + merged + not_verified + release_blocked` is a
legal, common combination. `verified_*` requires at least one path in
`verification_artifacts` that **exists**; the generator refuses (exit 1, code
`FAKE_VERIFICATION`) rather than passing a claim with no artifact. That refusal
is a delivered negative control, exercised by
`scripts/doc-consistency-controls.mjs`.

## What this does not replace

`dev/agent-workflow/graph.yaml#current_contract` remains the current execution
authority. This bridge **reads** it and mirrors **all six** of its fields -- `phase_id`,
`active_plan`, `backlog`, `matrix`, `baseline`, `baseline_collected` -- plus two derived proofs
(`baseline_exists`, `baseline_is_ancestor_of_head`) into `current-state.json` under
`legacy_authority`, read-only. Two things about that are load-bearing. The mirror **copies, it does
not resolve**: `baseline` stays the frozen recorded SHA rather than becoming the live HEAD, and
`matrix` stays a path rather than becoming a tool table -- which is enforced by
`checkLegacyMirror()` (`LEGACY_MIRROR_VALUE`) on every `docs:sync --check`, not just asserted here.
And the list itself is pinned against `registry.schema.json`'s `x-generated-view-mirror`, so the
emitter and the schema cannot drift apart silently. `current_phase` is deliberately **not** in the
view: its grammar is `scripts/ci-pr-gate.mjs`'s business, and re-checking it here would put a second
authority over one rule. The field-level reconciliation against a pinned SHA is in
`dev/agent-workflow/evidence/EB-E0-E1/legacy-mirror-reconciliation-01640829.md`. There is
no path by which this generator writes `graph.yaml`, and switching the old
consumers is a separate, coordinated migration (E1 exit condition), not a
consequence of these files existing.

**Boundary of what this entry surface can resolve** -- written because a reader followed a pointer
out of here and found nothing behind it. The four 20260829 frozen documents (Architecture / UI /
Development Plan / Task Decomposition) **were not found in the commit history visible from this
checkout** -- a statement about the refs this working tree can see, not a claim that they were
never committed anywhere. `git log --all --diff-filter=A --name-only` over `docs/plans/` lists
only alpha.1-era files there. The directory itself **is** tracked here -- four alpha.1-era files,
`git check-ignore` says it is not ignored -- so this is not a "gitignored local dir" situation, and
the two AGENTS.md revisions in this environment disagree about it: the one in this tree says the
directory has been git-tracked since 2026-10-07 and that the four frozen documents remain the sole
semantic authority, while the older revision in the main checkout still calls it local and
gitignored. That disagreement is reported, not resolved here (`AGENTS.md` is not this line's to
edit), and no remote search was run: the claim above is only about the refs this checkout can see. So citations of the form `TaskDoc §11`,
`Development Plan §17.2` or "the Architecture document" -- which appear in package code headers,
and in the package READMEs that quote those headers faithfully -- are **historical references with
no resolvable target in this checkout**. Read them as provenance, not as something to open. Do not
close the gap by reconstructing them: a document written from memory while wearing an old
citation would be worse than the dangling pointer it replaced. Where a rule actually binds
behaviour, the live text is the `docs/plans/active/alpha5-tool-io-governance/` set named above.

Regenerate: `pnpm docs:sync --write` (or the generator directly).
The command that verifies freshness: `pnpm docs:sync --check` (run it before review; it is the
gate this line's own controls exercise). **Nothing wires it into CI on this branch** -- that
wiring is EB3-B, not built here -- so "run `docs:sync --check`" is an instruction to a
reviewer, not a claim that a pipeline enforces it.

## What these tools do, and what they do not do

They refuse a claim that cites nothing. `FAKE_VERIFICATION` refuses `verified_*` with no
existing artifact; `CLAIM_UNBOUND` refuses `verified_ci` / `verified_host` unless
`verification_commit` names a real commit object in this repository; `CLAIM_TIER_MISMATCH`
refuses a `verified_host` asserted from C1 evidence; `MERGED_CLAIM_UNCORROBORATED` refuses
`implementation_status: merged` unless `merged_commit` exists and is an ancestor of
`origin/master`; `RELEASE_CLAIM_UNCORROBORATED` refuses `candidate` / `released` without
`verified_host` at the matching tier plus that ancestry. Delivery claims are therefore
**bound** to metadata that already exists outside the file — they are not *proven* by it,
and nothing here is or becomes an authorization ledger. The writable surface is two
generated files — `dev/engineering/current-state.json` and
`docs/contracts/engineering-baseline/INDEX.md` — reached only through
`scripts/generated-write.mjs`, which refuses symlinked targets, symlinked ancestors,
non-regular targets and a target with more than one name (`nlink != 1`) instead of
trusting a string allow-list. Authorization needs both lists: the file must sit in a named
area **and** be named by full path, so widening an area does not open the normative files
inside it — `ids.yaml` and this directory's `README.md` live in a named area and stay
unwritable. The view names the two inputs it was rendered from — `source_registry` /
`source_registry_sha` and `source_catalog` / `source_catalog_sha` — because a registry and
an id catalog both feed it; naming only the registry let an `ids.yaml` edit leave the view
claiming to be fresh while the meaning of every `refs` entry inside it had moved.
A regeneration is therefore required after a catalog edit, and `--check` says so.

`doc-ownership.yaml` maps changed source paths to the current-state documents that should be read with them. Matching a rule turns `docs:probe`'s advisory into a named document list; matching nothing is reported as unowned coverage instead of being guessed at. A rule marked `enforce: true` is self-imposed by this line: it refuses (`DOC_OWNER_UPDATE_MISSING`) a source change while **none** of that rule's declared owner documents changed in the same change set — satisfied by at least one of them, with no claim that the right one changed, that all did, or that the new text matches the diff; semantic equivalence stays a Contract Owner judgement. Rules outside this line's own tooling stay advisory, and nothing here is wired into CI (EB3-B). An owner document that does not exist is a hard finding (`DOC_OWNER_DOC_MISSING`).

`scripts/contracts-field-agreement.mjs` compares a contracts `interface` with the
hand-maintained `X_FIELDS` array that mirrors the same frozen shape, for the pairings written
out by hand in `PAIRS`. There is no JSON Schema for these DTOs, so "TypeScript to schema
equivalence" had no counterparty; the equivalence that exists without dependencies is this
one. Its findings reach `docs:sync --check` and `docs:probe` (rule `contracts-shape`), where
a counterpart present on one side and gone on the other is drift; a pairing absent on **both**
sides is not applicable — the summary prints `contracts=N pairs compared` or
`contracts=not applicable` so an inapplicable run cannot read as coverage. Names only: no
type, no `minItems`, no length, no uniqueness, no cross-field rule — those live in parse
functions and are not derivable from a declaration. `docs:sync --write` cannot repair its
findings: they name a shape, not a stale derivative, so it is not in `SELF_UPDATE_CODES`.

## Status vocabulary, and exactly what the tools can see

Written because a fresh reader using only the entry files could reconstruct the axis names
but not their meanings. `dev/engineering/registry.schema.json` is the machine check that
refuses anything outside these sets; this prose explains them and says which of them any
tool actually enforces.

- `decision_status`: `proposed` | `accepted` | `rejected` | `superseded` | `pending_coordination`
- `implementation_status`: `not_started` | `in_progress` | `implemented_in_branch` | `merged`
- `verification_status`: `not_verified` | `verified_local` | `verified_ci` | `verified_host`
- `release_status`: `not_released` | `candidate` | `released`

Claim metadata, what it is for, and the code that refuses without it:

| field | required by | refusal |
| --- | --- | --- |
| `verification_artifacts` | any `verified_*` | `FAKE_VERIFICATION` when empty, or when a listed path does not exist |
| `verification_commit` | `verified_ci`, `verified_host` | `CLAIM_UNBOUND` when absent, or when it is 40-hex but names no commit object here |
| `verified_tier` | `verified_host` | `CLAIM_TIER_MISSING` without C2/C3; `CLAIM_TIER_MISMATCH` when Adapter-local (C1) evidence is offered for an integration claim; `CLAIM_TIER_UNKNOWN` outside C1/C2/C3 |
| `merged_commit` | `implementation_status: merged` | `MERGED_CLAIM_UNCORROBORATED` unless it exists and is an ancestor of `origin/master` |
| — | `release_status: candidate` / `released` | `RELEASE_CLAIM_UNCORROBORATED` unless `verified_host` at C2/C3 plus that ancestry |

The two fields are **orthogonal axes**, and an earlier version of this paragraph got that
wrong by calling one pairing "self-contradictory" and describing the absence of a refusal as
a gap. Corrected per the responsibility layering, and the rule was not touched:

- `verification_status` names **which layer is being claimed** — local work, a CI run, a real
  environment — and therefore which corroboration the rules demand of it.
- `verified_tier` names **the verification responsibility and coverage** of the evidence
  recorded in `verification_artifacts`, following the established acceptance levels written in
  PR #355 at head
  `8f84a7845944964ef17e167aebfde8e2d9617570`, file
  `docs/plans/active/alpha5-convergence/PLAN-B-20261022.md` lines 157–159. **That file is not in
  this tree** -- the PR is open and unmerged, so the path resolves nowhere locally and no link
  check catches it. Read it as fetched:
  `git fetch origin refs/pull/355/head && git show 8f84a7845944964ef17e167aebfde8e2d9617570:docs/plans/active/alpha5-convergence/PLAN-B-20261022.md`.
  Its state was verified on **2026-10-23 23:03: open, draft, unmerged, head
  `8f84a7845944964ef17e167aebfde8e2d9617570`** -- a note about where this citation lives and how
  fresh it is, not a downgrade of the user's Plan-B execution authorization, and not a reason to
  stop using the definitions. The three levels below are what that text says:
  - **C1** — Adapter-local verification: one surface's interface, arguments, effects, native
    parity and the exact security negatives around it. A CI run may well execute C1.
  - **C2** — real-Host integration verification: the surface wired into the running assembly,
    with the permission positives and negatives and the lifecycle legs, at a fixed SHA. A
    branch-local real-Host run is C2, not C3: it verifies integration, not the candidate.
  - **C3** — final verification of a fixed candidate: one pinned HEAD, the whole tool matrix,
    cross-tool interaction, replayable C1/C2 evidence, independent review.

  The levels are **not** machines. They do not mean "this machine", "a second environment", or
  "the Host": a Host run belongs to C2 or C3 depending on what it covers, and CI can sit at C1.
  Where this README said otherwise, that wording was wrong and is replaced here.

Because the axes answer different questions, `verified_ci` with `verified_tier: C1` is a legal
record -- CI executed an Adapter-level check. But the claim is only as good as its execution:
**a real CI run must actually have produced that C1 evidence**; binding a locally produced log
to a commit does not stand in for it. The tools check existence and binding, not who ran what,
so that half is what the writer attests and a reviewer reads -- a stated limit of the check,
not a licence. What the rules refuse is abuse, not vocabulary:

- **a wrong SHA** — `verification_commit` that is 40-hex but names no commit object
  (`CLAIM_UNBOUND`);
- **local masquerading as CI** — a `verified_ci` / `verified_host` claim with nothing bound to
  a commit (`CLAIM_UNBOUND`), or `verified_*` with no existing artifact (`FAKE_VERIFICATION`);
- **C1 masquerading upward** — an integration or candidate claim (`verified_host`) argued from
  Adapter-local evidence (`CLAIM_TIER_MISMATCH`), or from no C2/C3 tier at all
  (`CLAIM_TIER_MISSING`).

No rule refuses the *combination*, and adding one would invent a law the layering does not
contain — which is also why the earlier "known gap" line here was not a finding about the
rules but a finding about this paragraph.

`released` is not defined by this line. What the tools do is refuse the word without
corroboration, which is not the same as deciding what a release is — tag, `stable` push, or
publish. That belongs to a release decision and to `docs/ROUTER_RULES.md`; nothing here is a
release ledger.

The **"current-state documents"** that several rules scan are exactly these, and no others:
`AGENTS.md`, `README.md`, `docs/STATUS.md`, `docs/BRANCHING.md`, `docs/glossary.md`,
`docs/terminology.md`, plus everything under `docs/contracts/`, `.agents/notes/` and
`dev/engineering/`. `docs/ideas/` and `.agents/notes/proposed/` are exempt from evidence
requirements because they may describe the future by design; that exemption is what keeps an
unimplemented proposal from reading as a product failure.

Contracts pairings are **data inside `scripts/contracts-field-agreement.mjs`** (`PAIRS`). The
script prints what it compared; the list is not copied into any document, because a second
copy is a second thing that can drift from the first. It compares names only — type,
`minItems`, length, uniqueness and cross-field rules live in the `packages/contracts` parse
functions and **no check here guards them**. There is no role roster on this branch, and no
registry entry names `packages/contracts` either -- so for that package, as for the other
eight, **no accountable role is recorded anywhere**. The package READMEs say the same thing;
this line does not appoint anyone, and a reader who follows the usual pointer
("ask the registry entry's `owners`") reaches nothing.

Ratification, as far as tooling reaches: an id in `ids.yaml` marked `proposed-not-ratified`
stays that way until the Contract Owner records a decision. Nothing here promotes an id, and
the value is **not** read as "unauthorized work": what an id carries is decided id by id, and
the layering is recorded in `work-package-authorization.md`. `normative_status` says how much
contractual force a sentence has; it has never meant "this file may not be read, cited or
mechanically refined". Two semantics worth stating because they are easy to over-read:

- **INV-EB-0004** is consumed per *applicable* path: a code path that cannot both consume and
  produce the two consumption modes is not required to fake the other one. It is not a rule
  that every call must exercise both.
- An **AC being "newer"** means its *content* drifted from what it accepts, not that its file
  mtime is later. Nothing in this line compares timestamps; generated output carries no
  wall-clock for exactly that reason.

## Where a scope-boundary decision is recorded

Not every decision is a work item, and the places they go are different on purpose. A scope question
that was answered but built nowhere goes to `.agents/notes/` (the decision-reason record); its
unresolved residue goes to `docs/ideas/` with an id in
`docs/contracts/engineering-baseline/ids.yaml` carrying `idea-no-execution-authority`; and **nothing
goes into `registry.yaml`** -- its kinds
(`work-package` / `implementation-pr` / `gate` / `migration`) are units of work, and per
`dev/engineering/work-package-authorization.md` a work-package entry is what mechanical work authority
attaches to, so writing one would manufacture construction authority nobody granted.
`EB-ADR-0004` (Alpha.5's `install_bundle` install-internal-IO boundary, from the user answers of
2026-10-24T09:03:32Z and 09:04:45Z) and `IDEA-EB-0002` are that shape: both name main's Alpha.5 contract
and matrix as the authority and link to it instead of restating it, which is why there is still one place
to change the contract. Read `dev/engineering/work-package-authorization.md` before turning any of it
into a task.

## Where this line has NOT exited

Read the green checks above as checks, not as an exit. What is still open, kept in its own words
so nothing is quietly dropped:

- **The one-time switch has not started, and this branch cannot perform it alone.** The execution
  plan of PR #361 requires the new fact relation to **run in parallel** with the old entry first
  (`execution-plan` :53, EB1-C: "先并跑旧 `current_contract`" with "旧/current 对账" as its
  acceptance), and only then to switch **the single consumption entry of the old current state in
  one move** (:56: "先建新事实关系，再一次性切换旧当前态的唯一消费入口 … 不能出现'两处可编辑的
  current'"). The parallel half exists -- `current-state.json` mirrors `graph.yaml#current_contract`
  read-only and no consumer treats the generated view as authority -- but the switch itself is
  `not_started_requires_coordination`: it moves a shared consumption entry, so it belongs to a
  coordinated window, not to a docs branch.
- **EB0-1 … EB0-5 performance and resource baselines are incomplete.**
  `evidence/EB-E0-E1/baseline-inventory.md` is a **read-only census of a tree** (five sub-censuses,
  labelled by the source they were measured on). It is not a performance or resource baseline, and
  producing the latter needs runs this line was told not to start.
- **Integration Freeze evidence is incomplete.** `evidence/EB-E0-E1/integration-freeze.md` records
  which conditions are satisfied and which are not; no candidate SHA is frozen, and a green
  `pr-gate` on this branch is not a freeze.
- **The E1 exit clause about a new agent is measured, not certified.** The cold read answered
  7/7 with its caveats intact, and the 94/0 controls are **author runs** -- nobody independent has
  re-executed them.
- Unchanged and still open: contracts pairing beyond the 20 equality pairs plus 2 subset checks
  (13 interfaces and 1 array unpaired, 1 `NOT_CHECKED`), CI wiring (EB3-B), and ratification of the
  18 `proposed-not-ratified` ids (the single `idea-no-execution-authority` entry is not a
  ratification target and grants no execution authority).

Nothing above was deleted or weakened to make this line look finished; items this line could not
close are recorded as open, with the reason being coordination or measurement the branch was not
authorized to perform.
