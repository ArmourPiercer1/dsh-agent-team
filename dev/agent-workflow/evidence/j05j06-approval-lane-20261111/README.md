# J05 + J06 — the approval lane, closed on a real Host

Branch `task/j05j06-approval-lane-20261111`, base `origin/master` @ `b29e10582`,
worktree `.worktrees/j05j06`, host pin `639ed01539` (pristine
`tests/deepseek-harness-test-use`), evidence class **DEV-LIVE**.

## The two questions, answered first

**1. Does a bash ask's `parameter-permission` leg now reach the Officer (or a
typed refusal)?**
**Yes — it reaches the Officer, measured twice on a real Host.** In both runs the
`parameter-permission` row carries the frozen bound identity and the verified
tool coordinate, the Alpha.6 route returns the Officer (not the Leader), the
Officer's own turn lists it (`team_list_pending_control` → 200 with the leg in
`pending`) and resolves it (`team_resolve_control` → `control-resolved`). The
decider recorded by the durable ledger is that Officer **member** instance, and
`team-tool-execute`'s leg — the same operation's second, plane-owned ask — is
decided by the **same** instance, which is the "one bound identity, one route"
claim:

| run | leg | requestId | decider | routedToOfficer |
| --- | --- | --- | --- | --- |
| 1 | parameter-permission | `ctrl-0kxw88h13y9hky1rrmb6n0wh` | `inst-0uns1h91b3u2` (member/officer) | true |
| 1 | team-tool-execute | `ctrl-199yn8a1t38m451czeqqo14i` | `inst-0uns1h91b3u2` (member/officer) | true |
| 2 | parameter-permission | `ctrl-12w0i5y12z949t1m9ur6k09i` | `inst-0ncu7ql16az7` (member/officer) | true |
| 2 | team-tool-execute | `ctrl-1mz5dz90nzpd9219s1o6b1yt` | `inst-0ncu7ql16az7` (member/officer) | true |

When a field cannot be supplied the leg is **refused by name at the route gate**
(`unroutable` / `operation-tool-identity-unavailable (…)`), never silently
handed to the Leader: `packages/runtime/test/a6-root-wiring.test.ts` pins the
refusal, `a6-pr6-notifier.test.ts` pins that the notifier then **throws** instead
of notifying the Leader, and the legacy-Leader carve-out now additionally
requires that the row carries no Alpha.6 identity at all (a pre-Alpha.6 row is
the only thing that may still fall back).

**2. Does a consumed allow leave exactly one truthful execution fact?**
**Yes.** Both runs: exactly one `control-allow-consumed` and exactly one
`control-execution-result` for the `parameter-permission` leg, with
`outcome=succeeded` — the fact is keyed by the leg's own invocation correlation
(`call-c1-nhhq2b8z` / `call-c1-xptie40z`), written from the host's `tools/result`
terminal leg after the body actually ran:

| run | requestId | consumption | executionResults | outcome | correlation matched |
| --- | --- | --- | --- | --- | --- |
| 1 | `ctrl-0kxw88h13y9hky1rrmb6n0wh` | 1 | 1 | `succeeded` | `call-c1-nhhq2b8z` |
| 2 | `ctrl-12w0i5y12z949t1m9ur6k09i` | 1 | 1 | `succeeded` | `call-c1-xptie40z` |

Timing in run 1: consumption `22:38:32.381Z` → execution fact `22:38:36.081Z`
(the governed bash body ran in between; `a6-allow-executed` is the body's own
output, visible in `joint-tool-transcript.json`). PD-41 mapping is pinned by
unit tests (`a4p4-operation-single-shot.test.ts` J05a/J05b): only an observed
completion is `succeeded`, an answered failure is `failed`, a dispatch refused
after consumption is still `failed`, and a cancelled/timed-out/unobserved
execution is `unknown` — never a guessed `succeeded`.

## Two-run arm table (real Host, `JOINT_PRESET=fs-only`)

Both runs: `boot-preflight` verdict PASS (10/10 checks), fresh `DSH_HOME` under
`tests/homes/c1-smoke-2026-11-11T22-38-15-h3189-re6dfee` /
`…22-41-40-h3190-r64eeb3`, torn down (`dshHomeRemoved: true`,
`hostStopped: true`), ports `3189/3498` and `3190/3497` (sanctioned bands),
`:3080` never touched (`3080=401` probe only).

| arm | run 1 | run 2 | note |
| --- | --- | --- | --- |
| J01 team + routing | PASS | PASS | v5 both families, `reviewRouting=true` |
| J02 fs read inside | FAIL | FAIL | member `write` refused: *Tool Binding for "write" cannot be verified at dispatch time* — the plane mount places `team_grep/team_glob/bash/pwsh` only (composition gap, not the approval lane) |
| J03 fs deny outside | FAIL | FAIL | same binding gap; no outside write happened (`writeDenies=0`, `outsideExists=false`) |
| J04 native bash mount | FAIL | FAIL | the known native-bash mount defect (`native-bash-tool.mjs:51`) — this is why the product-intended composition is substituted (below) |
| **J05 consumed allow → execution fact** | **PASS** | **PASS** | 1 consumption, 1 execution fact, `succeeded` |
| **J06 Officer routing** | **PASS** | **PASS** | `routedToOfficer=true`, `decider` = officer member, `team-tool-execute leg=true` |
| J11 one-shot consumption | PASS | PASS | exactly one consumption fact for the leg |
| J07–J10 | NOT_REACHED | NOT_REACHED | not driven by this driver in this composition |

Arm detail lines and the full ledgers are beside this file:
`../joint-acceptance/j05j06-run1/`, `../joint-acceptance/j05j06-run2/`
(`run.log`, `joint-ledger.json`, `joint-tool-transcript.json`,
`joint-verdicts.json`, `boot-preflight.json`, `teardown.json`).

## Deliverable 1 — the identity carry, field by field

The frozen `BoundBlueprintIdentity` is passed through the existing Team
composition / pre-execute adapter seam (`installScopedOperationPermission`'s
`alpha6AskIdentity`). Nothing is re-resolved and nothing is inferred from a
mutable row anchor: each field is a copy of a value the caller already froze,
and the identity object is `Object.freeze`d at construction.

| field | supplied from | shape | when it cannot be supplied |
| --- | --- | --- | --- |
| `blueprint.blueprintId` | the bound Blueprint the Alpha.6 composition reads (`getBoundBlueprint(teamRoot)`) — the same object the PA lane freezes | string (`team.c1-anchor`) | no bound row → **the whole identity is not constructed**; the install behaves exactly as pre-J06 (no Alpha.6 fields on the row) |
| `blueprint.revision` | same bound row | string (`"1"`) | same |
| `blueprint.schemaVersion` | `Number(bp.schemaVersion)` | number (`5`) | `alpha6ReviewRouting !== true` **or** schemaVersion ≠ 5 → identity not constructed |
| `blueprint.contentHash` | same bound row | `sha256:<64 hex>` | same as `blueprintId` |
| `operationOwnerTemplateId` | this Agent's own durable template (`boundTemplate.templateId`) | string (`worker`) | no bound template → field absent; the route gate keeps the row `unroutable` and the notifier refuses by name |
| `operationToolDefinitionIdentity` / `operationToolOwner` / `operationToolName` | the **verified** governance binding on this Agent's guard surface (`surface.entryOf(name)`; requires `verified === true`, non-empty `providerId`, `toolName`, `definitionIdentity`) | `def#39` / `dsh-agent-team` / `bash` | **all-or-nothing**: no verified entry (e.g. a host builtin this assembly never placed) → the triple is withheld and the route gate answers `operation-tool-identity-unavailable`; a Leader fallback is not available |
| `authorityGeneration` | the SAME durable reader the PA lane freezes from (`readAuthorityGeneration(teamRoot, instanceId)`), called at ask time because it is a moving fact | integer (`0`) | reader answers `undefined` → the generation is withheld AND the tool triple is withheld (half an identity would wake an Officer the decision gate must refuse) |
| `perEffectRequiredAuthorities` | `[approvalRouting.requiredAuthority]` — the rung the ONE evaluator derived for this very invocation | array (`['leader']` in this composition) | always present; this is the case's own single effect, deliberately **not** PA's multi-effect enumerate |
| `reviewPayload.authorityScope` (projection) | the same `authorityPointOf(operation)` the leg's typed `authorityScope` carries | the guard's authority point | absent when the operation has no authority point; the router then reads no scope |

Both gates were checked to need the whole set: the **route** gate needs
`blueprintContentHash`, `blueprintRevision`, `operationToolOwner`,
`operationToolName`; the **decision** gate needs those plus
`operationOwnerTemplateId`, `operationToolDefinitionIdentity` and the frozen
`authorityGeneration`. Carrying only the hash is a measured no-op (it still
routes `unroutable`), which is why the carry is all-or-nothing.

## Deliverable 2 — the execution fact

`ControlService.recordExecutionResult` used to match only
`reviewPayload.callId`, a field only the PA plane writes; a
`parameter-permission` allow therefore had no matcher and the consumption left
silence. The matcher now also accepts the durable `payload.correlation` (the
request creator's own invocation id — never model-supplied), which is exactly
the id the adapter's execution fact carries.

The write itself is owed by the pre-execute adapter (who consumed the allow) and
settled from the host's `tools/result` terminal leg:

* one fact per consumed allow, idempotent per `requestId` (a racing observation
  cannot double-write; that idempotency is the fence, and it is untouched);
* `succeeded` only for an observed completion; `failed` for an answered
  failure **and** for a dispatch refused after consumption; `unknown` for
  cancelled / timed-out / unobserved;
* the observer is registered **lazily** on the first consumed allow, so an
  install that never reaches the ask lane adds no listener (the pre-execute
  listener stays `listeners[0]`, which several fake hosts pin);
* a row the PA plane owns (`reviewPayload.callId` present) is skipped: that lane
  keeps its own fact, and there is still exactly one per leg.

## What moved, and the ARC-A booking

| file | why |
| --- | --- |
| `packages/runtime/operation-permission/pre-execute-adapter.ts` | the identity carry + the terminal execution-fact obligation |
| `packages/runtime/operation-permission/index.ts` | type-only re-export of the frozen input contract |
| `packages/runtime/control/service.ts` | **only** the execution-result correlation matcher |
| `packages/runtime/alpha6/root-router.ts` | typed `unroutable` refusal when an Alpha.6 ask carries no tool coordinate |
| `packages/runtime/alpha6/notifier.ts` | the legacy-Leader carve-out additionally requires a row with **no** Alpha.6 identity |
| `packages/runtime/src/plugin/live/agent-bindings.mjs` | **only** wiring of the identity inputs (bound blueprint, own template, generation reader, verified binding) |
| `dev/agent-workflow/ledgers/arc-a-protected-center.json` | four named override entries (see below) |

No authority move, no candidate move, no replay, no fence change, no upstream
patch (`CORE PATCH BUDGET = 0`; `git diff origin/master -- tests/deepseek-harness-test-use` is empty because that tree is not tracked here).

ARC-A L1 digest lock: the three protected-centre files this lane must touch
(`control/service.ts`, `operation-permission/index.ts`,
`operation-permission/pre-execute-adapter.ts`) plus the composition glue
(`src/plugin/live/agent-bindings.mjs`) drift from their booked digests **by
design** — this is a *named centre-interface PR*, not a family addition — so the
ledger gained four `overrides` entries (`path` + `sha256` + `pr` + `reason`),
each citing this PR and the exact semantic change. `scanProtectedLedger` returns
zero violations (and `u6-pr6-arc-d-adversarial` / `u6-arc-a-fitness` are green).

## Substitutions and disclosures (read before quoting the table)

1. **`JOINT_PRESET=fs-only`.** The product-intended composition is blocked by
   the known native-bash mount defect (J04, `native-bash-tool.mjs:51`,
   `Cannot read properties of undefined (reading 'validate')`), which is not in
   this lane and not fixable without patching upstream. J04 is reported FAIL in
   both runs and everything below it is measured in the substituted
   composition. J05/J06 do not depend on the native mount: the governed bash
   executes through the plane takeover, which is active in both runs.
2. **`C1_PLANE_TAKEOVER`.** This kit hardcodes `PLANE_TAKEOVER = true`; setting
   the environment variable has no effect, and the takeover was active in both
   runs (evidence: `a5g7: placement-feed rows=[team_grep,team_glob,bash,pwsh]`
   and a real second `team-tool-execute` leg per operation).
3. **Two runs only, both fs-only.** No native-composition run exists for this
   lane; that limit is J04's, not this lane's.
4. **J02/J03 FAIL is a binding gap, not the approval lane.** The plane mount
   places only `team_grep/team_glob/bash/pwsh`, so the member's `write`/`read`
   are refused with *Tool Binding … cannot be verified at dispatch time*. No
   outside write happened (`outsideExists=false`), so the deny arm proves
   nothing either way in this composition.
5. **`whenOfficerUnavailable` is unit-pinned, not exercised live here.** The
   hold arm needs two governed asks with the Officer unavailable
   (`F5-TWO-ASKS-PREFLIGHT`, `tests/kits/` on its own branch); this driver drives
   one ask. The J06 detail line therefore prints
   `whenOfficerUnavailable=hold(unit-pinned, not exercised here)` rather than
   claiming a live PASS. The Leader-exception arm is likewise unit-pinned
   (`a6-root-wiring.test.ts`).
6. **Instrument changes in the driver** (this lane's copy,
   `tests/kits/joint-acceptance-20261111/run-joint-acceptance.mjs`):
   * the J06 verdict is COMPUTED (`identityCarried && routedToOfficer`), no
     longer a hardcoded FAIL;
   * the ledger projection gained the ten identity fields, so the arm can read
     what the row carries;
   * three bounded liveness waits (≤120 s for the leg's decision, ≤60 s for the
     member's post-allow script, ≤20 s for the terminal execution fact) — the
     review leg is resolved by a model turn, and without them the driver
     measured its own speed (an undecided leg is not a FAIL). Waits are printed
     in the arm details (`decisionWaitMs`, `executionFactWaitMs`);
   * `joint-tool-transcript.json` records every tool result the model was
     handed, because the decisive observable for a refused leg is a tool answer,
     not a durable row;
   * the JOINT world provisions its Officer/worker directly, so the
     model-driven Leader turn is made **idle** in this composition — before
     that, the leader script created a *second* live Officer and the
     assignment/facts ports (correctly) refuse "zero or multiple live
     Officers" (`assigned-officer-facts.ts`), which made every delegated read
     null. The dedicated A6 scenarios keep their full leader script.

## Remaining gap (not this lane's file)

`packages/runtime/src/plugin/root.ts:2892-2906` still settles boot-time
`unknown` execution facts from `reviewPayload.callId` only. For this lane a
crash between consumption and the terminal event therefore leaves **no**
`unknown` settlement at boot; the fact is written only if the host survives to
the `tools/result` leg. Closing that is a one-line extension of the same
`correlation` matcher on the boot path, but `root.ts` is outside this lane's file
ownership, so it is reported here rather than changed.

## How to reproduce

```bash
cd .worktrees/j05j06
pnpm install --frozen-lockfile --prefer-offline --store-dir .pnpm-store
pnpm -r run build && node scripts/place-dist-glue.mjs
JOINT_PRESET=fs-only JOINT_PORT=3189 node tests/kits/joint-acceptance-20261111/run-joint-acceptance.mjs \
  --worktree "$PWD" --host-port 3189 --mock-port 3498 \
  --evidence-dir "$PWD/dev/agent-workflow/evidence/joint-acceptance/j05j06-run1"
```

Unit pins for the same claims (no Host needed, all green):
`a4p4-operation-approval-authority` (identity carry, no invented coordinate),
`a4p4-operation-single-shot` (J05a/J05b terminal facts),
`a5-m1-auth-bridge` (correlation matcher, exactly-once),
`a6-root-wiring` (Officer route, Leader exception, hold, named refusal),
`a6-pr6-notifier` (refusal instead of a Leader notification),
`u6-pr6-arc-d-adversarial` + `u6-arc-a-fitness` (ARC-A booking).
