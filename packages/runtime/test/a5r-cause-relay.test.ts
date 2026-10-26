/**
 * a5r-cause-relay.test.ts — #340 follow-up (C1 swallow diagnosis, problem ②):
 * the install wrapper's cancel-CAUSE relay. RED-first repair ticket:
 * `dev/agent-workflow/evidence/alpha5/c1-swallow-diag/repair-ticket-install-signal-cause.md`.
 *
 * THE MEASURED FACT this pins, from the assembly-level kit (DIAGNOSIS §②③ and
 * the ≥3-run distribution table: runs 21-34-31Z / 21-40-43Z / 21-50-31Z): the
 * host phase signal reaches `tools/execute` carrying `{"kind":"user"}`
 * verbatim (probe `entry` generation, every run), but the row's held signal is
 * the one `armWrapperSignal` (`install.ts:886`) substituted, and that signal
 * aborted with the lane's OWN marker `{reason:'inherited-signal', tool:…}`
 * (`kind=undefined`, probe `gen1`, three independent runs). The row's closed
 * cancelled law (`shellCancelled`, plane-effect-backends —
 * `cancelled = !timedOut && aborted && kind ∈ {user, parent}`) then correctly
 * REFUSES to mint `cancelled:true` for a cause that is not in the union: the
 * behaviour was right, the input was wrong. This suite makes the wrapper
 * forward the CAUSE it was given — the same law the host's own fuse applies
 * (`tools/lib` `abortFrom` forwards `source.reason` verbatim,
 * `@639ed01539 :3652-3656`, quoted in DIAGNOSIS §C.0-3).
 *
 * THE ASSEMBLY, in the shape the real install face shows it: one governed
 * Agent installed over the shared registry double; a `tools/execute` listener
 * mounted BEFORE the lane's install puts the live phase signal on `exec.signal`
 * (the identity-fusion situation DIAGNOSIS §② traced end to end — at the door,
 * `exec.signal` IS the phase signal); the lane's door then replaces it with its
 * wrapper signal; a row mounted AFTER the door is the fake never-exiting
 * `exited` leg the ticket prescribes: it settles ONLY on the abort of the
 * signal it actually holds, and reports that signal's reason. The test then
 * reads the reason at the one consumer that matters — the row's own
 * `shellCancelled` law, imported verbatim from the plane.
 *
 * THE BOUNDARY THIS TEST PINS BOTH WAYS (ticket 「边界一句话」 + 根裁决②):
 *  - relay is VERBATIM for every cause shape, so no leg may re-interpret one:
 *    user/parent mint `cancelled:true` through the untouched law; hook and
 *    disposed keep the death form; a timeout/deadline-shaped reason (the host
 *    timeout policy's DOMException) passes through with IDENTITY and mints
 *    nothing; a reason-less abort lands on a plain AbortError, never a marker
 *    object; a lane-OWNED abort (definition moved, `pending-calls.ts:134`) is
 *    NOT a relay and keeps its own recorded reason — that is the lane's own
 *    word, not an inherited one.
 *  - what this does NOT touch: the wire. A started body's settled value is
 *    replaced by the host's uniform death form at `tools/lib:3312` by host
 *    law (DIAGNOSIS §A Q1; registered as CORE_SEAM_BLOCKER, see
 *    `…/c1-swallow-diag/core-seam-blocker.md`). This suite never reaches that
 *    line and asserts nothing about it; the fix changes the CAUSE the row
 *    sees, not what the scheduler renders. Zero new permissions, zero PTC /
 *    approval-surface motion.
 *
 * @module test/a5r-cause-relay
 */
import { describe, expect, it } from 'vitest'
import { installScopedToolGuard, type ScopedGuardHandle } from '../tool-dispatch/index.js'
import { scopedRegistryDouble } from './a5p1r-scoped-registry-double.js'

type ShellCancelled = (input: { timedOut: boolean; aborted: boolean; reason: unknown }) => boolean
const plane = (await import(new URL('../../tools/process-family/src/index.mjs', import.meta.url).href)) as {
  shellCancelled: ShellCancelled
}
const cancelledLaw = plane.shellCancelled

interface RowView {
  /** The abort reason on the signal the ROW actually held when it settled. */
  readonly reason: unknown
  readonly aborted: boolean
  /** Identity witness: the row's held signal is the wrapper signal, not the phase signal. */
  readonly signalWasReplaced: boolean
}

interface RelayRun {
  readonly row: RowView
  readonly settled: Record<string, unknown>
}

/**
 * One governed Agent + one in-flight call whose Body never exits on its own.
 * `abortPhase` fires AFTER the door armed the wrapper and AFTER the row is
 * parked — the measured order at the install face (the forward listener is
 * mounted at arm time, DIAGNOSIS §C.0-3).
 */
async function runRelayScenario(input: {
  readonly cause: unknown
  /** Abort with NO reason argument (`abort()`), like a bare controller fire. */
  readonly bareAbort?: boolean
  /** Abort before the call even starts (the pre-aborted incoming shape). */
  readonly preAbort?: boolean
  /** Instead of a phase abort, move the Definition under the parked call. */
  readonly moveDefinitionInstead?: boolean
}): Promise<RelayRun> {
  const double = scopedRegistryDouble({ globalNames: ['team_bash'] })
  const globalSchemas = (double.ctx.tools.schemas as (scope?: unknown) => readonly { name: string }[])(undefined)
  const nativeNames = (globalSchemas ?? []).map((row) => row.name)

  const phase = new AbortController()
  let markBody!: () => void
  const bodyParked = new Promise<void>((resolve) => {
    markBody = resolve
  })

  // Mounted BEFORE the lane's install: at the door, `exec.signal` is the live
  // phase signal (the identity-fusion shape DIAGNOSIS §②: agent.js:131 →
  // tool-calls.js → tools/lib :3305 → the plugin's `tools/execute` listener).
  const phaseLeg = ((async (exec: { signal?: AbortSignal }, next: () => Promise<unknown>) => {
    exec.signal = phase.signal
    return await next()
  }) as unknown) as (...args: never[]) => unknown
  double.listeners.set('tools/execute', [phaseLeg])

  const install = installScopedToolGuard({
    agentCtx: double.ctxFor('agent-m1'),
    runtimeAgent: { id: 'agent-m1' },
    agentScopeKey: 's-agent-m1',
    trustedIdentities: ['agent-m1'],
    nativeNames,
    maskedNames: [],
  })
  if (!install.ok) throw new Error(`install refused: ${install.error.code} ${install.error.message}`)
  const handle: ScopedGuardHandle = install.value
  const published = handle.publish()
  if (!published.ok) throw new Error(`publish refused: ${published.error.message}`)

  // The row, mounted AFTER the lane's door: the fake `exited` leg that never
  // settles. It holds the signal the wrapper handed the Body and resolves
  // only when THAT signal aborts — reporting the reason it saw.
  let markRow!: (view: RowView) => void
  const rowSettled = new Promise<RowView>((resolve) => {
    markRow = resolve
  })
  const rowLeg = ((async (exec: { signal?: AbortSignal }) => {
    const held = exec.signal as AbortSignal
    const view = (): RowView => ({
      reason: held.reason,
      aborted: held.aborted === true,
      signalWasReplaced: held !== (phase.signal as unknown),
    })
    markBody()
    // The fake exited leg: NOTHING else ever settles this row. The waterfall
    // stays parked inside the lane's door (so the door's forward listener is
    // still mounted, exactly as at the install face) until the held signal
    // itself aborts.
    const settledRow = await new Promise<RowView>((resolve) => {
      if (held.aborted) {
        resolve(view())
        return
      }
      held.addEventListener('abort', () => resolve(view()), { once: true })
    })
    markRow(settledRow)
    return 'row:settled-on-abort'
  }) as unknown) as (...args: never[]) => unknown
  const list = double.listeners.get('tools/execute') ?? []
  list.push(rowLeg)
  double.listeners.set('tools/execute', list)

  if (input.preAbort === true) {
    if (input.bareAbort === true) phase.abort()
    else phase.abort(input.cause)
  }

  const settled = double.runCall({ callId: 'c-cause-1', name: 'team_bash', agentIdentity: 'agent-m1' })

  if (input.preAbort !== true) {
    await bodyParked
    if (input.moveDefinitionInstead === true) {
      // A legal re-registration while the call is parked — the lane-OWNED abort
      // (`pending-calls.ts:134`), not a relay: its reason word is the lane's
      // own and this round moves it zero.
      double.registerOwn('team_bash', 'MOVED.under.parked.call')
    } else if (input.bareAbort === true) {
      phase.abort()
    } else {
      phase.abort(input.cause)
    }
  }

  const row = await rowSettled
  return { row, settled: (await settled) as unknown as Record<string, unknown> }
}

describe('a5r cause relay — the install wrapper forwards the cause it was given', () => {
  it('R1 user arm (the measured red): an incoming abort with {kind:\'user\'} reaches the row as THAT object, and the row law mints cancelled:true (currently the wrapper replays its own marker → RED)', async () => {
    const cause = { kind: 'user' }
    const { row, settled } = await runRelayScenario({ cause })
    // The row held the wrapper signal, not the phase signal (sig-swap shape).
    expect(row.signalWasReplaced).toBe(true)
    expect(row.aborted).toBe(true)
    // VERBATIM relay: the host's cause object, identity-preserved.
    expect(row.reason).toBe(cause)
    // The consumer that was starved: the row's own closed law, untouched.
    expect(cancelledLaw({ timedOut: false, aborted: row.aborted, reason: row.reason })).toBe(true)
    expect(settled).toBeDefined()
  })

  it('R2 parent arm: {kind:\'parent\'} relays verbatim and mints cancelled:true (a parent tearing down its child call IS a cancel)', async () => {
    const cause = { kind: 'parent' }
    const { row } = await runRelayScenario({ cause })
    expect(row.reason).toBe(cause)
    expect(cancelledLaw({ timedOut: false, aborted: row.aborted, reason: row.reason })).toBe(true)
  })

  it('R3 hook arm: the relay is verbatim, the law still REFUSES — honoring the abort is not claiming a user cancel', async () => {
    const cause = { kind: 'hook', reason: 'a governance hook asked this call to stop' }
    const { row } = await runRelayScenario({ cause })
    expect(row.reason).toBe(cause)
    expect(row.aborted).toBe(true)
    expect(cancelledLaw({ timedOut: false, aborted: row.aborted, reason: row.reason })).toBe(false)
  })

  it('R4 disposed arm: verbatim relay, death form stands — a teardown never renders `bash · cancelled`', async () => {
    const cause = { kind: 'disposed' }
    const { row } = await runRelayScenario({ cause })
    expect(row.reason).toBe(cause)
    expect(row.aborted).toBe(true)
    expect(cancelledLaw({ timedOut: false, aborted: row.aborted, reason: row.reason })).toBe(false)
  })

  it('R5 timeout/deadline shape, zero motion: a DOMException cause (host timeout-policy shape) passes through with IDENTITY and mints no cancelled', async () => {
    const cause = new DOMException('deadline exceeded', 'TimeoutError')
    const { row } = await runRelayScenario({ cause })
    expect(row.reason).toBe(cause)
    expect(row.aborted).toBe(true)
    expect(cancelledLaw({ timedOut: false, aborted: row.aborted, reason: row.reason })).toBe(false)
  })

  it('R6 a reason-less incoming abort lands on a plain AbortError — never the old marker object, and mints nothing', async () => {
    const { row } = await runRelayScenario({ cause: undefined, bareAbort: true })
    expect(row.aborted).toBe(true)
    const reason = row.reason as { name?: string } | undefined
    expect(reason?.name).toBe('AbortError')
    expect(row.reason).not.toHaveProperty('reason', 'inherited-signal')
    expect(cancelledLaw({ timedOut: false, aborted: row.aborted, reason: row.reason })).toBe(false)
  })

  it('R7 pre-aborted incoming (the door sees an already-fired phase signal): the row is handed the cause at once', async () => {
    const cause = { kind: 'user' }
    const { row } = await runRelayScenario({ cause, preAbort: true })
    expect(row.aborted).toBe(true)
    expect(row.reason).toBe(cause)
    expect(cancelledLaw({ timedOut: false, aborted: row.aborted, reason: row.reason })).toBe(true)
  })

  it('R8 zero motion on the lane-OWNED word: a definition-move abort keeps its `definition-moved:` reason and mints no cancelled (the relay fix does not touch pending-calls.ts)', async () => {
    const { row } = await runRelayScenario({ cause: undefined, moveDefinitionInstead: true })
    expect(row.aborted).toBe(true)
    expect(String((row.reason as { reason?: string })?.reason ?? '')).toMatch(/^definition-moved: /)
    expect(cancelledLaw({ timedOut: false, aborted: row.aborted, reason: row.reason })).toBe(false)
  })

  it('R9 net-1 negative pin (根裁决②, the boundary this fix does NOT cross): with the cause relayed, a body aborted AFTER it started still settles on the host death form on the wire — `Error: tool call aborted`, never a cancelled word', async () => {
    // This leg reaches the registry's OWN replacement step — the double models
    // `dispatchToolBody`'s post-body `isAborted(signal) ? toolAbortedResult :
    // result` (`@639ed01539 :1583`; the install face of the same law is
    // `tools/lib:3312`, DIAGNOSIS §A Q1, the line the CORE_SEAM_BLOCKER is
    // about). The relay moves the CAUSE the row observes; it does not and may
    // not move what the scheduler renders after a started body.
    const double = scopedRegistryDouble({ globalNames: ['team_bash'] })
    const globalSchemas = (double.ctx.tools.schemas as (scope?: unknown) => readonly { name: string }[])(undefined)
    const nativeNames = (globalSchemas ?? []).map((row) => row.name)
    const phase = new AbortController()

    const phaseLeg = ((async (exec: { signal?: AbortSignal }, next: () => Promise<unknown>) => {
      exec.signal = phase.signal
      return await next()
    }) as unknown) as (...args: never[]) => unknown
    double.listeners.set('tools/execute', [phaseLeg])

    const install = installScopedToolGuard({
      agentCtx: double.ctxFor('agent-m1'),
      runtimeAgent: { id: 'agent-m1' },
      agentScopeKey: 's-agent-m1',
      trustedIdentities: ['agent-m1'],
      nativeNames,
      maskedNames: [],
    })
    if (!install.ok) throw new Error(`install refused: ${install.error.code} ${install.error.message}`)
    const published = install.value.publish()
    if (!published.ok) throw new Error(`publish refused: ${published.error.message}`)

    let heldByRow: AbortSignal | undefined
    // The row is the registry-resolved Body's observer: it stays in the chain
    // (calls `next()`) so the double reaches its real dispatch step, and reads
    // the signal it was handed AFTER the started body returned aborted.
    const rowLeg = ((async (exec: { signal?: AbortSignal }, next: () => Promise<unknown>) => {
      heldByRow = exec.signal as AbortSignal
      return await next()
    }) as unknown) as (...args: never[]) => unknown
    const list = double.listeners.get('tools/execute') ?? []
    list.push(rowLeg)
    double.listeners.set('tools/execute', list)

    const result = await double.runCall({
      callId: 'c-cause-wire',
      name: 'team_bash',
      agentIdentity: 'agent-m1',
      // The user cancel lands AFTER the Body started — the exact fork point
      // of DIAGNOSIS §Q2: from `def.execute` onward both faces are one chain.
      whileBodyRuns: () => {
        phase.abort({ kind: 'user' })
      },
    })

    // The row's classification channel: the cause relayed, the law would mint
    // cancelled:true for a row that renders it (the a5b3 row does).
    expect(heldByRow?.aborted === true).toBe(true)
    expect((heldByRow as unknown as AbortSignal).reason).toEqual({ kind: 'user' })
    expect(cancelledLaw({ timedOut: false, aborted: true, reason: (heldByRow as unknown as AbortSignal).reason })).toBe(true)
    // The wire stays the host's uniform death form (DIAGNOSIS §C.1 red wire,
    // verbatim): code ABORTED at error.info.code, text `Error: tool call
    // aborted`, and NO cancelled word anywhere. The relay did not leak a
    // cancelled fact through net-1 — that replacement is host law and this
    // round touches zero host bytes.
    expect(result.code).toBe('ABORTED')
    expect(result.bodyInvoked).toBe(true)
    expect(result.text).toBe('Error: tool call aborted')
    expect(JSON.stringify(result)).not.toMatch(/cancelled/i)
  })
})
