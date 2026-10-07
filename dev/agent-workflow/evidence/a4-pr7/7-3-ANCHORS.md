# 7.3 — pre-flight anchor map (coordinator, 2026-10-08, at `master bfdf1141`)

Why this exists: plan line numbers in this phase have been wrong about one time in four, and a
writer follows the `Files:` block rather than the prose (X11). Every anchor below was located **by
symbol** at the current head, and the two claims the plan made about specific lines were each
checked rather than trusted.

## The flip itself

| what | verified location | note |
| --- | --- | --- |
| the supported set | `packages/domain/blueprint/src/schema.ts:75` — `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS: readonly number[] = [1, 2, 3]` | the single list the flip edits; its doc comment at `:107` already says setting it to `[3]` *is* the cutover |
| the retired set | `packages/domain/blueprint/src/schema.ts:117` | must gain `1` and `2` in the same commit, or `blueprintVersionStateOf` loses the ability to say `migration-required` |
| the document-version union | `packages/domain/blueprint/src/types.ts:416` — `readonly schemaVersion: 1 \| 2 \| 3` | the union, not a `number` seam |
| the unsupported diagnostic | `packages/domain/blueprint/src/validate.ts:1190-1201` — `SCHEMA_VERSION_UNSUPPORTED`, message built from the list, `supported: [...]` in the detail | the reader of the flipped list; no second hard-coded `[1,2,3]` here |
| the hash-core cast | `packages/domain/blueprint/src/validate.ts:1492` — `schemaVersion: schemaVersion as 1 \| 2 \| 3` | **plan anchor verified correct** (unusual, and recorded as verified rather than assumed) |

## Where the version is *consumed* as a decision

| what | verified location | note |
| --- | --- | --- |
| row/stamp validator | `packages/storage/schema/blueprint-registry.ts:133` — `if (schemaVersion !== TEAM_DOMAIN_SCHEMA_VERSION)` | **F1's site**: compares a stored *row* against the *document* constant |
| version-state classifier | `packages/runtime/src/plugin/blueprint-authority.ts:378-379` (`blueprintVersionStateOf`) and `:420` | reads the flipped lists; `:319` keys off the `schemaVersion-unsupported` diagnostic reason |
| the permission-plane fact | `packages/runtime/src/plugin/permission-plane.ts:849` (`resolveBlueprint(teamSessionId)?.schemaVersion`), documented at `:448` | the `undefined` in that signature is a real absence (no bound blueprint), not a version hole |
| the plane's switch | `packages/runtime/src/plugin/permission-plane.ts:889` with the doctrine comment at `:863` — "THE VERSION SWITCH IS `schemaVersion === 3`, EXACTLY" | a flip that leaves `:863` describing a `[1,2,3]` world is a comment lying about code |

## Not in the source tree, and still owed

`cutoverIndex` is a **test-side** double, defined twice:
`packages/runtime/test/a4p7-v3-cutover-acceptance.test.ts:201` and
`packages/runtime/test/a4p7-v8-catalog-migration-state.test.ts:188` (the second documents itself as
"the a4p7 acceptance file's `cutoverIndex`, same shape"). 7.3's obligation to replace the
`simulateSupported` double with a **real retired-version fixture** lands here, not in `src/`. Anyone
who "fixes the version lists" without touching these two keeps testing a world the build no longer
has.

## Gate consequence, stated before the dispatch

The flip makes `SUPPORTED=[3]`, so **every probe-live fixture carrying a v1/v2 document becomes
compile- or runtime-red in the same commit** (the probe already showed what that looks like: the
domain factory alone turned 7 files and ~84 tests red). 7.4 is therefore not a cleanup after 7.3 —
it is the work that makes 7.3's commit green, and the two must be planned as one landing or as
7.3-with-expected-red recorded honestly. That ordering question is the first decision the 7.3 brief
has to answer, not something to discover mid-flight.
