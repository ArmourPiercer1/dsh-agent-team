#!/usr/bin/env node
/**
 * evidence-store.test.mjs - plain node:test coverage for scripts/evidence-store.mjs
 * (U3 evidence relocation). Every test builds a throwaway git repo under the
 * OS temp dir and points the store inside it; the real repository and store
 * are never touched. Run: node --test tests/evidence-store/
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const TOOL = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts', 'evidence-store.mjs')
const EV = 'dev/agent-workflow/evidence'
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

function sh(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed (${String(r.status)}): ${r.stderr}`)
  return r.stdout.trim()
}

function tool(cwd, args) {
  return spawnSync(process.execPath, [TOOL, ...args], { cwd, encoding: 'utf8' })
}

const ingestCmd = (repo) => tool(repo.root, ['ingest', '--from-commit', repo.srcCommit, '--keep-set', repo.keepSet])

/**
 * Temp repo whose source commit tracks, under the evidence prefix:
 *   KEEP.md + taskA/README.md          (keep set)
 *   taskA/run.log  'RUN OK\n'          (relocated, regular)
 *   taskB/exec.sh  '#!/bin/sh...'      (relocated, mode 100755 recorded in the tree)
 *   taskB/alias -> '../KEEP.md'        (relocated, mode 120000 symlink)
 * When `rm`, the relocated paths are additionally git rm'ed + committed, the
 * way the relocation commit does it; the store stays empty until ingest runs.
 */
function setupRepo(t, { rm = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'evidence-store-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  sh(root, ['init', '-b', 'main'])
  sh(root, ['config', 'user.email', 'test@example.invalid'])
  sh(root, ['config', 'user.name', 'evidence-store test'])
  sh(root, ['config', 'core.fileMode', 'false'])
  mkdirSync(join(root, EV, 'taskA'), { recursive: true })
  mkdirSync(join(root, EV, 'taskB'), { recursive: true })
  writeFileSync(join(root, EV, 'KEEP.md'), 'kept witness\n')
  writeFileSync(join(root, EV, 'taskA', 'README.md'), 'taskA witness\n')
  writeFileSync(join(root, EV, 'taskA', 'run.log'), 'RUN OK\n')
  writeFileSync(join(root, EV, 'taskB', 'exec.sh'), '#!/bin/sh\necho hi\n')
  sh(root, ['add', '-A'])
  sh(root, ['commit', '-m', 'evidence before relocation'])
  // Record exec + symlink modes in the TREE (FS-independent, unlike git add).
  const execOid = sh(root, ['hash-object', '-w', join(root, EV, 'taskB', 'exec.sh')])
  sh(root, ['update-index', '--add', '--cacheinfo', `100755,${execOid},${EV}/taskB/exec.sh`])
  const aliasOid = spawnSync('git', ['hash-object', '-w', '--stdin'], { cwd: root, encoding: 'utf8', input: '../KEEP.md' }).stdout.trim()
  sh(root, ['update-index', '--add', '--cacheinfo', `120000,${aliasOid},${EV}/taskB/alias`])
  sh(root, ['commit', '-m', 'record exec + symlink modes'])
  const srcCommit = sh(root, ['rev-parse', 'HEAD'])
  const keepSet = join(root, 'keep.txt')
  writeFileSync(keepSet, `${EV}/KEEP.md\n${EV}/taskA/README.md\n`)
  if (rm) {
    sh(root, ['rm', '-q', '--', `${EV}/taskA/run.log`, `${EV}/taskB/exec.sh`, `${EV}/taskB/alias`])
    sh(root, ['commit', '-m', 'git rm relocated evidence'])
  }
  return { root, store: join(root, '.artifacts', 'evidence'), keepSet, srcCommit }
}

const blobPathOf = (repo, content) => {
  const sha = sha256(Buffer.from(content))
  return join(repo.store, 'blobs', sha.slice(0, 2), sha)
}

const manifestOf = (repo) => readFileSync(join(repo.root, EV, 'RELOCATED-MANIFEST.tsv'), 'utf8')

test('ingest builds store + manifest, then is idempotent', (t) => {
  const repo = setupRepo(t)
  const r1 = ingestCmd(repo)
  assert.equal(r1.status, 0, r1.stdout + r1.stderr)
  assert.match(r1.stdout, /ingest verdict=pass .*listed=5 kept=2 relocated=3 bytes=\d+ blobs_written=3 blobs_skipped_existing=0/)
  const m1 = manifestOf(repo)
  const lines = m1.split('\n')
  assert.ok(lines[0].startsWith('# RELOCATED-MANIFEST - v1'))
  assert.ok(lines.some((l) => l === `# source-commit: ${repo.srcCommit}`))
  assert.ok(lines.some((l) => l.includes('# restore:')))
  assert.ok(lines.some((l) => l.includes('git cat-file blob <git_blob_oid>')))
  const body = lines.filter((l) => l !== '' && !l.startsWith('#')).map((l) => l.split('\t'))
  assert.deepEqual(body.map((c) => c[0]), [`${EV}/taskA/run.log`, `${EV}/taskB/alias`, `${EV}/taskB/exec.sh`], 'sorted by path')
  const byPath = new Map(body.map((c) => [c[0], c]))
  assert.equal(byPath.get(`${EV}/taskA/run.log`)[2], sha256(Buffer.from('RUN OK\n')))
  assert.equal(byPath.get(`${EV}/taskA/run.log`)[3], '7')
  assert.equal(byPath.get(`${EV}/taskB/exec.sh`)[4], '100755')
  assert.equal(byPath.get(`${EV}/taskB/alias`)[4], '120000')
  const r2 = ingestCmd(repo)
  assert.equal(r2.status, 0, r2.stdout + r2.stderr)
  assert.match(r2.stdout, /blobs_written=0 blobs_skipped_existing=3/)
  assert.equal(manifestOf(repo), m1, 'manifest reproducible')
})

test('verify is green after ingest + git rm', (t) => {
  const repo = setupRepo(t)
  assert.equal(ingestCmd(repo).status, 0)
  const r = tool(repo.root, ['verify'])
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /verify verdict=pass entries=3 bytes_ok=\d+ findings=0/)
})

test('verify RED when a store blob is deleted (MISSING)', (t) => {
  const repo = setupRepo(t)
  assert.equal(ingestCmd(repo).status, 0)
  rmSync(blobPathOf(repo, 'RUN OK\n'))
  const r = tool(repo.root, ['verify'])
  assert.equal(r.status, 1)
  assert.match(r.stdout, new RegExp(`FINDING MISSING ${EV}/taskA/run\\.log`))
  assert.match(r.stdout, /verify verdict=fail .*findings=1/)
})

test('verify RED when a store blob is tampered (DIGEST_MISMATCH)', (t) => {
  const repo = setupRepo(t)
  assert.equal(ingestCmd(repo).status, 0)
  writeFileSync(blobPathOf(repo, 'RUN OK\n'), 'TAMPERED CONTENT\n')
  const r = tool(repo.root, ['verify'])
  assert.equal(r.status, 1)
  assert.match(r.stdout, new RegExp(`FINDING DIGEST_MISMATCH ${EV}/taskA/run\\.log`))
})

test('verify RED while a manifest path is still tracked (GENERATION_CONFLICT)', (t) => {
  const repo = setupRepo(t, { rm: false })
  assert.equal(ingestCmd(repo).status, 0)
  const r = tool(repo.root, ['verify'])
  assert.equal(r.status, 1, 'must refuse while manifest paths are still tracked')
  assert.match(r.stdout, new RegExp(`FINDING GENERATION_CONFLICT ${EV}/taskA/run\\.log`))
})

test('restore rebuilds files from the store (modes + symlink) and never overwrites', (t) => {
  const repo = setupRepo(t)
  assert.equal(ingestCmd(repo).status, 0)
  const r1 = tool(repo.root, ['restore', `${EV}/taskA/run.log`, `${EV}/taskB/exec.sh`, `${EV}/taskB/alias`, '--to', 'out'])
  assert.equal(r1.status, 0, r1.stdout + r1.stderr)
  assert.equal(readFileSync(join(repo.root, 'out', EV, 'taskA', 'run.log'), 'utf8'), 'RUN OK\n')
  assert.ok((statSync(join(repo.root, 'out', EV, 'taskB', 'exec.sh')).mode & 0o111) !== 0, 'exec bit restored')
  const alias = join(repo.root, 'out', EV, 'taskB', 'alias')
  assert.ok(lstatSync(alias).isSymbolicLink(), 'symlink restored as symlink')
  assert.equal(readlinkSync(alias), '../KEEP.md')
  const r2 = tool(repo.root, ['restore', `${EV}/taskA/run.log`, '--to', 'out'])
  assert.equal(r2.status, 1, 'second restore must refuse to overwrite')
  assert.match(r2.stderr, new RegExp(`FINDING EXISTS .*${EV}/taskA/run\\.log`))
  assert.equal(readFileSync(join(repo.root, 'out', EV, 'taskA', 'run.log'), 'utf8'), 'RUN OK\n')
})

test('restore --from-git works when the store blob is gone', (t) => {
  const repo = setupRepo(t)
  assert.equal(ingestCmd(repo).status, 0)
  rmSync(blobPathOf(repo, 'RUN OK\n'))
  const r = tool(repo.root, ['restore', `${EV}/taskA/run.log`, '--to', 'out2', '--from-git'])
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.equal(readFileSync(join(repo.root, 'out2', EV, 'taskA', 'run.log'), 'utf8'), 'RUN OK\n')
})

test('restore without a store blob and without --from-git is refused (MISSING)', (t) => {
  const repo = setupRepo(t)
  assert.equal(ingestCmd(repo).status, 0)
  rmSync(blobPathOf(repo, 'RUN OK\n'))
  const r = tool(repo.root, ['restore', `${EV}/taskA/run.log`, '--to', 'out3'])
  assert.equal(r.status, 1)
  assert.match(r.stderr, new RegExp(`FINDING MISSING ${EV}/taskA/run\\.log`))
})

test('restore refuses paths that are not manifest entries', (t) => {
  const repo = setupRepo(t)
  assert.equal(ingestCmd(repo).status, 0)
  const r = tool(repo.root, ['restore', `${EV}/KEEP.md`, '--to', 'out4'])
  assert.equal(r.status, 1)
  assert.match(r.stderr, /FINDING PATH_NOT_MANIFESTED/)
})

test('verify/restore without a manifest fail MANIFEST_MISSING', (t) => {
  const repo = setupRepo(t)
  const r = tool(repo.root, ['verify'])
  assert.equal(r.status, 1)
  assert.match(r.stderr, /ERROR MANIFEST_MISSING/)
  assert.ok(!existsSync(join(repo.root, EV, 'RELOCATED-MANIFEST.tsv')))
})
