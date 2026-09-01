/**
 * P8-S5 — the pure handoff source-surface mapper (plan §19.1, node A28's
 * stage 1).
 *
 * Maps the public DSH session-query read
 * (`ctx.sessionQuery.readSurface(sessionId)`, live-preferred,
 * snapshot-once) onto the frozen handoff
 * {@link SourceCanonicalSurface} contract:
 *
 * - `sessionId`  — the header's session id (the surface is
 *   self-describing per the contract);
 * - `title`      — the header title, `null` when the source carries none;
 * - `createdAt`  — the header's Unix-epoch-millisecond creation time,
 *   rendered ISO-8601 (the contract's wire shape);
 * - `messages`   — the CONVERSATION messages of the current surface in
 *   model-history order: `user/message` events (role `user`) and
 *   `assistant/message` events (role `assistant`). Structural events
 *   (`turn/*`, `step/*`, `request/*`) and tool events are NOT
 *   conversation messages and are excluded (the handoff context is the
 *   canonical message list, Architecture §34.2);
 * - `metadata`   — the lossless-JSON passthrough of the observation
 *   identity (`capturedThroughSeq`, the header lineage fields).
 *
 * Pure module: NO I/O, NO `node:` builtins, NO bare `@deepseek-ai/*`
 * imports — the DSH snapshot is consumed through the structural
 * `SessionSurfaceSnapshotLike` mirror below (the live binding in
 * `host.ts` passes the service's snapshot verbatim). The text
 * extraction mirrors the first-party session-query extraction for the
 * two message roles (text blocks only; non-text blocks carry no
 * canonical message text).
 *
 * @module @dsh-agent-team/runtime/plugin/surface-reader
 */

import type {
  SourceCanonicalMessage,
  SourceCanonicalSurface,
} from '../../handoff/index.js'
import type { RemoteSafeRecord } from '../../../contracts/src/index.js'

/** The first-party persona/system-prompt section names are upstream
 *  constants; the only one this module needs is the conversation
 *  message event types (upstream session event vocabulary, stable). */
const USER_MESSAGE_EVENT = 'user/message'
const ASSISTANT_MESSAGE_EVENT = 'assistant/message'

/** A structural mirror of one content block of a conversation message
 *  (the upstream `ContentBlock` union; only the `text` block carries
 *  canonical message text). */
export interface SessionContentBlockLike {
  readonly type: string
  readonly text?: string
}

/** A structural mirror of one current-surface event of the DSH
 *  session-query snapshot (`SurfaceEvent`: a session event narrowed to
 *  the surface-producing vocabulary). Only the fields the mapper reads
 *  are mirrored; the live binding passes the real snapshot verbatim. */
export interface SessionSurfaceEventLike {
  /** The session event discriminant. */
  readonly type: string
  /** The event payload (structural: the mapper reads `content` for
   *  `user/message` and `message.content` for `assistant/message`). */
  readonly data: Readonly<Record<string, unknown>> | null
}

/** A structural mirror of the upstream session header (the fields the
 *  mapper reads; the live binding passes the real header verbatim). */
export interface SessionHeaderLike {
  /** The session id. */
  readonly id: string
  /** Non-negative safe-integer Unix epoch milliseconds. */
  readonly createdAt: number
  /** The session title, when the source carries one. */
  readonly title?: string | null
  /** The fork/seed lineage (provenance metadata for the passthrough). */
  readonly parentSession?: string
  /** The coarse origin classification, when present. */
  readonly origin?: string
}

/** A structural mirror of the session-query `SessionSurfaceSnapshot`
 *  (one atomic live-preferred observation of a session's current model
 *  surface). */
export interface SessionSurfaceSnapshotLike {
  /** The cloned session header of the observation. */
  readonly session: SessionHeaderLike
  /** The highest raw-log seq in the observation, or `null`. */
  readonly capturedThroughSeq: number | null
  /** The cloned current-surface events in model-history order. */
  readonly events: readonly SessionSurfaceEventLike[]
}

/** Extract the canonical text of one conversation message from its
 *  content blocks (text blocks only, joined in order).
 * @param content - the raw content array of the message event payload.
 * @returns the joined text, or the empty string when no text block.
 */
function contentText(content: unknown): string {
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const block of content) {
    if (block !== null && typeof block === 'object') {
      const candidate = block as SessionContentBlockLike
      if (candidate.type === 'text' && typeof candidate.text === 'string') {
        parts.push(candidate.text)
      }
    }
  }
  return parts.join('')
}

/**
 * Map one DSH session-query surface snapshot onto the frozen handoff
 * {@link SourceCanonicalSurface}.
 *
 * @param snapshot - the `readSurface` observation (passed verbatim by
 *   the live binding; structurally checked here).
 * @returns the canonical surface (lossless JSON; the handoff service
 *   deep-frees and detaches it per its contract).
 */
export function toSourceCanonicalSurface(
  snapshot: SessionSurfaceSnapshotLike,
): SourceCanonicalSurface {
  const header = snapshot.session
  const messages: SourceCanonicalMessage[] = []
  for (const event of snapshot.events) {
    if (event.type === USER_MESSAGE_EVENT) {
      const content = event.data !== null ? event.data['content'] : undefined
      const text = contentText(content)
      if (text !== '') messages.push({ role: 'user', text })
    } else if (event.type === ASSISTANT_MESSAGE_EVENT) {
      const message = event.data !== null ? event.data['message'] : undefined
      const content =
        message !== null && typeof message === 'object'
          ? (message as Readonly<Record<string, unknown>>)['content']
          : undefined
      const text = contentText(content)
      if (text !== '') messages.push({ role: 'assistant', text })
    }
  }
  const metadata: RemoteSafeRecord = {
    capturedThroughSeq: snapshot.capturedThroughSeq,
  }
  if (header.parentSession !== undefined) {
    metadata['parentSession'] = header.parentSession
  }
  if (header.origin !== undefined) {
    metadata['origin'] = header.origin
  }
  return {
    sessionId: String(header.id),
    title: typeof header.title === 'string' && header.title !== '' ? header.title : null,
    createdAt: new Date(header.createdAt).toISOString(),
    messages,
    metadata,
  }
}
