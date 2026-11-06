# a5sf-preflight-order — the five instrument defects that each burned a Host start

**Date**: 2026-11-08 (session calendar; real UTC 2026-11-07)
**Task**: `task/a5sf-order-20261108`
**Base**: `origin/master` = `bab33c4c6d011da830e02a39339eee1fc0543d7f` at worktree creation
**Boots spent**: **0**. This evidence is host-free: no port, no DSH_HOME, no pristine checkout
write, no `harness.boot(`.
**Scope**: extend the existing shared preflight; no new harness, no second entry point.

The shared preflight (`tests/world-factory/lib/a5sf-acceptance-preflight.mjs`, entry
`scripts/a5sf-preflight.mjs`) passed **13/13** immediately before BL-17 boot 3 burned an
allocation. That is not an accident and not a missing assertion: every one of the 13 checks
inspected the bundle's **contents**. The five defects below are defects of **order** — a step,
gate or assertion that is correct in isolation but runs at the wrong time. A content check
cannot see them, and a route-string matcher would only catch the one driver that already
burned.

The five:

| # | Defect | Caught before this change? | Caught now by |
|---|---|---|---|
| 1 | composition handoff: emitted rows never reached `world.u6Fs.rows` | yes, by an existing content check | `assembly.usable` → `ASSEMBLY_ROW_HANDOFF_MISSING` |
| 2 | empty native-module config | yes | `native.module-config` → `NATIVE_MODULE_CONFIG_EMPTY` |
| 3 | missing `over-sample-cap` / `sampleOverCapGlobResults` | yes | `native.module-config` → `NATIVE_MODULE_CONFIG_EMPTY`; the case/fixture form is also `bundle.case-coverage` → `CASE_PLANNED_MISSING` / `CASE_FIXTURE_MISSING` |
| 4 | FIFO outside lane **and** two cases sharing a locator (allocation #1) | yes, both | `policy.fifo` → `POLICY_FIFO_OUTSIDE_LANE`; `cases.isolation` → `CASE_LOCATOR_ALIASED` / `CASE_GUARD_KEY_ALIASED` |
| 5 | pre-create state gate, and no body captured for it | **no** | `driver.gate-order` → `DRIVER_PRECONDITION_OUT_OF_ORDER` / `DRIVER_PRECONDITION_UNPRODUCED`; `driver.log-capture` → `DRIVER_GATE_BODY_NOT_CAPTURED` |

**No check was weakened.** The existing 13 keep their ids, findings and tests. The three new
checks add 3 ids (16 total) and one new top-level verdict (`UNKNOWN`).

---

## 1. The five defects, one by one

### 1.1 composition handoff — caught by an existing check, not re-added

`assembly.usable` already grades `assembly.rowHandoff`:

- `usesHandOverRows === true` (the single `handOverRows(world, rows)` seam),
- `beforeBoot === true` (the handover runs before `harness.boot(`),
- `emittedRowIds` **ordered identity** with `worldRowIds` (the attempt-1/2026-11-04 defect:
  `emitPatchLayer` returned text that never reached the World),
- `healthProbeRowPresent !== false` (no health row means the p6t6 route cannot answer).

**Not duplicated.** The composition handoff is a content/handoff defect and the existing
check names the exact loss. Its finding code is `ASSEMBLY_ROW_HANDOFF_MISSING` and its
negative controls are `D4` in `tests/world-factory/a5sf-acceptance-preflight.test.mjs`.

### 1.2 empty config — caught by an existing check, not re-added

`native.module-config` reads each module's `requiredConfig` and refuses an empty/missing
value (`NATIVE_MODULE_CONFIG_EMPTY`). This is the BL-16 attempt-4 defect (module mounted with
`config: {}`).

### 1.3 missing `over-sample-cap` / `sampleOverCapGlobResults` — caught twice, for two shapes

The literal BL-16 attempt-5 defect (required key `sampleOverCapGlobResults` absent) is the
same existing `native.module-config` check (`NATIVE_MODULE_CONFIG_EMPTY`); no new check was
needed for the config shape.

The *case/fixture* shape — a planned case whose declared inputs are not in the fixture set —
is new and is `bundle.case-coverage`: `CASE_PLANNED_MISSING` when a planned case is absent
from `bundle.cases`, and `CASE_FIXTURE_MISSING` when a tabled case has no row in
`bundle.fixtures`.

### 1.4 FIFO outside lane **and** two cases sharing a locator — both already caught

- `policy.fifo` refuses a FIFO outside `policy.effectiveReadAllow`
  (`POLICY_FIFO_OUTSIDE_LANE`; BL-16 attempt 6: a confined spawn of the FIFO is refused at
  admission, so the cancellation window never exists).
- `cases.isolation` refuses a shared locator (`CASE_LOCATOR_ALIASED`) **and** a shared
  guard-fact key (`CASE_GUARD_KEY_ALIASED`). The directive asked whether the guard-key case
  with **different locators** was covered. It was: the key map is separate from the locator
  map in `checkCaseIsolation`. `D23` in the test file is the proof (different locators, same
  `guardFactKey`, exactly one check red with `CASE_GUARD_KEY_ALIASED`). **No duplicate check
  was added**, and the existing one was not changed.

The one extension made here is a test, not a check: `D23` makes the already-implemented
guard-key clause load-bearing instead of incidental.

### 1.5 gate order (BL-17 boot 3) — new, and the reason for this task

The driver gated on `GET /__p6t6/state` **before** `team.create`. That route throws
`TEAM_RUNTIME_TEAM_SESSION_NOT_FOUND` on a root with no team session
(`packages/runtime/src/plugin/root.ts:3770-3777`), so the gate could never open. The second
half was that the state body was never recorded, so the first reading looked like a product
stall.

New checks:

- **`driver.gate-order`** — reads the driver plan's step list and enforces a **declared
  precondition**: a step with `requires: ["team-session"]` must appear after a step with
  `produces: ["team-session"]`. It never reads an action, route or label string, so the next
  driver can rename the route and the check still applies. The token vocabulary is open
  (`team-session`, `member`, `control-state` today), so a new artifact needs a declaration,
  not a module edit.
- **`driver.log-capture`** — every step that can fail (`canFail: true`, `gate: true`, or a
  declared `requires`) must declare `captures: ["body"]` (or `capturedBody: true`). A
  failure without a body cannot be diagnosed; that is exactly how defect 5's second half
  survived the first reading.

**Residual limitation, stated plainly**: `driver.log-capture` grades the **declaration**, not
the driver's runtime follow-through. A driver could declare `captures: ["body"]` and still
not write it. That residual half is not detectable without a boot, and this check does not
pretend otherwise. The host-free half — "the plan never asked for the body" — is detectable
and is a gate. A future runtime assertion (e.g. the driver's own HTTP helper refusing a
fail-capable call without a capture sink) is the only way to close the other half; it is not
claimed here.

---

## 2. New check semantics: `UNKNOWN` is not `PASS`

`PREFLIGHT_VERDICTS` is now `['PASS', 'FAIL', 'UNKNOWN']`.

A check is `UNKNOWN` when the bundle **does not declare the fact the check grades**:

- no `driver` / `driverPlan` / `plan` step list → all three new checks are `UNKNOWN`
  (`DRIVER_PLAN_UNDECLARED`);
- a plan with steps but no `requires` token → `driver.gate-order` is `UNKNOWN`
  (`DRIVER_PRECONDITIONS_UNDECLARED`);
- a plan with no `canFail`/`gate`/`requires` step → `driver.log-capture` is `UNKNOWN`
  (`DRIVER_FAIL_STEPS_UNDECLARED`);
- a plan with no `plannedCases` → `bundle.case-coverage` is `UNKNOWN`
  (`DRIVER_PLANNED_CASES_UNDECLARED`).

The top-level verdict is `FAIL` if any check failed, else `UNKNOWN` if any check is unknown,
else `PASS`. The CLI exits **0 only for `PASS`**, **1 for `FAIL`**, **3 for `UNKNOWN`**, and
**2** when the bundle/file cannot be read. The one-line shape keeps the existing tokens:

```
DSH-A5SF-PREFLIGHT {"schema":"a5sf-zero-boot-preflight/1","verdict":"PASS","summary":"PASS 16/16 checks",...}
DSH-A5SF-PREFLIGHT {"schema":"a5sf-zero-boot-preflight/1","verdict":"UNKNOWN","summary":"UNKNOWN 13/16 checks unknown=bundle.case-coverage,driver.gate-order,driver.log-capture",...}
```

The summary's `unknown=` tail names the undecidable checks. A reader grepping `PASS` cannot
mistake an undeclared bundle for a certified one.

**Why not `FAIL` for an undeclared plan?** Because `FAIL` is an accusation about the plan;
`UNKNOWN` is a statement about the instrument's knowledge. Today's evidence bundles predate
this schema and must not be rewritten (they are evidence), and the preflight must not
silently promote them. `UNKNOWN` is the only honest third answer.

`unknown` is also a top-level array of `{id, reason, detail}`, so an operator can see which
facts were never declared without parsing `checks`.

---

## 3. Negative controls (one per new check)

Each control is a deliberately defective bundle in
`negative-controls/`. Each one turns **exactly one** check red; every other check stays
`PASS`. The `.result.json` next to each bundle is the actual `DSH-A5SF-PREFLIGHT` payload
(the CLI's one-line output, pretty-printed, with the `inputs` block recording the exact
repo/host roots used). The suite test `D25` re-reads these committed bundles and asserts the
same one-red property, so the JSON cannot drift away from the code.

Files:

- `negative-controls/driver-gate-order.bundle.json` /
  `negative-controls/driver-gate-order.result.json`
- `negative-controls/driver-log-capture.bundle.json` /
  `negative-controls/driver-log-capture.result.json`
- `negative-controls/bundle-case-coverage.bundle.json` /
  `negative-controls/bundle-case-coverage.result.json`

### driver.gate-order

Input: [`driver-gate-order.bundle.json`](negative-controls/driver-gate-order.bundle.json) · result: [`driver-gate-order.result.json`](negative-controls/driver-gate-order.result.json)

```json
{
  "schema": "a5sf-zero-boot-preflight/1",
  "verdict": "FAIL",
  "checks": [
    {
      "id": "assembly.usable",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "identity.roots",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "identity.blueprints",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "identity.member-tool-binding",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "identity.authority",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "native.module-config",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "policy.paths",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "policy.fifo",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "cases.isolation",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "bundle.case-coverage",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "driver.gate-order",
      "verdict": "FAIL",
      "findings": [
        {
          "code": "DRIVER_PRECONDITION_OUT_OF_ORDER",
          "detail": "step \"read-control-state\" requires \"team-session\", produced by step \"create-team\" at position 3, but the requiring step is at position 1; the gate runs BEFORE its precondition exists (BL-17 boot 3: state gate before team.create)",
          "stepId": "read-control-state",
          "requires": "team-session",
          "producedBy": "create-team",
          "producerIndex": 2,
          "stepIndex": 0
        }
      ]
    },
    {
      "id": "driver.log-capture",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "collector.shape",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "wiring.candidate",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "wiring.grant",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "wiring.run-record",
      "verdict": "PASS",
      "findings": []
    }
  ],
  "findings": [
    {
      "code": "DRIVER_PRECONDITION_OUT_OF_ORDER",
      "detail": "step \"read-control-state\" requires \"team-session\", produced by step \"create-team\" at position 3, but the requiring step is at position 1; the gate runs BEFORE its precondition exists (BL-17 boot 3: state gate before team.create)",
      "stepId": "read-control-state",
      "requires": "team-session",
      "producedBy": "create-team",
      "producerIndex": 2,
      "stepIndex": 0
    }
  ],
  "unknown": [],
  "summary": "FAIL 15/16 checks blocks=DRIVER_PRECONDITION_OUT_OF_ORDER",
  "inputs": {
    "repo": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/a5sf-order",
    "hostRoot": "/home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-test-use",
    "hostPrefixRemapped": true
  }
}
```

### driver.log-capture

Input: [`driver-log-capture.bundle.json`](negative-controls/driver-log-capture.bundle.json) · result: [`driver-log-capture.result.json`](negative-controls/driver-log-capture.result.json)

```json
{
  "schema": "a5sf-zero-boot-preflight/1",
  "verdict": "FAIL",
  "checks": [
    {
      "id": "assembly.usable",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "identity.roots",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "identity.blueprints",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "identity.member-tool-binding",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "identity.authority",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "native.module-config",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "policy.paths",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "policy.fifo",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "cases.isolation",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "bundle.case-coverage",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "driver.gate-order",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "driver.log-capture",
      "verdict": "FAIL",
      "findings": [
        {
          "code": "DRIVER_GATE_BODY_NOT_CAPTURED",
          "detail": "step \"create-member\" can fail but does not declare captures: [\"body\"]; a failed gate would leave no diagnostic body (BL-17 boot 3's second half)",
          "stepId": "create-member",
          "captures": [
            "status"
          ]
        }
      ]
    },
    {
      "id": "collector.shape",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "wiring.candidate",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "wiring.grant",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "wiring.run-record",
      "verdict": "PASS",
      "findings": []
    }
  ],
  "findings": [
    {
      "code": "DRIVER_GATE_BODY_NOT_CAPTURED",
      "detail": "step \"create-member\" can fail but does not declare captures: [\"body\"]; a failed gate would leave no diagnostic body (BL-17 boot 3's second half)",
      "stepId": "create-member",
      "captures": [
        "status"
      ]
    }
  ],
  "unknown": [],
  "summary": "FAIL 15/16 checks blocks=DRIVER_GATE_BODY_NOT_CAPTURED",
  "inputs": {
    "repo": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/a5sf-order",
    "hostRoot": "/home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-test-use",
    "hostPrefixRemapped": true
  }
}
```

### bundle.case-coverage

Input: [`bundle-case-coverage.bundle.json`](negative-controls/bundle-case-coverage.bundle.json) · result: [`bundle-case-coverage.result.json`](negative-controls/bundle-case-coverage.result.json)

```json
{
  "schema": "a5sf-zero-boot-preflight/1",
  "verdict": "FAIL",
  "checks": [
    {
      "id": "assembly.usable",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "identity.roots",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "identity.blueprints",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "identity.member-tool-binding",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "identity.authority",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "native.module-config",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "policy.paths",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "policy.fifo",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "cases.isolation",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "bundle.case-coverage",
      "verdict": "FAIL",
      "findings": [
        {
          "code": "CASE_PLANNED_MISSING",
          "detail": "planned case \"over-sample-cap-row\" is absent from bundle.cases; the run would report a case it never planned, or spend a start on an untabled row (the missing over-sample-cap glob-results class)",
          "caseId": "over-sample-cap-row"
        },
        {
          "code": "CASE_FIXTURE_MISSING",
          "detail": "case \"read-a\" has no row in bundle.fixtures; its declared inputs are not in the fixture set (the missing over-sample-cap glob-results class)",
          "caseId": "read-a"
        }
      ]
    },
    {
      "id": "driver.gate-order",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "driver.log-capture",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "collector.shape",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "wiring.candidate",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "wiring.grant",
      "verdict": "PASS",
      "findings": []
    },
    {
      "id": "wiring.run-record",
      "verdict": "PASS",
      "findings": []
    }
  ],
  "findings": [
    {
      "code": "CASE_PLANNED_MISSING",
      "detail": "planned case \"over-sample-cap-row\" is absent from bundle.cases; the run would report a case it never planned, or spend a start on an untabled row (the missing over-sample-cap glob-results class)",
      "caseId": "over-sample-cap-row"
    },
    {
      "code": "CASE_FIXTURE_MISSING",
      "detail": "case \"read-a\" has no row in bundle.fixtures; its declared inputs are not in the fixture set (the missing over-sample-cap glob-results class)",
      "caseId": "read-a"
    }
  ],
  "unknown": [],
  "summary": "FAIL 15/16 checks blocks=CASE_PLANNED_MISSING,CASE_FIXTURE_MISSING",
  "inputs": {
    "repo": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/a5sf-order",
    "hostRoot": "/home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-test-use",
    "hostPrefixRemapped": true
  }
}
```

---

## 4. The BL-17 bundle: `UNKNOWN`, not `FAIL`, and not `PASS`

The bundle that passed 13/13 before defect 5 is
`dev/agent-workflow/evidence/a5sf-bl17-live/preflight-bundle.json` on branch
`task/a5sf-bl17-live-20261108` (commit `ee5014c60`). It is **not on master** — the
evidence/driver branch is unmerged. The exact gate command was therefore run with a
temporary, read-only symlink at that evidence path (removed immediately after the run; no
file under the real evidence directory was copied or edited):

```
node scripts/a5sf-preflight.mjs --bundle dev/agent-workflow/evidence/a5sf-bl17-live/preflight-bundle.json
```

Actual result (**exit 3**), saved as `bl17-live.exact-gate.result.json`:

```
UNKNOWN 13/16 checks unknown=bundle.case-coverage,driver.gate-order,driver.log-capture
```

For a run that does not depend on that symlink, the same bundle was also graded with
`--repo` pointing at its own worktree and `--host-root` at the pristine checkout; it produces
the same verdict and is saved as `bl17-live.result.json`:

```
node scripts/a5sf-preflight.mjs \
  --bundle /home/armourpiercer/projects/dsh-agent-team/.worktrees/a5sf-bl17-live/dev/agent-workflow/evidence/a5sf-bl17-live/preflight-bundle.json \
  --repo /home/armourpiercer/projects/dsh-agent-team/.worktrees/a5sf-bl17-live \
  --host-root /home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-test-use
```

The 13 content checks still pass; the three new order checks are `UNKNOWN` with
`DRIVER_PLAN_UNDECLARED`, because the bundle has no `driver.steps` and no
`plannedCases`/`fixtures` (it predates the schema).

**Does it now fail or still pass? Neither — it is `UNKNOWN`, and that is the correct
answer.** Three facts together:

1. The recorded bundle **never declared a step order**. It cannot certify that the state gate
   follows `team.create`, because it does not contain the step list at all. `PASS` would be a
   false certification.
2. The bundle is a record of the **pre-fix** driver, but the driver has since been fixed
   (the pre-create state read is now diagnostic, and the gate moved after `team.create`).
   `FAIL` would accuse a fixed driver using a stale instrument, which is exactly the
   attribution error this evidence is trying to end.
3. The bundle is **evidence** and must not be rewritten to add a plan. `UNKNOWN` preserves
   the artifact and says what the preflight can and cannot know about it.

What would make it `PASS`? Regenerate the bundle from the fixed driver with a declared
`driver.steps` list in which `create-team` produces `team-session` before
`read-control-state` requires it, and add `fixtures` for the cases. What would make it
`FAIL`? Feed the **pre-fix** order as a declared plan: `D18` and
`negative-controls/driver-gate-order.*` do exactly that and red only `driver.gate-order` with
`DRIVER_PRECONDITION_OUT_OF_ORDER`.

---

## 5. What the existing 13 already covered (no duplicates added)

| Existing check | Defect family it already covered | Finding codes |
|---|---|---|
| `assembly.usable` | composition handoff / row handover | `ASSEMBLY_ROW_HANDOFF_MISSING` |
| `native.module-config` | empty config; missing `sampleOverCapGlobResults` | `NATIVE_MODULE_CONFIG_EMPTY` |
| `policy.fifo` | FIFO outside the effective read lane | `POLICY_FIFO_OUTSIDE_LANE` |
| `cases.isolation` | shared locator; shared guard key (including different locators) | `CASE_LOCATOR_ALIASED`, `CASE_GUARD_KEY_ALIASED` |

No existing check was relaxed, renamed or removed. `bundle.case-coverage` intentionally
overlaps `cases.isolation` on the duplicate-id fact (`CASE_PLANNED_DUPLICATED` vs the
existing `CASE_ID_DUPLICATED`); the owner has not retired either, and keeping both means a
future refactor of one cannot silently drop the exactly-once guarantee.

---

## 6. Gates and measurements

All commands were run in `.worktrees/a5sf-order` on the branch; no Host was started.

| Gate | Result |
|---|---|
| preflight test file | `node --test tests/world-factory/a5sf-acceptance-preflight.test.mjs` → **54 pass / 0 fail** (was 46 tests in the file before the new D18–D25) |
| all `tests/world-factory/a5sf-*` (measured, not trusted) | `node --test --test-reporter=tap tests/world-factory/a5sf-*.test.mjs` → **411 pass / 0 fail before**; **419 pass / 0 fail after**. The brief said "411 before"; the measured pre-change value with the pristine host present is exactly **411**. Without the pristine checkout the same command reports 395 tests and 1 fail (`a5sf-tool-axis` unable to find the pinned baseline) — that is the environment, not this change; the host was symlinked into the fresh worktree only for the test run and is gitignored. |
| every `a5sf-*` test file (incl. `tests/a5sf-diag`) | `node --test ... $(find tests -name 'a5sf-*.test.mjs')` → **422 pass / 0 fail before**; **430 pass / 0 fail after**. |
| clean bundle | `PASS 16/16 checks`, exit 0 (`clean.result.json`) |
| BL-17 bundle | `UNKNOWN 13/16 checks`, exit 3 (`bl17-live.exact-gate.result.json` and the symlink-independent `bl17-live.result.json`) — see §4 |
| docs | `node scripts/doc-checks.mjs` → pass |
| whitespace | `git diff --check` → rc 0 |
| boots | 0 |

---

## 7. Which new check is most likely to save the next start, and which is weakest

**Most likely to save the next start: `driver.gate-order`.** It generalizes the exact defect
that cost the last start, and it does so over a declared vocabulary rather than a route
string. The failure mode — "gate before its artifact exists" — is structural, recurs in every
driver that adds a post-create read, and is invisible to every content check. The cost is one
declaration per gate; the benefit is that the next driver's order is graded before the start.

**Weakest: `driver.log-capture`.** It is a plan-level declaration check. It can prove that a
fail-capable step never asked for a body (the host-free half of defect 5), but it cannot
prove the driver writes the body it declares. A driver can satisfy it while still producing
an undiagnosable failure. That residual is not detectable without a boot, and this check does
not claim it. It is still worth keeping as a gate: a plan that does not even declare the body
is definitely undiagnosable, and that is a real pre-start red.

`bundle.case-coverage` sits in the middle: mechanical, high-signal for case/fixture drift, but
it only catches the class when the plan lists planned cases and fixtures. A driver that omits
both is `UNKNOWN`, not red — the honest limit of a declared-precondition design.

---

## 8. Files changed

- `tests/world-factory/lib/a5sf-acceptance-preflight.mjs` — +`bundle.case-coverage`,
  +`driver.gate-order`, +`driver.log-capture`, +`UNKNOWN` verdict, +plan reader.
- `scripts/a5sf-preflight.mjs` — exit 3 for `UNKNOWN`; doc only otherwise (still one line,
  same tokens, same `--bundle`/`--run-dir`/`--repo`/`--host-root` surface).
- `tests/world-factory/a5sf-acceptance-preflight.test.mjs` — D1/D16 count updates; D18–D25
  new controls, `UNKNOWN` semantics, guard-key-only isolation proof, CLI exit 3, and the
  committed-control re-read.
- `tests/world-factory/fixtures/a5sf-zero-boot-preflight-clean.json` — declares the plan and
  fixture rows (test fixture only; no real driver touched).
- `dev/agent-workflow/evidence/a5sf-preflight-order/**` — this README, the three negative
  controls, the clean and BL-17 result payloads.

No file under `dev/agent-workflow/evidence/**` that records a real run was modified. The
BL-17 bundle was read from its own worktree.
