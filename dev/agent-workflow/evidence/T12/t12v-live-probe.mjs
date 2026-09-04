// t12v-live-probe.mjs — read-only live probe against a running T12V world.
// Usage: node t12v-live-probe.mjs <port> <instanceLogPath>
// Re-authenticates via the boot marker token, then dumps /__p6t6/state.
import fs from 'node:fs'
import http from 'node:http'

const port = Number(process.argv[2])
const logPath = process.argv[3]
if (!port || !logPath) {
  console.error('usage: node t12v-live-probe.mjs <port> <instanceLogPath>')
  process.exit(2)
}

const lines = fs.readFileSync(logPath, 'utf8').split(/\r?\n/).filter((l) => l.includes('token='))
if (lines.length === 0) {
  console.error('no boot marker found in', logPath)
  process.exit(2)
}
const tok = lines[lines.length - 1].match(/token=([A-Za-z0-9_-]+)/)?.[1]
if (!tok) {
  console.error('could not parse token from last marker line:', lines[lines.length - 1].slice(0, 80))
  process.exit(2)
}

function req(path, headers) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, path, headers }, (resp) => {
      let d = ''
      resp.on('data', (c) => (d += c))
      resp.on('end', () => resolve({ status: resp.statusCode, headers: resp.headers, body: d }))
    })
    r.on('error', reject)
    r.end()
  })
}

try {
  const ex = await req('/?token=' + tok)
  console.log('exchange status:', ex.status)
  const cookie = (ex.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ')
  if (!cookie) {
    console.error('no set-cookie on exchange; body:', ex.body.slice(0, 200))
    process.exit(2)
  }
  const st = await req('/__p6t6/state', { Cookie: cookie })
  console.log('state status:', st.status)
  console.log(st.body.slice(0, 4000))
} catch (e) {
  console.error('ERR', e.message)
  process.exit(1)
}
