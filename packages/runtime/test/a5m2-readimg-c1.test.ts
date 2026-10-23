/**
 * a5m2-readimg-c1 — M2-READIMG-01 (matrix row M-05) C1/C2/C3 over the
 * read_image NATIVE PRODUCTION REGISTRATION FACE at the pristine pin639 host.
 *
 * WHAT IS DRIVEN (production wiring, not a vitest-green proxy):
 *  - the REAL registration route: `@deepseek-ai/dsh-tool-fs` barrel `apply`
 *    inside `ctx.inject(['attachments'], …)` (tool-fs/src/index.ts:70-71) —
 *    the same code the base bundle mounts (bundle/base/cordis.patch.yml
 *    :281-282 tool-fs + :138-139 attachment-local);
 *  - the REAL attachment backend (`attachment-local` prebuilt lib, durable
 *    content-addressed object store under <dshHome>/attachments/v1);
 *  - the REAL fs backend (`fs-local`) + `fs-observation-policy`;
 *  - the real ToolRuntime dispatch (`ctx.tools.execute`, mode 'native').
 * Host code runs UNMODIFIED from the pristine test-use checkout's prebuilt
 * libs (absolute-path import; transitive deps resolve from that tree's own
 * pnpm layout — the a2-canonical-operation-realfs.mjs mechanism). ZERO bytes
 * are written into the host tree (porcelain stays 0).
 *
 * B-IMAGE contract face (contract §3, no architecture expansion):
 *   I + F(read exact file) + S(attachment-store, create, write)
 *     + S(session, attach-vision, write)
 * mapped at THIS face:
 *  - F(read exact file) = the single `file_path` argument (the exact-file pin;
 *    see the cross-check leg for the measured top-level parameter face —
 *    no top-level additionalProperties:false is declared, extra keys carry
 *    no effect channel on this read-only tool);
 *  - S(attachment-store create/write) = durable object commit observed ON DISK,
 *    the returned attachmentId verified against the bytes re-read from
 *    <root>/objects/<aa>/<sha256> (content-addressed identity);
 *  - S(session attach-vision write) = the two rendered content blocks (text
 *    envelope + image block) handed to the dispatch result; the durable
 *    SESSION-LOG ride of those blocks is the Host owner's leg (no Host boot
 *    here — NOT_VERIFIED, not claimed);
 *  - bytes/pixels cap = enforced at read time (FS_TOO_LARGE before any
 *    attachment write) and at decode (dimension refusal never enters the
 *    durable store) — the caps ride the attachment store's configured limits,
 *    which is exactly the "capacity check at read time" clause;
 *  - target-session/attachment namespace: the NATIVE face has no Team
 *    namespace (reads delegate to whatever ctx.fs backend is mounted;
 *    fs-sandbox fences WRITES only — read-image.ts:263 → ctx.fs.readBytes
 *    never enters checkedTarget). This is the card's PRIMARY GAP and the
 *    front-takeover proposal (evidence/alpha5/m2-readimg/) covers the P-layer
 *    closure; this file therefore asserts ONLY the native face and never
 *    claims governed containment.
 *
 * C1 law (root ruling): "缺 store 只算条件不可用，不豁免" — the no-store arms
 * below prove the tool is conditionally unavailable (absent from the dispatch
 * face; mid-life store disposal UNREGISTERS the inject-scoped tool — measured
 * production truth; the execute-time re-check text is the direct-caller face
 * and unreachable through the bundle route, disclosed), which does NOT exempt
 * the row.
 * C2 law: refusals ⇒ 0 file reads + 0 attachment writes (fs spy on the real
 * backend instance + on-disk object count), cap-exceeded refuses, approved
 * image + same-scope attachment re-reads byte-exact.
 * C3 law: cancellation clears only THIS call's uncommitted work — the
 * deterministic pre-aborted arm proves zero durable residue; the mid-read race
 * window is honestly NOT proven at fixture level (Host leg, NOT_VERIFIED).
 *
 * Zero-I/O observation is a spy on the mounted fs instance (ctx.get('fs')
 * method wrappers): it evidences THIS call path touching no resolve/stat/
 * readBytes, never a Host-wide claim.
 *
 * Worlds: tests/homes/m2-readimg-<UTC-stamp>/ (TEST_METHODS §7 temp world,
 * deleted in afterAll; teardown recorded in
 * dev/agent-workflow/evidence/alpha5/m2-readimg/). Synthetic images are
 * self-generated base64 constants — no user images are read anywhere.
 *
 * Fail-closed: a missing/unbuilt pristine host tree THROWS (red identity,
 * environment unqualified) — never a silent skip.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-readimg-c1
 */
import { describe, expect, it, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { findTestRepoRoot, testUseTree, homeRoot } from '../../../tests/paths.mjs'

/** The minimal structural face of the prebuilt host objects this fixture touches. */
interface LooseFiber { dispose?: () => Promise<void> }
interface LooseDef { parameters?: Record<string, unknown> }
interface AttachmentRef { attachmentId?: unknown; mediaType?: unknown; width?: unknown; height?: unknown; bytes?: unknown }
interface ContentBlock { type?: unknown; text?: unknown; attachment?: AttachmentRef }
interface ExecResult { isError?: boolean; content?: ContentBlock[] }
interface LooseCtx {
  plugin: (p: unknown, cfg?: Record<string, unknown>) => Promise<LooseFiber>
  get: (name: string) => Record<string, unknown> | undefined
  tools: {
    get: (name: string) => LooseDef | undefined
    execute: (input: Record<string, unknown>) => Promise<ExecResult>
  }
  llm: { registerAdapter: (providers: readonly string[], adapter: object) => unknown }
  dispose?: () => Promise<void>
}

const REPO = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO === null) throw new Error('m2-readimg: no repo root carrying tests/deepseek-harness-test-use — environment unqualified, failing closed')
const ROOT = REPO
const HOST = testUseTree(ROOT)

/** Absolute file URL of one prebuilt host lib barrel (artifact plane only). */
function hostLib(rel: string): string {
  const abs = join(HOST, 'packages', rel, 'lib/index.js')
  if (!existsSync(abs)) throw new Error(`m2-readimg: pristine host lib absent (${abs}) — baseline checkout must be installed + built; failing closed`)
  return pathToFileURL(abs).href
}
const CORDIS_LIB = join(HOST, 'vendor/cordis/lib/index.js')
if (!existsSync(CORDIS_LIB)) throw new Error(`m2-readimg: vendored cordis lib absent (${CORDIS_LIB}); failing closed`)

/* Self-generated synthetic images (no sensitive content, no user files). */
/** 1x1 red PNG (valid signature/IHDR/IDAT). */
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64')
/** 3x3 red PNG, used against a tiny configured dimension cap. */
const PNG_3X3 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAIAAADZSiLoAAAAEElEQVR4nGP4z8AAQQxYWACPjgj4kWPEuQAAAABJRU5ErkJggg==', 'base64')
/** Sentinel never allowed to appear in any refusal text (zero-leak witness). */
const SENTINEL = 'M2-READIMG-SENTINEL-DO-NOT-ECHO-4f9d17'

const STAMP = new Date().toISOString().replace(/[:.]/g, '-')
const WORLD_ROOT = join(homeRoot(ROOT), `m2-readimg-${STAMP}`)
afterAll(() => { rmSync(WORLD_ROOT, { recursive: true, force: true }) })

let worldSeq = 0
function worldDir(label: string): string {
  const dir = join(WORLD_ROOT, `${String(++worldSeq)}-${label}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

/** Count durable attachment objects on disk (the store's content-addressed tree). */
function countObjects(storeRoot: string): number {
  const objectsDir = join(storeRoot, 'objects')
  if (!existsSync(objectsDir)) return 0
  let n = 0
  for (const shard of readdirSync(objectsDir, { withFileTypes: true })) {
    if (shard.isDirectory()) n += readdirSync(join(objectsDir, shard.name)).length
  }
  return n
}

interface SetupOptions {
  attachments?: boolean
  storeConfig?: Record<string, number>
}
interface SetupResult {
  ctx: LooseCtx
  counters: { resolve: number; stat: number; readBytes: number }
  attachmentsRoot: string | undefined
  disposeAttachments: () => Promise<void>
  disposeAll: () => Promise<void>
}

async function setup(dir: string, options: SetupOptions = {}): Promise<SetupResult> {
  const cordisMod = await import(pathToFileURL(CORDIS_LIB).href)
  const toolsMod = await import(hostLib('core/tools'))
  const llmMod = await import(hostLib('llm/llm'))
  const spMod = await import(hostLib('core/system-prompt'))
  const fsLocalMod = await import(hostLib('fs/fs-local'))
  const fsPolicyMod = await import(hostLib('fs/fs-observation-policy'))
  const attachmentLocalMod = await import(hostLib('attachment/attachment-local'))
  const toolFsMod = await import(hostLib('fs/tool-fs'))

  const Context = cordisMod.Context
  const ctx: LooseCtx = new Context()
  await ctx.plugin(spMod.default)
  await ctx.plugin(toolsMod.default, { mode: 'native' })
  await ctx.plugin(fsLocalMod.default, { cwd: dir })
  await ctx.plugin(fsPolicyMod)
  let attachmentsRoot: string | undefined
  let disposeAttachments: () => Promise<void> = async () => undefined
  if (options.attachments !== false) {
    const storeFiber = await ctx.plugin(attachmentLocalMod.default, { dshHome: join(dir, 'home'), ...options.storeConfig })
    const storeSvc = ctx.get('attachments')
    if (storeSvc === undefined || typeof storeSvc.root !== 'string') throw new Error('m2-readimg fixture: attachments service did not mount')
    attachmentsRoot = storeSvc.root
    disposeAttachments = async () => { await storeFiber.dispose?.() }
  }
  await ctx.plugin(llmMod.default)
  // Exact-route fake adapter on the pin639 LlmRuntime + LlmAdapter base,
  // image-capable and text-only models — mirrors the host's own
  // read-image.spec world. (Base is a prebuilt runtime class; no override
  // modifier: the fixture types it structurally, see the LooseCtx law above.)
  class CatalogAdapter extends llmMod.LlmAdapter {
    listModels(_provider: string): readonly Record<string, unknown>[] {
      return [
        { provider: 'visual', id: 'vision-model', name: 'Vision', inputModalities: ['text', 'image'] },
        { provider: 'visual', id: 'text-model', name: 'Text', inputModalities: ['text'] },
      ]
    }
    resolveModel(provider: string, model: string): Promise<Record<string, unknown>> {
      return Promise.resolve({
        provider,
        id: model,
        name: model,
        inputModalities: model === 'vision-model' ? ['text', 'image'] : ['text'],
      })
    }
    stream(): never {
      throw new Error('m2-readimg fixture never streams')
    }
  }
  ctx.llm.registerAdapter(['visual'], new CatalogAdapter())
  await ctx.plugin(toolFsMod)

  // Zero-IO witness: spy the MOUNTED fs backend instance (ctx.fs delegates to
  // the same object; verified empirically at pin639).
  const counters = { resolve: 0, stat: 0, readBytes: 0 }
  const fsSvc = ctx.get('fs')
  if (fsSvc === undefined) throw new Error('m2-readimg fixture: fs service did not mount')
  for (const key of ['resolve', 'stat', 'readBytes'] as const) {
    const original = fsSvc[key]
    if (typeof original !== 'function') throw new Error(`m2-readimg fixture: fs.${key} is not callable on the mounted backend`)
    const fn = original as (this: Record<string, unknown>, ...args: unknown[]) => Promise<unknown>
    fsSvc[key] = async (...args: unknown[]) => {
      counters[key] += 1
      return fn.apply(fsSvc, args)
    }
  }

  return {
    ctx,
    counters,
    attachmentsRoot,
    disposeAttachments,
    disposeAll: async () => { await ctx.dispose?.() },
  }
}

/** Fake calling agent pinned to one routed provider/model (host-spec shape). */
function agentOn(dir: string, model: string): object {
  return {
    options: {},
    session: {
      header: { cwd: dir },
      requestHeader: () => ({ config: { provider: 'visual', model } }),
      deriveMessages: () => [],
      append: () => undefined,
    },
  }
}

let callSeq = 0
interface CallOutcome { isError: boolean; text: string; blocks: ContentBlock[] }
async function callReadImage(
  ctx: LooseCtx,
  args: Record<string, unknown>,
  opts: { agent?: object; signal?: AbortSignal } = {},
): Promise<CallOutcome> {
  const llmMod = await import(hostLib('llm/llm'))
  let result: ExecResult
  try {
    result = await ctx.tools.execute({
      signal: opts.signal ?? new AbortController().signal,
      callId: llmMod.ToolCallId(`m2-img-${String(++callSeq)}`),
      name: 'read_image',
      arguments: args,
      ...(opts.agent === undefined ? {} : { agent: opts.agent }),
    })
  } catch (error: unknown) {
    return { isError: true, text: String((error as Error)?.message ?? error), blocks: [] }
  }
  const content = Array.isArray(result.content) ? result.content : []
  return {
    isError: result.isError === true,
    text: content.filter((b) => b?.type === 'text').map((b) => (typeof b.text === 'string' ? b.text : '')).join(''),
    blocks: content,
  }
}

const readImage = (ctx: LooseCtx, filePath: string, opts: { agent?: object; signal?: AbortSignal } = {}): Promise<CallOutcome> =>
  callReadImage(ctx, { file_path: filePath }, opts)

const abortedSignal = (): AbortSignal => {
  const c = new AbortController()
  c.abort()
  return c.signal
}

describe('a5m2-readimg C1/C2/C3 — read_image native production registration face (pristine pin639 prebuilt libs)', () => {
  it('C1 positive: the registered tool reads a synthetic PNG into the typed image outcome with a durable content-addressed object on disk', async () => {
    const dir = worldDir('c1-positive')
    writeFileSync(join(dir, 'red.png'), PNG_1X1)
    const world = await setup(dir)
    try {
      const def = world.ctx.tools.get('read_image')
      expect(def, 'read_image must exist on the dispatch face while attachments are mounted').toBeTruthy()
      // The exact-file parameter face: `file_path` is the declared argument.
      const params = def?.parameters?.properties ?? def?.parameters ?? {}
      expect(Object.keys(params)).toEqual(['file_path'])

      const out = await readImage(world.ctx, 'red.png', { agent: agentOn(dir, 'vision-model') })
      expect(out.isError, `positive control must succeed, got: ${out.text}`).toBe(false)
      expect(out.blocks).toHaveLength(2)
      expect(out.text).toContain('<type>image</type>')
      expect(out.text).toContain('<path>')
      const image = out.blocks.find((b) => b?.type === 'image')
      expect(image, 'image block beside the envelope').toBeTruthy()
      expect(image?.attachment?.mediaType).toBe('image/png')
      expect(image?.attachment?.width).toBe(1)
      expect(image?.attachment?.height).toBe(1)
      expect(Number(image?.attachment?.bytes)).toBeGreaterThan(0)

      // Durable S(create/write) face: the returned id addresses the exact stored object.
      const id = String(image?.attachment?.attachmentId)
      const hex = id.startsWith('sha256:') ? id.slice('sha256:'.length) : id
      expect(hex).toMatch(/^[0-9a-f]{16,}$/)
      const objectPath = join(String(world.attachmentsRoot), 'objects', hex.slice(0, 2), hex)
      expect(existsSync(objectPath), `durable object at ${objectPath}`).toBe(true)

      expect(world.counters.readBytes, 'the positive path must have READ through the mounted backend').toBeGreaterThanOrEqual(1)
    } finally {
      await world.disposeAll()
    }
  })

  it('C1 conditional-unavailable (no attachments store): the tool is ABSENT from the dispatch face — a refusal state, never an exemption', async () => {
    const dir = worldDir('c1-nostore')
    writeFileSync(join(dir, 'red.png'), PNG_1X1)
    const world = await setup(dir, { attachments: false })
    try {
      expect(world.ctx.tools.get('read_image'), 'tool-fs registers read_image ONLY while attachments is mounted (index.ts:70-71)').toBeUndefined()
      const out = await readImage(world.ctx, 'red.png', { agent: agentOn(dir, 'vision-model') })
      expect(out.isError).toBe(true)
      expect(out.text).toMatch(/read_image/)
      expect({ ...world.counters }).toEqual({ resolve: 0, stat: 0, readBytes: 0 })
    } finally {
      await world.disposeAll()
    }
  })

  it('C1 conditional-unavailable (store disposed mid-life): the inject-scoped registration unmounts with the store — the tool leaves the dispatch face before any filesystem read', async () => {
    const dir = worldDir('c1-disposed')
    writeFileSync(join(dir, 'red.png'), PNG_1X1)
    const world = await setup(dir)
    try {
      expect(world.ctx.tools.get('read_image')).toBeTruthy()
      await world.disposeAttachments()
      // MEASURED production truth at pin639: the tool-fs registration rides
      // the `ctx.inject(['attachments'], …)` effect scope, so disposing the
      // store UNREGISTERS the tool — the execute-time re-check text
      // (read-image.ts:251-253, "no attachment service is mounted") is the
      // direct-caller face and is UNREACHABLE through the bundle-mounted
      // production route (disclosed, not asserted).
      expect(world.ctx.tools.get('read_image')).toBeUndefined()
      const out = await readImage(world.ctx, 'red.png', { agent: agentOn(dir, 'vision-model') })
      expect(out.isError).toBe(true)
      expect(out.text).toMatch(/read_image/)
      expect({ ...world.counters }).toEqual({ resolve: 0, stat: 0, readBytes: 0 })
    } finally {
      await world.disposeAll()
    }
  })

  it('C2 same-scope attachment re-read: the committed object re-reads byte-exact under the id the tool returned (normalized content identity)', async () => {
    const dir = worldDir('c2-fetch')
    writeFileSync(join(dir, 'red.png'), PNG_1X1)
    const world = await setup(dir)
    try {
      const out = await readImage(world.ctx, 'red.png', { agent: agentOn(dir, 'vision-model') })
      expect(out.isError).toBe(false)
      const image = out.blocks.find((b) => b?.type === 'image')
      const id = String(image?.attachment?.attachmentId)
      const hex = id.startsWith('sha256:') ? id.slice('sha256:'.length) : id
      const objectPath = join(String(world.attachmentsRoot), 'objects', hex.slice(0, 2), hex)
      const fsPromises = await import('node:fs/promises')
      const stored = await fsPromises.readFile(objectPath)
      expect(createHash('sha256').update(stored).digest('hex')).toBe(hex)
      // the normalized object is itself a real PNG (decode-able, not an echo of the request)
      expect([...stored.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      expect(stored.length).toBe(image?.attachment?.bytes)
    } finally {
      await world.disposeAll()
    }
  })

  it('C2 refusal before IO (non-image extension): typed extension text with ZERO fs calls and ZERO attachment objects', async () => {
    const dir = worldDir('c2-ext')
    writeFileSync(join(dir, 'notes.txt'), `secret ${SENTINEL} body`)
    const world = await setup(dir)
    try {
      const before = countObjects(String(world.attachmentsRoot))
      const out = await readImage(world.ctx, 'notes.txt', { agent: agentOn(dir, 'vision-model') })
      expect(out.isError).toBe(true)
      expect(out.text).toContain('does not declare a supported image format')
      expect(out.text).not.toContain(SENTINEL)
      expect({ ...world.counters }).toEqual({ resolve: 0, stat: 0, readBytes: 0 })
      expect(countObjects(String(world.attachmentsRoot))).toBe(before)
    } finally {
      await world.disposeAll()
    }
  })

  it('C2 refusal (extension lies about format): a real PNG under .jpg hits the rename/convert arm after a bounded read, nothing is stored, no content echoes', async () => {
    const dir = worldDir('c2-lie')
    writeFileSync(join(dir, 'fake.jpg'), PNG_1X1) // real image bytes, declared extension lies
    const world = await setup(dir)
    try {
      const before = countObjects(String(world.attachmentsRoot))
      const out = await readImage(world.ctx, 'fake.jpg', { agent: agentOn(dir, 'vision-model') })
      expect(out.isError).toBe(true)
      expect(out.text).toContain('but the bytes use a different image format')
      expect(out.text).not.toContain(SENTINEL)
      expect(countObjects(String(world.attachmentsRoot))).toBe(before)
    } finally {
      await world.disposeAll()
    }
  })

  it('C2 refusal (declared extension over undecodable bytes): the decoder verbatim text surfaces (disclosed: the INVALID_IMAGE mapping covers the extension-less sniff path only), nothing is stored, no content echoes', async () => {
    const dir = worldDir('c2-malformed')
    writeFileSync(join(dir, 'fake.png'), `plain text pretending ${SENTINEL}`)
    const world = await setup(dir)
    try {
      const before = countObjects(String(world.attachmentsRoot))
      const out = await readImage(world.ctx, 'fake.png', { agent: agentOn(dir, 'vision-model') })
      expect(out.isError).toBe(true)
      // MEASURED first-failure fact (kept honest): the non-AttachmentError
      // decoder throw passes the mapping through unchanged
      // (read-image.ts:274-275 `if (!(error instanceof AttachmentError)) throw error`),
      // so the model sees the decoder's verbatim text on this arm.
      expect(out.text).toContain('Unsupported or malformed image data')
      expect(out.text).not.toContain(SENTINEL)
      expect(countObjects(String(world.attachmentsRoot))).toBe(before)
    } finally {
      await world.disposeAll()
    }
  })

  it('C2 refusal (routed model lacks image input): the route gate refuses before any filesystem read or attachment write', async () => {
    const dir = worldDir('c2-route')
    writeFileSync(join(dir, 'red.png'), PNG_1X1)
    const world = await setup(dir)
    try {
      const out = await readImage(world.ctx, 'red.png', { agent: agentOn(dir, 'text-model') })
      expect(out.isError).toBe(true)
      expect(out.text).toContain('does not declare image input')
      expect({ ...world.counters }).toEqual({ resolve: 0, stat: 0, readBytes: 0 })
      expect(countObjects(String(world.attachmentsRoot))).toBe(0)
    } finally {
      await world.disposeAll()
    }
  })

  it('C2 refusal (read-time byte cap): above-limit image refuses with the FS_TOO_LARGE text before any attachment write', async () => {
    const dir = worldDir('c2-bytecap')
    writeFileSync(join(dir, 'red.png'), PNG_1X1) // > 32B
    const world = await setup(dir, { storeConfig: { maxImageBytes: 32 } })
    try {
      const out = await readImage(world.ctx, 'red.png', { agent: agentOn(dir, 'vision-model') })
      expect(out.isError).toBe(true)
      expect(out.text).toContain('exceeds the 32-byte limit')
      expect(countObjects(String(world.attachmentsRoot))).toBe(0)
    } finally {
      await world.disposeAll()
    }
  })

  it('C2 refusal (decoded-dimension cap): the save-time dimension arm refuses and the durable store never sees the oversized object', async () => {
    const dir = worldDir('c2-dimcap')
    writeFileSync(join(dir, 'red3.png'), PNG_3X3)
    const world = await setup(dir, { storeConfig: { maxImageDimension: 2 } })
    try {
      const out = await readImage(world.ctx, 'red3.png', { agent: agentOn(dir, 'vision-model') })
      expect(out.isError).toBe(true)
      expect(out.text).toContain('exceeds the 2px limit')
      expect(countObjects(String(world.attachmentsRoot))).toBe(0)
    } finally {
      await world.disposeAll()
    }
  })

  it('C3 cancellation (pre-aborted call): FS_ABORTED before commit leaves the durable store untouched; only this call had uncommitted work', async () => {
    const dir = worldDir('c3-cancel')
    writeFileSync(join(dir, 'red.png'), PNG_1X1)
    const world = await setup(dir)
    try {
      const out = await readImage(world.ctx, 'red.png', { agent: agentOn(dir, 'vision-model'), signal: abortedSignal() })
      expect(out.isError).toBe(true)
      expect(out.text).toMatch(/aborted/i)
      expect(countObjects(String(world.attachmentsRoot))).toBe(0)
      // the SAME world stays usable after the cancelled call committed nothing
      const second = await readImage(world.ctx, 'red.png', { agent: agentOn(dir, 'vision-model') })
      expect(second.isError, `retry after cancel must succeed: ${second.text}`).toBe(false)
      expect(countObjects(String(world.attachmentsRoot))).toBe(1)
    } finally {
      await world.disposeAll()
    }
  })

  it('cross-check (measured family fact, pinned as regression net): parameters declare no top-level additionalProperties:false — unknown top-level keys are NOT schema-refused, the dispatcher only enforces required(file_path), and extra keys carry NO effect: the exact-file read outcome and the single attachment object stay unchanged', async () => {
    // Same-form fact as the todo round's finding: the host read_image wire
    // schema (docs/tool-catalog.md:1012-1031 at pin639) and the defineTool
    // parameters block (read-image.ts:213-215) declare properties+required
    // WITHOUT a top-level additionalProperties:false. MEASURED at pin639:
    //  - missing required `file_path` → typed `invalid arguments: missing
    //    required property "file_path"` (the dispatcher DOES enforce required);
    //  - extra top-level keys (`content`, `offset`) pass and are IGNORED —
    //    safe here only because this tool owns no write channel: the effect
    //    stays exactly F(the one exact file) + one content-addressed store
    //    object derived from the read bytes; nothing keyed by the extra keys
    //    is written, and the values never echo back. The P-layer takeover
    //    proposal pins its own row to refuse unknown keys at admission
    //    (evidence/alpha5/m2-readimg/TAKEOVER-PROPOSAL.md).
    const dir = worldDir('cross-additional')
    writeFileSync(join(dir, 'red.png'), PNG_1X1)
    const world = await setup(dir)
    try {
      const missing = await callReadImage(world.ctx, { path: 'red.png' }, { agent: agentOn(dir, 'vision-model') })
      expect(missing.isError).toBe(true)
      expect(missing.text).toContain('missing required property "file_path"')
      expect({ ...world.counters }).toEqual({ resolve: 0, stat: 0, readBytes: 0 })

      const out = await callReadImage(world.ctx, { file_path: 'red.png', content: `injected-${SENTINEL}`, offset: 3 }, { agent: agentOn(dir, 'vision-model') })
      expect(out.isError, `unknown top-level keys must not break the exact read: ${out.text}`).toBe(false)
      expect(out.text).not.toContain(SENTINEL)
      expect(countObjects(String(world.attachmentsRoot))).toBe(1) // exactly the one object derived from the read bytes
      expect(world.counters.readBytes).toBeGreaterThanOrEqual(1)
    } finally {
      await world.disposeAll()
    }
  })
})
