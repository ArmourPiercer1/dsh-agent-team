# A4-PR7 §7.4 — lane B-runtime-semantics-A — findings

Lane: **B-runtime-semantics-A** (§7.4 fixture migration, `packages/runtime/test/`).
Base: `origin/master` = `a4ef2a6b`. Lane head: this branch `feat/a4-74-b2a-fixtures`,
commits listed by `git log --oneline a4ef2a6b..HEAD` (four code commits + this evidence commit). One writer, one worktree
(`.worktrees/a4-74-b2a`), nothing pushed.

Roster: **34 files** (29 specs + 5 non-`P6T*-helpers` fixture modules), **45 dirty sites**
at base — every one of them is now off the fence's dirty list, and the fence gained
**zero** new sites anywhere in the tree.

---

## 1. What the fence says (the whole-lane number)

| class | base (`transcripts/fence-base.txt`) | head (`transcripts/fence-head.txt`) |
| --- | --- | --- |
| dirty (gates) | **110 files / 213 sites** | **76 files / 168 sites** |
| unknown (gates) | 0 / 0 | 0 / 0 |
| advisory | 9 / 14 | 9 / 14 |
| refused | 52 / 115 | 52 / 115 |
| prose | 5 / 5 | 5 / 5 |
| adjudicated | 16 / 24 | 16 / 24 |

`213 − 168 = 45` = exactly this lane's base dirty-site count, and the by-path diff is
exactly the roster:

* OFFENDING paths: base 110 → head 76, **gone 34 (= this roster, path for path), added 0**,
  no other path's site list changed.
* advisory / refused / prose / adjudicated: **path sets identical**, and their site counts
  are unchanged (52/115, 9/14, 5/5, 16/24 on both sides). REFUSED *line numbers* moved in
  **9 files, all of them mine** — a comment inserted above a refused literal shifts its
  line. `transcripts/fence-refused-line-moves.txt` compares each moved site's verdict text
  with its line number masked out: **verdict text byte-identical in every one**, nothing
  added, removed or reclassified, and no file outside this roster appears.
  `transcripts/fence-by-path-diff.txt` is the machine-generated path diff for all six classes.
* Two consecutive runs of `node scripts/verify-blueprint-version-clean.mjs` are
  **byte-identical** (`cmp` clean, 173 lines, exit 1 — dirty is still non-empty because
  other lanes' paths remain, which is correct at this point of the §7.4 fan-out).

`transcripts/fence-head.txt` is one of those two runs; the second was byte-compared to it
and discarded (the harness records the `cmp` result, not a second copy).

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

| file | base | trial promotion | how it died |
| --- | --- | --- | --- |
| `consent-scope-hash-binding` | 19 passed | file down at module scope | the creation-preflight refusal the file asserts stopped being a refusal |
| `fix-control-authz-c-abandon-terminal` | 74 passed | **1 failed / 73 passed** | exactly `c9-r3-1` — the v2 template-facts feed row |
| `leader-disable-no-requirements-initial-work` | 5 passed | 1 failed | the premise test: the leader scope had no verdict inputs left |
| `leader-recovery-next-boundary-exit` | 1 passed | 1 failed | scope refs empty |
| `leader-template-required-boundary` | 7 passed | 3 failed | the three rows observing the leader template scope |
| `mcp-target-materialization` | 16 passed | file down at module scope | the target-specific block vanished — the Finding F false OPEN returned |
| `mcp-target-materialization-unit` | 5 passed | 5 failed | `expected 0 to be greater than or equal to 1` — no template scopes |

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

The five promoted fixture modules are consumed by 193 test files. Each helper's liveness was
probed on a **clean scratch** (`packages/testkit/test/.tmp-fault` removed first — see §9) and
each helper's full consumer set was run at base and at head with the same cleanliness rule
(`transcripts/consumers-base/`, `transcripts/consumers-head/`):

| helper | probe (digit unsupported, clean scratch) | base consumer run | head consumer run | red NAMES |
| --- | --- | --- | --- | --- |
| `bound-blueprint-persona-helpers` | 3 failed / 9 passed → live | 12 passed (12) | 12 passed (12) | identical (none) |
| `p6t3-helpers` | live | 7 failed / 20 passed (27) | 7 failed / 20 passed (27) | identical |
| `p6t2-helpers` | live | 6 failed / 388 passed (394) | 6 failed / 388 passed (394) | identical |
| `p6t4-helpers` | live | 738 passed (738) | 738 passed (738) | identical (none) |
| `p6t1-helpers` | live | 8 failed / 1107 passed (1115) | 8 failed / 1107 passed (1115) | identical |

**No file outside this roster went red.** Every red at head is the same-named baseline red at
base (they are other lanes' known-red files: `d3-member-identity-context`,
`p6t3-mediation`, `p6t3-restart`, `p8s3b-result-effects` and the P6-T1 red rows).

## 6. `p6t1-parallel.test.ts` — declared flake, both numbers, nothing "fixed"

The plan names this file a load-sensitive flake. Sampled on this machine, one file per
vitest invocation, clean scratch each time:

* head (migrated): 6 consecutive runs → **9 passed (9)** all six; three earlier runs taken
  while other vitest processes were running in parallel → `3 failed | 6 passed`, `2 failed |
  7 passed`, `2 failed | 7 passed`.
* base (`git show HEAD:` copy of the same file, run the same way): 6 consecutive runs → five
  green, **one flaked (`1 failed | 8 passed`)**; earlier parallel-load runs also flaked
  (`3 failed | 6 passed`).

Same signature (activation-count assertions reading one behind) at base and head, same
correlation with machine load. Not touched beyond the migration; not "fixed".

## 7. A hazard this lane found, worth the coordinator's attention

**The §7.4 unknown-adjudication ledger keys by path AND line, so promoting a document ABOVE
an adjudicated unknown silently unadjudicates it.** First bite, caught before commit:
promoting `p6t4-helpers.ts` added four source lines, which pushed that file's adjudicated
ledger-row literal from L458 to L462; the ledger key
`packages/runtime/test/p6t4-helpers.ts::L458::v2` stopped matching, and the fence printed
`UNKNOWN … (1 file, 1 site)` — an unadjudicated unknown, which **gates**. The class counts
moved `adjudicated 16 → 15`, `unknown 0 → 1`.

This lane did **not** edit the ledger (it is another lane's reviewed artifact, and several
lanes are shifting the same lines concurrently). It made the promotion **line-neutral**
instead: `p6t4-helpers.ts` declares its envelope pair on one source line, with the reason
recorded in the file's own comment. That keeps the reviewed verdict attached and the fence
byte-stable, but it is a workaround, not a fix. **Recommendation for the merge lane:**
either re-key the ledger by the site's own literal rather than its line, or re-adjudicate in
the same commit that promotes a file containing a ledger row below the promotion site —
otherwise every lane that promotes a large helper risks the same silent UNKNOWN, and the
wrapper will blame the ratchet.

## 8. `p8s3b-result-effects.test.ts` — red at base, migrated by inspection

At base this file cannot collect: `Error: agent-bindings: sessionPersistence.exists public
seam is unavailable` (`packages/runtime/src/plugin/live/agent-bindings.mjs:888`, reached from
the test's world setup). It is in the baseline red set, reported by B1 and unchanged here —
`transcripts/base/p8s3b-result-effects.txt` and `transcripts/head/p8s3b-result-effects.txt`
are the same failure at base and head (`Test Files 1 failed`, `Tests no tests`), and this
lane's migration did not fix, hide or depend on it.

Because the file cannot run, the probe cannot discriminate (§9), so the disposition is by
inspection plus a direct parse witness: the glue parses this document
(`config.blueprintSource` → `parseBlueprint`), so it rides the supported version with the
required pair. `tools/p8s3b-parse-witness.probe.test.ts` extracts the **real** document array
literal out of both the committed file and the working copy, evaluates it and parses both:
the base document parses as the version it declared (so the migration is provably not
`invert-to-refusal`), the migrated document parses at the supported version, and the two
parses are identical key-by-key apart from the version pair and the content hash that is a
function of it. That probe ran green once; it was **deleted before the gates** (a scratch
file under `packages/*/test/` would otherwise add a counted path to p4t6 and a scan site),
and its source is preserved in `tools/`.

## 9. Method notes worth carrying forward

* **Bulk runs need a clean scratch.** `scratchDir()` is
  `packages/testkit/test/.tmp-fault/<basename>` (`packages/testkit/fault-injection/file-seam.mjs`),
  shared across suites. Without `rm -rf packages/testkit/test/.tmp-fault` before each run, a
  bulk consumer run reported 78 failed files with `team_domain already exists (schema_meta
  holds 10 stamp row(s))` — an artifact, not a regression. Every base/probe/head run in this
  evidence set starts with that removal.
* **A probe that cannot run is not a green probe.** For a file that fails at collection, the
  digit mutation cannot distinguish live from dead; such a file is disposed by inspection
  with an explicit witness (§8), never by "the probe was green".
* **Never restore a mutant with `git checkout --`.** Base content was re-materialized with
  `git show HEAD:<path> > <path>`, and every head file used for a base run was restored from a
  copy and re-verified by sha256 (`head-sha256.txt` — 35 files, all OK after the
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
* **FINDINGS prose hygiene.** No literal that carries a retired-style version claim is quoted
  anywhere in this file, in the DEFERRALS justifications, or in the fixture comments — the
  failure mode that once made the wrapper itself dirty. Where a fixture's own prose had to
  talk about the surface, it names the surface (`the v2 requirement-scope surface`), not the
  carrier.

## 10. Gates, as run at the final state of this branch

| gate | command | result |
| --- | --- | --- |
| migrated specs, individually | `npx vitest run <file>` × 29 spec files, clean scratch each | all match base counts exactly (§3 table; transcripts in `transcripts/head/`) |
| helper consumer sets | 5 runs over 193 consumer files | red NAMES identical to base; 738/738, 12/12, and the three baseline-red sets unchanged |
| fence wrapper | `npx vitest run packages/testkit/test/a4p7-blueprint-version-clean.test.ts` | **58 passed (58)** after this lane's 34 DEFERRALS rows were deleted (rows deleted only for paths the fence no longer names; no row reflowed, reordered or renumbered — `git diff` is 0 insertions / 34 deletions) |
| scan-count ratchet | `npx vitest run packages/testkit/test/p4t6-session-event-scan.test.ts` | **10 passed (10)**; total unchanged (`983 + Σ SCANNED_PATHS_*` = 1021) because the lane creates and deletes no counted path, so no `SCANNED_PATHS_A474B2A` block was needed |
| fence ×2 | `node scripts/verify-blueprint-version-clean.mjs` | byte-identical pair; class line in §1 |
| typecheck | `pnpm -r run typecheck` | **exit 0** (this is also the witness check: the seven `DECLARED_DOCUMENT_VERSION` constants and the `TeamBlueprint` type imports compile today and will not survive §7.3's narrowing — by design) |
| eslint, touched files | `npx eslint <35 files>` | exit 1 at base and exit 1 at head, **identical 7 identities** — the operative gate is that identity set and `lint-identities.mjs --diff`, both clean; the pre-existing errors in these files (unused vars, a stale `eslint-disable`) were not mine to fix |
| lint identities | `node scripts/lint-identities.mjs --diff …0237d487.txt` | **new 0, resolved 0** |

## 11. Disclosure

* Files changed: the 34 roster files + `packages/testkit/test/a4p7-blueprint-version-clean.test.ts`
  (34 own DEFERRALS rows deleted) + this evidence directory. Nothing else: no production
  source, no `schema.ts` / `types.ts`, no `packages/domain/blueprint/**`, no kit or script
  another lane owns, no `docs/**`, no graph/log/cordis files, no `pnpm-lock.yaml`. No
  `SCANNED_PATHS_*` block from another lane was edited.
* No push. No boot of any harness; no port in the 31xx family was opened (nothing here
  spawns the宿主; all §7.4 evidence is in-process vitest + node scripts). No root
  `pnpm test` was run — §7.4's rule, and a full-suite run cannot distinguish this lane's
  reds from the concurrent lanes' worktrees anyway.
* `packages/runtime/test/a3p4-pr4-production-entry-regression.test.ts` was **not** touched;
  it is not in this roster (§7.4 assigned it elsewhere) and its DEFERRALS row is still there.
* Two known-red things stay red and are named above rather than smoothed over:
  `p8s3b-result-effects` (§8) and the `p6t1-parallel` flake (§6).
* Anything not verifiable in this worktree is written here rather than claimed: the ledger
  line-key hazard (§7) is a merge-time decision this lane deliberately left to its owner.
