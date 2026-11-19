/**
 * prototype-provider.mjs — the G1-FS prototype's confined FS Provider adapter.
 *
 * WHAT THIS IS (and is not): a NEW, additive provider class that subclasses the
 * pinned next host's own `LocalFileSystem` (public package
 * `@deepseek-ai/dsh-fs-local`) and adds exactly ONE decision — the declared
 * read/write lane — in front of every target-bearing operation. It does not
 * re-implement byte I/O, atomic publication, version guards, diff bases or
 * symlink handling: every admitted call is `super.<method>`, so the effect is
 * the host's own effect and the prototype cannot "pass" by simulating one.
 *
 * This is the prototype's *public seam only*: `FileSystem` (the host's abstract
 * service), `FsError` (its closed code vocabulary) and the real provider class.
 * No host source is imported from `src/`, no host file is written.
 *
 * THE CONTAINMENT LAW (same shape as the legacy governed provider, deliberately):
 *   - `resolve()` is UNGUARDED (resolution only, no byte effect). Guarding it
 *     would make a create in a write-only lane impossible and would diverge
 *     from the old path, whose provider also leaves resolution unguarded.
 *   - read methods (`stat`/`lstat`/`readText`/`streamText`/`readBytes`/
 *     `readByteRange`/`listDir`/`watch`) require the READ lane.
 *   - `writeText` requires the WRITE lane; when the target already exists it
 *     ALSO requires the READ lane (the native read-then-write contract of the
 *     governed path, `write ⇒ read`).
 *   - `editText`/`patchText`/`deleteFile`/`moveFile` require WRITE and, because
 *     they only ever act on existing content, READ.
 *   - containment is evaluated on `processPath(target)` — the provider-resolved
 *     canonical host path, never the authored string — so an in-lane symlink
 *     that points outside the lane is refused.
 *
 * TWO DISCLOSED DELTAS VS THE OLD PATH (both measured, neither hidden):
 *   1. the refusal codes are the host's (`FS_PERMISSION_DENIED` /
 *      `FS_NOT_OBSERVED`), not the Team guard's `IO_*` codes. The corpus
 *      compares refusal CLASSES, and records the observed code verbatim.
 *      `FS_SANDBOX_DENIED` is deliberately NOT used: rc.5's `tool-fs` assumes
 *      that code can only come from an `fs-sandbox` backend with a resolved
 *      sandbox policy and dereferences `policy.mode` when it sees one
 *      (`sandbox.ts:139-143`, measured crash on this prototype). Claiming to be
 *      that backend would be a false capability claim, so this lane provider
 *      says `FS_PERMISSION_DENIED` and the evidence states the difference.
 *   2. `deleteFile`/`moveFile` ARE lane-guarded here. The legacy governed
 *      provider overrides only `writeText`/`editText` (measured: no
 *      `deleteFile` override in `team-services/src/fs.ts`), and the FS tool
 *      family exposes no model-facing delete/move tool at all — so there is no
 *      old-path vector to be equivalent to. The gap is recorded, not papered
 *      over; see the memo.
 *
 * @module tests/ute-g1-fs/lib/prototype-provider
 */
import { isAbsolute, resolve as resolvePath } from 'node:path'

import { REFUSAL, withinAny } from './lane.mjs'

/** The guard methods and the axis each one consults. */
const READ_METHODS = Object.freeze([
  'stat', 'readText', 'streamText', 'readBytes', 'readByteRange', 'listDir', 'watch',
])

/**
 * Build one confined provider class over a given host provider base.
 *
 * @param {Function} Base - the host's `LocalFileSystem` class (public package).
 * @param {object} options
 * @param {import('./lane.mjs').declaredLane extends (...a: never[]) => infer R ? R : never | {read: readonly string[], write: readonly string[]}} options.lane
 * @param {new (message: string, code: string, options?: ErrorOptions) => Error} options.FsError
 *   the host's typed error class; the prototype never invents an error type.
 * @param {(fact: object) => void} [options.record] - optional decision recorder.
 * @param {string} [options.label] - name used in refusal messages.
 * @returns {Function} a provider class Cordis can mount as the `fs` service.
 */
export function makeConfinedFileSystemClass(Base, { lane, FsError, record = () => {}, label = 'ute-g1-fs' }) {
  if (typeof Base !== 'function') throw new TypeError('makeConfinedFileSystemClass: Base must be a provider class')
  if (typeof FsError !== 'function') throw new TypeError('makeConfinedFileSystemClass: FsError must be the host FsError class')
  const declared = Object.freeze({
    read: Object.freeze([...lane.read]),
    write: Object.freeze([...lane.write]),
  })

  return class ConfinedFileSystem extends Base {
    constructor(ctx, config) {
      super(ctx, config)
      /** Every lane decision this instance made, in call order (evidence only). */
      this.laneFacts = []
    }

    /** Record and raise one typed refusal. (Plain methods, not `#private`: a
     * Cordis service instance is a Proxy, and a private brand check rejects the
     * proxy receiver — measured as `Receiver must be an instance of class …`.) */
    laneRefuse(method, axis, hostPath, refusal) {
      const fact = Object.freeze({ method, axis, path: hostPath, refusal, decision: 'deny', label })
      this.laneFacts.push(fact)
      record(fact)
      const code = refusal === REFUSAL.WRITE_REQUIRES_READ ? 'FS_NOT_OBSERVED' : 'FS_PERMISSION_DENIED'
      throw new FsError(
        `${label}: ${refusal} — '${method}' on ${JSON.stringify(hostPath)} is outside the declared ${axis} lane`,
        code,
      )
    }

    /** Admit one target operation on one axis (or throw). */
    laneAdmit(method, axis, hostPath) {
      const roots = axis === 'read' ? declared.read : declared.write
      if (withinAny(roots, hostPath)) {
        const fact = Object.freeze({ method, axis, path: hostPath, refusal: null, decision: 'allow', label })
        this.laneFacts.push(fact)
        record(fact)
        return
      }
      this.laneRefuse(method, axis, hostPath, axis === 'read' ? REFUSAL.LANE_READ : REFUSAL.LANE_WRITE)
    }

    /** Write on an EXISTING target also requires read coverage (write ⇒ read). */
    async laneAdmitExistingMutation(method, target, signal) {
      const hostPath = this.processPath(target)
      this.laneAdmit(method, 'write', hostPath)
      let info
      try {
        info = await super.stat(target, signal)
      } catch {
        // A stat failure is not evidence of absence; fail closed on the read axis.
        this.laneRefuse(method, 'read', hostPath, REFUSAL.WRITE_REQUIRES_READ)
      }
      if (info !== undefined && !withinAny(declared.read, hostPath)) {
        this.laneRefuse(method, 'read', hostPath, REFUSAL.WRITE_REQUIRES_READ)
      }
    }

    // ── read axis ──────────────────────────────────────────────────────────
    async stat(target, signal) {
      this.laneAdmit('stat', 'read', this.processPath(target))
      return super.stat(target, signal)
    }

    async lstat(path, opts, signal) {
      // `lstat` is deliberately path-shaped and does not follow the final
      // component: the guarded object is the path itself, so containment is
      // evaluated on the absolute path (a link's own metadata lives in-lane;
      // it discloses no target content).
      const hostPath = isAbsolute(path) ? resolvePath(path) : resolvePath(opts?.cwd ?? this.config?.cwd ?? process.cwd(), path)
      this.laneAdmit('lstat', 'read', hostPath)
      return super.lstat(path, opts, signal)
    }

    async readText(target, signal) {
      this.laneAdmit('readText', 'read', this.processPath(target))
      return super.readText(target, signal)
    }

    async streamText(target, signal) {
      this.laneAdmit('streamText', 'read', this.processPath(target))
      return super.streamText(target, signal)
    }

    async readBytes(target, signal, maxBytes) {
      this.laneAdmit('readBytes', 'read', this.processPath(target))
      return super.readBytes(target, signal, maxBytes)
    }

    async readByteRange(target, range, signal) {
      this.laneAdmit('readByteRange', 'read', this.processPath(target))
      return super.readByteRange(target, range, signal)
    }

    async listDir(target, signal) {
      this.laneAdmit('listDir', 'read', this.processPath(target))
      return super.listDir(target, signal)
    }

    async watch(target, changed, signal) {
      this.laneAdmit('watch', 'read', this.processPath(target))
      return super.watch(target, changed, signal)
    }

    // ── write axis ─────────────────────────────────────────────────────────
    async writeText(target, content, expected, signal, sandboxPolicy) {
      await this.laneAdmitExistingMutation('writeText', target, signal)
      return super.writeText(target, content, expected, signal, sandboxPolicy)
    }

    async editText(target, edit, expected, signal, sandboxPolicy) {
      await this.laneAdmitExistingMutation('editText', target, signal)
      return super.editText(target, edit, expected, signal, sandboxPolicy)
    }

    async patchText(target, hunks, expected, signal, sandboxPolicy) {
      await this.laneAdmitExistingMutation('patchText', target, signal)
      return super.patchText(target, hunks, expected, signal, sandboxPolicy)
    }

    async deleteFile(target, expected, signal, sandboxPolicy) {
      await this.laneAdmitExistingMutation('deleteFile', target, signal)
      return super.deleteFile(target, expected, signal, sandboxPolicy)
    }

    async moveFile(source, destination, options, signal, sandboxPolicy) {
      await this.laneAdmitExistingMutation('moveFile', source, signal)
      this.laneAdmit('moveFile', 'write', this.processPath(destination))
      return super.moveFile(source, destination, options, signal, sandboxPolicy)
    }
  }
}

/** The method→axis table, exported for the memo/evidence renderer. */
export const PROTOTYPE_GUARD_TABLE = Object.freeze({
  ungurarded: Object.freeze(['resolve']),
  read: READ_METHODS,
  write: Object.freeze(['writeText']),
  writeAndReadWhenExisting: Object.freeze(['editText', 'patchText', 'deleteFile', 'moveFile']),
})
