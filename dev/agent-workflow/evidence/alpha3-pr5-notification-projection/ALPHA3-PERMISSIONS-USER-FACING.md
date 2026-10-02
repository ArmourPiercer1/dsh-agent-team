# Alpha.3 permission lifecycle + change notifications — what a user can actually use TODAY

Consolidated docs pass (final splice round, PR #61). Everything below is
read from the REAL code and REAL tests on this branch (merge of master
`940cd841` + the final production splice at HEAD). File:line citations are
as of the splice commit. No ADR is rewritten; no plan is expanded.

## 1. Implemented Alpha.3 entry points (permission lifecycle)

All writes ride ONE governance mutation authority
(`createGovernanceMutationService`, committed durably BEFORE the ack). The
production root wires it once; every entry reaches the same service:

| Entry | What it is | Where |
| --- | --- | --- |
| `plane.mutation.grantInstance` / `plane.mutation.revoke` / `plane.mutation.restore` | the in-process permission plane (grant / revoke / member restore), assembled by the root and exposed through the shared `permissionPlaneRef` (the `controlServiceRef` pattern) | `packages/runtime/src/plugin/root.ts:2719-2761` (`createTeamPermissionLanes`), entry dispatcher `permissionLaneMutate` at `root.ts:2762` |
| remote RPC `override.mutatePermission` | the v7-ONLY remote method for the human/operator grant/revoke lane (the one version-gated addition to the remote catalog since PR #60; v<7 gets the typed `method-version-unsupported`) | wired at `root.ts:3040` (`permission: { mutatePermission: permissionLaneMutate }`); method catalog `packages/remote/src/contracts/catalog.ts` (`REMOTE_V7_ONLY_METHODS = ['override.mutatePermission']`) |
| the Leader tool lane | the team tool's permission adapter (Leader gate inside the tool layer), SAME dispatcher | `root.ts:3213` (`permission: { mutatePermission: permissionLaneMutate, ... }` into `createTeamTools`) |
| `restore` | threads the ONE lifecycle path (ARCHIVED -> SETTLED, one durable commit, zero live contact); the lane performs no transition of its own and writes NO permission snapshot for a pure restore | `root.ts:2731` (`lifecycleService.restoreMember`) |

Read side: the execution decision reads the same durable overlay behind the
ADR §8 lifecycle gate through `plane.decisions.decide` (pre-execute adapter
in the live glue); effective-permission views stay on the pre-existing
inspect surfaces. The notification lane's own
`createPermissionReadProjection` is a tested LIBRARY (frozen `latest` /
`history` views) — NO production read surface consumes it yet.

## 2. `permissionMutationEnvelope` — the addressed-team expansion ceiling

A Blueprint carrier the addressed team's bound expansion authority is read
from (per TARGET member). REAL fixture quoted verbatim from the test that
ships it — `packages/runtime/test/a3p4-r4-authority-binding.test.ts:163-172`:

```yaml
permissionMutationEnvelope:
  rules:
    - operationClass: <operationClass>
      matcher:
        kind: <exact | subtree>
        path: "<path>"
      maximumEffect: <maximumEffect>
```

(same source also carries the fingerprint-matcher variant,
`a3p4-r4-authority-binding.test.ts:175+`). The host reads the carrier from
the ADDRESSED team's bound Blueprint and injects it as
`permissionEnvelope` (plus `permissionStaticLayers` /
`permissionCanonicalize`) into the root (`host.ts` -> `root.ts` deps,
forwarded VERBATIM into the governance lane; absent = the documented
zero-envelope default: no Leader expansion authority). The root refuses
typed (`PERMISSION_MUTATION_NOT_CONFIGURED`) when the overlay port itself
is absent (`root.ts:750` deps doc).

## 3. Where grant/revoke/read-projection are ACTUALLY invoked

- grant/revoke (human/operator): remote `override.mutatePermission` ->
  `permissionLaneMutate` -> `plane.mutation.grantInstance|revoke` ->
  `governance.mutatePermission` (ONE writer; lane pre-check
  `assertPermissionMutationTarget` then exactly one authority call —
  `packages/runtime/permission-lifecycle/mutation-lane.ts`).
- grant/revoke (Leader): the team tool adapter (`root.ts:3213`) — same
  dispatcher, same service.
- a rule change at restore time is an ordinary PermissionMutation through
  the same service (restore-ruleChange inside `mutation-lane.ts`).
- execution decision: `plane.decisions.decide` from the glue's
  pre-execute point (static lane + overlay behind the lifecycle gate).
- notification emission (NEW, the splice): the completion-point decoration
  of `mutation.governance` at `root.ts:2697-2711` — installed BEFORE the
  plane/remote/tools bind the service, so every committing entry emits
  exactly one DETACHED notice per `{ changed: true }` result. Nothing
  consumes a notification anywhere else (hygiene spec leg 3 pins the exact
  consumer set: runtime = `root.ts` only).

## 4. Notification semantics IN FORCE (post-splice production behavior)

- **Active-only, never a wake.** Delivery is PUBLIC `Agent.inject` ONLY
  (upstream: "queue ... WITHOUT WAKING the driver"). `steer` is forbidden;
  the binding's agent type is `Pick<Agent,'status'|'inject'>` — a
  wake-capable member is not nameable. The synchronous receipt gate is:
  glue closing -> CURRENT owned live handle for the EXACT (team, member)
  pair -> identity -> lifecycle -> `status === 'running'` -> at most ONE
  inject. No await exists between the final check and the send.
- **Idle / cold members are never awakened**: they drop at the gate
  (terminal for the notice). For an ACTIVE target, the inject enters the
  host's durable inbox with host parking semantics AS-IS (a notice may
  wait for a future natural wake; this lane owns no queue, no retry, no
  second path).
- **Producer provenance**: the message carrier is the upstream user-message
  shape (role 'user'), but `source.kind` is the plugin's own
  `plugin:dsh-agent-team` producer — NEVER human `kind:'user'` (which
  would wear the upstream wake-budget Human pathway).
- **Generation is NOT authorization.** The notice carries the generation
  tag + rule COUNT (never the rule set/effect/matcher). A superseded
  notice only MARKS generations; the durable overlay store is the sole
  authority; no decision, ack, gate, or read path consumes a notification
  (ADR §9; lane hygiene + binding specs pin it).
- **Drops are closed and terminal**: `closing | not-live |
  identity-mismatch | lifecycle-blocked | not-running | inject-fault`.
  Lifecycle eligibility for delivery = CREATED/RUNNING/SETTLED;
  ARCHIVED/DISPOSED/unknown never receive.
- The notice text leads with
  `[team-perm-changed team=<t> instance=<i> generation=<g>]` and closes
  with the awareness-only statement + the read-back pointer.

## 5. Baseline failures and limitations (as-is, not smoothed)

- Full runtime suite on this branch: **3300/3308**; the failset is
  BYTE-IDENTICAL to the retained pre-existing baseline (6 files / 8 tests
  + 3 collection-error files): `d3-member-identity-context` (1),
  `p6t3-mediation` (5), `p6t3-restart` (2) — the known live-seam set —
  plus collection failures `p8s3b-result-effects`,
  `t12a-b2-child-identity`, `t12a-glue-handoff-ports`. ZERO new failures
  from this lane; raw: `splice/runtime-suite-full.log` +
  `splice/final-fail-set.txt`. `p6t1` flake family unchanged.
- The integration test is ROOT-ASSEMBLED (real root / governance service /
  durable overlay / receipt gate) with the live AGENT as a labeled
  boundary double; the real-glue receipt block is read-only SOURCE-pinned.
  The host/kit end-to-end (real glue + real running Agent + real UI) is
  the recorded remaining host-dimension acceptance — NOT claimed here.
- The read projection has no production consumer (library).
- No permission notifications without BOTH the overlay port and the live
  glue receipt seam (factory/test roots = zero delivery, fail-closed).

## 6. Reading older statements against today

Historical evidence logs mentioning a frozen "13 tools" catalog are
point-in-time raw logs and stay untouched. Current reality to read them
against: the 13-tool team catalog IS still frozen (this splice adds ZERO
tools and ZERO new RPC beyond what PR #60 landed — the permission write
RPC `override.mutatePermission` exists since PR #60 as the v7-only method;
the notification layer adds NO new surface at all: it reuses the existing
inject path and the existing stores). Any earlier statement phrased as
"no new permission RPC" predates PR #60 and applies to the pre-PR60 tree.
