# F-5 — two consecutive governed asks on the same root, per declared `whenOfficerUnavailable` policy

Owner ruling: 2026-11-11, work package **F-5** (+ the **Boot Preflight** companion package).
Branch: `task/f5-two-asks-20261111`, worktree `.worktrees/f5-asks`, base `origin/master` `94d5293ef`.
Record class: **DEV-LIVE** (the driver boots THIS worktree's dist; no candidate was frozen, so
nothing here is labelled `CANDIDATE-C2`). Host: pinned `0.2.0-rc.2` @ `639ed01539` (pristine
`tests/deepseek-harness-test-use`, porcelain empty). No product code was changed
(`CORE PATCH BUDGET = 0`); no authority pointer, tag, merge or `candidate/v0.1.6-2` change.

---

## 1. The answer first

**Is the declared `whenOfficerUnavailable` policy honoured on the second ask, for each declared
value?**

| declared policy | second ask, Officer **unavailable** (disposed) | honoured? |
| --- | --- | --- |
| `hold` | the ask stays **held**: no Officer wake, no Leader notification, no escalation, no transfer; the original request stays on the durable ledger and the remote ledger page; the only decision is an **explicit human `team.resolveControl`**; the approved body executes once | **YES — 2/2 runs agree** |
| `leader` | the ask goes **to the Leader**: the Leader is notified (6 notification turns, 2 `team_list_pending_control`, 2 `team_resolve_control`), decides **both** legs, there is no human leg and no human decision; the body executes once | **YES — 2/2 runs agree** |

There is **no third declared value**: `reviewRouting.whenOfficerUnavailable` is
`'hold' | 'leader'` in `packages/domain/blueprint/src/blueprint-v5.ts:97`, and the parser's
allowed list is exactly `['hold', 'leader']` (`:243-248`). Two policy arms are therefore the
whole matrix; this package does not invent a third.

**The live-Officer second ask (the F-5 observation) is NOT a policy violation**: the policy
branch is not reached, because the router only consults `whenOfficerUnavailable` when the
configured Officer is unavailable (`packages/runtime/review-router/router.ts:45`). With the
Officer live, the second ask wakes the Officer and the Officer's `escalate` is refused **one gate
upstream of the policy** — the trusted review-facts port. That defect is reported in §6 with
file:line and a durable trace; it is **not** papered over as a documented policy limit.

---

## 2. What was built (and what each part is for)

| path | role |
| --- | --- |
| `tests/kits/f5-two-asks/run-f5-two-asks.mjs` | the real-Host driver: one fresh World per run, boot → L0 discovery → `team.create` on a saved v5 Blueprint (`whenOfficerUnavailable` = the arm) → ask #1 (Officer wake → escalate → human leg) → [dispose the Officer] → ask #2 → durable-fact capture → teardown |
| `tests/kits/_shared/boot-preflight.mjs` | the ONE shared preflight every kit/boot driver calls before starting a Host; closed state set, typed refusal, structural `NOT_SELECTED` |
| `tests/kits/_shared/boot-preflight.test.mjs` | host-free unit tests (15/15) including the bug class the owner named: an unselected arm can never be recorded `FAIL`, and never blocks |
| `tests/kits/pr-a-governance-smoke/pr-a-governance-smoke.mjs` | the ONE existing kit migrated as the demonstration: its G0 block is now a measured preflight and its `spawnHost()` refuses to start unless the verdict is `PASS` |

Driver flags:

```
node tests/kits/f5-two-asks/run-f5-two-asks.mjs \
  --policy <hold|leader> --run <n> [--officer-at-ask-2 <live|disposed>] \
  [--host-port N] [--mock-port N] [--evidence-dir <path>] [--expect-sha <sha>] [--keep] [--wait-ms N]
```

Ports are sanctioned-only (`TEST_PORT_RANGES`, via `tests/paths.mjs`), loopback only; `:3080` is
never bound, only read-probed (`401` throughout). Every World is
`tests/homes/f5-<policy>-<officer>-r<n>-<stamp>/` inside THIS worktree and is removed after the
run unless `--keep`.

### The two officer-availability arms

Both are required to answer honestly:

- `--officer-at-ask-2 live` — the F-5 observation: the Officer is live and is woken for ask #2.
  This arm measures the real second-ask behaviour but **cannot** exercise the declared policy
  (the router sees an active Officer), so the policy is recorded as **not invoked**, never as
  honoured.
- `--officer-at-ask-2 disposed` — the Officer is disposed between ask #1 and ask #2, so ask #2
  **is** the `whenOfficerUnavailable` branch. `member.dispose` (not `member.archive`) is the
  legal transition here: the FSM allows `ARCHIVE` only from `SETTLED`
  (`CREATED -> ARCHIVED` is `LIFECYCLE_ILLEGAL_STATE`), and an idle Officer stays `CREATED`.
  The first attempt at this arm measured exactly that refusal (`LIFECYCLE_ILLEGAL_STATE`,
  `CREATED -> ARCHIVED`, `ARCHIVE is legal only from [SETTLED]`); the arm was then implemented
  with `member.dispose`, and the disposal response is kept in every disposed run as
  `officer-dispose.json`.

---

## 3. The flow a single run drives

```
boot (pinned Host, worktree dist, sanctioned port, fresh DSH_HOME)
  L0 discovery  → real model-facing surface → builtinToolDeny for the strict members
  team.create   → saved v5 Blueprint: leader + officer + worker, reviewRouting.enabled,
                  ordinaryToolApprovals.default = officer,
                  whenOfficerUnavailable = <arm>, plane takeover (an approved bash can execute)
  Leader turn   → team_create_member(officer) → team_create_member(worker) → team_delegate(prompt = ask #1)
  ask #1        → worker bash → permission-lane leg (explicit human allow)
                  → plane leg → Officer wake [team-review-wake] → team_list_pending_control
                  → team_resolve_control(escalate) → successor human leg (ordinal 2) → explicit human allow
                  → body executes (file 1) exactly once
  [disposed arm] member.dispose(officer) → officer row lifecycle DISPOSED
  ask #2        → worker prompt → permission-lane leg → plane leg → THE OBSERVABLE UNDER TEST
  teardown      → World deleted (unless --keep)
```

The mock model only decides **which tool is called**. Every fact below is read from the durable
store (`team_domain.json`: `ledger`, `member_instances`, `team_sessions`, `permission_overlays`,
`blueprint_registry`) or from the public remote surface (`team.getLedgerPage`,
`team.getProjection`, `team.resolveControl`, `api/session/prompt`); the mock transcript is used
only to prove what the MODEL was shown (wake text, refusal text, list results).

---

## 4. Results — per run

All eight runs: **12/12 criteria PASS**, exit 0, product SHA `94d5293ef6` (the branch base; the
driver lives in the worktree and boots the worktree dist), host `639ed01539…`, preflight `PASS`.
Raw artefacts are committed under `run-*` directories in this folder.

### 4.1 Ask #1 (the baseline chain — identical in every arm, and it is what proves ask #2 is the anomaly)

| arm | run | owner lifecycle before ask | owner lifecycle at Officer wake | failing facts gates at wake | Officer escalate | human leg | body executed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| hold / disposed | 1 | RUNNING | RUNNING | none | recorded (`deny` on ordinal 1 + escalation row) | ordinal 2, decided `allow` by `human` | once |
| hold / disposed | 2 | RUNNING | RUNNING | none | same | same | once |
| hold / live | 1 | RUNNING | RUNNING | none | same | same | once |
| hold / live | 2 | RUNNING | RUNNING | none | same | same | once |
| leader / disposed | 1 | RUNNING | RUNNING | none | same | same | once |
| leader / disposed | 2 | RUNNING | RUNNING | none | same | same | once |
| leader / live | 1 | RUNNING | RUNNING | none | same | same | once |
| leader / live | 2 | RUNNING | RUNNING | none | same | same | once |

Agreement n=2: identical in every field. This is the control that makes the ask-#2 difference
attributable to the second ask, not to the scenario setup.

### 4.2 Ask #2 — who answered, and was the declared policy invoked/honoured

| arm | run | owner lifecycle before ask #2 | owner at reviewer wake | reviewer wake | Leader notification | escalation row | transfer row | decider | human leg | discoverable (remote ledger page) | body executed | policy invoked | policy honoured |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **hold / disposed** | 1 | SETTLED | — (no wake) | 0 | 0 | 0 | none | **human** (explicit) | none | yes | once | **yes** | **yes** |
| **hold / disposed** | 2 | SETTLED | — (no wake) | 0 | 0 | 0 | none | **human** (explicit) | none | yes | once | **yes** | **yes** |
| **leader / disposed** | 1 | SETTLED | — (notification, not wake) | 0 | 6 | 0 | none | **instance `inst-leader` (`role: leader`)** | none | yes | once | **yes** | **yes** |
| **leader / disposed** | 2 | SETTLED | — | 0 | 6 | 0 | none | **instance `inst-leader` (`role: leader`)** | none | yes | once | **yes** | **yes** |
| hold / live | 1 | SETTLED | SETTLED | 3 | 1 | 0 | none | **human** (explicit) | none | yes | once | **no** | n/a (not invoked) |
| hold / live | 2 | SETTLED | SETTLED | 3 | 1 | 0 | none | **human** (explicit) | none | yes | once | **no** | n/a (not invoked) |
| leader / live | 1 | SETTLED | SETTLED | 3 | 1 | 0 | none | **human** (explicit) | none | yes | once | **no** | n/a (not invoked) |
| leader / live | 2 | SETTLED | SETTLED | 3 | 1 | 0 | none | **human** (explicit) | none | yes | once | **no** | n/a (not invoked) |

n=2 **agreement** (not a stability claim): every row's pair is identical in every field.

Who could decide ask #2, in the arm that exercises the policy:

- `hold` + disposed: **only the human**. The plane leg keeps `reviewAuthority: "leader"`,
  `legOrdinal: 1`; there is no successor leg, no escalation and no transfer. The
  `whenOfficerUnavailable: hold` declaration is honoured — a `hold` never became a silent
  Leader hand-off.
- `leader` + disposed: **the Leader**. Both ask-#2 legs were resolved by the Leader instance
  (`team_resolve_control`), the decision row's decider is `{kind: "instance", role: "leader"}`,
  and there is no human leg and no human decision. The `leader` declaration is honoured.

Discoverability: in every run the ask-#2 plane leg's request id is present on the **remote
ledger page** (`team.getLedgerPage`, `ledgerPageVisible: true`); in the live and leader arms the
reviewer/Leader also observed it through `team_list_pending_control` (`modelPendingListObserved:
true`). In the `hold` disposed arm no model was woken, but the request is still on the remote
page — the human surface — which is what "remains discoverable" requires.

Approval authority was never silently changed: no `control-current-leg-transferred` row exists in
any ask-#2 case, and the plane leg's recorded `reviewAuthority` stays `leader` in all arms
(the human decision is an explicit `team.resolveControl` with `decider.kind = "human"`).

---

## 5. What the second ask actually does (the observed F-5 shape, live Officitor arm)

1. Worker calls `bash` for ask #2 → the **permission-lane** leg is created; the human allows it
   (the same shape as ask #1; no model wake).
2. The **plane leg** (`actionName: team-tool-execute`) is created with
   `reviewAuthority: "leader"`, `legOrdinal: 1`, `blueprintRevision: "1"`, the blueprint's
   `contentHash`, `authorityGeneration: 0`.
3. The review router routes it to the **live Officer** and the Officer is woken
   (`[team-review-wake …]`, 3 wake turns in the run: list + resolve + closing turn).
4. The Officer calls `team_resolve_control(decision: "escalate")` and the service **refuses** it:

   ```
   CONTROL_RESOLVER_NOT_AUTHORIZED
   ControlService: caller is not a resolver for kind 'leader-approval' — Member escalation
   requires a valid ReviewCapability (caller is not a resolver for kind 'leader-approval' —
   the trusted review-facts port produced no facts for this leg); the global resolver table
   is unchanged
   ```

5. No escalation row and no successor leg are written (the leg stays `legOrdinal: 1`,
   `reviewAuthority: "leader"`).
6. The human then decides that **original** leg with an explicit `team.resolveControl(allow)`
   (decider `{kind: "human"}`), and the body executes exactly once.

That is the packaged-acceptance F-5 observation reproduced on a fresh World, 2/2 runs, with the
gate-level trace in §6. It is **not** a `whenOfficerUnavailable` violation: the policy branch
was never entered (the Officer was live).

---

## 6. Defect reported (not fixed in this lane): the facts port rejects a settled operation owner

**Where:** `packages/runtime/alpha6/assigned-officer-facts.ts:444`

```ts
if (owner.lifecycle !== 'RUNNING') return null
```

**What happens:** the provider is asked for the trusted review facts of the leg. The leg, the
Blueprint identity, the registry row, the unique live Officer, its child session, the
authority generation and the tool binding are all correct; the ONLY failing gate is the
operation owner's lifecycle. On ask #2 the Worker instance is `SETTLED` (it settled after ask #1's
work unit and does not return to `RUNNING` for the second work unit), so the provider returns
`null`, `ControlService` reports `CONTROL_RESOLVER_NOT_AUTHORIZED … produced no facts for this
leg` (`packages/runtime/control/service.ts:3059`), and the Officer cannot escalate.

Durable trace (`ask-2-gate-facts.json` in every live run, captured three times):

| capture point | owner lifecycle | failing gates |
| --- | --- | --- |
| ask #1, while the Officer composes its resolve | RUNNING | none (all 13 gates true) |
| ask #2, while the Officer composes its resolve (`atWake`) | **SETTLED** | **`owner-running`** only |
| ask #2, when the typed refusal first becomes observable (`atRefusal`) | SETTLED | `owner-running` only |

The other 12 gates are `true` at the ask-#2 wake: leg present/pending, blueprint hash/revision
present, leg matches the session Blueprint, registry has the session Blueprint, exactly one live
Officer with a child session, owner template matches, generation frozen and equal, tool binding
complete. So the refusal follows deterministically from the owner lifecycle, not from a
Blueprint/identity mismatch.

**Why this is a defect and not a documented limit:** the same Worker instance, in the same
second work unit, is still executing the guarded call (the guard waits for a decision and then
executes it once the human allows). The trusted facts port meanwhile refuses to describe that
very operation because the instance row says `SETTLED`. Whether the fix belongs in the facts
provider (accept the owner's in-flight work unit) or in the lifecycle transition (a second work
unit should move the owner back to `RUNNING`) is a product-owner decision; this lane reports the
exact gate and the exact durable state, and changes no product code.

**Not fixed here by design.** The owner's ruling: a policy violation is a defect to fix, not to
document. This is not a policy violation, and the defect itself was already ruled out of scope
for this lane ("no product code change; report if needed"). It is reported with file:line and the
trace above.

---

## 7. Boot Preflight (companion work package)

### 7.1 The closed outcome set

`tests/kits/_shared/boot-preflight.mjs` exports exactly six states:

`PASS` · `FAIL` · `NOT_REACHED` · `NOT_SELECTED` · `UNSUPPORTED` · `ENV_BLOCK`

Blocking precedence is fixed: `FAIL` → `ENV_BLOCK` → `UNSUPPORTED` → `NOT_REACHED`. A
non-`PASS` verdict is refused with `BootPreflightRefusal` (code `BOOT_PREFLIGHT_REFUSED`), so a
kit cannot start a Host and then discover the environment was wrong.

### 7.2 What each check grades (and how each outcome is chosen)

| check id | grades | outcome rules |
| --- | --- | --- |
| `env.missing` | required env vars this run WILL export (`DSH_HOME`, `DSH_CLIENT_COMMIT_HASH`, `DEEPSEEK_BASE_URL`) | missing → **ENV_BLOCK** (an absent environment is not a product failure) |
| `host.pin` | declared `TEST_USE_BASELINE_SHA` vs the pristine checkout's real HEAD + porcelain | mismatch or dirty checkout → **FAIL**; absent pin/checkout/SHA → **ENV_BLOCK** |
| `candidate.sha` | expected SHA (`--expect-sha` / candidate manifest) vs the measured tree | mismatch → **FAIL**; absent expectation or measurement → **ENV_BLOCK** (a candidate-bound run must prove identity) |
| `modality.<id>` | each required model modality against the declared host generation | unsupported → **UNSUPPORTED**; undeclared → **ENV_BLOCK** (unknown ≠ supported) |
| `officer.count` | the Alpha.6 unique-Officer law: `scope: 'declared'` grades the Blueprint's declared Officer template (pre-boot); `scope: 'live'` grades the measured live rows (post-create) | ≠ 1 → **FAIL**; not measured → **ENV_BLOCK** |
| `port.<n>` | the ports this run WILL bind, sanctioned (`TEST_PORT_RANGES`, `:3080` refused) and free | unsanctioned → **FAIL**; busy/unmeasured → **ENV_BLOCK** |
| `world.dsh-home` | `DSH_HOME` inside the workspace, never the stable instance's World | stable home or outside workspace → **FAIL**; absent → **ENV_BLOCK** |
| `world.seed` | the prepared seed world a kit copies into `DSH_HOME` (only for kits that seed) | absent/unmeasured seed → **ENV_BLOCK** (nothing about the product was measured; this is the same distinction that keeps an unselected arm out of `FAIL`) |
| `arm.*` | selected vs known arms; unselected known arms are recorded `NOT_SELECTED` **structurally** (with `rawState` kept for audit) and can never block | unknown selected arm → **FAIL** |
| propagation | any selected-arm check whose core prerequisite is not `PASS` | → **NOT_REACHED** (a prerequisite failure is not a second failure of its own) |

The bug class the owner named is closed structurally, not by convention: `recordCheck` forces
`NOT_SELECTED` for any check whose arm is not in `selected`, and `gradeChecks` excludes
`NOT_SELECTED`/`NOT_REACHED` from the blocking set — so an unselected arm is **impossible** to
record as `FAIL` and impossible to make the run refuse. The unit test
`an UNSELECTED arm can never be recorded FAIL, and never blocks` pins it.

### 7.3 Migrated kit (the demonstration)

`tests/kits/pr-a-governance-smoke/pr-a-governance-smoke.mjs` (710 → 772 lines):

- its G0 block now measures the intended host/mock ports, the pristine host pin/porcelain, the
  worktree candidate SHA (`PRA_EXPECT_SHA` override; otherwise LIVE class), the World and the
  selected arm (`g0-governance-wire`), calls `runBootPreflight`, writes `boot-preflight.json`
  and requires `verdict === 'PASS'`;
- `spawnHost()` now calls `assertBootPreflight(PREFLIGHT)` as its **first statement**, so both
  boots (create and warm reuse) refuse to start a Host when the preflight is not `PASS`.

Two instrument findings from the migration itself:

1. The first version over-checked the whole sanctioned band and refused because an unrelated lane
   held `:3181`. The band sweep only *selects* a free pair; it must not police the band. Fixed by
   grading only the two ports this run will bind.
2. The kit seeds its world from a prepared fixture (`tests/homes/mpr-2026-09-27T08-35-52`). That
   fixture is **absent in this environment** (pre-existing precondition, not caused by this
   migration), and the preflight now grades it as its own check: `world.seed → ENV_BLOCK` with
   the exact missing path, instead of an opaque G0 boolean. The kit refuses to boot; nothing
   about the product is claimed.

Demonstrated end-to-end on this Host:

```
$ PRA_EXPECT_SHA=0123456789abcdef0123456789abcdef01234567 \
    node tests/kits/pr-a-governance-smoke/pr-a-governance-smoke.mjs
preflight FAIL: candidate.sha — candidate is 94d5293ef6f2 but PRA_EXPECT_SHA (candidate manifest)
                is 0123456789ab (CANDIDATE_SHA_MISMATCH)
CRITERIA-FAIL G0 preflight (FAIL at candidate.sha (…))
# exit 2, no Host started

$ node tests/kits/pr-a-governance-smoke/pr-a-governance-smoke.mjs
preflight ENV_BLOCK: world.seed — prepared seed world is absent at …/mpr-2026-09-27T08-35-52
CRITERIA-FAIL G0 preflight (ENV_BLOCK at world.seed (…))
# exit 2, no Host started
```

A full PASS run of the PR-A wire is therefore not reproducible in this environment until its
prepared seed world exists; the PASS path of the shared preflight is proven by the F-5 driver
(§4, eight runs that boot only after `preflight PASS`).

---

## 8. Gates run for this delivery

| gate | result |
| --- | --- |
| `node scripts/doc-checks.mjs` | green (exit 0) |
| `node --test tests/kits/_shared/boot-preflight.test.mjs` | **15/15 pass** |
| `npx vitest run packages/testkit/test/a4p7-blueprint-version-clean.test.ts` | **60/60 pass** (the new DEFERRALS row is required and exact: the kit is dirty BY SUBJECT, identity `L463=v5, L515=v5`) |
| `node scripts/verify-blueprint-version-clean.mjs` | `dirty(13 files, 31 sites)` — the new kit is in the deferral set and is **not** an unexpected dirty path; no retired-version bytes were introduced |
| `node --test tests/world-factory/a5sf-debt-register.test.mjs` | **10/10 pass** |
| `node tests/kits/pr-a-governance-smoke/pr-a-governance-smoke.mjs` (migrated kit) | refuses with typed `ENV_BLOCK world.seed` (seed fixture absent in this environment); with `PRA_EXPECT_SHA` mismatched refuses with `FAIL candidate.sha`; no Host is started in either case (see §7.3) |

No `packages/**` product code was touched. The only `packages/**` edit is the testkit's
`DEFERRALS` row that the fence requires for a new scoped, dirty-by-subject `.mjs` carrier.

---

## 9. Limits and disclosures

- **n=2 is agreement, not stability.** Each arm was run twice with a fresh World; the pairs agree
  in every recorded field. No claim is made about flake rates.
- **Live class, not candidate class.** The driver boots the worktree dist; no candidate was
  frozen for this package, so records are `DEV-LIVE` and the manifest says so. `--expect-sha`
  binds a run to a candidate manifest SHA when one exists.
- **The live arm cannot honour-test the policy** because the policy is not invoked there; it is
  recorded as `policyInvoked: false`, `policyHonoured: null` with the reason, never as a pass.
- **The disposed arm uses `member.dispose`, not `member.archive`**: the FSM forbids
  `CREATED -> ARCHIVED`. Both are "Officer unavailable" to the router; the evidence names the
  transition actually used.
- **No product fix.** The facts-port defect (§6) is reported, not repaired. `CORE PATCH BUDGET = 0`
  and the lane's explicit no-product-change rule are both respected.
- **`:3080` was never bound.** Only read-probed (`401`); all test traffic was on sanctioned
  loopback ports.

---

## 10. Reproduction

```
# one arm (fresh World; deletes it afterwards)
node tests/kits/f5-two-asks/run-f5-two-asks.mjs --policy hold   --run 1 --officer-at-ask-2 disposed
node tests/kits/f5-two-asks/run-f5-two-asks.mjs --policy leader --run 1 --officer-at-ask-2 disposed
node tests/kits/f5-two-asks/run-f5-two-asks.mjs --policy hold   --run 1 --officer-at-ask-2 live
node tests/kits/f5-two-asks/run-f5-two-asks.mjs --policy leader --run 1 --officer-at-ask-2 live

# preflight-only instrument
node --test tests/kits/_shared/boot-preflight.test.mjs

# the migrated kit
node tests/kits/pr-a-governance-smoke/pr-a-governance-smoke.mjs
```
