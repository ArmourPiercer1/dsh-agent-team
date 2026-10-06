# A4-PR1 — round-1 review: what the append commit changed

Reviewed head: `b3c6e849271963b6815314af82aedfc2c4ab4585` (verdict: **no correctness
defect found**, SUPPLEMENT). Everything below landed as ONE append commit on
`feat/a4-pr1-authority-envelope` — no rebase, no amend of `b3c6e849`, no push, no
PR, no edit to plan/ADR/spec/`graph.yaml`/`SESSION_ROUTER_LOG.md`/`docs/STATUS.md`.

## Corrections of record (both were MY claims in the completion report)

1. **The golden provenance was overstated.** `d25ea1cf…` and `d6368916…` are
   **content-hash prefixes, not commit SHAs** — a reader who runs `git show` on
   them gets nothing. The honest proof that the v1/v2 hash was already frozen
   before PR1 touched anything is
   [`red-captures/lane-a-red.txt:20`](red-captures/lane-a-red.txt) — leg **V16
   `GOLDEN ✓` recorded on the PRE-CHANGE tree**, i.e. the byte-identity leg was
   already green before the v3 carrier existed. Stated again in the append
   commit body, because the original message could not be edited.
2. **The dist mechanism was wrong, and PR0 was not at fault.** See
   [`BASELINE-CLOSURE.md`](BASELINE-CLOSURE.md) §"The dist this commit carries":
   the 8 emitted `governance/proposal-*` files arrive through `governance/index.ts`
   's new **value** re-export → `authority-ceiling.ts:68`'s **type-only** import →
   TS program reachability (an `include` does not gate transitive emission — ADR
   A5-19, and X5-E5 predicts this consequence for PR1 and rules the co-commit
   owed). `check:artifacts` was **legitimately green at base `d21effba`**
   (`OK: 1444 files`); "PR0 committed sources without their dist output" is
   refuted, and the count is **8 files, not 16**. PR5 now owes **0** emitted
   proposal files.

## Items taken, and how each new guard was proven able to fail

Every guard below was mutation-tested: the property was broken on purpose, the
leg was required to go red, and the mutation was reverted immediately (tree
verified with `git status`). A guard that cannot fail is not a guard — that is the
same lesson this review round was about, so the receipts are in this file.

| item | fix | proof it can fail |
| --- | --- | --- |
| **B1 (blocking)** | `bindingDocs`' post-`switch` refusal is now pinned **by execution**: the leg calls it with `'chief' as unknown as ProposalAuthorityPosition` and requires a throw, for `bindingDocs` AND through `grantCeiling`. The comment now states what the silent alternative was — `return []` → empty bound set → `CEILING_IDENTITY` → unlimited reach for a principal the table never named. | post-`switch` `throw` replaced with `return []` ⇒ **B1 leg red**, both assertions. Reverted. |
| **SF1** | `AuthorityEnvelopeDocuments`' two slots are **required** and typed `AuthorityEnvelope \| AuthorityDocumentRead`, where `AuthorityDocumentRead` is the three-way `declared \| absent \| unavailable`. **`undefined` is not a member**, so the collapsing `unavailable → undefined` is a compile error; `boundDocument` REFUSES on `unavailable` with a new named code `AUTHORITY_CEILING_DOCUMENT_UNAVAILABLE` (kept separate from `AUTHORITY_BINDING_DEFECT`, and from `undetermined`, per A1-7). `permission-plane.ts`'s `AuthorityHardCeilingRead` is now an **alias** of that type, so the reader's output forwards into `grantCeiling` with no unwrap and no intermediate `undefined`. RED: "a fault must never produce an unlimited ceiling" for `leader` and `human-user`; `human-admin` still meets to identity (a document that binds nobody cannot refuse — pinned so nobody "fixes" the row). A type-level pin (`undefined extends AuthorityDocumentSlot ? true : false` asserted `false`) fails the build if the slot ever widens back. | the `unavailable` refusal folded into `absent` ⇒ **SF1 leg red**. Reverted. |
| **SF2** | the "unwired" leg is now a **per-name allow-list** over the new production surface (`bindingDocs`, `grantCeiling`, `AuthorityEnvelopeDocuments`, `AuthorityBindingError`, `AUTHORITY_CEILING_ERROR_CODES`, `AuthorityBindingProblem`, `AuthorityCeilingScope`, `AuthorityDocumentRead`, `AuthorityDocumentSlot`, `narrowingForApproval`, `meet{,All}AuthorityCeilings`, `CEILING_IDENTITY`, `CEILING_NO_AUTHORITY`, `effectiveAuthorityCeiling`, `parseAuthorityEnvelope`, `AuthorityEnvelopeAst{,Matcher}`, `AuthorityHardCeilingRead`), read from **comment-stripped** source so prose cannot satisfy it; **plus the reader**: zero non-test call sites of `.teamHardEnvelope(`; **plus** an assertion that `permission-plane.ts`'s import of the adapter is `import type`. The un-failable duplicated clause at the old `:458-459` is gone. | a value import + reference of `narrowingForApproval` added to `governance/service.ts` ⇒ red with `narrowingForApproval referenced by governance/service.ts`. Reverted via `git checkout`. |
| **SF3** | the leaf walk is **recursive** over `packages/domain/authority-envelope/**` and reads four specifier forms — `from '…'`/`from "…"`, `import(…)`, `require(…)`, side-effect `import '…'` — with a **non-vacuity** assertion (the patterns must match something; the walk must reach `src/`). | `export const probe = async () => await import('node:fs')` appended to the lane's `index.ts` ⇒ red with `authority-envelope/src/index.ts -> node:fs`. Reverted via `git checkout`. |
| **SF4** | the alias tuple gained the **sixth** direction, `Assignable<AuthorityEnvelope, PermissionMutationEnvelope>`. The five forward entries stay true under a WIDENED re-spell of the PR0 name; only this one goes false. | n/a (type-level; the direction is the point). |
| **SF5** | `INVARIANT-MATRIX.md`: row **A5-12** no longer cites an unrelated `matcherCovers` leg as its proof — it now says the version switch is **PR2's**, in PR2's single adapter, and what PR1 owes is additivity; row **4** now says the v3 reader returns **`{ status: 'absent' }`** (a status, never `undefined`, never `{rules: []}`) and names the `unavailable` refusal, so a PR2 implementer is not walked into SF1's collapse; row **16** cites the B1 leg; row **A3-9** cites the recursive walk; a new row records the **unwired** claim that the matrix previously did not carry at all. | n/a (document rows). |
| nit **V10** | **taken by strengthening, not deleting**: the leg asserted only `expect(v3.ok).toBe(true)` (a dozen legs below presuppose it). It now pins the claim in its own title — `parseBlueprint.length === 1`, i.e. there is no argument position where a provider, canonicalizer, or `cwd` could arrive (ADR A2-3), which is also why the hashed hard envelope can only have come from the document. | n/a. |
| nit **`schema.ts` version-set comment** | **taken**: it pointed at `scripts/verify-blueprint-version-clean.mjs` as if it existed and cited ADR **A5-19**, which is about two wrong A4 premises. It now says the script is **PR7-owned and does not exist at PR1**, attributes it to **A3-16** as restated by **A5-9** (invoke it by name; nothing runs `scripts/*.mjs` implicitly; no runtime test can substitute, because those kits are the environment-blocked lanes), and puts the v3-only switch where A5-12 puts it. | n/a. |
| nit **`fixtures.ts:305-312`** | **taken by making the comment true instead of softening it**: the file claimed the `supported` detail is "asserted exactly in a4p1", and nothing asserted it. V1 now parses **this fixture's own `source`** and asserts `error.details.supported` equals `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS`, so the derivation is pinned at the constant and the sentence is a fact. | n/a (V1 fails if the detail stops being derived). |
| nit **`p4t6…:1784`** | **taken**: "each of the three" above an 11-path list now reads as what it is — PR0's six plus A4-PR1's five, each asserted by path. | n/a. |

**Nothing declined.** All eleven items were taken.

## Disclosed while doing it

* My first rewrite of the hygiene `describe` **silently dropped** the pre-existing
  (PR1-round-1) leg `the runtime consumes that grammar as ONE implementation, not
  a copy` — the object-identity pin the matrix's A3-9 row cites. The linter caught
  it (`domainEnvelope` unused), and the leg is restored verbatim plus a pointer to
  the no-new-storage-edge paragraph it now backs. The hygiene file therefore has
  **14** legs, not 13. This is the same failure mode as a fake guard, in the other
  direction: an edit that quietly deletes a guard while the count stays plausible.
* `V10`'s title changed, so `red-captures/lane-a-red.txt` shows the OLD title.
  Raw captures are not edited after the fact; this file is the pointer.
* `bindingDocs`' post-`switch` leg needs a **double** cast
  (`'chief' as unknown as ProposalAuthorityPosition`): a single `as` from a
  non-member literal is itself a compile error, and the value being modeled is
  precisely one that got past the compiler.

## Gates at the append head

| gate | result | raw |
| --- | --- | --- |
| named gate (11 files) | **153 passed**, exit 0 (was 150: +B1, +SF1; hygiene 13 → 14) | `gates/named-gate-append.txt` |
| permission-plane consumers (8 files, not in the named gate — run because `permission-plane.ts` changed) | **113 passed**, exit 0 | `gates/permission-plane-consumers-append.txt` |
| `pnpm -r run typecheck` | exit 0, **8 × Done** | `gates/typecheck-append.txt` |
| `eslint` (all 17 touched non-dist files) | exit 0 | `gates/eslint-append.txt` |
| `pnpm build` | exit 0 — 11 dist files changed (the 3 modules this round edited: `blueprint/src/schema`, `governance/authority-ceiling`, `src/plugin/permission-plane`; `permission-plane.js` itself is byte-identical because its change is type-only) | `gates/build-append.txt` |
| `pnpm build:composition` | exit 0 | `gates/build-composition-append.txt` |
| `pnpm run check:artifacts` | exit 0, `OK: 1464 files` (same count as `b3c6e849`; no new artifacts, content drift only, co-committed) | `gates/check-artifacts-append.txt` |

The full baseline diff and `p4t6`'s scan total are the coordinator's call; `p4t6`
itself is in the named gate and still reports **983** — this round added no
scannable file (one new evidence `.md`, and evidence and `dist` are out of
scanned scope).


---

# Round 2 — the append introduced a regression; what the second append changed

Reviewed head: `e84f3156`, baseline closed independently by the coordinator (full
suite twice, run2 = 22 identities, `fail-set diff` NEW=0 FIXED=0; the one run1
extra `rc2-sanitize-evidence::S13` passes 13/13 in isolation). Content accepted;
**one regression and five guard-quality holes were not.** All six items and the
four nits are taken in the second append. Nothing declined.

## The regression is mine, and it is worth naming precisely

`codeOnly()` was written by me to satisfy round-1 SF3, and in buying precision I
threw away the property that made the parent leg worth having: **it read raw
source, so it could only over-report.** Stripping `/* … */` with an unanchored
opener *before* line comments turned a `/*` living inside a `//` comment
(`src/plugin/host.ts:1034`, closer at `:1313`) or inside a string
(`packages/client/src/ui/locales.ts:292`, closer at `:551`) into a phantom block,
silently deleting ~279 and ~259 lines of real code from the scan. A PR2 wiring
inside either window reddened nothing — including in the file my own leg comment
names. The guard was not "less precise"; it was **blind over a third of `host.ts`**,
and blind guards report GREEN. Order is now line-comments-first with
line-anchored block openers, and `the comment stripper cannot delete code` is a
leg that fails if the property is lost again — synthetic sample plus real code
inside both eaten windows. (Writing that comment I hit the same family of bug in
my own doc comment: a literal star-slash ended it early. The parser caught it,
which is the difference between a compiler and a guard.)

## Receipts — every claim below has a captured failing run

Round 1's mutation claims were prose only. They are artifacts now, in
`red-captures/`, each with the command, the injected mutation, the leg that must
redden, the revert method and the exit code:

| receipt | injected | red leg |
| --- | --- | --- |
| `mutation-M1-host-window-wiring.txt` | `grantCeiling` / `bindingDocs` / `facts.teamHardEnvelope(…)` wiring at `host.ts:1099-1105`, **inside the window the broken stripper ate** | `PR1 ships the ceiling adapter UNWIRED…` (`grantCeiling referenced by src/plugin/host.ts`) |
| `mutation-M2-bogus-position-falls-through.txt` | post-`switch` `throw` → `return []` | `B1 (BLOCKING) — a position outside the closed union REFUSES…` |
| `mutation-M3-unavailable-folds-into-absent.txt` | `unavailable` refusal disabled | `SF1 — an UNAVAILABLE document never becomes a ceiling…` |
| `mutation-M4-slot-fallthrough-meets-to-identity.txt` | `resolveSlot` back to a value-returning fall-through | `item 4 — a slot that is NOT a slot refuses with a code…` |
| `mutation-M5-production-consumer-of-domain-algebra.txt` | `narrowingForApproval` imported and referenced in `governance/service.ts` | `PR1 ships the ceiling adapter UNWIRED…` |
| `mutation-M6-dynamic-import-inside-domain-leaf.txt` | `await import('node:fs')` in the domain lane | `the domain lane declares no edge but its own interior` |
| `mutation-M7-typo-in-one-specifier-pattern.txt` | the `require()` pattern typo'd to `requires\s*\(` while `from '…'` still matches | `every specifier pattern is exercised and reaches a verdict` |
| `mutation-M8-export-dropped-from-the-policed-list.txt` | one export removed from the policed list | `PR1 ships the ceiling adapter UNWIRED…` (`every export of authority-ceiling.ts must appear in SURFACE`) |
| `mutation-M9-alias-respelled-locally.txt` | `PERMISSION_EFFECT_PRECEDENCE` re-declared as a literal copy, import still present | `the runtime consumes that grammar as ONE implementation, not a copy` |

All nine came back **RED AS REQUIRED**; every mutated file was reverted
(`git checkout` where the file was otherwise untouched, exact reverse patch
otherwise) and the tree verified before the gates were run.

## Items 2-5, in the words the code now uses

* **Item 2.** The policed list is checked **both ways** against a scan of the
  module: every `export` of `authority-ceiling.ts` must be policed (this is what
  catches the next `AuthorityCeilingErrorCode`), and every policed name must be a
  real export of some module in the graph (this is what catches a typo policing
  nothing). `consumersOf(name)` must be non-empty per name — a zero-consumer name
  is an unpoliced name wearing a green badge. And the barrel is pinned, value and
  type halves separately, because the importer leg greps `authority-ceiling.js`
  specifiers and cannot see a consumer that arrives through `governance/index.ts`;
  the per-name walk can, and now says so.
* **Item 3.** Each specifier pattern carries its own sample and expected
  specifier, and the self-test runs through `externalSpecifiersIn` — proving the
  match reaches the **offender list**, not merely that a regex matches.
* **Item 4.** `resolveSlot` cannot fall through. A slot that is `undefined`,
  `null` or a non-object throws `document-slot-missing` under
  `AUTHORITY_BINDING_DEFECT`; a slot whose `status` is outside the closed union
  throws `document-slot-unrecognized-status` under
  `AUTHORITY_CEILING_DOCUMENT_UNAVAILABLE`. Both are `AuthorityBindingError` with
  a `code`, because PR2 maps on `code` and a bare `TypeError` has none; and
  neither can produce a ceiling. This was the B1 shape one level up: the old
  tail returned `reason: undefined`, which `boundDocument` read as *absent*, which
  meets to the identity — a document nobody could interpret would have WIDENED
  the reviewer it was supposed to cap.
* **Item 5, stated honestly.** The runtime line
  `expect([...runtimeNamesAreAliases]).toEqual([true, true, true, true, true, true])`
  **compares hardcoded literals. Vitest can never redden it.** The pin is that the
  file stops COMPILING if a direction stops holding, so the gate that owns this
  claim is `pnpm -r run typecheck`, not the test run. What the tuple can see and
  cannot see is now written out in `a4p1-authority-envelope.test.ts`: entry 5
  sees an incompatible change, entry 6 sees a NARROWED re-spell, and **an added
  OPTIONAL field keeps both true and is caught by nothing**. A locally re-spelled
  structural copy — same shape, no import, both directions true, X7-R3 fake-mode
  #1 — is caught by the import/alias-source assertions added to the
  ONE-IMPLEMENTATION leg, which require `permission-mutation.ts` to import the
  domain module and to define each alias *as* the imported name.

## Evidence hygiene (item 6)

Round-1 gate artifacts were raw tails: no command, no exit code, and
`eslint-append.txt` was **0 bytes**, because a clean lint prints nothing and a
0-byte file was filed as a pass. Round-2 artifacts
(`gates/*-append2.txt`, plus `eslint-append.txt` regenerated) carry a header with
the gate title, the exact command line, the cwd, the HEAD SHA and dirty-path
count, the date, and the exit code, followed by the unmodified raw output. They
supersede the round-1 files of the same name, which are left as captured.

## Nits taken

* `p4t6`: **no count is written in prose at all any more.** The paths live in two
  named arrays and the only number is the derived tie
  `expect(SCANNED_PATHS_A4PR1.length).toBe(983 - 978)`, which fails if a file is
  added without being named or named without existing. The comment records that
  it had been wrong three rounds running.
* `a4p1`: the module-level `expect(undefinedIsNotADocumentSlot)` under a comment
  disavowing it is gone; the const is `_`-prefixed and the compile error is the
  pin.
* B1's matcher is now `/has no written binding arm/`, so forwarding bogus
  positions into `case 'member'` cannot satisfy it, and the Member refusal is
  asserted separately as still reachable and still distinct.
* Every approximate count in the leg comments and the invariant matrix ("~17",
  "~seventeen") is gone, replaced by the derived statement.

## Gates at the second append

| gate | result | raw |
| --- | --- | --- |
| named gate (11 files) | **156 passed**, exit 0 (153 → 156: +`item 4`, +specifier self-test, +stripper receipt) | `gates/named-gate-append2.txt` |
| permission-plane consumers (8 files) | **113 passed**, exit 0 | `gates/permission-plane-consumers-append2.txt` |
| `pnpm -r run typecheck` | exit 0, **8 × Done** | `gates/typecheck-append2.txt` |
| `eslint` (17 touched non-dist files) | exit 0 | `gates/eslint-append2.txt` |
| `pnpm build` | exit 0 — 4 dist files (the `authority-ceiling` module: `.js`, `.d.ts` and both maps) | `gates/build-append2.txt` |
| `pnpm build:composition` | exit 0 | `gates/build-composition-append2.txt` |
| `pnpm run check:artifacts` | exit 0, `OK: 1464 files` (unchanged count; content drift only, co-committed) | `gates/check-artifacts-append2.txt` |
