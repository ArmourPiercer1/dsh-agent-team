/**
 * Source-level self-test for the C2 driver's session-log reader — no host, no
 * world, no boot. It pins the matrix lesson the reader exists because of: a log
 * file with MORE THAN ONE zstd frame (what a restarted session writes) must
 * yield every frame, while a single whole-buffer decompress is not trusted to
 * do so.
 */
import { zstdCompressSync, zstdDecompressSync } from 'node:zlib'
import { decodeSessionLogFrames } from './a5m2-team-c2-runner.mjs'

const first = Buffer.from('{"line":"frame-one"}\n')
const second = Buffer.from('{"line":"frame-two"}\n')
const log = Buffer.concat([zstdCompressSync(first), zstdCompressSync(second)])

let wholeFileDecode
try {
  wholeFileDecode = { ok: true, text: zstdDecompressSync(log).toString('utf8') }
} catch (error) {
  wholeFileDecode = { ok: false, error: String(error?.code ?? error?.message ?? error).slice(0, 60) }
}

const frames = decodeSessionLogFrames(log).toString('utf8')
const result = {
  framesInLog: 2,
  bytes: log.length,
  wholeFileDecode,
  frameSegmentedRecoversBoth: frames.includes('frame-one') && frames.includes('frame-two'),
}
console.log(JSON.stringify(result, null, 2))
process.exitCode = result.frameSegmentedRecoversBoth ? 0 : 1
