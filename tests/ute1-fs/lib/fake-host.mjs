/**
 * fake-host.mjs — a HOST-FREE host surface for the product module's own arms.
 *
 * WHY A DOUBLE IS HONEST HERE: the arms that run on this surface test the
 * BINDING's own decisions (lane containment, scope lifecycle, provider swap,
 * generation pin) — not the host's byte I/O. The real-effect claims are made by
 * the assembly arms on the pinned rc.5 host (`assembly.mjs`), which use the real
 * `LocalFileSystem` and the real executor. This double therefore never stands in
 * for an effect claim: it is an in-memory provider whose only job is to make
 * "did the call reach the base provider?" observable (a Map of files).
 *
 * The double is deliberately shaped like the host's published surface
 * (`processPath`/`stat`/`readText`/`writeText`/…) so the product module's
 * subclass sees the same contract, and `FsError` mirrors the host's typed error
 * (message + closed code) so a refusal is a typed refusal, not a string.
 *
 * @module tests/ute1-fs/lib/fake-host
 */
import { isAbsolute, resolve as resolvePath } from 'node:path'

/** The host's typed error, structurally (message + code). */
export class FakeFsError extends Error {
  constructor(message, code, options) {
    super(message, options)
    this.name = 'FakeFsError'
    this.code = code
  }
}

/** The in-memory provider base the confined class extends. */
export class FakeFileSystem {
  constructor(ctx, config) {
    this.config = config ?? {}
    this.files = (config && config.files) instanceof Map ? config.files : new Map()
    this.calls = []
    // Test-only hook: `park(method, path)` is awaited BEFORE the effect, so an
    // arm can hold an admitted operation inside a provider await (the disposal
    // race). It is never installed by production wiring.
    this.park = typeof config?.park === 'function' ? config.park : undefined
  }

  /** Await the optional park hook (no-op in every non-race arm). */
  async _park(method, path) {
    if (this.park !== undefined) await this.park(method, path)
  }

  resolve(path) {
    return Promise.resolve(isAbsolute(path) ? resolvePath(path) : resolvePath(this.config.cwd ?? '/', path))
  }

  processPath(target) {
    const raw = typeof target === 'string' ? target : String(target?.path ?? target)
    return isAbsolute(raw) ? resolvePath(raw) : resolvePath(this.config.cwd ?? '/', raw)
  }

  contains(parent, child) {
    return this.processPath(child).startsWith(`${this.processPath(parent)}/`)
  }

  async stat(target) {
    this.calls.push('stat')
    const path = this.processPath(target)
    await this._park('stat', path)
    if (!this.files.has(path)) return undefined
    return { path, size: Buffer.byteLength(this.files.get(path), 'utf8') }
  }

  async lstat(path) {
    this.calls.push('lstat')
    return this.stat(path)
  }

  async readText(target) {
    this.calls.push('readText')
    const path = this.processPath(target)
    if (!this.files.has(path)) throw new FakeFsError(`ENOENT: ${path}`, 'FS_NOT_FOUND')
    return this.files.get(path)
  }

  async streamText(target) {
    const text = await this.readText(target)
    return (async function* stream() { yield text })()
  }

  async readBytes(target) {
    this.calls.push('readBytes')
    return Buffer.from(await this.readText(target), 'utf8')
  }

  async readByteRange(target) {
    this.calls.push('readByteRange')
    return Buffer.from(await this.readText(target), 'utf8')
  }

  async listDir(target) {
    this.calls.push('listDir')
    const prefix = `${this.processPath(target)}/`
    return [...this.files.keys()].filter((path) => path.startsWith(prefix))
  }

  async watch() {
    this.calls.push('watch')
    return async () => undefined
  }

  async writeText(target, content) {
    this.calls.push('writeText')
    const path = this.processPath(target)
    await this._park('writeText', path)
    this.files.set(path, String(content))
    return { path: this.processPath(target), bytes: Buffer.byteLength(String(content), 'utf8') }
  }

  async editText(target, edit) {
    this.calls.push('editText')
    const path = this.processPath(target)
    const current = this.files.get(path)
    if (current === undefined) throw new FakeFsError(`ENOENT: ${path}`, 'FS_NOT_FOUND')
    const from = String(edit?.old_string ?? '')
    const to = String(edit?.new_string ?? '')
    if (!current.includes(from)) throw new FakeFsError(`edit target not found in ${path}`, 'FS_EDIT_NOT_FOUND')
    this.files.set(path, current.replace(from, to))
    return { path, bytes: Buffer.byteLength(this.files.get(path), 'utf8') }
  }

  async patchText(target, hunks) {
    const list = Array.isArray(hunks) ? hunks : []
    let current = await this.readText(target)
    for (const hunk of list) current = current.split(String(hunk?.old_string ?? '')).join(String(hunk?.new_string ?? ''))
    this.files.set(this.processPath(target), current)
    return { path: this.processPath(target) }
  }

  async deleteFile(target) {
    this.calls.push('deleteFile')
    await this._park('deleteFile', this.processPath(target))
    this.files.delete(this.processPath(target))
    return { deleted: true }
  }

  async moveFile(source, destination) {
    this.calls.push('moveFile')
    const from = this.processPath(source)
    const to = this.processPath(destination)
    if (!this.files.has(from)) throw new FakeFsError(`ENOENT: ${from}`, 'FS_NOT_FOUND')
    this.files.set(to, this.files.get(from))
    this.files.delete(from)
    return { from, to }
  }
}

/**
 * A Cordis-shaped context double: `isolate(name)` + `plugin()` + `get()`.
 *
 * `failDispose` makes EVERY fiber disposer throw, which is how the release-arm
 * proves a receipt can say `termination-unconfirmed` instead of claiming a
 * release that did not happen.
 */
export function createFakeContext({ failDispose = false } = {}) {
  const state = { pluginCalls: [], services: new Map(), disposeCalls: 0, disposeFailures: 0 }
  return {
    pluginCalls: state.pluginCalls,
    services: state.services,
    get disposeCalls() {
      return state.disposeCalls
    },
    get disposeFailures() {
      return state.disposeFailures
    },
    isolate(name) {
      const scoped = {
        plugin: async (plugin, config) => {
          state.pluginCalls.push({ name, plugin, config })
          // Only a PROVIDER CLASS provides the isolated service. A tool module is
          // a plugin object: it registers tools, not `fs`, so it must not
          // overwrite the provider the binding just mounted.
          if (typeof plugin === 'function') state.services.set(name, new plugin(scoped, config))
          return {
            dispose: async () => {
              state.disposeCalls += 1
              if (failDispose) {
                state.disposeFailures += 1
                throw new Error(`fiber-dispose-failed:${name}`)
              }
            },
          }
        },
        get: (serviceName) => (serviceName === name ? state.services.get(name) : undefined),
      }
      return scoped
    },
  }
}

/** A host surface with the given generation (defaults to the rc.5 pin). */
export function createFakeHost({ generation = '0.2.2-rc.5', files = new Map(), park } = {}) {
  class FileSystem extends FakeFileSystem {
    constructor(ctx, config) {
      super(ctx, { ...(config ?? {}), files, park })
    }
  }
  return Object.freeze({
    generation,
    LocalFileSystem: FileSystem,
    FsError: FakeFsError,
    toolFs: Object.freeze({ name: 'fake-tool-fs', apply: () => undefined }),
    files,
  })
}
