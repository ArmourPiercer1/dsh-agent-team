# A6-LEG-VALIDITY (#738) measured on a real Host — both owner-required shapes

Classification: **DEV-LIVE** (the worktree under test, not a frozen candidate).
**No `V@B` claim** (`osLevelNetworkIsolationClaimed: false`); nothing here is a
CANDIDATE-C2 record.

Tree under test: `#738` (`A6-LEG-VALIDITY`) cherry-picked unchanged (commit
`c00e1f3d9`) onto `origin/master` `29e4b1b38`; the branch is
`task/a6-leg-validity-host-20261112`. Host: pinned `0.2.0-rc.2 @ 639ed01539`.
Fresh `DSH_HOME` per run. Every run destroys its world.

The change under test (`packages/runtime/alpha6/assigned-officer-facts.ts:487`):
the review-facts port used to refuse a durable pending approval leg whenever the
OperationOwner's member row was not `RUNNING`
(`if (owner.lifecycle !== 'RUNNING') return null`, the pre-#738 line). #738
replaces that single validity test with `LEG_OWNER_LIVE_LIFECYCLES =
['CREATED','RUNNING','SETTLED']` and keeps every identity/Blueprint/authority
check. This record measures the two shapes the owner named, on the wire.

## Shape A — SETTLED owner, second governed ask (the F-5 lane)

Instrument: `tests/kits/f5-two-asks/run-f5-two-asks.mjs` (shipped by #723), driven
unchanged. Four runs on the #738 tree:

| run | policy | officer at ask #2 | owner lifecycle at ask #2 | resolver of ask #2 | policy invoked / honoured | criteria |
|---|---|---|---|---|---|---|
| `f5-hold-live-run1` | `hold` | live | **SETTLED** | **instance (the OFFICER, by escalating)** | not invoked / null | 9/12 PASS |
| `f5-leader-live-run1` | `leader` | live | **SETTLED** | **instance (the OFFICER, by escalating)** | not invoked / null | 9/12 PASS |
| `f5-hold-disposed-run1` | `hold` | disposed | SETTLED | human | **invoked / honoured** | 12/12 PASS |
| `f5-leader-disposed-run1` | `leader` | disposed | SETTLED | instance (Leader) | **invoked / honoured** | 12/12 PASS |

### BEFORE / AFTER on the same driver

BEFORE (`#723` as merged; evidence `dev/agent-workflow/evidence/f5-two-asks/hold-live-run1-2026-11-11T19-14-59`):
the Officer's `team_resolve_control {decision: 'escalate'}` for ask #2 was
rejected —

```
{"status":"rejected","code":"CONTROL_RESOLVER_NOT_AUTHORIZED",
 "message":"… Member escalation requires a valid ReviewCapability (caller is not a
 resolver for kind 'leader-approval' — the trusted review-facts port produced no
 facts for this leg); the global resolver table is unchanged"}
failingGatesAtRefusal = ["owner-running"]
```

and the ask ended with 2 legs, no escalation row, decided by the human.

AFTER (#738), for BOTH policies, identical shape (exact rows from
`f5-hold-live-run1/ask-2.json`; `f5-leader-live-run1` is the same):

| sequence | requestId | action | legOrdinal | decision | consumptions | executionResults |
|---|---|---|---|---|---|---|
| 20 | `ctrl-1mekgsn…` | `parameter-permission` | 1 | `allow:human` | 1 | 1 |
| 23 | `ctrl-08rdms5…` | `team-tool-execute` | 1 | `deny:instance` (reason `escalated`) | 0 | 0 |
| 25 | (`control-escalation-recorded`, `escalatedBy` = the Officer) | — | — | — | — | — |
| 26 | `ctrl-07xetp8…` | `team-tool-execute` | **2** | `allow:human` | **1** | **1** |

So ask #2 now **reaches the Officer and is decided by it** (it escalates the
ordinal-1 leg, minting the ordinal-2 human leg, exactly the ask #1 chain), the
body executes once, and `CONTROL_RESOLVER_NOT_AUTHORIZED` appears **nowhere**
(`refusalTraces: []` in both live runs, and no occurrence in any evidence file).

### Why three criteria FAIL, and why that is not a product finding

The kit's own vocabulary predates #738 and was NOT relaxed:

- `ASK2-3` ("decided by a legal resolver") accepts `{human, leader}`. On #738 the
  decider is the **Officer** — a resolver the pre-#738 world never reached, so
  the criterion's list is incomplete rather than the decision being illegal. The
  authority was not silently changed: `transfers=0`, and the decision carries the
  full `ReviewCapability` (approvalCaseId, authority generation, blueprint hash,
  current leg).
- `ASK2-5` ("executed its approved body exactly once") reads the **ordinal-1**
  plane leg, which is `escalated` by design and therefore has 0 consumptions; the
  execution is recorded on the **ordinal-2** leg (table above: 1 consumption, 1
  execution-result). `executed=true` in the same criterion's detail.
- `F5-OBSERVED` asserts that the live-Officer arm REPRODUCES the F-5 refusal
  (`refusals>0`, `escalations=0`, `decider=human`). #738 is precisely the commit
  that removes that refusal, so this criterion must fail; `refusals=0,
  escalations=1, decider=instance`.
- `hold`/`leader` policy arms: on the live arm the router never reaches
  `whenOfficerUnavailable` (`policyInvoked=false`), recorded as NOT INVOKED rather
  than as honoured — unchanged from the pre-#738 behaviour. The disposed arms
  exercise the branch and BOTH still pass: **`hold` still holds** (human-decided,
  no Leader hand-off, discoverable: `policyInvoked=true, honoured=true`,
  `transfers=none, escalations=0`) and `leader` hands to the Leader.

Instrument note: this kit calls `finishAndExit(0)` in its `finally`, so its EXIT
CODE is 0 even when criteria fail; `summary.json#criteriaFailed` is the truth and
was used here. Not changed by this lane.

## Shape B — CREATED owner, the relayed member's first turn (joint J10)

Instrument: `tests/kits/joint-acceptance-20261111/run-joint-acceptance.mjs`
with `JOINT_J10_RELAY=1` (the diagnostic switch that drives the human-relayed
member shape instead of `team_delegate`), twice, ports 3191/3500:

| run | joint verdicts | J10 body start | pp leg consumed | pa leg consumed | settlement | refusals | `joint-j10-window.json` |
|---|---|---|---|---|---|---|---|
| `joint-relay-created` | **11/11 PASS** | `body-started` | 1 | 1 | `unknown` ×2 | 0 | absent |
| `joint-relay-created-run2` | **11/11 PASS** | `body-started` | 1 | 1 | `unknown` ×2 | 0 | absent |

BEFORE (`dev/agent-workflow/evidence/joint-acceptance/joint-v2-final-relay/joint-j10-window.json`,
the same driver on the pre-#738 tree): the relayed member's ask was refused —

```
{"status":"rejected","code":"CONTROL_RESOLVER_NOT_AUTHORIZED",
 "message":"ControlService: Member review is not authorized for this leg (… the
 trusted review-facts port produced no facts for this leg)"}
stalled = {"seconds": 90, "mockRequests": 32, "requests": 3}
bodyStartExists = false
relayed member row: inst-1vu0f3p1b287 (worker) lifecycle = CREATED
```

The kit writes `joint-j10-window.json` ONLY when the crash window cannot open
(no plane leg, or no body start). Its **absence** in both #738 runs is itself the
measurement: the window opened.

AFTER (both runs, `joint-j10-crash.json`):

| fact | run 1 | run 2 |
|---|---|---|
| relay (human `member.send`) | 200, `action=send-message`, `callerRole=human`, delivered | same |
| `before.pp` / `before.pa` | `ctrl-12ajdzl…` / `ctrl-1v197gt…` | `ctrl-0rdyuja…` / `ctrl-0u6mn6a…` |
| `before.ppConsumed` / `paConsumed` | 1 / 1 | 1 / 1 |
| `before.bodyStarted` | `body-started` | `body-started` |
| after cold boot: `ppFacts` / `paFacts` | 1 × `outcome: unknown` each | same |
| abandonments | `execution-outcome-unknown` ×2 | same |
| clauses | `noDuplicate, noReplay, execSettledUnknown, noSilentAbsence, durableSurvived` all true | same |

So the relayed member's ask is now **resolved through the Officer and executed**
(pp + pa both consumed, body starts), instead of being refused; the crash-window
settlement semantics that J10 exists to measure are unchanged (`unknown`, no
duplicate, no replay).

Lifecycle at that moment: the member row is **CREATED**. On the pre-#738 tree it
is measured directly in the relay window (`inst-1vu0f3p1b287 (worker) CREATED`,
quoted above). On the #738 tree the kit does not snapshot member rows at the ask,
and the relay is by construction the member's FIRST turn: `member.raw` shows
`member-activated` at ledger sequence 23, the relay is delivered at 24→25, and
the ask legs are minted immediately after — before the row can leave `CREATED`
(a member row only advances when a work unit settles). The pre-#738 record is the
direct measurement of that state; the #738 runs are the same shape with the same
ordering.

## What differs from the host-free expectations

Nothing in the delivered behaviour. #738's host-free suite (31/31, including the
CREATED and SETTLED end-to-end facts-port tests and the negative control that
restores `lifecycle !== 'RUNNING'`) predicts exactly what the Hosts did:

- CREATED owner: the relayed member's ask is resolved and executed (Shape B).
- SETTLED owner: the second ask is resolved and executed (Shape A).
- `hold` still holds and `leader` still hands off when the Officer is genuinely
  unavailable (both disposed arms, 12/12).

The three differing *measurements* are instrument artefacts, not product
differences: the F-5 kit's legal-resolver list, its ordinal-1 leg choice, and its
F5-OBSERVED criterion all encode the pre-#738 world (documented above, arms
untouched).

