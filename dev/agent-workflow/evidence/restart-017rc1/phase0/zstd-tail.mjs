// zstd-tail.mjs — decode a multi-frame zstd session log, print row count + tail.
// Usage: node zstd-tail.mjs <session.v4.jsonl.zstd> [tailN]
// scanZstdFrames: verbatim port from spike.mjs (upstream scanZstdFrames).
import { readFileSync } from 'node:fs'
import { zstdDecompressSync } from 'node:zlib'

const ZSTD_MAGIC = 0xfd2fb528
function scanZstdFrames(buffer) {
  const frames = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 4) break
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) break
    offset += 4
    if (offset === buffer.length) break
    const descriptor = buffer.readUInt8(offset)
    offset += 1
    if ((descriptor & 0x18) !== 0) break
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 0x20) !== 0
    const checksum = (descriptor & 0x04) !== 0
    const dictionaryFlag = descriptor & 0x03
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
    const contentSizeBytes = contentSizeFlag === 0
      ? (singleSegment ? 1 : 0)
      : 1 << contentSizeFlag
    const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
    if (buffer.length - offset < remainingHeaderBytes) break
    offset += remainingHeaderBytes
    let complete = false
    for (;;) {
      if (buffer.length - offset < 3) break
      const blockHeader = buffer.readUIntLE(offset, 3)
      offset += 3
      const lastBlock = (blockHeader & 1) !== 0
      const blockType = (blockHeader >>> 1) & 0x03
      const blockSize = blockHeader >>> 3
      if (blockType === 0x03) break
      const payloadBytes = blockType === 0x01 ? 1 : blockSize
      if (buffer.length - offset < payloadBytes) break
      offset += payloadBytes
      if (lastBlock) { complete = true; break }
    }
    if (!complete) break
    if (checksum) {
      if (buffer.length - offset < 4) break
      offset += 4
    }
    frames.push({ start, end: offset })
  }
  return frames
}

const path = process.argv[2]
const tailN = Number(process.argv[3] ?? 8)
const raw = readFileSync(path)
const ranges = scanZstdFrames(raw)
const parts = []
for (const r of ranges) {
  try { parts.push(zstdDecompressSync(raw.subarray(r.start, r.end)).toString('utf8')) }
  catch { break }
}
const rows = []
for (const line of parts.join('').split('\n')) if (line.trim()) {
  try { rows.push(JSON.parse(line)) } catch { rows.push({ _raw: line.slice(0, 80) }) }
}
console.log(`frames=${ranges.length} total rows: ${rows.length}`)
for (const r of rows.slice(-tailN)) console.log(JSON.stringify(r).slice(0, 240))
