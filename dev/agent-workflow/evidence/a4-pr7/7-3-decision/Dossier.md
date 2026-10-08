# Alpha.4 §7.3 — what happens to the §E.2 structured grammar at `schemaVersion: 3`

**Lane:** `docs/a4-73-decision-scoping` (read-mostly analysis; no production source is modified on this branch).
**Base:** `d4eb9f39` = `d4eb9f39181e4dfa35a386e7f076f179bea743bf` (`git rev-parse --short origin/master` at session start, after `git fetch origin`).
**Every number below was produced by a command run in this worktree; transcripts are in `transcripts/`, throwaway probes in `probes/`, the appliers in `scripts/`.**

> `origin/master` **moved twice during this session** (`d4eb9f39` → `a7fdb77c`, PR #157 → `e3828400`). All measurements are against the pinned base `d4eb9f39`; `git diff d4eb9f39 origin/master --name-only` shows #157 touched **no** file in the measured surface (checked: `schema.ts`, `types.ts`, and all five gate files). The branch was not rebased — re-basing would have moved the base under the measurements.

---

## VERDICT

**Option A — relax the five `=== 2` gates to be version-agnostic — and land it *before* the flip as a standalone commit, because it is measurably a no-op for every document that exists today (777/777 green on the unflipped base) while every other option either strands a live authority surface (B) or forces a lossy rewrite of a requirement model that 465 parses still use (C, D).**

One sentence: the document layer already decided this question — `BLUEPRINT_TOP_LEVEL_FIELDS_V3` is *derived from* `BLUEPRINT_TOP_LEVEL_FIELDS_V2` and therefore already accepts `teamRequirements`, and a v3 document's `contentHash` already commits to the grammar — so A is the only option that makes the runtime agree with what identity has already promised, and it is the only option that can be paid for at the cheap moment instead of after v3 documents exist outside this repo.

---

## 0. What was measured, and how

| baseline (base `d4eb9f39`, clean tree) | command | result |
| --- | --- | --- |
| typecheck | `pnpm -r run typecheck` | **exit 0**, 9 projects green |
| affected universe | `run-universe.sh` (52 files matching `teamRequirements\|V2_DOCUMENT_VERSION\|schemaVersion: 2`) | **52 files / 777 tests passed**, exit 0 |
| pre-existing debt | 5 files outside that universe | **13 failing tests** — present on a clean tree with no probe files (`transcripts/T5-base-debt-identities.txt`); every option comparison below is **identity-relative**, never a raw count |

Environment facts that changed how I ran things: the pnpm store on the read-only filesystem is unusable, so the install was
`pnpm install --ignore-scripts --prefer-offline --store-dir /home/user/dsh-plugins/dsh-agent-team/.pnpm-store` (exit 0, 815 packages, 0 downloaded) — a **real** install, no hardlink shortcut; and `rm -rf packages/testkit/test/.tmp-fault` precedes every vitest run (it is baked into `scripts/run-universe.sh`).

**Transcript naming:** `RUN-*-raw.txt` is the full vitest output; `RUN-*-failing.txt` is the **set of failing test titles only** (bare titles — two files can share a title, so never count files from it); `RUN-*-files.txt` and `PREFLIP-B-files.txt` are the **file** lists, taken from `FAIL` lines. `TC-*.txt` are typecheck error lines with the reporting package as the first token (so a `runtime` site appears under both `runtime` and `tools`).

The three layers the decision can live at (all read, not inferred):

| layer | site | behaviour at v3 today |
| --- | --- | --- |
| parse / closed field set | `packages/domain/blueprint/src/schema.ts:317` `BLUEPRINT_TOP_LEVEL_FIELDS_V2 = [...BLUEPRINT_TOP_LEVEL_FIELDS, 'teamRequirements']`, `:334` `..._V3 = [..._V2, 'teamHardEnvelope']`, `:345` `BLUEPRINT_TEMPLATE_FIELDS_V2 = [...BLUEPRINT_TEMPLATE_FIELDS, 'requirements']` | **accepts** the whole §E.2 grammar |
| validate / freeze | `validate.ts:338` template field set, `:385` `schemaVersion >= 2 ? takeArray(record,'requirements',path)`, `:1280` `schemaVersion >= 2 ? takeArray(record,'teamRequirements','$')` | **parses and validates** it |
| identity | `validate.ts:1571` `...(core.teamRequirements !== undefined ? { teamRequirements: … } : {})` | **hashes** it into `contentHash` |
| enforcement | `requirements/scope-requirements.ts:108`, `requirements/creation-preflight.ts:217`, `admission/requirement-gate.ts:460`, `compatibility/blueprint.ts:81`, `activation/provider.ts:821` | **ignores** it (`=== 2`) |

So at base, a v3 document may *declare* required capabilities, *pay identity for them*, and receive **no enforcement**. That is the state §7.3 freezes in place unless the semantic decision is taken with the digit.

Flat `blueprint.requirements` is read **ungated** at every version (`compatibility/blueprint.ts` head, `req-${domain}-${name}` mapping) — the asymmetry is one-sided: only the structured half is version-gated.

---

## 1. The options (four, not three)

| id | name | change | lines |
| --- | --- | --- | --- |
| **A** | **Relax** | the five gates stop consulting the version: `compatibility/blueprint.ts:81` → presence check (`teamRequirements !== undefined`); the other three `if (schemaVersion === 2) {` → plain block; `provider.ts:821` → `scopeInputs.templates[createTemplateId]` | 7 files, 7 lines (2 flip + 5 gates) |
| **B** | **Retire** | flip; **delete** the five guarded blocks; the parser keeps accepting the grammar | 7 files, **+3 / −106** |
| **C** | **Forbid** | flip; parser keeps the fields; a v3 validation rule rejects `teamRequirements` with an actionable message | 3 files, +9 (or 4 files if a named error code is wanted — see §3) |
| **D** | **Un-nameable** *(the fourth the code suggests)* | flip; `BLUEPRINT_TOP_LEVEL_FIELDS_V3` stops inheriting V2, and the v3 template field set drops `requirements`; `validate.ts` `>= 2` predicates become `=== 2` | 3 files |

D is the option the code suggests because the *only reason* v3 accepts the grammar today is derivation (`..._V3 = [..._V2, 'teamHardEnvelope']`), and the repo has a **test that pins that derivation**. C and D are the same mechanism (v3 refuses the field) at different message quality; A and B are the same cost at different semantics.

---

## 2. Measured blast radius

### 2.1 Typecheck (always `pnpm -r --no-bail run typecheck`; my probe files excluded)

| state | reported error lines | distinct files | TS2367 (gate comparisons) | TS2322 (version carriers) |
| --- | --- | --- | --- | --- |
| base | 0 | 0 | 0 | 0 |
| **flip only** | **31** | **23 real files** (5 production + 18 test/helper) | 11 | 20 |
| flip + **A** | 21 | 18 | **1** | 20 |
| flip + **B** (delete) | 21 | 18 | **1** | 20 |
| flip + **C** | 31 | 23 | 11 | 20 |
| flip + **D** | 31 | 23 | 11 | 20 |

Adjudicating the two circulating numbers: **the plan's "exactly 5 errors, no others" and the coordinator's "14 errors in 13 files" are both wrong.** The truth is 5 production sites — `activation/provider.ts:821`, `admission/requirement-gate.ts:460`, `compatibility/blueprint.ts:81`, `requirements/creation-preflight.ts:217`, `requirements/scope-requirements.ts:108` — **each reported twice** (by `runtime` and again by `tools`, whose project includes runtime sources) = 10 lines, **plus 20 TS2322 sites in 18 test/helper files**, plus 1 TS2367 in a *test* that mirrors a production gate (`requirement-d1-d3-decision-scoping.test.ts:890`). The plan's 5 is only reachable with `pnpm -r run typecheck` (no `--no-bail`), which **bails inside `domain` before `runtime` is ever compiled** — I measured both invocations; see §7.

Carriers: **17 files** declare a typed version carrier (`TeamBlueprint['schemaVersion'] = 2` in 16, `= 1` in 3, two files carry both) — not 7. 20 TS2322 sites because several files declare two carriers (a v2 subject and its v1 twin).

### 2.2 Affected universe after the flip, fixtures unmigrated

| option | red files | red titles | note |
| --- | --- | --- | --- |
| flip only | 24 | 74 | 13 of the 24 fail at **collection** (module scope) |
| flip + A | 24 | **74 — byte-identical set to flip-only** | `diff RUN-BAREFLIP-failing.txt RUN-OPTION_A-failing.txt` → empty |
| flip + B | 24 | 74 (identical) | |
| flip + C | 24 | 74 (identical) | |
| flip + D | 24 | **75** | + `V12 the v3 top-level closed set is EXACTLY the v2 set plus teamHardEnvelope` (`a4p1-blueprint-v3-governance.test.ts`) |

**All 74 reds are the flip's own fixture-version refusals** (`unsupported blueprint schema version 2; this build supports [3]`), not the grammar disposition. The options differ **only for a document that has already been migrated to v3**, which is why §2.4 exists and why a count-only blast-radius report on the unmigrated tree cannot see this decision at all.

### 2.3 Post-flip semantics — one probe, four verdicts (`probes/probe-postflip-v3-grammar.test.ts`)

Two v3 documents, identical except for the structured declarations, through the **real** `compatibilityRequirementsOf` + `scopeRequirementInputsOf` + `toHashableBlueprint`:

| option | verdict (literal probe output) |
| --- | --- |
| A | `VERDICT=ENFORCED (option A behaviour)` — bridge/scopes differ between with/without |
| B | `WITH bridge=["req-tool-web"] scopes=["team"]` / `WITHOUT bridge=["req-tool-web"] scopes=["team"]` → `VERDICT=INERT (option B behaviour: declared, hashed, ignored)` and `identity-commits-to-the-grammar=YES (hash differs)` |
| C | `WITH parses=false reason: field $.teamRequirements is a schemaVersion 2 construct: … move it to the flat requirements list or keep the document at schemaVersion 2` → `VERDICT=REFUSED` |
| D | `WITH parses=false reason: TeamBlueprint has unknown fields: teamRequirements` → `VERDICT=REFUSED` |

B is the only option under which a v3 document can **carry an authority requirement in its identity and receive no authority check**, and whose own failure message about that is nothing. D's message is worse than useless to an author: it says the field name is wrong, not that the grammar retired.

For reference, the same instrument at base (before any flip) measures the live inconsistency directly:
`bridge v2=["req-tool-web","req-team-1"] v3=["req-tool-web"]`, `scopes v2=["team","template:leader","template:worker"] v3=["team"]`, `DECIDER=DIVERGENT (v3 ignores the grammar)` — and changing `req-team-1`→`req-team-x` **at v3 moves the `contentHash` while producing identical runtime inputs** (`transcripts/T1-probe-runtime-gates-v2-vs-v3.txt`, `T0`).

### 2.4 Migrated-fixture experiment (the one that actually prices the options)

**(a) Can the option land *before* the flip?** Applying each option to the **unflipped** base (v1/v2/v3 all still supported) and running the whole 52-file universe:

| option | result | transcript |
| --- | --- | --- |
| **A** | `52 passed (52)` / **`777 passed (777)`**, 0 new red | `PREFLIP-A-raw.txt` |
| **C** | `52 passed (52)` / **`777 passed (777)`**, 0 new red | `PREFLIP-C-raw.txt` |
| **B** | **13 files / 32 test titles red** (`33 failed \| 690 passed`) | `PREFLIP-B-raw.txt`, `PREFLIP-B-failing.txt` |

A and C are **pure v3-behaviour changes**: they can be landed today, reviewed on their own, and reverted on their own. B **cannot be decoupled from the flip** — deadening the gates destroys enforcement for v2 documents *right now*, which is exactly the 32 titles below.

The 32 titles B kills even before the flip (verbatim from `PREFLIP-B-failing.txt`; these are the families whose *subject* is the structured grammar):

```
premise: the leader template declares NO requirements (its scope has no verdict inputs)
premise: the fixture worker template produces NO requirement inputs / verdicts (the empty case)
L1: a Leader REQUIRED requirement down blocks the normal turn and offers the recovery dispatch
L1r: with the Leader required scope blocked, RECOVERY work is allowed (reduced authority)
L3: recovery-mid-recovery keeps the current turn Recovery; the next boundary … exits to Normal
L5: a Team-level REQUIRED requirement down blocks the Leader normal turn
BL1: a HEALTHY leader template PASSES on the leader OWN (root) observation …
BL2: a leader whose OWN observation is `complete` FATALs with the leader observation …
BL3: in ONE world, the leader template is judged by the ROOT observation and the member …
C7 — the RESUMING worker (slot pending) PENDING-blocks the first delegate (the kit B5 first half)
C8 — the slot FAILED seconds later: the same delegate is the typed down-category FATAL …
D3c — the v2 resuming worker (slot pending) PENDING-blocks the admission (the engine PASS is voided)
E6 — the v2 template no-seed FATAL is reclassified to PENDING (the non-disabled blocked template)
U1 … U5 (five) — the scoped-identity plumbing + materialization axis
T1 (×2) / T2 / T3 / T4 (×3) / T5 / T6 — persona-kind provider preflight, template-scope role dispatch
S1 (×2) / S2 (×2) / S4 (×2) — the boot create rejects typed … + zero durable effect
```

**(b) Does a family's claim survive once its document is a legal v3 document?** Promoting a carrier family means: digit `2`→`3` **plus the two authority documents v3 requires** (`permissionMutationEnvelope`, `teamHardEnvelope`) — `scripts/promote-fixture.py`, log `T13-promotion-log-under-A.txt`.

| family (carrier file) | under A | under B (delete) | under C | under D |
| --- | --- | --- | --- | --- |
| `consent-scope-hash-binding` (19) | **19/19 green** with digit + envelopes only (`T8`) | file dies at module scope: `AssertionError: expected null to be an instance of TeamRuntimeError` (`consent-scope-hash-binding.test.ts:367`) → **all 19 vanish**; the creation-preflight refusal *stopped being a refusal* (`T10`) | dies at module scope with the **named, actionable** `TeamContractError` | dies with `TeamBlueprint has unknown fields: teamRequirements` |
| `startup-preflight-production-create` | green | `the boot create rejects with the typed creation-preflight refusal (outcome fatal)`, `the boot create rejects typed with the blocked template scope + the down requirement`, `the boot create rejects typed with the consent-required requirement id` — all `expected null to be an instance of TeamRuntimeError` (`T14`) | refusal | refusal |
| `startup-all-templates-real-authority`, `startup-consent-production`, `startup-template-disable-production` | green | module-scope death (real authority at startup never forms) | refusal | refusal |
| `leader-template-required-boundary` | survives (needs hand envelope injection) | `L1r: with the Leader required scope blocked, RECOVERY work is allowed (reduced authority)` red | refusal | refusal |
| `requirement-d1-d3-decision-scoping` | survives; **its own mirror at `:890` must widen too** (the only surviving TS2367 under A) | module-scope death | refusal | refusal |
| `leader-disable-no-requirements-initial-work`, `mcp-target-materialization(-unit)`, `persona-kind-provider-preflight` | survive (no grammar-attributable failure) | `BL1/BL2/BL3`, `U1–U5`, `T1–T6` red | refusal | refusal |
| document layer: `t2-blueprint-v2-requirements`, `t2-blueprint-v2-hash`, `blueprint-v1-frozen-resume` | must be re-authored anyway (they *are* v1/v2 comparison families; 2 reds are `unsupported blueprint schema version 1`) | same, plus the grammar legs | same | same |

Aggregate over the 16 promoted carriers: **under A, 0 failures attributable to the grammar** — every remaining red is `missing required field 'permissionMutationEnvelope'` (36×, my injector not matching that file's fixture shape — a probe artifact, listed in `T13`) or the two deliberate v1-twin legs. **Under B, 45 red of 126 including 7 × `expected null to be an instance of TeamRuntimeError`.** That signature — *an assertion that something refuses, and nothing refuses* — is the shape of an authority surface disappearing, and A has zero of them.

### 2.5 Files the flip strands regardless of option

* `packages/domain/blueprint/testdata/fixtures.ts` — **32 `schemaVersion: 1` fixtures + 1 v2**, **16 test files import it**; under the flip those importers report **107 failed of 213**. The flip cannot land without editing it, so "expressible without touching `fixtures.ts`" is a property of the *semantic* option only: A/B/C/D each add **no additional** `fixtures.ts` edits (the edits the flip forces are the same set for all four).
* `cordis.patch.yml:60` `schemaVersion: 1` (inside `blueprintSource:`) — a real composition-manifest document, parsed by `packages/runtime/src/plugin/team-spill-local.ts` / `host.ts` and asserted in `team-spill-local-composition.test.ts`, `rc2a1-fs-containment.test.ts`, `a4p7-v3-cutover-acceptance.test.ts`. **This is one live document outside the test corpus that the flip strands**; it needs a digit + the two envelopes, and it is coordinator-owned. It carries **no** structured grammar, so **no option changes its migration** — the composition manifest is not a stake in this decision, which is worth saying because it was assumed to be.
* The five high-fan-out factories and their 248 importers (plan §7.3) are affected by the flip, not by the choice; only D additionally changes a closed set some of them assert.

---

## 3. Reversibility, and the cost of being wrong later

Assume real v3 documents exist outside this repo (a composition manifest is one; user-saved blueprints are the general case).

| option | if it turns out to be wrong, the repair is | one-way? |
| --- | --- | --- |
| **A** (relax) | Re-tightening later means re-gating five call sites **and** dealing with real v3 documents whose grammar *has* been enforced — i.e. teams whose creations have been **refused** by a requirement they now want retired. Retiring enforcement from a working system is a **behaviour removal** on live documents. | soft one-way: widening is safe, narrowing after adoption is a breaking change |
| **B** (retire) | Re-enabling means a **document migration in the other direction**, but the documents were never migrated: B leaves them *valid and hashed and ignored*, so the repair is invisible until someone reads code. Worse, the corpus accumulated under B contains v3 documents that *believe* they require things. | silently one-way: the state is indistinguishable from "already retired" and nothing records which it is |
| **C** (forbid) | Widening C later is cheap and **additive**: v3 documents that were refused never entered the corpus; widening accepts them. C is the most reversible option for the *document* corpus. | reversible forward, irreversible backwards (see below) |
| **D** (un-nameable) | Reversible in code, but it is the one option that **contradicts a pinned ADR assertion** (V12 red) and its refusal message misleads the author, so migration damage from real documents has already happened by the time anyone notices why. | reversible in code, costly in authors |

The asymmetry that decides it: **the corpus is empty today.** Over **173 blueprint-bearing test files (174 matched the `schemaVersion` grep; 173 collected) and 2276 real `parseBlueprint` events, `0` v3 documents carry the grammar** — clean instrumented run `transcripts/T16-wide-census-clean.txt`, tally `T16-census-tally.txt`:

```
1084  v=3 flat=1 teamReq=0 templateReq=0      357  v=3 flat=0 teamReq=0 templateReq=0
 347  v=2 flat=0 teamReq=1 templateReq=1      117  v=2 flat=0 teamReq=1 templateReq=0
 338  v=1 flat=0 teamReq=0 templateReq=0       27  v=1 flat=1 teamReq=0 templateReq=0
   3  v=2 flat=0 teamReq=0 templateReq=0        2  v=2 flat=0 teamReq=0 templateReq=1
   1  v=2 flat=1 teamReq=0 templateReq=1
```

**465 v2 parses do carry it (`347+117+1`), and no v3 parse ever does.** (The earlier attempt `T4-*` ran while its instrument was being reverted mid-flight; `T16` is the clean run and reproduces the tally **digit for digit**, which is why the number is safe to build on. The 13 red tests in that run are the §0 base debt, unchanged.) So:

* choosing **A now costs nothing measurable** (777/777 green pre-flip) and buys a decision that cannot be reversed later;
* choosing **B or C now manufactures no cost either**, but it *defers* the question to the moment a v3 document with the grammar exists — and at that moment A→B is a breaking behaviour removal, B→A is untraceable, and C→A is the only cheap move;
* **A manufactures the decision at the cheap moment.** C is the honest runner-up: it is equally cheap now and is the *only* option whose later reversal is clean. If the requirement were "the grammar must die eventually", C is the correct choice, not B — C at least says so out loud to every author, at a fixed cost of 9 lines.
* **B is the only option that manufactures its own undetectability**: it keeps the field legal, keeps it in the hash, and keeps it unenforced.

A note on C's real cost: a *named* diagnostic code (`BLUEPRINT_STRUCTURED_REQUIREMENTS_RETIRED_AT_V3`) would have to be added to `packages/contracts/src/errors.ts:21` `TeamContractErrorCode`, which is a **closed v1 set** — so C either reuses `MALFORMED_DTO` with a good message (what I probed) or pays a contracts edit. C at base is also **not free of future cost**: it forces every migrating v2 author to rewrite `requirementId`/`type`/`subjects`/`complete` (a six-type closed set) into the flat `domain`/`name`/`optional` triple, which is lossy — there is no flat spelling of `type: teamStructure` with `complete: true`.

---

## 4. The silent-drop hazard (re-verified this round, four levels)

`probes/probe-silent-drop-census.test.ts`, run on the clean base → `transcripts/T15-silent-drop-census.txt`. Dropping each of `metadata: {}`, `requirements: []`, `members: []`, `memberEnvelopes: []`, `policyStates: []` **individually and all five together** from a v3 document:

```
[[CENSUS]] {"key":"metadata",        "contentHash_identical":true,"frozenBlueprint_deepEqual":true,"projection_bytes_identical":true,"projection_elementSet_identical":true}
[[CENSUS]] {"key":"requirements",    … all four true}
[[CENSUS]] {"key":"members",         … all four true}
[[CENSUS]] {"key":"memberEnvelopes", … all four true}
[[CENSUS]] {"key":"policyStates",    … all four true}
[[CENSUS]] all-five contentHash_identical=true projection_identical=true
[[CENSUS]] source keys lost=["memberEnvelopes","members","metadata","policyStates","requirements"] count=5
```

Confirmed at `validate.ts:1240` (`members … ?? []`), `:1291` (`memberEnvelopes … ?? []`), `:1350` (`policyStates … ?? []`), `:1458` (`metadata` → `{}`), and the same defaulting for flat `requirements`. **Only the SOURCE key set sees it.** Therefore:

> **Any option whose migration touches document literals owes a parse-level or element-set census, never a line-diff census.** A YAML line-diff review of a migration that deletes five empty declarations reports five changes and zero consequences; a parse-level census reports zero changes and zero consequences; only a *source-key-set* comparison reports five changes and zero identity changes — which is precisely the case where a migration can silently delete real content that happens to be empty *in the fixture but not in the field*.

Loud fields, verified in the same run: `teamRequirements` changed → hash moves; `teamRequirements` removed → hash moves; `teamHardEnvelope` / `permissionMutationEnvelope` removed → **refused** (`blueprint is missing required field 'teamHardEnvelope' at $`); `revision`, `leader.templateId` → hash moves. And **loudness is a property of the value, not the field**: `[[CENSUS]] non-empty members drop is loud: true` — the same `members` key is silent when empty and loud when populated. `deriveContentHash(toHashableBlueprint(x)) === parseBlueprint(x).contentHash` was asserted, so the census oracle is the parser's own, not a reimplementation.

**Would each option's own tests catch a silent drop of the field it moves?** Measured, for the recommended option, by mutation:

*Option A + mutation M1* — `toHashableBlueprint` omits `teamRequirements` when `schemaVersion === 3` (one-line, silent):

```
packages/domain/test/__probe-a473-identity.test.ts   ← the v3 twin I had to write
  × a declared teamRequirements puts the key into the hashable projection
  × the hash changes when a requirement flips complete true -> false
  × the hash changes when a requirement subject changes
  × the hash changes when the grammar is removed entirely
repo universe under A+M1:  Test Files 24 failed | 28 passed (52)   Tests 74 failed | 488 passed (562)
diff RUN-OPTION_A-failing.txt RUN-A-plus-M1-failing.txt → EMPTY
```

**0 of 562 tests in the affected universe notice a silent v3 identity drop of the grammar.** The only instrument that does is the 4-test twin I wrote for this dossier. For B/C/D the question does not arise the same way: C and D make the field's presence a **parse-level refusal** (loud by construction), and B is exactly the option that *is* the silent drop, executed in production code rather than in a mutation.

---

## 5. Recommendation, with the residual priced out loud

**Do A, as a commit that lands before the flip, and ship it with the two instruments this dossier had to write by hand.**

1. Land A (7 lines across the 5 gate files) on `d4eb9f39`+ : **777/777 green**, no fixture churn, reviewable and revertible alone.
2. Then take the flip digit (`schema.ts:75`, `types.ts:416`). Its true cost is **31 error lines / 23 real files**, of which the semantic option contributes **0** under A (the 10 production TS2367 lines disappear the moment A lands — A is what makes the flip typecheck-clean in production).
3. Land, in the same PR, the two missing v3 instruments (both green at A, both red under a silent-drop mutation):
   * the **identity twin** — v3 version of `t2-blueprint-v2-hash`'s "structured requirements participate" block (`probes/probe-v3-identity-binds-grammar.test.ts`, 4 tests);
   * the **enforcement twin** — v3 with-grammar vs without-grammar must produce **different** `compatibilityRequirementsOf` and `scopeRequirementInputsOf` answers (`probes/probe-postflip-v3-grammar.test.ts`).
   Without these, A is a behaviour with no witness: **0 of 562** repo tests, and **0 of 2276** census parses carry the grammar at v3.

**What A still cannot catch, in numbers:**

* **0 → 562:** nothing in the repo binds v3 identity to the grammar today; A does not change that, only the new tests do. Until they land, a regression that drops the grammar at v3 is invisible to the entire suite, in every package (`T12-M1-vs-A-diff.txt` empty).
* **0 → 2276:** no live document exercises the new path, so A ships **unexercised in production terms**; the first real exercise is a user document.
* **103 lines:** A keeps 103 lines of guarded block that B deletes. If the intent was ever to retire the grammar, A defers that bill and removes the version gate that would have made retirement a one-digit change — a future v4 retirement must delete the same 103 lines *plus* migrate whatever accumulated.
* **1 mirror:** `requirement-d1-d3-decision-scoping.test.ts:890` re-implements the gate predicate (`world.templateReadSource !== undefined && bp.schemaVersion === 2`) and is the **single remaining TS2367 under A**. It must widen with the gate; if someone silences it instead, that file's E6 leg becomes a v2-only leg with no type error — a second silent-drop surface, this one in a test helper.
* **2 v1-twin legs** (`blueprint-v1-frozen-resume`, `t2-blueprint-v2-hash`) and `p5t5-helpers.ts:80` still fail under every option — flip debt owned by §7.4, not by this decision.

**What B would have protected, stated plainly:** B would have guaranteed that **no document can ever claim a requirement it does not enforce** — under B, the flat list is the only requirement surface at v3, so `hash ⇒ enforcement` holds trivially and the whole class of "declared, hashed, ignored" documents cannot be written. A gives up that structural guarantee and replaces it with a *test* (the enforcement twin). That is the trade I am recommending: the guarantee is worth less than the corpus, because the corpus (465 v2 parses, and every real v2 blueprint that will be migrated) is where the authority actually lives, and B's guarantee is bought by silently voiding it. If the coordinator wants both, the way to have them is **A + the enforcement twin**, not B — and if the intent is genuinely to retire the grammar, the honest option is **C** (9 lines, landable today, reversible forward), never B.

---

## 6. Every instrument that lied to me, and how I caught it

1. **`pnpm -r run typecheck` lied about the flip's size.** It reported 5 errors — because it **bails at the first failing project (`domain`) and never compiles `runtime`**, where all five gates live. Caught by adding `--no-bail`: 31 lines / 23 files. This is the mechanism behind the plan's "exactly 5 errors, no others".
2. **The same 5 production sites were counted twice.** `runtime` and `tools` both include those sources, so TS2367 appears 10× for 5 real sites. Caught by deduplicating `(path, line, code)` after stripping the package prefix — the raw `grep -c` number is not a file count.
3. **`git diff origin/master` silently changed meaning mid-session.** `origin/master` advanced twice (`d4eb9f39`→`a7fdb77c`→`e3828400`); a `git diff origin/master --stat` suddenly listed two `packages/testkit` files I had never touched, which read like stray edits from my probes. Caught by `git rev-parse origin/master` vs `git merge-base` and pinning every command to `d4eb9f39`; I also verified #157 touched none of the 7 files in my surface.
4. **`git checkout <file>` restored the previous probe, not the base.** HEAD was a throwaway probe commit, so "revert the option" re-applied it; my B probe died on a missing anchor *after* patching one file, leaving a half-applied tree — and the "19 passed under B" I recorded that run was really a second A run. Caught because the B anchor assertion aborted the script (`StopIteration`) after the run had already been logged; the transcript was renamed to `T9-B-INVALID-not-applied-actually-A.txt` and the applier was rewritten to `git checkout <base-sha> -- packages` **first, always** (`scripts/apply-option.py`).
5. **My own probe polluted the measurement it was making.** Copying `__probe-*.test.ts` in *before* typecheck added **8 `TS2339` errors** (in runtime tests `process` is a repo-typed global whose type has `cwd()`, not `stdout`), inflating option C from 31 to 39 errors. Caught by classifying the "extra" 8: every one pointed at `__probe-`. Sweep order fixed to typecheck-then-probe, and every table row here excludes `__probe` lines.
6. **A `git stash push --include-untracked` ate my own evidence.** My transcripts and probe files vanished from the tree; a follow-up redirect failed with "No such file or directory" which looked like a broken `grep`. Caught via `git stash list` / `git stash show --include-untracked --name-only` and `git stash pop`. Never use `stash --include-untracked` on an evidence-bearing worktree; probe files now live canonically in `probes/` and are *copied* into `packages/**/test` to run.
7. **`/tmp` is per-bash-call in this sandbox.** A probe file `mv`'d to `/tmp` for safekeeping was gone on the next call, and because the `mv` succeeded the `|| cp` backup branch never ran — the file was simply destroyed. Caught when the "restore" produced nothing; re-created the probe and put the canonical copy in the evidence directory.
8. **An untrustworthy emitter and index arithmetic, twice.** An early hand-rolled YAML emitter and a `COMMON.slice(0,21)/slice(21)` split both produced documents that failed for *emitter* reasons, not semantic ones (`A block sequence may not be used as an implicit map key at line 27`). Caught by the parser refusing loudly, and fixed by hand-written YAML line arrays and by appending v3 keys directly after the version digit — no index arithmetic anywhere in an instrument.
9. **A fixture populated with *non-empty* values made the silent-drop claim look false.** My first silent-drop probe replaced the five defaulted fields with real content, so the hash moved and I nearly reported the brief's hazard as refuted. The hazard is specifically about *empty* declarations; fixed with a `…_FIVE_EMPTY` fixture and then the four-level census.
10. **The `sourceKeySet_differs` field inside my own census JSON reported `false` for all five keys** while the very next line proved 5 keys were lost. It was a malformed expression I never asserted on; I do not cite it. The citable evidence is `source keys lost=[…] count=5` (`T15`). If I had trusted the field instead of the assertion, the census would have "shown" the source was unchanged too — which would have erased the only level that sees the drop.
11. **Two files I conflated by name:** `t2-blueprint-v2-hash` (green in my baseline batch) and `t2-blueprint-hash` (red, base debt). A "same file passed before, fails now" contradiction sent me hunting a phantom order-dependence. Caught by reading the actual filenames in the two runs; both statements are true of *different* files.
12. **`git status --porcelain` kept showing 7 modified production files after I had "reverted".** HEAD was a probe commit, so base content *is* a modification relative to HEAD. Caught by `git log --oneline -1` in the same output; the tree now sits on `git reset --hard d4eb9f39`.
13. **The census instrument was reverted while its own run was in flight.** I started the 174-file wide census with `[[CENSUS]]` instrumentation in `toHashableBlueprint`/`parseBlueprint`, then reverted `validate.ts` to save the patch — mid-run. Any file vitest transformed afterwards would have reported *no* parse event, so the headline "0 v3 documents carry the grammar" could have been an artifact of my own revert rather than of the corpus. Caught it by noticing the ordering, and resolved it the only honest way: re-ran the whole wide census cleanly with the instrument installed for the entire run (`T16-wide-census-clean.txt`), which reproduced the tally **digit for digit**. A measurement whose instrument can be removed underneath it is not a measurement.
14. **`git status` and my own commit staging nearly smuggled probe files into the branch.** `git add packages` was broad enough to sweep in files a probe had touched; the check that saved the branch was `git diff d4eb9f39 --name-only | grep -v '^dev/agent-workflow/evidence/…'` at the end, not `git status`, because `git status` is silent about anything already committed by a probe commit that I then reset past.
15. **The brief's own anchors were stale in both directions.** The five gate paths given to me had drifted (real: `requirements/`, `admission/`, `compatibility/`, `activation/` under `packages/runtime/`); "7 carriers" is 17 files; the plan's "5 errors" and the coordinator's "14 in 13" are both unreproducible (§2.1); and a docstring in `schema.ts` claims `scripts/verify-blueprint-version-clean.mjs` "DOES NOT EXIST YET at PR1" while the file exists at base. Every one of these was caught by running the command instead of quoting the document.

---

## 7. Reproduction

```bash
EV=dev/agent-workflow/evidence/a4-pr7/7-3-decision
python3 $EV/scripts/apply-option.py d4eb9f39 A     # reset-first, then flip + option (A|B|C|D|flip)
$EV/scripts/sweep-one.sh A                          # typecheck(no-bail) + post-flip verdict + universe + promoted family
$EV/scripts/preflip-check.sh A                      # landability BEFORE the flip (the 777/777 number)
python3 $EV/scripts/apply-b-delete.py               # B as a real deletion (103 lines), not `if (false)`
python3 $EV/scripts/promote-fixture.py <carrier>    # digit 2->3 + the two v3-required envelopes
cp $EV/probes/probe-postflip-v3-grammar.test.ts packages/runtime/test/__probe.test.ts   # ENFORCED / INERT / REFUSED
cp $EV/probes/probe-v3-identity-binds-grammar.test.ts packages/domain/test/__probe.test.ts  # the missing witness
cp $EV/probes/probe-silent-drop-census.test.ts packages/domain/test/__probe.test.ts         # four-level census
```

Every run must be preceded by `rm -rf packages/testkit/test/.tmp-fault` (a stale one fakes eslint exit-2 reds), and no claim here was made through a pipe that ate an exit code — the scripts capture `vitest_exit=` explicitly.
