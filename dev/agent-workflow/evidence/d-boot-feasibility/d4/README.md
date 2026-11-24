# D4 — the LIVE ROUTED review wake: what a real Host does, and the exact seam that stops it

**Round 87 · 2026-11-23 · HEAD `775be06d7ac21ea4f815eb93338ff4556944dcd5` · branch `vnext/a1-cut`
· pinned host `0.2.0-rc.2` @ `639ed015397290b3745d163aafe02ffee4aa3f84` (tree porcelain empty
before AND after both boots)**

This directory is the fourth live acceptance artefact of the D series, and it is a **blocker
measurement, not an acceptance pass**. Round 84 implemented Alpha.6 formal routing and proved the
*mechanism* over the real ports (`ute-a1/ALPHA6-FORMAL-ROUTING.md`); the one thing left unproven was
a **live routed wake**: a real boot in which an ordinary tool ask becomes a durable Alpha.6 review
case, the ONE policy routes it to an Officer, and the wake is delivered through the governed
delivery. The round-87 task was to build `run-boot-d4.mjs`, express such a world, and prove it — or
to STOP with the precise blocker instead of simulating the missing part.

**The live measurement says: the world is expressible; the ROUTED wake is not reachable, because
two product seams that would produce and consume such a row do not exist in this tree.** Both are
Team-side (`packages/runtime/**`), both are already named in the repo's own source and backlog, and
**neither needs an upstream patch** — so this is **NOT** a `CORE_SEAM_BLOCKER` (§4). No leg was
fabricated, no control route was added to the harness, no model turn was claimed as real.

The instrument is `tests/world-factory/drivers/d-boot-feasibility/probe-d4-routed-wake.mjs`
(`--plan` is host-free; `--boots N` runs the live pair). It follows `run-boot-d3.mjs`'s structure
exactly: same harness, same DEV-LIVE lease/grant discipline, same evidence readers, own DSH_HOME
under `tests/homes/`, own port band, host-selectable through `tests/next-host/host-select.mjs`.

---

> **ANNEX — rounds 95/96 (2026-11-24): the same instrument now also measures the ask→grant→execute
> chain.** The tables below are the round-87 measurement, unchanged and still accurate for the
> routed-wake question. Two further judges were added to the SAME probe later and are recorded
> elsewhere: `d4:ask-execute` (round 95) and `d4:ask-execute-2` (round 96, a SECOND mutation with
> different bytes) — both PROVEN on two agreeing boots, with `d4:routed-wake` still REFUTED. See
> `dev/agent-workflow/evidence/ute-a1/round95/settlement-comment.md`,
> `dev/agent-workflow/evidence/ute-a1/MIGRATED-SUITE-STATUS.md` §"Round 96" and
> `runs/boot0{1,2}/verdict-ask-execute{,-2}.json`.

## 1. The world (the enablement configuration, verbatim)

| item | value |
| --- | --- |
| blueprint | authored **v5** `team.dboot.d4.v5`, `schemaVersion: 5`, accepted by the host's own `parseBlueprint` |
| `reviewRouting` | `{enabled: true, officerTemplateId: "officer", ordinaryToolApprovals: {default: "officer", leaderExceptions: []}, whenOfficerUnavailable: "hold"}` |
| templates | `leader`, `officer` (Review Officer), `worker` (Governed Worker) |
| `memberIoCeilings` | officer: read+write lane on its own dir; **worker: `write` lane = `restricted` with `ask: [dir]`** (the shipped v4 grammar's ask arm — one ordinary tool ask, deterministically) |
| row opt-in | `alpha6ReviewRouting: true` |
| durable centre | `centreStatePath: <home>/centre` |
| wake-intent | `alpha6WakeIntentPath: <home>/alpha6-wake-intent` (**ABSOLUTE**) |
| preset | `a5sf-governed-member` (the shipped governed Member) |
| composition | the shipped `cordis.patch.yml` rows, with the ONE known dead specifier dropped and recorded (`composition-drops.json`: preset row `dsh-agent-team/web-tool` targets the module the A1 cut deleted) |
| model | the shared scripted mock (`packages/tools/harness/mock-deepseek.mjs`) — **scripted, not a real model** (§6) |
| boots | 2, agreeing (`agreement.json`, `agreeing=true differing=[]`) |

**The product's own closed enablement rule was evaluated on these exact documents, host-free, before
any boot** (`plan/enablement-rule.json`, produced by `--plan` through
`centre-config.js#centreConfigViolation`):

| input | rule's answer |
| --- | --- |
| coherent row (v5 routing + centre + absolute wake path) | `undefined` — **ADMITTED** |
| same v5 doc, `reviewRouting` removed | `ADMISSION_ALPHA6_UNAVAILABLE: ADMISSION_ALPHA6_ROUTING_REQUIRED` |
| same v5 doc, `alpha6WakeIntentPath` removed | `ADMISSION_ALPHA6_UNAVAILABLE: ADMISSION_ALPHA6_WAKE_INTENT_PATH_REQUIRED` |

So the *enablement* half of round 84 is real on a real configuration, and the *refusal* half is not
vacuous: both incoherent shapes are refused BY NAME.

---

## 2. Per-judge results (two agreeing boots)

`runs/boot0{1,2}/verdicts.json`; the pair table is `agreement.txt`.

| judge | verdict | boots |
| --- | --- | --- |
| `d4:enablement` | **PROVEN** | 2/2 |
| `d4:officer-up` | **PROVEN** | 2/2 |
| `d4:officer-binding` | **PROVEN** | 2/2 |
| `d4:routed-wake` | **REFUTED** | 2/2 |
| `d4:refusal` | **PROVEN** | 2/2 |
| overall | **BLOCKED** | 2/2 |

### `d4:enablement` — PROVEN (the row is NOT refused; the Team really is up)

`alpha6EnablementRefusal = null`; the Host process boots (`port 3194/3195`, `/__p6t6/health` ok);
the TeamSession is served (`{"rootSessionId":"session-dboot-d4-root","blueprintId":"team.dboot.d4.v5",
"revision":"1","contentHash":"sha256:ca9ca0a0…"}`); the host log carries **no**
`ADMISSION_ALPHA6_UNAVAILABLE`; the centre holds **zero** Alpha.6 denial facts. This is the first
live boot of a COHERENT Alpha.6 row: round 63/68 could only measure the refusal.

### `d4:officer-up` — PROVEN (the Officer is a governed Member with its own session)

`team_delegate(delegationTemplateId: "officer")` produces a durable Member row
`{instanceId: "inst-1crltnl0089j", templateId: "officer", lifecycle: "RUNNING",
childSessionId: "session-team-child-1d56dbb1…"}`, and that child session runs its own turn
(`calls: ["read"]`, final assistant text `DBOOT_D4_OFFICER_TURN_DONE`).

### `d4:officer-binding` — PROVEN (the Officer's OWN call is admitted under the OFFICER's binding)

The Officer's ledgers hold exactly **1** `invocation-authority` fact for ITS callId
`call-d4-officer-read`, axis `fs.read`, `decision: "allow"`, and its settlement transits
`ADMITTED → RUNNING → COMPLETED`. The Officer is `inst-1crltnl0089j`, never the Leader.

### `d4:routed-wake` — REFUTED, with the failing clauses being the exact seam

The worker's authored `ask` lane produces a **real durable control row** — and it is the row the
Alpha.6 router cannot route (`runs/boot01/control-row-durable.json`, read from
`<home>/storages/team_domain.json#tables.ledger`, fact `control-request-recorded`, sequence 9):

```json
{
  "actionName": "admission-ask",
  "correlation": "admission:call-d4-worker-write",
  "executionCoupling": "inline",
  "kind": "leader-approval",
  "ownerRootSessionId": "session-dboot-d4-root",
  "requestId": "ctrl-1xxrzo21k29yc31rawhls0qn",
  "requester": { "instanceId": "inst-0ty67u70r99a", "kind": "instance", "role": "member" },
  "subject": { "instanceId": "inst-0ty67u70r99a", "kind": "instance" },
  "summary": "admission ask: write (fs.write \"…/worker-ask.txt\" requires approval under policy generation a5sf1:252bb660…)",
  "targetInstanceId": "inst-0ty67u70r99a",
  "toolName": "write"
}
```

**There is no `approvalCaseId`, no `legOrdinal`, no `reviewAuthority`, no `operationFingerprint`, no
`requestedEffect`, no `blueprintContentHash` on it.** Measured consequences, all read back from disk:

| clause | ok | measured |
| --- | --- | --- |
| `ordinary-tool-ask-created` | ✅ | the row above exists, `kind: leader-approval`, `toolName: write` |
| `row-carries-approval-case` | ❌ | `approvalCaseId=null legOrdinal=null reviewAuthority=null` |
| `product-router-declines-the-durable-row` | ✅ | the PRODUCT's own `createAlpha6RootRouter.route("ctrl-1xxrzo21…")` answers **`null`**, `memberListCalls: 0` — the ONE policy declines **before** it ever consults the member view (`runs/boot01/route-probe.json`) |
| `wake-intent-fact-routed` | ❌ | `team-review-wake-routed` facts: **0** |
| `wake-confirmed-delivered` | ❌ | `team-review-wake-delivered` facts: **0** |
| `wake-intent-file-written` | ❌ | `<home>/alpha6-wake-intent/`: **0 files** (the directory is never created) |
| `officer-woken-in-its-session` | ❌ | the Officer's child session carries ONLY its delegation prompt; no `[team-review-wake` input |
| `wake-has-machine-attribution` | ❌ | with zero wakes there is no machine input to attribute (NOT_REACHED, never softened to a pass) |
| `leader-received-the-plain-c1-ask` | ✅ | the **Leader** was woken instead: `[team-control requestId=ctrl-1xxrzo21…] A Team member operation is waiting for Leader approval.` (`runs/boot01/leader-notification.txt`) |
| `no-review-wake-to-the-leader` | ✅ | the Leader got no `[team-review-wake` input |

The durable fact census of that world (`wake-measurement.json#factTypeCensus`) is the positive
control for the scan: `provision-member-instance 2, team-work-admitted 2, activity-interval-opened 2,
activity-interval-closed 2, member-lifecycle-changed 2, control-request-recorded 1,
control-decision-recorded 1` — the reader sees the ledger, and the ledger holds **no wake fact**.

The ask WAS resolvable by the plain C1 path (so the world is coherent, not broken): the Leader's
`team_resolve_control {decision: "allow"}` returned `{"status":"control-resolved", … "decider":
{"kind":"instance","instanceId":"inst-leader","role":"leader"}}` and the ledger recorded
`control-decision-recorded`. The worker's write was then refused by the centre with a message that
names the SECOND seam (§4.2).

### `d4:refusal` — PROVEN (the negative side still works)

Second boot in the SAME lease: the same v5 document with `reviewRouting` removed is refused by the
closed rule (`ADMISSION_ALPHA6_ROUTING_REQUIRED`), the refusal is **recorded** through the product's
own host-surface point (`invocation-authority` fact `decision: deny`, `refusalCode:
ADMISSION_ALPHA6_UNAVAILABLE`, axis `host.service`, plus its `REFUSED` settlement), the host log
carries the code, the team is absent and **no wake-intent file exists**.

---

## 3. What this proves about the live level

* A **coherent** Alpha.6 enablement now boots a real Host and a real Team (`d4:enablement`).
* An **Officer Member** is real, governed and admitted under its own binding (`d4:officer-up`,
  `d4:officer-binding`) — the round-84 claim about the Officer's calls was mechanism-only until now;
  it is now measured on a booted host.
* The **refusal** side is unchanged and still recorded (`d4:refusal`).
* The **routed wake does not happen**, and the reason is not the world: the product hands the ask to
  the Leader, writes zero wake facts, and its own router answers `null` for its own durable row.

**Level: MECHANISM stays. No cell is upgraded to PRODUCT-PROVEN. The live ROUTED wake remains
UNPROVEN — now by measurement instead of by assumption.**

---

## 4. THE BLOCKER (two missing Team-side seams, in the order they bite)

### 4.1 No live producer of a case-bearing ordinary ask (blocks the route itself)

`createAlpha6RootRouter.route()` returns `null` unless the durable row carries BOTH
`approvalCaseId` and `legOrdinal` — `packages/runtime/alpha6/root-router.ts:209`:

```ts
if (row === undefined || row.approvalCaseId === undefined || row.legOrdinal === undefined) return null
```

The notifier's case-less branch then notifies the **Leader** by design —
`packages/runtime/alpha6/notifier.ts:159-169` ("A case-less leader-approval row is the plain C1
Leader ask … its legal recipient is the Leader"). That is exactly what the live run measured.

Which live paths can mint a leg (`approvalCaseId`)? Exactly one:
`requestApprovalLeg` (`packages/runtime/control/service.ts:5607`), and its only live caller is the
governance envelope-mutation lane (`packages/runtime/governance/service.ts:1016`, `kind:
CONTROL_REQUEST_KINDS.ENVELOPE_MUTATION`) — which `isDelegableOrdinaryToolAsk`
(`packages/runtime/review-router/policy.ts:68`, `if (facts.kind !== 'leader-approval') return false`)
excludes BY KIND.

Every live producer of an ordinary `leader-approval` row is case-less:

| producer | what it passes | case fields |
| --- | --- | --- |
| centre admission ask, `src/plugin/vnext/admission-port.mjs:155-165` | `kind`, `targetInstanceId`, `actionName`, `toolName`, `correlation`, `executionCoupling: 'inline'`, `summary` | **none — no `leg`, no `reviewPayload`, no `operationFingerprint`** |
| model-facing `team_request_control`, `packages/tools/src/tools.ts:973-1000` | `kind`, `targetInstanceId`, `actionName`, `toolName?`, `summary?` | **none — the schema has no case/leg/effect argument at all** |

The lane that used to mint ordinary-operation legs was the Alpha.4 operation-approval ask path
(`packages/runtime/operation-permission/pre-execute-adapter.ts` + `pa-control-bridge.ts`), **deleted
by the A1 cut** in `1617d5839` ("delete the retired execution route"). What survives is pure and has
no production caller: `routeOperationApproval`, `createOperationApprovalFactsReader` (wired in
`root.ts:3268` for consumption revalidation only). `packages/runtime/test/a4p7-live-descendant-
authority.test.ts:579` records the same fact in the repo's own words: "The A1 cut RETIRED
operation-permission/pre-execute-adapter.ts: the decision side is the centre's admission point now."

**Minimal lawful fix (not attempted here):** make the admission ask lane carry the case identity —
i.e. have `admission-port.mjs` open the ask through a case-forming call (`requestApprovalLeg`) with
the operation identity the Alpha.6 policy already requires (`operationFingerprint`, `requestedEffect`,
authority scope, operation tool coordinate), so the row the router is written to route actually
exists. That is a product-labelled feature (an "Alpha.6-aware ask lane"), which is exactly what
`root-router.ts:212-216` names when it explains why a row carrying the bound-Blueprint identity must
not silently fall back to the Leader. **No new centre axis is needed and none is lawful** (round-84
determination, unchanged).

### 4.2 No consumer for an `ask`-disposition call, even after an allow (blocks the "then it runs" arm)

With the Leader's allow durably recorded, the worker's call was refused by the centre with this
verbatim message (`runs/boot01/wake-measurement.json#workerWrite.result`):

```
Error: authored locator '…/worker-ask.txt' has the disposition 'ask', but this admission plane has
no approval consumer (resolveAskClassCall has no production caller); refusing rather than auto-approving
```

Source: `packages/runtime/member-io-policy/src/provider-capabilities.ts:315`
(`IO_ASK_REQUIRES_APPROVAL`), whose own comment (lines 200-205) says the ask is a DECISION of the
lane algebra but "admission has no approval consumer — `resolveAskClassCall` is the designed
consumption seam and has NO production caller (**BL-30** owns it)". The backlog agrees:
`docs/plans/active/alpha5-sandbox-first/ALPHA5-SANDBOX-BACKLOG.md:559` — `BL-30 P4-04 一次性审批与撤权
… READY`; `:562` — BL-33's consumption half is "blocked on BL-30".

So even a fully routed, fully granted Alpha.6 review could not make the reviewed operation execute
today. This is the second reason the live routed-wake acceptance cannot be completed in this tree,
and it is again **Team-side and backlog-owned**, not upstream.

> **ROUND 88 STATUS — gap 1 measured as a CONTRACT CONFLICT; still OPEN, still REFUSED.**
> (`dev/agent-workflow/evidence/bl-30-ask-consumer/README.md`; two new arms in
> `packages/runtime/test/a5sf-approval-takeover.test.ts`.) The round-88 task was to wire
> `resolveAskClassCall` here. It cannot be wired as a wiring change, and the reason is now measured
> rather than cited: the adapter's `AskApprovalAuthority` is the last-mile guard `guardOperation`,
> which by DESIGN never authorizes or consumes an **inline** durable allow (B2/§D.4 —
> `control/service.ts:4155-4165`, `:4289-4291` → `no-request`), and the admission ask recorded above
> is `executionCoupling: 'inline'` by construction (`admission-port.mjs:76-79`, `:163`) — exactly what
> `runs/boot01/control-ask.json` shows for `ctrl-1xxrzo21…`. Same scope, same world: guarded ⇒ the
> adapter accepts and consumes exactly one row; inline ⇒ `no-request` / `APPROVAL_DENIED` / **0**
> consumptions. The one-shot grant that does authorize the call is already SPENT by the host tool
> guard (`admission-port.mjs:770-784`) before the body reaches the refusing Provider plane, so the
> Provider cannot be a second consumer without a second authority. **No product byte changed and no
> boot was spent re-measuring an unchanged refusal**; the lawful routes (flip the coupling and lose
> `ADM-57`'s Stop-cancels-the-ask law, or give the OS plane a read port onto the centre's enforced
> decision) are owner decisions. `d4:routed-wake` therefore stays **REFUTED** on both axes.

### 4.3 Classification

* **`CORE_SEAM_BLOCKER`: NONE.** No upstream source patch, no private upstream API, no host-side
  change is required by either seam. Nothing was attempted against the pinned host (porcelain empty
  before/after both boots).
* The missing pieces are our own product's: (1) an Alpha.6-aware ask lane that forms the case; (2)
  BL-30's one-shot approval consumption (`resolveAskClassCall` caller). Both are tracked work, not a
  contract change and not a new axis.

---

## 5. What was NOT done (deliberately)

* `run-boot-d4.mjs` was **not** written as an acceptance driver: its central judge would be a claim
  the product cannot satisfy, and a driver that always reports REFUTED is not an acceptance
  instrument. The probe measures the same world with the same discipline and reports BLOCKED.
* No case/leg was fabricated on the durable row; no `approvalCaseId` was invented; no control route
  was added to the harness or the mock; no wake intent file was written by the driver.
* The routed-wake clauses that could not be observed are marked NOT_REACHED inside the judge (a
  failing clause), never softened.
* Duplicate-route (ONE wake) and human-Sticky-Stop-not-cleared arms were **not reachable**: both
  require a delivered wake. They remain unproven, and their round-84 in-process arms
  (`ADM-143/ADM-146`) are unchanged.

## 6. The scripted model (disclosed)

Every model turn in this run is the shared scripted mock (`world.startMock({decide})` against
`packages/tools/harness/mock-deepseek.mjs`): a deterministic function of the request. It plays, by
marker: the Leader's discovery turn; `team_delegate` for the officer; `team_delegate` for the worker;
`team_resolve_control` for the pending ask; and, for a member, exactly one `read` (officer) or one
`write` (worker). **This is not a real model and nothing here is claimed to be a real-model
measurement.** What is real: the preset row, the realm provider, the compiler, the centre, the
settlement store, the control service, the notifier and the router — all loaded from
`packages/runtime/dist` by the booted Host.

Two scripting notes, for honesty about what a scripted model had to know:
1. The Leader marker is read from the newest user message that carries a DRIVER marker, because after
   a tool call the loop appends the tool result as a user-role message (a naive "last user message"
   read mis-fires the first time).
2. No control could be resolved by the mock as the OFFICER: the product never wakes the Officer, so
   the only resolution available is the Leader's — and that is the measurement, not a workaround.

## 7. Boot discipline (as required)

* DSH_HOME inside the workspace: `tests/homes/u5u5a5sfdev1-20261123T07-05-28Z` (boot 1) and
  `…T07-12-38Z` (boot 2), plus the refusal worlds `…T07-10-04Z` and `…T07-17-17Z`; all torn down by
  identity after the run (no orphan process, `teardown.json`).
* Ports 3194 (positive) / 3195 (refusal) from WorldFactory's lease band; **`:3080` and its DSH_HOME
  untouched**.
* One DEV-LIVE ledger row per host start (`run-ledger.jsonl`); the lease declared 2 starts per
  iteration (positive + refusal) and settled (`slot released (released=true held=false)`).
* Archive-before-start (`archive/`); the pinned host tree read-only, `git status --porcelain` empty
  before and after.
* One documented crash residue: the first debug iteration was killed mid-run and left a stale
  dev-live slot; it was NOT hand-deleted — the next start's own scan reclaimed it after the
  cross-namespace grace (`lib/dev-live-slots.mjs`), which is the designed path.

## 8. Re-run

```
node tests/world-factory/drivers/d-boot-feasibility/probe-d4-routed-wake.mjs --plan      # host-free
node tests/world-factory/drivers/d-boot-feasibility/probe-d4-routed-wake.mjs --boots 2   # 4 stacks, ~15 min
```

Exit codes: `0` the probe ran and every judge is PROVEN; `3` the probe ran and measured the BLOCKER
(this round); `1` the probe itself failed.

## 9. Evidence index (this directory)

| file | what |
| --- | --- |
| `probe.log` | the full run log (both boots, every prompt, every wait, the pair table) |
| `plan/enablement-rule.json` | the product's own closed rule on the three exact documents |
| `plan/plan-patch.yml` | the exact composition rows the world boots (host-free) |
| `agreement.json` / `agreement.txt` | the two-run agreement table (`agreeing=true differing=[]`) |
| `results.json`, `probe-digest.json` | per-boot results, HEAD/pin/probe sha256, `!!js` substitutions |
| `runs/boot0{1,2}/verdicts.json` | every judge and every clause (the theorem of §2) |
| `runs/boot0{1,2}/control-row-durable.json` | the durable row + the whole TeamDomain ledger |
| `runs/boot0{1,2}/route-probe.json` | the product router's answer for that row (`null`, 0 member reads) |
| `runs/boot0{1,2}/leader-notification.txt` | the plain C1 ask the Leader actually received |
| `runs/boot0{1,2}/wake-measurement.json` | wake facts, intent dir, disk-wide wake-string hits, fact census, the Leader's resolve result, the worker's refusal text |
| `runs/boot0{1,2}/officer-{ledger,settlement,transcript}.json` | the Officer's own admitted call and settlement |
| `runs/boot0{1,2}/refusal-arm.json` | the negative row: rule answer, recorded fact, settlement |
| `runs/boot0{1,2}/run-record.{json,txt}`, `summary.txt`, `teardown.json` | the shipped DEV-LIVE run record |
| `runs/boot0{1,2}/run-record-check.json` | the producer-side SELF-CHECK of that record: `scripts/eb3-run-manifest.mjs`'s own `validateRunRecord()` over the bytes just written (`pass=true`, `findings=[]`) |
| `run-record-self-check.json` | the run-level verdict of those checks; a refused record makes the probe exit `1` instead of `0`/`3` |
| `archive/P0-SUPERSEDED-RUN-RECORDS.json` | inventory of superseded RUN records written by the PRE-FIX emitter (P0, review 20261124-1341): renamed to `run-record.json.superseded`, bytes unchanged |
| `run-ledger.jsonl` | the shared host-start budget ledger (one row per start) |

### 9.1 The RUN-record P0 (review 20261124-1341) and how this directory records it

Both boots of round 99 wrote `run-record.json` files that the repository's own
`EB3-RUN-MANIFEST` refused: `cases[4].id` was missing, and `subset=true` carried no `arms`.
The cause was the EMITTER, not the measurement: the probe's `CASE_ID` table was missing the seven
round-97 routed-wake propositions and `d4:ask-execute-process`, so `addCase(undefined, …)` folded
all eight judges into one anonymous row and the extra rows pushed `totalCases` past `selected`.
Every judge's verdict was real; the record that carried them was not a valid record.

The repair (commit `931711c98`) is in the emitter, and the records here were RE-MEASURED by a
fresh `--boots 2`, never hand-edited:

* every judge has a stable case id, and the record declares `selectedCases === allCases` = all 17
  judges it actually runs, so it is a FULL run (`subset=false`, no `arms`);
* after writing a record the probe grades it with `validateRunRecord()` from
  `scripts/eb3-run-manifest.mjs` — the SAME validator the hosted step runs — writes
  `run-record-check.json`, and fails the run when the contract refuses it;
* superseded records from the pre-fix emitter are kept byte-for-byte but retired to
  `*.json.superseded` (listed in `archive/P0-SUPERSEDED-RUN-RECORDS.json`), because they are
  history that must stay readable and must NOT be graded as current evidence. No historical JSON
  was edited and `EB3-RUN-MANIFEST` was not relaxed.
