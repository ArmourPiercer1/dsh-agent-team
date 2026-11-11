# Joint acceptance — JS-1 (2026-11-11)

**Verdict: NO.** The single joint driver now exists and ran twice on a real,
pinned Host, but the product composition it exists to prove does not reach its
own arms: with the governed preset carrying `tool-bash` (so the realm can
shadow it with the pinned persistent definition), **no Member can activate**.
The native-bash module re-mount fails with
`Cannot read properties of undefined (reading 'validate')`
(`packages/runtime/src/plugin/live/native-bash-tool.mjs:51` exports
`Config = Object.freeze({})`; the loader resolves
`runtime.Config["~standard"].validate(config)` at
`tests/deepseek-harness-test-use/vendor/cordis/lib/index.js:958`). The
host-free native-bash suite (13/13 PASS) never exercises that path because it
calls `nativeBash.apply()` directly.

**Evidence class: DEV-LIVE.** Not CANDIDATE-C2, not a frozen candidate, not a
release gate. `osLevelNetworkIsolationClaimed: false`.

- Branch: `task/joint-acceptance-20261111`
- Base: `origin/master` @ `b29e10582` (PD-42 gate + PD-41 §719)
- Integration branch consumed as-is: `integration/joint-acc-20261111`
  (origin/master + rebased `task/p01-plane-realm-20261111` (PR #728) +
  `task/pd41-abort-class-20261111` (PR #729) + merged
  `task/native-bash-preservation-20261111` (PR #730))
- Host: pristine `tests/deepseek-harness-test-use` @ `639ed01539`, porcelain
  status recorded per run (`preflight-host-clean.json`)
- Driver: `tests/kits/joint-acceptance-20261111/run-joint-acceptance.mjs`
  (derived from the merged C1 Alpha.6/PD-42 instrument; see its header)
- `CORE PATCH BUDGET = 0` — no product file was edited to make an arm pass.

## The two runs

Both runs are the SAME composition (`JOINT_PRESET=native`, i.e. `tool-bash`
kept so the realm selects `native-bash-tool.mjs`), one Team, one
`schemaVersion: 5` blueprint carrying BOTH `memberIoCeilings` and
`reviewRouting`, plane takeover on, fresh `DSH_HOME` under `tests/homes/`,
sanctioned loopback ports only (3187/3496 and 3188/3497; never `:3080`).

```sh
node tests/kits/joint-acceptance-20261111/run-joint-acceptance.mjs \
  --worktree "$PWD" \
  --testuse /home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-test-use \
  --host-port 3187 --mock-port 3496 \
  --evidence-dir dev/agent-workflow/evidence/joint-acceptance/run1
# run2: the same command with 3188/3497 and …/run2
```

Preflight ran on measured facts and refused nothing: see
`run1/boot-preflight.json` and `run2/boot-preflight.json`
(`verdict: PASS`, host pin, sanctioned ports, world containment, selected
arms J01–J11).

## Two-run field table (the acceptance composition, `JOINT_PRESET=native`)

Every cell is the verdict the driver wrote into `run1/joint-verdicts.json` and
`run2/joint-verdicts.json`. Agreement is exact per arm; the two runs differ
only in port, run id and blueprint hash.

| arm (field) | run1 | run2 | agree |
|---|---|---|---|
| J01 — Team + routing: v5 both families admitted; Officer routed, one team_resolve_control | `PASS` | `PASS` | yes |
| J02 — Governed I/O inside the ceiling: write succeeds + a5sf-guard-consult/1 ALLOW fact | `NOT_REACHED` | `NOT_REACHED` | yes |
| J03 — Governed I/O outside the ceiling: typed deny, zero bytes, deny attributable | `NOT_REACHED` | `NOT_REACHED` | yes |
| J04 — Native bash governed: pinned definition, realm PTY, shared PTY state, second Member separate PTY | `FAIL` | `FAIL` | yes |
| J05 — Approval lifecycle: durable request -> human allow -> one consumption -> one execution -> one execution-result; deny = zero/zero/zero | `NOT_REACHED` | `NOT_REACHED` | yes |
| J06 — Officer identity (F-3): which decider receives parameter-permission vs team-tool-execute; whenOfficerUnavailable honoured | `NOT_REACHED` | `NOT_REACHED` | yes |
| J07 — Goal from direct human input: create/get/update, >=2 automatic rounds, human Stop -> durable paused, no continuation | `NOT_REACHED` | `NOT_REACHED` | yes |
| J08 — Relay refusal: machine team_send_message turn cannot create_goal (GOAL_TOOL_AUTHORITY_REQUIRED), governed call still runs | `NOT_REACHED` | `NOT_REACHED` | yes |
| J09 — Sticky Stop on the review-wake path: latch -> Stop marker -> SIGKILL + cold boot -> identical marker, no wakes/legs | `NOT_REACHED` | `NOT_REACHED` | yes |
| J10 — Cold recovery: Team + Member + Goal + per-leg consumption facts survive SIGKILL; no resurrected turn, no duplicate execution | `NOT_REACHED` | `NOT_REACHED` | yes |
| J11 — No replay: a consumed allow cannot be re-dispatched; a late allow is refused (CONTROL_REQUEST_DECIDED) | `NOT_REACHED` | `NOT_REACHED` | yes |

Counts — run1: `{"PASS": 1, "NOT_REACHED": 9, "FAIL": 1}`, run2: `{"PASS": 1, "NOT_REACHED": 9, "FAIL": 1}`.

`NOT_REACHED` here is the closed-set word for "the prerequisite observable
never existed": with no activating Member, no ceiling consult, approval lane,
Goal turn or review wake can occur. It is not a pass and not a soft fail.

## Raw records (per run)

| file | what it is |
|---|---|
| `boot-preflight.json` | the shared zero-boot preflight over this run's measured facts (`verdict: PASS`) |
| `preflight-host-clean.json` | host pin `639ed01539` + porcelain status at boot time |
| `joint-blueprint.yaml` | the ONE `schemaVersion: 5` blueprint (both families) |
| `joint-create.json` | `team.create` remote response (`fresh-root`, blueprint content hash) |
| `joint-setup.json` | the two `team_create_member` results and the `team_delegate` result — the activation refusal is verbatim here |
| `joint-ledger.json` | the durable control ledger read back from `<DSH_HOME>/storages/team_domain.json` |
| `joint-guard-facts.json` | `a5sf-guard-consult/1` facts on the realm sink |
| `joint-state.json` | p6t6 durable read-back (members, projection) |
| `joint-verdicts.json` | the machine-readable arm table |
| `joint-arms.md` | the human-readable arm table |
| `teardown.json` | DSH_HOME removed, blueprint dir removed, host stopped, mock closed |
| `instance.log` | the Host's own output for the run |
| `mock.log` | the in-process mock model's log |

## Preflight

`boot-preflight.mjs` gates the spawn: the driver writes
`boot-preflight.json` and calls `assertBootPreflight()` BEFORE `spawnHost`.
Both acceptance runs graded `PASS` (host pin `639ed01539`, sanctioned ports
inside `TEST_PORT_RANGES`, fresh `DSH_HOME` under `tests/homes/`, all eleven
arms selected, one declared Officer template). A non-PASS record is a hard
refusal, not a warning.

## Teardown

Each run writes `teardown.json` after the Host is stopped:
`dshHomeRemoved: true`, `blueprintDirRemoved: true`, `hostStopped: true`,
`mockClosed: true`, `keptForDebug: false`. `tests/homes/` therefore contains
no world from these runs.

## NOT MET — why the answer is NO

1. **J04 (and, through it, every Member-dependent arm in the acceptance
   composition).** With `tool-bash` present so the governed realm can shadow it
   with the pinned persistent definition, the realm's route-C re-mount of
   `native-bash-tool.mjs` throws
   `Cannot read properties of undefined (reading 'validate')`.
   `packages/runtime/src/plugin/live/native-bash-tool.mjs:51` exports
   `Config = Object.freeze({})` — an object with no `~standard` validator —
   while the Cordis loader calls
   `runtime.Config["~standard"].validate(config)`
   (`tests/deepseek-harness-test-use/vendor/cordis/lib/index.js:958`). The
   refusal is wrapped as `SERVICE_MOUNT_FAILED` at
   `packages/runtime/team-services/src/mount.ts:1881` and surfaces as
   `TEAM_RUNTIME_DURABLE_WRITE_FAILED` on BOTH the Officer and the worker; the
   `team_delegate` that follows is `target-stale`. The host-free native-bash
   suite (13/13) never catches this because it calls `nativeBash.apply()`
   directly and never goes through plugin-config resolution.
2. **J07–J10 are NOT_REACHED for a second, independent reason:** the joint
   driver in this round does not drive the Goal, relay-refusal, sticky-Stop or
   cold-recovery arcs at all (in the acceptance composition they had no live
   Member either, and the diagnostic composition's live Member was not used to
   drive them). That is a driver gap, recorded here rather than hidden; it
   would have to be closed even after the mount defect is fixed.
3. The two-run agreement is exact, so the failure is deterministic, not a
   flake.

### What the diagnostic composition shows about the rest

`JOINT_PRESET=fs-only` drops `tool-bash` (the plane-owned spelling) and lets
the Member activate. That run is a DIAGNOSTIC control, not one of the two
acceptance runs, and it shows the P01/PD-42 repair is real — and what remains
broken underneath (`diagnostic-fs-only/joint-verdicts.json`):

| arm | verdict | measured detail |
|---|---|---|
| J01 | `PASS` | team.create=200 admitted=true blueprintHash=sha256:69274dd4e3b10f0db21c194a1e1df761ce29fa3bd3abf83be9d6748e687f5ad3 memberIoCeilings=true reviewRouting=true schemaVersion=5 |
| J02 | `PASS` | inside="pd42-inside-2026-11-11T21-34-10-h3189-r8e7c91" allowFacts=1 |
| J03 | `PASS` | writeDenies=1 outsideExists=false |
| J04 | `FAIL` | bashCalls=1 realmTerminalFacts=0 |
| J05 | `FAIL` | request=ctrl-0zusz2v0e6l23017jxl211yg consumption=1 executionResults=0 outcomes= |
| J06 | `FAIL` | parameter-permission request=ctrl-0zusz2v0e6l23017jxl211yg reviewAuthority=leader decider={"instanceId":"inst-leader","kind":"instance","role":"leader"} team-tool-execute leg=false (F-3 is recorded, never fixed here) |
| J07 | `NOT_REACHED` | the joint driver did not drive this arm in this composition (see the README for the exact next step) |
| J08 | `NOT_REACHED` | the joint driver did not drive this arm in this composition (see the README for the exact next step) |
| J09 | `NOT_REACHED` | the joint driver did not drive this arm in this composition (see the README for the exact next step) |
| J10 | `NOT_REACHED` | the joint driver did not drive this arm in this composition (see the README for the exact next step) |
| J11 | `PASS` | one-shot consumption facts for ctrl-0zusz2v0e6l23017jxl211yg: 1 |

## F-3 — Officer identity (recorded, never fixed here)

In the diagnostic run the guarded ask's `parameter-permission` leg is routed to
**the Leader**, not the Officer: `reviewAuthority: "leader"`, decider
`{"instanceId":"inst-leader","kind":"instance","role":"leader"}`, with
`wakes: 0` on the Officer and **no `team-tool-execute` leg at all**. The
blueprint declared `reviewRouting.officerTemplateId: officer`,
`ordinaryToolApprovals.default: officer` and `whenOfficerUnavailable: hold`;
`hold` was therefore never exercised, and the observed routing contradicts the
declaration. The same observation was made on this integration branch by the
pre-driver probe archived under `diagnostic-fs-only/probe1/`.

## What would have to change

| arm | change required |
|---|---|
| J04 | `native-bash-tool.mjs` must export a real `Config` schema (or omit `Config`), so Cordis' `Config["~standard"].validate()` has a validator; then a live run can test the pinned identity, the shared PTY and the second-Member PTY. |
| J02 / J03 / J11 | nothing known-broken beyond the blocker: they become reachable the moment a Member activates in the native composition. |
| J05 | in the diagnostic composition the allow is consumed once but **no `control-execution-result` fact** is written (`consumption=1`, `executionResults=0`); that is a separate product defect to fix. |
| J06 | `whenOfficerUnavailable` / `officerTemplateId` are not honoured for `parameter-permission`: the Leader receives the leg. Routing must be repaired (or the declaration must fail loudly) before the Officer arc can be CANDIDATE-C2. |
| J07–J10 | the driver must implement the Goal (create/get/update, >=2 auto rounds, human Stop), relay-refusal, sticky-Stop and cold-recovery arcs on the live Member — not implemented in this round. |

## Release-notes paragraph (text only — `RELEASE-NOTES-0.1.6.md` was not edited)

> **Joint acceptance (DEV-LIVE, 2026-11-11) — not met.** The first single joint
> driver (11 arms, one `schemaVersion: 5` blueprint carrying both
> `memberIoCeilings` and `reviewRouting`, governed realm + Alpha.6 route +
> plane takeover) ran twice on the pinned Host and agreed exactly: `team.create`
> admits the two-family document, but with `tool-bash` present — the
> composition that lets the realm shadow the shell with the pinned persistent
> definition — every Member activation fails at the native-tool re-mount
> (`Cannot read properties of undefined (reading 'validate')`;
> `native-bash-tool.mjs` exports a non-schema `Config`). The fs-only diagnostic
> composition confirms the PD-42 ceiling repair (inside write + ALLOW fact;
> outside write `IO_WRITE_DENIED`, zero bytes), but shows the
> `parameter-permission` leg routed to the Leader instead of the Officer and an
> allow consumed without a durable `control-execution-result`. The joint promise
> therefore remains NOT MET; this record is DEV-LIVE and is not a candidate
> claim.
