#!/usr/bin/env node
/**
 * Evidence copier + independent REDACTION copy (coordinator evidence rule).
 *
 * Copies a kit run directory into the task evidence directory and rewrites
 * ONLY credential VALUES: every `token=<value>` becomes `token=REDACTED`,
 * every `Authorization: Bearer <value>` / `lt-v1-<hex>` / `sk-<24+>` style
 * secret is replaced by its marker. All other bytes (fields, results, exit
 * codes, counts, paths, ids, timestamps) are preserved verbatim, so the
 * redacted copy still proves exactly what happened.
 *
 * Usage: node copy-redact-evidence.mjs <srcDir> <destDir>
 * Prints a manifest: files copied, bytes changed, redactions applied.
 */
import { cpSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const [src, dest] = process.argv.slice(2)
if (!src || !dest) {
  process.stderr.write('usage: node copy-redact-evidence.mjs <srcDir> <destDir>\n')
  process.exit(2)
}

const RULES = [
  // launch/会话 token query values (host boot url, cookie echoes)
  [/([?&]token=)[^\s"'&,}]+/g, '$1REDACTED'],
  // bare `token: <value>` / `token=<value>` in JSON bodies and logs
  [/("(?:token|authToken|launchToken|access_token|apiKey|api_key)"\s*:\s*")[^"]+(")/g, '$1REDACTED$2'],
  [/\b(token|authToken|launchToken|access_token|apiKey|api_key)(["']?\s*[:=]\s*["']?)[A-Za-z0-9._~+\/-]{8,}/g, '$1$2REDACTED'],
  [/Bearer\s+[A-Za-z0-9._~+\/-]{12,}=*/g, 'Bearer REDACTED'],
  [/lt-v1-[0-9a-fA-F]{8,}/g, 'lt-v1-REDACTED'],
  [/sk-[A-Za-z0-9]{20,}/g, 'sk-REDACTED'],
  [/gh[pousr]_[A-Za-z0-9]{16,}/g, 'ghp_REDACTED'],
  [/xox[baprs]-[A-Za-z0-9-]{10,}/g, 'xox_REDACTED'],
  [/AKIA[0-9A-Z]{12,}/g, 'AKIA_REDACTED'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '-----PEM-REDACTED-----'],
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g, 'JWT-REDACTED'],
  [/58\.57\.119\.30/g, 'REDACTED-ENDPOINT'],
  [/192\.168\.223\.1/g, 'REDACTED-ENDPOINT'],
]

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else if (e.isFile()) yield p
  }
}

mkdirSync(dest, { recursive: true })
const manifest = []
let totalRedactions = 0
for (const file of walk(src)) {
  const rel = relative(src, file)
  const outPath = join(dest, rel)
  mkdirSync(outPath.slice(0, outPath.lastIndexOf('/')), { recursive: true })
  const buf = readFileSync(file)
  const looksBinary = buf.subarray(0, 8000).includes(0)
  if (looksBinary) {
    writeFileSync(outPath, buf)
    manifest.push({ rel, bytes: buf.length, redactions: 0, mode: 'binary-copy' })
    continue
  }
  let text = buf.toString('utf8')
  let n = 0
  for (const [re, rep] of RULES) {
    const hits = text.match(re)
    if (hits !== null && hits.length > 0) {
      text = text.replace(re, rep)
      n += hits.length
    }
  }
  writeFileSync(outPath, text)
  totalRedactions += n
  manifest.push({ rel, bytes: Buffer.byteLength(text), redactions: n, mode: 'redacted-copy' })
}
writeFileSync(join(dest, 'COPY-MANIFEST.json'), JSON.stringify({
  copiedFrom: src,
  copiedAt: new Date().toISOString(),
  note: 'Independent REDACTION copy: credential VALUES replaced by markers; all other bytes (fields, results, exit codes, counts, paths, ids) preserved.',
  totalRedactions,
  files: manifest,
}, null, 2) + '\n')
process.stdout.write(`copied ${manifest.length} files (${totalRedactions} redactions) ${src} -> ${dest}\n`)
