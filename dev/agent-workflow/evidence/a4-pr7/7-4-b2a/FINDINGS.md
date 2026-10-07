# A4-PR7 §7.4 — lane B-runtime-semantics-A — findings

Lane: **B-runtime-semantics-A** (§7.4 fixture migration, `packages/runtime/test/`).
Base: `a4ef2a6b` (`origin/master` when the lane opened). Lane head: this branch
`feat/a4-74-b2a-fixtures`, which now **also merges `origin/master 14ea8717`** (§13); the commit list
is `git log --oneline a4ef2a6b..HEAD` — five code commits, two evidence commits, the merge, and the
review-round fixes on top. One writer, one worktree (`.worktrees/a4-74-b2a`), **nothing pushed**:
the branch is held for the parent to merge.

Roster: **34 files** (29 specs + 5 non-`P6T*-helpers` fixture modules), **45 dirty sites**
at base — every one of them is now off the fence's dirty list, and the fence gained
**zero** new sites anywhere in the tree.

Review round 2 (independent review, MERGE-with-fixes) is applied and is what §§1, 4, 5, 6, 7, 8, 9,
10, 12 and 13 now say: the consumer census corrected from "193" to 135 distinct files / 223 import
edges incl. the 8 `packages/tools/test/` consumers; the base consumer transcripts unmasked as
artifact runs and re-measured; §4's trial rows named by their real `it()` titles; the §6
load-correlation claim withdrawn; the §7 ledger ruling reversed (positional keys stay); the §8
re-run duty moved into the fixture and the throw site cited precisely; and an element-set census
added where a line diff was previously trusted.

---

## 1. What the fence says (the whole-lane number)

| class | base `a4ef2a6b`<br>(`transcripts/fence-base.txt`) | this lane's head pre-merge<br>(`transcripts/fence-head.txt`) | **merged tree, now**<br>(`transcripts/fence-merged-1/2.txt`) |
| --- | --- | --- | --- |
| dirty (gates) | **110 files / 213 sites** | 76 / 168 | **7 files / 51 sites** |
| unknown (gates) | 0 / 0 | 0 / 0 | **0 / 0** |
| advisory | 9 / 14 | 9 / 14 | 8 / 10 |
| refused | 52 / 115 | 52 / 115 | 52 / 115 |
| prose | 5 / 5 | 5 / 5 | 5 / 5 |
| adjudicated | 16 / 24 | 16 / 24 | **16 / 24** |

Read the three columns as: what this lane removed (base → middle), and what the merge of
`origin/master 14ea8717` brought in plus what this lane removed, measured against **master's** dirty
set (right column, §13):

* **base → pre-merge head:** `213 − 168 = 45` = exactly this lane's base dirty-site count; OFFENDING
  paths 110 → 76, **gone 34 (= this roster, path for path), added 0**, and no other path's site list
  changed.
* **master → merged:** master's DEFERRALS list carries 41 dirty paths; the merged tree reports
  `dirty(7 files, 51 sites)`; by-path **gone 34, added 0**, and **0 of the 7 remaining paths belongs
  to this lane** — the seven, each with its reason, are in §13. The wrapper's two legs (every dirty
  path has a row; every row still names a dirty path) passing at 58/58 is what makes "the dirty set
  is exactly those 7" mechanical rather than eyeballed.
* The `advisory` move 9/14 → 8/10 is **not** this lane: no roster path is in the advisory class on
  the merged tree. It is master's own fixture round arriving.
* **Where this lane's 34 files sit now** (measured out of `transcripts/fence-merged-1.txt`):
  dirty 0, unknown 0, advisory 0, prose 0, **refused 10** (non-gating declared-version claims in
  documents this lane deliberately left alone or rewrote as self-owned witnesses),
  **adjudicated 1** (`p6t4-helpers.ts`, whose ledger row survived because that promotion is
  line-neutral, §7).
* REFUSED *line numbers* moved in **9 files, all of them mine** at the pre-merge head — a comment
  inserted above a refused literal shifts its line.
  `transcripts/fence-refused-line-moves.txt` compares each moved site's verdict text with its line
  number masked out: **verdict text byte-identical in every one**, nothing added, removed or
  reclassified, and no file outside this roster appears.
  `transcripts/fence-by-path-diff.txt` is the machine-generated path diff for all six classes.
* Two consecutive runs of `node scripts/verify-blueprint-version-clean.mjs` are
  **byte-identical** at every stage: the pre-merge pair (`cmp` clean, 173 lines) and the merged pair
  (`transcripts/fence-merged-1.txt` and `fence-merged-2.txt`, exit 1 — dirty is still non-empty because the seven
  files above remain, which is correct at this point of the §7.4 fan-out).

## 2. The three dispositions this lane actually used

The §7.4 probe law was applied per document, not per file: put an unsupported digit in the
literal and run the file. **Probe-red ⇒ the literal is live ⇒ migrate or keep it honestly;
probe-green ⇒ nothing reads the literal.**

1. **Decoration, follows the build (24 files / 38 sites).** A closed-generation document
   whose subject is something else entirely (permission lanes, MCP supply, model routing,
   control envelopes, restart durability…). The digit asserted "this is a blueprint", not
   "this is a version-1 blueprint": promoting it to the supported version and declaring the
   envelope pair that version REQUIRES changed nothing observable. Each of these documents
   got `rules: []` on **both** planes, with a comment in the fixture saying why that is a
   position and not a blank — expansion plane: a no-match answers `no-authority`, so the
   document claims no expansion authority for its Leader; approval plane: a no-match is
   identity, so it removes no rung. Whether that position is *reachable at all* is a property
   of the world, and the comment says which world each file builds:
   * **root-direct** (the P6T1/P6T2/P6T4/P6T6 factories, `createTeamProductionRoot`, the
     `createRootAgent`/`createAgentBindings` glue worlds): no `permissionAuthorityCeiling`
     is ever injected — the one production producer is `packages/runtime/src/plugin/host.ts`
     — so the pair is grammar, inert by construction;
   * **parse-only** (`a2c1`, `a2c7`, `a6a`): nothing boots a world from the document at all;
   * **host-booted** (`f1-webserver-shim-isolation`, via `hostEntry.apply`): the ceiling
     reader IS live, so the empty hard document is a claim — honest because that file drives
     no permission mutation and no approval-driven operation.
2. **The version is the subject → self-owned witness (7 files / 7 sites, the v2 cluster).**
   See §4. The bytes stay, the digit moves onto a `TeamBlueprint['schemaVersion']`-typed
   constant the file owns, so the fence no longer sees a version literal and §7.3's
   narrowing turns the assignment into a **compile error naming the file**.
3. **Probe-green → the version claim is deleted (2 files / 2 sites).** `mcp-supply-config`
   and `p8s5a-host-loadability` hand a one-line `blueprintSource` to
   `host.validateTeamPluginConfig`, which requires only a **non-empty string**
   (`packages/runtime/src/plugin/host.ts:612`) and never parses it — measured, not argued:
   raising the version to one the product refuses left 39 and 3 tests green. The digit and
   its comment now say what the field is to that validator. **Disclosure of a deliberate
   deviation from the plan's wording here:** the plan called these two `delete-lie`, which
   reads as "delete the literal". Deleting the whole value is impossible (`:612` requires a
   non-empty string) and deleting the *document-ness* of a field that every other consumer
   of `validateTeamPluginConfig`'s output feeds to a real parser (`host.ts:1857-1862`,
   `agent-bindings.mjs:1810`) would trade one lie for a worse one. So the version claim is
   gone and the value is kept as an opaque non-empty string — the minimum that satisfies
   both the validator and the truth. A reviewer who prefers the strict reading should say
   so; both forms are green.

`invert-to-refusal` was **not** used anywhere, and could not have been: with
`SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS = [1, 2, 3]` (`packages/domain/blueprint/src/schema.ts:75`)
nothing is retired, so a refusal-flavoured fixture would have manufactured a retired version
out of thin air. Nothing under `packages/domain/blueprint/**` was touched, and no production
comparison was edited.

## 3. Per-file table

"Claim" is what the digit was actually asserting in that file. Full base site list:
§1's by-path diff, or `transcripts/fence-base.txt`.

| file | sites at base | what the digit claimed | disposition |
| --- | --- | --- | --- |
| `a2c1-pwsh-permission.test.ts` | L211, L248 v1 | "a blueprint", fed to the parser/permission-diagnostic surface | follows-build → v3 + `rules: []` pair (parse-only) |
| `a2c3-inspect-operation-permission.test.ts` | L114, L463 v1 | ditto (inspect-operation permission) | follows-build → v3 + pair (root-direct) |
| `a2c7-subtree-matcher.test.ts` | L569, L1473, L1494 v1 | ditto (subtree-matcher probe sources) | follows-build → v3 + pair (parse-only) |
| `a6a-production-wiring.test.ts` | L103, L198 v1 | ditto (production wiring fixtures) | follows-build → v3 + pair (parse-only) |
| `alpha2-explicit-agent-setup.test.ts` | L83 v1 | ditto | follows-build → v3 + pair (root-direct) |
| `control-abandon-without-resolve-envelope.test.ts` | L121 v1 | ditto | follows-build → v3 + pair (root-direct) |
| `control-subject-cross-kind-alias.test.ts` | L60 v1 | ditto | follows-build → v3 + pair (root-direct) |
| `d2-s6-ensure-root-live.test.ts` | L402 v1 | a row-config anchor blueprint | follows-build → v3 + pair (root-direct glue) |
| `exec-contract-dual-gate.test.ts` | L491, L626 v1 | "a blueprint" (exec-contract gate worlds) | follows-build → v3 + pair (root-direct) |
| `f1-webserver-shim-isolation.test.ts` | L123 v1 | ditto, **host-booted** | follows-build → v3 + pair, comment names the live ceiling |
| `f15-mcp-live-loss.test.ts` | L143 v1 | ditto | follows-build → v3 + pair (root-direct) |
| `f15-mcp-live-loss-characterization.test.ts` | L97 v1 | ditto | follows-build → v3 + pair (root-direct) |
| `mcp-blueprint-initial-grant.test.ts` | L121 v1 | ditto — the unit-level twin of a `C-testkit` kit | follows-build → v3 + pair **now** (the kit's document went to the supported version in the C-testkit lane; a v1 twin would have diverged from the thing it mirrors, and the sibling v2 governance-override carriers stay REFUSED and untouched) |
| `model-activation-step8.test.ts` | L88 v1 | ditto | follows-build → v3 + pair (root-direct) |
| `model-blueprint-initial-routing.test.ts` | L73 v1 | ditto | follows-build → v3 + pair (root-direct) |
| `model-inspect-config.test.ts` | L47 v1 | ditto | follows-build → v3 + pair (root-direct) |
| `multi-mcp-wiring.test.ts` | L157 v1 | ditto | follows-build → v3 + pair (root-direct glue) |
| `p6t1-checks.test.ts` | L393, L427, L556 v1 | ditto (three documents) | follows-build → v3 + pair (root-direct). **Naming note:** the §7.4 roster calls this file a helper; it is a SPEC (`p6t1-checks.test.ts`, 27 tests) that happens to check helper output. Treated as a spec, so it was migrated in place rather than "promoted with its consumers". |
| `p6t1-parallel.test.ts` | L42 v1 | ditto | follows-build → v3 + pair. Declared load-sensitive flake: §6. |
| `p6t1-helpers.ts` | L107 v1 | the blueprint every P6-T1 consumer world is built from | follows-build → v3 + pair, consumer set re-run (§5) |
| `p6t2-helpers.ts` | L82 v1 | ditto for P6-T2 | same |
| `p6t3-helpers.ts` | L70 v1 | ditto for P6-T3 | same |
| `p6t4-helpers.ts` | L84 v1 | ditto for P6-T4 | same, with the line-neutrality constraint of §7 |
| `bound-blueprint-persona-helpers.ts` | L55, L73, L94, L112 v1 | the four diverged bound-persona documents | follows-build → v3 + pair on all four; the section header that called them "closed v1" now says "the supported document version" |
| `consent-scope-hash-binding.test.ts` | L130 v2 | **a document declaring v2**, because the consent scope hash binds the v2 requirement scopes | self-owned witness (§4) |
| `fix-control-authz-c-abandon-terminal.test.ts` | L2115 v2 | **a document declaring v2** — row `c9-r3-1` exists to prove the v2 template-facts feed is live | self-owned witness (§4); its stale "the P6-T2 fixture blueprint is closed-generation" prose was corrected (that document went to the supported version in this lane) |
| `leader-disable-no-requirements-initial-work.test.ts` | L116 v2 | **a document declaring v2** (leader template scope; the file also asserts the read-back version) | self-owned witness; the `toBe(2)` assertion now reads `toBe(DECLARED_DOCUMENT_VERSION)` — same value, one carrier |
| `leader-recovery-next-boundary-exit.test.ts` | L51 v2 | ditto | self-owned witness |
| `leader-template-required-boundary.test.ts` | L77 v2 | ditto | self-owned witness |
| `mcp-target-materialization.test.ts` | L188 v2 | **a document declaring v2** (worker/leader template scope drives the target-specific block) | self-owned witness. Its three `sessionBindings` v1 rows are the ROW axis, not a document: untouched, untouched by the fence. |
| `mcp-target-materialization-unit.test.ts` | L88 v2 | ditto (unit-level read of the same surface) | self-owned witness |
| `mcp-supply-config.test.ts` | L320 v1 | nothing — the validator never parses it | probe-green → version claim deleted (§2.3) |
| `p8s5a-host-loadability.test.ts` | L76 v1 | nothing — same validator path | probe-green → version claim deleted |
| `p8s3b-result-effects.test.ts` | L414 v1 | "a blueprint", and the glue DOES parse it (`agent-bindings.mjs` parses `config.blueprintSource`) | migrated by inspection (v3 + pair). **This file is RED AT BASE** — §8. |

Foreign version axes met and left alone (doctrine: a foreign axis stays where it is):
`TEAM_DOMAIN_SCHEMA_VERSION` / `sessionBindings` v1 rows (`mcp-target-materialization`
:969/:1208/:1478, `p6t1-helpers`), the ledger-row v2 stamps (`p6t2-helpers`, and the
adjudicated one in `p6t4-helpers` — §7), the `p6t4-helpers` ADJUDICATED ledger row, and the
contracts/Remote axes none of these files carry. Nothing on a foreign axis counted as dirty,
so no file had to be stopped on that ground.

## 4. The v2 cluster — why the digit stays, and what would have been lost

The seven v2 documents are not "old v1-style fixtures that haven't been promoted": their
subject is the **v2 requirement-scope surface**, and production compiles that surface *only*
for a document that declares v2. Five production comparisons say so:

* `packages/runtime/requirements/scope-requirements.ts:108` — `if (blueprint.schemaVersion === 2)`
  guards the whole per-template scope compile;
* `packages/runtime/requirements/creation-preflight.ts:217`;
* `packages/runtime/admission/requirement-gate.ts:460` — the per-template facts feed;
* `packages/runtime/compatibility/blueprint.ts:81`;
* `packages/runtime/activation/provider.ts:821`.

So raising the digit does not "upgrade" these fixtures — it **deletes the surface they
observe**. Measured, transcript per file in `transcripts/trial-v2/` (the same documents with
the digit raised and a legal envelope pair added, everything else untouched):

Every row below is named by the `it()` title the transcript prints, so each claim resolves to a
line in a transcript. (An earlier draft described these rows by their subject instead — "the
three rows observing the leader template scope" — which was both unresolvable and wrong for two
of the three.)

| file | base | trial promotion | how it died (row names as printed) |
| --- | --- | --- | --- |
| `consent-scope-hash-binding` | 19 passed | file down at module scope (`Test Files 1 failed`, `Tests no tests`) | `AssertionError: expected null to be an instance of TeamRuntimeError` — the creation-preflight refusal the file asserts stopped being a refusal |
| `fix-control-authz-c-abandon-terminal` | 74 passed | **1 failed / 73 passed** | exactly `c9-r3-1: v2 templateFeed — park at B's templateFacts feed await …` |
| `leader-disable-no-requirements-initial-work` | 5 passed | 1 failed | `premise: the leader template declares NO requirements (its scope has no verdict inputs)` |
| `leader-recovery-next-boundary-exit` | 1 passed | 1 failed | `L3: recovery-mid-recovery keeps the current turn Recovery; the next boundary (fresh probe recovered) exits to Normal` |
| `leader-template-required-boundary` | 7 passed | 3 failed | `L1` and `L1r` observe the **Leader template** requirement scope, `L5` the **team-level** scope — both surfaces are compiled only under v2 |
| `mcp-target-materialization` | 16 passed | file down at module scope (`Test Files 1 failed`, `Tests no tests`) | `Error: mtm T1 follow-up B: the action was ALLOWED — the target-specific block is missing (the Finding F false OPEN)` |
| `mcp-target-materialization-unit` | 5 passed | 5 failed (`U1`–`U5`) | `expected 0 to be greater than or equal to 1` — the scope never reached the ports `U1`–`U5` assert on |

That is the "silent migration that changes what a test proves" this lane exists to refuse.
The plan's ladder for a v2-only need is: (1) build a v3 document that no longer needs the
v2-only grammar — for these seven the claim *is* the v2 surface, so no such document exists
today; (2) stop the file and disclose. This lane did a **third, strictly better thing** where
it could, using the mechanism the C-domain lane had already proven and the coordinator
raised to doctrine: keep the YAML bytes exactly as they were and move the digit onto a
constant the file owns:

```ts
const DECLARED_DOCUMENT_VERSION: TeamBlueprint['schemaVersion'] = 2
// …
  `schemaVersion: ${DECLARED_DOCUMENT_VERSION}`,
```

The YAML is unchanged (`schemaVersion: 2` renders identically); the fence no longer sees a
version literal, so the path leaves the dirty set and its DEFERRALS row can go; and when
§7.3 narrows `TeamBlueprint['schemaVersion']` to the surviving version, the assignment stops
compiling and **names the file** — which is the loud failure §7.4 exists to arrange, in
place of seven documents quietly becoming parse refusals.

Byte identity was proved, not asserted. `byteproof-witness.txt` is the output of the check
in `tools/` that takes each of the seven working files, undoes the carrier (template literal
→ the quoted literal it renders), drops the added `import type` and the witness comment, and
diffs the result against `git show HEAD:<path>`: **the residue is the witness block plus, in
`fix-control-authz-c-abandon-terminal`, the one prose correction named in §3.** No document
byte moved. All seven files then ran green at the counts in §3.

## 5. Helper ownership — the consumer sets, by name

**How many consumers, honestly.** The five promoted fixture modules are imported along **223
import edges** resolving to **135 distinct test files** — not "193", which was the sum of five
per-helper lists and double-counted every file importing two of them. The derivation and the
regeneration command are in `tools/consumers/README.md`; the sets themselves are
`tools/consumers/edges.txt` (223) and `tools/consumers/distinct.txt` (135), per-helper lists in
`tools/consumers/by-helper/`. All 135 live under `packages/*/test`: 8 of them are in
**`packages/tools/test/`** (`archive-member-tool`, `c1-caller-root-binding`,
`c1-list-pending-control`, `issue1-collect-tools`, `p6t6-actions`, `p6t6-guard`,
`p6t6-helpers`, `rc2-team-deny-least-privilege`). An earlier list built by grepping only
`packages/runtime/test` missed those 8 entirely; they are in every run below.

**How the runs were designed.** Both sides run on the **merged tree** (`14ea8717` + this
branch); the *only* thing that changes between a base run and a head run is the content of the
five modules (`git show a4ef2a6b:<module>` vs `git show HEAD:<module>`), so master's own fixture
movement cannot masquerade as an effect of this migration. Scratch is cleaned before and after
each run (`tools/consumers.sh`). After every swap, all five modules and `p8s3b` were re-verified
by sha256 against `tools/measured-files-sha256.txt` — all OK.

| helper | consumer files | base run (merged tree) | head run (merged tree) | red NAMES |
| --- | --- | --- | --- | --- |
| `bound-blueprint-persona-helpers` | 2 | 12 passed (12) | 12 passed (12) | identical (none) |
| `p6t3-helpers` | 5 | 7 failed / 20 passed (27) | 7 failed / 20 passed (27) | identical |
| `p6t2-helpers` | 53 | 7 failed / 454 passed (461) | 7 failed / 454 passed (461) | identical |
| `p6t4-helpers` | 57 | 768 passed (768) | 768 passed (768) | identical (none) |
| `p6t1-helpers` | 106 | 10 failed / 1185 passed (1195) | 10 failed / 1185 passed (1195) | identical |

Transcripts: `transcripts/consumers-base-merged/`, `transcripts/consumers-head-merged/`. The
comparison was made mechanically at both granularities — the 26 file-level `FAIL` lines and the
50 file+test red entries are the same sets on both sides, `base-only` and `head-only` both empty.

**The one time a base/head pair did NOT match, and what it was.** An independent review measured
`p6t1-helpers` consumers at **10 failed / 1105 passed** (base) against **9 failed / 1106 passed**
(head) on the pre-merge head, with a red-name diff of 2 base-only and 1 head-only test, **all
three inside `p6t1-parallel.test.ts`** — the file §6 declares load-sensitive. The re-run above
shows no such diff and no `p6t1-parallel` row red on either side. The honest statement is
therefore not "identical both ways" as a law: it is that **the only base/head disagreement ever
observed in these consumer sets sits in a file that is known to flake under load, and it
redistributed between two runs rather than tracking the migration.** Anyone re-running these sets
should expect to see `p6t1-parallel` rows move and should not read that as this lane's doing.

**Correction, kept in place rather than quietly rewritten.** `transcripts/consumers-base/` is
**not** a clean measurement: the script that produced it (`tools/base_consumers.sh`, superseded
by `tools/consumers.sh`) omitted the scratch clean, so those transcripts are artifact runs —
`p6t1 79 failed | 197 passed`, `p6t2 117 failed | 38 passed`, `p6t4 65 failed | 40 passed`,
carrying 116, 79 and 92 occurrences of `team_domain already exists`. They are retained so the
mistake is auditable; **no number in this document comes from them any more.** §9 carries the
rule.

**No file outside this roster went red at head.** Every red at head is the same-named red at base
(other lanes' baseline-red files: `d3-member-identity-context`, `p6t3-mediation`, `p6t3-restart`,
`p6t3-helpers`' own red rows, and the P6-T1 red rows).

## 6. `p6t1-parallel.test.ts` — declared flake, both numbers, nothing "fixed"

The plan names this file a load-sensitive flake. Sampled on this machine, one file per
vitest invocation, clean scratch each time:

* head (migrated): 6 consecutive runs → **9 passed (9)** all six; three earlier runs taken
  while other vitest processes were running in parallel → `3 failed | 6 passed`, `2 failed |
  7 passed`, `2 failed | 7 passed`.
* base (`git show HEAD:` copy of the same file, run the same way): 6 consecutive runs → five
  green, **one flaked (`1 failed | 8 passed`)**; earlier parallel-load runs also flaked
  (`3 failed | 6 passed`).

Same signature (activation-count assertions reading one behind) at base and head. Not touched
beyond the migration; not "fixed".

**Two claims this section used to make, withdrawn.** First, the correlation with machine load was
asserted more strongly than measured: the parallel-load samples were taken while other vitest
processes happened to be running, and the reviewer's controlled re-measurement observed **no load
correlation**, so what is established is that the file flakes in both content states and that its
flakes are not attributable to this migration — not *why* it flakes. Second, the base samples here
(5 green / 1 flake out of 6) and the reviewer's larger samples are the same phenomenon at
different sample sizes; neither supports a base-vs-head difference. §5's consumer-set paragraph
records the one base/head red-name disagreement that was ever seen, all of it inside this file.

## 7. A hazard this lane found — and the ruling on it, reversed on review

**The hazard.** The §7.4 unknown-adjudication ledger keys by path AND line, so promoting a
document ABOVE an adjudicated unknown silently unadjudicates it. First bite, caught before commit:
promoting `p6t4-helpers.ts` added four source lines, which pushed that file's adjudicated
ledger-row literal from L458 to L462; the ledger key
`packages/runtime/test/p6t4-helpers.ts::L458::v2` stopped matching, and the fence printed
`UNKNOWN … (1 file, 1 site)` — an unadjudicated unknown, which **gates**. The class counts
moved `adjudicated 16 → 15`, `unknown 0 → 1`.

**What this lane did, and what it recommended.** It did **not** edit the ledger (another lane's
reviewed artifact, and several lanes are shifting the same lines concurrently). It made the
promotion **line-neutral** instead: `p6t4-helpers.ts` declares its envelope pair on one source
line, with the reason recorded in the file's own comment. And it recommended re-keying the ledger
by the site's literal text instead of its line.

**That recommendation is REVERSED (coordinator ruling on review, 2026-10-08): positional keys
stay.** Three reasons, and this lane's own measurements support all three:

1. **The literal is not unique; re-keying would silently merge rows.** 5 of the 24 rows live in
   files carrying several ledgered sites — up to three each in
   `packages/contracts/test/negative.test.ts`, `packages/storage/test/p4-helpers.ts` and
   `packages/client/test/team-projection-store-v6.test.ts`. In `contracts/negative.test.ts` the
   three sites (L151, L155, L157) are consecutive calls whose literals differ only inside the
   enclosing expression: L151 and L155 open byte-identically with
   `expectCode(() => parseTeamSessionRecord({ ...validTeam, schemaVersion:` and L157 is
   `() => parseTeamSessionRecord({ ...validTeam, schemaVersion: '1' }),`.
   *Disclosure:* the review note's figure of one literal occurring 58 times in that file did **not**
   reproduce here (`'1'` occurs twice, `schemaVersion: '1'` once); the collision argument holds
   without it, on the byte-identical line pair above.
2. **A site's literal is exactly the text that cannot carry the verdict.** These 24 sites are
   UNKNOWN *because* what decides them is not in the site — the enclosing call, the fixture the
   value flows into, the assertion above it. Keying by literal would file as evidence the one
   string that carries none.
3. **Re-keying 24 reviewed rows mechanically IS the laundering event.** Each row's value is prose a
   reviewer hand-wrote against a line they actually read
   (`"… hand-verified packages/runtime/test/p6t4-helpers.ts:456-460"`). Regenerating keys by script
   would move verdicts off the reading that justified them — the same class of act as hand-patching
   a fixture after a transform ran, which §11 costs this lane a shipped defect.

**Consequences that bind this lane now.**

* **Line-neutral promotion discipline stays in force.** Any file whose promotion site sits above a
  ledger row is promoted without moving lines (the `p6t4-helpers.ts` one-line pair is the pattern;
  the reason is in that file's comment).
* **The screen must be element-level, precisely because line-neutrality is a blind spot.** A file
  that moved no lines can still have lost an element inside one — exactly §11's defect, on exactly
  the inline `push` shape the coordinator flagged. `tools/element-set-census.py` is the standing
  answer: per-file element-stream comparison with contiguity, fence-containment and nesting rules;
  `--self-test` proves the screen is not blind (4/4 mutants caught, after two earlier revisions of
  it reported a complacent zero); and a positive control against the real history in which the
  defect shipped (`base = c46bfa34^`) flags precisely the two restored `metadata` elements.
* **What the fence should do instead of re-keying** (raised for the fence's owner; not done here,
  this lane has no claim on that file): emit the site's **literal text as evidence beside the
  positional key**, so a key that survives while its site changed stays visible; add a **gated
  `LEDGER-STALE` class** for a row whose cited range no longer contains the live site line; and
  validate that range at lookup time. Measured in this re-derivation: **all 24 rows cite a range,
  and in the merged tree all 24 ranges still contain their key line and agree on path** — a
  property worth keeping by machine rather than by good intentions.
* **Merge-time duty for any lane promoting a helper with a ledger row below its site:** read the
  fence's `adjudicated` and `unknown` class counts, not just the verdict. This lane's merge of
  `14ea8717` did exactly that (§13).

## 8. `p8s3b-result-effects.test.ts` — red at base, migrated by inspection

At base this file cannot collect: `Error: agent-bindings: sessionPersistence.exists public seam is
unavailable`, thrown by the guard at
`packages/runtime/src/plugin/live/agent-bindings.mjs:887-890` (the `if` at `:887`, the
`throw new Error(` at `:888`, the message string at `:889` — measured with `grep -n`; an earlier
draft of this section cited `:888` alone, which is the statement, not the string a reader greps
for), reached from the test's world setup. It is in the baseline red set, reported by B1 and
unchanged here: `transcripts/p8s3b-base-merged.txt` and `transcripts/p8s3b-head-merged.txt` are
the same failure at base and head on the merged tree (`Test Files 1 failed`, `Tests no tests`),
and this lane's migration did not fix, hide or depend on it.

Because the file cannot run, the probe cannot discriminate (§9), so the disposition is by
inspection plus a direct parse witness: the glue parses this document
(`config.blueprintSource` → `parseBlueprint`), so it rides the supported version with the required
pair. `tools/p8s3b-parse-witness.probe.test.ts` extracts the **real** document array literal out of
both the committed file and the working copy, evaluates it and parses both: the base document parses
as the version it declared (so the migration is provably not `invert-to-refusal`), the migrated
document parses at the supported version, and the two frozen results differ in **exactly three
keys** — `schemaVersion` `1` → `3`, and the two envelopes `undefined` → `{ rules: [] }` (the
independent review reproduced that key-level diff). The probe ran green once and was **deleted
before the gates** (a scratch file under `packages/*/test/` would otherwise add a counted path to
p4t6 and a scan site); its source is preserved in `tools/`.

**What that witness does NOT prove, and where the duty now lives.** It is a statement about the
document as PARSED. It says nothing about what the glue does with a supported-version document once
the `sessionPersistence.exists` seam lands — and this file's whole subject is result effects flowing
through that glue. The re-run duty is therefore recorded **in the fixture itself, beside the
document** (`packages/runtime/test/p8s3b-result-effects.test.ts`, comment above `blueprintSource`):
whoever unblocks the seam re-runs this file and re-verifies this document end to end. A duty that
only exists in an evidence document is a duty nobody reads at the moment it matters.

## 9. Method notes worth carrying forward

* **Bulk runs need a clean scratch.** `scratchDir()` is
  `packages/testkit/test/.tmp-fault/<basename>` (`packages/testkit/fault-injection/file-seam.mjs`),
  shared across suites. Without `rm -rf packages/testkit/test/.tmp-fault` before each run, a
  bulk consumer run reports mass failure with `team_domain already exists (schema_meta holds N
  stamp row(s))` — an artifact, not a regression.
  **Correction, since this section used to overclaim:** the sentence here read "every
  base/probe/head run in this evidence set starts with that removal". It was false. The script
  that produced `transcripts/consumers-base/` omitted the removal, and those committed transcripts
  are artifact runs — `p6t1 79 failed | 197 passed`, `p6t2 117 failed | 38 passed`,
  `p6t4 65 failed | 40 passed`, carrying 116, 79 and 92 `team_domain already exists` lines. They
  were reviewed, quoted into §5's base column, and passed as measurements. What is true after the
  re-derivation: every run behind a number **in this document now** —
  `transcripts/consumers-{base,head}-merged/`, `transcripts/per-file-{base,head}-merged/`,
  `transcripts/probe/`, `transcripts/trial-v1|v2/`, the wrapper and p4t6 runs — was executed by
  `tools/consumers.sh` / `tools/final_gates_merged.sh` / `tools/head_runs.sh`, each of which removes
  the directory before every run and again at the end. The superseded
  `tools/base_consumers.sh` is kept, un-fixed, with a comment pointing at this section, so the
  mistake stays legible.
* **A measurement script must not be the place where uncommitted work gets restored.** One
  re-derivation script ended with `git show HEAD:<path> > <path>` across all 34 roster files, which
  silently reverted an uncommitted edit to `p8s3b-result-effects.test.ts`. The text came back
  byte-identically from a captured copy (sha256 `797c2f0b73a7…`), but the failure mode is exactly
  the one this file warns about in the previous bullet's family: a restore that looks mechanical
  and is actually destructive. Rule now applied: commit before swapping, or capture and verify;
  `tools/measured-files-sha256.txt` is checked with `sha256sum -c` at the end of every dance.
* **A line diff is not a witness over fixture documents — and this generalizes past this lane.**
  Measured against the shipped validator: dropping `metadata: {}`, `requirements: []`,
  `members: []`, `memberEnvelopes: []` or `policyStates: []` from a v3 document is **silently
  invisible** — identical parse, identical `contentHash` — and dropping all five together is still
  identical, because each is produced by a default (`?? []` / `?? {}`) at
  `packages/domain/blueprint/src/validate.ts:1240/1258/1291/1350`. Loud, by contrast:
  `teamRequirements`, both envelopes, a nested `rules` list, `revision`, `leader`, and a
  *populated* template-level `requirements:` block. So **only the empty defaults vanish**, which is
  precisely the shape a mechanical insert is most likely to overwrite.
  **Standing duty for any migration touching document literals — Phase 2 and §7.3 included: take a
  parse-level or per-document element-set census, never a line diff.** The screen this lane now
  carries is `tools/element-set-census.py` (rules R1–R6, `--self-test`, and a positive control
  against the commit where the defect shipped). The coordinator's warning is the reason it is
  element-level: the line-neutral inline multi-element `push` line is exactly where a line-level
  screen is blind by construction — a2c7's lost `metadata` sat two lines under one such push.
* **Typecheck only counts with a real install.** A `cp -al`-style partial install produces ~1155
  phantom `TS7026`/`TS2307` errors and tells you nothing; `tools/final_gates_merged.sh` §0 records
  the install shape alongside the exit code.
* **A probe that cannot run is not a green probe.** For a file that fails at collection, the
  digit mutation cannot distinguish live from dead; such a file is disposed by inspection
  with an explicit witness (§8), never by "the probe was green".
* **Never restore a mutant with `git checkout --`.** Base content was re-materialized with
  `git show HEAD:<path> > <path>`, and every head file used for a base run was restored from a
  copy and re-verified by sha256 (`head-sha256-after-base-excursion.txt` — 35 files, all OK after the
  base-eslint/base-flake excursions).
* **The lint gate earned its keep.** The first pass of the inline-array transform produced
  `[ 'x', , '---' ]` twice in `a2c7-subtree-matcher.test.ts` — a sparse array, i.e. a stray
  blank line inside the emitted YAML, which vitest happily ignored because YAML forgives it.
  `npx eslint` caught it (`no-sparse-arrays`, 2 errors); fixed, and the file's 31 tests and
  the fence output are unchanged by the fix. Identity check after the fix: the 35 touched
  files carry **7 eslint identities at base and the same 7 at head — `NEW: none, GONE: none`**
  (`transcripts/eslint-base.txt`, `transcripts/eslint-head.txt`). Repo-wide,
  `node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt`
  reports **new 0, resolved 0** against the 160-line / 76-distinct baseline; the lane's only
  scratch artifacts were removed from the tree before that run, because
  `lint-identities.mjs` scans the target directory rather than `git ls-files` and had
  temporarily counted a scratch copy as a new identity.
* **FINDINGS prose hygiene.** No literal that carries a retired-style version claim is quoted in
  this file's *argument* — not in the dispositions, not in the DEFERRALS justifications, not in the
  fixture comments: the failure mode that once made the wrapper itself dirty. Where a fixture's own
  prose had to talk about the surface, it names the surface (`the v2 requirement-scope surface`),
  not the carrier. **The one exception, stated rather than hidden:** §7 quotes the live literals of
  `packages/contracts/test/negative.test.ts` — including one carrying a retired digit — because the
  argument there is exactly about which literal collides with which. That is evidence about sites in
  a directory neither the fence nor the scan ratchet reads (`dev/agent-workflow/**` is outside both
  scopes — the same reason evidence copies of fixtures are `.txt`, not `.ts`); it is not a claim
  that any document should carry that version. If this file ever moves into a scanned path, the
  quote goes and the argument keeps only the line numbers.

## 10. Gates, as re-derived on the merged tree

Every row here was produced by `tools/final_gates_merged.sh` on the merged tree (this branch +
`origin/master 14ea8717`), and the whole run is one transcript:
`transcripts/FINAL-GATES-MERGED.txt`. The pre-merge run is still in
`transcripts/FINAL-GATES.txt` for comparison.

| gate | command | result on the merged tree |
| --- | --- | --- |
| 29 migrated specs, run individually, **both content states** | `npx vitest run <file>` × 29, all 34 roster files at base content, then all at head content, clean scratch before each | **file-for-file identical counts** (`transcripts/per-file-base-merged/`, `transcripts/per-file-head-merged/`); the one red on both sides is `p8s3b-result-effects` (§8); `p6t1-parallel` 9/9 both (§6) |
| helper consumer sets | `tools/consumers.sh`, 5 sets over the 135 distinct consumers incl. the 8 in `packages/tools/test/` | counts and **red NAMES identical** base↔head (§5) |
| fence wrapper | `npx vitest run packages/testkit/test/a4p7-blueprint-version-clean.test.ts` | **58 passed (58)**; `git diff --numstat 14ea8717 --` = **0 insertions / 34 deletions** — this lane's own DEFERRALS rows and nothing else, no row reflowed, reordered or renumbered |
| scan-count ratchet | `npx vitest run packages/testkit/test/p4t6-session-event-scan.test.ts` | **10 passed (10)**, and the file is **blob-identical to master's** (this lane never edits the ratchet). Total the test derives: `983 + Σ SCANNED_PATHS_*.length = 983 + 48 = 1031`; at the lane base it was `983 + 47 = 1030`, and the +1 is master's `SCANNED_PATHS_A4P76GATE` — **not** this lane. No `SCANNED_PATHS_A474B2A` block exists, correctly: this lane adds no scannable file (an edit is not an increment). *(The pre-merge draft of this row quoted 1021; that number was written from memory and was wrong — the measured base figure is 1030.)* |
| fence ×2 | `node scripts/verify-blueprint-version-clean.mjs` | **byte-identical** pair, exit 1, class lines in §1 |
| typecheck | `pnpm -r run typecheck` | **exit 0**, with **0** occurrences of `TS7026`/`TS2307` — the phantom-code signature of a partial `cp -al` install; the install shape is recorded in the same transcript. This is also the witness check: the seven `DECLARED_DOCUMENT_VERSION` constants and their `TeamBlueprint` type imports compile today and will stop compiling at §7.3's narrowing — by design |
| eslint, the 34 roster files | `npx eslint -f json …` at head and at base content | **exit 1 both sides — reported as an identity multiset, never as "clean"**: **10 problems (7 errors / 3 warnings) across 7 identities, identical base↔head** (`a2c7` ×2 unused-vars, `alpha2` ×1, `control-abandon` ×1, `d2-s6` ×2 unused-disable, `f1-webserver` ×1, `multi-mcp-wiring` ×2, `p8s3b` ×1). These are pre-existing; none was mine to fix, and the gate that binds is the identity set |
| lint identities | `node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt` | **new 0, resolved 0** against the 160-line / 76-distinct baseline |
| element-set census | `tools/element-set-census.py a4ef2a6b <the 34>` | **0 anomalies** over 2 109 document elements / 81 changed element regions, 2 disclosed delete-lie exceptions (§3); `--self-test` 4 PASS / 0 FAIL; positive control against `c46bfa34^` flags exactly the two `metadata` elements that had shipped missing (§11) |

## 11. A defect this lane shipped, found by its own instrument after the review challenge

**What.** Two fixture documents in `a2c7-subtree-matcher.test.ts` (base L1473, L1494) were
committed WITHOUT their `'metadata: {}'` element: the envelope pair had been written over the
adjacent element instead of beside it. That is not a cosmetic slip — those two arrays are fed
straight into `runParse` and the test that consumes them is named *"the A2C-1 shell rejections
are BYTE-IDENTICAL"*. A fixture feeding a byte-identity pin had itself stopped being base's
fixture.

**Why nothing noticed.** `metadata` is an optional closed-set field: `validate.ts:1458-1459`
takes it with `takeRecord(...)`, and when it is absent the frozen blueprint still carries
`metadata: {}` (`validate.ts:1518`). So the parse result, the `MALFORMED_DTO` code and both
pinned diagnostic fragments were identical either way. The file ran **31/31 before and after**.
An instrument with 1 195 tests behind it — the `p6t1-helpers` consumer set on the merged
tree, §5 — could not have seen this
any more than the a2c7 run did, and neither could the fence, typecheck, or the wrapper.

**What caught it.** Two boring instruments, in this order:
1. `no-sparse-arrays` had already caught the *first* symptom of the same hand-patch
   (§9); the fix I applied then is what removed the element.
2. After the coordinator asked whether one silent change could hide inside an unchanged total,
   I wrote an **executable-line census** over the whole lane diff
   (`transcripts/executable-line-census.txt`): drop comment-only and blank lines, pair the rest
   with `difflib`, and require every changed line to be a version carrier, an envelope element,
   or the base/head pair of a line that merely gained envelope elements. It reported exactly
   **2 unexplained lines, both in a2c7, both losing `'metadata: {}'`.**

**Cause pinned, not guessed.** Replaying this lane's own transform on the base file
(`git show a4ef2a6b:… | migrate.py <copy> 1`, kept at `tools/repro/`) and diffing it against the
committed file produced **exactly those two lines** — the transform was correct all along; a
later hand-patch of the sparse-array artifact ate the neighbouring element. That is the argument
for keeping a mechanical transform when a lane touches 45 sites, and the argument against
hand-editing its output.

**Fix and verification.** Both elements restored, in the house order (pair before `metadata`, so
nothing lands after the `'---'` fence). The working file is now byte-identical to the script's
migration of base modulo comments; `a2c7` 31/31; eslint shows only the two pre-existing
unused-type errors; fence class lines unchanged (`dirty 76/168`, `unknown 0/0`,
`refused 52/115`, `adjudicated 16/24`); wrapper 58/58; p4t6 10/10;
`lint-identities --diff` new 0 / resolved 0; census now reports **unexplained 0**.
Those class figures were measured at the pre-merge head `c46bfa34`; every one of them was re-measured
on the merged tree afterwards (§1's third column, §10), and the a2c7 file also has its own
element-level positive control now: running the census with base `c46bfa34^` — the tree that shipped
the drop — flags precisely the two `metadata` elements (§7, §10).

**The statistic the question deserved.** For the whole lane, after this fix: 240 changed
non-comment lines across 34 files, **0 unexplained**; **exactly one assertion line in the entire
diff** (`expect(world.blueprint.schemaVersion).toBe(2)` → `.toBe(DECLARED_DOCUMENT_VERSION)`,
disclosed in its commit body); and in the five fixture modules — the ones carrying 768/768 and
7 failed / 454 passed consumer runs on the merged tree (§5) — every changed non-comment line is a document-literal element
(5/5/5/5/4 lines) and **"anything else: none"**. There is no executable change in those helpers
for a total to hide.

## 12. Disclosure

* Files changed: the 34 roster files + `packages/testkit/test/a4p7-blueprint-version-clean.test.ts`
  (34 own DEFERRALS rows deleted) + this evidence directory. Nothing else: no production
  source, no `schema.ts` / `types.ts`, no `packages/domain/blueprint/**`, no kit or script
  another lane owns, no `docs/**`, no graph/log/cordis files, no `pnpm-lock.yaml`. No
  `SCANNED_PATHS_*` block from another lane was edited.
* The branch also **merges `origin/master 14ea8717`** (§13). That merge is the parent's own
  master arriving, not this lane editing foreign files: none of the 34 roster files moved in it,
  and its single conflict (the wrapper) was resolved as master's file minus this lane's 34 rows.
* Evidence this commit **deleted**: the 34 transcripts in `transcripts/head/` that came from a
  first-pass loop with a broken path filter — every one of them said `No test files found` and
  recorded nothing. They had already been caught by a reviewer once (see the `.ts`-copy episode in
  the same family) and were still in the tree, so they are removed rather than left to mislead.
  `transcripts/head/` keeps its 29 real pre-merge runs; both it and `transcripts/consumers-base/`,
  `transcripts/consumers-head/` are **superseded** by the `-merged` directories named in §5/§10 and
  are retained only as the history of how this lane measured.
* No push. No boot of any harness; no port in the 31xx family was opened (nothing here
  spawns the宿主; all §7.4 evidence is in-process vitest + node scripts). No root
  `pnpm test` was run — §7.4's rule, and a full-suite run cannot distinguish this lane's
  reds from the concurrent lanes' worktrees anyway.
* `packages/runtime/test/a3p4-pr4-production-entry-regression.test.ts` was **not** touched;
  it is not in this roster (§7.4 assigned it elsewhere) and its DEFERRALS row is still there.
* Two known-red things stay red and are named above rather than smoothed over:
  `p8s3b-result-effects` (§8) and the `p6t1-parallel` flake (§6).
* **The census was wrong twice more after it first reported clean, and both wrong ways are now
  guarded.** Its version-element pattern required an interpolation name with no digits, so it read
  another lane's `` `schemaVersion: ${V2_DOCUMENT_VERSION}` `` as a *vanished document* — a false
  accusation against a correct migration, which is worse than a miss; and it raised on a path that
  did not exist at the base instead of reporting an un-censusable new file. Both are fixed, and its
  `--self-test` grew **must-stay-clean** mutants for both families (now 6 cases: 4 mutants that must
  be caught, 2 legal shapes that must stay clean), so the false-positive mode is tested as hard as
  the hiding mode. The roster result is unchanged by the fix: 34 files / 2 109 elements / 0 anomalies.
  Run over all 81 test files that moved between `a4ef2a6b` and this branch it reports 4 926 elements,
  152 changed element regions and **9 flags in 5 files, none of them this lane's**
  (`transcripts/element-set-census-all-changed.txt`, header says how to read it): those are a
  handover screen for the lanes that own them — each flag is one of three shapes this screen does not
  yet classify (a row version that is deliberately not a document version, a document interpolated
  from parameters, or a document the file deleted on purpose), and only the owning lane can say which.
  This lane does not adjudicate foreign fixtures; it hands over the instrument.

* Instruments this lane wrote and got wrong before getting right, because the reader deserves the
  base rate: two revisions of the element census reported a complacent zero from broken
  line/token heuristics (the third revision carries a `--self-test` for exactly that reason, §7);
  the first eslint identity parser matched no rule names at all and printed `IDENTICAL=True` over
  two empty sets (now `-f json`, §10); the first `SCANNED_PATHS_*` sum read `name = N` instead of
  list lengths and produced an empty sum (now it mirrors the test's own expression); one `say`
  header contained backticks and silently executed `cp -al`; the `.tmp-fault` clean was missing
  from one committed script and its artifacts passed as measurements for a review cycle (§5, §9);
  and a quoted count (`'schemaVersion: 2'` repeating four times in one helper) had to be replaced
  by the measured distribution. Every one of these was an instrument failure, not a fixture
  failure — which is the point of writing them down.
* Anything not verifiable in this worktree is written here rather than claimed: the ledger
  remediation (§7) is a fence-owner decision this lane deliberately left to its owner.

## 13. The merge, and the seven files that stay dirty

**The merge.** `origin/master 14ea8717` (the b2b round) merged into `feat/a4-74-b2a-fixtures` at
`4639c1a5`, with a follow-up comment-only commit for the §8 duty. Master moves 47 files under
`packages/runtime/test/` forward, but **not one of this lane's 34**: each is byte-identical between
`c46bfa34` and the merge (checked file by file with `git diff --quiet c46bfa34 HEAD -- <path>`). The
single conflict was the wrapper, resolved as **master's wrapper minus this lane's 34 rows** —
`git diff --numstat 14ea8717 -- <wrapper>` = `0 34`.

**What the merge was a test of, and what it showed.**

* `unknown(0 files, 0 sites)` and `adjudicated(16 files, 24 sites)` held across the merge — the
  line-keyed ledger row in `p6t4-helpers.ts` survived because that promotion is line-neutral (§7),
  and master moved nothing in that file.
* `refused(52/115)`, `prose(5/5)`, `adjudicated(16/24)` are unchanged from this lane's pre-merge
  head; `advisory` moved 9/14 → 8/10 and `dirty` 76/168 → 7/51 — master's own cleaning plus this
  lane's 34 files leaving (§1).
* The wrapper's two legs are the mechanical proof of the by-path claim: it asserts every dirty path
  has a DEFERRALS row *and* every row still names a dirty path, so 58/58 with 7 rows left and
  `dirty(7 files, 51 sites)` means the dirty set **is** those 7 — and §10's ratchet row shows the
  merge added one counted path that is not this lane's.

**The seven, named, with the reason each one stays** (measured: `transcripts/fence-merged-1.txt`;
master's 41 DEFERRALS paths minus this roster = these 7, none of them a roster path):

| path | why it stays dirty |
| --- | --- |
| `tests/kits/pr-e-requirement-recovery-smoke/pr-e-requirement-recovery-smoke.mjs` | C-testkit, **dirty ON PURPOSE**: the `V1_ANCHOR_SOURCE` literal *is* historical pre-PR-E bytes and its hash is derived from them; the row's disposition is a post-§7.3-flip refusal proof (`parseBlueprint(V1_ANCHOR_SOURCE).contentHash` must equal the pinned golden today and REFUSE after the flip). Cleaning it would delete the proof. |
| `tests/kits/pr-f-closure-smoke/pr-f-closure-smoke.mjs` | same shape and same ruling (C-testkit, migrated group 4): an anchor literal whose value is its own historical bytes. |
| `packages/domain/blueprint/testdata/fixtures.ts` | C-domain **STOP, ratified by the coordinator**: stays dirty pending the B-lane witness-ownership rewrite of the three `revisionSource(...)` derivations that splice the factory's declared-version line into v1/v2/v99 witnesses, plus the coupled `fixtures.ts` → v3 work. `packages/domain/blueprint/**` is off-limits to every fixture lane, this one included. |
| `packages/legacy/test/p7t6-teammates-adapter.test.ts` | **No §7.4 lane row** (the package is not in the lane table); C-testkit stopped it, file byte-identical. This is the legacy `.md` teammate-file format's **own version axis**, not a `TeamBlueprint` document — the cited site is a negative test of which legacy versions the adapter rejects. Migrating would delete the adapter's acceptance proof. |
| `packages/runtime/test/a3p4-pr4-production-entry-regression.test.ts` | Not this roster: §7.4 assigned the third carrier class here to another lane ("migrate-by-hand or invert per the 2026-10-08 dispositions"). Disclosed in §12 rather than quietly swept up. |
| `packages/runtime/test/t12a-live-bridge.mjs` | **Dirty by design**, coordinator ruling 2026-10-08: this path is the wrapper's own `packages/*/test` **by-path positive control** — the leg proving a test-tree string-carried emitter reaches the dirty set by path. Cleaning it is a coupled wrapper edit, so it stays and keeps its row. |
| `cordis.patch.yml` | **No §7.4 lane row**; scope addition measured 2026-10-08 — the root composition patch's `blueprintSource` block is a live v1 document emitter (`cordis.patch.yml:58-62`). Raised to the coordinator; a fixture lane has no business editing the composition manifest. |

Four of the seven are files this lane is forbidden to touch, two are positive controls / anchor
proofs that must stay, and one belongs to another lane's row. That is §7.4's end state for this
roster: **34 files out of the dirty set, 0 added, and nothing cleaned by making a test prove less.**
