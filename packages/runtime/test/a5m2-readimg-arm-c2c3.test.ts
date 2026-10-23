/**
 * a5m2-readimg-arm-c2c3 — M2-READIMG-01 lane-provable boundaries of the
 * GOVERNED B-IMAGE pre-takeover (`governed-families/image.mjs` +
 * `governed-families/image-attachment.mjs`) over the REAL pristine pin639
 * attachment store (the `attachment-local` public class via absolute-path
 * artifact-plane import — the a2-canonical/a5m2-12-leg mechanism; ZERO bytes
 * written into the host tree). The read port is the injected FS-PROC stand-in
 * (spy counters + maxBytes law); in production CENTER passes the assembly's
 * controlled-fs read slice — the SAME port shape (disclosed, Host leg).
 *
 * THE CONTRAST THIS FILE OWES THE MATRIX (row 7, the measured primary gap):
 * the host NATIVE face reads `../../outside` targets SUCCESSFULLY because the
 * read rides `ctx.fs.readBytes` and LocalFileSystem carries no root
 * (fs-sandbox fences writes only) — leg "pre-fix repro" REPRODUCES that green
 * on the untouched host face, then the SAME absolute target refuses on the
 * governed arm with `P_IMAGE_CLASSIFY_TARGET_OUTSIDE_GOVERNED_ROOT` and ZERO
 * readPort calls. Post-takeover, the escape is refused by the governor itself,
 * before any filesystem call — no delegation to the mounted backend.
 *
 * HOST LEGS (NOT_VERIFIED here, asserted nowhere):
 *  - S(session, attach-vision, write): the durable SESSION-LOG ride of the
 *    result content blocks and the render face under the real Host dispatch;
 *  - the durable cross-restart attachment namespace ledger (this lane proves
 *    the in-life mint/reference namespace binding; persistence is Host-side);
 *  - the placement masking of the native spelling by this row under the real
 *    Guard/Control/PA chain (CENTER's mount round + Host dispatch leg);
 *  - the production readPort = the assembly's controlled-fs read slice.
 *
 * Worlds: tests/homes/m2-readimg-arm-<UTC-stamp>/ (TEST_METHODS §7, deleted in
 * afterAll). Synthetic self-generated images only; no user images anywhere.
 * Fail-closed: a missing/unbuilt pristine host tree THROWS, never a skip.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-readimg-arm-c2c3
 */
import { describe, expect, it, afterAll } from 'vitest'
import { existsSync, mkdirSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readFile as fsReadFile, stat as fsStat } from 'node:fs/promises'
import { findTestRepoRoot, testUseTree, homeRoot } from '../../../tests/paths.mjs'
import { createGovernedReadImageArm, A5_IMAGE_TYPED_CODES } from '../src/plugin/live/governed-families/image.mjs'
import { createImageAttachmentAdapter, A5_IMAGE_ATTACHMENT_CODES } from '../src/plugin/live/governed-families/image-attachment.mjs'
import type { ImageAttachmentStorePort } from '../src/plugin/live/governed-families/image-attachment.d.mts'
import type { GovernedReadImageArmHandle } from '../src/plugin/live/governed-families/image.d.mts'

/** Minimal structural face of the prebuilt host objects this fixture touches. */
interface LooseFiber { dispose?: () => Promise<void> }
interface LooseCtx {
  plugin: (p: unknown, cfg?: Record<string, unknown>) => Promise<LooseFiber>
  get: (name: string) => Record<string, unknown> | undefined
  tools: { execute: (input: Record<string, unknown>) => Promise<{ isError?: boolean; content?: { type?: unknown; text?: unknown }[] }> }
  llm: { registerAdapter: (providers: readonly string[], adapter: object) => unknown }
  dispose?: () => Promise<void>
}
interface ReadPortHandle {
  port: {
    stat: (path: string, opts: { signal?: AbortSignal }) => Promise<{ size: number; isFile: boolean }>
    readFile: (path: string, opts: { maxBytes?: number; signal?: AbortSignal }) => Promise<Uint8Array>
  }
  counters: { stat: number; readFile: number }
}

const REPO = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO === null) throw new Error('m2-readimg-arm: no repo root carrying tests/deepseek-harness-test-use — failing closed')
const HOST = testUseTree(REPO)
function hostLib(rel: string): string {
  const abs = join(HOST, 'packages', rel, 'lib/index.js')
  if (!existsSync(abs)) throw new Error(`m2-readimg-arm: pristine host lib absent (${abs}); failing closed`)
  return pathToFileURL(abs).href
}
const CORDIS_LIB = join(HOST, 'vendor/cordis/lib/index.js')
if (!existsSync(CORDIS_LIB)) throw new Error(`m2-readimg-arm: vendored cordis lib absent (${CORDIS_LIB}); failing closed`)

const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64')
const PNG_3X3 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAIAAADZSiLoAAAAEElEQVR4nGP4z8AAQQxYWACPjgj4kWPEuQAAAABJRU5ErkJggg==', 'base64')
const SENTINEL = 'M2-READIMG-ARM-SENTINEL-9be2c4'

const STAMP = new Date().toISOString().replace(/[:.]/g, '-')
const WORLD_ROOT = join(homeRoot(REPO), `m2-readimg-arm-${STAMP}`)
afterAll(() => { rmSync(WORLD_ROOT, { recursive: true, force: true }) })

let worldSeq = 0
function worldDir(label: string): string {
  const dir = join(WORLD_ROOT, `${String(++worldSeq)}-${label}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

function countObjects(storeRoot: string): number {
  const objectsDir = join(storeRoot, 'objects')
  if (!existsSync(objectsDir)) return 0
  let n = 0
  for (const shard of readdirSync(objectsDir, { withFileTypes: true })) {
    if (shard.isDirectory()) n += readdirSync(join(objectsDir, shard.name)).length
  }
  return n
}

/** The injected FS-PROC stand-in: counters are the zero-effect witnesses. */
function makeReadPort(opts: { hangUntilAbort?: boolean } = {}): ReadPortHandle {
  const counters = { stat: 0, readFile: 0 }
  const port: ReadPortHandle['port'] = {
    async stat(path, { signal }) {
      counters.stat += 1
      if (signal?.aborted === true) throw new Error('aborted')
      const st = await fsStat(path)
      return { size: st.size, isFile: st.isFile() }
    },
    async readFile(path, { maxBytes, signal }) {
      counters.readFile += 1
      if (opts.hangUntilAbort === true) {
        // deterministic mid-flight window: the read is live until the test aborts
        // (the listener must REJECT — throwing inside an EventTarget callback is
        // an uncaught event error, not a rejection: measured first-failure fact,
        // the leg hung to the 5s timeout).
        await new Promise<void>((resolve, reject) => {
          const onAbort = (): void => {
            const e = new Error('aborted during the content read')
            e.name = 'AbortError'
            reject(e)
          }
          if (signal?.aborted === true) onAbort()
          signal?.addEventListener('abort', onAbort, { once: true })
        })
      }
      if (signal?.aborted === true) throw new Error('aborted')
      const buf = await fsReadFile(path)
      if (maxBytes !== undefined && buf.byteLength > maxBytes) {
        throw new Error(`FS_TOO_LARGE: ${String(buf.byteLength)} bytes exceed the ${String(maxBytes)}-byte read cap`)
      }
      return buf
    },
  }
  return { port, counters }
}

function asStorePort(svc: Record<string, unknown> | undefined): ImageAttachmentStorePort {
  if (svc === undefined || typeof svc.saveImage !== 'function' || typeof svc.readImage !== 'function' || typeof svc.imageLimits !== 'object') {
    throw new Error('m2-readimg-arm: the real attachment service did not mount — failing closed')
  }
  // BIND the receivers: the mounted service's methods lean on their instance
  // (this.compression etc.) — a bare method extraction loses it (measured
  // first-failure fact: "Cannot read properties of undefined (reading 'run')").
  return {
    saveImage: (svc.saveImage as ImageAttachmentStorePort['saveImage']).bind(svc),
    readImage: (svc.readImage as ImageAttachmentStorePort['readImage']).bind(svc),
    imageLimits: svc.imageLimits as ImageAttachmentStorePort['imageLimits'],
  }
}

interface ArmWorld {
  govRoot: string
  outsideDir: string
  arm: GovernedReadImageArmHandle
  adapter: ReturnType<typeof createImageAttachmentAdapter>
  counters: ReadPortHandle['counters']
  storeRoot: string
  objects: () => number
  dispose: () => Promise<void>
}

const TRUSTED_CTX = { agentIdentity: 'agent-1', sessionIncarnation: 'agent-1' }
const EXEC = (signal?: AbortSignal): Record<string, unknown> => ({ agent: { identity: 'agent-1' }, ...(signal === undefined ? {} : { signal }) })

async function armWorld(storeConfig: Record<string, unknown> = {}, portOpts: { hangUntilAbort?: boolean } = {}): Promise<ArmWorld> {
  const dir = worldDir('arm')
  const govRoot = join(dir, 'gov')
  const outsideDir = join(dir, 'outside')
  mkdirSync(govRoot, { recursive: true })
  mkdirSync(outsideDir, { recursive: true })
  const cordisMod = await import(pathToFileURL(CORDIS_LIB).href)
  const attachmentLocalMod = await import(hostLib('attachment/attachment-local'))
  const ctx: LooseCtx = new cordisMod.Context()
  const storeFiber = await ctx.plugin(attachmentLocalMod.default, { dshHome: join(dir, 'home'), ...storeConfig })
  const storeSvc = ctx.get('attachments')
  const adapter = createImageAttachmentAdapter({ store: asStorePort(storeSvc) })
  const read = makeReadPort(portOpts)
  const arm = createGovernedReadImageArm({
    definitionIdentity: 'defn-pin639-read_image@fixture',
    providerId: 'visual',
    realmId: 'realm-fixture',
    namespaceRoot: govRoot,
    readPort: read.port,
    attachments: adapter,
    trustedIdentities: ['agent-1'],
  })
  const storeRoot = typeof storeSvc?.root === 'string' ? storeSvc.root : ''
  if (storeRoot.length === 0) throw new Error('m2-readimg-arm: store root missing — failing closed')
  return {
    govRoot,
    outsideDir,
    arm,
    adapter,
    counters: read.counters,
    storeRoot,
    objects: () => countObjects(storeRoot),
    dispose: async () => { await storeFiber.dispose?.(); await ctx.dispose?.() },
  }
}

/** The untouched NATIVE face (full base-bundle registration) for the pre-fix repro. */
interface NativeWorld { readAbs: (absPath: string) => Promise<{ isError: boolean; text: string }>; dispose: () => Promise<void> }
async function nativeWorld(cwd: string): Promise<NativeWorld> {
  const cordisMod = await import(pathToFileURL(CORDIS_LIB).href)
  const toolsMod = await import(hostLib('core/tools'))
  const llmMod = await import(hostLib('llm/llm'))
  const spMod = await import(hostLib('core/system-prompt'))
  const fsLocalMod = await import(hostLib('fs/fs-local'))
  const fsPolicyMod = await import(hostLib('fs/fs-observation-policy'))
  const attachmentLocalMod = await import(hostLib('attachment/attachment-local'))
  const toolFsMod = await import(hostLib('fs/tool-fs'))
  const ctx: LooseCtx = new cordisMod.Context()
  await ctx.plugin(spMod.default)
  await ctx.plugin(toolsMod.default, { mode: 'native' })
  await ctx.plugin(fsLocalMod.default, { cwd })
  await ctx.plugin(fsPolicyMod)
  await ctx.plugin(attachmentLocalMod.default, { dshHome: join(cwd, 'home') })
  await ctx.plugin(llmMod.default)
  class CatalogAdapter extends llmMod.LlmAdapter {
    listModels(_provider: string): readonly Record<string, unknown>[] {
      return [{ provider: 'visual', id: 'vision-model', name: 'Vision', inputModalities: ['text', 'image'] }]
    }
    resolveModel(provider: string, model: string): Promise<Record<string, unknown>> {
      return Promise.resolve({ provider, id: model, name: model, inputModalities: ['text', 'image'] })
    }
    stream(): never { throw new Error('m2-readimg-arm fixture never streams') }
  }
  ctx.llm.registerAdapter(['visual'], new CatalogAdapter())
  await ctx.plugin(toolFsMod)
  const agent = {
    options: {},
    session: {
      header: { cwd },
      requestHeader: () => ({ config: { provider: 'visual', model: 'vision-model' } }),
      deriveMessages: () => [],
      append: () => undefined,
    },
  }
  return {
    readAbs: async (absPath) => {
      const r = await ctx.tools.execute({
        signal: new AbortController().signal,
        callId: llmMod.ToolCallId('arm-native-1'),
        name: 'read_image',
        arguments: { file_path: absPath },
        agent,
      })
      return { isError: r.isError === true, text: (r.content ?? []).filter((b) => b?.type === 'text').map((b) => (typeof b.text === 'string' ? b.text : '')).join('') }
    },
    dispose: async () => { await ctx.dispose?.() },
  }
}

describe('a5m2-readimg arm C2/C3 — governed B-IMAGE pre-takeover over the real pin639 attachment store', () => {
  it('C2 positive (approved path): classify emits the frozen I+F effect set, the ticket consumes to a controlled read + a durable store commit, the receipt identity is fingerprint-verified, and the same-scope reference re-reads byte-exact', async () => {
    const world = await armWorld()
    try {
      const file = join(world.govRoot, 'red.png')
      writeFileSync(file, PNG_1X1)
      const classified = world.arm.classify({ file_path: 'red.png' }, TRUSTED_CTX)
      expect(classified.ok, `classify must accept: ${classified.detail ?? ''}`).toBe(true)
      const effects = classified.effects ?? []
      expect(effects).toHaveLength(2)
      expect(JSON.stringify(effects[0])).toContain('"tool-invoke"')
      const fEffect = effects[1] as { kind: string; resource?: { kind?: string; rights?: readonly string[]; realmId?: string } }
      expect(fEffect.kind).toBe('read')
      expect(fEffect.resource?.kind).toBe('absolute-path')
      expect(fEffect.resource?.rights).toEqual(['read'])
      expect(fEffect.resource?.realmId).toBe('realm-fixture')
      const prepared = world.arm.prepare(classified.plan as object)
      expect(prepared.ok).toBe(true)
      const ran = await world.arm.execute(prepared.ticket as object, EXEC())
      expect(ran.ok, `execute must commit: ${ran.detail ?? ''}`).toBe(true)
      const image = ran.value?.image
      expect(image?.mediaType).toBe('image/png')
      expect(image?.bytes).toBe(PNG_1X1.byteLength)
      const id = String(image?.attachmentId)
      const hex = id.startsWith('sha256:') ? id.slice(7) : id
      expect(existsSync(join(world.storeRoot, 'objects', hex.slice(0, 2), hex)), 'durable object under the content-addressed path').toBe(true)
      // the reference leg, same namespace: byte-identity + fingerprint equality
      const ref = await world.adapter.referenceImage({ attachmentId: id, namespace: { realmId: 'realm-fixture', sessionIncarnation: 'agent-1' } })
      expect(ref.ok).toBe(true)
      expect(Buffer.compare(Buffer.from(ref.bytes ?? new Uint8Array()), PNG_1X1)).toBe(0)
      expect(ref.fingerprint).toBe(hex) // content-addressed fresh object: digest === attachmentId
      expect(world.adapter.stats().commits).toBe(1)
      expect(world.counters.readFile).toBe(1)
    } finally {
      await world.dispose()
    }
  })

  it('row-7 contrast (pre-fix repro vs post-fix typed refusal, verbatim): the untouched host native face reads an out-of-root absolute target successfully (no root fence); the SAME target on the governed arm refuses P_IMAGE_CLASSIFY_TARGET_OUTSIDE_GOVERNED_ROOT with ZERO readPort calls', async () => {
    const world = await armWorld()
    let native: NativeWorld | null = null
    try {
      const outsideFile = join(world.outsideDir, 'secret.png')
      writeFileSync(outsideFile, PNG_1X1)
      native = await nativeWorld(world.govRoot)
      const repro = await native.readAbs(outsideFile)
      // PRE-FIX REPRODUCTION on the untouched face (the measured primary gap):
      expect(repro.isError, `the host native face is EXPECTED to succeed out-of-root at pin639: ${repro.text}`).toBe(false)
      expect(repro.text).toContain('<type>image</type>')
      // POST-FIX, governed arm: typed refusal at the PURE stage, zero fs calls.
      const tried = world.arm.classify({ file_path: outsideFile }, TRUSTED_CTX)
      expect(tried.ok).toBe(false)
      expect(tried.code).toBe(A5_IMAGE_TYPED_CODES.TARGET_OUTSIDE_GOVERNED_ROOT)
      expect(tried.detail).toContain('BEFORE any filesystem call')
      expect({ ...world.counters }).toEqual({ stat: 0, readFile: 0 })
      expect(world.adapter.stats().commits).toBe(0)
      expect(world.objects()).toBe(0)
    } finally {
      if (native !== null) await native.dispose()
      await world.dispose()
    }
  })

  it('escape via traversal is refused at the pure classify stage with zero fs calls (the containment decision is the governor\'s own act, never delegated to the mounted backend)', async () => {
    const world = await armWorld()
    try {
      writeFileSync(join(world.outsideDir, 'secret.png'), PNG_1X1)
      const tried = world.arm.classify({ file_path: '../outside/secret.png' }, TRUSTED_CTX)
      expect(tried.ok).toBe(false)
      expect(tried.code).toBe(A5_IMAGE_TYPED_CODES.TARGET_OUTSIDE_GOVERNED_ROOT)
      expect({ ...world.counters }).toEqual({ stat: 0, readFile: 0 })
    } finally {
      await world.dispose()
    }
  })

  it('symlink alias (inside spelling, outside bytes): refused at effect-time re-anchoring BEFORE any content read — zero readFile calls, zero attachment writes', async () => {
    const world = await armWorld()
    try {
      writeFileSync(join(world.outsideDir, 'real.png'), PNG_1X1)
      symlinkSync(join(world.outsideDir, 'real.png'), join(world.govRoot, 'alias.png'))
      const classified = world.arm.classify({ file_path: 'alias.png' }, TRUSTED_CTX)
      expect(classified.ok, 'lexically inside: classify is honest about what it can know').toBe(true)
      const prepared = world.arm.prepare(classified.plan as object)
      const ran = await world.arm.execute(prepared.ticket as object, EXEC())
      expect(ran.ok).toBe(false)
      expect(ran.code).toBe(A5_IMAGE_TYPED_CODES.TARGET_OUTSIDE_ROOT)
      expect(ran.detail).toContain('symlink')
      expect(world.counters.readFile, 'containment metadata is the governor\'s act; the CONTENT read never starts').toBe(0)
      expect(world.adapter.stats().storeCalls).toBe(0)
      expect(world.objects()).toBe(0)
    } finally {
      await world.dispose()
    }
  })

  it('byte cap lands AT READ TIME: the stat size above min(maxImageBytes, maxMessageImageBytes) refuses before the content read — zero readFile calls, the store never sees the file', async () => {
    const world = await armWorld({ maxImageBytes: 32 })
    try {
      writeFileSync(join(world.govRoot, 'red.png'), PNG_1X1) // 69B > 32B
      const classified = world.arm.classify({ file_path: 'red.png' }, TRUSTED_CTX)
      const prepared = world.arm.prepare(classified.plan as object)
      const ran = await world.arm.execute(prepared.ticket as object, EXEC())
      expect(ran.ok).toBe(false)
      expect(ran.code).toBe(A5_IMAGE_TYPED_CODES.READ_TOO_LARGE)
      expect(ran.detail).toContain('32')
      expect(world.counters.readFile).toBe(0)
      expect(world.adapter.stats().storeCalls).toBe(0)
      expect(world.objects()).toBe(0)
    } finally {
      await world.dispose()
    }
  })

  it('the STORE owns the pixel laws: a dimension-capped deployment refuses through the commit, the durable store keeps zero objects, and the unknowable commit boundary keeps sideEffectPossible (never downgraded)', async () => {
    const world = await armWorld({ maxImageDimension: 2 })
    try {
      writeFileSync(join(world.govRoot, 'red3.png'), PNG_3X3)
      const classified = world.arm.classify({ file_path: 'red3.png' }, TRUSTED_CTX)
      const prepared = world.arm.prepare(classified.plan as object)
      const ran = await world.arm.execute(prepared.ticket as object, EXEC())
      expect(ran.ok).toBe(false)
      expect(ran.code).toBe(A5_IMAGE_TYPED_CODES.STORE_UNAVAILABLE)
      // MEASURED first-failure fact kept honest: the store's per-side arm at
      // pin639 is "Image exceeds the configured per-side pixel limit." (the
      // dimension law, verbatim — no pixel count in the message).
      expect(ran.detail).toContain('Image exceeds the configured per-side pixel limit.')
      expect(ran.sideEffectPossible).toBe(true)
      expect(world.objects()).toBe(0)
    } finally {
      await world.dispose()
    }
  })

  it('Ask-pending writes nothing: classify (+ even a prepared ticket) leaves zero reads, zero store calls, zero objects', async () => {
    const world = await armWorld()
    try {
      writeFileSync(join(world.govRoot, 'red.png'), PNG_1X1)
      const classified = world.arm.classify({ file_path: 'red.png' }, TRUSTED_CTX)
      expect(classified.ok).toBe(true)
      const prepared = world.arm.prepare(classified.plan as object)
      expect(prepared.ok).toBe(true)
      expect({ ...world.counters }).toEqual({ stat: 0, readFile: 0 })
      expect(world.adapter.stats()).toEqual({ commits: 0, references: 0, storeCalls: 0, refusedForeignNamespace: 0 })
      expect(world.objects()).toBe(0)
    } finally {
      await world.dispose()
    }
  })

  it('no ticket, no effect: execute without a prepare-issued ticket refuses (rejection/denial face) and a consumed ticket single-claims with ALREADY_CONSUMED on re-fire', async () => {
    const world = await armWorld()
    try {
      writeFileSync(join(world.govRoot, 'red.png'), PNG_1X1)
      const classified = world.arm.classify({ file_path: 'red.png' }, TRUSTED_CTX)
      const noTicket = await world.arm.execute(classified.plan as object, EXEC())
      expect(noTicket.ok).toBe(false)
      expect(noTicket.code).toBe(A5_IMAGE_TYPED_CODES.NOT_ADMITTED)
      expect({ ...world.counters }).toEqual({ stat: 0, readFile: 0 })
      const prepared = world.arm.prepare(classified.plan as object)
      const first = await world.arm.execute(prepared.ticket as object, EXEC())
      expect(first.ok).toBe(true)
      const refire = await world.arm.execute(prepared.ticket as object, EXEC())
      expect(refire.ok).toBe(false)
      expect(refire.code).toBe(A5_IMAGE_TYPED_CODES.ALREADY_CONSUMED)
      expect(world.objects()).toBe(1) // exactly one commit survived the re-fire attempt
      expect(world.counters.readFile).toBe(1)
    } finally {
      await world.dispose()
    }
  })

  it('C3 before admission: cancel settles CANCELLED-BEFORE-ADMISSION, zero file reads + zero attachment writes', async () => {
    const world = await armWorld()
    try {
      writeFileSync(join(world.govRoot, 'red.png'), PNG_1X1)
      const classified = world.arm.classify({ file_path: 'red.png' }, TRUSTED_CTX)
      const cancelled = world.arm.cancel(classified.plan as object)
      expect(cancelled.settled).toBe('CANCELLED-BEFORE-ADMISSION')
      expect(cancelled.attachmentOutcome).toContain('zero')
      expect({ ...world.counters }).toEqual({ stat: 0, readFile: 0 })
    } finally {
      await world.dispose()
    }
  })

  it('C3 after admission (ticket issued, never consumed): zero append-equivalents — no read started, no store call, no object', async () => {
    const world = await armWorld()
    try {
      writeFileSync(join(world.govRoot, 'red.png'), PNG_1X1)
      const classified = world.arm.classify({ file_path: 'red.png' }, TRUSTED_CTX)
      const prepared = world.arm.prepare(classified.plan as object)
      const cancelled = world.arm.cancel(prepared.ticket as object)
      expect(cancelled.settled).toBe('CANCELLED-AFTER-ADMISSION')
      const late = await world.arm.execute(prepared.ticket as object, EXEC())
      expect(late.code).toBe(A5_IMAGE_TYPED_CODES.CANCELLED)
      expect({ ...world.counters }).toEqual({ stat: 0, readFile: 0 })
      expect(world.objects()).toBe(0)
    } finally {
      await world.dispose()
    }
  })

  it('C3 mid-read abort: the live read dies before the commit; the report names the mid-read window, cleanup needs nothing (this call committed zero), and only this call had uncommitted work', async () => {
    const world = await armWorld({}, { hangUntilAbort: true })
    try {
      writeFileSync(join(world.govRoot, 'red.png'), PNG_1X1)
      const classified = world.arm.classify({ file_path: 'red.png' }, TRUSTED_CTX)
      const prepared = world.arm.prepare(classified.plan as object)
      const ctrl = new AbortController()
      const running = world.arm.execute(prepared.ticket as object, EXEC(ctrl.signal))
      await new Promise((r) => setTimeout(r, 5)) // the read is now live inside the port
      ctrl.abort()
      const ran = await running
      expect(ran.ok).toBe(false)
      expect(ran.code).toBe(A5_IMAGE_TYPED_CODES.CANCELLED)
      expect(ran.detail).toContain('commit never started')
      expect(world.objects()).toBe(0)
      expect(world.adapter.stats().commits).toBe(0)
    } finally {
      await world.dispose()
    }
  })

  it('C3 cancel after commit: the honest report names ALREADY-COMMITTED with the attachmentId, and the durable object stays — cancellation never deletes existing attachments (the arm owns no delete face)', async () => {
    const world = await armWorld()
    try {
      writeFileSync(join(world.govRoot, 'red.png'), PNG_1X1)
      const classified = world.arm.classify({ file_path: 'red.png' }, TRUSTED_CTX)
      const prepared = world.arm.prepare(classified.plan as object)
      const ran = await world.arm.execute(prepared.ticket as object, EXEC())
      expect(ran.ok).toBe(true)
      const cancelled = world.arm.cancel(prepared.ticket as object)
      expect(cancelled.settled).toBe('ALREADY-COMMITTED')
      expect(cancelled.attachmentOutcome).toContain('never deletes existing attachments')
      expect(world.objects()).toBe(1) // the completed commit FIRST is kept; the report says which happened first
    } finally {
      await world.dispose()
    }
  })

  it('attachment namespace binding: a foreign session incarnation cannot reference the minted attachment (typed refusal, ZERO additional store calls); the minting scope can; an unknown id is UNKNOWN', async () => {
    const world = await armWorld()
    try {
      writeFileSync(join(world.govRoot, 'red.png'), PNG_1X1)
      const classified = world.arm.classify({ file_path: 'red.png' }, TRUSTED_CTX)
      const prepared = world.arm.prepare(classified.plan as object)
      const ran = await world.arm.execute(prepared.ticket as object, EXEC())
      const id = String(ran.value?.image?.attachmentId)
      const callsBefore = world.adapter.stats().storeCalls
      const foreign = await world.adapter.referenceImage({ attachmentId: id, namespace: { realmId: 'realm-fixture', sessionIncarnation: 'agent-2' } })
      expect(foreign.ok).toBe(false)
      expect(foreign.code).toBe(A5_IMAGE_ATTACHMENT_CODES.NAMESPACE_MISMATCH)
      expect(world.adapter.stats().storeCalls).toBe(callsBefore) // refused WITHOUT reaching the store
      const unknown = await world.adapter.referenceImage({ attachmentId: 'sha256:deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef', namespace: { realmId: 'realm-fixture', sessionIncarnation: 'agent-1' } })
      expect(unknown.code).toBe(A5_IMAGE_ATTACHMENT_CODES.UNKNOWN_ATTACHMENT)
      const mine = await world.adapter.referenceImage({ attachmentId: id, namespace: { realmId: 'realm-fixture', sessionIncarnation: 'agent-1' } })
      expect(mine.ok).toBe(true)
    } finally {
      await world.dispose()
    }
  })

  it('the closed argument root: unknown top-level keys refuse P_IMAGE_CLASSIFY_UNKNOWN_PARAMETER with zero effects (the P layer tightens what the host schema layer leaves open — the native ignore-extra-keys face stays measured in a5m2-readimg-c1); no-extension and foreign-extension targets refuse UNDECLARED_MEDIA_TYPE at the pure stage', async () => {
    const world = await armWorld()
    try {
      writeFileSync(join(world.govRoot, 'red.png'), PNG_1X1)
      const extra = world.arm.classify({ file_path: 'red.png', content: `injected-${SENTINEL}`, offset: 3 }, TRUSTED_CTX)
      expect(extra.ok).toBe(false)
      expect(extra.code).toBe(A5_IMAGE_TYPED_CODES.UNKNOWN_PARAMETER)
      expect(extra.detail).toContain('additionalProperties')
      writeFileSync(join(world.govRoot, 'notes.txt'), `body ${SENTINEL}`)
      writeFileSync(join(world.govRoot, 'noext'), PNG_1X1)
      const txt = world.arm.classify({ file_path: 'notes.txt' }, TRUSTED_CTX)
      const noext = world.arm.classify({ file_path: 'noext' }, TRUSTED_CTX)
      expect(txt.code).toBe(A5_IMAGE_TYPED_CODES.UNDECLARED_MEDIA_TYPE)
      expect(noext.code).toBe(A5_IMAGE_TYPED_CODES.UNDECLARED_MEDIA_TYPE)
      expect({ ...world.counters }).toEqual({ stat: 0, readFile: 0 })
    } finally {
      await world.dispose()
    }
  })

  it('DRAINING closes every stage typed and the handle exposes NO native body / fallback face (BASE.C3 by construction)', async () => {
    const world = await armWorld()
    try {
      world.arm.drain()
      expect(world.arm.classify({ file_path: 'red.png' }, TRUSTED_CTX).code).toBe(A5_IMAGE_TYPED_CODES.DRAINING)
      const face = Object.keys(world.arm).join(',')
      expect(face).not.toMatch(/native|fallback|delegate/i)
    } finally {
      await world.dispose()
    }
  })

  it('conditional unavailability is fail-closed at assembly: no store port ⇒ the arm factory throws (no half-wired arm, no exemption); no read port ⇒ the same', () => {
    const base = {
      definitionIdentity: 'defn-x',
      providerId: 'visual',
      realmId: 'realm-x',
      namespaceRoot: '/nonexistent-root-not-touched-because-assembly-refuses-first',
      trustedIdentities: ['agent-1'],
    }
    const read = makeReadPort()
    expect(() => createGovernedReadImageArm({ ...base, readPort: read.port } as never)).toThrowError(/attachments adapter/)
    expect(() => createGovernedReadImageArm({ ...base, attachments: createImageAttachmentAdapter({ store: { saveImage: async () => ({}), readImage: async () => new Uint8Array(), imageLimits: { maxImageBytes: 1, maxMessageImageBytes: 1 } } }) } as never)).toThrowError(/readPort/)
    expect(() => createImageAttachmentAdapter({ } as never)).toThrowError(/real store port/)
  })

  it('a store that dies mid-life answers every consumed call with typed P_IMAGE_STORE_UNAVAILABLE (conditional unavailability, not exemption, never a native fallback) and keeps sideEffectPossible standing', async () => {
    const world = await armWorld()
    try {
      // hard-kill the store's own entry behind the adapter (simulated death):
      const dying: ImageAttachmentStorePort = {
        saveImage: async () => { throw new Error('store fiber disposed') },
        readImage: async () => { throw new Error('store fiber disposed') },
        imageLimits: { maxImageBytes: 20 * 1024 * 1024, maxMessageImageBytes: 200 * 1024 * 1024 },
      }
      const adapter = createImageAttachmentAdapter({ store: dying })
      const read = makeReadPort()
      const arm = createGovernedReadImageArm({
        definitionIdentity: 'defn-dying', providerId: 'visual', realmId: 'realm-fixture',
        namespaceRoot: world.govRoot, readPort: read.port, attachments: adapter, trustedIdentities: ['agent-1'],
      })
      writeFileSync(join(world.govRoot, 'red.png'), PNG_1X1)
      const classified = arm.classify({ file_path: 'red.png' }, TRUSTED_CTX)
      const prepared = arm.prepare(classified.plan as object)
      const ran = await arm.execute(prepared.ticket as object, EXEC())
      expect(ran.ok).toBe(false)
      expect(ran.code).toBe(A5_IMAGE_TYPED_CODES.STORE_UNAVAILABLE)
      expect(ran.sideEffectPossible).toBe(true)
      expect(read.counters.readFile).toBe(1) // the read happened; only the COMMIT leg died
    } finally {
      await world.dispose()
    }
  })
})
