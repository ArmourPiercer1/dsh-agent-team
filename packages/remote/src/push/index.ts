/**
 * @dsh-agent-team/remote/push — the P8-T4 push model surface.
 *
 * The client-side sync engine over the frozen Remote contract v1
 * surface: whole-projection generation (a frame is applied only when
 * strictly newer — Gate G8), versioned invalidation + pull, the P2-T6
 * aligned reconnect backoff rule, and the ledger page anchor rule
 * (remote-level pagination, D-5).
 *
 * Everything here is pure (no I/O, no timers, no node: builtins): the
 * engine computes verdicts, caps, delays and cursor transitions; the
 * test client fixture (`test/p8t4-test-client.ts`) and a real deployment
 * supply the transport and the clock.
 * @module @dsh-agent-team/remote/push
 */

export {
  PushBackoffRangeError,
  backoffCapMs,
  defaultDelayPicker,
  isStateChange,
  pickBackoffDelayMs,
  stateOnConnect,
  stateOnLoss,
} from './reconnect.js'

export { PUSH_MIN_GENERATION, decideFrameVerdict, isStrictlyNewerGeneration } from './generation.js'

export {
  PULL_PROJECTION_ENDPOINT,
  assessProjectionSync,
  extractPushFrame,
  isApplyAssessment,
} from './pull.js'

export {
  createLedgerPageTracker,
  verifyLedgerPageAnchor,
} from './ledger-page.js'
export type { LedgerPageTracker, LedgerPageTrackerState } from './ledger-page.js'

export type {
  AppliedProjectionIdentity,
  FrameVerdict,
  PageAnchorRequest,
  PageCheckResult,
  PageFetchReport,
  PageRejectReason,
  PushBackoffConfig,
  PushBackoffEntry,
  PushClientState,
  ProjectionSyncAssessment,
  ProjectionSyncStatus,
  ReconnectState,
  RemotePushFrame,
  RemotePushTransport,
  SeamClientRequest,
  SeamServerResponse,
} from './types.js'
export { PushTransportLossError } from './types.js'
