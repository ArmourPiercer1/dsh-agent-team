# UI + AGENT-STATE old-path coverage (UTE-3 / G1, Stage B1)

**Host pin:** `0.2.0-rc.2 @ 639ed015397290b3745d163aafe02ffee4aa3f84` (`tests/paths.mjs`) ·
**Golden:** `old-path.tsv` (69 rows) · **Fixture identity:** `old-path.meta.txt` ·
**Evidence:** `dev/agent-workflow/evidence/ute3-uistate-b1-20261121/`

The corpus is ONE file (`tests/ute-g1-uistate/lib/corpus.mjs`) because both families share one
governed world builder and one normalizer. Every census member has its own vectors, its own
`NC-MEMBER` control, and its own row in the retirement ledger; nothing is shared between the two
families' answers.

## 1. Members → vectors → controls

| family | member | vectors | classes | control |
| --- | --- | --- | --- | --- |
| ui | `ask_user_question` | 10 | success 2 · wrong-input 2 · permission 4 · abort 1 · deadline 1 | `ask-port-removed` |
| ui | `present` | 12 | success 2 · wrong-input 3 · permission 3 · missing 1 · cap 2 · abort 1 | `present-root-widened` |
| agent-state | `todo_write` | 10 | success 2 · wrong-input 4 · permission 3 · abort 1 | `todo-lane-allowed` |
| agent-state | `get_goal` | 7 | success 3 · wrong-input 2 · permission 1 · abort 1 | `get-goal-other-scope` |
| agent-state | `create_goal` | 10 | success 3 · wrong-input 4 · permission 2 · abort 1 | `create-arm-direct-human` |
| agent-state | `update_goal` | 13 | success 5 · wrong-input 2 · permission 5 · abort 1 | `update-revision-current` |
| agent-state | `exit_plan_mode` | 7 | success 1 · wrong-input 3 · permission 2 · abort 1 | `exit-plan-mode-seeded` |

Every member therefore has at least six vectors and carries the four required classes
(`success`, `wrong-input`, `permission`, plus `abort` or `deadline`). The suite derives the member
list from `dev/agent-workflow/ledgers/arc-a-family-census.json` — a member the census books but the
corpus omits fails, and a corpus member the census does not book fails too.

## 2. Per-member vectors

### `ask_user_question` — ui family, 10 vectors, control `ask-port-removed`

| vector | class | outcome | category | code |
| --- | --- | --- | --- | --- |
| `UI-A1-single-answer` | success | allow | — | — |
| `UI-A2-two-questions-multi` | success | allow | — | — |
| `UI-A3-unknown-parameter` | wrong-input | deny | invalid-argument | `ask-unknown-parameter` |
| `UI-A4-no-questions` | wrong-input | deny | invalid-argument | `ask-questions-required` |
| `UI-A5-lane-deny` | permission | deny | denied-by-lane | `template-deny-lane` |
| `UI-A6-pa-deny` | permission | deny | denied-by-lane | `ADMISSION_DENIED` |
| `UI-A7-template-default-deny` | permission | deny | denied-by-lane | `template-default-deny` |
| `UI-A8-port-absent` | permission | deny | unsupported-mode | `UI_INTERACTION_PORT_ABSENT` |
| `UI-A9-abort-in-port` | abort | cancelled | cancelled | `CANCELLED` |
| `UI-A10-timed-pending` | deadline | allow | — | — |

### `present` — ui family, 12 vectors, control `present-root-widened`

| vector | class | outcome | category | code |
| --- | --- | --- | --- | --- |
| `UI-P1-one-file` | success | allow | — | — |
| `UI-P2-two-files` | success | allow | — | — |
| `UI-P3-outside-root` | permission | deny | denied-by-lane | `locator-rejected` |
| `UI-P4-no-files` | wrong-input | deny | invalid-argument | `present-files-required` |
| `UI-P5-missing-file` | missing | deny | missing-path | `FILE_NOT_FOUND` |
| `UI-P6-directory` | wrong-input | deny | invalid-argument | `NOT_A_FILE` |
| `UI-P7-too-many-files` | wrong-input | deny | invalid-argument | `present-files-limit` |
| `UI-P8-lane-deny` | permission | deny | denied-by-lane | `template-deny-lane` |
| `UI-P9-pa-deny` | permission | deny | denied-by-lane | `ADMISSION_DENIED` |
| `UI-P10-receipt-without-turn` | cap | deny | unsupported-mode | `UI_PRESENT_RECEIPT_INVALID` |
| `UI-P11-abort-in-port` | abort | cancelled | cancelled | `CANCELLED` |
| `UI-P12-oversized` | cap | deny | unsupported-mode | `FILE_TOO_LARGE` |

### `todo_write` — agent-state family, 10 vectors, control `todo-lane-allowed`

| vector | class | outcome | category | code |
| --- | --- | --- | --- | --- |
| `AS-T1-write-three` | success | allow | — | — |
| `AS-T2-empty-list` | success | allow | — | — |
| `AS-T3-duplicate-content` | wrong-input | deny | invalid-argument | `AGENT_STATE_ARGS_INVALID` |
| `AS-T4-two-in-progress` | wrong-input | deny | invalid-argument | `AGENT_STATE_ARGS_INVALID` |
| `AS-T5-unknown-field` | wrong-input | deny | invalid-argument | `AGENT_STATE_ARGS_UNKNOWN` |
| `AS-T6-lane-deny` | permission | deny | denied-by-lane | `template-deny-lane` |
| `AS-T7-pa-deny` | permission | deny | denied-by-lane | `ADMISSION_DENIED` |
| `AS-T8-pa-cancelled` | abort | deny | cancelled | `CANCELLED` |
| `AS-T9-agent-required` | wrong-input | deny | invalid-argument | `TODO_WRITE_AGENT_REQUIRED` |
| `AS-T10-template-default-deny` | permission | deny | denied-by-lane | `IO_POLICY_UNSUPPORTED` |

### `get_goal` — agent-state family, 7 vectors, control `get-goal-other-scope`

| vector | class | outcome | category | code |
| --- | --- | --- | --- | --- |
| `AS-G1-empty` | success | allow | — | — |
| `AS-G2-seeded` | success | allow | — | — |
| `AS-G3-cross-scope` | success | allow | — | — |
| `AS-G4-unknown-field` | wrong-input | deny | invalid-argument | `AGENT_STATE_ARGS_UNKNOWN` |
| `AS-G5-lane-deny` | permission | deny | denied-by-lane | `template-deny-lane` |
| `AS-G6-agent-required` | wrong-input | deny | invalid-argument | `GOAL_TOOL_AGENT_REQUIRED` |
| `AS-G7-pa-cancelled` | abort | deny | cancelled | `CANCELLED` |

### `create_goal` — agent-state family, 10 vectors, control `create-arm-direct-human`

| vector | class | outcome | category | code |
| --- | --- | --- | --- | --- |
| `AS-C1-direct-human` | success | allow | — | — |
| `AS-C2-model-arm` | permission | deny | denied-by-lane | `GOAL_TOOL_NOT_DIRECT_HUMAN` |
| `AS-C3-already-exists` | success | deny | unsupported-mode | `GOAL_ALREADY_EXISTS` |
| `AS-C4-recreate-after-complete` | success | allow | — | — |
| `AS-C5-invalid-objective` | wrong-input | deny | invalid-argument | `GOAL_INVALID_OBJECTIVE` |
| `AS-C6-invalid-max-rounds` | wrong-input | deny | invalid-argument | `GOAL_INVALID_MAX_ROUNDS` |
| `AS-C7-unknown-field` | wrong-input | deny | invalid-argument | `AGENT_STATE_ARGS_UNKNOWN` |
| `AS-C8-pa-deny` | permission | deny | denied-by-lane | `ADMISSION_DENIED` |
| `AS-C9-agent-required` | wrong-input | deny | invalid-argument | `GOAL_TOOL_AGENT_REQUIRED` |
| `AS-C10-pa-cancelled` | abort | deny | cancelled | `CANCELLED` |

### `update_goal` — agent-state family, 13 vectors, control `update-revision-current`

| vector | class | outcome | category | code |
| --- | --- | --- | --- | --- |
| `AS-U1-edit-objective` | success | allow | — | — |
| `AS-U2-pause` | success | allow | — | — |
| `AS-U3-resume-unarmed` | success | allow | — | — |
| `AS-U4-resume-paused` | permission | deny | denied-by-lane | `GOAL_TOOL_RESUME_PAUSED` |
| `AS-U5-complete-goal-round` | success | allow | — | — |
| `AS-U6-blocked-below-threshold` | permission | deny | denied-by-lane | `GOAL_TOOL_BLOCK_THRESHOLD` |
| `AS-U7-blocked-at-threshold` | success | allow | — | — |
| `AS-U8-stale-revision` | permission | deny | stale-version | `GOAL_STALE_REVISION` |
| `AS-U9-pause-with-objective` | wrong-input | deny | invalid-argument | `GOAL_TOOL_INVALID_UPDATE` |
| `AS-U10-empty-edit` | wrong-input | deny | invalid-argument | `GOAL_INVALID_EDIT` |
| `AS-U11-no-completion-authority` | permission | deny | denied-by-lane | `GOAL_TOOL_NO_COMPLETION_AUTHORITY` |
| `AS-U12-pa-cancelled` | abort | deny | cancelled | `CANCELLED` |
| `AS-U13-pa-deny` | permission | deny | denied-by-lane | `ADMISSION_DENIED` |

### `exit_plan_mode` — agent-state family, 7 vectors, control `exit-plan-mode-seeded`

| vector | class | outcome | category | code |
| --- | --- | --- | --- | --- |
| `AS-E1-exit` | success | allow | — | — |
| `AS-E2-not-in-plan-mode` | permission | deny | unsupported-mode | `PLAN_MODE_NOT_ACTIVE` |
| `AS-E3-plan-without-heading` | wrong-input | deny | invalid-argument | `PLAN_MODE_PLAN_INVALID` |
| `AS-E4-unknown-field` | wrong-input | deny | invalid-argument | `AGENT_STATE_ARGS_UNKNOWN` |
| `AS-E5-agent-required` | wrong-input | deny | invalid-argument | `EXIT_PLAN_MODE_AGENT_REQUIRED` |
| `AS-E6-lane-deny` | permission | deny | denied-by-lane | `template-deny-lane` |
| `AS-E7-pa-cancelled` | abort | deny | cancelled | `CANCELLED` |

## 3. Refusal categories (closed, imported)

The nine categories are imported from `tests/ute-g1-fs/lib/refusal-categories.mjs` (never forked).
6 distinct codes were observed, landing in 6 categories:

| category | distinct codes | codes |
| --- | --- | --- |
| `cancelled` | 1 | `CANCELLED` |
| `denied-by-lane` | 9 | `ADMISSION_DENIED`, `GOAL_TOOL_BLOCK_THRESHOLD`, `GOAL_TOOL_NOT_DIRECT_HUMAN`, `GOAL_TOOL_NO_COMPLETION_AUTHORITY`, `GOAL_TOOL_RESUME_PAUSED`, `IO_POLICY_UNSUPPORTED`, `locator-rejected`, `template-default-deny`, `template-deny-lane` |
| `invalid-argument` | 15 | `AGENT_STATE_ARGS_INVALID`, `AGENT_STATE_ARGS_UNKNOWN`, `EXIT_PLAN_MODE_AGENT_REQUIRED`, `GOAL_INVALID_EDIT`, `GOAL_INVALID_MAX_ROUNDS`, `GOAL_INVALID_OBJECTIVE`, `GOAL_TOOL_AGENT_REQUIRED`, `GOAL_TOOL_INVALID_UPDATE`, `NOT_A_FILE`, `PLAN_MODE_PLAN_INVALID`, `TODO_WRITE_AGENT_REQUIRED`, `ask-questions-required`, `ask-unknown-parameter`, `present-files-limit`, `present-files-required` |
| `missing-path` | 1 | `FILE_NOT_FOUND` |
| `stale-version` | 1 | `GOAL_STALE_REVISION` |
| `unsupported-mode` | 5 | `FILE_TOO_LARGE`, `GOAL_ALREADY_EXISTS`, `PLAN_MODE_NOT_ACTIVE`, `UI_INTERACTION_PORT_ABSENT`, `UI_PRESENT_RECEIPT_INVALID` |

Three categories are **not** reachable; they are PRINTED as a declared exclusion set with their
measured reason instead of being folded into `unknown`:

| category | measured reason |
| --- | --- |
| `read-before-write` | no read-then-write contract exists in either family: `todo_write` replaces a whole list, the goal rows read fresh state INSIDE the store transaction (so a stale observation is `stale-version`, measured by `AS-U8-stale-revision`), and neither row exposes a write that requires a prior read |
| `route-unresolved` | the two families refuse a missing backend at MOUNT time (`PLANE_AGENT_STATE_STORE_MISSING` / an unbuilt family), so no CALL-level route refusal is observable from the rows themselves; the ui port absence is refused by the ROW (`unsupported-mode`, measured by `UI-A8-port-absent`) because the row exists and answers |
| `unknown` | every code the corpus observes is explicitly mapped with a citation; the map has no default bucket and no prose fallback, so an unmapped value raises `REFUSAL_VOCABULARY_INCOMPLETE` instead of landing here |

The suite asserts `reached ∪ excluded = the nine categories` and that a category declared excluded
is never actually reached.

## 4. Harness controls (what each turns red)

| control | mutation | what must move |
| --- | --- | --- |
| `compare-bites` | flip one compared cell in a golden row | the field comparison must report a drift on that field |
| `category-vocabulary-total` | feed one unmapped code | `REFUSAL_VOCABULARY_INCOMPLETE` |
| `category-coverage-declared` | declare a reached category as excluded | the coverage check reports `undeclaredReached` |
| `store-witness-load-bearing` | fault the store before an admitted `todo_write` | outcome becomes `AGENT_STATE_STORE_FAULT` with zero durable writes |
| `effect-witness-load-bearing` | strip the publication witness from an allow row | the row's design claim fails |
| `durable-readback-load-bearing` | drop the durable readback from an allow row | the row's design claim fails |

## 5. Why this lane delivers NO new path

Stage 0 (`composition-probe.txt`) measured that each booked spelling has **two** live
implementations — the governed family body and the pinned host tool package the product Member
preset already mounts — and that the product route-C composition registers **none** of the seven
names (`unknown tool`, `providerCalls=0`). Only `present` exists there, and only as the host shadow
`hostPresentSpecOf` re-mounts; `ask_user_question` is absent from the Member preset by PD-25.

There is therefore no replacement to verify. The retirement rows for both families are
`NOT_RETIREABLE`, `newPathVerified` is false with zero `NEW-PATH-VECTOR` lines claimed, and the
gate refuses both rows with `UTE_NEW_PATH_UNVERIFIED`, one `UTE_VECTOR_UNREPRODUCED` per baseline
vector and `UTE_MEMBER_UNCOVERED` per census member, plus
`UTE_SEMANTIC_DIFFERENCES_UNRESOLVED` for the seven measured, blocking, unapproved differences.
