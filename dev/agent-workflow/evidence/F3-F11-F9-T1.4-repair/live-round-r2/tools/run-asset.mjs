// run-asset.mjs — exact-arg invocation wrapper for the committed acceptance assets.
// Avoids the shell-quoting class of failures (round r1 f9-pending: pwsh double-quote
// mangling of --json). Args reach node verbatim as an argv array.
//
// usage: node run-asset.mjs <script.mjs> [arg...]
//   An arg of the form @C:\path\to\file (absolute, starting with @) is replaced by
//   the file's literal content (single argv element) — use for JSON option strings,
//   which the session transport would otherwise mangle.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const [script, ...rawArgs] = process.argv.slice(2)
if (!script) {
  console.error('usage: node run-asset.mjs <script.mjs> [arg...]  (@file args are expanded)')
  process.exit(2)
}
const args = rawArgs.map((a) =>
  a.startsWith('@') && /^[A-Za-z]:[\\/]/.test(a.slice(1))
    ? readFileSync(a.slice(1), 'utf8')
    : a)
console.log(`[run-asset] node ${script} ${args.map((a) => JSON.stringify(a)).join(' ')}`)
const r = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit' })
process.exit(r.status ?? 1)
