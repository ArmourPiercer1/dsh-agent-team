/**
 * Async work completion (wake-up) — the notification module's public
 * surface (the pure renderer + the notifier factory + the closed types).
 */

export {
  createWorkCompletionNotifier,
  renderWorkCompletionNotification,
} from './notification.js'

export type {
  WorkCompletionNotification,
  WorkCompletionNotificationPort,
  WorkCompletionNotificationTarget,
  WorkCompletionNotificationDeliveryPort,
} from './types.js'
