# v4 翻档 prep stroke — DRY RUN ONLY (flip = NOT-APPLIED)

Generated read-only by `scripts/prepare-blueprint-v4-flip.mjs`.
Round: alpha5-schema-rev (VNEXT-SCHEMA reversible half; ADR M-1/M-6).

## STATUS

- Flip applied: **NO** (this script writes no source file).
- Gate window: the flip is the IRREVERSIBLE half of M-1; it waits for the
  A-4 window ruling. `A-4 窗口时长未定只阻退役决策` — exactly this stroke
  is what that ruling will consume.
- Old-version retirement: **NOT declared** anywhere by this round.

## Constants (read from schema.ts, not restated here)

| set | now | after the prepared flip |
| --- | --- | --- |
| SUPPORTED (run set) | [3] | [3, 4] |
| DEFINED | [1, 2, 3] | [1, 2, 3, 4] |
| RETIRED (derived) | [1, 2] | [1, 2] |

Why THIS step (not the grammar) is the irreversible one: the flip itself
demits nothing — v3 keeps running and the derived retired set stays
[1, 2] (nothing is demoted by adding the new version).
Irreversibility arrives the moment the first document is AUTHORED in the new
format: rolling the run set back afterwards would strand stored documents
that no longer validate. That is the point of no return the A-4 window
ruling prices — a WRITE-format decision, not a constant edit.
Retirement of v3 (removing it from the run set) is a SEPARATE later ruling;
翻档 ≠ 退役, and this round declares neither.

## Gate-arm truth table (per the two-name discipline of A1-21)

| version | gate now | gate after flip |
| --- | --- | --- |
| 1 | operator-owns MISMATCH arm (well-formed, not a run version) | operator-owns MISMATCH arm (well-formed, not a run version) |
| 2 | operator-owns MISMATCH arm (well-formed, not a run version) | operator-owns MISMATCH arm (well-formed, not a run version) |
| 3 | RUNS | RUNS |
| 4 | SCHEMA_VERSION_UNSUPPORTED (never defined) | RUNS |

## Zero-diff census (M-6 prep): the flip's blast radius IS this list

Every production reference to the version constants derives from them;
none re-states a document-version digit at its own site; a listed file that
DOES carry a digit literal (schema.ts itself and its testdata/fixtures are
expected and legal — the version-clean fence polices them) belongs to the
flip PR's own edit list:

- packages/domain/blueprint/src/index.ts
- packages/domain/blueprint/src/inspect.ts
- packages/domain/blueprint/src/schema.ts
- packages/domain/blueprint/src/validate.ts
- packages/domain/blueprint/testdata/fixtures.ts
- packages/domain/test/a4p1-blueprint-v3-governance.test.ts
- packages/domain/test/t1-capability-schema.test.ts
- packages/legacy/teammates-adapter.ts
- packages/legacy/test/p7t6-teammates-adapter.test.ts
- packages/runtime/dist/packages/domain/blueprint/src/index.d.ts
- packages/runtime/dist/packages/domain/blueprint/src/index.js
- packages/runtime/dist/packages/domain/blueprint/src/inspect.d.ts
- packages/runtime/dist/packages/domain/blueprint/src/inspect.js
- packages/runtime/dist/packages/domain/blueprint/src/schema.d.ts
- packages/runtime/dist/packages/domain/blueprint/src/schema.js
- packages/runtime/dist/packages/domain/blueprint/src/validate.js
- packages/runtime/dist/packages/runtime/src/plugin/blueprint-authority.d.ts
- packages/runtime/dist/packages/runtime/src/plugin/blueprint-authority.js
- packages/runtime/src/plugin/blueprint-authority.ts
- packages/runtime/test/a3p4-r4-authority-binding.test.ts
- packages/runtime/test/a4f1-row-version-not-document-version.test.ts
- packages/runtime/test/a4p7-ceiling-no-port-refusal.test.ts
- packages/runtime/test/a4p7-shipped-composition-blueprint.test.ts
- packages/runtime/test/a4p7-v3-cutover-acceptance.test.ts
- packages/runtime/test/a4p7-v8-catalog-migration-state.test.ts
- packages/testkit/test/a4p7-blueprint-version-clean.test.ts
- packages/testkit/test/p4t6-session-event-scan.test.ts
- scripts/check-artifacts-at-head.mjs

Digit-carrier check outside schema.ts: FLAGGED: packages/domain/blueprint/src/schema.ts, packages/domain/blueprint/testdata/fixtures.ts, packages/domain/test/t1-capability-schema.test.ts, packages/legacy/test/p7t6-teammates-adapter.test.ts, packages/runtime/dist/packages/domain/blueprint/src/schema.d.ts, packages/runtime/dist/packages/domain/blueprint/src/schema.js, packages/runtime/test/a3p4-r4-authority-binding.test.ts, packages/runtime/test/a4f1-row-version-not-document-version.test.ts, packages/runtime/test/a4p7-ceiling-no-port-refusal.test.ts, packages/runtime/test/a4p7-v3-cutover-acceptance.test.ts, packages/runtime/test/a4p7-v8-catalog-migration-state.test.ts, packages/testkit/test/a4p7-blueprint-version-clean.test.ts

## The flip PR (when and if the ruling comes) is ONE edit plus tests

1. `schema.ts`: run set gains the next version (the derived sets move themselves).
2. The frozen per-version parser branch for the new version already exists,
   dormant, in-repo (this round shipped the authoring grammar half); its
   dispatch line joins the per-version switch.
3. Docs face (M-7) updates in the same PR; retirement wording stays a
   SEPARATE later decision (翻档 ≠ 退役).
4. The flip PR must ALSO land the envelope-scope expansion (M-3, deferred
   here on purpose) atomically — half-landing the effect-face scope with a
   runnable v4 would create a parse-accept / runtime-unmap split.
