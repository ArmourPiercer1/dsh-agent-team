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
authority. This bridge **reads** it and mirrors `current_phase` plus the
`current_contract` baseline into the generated view as read-only data. There is
no path by which this generator writes `graph.yaml`, and switching the old
consumers is a separate, coordinated migration (E1 exit condition), not a
consequence of these files existing.

Regenerate: `pnpm docs:sync --write` (or the generator directly).
Verify freshness in CI: `pnpm docs:sync --check`.

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
| `verified_tier` | `verified_host` | `CLAIM_TIER_MISSING` without C2/C3; `CLAIM_TIER_MISMATCH` when C1 is offered for real-environment behaviour; `CLAIM_TIER_UNKNOWN` outside C1/C2/C3 |
| `merged_commit` | `implementation_status: merged` | `MERGED_CLAIM_UNCORROBORATED` unless it exists and is an ancestor of `origin/master` |
| — | `release_status: candidate` / `released` | `RELEASE_CLAIM_UNCORROBORATED` unless `verified_host` at C2/C3 plus that ancestry |

The two fields are **orthogonal axes**, and an earlier version of this paragraph got that
wrong by calling one pairing "self-contradictory" and describing the absence of a refusal as
a gap. Corrected per the responsibility layering, and the rule was not touched:

- `verification_status` names **which layer is being claimed** — local work, a CI run, a real
  environment — and therefore which corroboration the rules demand of it.
- `verified_tier` names **the tier of the evidence recorded** in `verification_artifacts`:
  C1 = this machine, static analysis or local controls; C2 = a hosted or second-environment
  run; C3 = a real-environment (Host) run.

Because they answer different questions, `verified_ci` with `verified_tier: C1` is a legal
record: a CI-layer claim whose listed artifacts happen be locally produced logs, bound to a
commit. What the rules refuse is abuse, not vocabulary:

- **a wrong SHA** — `verification_commit` that is 40-hex but names no commit object
  (`CLAIM_UNBOUND`);
- **local masquerading as CI** — a `verified_ci` / `verified_host` claim with nothing bound to
  a commit (`CLAIM_UNBOUND`), or `verified_*` with no existing artifact (`FAKE_VERIFICATION`);
- **C1 masquerading upward** — `verified_host` asserted from C1 evidence
  (`CLAIM_TIER_MISMATCH`), or from no C2/C3 tier at all (`CLAIM_TIER_MISSING`).

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
functions and **no check here guards them**; the accountable role for that package is
whatever its registry entry's `owners` says, and there is no separate role roster on this
branch.

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
