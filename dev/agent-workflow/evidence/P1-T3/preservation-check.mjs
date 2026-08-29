#!/usr/bin/env node
/**
 * P1-T3 preservation check — keep UNRELATED_FORK_FEATURE (Class B) content in the
 * downstream host, with zero reverse dependency from the dsh-agent-team repo.
 *
 * Inputs (all paths, no network, no child processes):
 *   --legacy-blobs <json>   Map of repo-relative path -> git blob SHA-1 recorded from
 *                           `git -C <legacy-checkout> rev-parse a3ab319:<path>`
 *                           (authoritative object identity in the legacy object db).
 *   --replay <dir>          Scratch copy of the 10 files extracted from a3ab319
 *                           (git show, fd-redirected); mirrors repo-relative layout.
 *   --host <dir>            Downstream host worktree (branch host/unrelated-features-20260829),
 *                           AFTER replay.
 *   --team <dir>            Team repo worktree (branch task/P1-T3-unrelated-preserve) to scan
 *                           for reverse dependencies.
 *   --out <file>            Result JSON written here.
 *
 * Check 1 — byte preservation (whole-file class; all 10 files have empty mixed_hunks
 * in the provenance manifest, so no hunk-level comparison is required):
 *   blob(replay file) == recorded a3ab319 blob   -> extraction was byte-exact
 *   buffer(replay file) == buffer(host file)     -> replay wrote exactly that content
 *   blob(host file) == recorded a3ab319 blob     -> direct host-side confirmation
 *   Transitivity: host file content === a3ab319 content.
 *
 * Check 2 — no reverse dependency in the Team repo:
 *   Scan every file in the Team worktree (skipping .git, node_modules, references/,
 *   docs/plans, .worktrees/, build output dirs, and the three read-forbidden files)
 *   for the 10 DSH-repo-relative paths and their feature markers. Hits are bucketed:
 *     audit_record     under dev/agent-workflow/evidence/ — this audit's own records
 *                      (expected; they cite the paths, they do not depend on the feature)
 *     doc_reference    other markdown/docs — migration/provenance prose (reported)
 *     code_or_config   anything else — a genuine reverse dependency (MUST be zero)
 *
 * Exit code 0 iff Check 1 fully passes and code_or_config hits are zero.
 */

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, sep } from 'node:path'

function argValue(flag, argv) {
  const i = argv.indexOf(flag)
  if (i === -1 || i + 1 >= argv.length) throw new Error(`missing value for ${flag}`)
  return argv[i + 1]
}

const argv = process.argv.slice(2)
const legacyBlobsPath = argValue('--legacy-blobs', argv)
const replayRoot = argValue('--replay', argv)
const hostRoot = argValue('--host', argv)
const teamRoot = argValue('--team', argv)
const outPath = argValue('--out', argv)

const LEGACY_SHA = 'a3ab31992762c5d6560797eabc7e0885a9320ade'

/** Git blob id of a buffer: sha1("blob <len>\0" + content). */
function blobSha(buf) {
  const h = createHash('sha1')
  h.update(`blob ${buf.length}\0`)
  h.update(buf)
  return h.digest('hex')
}

const recordedBlobs = JSON.parse(readFileSync(legacyBlobsPath, 'utf8'))
const fileEntries = Object.entries(recordedBlobs)

// ---------------------------------------------------------------- Check 1
const preservation = []
let preservationAllPass = true
for (const [relPath, expectedBlob] of fileEntries) {
  const replayPath = join(replayRoot, ...relPath.split('/'))
  const hostPath = join(hostRoot, ...relPath.split('/'))
  const result = { path: relPath, expected_blob_at_a3ab319: expectedBlob }
  try {
    const replayBuf = readFileSync(replayPath)
    const hostBuf = existsSync(hostPath) ? readFileSync(hostPath) : null
    result.replay_blob = blobSha(replayBuf)
    result.host_blob = hostBuf === null ? null : blobSha(hostBuf)
    result.replay_bytes = replayBuf.length
    result.host_bytes = hostBuf === null ? null : hostBuf.length
    result.extraction_ok = result.replay_blob === expectedBlob
    result.byte_equal = hostBuf !== null && replayBuf.equals(hostBuf)
    result.host_matches_legacy = result.host_blob === expectedBlob
    result.pass = result.extraction_ok && result.byte_equal && result.host_matches_legacy
    if (!result.pass) preservationAllPass = false
  } catch (error) {
    Object.assign(result, {
      error: error instanceof Error ? error.message : String(error),
      extraction_ok: false,
      byte_equal: false,
      host_matches_legacy: false,
      pass: false,
    })
    preservationAllPass = false
  }
  preservation.push(result)
}

// ---------------------------------------------------------------- Check 2
const SKIP_DIRS = new Set(['.git', 'node_modules', 'references', 'plans', '.worktrees', 'dist', '.artifacts', '.dsh-build'])
const FORBIDDEN_FILES = new Set([
  'docs/ROUTER_RULES.md',
  'dev/agent-workflow/SESSION_ROUTER_LOG.md',
  'dev/agent-workflow/graph.yaml',
])

/**
 * Pattern ids. P* = exact DSH-repo-relative path; F* = feature marker for the
 * fork delta of that file. All are case-sensitive (identifiers are lower-case).
 */
const PATTERNS = [
  { id: 'P1', kind: 'path', re: /\.agents\/notes\/implemented\/process\/2026-08-14-plugin-development-guide-reference\.md/ },
  { id: 'P2', kind: 'path', re: /\.agents\/notes\/implemented\/process\/2026-08-14-plugin-development-guide-reference\.zh\.md/ },
  { id: 'P3', kind: 'path', re: /AGENTS\.md/ },
  { id: 'P4', kind: 'path', re: /ENVIRONMENTS\.md/ },
  { id: 'P5', kind: 'path', re: /PLUGIN_DEV_GUIDE\.md/ },
  { id: 'P6', kind: 'path', re: /docs\/subsystems\/subagent\.zh\.md/ },
  { id: 'P7', kind: 'path', re: /learning-path-zh\.md/ },
  { id: 'P8', kind: 'path', re: /packages\/session\/session-persistence-jsonl\/src\/format\.ts/ },
  { id: 'P9', kind: 'path', re: /packages\/web\/tool-web\/src\/turndown-plugin-gfm\.d\.ts/ },
  { id: 'P10', kind: 'path', re: /scripts\/translation-pairing\.ts/ },
  { id: 'F1', kind: 'feature', re: /plugin-development-guide-reference/ },
  { id: 'F2', kind: 'feature', re: /two[- ]instance/ },
  { id: 'F3', kind: 'feature', re: /PLUGIN_DEV_GUIDE/ },
  { id: 'F4', kind: 'feature', re: /subagent\.zh/ },
  { id: 'F5', kind: 'feature', re: /learning-path-zh/ },
  { id: 'F6', kind: 'feature', re: /session-persistence-jsonl\/src\/format\.ts/ },
  { id: 'F7', kind: 'feature', re: /turndown-plugin-gfm/ },
  { id: 'F8', kind: 'feature', re: /translation-pairing/ },
  { id: 'F9', kind: 'feature', re: /\b3180\b/ },
]

function bucketFor(relPosix) {
  if (relPosix.startsWith('dev/agent-workflow/evidence/')) return 'audit_record'
  const ext = relPosix.slice(relPosix.lastIndexOf('.') + 1).toLowerCase()
  if (ext === 'md' || ext === 'markdown') return 'doc_reference'
  return 'code_or_config'
}

const hits = []
const scanned = []
const skipped = []

function walk(dir, relDir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = relDir === '' ? entry.name : `${relDir}/${entry.name}`
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) {
        skipped.push({ path: rel + '/', reason: 'excluded dir' })
        continue
      }
      walk(full, rel)
      continue
    }
    if (!entry.isFile()) continue
    if (FORBIDDEN_FILES.has(rel)) {
      skipped.push({ path: rel, reason: 'read-forbidden file' })
      continue
    }
    scanned.push(rel)
    let buf
    try {
      buf = readFileSync(full)
    } catch {
      skipped.push({ path: rel, reason: 'unreadable' })
      continue
    }
    const head = buf.subarray(0, 8000)
    if (head.includes(0)) {
      skipped.push({ path: rel, reason: 'binary' })
      continue
    }
    const lines = buf.toString('utf8').split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line) continue
      for (const p of PATTERNS) {
        if (p.re.test(line)) {
          hits.push({
            file: rel,
            line: i + 1,
            pattern: p.id,
            pattern_kind: p.kind,
            bucket: bucketFor(rel),
            text: line.trim().slice(0, 240),
          })
        }
      }
    }
  }
}

walk(teamRoot, '')

const buckets = { audit_record: [], doc_reference: [], code_or_config: [] }
for (const h of hits) buckets[h.bucket].push(h)
const reverseDependencyHits = buckets.code_or_config
const scanAllClean = reverseDependencyHits.length === 0

const result = {
  task: 'P1-T3',
  generated_at: new Date().toISOString(),
  legacy_sha: LEGACY_SHA,
  method: {
    check1: 'git blob SHA-1 of "blob <len>\\0"+content computed in-process; compared against rev-parse identities recorded from the legacy object db, plus direct buffer equality between the a3ab319 extraction and the host worktree file.',
    check2: 'full-text scan of the Team worktree for the 10 DSH-relative paths and feature markers; hits bucketed audit_record / doc_reference / code_or_config; code_or_config must be zero.',
    whole_file_class: 'all 10 files have empty mixed_hunks in the provenance manifest, so every replay is whole-file and byte comparison is the required granularity (no hunk comparison needed).',
  },
  check1_preservation: { files: preservation, all_pass: preservationAllPass },
  check2_reverse_dependency_scan: {
    scanned_files: scanned.length,
    skipped,
    hits,
    buckets: {
      audit_record: buckets.audit_record.length,
      doc_reference: buckets.doc_reference.length,
      code_or_config: reverseDependencyHits.length,
    },
    reverse_dependency_hits: reverseDependencyHits,
    all_clean: scanAllClean,
  },
  overall_pass: preservationAllPass && scanAllClean,
}

writeFileSync(outPath, JSON.stringify(result, null, 2))
console.log(`check1: ${preservation.filter((f) => f.pass).length}/${preservation.length} files preserved byte-exact`)
for (const f of preservation) {
  if (!f.pass) console.log(`  FAIL ${f.path}: ${JSON.stringify(f)}`)
}
console.log(
  `check2: scanned=${scanned.length} hits=${hits.length} (audit_record=${buckets.audit_record.length} doc_reference=${buckets.doc_reference.length} code_or_config=${reverseDependencyHits.length})`,
)
for (const h of reverseDependencyHits) console.log(`  DEP-HIT ${h.file}:${h.line} ${h.pattern} ${h.text}`)
console.log(`overall: ${result.overall_pass ? 'PASS' : 'FAIL'}`)
process.exitCode = result.overall_pass ? 0 : 1
