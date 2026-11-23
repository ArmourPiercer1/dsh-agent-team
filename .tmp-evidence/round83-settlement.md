**[dated label settlement, 2026-11-23T02:25Z — round 83: work DELIVERY on the management plane; hosted verdict recorded in the follow-up comment]**

Head covered: `5c09cbd829c714095fbdba6a259af103c9f0080c` (`5c09cbd82`, branch `vnext/a1-cut`, PR #822 DRAFT, base `master`, never merged).

## What this head settles

Round 74 restored S6 Remote as a governed management plane but refused five commands as
`agent-execution`. This head keeps the boundary and delivers the three REAL product operations the only
lawful way — **the management plane may DELIVER work; it may never EXECUTE a tool** — by adding the third
SERVED effect class `work-delivery` to the SAME closed table
(`packages/runtime/src/plugin/s6-command-classification.ts`, no default-allow):

| command | class | path | operator receives |
| --- | --- | --- | --- |
| `member.create` | work-delivery | S6 admission port → `performAction({action:'create-member'})` → the ONE ActivationProvider | `member-activated` (creation only: no work chain, no turn, no tool) |
| `member.send` | work-delivery | S6 messaging port → P6-T3 coordinator: durable intent fact → input ACCEPTANCE into the recipient's own inbox → confirmation fact | `SendTeamMessageOutcome` (`status: delivered`, recipient, mode, `factSequence`, `deliveredSequence`) |
| `member.followup` | work-delivery | S6 admission port → `performAction({action:'follow-up', execution:'async'})`: Phase A commits the durable `team-work-admitted` receipt; Phase B/C run DETACHED in the Team runtime | the `work-admitted` receipt (`settled:false`) |
| `team.admitInitialWork` | agent-execution | **STILL REFUSED** — its only seam awaits the root turn to idle (root-scoped, no async enqueue exists) | `ADMISSION_REMOTE_UNAVAILABLE` + durable `team.control` deny + REFUSED/not-started |
| `team.ensureRootLive` | agent-execution | **STILL REFUSED** — starts an executor and returns no delivery acknowledgement | same |

A delivery command on a row with no delivery seam fails closed with the EXISTING
`ADMISSION_REMOTE_UNAVAILABLE` wire code, typed, before any claim/param/durable write; the refusal reason
was shortened so the settlement store's 512-char cap still holds (asserted by ADM-86).

## Boundary arms (host-free, both green)

- **ADM-86** rewritten in `packages/runtime/test/vnext-admission.test.mjs`: literal
  `S6_WORK_DELIVERY_COMMANDS = ['member.create','member.followup','member.send']` and
  `S6_AGENT_EXECUTION_COMMANDS = ['team.admitInitialWork','team.ensureRootLive']`; the dispatcher serves a
  control read + the three handovers (coordinator once, creation action once, follow-up once); the refusal
  hook is NEVER consulted for a delivery command; the plane has NO tool/provider port; the ACK carries no
  `toolResult|result|assistant|executionId`; the two root commands keep their durable refusal; the unwired
  seam is a typed refusal; unauthenticated is refused first.
- **E3** (`a3p4-pr4-production-entry-regression.test.ts`) at the production root: ONLY the two root
  commands are refused (facts on the row's own ledger), NO deny fact exists for a member command, and at
  `createS6RemotePorts` `member.followup` asks the facade for `execution:'async'`, `member.create` carries
  no execution mode, `member.send` reaches the coordinator.

## Live proof — D2 `d2:remote-delivery` PROVEN on two agreeing DEV-LIVE boots (`--boots 2`)

```
[ boot1] member.send ack: status=200 ok=true code=null deliveredSeq=40 facts=18 admissions=0 executions=0
[ boot1] member.send unknown member: ok=false code=TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED requestsAdded=0
[ boot1] member.send duplicate: ok=true distinct=true requestsAdded=0
[ boot1] member.send archived: lifecycle=ARCHIVED ok=false code=TEAM_RUNTIME_WORK_STATE_REJECTED requestsAdded=0
[ boot1] member.send restored: lifecycle=SETTLED ok=true code=null
[ boot1] delivered-stop: ackOk=true pending=true landed=true state=REFUSED refusal=ADMISSION_STOPPED
[ boot1] case d2:remote-delivery: PASS
agreeing=true differing=[]   overall PASS  cases 4/4 PASS
```

Measured facts (boot1; boot2 identical): the operator's `POST /team-remote/member.send` answered HTTP 200
with the coordinator's `delivered` acknowledgement (intent seq **39** / confirmation **40**), and AT that
acknowledgement the Member's delivered call had **0 admissions and 0 executions** — the request executed
nothing. The delivered prompt then ran in **Member B's own turn** (2 provider requests carrying the
delivered token) and the centre wrote its `allow` (`fs.read`, `instanceId = agentId = B`, B's in-lane
locator) into **B's own** `<instanceId>.facts.jsonl` (18 → 20 facts) **~113 ms AFTER** the ack, with a
`completed` execution and B's in-lane bytes in B's transcript. Error paths on the same row: unknown member
→ `TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED`; archived member → `TEAM_RUNTIME_WORK_STATE_REJECTED` (both
typed, zero provider requests, zero executions); duplicate send → a SECOND durable coordination
(at-least-once, not a token replay) with 0 provider requests at the ACK and still exactly ONE completed
execution for the delivered call; restore → delivery served again; Stop during a DELIVERED turn →
`ADMISSION_STOPPED` + REFUSED/not-started. The two-run agreement table now carries
`remoteDeliveryVerdict`, `deliveryAckIsNotAnExecution`, `deliveredTurnAdmittedUnderMemberBinding` and
`memberAdmissionFacts=1`.

## Required gates at this head (local, verbatim)

```
$ node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1
ℹ tests 206   ℹ pass 204   ℹ fail 0   ℹ skipped 2
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975

$ node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7
  tests=785 instruments=3 digest=sha256:da8a452d65130a3a7f62ef90b549a5289909e689e1ff619c4b3e0c45d5f5ed32
  DISCOVERED_AND_COLLECTED 733   EXCLUDED_WITH_REASON 14   UNCOLLECTED 38
DSH-TEST-CATALOG tests=785 refused=0 findings=0

$ node scripts/ute-cut-closure.mjs --check
UTE-CUT-CLOSURE pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 retiredSurfaces=12 placements=self findings=0

$ node scripts/ute-p0-assets.mjs --check
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0

$ node scripts/docs-sync.mjs --check
docs:sync --check: docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared (authority as20261109r1, pointer digest verified)

$ node scripts/place-dist-glue.mjs
place-dist-glue: done (29 placement(s))

$ node scripts/eb3-ci-required.mjs
EB3-CI-REQUIRED pass workflows=10 findings=0

$ node scripts/eb3-security-run.mjs --layer ci-security
EB3-LAYER layer=ci-security verdict=PASS suites=14 files=14 describes=61 passed=216 failed=0 clock_ms=20000

$ npx vitest run <15 migrated files>
 Test Files  15 passed (15)      Tests  238 passed (238)

$ node --test --test-force-exit --test-timeout=480000 --test-reporter=spec <UTE G1 argv, 9 files>
ℹ tests 89   ℹ pass 89   ℹ fail 0

$ node scripts/ci-pr-gate.mjs --full --census-captures 2
DSH-CI-VERDICT pass pass=10 fail=0 skip=0 skipped=none legs=10 refused=0 refusedlegs=none
  (census: 2 captures, identical identity sets, "COUNTS MOVED, SET DID NOT", identity set IDENTICAL to the published baseline)
```

Two disclosed maintenance edits, both re-recorded from the gates' own reports rather than by guessing:
the blueprint-fence baseline line for `vnext-admission.test.mjs` moved L4417 → L4555 (the ADM-86 rewrite
enlarged the file earlier; no literal added or resolved, no shipped surface gained a namespace literal),
and the D2 driver's two-run agreement table gained the four delivery rows.

## Hosted verdict

The hosted `ci-required` verdict for this head is recorded in the follow-up comment of this round (the
workflow run outlives the comment; the PR stays **DRAFT** and is never merged here).

## NOT proven at this head

- No LIVE `member.create` / `member.followup` over S6 (production-port + async-detach arms only).
- `team.admitInitialWork` / `team.ensureRootLive` remain unavailable through this plane; no async
  root-work delivery seam exists and none was invented.
- The model is the product's scripted mock; delivery timing is measured from durable fact timestamps.
- The operator is a per-DSH_HOME authenticated human whose claim must be an owned root — NOT multi-user
  RBAC, and no user-level isolation is claimed.
- No cell moves to PRODUCT-PROVEN; every live claim above is DEV-LIVE.
