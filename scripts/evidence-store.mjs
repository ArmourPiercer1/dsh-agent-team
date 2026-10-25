#!/usr/bin/env node
/**
 * evidence-store - local content-addressed store for evidence relocated out of
 * the checkout (U3 evidence relocation, 2026-10-25).
 *
 * The tracked tree keeps only evidence that a runtime reader needs in-place
 * (dev/agent-workflow/evidence/RELOCATED-KEEP-SET.txt). Every other file that
 * was tracked under dev/agent-workflow/evidence/ at the source commit is:
 *
 *   - stored OUTSIDE git at <store>/blobs/<sha256[0:2]>/<sha256>, where the
 *     bytes come from `git cat-file blob <blob-oid>` of the source commit's
 *     tree - never from a working-tree copy, so content is provably git's;
 *   - indexed by the tracked manifest
 *     dev/agent-workflow/evidence/RELOCATED-MANIFEST.tsv:
 *     path <TAB> git_blob_oid <TAB> sha256 <TAB> bytes <TAB> mode, sorted by path.
 *
 * The store is LOCAL and TEMPORARY (default <repo-common-root>/.artifacts/evidence,
 * gitignored). Git history is the durable fallback: any manifest entry can be
 * restored with `git cat-file blob <git_blob_oid>` even if the store is lost.
 * This tool never rewrites history and never force-pushes.
 *
 * Subcommands:
 *   verify
 *       Every manifest entry: path must NOT be tracked (GENERATION_CONFLICT),
 *       the blob must exist in the store (MISSING), and its sha256/bytes must
 *       match (DIGEST_MISMATCH). Exit 1 with named findings, 0 otherwise.
 *   restore <path>... [--to <dir>] [--from-git]
 *       Re-materialize manifest paths. Bytes come from the store, or from
 *       `git cat-file blob <oid>` with --from-git. [--to] defaults to the repo
 *       root (original layout). Exclusive create always: an existing
 *       destination is refused (EXISTS), never overwritten.
 *   ingest --from-commit <sha> [--keep-set <file>] [--manifest <path>] [--store <dir>]
 *       One-shot builder: enumerate <sha>'s tree under the evidence prefix,
 *       skip keep-set paths, write every other blob to the store (content
 *       addressed, exclusive create, read-back + hash verified; an existing
 *       blob with a matching hash is skipped = idempotent) and write the
 *       manifest (sorted, with a header stating source commit, store
 *       location, restore procedure and the git-history fallback).
 *
 * Option overrides (all optional):
 *   store    = $DSH_EVIDENCE_STORE or <common git dir parent>/.artifacts/evidence
 *              (resolved via `git rev-parse --path-format=absolute --git-common-dir`,
 *               so every worktree of the repository shares ONE store)
 *   manifest = dev/agent-workflow/evidence/RELOCATED-MANIFEST.tsv
 *   keep-set = dev/agent-workflow/evidence/RELOCATED-KEEP-SET.txt
 *
 * Exit codes: 0 success | 1 findings/refusals | 2 usage/input errors.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  closeSync,
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'

const EVIDENCE_PREFIX = 'dev/agent-workflow/evidence'
const MANIFEST_REL = `${EVIDENCE_PREFIX}/RELOCATED-MANIFEST.tsv`
const KEEP_SET_REL = `${EVIDENCE_PREFIX}/RELOCATED-KEEP-SET.txt`
const MANIFEST_MARKER = '# RELOCATED-MANIFEST - v1 (U3 evidence relocation)'
const MODES = new Set(['100644', '100755', '120000'])

const die = (code, msg) => {
  console.error(`ERROR ${code} ${msg}`)
  process.exit(code === 'USAGE' ? 2 : 1)
}

/** Run git; return raw stdout, or die GIT_FAILURE. */
function gitRaw(cwd, args) {
  const r = spawnSync('git', args, { cwd, maxBuffer: 1024 * 1024 * 1024 })
  if (r.error) die('GIT_SPAWN', `git ${args[0]}: ${String(r.error.message ?? r.error)}`)
  if (r.status !== 0) {
    const err = Buffer.from(r.stderr ?? '').toString('utf8').trim()
    die('GIT_FAILURE', `git ${args.join(' ')} exited ${String(r.status)}${err === '' ? '' : `: ${err}`}`)
  }
  return Buffer.from(r.stdout ?? '')
}

const gitText = (cwd, args) => gitRaw(cwd, args).toString('utf8')

function repoLayout() {
  const cwd = process.cwd()
  const toplevel = gitText(cwd, ['rev-parse', '--show-toplevel']).trim()
  const commonDir = gitText(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim()
  return { toplevel, mainRoot: dirname(commonDir) }
}

const sha256hex = (buf) => createHash('sha256').update(buf).digest('hex')

const blobPathOf = (store, sha) => join(store, 'blobs', sha.slice(0, 2), sha)

function resolveStore(opts, mainRoot) {
  return opts.store ?? process.env.DSH_EVIDENCE_STORE ?? join(mainRoot, '.artifacts', 'evidence')
}

/** True when s contains a control character (tab/newline included). Tab and
 *  newline would corrupt the TAB-separated manifest; control bytes in a path
 *  are a corrupt tree, not a thing to paper over. */
function hasControlChar(s) {
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i)
    if (c < 0x20 || c === 0x7f) return true
  }
  return false
}

/** Parse manifest text -> entries; malformed lines die as MANIFEST_MALFORMED. */
function parseManifest(text, origin) {
  const entries = []
  for (const [i, line] of text.split('\n').entries()) {
    if (line === '' || line.startsWith('#')) continue
    const cols = line.split('\t')
    if (cols.length !== 5) die('MANIFEST_MALFORMED', `${origin}:${String(i + 1)}: expected 5 TAB-separated columns`)
    const [path, oid, sha256, bytes, mode] = cols
    if (!/^[0-9a-f]{40}$/.test(oid)) die('MANIFEST_MALFORMED', `${origin}:${String(i + 1)}: bad blob oid`)
    if (!/^[0-9a-f]{64}$/.test(sha256)) die('MANIFEST_MALFORMED', `${origin}:${String(i + 1)}: bad sha256`)
    if (!/^\d+$/.test(bytes)) die('MANIFEST_MALFORMED', `${origin}:${String(i + 1)}: bad byte count`)
    if (!MODES.has(mode)) die('MANIFEST_MALFORMED', `${origin}:${String(i + 1)}: bad mode ${mode}`)
    entries.push({ path, oid, sha256, bytes: Number(bytes), mode })
  }
  return entries
}

function loadManifest(toplevel, manifestOpt) {
  const p = manifestOpt !== undefined ? resolve(toplevel, manifestOpt) : join(toplevel, MANIFEST_REL)
  if (!existsSync(p)) die('MANIFEST_MISSING', p)
  return { file: p, entries: parseManifest(readFileSync(p, 'utf8'), p) }
}

function trackedEvidenceSet(toplevel) {
  const out = gitRaw(toplevel, ['ls-files', '-z', '--', `${EVIDENCE_PREFIX}/`]).toString('utf8')
  return new Set(out.split('\0').filter((s) => s !== ''))
}

/** List <commit>'s tree under the evidence prefix as {path,oid,mode}, sorted by path. */
function listTree(toplevel, commit) {
  const out = gitRaw(toplevel, ['ls-tree', '-r', '-z', commit, '--', `${EVIDENCE_PREFIX}/`]).toString('utf8')
  const entries = []
  for (const rec of out.split('\0')) {
    if (rec === '') continue
    const tab = rec.indexOf('\t')
    if (tab < 0) die('LIST_TREE', `unparsable ls-tree record: ${rec.slice(0, 80)}`)
    const path = rec.slice(tab + 1)
    const [mode, type, oid] = rec.slice(0, tab).split(' ')
    if (type !== 'blob') continue
    if (hasControlChar(path)) {
      die('LIST_TREE', `refusing to manifest a path with control characters/tabs: ${JSON.stringify(path)}`)
    }
    entries.push({ path, oid, mode })
  }
  entries.sort((a, b) => (a.path < b.path ? -1 : 1))
  return entries
}

const readBlobGit = (toplevel, oid) => gitRaw(toplevel, ['cat-file', 'blob', oid])

// ---------------------------------------------------------------- verify --

function cmdVerify(opts) {
  const { toplevel, mainRoot } = repoLayout()
  const store = resolveStore(opts, mainRoot)
  const { file: manifestFile, entries } = loadManifest(toplevel, opts.manifest)
  const tracked = trackedEvidenceSet(toplevel)
  const findings = []
  let bytesOk = 0
  for (const e of entries) {
    if (tracked.has(e.path)) {
      findings.push(`GENERATION_CONFLICT ${e.path} still tracked in the index but listed as relocated by ${manifestFile}`)
    }
    const bp = blobPathOf(store, e.sha256)
    if (!existsSync(bp)) {
      findings.push(`MISSING ${e.path} store blob absent: ${bp}`)
      continue
    }
    const buf = readFileSync(bp)
    if (buf.length !== e.bytes || sha256hex(buf) !== e.sha256) {
      findings.push(`DIGEST_MISMATCH ${e.path} store blob ${bp} does not match ${e.sha256}`)
      continue
    }
    bytesOk += e.bytes
  }
  for (const f of findings) console.log(`FINDING ${f}`)
  console.log(
    `verify verdict=${findings.length === 0 ? 'pass' : 'fail'} entries=${String(entries.length)} ` +
      `bytes_ok=${String(bytesOk)} findings=${String(findings.length)} store=${store}`,
  )
  process.exit(findings.length === 0 ? 0 : 1)
}

// --------------------------------------------------------------- restore --

function safeLstat(p) {
  try {
    return lstatSync(p)
  } catch {
    return null
  }
}

/** Exclusive create; never overwrites (O_EXCL / fresh symlink target). */
function exclusiveWrite(path, buf, mode) {
  mkdirSync(dirname(path), { recursive: true })
  if (mode === '120000') {
    symlinkSync(buf.toString('utf8'), path)
    return
  }
  const fd = openSync(path, 'wx') // O_WRONLY | O_CREAT | O_EXCL
  try {
    writeFileSync(fd, buf)
  } finally {
    closeSync(fd)
  }
  if (mode === '100755') chmodSync(path, (statSync(path).mode & 0o777) | 0o755)
}

function cmdRestore(args, opts) {
  if (args.length === 0) die('USAGE', 'restore needs at least one manifest path')
  const { toplevel, mainRoot } = repoLayout()
  const store = resolveStore(opts, mainRoot)
  const { entries } = loadManifest(toplevel, opts.manifest)
  const byPath = new Map(entries.map((e) => [e.path, e]))
  const toRoot = resolve(toplevel, opts.to ?? toplevel)
  const failures = []
  const fail = (code, msg) => failures.push(`${code} ${msg}`)
  for (const raw of args) {
    const p = raw.replace(/^\.\//, '')
    const e = byPath.get(p)
    if (e === undefined) {
      fail('PATH_NOT_MANIFESTED', `${p} not listed in ${MANIFEST_REL}`)
      continue
    }
    const dest = join(toRoot, e.path)
    if (safeLstat(dest) !== null) {
      fail('EXISTS', `${dest} - restore never overwrites`)
      continue
    }
    let buf
    if (opts.fromGit === true) {
      buf = readBlobGit(toplevel, e.oid)
    } else {
      const bp = blobPathOf(store, e.sha256)
      if (!existsSync(bp)) {
        fail('MISSING', `${p} store blob absent (${bp}); retry with --from-git`)
        continue
      }
      buf = readFileSync(bp)
    }
    if (buf.length !== e.bytes || sha256hex(buf) !== e.sha256) {
      fail('DIGEST_MISMATCH', `${p} source bytes do not match the manifest${opts.fromGit === true ? '' : '; try --from-git'}`)
      continue
    }
    try {
      exclusiveWrite(dest, buf, e.mode)
    } catch (error) {
      if (error && error.code === 'EEXIST') {
        fail('EXISTS', `${dest} - restore never overwrites`)
        continue
      }
      throw error
    }
    console.log(`RESTORED ${p} -> ${dest}`)
  }
  for (const f of failures) console.error(`FINDING ${f}`)
  process.exit(failures.length === 0 ? 0 : 1)
}

// ---------------------------------------------------------------- ingest --

function cmdIngest(opts) {
  if (opts.fromCommit === undefined) die('USAGE', 'ingest needs --from-commit <sha>')
  const { toplevel, mainRoot } = repoLayout()
  const store = resolveStore(opts, mainRoot)
  const manifestOut = opts.manifest !== undefined ? resolve(toplevel, opts.manifest) : join(toplevel, MANIFEST_REL)
  const keepFile = opts.keepSet !== undefined ? resolve(toplevel, opts.keepSet) : join(toplevel, KEEP_SET_REL)
  if (!existsSync(keepFile)) die('KEEP_SET', `not found: ${keepFile}`)
  const commit = gitText(toplevel, ['rev-parse', '--verify', `${opts.fromCommit}^{commit}`]).trim()
  const tree = gitText(toplevel, ['rev-parse', '--verify', `${commit}^{tree}`]).trim()
  const listed = listTree(toplevel, commit)
  if (listed.length === 0) die('LIST_TREE', `${commit} has no files under ${EVIDENCE_PREFIX}/`)
  const keep = new Set(
    readFileSync(keepFile, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '' && !l.startsWith('#')),
  )
  // The manifest and the keep list are never relocation subjects.
  keep.add(MANIFEST_REL)
  keep.add(KEEP_SET_REL)
  const relocated = listed.filter((e) => !keep.has(e.path))
  const keptCount = listed.length - relocated.length
  mkdirSync(join(store, 'blobs'), { recursive: true })
  const tmpDir = join(store, 'tmp')
  mkdirSync(tmpDir, { recursive: true })
  let written = 0
  let skipped = 0
  let bytes = 0
  const lines = []
  for (const [i, e] of relocated.entries()) {
    const buf = readBlobGit(toplevel, e.oid)
    const sha = sha256hex(buf)
    bytes += buf.length
    const bp = blobPathOf(store, sha)
    if (existsSync(bp)) {
      if (sha256hex(readFileSync(bp)) !== sha) die('STORE_CONFLICT', `${bp} exists with foreign content`)
      skipped += 1
    } else {
      mkdirSync(dirname(bp), { recursive: true }) // sha256 bucket
      const tmp = join(tmpDir, `ingest-${String(process.pid)}-${String(i)}.tmp`)
      writeFileSync(tmp, buf)
      if (sha256hex(readFileSync(tmp)) !== sha) die('WRITE_BACK', `temp blob ${tmp} failed read-back verification`)
      try {
        linkSync(tmp, bp) // hardlink publish = exclusive create; EEXIST if someone beat us
        written += 1
      } catch (error) {
        if (!error || error.code !== 'EEXIST') throw error
        if (sha256hex(readFileSync(bp)) !== sha) die('STORE_CONFLICT', `${bp} exists with foreign content`)
        skipped += 1
      } finally {
        rmSync(tmp, { force: true })
      }
    }
    lines.push(`${e.path}\t${e.oid}\t${sha}\t${String(buf.length)}\t${e.mode}`)
  }
  const header = [
    MANIFEST_MARKER,
    `# source-commit: ${commit}`,
    `# source-tree: ${tree} (enumerated via \`git ls-tree -r ${commit} -- ${EVIDENCE_PREFIX}/\`; every blob read via \`git cat-file blob <oid>\`)`,
    '# store: content-addressed blobs at <repo-common-root>/.artifacts/evidence/blobs/<sha256[0:2]>/<sha256>',
    '#   (local, temporary, gitignored; override with $DSH_EVIDENCE_STORE or --store)',
    '# restore: node scripts/evidence-store.mjs restore <path>... [--to <dir>]   # from the store',
    '#          node scripts/evidence-store.mjs restore <path>... --from-git     # from git objects',
    '# durable fallback: git history remains the authority. Even if the local store is lost,',
    '#   every entry below restores with `git cat-file blob <git_blob_oid>` from history',
    '#   (verify the restored bytes against the sha256 column). No history rewrite, no force push.',
    '# columns: path <TAB> git_blob_oid <TAB> sha256 <TAB> bytes <TAB> mode',
  ].join('\n')
  const body = `${header}\n${lines.join('\n')}\n`
  if (existsSync(manifestOut) && !readFileSync(manifestOut, 'utf8').startsWith(MANIFEST_MARKER)) {
    die('REFUSE_OVERWRITE', `${manifestOut} exists and is not a manifest this tool owns`)
  }
  const digest = sha256hex(Buffer.from(body, 'utf8'))
  const tmpManifest = `${manifestOut}.tmp-${String(process.pid)}`
  mkdirSync(dirname(manifestOut), { recursive: true })
  writeFileSync(tmpManifest, body, 'utf8')
  renameSync(tmpManifest, manifestOut)
  console.log(
    `ingest verdict=pass source-commit=${commit} prefix=${EVIDENCE_PREFIX}/ listed=${String(listed.length)} ` +
      `kept=${String(keptCount)} relocated=${String(relocated.length)} bytes=${String(bytes)} ` +
      `blobs_written=${String(written)} blobs_skipped_existing=${String(skipped)} ` +
      `manifest=${relative(toplevel, manifestOut)} manifest_sha256=${digest}`,
  )
}

// ------------------------------------------------------------------- cli --

function parseArgs(argv) {
  const [cmd, ...rest] = argv
  const opts = {}
  const positional = []
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i]
    const take = () => {
      i += 1
      if (i >= rest.length) die('USAGE', `${a} needs a value`)
      return rest[i]
    }
    if (a === '--store') opts.store = resolve(take())
    else if (a === '--manifest') opts.manifest = take()
    else if (a === '--keep-set') opts.keepSet = take()
    else if (a === '--from-commit') opts.fromCommit = take()
    else if (a === '--to') opts.to = take()
    else if (a === '--from-git') opts.fromGit = true
    else if (a.startsWith('--')) die('USAGE', `unknown option ${a}`)
    else positional.push(a)
  }
  return { cmd, positional, opts }
}

function usage() {
  console.error(
    [
      'usage:',
      '  node scripts/evidence-store.mjs verify',
      '  node scripts/evidence-store.mjs restore <path>... [--to <dir>] [--from-git]',
      '  node scripts/evidence-store.mjs ingest --from-commit <sha> [--keep-set <file>] [--manifest <path>] [--store <dir>]',
    ].join('\n'),
  )
  process.exit(2)
}

const { cmd, positional, opts } = parseArgs(process.argv.slice(2))
if (cmd === 'verify') cmdVerify(opts)
else if (cmd === 'restore') cmdRestore(positional, opts)
else if (cmd === 'ingest') cmdIngest(opts)
else usage()
