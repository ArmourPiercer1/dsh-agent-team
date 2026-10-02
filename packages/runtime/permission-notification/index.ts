/**
 * Alpha.3 PR5 — permission NOTIFICATION + READ PROJECTION: the module's
 * public surface (plan PR5 "notification and the read projection"; ADR §9
 * "notification is awareness, never authorization evidence").
 *
 * The CLOSED export set is itself a contract, pinned by
 * `test/a3p5-permission-notification-lane-hygiene.test.ts`: two factories,
 * one pure builder, one pure renderer, and types — NO authorize / resolve
 * / assemble / mutate / grant / revoke / envelope / admit / approve
 * member, no path to any decision or mutation input, and zero RUNTIME
 * imports outside this directory (the only cross-lane edges are TYPE-ONLY
 * to the stable PR1 overlay vocabulary).
 *
 * WIRED VS PENDING (the honest state of this PR — see README.md beside
 * this file): NOTHING here is constructed by the production root yet.
 * Emission (post-commit notify inside the permission-lane wiring), the
 * port bindings (agent liveness read, active-target delivery, the durable
 * overlay port), and the end-to-end integration test are a small
 * follow-up splice that lands after PR60 stabilizes the plane/envelope
 * files. Until then this layer is a tested, UNWIRED library that enables
 * no runtime notification and no new read path in production.
 *
 * @module @dsh-agent-team/runtime/permission-notification
 */

export {
  createPermissionChangeNotifier,
  permissionChangeNotificationFromSnapshot,
  renderPermissionChangeNotification,
} from './notification.js'
export type { CreatePermissionChangeNotifierDeps } from './notification.js'
export { createPermissionReadProjection } from './projection.js'
export type { CreatePermissionReadProjectionDeps } from './projection.js'
export type {
  PermissionAgentLiveness,
  PermissionAgentLivenessPort,
  PermissionAgentLivenessQuery,
  PermissionAuthorityView,
  PermissionChangeNotification,
  PermissionHistoryAuditView,
  PermissionHistoryEntryView,
  PermissionNotificationDeliveryPort,
  PermissionNotificationOutcome,
  PermissionNotificationSkip,
  PermissionNotificationStaleness,
  PermissionOverlayIdentity,
  PermissionProvenanceView,
  PermissionReadProjection,
} from './types.js'
