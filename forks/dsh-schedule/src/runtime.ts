/** Host timer over stored tasks; Session activation is a delivery operation. */
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ContextFormed } from '@deepseek-ai/dsh-llm'
declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'schedule': { kind: 'schedule' } & ContextFormed
  }
}
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-session-controller'
import { isRecurringScheduleRecord, renderReminderFraming, renderRecurringReminderBatchFraming, resolveRecurringOccurrence } from './domain.ts'
import type { DeliveryRetentionBounds, RecurringScheduleRecord } from './types.ts'
import type { ScheduleTask } from './storage.ts'
import { appendDelivery } from './delivery-history.ts'

/** Largest delay Node timers represent without clamping. */
export const MAX_TIMER_DELAY_MS = 2_147_483_647

/** Owns at most one timer across recomputations; delivery and management share the serialized operation. */
// FORK(dsh-schedule a5m2.1) — TRIGGER ADMISSION consumer (root ruling
// 2026-10-26): every firing must pass REAL governed admission, reusing the
// Team plane's existing PA/Guard audit as the carrier (the consumer IS that
// admission — no parallel ledger, no new persisted schema, no second timer
// anywhere in this fork). Law: consumer ABSENT or REFUSING => no resolve,
// no wake, no flush, no commit (never a fake delivery success); the row
// stays active and is retried after an IN-MEMORY-ONLY backoff (no persisted
// state change). `revision` is null because the durable row schema has NO
// revision field at 639 — never fabricated.
export interface ScheduleTriggerIntent {
  readonly ownerSessionId: string
  readonly taskId: string
  readonly revision: null
  readonly occurrence: { readonly scheduledAt: string, readonly occurrenceAt: string }
  readonly destination: { readonly sessionId: string }
  readonly groupSize: number
  readonly phase: 'pre-resolve' | 'pre-followup'
}
export type ScheduleTriggerAdmission = (intent: ScheduleTriggerIntent) => boolean | Promise<boolean>

export class ScheduleRuntime {
  private timer: ReturnType<typeof setTimeout> | undefined
  private running: Promise<void> | undefined
  private stopping = false
  private requested = false

  /**
   * @param ctx - Host services used to resume and enqueue.
   * @param tasks - Current durable tasks.
   * @param transact - Serialize delivery against management writes.
   * @param commit - Persist task status, target, receipt, and history together after durable inbox delivery.
   */
  constructor(
    private readonly ctx: Context,
    private readonly tasks: () => readonly ScheduleTask[],
    private readonly transact: (work: () => Promise<void>) => Promise<void>,
    private readonly commit: (task: ScheduleTask) => Promise<void>,
    private readonly retention: DeliveryRetentionBounds,
    // FORK(dsh-schedule a5m2.1): lazy getter so assembly may register the
    // admission consumer before OR after the runtime is constructed.
    private readonly admitTrigger: () => ScheduleTriggerAdmission | undefined = () => undefined,
  ) {}

  // FORK(dsh-schedule a5m2.1): refused groups back off IN MEMORY ONLY so a
  // rejection cannot spin the existing timer; zero persisted change.
  private readonly forkDeferredUntil = new Map<string, number>()
  private static readonly FORK_REJECT_BACKOFF_MS = 5000

  /**
   * Recompute the nearest obligation after startup or a durable change.
   * Dispatch failures are logged; refused admission does not retry automatically.
   */
  requestDrive(): void {
    if (this.stopping) return
    this.requested = true
    this.clearTimer()
    if (this.running !== undefined) return
    let run: Promise<void>
    try {
      run = this.ctx.agents.withoutInitiator(async () => {
        while (this.requested && !this.stopping) {
          this.requested = false
          await this.transact(async () => { await this.drive() })
        }
      })
    } catch (error: unknown) {
      // Ancestor unloading closes initiator admission before runtime cleanup runs.
      this.requested = false
      this.ctx.logger.warn(`schedule: dispatch stopped: ${String(error)}`)
      return
    }
    this.running = run
    void run.catch((error: unknown) => {
      this.ctx.logger.warn(`schedule: dispatch stopped: ${String(error)}`)
    }).finally(() => {
      this.running = undefined
      if (this.requested && !this.stopping) this.requestDrive()
    })
  }

  /** Stop the timer and drain an accepted delivery before storage closes. */
  async dispose(): Promise<void> {
    this.stopping = true
    this.clearTimer()
    // requestDrive reports execution failures; teardown only waits for quiescence.
    await this.running?.catch(() => undefined)
  }

  private clearTimer(): void {
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
  }

  private async drive(): Promise<void> {
    this.clearTimer()
    const failed = new Set<string>()
    const handled = new Set<string>()
    const scanNow = Date.now()
    // FORK(dsh-schedule a5m2.1): admission-deferred rows keep their timer
    // obligation (still active, still due) but skip THIS pass until the
    // in-memory backoff passes — the ORIGINAL rows/commit law is untouched.
    const due = this.tasks().filter(task => task.status === 'active' && Date.parse(task.record.scheduledAt) <= scanNow && (this.forkDeferredUntil.get(task.record.id) ?? 0) <= scanNow)
    for (const task of due) {
      if (this.stopping) return
      if (handled.has(task.record.id)) continue
      const group = isRecurringScheduleRecord(task.record)
        ? due.filter(candidate => candidate.sessionId === task.sessionId && isRecurringScheduleRecord(candidate.record))
        : [task]
      for (const member of group) handled.add(member.record.id)
      let admitted = group
      const committed = new Set<ScheduleTask['record']['id']>()
      // FORK(dsh-schedule a5m2.1): (1) admission BEFORE resolveAgent, per
      // due group. Consumer absent or refusing = no wake at all; the group
      // is deferred in memory and the row stays active (no fake delivery).
      const admit = this.admitTrigger()
      const admitIntent = (phase: ScheduleTriggerIntent['phase']): ScheduleTriggerIntent => ({
        ownerSessionId: task.sessionId,
        taskId: task.record.id,
        revision: null,
        occurrence: { scheduledAt: task.record.scheduledAt, occurrenceAt: task.record.scheduledAt },
        destination: { sessionId: task.sessionId },
        groupSize: group.length,
        phase,
      })
      if (admit === undefined) {
        this.ctx.logger.warn(`schedule[fork]: trigger admission consumer ABSENT — refusing wake for ${task.record.id} (fail closed; row stays active)`)
        for (const member of group) this.forkDeferredUntil.set(member.record.id, scanNow + ScheduleRuntime.FORK_REJECT_BACKOFF_MS)
        continue
      }
      let preResolveOk: boolean
      try {
        preResolveOk = await admit(admitIntent('pre-resolve'))
      } catch {
        preResolveOk = false
      }
      if (preResolveOk !== true) {
        this.ctx.logger.warn(`schedule[fork]: trigger admission REFUSED (pre-resolve) for ${task.record.id} — no wake (row stays active)`)
        for (const member of group) this.forkDeferredUntil.set(member.record.id, scanNow + ScheduleRuntime.FORK_REJECT_BACKOFF_MS)
        continue
      }
      try {
        const resolved = await this.ctx.sessionController.resolveAgent(task.sessionId)
        if ('error' in resolved) throw resolved.error
        // oxlint-disable-next-line typescript/no-unnecessary-condition -- Disposal can run while Session restoration is awaited.
        if (this.stopping) return
        const now = Date.now()
        // Session restoration can span a wall-clock rollback; future members keep their timer obligation.
        admitted = group.filter(member => Date.parse(member.record.scheduledAt) <= now)
        if (admitted.length === 0) continue
        const recurring = admitted.filter((member): member is ScheduleTask & { record: RecurringScheduleRecord } =>
          isRecurringScheduleRecord(member.record))
        const occurrences = recurring.map(member => ({
          task: member, occurrence: resolveRecurringOccurrence(member.record, now),
        }))
        const text = isRecurringScheduleRecord(task.record)
          ? renderRecurringReminderBatchFraming(occurrences.map(({ task: member, occurrence }) => ({
            record: member.record, occurrenceAt: occurrence.occurrenceAt,
          })))
          : renderReminderFraming(task.record)
        const message = createUserMessage({
          content: [{ type: 'text', text }], source: { kind: 'schedule' },
        })
        // FORK(dsh-schedule a5m2.1): (2) NEW consumption immediately BEFORE
        // followup (current policy/owner re-check at the real delivery
        // point). Refusal = no followup, no flush, no commit — the delivery
        // never happened and nothing claims it did.
        let preFollowupOk: boolean
        try {
          preFollowupOk = await admit(admitIntent('pre-followup'))
        } catch {
          preFollowupOk = false
        }
        if (preFollowupOk !== true) {
          this.ctx.logger.warn(`schedule[fork]: trigger admission REFUSED (pre-followup) for ${task.record.id} — no wake, no flush, no commit`)
          for (const member of group) this.forkDeferredUntil.set(member.record.id, scanNow + ScheduleRuntime.FORK_REJECT_BACKOFF_MS)
          continue
        }
        // followup synchronously appends the inbox splice before flush observes the Session.
        resolved.agent.followup(message)
        const flushed = await this.ctx.sessions.flush(resolved.agent.session)
        if (!flushed) throw new Error('Session persistence did not acknowledge the reminder')
        const deliveredAt = new Date(Date.now()).toISOString()
        if (!isRecurringScheduleRecord(task.record)) {
          await this.commit({
            ...task, status: 'inactive',
            ...appendDelivery(task, { scheduledAt: task.record.scheduledAt, deliveredAt, messageId: message.id }, this.retention),
          })
          committed.add(task.record.id)
        }
        for (const { task: member, occurrence } of occurrences) {
          await this.commit({
            ...member,
            record: { ...member.record, scheduledAt: occurrence.nextScheduledAt ?? occurrence.occurrenceAt },
            status: occurrence.nextScheduledAt === undefined ? 'inactive' : 'active',
            ...appendDelivery(member, { scheduledAt: occurrence.occurrenceAt, deliveredAt, messageId: message.id }, this.retention),
          })
          committed.add(member.record.id)
        }
      } catch (error: unknown) {
        // Successful commits and targets made future by clock rollback keep their timer obligation.
        const pending = admitted.filter(member => !committed.has(member.record.id))
        const failedAt = Date.now()
        for (const member of pending) {
          if (Date.parse(member.record.scheduledAt) <= failedAt) failed.add(member.record.id)
        }
        const ids = pending.map(member => member.record.id)
        this.ctx.logger.warn(`schedule: reminders ${JSON.stringify(ids)} were not acknowledged: ${String(error)}`)
      }
    }
    if (this.stopping) return
    const next = this.tasks().filter(task => task.status === 'active' && !failed.has(task.record.id))
      .reduce<number | undefined>((at, task) => {
        const target = Date.parse(task.record.scheduledAt)
        return at === undefined ? target : Math.min(at, target)
      }, undefined)
    if (next !== undefined) {
      this.timer = setTimeout(() => { this.timer = undefined; this.requestDrive() },
        Math.max(0, Math.min(next - Date.now(), MAX_TIMER_DELAY_MS)))
      this.timer.unref()
    }
  }
}
