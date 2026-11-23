# D2 live driver — three remaining acceptance items over the shipped governed preset

- **Driver**: `tests/world-factory/drivers/d-boot-feasibility/run-boot-d2.mjs` (sha256
  `a1ceb011a8e1f8909a1b5331e5a45ad5ae5d66637a4fa2863df92cb3062f7ade`, the digest recorded in
  `driver-digest.json`).
- **Command**: `node tests/world-factory/drivers/d-boot-feasibility/run-boot-d2.mjs --boots 2`
- **HEAD at run start**: `82dfda0c367e2a193d764f7c1054327b2e3ea133`; host pin
  `639ed015397290b3745d163aafe02ffee4aa3f84` (porcelain empty before and after both boots).
- **Record class**: `DEV-LIVE`. Nothing here is candidate evidence and no row here can yield `V@B=yes`.
- **Boots**: 2, identical (`agreeing=true`, `differing=[]`). Two distinct Worlds (one per boot), ports
  from the 3180 family, `DSH_HOME` under `tests/homes/`, archive-before-start, teardown by identity,
  one DEV-LIVE ledger row per start (`run-ledger.jsonl`).

**Round 71 (judge semantics) rewrote the revocation judge and added the widening direction.** The old
REQUIRED clause demanded that the durable overlay WIDEN authority (revoke the deny ⇒ the previously
admitted call must be refused, with a new compiled generation in the fact). The contract forbids that
(`overlay-decision.mjs:9`, `admission-port.mjs:498-521`, `permission-mutation.ts:435-436`), so the judge
was measuring a capability the product must never have. All four judges (round 83 added the delivery
judge) are now **PROVEN on both boots**, and `overall=PASS` (exit 0) is the driver's own result — not a
weakened one. The driver runs its FULL declared case set (`selected=4 / totalCases=4`, `subset=false`).

## Verdicts

| judge | boot1 | boot2 | what it means |
| --- | --- | --- | --- |
| `d2:multi-member-concurrency` | **PROVEN** | **PROVEN** | two governed Members ran with overlapping model turns, each native `read` admitted inside its OWN compiled lane, guard facts name their own member, ledgers separate; A's cross-member read was refused `LANE_DENY` with zero B bytes |
| `d2:revocation` | **PROVEN** | **PROVEN** | (a) a durable DENY refuses the previously admitted call (`ADMISSION_OVERLAY_DENY`, zero body, settlement `REFUSED`, overlay named as the deciding authority with a policy generation); (b) removing the deny RESTORES the call (admitted + `COMPLETED`, a NEW fact in the same call-id family); (c) the untouched in-lane call is admitted at every phase; (d) the same lane CANNOT mint an `allow` beyond the compiled ceiling, and the widened locator is still `LANE_DENY` with zero foreign bytes |
| `d2:stop` | **PROVEN** | **PROVEN** | a Member turn stopped through the product's own `session/cancel` path ended as the centre's `ADMISSION_STOPPED` (`REFUSED`/`not-started` settlement), never a completion and never `UNKNOWN`; the second Member completed |
| `d2:remote-delivery` | **PROVEN** | **PROVEN** | round 83: the S6 management plane `member.send` returned the coordinator's durable delivery ACKNOWLEDGEMENT with **0 admissions / 0 executions at the acknowledgement**, and the delivered prompt then ran in Member B's OWN turn, where the centre wrote its `allow` (`fs.read`, B's binding, B's in-lane locator) into B's OWN ledger AFTER the ack; unknown member, archived member, duplicate send (at-least-once, no operator-side execution), restore, and Stop during a DELIVERED turn (`ADMISSION_STOPPED`) all measured on the same row |

## Judge 1 — two Members at once (PROVEN)

Measured (boot1; boot2 identical):

- instances `inst-1235q1w1rd1u` (worker-a) and `inst-12x4j4t1rn1g` (worker-b), both admitted;
- concurrency window from the **mock provider's own receive times**, not from driver wall-clock:
  A `04:26:32.733Z .. 04:26:33.393Z`, B `04:26:32.988Z .. 04:26:33.099Z` — B's turn is entirely inside
  A's;
- A's own in-lane read: admitted, 14 provider guard `allow` facts on `workspace/team-a/in-lane-a.txt`,
  **every** `memberIdentity = inst-1235q1w1rd1u`;
- B's own in-lane read: admitted, 14 guard `allow` facts on `workspace/team-b/in-lane-b.txt`, **every**
  `memberIdentity = inst-12x4j4t1rn1g`;
- A reading `workspace/team-b/in-lane-b.txt`: `Error: LANE_DENY`, **zero** B bytes in A's transcript,
  and **zero** guard facts for B's locator under A's identity (the centre refused before the Provider);
- A ledger 9 admission facts, B ledger 9 (`allow` for its own in-lane reads, the revocable pre/post
  allows, the overlay deny and the round-71 widening probe's own `LANE_DENY`); every admission fact is
  `instanceId === agentId` of its own member, and each member has its own `<instanceId>.facts.jsonl`.

Note on the design: the 7 in-lane reads in A's first turn are REAL reads of the fixture, not a sleep.
They keep the work unit live long enough for the second Member's turn to interleave — a one-read turn
finished before B was admitted (measured), which would have made "concurrent" an assumption.

Round 71 also had to refine one clause: `b-ledger-no-lane-deny` now looks at B's OWN locator
(`workspace/team-b/in-lane-b.txt`) instead of "any B LANE_DENY". B's widening probe at
`workspace/team-a/in-lane-a.txt` is B's OWN out-of-lane call — it belongs in B's ledger and is the
subject of direction (d). The clause still proves exactly what it proved before: A's cross-member
refusal never appears in B's ledger.

## Judge 2 — revocation, measured in the contract's own terms (PROVEN)

What the product does, measured live through the ONE durable `permissionOverlay` mutation lane
(`team_grant_permission` / `team_revoke_permission` → `GovernanceMutationService.mutatePermission`):

1. pre-read of `workspace/team-b/revocable.txt` → **admitted** (`call-d2-b-pre`, bytes returned);
2. `team_grant_permission` adds `{operationClass: read, matcher: {kind: exact, value: revocable.txt},
   effect: deny}` → `{"status":"permission-mutated", "verb":"grant", "changed":true}` — the durable deny
   LANDS;
3. **direction (a)**: the SAME call (`call-d2-b-mid`) → **refused**
   `Error: ADMISSION_OVERLAY_DENY: a durable permission-plane restriction denies this call; the
   compiled binding allowed it, so the overlay wins (it can remove authority, never grant it)`;
   - zero bytes of the previously readable file;
   - settlement `state=REFUSED`, `dispatch=not-started`, `bodyOutcome=not-started`;
   - the durable fact: `decision=deny`, `refusalCode=ADMISSION_OVERLAY_DENY`,
     `overlayOutcome=deny`, `laneDecision=allow`, `policyGeneration=a5sf1:…` — the overlay is named as
     the deciding authority and the fact carries the compiled policy generation.
4. `team_revoke_permission` removes that rule → `{"status":"permission-mutated", "verb":"revoke",
   "changed":true}`;
5. **direction (b)**: the SAME call family (`call-d2-b-post`) → **admitted again**, settlement
   `COMPLETED`/`quiesced`/`completed`; the three facts are distinct (`call-d2-b-pre@…`,
   `call-d2-b-mid@…`, `call-d2-b-post@…`), so the restored call is a NEW fact, never a replay of the
   pre fact;
6. **direction (c)**: an untouched in-lane read (`workspace/team-b/in-lane-b.txt`) was issued at EVERY
   phase — `call-d2-b-pre-inlane`, `call-d2-b-mid-inlane`, `call-d2-b-post-inlane` — and each one was
   admitted, returned its bytes, is an `allow` fact, and settled `COMPLETED`.

### Direction (d) — WIDENING IS REFUSED, measured (not assumed)

After the restore, the driver asked the SAME lane for an `allow` on
`workspace/team-a/in-lane-a.txt` — a locator **outside Member B's compiled read lane**:

```
team_grant_permission {rules:[{operationClass:'read', matcher:{kind:'exact', value:<A's in-lane file>}, effect:'allow'}]}
→ {"status":"permission-mutated", ... ,"changed":false,"reason":"mutation-proposal-pending"}
```

The product's own answer is a **no-op that opens a durable proposal** (it did NOT commit authority and
did NOT mint an `allow`). The judge records that answer shape verbatim and accepts only a typed
refusal or a no-op; a `permission-mutated` + `changed:true` expansion is the one shape that fails.

The EFFECT is measured too: Member B then read `workspace/team-a/in-lane-a.txt` and got
`Error: LANE_DENY: fs.read "…/team-a/in-lane-a.txt" is outside the binding's fs.read lane`, with zero A
bytes, and its centre fact is `decision=deny`, `refusalCode=LANE_DENY` — the compiled lane still
decides, and no admitted authority reached execution. Both boots agree.

Why this is the contract and not a workaround:

- `packages/runtime/src/plugin/vnext/overlay-decision.mjs:9` — “it can REMOVE authority, never grant it”;
- `packages/runtime/src/plugin/vnext/admission-port.mjs:498-521` — the overlay is consulted **only** when
  the compiled lane already allows, and its only possible verdict on a covered face is
  `ADMISSION_OVERLAY_DENY`;
- `packages/runtime/governance/permission-mutation.ts:435-436` — a revoke removes restrictions and
  “never needs expansion authority”; an expansion needs carrier/ceiling coverage and refuses typed
  (or, on this wired lane, parks as a proposal) rather than minting;
- `packages/runtime/src/plugin/vnext/centre-install.mjs:94` — the fact's `policyGeneration` is the
  COMPILED revision fixed at bind, which is exactly what directions (a) and (b) assert it carries.

**What is NOT claimed:** that revoking a durable deny *narrows* authority (it does not, by design), or
that an overlay ALLOW can ever be minted at or below the ceiling. The revised judge claims neither.

## Judge 3 — Stop (PROVEN)

Sequence: Member A's follow-up reads an authored **exact** `ask` locator
(`workspace/team-a-ask/ask-me.txt`); the centre records a durable Control request on A's behalf
(`kind=leader-approval`, `actionName=admission-ask`, `status=pending`) and parks the call on the
call's own abort signal. The driver then issues the product's Stop path — the sequence the Team view's
member-stop button issues (`packages/client/src/model/member-stop.ts:19,91,192`) —
`POST /api/session/cancel` for A's child session (status 200). Measured outcome:

- A's tool result: `Error: ADMISSION_STOPPED: the execution "call-d2-a-ask" was aborted before its body; a
  Stop is not a lane denial, an expiry or a fault…`;
- A's centre fact: `decision=deny`, `refusalCode=ADMISSION_STOPPED`; no execution fact for that call
  (never dispatched);
- settlement: `state=REFUSED`, `dispatch=not-started`, `bodyOutcome=not-started` — not `UNKNOWN`;
- Member B, unaffected by the Stop, read its in-lane file after the cancel and its settlement is
  `COMPLETED` with zero `stops`, so the Stop is scoped to the stopped turn.

Why stopping works: `admission-port.mjs:334` (`refuseStop`), `:471` (Stop priority before the lane),
`:618/:639` (an aborted ask wait is relabelled `ADMISSION_STOPPED`, never `UNKNOWN`).

Single-boot nature: the Stop leg is a race between the durable ask and the cancel; it is reproduced in
BOTH boots (`REFUSED` in both), so no single-boot concession was needed. The two-boot requirement was
kept for all four judges.

## Judge 4 — the delivery boundary (round 83, PROVEN)

**The law.** The S6 management plane may DELIVER work; it may never EXECUTE a tool. The command
classification (`s6-command-classification.ts`) now has a third served class, `work-delivery`
(`member.create`, `member.send`, `member.followup`); `team.admitInitialWork` and `team.ensureRootLive`
stay `agent-execution` and stay REFUSED, because their only seams await the root's turn / start an
executor with nothing to acknowledge.

**Measured on the live row** (boot1; boot2 identical, both `PROVEN`):

- `POST /team-remote/member.send` as the authenticated human operator (`caller.humanId` = the owned
  root), body = a prompt that makes Member B read its own in-lane file:
  **HTTP 200**, `ok=true`, `outcome.status='delivered'`, `deliveredToInstanceId = B`,
  `factSequence=39` (intent), `deliveredSequence=40` (confirmation).
- **At the acknowledgement**: `0` invocation-authority facts and `0` execution facts for the
  delivered call (`CALL_RD`) in B's ledger — the request itself executed nothing. The ACK carries no
  `toolResult`/`result`/`assistant`/`executionId`; it is the coordinator's inbox-acceptance record.
- **Then** B's own turn ran (2 provider requests carrying the delivered token) and the centre wrote
  its admission `allow` (`axis=fs.read`, `instanceId = agentId = B`, locator = B's in-lane file,
  `at=…40.623Z`, i.e. **~113 ms AFTER** the ack at `…40.510Z`) into **B's own**
  `<instanceId>.facts.jsonl` (18 → 20 facts), plus a `completed` execution and B's in-lane bytes in
  B's transcript.
- **Error paths**: unknown member → `TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED` (typed, 0 provider
  requests); archived member (`member.archive` → `ARCHIVED`) → `TEAM_RUNTIME_WORK_STATE_REJECTED`
  (typed, 0 provider requests, 0 executions added); duplicate send of the same `requestToken` → a
  SECOND durable coordination (new intent 41 / confirmation 42: `send-message` delivery is
  at-least-once, not de-duplicated by token) with 0 provider requests at the ACK and still exactly
  ONE `completed` execution for the delivered call; `member.restore` → `SETTLED` and the delivery is
  served again; the product's Stop during a DELIVERED turn → the call's fact is
  `ADMISSION_STOPPED`, settlement `REFUSED`/`not-started`, never a completion.

**What this judge does NOT claim**: it is not a real-model claim (the model is the scripted mock), not
a candidate claim (DEV-LIVE), and not a multi-user authority claim (the operator is the per-DSH_HOME
authenticated human whose claim must be an owned root). The delivery's *timing* relative to the ack is
measured by durable fact timestamps, not by assuming scheduling.

## Fixtures (disclosed) and what is NOT a fixture

Fixture: the model is the shared scripted mock (`packages/tools/harness/mock-deepseek.mjs`) — including
the deliberate in-lane reads that keep A's turn live; the fixture files; the `/__p6t6/state` polling.

NOT fixture: the shipped governed preset row, the realm provider, the member-I/O compiler, the provider
guard, the ONE admission centre, the durable permission mutation authority, the ControlService and the
host `session/cancel` Stop. The blueprint is test-authored (two templates, each with its own
`memberIoCeilings` read lane; worker-a also declares an exact `ask` locator and `request-control` in its
envelope, which the centre's ask path requires — measured: without it the ask is
`ADMISSION_APPROVAL_REQUEST_FAULT`). The round-71 widening attempt uses the SAME authoring: the compiled
ceiling is test-authored, the mutation path that refuses to exceed it is the shipped one.

## Artifact map

| path | content |
| --- | --- |
| `runs/boot01`, `runs/boot02` | per-boot run record, summary, transcripts, member session logs (byte copy), guard facts, both centre ledgers, settlement records, probes (including `widening`), counters, host log tail |
| `driver.log` | full driver log (append-only) |
| `run-ledger.jsonl` | DEV-LIVE budget/start/settle rows (append-only) |
| `agreement.json` / `agreement.txt` | the two-boot agreement table (`agreeing=true`) |
| `driver-digest.json` | HEAD, host pin, driver sha256, !!js substitutions, exact command |
| `host-tree-porcelain.txt` | pinned host tree porcelain after the run (`empty`) |
| `driver/logs/<world>/instance-port*.log` | the raw host logs (one per boot) |
| `plan-patch.yml` | host-free `--plan` composition (no World) |
| `archive/` | every earlier `runs/` of THIS driver, moved aside by archive-before-start |

## What this does NOT prove

- Any candidate/product-proven status: everything is `DEV-LIVE`.
- That an overlay ALLOW can be minted and enforced at all — direction (d) measures the refusal, and
  nothing here claims the widening shape is reachable.
- That a stopped call can be observed from the Team UI: the Stop was issued through the same public
  `session/cancel` RPC the button issues, not by clicking the button.
- Runtime team creation over the remote plane on THIS driver (the Team here is the boot-created one;
  `team.create` over S6 is measured by the D1 driver, round 74), and `member.create` over S6 is proven
  at the production port (E3 + ADM-86), not live.
- That the mock's interleaving equals a real model's timing; only that the PRODUCT accepted and served
  two member turns whose request windows overlap.
