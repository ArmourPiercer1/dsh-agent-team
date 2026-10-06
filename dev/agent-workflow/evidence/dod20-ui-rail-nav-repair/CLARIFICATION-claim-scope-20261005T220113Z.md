# CLARIFICATION — exact scope of the claims made at 350e86c9 (docs-only, 2026-10-05)

Documentation-only follow-up. Parent (the reviewed commit, PASS recorded by the project
lead as a **source/offline** pass — not real acceptance, not overall PR #62 clearance):
`350e86c916dc35d07247dc5dc963d63a4e849fde` (tree
`336b731ceb47e4db42b3ceb7404eb118eeb3f893`); its parent is the previously reviewed
`4bd13a9a580b177151d1769da3a38142e01211b8` (tree
`07d1250b4e7d4d9dce6808e20de1e2a24a6094b3`). This descendant adds **only this file**: no
code, no test, no prior commit, package or raw log is modified. (A commit cannot contain
its own hash; this file's own head is recorded in the round's private receipt.)

Four statements in the round-2 notes were broader than what the change actually does or
what the evidence actually shows. Each is narrowed here, with the exact mechanism.

## 1. Group identity is required for EXPANSION — it is not an unconditional group-header gate

What the repaired `navigate()` does, in order:

1. If this leg has a rail target (`expected != null`) and `expected.groupKeyProven !== true`
   → `FailClosed('group-identity-missing')` with **zero** rail clicks. This condition is
   about the *fixture-derived* identity (the workspace store), not about any DOM header:
   the driver refuses to guess which group owns the target.
2. The expansion loop only ever looks for `data-row-key="workspace:<groupKey>"`. On each
   pass it **first** attempts the locate: if the canonical row is already FOUND, the loop
   breaks and no header is touched. It clicks only when that exact row reports
   `aria-expanded="false"`, and it re-reads the same row after the click.
3. `group-not_found` / `group-ambiguous` are raised **only on the locate-failure path**
   (`hit.status !== 'FOUND'`): a missing expected header, or two containers claiming the
   same header key, becomes fatal when the target could not be located and therefore
   *needed* that group's expansion (or when the duplicate header makes the group itself
   ambiguous).
4. A leg with no rail target (`expected == null`, i.e. E2) is not identity-gated at all and
   keeps its documented legacy rail behaviour plus its ordinary-workspace oracle.

So the accurate claims are:

* **Missing or duplicate group headers fail closed when expansion needs that group
  identity** — reasons `group-not_found` / `group-ambiguous`, each with the scrubbed rail
  diagnostics and a failure screenshot.
* **They do NOT gate selection in general.** If one real-tree row already uniquely carries
  the exact canonical session `data-row-key` **and** the exact canonical title (one row
  container, no competing `unscoped` key, no second tree carrying it, no duplicate
  title), the locate resolves `FOUND` with no header interaction, and selection is verified
  by the **unchanged** proof: the main-pane header showing the exact canonical session id
  plus a SUCCESS `team.getReadState` response whose `rpcId` correlates to the fresh request
  for exactly that sessionId (at most one same-row retry, still unverified → `NOT_RUN`).
  This is exercised offline by
  `dod20-ui-driver-rail-identity.test.mjs` → *"scope: the search tree alone may hold a row —
  and it is still a real tree, so it is found"*, where the row lives in the second real tree
  and no group row is clicked.
* **Not claimed:** that every rail action requires a group header; that a leg can never
  proceed without expanding a group; or that `group-identity-missing` is a DOM condition.

## 2. Malformed *listed* workspace entries are a real validation gap (nonblocking here)

`readWorkspaceGroups()` refuses when the store is absent, unreadable, unparseable, or has no
`tables.workspaces` object. `deriveGroupKey()` refuses when **several** workspaces claim the
same session, and returns `''` (Ungrouped) when exactly zero claim it.

The gap: the claim test is
`Array.isArray(tables[wid] && tables[wid].sessionIds) && tables[wid].sessionIds.includes(id)`.
A **listed** id (`global.workspaceIds`) whose table entry is missing, is not an object, or
whose `sessionIds` is not an array is therefore *skipped silently* — indistinguishable from
"does not claim the session", so a malformed store could yield a wrong-but-proven-looking
`groupKey: ''` instead of a refusal. Entries present in `tables.workspaces` but absent from
`global.workspaceIds` are likewise only reachable through the `Object.keys` fallback.

Status: **known defensive-validation gap, nonblocking for this lane**, because the fixture
this lane reasons about is well-formed and fixed — the retained world
`tests/homes/tvs-smoke-2026-10-05T18-50-48/storages/workspace.json` is `unit v2` with one
workspace (`40d5679e-12f5-4f35-b417-0eab81103e1b`) carrying an array `sessionIds` of one
unrelated session, and both canonical targets appear in no `sessionIds` list, so both resolve
to `UNGROUPED_KEY === ''` for the right reason.

**Not claimed:** that every malformed store is rejected. **No code hardening** is performed
in this docs-only step; tightening the claim test (and asserting the malformed shapes
red-first) is a separate, future, source-only step.

## 3. The full root suite is still RED — and what the raw-name comparison does and does not show

Recorded at `350e86c9`
(`GREEN-identity-20261005T203947Z-root-vitest.log`, `-root-vitest-delta-isolation.log`):

* **5,398 passing tests, 20 failing tests, plus 3 collection-failing files, across 10
  failing files** (`Test Files 10 failed | 446 passed (456)`,
  `Tests 20 failed | 5398 passed (5418)`, exit 1).
* The 3 collection-failing files (0 tests collected in the full run, "no tests" when run
  alone): `packages/runtime/test/p8s3b-result-effects.test.ts`,
  `packages/runtime/test/t12a-b2-child-identity.test.ts`,
  `packages/runtime/test/t12a-glue-handoff-ports.test.ts`.
* An independent **raw-name** comparison of the failing test/collection names against the
  source-equivalent `4bd13a9a` / `8c99142e` evidence found **zero new failing names**.

What that comparison does **not** establish: it does **not** make the PR green, it does not
prove the root suite is "as expected" in general, and it does not establish the causal
history of any individual failure (a name that failed before may be failing now for a
different reason; 3 of these files are order/collection dependent, and
`p4t6-session-event-scan` is the separately recorded stale-pin
`expected 971 to be 968`). Failing-file set membership is a *differential* statement only.
Root `pnpm test`/full `vitest run` is not a gate this lane claims.

## 4. E1/E3 evidence boundary, and where canonicalTargets actually runs

* The **exact failure-time DOM and cause for E1/E3 remain unrecorded.** The 18-50-45Z run
  captured no DOM at the locate failure (the failure-path screenshot and scrubbed rail
  diagnostics that would have recorded them were added *by* this repair line of work).
* Proven **separately and independently**: the compiled class vocabulary is stale against
  the delivered artifact (`built-artifact/ui-workspace-lib-client-js.txt`:
  `bytes=200414`, `sha256=e9b6815b2469e7cee8dafe92d42e76b70a0f016e8e52c98e38a11d2cef39cc07`,
  `_6kVdha_title` present, `W0d-vW` 0 hits). That is an artifact/string fact; it is not a
  diagnosis of the live miss.
* `shot-E2-ordinary.png` is **E2-only corroboration** (the one passing leg).
* Ordering, stated exactly (`dod20-ui-driver.mjs`): `runLiveDriver` launches the
  BrowserServer (`chromium.launchServer` at :1911, loopback, ephemeral port, sandbox on) and
  *then* calls `runDriverCore` (:1933); `readWorkspaceGroups` + `canonicalTargets` run at
  :1289-1291 **inside** `runDriverCore`. So **canonicalTargets runs before any browser leg,
  not before the BrowserServer is launched.** The claims it supports are correspondingly
  "no navigation leg uses an unresolved identity", not "nothing browser-shaped happens
  before identity resolution".

## Net effect on the round-2 verdict

Nothing above changes the offline results: the identity suite is 22/22, the six focused
suites are green, and the three repaired defects (positional traversal, unscoped collector,
leaf-counted row identity) are genuinely closed against the faithful DOM at the pinned
fixture. What changes is only how far those results may be spoken about: they are
**fixture-scoped, offline, differential** evidence about driver seams — not a live
acceptance result, not a green root suite, and not a causal account of the October-5th
live miss.
