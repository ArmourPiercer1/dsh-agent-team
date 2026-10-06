# A4-PR2 rework gates (coordinator items 4-6), head `7f475e29`+

## 4. dist co-commit (A5-19)
`pnpm build` exit 0 (9 packages) · `pnpm build:composition` exit 0 ·
`pnpm run check:artifacts` → `OK: 1468 files; committed install-surface artifacts match
the fresh build (incl. 1 glue placement(s))`. The two exit-1s the coordinator measured
were this same drift, uncommitted; `cb890f18` carries sources + dist together.

## 5. Client lane — 854 vs the recorded 853 (measured three times)
| point | files | tests | failures |
| --- | --- | --- | --- |
| `840db608` (last commit before any alpha.4 code) | 53 | 3 failed / 851 passed (**854**) | 3 |
| `f55dd64d` (this branch's base) | 53 | 3 failed / 851 passed (**854**) | 3 |
| this head | 53 | 3 failed / 851 passed (**854**) | 3 |

The three failures are the baseline set: `team-creation-panel.client.spec.tsx`
("selecting a blueprint loads the detail block and fires the persona-fact probe",
"switching the runtime preset re-runs the probe with the new persona fact") and
`team-governance.client.spec.tsx:556` ("an override reset targets the member instance
(scope instance) and pulls once on success").

**The 854th test is not new and no lane added it.** It is
`packages/client/test/client-bundle.client.spec.ts:152`
"the emitted dist plane carries the same absence (and the plugin entry)", written
`it.skipIf(!distBuilt)` — the P9-S9 dual-surface/dist work (`0738b45d`). It counts as a
PASSED test where the committed dist plane is present and as a SKIPPED test where it is
not, which is exactly the difference between a 854 and a 853 total in this repo since
dist became a committed artifact (A5-19). PR2's client delta is zero: `git diff
--name-only f55dd64d..HEAD -- packages/client` contains no spec or source file, only
built `dist/` + `composition-shim/` artifacts.

## 6. Root suite identity list (see `root-suite-identity.txt`)
`Test Files 9 failed | 457 passed (466)`, `Tests 19 failed | 5567 passed (5586)`.
The coordinator's 5577 total was at `d5e899ed`; `+9` is the nine legs added by
`7f475e29`'s suite (17 → 26 in `a4p2-dual-envelope-mutation.test.ts`). Same 19 failures.

Against the recorded environment baseline (`evidence/team-archive-member-tool/README.md`
§6: 20 failing tests / 7 files + 3 file-level errors), this run is a STRICT SUBSET — the
only difference is `p7t6-teammates-adapter` (1 test), which now passes. No new failure
identity appears anywhere, and no failure is in a file this branch touched.
