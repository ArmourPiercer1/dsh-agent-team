# WP2 — the Alpha.6 × Alpha.5-governed × Goal conjunction, measured for two input provenances

**Task**: WP2 (P0) of the v0.1.6 closing round.
**Product under test**: `candidate/v0.1.6-2` @ `bb3c158eb1f76f8db429da01e9a4c5a0e118ca90`.
**Host**: pristine pinned `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84` (`0.2.0-rc.2`), porcelain empty before and after.
**Record class**: `CANDIDATE-C2` (citing the candidate SHA above). The class is necessary, not sufficient: this run makes no `V@B=yes` claim. `n=2` per arm is **agreement, not stability**.
**Instrument**: [`tests/kits/wp2-a6-governed-goal/wp2-a6-governed-goal.mjs`](../../../../tests/kits/wp2-a6-governed-goal/wp2-a6-governed-goal.mjs) (new in this lane; no product file changed — `CORE PATCH BUDGET = 0`, upstream porcelain empty).
**Runs**: `run-arm1-r1/`, `run-arm1-r2/`, `run-arm2-r1/`, `run-arm2-r2/` — four fresh Worlds, four fresh `DSH_HOME`s, all torn down.

---

## 1. Result first

| question | answer |
| --- | --- |
| Does a **direct human** input authorise the upstream Goal trio on an Alpha.6-on **governed** Member? | **YES, PROVEN in both runs.** `source.kind='user'` → `create_goal` created `goal-…` rev 1 `active`; `get_goal` agreed (same id, rev 1); `update_goal {action:'edit'}` took it to rev 2 and kept `active`; the goal then ran **2 automatic rounds** on the real upstream goal-round driver; a **human Stop** (`session/cancel`, the UI stop button) left the durable goal `paused` at rev 3 with `activation: "disarmed"` and **0 further rounds** in a 6 s window. |
| Does a **machine Team relay** authorise it, as documented? | **NO — and correctly so, PROVEN in both runs.** The relay turn's `user/message` carries `source.kind: 'plugin:dsh-agent-team'`; `create_goal` returned `isError: true`, `error.code: GOAL_TOOL_AUTHORITY_REQUIRED`, text `Error: this goal operation requires a direct human turn on a top-level agent`. `goals/get` = `null`; **zero** `goal/change` rows. The refusal did not poison the turn: a governed `bash` in the same turn ran (allow fact) and, in a later **work-delivery** turn, the *same* Member created a goal normally — so the refusal is scoped to the relay provenance, not to goals. |
| Are Alpha.5 governance facts present for that Member's calls **in the same run**? | **YES.** `a5sf-guard-consult/1` rows with `realm: "member"`, `memberIdentity: <the Member instance>`, `decision: "allow"`, `tool: "bash"`, and `callId: "call-wp2-a1-round-1"` — i.e. the governance fact names the **exact goal-round call** it governs. |
| Is the literal three-way **single-Team** conjunction measured? | **NO — it is impossible on this candidate, by design, and this kit proves the refusal instead** (see §3). The measurement here is the closest honest conjunction; the approximated conjunct is named in §3. |

The important product finding is the **asymmetry**: under the Alpha.6 opt-in the *same* Team wire is authoritative when a human sends and unauthoritative when a machine relays — and the machine turn is still a fully working governed turn. Nothing in the measured surface pretends the relay was human.

---

## 2. The instrument

One Host row, one `DSH_HOME` per run (`tests/homes/u5wp2a6goal-<stamp>`), a fresh mock model
in-process, the pinned built Host as a child process, and the shipped
`a5sf-governed-member` preset inside the World's **install graph** (`profiles/web/node_modules/dsh-agent-team
-> this tree`; the preset resolves subpath rows through the profile module graph exactly as an
install does — no row name is rewritten).

Row configuration (`composition.json` in every run dir, verbatim):

```
rootSessionId          session-wp2-a6-boot          # the Alpha.6 root Team
blueprintSource        <- home/blueprints/anchor.yaml   # v5, reviewRouting enabled, Officer template
blueprintDir           <- home/blueprints
memberPresetId         a5sf-governed-member          # the shipped governed preset
a5sfGovernedRealm      true                          # Alpha.5 neutral opt-in
a5sfEvidencePath       <- home/a5sf-consult.jsonl    # guard-consult sink
alpha6ReviewRouting    true                          # Alpha.6 opt-in (fail-closed boot)
alpha6WakeIntentPath   <- home/alpha6-wake-intents
seedMembers            []
```

The governed Team (`session-wp2-governed-team`) is **created on the same Host row** through
`team.create` with a **v4** blueprint that declares `memberIoCeilings` for its `worker` template.
The Leader delegates that worker once (async work delivery); the worker is the governed Member whose
turns both arms measure.

Provenance is driven through the **real product ports**, never by forging a source:

- Arm 1: `member.send` with `caller: {kind:'human', humanId: <owned team root>}` — the messaging
  coordinator resolves this to `attribution.fromHumanId`, and the delivered turn is
  `source.kind='user'`.
- Arm 2: `member.send` with `caller: {kind:'instance', instanceId: <durable Leader instance>}` —
  the **same** `sendTeamMessage` port the `team_send_message` tool invokes, resolved as a machine
  relay (`callerRole: "leader"` in the RPC outcome).
- Control: `member.followup` with the same machine caller — the product's **work delivery** port,
  which deliberately keeps `{kind:'user'}` for Alpha.5 goal authority.

### Ports — disclosed deviation from the task text

The task text said "use 1600x/1605x, loopback only". This kit instead leases every Host/mock port
from the World factory, whose only sanctioned bands are `HOST_PORT_BANDS 3181-3199, 13000-13049` and
`MOCK_PORT_BANDS 3491-3500, 13050-13099` (`tests/paths.mjs`, the repo's single source of truth;
`docs/TEST_METHODS.md`). The 1600x band is **outside** `TEST_PORT_RANGES` and the factory is the only
leaser, so using it would bypass sibling-lane collision handling. Measured ports for the record:
arm1 r1/r2 `3192`, arm2 r1/r2 `3188`; mocks `13055`. Loopback only; `:3080` never bound. The
dev-live slot was acquired and released per run.

---

## 3. The conjunction: what is exact and what is approximated

**The literal conjunction "one Team that is simultaneously an Alpha.6 v5 review-routing Team, an
Alpha.5 governed-realm Team, and a Goal-running Team" is impossible on this candidate.** It is not a
missing feature of the test harness; it is a product refusal, and this kit measures the refusal
itself (`plane-probe.json`, host-free, reproducible):

```
v4-governed(main) : ok, schemaVersion 4, members ["worker"]
v5-alpha6(anchor) : REFUSED schemaVersion 5
  code    MEMBER_POLICY_WITHOUT_BLUEPRINT
  reveal  a5sfMemberPolicies.members
  detail  the bound blueprint for team 'team.wp2.a6.anchor' is schemaVersion 5 and declares no v4
          memberIoCeilings family; there is no Member ceiling to derive, so a declaration has no
          blueprint to narrow
```

Reason: the governed provider derives every Member ceiling from the Team's **bound** blueprint via
`deriveProductRealmPlanFromBlueprint` → `derivedMembersOf`, which refuses `schemaVersion !== 4`
(`packages/runtime/team-services/src/product-assembly.ts`), while the Alpha.6 opt-in requires a
**v5** bound blueprint (`packages/runtime/src/plugin/root.ts`, fail-closed). Release notes §4.8 and
PD-42 (`PLANES-DISJOINT`, F-1) record the same constraint. One Team runs one plane.

So this kit measures the **closest honest conjunction**, and names the approximation:

| conjunct | status in this measurement | why |
| --- | --- | --- |
| **Alpha.6 opt-in** (`alpha6ReviewRouting: true`, v5 root anchor with `reviewRouting.enabled`, exactly one Officer template, absolute wake-intent path) | **EXACT — ON.** Boot is fail-closed (`TEAM_PLUGIN_CONFIG_INVALID` if the plane cannot compose), so a running Host carrying this row *is* the composed plane. The A6 attribution branch is measured live: the machine relay's provenance is `plugin:dsh-agent-team`, which the product emits **only** when `config.alpha6ReviewRouting === true && attribution.fromHumanId === undefined` (`live/agent-bindings.mjs:5452-5460`). | matching the task's "A6 ON" |
| **Alpha.5 governed Member** (shipped preset + `a5sfGovernedRealm: true`; guard-consult facts; confined `bash`) | **EXACT.** | the row and the facts are in §5 |
| **Goal** (`create_goal` / `get_goal` / `update_goal`, upstream goal-round driver, human Stop) | **EXACT.** | the real upstream tools and driver on that Member |
| **Officer routing *for the governed Team's own reviews*** | **APPROXIMATED — not active there.** The governed Team is a **v4** Team; `routingForRoot` answers `null` for a non-v5 root, so a review raised in it would hold `config-invalid` instead of routing to an Officer. The arms raise no review. The A6 plane's Officer routing/wake listeners are armed at the **boot root** (the v5 A6 Team), which carries no Member instance. | PD-42 / F-1 above |

**Not exercised, therefore not claimed:** an Officer-routed review wake in the same Team as a
governed Member; the A6 execution plane (`C1_PLANE_TAKEOVER`) and its confined execute step; Sticky
Stop semantics under A6 (already measured by C1/A56 lanes). **Code-read, not measured here:** the
`config-invalid` hold a v4-Team review would get. What *would* be needed to make the literal
conjunction measurable is a product change, not a test change: `derivedMembersOf` would have to
derive Member ceilings from a v5 blueprint (or v5 would have to carry the v4 `memberIoCeilings`
family forward), i.e. PD-42 closed.

---

## 4. Arm 1 — direct human input

Procedure: human `member.send` (body `WP2_ARM1_HUMAN_GOAL`) → the Member's model calls
`create_goal` → `get_goal` → `update_goal {action:'edit'}` in that same human-authorised turn → the
turn ends and the goal-round driver starts rounds (each round: one governed `bash`) → the driver
waits for ≥ 2 rounds → **human Stop** on the Member's own session → wait for a non-active phase, then
observe a 6 s quiet window.

| fact | run 1 | run 2 |
| --- | --- | --- |
| run record | `wp2-a6-governed-goal-arm1-r1-2026-11-11T15-04-23-799Z` | `wp2-a6-governed-goal-arm1-r2-2026-11-11T15-06-51-311Z` |
| class / world / Host port | CANDIDATE-C2 / u5wp2a6goal-20261111T15-04-23Z / 3192 | CANDIDATE-C2 / u5wp2a6goal-20261111T15-06-51Z / 3192 |
| Member instance / session | `inst-1p7lorv1xehh` / `session-team-child-7b1ea77a906618f696519591761425b9` | `inst-1ycjn2l1e5au` / `session-team-child-fa8d3fb8d87b7218fc897c68314b90ca` |
| starting `user/message` source.kind | `user` | `user` |
| `create_goal` → goal / revision | `goal-622c1723-e102-4b4b-bd3b-22dcd2ae9162` / rev 1 | `goal-95649b06-926a-4776-bda5-2febf6febe9b` / rev 1 |
| `get_goal` (tool result) agrees | `goal-622c1723-e102-4b4b-bd3b-22dcd2ae9162` / rev 1 | `goal-95649b06-926a-4776-bda5-2febf6febe9b` / rev 1 |
| `update_goal {action:'edit'}` | rev 2 / phase `active` | rev 2 / phase `active` |
| automatic goal rounds | 2 | 2 |
| human Stop (`session/cancel`) | HTTP 200 | HTTP 200 |
| rounds after Stop (6 s window) | 0 | 0 |
| durable final goal | phase `paused`, rev 3, `activation: "disarmed"`, roundsStarted 2 | phase `paused`, rev 3, `activation: "disarmed"`, roundsStarted 2 |
| pause row (durable) | `pause` rev 3 / `paused` / roundsStarted 2 | `pause` rev 3 / `paused` / roundsStarted 2 |
| guard-consult allow facts for the Member | 4 (`{"bash":4}`) | 4 (`{"bash":4}`) |

### Agreement (arm 1)

| assertion | run 1 | run 2 | agreement |
| --- | --- | --- | --- |
| `wp2-a6:arm1-create-authorized` | **PROVEN** | **PROVEN** | agree |
| `wp2-a6:arm1-goal-durable` | **PROVEN** | **PROVEN** | agree |
| `wp2-a6:arm1-update-advances` | **PROVEN** | **PROVEN** | agree |
| `wp2-a6:arm1-rounds` | **PROVEN** | **PROVEN** | agree |
| `wp2-a6:arm1-human-stop-terminal` | **PROVEN** | **PROVEN** | agree |
| `wp2-a6:arm1-governed-facts` | **PROVEN** | **PROVEN** | agree |

What each assertion means:

- `wp2-a6:arm1-create-authorized` — a direct-human member.send on the Alpha.6-on governed Member AUTHORISES the upstream create_goal
- `wp2-a6:arm1-goal-durable` — the goal is durably created and the goal service agrees with the tool result
- `wp2-a6:arm1-update-advances` — update_goal advances a phase/revision (edit is the direct-human update)
- `wp2-a6:arm1-rounds` — the goal runs >= 2 automatic rounds on the real upstream goal-round driver
- `wp2-a6:arm1-human-stop-terminal` — a human Stop leaves the durable goal non-active and starts no further round
- `wp2-a6:arm1-governed-facts` — the Member's governed tool calls are recorded in the same run

---

## 5. Arm 2 — Team relay input

Procedure: machine `member.send` (body `WP2_ARM2_MACHINE_RELAY`, caller = the durable Leader
instance) → the Member's model calls `create_goal` (must be refused) → a governed `bash` in the same
turn (must run) → turn ends. Then a **control**: `member.followup` work delivery
(`WP2_ARM2_WORK_CONTROL`) → `create_goal` must be authorised → goal created → the run stops it so
nothing keeps running.

### The refusal, verbatim (identical in both runs)

```
tool/result  callId call-wp2-a2-create-goal
  isError true
  error.code  GOAL_TOOL_AUTHORITY_REQUIRED
  text        Error: this goal operation requires a direct human turn on a top-level agent
goal/change  (none)
goals/get    null
user/message source.kind  plugin:dsh-agent-team
```

`GOAL_TOOL_AUTHORITY_REQUIRED` is the upstream `requireDirectHuman` refusal
(`tests/deepseek-harness-test-use/packages/goal/tool-goal/src/authority.ts`), reached because the open
turn's only `user/message` is machine-sourced. The Alpha.6 attribution branch is what makes that so;
the same source records that with the opt-in absent/false this port restores `{kind:'user'}` and the
relay-driven turn keeps direct-human goal authority.

### The refusal is scoped — the same turn still works

| probe | measured |
| --- | --- |
| governed `bash` on the refused turn | `isError:false`, `kind:"confined-terminal"`, exit 0, stdout `WP2_ARM2_GOVERNED_BASH_OK` + `WP2_WORKSPACE_VISIBLE` |
| guard-consult facts for that Member | 11 `allow` rows, `realm:"member"`, `tool:"bash"` (relay bash + control rounds) |
| work delivery (`member.followup`) authorises `create_goal` | yes, `source.kind='user'`, goal rev 1 created |

| fact | run 1 | run 2 |
| --- | --- | --- |
| run record | `wp2-a6-governed-goal-arm2-r1-2026-11-11T15-04-45-845Z` | `wp2-a6-governed-goal-arm2-r2-2026-11-11T15-07-07-392Z` |
| class / world / Host port | CANDIDATE-C2 / u5wp2a6goal-20261111T15-04-45Z / 3192 | CANDIDATE-C2 / u5wp2a6goal-20261111T15-07-07Z / 3192 |
| Member instance / session | `inst-1kw4t9c128ya` / `session-team-child-93d9dd66821d7ffe62dc280e6749aae9` | `inst-1jsr8as06zr3` / `session-team-child-c862b88ff18eb41d198d2937d716f500` |
| relay `user/message` source.kind | `plugin:dsh-agent-team` | `plugin:dsh-agent-team` |
| `create_goal` result | isError `true`, code `GOAL_TOOL_AUTHORITY_REQUIRED` | isError `true`, code `GOAL_TOOL_AUTHORITY_REQUIRED` |
| refusal text | `Error: this goal operation requires a direct human turn on a top-level agent` | `Error: this goal operation requires a direct human turn on a top-level agent` |
| `goals/get` / durable `goal/change` rows | `null` / 0 | `null` / 0 |
| governed `bash` on the same turn | isError `false`, confined terminal, exit 0 | isError `false`, confined terminal, exit 0 |
| guard-consult allow facts (relay + control rounds) | 11 (`{"bash":11}`) | 11 (`{"bash":11}`) |
| CONTROL: work delivery source.kind → `create_goal` | `user` → `goal-ba91e67f-9ece-4a2c-b16e-87edc2d96181` | `user` → `goal-d97641f9-e4ab-40de-8a80-a6b2bfb62ee2` |

### Agreement (arm 2)

| assertion | run 1 | run 2 | agreement |
| --- | --- | --- | --- |
| `wp2-a6:arm2-create-refused` | **PROVEN** | **PROVEN** | agree |
| `wp2-a6:arm2-no-goal` | **PROVEN** | **PROVEN** | agree |
| `wp2-a6:arm2-nothing-pretends-human` | **PROVEN** | **PROVEN** | agree |
| `wp2-a6:arm2-refusal-scoped` | **PROVEN** | **PROVEN** | agree |

What each assertion means:

- `wp2-a6:arm2-create-refused` — a machine Team relay on the Alpha.6-on governed Member is REFUSED create_goal by the existing upstream authority, with the typed refusal
- `wp2-a6:arm2-no-goal` — the refusal creates NO goal
- `wp2-a6:arm2-nothing-pretends-human` — nothing in the run pretends the relay was a human turn
- `wp2-a6:arm2-refusal-scoped` — the refusal is scoped: ordinary tool work still runs on that turn, and a WORK delivery still authorises a goal

---

## 6. What this establishes, and what it does not

**Establishes** (CANDIDATE-C2, n=2 agreement):

1. The Alpha.6 opt-in does **not** take direct-human goal authority away from a governed Member: a
   human `member.send` still authorises `create_goal`/`get_goal`/`update_goal`, the goal is durable,
   it runs real automatic rounds, and a human Stop leaves it durably `paused`.
2. A machine Team relay does **not** authorise `create_goal` on that Member, with the typed refusal,
   no goal, and no human-looking provenance anywhere in the durable log — exactly as release notes
   §4 item 8 documents for Alpha.6 ON.
3. The refusal is **scoped**: the refused turn is otherwise a normal governed turn, and the product's
   work-delivery port still carries the human attribution that goal authority reads.
4. Alpha.5 governance and the Goal tool family coexist on one Member: guard-consult facts name the
   exact goal-round call ids.

**Does not establish:**

- the literal one-Team three-way conjunction (§3 — impossible on this candidate; the typed refusal
  is recorded, and a driver that forged `kind:'user'` would be forging the authorisation this row
  restricts);
- Officer-routed review wake in the same Team as a governed Member, the A6 execute plane, or Sticky
  Stop under A6 in this composition (not exercised here; owned by the C1/A56 lanes);
- stability. Two runs agree; that is agreement, not a stability claim.

---

## 7. Gates and reproduction

```sh
# the measurement (≈ 2.5 min per run after boot; 4 Worlds total)
node tests/kits/wp2-a6-governed-goal/wp2-a6-governed-goal.mjs --plan          # host-free composition check
node tests/kits/wp2-a6-governed-goal/wp2-a6-governed-goal.mjs --probe-planes  # the §3 refusal
node tests/kits/wp2-a6-governed-goal/wp2-a6-governed-goal.mjs --arm arm1 --runs 2
node tests/kits/wp2-a6-governed-goal/wp2-a6-governed-goal.mjs --arm arm2 --runs 2

node scripts/doc-checks.mjs                          # green (exit 0)
node scripts/verify-blueprint-version-clean.mjs      # RED at base, re-recorded — see §8
node scripts/ci-pr-gate.mjs --only blueprint-fence   # pass vs the re-recorded baseline
```

Exit codes: `0` all assertions PROVEN (and the pair agrees), `1` refuted/disagreement,
`3` `CONJUNCTION_REFUSED` (the product refused the composition), `4` usage error.

## 8. Disclosures

- **Blueprint fence.** `node scripts/verify-blueprint-version-clean.mjs` is **already red at this
  candidate** on 10 paths / 26 sites (pre-existing; none of them touched by this lane) because the
  fence's supported set does not yet know v4/v5. This kit authors the two blueprints it boots, so it
  adds ONE identity line — `tests/kits/wp2-a6-governed-goal/wp2-a6-governed-goal.mjs ::
  L294=v5, L329=v4, L1128=v5, L1129=v4` — where L294/L1128 are the Alpha.6 v5 anchor and
  L329/L1129 the v4 governed Team. A dated re-record note and that identity line are appended to
  [`dev/agent-workflow/evidence/a4-pr7/ci-gate/blueprint-fence-baseline-606a0be7.txt`](../a4-pr7/ci-gate/blueprint-fence-baseline-606a0be7.txt)
  in the open; with it, `node scripts/ci-pr-gate.mjs --only blueprint-fence` reports
  `verdict=pass ... no new offending path (dirty 11 files/30 sites, unknown 0 files, baseline 11
  identities)`. Nothing was resolved and nothing was hidden; making these sites invisible would be
  labelling, not cleaning.
- **No product defect was found in this lane.** The two arm behaviours match the release notes. The
  only defect met during measurement was in this kit (round-routing on a mock request whose last
  user-shaped message is a tool result: the first iteration answered every automatic round with a
  bare text and spun the round driver), fixed here; it never touched a product file. The instrument's
  own development iterations are therefore **not** part of the record and were discarded — only the
  four record Worlds remain under `driver/logs/`, and every `run-arm*-r*/` directory was produced by
  the committed kit LOGIC (the only change after the runs is header prose).
- **No `packages/**` file was added or changed**, so no p4t6 booking is due (`tests/**` and
  `dev/agent-workflow/**` are outside that scan).
- **`DSH_HOME`** stayed under `tests/homes/` (workspace-write) and every World was torn down by
  identity; `teardown.json` per run records it. The dev-live slot ledger shows one slot acquired and
  released per run.
