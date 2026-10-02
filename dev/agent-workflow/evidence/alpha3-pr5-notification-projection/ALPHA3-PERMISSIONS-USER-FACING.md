# Alpha.3 permission lifecycle + change notifications — what a user can actually use TODAY

Consolidated docs pass (final splice + ROOT BLOCK-1/BLOCK-2 fix round, PR
#61). Everything below is read from the REAL code and REAL tests on this
branch (merge of master `940cd841` + the final production splice + the
fix batch at HEAD). File:line citations are
as of the splice commit. No ADR is rewritten; no plan is expanded.

## 1. Implemented Alpha.3 entry points (permission lifecycle)

All writes ride ONE governance mutation authority
(`createGovernanceMutationService`, committed durably BEFORE the ack). The
production root wires it once; every entry reaches the same service:

| Entry | What it is | Where |
| --- | --- | --- |
| `plane.mutation.grantInstance` / `plane.mutation.revoke` / `plane.mutation.restore` | the in-process permission plane (grant / revoke / member restore), assembled by the root and exposed through the shared `permissionPlaneRef` (the `controlServiceRef` pattern) | `packages/runtime/src/plugin/root.ts:2748-2761` (`createTeamPermissionLanes`), entry dispatcher `permissionLaneMutate` at `root.ts:2788` |
| remote RPC `override.mutatePermission` | the v7-ONLY remote method for the human/operator grant/revoke lane (the one version-gated addition to the remote catalog since PR #60; v<7 gets the typed `method-version-unsupported`) | wired at `root.ts:3066` (`permission: { mutatePermission: permissionLaneMutate, getPermission }`); method catalog `packages/remote/src/contracts/catalog.ts` (`REMOTE_V7_ONLY_METHODS = ['override.mutatePermission']`) |
| remote RPC `override.getPermission` (NEW, ROOT BLOCK-1) | the v7-ONLY remote READ pair: the durable permission overlay's CURRENT authority + ascending AUDIT history for one exact addressed (team, member) pair, served by the production readprojection (`createPermissionReadProjection`) through an append-NARROWED seam (no `append` member even by type). Wire-seam access gate: host operator / team Leader / member-SELF only (cross-member refused `TEAM_REMOTE_PRINCIPAL_INVALID`, the read seam never invoked); ghost identity = typed `PERMISSION_LIFECYCLE_INSTANCE_UNKNOWN` (mirrors the write side; never an empty-view masquerade); ARCHIVED/DISPOSED history stays audit-visible (lifecycle gates EXECUTION, not the durable audit read); foreign team = `TEAM_REMOTE_FOREIGN_TEAM`; v<7 = `method-version-unsupported`. Execution authorization NEVER consults it (ADR §9; zero-reference leg pinned) | seam composed at `root.ts:2713` + wired at `root.ts:3071`; handler + gate `s6-remote.ts:2974` (dispatch case :3715); catalog `packages/remote/src/contracts/catalog.ts:105` + `REMOTE_V7_ONLY_METHODS` :219; closed params (`teamSessionId`, `memberInstanceId`, NO actor field — the `override.get` read precedent) `packages/remote/src/contracts/params.ts:1512` |
| the Leader tool lane | the team tool's permission adapter (Leader gate inside the tool layer), SAME dispatcher | `root.ts:3213` (`permission: { mutatePermission: permissionLaneMutate, ... }` into `createTeamTools`) |
| `restore` | threads the ONE lifecycle path (ARCHIVED -> SETTLED, one durable commit, zero live contact); the lane performs no transition of its own and writes NO permission snapshot for a pure restore | `root.ts:2757` (`lifecycleService.restoreMember`) |

Read side: the execution decision reads the same durable overlay behind the
ADR §8 lifecycle gate through `plane.decisions.decide` (pre-execute adapter
in the live glue); effective-permission views stay on the pre-existing
inspect surfaces. The notification lane's own
`createPermissionReadProjection` is now WIRED (ROOT BLOCK-1): the root
composes it over the SAME shared durable overlay port behind an
append-NARROWED seam and serves it as the v7-only remote read method
`override.getPermission` (row `override.getPermission` above; tests
`test/a3p5-permission-read-wiring.test.ts`, root-assembled router).

## 2. `permissionMutationEnvelope` — the addressed-team expansion ceiling

A Blueprint carrier the addressed team's bound expansion authority is read
from (per TARGET member). A faithful quote with placeholder substitution (`${operationClass}` ->
`<operationClass>` etc.) from the test that
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
is absent (`root.ts:771` deps doc).

## 3. Where grant/revoke/read-projection are ACTUALLY invoked

- grant/revoke (human/operator): remote `override.mutatePermission` ->
  `permissionLaneMutate` -> `plane.mutation.grantInstance|revoke` ->
  `governance.mutatePermission` (ONE writer; lane pre-check
  `assertPermissionMutationTarget` then exactly one authority call —
  `packages/runtime/permission-lifecycle/mutation-lane.ts`).
- grant/revoke (Leader): the team tool adapter (`root.ts:3267`) — same
  dispatcher, same service.
- a rule change at restore time is an ordinary PermissionMutation through
  the same service (restore-ruleChange inside `mutation-lane.ts`).
- execution decision: `plane.decisions.decide` from the glue's
  pre-execute point (static lane + overlay behind the lifecycle gate).
- notification emission (the splice): the completion-point decoration
  of `mutation.governance` at `root.ts:2722-2737` — installed BEFORE the
  plane/remote/tools bind the service, so every committing entry emits
  exactly one DETACHED notice per `{ changed: true }` result. Nothing
  consumes a notification anywhere else (hygiene spec leg 3 pins the exact
  consumer set: runtime = `root.ts` only).
- permission overlay READ (NEW, ROOT BLOCK-1): remote
  `override.getPermission` -> s6-remote gate + `assertBoundRoot` ->
  root-composed append-narrowed `createPermissionReadProjection` ->
  `permissionOverlay.latest|history` (READ members only; zero writes
  pinned by the whole-battery byte-identity leg).

## 4. Notification semantics IN FORCE (post-splice production behavior)

- **Active-only, never a wake.** Delivery is PUBLIC `Agent.inject` ONLY
  (upstream: "queue ... WITHOUT WAKING the driver"). `steer` is forbidden;
  the binding's agent type is `Pick<Agent,'status'|'inject'>` — a
  wake-capable member is not nameable. The synchronous receipt gate is:
  glue closing -> CURRENT owned live handle for the EXACT (team, member)
  pair -> identity -> lifecycle -> `status === 'running'` -> at most ONE
  inject. No await exists between the final check and the send.
- **Idle / cold members are never awakened**: delivery requires
  SETTLED-eligibility AND the ACTUAL agent status being `running` — an
  idle target DROPS at the gate (never parked, queued or woken; terminal
  for the notice). For an ACTIVE target, the inject enters the
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
  boundary double. The receipt CODE itself is now exercised for real:
  `test/a3p5-glue-permission-receipt.test.ts` runs the ACTUAL
  `agent-bindings.mjs` receipt through the t12a live bridge (hostless
  dependent fakes, real boot seed/restore paths; 8 legs incl. the
  anti-echo drop). The host/kit end-to-end (real host + real running
  Agent + real UI) remains the recorded host-dimension acceptance — NOT
  claimed here.
- The read projection IS wired (`override.getPermission`, section 1/3);
  its access boundaries and audit doctrine are pinned by
  `test/a3p5-permission-read-wiring.test.ts` (12 legs).
- No permission notifications without BOTH the overlay port and the live
  glue receipt seam (factory/test roots = zero delivery, fail-closed).

## 6. Reading older statements against today

Historical evidence logs mentioning a frozen "13 tools" catalog are
point-in-time raw logs and stay untouched. Current reality to read them
against, verified against the REAL catalog source (not memory): the team
tool catalog is **15 tools** — the 13 original `team_*` tools defined in
`packages/tools/src/tools.ts` plus `team_grant_permission` and
`team_revoke_permission`, shipped by PR #60 (same file; the table at
:36-37 and the factory at :1316). That 15-tool set is the CURRENT closed
catalog; this lane adds ZERO tools. On the RPC axis, PR #60 landed the
v7-only permission WRITE method `override.mutatePermission`; this branch
adds its v7 co-tenant READ pair `override.getPermission` (31 methods in
the closed remote catalog). Any earlier statement phrased as "no new
permission RPC" predates PR #60 and applies to the pre-PR60 tree; any
"13 tools" statement predates PR #60.

## 7. MERGE IS NOT DEPLOYMENT — what the CURRENT instance loads (honesty section)

Static, read-only facts from this repo (no host was started, stopped,
inspected at runtime, or restarted for this document; :3080/:3180
zero-touch):

- Every plugin package resolves through its `package.json`
  `main`/`exports` to `./dist/...` (e.g. `packages/runtime/package.json:6-9`,
  `packages/client/package.json:6-9`). The install surface is the COMMITTED
  `dist` (verified by `scripts/check-artifacts-committed.mjs`, `pnpm
  check:artifacts`), plus the composition bundle built by
  `pnpm build:composition` (`scripts/place-dist-glue.mjs` +
  `scripts/build-client-composition.mjs` ->
  `packages/client/composition-shim/client-bundle.js`).
- `docs/TEST_METHODS.md` §2 describes the boot contract: the plugin tree is
  loaded AT HOST BOOT (the boot line appearing = plugin tree loaded); test
  worlds mount it via `DSH_HOME/profiles/web` bundles / `cordis.patch.yml`.
- Consequence, stated plainly: **a running DSH backend keeps serving the
  compiled content it loaded at boot; merging PR #61 changes nothing for
  it.** To exercise THIS branch the operator must (1) get the branch /
  merged master content, (2) `pnpm build && pnpm build:composition` (or
  `pnpm setup`) so `dist` + the composition bundle are the new artifacts,
  and (3) make the instance load them — plugin reload if the host supports
  one, otherwise a backend restart. Whether the CURRENT stable :3080
  instance supports hot plugin reload is **UNVERIFIED here** (this lane
  never touched it — strict prohibition; its DSH_HOME/layout was not
  inspected); plan for a restart performed by the operator, not by any
  agent in this lane.
- Host/kit-dimension acceptance for THIS lane is recorded NOT_RUN: no
  end-to-end host run of the new surfaces exists yet; the checklist below
  IS that acceptance, performed by a human.

## 8. Manual acceptance checklist (human-performed, post-merge)

Based ONLY on entry points that are actually published on this branch and
the Blueprint carrier shape in section 2. Run against a TEST instance
(port 3180 family per TEST_METHODS; never :3080). Remote legs require the
v7 protocol version.

1. Build gate: `pnpm build && pnpm build:composition` then
   `pnpm check:artifacts` rc=0 on the merged tree.
2. Boot a test instance from the merged tree (boot line appears = plugin
   tree loaded) and create a team from a valid Blueprint that carries the
   section-2 `permissionMutationEnvelope` (a non-empty rule set; the real
   fixture shape is `packages/runtime/test/a3p4-r4-authority-binding.test.ts:163-172`).
3. Tool surface: the Leader session exposes 15 `team_*` tools including
   `team_grant_permission` and `team_revoke_permission`.
4. WRITE leg: as Leader, `team_grant_permission` for one exact file
   resource on one existing member -> ack reports a committed change.
   Operator-side equivalent: remote `override.mutatePermission` (v7).
5. READ leg: remote `override.getPermission` (v7) for the same (team,
   member) pair -> `authority` shows the grant (present) and `history`
   lists the committed snapshots in ascending generation order.
6. ACTIVE notification: with the addressed member RUNNING, performing leg
   4 delivers EXACTLY ONE message to that member starting
   `[team-perm-changed team=... instance=... generation=...]`, containing
   no rule bodies; the member is not restarted.
7. IDLE no-wake: same grant/revoke while the member is IDLE -> the member
   receives NOTHING and is NOT woken (no new activity appears on it); the
   WRITE leg still commits (leg 5 read-back proves it).
8. Negative reads: `override.getPermission` for an unknown memberInstanceId
   -> typed `PERMISSION_LIFECYCLE_INSTANCE_UNKNOWN` (NOT an empty view);
   for a member of ANOTHER team -> `TEAM_REMOTE_FOREIGN_TEAM`; the call at
   protocol v6 -> `method-version-unsupported`.
9. Lifecycle audit: archive the member, then re-read -> the audit history
   REMAINS readable (disposed/archived history is audit-visible); create a
   fresh member -> its read shows `authority` absent (no inheritance from
   the archived one).

Anything that deviates from steps 3-9 is a finding against this PR scope.
Stage completion rule (per ROOT): the final commit version + this
checklist + the limitations above are delivered when all five PRs are
complete, and the stage is marked complete only after the human acceptance
pass.
