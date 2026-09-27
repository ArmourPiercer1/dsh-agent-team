// waitfor-regression.mjs — unit test for the RUN-19 microtask-starvation bug
// in waitForEventFrame (spike.mjs).
//
// Bug: waitForEventFrame re-queued a non-matching frame and then called
// ws.next(), which resolves queued frames as IMMEDIATE microtasks
// (RemoteMuxSocket.next: `if (this.frames.length > 0) return
// Promise.resolve(this.frames.shift())`). The same frame was therefore
// re-yielded forever: a microtask loop that starves the socket pump, all
// timers and the event loop for the entire wait window (observed: 30.1s
// of ~10x CPU in runs 14-18; v8 --prof hot frames = waitForEventFrame /
// isTarget / StringEqual / ArrayPrototypeUnshift / promise plumbing).
//
// Test: a non-matching frame sits in the queue while the waiter is armed;
// the matching frame arrives 300 ms later on the socket. The wait must
// return the match in well under the timeout, and the non-matching frame
// must be preserved (FIFO) for a later waiter.
import { readFileSync } from 'node:fs'
import http from 'node:http'

const src = readFileSync('spike.mjs', 'utf8')
const start = src.indexOf('class RemoteMuxSocket')
const end = src.indexOf('async function fenceHealth')
if (start < 0 || end < 0 || end <= start) throw new Error('anchors not found')
let slice = src.slice(start, end)
// stub the evidence sink in place (mirrors pump-regression.mjs) so class
// code paths that flush it never touch EVIDENCE_DIR (outside the slice)
slice = slice.replace(/function writeEvidence\([^)]*\)\s*\{[\s\S]*?\n\}/g, 'function writeEvidence() {}')
globalThis.__testCrypto = (await import('node:crypto')).default
globalThis.__testHttp = (await import('node:http')).default
eval('const crypto = globalThis.__testCrypto; const http = globalThis.__testHttp;' +
  'const wsTraceSink = [];' +
  "const BP_ANCHOR_ID = 'test-anchor';" +
  "const BP_MAIN_ID = 'test-main';" +
  "const RUN_STAMP = 'test';" +
  "const P_BOOT = 'test-boot-persona';" +
  "const P_DYN = 'test-dyn-persona';" +
  slice +
  '\nglobalThis.__RM = RemoteMuxSocket; globalThis.__WFE = waitForEventFrame')
const RemoteMuxSocket = globalThis.__RM
const waitForEventFrame = globalThis.__WFE

// ---- synthetic WS frame builder (server -> client: unmasked) ----
function wsFrame(payloadBuf, { opcode = 0x1, fin = true } = {}) {
  const len = payloadBuf.length
  let header
  if (len < 126) header = Buffer.from([(fin ? 0x80 : 0) | opcode, len])
  else if (len < 65536) {
    header = Buffer.alloc(4)
    header[0] = (fin ? 0x80 : 0) | opcode
    header[1] = 126
    header.writeUInt16BE(len, 2)
  } else {
    header = Buffer.alloc(10)
    header[0] = (fin ? 0x80 : 0) | opcode
    header[1] = 127
    header.writeBigUInt64BE(BigInt(len), 2)
  }
  return Buffer.concat([header, payloadBuf])
}

// ---- server: one non-matching frame now, match + foreign frame at +300ms ----
const server = http.createServer()
server.on('upgrade', (req, socket) => {
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: Pseudo\r\n\r\n')
  const send = (obj) => socket.write(wsFrame(Buffer.from(JSON.stringify(obj), 'utf8')))
  send({ streamId: 's1', type: 'item', value: { type: 'emit', kind: 'other', n: 1 } })
  setTimeout(() => {
    send({ streamId: 's2', type: 'item', value: { type: 'emit', kind: 'other', n: 2 } })
    send({ streamId: 's1', type: 'item', value: { type: 'emit', kind: 'target', n: 3 } })
  }, 300)
  setTimeout(() => socket.destroy(), 6000)
})
await new Promise((res) => server.listen(3501, '127.0.0.1', res))

const ws = new RemoteMuxSocket('ws://127.0.0.1:3501/mux', { timeoutMs: 5000 })
ws.label = 'waitfor-test'
await ws.connect()

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures += 1
}

// 1) waiter armed while a non-matching frame is queued; match arrives at +300ms.
const t0 = Date.now()
const got = await waitForEventFrame(ws, 's1', (v) => v.kind === 'target', 5000)
const elapsed = Date.now() - t0
check('returns the matching frame', got?.value?.kind === 'target', `kind=${got?.value?.kind} stream=${got?.streamId}`)
check('resolves in ~300ms, not the 5s timeout (no starvation spin)', elapsed < 2500, `elapsed=${elapsed}ms`)
const q = ws.frames.map((f) => [f.streamId, f.value?.type, f.value?.kind, f.value?.n])
check('non-matching s1 frame preserved in queue (FIFO)',
  ws.frames.some((f) => f.streamId === 's1' && f.value?.kind === 'other' && f.value.n === 1),
  `queue=${JSON.stringify(q)}`)
check('foreign-stream frame preserved too',
  ws.frames.some((f) => f.streamId === 's2' && f.value?.kind === 'other'),
  `queueLen=${ws.frames.length}`)
// 2) a later waiter for the preserved frame gets it (no data loss).
const t1 = Date.now()
const got2 = await waitForEventFrame(ws, 's1', (v) => v.kind === 'other' && v.n === 1, 2000)
check('later waiter receives the preserved frame', got2?.value?.n === 1, `elapsed=${Date.now() - t1}ms`)

ws.close()
server.close()
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
