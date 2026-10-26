/**
 * fs-family/src/image-read-port.mjs — the governed `read_image` row's
 * POST-CONSUME bounded byte-read port (U7-9a). This is the family lane's
 * composition of the reviewed controlled-fs primitives into the exact law
 * the read row already carries at its own effect, re-cut for the image
 * row's read effect:
 *
 *   resolve (realpath/alias law) → ANCHOR-DRIFT agreement with the
 *   approved lexical target → lstat identity snapshot →
 *   `O_RDONLY | O_NOFOLLOW` open → `verifyOpenedHandle` (fd containment +
 *   fstat drift, escape/drift/undeterminable all refused BEFORE any byte)
 *   → cap+1 metered ring on the SAME verified fd (cumulative ACTUAL
 *   bytesRead; the buffer never exceeds cap+1; overshoot is MEASURED and
 *   returned as the fact, the caller refuses whole) → one close owner.
 *
 * It runs ONLY after the Kernel's PA edge consumed the grant (the executor
 * guarantees that ordering); it consumes nothing and holds no state.
 *
 * @module fs-family/image-read-port
 */
import { statSync, constants as fsConstants } from 'node:fs'
import { open as fsOpen } from 'node:fs/promises'
import { Buffer } from 'node:buffer'
import { verifyOpenedHandle } from '../../../runtime/controlled-fs/src/index.js'
import { resolveAnchoredPath } from './fs-mechanics.mjs'

const CHUNK_BYTES = 64 * 1024

/**
 * Build the bounded read port for one mount root.
 *
 * @param {object} input
 * @param {string} input.rootDir - the controlled-fs instance root.
 * @param {(line: string) => void} [input.observe]
 * @returns {(i: {canonicalLocator: string, maxBytes: number, signal?: {aborted?: boolean}})
 *   => Promise<{ok: true, byteLength: number, bytes: Uint8Array} | {ok: false, code: string, detail: string}>}
 */
export function createBoundedImageReadPort({ rootDir, observe = () => {} }) {
  return async ({ canonicalLocator, maxBytes, signal }) => {
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
      return { ok: false, code: 'CAP-INVALID', detail: 'the byte cap must be a positive safe integer' }
    }
    const resolved = resolveAnchoredPath(rootDir, canonicalLocator)
    if (!resolved.ok) {
      return { ok: false, code: String(resolved.code), detail: String(resolved.detail) }
    }
    if (resolved.path !== canonicalLocator) {
      observe(`governed-image anchor-drift lex=${canonicalLocator} real=${resolved.path}`)
      return { ok: false, code: 'ANCHOR-DRIFT', detail: 'the resolved target differs from the approved lexical target; this call is stale and reads zero bytes' }
    }
    if (signal?.aborted === true) {
      return { ok: false, code: 'CANCELLED', detail: 'the invocation was cancelled before the open — zero bytes' }
    }
    let stat
    try {
      stat = statSync(resolved.path)
    } catch {
      return { ok: false, code: 'target-unreadable', detail: 'the anchored target could not be stat-ed' }
    }
    if (!stat.isFile()) {
      return { ok: false, code: 'not-a-file', detail: 'the governed image read is a file effect, never a directory walk' }
    }
    let handle
    try {
      handle = await fsOpen(resolved.path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW)
    } catch (error) {
      const code = String(error?.code ?? '')
      if (code === 'ELOOP') return { ok: false, code: 'symlink-alias', detail: 'the OS refused the open (ELOOP): symlink alias' }
      if (code === 'ENOENT') return { ok: false, code: 'target-unreadable', detail: 'the object does not exist at open time' }
      if (code === 'EISDIR') return { ok: false, code: 'not-a-file', detail: 'the governed image read is a file effect, never a directory walk' }
      return { ok: false, code: 'open-failed', detail: code.slice(0, 80) }
    }
    try {
      const snapshot = { dev: Number(stat.dev), ino: Number(stat.ino), size: stat.size, mtimeMs: stat.mtimeMs }
      const recheck = await verifyOpenedHandle(handle, resolved.rootReal, snapshot)
      if (recheck.verdict !== 'confirmed') {
        const detail = recheck.verdict === 'escape'
          ? `exec-time re-read: the fd resolved to ${recheck.resolvedPath} — OUTSIDE the governed anchor`
          : recheck.verdict === 'drift'
            ? `snapshot ${String(recheck.snapshot.dev)}:${String(recheck.snapshot.ino)} != opened ${String(recheck.actual.dev)}:${String(recheck.actual.ino)}`
            : recheck.detail
        observe(`governed-image exec-refused:${recheck.verdict} path=${resolved.path}`)
        return { ok: false, code: `exec-time-${recheck.verdict}`, detail: `${String(detail).slice(0, 200)}; zero bytes disclosed` }
      }
      const chunk = Buffer.alloc(CHUNK_BYTES)
      const parts = []
      let total = 0
      while (total < maxBytes + 1) {
        if (signal?.aborted === true) {
          return { ok: false, code: 'CANCELLED', detail: `the invocation was cancelled mid-read after ${String(total)} observed bytes — the partial buffer is dropped, nothing is stored` }
        }
        const want = Math.min(CHUNK_BYTES, maxBytes + 1 - total)
        const { bytesRead } = await handle.read(chunk, 0, want, total)
        if (bytesRead === 0) break
        parts.push(Buffer.from(chunk.subarray(0, bytesRead)))
        total += bytesRead
      }
      // Overshoot (total > maxBytes) is returned as the MEASURED fact with
      // the bytes: the caller refuses whole. The metering never truncates.
      return { ok: true, byteLength: total, bytes: Buffer.concat(parts, total) }
    } finally {
      await handle.close().catch(() => undefined)
    }
  }
}
