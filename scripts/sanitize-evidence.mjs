#!/usr/bin/env node
/**
 * sanitize-evidence.mjs — desensitize captured run logs for commit.
 *
 * WHY: a real-host test run writes host logs that necessarily contain the boot
 * token (`dsh web: http://127.0.0.1:<port>/?token=…`), the web session cookie
 * (`dsh-auth-…`) and, for model traffic, an authorization header. Nothing
 * credential-shaped belongs in a committed evidence file — and the RAW logs
 * must not be rewritten either, because they are the forensic record of what
 * the host printed. So this tool copies (never edits in place) and pins the raw
 * bytes by SHA-256 in a manifest.
 *
 * THE FAILURE THIS VERSION CLOSES (independent review of PR #62 @ 0ff5bbe1):
 * the first version had NO path separation. `--from X --to X` (same tree), a
 * `--to` reaching `--from` through a symlink alias, and a bare no-argument
 * invocation all exited 0 while REWRITING THE RAW TREE in place; `--store`
 * pointing into `--to` copied raw secrets back INTO the sanitized output while
 * the manifest claimed they had been replaced; and the pattern set missed a
 * YAML `x-api-key:` value and a JSON `"token"` field, so `--verify` reported a
 * clean scan over files that still held a secret. A sanitizer that can overwrite
 * its own input, or bless a secret, is worse than no sanitizer.
 *
 * RULES NOW ENFORCED (each pinned by
 * `packages/testkit/test/rc2-sanitize-evidence.test.ts`):
 *   1. no arguments, or `--verify` without a path → usage + exit 2;
 *   2. `--from`, `--to`, `--store` are canonicalized (realpath over the longest
 *      existing prefix, so symlink aliases collapse) and must be PAIRWISE
 *      DISJOINT — equal, nested or contained is refused. That makes the
 *      "read the raw tree, write secrets into it" alias/recursion case
 *      structurally impossible;
 *   3. a non-empty `--to` requires `--force`;
 *   4. the raw tree is only ever READ: every raw file's SHA-256 is re-verified
 *      AFTER the run, so a regression that touched one raw byte fails the tool
 *      itself and no manifest is published;
 *   5. `--verify` exits NON-ZERO on any credential-shaped hit. The vocabulary
 *      covers boot/query tokens, JSON keys (authorization, cookie, set-cookie,
 *      x-api-key, api[_-]key, apikey, access[_-]token, token, password, secret),
 *      the SAME vocabulary in YAML/ini `key: value` form, `dsh-auth-*` cookies,
 *      `Bearer` values and opaque base64url-looking runs — while leaving
 *      lowercase hex object ids and pinned SHAs verbatim.
 *
 * Usage:
 *   node scripts/sanitize-evidence.mjs --from <raw-dir> --to <sanitized-dir>
 *       [--manifest <path>] [--store <raw-keep-dir>] [--force]
 *   node scripts/sanitize-evidence.mjs --verify <dir>
 */
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'

/** Only captured output is desensitized. Source files (.mjs/.ts) are code —
 * they never embed a live credential (the probes log `cookieChars=<n>`, never
 * the value) and rewriting code would produce broken copies. */
const SANITIZED_EXTENSIONS = new Set(['.log', '.json', '.txt', '.out', '.yaml', '.yml', '.ndjson'])

/** `[name, regex, replacement, appliesToSanitizedCopiesOnly]`.
 * `appliesToSanitizedCopiesOnly` patterns (absolute paths) are never reported by
 * `--verify`, because committed docs legitimately contain repo paths. */
const PATTERNS = [
  ['boot-token', /(https?:\/\/[^\s"'`]+?\?token=)[A-Za-z0-9_-]{8,}/g, '$1<REDACTED-BOOT-TOKEN>', false],
  ['token-param', /\b(token|access_token|api_key|apikey|x-api-key)=["']?[A-Za-z0-9_\-.=]{8,}/gi, '$1=<REDACTED>', false],
  ['session-cookie', /dsh-auth-[A-Za-z0-9_-]{4,}(=[A-Za-z0-9._\-%=]{4,})?/g, 'dsh-auth-<REDACTED>=<REDACTED>', false],
  ['bearer', /\bBearer\s+[A-Za-z0-9._-]{4,}/gi, 'Bearer <REDACTED>', false],
  // JSON string values of credential-ish keys, any casing/separator.
  ['json-secret-key', /("(?:authorization|cookie|set-cookie|x-api-key|api[_-]?key|apikey|access[_-]?token|token|password|secret)"\s*:\s*")[^"]*(")/gi, '$1<REDACTED>$2', false],
  // YAML / ini style `key: value` for the same vocabulary (the missed case).
  ['yaml-secret-key', /^(\s*["']?(?:authorization|cookie|set-cookie|x-api-key|api[_-]?key|apikey|access[_-]?token|token|password|secret)["']?\s*:\s*)[^\r\n"'`]+/gim, '$1<REDACTED>', false],
  // Cookie headers that visibly carry a session cookie value.
  ['cookie-header', /((?:set-cookie|cookie)\s*[:=]\s*)[^\r\n"'`]*(?:dsh-auth-|v1\.|Bearer)[^\r\n"'`]*/gi, '$1<REDACTED-COOKIE>', false],
  // Absolute paths appear in captured payloads; docs/scripts keep them.
  ['abs-path-posix', /\/(?:home|srv|Users|mnt|var|tmp|opt|workspace)\/[^\s"'`,)\]}\\]*/g, '<ABSOLUTE_PATH>', true],
  ['abs-path-windows', /(?:[A-Za-z]:\\|\\\\)[^\s"'`,)\]}]+/g, '<ABSOLUTE_PATH>', true],
  // Opaque base64url-looking runs. Lowercase-only runs are excluded on purpose:
  // git object ids (40/64 hex) and pinned SHAs are evidence we keep verbatim.
  // Runs with two or more hyphens are excluded (timestamped directory names).
  ['bare-secret', /(?<![-/\w])(?=[A-Za-z0-9_-]{40,}\b)(?=[A-Za-z0-9_-]*[A-Z])(?=[A-Za-z0-9_-]*[a-z])(?=[A-Za-z0-9_-]*[0-9])(?!(?:[A-Za-z0-9_-]*-){2})[A-Za-z0-9_-]{40,}\b(?![-/\w])/g, '<REDACTED-OPAQUE>', false],
]

const USAGE = 'usage: --from <raw-dir> --to <sanitized-dir> [--manifest <path>] [--store <raw-keep-dir>] [--force] | --verify <dir>'

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

/**
 * Canonical path with SYMLINK ALIASES collapsed: realpath the longest existing
 * prefix, then re-attach the not-yet-existing tail. `--to` pointing at `--from`
 * through a link is the exact bypass the first version allowed.
 */
function canonicalPath(p) {
  const abs = resolve(p)
  const tail = []
  let cur = abs
  while (!existsSync(cur)) {
    tail.unshift(basename(cur))
    const parent = dirname(cur)
    if (parent === cur) break
    cur = parent
  }
  let real = cur
  try {
    real = realpathSync(cur)
  } catch {
    /* unresolvable: keep the lexical form */
  }
  return tail.length > 0 ? resolve(real, ...tail) : resolve(real)
}

const contains = (parent, child) =>
  child === parent || child.startsWith(parent.endsWith(sep) ? parent : parent + sep)

/** Every pair among the given roles must be disjoint (no equality, no nesting). */
function assertDisjoint(roles) {
  const entries = Object.entries(roles).filter(([, v]) => typeof v === 'string' && v !== '')
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const [nameA, a] = entries[i]
      const [nameB, b] = entries[j]
      if (a === b) return `${nameA} and ${nameB} resolve to the same directory (${a}) — refusing to read and write the same tree`
      if (contains(a, b)) return `${nameB} (${b}) is inside ${nameA} (${a}) — output would nest into input; the trees must be disjoint`
      if (contains(b, a)) return `${nameA} (${a}) is inside ${nameB} (${b}) — output would nest into input; the trees must be disjoint`
    }
  }
  return null
}

/** A hit is real only if it is not one of our own placeholders. */
const realHits = (text, patternIndex) => {
  const [, re, , scanSanitizedOnly] = PATTERNS[patternIndex]
  if (scanSanitizedOnly) return []
  return (text.match(re) ?? []).filter((m) => !m.includes('REDACTED'))
}

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? null : args[i + 1]
}

if (args.length === 0) {
  console.log(`no arguments.\n${USAGE}`)
  process.exit(2)
}

if (args.includes('--verify')) {
  const target = flag('verify')
  if (target === null || target === undefined) {
    console.log(`--verify needs a directory.\n${USAGE}`)
    process.exit(2)
  }
  const dir = canonicalPath(target)
  if (!existsSync(dir) || !lstatSync(dir).isDirectory()) {
    console.log(`VERIFY FAIL: ${dir} is not an existing directory`)
    process.exit(1)
  }
  const files = walk(dir)
  const hits = []
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (let i = 0; i < PATTERNS.length; i += 1) {
      const found = realHits(text, i)
      if (found.length > 0) {
        hits.push({ file: relative(dir, file), pattern: PATTERNS[i][0], count: found.length, sample: String(found[0]).slice(0, 32) })
      }
    }
  }
  if (hits.length === 0) {
    console.log(`VERIFY OK: no credential-shaped substring in ${files.length} files under ${dir}`)
    process.exit(0)
  }
  console.log(`VERIFY FAIL: ${hits.length} credential-shaped hit(s)`)
  for (const h of hits.slice(0, 40)) console.log(`  ${h.file}: ${h.pattern} x${h.count} e.g. ${h.sample}...`)
  process.exit(1)
}

const fromArg = flag('from')
const toArg = flag('to')
if (fromArg === null || toArg === null || fromArg === undefined || toArg === undefined) {
  console.log(`both --from and --to are required.\n${USAGE}`)
  process.exit(2)
}
const from = canonicalPath(fromArg)
const to = canonicalPath(toArg)
const storeArg = flag('store')
const store = storeArg === null || storeArg === undefined ? null : canonicalPath(storeArg)

if (!existsSync(from) || !lstatSync(from).isDirectory()) {
  console.log(`REFUSED: --from must be an existing directory (${from})`)
  process.exit(2)
}
const clash = assertDisjoint({ from, to, store })
if (clash !== null) {
  console.log(`REFUSED: ${clash}`)
  process.exit(2)
}
if (existsSync(to) && readdirSync(to).length > 0 && !args.includes('--force')) {
  console.log(`REFUSED: --to is not empty (${to}); pass --force to overwrite it`)
  process.exit(2)
}
const manifestArg = flag('manifest')
const manifestPath = manifestArg === null || manifestArg === undefined ? join(to, 'SANITIZATION.json') : canonicalPath(manifestArg)
if (!contains(to, manifestPath)) {
  console.log(`REFUSED: --manifest must live inside --to (${to}), got ${manifestPath}`)
  process.exit(2)
}

// Rule 4: snapshot the raw tree BEFORE any write, and re-verify after.
const rawHashBefore = new Map()
for (const file of walk(from)) rawHashBefore.set(file, sha256(readFileSync(file)))

const manifest = {
  generator: 'scripts/sanitize-evidence.mjs',
  generatedAt: new Date().toISOString(),
  source: from,
  sanitizedTo: to,
  rawBytesPreservedIn: store,
  separation: 'from / to / store canonicalized (symlinks resolved) and proven pairwise disjoint before any write; every raw sha256 re-verified after the run',
  note: 'Raw logs are the forensic record and are NEVER rewritten; committed copies replace credential-shaped substrings only — line structure and every non-credential byte are preserved.',
  patterns: PATTERNS.map(([name]) => name),
  files: [],
}

let totalReplacements = 0
for (const file of walk(from)) {
  const rel = relative(from, file)
  const raw = readFileSync(file)
  const isCaptured = SANITIZED_EXTENSIONS.has(rel.slice(rel.lastIndexOf('.')))
  const dest = join(to, rel)
  mkdirSync(dirname(dest), { recursive: true })
  if (!isCaptured) {
    copyFileSync(file, dest)
    manifest.files.push({ file: rel, copiedVerbatim: true, bytesRaw: raw.length, sha256Raw: rawHashBefore.get(file) })
    continue
  }
  let out = raw.toString('utf8')
  const counts = {}
  for (const [name, re, repl, sanitizedOnly] of PATTERNS) {
    if (sanitizedOnly === true) continue
    const before = out
    out = out.replace(re, repl)
    const n = before === out ? 0 : (before.match(re) ?? []).length
    if (n > 0) counts[name] = n
  }
  if (store !== null) {
    const keep = join(store, rel)
    mkdirSync(dirname(keep), { recursive: true })
    copyFileSync(file, keep)
  }
  writeFileSync(dest, out)
  totalReplacements += Object.values(counts).reduce((a, b) => a + b, 0)
  manifest.files.push({
    file: rel,
    bytesRaw: raw.length,
    bytesSanitized: Buffer.byteLength(out),
    sha256Raw: rawHashBefore.get(file),
    sha256Sanitized: sha256(Buffer.from(out)),
    replacements: counts,
  })
}

if (store !== null) {
  // Copy any non-captured raw files into the keep tree too, so `store` is a
  // complete raw backup.
  for (const file of walk(from)) {
    const rel = relative(from, file)
    if (SANITIZED_EXTENSIONS.has(rel.slice(rel.lastIndexOf('.')))) continue
    const keep = join(store, rel)
    mkdirSync(dirname(keep), { recursive: true })
    copyFileSync(file, keep)
  }
}

// Rule 4 (post-check): prove we did not touch a raw byte.
for (const [file, before] of rawHashBefore) {
  if (!existsSync(file) || sha256(readFileSync(file)) !== before) {
    console.log(`REFUSED: the raw tree changed during the run (${file}) — publishing no manifest`)
    process.exit(1)
  }
}

manifest.rawBytesUnchanged = true
manifest.totalReplacements = totalReplacements
mkdirSync(dirname(manifestPath), { recursive: true })
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
console.log(`sanitized ${manifest.files.length} files (${totalReplacements} replacements) -> ${to}`)
if (store !== null) console.log(`raw copies -> ${store}`)
console.log(`manifest -> ${manifestPath} (rawBytesUnchanged=true)`)
