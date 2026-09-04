// redact-tokens.mjs — R125 precedent: token-redacted evidence archive.
// Rewrites REAL process tokens / auth cookies in the D5 evidence capture
// files to ***REDACTED*** (the world dirs keep the originals). Kit source
// files (d5-boot.mjs etc.) are untouched — only captured logs/state.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const EV = fileURLToPath(new URL('.', import.meta.url))
const files = [
  ...readdirSync(EV).filter((f) => f.startsWith('d5-boot-') && f.endsWith('.log')).map((f) => join(EV, f)),
  ...readdirSync(EV).filter((f) => f.startsWith('d5-state-') && f.endsWith('.json')).map((f) => join(EV, f)),
  ...readdirSync(join(EV, 'instances')).filter((f) => f.endsWith('.log')).map((f) => join(EV, 'instances', f)),
  join(EV, 'browser', 'gentry-trace.json'),
]
let changes = 0
for (const p of files) {
  const before = readFileSync(p, 'utf8')
  let after = before
  after = after.replace(/token=([A-Za-z0-9_-]{16,})/g, 'token=***REDACTED***')
  after = after.replace(/"token":\s*"[A-Za-z0-9_-]{16,}"/g, '"token": "***REDACTED***"')
  after = after.replace(/"cookie":\s*"(dsh-auth-[^"]*)"/g, '"cookie": "***REDACTED***"')
  if (after !== before) {
    writeFileSync(p, after)
    changes++
    console.log(`redacted: ${p}`)
  }
}
console.log(`files changed: ${changes}`)
// verify: no residual real tokens in the scanned set
for (const p of files) {
  const t = readFileSync(p, 'utf8')
  const residual = t.match(/token=[A-Za-z0-9_-]{16,}/g)
  if (residual) console.log(`RESIDUAL in ${p}: ${residual.length}`)
}
console.log('verify done')
