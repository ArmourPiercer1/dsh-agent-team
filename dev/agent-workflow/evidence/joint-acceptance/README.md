# Joint acceptance — the Preview surface (JS-1 / JS-2, 2026-11-12)

**Evidence class: DEV-LIVE.** Not CANDIDATE-C2, not a frozen candidate, not a
release gate. This record can never produce a `V@B = yes` claim;
`osLevelNetworkIsolationClaimed: false`. Every verdict below is computed from a
durable product fact or a model-visible tool result — never authored.

## Two measurements, in order — read this first

| record | tree measured | arm counts | headline |
|---|---|---|---|
| **PRE-FIX** (the falsifier) | `origin/master` @ `d8490f74d` + PD41-ABORT-CLASS, **#734 not applied** | 8 PASS / 2 FAIL / 1 NOT_REACHED | one product defect: the adopted native `bash` is owned by the plane but not placed, so every governed shell call is refused at the dispatch door |
| **POST-FIX** (current) | `origin/master` @ `4075c67ad` (#734 merged) + PD41-ABORT-CLASS | **10 PASS / 1 FAIL / 0 NOT_REACHED** | the shell lane is repaired; the decisive crash-window arm now runs, and it fails ONE pre-registered clause: the `parameter-permission` leg's consumed allow is left silently unsettled |

`#734` is the **only** product change between the two measurements; the kit is
identical (the same driver, the same arms, the same two fresh worlds). Both
records are `DEV-LIVE` (no `V@B`, never CANDIDATE-C2). The pre-fix runs are kept
verbatim as the falsifier; the post-fix runs are
[`joint-v2-postfix-run1/`](joint-v2-postfix-run1/) and
[`joint-v2-postfix-run2/`](joint-v2-postfix-run2/), with
[`joint-v2-postfix-agreement.json`](joint-v2-postfix-agreement.json).

**Post-fix verdict: NO** — one arm fails, on a different (and now precisely
localised) product defect than the one the falsifier caught.

**Pre-fix verdict: NO** — the reason was ONE product defect, and it is not the
defect this kit was built to catch. The kit drives all eleven arms
J01–J11 on one `schemaVersion: 5` Team (both `memberIoCeilings` and
`reviewRouting` on the same document), twice, on two fresh `DSH_HOME` worlds;
the two runs agree field-by-field. Eight arms pass, two fail, one is
`NOT_REACHED`, and all three non-PASS arms trace to the same root cause:

> **#730's adopted-native `bash` is never bound into the centre approval
> table.** The model-visible `bash` is the pinned native definition, and under
> `nativeBashAdopted` the plane deliberately places no `bash` definition — but
> it still declares the name kernel-owned, so the dispatch door finds
> `identityFor('bash') === null` and refuses every governed shell call BEFORE
> its Body. The ask → allow → consume → decision lane is intact; only the
> execution is refused.

That is `FAIL J04` (the arm that exists to prove the native mount) and
`FAIL J05` (its consumed allow settles `failed`, never `succeeded`). `J10`
then has no window to crash inside: a governed body never starts, so the
crash-settlement arm is `NOT_REACHED` with the measured refusal as its reason,
not a fabricated verdict. The fix is a product change — the adopted native name
must stop being plane-owned so the native admission edge published by the row
assembly is the only gate — tracked as **PR #734**, not applied on this tree.

This tree is **`origin/master` @ `d8490f74d` + the PD41-ABORT-CLASS lane**
(rebased; no upstream edits, `CORE PATCH BUDGET = 0`), i.e. the **PRE-FIX**
state. The same kit, unchanged, is the post-fix instrument.

### PRE-FIX arm table (run 1 / run 2 — identical)

Raw: [`joint-v2-prefix-run1/joint-verdicts.json`](joint-v2-prefix-run1/joint-verdicts.json),
[`joint-v2-prefix-run2/joint-verdicts.json`](joint-v2-prefix-run2/joint-verdicts.json),
and the field-by-field agreement
[`joint-v2-prefix-agreement.json`](joint-v2-prefix-agreement.json)
(`verdictsAgree: true, detailsAgree: true`).

| arm | run 1 | run 2 | proposition | measured |
|---|---|---|---|---|
| **J01** | **PASS** | **PASS** | one v5 Team carries both families: `memberIoCeilings` + `reviewRouting` | `team.create=200 admitted`, `schemaVersion: 5`, both families read back true, blueprint hash measured per run |
| **J02** | **PASS** | **PASS** | the Member ceiling mods the realm's fs: a write inside the root is allowed | inside file written; 1 `allow` guard fact |
| **J03** | **PASS** | **PASS** | the same ceiling denies outside the root | 1 write deny; the outside path does not exist |
| **J04** | **FAIL** | **FAIL** | a governed Member's `bash` is the pinned native definition with only `execute` wrapped, over a Member-bound PTY | `bashCalls=1`, `realmTerminalFacts=0`; the call is refused at the dispatch door (see the defect) |
| **J05** | **FAIL** | **FAIL** | one approval request → one consumption → one OBSERVED execution | `consumption=1 executionResults=1 outcomes=failed` — the allow was consumed and the body was refused |
| **J06** | **PASS** | **PASS** | the review ask is routed to the Officer, decided by the Officer, and carries the bound identity | `reviewAuthority=leader`, `routedToOfficer=true`, `identityCarried=true`, `legDecided=true`, `whenOfficerUnavailable=hold` (unit-pinned) |
| **J07** | **PASS** | **PASS** | Goal from a DIRECT HUMAN input: create → get → edit, ≥2 automatic rounds, human Stop → durable paused, no continuation | revision 2 + `edited` objective, `roundsStarted=2→2`, Stop 200, `paused→paused`, the 2nd round held in flight while the Stop lands |
| **J08** | **PASS** | **PASS** | a relayed (non-human) turn cannot create a Goal and no Goal row exists | `GOAL_TOOL_AUTHORITY_REQUIRED` (the exact sentence `this goal operation requires a direct human turn on a top-level agent`), `goal=null`; the same turn's shell is refused by J04's defect (disclosed, not folded into this verdict) |
| **J09** | **PASS** | **PASS** | the Sticky Stop survives a review wake: the latch is written on the Stop and a SECOND real ask raises no new wake | `stopped-*.json` present, marker bytes identical after the second ask, `wakes=4→4`, `secondAskLegs=1`, `askIsReal=true`, the held wake released by the driver after the Stop |
| **J10** | **NOT_REACHED** | **NOT_REACHED** | cold recovery: SIGKILL mid-body, restart the same `DSH_HOME`, no duplicate execution, no replayed consumed allow, crash-window settlement `unknown` | **undrivable on this tree**: every governed shell body is refused before it starts (J04), so there is no mid-body window to crash inside. A crash before the body would measure the request lane, not the settlement lane — refused as a measurement, not redefined |
| **J11** | **PASS** | **PASS** | an approval allow is one-shot: exactly one consumption fact per request | `consumption facts = 1` for the request |

Counts: **8 PASS / 2 FAIL / 1 NOT_REACHED** in each run.

Everything above is `DEV-LIVE`. No arm produces, and none may be cited as, a
`V@B` or CANDIDATE-C2 record.

## The defect, precisely (falsifier for a merged regression)

Measured twice, on two fresh worlds, and independently with the kit's goal
template compiled out (the shell lane's state is identical), so this is neither
a kit bug nor an environment artefact:

1. The shipped composition sets `nativeBashPty: true`
   (`packages/runtime/src/plugin/host.ts:2155-2176`), so
   `a5NativeBashAdopted` is true
   (`packages/runtime/src/plugin/live/agent-bindings.mjs:3144,3347`).
2. Under adoption the plane excludes its own placed `bash` definition
   (`packages/runtime/src/plugin/live/team-tool-plane.mjs:1755,1770`), so
   `placedByName.get('bash')` is `undefined`.
3. The plane still declares `bash` kernel-owned (`seamOwned` keeps the shell
   family's claim, `team-tool-plane.mjs:1895-1900`) and `identityFor` resolves
   through `ensureApprovalEntry`
   (`team-tool-plane.mjs:1968-1972` → `approval-entry-binder.mjs`), whose
   `placedDefinition('bash')` is `undefined` ⇒ `null`.
4. The dispatch door refuses: `packages/runtime/tool-dispatch/install.ts:1041-1059`,
   code `TOOL_BINDING_UNVERIFIED`, reason `DEFINITION_DRIFT`, message
   `team tool guard: "bash" is kernel-owned and the center approval table no
   longer backs its live definition (table unbound, resolving def#34)`.

Why it was not caught earlier: #730's own verification is a host-free contract
suite (`tests/world-factory/a5sf-native-bash-preservation.test.mjs`, 15/15) that
mounts the native terminal face and the plane, never the dispatch door; and the
2026-11-11 `j05j06-run1/run2` evidence that shows `PASS J04` was produced
**before** #730 merged. This kit is the falsifier: it fails the merged change on
the shipped path.

**Not fixed here** (no scope reduction, no workaround, `CORE PATCH BUDGET = 0`).
The product fix is PR #734.

## POST-FIX: `master` @ `4075c67ad` (#734 merged) — 10 PASS / 1 FAIL

Raw: [`joint-v2-postfix-run1/joint-verdicts.json`](joint-v2-postfix-run1/joint-verdicts.json),
[`joint-v2-postfix-run2/joint-verdicts.json`](joint-v2-postfix-run2/joint-verdicts.json),
agreement [`joint-v2-postfix-agreement.json`](joint-v2-postfix-agreement.json)
(`verdictsAgree: true, detailsAgree: true`).

| arm | run 1 | run 2 | what changed / what was measured on this tree |
|---|---|---|---|
| **J01** | PASS | PASS | unchanged: one v5 Team with both `memberIoCeilings` and `reviewRouting`, `team.create=200` |
| **J02** | PASS | PASS | unchanged: inside-ceiling write allowed, 1 allow fact |
| **J03** | PASS | PASS | unchanged: outside-ceiling write denied, nothing on disk |
| **J04** | **PASS** | **PASS** | **repaired by #734**: `bashCalls=1 pinnedDefinition=true bashExecuted=true` — the model-visible `bash` is the pinned definition (one `command` parameter with the pinned description) and its body really ran (`a6-allow-executed`, exit 0) |
| **J05** | **PASS** | **PASS** | **repaired**: `consumption=1 executionResults=1 outcomes=succeeded` — the outcome clause now reads a real success |
| **J06** | PASS | PASS | unchanged: Officer route, bound identity, `team-tool-execute leg=true` |
| **J07** | PASS | PASS | unchanged: human goal, rev 2 + edited, `roundsStarted=2→2`, Stop mid-round → `paused→paused` |
| **J08** | PASS | PASS | unchanged: `GOAL_TOOL_AUTHORITY_REQUIRED` (sentence), `goal=null` |
| **J09** | PASS | PASS | unchanged: Stop latch written, 2nd real ask mints its leg but raises no wake, marker bytes stable |
| **J10** | **FAIL** | **FAIL** | **decisive and now drivable**: `bodyStart="body-started\n"`, `noDuplicate=true`, `noReplay=true`, `execSettledUnknown=true`, `durableSurvived=true`, **`noSilentAbsence=false`** |
| **J11** | PASS | PASS | unchanged: exactly one consumption fact per allow |

Counts: **10 PASS / 1 FAIL / 0 NOT_REACHED** in each run.

### J10's exact failure (the product finding)

The arm opened the crash window inside a running body and killed the Host; on
cold boot of the same `DSH_HOME` it measured, per run:

- the bash body had started (`body-started`, and the marker survived the boot);
- the `team-tool-execute` leg's allow was consumed exactly once, before and
  after the restart, and its crash-window settlement is `unknown`
  (`execution-outcome-unknown` abandonment) — never `succeeded`;
- **no duplicate execution**: the crash marker appears in 2 model requests
  before the kill and 2 after the restart;
- **but the `parameter-permission` leg owes a settlement fact and has NONE**:
  `ppConsumed=1 → 1`, `ppFacts=0` after the restart, with no abandonment.

`packages/runtime/src/plugin/root.ts:2887` is why:

```ts
if (!String(row.correlation ?? '').startsWith('pa:') && row.actionName !== 'team-tool-execute') continue
```

The boot recovery only settles a row whose correlation starts with `pa:` or
whose `actionName` is `team-tool-execute`. A `parameter-permission` row carries
the **call id** as its correlation, so a crash that loses its in-memory
settlement leaves that consumed allow with no durable outcome at all: silently
absent, which is exactly the `noSilentAbsence` clause this arm pre-registered
(and the reason the arm asserts it for BOTH legs). The `team-tool-execute` leg
is settled; the permission leg is not.

This is a product defect on `master` @ `4075c67ad`, not a kit artefact: the
clause was written before the fix, it fails on both fresh worlds, and it fails
only on this one field (`clauses={"noDuplicate":true,"noReplay":true,
"execSettledUnknown":true,"noSilentAbsence":false,"durableSurvived":true}`).

### Second finding (disclosed, not folded into an arm): a relayed member turn's ask cannot be resolved

While making J10 drivable the kit found that the same governed `bash` ask,
minted by a member whose FIRST turn arrives as a human `member.send` relay, is
refused to the assigned Officer:

```
{"status":"rejected","code":"CONTROL_RESOLVER_NOT_AUTHORIZED",
 "message":"ControlService: Member review is not authorized for this leg
 (caller is not a resolver for kind 'leader-approval' — the trusted
 review-facts port produced no facts for this leg) …"}
```

measured on two fresh worlds (and re-verified against the durable rows): the
offending member row reads `lifecycle: CREATED`, while the row whose ask the
Officer CAN decide reads `RUNNING`/`SETTLED`. The facts port refuses at
`packages/runtime/alpha6/assigned-officer-facts.ts:444`
(`if (owner.lifecycle !== 'RUNNING') return null`), so a member created by
`team_create_member` and first driven by `member.send` never becomes a
resolvable operation owner for its own ask, and the leg waits forever.

J10 is therefore driven as a **delegated task** (`team_delegate`), the
production shape the rehearsal uses, so the crash window can open at all; the
relayed shape is available behind `JOINT_J10_RELAY=1` as the diagnostic that
measures the defect above. This is disclosed as a finding, not silently worked
around: the crash-settlement clause J10 exists for is measured on the delegated
shape, and the relay asymmetry is reported here for the product owner.

`J04`'s observable was also corrected on this tree (measurement precision, not
a relaxation): the v1 clause demanded a terminal fact in the REALM sink, but
after #730 the adopted native `bash` takes its admission through the plane's
lane + `paAdmit` and the PTY is mounted on the Member's isolate, so the sink
legitimately records `realmTerminalFacts=0` (both runs). The arm now measures
the two facts its proposition is about — the model-visible definition IS the
pinned one, and the body really executed — and keeps the sink count in the
detail as a disclosure.

## How the runs were made

Each measurement is two runs, on two fresh worlds, with the SAME ports and the
same command; only the tree and the evidence directory differ:

| measurement | tree | ports (run 1 / run 2) | evidence dirs |
|---|---|---|---|
| PRE-FIX | `master` @ `d8490f74d` + PD41 | `3187`/`3496`, `3188`/`3497` | `joint-v2-prefix-run1`, `joint-v2-prefix-run2` |
| POST-FIX | `master` @ `4075c67ad` + PD41 | `3187`/`3496`, `3188`/`3497` | `joint-v2-postfix-run1`, `joint-v2-postfix-run2` |

| | run 1 | run 2 |
|---|---|---|
| host port / mock port | `3187` / `3496` | `3188` / `3497` |
| `DSH_HOME` | fresh world under `tests/homes/` (removed at teardown) | fresh world, same |
| host runtime | `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84` (0.2.0-rc.2) | same |
| composition | `JOINT_PRESET=native`, plane takeover, governed realm, Alpha.6 review routing, **one** `schemaVersion: 5` blueprint with `memberIoCeilings` + `reviewRouting` | same |
| driver | `tests/kits/joint-acceptance-20261111/run-joint-acceptance.mjs` | same |

```bash
node tests/kits/joint-acceptance-20261111/run-joint-acceptance.mjs \
  --worktree "$PWD" --testuse "$PWD/tests/deepseek-harness-test-use" \
  --host-port 3187 --mock-port 3496 \
  --evidence-dir "$PWD/dev/agent-workflow/evidence/joint-acceptance/<dir>"

node tests/kits/joint-acceptance-20261111/compare-two-runs.mjs \
  <run1-dir> <run2-dir> <agreement.json>
```

`compare-two-runs.mjs` requires the VERDICT to agree exactly for every arm and
compares the measured detail after normalizing only identifiers that necessarily
differ between two worlds: the run stamp and the per-world 6-hex home suffix,
ISO timestamps, session/instance/control/goal ids, the blueprint content hash,
`def#N`, home and blueprint paths, the marker hash, observed wait milliseconds,
and the exact round counters where the proposition is a threshold. A semantic
difference survives normalization and would be reported; the normalizations are
listed in the agreement file.

## What the kit measures, and what it deliberately does not

- **J07's Stop** is the production `session/cancel` on the Member's own session
  (the human Stop button), not a direct function call. The second automatic
  round is held in flight (the mock model's reply is withheld) so the Stop lands
  while a round is running — a real Stop, measured by the product's durable
  `roundsStarted`, never by the mock's request list. Without the hold, an
  instant mock model can burn all six rounds in the few hundred ms before the
  Stop lands, and the goal settles `blocked` for a reason the arm is not about.
- **J08's caller** is the real Leader instance id (a machine
  `member.send`/caller `{kind:'instance'}`), and the goal is read back through
  the product's `goals/get` RPC. The refusal CODE is a structured field on the
  tool result; the model sees the sentence, so the arm accepts the code OR the
  exact authority sentence — never `GOAL_TOOL_DRIVER_REQUIRED` (which would mean
  the calling turn was not live at all). The disclosure field records which form
  was observed.
- **J09's "stop the Team"** is measured as the human Stop of the Team's approval
  lane (the review-wake RECIPIENT, i.e. the Officer), because the latch is
  scoped to a reviewer session. The arm proves: the Stop writes
  `stopped-<fnv>.json`, a second REAL ask (a fresh worker, governed bash) mints
  its ask leg but raises no new review wake, and the marker bytes are unchanged.
  The fresh member is required: the first ask leaves its member's turn open on
  the now-Stopped approval, so a second message to the same member queues
  behind the open turn and never reaches the model (measured).
- **J10's clauses** are pre-registered in the driver: no duplicate execution,
  no replayed consumed allow, the crash-window settlement is `unknown` (not
  `succeeded`, not silently absent) for BOTH approval legs, and the durable
  world survived the restart. On a tree where the body starts, the arm is
  drivable; here it is refused as undrivable with the reason printed.
- **The goal worker carries no `permissions` policy.** The A2C-2 permission
  coverage gate (`packages/runtime/src/plugin/live/agent-bindings.mjs`,
  `SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']`) has no reviewed owner for
  `create_goal`/`get_goal`/`update_goal`, so a strict template must deny them —
  which removes the goal family from the template. The arm therefore measures
  the goal tools' own authority on a governed Member, and says so; it does not
  pretend the goal worker is a strict-covered template.
- A template with no `permissions` policy is allow-by-default for shell, so its
  bash mints no approval leg (`askLegsMinted=0` in J08's detail). The review
  lanes are measured on the strict `worker` template (J05/J06/J09).
- **The host sandbox assets were provisioned out of band.** The manifest
  (`tests/world-factory/lib/host-sandbox-assets-manifest.json`) pins
  `bin/glibc/system.node` at `54a9c25c…`/17360 bytes while the clone carried
  `75450f92…`/17352; `provision-host-sandbox.mjs` failed closed on that digest,
  so the working tree's existing `system.node` was kept and the missing
  `bin/landlock-run` was copied from the main checkout. `--check` then reports
  `before-provision=full -> after-provision=full`, `backend: full (usable: true)`.
  This is a test-infra observation (asset manifest drift), not a product fact;
  the two runs record it in each `boot-preflight.json`/`preflight-host-clean.json`.
- **Not claimed**: OS-level network isolation, CANDIDATE-C2 status, `V@B`, or
  any frozen-candidate semantics. `whenOfficerUnavailable: hold` is unit-pinned,
  not exercised here (recorded in J06's detail).

## Superseded records (kept, append-only)

| record | what it measured | why superseded |
|---|---|---|
| [`run1/`](run1/), [`run2/`](run2/) | the v1 driver: `J04`–`J11` were declared but undriven (`NOT_REACHED`), and the composition failed at the native-bash module (`Config` export, `native-bash-tool.mjs:51` → loader `~standard.validate`) | that mount defect was fixed by #730; the v1 verdict text is obsolete |
| [`j05j06-run1/`](j05j06-run1/), [`j05j06-run2/`](j05j06-run2/) | #733's approval-lane evidence: `PASS J04` on the pre-#730 tree, one bound identity per leg | produced BEFORE #730 merged; its `PASS J04` no longer describes the shipped tree, which is exactly what the two runs above falsify |
| [`diagnostic-fs-only/`](diagnostic-fs-only/) | a diagnostic composition with the plane's shell row dropped | not the shipped composition; kept as history |
