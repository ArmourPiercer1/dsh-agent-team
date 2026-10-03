#!/usr/bin/env node
/**
 * sanitize-evidence.mjs — desensitize a run's captured logs for commit.
 *
 * WHY: a real-host test run writes host-instance logs that necessarily contain
 * the boot token (`dsh web: http://127.0.0.1:<port>/?token=…`), the web session
 * cookie (`dsh-auth-…`) and, for model traffic, the mock key in an
 * `authorization` header. Those are credentials of a throwaway instance, but
 * nothing that looks like a credential belongs in a committed evidence file —
 * and the RAW logs must not be rewritten either, because they are the
 * forensic record of what the host actually printed.
 *
 * So this tool never edits in place: it copies each file to a destination tree
 * with the credential-shaped substrings replaced, and writes a manifest that
 * pins the RAW bytes by SHA-256 next to the number of replacements per
 * pattern. Keep the raw tree (outside the repository or in a gitignored
 * directory); commit only the sanitized tree plus the manifest.
 *
 * Usage:
 *   node scripts/sanitize-evidence.mjs --from <raw-dir> --to <sanitized-dir>
 *       [--manifest <path>] [--store <raw-keep-dir>]  (copy raws byte-identically too)
 *   node scripts/sanitize-evidence.mjs --verify <dir>   (scan, report, exit 1 on hits)
 */
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

/** Only captured output is desensitized. Source files (.mjs/.ts) are code —
 * they never embed a live credential (the probes log `cookieChars=<n>`, never
 * the value), and rewriting code would produce broken copies. */
const SANITIZED_EXTENSIONS = new Set(['.log', '.json', '.txt', '.out', '.yaml', '.yml'])

const PATTERNS = [
  // Boot token in the printed URL or any query string.
  ['boot-token', /(https?:\/\/[^\s"'`]+?\/?\?token=)[A-Za-z0-9_-]{16,}/g, '$1<REDACTED-BOOT-TOKEN>'],
  ['token-param', /\b(token|access_token|api_key|apikey)=["']?[A-Za-z0-9_\-.=]{12,}/gi, '$1=<REDACTED>'],
  // Web session cookie (host mints `dsh-auth-<key>=v1.<jwt-ish>.<sig>`).
  ['session-cookie', /dsh-auth-[A-Za-z0-9_-]{8,}(=[A-Za-z0-9._\-%=]{8,})?/g, 'dsh-auth-<REDACTED>=<REDACTED>'],
  ['cookie-header', /((?:set-cookie|cookie)\s*[:=]\s*)[^\r\n"'`]*(?:dsh-auth-|v1\.|Bearer)[^\r\n"'`]*/gi, '$1<REDACTED-COOKIE>'],
  // Model-endpoint credential header.
  ['bearer', /\bBearer\s+[A-Za-z0-9._\-]{6,}/gi, 'Bearer <REDACTED>'],
  ['authorization-json', /("(?:authorization|cookie|x-api-key|api-key)"\s*:\s*")[^"]*(")/gi, '$1<REDACTED>$2'],
  // A bare 40+ char base64url run that mixes upper case, lower case AND a
  // digit is a token/secret shape. Lowercase-only runs are excluded on
  // purpose: git object ids (40/64 hex) and pinned SHAs are evidence we must
  // keep verbatim.
  ['bare-secret', /(?<![-/\w])(?=[A-Za-z0-9_-]{40,}\b)(?=[A-Za-z0-9_-]*[A-Z])(?=[A-Za-z0-9_-]*[a-z])(?=[A-Za-z0-9_-]*[0-9])(?!(?:[A-Za-z0-9_-]*-){2})[A-Za-z0-9_-]{40,}\b(?![-/\w])/g, '<REDACTED-OPAQUE>'],
]

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? null : args[i + 1]
}

if (args.includes('--verify')) {
  const dir = resolve(flag('verify') ?? '.')
  const hits = []
  for (const file of walk(dir)) {
    const text = readFileSync(file, 'utf8')
    for (const [name, re] of PATTERNS) {
      const found = (text.match(re) ?? []).filter((m) => !m.includes('REDACTED'))
      if (found.length > 0) hits.push({ file: relative(dir, file), pattern: name, count: found.length, sample: String(found[0]).slice(0, 24) })
    }
  }
  if (hits.length === 0) {
    console.log(`VERIFY OK: no credential-shaped substring in ${walk(dir).length} files under ${dir}`)
    process.exit(0)
  }
  console.log(`VERIFY FAIL: ${hits.length} credential-shaped hits`)
  for (const h of hits.slice(0, 40)) console.log(`  ${h.file}: ${h.pattern} ×${h.count} e.g. ${h.sample}…`)
  process.exit(1)
}

const from = resolve(flag('from') ?? '')
const to = resolve(flag('to') ?? '')
const store = flag('store') === null ? null : resolve(flag('store'))
const manifestPath = flag('manifest') ?? join(to, 'SANITIZATION.json')
if (from === '' || to === '') {
  console.log('usage: --from <raw-dir> --to <sanitized-dir> [--manifest <path>] [--store <raw-keep-dir>] | --verify <dir>')
  process.exit(2)
}

const manifest = {
  generator: 'scripts/sanitize-evidence.mjs',
  generatedAt: new Date().toISOString(),
  source: from,
  sanitizedTo: to,
  rawBytesPreservedIn: store,
  note: 'Raw logs are the forensic record and are NEVER rewritten; they are kept byte-identically (sha256 pinned here) outside the committed tree. Committed copies replace credential-shaped substrings only — line structure, counts and every non-credential byte are preserved.',
  patterns: PATTERNS.map(([name]) => name),
  files: [],
}

let totalReplacements = 0
for (const file of walk(from)) {
  const rel = relative(from, file)
  if (!SANITIZED_EXTENSIONS.has(rel.slice(rel.lastIndexOf('.')))) {
    // Code and other non-captured files are copied verbatim.
    const dest = join(to, rel)
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(file, dest)
    if (store !== null) {
      const keep = join(store, rel)
      mkdirSync(dirname(keep), { recursive: true })
      copyFileSync(file, keep)
    }
    manifest.files.push({ file: rel, copiedVerbatim: true })
    continue
  }
  const raw = readFileSync(file)
  const text = raw.toString('utf8')
  let out = text
  const counts = {}
  for (const [name, re, repl] of PATTERNS) {
    const before = out
    out = out.replace(re, repl)
    const n = before === out ? 0 : (before.match(re) ?? []).length
    if (n > 0) counts[name] = n
  }
  const dest = join(to, rel)
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, out)
  if (store !== null) {
    const keep = join(store, rel)
    mkdirSync(dirname(keep), { recursive: true })
    copyFileSync(file, keep)
  }
  totalReplacements += Object.values(counts).reduce((a, b) => a + b, 0)
  manifest.files.push({
    file: rel,
    bytesRaw: raw.length,
    bytesSanitized: Buffer.byteLength(out),
    sha256Raw: sha256(raw),
    sha256Sanitized: sha256(Buffer.from(out)),
    replacements: counts,
  })
}
mkdirSync(dirname(manifestPath), { recursive: true })
writeFileSync(manifestPath, JSON.stringify({ ...manifest, totalReplacements }, null, 2) + '\n')
console.log(`sanitized ${manifest.files.length} files (${totalReplacements} replacements) -> ${to}`)
if (store !== null) console.log(`raw copies -> ${store}`)
console.log(`manifest -> ${manifestPath}`)
