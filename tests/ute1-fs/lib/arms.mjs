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
          && binding.status === 'open'
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
        ok: receipt.status === 'disposed' && refused && untouched,
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
      const ok = first.changed === true && first.status === 'disposed'
        && second.changed === false && second.alreadyDisposed === true
        && third.changed === false && third.alreadyDisposed === true
        && binding.status === 'disposed'
        && second.reason === 'first'
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
          ok: firstReceipt.status === 'disposed' && oldLaneGone && newLaneLive && oldProviderDisposed
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
