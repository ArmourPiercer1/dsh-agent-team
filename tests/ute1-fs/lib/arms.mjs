/**
 * arms.mjs — the HOST-FREE behavioural arms of the native FS binding.
 *
 * These arms are written against the PRODUCT MODULE ONLY (the module is passed
 * in), so the same arms can be run against the shipped module and against a
 * deliberately mutated copy. That is what turns each one into a negative
 * control instead of a demo: a mutation transcript is only meaningful if the
 * arm that is supposed to catch a removed behaviour is the SAME arm that passes
 * on the shipped module.
 *
 * Every arm returns `{id, ok, detail}` and never throws: a thrown error is a
 * failed arm, reported with its message.
 *
 * @module tests/ute1-fs/lib/arms
 */
import { createFakeContext, createFakeHost } from './fake-host.mjs'

const INSIDE = '/world/inside'
const OUTSIDE = '/world/outside'
const SIDE = '/world/side'

/** Run `fn`, reporting whether it threw rather than propagating. */
async function attempt(fn) {
  try {
    const value = await fn()
    return { threw: false, value }
  } catch (error) {
    return { threw: true, error }
  }
}

/** Is `error` a typed refusal carrying `code` and naming `needle`? */
function refusedWith(error, code, needle) {
  if (error === undefined || error === null) return false
  const text = `${error.message ?? ''}`
  if (code !== undefined && error.code !== code) return false
  return needle === undefined || text.includes(needle)
}

/** A lane rooted at two sibling directories. */
function laneOf(read, write) {
  return { read, write }
}

/**
 * @typedef {object} Arm
 * @property {string} id
 * @property {string} title
 * @property {(mod: object) => Promise<{id: string, ok: boolean, detail: string}>} run
 */

/** @type {readonly Arm[]} */
export const ARMS = Object.freeze([
  {
    id: 'a1-write-inside',
    title: 'an in-lane create really reaches the base provider',
    async run(mod) {
      const host = createFakeHost()
      const ctx = createFakeContext()
      const facts = []
      const binding = await mod.mountNativeFsBinding({
        ctx, host, lane: laneOf([INSIDE], [INSIDE]), expectedGeneration: host.generation,
        id: 'arm-a1', cwd: '/world', record: (fact) => facts.push(fact),
      })
      try {
        await binding.provider.writeText(`${INSIDE}/created.txt`, 'hello\n')
        const landed = host.files.get(`${INSIDE}/created.txt`)
        const ok = landed === 'hello\n'
          && facts.some((fact) => fact.decision === 'allow' && fact.method === 'writeText')
          && binding.status === 'active'
        return { id: this.id, ok, detail: ok ? 'create landed and one allow fact was recorded' : `landed=${JSON.stringify(landed)} facts=${facts.length}` }
      } finally {
        await binding.dispose('arm-done')
      }
    },
  },
  {
    id: 'a2-lane-denial',
    title: 'the declared write lane still bites on the PRODUCT module',
    async run(mod) {
      const host = createFakeHost()
      const ctx = createFakeContext()
      const facts = []
      const binding = await mod.mountNativeFsBinding({
        ctx, host, lane: laneOf([INSIDE], [INSIDE]), expectedGeneration: host.generation,
        id: 'arm-a2', cwd: '/world', record: (fact) => facts.push(fact),
      })
      try {
        const result = await attempt(() => binding.provider.writeText(`${OUTSIDE}/escape.txt`, 'evil\n'))
        const refused = result.threw
          && result.error?.code === 'FS_PERMISSION_DENIED'
          && String(result.error?.message).includes('lane-write')
        const noEffect = !host.files.has(`${OUTSIDE}/escape.txt`)
        const deniedFact = facts.some((fact) => fact.decision === 'deny' && fact.refusal === 'lane-write' && fact.path === `${OUTSIDE}/escape.txt`)
        return {
          id: this.id,
          ok: refused && noEffect && deniedFact,
          detail: refused
            ? `refused code=FS_PERMISSION_DENIED effect=${noEffect ? 'absent' : 'PRESENT'} fact=${deniedFact}`
            : `call was ${result.threw ? `refused with ${result.error?.code}` : 'ALLOWED'} (expected a lane-write refusal)`,
        }
      } finally {
        await binding.dispose('arm-done')
      }
    },
  },
  {
    id: 'a3-use-after-dispose',
    title: 'a disposed scope refuses by NAME and never reaches the provider',
    async run(mod) {
      const host = createFakeHost({ files: new Map([[`${INSIDE}/existing.txt`, 'original\n']]) })
      const ctx = createFakeContext()
      const binding = await mod.mountNativeFsBinding({
        ctx, host, lane: laneOf([INSIDE], [INSIDE]), expectedGeneration: host.generation,
        id: 'arm-a3', cwd: '/world',
      })
      const receipt = await binding.dispose('arm-scope-ended')
      const result = await attempt(() => binding.provider.writeText(`${INSIDE}/existing.txt`, 'after-dispose\n'))
      const untouched = host.files.get(`${INSIDE}/existing.txt`) === 'original\n'
      const refused = result.threw && String(result.error?.message).includes('scope-disposed')
      return {
        id: this.id,
        ok: receipt.state === 'released' && refused && untouched,
        detail: refused
          ? `refused named=scope-disposed untouched=${untouched}`
          : `call was ${result.threw ? `refused as ${String(result.error?.message).slice(0, 60)}` : 'ALLOWED after disposal'}; bytes ${untouched ? 'unchanged' : 'CHANGED'}`,
      }
    },
  },
  {
    id: 'a4-double-dispose',
    title: 'disposal is monotonic: the second call is a named no-op',
    async run(mod) {
      const host = createFakeHost()
      const ctx = createFakeContext()
      const binding = await mod.mountNativeFsBinding({
        ctx, host, lane: laneOf([INSIDE], [INSIDE]), expectedGeneration: host.generation,
        id: 'arm-a4', cwd: '/world',
      })
      const first = await binding.dispose('first')
      const second = await binding.dispose('second')
      const third = await binding.dispose()
      const ok = first.changed === true && first.state === 'released'
        && first.releaseConfirmed === true && first.drained === true
        && second.changed === false && second.alreadyDisposed === true
        && third.changed === false && third.alreadyDisposed === true
        && binding.status === 'released'
        && second.state === first.state
        && second.reason === first.reason
        && second.refusalCode === 'scope-disposed'
      return {
        id: this.id,
        ok,
        detail: `first=${JSON.stringify(first)} second=${JSON.stringify(second)} status=${binding.status}`,
      }
    },
  },
  {
    id: 'a5-overlap-scopes',
    title: 'two overlapping scopes never leak authority into each other',
    async run(mod) {
      const sharedFiles = new Map()
      const host = createFakeHost({ files: sharedFiles })
      const ctxA = createFakeContext()
      const ctxB = createFakeContext()
      const factsA = []
      const factsB = []
      const a = await mod.mountNativeFsBinding({
        ctx: ctxA, host, lane: laneOf([INSIDE], [INSIDE]), expectedGeneration: host.generation,
        id: 'scope-a', cwd: '/world', record: (fact) => factsA.push(fact),
      })
      const b = await mod.mountNativeFsBinding({
        ctx: ctxB, host, lane: laneOf([SIDE], [SIDE]), expectedGeneration: host.generation,
        id: 'scope-b', cwd: '/world', record: (fact) => factsB.push(fact),
      })
      try {
        const aOnB = await attempt(() => a.provider.writeText(`${SIDE}/b-only.txt`, 'from-a\n'))
        const bOnA = await attempt(() => b.provider.writeText(`${INSIDE}/a-only.txt`, 'from-b\n'))
        await b.provider.writeText(`${SIDE}/b-own.txt`, 'own\n')
        const bOwn = sharedFiles.get(`${SIDE}/b-own.txt`) === 'own\n'
        const aRefused = aOnB.threw && String(aOnB.error?.message).includes('lane-write')
        const bRefused = bOnA.threw && String(bOnA.error?.message).includes('lane-write')
        const noCrossEffect = !sharedFiles.has(`${SIDE}/b-only.txt`) && !sharedFiles.has(`${INSIDE}/a-only.txt`)
        const ownFacts = factsA.every((fact) => fact.bindingId === 'scope-a')
          && factsB.every((fact) => fact.bindingId === 'scope-b')
          && factsA.some((fact) => fact.refusal === 'lane-write')
          && factsB.some((fact) => fact.refusal === 'lane-write')
        const ok = aRefused && bRefused && noCrossEffect && bOwn && ownFacts
        return {
          id: this.id,
          ok,
          detail: `a→B=${aRefused ? 'refused' : 'ALLOWED'} b→A=${bRefused ? 'refused' : 'ALLOWED'}`
            + ` cross-effect=${noCrossEffect ? 'absent' : 'PRESENT'} own-lane=${bOwn} facts-attributed=${ownFacts}`,
        }
      } finally {
        await a.dispose('arm-done')
        await b.dispose('arm-done')
      }
    },
  },
  {
    id: 'a6-provider-swap',
    title: 'replacing a scope’s provider does not retain the old lane',
    async run(mod) {
      const host = createFakeHost()
      const ctx = createFakeContext()
      const first = await mod.mountNativeFsBinding({
        ctx, host, lane: laneOf([INSIDE], [INSIDE]), expectedGeneration: host.generation,
        id: 'swap-1', cwd: '/world',
      })
      await first.provider.writeText(`${INSIDE}/one.txt`, 'one\n')
      const firstReceipt = await first.dispose('provider-replaced')
      const second = await mod.mountNativeFsBinding({
        ctx, host, lane: laneOf([SIDE], [SIDE]), expectedGeneration: host.generation,
        id: 'swap-2', cwd: '/world',
      })
      try {
        const oldLaneThroughNew = await attempt(() => second.provider.writeText(`${INSIDE}/two.txt`, 'two\n'))
        const newLaneThroughNew = await attempt(() => second.provider.writeText(`${SIDE}/two.txt`, 'two\n'))
        const oldProvider = await attempt(() => first.provider.writeText(`${INSIDE}/three.txt`, 'three\n'))
        const oldLaneGone = oldLaneThroughNew.threw
          && String(oldLaneThroughNew.error?.message).includes('lane-write')
          && !host.files.has(`${INSIDE}/two.txt`)
        const newLaneLive = !newLaneThroughNew.threw && host.files.get(`${SIDE}/two.txt`) === 'two\n'
        const oldProviderDisposed = oldProvider.threw
          && String(oldProvider.error?.message).includes('scope-disposed')
          && !host.files.has(`${INSIDE}/three.txt`)
        return {
          id: this.id,
          ok: firstReceipt.state === 'released' && oldLaneGone && newLaneLive && oldProviderDisposed
            && second.id === 'swap-2' && second.lane.read[0] === SIDE,
          detail: `old-lane-through-new=${oldLaneGone ? 'refused' : 'ALLOWED'} new-lane=${newLaneLive ? 'live' : 'DENIED'}`
            + ` old-provider=${oldProviderDisposed ? 'scope-disposed' : 'still serving or unnamed'}`,
        }
      } finally {
        await second.dispose('arm-done')
      }
    },
  },
  {
    id: 'a7-generation-mismatch',
    title: 'a different host generation is refused by NAME, before any scope exists',
    async run(mod) {
      const host = createFakeHost({ generation: '0.2.0-rc.2' })
      const ctx = createFakeContext()
      const result = await attempt(() => mod.mountNativeFsBinding({
        ctx, host, lane: laneOf([INSIDE], [INSIDE]), expectedGeneration: '0.2.2-rc.5',
        id: 'arm-a7', cwd: '/world',
      }))
      const typed = result.threw && result.error instanceof mod.NativeFsBindingError
      const named = typed && result.error.code === 'FS_BINDING_HOST_GENERATION_MISMATCH'
      const namesBoth = named
        && String(result.error.message).includes('0.2.2-rc.5')
        && String(result.error.message).includes('0.2.0-rc.2')
      const noScope = ctx.pluginCalls.length === 0
      const noLegacyFallback = !/deepseek-harness-test-use/.test(String(result.error?.message ?? ''))
      return {
        id: this.id,
        ok: named && namesBoth && noScope && noLegacyFallback,
        detail: named
          ? `refused code=${result.error.code} both-generations=${namesBoth} plugin-calls=${ctx.pluginCalls.length}`
          : `mount was ${result.threw ? `refused as ${result.error?.code ?? result.error?.name}` : 'ALLOWED'}`,
      }
    },
  },
  {
    id: 'a8-drain-waits',
    title: 'dispose() waits for an admitted operation, and no effect lands after the receipt',
    async run(mod) {
      let releasePark
      const parkGate = new Promise((resolve) => { releasePark = resolve })
      let parkedResolve
      const parked = new Promise((resolve) => { parkedResolve = resolve })
      const host = createFakeHost({
        park: async (method) => {
          if (method !== 'stat') return
          parkedResolve()
          await parkGate
        },
      })
      const ctx = createFakeContext()
      const binding = await mod.mountNativeFsBinding({
        ctx, host, lane: laneOf([INSIDE], [INSIDE]), expectedGeneration: host.generation,
        id: 'arm-a8', cwd: '/world', drainTimeoutMs: 2_000,
      })
      const pending = binding.provider.writeText(`${INSIDE}/a8.txt`, 'drained\n').catch((error) => error)
      await parked
      let disposeReturned = false
      const disposing = binding.dispose('arm-a8').then((receipt) => {
        disposeReturned = true
        return receipt
      })
      await new Promise((resolve) => { setTimeout(resolve, 30) })
      const waited = disposeReturned === false
      releasePark()
      const receipt = await disposing
      const result = await pending
      const bytesAtReceipt = host.files.get(`${INSIDE}/a8.txt`)
      const entriesAtReceipt = [...host.files.keys()].sort().join('|')
      await new Promise((resolve) => { setTimeout(resolve, 40) })
      const bytesAfter = host.files.get(`${INSIDE}/a8.txt`)
      const entriesAfter = [...host.files.keys()].sort().join('|')
      const ok = waited
        && receipt.state === 'released'
        && receipt.drained === true
        && receipt.releaseConfirmed === true
        && receipt.inFlightAtDispose === 1
        && !(result instanceof Error)
        && bytesAtReceipt === 'drained\n'
        && bytesAfter === bytesAtReceipt
        && entriesAfter === entriesAtReceipt
      return {
        id: this.id,
        ok,
        detail: `waited=${waited} state=${receipt.state} drained=${receipt.drained} confirmed=${receipt.releaseConfirmed}`
          + ` inFlightAtDispose=${receipt.inFlightAtDispose} bytes-after-receipt=${bytesAfter === bytesAtReceipt ? 'unchanged' : 'CHANGED'} files-after=${entriesAfter === entriesAtReceipt ? 'unchanged' : 'CHANGED'}`,
      }
    },
  },
  {
    id: 'a9-drain-timeout',
    title: 'a drain timeout is termination-unconfirmed, never released, and does not flip later',
    async run(mod) {
      let releasePark
      const parkGate = new Promise((resolve) => { releasePark = resolve })
      let parkedResolve
      const parked = new Promise((resolve) => { parkedResolve = resolve })
      const host = createFakeHost({
        park: async (method) => {
          if (method !== 'stat') return
          parkedResolve()
          await parkGate
        },
      })
      const ctx = createFakeContext()
      const binding = await mod.mountNativeFsBinding({
        ctx, host, lane: laneOf([INSIDE], [INSIDE]), expectedGeneration: host.generation,
        id: 'arm-a9', cwd: '/world', drainTimeoutMs: 25,
      })
      const pending = binding.provider.writeText(`${INSIDE}/a9.txt`, 'late\n').catch((error) => error)
      await parked
      const receipt = await binding.dispose('arm-a9')
      const terminalAtReceipt = binding.status
      releasePark()
      await pending
      await new Promise((resolve) => { setTimeout(resolve, 40) })
      const later = await binding.dispose('again')
      const ok = receipt.state === 'termination-unconfirmed'
        && receipt.drained === false
        && receipt.releaseConfirmed === false
        && receipt.newOperationsRefused === true
        && receipt.refusalCode === 'scope-termination-unconfirmed'
        && /drain-timeout/.test(receipt.reason)
        && terminalAtReceipt === 'termination-unconfirmed'
        && later.state === 'termination-unconfirmed'
        && binding.status === 'termination-unconfirmed'
        && ctx.disposeCalls === 0
      return {
        id: this.id,
        ok,
        detail: `state=${receipt.state} drained=${receipt.drained} confirmed=${receipt.releaseConfirmed}`
          + ` later=${later.state} status=${binding.status} release-calls=${ctx.disposeCalls}`,
      }
    },
  },
  {
    id: 'a10-refusal-codes',
    title: 'draining and released refusals are DISTINCT and create no fact or effect',
    async run(mod) {
      let releasePark
      const parkGate = new Promise((resolve) => { releasePark = resolve })
      let parkedResolve
      const parked = new Promise((resolve) => { parkedResolve = resolve })
      const host = createFakeHost({
        park: async (method) => {
          if (method !== 'stat') return
          parkedResolve()
          await parkGate
        },
      })
      const ctx = createFakeContext()
      const facts = []
      const binding = await mod.mountNativeFsBinding({
        ctx, host, lane: laneOf([INSIDE], [INSIDE]), expectedGeneration: host.generation,
        id: 'arm-a10', cwd: '/world', drainTimeoutMs: 2_000, record: (fact) => facts.push(fact),
      })
      const pending = binding.provider.writeText(`${INSIDE}/a10.txt`, 'first\n').catch((error) => error)
      await parked
      const disposing = binding.dispose('arm-a10')
      await new Promise((resolve) => { setTimeout(resolve, 10) })
      // Race the during-drain call against a bound so a mutant that ADMITS it
      // (instead of refusing) reports red here rather than deadlocking on the
      // still-parked first operation.
      const duringPromise = attempt(() => binding.provider.writeText(`${INSIDE}/during.txt`, 'no\n'))
      const duringDrain = await Promise.race([
        duringPromise,
        new Promise((resolve) => { setTimeout(() => resolve({ threw: false, value: 'admitted' }), 150) }),
      ])
      const refusedDuring = duringDrain.threw
        && duringDrain.error?.code === 'FS_PERMISSION_DENIED'
        && /scope-draining/.test(String(duringDrain.error?.message))
      releasePark()
      await disposing
      await pending
      await duringPromise
      const factsBefore = facts.length
      const afterRelease = await attempt(() => binding.provider.writeText(`${INSIDE}/after.txt`, 'no\n'))
      const refusedAfter = afterRelease.threw
        && afterRelease.error?.code === 'FS_PERMISSION_DENIED'
        && /scope-disposed/.test(String(afterRelease.error?.message))
        && !/scope-draining/.test(String(afterRelease.error?.message))
      const noEffects = !host.files.has(`${INSIDE}/during.txt`) && !host.files.has(`${INSIDE}/after.txt`)
      const noNewFacts = facts.length === factsBefore
      return {
        id: this.id,
        ok: refusedDuring && refusedAfter && noEffects && noNewFacts,
        detail: `draining=${refusedDuring ? 'scope-draining' : refusedDuring ? 'wrong' : 'ALLOWED'}`
          + ` released=${refusedAfter ? 'scope-disposed' : 'wrong'} effects=${noEffects ? 'absent' : 'PRESENT'} facts+${facts.length - factsBefore}`,
      }
    },
  },
  {
    id: 'a11-record-is-diagnostic',
    title: 'a throwing record callback changes neither the outcome nor the lane decision',
    async run(mod) {
      const host = createFakeHost()
      const ctx = createFakeContext()
      let attempts = 0
      const delivered = []
      const binding = await mod.mountNativeFsBinding({
        ctx, host, lane: laneOf([INSIDE], [INSIDE]), expectedGeneration: host.generation,
        id: 'arm-a11', cwd: '/world',
        // The recorder throws on its FIRST delivery and would collect later ones.
        // "Zero facts" here is measured at the recorder: a diagnostic sink that
        // throws delivers nothing, is never retried, and never changes the
        // operation. The binding's own fact buffer is deliberately INDEPENDENT
        // of the sink, which is what makes the sink non-load-bearing for S1.
        record: (fact) => {
          attempts += 1
          if (attempts === 1) throw new Error('recorder exploded')
          delivered.push(fact)
        },
      })
      try {
        const result = await attempt(() => binding.provider.writeText(`${INSIDE}/a11.txt`, 'ok\n'))
        const landed = host.files.get(`${INSIDE}/a11.txt`) === 'ok\n'
        const ok = !result.threw && landed && attempts === 1 && delivered.length === 0 && binding.facts.length === 1
        return {
          id: this.id,
          ok,
          detail: `outcome=${result.threw ? 'THREW' : 'ok'} landed=${landed} recorder-attempts=${attempts}`
            + ` recorder-delivered=${delivered.length} binding-facts=${binding.facts.length}`,
        }
      } finally {
        await binding.dispose('arm-done')
      }
    },
  },
  {
    id: 'a12-release-must-be-confirmed',
    title: 'a release step that throws yields termination-unconfirmed, not a false "released"',
    async run(mod) {
      const host = createFakeHost()
      const ctx = createFakeContext({ failDispose: true })
      const binding = await mod.mountNativeFsBinding({
        ctx, host, lane: laneOf([INSIDE], [INSIDE]), expectedGeneration: host.generation,
        id: 'arm-a12', cwd: '/world', drainTimeoutMs: 2_000,
      })
      const receipt = await binding.dispose('arm-a12')
      const ok = receipt.state === 'termination-unconfirmed'
        && receipt.drained === true
        && receipt.releaseConfirmed === false
        && receipt.refusalCode === 'scope-termination-unconfirmed'
        && /release-failed/.test(receipt.reason)
        && receipt.releaseErrors.length > 0
        && binding.status === 'termination-unconfirmed'
        && ctx.disposeFailures > 0
      return {
        id: this.id,
        ok,
        detail: `state=${receipt.state} drained=${receipt.drained} confirmed=${receipt.releaseConfirmed}`
          + ` errors=${receipt.releaseErrors.length} status=${binding.status}`,
      }
    },
  },
])

/**
 * Run every arm against one module.
 * @param {object} mod - the product module (or a mutated copy).
 * @returns {Promise<Array<{id: string, ok: boolean, detail: string}>>}
 */
export async function runAllArms(mod) {
  const results = []
  for (const arm of ARMS) {
    const binding = arm.run.bind(arm)
    try {
      results.push(await binding(mod))
    } catch (error) {
      results.push({ id: arm.id, ok: false, detail: `arm threw: ${error?.message ?? String(error)}` })
    }
  }
  return results
}
