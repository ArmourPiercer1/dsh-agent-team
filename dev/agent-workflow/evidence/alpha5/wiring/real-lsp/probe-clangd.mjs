/**
 * probe-clangd — UNCONFINED candidate probe (probe-only, NOT the acceptance
 * leg). Purpose: establish that /usr/bin/clangd answers the real LSP
 * handshake with its real capabilities and returns a real semantic result,
 * so the CONFINED acceptance legs later can be compared against the same
 * server's unconfined answers.
 *
 * Run: node dev/agent-workflow/evidence/alpha5/wiring/real-lsp/probe-clangd.mjs [workdir]
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, realpathSync } from 'node:fs'
import { join } from 'node:path'

const world = process.argv[2] ?? '/tmp/a5reallsp-probe'
mkdirSync(world, { recursive: true })

const SRC = `/* a5reallsp real project */
int compute_answer(void) {
  return 42;
}

int main(void) {
  int the_result = compute_answer();
  return the_result;
}
`
const file = join(world, 'main.c')
writeFileSync(file, SRC)
const uri = `file://${file}`
// byte offset of the call site `compute_answer()` inside main()
const callIdx = SRC.lastIndexOf('compute_answer')
const line = SRC.slice(0, callIdx).split('\n').length - 1
const character = callIdx - (SRC.lastIndexOf('\n', callIdx - 1) + 1)
console.log(`call site: line=${line} character=${character}`)

const child = spawn('/usr/bin/clangd', ['--background-index=false', '--pch-storage=memory', '--enable-config=false', '--log=error', '--limit-results=20'], { stdio: ['pipe', 'pipe', 'pipe'] })
let buf = ''
const pending = new Map()
let note = 0
child.stdout.on('data', (c) => {
  buf += c.toString('utf8')
  for (;;) {
    const h = buf.indexOf('\r\n\r\n')
    if (h < 0) break
    const head = buf.slice(0, h)
    const m = /Content-Length: (\d+)/i.exec(head)
    if (!m) { buf = buf.slice(h + 4); continue }
    const len = Number(m[1])
    if (buf.length < h + 4 + len) return
    const body = buf.slice(h + 4, h + 4 + len)
    buf = buf.slice(h + 4 + len)
    let msg
    try { msg = JSON.parse(body) } catch { continue }
    if (typeof msg.id === 'number' && pending.has(msg.id)) {
      const r = pending.get(msg.id)
      pending.delete(msg.id)
      r(msg)
    } else {
      note++
      if (process.env.VERBOSE) console.log('NOTE', body.slice(0, 300))
    }
  }
})
child.stderr.on('data', (c) => { if (process.env.VERBOSE) process.stderr.write(String(c)) })
child.on('exit', (code, sig) => console.log(`clangd exited code=${String(code)} signal=${String(sig)}`))

function send(obj) {
  const json = JSON.stringify(obj)
  const bytes = Buffer.byteLength(json, 'utf8')
  child.stdin.write(`Content-Length: ${bytes}\r\n\r\n${json}`)
}
function request(id, method, params) {
  return new Promise((resolve, reject) => {
    pending.set(id, resolve)
    send({ jsonrpc: '2.0', id, method, params })
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(`timeout ${method}`)) } }, 25_000)
  })
}

const init = await request(1, 'initialize', {
  processId: process.pid,
  clientInfo: { name: 'a5reallsp-probe', version: '0' },
  rootUri: `file://${world}`,
  workspaceFolders: [{ uri: `file://${world}`, name: 'w' }],
  capabilities: {
    textDocument: {
      definition: { linkSupport: true },
      hover: { contentFormat: ['markdown', 'plaintext'] },
      completion: { completionItem: { snippetSupport: false } },
    },
    workspace: { configuration: true },
  },
})
const caps = init.result?.capabilities
console.log('serverInfo:', JSON.stringify(init.result?.serverInfo))
console.log('capability keys:', caps ? Object.keys(caps).sort().join(',') : 'NONE')
console.log('definitionProvider:', JSON.stringify(caps?.definitionProvider), 'hoverProvider:', JSON.stringify(caps?.hoverProvider), 'completionProvider:', JSON.stringify(caps?.completionProvider ? Object.keys(caps.completionProvider) : null))

send({ jsonrpc: '2.0', method: 'initialized', params: {} })
send({ jsonrpc: '2.0', method: 'textDocument/didOpen', params: { textDocument: { uri, languageId: 'c', version: 1, text: SRC } } })
await new Promise((r) => setTimeout(r, 1500))

const def = await request(2, 'textDocument/definition', {
  textDocument: { uri },
  position: { line, character },
})
console.log('DEFINITION RESULT:', JSON.stringify(def.result))

const hov = await request(3, 'textDocument/hover', {
  textDocument: { uri },
  position: { line, character },
})
console.log('HOVER RESULT:', JSON.stringify(hov.result).slice(0, 500))

const comp = await request(4, 'textDocument/completion', {
  textDocument: { uri },
  position: { line: 5, character: 1 },
})
const items = Array.isArray(comp.result?.items) ? comp.result.items : Array.isArray(comp.result) ? comp.result : []
console.log('COMPLETION count:', items.length, 'first:', JSON.stringify(items.slice(0, 5).map((i) => i.label)))

await request(5, 'shutdown', null)
send({ jsonrpc: '2.0', method: 'exit', params: {} })
child.stdin.end()
console.log('PROBE DONE')
