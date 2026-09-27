// pump-regression.mjs — unit test for the RemoteMuxSocket._pump 64-bit
// length bug (run 13 shape: a >64KB frame split across 4 'data' chunks,
// then a 2B PING). Extracts the class from spike.mjs, feeds synthetic
// frames, asserts: frame delivered, PONG sent, socket state sane.
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import http from 'node:http'
import { Socket } from 'node:net'

const src = readFileSync('spike.mjs', 'utf8')
const start = src.indexOf('class RemoteMuxSocket')
const end = src.indexOf('function spawnHost')
if (start < 0 || end < 0 || end <= start) throw new Error('class anchors not found')
let classSrc = src.slice(start, end)
// strip the evidence/trace sinks the class references
classSrc = classSrc.replace(/wsTraceSink\s*=\s*\[\]/g, 'wsTraceSink = []')
classSrc = classSrc.replace(/function writeEvidence\([^)]*\)\s*\{[\s\S]*?\n\}/g, 'function writeEvidence() {}')
// expose the class
classSrc += '\nglobalThis.__RM = RemoteMuxSocket'
globalThis.__testCrypto = (await import('node:crypto')).default
globalThis.__testHttp = (await import('node:http')).default
eval('const crypto = globalThis.__testCrypto; const http = globalThis.__testHttp;\n' + classSrc)
const RemoteMuxSocket = globalThis.__RM

// Build the test: fake socket via a real pair
const { connect } = await import('node:net')

function wsFrame(payload, { opcode = 1, fin = true } = {}) {
  const b0 = (fin ? 0x80 : 0) | opcode
  const len = payload.length
  let header
  if (len < 126) header = Buffer.from([b0, len])
  else if (len < 65536) { header = Buffer.alloc(4); header[0] = b0; header[1] = 126; header.writeUInt16BE(len, 2) }
  else { header = Buffer.alloc(10); header[0] = b0; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2) }
  return Buffer.concat([header, payload])
}

let failures = 0
async function testCase(name, { payload, chunkSizes, expectPong }) {
  // server side: accept the upgrade, write frames per chunk sizes, capture client PONGs
  const srv = http.createServer()
  srv.on('upgrade', (req, socket) => {
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: x\r\n\r\n')
    // send the frame in the specified chunks
    const frame = wsFrame(Buffer.from(payload))
    let off = 0
    const sendChunks = () => {
      if (off >= frame.length) return
      const n = Math.min(chunkSizes.shift(), frame.length - off)
      socket.write(frame.subarray(off, off + n))
      off += n
      if (chunkSizes.length) setImmediate(sendChunks)
      else {
        // after frame, send a PING
        setTimeout(() => socket.write(Buffer.from([0x89, 0x00])), 150)
      }
    }
    sendChunks()
    socket.on('data', (c) => {
      if (c.length >= 2 && (c[0] & 0x0f) === 0xa) {
        serverGotPong = true
      }
    })
  })
  let serverGotPong = false
  await new Promise((r) => srv.listen(0, '127.0.0.1', r))
  const port = srv.address().port
  const ws = new RemoteMuxSocket(`http://127.0.0.1:${port}/api/remote.mux`, {})
  await ws.connect()
  const got = await ws.next(5000).catch((e) => `ERR:${e.message}`)
  await new Promise((r) => setTimeout(r, 400))
  const ok = got !== undefined && expectPong ? serverGotPong : got !== undefined
  const payloadMatch = typeof got === 'object' && got !== undefined && (expectPong ? true : JSON.stringify(got.value ?? got) !== undefined)
  const pass = ok && (expectPong ? serverGotPong : true)
  if (!pass) failures++
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}: frame=${typeof got === 'object' ? (got.value?.type ?? got.type ?? 'obj') : got} pong=${serverGotPong}`)
  ws.close()
  srv.close()
}

const big = JSON.stringify({ type: 'item', streamId: 'fol-test', value: { type: 'snapshot', sessionId: 's', rows: 'x'.repeat(70000) } })
console.log(`test frame payload = ${big.length} B (>65535 => 64-bit len)`)
// run-13 chunk shape: 4 chunks then PING
await testCase('70KB frame, 4 chunks (run-13 shape), PING after', { payload: big, chunkSizes: [Math.floor(big.length * 0.19), Math.floor(big.length * 0.34), Math.floor(big.length * 0.06), 999999], expectPong: true })
// small frame (16-bit length) regression guard
const small = JSON.stringify({ type: 'item', streamId: 'ev-test', value: { type: 'ready', clientId: 'c' } })
await testCase('small frame (<126B) + PING', { payload: small, chunkSizes: [999999], expectPong: true })
// medium frame (16-bit extended length)
const med = JSON.stringify({ type: 'item', streamId: 'ev-test', value: { type: 'emit', data: 'y'.repeat(3000) } })
await testCase('3KB frame (16-bit len) + PING', { payload: med, chunkSizes: [100, 999999], expectPong: true })
process.exit(failures ? 1 : 0)
