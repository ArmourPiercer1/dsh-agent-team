/**
 * live-read-driver.mjs — the LIVE read driver `tests/world-factory/suites/150-a5sf-read.mjs`
 * resolves through `A5SF_READ_DRIVER`. Before this module existed the suite
 * answered `LIVE_SEAM_UNAVAILABLE`: nothing in the tree mounted the compiled
 * ceiling's confined Provider outside a booted Host, so the suite could only
 * measure with its `node:fs` DRY driver.
 *
 * WHAT IT IS, PRECISELY. It is NOT a Host driver and it does not boot anything.
 * It mounts the SAME real seam a Host mounts — `packages/runtime/src/plugin/live/
 * a5sf-realm-row.mjs#mountMemberA5sfRealm` over a real Cordis `Context`, the
 * pinned baseline's `LocalFileSystem`, its `fs-observation-policy`, and the real
 * `@deepseek-ai/dsh-tool-fs` native module — and then dispatches the `read`
 * tool through the REAL tool registry, so the bytes cross the same confined
 * provider the product uses. That makes it a LIVE SEAM observation
 * (`native: true`), not a Host observation. It spends no Host start, touches no
 * port, and writes no ledger row.
 *
 * THE INTERFACE. `createReadDriver({ repoRoot, evidenceDir })` returns
 * `{ native, kind, calls, install({ identity, effective }), read({ locator, window }) }`.
 * `install` is idempotent per Member identity: it maps the Member's COMPILED
 * effective policy onto the realm's own lane inputs (the compiler is the
 * product's; this module never re-intersects a lane). `read` performs one
 * native read through that Member's confined provider and returns
 * `{ bytes, text, windowed }`; a refusal is thrown as a typed error carrying the
 * product's message, which is what the suite's oracle reads.
 *
 * WHAT IT CANNOT ANSWER. It cannot answer anything about the hosted route
 * (cancel, archive, teardown, session lifecycle) — those need a Host. And it
 * cannot answer `read_image` composition questions: GAP-FS-CONTRACT-1 pins that
 * a binding realm's isolated ctx does not settle the native module's deferred
 * `fs` inject, which is why this driver mounts the MEMBER realm (composition
 * `route-c`) and reads through the member's confined provider.
 *
 * @module dev/agent-workflow/evidence/a5sf-fs-devlive/driver/live-read-driver
 */
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'

export const LIVE_READ_DRIVER_SCHEMA = 'a5sf-live-read-driver/1'

/** The realm lane inputs are absolute roots; an empty lane would mount nothing. */
function laneRootsOf(effective) {
  const readAllow = Array.isArray(effective?.read?.allow) ? effective.read.allow.filter((p) => typeof p === 'string' && p !== '') : []
  const writeAllow = Array.isArray(effective?.write?.allow) ? effective.write.allow.filter((p) => typeof p === 'string' && p !== '') : []
  if (readAllow.length === 0) throw new Error('LIVE_READ_DRIVER: the compiled effective policy has no read allow root; nothing to mount')
  return { read: readAllow, write: writeAllow.length === 0 ? readAllow : writeAllow }
}

export function createReadDriver({ repoRoot, evidenceDir = null } = {}) {
  if (typeof repoRoot !== 'string' || repoRoot === '') throw new Error('LIVE_READ_DRIVER: repoRoot is required')
  const worlds = new Map()
  const calls = []
  let seamsPromise = null
  let worldFactoryPromise = null

  const seams = async () => {
    if (seamsPromise === null) {
      seamsPromise = import(pathToFileURL(join(repoRoot, 'tests', 'world-factory', 'lib', 'a5sf-fs-contract-world.mjs')).href)
    }
    return seamsPromise
  }
  const worldFactory = async () => {
    if (worldFactoryPromise === null) {
      worldFactoryPromise = (await seams()).makeFsContractWorld
    }
    return worldFactoryPromise
  }

  const driver = {
    schema: LIVE_READ_DRIVER_SCHEMA,
    native: true,
    kind: 'a5sf-member-realm-native-read',
    /** One entry per native read: what the suite's `providerConsulted` reads. */
    calls,
    /**
     * Mount (once) the confined provider for ONE Member and return a reader.
     * The compiled `effective` is the product compiler's output; it is mapped
     * to the realm's lane inputs, never re-intersected here.
     */
    async install({ identity, effective } = {}) {
      const memberInstanceId = typeof identity?.memberInstanceId === 'string' ? identity.memberInstanceId : null
      if (memberInstanceId === null) throw new Error('LIVE_READ_DRIVER: install needs identity.memberInstanceId')
      if (worlds.has(memberInstanceId)) return driver
      const makeWorld = await worldFactory()
      const laneRoots = laneRootsOf(effective)
      const world = await makeWorld({
        repoRoot,
        label: `suite-read-${memberInstanceId.slice(-12)}`,
        composition: 'route-c',
        laneRoots,
      })
      worlds.set(memberInstanceId, { world, laneRoots })
      return driver
    },
    /**
     * One native read through the Member's confined Provider. Returns the bytes
     * the product returned, not a re-read of the file.
     */
    async read({ locator, window } = {}) {
      if (typeof locator !== 'string' || locator === '') throw new Error('LIVE_READ_DRIVER: read needs a locator')
      const mounted = worlds.size === 1
        ? [...worlds.values()][0]
        : [...worlds.values()].find(({ laneRoots }) => laneRoots.read.some((root) => locator.startsWith(root)))
      if (mounted === undefined) throw new Error(`LIVE_READ_DRIVER: no mounted Member realm covers ${JSON.stringify(locator)}; call install() first`)
      const provider = mounted.world.provider
      const before = { ...mounted.world.calls() }
      const signal = new AbortController().signal
      let text
      let bytes
      try {
        // THE PROVIDER'S OWN BYTE-WINDOW SEAM. The pinned baseline exposes
        // `readByteRange(target, {offset, length})` — a true byte window — so a
        // `window` request is served by the SAME confined provider, not by a
        // node:fs slice. A whole-file read uses `readText` verbatim (no tool
        // line-rendering, so `bytes`/`text` are the file's own).
        const target = await provider.resolve(locator, { signal })
        if (window === undefined) {
          text = await provider.readText(target, signal)
          bytes = Buffer.byteLength(text, 'utf8')
        } else {
          const slice = await provider.readByteRange(target, { offset: window.offset, length: window.limit }, signal)
          bytes = slice.length
          text = Buffer.from(slice).toString('utf8')
        }
      } catch (error) {
        const after = mounted.world.calls()
        const served = Object.fromEntries(Object.keys(after).map((key) => [key, after[key] - (before[key] ?? 0)]))
        calls.push({ locator, window: window ?? null, isError: true, served })
        const wrapped = new Error(String(error?.message ?? error))
        wrapped.code = error?.code ?? 'LIVE_READ_REFUSED'
        wrapped.productMessage = String(error?.message ?? error)
        throw wrapped
      }
      const after = mounted.world.calls()
      const served = Object.fromEntries(Object.keys(after).map((key) => [key, after[key] - (before[key] ?? 0)]))
      calls.push({ locator, window: window ?? null, isError: false, served })
      return {
        bytes,
        text,
        windowed: window !== undefined,
        served,
        /** The guard facts the realm emitted for this call (evidence, not a verdict). */
        facts: mounted.world.facts().filter((fact) => String(fact?.locator ?? fact?.path ?? '').startsWith(locator)),
      }
    },
    /** Release every mounted realm and its temp root. */
    async dispose() {
      for (const { world } of worlds.values()) await world.dispose().catch(() => undefined)
      worlds.clear()
    },
  }
  return driver
}

export default createReadDriver
