/**
 * Alpha.6 PR6 — the root composition helper (pure, exported for the wiring spec).
 *
 * It chooses between the legacy Leader notifier and the Officer wake. Every
 * precondition is checked here, so `root.ts` only forwards live seams.
 *
 * @module @dsh-agent-team/runtime/alpha6/wiring
 */
import { parseBlueprintV5 } from '../../domain/blueprint/src/blueprint-v5.js'
import type { ControlRequestNotificationPort } from '../control/types.js'
import { createLeaderControlNotifier } from '../control/leader-notification.js'
import { decideAlpha6Composition } from './composition.js'
import { createComposedControlNotifier } from './notifier.js'

export interface Alpha6WiringMember {
  readonly templateId: string
  readonly childSessionId: string
}

export interface Alpha6WiringConfig {
  readonly alpha6ReviewRouting?: boolean
  readonly blueprintSource: string
  readonly rootSessionId: string
  readonly seedMembers: readonly Alpha6WiringMember[]
}

export interface Alpha6WiringLive {
  readonly deliverRootControlNotification?: (input: {
    readonly rootSessionId: string
    readonly requestId: string
    readonly text: string
  }) => Promise<void>
  readonly deliverReviewWake?: (input: {
    readonly rootSessionId: string
    readonly targetSessionId: string
    readonly wakeId: string
    readonly text: string
  }) => Promise<void>
}

export function controlRequestNotification(
  config: Alpha6WiringConfig,
  live: Alpha6WiringLive,
): { requestNotification?: ControlRequestNotificationPort } {
  if (live.deliverRootControlNotification === undefined) return {}
  const legacy = createLeaderControlNotifier({ deliver: live.deliverRootControlNotification })
  if (config.alpha6ReviewRouting !== true || live.deliverReviewWake === undefined) {
    return { requestNotification: legacy }
  }
  try {
    const blueprint = parseBlueprintV5(config.blueprintSource)
    const routing = blueprint.reviewRouting
    if (routing === undefined) return { requestNotification: legacy }
    const leader = config.seedMembers.find((member) => member.childSessionId === config.rootSessionId)
    const officer = config.seedMembers.find((member) => member.templateId === routing.officerTemplateId)
    const decision = decideAlpha6Composition({
      enabled: true,
      blueprintDocumentVersion: blueprint.schemaVersion,
      reviewRouting: { enabled: routing.enabled, officerTemplateId: routing.officerTemplateId },
      activeMemberTemplateIds: config.seedMembers.map((member) => member.templateId),
      leaderTemplateId: leader?.templateId ?? '',
    })
    if (decision.mode === 'refused') {
      return {
        requestNotification: {
          notifyLeaderRequest: async () => {
            throw new Error(`Alpha.6 review routing is enabled but refused (${decision.refused}); no Leader fallback`)
          },
        },
      }
    }
    if (decision.mode !== 'alpha6' || officer === undefined) return { requestNotification: legacy }
    const wake = live.deliverReviewWake
    return {
      requestNotification: createComposedControlNotifier({
        decision,
        legacy,
        recipientSessionId: officer.childSessionId,
        wake: (input) => wake({
          rootSessionId: config.rootSessionId,
          targetSessionId: input.targetSessionId,
          wakeId: input.wakeId,
          text: input.text,
        }),
      }),
    }
  } catch {
    // Explicitly enabled but unparsable: fail closed, never the Leader.
    return {
      requestNotification: {
        notifyLeaderRequest: async () => {
          throw new Error('Alpha.6 review routing is enabled but the Blueprint did not parse as v5; no Leader fallback')
        },
      },
    }
  }
}
