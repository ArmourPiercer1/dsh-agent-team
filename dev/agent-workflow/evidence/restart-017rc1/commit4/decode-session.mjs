#!/usr/bin/env node
/** decodes one session.v4.jsonl(.zstd) and prints row types + the tool-call /
 *  tool-result / user-message content around a needle. Usage:
 *  node decode-session.mjs <file> [needle] */
import { readFileSync } from 'node:fs'
import { zstdDecompressSync } from 'node:zlib'

const [file, needle] = process.argv.slice(2)
const raw = readFileSync(file)
let text
if (file.endsWith('.zstd')) {
  const ZSTD_MAGIC = 0xfd2fb528
  const frames = []
  let offset = 0
  while (offset < raw.length) {
    const start = offset
    if (raw.length - offset < 4) break
    if (raw.readUInt32LE(offset) !== ZSTD_MAGIC) break
    offset += 4
    if (offset === raw.length) break
    const descriptor = raw.readUInt8(offset)
    offset += 1
    if ((descriptor & 0x18) !== 0) break
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 0x20) !== 0
    const checksum = (descriptor & 0x04) !== 0
    const dictionaryFlag = descriptor & 0x03
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag
    const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
    if (raw.length - offset < remainingHeaderBytes) break
    offset += remainingHeaderBytes
    let complete = false
    for (;;) {
      if (raw.length - offset < 3) break
      const blockHeader = raw.readUIntLE(offset, 3)
      offset += 3
      const lastBlock = (blockHeader & 1) !== 0
      const blockType = (blockHeader >>> 1) & 0x03
      const blockSize = blockHeader >>> 3
      if (blockType === 0x03) break // reserved: unreadable
      const payloadBytes = blockType === 0x01 ? 1 : blockSize
      if (raw.length - offset < payloadBytes) break
      offset += payloadBytes
      if (lastBlock) { complete = true; break }
    }
    if (!complete) break
    if (checksum) {
      if (raw.length - offset < 4) break
      offset += 4
    }
    frames.push([start, offset])
  }
  const parts = []
  for (const [s, e] of frames) { try { parts.push(zstdDecompressSync(raw.subarray(s, e)).toString('utf8')) } catch { /* torn */ } }
  text = parts.join('')
} else {
  text = raw.toString('utf8')
}
const rows = text.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l) } catch { return { _unparsed: l.slice(0, 120) } } })
console.log(`total rows: ${rows.length}`)
rows.forEach((r, i) => {
  const t = r.type ?? r.kind ?? r._unparsed ?? '?'
  let brief = ''
  if (t === 'user/message' || t === 'assistant/message' || t === 'system/message') {
    const c = r.message?.content ?? r.content
    brief = typeof c === 'string' ? c : JSON.stringify(c)
  } else if (t === 'tool/call' || t === 'tool/result') {
    brief = JSON.stringify(r.data ?? r).slice(0, 700)
  } else if (t === 'request/header' || t === 'request/context') {
    brief = JSON.stringify(r).slice(0, 200)
  }
  const hit = needle && JSON.stringify(r).includes(needle)
  console.log(`${String(i).padStart(3)} ${String(t).padEnd(28)} ${hit ? '### ' : ''}${String(brief).slice(0, 220).replace(/\n/g, ' ')}`)
})
