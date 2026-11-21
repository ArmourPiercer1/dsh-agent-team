# UTE G1 — `dsh.ui-family` + `dsh.agent-state-family`, Stage B1 (non-retirement record)

**Date:** 2026-11-21 · **Branch:** `task/ute3-uistate-b1-20261121` · **Host pin:** `0.2.0-rc.2 @ 639ed015397290b3745d163aafe02ffee4aa3f84` (`tests/paths.mjs`)

This record is the evidence pointer for both new retirement-ledger rows. It is written so a
reader who does not trust this lane can re-derive every claim from the committed transcripts in
this directory:

| File | What it is |
| --- | --- |
| `composition-probe.txt` | Stage 0: definition sites, product-route reachability, legacy-plane claim, per-member machine tokens |
| `capture-run-1.txt`, `capture-run-2.txt` | two complete old-path captures (byte-identical) |
| `negative-controls.txt` | the per-member + harness control transcript (`NC-VERDICT GREEN`) |
| `../../../../tests/ute-g1-uistate/golden/old-path.tsv` | the frozen baseline (69 vectors) |
| `../../../../tests/ute-g1-uistate/golden/old-path.meta.txt` | fixture identity |
| `../../../../tests/ute-g1-uistate/golden/COVERAGE.md` | member → vectors → controls → refusal classes |

## 1. Stage 0 — two implementations, and neither family is on the product route

`composition-probe.txt` prints one token per census member:

```
PROBE-UISTATE family=ui member=ask_user_question two-implementations=yes legacy=packages/tools/ui-family/src/ask-row.mjs:130 native=packages/interaction/tool-ask-user/lib/index.js:67
PROBE-UISTATE family=ui member=present two-implementations=yes legacy=packages/tools/ui-family/src/present-row.mjs:60 native=packages/deliverables/tool-present/lib/index.js:24
PROBE-UISTATE family=agent-state member=todo_write two-implementations=yes legacy=packages/tools/agent-state-family/src/executors.mjs:303 native=packages/todo/tool-todo/lib/index.js:96
PROBE-UISTATE family=agent-state member=create_goal two-implementations=yes legacy=packages/tools/agent-state-family/src/executors.mjs:329 native=packages/goal/tool-goal/lib/index.js:276
PROBE-UISTATE family=agent-state member=get_goal two-implementations=yes legacy=packages/tools/agent-state-family/src/executors.mjs:343 native=packages/goal/tool-goal/lib/index.js:265
PROBE-UISTATE family=agent-state member=update_goal two-implementations=yes legacy=packages/tools/agent-state-family/src/executors.mjs:349 native=packages/goal/tool-goal/lib/index.js:302
PROBE-UISTATE family=agent-state member=exit_plan_mode two-implementations=yes legacy=packages/tools/agent-state-family/src/executors.mjs:371 native=packages/plan/plan-mode/lib/index.js:232
```

The same transcript measures the product route-C composition (`mountMemberA5sfRealm` +
`attachA5sfNativeToolModules`) with the shipped `nativeToolModules: []` configuration:

* every one of the seven names is **unregistered**: `dispatch="Error: unknown tool \"<name>\""`,
  `providerCalls=0`, `inheritedServiceCalls=0`, `guardFacts=0`;
* with the shipped preset topology, route-C shadows exactly ONE ui name (`present`, because
  `hostPresentSpecOf` re-mounts the pinned `@deepseek-ai/dsh-tool-present` on the confined face):
  in-lane publish succeeds (`Presented <route-tmp>/inside/report.md`, `denyFacts=0`), an
  out-of-lane target is refused with a deny guard fact (`denyFacts=1`);
* `ask_user_question` is absent from the product Member preset by PD-25 (`cordis.patch.yml:265`);
* the other four agent-state names are served on the preset by the **host** packages
  (`tool-todo`, `tool-goal`, `plan-mode`), not by the governed family.

The legacy governed plane **does** claim every booked spelling — `packages/tools/families/ui.mjs:67`
(`claims: () => [ASK_USER_QUESTION_NATIVE_NAME, PRESENT_NATIVE_NAME]`) and
`packages/tools/families/agent-state.mjs:93` (`claims: () => [...AGENT_STATE_NAMES]`) — behind
opt-in closed booleans (`uiFamilyEnabled`, `agentStateEnabled`; **absent = FALSE**). The natexe
names gate (`verifyPlaneNames`, `team-tool-plane.mjs:393`) is not their route: it answers
`PLANE_NAMES_INVALID` for every member key, because that map is closed to the plane's own
`grep/glob/bash/read` classes. So neither family is reachable on the product route **and** the
governed plane is a live, separately-mounted implementation of the same seven spellings.

## 2. Why this is NOT a retirement

`RetireAllowed = OldBaseline ∧ NewPathVerified ∧ SemanticDifferencesResolved ∧ NegativeControlsPass`

* **OldBaseline = TRUE.** `tests/ute-g1-uistate/golden/old-path.tsv` freezes 69 (request → effect)
  vectors — 10 `ask_user_question` + 12 `present` + 10 `todo_write` + 8 `get_goal` + 10
  `create_goal` + 13 `update_goal` + 7 `exit_plan_mode` — covering success-with-effect, wrong
  input, permission withheld, abort and (for ask) the expired deadline, for every census member.
  Effects are corroborated independently of the row: UI by the injected PORT's own call log plus a
  fresh `stat` of every anchored path; agent-state by reading the durable store's record back
  (`stateOf`) and its own `attempts`/`writes` ledger. Two consecutive captures are byte-identical.
* **NewPathVerified = FALSE, deliberately.** This lane delivers no replacement. There is nothing
  to verify against: route-C serves none of these names from a governed path, and no next-host
  enumerator exists; no new-path enumerator is implemented anywhere in this tree. `NEW-PATH-ABSENT` — zero `NEW-PATH-VECTOR` `<id>` PASS lines are claimed, and
  the gate must refuse the term with `UTE_NEW_PATH_UNVERIFIED` plus one `UTE_VECTOR_UNREPRODUCED`
  per baseline vector and `UTE_MEMBER_UNCOVERED` on this axis.
* **SemanticDifferencesResolved = FALSE.** Seven measured, blocking differences are recorded in the
  ledger row (`two-implementations`, `refusal-vocabulary`, `result-envelope`,
  `present-receipt-turn`, `timed-pending-shape`, `state-sink`, `product-route-absent`), each with
  `approval: null`. No owner approval exists, so the term cannot be true.
* **NegativeControlsPass = TRUE.** `negative-controls.txt` prints one `NC-MEMBER <member>` line per
  census member and `NC-VERDICT GREEN controls=13 failed=0`. Each member control mutates exactly
  one load-bearing fact and re-runs the same vector; it passes only when the resulting row
  diverges from the frozen golden row in the claimed field(s):
  the injected port removed (ask), the governed root widened so the out-of-lane target becomes
  in-lane (present), the lane verdict flipped to allow (todo_write), the caller moved to the scope
  the goal was planted under (get_goal), a direct-human origin given to the model arm (create_goal),
  the current revision sent instead of the stale one (update_goal), plan mode planted active
  (exit_plan_mode). The six harness controls show the harness itself bites: a flipped cell fails
  the comparison, an unmapped code raises `REFUSAL_VOCABULARY_INCOMPLETE`, the exclusion set is
  load-bearing, a faulted store turns an admitted `todo_write` into `AGENT_STATE_STORE_FAULT` with
  zero writes, a stripped publication witness fails the comparison, and every committed allow row
  carries its durable readback.

UNKNOWN is never PASS: both rows are `state: "NOT_RETIREABLE"`.

## 3. Refusal vocabulary

The nine categories are IMPORTED from `tests/ute-g1-fs/lib/refusal-categories.mjs` (never forked);
the family-local map (`tests/ute-g1-uistate/lib/refusal-map.mjs`) is total-or-loud: 32 observed
codes → 6 categories, and an unmapped code raises `REFUSAL_VOCABULARY_INCOMPLETE`. Three categories
are **not** reachable and are printed as a declared exclusion set rather than folded into `unknown`:

* `read-before-write` — neither family exposes a write that requires a prior read; the goal rows
  read fresh state inside the store transaction, so a stale observation is `stale-version`
  (measured by `AS-U8-stale-revision`);
* `route-unresolved` — a missing backend is refused at MOUNT time
  (`PLANE_AGENT_STATE_STORE_MISSING`), so no call-level route refusal is observable; the UI port
  absence is refused by the ROW (`unsupported-mode`, measured by `UI-A8-port-absent`);
* `unknown` — every observed code is explicitly mapped with a citation; there is no default bucket
  and no prose fallback.
