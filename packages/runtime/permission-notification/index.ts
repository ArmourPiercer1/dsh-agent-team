/**
 * Alpha.3 PR5 — permission NOTIFICATION + READ PROJECTION: the module's
 * public surface (plan PR5 "notification and the read projection"; ADR §9
 * "notification is awareness, never authorization evidence").
 *
 * The CLOSED export set is itself a contract, pinned by
 * `test/a3p5-permission-notification-lane-hygiene.test.ts`: two factories,
 * one pure builder, one pure renderer, the inject-only delivery binding
 * (binding.ts), the detached-dispatch helper, and types — NO authorize /
 * resolve / assemble / mutate / grant / revoke / envelope / admit /
 * approve member, no path to any decision or mutation input. Cross-
 * directory edges: within the repo TYPE-ONLY to the stable PR1 overlay
 * vocabulary; by VALUE only the PUBLIC upstream packages
 * `@deepseek-ai/dsh-llm` (`createUserMessage`) and
 * `@deepseek-ai/dsh-agent` (TYPE-only `Agent`) — the parent GO's binding
 * surface. No edge to any host/plugin-WIP/governance-internals file.
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
export {
  createPermissionDeliveryAdapter,
  createPermissionDeliveryBinding,
  detachPermissionNotice,
  PermissionNoticeDropped,
} from './binding.js'
export type {
  CreatePermissionDeliveryBindingDeps,
  PermissionDeliveryBinding,
  PermissionInjectableAgent,
  PermissionLiveHandle,
  PermissionNoticeDrop,
  PermissionNoticeInput,
  PermissionNoticeReceipt,
} from './binding.js'
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
