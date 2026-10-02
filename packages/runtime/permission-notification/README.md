# `permission-notification` — Alpha.3 PR5 (notification + read projection): DRAFT, UNWIRED BY DESIGN

The awareness layer over the merged Alpha.3 permission durable surface
(PR1 overlay store + port, PR3 `mutatePermission`). It implements the two
PR5 deliverables and NOTHING ELSE (ADR §9):

1. **best-effort, generation-tagged notification** of committed permission
   mutations to the addressed Agent — ACTIVE Agents only; idle Agents are
   never awakened (active-only delivery through a READ-ONLY liveness point
   read); a superseded notification only MARKS its generation and the
   superseding generation, it can never alter permissions; delivery failure
   is a liveness failure only — the notifier never throws, so it can never
   affect or roll back a mutation or change the mutation success ack;
2. **the read projection** — frozen read views over the durable overlay
   snapshots (`readAuthority`) and their audit history
   (`readHistoryAudit`), reached through the EXISTING access boundaries
   only (the PR1 port's `latest` / `history`; the injected port type
   narrows `append` away and a Proxy leg pins it at runtime).

Notification and projection output is **awareness, never authorization
evidence**: the lane exports no path to any decision/mutation input
(no authorize/resolve/assemble/mutate/grant/revoke/envelope member — the
closed export vocabulary and the zero-runtime-import graph are pinned
structurally by `test/a3p5-permission-notification-lane-hygiene.test.ts`).
The only cross-lane edges are TYPE-ONLY to the stable PR1 vocabulary
(`../permission-governance/*`); this directory imports NOTHING from
governance internals, the resolver, the effective-policy lane, plugin WIP
files (`host.ts`, permission-plane, blueprint schema) — which also keeps
this PR zero-conflict against PR60's in-flight rewrites.

## WIRED vs PENDING (exact state in this PR)

| Piece | State in this PR |
| --- | --- |
| `permissionChangeNotificationFromSnapshot` (pure builder, generation tag, no rule payload) | implemented + unit-tested (library code; NO production caller yet) |
| `renderPermissionChangeNotification` (deterministic, token-leading `[team-perm-changed …]`, stale/unknown marking) | implemented + unit-tested (library code; NO production caller yet) |
| `createPermissionChangeNotifier` (active-only gate, at-most-once delivery, never-throws outcome) | implemented + unit-tested against fakes + the REAL durable overlay port (library code; NO production emission point yet) |
| `createPermissionReadProjection` (`latest`/`history` frozen views) | implemented + unit-tested over the REAL durable store (library code; NO production read surface exposes it yet) |
| post-commit notification EMISSION inside the permission-lane mutation path | PENDING — small splice after PR60 stabilizes (call `notifyPermissionCommit(result.snapshot)` only in the `changed: true` branch, outcome never joined into the ack) |
| production binding of `PermissionAgentLivenessPort` (existing DSH Agent `status === 'idle'` surface, read-only) + `PermissionNotificationDeliveryPort` (existing active-target input-turn delivery) + the durable overlay port | PENDING — binds EXISTING runtime surfaces only, no new authority surface |
| integration test (post-commit emission + production read-projection wiring over a live world) | PENDING — lands with the splice, coordinated via parent |

Nothing in this directory is constructed by `src/plugin/root.ts`, no dist
artifact ships it yet (same build treatment as the PR1 unwired foundation:
the module is type-checked and tested from source, not part of the tsc
install-surface build), and no runtime behavior of the product changes
when this PR lands. The zero-production-consumer walk leg in the hygiene
spec pins exactly this claim — when the wiring splice lands it must update
that leg deliberately.

## Files

| File | Role |
| --- | --- |
| `types.ts` | closed vocabulary: liveness (READ-ONLY port), delivery port, generation-tagged notification record, staleness/skip/outcome unions, projection views |
| `notification.ts` | pure builder + deterministic renderer + active-only never-throwing notifier factory |
| `projection.ts` | the two read views over `latest`/`history`, deep-frozen copies |
| `index.ts` | closed public surface (pinned by the hygiene spec) |
| `../test/a3p5-permission-notification.test.ts` | the four required classes: active delivered / idle never awakened / stale marked, permissions untouched / failed delivery, mutation result & ack untouched |
| `../test/a3p5-permission-read-projection.test.ts` | projection legs over the REAL durable store (authority = highest generation, history audit-only, append unreachable) |
| `../test/a3p5-permission-notification-lane-hygiene.test.ts` | structural pins: closed exports, zero-runtime-import graph, no decision/mutation-input path, zero production consumers |
