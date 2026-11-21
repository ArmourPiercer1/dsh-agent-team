# D2 live driver — three remaining acceptance items over the shipped governed preset

- **Driver**: `tests/world-factory/drivers/d-boot-feasibility/run-boot-d2.mjs` (a copy of the round-61
  driver with the probes replaced; the round-61 driver keeps its own judges and only received the
  `d:native-read-surface` instrument repair described in §14 of `D-BOOT-FEASIBILITY.md`).
- **Command**: `node tests/world-factory/drivers/d-boot-feasibility/run-boot-d2.mjs --boots 2`
- **HEAD at run start**: `b583de6315cae08f34e09e43c1aa281cd771e6f5`; host pin
  `639ed015397290b3745d163aafe02ffee4aa3f84` (porcelain empty before and after both boots).
- **Record class**: `DEV-LIVE`. Nothing here is candidate evidence and no row here can yield `V@B=yes`.
- **Boots**: 2, identical (`agreeing=true`, `differing=[]`). Two distinct Worlds (one per boot), ports
  from the 3180 family, `DSH_HOME` under `tests/homes/`, archive-before-start, teardown by identity,
  one DEV-LIVE ledger row per start (`run-ledger.jsonl`).

## Verdicts

| judge | boot1 | boot2 | what it means |
| --- | --- | --- | --- |
| `d2:multi-member-concurrency` | **PROVEN** | **PROVEN** | two governed Members ran with overlapping model turns, each native `read` admitted inside its OWN compiled lane, guard facts name their own member, ledgers separate; A's cross-member read was refused `LANE_DENY` with zero B bytes |
| `d2:revocation` | **REFUTED** | **REFUTED** | the REQUIRED direction (a revoke refuses the call that previously succeeded and a NEW policy generation appears in the fact) is not implementable at this HEAD; the opposite direction was measured live (see below) |
| `d2:stop` | **PROVEN** | **PROVEN** | a Member turn stopped through the product's own `session/cancel` path ended as the centre's `ADMISSION_STOPPED` (`REFUSED`/`not-started` settlement), never a completion and never `UNKNOWN`; the second Member completed |

The driver exits `1` because one judge is REFUTED. That is the honest exit code of a measurement that
falsifies one REQUIRED clause; it is not an instrument failure (all three judges ran in both boots and the
two boots agree on every measured row).

## Judge 1 — two Members at once (PROVEN)

Measured (boot1; boot2 identical):

- instances `inst-1235q1w1rd1u` (worker-a) and `inst-12x4j4t1rn1g` (worker-b), both admitted;
- concurrency window from the **mock provider's own receive times**, not from driver wall-clock:
  A `23:38:09.118Z .. 23:38:09.740Z`, B `23:38:09.352Z .. 23:38:09.478Z` — B's turn is entirely inside A's;
- A's own in-lane read: admitted, 14 provider guard `allow` facts on
  `workspace/team-a/in-lane-a.txt`, **every** `memberIdentity = inst-1235q1w1rd1u`;
- B's own in-lane read: admitted, 4 guard `allow` facts on `workspace/team-b/in-lane-b.txt`, **every**
  `memberIdentity = inst-12x4j4t1rn1g`;
- A reading `workspace/team-b/in-lane-b.txt`: `🌐 Error: LANE_DENY`, **zero** B bytes in A's transcript,
  and **zero** guard facts for B's locator under A's identity (the centre refused before the Provider);
- A ledger 9 admission facts (7 `allow` for its own in-lane reads + 1 cross-lane `LANE_DENY` + 1
  `ADMISSION_STOPPED` from judge 3), B ledger 5 (4 `allow` + 1 overlay deny);
  every admission fact is `instanceId === agentId` of its own member, and each member has its own
  `<instanceId>.facts.jsonl`.

Note on the design: the 7 in-lane reads in A's first turn are REAL reads of the fixture, not a sleep.
They keep the work unit live long enough for the second Member's turn to interleave — a one-read turn
finished before B was admitted (measured), which would have made "concurrent" an assumption.

## Judge 2 — revocation (REFUTED, with the measured reason and two lawful shapes)

What the product DOES do, measured live through the ONE durable `permissionOverlay` mutation lane
(`team_grant_permission` / `team_revoke_permission` → `GovernanceMutationService.mutatePermission`):

1. pre-read of `workspace/team-b/revocable.txt` → **admitted** (bytes returned);
2. `team_grant_permission` adds `{operationClass: read, matcher: {kind: exact, value: revocable.txt},
   effect: deny}` → `{"status":"permission-mutated", "verb":"grant", "changed":true}`;
3. the SAME read → **refused** `ADMISSION_OVERLAY_DENY` (centre fact + execution fact
   `admission-refusal`);
4. `team_revoke_permission` removes that rule → `{"status":"permission-mutated", "verb":"revoke",
   "changed":true}`;
5. the SAME read → **admitted again** (the only writable effect was the deny that was just removed).

The REQUIRED direction fails exactly here: a revoke cannot narrow authority, because the product's
durable overlay is a **restriction-only** layer.

- `packages/runtime/src/plugin/vnext/overlay-decision.mjs:9` — “it can REMOVE authority, never grant it”;
- `packages/runtime/src/plugin/vnext/admission-port.mjs:498-521` — the overlay is consulted **only** when
  the compiled lane already allows, and its only possible verdict is `ADMISSION_OVERLAY_DENY`;
- `packages/runtime/src/plugin/vnext/centre-install.mjs:94` — the fact’s `policyGeneration` is the
  COMPILED revision fixed at bind; a mutation bumps the overlay generation but does not recompile or
  rebind the member, so all three pre/mid/post facts carry the same `a5sf1:<hash>`;
- `packages/runtime/governance/permission-mutation.ts:435-436` — removing a standing rule “never needs
  expansion authority”; it can only reduce restrictions.

**Missing seam**: an `ALLOW` in the decision path that a revoke can withdraw (and whose generation the
fact can carry). **Two lawful shapes**:

- **(A)** Let the centre's `overlayDecision` return `allow` as well as `deny`, so a durable `ALLOW`
  stands in for a compiled-lane deny and its revoke restores the lane deny (touches
  `overlay-decision.mjs` + `admission-port.mjs`, not the upstream host).
- **(B)** Derive the compiled member lane + centre binding from the overlay snapshot and re-bind on
  generation change (extend the existing A5-M1 authority-generation publication), so a revoked `ALLOW`
  recompiles to deny and the fact carries the new generation.

Neither is wiring-only, so the judge is REFUTED rather than skipped, and it is never reported as a pass.

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
kept for all three judges.

## Fixtures (disclosed) and what is NOT a fixture

Fixture: the model is the shared scripted mock (`packages/tools/harness/mock-deepseek.mjs`) — including
the deliberate in-lane reads that keep A's turn live; the fixture files; the `/__p6t6/state` polling.

NOT fixture: the shipped governed preset row, the realm provider, the member-I/O compiler, the provider
guard, the ONE admission centre, the durable permission mutation authority, the ControlService and the
host `session/cancel` Stop. The blueprint is test-authored (two templates, each with its own
`memberIoCeilings` read lane; worker-a also declares an exact `ask` locator and `request-control` in its
envelope, which the centre's ask path requires — measured: without it the ask is
`ADMISSION_APPROVAL_REQUEST_FAULT`).

## Artifact map

| path | content |
| --- | --- |
| `runs/boot01`, `runs/boot02` | per-boot run record, summary, transcripts, member session logs (byte copy), guard facts, both centre ledgers, settlement records, probes, counters, host log tail |
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
- That the REQUIRED revocation direction works — it is REFUTED here.
- That a stopped call can be observed from the Team UI: the Stop was issued through the same public
  `session/cancel` RPC the button issues, not by clicking the button.
- Runtime team creation over the remote plane (still 405 on a centre-configured row); the Team here is
  the boot-created one.
- That the mock's interleaving equals a real model's timing; only that the PRODUCT accepted and served
  two member turns whose request windows overlap.
