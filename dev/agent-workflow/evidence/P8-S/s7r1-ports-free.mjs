// Scratch port-free checker for the S7R1 live battery (delete after use).
// A port is BUSY when a TCP connect to 127.0.0.1:port succeeds; FREE on
// ECONNREFUSED / unreachable. Exit 0 when every listed port is free.
import net from 'node:net'

const PORTS = process.argv.slice(2).map((s) => Number.parseInt(s, 10))

function probe(port) {
  return new Promise((resolve) => {
    const sock = new net.Socket()
    sock.setTimeout(1500)
    const done = (busy) => {
      sock.removeAllListeners()
      sock.destroy()
      resolve(busy)
    }
    sock.once('connect', () => done(true))
    sock.once('timeout', () => done(false))
    sock.once('error', () => done(false))
    sock.connect(port, '127.0.0.1')
  })
}

const results = await Promise.all(PORTS.map(async (port) => [port, await probe(port)]))
const busy = results.filter(([, b]) => b)
for (const [port, b] of results) {
  console.log(`port ${port}: ${b ? 'BUSY' : 'free'}`)
}
console.log(busy.length === 0 ? 'ALL-FREE' : `BUSY-PORTS=${busy.map(([p]) => p).join(',')}`)
process.exitCode = busy.length === 0 ? 0 : 1
