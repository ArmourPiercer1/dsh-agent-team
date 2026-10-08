# REPAIRS — spending the 54-leg bill at the seam (§7.5, this lane)

Branch tip history: law `70266cc7` → wire `95182ee5` → merges `751394dc`/`43cfca5e` →
`bdbccc72`/`020ce875`/`8fc831ad` → evidence `c1eeca40` → **repairs `7f382ac7`** →
**pre-v3 pin `679ac362`** → this document. Land order is law → repairs → evidence, as
instructed; the reachability pin is a test-only leg set and sits between them.

## 0. The four rules this document is written against

1. **Repair at the seam, not at the assertion.** No assertion in any of the five files was
   edited to match new output. `grep -c 'expect('` per file is unchanged in four of five; the
   fifth's changed bodies are the three recorded re-scopes in §3, and their titles changed too
   so the identity diff has to name them.
2. **Re-authorise the seed the way production does**, and where that is impossible without
   exercising the law under test, split or re-scope and **record the decision per leg** (§2, §3).
3. **Show the repaired legs bite** — seven classes, one mutation live at a time, each restored
   and blob-verified: `bite/README.md`.
4. **Land order + `NEW 0`** against the baseline, `RESOLVED` limited to this lane's own
   instruments plus what the law legitimately falsifies, named one by one (§6).

## 1. The five worlds and the seam each one got

| file | legs | the seam (one injection per world, none per leg) | production counterpart it copies |
| --- | --- | --- | --- |
| `a3p3-permission-mutation-authority` | 13 | `openServiceWorld` lane gains `authorityCeiling: declaredCeilingReader({ hardCeiling: CEILING_CELLS(…), carrier: () => envelope() })`; cells are exactly the matchers this suite drives | a v3 Team whose Blueprint **declares** `teamHardEnvelope`; the carrier is the lane's own `permissionMutationEnvelope` |
| `a3p3-revoke-reveal-semantics` | 12 | same, plus the lane's own carrier document **mirrored** into the ceiling context (§4.2) | the Leader is capped by BOTH bound documents (`BOUND_AUTHORITY_DOCUMENTS`, `authority-ceiling.ts:290-310`) |
| `a3p4-permission-lifecycle-e2e` | 16 | `openLaneWorld` gains the reader over write/read/exact + bash/fingerprint cells, and write/read `subtree` cells **only when the world has a containment predicate** | a predicate is not optional in production (`fsContainsKeys` → `permission-plane.ts:234-251`) |
| `a3p4-pr7-entry-exec-contract-regression` | 11 | the ONE missing line `permissionAuthorityCeiling: createAuthorityCeilingReader({ facts })`, plus its Blueprint's `teamHardEnvelope` declared over the same four cells its carrier already covers | `host.ts:2703` passes exactly this expression; `src/plugin/root.ts:2899` is the conditional spread that was dropping the gate |
| `a3p4-pr4-production-entry-regression` | 2 | R5-tool: the same one line (that world had **already declared** its ceiling through its own `hardCarrier` option and never wired a reader to read it). E1: the same line over `createPermissionAuthorityFacts`, with only the hard-ceiling document hand-authored — the hand-authoring the world's own comment says the host would otherwise resolve from the bound snapshot | ditto |

New shared seam: `packages/runtime/test/a4p7-ceiling-world-helpers.ts` (`ceilingOverCells`,
`ceilingWorldDocuments`, `declaredCeilingReader`, `DECLARED_NO_EXPANSION`,
`CEILING_WORLD_ANCHOR`). It joins the p4t6 named path set — referee **1035 → 1036**, total
still derived as `983 + Σ named lists`, never as a literal.

**Ceiling-extension discipline, applied throughout:** a cell is declared only for a leg whose
assertion is `changed: true`, or for a seed/grant a leg must perform before the thing it
asserts. A leg that asserts a refusal keeps its refusal on the plane that always produced it —
which is why `exec … covered ONLY by the identical fingerprint` still refuses (no
`OTHER_EXEC_FINGERPRINT` cell exists anywhere), why `kernel refuses a subtree matcher on a
shell class` still refuses (no bash `subtree` cell is declared), and why the malformed-envelope
leg is still refused by the envelope parse.

## 2. Per-leg record (54), grouped by what the seam had to supply

Every identity below is verbatim from the identity diff (`describe` joined to `it` as the JSON
reporter joins them), and every one of them is green at the repaired tip.

### `a3p3-permission-mutation-authority.test.ts` — 13

* **The world's declared cells are the whole repair (10 legs)** — each drive is a mutation the
  suite expects to commit, or a mutation preceded by a grant:
  `CAS conflict (plan PR3) a stale expectedGeneration is a typed conflict with NO partial write` ·
  `a maxEffect ceiling is a CEILING: ask covers deny->ask but never ask->allow` ·
  `a from-absence GRANT is an expansion measured from the DECLARED-NONE deny fallback (known fact, not a masquerade)` ·
  `an ask->allow expansion covered by maximumEffect=allow commits a new snapshot` ·
  `a nested-subtree grant is covered only by a subtree envelope root the containment accepts` ·
  `exec exactness (design §5) an exec expansion is covered ONLY by the identical fingerprint (no subtree, no any)` ·
  `every state-changing mutation appends exactly ONE FULL snapshot; the no-op writes none` ·
  `revoke_permission produces the unified snapshot WITHOUT the addressed pairs and needs no expansion authority` ·
  `Human mutation (ADR §7) may exceed the Leader envelope and records Human provenance` ·
  `Human mutation (ADR §7) creates NO permanent priority: the Leader recovers by tightening without any envelope, and still cannot expand beyond it`
  (the last two also record why the declared ceiling is the *Team's* cap and the carrier is the
  *Leader's*: the human position is bounded by `teamHardEnvelope` alone).
* **`TIGHTENINGS need NO expansion authority: all three, with an EMPTY envelope`** — the leg
  whose own FIRST statement grants, so that the second statement can tighten. Its title is a
  claim about the tightening, and it is still true and still asserted; what the closed gate
  showed is that the *seed* needed authority, and the fixture had been getting it through the
  open gate. This is §7.5 prerequisite 3 in one line, and it is the leg class B of the bite
  table re-kills first.
* **`exact envelope rules do not cover wider matchers; subtree roots cover what they contain`** —
  needs both shapes declared: the exact cells AND the subtree roots, because the leg walks from
  a covered cell to a wider matcher and back.
* **`a MALFORMED envelope refuses a change-mutation that rises NOTHING`** — refused, and refused
  by the envelope parse exactly as before; the world's ceiling only stops the leg from being
  refused by the wrong thing first.

### `a3p3-revoke-reveal-semantics.test.ts` — 12

* **The carrier mirror is the whole repair (9 legs)** — every one of them varies the lane's own
  envelope, which is the document a Leader is capped by alongside the hard ceiling:
  `(f) nested exception: a non-rising child region cannot rescue the rising residual — ceiling ask refuses, ceiling allow passes` ·
  `S6: subtree-deny removal revealing a STATIC allow under its root …` ·
  `S6d: fallback-ASK region … rises deny->ask — needs ceiling-ask` ·
  `S1b: the same revoke passes ONLY with allow-ceiling coverage of the WHOLE matcher` ·
  `S3: deny->ASK reveal is expansion VERBATIM (ADR §6): refused without ceiling, accepted at ceiling-ask` ·
  `B1 (BUG2): exact ask under an overlay-matching subtree allow is a TIGHTENING …` ·
  `S7b: the same revoke with envelope coverage of the removed matcher (ceiling allow) commits …` ·
  `X1p: the SAME revoke WITH the predicate is the decidable deny->allow reveal — EXPANSION-coded refusal` ·
  `X4 GATE SPECIFICITY: EXACT-ONLY context with NO predicate flows NORMALLY …`
  With the mirror in place the v3 meet equals Alpha.3's coverage law for these worlds, so the
  legs decide on the envelope they were written against; without it the mirror's absence becomes
  a second, narrower ceiling — that is bite class C, which reddens exactly `S1b`/`S3`/`S7b`.
* **Three re-scopes: `X1 CANONICAL`, `X2 EQUAL-SUBTREE REWRITE`, `X3 STATIC subtree allow`** — §3.

### `a3p4-permission-lifecycle-e2e.test.ts` — 16

* **Cells for the drives (13)**: `grant_instance appends generation 1 …`, `the effective answer
  is allow from the overlay layer, and a different key is untouched`, `the overlay layer
  overrides a static DENY of the same pair`, `an exec grant answers its OWN fingerprint and no
  other`, `renewing the same desired state is a NO-OP`, `revoke appends generation 2, leaves
  generation 1 byte-identical …`, `a MemberInstance created AFTER the grants has zero
  permissions` (three grants first, then the zero-permission assertion), `no static facts from
  the decision site = UNKNOWN` , `ARCHIVED: execution is refused …`, `DISPOSED: execution is
  refused, and a mutation against a terminal instance is refused typed`, `a GENUINE rule change
  at restore time is one ordinary mutation`, `restore performs NO permission write even when a
  grant was already standing`, `revoked during ARCHIVE stays revoked after restore`.
* **Containment-conditional subtree cells (3)**: `a subtree grant answers for a DESCENDANT key
  through the per-decision verdict`, `an UNJUDGED subtree rule keeps the frozen lane asymmetry`,
  `the SAME Leader mutation commits once the lane supplies the containment predicate`. These are
  the legs bite class F reddens when the subtree cells are withdrawn, and they are the reason
  the cells are conditional: a world built with `predicate: false` or `'throws'` must NOT be
  handed subtree authority it cannot decide.
* **Left refusing, on purpose**: `the kernel refuses a subtree matcher on a shell class` — no
  bash `subtree` cell exists in any world of this file.

### `a3p4-pr7-entry-exec-contract-regression.test.ts` — 11

All eleven are this file's root-assembled drives (`R7-addr`, `R7-exec` ×2, `R7-law`, `R7-rpc` ×3,
`R7-sem`, `R8-principal` ×3). One line wires the production reader; the Blueprint declares the
same four cells its carrier declares, so **the meet equals the carrier** — no leg gains authority
it did not already claim, and no refusal any leg relied on disappears. `R8-principal … in-ceiling
commits; out-of-ceiling refuses TYPED, zero write` is the clearest case: it needs the ceiling to
exist to mean anything, and it needed the wiring to reach it.

### `a3p4-pr4-production-entry-regression.test.ts` — 2

* `R5-tool — the REAL team_grant_permission/team_revoke_permission surface …` — this world had
  **already declared** its hard ceiling via its own `hardCarrier` option. Nothing read it. One
  line.
* `a LEADER exact grant inside the injected envelope COMMITS at the assembled root … (BLOCK-1)` —
  the root-assembled lane with a hand-authored carrier: the reader is wired over the real facts
  and the hard-ceiling document is hand-authored over the one cell the leg grants, mirroring the
  carrier the world hand-authors three lines above it.

## 3. The three re-scopes, recorded per leg (the only bodies edited)

All three are `X`-legs of `a3p3-revoke-reveal-semantics`'s
`unknown subtree relation refuses typed — never a silent non-match (round 2)` block, and all
three drive a lane with **no containment predicate**. Since this law landed, such a lane cannot
even *write* a subtree rule: `classifyPermissionRise` refuses any batch where a subtree matcher
participates in an affected class and no `subtreeContains` was injected
(`subtree-relation-unknown`). The state these scenarios need — a standing subtree rule in a
predicate-blind lane — is therefore **no longer constructible at all**, by any route, from
either plane. The refusal the legs want is still delivered, typed, with zero write; it just
arrives one statement earlier, at the seed instead of at the revoke.

| leg (identity as it was at the base) | the title it carries now | body change | what still pins the original law |
| --- | --- | --- | --- |
| `X1 CANONICAL (parent fixture): subtree(R)=allow + exact(R/file)=deny; DECLARED-NONE; EMPTY envelope; revoke the exact deny with NO subtreeContains ⇒ truth deny->allow reveal must REFUSE (pre-fix build ACCEPTS)` | `X1 CANONICAL (parent fixture): subtree(R)=allow on a lane with NO subtreeContains; DECLARED-NONE; EMPTY envelope; §7.5 — the unknown relation refuses the SUBTREE GRANT ITSELF, typed, zero write [re-scoped: the state is no longer constructible; the reveal law stays pinned by X1p]` | seeds, then `await expectRefusedWith(… EFFECT_CONTEXT_UNAVAILABLE)` and `expect(await latest(w)).toBeUndefined()` | **`X1p: the SAME revoke WITH the predicate is the decidable deny->allow reveal — EXPANSION-coded refusal (the gate changes nothing when the relation is known)`** — same describe, already present, untouched |
| `X2 EQUAL-SUBTREE REWRITE (parent addition): subtree(R)=deny updated to ask with NO predicate; DECLARED-NONE; EMPTY envelope ⇒ truth deny->ask VERBATIM expansion must REFUSE (pre-fix drops the rule BOTH sides => false deny/deny identity, ACCEPTS)` | `X2 EQUAL-SUBTREE REWRITE (parent addition): subtree(R)=deny with NO predicate; DECLARED-NONE; EMPTY envelope; §7.5 — the equal-subtree grant is refused TYPED before any state exists [re-scoped: the rewrite is no longer reachable; deny->ask VERBATIM stays pinned by X2p]` | as above | **`X2p: the SAME equal-subtree deny->ask WITH the predicate is refused EXPANSION-coded (ladder-strict: deny->ask VERBATIM needs ceiling-ask coverage)`** |
| `X3 STATIC subtree allow exposed by revoking the overlay subtree deny, NO predicate ⇒ typed refusal (pre-fix drops BOTH the overlay deny and the static allow => declared-none deny/deny identity, ACCEPTS)` | `X3 STATIC subtree allow exposed by a subtree mutation with NO predicate; §7.5 — the refusal is TYPED and the overlay stays EMPTY [re-scoped: the overlay deny can never be written; the static reveal stays pinned by X3p]` | as above | **`X3p: the SAME static-subtree reveal WITH the predicate is the decidable deny->allow expansion — EXPANSION-coded refusal`** |

Each body carries a `// [§7.5 RE-SCOPE, recorded per leg]` comment naming why, and which twin
holds the law. All three twins already existed in the same `describe` before this lane — this is
not a repair by deletion: 3 identities leave the corpus and 3 new ones enter it, all six named
here, and every one of them is green.

## 4. Three discoveries that only the repair could produce

1. **There is no `any` ceiling.** The first version of the helper declared
   `maximumEffect: allow` over `{ kind: 'any' }` and every leg died with
   `authority-ceiling-insufficient … reaches only no-authority`. `matcherCovers`
   (`packages/domain/authority-envelope/src/authority-envelope.ts:213-231`) branches on
   `fingerprint`, on `exact`, and by elimination treats everything else as `subtree` — **there
   is no `any` arm**. A document-level `any` falls into the subtree arm with an `undefined`
   resource, which either covers nothing or returns `undeterminable: true`, and
   `evaluateMatches` step 2 lets ONE undecidable same-class rule undetermine the whole scope.
   `any` is a static-layer / mutation-matcher kind only (`permission-mutation.ts:824`). A
   declared ceiling is therefore a **cell set**, and the helper says so in its own doc comment.
2. **An empty context carrier is a second ceiling.** Declaring only the hard ceiling left nine
   legs red with the refusal naming *the expansion* plane. A `leader` install is bound by
   `['teamHardEnvelope','permissionMutationEnvelope']` and the meet is over bound documents, so
   a context whose carrier is `{rules: []}` silently caps every Leader drive — including, in
   that suite, the very legs whose subject is what the carrier says. The mirror is the repair,
   and it is the reason the fix is "declare the world", not "pass a ceiling".
3. **An approval-wired lane answers first, and the answer is not the ceiling code.** Zeroing the
   declared ceiling in a root-assembled world produced
   `TEAM_RUNTIME_CALLER_NOT_FOUND — root session … has no team-root binding` (bite class D),
   because a *refused* Leader rise in a lane that has the ceiling port and the proposal lane is
   escalated into a durable ASK, and the ask resolves the caller through
   `admission/resolve.ts:246-266`. The ceiling refusal is real — the ask path simply answers
   before it is returned. Production always has the binding (it is what makes a root a Team
   root), so this is a fixture-completeness observation, not a product hole, and I changed no
   product code for it. It is worth knowing before the §7.5 deletion lane turns more fixtures
   approval-wired: **their refusals arrive as ask-path refusals**, and their worlds need the
   durable row.

## 5. The pre-v3 reachability measurement (coordinator ruling)

Ruled question: can any input reachable from `hostEntry.apply` / the assembled root produce a
*decided* pre-v3 binding whose ceiling-context reader returns `undefined`, post-flip?

**Measured answer: no.** `facts.blueprintSchemaVersion` is
`resolveBlueprintOf(team)?.schemaVersion` (`src/plugin/permission-plane.ts:872`) and its only
producer is the strong parse, which throws `SCHEMA_VERSION_MISMATCH` for anything outside
`SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS = [3]` (`domain/blueprint/src/validate.ts:1195`, the list
pinned by `a4p1` leg V1 since the cutover). So the facts layer answers `3` or nothing: `1`/`2`
are not facts this build can observe about a bound document, only facts it can refuse, and an
unresolvable binding already lands on `unreadableAuthorityCeilingContext` — a refusal.

Pinned by `R1`–`R4` in `packages/runtime/test/a4p7-ceiling-no-port-refusal.test.ts`
(**10 passed (10)** = N1-N6 + R1-R4; suite grew 6 → 10 legs, `NEW 0`):

| binding | reader's answer |
| --- | --- |
| bound document declaring v1 / v2 / v4 / v9 | defined, documents `unavailable` → refused `PERMISSION_EFFECT_CONTEXT_UNAVAILABLE` with `authorityCeilingCode=AUTHORITY_CEILING_DOCUMENT_UNAVAILABLE`, zero write |
| no resolvable bound Blueprint | defined, `unavailable` (unchanged behaviour) |
| bound v3 | defined, documents `declared` |
| **`undefined` answers across all six** | **0** |

R4 is the leg that reddens if a route ever appears: it holds the door open by hand (a cast
`TeamBlueprint` with `schemaVersion: 2`, the object the parse refuses to build), shows that the
skip and a commit still follow from it, and so makes R2's counter the guard. Re-opening the
bridge reddens R2 without anything in R4 being edited. Per the ruling the **committing branch is
untouched** — no second refusal, no 59-red bill.

## 6. The bill, after the repair

See `final-census.log`, `bill-check.txt` and `final-reds.txt` in this directory: the identity
diff against the post-merge base, with `NEW 0`, the `RESOLVED` list named one by one, the three
renamed identities named, and the nine-root list attached to every count.

## 7. Two corrections to `FINDINGS.md` (both from the coordinator's review)

1. **§6 item 8 indicted a script on the wrong tree.** The sentence
   `OK: 1508 files … committed install-surface artifacts match the fresh build` was real, but it
   was measured on **`6174f1e5` — this lane's pre-merge base**, where it sits at
   `scripts/check-artifacts-committed.mjs:161`. It does **not** exist on current `master` or on
   this tip (`git show master:scripts/check-artifacts-committed.mjs | grep -c 'match the fresh
   build'` → `0`; same for `HEAD`), because the PR #179 that this branch merged at `258d2b48`
   rewrote the check into four drift classes and replaced the sentence with one that says the
   opposite: *"This script does not build, so this says the tree matches what is staged, NOT that
   a build produced these bytes; ask `pnpm check:artifacts:head` whether the commit carries its
   own build."* The indictment is **retracted against current master**; what survives is the
   method: the token instruments (`DSH-ARTIFACT-VERDICT … verdict=ok|stale|refused`), never the
   prose.
2. **My pre-merge census row was five-root, and §2 labelled it "the whole population".**
   `packages/*/test/**/*.test.ts` spans **nine** package roots — `runtime`(350 files at HEAD)
   `testkit`(29) `client`(28) `domain`(26) `storage`(23) `remote`(15) `contracts`(13)
   `tools`(12) `legacy`(7) — and the pre-merge run recorded `417 files / 5047 legs` with exactly
   the five roots `contracts legacy domain storage runtime`. The eight files' difference
   (`29+28+15+12 = 84`) is precisely the blind spot the coordinator confessed: 501 nine-root
   test files exist at `6174f1e5`, 417 in that row. The **spent** pair is clean — both sides of
   the post-merge diff are nine-root (`502` files, per-root counts in `bill-check.txt`) — and all
   five files of the 54 are in `packages/runtime/test/`, so the spent bill loses nothing to the
   stale row; but the label was wrong and the row is now labelled.
