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
