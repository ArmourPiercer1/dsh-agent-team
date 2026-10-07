# A4-F1 — a storage row's L3 stamp is not a Blueprint document version

Lane: `fix/a4-f1-row-vs-document-version` (one task = one branch = one worktree = one writer),
base `origin/master` @ `61c885b1`. Scope: finding **F1** of
`dev/agent-workflow/evidence/a4-pr76-acceptance-world/LEGS.md`, ruled by the coordinator a
**prerequisite for Task 7.3**, not a follow-up. Gate receipts:
[`gates-2026-10-08.md`](./gates-2026-10-08.md) in this directory.

## 0. Verdict on the brief first (the instruction was: say so if it is wrong)

The brief's description of F1 is **correct as written**, and every line number it cited was
re-read at the base commit before anything was changed:

| brief's claim | verified at `61c885b1` |
| --- | --- |
| every row is stamped with `TEAM_DOMAIN_SCHEMA_VERSION` | `packages/storage/schema/stores.ts:61` (`= 2`) → `packages/storage/schema/blueprint-registry.ts:106` (`schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION` inside `createBlueprintRegistryRecord`) |
| the row validator calls that field the TeamDomain version, not the document's | `packages/storage/schema/blueprint-registry.ts:131-139`: *"the TeamDomain schema version that shaped the row, L3 discipline"* |
| the authority consumes it as the document version | `packages/runtime/src/plugin/blueprint-authority.ts:101` (`BlueprintRegistryRecordView.schemaVersion: number`) and `:466-474` (the frozen arm) |
| it surfaced on `catalog.list` as `schemaVersion: 2` for a v3 document | `packages/runtime/src/plugin/s6-remote.ts:2477` → `catalogRevisionState` → `revisionStates` |

So: no "the description is wrong" report. One thing the brief did **not** say, and which the
trace found, is that a test was actively pinning the conflation — §4.

## 1. The trace, hop by hop (all line numbers at base `61c885b1`)

1. **The stamp is minted.** `packages/storage/schema/stores.ts:61` —
   `export const TEAM_DOMAIN_SCHEMA_VERSION = 2`, with
   `SUPPORTED_TEAM_DOMAIN_SCHEMA_VERSIONS = [TEAM_DOMAIN_SCHEMA_VERSION]` beside it. This is the
   **L3 row discipline**: every TeamDomain row records the storage shape that shaped it.
2. **Every registry row carries it.** `packages/storage/schema/blueprint-registry.ts:104-108` —
   `createBlueprintRegistryRecord` returns `deepFreeze({ schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
   … })`. Unconditional: there is no call path that writes a row with any other value.
3. **The row validator names the field for what it is.** `packages/storage/schema/blueprint-registry.ts:131-139`
   refuses a row whose `schemaVersion` is not `2`, and the message says in as many words that this
   is *"the TeamDomain schema version that shaped the row, L3 discipline"*. The storage layer never
   claimed otherwise. The claim was made one package up.
4. **The repository hands rows out.** `packages/storage/repositories/blueprint-registry.ts`
   (`get` / `list` / `freeze`) returns the record unchanged — correct, it is a row store.
5. **The single production consumer wires it into the authority.**
   `packages/runtime/src/plugin/host.ts:1860-1864` —
   `createBlueprintAuthority({ bootstrapSource, sourceIndex, registry: domain.repositories.blueprintRegistry })`.
   (Re-audited after the fix: this is still the **only** non-storage consumer of the registry
   repository in the whole tree, which is why the fix could be made at the type level.)
6. **The runtime's row shape admits a version field.**
   `packages/runtime/src/plugin/blueprint-authority.ts:101` —
   `BlueprintRegistryRecordView { readonly schemaVersion: number; … }`. Structural satisfaction
   means the storage record slides into this view, and from here the two meanings are
   indistinguishable — a `number` named `schemaVersion` in a type whose other fields
   (`blueprintId`, `revision`, `contentHash`, `source`, `frozenAt`) *are* the document's.
7. **THE HOP THAT LOST THE DISTINCTION.**
   `packages/runtime/src/plugin/blueprint-authority.ts:466-474`, the frozen arm of
   `scanIdentities()`:

   ```ts
   for (const row of registry.list()) {
     map.set(identityKey(row.blueprintId, row.revision), {
       blueprintId: row.blueprintId,
       revision: row.revision,
       contentHash: row.contentHash,
       origin: 'frozen',
       schemaVersion: row.schemaVersion,                                   // ← the L3 stamp
       migrationState: blueprintVersionStateOf(row.schemaVersion),         // ← classified from it
     })
   }
   ```

   This is where a **row fact** was read as a **document fact**. It was not a slip of the hand: the
   field's own doc comment at `:139-143` sanctioned it — *"for a frozen row the version the ROW
   carries"* — and required `schemaVersion`, because *"the operator question 'what still needs
   migrating?' is answered by this number and nothing else"*. The sentence is right; the source is
   wrong. Nothing in the storage layer said this number describes the document; the authority said
   it did, and the storage layer had already written it as the L3 stamp.
8. **And it made the answer REPLACE a true one.** The same `scanIdentities()` reads saved sources
   first and frozen rows second into one map (registry-wins shadowing). So the *same* Blueprint
   answered `3` while it was a file on disk, and `2` once `team.create` froze it. That is the
   symptom the acceptance world measured, and it is the reason "wrong but same state" is not a
   tolerable resting place: the two surfaces of one host disagreed with each other.
9. **Where the number then went.** `versionRefusalOf` (`:407-429`, which chooses
   `BLUEPRINT_MIGRATION_REQUIRED` vs `BLUEPRINT_SCHEMA_VERSION_UNSUPPORTED` from
   `identity.schemaVersion`), the `resolve()` refusal detail (`:599`), and the freeze-gate's
   synthetic identity for an already-frozen row (`:737-755`, `schemaVersion: frozen.schemaVersion`)
   — the Task 7.2 gate, so the wrong number was also gating a durable write.
10. **Onto the wire.** `packages/runtime/src/plugin/root.ts:1029-1037` (`catalogMigrationStates()`)
    → `packages/runtime/src/plugin/s6-remote.ts:2477-2483` (`migrationStatesByKey()`) →
    `catalog.list`'s `revisionStates` via `catalogRevisionState` (`:585-600`) → the client's
    `RemoteCatalogPort` doc (`packages/remote/src/handlers/ports.ts:52-66`).
11. **The arms that were already right, and prove the fix is a repair not a redesign.** The saved
    arm (`:509-555`) already asked the inspector; the anchor arm (`:486-505`) already used the
    strong-parsed anchor; and the governance plane already read the parsed document —
    `packages/runtime/src/plugin/permission-plane.ts:849`
    (`deps.resolveBlueprint(teamSessionId)?.schemaVersion`, i.e. a `TeamBlueprint`, from the seam
    declared at `:373`). Only the frozen-row arm was out of line with the rest of the file.
12. **Why the phase's own tests could not see it.** §4.

## 2. The fix: two versions, two names, one source of truth

Chosen shape (the trace decided it, per the brief's "whichever the trace shows is smaller and
honestly complete"): **the row stamp stops being carried into the runtime's row shapes at all.**
A rename (`rowSchemaVersion`) would have kept a second version-ish number travelling with every
row across a package boundary, needed the host to adapt the storage record to the view, and left
the next reader one field away from the same mistake. Deleting the field from
`BlueprintRegistryRecordView` makes the mistake **unrepresentable** and is the smaller diff,
because there is exactly one consumer (§1.5).

* **One version read in the domain.**
  `packages/domain/blueprint/src/inspect.ts:170` — `readDeclaredVersion(source)` is now the single
  place in the product that asks "what version does this document DECLARE?"
  (split frontmatter → decode YAML → plain-record → `schemaVersion` present and a positive
  integer). Every diagnostic reason and message is preserved verbatim (`structure-invalid`,
  `yaml-invalid`, `not-a-plain-record`, `schemaVersion-missing`, `schemaVersion-unsupported`).
  `inspectBlueprintSource` (`:263`) calls it and then does everything else. The Task 7.1 ordering
  law is untouched: the version **verdict** (does this build run it? `migration-required` vs
  `rejected`) is still asked LAST, after structure and identity, and the `schemaVersion` *field*
  rule* (present, positive integer) rides in the shared read at exactly the position it always
  occupied — so no diagnostic precedence moved, and the frontmatter is decoded once, not twice.
  New export `declaredBlueprintSchemaVersion(source)` (`:248`, re-exported from
  `packages/domain/blueprint/src/index.ts`) is the identity-level read the listing needs,
  documented as *"the version a document DECLARES … nothing else"*.
* **The runtime's row shape cannot carry a document version.**
  `blueprint-authority.ts:116` — `BlueprintRegistryRecordView` has no version field, with a note
  naming `blueprint-registry.ts:106`/`:131-139` and F1 as the reason.
* **The identity's version is now optional, and absence means unknowable.**
  `blueprint-authority.ts:169` — `readonly schemaVersion?: number`, documented as "ABSENT means
  UNKNOWABLE, not default". `migrationState` is unchanged in kind (still the three-state carrier of
  A1-21) and now says what a listing does when the number is missing: state **without** the number.
* **One helper, used by every stored-text arm.** `blueprint-authority.ts:417-446` —
  `BlueprintDocumentVersion` and `documentVersionOfStoredSource(source)`: a declared version
  classifies through `blueprintVersionStateOf` (`:404`); an unreadable document yields
  `{ migrationState: 'unreadable' }` and **no version**. Used by the frozen arm of
  `scanIdentities()` (`:564`), and by both arms of the freeze gate (`:853`, `:860`) — the gate that
  previously consulted the stamp.
* **Unknown renders as unknown, all the way out.** `versionRefusalOf` guards on
  `identity.schemaVersion !== undefined` (`:486`) before consulting the supported set, and the two
  phrase helpers (`versionPhrase` `:506`, `documentPhrase` `:513`) keep the **identical** wording
  whenever a version exists (`schema v99`, `a schema v1 document`) and say *"a version this build
  cannot read from the document"* when it does not. `undefined` never reaches a template — the spec
  forbade printing it. The refusal details and the wire use conditional spreads
  (`:700`, `:835`, `root.ts:1039`, `s6-remote.ts:609`) so the key is **absent**, not `null`, not `0`.
* **The row keeps its own stamp, in storage, under its own name.** `TEAM_DOMAIN_SCHEMA_VERSION`,
  `SUPPORTED_TEAM_DOMAIN_SCHEMA_VERSIONS`, and every L3 stamp are untouched; `TEAM_DOMAIN_SCHEMA_VERSION`
  is still `2` and still asserted as such in the new spec. **No row format changed, so no row
  migration was required and the brief's stop-condition (item 3) was never reached.**

### Behavior changes this fix makes, disclosed rather than left to be discovered

1. **A frozen row whose stored text cannot be read is now refused by name.** It used to fall
   through the version check — the stamp said `2`, `2` is supported — and fail later inside
   `parseBlueprint` with a domain parse error. It is now listed as `unreadable` (still listed: a
   durable row bound to this Team stays discoverable) and refused with
   `BLUEPRINT_SCHEMA_VERSION_UNSUPPORTED` carrying `migrationState: 'unreadable'` and no version.
   That is A1-21's lane for "we cannot read this", and it is what makes the listing and the resolve
   agree — the exact disagreement F1 was.
2. **An identity/wire record can now omit `schemaVersion`.** The wire already had that shape:
   `catalogRevisionState`'s "no state supplied" arm already emitted state-without-number
   (`a4p7-v8-catalog-migration-state.test.ts` pins it), so no new rendering was invented — the
   unknown arm now reaches the pre-existing one instead of a fabricated number.
3. **One arm is a _narrowing_, not a re-ordering, and it is named here so it is not discovered
   later:** re-driving `freezeSnapshot` on a row that is already frozen used to answer `ok`
   whatever the stored bytes, and now refuses with `BLUEPRINT_SCHEMA_VERSION_UNSUPPORTED` when the
   stored document cannot be read or declares an unsupported version. It is reachable only through
   a corrupt, hand-edited or foreign store — `freezeSnapshot` strong-parses before it writes, and
   `packages/storage/schema/blueprint-registry.ts:152-163` refuses a row whose source is missing or
   empty — so no world this product can write changes behaviour.

**Two doc comments on this branch were wrong about throwing, and both were corrected on review.**
`declaredBlueprintSchemaVersion` carried `@throws MALFORMED_DTO ONLY for a non-string source`, and
the module header claimed the strong split's programming-error case was the one escape from the
"never a throw" rule. It is not: `readDeclaredVersion` wraps that split in `try`/`catch`, so the
failure is classified like every other one. Measured at head (`node --experimental-strip-types`
could not resolve the workspace's extension-less imports, so this ran under `vitest` with a
throwaway spec, since deleted): passed `123`, `null`, `undefined` and `{}`,
`declaredBlueprintSchemaVersion` returns `undefined` and `inspectBlueprintSource` returns
`rejected`, and neither throws. The sibling
`inspectBlueprintSource` carried the identical wrong `@throws` two declarations away, and leaving a
known-false contract line next to a corrected one is the half-fix pattern this phase keeps meeting,
so it was corrected in the same commit. No behavior changed: comment text only.

### Cost

`scanIdentities()` now parses one frontmatter per frozen row per scan. That is parity with what
the same function already did for every saved source, and the function is already
document-reading, hash-checking work on the listing path; plan §7.4's "no whole-catalog strong
parse" is untouched (this is an identity-level read, not a `parseBlueprint`).

## 3. Proving it at the boundary that lied

`packages/runtime/test/a4f1-row-version-not-document-version.test.ts` (new, 16 tests):

* **Group A — the authority's listing.** Rows are built by the **real** storage factory
  (`createBlueprintRegistryRecord`), so the stamp on each row is the production stamp, and the
  fixture asserts its own divergence (`declaredBlueprintSchemaVersion(row.source) !==
  row.schemaVersion`) so no leg can go vacuous. A v3 document lists `3`; three readable rows give
  three different answers under one stamp; a v2 document **still** lists `2` — the anti-over-correction,
  because the fix reads the document rather than blacklisting a number; an unreadable row is listed
  with **no `schemaVersion` key** (`expect('schemaVersion' in identity).toBe(false)`) and
  `migrationState: 'unreadable'`; the state of every listed identity is
  `blueprintVersionStateOf(that identity's reported version)` — the law that makes 7.3's flip follow
  the document; and resolving the unreadable row is refused by name with no version in the detail
  and no hash accusation.
* **Group B — the wire.** A real `createTeamProductionRoot` over a real directory with the
  dispatcher installed through `root.seams.remoteHandlerRegistration`, reading `catalog.list` v8 as
  a client does: the frozen v3 row arrives at `3` (with an explicit `not.toEqual` against the
  literal `{revision:1, schemaVersion:2, migrationState:'current'}` the acceptance receipt
  measured), the unreadable row arrives with no number, a saved v3 source and a frozen v3 row agree,
  and every listed frozen state carries its document's declared version or nothing.
* **Group C — the freeze boundary.** The acceptance world's actual sequence, through the real
  `freezeSnapshot` into a port whose `freeze()` calls the real storage factory: the write produces a
  row stamped `2`, and the reported version is `1` **before and after** the freeze — the number no
  longer changes when the file becomes a row. The gate-on-an-already-frozen-row leg drives the
  unreadable row through the Task 7.2 gate and requires the version-name refusal with no version.
* **Group D — the row keeps its stamp.** All three rows carry `TEAM_DOMAIN_SCHEMA_VERSION` whatever
  their documents say (that is correct, it describes the storage shape), and the L3 constants are
  the values this phase pinned: `TEAM_DOMAIN_SCHEMA_VERSION === 2`,
  `SUPPORTED_TEAM_DOMAIN_SCHEMA_VERSIONS = [2]`.

**Broken by execution, three ways** (driver outside the worktree, every mutation reverted and the
restore verified by sha256 — full burned-list transcripts in the gates file, §G11):

* **MUT-1 restores F1 honestly** — the view re-admits `schemaVersion: number` and the frozen arm
  reads `row.schemaVersion`. **12 legs burn**, and they cross all three files (the new spec, plus
  one `a4p7-v3-cutover-acceptance` leg and two `a4p7-v8` legs).
* **MUT-2 folds the unknowable into `current`.** **6 legs burn** — exactly the unknown legs; every
  version leg stays green, which is what makes the two laws independently pinned.
* **MUT-3 unwires the root→remote hop** (keeps the state, drops the number). **5 legs burn**, all
  of them wire legs — proof the Group B legs drive that hop instead of re-reading one object twice.

**The p4t6 scan pin** was extended by path (`SCANNED_PATHS_A4F1`, one entry) with both totals moved
by that list's derived length and the tie `expect(SCANNED_PATHS_A4F1.length).toBe(1021 - 1020)`, and
it was shown to bite **in all three directions**: a file without a name
(`expected 1021 to be 1020`), a name without a file (`expected 1021 to be 1022`), and — the one the
total cannot catch — a wrong name of the same length, where the by-path loop burns
(`expected false to be true`). `p4t6` itself: **10 tests passed**.

## 4. A test was pinning the defect, and it was corrected

`a4p7-v3-cutover-acceptance.test.ts` group C2 was titled *"a frozen row is classified by the
version it carries, not by its text"* and its fixture wrote a row stamped `99` around a document
declaring `1`. That state is **unreachable in production** — the factory at
`blueprint-registry.ts:106` cannot stamp anything but `2`, and the validator at `:131-139` refuses
any other — so the leg could only ever be satisfied by reading the row and ignoring the text: it
asserted F1 as intended behavior. Per the plan's rule for a test whose subject is a retired
contract (*deleted or inverted, never retargeted*), it is now titled *"a frozen row is classified by
the version its document declares, and by nothing else"*, its fixture declares `99` **in the
document** (reachable, and the strong-parse-plus-hash ordering is preserved), and **every
assertion is kept** (`schemaVersion: 99`, `unreadable`, `SCHEMA_VERSION_UNSUPPORTED`, and the
"not `TEAM_BLUEPRINT_SNAPSHOT_MISMATCH`" discrimination).

Removing the view field forced four fixture edits (`bp1-blueprint-authority.test.ts`,
`policy-state-bound-blueprint-production-wiring.test.ts`, and the two `a4p7` files): the row
literals in test doubles that hand the port a *fresh object literal* no longer say
`schemaVersion: 2`. Where a leg needed the stamp as a fact, it now reads the real storage record and
points at the storage pin that owns it (`packages/storage/test/bp1-blueprint-registry.test.ts:169`
asserts `rAlpha1.schemaVersion === 2`). No assertion was weakened or deleted; nothing was skipped.

## 5. Task 7.3 readiness (reported, not implemented)

**Answer to "name every remaining site where a row stamp could be read as a document version": on
the Blueprint-document path there are none, and after this fix there is no field to read.** The
registry repository's only non-storage consumer is `host.ts:1863`, and the view it receives
(`blueprint-authority.ts:116`) has no version field. Every remaining `.schemaVersion` read in
`runtime`/`remote`/`tools` src was checked and is document-fed or a different object:

| site | what it reads | status for 7.3 |
| --- | --- | --- |
| `packages/runtime/src/plugin/host.ts:885-887` (the pre-v3 arm: `undefined → 'unreadable'`, `!== 3 → 'pre-v3'`) | `deps.blueprintSchemaVersion(teamSessionId)` | document-fed; will classify parsed v1/v2 documents as `pre-v3` the moment `SUPPORTED` is `[3]` |
| `packages/runtime/src/plugin/permission-plane.ts:455` (the `number \| undefined` seam) and `:849` (its supplier), consumed at `:889` | `deps.resolveBlueprint(teamSessionId)?.schemaVersion`, i.e. a strong-parsed `TeamBlueprint` (declared at `:373`) | the seam type is what carries "unknown" today and `host.ts:886` already renders it `'unreadable'`; nothing here reads a row |
| `packages/runtime/src/plugin/blueprint-authority.ts:404` `blueprintVersionStateOf` | the domain sets | pure derivation from `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS`; every caller now passes a document version or does not call it (the unknown arm returns `unreadable` without consulting it) |
| `packages/runtime/src/plugin/blueprint-authority.ts:591`, `:601`; `root.ts:955`, `:1049-1050`; `bound-blueprint.ts:122`; `host.ts:985` | the strong-parsed anchor identity | document-fed |
| `packages/runtime/src/plugin/s6-remote.ts:1566` | `blueprint.schemaVersion` of a resolved (parsed) blueprint, i.e. `catalog.get` | document-fed; already the half of the pair that said `3` |
| `packages/runtime/src/plugin/host.ts:2539` (`raw.schemaVersion === 2`) and `host.ts:2837`, `packages/remote/src/handlers/team.ts:164,192`, `s6-remote.ts:4529` | **different namespaces**: the MemberInstance record discriminator, the artifact-ledger row stamp, the remote projection envelope | not Blueprint documents; explicitly out of scope and untouched |
| `packages/storage/schema/blueprint-registry.ts:106` (kept) | the L3 row stamp | correct at its own layer; Group D pins that it still says `2` |

What 7.3 still has to do, none of it done here: flip
`packages/domain/blueprint/src/schema.ts:75` to `[3]` (which derives
`RETIRED_BLUEPRINT_DOCUMENT_VERSIONS = [1, 2]` at `:117-119`), and land the discoverability and
migration surface the ordering in A4-PR7 requires. Two facts 7.3 inherits from this lane:

* With the flip, a frozen v1/v2 row now lists `migration-required` **with the number it will be
  migrated from**, because the number and the state come from the same document read (Group A's law
  leg + `blueprintVersionStateOf`). Before this fix, every frozen row would have listed
  `migration-required` from `2` — including the operator's own v3 anchor, which is the failure the
  coordinator ruled this lane a prerequisite for.
* The unknown arm is already reachable today (a row whose stored text cannot be read), and it is
  refused with `BLUEPRINT_SCHEMA_VERSION_UNSUPPORTED` rather than
  `BLUEPRINT_MIGRATION_REQUIRED`: there is no migration for a document nobody can read. 7.3 should
  keep that split (ADR A1-21) rather than fold it into the backlog.
* The coordinator's remaining F1 proof — the **frozen-origin acceptance world**, not just a live
  one — still needs doing at 7.3, because the observable difference (a frozen v1/v2 row reported as
  `migration-required`) only exists once `SUPPORTED` is `[3]`. Group C pins the mechanism here; the
  booted-world leg belongs to 7.3's receipt.

## 6. Deviations, environment notes, and what was NOT done

* **Gate G3/G4 failed on first run and were fixed the sanctioned way.** `build:composition` and
  `check:artifacts` both exited 1 with `C content-drift (git add): packages/runtime/dist/...`
  because `packages/runtime/src/**` changed. Remedy per the plan: `pnpm build` then **co-commit**
  the 21 drifted `packages/runtime/dist` files (the checker was not edited). Re-run: `build:composition`
  exit 0 and `[check-artifacts-committed] OK: 1508 files` — **measured 1508**, as expected.
* **Gate G8/G9 failed on a real finding of my own**: the new spec imported
  `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS` without using it —
  `'SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS' is defined but never used` — and `lint-identities`
  consequently reported `new 1, resolved 0`. The import was removed; eslint is silent and
  `lint-identities` reports `new 0, resolved 0`.
* **`pnpm run smoke:composition` is red and stays red: it is not this fix.** The runtime host-plugin
  target **PASSED**; the client target dies on `Cannot find package 'clsx' imported from
  node_modules/.pnpm/@deepseek-ai+dsh-client-ui-primitives@0.2.0-rc.2_.../lib/index.js`, and `clsx`
  is installed nowhere in this sandbox (`ls node_modules/.pnpm | grep -c '^clsx'` → `0`) and appears
  in neither manifest. The same inherited leg is recorded by earlier lanes
  (`a4-pr6/gates/README.md:26`, `a4-pr7/PREFLIGHT-RULINGS.md:28`,
  `a4-pr7/7-6-ACCEPTANCE-RECEIPTS-PARTIAL.md:32`, which rule that the leg "may not close silently").
  Fixing it means editing a `package.json` that this lane does not own, so it is reported, not
  worked around. It is not in the F1 gate list.
* **Client package suite**: `3 failed | 876 passed (879)` — exactly the baseline trio
  (`team-creation-panel` ×2, `team-governance` ×1). No new client failure.
* **Whole-repo suite**: `10 files failed | 478 passed (488)`, `21 failed | 6025 passed (6046)`.
  Identities are the recorded baseline exactly (`t1-capability-schema` ×9, `p6t3-mediation` ×5,
  `p6t3-restart` ×2, `t2-blueprint-hash` ×1, `d3-member-identity-context` ×1, `p6t6-actions` ×1 = 19,
  plus the three baseline 0-test collection files) **plus `p6t1-parallel` ×2**, which is the declared
  ±1–3 flake lane — observed count **2**, reported and not silenced.
* **`a4p7-v3-cutover-acceptance.test.ts` group C2 retitled and its fixture made reachable** (§4).
  This is the one place where a pre-existing test's *text* changed beyond a forced fixture repair,
  and it changed because the test was pinning the defect.
* **Not done, deliberately:** Task 7.3 (not implemented — reported only), any row-format migration
  (none required), any change to `TEAM_DOMAIN_SCHEMA_VERSION` /
  `SUPPORTED_TEAM_DOMAIN_SCHEMA_VERSIONS` / L3 stamps, any push, any change to `master`/`stable`,
  `:3080`, `tests/deepseek-harness-test-use`, or another worktree. `CORE PATCH BUDGET` spent: **0**;
  no `eslint-disable`, `@ts-ignore` or `@ts-expect-error` anywhere in the diff.
