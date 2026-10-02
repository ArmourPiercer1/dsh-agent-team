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
 * WIRED VS PENDING (the current wiring state — see README.md beside this
 * file): the notification emitter is WIRED at exactly ONE production
 * point — `src/plugin/root.ts`, the governance-mutation completion point
 * (post-COMMIT, fire-and-forget, active-only inject). Its outputs feed
 * nothing else; the layer is never an authorization source (ADR §9). The
 * READ PROJECTION is WIRED (ROOT BLOCK-1) as a second read surface in
 * that same file: the append-NARROWED seam behind the v7-only remote read
 * method `override.getPermission` — a pure read that execution
 * authorization never consults. The lane ships into the install surface
 * TRANSITIVELY through root.ts's import chain (dist co-commit).
 *
 * @module @dsh-agent-team/runtime/permission-notification
 */
export { createPermissionChangeNotifier, permissionChangeNotificationFromSnapshot, renderPermissionChangeNotification, } from './notification.js';
export { createPermissionReadProjection } from './projection.js';
export { createPermissionDeliveryAdapter, createPermissionDeliveryBinding, detachPermissionNotice, PermissionNoticeDropped, } from './binding.js';
//# sourceMappingURL=index.js.map