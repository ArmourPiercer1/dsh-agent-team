# Round 109 — Stage-A closure: full typed replies, the dual-host candidate gate, and HEAD binding

**Dated**: 2026-11-24 (real UTC) · review `20261125-0058` (session calendar) · branch `vnext/a1-cut` ·
PR **#822 (DRAFT, unmerged)** · worktree `.worktrees/vnext-a1-cut` only · `:3080` and its DSH_HOME
untouched · no other worktree touched · no history rewrite, no merge, no non-topic push.

**Measurement head:** `41d5791195d199190c8d808d321aaa8e4dbca030` **plus this round's working-tree arm**
(observation-only driver record + the workflow/manifest change + documentation; the child commit is
named in the settlement comment). Hosts: rc.2 (`TEAM_TEST_HOST` unset,
`tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84` = `0.2.0-rc.2`) and
rc.5 (`TEAM_TEST_HOST=next`, `tests/deepseek-harness-next` @
`9c2670d3bce5275e0d1610272958121af87787bb` = `dsh-v0.2.2-rc.5`), each provisioned and built locally.

## 1. Driver observability — the FULL typed replies are now in the evidence file

Review `20261125-0058` task 1 asked the `d2:remote-delivery` driver to record the complete typed
`member.archive` / `member.send` / `member.restore` replies — `ok`, `code`, `message`, `lifecycle`,
request ids — in the judge's evidence file, not only derived booleans.

`tests/world-factory/drivers/d-boot-feasibility/run-boot-d2.mjs` now carries `observedReply()`
(`:253-289`) and records it as `archiveReply`, `sendReply` (archived target), `restoreReply` and
`sendReply` (restored target). Each record is
the whole host envelope: `httpStatus`, `transportError`, the answered **`rpcId`**, `envelopeType`,
`result.ok`, the **verbatim `result.error` object** (every field the host wrote, including
`details.cause.lifecycle` / `details.cause.accepting` / `details.requestToken`), the full
`result.value`, and a `truncated` flag (bound 16,384 chars; below it nothing is dropped). The same
objects are printed in the driver log (`member.archive FULL reply: …`).

**It is pure observability.** The diff against `41d579119` is 61 inserted lines and zero changed
lines; `judgeRemoteDelivery` (`:1165` region) is untouched, every clause asserts exactly the same
fields, no judge is skipped, no timeout widened, no retry added, no `KNOWN_REFUTED` entry added.
The committed driver is byte-identical to the one the gate ran: `sha256
389b3343f642c0da8156257971c73a28520cfe0e586133003dd8254296949187`, the value in the gate's own
`next/d2/driver-digest.json`.

### rc.5, boot 1 — recorded objects (verbatim from `d2/runs/boot01/remote-delivery.json`)

`member.archive` — accepted, the member really reaches `ARCHIVED`:

```json
{
  "archiveStatus": 200,
  "archiveOk": true,
  "lifecycle": "ARCHIVED",
  "archiveReply": {
    "httpStatus": 200,
    "transportError": null,
    "rpcId": "d2rd-t7wbdnj5y7",
    "envelopeType": "server-response",
    "ok": true,
    "code": null,
    "message": null,
    "error": null,
    "value": {
      "data": {
        "member": {
          "schemaVersion": 1,
          "rootSessionId": "session-dboot-d2-root",
          "instanceId": "inst-12x4j4t1rn1g",
          "templateId": "worker-b",
          "label": "dboot-d2-worker-b",
          "childSessionId": "session-team-child-ce84089af9f38ed55ba2d0bdf5442691",
          "lifecycle": "ARCHIVED",
          "createdAt": "2026-11-24T18:15:41.547Z",
          "activityVersion": 14,
          "workspace": "…/tests/homes/u5u5a5sfdev1-20261124T18-13-54Z-next/workspace/team-b"
        },
        "steps": [
          "close-admission",
          "interrupt",
          "drain-descendants",
          "wait-quiescence",
          "release-residency",
          "commit-archive"
        ],
        "settledCommitted": false,
        "drained": 0,
        "residencyDropped": true
      },
      "provenance": {
        "origin": "team-remote",
        "method": "member.archive",
        "endpoint": "member.archive",
        "contractVersion": 1,
        "requestToken": null,
        "projectionGeneration": null,
        "effectSequence": null
      }
    },
    "truncated": false
  }
}
```

`member.send` to the ARCHIVED target — typed refusal, zero requests added:

```json
{
  "status": 200,
  "ok": false,
  "code": "TEAM_RUNTIME_WORK_STATE_REJECTED",
  "requestsAdded": 0,
  "sendReply": {
    "httpStatus": 200,
    "rpcId": "d2rd-j75cjyiovg",
    "envelopeType": "server-response",
    "ok": false,
    "code": "TEAM_RUNTIME_WORK_STATE_REJECTED",
    "message": "TeamRuntime: the work target is ARCHIVED — work is accepted only in CREATED/RUNNING/SETTLED (an ARCHIVED target needs an explicit restore first, invariant 53)",
    "error": {
      "code": "TEAM_RUNTIME_WORK_STATE_REJECTED",
      "message": "TeamRuntime: the work target is ARCHIVED — work is accepted only in CREATED/RUNNING/SETTLED (an ARCHIVED target needs an explicit restore first, invariant 53)",
      "details": {
        "method": "member.send",
        "endpoint": "member.send",
        "contractVersion": 1,
        "requestToken": "dboot-d2-remote-send-archived",
        "reason": "domain-error",
        "cause": {
          "code": "TEAM_RUNTIME_WORK_STATE_REJECTED",
          "message": "TeamRuntime: the work target is ARCHIVED — work is accepted only in CREATED/RUNNING/SETTLED (an ARCHIVED target needs an explicit restore first, invariant 53)",
          "details": { "lifecycle": "ARCHIVED", "accepting": ["CREATED", "RUNNING", "SETTLED"] }
        }
      }
    },
    "value": null,
    "truncated": false
  }
}
```

`member.restore` — accepted, back to `SETTLED`:

```json
{
  "restoreStatus": 200,
  "restoreOk": true,
  "restoredLifecycle": "SETTLED",
  "restoreReply": {
    "httpStatus": 200,
    "rpcId": "d2rd-sme4nwgij4",
    "envelopeType": "server-response",
    "ok": true,
    "code": null,
    "message": null,
    "error": null,
    "value": {
      "data": {
        "member": { "schemaVersion": 1, "instanceId": "inst-12x4j4t1rn1g", "templateId": "worker-b",
                    "childSessionId": "session-team-child-ce84089af9f38ed55ba2d0bdf5442691",
                    "lifecycle": "SETTLED", "createdAt": "2026-11-24T18:15:41.547Z",
                    "activityVersion": 15 },
        "steps": ["commit-restore"]
      },
      "provenance": { "origin": "team-remote", "method": "member.restore", "endpoint": "member.restore",
                      "contractVersion": 1, "requestToken": null, "projectionGeneration": null, "effectSequence": null }
    },
    "truncated": false
  }
}
```

`member.send` after the restore — accepted (`ok=true`, `error=null`, `value.data.outcome.status=delivered`):

```json
{
  "status": 200,
  "ok": true,
  "code": null,
  "sendReply": {
    "httpStatus": 200,
    "rpcId": "d2rd-0r3qvgdbxy",
    "envelopeType": "server-response",
    "ok": true,
    "code": null,
    "message": null,
    "error": null,
    "value": { "data": { "outcome": { "status": "delivered", "recipientInstanceId": "inst-12x4j4t1rn1g",
                                     "requestToken": "dboot-d2-remote-send-restored", "factSequence": 45,
                                     "deliveredSequence": 46 } } },
    "truncated": false
  }
}
```

### Both boots agree; only the RPC ids differ

| object | boot01 | boot02 |
| --- | --- | --- |
| `member.archive` rpcId / ok / lifecycle / steps | `d2rd-t7wbdnj5y7` / true / `ARCHIVED` / 6 extract steps | `d2rd-njil82qemi` / true / `ARCHIVED` / identical steps |
| archived `member.send` rpcId / ok / code / requestsAdded | `d2rd-j75cjyiovg` / false / `TEAM_RUNTIME_WORK_STATE_REJECTED` / 0 | `d2rd-t8ga2jngu` / false / `TEAM_RUNTIME_WORK_STATE_REJECTED` / 0 |
| `member.restore` rpcId / ok / lifecycle | `d2rd-sme4nwgij4` / true / `SETTLED` | `d2rd-znqvt013cv` / true / `SETTLED` |
| restored `member.send` rpcId / ok / error | `d2rd-0r3qvgdbxy` / true / null | `d2rd-l26h6mne9y` / true / null |

`d2`'s `agreement.json`: `agreeing=true`, `boots=2`, `differing=[]`. The `d2:remote-delivery` case is
**PASS with 20/20 clauses on each boot**, including `archived-member-refused-typed`,
`restore-reenables-delivery`, `member-execution-completed` and `no-operator-identity-in-member-ledger`.

## 2. Dual-host Candidate Gate — PASS

`node scripts/candidate-acceptance-gate.mjs --hosts both`, run at `41d579119` + the arm above, measured
**17:17:46 → 18:41:34 UTC = 83 m 48 s** of wall clock. Machine verdict:
`dev/agent-workflow/evidence/candidate-acceptance-gate/2026-11-24T17-17-46-158Z/verdict.json`.

```
CANDIDATE-GATE PASS at 2026-11-24T17:17:46.158Z
head=41d5791195d199190c8d808d321aaa8e4dbca030 hosts=legacy,next timeout=2700000ms boots=2

CANDIDATE-GATE pass host=legacy judges=31 proven=30 known-refuted=1 env-limited=0 drivers=4 records=8 agreement=true
  d   pass judges=6 proven=6 known-refuted=0 env-limited=0 exit=0 RESULT PASS (2/2 boots; agreeing pair=true)
  d2  pass judges=4 proven=4 known-refuted=0 env-limited=0 exit=0 RESULT PASS (2/2 boots; agreeing pair=true)
  d3  pass judges=4 proven=4 known-refuted=0 env-limited=0 exit=0 RESULT evidence-complete=true allProven=true (2/2 boots; agreeing pair=true)
  d4  pass judges=17 proven=16 known-refuted=1 env-limited=0 exit=3 RESULT evidence-complete=true allBooted=true blocked=true runRecordsValid=true (2/2 boots; agreeing pair=true)

CANDIDATE-GATE pass host=next judges=31 proven=30 known-refuted=1 env-limited=0 drivers=4 records=8 agreement=true
  d   pass judges=6 proven=6 known-refuted=0 env-limited=0 exit=0 RESULT PASS (2/2 boots; agreeing pair=true)
  d2  pass judges=4 proven=4 known-refuted=0 env-limited=0 exit=0 RESULT PASS (2/2 boots; agreeing pair=true)
  d3  pass judges=4 proven=4 known-refuted=0 env-limited=0 exit=0 RESULT evidence-complete=true allProven=true (2/2 boots; agreeing pair=true)
  d4  pass judges=17 proven=16 known-refuted=1 env-limited=0 exit=3 RESULT evidence-complete=true allBooted=true blocked=true runRecordsValid=true (2/2 boots; agreeing pair=true)

CANDIDATE-GATE pass hosts=legacy,next judges=62 proven=60 known-refuted=2 env-limited=0
```

The **only** non-PROVEN judge on each host is the single enumerated literal
`d4:ask-execute-process` (`knownRefuted` total 2 = the same id counted once per host). Nothing was
added to `KNOWN_REFUTED`; the gate script is unchanged this round. No known-refuted id was widened.

## 3. Workflow HEAD binding (review §4.2)

`.github/workflows/candidate-acceptance.yml`:

- **Trigger** — `pull_request: [labeled, synchronize, reopened]` (branches `[master]`) plus
  `workflow_dispatch`, replacing `[labeled]` only. A push to a labelled PR now produces a run for the
  new HEAD instead of leaving the previous HEAD's context as the last visible result.
- **Gate on label presence** — the job's `if:` is
  `github.event_name == 'workflow_dispatch' || (github.event_name == 'pull_request' && contains(github.event.pull_request.labels.*.name, 'candidate-acceptance'))`.
  `github.event.label.name` only exists on `labeled`, so the presence test is what makes
  `synchronize`/`reopened` honest.
- **HEAD carried by the check** — job name: `candidate-acceptance (NOT Required) head=${{ github.sha }}`;
  artifact name `candidate-acceptance-${{ github.sha }}-${{ github.run_id }}`; `actions/checkout` is
  pinned to `ref: ${{ github.sha }}`.
- **HEAD asserted** — a new `Bind the graded head` step prints
  `CANDIDATE-GATE head=<graded> github.sha=<sha> checked-out=<sha>` and fails the run unless the
  checked-out HEAD **and** the verdict's own `head` both equal `github.sha`. A separate
  `Mark the gate start` step makes the artifact itself required to be fresh (`find … -newer`), so a
  leftover verdict from another commit (or another run) cannot be read as this HEAD's result.
- **Still non-required** — `ci-required`'s layer list is untouched; the job remains declared in
  `dev/ci/eb3-ci-manifest.json#knownNonRequired`, whose reason now names the
  `labeled/synchronize/reopened` trigger and the `github.sha` binding. `eb3-ci-required` reports
  `pass workflows=11 findings=0`.

## 4. Cost disclosure (review §4.3)

Measured, not estimated: **83 m 48 s** for one dual-host run (this round, `17:17:46 → 18:41:34`), and
74 m 41 s for the earlier round-105 pair. That is deliberately heavier than the whole daily Required
set (the ten-leg `ci-pr-gate --full` is a few minutes). Stated in the workflow header, in the
manifest's `knownNonRequired` reason, in `D-ACCEPTANCE-REPORT.md` and in `CAPABILITY-MATRIX-C.md`.
It is the reason the layer must never become a merge gate for an unrelated PR.

## 5. What this round does NOT do

- No row moves to **PRODUCT-PROVEN**. The gate is **non-required by owner ruling**; a row becomes
  gate-backed only when the gate is REQUIRED by branch protection **and** green at the final head.
- The gate is not added to `ci-required`, not made a branch-protection context, and not flipped to
  ready: PR #822 stays **DRAFT**.
- `KNOWN_REFUTED` still holds exactly one literal id (`d4:ask-execute-process`); no exemption was
  widened and no judge predicate was relaxed.

## 6. Gates at `41d579119` + the arm (logs in this directory)

| gate | verdict |
| --- | --- |
| `dispatch-tests --run --leg ute-vnext-a1` | `tests=251 pass=248 fail=0 skipped=3`, `set=sha256:edd4f1c4…` **unchanged** (the driver edit adds no test) — `gate-dispatch-tests.log` |
| `test-catalog --max-uncollected 41 --max-excluded 7` | `tests=785` collected 733 excluded 14 **uncollected 38** digest `sha256:da8a452d…` `refused=0 findings=0` — **no new scannable-surface file**, measured delta **0** (the new `round109/README.md` is evidence prose, not a suite; no test file was added or renamed) |
| `ute-cut-closure --check` | `pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 retiredSurfaces=12 findings=0` |
| `ute-p0-assets --check` | `pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 cut=cut(148/148) findings=0` |
| `docs-sync --check` | `docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20` (authority pointer digest verified) |
| `place-dist-glue` | `done (35 placement(s))`, every line byte-identical |
| `eb3-ci-required` | `pass workflows=11 findings=0` (the trigger/`github.sha` change and the manifest reason keep the workflow declared non-required and its leg intact) |
| bound vitest leg `eb3-security-run --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt` | `verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0` — `gate-bound-vitest.log` |
| UTE G1 nine-file argv (`node --test --test-force-exit --test-timeout=480000 --test-reporter=spec` over `tests/ute1-fs/native-fs-binding.test.mjs` + the six `lane-suite.test.mjs` + `refusal-categories` + `product-route-image`) | `tests 89 pass 89 fail 0 skipped 0` — `ute-g1-argv.log` |
| `ute-a1-window --check` | `pass branch=vnext/a1-cut red=0/0 cut=(148/52) findings=0` |
| `eb3-run-manifest` | `pass records=568 strict=0 incomplete=11 findings=0` — `gate-eb3-run-manifest.log` |
| `ci-pr-gate --full --census-captures 2` | **`DSH-CI-VERDICT pass pass=10 fail=0 skip=0 legs=10 refused=0`** (285.7 s; census `599f/7424l`, two captures with **identical identity sets**) — `ci-pr-gate-full.log` |

**Changed files this round:** `tests/world-factory/drivers/d-boot-feasibility/run-boot-d2.mjs`
(observation only, byte-identical to the driver the gate ran),
`.github/workflows/candidate-acceptance.yml`, `dev/ci/eb3-ci-manifest.json` (reason string only),
`dev/agent-workflow/evidence/ute-a1/D-ACCEPTANCE-REPORT.md`,
`dev/agent-workflow/evidence/ute-a1/CAPABILITY-MATRIX-C.md`, plus this evidence directory.

## 7. What remains open

- **The gate is non-required.** Making it a Required context is the owner's act; until then no row is
  PRODUCT-PROVEN. Nothing in this round moves a level.
- The capability gaps of `D-ACCEPTANCE-REPORT.md` §10 (current form: the root-work commands G4, rc.5
  pre-dispatch-abort wiring G5, `member.create`/`member.followup` live evidence G6, ENV-LIMITED census
  arms G7, operator model G8, scripted model G9) are unchanged by this round.
- `d4:ask-execute-process` stays REFUTED and enumerated; it is the approved Subprocess/PTY scope, not
  a pending fix.

**Post-commit re-run at the round-109 feature head `6ef5394b3`** (logs `*-postcommit.log`): `docs-sync --check`
`193/0 findings`, `ute-cut-closure` `cut(0/148)`, `ute-p0-assets` `cut(148/148)`, `place-dist-glue` 35
placements byte-identical, `eb3-ci-required` `11/0`, `test-catalog` `785 / 38 uncollected / 14 excluded`
(digest `sha256:da8a452d…` unchanged), `ute-a1-window` pass, `eb3-run-manifest` `records=600 strict=0
incomplete=11 findings=0`, the `ute-vnext-a1` leg `251/248/0/3` (`sha256:edd4f1c4…` unchanged), and
`ci-pr-gate --full --census-captures 2` **`pass=10 fail=0`** (283.3 s, census `599f/7424l`, identical
identity sets).
