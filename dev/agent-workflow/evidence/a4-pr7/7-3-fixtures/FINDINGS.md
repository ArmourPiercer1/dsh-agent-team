# 7-3-fixtures — fixtures.ts v1 → v3 migration (§7.4, the §7.3 phase-2 prerequisite)

Commit `79152fb5` on `feat/a4-73-fixtures-v3`, branched from `origin/master` @ `41ba59f4`.
No push. `schema.ts:75` and `types.ts:416` untouched. `cordis.patch.yml` untouched.
`docs/**`, `dev/agent-workflow/graph.yaml`, `SESSION_ROUTER_LOG.md` untouched. CORE PATCH BUDGET 0.

## Verdict

**MIGRATED. Not BLOCKED.** `packages/domain/blueprint/testdata/fixtures.ts` left the fence's dirty
set: `dirty(7 files, 51 sites)` → `dirty(6 files, 17 sites)`, and all five non-gating classes are
byte-identical to base. Sixteen importers, 370 legs: **369 pass / 1 fail, identical to base** — the
one failure is the pre-existing `t2-blueprint-hash` debt. The wrapper's ratified DEFERRALS row for
this file closes in the same commit, and its two by-path controls are re-homed.

**Answer to the question that decided this job:** *the probe had to change shape.* Nothing was
re-pointed, loosened, or given a weaker expected value. Three consumer mirrors moved with the
factory (their own comments pre-registered exactly that), and one consumer's proof had died
silently and was repaired to assert **more** than before. §5 argues each site.

The brief's "32 v1 fixtures and 1 v2 fixture" is not what is in the file. The fence measured **34**
dirty sites in it, all `v1`-valued except one `v4`; the "v2" is a **comment** (a prose site, L395
now / L303 at base) recording the fixture's own history, never a fixture. Numbers below are
measured, not inherited.

## Disposition, per fixture

Re-derived after option A, not bulk-applied. Three shared factories carry 22 of the 47 negative
fixtures, so the unit of disposition is the document, not the export name.

| Site | Fixture / factory | Disposition | Reason | Claim after the move |
| --- | --- | --- | --- | --- |
| L26 | `minimalBlueprintLines` → `MINIMAL_BLUEPRINT_SOURCE`, `CRLF_BOM_SOURCE`, `revisionSource()`, `revisionSeriesSources()` | **PROMOTE-P** | The digit was decoration: every consumer is a positive control for identity, revision ordering, hashing or BOM/CRLF normalisation. | "the smallest closed document this build declares"; the zero position is now asserted as data in `t2-blueprint-parse`. |
| L76 | `FULL_BLOCKS` → `FULL_BLUEPRINT_SOURCE`, `_SHUFFLED`, `_OTHER_PERSONA` | **PROMOTE-P** | "every semantic field populated" — the field set is the claim, the digit never was. Pair added to **both** key orders, or the shuffled document stops being a key-order twin of the ordered one and the hash-order-independence control compares two different documents. | same, plus the two authority documents are now part of the full field set. |
| L958 | `permissionBlueprintSource` → 6 `PERMISSION_SOURCE_*` + 16 `NEG_PERMISSION_*` | **PROMOTE-P** | The claim is the `permissions:` policy shape. | same for all 22 riders. |
| 27 fixtures | `NEG_UNKNOWN_TOP_LEVEL`, `NEG_UNKNOWN_NESTED_FIELD`, `NEG_MISSING_LEADER`, `NEG_EMPTY_PERSONA`, `NEG_TEMPLATE_MISSING_PERSONA`, `NEG_NUMERIC_REVISION`, `NEG_BAD_BLUEPRINT_ID`, `NEG_BAD_REVISION`, `NEG_BAD_TEMPLATE_ID`, `NEG_DUPLICATE_MEMBER_TEMPLATE_ID`, `NEG_MEMBER_TEMPLATE_CLASHES_WITH_LEADER`, `NEG_UNRESOLVED_MEMBER_ENVELOPE`, `NEG_ENVELOPE_ALLOW_DENY_OVERLAP`, `NEG_REQUIREMENT_DUPLICATE`, `NEG_REQUIREMENT_BAD_DOMAIN`, `NEG_POLICY_STATE_BAD_FIELD_REF`, `NEG_POLICY_STATE_BAD_ID`, `NEG_POLICY_STATE_DUPLICATE_FIELD_REF`, `NEG_QUOTA_CONCURRENT_GT_INSTANCES`, `NEG_QUOTA_NOT_POSITIVE`, `NEG_CAPABILITY_POLICY_BAD_DECISION`, `NEG_METADATA_NON_STRING_VALUE`, `NEG_NESTED_MEMBER_ID`, `NEG_NON_LOSSLESS_JSON_VALUE`, `NEG_CONTENT_HASH_IN_SOURCE`, `NEG_NON_EMPTY_BODY`, `NEG_SCHEMA_VERSION_UNSUPPORTED` | **PROMOTE-P** | Pair required, not decorative: these are documents that would be valid apart from one defect. A promoted document missing a REQUIRED v3 field violates two rules, and its refusal changes from the pinned code to the missing-document code — the test stays green only if the code happens to coincide, and proves nothing either way. `NEG_POLICY_STATE_*`, `NEG_QUOTA_*`, `NEG_CAPABILITY_POLICY_*`, `NEG_METADATA_*` fire **after** the v3 requirement at `validate.ts:1334`, so for them the pair is load-bearing, not stylistic. | each still violates exactly one rule, and that rule is still the one its `code` names. |
| L304 | `NEG_SCHEMA_VERSION_UNSUPPORTED` | **PROMOTE-P (digit re-stamp only in kind)** | The claim is the **type** — a quoted string where a positive integer is required. `typeof` is checked before the supported-set check (`validate.ts:1188` vs `1195`), so the digit is decoration; leaving it `"1"` post-flip means two reasons to refuse where the fixture claims one. | "a string, not a positive integer", now with one reason to refuse. |
| L345 | `NEG_SCHEMA_VERSION_MISMATCH` | **CARRY** | The digit **is** the claim. `4` was never a defined document version, so it reads `SCHEMA_VERSION_MISMATCH` under the `[1,2,3]` bridge and after a `[3]` collapse, and never becomes the `MIGRATION_REQUIRED` a *retired* version gets. Promoting it makes the document simply valid and the test vacuous. It moved from the YAML literal to `SCHEMA_VERSION_NEVER_DEFINED` and emits **byte-identical** bytes — this is the one site where the fence's digit is a witness, so only the carrier moved. House precedent: `NEVER_DEFINED_VERSION` in `bp1-blueprint-inspector.test.ts:45`. | "a well-formed integer this build has never defined" — unchanged, value unchanged. |
| L1402/1414/1427 (base) | `NEG_UNCLOSED_FRONTMATTER`, `NEG_MISSING_FRONTMATTER`, `NEG_INVALID_YAML` | **PROMOTE-D** | Digit-only. They die in `splitFrontmatter` / `decodeYaml`; the bytes never become a record, so the v3 field stage is unreachable and an authority document in them is bytes no reader can reach. Removing the defect does not yield a valid document (there is no leader block at all), so the "exactly one rule" argument does not apply. | same refusal, same reason, one less decoration. |
| 16 fixtures | `NEG_PERMISSION_*` | **SHARED** | No version line of their own; the factory carries them. | unchanged. |

### The zero position, and the world that makes it inert

`rules: []` in **both** documents, never a permissive filler. Read from the production code, not
invented:

* `permissionMutationEnvelope: { rules: [] }` — on the **expansion** plane no match is
  `no-authority` (`effectiveAuthorityCeiling`, and its own comment: "`rules: []` therefore means
  this actor may expand nothing"). The Leader can never widen a member's permissions.
* `teamHardEnvelope: { rules: [] }` — same `no-authority` reading for a Leader-driven expansion;
  on the **approval** plane the same absence is the **identity** (`bindingDocs`: a missing rule
  imposes no narrowing), so a Human User approving a concrete operation is unimpeded.
* Inert in exactly one world: a Team that never asks to expand anything — permissions come only
  from the static Blueprint lanes, nothing is mutated, no rising-authority proposal is made.
  Every fixture here lives in that world. **It is not inert in general**, and the file header says
  so and tells a future fixture that exercises expansion to declare real rules instead of
  inheriting the pair. The two planes disagree about absence, so "inert" had to be said per plane:
  a single reading would have been wrong in one direction or the other.

## Census

`dev/agent-workflow/evidence/a4-pr7/7-4-b2a/tools/element-set-census.py`, self-test first, then the
positive control, then my files. All exit codes taken un-piped.

| Run | Exit | Result |
| --- | --- | --- |
| shared tool `--self-test` | 0 | 6 PASS / 0 FAIL |
| shared tool, positive control `5cdb4e50^` `a2c7-subtree-matcher.test.ts` (from `.worktrees/a4-73-pc`) | **1** | 2 × `removal that is not a version element: ['metadata: {}']` — the historical defect still fires |
| shared tool, my `fixtures.ts` | 1 | **4 anomalies** — all four root-caused in §Instruments, item 3 |
| `tools/element-set-census-quotedfix.py --self-test` | 0 | 6 PASS / 0 FAIL |
| same, positive control | **1** | same 2 anomalies — the fix did not blunt it |
| same, `fixtures.ts` | 1 | **2 anomalies**, a matched insert/remove of the *same* 5 elements (re-alignment) |
| same, `t2-blueprint-parse.test.ts` | **0** | clean |
| same, `bp1-blueprint-inspector.test.ts` | **0** | clean, 0 changed regions |
| same, `a1-permission-policy.test.ts` | 1 | 2 anomalies, matched insert/remove of the same 5 elements |
| `tools/multiset-census.py`, all four files | **0** | see below |
| `tools/multiset-census.py`, positive control | **1** | `LOST {'metadata: {}': 2}` flagged |

The multiset run is the decisive one, and it is what the census exists to answer:

```
fixtures.ts                head 701  work 821  version-elements 34/34
  LOST   : {'schemaVersion: 1': 32, 'schemaVersion: "1"': 1, 'schemaVersion: 4': 1}
  GAINED : {'schemaVersion: 3': 32, 'schemaVersion: "3"': 1,
            'schemaVersion: ${SCHEMA_VERSION_NEVER_DEFINED}': 1,
            'permissionMutationEnvelope:': 30, 'teamHardEnvelope:': 30, '  rules: []': 60}
t2-blueprint-parse         LOST: NONE    GAINED: the pair only
bp1-blueprint-inspector    LOST: NONE    GAINED: NONE
a1-permission-policy       LOST: NONE    GAINED: the pair + the new ask-lane branch
```

Nothing outside the 34 version elements disappeared, in any file. The 34 removals map 1:1 onto 34
version-carrying insertions, and the only other insertions are 30 documents × 4 pair elements = 120
(30 + 30 + 60 ✓). No `metadata: {}`, `requirements: []`, `members: []`, `memberEnvelopes: []` or
`policyStates: []` was lost anywhere — the exact family a line diff cannot see and a content hash
cannot feel.

`a1-permission-policy` shows a **gain** of 8 rule lines. That is the new `writeLane === 'ask'`
branch of the helper, i.e. a second full copy of a document body. R2 has no concept of "a document
was deliberately added", so it flags it; LOST is NONE, so it is not the silent-drop defect. Reported
rather than smoothed.

## Diff shape

```
packages/domain/blueprint/testdata/fixtures.ts                | 229 +   37 -
packages/domain/test/a1-permission-policy.test.ts             |  88 +   53 -
packages/domain/test/bp1-blueprint-inspector.test.ts          |  10 +    7 -
packages/domain/test/t2-blueprint-parse.test.ts               |  21 +    9 -
packages/testkit/test/a4p7-blueprint-version-clean.test.ts    |  41 +   11 -
```

Line counts are orientation only — the claim is the element census above, never this table. The
`-` side of `fixtures.ts` is 37 lines: 34 version elements, the old header/factory docstring, and
the old mismatch-fixture comment opening. Nothing else.

## Battery (committed tree, `79152fb5`)

See `battery/` for the literal outputs. Headlines:

1. `node scripts/verify-blueprint-version-clean.mjs` ×2 → **byte-identical** (`cmp` clean, both
   `sha256 41ab8a15e2188d70…`), both exit 1.
   `dirty(6 files, 17 sites)` / `unknown(0,0)` / `advisory(8,10)` / `refused(52,115)` /
   `prose(5,5)` / `adjudicated(16,24)` / `verdict: dirty-or-unknown`.
   **Delta: −1 file, −34 sites.** Set difference of the OFFENDING lines is exactly this file's 34
   sites; the "new sites" side is **empty**; the five non-gating classes are unchanged (the file's
   one remaining site is the pre-existing prose comment, `L303=v2` → `L395=v2`, count unmoved).
2. Wrapper `a4p7-blueprint-version-clean.test.ts`: **60 legs before, 60 legs after, 60 pass.**
   DEFERRALS row for `fixtures.ts` removed in this commit; the two by-path controls re-homed:
   * archetype leg → `packages/runtime/test/a3p4-pr4-production-entry-regression.test.ts`,
     sites `[118, 491, 843, 1128]`, asserted by **set equality** so it cannot drift;
   * the named-path control went to the same file, and deliberately **not** to
     `t12a-live-bridge.mjs`, which is already the by-path control's own target — reusing it would
     have collapsed two independent controls into one.
3. Sixteen importers enumerated from the tree (`grep -rn "testdata/fixtures" packages`) — the
   brief's 16 is correct, and four more paths mention the file without importing it
   (`a4p7-v8-catalog-migration-state`, `t6-1-no-agent-dependency`, `p4t6-session-event-scan`,
   `testkit/domain/src/import-graph.ts`, a data table). Base `TOTALROWS 370 {passed 369, failed 1}`;
   after `TOTALROWS 370 {passed 369, failed 1}`. The **only** identity difference across all 370
   legs is one deliberate title rename (`parses the minimal closed v1 document` → `parses the
   minimal closed document at the version this build declares`), `passed` on both sides.
   Per-file pass/fail counts identical for all 16.
4. `p4t6-session-event-scan.test.ts`: **10/10, exit 0**, same as base. No extension by derivation:
   the only files this change adds are under `dev/agent-workflow/evidence/**`, which is outside the
   scanner's `packages/**` universe (the suite's own comments say so), so the scanned file count
   and the derived total are unmoved. Verified rather than assumed by running it.
5. §7.6 machine gate **26** (1 failing leg), classifier **54** pass, twins **13** and **8** pass —
   all equal to base. The one merge-gate failure is the known worktree refusal and was **not**
   fixed by building. Its diagnostic compared against base is byte-identical apart from two fields
   the leg exists to report about the tree it is standing in: the HEAD SHA, and
   `0 tracked file(s) changed vs HEAD` → `5 …` (taken pre-commit; `battery/merge-gate-clean-tree.txt`
   has the post-commit run, where the tree-delta field reads `0` again like base).
6. `pnpm -r run typecheck` → **exit 0**, `0 × error TS`. `pnpm -r --no-bail run typecheck` →
   **exit 0**, `0 × error TS`. Reported separately; both clean.
   `node scripts/lint-identities.mjs --diff …/lint-identities-0237d487.txt` →
   `baseline … 76 distinct; new 0, resolved 0` → **no STOP** (re-baselining was never needed).
7. Mutation table, green baseline re-verified after each restore by sha256 of the restored file
   against the pre-mutation sha, never by exit code.

### Mutation table

| # | Mutation | Instrument response | Did a test notice? |
| --- | --- | --- | --- |
| (a) | delete one `'metadata: {}'` from `NEG_QUOTA_NOT_POSITIVE` (a promoted fixture) | multiset census exit **1**: `LOST {'metadata: {}}': 1}`; R1–R6 census exit **1**: `removal that is not a version element` | **No.** 131 of 132 legs across its six consumers (`t2-blueprint-validation`, `t6-9-negative-matrix`, `t2-blueprint-hash`, `-catalog`, `-immutability`, `t6-6`) pass, and the single failure is the pre-existing `t2-blueprint-hash` debt. Exactly the blind family the census exists for: `takeRecord`/`?? {}` makes the drop invisible to the parse, the type and the hash alike. |
| (b) | revert the minimal factory's digit `3` → `1`, leaving the authority documents in place | **31 legs red**, and **5 importer files registered ZERO legs** — `t2-blueprint-catalog`, `t2-blueprint-revision`, `a4p7-v3-cutover-acceptance`, `bp1-blueprint-authority`, `t6-9-negative-matrix` (134 legs) — because a v1 document carrying `teamHardEnvelope` is an unknown-field refusal, so `MINIMAL_BLUEPRINT_SOURCE` throws at module scope. 236 registered + 134 unregistered = 370 ✓ | Yes, loudly, and more broadly than a red count reports — see Instruments item 6. This is also the direct proof that the promoted factory's digit and its pair are now a single load-bearing pair: reverting one half, not both, breaks the document. |
| (c) | re-add the removed `fixtures.ts` DEFERRALS row (added check) | wrapper exit **1** on the leg **`every deferred path is still dirty (a migrated path must leave the list)`** | Yes. The row's removal is therefore a checked deletion, not a mute: put it back and the wrapper says so by name. |

## Instruments that lied to me, and how I caught it

Ordered by how much damage each could have done unnoticed.

**1. A `not.toBe` hash assertion stays GREEN when the two documents diverge for a *third* reason.
— the a1 lane-movement leg. This was the real one, and it went green the whole time.**
The leg built `askLane` from `PERMISSION_SOURCE_ASK` and `movedToDeny` from a hand-copied inline
document, then asserted the two hashes differ — the claim being *moving one lane moves the hash*.
Once the factory was promoted, the two documents differed in the version digit and the two authority
documents as well, so the assertion held for reasons that had nothing to do with the lane. Green and
vacuous: the classic silent weakening, and it was in a file I had no instruction to touch.
**Caught it** by noticing the same file carried both a hash claim and an inline version constant,
then *measuring* instead of assuming — I rebuilt the promoted ask document independently and
compared: `sha256:b433a0e5…` for both, i.e. the fixture still reproduces; the ask→deny variant
`sha256:83bd353d…`; and a v1/no-pair ask build `sha256:f7dd43ac…`, different again. So the product
claim is still TRUE; what had died was only the leg's premise. The fix asserts the precondition
first — the ask variant must reproduce `askLane.contentHash` **exactly** — and only then that the
deny variant differs. **This is the file where "changed shape" and "claimed less" had to be told
apart, and it is the reason I can answer "shape": the repaired leg asserts strictly more than the
original.**

**2. The census's `VERSION` regex does not accept a quoted digit, and the miss cascaded into a
second, unrelated-looking false flag.** `NEG_SCHEMA_VERSION_UNSUPPORTED` writes
`schemaVersion: "1"` because the *type* is the claim, and upstream's pattern
(`7-4-b2a/tools/element-set-census.py:46`) accepts only a bare digit or a `${…}` interpolation. So
one element read as a lost document (R1 removal + R2 insertion) and R4's "nearest preceding version
element" search walked straight past it into the *previous* fixture, reporting a correctly-placed
pair as "outside the document declaring its version (fence region 9 vs 7)". **Four flags, one
cause.** Caught by not trusting the flag text: I printed the element stream with region tags and
element 122 (`schemaVersion: "3"`) sat in region 9 right next to its pair at 132. Note the pattern
carries a documented prior fix for `${V2_DOCUMENT_VERSION}` — this regex has now hidden a real
document twice, in two different ways, by being *narrower than the syntax the fixtures use*.
**I did not edit the shared tool** (it is another lane's evidence, and every lane reruns it);
I committed `tools/element-set-census-quotedfix.py`, byte-identical except that one line plus a
comment naming the defect, and proved the widening does not blunt it: same 2 anomalies on the
`5cdb4e50` control, same 6/6 self-test.

**3. difflib re-alignment is indistinguishable from a real move inside R1–R6 output.** After the
regex fix, `fixtures.ts` and `a1-permission-policy` each still reported a 5-element *insertion* and
a 5-element *removal* of identical content. That is what an alignment slide looks like in this
tool's own vocabulary, and the tool has no way to say "these are the same elements, seen twice".
**Caught it** by refusing to read flags as claims and asking the question the census actually exists
to answer — *did any non-version element disappear?* — of a multiset comparison instead. It reuses
the census's own element extractor so it cannot disagree about what an element is, and its
positive control fires (`LOST {'metadata: {}': 2}` → exit 1), so the 0 on my tree is a measurement,
not a shrug. Committed as `tools/multiset-census.py`.

**4. A red-leg *count* under-reports a collection-time failure.** Mutation (b) reported "31 failed".
The true damage was 31 red legs **plus five importer files that registered no legs at all** (134
legs), because `MINIMAL_BLUEPRINT_SOURCE` throws at module scope and the file never runs. Had I
compared only red counts against base I would have called a 5-file outage a small regression.
**Caught it** by comparing the *total registered* count to the base total: 236 ≠ 370, and the
difference located exactly the five files.

**5. My own instrumented prediction was wrong, and I reported it rather than quietly dropping it.**
I predicted `a4p7-v3-cutover-acceptance.test.ts:372-383` — which stamps the factory with
`String(SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS[0])`, i.e. `1` — would go red when the factory moved,
because the stamp would splice a v1 line onto a document carrying v3-only fields. **It stayed green.**
The premise was wrong: `inspectBlueprintSource` runs `splitFrontmatter` + `decodeYaml` + identity
parsing and **never reaches the closed field set** (`validate.ts:1211`), so an unknown-field refusal
cannot fire through that path. The reasoning was sound and the assumption about the instrument was
not. This is also the confirmation that Phase 1 (witness ownership) really had landed:
`a4f1-row-version-not-document-version.test.ts` and `a4p7-v8-catalog-migration-state.test.ts` no
longer import `fixtures.ts` at all.

**6. The fence reads `git ls-files`, so an untracked file is invisible to it** — run it *after*
`git add`, or a dirty file passes the fence by not existing yet. Honoured throughout; every fence
number here is post-`git add` / post-commit.

**7. The fence turns a version digit inside a *comment* into a PROSE site.** My first draft of the
CARRY comment said the witness was "still exactly `schemaVersion: 4`", which would have moved
`prose(5,5)` → `(5,6)` — my own migration creating a new site in the very class I was reporting as
unmoved, in a file whose DEFERRALS row records that an earlier draft of *that row* did exactly this
to *itself*. **Caught it** by reading the fence's carrier classification before running, then
rewording to "byte-for-byte the one it always emitted". `prose` held at (5,5); the file's one
surviving site is the pre-existing history note, which moved `L303` → `L395` because the header
grew, and the count is what the class claims, not the line.

**8. A line diff is blind to the five-default drop family, and `contentHash` is blind with it.**
Dropping `metadata: {}` / `requirements: []` / `members: []` / `memberEnvelopes: []` /
`policyStates: []` leaves the frozen blueprint *and* the hash identical, because `validate.ts`
defaults them with `?? {}` / `?? []`. Mutation (a) is the demonstration: census exit 1, **zero**
test failures across 132 legs of its six consumers. This is why the standing duty is an element-set
census and why the report's authority is §Census, not the diffstat.

**9. A tracked `__pycache__/*.pyc` means running an evidence tool dirties a tree.** Importing the
shared census module rewrote
`dev/agent-workflow/evidence/a4-pr7/7-4-b2a/tools/__pycache__/element-set-census.cpython-314.pyc`
in the **main workspace** — a tracked file, in another lane's checkout. It also poisoned the merge
gate's self-description: the leg reported `1 untracked entr(ies)` about the tree it was standing in.
**Caught it** with a plain `git status` after the run; restored with `git checkout --`, main
workspace verified clean. My own tool now sets `sys.dont_write_bytecode = True` before importing,
verified: re-run leaves no `__pycache__`.

**10. I wrote my evidence tools into the wrong tree.** I used absolute paths and created
`7-3-fixtures/tools/*.py` in the **main workspace** rather than the worktree branch. `git add -A` in
the worktree silently staged nothing, which is the dangerous shape: a commit that looks complete and
is missing its evidence. **Caught it** because `git status --short` in the worktree showed 5 files
where I expected 7, and I asked why instead of moving on. Moved, main workspace verified clean.

**11. Two of my migration scripts would have silently rewritten the wrong bytes, and refused
instead — which is the only reason they were safe.** (i) I delimited a fixture's span at the next
`export const NEG_`, but the 16 permission fixtures sit *between* two other fixtures' spans, so
`NEG_NON_LOSSLESS_JSON_VALUE` matched twice and the script would have edited a fixture it had
already classified; it died on its own "exactly one version line" assertion. (ii) The pair-insertion
anchor assumed `metadata: {}`, and two fixtures use a block `metadata:`; the first version raised
`ValueError` rather than guessing. Both were then fixed by explicit per-fixture selection, and the
script still refuses on any `NEG_*` it has not classified and on any unexpected version-line count.
A migration script whose assertions can fire is the instrument that saves you from yourself; the
final tally was `promoted 30 of 47 (P=27 D=3; shared-factory=16; carry=1)`.

**12. A census run AFTER the commit compares the tree to itself and reports a clean bill of health
for nothing.** The tool's first argument is a base rev, and `HEAD` is the natural thing to pass while
the work is uncommitted. Once `79152fb5` existed, `HEAD packages/domain/.../fixtures.ts` printed
`LOST: NONE / GAINED: NONE / exit 0` on all four files with head and work counts equal — because both
sides were the migrated file. Finish in this order, believe those zeros, and the entire silent-drop
guarantee of this report is vacuous. **Caught it** because `head 821 work 821` disagreed with the
`head 701 work 821` I had already written down an hour earlier: a number already in my notes was the
instrument that caught the later instrument. Every census figure here now passes `41ba59f4`
explicitly, and `battery/07-census.txt` leads with that warning, because whoever re-runs it will reach
for the same convenience.

**13. A gate that describes the working tree cannot be byte-compared while you are writing evidence
into it.** Twice the merge gate's self-reported tree state said `1 untracked entr(ies)` where base
said `0`, and both times the untracked entry was the very evidence file I was assembling in order to
make the comparison. The instrument was accurate; the observer was the disturbance. **Caught it** by
refusing to wave off "the only difference is the tree-state field" — that field *is* part of the
diagnostic — moving the file out of the tree, and only accepting the comparison once
`git status --porcelain` was genuinely empty. Its cheaper cousin: the second refusal sentence is
printed by the *classifier* suite, not the merge gate, so a single-suite run diffed against a
four-suite base log "loses" a line that was never the merge gate's. Same lesson in another costume:
compare like with like, including which process printed which line.

**14. Smaller, but they cost a cycle each.** Piping the positive control through `| tail -5` read
`exit=0` from the *pipeline*, not the tool; un-piped the real exit was **1**. Never pipe a command
whose exit code is the claim. `pnpm exec vite-node` does not exist in this checkout, and
`console.log` from a scratch vitest file is swallowed by the reporter — I forced a probe value out
through `expect(msg).toBe('FORCE-SHOW')` and read the "Received:" line, then deleted the scratch
file and verified its absence. My first `edit` on `fixtures.ts` was correctly rejected (file not
read / changed since read) because a script had written it — re-`read` after any script write.

## Cross-lane edits the coordinator may want to re-route

Five files, three of them owned by other lanes. All three were pre-registered by their own comments
as "change this constant only together with `fixtures.ts`", and none weakens a witness:

| File | Edit | Why it is not a weakening |
| --- | --- | --- |
| `packages/domain/test/t2-blueprint-parse.test.ts` | mirror `1`→`3`; expectation now **derived** from the mirror instead of a remembered `1`; frontmatter mirror gains the four pair elements; zero position asserted as data | gains four pinned bytes; the title says what it now claims |
| `packages/domain/test/bp1-blueprint-inspector.test.ts` | mirror `1`→`3` + comment only | the assertion reads the constant, so the claim is literally identical |
| `packages/domain/test/a1-permission-policy.test.ts` | mirror `1`→`3`; the hand-copied inline document became `askFixtureVariant('ask' \| 'deny')`; hash leg asserts its precondition | asserts strictly more than before (Instruments §1) |
| `packages/testkit/test/a4p7-blueprint-version-clean.test.ts` | DEFERRALS row for `fixtures.ts` removed; archetype + named-path controls re-homed | required to be in this commit; the deletion is checked by mutation (c) |
| `packages/domain/blueprint/testdata/fixtures.ts` | the migration itself | released to this lane by ruling |

**The alternative I rejected, and why.** I could have **CARRIED** the three shared factories — kept
them emitting v1 with a `SCHEMA_VERSION_*`-style carrier — and left every consumer untouched and the
fence quiet. That is laundering: the fence would have stopped flagging the file while the file went
on declaring a version this build is about to stop supporting, which is precisely the "clean and
lying" outcome §7.4 exists to prevent. The digit moved because the documents moved, not the other
way round.

## What this does NOT claim

* The flip has not happened and this commit does not bring it nearer than "one fewer decoration":
  `schema.ts:75` and `types.ts:416` are untouched, and 17 dirty sites in 6 files remain, every one
  of them another lane's row.
* `t2-blueprint-hash > projects absent optional singles as explicit null` still fails. It fails at
  base with the identical assertion and is not mine to absorb; it is counted in the 369/1 above.
* The `t12a-live-bridge.mjs` by-path control is unchanged and still dirty by design. I only avoided
  making it carry a *second* control.
* `rules: []` is inert **in these fixtures' world only**; see the two-plane disagreement above.

